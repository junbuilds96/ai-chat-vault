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
    .querySelectorAll("script, style, button, nav, form, textarea, input, select, [aria-hidden='true']")
    .forEach((node) => node.remove());

  clone.querySelectorAll("pre").forEach((pre) => {
    const text = pre.textContent ?? "";
    pre.textContent = `\n\n\`\`\`\n${text.trim()}\n\`\`\`\n\n`;
  });

  clone.querySelectorAll("li").forEach((li) => {
    if (!li.textContent?.trim().startsWith("-")) {
      li.prepend("- ");
    }
  });

  return (clone.innerText || clone.textContent || "")
    .replace(/\u00a0/g, " ")
    .replace(/[ \t]+\n/g, "\n")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
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
