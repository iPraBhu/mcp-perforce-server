# MCP Perforce Server

[![npm version](https://badge.fury.io/js/mcp-perforce-server.svg)](https://www.npmjs.com/package/mcp-perforce-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)
[![MCPAmpel](https://img.shields.io/endpoint?url=https://mcpampel.com/badge/iPraBhu/mcp-perforce-server.json)](https://mcpampel.com/repo/iPraBhu/mcp-perforce-server)

`mcp-perforce-server` is a Model Context Protocol server for Perforce (`p4`) with safe defaults, structured JSON responses, and both native-style and MCP-optimized workflows.

It is designed for AI assistants and IDE integrations that need Perforce access without relying on brittle shell scripting.

## What It Provides

- 59 MCP tools across repository inspection, file operations, changelists, reviews, jobs, labels, streams, analytics, and compliance.
- Safe-by-default runtime behavior:
  - `P4_READONLY_MODE=true`
  - `P4_DISABLE_DELETE=true`
- Batch-capable inputs for the tool surface where native `p4` supports multi-target usage.
- MCP-specific composite helpers that reduce round trips for common review and search workflows.
- Structured responses with `ok`, `result`, optional `error`, optional `warnings`, and `configUsed`.
- Compatibility with both dot and underscore tool naming:
  - `p4.changes`
  - `p4_changes`

## Highlighted Workflows

The server includes higher-level helpers on top of raw `p4` commands.

- `p4.review.bundle`: pending review changelists with optional details and reviewers
- `p4.change.inspect`: `describe` + `fixes` + `reviews` + optional diff + optional file history
- `p4.path.synccheck`: drift and sync-state analysis between two depot paths
- `p4.file.inspect`: per-file metadata, history, optional content, and optional blame
- `p4.workspace.snapshot`: workspace info, status, optional config, opened files, and recent changes
- `p4.search.inspect`: grouped search results with optional file metadata and content previews
- `p4.review.prepare`: explicit or discovered changelists prepared into review-ready bundles

## Install

```bash
npm install -g mcp-perforce-server
```

Requirements:

- Node.js 18+
- Perforce CLI available as `p4` or `p4.exe`
- Valid Perforce environment via `.p4config` or MCP `env`

## Quick Start

1. Install the Perforce CLI and ensure `p4` is on `PATH`.
2. Configure Perforce credentials in `.p4config` or via MCP `env`.
3. Add the server to your MCP client.
4. Start in the default safe profile before enabling any write-capable tools.

Example `.p4config`:

```ini
P4PORT=ssl:perforce.example.com:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password-or-ticket
```

Example MCP config using the globally installed server:

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server"
    }
  }
}
```

Example MCP config with explicit credentials:

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "env": {
        "P4PORT": "ssl:perforce.example.com:1666",
        "P4USER": "your-username",
        "P4CLIENT": "your-workspace-name",
        "P4PASSWD": "your-password-or-ticket",
        "P4_READONLY_MODE": "true",
        "P4_DISABLE_DELETE": "true"
      }
    }
  }
}
```

Windows local-repo example:

```json
{
  "mcpServers": {
    "perforce": {
      "command": "node",
      "args": ["C:\\Tools\\git-projects\\mcp-perforce-server\\dist\\server.js"]
    }
  }
}
```

## Safety Model

The default runtime profile is conservative.

| Setting | Default | Effect |
|---|---|---|
| `P4_READONLY_MODE` | `true` | Blocks write-capable tools. |
| `P4_DISABLE_DELETE` | `true` | Blocks `p4.delete` even when write mode is enabled. |

Write-capable tools include:

- `p4.add`, `p4.edit`, `p4.delete`, `p4.revert`, `p4.sync`
- `p4.changelist.create`, `p4.changelist.update`, `p4.changelist.submit`, `p4.submit`
- `p4.resolve`, `p4.shelve`, `p4.unshelve`
- `p4.copy`, `p4.move`, `p4.integrate`, `p4.merge`

## Tool Surface

Major categories:

- Repository and workspace inspection
- File operations and diffing
- Changelists and submissions
- Merge, shelving, and resolve flows
- Search and discovery
- Review and workflow composites
- Users, clients, streams, labels, jobs, and fixes
- Compliance, audit, and operational diagnostics

Notable native parity improvements:

- Batch-style inputs for commands such as `sync`, `opened`, `filelog`, `annotate`, `grep`, `files`, `dirs`, `print`, `fstat`, `sizes`, `have`, `users`, `streams`, `jobs`, and `fixes`
- Expanded native flag coverage for tools such as `sync`, `interchanges`, `fstat`, `files`, `dirs`, `streams`, `clients`, `labels`, `jobs`, and `sizes`
- Support for both workspace-facing and depot-to-depot diffing via `p4.diff` and `p4.diff2`

## Configuration

Most installations only need a small set of variables.

| Variable | Default | Purpose |
|---|---|---|
| `P4_READONLY_MODE` | `true` | Keep the server read-only by default. |
| `P4_DISABLE_DELETE` | `true` | Prevent delete operations unless explicitly enabled. |
| `P4CONFIG` | `.p4config` | Config file name used during upward discovery. |
| `P4_PATH` | `p4` / `p4.exe` | Custom path to the Perforce CLI. |
| `P4_PERFORMANCE_MODE` | `fast` | Preset: `fast`, `balanced`, `secure`. |
| `P4_WORKFLOW_CONCURRENCY` | `6` | Max concurrent subcalls for composite tools. |
| `P4_RESPONSE_CACHE` | `true` | Enable read-response caching. |
| `P4_RESPONSE_CACHE_TTL_MAP` | unset | Per-tool cache TTL overrides. |
| `LOG_LEVEL` | `warn` | Server log level. |

Perforce connection variables:

- `P4PORT`
- `P4USER`
- `P4CLIENT`
- `P4PASSWD`
- `P4CHARSET`
- `P4COMMANDCHARSET`
- `P4LANGUAGE`

For full configuration tables and examples, see:

- [PERFORCE_SETUP.md](PERFORCE_SETUP.md)
- [MCP_CONFIG_EXAMPLES.md](MCP_CONFIG_EXAMPLES.md)

## Development

```bash
npm install
npm run build
npm test
npm run test:integration
```

Current verification baseline:

- `npm run build`
- `npm test`
- `npm run test:integration`

## Documentation

- Tool catalog and descriptions: [AGENTS.md](AGENTS.md)
- Docs index: [docs/README.md](docs/README.md)
- Perforce setup: [PERFORCE_SETUP.md](PERFORCE_SETUP.md)
- MCP client config examples: [MCP_CONFIG_EXAMPLES.md](MCP_CONFIG_EXAMPLES.md)
- Publishing workflow: [PUBLISHING.md](PUBLISHING.md)
- Release notes draft: [RELEASE_NOTES.md](RELEASE_NOTES.md)

## License

MIT
