# MCP Perforce Server Configuration Examples

All examples in this document use the default safe profile: read-only enabled and delete disabled.

## Client Config Fields

| Field | Required | Example | Description |
|---|---|---|---|
| `command` | Yes | `"mcp-perforce-server"` | Executable to start the MCP server. |
| `args` | No | `[]` or `["/path/to/dist/server.js"]` | Command arguments (use for local build path). |
| `env` | No | `{ "P4_READONLY_MODE": "true" }` | Server environment variables. |
| `alwaysAllow` | Client-specific | `["p4.*"]` or `true` | Auto-approve tool calls to reduce prompts. |
| `disabled` | Client-specific | `false` | Enables/disables the server entry. |

## Authentication Options

| Method | Recommended | How it works |
|---|---|---|
| `.p4config` file | Yes | Place Perforce variables in a `.p4config` file in your project/workspace root. |
| MCP `env` variables | Optional | Put Perforce variables directly in the MCP server config JSON. |

`.p4config` example:

```ini
P4PORT=perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password
```

## Environment Variables Used In Examples

| Variable | Example Value | Default | Purpose |
|---|---|---|---|
| `P4_READONLY_MODE` | `"true"` | `true` | Keeps server in read-only mode. |
| `P4_DISABLE_DELETE` | `"true"` | `true` | Keeps delete operations disabled. |
| `LOG_LEVEL` | `"error"` | `warn` | Keeps console output minimal. |
| `P4PORT` | `"perforce-server:1666"` | unset | Perforce server address (required if not in `.p4config`). |
| `P4USER` | `"your-username"` | unset | Perforce user (required if not in `.p4config`). |
| `P4CLIENT` | `"your-workspace-name"` | unset | Perforce client/workspace (required if not in `.p4config`). |
| `P4PASSWD` | `"your-password"` | unset | Password/ticket (optional depending on server auth). |
| `P4CHARSET` | `"utf8"` | unset | Optional Perforce charset. |

For the complete server configuration table (all supported env vars), see [README.md](README.md#server-configuration-reference).

## VS Code with Claude Dev/Cline

### Option 1: Using `.p4config` (Recommended)

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "args": [],
      "env": {
        "P4_READONLY_MODE": "true",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"],
      "disabled": false
    }
  }
}
```

### Option 2: Direct MCP Env Configuration

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "args": [],
      "env": {
        "P4PORT": "perforce-server:1666",
        "P4USER": "your-username",
        "P4CLIENT": "your-workspace-name",
        "P4PASSWD": "your-password",
        "P4CHARSET": "utf8",
        "P4_READONLY_MODE": "true",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"],
      "disabled": false
    }
  }
}
```

## Cursor IDE

### Option 1: Using `.p4config` (Recommended)

```json
{
  "mcp": {
    "servers": {
      "perforce": {
        "command": "mcp-perforce-server",
        "args": [],
        "env": {
          "P4_READONLY_MODE": "true",
          "P4_DISABLE_DELETE": "true",
          "LOG_LEVEL": "error"
        },
        "alwaysAllow": true
      }
    }
  }
}
```

### Option 2: Direct MCP Env Configuration

```json
{
  "mcp": {
    "servers": {
      "perforce": {
        "command": "mcp-perforce-server",
        "args": [],
        "env": {
          "P4PORT": "perforce-server:1666",
          "P4USER": "your-username",
          "P4CLIENT": "your-workspace-name",
          "P4PASSWD": "your-password",
          "P4_READONLY_MODE": "true",
          "P4_DISABLE_DELETE": "true",
          "LOG_LEVEL": "error"
        },
        "alwaysAllow": true
      }
    }
  }
}
```

## Claude Desktop

Config file paths:

| Platform | Path |
|---|---|
| macOS | `~/Library/Application Support/Claude/claude_desktop_config.json` |
| Windows | `%APPDATA%\Claude\claude_desktop_config.json` |

### Option 1: Using `.p4config` (Recommended)

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "args": [],
      "env": {
        "P4_READONLY_MODE": "true",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"]
    }
  }
}
```

### Option 2: Direct MCP Env Configuration

```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "args": [],
      "env": {
        "P4PORT": "perforce-server:1666",
        "P4USER": "your-username",
        "P4CLIENT": "your-workspace-name",
        "P4_READONLY_MODE": "true",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"]
    }
  }
}
```

## Local Development Setup (If Not Globally Installed)

Replace `command` with `node` and point `args` at your built server:

```json
{
  "command": "node",
  "args": ["/full/path/to/your/mcp-perforce-server/dist/server.js"]
}
```

## SSE Transport (HTTP Server Mode)

> **📘 For comprehensive SSE deployment guide including Docker, Kubernetes, production setup, and troubleshooting, see [SSE_SETUP_GUIDE.md](SSE_SETUP_GUIDE.md)**

The SSE (Server-Sent Events) transport runs an HTTP server for web-based clients instead of stdio pipes for IDE integration.

### Starting the SSE Server

```bash
# Via command-line flag
mcp-perforce-server --transport=sse

# Via environment variable
MCP_TRANSPORT=sse mcp-perforce-server

# With custom port
MCP_SSE_PORT=8080 mcp-perforce-server --transport=sse
```

### SSE Configuration Options

| Variable | Default | Description |
|---|---|---|
| `MCP_SSE_PORT` | `3000` | HTTP server port |
| `MCP_SSE_HOST` | `0.0.0.0` | HTTP server host (0.0.0.0 for all interfaces) |
| `MCP_SSE_PATH` | `/mcp` | SSE endpoint path |
| `MCP_SSE_CORS_ORIGIN` | `*` | CORS origin (use specific domain in production) |
| `MCP_SSE_ENABLE_AUTH` | `false` | Enable Bearer token authentication |
| `MCP_SSE_AUTH_TOKEN` | _(empty)_ | Authentication token when auth is enabled |

### SSE Endpoints

When running in SSE mode:

- **Main SSE endpoint**: `GET http://localhost:3000/mcp`
- **Health check**: `GET http://localhost:3000/health`
- **Message posting**: `POST http://localhost:3000/mcp`

### SSE with Authentication (Production)

```bash
# Set authentication token
export MCP_SSE_ENABLE_AUTH=true
export MCP_SSE_AUTH_TOKEN="your-secret-token-here"
export MCP_SSE_CORS_ORIGIN="https://your-dashboard.com"
export MCP_SSE_PORT=3000

# Start server
mcp-perforce-server --transport=sse
```

Client requests must include:
```
Authorization: Bearer your-secret-token-here
```

### SSE with Docker

```dockerfile
FROM node:18-alpine
RUN npm install -g mcp-perforce-server
ENV MCP_TRANSPORT=sse
ENV MCP_SSE_PORT=3000
ENV MCP_SSE_HOST=0.0.0.0
ENV P4_READONLY_MODE=true
ENV P4_DISABLE_DELETE=true
EXPOSE 3000
CMD ["mcp-perforce-server"]
```

Run:
```bash
docker run -p 3000:3000 \
  -e P4PORT=perforce-server:1666 \
  -e P4USER=your-username \
  -e P4CLIENT=your-workspace \
  your-image-name
```

### SSE Use Cases

- **Web dashboards**: Real-time Perforce analytics and monitoring
- **Code review UIs**: Browser-based changelist inspection
- **Team collaboration**: Multi-user workspace status views
- **API integrations**: HTTP-based Perforce automation
- **Compliance reporting**: Centralized audit log viewers

### SSE vs Stdio Transport

| Feature | Stdio | SSE |
|---|---|---|
| **Use case** | IDE/CLI integration | Web clients, dashboards |
| **Connection** | Process pipes | HTTP streaming |
| **Multi-user** | One process per client | Shared HTTP server |
| **Authentication** | Process isolation | Token-based (optional) |
| **Deployment** | Local/per-user | Centralized server |

## Safety Profile Used In This Document

| Profile | `P4_READONLY_MODE` | `P4_DISABLE_DELETE` | Behavior |
|---|---|---|---|
| Default safe profile | `true` | `true` | Read-only; write tools and delete operations blocked by default. |

## Troubleshooting

| Symptom | Check |
|---|---|
| Approval prompts still appear | Ensure `alwaysAllow` is configured for your client. |
| Too much terminal output | Set `LOG_LEVEL` to `"error"`. |
| Perforce auth/config errors | Verify `P4PORT`, `P4USER`, `P4CLIENT` are set via `.p4config` or MCP `env`. |
