import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { streamAIReply } from "../ai.server";

const NO_CONFIG_MSG =
  "No AI provider configured. Please go to Settings and add your API token.";

export const action = async ({ request, params }) => {
  const { session } = await authenticate.admin(request);
  const shop = session.shop;
  const { sessionId } = params;

  const chatSession = await prisma.themeChangeSession.findFirst({
    where: { id: sessionId, shop },
  });
  if (!chatSession) {
    return new Response("Not found", { status: 404 });
  }

  const formData = await request.formData();
  const content = (formData.get("message") ?? "").toString().trim();
  if (!content) {
    return new Response("Bad request", { status: 400 });
  }

  // Persist user message first so it's included in the history we pass to the AI
  await prisma.themeChangeMessage.create({
    data: { sessionId, role: "user", content },
  });

  // Load AI config and conversation history in parallel
  const [config, history] = await Promise.all([
    prisma.themeAssistantConfig.findUnique({ where: { shop } }),
    prisma.themeChangeMessage.findMany({
      where: { sessionId },
      orderBy: { createdAt: "asc" },
      take: 40,
    }),
  ]);

  const encoder = new TextEncoder();
  let cancelled = false;

  const body = new ReadableStream({
    async start(controller) {
      const send = (evt) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));

      let fullText = "";

      if (!config?.apiToken) {
        // No config — stream the friendly error character by character
        for (const char of NO_CONFIG_MSG) {
          if (cancelled) break;
          send({ type: "chunk", text: char });
          await new Promise((r) => setTimeout(r, 20));
        }
        fullText = NO_CONFIG_MSG;
      } else {
        try {
          fullText = await streamAIReply({
            config,
            history,
            onChunk: (text) => send({ type: "chunk", text }),
            isCancelled: () => cancelled,
          });
        } catch (err) {
          fullText = `Error: ${err.message}`;
          send({ type: "chunk", text: fullText });
        }
      }

      await prisma.themeChangeMessage.create({
        data: { sessionId, role: "assistant", content: fullText },
      });

      send({ type: "done" });
      controller.close();
    },
    cancel() {
      cancelled = true;
    },
  });

  return new Response(body, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "X-Accel-Buffering": "no",
    },
  });
};