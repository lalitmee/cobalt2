import test from "node:test";
import assert from "node:assert/strict";
import { formatList, isInteractive, nextStep } from "../src/ui.js";

test("interactive UI requires TTY streams and no CI", () => {
  const tty = { stdout: { isTTY: true }, stdin: { isTTY: true } };
  assert.equal(isInteractive(tty, {}), true);
  assert.equal(isInteractive(tty, { CI: "true" }), false);
  assert.equal(isInteractive(tty, { TERM: "dumb" }), false);
  assert.equal(isInteractive({ stdout: {}, stdin: {} }, {}), false);
});

test("formats targets with availability marks and activation hints", () => {
  const rows = [
    { id: "pi", kind: "copy", platforms: ["linux"] },
    { id: "tmux", kind: "copy", platforms: ["macos"] },
  ];
  const text = formatList(rows, "linux", {});
  assert.match(text, /● pi/);
  assert.match(text, /○ tmux/);
  const colored = formatList(rows, "linux", { COLORTERM: "truecolor" });
  assert.match(colored, /\x1b\[38;2;/);
  assert.match(nextStep("gemini-cli"), /ui/);
});
