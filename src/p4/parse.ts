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