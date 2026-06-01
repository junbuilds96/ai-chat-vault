# Chrome Web Store Readiness

This project keeps the extension privacy model local-only for Chrome Web Store review.

## Privacy Disclosure

- Data collection: none. The extension does not collect, sell, transmit, or store user data.
- Conversation access: the content script can read the rendered ChatGPT page DOM on supported hosts, but the user-facing controls live in the Chrome toolbar popup instead of a persistent in-page overlay.
- User-initiated output: Copy writes selected Markdown to the browser clipboard; Download creates a local `.md` file.
- Remote services: none. There is no backend, analytics, telemetry, or remote code.
- Persistence: none. The manifest does not request extension storage permissions.

## Permission Justification

- `permissions`: empty.
- `host_permissions`: limited to `https://chatgpt.com/*` and `https://chat.openai.com/*` so the content script can run on supported ChatGPT hosts.
- No broad host patterns, secrets, cookies, identity, scripting, tabs, history, or network-request permissions are used.

## Release Check

Before submitting a package, run:

```sh
npm test
npm run build
npm run package
```

Upload `release/ai-chat-vault.zip` and keep the store listing privacy answers aligned with the disclosure above.
