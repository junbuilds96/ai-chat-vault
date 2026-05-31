export type Speaker = "user" | "assistant" | "system";

export interface ConversationMessage {
  speaker: Speaker;
  text: string;
}

export interface ConversationExport {
  title: string;
  url: string;
  exportedAt: string;
  messages: ConversationMessage[];
}

const MESSAGE_SELECTOR = [
  "[data-message-author-role]",
  "[data-testid^='conversation-turn-']",
  ".text-base"
].join(",");

const ROLE_LABELS: Record<Speaker, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System"
};

const VISIBLE_CODE_LANGUAGE_LABELS: Record<string, string> = {
  bash: "bash",
  javascript: "javascript",
  js: "javascript",
  json: "json",
  py: "python",
  python: "python",
  shell: "bash",
  sh: "bash",
  ts: "ts",
  tsx: "tsx",
  typescript: "typescript"
};

export function extractConversation(documentRef: Document = document): ConversationExport {
  const messages = collectMessages(documentRef);

  return {
    title: extractTitle(documentRef),
    url: documentRef.location?.href ?? "",
    exportedAt: new Date().toISOString(),
    messages
  };
}

export function collectMessages(documentRef: Document): ConversationMessage[] {
  const seen = new Set<string>();
  const messages: ConversationMessage[] = [];

  for (const element of Array.from(documentRef.querySelectorAll<HTMLElement>(MESSAGE_SELECTOR))) {
    const role = detectSpeaker(element);
    if (!role) {
      continue;
    }

    const text = normalizeMessageText(element);
    if (!text) {
      continue;
    }

    const key = `${role}:${text}`;
    if (seen.has(key)) {
      continue;
    }

    seen.add(key);
    messages.push({ speaker: role, text });
  }

  return messages;
}

export function extractTitle(documentRef: Document): string {
  const pageTitle = documentRef.title
    .replace(/\s*[-|]\s*ChatGPT\s*$/i, "")
    .replace(/^ChatGPT\s*[-|]\s*/i, "")
    .trim();

  if (pageTitle) {
    return pageTitle;
  }

  const heading = documentRef.querySelector<HTMLElement>("main h1, h1");
  const headingText = heading?.innerText?.trim();
  if (headingText) {
    return headingText;
  }

  return "ChatGPT Conversation";
}

export function normalizeMessageText(element: HTMLElement): string {
  const clone = element.cloneNode(true) as HTMLElement;

  clone
    .querySelectorAll(
      "script, style, button, nav, form, textarea, input, select, [aria-hidden='true'], [hidden], .sr-only"
    )
    .forEach((node) => node.remove());

  clone.querySelectorAll("code").forEach((code) => {
    if (code.closest("pre")) {
      return;
    }

    replaceElementWithText(code, markdownInlineCode(elementText(code)));
  });

  clone.querySelectorAll("a[href]").forEach((link) => {
    replaceElementWithText(link, markdownLink(link as HTMLAnchorElement));
  });

  clone.querySelectorAll("pre").forEach((pre) => {
    const text = pre.textContent ?? "";
    const language = detectCodeBlockLanguage(pre as HTMLElement, clone);
    pre.textContent = `\n\n\`\`\`${language}\n${text.trim()}\n\`\`\`\n\n`;
  });

  clone.querySelectorAll("table").forEach((table) => {
    replaceElementWithText(table, `\n\n${markdownTable(table as HTMLTableElement)}\n\n`);
  });

  clone.querySelectorAll("blockquote").forEach((blockquote) => {
    replaceElementWithText(blockquote, `\n\n${markdownQuote(blockquote)}\n\n`);
  });

  clone.querySelectorAll("ol, ul").forEach((list) => {
    removeWhitespaceSibling(list.previousSibling);
    removeWhitespaceSibling(list.nextSibling);
    replaceElementWithText(list, markdownListText(list as HTMLOListElement | HTMLUListElement));
  });

  return (clone.innerText || clone.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function replaceElementWithText(element: Element, text: string): void {
  element.replaceWith(element.ownerDocument.createTextNode(text));
}

function removeWhitespaceSibling(node: ChildNode | null): void {
  if (node?.nodeType === Node.TEXT_NODE && !node.textContent?.trim()) {
    node.remove();
  }
}

function markdownLink(link: HTMLAnchorElement): string {
  const text = normalizeInlineText(elementText(link));
  const href = link.getAttribute("href")?.trim() ?? "";

  if (!text || !href || text === href) {
    return text || href;
  }

  return `[${escapeMarkdownLinkText(text)}](${href})`;
}

function markdownQuote(blockquote: Element): string {
  const text = normalizeBlockText(elementText(blockquote));
  if (!text) {
    return "";
  }

  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

function markdownTable(table: HTMLTableElement): string {
  const rows = Array.from(table.querySelectorAll("tr"))
    .map((row) =>
      Array.from(row.querySelectorAll("th, td")).map((cell) =>
        escapeMarkdownTableCell(normalizeInlineText(elementText(cell)))
      )
    )
    .filter((cells) => cells.length > 0);

  if (rows.length === 0) {
    return "";
  }

  const columnCount = Math.max(...rows.map((cells) => cells.length));
  const normalizedRows = rows.map((cells) => padCells(cells, columnCount));
  const header = normalizedRows[0];
  const separator = Array.from({ length: columnCount }, () => "---");
  const body = normalizedRows.slice(1);

  return [header, separator, ...body].map(markdownTableRow).join("\n");
}

function markdownList(list: HTMLOListElement | HTMLUListElement): string {
  const ordered = list.tagName.toLowerCase() === "ol";

  return Array.from(list.children)
    .filter((item): item is HTMLLIElement => item.tagName.toLowerCase() === "li")
    .map((item, index) => {
      const marker = ordered ? `${index + 1}.` : "-";
      return `${marker} ${normalizeInlineText(elementText(item))}`;
    })
    .join("\n");
}

function markdownListText(list: HTMLOListElement | HTMLUListElement): string {
  const previousText = list.previousSibling?.textContent ?? "";
  const nextText = list.nextSibling?.textContent ?? "";
  const prefix = previousText.trim() && !previousText.endsWith("\n") ? "\n" : "";
  const suffix = nextText.trim() && !nextText.startsWith("\n") ? "\n" : "";

  return `${prefix}${markdownList(list)}${suffix}`;
}

function markdownInlineCode(value: string): string {
  const text = normalizeInlineText(value);
  const longestBacktickRun = Math.max(
    0,
    ...Array.from(text.matchAll(/`+/g), (match) => match[0].length)
  );
  const delimiter = "`".repeat(longestBacktickRun + 1);
  const padding = text.startsWith("`") || text.endsWith("`") ? " " : "";

  return `${delimiter}${padding}${text}${padding}${delimiter}`;
}

function padCells(cells: string[], columnCount: number): string[] {
  return [...cells, ...Array.from({ length: columnCount - cells.length }, () => "")];
}

function markdownTableRow(cells: string[]): string {
  return `| ${cells.join(" | ")} |`;
}

function escapeMarkdownTableCell(value: string): string {
  return value.replace(/\|/g, "\\|");
}

function escapeMarkdownLinkText(value: string): string {
  return value.replace(/([\[\]])/g, "\\$1");
}

function normalizeInlineText(value: string): string {
  return value.replace(/\u00a0/g, " ").replace(/\s+/g, " ").trim();
}

function normalizeBlockText(value: string): string {
  return value
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function elementText(element: Element): string {
  return (element as HTMLElement).innerText || element.textContent || "";
}

function detectCodeBlockLanguage(pre: HTMLElement, root: HTMLElement): string {
  const code = pre.querySelector<HTMLElement>("code");

  for (const element of [code, pre]) {
    if (!element) {
      continue;
    }

    const language = codeLanguageFromAttributes(element) || codeLanguageFromClasses(element);
    if (language) {
      return language;
    }
  }

  const nearbyLabel = nearbyCodeLanguageLabel(pre, root);
  if (nearbyLabel) {
    nearbyLabel.element.remove();
    return nearbyLabel.language;
  }

  return "";
}

function codeLanguageFromAttributes(element: HTMLElement): string {
  for (const attribute of ["data-language", "data-lang"]) {
    const language = normalizeExplicitCodeLanguage(element.getAttribute(attribute));
    if (language) {
      return language;
    }
  }

  return "";
}

function codeLanguageFromClasses(element: HTMLElement): string {
  for (const className of Array.from(element.classList)) {
    const match = className.match(/^(?:language|lang)-(.+)$/i);
    const language = normalizeExplicitCodeLanguage(match?.[1] ?? "");
    if (language) {
      return language;
    }
  }

  return "";
}

function nearbyCodeLanguageLabel(
  pre: HTMLElement,
  root: HTMLElement
): { language: string; element: HTMLElement } | null {
  for (const element of nearbyCodeLabelElements(pre, root)) {
    const language = normalizeVisibleCodeLanguage(elementText(element));
    if (language) {
      return { language, element };
    }
  }

  return null;
}

function nearbyCodeLabelElements(pre: HTMLElement, root: HTMLElement): HTMLElement[] {
  const elements: HTMLElement[] = [];
  let current: HTMLElement | null = pre;

  while (current && current !== root) {
    const previous = current.previousElementSibling;
    if (previous instanceof HTMLElement && !previous.querySelector("pre")) {
      elements.push(previous);
    }

    current = current.parentElement;
  }

  return elements;
}

function normalizeExplicitCodeLanguage(value: string | null | undefined): string {
  const normalized = normalizeLanguageValue(value);
  if (!normalized) {
    return "";
  }

  return VISIBLE_CODE_LANGUAGE_LABELS[normalized] ?? normalized;
}

function normalizeVisibleCodeLanguage(value: string): string {
  const normalized = normalizeLanguageValue(value);
  return normalized ? VISIBLE_CODE_LANGUAGE_LABELS[normalized] ?? "" : "";
}

function normalizeLanguageValue(value: string | null | undefined): string {
  return (value ?? "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, "")
    .replace(/[^a-z0-9_+.#-]/g, "");
}

function detectSpeaker(element: HTMLElement): Speaker | null {
  const explicitRole = element.getAttribute("data-message-author-role")?.toLowerCase();
  if (isSpeaker(explicitRole)) {
    return explicitRole;
  }

  const labelledBy = element.getAttribute("aria-label") ?? "";
  const ancestor = element.closest<HTMLElement>("[data-message-author-role]");
  const ancestorRole = ancestor?.getAttribute("data-message-author-role")?.toLowerCase();
  if (isSpeaker(ancestorRole)) {
    return ancestorRole;
  }

  const testId = element.getAttribute("data-testid") ?? "";
  const combined = `${labelledBy} ${testId} ${element.className}`.toLowerCase();

  if (combined.includes("user")) {
    return "user";
  }
  if (combined.includes("assistant") || combined.includes("chatgpt")) {
    return "assistant";
  }

  const text = element.textContent?.trim() ?? "";
  for (const [speaker, label] of Object.entries(ROLE_LABELS) as Array<[Speaker, string]>) {
    if (text.toLowerCase().startsWith(`${label.toLowerCase()}:`)) {
      return speaker;
    }
  }

  return null;
}

function isSpeaker(value: string | null | undefined): value is Speaker {
  return value === "user" || value === "assistant" || value === "system";
}
