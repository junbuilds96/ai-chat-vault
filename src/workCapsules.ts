export const WORK_CAPSULE_SCHEMA_VERSION = "work-capsule/v1";
export const WORK_CAPSULE_INDEX_KEY = "workCapsules:v1";

export type WorkCapsuleSourceProvider = "chatgpt";
export type WorkCapsuleActionStatus = "todo" | "doing" | "done";
export type WorkCapsuleActionOwner = "user" | "ai" | "unknown";
export type WorkCapsuleArtifactType =
  | "spec"
  | "prompt"
  | "checklist"
  | "decision-record"
  | "research-brief"
  | "other";
export type WorkCapsuleSourceExcerptPolicy = "none" | "selected-excerpts";
export type WorkCapsuleExcerptRole = "user" | "assistant" | "system" | "unknown";

export interface WorkCapsuleItem {
  id: string;
  text: string;
}

export interface WorkCapsuleAction {
  id: string;
  text: string;
  status: WorkCapsuleActionStatus;
  owner?: WorkCapsuleActionOwner;
}

export interface WorkCapsuleArtifact {
  id: string;
  type: WorkCapsuleArtifactType;
  title: string;
  body: string;
}

export interface WorkCapsuleExcerpt {
  id: string;
  turnId: string;
  role: WorkCapsuleExcerptRole;
  text: string;
}

export interface WorkCapsuleSource {
  provider: WorkCapsuleSourceProvider;
  title: string;
  url: string;
  selectedTurnIds: string[];
}

export interface WorkCapsuleV1 {
  schemaVersion: typeof WORK_CAPSULE_SCHEMA_VERSION;
  id: string;
  title: string;
  goal: string;
  contextPrompt: string;
  reusableContext: string[];
  decisions: WorkCapsuleItem[];
  constraints: WorkCapsuleItem[];
  facts: WorkCapsuleItem[];
  openQuestions: WorkCapsuleItem[];
  nextActions: WorkCapsuleAction[];
  artifacts: WorkCapsuleArtifact[];
  source: WorkCapsuleSource;
  sourceExcerptPolicy: WorkCapsuleSourceExcerptPolicy;
  excerpts: WorkCapsuleExcerpt[];
  createdAt: string;
  updatedAt: string;
}

export type WorkCapsuleContextPromptSource = Omit<WorkCapsuleV1, "contextPrompt"> & {
  contextPrompt?: string;
};

export interface WorkCapsuleIndexItem {
  id: string;
  title: string;
  project?: string;
  goal: string;
  sourceTitle: string;
  sourceUrl: string;
  createdAt: string;
  updatedAt: string;
}

type ChromeStorageLocal = Pick<chrome.storage.StorageArea, "get" | "remove" | "set">;
type WorkCapsuleValidationResult =
  | { ok: true; capsule: WorkCapsuleV1 }
  | { ok: false; errors: string[] };

const ACTION_STATUSES = new Set<WorkCapsuleActionStatus>(["todo", "doing", "done"]);
const ACTION_OWNERS = new Set<WorkCapsuleActionOwner>(["user", "ai", "unknown"]);
const ARTIFACT_TYPES = new Set<WorkCapsuleArtifactType>([
  "spec",
  "prompt",
  "checklist",
  "decision-record",
  "research-brief",
  "other"
]);
const SOURCE_EXCERPT_POLICIES = new Set<WorkCapsuleSourceExcerptPolicy>([
  "none",
  "selected-excerpts"
]);
const EXCERPT_ROLES = new Set<WorkCapsuleExcerptRole>([
  "user",
  "assistant",
  "system",
  "unknown"
]);

export function workCapsuleBodyKey(id: string): string {
  return `workCapsule:v1:${id}`;
}

export function validateWorkCapsuleV1(value: unknown): WorkCapsuleValidationResult {
  const errors: string[] = [];

  if (!isRecord(value)) {
    return { ok: false, errors: ["capsule must be an object"] };
  }

  const normalizedValue: Record<string, unknown> = { ...value };
  const hasContextPrompt = Object.prototype.hasOwnProperty.call(value, "contextPrompt");

  requireExactString(value, "schemaVersion", WORK_CAPSULE_SCHEMA_VERSION, errors);
  requireString(value, "id", errors);
  requireString(value, "title", errors);
  requireString(value, "goal", errors);
  if (hasContextPrompt) {
    requireString(value, "contextPrompt", errors);
  }
  requireString(value, "createdAt", errors);
  requireString(value, "updatedAt", errors);
  validateStringArray(value, "reusableContext", errors);
  validateItemArray(value, "decisions", errors);
  validateItemArray(value, "constraints", errors);
  validateItemArray(value, "facts", errors);
  validateItemArray(value, "openQuestions", errors);
  validateActionArray(value, "nextActions", errors);
  validateArtifactArray(value, "artifacts", errors);
  validateSource(value.source, errors);
  validateEnumValue(
    value.sourceExcerptPolicy,
    "sourceExcerptPolicy",
    SOURCE_EXCERPT_POLICIES,
    errors
  );
  validateExcerptArray(value, "excerpts", errors);

  if (!hasContextPrompt && errors.length === 0) {
    normalizedValue.contextPrompt = buildWorkCapsuleContextPrompt(
      normalizedValue as WorkCapsuleContextPromptSource
    );
  }

  if (errors.length > 0) {
    return { ok: false, errors };
  }

  return { ok: true, capsule: normalizedValue as unknown as WorkCapsuleV1 };
}

export function assertWorkCapsuleV1(value: unknown): WorkCapsuleV1 {
  const result = validateWorkCapsuleV1(value);
  if (!result.ok) {
    throw new Error(result.errors.join("\n"));
  }

  return result.capsule;
}

export function renderWorkCapsuleMarkdown(capsule: WorkCapsuleV1): string {
  const sections = [
    renderScalarSection("Title", capsule.title),
    renderScalarSection("Goal", capsule.goal),
    renderScalarSection("Context Prompt", capsule.contextPrompt),
    renderStringListSection("Reusable Context", capsule.reusableContext),
    renderItemSection("Decisions", capsule.decisions),
    renderItemSection("Constraints", capsule.constraints),
    renderItemSection("Facts", capsule.facts),
    renderItemSection("Open Questions", capsule.openQuestions),
    renderActionSection("Next Actions", capsule.nextActions),
    renderArtifactSection("Artifacts", capsule.artifacts),
    renderSourceSection(capsule)
  ];

  return `${sections.join("\n\n")}\n`;
}

export function buildWorkCapsuleContextPrompt(
  capsule: WorkCapsuleContextPromptSource
): string {
  const lines = [
    "Use this Work Capsule to continue the work in a new AI chat.",
    "",
    `Title: ${compactPromptText(capsule.title, 160)}`,
    `Goal: ${compactPromptText(capsule.goal, 400)}`
  ];

  appendStringPromptSection(lines, "Reusable context", capsule.reusableContext);
  appendItemPromptSection(lines, "Decisions", capsule.decisions);
  appendItemPromptSection(lines, "Constraints", capsule.constraints);
  appendItemPromptSection(lines, "Facts", capsule.facts);
  appendItemPromptSection(lines, "Open questions", capsule.openQuestions);
  appendActionPromptSection(lines, capsule.nextActions);
  appendArtifactPromptSection(lines, capsule.artifacts);

  if (capsule.sourceExcerptPolicy === "selected-excerpts") {
    appendExcerptPromptSection(lines, capsule.excerpts);
  }

  return lines.join("\n").trim();
}

export async function createWorkCapsule(capsule: WorkCapsuleV1): Promise<WorkCapsuleV1> {
  const validated = assertWorkCapsuleV1(capsule);
  const storage = chromeStorageLocal();
  if (!storage) {
    return validated;
  }

  const index = await loadWorkCapsuleIndex(storage);
  const metadata = workCapsuleIndexItem(validated);
  const nextIndex = [metadata, ...index.filter((item) => item.id !== validated.id)].sort(
    compareIndexItems
  );

  await storageSet(storage, {
    [workCapsuleBodyKey(validated.id)]: validated,
    [WORK_CAPSULE_INDEX_KEY]: nextIndex
  });

  return validated;
}

export async function getWorkCapsule(id: string): Promise<WorkCapsuleV1 | null> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return null;
  }

  const storedValue = await storageGet(storage, workCapsuleBodyKey(id)).catch(() => null);
  const result = validateWorkCapsuleV1(storedValue);
  return result.ok ? result.capsule : null;
}

export async function listWorkCapsules(): Promise<WorkCapsuleIndexItem[]> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return [];
  }

  return loadWorkCapsuleIndex(storage);
}

export async function findMostRecentWorkCapsuleBySourceUrl(
  sourceUrl: string
): Promise<WorkCapsuleV1 | null> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return null;
  }

  const sourceIdentity = workCapsuleSourceIdentity(sourceUrl);
  if (!sourceIdentity) {
    return null;
  }

  const matchingIndexItems = (await loadWorkCapsuleIndex(storage)).filter(
    (item) => workCapsuleSourceIdentity(item.sourceUrl) === sourceIdentity
  );

  for (const item of matchingIndexItems) {
    const storedValue = await storageGet(storage, workCapsuleBodyKey(item.id)).catch(() => null);
    const result = validateWorkCapsuleV1(storedValue);
    if (result.ok && workCapsuleSourceIdentity(result.capsule.source.url) === sourceIdentity) {
      return result.capsule;
    }
  }

  return null;
}

export function workCapsuleSourceIdentity(sourceUrl: string): string {
  const trimmed = sourceUrl.trim();
  if (!trimmed) {
    return "";
  }

  try {
    const url = new URL(trimmed);
    const pathname = url.pathname.replace(/\/+$/g, "") || "/";
    return compactString(`${url.hostname}${pathname}`).toLowerCase();
  } catch {
    return compactString(trimmed).toLowerCase();
  }
}

export async function updateWorkCapsule(
  id: string,
  patch: Partial<WorkCapsuleV1>
): Promise<WorkCapsuleV1 | null> {
  const existing = await getWorkCapsule(id);
  if (!existing) {
    return null;
  }

  const updated = assertWorkCapsuleV1({
    ...existing,
    ...patch,
    id: existing.id,
    schemaVersion: WORK_CAPSULE_SCHEMA_VERSION,
    updatedAt: patch.updatedAt ?? new Date().toISOString()
  });

  await createWorkCapsule(updated);
  return updated;
}

export async function deleteWorkCapsule(id: string): Promise<void> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return;
  }

  const index = await loadWorkCapsuleIndex(storage);
  await storageSet(storage, {
    [WORK_CAPSULE_INDEX_KEY]: index.filter((item) => item.id !== id)
  });
  await storageRemove(storage, workCapsuleBodyKey(id));
}

function renderScalarSection(title: string, value: string): string {
  return `## ${title}\n\n${value}`;
}

function renderStringListSection(title: string, items: string[]): string {
  return renderListSection(
    title,
    items.map((item) => `- ${item}`)
  );
}

function renderItemSection(title: string, items: WorkCapsuleItem[]): string {
  return renderListSection(
    title,
    items.map((item) => `- ${item.text}`)
  );
}

function renderActionSection(title: string, actions: WorkCapsuleAction[]): string {
  return renderListSection(
    title,
    actions.map((action) => {
      const owner = action.owner ? ` @${action.owner}` : "";
      return `- [${action.status}]${owner} ${action.text}`;
    })
  );
}

function renderArtifactSection(title: string, artifacts: WorkCapsuleArtifact[]): string {
  return renderListSection(
    title,
    artifacts.map((artifact) => {
      const body = artifact.body.trim();
      const suffix = body ? `\n  ${body.replace(/\n/g, "\n  ")}` : "";
      return `- ${artifact.title} (${artifact.type})${suffix}`;
    })
  );
}

function renderSourceSection(capsule: WorkCapsuleV1): string {
  const lines = [
    `- Title: ${capsule.source.title}`,
    `- URL: ${capsule.source.url}`,
    `- Selected turn IDs: ${capsule.source.selectedTurnIds.join(", ") || "None"}`
  ];

  if (capsule.sourceExcerptPolicy === "selected-excerpts") {
    lines.push("- Selected excerpts:");
    if (capsule.excerpts.length === 0) {
      lines.push("  - None");
    } else {
      lines.push(
        ...capsule.excerpts.map((excerpt) => {
          const text = excerpt.text.replace(/\n/g, "\n    ");
          return `  - ${excerpt.turnId} (${excerpt.role}): ${text}`;
        })
      );
    }
  }

  return `## Source\n\n${lines.join("\n")}`;
}

function renderListSection(title: string, lines: string[]): string {
  return `## ${title}\n\n${lines.length > 0 ? lines.join("\n") : "- None"}`;
}

function appendStringPromptSection(lines: string[], title: string, items: string[]): void {
  if (items.length === 0) {
    return;
  }

  lines.push("", `${title}:`, ...items.map((item) => `- ${compactPromptText(item)}`));
}

function appendItemPromptSection(
  lines: string[],
  title: string,
  items: WorkCapsuleItem[]
): void {
  if (items.length === 0) {
    return;
  }

  lines.push("", `${title}:`, ...items.map((item) => `- ${compactPromptText(item.text)}`));
}

function appendActionPromptSection(lines: string[], actions: WorkCapsuleAction[]): void {
  if (actions.length === 0) {
    return;
  }

  lines.push(
    "",
    "Next actions:",
    ...actions.map((action) => {
      const owner = action.owner ? ` @${action.owner}` : "";
      return `- [${action.status}]${owner} ${compactPromptText(action.text)}`;
    })
  );
}

function appendArtifactPromptSection(lines: string[], artifacts: WorkCapsuleArtifact[]): void {
  if (artifacts.length === 0) {
    return;
  }

  lines.push(
    "",
    "Artifacts:",
    ...artifacts.map((artifact) => {
      const body = compactPromptText(artifact.body);
      return body
        ? `- ${compactPromptText(artifact.title, 160)} (${artifact.type}): ${body}`
        : `- ${compactPromptText(artifact.title, 160)} (${artifact.type})`;
    })
  );
}

function appendExcerptPromptSection(lines: string[], excerpts: WorkCapsuleExcerpt[]): void {
  if (excerpts.length === 0) {
    return;
  }

  lines.push(
    "",
    "Selected excerpts:",
    ...excerpts.map((excerpt) => {
      const text = compactPromptText(excerpt.text);
      return `- ${excerpt.turnId} (${excerpt.role}): ${text}`;
    })
  );
}

function validateSource(value: unknown, errors: string[]): void {
  if (!isRecord(value)) {
    errors.push("source must be an object");
    return;
  }

  validateEnumValue(value.provider, "source.provider", new Set(["chatgpt"]), errors);
  requireString(value, "source.title", errors, "title");
  requireString(value, "source.url", errors, "url");
  validateStringArray(value, "source.selectedTurnIds", errors, "selectedTurnIds");
}

function validateItemArray(value: Record<string, unknown>, key: string, errors: string[]): void {
  const items = value[key];
  if (!Array.isArray(items)) {
    errors.push(`${key} must be an array`);
    return;
  }

  items.forEach((item, index) => {
    if (!isRecord(item)) {
      errors.push(`${key}[${index}] must be an object`);
      return;
    }

    requireString(item, `${key}[${index}].id`, errors, "id");
    requireString(item, `${key}[${index}].text`, errors, "text");
  });
}

function validateActionArray(value: Record<string, unknown>, key: string, errors: string[]): void {
  const actions = value[key];
  if (!Array.isArray(actions)) {
    errors.push(`${key} must be an array`);
    return;
  }

  actions.forEach((action, index) => {
    if (!isRecord(action)) {
      errors.push(`${key}[${index}] must be an object`);
      return;
    }

    requireString(action, `${key}[${index}].id`, errors, "id");
    requireString(action, `${key}[${index}].text`, errors, "text");
    validateEnumValue(action.status, `${key}[${index}].status`, ACTION_STATUSES, errors);
    if (action.owner !== undefined) {
      validateEnumValue(action.owner, `${key}[${index}].owner`, ACTION_OWNERS, errors);
    }
  });
}

function validateArtifactArray(
  value: Record<string, unknown>,
  key: string,
  errors: string[]
): void {
  const artifacts = value[key];
  if (!Array.isArray(artifacts)) {
    errors.push(`${key} must be an array`);
    return;
  }

  artifacts.forEach((artifact, index) => {
    if (!isRecord(artifact)) {
      errors.push(`${key}[${index}] must be an object`);
      return;
    }

    requireString(artifact, `${key}[${index}].id`, errors, "id");
    validateEnumValue(artifact.type, `${key}[${index}].type`, ARTIFACT_TYPES, errors);
    requireString(artifact, `${key}[${index}].title`, errors, "title");
    requireString(artifact, `${key}[${index}].body`, errors, "body");
  });
}

function validateExcerptArray(value: Record<string, unknown>, key: string, errors: string[]): void {
  const excerpts = value[key];
  if (!Array.isArray(excerpts)) {
    errors.push(`${key} must be an array`);
    return;
  }

  excerpts.forEach((excerpt, index) => {
    if (!isRecord(excerpt)) {
      errors.push(`${key}[${index}] must be an object`);
      return;
    }

    requireString(excerpt, `${key}[${index}].id`, errors, "id");
    requireString(excerpt, `${key}[${index}].turnId`, errors, "turnId");
    validateEnumValue(excerpt.role, `${key}[${index}].role`, EXCERPT_ROLES, errors);
    requireString(excerpt, `${key}[${index}].text`, errors, "text");
  });
}

function validateStringArray(
  value: Record<string, unknown>,
  path: string,
  errors: string[],
  key = path
): void {
  const items = value[key];
  if (!Array.isArray(items)) {
    errors.push(`${path} must be an array`);
    return;
  }

  items.forEach((item, index) => {
    if (typeof item !== "string" || item.trim().length === 0) {
      errors.push(`${path}[${index}] must be a non-empty string`);
    }
  });
}

function requireString(
  value: Record<string, unknown>,
  path: string,
  errors: string[],
  key = path
): void {
  if (typeof value[key] !== "string" || value[key].trim().length === 0) {
    errors.push(`${path} must be a non-empty string`);
  }
}

function requireExactString(
  value: Record<string, unknown>,
  key: string,
  expected: string,
  errors: string[]
): void {
  if (value[key] !== expected) {
    errors.push(`${key} must be ${expected}`);
  }
}

function validateEnumValue<T extends string>(
  value: unknown,
  path: string,
  allowed: Set<T>,
  errors: string[]
): void {
  if (typeof value !== "string" || !allowed.has(value as T)) {
    errors.push(`${path} must be one of ${Array.from(allowed).join(", ")}`);
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function chromeStorageLocal(): ChromeStorageLocal | null {
  const maybeChrome = globalThis.chrome;
  return maybeChrome?.storage?.local ?? null;
}

async function loadWorkCapsuleIndex(storage: ChromeStorageLocal): Promise<WorkCapsuleIndexItem[]> {
  const storedValue = await storageGet(storage, WORK_CAPSULE_INDEX_KEY).catch(() => []);
  return normalizeWorkCapsuleIndex(storedValue);
}

function normalizeWorkCapsuleIndex(value: unknown): WorkCapsuleIndexItem[] {
  if (!Array.isArray(value)) {
    return [];
  }

  return value
    .flatMap((item) => {
      if (!isRecord(item)) {
        return [];
      }

      const id = compactString(item.id);
      const title = compactString(item.title);
      const project = compactString(item.project);
      const goal = compactString(item.goal);
      const sourceTitle = compactString(item.sourceTitle);
      const sourceUrl = compactString(item.sourceUrl);
      const createdAt = compactString(item.createdAt);
      const updatedAt = compactString(item.updatedAt);

      if (!id || !title || !createdAt || !updatedAt) {
        return [];
      }

      return [
        {
          id,
          title,
          ...(project ? { project } : {}),
          goal,
          sourceTitle,
          sourceUrl,
          createdAt,
          updatedAt
        }
      ];
    })
    .sort(compareIndexItems);
}

function workCapsuleIndexItem(capsule: WorkCapsuleV1): WorkCapsuleIndexItem {
  const project =
    "project" in capsule && typeof capsule.project === "string"
      ? compactString(capsule.project)
      : "";

  return {
    id: capsule.id,
    title: capsule.title,
    ...(project ? { project } : {}),
    goal: capsule.goal,
    sourceTitle: capsule.source.title,
    sourceUrl: capsule.source.url,
    createdAt: capsule.createdAt,
    updatedAt: capsule.updatedAt
  };
}

function compareIndexItems(first: WorkCapsuleIndexItem, second: WorkCapsuleIndexItem): number {
  return second.updatedAt.localeCompare(first.updatedAt);
}

function compactString(value: unknown): string {
  return typeof value === "string" ? value.trim().replace(/\s+/g, " ") : "";
}

function compactPromptText(value: string, maxLength = 500): string {
  const compacted = compactString(value);
  if (compacted.length <= maxLength) {
    return compacted;
  }

  return `${compacted.slice(0, Math.max(0, maxLength - 3)).trim()}...`;
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

function storageSet(storage: ChromeStorageLocal, items: Record<string, unknown>): Promise<void> {
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

function storageRemove(storage: ChromeStorageLocal, key: string): Promise<void> {
  return new Promise((resolve, reject) => {
    storage.remove(key, () => {
      const lastError = globalThis.chrome?.runtime?.lastError;
      if (lastError) {
        reject(new Error(lastError.message));
        return;
      }

      resolve();
    });
  });
}
