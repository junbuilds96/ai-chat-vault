# AI Chat Vault

AI Chat Vault is a compact Chrome Manifest V3 toolkit for local-first ChatGPT workflows. It opens from the Chrome toolbar, runs locally on `chatgpt.com` and `chat.openai.com`, and keeps Markdown export plus prompt snippets inside the browser.

## Features

- Opens as a Chrome toolbar popup, so ChatGPT content is not covered by a fixed bottom-right panel.
- Captures the current conversation from the page DOM as one export module in the toolkit.
- Preserves common Markdown structure, including inline code, strikethrough, and nested lists.
- Shows detected turns with role, preview, checkbox, and Select all/Select none controls after capture.
- Previews Markdown before export.
- Copies Markdown to the clipboard.
- Downloads a `.md` file locally with a safe, readable filename.
- Provides a small Prompt Library for local slash-style snippets.
- Copies a selected prompt or inserts it into the ChatGPT composer.
- Uses no backend services, cloud sync, analytics, or remote storage.

## Selected-Message Export

Click the **AI Chat Vault** icon in the Chrome toolbar, then click **Capture** to detect the visible ChatGPT turns. All detected messages are checked by default, preserving full-conversation export. Use **Select all** or **Select none** to quickly reset the checklist, or manually check only the turns you want, then use **Copy** or **Download** to export the selected messages. If no messages are selected, the popup shows an error and does not export.

## Prompt Library

The popup includes a compact **Prompt Library** with default snippets such as `/summarize`, `/improve`, and `/debug`. Pick a snippet to preview it, then use **Copy prompt** or **Insert into ChatGPT**. Snippets are stored only in `chrome.storage.local`; the storage permission is used for these local snippets and not for conversation export, sync, analytics, or network transfer.

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
