# Cobalt2 Themes

Cobalt2 themes and integrations for coding agents, terminals, and developer tools. Install one target at a time with the POSIX shell installer or the npm CLI.

The npm package is published as `cobalt2-theme`. Use `npx` to run the installer without a global install.

See [CHANGELOG.md](CHANGELOG.md) for release notes.

## Install

### Shell installer

The shell installer runs on macOS and Linux. Clone the repository, list available targets, and install one target:

```sh
git clone --depth 1 https://github.com/lalitmee/cobalt2.git
cd cobalt2
./install.sh list
./install.sh install codex-cli
```

### npm / npx

The CLI requires Node.js 20 or later and runs on macOS, Linux, and Windows. `list` shows the targets supported on the current operating system.

```sh
npx --yes cobalt2-theme list
npx --yes cobalt2-theme install claude-code
npx --yes cobalt2-theme install codex-cli --dry-run
```

### Safe installs

Both installers write only the selected theme file. They do not change application settings or activate themes automatically. An identical existing file is reported as already installed. A different existing file is preserved and installation stops; pass `--force` to save a timestamped backup before replacement.

Use `--config-dir PATH` with an absolute path to place the target under a custom configuration root. The target's relative config path is appended to that directory. For example:

```sh
npx --yes cobalt2-theme install codex-cli --config-dir "$HOME/custom-codex"
```

### Platform support

| Platform | Shell installer | `npx`                              |
| -------- | --------------- | ---------------------------------- |
| macOS    | Yes             | Yes                                |
| Linux    | Yes             | Yes                                |
| Windows  | No              | Yes, for targets listed by the CLI |

On Windows, the CLI offers Claude Code, Codex CLI, OpenCode, Pi, Vimium, Codex Desktop, Git/delta, Gum, and WezTerm. Targets such as Kitty, tmux, Ghostty, bat, and CopyQ are currently limited to macOS and Linux.

## Targets and activation

### Claude Code

Install `~/.claude/themes/cobalt2.json`, then choose **Cobalt2** in Claude Code's `/theme` picker.

```sh
./install.sh install claude-code
# or: npx --yes cobalt2-theme install claude-code
```

### Codex CLI

Installs the TextMate theme to `$CODEX_HOME/themes/cobalt2.tmTheme` (default: `~/.codex/themes/cobalt2.tmTheme`). Open Codex CLI's `/theme` picker and select **cobalt2**; Codex saves the selection as `tui.theme`.

See the [Codex CLI theme documentation](https://developers.openai.com/codex/cli/features).

```sh
npx --yes cobalt2-theme install codex-cli
```

### OpenCode

Installs `cobalt2-custom.json` in OpenCode's user theme directory. Choose **cobalt2-custom** with the `/themes` command.

See [OpenCode themes](https://opencode.ai/docs/themes/).

```sh
npx --yes cobalt2-theme install opencode
```

### Pi

Installs `~/.pi/agent/themes/cobalt2.json`. Open Pi's `/settings` and select **cobalt2**.

See [Pi themes](https://pi.ubitools.com/themes/).

```sh
npx --yes cobalt2-theme install pi
```

### tmux

Installs `~/.config/tmux/themes/cobalt2.conf`. Add this line to your tmux configuration, then reload it:

```tmux
source-file ~/.config/tmux/themes/cobalt2.conf
```

```sh
npx --yes cobalt2-theme install tmux
```

### Ghostty

Installs the `Cobalt2` theme file. Set `theme = Cobalt2` in Ghostty's configuration and reload Ghostty.

See [Ghostty color themes](https://ghostty.org/docs/features/theme).

```sh
npx --yes cobalt2-theme install ghostty
```

### bat

Installs the shared TextMate theme as `Cobalt2.tmTheme`. Confirm its name with `bat --list-themes`, then select it with `--theme="Cobalt2"` or your bat config.

After installing a custom theme, run `bat cache --build` so bat discovers it.

See bat's guide to [adding custom themes](https://github.com/sharkdp/bat#adding-new-themes).

```sh
npx --yes cobalt2-theme install bat
```

### CopyQ

Installs the Cobalt2 color theme under CopyQ's user config directory. Select it from CopyQ's theme preferences.

```sh
npx --yes cobalt2-theme install copyq
```

### Kitty

Kitty's contributed theme is fetched from its upstream repository at a pinned commit and checked against a SHA-256 digest. The file is not vendored in this repository. Add `include themes/cobalt2.conf` to Kitty's configuration to activate it.

The source is [lalitmee/kitty-cobalt2](https://github.com/lalitmee/kitty-cobalt2).

```sh
npx --yes cobalt2-theme install kitty
```

### Vimium

Vimium stores custom CSS in its extension settings, so the installer provides the theme as a snippet for you to paste into Vimium's Custom CSS field:

```sh
npx --yes cobalt2-theme snippet vimium
```

### Codex Desktop

Codex Desktop's appearance values are provided as a TOML snippet. Merge its keys into your existing `[desktop.appearanceDarkChromeTheme]` table; do not append a second table with the same name. The snippet does not edit your config.

```sh
npx --yes cobalt2-theme snippet codex-desktop
```

### Git and delta

The delta snippet sets its syntax theme to Cobalt2. Merge it into the appropriate existing section in your Git configuration.

```sh
npx --yes cobalt2-theme snippet git-delta
```

### Gum

Print the Cobalt2 Gum environment variables and source or merge the ones you want in your shell configuration.

```sh
npx --yes cobalt2-theme snippet gum
```

### WezTerm

WezTerm already includes the Cobalt2 color scheme. Set `color_scheme = "Cobalt2"` in your WezTerm configuration; no theme file needs to be installed.

See [WezTerm color schemes](https://wezterm.org/colorschemes/c/index.html).

```sh
npx --yes cobalt2-theme snippet wezterm
```

## Scope

This repository distributes Cobalt2 only. The Neovim theme remains in the separate [Cobalt2.nvim](https://github.com/lalitmee/cobalt2.nvim) project. The main ChatGPT interface is outside scope; this repository supports the Codex Desktop app and Codex CLI.

## Development and checks

Run the release checks locally before preparing a release:

```sh
npm ci
npm run check:release
```

`check:release` runs the test suite, asset validation, formatting check, native theme validation, and package dry run. GitHub Actions also checks the POSIX installer and shell snippets on Linux and macOS.

Prepare release notes and synchronize the npm and shell installer versions with a Conventional Commit range:

```sh
npm run release:prepare -- 0.1.2 --since <tag-or-commit> --date YYYY-MM-DD
npm run check:release
npm publish
```

The baseline is required because the repository may not have a release tag yet. The date is optional; without it, the generator uses the local date. Review `CHANGELOG.md` and the version changes before publishing. `npm publish` runs `check:release` automatically through `prepublishOnly`.

For individual checks:

```sh
npm test
npm run validate
python3 scripts/validate-native.py
npm run format:check
sh tests/shell-installer.test.sh
```

GitHub Actions runs theme, installer, native format, and package checks on Ubuntu, macOS, and Windows. POSIX installer checks run on Ubuntu and macOS.

## License

Repository code and maintainer-authored adapters are MIT licensed. Upstream Cobalt2 notices and source details are in [THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).
