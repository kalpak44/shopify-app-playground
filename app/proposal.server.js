import { getMainTheme, readThemeFile } from "./theme.server";
import { generateUnifiedDiff } from "./diff.server";

const BANNER_KEYWORDS = [
  "banner",
  "sale",
  "homepage",
  "home page",
  "offer",
  "discount",
  "promo",
  "promotion",
];

function detectBannerIntent(message) {
  const lower = message.toLowerCase();
  return BANNER_KEYWORDS.some((kw) => lower.includes(kw));
}

export async function generateProposal(admin, userMessage) {
  if (!detectBannerIntent(userMessage)) {
    return {
      type: "no_match",
      message:
        'I can currently only help with adding a sale banner to the homepage. ' +
        'Try something like: "Add a sale banner to the homepage".',
    };
  }

  let theme;
  try {
    theme = await getMainTheme(admin);
  } catch (err) {
    return {
      type: "error",
      message: `Could not fetch the active theme: ${err.message}`,
    };
  }

  const filePath = "templates/index.json";
  let fileContent;
  try {
    fileContent = await readThemeFile(admin, theme.id, filePath);
  } catch (err) {
    return {
      type: "error",
      message: `Could not read ${filePath}: ${err.message}`,
    };
  }

  if (!fileContent) {
    return {
      type: "error",
      message: `File ${filePath} is missing from the active theme and cannot be modified.`,
    };
  }

  let template;
  try {
    template = JSON.parse(fileContent);
  } catch {
    return {
      type: "error",
      message: `File ${filePath} is not valid JSON and cannot be modified safely.`,
    };
  }

  if (!template.sections || typeof template.sections !== "object") {
    return {
      type: "error",
      message: `File ${filePath} has an unexpected structure (missing "sections" key).`,
    };
  }

  if (!Array.isArray(template.order)) {
    template.order = [];
  }

  const sectionKey = `ai_sale_banner_${Date.now()}`;

  const updatedTemplate = {
    ...template,
    sections: {
      ...template.sections,
      [sectionKey]: {
        type: "rich-text",
        blocks: {
          heading: {
            type: "heading",
            settings: { heading: "Special Offer" },
          },
          text: {
            type: "text",
            settings: { text: "Save today on selected products." },
          },
        },
        block_order: ["heading", "text"],
        settings: {},
      },
    },
    order: [...template.order, sectionKey],
  };

  const before = fileContent;
  const after = JSON.stringify(updatedTemplate, null, 2);
  const diff = generateUnifiedDiff(before, after, filePath);

  return {
    type: "proposal",
    themeId: theme.id,
    themeName: theme.name,
    summary: `Add sale banner section "${sectionKey}" to ${filePath}`,
    files: [{ path: filePath, before, after, diff }],
  };
}