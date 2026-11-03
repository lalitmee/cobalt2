import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import * as p from "@clack/prompts";
import { MultiSelectPrompt } from "@clack/core";
import { installTarget } from "./installer.js";

const PALETTE = {
  yellow: [255, 198, 0],
  orange: [255, 157, 0],
  blue: [0, 170, 255],
  lightBlue: [128, 252, 255],
  green: [158, 255, 128],
  pink: [255, 98, 140],
  purple: [150, 126, 251],
  dim: [143, 191, 220],
  black: [25, 53, 73],
};

function useColor(env = process.env) {
  if (env.NO_COLOR || env.TERM === "dumb") return false;
  return /truecolor|24bit/i.test(env.COLORTERM ?? "");
}

export function paint(name, text, env = process.env) {
  if (!useColor(env)) return text;
  const [r, g, b] = PALETTE[name];
  return `\x1b[38;2;${r};${g};${b}m${text}\x1b[39m`;
}

export function chip(text, env = process.env) {
  if (!useColor(env)) return text;
  const [fr, fg, fb] = PALETTE.black;
  const [br, bg, bb] = PALETTE.yellow;
  return `\x1b[1;38;2;${fr};${fg};${fb};48;2;${br};${bg};${bb}m ${text} \x1b[0m`;
}

const KIND_LABEL = {
  copy: "installs a file",
  upstream: "downloads a file",
  snippet: "prints a snippet",
  builtin: "built in",
};

const NEXT_STEPS = {
  "claude-code": "Run /theme in Claude Code and choose Cobalt2.",
  "codex-cli": "Run /theme in Codex CLI and select cobalt2.",
  opencode: "Run /themes in OpenCode and choose cobalt2-custom.",
  pi: "Open /settings in Pi and select cobalt2.",
  "gemini-cli":
    "Set ui.theme to ~/.gemini/themes/cobalt2.json in settings.json.",
  tmux: "Add: source-file ~/.config/tmux/themes/cobalt2.conf, then reload tmux.",
  ghostty: "Set theme = Cobalt2 in your Ghostty config.",
  bat: "Run `bat cache --build`, then set --theme=Cobalt2.",
  copyq: "Load the theme from CopyQ Preferences > Appearance.",
  kitty: "Add `include themes/cobalt2.conf` to kitty.conf.",
};

export function isInteractive(io = process, env = process.env) {
  return Boolean(
    io.stdout?.isTTY && io.stdin?.isTTY && !env.CI && env.TERM !== "dumb",
  );
}

export function nextStep(id) {
  return NEXT_STEPS[id];
}

function platformsOf(row, platform) {
  return row.platforms.includes(platform);
}

export function formatList(rows, platform, env = process.env) {
  const idWidth = Math.max(...rows.map((row) => row.id.length));
  return rows
    .map((row) => {
      const ok = platformsOf(row, platform);
      const mark = ok ? paint("green", "●", env) : paint("dim", "○", env);
      const id = paint(ok ? "blue" : "dim", row.id.padEnd(idWidth), env);
      return `${mark} ${id}  ${paint("dim", KIND_LABEL[row.kind], env)}`;
    })
    .join("\n");
}

export function showList(rows, platform) {
  p.intro(chip("Cobalt2 themes"));
  p.note(
    formatList(rows, platform),
    `Targets (${paint("green", "●")} available on ${platform})`,
  );
  p.outro(
    paint(
      "lightBlue",
      "Run `cobalt2-theme install <target>` or run with no arguments to pick.",
    ),
  );
}

async function snippetText(row) {
  if (row.kind === "builtin")
    return "WezTerm includes the Cobalt2 scheme.\nSet color_scheme = 'Cobalt2' in your WezTerm config.";
  const source = fileURLToPath(new URL(`../${row.source}`, import.meta.url));
  return (await readFile(source, "utf8")).trimEnd();
}

async function installOne(row, options, env, platform) {
  const run = (force) =>
    installTarget(row, { ...options, force, env, platform });
  try {
    return await run(options.force);
  } catch (error) {
    if (!/already exists with different content/.test(error.message))
      throw error;
    const overwrite = await p.confirm({
      message: `${row.id}: a different file exists. Back it up and replace it?`,
      initialValue: false,
    });
    if (p.isCancel(overwrite) || !overwrite)
      return { status: "skipped", target: row.id, destination: "" };
    return run(true);
  }
}

const STATUS = {
  installed: "Installed",
  "already-installed": "Already up to date",
  "dry-run": "Would install (dry run)",
  skipped: "Skipped",
};

export async function installInteractive(rows, ids, options, env, platform) {
  let failed = 0;
  for (const id of ids) {
    const row = rows.find((r) => r.id === id && platformsOf(r, platform));
    if (!row) {
      p.log.error(paint("pink", `${id}: not available on ${platform}`));
      failed += 1;
      continue;
    }
    if (row.kind === "snippet" || row.kind === "builtin") {
      p.note(await snippetText(row), `${row.id} setup`);
      continue;
    }
    const spin = p.spinner();
    spin.start(`${options.dryRun ? "Checking" : "Installing"} ${row.id}`);
    try {
      const result = await installOne(row, options, env, platform).catch(
        (error) => {
          spin.stop(paint("pink", `${row.id}: ${error.message}`), 1);
          throw error;
        },
      );
      spin.stop(
        `${paint("green", STATUS[result.status])}: ${paint("yellow", row.id)}`,
      );
      if (result.destination) {
        const lines = [["Path", paint("lightBlue", result.destination)]];
        if (result.backupPath)
          lines.push(["Backup", paint("orange", result.backupPath)]);
        const step = nextStep(row.id);
        if (step && result.status !== "skipped" && !options.dryRun)
          lines.push(["Next", paint("purple", step)]);
        p.note(
          lines
            .map(([label, value]) => `${paint("dim", label.padEnd(7))}${value}`)
            .join("\n"),
          row.id,
        );
      }
    } catch {
      failed += 1;
    }
  }
  return failed;
}

function renderPicker(prompt, message) {
  const bar = paint("dim", "│");
  const head = `${bar}\n${paint("yellow", "◆")}  ${message}\n`;
  const selected = prompt.value ?? [];
  if (prompt.state === "submit" || prompt.state === "cancel") {
    const names = prompt.options
      .filter((option) => selected.includes(option.value))
      .map((option) => paint("dim", option.value))
      .join(paint("dim", ", "));
    return `${head}${bar}  ${names}${prompt.state === "cancel" ? `\n${bar}` : ""}`;
  }
  const style = (option, active) => {
    const checked = selected.includes(option.value);
    const pointer = active ? paint("yellow", "›") : " ";
    const box = checked
      ? paint("green", "◼")
      : paint(active ? "yellow" : "dim", "◻");
    const label = active
      ? `\x1b[1m${paint("yellow", option.value)}\x1b[22m`
      : paint("blue", option.value);
    const hint = option.hint ? ` ${paint("dim", `(${option.hint})`)}` : "";
    return `${pointer} ${box} ${label}${hint}`;
  };
  const prefix = `${bar}  `;
  const list = p
    .limitOptions({
      output: process.stdout,
      options: prompt.options,
      cursor: prompt.cursor,
      maxItems: undefined,
      columnPadding: 3,
      rowPadding: 6,
      style,
    })
    .join(`\n${prefix}`);
  const error =
    prompt.state === "error"
      ? `\n${paint("pink", prompt.error.split("\n")[0])}`
      : "";
  const key = (name) => paint("blue", name);
  const dot = paint("dim", " · ");
  const keys = [
    `${key("↑/↓")} ${paint("dim", "move")}`,
    `${key("space")} ${paint("dim", "select")}`,
    `${key("enter")} ${paint("dim", "confirm")}`,
  ].join(dot);
  return `${head}${prefix}${list}${error}\n${paint("dim", "└")}  ${keys}\n`;
}

export async function pick(rows, platform) {
  p.intro(chip("Cobalt2 theme installer"));
  const message = "Which targets should get the Cobalt2 theme?";
  const choice = await new MultiSelectPrompt({
    options: rows
      .filter((row) => platformsOf(row, platform))
      .map((row) => ({ value: row.id, hint: KIND_LABEL[row.kind] })),
    required: true,
    validate: (value) =>
      value?.length ? undefined : "Select at least one target with space.",
    render() {
      return renderPicker(this, message);
    },
  }).prompt();
  if (p.isCancel(choice)) {
    p.cancel("Cancelled. Nothing was changed.");
    return null;
  }
  return choice;
}

export function outro(failed, dryRun) {
  if (failed)
    p.outro(`Finished with ${failed} problem${failed > 1 ? "s" : ""}.`);
  else
    p.outro(
      dryRun
        ? "Dry run complete. No files were written."
        : paint("yellow", "Done. Enjoy Cobalt2!"),
    );
}

export function intro() {
  p.intro(chip("Cobalt2 theme installer"));
}
