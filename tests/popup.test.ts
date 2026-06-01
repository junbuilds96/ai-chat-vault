import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { CONVERSATION_BOOKMARKS_STORAGE_KEY } from "../src/bookmarks";
import {
  CAPTURE_REQUEST_TYPE,
  CAPTURE_RESPONSE_TYPE,
  INSERT_PROMPT_REQUEST_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE
} from "../src/messages";
import { CONVERSATION_NOTES_STORAGE_KEY, conversationNoteIdentity } from "../src/notes";
import { PROMPT_SNIPPETS_STORAGE_KEY } from "../src/prompts";
import { WORK_CAPSULE_INDEX_KEY } from "../src/workCapsules";

const conversation = {
  title: "Popup Test - ChatGPT",
  url: "https://chatgpt.com/c/test",
  exportedAt: "2026-06-01T00:00:00.000Z",
  messages: [
    { speaker: "user" as const, text: "Question one" },
    { speaker: "assistant" as const, text: "Answer two" },
    { speaker: "user" as const, text: "Follow-up three" }
  ]
};

function installChromeMock(
  tabUrl = "https://chatgpt.com/c/test",
  initialStorage: Record<string, unknown> = {}
) {
  const runtime: { lastError?: { message?: string } } = {};
  const promptSnippets = [
    { id: "summarize", title: "/summarize", body: "Summarize this local chat." },
    { id: "debug", title: "/debug", body: "Debug this issue." }
  ];
  const store: Record<string, unknown> = {
    [PROMPT_SNIPPETS_STORAGE_KEY]: promptSnippets,
    ...initialStorage
  };
  const query = vi.fn((queryInfo, callback) => {
    expect(queryInfo).toEqual({ active: true, currentWindow: true });
    callback([{ id: 7, url: tabUrl }]);
  });
  const sendMessage = vi.fn((tabId, message, callback) => {
    expect(tabId).toBe(7);
    if (message.type === CAPTURE_REQUEST_TYPE) {
      callback({ type: CAPTURE_RESPONSE_TYPE, conversation });
      return;
    }

    if (message.type === INSERT_PROMPT_REQUEST_TYPE) {
      callback({ type: INSERT_PROMPT_RESPONSE_TYPE, inserted: true });
      return;
    }

    callback(undefined);
  });
  const get = vi.fn((key, callback) => {
    callback({ [key]: store[key] });
  });
  const set = vi.fn((items, callback) => {
    Object.assign(store, items);
    callback();
  });

  vi.stubGlobal("chrome", {
    runtime,
    storage: {
      local: { get, set }
    },
    tabs: { query, sendMessage }
  });

  return { get, promptSnippets, query, runtime, sendMessage, set, store };
}

function installChromeMockWithSendMessageError(message: string) {
  const runtime: { lastError?: { message?: string } } = {};
  const query = vi.fn((queryInfo, callback) => {
    expect(queryInfo).toEqual({ active: true, currentWindow: true });
    callback([{ id: 7, url: "https://chatgpt.com/c/test" }]);
  });
  const sendMessage = vi.fn((tabId, request, callback) => {
    expect(tabId).toBe(7);
    expect(request).toEqual({ type: CAPTURE_REQUEST_TYPE });
    runtime.lastError = { message };
    callback(undefined);
    runtime.lastError = undefined;
  });

  vi.stubGlobal("chrome", {
    runtime,
    storage: {
      local: {
        get: vi.fn((key, callback) => callback({ [key]: [] })),
        set: vi.fn((_items, callback) => callback())
      }
    },
    tabs: { query, sendMessage }
  });

  return { query, runtime, sendMessage };
}

async function loadPopup(): Promise<void> {
  vi.resetModules();
  document.body.innerHTML = `<div id="root"></div>`;
  await import("../src/popup");
}

function button(action: string): HTMLButtonElement {
  const element = document.querySelector<HTMLButtonElement>(`button[data-acv-action="${action}"]`);
  if (!element) {
    throw new Error(`Missing ${action} button`);
  }
  return element;
}

function checkboxes(): HTMLInputElement[] {
  return Array.from(document.querySelectorAll<HTMLInputElement>("input[data-acv-message-index]"));
}

function messageRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>("[data-acv-message-row-index]"));
}

function navigatorSearch(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[data-acv-message-search]");
  if (!input) {
    throw new Error("Missing message search");
  }
  return input;
}

function navigatorRoleFilter(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-role-filter]");
  if (!select) {
    throw new Error("Missing role filter");
  }
  return select;
}

function navigatorCount(): string {
  return document.querySelector("[data-acv-navigator-count]")?.textContent ?? "";
}

function navigatorResults(): HTMLButtonElement[] {
  return Array.from(document.querySelectorAll<HTMLButtonElement>("button[data-acv-focus-message-index]"));
}

function preview(): string {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Markdown preview']");
  return textarea?.value ?? "";
}

function promptPreview(): string {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-acv-prompt-body]");
  return textarea?.value ?? "";
}

function promptTitleInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[data-acv-prompt-title]");
  if (!input) {
    throw new Error("Missing prompt title input");
  }
  return input;
}

function promptBodyInput(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-acv-prompt-body]");
  if (!textarea) {
    throw new Error("Missing prompt body input");
  }
  return textarea;
}

function promptSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-prompt-select]");
  if (!select) {
    throw new Error("Missing prompt select");
  }
  return select;
}

function workCapsuleSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-work-capsule");
  if (!section) {
    throw new Error("Missing work capsule section");
  }
  return section;
}

function workCapsuleFields(): HTMLElement {
  const fields = document.querySelector<HTMLElement>(".acv-work-capsule-fields");
  if (!fields) {
    throw new Error("Missing work capsule fields");
  }
  return fields;
}

function capsuleField(field: string): HTMLInputElement | HTMLTextAreaElement {
  const input = document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-acv-capsule-field="${field}"]`
  );
  if (!input) {
    throw new Error(`Missing capsule ${field} field`);
  }
  return input;
}

function conversationNotesSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-conversation-notes");
  if (!section) {
    throw new Error("Missing conversation notes section");
  }
  return section;
}

function conversationNoteInput(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[data-acv-conversation-note]"
  );
  if (!textarea) {
    throw new Error("Missing conversation note input");
  }
  return textarea;
}

function conversationNotesContext(): string {
  return document.querySelector("[data-acv-notes-context]")?.textContent ?? "";
}

function conversationBookmarksSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-conversation-bookmarks");
  if (!section) {
    throw new Error("Missing conversation bookmarks section");
  }
  return section;
}

function conversationBookmarksContext(): string {
  return document.querySelector("[data-acv-bookmarks-context]")?.textContent ?? "";
}

function bookmarkRows(): HTMLElement[] {
  return Array.from(document.querySelectorAll<HTMLElement>(".acv-bookmark-row"));
}

function bookmarkButtons(action: string): HTMLButtonElement[] {
  return Array.from(
    document.querySelectorAll<HTMLButtonElement>(`button[data-acv-action="${action}"]`)
  );
}

function status(): string {
  return document.querySelector(".acv-status")?.textContent ?? "";
}

function savedCapsules(store: Record<string, unknown>) {
  return Object.keys(store)
    .filter((key) => key.startsWith("workCapsule:v1:"))
    .map((key) => store[key]);
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result ?? "")));
    reader.addEventListener("error", () => {
      reject(reader.error ?? new Error("Could not read blob"));
    });
    reader.readAsText(blob);
  });
}

async function flushAsyncClick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

async function flushPromptLoad(): Promise<void> {
  await flushAsyncClick();
}

describe("toolbar popup", () => {
  beforeEach(() => {
    installChromeMock();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  it("captures the active ChatGPT tab into a selectable Markdown preview", async () => {
    await loadPopup();
    await flushPromptLoad();

    button("capture").click();
    await flushAsyncClick();

    expect(status()).toBe("Captured 3 messages");
    expect(checkboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, true]);
    expect(preview()).toContain("# Popup Test - ChatGPT");
    expect(preview()).toContain("## User\n\nQuestion one");
    expect(preview()).toContain("## Assistant\n\nAnswer two");
  });

  it("loads local conversation notes after capture", async () => {
    const identity = conversationNoteIdentity(conversation);
    installChromeMock("https://chatgpt.com/c/test", {
      [CONVERSATION_NOTES_STORAGE_KEY]: {
        [identity]: "Remember to export this for the incident review."
      }
    });

    await loadPopup();
    await flushPromptLoad();

    expect(conversationNotesSection().hidden).toBe(true);

    button("capture").click();
    await flushAsyncClick();

    expect(conversationNotesSection().hidden).toBe(false);
    expect(conversationNotesSection().dataset.acvNotesIdentity).toBe(identity);
    expect(conversationNotesContext()).toBe("Popup Test - ChatGPT");
    expect(conversationNoteInput().value).toBe(
      "Remember to export this for the incident review."
    );
  });

  it("saves local conversation notes and reloads them on later captures", async () => {
    const chromeMock = installChromeMock();
    const identity = conversationNoteIdentity(conversation);

    await loadPopup();
    await flushPromptLoad();

    button("capture").click();
    await flushAsyncClick();

    const note = conversationNoteInput();
    note.value = "Follow up on the benchmark table.";
    note.dispatchEvent(new Event("input", { bubbles: true }));
    await flushAsyncClick();

    expect(chromeMock.store[CONVERSATION_NOTES_STORAGE_KEY]).toEqual({
      [identity]: "Follow up on the benchmark table."
    });
    expect(status()).toBe("Saved conversation note locally");

    note.value = "";
    button("capture").click();
    await flushAsyncClick();

    expect(conversationNoteInput().value).toBe("Follow up on the benchmark table.");
    expect(status()).toBe("Captured 3 messages");
  });

  it("saves, copies, and deletes local conversation bookmarks", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const chromeMock = installChromeMock("https://chatgpt.com/c/test", {
      [CONVERSATION_BOOKMARKS_STORAGE_KEY]: [
        {
          id: "existing",
          title: "Existing plan",
          url: "https://chatgpt.com/c/existing",
          savedAt: "2026-06-01T00:00:00.000Z"
        }
      ]
    });
    const identity = conversationNoteIdentity(conversation);

    await loadPopup();
    await flushPromptLoad();

    expect(conversationBookmarksSection().hidden).toBe(true);

    button("capture").click();
    await flushAsyncClick();

    expect(conversationBookmarksSection().hidden).toBe(false);
    expect(conversationBookmarksContext()).toBe("1 saved link");
    expect(bookmarkRows().map((row) => row.textContent)).toEqual([
      "Existing planhttps://chatgpt.com/c/existingCopy linkDelete"
    ]);

    button("save-bookmark").click();
    await flushAsyncClick();

    expect(chromeMock.store[CONVERSATION_BOOKMARKS_STORAGE_KEY]).toEqual([
      expect.objectContaining({
        id: identity,
        title: "Popup Test - ChatGPT",
        url: "https://chatgpt.com/c/test"
      }),
      {
        id: "existing",
        title: "Existing plan",
        url: "https://chatgpt.com/c/existing",
        savedAt: "2026-06-01T00:00:00.000Z"
      }
    ]);
    expect(conversationBookmarksContext()).toBe("2 saved links");
    expect(bookmarkRows()[0].textContent).toBe(
      "Popup Test - ChatGPThttps://chatgpt.com/c/testCopy linkDelete"
    );
    expect(status()).toBe("Saved conversation bookmark locally");

    bookmarkButtons("copy-bookmark")[0].click();
    await flushAsyncClick();

    expect(writeText).toHaveBeenCalledWith("https://chatgpt.com/c/test");
    expect(status()).toBe("Copied bookmark link to clipboard");

    bookmarkButtons("delete-bookmark")[0].click();
    await flushAsyncClick();

    expect(chromeMock.store[CONVERSATION_BOOKMARKS_STORAGE_KEY]).toEqual([
      {
        id: "existing",
        title: "Existing plan",
        url: "https://chatgpt.com/c/existing",
        savedAt: "2026-06-01T00:00:00.000Z"
      }
    ]);
    expect(conversationBookmarksContext()).toBe("1 saved link");
    expect(bookmarkRows().map((row) => row.textContent)).toEqual([
      "Existing planhttps://chatgpt.com/c/existingCopy linkDelete"
    ]);
    expect(status()).toBe("Deleted conversation bookmark");
  });

  it("filters captured turns by role and text in the Message Navigator", async () => {
    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();

    expect(navigatorCount()).toBe("3 of 3 turns");
    expect(navigatorResults().map((result) => result.textContent)).toEqual([
      "1. UserQuestion one",
      "2. AssistantAnswer two",
      "3. UserFollow-up three"
    ]);
    expect(Array.from(navigatorRoleFilter().options).map((option) => option.textContent)).toEqual([
      "All roles (3)",
      "User (2)",
      "Assistant (1)",
      "System (0)"
    ]);

    navigatorRoleFilter().value = "assistant";
    navigatorRoleFilter().dispatchEvent(new Event("change", { bubbles: true }));
    expect(navigatorCount()).toBe("1 of 3 turns");
    expect(navigatorResults()).toHaveLength(1);
    expect(navigatorResults()[0].textContent).toBe("2. AssistantAnswer two");

    navigatorSearch().value = "follow-up";
    navigatorSearch().dispatchEvent(new Event("input", { bubbles: true }));
    expect(navigatorCount()).toBe("0 of 3 turns");
    expect(document.querySelector(".acv-navigator-empty")?.textContent).toBe("No matching turns");

    navigatorRoleFilter().value = "all";
    navigatorRoleFilter().dispatchEvent(new Event("change", { bubbles: true }));
    expect(navigatorCount()).toBe("1 of 3 turns");
    expect(navigatorResults()[0].textContent).toBe("3. UserFollow-up three");
  });

  it("focuses a navigator result without changing selected-message export", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();

    button("select-none").click();
    const firstCheckbox = checkboxes()[0];
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    navigatorSearch().value = "answer";
    navigatorSearch().dispatchEvent(new Event("input", { bubbles: true }));
    navigatorResults()[0].click();
    await flushAsyncClick();

    expect(messageRows()[1].classList.contains("is-focused")).toBe(true);
    expect(messageRows()[1].getAttribute("aria-current")).toBe("true");
    expect(messageRows()[0].classList.contains("is-focused")).toBe(false);
    expect(status()).toBe("Focused message 2 of 3");

    button("copy").click();
    await flushAsyncClick();

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("## User\n\nQuestion one");
    expect(copied).not.toContain("Answer two");
    expect(copied).not.toContain("Follow-up three");
  });

  it("copies only selected messages from the popup", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();

    button("select-none").click();
    const assistantCheckbox = checkboxes()[1];
    assistantCheckbox.checked = true;
    assistantCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    button("copy").click();
    await flushAsyncClick();

    expect(writeText).toHaveBeenCalledTimes(1);
    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("## Assistant\n\nAnswer two");
    expect(copied).not.toContain("Question one");
    expect(copied).not.toContain("Follow-up three");
  });

  it("creates a Work Capsule draft from selected messages only", async () => {
    await loadPopup();
    await flushPromptLoad();

    expect(workCapsuleSection().hidden).toBe(true);

    button("capture").click();
    await flushAsyncClick();

    button("select-none").click();
    const firstCheckbox = checkboxes()[0];
    const assistantCheckbox = checkboxes()[1];
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    assistantCheckbox.checked = true;
    assistantCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    button("create-capsule").click();
    await flushAsyncClick();

    expect(workCapsuleSection().hidden).toBe(false);
    expect(workCapsuleFields().hidden).toBe(false);
    expect(capsuleField("title").value).toBe("Popup Test - ChatGPT");
    expect(capsuleField("goal").value).toBe(
      "Reuse selected context from Popup Test - ChatGPT."
    );
    expect(capsuleField("reusableContext").value).toContain("1. User: Question one");
    expect(capsuleField("reusableContext").value).toContain("2. Assistant: Answer two");
    expect(capsuleField("reusableContext").value).not.toContain("Follow-up three");
    expect(status()).toBe("Created capsule draft from 2 selected messages");
  });

  it("fails Work Capsule creation when no messages are selected", async () => {
    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();

    button("select-none").click();
    button("create-capsule").click();
    await flushAsyncClick();

    expect(status()).toBe("Select at least one message to export");
    expect(workCapsuleFields().hidden).toBe(true);
  });

  it("keeps Work Capsule edits before save", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();
    button("create-capsule").click();
    await flushAsyncClick();

    capsuleField("title").value = "Edited Capsule";
    capsuleField("title").dispatchEvent(new Event("input", { bubbles: true }));
    capsuleField("goal").value = "Carry edited context into the next session.";
    capsuleField("goal").dispatchEvent(new Event("input", { bubbles: true }));
    capsuleField("decisions").value = "Keep the popup local-only";
    capsuleField("decisions").dispatchEvent(new Event("input", { bubbles: true }));
    capsuleField("nextActions").value = "Review this capsule tomorrow";
    capsuleField("nextActions").dispatchEvent(new Event("input", { bubbles: true }));

    button("copy-capsule-markdown").click();
    await flushAsyncClick();

    const copied = writeText.mock.calls[0][0] as string;
    expect(copied).toContain("Edited Capsule");
    expect(copied).toContain("Carry edited context into the next session.");
    expect(copied).toContain("- Keep the popup local-only");
    expect(copied).toContain("- [todo] @user Review this capsule tomorrow");
    expect(status()).toBe("Copied capsule Markdown to clipboard");
  });

  it("saves a Work Capsule draft to local storage", async () => {
    const chromeMock = installChromeMock();

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();

    button("select-none").click();
    const assistantCheckbox = checkboxes()[1];
    assistantCheckbox.checked = true;
    assistantCheckbox.dispatchEvent(new Event("change", { bubbles: true }));

    button("create-capsule").click();
    await flushAsyncClick();
    capsuleField("title").value = "Assistant Answer Capsule";
    capsuleField("title").dispatchEvent(new Event("input", { bubbles: true }));
    capsuleField("facts").value = "The assistant answered the first question.";
    capsuleField("facts").dispatchEvent(new Event("input", { bubbles: true }));

    button("save-capsule").click();
    await flushAsyncClick();

    const saved = savedCapsules(chromeMock.store)[0] as {
      title: string;
      facts: Array<{ text: string }>;
      source: { selectedTurnIds: string[] };
      excerpts: Array<{ turnId: string; role: string; text: string }>;
    };
    expect(saved).toMatchObject({
      title: "Assistant Answer Capsule",
      facts: [{ id: "fact-1", text: "The assistant answered the first question." }],
      source: { selectedTurnIds: ["message-2"] },
      excerpts: [{ id: "excerpt-2", turnId: "message-2", role: "assistant", text: "Answer two" }]
    });
    expect(JSON.stringify(saved)).not.toContain("Question one");
    expect(JSON.stringify(saved)).not.toContain("Follow-up three");
    expect(chromeMock.store[WORK_CAPSULE_INDEX_KEY]).toEqual([
      expect.objectContaining({
        id: expect.any(String),
        title: "Assistant Answer Capsule",
        sourceTitle: "Popup Test - ChatGPT",
        sourceUrl: "https://chatgpt.com/c/test"
      })
    ]);
    expect(status()).toBe("Saved capsule locally");
  });

  it("copies Work Capsule context and Markdown", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();
    button("create-capsule").click();
    await flushAsyncClick();

    button("copy-capsule-context").click();
    await flushAsyncClick();
    expect(writeText.mock.calls[0][0]).toContain("Title: Popup Test - ChatGPT");
    expect(writeText.mock.calls[0][0]).toContain("- message-1 (user): Question one");
    expect(writeText.mock.calls[0][0]).toContain("- message-2 (assistant): Answer two");
    expect(status()).toBe("Copied capsule context to clipboard");

    button("copy-capsule-markdown").click();
    await flushAsyncClick();
    expect(writeText.mock.calls[1][0]).toContain("## Source");
    expect(writeText.mock.calls[1][0]).toContain(
      "- Selected turn IDs: message-1, message-2, message-3"
    );
    expect(writeText.mock.calls[1][0]).toContain(
      "- message-3 (user): Follow-up three"
    );
    expect(status()).toBe("Copied capsule Markdown to clipboard");
  });

  it("downloads Work Capsule Markdown", async () => {
    const createObjectURL = vi.fn(() => "blob:work-capsule");
    const revokeObjectURL = vi.fn();
    const click = vi.fn();
    const originalCreateElement = document.createElement.bind(document);
    Object.defineProperty(URL, "createObjectURL", {
      configurable: true,
      value: createObjectURL
    });
    Object.defineProperty(URL, "revokeObjectURL", {
      configurable: true,
      value: revokeObjectURL
    });
    vi.spyOn(document, "createElement").mockImplementation((tagName, options) => {
      const element = originalCreateElement(tagName, options);
      if (tagName.toLowerCase() === "a") {
        element.click = click;
      }
      return element;
    });

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();
    button("create-capsule").click();
    await flushAsyncClick();
    capsuleField("title").value = "Capsule Download";
    capsuleField("title").dispatchEvent(new Event("input", { bubbles: true }));

    button("download-capsule").click();
    await flushAsyncClick();

    const [[blob]] = createObjectURL.mock.calls as unknown as [[Blob]];
    await expect(readBlobText(blob)).resolves.toContain("Capsule Download");
    expect(createObjectURL).toHaveBeenCalledTimes(1);
    expect(click).toHaveBeenCalledTimes(1);
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:work-capsule");
    expect(status()).toBe("Downloaded capsule Markdown file");
  });

  it("does not call network APIs during the Work Capsule popup loop", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const fetchMock = vi.fn(() => {
      throw new Error("network unavailable");
    });
    const xhrMock = vi.fn(() => {
      throw new Error("network unavailable");
    });
    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", xhrMock);

    await loadPopup();
    await flushPromptLoad();
    button("capture").click();
    await flushAsyncClick();
    button("create-capsule").click();
    await flushAsyncClick();
    button("copy-capsule-context").click();
    await flushAsyncClick();
    button("copy-capsule-markdown").click();
    await flushAsyncClick();
    button("save-capsule").click();
    await flushAsyncClick();

    expect(fetchMock).not.toHaveBeenCalled();
    expect(xhrMock).not.toHaveBeenCalled();
  });

  it("shows a clear unsupported-tab error before messaging", async () => {
    const chromeMock = installChromeMock("https://example.com/");
    await loadPopup();
    await flushPromptLoad();

    button("capture").click();
    await flushAsyncClick();

    expect(status()).toBe("Open a ChatGPT tab before capturing");
    expect(chromeMock.sendMessage).not.toHaveBeenCalled();
  });

  it.each([
    "Receiving end does not exist.",
    "Could not establish connection."
  ])("explains stale content-script receivers after extension updates: %s", async (message) => {
    installChromeMockWithSendMessageError(message);
    await loadPopup();
    await flushPromptLoad();

    button("capture").click();
    await flushAsyncClick();

    expect(status()).toBe(
      "Reload the ChatGPT tab after installing or updating AI Chat Vault, then try Capture again."
    );
  });

  it("loads local prompt snippets and copies the selected prompt", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const chromeMock = installChromeMock();

    await loadPopup();
    await flushPromptLoad();

    expect(chromeMock.get).toHaveBeenCalledWith(PROMPT_SNIPPETS_STORAGE_KEY, expect.any(Function));
    expect(Array.from(promptSelect().options).map((option) => option.textContent)).toEqual([
      "/summarize",
      "/debug"
    ]);
    expect(promptPreview()).toBe("Summarize this local chat.");
    expect(promptTitleInput().value).toBe("/summarize");

    promptSelect().value = "debug";
    promptSelect().dispatchEvent(new Event("change", { bubbles: true }));
    button("copy-prompt").click();
    await flushAsyncClick();

    expect(writeText).toHaveBeenCalledWith("Debug this issue.");
    expect(status()).toBe("Copied prompt to clipboard");
  });

  it("sends selected prompt insert messages without capturing first", async () => {
    const chromeMock = installChromeMock();

    await loadPopup();
    await flushPromptLoad();

    promptSelect().value = "debug";
    promptSelect().dispatchEvent(new Event("change", { bubbles: true }));
    button("insert-prompt").click();
    await flushAsyncClick();

    expect(chromeMock.sendMessage).toHaveBeenCalledTimes(1);
    expect(chromeMock.sendMessage.mock.calls[0][1]).toEqual({
      type: INSERT_PROMPT_REQUEST_TYPE,
      prompt: "Debug this issue."
    });
    expect(status()).toBe("Inserted prompt into ChatGPT");
  });

  it("creates prompt snippets locally and preserves copy and insert behavior", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });
    const chromeMock = installChromeMock();

    await loadPopup();
    await flushPromptLoad();

    button("new-prompt").click();
    expect(promptTitleInput().value).toBe("/new-prompt");
    expect(promptBodyInput().value).toBe("");

    promptTitleInput().value = "review";
    promptTitleInput().dispatchEvent(new Event("input", { bubbles: true }));
    promptBodyInput().value = "Review this answer for correctness.";
    promptBodyInput().dispatchEvent(new Event("input", { bubbles: true }));
    expect(status()).toBe("Unsaved prompt changes");

    button("save-prompt").click();
    await flushAsyncClick();

    const savedSnippets = chromeMock.store[PROMPT_SNIPPETS_STORAGE_KEY] as Array<{
      id: string;
      title: string;
      body: string;
    }>;
    const savedSnippet = savedSnippets.find((snippet) => snippet.title === "/review");
    expect(savedSnippet).toMatchObject({
      title: "/review",
      body: "Review this answer for correctness."
    });
    expect(Array.from(promptSelect().options).map((option) => option.textContent)).toContain(
      "/review"
    );
    expect(status()).toBe("Saved prompt snippet locally");

    button("copy-prompt").click();
    await flushAsyncClick();
    expect(writeText).toHaveBeenCalledWith("Review this answer for correctness.");

    button("insert-prompt").click();
    await flushAsyncClick();
    expect(chromeMock.sendMessage).toHaveBeenCalledWith(
      7,
      {
        type: INSERT_PROMPT_REQUEST_TYPE,
        prompt: "Review this answer for correctness."
      },
      expect.any(Function)
    );
    expect(status()).toBe("Inserted prompt into ChatGPT");
  });

  it("edits existing prompt snippets in local storage", async () => {
    const chromeMock = installChromeMock();

    await loadPopup();
    await flushPromptLoad();

    promptSelect().value = "debug";
    promptSelect().dispatchEvent(new Event("change", { bubbles: true }));
    promptTitleInput().value = "/diagnose";
    promptTitleInput().dispatchEvent(new Event("input", { bubbles: true }));
    promptBodyInput().value = "Diagnose this with evidence first.";
    promptBodyInput().dispatchEvent(new Event("input", { bubbles: true }));

    button("save-prompt").click();
    await flushAsyncClick();

    expect(chromeMock.store[PROMPT_SNIPPETS_STORAGE_KEY]).toEqual([
      { id: "summarize", title: "/summarize", body: "Summarize this local chat." },
      { id: "debug", title: "/diagnose", body: "Diagnose this with evidence first." }
    ]);
    expect(Array.from(promptSelect().options).map((option) => option.textContent)).toEqual([
      "/summarize",
      "/diagnose"
    ]);
    expect(promptSelect().value).toBe("debug");
    expect(promptPreview()).toBe("Diagnose this with evidence first.");
    expect(status()).toBe("Saved prompt snippet locally");
  });

  it("deletes prompt snippets from local storage", async () => {
    const chromeMock = installChromeMock();

    await loadPopup();
    await flushPromptLoad();

    promptSelect().value = "summarize";
    promptSelect().dispatchEvent(new Event("change", { bubbles: true }));
    button("delete-prompt").click();
    await flushAsyncClick();

    expect(chromeMock.store[PROMPT_SNIPPETS_STORAGE_KEY]).toEqual([
      { id: "debug", title: "/debug", body: "Debug this issue." }
    ]);
    expect(Array.from(promptSelect().options).map((option) => option.textContent)).toEqual([
      "/debug"
    ]);
    expect(promptSelect().value).toBe("debug");
    expect(promptPreview()).toBe("Debug this issue.");
    expect(status()).toBe("Deleted prompt snippet");
  });
});
