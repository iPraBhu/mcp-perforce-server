#!/usr/bin/env node

/**
 * Simple test script to verify MCP environment variable configuration
 */

const { P4Config } = require('./dist/p4/config.js');

async function testMcpConfig() {
  console.log('Testing MCP Environment Configuration...\n');
  
  // Set test environment variables that would come from MCP config
  process.env.P4PORT = 'test-server:1666';
  process.env.P4USER = 'testuser';  
  process.env.P4CLIENT = 'test-workspace';
  process.env.P4CHARSET = 'utf8';
  
  const config = new P4Config();
  
  // Test config detection without .p4config file
  console.log('=== Testing without .p4config file ===');
  const result1 = await config.findConfig('/tmp'); // Use /tmp which shouldn't have .p4config
  console.log('Found .p4config:', result1.found);
  console.log('Config from file:', JSON.stringify(result1.config, null, 2));
  
  // Test setupForCommand which merges MCP env
  console.log('\n=== Testing setupForCommand (includes MCP env) ===');
  const setup = await config.setupForCommand('/tmp');
  console.log('Working directory:', setup.cwd);
  console.log('Environment variables:', JSON.stringify(setup.env, null, 2));
  
  // Test validation with MCP env
  console.log('\n=== Testing validation with MCP environment ===');
  const validation = config.validateEnvironment(setup.configResult);
  console.log('Valid configuration:', validation.valid);
  if (validation.errors.length > 0) {
    console.log('Errors:', validation.errors);
  }
  
  if (validation.valid) {
    console.log('\n✅ Success! MCP configuration is working properly!');
  } else {
    console.log('\n❌ Configuration validation failed');
  }
}

testMcpConfig().catch(console.error);