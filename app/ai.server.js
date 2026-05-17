// Streams a chat completion from an OpenAI-compatible API (OpenAI, Ollama, custom).
async function streamOpenAI({ baseUrl, apiToken, modelName, messages, onChunk, isCancelled }) {
  const resp = await fetch(`${baseUrl}/chat/completions`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiToken}`,
    },
    body: JSON.stringify({ model: modelName, messages, stream: true }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`OpenAI API ${resp.status}: ${body.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";

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
      if (payload === "[DONE]") return fullText;
      try {
        const evt = JSON.parse(payload);
        const text = evt.choices?.[0]?.delta?.content ?? "";
        if (text) {
          fullText += text;
          onChunk(text);
        }
      } catch {
        // ignore malformed SSE line
      }
    }
  }

  return fullText;
}

// Streams a chat completion from the Anthropic Messages API.
async function streamAnthropic({ baseUrl, apiToken, modelName, messages, onChunk, isCancelled }) {
  const systemMsg = messages.find((m) => m.role === "system")?.content ?? "";
  const chatMessages = messages.filter((m) => m.role !== "system");

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
      messages: chatMessages,
      stream: true,
      max_tokens: 1024,
    }),
  });

  if (!resp.ok) {
    const body = await resp.text();
    throw new Error(`Anthropic API ${resp.status}: ${body.slice(0, 300)}`);
  }

  const reader = resp.body.getReader();
  const decoder = new TextDecoder();
  let buf = "";
  let fullText = "";

  while (true) {
    if (isCancelled()) break;
    const { done, value } = await reader.read();
    if (done) break;

    buf += decoder.decode(value, { stream: true });
    const lines = buf.split("\n");
    buf = lines.pop() ?? "";

    for (const line of lines) {
      if (!line.startsWith("data: ")) continue;
      try {
        const evt = JSON.parse(line.slice(6));
        if (evt.type === "content_block_delta" && evt.delta?.type === "text_delta") {
          const text = evt.delta.text ?? "";
          if (text) {
            fullText += text;
            onChunk(text);
          }
        }
      } catch {
        // ignore malformed SSE line
      }
    }
  }

  return fullText;
}

const SYSTEM_PROMPT =
  "You are a helpful AI assistant embedded in a Shopify admin app called Theme Assistant. " +
  "You help merchants understand and modify their Shopify themes. " +
  "Keep responses concise and practical. " +
  "When asked about theme changes, explain what the change involves and which files would be affected.";

/**
 * Streams a chat reply using the shop's configured AI provider.
 * Calls onChunk(text) for each piece of content as it arrives.
 * Returns the full accumulated text when done.
 *
 * @param {{ provider: string, baseUrl: string, apiToken: string, modelName: string }} config
 * @param {{ role: string, content: string }[]} history  — ordered conversation history (newest last)
 * @param {(text: string) => void} onChunk
 * @param {() => boolean} isCancelled
 */
export async function streamAIReply({ config, history, onChunk, isCancelled = () => false }) {
  const messages = [
    { role: "system", content: SYSTEM_PROMPT },
    ...history.map((m) => ({ role: m.role, content: m.content })),
  ];

  const baseUrl = config.baseUrl ?? "https://api.openai.com/v1";
  const modelName = config.modelName ?? "gpt-4o";

  if (config.provider === "anthropic") {
    return streamAnthropic({ baseUrl, apiToken: config.apiToken, modelName, messages, onChunk, isCancelled });
  }

  // openai / ollama / custom — all OpenAI-compatible
  return streamOpenAI({ baseUrl, apiToken: config.apiToken, modelName, messages, onChunk, isCancelled });
}