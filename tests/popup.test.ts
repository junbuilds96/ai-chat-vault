import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  CAPTURE_REQUEST_TYPE,
  CAPTURE_RESPONSE_TYPE,
  INSERT_PROMPT_REQUEST_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE
} from "../src/messages";
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

function installChromeMock(tabUrl = "https://chatgpt.com/c/test") {
  const runtime: { lastError?: { message?: string } } = {};
  const promptSnippets = [
    { id: "summarize", title: "/summarize", body: "Summarize this local chat." },
    { id: "debug", title: "/debug", body: "Debug this issue." }
  ];
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
    callback({ [key]: promptSnippets });
  });
  const set = vi.fn((_items, callback) => callback());

  vi.stubGlobal("chrome", {
    runtime,
    storage: {
      local: { get, set }
    },
    tabs: { query, sendMessage }
  });

  return { get, promptSnippets, query, runtime, sendMessage, set };
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

function status(): string {
  return document.querySelector(".acv-status")?.textContent ?? "";
}

async function flushAsyncClick(): Promise<void> {
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
