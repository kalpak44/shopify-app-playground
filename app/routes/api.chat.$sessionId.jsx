import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { generateProposal } from "../proposal.server";

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
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

  // Persist user message immediately
  await prisma.themeChangeMessage.create({
    data: { sessionId, role: "user", content },
  });

  // Generate full reply (may call Shopify theme API)
  const result = await generateProposal(admin, content);

  let replyText;
  if (result.type === "proposal") {
    await prisma.themeChangeProposal.create({
      data: {
        sessionId,
        shop,
        themeId: result.themeId,
        status: "pending",
        summary: result.summary,
        files: result.files,
      },
    });
    replyText = `I've reviewed your active theme "${result.themeName}" and prepared a proposal. Please review the diff below and approve or reject the change.`;
  } else {
    replyText = result.message;
  }

  const encoder = new TextEncoder();
  let cancelled = false;

  const body = new ReadableStream({
    async start(controller) {
      // Stream reply character by character to simulate typing
      for (const char of replyText) {
        if (cancelled) break;
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "chunk", text: char })}\n\n`)
        );
        await new Promise((r) => setTimeout(r, 22));
      }

      if (!cancelled) {
        // Persist assistant message only after full text is streamed
        await prisma.themeChangeMessage.create({
          data: { sessionId, role: "assistant", content: replyText },
        });
        controller.enqueue(
          encoder.encode(`data: ${JSON.stringify({ type: "done" })}\n\n`)
        );
      }
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