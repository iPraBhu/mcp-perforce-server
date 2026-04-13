/**
 * Parse utilities for different p4 output formats
 */

export interface ParsedRecord {
  [key: string]: string | number | boolean | undefined | ParsedRecord | ParsedRecord[];
}

/**
 * Parse p4 -ztag output into structured data
 */
export function parseZtagOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output);
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
export function parseInfoOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {};
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return result;
  }
  
  const lines = getNormalizedLines(output);
  
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
export function parseOpenedOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseChangesOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { trim: true, removeEmpty: true });
  
  for (const line of lines) {
    // Remove "info: " prefix if present (from -s flag output)
    const cleanLine = line.replace(/^info:\s*/, '');
    
    // Format: "Change 12345 on 2023/01/01 by user@client 'Description...'"
    const match = cleanLine.match(/^Change\s+(\d+)\s+on\s+(\S+)\s+by\s+(.+?)@(.+?)\s+'(.*)'/);
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
 * Parse p4 review output into changelist records
 */
export function parseReviewOutput(output: string | any): ParsedRecord[] {
  return parseInterchangesOutput(output);
}

/**
 * Parse p4 reviews output into reviewer records
 */
export function parseReviewsOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];

  if (!output || typeof output !== 'string') {
    return results;
  }

  const lines = getNormalizedLines(output, { trim: true, removeEmpty: true });

  for (const line of lines) {
    // Common format: "user <email> (Full Name)"
    const withEmail = line.match(/^(\S+)\s+<([^>]+)>\s+\((.*?)\)(?:\s+(.*))?$/);
    if (withEmail) {
      const [, user, email, name, details] = withEmail;
      results.push({
        user,
        email,
        name,
        details: details || undefined,
      });
      continue;
    }

    // Alternate format: "user (Full Name)"
    const withNameOnly = line.match(/^(\S+)\s+\((.*?)\)(?:\s+(.*))?$/);
    if (withNameOnly) {
      const [, user, name, details] = withNameOnly;
      results.push({
        user,
        name,
        details: details || undefined,
      });
      continue;
    }

    // Fallback: preserve the raw line and first token as user
    const tokenized = line.match(/^(\S+)(?:\s+(.*))?$/);
    if (tokenized) {
      const [, user, details] = tokenized;
      results.push({
        user,
        details: details || undefined,
        raw: line,
      });
    }
  }

  return results;
}

/**
 * Parse p4 interchanges output into changelist records
 */
export function parseInterchangesOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];

  if (!output || typeof output !== 'string') {
    return results;
  }

  const lines = getNormalizedLines(output);
  let current: ParsedRecord | null = null;
  let descriptionLines: string[] = [];

  const finalizeCurrent = () => {
    if (!current) {
      return;
    }
    if (descriptionLines.length > 0) {
      current.description = descriptionLines.join('\n').trim();
    } else if (!current.description) {
      current.description = '';
    }
    results.push(current);
    current = null;
    descriptionLines = [];
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      if (current && descriptionLines.length > 0) {
        finalizeCurrent();
      }
      continue;
    }

    const headerMatch = line.match(
      /^Change\s+(\d+)\s+on\s+(.+?)\s+by\s+(.+?)@(.+?)(?:\s+'(.*)')?$/
    );
    if (headerMatch) {
      finalizeCurrent();
      const [, change, date, user, client, description] = headerMatch;
      current = {
        change: parseInt(change, 10),
        date,
        user,
        client,
        description: description ? description.replace(/'/g, '') : '',
      };
      continue;
    }

    if (current) {
      descriptionLines.push(line);
    }
  }

  finalizeCurrent();
  return results;
}

/**
 * Parse p4 filelog output into file history records
 */
export function parseFilelogOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output);
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
export function parseClientsOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseDiffOutput(output: string | any): ParsedRecord {
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return {
      files: [],
      totalFiles: 0,
      totalAddedLines: 0,
      totalRemovedLines: 0
    } as ParsedRecord;
  }
  
  const lines = getNormalizedLines(output);
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
 * Parse p4 diff2 output for depot-to-depot comparisons
 */
export function parseDiff2Output(output: string | any, summaryOnly = true): ParsedRecord {
  const emptyResult: ParsedRecord = {
    differences: [],
    totalDifferences: 0,
    summaryOnly,
  };

  if (!output || typeof output !== 'string') {
    return emptyResult;
  }

  const lines = getNormalizedLines(output);

  const differences: ParsedRecord[] = [];
  let currentDiff: ParsedRecord | null = null;
  let currentDiffLines: string[] = [];

  const finalizeCurrentDiff = () => {
    if (!currentDiff) return;
    if (!summaryOnly) {
      const diffText = currentDiffLines.join('\n').trim();
      if (diffText) {
        currentDiff.diff = diffText;
      }
    }
    differences.push(currentDiff);
    currentDiff = null;
    currentDiffLines = [];
  };

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      continue;
    }

    const headerMatch = trimmed.match(/^====\s+(.+?)\s+-\s+(.+?)\s+====(?:\s+(.*))?$/);
    if (headerMatch) {
      finalizeCurrentDiff();

      const [, sourceRaw, targetRaw, differenceTypeRaw] = headerMatch;
      const sourceInfo = parseDiff2Side(sourceRaw);
      const targetInfo = parseDiff2Side(targetRaw);

      currentDiff = {
        sourceFile: sourceInfo.depotFile,
        sourceRevision: sourceInfo.revision,
        sourceType: sourceInfo.type,
        targetFile: targetInfo.depotFile,
        targetRevision: targetInfo.revision,
        targetType: targetInfo.type,
        differenceType: differenceTypeRaw ? differenceTypeRaw.trim() : 'content',
      };
      continue;
    }

    if (summaryOnly) {
      const pairMatch = trimmed.match(/^(.+?#\S+(?:\s+\(.+?\))?)\s+-\s+(.+?#\S+(?:\s+\(.+?\))?)(?:\s+(.*))?$/);
      if (pairMatch) {
        finalizeCurrentDiff();

        const [, sourceRaw, targetRaw, differenceTypeRaw] = pairMatch;
        const sourceInfo = parseDiff2Side(sourceRaw);
        const targetInfo = parseDiff2Side(targetRaw);

        differences.push({
          sourceFile: sourceInfo.depotFile,
          sourceRevision: sourceInfo.revision,
          sourceType: sourceInfo.type,
          targetFile: targetInfo.depotFile,
          targetRevision: targetInfo.revision,
          targetType: targetInfo.type,
          differenceType: differenceTypeRaw ? differenceTypeRaw.trim() : 'different',
        });
      }
      continue;
    }

    if (!summaryOnly && currentDiff) {
      currentDiffLines.push(line);
    }
  }

  finalizeCurrentDiff();

  return {
    differences: differences as ParsedRecord[],
    totalDifferences: differences.length,
    summaryOnly,
  } as ParsedRecord;
}

/**
 * Parse p4 describe output into structured changelist data
 */
export function parseDescribeOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {
    files: [],
    description: '',
    rawText: '',
    hasDiff: false,
  };

  if (!output || typeof output !== 'string') {
    return result;
  }

  const lines = getNormalizedLines(output);

  result.rawText = lines
    .filter((line) => line.trim())
    .join('\n');

  let inDescription = false;
  let inFiles = false;
  let inDifferences = false;
  const descriptionLines: string[] = [];
  const files: ParsedRecord[] = [];
  const diffLines: string[] = [];

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed) {
      if (inDescription && !inFiles && descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] !== '') {
        descriptionLines.push('');
      }
      continue;
    }

    const headerMatch = trimmed.match(
      /^Change\s+(\d+)\s+by\s+(.+?)@(\S+)\s+on\s+(.+?)(?:\s+\*(\w+)\*)?$/
    );
    if (headerMatch) {
      const [, change, user, client, date, status] = headerMatch;
      result.change = parseInt(change, 10);
      result.user = user;
      result.client = client;
      result.date = date.trim();
      result.status = status ? status.toLowerCase() : 'submitted';
      inDescription = true;
      inFiles = false;
      continue;
    }

    if (/^Affected files\s+\.\.\.$/i.test(trimmed)) {
      inDescription = false;
      inFiles = true;
      inDifferences = false;
      continue;
    }

    if (/^Differences\s+\.\.\.$/i.test(trimmed)) {
      inDescription = false;
      inFiles = false;
      inDifferences = true;
      continue;
    }

    if (inDifferences) {
      diffLines.push(line);
      continue;
    }

    if (inFiles && trimmed.startsWith('... ')) {
      const fileMatch = trimmed.match(/^\.{3}\s+(.+?)#([^\s]+)\s+([^\s]+)(?:\s+\((.+?)\))?$/);
      if (fileMatch) {
        const [, depotFile, revisionRaw, action, type] = fileMatch;
        const numericRevision = parseInt(revisionRaw, 10);
        files.push({
          depotFile,
          revision: Number.isNaN(numericRevision) ? revisionRaw : numericRevision,
          action,
          type: type || undefined,
        });
      }
      continue;
    }

    if (inDescription) {
      descriptionLines.push(trimmed);
    }
  }

  while (descriptionLines.length > 0 && descriptionLines[descriptionLines.length - 1] === '') {
    descriptionLines.pop();
  }

  result.description = descriptionLines.join('\n');
  result.files = files;
  result.fileCount = files.length;

  const diffText = diffLines.join('\n').trim();
  if (diffText.length > 0) {
    result.hasDiff = true;
    result.diffText = diffText;
    result.diff = parseDiffOutput(diffText);
  }

  return result;
}

/**
 * Parse p4 sync output into sync records
 */
export function parseSyncOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseResolveOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseShelveOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseUnshelveOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseBlameOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseCopyOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseMoveOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseGrepOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseFilesOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseDirsOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseUsersOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseUserOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {};
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return result;
  }
  
  const lines = getNormalizedLines(output);
  
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
export function parseClientOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {};
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return result;
  }
  
  const lines = getNormalizedLines(output);
  
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
export function parseJobsOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseJobOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {};
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return result;
  }
  
  const lines = getNormalizedLines(output);
  
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
export function parseFixesOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseLabelsOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseLabelOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {};
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return result;
  }
  
  const lines = getNormalizedLines(output);
  
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
export function parseSizesOutput(output: string | any): ParsedRecord {
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return {
      totalSize: 0,
      fileCount: 0,
      files: []
    } as ParsedRecord;
  }
  
  const result: ParsedRecord = {};
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseHaveOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
export function parseWhereOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];
  
  // Handle non-string inputs safely
  if (!output || typeof output !== 'string') {
    return results;
  }
  
  const lines = getNormalizedLines(output, { removeEmpty: true });
  
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
 * Parse p4 fstat output into records
 */
export function parseFstatOutput(output: string | any): ParsedRecord[] {
  const records = parseZtagOutput(output);
  return records.map((record) => ({ ...record }));
}

/**
 * Parse p4 streams output into stream records
 */
export function parseStreamsOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];

  if (!output || typeof output !== 'string') {
    return results;
  }

  const lines = getNormalizedLines(output, { removeEmpty: true });
  for (const line of lines) {
    // Format: "Stream //Depot/main 2025/01/01 owner 'description'"
    const match = line.match(/^Stream\s+(\S+)\s+(\S+)\s+(\S+)\s+'(.*)'$/);
    if (match) {
      const [, stream, date, owner, description] = match;
      results.push({
        stream,
        date,
        owner,
        description,
      });
    } else if (line.startsWith('//')) {
      results.push({ stream: line.trim() });
    }
  }

  return results;
}

/**
 * Parse p4 stream output into a stream spec key/value object
 */
export function parseStreamOutput(output: string | any): ParsedRecord {
  const result: ParsedRecord = {};

  if (!output || typeof output !== 'string') {
    return result;
  }

  const lines = getNormalizedLines(output);
  for (const line of lines) {
    const colonIndex = line.indexOf(':');
    if (colonIndex > 0) {
      const key = line.substring(0, colonIndex).trim();
      const value = line.substring(colonIndex + 1).trim();
      if (key) {
        result[key] = value;
      }
    }
  }

  return result;
}

/**
 * Parse p4 print output content
 */
export function parsePrintOutput(output: string | any): ParsedRecord {
  if (!output || typeof output !== 'string') {
    return { content: '' };
  }

  return {
    content: getNormalizedLines(output).join('\n').trim(),
  };
}

/**
 * Parse p4 integrate/merge output into operation records
 */
export function parseIntegrateOutput(output: string | any): ParsedRecord[] {
  const results: ParsedRecord[] = [];

  if (!output || typeof output !== 'string') {
    return results;
  }

  const lines = getNormalizedLines(output, { removeEmpty: true });
  for (const line of lines) {
    // Common formats:
    // //depot/target#5 - integrate from //depot/source#7
    // //depot/target#none - branch from //depot/source#1
    const match = line.match(/^(.+?)#([^\s]+)\s+-\s+(.+?)(?:\s+from\s+(.+?)#([^\s]+))?$/);
    if (match) {
      const [, targetFile, targetRevisionRaw, action, sourceFile, sourceRevisionRaw] = match;
      const targetRevisionNum = parseInt(targetRevisionRaw, 10);
      const sourceRevisionNum = sourceRevisionRaw ? parseInt(sourceRevisionRaw, 10) : NaN;
      results.push({
        targetFile,
        targetRevision: Number.isNaN(targetRevisionNum) ? targetRevisionRaw : targetRevisionNum,
        action: action.trim(),
        sourceFile: sourceFile || undefined,
        sourceRevision: sourceRevisionRaw
          ? Number.isNaN(sourceRevisionNum)
            ? sourceRevisionRaw
            : sourceRevisionNum
          : undefined,
      });
    }
  }

  return results;
}

/**
 * Parse p4 integrated output into integration records
 */
export function parseIntegratedOutput(output: string | any): ParsedRecord[] {
  const parsed = parseIntegrateOutput(output);
  if (parsed.length > 0) {
    return parsed;
  }

  const results: ParsedRecord[] = [];
  if (!output || typeof output !== 'string') {
    return results;
  }

  const lines = getNormalizedLines(output, { trim: true, removeEmpty: true });
  for (const line of lines) {
    // Common format:
    // //depot/target#5 - integrated from //depot/source#7
    const match = line.match(
      /^(.+?)#([^\s]+)\s+-\s+(.+?)(?:\s+(?:from|into|to)\s+(.+?)#([^\s]+))?$/
    );
    if (!match) {
      continue;
    }

    const [, file, revisionRaw, action, relatedFile, relatedRevisionRaw] = match;
    const revisionNum = parseInt(revisionRaw, 10);
    const relatedRevisionNum = relatedRevisionRaw ? parseInt(relatedRevisionRaw, 10) : NaN;

    results.push({
      file,
      revision: Number.isNaN(revisionNum) ? revisionRaw : revisionNum,
      action: action.trim(),
      relatedFile: relatedFile || undefined,
      relatedRevision: relatedRevisionRaw
        ? Number.isNaN(relatedRevisionNum)
          ? relatedRevisionRaw
          : relatedRevisionNum
        : undefined,
    });
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
 * Strip p4 -s script mode prefixes (info1:, error:, exit:, etc.) from output lines
 */
function stripScriptPrefix(line: string): string {
  const match = line.match(/^(info\d*|text|warning|error|exit):\s?(.*)$/i);
  if (!match) {
    return line;
  }

  const [, prefix, value] = match;
  if (prefix.toLowerCase() === 'exit') {
    return '';
  }

  return value;
}

function getNormalizedLines(
  output: string | any,
  options: { trim?: boolean; removeEmpty?: boolean } = {}
): string[] {
  if (!output || typeof output !== 'string') {
    return [];
  }

  const { trim = false, removeEmpty = false } = options;
  const lines = output.split('\n');
  const normalized: string[] = [];

  for (const rawLine of lines) {
    const stripped = stripScriptPrefix(rawLine.replace(/\r$/, ''));
    const value = trim ? stripped.trim() : stripped;
    if (removeEmpty && value.trim().length === 0) {
      continue;
    }
    normalized.push(value);
  }

  return normalized;
}

/**
 * Parse a single side of a diff2 header line
 */
function parseDiff2Side(side: string): { depotFile: string; revision: string | number; type?: string } {
  const match = side.trim().match(/^(.+?)#([^\s]+)(?:\s+\((.+?)\))?$/);
  if (!match) {
    return { depotFile: side.trim(), revision: 'unknown' };
  }

  const [, depotFile, revisionRaw, type] = match;
  const numericRevision = parseInt(revisionRaw, 10);

  return {
    depotFile,
    revision: Number.isNaN(numericRevision) ? revisionRaw : numericRevision,
    type: type || undefined,
  };
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

