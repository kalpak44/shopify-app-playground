import { redirect, useLoaderData, useRouteLoaderData, Form } from "react-router";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const sessions = await prisma.themeChangeSession.findMany({
    where: { shop },
    orderBy: { createdAt: "desc" },
    take: 50,
    select: {
      id: true,
      title: true,
      status: true,
      createdAt: true,
    },
  });

  return { shop, sessions };
};

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const intent = formData.get("intent");

  if (intent === "new_session") {
    const newSession = await prisma.themeChangeSession.create({
      data: { shop, title: "New session", status: "open" },
    });
    throw redirect(`/theme-assistant/${newSession.id}`);
  }

  return null;
};

const STATUS_COLORS = {
  open: "#2196F3",
  closed: "#9E9E9E",
};

export default function ThemeAssistantIndex() {
  const { sessions } = useLoaderData();
  const parent = useRouteLoaderData("routes/theme-assistant");
  const apiKey = parent?.apiKey ?? "";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-page heading="Theme Assistant">
        <s-section heading="Start a new session">
          <p style={{ marginBottom: "12px", color: "#6d7175" }}>
            Chat with the assistant to propose and apply changes to your active
            theme.
          </p>
          <Form method="post">
            <input type="hidden" name="intent" value="new_session" />
            <s-button submit variant="primary">
              New Session
            </s-button>
          </Form>
        </s-section>

        <s-section heading="Previous sessions">
          {sessions.length === 0 ? (
            <s-text>No sessions yet.</s-text>
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
                    padding: "12px 16px",
                    background: "#fff",
                    border: "1px solid #e1e3e5",
                    borderRadius: "8px",
                    textDecoration: "none",
                    color: "inherit",
                  }}
                >
                  <span style={{ flex: 1, fontWeight: 500 }}>
                    {s.title || "Untitled session"}
                  </span>
                  <span
                    style={{
                      fontSize: "12px",
                      padding: "2px 8px",
                      borderRadius: "12px",
                      background: STATUS_COLORS[s.status] ?? "#ccc",
                      color: "#fff",
                    }}
                  >
                    {s.status}
                  </span>
                  <span style={{ fontSize: "12px", color: "#6d7175" }}>
                    {new Date(s.createdAt).toLocaleDateString()}
                  </span>
                </a>
              ))}
            </div>
          )}
        </s-section>
      </s-page>
    </AppProvider>
  );
}