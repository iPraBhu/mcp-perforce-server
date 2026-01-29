/**
 * Advanced tool implementations for MCP Perforce server
 */

import { P4Runner, P4RunResult } from '../p4/runner.js';
import { P4Config, P4ServerConfig } from '../p4/config.js';
import { SecurityManager } from '../p4/security.js';
import * as parse from '../p4/parse.js';

export interface ToolContext {
  runner: P4Runner;
  config: P4Config;
  serverConfig: P4ServerConfig;
  security: SecurityManager;
}

/**
 * p4 users - List Perforce users
 */
export async function p4Users(
  context: ToolContext,
  args: { user?: string; max?: number; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  if (args.user) {
    cmdArgs.push(args.user);
  }

  const result = await context.runner.run('users', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseUsersOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 user - Get user information
 */
export async function p4User(
  context: ToolContext,
  args: { user?: string; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.user) {
    cmdArgs.push(args.user);
  }

  const result = await context.runner.run('user', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseUserOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 clients - List all clients (enhanced version)
 */
export async function p4Clients(
  context: ToolContext,
  args: { user?: string; max?: number; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.user) {
    cmdArgs.push('-u', args.user);
  }
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  const result = await context.runner.run('clients', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseClientsOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 client - Get detailed client/workspace information
 */
export async function p4Client(
  context: ToolContext,
  args: { client?: string; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.client) {
    cmdArgs.push(args.client);
  }

  const result = await context.runner.run('client', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseClientOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 jobs - List jobs (if job tracking is enabled)
 */
export async function p4Jobs(
  context: ToolContext,
  args: { job?: string; max?: number; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  if (args.job) {
    cmdArgs.push(args.job);
  }

  const result = await context.runner.run('jobs', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseJobsOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 job - Get job details
 */
export async function p4Job(
  context: ToolContext,
  args: { job: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.job) {
    return {
      ok: false,
      command: 'job',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'job parameter is required',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const result = await context.runner.run('job', [args.job], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseJobOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 fixes - Show which changelists fix which jobs
 */
export async function p4Fixes(
  context: ToolContext,
  args: { job?: string; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.job) {
    cmdArgs.push('-j', args.job);
  }
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }

  const result = await context.runner.run('fixes', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseFixesOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 labels - Work with labeled file sets
 */
export async function p4Labels(
  context: ToolContext,
  args: { label?: string; user?: string; max?: number; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.user) {
    cmdArgs.push('-u', args.user);
  }
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  if (args.label) {
    cmdArgs.push(args.label);
  }

  const result = await context.runner.run('labels', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseLabelsOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 label - Get label details
 */
export async function p4Label(
  context: ToolContext,
  args: { label: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.label) {
    return {
      ok: false,
      command: 'label',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'label parameter is required',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const result = await context.runner.run('label', [args.label], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseLabelOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 sizes - Get file sizes and disk usage statistics
 */
export async function p4Sizes(
  context: ToolContext,
  args: { filespec?: string; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = ['-s', '-z']; // Summary and human readable
  if (args.filespec) {
    cmdArgs.push(args.filespec);
  } else {
    cmdArgs.push('...');
  }

  const result = await context.runner.run('sizes', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseSizesOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 have - List files currently synced in workspace
 */
export async function p4Have(
  context: ToolContext,
  args: { filespec?: string; workspacePath?: string }
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.filespec) {
    cmdArgs.push(args.filespec);
  }

  const result = await context.runner.run('have', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseHaveOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 where - Show depot/local/workspace mappings for files
 */
export async function p4Where(
  context: ToolContext,
  args: { files: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.files || args.files.length === 0) {
    return {
      ok: false,
      command: 'where',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'files parameter is required and must not be empty',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const result = await context.runner.run('where', args.files, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseWhereOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 audit - Get audit log entries for compliance reporting
 */
export async function p4Audit(
  context: ToolContext,
  args: {
    tool?: string;
    user?: string;
    result?: 'success' | 'error' | 'blocked';
    since?: string;
    format?: 'json' | 'csv';
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  // Only allow audit access if audit logging is enabled
  if (!context.security.getComplianceConfig().enableAuditLogging) {
    return {
      ok: false,
      command: 'audit',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_AUDIT_DISABLED',
        message: 'Audit logging is disabled. Set P4_ENABLE_AUDIT_LOGGING=true to enable.',
      },
    };
  }

  const filter: any = {};
  if (args.tool) filter.tool = args.tool;
  if (args.user) filter.user = args.user;
  if (args.result) filter.result = args.result;
  if (args.since) filter.since = new Date(args.since);

  const auditEntries = context.security.getAuditLog(filter);
  const format = args.format || 'json';

  let resultData: any;
  if (format === 'csv') {
    resultData = context.security.exportAuditLog('csv');
  } else {
    resultData = {
      totalEntries: auditEntries.length,
      entries: auditEntries,
      complianceConfig: context.security.getComplianceConfig(),
    };
  }

  return {
    ok: true,
    command: 'audit',
    args: [],
    cwd: process.cwd(),
    configUsed: {},
    result: resultData,
  };
}

/**
 * p4 compliance - Get compliance configuration and status
 */
export async function p4Compliance(
  context: ToolContext,
  args: { workspacePath?: string }
): Promise<P4RunResult> {
  const config = context.security.getComplianceConfig();
  const memoryStatus = context.security.checkMemoryUsage();

  return {
    ok: true,
    command: 'compliance',
    args: [],
    cwd: process.cwd(),
    configUsed: {},
    result: {
      complianceConfig: config,
      memoryStatus: {
        withinLimits: memoryStatus.withinLimits,
        currentUsage: {
          rss: Math.round(memoryStatus.usage.rss / 1024 / 1024),
          heapUsed: Math.round(memoryStatus.usage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(memoryStatus.usage.heapTotal / 1024 / 1024),
        },
        maxMemoryMB: config.maxMemoryMB,
        warnings: memoryStatus.warnings,
      },
      serverConfig: context.serverConfig,
      auditLogStats: config.enableAuditLogging ? {
        totalEntries: context.security.getAuditLog().length,
        retentionDays: config.auditLogRetentionDays,
      } : null,
    },
  };
}
