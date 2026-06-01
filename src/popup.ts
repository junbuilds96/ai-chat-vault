import "./popup.css";
import {
  deleteConversationBookmark,
  loadConversationBookmarks,
  upsertConversationBookmark,
  type ConversationBookmark
} from "./bookmarks";
import type { ConversationExport, Speaker } from "./extractor";
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
  INSERT_PROMPT_REQUEST_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE,
  type CaptureResponse,
  type InsertPromptResponse,
  isSupportedChatGptHost
} from "./messages";
import { conversationNoteIdentity, loadConversationNote, saveConversationNote } from "./notes";
import {
  loadPromptSnippets,
  savePromptSnippets,
  type PromptSnippet
} from "./prompts";

type MessageNavigatorRole = "all" | Speaker;

interface PopupState {
  conversation: ConversationExport | null;
  selectedMessageIndexes: Set<number>;
  markdown: string;
  title: string;
  snippets: PromptSnippet[];
  selectedSnippetId: string;
  navigatorQuery: string;
  navigatorRole: MessageNavigatorRole;
  focusedMessageIndex: number | null;
  conversationNote: string;
  conversationNoteIdentity: string;
  bookmarks: ConversationBookmark[];
}

const state: PopupState = {
  conversation: null,
  selectedMessageIndexes: new Set(),
  markdown: "",
  title: "ChatGPT Conversation",
  snippets: [],
  selectedSnippetId: "",
  navigatorQuery: "",
  navigatorRole: "all",
  focusedMessageIndex: null,
  conversationNote: "",
  conversationNoteIdentity: "",
  bookmarks: []
};

const NAVIGATOR_ROLES: MessageNavigatorRole[] = ["all", "user", "assistant", "system"];
const NAVIGATOR_ROLE_LABELS: Record<MessageNavigatorRole, string> = {
  all: "All roles",
  user: "User",
  assistant: "Assistant",
  system: "System"
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
      <section class="acv-prompt-library" aria-label="Prompt Library">
        <div class="acv-section-heading">
          <strong>Prompt Library</strong>
          <span>Local snippets</span>
        </div>
        <select aria-label="Prompt snippet" data-acv-prompt-select></select>
        <input type="text" aria-label="Prompt slash command" data-acv-prompt-title placeholder="/shortcut" />
        <textarea aria-label="Prompt body" data-acv-prompt-body data-acv-prompt-preview placeholder="Prompt body"></textarea>
        <div class="acv-prompt-edit-actions">
          <button type="button" data-acv-action="new-prompt">New</button>
          <button type="button" data-acv-action="save-prompt">Save</button>
          <button type="button" data-acv-action="delete-prompt">Delete</button>
        </div>
        <div class="acv-prompt-actions">
          <button type="button" data-acv-action="copy-prompt">Copy prompt</button>
          <button type="button" data-acv-action="insert-prompt">Insert into ChatGPT</button>
        </div>
      </section>
      <section class="acv-conversation-notes" aria-label="Conversation Notes" hidden>
        <div class="acv-section-heading">
          <strong>Conversation Notes</strong>
          <span data-acv-notes-context>Private local note</span>
        </div>
        <textarea aria-label="Conversation note" data-acv-conversation-note placeholder="Private notes for this conversation"></textarea>
      </section>
      <section class="acv-conversation-bookmarks" aria-label="Conversation Bookmarks" hidden>
        <div class="acv-section-heading">
          <strong>Conversation Bookmarks</strong>
          <span data-acv-bookmarks-context>Local saved links</span>
        </div>
        <button type="button" data-acv-action="save-bookmark">Save bookmark</button>
        <div class="acv-bookmark-list" aria-label="Saved conversation bookmarks"></div>
      </section>
      <section class="acv-message-panel" hidden>
        <section class="acv-message-navigator" aria-label="Message Navigator">
          <div class="acv-section-heading">
            <strong>Message Navigator</strong>
            <span data-acv-navigator-count>0 of 0 turns</span>
          </div>
          <div class="acv-navigator-filters">
            <input type="search" aria-label="Search captured messages" data-acv-message-search placeholder="Search role or text" />
            <select aria-label="Filter messages by role" data-acv-role-filter></select>
          </div>
          <div class="acv-navigator-results" aria-label="Message Navigator results"></div>
        </section>
        <div class="acv-selection-actions" aria-label="Message selection controls">
          <button type="button" data-acv-action="select-all">Select all</button>
          <button type="button" data-acv-action="select-none">Select none</button>
        </div>
        <div class="acv-message-list" aria-label="Detected messages"></div>
      </section>
      <textarea readonly aria-label="Markdown preview" class="acv-markdown-preview" placeholder="Open a ChatGPT conversation, click the extension icon, then Capture."></textarea>
      <div class="acv-status" role="status" aria-live="polite">Ready</div>
    </main>
  `;

  root.addEventListener("click", handlePopupClick);
  root.addEventListener("input", handlePopupInput);
  root.addEventListener("change", handlePopupChange);
  void loadPromptLibrary();
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

    if (action === "copy-prompt") {
      await copySelectedPrompt();
      return;
    }

    if (action === "new-prompt") {
      createPromptSnippet();
      return;
    }

    if (action === "save-prompt") {
      await saveCurrentPromptSnippet();
      return;
    }

    if (action === "delete-prompt") {
      await deleteCurrentPromptSnippet();
      return;
    }

    if (action === "save-bookmark") {
      await saveCurrentConversationBookmark();
      return;
    }

    if (action === "copy-bookmark") {
      await copyConversationBookmark(button.dataset.acvBookmarkId ?? "");
      return;
    }

    if (action === "delete-bookmark") {
      await deleteCurrentConversationBookmark(button.dataset.acvBookmarkId ?? "");
      return;
    }

    if (action === "insert-prompt") {
      await insertSelectedPromptIntoChatGpt();
      return;
    }

    if (action === "focus-message") {
      const messageIndex = Number(button.dataset.acvFocusMessageIndex);
      if (Number.isInteger(messageIndex)) {
        focusMessage(messageIndex);
      }
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

function handlePopupInput(event: Event): void {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>(
    "input[data-acv-message-search]"
  );
  if (input) {
    state.navigatorQuery = input.value;
    renderMessageNavigator();
    return;
  }

  const promptTitle = (event.target as HTMLElement).closest<HTMLInputElement>(
    "input[data-acv-prompt-title]"
  );
  if (promptTitle) {
    updateSelectedPromptSnippet({ title: promptTitle.value });
    setStatus("Unsaved prompt changes");
    return;
  }

  const promptBody = (event.target as HTMLElement).closest<HTMLTextAreaElement>(
    "textarea[data-acv-prompt-body]"
  );
  if (promptBody) {
    updateSelectedPromptSnippet({ body: promptBody.value });
    setStatus("Unsaved prompt changes");
    return;
  }

  const note = (event.target as HTMLElement).closest<HTMLTextAreaElement>(
    "textarea[data-acv-conversation-note]"
  );
  if (!note) {
    return;
  }

  state.conversationNote = note.value;
  void saveCurrentConversationNote();
}

function handlePopupChange(event: Event): void {
  const select = (event.target as HTMLElement).closest<HTMLSelectElement>(
    "select[data-acv-prompt-select]"
  );
  if (select) {
    state.selectedSnippetId = select.value;
    renderPromptEditor();
    return;
  }

  const roleFilter = (event.target as HTMLElement).closest<HTMLSelectElement>(
    "select[data-acv-role-filter]"
  );
  if (roleFilter) {
    state.navigatorRole = navigatorRoleFromValue(roleFilter.value);
    renderMessageNavigator();
    return;
  }

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

async function loadPromptLibrary(): Promise<void> {
  state.snippets = await loadPromptSnippets();
  state.selectedSnippetId = state.snippets[0]?.id ?? "";
  renderPromptLibrary();
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

  await updateCapturedConversation(response.conversation);
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

function sendInsertPromptMessage(
  tabId: number,
  prompt: string
): Promise<InsertPromptResponse & { error?: string }> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: INSERT_PROMPT_REQUEST_TYPE, prompt },
      (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(messageBridgeError(lastError.message, "inserting", "Prompt insertion failed")));
          return;
        }

        if (!response) {
          reject(new Error(reloadChatGptTabMessage("inserting")));
          return;
        }

        resolve(response as InsertPromptResponse & { error?: string });
      }
    );
  });
}

function captureMessageError(message?: string): string {
  return messageBridgeError(message, "Capture", "Capture failed");
}

function messageBridgeError(
  message: string | undefined,
  retryAction: string,
  fallback: string
): string {
  if (
    message?.includes("Receiving end does not exist") ||
    message?.includes("Could not establish connection")
  ) {
    return reloadChatGptTabMessage(retryAction);
  }

  return message ?? fallback;
}

function reloadChatGptTabMessage(retryAction = "Capture"): string {
  return `Reload the ChatGPT tab after installing or updating AI Chat Vault, then try ${retryAction} again.`;
}

async function updateCapturedConversation(conversation: ConversationExport): Promise<void> {
  state.conversation = conversation;
  state.selectedMessageIndexes = allMessageIndexes(conversation.messages.length);
  state.title = conversation.title;
  state.markdown = conversationToMarkdown(conversation);
  state.navigatorQuery = "";
  state.navigatorRole = "all";
  state.focusedMessageIndex = null;
  state.conversationNoteIdentity = conversationNoteIdentity(conversation);
  const [conversationNote, bookmarks] = await Promise.all([
    loadConversationNote(conversation),
    loadConversationBookmarks()
  ]);
  state.conversationNote = conversationNote;
  state.bookmarks = bookmarks;
  preview().value = state.markdown;
  renderConversationNotes();
  renderConversationBookmarks();
  renderMessageList(conversation.messages);
  renderMessageNavigator();
  setStatus(`Captured ${conversation.messages.length} message${conversation.messages.length === 1 ? "" : "s"}`);
}

async function copyMarkdown(): Promise<void> {
  const markdown = selectedMarkdown();
  await navigator.clipboard.writeText(markdown);
  setStatus("Copied Markdown to clipboard");
}

async function copySelectedPrompt(): Promise<void> {
  const prompt = selectedPromptBody();
  await navigator.clipboard.writeText(prompt);
  setStatus("Copied prompt to clipboard");
}

async function insertSelectedPromptIntoChatGpt(): Promise<void> {
  const prompt = selectedPromptBody();
  const tab = await activeTab();
  if (!tab.id) {
    throw new Error("No active browser tab was found");
  }

  const url = new URL(tab.url ?? "about:blank");
  if (!isSupportedChatGptHost(url.hostname)) {
    throw new Error("Open a ChatGPT tab before inserting a prompt");
  }

  const response = await sendInsertPromptMessage(tab.id, prompt);
  if (response.type !== INSERT_PROMPT_RESPONSE_TYPE) {
    throw new Error("Unexpected prompt insertion response");
  }

  if ("error" in response && response.error) {
    throw new Error(response.error);
  }

  if (!response.inserted) {
    throw new Error("ChatGPT composer was not found");
  }

  setStatus("Inserted prompt into ChatGPT");
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
    label.dataset.acvMessageRowIndex = String(index);
    label.tabIndex = -1;

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

  syncFocusedMessage();
}

function syncMessageCheckboxes(): void {
  document
    .querySelectorAll<HTMLInputElement>("input[data-acv-message-index]")
    .forEach((checkbox) => {
      checkbox.checked = state.selectedMessageIndexes.has(Number(checkbox.dataset.acvMessageIndex));
    });
}

function renderMessageNavigator(): void {
  const conversation = state.conversation;
  const count = navigatorCount();
  const results = navigatorResults();
  const search = navigatorSearch();
  const roleFilter = navigatorRoleFilter();

  search.value = state.navigatorQuery;
  renderNavigatorRoleOptions(roleFilter);
  results.textContent = "";

  if (!conversation) {
    count.textContent = "0 of 0 turns";
    return;
  }

  const resultIndexes = filteredNavigatorMessageIndexes(conversation);
  count.textContent = `${resultIndexes.length} of ${conversation.messages.length} turns`;

  if (resultIndexes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "acv-navigator-empty";
    empty.textContent = "No matching turns";
    results.append(empty);
    syncFocusedMessage();
    return;
  }

  resultIndexes.forEach((messageIndex) => {
    const message = conversation.messages[messageIndex];
    const result = document.createElement("button");
    result.type = "button";
    result.className = "acv-navigator-result";
    result.dataset.acvAction = "focus-message";
    result.dataset.acvFocusMessageIndex = String(messageIndex);

    const title = document.createElement("strong");
    title.textContent = `${messageIndex + 1}. ${NAVIGATOR_ROLE_LABELS[message.speaker]}`;

    const previewText = document.createElement("span");
    previewText.textContent = shortMessagePreview(message, 72);

    result.append(title, previewText);
    results.append(result);
  });

  syncFocusedMessage();
}

function renderNavigatorRoleOptions(select: HTMLSelectElement): void {
  if (!state.conversation) {
    select.textContent = "";
    return;
  }

  const counts = messageCountsByRole(state.conversation);
  select.textContent = "";

  NAVIGATOR_ROLES.forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = `${NAVIGATOR_ROLE_LABELS[role]} (${counts[role]})`;
    select.append(option);
  });

  select.value = state.navigatorRole;
}

function filteredNavigatorMessageIndexes(conversation: ConversationExport): number[] {
  const query = normalizeNavigatorQuery(state.navigatorQuery);
  const role = state.navigatorRole;

  return conversation.messages.flatMap((message, index) => {
    if (role !== "all" && message.speaker !== role) {
      return [];
    }

    const searchableText = `${message.speaker} ${message.text}`.toLowerCase();
    if (query && !searchableText.includes(query)) {
      return [];
    }

    return [index];
  });
}

function messageCountsByRole(conversation: ConversationExport): Record<MessageNavigatorRole, number> {
  const counts: Record<MessageNavigatorRole, number> = {
    all: conversation.messages.length,
    user: 0,
    assistant: 0,
    system: 0
  };

  conversation.messages.forEach((message) => {
    counts[message.speaker] += 1;
  });

  return counts;
}

function focusMessage(messageIndex: number): void {
  if (!state.conversation || messageIndex < 0 || messageIndex >= state.conversation.messages.length) {
    return;
  }

  state.focusedMessageIndex = messageIndex;
  syncFocusedMessage();

  const row = messageRow(messageIndex);
  if (typeof row?.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest" });
  }
  row?.focus({ preventScroll: true });
  setStatus(`Focused message ${messageIndex + 1} of ${state.conversation.messages.length}`);
}

function renderConversationNotes(): void {
  const section = conversationNotesSection();
  const note = conversationNoteInput();
  const context = conversationNoteContext();

  section.hidden = !state.conversation;
  note.value = state.conversationNote;
  context.textContent = state.conversation
    ? shortConversationContext(state.conversation)
    : "Private local note";

  if (state.conversation) {
    section.dataset.acvNotesIdentity = state.conversationNoteIdentity;
    note.title = state.conversation.url || state.conversation.title;
  } else {
    delete section.dataset.acvNotesIdentity;
    note.removeAttribute("title");
  }
}

async function saveCurrentConversationNote(): Promise<void> {
  const conversation = state.conversation;
  const note = state.conversationNote;
  if (!conversation) {
    return;
  }

  try {
    await saveConversationNote(conversation, note);
    setStatus("Saved conversation note locally");
  } catch {
    setStatus("Could not save conversation note");
  }
}

async function saveCurrentConversationBookmark(): Promise<void> {
  const conversation = state.conversation;
  if (!conversation) {
    throw new Error("Capture a conversation before saving a bookmark");
  }

  state.bookmarks = await upsertConversationBookmark({
    id: state.conversationNoteIdentity,
    title: conversation.title || "ChatGPT Conversation",
    url: conversation.url,
    savedAt: new Date().toISOString()
  });
  renderConversationBookmarks();
  setStatus("Saved conversation bookmark locally");
}

async function copyConversationBookmark(id: string): Promise<void> {
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) {
    throw new Error("Conversation bookmark was not found");
  }

  await navigator.clipboard.writeText(bookmark.url);
  setStatus("Copied bookmark link to clipboard");
}

async function deleteCurrentConversationBookmark(id: string): Promise<void> {
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) {
    throw new Error("Conversation bookmark was not found");
  }

  state.bookmarks = await deleteConversationBookmark(bookmark.id);
  renderConversationBookmarks();
  setStatus("Deleted conversation bookmark");
}

function renderConversationBookmarks(): void {
  const section = conversationBookmarksSection();
  const context = conversationBookmarksContext();
  const list = conversationBookmarkList();

  section.hidden = !state.conversation;
  context.textContent =
    state.bookmarks.length === 1
      ? "1 saved link"
      : `${state.bookmarks.length} saved links`;
  list.textContent = "";

  if (!state.conversation) {
    return;
  }

  if (state.bookmarks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "acv-bookmark-empty";
    empty.textContent = "No saved bookmarks";
    list.append(empty);
    return;
  }

  state.bookmarks.forEach((bookmark) => {
    const row = document.createElement("div");
    row.className = "acv-bookmark-row";
    row.dataset.acvBookmarkId = bookmark.id;

    const details = document.createElement("div");
    details.className = "acv-bookmark-details";

    const title = document.createElement("strong");
    title.textContent = bookmark.title;

    const url = document.createElement("span");
    url.textContent = bookmark.url;

    const actions = document.createElement("div");
    actions.className = "acv-bookmark-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.dataset.acvAction = "copy-bookmark";
    copyButton.dataset.acvBookmarkId = bookmark.id;
    copyButton.textContent = "Copy link";

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.acvAction = "delete-bookmark";
    deleteButton.dataset.acvBookmarkId = bookmark.id;
    deleteButton.textContent = "Delete";

    details.append(title, url);
    actions.append(copyButton, deleteButton);
    row.append(details, actions);
    list.append(row);
  });
}

function shortConversationContext(conversation: ConversationExport): string {
  const label = conversation.title.trim() || conversation.url.trim() || "Current conversation";
  return label.length > 38 ? `${label.slice(0, 35)}...` : label;
}

function syncFocusedMessage(): void {
  document
    .querySelectorAll<HTMLElement>("[data-acv-message-row-index]")
    .forEach((row) => {
      const isFocused = Number(row.dataset.acvMessageRowIndex) === state.focusedMessageIndex;
      row.classList.toggle("is-focused", isFocused);
      if (isFocused) {
        row.setAttribute("aria-current", "true");
      } else {
        row.removeAttribute("aria-current");
      }
    });

  document
    .querySelectorAll<HTMLButtonElement>("button[data-acv-focus-message-index]")
    .forEach((button) => {
      button.classList.toggle(
        "is-focused",
        Number(button.dataset.acvFocusMessageIndex) === state.focusedMessageIndex
      );
    });
}

function normalizeNavigatorQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function navigatorRoleFromValue(value: string): MessageNavigatorRole {
  return NAVIGATOR_ROLES.includes(value as MessageNavigatorRole)
    ? (value as MessageNavigatorRole)
    : "all";
}

function renderPromptLibrary(): void {
  const select = promptSelect();
  select.textContent = "";

  if (!state.snippets.some((snippet) => snippet.id === state.selectedSnippetId)) {
    state.selectedSnippetId = state.snippets[0]?.id ?? "";
  }

  state.snippets.forEach((snippet) => {
    const option = document.createElement("option");
    option.value = snippet.id;
    option.textContent = snippet.title;
    select.append(option);
  });

  select.value = state.selectedSnippetId;
  renderPromptEditor();
}

function renderPromptEditor(): void {
  const snippet = selectedPromptSnippet();
  promptTitleInput().value = snippet?.title ?? "";
  promptBodyInput().value = snippet?.body ?? "";
}

function createPromptSnippet(): void {
  const snippet = {
    id: uniquePromptSnippetId(),
    title: nextPromptSnippetTitle(),
    body: ""
  };
  state.snippets = [...state.snippets, snippet];
  state.selectedSnippetId = snippet.id;
  renderPromptLibrary();
  promptTitleInput().focus();
  setStatus("New prompt snippet");
}

async function saveCurrentPromptSnippet(): Promise<void> {
  const snippet = selectedPromptSnippet();
  if (!snippet) {
    throw new Error("No prompt snippet is selected");
  }

  const title = normalizedPromptTitle(promptTitleInput().value);
  const body = promptBodyInput().value;
  if (!title) {
    throw new Error("Add a slash command before saving");
  }

  if (body.trim().length === 0) {
    throw new Error("Add a prompt body before saving");
  }

  updateSelectedPromptSnippet({ title, body });
  const selectedId = state.selectedSnippetId;
  await savePromptSnippets(state.snippets);
  state.snippets = await loadPromptSnippets();
  state.selectedSnippetId = state.snippets.some((item) => item.id === selectedId)
    ? selectedId
    : state.snippets[0]?.id ?? "";
  renderPromptLibrary();
  setStatus("Saved prompt snippet locally");
}

async function deleteCurrentPromptSnippet(): Promise<void> {
  const selectedIndex = state.snippets.findIndex(
    (snippet) => snippet.id === state.selectedSnippetId
  );
  if (selectedIndex === -1) {
    throw new Error("No prompt snippet is selected");
  }

  const remaining = state.snippets.filter((snippet) => snippet.id !== state.selectedSnippetId);
  state.snippets = remaining;
  state.selectedSnippetId =
    state.snippets[Math.min(selectedIndex, state.snippets.length - 1)]?.id ?? "";

  await savePromptSnippets(state.snippets);
  renderPromptLibrary();
  setStatus("Deleted prompt snippet");
}

function updateSelectedPromptSnippet(fields: Partial<Pick<PromptSnippet, "title" | "body">>): void {
  state.snippets = state.snippets.map((snippet) =>
    snippet.id === state.selectedSnippetId ? { ...snippet, ...fields } : snippet
  );
}

function selectedPromptBody(options: { allowEmpty?: boolean } = {}): string {
  const snippet = selectedPromptSnippet();
  if (!snippet) {
    if (options.allowEmpty) {
      return "";
    }

    throw new Error("No prompt snippet is selected");
  }

  if (!options.allowEmpty && snippet.body.trim().length === 0) {
    throw new Error("Prompt body is empty");
  }

  return snippet.body;
}

function selectedPromptSnippet(): PromptSnippet | undefined {
  return state.snippets.find((item) => item.id === state.selectedSnippetId);
}

function normalizedPromptTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function nextPromptSnippetTitle(): string {
  const existingTitles = new Set(state.snippets.map((snippet) => snippet.title));
  let index = 1;
  let title = "/new-prompt";
  while (existingTitles.has(title)) {
    index += 1;
    title = `/new-prompt-${index}`;
  }
  return title;
}

function uniquePromptSnippetId(): string {
  const existingIds = new Set(state.snippets.map((snippet) => snippet.id));
  let id = "";
  do {
    id = `snippet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (existingIds.has(id));
  return id;
}

function preview(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Markdown preview']");
  if (!textarea) {
    throw new Error("Preview panel is unavailable");
  }
  return textarea;
}

function promptSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-prompt-select]");
  if (!select) {
    throw new Error("Prompt selector is unavailable");
  }
  return select;
}

function promptTitleInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[data-acv-prompt-title]");
  if (!input) {
    throw new Error("Prompt title input is unavailable");
  }
  return input;
}

function promptBodyInput(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-acv-prompt-body]");
  if (!textarea) {
    throw new Error("Prompt body input is unavailable");
  }
  return textarea;
}

function conversationNotesSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-conversation-notes");
  if (!section) {
    throw new Error("Conversation notes section is unavailable");
  }
  return section;
}

function conversationNoteInput(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[data-acv-conversation-note]"
  );
  if (!textarea) {
    throw new Error("Conversation note input is unavailable");
  }
  return textarea;
}

function conversationNoteContext(): HTMLSpanElement {
  const context = document.querySelector<HTMLSpanElement>("[data-acv-notes-context]");
  if (!context) {
    throw new Error("Conversation notes context is unavailable");
  }
  return context;
}

function conversationBookmarksSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-conversation-bookmarks");
  if (!section) {
    throw new Error("Conversation bookmarks section is unavailable");
  }
  return section;
}

function conversationBookmarksContext(): HTMLSpanElement {
  const context = document.querySelector<HTMLSpanElement>("[data-acv-bookmarks-context]");
  if (!context) {
    throw new Error("Conversation bookmarks context is unavailable");
  }
  return context;
}

function conversationBookmarkList(): HTMLDivElement {
  const list = document.querySelector<HTMLDivElement>(".acv-bookmark-list");
  if (!list) {
    throw new Error("Conversation bookmark list is unavailable");
  }
  return list;
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

function navigatorSearch(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[data-acv-message-search]");
  if (!input) {
    throw new Error("Message search is unavailable");
  }
  return input;
}

function navigatorRoleFilter(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-role-filter]");
  if (!select) {
    throw new Error("Message role filter is unavailable");
  }
  return select;
}

function navigatorCount(): HTMLSpanElement {
  const count = document.querySelector<HTMLSpanElement>("[data-acv-navigator-count]");
  if (!count) {
    throw new Error("Message navigator count is unavailable");
  }
  return count;
}

function navigatorResults(): HTMLDivElement {
  const results = document.querySelector<HTMLDivElement>(".acv-navigator-results");
  if (!results) {
    throw new Error("Message navigator results are unavailable");
  }
  return results;
}

function messageRow(messageIndex: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-acv-message-row-index="${messageIndex}"]`);
}

function setStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(".acv-status");
  if (status) {
    status.textContent = message;
  }
}
