import { useLoaderData, useActionData, useNavigation, useRouteError, Form, Link } from "react-router";
import { boundary } from "@shopify/shopify-app-react-router/server";
import { AppProvider } from "@shopify/shopify-app-react-router/react";
import { authenticate } from "../shopify.server";
import prisma from "../db.server";

// ─── Loader ──────────────────────────────────────────────────────────────────

export const loader = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const config = await prisma.assistantConfig.findUnique({
    where: { shop: session.shop },
  });
  return {
    apiKey: process.env.SHOPIFY_API_KEY || "",
    config,
  };
};

// ─── Action ──────────────────────────────────────────────────────────────────

export const action = async ({ request }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;

  const formData = await request.formData();
  const provider  = (formData.get("provider")  ?? "").toString().trim();
  const baseUrl   = (formData.get("baseUrl")   ?? "").toString().trim() || null;
  const apiToken  = (formData.get("apiToken")  ?? "").toString().trim() || null;
  const modelName = (formData.get("modelName") ?? "").toString().trim() || null;

  await prisma.assistantConfig.upsert({
    where: { shop },
    create: { shop, provider, baseUrl, apiToken, modelName },
    update: { provider, baseUrl, apiToken, modelName },
  });

  return { success: true };
};

// ─── Providers list ───────────────────────────────────────────────────────────

const PROVIDERS = [
  { value: "openai",    label: "OpenAI" },
  { value: "anthropic", label: "Anthropic" },
  { value: "ollama",    label: "Ollama (local)" },
  { value: "custom",    label: "Custom / Other" },
];

const PROVIDER_DEFAULTS = {
  openai:    { baseUrl: "https://api.openai.com/v1",         model: "gpt-4o" },
  anthropic: { baseUrl: "https://api.anthropic.com",         model: "claude-opus-4-7" },
  ollama:    { baseUrl: "http://localhost:11434/api",         model: "llama3" },
  custom:    { baseUrl: "",                                   model: "" },
};

// ─── Components ──────────────────────────────────────────────────────────────

function Field({ label, hint, children }) {
  return (
    <div style={{ marginBottom: "20px" }}>
      <label
        style={{
          display: "block",
          fontSize: "13px",
          fontWeight: 600,
          color: "#202223",
          marginBottom: "6px",
        }}
      >
        {label}
      </label>
      {children}
      {hint && (
        <p style={{ margin: "5px 0 0", fontSize: "12px", color: "#6d7175" }}>
          {hint}
        </p>
      )}
    </div>
  );
}

const inputStyle = {
  width: "100%",
  padding: "9px 12px",
  fontSize: "14px",
  border: "1px solid #c9cccf",
  borderRadius: "8px",
  fontFamily: "inherit",
  boxSizing: "border-box",
  outline: "none",
  background: "#fff",
};

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function AssistantSettings() {
  const { apiKey, config } = useLoaderData();
  const actionData = useActionData();
  const navigation = useNavigation();
  const isSaving = navigation.state !== "idle";

  return (
    <AppProvider embedded apiKey={apiKey}>
      <div style={{ padding: "32px 40px", fontFamily: "Inter, sans-serif" }}>
        {/* Header */}
        <div style={{ display: "flex", alignItems: "center", gap: "12px", marginBottom: "32px" }}>
          <Link
            to="/"
            style={{ fontSize: "13px", color: "#6d7175", textDecoration: "none" }}
          >
            ← Assistant GPT
          </Link>
          <span style={{ color: "#e1e3e5" }}>|</span>
          <h1 style={{ fontSize: "22px", fontWeight: 600, margin: 0 }}>
            Configuration
          </h1>
        </div>

        {/* Success banner */}
        {actionData?.success && (
          <div
            style={{
              marginBottom: "24px",
              padding: "12px 16px",
              background: "#d4edda",
              border: "1px solid #b8ddc8",
              borderRadius: "8px",
              color: "#155724",
              fontSize: "14px",
            }}
          >
            Settings saved.
          </div>
        )}

        <div style={{ maxWidth: "560px" }}>
          <Form method="post">
            {/* Provider */}
            <Field
              label="Provider"
              hint="Select the AI provider. Base URL and model name will be pre-filled; adjust as needed."
            >
              <select
                name="provider"
                defaultValue={config?.provider ?? "openai"}
                style={{ ...inputStyle, cursor: "pointer" }}
                onChange={(e) => {
                  const defaults = PROVIDER_DEFAULTS[e.target.value] ?? PROVIDER_DEFAULTS.custom;
                  const form = e.target.closest("form");
                  if (defaults.baseUrl) form.baseUrl.value = defaults.baseUrl;
                  if (defaults.model)   form.modelName.value = defaults.model;
                }}
              >
                {PROVIDERS.map((p) => (
                  <option key={p.value} value={p.value}>
                    {p.label}
                  </option>
                ))}
              </select>
            </Field>

            {/* Base URL */}
            <Field
              label="Base URL"
              hint="The API endpoint root. Leave blank to use the provider's default."
            >
              <input
                type="url"
                name="baseUrl"
                defaultValue={config?.baseUrl ?? ""}
                placeholder={PROVIDER_DEFAULTS[config?.provider ?? "openai"].baseUrl}
                style={inputStyle}
              />
            </Field>

            {/* API Token */}
            <Field
              label="API Token"
              hint="Your secret API key. Stored as-is — do not use production keys in a dev environment."
            >
              <input
                type="password"
                name="apiToken"
                defaultValue={config?.apiToken ?? ""}
                placeholder="sk-..."
                autoComplete="off"
                style={inputStyle}
              />
            </Field>

            {/* Model name */}
            <Field
              label="Model name"
              hint='The model identifier to use, e.g. "gpt-4o" or "claude-opus-4-7".'
            >
              <input
                type="text"
                name="modelName"
                defaultValue={config?.modelName ?? ""}
                placeholder={PROVIDER_DEFAULTS[config?.provider ?? "openai"].model}
                style={inputStyle}
              />
            </Field>

            <div style={{ display: "flex", gap: "10px", marginTop: "8px" }}>
              <button
                type="submit"
                disabled={isSaving}
                style={{
                  padding: "8px 20px",
                  background: isSaving ? "#6b6b6b" : "#303030",
                  color: "#fff",
                  border: isSaving ? "1px solid #6b6b6b" : "1px solid #303030",
                  borderRadius: "8px",
                  fontWeight: 600,
                  fontSize: "14px",
                  lineHeight: "20px",
                  cursor: isSaving ? "not-allowed" : "pointer",
                  fontFamily: "inherit",
                }}
              >
                {isSaving ? "Saving…" : "Save"}
              </button>
              <Link
                to="/"
                style={{
                  padding: "8px 20px",
                  background: "#f6f6f7",
                  color: "#303030",
                  border: "1px solid #e1e3e5",
                  borderRadius: "8px",
                  fontWeight: 500,
                  fontSize: "14px",
                  lineHeight: "20px",
                  textDecoration: "none",
                  display: "inline-flex",
                  alignItems: "center",
                }}
              >
                Cancel
              </Link>
            </div>
          </Form>
        </div>
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