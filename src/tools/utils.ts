/**
 * Additional utility tools for MCP Perforce server
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
 * p4 filelog - Show file history
 */
export async function p4Filelog(
  context: ToolContext,
  args: { filespec: string; maxRevisions?: number; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.filespec) {
    return {
      ok: false,
      command: 'filelog',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'filespec parameter is required',
      },
    };
  }
  
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.maxRevisions && args.maxRevisions > 0) {
    cmdArgs.push('-m', args.maxRevisions.toString());
  }
  cmdArgs.push(args.filespec);
  
  const result = await context.runner.run('filelog', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
  });
  
  if (result.ok && result.result) {
    result.result = parse.parseFilelogOutput(result.result as string);
  }
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * p4 clients - List Perforce clients/workspaces
 */
export async function p4Clients(
  context: ToolContext,
  args: { user?: string; workspacePath?: string } = {}
): Promise<P4RunResult> {
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const cmdArgs: string[] = [];
  if (args.user) {
    cmdArgs.push('-u', args.user);
  }
  
  const result = await context.runner.run('clients', cmdArgs, cwd, {
    env,
    useZtag: false,
    parseOutput: true,
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
 * p4.config.detect - Detect and show Perforce configuration
 */
export async function p4ConfigDetect(
  context: ToolContext,
  args: { workspacePath?: string } = {}
): Promise<P4RunResult> {
  const startPath = args.workspacePath || process.cwd();
  
  try {
    const configResult = await context.config.findConfig(startPath);
    const validation = context.config.validateEnvironment(configResult);
    
    const result: P4RunResult = {
      ok: true,
      command: 'config.detect',
      args: [],
      cwd: startPath,
      configUsed: {
        p4configPath: configResult.configPath,
        ...configResult.environment,
      },
      result: {
        found: configResult.found,
        configPath: configResult.configPath,
        projectRoot: configResult.projectRoot,
        config: configResult.config,
        environment: configResult.environment,
        validation: {
          valid: validation.valid,
          errors: validation.errors,
        },
        searchPath: startPath,
      },
    };
    
    if (!validation.valid) {
      result.warnings = validation.errors;
    }
    
    return result;
  } catch (error) {
    return {
      ok: false,
      command: 'config.detect',
      args: [],
      cwd: startPath,
      configUsed: {},
      error: {
        code: 'P4_CONFIG_NOT_FOUND',
        message: `Failed to detect configuration: ${error}`,
      },
    };
  }
}