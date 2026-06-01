import { existsSync } from "node:fs";
import { readdir, readFile } from "node:fs/promises";
import { resolve, relative } from "node:path";
import { Script } from "node:vm";
import { inflateRawSync } from "node:zlib";
import { JSDOM } from "jsdom";

const root = resolve(import.meta.dirname, "..");
const distDir = resolve(root, "dist");
const releaseZip = resolve(root, "release/ai-chat-vault.zip");

const REQUIRED_DIST_FILES = [
  "manifest.json",
  "content.js",
  "popup.html",
  "popup.js",
  "assets/popup.css"
];

const EXPECTED_HOST_PERMISSIONS = ["https://chatgpt.com/*", "https://chat.openai.com/*"];
const FORBIDDEN_PERMISSIONS = new Set([
  "tabs",
  "scripting",
  "history",
  "cookies",
  "identity",
  "webRequest",
  "webRequestBlocking"
]);
const ALLOWED_PERMISSIONS = ["storage"];

const manifest = await readJson(resolve(distDir, "manifest.json"));
const contentBundle = await readText(resolve(distDir, "content.js"));
const popupBundle = await readText(resolve(distDir, "popup.js"));
const popupHtml = await readText(resolve(distDir, "popup.html"));

verifyRequiredDistFiles();
verifyManifest(manifest);
verifyContentClassicScript(contentBundle);
verifyPopupIsolation(popupBundle);
verifyPopupReferences(popupHtml);
await verifyContentRuntimeSmoke(contentBundle);
await verifyPackageZip();

console.log("Verified extension runtime, manifest, bundle, and package gates");

function verifyRequiredDistFiles() {
  for (const file of REQUIRED_DIST_FILES) {
    assert(existsSync(resolve(distDir, file)), `Missing dist artifact: ${file}`);
  }
}

function verifyManifest(value) {
  assert(value.manifest_version === 3, "manifest_version must be 3");
  assert(value.name === "AI Chat Vault", "manifest name changed unexpectedly");
  assert(value.action?.default_popup === "popup.html", "manifest action.default_popup must be popup.html");
  assert(Array.isArray(value.permissions), "manifest permissions must be an array");
  assert(
    JSON.stringify(value.permissions) === JSON.stringify(ALLOWED_PERMISSIONS),
    `manifest permissions changed unexpectedly: ${JSON.stringify(value.permissions)}`
  );

  for (const permission of value.permissions) {
    assert(!FORBIDDEN_PERMISSIONS.has(permission), `Forbidden permission added: ${permission}`);
  }

  assert(
    JSON.stringify(value.host_permissions ?? []) === JSON.stringify(EXPECTED_HOST_PERMISSIONS),
    `host_permissions changed unexpectedly: ${JSON.stringify(value.host_permissions ?? [])}`
  );

  assert(Array.isArray(value.content_scripts), "manifest must define content_scripts");
  assert(value.content_scripts.length === 1, "manifest should have exactly one content script entry");
  const [contentScript] = value.content_scripts;
  assert(
    JSON.stringify(contentScript.matches ?? []) === JSON.stringify(EXPECTED_HOST_PERMISSIONS),
    `content script matches changed unexpectedly: ${JSON.stringify(contentScript.matches ?? [])}`
  );
  assert(JSON.stringify(contentScript.js ?? []) === JSON.stringify(["content.js"]), "content script must load only content.js");
  assert(!("css" in contentScript), "content script must not inject page CSS for popup UI");
}

function verifyContentClassicScript(bundle) {
  assert(!startsLineWithModuleToken(bundle), "dist/content.js starts a line with import/export; content_scripts load classic scripts");
  assert(!containsModuleStatement(bundle), "dist/content.js contains an import/export module statement");
  assert(!bundle.includes("document.documentElement.append"), "content script must not append an in-page operation panel");
  new Script(bundle, { filename: "dist/content.js" });
}

function verifyPopupIsolation(bundle) {
  assert(!containsContentMessageListener(bundle), "dist/popup.js contains content-script onMessage listener side effects");
  assert(!bundle.includes("data-message-author-role"), "dist/popup.js appears to contain page DOM extractor code");
  assert(bundle.includes("Reload the ChatGPT tab after installing or updating AI Chat Vault"), "popup bundle must explain stale/missing content-script receivers");
}

function verifyPopupReferences(html) {
  assert(html.includes("popup.js"), "dist/popup.html must reference popup.js");
  assert(html.includes("assets/popup.css"), "dist/popup.html must reference assets/popup.css");
}

async function verifyContentRuntimeSmoke(bundle) {
  const dom = new JSDOM(
    `<!doctype html><html><head><title>Runtime QA - ChatGPT</title></head><body><main>
      <article data-message-author-role="user"><div class="whitespace-pre-wrap">Question from runtime smoke</div></article>
      <article data-message-author-role="assistant"><div class="markdown prose"><p>Answer from runtime smoke</p></div></article>
    </main></body></html>`,
    {
      url: "https://chatgpt.com/c/runtime-smoke",
      runScripts: "outside-only",
      pretendToBeVisual: true
    }
  );

  let listener;
  dom.window.chrome = {
    runtime: {
      onMessage: {
        addListener(callback) {
          listener = callback;
        }
      }
    }
  };

  dom.window.eval(bundle);
  assert(typeof listener === "function", "content.js did not register a runtime message listener");

  const response = await new Promise((resolve) => {
    const keepAlive = listener({ type: "AI_CHAT_VAULT_CAPTURE" }, {}, resolve);
    assert(keepAlive === true, "capture message listener must keep the async response channel open");
  });

  assert(response?.type === "AI_CHAT_VAULT_CAPTURE_RESULT", "content capture response type mismatch");
  assert(response.conversation?.messages?.length === 2, "content runtime smoke should capture two messages");
  assert(response.conversation.messages[0].text.includes("Question from runtime smoke"), "user message missing from runtime capture");
  assert(response.conversation.messages[1].text.includes("Answer from runtime smoke"), "assistant message missing from runtime capture");
}

async function verifyPackageZip() {
  assert(existsSync(releaseZip), "release/ai-chat-vault.zip missing; run npm run package");
  const zip = await readFile(releaseZip);
  const entries = readZipEntries(zip);
  const names = entries.map((entry) => entry.name).sort();

  for (const file of REQUIRED_DIST_FILES) {
    assert(names.includes(file), `Package zip missing ${file}`);
  }

  const distFiles = (await collectDistFiles(distDir)).sort();
  assert(JSON.stringify(names) === JSON.stringify(distFiles), "Package zip contents must exactly match dist files");

  const manifestEntry = entries.find((entry) => entry.name === "manifest.json");
  assert(manifestEntry, "Package zip missing manifest.json");
  assert(
    JSON.stringify(JSON.parse(manifestEntry.content.toString("utf8"))) === JSON.stringify(manifest),
    "Package zip manifest does not match dist/manifest.json"
  );
}

async function collectDistFiles(directory, base = directory) {
  const files = [];
  for (const dirent of await readdir(directory, { withFileTypes: true })) {
    const absolute = resolve(directory, dirent.name);
    if (dirent.isDirectory()) {
      files.push(...(await collectDistFiles(absolute, base)));
    } else if (dirent.isFile()) {
      files.push(relative(base, absolute).replaceAll("\\", "/"));
    }
  }
  return files;
}

function readZipEntries(buffer) {
  const entries = [];
  let offset = 0;

  while (offset + 4 <= buffer.length && buffer.readUInt32LE(offset) === 0x04034b50) {
    const method = buffer.readUInt16LE(offset + 8);
    const compressedSize = buffer.readUInt32LE(offset + 18);
    const uncompressedSize = buffer.readUInt32LE(offset + 22);
    const nameLength = buffer.readUInt16LE(offset + 26);
    const extraLength = buffer.readUInt16LE(offset + 28);
    const name = buffer.slice(offset + 30, offset + 30 + nameLength).toString("utf8");
    const dataStart = offset + 30 + nameLength + extraLength;
    const dataEnd = dataStart + compressedSize;
    const compressed = buffer.slice(dataStart, dataEnd);
    const content = method === 8 ? inflateRawSync(compressed) : compressed;
    assert(content.length === uncompressedSize, `Zip entry ${name} has unexpected size`);
    entries.push({ name, content });
    offset = dataEnd;
  }

  assert(entries.length > 0, "Package zip has no readable local file entries");
  return entries;
}

async function readJson(path) {
  return JSON.parse(await readText(path));
}

async function readText(path) {
  return readFile(path, "utf8");
}

function startsLineWithModuleToken(bundle) {
  return /^import\b/m.test(bundle) || /^export\b/m.test(bundle);
}

function containsModuleStatement(bundle) {
  return /(?:^|[;\n])\s*import(?:\s+[\w*{]|\s*["'])/m.test(bundle)
    || /(?:^|[;\n])\s*export(?:\s+|\{|\*)/m.test(bundle);
}

function containsContentMessageListener(bundle) {
  return /chrome\.runtime(?:\?\.)?\.onMessage/.test(bundle) && /\.addListener\(/.test(bundle);
}

function assert(condition, message) {
  if (!condition) {
    throw new Error(message);
  }
}
