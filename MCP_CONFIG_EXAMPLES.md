# MCP Configuration Examples for Popular IDEs

## VS Code with Claude Dev/Cline

### Add to your MCP configuration:
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

## Cursor IDE

### Add to Cursor settings:
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

## Claude Desktop

### macOS: ~/Library/Application Support/Claude/claude_desktop_config.json
### Windows: %APPDATA%\Claude\claude_desktop_config.json

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