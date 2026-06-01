# Product Direction: Reusable Work Memory

June 2026

## Ownership

Hermes owns product direction for AI Chat Vault. Scheduled autonomous iterations should use this document as the product north star, choose from the ranked roadmap, and avoid opportunistic utility work unless it clearly advances reusable work memory.

## Current Diagnosis

AI Chat Vault currently works as a compact Chrome MV3 toolkit for local-first ChatGPT workflows: capture, selected-message Markdown export, prompt snippets, notes, bookmarks, and a message navigator. That foundation is useful, but it is still mostly a better clipboard and filing cabinet for one chat at a time.

Recent autonomous iterations underwhelmed because they added nearby utilities instead of changing the core workflow:

- Notes and bookmarks are practical, but they sit beside the conversation instead of turning the conversation into reusable context.
- The message navigator improves inspection after capture, but it does not help the next AI session start smarter.
- Prompt snippets help input, while the product's strongest source material is actually the output users already earned through long chats.
- Each feature is individually reasonable, but the combined product still feels like export/search/bookmark plumbing.
- The user-visible payoff is incremental. The product needs a sharper "I can now reuse this work" moment.

The diagnosis is not that the existing work was wrong. The issue is that the product has been optimizing the edges of capture/export instead of owning the higher-value job: converting AI conversations into portable, inspectable, reusable work memory.

## Competitor And Market Signals

Export, bookmark, and search are crowded categories. Browser extensions, native browser affordances, note apps, and AI product sidebars can all copy, save, summarize, or find chat content. Competing only on export polish is fragile because it is easy to imitate and often becomes a checklist feature.

The stronger market signal is that AI products are moving toward persistent context:

- OpenAI documents ChatGPT memory as saved memories plus reference chat history, and positions memory as a way for ChatGPT to remember project and preference context across chats: <https://help.openai.com/en/articles/8590148-memory-faq>
- OpenAI Projects group chats, uploaded files, and instructions so work can stay focused on a topic: <https://help.openai.com/en/articles/10169521-using-projects-in-chatgpt>
- Anthropic Projects provide a project knowledge base, and Anthropic documents RAG behavior for larger project knowledge: <https://support.anthropic.com/en/articles/9519177-how-can-i-create-and-manage-projects>
- Anthropic introduced the Model Context Protocol as an open standard for connecting assistants to the systems where data lives, and later donated MCP to the Linux Foundation's Agentic AI Foundation with support from major AI ecosystem participants: <https://www.anthropic.com/news/model-context-protocol> and <https://www.anthropic.com/news/donating-the-model-context-protocol-and-establishing-of-the-agentic-ai-foundation>

The opportunity is not to fight first-party memory systems directly. The opportunity is to give users local ownership of the useful context created in chats, then make that context portable across tools, models, projects, and future agent workflows.

## Product Thesis

AI Chat Vault should become a local-first work memory layer for AI conversations.

The product should help a user take a valuable AI chat and turn it into a small, structured, editable Work Capsule: what was decided, what matters, what constraints apply, what next actions exist, what prompt/context should be reused, and what artifact should be carried forward. The capsule should be easy to copy into another AI, save locally, inspect later, and eventually export into project memory or MCP-ready context formats.

The practical promise:

> "I had a useful AI conversation. AI Chat Vault turns it into reusable context I can trust and bring to the next tool."

This keeps the existing local-first privacy advantage while moving the product from "export my chat" to "preserve and reuse the work inside my chat."

## Non-Goals

- Do not become a general note-taking app.
- Do not become a cloud sync product.
- Do not depend on a backend, analytics service, or remote model call for the core workflow.
- Do not chase every AI provider UI at once before the Work Capsule loop is strong on ChatGPT.
- Do not add random convenience widgets unless they improve capsule creation, reuse, extraction, or project memory.
- Do not hide source context or make opaque "memory" that the user cannot inspect and edit.
- Do not store full raw transcripts by default when a smaller reusable capsule is enough.
- Do not implement MCP server functionality before there is a useful local project memory model to expose.

## Ranked Roadmap

1. Work Capsule MVP

   The first priority is a reliable end-to-end loop: select useful chat turns, create a structured capsule, edit it, store it locally, copy a reusable context prompt, and export it. This is the core product shift.

2. Cross-AI Context Bridge

   Once capsules exist, make them portable. Provide output presets that adapt a capsule for ChatGPT, Claude, Gemini, and project-style AI workspaces. The bridge should reduce context retyping when users move between models.

3. Answer-to-Artifact Extractor

   Convert strong AI answers into concrete artifacts: implementation specs, bug reports, decision records, release notes, checklists, research briefs, prompts, and test plans. This should build on the capsule schema rather than create an unrelated extractor.

4. Project Context Vault

   Group capsules by project, support local search and review, and prepare exports for future MCP-ready memory. This comes later because a project vault without high-quality capsules becomes another bookmark database.

## Work Capsule MVP Spec

### User Story

As a user who just had a productive ChatGPT conversation, I want to turn selected messages into a compact, editable Work Capsule so I can reuse the important context in another chat, another AI tool, or a later work session without rereading the whole conversation.

### UI Entry Points

- After `Capture`, show `Create Capsule` near the existing `Copy` and `Download` actions.
- Reuse the existing selected-message checklist as the capsule source selector.
- Open a capsule preview/edit view in the popup with structured sections, not a raw textarea only.
- Provide `Copy context`, `Copy Markdown`, and `Download` actions from the capsule view.
- From a saved bookmark or current conversation identity, show the most recent capsule if one exists.

### Output Schema

The stored capsule should have a versioned JSON shape and a deterministic Markdown rendering. Suggested MVP schema:

```ts
type WorkCapsuleV1 = {
  schemaVersion: "work-capsule/v1";
  id: string;
  createdAt: string;
  updatedAt: string;
  source: {
    provider: "chatgpt";
    conversationId: string;
    conversationUrl?: string;
    conversationTitle?: string;
    selectedTurnIds: string[];
  };
  title: string;
  project?: string;
  tags: string[];
  goal: string;
  reusableContext: string;
  decisions: CapsuleItem[];
  constraints: CapsuleItem[];
  facts: CapsuleItem[];
  openQuestions: CapsuleItem[];
  nextActions: CapsuleAction[];
  artifacts: CapsuleArtifact[];
  contextPrompt: string;
  sourceExcerptPolicy: "none" | "selected-excerpts";
  sourceExcerpts?: CapsuleExcerpt[];
};

type CapsuleItem = {
  text: string;
  sourceTurnId?: string;
};

type CapsuleAction = {
  text: string;
  owner?: "user" | "ai" | "unknown";
  status: "todo" | "doing" | "done";
  sourceTurnId?: string;
};

type CapsuleArtifact = {
  title: string;
  type: "spec" | "prompt" | "checklist" | "decision-record" | "research-brief" | "other";
  summary: string;
  sourceTurnId?: string;
};

type CapsuleExcerpt = {
  turnId: string;
  role: "user" | "assistant" | "system" | "unknown";
  text: string;
};
```

The Markdown rendering should be optimized for reuse:

- Title
- Goal
- Reusable Context
- Decisions
- Constraints
- Facts
- Open Questions
- Next Actions
- Artifacts
- Source

### Storage Model

- Store capsule records in `chrome.storage.local`.
- Use a versioned index key such as `workCapsules:v1`.
- Store capsule bodies separately by ID, for example `workCapsule:v1:<id>`, to avoid rewriting the full collection for every edit.
- Reference the existing sanitized conversation identity where possible.
- Store compact capsule content by default, not the full transcript.
- Allow source excerpts only when explicitly included by the user or required by the chosen capsule mode.
- Keep future migration paths explicit: new schema versions should migrate forward rather than mutating `work-capsule/v1` records in place.

### Privacy Boundary

- The MVP must remain local-first.
- Do not send captured messages or capsules to any backend.
- Do not call a remote LLM to generate the capsule in the default workflow.
- Generated capsule text should come from local parsing, deterministic templates, and user edits.
- Copying a capsule into ChatGPT, Claude, Gemini, or another tool is a user-initiated action outside extension storage.
- Store only what the UI makes visible to the user.
- Keep Chrome permissions aligned with the existing narrow host and storage model.

### Tests

Minimum test coverage for the MVP:

- Schema validation for required fields, version, arrays, and allowed enum values.
- Markdown rendering snapshots for representative capsules.
- Storage tests for create, update, list, delete, and migration behavior.
- Source selector tests confirming selected messages become `selectedTurnIds`.
- Privacy guard tests confirming capsule creation performs no network calls.
- Popup tests for create, edit, copy, download, empty selection, and reload states.
- Integration fixture using a realistic captured ChatGPT conversation.
- Release verification through the existing `npm test`, `npm run build`, `npm run package`, and `npm run verify` gates.

### Acceptance Criteria

- A user can capture a ChatGPT conversation, select messages, and create a Work Capsule.
- The capsule includes title, goal, reusable context, decisions, constraints, facts, open questions, next actions, artifacts, and context prompt fields.
- The user can edit capsule fields before saving.
- The user can copy a concise context prompt for a new AI chat.
- The user can copy or download the full capsule as Markdown.
- The capsule persists locally and can be reopened for the same conversation.
- The default workflow stores compact capsule data and does not persist a full raw transcript.
- The workflow works without network access after the ChatGPT page has loaded.
- Automated tests cover the schema, storage, rendering, popup flow, and privacy boundary.
- The release gates pass before commit.

## Four-Week Autonomous Iteration Plan

### Week 1: Capsule Foundation

Goal: define the Work Capsule data model, Markdown renderer, storage helpers, and test fixtures.

Deliverables:

- Versioned `WorkCapsuleV1` types and validation.
- Markdown rendering for the reusable capsule format.
- Local storage create/list/read/update/delete helpers.
- Representative ChatGPT capture fixtures.

Quality gate:

- Unit tests cover schema, renderer, and storage behavior.
- `npm test`, `npm run build`, `npm run package`, and `npm run verify` pass before commit.

### Week 2: Capsule Creation Loop

Goal: ship the first user-visible capsule workflow from captured selected messages.

Deliverables:

- `Create Capsule` action after capture.
- Structured capsule preview/edit view.
- Save, copy context, copy Markdown, and download actions.
- Empty selection and malformed capture handling.

Quality gate:

- Popup tests cover create, edit, save, copy, download, and error states.
- Manual Chrome load confirms the popup remains usable at narrow dimensions.
- `npm test`, `npm run build`, `npm run package`, and `npm run verify` pass before commit.

### Week 3: Reuse And Retrieval

Goal: make saved capsules useful after the first creation moment.

Deliverables:

- Conversation-linked recent capsule access.
- Basic capsule list grouped by conversation or project text field.
- Copyable context prompt tuned for starting a new AI chat.
- Delete and update flows with confirmation where appropriate.

Quality gate:

- Tests cover reload, update, delete, and context prompt output.
- No new broad Chrome permissions.
- `npm test`, `npm run build`, `npm run package`, and `npm run verify` pass before commit.

### Week 4: Bridge Readiness

Goal: prepare the second roadmap item without diluting the Work Capsule MVP.

Deliverables:

- Output presets for generic AI context, ChatGPT Project-style context, Claude Project-style context, and plain Markdown.
- A short design note for provider-specific bridge behavior and limits.
- Acceptance review of the Work Capsule MVP against this document.

Quality gate:

- Preset rendering tests cover all supported output formats.
- The design note names unsupported providers and avoids brittle UI automation promises.
- `npm test`, `npm run build`, `npm run package`, and `npm run verify` pass before commit.

## Guidance For Future Cron/Codex Agents

- Start every run by reading this document, checking `git status --short`, and reviewing the latest commits.
- Choose the highest-ranked unfinished roadmap item. Do not skip Work Capsule MVP work for unrelated utilities.
- Prefer fewer high-value workflow features over random small conveniences.
- A good iteration should improve one complete user journey: capture, structure, reuse, export, retrieve, or bridge.
- Keep implementation local-first unless Hermes explicitly changes the privacy model in a new direction document.
- Update docs and tests with the code when behavior changes.
- Run `npm test`, `npm run build`, `npm run package`, and `npm run verify` before committing.
- Commit and push only if all available gates are green.
- If a gate fails because of an existing repo issue, report the exact command and failure honestly instead of hiding it.
- Do not add generated `dist/` or `release/` artifacts unless the repo already tracks them.
- Keep commits focused and use clear messages that describe the product behavior changed.
