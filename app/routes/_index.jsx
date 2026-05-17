import { redirect, useLoaderData, useRouteError, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  try {
    const { session } = await authenticate.admin(request);

    return {
      apiKey: process.env.SHOPIFY_API_KEY || "",
      shop: session.shop,
    };
  } catch (error) {
    // When accessed without Shopify context (no session, no ?shop= param),
    // authenticate.admin throws 410. Redirect to the manual login page instead.
    if (error instanceof Response && error.status === 410) {
      throw redirect("/auth/login");
    }
    throw error;
  }
};

export default function Index() {
  const { apiKey, shop } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-page heading="App Playground">
        <s-section heading="Welcome">
          <s-text>App is running for <strong>{shop}</strong>.</s-text>
        </s-section>
        <s-section heading="Features">
          <Link
            to="/theme-assistant"
            style={{ textDecoration: "none", display: "block" }}
          >
            <div
              style={{
                padding: "16px 20px",
                border: "1px solid #e1e3e5",
                borderRadius: "8px",
                background: "#fff",
                cursor: "pointer",
                transition: "box-shadow 0.15s",
              }}
              onMouseEnter={(e) =>
                (e.currentTarget.style.boxShadow =
                  "0 2px 8px rgba(0,0,0,0.12)")
              }
              onMouseLeave={(e) =>
                (e.currentTarget.style.boxShadow = "none")
              }
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <span style={{ fontSize: "24px" }}>🎨</span>
                <div>
                  <p
                    style={{
                      margin: 0,
                      fontWeight: 600,
                      fontSize: "15px",
                      color: "#202223",
                    }}
                  >
                    Theme Assistant
                  </p>
                  <p
                    style={{
                      margin: "4px 0 0",
                      fontSize: "13px",
                      color: "#6d7175",
                    }}
                  >
                    Chat with an assistant, review proposed theme file diffs,
                    and approve or reject changes before they are applied.
                  </p>
                </div>
                <span
                  style={{
                    marginLeft: "auto",
                    fontSize: "18px",
                    color: "#8c9196",
                  }}
                >
                  →
                </span>
              </div>
            </div>
          </Link>
        </s-section>
      </s-page>
    </AppProvider>
  );
}

export function ErrorBoundary() {
  return boundary.error(useRouteError());
}

export const headers = (headersArgs) => {
  return boundary.headers(headersArgs);
};