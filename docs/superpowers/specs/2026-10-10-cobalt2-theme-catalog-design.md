# Cobalt2 Theme Catalog and Installer Design

## Status

Design draft for user review. This document covers the product and installation design only; implementation planning starts after review and approval.

## Goal

Make this repository the installation hub for the Cobalt2 themes and integrations the user maintains across coding agents, terminals, and developer tools. Preserve each app's native theme format and provide two first-phase installation paths: a POSIX shell installer and an `npx` CLI. Homebrew and Ubuntu packages are later distribution options.

The project distributes Cobalt2 only. It does not become a catalog of unrelated themes.

## Confirmed scope

### Theme assets already in the dotfiles

| Tool        | Existing asset                  | First-phase handling                           |
| ----------- | ------------------------------- | ---------------------------------------------- |
| Claude Code | `.claude/themes/cobalt2.json`   | Bundle and install                             |
| Codex CLI   | `.codex/themes/cobalt2.tmTheme` | Bundle and install                             |
| OpenCode    | `themes/cobalt2-custom.json`    | Bundle and install                             |
| Pi          | `themes/cobalt2.json`           | Bundle and install                             |
| tmux        | `themes/cobalt2.conf`           | Bundle and install; review palette consistency |
| Ghostty     | `themes/Cobalt2`                | Bundle and install                             |
| bat         | `themes/cobalt2.tmTheme`        | Bundle and install                             |
| CopyQ       | `themes/cobalt2.ini`            | Bundle and install                             |
| Vimium      | `cobalt2.css`                   | Bundle and print as a manual snippet           |

Neovim is excluded because Cobalt2.nvim already exists as its own package. The palette reference in the dotfiles is a source for comparing colors, not a separate installation target.

### Additional integrations

- **Kitty:** Include an installer catalog entry that retrieves the theme from its canonical upstream repository. Do not vendor a second copy. The Kitty theme is already listed in `kovidgoyal/kitty-themes`, credited to Lalit Kumar, with the user's `kitty-cobalt2` repository listed as upstream. The dotfiles config references a local `cobalt2.conf` that is not present in the dotfiles tree.
- **WezTerm:** The current WezTerm config selects the built-in `Cobalt2` scheme. Document the built-in option rather than copying or replacing it.
- **Codex Desktop:** Provide a standalone TOML snippet for the existing `desktop.appearanceDarkChromeTheme` customization. Keep it manual: do not rewrite or append to the user's config automatically. The current config already contains this table, so blindly appending another declaration would be invalid TOML. The theme behavior should be verified in the app before describing its coverage as complete.
- **Git/delta and Gum:** The dotfiles contain Cobalt2 color settings for these tools, but not dedicated theme files. Capture useful settings as clearly labeled snippets or documentation; do not edit a user's existing Git or shell configuration automatically in phase one.
- **Vimium:** Bundle the existing Cobalt2 CSS and provide it as a snippet for the extension's Custom CSS option. Vimium applies this through its options page, so there is no stable theme file path for an installer to target.
- **ChatGPT main interface:** Out of scope. Its documented desktop appearance controls offer light/dark/system and preset accent colors, not a custom Cobalt2 theme file or custom accent value.

## Architecture

The repository contains native theme files, a single machine-readable target manifest, and two thin installer front ends. The manifest records each target's identifier, source asset or upstream source, supported operating systems, destination rules, and activation guidance. Both installers use the same target identifiers and safety behavior.

The first-phase distribution paths are:

- Shell: `./install.sh <target>` on macOS and Linux.
- npm: a Node.js CLI invoked with `npx` on supported platforms, including Windows.

The npm package and shell installer must use the same manifest and bundled files. Kitty is the exception to local asset bundling: its entry points to a pinned upstream revision so the project does not mirror the contributed theme. The exact npm package name and public command spelling are chosen before the first package release.

Support is per application and operating system. The `npx` CLI can run on Windows, but it must only offer targets whose applications and config locations are supported there. The shell installer is POSIX-only in phase one. Homebrew and Ubuntu package formats are deferred until these paths are stable.

## Install behavior

The installers install one selected target at a time. They create the theme directory if needed and copy only the theme asset; they do not activate themes by editing app settings. Vimium CSS, Codex Desktop, Git/delta, and Gum are manual snippets; WezTerm uses its built-in theme.

Both installers support:

- A help/list operation that displays target names and platform support.
- A destination override for nonstandard configuration locations.
- `--dry-run` to show the planned action without writing files.
- Idempotent installs: identical destination files are reported as already installed.
- Safe collisions: a different existing file is preserved and installation stops by default.
- An explicit force option that saves a timestamped backup before replacement.

The installers do not change application settings, run applications, require administrator privileges, or overwrite unrelated config files.

## Licensing and attribution

Retain Wes Bos and Roberto Achar attribution and the relevant MIT notice for assets derived from the MIT-licensed Cobalt2 VS Code repository. Preserve source attribution for each theme adapter. Kitty is fetched from its existing upstream repository rather than redistributed from a second bundled copy. Do not assume that one source repository's license covers assets whose provenance is different; record source and license information per target before publishing.

## GitHub Actions and release checks

GitHub Actions runs on pull requests and pushes. It should:

- Parse and format-check every bundled theme and snippet without modifying the working tree.
- Validate schemas where an app publishes a schema and syntax for formats without schemas.
- Validate that every manifest entry resolves to its declared asset, supported platform, and activation guidance.
- Lint the POSIX shell and Node.js installers.
- Check the pinned Kitty upstream reference and any recorded content hash.
- Exercise dry-run, normal install, repeat install, collision, and forced-backup behavior against temporary config directories.
- Run installer checks on Linux, macOS, and Windows, while skipping app targets unsupported on a given platform.
- Verify that package and shell release versions match.

Publishing to npm remains a separate release action after review; CI does not publish on every push.

## Color consistency

The canonical palette is the reference for shared Cobalt2 colors. Native adapters may use app-specific semantic roles or deliberate variations, but those deviations must be documented. CI should check the shared palette tokens and file validity rather than require every app to use every color identically.

## Validation approach

Before a release, validate each native file's syntax or schema, compare shared color tokens against the canonical palette, and run both installer front ends in temporary homes on supported operating systems. Confirm that installs preserve settings, repeated installation is safe, collisions do not overwrite files by default, and forced replacement creates a recoverable backup. Manually verify Codex Desktop's snippet and document the result and any limits.

## Source references

- [Codex CLI custom themes](https://developers.openai.com/docs/cli-customization)
- [OpenAI ChatGPT appearance settings](https://help.openai.com/en/articles/11958281-updating-your-visual-experience-on-chatgpt)
- [Kitty theme catalog metadata](https://github.com/kovidgoyal/kitty-themes/blob/master/themes.json)
- [User's Kitty Cobalt2 source](https://github.com/lalitmee/kitty-cobalt2)
- [WezTerm Cobalt2 color scheme](https://wezterm.org/colorschemes/c/index.html)
- [TOML v1.0.0 specification](https://toml.io/en/v1.0.0#table)
