import test from "node:test";
import assert from "node:assert/strict";
import { mkdtemp, mkdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { join } from "node:path";
import {
  validatePlist,
  validateToml,
  verifyUpstream,
  validateAssetSet,
} from "../scripts/validate-assets.js";

test("rejects malformed TOML and an incorrect upstream checksum", () => {
  assert.throws(() => validateToml("key = ["), /TOML/);
  assert.throws(() => validatePlist("<plist><dict></plist>"), /plist/);
  assert.throws(
    () => verifyUpstream(Buffer.from("theme"), "0".repeat(64)),
    /SHA-256/,
  );
});

test("rejects a manifest that points to a missing local asset", async () => {
  const root = await mkdtemp(join(tmpdir(), "cobalt2 validator "));
  try {
    await mkdir(join(root, "catalog"));
    await writeFile(join(root, "README.md"), "# Missing\n");
    await writeFile(
      join(root, "catalog", "targets.psv"),
      "missing|copy|linux|themes/missing.json|HOME/missing||README.md#missing\n",
    );
    await assert.rejects(
      validateAssetSet(root, { verifyRemote: false }),
      /missing asset/i,
    );
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("validates the complete checked-in theme set", async () => {
  await validateAssetSet(new URL("..", import.meta.url).pathname, {
    verifyRemote: false,
  });
});
