import test from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const releaseScript = resolve("scripts/prepare-release.js");

test("release preparation updates package versions and generates categorized notes", () => {
  const directory = mkdtempSync(join(tmpdir(), "cobalt2-release-"));

  try {
    run("git", ["init", "-q"], directory);
    run(
      "git",
      ["config", "user.email", "release-test@example.test"],
      directory,
    );
    run("git", ["config", "user.name", "Release Test"], directory);
    writeFileSync(
      join(directory, "package.json"),
      JSON.stringify({ name: "cobalt2-theme", version: "0.1.1" }, null, 2) +
        "\n",
    );
    writeFileSync(
      join(directory, "package-lock.json"),
      JSON.stringify({ name: "cobalt2-theme", version: "0.1.1" }, null, 2) +
        "\n",
    );
    writeFileSync(join(directory, "VERSION"), "0.1.1\n");
    writeFileSync(
      join(directory, "CHANGELOG.md"),
      "# Changelog\n\nExisting notes.\n",
    );
    run("git", ["add", "."], directory);
    run("git", ["commit", "-qm", "chore(release): prepare 0.1.1"], directory);
    const baseline = run("git", ["rev-parse", "HEAD"], directory).trim();

    writeFileSync(join(directory, "change.txt"), "feature\n");
    run("git", ["add", "change.txt"], directory);
    run("git", ["commit", "-qm", "feat(cli): add release workflow"], directory);
    writeFileSync(join(directory, "fix.txt"), "fix\n");
    run("git", ["add", "fix.txt"], directory);
    run(
      "git",
      ["commit", "-qm", "fix: handle missing release baseline"],
      directory,
    );
    writeFileSync(join(directory, "api.txt"), "breaking\n");
    run("git", ["add", "api.txt"], directory);
    run(
      "git",
      [
        "commit",
        "-qm",
        "feat(api): change the response",
        "-m",
        "BREAKING CHANGE: update clients",
      ],
      directory,
    );

    run(
      process.execPath,
      [releaseScript, "0.1.2", "--since", baseline, "--date", "2026-08-04"],
      directory,
    );

    assert.equal(
      JSON.parse(readFileSync(join(directory, "package.json"))).version,
      "0.1.2",
    );
    assert.equal(
      JSON.parse(readFileSync(join(directory, "package-lock.json"))).version,
      "0.1.2",
    );
    assert.equal(readFileSync(join(directory, "VERSION"), "utf8"), "0.1.2\n");
    const changelog = readFileSync(join(directory, "CHANGELOG.md"), "utf8");
    assert.match(changelog, /## 0\.1\.2 - 2026-08-04/);
    assert.match(changelog, /### Added\n\n- cli: add release workflow/);
    assert.match(changelog, /### Fixed\n\n- handle missing release baseline/);
    assert.match(
      changelog,
      /### Breaking Changes\n\n- api: change the response/,
    );
    assert.ok(changelog.endsWith("Existing notes.\n"));

    run(
      process.execPath,
      [releaseScript, "0.1.2", "--since", baseline, "--date", "2026-08-04"],
      directory,
    );
    const regenerated = readFileSync(join(directory, "CHANGELOG.md"), "utf8");
    assert.equal((regenerated.match(/^## 0\.1\.2 - /gm) || []).length, 1);
    assert.equal(
      (regenerated.match(/- cli: add release workflow/g) || []).length,
      1,
    );
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});

test("release preparation requires an explicit baseline", () => {
  const result = spawnSync(process.execPath, [releaseScript, "0.1.2"], {
    cwd: process.cwd(),
    encoding: "utf8",
  });

  assert.notEqual(result.status, 0);
  assert.equal(result.status, 1);
});

function run(command, args, cwd) {
  const result = spawnSync(command, args, { cwd, encoding: "utf8" });
  assert.equal(result.status, 0, result.stderr);
  return result.stdout;
}
