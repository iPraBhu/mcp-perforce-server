# Release Notes Draft

Version: `3.2.0`

## Summary

This release expands native Perforce parity, adds richer MCP-only workflow helpers, and refreshes the repository documentation to match the current server surface.

## Highlights

### Batch parity for current tool coverage

- Added backward-compatible plural inputs where native `p4` supports multi-target usage.
- Preserved existing singular parameters for compatibility with current MCP clients.
- Expanded batch support across commands such as `sync`, `opened`, `filelog`, `annotate`, `grep`, `files`, `dirs`, `print`, `fstat`, `sizes`, `have`, `users`, `streams`, `jobs`, and `fixes`.

### Broader native flag coverage

- Expanded native-style option support for `p4.sync`, `p4.interchanges`, `p4.fstat`, `p4.files`, `p4.dirs`, `p4.streams`, `p4.clients`, `p4.labels`, `p4.jobs`, and `p4.sizes`.
- Improved parsing for newer interchanges output shapes.

### New MCP-only workflow helpers

- Added `p4.file.inspect`
- Added `p4.workspace.snapshot`
- Added `p4.search.inspect`
- Added `p4.review.prepare`

These helpers reduce MCP round trips and return review-ready or search-ready aggregate responses.

### Documentation and repository cleanup

- Rewrote `README.md` to reflect the current tool surface, safety model, configuration, and workflow helpers.
- Added this release-notes draft to simplify publishing.
- Removed outdated standalone helper scripts that were not part of package scripts or the published artifact set.

## Compatibility

- No breaking tool-name changes.
- Existing singular parameters remain supported where plural batch inputs were added.
- Dot and underscore tool naming remain accepted.

## Verification

- `npm run build`
- `npm test`
- `npm run test:integration`

## Notes for Publish

- Update `package.json` version before publishing.
- Copy these notes into the GitHub release and npm publish workflow as needed.
