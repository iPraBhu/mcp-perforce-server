/**
 * Parse utilities for different p4 output formats
 */

export interface ParsedRecord {
  [key: string]: string | number | boolean | undefined | ParsedRecord[];
}

/**
 * Parse p4 -ztag output into structured data
 */
export function parseZtagOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n');
  let currentRecord: ParsedRecord = {};
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    
    // Empty line indicates end of record
    if (!trimmedLine) {
      if (Object.keys(currentRecord).length > 0) {
        results.push(currentRecord);
        currentRecord = {};
      }
      continue;
    }
    
    // Parse ztag format: "... key value"
    const match = trimmedLine.match(/^\.\.\. (\w+)\s*(.*)$/);
    if (match) {
      const [, key, value] = match;
      currentRecord[key] = parseValue(value.trim());
    }
  }
  
  // Don't forget the last record
  if (Object.keys(currentRecord).length > 0) {
    results.push(currentRecord);
  }
  
  return results;
}

/**
 * Parse p4 info output into key-value pairs
 */
export function parseInfoOutput(output: string): ParsedRecord {
  const result: ParsedRecord = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    const colonIndex = trimmedLine.indexOf(': ');
    if (colonIndex > 0) {
      const key = trimmedLine.substring(0, colonIndex).trim();
      const value = trimmedLine.substring(colonIndex + 2).trim();
      
      // Convert key to camelCase for consistency
      const camelKey = key.replace(/\s+(.)/g, (_, char) => char.toUpperCase());
      result[camelKey] = parseValue(value);
    }
  }
  
  return result;
}

/**
 * Parse p4 opened output into file records
 */
export function parseOpenedOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path#revision - action by user@client (change) type"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+(\w+)\s+by\s+(.+?)@(.+?)\s+\((.+?)\)(?:\s+(.+))?/);
    if (match) {
      const [, depotFile, revision, action, user, client, changeInfo, fileType] = match;
      
      let changeList = 'default';
      if (changeInfo !== 'default change') {
        const changeMatch = changeInfo.match(/change (\d+)/);
        if (changeMatch) {
          changeList = changeMatch[1];
        }
      }
      
      results.push({
        depotFile: depotFile.trim(),
        revision: parseInt(revision, 10),
        action,
        user,
        client,
        change: changeList,
        type: fileType || 'text',
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 changes output into changelist records
 */
export function parseChangesOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "Change 12345 on 2023/01/01 by user@client 'Description...'"
    const match = line.match(/^Change\s+(\d+)\s+on\s+(\S+)\s+by\s+(.+?)@(.+?)\s+'(.*)'/);
    if (match) {
      const [, change, date, user, client, description] = match;
      results.push({
        change: parseInt(change, 10),
        date,
        user,
        client,
        description: description.replace(/'/g, ''), // Remove surrounding quotes
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 filelog output into file history records
 */
export function parseFilelogOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n');
  let currentFile: ParsedRecord | null = null;
  let currentRevision: ParsedRecord | null = null;
  
  for (const line of lines) {
    const trimmedLine = line.trim();
    if (!trimmedLine) continue;
    
    // File header: "//depot/path"
    if (trimmedLine.startsWith('//') && !trimmedLine.includes('#')) {
      if (currentFile && currentFile.revisions) {
        results.push(currentFile);
      }
      currentFile = {
        depotFile: trimmedLine,
        revisions: [],
      };
      continue;
    }
    
    // Revision line: "... #1 change 123 edit on 2023/01/01 by user@client (text)"
    const revisionMatch = trimmedLine.match(/^\.\.\. #(\d+) change (\d+) (\w+) on (\S+) by (.+?)@(.+?) \((.+?)\)/);
    if (revisionMatch && currentFile) {
      const [, revision, change, action, date, user, client, type] = revisionMatch;
      currentRevision = {
        revision: parseInt(revision, 10),
        change: parseInt(change, 10),
        action,
        date,
        user,
        client,
        type,
      };
      (currentFile.revisions as ParsedRecord[]).push(currentRevision);
      continue;
    }
    
    // Integration records and other details can be added here
  }
  
  // Don't forget the last file
  if (currentFile) {
    results.push(currentFile);
  }
  
  return results;
}

/**
 * Parse p4 clients output into client records  
 */
export function parseClientsOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "Client clientname 2023/01/01 root /path/to/root 'Description...'"
    const match = line.match(/^Client\s+(\S+)\s+(\S+)\s+root\s+(.+?)\s+'(.*)'/);
    if (match) {
      const [, client, date, root, description] = match;
      results.push({
        client,
        date,
        root: root.trim(),
        description: description.replace(/'/g, ''),
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 diff output into structured diff information
 */
export function parseDiffOutput(output: string): ParsedRecord {
  const lines = output.split('\n');
  const files: ParsedRecord[] = [];
  let currentFile: ParsedRecord | null = null;
  let diffLines: string[] = [];
  let addedLines = 0;
  let removedLines = 0;
  
  for (const line of lines) {
    // File header: "==== //depot/path#revision - /local/path ===="
    const fileMatch = line.match(/^==== (.+?)#(\d+) - (.+?) ====/);
    if (fileMatch) {
      // Save previous file if exists
      if (currentFile) {
        currentFile.addedLines = addedLines;
        currentFile.removedLines = removedLines;
        currentFile.diff = diffLines.join('\n');
        files.push(currentFile);
      }
      
      // Start new file
      const [, depotFile, revision, localFile] = fileMatch;
      currentFile = {
        depotFile,
        revision: parseInt(revision, 10),
        localFile,
      };
      diffLines = [];
      addedLines = 0;
      removedLines = 0;
      continue;
    }
    
    // Count added/removed lines
    if (line.startsWith('+') && !line.startsWith('+++')) {
      addedLines++;
    } else if (line.startsWith('-') && !line.startsWith('---')) {
      removedLines++;
    }
    
    diffLines.push(line);
  }
  
  // Don't forget the last file
  if (currentFile) {
    currentFile.addedLines = addedLines;
    currentFile.removedLines = removedLines;
    currentFile.diff = diffLines.join('\n');
    files.push(currentFile);
  }
  
  return {
    files: files as ParsedRecord[],
    totalFiles: files.length,
    totalAddedLines: files.reduce((sum, file) => sum + (file.addedLines as number || 0), 0),
    totalRemovedLines: files.reduce((sum, file) => sum + (file.removedLines as number || 0), 0),
  } as ParsedRecord;
}

/**
 * Parse p4 sync output into sync records
 */
export function parseSyncOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path#revision - updating /local/path"
    // Format: "//depot/path#revision - added as /local/path" 
    // Format: "//depot/path#revision - deleted as /local/path"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+(\w+)(?:\s+as)?\s+(.+)/);
    if (match) {
      const [, depotFile, revision, action, localFile] = match;
      results.push({
        depotFile,
        revision: parseInt(revision, 10),
        action,
        localFile,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 resolve output into conflict resolution records
 */
export function parseResolveOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "C /path/to/file - merging //depot/path#123"
    const match = line.match(/^([A-Z])\s+(.+?)\s+-\s+(.+)/);
    if (match) {
      const [, status, file, description] = match;
      results.push({
        status,
        file,
        description,
        action: getResolveAction(status),
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 shelve output into shelved changelist records
 */
export function parseShelveOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "change 12345 shelved"
    const match = line.match(/^change\s+(\d+)\s+shelved/);
    if (match) {
      const [, change] = match;
      results.push({
        change: parseInt(change, 10),
        action: 'shelved',
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 unshelve output into unshelved records
 */
export function parseUnshelveOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path#123 - unshelved"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+unshelved/);
    if (match) {
      const [, depotFile, revision] = match;
      results.push({
        depotFile,
        revision: parseInt(revision, 10),
        action: 'unshelved',
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 blame/annotate output into line-by-line attribution
 */
export function parseBlameOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "12345: user 2023/01/01 12:34:56: content"
    const match = line.match(/^(\d+):\s+(.+?)\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2}):\s*(.*)/);
    if (match) {
      const [, revision, user, date, time, content] = match;
      results.push({
        revision: parseInt(revision, 10),
        user,
        date,
        time,
        content,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 copy output into copied file records
 */
export function parseCopyOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/src#123 - copied to //depot/dst#124"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+copied\s+to\s+(.+?)#(\d+)/);
    if (match) {
      const [, srcFile, srcRev, dstFile, dstRev] = match;
      results.push({
        sourceFile: srcFile,
        sourceRevision: parseInt(srcRev, 10),
        destinationFile: dstFile,
        destinationRevision: parseInt(dstRev, 10),
        action: 'copied',
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 move output into moved file records
 */
export function parseMoveOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/old#123 - moved to //depot/new#124"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+moved\s+to\s+(.+?)#(\d+)/);
    if (match) {
      const [, oldFile, oldRev, newFile, newRev] = match;
      results.push({
        oldFile,
        oldRevision: parseInt(oldRev, 10),
        newFile,
        newRevision: parseInt(newRev, 10),
        action: 'moved',
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 grep output into search result records
 */
export function parseGrepOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path:123:matched text here"
    const match = line.match(/^(.+?):(\d+):(.*)/);
    if (match) {
      const [, file, lineNum, text] = match;
      results.push({
        file,
        line: parseInt(lineNum, 10),
        text,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 files output into file records
 */
export function parseFilesOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path#123 - action change 456 (type text)"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+(\w+)\s+change\s+(\d+)\s+\((.+?)\)/);
    if (match) {
      const [, depotFile, revision, action, change, type] = match;
      results.push({
        depotFile,
        revision: parseInt(revision, 10),
        action,
        change: parseInt(change, 10),
        type,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 dirs output into directory records
 */
export function parseDirsOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Directories are listed one per line
    if (line.startsWith('//')) {
      results.push({
        directory: line,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 users output into user records
 */
export function parseUsersOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "user <user@domain> (realname) accessed 2023/01/01 12:34:56"
    const match = line.match(/^(\w+)\s+<([^>]+)>\s+\(([^)]+)\)\s+accessed\s+(\d{4}\/\d{2}\/\d{2})\s+(\d{2}:\d{2}:\d{2})/);
    if (match) {
      const [, user, email, realname, date, time] = match;
      results.push({
        user,
        email,
        realname,
        lastAccessed: `${date} ${time}`,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 user output into user details
 */
export function parseUserOutput(output: string): ParsedRecord {
  const result: ParsedRecord = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(': ');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 2).trim();
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Parse p4 client output into client details
 */
export function parseClientOutput(output: string): ParsedRecord {
  const result: ParsedRecord = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(': ');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 2).trim();
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Parse p4 jobs output into job records
 */
export function parseJobsOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "job000001 on 2023/01/01 by user *open* 'Job description'"
    const match = line.match(/^(\w+)\s+on\s+(\d{4}\/\d{2}\/\d{2})\s+by\s+(\w+)\s+(\w+)\s+'(.*)'/);
    if (match) {
      const [, job, date, user, status, description] = match;
      results.push({
        job,
        date,
        user,
        status,
        description: description.replace(/'/g, ''),
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 job output into job details
 */
export function parseJobOutput(output: string): ParsedRecord {
  const result: ParsedRecord = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(': ');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 2).trim();
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Parse p4 fixes output into fix records
 */
export function parseFixesOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "job000001 fixed by change 12345 on 2023/01/01 by user@client"
    const match = line.match(/^(\w+)\s+fixed\s+by\s+change\s+(\d+)\s+on\s+(\d{4}\/\d{2}\/\d{2})\s+by\s+(.+)$/);
    if (match) {
      const [, job, change, date, userClient] = match;
      results.push({
        job,
        change: parseInt(change, 10),
        date,
        userClient,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 labels output into label records
 */
export function parseLabelsOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "Label labelname 2023/01/01 'Label description'"
    const match = line.match(/^Label\s+(\w+)\s+(\d{4}\/\d{2}\/\d{2})\s+'(.*)'/);
    if (match) {
      const [, label, date, description] = match;
      results.push({
        label,
        date,
        description: description.replace(/'/g, ''),
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 label output into label details
 */
export function parseLabelOutput(output: string): ParsedRecord {
  const result: ParsedRecord = {};
  const lines = output.split('\n');
  
  for (const line of lines) {
    const colonIndex = line.indexOf(': ');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 2).trim();
      result[key] = value;
    }
  }
  
  return result;
}

/**
 * Parse p4 sizes output into size statistics
 */
export function parseSizesOutput(output: string): ParsedRecord {
  const result: ParsedRecord = {};
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    if (line.includes('files,')) {
      // Format: "12345 files, 67890123 bytes"
      const match = line.match(/(\d+)\s+files?,\s+(\d+)\s+bytes?/);
      if (match) {
        result.fileCount = parseInt(match[1], 10);
        result.totalBytes = parseInt(match[2], 10);
      }
    }
  }
  
  return result;
}

/**
 * Parse p4 have output into synced file records
 */
export function parseHaveOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path#123 - /local/path"
    const match = line.match(/^(.+?)#(\d+)\s+-\s+(.+)/);
    if (match) {
      const [, depotFile, revision, localFile] = match;
      results.push({
        depotFile,
        revision: parseInt(revision, 10),
        localFile,
      });
    }
  }
  
  return results;
}

/**
 * Parse p4 where output into mapping records
 */
export function parseWhereOutput(output: string): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  const lines = output.split('\n').filter(line => line.trim());
  
  for (const line of lines) {
    // Format: "//depot/path /local/path //depot/path"
    const parts = line.split(/\s+/);
    if (parts.length >= 3) {
      results.push({
        depotPath: parts[0],
        localPath: parts[1],
        workspacePath: parts[2],
      });
    }
  }
  
  return results;
}

/**
 * Helper function to convert resolve status to action
 */
function getResolveAction(status: string): string {
  switch (status) {
    case 'C': return 'content_conflict';
    case 'M': return 'merge_conflict';
    case 'T': return 'type_conflict';
    case 'A': return 'already_resolved';
    default: return 'unknown';
  }
}

/**
 * Parse individual values with type conversion
 */
function parseValue(value: string): string | number | boolean {
  if (!value) return '';
  
  // Try to parse as number
  const numValue = parseFloat(value);
  if (!isNaN(numValue) && isFinite(numValue) && value.match(/^\d+(\.\d+)?$/)) {
    return numValue;
  }
  
  // Try to parse as boolean
  const lowerValue = value.toLowerCase();
  if (lowerValue === 'true' || lowerValue === 'yes' || lowerValue === 'on') {
    return true;
  }
  if (lowerValue === 'false' || lowerValue === 'no' || lowerValue === 'off') {
    return false;
  }
  
  return value;
}