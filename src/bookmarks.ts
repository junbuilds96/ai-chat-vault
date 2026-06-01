export interface ConversationBookmark {
  id: string;
  title: string;
  url: string;
  savedAt: string;
}

export const CONVERSATION_BOOKMARKS_STORAGE_KEY = "aiChatVaultConversationBookmarks";

type ChromeStorageLocal = Pick<chrome.storage.StorageArea, "get" | "set">;

export async function loadConversationBookmarks(): Promise<ConversationBookmark[]> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return [];
  }

  try {
    const storedValue = await storageGet(storage, CONVERSATION_BOOKMARKS_STORAGE_KEY);
    return normalizeConversationBookmarks(storedValue);
  } catch {
    return [];
  }
}

export async function saveConversationBookmarks(
  bookmarks: ConversationBookmark[]
): Promise<void> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return;
  }

  await storageSet(storage, {
    [CONVERSATION_BOOKMARKS_STORAGE_KEY]: normalizeConversationBookmarks(bookmarks)
  });
}

export async function upsertConversationBookmark(
  bookmark: ConversationBookmark
): Promise<ConversationBookmark[]> {
  const bookmarks = await loadConversationBookmarks();
  const normalizedBookmark = normalizeConversationBookmarks([bookmark])[0];
  if (!normalizedBookmark) {
    await saveConversationBookmarks(bookmarks);
    return bookmarks;
  }

  const updated = normalizeConversationBookmarks([
    normalizedBookmark,
    ...bookmarks.filter((item) => item.id !== normalizedBookmark.id)
  ]);
  await saveConversationBookmarks(updated);
  return updated;
}

export async function deleteConversationBookmark(id: string): Promise<ConversationBookmark[]> {
  const sanitizedId = sanitizeBookmarkId(id);
  const bookmarks = (await loadConversationBookmarks()).filter(
    (bookmark) => bookmark.id !== sanitizedId
  );
  await saveConversationBookmarks(bookmarks);
  return bookmarks;
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
  items: Record<string, ConversationBookmark[]>
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

function normalizeConversationBookmarks(value: unknown): ConversationBookmark[] {
  if (!Array.isArray(value)) {
    return [];
  }

  const bookmarks = value.flatMap((bookmark) => {
    if (typeof bookmark !== "object" || bookmark === null) {
      return [];
    }

    const item = bookmark as Record<string, unknown>;
    const id = typeof item.id === "string" ? sanitizeBookmarkId(item.id) : "";
    const title = typeof item.title === "string" ? sanitizeBookmarkTitle(item.title) : "";
    const url = typeof item.url === "string" ? sanitizeBookmarkUrl(item.url) : "";
    const savedAt = typeof item.savedAt === "string" ? sanitizeSavedAt(item.savedAt) : "";

    if (!id || !url || !savedAt) {
      return [];
    }

    return [{ id, title: title || url, url, savedAt }];
  });

  return bookmarks.sort((first, second) => second.savedAt.localeCompare(first.savedAt));
}

function sanitizeBookmarkId(value: string): string {
  const sanitized = value
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 120)
    .replace(/-+$/g, "");

  return sanitized;
}

function sanitizeBookmarkTitle(value: string): string {
  return value.trim().replace(/\s+/g, " ").slice(0, 160);
}

function sanitizeBookmarkUrl(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    return url.href;
  } catch {
    return "";
  }
}

function sanitizeSavedAt(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  const timestamp = Date.parse(trimmed);
  return Number.isNaN(timestamp) ? "" : new Date(timestamp).toISOString();
}
