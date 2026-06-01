import { readFile } from "node:fs/promises";
import { resolve } from "node:path";
import { Script } from "node:vm";

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

if (startsLineWithModuleToken(contentBundle)) {
  throw new Error("dist/content.js must not start any line with an import/export token; manifest content_scripts load classic scripts.");
}

assertClassicScriptCompatible(contentBundle, contentBundlePath);

if (containsModuleStatement(contentBundle)) {
  throw new Error("dist/content.js must be self-contained for manifest content_scripts; found an import/export statement.");
}

console.log("Verified popup bundle isolation and content classic-script compatibility");

function importsContentScript(source) {
  return /(?:from\s+|import\s*\()\s*["']\.\/content(?:\.ts)?["']/.test(source);
}

function containsContentMessageListener(bundle) {
  return /chrome\.runtime(?:\?\.)?\.onMessage/.test(bundle) && /\.addListener\(/.test(bundle);
}

function startsLineWithModuleToken(bundle) {
  return /^import\b/m.test(bundle) || /^export\b/m.test(bundle);
}

function assertClassicScriptCompatible(bundle, filename) {
  try {
    new Script(bundle, { filename });
  } catch (error) {
    throw new Error(
      `dist/content.js must parse as a classic script for manifest content_scripts: ${error.message}`
    );
  }
}

function containsModuleStatement(bundle) {
  return /(?:^|[;\n])\s*import(?:\s+[\w*{]|\s*["'])/m.test(bundle)
    || /(?:^|[;\n])\s*export(?:\s+|\{|\*)/m.test(bundle);
}
