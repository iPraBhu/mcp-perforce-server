/**
 * Performance Configuration for MCP Perforce Server
 * 
 * Set these environment variables to optimize server performance:
 */

// ====================================
// FAST MODE CONFIGURATION (Development)
// ====================================
// P4_PERFORMANCE_MODE=fast
// P4_TIMEOUT_MS=5000                    # 5 seconds (faster failure detection)
// P4_ENABLE_RATE_LIMITING=false         # Disable rate limiting overhead
// P4_ENABLE_MEMORY_LIMITS=false         # Disable memory checking overhead
// P4_ENABLE_AUDIT_LOGGING=false         # Disable audit logging overhead
// P4_CONFIG_CACHE_TTL=600000             # Cache config for 10 minutes

// ====================================
// SECURE MODE CONFIGURATION (Production)
// ====================================
// P4_PERFORMANCE_MODE=secure
// P4_TIMEOUT_MS=15000                   # 15 seconds (balanced)
// P4_ENABLE_RATE_LIMITING=true          # Enable rate limiting
// P4_ENABLE_MEMORY_LIMITS=true          # Enable memory monitoring
// P4_ENABLE_AUDIT_LOGGING=true          # Enable audit logging
// P4_CONFIG_CACHE_TTL=300000             # Cache config for 5 minutes

// ====================================
// CUSTOM TUNING OPTIONS
// ====================================
// P4_MAX_MEMORY_MB=512                  # Memory limit in MB
// P4_RATE_LIMIT_REQUESTS=100            # Max requests per window  
// P4_RATE_LIMIT_WINDOW_MS=600000        # Rate limit window (10 minutes)
// P4_AUDIT_RETENTION_DAYS=90            # Audit log retention

export interface PerformanceConfig {
  fast: {
    P4_PERFORMANCE_MODE: 'fast';
    P4_TIMEOUT_MS: '5000';
    P4_ENABLE_RATE_LIMITING: 'false';
    P4_ENABLE_MEMORY_LIMITS: 'false';
    P4_ENABLE_AUDIT_LOGGING: 'false';
    P4_CONFIG_CACHE_TTL: '600000';
  };
  balanced: {
    P4_PERFORMANCE_MODE: 'balanced';
    P4_TIMEOUT_MS: '10000';
    P4_ENABLE_RATE_LIMITING: 'false';
    P4_ENABLE_MEMORY_LIMITS: 'true';
    P4_ENABLE_AUDIT_LOGGING: 'false';
    P4_CONFIG_CACHE_TTL: '300000';
  };
  secure: {
    P4_PERFORMANCE_MODE: 'secure';
    P4_TIMEOUT_MS: '15000';
    P4_ENABLE_RATE_LIMITING: 'true';
    P4_ENABLE_MEMORY_LIMITS: 'true';
    P4_ENABLE_AUDIT_LOGGING: 'true';
    P4_CONFIG_CACHE_TTL: '300000';
  };
}

/**
 * Apply a performance preset
 */
export function setPerformanceMode(mode: keyof PerformanceConfig): void {
  const presets: PerformanceConfig = {
    fast: {
      P4_PERFORMANCE_MODE: 'fast',
      P4_TIMEOUT_MS: '5000',
      P4_ENABLE_RATE_LIMITING: 'false',
      P4_ENABLE_MEMORY_LIMITS: 'false', 
      P4_ENABLE_AUDIT_LOGGING: 'false',
      P4_CONFIG_CACHE_TTL: '600000',
    },
    balanced: {
      P4_PERFORMANCE_MODE: 'balanced',
      P4_TIMEOUT_MS: '10000',
      P4_ENABLE_RATE_LIMITING: 'false',
      P4_ENABLE_MEMORY_LIMITS: 'true',
      P4_ENABLE_AUDIT_LOGGING: 'false',
      P4_CONFIG_CACHE_TTL: '300000',
    },
    secure: {
      P4_PERFORMANCE_MODE: 'secure', 
      P4_TIMEOUT_MS: '15000',
      P4_ENABLE_RATE_LIMITING: 'true',
      P4_ENABLE_MEMORY_LIMITS: 'true',
      P4_ENABLE_AUDIT_LOGGING: 'true',
      P4_CONFIG_CACHE_TTL: '300000',
    },
  };

  const config = presets[mode];
  if (!config) {
    throw new Error(`Invalid performance mode: ${mode}. Valid modes: fast, balanced, secure`);
  }

  // Apply environment variables
  Object.entries(config).forEach(([key, value]) => {
    process.env[key] = value;
  });

  console.log(`✅ Performance mode set to: ${mode}`);
  console.log('Current configuration:');
  Object.entries(config).forEach(([key, value]) => {
    console.log(`  ${key}=${value}`);
  });
}

/**
 * Get current performance configuration
 */
export function getPerformanceInfo(): {
  mode: string;
  timeout: number;
  rateLimitingEnabled: boolean;
  memoryLimitsEnabled: boolean;
  auditLoggingEnabled: boolean;
  configCacheTTL: number;
} {
  return {
    mode: process.env.P4_PERFORMANCE_MODE || 'default',
    timeout: parseInt(process.env.P4_TIMEOUT_MS || '10000'),
    rateLimitingEnabled: process.env.P4_ENABLE_RATE_LIMITING !== 'false',
    memoryLimitsEnabled: process.env.P4_ENABLE_MEMORY_LIMITS !== 'false',
    auditLoggingEnabled: process.env.P4_ENABLE_AUDIT_LOGGING === 'true',
    configCacheTTL: parseInt(process.env.P4_CONFIG_CACHE_TTL || '300000'),
  };
}