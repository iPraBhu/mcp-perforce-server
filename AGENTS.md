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
- `changelist` (optional): Compare against specific changelist
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Unified diff output showing changes

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

#### `p4.blame`
**Description**: Show file annotations (like git blame)  
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
**Description**: Get detailed changelist information  
**Parameters**:
- `changelist`: Changelist number to describe
- `workspacePath` (optional): Path to workspace directory  
**Returns**: Complete changelist details including files and description

#### `p4.changes`
**Description**: List changelists with filtering  
**Parameters**:
- `max` (optional): Maximum number of changelists to return
- `user` (optional): Filter by user
- `client` (optional): Filter by client/workspace
- `status` (optional): Filter by status (pending, submitted, etc.)
- `workspacePath` (optional): Path to workspace directory  
**Returns**: List of changelists matching criteria

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