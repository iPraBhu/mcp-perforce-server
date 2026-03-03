import * as fs from 'fs';
import * as path from 'path';

function getDefaultConfigCacheTtl(): string {
  switch ((process.env.P4_PERFORMANCE_MODE || 'fast').toLowerCase()) {
    case 'secure':
      return '300000'; // 5 min
    case 'balanced':
      return '300000'; // 5 min
    case 'fast':
    default:
      return '600000'; // 10 min
  }
}

export interface P4ConfigResult {
  found: boolean;
  configPath?: string;
  projectRoot?: string;
  config: Record<string, string>;
  environment: Record<string, string>;
}

export interface P4ServerConfig {
  readOnlyMode: boolean;
  disableDelete: boolean;
}

export class P4Config {
  private static readonly DEFAULT_CONFIG_NAME = '.p4config';
  private configCache = new Map<string, { result: P4ConfigResult; timestamp: number }>();
  private readonly CACHE_TTL = parseInt(process.env.P4_CONFIG_CACHE_TTL || getDefaultConfigCacheTtl());
  
  /**
   * Find .p4config file by searching upward from the given directory
   */
  async findConfig(startPath: string = process.cwd()): Promise<P4ConfigResult> {
    const configName = process.env.P4CONFIG || P4Config.DEFAULT_CONFIG_NAME;
    const cacheKey = `${startPath}:${configName}`;
    
    // Check cache first for performance
    const cached = this.configCache.get(cacheKey);
    if (cached && (Date.now() - cached.timestamp) < this.CACHE_TTL) {
      return cached.result;
    }
    
    try {
      const { configPath, projectRoot } = await this.searchUpward(startPath, configName);
      
      let result: P4ConfigResult;
      if (!configPath || !projectRoot) {
        result = {
          found: false,
          config: {},
          environment: { P4CONFIG: configName },
        };
      } else {
        const config = await this.parseConfigFile(configPath);
        const environment = this.buildEnvironment(config, configName);
        
        result = {
          found: true,
          configPath,
          projectRoot,
          config,
          environment,
        };
      }
      
      // Cache the result for future use
      this.configCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    } catch (error) {
      const result = {
        found: false,
        config: {},
        environment: { P4CONFIG: configName },
      };
      this.configCache.set(cacheKey, { result, timestamp: Date.now() });
      return result;
    }
  }
  
  /**
   * Search upward through parent directories for config file
   */
  private async searchUpward(
    startPath: string,
    configName: string
  ): Promise<{ configPath?: string; projectRoot?: string }> {
    let currentPath = path.resolve(startPath);
    const root = path.parse(currentPath).root;
    
    while (currentPath !== root) {
      const configPath = path.join(currentPath, configName);
      
      try {
        await fs.promises.access(configPath, fs.constants.F_OK);
        return { configPath, projectRoot: currentPath };
      } catch {
        // File doesn't exist, continue searching
      }
      
      currentPath = path.dirname(currentPath);
    }
    
    // Check root directory as well
    const rootConfigPath = path.join(root, configName);
    try {
      await fs.promises.access(rootConfigPath, fs.constants.F_OK);
      return { configPath: rootConfigPath, projectRoot: root };
    } catch {
      // Config not found
    }
    
    return {};
  }
  
  /**
   * Parse .p4config file content
   */
  private async parseConfigFile(configPath: string): Promise<Record<string, string>> {
    const content = await fs.promises.readFile(configPath, 'utf-8');
    const config: Record<string, string> = {};
    
    const lines = content.split('\n');
    for (const line of lines) {
      const trimmed = line.trim();
      
      // Skip empty lines and comments
      if (!trimmed || trimmed.startsWith('#') || trimmed.startsWith(';')) {
        continue;
      }
      
      // Parse key=value pairs
      const equalIndex = trimmed.indexOf('=');
      if (equalIndex > 0) {
        const key = trimmed.substring(0, equalIndex).trim();
        const value = trimmed.substring(equalIndex + 1).trim();
        
        // Remove quotes if present
        const cleanValue = value.replace(/^(['"])(.*)\1$/, '$2');
        config[key] = cleanValue;
      }
    }
    
    return config;
  }
  
  /**
   * Build environment variables from config
   */
  private buildEnvironment(
    config: Record<string, string>,
    configName: string
  ): Record<string, string> {
    const env: Record<string, string> = {
      P4CONFIG: configName,
    };
    
    // Map common config keys to environment variables
    const keyMapping: Record<string, string> = {
      P4PORT: 'P4PORT',
      P4USER: 'P4USER', 
      P4CLIENT: 'P4CLIENT',
      P4CHARSET: 'P4CHARSET',
      P4PASSWD: 'P4PASSWD',
      P4COMMANDCHARSET: 'P4COMMANDCHARSET',
      P4LANGUAGE: 'P4LANGUAGE',
      P4DIFF: 'P4DIFF',
      P4MERGE: 'P4MERGE',
      P4EDITOR: 'P4EDITOR',
    };
    
    for (const [configKey, envKey] of Object.entries(keyMapping)) {
      if (config[configKey]) {
        env[envKey] = config[configKey];
      }
    }
    
    return env;
  }
  
  /**
   * Get project root directory from workspace path
   */
  async getProjectRoot(workspacePath?: string): Promise<string> {
    if (!workspacePath) {
      return process.cwd();
    }
    
    const resolved = path.resolve(workspacePath);
    const configResult = await this.findConfig(resolved);
    
    return configResult.projectRoot || resolved;
  }
  
  /**
   * Setup environment and working directory for p4 command
   */
  async setupForCommand(workspacePath?: string): Promise<{
    cwd: string;
    env: Record<string, string>;
    configResult: P4ConfigResult;
  }> {
    const startPath = workspacePath || process.cwd();
    const configResult = await this.findConfig(startPath);
    
    // Use project root as working directory if config found, otherwise use provided path
    const cwd = configResult.projectRoot || startPath;
    
    // Merge .p4config environment with MCP-provided environment variables
    const env = {
      ...configResult.environment,
      ...this.getMcpEnvironment(), // MCP environment takes precedence
    };
    
    return { cwd, env, configResult };
  }
  
  /**
   * Validate that Perforce environment is properly configured
   */
  validateEnvironment(configResult: P4ConfigResult): { valid: boolean; errors: string[] } {
    const errors: string[] = [];
    
    // Get combined environment (MCP + .p4config)
    const mcpEnv = this.getMcpEnvironment();
    const hasAnyConfig = configResult.found || Object.keys(mcpEnv).length > 0;
    
    if (!hasAnyConfig) {
      errors.push('No .p4config file found and no MCP environment variables provided');
    }
    
    const requiredKeys = ['P4PORT', 'P4USER', 'P4CLIENT'];
    for (const key of requiredKeys) {
      const hasInConfig = configResult.config[key];
      const hasInMcp = mcpEnv[key];
      const hasInProcessEnv = process.env[key];
      
      if (!hasInConfig && !hasInMcp && !hasInProcessEnv) {
        errors.push(`Required configuration missing: ${key}`);
      }
    }
    
    return {
      valid: errors.length === 0,
      errors,
    };
  }
  
  /**
   * Get server configuration from environment variables
   */
  getServerConfig(): P4ServerConfig {
    return {
      readOnlyMode: process.env.P4_READONLY_MODE !== 'false', // Default: true
      disableDelete: process.env.P4_DISABLE_DELETE !== 'false', // Default: true
    };
  }
  
  /**
   * Extract MCP-provided Perforce environment variables
   */
  private getMcpEnvironment(): Record<string, string> {
    const mcpEnv: Record<string, string> = {};
    
    // Standard Perforce environment variables that can be provided via MCP config
    const p4Keys = [
      'P4PORT', 'P4USER', 'P4CLIENT', 'P4CHARSET', 'P4PASSWD',
      'P4COMMANDCHARSET', 'P4LANGUAGE', 'P4DIFF', 'P4MERGE', 'P4EDITOR'
    ];
    
    for (const key of p4Keys) {
      if (process.env[key]) {
        mcpEnv[key] = process.env[key];
      }
    }
    
    return mcpEnv;
  }
  
  /**
   * Create a minimal .p4config file template
   */
  static createTemplate(options: {
    port?: string;
    user?: string;
    client?: string;
    charset?: string;
  } = {}): string {
    const template = `# Perforce Configuration
# This file should be placed in your project root directory

# Server connection
P4PORT=${options.port || 'your-perforce-server:1666'}

# User credentials  
P4USER=${options.user || 'your-username'}

# Client/workspace name
P4CLIENT=${options.client || 'your-client-name'}

# Character set (optional)
${options.charset ? `P4CHARSET=${options.charset}` : '# P4CHARSET=utf8'}

# Optional: Editor for change descriptions
# P4EDITOR=notepad

# Optional: Diff tool
# P4DIFF=diff
`;
    
    return template;
  }
}
