# MCP Perforce Server

[![npm version](https://badge.fury.io/js/mcp-perforce-server.svg)](https://www.npmjs.com/package/mcp-perforce-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

MCP server for Perforce (P4) with safe defaults, fast execution, and structured JSON responses.

> Developed with vibe coding for practical Perforce automation workflows.

## Install

```bash
npm install -g mcp-perforce-server
```

## Quick Start

1. Make sure `p4` is installed and available in `PATH`.
2. Configure Perforce credentials using either:
   - `.p4config` in your workspace/project root, or
   - MCP `env` variables.
3. Add MCP server config in your IDE/client.

### Example `.p4config`

```ini
P4PORT=perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password
```

### Global Install MCP Config

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "env": {
        "P4_READONLY_MODE": "false",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      }
    }
  }
}
```

### Local Repo MCP Config

```json
{
  "mcpServers": {
    "perforce": {
      "command": "node",
      "args": ["/absolute/path/to/mcp-perforce-server/dist/server.js"],
      "env": {
        "P4_READONLY_MODE": "false",
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

## Safe Defaults

- `P4_READONLY_MODE=true`
- `P4_DISABLE_DELETE=true`
- `P4_PERFORMANCE_MODE=fast`

## Key Environment Variables

| Variable | Purpose | Default |
|---|---|---|
| `P4_READONLY_MODE` | Block write operations | `true` |
| `P4_DISABLE_DELETE` | Block delete operations | `true` |
| `P4_PERFORMANCE_MODE` | `fast`, `balanced`, `secure` | `fast` |
| `P4_TIMEOUT_MS` | Command timeout (ms) | mode-based |
| `P4_RESPONSE_CACHE` | Read-result cache | `true` |
| `P4_PRETTY_JSON` | Pretty JSON responses | `false` |
| `P4CONFIG` | Config file name | `.p4config` |
| `LOG_LEVEL` | `error`, `warn`, `info`, `debug` | `warn` |

## Tool Coverage

- 47 MCP tools covering repository info, file operations, changelists, merge/resolve, search, users/clients, jobs, labels/streams, analytics, and compliance.
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



