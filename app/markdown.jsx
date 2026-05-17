// Lightweight markdown renderer — no external dependencies.
// Handles: fenced code blocks, headings, bullet lists, bold, italic, inline code, hr.

const INLINE_CODE = {
  background: "#f0f0f1",
  padding: "1px 5px",
  borderRadius: "3px",
  fontFamily: "'SFMono-Regular', Consolas, monospace",
  fontSize: "92%",
};

const CODE_BLOCK = {
  background: "#1e1e2e",
  color: "#cdd6f4",
  padding: "14px 18px",
  borderRadius: "8px",
  fontSize: "12.5px",
  fontFamily: "'SFMono-Regular', Consolas, monospace",
  overflowX: "auto",
  margin: "10px 0",
  lineHeight: "1.55",
};

function renderInline(text, keyPrefix) {
  const parts = [];
  // matches **bold**, *italic*, `code` — in one pass, picks earliest match
  const re = /(\*\*(.+?)\*\*|\*(.+?)\*|`([^`]+)`)/g;
  let last = 0;
  let k = 0;
  let m;
  while ((m = re.exec(text)) !== null) {
    if (m.index > last) parts.push(text.slice(last, m.index));
    if (m[0].startsWith("**"))
      parts.push(<strong key={`${keyPrefix}-${k++}`}>{m[2]}</strong>);
    else if (m[0].startsWith("*"))
      parts.push(<em key={`${keyPrefix}-${k++}`}>{m[3]}</em>);
    else
      parts.push(
        <code key={`${keyPrefix}-${k++}`} style={INLINE_CODE}>
          {m[4]}
        </code>
      );
    last = m.index + m[0].length;
  }
  if (last < text.length) parts.push(text.slice(last));
  return parts;
}

export function Markdown({ children }) {
  const text = (children ?? "").replace(/\r\n/g, "\n");
  if (!text.trim()) return null;

  const elements = [];
  const lines = text.split("\n");
  let i = 0;
  let ek = 0; // element key

  while (i < lines.length) {
    const line = lines[i];

    // ── Fenced code block ──────────────────────────────────────────────────
    if (line.startsWith("```")) {
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith("```")) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // consume closing ```
      elements.push(
        <pre key={ek++} style={CODE_BLOCK}>
          <code>{codeLines.join("\n")}</code>
        </pre>
      );
      continue;
    }

    // ── Heading ───────────────────────────────────────────────────────────
    const hm = line.match(/^(#{1,6})\s+(.*)/);
    if (hm) {
      const level = hm[1].length;
      const size = ["18px", "16px", "15px", "14px", "14px", "13px"][level - 1];
      elements.push(
        <p key={ek++} style={{ fontWeight: 700, fontSize: size, margin: "14px 0 4px" }}>
          {renderInline(hm[2], ek)}
        </p>
      );
      i++;
      continue;
    }

    // ── Unordered list ────────────────────────────────────────────────────
    if (line.match(/^[-*+] /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^[-*+] /)) {
        items.push(lines[i].replace(/^[-*+] /, ""));
        i++;
      }
      elements.push(
        <ul key={ek++} style={{ margin: "6px 0", paddingLeft: "22px", lineHeight: "1.65" }}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `li-${ii}`)}</li>
          ))}
        </ul>
      );
      continue;
    }

    // ── Ordered list ──────────────────────────────────────────────────────
    if (line.match(/^\d+\. /)) {
      const items = [];
      while (i < lines.length && lines[i].match(/^\d+\. /)) {
        items.push(lines[i].replace(/^\d+\. /, ""));
        i++;
      }
      elements.push(
        <ol key={ek++} style={{ margin: "6px 0", paddingLeft: "22px", lineHeight: "1.65" }}>
          {items.map((item, ii) => (
            <li key={ii}>{renderInline(item, `oli-${ii}`)}</li>
          ))}
        </ol>
      );
      continue;
    }

    // ── Horizontal rule ───────────────────────────────────────────────────
    if (line.match(/^(---+|\*\*\*+|___+)$/)) {
      elements.push(
        <hr key={ek++} style={{ border: "none", borderTop: "1px solid #e1e3e5", margin: "14px 0" }} />
      );
      i++;
      continue;
    }

    // ── Empty line ────────────────────────────────────────────────────────
    if (line.trim() === "") {
      i++;
      continue;
    }

    // ── Paragraph ─────────────────────────────────────────────────────────
    const paraLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== "" &&
      !lines[i].startsWith("```") &&
      !lines[i].match(/^#{1,6} /) &&
      !lines[i].match(/^[-*+] /) &&
      !lines[i].match(/^\d+\. /) &&
      !lines[i].match(/^(---+|\*\*\*+|___+)$/)
    ) {
      paraLines.push(lines[i]);
      i++;
    }
    if (paraLines.length > 0) {
      elements.push(
        <p key={ek++} style={{ margin: "4px 0", lineHeight: "1.65" }}>
          {renderInline(paraLines.join(" "), `p-${ek}`)}
        </p>
      );
    }
  }

  return <>{elements}</>;
}