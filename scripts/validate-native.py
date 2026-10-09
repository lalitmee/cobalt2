#!/usr/bin/env python3
"""Validate native plist, TOML, and INI theme formats with Python's stdlib."""

from configparser import ConfigParser
from pathlib import Path
import plistlib
import tomllib

ROOT = Path(__file__).resolve().parents[1]

with (ROOT / "themes/shared/cobalt2.tmTheme").open("rb") as theme:
    plistlib.load(theme)

with (ROOT / "snippets/codex-desktop.toml").open("rb") as snippet:
    values = tomllib.load(snippet)
assert values["accent"] == "#00AAFF"

copyq = ConfigParser(interpolation=None)
copyq.read(ROOT / "themes/copyq/cobalt2.ini", encoding="utf-8")
assert copyq.sections()

print("validated plist, TOML, and INI theme formats")
