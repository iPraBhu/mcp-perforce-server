# MCP Configuration Examples for Popular IDEs

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
        "LOG_LEVEL": "warn"
      }
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
        "LOG_LEVEL": "warn"
      }
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
          "P4_DISABLE_DELETE": "true"
        }
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
          "P4_DISABLE_DELETE": "true"
        }
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
        "P4_DISABLE_DELETE": "true"
      }
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
        "P4_DISABLE_DELETE": "true"
      }
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

### Full Access (Use with Caution)
```json
{
  "env": {
    "P4_READONLY_MODE": "false", 
    "P4_DISABLE_DELETE": "false"
  }
}
```