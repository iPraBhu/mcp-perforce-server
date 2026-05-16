/**
 * Example SSE Client for MCP Perforce Server
 * 
 * This demonstrates how to connect to the MCP Perforce Server
 * running in SSE (Server-Sent Events) transport mode.
 * 
 * Prerequisites:
 * 1. Start the server: `mcp-perforce-server --transport=sse`
 * 2. Install dependencies: `npm install @modelcontextprotocol/sdk`
 * 3. Run this example: `node examples/sse-client-example.js`
 */

import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function main() {
  const serverUrl = process.env.MCP_SERVER_URL || 'http://localhost:3000/mcp';
  const authToken = process.env.MCP_AUTH_TOKEN; // Optional, only if auth is enabled

  console.log(`Connecting to MCP Perforce Server at ${serverUrl}...`);

  // Create SSE transport
  const headers = authToken ? { Authorization: `Bearer ${authToken}` } : {};
  const transport = new SSEClientTransport(new URL(serverUrl), { headers });

  // Create MCP client
  const client = new Client(
    {
      name: 'sse-example-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );

  try {
    // Connect to server
    await client.connect(transport);
    console.log('✓ Connected to MCP Perforce Server');

    // List available tools
    const toolsResult = await client.listTools();
    console.log(`\n✓ Found ${toolsResult.tools.length} tools available`);
    console.log('\nFirst 5 tools:');
    toolsResult.tools.slice(0, 5).forEach((tool) => {
      console.log(`  - ${tool.name}: ${tool.description}`);
    });

    // Example: Call p4.info tool
    console.log('\n--- Testing p4.info tool ---');
    const infoResult = await client.callTool({
      name: 'p4.info',
      arguments: {},
    });

    console.log('p4.info result:', JSON.stringify(infoResult, null, 2));

    // Example: Call p4.status tool
    console.log('\n--- Testing p4.status tool ---');
    const statusResult = await client.callTool({
      name: 'p4.status',
      arguments: {},
    });

    console.log('p4.status result:', JSON.stringify(statusResult, null, 2));

    console.log('\n✓ All tests passed!');

  } catch (error) {
    console.error('✗ Error:', error.message);
    process.exit(1);
  } finally {
    // Close connection
    await client.close();
    console.log('\n✓ Connection closed');
  }
}

// Run the example
main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
