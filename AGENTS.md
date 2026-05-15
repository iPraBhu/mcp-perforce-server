# MCP Perforce Server Agents

This document describes all available agents (tools) provided by the MCP Perforce Server. Each agent corresponds to a specific Perforce operation that can be invoked through the Model Context Protocol.

MCP clients are advertised underscore-safe tool names such as `p4_changes`; the dotted names below remain accepted as backward-compatible aliases.

## Agent Categories

### Repository Operations

#### `p4.info`
**Description**: Get Perforce server and client information  
**Parameters**:
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Server info including user, client, server version, and configuration details

#### `p4.status`
**Description**: Get workspace status including opened files and pending changes  
**Parameters**:
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Status of opened files, pending changelists, and workspace state

#### `p4.sync`
**Description**: Sync files from the depot to workspace  
**Parameters**:
- `filespec` (optional): Single filespec to sync
- `filespecs` (optional): Multiple filespecs to sync in one command
- `force` (optional): Force sync even if files are opened
- `preview` / `summaryPreview` (optional): Preview full sync or summary-only preview
- `metadataOnly` / `safeSync` / `populateOnly` (optional): Native `-k`, `-s`, or `-p` sync modes
- `quiet`, `reopenMoved`, `useListOptimization`, `max`, `parallel` (optional): Additional native sync controls
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Sync results with file statistics

#### `p4.opened`
**Description**: List all opened files in the workspace  
**Parameters**:
- `changelist` (optional): Filter by changelist number
- `files` (optional): Limit the result to specific files/filespecs
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of opened files with their status and changelist information

#### `p4.have`
**Description**: List files that are synced to the workspace  
**Parameters**:
- `filespec` (optional): Single filespec to check
- `filespecs` (optional): Multiple filespecs to check in one command
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of synced files with revision information

#### `p4.where`
**Description**: Show depot, workspace, and local file mappings  
**Parameters**:
- `files`: Files to show mappings for
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Mapping information for each file

### File Operations

#### `p4.add`
**Description**: Add files to Perforce control  
**Parameters**:
- `files`: Files to add
- `changelist` (optional): Changelist to add files to
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of adding files to version control

#### `p4.edit`
**Description**: Open files for edit  
**Parameters**:
- `files`: Files to open for edit
- `changelist` (optional): Changelist to associate with
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of opening files for edit

#### `p4.delete`
**Description**: Mark files for deletion  
**Parameters**:
- `files`: Files to mark for deletion
- `changelist` (optional): Changelist to associate with
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of marking files for deletion

#### `p4.revert`
**Description**: Revert changes to files  
**Parameters**:
- `files` (optional): Specific files to revert (reverts all if not specified)
- `changelist` (optional): Changelist to revert
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of reverting file changes

#### `p4.diff`
**Description**: Show differences between workspace and depot versions  
**Parameters**:
- `files` (optional): Specific files to diff
- `summary` (optional): Show summary only (like `p4 diff -s`)
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Unified diff output showing changes

#### `p4.diff2`
**Description**: Compare two depot paths server-side (equivalent to `p4 diff2`; no workspace mapping required)  
**Parameters**:
- `sourcePath`: First depot path/filespec to compare
- `targetPath`: Second depot path/filespec to compare
- `summaryOnly` (optional, default true): If true, list only differing files (like `p4 diff2 -q`); if false, include full diff output
- `workspacePath` (optional): Path to workspace directory for P4 config context  
**Returns**: Depot-to-depot diff results including differing file pairs and optional diff content

#### `p4.copy`
**Description**: Copy files between locations  
**Parameters**:
- `from`: Source file path
- `to`: Destination file path
- `changelist` (optional): Changelist to associate with
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of copying files

#### `p4.move`
**Description**: Move/rename files  
**Parameters**:
- `from`: Source file path
- `to`: Destination file path
- `changelist` (optional): Changelist to associate with
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of moving/renaming files

#### `p4.integrate`
**Description**: Integrate files from source path to target path  
**Parameters**:
- `source`: Source filespec/path
- `target`: Target filespec/path
- `changelist` (optional): Changelist to associate with
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Integration results for opened target files

#### `p4.merge`
**Description**: Merge files from source path to target path  
**Parameters**:
- `source`: Source filespec/path
- `target`: Target filespec/path
- `changelist` (optional): Changelist to associate with
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Merge/open results for target files

#### `p4.blame`
**Description**: Show file annotations (like git blame)  
**Parameters**:
- `file` (optional): Single file to annotate
- `files` (optional): Multiple files to annotate in one command
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Line-by-line attribution showing who last changed each line

#### `p4.annotate`
**Description**: Alias for file annotations (`p4.blame`)  
**Parameters**:
- `file` (optional): Single file to annotate
- `files` (optional): Multiple files to annotate in one command
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Line-by-line attribution showing who last changed each line

### Merge & Conflict Resolution

#### `p4.resolve`
**Description**: Resolve merge conflicts  
**Parameters**:
- `files` (optional): Specific files to resolve
- `auto` (optional): Automatically resolve non-conflicting changes
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of conflict resolution

#### `p4.shelve`
**Description**: Shelve files for code review  
**Parameters**:
- `files` (optional): Files to shelve
- `changelist`: Changelist to shelve
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of shelving files

#### `p4.unshelve`
**Description**: Unshelve files from review  
**Parameters**:
- `changelist`: Changelist to unshelve
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Results of unshelving files

### Changelist Operations

#### `p4.changelist.create`
**Description**: Create a new changelist  
**Parameters**:
- `description`: Description for the changelist
- `workspacePath` (optional): Path to workspace directory  
**Returns**: New changelist number and details

#### `p4.changelist.update`
**Description**: Update changelist description or files  
**Parameters**:
- `changelist`: Changelist number to update
- `description` (optional): New description
- `files` (optional): Files to add/remove from changelist
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Updated changelist information

#### `p4.changelist.submit`
**Description**: Submit a changelist  
**Parameters**:
- `changelist`: Changelist number to submit
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Submission results and new changelist number

#### `p4.submit`
**Description**: Submit the default changelist  
**Parameters**:
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Submission results

#### `p4.describe`
**Description**: Get detailed changelist information (equivalent to `p4 describe -s` or `p4 describe -d<format>`)  
**Parameters**:
- `changelist`: Changelist number to describe (string or number)
- `includeDiff` (optional): Include diff content from `p4 describe -d*`
- `diffFormat` (optional): Diff format (`u`, `c`, `n`, `s`) when `includeDiff=true`
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Complete changelist details including metadata, description, affected files, and optional diff content

#### `p4.changes`
**Description**: List changelists with filtering  
**Parameters**:
- `max` (optional): Maximum number of changelists to return
- `user` (optional): Filter by user
- `client` (optional): Filter by client/workspace
- `status` (optional): Filter by status (pending, submitted, etc.)
- `filespec` (optional): Single filespec filter
- `filespecs` (optional): Multiple filespec filters in one command
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of changelists matching criteria

#### `p4.review`
**Description**: List changelists pending review  
**Parameters**:
- `counter` (optional): Review counter/token (`p4 review -t`)
- `filespec` (optional): Filespec filter
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of pending changelists

#### `p4.reviews`
**Description**: List reviewers for files or a changelist  
**Parameters**:
- `changelist` (optional): Changelist to resolve reviewers for
- `files` (optional): Files/filespecs to resolve reviewers for
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of matching reviewers

#### `p4.interchanges`
**Description**: List changelists not yet integrated between two paths  
**Parameters**:
- `sourcePath` / `targetPath` / `targetPaths`: Direct path mode
- `branch` with optional `sourcePath`, `targetPath`, `targetPaths`, `useBranchSource`: Native branch-spec modes
- `stream` with optional `parentStream`, `targetPath`, `targetPaths`, `forceStreamFlow`: Native stream mode
- `max` (optional): Maximum changelists to return
- `longDescription`, `reverse`, `time`, `user` (optional): Additional native output and filter flags
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Changelists eligible for integration

#### `p4.integrated`
**Description**: Show integration history between source and target  
**Parameters**:
- `sourcePath` (optional): Source depot path/filespec
- `targetPath` (optional): Target depot path/filespec
- `files` (optional): Native file/filespec filters for `p4 integrated`
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Integration history records

### Workflow Composites

#### `p4.review.bundle`
**Description**: Composite review helper that bundles pending review changelists with optional details and reviewers  
**Parameters**:
- `counter` (optional): Review counter/token for `p4 review -t`
- `filespec` (optional): Filespec filter
- `maxChanges` (optional): Maximum changelists to include
- `includeDescribe` (optional): Include `p4.describe` details per changelist (default true)
- `includeReviewers` (optional): Include `p4.reviews` reviewers per changelist (default true)
- `workspacePath` (optional): Path to workspace directory  
**Returns**: One bundled response containing summary, step status, and per-change review context

#### `p4.change.inspect`
**Description**: Composite changelist inspection for code review context  
**Parameters**:
- `changelist`: Changelist number to inspect
- `includeDiff` (optional): Include `p4.describe` diff content in the inspection response
- `diffFormat` (optional): Diff format (`u`, `c`, `n`, `s`) for describe output
- `includeFileHistory` (optional): Include `p4.filelog` for affected files
- `maxFilesWithHistory` (optional): Max files to fetch history for
- `maxRevisions` (optional): Max revisions per file history call
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Aggregated describe/fixes/reviewers output (plus optional file history) in one response

#### `p4.path.synccheck`
**Description**: Composite path synchronization analysis between two depot paths  
**Parameters**:
- `sourcePath`: Source depot path/filespec
- `targetPath`: Target depot path/filespec
- `maxInterchanges` (optional): Max interchanges per direction
- `includeIntegrated` (optional): Include `p4.integrated` history (default true)
- `checkBothDirections` (optional): Analyze reverse direction too (default true)
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Aggregated drift and sync-state summary plus forward/reverse step details

#### `p4.file.inspect`
**Description**: MCP-only composite file inspection helper  
**Parameters**:
- `filespec` / `filespecs`: One or more files to inspect
- `includeFstat` (optional): Include metadata from `p4.fstat` (default true)
- `includeHistory` (optional): Include history from `p4.filelog` (default true)
- `includeContent` (optional): Include file content from `p4.print`
- `includeBlame` (optional): Include line attribution from `p4.blame`
- `maxFiles` / `maxRevisions` (optional): Caps for composite subcalls
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Per-file bundle of metadata, history, optional content, and optional blame output

#### `p4.workspace.snapshot`
**Description**: MCP-only composite workspace context helper  
**Parameters**:
- `includeConfig` (optional): Include `p4.config.detect` output (default true)
- `includeOpened` (optional): Include full `p4.opened` output
- `includeRecentChanges` (optional): Include recent changelists via `p4.changes`
- `recentChangesMax` (optional): Max changelists included when `includeRecentChanges=true`
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Aggregated workspace info, status, optional config, optional opened files, and optional recent changes

#### `p4.search.inspect`
**Description**: MCP-only composite search helper for code-aware search results  
**Parameters**:
- `pattern`: Search pattern for `p4.grep`
- `filespec` / `filespecs` (optional): One or more filespec filters
- `caseInsensitive` (optional): Case insensitive search
- `maxFiles` / `maxMatchesPerFile` (optional): Caps for returned matched files and per-file matches
- `includeFstat` (optional): Include file metadata from `p4.fstat` (default true)
- `includeContentPreview` (optional): Include matched context snippets from `p4.print`
- `previewContextLines` (optional): Context lines around each match (default 2)
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Grouped search hits with optional file metadata and optional surrounding content snippets

#### `p4.review.prepare`
**Description**: MCP-only review preparation helper for building review-ready changelist bundles  
**Parameters**:
- `changelist` / `changelists` (optional): Explicit changelists to inspect directly
- `status`, `user`, `client`, `filespec`, `filespecs` (optional): Discovery filters when explicit changelists are not provided
- `maxChanges` (optional): Maximum changelists to inspect
- `includeDiff` / `diffFormat` (optional): Include diff content in each changelist inspection bundle
- `includeFileHistory`, `maxFilesWithHistory`, `maxRevisions` (optional): Include `p4.filelog` context per change
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Review-ready list of changelists, each with an embedded `p4.change.inspect` bundle plus optional discovery step output

### Search & Discovery

#### `p4.grep`
**Description**: Search for text patterns across files  
**Parameters**:
- `pattern`: Regular expression pattern to search for
- `filespec` (optional): Single filespec to search in
- `filespecs` (optional): Multiple filespecs to search in one command
- `caseInsensitive` (optional): Case insensitive search
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Search results with file locations and matching lines

#### `p4.files`
**Description**: List files in depot with metadata  
**Parameters**:
- `filespec` (optional): Single depot filespec to list from
- `filespecs` (optional): Multiple depot filespecs to list in one command
- `allRevisions`, `archiveDepot`, `existingOnly`, `ignoreCase` (optional): Native `p4 files` flags
- `workspacePath` (optional): Path to workspace directory  
**Returns**: File list with revision, size, and type information

#### `p4.dirs`
**Description**: List directories in depot  
**Parameters**:
- `filespec` (optional): Single depot filespec to list directories from
- `filespecs` (optional): Multiple depot filespecs to list directories from in one command
- `ignoreCase`, `onlyClientMapped`, `includeDeleted`, `onlyHave`, `stream` (optional): Native `p4 dirs` flags
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Directory listing

#### `p4.filelog`
**Description**: Show file revision history  
**Parameters**:
- `filespec` (optional): Single filespec to show history for
- `filespecs` (optional): Multiple filespecs to show history for in one command
- `maxRevisions` (optional): Maximum revisions to show
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Revision history with changelist information

#### `p4.fstat`
**Description**: Show file metadata (`p4 fstat`)  
**Parameters**:
- `filespec` (optional): Single filespec to inspect
- `filespecs` (optional): Multiple filespecs to inspect in one command
- `max` (optional): Maximum results
- `filter`, `fields`, `reverseOrder`, `attributePattern`, `changeAfter`, `changelist` (optional): Common native `p4 fstat` selectors
- `outputOptions`, `limitOptions`, `sortOptions` (optional): Raw `-O*`, `-R*`, `-S*` option suffixes
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Structured metadata records for matching files

#### `p4.print`
**Description**: Print depot file content (`p4 print`)  
**Parameters**:
- `filespec` (optional): Single filespec to print
- `filespecs` (optional): Multiple filespecs to print in one command
- `quiet` (optional, default true): Suppress headers
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Printed file content

### User & Client Management

#### `p4.users`
**Description**: List Perforce users  
**Parameters**:
- `user` (optional): Single user filter
- `users` (optional): Multiple user filters in one command
- `includeServiceUsers` (optional): Include service/operator users via `-a`
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of users with their details

#### `p4.user`
**Description**: Get detailed user information  
**Parameters**:
- `user`: Username to get information for
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Complete user information

#### `p4.clients`
**Description**: List workspaces/clients  
**Parameters**:
- `user` (optional): Filter by user
- `stream`, `nameFilter`, `caseInsensitiveNameFilter`, `unloaded`, `allServers`, `serverId` (optional): Additional native `p4 clients` filters
- `max` (optional): Maximum number of results
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of client workspaces

#### `p4.client`
**Description**: Get workspace/client details  
**Parameters**:
- `client`: Client name to get details for
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Complete client/workspace configuration

### Job & Issue Tracking

#### `p4.jobs`
**Description**: List jobs (if job tracking is enabled)  
**Parameters**:
- `job` (optional): Specific job to show
- `files` (optional): File/filespec filters
- `jobView`, `includeIntegrated`, `reverseOrder` (optional): Additional native `p4 jobs` filters
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of jobs

#### `p4.job`
**Description**: Get job details  
**Parameters**:
- `job`: Job ID to get details for
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Complete job information

#### `p4.fixes`
**Description**: Show changelist-job relationships  
**Parameters**:
- `changelist` (optional): Filter by changelist
- `job` (optional): Filter by job
- `files` (optional): File/filespec filters
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Relationships between changelists and jobs

### Labels & Organization

#### `p4.labels`
**Description**: List labels  
**Parameters**:
- `label`, `user`, `max` (optional): Existing filters
- `filespec` / `filespecs` (optional): Filter labels containing matching files
- `nameFilter`, `caseInsensitiveNameFilter`, `unloaded`, `autoreloadOnly`, `allServers`, `serverId` (optional): Additional native `p4 labels` flags
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of labels

#### `p4.label`
**Description**: Get label details  
**Parameters**:
- `label`: Label name to get details for
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Complete label information including files

#### `p4.streams`
**Description**: List streams  
**Parameters**:
- `stream` (optional): Single stream path filter
- `streams` (optional): Multiple stream path filters in one command
- `unloaded`, `filter`, `viewMatch` (optional): Additional native `p4 streams` selectors
- `max` (optional): Maximum results
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of streams

#### `p4.stream`
**Description**: Get stream specification  
**Parameters**:
- `stream`: Stream path/name
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Stream spec details

### Analytics & Monitoring

#### `p4.sizes`
**Description**: Get file size and disk usage statistics  
**Parameters**:
- `filespec` (optional): Single filespec or pattern
- `filespecs` (optional): Multiple filespecs or patterns in one command
- `allRevisions`, `shelvedOnly`, `omitLazyCopies`, `max`, `blockSize` (optional): Additional native `p4 sizes` controls
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Size statistics and disk usage information

#### `p4.audit`
**Description**: Query audit logs and compliance reporting  
**Parameters**:
- `user` (optional): Filter by user
- `command` (optional): Filter by command
- `max` (optional): Maximum entries to return
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Audit log entries for compliance reporting

#### `p4.compliance`
**Description**: Get compliance configuration and status  
**Parameters**:
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Compliance settings and current status

### Utilities

#### `p4.config.detect`
**Description**: Detect and validate Perforce configuration  
**Parameters**:
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Configuration diagnostics and validation results

## Security Considerations

All agents include comprehensive security measures:
- **Input sanitization** to prevent injection attacks
- **Path traversal protection** 
- **Rate limiting** to prevent abuse
- **Audit logging** for compliance
- **Read-only mode** support for secure environments
- **Memory management** to prevent resource exhaustion

## Error Handling

All agents return structured JSON responses with:
- `ok`: Boolean indicating success/failure
- `result`: Operation results or error details
- `error`: Error message if operation failed
- `configUsed`: Configuration information used for the operation

## Configuration

Agents automatically detect Perforce configuration through:
- Environment variables (`P4PORT`, `P4USER`, `P4CLIENT`, etc.)
- `.p4config` files with upward directory search
- Command-line parameters for workspace-specific operations

For more information about configuration options, see the main README.md file.</content>
<parameter name="filePath">c:\Tools\git-projects\mcp-perforce-server\AGENTS.md
