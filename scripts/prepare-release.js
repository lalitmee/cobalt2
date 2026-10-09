import { readFile, writeFile } from "node:fs/promises";
import { spawnSync } from "node:child_process";

const [version, ...options] = process.argv.slice(2);
const sinceIndex = options.indexOf("--since");
const baseline = sinceIndex >= 0 ? options[sinceIndex + 1] : undefined;
const dateIndex = options.indexOf("--date");
const requestedDate = dateIndex >= 0 ? options[dateIndex + 1] : undefined;

if (
  !version ||
  !/^\d+\.\d+\.\d+$/.test(version) ||
  !baseline ||
  (requestedDate && !/^\d{4}-\d{2}-\d{2}$/.test(requestedDate))
) {
  fail(
    "Usage: npm run release:prepare -- <version> --since <git-ref> [--date YYYY-MM-DD]",
  );
}

const currentPackage = JSON.parse(await readFile("package.json", "utf8"));
if (compareVersions(version, currentPackage.version) < 0) {
  fail(
    `Release version ${version} cannot be lower than current version ${currentPackage.version}.`,
  );
}

const baselineCheck = git(["rev-parse", "--verify", `${baseline}^{commit}`]);
if (baselineCheck.status !== 0) fail(`Git baseline not found: ${baseline}`);

const log = git(["log", "--format=%s%x00%b%x1e", `${baseline}..HEAD`]);
if (log.status !== 0)
  fail(log.stderr.trim() || "Could not read commits from Git.");
const entries = parseCommits(log.stdout);
if (!entries.length)
  fail("No Conventional Commits found in the selected range.");

const changelog = await readFile("CHANGELOG.md", "utf8");
const versionHeading = new RegExp(
  `^## ${escapeRegex(version)}(?:\\s+-.*)?$`,
  "m",
);
const existingSection = versionHeading.exec(changelog);
const releaseDate = requestedDate || localDate(new Date());
const releaseNotes = formatEntry(version, releaseDate, entries);
let updatedChangelog;
if (existingSection) {
  const sectionStart = existingSection.index;
  const sectionContentStart = sectionStart + existingSection[0].length;
  const followingHeading = changelog.slice(sectionContentStart).search(/^## /m);
  const suffix =
    followingHeading < 0
      ? ""
      : changelog.slice(sectionContentStart + followingHeading);
  updatedChangelog = `${changelog.slice(0, sectionStart)}${releaseNotes}${suffix ? `\n\n${suffix}` : "\n"}`;
} else {
  updatedChangelog = changelog.replace(
    /^(# Changelog\s*\n)/,
    `$1\n${releaseNotes}\n`,
  );
  if (updatedChangelog === changelog)
    fail("CHANGELOG.md must start with '# Changelog'.");
}

const lock = JSON.parse(await readFile("package-lock.json", "utf8"));
currentPackage.version = version;
lock.version = version;
if (lock.packages?.[""]) lock.packages[""].version = version;

await writeFile("package.json", `${JSON.stringify(currentPackage, null, 2)}\n`);
await writeFile("package-lock.json", `${JSON.stringify(lock, null, 2)}\n`);
await writeFile("VERSION", `${version}\n`);
await writeFile("CHANGELOG.md", updatedChangelog);
console.log(`Prepared ${version}: updated package versions and CHANGELOG.md.`);

function parseCommits(text) {
  const groups = new Map([
    ["Breaking Changes", []],
    ["Added", []],
    ["Fixed", []],
    ["Performance", []],
    ["Changed", []],
  ]);
  for (const record of text.split("\x1e")) {
    const normalizedRecord = record.replace(/^\r?\n+/, "");
    const separator = normalizedRecord.indexOf("\x00");
    if (separator < 0) continue;
    const subject = normalizedRecord.slice(0, separator);
    const body = normalizedRecord.slice(separator + 1);
    const match =
      /^(feat|fix|perf|refactor|docs|style|test|build|ci|chore)(?:\(([^)]+)\))?(!)?: (.+)$/.exec(
        subject,
      );
    if (!match) continue;
    const [, type, scope, breaking, summary] = match;
    if (type === "chore" && scope === "release") continue;
    const detail = `${scope ? `${scope}: ` : ""}${summary}`;
    const isBreaking = Boolean(breaking) || body.includes("BREAKING CHANGE:");
    if (isBreaking) groups.get("Breaking Changes").push(detail);
    else if (type === "feat") groups.get("Added").push(detail);
    else if (type === "fix") groups.get("Fixed").push(detail);
    else if (type === "perf") groups.get("Performance").push(detail);
    else groups.get("Changed").push(detail);
  }
  return [...groups].filter(([, notes]) => notes.length);
}

function formatEntry(releaseVersion, date, groups) {
  return [
    `## ${releaseVersion} - ${date}`,
    ...groups.flatMap(([heading, notes]) => [
      `\n### ${heading}\n`,
      ...notes.map((note) => `- ${note}`),
    ]),
  ].join("\n");
}

function compareVersions(left, right) {
  const a = left.split(".").map(Number);
  const b = right.split(".").map(Number);
  for (let index = 0; index < 3; index += 1) {
    if (a[index] !== b[index]) return a[index] - b[index];
  }
  return 0;
}

function localDate(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function git(args) {
  return spawnSync("git", args, { encoding: "utf8" });
}

function escapeRegex(value) {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function fail(message) {
  console.error(message);
  process.exit(1);
}
