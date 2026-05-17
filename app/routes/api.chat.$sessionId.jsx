import { authenticate } from "../shopify.server";
import prisma from "../db.server";
import { runAgentLoop } from "../ai.server";
import { getMainTheme, readThemeFile } from "../theme.server";
import { generateUnifiedDiff } from "../diff.server";

const NO_CONFIG_MSG =
  "No AI provider configured. Please go to Settings and add your API token.";

const TOOL_STATUS = {
  get_active_theme: "Checking active theme…",
  read_theme_file: "Reading theme file…",
  propose_file_change: "Creating proposal…",
};

export const action = async ({ request, params }) => {
  const { admin, session } = await authenticate.admin(request);
  const shop = session.shop;
  const { sessionId } = params;

  const chatSession = await prisma.themeChangeSession.findFirst({
    where: { id: sessionId, shop },
  });
  if (!chatSession) return new Response("Not found", { status: 404 });

  const formData = await request.formData();
  const content = (formData.get("message") ?? "").toString().trim();
  if (!content) return new Response("Bad request", { status: 400 });

  // Persist user message first so it appears in the history sent to the AI
  await prisma.themeChangeMessage.create({
    data: { sessionId, role: "user", content },
  });

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

  // Cache theme lookup to avoid redundant Shopify API calls within one request
  let cachedTheme = null;
  const getTheme = async () => {
    if (!cachedTheme) cachedTheme = await getMainTheme(admin);
    return cachedTheme;
  };

  const executeTool = async (name, args) => {
    if (name === "get_active_theme") {
      const theme = await getTheme();
      return { id: theme.id, name: theme.name };
    }

    if (name === "read_theme_file") {
      const theme = await getTheme();
      const fileContent = await readThemeFile(admin, theme.id, args.path);
      return fileContent ?? `File not found: ${args.path}`;
    }

    if (name === "propose_file_change") {
      const theme = await getTheme();
      const before = (await readThemeFile(admin, theme.id, args.path)) ?? "";
      const diff = generateUnifiedDiff(before, args.new_content, args.path);
      await prisma.themeChangeProposal.create({
        data: {
          sessionId,
          shop,
          themeId: theme.id,
          status: "pending",
          summary: args.summary,
          files: [{ path: args.path, before, after: args.new_content, diff }],
        },
      });
      return {
        success: true,
        message: "Proposal created and is now visible in the sidebar for the merchant to review.",
      };
    }

    return { error: `Unknown tool: ${name}` };
  };

  const body = new ReadableStream({
    async start(controller) {
      const send = (evt) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(evt)}\n\n`));

      let fullText = "";

      if (!config?.apiToken) {
        for (const char of NO_CONFIG_MSG) {
          if (cancelled) break;
          send({ type: "chunk", text: char });
          await new Promise((r) => setTimeout(r, 20));
        }
        fullText = NO_CONFIG_MSG;
      } else {
        try {
          fullText = await runAgentLoop({
            config,
            history,
            executeTool,
            onChunk: (text) => send({ type: "chunk", text }),
            onStatus: (toolName) =>
              send({ type: "status", text: TOOL_STATUS[toolName] ?? `Running ${toolName}…` }),
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