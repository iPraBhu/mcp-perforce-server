# Perforce Setup

Use this guide to configure Perforce credentials and runtime settings for `mcp-perforce-server`.

## 1. Required Perforce Variables

Set these using either a `.p4config` file (recommended) or environment variables.

```ini
P4PORT=your-perforce-server:1666
P4USER=your-username
P4CLIENT=your-workspace-name
P4PASSWD=your-password
```

## 2. Recommended `.p4config` Setup

Create a `.p4config` file in your project/workspace root:

```ini
P4PORT=perforce.yourcompany.com:1666
P4USER=your-username
P4CLIENT=your-workspace
P4PASSWD=your-password
```

Optional custom config file name:

```ini
P4CONFIG=.p4config
```

## 3. PowerShell Environment Setup (Windows)

```powershell
$env:P4PORT = "perforce.yourcompany.com:1666"
$env:P4USER = "your-username"
$env:P4CLIENT = "your-workspace"
$env:P4PASSWD = "your-password"
```

## 4. Performance Profiles

Default mode is `fast`.

### Fast (default)

```ini
P4_PERFORMANCE_MODE=fast
P4_TIMEOUT_MS=5000
P4_CONFIG_CACHE_TTL=600000
P4_RESPONSE_CACHE=true
P4_RESPONSE_CACHE_TTL_MS=5000
P4_RESPONSE_CACHE_MAX_ENTRIES=400
P4_ENABLE_RATE_LIMITING=false
P4_ENABLE_MEMORY_LIMITS=false
P4_ENABLE_AUDIT_LOGGING=false
```

### Balanced

```ini
P4_PERFORMANCE_MODE=balanced
P4_TIMEOUT_MS=10000
P4_CONFIG_CACHE_TTL=300000
P4_RESPONSE_CACHE=true
P4_RESPONSE_CACHE_TTL_MS=3000
P4_RESPONSE_CACHE_MAX_ENTRIES=250
P4_ENABLE_RATE_LIMITING=false
P4_ENABLE_MEMORY_LIMITS=true
P4_ENABLE_AUDIT_LOGGING=false
```

### Secure

```ini
P4_PERFORMANCE_MODE=secure
P4_TIMEOUT_MS=15000
P4_CONFIG_CACHE_TTL=300000
P4_RESPONSE_CACHE=true
P4_RESPONSE_CACHE_TTL_MS=1000
P4_RESPONSE_CACHE_MAX_ENTRIES=100
P4_ENABLE_RATE_LIMITING=true
P4_ENABLE_MEMORY_LIMITS=true
P4_ENABLE_AUDIT_LOGGING=true
```

## 5. Security Controls

```ini
P4_READONLY_MODE=true
P4_DISABLE_DELETE=true
P4_ENABLE_INPUT_SANITIZATION=true
```

Additional controls:

```ini
P4_MAX_MEMORY_MB=512
P4_AUDIT_RETENTION_DAYS=90
P4_RATE_LIMIT_REQUESTS=100
P4_RATE_LIMIT_WINDOW_MS=600000
P4_RATE_LIMIT_BLOCK_MS=3600000
```

## 6. Notes

- Do not commit real credentials to source control.
- `.p4config` discovery is automatic (searched upward from `workspacePath`/current directory).
- For details on all tools and args, see `docs/TOOLS_REFERENCE.md`.
