import { createHash } from "node:crypto";
import {
  mkdir,
  mkdtemp,
  readFile,
  rename,
  rm,
  stat,
  writeFile,
} from "node:fs/promises";
import { dirname, isAbsolute, join, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const projectRoot = fileURLToPath(new URL("../", import.meta.url));

function homeFor(env, platform) {
  return (
    env.HOME ||
    env.USERPROFILE ||
    (platform === "win32" ? env.HOMEDRIVE + env.HOMEPATH : undefined)
  );
}

export function resolveDeclaredRootAndSuffix(
  destination,
  env = process.env,
  platform = process.platform,
) {
  const match = /^([A-Z_]+)\/(.+)$/.exec(destination ?? "");
  if (!match) throw new Error(`unsafe destination: ${destination}`);
  const [, token, suffixText] = match;
  const parts = suffixText.split(/[\\/]/);
  if (
    parts.some((part) => !part || part === "." || part === "..") ||
    isAbsolute(suffixText)
  ) {
    throw new Error(`unsafe destination: ${destination}`);
  }
  const home = homeFor(env, platform);
  const roots = {
    HOME: home,
    CODEX_HOME: env.CODEX_HOME || (home && join(home, ".codex")),
    CONFIG_HOME: env.XDG_CONFIG_HOME || (home && join(home, ".config")),
    PI_AGENT_DIR:
      env.PI_CODING_AGENT_DIR || (home && join(home, ".pi", "agent")),
    APPDATA: env.APPDATA,
  };
  const root = roots[token];
  if (!root || !isAbsolute(root))
    throw new Error(
      `environment path for ${token} is unavailable or not absolute`,
    );
  return { root: resolve(root), suffix: parts.join(sep) };
}

export function resolveDestination(
  row,
  env = process.env,
  platform = process.platform,
  override,
) {
  if (override !== undefined && !isAbsolute(override)) {
    throw new Error("--config-dir must be an absolute path");
  }
  const { root, suffix } = resolveDeclaredRootAndSuffix(
    row.destination,
    env,
    platform,
  );
  const installRoot = resolve(override ?? root);
  const destination = resolve(installRoot, suffix);
  if (!destination.startsWith(`${installRoot}${sep}`)) {
    throw new Error(`unsafe destination: ${row.destination}`);
  }
  return destination;
}

async function exists(path) {
  try {
    return (await stat(path)).isFile();
  } catch (error) {
    if (error.code === "ENOENT") return false;
    throw error;
  }
}

async function backupName(destination) {
  const timestamp = new Date().toISOString().replaceAll(":", "-");
  const base = `${destination}.backup-${timestamp}`;
  let candidate = base;
  let suffix = 1;
  while (await exists(candidate)) {
    candidate = `${base}-${suffix}`;
    suffix += 1;
  }
  return candidate;
}

export async function installTarget(row, options = {}) {
  if (!new Set(["copy", "upstream"]).has(row.kind))
    throw new Error(`target '${row.id}' cannot be installed as a file`);
  const destination =
    options.destination ??
    resolveDestination(row, options.env, options.platform, options.configDir);
  if (!isAbsolute(destination))
    throw new Error("destination must be an absolute path");
  let content;
  if (row.kind === "copy") {
    const sourceRoot = resolve(projectRoot);
    const source = options.sourcePath
      ? resolve(options.sourcePath)
      : resolve(sourceRoot, row.source);
    if (!options.sourcePath && !source.startsWith(`${sourceRoot}${sep}`))
      throw new Error(`unsafe source path: ${row.source}`);
    content = await readFile(source);
  } else {
    const url = new URL(row.source);
    if (url.protocol !== "https:")
      throw new Error("upstream theme URL must use HTTPS");
    const response = await (options.fetch ?? fetch)(url);
    if (!response.ok)
      throw new Error(`upstream download failed: HTTP ${response.status}`);
    content = Buffer.from(await response.arrayBuffer());
    const digest = createHash("sha256").update(content).digest("hex");
    if (digest.toLowerCase() !== row.sha256.toLowerCase())
      throw new Error("upstream theme SHA-256 mismatch");
  }

  if (await exists(destination)) {
    const existing = await readFile(destination);
    if (existing.equals(content))
      return {
        status: "already-installed",
        target: row.id,
        destination,
        backupPath: null,
      };
    if (!options.force)
      throw new Error(
        `destination already exists with different content: ${destination}`,
      );
  }
  if (options.dryRun)
    return { status: "dry-run", target: row.id, destination, backupPath: null };

  await mkdir(dirname(destination), { recursive: true });
  const tempDir = await mkdtemp(join(dirname(destination), ".cobalt2-"));
  const tempPath = join(tempDir, "theme.tmp");
  let backupPath = null;
  try {
    await writeFile(tempPath, content, { mode: 0o644 });
    if (await exists(destination)) {
      backupPath = await backupName(destination);
      await rename(destination, backupPath);
    }
    await rename(tempPath, destination);
  } catch (error) {
    if (backupPath) await rename(backupPath, destination).catch(() => {});
    throw error;
  } finally {
    await rm(tempDir, { recursive: true, force: true });
  }
  return { status: "installed", target: row.id, destination, backupPath };
}
