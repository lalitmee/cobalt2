import { spawnSync } from "node:child_process";

const npmCli = process.env.npm_execpath;
const npmCommand = npmCli
  ? process.execPath
  : process.platform === "win32"
    ? "npm.cmd"
    : "npm";
const npmPrefix = npmCli ? [npmCli] : [];

for (const args of [
  ["run", "test"],
  ["run", "validate"],
  ["run", "format:check"],
]) {
  run(npmCommand, [...npmPrefix, ...args]);
}

run(process.platform === "win32" ? "python" : "python3", [
  "scripts/validate-native.py",
]);
run(npmCommand, [...npmPrefix, "pack", "--dry-run"]);

console.log(
  "Release checks passed. POSIX shell checks run in GitHub Actions on Linux and macOS.",
);

function run(command, args) {
  console.log(`\n> ${command} ${args.join(" ")}`);
  const result = spawnSync(command, args, {
    stdio: "inherit",
    shell: process.platform === "win32" && !npmCli,
  });
  if (result.error) throw result.error;
  if (result.status !== 0) process.exit(result.status ?? 1);
}
