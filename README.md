# AI Chat Vault

AI Chat Vault is a compact Chrome Manifest V3 toolkit for turning ChatGPT conversations into local, reusable work memory. It opens from the Chrome toolbar, runs locally on `chatgpt.com` and `chat.openai.com`, and keeps capture, Markdown export, prompt snippets, notes, and bookmarks inside the browser.

## Features

- Opens as a Chrome toolbar popup, so ChatGPT content is not covered by a fixed bottom-right panel.
- Captures the current conversation from the page DOM as one export module in the toolkit.
- Preserves common Markdown structure, including inline code, strikethrough, and nested lists.
- Shows detected turns with role, preview, checkbox, and Select all/Select none controls after capture.
- Adds a Message Navigator after capture for local role/text filtering, turn counts, and quick focus in the captured list.
- Adds Conversation Notes after capture for private per-conversation notes stored locally by conversation identity.
- Adds Conversation Bookmarks after capture for local saved conversation links with copy/delete controls.
- Creates editable Work Capsules from selected turns, with local save, library retrieval, copy, and download actions.
- Renders local Work Capsule bridge presets for plain Markdown, generic AI context, Context Prompt only, ChatGPT Project-style context, Claude Project-style context, and Gemini context.
- Previews Markdown before export.
- Copies Markdown to the clipboard.
- Downloads a `.md` file locally with a safe, readable filename.
- Provides an editable Prompt Library for local slash-style snippets.
- Copies a selected prompt or inserts it into the ChatGPT composer.
- Uses no backend services, cloud sync, analytics, or remote storage.

## Product Direction

The product direction is moving from plain export/bookmark tooling toward reusable work memory for AI chats. See [docs/product-direction-2026-06.md](docs/product-direction-2026-06.md) for the current roadmap, starting with the Work Capsule MVP.

The Work Capsule MVP acceptance snapshot is in [docs/work-capsule-mvp-acceptance-2026-06.md](docs/work-capsule-mvp-acceptance-2026-06.md).

The current bridge preset behavior is documented in [docs/work-capsule-bridge-presets.md](docs/work-capsule-bridge-presets.md).

## Selected-Message Export

Click the **AI Chat Vault** icon in the Chrome toolbar, then click **Capture** to detect the visible ChatGPT turns. All detected messages are checked by default, preserving full-conversation export. Use **Select all** or **Select none** to quickly reset the checklist, or manually check only the turns you want, then use **Copy** or **Download** to export the selected messages. If no messages are selected, the popup shows an error and does not export.

## Message Navigator

After capture, use **Message Navigator** to search captured turns by role or text, filter to a role, and see how many turns match. Click a result to focus and highlight that turn in the popup checklist. Navigation is local-only and does not change which messages are selected for export.

## Conversation Notes

After capture, **Conversation Notes** appears in the popup for the current ChatGPT conversation. Notes auto-save to `chrome.storage.local` under a sanitized conversation identity based on the conversation URL, with the title used as a fallback. They reload when you capture the same conversation later and are never sent to a backend.

## Conversation Bookmarks

After capture, **Conversation Bookmarks** appears under notes. Use **Save bookmark** to store the current conversation title and URL locally by the same conversation identity used for notes. Saved links can be copied or deleted from the popup, and bookmarks stay in `chrome.storage.local` only.

## Prompt Library

The popup includes a compact **Prompt Library** with default snippets such as `/summarize`, `/improve`, and `/debug`. Pick a snippet, edit its slash command or body, then use **Save** to keep it locally. Use **New** to add a snippet and **Delete** to remove one. **Copy prompt** and **Insert into ChatGPT** continue to use the selected snippet body. Snippets are stored only in `chrome.storage.local`; the storage permission is used for these local snippets and not for conversation export, sync, analytics, or network transfer.

## Work Capsules

After capture, **Work Capsule** appears with a **Create Capsule** action. Check the messages you want in the capsule, then create a local draft with structured editable fields for title, optional project label, goal, context prompt, reusable context, decisions, constraints, facts, open questions, next actions, and artifacts. The context prompt is generated from the selected excerpts and capsule fields, includes the project label when set, and stays editable. The draft records `selectedTurnIds` such as `message-1` and stores selected excerpts only for checked messages, not the full raw transcript.

Use **Save capsule** to persist the draft in `chrome.storage.local`, choose a **Bridge preset**, use **Copy context** to copy that deterministic preset output, use **Copy Markdown** for the existing full Markdown rendering, use **Copy source** for a concise citation with title, optional project, source conversation, selected turn IDs, and updated time, or **Download capsule** for a local `.md` file. Supported bridge presets are **Plain Markdown**, **Generic AI context**, **Context Prompt only**, **ChatGPT Project-style context**, **Claude Project-style context**, and **Gemini context**. **Context Prompt only** copies just the editable context prompt, trimmed with a trailing newline, for manual paste when the fuller bridge documents are unnecessary. The Gemini preset is optimized for manual paste into Gemini or Gemini workspace-style sessions, not UI automation. These presets and source citations are local text renderings built from the saved Work Capsule fields; they do not call provider APIs, upload files, automate Projects or Gemini workspaces, update provider-side memory, or add any Chrome permissions. Reopened capsules can update their saved local body and index entry, including clearing the project label, while preserving their original source and excerpts. After capture, the popup also loads the index and shows a compact **Library** that groups the five most recent saved capsules by project label when available, otherwise by source conversation title for local retrieval. Library rows show title, goal/source, updated time, and provide **Reopen**, **Reuse**, **Copy context**, **Copy source**, and **Remove** actions; these actions load or remove the stored capsule body by ID, so a selected bridge preset or source citation can be reused even when the current conversation is different and saved capsules from other conversations can still be removed locally. **Reuse** copies a saved capsule into a new unsaved draft with a fresh id and the current captured conversation source/selected excerpts, leaving the original saved capsule untouched until the new draft is explicitly saved. When a saved capsule is open in the structured editor, **Delete capsule** removes that saved capsule from local storage after confirmation, including capsules reopened from the Library for a different conversation; brand-new and reused unsaved drafts must be saved before they can be deleted. When a saved capsule already matches the captured conversation URL, the existing recent capsule panel still appears with **Reopen**, **Reuse**, **Copy source**, and **Delete**. If no messages are checked, capsule creation shows the same selection error as export: `Select at least one message to export`; reuse shows a local selection error and does not persist anything. The loop is deterministic and local-only; it does not call a backend, cloud service, analytics endpoint, remote LLM, `fetch`, or `XMLHttpRequest`.

## Development

```sh
npm install
npm test
npm run build
npm run package
npm run verify
```

The build writes the unpacked extension to `dist/`. The package command creates `release/ai-chat-vault.zip` and runs the runtime verification gate. `npm run verify` is the full release gate: tests, build, package, manifest checks, classic content-script parsing, popup/content bundle isolation, package zip consistency, and a jsdom content-script messaging smoke.

Chrome Web Store privacy and permission notes are in [docs/chrome-web-store-readiness.md](docs/chrome-web-store-readiness.md).

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select the `dist/` directory.

## MVP Limits

ChatGPT page markup can change, so extraction uses several pragmatic selectors and may need updates over time. Export happens from the rendered page only; archived, hidden, or unloaded conversation turns are outside this MVP.
