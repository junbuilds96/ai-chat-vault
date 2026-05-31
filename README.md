# AI Chat Vault

AI Chat Vault is a compact Chrome Manifest V3 extension that exports the visible ChatGPT conversation to Markdown. It runs locally as a content script on `chatgpt.com` and `chat.openai.com`.

## Features

- Injects a small exporter panel into ChatGPT pages.
- Captures the current conversation from the page DOM.
- Previews Markdown before export.
- Copies Markdown to the clipboard.
- Downloads a `.md` file locally.
- Uses no backend services and stores no data.

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
