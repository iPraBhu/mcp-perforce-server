# MCP Perforce Server Configuration Examples

## Silent Operation Configuration

To prevent VS Code from asking for approval on every command and to hide terminal execution:

**Key Settings:**
- `"alwaysAllow": ["p4.*"]` or `"alwaysAllow": true` - Auto-approve all p4 commands
- `"LOG_LEVEL": "error"` - Minimize console output (only show errors)
- `"disabled": false` - Ensure server is enabled

## VS Code with Claude Dev/Cline

### Option 1: Using .p4config file (Recommended)
Create a `.p4config` file in your project root, then:
```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "args": [],
      "env": {
        "P4_READONLY_MODE": "false",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"],
      "disabled": false
    }
  }
}
```

### Option 2: Direct configuration in MCP config
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
        "P4CHARSET": "utf8",
        "P4_READONLY_MODE": "false",
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

### Option 1: Using .p4config file (Recommended)
```json
{
  "mcp": {
    "servers": {
      "perforce": {
        "command": "mcp-perforce-server",
        "args": [],
        "env": {
          "P4_READONLY_MODE": "false", 
          "P4_DISABLE_DELETE": "true",
          "LOG_LEVEL": "error"
        },
        "alwaysAllow": true
      }
    }
  }
}
```

### Option 2: Direct configuration in MCP config
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
          "P4_READONLY_MODE": "false",
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

### macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
### Windows: %APPDATA%\Claude\claude_desktop_config.json

### Option 1: Using .p4config file (Recommended)
```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "args": [],
      "env": {
        "P4_READONLY_MODE": "false",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"]
    }
  }
}
```

### Option 2: Direct configuration in MCP config
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
        "P4_READONLY_MODE": "false",
        "P4_DISABLE_DELETE": "true",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"]
    }
  }
}
```

## Local Development Setup (if not globally installed)

Replace the "command" field with the full path to your built server:

```json
{
  "command": "node",
  "args": ["/full/path/to/your/mcp-perforce-server/dist/server.js"]
}
```

## Safety Configuration Levels

### Maximum Safety (Default)
```json
{
  "env": {
    "P4_READONLY_MODE": "true",
    "P4_DISABLE_DELETE": "true"
  }
}
```

### Write-enabled, Delete Protected  
```json
{
  "env": {
    "P4_READONLY_MODE": "false",
    "P4_DISABLE_DELETE": "true"
  }
}
```

## Configuration Notes

### Silent Operation
- `"alwaysAllow": ["p4.*"]` - Auto-approves all p4 commands, preventing VS Code approval prompts
- `"alwaysAllow": true` - Auto-approves all commands (Cursor)
- `"LOG_LEVEL": "error"` - Reduces console output to errors only
- `"disabled": false` - Ensures the server is active

### Security Levels
- **Safe**: `P4_READONLY_MODE=true, P4_DISABLE_DELETE=true` (read-only)
- **Recommended**: `P4_READONLY_MODE=false, P4_DISABLE_DELETE=true` (write, no delete)  
- **Full Access**: `P4_READONLY_MODE=false, P4_DISABLE_DELETE=false` (use with caution)

### Troubleshooting
- If commands still show approval prompts, ensure `alwaysAllow` is configured
- If you see terminal output, set `LOG_LEVEL` to `"error"`
- Commands execute silently in the background without terminal windows

### Full Access (Use with Caution)
```json
{
  "env": {
    "P4_READONLY_MODE": "false", 
    "P4_DISABLE_DELETE": "false"
  }
}
```