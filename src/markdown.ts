import type { ConversationExport, Speaker } from "./extractor";

const SPEAKER_LABELS: Record<Speaker, string> = {
  user: "User",
  assistant: "Assistant",
  system: "System"
};

export function conversationToMarkdown(conversation: ConversationExport): string {
  const title = escapeMarkdownHeading(conversation.title || "ChatGPT Conversation");
  const body = conversation.messages
    .map((message) => `## ${SPEAKER_LABELS[message.speaker]}\n\n${message.text.trim()}`)
    .join("\n\n");

  return [
    `# ${title}`,
    "",
    `- Source: ${conversation.url || "Unknown"}`,
    `- Exported: ${conversation.exportedAt}`,
    "",
    body || "_No conversation messages were detected._",
    ""
  ].join("\n");
}

export function markdownFilename(title: string, date = new Date()): string {
  const stamp = date.toISOString().slice(0, 10);
  const slug = title
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[<>:"/\\|?*\u0000-\u001f]+/g, "-")
    .replace(/[^\p{L}\p{M}\p{N}]+/gu, "-")
    .replace(/^[-.\s]+|[-.\s]+$/g, "")
    .slice(0, 80)
    .replace(/^[-.\s]+|[-.\s]+$/g, "");

  return `${slug || "chatgpt-conversation"}-${stamp}.md`;
}

function escapeMarkdownHeading(value: string): string {
  return value.replace(/^[#\s]+/, "").trim() || "ChatGPT Conversation";
}
