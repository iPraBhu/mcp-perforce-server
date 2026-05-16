# MCP Perforce Server Examples

This directory contains example code demonstrating how to use the MCP Perforce Server.

## SSE Client Example

**File:** `sse-client-example.js`

Demonstrates how to connect to the MCP Perforce Server running in SSE (Server-Sent Events) transport mode.

### Prerequisites

1. Node.js 18+ installed
2. MCP Perforce Server running in SSE mode
3. Valid Perforce environment configured

### Setup

1. **Start the SSE server:**
   ```bash
   mcp-perforce-server --transport=sse
   ```

2. **Install client dependencies:**
   ```bash
   npm install @modelcontextprotocol/sdk
   ```

3. **Run the example:**
   ```bash
   node examples/sse-client-example.js
   ```

### Configuration

Configure the example using environment variables:

```bash
# Server URL (default: http://localhost:3000/mcp)
export MCP_SERVER_URL=http://localhost:8080/mcp

# Authentication token (if auth is enabled on server)
export MCP_AUTH_TOKEN=your-secret-token

# Run example
node examples/sse-client-example.js
```

### What the Example Does

1. Connects to the MCP Perforce Server via SSE transport
2. Lists all available tools
3. Calls `p4.info` to get Perforce server information
4. Calls `p4.status` to check workspace status
5. Displays results in JSON format
6. Closes the connection

### Expected Output

```
Connecting to MCP Perforce Server at http://localhost:3000/mcp...
✓ Connected to MCP Perforce Server

✓ Found 59 tools available

First 5 tools:
  - p4.info: Get Perforce server information
  - p4.status: Check workspace status
  - p4.add: Open files for add
  - p4.edit: Open files for edit
  - p4.delete: Open files for delete

--- Testing p4.info tool ---
p4.info result: {
  "ok": true,
  "result": {
    "userName": "your-username",
    "clientName": "your-workspace",
    "serverAddress": "perforce-server:1666",
    ...
  }
}

--- Testing p4.status tool ---
p4.status result: {
  "ok": true,
  "result": {
    "opened": [],
    "pending": []
  }
}

✓ All tests passed!
✓ Connection closed
```

## Use Cases for SSE Transport

- **Web Dashboards**: Build browser-based Perforce analytics dashboards
- **Team Collaboration**: Multi-user workspace monitoring
- **API Integrations**: HTTP-based Perforce automation
- **Code Review UIs**: Browser-based changelist inspection
- **Compliance Reporting**: Centralized audit log viewers

## Security Notes

For production deployments:

1. **Enable Authentication:**
   ```bash
   export MCP_SSE_ENABLE_AUTH=true
   export MCP_SSE_AUTH_TOKEN=your-secret-token
   mcp-perforce-server --transport=sse
   ```

2. **Use HTTPS:** Run behind a reverse proxy (nginx, Apache) with TLS
3. **Restrict CORS:** Set `MCP_SSE_CORS_ORIGIN` to specific domains
4. **Network Security:** Use firewall rules to restrict access
5. **Rate Limiting:** Keep `P4_ENABLE_RATE_LIMITING=true` for production

## More Information

- [Main README](../README.md)
- [MCP Configuration Examples](../MCP_CONFIG_EXAMPLES.md)
- [Tools Reference](../docs/TOOLS_REFERENCE.md)
