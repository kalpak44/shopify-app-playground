import { useState, useRef, useEffect } from "react";
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
      await prisma.themeChangeSession.deleteMany({
        where: { id: sessionId, shop },
      });
    }
    throw redirect("/");
  }

  return null;
};

// ─── Delete confirmation dialog ───────────────────────────────────────────────

// Uses the native <dialog> element so it renders in the browser's top layer —
// bypasses any stacking context created by AppProvider or AppBridge.
function DeleteDialog({ session, onClose }) {
  const ref = useRef(null);

  useEffect(() => {
    ref.current?.showModal();
  }, []);

  return (
    <dialog
      ref={ref}
      onClose={onClose}
      onClick={(e) => { if (e.target === ref.current) ref.current.close(); }}
      style={{
        border: "none",
        borderRadius: "12px",
        padding: 0,
        width: "420px",
        maxWidth: "calc(100vw - 32px)",
        boxShadow: "0 4px 20px rgba(0,0,0,0.15), 0 0 0 1px rgba(0,0,0,0.08)",
        fontFamily: "Inter, sans-serif",
      }}
    >
      {/* polaris-style: pseudo-backdrop via ::backdrop isn't styleable inline,
          but the native backdrop is fine for an embedded app */}
      <div style={{ padding: "24px" }}>
        <p
          style={{
            margin: "0 0 4px",
            fontSize: "16px",
            fontWeight: 650,
            color: "#202223",
          }}
        >
          Remove session?
        </p>
        <p
          style={{
            margin: "0 0 20px",
            fontSize: "14px",
            color: "#6d7175",
            lineHeight: 1.55,
          }}
        >
          <strong style={{ color: "#202223", fontWeight: 600 }}>
            {session.title || "Untitled session"}
          </strong>{" "}
          and all its messages and proposals will be permanently deleted.
        </p>

        <div
          style={{
            borderTop: "1px solid #e1e3e5",
            paddingTop: "16px",
            display: "flex",
            justifyContent: "flex-end",
            gap: "8px",
          }}
        >
          <button
            type="button"
            onClick={() => ref.current?.close()}
            style={{
              padding: "8px 16px",
              background: "#fff",
              color: "#202223",
              border: "1px solid #c9cccf",
              borderRadius: "6px",
              fontWeight: 500,
              fontSize: "14px",
              cursor: "pointer",
              fontFamily: "inherit",
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
                padding: "8px 16px",
                background: "#d72c0d",
                color: "#fff",
                border: "1px solid #b3200a",
                borderRadius: "6px",
                fontWeight: 600,
                fontSize: "14px",
                cursor: "pointer",
                fontFamily: "inherit",
              }}
            >
              Delete
            </button>
          </Form>
        </div>
      </div>
    </dialog>
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
            <h1 style={{ fontSize: "22px", fontWeight: 650, margin: "0 0 4px", color: "#202223" }}>
              Theme Assistant
            </h1>
            <p style={{ fontSize: "14px", color: "#6d7175", margin: 0 }}>
              Chat with the assistant to propose and apply changes to your active theme.
            </p>
          </div>
          <div style={{ display: "flex", gap: "8px" }}>
            <a
              href="/theme-assistant/settings"
              style={{
                padding: "8px 16px",
                background: "#fff",
                color: "#202223",
                border: "1px solid #c9cccf",
                borderRadius: "6px",
                fontWeight: 500,
                fontSize: "14px",
                textDecoration: "none",
                display: "inline-flex",
                alignItems: "center",
                gap: "6px",
              }}
            >
              Settings
            </a>
            <Form method="post">
              <input type="hidden" name="intent" value="new_session" />
              <button
                type="submit"
                style={{
                  padding: "8px 16px",
                  background: "#008060",
                  color: "#fff",
                  border: "1px solid #006e52",
                  borderRadius: "6px",
                  fontWeight: 600,
                  fontSize: "14px",
                  cursor: "pointer",
                  whiteSpace: "nowrap",
                  fontFamily: "inherit",
                }}
              >
                New session
              </button>
            </Form>
          </div>
        </div>

        {/* Sessions list */}
        {sessions.length === 0 ? (
          <div
            style={{
              padding: "40px 20px",
              textAlign: "center",
              border: "1px dashed #c9cccf",
              borderRadius: "8px",
              color: "#6d7175",
              fontSize: "14px",
            }}
          >
            No sessions yet. Click <strong>New session</strong> to get started.
          </div>
        ) : (
          <div
            style={{
              border: "1px solid #e1e3e5",
              borderRadius: "8px",
              overflow: "hidden",
              background: "#fff",
            }}
          >
            {sessions.map((s, i) => (
              <div
                key={s.id}
                style={{
                  display: "flex",
                  alignItems: "center",
                  borderTop: i === 0 ? "none" : "1px solid #e1e3e5",
                }}
              >
                <a
                  href={`/theme-assistant/${s.id}`}
                  style={{
                    flex: 1,
                    display: "flex",
                    alignItems: "center",
                    gap: "12px",
                    padding: "14px 16px",
                    textDecoration: "none",
                    color: "inherit",
                    minWidth: 0,
                  }}
                >
                  <span
                    style={{
                      flex: 1,
                      fontWeight: 500,
                      fontSize: "14px",
                      color: "#202223",
                      minWidth: 0,
                      overflow: "hidden",
                      textOverflow: "ellipsis",
                      whiteSpace: "nowrap",
                    }}
                  >
                    {s.title || "Untitled session"}
                  </span>
                  <span style={{ fontSize: "13px", color: "#8c9196", whiteSpace: "nowrap" }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </a>
                <button
                  type="button"
                  onClick={() => setDeleteTarget(s)}
                  title="Delete session"
                  style={{
                    margin: "0 12px",
                    padding: "6px 10px",
                    background: "transparent",
                    color: "#8c9196",
                    border: "1px solid transparent",
                    borderRadius: "6px",
                    cursor: "pointer",
                    fontSize: "14px",
                    fontFamily: "inherit",
                    flexShrink: 0,
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.color = "#d72c0d";
                    e.currentTarget.style.borderColor = "#fac8c3";
                    e.currentTarget.style.background = "#fff4f4";
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.color = "#8c9196";
                    e.currentTarget.style.borderColor = "transparent";
                    e.currentTarget.style.background = "transparent";
                  }}
                >
                  Delete
                </button>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Native dialog — renders in the top layer, always above AppProvider */}
      {deleteTarget && (
        <DeleteDialog
          session={deleteTarget}
          onClose={() => setDeleteTarget(null)}
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