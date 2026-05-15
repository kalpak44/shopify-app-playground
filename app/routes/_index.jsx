import { useLoaderData, useRouteError } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    shop: session.shop,
  };
};

export default function Index() {
  const { apiKey, shop } = useLoaderData();

  return (
    <AppProvider embedded apiKey={apiKey}>
      <s-page heading="App Playground">
        <s-section heading="Welcome">
          <s-text>App is running for <strong>{shop}</strong>.</s-text>
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