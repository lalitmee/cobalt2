#!/bin/sh
set -eu

ROOT=$(CDPATH='' cd "$(dirname "$0")/.." && pwd)
TEMP=$(mktemp -d "${TMPDIR:-/tmp}/cobalt2 shell test.XXXXXX")
trap 'rm -rf "$TEMP"' EXIT HUP INT TERM
HOME="$TEMP/home"
export HOME

sh "$ROOT/install.sh" install claude-code
DEST="$HOME/.claude/themes/cobalt2.json"
test -f "$DEST"
FIRST=$(cksum "$DEST")
sh "$ROOT/install.sh" install claude-code | grep 'already-installed' >/dev/null
test "$(cksum "$DEST")" = "$FIRST"

printf 'user data\n' >"$DEST"
if sh "$ROOT/install.sh" install claude-code; then
	echo 'expected collision to fail' >&2
	exit 1
fi
grep 'user data' "$DEST" >/dev/null
sh "$ROOT/install.sh" install claude-code --force
test "$(find "$(dirname "$DEST")" -name 'cobalt2.json.backup-*' | wc -l | tr -d ' ')" = 1

OVERRIDE="$TEMP/config with spaces"
sh "$ROOT/install.sh" install claude-code --config-dir "$OVERRIDE" --dry-run
test ! -e "$OVERRIDE"
sh "$ROOT/install.sh" install claude-code --config-dir "$OVERRIDE"
test -f "$OVERRIDE/.claude/themes/cobalt2.json"

if sh "$ROOT/install.sh" install no-such-theme --config-dir "$TEMP/invalid"; then
	echo 'expected unsupported target to fail' >&2
	exit 1
fi
test ! -e "$TEMP/invalid"
if (cd "$TEMP" && sh "$ROOT/install.sh" install claude-code --config-dir "relative config"); then
	echo 'expected relative config directory to fail' >&2
	exit 1
fi
test ! -e "$TEMP/relative config"
echo 'shell installer checks passed'
