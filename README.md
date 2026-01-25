# MCP Perforce Server

A production-ready MCP (Model Context Protocol) server that wraps Perforce (p4 CLI) and exposes a clean tool API for common VCS operations. This server provides cross-platform support (Windows native, macOS, Linux), runs reliably inside Claude Code on Windows Native, and supports multi-project configuration via `.p4config`.

## Features

- **Non-interactive operations only**: Every p4 invocation is forced non-interactive with proper error handling
- **Structured JSON responses**: Returns consistent JSON objects with standardized schemas
- **Multi-project support**: Automatic `.p4config` detection with upward search through parent directories
- **Cross-platform compatibility**: Works on Windows Native, macOS, and Linux
- **Comprehensive error handling**: Maps common p4 failure patterns to stable error codes
- **Complete toolset**: Supports all common Perforce operations
- **Safety by default**: Read-only mode and delete protection enabled by default

## Installation

### Global Installation (Recommended for IDE use)

```bash
# Install globally for easy IDE integration
npm install -g mcp-perforce-server

# The server will be available as 'mcp-perforce-server' command
mcp-perforce-server --help
```

### Local Development Installation

```bash
# Clone and build locally
git clone <repository-url>
cd mcp-perforce-server
npm install
npm run build

# Run locally
npm start
```

## Quick Start

1. Make sure you have Perforce CLI (`p4` or `p4.exe`) installed and accessible in your PATH
2. Create a `.p4config` file in your project root:

```
P4PORT=your-perforce-server:1666
P4USER=your-username
P4CLIENT=your-client-name
```

3. Install and build the server:

```bash
npm install
npm run build
```

4. Configure your IDE (see [IDE Integration](#ide-integration) below)

## IDE Integration

> 📋 **Quick Reference**: See [MCP_CONFIG_EXAMPLES.md](MCP_CONFIG_EXAMPLES.md) for copy-paste configuration templates.

### VS Code with Claude Dev / Cline

1. **Install the MCP Perforce server:**
   ```bash
   npm install -g mcp-perforce-server
   # Or use local installation: npm install && npm run build
   ```

2. **Configure Claude Dev/Cline MCP settings:**

   Add the following to your Claude Dev/Cline MCP configuration file (usually in VS Code settings or extension configuration):

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

   For local installation, use the full path:
   ```json
   {
     "mcpServers": {
       "perforce": {
         "command": "node",
         "args": ["/path/to/your/project/dist/server.js"],
         "env": {
           "P4_READONLY_MODE": "false",
           "P4_DISABLE_DELETE": "true"
         }
       }
     }
   }
   ```

### Cursor IDE

1. **Install the server** (same as VS Code above)

2. **Configure MCP in Cursor:**

   Open Cursor settings and add MCP server configuration:

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
             "LOG_LEVEL": "warn"
           }
         }
       }
     }
   }
   ```

### Configuration Options for IDEs

**Environment Variables you can set:**

- `P4_READONLY_MODE`: Set to `"false"` to enable write operations (default: `"true"`)
- `P4_DISABLE_DELETE`: Set to `"false"` to enable delete operations (default: `"true"`)
- `LOG_LEVEL`: Set logging level: `"error"`, `"warn"`, `"info"`, `"debug"` (default: `"warn"`)
- `P4_PATH`: Custom path to p4 executable if not in PATH
- `P4CONFIG`: Custom config file name (default: `".p4config"`)

**Example configurations:**

```json
// Safe configuration (read-only mode)
{
  "env": {
    "P4_READONLY_MODE": "true",
    "P4_DISABLE_DELETE": "true"
  }
}

// Write-enabled but delete-protected
{
  "env": {
    "P4_READONLY_MODE": "false", 
    "P4_DISABLE_DELETE": "true"
  }
}

// Full access (use with caution)
{
  "env": {
    "P4_READONLY_MODE": "false",
    "P4_DISABLE_DELETE": "false"
  }
}
```

### Using the Server in IDEs

Once configured, you can use natural language commands like:

- *"Show me the status of my Perforce workspace"*
- *"Add these files to Perforce: file1.js, file2.ts"*  
- *"Create a changelist with description 'Fix authentication bug'"*
- *"Show the diff for my opened files"*
- *"Sync the latest changes from the depot"*
- *"Revert my changes to config.json"*

The AI assistant will use the MCP Perforce server to execute these operations and provide structured responses.

### Other MCP Clients

The server works with any MCP-compatible client. Here are some popular options:

**Desktop Applications:**
- [Claude Desktop](https://claude.ai/desktop) - Add to `~/Library/Application Support/Claude/claude_desktop_config.json` (macOS) or `%APPDATA%\Claude\claude_desktop_config.json` (Windows)
- [Zed Editor](https://zed.dev) - Configure in Zed settings
- [Continue.dev](https://continue.dev) - VS Code extension with MCP support

**Command Line Tools:**
- [mcp-cli](https://github.com/modelcontextprotocol/typescript-sdk) - Direct CLI interaction
- Custom MCP clients using the TypeScript or Python SDKs

**Example Claude Desktop Configuration:**

Create or edit `claude_desktop_config.json`:
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

### Testing MCP Integration

You can test the server with a simple MCP client:

```bash
# Install MCP CLI tools
npm install -g @modelcontextprotocol/cli

# Test server connection (if available)
mcp-test-client mcp-perforce-server
```

**Common Issues:**

1. **"P4_NOT_FOUND" error:**
   - Ensure `p4` or `p4.exe` is in your system PATH
   - Or set `P4_PATH` environment variable to the full path

2. **"P4_CONFIG_NOT_FOUND" error:**
   - Create a `.p4config` file in your project root or parent directories
   - Ensure it contains `P4PORT`, `P4USER`, and `P4CLIENT`

3. **"P4_READONLY_MODE" error:**
   - Set `P4_READONLY_MODE=false` in your MCP configuration if you want to enable writes

4. **MCP server not starting:**
   - Check that the server path is correct in your configuration
   - Verify Node.js is installed and accessible
   - Check IDE logs for error messages
   - Test server manually: `mcp-perforce-server --help`

5. **Permission issues on Windows:**
   - Ensure the server executable has proper permissions
   - Try running your IDE as administrator if needed
   - Check Windows Defender or antivirus blocking the executable

6. **Path issues on Windows:**
   - Use forward slashes or double backslashes in paths
   - Ensure the MCP server path is accessible from your IDE's context

## Usage in Claude Code on Windows

The server is specifically designed to work reliably in Claude Code on Windows Native:

1. Install the server globally: `npm install -g mcp-perforce-server`
2. Configure your MCP client with the server path and environment variables
3. The server will automatically detect `.p4config` files and set up proper environment

For detailed IDE integration steps, see the [IDE Integration](#ide-integration) section above.

## .p4config Detection

The server implements automatic `.p4config` detection by:

1. Starting from the provided `workspacePath` (or current directory)
2. Searching upward through parent directories until a `.p4config` file is found
3. Setting the working directory to the project root (where `.p4config` was found)
4. Parsing the config file and setting appropriate environment variables

This solves the common issue: "Is there a way to use .p4config file which is in parent folder?" - **Yes!**

## Available Tools

### Basic Operations

- **`p4.info`** - Get Perforce server and client information
- **`p4.status`** - Get status of opened files and pending changes
- **`p4.add`** - Add files to Perforce
- **`p4.edit`** - Open files for edit
- **`p4.delete`** - Mark files for delete
- **`p4.revert`** - Revert files or all files in changelist
- **`p4.sync`** - Sync files from Perforce depot
- **`p4.opened`** - List opened files
- **`p4.diff`** - Show differences for files

### Changelist Management

- **`p4.changelist.create`** - Create a new changelist (requires description)
- **`p4.changelist.update`** - Update an existing changelist
- **`p4.changelist.submit`** - Submit a numbered changelist
- **`p4.submit`** - Submit default changelist with description
- **`p4.describe`** - Describe a changelist

### Utilities

- **`p4.filelog`** - Show file history
- **`p4.clients`** - List Perforce clients/workspaces
- **`p4.config.detect`** - Detect and show Perforce configuration

## Example Responses

### Successful p4.info

```json
{
  "ok": true,
  "command": "p4",
  "args": ["-s", "info"],
  "cwd": "/path/to/workspace",
  "configUsed": {
    "p4configPath": "/path/to/workspace/.p4config",
    "P4PORT": "perforce:1666",
    "P4USER": "username",
    "P4CLIENT": "client-name"
  },
  "result": {
    "userName": "username",
    "clientName": "client-name",
    "clientRoot": "/path/to/workspace",
    "serverVersion": "P4D/LINUX26X86_64/2023.1/12345",
    "serverDate": "2023/01/01 12:00:00 -0800 PST"
  }
}
```

### p4.add with Multiple Files

```json
{
  "ok": true,
  "command": "p4",
  "args": ["-s", "add", "file1.txt", "file2.txt"],
  "cwd": "/path/to/workspace",
  "configUsed": {
    "p4configPath": "/path/to/workspace/.p4config",
    "P4PORT": "perforce:1666",
    "P4USER": "username",
    "P4CLIENT": "client-name"
  },
  "result": "//depot/file1.txt#1 - opened for add\n//depot/file2.txt#1 - opened for add"
}
```

### Changelist Create + Submit

Create changelist:
```json
{
  "ok": true,
  "command": "p4",
  "args": ["-s", "change", "-i"],
  "cwd": "/path/to/workspace",
  "configUsed": {
    "p4configPath": "/path/to/workspace/.p4config",
    "P4PORT": "perforce:1666",
    "P4USER": "username",
    "P4CLIENT": "client-name"
  },
  "result": {
    "changelist": 12345,
    "description": "Fix critical bug in authentication",
    "message": "Change 12345 created."
  }
}
```

Submit changelist:
```json
{
  "ok": true,
  "command": "p4",
  "args": ["-s", "submit", "-c", "12345"],
  "cwd": "/path/to/workspace",
  "configUsed": {
    "p4configPath": "/path/to/workspace/.p4config",
    "P4PORT": "perforce:1666",
    "P4USER": "username",
    "P4CLIENT": "client-name"
  },
  "result": {
    "changelist": 12345,
    "message": "Change 12345 submitted."
  }
}
```

### Error Cases

When p4 is missing:
```json
{
  "ok": false,
  "command": "p4",
  "args": ["-s", "info"],
  "cwd": "/path/to/workspace",
  "configUsed": {},
  "error": {
    "code": "P4_NOT_FOUND",
    "message": "Perforce executable not found or not accessible",
    "details": {
      "stderr": "spawn p4 ENOENT",
      "exitCode": -1
    },
    "stderr": "spawn p4 ENOENT",
    "exitCode": -1
  }
}
```

When .p4config not found:
```json
{
  "ok": true,
  "command": "config.detect",
  "args": [],
  "cwd": "/path/to/workspace", 
  "configUsed": {
    "P4CONFIG": ".p4config"
  },
  "result": {
    "found": false,
    "config": {},
    "environment": {
      "P4CONFIG": ".p4config"
    },
    "validation": {
      "valid": false,
      "errors": [
        "No .p4config file found in current directory or parent directories",
        "Required configuration missing: P4PORT",
        "Required configuration missing: P4USER", 
        "Required configuration missing: P4CLIENT"
      ]
    },
    "searchPath": "/path/to/workspace"
  },
  "warnings": [
    "No .p4config file found in current directory or parent directories",
    "Required configuration missing: P4PORT",
    "Required configuration missing: P4USER",
    "Required configuration missing: P4CLIENT"
  ]
}
```

When write operations are blocked by read-only mode:
```json
{
  "ok": false,
  "command": "add",
  "args": [],
  "cwd": "/path/to/workspace",
  "configUsed": {},
  "error": {
    "code": "P4_READONLY_MODE",
    "message": "Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations."
  }
}
```

When delete operations are blocked by safety setting:
```json
{
  "ok": false,
  "command": "delete",
  "args": [],
  "cwd": "/path/to/workspace",
  "configUsed": {},
  "error": {
    "code": "P4_DELETE_DISABLED",
    "message": "Delete operations are disabled for safety. Set P4_DISABLE_DELETE=false to enable delete operations."
  }
}
```

## Error Codes

The server maps common Perforce errors to stable error codes:

- `P4_NOT_FOUND` - Perforce executable not found
- `P4_AUTH_FAILED` - Authentication failed
- `P4_CLIENT_UNKNOWN` - Client/workspace unknown  
- `P4_CONNECTION_FAILED` - Failed to connect to server
- `P4_TIMEOUT` - Command timed out
- `P4_NOT_UNDER_CLIENT` - File(s) not under client root
- `P4_CONFIG_NOT_FOUND` - Configuration file not found
- `P4_INVALID_ARGS` - Invalid arguments provided
- `P4_READONLY_MODE` - Operation blocked by read-only mode
- `P4_DELETE_DISABLED` - Delete operation blocked by safety setting
- `P4_COMMAND_FAILED` - Generic command failure

## Configuration

### Environment Variables

- `P4_PATH` - Path to p4 executable (default: `p4` or `p4.exe` on Windows)
- `P4CONFIG` - Name of config file to search for (default: `.p4config`)
- `LOG_LEVEL` - Logging level: `error`, `warn`, `info`, `debug` (default: `warn`)
- `P4_READONLY_MODE` - Enable read-only mode (default: `true` for safety)
- `P4_DISABLE_DELETE` - Disable delete operations (default: `true` for safety)

**Safety Configuration:**

By default, the server runs in read-only mode with delete operations disabled for safety. To enable write operations:

```bash
# Enable all write operations
P4_READONLY_MODE=false npm start

# Enable write operations but keep delete disabled
P4_READONLY_MODE=false P4_DISABLE_DELETE=true npm start

# Enable all operations (use with caution)
P4_READONLY_MODE=false P4_DISABLE_DELETE=false npm start
```

### .p4config File Format

```
# Perforce Configuration
P4PORT=perforce-server:1666
P4USER=your-username  
P4CLIENT=your-client-name
P4CHARSET=utf8
P4EDITOR=notepad
P4DIFF=diff
```

## Windows Compatibility Notes

The server is specifically designed for Windows Native compatibility:

- Uses `child_process.spawn` with `shell: false` to avoid shell quoting issues
- Handles Windows path resolution correctly
- Supports `p4.exe` executable detection
- No optional native dependencies that could break on Windows
- Robust stdio transport that works in Claude Code

## Development

### Local Development

```bash
# Install dependencies
npm install

# Build TypeScript
npm run build

# Run in development mode with auto-rebuild
npm run watch

# Run tests
npm test

# Run examples
node examples.js

# Clean build artifacts
npm run clean
```

### Testing Without Perforce

The server includes comprehensive validation and will work without a Perforce installation for testing configuration and IDE integration. You'll get structured error responses that help identify setup issues.

### Publishing to npm

```bash
# Update version
npm version patch|minor|major

# Publish
npm publish
```

## Architecture

```
src/
├── server.ts          # MCP server bootstrap and tool routing
├── p4/
│   ├── runner.ts      # p4 command execution with timeout/error handling
│   ├── config.ts      # .p4config detection and parsing
│   └── parse.ts       # Output parsing utilities
└── tools/
    ├── basic.ts       # Basic p4 operations (add, edit, delete, sync, etc.)
    ├── changelist.ts  # Changelist management (create, update, submit)
    ├── utils.ts       # Utility tools (filelog, clients, config.detect)
    └── index.ts       # Tool exports
```

## License

MIT License