import { afterEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_PROMPT_SNIPPETS,
  PROMPT_SNIPPETS_STORAGE_KEY,
  loadPromptSnippets,
  savePromptSnippets
} from "../src/prompts";

function installStorageMock(initialValue: unknown = undefined) {
  const runtime: { lastError?: { message?: string } } = {};
  const store: Record<string, unknown> = {};
  if (initialValue !== undefined) {
    store[PROMPT_SNIPPETS_STORAGE_KEY] = initialValue;
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

describe("prompt snippets storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("falls back to defaults when chrome storage is unavailable", async () => {
    vi.stubGlobal("chrome", undefined);

    await expect(loadPromptSnippets()).resolves.toEqual(DEFAULT_PROMPT_SNIPPETS);
  });

  it("loads valid snippets from chrome.storage.local", async () => {
    installStorageMock([
      { id: " custom ", title: " /custom ", body: "Use a custom local prompt." },
      { id: "", title: "/bad", body: "ignored" }
    ]);

    await expect(loadPromptSnippets()).resolves.toEqual([
      { id: "custom", title: "/custom", body: "Use a custom local prompt." }
    ]);
  });

  it("saves defaults when stored snippets are missing or invalid", async () => {
    const storage = installStorageMock([{ id: "bad", title: "/bad", body: "" }]);

    await expect(loadPromptSnippets()).resolves.toEqual(DEFAULT_PROMPT_SNIPPETS);

    expect(storage.set).toHaveBeenCalledWith(
      { [PROMPT_SNIPPETS_STORAGE_KEY]: DEFAULT_PROMPT_SNIPPETS },
      expect.any(Function)
    );
  });

  it("saves normalized prompt snippets", async () => {
    const storage = installStorageMock();

    await savePromptSnippets([
      { id: " debug ", title: " /debug ", body: "Debug this." },
      { id: "", title: "/bad", body: "ignored" }
    ]);

    expect(storage.store[PROMPT_SNIPPETS_STORAGE_KEY]).toEqual([
      { id: "debug", title: "/debug", body: "Debug this." }
    ]);
  });
});
