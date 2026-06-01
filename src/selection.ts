import type { ConversationExport, ConversationMessage } from "./extractor";

const DEFAULT_PREVIEW_LENGTH = 84;

export type MessageSelectionMode = "all" | "none";

export function allMessageIndexes(messageCount: number): Set<number> {
  return new Set(Array.from({ length: messageCount }, (_, index) => index));
}

export function messageIndexesForSelection(
  messageCount: number,
  mode: MessageSelectionMode
): Set<number> {
  return mode === "all" ? allMessageIndexes(messageCount) : new Set();
}

export function filterConversationMessages(
  conversation: ConversationExport,
  selectedIndexes: Iterable<number>
): ConversationExport {
  const selected = new Set(selectedIndexes);

  return {
    ...conversation,
    messages: conversation.messages.filter((_, index) => selected.has(index))
  };
}

export function shortMessagePreview(
  message: ConversationMessage,
  maxLength = DEFAULT_PREVIEW_LENGTH
): string {
  const preview = message.text.replace(/\s+/g, " ").trim();

  if (preview.length <= maxLength) {
    return preview;
  }

  const truncated = preview.slice(0, Math.max(0, maxLength - 3)).trimEnd();
  const lastSpace = truncated.lastIndexOf(" ");
  const previewText = lastSpace > 0 ? truncated.slice(0, lastSpace) : truncated;

  return `${previewText}...`;
}
