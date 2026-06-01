import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPTURE_REQUEST_TYPE,
  CAPTURE_RESPONSE_TYPE,
  INSERT_PROMPT_REQUEST_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE
} from "../src/messages";
import { CONVERSATION_NOTES_STORAGE_KEY, conversationNoteIdentity } from "../src/notes";
import { PROMPT_SNIPPETS_STORAGE_KEY } from "../src/prompts";

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
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Prompt preview']");
  return textarea?.value ?? "";
}

function promptSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-prompt-select]");
  if (!select) {
    throw new Error("Missing prompt select");
  }
  return select;
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

function status(): string {
  return document.querySelector(".acv-status")?.textContent ?? "";
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
});
