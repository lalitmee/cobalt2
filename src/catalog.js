import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";

export const catalogPath = fileURLToPath(
  new URL("../catalog/targets.psv", import.meta.url),
);
const kinds = new Set(["copy", "upstream", "snippet", "builtin"]);
const platforms = new Set(["linux", "macos", "windows"]);

export function parseCatalog(text) {
  const rows = [];
  const seen = new Set();
  for (const [index, raw] of text.split(/\r?\n/).entries()) {
    if (!raw.trim() || raw.startsWith("#")) continue;
    const fields = raw.split("|");
    if (fields.length !== 7)
      throw new Error(`line ${index + 1}: expected 7 fields`);
    const [id, kind, platformText, source, destination, sha256, guide] = fields;
    if (!id || (!source && !["builtin"].includes(kind)) || !guide)
      throw new Error(`line ${index + 1}: required field is empty`);
    if (!kinds.has(kind))
      throw new Error(`line ${index + 1}: unknown kind '${kind}'`);
    const targetPlatforms = platformText ? platformText.split(",") : [];
    if (
      targetPlatforms.some((value) => !platforms.has(value)) ||
      new Set(targetPlatforms).size !== targetPlatforms.length
    ) {
      throw new Error(`line ${index + 1}: invalid platform list`);
    }
    if (kind !== "builtin" && !targetPlatforms.length)
      throw new Error(`line ${index + 1}: target must declare platforms`);
    if (kind === "upstream" && !/^[a-f\d]{64}$/i.test(sha256))
      throw new Error(`line ${index + 1}: upstream target requires a SHA-256`);
    if (kind !== "upstream" && sha256)
      throw new Error(
        `line ${index + 1}: SHA-256 is only valid for upstream targets`,
      );
    const row = {
      id,
      kind,
      platforms: targetPlatforms,
      source,
      destination,
      sha256,
      guide,
    };
    for (const platform of targetPlatforms.length ? targetPlatforms : ["*"]) {
      const key = `${id}/${platform}`;
      if (seen.has(key))
        throw new Error(
          `line ${index + 1}: duplicate target/platform '${key}'`,
        );
      seen.add(key);
    }
    rows.push(row);
  }
  return rows;
}

export async function loadCatalog() {
  return parseCatalog(await readFile(catalogPath, "utf8"));
}

export function findTarget(rows, id, platform) {
  const row = rows.find(
    (entry) => entry.id === id && entry.platforms.includes(platform),
  );
  if (!row) {
    const valid = [
      ...new Set(
        rows
          .filter((entry) => entry.platforms.includes(platform))
          .map((entry) => entry.id),
      ),
    ].join(", ");
    throw new Error(
      `unsupported target/platform '${id}/${platform}'. Available targets: ${valid}`,
    );
  }
  return row;
}
