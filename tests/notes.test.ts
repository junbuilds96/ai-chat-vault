import { afterEach, describe, expect, it, vi } from "vitest";
import {
  CONVERSATION_NOTES_STORAGE_KEY,
  conversationNoteIdentity,
  loadConversationNote,
  saveConversationNote
} from "../src/notes";

const conversation = {
  title: "Local Planning - ChatGPT",
  url: "https://chatgpt.com/c/Local-Planning?model=gpt-5#turn-3"
};

function installStorageMock(initialNotes: unknown = undefined) {
  const runtime: { lastError?: { message?: string } } = {};
  const store: Record<string, unknown> = {};
  if (initialNotes !== undefined) {
    store[CONVERSATION_NOTES_STORAGE_KEY] = initialNotes;
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

  return { get, set, store };
}

describe("conversation notes storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("keys notes by a sanitized conversation URL identity", () => {
    expect(conversationNoteIdentity(conversation)).toBe("chatgpt-com-c-local-planning");
    expect(
      conversationNoteIdentity({
        title: "Fallback Title / Notes",
        url: ""
      })
    ).toBe("fallback-title-notes");
  });

  it("loads a saved note for the same conversation identity", async () => {
    installStorageMock({
      "chatgpt-com-c-local-planning": "Check the migration plan again."
    });

    await expect(loadConversationNote(conversation)).resolves.toBe(
      "Check the migration plan again."
    );
  });

  it("saves a note without replacing notes for other conversations", async () => {
    const storage = installStorageMock({
      "chatgpt-com-c-other": "Keep this note."
    });

    await saveConversationNote(conversation, "Private follow-up");

    expect(storage.set).toHaveBeenCalledWith(
      {
        [CONVERSATION_NOTES_STORAGE_KEY]: {
          "chatgpt-com-c-other": "Keep this note.",
          "chatgpt-com-c-local-planning": "Private follow-up"
        }
      },
      expect.any(Function)
    );
    expect(storage.store[CONVERSATION_NOTES_STORAGE_KEY]).toEqual({
      "chatgpt-com-c-other": "Keep this note.",
      "chatgpt-com-c-local-planning": "Private follow-up"
    });
  });
});
