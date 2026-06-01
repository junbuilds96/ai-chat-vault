import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CAPTURE_REQUEST_TYPE,
  CAPTURE_RESPONSE_TYPE,
  INSERT_PROMPT_REQUEST_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE,
  isCaptureRequest,
  isInsertPromptRequest,
  isSupportedChatGptHost
} from "../src/messages";
import { captureCurrentConversation, insertPromptIntoComposer } from "../src/content";

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

async function loadContentScriptWithChromeMock(): Promise<{
  listener: (message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean;
}> {
  vi.resetModules();
  let listener:
    | ((message: unknown, sender: unknown, sendResponse: (response: unknown) => void) => boolean)
    | undefined;
  vi.stubGlobal("chrome", {
    runtime: {
      onMessage: {
        addListener: vi.fn((callback) => {
          listener = callback;
        })
      }
    }
  });

  await import("../src/content");
  if (!listener) {
    throw new Error("Content script did not register a message listener");
  }

  return { listener };
}

async function flushAsyncResponse(): Promise<void> {
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
}

describe("content script capture bridge", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.resetModules();
    document.documentElement.innerHTML = "<head></head><body></body>";
  });

  it("captures ChatGPT role-tagged messages without injecting an in-page panel", async () => {
    setupConversationPage();

    const conversation = await captureCurrentConversation(document);

    expect(document.querySelector("#ai-chat-vault")).toBeNull();
    expect(conversation.messages.map((message) => message.text)).toEqual([
      "Question one",
      "Answer two",
      "Follow-up three"
    ]);
  });

  it("captures ChatGPT role-tagged messages that are added after content script injection", async () => {
    document.body.innerHTML = `<main><div data-message-author-role="user"></div></main>`;
    const pendingConversation = captureCurrentConversation(document);

    document.querySelector("[data-message-author-role]")?.insertAdjacentHTML(
      "beforeend",
      `<div class="whitespace-pre-wrap">Question after reload</div>`
    );
    appendConversationPage();
    await flushAsyncResponse();

    const conversation = await pendingConversation;
    expect(conversation.messages).toHaveLength(2);
    expect(conversation.messages[0].text).toBe("Question after reload");
    expect(conversation.messages[1].text).toBe("Answer after reload");
  });

  it("responds to popup capture messages", async () => {
    setupConversationPage();
    const { listener } = await loadContentScriptWithChromeMock();
    const sendResponse = vi.fn();

    const keepsChannelOpen = listener({ type: CAPTURE_REQUEST_TYPE }, {}, sendResponse);
    await flushAsyncResponse();

    expect(keepsChannelOpen).toBe(true);
    expect(sendResponse).toHaveBeenCalledTimes(1);
    expect(sendResponse.mock.calls[0][0]).toMatchObject({
      type: CAPTURE_RESPONSE_TYPE,
      conversation: {
        title: "Selection Flow",
        messages: [
          { speaker: "user", text: "Question one" },
          { speaker: "assistant", text: "Answer two" },
          { speaker: "user", text: "Follow-up three" }
        ]
      }
    });
  });

  it("inserts prompts into ChatGPT textarea composers with input events", () => {
    document.body.innerHTML = `<textarea data-testid="prompt-textarea"></textarea>`;
    const textarea = document.querySelector<HTMLTextAreaElement>("textarea");
    const inputListener = vi.fn();
    textarea?.addEventListener("input", inputListener);

    expect(insertPromptIntoComposer("Use this snippet.", document)).toBe(true);

    expect(textarea?.value).toBe("Use this snippet.");
    expect(document.activeElement).toBe(textarea);
    expect(inputListener).toHaveBeenCalledTimes(1);
  });

  it("inserts prompts into contenteditable ProseMirror composers with input events", () => {
    document.body.innerHTML = `<div contenteditable="true" class="ProseMirror"></div>`;
    const editor = document.querySelector<HTMLElement>(".ProseMirror");
    const inputListener = vi.fn();
    editor?.addEventListener("input", inputListener);

    expect(insertPromptIntoComposer("Draft from snippet.", document)).toBe(true);

    expect(editor?.textContent).toBe("Draft from snippet.");
    expect(document.activeElement).toBe(editor);
    expect(inputListener).toHaveBeenCalledTimes(1);
  });

  it("responds to popup prompt insertion messages and reports missing composers", async () => {
    const { listener } = await loadContentScriptWithChromeMock();
    const insertedResponse = vi.fn();

    document.body.innerHTML = `<textarea data-testid="prompt-textarea"></textarea>`;
    const keepsChannelOpen = listener(
      { type: INSERT_PROMPT_REQUEST_TYPE, prompt: "Prompt body" },
      {},
      insertedResponse
    );

    expect(keepsChannelOpen).toBe(false);
    expect(document.querySelector("textarea")?.textContent).toBe("");
    expect(document.querySelector<HTMLTextAreaElement>("textarea")?.value).toBe("Prompt body");
    expect(insertedResponse).toHaveBeenCalledWith({
      type: INSERT_PROMPT_RESPONSE_TYPE,
      inserted: true,
      error: undefined
    });

    document.body.innerHTML = "";
    const missingResponse = vi.fn();
    listener({ type: INSERT_PROMPT_REQUEST_TYPE, prompt: "Prompt body" }, {}, missingResponse);

    expect(missingResponse).toHaveBeenCalledWith({
      type: INSERT_PROMPT_RESPONSE_TYPE,
      inserted: false,
      error: "ChatGPT composer was not found"
    });
  });

  it("recognizes capture requests and supported ChatGPT hosts", () => {
    expect(isCaptureRequest({ type: CAPTURE_REQUEST_TYPE })).toBe(true);
    expect(isCaptureRequest({ type: "other" })).toBe(false);
    expect(isInsertPromptRequest({ type: INSERT_PROMPT_REQUEST_TYPE, prompt: "Prompt" })).toBe(true);
    expect(isInsertPromptRequest({ type: INSERT_PROMPT_REQUEST_TYPE })).toBe(false);
    expect(isSupportedChatGptHost("chatgpt.com")).toBe(true);
    expect(isSupportedChatGptHost("chat.openai.com")).toBe(true);
    expect(isSupportedChatGptHost("example.com")).toBe(false);
  });
});
