# Perforce Setup

Use this guide to configure Perforce credentials and runtime settings for `mcp-perforce-server`.

## Perforce Connection Variables

Set these in `.p4config` (recommended) or MCP `env`.

| Variable | Required | Example | Description |
|---|---|---|---|
| `P4PORT` | Yes | `perforce.yourcompany.com:1666` | Perforce server address. |
| `P4USER` | Yes | `your-username` | Perforce username. |
| `P4CLIENT` | Yes | `your-workspace` | Perforce client/workspace name. |
| `P4PASSWD` | No | `your-password` | Password/ticket, depending on auth setup. |
| `P4CHARSET` | No | `utf8` | Character set for unicode servers. |
| `P4COMMANDCHARSET` | No | `utf8` | Charset for command input/output conversion. |
| `P4LANGUAGE` | No | `en` | Localized language setting. |
| `P4DIFF` | No | `diff` | Custom diff tool command. |
| `P4MERGE` | No | `p4merge` | Custom merge tool command. |
| `P4EDITOR` | No | `notepad` | Editor used for specs/changelists. |

Recommended `.p4config` in project/workspace root:

```ini
P4PORT=perforce.yourcompany.com:1666
P4USER=your-username
P4CLIENT=your-workspace
P4PASSWD=your-password
```

Optional config-file name override:

| Variable | Default | Description |
|---|---|---|
| `P4CONFIG` | `.p4config` | File name used for upward `.p4config` discovery. |

## Access and Safety Defaults

| Variable | Default | Description |
|---|---|---|
| `P4_READONLY_MODE` | `true` | Read-only by default; write-capable tools are blocked. |
| `P4_DISABLE_DELETE` | `true` | Delete operations are blocked by default. |
| `P4_ENABLE_INPUT_SANITIZATION` | `true` | Input sanitization remains enabled unless explicitly set to `false`. |

## Performance Mode Defaults

| Variable | `fast` (default) | `balanced` | `secure` |
|---|---|---|---|
| `P4_PERFORMANCE_MODE` | `fast` | `balanced` | `secure` |
| `P4_TIMEOUT_MS` | `5000` | `10000` | `15000` |
| `P4_CONFIG_CACHE_TTL` | `600000` | `300000` | `300000` |
| `P4_RESPONSE_CACHE_TTL_MS` | `5000` | `3000` | `1000` |
| `P4_RESPONSE_CACHE_MAX_ENTRIES` | `400` | `250` | `100` |
| `P4_ENABLE_RATE_LIMITING` | `false` | `false` | `true` |
| `P4_ENABLE_MEMORY_LIMITS` | `false` | `true` | `true` |
| `P4_ENABLE_AUDIT_LOGGING` | `false` | `false` | `true` |

## Runtime and Compliance Configuration

| Variable | Default | Description |
|---|---|---|
| `P4_PATH` | `p4` / `p4.exe` | Custom Perforce executable path. |
| `LOG_LEVEL` | `warn` | Logging level: `error`, `warn`, `info`, `debug`. |
| `P4_PRETTY_JSON` | `false` | Pretty-print JSON responses when `true`. |
| `P4_RESPONSE_CACHE` | `true` | Enable/disable read-result cache. |
| `P4_MAX_MEMORY_MB` | `512` | Memory limit used for command runtime checks. |
| `P4_AUDIT_RETENTION_DAYS` | `90` | Audit log retention in days. |
| `P4_RATE_LIMIT_REQUESTS` | `100` | Max requests per rate-limit window. |
| `P4_RATE_LIMIT_WINDOW_MS` | `600000` | Rate-limit window in milliseconds. |
| `P4_RATE_LIMIT_BLOCK_MS` | `3600000` | Block duration in milliseconds once throttled. |

## PowerShell Environment Example (Windows)

```powershell
$env:P4PORT = "perforce.yourcompany.com:1666"
$env:P4USER = "your-username"
$env:P4CLIENT = "your-workspace"
$env:P4PASSWD = "your-password"
$env:P4_READONLY_MODE = "true"
$env:P4_DISABLE_DELETE = "true"
```

## Notes

- Do not commit real credentials to source control.
- `.p4config` discovery is automatic (searched upward from `workspacePath` or current directory).
- For tool arguments and behavior, see `docs/TOOLS_REFERENCE.md`.
- For client JSON examples, see `MCP_CONFIG_EXAMPLES.md`.
