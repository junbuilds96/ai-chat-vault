import { readFile } from "node:fs/promises";
import { resolve } from "node:path";

const root = resolve(import.meta.dirname, "..");
const popupSourcePath = resolve(root, "src/popup.ts");
const popupBundlePath = resolve(root, "dist/popup.js");
const contentBundlePath = resolve(root, "dist/content.js");

const popupSource = await readFile(popupSourcePath, "utf8");
const popupBundle = await readFile(popupBundlePath, "utf8");
const contentBundle = await readFile(contentBundlePath, "utf8");

if (importsContentScript(popupSource)) {
  throw new Error("src/popup.ts must not import src/content.ts; use src/messages.ts for shared popup/content code.");
}

if (containsContentMessageListener(popupBundle)) {
  throw new Error("dist/popup.js contains a chrome.runtime.onMessage listener; content-script code leaked into the popup bundle.");
}

if (containsModuleBoundary(contentBundle)) {
  throw new Error("dist/content.js must be self-contained for manifest content_scripts; found a top-level import or export.");
}

console.log("Verified popup bundle isolation");

function importsContentScript(source) {
  return /(?:from\s+|import\s*\()\s*["']\.\/content(?:\.ts)?["']/.test(source);
}

function containsContentMessageListener(bundle) {
  return /chrome\.runtime(?:\?\.)?\.onMessage/.test(bundle) && /\.addListener\(/.test(bundle);
}

function containsModuleBoundary(bundle) {
  return /^\s*import\s/m.test(bundle) || /^\s*export\s/m.test(bundle);
}
