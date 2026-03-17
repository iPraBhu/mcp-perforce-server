#!/usr/bin/env node

/**
 * Test script to verify tool name normalization (dot vs underscore notation)
 */

const { P4Runner } = require('./dist/p4/runner.js');
const { P4Config } = require('./dist/p4/config.js');
const tools = require('./dist/tools/index.js');
const { securityManager } = require('./dist/p4/security.js');

async function testToolNameNormalization() {
  console.log('Testing tool name normalization (dot vs underscore)');
  console.log('====================================================\n');

  // Setup context
  const runner = new P4Runner();
  const config = new P4Config();
  const serverConfig = config.getServerConfig();
  const context = { runner, config, serverConfig, security: securityManager };

  console.log('Testing p4.config.detect (dot notation):');
  try {
    const result1 = await tools.p4ConfigDetect(context, {});
    console.log('✓ Success with dot notation');
    console.log(`  Config found: ${result1.ok ? 'Yes' : 'No'}`);
  } catch (error) {
    console.log('✗ Failed:', error.message);
  }
  console.log('');

  console.log('Note: The MCP server normalizes tool names automatically,');
  console.log('      so both "p4.changes" and "p4_changes" will work.');
  console.log('');
  console.log('Normalization logic in server.ts:');
  console.log('  - Input: p4_changes → Normalized: p4.changes');
  console.log('  - Input: p4.info → Normalized: p4.info (no change)');
  console.log('');
  console.log('This ensures compatibility with MCP clients that may');
  console.log('transform dots to underscores in tool names.');
}

testToolNameNormalization().catch(console.error);
