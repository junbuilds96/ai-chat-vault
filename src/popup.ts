import "./popup.css";
import {
  deleteConversationBookmark,
  loadConversationBookmarks,
  upsertConversationBookmark,
  type ConversationBookmark
} from "./bookmarks";
import type { ConversationExport, Speaker } from "./extractor";
import { conversationToMarkdown, markdownFilename } from "./markdown";
import {
  allMessageIndexes,
  filterConversationMessages,
  messageIndexesForSelection,
  shortMessagePreview
} from "./selection";
import {
  CAPTURE_REQUEST_TYPE,
  CAPTURE_RESPONSE_TYPE,
  INSERT_PROMPT_REQUEST_TYPE,
  INSERT_PROMPT_RESPONSE_TYPE,
  type CaptureResponse,
  type InsertPromptResponse,
  isSupportedChatGptHost
} from "./messages";
import { conversationNoteIdentity, loadConversationNote, saveConversationNote } from "./notes";
import {
  loadPromptSnippets,
  savePromptSnippets,
  type PromptSnippet
} from "./prompts";
import {
  DEFAULT_WORK_CAPSULE_OUTPUT_PRESET_ID,
  WORK_CAPSULE_OUTPUT_PRESETS,
  WORK_CAPSULE_SCHEMA_VERSION,
  buildWorkCapsuleContextPrompt,
  createWorkCapsule,
  deleteWorkCapsule,
  findMostRecentWorkCapsuleBySourceUrl,
  getWorkCapsule,
  isWorkCapsuleOutputPresetId,
  listWorkCapsules,
  renderWorkCapsuleMarkdown,
  renderWorkCapsuleOutputPreset,
  renderWorkCapsuleSourceCitation,
  type WorkCapsuleAction,
  type WorkCapsuleArtifact,
  type WorkCapsuleContextPromptSource,
  type WorkCapsuleIndexItem,
  type WorkCapsuleItem,
  type WorkCapsuleOutputPresetId,
  type WorkCapsuleV1
} from "./workCapsules";

type MessageNavigatorRole = "all" | Speaker;
type Locale = "en" | "zh";

interface PopupState {
  locale: Locale;
  conversation: ConversationExport | null;
  selectedMessageIndexes: Set<number>;
  markdown: string;
  title: string;
  snippets: PromptSnippet[];
  selectedSnippetId: string;
  navigatorQuery: string;
  navigatorRole: MessageNavigatorRole;
  focusedMessageIndex: number | null;
  conversationNote: string;
  conversationNoteIdentity: string;
  bookmarks: ConversationBookmark[];
  recentWorkCapsule: WorkCapsuleV1 | null;
  workCapsuleLibrary: WorkCapsuleIndexItem[];
  workCapsuleDraft: WorkCapsuleV1 | null;
  workCapsuleOutputPresetId: WorkCapsuleOutputPresetId;
  workCapsuleContextPromptEdited: boolean;
}

const state: PopupState = {
  locale: "en",
  conversation: null,
  selectedMessageIndexes: new Set(),
  markdown: "",
  title: "ChatGPT Conversation",
  snippets: [],
  selectedSnippetId: "",
  navigatorQuery: "",
  navigatorRole: "all",
  focusedMessageIndex: null,
  conversationNote: "",
  conversationNoteIdentity: "",
  bookmarks: [],
  recentWorkCapsule: null,
  workCapsuleLibrary: [],
  workCapsuleDraft: null,
  workCapsuleOutputPresetId: DEFAULT_WORK_CAPSULE_OUTPUT_PRESET_ID,
  workCapsuleContextPromptEdited: false
};

const NAVIGATOR_ROLES: MessageNavigatorRole[] = ["all", "user", "assistant", "system"];
const LOCALE_STORAGE_KEY = "aiChatVaultLocale";
const SUPPORTED_LOCALES: Locale[] = ["en", "zh"];
const EN_MESSAGES = {
  appAria: "AI Chat Vault popup",
  subtitle: "Local Markdown export",
  language: "Language",
  exportActions: "Export actions",
  capture: "Capture",
  copy: "Copy",
  download: "Download",
  promptLibrary: "Prompt Library",
  localSnippets: "Local snippets",
  promptSnippet: "Prompt snippet",
  promptSlashCommand: "Prompt slash command",
  promptBody: "Prompt body",
  promptBodyPlaceholder: "Prompt body",
  newPrompt: "New",
  save: "Save",
  delete: "Delete",
  copyPrompt: "Copy prompt",
  insertPrompt: "Insert into ChatGPT",
  conversationNotes: "Conversation Notes",
  privateLocalNote: "Private local note",
  conversationNote: "Conversation note",
  conversationNotePlaceholder: "Private notes for this conversation",
  conversationBookmarks: "Conversation Bookmarks",
  localSavedLinks: "Local saved links",
  saveBookmark: "Save bookmark",
  savedConversationBookmarks: "Saved conversation bookmarks",
  workCapsule: "Work Capsule",
  localDraft: "Local draft",
  bridgePreset: "Bridge preset",
  workCapsuleBridgePreset: "Work capsule bridge preset",
  createCapsule: "Create Capsule",
  workCapsuleLibrary: "Work Capsule Library",
  title: "Title",
  project: "Project",
  goal: "Goal",
  contextPrompt: "Context prompt",
  reusableContext: "Reusable context",
  decisions: "Decisions",
  constraints: "Constraints",
  facts: "Facts",
  openQuestions: "Open questions",
  nextActions: "Next actions",
  artifacts: "Artifacts",
  workCapsuleTitle: "Work capsule title",
  workCapsuleProject: "Work capsule project",
  workCapsuleGoal: "Work capsule goal",
  workCapsuleContextPrompt: "Work capsule context prompt",
  workCapsuleReusableContext: "Work capsule reusable context",
  workCapsuleDecisions: "Work capsule decisions",
  workCapsuleConstraints: "Work capsule constraints",
  workCapsuleFacts: "Work capsule facts",
  workCapsuleOpenQuestions: "Work capsule open questions",
  workCapsuleNextActions: "Work capsule next actions",
  workCapsuleArtifacts: "Work capsule artifacts",
  saveCapsule: "Save capsule",
  copyContext: "Copy context",
  copyMarkdown: "Copy Markdown",
  copySource: "Copy source",
  downloadCapsule: "Download capsule",
  deleteCapsule: "Delete capsule",
  messageNavigator: "Message Navigator",
  zeroTurns: "0 of 0 turns",
  searchCapturedMessages: "Search captured messages",
  searchRoleOrText: "Search role or text",
  filterMessagesByRole: "Filter messages by role",
  navigatorResults: "Message Navigator results",
  messageSelectionControls: "Message selection controls",
  selectAll: "Select all",
  selectNone: "Select none",
  detectedMessages: "Detected messages",
  markdownPreview: "Markdown preview",
  markdownPreviewHeading: "Markdown Preview",
  selectionOutput: "Selection output",
  previewPlaceholder: "Open a ChatGPT conversation, click the extension icon, then Capture.",
  ready: "Ready",
  allRoles: "All roles",
  userRole: "User",
  assistantRole: "Assistant",
  systemRole: "System",
  noMatchingTurns: "No matching turns",
  noSavedBookmarks: "No saved bookmarks",
  copyLink: "Copy link",
  library: "Library",
  reopen: "Reopen",
  reuse: "Reuse",
  remove: "Remove",
  unknownSource: "Unknown source",
  exportFailed: "Export failed",
  unsavedPromptChanges: "Unsaved prompt changes",
  unsavedCapsuleChanges: "Unsaved capsule changes",
  capturingActiveTab: "Capturing active ChatGPT tab...",
  noActiveTab: "No active browser tab was found",
  openChatGptBeforeCapturing: "Open a ChatGPT tab before capturing",
  openChatGptBeforeInserting: "Open a ChatGPT tab before inserting a prompt",
  unexpectedCaptureResponse: "Unexpected capture response",
  unexpectedPromptResponse: "Unexpected prompt insertion response",
  chatGptComposerNotFound: "ChatGPT composer was not found",
  captureFailed: "Capture failed",
  promptInsertionFailed: "Prompt insertion failed",
  copiedMarkdown: "Copied Markdown to clipboard",
  copiedPrompt: "Copied prompt to clipboard",
  insertedPrompt: "Inserted prompt into ChatGPT",
  downloadedMarkdown: "Downloaded Markdown file",
  captureBeforeExporting: "Capture a conversation before exporting",
  noMessagesToExport: "No messages were detected to export",
  selectOneMessageToExport: "Select at least one message to export",
  savedConversationNote: "Saved conversation note locally",
  couldNotSaveConversationNote: "Could not save conversation note",
  captureBeforeSavingBookmark: "Capture a conversation before saving a bookmark",
  savedBookmark: "Saved conversation bookmark locally",
  bookmarkNotFound: "Conversation bookmark was not found",
  copiedBookmark: "Copied bookmark link to clipboard",
  deletedBookmark: "Deleted conversation bookmark",
  selectedMessage: "Selected message",
  savedCapsule: "Saved capsule locally",
  noSavedCapsuleForConversation: "No saved capsule is available for this conversation",
  reopenedSavedCapsule: "Reopened saved capsule",
  createdUnsavedCapsule: "Created unsaved capsule draft from saved capsule",
  saveCapsuleBeforeDeleting: "Save the capsule before deleting it",
  deleteCanceled: "Delete canceled; saved capsule kept locally",
  deletedSavedCapsule: "Deleted saved capsule locally",
  savedCapsuleIdMissing: "Saved capsule id is missing",
  savedCapsuleNoLongerInLibrary: "Saved capsule is no longer in the library",
  capsuleRemoveCanceled: "Capsule remove canceled",
  removedSavedCapsule: "Removed saved capsule locally",
  removedInvalidCapsule: "Removed missing or invalid saved capsule from library",
  copiedSourceCitation: "Copied source citation to clipboard",
  savedCapsuleLoadFailed: "Saved capsule could not be loaded",
  copiedCapsuleMarkdown: "Copied capsule Markdown to clipboard",
  createCapsuleBeforeAction: "Create a capsule draft before using capsule actions",
  downloadedCapsuleMarkdown: "Downloaded capsule Markdown file",
  untitledWorkCapsule: "Untitled Work Capsule",
  defaultCapsuleGoal: "Capture reusable context from selected messages.",
  currentConversation: "Current conversation",
  workCapsuleDeleteUnavailable: "Work capsule delete button is unavailable",
  captureBeforeReusingCapsule: "Capture a conversation before reusing a saved capsule",
  noMessagesToReuse: "No messages were detected to reuse",
  selectOneMessageToReuse: "Select at least one message to reuse",
  newPromptSnippet: "New prompt snippet",
  noPromptSelected: "No prompt snippet is selected",
  addSlashCommand: "Add a slash command before saving",
  addPromptBody: "Add a prompt body before saving",
  savedPromptSnippet: "Saved prompt snippet locally",
  deletedPromptSnippet: "Deleted prompt snippet",
  promptBodyEmpty: "Prompt body is empty",
  previewUnavailable: "Preview panel is unavailable",
  promptSelectorUnavailable: "Prompt selector is unavailable",
  promptTitleUnavailable: "Prompt title input is unavailable",
  promptBodyUnavailable: "Prompt body input is unavailable",
  notesSectionUnavailable: "Conversation notes section is unavailable",
  noteInputUnavailable: "Conversation note input is unavailable",
  notesContextUnavailable: "Conversation notes context is unavailable",
  bookmarksSectionUnavailable: "Conversation bookmarks section is unavailable",
  bookmarksContextUnavailable: "Conversation bookmarks context is unavailable",
  bookmarkListUnavailable: "Conversation bookmark list is unavailable",
  workCapsuleSectionUnavailable: "Work capsule section is unavailable",
  workCapsuleFieldsUnavailable: "Work capsule fields are unavailable",
  recentWorkCapsuleUnavailable: "Recent work capsule panel is unavailable",
  workCapsuleLibraryUnavailable: "Work capsule library panel is unavailable",
  workCapsulePresetUnavailable: "Work capsule preset selector is unavailable",
  workCapsuleContextUnavailable: "Work capsule context is unavailable",
  messageSelectionUnavailable: "Message selection panel is unavailable",
  messageSearchUnavailable: "Message search is unavailable",
  messageRoleFilterUnavailable: "Message role filter is unavailable",
  navigatorCountUnavailable: "Message navigator count is unavailable",
  navigatorResultsUnavailable: "Message navigator results are unavailable"
} as const;
const ZH_MESSAGES: Record<keyof typeof EN_MESSAGES, string> = {
  appAria: "AI Chat Vault 弹窗",
  subtitle: "本地 Markdown 导出",
  language: "语言",
  exportActions: "导出操作",
  capture: "捕获",
  copy: "复制",
  download: "下载",
  promptLibrary: "提示词库",
  localSnippets: "本地片段",
  promptSnippet: "提示词片段",
  promptSlashCommand: "提示词斜杠命令",
  promptBody: "提示词正文",
  promptBodyPlaceholder: "提示词正文",
  newPrompt: "新建",
  save: "保存",
  delete: "删除",
  copyPrompt: "复制提示词",
  insertPrompt: "插入到 ChatGPT",
  conversationNotes: "对话笔记",
  privateLocalNote: "本地私有笔记",
  conversationNote: "对话笔记",
  conversationNotePlaceholder: "这段对话的私有笔记",
  conversationBookmarks: "对话书签",
  localSavedLinks: "本地保存链接",
  saveBookmark: "保存书签",
  savedConversationBookmarks: "已保存的对话书签",
  workCapsule: "工作胶囊",
  localDraft: "本地草稿",
  bridgePreset: "桥接预设",
  workCapsuleBridgePreset: "工作胶囊桥接预设",
  createCapsule: "创建胶囊",
  workCapsuleLibrary: "工作胶囊库",
  title: "标题",
  project: "项目",
  goal: "目标",
  contextPrompt: "上下文提示词",
  reusableContext: "可复用上下文",
  decisions: "决策",
  constraints: "约束",
  facts: "事实",
  openQuestions: "开放问题",
  nextActions: "下一步行动",
  artifacts: "产物",
  workCapsuleTitle: "工作胶囊标题",
  workCapsuleProject: "工作胶囊项目",
  workCapsuleGoal: "工作胶囊目标",
  workCapsuleContextPrompt: "工作胶囊上下文提示词",
  workCapsuleReusableContext: "工作胶囊可复用上下文",
  workCapsuleDecisions: "工作胶囊决策",
  workCapsuleConstraints: "工作胶囊约束",
  workCapsuleFacts: "工作胶囊事实",
  workCapsuleOpenQuestions: "工作胶囊开放问题",
  workCapsuleNextActions: "工作胶囊下一步行动",
  workCapsuleArtifacts: "工作胶囊产物",
  saveCapsule: "保存胶囊",
  copyContext: "复制上下文",
  copyMarkdown: "复制 Markdown",
  copySource: "复制来源",
  downloadCapsule: "下载胶囊",
  deleteCapsule: "删除胶囊",
  messageNavigator: "消息导航",
  zeroTurns: "0 / 0 轮",
  searchCapturedMessages: "搜索已捕获消息",
  searchRoleOrText: "搜索角色或内容",
  filterMessagesByRole: "按角色筛选消息",
  navigatorResults: "消息导航结果",
  messageSelectionControls: "消息选择控件",
  selectAll: "全选",
  selectNone: "全不选",
  detectedMessages: "检测到的消息",
  markdownPreview: "Markdown 预览",
  markdownPreviewHeading: "Markdown 预览",
  selectionOutput: "选择输出",
  previewPlaceholder: "打开 ChatGPT 对话，点击扩展图标，然后捕获。",
  ready: "就绪",
  allRoles: "全部角色",
  userRole: "用户",
  assistantRole: "助手",
  systemRole: "系统",
  noMatchingTurns: "没有匹配轮次",
  noSavedBookmarks: "暂无保存书签",
  copyLink: "复制链接",
  library: "库",
  reopen: "重新打开",
  reuse: "复用",
  remove: "移除",
  unknownSource: "未知来源",
  exportFailed: "导出失败",
  unsavedPromptChanges: "提示词有未保存更改",
  unsavedCapsuleChanges: "胶囊有未保存更改",
  capturingActiveTab: "正在捕获当前 ChatGPT 标签页...",
  noActiveTab: "没有找到当前浏览器标签页",
  openChatGptBeforeCapturing: "捕获前请先打开 ChatGPT 标签页",
  openChatGptBeforeInserting: "插入提示词前请先打开 ChatGPT 标签页",
  unexpectedCaptureResponse: "捕获响应异常",
  unexpectedPromptResponse: "提示词插入响应异常",
  chatGptComposerNotFound: "未找到 ChatGPT 输入框",
  captureFailed: "捕获失败",
  promptInsertionFailed: "提示词插入失败",
  copiedMarkdown: "已复制 Markdown 到剪贴板",
  copiedPrompt: "已复制提示词到剪贴板",
  insertedPrompt: "已插入提示词到 ChatGPT",
  downloadedMarkdown: "已下载 Markdown 文件",
  captureBeforeExporting: "导出前请先捕获对话",
  noMessagesToExport: "没有检测到可导出的消息",
  selectOneMessageToExport: "至少选择一条消息再导出",
  savedConversationNote: "已在本地保存对话笔记",
  couldNotSaveConversationNote: "无法保存对话笔记",
  captureBeforeSavingBookmark: "保存书签前请先捕获对话",
  savedBookmark: "已在本地保存对话书签",
  bookmarkNotFound: "未找到对话书签",
  copiedBookmark: "已复制书签链接到剪贴板",
  deletedBookmark: "已删除对话书签",
  selectedMessage: "已选消息",
  savedCapsule: "已在本地保存胶囊",
  noSavedCapsuleForConversation: "这段对话没有可用的已保存胶囊",
  reopenedSavedCapsule: "已重新打开保存的胶囊",
  createdUnsavedCapsule: "已从保存的胶囊创建未保存草稿",
  saveCapsuleBeforeDeleting: "删除前请先保存胶囊",
  deleteCanceled: "已取消删除；本地保存的胶囊已保留",
  deletedSavedCapsule: "已删除本地保存的胶囊",
  savedCapsuleIdMissing: "缺少已保存胶囊 id",
  savedCapsuleNoLongerInLibrary: "保存的胶囊已不在库中",
  capsuleRemoveCanceled: "已取消移除胶囊",
  removedSavedCapsule: "已移除本地保存的胶囊",
  removedInvalidCapsule: "已从库中移除缺失或无效的胶囊",
  copiedSourceCitation: "已复制来源引用到剪贴板",
  savedCapsuleLoadFailed: "无法加载保存的胶囊",
  copiedCapsuleMarkdown: "已复制胶囊 Markdown 到剪贴板",
  createCapsuleBeforeAction: "使用胶囊操作前请先创建胶囊草稿",
  downloadedCapsuleMarkdown: "已下载胶囊 Markdown 文件",
  untitledWorkCapsule: "未命名工作胶囊",
  defaultCapsuleGoal: "从已选消息中捕获可复用上下文。",
  currentConversation: "当前对话",
  workCapsuleDeleteUnavailable: "工作胶囊删除按钮不可用",
  captureBeforeReusingCapsule: "复用保存的胶囊前请先捕获对话",
  noMessagesToReuse: "没有检测到可复用的消息",
  selectOneMessageToReuse: "至少选择一条消息再复用",
  newPromptSnippet: "新建提示词片段",
  noPromptSelected: "未选择提示词片段",
  addSlashCommand: "保存前请添加斜杠命令",
  addPromptBody: "保存前请添加提示词正文",
  savedPromptSnippet: "已在本地保存提示词片段",
  deletedPromptSnippet: "已删除提示词片段",
  promptBodyEmpty: "提示词正文为空",
  previewUnavailable: "预览面板不可用",
  promptSelectorUnavailable: "提示词选择器不可用",
  promptTitleUnavailable: "提示词标题输入框不可用",
  promptBodyUnavailable: "提示词正文输入框不可用",
  notesSectionUnavailable: "对话笔记区域不可用",
  noteInputUnavailable: "对话笔记输入框不可用",
  notesContextUnavailable: "对话笔记上下文不可用",
  bookmarksSectionUnavailable: "对话书签区域不可用",
  bookmarksContextUnavailable: "对话书签上下文不可用",
  bookmarkListUnavailable: "对话书签列表不可用",
  workCapsuleSectionUnavailable: "工作胶囊区域不可用",
  workCapsuleFieldsUnavailable: "工作胶囊字段不可用",
  recentWorkCapsuleUnavailable: "最近工作胶囊面板不可用",
  workCapsuleLibraryUnavailable: "工作胶囊库面板不可用",
  workCapsulePresetUnavailable: "工作胶囊预设选择器不可用",
  workCapsuleContextUnavailable: "工作胶囊上下文不可用",
  messageSelectionUnavailable: "消息选择面板不可用",
  messageSearchUnavailable: "消息搜索不可用",
  messageRoleFilterUnavailable: "消息角色筛选不可用",
  navigatorCountUnavailable: "消息导航计数不可用",
  navigatorResultsUnavailable: "消息导航结果不可用"
};
const UI_MESSAGES = {
  en: EN_MESSAGES,
  zh: ZH_MESSAGES
};
type UiMessageKey = keyof typeof EN_MESSAGES;
const NAVIGATOR_ROLE_LABELS: Record<Locale, Record<MessageNavigatorRole, string>> = {
  en: {
  all: "All roles",
  user: "User",
  assistant: "Assistant",
  system: "System"
  },
  zh: {
    all: "全部角色",
    user: "用户",
    assistant: "助手",
    system: "系统"
  }
};
const WORK_CAPSULE_LIBRARY_LIMIT = 5;

initPopup();

function initPopup(): void {
  const root = document.querySelector<HTMLDivElement>("#root");
  if (!root) {
    return;
  }

  renderPopupShell(root);
  root.addEventListener("click", handlePopupClick);
  root.addEventListener("input", handlePopupInput);
  root.addEventListener("change", handlePopupChange);
  void initializePopup();
}

async function initializePopup(): Promise<void> {
  const locale = await loadStoredLocale();
  if (locale !== state.locale) {
    state.locale = locale;
    renderPopupShell();
  }

  await loadPromptLibrary();
  setStatus(t("ready"));
}

function renderPopupShell(root = popupRoot()): void {
  document.documentElement.lang = state.locale;
  root.innerHTML = `
    <main class="acv-popup" aria-label="${t("appAria")}">
      <header class="acv-header">
        <div class="acv-titlebar">
          <div class="acv-brand">
            <strong>AI Chat Vault</strong>
            <span>${t("subtitle")}</span>
          </div>
          <label class="acv-locale-switch">
            <span>${t("language")}</span>
            <select data-acv-locale-select aria-label="${t("language")}">
              <option value="en"${state.locale === "en" ? " selected" : ""}>English</option>
              <option value="zh"${state.locale === "zh" ? " selected" : ""}>中文</option>
            </select>
          </label>
        </div>
        <section class="acv-actions" aria-label="${t("exportActions")}">
          <button class="acv-primary-action" type="button" data-acv-action="capture">${t("capture")}</button>
          <button type="button" data-acv-action="copy">${t("copy")}</button>
          <button type="button" data-acv-action="download">${t("download")}</button>
        </section>
      </header>
      <div class="acv-content">
      <section class="acv-panel acv-prompt-library" aria-label="${t("promptLibrary")}">
        <div class="acv-section-heading">
          <strong>${t("promptLibrary")}</strong>
          <span>${t("localSnippets")}</span>
        </div>
        <select aria-label="${t("promptSnippet")}" data-acv-prompt-select></select>
        <input type="text" aria-label="${t("promptSlashCommand")}" data-acv-prompt-title placeholder="/shortcut" />
        <textarea aria-label="${t("promptBody")}" data-acv-prompt-body data-acv-prompt-preview placeholder="${t("promptBodyPlaceholder")}"></textarea>
        <div class="acv-prompt-edit-actions">
          <button type="button" data-acv-action="new-prompt">${t("newPrompt")}</button>
          <button type="button" data-acv-action="save-prompt">${t("save")}</button>
          <button type="button" data-acv-action="delete-prompt">${t("delete")}</button>
        </div>
        <div class="acv-prompt-actions">
          <button type="button" data-acv-action="copy-prompt">${t("copyPrompt")}</button>
          <button type="button" data-acv-action="insert-prompt">${t("insertPrompt")}</button>
        </div>
      </section>
      <section class="acv-panel acv-conversation-notes" aria-label="${t("conversationNotes")}" hidden>
        <div class="acv-section-heading">
          <strong>${t("conversationNotes")}</strong>
          <span data-acv-notes-context>${t("privateLocalNote")}</span>
        </div>
        <textarea aria-label="${t("conversationNote")}" data-acv-conversation-note placeholder="${t("conversationNotePlaceholder")}"></textarea>
      </section>
      <section class="acv-panel acv-conversation-bookmarks" aria-label="${t("conversationBookmarks")}" hidden>
        <div class="acv-section-heading">
          <strong>${t("conversationBookmarks")}</strong>
          <span data-acv-bookmarks-context>${t("localSavedLinks")}</span>
        </div>
        <button type="button" data-acv-action="save-bookmark">${t("saveBookmark")}</button>
        <div class="acv-bookmark-list" aria-label="${t("savedConversationBookmarks")}"></div>
      </section>
      <section class="acv-panel acv-work-capsule" aria-label="${t("workCapsule")}" hidden>
        <div class="acv-section-heading">
          <strong>${t("workCapsule")}</strong>
          <span data-acv-work-capsule-context>${t("localDraft")}</span>
        </div>
        <label class="acv-work-capsule-preset">
          <span>${t("bridgePreset")}</span>
          <select data-acv-capsule-preset aria-label="${t("workCapsuleBridgePreset")}"></select>
        </label>
        <button type="button" data-acv-action="create-capsule">${t("createCapsule")}</button>
        <div class="acv-work-capsule-recent" hidden></div>
        <div class="acv-work-capsule-library" aria-label="${t("workCapsuleLibrary")}" hidden></div>
        <div class="acv-work-capsule-fields" hidden>
          <label>
            <span>${t("title")}</span>
            <input type="text" data-acv-capsule-field="title" aria-label="${t("workCapsuleTitle")}" />
          </label>
          <label>
            <span>${t("project")}</span>
            <input type="text" data-acv-capsule-field="project" aria-label="${t("workCapsuleProject")}" />
          </label>
          <label>
            <span>${t("goal")}</span>
            <textarea data-acv-capsule-field="goal" aria-label="${t("workCapsuleGoal")}"></textarea>
          </label>
          <label>
            <span>${t("contextPrompt")}</span>
            <textarea data-acv-capsule-field="contextPrompt" aria-label="${t("workCapsuleContextPrompt")}"></textarea>
          </label>
          <label>
            <span>${t("reusableContext")}</span>
            <textarea data-acv-capsule-field="reusableContext" aria-label="${t("workCapsuleReusableContext")}"></textarea>
          </label>
          <label>
            <span>${t("decisions")}</span>
            <textarea data-acv-capsule-field="decisions" aria-label="${t("workCapsuleDecisions")}"></textarea>
          </label>
          <label>
            <span>${t("constraints")}</span>
            <textarea data-acv-capsule-field="constraints" aria-label="${t("workCapsuleConstraints")}"></textarea>
          </label>
          <label>
            <span>${t("facts")}</span>
            <textarea data-acv-capsule-field="facts" aria-label="${t("workCapsuleFacts")}"></textarea>
          </label>
          <label>
            <span>${t("openQuestions")}</span>
            <textarea data-acv-capsule-field="openQuestions" aria-label="${t("workCapsuleOpenQuestions")}"></textarea>
          </label>
          <label>
            <span>${t("nextActions")}</span>
            <textarea data-acv-capsule-field="nextActions" aria-label="${t("workCapsuleNextActions")}"></textarea>
          </label>
          <label>
            <span>${t("artifacts")}</span>
            <textarea data-acv-capsule-field="artifacts" aria-label="${t("workCapsuleArtifacts")}"></textarea>
          </label>
          <div class="acv-work-capsule-actions">
            <button type="button" data-acv-action="save-capsule">${t("saveCapsule")}</button>
            <button type="button" data-acv-action="copy-capsule-context">${t("copyContext")}</button>
            <button type="button" data-acv-action="copy-capsule-markdown">${t("copyMarkdown")}</button>
            <button type="button" data-acv-action="copy-capsule-source-citation">${t("copySource")}</button>
            <button type="button" data-acv-action="download-capsule">${t("downloadCapsule")}</button>
            <button type="button" data-acv-action="delete-capsule" data-acv-capsule-draft-action="true" hidden>${t("deleteCapsule")}</button>
          </div>
        </div>
      </section>
      <section class="acv-panel acv-message-panel" hidden>
        <section class="acv-message-navigator" aria-label="${t("messageNavigator")}">
          <div class="acv-section-heading">
            <strong>${t("messageNavigator")}</strong>
            <span data-acv-navigator-count>${t("zeroTurns")}</span>
          </div>
          <div class="acv-navigator-filters">
            <input type="search" aria-label="${t("searchCapturedMessages")}" data-acv-message-search placeholder="${t("searchRoleOrText")}" />
            <select aria-label="${t("filterMessagesByRole")}" data-acv-role-filter></select>
          </div>
          <div class="acv-navigator-results" aria-label="${t("navigatorResults")}"></div>
        </section>
        <div class="acv-selection-actions" aria-label="${t("messageSelectionControls")}">
          <button type="button" data-acv-action="select-all">${t("selectAll")}</button>
          <button type="button" data-acv-action="select-none">${t("selectNone")}</button>
        </div>
        <div class="acv-message-list" aria-label="${t("detectedMessages")}"></div>
      </section>
      <section class="acv-panel acv-preview-panel" aria-label="${t("markdownPreview")}">
        <div class="acv-section-heading">
          <strong>${t("markdownPreviewHeading")}</strong>
          <span>${t("selectionOutput")}</span>
        </div>
        <textarea readonly aria-label="Markdown preview" class="acv-markdown-preview" placeholder="${t("previewPlaceholder")}"></textarea>
      </section>
      </div>
      <div class="acv-status" role="status" aria-live="polite">${t("ready")}</div>
    </main>
  `;
}

function renderPopupState(): void {
  renderPromptLibrary();
  preview().value = state.markdown;

  if (!state.conversation) {
    return;
  }

  renderConversationNotes();
  renderConversationBookmarks();
  renderWorkCapsuleSection();
  renderMessageList(state.conversation.messages);
  renderMessageNavigator();
}

async function updateLocale(locale: Locale): Promise<void> {
  if (locale === state.locale) {
    return;
  }

  state.locale = locale;
  await saveStoredLocale(locale);
  renderPopupShell();
  renderPopupState();
  setStatus(t("ready"));
}

function t(key: UiMessageKey): string {
  return UI_MESSAGES[state.locale][key] ?? EN_MESSAGES[key];
}

function navigatorRoleLabel(role: MessageNavigatorRole): string {
  return NAVIGATOR_ROLE_LABELS[state.locale][role];
}

function localeFromValue(value: string): Locale {
  return SUPPORTED_LOCALES.includes(value as Locale) ? (value as Locale) : "en";
}

async function loadStoredLocale(): Promise<Locale> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return "en";
  }

  try {
    const storedValue = await storageGet(storage, LOCALE_STORAGE_KEY);
    return localeFromValue(typeof storedValue === "string" ? storedValue : "");
  } catch {
    return "en";
  }
}

async function saveStoredLocale(locale: Locale): Promise<void> {
  const storage = chromeStorageLocal();
  if (!storage) {
    return;
  }

  await storageSet(storage, { [LOCALE_STORAGE_KEY]: locale }).catch(() => undefined);
}

type ChromeStorageLocal = Pick<chrome.storage.StorageArea, "get" | "set">;

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
  items: Record<string, Locale>
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

async function handlePopupClick(event: MouseEvent): Promise<void> {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>("button[data-acv-action]");
  if (!button) {
    return;
  }

  const action = button.dataset.acvAction;
  try {
    if (action === "capture") {
      await captureFromActiveTab();
      return;
    }

    if (action === "select-all" || action === "select-none") {
      updateMessageSelection(action === "select-all" ? "all" : "none");
      return;
    }

    if (action === "copy-prompt") {
      await copySelectedPrompt();
      return;
    }

    if (action === "new-prompt") {
      createPromptSnippet();
      return;
    }

    if (action === "save-prompt") {
      await saveCurrentPromptSnippet();
      return;
    }

    if (action === "delete-prompt") {
      await deleteCurrentPromptSnippet();
      return;
    }

    if (action === "save-bookmark") {
      await saveCurrentConversationBookmark();
      return;
    }

    if (action === "create-capsule") {
      createCapsuleDraftFromSelection();
      return;
    }

    if (action === "reopen-capsule") {
      await reopenRecentWorkCapsule();
      return;
    }

    if (action === "reuse-capsule") {
      await reuseRecentWorkCapsule();
      return;
    }

    if (action === "reopen-library-capsule") {
      await reopenWorkCapsuleById(button.dataset.acvCapsuleId ?? "");
      return;
    }

    if (action === "reuse-library-capsule") {
      await reuseWorkCapsuleById(button.dataset.acvCapsuleId ?? "");
      return;
    }

    if (action === "copy-library-capsule-context") {
      await copyWorkCapsuleContextById(button.dataset.acvCapsuleId ?? "");
      return;
    }

    if (action === "copy-library-capsule-source-citation") {
      await copyWorkCapsuleSourceCitationById(button.dataset.acvCapsuleId ?? "");
      return;
    }

    if (action === "remove-library-capsule") {
      await removeWorkCapsuleFromLibraryById(button.dataset.acvCapsuleId ?? "");
      return;
    }

    if (action === "delete-capsule") {
      await deleteCurrentWorkCapsule();
      return;
    }

    if (action === "save-capsule") {
      await saveCurrentWorkCapsule();
      return;
    }

    if (action === "copy-capsule-context") {
      await copyCurrentWorkCapsuleContext();
      return;
    }

    if (action === "copy-capsule-markdown") {
      await copyCurrentWorkCapsuleMarkdown();
      return;
    }

    if (action === "copy-capsule-source-citation") {
      await copyCurrentWorkCapsuleSourceCitation();
      return;
    }

    if (action === "download-capsule") {
      downloadCurrentWorkCapsule();
      return;
    }

    if (action === "copy-bookmark") {
      await copyConversationBookmark(button.dataset.acvBookmarkId ?? "");
      return;
    }

    if (action === "delete-bookmark") {
      await deleteCurrentConversationBookmark(button.dataset.acvBookmarkId ?? "");
      return;
    }

    if (action === "insert-prompt") {
      await insertSelectedPromptIntoChatGpt();
      return;
    }

    if (action === "focus-message") {
      const messageIndex = Number(button.dataset.acvFocusMessageIndex);
      if (Number.isInteger(messageIndex)) {
        focusMessage(messageIndex);
      }
      return;
    }

    if (!state.conversation) {
      await captureFromActiveTab();
    }

    if (action === "copy") {
      await copyMarkdown();
      return;
    }

    if (action === "download") {
      downloadMarkdown();
    }
  } catch (error) {
    setStatus(error instanceof Error ? error.message : t("exportFailed"));
  }
}

function handlePopupInput(event: Event): void {
  const input = (event.target as HTMLElement).closest<HTMLInputElement>(
    "input[data-acv-message-search]"
  );
  if (input) {
    state.navigatorQuery = input.value;
    renderMessageNavigator();
    return;
  }

  const promptTitle = (event.target as HTMLElement).closest<HTMLInputElement>(
    "input[data-acv-prompt-title]"
  );
  if (promptTitle) {
    updateSelectedPromptSnippet({ title: promptTitle.value });
    setStatus(t("unsavedPromptChanges"));
    return;
  }

  const promptBody = (event.target as HTMLElement).closest<HTMLTextAreaElement>(
    "textarea[data-acv-prompt-body]"
  );
  if (promptBody) {
    updateSelectedPromptSnippet({ body: promptBody.value });
    setStatus(t("unsavedPromptChanges"));
    return;
  }

  const capsuleField = (event.target as HTMLElement).closest<
    HTMLInputElement | HTMLTextAreaElement
  >("[data-acv-capsule-field]");
  if (capsuleField) {
    if (capsuleField.dataset.acvCapsuleField === "contextPrompt") {
      state.workCapsuleContextPromptEdited = true;
    }
    updateWorkCapsuleDraftFromFields();
    setStatus(t("unsavedCapsuleChanges"));
    return;
  }

  const note = (event.target as HTMLElement).closest<HTMLTextAreaElement>(
    "textarea[data-acv-conversation-note]"
  );
  if (!note) {
    return;
  }

  state.conversationNote = note.value;
  void saveCurrentConversationNote();
}

function handlePopupChange(event: Event): void {
  const localeSelect = (event.target as HTMLElement).closest<HTMLSelectElement>(
    "select[data-acv-locale-select]"
  );
  if (localeSelect) {
    void updateLocale(localeFromValue(localeSelect.value));
    return;
  }

  const select = (event.target as HTMLElement).closest<HTMLSelectElement>(
    "select[data-acv-prompt-select]"
  );
  if (select) {
    state.selectedSnippetId = select.value;
    renderPromptEditor();
    return;
  }

  const roleFilter = (event.target as HTMLElement).closest<HTMLSelectElement>(
    "select[data-acv-role-filter]"
  );
  if (roleFilter) {
    state.navigatorRole = navigatorRoleFromValue(roleFilter.value);
    renderMessageNavigator();
    return;
  }

  const checkbox = (event.target as HTMLElement).closest<HTMLInputElement>(
    "input[data-acv-message-index]"
  );
  if (checkbox) {
    const messageIndex = Number(checkbox.dataset.acvMessageIndex);
    if (!Number.isInteger(messageIndex)) {
      return;
    }

    if (checkbox.checked) {
      state.selectedMessageIndexes.add(messageIndex);
    } else {
      state.selectedMessageIndexes.delete(messageIndex);
    }

    updatePreviewFromSelection();
    renderWorkCapsuleSection();
    return;
  }

  const presetSelect = (event.target as HTMLElement).closest<HTMLSelectElement>(
    "select[data-acv-capsule-preset]"
  );
  if (!presetSelect) {
    return;
  }

  if (isWorkCapsuleOutputPresetId(presetSelect.value)) {
    state.workCapsuleOutputPresetId = presetSelect.value;
    setStatus(selectedWorkCapsulePresetStatus());
  }
}

async function loadPromptLibrary(): Promise<void> {
  state.snippets = await loadPromptSnippets();
  state.selectedSnippetId = state.snippets[0]?.id ?? "";
  renderPromptLibrary();
}

async function captureFromActiveTab(): Promise<void> {
  setStatus(t("capturingActiveTab"));
  const tab = await activeTab();
  if (!tab.id) {
    throw new Error(t("noActiveTab"));
  }

  const url = new URL(tab.url ?? "about:blank");
  if (!isSupportedChatGptHost(url.hostname)) {
    throw new Error(t("openChatGptBeforeCapturing"));
  }

  const response = await sendCaptureMessage(tab.id);
  if (response.type !== CAPTURE_RESPONSE_TYPE) {
    throw new Error(t("unexpectedCaptureResponse"));
  }

  if ("error" in response && response.error) {
    throw new Error(response.error);
  }

  await updateCapturedConversation(response.conversation);
}

function activeTab(): Promise<chrome.tabs.Tab> {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(captureMessageError(lastError.message)));
        return;
      }

      const tab = tabs[0];
      if (!tab) {
        reject(new Error(t("noActiveTab")));
        return;
      }

      resolve(tab);
    });
  });
}

function sendCaptureMessage(tabId: number): Promise<CaptureResponse & { error?: string }> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(tabId, { type: CAPTURE_REQUEST_TYPE }, (response) => {
      const lastError = chrome.runtime.lastError;
      if (lastError) {
        reject(new Error(captureMessageError(lastError.message)));
        return;
      }

      if (!response) {
        reject(new Error(reloadChatGptTabMessage()));
        return;
      }

      resolve(response as CaptureResponse & { error?: string });
    });
  });
}

function sendInsertPromptMessage(
  tabId: number,
  prompt: string
): Promise<InsertPromptResponse & { error?: string }> {
  return new Promise((resolve, reject) => {
    chrome.tabs.sendMessage(
      tabId,
      { type: INSERT_PROMPT_REQUEST_TYPE, prompt },
      (response) => {
        const lastError = chrome.runtime.lastError;
        if (lastError) {
          reject(new Error(messageBridgeError(lastError.message, "inserting", t("promptInsertionFailed"))));
          return;
        }

        if (!response) {
          reject(new Error(reloadChatGptTabMessage("inserting")));
          return;
        }

        resolve(response as InsertPromptResponse & { error?: string });
      }
    );
  });
}

function captureMessageError(message?: string): string {
  return messageBridgeError(message, "Capture", t("captureFailed"));
}

function messageBridgeError(
  message: string | undefined,
  retryAction: string,
  fallback: string
): string {
  if (
    message?.includes("Receiving end does not exist") ||
    message?.includes("Could not establish connection")
  ) {
    return reloadChatGptTabMessage(retryAction);
  }

  return message ?? fallback;
}

function reloadChatGptTabMessage(retryAction = "Capture"): string {
  if (state.locale === "zh") {
    const action = retryAction === "inserting" ? "插入" : "捕获";
    return `安装或更新 AI Chat Vault 后请重新加载 ChatGPT 标签页，然后重试${action}。`;
  }

  return `Reload the ChatGPT tab after installing or updating AI Chat Vault, then try ${retryAction} again.`;
}

async function updateCapturedConversation(conversation: ConversationExport): Promise<void> {
  state.conversation = conversation;
  state.selectedMessageIndexes = allMessageIndexes(conversation.messages.length);
  state.title = conversation.title;
  state.markdown = conversationToMarkdown(conversation);
  state.navigatorQuery = "";
  state.navigatorRole = "all";
  state.focusedMessageIndex = null;
  state.conversationNoteIdentity = conversationNoteIdentity(conversation);
  state.workCapsuleDraft = null;
  state.workCapsuleContextPromptEdited = false;
  state.recentWorkCapsule = null;
  state.workCapsuleLibrary = [];
  const [conversationNote, bookmarks, recentWorkCapsule, workCapsuleLibrary] = await Promise.all([
    loadConversationNote(conversation),
    loadConversationBookmarks(),
    findMostRecentWorkCapsuleBySourceUrl(conversation.url),
    listWorkCapsules()
  ]);
  state.conversationNote = conversationNote;
  state.bookmarks = bookmarks;
  state.recentWorkCapsule = recentWorkCapsule;
  state.workCapsuleLibrary = workCapsuleLibrary;
  preview().value = state.markdown;
  renderConversationNotes();
  renderConversationBookmarks();
  renderWorkCapsuleSection();
  renderMessageList(conversation.messages);
  renderMessageNavigator();
  setStatus(capturedMessagesStatus(conversation.messages.length));
}

async function copyMarkdown(): Promise<void> {
  const markdown = selectedMarkdown();
  await navigator.clipboard.writeText(markdown);
  setStatus(t("copiedMarkdown"));
}

async function copySelectedPrompt(): Promise<void> {
  const prompt = selectedPromptBody();
  await navigator.clipboard.writeText(prompt);
  setStatus(t("copiedPrompt"));
}

async function insertSelectedPromptIntoChatGpt(): Promise<void> {
  const prompt = selectedPromptBody();
  const tab = await activeTab();
  if (!tab.id) {
    throw new Error(t("noActiveTab"));
  }

  const url = new URL(tab.url ?? "about:blank");
  if (!isSupportedChatGptHost(url.hostname)) {
    throw new Error(t("openChatGptBeforeInserting"));
  }

  const response = await sendInsertPromptMessage(tab.id, prompt);
  if (response.type !== INSERT_PROMPT_RESPONSE_TYPE) {
    throw new Error(t("unexpectedPromptResponse"));
  }

  if ("error" in response && response.error) {
    throw new Error(response.error);
  }

  if (!response.inserted) {
    throw new Error(t("chatGptComposerNotFound"));
  }

  setStatus(t("insertedPrompt"));
}

function downloadMarkdown(): void {
  const markdown = selectedMarkdown();
  downloadTextFile(markdown, markdownFilename(state.title));
  setStatus(t("downloadedMarkdown"));
}

function downloadTextFile(text: string, filename: string): void {
  const blob = new Blob([text], { type: "text/markdown;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function selectedMarkdown(): string {
  const conversation = selectedConversation();
  state.markdown = conversationToMarkdown(conversation);
  preview().value = state.markdown;
  return state.markdown;
}

function selectedConversation(): ConversationExport {
  if (!state.conversation) {
    throw new Error(t("captureBeforeExporting"));
  }

  if (state.conversation.messages.length === 0) {
    throw new Error(t("noMessagesToExport"));
  }

  const conversation = filterConversationMessages(state.conversation, state.selectedMessageIndexes);
  if (conversation.messages.length === 0) {
    throw new Error(t("selectOneMessageToExport"));
  }

  return conversation;
}

function updatePreviewFromSelection(): void {
  if (!state.conversation) {
    return;
  }

  const conversation = filterConversationMessages(state.conversation, state.selectedMessageIndexes);
  state.markdown = conversation.messages.length > 0 ? conversationToMarkdown(conversation) : "";
  preview().value = state.markdown;
  setStatus(
    conversation.messages.length > 0
      ? selectedMessagesStatus(conversation.messages.length, state.conversation.messages.length)
      : t("selectOneMessageToExport")
  );
}

function updateMessageSelection(mode: "all" | "none"): void {
  if (!state.conversation || state.conversation.messages.length === 0) {
    return;
  }

  state.selectedMessageIndexes = messageIndexesForSelection(
    state.conversation.messages.length,
    mode
  );
  syncMessageCheckboxes();
  updatePreviewFromSelection();
  renderWorkCapsuleSection();
}

function renderMessageList(messages: ConversationExport["messages"]): void {
  const panel = messagePanel();
  const list = messageList();
  list.textContent = "";
  panel.hidden = messages.length === 0;

  if (messages.length === 0) {
    return;
  }

  messages.forEach((message, index) => {
    const label = document.createElement("label");
    label.className = "acv-message-row";
    label.dataset.acvMessageRowIndex = String(index);
    label.tabIndex = -1;

    const checkbox = document.createElement("input");
    checkbox.type = "checkbox";
    checkbox.checked = state.selectedMessageIndexes.has(index);
    checkbox.dataset.acvMessageIndex = String(index);

    const details = document.createElement("span");
    details.className = "acv-message-details";

    const role = document.createElement("strong");
    role.textContent = message.speaker;

    const previewText = document.createElement("span");
    previewText.textContent = shortMessagePreview(message);

    details.append(role, previewText);
    label.append(checkbox, details);
    list.append(label);
  });

  syncFocusedMessage();
}

function syncMessageCheckboxes(): void {
  document
    .querySelectorAll<HTMLInputElement>("input[data-acv-message-index]")
    .forEach((checkbox) => {
      checkbox.checked = state.selectedMessageIndexes.has(Number(checkbox.dataset.acvMessageIndex));
    });
}

function renderMessageNavigator(): void {
  const conversation = state.conversation;
  const count = navigatorCount();
  const results = navigatorResults();
  const search = navigatorSearch();
  const roleFilter = navigatorRoleFilter();

  search.value = state.navigatorQuery;
  renderNavigatorRoleOptions(roleFilter);
  results.textContent = "";

  if (!conversation) {
    count.textContent = t("zeroTurns");
    return;
  }

  const resultIndexes = filteredNavigatorMessageIndexes(conversation);
  count.textContent = navigatorCountText(resultIndexes.length, conversation.messages.length);

  if (resultIndexes.length === 0) {
    const empty = document.createElement("div");
    empty.className = "acv-navigator-empty";
    empty.textContent = t("noMatchingTurns");
    results.append(empty);
    syncFocusedMessage();
    return;
  }

  resultIndexes.forEach((messageIndex) => {
    const message = conversation.messages[messageIndex];
    const result = document.createElement("button");
    result.type = "button";
    result.className = "acv-navigator-result";
    result.dataset.acvAction = "focus-message";
    result.dataset.acvFocusMessageIndex = String(messageIndex);

    const title = document.createElement("strong");
    title.textContent = `${messageIndex + 1}. ${navigatorRoleLabel(message.speaker)}`;

    const previewText = document.createElement("span");
    previewText.textContent = shortMessagePreview(message, 72);

    result.append(title, previewText);
    results.append(result);
  });

  syncFocusedMessage();
}

function renderNavigatorRoleOptions(select: HTMLSelectElement): void {
  if (!state.conversation) {
    select.textContent = "";
    return;
  }

  const counts = messageCountsByRole(state.conversation);
  select.textContent = "";

  NAVIGATOR_ROLES.forEach((role) => {
    const option = document.createElement("option");
    option.value = role;
    option.textContent = `${navigatorRoleLabel(role)} (${counts[role]})`;
    select.append(option);
  });

  select.value = state.navigatorRole;
}

function filteredNavigatorMessageIndexes(conversation: ConversationExport): number[] {
  const query = normalizeNavigatorQuery(state.navigatorQuery);
  const role = state.navigatorRole;

  return conversation.messages.flatMap((message, index) => {
    if (role !== "all" && message.speaker !== role) {
      return [];
    }

    const searchableText = `${message.speaker} ${message.text}`.toLowerCase();
    if (query && !searchableText.includes(query)) {
      return [];
    }

    return [index];
  });
}

function messageCountsByRole(conversation: ConversationExport): Record<MessageNavigatorRole, number> {
  const counts: Record<MessageNavigatorRole, number> = {
    all: conversation.messages.length,
    user: 0,
    assistant: 0,
    system: 0
  };

  conversation.messages.forEach((message) => {
    counts[message.speaker] += 1;
  });

  return counts;
}

function focusMessage(messageIndex: number): void {
  if (!state.conversation || messageIndex < 0 || messageIndex >= state.conversation.messages.length) {
    return;
  }

  state.focusedMessageIndex = messageIndex;
  syncFocusedMessage();

  const row = messageRow(messageIndex);
  if (typeof row?.scrollIntoView === "function") {
    row.scrollIntoView({ block: "nearest" });
  }
  row?.focus({ preventScroll: true });
  setStatus(focusedMessageStatus(messageIndex + 1, state.conversation.messages.length));
}

function renderConversationNotes(): void {
  const section = conversationNotesSection();
  const note = conversationNoteInput();
  const context = conversationNoteContext();

  section.hidden = !state.conversation;
  note.value = state.conversationNote;
  context.textContent = state.conversation
    ? shortConversationContext(state.conversation)
    : t("privateLocalNote");

  if (state.conversation) {
    section.dataset.acvNotesIdentity = state.conversationNoteIdentity;
    note.title = state.conversation.url || state.conversation.title;
  } else {
    delete section.dataset.acvNotesIdentity;
    note.removeAttribute("title");
  }
}

async function saveCurrentConversationNote(): Promise<void> {
  const conversation = state.conversation;
  const note = state.conversationNote;
  if (!conversation) {
    return;
  }

  try {
    await saveConversationNote(conversation, note);
    setStatus(t("savedConversationNote"));
  } catch {
    setStatus(t("couldNotSaveConversationNote"));
  }
}

async function saveCurrentConversationBookmark(): Promise<void> {
  const conversation = state.conversation;
  if (!conversation) {
    throw new Error(t("captureBeforeSavingBookmark"));
  }

  state.bookmarks = await upsertConversationBookmark({
    id: state.conversationNoteIdentity,
    title: conversation.title || "ChatGPT Conversation",
    url: conversation.url,
    savedAt: new Date().toISOString()
  });
  renderConversationBookmarks();
  setStatus(t("savedBookmark"));
}

async function copyConversationBookmark(id: string): Promise<void> {
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) {
    throw new Error(t("bookmarkNotFound"));
  }

  await navigator.clipboard.writeText(bookmark.url);
  setStatus(t("copiedBookmark"));
}

async function deleteCurrentConversationBookmark(id: string): Promise<void> {
  const bookmark = state.bookmarks.find((item) => item.id === id);
  if (!bookmark) {
    throw new Error(t("bookmarkNotFound"));
  }

  state.bookmarks = await deleteConversationBookmark(bookmark.id);
  renderConversationBookmarks();
  setStatus(t("deletedBookmark"));
}

function renderConversationBookmarks(): void {
  const section = conversationBookmarksSection();
  const context = conversationBookmarksContext();
  const list = conversationBookmarkList();

  section.hidden = !state.conversation;
  context.textContent = savedLinkCountText(state.bookmarks.length);
  list.textContent = "";

  if (!state.conversation) {
    return;
  }

  if (state.bookmarks.length === 0) {
    const empty = document.createElement("div");
    empty.className = "acv-bookmark-empty";
    empty.textContent = t("noSavedBookmarks");
    list.append(empty);
    return;
  }

  state.bookmarks.forEach((bookmark) => {
    const row = document.createElement("div");
    row.className = "acv-bookmark-row";
    row.dataset.acvBookmarkId = bookmark.id;

    const details = document.createElement("div");
    details.className = "acv-bookmark-details";

    const title = document.createElement("strong");
    title.textContent = bookmark.title;

    const url = document.createElement("span");
    url.textContent = bookmark.url;

    const actions = document.createElement("div");
    actions.className = "acv-bookmark-actions";

    const copyButton = document.createElement("button");
    copyButton.type = "button";
    copyButton.dataset.acvAction = "copy-bookmark";
    copyButton.dataset.acvBookmarkId = bookmark.id;
    copyButton.textContent = t("copyLink");

    const deleteButton = document.createElement("button");
    deleteButton.type = "button";
    deleteButton.dataset.acvAction = "delete-bookmark";
    deleteButton.dataset.acvBookmarkId = bookmark.id;
    deleteButton.textContent = t("delete");

    details.append(title, url);
    actions.append(copyButton, deleteButton);
    row.append(details, actions);
    list.append(row);
  });
}

function createCapsuleDraftFromSelection(): void {
  const conversation = selectedConversation();
  const selectedIndexes = sortedSelectedMessageIndexes();
  const now = new Date().toISOString();

  const draftWithoutContextPrompt: WorkCapsuleContextPromptSource = {
    schemaVersion: WORK_CAPSULE_SCHEMA_VERSION,
    id: uniqueWorkCapsuleId(),
    title: conversation.title || "ChatGPT Work Capsule",
    goal: defaultCapsuleGoal(conversation),
    reusableContext: selectedIndexes.map((messageIndex) => {
      const message = state.conversation?.messages[messageIndex];
      return message
        ? `${messageIndex + 1}. ${roleLabel(message.speaker)}: ${shortMessagePreview(message, 120)}`
        : `${messageIndex + 1}. ${t("selectedMessage")}`;
    }),
    decisions: [],
    constraints: [],
    facts: [],
    openQuestions: [],
    nextActions: [],
    artifacts: [],
    source: {
      provider: "chatgpt",
      title: conversation.title,
      url: conversation.url,
      selectedTurnIds: selectedIndexes.map(turnIdForMessageIndex)
    },
    sourceExcerptPolicy: "selected-excerpts",
    excerpts: selectedIndexes.map((messageIndex) => {
      const message = state.conversation?.messages[messageIndex];
      return {
        id: `excerpt-${messageIndex + 1}`,
        turnId: turnIdForMessageIndex(messageIndex),
        role: message?.speaker ?? "unknown",
        text: message?.text ?? ""
      };
    }),
    createdAt: now,
    updatedAt: now
  };
  state.workCapsuleDraft = {
    ...draftWithoutContextPrompt,
    contextPrompt: buildWorkCapsuleContextPrompt(draftWithoutContextPrompt)
  };
  state.workCapsuleContextPromptEdited = false;

  renderWorkCapsuleSection();
  setStatus(createdCapsuleDraftStatus(conversation.messages.length));
}

async function saveCurrentWorkCapsule(): Promise<void> {
  const capsule = currentWorkCapsuleDraft();
  await createWorkCapsule(capsule);
  await refreshSavedWorkCapsules();
  renderWorkCapsuleSection();
  setStatus(t("savedCapsule"));
}

async function refreshSavedWorkCapsules(): Promise<void> {
  const [recentWorkCapsule, workCapsuleLibrary] = await Promise.all([
    state.conversation ? findMostRecentWorkCapsuleBySourceUrl(state.conversation.url) : null,
    listWorkCapsules()
  ]);
  state.recentWorkCapsule = recentWorkCapsule;
  state.workCapsuleLibrary = workCapsuleLibrary;
}

async function reopenRecentWorkCapsule(): Promise<void> {
  if (!state.recentWorkCapsule) {
    throw new Error(t("noSavedCapsuleForConversation"));
  }

  state.workCapsuleDraft = state.recentWorkCapsule;
  state.workCapsuleContextPromptEdited = true;
  renderWorkCapsuleSection();
  setStatus(t("reopenedSavedCapsule"));
}

async function reuseRecentWorkCapsule(): Promise<void> {
  if (!state.recentWorkCapsule) {
    throw new Error(t("noSavedCapsuleForConversation"));
  }

  reuseWorkCapsuleDraft(state.recentWorkCapsule);
}

async function reopenWorkCapsuleById(id: string): Promise<void> {
  const capsule = await savedWorkCapsuleById(id);
  state.workCapsuleDraft = capsule;
  state.workCapsuleContextPromptEdited = true;
  renderWorkCapsuleSection();
  setStatus(t("reopenedSavedCapsule"));
}

async function reuseWorkCapsuleById(id: string): Promise<void> {
  const capsule = await savedWorkCapsuleById(id);
  reuseWorkCapsuleDraft(capsule);
}

function reuseWorkCapsuleDraft(savedCapsule: WorkCapsuleV1): void {
  const { source, excerpts } = currentWorkCapsuleSourceFromSelection();
  const now = new Date().toISOString();
  state.workCapsuleDraft = {
    schemaVersion: WORK_CAPSULE_SCHEMA_VERSION,
    id: uniqueWorkCapsuleId(),
    title: savedCapsule.title,
    ...(savedCapsule.project ? { project: savedCapsule.project } : {}),
    goal: savedCapsule.goal,
    contextPrompt: savedCapsule.contextPrompt,
    reusableContext: [...savedCapsule.reusableContext],
    decisions: savedCapsule.decisions.map((item) => ({ ...item })),
    constraints: savedCapsule.constraints.map((item) => ({ ...item })),
    facts: savedCapsule.facts.map((item) => ({ ...item })),
    openQuestions: savedCapsule.openQuestions.map((item) => ({ ...item })),
    nextActions: savedCapsule.nextActions.map((action) => ({ ...action })),
    artifacts: savedCapsule.artifacts.map((artifact) => ({ ...artifact })),
    source,
    sourceExcerptPolicy: "selected-excerpts",
    excerpts,
    createdAt: now,
    updatedAt: now
  };
  state.workCapsuleContextPromptEdited = true;
  renderWorkCapsuleSection();
  setStatus(t("createdUnsavedCapsule"));
}

async function deleteCurrentWorkCapsule(): Promise<void> {
  const capsule = state.workCapsuleDraft ? currentWorkCapsuleDraft() : state.recentWorkCapsule;
  if (!capsule) {
    throw new Error(t("noSavedCapsuleForConversation"));
  }

  if (!isSavedWorkCapsuleId(capsule.id)) {
    throw new Error(t("saveCapsuleBeforeDeleting"));
  }

  const confirmed = window.confirm(
    deleteWorkCapsuleConfirmText(capsule.title)
  );
  if (!confirmed) {
    setStatus(t("deleteCanceled"));
    return;
  }

  await deleteWorkCapsule(capsule.id);
  if (state.workCapsuleDraft?.id === capsule.id) {
    state.workCapsuleDraft = null;
    state.workCapsuleContextPromptEdited = false;
  }
  await refreshSavedWorkCapsules();

  renderWorkCapsuleSection();
  setStatus(t("deletedSavedCapsule"));
}

async function removeWorkCapsuleFromLibraryById(id: string): Promise<void> {
  const capsuleId = id.trim();
  if (!capsuleId) {
    throw new Error(t("savedCapsuleIdMissing"));
  }

  const libraryItem = state.workCapsuleLibrary.find((item) => item.id === capsuleId);
  if (!libraryItem) {
    await refreshSavedWorkCapsules();
    renderWorkCapsuleSection();
    setStatus(t("savedCapsuleNoLongerInLibrary"));
    return;
  }

  const confirmed = window.confirm(
    removeWorkCapsuleConfirmText(libraryItem.title)
  );
  if (!confirmed) {
    setStatus(t("capsuleRemoveCanceled"));
    return;
  }

  const savedCapsule = await getWorkCapsule(capsuleId);
  await deleteWorkCapsule(capsuleId);
  if (state.workCapsuleDraft?.id === capsuleId) {
    state.workCapsuleDraft = null;
    state.workCapsuleContextPromptEdited = false;
  }
  await refreshSavedWorkCapsules();

  renderWorkCapsuleSection();
  setStatus(
    savedCapsule
      ? t("removedSavedCapsule")
      : t("removedInvalidCapsule")
  );
}

async function copyCurrentWorkCapsuleContext(): Promise<void> {
  const capsule = currentWorkCapsuleDraft();
  await navigator.clipboard.writeText(selectedWorkCapsuleOutput(capsule));
  setStatus(copiedWorkCapsuleOutputStatus());
}

async function copyWorkCapsuleContextById(id: string): Promise<void> {
  const capsule = await savedWorkCapsuleById(id);
  await navigator.clipboard.writeText(selectedWorkCapsuleOutput(capsule));
  setStatus(copiedWorkCapsuleOutputStatus());
}

async function copyCurrentWorkCapsuleSourceCitation(): Promise<void> {
  const capsule = currentOrRecentWorkCapsule();
  await navigator.clipboard.writeText(renderWorkCapsuleSourceCitation(capsule));
  setStatus(t("copiedSourceCitation"));
}

async function copyWorkCapsuleSourceCitationById(id: string): Promise<void> {
  const capsule = await savedWorkCapsuleById(id);
  await navigator.clipboard.writeText(renderWorkCapsuleSourceCitation(capsule));
  setStatus(t("copiedSourceCitation"));
}

async function savedWorkCapsuleById(id: string): Promise<WorkCapsuleV1> {
  const capsuleId = id.trim();
  if (!capsuleId) {
    throw new Error(t("savedCapsuleIdMissing"));
  }

  const capsule = await getWorkCapsule(capsuleId);
  if (!capsule) {
    throw new Error(t("savedCapsuleLoadFailed"));
  }

  return capsule;
}

async function copyCurrentWorkCapsuleMarkdown(): Promise<void> {
  const capsule = currentWorkCapsuleDraft();
  await navigator.clipboard.writeText(renderWorkCapsuleMarkdown(capsule));
  setStatus(t("copiedCapsuleMarkdown"));
}

function currentOrRecentWorkCapsule(): WorkCapsuleV1 {
  if (state.workCapsuleDraft) {
    return currentWorkCapsuleDraft();
  }

  if (state.recentWorkCapsule) {
    return state.recentWorkCapsule;
  }

  throw new Error(t("createCapsuleBeforeAction"));
}

function downloadCurrentWorkCapsule(): void {
  const capsule = currentWorkCapsuleDraft();
  downloadTextFile(
    renderWorkCapsuleMarkdown(capsule),
    markdownFilename(capsule.title || "work-capsule")
  );
  setStatus(t("downloadedCapsuleMarkdown"));
}

function currentWorkCapsuleDraft(): WorkCapsuleV1 {
  updateWorkCapsuleDraftFromFields();
  if (!state.workCapsuleDraft) {
    throw new Error(t("createCapsuleBeforeAction"));
  }

  return state.workCapsuleDraft;
}

function updateWorkCapsuleDraftFromFields(): void {
  const draft = state.workCapsuleDraft;
  if (!draft) {
    return;
  }

  const { project: _previousProject, ...draftWithoutProject } = draft;
  const nextDraftWithoutContextPrompt = {
    ...draftWithoutProject,
    title: stringFieldValue("title") || t("untitledWorkCapsule"),
    ...optionalCapsuleField("project"),
    goal: stringFieldValue("goal") || t("defaultCapsuleGoal"),
    reusableContext: textAreaLines("reusableContext"),
    decisions: workCapsuleItems("decisions", "decision", draft.decisions),
    constraints: workCapsuleItems("constraints", "constraint", draft.constraints),
    facts: workCapsuleItems("facts", "fact", draft.facts),
    openQuestions: workCapsuleItems("openQuestions", "question", draft.openQuestions),
    nextActions: workCapsuleActions(draft.nextActions),
    artifacts: workCapsuleArtifacts(draft.artifacts),
    updatedAt: new Date().toISOString()
  };

  state.workCapsuleDraft = {
    ...nextDraftWithoutContextPrompt,
    contextPrompt: state.workCapsuleContextPromptEdited
      ? stringFieldValue("contextPrompt")
      : buildWorkCapsuleContextPrompt(nextDraftWithoutContextPrompt)
  };

  if (!state.workCapsuleContextPromptEdited) {
    setCapsuleFieldValue("contextPrompt", state.workCapsuleDraft.contextPrompt);
  }
}

function renderWorkCapsuleSection(): void {
  const section = workCapsuleSection();
  const fields = workCapsuleFields();
  const context = workCapsuleContext();
  const recent = workCapsuleRecent();
  const library = workCapsuleLibrary();
  const draft = state.workCapsuleDraft;
  const deleteButton = workCapsuleDeleteButton();

  section.hidden = !state.conversation;
  fields.hidden = !draft;
  recent.hidden = !state.conversation || !state.recentWorkCapsule || !!draft;
  library.hidden = !state.conversation || state.workCapsuleLibrary.length === 0;
  recent.textContent = "";
  library.textContent = "";
  deleteButton.hidden = !draft || !isSavedWorkCapsuleId(draft.id);
  renderWorkCapsulePresetOptions(workCapsulePresetSelect());

  if (!state.conversation) {
    context.textContent = t("localDraft");
    return;
  }

  const selectedCount = state.selectedMessageIndexes.size;
  const draftSelectedTurnCount = draft?.source.selectedTurnIds.length ?? 0;
  context.textContent = draft
    ? selectedTurnCountText(draftSelectedTurnCount, !isSavedWorkCapsuleId(draft.id))
    : state.recentWorkCapsule
      ? recentCapsuleAvailableText()
    : selectedTurnCountText(selectedCount);

  if (state.recentWorkCapsule && !draft) {
    renderRecentWorkCapsule(state.recentWorkCapsule, recent);
  }

  if (state.workCapsuleLibrary.length > 0) {
    renderWorkCapsuleLibrary(library);
  }

  if (!draft) {
    return;
  }

  setCapsuleFieldValue("title", draft.title);
  setCapsuleFieldValue("project", draft.project ?? "");
  setCapsuleFieldValue("goal", draft.goal);
  setCapsuleFieldValue("contextPrompt", draft.contextPrompt);
  setCapsuleFieldValue("reusableContext", draft.reusableContext.join("\n"));
  setCapsuleFieldValue("decisions", draft.decisions.map((item) => item.text).join("\n"));
  setCapsuleFieldValue("constraints", draft.constraints.map((item) => item.text).join("\n"));
  setCapsuleFieldValue("facts", draft.facts.map((item) => item.text).join("\n"));
  setCapsuleFieldValue("openQuestions", draft.openQuestions.map((item) => item.text).join("\n"));
  setCapsuleFieldValue("nextActions", draft.nextActions.map((action) => action.text).join("\n"));
  setCapsuleFieldValue(
    "artifacts",
    draft.artifacts.map(artifactMarkdownInput).join("\n\n")
  );
}

function isSavedWorkCapsuleId(id: string): boolean {
  return (
    state.recentWorkCapsule?.id === id ||
    state.workCapsuleLibrary.some((capsule) => capsule.id === id)
  );
}

function selectedWorkCapsuleOutput(capsule: WorkCapsuleV1): string {
  return renderWorkCapsuleOutputPreset(capsule, state.workCapsuleOutputPresetId);
}

function selectedWorkCapsuleOutputPresetName(): string {
  return WORK_CAPSULE_OUTPUT_PRESETS.find(
    (preset) => preset.id === state.workCapsuleOutputPresetId
  )?.name ?? "Work Capsule context";
}

function renderWorkCapsulePresetOptions(select: HTMLSelectElement): void {
  select.textContent = "";

  WORK_CAPSULE_OUTPUT_PRESETS.forEach((preset) => {
    const option = document.createElement("option");
    option.value = preset.id;
    option.textContent = preset.name;
    select.append(option);
  });

  select.value = state.workCapsuleOutputPresetId;
}

function renderRecentWorkCapsule(capsule: WorkCapsuleV1, container: HTMLDivElement): void {
  const details = document.createElement("div");
  details.className = "acv-work-capsule-recent-details";

  const title = document.createElement("strong");
  title.textContent = capsule.title;

  const label = document.createElement("span");
  label.textContent = workCapsuleDisplayLabel(capsule);

  const updated = document.createElement("span");
  updated.textContent = updatedAtText(capsule.updatedAt);

  const button = document.createElement("button");
  button.type = "button";
  button.dataset.acvAction = "reopen-capsule";
  button.textContent = t("reopen");

  const reuseButton = document.createElement("button");
  reuseButton.type = "button";
  reuseButton.dataset.acvAction = "reuse-capsule";
  reuseButton.textContent = t("reuse");

  const copySourceButton = document.createElement("button");
  copySourceButton.type = "button";
  copySourceButton.dataset.acvAction = "copy-capsule-source-citation";
  copySourceButton.textContent = t("copySource");

  const deleteButton = document.createElement("button");
  deleteButton.type = "button";
  deleteButton.dataset.acvAction = "delete-capsule";
  deleteButton.textContent = t("delete");

  const actions = document.createElement("div");
  actions.className = "acv-work-capsule-recent-actions";
  actions.append(button, reuseButton, copySourceButton, deleteButton);

  details.append(title, label, updated);
  container.append(details, actions);
}

function renderWorkCapsuleLibrary(container: HTMLDivElement): void {
  const heading = document.createElement("div");
  heading.className = "acv-work-capsule-library-heading";

  const title = document.createElement("strong");
  title.textContent = t("library");

  const visibleCapsules = state.workCapsuleLibrary.slice(0, WORK_CAPSULE_LIBRARY_LIMIT);
  const count = visibleCapsules.length;
  const summary = document.createElement("span");
  summary.textContent = recentSavedCapsulesText(count);

  heading.append(title, summary);

  const list = document.createElement("div");
  list.className = "acv-work-capsule-library-list";

  groupWorkCapsuleLibraryItems(visibleCapsules).forEach((group) => {
    const groupElement = document.createElement("div");
    groupElement.className = "acv-work-capsule-library-group";

    const groupHeading = document.createElement("div");
    groupHeading.className = "acv-work-capsule-library-group-heading";
    groupHeading.dataset.acvWorkCapsuleLibraryGroup = group.heading;
    groupHeading.textContent = group.heading;

    const groupRows = document.createElement("div");
    groupRows.className = "acv-work-capsule-library-group-rows";
    group.items.forEach((capsule) => {
      groupRows.append(renderWorkCapsuleLibraryRow(capsule));
    });

    groupElement.append(groupHeading, groupRows);
    list.append(groupElement);
  });

  container.append(heading, list);
}

function groupWorkCapsuleLibraryItems(
  capsules: WorkCapsuleIndexItem[]
): Array<{ heading: string; items: WorkCapsuleIndexItem[] }> {
  const groups: Array<{ heading: string; items: WorkCapsuleIndexItem[] }> = [];
  const groupByHeading = new Map<string, { heading: string; items: WorkCapsuleIndexItem[] }>();

  capsules.forEach((capsule) => {
    const heading = workCapsuleLibraryGroupHeading(capsule);
    const existingGroup = groupByHeading.get(heading);
    if (existingGroup) {
      existingGroup.items.push(capsule);
      return;
    }

    const group = { heading, items: [capsule] };
    groups.push(group);
    groupByHeading.set(heading, group);
  });

  return groups;
}

function workCapsuleLibraryGroupHeading(capsule: WorkCapsuleIndexItem): string {
  return (
    compactFieldLine(capsule.project ?? "") ||
    compactFieldLine(capsule.sourceTitle) ||
    t("unknownSource")
  );
}

function renderWorkCapsuleLibraryRow(capsule: WorkCapsuleIndexItem): HTMLDivElement {
  const row = document.createElement("div");
  row.className = "acv-work-capsule-library-row";
  row.dataset.acvCapsuleId = capsule.id;

  const details = document.createElement("div");
  details.className = "acv-work-capsule-library-details";

  const title = document.createElement("strong");
  title.textContent = capsule.title;

  const goal = document.createElement("span");
  goal.textContent = capsule.goal || workCapsuleLibraryLabel(capsule);

  const source = document.createElement("span");
  source.textContent = workCapsuleLibraryLabel(capsule);

  const updated = document.createElement("span");
  updated.textContent = updatedAtText(capsule.updatedAt);

  details.append(title, goal, source, updated);

  const reopenButton = document.createElement("button");
  reopenButton.type = "button";
  reopenButton.dataset.acvAction = "reopen-library-capsule";
  reopenButton.dataset.acvCapsuleId = capsule.id;
  reopenButton.textContent = t("reopen");

  const reuseButton = document.createElement("button");
  reuseButton.type = "button";
  reuseButton.dataset.acvAction = "reuse-library-capsule";
  reuseButton.dataset.acvCapsuleId = capsule.id;
  reuseButton.textContent = t("reuse");

  const copyButton = document.createElement("button");
  copyButton.type = "button";
  copyButton.dataset.acvAction = "copy-library-capsule-context";
  copyButton.dataset.acvCapsuleId = capsule.id;
  copyButton.textContent = t("copyContext");

  const copySourceButton = document.createElement("button");
  copySourceButton.type = "button";
  copySourceButton.dataset.acvAction = "copy-library-capsule-source-citation";
  copySourceButton.dataset.acvCapsuleId = capsule.id;
  copySourceButton.textContent = t("copySource");

  const removeButton = document.createElement("button");
  removeButton.type = "button";
  removeButton.dataset.acvAction = "remove-library-capsule";
  removeButton.dataset.acvCapsuleId = capsule.id;
  removeButton.textContent = t("remove");

  const actions = document.createElement("div");
  actions.className = "acv-work-capsule-library-actions";
  actions.append(reopenButton, reuseButton, copyButton, copySourceButton, removeButton);

  row.append(details, actions);
  return row;
}

function workCapsuleLibraryLabel(capsule: WorkCapsuleIndexItem): string {
  return workCapsuleDisplayLabel(capsule);
}

function workCapsuleDisplayLabel(capsule: {
  project?: string;
  source?: { title: string; url: string };
  sourceTitle?: string;
  sourceUrl?: string;
}): string {
  const project = capsule.project ? compactFieldLine(capsule.project) : "";
  const sourceTitle = "source" in capsule ? capsule.source?.title : capsule.sourceTitle;
  const sourceUrl = "source" in capsule ? capsule.source?.url : capsule.sourceUrl;
  return project || sourceTitle || sourceUrl || t("unknownSource");
}

function artifactMarkdownInput(artifact: WorkCapsuleArtifact): string {
  const body = artifact.body.trim();
  return body ? `${artifact.title}\n${body}` : artifact.title;
}

function workCapsuleItems(
  field: string,
  prefix: string,
  existingItems: WorkCapsuleItem[] = []
): WorkCapsuleItem[] {
  return textAreaLines(field).map((text, index) => ({
    id: existingItems[index]?.id ?? `${prefix}-${index + 1}`,
    text
  }));
}

function workCapsuleActions(existingActions: WorkCapsuleAction[] = []): WorkCapsuleAction[] {
  return textAreaLines("nextActions").map((text, index) => {
    const existingAction = existingActions[index];
    const owner = existingAction ? existingAction.owner : "user";

    return {
      id: existingAction?.id ?? `action-${index + 1}`,
      text,
      status: existingAction?.status ?? "todo",
      ...(owner ? { owner } : {})
    };
  });
}

function workCapsuleArtifacts(
  existingArtifacts: WorkCapsuleArtifact[] = []
): WorkCapsuleArtifact[] {
  return splitTextBlocks(stringFieldValue("artifacts")).map((block, index) => {
    const lines = block.split(/\r?\n/);
    const title = compactFieldLine(lines[0]) || `Artifact ${index + 1}`;
    const body = lines.slice(1).join("\n").trim() || title;
    const existingArtifact = existingArtifacts[index];

    return {
      id: existingArtifact?.id ?? `artifact-${index + 1}`,
      type: existingArtifact?.type ?? "other",
      title,
      body
    };
  });
}

function textAreaLines(field: string): string[] {
  return stringFieldValue(field)
    .split(/\r?\n/)
    .map(compactFieldLine)
    .filter(Boolean);
}

function splitTextBlocks(value: string): string[] {
  return value
    .split(/\n\s*\n/)
    .map((block) => block.trim())
    .filter(Boolean);
}

function stringFieldValue(field: string): string {
  return workCapsuleField(field)?.value.trim() ?? "";
}

function optionalCapsuleField(field: string): Record<string, string> {
  const value = compactFieldLine(stringFieldValue(field));
  return value ? { [field]: value } : {};
}

function setCapsuleFieldValue(field: string, value: string): void {
  const input = workCapsuleField(field);
  if (input) {
    input.value = value;
  }
}

function workCapsuleField(field: string): HTMLInputElement | HTMLTextAreaElement | null {
  return document.querySelector<HTMLInputElement | HTMLTextAreaElement>(
    `[data-acv-capsule-field="${field}"]`
  );
}

function workCapsuleDeleteButton(): HTMLButtonElement {
  const button = document.querySelector<HTMLButtonElement>(
    'button[data-acv-action="delete-capsule"][data-acv-capsule-draft-action="true"]'
  );
  if (!button) {
    throw new Error(t("workCapsuleDeleteUnavailable"));
  }

  return button;
}

function sortedSelectedMessageIndexes(): number[] {
  return Array.from(state.selectedMessageIndexes).sort((first, second) => first - second);
}

function currentWorkCapsuleSourceFromSelection(): Pick<
  WorkCapsuleV1,
  "source" | "excerpts"
> {
  const conversation = state.conversation;
  if (!conversation) {
    throw new Error(t("captureBeforeReusingCapsule"));
  }

  if (conversation.messages.length === 0) {
    throw new Error(t("noMessagesToReuse"));
  }

  const selectedIndexes = sortedSelectedMessageIndexes();
  if (selectedIndexes.length === 0) {
    throw new Error(t("selectOneMessageToReuse"));
  }

  return {
    source: {
      provider: "chatgpt",
      title: conversation.title,
      url: conversation.url,
      selectedTurnIds: selectedIndexes.map(turnIdForMessageIndex)
    },
    excerpts: selectedIndexes.map((messageIndex) => {
      const message = conversation.messages[messageIndex];
      return {
        id: `excerpt-${messageIndex + 1}`,
        turnId: turnIdForMessageIndex(messageIndex),
        role: message?.speaker ?? "unknown",
        text: message?.text ?? ""
      };
    })
  };
}

function turnIdForMessageIndex(messageIndex: number): string {
  return `message-${messageIndex + 1}`;
}

function roleLabel(speaker: Speaker): string {
  return speaker.charAt(0).toUpperCase() + speaker.slice(1);
}

function defaultCapsuleGoal(conversation: ConversationExport): string {
  return `Reuse selected context from ${conversation.title || "this ChatGPT conversation"}.`;
}

function uniqueWorkCapsuleId(): string {
  return `capsule-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

function compactFieldLine(value: string): string {
  return value.trim().replace(/^[-*]\s+/, "").replace(/\s+/g, " ");
}

function shortConversationContext(conversation: ConversationExport): string {
  const label = conversation.title.trim() || conversation.url.trim() || t("currentConversation");
  return label.length > 38 ? `${label.slice(0, 35)}...` : label;
}

function syncFocusedMessage(): void {
  document
    .querySelectorAll<HTMLElement>("[data-acv-message-row-index]")
    .forEach((row) => {
      const isFocused = Number(row.dataset.acvMessageRowIndex) === state.focusedMessageIndex;
      row.classList.toggle("is-focused", isFocused);
      if (isFocused) {
        row.setAttribute("aria-current", "true");
      } else {
        row.removeAttribute("aria-current");
      }
    });

  document
    .querySelectorAll<HTMLButtonElement>("button[data-acv-focus-message-index]")
    .forEach((button) => {
      button.classList.toggle(
        "is-focused",
        Number(button.dataset.acvFocusMessageIndex) === state.focusedMessageIndex
      );
    });
}

function normalizeNavigatorQuery(value: string): string {
  return value.trim().replace(/\s+/g, " ").toLowerCase();
}

function navigatorRoleFromValue(value: string): MessageNavigatorRole {
  return NAVIGATOR_ROLES.includes(value as MessageNavigatorRole)
    ? (value as MessageNavigatorRole)
    : "all";
}

function renderPromptLibrary(): void {
  const select = promptSelect();
  select.textContent = "";

  if (!state.snippets.some((snippet) => snippet.id === state.selectedSnippetId)) {
    state.selectedSnippetId = state.snippets[0]?.id ?? "";
  }

  state.snippets.forEach((snippet) => {
    const option = document.createElement("option");
    option.value = snippet.id;
    option.textContent = snippet.title;
    select.append(option);
  });

  select.value = state.selectedSnippetId;
  renderPromptEditor();
}

function renderPromptEditor(): void {
  const snippet = selectedPromptSnippet();
  promptTitleInput().value = snippet?.title ?? "";
  promptBodyInput().value = snippet?.body ?? "";
}

function createPromptSnippet(): void {
  const snippet = {
    id: uniquePromptSnippetId(),
    title: nextPromptSnippetTitle(),
    body: ""
  };
  state.snippets = [...state.snippets, snippet];
  state.selectedSnippetId = snippet.id;
  renderPromptLibrary();
  promptTitleInput().focus();
  setStatus(t("newPromptSnippet"));
}

async function saveCurrentPromptSnippet(): Promise<void> {
  const snippet = selectedPromptSnippet();
  if (!snippet) {
    throw new Error(t("noPromptSelected"));
  }

  const title = normalizedPromptTitle(promptTitleInput().value);
  const body = promptBodyInput().value;
  if (!title) {
    throw new Error(t("addSlashCommand"));
  }

  if (body.trim().length === 0) {
    throw new Error(t("addPromptBody"));
  }

  updateSelectedPromptSnippet({ title, body });
  const selectedId = state.selectedSnippetId;
  await savePromptSnippets(state.snippets);
  state.snippets = await loadPromptSnippets();
  state.selectedSnippetId = state.snippets.some((item) => item.id === selectedId)
    ? selectedId
    : state.snippets[0]?.id ?? "";
  renderPromptLibrary();
  setStatus(t("savedPromptSnippet"));
}

async function deleteCurrentPromptSnippet(): Promise<void> {
  const selectedIndex = state.snippets.findIndex(
    (snippet) => snippet.id === state.selectedSnippetId
  );
  if (selectedIndex === -1) {
    throw new Error(t("noPromptSelected"));
  }

  const remaining = state.snippets.filter((snippet) => snippet.id !== state.selectedSnippetId);
  state.snippets = remaining;
  state.selectedSnippetId =
    state.snippets[Math.min(selectedIndex, state.snippets.length - 1)]?.id ?? "";

  await savePromptSnippets(state.snippets);
  renderPromptLibrary();
  setStatus(t("deletedPromptSnippet"));
}

function updateSelectedPromptSnippet(fields: Partial<Pick<PromptSnippet, "title" | "body">>): void {
  state.snippets = state.snippets.map((snippet) =>
    snippet.id === state.selectedSnippetId ? { ...snippet, ...fields } : snippet
  );
}

function selectedPromptBody(options: { allowEmpty?: boolean } = {}): string {
  const snippet = selectedPromptSnippet();
  if (!snippet) {
    if (options.allowEmpty) {
      return "";
    }

    throw new Error(t("noPromptSelected"));
  }

  if (!options.allowEmpty && snippet.body.trim().length === 0) {
    throw new Error(t("promptBodyEmpty"));
  }

  return snippet.body;
}

function selectedPromptSnippet(): PromptSnippet | undefined {
  return state.snippets.find((item) => item.id === state.selectedSnippetId);
}

function normalizedPromptTitle(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) {
    return "";
  }

  return trimmed.startsWith("/") ? trimmed : `/${trimmed}`;
}

function nextPromptSnippetTitle(): string {
  const existingTitles = new Set(state.snippets.map((snippet) => snippet.title));
  let index = 1;
  let title = "/new-prompt";
  while (existingTitles.has(title)) {
    index += 1;
    title = `/new-prompt-${index}`;
  }
  return title;
}

function uniquePromptSnippetId(): string {
  const existingIds = new Set(state.snippets.map((snippet) => snippet.id));
  let id = "";
  do {
    id = `snippet-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
  } while (existingIds.has(id));
  return id;
}

function popupRoot(): HTMLDivElement {
  const root = document.querySelector<HTMLDivElement>("#root");
  if (!root) {
    throw new Error("Popup root is unavailable");
  }

  return root;
}

function capturedMessagesStatus(count: number): string {
  return state.locale === "zh"
    ? `已捕获 ${count} 条消息`
    : `Captured ${count} message${count === 1 ? "" : "s"}`;
}

function selectedMessagesStatus(selectedCount: number, totalCount: number): string {
  return state.locale === "zh"
    ? `已选择 ${selectedCount} / ${totalCount} 条消息`
    : `Selected ${selectedCount} of ${totalCount} messages`;
}

function navigatorCountText(resultCount: number, totalCount: number): string {
  return state.locale === "zh"
    ? `${resultCount} / ${totalCount} 轮`
    : `${resultCount} of ${totalCount} turns`;
}

function focusedMessageStatus(messageIndex: number, totalCount: number): string {
  return state.locale === "zh"
    ? `已聚焦第 ${messageIndex} / ${totalCount} 条消息`
    : `Focused message ${messageIndex} of ${totalCount}`;
}

function savedLinkCountText(count: number): string {
  return state.locale === "zh"
    ? `已保存 ${count} 个链接`
    : `${count} saved link${count === 1 ? "" : "s"}`;
}

function createdCapsuleDraftStatus(count: number): string {
  return state.locale === "zh"
    ? `已从 ${count} 条已选消息创建胶囊草稿`
    : `Created capsule draft from ${count} selected message${count === 1 ? "" : "s"}`;
}

function selectedTurnCountText(count: number, isUnsavedDraft = false): string {
  if (state.locale === "zh") {
    return `已选 ${count} 轮${isUnsavedDraft ? " - 未保存草稿" : ""}`;
  }

  return `${count} selected turn${count === 1 ? "" : "s"}${isUnsavedDraft ? " - unsaved draft" : ""}`;
}

function recentCapsuleAvailableText(): string {
  return state.locale === "zh" ? "有可用的最近胶囊" : "Recent capsule available";
}

function recentSavedCapsulesText(count: number): string {
  return state.locale === "zh"
    ? `${count} 个最近保存的胶囊`
    : `${count} recent saved capsule${count === 1 ? "" : "s"}`;
}

function updatedAtText(value: string): string {
  return state.locale === "zh" ? `更新于 ${value}` : `Updated ${value}`;
}

function selectedWorkCapsulePresetStatus(): string {
  const name = selectedWorkCapsuleOutputPresetName();
  return state.locale === "zh" ? `已选择 ${name}` : `Selected ${name}`;
}

function copiedWorkCapsuleOutputStatus(): string {
  const name = selectedWorkCapsuleOutputPresetName();
  return state.locale === "zh" ? `已复制 ${name} 到剪贴板` : `Copied ${name} to clipboard`;
}

function deleteWorkCapsuleConfirmText(title: string): string {
  return state.locale === "zh"
    ? `从此浏览器删除已保存的工作胶囊 "${title}"？`
    : `Delete saved Work Capsule "${title}" from this browser?`;
}

function removeWorkCapsuleConfirmText(title: string): string {
  return state.locale === "zh"
    ? `从此浏览器移除已保存的工作胶囊 "${title}"？`
    : `Remove saved Work Capsule "${title}" from this browser?`;
}

function preview(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[aria-label='Markdown preview']");
  if (!textarea) {
    throw new Error(t("previewUnavailable"));
  }
  return textarea;
}

function promptSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-prompt-select]");
  if (!select) {
    throw new Error(t("promptSelectorUnavailable"));
  }
  return select;
}

function promptTitleInput(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[data-acv-prompt-title]");
  if (!input) {
    throw new Error(t("promptTitleUnavailable"));
  }
  return input;
}

function promptBodyInput(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>("textarea[data-acv-prompt-body]");
  if (!textarea) {
    throw new Error(t("promptBodyUnavailable"));
  }
  return textarea;
}

function conversationNotesSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-conversation-notes");
  if (!section) {
    throw new Error(t("notesSectionUnavailable"));
  }
  return section;
}

function conversationNoteInput(): HTMLTextAreaElement {
  const textarea = document.querySelector<HTMLTextAreaElement>(
    "textarea[data-acv-conversation-note]"
  );
  if (!textarea) {
    throw new Error(t("noteInputUnavailable"));
  }
  return textarea;
}

function conversationNoteContext(): HTMLSpanElement {
  const context = document.querySelector<HTMLSpanElement>("[data-acv-notes-context]");
  if (!context) {
    throw new Error(t("notesContextUnavailable"));
  }
  return context;
}

function conversationBookmarksSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-conversation-bookmarks");
  if (!section) {
    throw new Error(t("bookmarksSectionUnavailable"));
  }
  return section;
}

function conversationBookmarksContext(): HTMLSpanElement {
  const context = document.querySelector<HTMLSpanElement>("[data-acv-bookmarks-context]");
  if (!context) {
    throw new Error(t("bookmarksContextUnavailable"));
  }
  return context;
}

function conversationBookmarkList(): HTMLDivElement {
  const list = document.querySelector<HTMLDivElement>(".acv-bookmark-list");
  if (!list) {
    throw new Error(t("bookmarkListUnavailable"));
  }
  return list;
}

function workCapsuleSection(): HTMLElement {
  const section = document.querySelector<HTMLElement>(".acv-work-capsule");
  if (!section) {
    throw new Error(t("workCapsuleSectionUnavailable"));
  }
  return section;
}

function workCapsuleFields(): HTMLDivElement {
  const fields = document.querySelector<HTMLDivElement>(".acv-work-capsule-fields");
  if (!fields) {
    throw new Error(t("workCapsuleFieldsUnavailable"));
  }
  return fields;
}

function workCapsuleRecent(): HTMLDivElement {
  const recent = document.querySelector<HTMLDivElement>(".acv-work-capsule-recent");
  if (!recent) {
    throw new Error(t("recentWorkCapsuleUnavailable"));
  }
  return recent;
}

function workCapsuleLibrary(): HTMLDivElement {
  const library = document.querySelector<HTMLDivElement>(".acv-work-capsule-library");
  if (!library) {
    throw new Error(t("workCapsuleLibraryUnavailable"));
  }

  return library;
}

function workCapsulePresetSelect(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-capsule-preset]");
  if (!select) {
    throw new Error(t("workCapsulePresetUnavailable"));
  }

  return select;
}

function workCapsuleContext(): HTMLSpanElement {
  const context = document.querySelector<HTMLSpanElement>("[data-acv-work-capsule-context]");
  if (!context) {
    throw new Error(t("workCapsuleContextUnavailable"));
  }
  return context;
}

function messagePanel(): HTMLDivElement {
  const panel = document.querySelector<HTMLDivElement>(".acv-message-panel");
  if (!panel) {
    throw new Error(t("messageSelectionUnavailable"));
  }
  return panel;
}

function messageList(): HTMLDivElement {
  const list = document.querySelector<HTMLDivElement>(".acv-message-list");
  if (!list) {
    throw new Error(t("messageSelectionUnavailable"));
  }
  return list;
}

function navigatorSearch(): HTMLInputElement {
  const input = document.querySelector<HTMLInputElement>("input[data-acv-message-search]");
  if (!input) {
    throw new Error(t("messageSearchUnavailable"));
  }
  return input;
}

function navigatorRoleFilter(): HTMLSelectElement {
  const select = document.querySelector<HTMLSelectElement>("select[data-acv-role-filter]");
  if (!select) {
    throw new Error(t("messageRoleFilterUnavailable"));
  }
  return select;
}

function navigatorCount(): HTMLSpanElement {
  const count = document.querySelector<HTMLSpanElement>("[data-acv-navigator-count]");
  if (!count) {
    throw new Error(t("navigatorCountUnavailable"));
  }
  return count;
}

function navigatorResults(): HTMLDivElement {
  const results = document.querySelector<HTMLDivElement>(".acv-navigator-results");
  if (!results) {
    throw new Error(t("navigatorResultsUnavailable"));
  }
  return results;
}

function messageRow(messageIndex: number): HTMLElement | null {
  return document.querySelector<HTMLElement>(`[data-acv-message-row-index="${messageIndex}"]`);
}

function setStatus(message: string): void {
  const status = document.querySelector<HTMLElement>(".acv-status");
  if (status) {
    status.textContent = message;
  }
}
