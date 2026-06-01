# Contributing

## Setup

```sh
npm install
npm test
npm run build
npm run verify
```

## Guidelines

- Keep the extension local-only unless a change explicitly updates the privacy model.
- Prefer focused selectors and tests for extractor changes.
- Keep Manifest V3 permissions minimal.
- Run `npm run verify` before opening a pull request; it includes tests, build, packaging, manifest checks, classic content-script parsing, popup/content bundle isolation, zip consistency, and a jsdom content-script messaging smoke.

## Packaging

Run `npm run package` to build `dist/`, create `release/ai-chat-vault.zip`, and run the extension runtime verification gate.
