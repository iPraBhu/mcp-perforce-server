# MCP Perforce Server

Enterprise-grade MCP (Model Context Protocol) server providing secure, non-interactive Perforce operations for AI-assisted development workflows.

## Overview

Production-ready server that exposes Perforce VCS operations through the Model Context Protocol, enabling AI assistants to interact with Perforce repositories safely and efficiently.

**Key Features:**
- Cross-platform support (Windows, macOS, Linux)  
- Non-interactive operation with comprehensive error handling
- Multi-project support via automatic `.p4config` detection
- Security-first design with read-only defaults
- Structured JSON responses with standardized schemas

## Installation

```bash
npm install -g mcp-perforce-server
```

## Quick Start

1. **Prerequisites:** Perforce CLI (`p4`) installed and in PATH

2. **Configuration:** Choose one method:

   **Method A: .p4config file** (Recommended)
   ```
   P4PORT=your-perforce-server:1666
   P4USER=your-username
   P4CLIENT=your-workspace-name
   ```

   **Method B: MCP Environment Variables**
   ```json
   {
     "mcpServers": {
       "perforce": {
         "command": "mcp-perforce-server",
         "env": {
           "P4PORT": "your-perforce-server:1666",
           "P4USER": "your-username", 
           "P4CLIENT": "your-workspace-name"
         }
       }
     }
   }
   ```

3. **Verification:**
   ```bash
   mcp-perforce-server --help
   ```

## Security Configuration

**Default Security Posture:**
- `P4_READONLY_MODE=true` - Read-only operations only
- `P4_DISABLE_DELETE=true` - Delete operations disabled

**Production Environments:**
```bash
# Read-only mode (safest)
P4_READONLY_MODE=true P4_DISABLE_DELETE=true

# Write-enabled, delete-protected (recommended)  
P4_READONLY_MODE=false P4_DISABLE_DELETE=true

# Full access (use with caution)
P4_READONLY_MODE=false P4_DISABLE_DELETE=false
```

## Supported Operations

### Repository Operations
- `p4.info` - Server and client information
- `p4.status` - Workspace status
- `p4.sync` - Sync from depot
- `p4.opened` - List opened files

### File Operations  
- `p4.add` - Add files to Perforce
- `p4.edit` - Open files for edit
- `p4.delete` - Mark files for deletion
- `p4.revert` - Revert changes
- `p4.diff` - Show file differences

### Changelist Operations
- `p4.changelist.create` - Create new changelist
- `p4.changelist.update` - Update changelist
- `p4.changelist.submit` - Submit changelist
- `p4.submit` - Submit default changelist

### Utilities
- `p4.filelog` - File history
- `p4.clients` - List workspaces
- `p4.config.detect` - Configuration diagnostics

## Integration

### VS Code / Cursor
See [MCP_CONFIG_EXAMPLES.md](MCP_CONFIG_EXAMPLES.md) for IDE-specific configuration.

### Claude Desktop
Add to `claude_desktop_config.json`:
```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "env": {
        "P4_READONLY_MODE": "false"
      }
    }
  }
}
```

## Environment Variables

| Variable | Description | Default |
|----------|-------------|---------|
| `P4_READONLY_MODE` | Enable read-only mode | `true` |
| `P4_DISABLE_DELETE` | Disable delete operations | `true` |
| `P4_PATH` | Path to p4 executable | `p4` |
| `P4CONFIG` | Config file name | `.p4config` |
| `LOG_LEVEL` | Logging level | `warn` |

## Error Handling

Standardized error codes for reliable error handling:
- `P4_NOT_FOUND` - Perforce executable not found
- `P4_AUTH_FAILED` - Authentication failure
- `P4_CLIENT_UNKNOWN` - Unknown workspace
- `P4_CONNECTION_FAILED` - Server connection failed
- `P4_READONLY_MODE` - Operation blocked by read-only mode
- `P4_DELETE_DISABLED` - Delete operation blocked

## Development

```bash
# Local development
git clone <repository-url>
cd mcp-perforce-server
npm install
npm run build

# Run tests
npm test

# Development mode
npm run watch
```

## License

MIT License