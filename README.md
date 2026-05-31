# AI Chat Vault

AI Chat Vault is a compact Chrome Manifest V3 extension that exports the visible ChatGPT conversation to Markdown. It runs locally as a content script on `chatgpt.com` and `chat.openai.com`.

## Features

- Injects a small exporter panel into ChatGPT pages.
- Captures the current conversation from the page DOM.
- Preserves common Markdown structure, including inline code.
- Shows detected turns with role, preview, and a checkbox after capture.
- Previews Markdown before export.
- Copies Markdown to the clipboard.
- Downloads a `.md` file locally with a safe, readable filename.
- Uses no backend services and stores no data.

## Selected-Message Export

Click **Capture** to detect the visible ChatGPT turns. All detected messages are checked by default, preserving full-conversation export. Uncheck any turns you do not want, then use **Copy** or **Download** to export only the checked messages. If no messages are selected, the panel shows an error and does not export.

## Development

```sh
npm install
npm test
npm run build
npm run package
```

The build writes the unpacked extension to `dist/`. The package command creates `release/ai-chat-vault.zip`.

## Load In Chrome

1. Run `npm run build`.
2. Open `chrome://extensions`.
3. Enable Developer mode.
4. Choose "Load unpacked".
5. Select the `dist/` directory.

## MVP Limits

ChatGPT page markup can change, so extraction uses several pragmatic selectors and may need updates over time. Export happens from the rendered page only; archived, hidden, or unloaded conversation turns are outside this MVP.
