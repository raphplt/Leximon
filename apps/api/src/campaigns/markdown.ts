import { EMAIL_COLORS, escapeHtml } from "../email/layout";

/**
 * The reduced Markdown of campaign bodies, converted to e-mail HTML and to plain text.
 *
 * Accepted: paragraphs (one line break gives a `<br>`), `## titles`, `- lists`, `**bold**`,
 * `*italic*`, `[links](https://…)` and, alone on its line, `![an image](https://leximon.fr/….png)`.
 * Everything else is shown as typed, escaped: no raw HTML, no image from elsewhere, no other link
 * scheme.
 */

type Block =
  | { readonly kind: "paragraph"; readonly lines: readonly string[] }
  | { readonly kind: "title"; readonly text: string }
  | { readonly kind: "list"; readonly items: readonly string[] }
  | { readonly kind: "image"; readonly alt: string; readonly url: string };

const TITLE = /^#{1,3}\s+(.+)$/;
const LIST_ITEM = /^[-*]\s+(.+)$/;
/**
 * Only our own site, so every reader loads the same file and nothing tells us who opened what; only
 * formats every mail client shows (Outlook ignores WebP, Gmail ignores SVG).
 */
const IMAGE = /^!\[([^\]\n]*)\]\((https:\/\/leximon\.fr\/[A-Za-z0-9._~/-]+\.(?:png|jpe?g|gif))\)$/;

/** The width of the paper column inside its border and padding, for clients that need a number. */
const IMAGE_WIDTH = 492;

export function parseBlocks(markdown: string): Block[] {
  const blocks: Block[] = [];
  const chunks = markdown
    .replace(/\r\n?/g, "\n")
    .trim()
    .split(/\n\s*\n/);
  for (const chunk of chunks) {
    const lines = chunk
      .split("\n")
      .map((line) => line.trim())
      .filter((line) => line !== "");
    if (lines.length === 0) continue;
    let paragraph: string[] = [];
    let list: string[] = [];
    const flush = () => {
      if (paragraph.length > 0) blocks.push({ kind: "paragraph", lines: paragraph });
      if (list.length > 0) blocks.push({ kind: "list", items: list });
      paragraph = [];
      list = [];
    };
    for (const line of lines) {
      const image = IMAGE.exec(line);
      if (image?.[1] !== undefined && image[2] !== undefined) {
        flush();
        blocks.push({ kind: "image", alt: image[1].trim(), url: image[2] });
        continue;
      }
      const title = TITLE.exec(line);
      const item = LIST_ITEM.exec(line);
      if (title?.[1] !== undefined) {
        flush();
        blocks.push({ kind: "title", text: title[1] });
      } else if (item?.[1] !== undefined) {
        if (paragraph.length > 0) flush();
        list.push(item[1]);
      } else {
        if (list.length > 0) flush();
        paragraph.push(line);
      }
    }
    flush();
  }
  return blocks;
}

type Inline =
  | { readonly kind: "text"; readonly text: string }
  | { readonly kind: "link"; readonly text: string; readonly url: string }
  | { readonly kind: "bold" | "italic"; readonly children: readonly Inline[] };

const INLINE = /\[([^\]\n]+)\]\((https:\/\/[^\s()<>"]+)\)|\*\*([^*\n]+)\*\*|\*([^*\n]+)\*/g;

export function parseInline(text: string): Inline[] {
  const parts: Inline[] = [];
  let last = 0;
  for (const match of text.matchAll(INLINE)) {
    const index = match.index;
    if (index > last) parts.push({ kind: "text", text: text.slice(last, index) });
    const [, linkText, url, bold, italic] = match;
    if (linkText !== undefined && url !== undefined) {
      parts.push({ kind: "link", text: linkText, url });
    } else if (bold !== undefined) {
      parts.push({ kind: "bold", children: parseInline(bold) });
    } else if (italic !== undefined) {
      parts.push({ kind: "italic", children: parseInline(italic) });
    }
    last = index + match[0].length;
  }
  if (last < text.length) parts.push({ kind: "text", text: text.slice(last) });
  return parts;
}

function inlineHtml(parts: readonly Inline[]): string {
  return parts.map(partHtml).join("");
}

function partHtml(part: Inline): string {
  switch (part.kind) {
    case "text":
      return escapeHtml(part.text);
    case "link":
      return `<a href="${escapeHtml(part.url)}" style="color:${EMAIL_COLORS.ink};text-decoration:underline;">${escapeHtml(part.text)}</a>`;
    case "bold":
      return `<strong>${inlineHtml(part.children)}</strong>`;
    case "italic":
      return `<em>${inlineHtml(part.children)}</em>`;
  }
}

function inlineText(parts: readonly Inline[]): string {
  return parts.map(partText).join("");
}

function partText(part: Inline): string {
  switch (part.kind) {
    case "text":
      return part.text;
    case "link":
      return `${part.text} (${part.url})`;
    case "bold":
    case "italic":
      return inlineText(part.children);
  }
}

export function markdownToHtml(markdown: string): string {
  return parseBlocks(markdown).map(blockHtml).join("\n");
}

function blockHtml(block: Block): string {
  switch (block.kind) {
    case "paragraph":
      return `<p style="margin:0 0 16px;">${block.lines.map((line) => inlineHtml(parseInline(line))).join("<br>")}</p>`;
    case "title":
      return `<h2 style="margin:24px 0 12px;font-size:20px;line-height:1.3;">${inlineHtml(parseInline(block.text))}</h2>`;
    case "list":
      return `<ul style="margin:0 0 16px;padding-left:24px;">${block.items.map((item) => `<li style="margin:0 0 6px;">${inlineHtml(parseInline(item))}</li>`).join("")}</ul>`;
    case "image":
      return `<p style="margin:0 0 16px;"><img src="${escapeHtml(block.url)}" alt="${escapeHtml(block.alt)}" width="${IMAGE_WIDTH}" style="display:block;width:100%;max-width:${IMAGE_WIDTH}px;height:auto;border:0;border-radius:12px;"></p>`;
  }
}

export function markdownToText(markdown: string): string {
  return parseBlocks(markdown)
    .map(blockText)
    .filter((text) => text !== "")
    .join("\n\n");
}

function blockText(block: Block): string {
  switch (block.kind) {
    case "paragraph":
      return block.lines.map((line) => inlineText(parseInline(line))).join("\n");
    case "title":
      return inlineText(parseInline(block.text));
    case "list":
      return block.items.map((item) => `- ${inlineText(parseInline(item))}`).join("\n");
    case "image":
      // The words around an image say what matters: a description in brackets would only be noise.
      return "";
  }
}

/** The first paragraph as plain text, for the line shown after the subject in the inbox. */
export function firstParagraphText(markdown: string, maxLength = 120): string {
  const first = parseBlocks(markdown).find((block) => block.kind === "paragraph");
  if (first === undefined) return "";
  const text = first.lines.map((line) => inlineText(parseInline(line))).join(" ");
  return text.length <= maxLength ? text : `${text.slice(0, maxLength - 1).trimEnd()}…`;
}
