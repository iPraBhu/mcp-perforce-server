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
