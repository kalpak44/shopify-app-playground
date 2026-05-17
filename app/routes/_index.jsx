import { useState } from "react";
import { redirect, useLoaderData, useRouteError, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const sessions = await prisma.themeChangeSession.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, createdAt: true },
    });

    return { apiKey: process.env.SHOPIFY_API_KEY || "", sessions };
  } catch (error) {
    if (error instanceof Response && error.status === 410) {
      throw redirect("/auth/login");
    }
    throw error;
  }
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "new_session") {
    const created = await prisma.themeChangeSession.create({
      data: { shop, title: "New session", status: "open" },
    });
    throw redirect(`/theme-assistant/${created.id}`);
  }

  if (intent === "delete_session") {
    const sessionId = formData.get("sessionId")?.toString();
    if (sessionId) {
      // deleteMany with shop filter ensures ownership — no-op if not owned
      await prisma.themeChangeSession.deleteMany({
        where: { id: sessionId, shop },
      });
    }
    throw redirect("/");
  }

  return null;
};

// ─── Delete confirmation modal ────────────────────────────────────────────────

function DeleteModal({ session, onCancel }) {
  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onCancel}
        style={{
          position: "fixed",
          inset: 0,
          background: "rgba(0,0,0,0.45)",
          zIndex: 100,
        }}
      />
      {/* Dialog */}
      <div
        style={{
          position: "fixed",
          top: "50%",
          left: "50%",
          transform: "translate(-50%, -50%)",
          background: "#fff",
          borderRadius: "12px",
          padding: "28px 32px",
          width: "400px",
          maxWidth: "calc(100vw - 32px)",
          zIndex: 101,
          boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
        }}
      >
        <h2 style={{ margin: "0 0 10px", fontSize: "17px", fontWeight: 600, color: "#202223" }}>
          Remove session?
        </h2>
        <p style={{ margin: "0 0 24px", fontSize: "14px", color: "#6d7175", lineHeight: 1.5 }}>
          <strong style={{ color: "#202223" }}>
            {session.title || "Untitled session"}
          </strong>{" "}
          and all its messages and proposals will be permanently deleted. This
          cannot be undone.
        </p>
        <div style={{ display: "flex", gap: "10px", justifyContent: "flex-end" }}>
          <button
            type="button"
            onClick={onCancel}
            style={{
              padding: "9px 20px",
              background: "#fff",
              color: "#202223",
              border: "1px solid #c9cccf",
              borderRadius: "8px",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
          <Form method="post">
            <input type="hidden" name="intent" value="delete_session" />
            <input type="hidden" name="sessionId" value={session.id} />
            <button
              type="submit"
              style={{
                padding: "9px 20px",
                background: "#d72c0d",
                color: "#fff",
                border: "none",
                borderRadius: "8px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
              }}
            >
              Remove
            </button>
          </Form>
        </div>
      </div>
    </>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function Index() {
  const { apiKey, sessions } = useLoaderData();
  const [deleteTarget, setDeleteTarget] = useState(null);

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div style={{ padding: "32px 40px", fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            marginBottom: "32px",
          }}
        >
          <div>
            <h1 style={{ fontSize: "22px", fontWeight: 600, margin: "0 0 4px" }}>
              Theme Assistant
            </h1>
            <p style={{ fontSize: "14px", color: "#6d7175", margin: 0 }}>
              Chat with the assistant to propose and apply changes to your active theme.
            </p>
          </div>
          <div style={{ display: "flex", gap: "10px" }}>
            <a
              href="/theme-assistant/settings"
              style={{
                padding: "10px 18px",
                background: "#fff",
                color: "#202223",
                border: "1px solid #c9cccf",
                borderRadius: "8px",
                fontWeight: 500,
                fontSize: "14px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              ⚙ Settings
            </a>
            <Form method="post">
              <input type="hidden" name="intent" value="new_session" />
              <button
                type="submit"
                style={{
                  padding: "10px 20px",
                  background: "#008060",
                  color: "#fff",
                  border: "none",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                }}
              >
                + New Session
              </button>
            </Form>
          </div>
        </div>

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <p style={{ fontSize: "14px", color: "#6d7175" }}>
            No sessions yet. Start one to begin making theme changes.
          </p>
        ) : (
          <div style={{ display: "flex", flexDirection: "column", gap: "8px" }}>
            {sessions.map((s) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 18px",
                  background: "#fff",
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                }}
              >
                <a
                  href={`/theme-assistant/${s.id}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    textDecoration: "none",
                    color: "inherit",
                    minWidth: 0,
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 500, fontSize: "14px", minWidth: 0, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {s.title || "Untitled session"}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6d7175", whiteSpace: "nowrap" }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                  <span style={{ fontSize: "16px", color: "#8c9196" }}>→</span>
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(s)}
                  title="Remove session"
                  style={{
                    flexShrink: 0,
                    padding: "5px 10px",
                    background: "transparent",
                    color: "#8c9196",
                    border: "1px solid transparent",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "16px",
                    lineHeight: 1,
                    display: "flex",
                    alignItems: "center",
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#d72c0d";
                    e.currentTarget.style.borderColor = "#ffc1cc";
                    e.currentTarget.style.background = "#ffeef0";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#8c9196";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  🗑
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Confirmation modal */}
      {deleteTarget && (
        <DeleteModal
          session={deleteTarget}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};