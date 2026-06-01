import "./content.css";
import { extractConversation, type ConversationExport } from "./extractor";
import { conversationToMarkdown, markdownFilename } from "./markdown";
import {
  allMessageIndexes,
  filterConversationMessages,
  messageIndexesForSelection,
  shortMessagePreview
} from "./selection";

const ROOT_ID = "ai-chat-vault";
const CHATGPT_MESSAGE_SELECTOR = "[data-message-author-role]";
const CAPTURE_SETTLE_TIMEOUT_MS = 1500;

interface PanelState {
  conversation: ConversationExport | null;
  markdown: string;
  selectedMessageIndexes: Set<number>;
  title: string;
}

const state: PanelState = {
  conversation: null,
  markdown: "",
  selectedMessageIndexes: new Set(),
  title: "ChatGPT Conversation"
};

init();

function init(): void {
  if (document.getElementById(ROOT_ID)) {
    return;
  }

  const root = document.createElement("aside");
  root.id = ROOT_ID;
  root.innerHTML = `
    <div class="acv-header">
      <strong>AI Chat Vault</strong>
      <span>Local Markdown export</span>
    </div>
    <div class="acv-actions">
      <button type="button" data-acv-action="capture">Capture</button>
      <button type="button" data-acv-action="copy">Copy</button>
      <button type="button" data-acv-action="download">Download</button>
    </div>
    <div class="acv-message-panel" hidden>
      <div class="acv-selection-actions" aria-label="Message selection controls">
        <button type="button" data-acv-action="select-all">Select all</button>
        <button type="button" data-acv-action="select-none">Select none</button>
      </div>
      <div class="acv-message-list" aria-label="Detected messages"></div>
    </div>
    <textarea readonly aria-label="Markdown preview" placeholder="Click Capture to preview this conversation as Markdown."></textarea>
    <div class="acv-status" role="status" aria-live="polite">Ready</div>
  `;

  document.documentElement.append(root);
  root.addEventListener("click", handlePanelClick);
  root.addEventListener("change", handlePanelChange);
}

async function handlePanelClick(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-acv-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.acvAction;
  try {
    if (action === "capture") {
      await capture();
      return;
    }

    if (action === "select-all" || action === "select-none") {
      updateMessageSelection(action === "select-all" ? "all" : "none");
      return;
    }

    if (!state.conversation) {
      await capture();
    }

    if (action === "copy") {
      await copyMarkdown();
      return;
    }

    if (action === "download") {
      downloadMarkdown();
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : "Export failed");
  }
}

function handlePanelChange(event: Event): void {
  const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>(
    "input[data-acv-message-index]"
  );
  if (!checkbox) {
    return;
  }

  const messageIndex = Number(checkbox.dataset.acvMessageIndex);
  if (!Number.isInteger(messageIndex)) {
    return;
  }

  if (checkbox.checked) {
    state.selectedMessageIndexes.add(messageIndex);
  } else {
    state.selectedMessageIndexes.delete(messageIndex);
  }

  updatePreviewFromSelection();
}

async function capture(): Promise<void> {
  setStatus("Capturing conversation...");
  const conversation = await extractConversationAfterPageSettles(captureDocument());
  updateCapturedConversation(conversation);
}

async function extractConversationAfterPageSettles(
  documentRef: Document
): Promise<ConversationExport> {
  const conversation = extractConversation(documentRef);
  if (conversation.messages.length > 0 || !hasChatGptMessageNodes(documentRef)) {
    return conversation;
  }

  await waitForExtractableMessages(documentRef);
  return extractConversation(documentRef);
}

function captureDocument(): Document {
  return document.getElementById(ROOT_ID)?.ownerDocument ?? document;
}

function hasChatGptMessageNodes(documentRef: Document): boolean {
  return documentRef.querySelector(CHATGPT_MESSAGE_SELECTOR) !== null;
}

function waitForExtractableMessages(documentRef: Document): Promise<void> {
  const root = documentRef.body ?? documentRef.documentElement;
  if (!root || typeof MutationObserver === "undefined") {
    return new Promise((resolve) => window.setTimeout(resolve, 0));
  }

  return new Promise((resolve) => {
    let completed = false;
    const finish = (): void => {
      if (completed) {
        return;
      }

      completed = true;
      observer.disconnect();
      window.clearTimeout(timeout);
      resolve();
    };

    const check = (): void => {
      if (extractConversation(documentRef).messages.length > 0) {
        finish();
      }
    };

    const observer = new MutationObserver(check);
    const timeout = window.setTimeout(finish, CAPTURE_SETTLE_TIMEOUT_MS);

    observer.observe(root, {
      attributes: true,
      attributeFilter: ["aria-hidden", "class", "data-message-author-role", "hidden"],
      characterData: true,
      childList: true,
      subtree: true
    });
    queueMicrotask(check);
  });
}

function updateCapturedConversation(conversation: ConversationExport): void {
  state.conversation = conversation;
  state.selectedMessageIndexes = allMessageIndexes(conversation.messages.length);
  state.title = conversation.title;
  state.markdown = conversationToMarkdown(conversation);
  preview().value = state.markdown;
  renderMessageList(conversation.messages);
  setStatus(`Captured ${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"}`);
}

async function copyMarkdown(): Promise<void> {
  const markdown = selectedMarkdown();
  await navigator.clipboard.writeText(markdown);
  setStatus("Copied Markdown to clipboard");
}

function downloadMarkdown(): void {
  const markdown = selectedMarkdown();
  const blob = new Blob([markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = markdownFilename(state.title);
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded Markdown file");
}

function selectedMarkdown(): string {
  const conversation = selectedConversation();
  state.markdown = conversationToMarkdown(conversation);
  preview().value = state.markdown;
  return state.markdown;
}

function selectedConversation(): NonNullable<PanelState["conversation"]> {
  if (!state.conversation) {
    throw new Error("Capture a conversation before exporting");
  }

  if (state.conversation.messages.length === 0) {
    throw new Error("No messages were detected to export");
  }

  const conversation = filterConversationMessages(state.conversation, state.selectedMessageIndexes);
  if (conversation.messages.length === 0) {
    throw new Error("Select at least one message to export");
  }

  return conversation;
}

function updatePreviewFromSelection(): void {
  if (!state.conversation) {
    return;
  }

  const conversation = filterConversationMessages(state.conversation, state.selectedMessageIndexes);
  state.markdown = conversation.messages.length > 0 ? conversationToMarkdown(conversation) : "";
  preview().value = state.markdown;
  setStatus(
    conversation.messages.length > 0
      ? `Selected ${conversation.messages.length} of ${state.conversation.messages.length} messages`
      : "Select at least one message to export"
  );
}

function updateMessageSelection(mode: "all" | "none"): void {
  if (!state.conversation || state.conversation.messages.length === 0) {
    return;
  }

  state.selectedMessageIndexes = messageIndexesForSelection(
    state.conversation.messages.length,
    mode
  );
  syncMessageCheckboxes();
  updatePreviewFromSelection();
}

function renderMessageList(messages: NonNullable<PanelState["conversation"]>["messages"]): void {
  const panel = messagePanel();
  const list = messageList();
  list.textContent = "";
  panel.hidden = messages.length === 0;

  if (messages.length === 0) {
    return;
  }

  messages.forEach((message, index) => {
    const label = document.createElement("label");
    label.className = "acv-message-row";

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedMessageIndexes.has(index);
    checkbox.dataset.acvMessageIndex = String(index);

    const details = document.createElement("span");
    details.className = "acv-message-details";

    const role = document.createElement("strong");
    role.textContent = message.speaker;

    const previewText = document.createElement("span");
    previewText.textContent = shortMessagePreview(message);

    details.append(role, previewText);
    label.append(checkbox, details);
    list.append(label);
  });
}

function syncMessageCheckboxes(): void {
  document
    .querySelectorAll<HTMLInputElement>(`#${ROOT_ID} input[data-acv-message-index]`)
    .forEach((checkbox) => {
      checkbox.checked = state.selectedMessageIndexes.has(Number(checkbox.dataset.acvMessageIndex));
    });
}

function preview(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(`#${ROOT_ID} textarea`);
  if (!textarea) {
    throw new Error("Preview panel is unavailable");
  }
  return textarea;
}

function messagePanel(): HTMLDivElement {
  const panel = document.querySelector<HTMLDivElement>(`#${ROOT_ID} .acv-message-panel`);
  if (!panel) {
    throw new Error("Message selection panel is unavailable");
  }
  return panel;
}

function messageList(): HTMLDivElement {
  const list = document.querySelector<HTMLDivElement>(`#${ROOT_ID} .acv-message-list`);
  if (!list) {
    throw new Error("Message selection panel is unavailable");
  }
  return list;
}

function setStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(`#${ROOT_ID} .acv-status`);
  if (status) {
    status.textContent = message;
  }
}
