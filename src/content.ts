import { extractConversation, type ConversationExport } from "./extractor";
import {
  CAPTURE_RESPONSE_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE,
  type CaptureResponse,
  type InsertPromptResponse,
  isCaptureRequest,
  isInsertPromptRequest
} from "./messages";

const CHATGPT_MESSAGE_SELECTOR = "[data-message-author-role]";
const COMPOSER_SELECTOR = [
  "textarea[data-testid='prompt-textarea']",
  "textarea#prompt-textarea",
  "textarea[placeholder]",
  "[contenteditable='true'][data-testid='prompt-textarea']",
  "[contenteditable='true'].ProseMirror",
  "[contenteditable='true']"
].join(",");
const CAPTURE_SETTLE_TIMEOUT_MS = 1500;

export async function captureCurrentConversation(
  documentRef: Document = document
): Promise<ConversationExport> {
  return extractConversationAfterPageSettles(documentRef);
}

export function insertPromptIntoComposer(
  prompt: string,
  documentRef: Document = document
): boolean {
  const composer = findComposer(documentRef);
  if (!composer) {
    return false;
  }

  composer.focus();

  if (composer instanceof HTMLTextAreaElement) {
    setTextareaValue(composer, prompt);
    return true;
  }

  setEditableValue(composer, prompt);
  return true;
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
    if (isInsertPromptRequest(message)) {
      const inserted = insertPromptIntoComposer(message.prompt);
      sendResponse({
        type: INSERT_PROMPT_RESPONSE_TYPE,
        inserted,
        error: inserted ? undefined : "ChatGPT composer was not found"
      } satisfies InsertPromptResponse & { error?: string });
      return false;
    }

    if (!isCaptureRequest(message)) {
      return false;
    }

    captureCurrentConversation()
      .then((conversation) => {
        sendResponse({
          type: CAPTURE_RESPONSE_TYPE,
          conversation
        } satisfies CaptureResponse);
      })
      .catch((error: unknown) => {
        sendResponse({
          type: CAPTURE_RESPONSE_TYPE,
          error: error instanceof Error ? error.message : "Capture failed"
        });
      });

    return true;
  });
}

function findComposer(documentRef: Document): HTMLElement | null {
  const activeElement = documentRef.activeElement;
  if (isComposerElement(activeElement)) {
    return activeElement;
  }

  return Array.from(documentRef.querySelectorAll<HTMLElement>(COMPOSER_SELECTOR)).find(
    isVisibleComposer
  ) ?? null;
}

function isComposerElement(element: Element | null): element is HTMLElement {
  return (
    element instanceof HTMLTextAreaElement ||
    (element instanceof HTMLElement && element.isContentEditable)
  );
}

function isVisibleComposer(element: HTMLElement): boolean {
  if (element instanceof HTMLTextAreaElement && element.disabled) {
    return false;
  }

  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  if (element.hasAttribute("hidden")) {
    return false;
  }

  return true;
}

function setTextareaValue(textarea: HTMLTextAreaElement, prompt: string): void {
  const setter = Object.getOwnPropertyDescriptor(HTMLTextAreaElement.prototype, "value")?.set;
  if (setter) {
    setter.call(textarea, prompt);
  } else {
    textarea.value = prompt;
  }
  dispatchComposerInput(textarea, prompt);
}

function setEditableValue(element: HTMLElement, prompt: string): void {
  element.textContent = prompt;
  dispatchComposerInput(element, prompt);
}

function dispatchComposerInput(element: HTMLElement, prompt: string): void {
  if (typeof InputEvent === "function") {
    element.dispatchEvent(
      new InputEvent("input", { bubbles: true, inputType: "insertText", data: prompt })
    );
    return;
  }

  element.dispatchEvent(new Event("input", { bubbles: true }));
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
