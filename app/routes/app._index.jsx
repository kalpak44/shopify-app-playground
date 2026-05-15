import { useLoaderData } from "react-router";
import { authenticate } from "../shopify.server";

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);

  return { shop: session.shop };
};

export default function AppIndex() {
  const { shop } = useLoaderData();

  return (
    <s-page heading="Shopify App Playground">
      <s-section heading="Welcome">
        <s-text>App is running for <strong>{shop}</strong>.</s-text>
        <s-text>The "Product Metafield" definition was created on install via the afterAuth hook.</s-text>
      </s-section>
    </s-page>
  );
}