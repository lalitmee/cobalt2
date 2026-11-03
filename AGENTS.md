# Agent instructions

## Releases and versioning

- Bump the version only if the current version in `package.json` has already been published to npm. Check with `npm view cobalt2-theme version` and compare.
- If the current version is committed but not yet published, do not bump. Add new changes to that unreleased version: regenerate its `CHANGELOG.md` section with `npm run release:prepare -- <same version> --since <previous release commit>`.
- Never run `npm publish`, commit, or push without explicit approval.
- Run `npm run check:release` before preparing or publishing a release.

## Themes

- Add a new target as a row in `catalog/targets.psv`, a theme file under `themes/`, and a README section. `npm run validate` checks all three.
- `themes/shared/cobalt2.tmTheme` is shared by Codex CLI and bat. A change affects both.
- Theme files must not contain machine-specific paths, plugins, or commands.
