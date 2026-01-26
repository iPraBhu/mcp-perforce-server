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
import { SecurityManager, securityManager } from './p4/security.js';
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
  security: SecurityManager;
}

class MCPPerforceServer {
  private server: Server;
  private context: ToolContext;

  constructor() {
    this.server = new Server(
      {
        name: 'mcp-perforce-server',
        version: '1.2.0',
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
      security: securityManager,
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
          // High Priority Tools
          {
            name: 'p4.resolve',
            description: 'Resolve merge conflicts',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to resolve (optional, resolves all if not specified)',
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional)',
                },
                strategy: {
                  type: 'string',
                  enum: ['accept-theirs', 'accept-yours', 'merge', 'edit', 'skip'],
                  description: 'Resolution strategy (optional)',
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
            name: 'p4.shelve',
            description: 'Shelve files for code review',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number (required)',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to shelve (optional, shelves all in changelist if not specified)',
                },
                delete: {
                  type: 'boolean',
                  description: 'Delete shelved files instead of creating (optional, defaults to false)',
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
            name: 'p4.unshelve',
            description: 'Unshelve files from a shelved changelist',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number (required)',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to unshelve (optional, unshelves all if not specified)',
                },
                force: {
                  type: 'boolean',
                  description: 'Force unshelve even if files are opened (optional, defaults to false)',
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
            name: 'p4.changes',
            description: 'List submitted changelists with advanced filtering',
            inputSchema: {
              type: 'object',
              properties: {
                status: {
                  type: 'string',
                  enum: ['submitted', 'pending', 'shelved'],
                  description: 'Filter by changelist status (optional)',
                },
                user: {
                  type: 'string',
                  description: 'Filter by user (optional)',
                },
                client: {
                  type: 'string',
                  description: 'Filter by client/workspace (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
                },
                filespec: {
                  type: 'string',
                  description: 'Filter by filespec (optional)',
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
            name: 'p4.blame',
            description: 'Show file annotations with change history (like git blame)',
            inputSchema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  description: 'File to show blame for (required)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['file'],
              additionalProperties: false,
            },
          },
          // Medium Priority Tools
          {
            name: 'p4.copy',
            description: 'Copy files between locations',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: 'Source file path (required)',
                },
                destination: {
                  type: 'string',
                  description: 'Destination file path (required)',
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['source', 'destination'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.move',
            description: 'Move/rename files',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: 'Source file path (required)',
                },
                destination: {
                  type: 'string',
                  description: 'Destination file path (required)',
                },
                changelist: {
                  type: 'string',
                  description: 'Changelist number (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['source', 'destination'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.grep',
            description: 'Search for text patterns across depot files',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Search pattern (required)',
                },
                filespec: {
                  type: 'string',
                  description: 'Filespec to search in (optional)',
                },
                caseInsensitive: {
                  type: 'boolean',
                  description: 'Case insensitive search (optional, defaults to false)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['pattern'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.files',
            description: 'List files in depot with metadata',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to list (optional, defaults to all files)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
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
            name: 'p4.dirs',
            description: 'List directories in depot',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to list directories for (optional, defaults to all directories)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              additionalProperties: false,
            },
          },
          // Advanced/Low Priority Tools
          {
            name: 'p4.users',
            description: 'List Perforce users',
            inputSchema: {
              type: 'object',
              properties: {
                user: {
                  type: 'string',
                  description: 'Specific user to show (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
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
            name: 'p4.user',
            description: 'Get user information',
            inputSchema: {
              type: 'object',
              properties: {
                user: {
                  type: 'string',
                  description: 'User to get info for (optional, defaults to current user)',
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
            name: 'p4.client',
            description: 'Get detailed client/workspace information',
            inputSchema: {
              type: 'object',
              properties: {
                client: {
                  type: 'string',
                  description: 'Client/workspace name (optional, defaults to current client)',
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
            name: 'p4.jobs',
            description: 'List jobs (if job tracking is enabled)',
            inputSchema: {
              type: 'object',
              properties: {
                job: {
                  type: 'string',
                  description: 'Specific job to show (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
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
            name: 'p4.job',
            description: 'Get job details',
            inputSchema: {
              type: 'object',
              properties: {
                job: {
                  type: 'string',
                  description: 'Job ID (required)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['job'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.fixes',
            description: 'Show which changelists fix which jobs',
            inputSchema: {
              type: 'object',
              properties: {
                job: {
                  type: 'string',
                  description: 'Filter by job ID (optional)',
                },
                changelist: {
                  type: 'string',
                  description: 'Filter by changelist (optional)',
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
            name: 'p4.labels',
            description: 'List labels',
            inputSchema: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description: 'Specific label to show (optional)',
                },
                user: {
                  type: 'string',
                  description: 'Filter by user (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
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
            name: 'p4.label',
            description: 'Get label details',
            inputSchema: {
              type: 'object',
              properties: {
                label: {
                  type: 'string',
                  description: 'Label name (required)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['label'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.sizes',
            description: 'Get file sizes and disk usage statistics',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to get sizes for (optional, defaults to current directory)',
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
            name: 'p4.have',
            description: 'List files currently synced in workspace',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to check (optional)',
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
            name: 'p4.where',
            description: 'Show depot/local/workspace mappings for files',
            inputSchema: {
              type: 'object',
              properties: {
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to show mappings for (required)',
                  minItems: 1,
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
            name: 'p4.audit',
            description: 'Get audit log entries for compliance reporting (requires audit logging enabled)',
            inputSchema: {
              type: 'object',
              properties: {
                tool: {
                  type: 'string',
                  description: 'Filter by tool name',
                },
                user: {
                  type: 'string',
                  description: 'Filter by user',
                },
                result: {
                  type: 'string',
                  enum: ['success', 'error', 'blocked'],
                  description: 'Filter by result type',
                },
                since: {
                  type: 'string',
                  description: 'Filter entries since this ISO date',
                },
                format: {
                  type: 'string',
                  enum: ['json', 'csv'],
                  description: 'Output format (default: json)',
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
            name: 'p4.compliance',
            description: 'Get compliance configuration and current status',
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
        ],
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      const { name, arguments: args } = request.params;

      try {
        log.debug(`Calling tool: ${name}`);

        // Rate limiting check
        const rateLimitResult = this.context.security.checkRateLimit(request.params.name);
        if (!rateLimitResult.allowed) {
          const errorMsg = `Rate limit exceeded for tool ${name}. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`;
          log.warn(`Rate limit exceeded: ${name}`);

          // Audit log the blocked request
          this.context.security.logAuditEntry({
            tool: request.params.name,
            user: 'unknown', // Could be enhanced to extract from P4 config
            client: 'unknown',
            operation: request.params.name,
            args: request.params.arguments || {},
            result: 'blocked',
            errorCode: 'RATE_LIMIT_EXCEEDED',
            duration: Date.now() - startTime,
          });

          throw new McpError(ErrorCode.InternalError, errorMsg);
        }

        // Memory usage check
        const memoryCheck = this.context.security.checkMemoryUsage();
        if (!memoryCheck.withinLimits) {
          log.warn(`Memory limit exceeded: ${memoryCheck.warnings.join(', ')}`);
          // Try garbage collection
          if (this.context.security.forceGarbageCollection()) {
            log.info('Forced garbage collection');
          }
        }

        // Route to appropriate tool implementation
        let result: any;
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
          // High Priority Tools
          case 'p4.resolve':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Resolve(this.context, args as any), null, 2) }] };
          case 'p4.shelve':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Shelve(this.context, args as any), null, 2) }] };
          case 'p4.unshelve':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Unshelve(this.context, args as any), null, 2) }] };
          case 'p4.changes':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Changes(this.context, args as any), null, 2) }] };
          case 'p4.blame':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Blame(this.context, args as any), null, 2) }] };
          // Medium Priority Tools
          case 'p4.copy':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Copy(this.context, args as any), null, 2) }] };
          case 'p4.move':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Move(this.context, args as any), null, 2) }] };
          case 'p4.grep':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Grep(this.context, args as any), null, 2) }] };
          case 'p4.files':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Files(this.context, args as any), null, 2) }] };
          case 'p4.dirs':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Dirs(this.context, args as any), null, 2) }] };
          // Advanced/Low Priority Tools
          case 'p4.users':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Users(this.context, args as any), null, 2) }] };
          case 'p4.user':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4User(this.context, args as any), null, 2) }] };
          case 'p4.client':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Client(this.context, args as any), null, 2) }] };
          case 'p4.jobs':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Jobs(this.context, args as any), null, 2) }] };
          case 'p4.job':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Job(this.context, args as any), null, 2) }] };
          case 'p4.fixes':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Fixes(this.context, args as any), null, 2) }] };
          case 'p4.labels':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Labels(this.context, args as any), null, 2) }] };
          case 'p4.label':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Label(this.context, args as any), null, 2) }] };
          case 'p4.sizes':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Sizes(this.context, args as any), null, 2) }] };
          case 'p4.have':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Have(this.context, args as any), null, 2) }] };
          case 'p4.where':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Where(this.context, args as any), null, 2) }] };
          // Compliance and Security Tools
          case 'p4.audit':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Audit(this.context, args as any), null, 2) }] };
          case 'p4.compliance':
            return { content: [{ type: 'text', text: JSON.stringify(await tools.p4Compliance(this.context, args as any), null, 2) }] };
          default:
            throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
        }

        // Audit log successful operation
        this.context.security.logAuditEntry({
          tool: name,
          user: result?.configUsed?.P4USER || 'unknown',
          client: result?.configUsed?.P4CLIENT || 'unknown',
          operation: name,
          args: args || {},
          result: 'success',
          duration: Date.now() - startTime,
        });

        return { content: [{ type: 'text', text: JSON.stringify(result, null, 2) }] };

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorCode = error instanceof McpError ? error.code : 'INTERNAL_ERROR';

        log.error('Tool execution error:', error);

        // Audit log failed operation
        this.context.security.logAuditEntry({
          tool: name,
          user: 'unknown', // Could be enhanced to extract from context
          client: 'unknown',
          operation: name,
          args: args || {},
          result: 'error',
          errorCode: typeof errorCode === 'string' ? errorCode : errorCode.toString(),
          duration,
        });

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

Compliance & Security:
  P4_ENABLE_AUDIT_LOGGING=true   Enable audit logging (default: false)
  P4_ENABLE_RATE_LIMITING=false  Disable rate limiting (default: true)
  P4_ENABLE_MEMORY_LIMITS=false  Disable memory limits (default: true)
  P4_ENABLE_INPUT_SANITIZATION=false Disable input sanitization (default: true)
  P4_MAX_MEMORY_MB=1024         Memory limit in MB (default: 512)
  P4_AUDIT_RETENTION_DAYS=365   Audit log retention days (default: 90)
  P4_RATE_LIMIT_REQUESTS=100    Max requests per window (default: 100)
  P4_RATE_LIMIT_WINDOW_MS=600000 Rate limit window ms (default: 10min)
  P4_RATE_LIMIT_BLOCK_MS=3600000 Rate limit block duration ms (default: 1hr)

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