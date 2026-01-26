# MCP Perforce Server

[![npm version](https://badge.fury.io/js/mcp-perforce-server.svg)](https://www.npmjs.com/package/mcp-perforce-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Enterprise-grade MCP (Model Context Protocol) server providing secure, non-interactive Perforce operations for AI-assisted development workflows with Claude, ChatGPT, VS Code, and Cursor IDE.

> **Created by [Pratik Bhuite](https://github.com/iPraBhu)** using vibe coding to solve real-world Perforce automation challenges. Open source, community-driven, and ready for customization!

## Overview

Production-ready server that exposes Perforce VCS operations through the Model Context Protocol, enabling AI assistants and code editors to interact with Perforce repositories safely and efficiently. Perfect for DevOps automation, enterprise development workflows, and AI-powered version control management.

**Key Features:**
- 🔒 **Enterprise Security** - Read-only defaults with configurable access controls
- 🌐 **Cross-platform Support** - Windows, macOS, Linux compatibility
- 🤖 **AI Integration** - Works with Claude, ChatGPT, VS Code, Cursor, and other AI assistants
- ⚡ **Non-interactive Operations** - Automated Perforce commands with comprehensive error handling
- 📁 **Multi-project Support** - Automatic `.p4config` detection with upward directory search
- 🛡️ **Production Ready** - Structured JSON responses with standardized error codes
- 🔧 **Developer Friendly** - TypeScript support with comprehensive documentation
- 🚀 **Zero Configuration** - Works out-of-the-box with sensible defaults

## Why Choose MCP Perforce Server?

**Alternative to:**
- Manual Perforce CLI operations in AI workflows
- Custom Git-to-Perforce bridges for AI assistants
- Unsafe direct P4 command execution in development environments
- Complex Perforce API integrations for code assistants

**Perfect for:**
- Enterprise teams using Perforce with AI development tools
- DevOps automation with Anthropic Claude or OpenAI ChatGPT
- VS Code and Cursor IDE users working with Perforce repositories  
- Secure version control operations in AI-assisted coding workflows

## Origin Story

This project was born from a real need! I ([Pratik Bhuite](https://github.com/iPraBhu)) was facing challenges integrating Perforce with AI development tools and decided to solve it using **vibe coding** - building something that just works, feels right, and solves real problems.

**🤝 Community Welcome**
- ✅ **Use freely** - This is open source, use it however you need
- 🐛 **Report issues** - Found a bug? Please let me know!
- 🔧 **Customize** - Fork it, modify it, make it yours
- 💡 **Contribute** - Ideas, PRs, and feedback are always welcome

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
For silent operation without approval prompts, add these settings:
```json
{
  "mcpServers": {
    "perforce": {
      "command": "mcp-perforce-server",
      "env": {
        "P4_READONLY_MODE": "false",
        "LOG_LEVEL": "error"
      },
      "alwaysAllow": ["p4.*"],
      "disabled": false
    }
  }
}
```

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
git clone https://github.com/iPraBhu/mcp-perforce-server.git
cd mcp-perforce-server
npm install
npm run build

# Run tests
npm test

# Development mode
npm run watch
```

## Contributing

This project was created with ❤️ by [Pratik Bhuite](https://github.com/iPraBhu) to solve real Perforce automation challenges. 

**Ways to contribute:**
- 🐛 **Report bugs** - Open an issue if something's not working
- 💡 **Suggest features** - Have an idea? Let's discuss it!
- 🔧 **Submit PRs** - Code contributions are welcome
- 📖 **Improve docs** - Help make the documentation better
- ⭐ **Star the repo** - Show your support!

**Found this useful?** Consider giving it a star ⭐ and sharing with others who might benefit!

## Security

This project follows security best practices:
- 🔒 **Dependencies**: Regularly updated to latest secure versions
- 🛡️ **Default Safety**: Read-only mode and delete protection by default  
- 🔍 **Audit**: Run `npm run audit-fix` to check for vulnerabilities
- 📢 **Report Issues**: Security issues? Please report privately via GitHub

## License

MIT License - Feel free to use, modify, and distribute as needed. See [LICENSE](LICENSE) for details.

**TL;DR:** Use it however you want, just keep the license notice. Built for the community! 🚀