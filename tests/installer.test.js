import test from "node:test";
import assert from "node:assert/strict";
import {
  mkdtemp,
  mkdir,
  readFile,
  readdir,
  rm,
  writeFile,
} from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, isAbsolute, join, resolve } from "node:path";
import { installTarget, resolveDestination } from "../src/installer.js";

test("installs, is idempotent, refuses conflicts, backs up on force, and supports dry run", async () => {
  const root = await mkdtemp(join(tmpdir(), "cobalt2 installer "));
  try {
    const source = join(root, "source.json");
    const destination = join(root, "themes", "cobalt2.json");
    const row = {
      id: "sample",
      kind: "copy",
      source: "themes/sample.json",
      destination: "HOME/themes/cobalt2.json",
      sha256: "",
    };
    const install = (options) =>
      installTarget(row, { ...options, sourcePath: source });
    await writeFile(source, "new theme\n");
    assert.equal((await install({ destination })).status, "installed");
    assert.equal((await install({ destination })).status, "already-installed");
    await writeFile(destination, "user theme\n");
    await assert.rejects(install({ destination }), /already exists/i);
    assert.equal(await readFile(destination, "utf8"), "user theme\n");
    assert.equal(
      (await install({ destination, force: true })).status,
      "installed",
    );
    assert.equal(
      (await readdir(dirname(destination))).filter((name) =>
        name.includes(".backup-"),
      ).length,
      1,
    );
    await writeFile(destination, "second user theme\n");
    await install({ destination, force: true });
    assert.equal(
      (await readdir(dirname(destination))).filter((name) =>
        name.includes(".backup-"),
      ).length,
      2,
    );
    const dryDestination = join(root, "dry", "theme.json");
    assert.equal(
      (await install({ destination: dryDestination, dryRun: true })).status,
      "dry-run",
    );
    await assert.rejects(readFile(dryDestination), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("resolves config directory overrides and rejects traversal", () => {
  const row = { destination: "CODEX_HOME/themes/cobalt2.tmTheme" };
  const override = join(tmpdir(), "cobalt2 config");
  assert.equal(
    resolveDestination(
      row,
      { HOME: tmpdir(), CODEX_HOME: join(tmpdir(), ".codex") },
      "linux",
      override,
    ),
    resolve(override, "themes", "cobalt2.tmTheme"),
  );
  assert.throws(
    () =>
      resolveDestination(
        { destination: "HOME/../escape" },
        { HOME: "/tmp/home" },
        "linux",
      ),
    /unsafe/,
  );
  assert.throws(
    () =>
      resolveDestination(
        row,
        { HOME: tmpdir(), CODEX_HOME: join(tmpdir(), ".codex") },
        "linux",
        "relative config",
      ),
    /absolute/,
  );
});

test("resolves declared roots on the current operating system", () => {
  const destination = resolveDestination(
    { destination: "CODEX_HOME/themes/cobalt2.tmTheme" },
    process.env,
    process.platform,
  );
  assert.equal(isAbsolute(destination), true);
  assert.equal(destination.endsWith(join("themes", "cobalt2.tmTheme")), true);
});

test("copies a declared repository theme asset into the selected destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "cobalt2 bundled asset "));
  try {
    const destination = join(root, "themes", "cobalt2.tmTheme");
    const row = {
      id: "codex-cli",
      kind: "copy",
      source: "themes/shared/cobalt2.tmTheme",
      destination: "CODEX_HOME/themes/cobalt2.tmTheme",
    };
    assert.equal(
      (await installTarget(row, { destination })).status,
      "installed",
    );
    assert.match(await readFile(destination, "utf8"), /<plist/);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});

test("upstream hash mismatch never creates destination", async () => {
  const root = await mkdtemp(join(tmpdir(), "cobalt2 upstream "));
  try {
    const destination = join(root, "theme.conf");
    const row = {
      id: "kitty",
      kind: "upstream",
      source: "https://example.test/theme",
      destination: "HOME/theme.conf",
      sha256: "0".repeat(64),
    };
    await assert.rejects(
      installTarget(row, {
        destination,
        fetch: async () => new Response("wrong", { status: 200 }),
      }),
      /SHA-256/i,
    );
    await assert.rejects(readFile(destination), { code: "ENOENT" });
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
