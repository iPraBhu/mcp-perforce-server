# MCP Perforce Server

[![npm version](https://badge.fury.io/js/mcp-perforce-server.svg)](https://www.npmjs.com/package/mcp-perforce-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)
[![MCPAmpel](https://img.shields.io/endpoint?url=https://mcpampel.com/badge/iPraBhu/mcp-perforce-server.json)](https://mcpampel.com/repo/iPraBhu/mcp-perforce-server)

MCP server for Perforce (P4) with safe defaults, fast execution, and structured JSON responses.

> Developed with vibe coding for practical Perforce automation workflows.

New to MCP servers? See [What is MCP (Model Context Protocol)?](https://adevguide.com/ai-engineering/llm-agents/what-is-mcp-model-context-protocol/).

## Workflow Speed

This server includes composite tools that combine multiple Perforce calls into one request so review and sync workflows complete faster with fewer MCP round trips.

- `p4.review.bundle`: pending review changelists with optional details and reviewers in one call
- `p4.change.inspect`: changelist inspection bundle (`describe` + `fixes` + `reviews` + optional `filelog`)
- `p4.path.synccheck`: branch/path sync drift analysis (`interchanges` + optional `integrated`)

## Install

```bash
npm install -g mcp-perforce-server
```

## Quick Start

1. Make sure `p4` is installed and available in `PATH`.
2. Configure Perforce credentials using either `.p4config` in your workspace/project root, or MCP `env` variables.
3. Add MCP server config in your IDE/client.

### Example `.p4config`

```ini
P4PORT=perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password
```

### Global Install MCP Config (Default Safe Profile)

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server"
    }
  }
}
```

### Local Repo MCP Config (Default Safe Profile)

```json
{
  "mcpServers": {
    "perforce": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-perforce-server/dist/server.js"]
    }
  }
}
```

### MCP Config (Default Safe Profile + Credentials in `env`)

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "env": {
        "P4PORT": "ssl:perforce.example.com:1666",
        "P4USER": "your-username",
        "P4CLIENT": "your-workspace-name",
        "P4PASSWD": "your-password-or-ticket"
      }
    }
  }
}
```

Defaults are already safe: `P4_READONLY_MODE=true` and `P4_DISABLE_DELETE=true` unless explicitly set to `false`.

If you want to pin these explicitly in your client config:

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "env": {
        "P4_READONLY_MODE": "true",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

Windows `args` example:

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

## Default Access Model

| Setting | Default | Effect |
|---|---|---|
| `P4_READONLY_MODE` | `true` | Blocks all write-capable tools. |
| `P4_DISABLE_DELETE` | `true` | Blocks `p4.delete` even when write mode is enabled. |

Write-capable tools blocked when `P4_READONLY_MODE=true`:

| Tool |
|---|
| `p4.add`, `p4.edit`, `p4.delete`, `p4.revert`, `p4.sync` |
| `p4.changelist.create`, `p4.changelist.update`, `p4.changelist.submit`, `p4.submit` |
| `p4.resolve`, `p4.shelve`, `p4.unshelve` |
| `p4.copy`, `p4.move`, `p4.integrate`, `p4.merge` |

## Server Configuration Reference

### Runtime, Safety, and Performance

| Variable | Default | Description |
|---|---|---|
| `P4_READONLY_MODE` | `true` | Read-only by default. Set to `false` to enable write-capable tools. |
| `P4_DISABLE_DELETE` | `true` | Delete operations are disabled by default. Set to `false` to allow `p4.delete`. |
| `P4_PATH` | `p4` / `p4.exe` | Custom path to Perforce CLI executable. |
| `P4CONFIG` | `.p4config` | `.p4config` file name used for upward discovery. |
| `LOG_LEVEL` | `warn` | Logging level: `error`, `warn`, `info`, `debug`. |
| `P4_PRETTY_JSON` | `false` | Pretty-print JSON responses when `true`. |
| `P4_PERFORMANCE_MODE` | `fast` | Preset: `fast`, `balanced`, `secure`. |
| `P4_TIMEOUT_MS` | `5000` / `10000` / `15000` | Command timeout in ms (`fast` / `balanced` / `secure`). |
| `P4_CONFIG_CACHE_TTL` | `600000` / `300000` / `300000` | `.p4config` cache TTL in ms (`fast` / `balanced` / `secure`). |
| `P4_RESPONSE_CACHE` | `true` | Enable/disable read-result response cache. |
| `P4_RESPONSE_CACHE_TTL_MS` | `5000` / `3000` / `1000` | Response cache TTL in ms (`fast` / `balanced` / `secure`). |
| `P4_RESPONSE_CACHE_TTL_MAP` | unset | Per-tool cache TTL overrides (for example `p4.info=30000,p4.review=2000`). |
| `P4_RESPONSE_CACHE_MAX_ENTRIES` | `400` / `250` / `100` | Max cached read responses (`fast` / `balanced` / `secure`). |
| `P4_NEGATIVE_CACHE` | `true` | Cache predictable read errors for a short TTL to avoid repeated retries. |
| `P4_NEGATIVE_CACHE_TTL_MS` | `5000` | Negative-cache TTL in milliseconds. |
| `P4_WORKFLOW_CONCURRENCY` | `6` | Max concurrent subcalls used by composite workflow tools. |
| `P4_LOG_PERF_METRICS` | `false` | Enable periodic performance snapshots (cache hit rate, p50/p95 latency, subcall totals). |
| `P4_LOG_PERF_METRICS_INTERVAL_MS` | `60000` | Interval for performance snapshot logs in milliseconds. |
| `P4_PERF_METRICS_SAMPLE_SIZE` | `200` | Rolling sample size per tool used to compute p50/p95 latency. |
| `P4_ENABLE_AUDIT_LOGGING` | `false` / `false` / `true` | Override audit logging (`fast` / `balanced` / `secure`). |
| `P4_ENABLE_RATE_LIMITING` | `false` / `false` / `true` | Override rate limiting (`fast` / `balanced` / `secure`). |
| `P4_ENABLE_MEMORY_LIMITS` | `false` / `true` / `true` | Override memory-limit checks (`fast` / `balanced` / `secure`). |
| `P4_ENABLE_INPUT_SANITIZATION` | `true` | Input sanitization is enabled unless set to `false`. |
| `P4_MAX_MEMORY_MB` | `512` | Memory limit for command execution and checks. |
| `P4_AUDIT_RETENTION_DAYS` | `90` | Number of days audit entries are retained. |
| `P4_RATE_LIMIT_REQUESTS` | `100` | Max requests per rate-limit window. |
| `P4_RATE_LIMIT_WINDOW_MS` | `600000` | Rate-limit window in milliseconds. |
| `P4_RATE_LIMIT_BLOCK_MS` | `3600000` | Block duration in milliseconds after exceeding limit. |

### Perforce Connection Variables

| Variable | Required | Description |
|---|---|---|
| `P4PORT` | Yes | Perforce server address (for example `ssl:perforce.example.com:1666`). |
| `P4USER` | Yes | Perforce username. |
| `P4CLIENT` | Yes | Perforce client/workspace name. |
| `P4PASSWD` | No | Password or ticket (masked in server output). |
| `P4CHARSET` | No | Character set (for example `utf8`). |
| `P4COMMANDCHARSET` | No | Command charset override. |
| `P4LANGUAGE` | No | Localized language setting. |
| `P4DIFF` | No | Custom diff tool command. |
| `P4MERGE` | No | Custom merge tool command. |
| `P4EDITOR` | No | Editor for changelist descriptions/spec forms. |

## Tool Coverage

- 55 MCP tools covering repository info, file operations, changelists, merge/resolve, review workflows, workflow composites, search, users/clients, jobs, labels/streams, analytics, and compliance.
- Composite workflow tools are included to reduce request count and speed up common review/sync flows.
- Includes both:
  - `p4.diff` for workspace/local vs depot diff.
  - `p4.diff2` for depot-to-depot server-side diff.

## Documentation

- Detailed tool reference: [docs/TOOLS_REFERENCE.md](docs/TOOLS_REFERENCE.md)
- Docs index: [docs/README.md](docs/README.md)
- IDE/client setup examples: [MCP_CONFIG_EXAMPLES.md](MCP_CONFIG_EXAMPLES.md)
- Perforce setup notes: [PERFORCE_SETUP.md](PERFORCE_SETUP.md)

## Development

```bash
npm install
npm run build
npm test
npm run test:integration
```

## License

MIT
