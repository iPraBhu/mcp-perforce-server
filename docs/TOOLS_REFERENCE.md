# MCP Perforce Tool Reference

This document contains the detailed reference for all MCP tools exposed by this server.

## Common Behavior

- All tools return structured JSON (`ok`, `result`, optional `error`, optional `warnings`, `configUsed`).
- Most tools accept `workspacePath` (optional) to control where `.p4config` is discovered.
- MCP clients are advertised underscore-safe tool names such as `p4_changes`; the dotted names below remain accepted as backward-compatible aliases.

Safety controls:

| Variable | Default | Behavior |
|---|---|---|
| `P4_READONLY_MODE` | `true` | Blocks write-capable tools (`p4.add`, `p4.edit`, `p4.delete`, `p4.revert`, `p4.sync`, changelist submit/update/create, resolve/shelve/unshelve, copy/move/integrate/merge). |
| `P4_DISABLE_DELETE` | `true` | Blocks `p4.delete` even if write mode is enabled. |

Diff behavior:

| Tool | Behavior |
|---|---|
| `p4.diff` | Workspace/local vs depot comparison. |
| `p4.diff2` | Depot-to-depot server-side comparison (no workspace mapping required). |

## Repository Operations

### `p4.info`
- Purpose: Get Perforce server and client information.
- Parameters: `workspacePath?`
- CLI equivalent: `p4 info`

### `p4.status`
- Purpose: Return opened files and pending changelists summary.
- Parameters: `workspacePath?`
- Notes: Internally aggregates `opened` and `changes`.

### `p4.sync`
- Purpose: Sync files from depot.
- Parameters: `filespec?`, `force?`, `preview?`, `workspacePath?`
- CLI equivalent: `p4 sync [-f] [-n] [filespec]`

### `p4.opened`
- Purpose: List opened files.
- Parameters: `changelist?`, `workspacePath?`
- CLI equivalent: `p4 opened [-c changelist]`

### `p4.have`
- Purpose: List files currently synced in workspace.
- Parameters: `filespec?`, `workspacePath?`
- CLI equivalent: `p4 have [filespec]`

### `p4.where`
- Purpose: Show depot/local/workspace mappings.
- Parameters: `files` (required string array), `workspacePath?`
- CLI equivalent: `p4 where <files...>`

## File Operations

### `p4.add`
- Purpose: Open files for add.
- Parameters: `files` (required string array), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 add [-c changelist] <files...>`

### `p4.edit`
- Purpose: Open files for edit.
- Parameters: `files` (required string array), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 edit [-c changelist] <files...>`

### `p4.delete`
- Purpose: Open files for delete.
- Parameters: `files` (required string array), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 delete [-c changelist] <files...>`

### `p4.revert`
- Purpose: Revert opened files.
- Parameters: `files?`, `changelist?`, `workspacePath?`
- CLI equivalent: `p4 revert [-c changelist] [files...]`

### `p4.diff`
- Purpose: Diff workspace/local files against depot.
- Parameters: `files?`, `summary?`, `workspacePath?`
- CLI equivalent: `p4 diff [-s] [files...]`

### `p4.diff2`
- Purpose: Depot-to-depot diff (server-side, no workspace mapping required).
- Parameters: `sourcePath` (required), `targetPath` (required), `summaryOnly?` (default `true`), `workspacePath?`
- CLI equivalent: `p4 diff2 [-q] <sourcePath> <targetPath>`
- Result details:
  - Summary mode: differing file pairs.
  - Full mode: differing file pairs plus diff content.

### `p4.copy`
- Purpose: Copy files between locations.
- Parameters: `source` (required), `destination` (required), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 copy [-c changelist] <source> <destination>`

### `p4.move`
- Purpose: Move/rename files.
- Parameters: `source` (required), `destination` (required), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 move [-c changelist] <source> <destination>`

### `p4.integrate`
- Purpose: Integrate from source to target.
- Parameters: `source` (required), `target` (required), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 integrate [-c changelist] <source> <target>`

### `p4.merge`
- Purpose: Merge from source to target.
- Parameters: `source` (required), `target` (required), `changelist?`, `workspacePath?`
- CLI equivalent: `p4 merge [-c changelist] <source> <target>`

### `p4.blame`
- Purpose: Annotate file history by line.
- Parameters: `file` (required), `workspacePath?`
- CLI equivalent: `p4 annotate -a <file>`

### `p4.annotate`
- Purpose: Alias of `p4.blame` for line annotation.
- Parameters: `file` (required), `workspacePath?`
- CLI equivalent: `p4 annotate -a <file>`

## Merge and Conflict Resolution

### `p4.resolve`
- Purpose: Resolve merges.
- Parameters: `changelist?`, `files?`, `strategy?`, `workspacePath?`
- Strategy values: `accept-theirs`, `accept-yours`, `merge`, `edit`, `skip`
- CLI equivalent: `p4 resolve` with strategy flags

### `p4.shelve`
- Purpose: Shelve files for review.
- Parameters: `changelist` (required), `files?`, `delete?`, `workspacePath?`
- CLI equivalent: `p4 shelve -c <changelist> [files...]` or delete shelved

### `p4.unshelve`
- Purpose: Unshelve files.
- Parameters: `changelist` (required), `files?`, `force?`, `workspacePath?`
- CLI equivalent: `p4 unshelve -s <changelist> [files...]`

## Changelist Operations

### `p4.changelist.create`
- Purpose: Create a pending changelist.
- Parameters: `description` (required), `files?`, `workspacePath?`
- CLI equivalent: `p4 change -i`

### `p4.changelist.update`
- Purpose: Update changelist metadata.
- Parameters: `changelist` (required), `description?`, `files?`, `workspacePath?`
- CLI equivalent: `p4 change -i`

### `p4.changelist.submit`
- Purpose: Submit a numbered changelist.
- Parameters: `changelist` (required), `workspacePath?`
- CLI equivalent: `p4 submit -c <changelist>`

### `p4.submit`
- Purpose: Submit from default changelist/spec.
- Parameters: `description` (required), `files?`, `workspacePath?`
- CLI equivalent: `p4 submit -i`

### `p4.describe`
- Purpose: Describe changelist details.
- Parameters: `changelist` (required string or number), `includeDiff?`, `diffFormat?` (`u` | `c` | `n` | `s`), `workspacePath?`
- CLI equivalent: `p4 describe -s <changelist>` or `p4 describe -d<format> <changelist>`
- Result details include: change metadata, description text, affected files/actions, and optional diff content when `includeDiff=true`.

### `p4.changes`
- Purpose: List changelists with filters.
- Parameters: `status?`, `user?`, `client?`, `max?`, `filespec?`, `workspacePath?`
- CLI equivalent: `p4 changes [filters]`

### `p4.review`
- Purpose: List changelists pending review.
- Parameters: `counter?`, `filespec?`, `workspacePath?`
- CLI equivalent: `p4 review [-t counter] [filespec]`

### `p4.reviews`
- Purpose: List reviewers for files or a changelist.
- Parameters: `changelist?`, `files?`, `workspacePath?`
- CLI equivalent: `p4 reviews [-c changelist] [files...]`

### `p4.interchanges`
- Purpose: List changelists not yet integrated between two paths.
- Parameters: `sourcePath` (required), `targetPath` (required), `max?`, `longDescription?`, `workspacePath?`
- CLI equivalent: `p4 interchanges [-l] [-m max] <sourcePath> <targetPath>`

### `p4.integrated`
- Purpose: Show integration history between source/target paths.
- Parameters: `sourcePath` (required), `targetPath?`, `workspacePath?`
- CLI equivalent: `p4 integrated <sourcePath> [targetPath]`

## Workflow Composites

### `p4.review.bundle`
- Purpose: Composite review helper that combines `p4.review` with optional `p4.describe` and `p4.reviews`.
- Parameters: `counter?`, `filespec?`, `maxChanges?`, `includeDescribe?`, `includeReviewers?`, `workspacePath?`
- Notes: Returns a single bundle result with step status and aggregated change entries.

### `p4.change.inspect`
- Purpose: Composite changelist inspector combining `p4.describe`, `p4.fixes`, `p4.reviews`, and optional `p4.filelog`.
- Parameters: `changelist` (required), `includeDiff?`, `diffFormat?`, `includeFileHistory?`, `maxFilesWithHistory?`, `maxRevisions?`, `workspacePath?`
- Notes: Designed for one-shot code review context on a specific changelist.

### `p4.path.synccheck`
- Purpose: Composite branch/path sync analysis using `p4.interchanges` and optional `p4.integrated`.
- Parameters: `sourcePath` (required), `targetPath` (required), `maxInterchanges?`, `includeIntegrated?`, `checkBothDirections?`, `workspacePath?`
- Notes: Returns forward/reverse drift counts and a computed sync state.

## Search and Discovery

### `p4.grep`
- Purpose: Search text across depot files.
- Parameters: `pattern` (required), `filespec?`, `caseInsensitive?`, `workspacePath?`
- CLI equivalent: `p4 grep [options] <pattern> [filespec]`

### `p4.files`
- Purpose: List depot files.
- Parameters: `filespec?`, `max?`, `workspacePath?`
- CLI equivalent: `p4 files [filespec]`

### `p4.dirs`
- Purpose: List depot directories.
- Parameters: `filespec?`, `workspacePath?`
- CLI equivalent: `p4 dirs [filespec]`

### `p4.filelog`
- Purpose: File revision history.
- Parameters: `filespec` (required), `maxRevisions?`, `workspacePath?`
- CLI equivalent: `p4 filelog [-m max] <filespec>`

### `p4.fstat`
- Purpose: File metadata.
- Parameters: `filespec` (required), `max?`, `workspacePath?`
- CLI equivalent: `p4 fstat [options] <filespec>`

### `p4.print`
- Purpose: Print depot file content.
- Parameters: `filespec` (required), `quiet?` (default true), `workspacePath?`
- CLI equivalent: `p4 print [-q] <filespec>`

## User and Client Management

### `p4.users`
- Purpose: List users.
- Parameters: `user?`, `max?`, `workspacePath?`
- CLI equivalent: `p4 users [filters]`

### `p4.user`
- Purpose: Show one user.
- Parameters: `user?`, `workspacePath?`
- CLI equivalent: `p4 user -o [user]`

### `p4.clients`
- Purpose: List client workspaces.
- Parameters: `user?`, `max?`, `workspacePath?`
- CLI equivalent: `p4 clients [filters]`

### `p4.client`
- Purpose: Show one client workspace spec.
- Parameters: `client?`, `workspacePath?`
- CLI equivalent: `p4 client -o [client]`

## Jobs and Fixes

### `p4.jobs`
- Purpose: List jobs.
- Parameters: `job?`, `max?`, `workspacePath?`
- CLI equivalent: `p4 jobs [filters]`

### `p4.job`
- Purpose: Show one job.
- Parameters: `job` (required), `workspacePath?`
- CLI equivalent: `p4 job -o <job>`

### `p4.fixes`
- Purpose: Show changelist/job relationships.
- Parameters: `changelist?`, `job?`, `workspacePath?`
- CLI equivalent: `p4 fixes [filters]`

## Labels and Streams

### `p4.labels`
- Purpose: List labels.
- Parameters: `label?`, `user?`, `max?`, `workspacePath?`
- CLI equivalent: `p4 labels [filters]`

### `p4.label`
- Purpose: Show one label.
- Parameters: `label` (required), `workspacePath?`
- CLI equivalent: `p4 label -o <label>`

### `p4.streams`
- Purpose: List streams.
- Parameters: `stream?`, `max?`, `workspacePath?`
- CLI equivalent: `p4 streams [filters]`

### `p4.stream`
- Purpose: Show stream spec.
- Parameters: `stream` (required), `workspacePath?`
- CLI equivalent: `p4 stream -o <stream>`

## Analytics and Monitoring

### `p4.sizes`
- Purpose: File and depot size stats.
- Parameters: `filespec?`, `workspacePath?`
- CLI equivalent: `p4 sizes [filespec]`

### `p4.audit`
- Purpose: Audit log query for compliance reporting.
- Parameters: `tool?`, `result?`, `since?`, `user?`, `format?`, `workspacePath?`
- CLI equivalent: MCP server internal audit store query

### `p4.compliance`
- Purpose: Current compliance/security settings and status.
- Parameters: `workspacePath?`
- CLI equivalent: MCP server internal compliance status

## Utility

### `p4.config.detect`
- Purpose: Detect effective Perforce config from env and `.p4config`.
- Parameters: `workspacePath?`
- CLI equivalent: server-side config discovery helper

## Response Shape

Typical response:

```json
{
  "ok": true,
  "command": "describe",
  "args": ["-s", "12345"],
  "cwd": "C:/workspace/project",
  "configUsed": {
    "P4PORT": "perforce-server:1666",
    "P4USER": "user1",
    "P4CLIENT": "ws-main",
    "p4configPath": "C:/workspace/project/.p4config"
  },
  "result": {}
}
```

Error response includes:

- `ok: false`
- `error.code`
- `error.message`
- optional `error.stderr`

## Notes

- For high-frequency read usage, leave `P4_RESPONSE_CACHE=true` (default).
- For fully audited, stricter mode use `P4_PERFORMANCE_MODE=secure`.
- For best latency in automation use `P4_PERFORMANCE_MODE=fast` (default).
