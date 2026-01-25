#!/usr/bin/env node

import { Server } from '@modelcontextprotocol/sdk/server/index.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import {
  CallToolRequestSchema,
  ErrorCode,
  ListToolsRequestSchema,
  McpError,
} from '@modelcontextprotocol/sdk/types.js';

import { P4Runner } from './p4/runner.js';
import { P4Config, P4ServerConfig } from './p4/config.js';
import * as tools from './tools/index.js';

// Environment-based logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
const shouldLog = (level: string) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  return levels.indexOf(level) <= levels.indexOf(LOG_LEVEL);
};

const log = {
  error: (...args: unknown[]) => shouldLog('error') && console.error('[ERROR]', ...args),
  warn: (...args: unknown[]) => shouldLog('warn') && console.error('[WARN]', ...args),
  info: (...args: unknown[]) => shouldLog('info') && console.error('[INFO]', ...args),
  debug: (...args: unknown[]) => shouldLog('debug') && console.error('[DEBUG]', ...args),
};

interface ToolContext {
  runner: P4Runner;
  config: P4Config;
  serverConfig: P4ServerConfig;
}

class MCPPerforceServer {
  private server: Server;
  private context: ToolContext;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-perforce-server',
        version: '1.0.0',
      },
      {
        capabilities: {
          tools: {},
        },
      }
    );

    this.context = {
      runner: new P4Runner(),
      config: new P4Config(),
      serverConfig: new P4Config().getServerConfig(),
    };

    this.setupToolHandlers();
    this.setupErrorHandling();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      log.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      log.info('Shutting down MCP Perforce server...');
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      log.info('Shutting down MCP Perforce server...');
      await this.server.close();
      process.exit(0);
    });
  }

  private setupToolHandlers(): void {
    this.server.setRequestHandler(ListToolsRequestSchema, async () => {
      log.debug('Listing available tools');
      return {
        tools: [
          {
            name: 'p4.info',
            description: 'Get Perforce server and client information',
            inputSchema: {
              type: 'object',
              properties: {
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.status',
            description: 'Get status of opened files and pending changes',
            inputSchema: {
              type: 'object',
              properties: {
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.add',
            description: 'Add files to Perforce',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to add (required)',
                  minItems: 1,
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional, defaults to default changelist)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['files'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.edit',
            description: 'Open files for edit in Perforce',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to edit (required)',
                  minItems: 1,
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional, defaults to default changelist)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['files'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.delete',
            description: 'Mark files for delete in Perforce',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to delete (required)',
                  minItems: 1,
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional, defaults to default changelist)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['files'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.revert',
            description: 'Revert files or all files in changelist',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to revert (optional, if not provided reverts all files)',
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional, defaults to default changelist)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.sync',
            description: 'Sync files from Perforce depot',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to sync (optional, defaults to current directory)',
                },
                force: {
                  type: 'boolean',
                  description: 'Force sync (optional, defaults to false)',
                },
                preview: {
                  type: 'boolean',
                  description: 'Preview sync without executing (optional, defaults to false)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.opened',
            description: 'List opened files',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional, shows all opened files if not specified)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.diff',
            description: 'Show differences for files',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to diff (optional, defaults to all opened files)',
                },
                summary: {
                  type: 'boolean',
                  description: 'Show summary only (optional, defaults to false)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.changelist.create',
            description: 'Create a new changelist',
            inputSchema: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Changelist description (required)',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to include in changelist (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['description'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.changelist.update',
            description: 'Update an existing changelist',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number (required)',
                },
                description: {
                  type: 'string',
                  description: 'New description (optional)',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to include in changelist (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['changelist'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.changelist.submit',
            description: 'Submit a numbered changelist',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number to submit (required)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['changelist'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.submit',
            description: 'Submit default changelist or create and submit new changelist',
            inputSchema: {
              type: 'object',
              properties: {
                description: {
                  type: 'string',
                  description: 'Submit description (required for default changelist)',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to submit (optional, defaults to all files in default changelist)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['description'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.describe',
            description: 'Describe a changelist',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number (required)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['changelist'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.filelog',
            description: 'Show file history',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to show history for (required)',
                },
                maxRevisions: {
                  type: 'number',
                  description: 'Maximum number of revisions to show (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['filespec'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.clients',
            description: 'List Perforce clients/workspaces',
            inputSchema: {
              type: 'object',
              properties: {
                user: {
                  type: 'string',
                  description: 'Filter by user (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          {
            name: 'p4.config.detect',
            description: 'Detect and show Perforce configuration',
            inputSchema: {
              type: 'object',
              properties: {
                workspacePath: {
                  type: 'string',
                  description: 'Path to start config search from (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      try {
        log.debug(`Calling tool: ${request.params.name}`);
        
        const { name, arguments: args } = request.params;
        
        // Route to appropriate tool implementation
        switch (name) {
          case 'p4.info':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Info(this.context, args as any), null, 2) }] };
          case 'p4.status':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Status(this.context, args as any), null, 2) }] };
          case 'p4.add':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Add(this.context, args as any), null, 2) }] };
          case 'p4.edit':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Edit(this.context, args as any), null, 2) }] };
          case 'p4.delete':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Delete(this.context, args as any), null, 2) }] };
          case 'p4.revert':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Revert(this.context, args as any), null, 2) }] };
          case 'p4.sync':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Sync(this.context, args as any), null, 2) }] };
          case 'p4.opened':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Opened(this.context, args as any), null, 2) }] };
          case 'p4.diff':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Diff(this.context, args as any), null, 2) }] };
          case 'p4.changelist.create':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4ChangelistCreate(this.context, args as any), null, 2) }] };
          case 'p4.changelist.update':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4ChangelistUpdate(this.context, args as any), null, 2) }] };
          case 'p4.changelist.submit':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4ChangelistSubmit(this.context, args as any), null, 2) }] };
          case 'p4.submit':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Submit(this.context, args as any), null, 2) }] };
          case 'p4.describe':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Describe(this.context, args as any), null, 2) }] };
          case 'p4.filelog':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Filelog(this.context, args as any), null, 2) }] };
          case 'p4.clients':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Clients(this.context, args as any), null, 2) }] };
          case 'p4.config.detect':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4ConfigDetect(this.context, args as any), null, 2) }] };
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }
      } catch (error) {
        log.error('Tool execution error:', error);
        if (error instanceof McpError) {
          throw error;
        }
        throw new McpError(ErrorCode.InternalError, `Tool execution failed: ${error}`);
      }
    });
  }

  async run(): Promise<void> {
    const transport = new StdioServerTransport();
    log.info('Starting MCP Perforce server...');
    await this.server.connect(transport);
    log.info('MCP Perforce server running');
  }
}

// Start the server
if (require.main === module) {
  // Handle help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
MCP Perforce Server v1.0.0
===========================

A production-ready MCP (Model Context Protocol) server for Perforce operations.

Usage:
  mcp-perforce-server          Start the MCP server (stdio transport)
  mcp-perforce-server --help   Show this help message

Environment Variables:
  P4_READONLY_MODE=false      Enable write operations (default: true)
  P4_DISABLE_DELETE=false     Enable delete operations (default: true) 
  P4_PATH=/path/to/p4         Custom p4 executable path
  P4CONFIG=.p4config         Config file name (default: .p4config)
  LOG_LEVEL=info             Logging level: error,warn,info,debug

Configuration:
  Place a .p4config file in your project root or parent directories:
  
  P4PORT=your-server:1666
  P4USER=your-username
  P4CLIENT=your-workspace-name

IDE Integration:
  Configure your IDE's MCP client to use this server.
  See README.md for VS Code and Cursor setup instructions.

For more information: https://github.com/iPraBhu/mcp-perforce-server
`);
    process.exit(0);
  }

  const server = new MCPPerforceServer();
  server.run().catch((error) => {
    log.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { MCPPerforceServer };