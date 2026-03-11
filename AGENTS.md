# MCP Perforce Server Agents

This document describes all available agents (tools) provided by the MCP Perforce Server. Each agent corresponds to a specific Perforce operation that can be invoked through the Model Context Protocol.

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
- `files` (optional): Specific files or patterns to sync
- `force` (optional): Force sync even if files are opened
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Sync results with file statistics

#### `p4.opened`
**Description**: List all opened files in the workspace  
**Parameters**:
- `changelist` (optional): Filter by changelist number
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of opened files with their status and changelist information

#### `p4.have`
**Description**: List files that are synced to the workspace  
**Parameters**:
- `files` (optional): Specific files or patterns to check
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
- `file`: File to annotate
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Line-by-line attribution showing who last changed each line

#### `p4.annotate`
**Description**: Alias for file annotations (`p4.blame`)  
**Parameters**:
- `file`: File to annotate
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
- `sourcePath`: Source depot path/filespec
- `targetPath`: Target depot path/filespec
- `max` (optional): Maximum changelists to return
- `longDescription` (optional): Include long descriptions (`-l`)
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Changelists eligible for integration

#### `p4.integrated`
**Description**: Show integration history between source and target  
**Parameters**:
- `sourcePath`: Source depot path/filespec
- `targetPath` (optional): Target depot path/filespec
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

### Search & Discovery

#### `p4.grep`
**Description**: Search for text patterns across files  
**Parameters**:
- `pattern`: Regular expression pattern to search for
- `files` (optional): File patterns to search in
- `caseInsensitive` (optional): Case insensitive search
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Search results with file locations and matching lines

#### `p4.files`
**Description**: List files in depot with metadata  
**Parameters**:
- `path`: Depot path to list files from
- `workspacePath` (optional): Path to workspace directory  
**Returns**: File list with revision, size, and type information

#### `p4.dirs`
**Description**: List directories in depot  
**Parameters**:
- `path`: Depot path to list directories from
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Directory listing

#### `p4.filelog`
**Description**: Show file revision history  
**Parameters**:
- `file`: File to show history for
- `max` (optional): Maximum revisions to show
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Revision history with changelist information

#### `p4.fstat`
**Description**: Show file metadata (`p4 fstat`)  
**Parameters**:
- `filespec`: Filespec to inspect
- `max` (optional): Maximum results
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Structured metadata records for matching files

#### `p4.print`
**Description**: Print depot file content (`p4 print`)  
**Parameters**:
- `filespec`: Filespec to print
- `quiet` (optional, default true): Suppress headers
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Printed file content

### User & Client Management

#### `p4.users`
**Description**: List Perforce users  
**Parameters**:
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
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Relationships between changelists and jobs

### Labels & Organization

#### `p4.labels`
**Description**: List labels  
**Parameters**:
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
- `stream` (optional): Stream path filter
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
- `files` (optional): Specific files or patterns
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
