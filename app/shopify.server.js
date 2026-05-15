import "@shopify/shopify-app-react-router/adapters/node";
import {
  ApiVersion,
  AppDistribution,
  shopifyApp,
} from "@shopify/shopify-app-react-router/server";
import { PrismaSessionStorage } from "@shopify/shopify-app-session-storage-prisma";
import prisma from "./db.server";

const shopify = shopifyApp({
  apiKey: process.env.SHOPIFY_API_KEY,
  apiSecretKey: process.env.SHOPIFY_API_SECRET || "",
  apiVersion: ApiVersion.October25,
  scopes: process.env.SCOPES?.split(",").filter(Boolean),
  appUrl: process.env.SHOPIFY_APP_URL || "",
  authPathPrefix: "/auth",
  sessionStorage: new PrismaSessionStorage(prisma),
  distribution: AppDistribution.AppStore,
  future: {
    expiringOfflineAccessTokens: true,
  },
  hooks: {
    afterAuth: async ({ admin }) => {
      const definitions = [
        {
          name: "Product Metafield",
          namespace: "custom",
          key: "product_metafield",
          type: "single_line_text_field",
          ownerType: "PRODUCT",
          pinnedPosition: 1,
        },
        {
          name: "Product Attachment",
          namespace: "custom",
          key: "product_attachment",
          type: "file_reference",
          ownerType: "PRODUCT",
          pinnedPosition: 2,
        },
      ];

      for (const definition of definitions) {
        const response = await admin.graphql(
          `#graphql
          mutation CreateMetafieldDefinition($definition: MetafieldDefinitionInput!) {
            metafieldDefinitionCreate(definition: $definition) {
              createdDefinition { id name }
              userErrors { field message code }
            }
          }`,
          { variables: { definition } }
        );

        const { data } = await response.json();
        const errors = data?.metafieldDefinitionCreate?.userErrors ?? [];
        const alreadyExists = errors.some((e) => e.code === "TAKEN");

        if (alreadyExists) {
          console.log(`[afterAuth] "${definition.name}" already exists, skipping.`);
        } else if (errors.length > 0) {
          console.error(`[afterAuth] "${definition.name}" errors:`, errors);
        } else {
          console.log(`[afterAuth] "${definition.name}" created:`, data?.metafieldDefinitionCreate?.createdDefinition?.id);
        }
      }
    },
  },
  ...(process.env.SHOP_CUSTOM_DOMAIN
    ? { customShopDomains: [process.env.SHOP_CUSTOM_DOMAIN] }
    : {}),
});

export default shopify;
export const addDocumentResponseHeaders = shopify.addDocumentResponseHeaders;
export const authenticate = shopify.authenticate;
export const login = shopify.login;