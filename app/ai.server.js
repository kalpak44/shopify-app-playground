function buildSystemPrompt(scopes) {
  const scopeList = (scopes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  const has = (...ss) => scopeList.length === 0 || ss.some((s) => scopeList.includes(s));

  // write_* implies read_* in Shopify's permission model
  const canReadThemes  = has("read_themes", "write_themes");
  const canWriteThemes = has("write_themes");

  const permissionNotes = [
    `Granted OAuth scopes: ${scopeList.length ? scopeList.join(", ") : "unknown (assume full access)"}`,
    !canReadThemes  && "⚠️ Theme read access not granted — do not attempt to list or read theme files.",
    !canWriteThemes && "⚠️ Theme write access not granted — do not propose theme file changes; guide the merchant to use the Theme Editor or Shopify CLI instead.",
  ].filter(Boolean).join("\n");

  return `You are a helpful AI assistant embedded in a Shopify admin app called Assistant GPT.
You help merchants manage their entire Shopify store — themes, orders, products, customers, discounts, metaobjects, markets, finances, analytics, and more.
You have access to tools that let you read and modify theme files, and run any Shopify Admin GraphQL query or mutation.

${permissionNotes}

## Rules
- Always respond in Markdown. Use code blocks for GraphQL queries, JSON results, or file content.
- Before doing anything, check the granted scopes above — never call a tool for a resource you don't have scope for.
- When the merchant asks about "today", "this week", "yesterday", or any relative time, call get_current_datetime first so you can build accurate date-range filters.
- Theme files: call list_theme_files first (prefix: 'sections/', 'templates/', 'config/', etc.) to discover structure, then read specific files. Section settings/blocks are in the {% schema %} tag. Global settings are in config/settings_schema.json.
- Always read the relevant theme file before proposing a change. Provide the complete new file content (not a diff) to propose_file_change.
- Store data queries: use shopify_graphql_query for any read. Always name your operations (e.g. "query ListProducts { ... }"). Show results in readable Markdown tables or lists.
- Always include the full \`id\` (GID) for every item in any listing — products, orders, customers, collections, variants, locations, etc. Display it in the table/list so it stays in conversation history and can be referenced directly in follow-up requests without re-querying.
- Store data mutations: ALWAYS describe exactly what you are about to change and ask the merchant to confirm BEFORE calling shopify_graphql_mutation. Never run delete, cancel, refund, or bulk-update mutations without explicit merchant approval.
- Keep explanations concise and practical.

## Shopify GraphQL Admin API — key patterns (API version 2025-10)

### General
- All IDs are Global IDs: \`gid://shopify/Product/123\`, \`gid://shopify/Order/456\`, etc.
- Connections use Relay pagination: \`edges { node { ... } } pageInfo { hasNextPage endCursor }\`
- Filter strings use the \`query:\` argument: \`query: "created_at:>2024-01-01 financial_status:paid"\`
- ISO 8601 dates: \`created_at:>2024-06-01T00:00:00Z\`
- Always request \`userErrors { field message }\` in every mutation response.

### Products (read_products / write_products)
- List products: \`query ListProducts { products(first: 50) { edges { node { id title status variants(first: 5) { edges { node { id title price sku inventoryQuantity } } } } } } }\`
- Search products: \`products(first: 20, query: "title:*headphone* status:ACTIVE")\`
- Create: \`mutation CreateProduct { productCreate(input: { title, descriptionHtml, vendor, productType, tags, status }) { product { id } userErrors { field message } } }\`
  - Note: products are created UNPUBLISHED by default. Call \`publishablePublish\` to make them live.
- Update: \`mutation UpdateProduct { productUpdate(input: { id, title, descriptionHtml, tags }) { product { id } userErrors { field message } } }\`
- Add variants to an existing product: use \`productVariantsBulkCreate(productId, variants: [{ price, compareAtPrice, optionValues: [{ name, optionId }] }])\`
- Update variant price/compareAtPrice: ⚠️ \`productVariantUpdate\` does NOT exist — always use \`productVariantsBulkUpdate\`. Full example:
  \`\`\`graphql
  mutation UpdateVariantPrices($productId: ID!, $variants: [ProductVariantsBulkInput!]!) {
    productVariantsBulkUpdate(productId: $productId, variants: $variants) {
      productVariants { id price compareAtPrice }
      userErrors { field message }
    }
  }
  \`\`\`
  Variables: \`{ "productId": "gid://shopify/Product/123", "variants": [{ "id": "gid://shopify/ProductVariant/456", "price": "29.99", "compareAtPrice": "39.99" }] }\`
- Publish a product: \`mutation PublishProduct { publishablePublish(id: "gid://shopify/Product/123", input: { publicationId: "gid://shopify/Publication/..." }) { ... } }\`

### Collections / Categories (read_products / write_products)
- "Categories" in Shopify are Collections. Two types: manual and smart (rule-based).
- List: \`query ListCollections { collections(first: 50) { edges { node { id title productsCount { count } } } } }\`
- Create manual: \`mutation CreateCollection { collectionCreate(input: { title, descriptionHtml }) { collection { id } userErrors { field message } } }\`
- Create smart (automated): include \`ruleSet: { appliedDisjunctively: false, rules: [{ column: TAG, relation: EQUALS, condition: "sale" }] }\` in the input.
- Add products to a manual collection: \`mutation AddProducts { collectionAddProducts(id, productIds: [...]) { collection { id } userErrors { field message } } }\`
- Update: \`collectionUpdate(input: { id, title, descriptionHtml, ruleSet })\`

### Orders (read_orders / write_orders)
- List: \`query ListOrders { orders(first: 50, sortKey: PROCESSED_AT, reverse: true) { edges { node { id name createdAt displayFinancialStatus displayFulfillmentStatus totalPriceSet { shopMoney { amount currencyCode } } customer { displayName email } lineItems(first: 10) { edges { node { name quantity sku } } } } } pageInfo { hasNextPage endCursor } } }\`
- Filter by date: \`orders(first: 50, query: "created_at:>2024-06-01 created_at:<2024-07-01")\`
- Filter by status: \`orders(first: 50, query: "financial_status:paid fulfillment_status:unfulfilled")\`
- Key fields: \`displayFinancialStatus\` (PAID, PENDING, REFUNDED…), \`displayFulfillmentStatus\` (FULFILLED, UNFULFILLED, PARTIAL…), \`totalPriceSet.shopMoney.amount\`

### Draft Orders (read_draft_orders / write_draft_orders)
- List: \`query ListDraftOrders { draftOrders(first: 20) { edges { node { id name status createdAt totalPrice customer { email } } } } }\`
- Filter: \`draftOrders(first: 20, query: "created_at:>2024-01-01")\`
- Create: \`mutation CreateDraftOrder { draftOrderCreate(input: { lineItems: [{ variantId, quantity }], email, shippingAddress: { ... }, note }) { draftOrder { id invoiceUrl } userErrors { field message } } }\`

### Customers (read_customers / write_customers)
- List: \`query ListCustomers { customers(first: 50) { edges { node { id displayName email phone createdAt amountSpent { amount currencyCode } tags } } } }\`
- Search: \`customers(first: 20, query: "email:john@example.com")\` or \`query: "tag:vip"\`
- Create: \`mutation CreateCustomer { customerCreate(input: { firstName, lastName, email, phone, tags: ["wholesale"], note }) { customer { id } userErrors { field message } } }\`
- Update: \`mutation UpdateCustomer { customerUpdate(input: { id, firstName, lastName, email, tags }) { customer { id } userErrors { field message } } }\`
- Add tags: \`mutation AddTags { tagsAdd(id: "gid://shopify/Customer/...", tags: ["vip"]) { node { id } userErrors { message } } }\`

### Inventory (read_inventory / write_inventory)
- Get inventory for a variant: query \`productVariant(id) { inventoryItem { id } }\` first to get the \`inventoryItemId\`.
- List inventory levels: \`inventoryItem(id) { inventoryLevels(first: 10) { edges { node { location { id name } quantities(names: ["available", "on_hand"]) { name quantity } } } } }\`
- Adjust quantity (delta, not absolute): \`mutation AdjustInventory { inventoryAdjustQuantities(input: { reason: "correction", name: "available", changes: [{ delta: 10, inventoryItemId: "gid://shopify/InventoryItem/...", locationId: "gid://shopify/Location/..." }] }) { inventoryAdjustmentGroup { reason changes { name delta } } userErrors { field message } } }\`
- Set absolute quantity: use \`inventorySetQuantities\` with \`quantities: [{ inventoryItemId, locationId, quantity, name: "available" }]\`

### Locations (read_locations)
- \`query ListLocations { locations(first: 20) { edges { node { id name address { city country } } } } }\`

### Discounts (read_discounts / write_discounts)
- List automatic discounts: \`query ListDiscounts { automaticDiscountNodes(first: 20) { edges { node { id automaticDiscount { ... on DiscountAutomaticBasic { title status startsAt endsAt } } } } } }\`
- List code discounts: \`discountNodes(first: 20) { edges { node { id discount { ... on DiscountCodeBasic { title status codes(first:3) { edges { node { code } } } } } } } }\`
- Create automatic % discount: \`mutation CreateDiscount { discountAutomaticBasicCreate(automaticBasicDiscount: { title, startsAt, customerGets: { value: { percentage: 0.15 }, items: { all: true } } }) { automaticDiscountNode { id } userErrors { field message } } }\`
- Create code discount: use \`discountCodeBasicCreate\` with \`code\`, \`customerGets\`, and optionally \`minimumRequirement\`.

### Price Rules (read_price_rules / write_price_rules)
- Legacy API but still active. Use \`priceRules(first: 20)\` to list. Prefer the Discounts API for new discounts.

### Metaobjects (read_metaobjects / write_metaobjects)
- List definitions: \`query ListMetaobjectDefs { metaobjectDefinitions(first: 20) { edges { node { id type name fieldDefinitions { key name type { name } } } } } }\`
- List instances: \`query ListMetaobjects { metaobjects(type: "color", first: 20) { edges { node { id handle fields { key value } } } } }\`
- Upsert (create or update by handle): \`mutation UpsertMetaobject { metaobjectUpsert(handle: { type: "color", handle: "red-swatch" }, metaobject: { fields: [{ key: "hex", value: "#FF0000" }] }) { metaobject { id handle } userErrors { field message } } }\`

### Markets (read_markets / write_markets)
- \`query ListMarkets { markets(first: 20) { edges { node { id name enabled primary regions(first: 5) { edges { node { ... on Country { name code } } } } } } } }\`

### Analytics & Reports (read_analytics / read_reports / write_reports)
- For sales totals, query orders with date filters and sum \`totalPriceSet.shopMoney.amount\` in your response.
- Saved reports: \`query ListReports { reports(first: 20) { edges { node { id name category } } } }\`
- Always call \`get_current_datetime\` to anchor "today" / "this week" / "last month" before building date filters.

### Fulfillments (read_fulfillments / write_fulfillments)
- Get fulfillment orders for an order: \`order(id) { fulfillmentOrders(first: 5) { edges { node { id status lineItems(first: 10) { edges { node { id remainingQuantity } } } assignedLocation { location { id name } } } } } }\`
- Create fulfillment: \`mutation CreateFulfillment { fulfillmentCreateV2(fulfillment: { lineItemsByFulfillmentOrder: [{ fulfillmentOrderId, fulfillmentOrderLineItems: [{ id, quantity }] }] }) { fulfillment { id status } userErrors { field message } } }\`

### Shipping (read_shipping / write_shipping)
- List delivery profiles: \`query ListProfiles { deliveryProfiles(first: 10) { edges { node { id name } } } }\`
- Most shipping edits are done through delivery profiles and zones.

### Gift Cards (read_gift_cards / write_gift_cards)
- List: \`query ListGiftCards { giftCards(first: 20) { edges { node { id balance { amount currencyCode } maskedCode expiresOn customer { email } } } } }\`
- Create: \`mutation CreateGiftCard { giftCardCreate(input: { initialValue: "50.00", currency: "USD", customerId }) { giftCard { id maskedCode } userErrors { field message } } }\`

### Publications (read_publications / write_publications)
- List sales channels: \`query ListPublications { publications(first: 10) { edges { node { id name } } } }\`
- Publish a product to a channel: \`mutation Publish { publishablePublish(id: "gid://shopify/Product/...", input: { publicationId: "gid://shopify/Publication/..." }) { publishable { ... on Product { id } } userErrors { field message } } }\`
- Unpublish: \`publishableUnpublish(id, input: { publicationId })\``;
}

// ─── Normalized tool definitions ─────────────────────────────────────────────

const TOOL_DEFS = [
  {
    name: "get_current_datetime",
    description:
      "Get the current date and time on the server. Call this whenever the merchant's question involves relative time — 'today', 'this week', 'yesterday', 'last month', etc. — so you can construct accurate date-range filters in GraphQL queries.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "get_active_theme",
    description: "Get the name and ID of the merchant's currently active Shopify theme.",
    parameters: { type: "object", properties: {}, required: [] },
  },
  {
    name: "list_theme_files",
    description:
      "List filenames in the active Shopify theme. Optionally filter by a directory prefix such as 'sections/', 'templates/', 'snippets/', 'assets/', 'config/', 'layout/', or 'locales/'. Returns filenames only — use read_theme_file to get the content of a specific file. Call this first to discover what sections, templates, and other files exist before reading or modifying them.",
    parameters: {
      type: "object",
      properties: {
        prefix: {
          type: "string",
          description:
            "Optional path prefix to filter results, e.g. 'sections/', 'templates/', 'config/'. Omit to list all files.",
        },
      },
      required: [],
    },
  },
  {
    name: "read_theme_file",
    description:
      "Read the content of a file from the active Shopify theme. Use this to understand the current state before proposing changes.",
    parameters: {
      type: "object",
      properties: {
        path: {
          type: "string",
          description:
            "File path relative to the theme root, e.g. templates/index.json or sections/header.liquid",
        },
      },
      required: ["path"],
    },
  },
  {
    name: "propose_file_change",
    description:
      "Propose a change to a theme file. Creates a diff the merchant must review and approve before it is written. Always read the file first so the proposal reflects the actual current content.",
    parameters: {
      type: "object",
      properties: {
        path: { type: "string", description: "File path to modify" },
        new_content: {
          type: "string",
          description: "The complete new content for the file (not a diff — the full updated file)",
        },
        summary: {
          type: "string",
          description: "Brief human-readable description of what this change does",
        },
      },
      required: ["path", "new_content", "summary"],
    },
  },
  {
    name: "shopify_graphql_query",
    description:
      "Run any Shopify Admin GraphQL query to read store data — orders, products, customers, discounts, metaobjects, inventory, markets, finances, analytics, fulfillments, shipping, gift cards, reports, etc. Construct a valid GraphQL query and optionally pass variables.",
    parameters: {
      type: "object",
      properties: {
        query: { type: "string", description: "The GraphQL query string" },
        variables: {
          type: "object",
          description: "Optional query variables",
        },
      },
      required: ["query"],
    },
  },
  {
    name: "shopify_graphql_mutation",
    description:
      "Run a Shopify Admin GraphQL mutation to create, update, or delete store data. IMPORTANT: you MUST describe the change to the merchant and receive explicit confirmation in the conversation before calling this tool. Never run destructive mutations (delete, cancel, refund, bulk delete) without clear merchant approval.",
    parameters: {
      type: "object",
      properties: {
        mutation: { type: "string", description: "The GraphQL mutation string" },
        variables: {
          type: "object",
          description: "Optional mutation variables",
        },
        summary: {
          type: "string",
          description: "One-sentence description of what this mutation does, shown to the merchant",
        },
      },
      required: ["mutation", "summary"],
    },
  },
];

// ─── OpenAI-compatible agent loop ────────────────────────────────────────────

async function streamOpenAITurn({
  baseUrl, apiToken, modelName, messages, tools, onChunk, isCancelled,
}) {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ model: modelName, messages, tools, stream: true }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${err.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let textContent = "";
  const tcMap = {}; // index -> { id, name, argsStr }

  while (true) {
    if (isCancelled()) break;
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      const payload = line.slice(6).trim();
      if (payload === "[DONE]") continue;
      let chunk;
      try { chunk = JSON.parse(payload); } catch { continue; }

      const delta = chunk.choices?.[0]?.delta;
      if (!delta) continue;

      if (delta.content) {
        textContent += delta.content;
        onChunk(delta.content);
      }

      if (delta.tool_calls) {
        for (const tc of delta.tool_calls) {
          const idx = tc.index;
          if (!tcMap[idx]) tcMap[idx] = { id: "", name: "", argsStr: "" };
          if (tc.id) tcMap[idx].id = tc.id;
          if (tc.function?.name) tcMap[idx].name += tc.function.name;
          if (tc.function?.arguments) tcMap[idx].argsStr += tc.function.arguments;
        }
      }
    }
  }

  const toolCalls = Object.values(tcMap).map((tc) => {
    let args = {};
    try { args = JSON.parse(tc.argsStr || "{}"); } catch { /* ignore */ }
    return { id: tc.id, name: tc.name, args };
  });

  const assistantMsg = {
    role: "assistant",
    content: textContent || null,
    ...(toolCalls.length > 0 && {
      tool_calls: toolCalls.map((tc) => ({
        id: tc.id,
        type: "function",
        function: { name: tc.name, arguments: JSON.stringify(tc.args) },
      })),
    }),
  };

  return { textContent, toolCalls, assistantMsg };
}

async function runOpenAIAgentLoop({
  baseUrl, apiToken, modelName, scopes, history, executeTool, onChunk, onStatus, isCancelled,
}) {
  const messages = [
    { role: "system", content: buildSystemPrompt(scopes) },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];
  const tools = TOOL_DEFS.map((t) => ({
    type: "function",
    function: { name: t.name, description: t.description, parameters: t.parameters },
  }));

  for (let turn = 0; turn < 8; turn++) {
    const { textContent, toolCalls, assistantMsg } = await streamOpenAITurn({
      baseUrl, apiToken, modelName, messages, tools, onChunk, isCancelled,
    });

    if (toolCalls.length === 0) return textContent;

    messages.push(assistantMsg);

    for (const tc of toolCalls) {
      if (isCancelled()) return textContent;
      onStatus(tc.name);
      let result;
      try { result = await executeTool(tc.name, tc.args); }
      catch (err) { result = { error: err.message }; }
      messages.push({
        role: "tool",
        tool_call_id: tc.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }
  }

  const msg = " [Max tool iterations reached]";
  onChunk(msg);
  return msg;
}

// ─── Anthropic agent loop ────────────────────────────────────────────────────

async function streamAnthropicTurn({
  baseUrl, apiToken, modelName, systemMsg, messages, tools, onChunk, isCancelled,
}) {
  const resp = await fetch(`${baseUrl}/v1/messages`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiToken,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model: modelName,
      system: systemMsg,
      messages,
      tools,
      stream: true,
      max_tokens: 2048,
    }),
  });

  if (!resp.ok) {
    const err = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${err.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let textContent = "";
  const blockMap = {}; // index -> { type, id, name, inputStr }

  while (true) {
    if (isCancelled()) break;
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      let evt;
      try { evt = JSON.parse(line.slice(6)); } catch { continue; }

      if (evt.type === "content_block_start") {
        blockMap[evt.index] = {
          type: evt.content_block.type,
          id: evt.content_block.id ?? "",
          name: evt.content_block.name ?? "",
          inputStr: "",
        };
      } else if (evt.type === "content_block_delta") {
        const block = blockMap[evt.index];
        if (!block) continue;
        if (evt.delta.type === "text_delta") {
          textContent += evt.delta.text;
          onChunk(evt.delta.text);
        } else if (evt.delta.type === "input_json_delta") {
          block.inputStr += evt.delta.partial_json;
        }
      }
    }
  }

  const toolUses = Object.values(blockMap)
    .filter((b) => b.type === "tool_use")
    .map((b) => {
      let args = {};
      try { args = JSON.parse(b.inputStr || "{}"); } catch { /* ignore */ }
      return { id: b.id, name: b.name, args };
    });

  return { textContent, toolUses };
}

async function runAnthropicAgentLoop({
  baseUrl, apiToken, modelName, scopes, history, executeTool, onChunk, onStatus, isCancelled,
}) {
  const messages = history
    .filter((m) => m.role !== "system")
    .map((m) => ({ role: m.role, content: m.content }));
  const tools = TOOL_DEFS.map((t) => ({
    name: t.name,
    description: t.description,
    input_schema: t.parameters,
  }));

  for (let turn = 0; turn < 8; turn++) {
    const { textContent, toolUses } = await streamAnthropicTurn({
      baseUrl, apiToken, modelName, systemMsg: buildSystemPrompt(scopes),
      messages, tools, onChunk, isCancelled,
    });

    if (toolUses.length === 0) return textContent;

    messages.push({
      role: "assistant",
      content: toolUses.map((tu) => ({
        type: "tool_use",
        id: tu.id,
        name: tu.name,
        input: tu.args,
      })),
    });

    const toolResults = [];
    for (const tu of toolUses) {
      if (isCancelled()) return textContent;
      onStatus(tu.name);
      let result;
      try { result = await executeTool(tu.name, tu.args); }
      catch (err) { result = { error: err.message }; }
      toolResults.push({
        type: "tool_result",
        tool_use_id: tu.id,
        content: typeof result === "string" ? result : JSON.stringify(result),
      });
    }
    messages.push({ role: "user", content: toolResults });
  }

  const msg = " [Max tool iterations reached]";
  onChunk(msg);
  return msg;
}

// ─── Session title generator ─────────────────────────────────────────────────

export async function generateSessionTitle(config, userMessage, aiResponse) {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const modelName = config.modelName ?? "gpt-4o";
  const userSnippet = userMessage.slice(0, 300);
  const aiSnippet = aiResponse.slice(0, 300);
  const prompt = `User: ${userSnippet}\nAssistant: ${aiSnippet}`;

  try {
    if (config.provider === "anthropic") {
      const resp = await fetch(`${baseUrl}/v1/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "x-api-key": config.apiToken,
          "anthropic-version": "2023-06-01",
        },
        body: JSON.stringify({
          model: modelName,
          system: "Reply with ONLY a 2-3 word title in title case. No punctuation, no quotes, no explanation.",
          messages: [{ role: "user", content: prompt }],
          max_tokens: 16,
        }),
      });
      if (!resp.ok) return null;
      const data = await resp.json();
      return data.content?.[0]?.text?.trim().slice(0, 50) ?? null;
    }

    const resp = await fetch(`${baseUrl}/chat/completions`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${config.apiToken}`,
      },
      body: JSON.stringify({
        model: modelName,
        messages: [
          { role: "system", content: "Reply with ONLY a 2-3 word title in title case. No punctuation, no quotes, no explanation." },
          { role: "user", content: prompt },
        ],
        max_tokens: 16,
      }),
    });
    if (!resp.ok) return null;
    const data = await resp.json();
    return data.choices?.[0]?.message?.content?.trim().slice(0, 50) ?? null;
  } catch {
    return null;
  }
}

// ─── Public API ──────────────────────────────────────────────────────────────

export async function runAgentLoop({
  config,
  scopes,
  history,
  executeTool,
  onChunk,
  onStatus = () => {},
  isCancelled = () => false,
}) {
  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const modelName = config.modelName ?? "gpt-4o";

  if (config.provider === "anthropic") {
    return runAnthropicAgentLoop({
      baseUrl, apiToken: config.apiToken, modelName, scopes,
      history, executeTool, onChunk, onStatus, isCancelled,
    });
  }

  return runOpenAIAgentLoop({
    baseUrl, apiToken: config.apiToken, modelName, scopes,
    history, executeTool, onChunk, onStatus, isCancelled,
  });
}