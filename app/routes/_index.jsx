import { redirect, useLoaderData, useRouteError, Form } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);
    const shop = session.shop;

    const sessions = await prisma.themeChangeSession.findMany({
      where: { shop },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { id: true, title: true, status: true, createdAt: true },
    });

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      sessions,
    };
  } catch (error) {
    if (error instanceof Response && error.status === 410) {
      throw redirect("/auth/login");
    }
    throw error;
  }
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  if (formData.get("intent") === "new_session") {
    const created = await prisma.themeChangeSession.create({
      data: { shop, title: "New session", status: "open" },
    });
    throw redirect(`/theme-assistant/${created.id}`);
  }

  return null;
};

const STATUS_COLORS = { open: "#2196F3", closed: "#9E9E9E" };

export default function Index() {
  const { apiKey, sessions } = useLoaderData();

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
              <a
                key={s.id}
                href={`/theme-assistant/${s.id}`}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                  padding: "14px 18px",
                  background: "#fff",
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                  textDecoration: "none",
                  color: "inherit",
                }}
              >
                <span style={{ flex: 1, fontWeight: 500, fontSize: "14px" }}>
                  {s.title || "Untitled session"}
                </span>
                <span
                  style={{
                    fontSize: "12px",
                    padding: "2px 10px",
                    borderRadius: "12px",
                    background: STATUS_COLORS[s.status] ?? "#ccc",
                    color: "#fff",
                    fontWeight: 500,
                  }}
                >
                  {s.status}
                </span>
                <span style={{ fontSize: "12px", color: "#6d7175" }}>
                  {new Date(s.createdAt).toLocaleDateString()}
                </span>
                <span style={{ fontSize: "16px", color: "#8c9196" }}>→</span>
              </a>
            ))}
          </div>
        )}
      </div>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};