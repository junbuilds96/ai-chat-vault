# Contributing

## Setup

```sh
npm install
npm test
npm run build
```

## Guidelines

- Keep the extension local-only unless a change explicitly updates the privacy model.
- Prefer focused selectors and tests for extractor changes.
- Keep Manifest V3 permissions minimal.
- Run tests and build before opening a pull request.

## Packaging

Run `npm run package` to build `dist/` and create `release/ai-chat-vault.zip`.
