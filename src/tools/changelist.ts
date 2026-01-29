/**
 * Changelist management tools for MCP Perforce server
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
 * p4 changelist.create - Create a new changelist
 */
export async function p4ChangelistCreate(
  context: ToolContext,
  args: { description: string; files?: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  // Validate description
  if (!args.description || typeof args.description !== 'string') {
    return {
      ok: false,
      command: 'change',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'description parameter is required and must be a string',
      },
    };
  }

  if (args.description.trim() === '') {
    return {
      ok: false,
      command: 'change',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'description parameter must not be empty',
      },
    };
  }

  if (args.description.length > 32767) {
    return {
      ok: false,
      command: 'change',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'description too long (maximum 32767 characters)',
      },
    };
  }

  // Validate files if provided
  if (args.files) {
    if (!Array.isArray(args.files)) {
      return {
        ok: false,
        command: 'change',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: 'files parameter must be an array',
        },
      };
    }

    if (args.files.length > 1000) {
      return {
        ok: false,
        command: 'change',
        args: [],
        cwd: process.cwd(),
        configUsed: {},
        error: {
          code: 'P4_INVALID_ARGS',
          message: 'too many files (maximum 1000)',
        },
      };
    }

    for (const file of args.files) {
      if (typeof file !== 'string' || file.length === 0 || file.length > 4096) {
        return {
          ok: false,
          command: 'change',
          args: [],
          cwd: process.cwd(),
          configUsed: {},
          error: {
            code: 'P4_INVALID_ARGS',
            message: 'invalid file path in files array',
          },
        };
      }
    }
  }

  // Validate workspace path
  if (args.workspacePath && (typeof args.workspacePath !== 'string' || args.workspacePath.length > 4096)) {
    return {
      ok: false,
      command: 'change',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'invalid workspacePath',
      },
    };
  }

  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'change',
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
  
  try {
    // Create changelist spec
    const spec = createChangelistSpec({
      description: args.description,
      files: args.files,
      user: env.P4USER,
      client: env.P4CLIENT,
    });
    
    const result = await context.runner.run('change', ['-i'], cwd, {
      env,
      useZtag: false,
      parseOutput: false,
      stdin: spec,
    });
      
    result.configUsed = {
      ...result.configUsed,
      p4configPath: configResult.configPath,
    };
      
    if (result.ok && result.result) {
      // Parse changelist number from output
      const match = (result.result as string).match(/Change (\d+) created/);
      if (match) {
        result.result = {
          changelist: parseInt(match[1], 10),
          description: args.description,
          message: result.result,
        };
      }
    }
      
    return result;
  } catch (error) {
    return {
      ok: false,
      command: 'change',
      args: ['-i'],
      cwd,
      configUsed: { p4configPath: configResult.configPath },
      error: {
        code: 'P4_COMMAND_FAILED',
        message: `Failed to create changelist: ${error}`,
      },
    };
  }
}

/**
 * p4 changelist.update - Update an existing changelist
 */
export async function p4ChangelistUpdate(
  context: ToolContext,
  args: { changelist: string; description?: string; files?: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.changelist) {
    return {
      ok: false,
      command: 'change',
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
      command: 'change',
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
  
  try {
    // First get the current changelist to preserve existing data
    const describeResult = await context.runner.run('describe', ['-s', args.changelist], cwd, {
      env,
      useZtag: false,
      parseOutput: false,
    });
    
    if (!describeResult.ok) {
      return describeResult;
    }
    
    // Parse current changelist info (simplified)
    const currentDescription = args.description || 'Updated changelist';
    
    // Create updated spec
    const spec = createChangelistSpec({
      changelist: args.changelist,
      description: currentDescription,
      files: args.files,
      user: env.P4USER,
      client: env.P4CLIENT,
    });
    
    const result = await context.runner.run('change', ['-i'], cwd, {
      env,
      useZtag: false,
      parseOutput: false,
      stdin: spec,
    });
      
    result.configUsed = {
      ...result.configUsed,
      p4configPath: configResult.configPath,
    };
      
    if (result.ok && result.result) {
      result.result = {
        changelist: parseInt(args.changelist, 10),
        description: currentDescription,
        message: result.result,
      };
    }
      
    return result;
  } catch (error) {
    return {
      ok: false,
      command: 'change',
      args: ['-i'],
      cwd,
      configUsed: { p4configPath: configResult.configPath },
      error: {
        code: 'P4_COMMAND_FAILED',
        message: `Failed to update changelist: ${error}`,
      },
    };
  }
}

/**
 * p4 changelist.submit - Submit a numbered changelist
 */
export async function p4ChangelistSubmit(
  context: ToolContext,
  args: { changelist: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.changelist) {
    return {
      ok: false,
      command: 'submit',
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
      command: 'submit',
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
  
  const result = await context.runner.run('submit', ['-c', args.changelist], cwd, {
    env,
    useZtag: false,
    parseOutput: false,
  });
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  if (result.ok && result.result) {
    // Parse submit result
    const match = (result.result as string).match(/Change (\d+) submitted/);
    if (match) {
      result.result = {
        changelist: parseInt(match[1], 10),
        message: result.result,
      };
    }
  }
  
  return result;
}

/**
 * p4 submit - Submit default changelist with description
 */
export async function p4Submit(
  context: ToolContext,
  args: { description: string; files?: string[]; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.description || args.description.trim() === '') {
    return {
      ok: false,
      command: 'submit',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'description parameter is required for default changelist submission',
      },
    };
  }
  
  if (context.serverConfig.readOnlyMode) {
    return {
      ok: false,
      command: 'submit',
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
  
  try {
    // Create submit spec
    const spec = createSubmitSpec({
      description: args.description,
      files: args.files,
    });
    
    const result = await context.runner.run('submit', ['-i'], cwd, {
      env,
      useZtag: false,
      parseOutput: false,
      stdin: spec,
    });
      
    result.configUsed = {
      ...result.configUsed,
      p4configPath: configResult.configPath,
    };
      
    if (result.ok && result.result) {
      // Parse submit result
      const match = (result.result as string).match(/Change (\d+) submitted/);
      if (match) {
        result.result = {
          changelist: parseInt(match[1], 10),
          description: args.description,
          message: result.result,
        };
      }
    }
      
    return result;
  } catch (error) {
    return {
      ok: false,
      command: 'submit',
      args: ['-i'],
      cwd,
      configUsed: { p4configPath: configResult.configPath },
      error: {
        code: 'P4_COMMAND_FAILED',
        message: `Failed to submit: ${error}`,
      },
    };
  }
}

/**
 * p4 describe - Describe a changelist
 */
export async function p4Describe(
  context: ToolContext,
  args: { changelist: string; workspacePath?: string }
): Promise<P4RunResult> {
  if (!args.changelist) {
    return {
      ok: false,
      command: 'describe',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'changelist parameter is required',
      },
    };
  }
  
  const { cwd, env, configResult } = await context.config.setupForCommand(args.workspacePath);
  
  const result = await context.runner.run('describe', ['-s', args.changelist], cwd, {
    env,
    useZtag: true,
    parseOutput: true,
  });
  
  if (result.ok && result.result) {
    result.result = parse.parseZtagOutput(result.result as string);
  }
  
  result.configUsed = {
    ...result.configUsed,
    p4configPath: configResult.configPath,
  };
  
  return result;
}

/**
 * Create a changelist specification string
 */
function createChangelistSpec(options: {
  changelist?: string;
  description: string;
  files?: string[];
  user?: string;
  client?: string;
}): string {
  const lines = [
    '# A Perforce Change Specification.',
    '#',
    '# Change: The change number. \'new\' on a new changelist.',
    '# Date: The date this specification was last modified.',
    '# Client: The client on which the changelist was created.',
    '# User: The user who created the changelist.',
    '# Status: Either \'pending\' or \'submitted\'.',
    '# Description: Comments about the changelist.',
    '# Files: What opened files from the default changelist are to be added',
    '#\tto this changelist. You may delete files from this list.',
    '',
    `Change:\t${options.changelist || 'new'}`,
    '',
    `Client:\t${options.client || 'unknown'}`,
    '',
    `User:\t${options.user || 'unknown'}`,
    '',
    'Status:\tnew',
    '',
    'Description:',
    `\t${options.description}`,
    '',
    'Files:',
  ];
  
  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      lines.push(`\t${file}`);
    }
  }
  
  return lines.join('\n');
}

/**
 * Create a submit specification string
 */
function createSubmitSpec(options: {
  description: string;
  files?: string[];
}): string {
  const lines = [
    '# A Perforce Submit Specification.',
    '#',
    '# Change: The change number. \'new\' on a new changelist.',
    '# Description: Comments about the changelist.',
    '# Files: What opened files from the default changelist are to be',
    '#\tsubmitted. You may delete files from this list.',
    '',
    'Change:\tnew',
    '',
    'Description:',
    `\t${options.description}`,
    '',
    'Files:',
  ];
  
  if (options.files && options.files.length > 0) {
    for (const file of options.files) {
      lines.push(`\t${file}`);
    }
  }
  
  return lines.join('\n');
}