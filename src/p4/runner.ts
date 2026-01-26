import { spawn, SpawnOptions } from 'child_process';
import * as path from 'path';
import * as os from 'os';

export interface P4RunResult {
  ok: boolean;
  command: string;
  args: string[];
  cwd: string;
  configUsed: {
    p4configPath?: string;
    P4PORT?: string;
    P4USER?: string;
    P4CLIENT?: string;
    P4CHARSET?: string;
    [key: string]: string | undefined;
  };
  result?: any;
  warnings?: string[];
  error?: {
    code: string;
    message: string;
    details?: any;
    stderr?: string;
    exitCode?: number;
  };
}

export interface P4RunOptions {
  timeout?: number;
  env?: Record<string, string>;
  parseOutput?: boolean;
  useZtag?: boolean;
  useMarshalled?: boolean;
  maxMemoryMB?: number;
}

export class P4Runner {
  private static readonly DEFAULT_TIMEOUT = 60000; // 60 seconds
  private readonly p4Path: string;

  constructor() {
    // Support P4_PATH environment variable override
    this.p4Path = process.env.P4_PATH || (os.platform() === 'win32' ? 'p4.exe' : 'p4');
  }

  async run(
    command: string,
    args: string[] = [],
    cwd: string = process.cwd(),
    options: P4RunOptions = {}
  ): Promise<P4RunResult> {
    const {
      timeout = P4Runner.DEFAULT_TIMEOUT,
      env = {},
      parseOutput = true,
      useZtag = false,
      useMarshalled = false,
      maxMemoryMB = parseInt(process.env.P4_MAX_MEMORY_MB || '512'),
    } = options;

    // Check memory limits before starting
    const memUsage = process.memoryUsage();
    const currentMemoryMB = memUsage.rss / 1024 / 1024;

    if (currentMemoryMB > maxMemoryMB) {
      return {
        ok: false,
        command: this.p4Path,
        args: [command, ...args],
        cwd,
        configUsed: {},
        error: {
          code: 'P4_MEMORY_LIMIT',
          message: `Memory limit exceeded: ${currentMemoryMB.toFixed(1)}MB > ${maxMemoryMB}MB`,
        },
      };
    }

    // Build full command args
    const fullArgs: string[] = [];
    
    // Add global flags for non-interactive operation
    fullArgs.push('-s'); // Script mode - suppress info messages
    
    if (useMarshalled && this.supportsMarshalled()) {
      fullArgs.push('-G'); // Marshaled output
    } else if (useZtag) {
      fullArgs.push('-ztag'); // Tagged output
    }

    // Add the command
    fullArgs.push(command);
    
    // Add command-specific args
    fullArgs.push(...args);

    // Set up environment
    const processEnv = {
      ...process.env,
      ...env,
      // Ensure P4CONFIG is set for .p4config detection
      P4CONFIG: env.P4CONFIG || process.env.P4CONFIG || '.p4config',
    };

    const result: P4RunResult = {
      ok: false,
      command: this.p4Path,
      args: fullArgs,
      cwd,
      configUsed: this.extractConfigFromEnv(processEnv),
    };

    try {
      const { stdout, stderr, exitCode } = await this.spawnP4Process(fullArgs, {
        cwd,
        env: processEnv,
        timeout,
      });

      if (exitCode === 0) {
        result.ok = true;
        if (parseOutput && stdout.trim()) {
          result.result = this.parseOutput(stdout, useZtag, useMarshalled);
        } else {
          result.result = stdout.trim() || null;
        }
        
        // Check for warnings in stderr
        if (stderr.trim()) {
          result.warnings = stderr.split('\n').filter(line => line.trim());
        }
      } else {
        result.error = this.mapError(exitCode, stderr, stdout);
      }

    } catch (error) {
      result.error = this.mapError(-1, String(error), '');
    }

    return result;
  }

  private async spawnP4Process(
    args: string[],
    options: { cwd: string; env: Record<string, string | undefined>; timeout: number }
  ): Promise<{ stdout: string; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        cwd: options.cwd,
        env: options.env,
        shell: false, // Critical: avoid shell on Windows
        windowsHide: true,
        stdio: ['ignore', 'pipe', 'pipe'], // Hide stdin, capture stdout/stderr
        detached: false, // Keep attached to parent process
      };

      const child = spawn(this.p4Path, args, spawnOptions);
      
      let stdout = '';
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Set up timeout
      if (options.timeout > 0) {
        timeoutHandle = setTimeout(() => {
          child.kill('SIGTERM');
          reject(new Error(`Command timeout after ${options.timeout}ms`));
        }, options.timeout);
      }

      // Collect output
      child.stdout?.on('data', (data: Buffer) => {
        stdout += data.toString();
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        resolve({
          stdout,
          stderr,
          exitCode: code ?? -1,
        });
      });

      child.on('error', (error: Error) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        reject(error);
      });
    });
  }

  private parseOutput(output: string, useZtag: boolean, useMarshalled: boolean): any {
    if (!output.trim()) {
      return null;
    }

    try {
      if (useMarshalled) {
        // Parse marshaled output (binary format) - simplified parsing
        // In practice, you'd use a proper marshaling library
        return this.parseMarshaled(output);
      } else if (useZtag) {
        return this.parseZtagOutput(output);
      } else {
        // Try to parse as structured text
        return this.parseTextOutput(output);
      }
    } catch (error) {
      // If parsing fails, return raw output
      return output;
    }
  }

  private parseZtagOutput(output: string): any[] {
    const results: any[] = [];
    const lines = output.split('\n');
    let currentRecord: any = {};
    
    for (const line of lines) {
      const trimmedLine = line.trim();
      if (!trimmedLine) {
        if (Object.keys(currentRecord).length > 0) {
          results.push(currentRecord);
          currentRecord = {};
        }
        continue;
      }

      const match = trimmedLine.match(/^\.\.\. (\w+)\s+(.*)$/);
      if (match) {
        const [, key, value] = match;
        currentRecord[key] = value;
      }
    }
    
    if (Object.keys(currentRecord).length > 0) {
      results.push(currentRecord);
    }
    
    return results.length === 1 ? results[0] : results;
  }

  private parseMarshaled(output: string): any {
    // Simplified marshaled parsing - in production, use proper library
    // This is a placeholder implementation
    return { raw: output, note: 'Marshaled parsing not fully implemented' };
  }

  private parseTextOutput(output: string): any {
    const lines = output.split('\n').filter(line => line.trim());
    
    // Try to detect structured output patterns
    if (lines.some(line => line.includes(': '))) {
      const result: any = {};
      for (const line of lines) {
        const colonIndex = line.indexOf(': ');
        if (colonIndex > 0) {
          const key = line.substring(0, colonIndex).trim();
          const value = line.substring(colonIndex + 2).trim();
          result[key] = value;
        }
      }
      return Object.keys(result).length > 0 ? result : lines;
    }
    
    return lines;
  }

  private supportsMarshalled(): boolean {
    // Check if marshaled output is supported for this command
    // Most p4 commands support -G but some don't
    return true; // Simplified - in practice, maintain a whitelist
  }

  private extractConfigFromEnv(env: Record<string, string | undefined>): Record<string, string | undefined> {
    const configKeys = ['P4PORT', 'P4USER', 'P4CLIENT', 'P4CHARSET', 'P4PASSWD'];
    const config: Record<string, string | undefined> = {};
    
    for (const key of configKeys) {
      if (env[key]) {
        // Mask password in logs
        config[key] = key === 'P4PASSWD' ? '***masked***' : env[key];
      }
    }
    
    return config;
  }

  private mapError(exitCode: number, stderr: string, stdout: string): P4RunResult['error'] {
    const errorMessage = stderr || stdout || 'Unknown error';
    
    // Map common Perforce error patterns to stable error codes
    if (errorMessage.includes('Perforce client error') || exitCode === 127 || exitCode === -1) {
      return {
        code: 'P4_NOT_FOUND',
        message: 'Perforce executable not found or not accessible',
        details: { stderr: errorMessage, exitCode },
        stderr,
        exitCode,
      };
    }
    
    if (errorMessage.includes('Perforce password') || errorMessage.includes('Access denied')) {
      return {
        code: 'P4_AUTH_FAILED',
        message: 'Perforce authentication failed',
        details: { stderr: errorMessage, exitCode },
        stderr,
        exitCode,
      };
    }
    
    if (errorMessage.includes("Client '") && errorMessage.includes("' unknown")) {
      return {
        code: 'P4_CLIENT_UNKNOWN',
        message: 'Perforce client/workspace unknown',
        details: { stderr: errorMessage, exitCode },
        stderr,
        exitCode,
      };
    }
    
    if (errorMessage.includes('Connect to server failed') || errorMessage.includes('TCP connect')) {
      return {
        code: 'P4_CONNECTION_FAILED',
        message: 'Failed to connect to Perforce server',
        details: { stderr: errorMessage, exitCode },
        stderr,
        exitCode,
      };
    }
    
    if (errorMessage.includes('timeout') || errorMessage.includes('Command timeout')) {
      return {
        code: 'P4_TIMEOUT',
        message: 'Perforce command timed out',
        details: { stderr: errorMessage, exitCode },
        stderr,
        exitCode,
      };
    }
    
    if (errorMessage.includes('not under client')) {
      return {
        code: 'P4_NOT_UNDER_CLIENT',
        message: 'File(s) not under client root',
        details: { stderr: errorMessage, exitCode },
        stderr,
        exitCode,
      };
    }
    
    // Note: P4_READONLY_MODE and P4_DELETE_DISABLED are handled at the tool level
    // and should not appear here as they're not p4 command errors
    
    return {
      code: 'P4_COMMAND_FAILED',
      message: errorMessage || `Command failed with exit code ${exitCode}`,
      details: { stderr: errorMessage, exitCode },
      stderr,
      exitCode,
    };
  }
}