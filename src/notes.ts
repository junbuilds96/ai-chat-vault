export interface ConversationNoteTarget {
  title: string;
  url: string;
}

export const CONVERSATION_NOTES_STORAGE_KEY = "aiChatVaultConversationNotes";

type ChromeStorageLocal = Pick<chrome.storage.StorageArea, "get" | "set">;
type ConversationNotesByIdentity = Record<string, string>;

export async function loadConversationNote(conversation: ConversationNoteTarget): Promise<string> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return "";
  }

  try {
    const storedValue = await storageGet(storage, CONVERSATION_NOTES_STORAGE_KEY);
    const notes = normalizeConversationNotes(storedValue);
    return notes[conversationNoteIdentity(conversation)] ?? "";
  } catch {
    return "";
  }
}

export async function saveConversationNote(
  conversation: ConversationNoteTarget,
  note: string
): Promise<void> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return;
  }

  const storedValue = await storageGet(storage, CONVERSATION_NOTES_STORAGE_KEY).catch(() => ({}));
  const notes = normalizeConversationNotes(storedValue);
  notes[conversationNoteIdentity(conversation)] = note;

  await storageSet(storage, { [CONVERSATION_NOTES_STORAGE_KEY]: notes });
}

export function conversationNoteIdentity(conversation: ConversationNoteTarget): string {
  const urlIdentity = normalizedUrlIdentity(conversation.url);
  return sanitizeConversationIdentity(urlIdentity || conversation.title || "chatgpt-conversation");
}

export function sanitizeConversationIdentity(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");

  return sanitized || "chatgpt-conversation";
}

function normalizedUrlIdentity(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/g, "") || "/";
    return `${url.hostname}${pathname}`;
  } catch {
    return trimmed;
  }
}

function chromeStorageLocal(): ChromeStorageLocal | null {
  const maybeChrome = globalThis.chrome;
  return maybeChrome?.storage?.local ?? null;
}

function storageGet(storage: ChromeStorageLocal, key: string): Promise<unknown> {
  return new Promise((resolve, reject) => {
    storage.get(key, (items) => {
      const lastError = globalThis.chrome?.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve(items[key]);
    });
  });
}

function storageSet(
  storage: ChromeStorageLocal,
  items: Record<string, ConversationNotesByIdentity>
): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.set(items, () => {
      const lastError = globalThis.chrome?.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve();
    });
  });
}

function normalizeConversationNotes(value: unknown): ConversationNotesByIdentity {
  if (typeof value !== "object" || value === null || Array.isArray(value)) {
    return {};
  }

  return Object.fromEntries(
    Object.entries(value).flatMap(([identity, note]) => {
      const sanitizedIdentity = sanitizeConversationIdentity(identity);
      return typeof note === "string" ? [[sanitizedIdentity, note]] : [];
    })
  );
}
