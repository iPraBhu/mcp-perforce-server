# SSE Transport Setup Guide

Complete guide for configuring and deploying the MCP Perforce Server with SSE (Server-Sent Events) transport for web-based and HTTP clients.

## Table of Contents

- [What is SSE Transport?](#what-is-sse-transport)
- [When to Use SSE vs Stdio](#when-to-use-sse-vs-stdio)
- [Quick Start](#quick-start)
- [Configuration Reference](#configuration-reference)
- [Security Setup](#security-setup)
- [Deployment Examples](#deployment-examples)
- [Client Configuration](#client-configuration)
- [Production Deployment](#production-deployment)
- [Monitoring and Troubleshooting](#monitoring-and-troubleshooting)
- [Advanced Scenarios](#advanced-scenarios)

---

## What is SSE Transport?

Server-Sent Events (SSE) is an HTTP-based transport that allows the MCP Perforce Server to communicate with web browsers and HTTP clients instead of using process pipes (stdio).

### Architecture

```
┌─────────────────┐         HTTP/SSE          ┌──────────────────┐
│  Web Client     │ ◄────────────────────────► │  MCP Perforce    │
│  (Browser/App)  │   GET/POST /mcp           │  Server (SSE)    │
└─────────────────┘                            └──────────────────┘
                                                        │
                                                        ▼
                                                 ┌──────────────┐
                                                 │  Perforce    │
                                                 │  (p4 CLI)    │
                                                 └──────────────┘
```

### Key Differences from Stdio

| Feature | Stdio Transport | SSE Transport |
|---------|----------------|---------------|
| **Connection** | Process pipes (stdin/stdout) | HTTP streaming |
| **Use Case** | IDE/CLI integration | Web dashboards, APIs |
| **Clients** | One process per client | Shared HTTP server |
| **Network** | Local only | Network accessible |
| **Authentication** | Process isolation | Token-based |
| **Deployment** | Per-user installation | Centralized server |

---

## When to Use SSE vs Stdio

### Use Stdio Transport When:
- ✅ Integrating with VS Code, Cursor, or Claude Desktop
- ✅ Building CLI tools
- ✅ Single-user workflows
- ✅ Local development
- ✅ Maximum security through process isolation

### Use SSE Transport When:
- ✅ Building web dashboards
- ✅ Creating browser-based UIs
- ✅ Centralized team deployments
- ✅ API integrations
- ✅ Multi-user environments
- ✅ Cloud/container deployments

---

## Quick Start

### 1. Install the Server

```bash
npm install -g mcp-perforce-server
```

### 2. Start SSE Server (Development)

```bash
# Basic SSE server on default port 3000
mcp-perforce-server --transport=sse

# Custom port
MCP_SSE_PORT=8080 mcp-perforce-server --transport=sse

# With authentication
MCP_SSE_ENABLE_AUTH=true \
MCP_SSE_AUTH_TOKEN="my-secret-token" \
mcp-perforce-server --transport=sse
```

### 3. Test the Connection

```bash
# Health check
curl http://localhost:3000/health

# Expected response:
# {"status":"ok","transport":"sse"}
```

### 4. Connect a Client

```javascript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

const transport = new SSEClientTransport(
  new URL('http://localhost:3000/mcp')
);

const client = new Client({
  name: 'my-client',
  version: '1.0.0'
}, { capabilities: {} });

await client.connect(transport);
const result = await client.callTool({ name: 'p4.info', arguments: {} });
console.log(result);
```

---

## Configuration Reference

### Environment Variables

All SSE-specific configuration is done via environment variables:

| Variable | Type | Default | Description |
|----------|------|---------|-------------|
| `MCP_TRANSPORT` | string | `stdio` | Transport mode: `stdio` or `sse` |
| `MCP_SSE_PORT` | number | `3000` | HTTP server port |
| `MCP_SSE_HOST` | string | `0.0.0.0` | Server bind address (0.0.0.0 = all interfaces) |
| `MCP_SSE_PATH` | string | `/mcp` | SSE endpoint path |
| `MCP_SSE_CORS_ORIGIN` | string | `*` | CORS allowed origins (comma-separated or `*`) |
| `MCP_SSE_ENABLE_AUTH` | boolean | `false` | Enable Bearer token authentication |
| `MCP_SSE_AUTH_TOKEN` | string | _(empty)_ | Authentication token (required if auth enabled) |

### Command-Line Options

```bash
# Transport selection
mcp-perforce-server --transport=sse
mcp-perforce-server --transport=stdio  # Default

# Help and version
mcp-perforce-server --help
mcp-perforce-server --version
```

### Available Endpoints

When running in SSE mode, the server exposes:

| Endpoint | Method | Purpose |
|----------|--------|---------|
| `/mcp` | GET | SSE connection endpoint |
| `/mcp` | POST | Message posting endpoint |
| `/health` | GET | Health check (returns JSON status) |

---

## Security Setup

### 1. Development Mode (No Authentication)

**Use for:** Local development, testing, trusted networks

```bash
export MCP_SSE_PORT=3000
export MCP_SSE_HOST=127.0.0.1  # Localhost only
export LOG_LEVEL=info

mcp-perforce-server --transport=sse
```

⚠️ **Warning:** Server is accessible without authentication

### 2. Production Mode (Authentication Required)

**Use for:** Production deployments, public networks, multi-user

```bash
# Generate a secure token
export MCP_SSE_AUTH_TOKEN=$(openssl rand -hex 32)
echo "Save this token: $MCP_SSE_AUTH_TOKEN"

# Configure server
export MCP_SSE_PORT=3000
export MCP_SSE_HOST=0.0.0.0
export MCP_SSE_ENABLE_AUTH=true
export MCP_SSE_CORS_ORIGIN="https://your-dashboard.com"

# Perforce readonly mode for safety
export P4_READONLY_MODE=true
export P4_DISABLE_DELETE=true

# Start server
mcp-perforce-server --transport=sse
```

**Client must include token:**

```bash
curl -H "Authorization: Bearer YOUR_TOKEN_HERE" \
     http://localhost:3000/health
```

### 3. Token Storage Best Practices

**DO:**
- ✅ Store tokens in environment variables or secrets manager
- ✅ Use different tokens per environment (dev/staging/prod)
- ✅ Rotate tokens regularly
- ✅ Use strong random tokens (32+ bytes)

**DON'T:**
- ❌ Hard-code tokens in source code
- ❌ Commit tokens to version control
- ❌ Share tokens across multiple services
- ❌ Use predictable tokens

### 4. CORS Configuration

```bash
# Allow all origins (development only)
export MCP_SSE_CORS_ORIGIN="*"

# Single origin
export MCP_SSE_CORS_ORIGIN="https://dashboard.example.com"

# Multiple origins (comma-separated)
export MCP_SSE_CORS_ORIGIN="https://app1.com,https://app2.com"
```

---

## Deployment Examples

### Example 1: Local Development Server

**Scenario:** Testing SSE locally without authentication

```bash
#!/bin/bash
# dev-sse-server.sh

export MCP_SSE_PORT=3000
export MCP_SSE_HOST=127.0.0.1
export LOG_LEVEL=info
export P4_READONLY_MODE=true

# Use local .p4config for Perforce credentials
export P4CONFIG=.p4config

mcp-perforce-server --transport=sse
```

Run:
```bash
chmod +x dev-sse-server.sh
./dev-sse-server.sh
```

### Example 2: Docker Container

**Scenario:** Containerized SSE server for team deployment

**Dockerfile:**
```dockerfile
FROM node:18-alpine

# Install MCP Perforce Server
RUN npm install -g mcp-perforce-server

# Install Perforce CLI (example for Alpine)
RUN wget -qO- https://package.perforce.com/perforce.pubkey | \
    gpg --import && \
    echo "http://package.perforce.com/apt/ubuntu focal release" > \
    /etc/apk/repositories && \
    apk add --no-cache helix-cli

# Create non-root user
RUN addgroup -g 1000 mcp && \
    adduser -D -u 1000 -G mcp mcp

USER mcp
WORKDIR /home/mcp

# Health check
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget -q --spider http://localhost:3000/health || exit 1

# Expose SSE port
EXPOSE 3000

# Default to SSE transport
ENV MCP_TRANSPORT=sse
ENV MCP_SSE_PORT=3000
ENV MCP_SSE_HOST=0.0.0.0
ENV P4_READONLY_MODE=true
ENV P4_DISABLE_DELETE=true
ENV LOG_LEVEL=warn

CMD ["mcp-perforce-server"]
```

**docker-compose.yml:**
```yaml
version: '3.8'

services:
  mcp-perforce-sse:
    build: .
    image: mcp-perforce-server:latest
    container_name: mcp-perforce-sse
    restart: unless-stopped
    
    ports:
      - "3000:3000"
    
    environment:
      # SSE Configuration
      MCP_TRANSPORT: sse
      MCP_SSE_PORT: 3000
      MCP_SSE_HOST: 0.0.0.0
      MCP_SSE_ENABLE_AUTH: "true"
      MCP_SSE_AUTH_TOKEN: ${MCP_AUTH_TOKEN}
      MCP_SSE_CORS_ORIGIN: "https://dashboard.example.com"
      
      # Perforce Configuration
      P4PORT: ${P4PORT}
      P4USER: ${P4USER}
      P4CLIENT: ${P4CLIENT}
      P4PASSWD: ${P4PASSWD}
      
      # Security
      P4_READONLY_MODE: "true"
      P4_DISABLE_DELETE: "true"
      
      # Logging
      LOG_LEVEL: info
    
    networks:
      - mcp-network
    
    volumes:
      - mcp-cache:/home/mcp/.cache

networks:
  mcp-network:
    driver: bridge

volumes:
  mcp-cache:
```

**.env file:**
```bash
# Perforce credentials
P4PORT=ssl:perforce.example.com:1666
P4USER=service-account
P4CLIENT=mcp-workspace
P4PASSWD=your-perforce-password

# MCP authentication
MCP_AUTH_TOKEN=abc123def456...your-secret-token
```

**Run:**
```bash
# Build and start
docker-compose up -d

# Check logs
docker-compose logs -f

# Test health
curl http://localhost:3000/health

# Stop
docker-compose down
```

### Example 3: Kubernetes Deployment

**Scenario:** Production-grade Kubernetes deployment

**mcp-perforce-deployment.yaml:**
```yaml
apiVersion: v1
kind: Namespace
metadata:
  name: mcp-perforce
---
apiVersion: v1
kind: Secret
metadata:
  name: mcp-perforce-secrets
  namespace: mcp-perforce
type: Opaque
stringData:
  p4port: "ssl:perforce.example.com:1666"
  p4user: "service-account"
  p4client: "mcp-k8s-workspace"
  p4passwd: "your-perforce-password"
  mcp-auth-token: "your-secret-token"
---
apiVersion: v1
kind: ConfigMap
metadata:
  name: mcp-perforce-config
  namespace: mcp-perforce
data:
  MCP_TRANSPORT: "sse"
  MCP_SSE_PORT: "3000"
  MCP_SSE_HOST: "0.0.0.0"
  MCP_SSE_PATH: "/mcp"
  MCP_SSE_ENABLE_AUTH: "true"
  MCP_SSE_CORS_ORIGIN: "https://dashboard.example.com"
  P4_READONLY_MODE: "true"
  P4_DISABLE_DELETE: "true"
  LOG_LEVEL: "info"
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: mcp-perforce-sse
  namespace: mcp-perforce
  labels:
    app: mcp-perforce-sse
spec:
  replicas: 2
  selector:
    matchLabels:
      app: mcp-perforce-sse
  template:
    metadata:
      labels:
        app: mcp-perforce-sse
    spec:
      containers:
      - name: mcp-perforce
        image: mcp-perforce-server:latest
        imagePullPolicy: Always
        
        ports:
        - containerPort: 3000
          name: http
          protocol: TCP
        
        env:
        - name: P4PORT
          valueFrom:
            secretKeyRef:
              name: mcp-perforce-secrets
              key: p4port
        - name: P4USER
          valueFrom:
            secretKeyRef:
              name: mcp-perforce-secrets
              key: p4user
        - name: P4CLIENT
          valueFrom:
            secretKeyRef:
              name: mcp-perforce-secrets
              key: p4client
        - name: P4PASSWD
          valueFrom:
            secretKeyRef:
              name: mcp-perforce-secrets
              key: p4passwd
        - name: MCP_SSE_AUTH_TOKEN
          valueFrom:
            secretKeyRef:
              name: mcp-perforce-secrets
              key: mcp-auth-token
        
        envFrom:
        - configMapRef:
            name: mcp-perforce-config
        
        livenessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 30
          timeoutSeconds: 5
          failureThreshold: 3
        
        readinessProbe:
          httpGet:
            path: /health
            port: 3000
          initialDelaySeconds: 5
          periodSeconds: 10
          timeoutSeconds: 3
          failureThreshold: 2
        
        resources:
          requests:
            memory: "256Mi"
            cpu: "250m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        
        securityContext:
          runAsNonRoot: true
          runAsUser: 1000
          allowPrivilegeEscalation: false
          readOnlyRootFilesystem: true
---
apiVersion: v1
kind: Service
metadata:
  name: mcp-perforce-sse-service
  namespace: mcp-perforce
  labels:
    app: mcp-perforce-sse
spec:
  type: ClusterIP
  ports:
  - port: 3000
    targetPort: 3000
    protocol: TCP
    name: http
  selector:
    app: mcp-perforce-sse
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: mcp-perforce-ingress
  namespace: mcp-perforce
  annotations:
    kubernetes.io/ingress.class: nginx
    cert-manager.io/cluster-issuer: letsencrypt-prod
    nginx.ingress.kubernetes.io/proxy-read-timeout: "300"
    nginx.ingress.kubernetes.io/proxy-send-timeout: "300"
spec:
  tls:
  - hosts:
    - mcp.example.com
    secretName: mcp-perforce-tls
  rules:
  - host: mcp.example.com
    http:
      paths:
      - path: /
        pathType: Prefix
        backend:
          service:
            name: mcp-perforce-sse-service
            port:
              number: 3000
```

**Deploy:**
```bash
# Apply configuration
kubectl apply -f mcp-perforce-deployment.yaml

# Check status
kubectl get pods -n mcp-perforce
kubectl get svc -n mcp-perforce
kubectl get ingress -n mcp-perforce

# View logs
kubectl logs -n mcp-perforce -l app=mcp-perforce-sse -f

# Test health
curl https://mcp.example.com/health
```

### Example 4: Systemd Service (Linux)

**Scenario:** Running as a system service on Linux server

**/etc/systemd/system/mcp-perforce-sse.service:**
```ini
[Unit]
Description=MCP Perforce Server (SSE Transport)
After=network.target

[Service]
Type=simple
User=mcp
Group=mcp
WorkingDirectory=/opt/mcp-perforce

# Environment configuration
Environment="MCP_TRANSPORT=sse"
Environment="MCP_SSE_PORT=3000"
Environment="MCP_SSE_HOST=0.0.0.0"
Environment="MCP_SSE_ENABLE_AUTH=true"
Environment="MCP_SSE_CORS_ORIGIN=https://dashboard.example.com"
Environment="P4_READONLY_MODE=true"
Environment="P4_DISABLE_DELETE=true"
Environment="LOG_LEVEL=info"

# Load Perforce credentials from file
EnvironmentFile=/etc/mcp-perforce/credentials.env

# Command
ExecStart=/usr/bin/node /usr/local/lib/node_modules/mcp-perforce-server/dist/server.js

# Restart policy
Restart=always
RestartSec=10

# Security
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=strict
ProtectHome=true
ReadWritePaths=/var/log/mcp-perforce

# Logging
StandardOutput=journal
StandardError=journal
SyslogIdentifier=mcp-perforce-sse

[Install]
WantedBy=multi-user.target
```

**/etc/mcp-perforce/credentials.env:**
```bash
P4PORT=ssl:perforce.example.com:1666
P4USER=service-account
P4CLIENT=mcp-workspace
P4PASSWD=your-perforce-password
MCP_SSE_AUTH_TOKEN=your-secret-token
```

**Setup:**
```bash
# Create user
sudo useradd -r -s /bin/false mcp

# Create config directory
sudo mkdir -p /etc/mcp-perforce
sudo mkdir -p /var/log/mcp-perforce
sudo chown mcp:mcp /var/log/mcp-perforce

# Create credentials file
sudo nano /etc/mcp-perforce/credentials.env
sudo chmod 600 /etc/mcp-perforce/credentials.env
sudo chown mcp:mcp /etc/mcp-perforce/credentials.env

# Install and enable service
sudo systemctl daemon-reload
sudo systemctl enable mcp-perforce-sse
sudo systemctl start mcp-perforce-sse

# Check status
sudo systemctl status mcp-perforce-sse
sudo journalctl -u mcp-perforce-sse -f

# Test
curl http://localhost:3000/health
```

### Example 5: Nginx Reverse Proxy

**Scenario:** HTTPS termination and load balancing

**/etc/nginx/sites-available/mcp-perforce:**
```nginx
upstream mcp_perforce_backend {
    least_conn;
    server 127.0.0.1:3001;
    server 127.0.0.1:3002;
    server 127.0.0.1:3003;
}

# HTTP -> HTTPS redirect
server {
    listen 80;
    server_name mcp.example.com;
    return 301 https://$server_name$request_uri;
}

# HTTPS server
server {
    listen 443 ssl http2;
    server_name mcp.example.com;

    # SSL configuration
    ssl_certificate /etc/letsencrypt/live/mcp.example.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/mcp.example.com/privkey.pem;
    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers HIGH:!aNULL:!MD5;
    ssl_prefer_server_ciphers on;

    # Security headers
    add_header Strict-Transport-Security "max-age=31536000; includeSubDomains" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "DENY" always;
    add_header X-XSS-Protection "1; mode=block" always;

    # Logging
    access_log /var/log/nginx/mcp-perforce-access.log;
    error_log /var/log/nginx/mcp-perforce-error.log;

    # Rate limiting
    limit_req_zone $binary_remote_addr zone=mcp_limit:10m rate=10r/s;
    limit_req zone=mcp_limit burst=20 nodelay;

    # MCP endpoints
    location /mcp {
        proxy_pass http://mcp_perforce_backend;
        
        # SSE specific settings
        proxy_http_version 1.1;
        proxy_set_header Connection "";
        proxy_buffering off;
        proxy_cache off;
        
        # Timeouts for long-lived connections
        proxy_connect_timeout 300s;
        proxy_send_timeout 300s;
        proxy_read_timeout 300s;
        
        # Headers
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # Health check endpoint
    location /health {
        proxy_pass http://mcp_perforce_backend;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
    }

    # Deny all other locations
    location / {
        return 404;
    }
}
```

**Enable and test:**
```bash
# Enable site
sudo ln -s /etc/nginx/sites-available/mcp-perforce /etc/nginx/sites-enabled/
sudo nginx -t
sudo systemctl reload nginx

# Test
curl https://mcp.example.com/health
```

---

## Client Configuration

### JavaScript/TypeScript Client

**Install SDK:**
```bash
npm install @modelcontextprotocol/sdk
```

**Basic Client:**
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

async function connectToMCP() {
  // Configure transport
  const serverUrl = new URL('http://localhost:3000/mcp');
  const headers = {
    Authorization: 'Bearer your-token-here'  // If auth enabled
  };
  
  const transport = new SSEClientTransport(serverUrl, { headers });
  
  // Create client
  const client = new Client(
    {
      name: 'my-perforce-client',
      version: '1.0.0',
    },
    {
      capabilities: {},
    }
  );
  
  // Connect
  await client.connect(transport);
  
  // List available tools
  const tools = await client.listTools();
  console.log(`Connected! ${tools.tools.length} tools available`);
  
  // Call a tool
  const info = await client.callTool({
    name: 'p4.info',
    arguments: {}
  });
  
  console.log(info);
  
  // Close when done
  await client.close();
}

connectToMCP().catch(console.error);
```

**With Error Handling:**
```typescript
import { Client } from '@modelcontextprotocol/sdk/client/index.js';
import { SSEClientTransport } from '@modelcontextprotocol/sdk/client/sse.js';

class MCPPerforceClient {
  private client: Client | null = null;
  private connected = false;

  constructor(
    private serverUrl: string,
    private authToken?: string
  ) {}

  async connect(): Promise<void> {
    try {
      const url = new URL(this.serverUrl);
      const headers: Record<string, string> = {};
      
      if (this.authToken) {
        headers.Authorization = `Bearer ${this.authToken}`;
      }
      
      const transport = new SSEClientTransport(url, { headers });
      
      this.client = new Client(
        { name: 'perforce-dashboard', version: '1.0.0' },
        { capabilities: {} }
      );
      
      await this.client.connect(transport);
      this.connected = true;
      
      console.log('✓ Connected to MCP Perforce Server');
    } catch (error) {
      console.error('✗ Connection failed:', error);
      throw error;
    }
  }

  async callTool(name: string, args: Record<string, unknown>) {
    if (!this.connected || !this.client) {
      throw new Error('Not connected. Call connect() first.');
    }
    
    try {
      const result = await this.client.callTool({
        name,
        arguments: args
      });
      return result;
    } catch (error) {
      console.error(`Tool call failed: ${name}`, error);
      throw error;
    }
  }

  async disconnect(): Promise<void> {
    if (this.client) {
      await this.client.close();
      this.connected = false;
      console.log('✓ Disconnected');
    }
  }
}

// Usage
const client = new MCPPerforceClient(
  'http://localhost:3000/mcp',
  'your-token-here'
);

await client.connect();
const changes = await client.callTool('p4.changes', { max: 10 });
console.log(changes);
await client.disconnect();
```

### Browser-Based Client

**HTML + JavaScript:**
```html
<!DOCTYPE html>
<html>
<head>
  <title>MCP Perforce Dashboard</title>
  <script type="module">
    import { Client } from 'https://esm.sh/@modelcontextprotocol/sdk/client/index.js';
    import { SSEClientTransport } from 'https://esm.sh/@modelcontextprotocol/sdk/client/sse.js';

    const serverUrl = 'http://localhost:3000/mcp';
    const authToken = 'your-token-here';

    async function init() {
      const statusEl = document.getElementById('status');
      const outputEl = document.getElementById('output');
      
      try {
        statusEl.textContent = 'Connecting...';
        
        const transport = new SSEClientTransport(
          new URL(serverUrl),
          { headers: { Authorization: `Bearer ${authToken}` } }
        );
        
        const client = new Client(
          { name: 'web-dashboard', version: '1.0.0' },
          { capabilities: {} }
        );
        
        await client.connect(transport);
        statusEl.textContent = '✓ Connected';
        statusEl.style.color = 'green';
        
        // Get recent changes
        const result = await client.callTool({
          name: 'p4.changes',
          arguments: { max: 5 }
        });
        
        outputEl.textContent = JSON.stringify(result, null, 2);
        
      } catch (error) {
        statusEl.textContent = `✗ Error: ${error.message}`;
        statusEl.style.color = 'red';
      }
    }

    window.addEventListener('DOMContentLoaded', init);
  </script>
</head>
<body>
  <h1>MCP Perforce Dashboard</h1>
  <div id="status">Initializing...</div>
  <h2>Recent Changes:</h2>
  <pre id="output">Loading...</pre>
</body>
</html>
```

### Python Client

**Using requests and sseclient:**
```python
import requests
from sseclient import SSEClient
import json

class MCPPerforceClient:
    def __init__(self, base_url, auth_token=None):
        self.base_url = base_url.rstrip('/')
        self.auth_token = auth_token
        self.session = requests.Session()
        
        if auth_token:
            self.session.headers.update({
                'Authorization': f'Bearer {auth_token}'
            })
    
    def health_check(self):
        """Check server health"""
        response = self.session.get(f'{self.base_url}/health')
        response.raise_for_status()
        return response.json()
    
    def call_tool(self, tool_name, arguments=None):
        """Call an MCP tool"""
        if arguments is None:
            arguments = {}
        
        # MCP protocol message
        message = {
            'jsonrpc': '2.0',
            'id': 1,
            'method': 'tools/call',
            'params': {
                'name': tool_name,
                'arguments': arguments
            }
        }
        
        response = self.session.post(
            f'{self.base_url}/mcp',
            json=message,
            headers={'Content-Type': 'application/json'}
        )
        
        response.raise_for_status()
        return response.json()

# Usage
client = MCPPerforceClient(
    'http://localhost:3000',
    auth_token='your-token-here'
)

# Check health
health = client.health_check()
print(f"Server status: {health['status']}")

# Call p4.info
info = client.call_tool('p4.info')
print(json.dumps(info, indent=2))
```

---

## Production Deployment

### Checklist

- [ ] **Authentication enabled** (`MCP_SSE_ENABLE_AUTH=true`)
- [ ] **Strong token generated** (32+ random bytes)
- [ ] **HTTPS configured** (via reverse proxy)
- [ ] **CORS restricted** (specific origins, not `*`)
- [ ] **Readonly mode** (`P4_READONLY_MODE=true`)
- [ ] **Delete disabled** (`P4_DISABLE_DELETE=true`)
- [ ] **Rate limiting enabled** (`P4_ENABLE_RATE_LIMITING=true`)
- [ ] **Audit logging enabled** (`P4_ENABLE_AUDIT_LOGGING=true`)
- [ ] **Health checks configured** (load balancer/orchestrator)
- [ ] **Monitoring setup** (logs, metrics, alerts)
- [ ] **Backup credentials** (vault/secrets manager)
- [ ] **Firewall rules** (restrict network access)

### Production Environment Template

**.env.production:**
```bash
# Transport
MCP_TRANSPORT=sse
MCP_SSE_PORT=3000
MCP_SSE_HOST=0.0.0.0
MCP_SSE_PATH=/mcp
MCP_SSE_ENABLE_AUTH=true
MCP_SSE_AUTH_TOKEN=<generate-strong-token>
MCP_SSE_CORS_ORIGIN=https://dashboard.production.com

# Perforce (from secrets manager)
P4PORT=ssl:perforce.prod.com:1666
P4USER=svc-mcp-prod
P4CLIENT=mcp-prod-workspace
P4PASSWD=<from-vault>

# Security
P4_READONLY_MODE=true
P4_DISABLE_DELETE=true
P4_ENABLE_AUDIT_LOGGING=true
P4_ENABLE_RATE_LIMITING=true
P4_ENABLE_MEMORY_LIMITS=true
P4_PERFORMANCE_MODE=secure

# Logging
LOG_LEVEL=warn

# Rate limits
P4_RATE_LIMIT_REQUESTS=100
P4_RATE_LIMIT_WINDOW_MS=600000

# Memory
P4_MAX_MEMORY_MB=512
```

---

## Monitoring and Troubleshooting

### Health Monitoring

**Simple health check:**
```bash
#!/bin/bash
# health-check.sh

HEALTH_URL="http://localhost:3000/health"
AUTH_TOKEN="your-token-here"

response=$(curl -s -H "Authorization: Bearer $AUTH_TOKEN" "$HEALTH_URL")

if echo "$response" | grep -q '"status":"ok"'; then
  echo "✓ Server healthy"
  exit 0
else
  echo "✗ Server unhealthy: $response"
  exit 1
fi
```

**Monitoring with Prometheus:**
```yaml
# prometheus.yml
scrape_configs:
  - job_name: 'mcp-perforce'
    metrics_path: '/health'
    scheme: 'https'
    static_configs:
      - targets: ['mcp.example.com:443']
    bearer_token: 'your-token-here'
```

### Common Issues

#### Issue: Connection Refused

**Symptoms:**
```
Error: connect ECONNREFUSED 127.0.0.1:3000
```

**Solutions:**
1. Check server is running: `ps aux | grep mcp-perforce`
2. Check port is correct: `netstat -an | grep 3000`
3. Check firewall rules: `sudo ufw status`
4. Check server logs for errors

#### Issue: Authentication Failed

**Symptoms:**
```
401 Unauthorized
{"error":"Unauthorized"}
```

**Solutions:**
1. Verify `MCP_SSE_ENABLE_AUTH=true` on server
2. Check token matches: echo `$MCP_SSE_AUTH_TOKEN`
3. Verify client sends `Authorization: Bearer <token>` header
4. Check for token whitespace/encoding issues

#### Issue: CORS Error

**Symptoms:**
```
Access to XMLHttpRequest has been blocked by CORS policy
```

**Solutions:**
1. Set `MCP_SSE_CORS_ORIGIN` to include your origin
2. Use `*` for testing (not production)
3. Check browser console for exact origin error
4. Verify HTTPS/HTTP protocol matches

#### Issue: Perforce Authentication Failed

**Symptoms:**
```
Perforce password (P4PASSWD) invalid or unset
```

**Solutions:**
1. Check `.p4config` file exists and is readable
2. Verify `P4PORT`, `P4USER`, `P4CLIENT` are set
3. Test manually: `p4 -p $P4PORT -u $P4USER info`
4. Check P4PASSWD or use `p4 login` to generate ticket

### Logging

**Enable detailed logging:**
```bash
export LOG_LEVEL=debug
mcp-perforce-server --transport=sse
```

**Log to file:**
```bash
mcp-perforce-server --transport=sse 2>&1 | tee /var/log/mcp-perforce.log
```

---

## Advanced Scenarios

### Multi-Instance Load Balancing

Run multiple SSE server instances behind a load balancer:

```bash
# Instance 1
MCP_SSE_PORT=3001 mcp-perforce-server --transport=sse &

# Instance 2
MCP_SSE_PORT=3002 mcp-perforce-server --transport=sse &

# Instance 3
MCP_SSE_PORT=3003 mcp-perforce-server --transport=sse &

# Use nginx upstream (see Example 5 above)
```

### Custom Middleware

Wrap the server with custom Express middleware:

```javascript
import express from 'express';
import { MCPPerforceServer } from 'mcp-perforce-server';

const app = express();

// Custom middleware
app.use((req, res, next) => {
  console.log(`${req.method} ${req.url}`);
  next();
});

// Analytics middleware
app.use((req, res, next) => {
  const start = Date.now();
  res.on('finish', () => {
    const duration = Date.now() - start;
    console.log(`Request took ${duration}ms`);
  });
  next();
});

// Start MCP server with SSE
const mcpServer = new MCPPerforceServer();
await mcpServer.run('sse', {
  port: 3000,
  enableAuth: true,
  authToken: process.env.MCP_AUTH_TOKEN
});
```

### Read-Only Public Access + Write with Auth

```bash
# Public readonly instance (no auth)
MCP_SSE_PORT=3000 \
MCP_SSE_ENABLE_AUTH=false \
P4_READONLY_MODE=true \
mcp-perforce-server --transport=sse &

# Private write instance (with auth)
MCP_SSE_PORT=3001 \
MCP_SSE_ENABLE_AUTH=true \
MCP_SSE_AUTH_TOKEN=secret \
P4_READONLY_MODE=false \
P4_DISABLE_DELETE=true \
mcp-perforce-server --transport=sse &
```

### Per-User Workspaces

Configure different P4CLIENT per user:

```javascript
// Dynamic workspace assignment
const username = req.headers['x-user-id'];
const workspace = `mcp-${username}-workspace`;

// Pass to server as env
process.env.P4CLIENT = workspace;
```

---

## Summary

SSE transport enables the MCP Perforce Server to be deployed as a centralized HTTP service for web-based clients, dashboards, and API integrations. Key points:

- **Development**: Use default settings without auth for local testing
- **Production**: Always enable authentication, HTTPS, and security controls
- **Deployment**: Docker, Kubernetes, systemd, or reverse proxy options
- **Monitoring**: Health checks, logging, and metrics for reliability
- **Security**: Token auth, CORS, readonly mode, rate limiting

For additional help, see:
- [Main README](README.md)
- [MCP Configuration Examples](MCP_CONFIG_EXAMPLES.md)
- [Tools Reference](docs/TOOLS_REFERENCE.md)
- [Security Documentation](AGENTS.md#security-considerations)
