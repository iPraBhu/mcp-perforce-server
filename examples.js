#!/usr/bin/env node

/**
 * Example script showing how to use the MCP Perforce server
 * in different scenarios
 */

const { P4Runner } = require('./dist/p4/runner.js');
const { P4Config } = require('./dist/p4/config.js');
const tools = require('./dist/tools/index.js');

async function runExamples() {
  console.log('MCP Perforce Server - Usage Examples');
  console.log('====================================\n');
  
  // Setup
  const runner = new P4Runner();
  const config = new P4Config();
  const serverConfig = config.getServerConfig();
  const context = { runner, config, serverConfig };
  
  console.log(`Server Configuration: readOnlyMode=${serverConfig.readOnlyMode}, disableDelete=${serverConfig.disableDelete}`);
  console.log('');
  
  // Example 1: Config Detection
  console.log('1. Detecting Perforce Configuration:');
  try {
    const configResult = await tools.p4ConfigDetect(context, {});
    console.log('Result:', JSON.stringify(configResult, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Example 2: Server Info (would fail without p4 but shows structure)
  console.log('2. Getting Perforce Server Info:');
  try {
    const infoResult = await tools.p4Info(context, {});
    console.log('Result:', JSON.stringify(infoResult, null, 2));
  } catch (error) {
    console.log('Expected error without p4:', JSON.stringify({
      ok: false,
      error: {
        code: 'P4_NOT_FOUND',
        message: 'Perforce executable not found or not accessible'
      }
    }, null, 2));
  }
  console.log('');
  
  // Example 3: Showing expected input validation
  console.log('3. Input Validation Example (p4.add without files):');
  try {
    const addResult = await tools.p4Add(context, { files: [] });
    console.log('Result:', JSON.stringify(addResult, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Example 4: Changelist creation validation
  console.log('4. Changelist Creation Validation (missing description):');
  try {
    const changeResult = await tools.p4ChangelistCreate(context, {});
    console.log('Result:', JSON.stringify(changeResult, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Example 5: Safety features demonstration
  console.log('5. Safety Features - Read-only Mode Protection:');
  try {
    const addResult = await tools.p4Add(context, { files: ['example.txt'] });
    console.log('Result:', JSON.stringify(addResult, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  // Example 6: Delete protection demonstration
  console.log('6. Safety Features - Delete Protection:');
  const testContext = { 
    runner, 
    config, 
    serverConfig: { readOnlyMode: false, disableDelete: true } 
  };
  try {
    const deleteResult = await tools.p4Delete(testContext, { files: ['example.txt'] });
    console.log('Result:', JSON.stringify(deleteResult, null, 2));
  } catch (error) {
    console.log('Error:', error.message);
  }
  console.log('');
  
  console.log('Examples completed! This demonstrates the structured error handling,');
  console.log('input validation, and safety features that ensure non-interactive operation.');
  console.log('');
  console.log('Safety Features:');
  console.log('- Read-only mode is enabled by default (P4_READONLY_MODE=true)');
  console.log('- Delete operations are disabled by default (P4_DISABLE_DELETE=true)');
  console.log('- Override with environment variables: P4_READONLY_MODE=false P4_DISABLE_DELETE=false');
  console.log('');
  console.log('To run the actual MCP server, use: npm start');
  console.log('The server will accept MCP protocol messages via stdio.');
}

if (require.main === module) {
  runExamples();
}