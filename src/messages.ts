import type { ConversationExport } from "./extractor";

export const CHATGPT_HOSTS = new Set(["chatgpt.com", "chat.openai.com"]);

export const CAPTURE_REQUEST_TYPE = "AI_CHAT_VAULT_CAPTURE";
export const CAPTURE_RESPONSE_TYPE = "AI_CHAT_VAULT_CAPTURE_RESULT";
export const INSERT_PROMPT_REQUEST_TYPE = "AI_CHAT_VAULT_INSERT_PROMPT";
export const INSERT_PROMPT_RESPONSE_TYPE = "AI_CHAT_VAULT_INSERT_PROMPT_RESULT";

export interface CaptureRequest {
  type: typeof CAPTURE_REQUEST_TYPE;
}

export interface CaptureResponse {
  type: typeof CAPTURE_RESPONSE_TYPE;
  conversation: ConversationExport;
}

export interface InsertPromptRequest {
  type: typeof INSERT_PROMPT_REQUEST_TYPE;
  prompt: string;
}

export interface InsertPromptResponse {
  type: typeof INSERT_PROMPT_RESPONSE_TYPE;
  inserted: boolean;
}

export function isCaptureRequest(message: unknown): message is CaptureRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === CAPTURE_REQUEST_TYPE
  );
}

export function isInsertPromptRequest(message: unknown): message is InsertPromptRequest {
  return (
    typeof message === "object" &&
    message !== null &&
    "type" in message &&
    message.type === INSERT_PROMPT_REQUEST_TYPE &&
    "prompt" in message &&
    typeof message.prompt === "string"
  );
}

export function isSupportedChatGptHost(hostname: string): boolean {
  return CHATGPT_HOSTS.has(hostname);
}
