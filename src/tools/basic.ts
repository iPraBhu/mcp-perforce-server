/**
 * Tool implementations for MCP Perforce server
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
    // Basic path traversal protection
    if (file.includes('..') || file.startsWith('/') || file.match(/^[A-Za-z]:/)) {
      return { valid: false, error: 'invalid file path' };
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
    parseOutput: true,
  });
  
  if (result.ok && result.result) {
    // Parse info output into structured format
    result.result = parse.parseInfoOutput(result.result as string);
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
  args: { changelist?: string; workspacePath?: string } = {}
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.changelist) {
    cmdArgs.push('-c', args.changelist);
  }
  
  const result = await context.runner.run('opened', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
  });
  
  if (result.ok && result.result) {
    result.result = parse.parseOpenedOutput(result.result as string);
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
  
  // Get opened files
  const openedResult = await context.runner.run('opened', [], cwd, {
    env,
    useZtag: false,
    parseOutput: true,
  });
  
  let openedFiles: any[] = [];
  if (openedResult.ok && openedResult.result) {
    openedFiles = parse.parseOpenedOutput(openedResult.result as string);
  }
  
  // Get pending changes
  const changesResult = await context.runner.run('changes', ['-s', 'pending', '-c', env.P4CLIENT || ''], cwd, {
    env,
    useZtag: false,
    parseOutput: true,
  });
  
  let pendingChanges: any[] = [];
  if (changesResult.ok && changesResult.result) {
    pendingChanges = parse.parseChangesOutput(changesResult.result as string);
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
  args: { filespec?: string; force?: boolean; preview?: boolean; workspacePath?: string } = {}
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.force) {
    cmdArgs.push('-f');
  }
  if (args.preview) {
    cmdArgs.push('-n');
  }
  
  if (args.filespec) {
    cmdArgs.push(args.filespec);
  }
  
  const result = await context.runner.run('sync', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
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
    parseOutput: true,
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
    parseOutput: true,
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
    parseOutput: true,
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
    parseOutput: true,
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
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
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
  if (args.filespec) {
    cmdArgs.push(args.filespec);
  }

  const result = await context.runner.run('changes', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
  });

  if (result.ok && result.result) {
    result.result = parse.parseChangesOutput(result.result as string);
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
  args: { file: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.file) {
    return {
      ok: false,
      command: 'blame',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'file parameter is required',
      },
    };
  }

  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);

  const result = await context.runner.run('blame', ['-a', args.file], cwd, {
    env,
    useZtag: false,
    parseOutput: true,
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
    parseOutput: true,
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
    parseOutput: true,
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
  args: { pattern: string; filespec?: string; caseInsensitive?: boolean; workspacePath?: string }
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

  let sanitizedFilespec = args.filespec;
  if (args.filespec) {
    const filespecSanitization = context.security.sanitizeInput(args.filespec, 'filespec');
    if (!filespecSanitization.valid) {
      return {
        ok: false,
        command: 'grep',
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
  if (args.caseInsensitive) {
    cmdArgs.push('-i');
  }
  cmdArgs.push('-n', patternSanitization.sanitized);

  if (sanitizedFilespec) {
    cmdArgs.push(sanitizedFilespec);
  }

  const result = await context.runner.run('grep', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
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
  args: { filespec?: string; max?: number; workspacePath?: string }
): Promise<P4RunResult> {
  // Input sanitization for filespec
  let sanitizedFilespec = args.filespec || '...';
  if (args.filespec) {
    const filespecSanitization = context.security.sanitizeInput(args.filespec, 'filespec');
    if (!filespecSanitization.valid) {
      return {
        ok: false,
        command: 'files',
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
  if (args.max) {
    cmdArgs.push('-m', args.max.toString());
  }

  cmdArgs.push(sanitizedFilespec);

  const result = await context.runner.run('files', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
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
  args: { filespec?: string; workspacePath?: string }
): Promise<P4RunResult> {
  // Input sanitization for filespec
  let sanitizedFilespec = args.filespec || '...';
  if (args.filespec) {
    const filespecSanitization = context.security.sanitizeInput(args.filespec, 'filespec');
    if (!filespecSanitization.valid) {
      return {
        ok: false,
        command: 'dirs',
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
  cmdArgs.push(sanitizedFilespec);

  const result = await context.runner.run('dirs', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
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