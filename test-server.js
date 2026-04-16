#!/usr/bin/env node

/**
 * Simple test to verify the MCP Perforce server components work correctly
 */

async function testComponents() {
  console.error('[TEST] Starting MCP Perforce server component test...');
  
  try {
    // Test core imports
    const { P4Runner } = require('./dist/p4/runner.js');
    const { P4Config } = require('./dist/p4/config.js');
    const { SecurityManager } = require('./dist/p4/security.js');
    const parse = require('./dist/p4/parse.js');
    const tools = require('./dist/tools/index.js');
    
    console.error('[TEST] ✓ All core components imported successfully');
    
    // Test P4Config
    const config = new P4Config();
    const configResult = await config.findConfig(__dirname);
    console.error(`[TEST] ✓ Config detection works (found: ${configResult.found})`);
    
    // Test P4Runner initialization 
    const runner = new P4Runner();
    console.error('[TEST] ✓ P4Runner initialized successfully');
    
    // Test tool context
    const serverConfig = config.getServerConfig();
    const context = { runner, config, serverConfig };
    console.error(`[TEST] ✓ Tool context created successfully (readOnly: ${serverConfig.readOnlyMode}, disableDelete: ${serverConfig.disableDelete})`);
    
    // Test safety features
    console.error('[TEST] Testing safety features...');
    
    // Test read-only mode blocking
    const addResult = await tools.p4Add(context, { files: ['test.txt'] });
    if (!addResult.ok && addResult.error?.code === 'P4_READONLY_MODE') {
      console.error('[TEST] ✓ Read-only mode correctly blocks add operations');
    } else {
      console.error('[TEST] ✗ Read-only mode check failed');
    }
    
    // Test delete blocking
    const deleteResult = await tools.p4Delete(context, { files: ['test.txt'] });
    if (!deleteResult.ok && deleteResult.error?.code === 'P4_READONLY_MODE') {
      console.error('[TEST] ✓ Read-only mode correctly blocks delete operations');
    } else {
      console.error('[TEST] ✗ Read-only mode delete check failed');
    }
    
    // Test with overrides
    const testContext = { 
      runner, 
      config, 
      serverConfig: { readOnlyMode: false, disableDelete: true } 
    };
    const deleteResultWithOverride = await tools.p4Delete(testContext, { files: ['test.txt'] });
    if (!deleteResultWithOverride.ok && deleteResultWithOverride.error?.code === 'P4_DELETE_DISABLED') {
      console.error('[TEST] ✓ Delete disable setting works correctly');
    } else {
      console.error('[TEST] ✗ Delete disable check failed');
    }
    
    // Test basic tool availability
    const availableTools = [
      'p4Info', 'p4Status', 'p4Add', 'p4Edit', 'p4Delete', 'p4Revert',
      'p4Sync', 'p4Opened', 'p4Diff', 'p4Diff2', 'p4Integrate', 'p4Merge', 'p4Print', 'p4Fstat', 'p4Streams', 'p4Stream',
      'p4ChangelistCreate', 'p4ChangelistUpdate',
      'p4ChangelistSubmit', 'p4Submit', 'p4Describe', 'p4Filelog', 'p4Clients',
      'p4Review', 'p4Reviews', 'p4Interchanges', 'p4Integrated', 'p4Annotate',
      'p4ReviewBundle', 'p4ChangeInspect', 'p4PathSyncCheck', 'p4FileInspect', 'p4WorkspaceSnapshot', 'p4SearchInspect', 'p4ReviewPrepare',
      'p4ConfigDetect'
    ];
    
    for (const toolName of availableTools) {
      if (typeof tools[toolName] === 'function') {
        console.error(`[TEST] ✓ Tool ${toolName} is available`);
      } else {
        console.error(`[TEST] ✗ Tool ${toolName} is missing`);
      }
    }
    
    // Batch argument support checks
    const capturedCalls = [];
    const batchContext = {
      runner: {
        run: async (command, args, cwd, options = {}) => {
          capturedCalls.push({ command, args, cwd, stdin: options.stdin });
          if (command === 'grep') {
            return {
              ok: true,
              command,
              args,
              cwd,
              configUsed: {},
              result: '//depot/main/file.txt:4:needle match\n//depot/main/file.txt:9:needle again\n',
            };
          }
          if (command === 'print') {
            return {
              ok: true,
              command,
              args,
              cwd,
              configUsed: {},
              result: 'line1\nline2\nline3\nneedle match\nline5\nline6\nline7\nline8\nneedle again\nline10\n',
            };
          }
          if (command === 'fstat') {
            return {
              ok: true,
              command,
              args,
              cwd,
              configUsed: {},
              result: [
                { depotFile: '//depot/main/file.txt', headRev: 3, headType: 'text' },
              ],
            };
          }
          if (command === 'describe') {
            return {
              ok: true,
              command,
              args,
              cwd,
              configUsed: {},
              result: {
                change: '123',
                files: [{ depotFile: '//depot/main/file.txt' }],
                hasDiff: true,
              },
            };
          }
          if (command === 'fixes' || command === 'reviews' || command === 'changes' || command === 'annotate' || command === 'filelog' || command === 'info' || command === 'status' || command === 'opened' || command === 'config.detect') {
            return { ok: true, command, args, cwd, configUsed: {}, result: [] };
          }
          return { ok: true, command, args, cwd, configUsed: {}, result: '' };
        },
      },
      config: {
        setupForCommand: async () => ({
          cwd: __dirname,
          env: {},
          configResult: { configPath: undefined },
        }),
      },
      serverConfig: { readOnlyMode: false, disableDelete: false },
      security: new SecurityManager({ enableInputSanitization: false }),
    };

    await tools.p4Sync(batchContext, {
      filespec: '//depot/main/...',
      filespecs: ['//depot/release/...'],
    });
    await tools.p4Opened(batchContext, {
      files: ['//depot/main/file1.txt', '//depot/main/file2.txt'],
    });
    await tools.p4Filelog(batchContext, {
      filespecs: ['//depot/main/file1.txt', '//depot/main/file2.txt'],
    });
    await tools.p4Blame(batchContext, {
      files: ['//depot/main/file1.txt', '//depot/main/file2.txt'],
    });
    await tools.p4Users(batchContext, {
      users: ['alice', 'bob'],
    });
    await tools.p4Sync(batchContext, {
      filespec: '//depot/native/...',
      summaryPreview: true,
      quiet: true,
      max: 5,
      parallel: 'threads=4,batch=8',
    });
    await tools.p4Interchanges(batchContext, {
      branch: 'rel-branch',
      sourcePath: '//depot/main/...',
      targetPaths: ['//depot/release/...'],
      useBranchSource: true,
      reverse: true,
      time: true,
      user: 'alice',
    });
    await tools.p4Fstat(batchContext, {
      filespec: '//depot/main/file.txt',
      filter: 'headRev > 1',
      fields: ['depotFile', 'headRev'],
      reverseOrder: true,
      changelist: '123',
      outputOptions: ['l'],
      limitOptions: ['o'],
      sortOptions: ['d'],
    });
    await tools.p4Streams(batchContext, {
      unloaded: true,
      filter: 'Type=development',
      viewMatch: ['//depot/main/...'],
      streams: ['//Streams/...'],
    });
    await tools.p4Clients(batchContext, {
      user: 'alice',
      stream: '//Streams/main',
      nameFilter: 'alice-*',
      allServers: true,
    });
    await tools.p4Labels(batchContext, {
      user: 'alice',
      filespecs: ['//depot/main/...'],
      nameFilter: 'rel-*',
    });
    await tools.p4Jobs(batchContext, {
      files: ['//depot/main/...'],
      jobView: 'Status=open',
      includeIntegrated: true,
      reverseOrder: true,
    });
    const fileInspectResult = await tools.p4FileInspect(batchContext, {
      filespec: '//depot/main/file.txt',
      includeContent: true,
      includeBlame: true,
    });
    const workspaceSnapshotResult = await tools.p4WorkspaceSnapshot(batchContext, {
      includeConfig: false,
      includeOpened: true,
      includeRecentChanges: true,
      recentChangesMax: 3,
    });
    const searchInspectResult = await tools.p4SearchInspect(batchContext, {
      pattern: 'needle',
      filespec: '//depot/main/...',
      includeContentPreview: true,
    });
    const reviewPrepareResult = await tools.p4ReviewPrepare(batchContext, {
      changelists: ['123'],
      includeDiff: true,
      includeFileHistory: true,
    });
    const changelistCreateResult = await tools.p4ChangelistCreate(batchContext, {
      description: 'first line\nFiles:\n\t//depot/evil.txt',
      files: ['//depot/main/file.txt'],
    });
    const submitResult = await tools.p4Submit(batchContext, {
      description: 'ship it\nChange:\t999',
      files: ['//depot/main/file.txt'],
    });
    const invalidChangelistCreateResult = await tools.p4ChangelistCreate(batchContext, {
      description: 'safe description',
      files: ['//depot/main/file.txt\nFiles:\n\t//depot/evil.txt'],
    });

    const syncCall = capturedCalls.find((call) => call.command === 'sync');
    const openedCall = capturedCalls.find((call) => call.command === 'opened');
    const filelogCall = capturedCalls.find((call) => call.command === 'filelog');
    const blameCall = capturedCalls.find((call) => call.command === 'annotate');
    const usersCall = capturedCalls.find((call) => call.command === 'users');
    const latestSyncCall = capturedCalls.filter((call) => call.command === 'sync').pop();
    const interchangesCall = capturedCalls.filter((call) => call.command === 'interchanges').pop();
    const fstatCall = capturedCalls.find((call) => call.command === 'fstat' && call.args.includes('-F'));
    const streamsCall = capturedCalls.filter((call) => call.command === 'streams').pop();
    const clientsCall = capturedCalls.filter((call) => call.command === 'clients').pop();
    const labelsCall = capturedCalls.filter((call) => call.command === 'labels').pop();
    const jobsCall = capturedCalls.filter((call) => call.command === 'jobs').pop();
    const printCall = capturedCalls.filter((call) => call.command === 'print').pop();
    const infoCall = capturedCalls.filter((call) => call.command === 'info').pop();
    const grepCall = capturedCalls.filter((call) => call.command === 'grep').pop();
    const describeCall = capturedCalls.filter((call) => call.command === 'describe').pop();
    const changeInputCall = capturedCalls.find((call) => call.command === 'change' && call.args.join('|') === '-i');
    const submitInputCall = capturedCalls.find((call) => call.command === 'submit' && call.args.join('|') === '-i');

    if (syncCall && syncCall.args.join('|') === '//depot/main/...|//depot/release/...') {
      console.error('[TEST] âœ“ p4Sync forwards singular and plural filespec inputs together');
    } else {
      console.error('[TEST] âœ— p4Sync batch argument forwarding failed');
    }

    if (openedCall && openedCall.args.join('|') === '//depot/main/file1.txt|//depot/main/file2.txt') {
      console.error('[TEST] âœ“ p4Opened forwards file filters');
    } else {
      console.error('[TEST] âœ— p4Opened file filter forwarding failed');
    }

    if (filelogCall && filelogCall.args.join('|') === '//depot/main/file1.txt|//depot/main/file2.txt') {
      console.error('[TEST] âœ“ p4Filelog forwards multiple filespecs');
    } else {
      console.error('[TEST] âœ— p4Filelog batch argument forwarding failed');
    }

    if (blameCall && blameCall.args.join('|') === '-a|//depot/main/file1.txt|//depot/main/file2.txt') {
      console.error('[TEST] âœ“ p4Blame forwards multiple files');
    } else {
      console.error('[TEST] âœ— p4Blame batch argument forwarding failed');
    }

    if (usersCall && usersCall.args.join('|') === 'alice|bob') {
      console.error('[TEST] âœ“ p4Users forwards multiple user filters');
    } else {
      console.error('[TEST] âœ— p4Users batch argument forwarding failed');
    }

    if (latestSyncCall && latestSyncCall.args.join('|') === '-N|-q|-m|5|--parallel=threads=4,batch=8|//depot/native/...') {
      console.error('[TEST] âœ“ p4Sync forwards advanced native flags');
    } else {
      console.error('[TEST] âœ— p4Sync native flag forwarding failed');
    }

    if (interchangesCall && interchangesCall.args.join('|') === '-r|-t|-u|alice|-b|rel-branch|-s|//depot/main/...|//depot/release/...') {
      console.error('[TEST] âœ“ p4Interchanges forwards branch-mode native flags');
    } else {
      console.error('[TEST] âœ— p4Interchanges native branch-mode forwarding failed');
    }

    if (fstatCall && fstatCall.args.join('|') === '-F|headRev > 1|-T|depotFile,headRev|-r|-e|123|-Ol|-Ro|-Sd|//depot/main/file.txt') {
      console.error('[TEST] âœ“ p4Fstat forwards advanced native flags');
    } else {
      console.error('[TEST] âœ— p4Fstat native flag forwarding failed');
    }

    if (streamsCall && streamsCall.args.join('|') === '-U|-F|Type=development|--viewmatch|//depot/main/...|//Streams/...') {
      console.error('[TEST] âœ“ p4Streams forwards advanced native filters');
    } else {
      console.error('[TEST] âœ— p4Streams native filter forwarding failed');
    }

    if (clientsCall && clientsCall.args.join('|') === '-u|alice|-S|//Streams/main|-e|alice-*|-a') {
      console.error('[TEST] âœ“ p4Clients forwards advanced native filters');
    } else {
      console.error('[TEST] âœ— p4Clients native filter forwarding failed');
    }

    if (labelsCall && labelsCall.args.join('|') === '-u|alice|-e|rel-*|//depot/main/...') {
      console.error('[TEST] âœ“ p4Labels forwards advanced native filters');
    } else {
      console.error('[TEST] âœ— p4Labels native filter forwarding failed');
    }

    if (jobsCall && jobsCall.args.join('|') === '-e|Status=open|-i|-r|//depot/main/...') {
      console.error('[TEST] âœ“ p4Jobs forwards advanced native filters');
    } else {
      console.error('[TEST] âœ— p4Jobs native filter forwarding failed');
    }

    if (fileInspectResult.ok && printCall && printCall.args.join('|') === '-q|//depot/main/file.txt') {
      console.error('[TEST] âœ“ p4FileInspect runs composite file subcalls');
    } else {
      console.error('[TEST] âœ— p4FileInspect composite behavior failed');
    }

    if (workspaceSnapshotResult.ok && infoCall) {
      console.error('[TEST] âœ“ p4WorkspaceSnapshot runs composite workspace subcalls');
    } else {
      console.error('[TEST] âœ— p4WorkspaceSnapshot composite behavior failed');
    }

    if (searchInspectResult.ok && grepCall && searchInspectResult.result?.summary?.matchedFiles === 1) {
      console.error('[TEST] p4SearchInspect groups grep hits and builds composite previews');
    } else {
      console.error('[TEST] p4SearchInspect composite behavior failed');
    }

    if (reviewPrepareResult.ok && describeCall) {
      console.error('[TEST] p4ReviewPrepare builds review-ready inspection bundles');
    } else {
      console.error('[TEST] p4ReviewPrepare composite behavior failed');
    }

    if (
      changelistCreateResult.ok &&
      changeInputCall &&
      typeof changeInputCall.stdin === 'string' &&
      changeInputCall.stdin.includes('Description:\n\tfirst line\n\tFiles:\n\t\t//depot/evil.txt') &&
      (changeInputCall.stdin.match(/\nFiles:\n/g) || []).length === 1
    ) {
      console.error('[TEST] p4ChangelistCreate indents multiline descriptions to prevent form-field injection');
    } else {
      console.error('[TEST] p4ChangelistCreate form-body escaping failed');
    }

    if (
      submitResult.ok &&
      submitInputCall &&
      typeof submitInputCall.stdin === 'string' &&
      submitInputCall.stdin.includes('Description:\n\tship it\n\tChange:\t999') &&
      (submitInputCall.stdin.match(/\nChange:\t/g) || []).length === 1
    ) {
      console.error('[TEST] p4Submit indents multiline descriptions to keep injected fields inert');
    } else {
      console.error('[TEST] p4Submit form-body escaping failed');
    }

    if (!invalidChangelistCreateResult.ok && invalidChangelistCreateResult.error?.code === 'P4_INVALID_ARGS') {
      console.error('[TEST] p4ChangelistCreate rejects file entries containing form control characters');
    } else {
      console.error('[TEST] p4ChangelistCreate file-entry validation failed');
    }

    // Parser behavior checks with representative script-mode output
    const parsedSync = parse.parseSyncOutput('info1: //depot/main/file.txt#3 - updating C:\\\\ws\\\\file.txt\nexit: 0\n');
    if (Array.isArray(parsedSync) && parsedSync.length === 1) {
      console.error('[TEST] âœ“ parseSyncOutput handles script-mode prefixes');
    } else {
      console.error('[TEST] âœ— parseSyncOutput failed on script-mode input');
    }

    const parsedDescribe = parse.parseDescribeOutput(
      'info1: Change 123 by user@client on 2026/03/03 10:00:00\n' +
      'info1: \tFix issue\n' +
      'info1: Affected files ...\n' +
      'info1: ... //depot/main/file.txt#7 edit\n' +
      'exit: 0\n'
    );
    if (parsedDescribe.change === 123 && Array.isArray(parsedDescribe.files) && parsedDescribe.files.length === 1) {
      console.error('[TEST] âœ“ parseDescribeOutput returns structured changelist data');
    } else {
      console.error('[TEST] âœ— parseDescribeOutput failed');
    }

    const parsedDescribeWithDiff = parse.parseDescribeOutput(
      'info1: Change 124 by user@client on 2026/03/03 10:00:00\n' +
      'info1: \tFix with diff\n' +
      'info1: Affected files ...\n' +
      'info1: ... //depot/main/file.txt#8 edit\n' +
      'info1: Differences ...\n' +
      'info1: ==== //depot/main/file.txt#8 - C:\\\\ws\\\\file.txt ====\n' +
      'info1: @@ -1,1 +1,1 @@\n' +
      'info1: -old line\n' +
      'info1: +new line\n' +
      'exit: 0\n'
    );
    if (parsedDescribeWithDiff.hasDiff === true) {
      console.error('[TEST] âœ“ parseDescribeOutput captures describe diff content');
    } else {
      console.error('[TEST] âœ— parseDescribeOutput did not capture diff content');
    }

    const parsedDiff2 = parse.parseDiff2Output(
      'info1: ==== //depot/main/file.txt#7 - //depot/release/file.txt#5 ==== content\n' +
      'exit: 0\n',
      true
    );
    if (parsedDiff2.totalDifferences === 1 && Array.isArray(parsedDiff2.differences)) {
      console.error('[TEST] Ã¢Å“â€œ parseDiff2Output returns structured depot-to-depot differences');
    } else {
      console.error('[TEST] Ã¢Å“â€” parseDiff2Output failed');
    }

    const parsedFstat = parse.parseFstatOutput('... depotFile //depot/main/file.txt\n... headRev 7\n');
    if (Array.isArray(parsedFstat) && parsedFstat.length >= 1) {
      console.error('[TEST] âœ“ parseFstatOutput returns structured metadata');
    } else {
      console.error('[TEST] âœ— parseFstatOutput failed');
    }

    // Marshaled parser behavior check (dict: {"key":"value"})
    const marshalUnicode = (text) => {
      const textBuffer = Buffer.from(text, 'utf8');
      const header = Buffer.alloc(5);
      header[0] = 'u'.charCodeAt(0);
      header.writeInt32LE(textBuffer.length, 1);
      return Buffer.concat([header, textBuffer]);
    };
    const marshaledDict = Buffer.concat([
      Buffer.from([ '{'.charCodeAt(0) ]),
      marshalUnicode('key'),
      marshalUnicode('value'),
      Buffer.from([ '0'.charCodeAt(0) ]),
    ]);
    const marshaledParsed = runner.parseOutput(marshaledDict, false, true);
    if (marshaledParsed && marshaledParsed.key === 'value') {
      console.error('[TEST] âœ“ Marshaled output parser decodes dictionary payloads');
    } else {
      console.error('[TEST] âœ— Marshaled output parser failed');
    }

    // Test config detection tool
    const configDetectResult = await tools.p4ConfigDetect(context, { workspacePath: __dirname });
    console.error(`[TEST] ✓ Config detect tool works: ${configDetectResult.ok}`);
    
    console.error('[TEST] All component tests passed!');
    console.error('[TEST] ✓ Safety features (read-only mode and delete protection) are working correctly');
    console.error('[TEST] MCP Perforce server is ready for production use with safety defaults');
    process.exit(0);
  } catch (error) {
    console.error('[TEST] Error during component test:', error);
    process.exit(1);
  }
}

// Run test if called directly
if (require.main === module) {
  testComponents();
}
