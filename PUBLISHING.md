# Publishing MCP Perforce Server to npm

This document provides complete workflows for publishing new versions of the MCP Perforce Server to npm.

## **Method 1: Manual Publishing**

### 1. Prerequisites
```bash
# Ensure you're logged into npm
npm whoami

# If not logged in:
npm login
```

### 2. Pre-publish Checks
```bash
# Install dependencies
npm ci

# Run build
npm run build

# Run tests
npm test

# Run integration tests  
npm run test:integration

# Check for security vulnerabilities
npm audit
```

### 3. Version Bump
```bash
# For patch version (2.1.1 → 2.1.2)
npm version patch

# For minor version (2.1.1 → 2.2.0)  
npm version minor

# For major version (2.1.1 → 3.0.0)
npm version major

# Or set specific version
npm version 2.2.0
```

### 4. Pre-publish Validation
```bash
# Check what will be published
npm pack --dry-run

# Verify package contents
npm pack
tar -tzf mcp-perforce-server-*.tgz
rm mcp-perforce-server-*.tgz
```

### 5. Publish to npm
```bash
# The prepublishOnly script will run automatically (clean + build)
npm publish --access public

# Or with additional safety checks:
npm publish --access public --dry-run  # Test first
npm publish --access public           # Actual publish
```

### 6. Post-publish
```bash
# Push version tag to GitHub
git push origin main --tags

# Create GitHub release (optional)
gh release create v2.2.0 --title "Release v2.2.0" --notes "Release notes here"
```

## **Method 2: Automated Publishing (Recommended)**

### 1. Version Update & Commit
```bash
# Update version in package.json
npm version patch  # or minor/major

# Push to GitHub
git push origin main --tags
```

### 2. Create GitHub Release
```bash
# Using GitHub CLI
gh release create v2.2.0 --title "Release v2.2.0" --notes "Release notes here"

# Or manually via GitHub web interface:
# 1. Go to https://github.com/iPraBhu/mcp-perforce-server/releases
# 2. Click "Create a new release"  
# 3. Choose tag: v2.2.0 (or the version you bumped to)
# 4. Fill in release title and description
# 5. Click "Publish release"
```

### 3. Automated Publishing
The GitHub Action `.github/workflows/publish-npm.yml` will automatically:
- ✅ Install dependencies
- ✅ Build the package  
- ✅ Run tests
- ✅ Validate the release tag matches package version
- ✅ Check if version already exists on npm
- ✅ Publish to npm with provenance

## **Complete Manual Workflow Example**

```bash
# 1. Ensure clean working directory
git status
git pull origin main

# 2. Run full test suite
npm ci
npm run build
npm test  
npm run test:integration

# 3. Update version
npm version patch

# 4. Verify what will be published
npm pack --dry-run

# 5. Publish to npm
npm publish --access public

# 6. Push to GitHub
git push origin main --tags

# 7. Create GitHub release
gh release create v$(node -p "require('./package.json').version") \
  --title "Release v$(node -p "require('./package.json').version")" \
  --generate-notes
```

## **Quick Commands Reference**

| Task | Command |
|------|---------|
| Check npm login | `npm whoami` |
| Version bump (patch) | `npm version patch` |
| Version bump (minor) | `npm version minor` |  
| Version bump (major) | `npm version major` |
| Test publish | `npm publish --dry-run` |
| Actual publish | `npm publish --access public` |
| Check package contents | `npm pack --dry-run` |
| Push with tags | `git push origin main --tags` |

## **Package Configuration**

Current configuration from `package.json`:
- **Name**: `mcp-perforce-server`
- **Current Version**: `2.1.1` 
- **Main**: `dist/server.js`
- **Binary**: `mcp-perforce-server` pointing to `dist/server.js`
- **Published Files**: `dist/**/*`, `README.md`, `MCP_CONFIG_EXAMPLES.md`, `LICENSE`
- **Access**: Public
- **Node Engine**: `>=18.0.0`

## **Automated Scripts**

The following npm scripts are configured for publishing:
- `prepare`: Runs build before installation
- `prepublishOnly`: Cleans and builds before publishing
- `build`: Compiles TypeScript to `dist/`
- `test`: Runs test suite
- `test:integration`: Runs integration tests

## **Security & Validation**

- ⚠️ **NPM_TOKEN** secret must be configured in GitHub repository settings for automated publishing
- ✅ Input sanitization and security checks are built into the package
- ✅ Version validation ensures GitHub release tags match package.json version  
- ✅ Duplicate version publishing is prevented by automated checks
- ✅ Provenance attestation is included with automated publishing

## **Notes**

- **Recommendation**: Use the automated workflow (Method 2) for consistency and safety
- Manual publishing (Method 1) is good for testing or when the automated pipeline isn't available
- The package includes 47 MCP tools covering comprehensive Perforce operations
- Enterprise-ready with SOC 2, GDPR, and HIPAA compliance features
- Cross-platform support (Windows, macOS, Linux)

## **Troubleshooting**

### Common Issues
```bash
# If npm login fails
npm config set registry https://registry.npmjs.org/
npm login

# If build fails
npm run clean
npm ci
npm run build

# If tests fail
npm test -- --verbose

# Check package size
npm pack --dry-run | grep "package size"
```

### Version Conflicts
```bash
# Check current published version
npm view mcp-perforce-server version

# Check local version
node -p "require('./package.json').version"

# Force version if needed
npm version --force 2.1.2
```