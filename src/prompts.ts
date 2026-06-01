export interface PromptSnippet {
  id: string;
  title: string;
  body: string;
}

export const PROMPT_SNIPPETS_STORAGE_KEY = "aiChatVaultPromptSnippets";

export const DEFAULT_PROMPT_SNIPPETS: PromptSnippet[] = [
  {
    id: "summarize",
    title: "/summarize",
    body: "Summarize this conversation into decisions, open questions, and next actions."
  },
  {
    id: "improve",
    title: "/improve",
    body: "Rewrite the following prompt for clarity, constraints, and testable output:\n\n"
  },
  {
    id: "debug",
    title: "/debug",
    body: "Act as a senior engineer. Diagnose the issue using hypotheses, evidence to collect, and the smallest safe fix."
  }
];

type ChromeStorageLocal = Pick<chrome.storage.StorageArea, "get" | "set">;

export async function loadPromptSnippets(): Promise<PromptSnippet[]> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return defaultPromptSnippets();
  }

  try {
    const storedValue = await storageGet(storage, PROMPT_SNIPPETS_STORAGE_KEY);
    const snippets = normalizePromptSnippets(storedValue);
    if (snippets.length > 0) {
      return snippets;
    }

    const defaults = defaultPromptSnippets();
    await storageSet(storage, { [PROMPT_SNIPPETS_STORAGE_KEY]: defaults });
    return defaults;
  } catch {
    return defaultPromptSnippets();
  }
}

export async function savePromptSnippets(snippets: PromptSnippet[]): Promise<void> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return;
  }

  const normalized = normalizePromptSnippets(snippets);
  await storageSet(storage, {
    [PROMPT_SNIPPETS_STORAGE_KEY]: normalized.length > 0 ? normalized : defaultPromptSnippets()
  });
}

export function defaultPromptSnippets(): PromptSnippet[] {
  return DEFAULT_PROMPT_SNIPPETS.map((snippet) => ({ ...snippet }));
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
  items: Record<string, PromptSnippet[]>
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

function normalizePromptSnippets(value: unknown): PromptSnippet[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.flatMap((snippet) => {
    if (!isPromptSnippet(snippet)) {
      return [];
    }

    return [
      {
        id: snippet.id.trim(),
        title: snippet.title.trim(),
        body: snippet.body
      }
    ];
  });
}

function isPromptSnippet(value: unknown): value is PromptSnippet {
  if (typeof value !== "object" || value === null) {
    return false;
  }

  const snippet = value as Record<string, unknown>;
  return (
    typeof snippet.id === "string" &&
    snippet.id.trim().length > 0 &&
    typeof snippet.title === "string" &&
    snippet.title.trim().length > 0 &&
    typeof snippet.body === "string" &&
    snippet.body.length > 0
  );
}
