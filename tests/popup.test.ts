import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const CAPTURE_REQUEST_TYPE = "AI_CHAT_VAULT_CAPTURE";
const CAPTURE_RESPONSE_TYPE = "AI_CHAT_VAULT_CAPTURE_RESULT";

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
  const query = vi.fn((queryInfo, callback) => {
    expect(queryInfo).toEqual({ active: true, currentWindow: true });
    callback([{ id: 7, url: tabUrl }]);
  });
  const sendMessage = vi.fn((tabId, message, callback) => {
    expect(tabId).toBe(7);
    expect(message).toEqual({ type: CAPTURE_REQUEST_TYPE });
    callback({ type: CAPTURE_RESPONSE_TYPE, conversation });
  });

  vi.stubGlobal("chrome", {
    runtime: { lastError: undefined },
    tabs: { query, sendMessage }
  });

  return { query, sendMessage };
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

function status(): string {
  return document.querySelector(".acv-status")?.textContent ?? "";
}

async function flushAsyncClick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
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

    button("capture").click();
    await flushAsyncClick();

    expect(status()).toBe("Open a ChatGPT tab before capturing");
    expect(chromeMock.sendMessage).not.toHaveBeenCalled();
  });
});
