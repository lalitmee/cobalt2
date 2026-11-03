import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { findTarget, loadCatalog } from "./catalog.js";
import { installTarget } from "./installer.js";
import * as ui from "./ui.js";

export function parseArgs(argv) {
  const [inputCommand = "help", target, ...args] = argv;
  const command = ["-h", "--help"].includes(inputCommand)
    ? "help"
    : ["-v", "-V", "--version"].includes(inputCommand)
      ? "version"
      : inputCommand;
  const options = { dryRun: false, force: false, configDir: undefined };
  for (let index = 0; index < args.length; index += 1) {
    const arg = args[index];
    if (arg === "--dry-run") options.dryRun = true;
    else if (arg === "--force") options.force = true;
    else if (arg === "--config-dir") {
      const path = args[++index];
      if (!path || path.startsWith("--"))
        throw new Error("--config-dir requires a path");
      options.configDir = path;
    } else throw new Error(`unknown option: ${arg}`);
  }
  if (!["help", "version", "list", "install", "snippet"].includes(command))
    throw new Error(
      `unknown command: ${command}\nRun 'cobalt2-theme --help' for usage.`,
    );
  if (
    (command === "help" || command === "version" || command === "list") &&
    target
  )
    throw new Error(`${command} does not accept a target`);
  if ((command === "install" || command === "snippet") && !target)
    throw new Error(`${command} requires a target`);
  if (
    command !== "install" &&
    (options.dryRun || options.force || options.configDir)
  )
    throw new Error("install options are only valid with install");
  return { command, target, options };
}

async function packageVersion() {
  const manifest = new URL("../package.json", import.meta.url);
  return JSON.parse(await readFile(manifest, "utf8")).version;
}

function currentPlatform(platform = process.platform) {
  if (platform === "win32") return "windows";
  if (platform === "darwin") return "macos";
  return "linux";
}

export async function run(
  argv = process.argv.slice(2),
  io = process,
  env = process.env,
  platform = process.platform,
) {
  const fancy = ui.isInteractive(io, env);
  if (fancy && argv.length === 0) {
    const rows = await loadCatalog();
    const ids = await ui.pick(rows, currentPlatform(platform));
    if (!ids) return 130;
    const failed = await ui.installInteractive(
      rows,
      ids,
      { dryRun: false, force: false },
      env,
      currentPlatform(platform),
    );
    ui.outro(failed, false);
    return failed ? 1 : 0;
  }
  const parsed = parseArgs(argv);
  if (parsed.command === "version") {
    io.stdout.write(`${await packageVersion()}\n`);
    return 0;
  }
  if (parsed.command === "help") {
    io.stdout
      .write(`Cobalt2 themes for coding agents and developer tools (v${await packageVersion()}).

Usage:
  cobalt2-theme <command> [options]

Commands:
  list                       List available targets and platforms
  install <target>           Install one theme target
  snippet <target>           Print a setup snippet or built-in instructions
  help                       Show this help
  version                    Print the installed version (also -v, --version)

Install options:
  --dry-run                  Show the destination without writing a file
  --force                    Back up an existing file before replacing it
  --config-dir <path>        Use an absolute configuration directory

Examples:
  npx --yes cobalt2-theme list
  npx --yes cobalt2-theme install codex-cli
  npx --yes cobalt2-theme install codex-cli --dry-run
  npx --yes cobalt2-theme install claude-code --config-dir "$HOME/custom-config"
  npx --yes cobalt2-theme snippet codex-desktop
  npx --yes cobalt2-theme --version

Run with no arguments in a terminal to pick targets interactively.
`);
    return 0;
  }
  const rows = await loadCatalog();
  if (parsed.command === "list" && fancy) {
    ui.showList(rows, currentPlatform(platform));
    return 0;
  }
  if (parsed.command === "list") {
    const idWidth = Math.max(...rows.map((row) => row.id.length));
    const kindWidth = Math.max(...rows.map((row) => row.kind.length));
    for (const row of rows) {
      io.stdout.write(
        `${row.id.padEnd(idWidth)}  ${row.kind.padEnd(kindWidth)}  ${row.platforms.join(", ")}\n`,
      );
    }
    return 0;
  }
  const row = findTarget(rows, parsed.target, currentPlatform(platform));
  if (parsed.command === "snippet") {
    if (row.kind === "snippet") {
      const source = fileURLToPath(
        new URL(`../${row.source}`, import.meta.url),
      );
      io.stdout.write(await readFile(source, "utf8"));
      return 0;
    }
    if (row.kind === "builtin") {
      io.stdout.write(
        "WezTerm includes the Cobalt2 scheme. Set color_scheme = 'Cobalt2' in your WezTerm configuration.\n",
      );
      return 0;
    }
    throw new Error(`'${row.id}' is an installable file target, not a snippet`);
  }
  if (fancy) {
    ui.intro();
    const failed = await ui.installInteractive(
      rows,
      [row.id],
      parsed.options,
      env,
      currentPlatform(platform),
    );
    ui.outro(failed, parsed.options.dryRun);
    return failed ? 1 : 0;
  }
  const result = await installTarget(row, {
    dryRun: parsed.options.dryRun,
    force: parsed.options.force,
    configDir: parsed.options.configDir,
    env,
    platform,
  });
  io.stdout.write(
    `${result.status}: ${result.target} -> ${result.destination}${result.backupPath ? ` (backup: ${result.backupPath})` : ""}\n`,
  );
  return 0;
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  run().catch((error) => {
    process.stderr.write(`${error.message}\n`);
    process.exitCode = 1;
  });
}
