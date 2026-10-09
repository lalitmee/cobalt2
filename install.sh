#!/bin/sh
set -eu

SCRIPT_DIR=$(CDPATH='' cd "$(dirname "$0")" && pwd)
MANIFEST="$SCRIPT_DIR/catalog/targets.psv"
TEMP_FILE=
cleanup() {
	if [ -n "$TEMP_FILE" ] && [ -e "$TEMP_FILE" ]; then rm -f "$TEMP_FILE"; fi
}
trap cleanup EXIT HUP INT TERM

usage() {
	cat <<'EOF'
Usage:
  ./install.sh list
  ./install.sh install <target> [--dry-run] [--force] [--config-dir <path>]
  ./install.sh snippet <target>
EOF
}

platform_name() {
	system=$(uname -s)
	case "$system" in
	Darwin) printf '%s\n' macos ;;
	Linux) printf '%s\n' linux ;;
	*) printf '%s\n' unsupported ;;
	esac
}

command_name=${1:-help}
shift || true
case "$command_name" in
help | -h | --help)
	usage
	exit 0
	;;
list)
	awk -F '|' 'NF == 7 && $1 !~ /^#/ { print $1 "\t" $2 "\t" $3 }' "$MANIFEST"
	exit 0
	;;
install | snippet) ;;
*)
	echo "unknown command: $command_name" >&2
	usage >&2
	exit 2
	;;
esac

target=${1:-}
if [ -z "$target" ]; then
	echo "$command_name requires a target" >&2
	exit 2
fi
shift
dry_run=0
force=0
config_dir=
while [ "$#" -gt 0 ]; do
	case "$1" in
	--dry-run) dry_run=1 ;;
	--force) force=1 ;;
	--config-dir)
		shift
		if [ "$#" -eq 0 ] || [ "${1#--}" != "$1" ]; then
			echo '--config-dir requires a path' >&2
			exit 2
		fi
		config_dir=$1
		;;
	*)
		echo "unknown option: $1" >&2
		exit 2
		;;
	esac
	shift
done
if [ "$command_name" != install ] && { [ "$dry_run" -eq 1 ] || [ "$force" -eq 1 ] || [ -n "$config_dir" ]; }; then
	echo 'install options are only valid with install' >&2
	exit 2
fi

platform=$(platform_name)
row=$(awk -F '|' -v wanted="$target" -v os="$platform" 'NF == 7 && $1 == wanted && $1 !~ /^#/ { n=split($3, p, ","); for (i=1; i<=n; i++) if (p[i] == os) { print; exit } }' "$MANIFEST")
if [ -z "$row" ]; then
	valid=$(awk -F '|' -v os="$platform" 'NF == 7 && $1 !~ /^#/ { n=split($3, p, ","); for (i=1; i<=n; i++) if (p[i] == os) { printf "%s%s", separator, $1; separator=", " } } END { print "" }' "$MANIFEST")
	echo "unsupported target/platform '$target/$platform'. Available targets: $valid" >&2
	exit 2
fi
old_ifs=$IFS
IFS='|'
read -r _ kind _ source destination checksum _ <<EOF
$row
EOF
IFS=$old_ifs

case "$kind" in
snippet)
	if [ "$command_name" != snippet ]; then
		echo "'$target' is a snippet; use: ./install.sh snippet $target" >&2
		exit 2
	fi
	cat "$SCRIPT_DIR/$source"
	exit 0
	;;
builtin)
	if [ "$command_name" != snippet ]; then
		echo "'$target' is built in; no file install is needed" >&2
		exit 2
	fi
	printf "%s\n" "WezTerm includes the Cobalt2 scheme. Set color_scheme = 'Cobalt2' in your WezTerm configuration."
	exit 0
	;;
copy | upstream)
	if [ "$command_name" = snippet ]; then
		echo "'$target' is an installable file target, not a snippet" >&2
		exit 2
	fi
	;;
*)
	echo "unsupported target kind: $kind" >&2
	exit 2
	;;
esac

case "$destination" in
*/*) ;;
*)
	echo "unsafe destination: $destination" >&2
	exit 2
	;;
esac
root_token=${destination%%/*}
suffix=${destination#*/}
case "/$suffix/" in */../* | */./* | *//*)
	echo "unsafe destination: $destination" >&2
	exit 2
	;;
esac
case "$suffix" in /* | "")
	echo "unsafe destination: $destination" >&2
	exit 2
	;;
esac
home=${HOME:-}
case "$root_token" in
HOME) root=$home ;;
CODEX_HOME) root=${CODEX_HOME:-${home:+$home/.codex}} ;;
CONFIG_HOME)
	if [ -n "${XDG_CONFIG_HOME:-}" ]; then
		root=$XDG_CONFIG_HOME
	elif [ -n "${APPDATA:-}" ] && [ "$platform" = windows ]; then
		root=$APPDATA
	else
		root=${home:+$home/.config}
	fi
	;;
PI_AGENT_DIR) root=${PI_CODING_AGENT_DIR:-${home:+$home/.pi/agent}} ;;
APPDATA) root=${APPDATA:-} ;;
*)
	echo "unsupported destination root: $root_token" >&2
	exit 2
	;;
esac
if [ -n "$config_dir" ]; then root=$config_dir; fi
if [ -z "$root" ] || [ "${root#/}" = "$root" ]; then
	echo "environment path for $root_token must be absolute" >&2
	exit 2
fi
destination_path=$root/$suffix
source_path=$SCRIPT_DIR/$source
if [ "$kind" = copy ] && [ ! -f "$source_path" ]; then
	echo "theme source missing: $source" >&2
	exit 1
fi
if [ "$dry_run" -eq 1 ]; then
	printf '%s\n' "dry-run: $target -> $destination_path"
	exit 0
fi

parent=${destination_path%/*}
mkdir -p "$parent"
TEMP_FILE=$(mktemp "$parent/.cobalt2-theme.XXXXXX")
if [ "$kind" = copy ]; then
	cp "$source_path" "$TEMP_FILE"
else
	if ! curl -fsSL "$source" -o "$TEMP_FILE"; then
		echo 'upstream theme download failed' >&2
		exit 1
	fi
	if command -v sha256sum >/dev/null 2>&1; then
		actual=$(sha256sum "$TEMP_FILE" | awk '{print $1}')
	elif command -v shasum >/dev/null 2>&1; then
		actual=$(shasum -a 256 "$TEMP_FILE" | awk '{print $1}')
	else
		echo 'sha256sum or shasum is required to validate Kitty' >&2
		exit 1
	fi
	if [ "$(printf '%s' "$actual" | tr 'A-F' 'a-f')" != "$(printf '%s' "$checksum" | tr 'A-F' 'a-f')" ]; then
		echo 'upstream theme SHA-256 mismatch' >&2
		exit 1
	fi
fi

if [ -f "$destination_path" ] && cmp -s "$TEMP_FILE" "$destination_path"; then
	rm -f "$TEMP_FILE"
	TEMP_FILE=
	printf '%s\n' "already-installed: $target -> $destination_path"
	exit 0
fi
if [ -e "$destination_path" ] && [ "$force" -ne 1 ]; then
	echo "destination already exists with different content: $destination_path" >&2
	exit 1
fi
backup=
if [ -e "$destination_path" ]; then
	timestamp=$(date '+%Y%m%d%H%M%S')
	backup="$destination_path.backup-$timestamp"
	suffix_number=1
	while [ -e "$backup" ]; do
		backup="$destination_path.backup-$timestamp-$suffix_number"
		suffix_number=$((suffix_number + 1))
	done
	mv "$destination_path" "$backup"
fi
if ! mv "$TEMP_FILE" "$destination_path"; then
	if [ -n "$backup" ]; then mv "$backup" "$destination_path"; fi
	echo 'could not install theme file' >&2
	exit 1
fi
TEMP_FILE=
if [ -n "$backup" ]; then
	printf '%s\n' "installed: $target -> $destination_path (backup: $backup)"
else
	printf '%s\n' "installed: $target -> $destination_path"
fi
