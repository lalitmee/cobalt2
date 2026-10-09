import test from "node:test";
import assert from "node:assert/strict";
import { findTarget, parseCatalog } from "../src/catalog.js";

test("parses a target, normalizes platforms, and rejects duplicates", () => {
  const line =
    "codex-cli|copy|linux,macos|themes/codex/cobalt2.tmTheme|CODEX_HOME/themes/cobalt2.tmTheme||guides/codex-cli.md";
  const rows = parseCatalog(line);
  assert.deepEqual(rows[0].platforms, ["linux", "macos"]);
  assert.equal(findTarget(rows, "codex-cli", "linux").kind, "copy");
  assert.throws(() => parseCatalog(`${line}\n${line}`), /duplicate/i);
});

test("rejects malformed rows and unsupported targets", () => {
  assert.throws(() => parseCatalog("bad|row"), /line 1/);
  assert.throws(
    () =>
      findTarget(
        parseCatalog("codex-cli|copy|linux|x|HOME/x||guide"),
        "absent",
        "linux",
      ),
    /Available targets/,
  );
});

test("upstream rows require a valid checksum", () => {
  assert.throws(
    () =>
      parseCatalog(
        "kitty|upstream|linux|https://example.test/theme|HOME/theme|not-a-hash|guide",
      ),
    /SHA-256/,
  );
});
