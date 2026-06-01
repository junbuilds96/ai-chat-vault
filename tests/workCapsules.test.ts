import { afterEach, describe, expect, it, vi } from "vitest";
import {
  WORK_CAPSULE_INDEX_KEY,
  WORK_CAPSULE_SCHEMA_VERSION,
  type WorkCapsuleV1,
  createWorkCapsule,
  deleteWorkCapsule,
  findMostRecentWorkCapsuleBySourceUrl,
  getWorkCapsule,
  listWorkCapsules,
  renderWorkCapsuleMarkdown,
  updateWorkCapsule,
  validateWorkCapsuleV1,
  workCapsuleBodyKey,
  workCapsuleSourceIdentity
} from "../src/workCapsules";

function capsule(overrides: Partial<WorkCapsuleV1> = {}): WorkCapsuleV1 {
  return {
    schemaVersion: WORK_CAPSULE_SCHEMA_VERSION,
    id: "capsule-1",
    title: "Launch Plan",
    goal: "Ship the first local-only work capsule.",
    reusableContext: ["Use Chrome local storage only."],
    decisions: [{ id: "decision-1", text: "Keep Week 1 UI out of scope." }],
    constraints: [{ id: "constraint-1", text: "Do not call network APIs." }],
    facts: [{ id: "fact-1", text: "The extension already captures ChatGPT turns." }],
    openQuestions: [{ id: "question-1", text: "Which popup affordance creates capsules later?" }],
    nextActions: [
      {
        id: "action-1",
        text: "Wire this into the popup flow.",
        status: "todo",
        owner: "user"
      }
    ],
    artifacts: [
      {
        id: "artifact-1",
        type: "spec",
        title: "Capsule schema",
        body: "Stable enough for Week 1 storage tests."
      }
    ],
    source: {
      provider: "chatgpt",
      title: "ChatGPT planning chat",
      url: "https://chatgpt.com/c/local-planning",
      selectedTurnIds: ["turn-1", "turn-2"]
    },
    sourceExcerptPolicy: "selected-excerpts",
    excerpts: [
      {
        id: "excerpt-1",
        turnId: "turn-1",
        role: "user",
        text: "Create a local schema."
      },
      {
        id: "excerpt-2",
        turnId: "turn-2",
        role: "assistant",
        text: "Keep storage local-only."
      }
    ],
    createdAt: "2026-06-01T00:00:00.000Z",
    updatedAt: "2026-06-01T00:00:00.000Z",
    ...overrides
  };
}

function installStorageMock(initialStore: Record<string, unknown> = {}) {
  const runtime: { lastError?: { message?: string } } = {};
  const store: Record<string, unknown> = { ...initialStore };

  const get = vi.fn((key: string, callback: (items: Record<string, unknown>) => void) => {
    callback({ [key]: store[key] });
  });
  const set = vi.fn((items: Record<string, unknown>, callback: () => void) => {
    Object.assign(store, items);
    callback();
  });
  const remove = vi.fn((key: string, callback: () => void) => {
    delete store[key];
    callback();
  });

  vi.stubGlobal("chrome", {
    runtime,
    storage: {
      local: { get, remove, set }
    }
  });

  return { get, remove, runtime, set, store };
}

describe("work capsule validation", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("accepts a valid v1 capsule", () => {
    expect(validateWorkCapsuleV1(capsule())).toEqual({ ok: true, capsule: capsule() });
  });

  it("reports missing required fields and unsupported enum values", () => {
    const result = validateWorkCapsuleV1({
      ...capsule(),
      schemaVersion: "work-capsule/v0",
      title: "",
      source: {
        ...capsule().source,
        provider: "other"
      },
      sourceExcerptPolicy: "all",
      nextActions: [{ id: "action-1", text: "Do work", status: "blocked", owner: "robot" }],
      artifacts: [{ id: "artifact-1", type: "note", title: "Bad", body: "Nope" }],
      excerpts: [{ id: "excerpt-1", turnId: "turn-1", role: "developer", text: "Nope" }]
    });

    expect(result.ok).toBe(false);
    if (!result.ok) {
      expect(result.errors).toEqual(
        expect.arrayContaining([
          "schemaVersion must be work-capsule/v1",
          "title must be a non-empty string",
          "source.provider must be one of chatgpt",
          "sourceExcerptPolicy must be one of none, selected-excerpts",
          "nextActions[0].status must be one of todo, doing, done",
          "nextActions[0].owner must be one of user, ai, unknown",
          "artifacts[0].type must be one of spec, prompt, checklist, decision-record, research-brief, other",
          "excerpts[0].role must be one of user, assistant, system, unknown"
        ])
      );
    }
  });
});

describe("work capsule markdown", () => {
  it("renders deterministic representative output", () => {
    expect(renderWorkCapsuleMarkdown(capsule())).toBe(`## Title

Launch Plan

## Goal

Ship the first local-only work capsule.

## Reusable Context

- Use Chrome local storage only.

## Decisions

- Keep Week 1 UI out of scope.

## Constraints

- Do not call network APIs.

## Facts

- The extension already captures ChatGPT turns.

## Open Questions

- Which popup affordance creates capsules later?

## Next Actions

- [todo] @user Wire this into the popup flow.

## Artifacts

- Capsule schema (spec)
  Stable enough for Week 1 storage tests.

## Source

- Title: ChatGPT planning chat
- URL: https://chatgpt.com/c/local-planning
- Selected turn IDs: turn-1, turn-2
- Selected excerpts:
  - turn-1 (user): Create a local schema.
  - turn-2 (assistant): Keep storage local-only.
`);
  });

  it("renders empty arrays as None and omits excerpts when policy is none", () => {
    expect(
      renderWorkCapsuleMarkdown(
        capsule({
          reusableContext: [],
          decisions: [],
          constraints: [],
          facts: [],
          openQuestions: [],
          nextActions: [],
          artifacts: [],
          sourceExcerptPolicy: "none",
          excerpts: []
        })
      )
    ).toContain(`## Reusable Context

- None`);
    expect(
      renderWorkCapsuleMarkdown(
        capsule({
          reusableContext: [],
          decisions: [],
          constraints: [],
          facts: [],
          openQuestions: [],
          nextActions: [],
          artifacts: [],
          sourceExcerptPolicy: "none",
          excerpts: []
        })
      )
    ).not.toContain("Selected excerpts");
  });
});

describe("work capsule storage", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("creates, lists, gets, updates, and deletes capsules in chrome.storage.local", async () => {
    const storage = installStorageMock();
    const original = capsule();

    await expect(createWorkCapsule(original)).resolves.toEqual(original);
    expect(storage.store[workCapsuleBodyKey("capsule-1")]).toEqual(original);
    expect(storage.store[WORK_CAPSULE_INDEX_KEY]).toEqual([
      {
        id: "capsule-1",
        title: "Launch Plan",
        goal: "Ship the first local-only work capsule.",
        sourceTitle: "ChatGPT planning chat",
        sourceUrl: "https://chatgpt.com/c/local-planning",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T00:00:00.000Z"
      }
    ]);

    await expect(listWorkCapsules()).resolves.toEqual(storage.store[WORK_CAPSULE_INDEX_KEY]);
    await expect(getWorkCapsule("capsule-1")).resolves.toEqual(original);

    const updated = await updateWorkCapsule("capsule-1", {
      title: "Updated Launch Plan",
      updatedAt: "2026-06-01T02:00:00.000Z"
    });

    expect(updated?.title).toBe("Updated Launch Plan");
    expect(updated?.updatedAt).toBe("2026-06-01T02:00:00.000Z");
    expect(storage.store[workCapsuleBodyKey("capsule-1")]).toEqual(updated);
    expect(storage.store[WORK_CAPSULE_INDEX_KEY]).toEqual([
      {
        id: "capsule-1",
        title: "Updated Launch Plan",
        goal: "Ship the first local-only work capsule.",
        sourceTitle: "ChatGPT planning chat",
        sourceUrl: "https://chatgpt.com/c/local-planning",
        createdAt: "2026-06-01T00:00:00.000Z",
        updatedAt: "2026-06-01T02:00:00.000Z"
      }
    ]);

    await deleteWorkCapsule("capsule-1");
    expect(storage.store[workCapsuleBodyKey("capsule-1")]).toBeUndefined();
    expect(storage.store[WORK_CAPSULE_INDEX_KEY]).toEqual([]);
    expect(storage.remove).toHaveBeenCalledWith(workCapsuleBodyKey("capsule-1"), expect.any(Function));
  });

  it("refreshes updatedAt on update when the patch does not supply it", async () => {
    installStorageMock();
    vi.useFakeTimers();
    vi.setSystemTime(new Date("2026-06-01T03:00:00.000Z"));

    await createWorkCapsule(capsule());
    await expect(updateWorkCapsule("capsule-1", { goal: "Updated goal" })).resolves.toMatchObject({
      goal: "Updated goal",
      updatedAt: "2026-06-01T03:00:00.000Z"
    });

    vi.useRealTimers();
  });

  it("finds the newest valid capsule for a source URL while ignoring query and hash", async () => {
    installStorageMock();
    const older = capsule({
      id: "capsule-older",
      title: "Older Capsule",
      source: {
        ...capsule().source,
        url: "https://chatgpt.com/c/local-planning?model=gpt-4"
      },
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T01:00:00.000Z"
    });
    const newest = capsule({
      id: "capsule-newest",
      title: "Newest Capsule",
      source: {
        ...capsule().source,
        url: "https://chatgpt.com/c/local-planning/#work"
      },
      createdAt: "2026-06-01T00:30:00.000Z",
      updatedAt: "2026-06-01T03:00:00.000Z"
    });
    const otherConversation = capsule({
      id: "capsule-other",
      title: "Other Conversation",
      source: {
        ...capsule().source,
        url: "https://chatgpt.com/c/other-planning"
      },
      createdAt: "2026-06-01T00:00:00.000Z",
      updatedAt: "2026-06-01T04:00:00.000Z"
    });

    await createWorkCapsule(older);
    await createWorkCapsule(newest);
    await createWorkCapsule(otherConversation);

    await expect(
      findMostRecentWorkCapsuleBySourceUrl("https://chatgpt.com/c/local-planning?model=gpt-5#latest")
    ).resolves.toEqual(newest);
  });

  it("skips stale index entries and invalid capsule bodies during source URL lookup", async () => {
    const storage = installStorageMock({
      [WORK_CAPSULE_INDEX_KEY]: [
        {
          id: "missing-body",
          title: "Missing Body",
          goal: "Ignore this entry.",
          sourceTitle: "ChatGPT planning chat",
          sourceUrl: "https://chatgpt.com/c/local-planning",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T05:00:00.000Z"
        },
        {
          id: "invalid-body",
          title: "Invalid Body",
          goal: "Ignore this invalid capsule.",
          sourceTitle: "ChatGPT planning chat",
          sourceUrl: "https://chatgpt.com/c/local-planning",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T04:00:00.000Z"
        },
        {
          id: "valid-body",
          title: "Valid Body",
          goal: "Use this capsule.",
          sourceTitle: "ChatGPT planning chat",
          sourceUrl: "https://chatgpt.com/c/local-planning",
          createdAt: "2026-06-01T00:00:00.000Z",
          updatedAt: "2026-06-01T03:00:00.000Z"
        }
      ],
      [workCapsuleBodyKey("invalid-body")]: { ...capsule(), id: "invalid-body", title: "" },
      [workCapsuleBodyKey("valid-body")]: capsule({
        id: "valid-body",
        title: "Valid Body",
        goal: "Use this capsule.",
        source: {
          ...capsule().source,
          url: "https://chatgpt.com/c/local-planning?model=gpt-5"
        },
        updatedAt: "2026-06-01T03:00:00.000Z"
      })
    });

    await expect(
      findMostRecentWorkCapsuleBySourceUrl("https://chatgpt.com/c/local-planning#thread")
    ).resolves.toEqual(storage.store[workCapsuleBodyKey("valid-body")]);
  });

  it("normalizes source URL identities without query strings, hash fragments, or trailing slashes", () => {
    expect(workCapsuleSourceIdentity(" https://chatgpt.com/c/local-planning/?model=gpt-5#work ")).toBe(
      "chatgpt.com/c/local-planning"
    );
    expect(workCapsuleSourceIdentity("https://chatgpt.com/c/local-planning")).toBe(
      "chatgpt.com/c/local-planning"
    );
    expect(workCapsuleSourceIdentity("not a url  with  spaces")).toBe("not a url with spaces");
  });

  it("does not use fetch or XMLHttpRequest while using storage helpers", async () => {
    installStorageMock();
    const fetchMock = vi.fn(() => {
      throw new Error("network unavailable");
    });
    const xhrMock = vi.fn(() => {
      throw new Error("network unavailable");
    });

    vi.stubGlobal("fetch", fetchMock);
    vi.stubGlobal("XMLHttpRequest", xhrMock);

    await createWorkCapsule(capsule());
    await listWorkCapsules();
    await getWorkCapsule("capsule-1");
    await updateWorkCapsule("capsule-1", { title: "Still local" });
    await deleteWorkCapsule("capsule-1");

    expect(fetchMock).not.toHaveBeenCalled();
    expect(xhrMock).not.toHaveBeenCalled();
  });
});
