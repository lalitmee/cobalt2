import { createHash } from "node:crypto";
import { readFile, readdir } from "node:fs/promises";
import { extname, isAbsolute, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import { parseCatalog } from "../src/catalog.js";

const repoRoot = fileURLToPath(new URL("../", import.meta.url));

export function validateToml(text) {
  const keys = new Set();
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const match = /^([A-Za-z][A-Za-z0-9_-]*)\s*=\s*(.+)$/.exec(trimmed);
    if (!match) throw new Error(`TOML validation failed at line ${index + 1}`);
    if (keys.has(match[1]))
      throw new Error(`TOML validation failed: duplicate key '${match[1]}'`);
    keys.add(match[1]);
    const value = match[2];
    if (value.startsWith('"')) {
      try {
        if (typeof JSON.parse(value) !== "string") throw new Error();
      } catch {
        throw new Error(`TOML validation failed at line ${index + 1}`);
      }
    } else if (!/^(?:true|false|-?\d+)$/.test(value))
      throw new Error(`TOML validation failed at line ${index + 1}`);
  }
}

export function validatePlist(text, path = "theme.tmTheme") {
  if (!/^<\?xml[^>]*>\s*<!DOCTYPE plist[^>]*>\s*<plist[^>]*>/i.test(text))
    throw new Error(
      `plist validation failed for ${path}: missing plist document`,
    );
  const stack = [];
  for (const match of text.matchAll(/<\/?([A-Za-z][\w.-]*)\b[^>]*>/g)) {
    const full = match[0];
    const tag = match[1];
    if (full.startsWith("<!") || full.endsWith("/>")) continue;
    if (full.startsWith("</")) {
      if (stack.pop() !== tag)
        throw new Error(
          `plist validation failed for ${path}: mismatched XML tags`,
        );
    } else stack.push(tag);
  }
  if (stack.length)
    throw new Error(`plist validation failed for ${path}: unclosed XML tags`);
}

function validateIni(text, path) {
  let sections = 0;
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    const value = line.trim();
    if (!value || value.startsWith(";") || value.startsWith("#")) continue;
    if (/^\[[^\]]+\]$/.test(value)) sections += 1;
    else if (!/^[^=]+=.*/.test(value))
      throw new Error(`INI validation failed for ${path} at line ${index + 1}`);
  }
  if (!sections)
    throw new Error(`INI validation failed for ${path}: no sections`);
}

export function verifyUpstream(content, expected) {
  const actual = createHash("sha256").update(content).digest("hex");
  if (actual.toLowerCase() !== expected.toLowerCase())
    throw new Error(
      `upstream theme SHA-256 mismatch: expected ${expected}, got ${actual}`,
    );
  return actual;
}

async function filesBelow(root) {
  const entries = await readdir(root, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const path = join(root, entry.name);
    if (entry.isDirectory()) files.push(...(await filesBelow(path)));
    else if (entry.isFile()) files.push(path);
  }
  return files;
}

function validateGhostty(text) {
  for (const [index, line] of text.split(/\r?\n/).entries()) {
    if (!line.trim()) continue;
    const match = /^([a-z-]+)\s*=\s*(.+)$/.exec(line);
    if (!match) throw new Error(`Ghostty theme line ${index + 1} is malformed`);
    const [, key, value] = match;
    if (key === "palette") {
      if (!/^\d{1,2}=#[0-9A-Fa-f]{6}$/.test(value))
        throw new Error(
          `Ghostty palette line ${index + 1} has an invalid color`,
        );
    } else if (
      ![
        "background",
        "foreground",
        "cursor-color",
        "selection-background",
        "selection-foreground",
      ].includes(key) ||
      !/^[0-9A-Fa-f]{6}$/.test(value)
    ) {
      throw new Error(
        `Ghostty theme line ${index + 1} has an unsupported key or color`,
      );
    }
  }
}

export async function validateAssetSet(
  root = repoRoot,
  { verifyRemote = true, fetchImpl = fetch } = {},
) {
  const manifestText = await readFile(
    join(root, "catalog/targets.psv"),
    "utf8",
  );
  const rows = parseCatalog(manifestText);
  const referenced = new Set();
  for (const row of rows) {
    const [guidePath, anchor] = row.guide.split("#");
    const guideAbsolute = resolve(root, guidePath);
    if (!anchor || !guideAbsolute.startsWith(`${resolve(root)}${sep}`)) {
      throw new Error(`invalid guide reference for ${row.id}: ${row.guide}`);
    }
    const guideText = await readFile(guideAbsolute, "utf8");
    const headings = [...guideText.matchAll(/^#{1,6}\s+(.+?)\s*#*\s*$/gm)].map(
      (match) =>
        match[1]
          .toLowerCase()
          .replace(/[^\p{L}\p{N} -]/gu, "")
          .trim()
          .replace(/\s+/g, "-"),
    );
    if (!headings.includes(anchor))
      throw new Error(
        `guide anchor for ${row.id} does not exist: ${row.guide}`,
      );
    if (row.kind === "copy" || row.kind === "snippet") {
      const path = resolve(root, row.source);
      const resolvedRoot = resolve(root);
      if (isAbsolute(row.source) || !path.startsWith(`${resolvedRoot}${sep}`))
        throw new Error(`unsafe manifest asset path: ${row.source}`);
      try {
        await readFile(path);
      } catch {
        throw new Error(`missing asset referenced by ${row.id}: ${row.source}`);
      }
      referenced.add(relative(root, path).split("\\").join("/"));
    }
    if (row.kind === "upstream") {
      const url = new URL(row.source);
      if (url.protocol !== "https:" || !/[0-9a-f]{40}/i.test(url.pathname))
        throw new Error(`upstream target ${row.id} is not commit pinned`);
      if (!/^[a-f0-9]{64}$/i.test(row.sha256))
        throw new Error(`upstream target ${row.id} has no valid SHA-256`);
      if (verifyRemote) {
        const response = await fetchImpl(url);
        if (!response.ok)
          throw new Error(
            `upstream ${row.id} returned HTTP ${response.status}`,
          );
        verifyUpstream(Buffer.from(await response.arrayBuffer()), row.sha256);
      }
    }
  }

  const themeFiles = await filesBelow(join(root, "themes"));
  for (const path of themeFiles) {
    const relativePath = relative(root, path).split("\\").join("/");
    if (!referenced.has(relativePath))
      throw new Error(
        `theme asset is missing from the target catalog: ${relativePath}`,
      );
    const ext = extname(path).toLowerCase();
    const text = await readFile(path, "utf8");
    if (ext === ".json") JSON.parse(text);
    if (ext === ".tmtheme") validatePlist(text, relativePath);
    if (ext === ".ini") validateIni(text, relativePath);
    if (relativePath === "themes/ghostty/Cobalt2") validateGhostty(text);
    if (ext === ".css" && !/:root\s*\{/.test(text))
      throw new Error(`Vimium theme has no :root style block: ${relativePath}`);
  }

  const palette = JSON.parse(
    await readFile(join(root, "palette/cobalt2.json"), "utf8"),
  );
  if (
    !Object.keys(palette).length ||
    Object.values(palette).some((value) => !/^#[0-9a-f]{6}$/i.test(value))
  )
    throw new Error("canonical palette contains an invalid color value");
  validateToml(
    await readFile(join(root, "snippets/codex-desktop.toml"), "utf8"),
  );
  const notices = await readFile(join(root, "THIRD_PARTY_NOTICES.md"), "utf8");
  if (
    !notices.includes("Wes Bos") ||
    !notices.includes("Roberto Achar") ||
    !notices.includes("Copyright (c) 2018")
  )
    throw new Error(
      "third-party notices are missing required Cobalt2 attribution",
    );
  return { rows: rows.length, themeFiles: themeFiles.length };
}

if (
  process.argv[1] &&
  resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  validateAssetSet(repoRoot, {
    verifyRemote: process.env.COBALT2_SKIP_UPSTREAM_CHECK !== "1",
  })
    .then(({ rows, themeFiles }) => {
      process.stdout.write(
        `validated ${rows} targets and ${themeFiles} theme assets\n`,
      );
    })
    .catch((error) => {
      process.stderr.write(`${error.message}\n`);
      process.exitCode = 1;
    });
}
