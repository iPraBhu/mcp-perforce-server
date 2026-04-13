/**
 * Tool implementations for MCP Perforce server
 */

import { P4Runner, P4RunResult } from '../p4/runner.js';
import { P4Config, P4ServerConfig } from '../p4/config.js';
import { SecurityManager } from '../p4/security.js';
import * as parse from '../p4/parse.js';
import { mergeStringArgs, sanitizeStringList } from './arg-utils.js';

export interface ToolContext {
  runner: P4Runner;
  config: P4Config;
  serverConfig: P4ServerConfig;
  security: SecurityManager;
}

/**
 * Input validation utilities
 */
function validateFiles(files: string[]): { valid: boolean; error?: string } {
  if (!Array.isArray(files)) {
    return { valid: false, error: 'files must be an array' };
  }
  if (files.length === 0) {
    return { valid: false, error: 'files array cannot be empty' };
  }
  if (files.length > 1000) {
    return { valid: false, error: 'too many files (maximum 1000)' };
  }
  for (const file of files) {
    if (typeof file !== 'string') {
      return { valid: false, error: 'all files must be strings' };
    }
    if (file.length === 0) {
      return { valid: false, error: 'file paths cannot be empty' };
    }
    if (file.length > 4096) {
      return { valid: false, error: 'file path too long (maximum 4096 characters)' };
    }
    // Enhanced security: Allow legitimate Perforce patterns while blocking dangerous traversal
    // Allow depot paths (//depot/...) and standard relative paths
    if (file.includes('..')) {
      // Allow Perforce depot paths and wildcard patterns
      if (file.startsWith('//') || file.endsWith('/...') || file.endsWith('\\...')) {
        // Valid Perforce depot syntax
      } else if (file.match(/\.\.[\/\\].*[\/\\]\.\./)) {
        // Block multiple traversal attempts like ../../../etc/passwd
        return { valid: false, error: 'dangerous path traversal detected' };
      } else if (file.match(/\.\.[\/\\](etc|usr|var|sys|proc|dev)/)) {
        // Block access to sensitive system directories
        return { valid: false, error: 'access to system directories not allowed' };
      }
      // Single .. is typically safe for normal relative paths
    }
  }
  return { valid: true };
}

function validateChangelist(changelist: string): { valid: boolean; error?: string } {
  if (typeof changelist !== 'string') {
    return { valid: false, error: 'changelist must be a string' };
  }
  if (!/^\d+$/.test(changelist)) {
    return { valid: false, error: 'changelist must be a valid number' };
  }
  const num = parseInt(changelist, 10);
  if (num <= 0 || num > 999999) {
    return { valid: false, error: 'changelist number out of valid range' };
  }
  return { valid: true };
}

function validateWorkspacePath(path?: string): { valid: boolean; error?: string } {
  if (path === undefined) return { valid: true };
  if (typeof path !== 'string') {
    return { valid: false, error: 'workspacePath must be a string' };
  }
  if (path.length > 4096) {
    return { valid: false, error: 'workspacePath too long' };
  }
  return { valid: true };
}

/**
 * p4 info - Get Perforce server and client information
 */
export async function p4Info(
  context: ToolContext,
  args: { workspacePath?: string } = {}
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const result = await context.runner.run('info', [], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  if (result.ok && result.result) {
    // Parse info output into structured format
    result.result = parse.parseInfoOutput(result.result);
  }
  
  // Include config information
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 opened - List opened files
 */
export async function p4Opened(
  context: ToolContext,
  args: { changelist?: string; files?: string[]; workspacePath?: string } = {}
): Promise<P4RunResult> {
  if (args.files) {
    const fileValidation = sanitizeStringList(context.security, args.files, 'filespec', 'files');
    if (!fileValidation.valid) {
      return {
        ok: false,
        command: 'opened',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: fileValidation.error || 'Invalid files',
        },
      };
    }
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  if (args.files && args.files.length > 0) {
    const fileValidation = sanitizeStringList(context.security, args.files, 'filespec', 'files');
    cmdArgs.push(...(fileValidation.values || []));
  }
  
  const result = await context.runner.run('opened', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  if (result.ok && result.result) {
    result.result = parse.parseOpenedOutput(result.result);
  }
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 status - Get status of opened files and pending changes 
 */
export async function p4Status(
  context: ToolContext,
  args: { workspacePath?: string } = {}
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  // Run both read commands in parallel for lower status latency
  const openedPromise = context.runner.run('opened', [], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  const changesPromise = context.runner.run('changes', ['-s', 'pending', '-c', env.P4CLIENT || ''], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  const [openedResult, changesResult] = await Promise.all([openedPromise, changesPromise]);

  let openedFiles: any[] = [];
  if (openedResult.ok && openedResult.result) {
    openedFiles = parse.parseOpenedOutput(openedResult.result);
  }
  
  let pendingChanges: any[] = [];
  if (changesResult.ok && changesResult.result) {
    pendingChanges = parse.parseChangesOutput(changesResult.result);
  }
  
  const result: P4RunResult = {
    ok: true,
    command: 'status',
    args: [],
    cwd,
    configUsed: {
      ...openedResult.configUsed,
      p4configPath: configResult.configPath,
    },
    result: {
      openedFiles,
      pendingChanges,
      summary: {
        totalOpenedFiles: openedFiles.length,
        totalPendingChanges: pendingChanges.length,
        filesByAction: openedFiles.reduce((acc: any, file: any) => {
          acc[file.action] = (acc[file.action] || 0) + 1;
          return acc;
        }, {}),
      },
    },
  };
  
  if (openedResult.error && !changesResult.ok) {
    result.ok = false;
    result.error = openedResult.error;
  } else if (changesResult.error && !openedResult.ok) {
    result.ok = false;
    result.error = changesResult.error;
  } else if (openedResult.warnings || changesResult.warnings) {
    result.warnings = [...(openedResult.warnings || []), ...(changesResult.warnings || [])];
  }
  
  return result;
}

/**
 * p4 add - Add files to Perforce
 */
export async function p4Add(
  context: ToolContext,
  args: { files: string[]; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  // Validate inputs
  const filesValidation = validateFiles(args.files);
  if (!filesValidation.valid) {
    return {
      ok: false,
      command: 'add',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid files: ${filesValidation.error}`,
      },
    };
  }
  
  if (args.changelist) {
    const changelistValidation = validateChangelist(args.changelist);
    if (!changelistValidation.valid) {
      return {
        ok: false,
        command: 'add',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid changelist: ${changelistValidation.error}`,
        },
      };
    }
  }
  
  const workspaceValidation = validateWorkspacePath(args.workspacePath);
  if (!workspaceValidation.valid) {
    return {
      ok: false,
      command: 'add',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid workspacePath: ${workspaceValidation.error}`,
      },
    };
  }
  
  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'add',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }
  
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(...args.files);
  
  const result = await context.runner.run('add', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 edit - Open files for edit
 */
export async function p4Edit(
  context: ToolContext,
  args: { files: string[]; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.files || args.files.length === 0) {
    return {
      ok: false,
      command: 'edit',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'files parameter is required and must not be empty',
      },
    };
  }
  
  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'edit',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }
  
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(...args.files);
  
  const result = await context.runner.run('edit', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 delete - Mark files for delete
 */
export async function p4Delete(
  context: ToolContext,
  args: { files: string[]; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.files || args.files.length === 0) {
    return {
      ok: false,
      command: 'delete',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'files parameter is required and must not be empty',
      },
    };
  }
  
  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'delete',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }
  
  if (context.serverConfig.disableDelete) {
    return {
      ok: false,
      command: 'delete',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_DELETE_DISABLED',
        message: 'Delete operations are disabled for safety. Set P4_DISABLE_DELETE=false to enable delete operations.',
      },
    };
  }
  
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(...args.files);
  
  const result = await context.runner.run('delete', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 revert - Revert files
 */
export async function p4Revert(
  context: ToolContext,
  args: { files?: string[]; changelist?: string; workspacePath?: string } = {}
): Promise<P4RunResult> {
  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'revert',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  
  if (args.files && args.files.length > 0) {
    cmdArgs.push(...args.files);
  } else {
    cmdArgs.push('...');
  }
  
  const result = await context.runner.run('revert', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 sync - Sync files from depot
 */
export async function p4Sync(
  context: ToolContext,
  args: {
    filespec?: string;
    filespecs?: string[];
    force?: boolean;
    preview?: boolean;
    summaryPreview?: boolean;
    quiet?: boolean;
    metadataOnly?: boolean;
    safeSync?: boolean;
    populateOnly?: boolean;
    reopenMoved?: boolean;
    useListOptimization?: boolean;
    max?: number;
    parallel?: string;
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    if (!filespecValidation.valid) {
      return {
        ok: false,
        command: 'sync',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: filespecValidation.error || 'Invalid filespecs',
        },
      };
    }
  }

  const modeFlags = [args.metadataOnly, args.safeSync, args.populateOnly].filter(Boolean).length;
  if (modeFlags > 1) {
    return {
      ok: false,
      command: 'sync',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'metadataOnly, safeSync, and populateOnly are mutually exclusive',
      },
    };
  }

  if (args.preview && args.summaryPreview) {
    return {
      ok: false,
      command: 'sync',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'preview and summaryPreview cannot both be true',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.force) {
    cmdArgs.push('-f');
  }
  if (args.preview) {
    cmdArgs.push('-n');
  }
  if (args.summaryPreview) {
    cmdArgs.push('-N');
  }
  if (args.quiet) {
    cmdArgs.push('-q');
  }
  if (args.metadataOnly) {
    cmdArgs.push('-k');
  }
  if (args.safeSync) {
    cmdArgs.push('-s');
  }
  if (args.populateOnly) {
    cmdArgs.push('-p');
  }
  if (args.reopenMoved) {
    cmdArgs.push('-r');
  }
  if (args.useListOptimization) {
    cmdArgs.push('-L');
  }
  if (args.max && args.max > 0) {
    cmdArgs.push('-m', args.max.toString());
  }
  if (args.parallel) {
    cmdArgs.push(`--parallel=${args.parallel}`);
  }
  
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    cmdArgs.push(...(filespecValidation.values || []));
  }
  
  const result = await context.runner.run('sync', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  if (result.ok && result.result) {
    result.result = parse.parseSyncOutput(result.result as string);
  }
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 diff - Show differences
 */
export async function p4Diff(
  context: ToolContext,
  args: { files?: string[]; summary?: boolean; workspacePath?: string } = {}
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.summary) {
    cmdArgs.push('-s');
  }
  
  if (args.files && args.files.length > 0) {
    cmdArgs.push(...args.files);
  }
  
  const result = await context.runner.run('diff', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  if (result.ok && result.result) {
    result.result = parse.parseDiffOutput(result.result as string);
  }
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 diff2 - Compare two depot paths server-side (no workspace mapping required)
 */
export async function p4Diff2(
  context: ToolContext,
  args: {
    sourcePath: string;
    targetPath: string;
    summaryOnly?: boolean;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  if (!args.sourcePath || typeof args.sourcePath !== 'string') {
    return {
      ok: false,
      command: 'diff2',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'sourcePath parameter is required and must be a string',
      },
    };
  }

  if (!args.targetPath || typeof args.targetPath !== 'string') {
    return {
      ok: false,
      command: 'diff2',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'targetPath parameter is required and must be a string',
      },
    };
  }

  const workspaceValidation = validateWorkspacePath(args.workspacePath);
  if (!workspaceValidation.valid) {
    return {
      ok: false,
      command: 'diff2',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid workspacePath: ${workspaceValidation.error}`,
      },
    };
  }

  const sourceSanitization = context.security.sanitizeInput(args.sourcePath, 'filespec');
  if (!sourceSanitization.valid) {
    return {
      ok: false,
      command: 'diff2',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid sourcePath: ${sourceSanitization.warnings.join(', ')}`,
      },
    };
  }

  const targetSanitization = context.security.sanitizeInput(args.targetPath, 'filespec');
  if (!targetSanitization.valid) {
    return {
      ok: false,
      command: 'diff2',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid targetPath: ${targetSanitization.warnings.join(', ')}`,
      },
    };
  }

  const summaryOnly = args.summaryOnly !== false;
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (summaryOnly) {
    cmdArgs.push('-q');
  }
  cmdArgs.push(sourceSanitization.sanitized, targetSanitization.sanitized);

  const result = await context.runner.run('diff2', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok) {
    const parsed = parse.parseDiff2Output(result.result, summaryOnly);
    result.result = {
      sourcePath: sourceSanitization.sanitized,
      targetPath: targetSanitization.sanitized,
      ...parsed,
    };
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 resolve - Resolve merge conflicts
 */
export async function p4Resolve(
  context: ToolContext,
  args: {
    files?: string[];
    changelist?: string;
    strategy?: 'accept-theirs' | 'accept-yours' | 'merge' | 'edit' | 'skip';
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'resolve',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }

  // Add strategy flags
  if (args.strategy) {
    switch (args.strategy) {
      case 'accept-theirs':
        cmdArgs.push('-at');
        break;
      case 'accept-yours':
        cmdArgs.push('-ay');
        break;
      case 'merge':
        cmdArgs.push('-am');
        break;
      case 'edit':
        cmdArgs.push('-ae');
        break;
      case 'skip':
        cmdArgs.push('-as');
        break;
    }
  }

  if (args.files && args.files.length > 0) {
    cmdArgs.push(...args.files);
  }

  const result = await context.runner.run('resolve', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseResolveOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 shelve - Shelve files for code review
 */
export async function p4Shelve(
  context: ToolContext,
  args: { changelist: string; files?: string[]; delete?: boolean; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.changelist) {
    return {
      ok: false,
      command: 'shelve',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'changelist parameter is required',
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'shelve',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = ['-c', args.changelist];
  if (args.delete) {
    cmdArgs.push('-d');
  }

  if (args.files && args.files.length > 0) {
    cmdArgs.push(...args.files);
  }

  const result = await context.runner.run('shelve', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseShelveOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 unshelve - Unshelve files from a shelved changelist
 */
export async function p4Unshelve(
  context: ToolContext,
  args: { changelist: string; files?: string[]; force?: boolean; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.changelist) {
    return {
      ok: false,
      command: 'unshelve',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'changelist parameter is required',
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'unshelve',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = ['-c', args.changelist];
  if (args.force) {
    cmdArgs.push('-f');
  }

  if (args.files && args.files.length > 0) {
    cmdArgs.push(...args.files);
  }

  const result = await context.runner.run('unshelve', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseUnshelveOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 changes - List submitted changelists (enhanced version)
 */
export async function p4Changes(
  context: ToolContext,
  args: {
    status?: 'submitted' | 'pending' | 'shelved';
    user?: string;
    client?: string;
    max?: number;
    filespec?: string;
    filespecs?: string[];
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    if (!filespecValidation.valid) {
      return {
        ok: false,
        command: 'changes',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: filespecValidation.error || 'Invalid filespecs',
        },
      };
    }
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];

  // Add status filter
  if (args.status) {
    cmdArgs.push('-s', args.status);
  }

  // Add user filter
  if (args.user) {
    cmdArgs.push('-u', args.user);
  }

  // Add client filter
  if (args.client) {
    cmdArgs.push('-c', args.client);
  }

  // Add max results
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  // Add filespec
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    cmdArgs.push(...(filespecValidation.values || []));
  }

  const result = await context.runner.run('changes', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  // Defensive programming: ensure result.result is properly handled
  if (result.ok && result.result !== null && result.result !== undefined) {
    // Additional safety check to ensure result.result is a string before parsing
    if (typeof result.result === 'string' && result.result.trim().length > 0) {
      try {
        result.result = parse.parseChangesOutput(result.result);
      } catch (parseError) {
        // If parsing fails, return raw result with warning
        result.warnings = result.warnings || [];
        const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
        result.warnings.push(`Parse warning: ${errorMessage}`);
        // Keep the raw result instead of failing completely
      }
    } else {
      // If result is not a string or is empty, return empty array
      result.result = [];
    }
  } else if (result.ok) {
    // If result.ok is true but result.result is null/undefined, return empty array
    result.result = [];
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 review - List changelists pending review
 */
export async function p4Review(
  context: ToolContext,
  args: {
    counter?: string;
    filespec?: string;
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  if (args.counter && !/^\d+$/.test(args.counter)) {
    return {
      ok: false,
      command: 'review',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'counter must be a numeric string',
      },
    };
  }

  let sanitizedFilespec: string | undefined;
  if (args.filespec) {
    const filespecSanitization = context.security.sanitizeInput(args.filespec, 'filespec');
    if (!filespecSanitization.valid) {
      return {
        ok: false,
        command: 'review',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid filespec: ${filespecSanitization.warnings.join(', ')}`,
        },
      };
    }
    sanitizedFilespec = filespecSanitization.sanitized;
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  const cmdArgs: string[] = [];
  if (args.counter) {
    cmdArgs.push('-t', args.counter);
  }
  if (sanitizedFilespec) {
    cmdArgs.push(sanitizedFilespec);
  }

  const result = await context.runner.run('review', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result !== null && result.result !== undefined) {
    if (typeof result.result === 'string' && result.result.trim().length > 0) {
      result.result = parse.parseReviewOutput(result.result);
    } else {
      result.result = [];
    }
  } else if (result.ok) {
    result.result = [];
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 reviews - List users who review specified files/changelists
 */
export async function p4Reviews(
  context: ToolContext,
  args: {
    files?: string[];
    changelist?: string;
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  if (args.files) {
    const filesValidation = validateFiles(args.files);
    if (!filesValidation.valid) {
      return {
        ok: false,
        command: 'reviews',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid files: ${filesValidation.error}`,
        },
      };
    }
  }

  if (args.changelist) {
    const changelistValidation = validateChangelist(args.changelist);
    if (!changelistValidation.valid) {
      return {
        ok: false,
        command: 'reviews',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid changelist: ${changelistValidation.error}`,
        },
      };
    }
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  if (args.files && args.files.length > 0) {
    cmdArgs.push(...args.files);
  }

  const result = await context.runner.run('reviews', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result !== null && result.result !== undefined) {
    if (typeof result.result === 'string' && result.result.trim().length > 0) {
      result.result = parse.parseReviewsOutput(result.result);
    } else {
      result.result = [];
    }
  } else if (result.ok) {
    result.result = [];
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 interchanges - List changelists not yet integrated between paths
 */
export async function p4Interchanges(
  context: ToolContext,
  args: {
    sourcePath?: string;
    targetPath?: string;
    targetPaths?: string[];
    branch?: string;
    stream?: string;
    parentStream?: string;
    useBranchSource?: boolean;
    max?: number;
    longDescription?: boolean;
    reverse?: boolean;
    time?: boolean;
    user?: string;
    forceStreamFlow?: boolean;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  const targetPaths = mergeStringArgs(args.targetPath, args.targetPaths);
  const usingPathMode = !args.branch && !args.stream && !!args.sourcePath && targetPaths.length > 0;
  const modeCount = [usingPathMode, !!args.branch, !!args.stream].filter(Boolean).length;
  if (modeCount !== 1) {
    return {
      ok: false,
      command: 'interchanges',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'Provide exactly one interchanges mode: sourcePath+targetPath(s), branch, or stream',
      },
    };
  }

  if (args.useBranchSource && !args.branch) {
    return {
      ok: false,
      command: 'interchanges',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'useBranchSource requires branch mode',
      },
    };
  }

  if (args.parentStream && !args.stream) {
    return {
      ok: false,
      command: 'interchanges',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'parentStream requires stream mode',
      },
    };
  }

  if (args.forceStreamFlow && !args.stream) {
    return {
      ok: false,
      command: 'interchanges',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'forceStreamFlow requires stream mode',
      },
    };
  }

  let sourceSanitized: string | undefined;
  if (args.sourcePath) {
    const sourceSanitization = context.security.sanitizeInput(args.sourcePath, 'filespec');
    if (!sourceSanitization.valid) {
      return {
        ok: false,
        command: 'interchanges',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid sourcePath: ${sourceSanitization.warnings.join(', ')}`,
        },
      };
    }
    sourceSanitized = sourceSanitization.sanitized;
  }

  const targetValidation = targetPaths.length > 0
    ? sanitizeStringList(context.security, targetPaths, 'filespec', 'targetPaths')
    : { valid: true, values: [] as string[] };
  if (!targetValidation.valid) {
    return {
      ok: false,
      command: 'interchanges',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: targetValidation.error || 'Invalid targetPaths',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  const cmdArgs: string[] = [];
  if (args.longDescription) {
    cmdArgs.push('-l');
  }
  if (args.max && args.max > 0) {
    cmdArgs.push('-m', args.max.toString());
  }
  if (args.reverse) {
    cmdArgs.push('-r');
  }
  if (args.time) {
    cmdArgs.push('-t');
  }
  if (args.user) {
    cmdArgs.push('-u', args.user);
  }

  if (args.stream) {
    cmdArgs.push('-S', args.stream);
    if (args.parentStream) {
      cmdArgs.push('-P', args.parentStream);
    }
    if (args.forceStreamFlow) {
      cmdArgs.push('-F');
    }
    if (targetValidation.values && targetValidation.values.length > 0) {
      cmdArgs.push(...targetValidation.values);
    }
  } else if (args.branch) {
    cmdArgs.push('-b', args.branch);
    if (args.useBranchSource) {
      if (!sourceSanitized) {
        return {
          ok: false,
          command: 'interchanges',
          args: [],
          cwd: process.cwd(),
          configUsed: {},
          error: {
            code: 'P4_INVALID_ARGS',
            message: 'sourcePath is required when useBranchSource is true',
          },
        };
      }
      cmdArgs.push('-s', sourceSanitized);
      if (targetValidation.values && targetValidation.values.length > 0) {
        cmdArgs.push(...targetValidation.values);
      }
    } else if (targetValidation.values && targetValidation.values.length > 0) {
      cmdArgs.push(...targetValidation.values);
    }
  } else {
    cmdArgs.push(sourceSanitized as string, ...(targetValidation.values || []));
  }

  const result = await context.runner.run('interchanges', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result !== null && result.result !== undefined) {
    if (typeof result.result === 'string' && result.result.trim().length > 0) {
      result.result = parse.parseInterchangesOutput(result.result);
    } else {
      result.result = [];
    }
  } else if (result.ok) {
    result.result = [];
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 integrated - Show integration history between paths
 */
export async function p4Integrated(
  context: ToolContext,
  args: { sourcePath?: string; targetPath?: string; files?: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.sourcePath && (!args.files || args.files.length === 0)) {
    return {
      ok: false,
      command: 'integrated',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'sourcePath or files parameter is required',
      },
    };
  }

  let sourceSanitized: string | undefined;
  if (args.sourcePath) {
    const sourceSanitization = context.security.sanitizeInput(args.sourcePath, 'filespec');
    if (!sourceSanitization.valid) {
      return {
        ok: false,
        command: 'integrated',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid sourcePath: ${sourceSanitization.warnings.join(', ')}`,
        },
      };
    }
    sourceSanitized = sourceSanitization.sanitized;
  }

  let targetSanitized: string | undefined;
  if (args.targetPath) {
    const targetSanitization = context.security.sanitizeInput(args.targetPath, 'filespec');
    if (!targetSanitization.valid) {
      return {
        ok: false,
        command: 'integrated',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: `Invalid targetPath: ${targetSanitization.warnings.join(', ')}`,
        },
      };
    }
    targetSanitized = targetSanitization.sanitized;
  }

  let filesSanitized: string[] = [];
  if (args.files && args.files.length > 0) {
    const fileValidation = sanitizeStringList(context.security, args.files, 'filespec', 'files');
    if (!fileValidation.valid) {
      return {
        ok: false,
        command: 'integrated',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: fileValidation.error || 'Invalid files',
        },
      };
    }
    filesSanitized = fileValidation.values || [];
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  const cmdArgs: string[] = [];
  if (sourceSanitized) {
    cmdArgs.push(sourceSanitized);
    if (targetSanitized) {
      cmdArgs.push(targetSanitized);
    }
  }
  if (filesSanitized.length > 0) {
    cmdArgs.push(...filesSanitized);
  }

  const result = await context.runner.run('integrated', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result !== null && result.result !== undefined) {
    if (typeof result.result === 'string' && result.result.trim().length > 0) {
      result.result = parse.parseIntegratedOutput(result.result);
    } else {
      result.result = [];
    }
  } else if (result.ok) {
    result.result = [];
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 blame - Show file annotations with change history
 */
export async function p4Blame(
  context: ToolContext,
  args: { file?: string; files?: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  const files = mergeStringArgs(args.file, args.files);
  if (files.length === 0) {
    return {
      ok: false,
      command: 'blame',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'file or files parameter is required',
      },
    };
  }

  const fileValidation = sanitizeStringList(context.security, files, 'filespec', 'files');
  if (!fileValidation.valid) {
    return {
      ok: false,
      command: 'blame',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: fileValidation.error || 'Invalid files',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const result = await context.runner.run('annotate', ['-a', ...(fileValidation.values || [])], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseBlameOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 annotate - Alias for line-by-line annotation
 */
export async function p4Annotate(
  context: ToolContext,
  args: { file?: string; files?: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  const result = await p4Blame(context, args);
  if (result.command === 'blame') {
    result.command = 'annotate';
  }
  return result;
}

/**
 * p4 copy - Copy files between locations
 */
export async function p4Copy(
  context: ToolContext,
  args: { source: string; destination: string; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.source || !args.destination) {
    return {
      ok: false,
      command: 'copy',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'source and destination parameters are required',
      },
    };
  }

  // Input sanitization for source and destination
  const sourceSanitization = context.security.sanitizeInput(args.source, 'filespec');
  const destSanitization = context.security.sanitizeInput(args.destination, 'filespec');

  if (!sourceSanitization.valid) {
    return {
      ok: false,
      command: 'copy',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid source: ${sourceSanitization.warnings.join(', ')}`,
      },
    };
  }

  if (!destSanitization.valid) {
    return {
      ok: false,
      command: 'copy',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid destination: ${destSanitization.warnings.join(', ')}`,
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'copy',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(sourceSanitization.sanitized, destSanitization.sanitized);

  const result = await context.runner.run('copy', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseCopyOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 move - Move/rename files
 */
export async function p4Move(
  context: ToolContext,
  args: { source: string; destination: string; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.source || !args.destination) {
    return {
      ok: false,
      command: 'move',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'source and destination parameters are required',
      },
    };
  }

  // Input sanitization for source and destination
  const sourceSanitization = context.security.sanitizeInput(args.source, 'filespec');
  const destSanitization = context.security.sanitizeInput(args.destination, 'filespec');

  if (!sourceSanitization.valid) {
    return {
      ok: false,
      command: 'move',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid source: ${sourceSanitization.warnings.join(', ')}`,
      },
    };
  }

  if (!destSanitization.valid) {
    return {
      ok: false,
      command: 'move',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid destination: ${destSanitization.warnings.join(', ')}`,
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'move',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(sourceSanitization.sanitized, destSanitization.sanitized);

  const result = await context.runner.run('move', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseMoveOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 grep - Search for text patterns across depot files
 */
export async function p4Grep(
  context: ToolContext,
  args: { pattern: string; filespec?: string; filespecs?: string[]; caseInsensitive?: boolean; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.pattern) {
    return {
      ok: false,
      command: 'grep',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'pattern parameter is required',
      },
    };
  }

  // Input sanitization
  const patternSanitization = context.security.sanitizeInput(args.pattern, 'pattern');
  if (!patternSanitization.valid) {
    return {
      ok: false,
      command: 'grep',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid pattern: ${patternSanitization.warnings.join(', ')}`,
      },
    };
  }

  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    if (!filespecValidation.valid) {
      return {
        ok: false,
        command: 'grep',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: filespecValidation.error || 'Invalid filespecs',
        },
      };
    }
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.caseInsensitive) {
    cmdArgs.push('-i');
  }
  cmdArgs.push('-e', patternSanitization.sanitized);

  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    cmdArgs.push(...(filespecValidation.values || []));
  }

  const result = await context.runner.run('grep', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseGrepOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 files - List files in depot with metadata
 */
export async function p4Files(
  context: ToolContext,
  args: {
    filespec?: string;
    filespecs?: string[];
    max?: number;
    allRevisions?: boolean;
    archiveDepot?: boolean;
    existingOnly?: boolean;
    ignoreCase?: boolean;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    if (!filespecValidation.valid) {
      return {
        ok: false,
        command: 'files',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: filespecValidation.error || 'Invalid filespecs',
        },
      };
    }
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    cmdArgs.push(...(filespecValidation.values || []));
  } else {
    cmdArgs.push('...');
  }

  const result = await context.runner.run('files', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseFilesOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 dirs - List directories in depot
 */
export async function p4Dirs(
  context: ToolContext,
  args: {
    filespec?: string;
    filespecs?: string[];
    ignoreCase?: boolean;
    onlyClientMapped?: boolean;
    includeDeleted?: boolean;
    onlyHave?: boolean;
    stream?: string;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    if (!filespecValidation.valid) {
      return {
        ok: false,
        command: 'dirs',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: filespecValidation.error || 'Invalid filespecs',
        },
      };
    }
  }

  if (args.ignoreCase && args.onlyClientMapped) {
    return {
      ok: false,
      command: 'dirs',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'ignoreCase and onlyClientMapped cannot be combined',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.onlyClientMapped) {
    cmdArgs.push('-C');
  }
  if (args.includeDeleted) {
    cmdArgs.push('-D');
  }
  if (args.onlyHave) {
    cmdArgs.push('-H');
  }
  if (args.stream) {
    cmdArgs.push('-S', args.stream);
  }
  if (args.ignoreCase) {
    cmdArgs.push('-i');
  }
  if (filespecs.length > 0) {
    const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
    cmdArgs.push(...(filespecValidation.values || []));
  } else {
    cmdArgs.push('...');
  }

  const result = await context.runner.run('dirs', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseDirsOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 integrate - Integrate files from source to target
 */
export async function p4Integrate(
  context: ToolContext,
  args: { source: string; target: string; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.source || !args.target) {
    return {
      ok: false,
      command: 'integrate',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'source and target parameters are required',
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'integrate',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const sourceSanitization = context.security.sanitizeInput(args.source, 'filespec');
  const targetSanitization = context.security.sanitizeInput(args.target, 'filespec');
  if (!sourceSanitization.valid || !targetSanitization.valid) {
    return {
      ok: false,
      command: 'integrate',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'Invalid source or target filespec',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(sourceSanitization.sanitized, targetSanitization.sanitized);

  const result = await context.runner.run('integrate', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseIntegrateOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 merge - Merge files from source to target
 */
export async function p4Merge(
  context: ToolContext,
  args: { source: string; target: string; changelist?: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.source || !args.target) {
    return {
      ok: false,
      command: 'merge',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'source and target parameters are required',
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'merge',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_READONLY_MODE',
        message: 'Server is in read-only mode. Set P4_READONLY_MODE=false to enable write operations.',
      },
    };
  }

  const sourceSanitization = context.security.sanitizeInput(args.source, 'filespec');
  const targetSanitization = context.security.sanitizeInput(args.target, 'filespec');
  if (!sourceSanitization.valid || !targetSanitization.valid) {
    return {
      ok: false,
      command: 'merge',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'Invalid source or target filespec',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  cmdArgs.push(sourceSanitization.sanitized, targetSanitization.sanitized);

  const result = await context.runner.run('merge', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseIntegrateOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 print - Print file contents from depot
 */
export async function p4Print(
  context: ToolContext,
  args: { filespec?: string; filespecs?: string[]; quiet?: boolean; workspacePath?: string }
): Promise<P4RunResult> {
  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length === 0) {
    return {
      ok: false,
      command: 'print',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'filespec or filespecs parameter is required',
      },
    };
  }

  const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
  if (!filespecValidation.valid) {
    return {
      ok: false,
      command: 'print',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: filespecValidation.error || 'Invalid filespecs',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.quiet !== false) {
    cmdArgs.push('-q');
  }
  cmdArgs.push(...(filespecValidation.values || []));

  const result = await context.runner.run('print', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parsePrintOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 fstat - Show file metadata from depot/workspace
 */
export async function p4Fstat(
  context: ToolContext,
  args: {
    filespec?: string;
    filespecs?: string[];
    max?: number;
    filter?: string;
    fields?: string[];
    reverseOrder?: boolean;
    attributePattern?: string;
    changeAfter?: string;
    changelist?: string;
    outputOptions?: string[];
    limitOptions?: string[];
    sortOptions?: string[];
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  const filespecs = mergeStringArgs(args.filespec, args.filespecs);
  if (filespecs.length === 0) {
    return {
      ok: false,
      command: 'fstat',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'filespec or filespecs parameter is required',
      },
    };
  }

  const filespecValidation = sanitizeStringList(context.security, filespecs, 'filespec', 'filespecs');
  if (!filespecValidation.valid) {
    return {
      ok: false,
      command: 'fstat',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: filespecValidation.error || 'Invalid filespecs',
      },
    };
  }

  if (args.changeAfter && args.changelist) {
    return {
      ok: false,
      command: 'fstat',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'changeAfter and changelist cannot both be specified',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.filter) {
    cmdArgs.push('-F', args.filter);
  }
  if (args.fields && args.fields.length > 0) {
    cmdArgs.push('-T', args.fields.join(','));
  }
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }
  if (args.reverseOrder) {
    cmdArgs.push('-r');
  }
  if (args.changeAfter) {
    cmdArgs.push('-c', args.changeAfter);
  }
  if (args.changelist) {
    cmdArgs.push('-e', args.changelist);
  }
  if (args.attributePattern) {
    cmdArgs.push('-A', args.attributePattern);
  }
  if (args.outputOptions) {
    for (const option of args.outputOptions) {
      cmdArgs.push(`-O${option}`);
    }
  }
  if (args.limitOptions) {
    for (const option of args.limitOptions) {
      cmdArgs.push(`-R${option}`);
    }
  }
  if (args.sortOptions) {
    for (const option of args.sortOptions) {
      cmdArgs.push(`-S${option}`);
    }
  }
  cmdArgs.push(...(filespecValidation.values || []));

  const result = await context.runner.run('fstat', cmdArgs, cwd, {
    env,
    useZtag: true,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseFstatOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 streams - List streams
 */
export async function p4Streams(
  context: ToolContext,
  args: {
    max?: number;
    stream?: string;
    streams?: string[];
    unloaded?: boolean;
    filter?: string;
    viewMatch?: string[];
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  const streams = mergeStringArgs(args.stream, args.streams);
  if (streams.length > 0) {
    const streamValidation = sanitizeStringList(context.security, streams, 'filespec', 'streams');
    if (!streamValidation.valid) {
      return {
        ok: false,
        command: 'streams',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: streamValidation.error || 'Invalid streams',
        },
      };
    }
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const cmdArgs: string[] = [];
  if (args.unloaded) {
    cmdArgs.push('-U');
  }
  if (args.filter) {
    cmdArgs.push('-F', args.filter);
  }
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }
  if (args.viewMatch) {
    const viewMatchValidation = sanitizeStringList(context.security, args.viewMatch, 'filespec', 'viewMatch');
    if (!viewMatchValidation.valid) {
      return {
        ok: false,
        command: 'streams',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: viewMatchValidation.error || 'Invalid viewMatch',
        },
      };
    }
    for (const viewMatch of viewMatchValidation.values || []) {
      cmdArgs.push('--viewmatch', viewMatch);
    }
  }
  if (streams.length > 0) {
    const streamValidation = sanitizeStringList(context.security, streams, 'filespec', 'streams');
    cmdArgs.push(...(streamValidation.values || []));
  }

  const result = await context.runner.run('streams', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseStreamsOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}

/**
 * p4 stream - Get a stream spec
 */
export async function p4Stream(
  context: ToolContext,
  args: { stream: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.stream) {
    return {
      ok: false,
      command: 'stream',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'stream parameter is required',
      },
    };
  }

  const streamSanitization = context.security.sanitizeInput(args.stream, 'filespec');
  if (!streamSanitization.valid) {
    return {
      ok: false,
      command: 'stream',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: `Invalid stream: ${streamSanitization.warnings.join(', ')}`,
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const result = await context.runner.run('stream', ['-o', streamSanitization.sanitized], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });

  if (result.ok && result.result) {
    result.result = parse.parseStreamOutput(result.result as string);
  }

  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };

  return result;
}
