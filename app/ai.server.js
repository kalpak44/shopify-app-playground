function buildSystemPrompt(scopes) {
  const scopeList = (scopes ?? "").split(",").map((s) => s.trim()).filter(Boolean);
  // write_themes implies read access in Shopify's permission model
  const canRead  = scopeList.length === 0 || scopeList.includes("read_themes") || scopeList.includes("write_themes");
  const canWrite = scopeList.length === 0 || scopeList.includes("write_themes");

  const permLines = [
    `Granted OAuth scopes: ${scopeList.length ? scopeList.join(", ") : "unknown (assume full access)"}`,
    !canRead  && "⚠️ read_themes is NOT granted — do not attempt to list or read theme files. Inform the merchant and suggest they check the app's permissions in the Shopify Partner dashboard.",
    !canWrite && "⚠️ write_themes is NOT granted — do not propose file changes. Instead guide the merchant to apply changes manually via the Theme Editor (Online Store → Themes → Edit code) or the Shopify CLI (`shopify theme push`).",
  ].filter(Boolean).join("\n");

  return `You are a helpful AI assistant embedded in a Shopify admin app called Theme Assistant.
You help merchants understand and modify their Shopify themes.
You have access to tools that let you read theme files and propose changes.

${permLines}

Rules:
- Always respond in Markdown. Use code blocks for file content or code snippets.
- Before doing anything, verify you have the required permissions above — never call a tool you don't have scope for.
- When asked about theme structure, sections, blocks, or settings: call list_theme_files first (with the relevant prefix like 'sections/', 'templates/', 'config/') to discover what exists, then read specific files as needed.
- Section settings and blocks are defined in the {% schema %} tag inside each .liquid file — read the section file to understand its schema.
- Global theme settings are in config/settings_schema.json; current values are in config/settings_data.json.
- Always read the relevant file before proposing a change so your proposal reflects the actual current state.
- When proposing a change, provide the complete new file content (not a diff) to propose_file_change.
- Keep explanations concise and practical — one short paragraph is usually enough.
- If the merchant asks what a file contains, read it and show the relevant parts in a code block.`;
}

// ─── Normalized tool definitions ─────────────────────────────────────────────

const TOOL_DEFS = [
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

  console.log("[AI] Scopes:", JSON.stringify(scopes));
  console.log("[AI] System prompt:\n" + buildSystemPrompt(scopes));

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