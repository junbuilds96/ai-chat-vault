import { existsSync, mkdirSync, rmSync } from "node:fs";
import { basename, resolve } from "node:path";
import { deflateRawSync } from "node:zlib";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";

const root = resolve(import.meta.dirname, "..");
const distDir = resolve(root, "dist");
const packageDir = resolve(root, "release");
const outputFile = resolve(packageDir, "ai-chat-vault.zip");

if (!existsSync(resolve(distDir, "manifest.json"))) {
  throw new Error("dist/manifest.json not found. Run npm run build first.");
}

rmSync(packageDir, { recursive: true, force: true });
mkdirSync(packageDir, { recursive: true });

const archive = await zipDirectory(distDir);
await writeFile(outputFile, archive);

console.log(`Packaged ${basename(outputFile)}`);

async function zipDirectory(directory) {
  const entries = await collectFiles(directory);
  const fileRecords = [];
  const centralRecords = [];
  let offset = 0;

  for (const entry of entries) {
    const data = await readFile(entry.absolutePath);
    const compressed = deflateRawSync(data);
    const name = Buffer.from(entry.relativePath.replaceAll("\\", "/"));
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4);
    localHeader.writeUInt16LE(0, 6);
    localHeader.writeUInt16LE(8, 8);
    localHeader.writeUInt16LE(0, 10);
    localHeader.writeUInt16LE(0, 12);
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(name.length, 26);
    localHeader.writeUInt16LE(0, 28);

    fileRecords.push(localHeader, name, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4);
    centralHeader.writeUInt16LE(20, 6);
    centralHeader.writeUInt16LE(0, 8);
    centralHeader.writeUInt16LE(8, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(name.length, 28);
    centralHeader.writeUInt16LE(0, 30);
    centralHeader.writeUInt16LE(0, 32);
    centralHeader.writeUInt16LE(0, 34);
    centralHeader.writeUInt16LE(0, 36);
    centralHeader.writeUInt32LE(0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centralRecords.push(centralHeader, name);
    offset += localHeader.length + name.length + compressed.length;
  }

  const centralSize = centralRecords.reduce((size, record) => size + record.length, 0);
  const endRecord = Buffer.alloc(22);
  endRecord.writeUInt32LE(0x06054b50, 0);
  endRecord.writeUInt16LE(0, 4);
  endRecord.writeUInt16LE(0, 6);
  endRecord.writeUInt16LE(entries.length, 8);
  endRecord.writeUInt16LE(entries.length, 10);
  endRecord.writeUInt32LE(centralSize, 12);
  endRecord.writeUInt32LE(offset, 16);
  endRecord.writeUInt16LE(0, 20);

  return Buffer.concat([...fileRecords, ...centralRecords, endRecord]);
}

async function collectFiles(directory, base = directory) {
  const names = await readdir(directory);
  const files = [];

  for (const name of names.sort()) {
    const absolutePath = resolve(directory, name);
    const info = await stat(absolutePath);
    if (info.isDirectory()) {
      files.push(...(await collectFiles(absolutePath, base)));
      continue;
    }

    files.push({
      absolutePath,
      relativePath: absolutePath.slice(base.length + 1)
    });
  }

  return files;
}

function crc32(buffer) {
  const table = crc32.table ?? (crc32.table = makeCrcTable());
  let crc = 0xffffffff;

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ table[(crc ^ byte) & 0xff];
  }

  return (crc ^ 0xffffffff) >>> 0;
}

function makeCrcTable() {
  const table = new Uint32Array(256);
  for (let index = 0; index < 256; index += 1) {
    let value = index;
    for (let bit = 0; bit < 8; bit += 1) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
    }
    table[index] = value >>> 0;
  }
  return table;
}
