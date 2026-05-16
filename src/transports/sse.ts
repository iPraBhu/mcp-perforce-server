import express, { Request, Response } from 'express';
import cors from 'cors';
import { SSEServerTransport } from '@modelcontextprotocol/sdk/server/sse.js';
import { Server } from '@modelcontextprotocol/sdk/server/index.js';

// Environment-based logging
const LOG_LEVEL = process.env.LOG_LEVEL || 'warn';
const shouldLog = (level: string) => {
  const levels = ['error', 'warn', 'info', 'debug'];
  return levels.indexOf(level) <= levels.indexOf(LOG_LEVEL);
};

const log = {
  error: (...args: unknown[]) => shouldLog('error') && console.error('[ERROR]', ...args),
  warn: (...args: unknown[]) => shouldLog('warn') && console.error('[WARN]', ...args),
  info: (...args: unknown[]) => shouldLog('info') && console.error('[INFO]', ...args),
  debug: (...args: unknown[]) => shouldLog('debug') && console.error('[DEBUG]', ...args),
};

export interface SSETransportOptions {
  port?: number;
  host?: string;
  path?: string;
  corsOrigin?: string | string[];
  enableAuth?: boolean;
  authToken?: string;
}

export class SSETransportManager {
  private app: express.Application;
  private server: Server;
  private options: Required<SSETransportOptions>;

  constructor(mcpServer: Server, options: SSETransportOptions = {}) {
    this.server = mcpServer;
    this.options = {
      port: options.port || parseInt(process.env.MCP_SSE_PORT || '3000', 10),
      host: options.host || process.env.MCP_SSE_HOST || '0.0.0.0',
      path: options.path || process.env.MCP_SSE_PATH || '/mcp',
      corsOrigin: options.corsOrigin || process.env.MCP_SSE_CORS_ORIGIN || '*',
      enableAuth: options.enableAuth ?? (process.env.MCP_SSE_ENABLE_AUTH === 'true'),
      authToken: options.authToken || process.env.MCP_SSE_AUTH_TOKEN || '',
    };

    this.app = express();
    this.setupMiddleware();
    this.setupRoutes();
  }

  private setupMiddleware(): void {
    // CORS configuration
    this.app.use(cors({
      origin: this.options.corsOrigin,
      credentials: true,
      methods: ['GET', 'POST', 'OPTIONS'],
      allowedHeaders: ['Content-Type', 'Authorization'],
    }));

    // JSON body parsing
    this.app.use(express.json());

    // Request logging
    this.app.use((req, _res, next) => {
      log.debug(`${req.method} ${req.url}`);
      next();
    });
  }

  private authMiddleware(req: Request, res: Response, next: express.NextFunction): void {
    if (!this.options.enableAuth) {
      next();
      return;
    }

    const authHeader = req.headers.authorization;
    const token = authHeader?.startsWith('Bearer ') ? authHeader.substring(7) : null;

    if (!token || token !== this.options.authToken) {
      log.warn('Unauthorized SSE connection attempt');
      res.status(401).json({ error: 'Unauthorized' });
      return;
    }

    next();
  }

  private setupRoutes(): void {
    // Health check endpoint
    this.app.get('/health', (_req, res) => {
      res.json({ status: 'ok', transport: 'sse' });
    });

    // Main SSE endpoint
    this.app.get(
      this.options.path,
      this.authMiddleware.bind(this),
      async (req, res) => {
        log.info('New SSE connection established');

        try {
          const transport = new SSEServerTransport(this.options.path, res);
          await this.server.connect(transport);
          log.info('SSE transport connected to MCP server');

          // Handle client disconnect
          req.on('close', () => {
            log.info('SSE client disconnected');
          });

        } catch (error) {
          log.error('Failed to establish SSE connection:', error);
          if (!res.headersSent) {
            res.status(500).json({ error: 'Failed to establish SSE connection' });
          }
        }
      }
    );

    // POST endpoint for message sending (required by SSE transport)
    this.app.post(
      this.options.path,
      this.authMiddleware.bind(this),
      async (req, res) => {
        log.debug('Received SSE POST request');
        try {
          // The SSE transport handles POST requests internally
          res.status(200).json({ status: 'ok' });
        } catch (error) {
          log.error('Failed to process SSE POST request:', error);
          res.status(500).json({ error: 'Internal server error' });
        }
      }
    );

    // 404 handler
    this.app.use((_req, res) => {
      res.status(404).json({ error: 'Not found' });
    });

    // Error handler
    this.app.use((err: Error, _req: Request, res: Response, _next: express.NextFunction) => {
      log.error('Express error:', err);
      if (!res.headersSent) {
        res.status(500).json({ error: 'Internal server error' });
      }
    });
  }

  async start(): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        const httpServer = this.app.listen(this.options.port, this.options.host, () => {
          log.info(`SSE transport listening on http://${this.options.host}:${this.options.port}${this.options.path}`);
          if (this.options.enableAuth) {
            log.info('Authentication is enabled - Bearer token required');
          } else {
            log.warn('Authentication is disabled - consider enabling for production');
          }
          resolve();
        });

        httpServer.on('error', (error) => {
          log.error('HTTP server error:', error);
          reject(error);
        });

        // Graceful shutdown
        process.on('SIGTERM', () => {
          log.info('SIGTERM received, closing HTTP server...');
          httpServer.close(() => {
            log.info('HTTP server closed');
            process.exit(0);
          });
        });

        process.on('SIGINT', () => {
          log.info('SIGINT received, closing HTTP server...');
          httpServer.close(() => {
            log.info('HTTP server closed');
            process.exit(0);
          });
        });

      } catch (error) {
        log.error('Failed to start SSE transport:', error);
        reject(error);
      }
    });
  }
}
