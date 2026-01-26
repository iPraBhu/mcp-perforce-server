/**
 * Security and compliance utilities for MCP Perforce server
 */

import * as path from 'path';
import { P4RunResult } from './runner.js';

export interface RateLimitConfig {
  maxRequests: number;
  windowMs: number;
  blockDurationMs: number;
}

export interface AuditLogEntry {
  timestamp: string;
  tool: string;
  user: string;
  client: string;
  operation: string;
  args: Record<string, any>;
  result: 'success' | 'error' | 'blocked';
  errorCode?: string;
  duration: number;
  memoryUsage: {
    rss: number;
    heapUsed: number;
    heapTotal: number;
  };
}

export interface ComplianceConfig {
  enableAuditLogging: boolean;
  enableRateLimiting: boolean;
  enableMemoryLimits: boolean;
  enableInputSanitization: boolean;
  maxMemoryMB: number;
  auditLogRetentionDays: number;
}

export class SecurityManager {
  private rateLimitStore = new Map<string, { count: number; resetTime: number; blockedUntil?: number }>();
  private auditLog: AuditLogEntry[] = [];
  private complianceConfig: ComplianceConfig;

  constructor(config: Partial<ComplianceConfig> = {}) {
    this.complianceConfig = {
      enableAuditLogging: process.env.P4_ENABLE_AUDIT_LOGGING === 'true',
      enableRateLimiting: process.env.P4_ENABLE_RATE_LIMITING !== 'false',
      enableMemoryLimits: process.env.P4_ENABLE_MEMORY_LIMITS !== 'false',
      enableInputSanitization: process.env.P4_ENABLE_INPUT_SANITIZATION !== 'false',
      maxMemoryMB: parseInt(process.env.P4_MAX_MEMORY_MB || '512'),
      auditLogRetentionDays: parseInt(process.env.P4_AUDIT_RETENTION_DAYS || '90'),
      ...config,
    };

    // Clean up audit logs periodically
    if (this.complianceConfig.enableAuditLogging) {
      setInterval(() => this.cleanupAuditLogs(), 24 * 60 * 60 * 1000); // Daily cleanup
    }
  }

  /**
   * Rate limiting implementation
   */
  checkRateLimit(identifier: string, config: RateLimitConfig = {
    maxRequests: parseInt(process.env.P4_RATE_LIMIT_REQUESTS || '100'),
    windowMs: parseInt(process.env.P4_RATE_LIMIT_WINDOW_MS || '600000'), // 10 minutes
    blockDurationMs: parseInt(process.env.P4_RATE_LIMIT_BLOCK_MS || '3600000'), // 1 hour
  }): { allowed: boolean; remaining: number; resetTime: number; blockedUntil?: number } {
    if (!this.complianceConfig.enableRateLimiting) {
      return { allowed: true, remaining: config.maxRequests, resetTime: Date.now() + config.windowMs };
    }

    const now = Date.now();
    const record = this.rateLimitStore.get(identifier);

    // Check if currently blocked
    if (record?.blockedUntil && now < record.blockedUntil) {
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        blockedUntil: record.blockedUntil,
      };
    }

    // Reset window if expired
    if (!record || now > record.resetTime) {
      this.rateLimitStore.set(identifier, {
        count: 1,
        resetTime: now + config.windowMs,
      });
      return { allowed: true, remaining: config.maxRequests - 1, resetTime: now + config.windowMs };
    }

    // Increment counter
    record.count++;

    // Check if limit exceeded
    if (record.count > config.maxRequests) {
      record.blockedUntil = now + config.blockDurationMs;
      return {
        allowed: false,
        remaining: 0,
        resetTime: record.resetTime,
        blockedUntil: record.blockedUntil,
      };
    }

    return {
      allowed: true,
      remaining: config.maxRequests - record.count,
      resetTime: record.resetTime,
    };
  }

  /**
   * Input sanitization for file patterns and paths
   */
  sanitizeInput(input: string, type: 'filespec' | 'pattern' | 'path'): { sanitized: string; valid: boolean; warnings: string[] } {
    if (!this.complianceConfig.enableInputSanitization) {
      return { sanitized: input, valid: true, warnings: [] };
    }

    const warnings: string[] = [];
    let sanitized = input.trim();

    switch (type) {
      case 'filespec':
        // Perforce filespec validation - prevent dangerous patterns
        if (sanitized.includes('..') && !sanitized.startsWith('//')) {
          warnings.push('Relative path traversal detected in filespec');
        }
        if (sanitized.includes('*') && sanitized.includes('..')) {
          warnings.push('Wildcard with path traversal detected');
        }
        // Remove potentially dangerous characters
        sanitized = sanitized.replace(/[<>|;&$]/g, '');
        break;

      case 'pattern':
        // Regex pattern validation for grep operations
        if (sanitized.length > 1000) {
          warnings.push('Pattern too long, truncated to 1000 characters');
          sanitized = sanitized.substring(0, 1000);
        }
        // Basic regex safety checks
        const dangerousPatterns = [
          /\\0/, // Null bytes
          /\(\?\</, // Lookbehinds (can cause ReDoS)
          /(x*)*y/, // Potential ReDoS patterns
        ];
        for (const pattern of dangerousPatterns) {
          if (pattern.test(sanitized)) {
            warnings.push('Potentially dangerous regex pattern detected');
          }
        }
        break;

      case 'path':
        // File path validation
        if (path.isAbsolute(sanitized) && !sanitized.startsWith('//')) {
          warnings.push('Absolute path detected, ensure it\'s intended');
        }
        if (sanitized.includes('\0')) {
          warnings.push('Null bytes detected in path');
          sanitized = sanitized.replace(/\0/g, '');
        }
        break;
    }

    const valid = warnings.length === 0 || warnings.every(w => !w.includes('dangerous'));
    return { sanitized, valid, warnings };
  }

  /**
   * Memory usage monitoring and limits
   */
  checkMemoryUsage(): { withinLimits: boolean; usage: NodeJS.MemoryUsage; warnings: string[] } {
    if (!this.complianceConfig.enableMemoryLimits) {
      return { withinLimits: true, usage: process.memoryUsage(), warnings: [] };
    }

    const usage = process.memoryUsage();
    const maxBytes = this.complianceConfig.maxMemoryMB * 1024 * 1024;
    const warnings: string[] = [];

    if (usage.rss > maxBytes) {
      warnings.push(`RSS memory usage (${Math.round(usage.rss / 1024 / 1024)}MB) exceeds limit (${this.complianceConfig.maxMemoryMB}MB)`);
    }

    if (usage.heapUsed > maxBytes * 0.8) {
      warnings.push(`Heap usage (${Math.round(usage.heapUsed / 1024 / 1024)}MB) near limit (${this.complianceConfig.maxMemoryMB}MB)`);
    }

    return {
      withinLimits: warnings.length === 0,
      usage,
      warnings,
    };
  }

  /**
   * Force garbage collection if available (requires --expose-gc)
   */
  forceGarbageCollection(): boolean {
    if (typeof global.gc === 'function') {
      global.gc();
      return true;
    }
    return false;
  }

  /**
   * Audit logging
   */
  logAuditEntry(entry: Omit<AuditLogEntry, 'timestamp' | 'memoryUsage'>): void {
    if (!this.complianceConfig.enableAuditLogging) {
      return;
    }

    const auditEntry: AuditLogEntry = {
      ...entry,
      timestamp: new Date().toISOString(),
      memoryUsage: process.memoryUsage(),
    };

    this.auditLog.push(auditEntry);

    // Keep only recent entries
    const cutoffTime = Date.now() - (this.complianceConfig.auditLogRetentionDays * 24 * 60 * 60 * 1000);
    this.auditLog = this.auditLog.filter(entry => new Date(entry.timestamp).getTime() > cutoffTime);

    // Log to console if debug enabled
    if (process.env.LOG_LEVEL === 'debug') {
      console.error('[AUDIT]', JSON.stringify({
        ...auditEntry,
        memoryUsage: {
          rss: Math.round(auditEntry.memoryUsage.rss / 1024 / 1024),
          heapUsed: Math.round(auditEntry.memoryUsage.heapUsed / 1024 / 1024),
          heapTotal: Math.round(auditEntry.memoryUsage.heapTotal / 1024 / 1024),
        },
      }));
    }
  }

  /**
   * Get audit log entries
   */
  getAuditLog(filter?: {
    tool?: string;
    user?: string;
    result?: 'success' | 'error' | 'blocked';
    since?: Date;
  }): AuditLogEntry[] {
    let filtered = this.auditLog;

    if (filter) {
      if (filter.tool) {
        filtered = filtered.filter(entry => entry.tool === filter.tool);
      }
      if (filter.user) {
        filtered = filtered.filter(entry => entry.user === filter.user);
      }
      if (filter.result) {
        filtered = filtered.filter(entry => entry.result === filter.result);
      }
      if (filter.since) {
        filtered = filtered.filter(entry => new Date(entry.timestamp) >= filter.since!);
      }
    }

    return filtered.sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime());
  }

  /**
   * Clean up old audit log entries
   */
  private cleanupAuditLogs(): void {
    const cutoffTime = Date.now() - (this.complianceConfig.auditLogRetentionDays * 24 * 60 * 60 * 1000);
    const beforeCount = this.auditLog.length;
    this.auditLog = this.auditLog.filter(entry => new Date(entry.timestamp).getTime() > cutoffTime);
    const afterCount = this.auditLog.length;

    if (beforeCount !== afterCount) {
      console.error(`[AUDIT] Cleaned up ${beforeCount - afterCount} old audit log entries`);
    }
  }

  /**
   * Export audit log for compliance reporting
   */
  exportAuditLog(format: 'json' | 'csv' = 'json'): string {
    if (format === 'csv') {
      const headers = ['timestamp', 'tool', 'user', 'client', 'operation', 'result', 'errorCode', 'duration', 'rss', 'heapUsed', 'heapTotal'];
      const rows = this.auditLog.map(entry => [
        entry.timestamp,
        entry.tool,
        entry.user,
        entry.client,
        entry.operation,
        entry.result,
        entry.errorCode || '',
        entry.duration.toString(),
        Math.round(entry.memoryUsage.rss / 1024 / 1024).toString(),
        Math.round(entry.memoryUsage.heapUsed / 1024 / 1024).toString(),
        Math.round(entry.memoryUsage.heapTotal / 1024 / 1024).toString(),
      ]);

      return [headers, ...rows].map(row => row.map(cell => `"${cell}"`).join(',')).join('\n');
    }

    return JSON.stringify(this.auditLog, null, 2);
  }

  /**
   * Get compliance configuration
   */
  getComplianceConfig(): ComplianceConfig {
    return { ...this.complianceConfig };
  }

  /**
   * Update compliance configuration
   */
  updateComplianceConfig(config: Partial<ComplianceConfig>): void {
    this.complianceConfig = { ...this.complianceConfig, ...config };
  }
}

// Global security manager instance
export const securityManager = new SecurityManager();