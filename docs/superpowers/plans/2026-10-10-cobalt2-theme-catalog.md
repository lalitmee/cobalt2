# Cobalt2 Theme Catalog and Installer Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [x]`) syntax for tracking.

**Goal:** Ship a Cobalt2-only catalog with safe shell and `npx` installers for existing native themes, an upstream-only Kitty target, and documented Codex Desktop and built-in integrations.

**Architecture:** Store theme assets in tool-specific directories and describe copy, upstream, snippet, and built-in targets in one pipe-delimited manifest that both installers can read without extra runtime dependencies. A Node.js CLI serves `npx` and Windows, while a POSIX shell installer serves macOS and Linux; both implement the same install contract and safety rules.

**Tech Stack:** POSIX `sh`, Node.js built-ins, pipe-delimited text manifest, GitHub Actions, native theme validators, ShellCheck, and shfmt.

**Spec:** `docs/superpowers/specs/2026-10-10-cobalt2-theme-catalog-design.md`

## Global Constraints

- The project distributes Cobalt2 only.
- Preserve each app's native theme format.
- First-phase installation paths are a POSIX shell installer and an `npx` CLI.
- Homebrew and Ubuntu package formats are deferred until these paths are stable.
- Kitty is fetched from a pinned upstream revision and is not vendored.
- Neovim is excluded because Cobalt2.nvim already exists as its own package.
- Vimium CSS, Codex Desktop, Git/delta, and Gum are manual snippets; WezTerm uses its built-in theme.
- The installers install one selected target at a time and do not edit app settings.
- An identical destination file is an idempotent success; a different file is preserved and installation stops by default.
- An explicit force option backs up the destination before replacement.
- Shell install runs on macOS and Linux; `npx` target support is per app and operating system, including Windows where supported.
- Preserve author attribution and license notices for assets derived from upstream work; record source and license information per target before publishing.
- CI validates and format-checks every bundled theme and snippet, and does not publish on each push.

## Review Focus

- **Existing destination is byte-identical:** report already installed and do not rewrite; covered by Tasks 3 and 4.
- **Existing destination differs:** refuse by default, and with force create a timestamped backup before replacing; covered by Tasks 3 and 4.
- **Unsupported target or operating system:** fail before filesystem changes and list valid target/platform choices; covered by Tasks 2, 3, and 4.
- **Custom config root contains spaces or non-ASCII characters:** resolve and quote the path without splitting or escaping it; covered by Tasks 3 and 4.
- **Kitty network failure or content-hash mismatch:** fail before replacing or creating the destination; covered by Tasks 2, 3, and 4.

---

## File map

- `themes/<tool>/...`: native theme files copied from the dotfiles after recording provenance and license data.
- `palette/cobalt2.json`: canonical palette translated from the dotfiles palette for cross-language validation.
- `palette/exceptions.json`: documented, target-specific colors outside the canonical palette.
- `themes/shared/cobalt2.tmTheme`: shared TextMate plist asset if the Codex and bat source files compare byte-for-byte; otherwise keep tool-specific versions.
- `catalog/targets.psv`: target rows shared by the shell and Node installers. Fields are `id|kind|platforms|source|destination|sha256|guide`.
- `snippets/codex-desktop.toml`: manual Codex Desktop appearance values, without a repeated table header that users might append to an existing TOML config.
- `snippets/git-delta.gitconfig` and `snippets/gum.sh`: manual examples derived from existing dotfiles integrations.
- `src/cli.js`: Node CLI argument parsing and user-facing output.
- `src/catalog.js`: manifest parsing, validation, and target/platform lookup.
- `src/installer.js`: Node file copy, upstream download, collision, backup, dry-run, and path resolution operations.
- `bin/cobalt2-theme.js`: npm executable entry point that calls `src/cli.js`.
- `install.sh`: POSIX shell implementation of the same manifest and safety contract.
- `tests/catalog.test.js`, `tests/installer.test.js`, and `tests/cli.test.js`: Node built-in test-runner coverage.
- `tests/shell-installer.test.sh`: shell installer behavior in temporary directories.
- `scripts/validate-assets.js`: parses native file formats and checks manifest coverage and palette tokens.
- `scripts/validate-native.py`: validates TextMate plist, Codex TOML snippet, and CopyQ INI with Python's standard library.
- `package.json`: npm package metadata and scripts; verify package-name availability before publishing.
- `package-lock.json`: locked development-tool versions for reproducible CI installs.
- `VERSION`: shared release marker checked against `package.json` in CI.
- `.gitignore`: excludes local npm install and package-build artifacts.
- `.github/workflows/ci.yml`: theme, formatting, shell, Node, and OS matrix checks.
- `README.md`, `LICENSE`, and `THIRD_PARTY_NOTICES.md`: user installation guide and source attribution.

## Task 1: Confirm source provenance and add native assets

**Files:**

- Create: `themes/claude/cobalt2.json`
- Create: `themes/opencode/cobalt2-custom.json`
- Create: `themes/pi/cobalt2.json`
- Create: `themes/tmux/cobalt2.conf`
- Create: `themes/ghostty/Cobalt2`
- Create: `themes/copyq/cobalt2.ini`
- Create: `themes/vimium/cobalt2.css`
- Create: `palette/cobalt2.json`
- Create: `themes/shared/cobalt2.tmTheme` because the Codex and bat source files are identical
- Create: `LICENSE`
- Create: `THIRD_PARTY_NOTICES.md`

- [x] **Step 1: Compare paired source assets and record provenance**

Run `cmp /home/lalitmee/dotfiles/codex/.codex/themes/cobalt2.tmTheme /home/lalitmee/dotfiles/bat/.config/bat/themes/cobalt2.tmTheme`.

Expected: exit 0 means store one shared theme source; nonzero means preserve both variants. Record the source repo and license evidence for each source file in `THIRD_PARTY_NOTICES.md` before copying.

- [x] **Step 2: Copy each approved native theme asset**

Copy the nine listed source assets from `/home/lalitmee/dotfiles` to the paths above without changing their contents; the identical Codex and bat TextMate files share one stored copy. Do not copy `nvim/.config/nvim/colors/cobalt2.lua` or the upstream Kitty file.

Translate `docs/cobalt2-palette.lua` into `palette/cobalt2.json`, preserving every key and hex value exactly. Treat the JSON palette as a validation reference; do not regenerate native app themes from it in this task.

- [x] **Step 3: Add license and attribution notices**

Include the exact MIT notice for Cobalt2 assets directly derived from `wesbos/cobalt2-vscode`; identify Wes Bos and Roberto Achar as the source authors. Record other source/license status individually; do not apply the VS Code repository license to unrelated sources by assumption.

- [x] **Step 4: Verify the import diff**

Run `git diff --stat` and `git diff --check`, then inspect each copied asset against its dotfiles source with `cmp`.

Expected: every bundled theme is an exact copy of its approved source, the `.tmTheme` files are either shared only when identical or remain separate, and no Neovim or Kitty file is bundled.

- [x] **Step 5: Commit the asset import**

```bash
git add themes palette/cobalt2.json LICENSE THIRD_PARTY_NOTICES.md
git commit -m "feat: add native cobalt2 theme assets"
```

## Task 2: Define target catalog, snippets, and external source pin

**Files:**

- Create: `catalog/targets.psv`
- Create: `snippets/codex-desktop.toml`
- Create: `snippets/git-delta.gitconfig`
- Create: `snippets/gum.sh`
- Create: `tests/catalog.test.js`
- Create: `src/catalog.js`

**Interfaces:**

- `parseCatalog(text)` returns an array of `{ id, kind, platforms, source, destination, sha256, guide }` rows.
- `findTarget(rows, id, platform)` returns one matching row or throws a descriptive unsupported-target/platform error.
- Target `kind` is one of `copy`, `upstream`, `snippet`, or `builtin`.

- [x] **Step 1: Confirm supported app versions, paths, and OSes**

Check each target's official theme/install documentation for its theme directory and supported operating systems. Record only verified destinations in the manifest. Keep Codex Desktop as a manual snippet because its config table has no public schema reference in the source evidence.

- [x] **Step 2: Write catalog parser tests**

Use `node:test` in `tests/catalog.test.js` to assert a valid row parses to the exact object shape, a malformed row is rejected with its line number, duplicate `id/platform` rows fail, and unsupported target/platform lookup names valid choices.

```js
import test from "node:test";
import assert from "node:assert/strict";
import { parseCatalog, findTarget } from "../src/catalog.js";

test("parses a target and rejects duplicate rows", () => {
  const line =
    "codex-cli|copy|linux,macos|themes/shared/cobalt2.tmTheme|CODEX_HOME/themes/cobalt2.tmTheme||README.md#codex-cli";
  const rows = parseCatalog(line);
  assert.deepEqual(rows[0].platforms, ["linux", "macos"]);
  assert.equal(findTarget(rows, "codex-cli", "linux").kind, "copy");
  assert.throws(() => parseCatalog(`${line}\n${line}`), /duplicate/i);
});
```

- [x] **Step 3: Run catalog tests and confirm failure**

Run `node --test tests/catalog.test.js`.

Expected: FAIL because `src/catalog.js` does not exist yet.

- [x] **Step 4: Implement `parseCatalog` and `findTarget`**

Parse seven pipe-separated fields per non-comment row. Reject empty IDs, unknown kinds, unsupported platform names, invalid SHA-256 values, duplicate `id/platform` rows, and fields containing the delimiter. Return normalized arrays for the comma-separated platform field.

- [x] **Step 5: Add catalog rows and all manual/built-in entries**

Add rows for all nine dotfiles assets (eight copied files after sharing the identical TextMate theme, plus Vimium CSS as a snippet), Kitty as an upstream target, Codex Desktop as a snippet, WezTerm as a built-in target, and Git/delta and Gum as snippets. List only platforms supported by the target. For Kitty, pin a commit-specific raw URL from `lalitmee/kitty-cobalt2` and record the SHA-256 of that exact file; do not reference a mutable branch URL.

Keep the Kitty row's URL and checksum commit-pinned, and keep its theme content out of `themes/`.

- [x] **Step 6: Add Codex Desktop, Git/delta, and Gum snippets**

Derive values from the existing dotfiles. Make the Codex TOML snippet contain key/value entries suitable for merging into the existing table, not a second `[desktop.appearanceDarkChromeTheme]` declaration. Add a short comment stating that the user should merge keys into the existing block.

```toml
# Merge these keys into [desktop.appearanceDarkChromeTheme] in config.toml.
accent = "#00AAFF"
accentSource = "chatgpt"
contrast = 60
ink = "#FFFFFF"
opaqueWindows = false
surface = "#193549"
```

- [x] **Step 7: Run parser tests and verify catalog completeness**

Run `node --test tests/catalog.test.js`. Add assertions that every bundled theme file has at least one manifest row and that Kitty has no bundled local source path.

Expected: PASS; catalog IDs and platform declarations match the design spec.

- [x] **Step 8: Commit catalog and snippets**

```bash
git add catalog snippets src/catalog.js tests/catalog.test.js
git commit -m "feat: define cobalt2 theme targets"
```

## Task 3: Implement the cross-platform Node installer and npm CLI

**Files:**

- Create: `src/installer.js`
- Create: `src/cli.js`
- Create: `bin/cobalt2-theme.js`
- Create: `tests/installer.test.js`
- Create: `tests/cli.test.js`
- Create: `package.json`
- Create: `package-lock.json`
- Modify: `src/catalog.js`

**Interfaces:**

- `resolveDestination(row, env, platform, override)` returns an absolute destination path.
- `resolveDeclaredRootAndSuffix(destination, env, platform)` returns a validated `{ root, suffix }` pair for an allowlisted destination token.
- `installTarget(row, options)` returns `{ status, target, destination, backupPath }`, where status is `installed`, `already-installed`, or `dry-run`.
- `parseArgs(argv)` returns a command object for `list`, `install`, `snippet`, or `help`.
- CLI syntax: `npx cobalt2-theme list`, `npx cobalt2-theme install <target> [--dry-run] [--force] [--config-dir <path>]`, and `npx cobalt2-theme snippet <target>`.

- [x] **Step 1: Write installer behavior tests**

In `tests/installer.test.js`, use a temporary directory and a local manifest source. Assert: missing target installs bytes; same bytes return `already-installed`; different bytes reject without force; force preserves old bytes in a timestamped backup and writes new bytes; dry run creates no files; a Kitty hash mismatch creates no destination.

```js
test("preserves an existing file unless force is explicit", async () => {
  const destination = join(tempDir, "themes", "cobalt2.json");
  await mkdir(dirname(destination), { recursive: true });
  await writeFile(destination, "user theme\n");
  await assert.rejects(installTarget(row, { destination }), /already exists/i);
  assert.equal(await readFile(destination, "utf8"), "user theme\n");
});
```

- [x] **Step 2: Run the installer tests and confirm failure**

Run `node --test tests/installer.test.js`.

Expected: FAIL because `src/installer.js` does not exist yet.

- [x] **Step 3: Implement path resolution and local copy behavior**

Resolve only declared destination roots (`HOME`, `CONFIG_HOME`, `CODEX_HOME`, and `APPDATA`) and append the manifest suffix using `node:path`. Honor `--config-dir` for the selected target. Create a temporary file in the destination directory, compare content before writing, back up on force, then atomically rename the temporary file into place.

```js
export function resolveDestination(row, env, platform, override) {
  const { root, suffix } = resolveDeclaredRootAndSuffix(
    row.destination,
    env,
    platform,
  );
  return resolve(override ?? root, suffix);
}
```

- [x] **Step 4: Implement upstream Kitty retrieval**

Fetch only the commit-pinned URL over HTTPS, buffer it to a temporary file, calculate SHA-256 with `node:crypto`, and compare with the manifest. On network, HTTP, or hash failure, remove the temporary file and leave the target path unchanged.

- [x] **Step 5: Implement CLI parsing and output**

Handle `list`, `install`, `snippet`, `--dry-run`, `--force`, `--config-dir`, and `--help`. Reject unknown flags, missing targets, snippets passed to `install`, and built-in targets passed to `install` with actionable messages. Never edit app settings; `snippet` prints the selected file to stdout and its merge guidance to stderr.

```js
export function parseArgs(argv) {
  const [command = "help", target, ...args] = argv;
  const options = { dryRun: false, force: false, configDir: undefined };
  for (let index = 0; index < args.length; index += 1) {
    if (args[index] === "--dry-run") options.dryRun = true;
    else if (args[index] === "--force") options.force = true;
    else if (args[index] === "--config-dir") options.configDir = args[++index];
    else throw new Error(`unknown option: ${args[index]}`);
  }
  return { command, target, options };
}
```

- [x] **Step 6: Add npm package metadata and executable**

Set `"type": "module"` and `bin.cobalt2-theme` to `bin/cobalt2-theme.js`; include only `bin/`, `src/`, `catalog/`, `themes/`, `palette/`, `snippets/`, `VERSION`, `LICENSE`, and notices in the package, and declare the tested Node engine floor. Generate and commit `package-lock.json` for reproducible CI installs. Check npm registry availability for `cobalt2-theme`; if occupied, choose the first available `cobalt2-themes` then `cobalt2-theme-cli` and use that name consistently.

- [x] **Step 7: Run Node tests and package dry-run**

Run `node --test tests/catalog.test.js tests/installer.test.js tests/cli.test.js` and `npm pack --dry-run`.

Expected: PASS; the package includes all local themes, snippets, and canonical palette, excludes Kitty's theme file and Neovim, and the CLI is executable.

- [x] **Step 8: Commit Node installer and package**

```bash
git add src bin tests package.json catalog themes snippets
git commit -m "feat: add npx cobalt2 theme installer"
```

## Task 4: Implement the POSIX shell installer

**Files:**

- Create: `install.sh`
- Create: `tests/shell-installer.test.sh`
- Modify: `catalog/targets.psv`

**Interfaces:**

- `./install.sh list`
- `./install.sh install <target> [--dry-run] [--force] [--config-dir <path>]`
- `./install.sh snippet <target>`
- Shell exit code `0` means installed, already installed, dry-run, list, or snippet success; nonzero means no installation occurred.

- [x] **Step 1: Write POSIX shell integration checks**

Create a temporary home and assert that the shell command installs a local file, a second run leaves it unchanged, a conflicting file is preserved and returns nonzero, `--force` creates a backup, `--dry-run` creates nothing, paths with spaces work, and an invalid target exits before writes.

- [x] **Step 2: Run the shell checks and confirm failure**

Run `sh tests/shell-installer.test.sh`.

Expected: FAIL because `install.sh` does not exist yet.

- [x] **Step 3: Implement manifest lookup and target listing**

Use POSIX `sh` and `awk -F '|'` to select the row for the current OS. Keep all expansions quoted. Reject absolute paths, `..` path components, unknown target kinds, and unsupported OS rows before creating directories.

- [x] **Step 4: Implement copy, dry-run, collision, force, and backup behavior**

Use `cmp` for identical files, create parent directories only after validation, copy through a same-directory temporary file, and move the old destination to a timestamped backup before force replacement.

```sh
if [ -f "$destination" ] && cmp -s "$source" "$destination"; then
    printf '%s\n' "already installed: $destination"
    exit 0
fi
if [ -e "$destination" ] && [ "$force" != 1 ]; then
    printf '%s\n' "refusing to overwrite: $destination" >&2
    exit 1
fi
```

- [x] **Step 5: Implement pinned Kitty download and hash validation**

Use `curl -fsSL` with the pinned URL and use `shasum -a 256` on macOS or `sha256sum` on Linux. Validate the temporary file before moving anything into the destination. Remove failed temporary files on all error paths.

- [x] **Step 6: Implement snippet, list, and help commands**

Print Codex Desktop TOML and other snippets without changing any file. Mark WezTerm as built in and show its activation guidance instead of copying a file.

- [x] **Step 7: Run shell checks and format/lint checks**

Run `sh tests/shell-installer.test.sh`, `shellcheck install.sh tests/shell-installer.test.sh`, and `shfmt -d install.sh tests/shell-installer.test.sh`.

Expected: PASS on macOS and Linux; the script contains no Bash-only syntax.

- [x] **Step 8: Commit the shell installer**

```bash
git add install.sh tests/shell-installer.test.sh catalog/targets.psv
git commit -m "feat: add posix cobalt2 installer"
```

## Task 5: Add asset validation, formatting, and GitHub Actions

**Files:**

- Create: `scripts/validate-assets.js`
- Create: `tests/validate-assets.test.js`
- Create: `palette/exceptions.json`
- Create: `VERSION`
- Create: `.gitignore`
- Create: `.github/workflows/ci.yml`
- Modify: `package.json`
- Modify: `catalog/targets.psv`

- [x] **Step 1: Add failing validator tests**

Test that the validator rejects malformed JSON, malformed plist XML, invalid TOML snippets, missing manifest assets, incorrect Kitty hashes, and undocumented shared-palette deviations. Test that valid adapters with declared exceptions pass.

- [x] **Step 2: Run validator tests and confirm failure**

Run `node --test tests/validate-assets.test.js`.

Expected: FAIL because `scripts/validate-assets.js` does not exist yet.

- [x] **Step 3: Implement format and syntax validation by file type**

Use Node `JSON.parse` for JSON, Python `plistlib` for `.tmTheme` plist validation, Python `tomllib` for the Codex Desktop snippet, Python `configparser` for CopyQ INI, `bash -n` for the tmux theme script, and explicit key/value and hex checks for Ghostty and the pipe-delimited manifest. Run Prettier in check mode for JSON, CSS, Markdown, and JavaScript. Keep validators read-only; format checks must fail on drift without rewriting files.

Use Python 3.11 or later for `tomllib`.

- [x] **Step 4: Add palette and attribution checks**

Parse `palette/cobalt2.json` and the declared shared color tokens. Require each target to have source/license metadata and allow a variation only when it is named in a checked-in exceptions file with a reason.

- [x] **Step 5: Add package scripts and formatter configuration**

Add `npm test`, `npm run validate`, and `npm run format:check`. Pin format/lint tools as development dependencies only where native system validators are insufficient. Ensure `npm pack --dry-run` still excludes non-runtime files.

- [x] **Step 6: Add CI operating-system matrix**

Run Node validation and tests on `ubuntu-latest`, `macos-latest`, and `windows-latest`; install Node and Python 3.11+ explicitly so TOML validation works consistently. Run POSIX shell checks on Ubuntu and macOS only. Use target platform declarations to skip unsupported app paths while still validating every asset on every runner. Add PR and push triggers, cache npm dependencies, use `npm ci`, and keep publishing credentials and publish steps out of CI.

- [x] **Step 7: Verify CI commands locally**

Run `npm test`, `npm run validate`, `npm run format:check`, `shellcheck install.sh`, `shfmt -d install.sh`, and `npm pack --dry-run`.

Expected: all checks pass and no formatter changes working files.

- [x] **Step 8: Commit validation and CI**

```bash
git add scripts tests .github package.json catalog
git commit -m "ci: validate cobalt2 themes and installers"
```

## Task 6: Document the catalog and prepare the first release

**Files:**

- Modify: `README.md`
- Modify: `package.json`
- Modify: `THIRD_PARTY_NOTICES.md`

- [x] **Step 1: Document all target kinds and installation commands**

Write the target list, shell and `npx` commands, OS support, config overrides, dry-run, force/backup behavior, and activation steps for every file target. Explain that Codex Desktop uses a manual TOML snippet, WezTerm's scheme is built in, Kitty is retrieved from upstream, and Neovim is intentionally excluded.

- [x] **Step 2: Document limits and attribution**

Explain that the Cobalt2 catalog does not theme the main ChatGPT desktop interface. Link the upstream Kitty theme and preserve every required source/license notice. Do not claim a license for an asset until its source has been recorded.

- [x] **Step 3: Check release package identity and contents**

Run `npm view cobalt2-theme name` and `npm pack --dry-run`. If the proposed name is unavailable, use the first available fallback defined in Task 3 and update README examples and package metadata together.

- [x] **Step 4: Run the full release verification set**

Run `npm test`, `npm run validate`, `npm run format:check`, `sh tests/shell-installer.test.sh`, `shellcheck install.sh`, `shfmt -d install.sh`, and `npm pack --dry-run`.

Expected: every supported asset and installer check passes; the package has one version, one CLI entry point, and no vendored Kitty or Neovim theme.

- [x] **Step 5: Review status and commit documentation**

Run `git status --short` and inspect the full diff. Stage only the remaining implementation fixes, catalog/palette metadata, README, spec, and plan files.

```bash
git add README.md package.json catalog/targets.psv VERSION palette/exceptions.json docs/superpowers/specs/2026-10-10-cobalt2-theme-catalog-design.md docs/superpowers/plans/2026-10-10-cobalt2-theme-catalog.md install.sh snippets/gum.sh src tests
git commit -m "docs: document cobalt2 theme installation"
```

- [x] **Step 6: Leave publication for an explicit release step**

Do not run `npm publish`, create a GitHub release, push commits, or publish packages as part of implementation. Provide the verified package contents and release notes for separate review.
