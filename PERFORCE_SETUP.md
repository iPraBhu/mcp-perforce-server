# Perforce Environment Configuration Example

# Required environment variables for your Perforce connection:
P4PORT=your-perforce-server:1666          # Your Perforce server address
P4USER=your-username                       # Your Perforce username  
P4CLIENT=your-workspace-name               # Your workspace/client name
P4PASSWD=your-password                     # Your Perforce password (optional if using tickets)

# Optional configuration:
P4CONFIG=.p4config                         # Use .p4config files for per-project settings

# Example PowerShell commands to set these:
$env:P4PORT = "perforce.yourcompany.com:1666"
$env:P4USER = "your-username"
$env:P4CLIENT = "your-workspace"

# Or create a .p4config file in your project directory with:
# P4PORT=perforce.yourcompany.com:1666
# P4USER=your-username  
# P4CLIENT=your-workspace

# ============================================
# PERFORMANCE OPTIMIZATION SETTINGS
# ============================================

# For Development (Maximum Speed):
P4_PERFORMANCE_MODE=fast
P4_TIMEOUT_MS=5000
P4_ENABLE_RATE_LIMITING=false
P4_ENABLE_MEMORY_LIMITS=false
P4_ENABLE_AUDIT_LOGGING=false
P4_CONFIG_CACHE_TTL=600000

# For Production (Security + Performance Balance):
P4_PERFORMANCE_MODE=secure
P4_TIMEOUT_MS=15000
P4_ENABLE_RATE_LIMITING=true
P4_ENABLE_MEMORY_LIMITS=true
P4_ENABLE_AUDIT_LOGGING=true
P4_CONFIG_CACHE_TTL=300000

# Custom Performance Tuning:
P4_MAX_MEMORY_MB=1024                      # Memory limit in MB
P4_RATE_LIMIT_REQUESTS=100                 # Max requests per window
P4_RATE_LIMIT_WINDOW_MS=600000             # Rate limit window (10 minutes)

# ============================================
# SECURITY & COMPLIANCE SETTINGS  
# ============================================

# Basic Security:
P4_READONLY_MODE=true                      # Enable read-only mode
P4_DISABLE_DELETE=true                     # Disable delete operations
P4_ENABLE_INPUT_SANITIZATION=true         # Enable input validation

# Enterprise Security Features:
P4_ENABLE_AUDIT_LOGGING=true               # Enable audit logging
P4_AUDIT_RETENTION_DAYS=90                 # Audit log retention period
P4_ENABLE_SECURITY=true                    # Enable all security features