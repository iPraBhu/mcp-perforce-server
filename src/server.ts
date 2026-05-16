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
import { SSETransportManager, SSETransportOptions } from './transports/sse.js';

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

type CacheStatus = 'uncacheable' | 'hit' | 'negative_hit' | 'in_flight' | 'miss';

interface CacheEntry {
  value: unknown;
  expiresAt: number;
  isNegative: boolean;
  ttlMs: number;
}

interface ToolPerformanceStats {
  calls: number;
  successes: number;
  errors: number;
  cacheHits: number;
  negativeCacheHits: number;
  cacheMisses: number;
  inFlightHits: number;
  totalDurationMs: number;
  durationsMs: number[];
  subcallTotals: Record<string, number>;
}

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
  'p4.review': tools.p4Review as ToolHandler,
  'p4.reviews': tools.p4Reviews as ToolHandler,
  'p4.interchanges': tools.p4Interchanges as ToolHandler,
  'p4.integrated': tools.p4Integrated as ToolHandler,
  'p4.review.bundle': tools.p4ReviewBundle as ToolHandler,
  'p4.change.inspect': tools.p4ChangeInspect as ToolHandler,
  'p4.path.synccheck': tools.p4PathSyncCheck as ToolHandler,
  'p4.file.inspect': tools.p4FileInspect as ToolHandler,
  'p4.workspace.snapshot': tools.p4WorkspaceSnapshot as ToolHandler,
  'p4.search.inspect': tools.p4SearchInspect as ToolHandler,
  'p4.review.prepare': tools.p4ReviewPrepare as ToolHandler,
  'p4.blame': tools.p4Blame as ToolHandler,
  'p4.annotate': tools.p4Annotate as ToolHandler,
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

const toClientToolName = (toolName: string): string => toolName.replace(/\./g, '_');

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

const LOW_LATENCY_CACHE_TTL_TOOLS = new Set<string>([
  'p4.status',
  'p4.opened',
  'p4.changes',
  'p4.review',
  'p4.reviews',
  'p4.interchanges',
  'p4.integrated',
  'p4.review.bundle',
  'p4.change.inspect',
  'p4.path.synccheck',
  'p4.file.inspect',
  'p4.workspace.snapshot',
  'p4.search.inspect',
  'p4.review.prepare',
]);

const STABLE_CACHE_TTL_TOOLS = new Set<string>([
  'p4.info',
  'p4.users',
  'p4.user',
  'p4.clients',
  'p4.client',
  'p4.labels',
  'p4.label',
  'p4.streams',
  'p4.stream',
  'p4.jobs',
  'p4.job',
  'p4.config.detect',
  'p4.compliance',
]);

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

function parseToolCacheTtlOverrides(raw: string | undefined): Map<string, number> {
  const overrides = new Map<string, number>();
  if (!raw) {
    return overrides;
  }

  for (const segment of raw.split(',')) {
    const trimmed = segment.trim();
    if (!trimmed) {
      continue;
    }

    const splitIndex = trimmed.includes('=') ? trimmed.indexOf('=') : trimmed.indexOf(':');
    if (splitIndex <= 0) {
      continue;
    }

    const key = trimmed.slice(0, splitIndex).trim();
    const valueRaw = trimmed.slice(splitIndex + 1).trim();
    const value = parseInt(valueRaw, 10);
    if (key && Number.isFinite(value) && value >= 0) {
      overrides.set(key, value);
    }
  }

  return overrides;
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
  private readonly responseCacheTtlOverrides = parseToolCacheTtlOverrides(process.env.P4_RESPONSE_CACHE_TTL_MAP);
  private readonly negativeCacheEnabled = process.env.P4_NEGATIVE_CACHE !== 'false';
  private readonly negativeCacheTtlMs = getEnvInt(
    'P4_NEGATIVE_CACHE_TTL_MS',
    Math.max(1000, Math.min(this.responseCacheTtlMs, 5000))
  );
  private readonly negativeCacheableErrorCodes = new Set<string>([
    'P4_INVALID_ARGS',
    'P4_READONLY_MODE',
    'P4_DELETE_DISABLED',
    'P4_AUDIT_DISABLED',
    'P4_CONFIG_NOT_FOUND',
  ]);
  private readonly responseCache = new Map<string, CacheEntry>();
  private readonly inFlightReadRequests = new Map<string, Promise<unknown>>();
  private readonly toolPerformance = new Map<string, ToolPerformanceStats>();
  private readonly perfMetricsSampleSize = getEnvInt('P4_PERF_METRICS_SAMPLE_SIZE', 200) || 200;
  private readonly perfMetricsEnabled = process.env.P4_LOG_PERF_METRICS === 'true';
  private readonly perfMetricsIntervalMs = getEnvInt('P4_LOG_PERF_METRICS_INTERVAL_MS', 60000) || 60000;
  private perfMetricsTimer: NodeJS.Timeout | null = null;
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
    this.setupPerformanceLogging();
  }

  private setupErrorHandling(): void {
    this.server.onerror = (error) => {
      log.error('MCP Server error:', error);
    };

    process.on('SIGINT', async () => {
      log.info('Shutting down MCP Perforce server...');
      this.stopPerformanceLogging();
      await this.server.close();
      process.exit(0);
    });

    process.on('SIGTERM', async () => {
      log.info('Shutting down MCP Perforce server...');
      this.stopPerformanceLogging();
      await this.server.close();
      process.exit(0);
    });
  }

  private setupPerformanceLogging(): void {
    if (!this.perfMetricsEnabled || this.perfMetricsIntervalMs <= 0) {
      return;
    }

    this.perfMetricsTimer = setInterval(() => {
      this.logPerformanceSnapshot();
    }, this.perfMetricsIntervalMs);

    if (typeof this.perfMetricsTimer.unref === 'function') {
      this.perfMetricsTimer.unref();
    }
  }

  private stopPerformanceLogging(): void {
    if (!this.perfMetricsTimer) {
      return;
    }
    clearInterval(this.perfMetricsTimer);
    this.perfMetricsTimer = null;
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

  private getToolCacheTtlMs(toolName: string): number {
    const override = this.responseCacheTtlOverrides.get(toolName);
    if (override !== undefined) {
      return override;
    }

    if (LOW_LATENCY_CACHE_TTL_TOOLS.has(toolName)) {
      return Math.max(1000, Math.floor(this.responseCacheTtlMs / 2));
    }
    if (STABLE_CACHE_TTL_TOOLS.has(toolName)) {
      return Math.max(this.responseCacheTtlMs, 15000);
    }
    return this.responseCacheTtlMs;
  }

  private getCachedResult(cacheKey: string): { result: unknown; cacheStatus: CacheStatus } | undefined {
    const entry = this.responseCache.get(cacheKey);
    if (!entry) {
      return undefined;
    }

    if (Date.now() > entry.expiresAt) {
      this.responseCache.delete(cacheKey);
      return undefined;
    }

    // LRU behavior: refresh recency on read hits.
    this.responseCache.delete(cacheKey);
    this.responseCache.set(cacheKey, entry);

    return {
      result: entry.value,
      cacheStatus: entry.isNegative ? 'negative_hit' : 'hit',
    };
  }

  private setCachedResult(cacheKey: string, value: unknown, ttlMs: number, isNegative = false): void {
    if (this.responseCacheMaxEntries <= 0 || ttlMs <= 0) {
      return;
    }

    if (this.responseCache.has(cacheKey)) {
      this.responseCache.delete(cacheKey);
    }

    while (this.responseCache.size >= this.responseCacheMaxEntries) {
      const oldestKey = this.responseCache.keys().next().value;
      if (!oldestKey) {
        break;
      }
      this.responseCache.delete(oldestKey);
    }

    this.responseCache.set(cacheKey, {
      value,
      expiresAt: Date.now() + ttlMs,
      isNegative,
      ttlMs,
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

  private shouldCacheNegativeResult(result: unknown): boolean {
    if (!this.negativeCacheEnabled || !result || typeof result !== 'object') {
      return false;
    }

    const resultRecord = result as { ok?: boolean; error?: { code?: string } };
    if (resultRecord.ok !== false) {
      return false;
    }

    const errorCode = resultRecord.error?.code;
    return typeof errorCode === 'string' && this.negativeCacheableErrorCodes.has(errorCode);
  }

  private recordToolPerformance(
    toolName: string,
    durationMs: number,
    result: unknown,
    cacheStatus: CacheStatus,
    subcallCounts?: Record<string, number>
  ): void {
    let stats = this.toolPerformance.get(toolName);
    if (!stats) {
      stats = {
        calls: 0,
        successes: 0,
        errors: 0,
        cacheHits: 0,
        negativeCacheHits: 0,
        cacheMisses: 0,
        inFlightHits: 0,
        totalDurationMs: 0,
        durationsMs: [],
        subcallTotals: {},
      };
      this.toolPerformance.set(toolName, stats);
    }

    stats.calls += 1;
    stats.totalDurationMs += durationMs;
    stats.durationsMs.push(durationMs);
    if (stats.durationsMs.length > this.perfMetricsSampleSize) {
      stats.durationsMs.shift();
    }

    const ok = !!(result && typeof result === 'object' && (result as { ok?: boolean }).ok === true);
    if (ok) {
      stats.successes += 1;
    } else {
      stats.errors += 1;
    }

    switch (cacheStatus) {
      case 'hit':
        stats.cacheHits += 1;
        break;
      case 'negative_hit':
        stats.negativeCacheHits += 1;
        break;
      case 'in_flight':
        stats.inFlightHits += 1;
        break;
      case 'miss':
        stats.cacheMisses += 1;
        break;
      default:
        break;
    }

    if (subcallCounts) {
      for (const [name, value] of Object.entries(subcallCounts)) {
        if (!Number.isFinite(value) || value <= 0) {
          continue;
        }
        stats.subcallTotals[name] = (stats.subcallTotals[name] || 0) + value;
      }
    }
  }

  private getPercentile(samples: number[], percentile: number): number {
    if (samples.length === 0) {
      return 0;
    }
    const sorted = [...samples].sort((a, b) => a - b);
    const index = Math.min(
      sorted.length - 1,
      Math.max(0, Math.floor((percentile / 100) * (sorted.length - 1)))
    );
    return Math.round(sorted[index]);
  }

  private extractSubcallCounts(result: unknown): Record<string, number> | undefined {
    if (!result || typeof result !== 'object') {
      return undefined;
    }
    const outer = result as { result?: unknown };
    if (!outer.result || typeof outer.result !== 'object') {
      return undefined;
    }
    const meta = (outer.result as { meta?: { subcallCounts?: Record<string, number> } }).meta;
    if (!meta || !meta.subcallCounts) {
      return undefined;
    }
    return meta.subcallCounts;
  }

  private logPerformanceSnapshot(): void {
    if (this.toolPerformance.size === 0) {
      return;
    }

    const byCalls = [...this.toolPerformance.entries()].sort((a, b) => b[1].calls - a[1].calls);
    const topEntries = byCalls.slice(0, 12).map(([toolName, stats]) => {
      const cacheHitsTotal = stats.cacheHits + stats.negativeCacheHits + stats.inFlightHits;
      const cacheHitRate = stats.calls > 0 ? Math.round((cacheHitsTotal / stats.calls) * 100) : 0;
      const avgMs = stats.calls > 0 ? Math.round(stats.totalDurationMs / stats.calls) : 0;
      return {
        tool: toolName,
        calls: stats.calls,
        avgMs,
        p50Ms: this.getPercentile(stats.durationsMs, 50),
        p95Ms: this.getPercentile(stats.durationsMs, 95),
        cacheHitRate,
        subcalls: stats.subcallTotals,
      };
    });

    log.info('Performance snapshot:', topEntries);
  }

  private async executeTool(name: string, args: Record<string, unknown>): Promise<unknown> {
    // Normalize tool name: support both dot notation (p4.changes) and underscore (p4_changes)
    const normalizedName = name.replace(/_/g, '.');
    const handler = TOOL_HANDLERS[normalizedName];
    if (!handler) {
      throw new McpError(ErrorCode.MethodNotFound, `Unknown tool: ${name}`);
    }

    return handler(this.context, args);
  }

  private async executeToolWithCaching(
    name: string,
    args: Record<string, unknown>
  ): Promise<{ result: unknown; cacheStatus: CacheStatus }> {
    // Normalize tool name for consistency in caching
    const normalizedName = name.replace(/_/g, '.');
    
    if (!this.responseCacheEnabled || !CACHEABLE_TOOLS.has(normalizedName)) {
      return { result: await this.executeTool(name, args), cacheStatus: 'uncacheable' };
    }

    const cacheKey = this.buildCacheKey(normalizedName, args);
    const cachedResult = this.getCachedResult(cacheKey);
    if (cachedResult) {
      return cachedResult;
    }

    const inFlight = this.inFlightReadRequests.get(cacheKey);
    if (inFlight) {
      return { result: await inFlight, cacheStatus: 'in_flight' };
    }

    const pending = this.executeTool(name, args);
    this.inFlightReadRequests.set(cacheKey, pending);
    const startedEpoch = this.cacheEpoch;

    try {
      const result = await pending;
      if (
        startedEpoch === this.cacheEpoch
      ) {
        const toolTtlMs = this.getToolCacheTtlMs(normalizedName);
        if (result && typeof result === 'object' && (result as { ok?: boolean }).ok === true) {
          this.setCachedResult(cacheKey, result, toolTtlMs, false);
        } else if (this.shouldCacheNegativeResult(result)) {
          const negativeTtl = Math.min(toolTtlMs, this.negativeCacheTtlMs);
          this.setCachedResult(cacheKey, result, negativeTtl, true);
        }
      }
      return { result, cacheStatus: 'miss' };
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to sync in one command (optional)',
                },
                force: {
                  type: 'boolean',
                  description: 'Force sync (optional, defaults to false)',
                },
                preview: {
                  type: 'boolean',
                  description: 'Preview sync without executing (optional, defaults to false)',
                },
                summaryPreview: {
                  type: 'boolean',
                  description: 'Preview only the sync summary using p4 sync -N (optional)',
                },
                quiet: {
                  type: 'boolean',
                  description: 'Suppress normal sync messages using -q (optional)',
                },
                metadataOnly: {
                  type: 'boolean',
                  description: 'Update have-list metadata only using -k (optional)',
                },
                safeSync: {
                  type: 'boolean',
                  description: 'Enable digest safety checks using -s (optional)',
                },
                populateOnly: {
                  type: 'boolean',
                  description: 'Populate without updating server state using -p (optional)',
                },
                reopenMoved: {
                  type: 'boolean',
                  description: 'Reopen moved files in new depot locations using -r (optional)',
                },
                useListOptimization: {
                  type: 'boolean',
                  description: 'Use the -L file list optimization for exact depot revisions (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Limit sync to the first max files (optional)',
                },
                parallel: {
                  type: 'string',
                  description: 'Parallel sync specification, for example threads=4,batch=8 (optional)',
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
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional files/filespecs to check for opened state',
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
            description: 'Describe a changelist with metadata, affected files, and optional diff content',
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
                includeDiff: {
                  type: 'boolean',
                  description: 'Include patch/diff content from p4 describe -d* (optional, default false)',
                },
                diffFormat: {
                  type: 'string',
                  enum: ['u', 'c', 'n', 's'],
                  description: 'Diff format when includeDiff=true: u=unified, c=context, n=RCS, s=summary',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to show history for in one command (required if filespec is omitted)',
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
              anyOf: [
                { required: ['filespec'] },
                { required: ['filespecs'] },
              ],
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
                stream: {
                  type: 'string',
                  description: 'Limit workspaces to a dedicated stream using -S (optional)',
                },
                nameFilter: {
                  type: 'string',
                  description: 'Workspace name filter using -e (optional)',
                },
                caseInsensitiveNameFilter: {
                  type: 'string',
                  description: 'Case-insensitive workspace name filter using -E (optional)',
                },
                unloaded: {
                  type: 'boolean',
                  description: 'List unloaded clients using -U (optional)',
                },
                allServers: {
                  type: 'boolean',
                  description: 'List clients across all servers using -a (optional)',
                },
                serverId: {
                  type: 'string',
                  description: 'Limit clients to a specific server using -s (optional)',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filter by multiple filespecs (optional)',
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
            name: 'p4.review',
            description: 'List changelists pending review',
            inputSchema: {
              type: 'object',
              properties: {
                counter: {
                  type: 'string',
                  description: 'Review counter/token used by p4 review -t (optional)',
                },
                filespec: {
                  type: 'string',
                  description: 'Optional filespec to filter changelists',
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
            name: 'p4.reviews',
            description: 'List reviewers for files or a changelist',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Optional changelist number to resolve reviewers for',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional file list/filespecs to resolve reviewers for',
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
            name: 'p4.interchanges',
            description: 'List changelists not yet integrated between two paths',
            inputSchema: {
              type: 'object',
              properties: {
                sourcePath: {
                  type: 'string',
                  description: 'Source depot filespec/path (required)',
                },
                targetPath: {
                  type: 'string',
                  description: 'Target depot filespec/path (required)',
                },
                targetPaths: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Additional target depot filespecs for branch or path modes (optional)',
                },
                branch: {
                  type: 'string',
                  description: 'Branch spec name for p4 interchanges -b mode (optional)',
                },
                stream: {
                  type: 'string',
                  description: 'Stream path for p4 interchanges -S mode (optional)',
                },
                parentStream: {
                  type: 'string',
                  description: 'Parent stream override for stream mode using -P (optional)',
                },
                useBranchSource: {
                  type: 'boolean',
                  description: 'Use branch -s mode where sourcePath becomes fromFile (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of changelists to return (optional)',
                },
                longDescription: {
                  type: 'boolean',
                  description: 'Include long descriptions (optional, equivalent to -l)',
                },
                reverse: {
                  type: 'boolean',
                  description: 'Reverse branch or stream mapping direction using -r (optional)',
                },
                time: {
                  type: 'boolean',
                  description: 'Display the time as well as the date using -t (optional)',
                },
                user: {
                  type: 'string',
                  description: 'Limit results to changes submitted by a specific user (optional)',
                },
                forceStreamFlow: {
                  type: 'boolean',
                  description: 'Force stream-mode interchanges to ignore expected flow using -F (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              anyOf: [
                { required: ['sourcePath', 'targetPath'] },
                { required: ['sourcePath', 'targetPaths'] },
                { required: ['branch'] },
                { required: ['stream'] },
              ],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.integrated',
            description: 'Show integration history for source/target paths',
            inputSchema: {
              type: 'object',
              properties: {
                sourcePath: {
                  type: 'string',
                  description: 'Source depot filespec/path (required)',
                },
                targetPath: {
                  type: 'string',
                  description: 'Optional target depot filespec/path',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional file/filespec list for native p4 integrated filtering',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              anyOf: [
                { required: ['sourcePath'] },
                { required: ['files'] },
              ],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.review.bundle',
            description: 'Composite review workflow: pending changes with optional details/reviewers',
            inputSchema: {
              type: 'object',
              properties: {
                counter: {
                  type: 'string',
                  description: 'Optional review counter/token for p4 review -t',
                },
                filespec: {
                  type: 'string',
                  description: 'Optional filespec filter',
                },
                maxChanges: {
                  type: 'number',
                  description: 'Maximum changelists to include (optional, default 10)',
                },
                includeDescribe: {
                  type: 'boolean',
                  description: 'Include p4 describe data per changelist (optional, default true)',
                },
                includeReviewers: {
                  type: 'boolean',
                  description: 'Include p4 reviews per changelist (optional, default true)',
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
            name: 'p4.change.inspect',
            description: 'Composite changelist inspection: describe + fixes + reviewers (+ optional file history)',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Changelist number to inspect (required)',
                },
                includeDiff: {
                  type: 'boolean',
                  description: 'Include describe diff content in inspection output (optional, default false)',
                },
                diffFormat: {
                  type: 'string',
                  enum: ['u', 'c', 'n', 's'],
                  description: 'Diff format for describe when includeDiff=true',
                },
                includeFileHistory: {
                  type: 'boolean',
                  description: 'Include p4 filelog for affected files (optional, default false)',
                },
                maxFilesWithHistory: {
                  type: 'number',
                  description: 'Maximum files to fetch filelog for (optional, default 5)',
                },
                maxRevisions: {
                  type: 'number',
                  description: 'Maximum revisions per filelog call (optional, default 5)',
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
            name: 'p4.path.synccheck',
            description: 'Composite path sync analysis using interchanges/integrated in one call',
            inputSchema: {
              type: 'object',
              properties: {
                sourcePath: {
                  type: 'string',
                  description: 'Source depot filespec/path (required)',
                },
                targetPath: {
                  type: 'string',
                  description: 'Target depot filespec/path (required)',
                },
                maxInterchanges: {
                  type: 'number',
                  description: 'Maximum interchanges per direction (optional, default 50)',
                },
                includeIntegrated: {
                  type: 'boolean',
                  description: 'Include p4 integrated history (optional, default true)',
                },
                checkBothDirections: {
                  type: 'boolean',
                  description: 'Run reverse-direction comparison too (optional, default true)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              required: ['sourcePath', 'targetPath'],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.file.inspect',
            description: 'Composite file inspection: fstat + filelog + optional print/blame in one call',
            inputSchema: {
              type: 'object',
              properties: {
                filespec: {
                  type: 'string',
                  description: 'Single filespec to inspect',
                },
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Multiple filespecs to inspect in one call',
                },
                includeFstat: {
                  type: 'boolean',
                  description: 'Include p4 fstat metadata (optional, default true)',
                },
                includeHistory: {
                  type: 'boolean',
                  description: 'Include p4 filelog history (optional, default true)',
                },
                includeContent: {
                  type: 'boolean',
                  description: 'Include p4 print content (optional, default false)',
                },
                includeBlame: {
                  type: 'boolean',
                  description: 'Include p4 annotate/blame output (optional, default false)',
                },
                maxFiles: {
                  type: 'number',
                  description: 'Maximum files to inspect in one call (optional, default requested count capped at 25)',
                },
                maxRevisions: {
                  type: 'number',
                  description: 'Maximum revisions per filelog call (optional, default 5)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              anyOf: [
                { required: ['filespec'] },
                { required: ['filespecs'] },
              ],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.workspace.snapshot',
            description: 'Composite workspace snapshot: info + status + optional config/opened/recent changes',
            inputSchema: {
              type: 'object',
              properties: {
                includeConfig: {
                  type: 'boolean',
                  description: 'Include p4.config.detect output (optional, default true)',
                },
                includeOpened: {
                  type: 'boolean',
                  description: 'Include full p4.opened output (optional, default false)',
                },
                includeRecentChanges: {
                  type: 'boolean',
                  description: 'Include recent changelists via p4.changes (optional, default false)',
                },
                recentChangesMax: {
                  type: 'number',
                  description: 'Maximum recent changelists to include (optional, default 10)',
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
            name: 'p4.search.inspect',
            description: 'Composite search helper: grep + optional fstat + optional content previews',
            inputSchema: {
              type: 'object',
              properties: {
                pattern: {
                  type: 'string',
                  description: 'Search pattern for p4 grep (required)',
                },
                filespec: {
                  type: 'string',
                  description: 'Single filespec to search',
                },
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Multiple filespecs to search in one call',
                },
                caseInsensitive: {
                  type: 'boolean',
                  description: 'Case insensitive search (optional, default false)',
                },
                maxFiles: {
                  type: 'number',
                  description: 'Maximum matched files to include (optional, default 20)',
                },
                maxMatchesPerFile: {
                  type: 'number',
                  description: 'Maximum grep matches to retain per file (optional, default 20)',
                },
                includeFstat: {
                  type: 'boolean',
                  description: 'Include p4 fstat metadata for matched files (optional, default true)',
                },
                includeContentPreview: {
                  type: 'boolean',
                  description: 'Include p4 print context snippets for matched files (optional, default false)',
                },
                previewContextLines: {
                  type: 'number',
                  description: 'Context lines before and after each match when includeContentPreview=true (optional, default 2)',
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
            name: 'p4.review.prepare',
            description: 'Composite review preparation: discover or accept changelists, then build review-ready inspection bundles',
            inputSchema: {
              type: 'object',
              properties: {
                changelist: {
                  type: 'string',
                  description: 'Single changelist to inspect directly',
                },
                changelists: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Multiple changelists to inspect directly',
                },
                status: {
                  type: 'string',
                  enum: ['submitted', 'pending', 'shelved'],
                  description: 'Status filter used when discovering changelists',
                },
                user: {
                  type: 'string',
                  description: 'User filter used when discovering changelists',
                },
                client: {
                  type: 'string',
                  description: 'Client/workspace filter used when discovering changelists',
                },
                filespec: {
                  type: 'string',
                  description: 'Single filespec filter used when discovering changelists',
                },
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Multiple filespec filters used when discovering changelists',
                },
                maxChanges: {
                  type: 'number',
                  description: 'Maximum changelists to inspect (optional, default 10)',
                },
                includeDiff: {
                  type: 'boolean',
                  description: 'Include changelist diff content in each inspection bundle (optional, default false)',
                },
                diffFormat: {
                  type: 'string',
                  enum: ['u', 'c', 'n', 's'],
                  description: 'Diff format for inspection describe output when includeDiff=true',
                },
                includeFileHistory: {
                  type: 'boolean',
                  description: 'Include file history for files touched by each changelist (optional, default false)',
                },
                maxFilesWithHistory: {
                  type: 'number',
                  description: 'Maximum files per changelist to include history for (optional, default 5)',
                },
                maxRevisions: {
                  type: 'number',
                  description: 'Maximum revisions per file history call (optional, default 5)',
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
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to show blame for in one command (required if file is omitted)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              anyOf: [
                { required: ['file'] },
                { required: ['files'] },
              ],
              additionalProperties: false,
            },
          },
          {
            name: 'p4.annotate',
            description: 'Alias of p4.blame (line-by-line annotation)',
            inputSchema: {
              type: 'object',
              properties: {
                file: {
                  type: 'string',
                  description: 'File to annotate (required)',
                },
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Files to annotate in one command (required if file is omitted)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              anyOf: [
                { required: ['file'] },
                { required: ['files'] },
              ],
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Depot filespecs to print in one command (required if filespec is omitted)',
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
              anyOf: [
                { required: ['filespec'] },
                { required: ['filespecs'] },
              ],
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to inspect in one command (required if filespec is omitted)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
                },
                filter: {
                  type: 'string',
                  description: 'fstat filter expression for -F (optional)',
                },
                fields: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific tagged fields to return using -T (optional)',
                },
                reverseOrder: {
                  type: 'boolean',
                  description: 'Reverse the output sort order using -r (optional)',
                },
                attributePattern: {
                  type: 'string',
                  description: 'Restrict attributes using -A pattern (optional)',
                },
                changeAfter: {
                  type: 'string',
                  description: 'Show files modified by or after a submitted changelist using -c (optional)',
                },
                changelist: {
                  type: 'string',
                  description: 'Show files modified by a specific changelist using -e (optional)',
                },
                outputOptions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Raw -O option suffixes such as l, p, r, s (optional)',
                },
                limitOptions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Raw -R option suffixes such as c, h, o, u (optional)',
                },
                sortOptions: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Raw -S option suffixes such as d, h, r, s, t (optional)',
                },
                workspacePath: {
                  type: 'string',
                  description: 'Path to workspace directory (optional, defaults to current directory)',
                },
              },
              anyOf: [
                { required: ['filespec'] },
                { required: ['filespecs'] },
              ],
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
                streams: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional stream path filters to query in one command',
                },
                unloaded: {
                  type: 'boolean',
                  description: 'Include unloaded task streams using -U (optional)',
                },
                filter: {
                  type: 'string',
                  description: 'Stream filter expression for -F (optional)',
                },
                viewMatch: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'One or more depot paths to pass with --viewmatch (optional)',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to search in (optional)',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to list in one command (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
                },
                allRevisions: {
                  type: 'boolean',
                  description: 'Display all revisions in range using -a (optional)',
                },
                archiveDepot: {
                  type: 'boolean',
                  description: 'Include files in archive depots using -A (optional)',
                },
                existingOnly: {
                  type: 'boolean',
                  description: 'Show only revisions available for sync/integrate using -e (optional)',
                },
                ignoreCase: {
                  type: 'boolean',
                  description: 'Ignore case of the file argument using -i (optional)',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to list directories for in one command (optional)',
                },
                ignoreCase: {
                  type: 'boolean',
                  description: 'Ignore case using -i (optional; incompatible with onlyClientMapped)',
                },
                onlyClientMapped: {
                  type: 'boolean',
                  description: 'List only directories in the current client view using -C (optional)',
                },
                includeDeleted: {
                  type: 'boolean',
                  description: 'Include directories containing only deleted files using -D (optional)',
                },
                onlyHave: {
                  type: 'boolean',
                  description: 'List directories containing files synced to the current workspace using -H (optional)',
                },
                stream: {
                  type: 'string',
                  description: 'Limit to directories mapped in a stream view using -S (optional)',
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
                users: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Specific users to show in one command (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Maximum number of results (optional)',
                },
                includeServiceUsers: {
                  type: 'boolean',
                  description: 'Include service and operator users using -a (optional)',
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
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional file/filespec filters for jobs',
                },
                jobView: {
                  type: 'string',
                  description: 'Jobview expression for -e (optional)',
                },
                includeIntegrated: {
                  type: 'boolean',
                  description: 'Include fixes from integrated changelists using -i (optional)',
                },
                reverseOrder: {
                  type: 'boolean',
                  description: 'Reverse job sort order using -r (optional)',
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
                files: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Optional file/filespec filters for fixes',
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
                filespec: {
                  type: 'string',
                  description: 'Single filespec filter for labels containing matching files (optional)',
                },
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Multiple filespec filters for labels in one command (optional)',
                },
                nameFilter: {
                  type: 'string',
                  description: 'Label name filter using -e (optional)',
                },
                caseInsensitiveNameFilter: {
                  type: 'string',
                  description: 'Case-insensitive label name filter using -E (optional)',
                },
                unloaded: {
                  type: 'boolean',
                  description: 'List unloaded labels using -U (optional)',
                },
                autoreloadOnly: {
                  type: 'boolean',
                  description: 'List only autoreload labels using -R (optional)',
                },
                allServers: {
                  type: 'boolean',
                  description: 'List labels across all servers using -a (optional)',
                },
                serverId: {
                  type: 'string',
                  description: 'Limit labels to a specific server using -s (optional)',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to get sizes for in one command (optional)',
                },
                allRevisions: {
                  type: 'boolean',
                  description: 'List all revisions in the range using -a (optional)',
                },
                shelvedOnly: {
                  type: 'boolean',
                  description: 'Display size info for shelved files only using -S (optional)',
                },
                omitLazyCopies: {
                  type: 'boolean',
                  description: 'Omit lazy copies from totals using -z (optional)',
                },
                max: {
                  type: 'number',
                  description: 'Limit output to the first max files using -m (optional)',
                },
                blockSize: {
                  type: 'number',
                  description: 'Round sizes up to a block size in bytes using -b (optional)',
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
                filespecs: {
                  type: 'array',
                  items: { type: 'string' },
                  description: 'Filespecs to check in one command (optional)',
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
        ].map((tool) => ({ ...tool, name: toClientToolName(tool.name) })),
      };
    });

    this.server.setRequestHandler(CallToolRequestSchema, async (request) => {
      const startTime = Date.now();
      const { name, arguments: args } = request.params;
      
      // Normalize tool name: support both dot notation (p4.changes) and underscore (p4_changes)
      const normalizedName = name.replace(/_/g, '.');

      try {
        log.debug(`Calling tool: ${name}${name !== normalizedName ? ` (normalized to ${normalizedName})` : ''}`);

        // Rate limiting check
        const rateLimitResult = this.context.security.checkRateLimit(normalizedName);
        if (!rateLimitResult.allowed) {
          const errorMsg = `Rate limit exceeded for tool ${normalizedName}. Try again after ${new Date(rateLimitResult.resetTime).toISOString()}`;
          log.warn(`Rate limit exceeded: ${normalizedName}`);

          // Audit log the blocked request
          this.context.security.logAuditEntry({
            tool: normalizedName,
            user: 'unknown', // Could be enhanced to extract from P4 config
            client: 'unknown',
            operation: normalizedName,
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
        const execution = await this.executeToolWithCaching(normalizedName, toolArgs);
        const result = execution.result;

        if (WRITE_TOOLS.has(normalizedName) && result && typeof result === 'object' && (result as { ok?: boolean }).ok) {
          this.clearReadCache();
        }

        this.recordToolPerformance(
          normalizedName,
          Date.now() - startTime,
          result,
          execution.cacheStatus,
          this.extractSubcallCounts(result)
        );

        // Audit log successful operation
        this.context.security.logAuditEntry({
          tool: normalizedName,
          user: (result as { configUsed?: { P4USER?: string } } | undefined)?.configUsed?.P4USER || 'unknown',
          client: (result as { configUsed?: { P4CLIENT?: string } } | undefined)?.configUsed?.P4CLIENT || 'unknown',
          operation: normalizedName,
          args: toolArgs,
          result: 'success',
          duration: Date.now() - startTime,
        });

        return this.toTextResponse(result);

      } catch (error) {
        const duration = Date.now() - startTime;
        const errorCode = error instanceof McpError ? error.code : 'INTERNAL_ERROR';

        this.recordToolPerformance(
          normalizedName,
          duration,
          { ok: false, error: { code: String(errorCode) } },
          'uncacheable'
        );

        log.error('Tool execution error:', error);

        // Audit log failed operation
        this.context.security.logAuditEntry({
          tool: normalizedName,
          user: 'unknown', // Could be enhanced to extract from context
          client: 'unknown',
          operation: normalizedName,
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

  async run(transportType: 'stdio' | 'sse' = 'stdio', sseOptions?: SSETransportOptions): Promise<void> {
    if (transportType === 'sse') {
      log.info('Starting MCP Perforce server with SSE transport...');
      const sseManager = new SSETransportManager(this.server, sseOptions);
      await sseManager.start();
      log.info('MCP Perforce server running with SSE transport');
    } else {
      const transport = new StdioServerTransport();
      log.info('Starting MCP Perforce server with stdio transport...');
      await this.server.connect(transport);
      log.info('MCP Perforce server running with stdio transport');
    }
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
  mcp-perforce-server                    Start the MCP server (stdio transport, default)
  mcp-perforce-server --transport=sse    Start with SSE transport (HTTP server)
  mcp-perforce-server --help             Show this help message
  mcp-perforce-server --version          Show version information

Transport Options:
  --transport=stdio       Use stdio transport (default, for IDE/CLI integration)
  --transport=sse         Use SSE transport (HTTP server for web clients)
  
  MCP_TRANSPORT=sse       Environment variable to set transport type

SSE Transport Configuration (only for --transport=sse):
  MCP_SSE_PORT=3000                      HTTP server port (default: 3000)
  MCP_SSE_HOST=0.0.0.0                   HTTP server host (default: 0.0.0.0)
  MCP_SSE_PATH=/mcp                      SSE endpoint path (default: /mcp)
  MCP_SSE_CORS_ORIGIN=*                  CORS origin (default: *)
  MCP_SSE_ENABLE_AUTH=true               Enable Bearer token authentication (default: false)
  MCP_SSE_AUTH_TOKEN=your-secret-token   Authentication token when auth is enabled

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
  P4_RESPONSE_CACHE_TTL_MAP='p4.info=30000,p4.review=2000' Per-tool TTL overrides
  P4_RESPONSE_CACHE_MAX_ENTRIES=400 Max cached responses (default by mode)
  P4_NEGATIVE_CACHE=false     Disable short-lived caching of predictable read errors
  P4_NEGATIVE_CACHE_TTL_MS=5000 Negative-cache TTL in ms
  P4_WORKFLOW_CONCURRENCY=6   Max concurrent subcalls in composite workflow tools
  P4_LOG_PERF_METRICS=true    Enable periodic performance snapshot logs
  P4_LOG_PERF_METRICS_INTERVAL_MS=60000 Performance snapshot interval in ms
  P4_PERF_METRICS_SAMPLE_SIZE=200 Duration sample size per tool for p50/p95

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

  // Determine transport type
  const transportArg = process.argv.find(arg => arg.startsWith('--transport='));
  const transportType = transportArg 
    ? transportArg.split('=')[1] as 'stdio' | 'sse'
    : (process.env.MCP_TRANSPORT as 'stdio' | 'sse') || 'stdio';

  if (transportType !== 'stdio' && transportType !== 'sse') {
    console.error(`Invalid transport type: ${transportType}. Must be 'stdio' or 'sse'.`);
    process.exit(1);
  }

  const server = new MCPPerforceServer();
  server.run(transportType).catch((error) => {
    log.error('Failed to start server:', error);
    process.exit(1);
  });
}

export { MCPPerforceServer };
