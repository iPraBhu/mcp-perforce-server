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
  stdin?: string;
}

export class P4Runner {
  private static readonly DEFAULT_TIMEOUT = parseInt(process.env.P4_TIMEOUT_MS || '10000'); // 10 seconds default, configurable
  private readonly p4Path: string;
  private lastMemoryCheck = 0;
  private readonly MEMORY_CHECK_INTERVAL = 30000; // Check memory every 30 seconds max

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
      stdin,
    } = options;

    // Optimized memory checking - only check periodically to improve performance
    const now = Date.now();
    if (now - this.lastMemoryCheck > this.MEMORY_CHECK_INTERVAL) {
      const memUsage = process.memoryUsage();
      const currentMemoryMB = memUsage.rss / 1024 / 1024;
      this.lastMemoryCheck = now;

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
      const { stdout, stdoutBuffer, stderr, exitCode } = await this.spawnP4Process(fullArgs, {
        cwd,
        env: processEnv,
        timeout,
        stdin,
      });

      if (exitCode === 0) {
        result.ok = true;
        if (parseOutput && useMarshalled && stdoutBuffer.length > 0) {
          try {
            result.result = this.parseOutput(stdoutBuffer, useZtag, useMarshalled);
          } catch (parseError) {
            // If marshaled parsing fails, return textual fallback with warning
            result.result = stdout.trim() || null;
            result.warnings = result.warnings || [];
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            result.warnings.push(`Parse warning: ${errorMessage}`);
          }
        } else if (parseOutput && stdout && typeof stdout === 'string' && stdout.trim()) {
          try {
            result.result = this.parseOutput(stdout, useZtag, useMarshalled);
          } catch (parseError) {
            // If parsing fails, return raw output with warning
            result.result = stdout.trim() || null;
            result.warnings = result.warnings || [];
            const errorMessage = parseError instanceof Error ? parseError.message : String(parseError);
            result.warnings.push(`Parse warning: ${errorMessage}`);
          }
        } else {
          result.result = (stdout && typeof stdout === 'string' ? stdout.trim() : null) || null;
        }
        
        // Defensive: Check for warnings in stderr with type safety
        if (stderr && typeof stderr === 'string' && stderr.trim()) {
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
    options: { cwd: string; env: Record<string, string | undefined>; timeout: number; stdin?: string }
  ): Promise<{ stdout: string; stdoutBuffer: Buffer; stderr: string; exitCode: number }> {
    return new Promise((resolve, reject) => {
      const spawnOptions: SpawnOptions = {
        cwd: options.cwd,
        env: options.env,
        shell: false, // Critical: avoid shell on Windows
        windowsHide: true,
        stdio: [options.stdin ? 'pipe' : 'ignore', 'pipe', 'pipe'], // Use pipe for stdin if input provided
        detached: false, // Keep attached to parent process
      };

      const child = spawn(this.p4Path, args, spawnOptions);
      
      let stdout = '';
      const stdoutChunks: Buffer[] = [];
      let stderr = '';
      let timeoutHandle: NodeJS.Timeout | null = null;

      // Write to stdin if provided
      if (options.stdin && child.stdin) {
        child.stdin.write(options.stdin);
        child.stdin.end();
      }

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
        stdoutChunks.push(data);
      });

      child.stderr?.on('data', (data: Buffer) => {
        stderr += data.toString();
      });

      child.on('close', (code: number | null) => {
        if (timeoutHandle) {
          clearTimeout(timeoutHandle);
        }
        resolve({
          stdout: String(stdout || ''),
          stdoutBuffer: stdoutChunks.length > 0 ? Buffer.concat(stdoutChunks) : Buffer.alloc(0),
          stderr: String(stderr || ''),
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

  private parseOutput(output: string | Buffer, useZtag: boolean, useMarshalled: boolean): any {
    const isBuffer = Buffer.isBuffer(output);
    const outputText = isBuffer ? output.toString('utf8') : output;

    if (!outputText.trim()) {
      return null;
    }

    try {
      if (useMarshalled) {
        return this.parseMarshaled(isBuffer ? output : Buffer.from(outputText, 'binary'));
      } else if (useZtag) {
        return this.parseZtagOutput(outputText);
      } else {
        // Try to parse as structured text
        return this.parseTextOutput(outputText);
      }
    } catch (error) {
      // If parsing fails, return raw output
      return outputText;
    }
  }

  private parseZtagOutput(output: string): any[] {
    const results: any[] = [];
    
    if (!output || typeof output !== 'string') {
      return results;
    }
    
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

  private parseMarshaled(buffer: Buffer): any {
    if (!buffer || buffer.length === 0) {
      return [];
    }

    const refs: any[] = [];
    let offset = 0;

    const ensure = (length: number) => {
      if (offset + length > buffer.length) {
        throw new Error(`Unexpected end of marshaled data at offset ${offset}`);
      }
    };

    const readByte = () => {
      ensure(1);
      return buffer[offset++];
    };

    const readInt32 = () => {
      ensure(4);
      const value = buffer.readInt32LE(offset);
      offset += 4;
      return value;
    };

    const readUInt16 = () => {
      ensure(2);
      const value = buffer.readUInt16LE(offset);
      offset += 2;
      return value;
    };

    const readDouble = () => {
      ensure(8);
      const value = buffer.readDoubleLE(offset);
      offset += 8;
      return value;
    };

    const readBytes = (length: number) => {
      ensure(length);
      const value = buffer.subarray(offset, offset + length);
      offset += length;
      return value;
    };

    const readString = (length: number) => readBytes(length).toString('utf8');

    const parseLong = (digitCount: number): string | number => {
      const absoluteDigitCount = Math.abs(digitCount);
      let value = 0n;
      for (let i = 0; i < absoluteDigitCount; i++) {
        const digit = BigInt(readUInt16());
        value += digit << BigInt(15 * i);
      }
      if (digitCount < 0) {
        value = -value;
      }

      const asNumber = Number(value);
      if (Number.isSafeInteger(asNumber)) {
        return asNumber;
      }
      return value.toString();
    };

    const toObjectKey = (value: any): string => {
      if (typeof value === 'string') return value;
      if (typeof value === 'number' || typeof value === 'boolean') return String(value);
      if (value === null || value === undefined) return '';
      return JSON.stringify(value);
    };

    const parseObject = (): any => {
      const typeCode = readByte();
      const hasRef = (typeCode & 0x80) !== 0;
      const type = String.fromCharCode(typeCode & 0x7f);

      let value: any;
      switch (type) {
        case '0':
          return null; // TYPE_NULL
        case 'N':
          value = null;
          break;
        case 'F':
          value = false;
          break;
        case 'T':
          value = true;
          break;
        case 'S':
          value = 'StopIteration';
          break;
        case '.':
          value = 'Ellipsis';
          break;
        case 'i':
          value = readInt32();
          break;
        case 'I': {
          // 64-bit integer (little-endian)
          ensure(8);
          const low = buffer.readUInt32LE(offset);
          const high = buffer.readInt32LE(offset + 4);
          offset += 8;
          const bigintValue = (BigInt(high) << 32n) + BigInt(low);
          const asNumber = Number(bigintValue);
          value = Number.isSafeInteger(asNumber) ? asNumber : bigintValue.toString();
          break;
        }
        case 'l':
          value = parseLong(readInt32());
          break;
        case 'f': {
          const length = readByte();
          value = parseFloat(readString(length));
          break;
        }
        case 'g':
          value = readDouble();
          break;
        case 's':
        case 't':
        case 'u':
        case 'a':
        case 'A':
          value = readString(readInt32());
          break;
        case 'z':
        case 'Z':
          value = readString(readByte());
          break;
        case '(':
        case '[': {
          const size = readInt32();
          const arr: any[] = [];
          for (let i = 0; i < size; i++) {
            arr.push(parseObject());
          }
          value = arr;
          break;
        }
        case ')': {
          const size = readByte();
          const arr: any[] = [];
          for (let i = 0; i < size; i++) {
            arr.push(parseObject());
          }
          value = arr;
          break;
        }
        case '{': {
          const obj: Record<string, any> = {};
          while (true) {
            const key = parseObject();
            if (key === null) {
              break;
            }
            obj[toObjectKey(key)] = parseObject();
          }
          value = obj;
          break;
        }
        case '<':
        case '>': {
          const size = readInt32();
          const arr: any[] = [];
          for (let i = 0; i < size; i++) {
            arr.push(parseObject());
          }
          value = arr;
          break;
        }
        case 'r':
        case 'R': {
          const index = readInt32();
          value = refs[index];
          break;
        }
        default:
          throw new Error(`Unsupported marshaled type: ${type} (0x${(typeCode & 0x7f).toString(16)})`);
      }

      if (hasRef) {
        refs.push(value);
      }

      return value;
    };

    const records: any[] = [];
    while (offset < buffer.length) {
      const value = parseObject();
      if (value !== null || records.length > 0) {
        records.push(value);
      }
    }

    return records.length === 1 ? records[0] : records;
  }

  private parseTextOutput(output: string): any {
    // Handle non-string inputs
    if (!output || typeof output !== 'string') {
      return null;
    }
    
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
