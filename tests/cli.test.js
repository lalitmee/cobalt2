import test from "node:test";
import assert from "node:assert/strict";
import { parseArgs } from "../src/cli.js";

test("parses install flags and commands", () => {
  assert.deepEqual(
    parseArgs([
      "install",
      "codex-cli",
      "--force",
      "--config-dir",
      "/tmp/cobalt config",
    ]),
    {
      command: "install",
      target: "codex-cli",
      options: { dryRun: false, force: true, configDir: "/tmp/cobalt config" },
    },
  );
  assert.equal(parseArgs(["snippet", "codex-desktop"]).command, "snippet");
  assert.throws(
    () => parseArgs(["install", "kitty", "--unknown"]),
    /unknown option/,
  );
  assert.throws(
    () => parseArgs(["install", "kitty", "--config-dir"]),
    /requires a path/,
  );
  assert.throws(() => parseArgs(["list", "extra"]), /does not accept a target/);
});

test("parses version aliases and rejects a target", () => {
  for (const flag of ["--version", "-v", "-V", "version"])
    assert.equal(parseArgs([flag]).command, "version");
  assert.throws(() => parseArgs(["version", "x"]), /does not accept a target/);
  assert.throws(() => parseArgs(["bogus"]), /--help/);
});
