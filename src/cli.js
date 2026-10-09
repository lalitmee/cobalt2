import { readFile } from "node:fs/promises";
import { fileURLToPath } from "node:url";
import { findTarget, loadCatalog } from "./catalog.js";
import { installTarget } from "./installer.js";

export function parseArgs(argv) {
  const [command = "help", target, ...args] = argv;
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
  if (!["help", "list", "install", "snippet"].includes(command))
    throw new Error(`unknown command: ${command}`);
  if ((command === "help" || command === "list") && target)
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
  const parsed = parseArgs(argv);
  if (parsed.command === "help") {
    io.stdout.write(
      "Usage: cobalt2-theme list | install <target> [--dry-run] [--force] [--config-dir <path>] | snippet <target>\n",
    );
    return 0;
  }
  const rows = await loadCatalog();
  if (parsed.command === "list") {
    for (const row of rows)
      io.stdout.write(`${row.id}\t${row.kind}\t${row.platforms.join(", ")}\n`);
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
