import {
  redirect,
  useLoaderData,
  useNavigation,
  Form,
  useActionData,
} from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateProposal } from "../proposal.server";
import { readThemeFile, writeThemeFile } from "../theme.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { sessionId } = params;

  const chatSession = await prisma.themeChangeSession.findFirst({
    where: { id: sessionId, shop },
  });

  if (!chatSession) {
    throw new Response("Session not found", { status: 404 });
  }

  const [messages, proposals] = await Promise.all([
    prisma.themeChangeMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
    prisma.themeChangeProposal.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop,
    chatSession,
    messages,
    proposals,
  };
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const { sessionId } = params;

  // Verify session ownership before any mutation
  const chatSession = await prisma.themeChangeSession.findFirst({
    where: { id: sessionId, shop },
  });

  if (!chatSession) {
    throw new Response("Session not found", { status: 404 });
  }

  const formData = await request.formData();
  const intent = formData.get("intent");

  // ── send_message ────────────────────────────────────────────────────────────
  if (intent === "send_message") {
    const content = (formData.get("message") ?? "").toString().trim();
    if (!content) return null;

    await prisma.themeChangeMessage.create({
      data: { sessionId, role: "user", content },
    });

    const result = await generateProposal(admin, content);

    if (result.type === "proposal") {
      const [proposal] = await Promise.all([
        prisma.themeChangeProposal.create({
          data: {
            sessionId,
            shop,
            themeId: result.themeId,
            status: "pending",
            summary: result.summary,
            files: result.files,
          },
        }),
        prisma.themeChangeMessage.create({
          data: {
            sessionId,
            role: "assistant",
            content: `I've reviewed your active theme "${result.themeName}" and created a proposal. Please review the diff below and approve or reject the change.`,
          },
        }),
      ]);
      void proposal; // used via DB read on next load
    } else {
      await prisma.themeChangeMessage.create({
        data: {
          sessionId,
          role: "assistant",
          content: result.message,
        },
      });
    }

    throw redirect(`/theme-assistant/${sessionId}`);
  }

  // ── approve_proposal ────────────────────────────────────────────────────────
  if (intent === "approve_proposal") {
    const proposalId = formData.get("proposalId")?.toString();
    if (!proposalId) return { error: "Missing proposal ID." };

    const proposal = await prisma.themeChangeProposal.findFirst({
      where: { id: proposalId, shop, sessionId },
    });

    if (!proposal) return { error: "Proposal not found." };
    if (proposal.status !== "pending") {
      return { error: `Proposal is already ${proposal.status}.` };
    }

    const files = proposal.files;

    // Re-read each file and check for conflicts before writing anything
    for (const file of files) {
      let current;
      try {
        current = await readThemeFile(admin, proposal.themeId, file.path);
      } catch (err) {
        return {
          error: `Could not re-read ${file.path} before applying: ${err.message}`,
        };
      }

      if (current === null || current.trim() !== file.before.trim()) {
        return {
          error: `Conflict: ${file.path} has changed since this proposal was created. Reject this proposal and start a new session.`,
        };
      }
    }

    // All clear — write files
    for (const file of files) {
      try {
        await writeThemeFile(admin, proposal.themeId, file.path, file.after);
      } catch (err) {
        return { error: `Failed to write ${file.path}: ${err.message}` };
      }
    }

    await Promise.all([
      prisma.themeChangeProposal.update({
        where: { id: proposalId },
        data: { status: "approved" },
      }),
      prisma.themeChangeMessage.create({
        data: { sessionId, role: "assistant", content: "Change applied." },
      }),
    ]);

    throw redirect(`/theme-assistant/${sessionId}`);
  }

  // ── reject_proposal ─────────────────────────────────────────────────────────
  if (intent === "reject_proposal") {
    const proposalId = formData.get("proposalId")?.toString();
    if (!proposalId) return { error: "Missing proposal ID." };

    const proposal = await prisma.themeChangeProposal.findFirst({
      where: { id: proposalId, shop, sessionId },
    });

    if (!proposal) return { error: "Proposal not found." };
    if (proposal.status !== "pending") {
      return { error: `Proposal is already ${proposal.status}.` };
    }

    await Promise.all([
      prisma.themeChangeProposal.update({
        where: { id: proposalId },
        data: { status: "rejected" },
      }),
      prisma.themeChangeMessage.create({
        data: { sessionId, role: "assistant", content: "Change rejected." },
      }),
    ]);

    throw redirect(`/theme-assistant/${sessionId}`);
  }

  return null;
};

// ─── Components ──────────────────────────────────────────────────────────────

function DiffViewer({ diff }) {
  const lines = (diff ?? "").split("\n");
  return (
    <pre
      style={{
        fontFamily: "monospace",
        fontSize: "12px",
        lineHeight: "1.5",
        overflow: "auto",
        margin: 0,
        padding: "8px",
        background: "#fafbfc",
        border: "1px solid #e1e3e5",
        borderRadius: "4px",
        maxHeight: "400px",
      }}
    >
      {lines.map((line, i) => {
        let bg = "transparent";
        let color = "inherit";

        if (line.startsWith("+") && !line.startsWith("+++")) {
          bg = "#e6ffed";
          color = "#22863a";
        } else if (line.startsWith("-") && !line.startsWith("---")) {
          bg = "#ffeef0";
          color = "#cb2431";
        } else if (line.startsWith("@@")) {
          bg = "#dbedff";
          color = "#0550ae";
        } else if (line.startsWith("---") || line.startsWith("+++")) {
          color = "#586069";
        }

        return (
          <span
            key={i}
            style={{ display: "block", background: bg, color, whiteSpace: "pre" }}
          >
            {line}
          </span>
        );
      })}
    </pre>
  );
}

function ProposalCard({ proposal, actionError, isSubmitting }) {
  const isPending = proposal.status === "pending";

  const statusColors = {
    pending: { bg: "#fff3cd", color: "#856404" },
    approved: { bg: "#d4edda", color: "#155724" },
    rejected: { bg: "#f8d7da", color: "#721c24" },
  };
  const sc = statusColors[proposal.status] ?? statusColors.pending;

  return (
    <div
      style={{
        border: "1px solid #e1e3e5",
        borderRadius: "8px",
        overflow: "hidden",
        marginBottom: "16px",
      }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: "12px",
          padding: "12px 16px",
          background: "#f6f6f7",
          borderBottom: "1px solid #e1e3e5",
        }}
      >
        <span style={{ flex: 1, fontWeight: 600, fontSize: "14px" }}>
          Proposed change
        </span>
        <span
          style={{
            fontSize: "12px",
            padding: "2px 10px",
            borderRadius: "12px",
            background: sc.bg,
            color: sc.color,
            fontWeight: 500,
          }}
        >
          {proposal.status}
        </span>
      </div>

      {/* Summary */}
      <div style={{ padding: "12px 16px" }}>
        <p style={{ margin: "0 0 12px", color: "#6d7175", fontSize: "13px" }}>
          {proposal.summary}
        </p>

        {/* Files */}
        {(proposal.files ?? []).map((file, fi) => (
          <div key={fi} style={{ marginBottom: "12px" }}>
            <p
              style={{
                margin: "0 0 6px",
                fontFamily: "monospace",
                fontSize: "13px",
                fontWeight: 600,
              }}
            >
              {file.path}
            </p>
            <DiffViewer diff={file.diff} />
          </div>
        ))}

        {/* Action error */}
        {actionError && (
          <div
            style={{
              marginTop: "12px",
              padding: "10px 14px",
              background: "#ffeef0",
              border: "1px solid #ffc1cc",
              borderRadius: "6px",
              color: "#cb2431",
              fontSize: "13px",
            }}
          >
            {actionError}
          </div>
        )}

        {/* Approve / Reject */}
        {isPending && (
          <div
            style={{
              display: "flex",
              gap: "10px",
              marginTop: "16px",
            }}
          >
            <Form method="post">
              <input type="hidden" name="intent" value="approve_proposal" />
              <input type="hidden" name="proposalId" value={proposal.id} />
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "8px 20px",
                  background: "#008060",
                  color: "#fff",
                  border: "none",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                {isSubmitting ? "Applying…" : "Approve & Apply"}
              </button>
            </Form>
            <Form method="post">
              <input type="hidden" name="intent" value="reject_proposal" />
              <input type="hidden" name="proposalId" value={proposal.id} />
              <button
                type="submit"
                disabled={isSubmitting}
                style={{
                  padding: "8px 20px",
                  background: "#fff",
                  color: "#d72c0d",
                  border: "1px solid #d72c0d",
                  borderRadius: "6px",
                  fontWeight: 600,
                  cursor: isSubmitting ? "not-allowed" : "pointer",
                  fontSize: "14px",
                }}
              >
                Reject
              </button>
            </Form>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function ThemeAssistantSession() {
  const { apiKey, chatSession, messages, proposals } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSubmitting = navigation.state !== "idle";
  const hasProposals = proposals.length > 0;

  const pendingProposalIds = new Set(
    proposals.filter((p) => p.status === "pending").map((p) => p.id)
  );

  return (
    <AppProvider embedded apiKey={apiKey}>
      {/* Full-viewport flex column */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          height: "100vh",
          fontFamily: "Inter, sans-serif",
          background: "#f6f6f7",
        }}
      >
        {/* ── Header ──────────────────────────────────────────────────────── */}
        <div
          style={{
            flexShrink: 0,
            display: "flex",
            alignItems: "center",
            gap: "12px",
            padding: "0 20px",
            height: "52px",
            background: "#fff",
            borderBottom: "1px solid #e1e3e5",
          }}
        >
          <a
            href="/"
            style={{
              fontSize: "13px",
              color: "#6d7175",
              textDecoration: "none",
              display: "flex",
              alignItems: "center",
              gap: "4px",
            }}
          >
            ← Back
          </a>
          <span style={{ color: "#e1e3e5" }}>|</span>
          <span style={{ fontSize: "15px", fontWeight: 600, color: "#202223" }}>
            {chatSession.title || "Theme Assistant"}
          </span>
        </div>

        {/* ── Body ────────────────────────────────────────────────────────── */}
        <div style={{ flex: 1, display: "flex", overflow: "hidden" }}>

          {/* ── Chat column ─────────────────────────────────────────────── */}
          <div
            style={{
              flex: 1,
              display: "flex",
              flexDirection: "column",
              overflow: "hidden",
              background: "#fff",
              borderRight: hasProposals ? "1px solid #e1e3e5" : "none",
            }}
          >
            {/* Messages */}
            <div
              style={{
                flex: 1,
                overflowY: "auto",
                padding: "24px 28px",
                display: "flex",
                flexDirection: "column",
                gap: "12px",
              }}
            >
              {messages.length === 0 ? (
                <p style={{ color: "#6d7175", fontSize: "14px", margin: 0 }}>
                  Describe the theme change you want to make.
                  <br />
                  <span style={{ fontSize: "13px" }}>
                    Try: <em>"Add a sale banner to the homepage"</em>
                  </span>
                </p>
              ) : (
                messages.map((msg) => (
                  <div
                    key={msg.id}
                    style={{
                      display: "flex",
                      justifyContent: msg.role === "user" ? "flex-end" : "flex-start",
                    }}
                  >
                    <div
                      style={{
                        maxWidth: "72%",
                        padding: "10px 14px",
                        borderRadius:
                          msg.role === "user"
                            ? "18px 18px 4px 18px"
                            : "18px 18px 18px 4px",
                        background: msg.role === "user" ? "#008060" : "#f0f0f1",
                        color: msg.role === "user" ? "#fff" : "#202223",
                        fontSize: "14px",
                        lineHeight: "1.55",
                      }}
                    >
                      {msg.content}
                    </div>
                  </div>
                ))
              )}
            </div>

            {/* Input bar — pinned to bottom */}
            <div
              style={{
                flexShrink: 0,
                padding: "14px 20px",
                borderTop: "1px solid #e1e3e5",
                background: "#fff",
              }}
            >
              <Form method="post">
                <input type="hidden" name="intent" value="send_message" />
                <div style={{ display: "flex", gap: "10px", alignItems: "flex-end" }}>
                  <textarea
                    name="message"
                    placeholder='Describe a theme change, e.g. "Add a sale banner to the homepage"'
                    rows={2}
                    required
                    style={{
                      flex: 1,
                      padding: "10px 14px",
                      fontSize: "14px",
                      border: "1px solid #c9cccf",
                      borderRadius: "10px",
                      resize: "none",
                      fontFamily: "inherit",
                      lineHeight: "1.5",
                      outline: "none",
                    }}
                  />
                  <button
                    type="submit"
                    disabled={isSubmitting}
                    style={{
                      padding: "10px 22px",
                      background: isSubmitting ? "#95c4b8" : "#008060",
                      color: "#fff",
                      border: "none",
                      borderRadius: "10px",
                      fontWeight: 600,
                      cursor: isSubmitting ? "not-allowed" : "pointer",
                      fontSize: "14px",
                      whiteSpace: "nowrap",
                      transition: "background 0.15s",
                    }}
                  >
                    {isSubmitting ? "…" : "Send"}
                  </button>
                </div>
              </Form>
            </div>
          </div>

          {/* ── Proposals sidebar ───────────────────────────────────────── */}
          {hasProposals && (
            <div
              style={{
                width: "460px",
                flexShrink: 0,
                overflowY: "auto",
                padding: "20px",
                background: "#f6f6f7",
              }}
            >
              <p
                style={{
                  fontSize: "13px",
                  fontWeight: 600,
                  color: "#6d7175",
                  margin: "0 0 14px",
                  textTransform: "uppercase",
                  letterSpacing: "0.04em",
                }}
              >
                Proposals
              </p>
              {proposals.map((proposal) => (
                <ProposalCard
                  key={proposal.id}
                  proposal={proposal}
                  actionError={
                    pendingProposalIds.has(proposal.id) ? actionData?.error : null
                  }
                  isSubmitting={isSubmitting}
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </AppProvider>
  );
}