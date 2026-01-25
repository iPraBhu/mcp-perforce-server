/**
 * Tool implementations for MCP Perforce server
 */

import { P4Runner, P4RunResult } from '../p4/runner.js';
import { P4Config, P4ServerConfig } from '../p4/config.js';
import * as parse from '../p4/parse.js';

export interface ToolContext {
  runner: P4Runner;
  config: P4Config;
  serverConfig: P4ServerConfig;
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
  if (!args.files || args.files.length === 0) {
    return {
      ok: false,
      command: 'add',
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