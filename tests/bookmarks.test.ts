import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONVERSATION_BOOKMARKS_STORAGE_KEY,
  deleteConversationBookmark,
  loadConversationBookmarks,
  saveConversationBookmarks,
  upsertConversationBookmark
} from "../src/bookmarks";

function installStorageMock(initialValue: unknown = undefined) {
  const runtime: { lastError?: { message?: string } } = {};
  const store: Record<string, unknown> = {};
  if (initialValue !== undefined) {
    store[CONVERSATION_BOOKMARKS_STORAGE_KEY] = initialValue;
  }

  const get = vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
    callback({ [key]: store[key] });
  });
  const set = vi.fn((items: Record<string, unknown>, callback: () => void) => {
    Object.assign(store, items);
    callback();
  });

  vi.stubGlobal("chrome", {
    runtime,
    storage: {
      local: { get, set }
    }
  });

  return { get, runtime, set, store };
}

describe("conversation bookmarks storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to an empty list when chrome storage is unavailable", async () => {
    vi.stubGlobal("chrome", undefined);

    await expect(loadConversationBookmarks()).resolves.toEqual([]);
  });

  it("loads normalized valid bookmarks and drops invalid records", async () => {
    installStorageMock([
      {
        id: " ChatGPT.com / C / First ",
        title: " First   bookmark ",
        url: " https://chatgpt.com/c/first ",
        savedAt: "2026-06-01T01:00:00.000Z"
      },
      {
        id: "second",
        title: "",
        url: "https://chatgpt.com/c/second",
        savedAt: "2026-06-01T02:00:00.000Z"
      },
      { id: "bad-url", title: "Bad", url: "not a url", savedAt: "2026-06-01T03:00:00.000Z" },
      { id: "bad-date", title: "Bad", url: "https://chatgpt.com/c/bad", savedAt: "nope" }
    ]);

    await expect(loadConversationBookmarks()).resolves.toEqual([
      {
        id: "second",
        title: "https://chatgpt.com/c/second",
        url: "https://chatgpt.com/c/second",
        savedAt: "2026-06-01T02:00:00.000Z"
      },
      {
        id: "chatgpt-com-c-first",
        title: "First bookmark",
        url: "https://chatgpt.com/c/first",
        savedAt: "2026-06-01T01:00:00.000Z"
      }
    ]);
  });

  it("saves normalized bookmarks to chrome.storage.local", async () => {
    const storage = installStorageMock();

    await saveConversationBookmarks([
      {
        id: " Local Planning ",
        title: " Local   Planning ",
        url: " https://chatgpt.com/c/local-planning ",
        savedAt: "2026-06-01T04:00:00.000Z"
      },
      {
        id: "",
        title: "Ignored",
        url: "https://chatgpt.com/c/ignored",
        savedAt: "2026-06-01T05:00:00.000Z"
      }
    ]);

    expect(storage.store[CONVERSATION_BOOKMARKS_STORAGE_KEY]).toEqual([
      {
        id: "local-planning",
        title: "Local Planning",
        url: "https://chatgpt.com/c/local-planning",
        savedAt: "2026-06-01T04:00:00.000Z"
      }
    ]);
  });

  it("upserts bookmarks by id without replacing other saved links", async () => {
    const storage = installStorageMock([
      {
        id: "other",
        title: "Other",
        url: "https://chatgpt.com/c/other",
        savedAt: "2026-06-01T01:00:00.000Z"
      },
      {
        id: "current",
        title: "Old title",
        url: "https://chatgpt.com/c/current",
        savedAt: "2026-06-01T02:00:00.000Z"
      }
    ]);

    await expect(
      upsertConversationBookmark({
        id: "current",
        title: "Current",
        url: "https://chatgpt.com/c/current",
        savedAt: "2026-06-01T03:00:00.000Z"
      })
    ).resolves.toEqual([
      {
        id: "current",
        title: "Current",
        url: "https://chatgpt.com/c/current",
        savedAt: "2026-06-01T03:00:00.000Z"
      },
      {
        id: "other",
        title: "Other",
        url: "https://chatgpt.com/c/other",
        savedAt: "2026-06-01T01:00:00.000Z"
      }
    ]);

    expect(storage.store[CONVERSATION_BOOKMARKS_STORAGE_KEY]).toEqual([
      {
        id: "current",
        title: "Current",
        url: "https://chatgpt.com/c/current",
        savedAt: "2026-06-01T03:00:00.000Z"
      },
      {
        id: "other",
        title: "Other",
        url: "https://chatgpt.com/c/other",
        savedAt: "2026-06-01T01:00:00.000Z"
      }
    ]);
  });

  it("deletes bookmarks by sanitized id", async () => {
    const storage = installStorageMock([
      {
        id: "current",
        title: "Current",
        url: "https://chatgpt.com/c/current",
        savedAt: "2026-06-01T03:00:00.000Z"
      },
      {
        id: "other",
        title: "Other",
        url: "https://chatgpt.com/c/other",
        savedAt: "2026-06-01T01:00:00.000Z"
      }
    ]);

    await expect(deleteConversationBookmark(" Current ")).resolves.toEqual([
      {
        id: "other",
        title: "Other",
        url: "https://chatgpt.com/c/other",
        savedAt: "2026-06-01T01:00:00.000Z"
      }
    ]);

    expect(storage.store[CONVERSATION_BOOKMARKS_STORAGE_KEY]).toEqual([
      {
        id: "other",
        title: "Other",
        url: "https://chatgpt.com/c/other",
        savedAt: "2026-06-01T01:00:00.000Z"
      }
    ]);
  });
});
