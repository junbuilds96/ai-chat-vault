import { extractConversation, type ConversationExport } from "./extractor";
import {
  CAPTURE_RESPONSE_TYPE,
  type CaptureResponse,
  isCaptureRequest
} from "./messages";

const CHATGPT_MESSAGE_SELECTOR = "[data-message-author-role]";
const CAPTURE_SETTLE_TIMEOUT_MS = 1500;

export async function captureCurrentConversation(
  documentRef: Document = document
): Promise<ConversationExport> {
  return extractConversationAfterPageSettles(documentRef);
}

if (typeof chrome !== "undefined" && chrome.runtime?.onMessage) {
  chrome.runtime.onMessage.addListener((message, _sender, sendResponse) => {
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
