import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

function setupConversationPage(): void {
  document.documentElement.innerHTML = `
    <head><title>Selection Flow - ChatGPT</title></head>
    <body>
      <main>
        <article data-message-author-role="user">Question one</article>
        <article data-message-author-role="assistant">Answer two</article>
        <article data-message-author-role="user">Follow-up three</article>
      </main>
    </body>
  `;
}

function appendConversationPage(): void {
  document.body.insertAdjacentHTML(
    "beforeend",
    `
      <main>
        <div data-message-author-role="user" dir="auto" class="text-message">
          <div class="user-message-bubble-color">
            <div class="whitespace-pre-wrap">Question after reload</div>
          </div>
        </div>
        <div data-message-author-role="assistant" data-turn-start-message="true" dir="auto" class="text-message">
          <div class="markdown prose">
            <p>Answer after reload</p>
          </div>
        </div>
      </main>
    `
  );
}

async function loadContentScript(): Promise<void> {
  vi.resetModules();
  await import("../src/content");
}

function actionButton(action: string): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    `#ai-chat-vault button[data-acv-action="${action}"]`
  );
  if (!button) {
    throw new Error(`Missing ${action} button`);
  }
  return button;
}

function messageCheckboxes(): HTMLInputElement[] {
  return Array.from(
    document.querySelectorAll<HTMLInputElement>("#ai-chat-vault input[data-acv-message-index]")
  );
}

function previewMarkdown(): string {
  const preview = document.querySelector<HTMLTextAreaElement>("#ai-chat-vault textarea");
  if (!preview) {
    throw new Error("Missing preview textarea");
  }
  return preview.value;
}

function captureStatus(): string {
  const status = document.querySelector<HTMLElement>("#ai-chat-vault .acv-status");
  if (!status) {
    throw new Error("Missing capture status");
  }
  return status.textContent ?? "";
}

function readBlobText(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.addEventListener("load", () => resolve(String(reader.result)));
    reader.addEventListener("error", () => reject(reader.error));
    reader.readAsText(blob);
  });
}

async function flushAsyncClick(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
}

describe("content script selected-message controls", () => {
  beforeEach(() => {
    setupConversationPage();
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  it("copies only the manually selected message after using Select none", async () => {
    const writeText = vi.fn().mockResolvedValue(undefined);
    Object.defineProperty(navigator, "clipboard", {
      configurable: true,
      value: { writeText }
    });

    await loadContentScript();
    actionButton("capture").click();
    await flushAsyncClick();

    expect(messageCheckboxes().map((checkbox) => checkbox.checked)).toEqual([true, true, true]);

    actionButton("select-none").click();
    expect(messageCheckboxes().map((checkbox) => checkbox.checked)).toEqual([false, false, false]);
    expect(previewMarkdown()).toBe("");

    const assistantCheckbox = messageCheckboxes()[1];
    assistantCheckbox.checked = true;
    assistantCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    actionButton("copy").click();
    await flushAsyncClick();

    expect(writeText).toHaveBeenCalledTimes(1);
    const copiedMarkdown = writeText.mock.calls[0][0] as string;
    expect(copiedMarkdown).toContain("## Assistant\n\nAnswer two");
    expect(copiedMarkdown).not.toContain("Question one");
    expect(copiedMarkdown).not.toContain("Follow-up three");
  });

  it("downloads the selected-message Markdown after bulk selection changes", async () => {
    const createObjectURL = vi.fn<[Blob], string>(() => "blob:ai-chat-vault-test");
    const revokeObjectURL = vi.fn<[string], void>();
    vi.stubGlobal("URL", {
      ...URL,
      createObjectURL,
      revokeObjectURL
    });
    vi.spyOn(HTMLAnchorElement.prototype, "click").mockImplementation(() => undefined);

    await loadContentScript();
    actionButton("capture").click();
    await flushAsyncClick();
    actionButton("select-none").click();

    const firstCheckbox = messageCheckboxes()[0];
    firstCheckbox.checked = true;
    firstCheckbox.dispatchEvent(new Event("change", { bubbles: true }));
    actionButton("select-all").click();
    actionButton("download").click();

    expect(createObjectURL).toHaveBeenCalledTimes(1);
    const blob = createObjectURL.mock.calls[0][0] as Blob;
    const downloadedMarkdown = await readBlobText(blob);

    expect(downloadedMarkdown).toContain("## User\n\nQuestion one");
    expect(downloadedMarkdown).toContain("## Assistant\n\nAnswer two");
    expect(downloadedMarkdown).toContain("## User\n\nFollow-up three");
    expect(revokeObjectURL).toHaveBeenCalledWith("blob:ai-chat-vault-test");
  });

  it("captures ChatGPT role-tagged messages that are added after content script injection", async () => {
    document.body.innerHTML = "";

    await loadContentScript();
    appendConversationPage();

    expect(document.querySelectorAll("[data-message-author-role]")).toHaveLength(2);

    actionButton("capture").click();
    await flushAsyncClick();

    expect(captureStatus()).toBe("Captured 2 messages");
    expect(previewMarkdown()).toContain("## User\n\nQuestion after reload");
    expect(previewMarkdown()).toContain("## Assistant\n\nAnswer after reload");
    expect(previewMarkdown()).not.toContain("_No conversation messages were detected._");
  });
});
