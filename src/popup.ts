import "./popup.css";
import type { ConversationExport } from "./extractor";
import { conversationToMarkdown, markdownFilename } from "./markdown";
import {
  allMessageIndexes,
  filterConversationMessages,
  messageIndexesForSelection,
  shortMessagePreview
} from "./selection";
import {
  CAPTURE_REQUEST_TYPE,
  CAPTURE_RESPONSE_TYPE,
  type CaptureResponse,
  isSupportedChatGptHost
} from "./messages";

interface PopupState {
  conversation: ConversationExport | null;
  selectedMessageIndexes: Set<number>;
  markdown: string;
  title: string;
}

const state: PopupState = {
  conversation: null,
  selectedMessageIndexes: new Set(),
  markdown: "",
  title: "ChatGPT Conversation"
};

initPopup();

function initPopup(): void {
  const root = document.querySelector<HTMLDivElement>("#root");
  if (!root) {
    return;
  }

  root.innerHTML = `
    <main class="acv-popup" aria-label="AI Chat Vault popup">
      <header class="acv-header">
        <div>
          <strong>AI Chat Vault</strong>
          <span>Local Markdown export</span>
        </div>
      </header>
      <section class="acv-actions" aria-label="Export actions">
        <button type="button" data-acv-action="capture">Capture</button>
        <button type="button" data-acv-action="copy">Copy</button>
        <button type="button" data-acv-action="download">Download</button>
      </section>
      <section class="acv-message-panel" hidden>
        <div class="acv-selection-actions" aria-label="Message selection controls">
          <button type="button" data-acv-action="select-all">Select all</button>
          <button type="button" data-acv-action="select-none">Select none</button>
        </div>
        <div class="acv-message-list" aria-label="Detected messages"></div>
      </section>
      <textarea readonly aria-label="Markdown preview" placeholder="Open a ChatGPT conversation, click the extension icon, then Capture."></textarea>
      <div class="acv-status" role="status" aria-live="polite">Ready</div>
    </main>
  `;

  root.addEventListener("click", handlePopupClick);
  root.addEventListener("change", handlePopupChange);
}

async function handlePopupClick(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-acv-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.acvAction;
  try {
    if (action === "capture") {
      await captureFromActiveTab();
      return;
    }

    if (action === "select-all" || action === "select-none") {
      updateMessageSelection(action === "select-all" ? "all" : "none");
      return;
    }

    if (!state.conversation) {
      await captureFromActiveTab();
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

function handlePopupChange(event: Event): void {
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

async function captureFromActiveTab(): Promise<void> {
  setStatus("Capturing active ChatGPT tab...");
  const tab = await activeTab();
  if (!tab.id) {
    throw new Error("No active browser tab was found");
  }

  const url = new URL(tab.url ?? "about:blank");
  if (!isSupportedChatGptHost(url.hostname)) {
    throw new Error("Open a ChatGPT tab before capturing");
  }

  const response = await sendCaptureMessage(tab.id);
  if (response.type !== CAPTURE_RESPONSE_TYPE) {
    throw new Error("Unexpected capture response");
  }

  if ("error" in response && response.error) {
    throw new Error(response.error);
  }

  updateCapturedConversation(response.conversation);
}

function activeTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(captureMessageError(lastError.message)));
        return;
      }

      const tab = tabs[0];
      if (!tab) {
        reject(new Error("No active browser tab was found"));
        return;
      }

      resolve(tab);
    });
  });
}

function sendCaptureMessage(tabId: number): Promise<CaptureResponse & { error?: string }> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: CAPTURE_REQUEST_TYPE }, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(captureMessageError(lastError.message)));
        return;
      }

      if (!response) {
        reject(new Error(reloadChatGptTabMessage()));
        return;
      }

      resolve(response as CaptureResponse & { error?: string });
    });
  });
}

function captureMessageError(message?: string): string {
  if (
    message?.includes("Receiving end does not exist") ||
    message?.includes("Could not establish connection")
  ) {
    return reloadChatGptTabMessage();
  }

  return message ?? "Capture failed";
}

function reloadChatGptTabMessage(): string {
  return "Reload the ChatGPT tab after installing or updating AI Chat Vault, then try Capture again.";
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

function selectedConversation(): ConversationExport {
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

function renderMessageList(messages: ConversationExport["messages"]): void {
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
    .querySelectorAll<HTMLInputElement>("input[data-acv-message-index]")
    .forEach((checkbox) => {
      checkbox.checked = state.selectedMessageIndexes.has(Number(checkbox.dataset.acvMessageIndex));
    });
}

function preview(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Markdown preview']");
  if (!textarea) {
    throw new Error("Preview panel is unavailable");
  }
  return textarea;
}

function messagePanel(): HTMLDivElement {
  const panel = document.querySelector<HTMLDivElement>(".acv-message-panel");
  if (!panel) {
    throw new Error("Message selection panel is unavailable");
  }
  return panel;
}

function messageList(): HTMLDivElement {
  const list = document.querySelector<HTMLDivElement>(".acv-message-list");
  if (!list) {
    throw new Error("Message selection panel is unavailable");
  }
  return list;
}

function setStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(".acv-status");
  if (status) {
    status.textContent = message;
  }
}
