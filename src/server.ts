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

type ToolHandler = (context: ToolContext, args: Record<string, unknown>) => Promise<unknown>;

const TOOL_HANDLERS: Record<string, ToolHandler> = {
  'p4.info': tools.p4Info as ToolHandler,
  'p4.status': tools.p4Status as ToolHandler,
  'p4.add': tools.p4Add as ToolHandler,
  'p4.edit': tools.p4Edit as ToolHandler,
  'p4.delete': tools.p4Delete as ToolHandler,
  'p4.revert': tools.p4Revert as ToolHandler,
  'p4.sync': tools.p4Sync as ToolHandler,
  'p4.opened': tools.p4Opened as ToolHandler,
  'p4.diff': tools.p4Diff as ToolHandler,
  'p4.diff2': tools.p4Diff2 as ToolHandler,
  'p4.changelist.create': tools.p4ChangelistCreate as ToolHandler,
  'p4.changelist.update': tools.p4ChangelistUpdate as ToolHandler,
  'p4.changelist.submit': tools.p4ChangelistSubmit as ToolHandler,
  'p4.submit': tools.p4Submit as ToolHandler,
  'p4.describe': tools.p4Describe as ToolHandler,
  'p4.filelog': tools.p4Filelog as ToolHandler,
  'p4.clients': tools.p4Clients as ToolHandler,
  'p4.config.detect': tools.p4ConfigDetect as ToolHandler,
  'p4.resolve': tools.p4Resolve as ToolHandler,
  'p4.shelve': tools.p4Shelve as ToolHandler,
  'p4.unshelve': tools.p4Unshelve as ToolHandler,
  'p4.changes': tools.p4Changes as ToolHandler,
  'p4.blame': tools.p4Blame as ToolHandler,
  'p4.copy': tools.p4Copy as ToolHandler,
  'p4.move': tools.p4Move as ToolHandler,
  'p4.integrate': tools.p4Integrate as ToolHandler,
  'p4.merge': tools.p4Merge as ToolHandler,
  'p4.print': tools.p4Print as ToolHandler,
  'p4.fstat': tools.p4Fstat as ToolHandler,
  'p4.streams': tools.p4Streams as ToolHandler,
  'p4.stream': tools.p4Stream as ToolHandler,
  'p4.grep': tools.p4Grep as ToolHandler,
  'p4.files': tools.p4Files as ToolHandler,
  'p4.dirs': tools.p4Dirs as ToolHandler,
  'p4.users': tools.p4Users as ToolHandler,
  'p4.user': tools.p4User as ToolHandler,
  'p4.client': tools.p4Client as ToolHandler,
  'p4.jobs': tools.p4Jobs as ToolHandler,
  'p4.job': tools.p4Job as ToolHandler,
  'p4.fixes': tools.p4Fixes as ToolHandler,
  'p4.labels': tools.p4Labels as ToolHandler,
  'p4.label': tools.p4Label as ToolHandler,
  'p4.sizes': tools.p4Sizes as ToolHandler,
  'p4.have': tools.p4Have as ToolHandler,
  'p4.where': tools.p4Where as ToolHandler,
  'p4.audit': tools.p4Audit as ToolHandler,
  'p4.compliance': tools.p4Compliance as ToolHandler,
};

const WRITE_TOOLS = new Set<string>([
  'p4.add',
  'p4.edit',
  'p4.delete',
  'p4.revert',
  'p4.sync',
  'p4.changelist.create',
  'p4.changelist.update',
  'p4.changelist.submit',
  'p4.submit',
  'p4.resolve',
  'p4.shelve',
  'p4.unshelve',
  'p4.copy',
  'p4.move',
  'p4.integrate',
  'p4.merge',
]);

const CACHEABLE_TOOLS = new Set<string>(
  Object.keys(TOOL_HANDLERS).filter((toolName) => !WRITE_TOOLS.has(toolName))
);

function getPerformanceMode(): 'fast' | 'balanced' | 'secure' {
  const mode = (process.env.P4_PERFORMANCE_MODE || 'fast').toLowerCase();
  if (mode === 'balanced' || mode === 'secure') {
    return mode;
  }
  return 'fast';
}

function getDefaultResponseCacheTtlMs(): number {
  switch (getPerformanceMode()) {
    case 'secure':
      return 1000;
    case 'balanced':
      return 3000;
    case 'fast':
    default:
      return 5000;
  }
}

function getDefaultResponseCacheMaxEntries(): number {
  switch (getPerformanceMode()) {
    case 'secure':
      return 100;
    case 'balanced':
      return 250;
    case 'fast':
    default:
      return 400;
  }
}

function getEnvInt(name: string, fallback: number): number {
  const parsed = parseInt(process.env[name] || '', 10);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : fallback;
}

class MCPPerforceServer {
  private server: Server;
  private context: ToolContext;
  private readonly prettyJson = process.env.P4_PRETTY_JSON === 'true';
  private readonly responseCacheEnabled = process.env.P4_RESPONSE_CACHE !== 'false';
  private readonly responseCacheTtlMs = getEnvInt('P4_RESPONSE_CACHE_TTL_MS', getDefaultResponseCacheTtlMs());
  private readonly responseCacheMaxEntries = getEnvInt(
    'P4_RESPONSE_CACHE_MAX_ENTRIES',
    getDefaultResponseCacheMaxEntries()
  );
  private readonly responseCache = new Map<string, { value: unknown; expiresAt: number }>();
  private readonly inFlightReadRequests = new Map<string, Promise<unknown>>();
  private cacheEpoch = 0;

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

  private serializeResult(value: unknown): string {
    if (this.prettyJson) {
      return JSON.stringify(value, null, 2);
    }
    return JSON.stringify(value);
  }

  private toTextResponse(value: unknown): { content: Array<{ type: 'text'; text: string }> } {
    return {
      content: [{ type: 'text', text: this.serializeResult(value) }],
    };
  }

  private getCachedResult(cacheKey: string): unknown | undefined {
    const entry = this.responseCache.get(cacheKey);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.responseCache.delete(cacheKey);
      return undefined;
    }

    return entry.value;
  }

  private setCachedResult(cacheKey: string, value: unknown): void {
    if (this.responseCacheMaxEntries <= 0 || this.responseCacheTtlMs <= 0) {
      return;
    }

    if (this.responseCache.size >= this.responseCacheMaxEntries) {
      const oldestKey = this.responseCache.keys().next().value;
      if (oldestKey) {
        this.responseCache.delete(oldestKey);
      }
    }

    this.responseCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + this.responseCacheTtlMs,
    });
  }

  private clearReadCache(): void {
    this.cacheEpoch += 1;
    if (this.responseCache.size > 0) {
      this.responseCache.clear();
    }
  }

  private buildCacheKey(name: string, args: unknown): string {
    return `${name}:${JSON.stringify(args ?? {})}`;
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    const handler = TOOL_HANDLERS[name];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return handler(this.context, args);
  }

  private async executeToolWithCaching(name: string, args: Record<string, unknown>): Promise<unknown> {
    if (!this.responseCacheEnabled || !CACHEABLE_TOOLS.has(name)) {
      return this.executeTool(name, args);
    }

    const cacheKey = this.buildCacheKey(name, args);
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult !== undefined) {
      return cachedResult;
    }

    const inFlight = this.inFlightReadRequests.get(cacheKey);
    if (inFlight) {
      return inFlight;
    }

    const pending = this.executeTool(name, args);
    this.inFlightReadRequests.set(cacheKey, pending);
    const startedEpoch = this.cacheEpoch;

    try {
      const result = await pending;
      if (
        startedEpoch === this.cacheEpoch &&
        result &&
        typeof result === 'object' &&
        (result as { ok?: boolean }).ok === true
      ) {
        this.setCachedResult(cacheKey, result);
      }
      return result;
    } finally {
      this.inFlightReadRequests.delete(cacheKey);
    }
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
            description: 'Show differences for workspace files (opened or local vs depot)',
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
            name: 'p4.diff2',
            description: 'Compare two depot paths server-side (depot-to-depot diff, no client mapping required)',
            inputSchema: {
              type: 'object',
              properties: {
                sourcePath: {
                  type: 'string',
                  description: 'First depot filespec/path to compare (required)',
                },
                targetPath: {
                  type: 'string',
                  description: 'Second depot filespec/path to compare (required)',
                },
                summaryOnly: {
                  type: 'boolean',
                  description: 'If true, list differing files only like diff2 -q (default: true). If false, include full diff output.',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory for config detection (optional, defaults to current directory)',
                },
              },
              required: ['sourcePath', 'targetPath'],
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
            description: 'Describe a changelist with metadata and affected files (equivalent to p4 describe -s)',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  oneOf: [
                    { type: 'string' },
                    { type: 'number' },
                  ],
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
            name: 'p4.integrate',
            description: 'Integrate files from source to target',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: 'Source filespec/path (required)',
                },
                target: {
                  type: 'string',
                  description: 'Target filespec/path (required)',
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
              required: ['source', 'target'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.merge',
            description: 'Merge files from source to target',
            inputSchema: {
              type: 'object',
              properties: {
                source: {
                  type: 'string',
                  description: 'Source filespec/path (required)',
                },
                target: {
                  type: 'string',
                  description: 'Target filespec/path (required)',
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
              required: ['source', 'target'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.print',
            description: 'Print file content from the depot',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Depot filespec to print (required)',
                },
                quiet: {
                  type: 'boolean',
                  description: 'Suppress file headers (optional, defaults to true)',
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
            name: 'p4.fstat',
            description: 'Get file metadata from depot/workspace',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Filespec to inspect (required)',
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
              required: ['filespec'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.streams',
            description: 'List streams',
            inputSchema: {
              type: 'object',
              properties: {
                stream: {
                  type: 'string',
                  description: 'Optional stream path filter',
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
            name: 'p4.stream',
            description: 'Get stream spec details',
            inputSchema: {
              type: 'object',
              properties: {
                stream: {
                  type: 'string',
                  description: 'Stream path/name (required)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['stream'],
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

        const toolArgs = (args || {}) as Record<string, unknown>;
        const result = await this.executeToolWithCaching(name, toolArgs);

        if (WRITE_TOOLS.has(name) && result && typeof result === 'object' && (result as { ok?: boolean }).ok) {
          this.clearReadCache();
        }

        // Audit log successful operation
        this.context.security.logAuditEntry({
          tool: name,
          user: (result as { configUsed?: { P4USER?: string } } | undefined)?.configUsed?.P4USER || 'unknown',
          client: (result as { configUsed?: { P4CLIENT?: string } } | undefined)?.configUsed?.P4CLIENT || 'unknown',
          operation: name,
          args: toolArgs,
          result: 'success',
          duration: Date.now() - startTime,
        });

        return this.toTextResponse(result);

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
  const packageJson = require('../package.json');

  // Handle version flag
  if (process.argv.includes('--version') || process.argv.includes('-v')) {
    console.log(packageJson.version);
    process.exit(0);
  }

  // Handle help flag
  if (process.argv.includes('--help') || process.argv.includes('-h')) {
    console.log(`
MCP Perforce Server v${packageJson.version}
===========================

A production-ready MCP (Model Context Protocol) server for Perforce operations.

Usage:
  mcp-perforce-server          Start the MCP server (stdio transport)
  mcp-perforce-server --help   Show this help message
  mcp-perforce-server --version Show version information

Environment Variables:
  P4_READONLY_MODE=false      Enable write operations (default: read-only enabled)
  P4_DISABLE_DELETE=false     Enable delete operations (default: delete disabled)  
  P4_PATH=/path/to/p4         Custom p4 executable path
  P4CONFIG=.p4config         Config file name (default: .p4config)
  LOG_LEVEL=info             Logging level: error,warn,info,debug
  P4_PERFORMANCE_MODE=fast    Performance profile: fast|balanced|secure (default: fast)
  P4_TIMEOUT_MS=5000          Command timeout in milliseconds (default by mode)
  P4_PRETTY_JSON=true         Pretty-print JSON responses (default: compact JSON)
  P4_RESPONSE_CACHE=false     Disable read-result cache (default: enabled)
  P4_RESPONSE_CACHE_TTL_MS=5000 Cache TTL in ms (default by mode: fast 5000, balanced 3000, secure 1000)
  P4_RESPONSE_CACHE_MAX_ENTRIES=400 Max cached responses (default by mode)

Compliance & Security:
  P4_ENABLE_AUDIT_LOGGING=true|false   Override audit logging (default in fast mode: false)
  P4_ENABLE_RATE_LIMITING=true|false   Override rate limiting (default in fast mode: false)
  P4_ENABLE_MEMORY_LIMITS=true|false   Override memory limits (default in fast mode: false)
  P4_ENABLE_INPUT_SANITIZATION=false Disable input sanitization (default: enabled)
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
