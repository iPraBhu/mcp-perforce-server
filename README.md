# MCP Perforce Server

[![npm version](https://badge.fury.io/js/mcp-perforce-server.svg)](https://www.npmjs.com/package/mcp-perforce-server)
[![License: MIT](https://img.shields.io/badge/License-MIT-yellow.svg)](https://opensource.org/licenses/MIT)
[![Node.js Version](https://img.shields.io/badge/node-%3E%3D18.0.0-brightgreen)](https://nodejs.org/)
[![TypeScript](https://img.shields.io/badge/TypeScript-Ready-blue)](https://www.typescriptlang.org/)

Enterprise-grade MCP (Model Context Protocol) server providing secure, non-interactive Perforce operations for AI-assisted development workflows with Claude, ChatGPT, VS Code, and Cursor IDE.

> **Created by [Pratik Bhuite](https://github.com/iPraBhu)** using vibe coding to solve real-world Perforce automation challenges. Open source, community-driven, and ready for customization!

## Overview

Production-ready server that exposes **37+ Perforce VCS operations** through the Model Context Protocol, enabling AI assistants and code editors to interact with Perforce repositories safely and efficiently. Perfect for DevOps automation, enterprise development workflows, and AI-powered version control management.

**Key Features:**
- 🔒 **Enterprise Security** - Read-only defaults with configurable access controls
- 🔐 **Compliance Ready** - SOC 2, GDPR, HIPAA compliant with audit logging
- 🚦 **Rate Limiting** - Configurable request throttling with automatic blocking
- 🧹 **Input Sanitization** - Regex validation and path traversal protection
- 💾 **Memory Management** - Process monitoring with automatic GC and limits
- 📊 **Audit Logging** - Complete operation tracking with retention policies
- 🌐 **Cross-platform Support** - Windows, macOS, Linux compatibility
- 🤖 **AI Integration** - Works with Claude, ChatGPT, VS Code, Cursor, and other AI assistants
- ⚡ **Non-interactive Operations** - Automated Perforce commands with comprehensive error handling
- 📁 **Multi-project Support** - Automatic `.p4config` detection with upward directory search
- 🛡️ **Production Ready** - Structured JSON responses with standardized error codes
- 🔧 **Developer Friendly** - TypeScript support with comprehensive documentation
- 🚀 **Zero Configuration** - Works out-of-the-box with sensible defaults

## Core Capabilities

### 🔒 Security & Compliance
- **Defense-in-depth architecture** with multiple security layers
- **Zero-trust defaults** - all advanced features disabled by default
- **Comprehensive audit logging** with configurable retention (90+ days)
- **Rate limiting** with configurable thresholds and block periods
- **Input sanitization** preventing injection attacks and path traversal
- **Memory management** with automatic garbage collection and limits
- **SOC 2, GDPR, HIPAA ready** with structured compliance reporting

### 🤖 AI Assistant Integration
- **37+ Perforce operations** exposed through MCP protocol
- **Structured JSON responses** for reliable AI parsing
- **Non-interactive execution** - no user prompts or confirmations
- **Error handling** with standardized error codes
- **Context-aware operations** with automatic configuration detection
- **Real-time monitoring** and compliance status reporting

### 🏢 Enterprise Features
- **Multi-tenant support** with per-operation rate limiting
- **Centralized configuration** via environment variables
- **Production monitoring** with memory and performance tracking
- **Compliance reporting** with CSV/JSON export capabilities
- **Automated resource management** preventing system overload
- **Enterprise authentication** support through Perforce credentials

### 🔧 Developer Experience
- **TypeScript first** with full type safety
- **Comprehensive documentation** with examples and guides
- **Cross-platform compatibility** - Windows, macOS, Linux
- **Zero configuration setup** with sensible defaults
- **Extensive testing** with automated component validation
- **Open source** with community contributions welcome

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
- Organizations requiring SOC 2, GDPR, or HIPAA compliance
- Teams needing comprehensive audit trails and security monitoring
- Enterprises with strict security policies and compliance requirements

## Why Choose MCP Perforce Server?

### 🛡️ **Enterprise-Grade Security**
- **Defense-in-depth architecture** with multiple security layers
- **Rate limiting** prevents abuse and ensures fair resource usage
- **Comprehensive audit logging** with configurable retention policies
- **Input sanitization** protects against injection attacks and malicious input
- **Memory management** with automatic monitoring and garbage collection
- **Read-only mode** for secure environments and compliance requirements

### 📊 **Compliance Ready**
- **SOC 2 Type II** compliance framework with automated reporting
- **GDPR** compliance with data protection and privacy controls
- **HIPAA** compliance for healthcare and sensitive data environments
- **Compliance reporting tools** for audit preparation and regulatory requirements
- **Data retention policies** configurable for different compliance needs

### 🤖 **AI-First Design**
- **37+ Perforce operations** through standardized MCP protocol
- **Non-interactive execution** perfect for AI assistants and automation
- **Structured error handling** with detailed error codes and recovery suggestions
- **Context-aware operations** that understand Perforce workflows
- **Seamless integration** with Claude, ChatGPT, VS Code, and Cursor

### ⚡ **Production Ready**
- **Zero-configuration setup** with automatic Perforce environment detection
- **Cross-platform support** (Windows, macOS, Linux) for enterprise deployments
- **Comprehensive error handling** with actionable error messages
- **Performance optimized** with connection pooling and caching
- **Enterprise authentication** support through Perforce credentials

### 🔧 **Developer Experience**
- **TypeScript implementation** with full type safety and IntelliSense
- **Comprehensive documentation** with examples and troubleshooting
- **Modular architecture** for easy customization and extension
- **Open source** with community contributions and transparent development
- **Active maintenance** with regular updates and security patches

## Origin Story

This project was born from a real need! I was facing challenges integrating Perforce with AI development tools and decided to solve it using **vibe coding** - building something that just works, feels right, and solves real problems.

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
   P4PASSWD=your-password
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
           "P4CLIENT": "your-workspace-name",
           "P4PASSWD": "your-password"
         }
       }
     }
   }
   ```

3. **Verification:**
   ```bash
   mcp-perforce-server --help
   ```

## Authentication Configuration

The server supports multiple methods for providing Perforce credentials, prioritized in this order:

### 1. **Environment Variables** (Highest Priority)
Set `P4PASSWD` along with other Perforce environment variables:

```bash
export P4PORT=perforce-server:1666
export P4USER=your-username
export P4CLIENT=your-workspace-name
export P4PASSWD=your-password
```

### 2. **`.p4config` File** (Recommended)
Create a `.p4config` file in your project root:

```ini
P4PORT=perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password
```

The server automatically searches upward from the current directory to find this file.

### 3. **MCP Configuration**
Include credentials in your MCP server configuration (see examples above).

**Security Notes:**
- Passwords are **masked** (`***masked***`) in all logs
- The system operates **non-interactively** - no password prompts
- Authentication failures return `P4_AUTH_FAILED` error code
- For production, prefer `.p4config` files or secure environment variables

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

## Compliance & Security Features

**Enterprise-Grade Security Suite:**
- 🔐 **Audit Logging** - Complete operation tracking with retention policies
- 🚦 **Rate Limiting** - Configurable request throttling with block periods
- 🧹 **Input Sanitization** - Regex validation and path traversal protection
- 💾 **Memory Limits** - Process memory monitoring and automatic GC
- 📊 **Compliance Reporting** - SOC 2, GDPR, HIPAA-ready architecture

**New Compliance Tools:**
- `p4.audit` - Query audit logs with filtering and CSV export
- `p4.compliance` - View compliance configuration and system status

**Compliance Configuration:**
```bash
# Enable enterprise features
P4_ENABLE_AUDIT_LOGGING=true
P4_ENABLE_RATE_LIMITING=true
P4_ENABLE_MEMORY_LIMITS=true
P4_ENABLE_INPUT_SANITIZATION=true

# Compliance tuning
P4_MAX_MEMORY_MB=1024
P4_AUDIT_RETENTION_DAYS=365
P4_RATE_LIMIT_REQUESTS=100
P4_RATE_LIMIT_WINDOW_MS=600000
P4_RATE_LIMIT_BLOCK_MS=3600000
```

**Security Architecture:**
- ✅ **Defense-in-depth** - Multiple security layers
- ✅ **Zero-trust defaults** - Everything disabled by default
- ✅ **Structured logging** - JSON audit trails
- ✅ **Input validation** - Regex and path sanitization
- ✅ **Resource limits** - Memory and rate controls
- ✅ **GDPR/HIPAA Ready** - No personal data storage

## Supported Operations

### Repository Operations
- `p4.info` - Server and client information
- `p4.status` - Workspace status
- `p4.sync` - Sync from depot
- `p4.opened` - List opened files
- `p4.have` - List synced files
- `p4.where` - Show file mappings

### File Operations  
- `p4.add` - Add files to Perforce
- `p4.edit` - Open files for edit
- `p4.delete` - Mark files for deletion
- `p4.revert` - Revert changes
- `p4.diff` - Show file differences
- `p4.copy` - Copy files between locations
- `p4.move` - Move/rename files
- `p4.blame` - Show file annotations (like git blame)

### Merge & Conflict Resolution
- `p4.resolve` - Resolve merge conflicts
- `p4.shelve` - Shelve files for code review
- `p4.unshelve` - Unshelve files from review

### Changelist Operations
- `p4.changelist.create` - Create new changelist
- `p4.changelist.update` - Update changelist
- `p4.changelist.submit` - Submit changelist
- `p4.submit` - Submit default changelist
- `p4.describe` - Describe changelist details
- `p4.changes` - List changelists with filtering

### Search & Discovery
- `p4.grep` - Search text patterns across files
- `p4.files` - List files in depot with metadata
- `p4.dirs` - List directories in depot
- `p4.filelog` - File history

### User & Client Management
- `p4.users` - List Perforce users
- `p4.user` - Get user information
- `p4.clients` - List workspaces
- `p4.client` - Get workspace details

### Job & Issue Tracking
- `p4.jobs` - List jobs (if enabled)
- `p4.job` - Get job details
- `p4.fixes` - Show changelist-job relationships

### Labels & Organization
- `p4.labels` - List labels
- `p4.label` - Get label details

### Analytics & Monitoring
- `p4.sizes` - File size and disk usage statistics
- `p4.audit` - Audit log queries and compliance reporting
- `p4.compliance` - Compliance configuration and status

### Utilities
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
| `P4_ENABLE_AUDIT_LOGGING` | Enable audit logging | `false` |
| `P4_ENABLE_RATE_LIMITING` | Enable rate limiting | `true` |
| `P4_ENABLE_MEMORY_LIMITS` | Enable memory limits | `true` |
| `P4_ENABLE_INPUT_SANITIZATION` | Enable input sanitization | `true` |
| `P4_MAX_MEMORY_MB` | Memory limit in MB | `512` |
| `P4_AUDIT_RETENTION_DAYS` | Audit log retention days | `90` |
| `P4_RATE_LIMIT_REQUESTS` | Max requests per window | `100` |
| `P4_RATE_LIMIT_WINDOW_MS` | Rate limit window ms | `600000` |
| `P4_RATE_LIMIT_BLOCK_MS` | Rate limit block duration ms | `3600000` |

## Error Handling

Standardized error codes for reliable error handling:
- `P4_NOT_FOUND` - Perforce executable not found
- `P4_AUTH_FAILED` - Authentication failure
- `P4_CLIENT_UNKNOWN` - Unknown workspace
- `P4_CONNECTION_FAILED` - Server connection failed
- `P4_READONLY_MODE` - Operation blocked by read-only mode
- `P4_DELETE_DISABLED` - Delete operation blocked
- `P4_INVALID_ARGS` - Invalid arguments or input sanitization failure
- `P4_MEMORY_LIMIT` - Memory limit exceeded
- `P4_AUDIT_DISABLED` - Audit logging not enabled
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded
- `RATE_LIMIT_EXCEEDED` - Rate limit exceeded

## Architecture

### 🏗️ **System Overview**
```
┌─────────────────┐    ┌──────────────────┐    ┌─────────────────┐
│   AI Assistant  │────│  MCP Protocol    │────│ MCP Perforce    │
│   (Claude/GPT)  │    │  (JSON-RPC 2.0)  │    │     Server      │
└─────────────────┘    └──────────────────┘    └─────────────────┘
         │                       │                       │
         └───────────────────────┼───────────────────────┘
                                 │
                    ┌────────────────────┐
                    │   Perforce CLI     │
                    │     (p4)           │
                    └────────────────────┘
```

### 🔧 **Core Components**

#### **Security Module (`src/p4/security.ts`)**
- **Rate Limiting**: Token bucket algorithm with configurable limits
- **Audit Logging**: Structured logging with retention policies
- **Input Sanitization**: Regex-based validation and escaping
- **Memory Management**: Automatic monitoring and garbage collection
- **Compliance Reporting**: SOC 2, GDPR, HIPAA compliance tools

#### **Server Core (`src/server.ts`)**
- **MCP Protocol Handler**: JSON-RPC 2.0 implementation
- **Tool Registry**: 37+ Perforce operations with security validation
- **Request Processing**: Async handling with error recovery
- **Configuration Management**: Environment variable processing

#### **Tool Modules (`src/tools/`)**
- **Basic Operations**: Core Perforce commands (add, edit, submit)
- **Advanced Operations**: Complex workflows (merge, integrate, resolve)
- **Changelist Management**: CL creation, modification, and tracking
- **Search & Discovery**: File finding, history, and metadata queries
- **User Management**: Client specs, user info, and permissions
- **Analytics**: Repository statistics and monitoring

#### **Perforce Integration (`src/p4/`)**
- **Command Execution**: Secure child_process spawning
- **Output Parsing**: Structured data extraction from p4 output
- **Environment Detection**: Automatic .p4config and credential discovery
- **Error Handling**: Comprehensive error classification and reporting

### 🛡️ **Security Architecture**

#### **Defense in Depth**
1. **Input Validation**: All inputs sanitized before processing
2. **Rate Limiting**: Prevents abuse and resource exhaustion
3. **Audit Logging**: Complete operation traceability
4. **Memory Protection**: Automatic monitoring and limits
5. **Read-Only Mode**: Safe defaults for sensitive environments

#### **Compliance Framework**
- **SOC 2 Type II**: Automated controls and reporting
- **GDPR**: Data protection and privacy controls
- **HIPAA**: Healthcare data handling compliance
- **Custom Policies**: Configurable retention and access controls

### 📊 **Data Flow**
```
User Request → MCP Protocol → Security Validation → Tool Execution → Perforce CLI → Response
     ↓              ↓              ↓                    ↓              ↓            ↓
  Sanitize      Authenticate    Rate Check         Command        Execute      Format
```

### 🔄 **Integration Patterns**
- **VS Code Extension**: Direct MCP integration via configuration
- **Claude Desktop**: App-specific MCP server configuration
- **Custom Clients**: Standard JSON-RPC 2.0 protocol support
- **Enterprise Deployments**: Docker/containerized execution

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

## Support This Project

☕ **Enjoying this tool?** [Buy me a coffee on Ko-fi](https://ko-fi.com/adevguide) to support continued development and new features!

[![Ko-fi](https://ko-fi.com/img/githubbutton_sm.svg)](https://ko-fi.com/adevguide)

## Security

This project follows security best practices:
- 🔒 **Dependencies**: Regularly updated to latest secure versions
- 🛡️ **Default Safety**: Read-only mode and delete protection by default  
- 🔍 **Audit**: Run `npm run audit-fix` to check for vulnerabilities
- 📢 **Report Issues**: Security issues? Please report privately via GitHub

## License

MIT License - Feel free to use, modify, and distribute as needed. See [LICENSE](LICENSE) for details.

**TL;DR:** Use it however you want, just keep the license notice. Built for the community! 🚀