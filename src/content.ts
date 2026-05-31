import "./content.css";
import { extractConversation } from "./extractor";
import { conversationToMarkdown, markdownFilename } from "./markdown";

const ROOT_ID = "ai-chat-vault";

interface PanelState {
  markdown: string;
  title: string;
}

const state: PanelState = {
  markdown: "",
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
    <textarea readonly aria-label="Markdown preview" placeholder="Click Capture to preview this conversation as Markdown."></textarea>
    <div class="acv-status" role="status" aria-live="polite">Ready</div>
  `;

  document.documentElement.append(root);
  root.addEventListener("click", handlePanelClick);
}

async function handlePanelClick(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-acv-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.acvAction;
  try {
    if (action === "capture") {
      capture();
      return;
    }

    if (!state.markdown) {
      capture();
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

function capture(): void {
  const conversation = extractConversation(document);
  state.title = conversation.title;
  state.markdown = conversationToMarkdown(conversation);
  preview().value = state.markdown;
  setStatus(`Captured ${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"}`);
}

async function copyMarkdown(): Promise<void> {
  await navigator.clipboard.writeText(state.markdown);
  setStatus("Copied Markdown to clipboard");
}

function downloadMarkdown(): void {
  const blob = new Blob([state.markdown], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = markdownFilename(state.title);
  anchor.click();
  URL.revokeObjectURL(url);
  setStatus("Downloaded Markdown file");
}

function preview(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(`#${ROOT_ID} textarea`);
  if (!textarea) {
    throw new Error("Preview panel is unavailable");
  }
  return textarea;
}

function setStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(`#${ROOT_ID} .acv-status`);
  if (status) {
    status.textContent = message;
  }
}
