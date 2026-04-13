/**
 * Composite workflow tools for MCP Perforce server
 */

import { P4RunResult } from '../p4/runner.js';
import { ToolContext, p4Blame, p4Changes, p4Fstat, p4Grep, p4Info, p4Interchanges, p4Integrated, p4Opened, p4Print, p4Review, p4Reviews, p4Status } from './basic.js';
import { p4Describe } from './changelist.js';
import { p4Fixes } from './advanced.js';
import { p4ConfigDetect, p4Filelog } from './utils.js';
import { mergeStringArgs } from './arg-utils.js';

interface CompositeStep<T = unknown> {
  ok: boolean;
  result?: T;
  error?: unknown;
}

function getArrayResult(value: unknown): Record<string, unknown>[] {
  return Array.isArray(value) ? (value as Record<string, unknown>[]) : [];
}

function getStringChangelist(value: unknown): string | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return String(Math.trunc(value));
  }
  if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
    return value.trim();
  }
  return null;
}

function getStringArray(value: unknown): string[] {
  return Array.isArray(value) ? value.filter((item): item is string => typeof item === 'string') : [];
}

function getFstatRecordForInput(
  records: Record<string, unknown>[],
  input: string
): Record<string, unknown> | undefined {
  const normalizedInput = input.trim();
  return records.find((record) => {
    const depotFile = typeof record.depotFile === 'string' ? record.depotFile : null;
    const clientFile = typeof record.clientFile === 'string' ? record.clientFile : null;
    const path = typeof record.path === 'string' ? record.path : null;
    return depotFile === normalizedInput || clientFile === normalizedInput || path === normalizedInput;
  });
}

function buildContextSnippets(
  content: string,
  matchLines: number[],
  contextLines: number
): Array<{ line: number; startLine: number; endLine: number; snippet: string }> {
  const lines = content.split(/\r?\n/);
  return matchLines.map((lineNumber) => {
    const startLine = Math.max(1, lineNumber - contextLines);
    const endLine = Math.min(lines.length, lineNumber + contextLines);
    const snippet = lines.slice(startLine - 1, endLine).join('\n');
    return {
      line: lineNumber,
      startLine,
      endLine,
      snippet,
    };
  });
}

function getWorkflowConcurrency(): number {
  const parsed = parseInt(process.env.P4_WORKFLOW_CONCURRENCY || '6', 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return 6;
  }
  return Math.min(parsed, 32);
}

async function runWithConcurrencyLimit<T, R>(
  items: T[],
  limit: number,
  worker: (item: T, index: number) => Promise<R>
): Promise<R[]> {
  if (items.length === 0) {
    return [];
  }

  const normalizedLimit = Math.max(1, Math.min(limit, items.length));
  const results = new Array<R>(items.length);
  let nextIndex = 0;

  const runWorker = async () => {
    while (true) {
      const current = nextIndex;
      nextIndex += 1;
      if (current >= items.length) {
        return;
      }
      results[current] = await worker(items[current], current);
    }
  };

  const workers: Array<Promise<void>> = [];
  for (let i = 0; i < normalizedLimit; i += 1) {
    workers.push(runWorker());
  }
  await Promise.all(workers);
  return results;
}

/**
 * p4.review.bundle - Aggregate pending review changelists with optional details/reviewers
 */
export async function p4ReviewBundle(
  context: ToolContext,
  args: {
    counter?: string;
    filespec?: string;
    maxChanges?: number;
    includeDescribe?: boolean;
    includeReviewers?: boolean;
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  const workflowConcurrency = getWorkflowConcurrency();
  const includeDescribe = args.includeDescribe !== false;
  const includeReviewers = args.includeReviewers !== false;
  const maxChanges = Math.max(1, Math.min(args.maxChanges || 10, 100));

  const reviewResult = await p4Review(context, {
    counter: args.counter,
    filespec: args.filespec,
    workspacePath: args.workspacePath,
  });

  if (!reviewResult.ok) {
    return {
      ok: false,
      command: 'review.bundle',
      args: [],
      cwd: reviewResult.cwd,
      configUsed: reviewResult.configUsed || {},
      error: reviewResult.error,
      warnings: reviewResult.warnings,
      result: {
        steps: {
          review: {
            ok: false,
            error: reviewResult.error,
          } as CompositeStep,
        },
      },
    };
  }

  const pendingChanges = getArrayResult(reviewResult.result);
  const selectedChanges = pendingChanges.slice(0, maxChanges);
  const changelists = selectedChanges
    .map((record) => getStringChangelist(record.change))
    .filter((value): value is string => value !== null);

  const describeByChange = new Map<string, CompositeStep>();
  const reviewersByChange = new Map<string, CompositeStep>();
  const subcallCounts: Record<string, number> = {
    review: 1,
    describe: 0,
    reviews: 0,
  };
  const warnings: string[] = [...(reviewResult.warnings || [])];

  if (includeDescribe && changelists.length > 0) {
    const describeResults = await runWithConcurrencyLimit(
      changelists,
      workflowConcurrency,
      async (changelist) => {
        const result = await p4Describe(context, { changelist, workspacePath: args.workspacePath });
        return { changelist, result };
      }
    );
    subcallCounts.describe = describeResults.length;
    for (const entry of describeResults) {
      describeByChange.set(entry.changelist, {
        ok: entry.result.ok,
        result: entry.result.result,
        error: entry.result.error,
      });
      if (!entry.result.ok && entry.result.error) {
        warnings.push(`describe failed for changelist ${entry.changelist}`);
      }
    }
  }

  if (includeReviewers && changelists.length > 0) {
    const reviewerResults = await runWithConcurrencyLimit(
      changelists,
      workflowConcurrency,
      async (changelist) => {
        const result = await p4Reviews(context, { changelist, workspacePath: args.workspacePath });
        return { changelist, result };
      }
    );
    subcallCounts.reviews = reviewerResults.length;
    for (const entry of reviewerResults) {
      reviewersByChange.set(entry.changelist, {
        ok: entry.result.ok,
        result: entry.result.result,
        error: entry.result.error,
      });
      if (!entry.result.ok && entry.result.error) {
        warnings.push(`reviews failed for changelist ${entry.changelist}`);
      }
    }
  }

  const bundled: Array<Record<string, unknown> & { details?: CompositeStep; reviewers?: CompositeStep }> = selectedChanges.map((record) => {
    const change = getStringChangelist(record.change);
    return {
      ...record,
      details: change ? describeByChange.get(change) : undefined,
      reviewers: change ? reviewersByChange.get(change) : undefined,
    };
  });

  const summary = {
    totalPending: pendingChanges.length,
    included: bundled.length,
    includeDescribe,
    includeReviewers,
    byUser: bundled.reduce<Record<string, number>>((acc, change) => {
      const userValue = change['user'];
      const user = typeof userValue === 'string' ? userValue : 'unknown';
      acc[user] = (acc[user] || 0) + 1;
      return acc;
    }, {}),
  };

  return {
    ok: true,
    command: 'review.bundle',
    args: [],
    cwd: reviewResult.cwd,
    configUsed: reviewResult.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary,
      changes: bundled,
      meta: {
        subcallCounts,
        totalSubcalls: Object.values(subcallCounts).reduce((sum, value) => sum + value, 0),
        workflowConcurrency,
      },
      steps: {
        review: { ok: true, result: selectedChanges } as CompositeStep,
      },
    },
  };
}

/**
 * p4.change.inspect - Aggregate changelist details, jobs, reviewers, and optional file history
 */
export async function p4ChangeInspect(
  context: ToolContext,
  args: {
    changelist: string;
    includeDiff?: boolean;
    diffFormat?: 'u' | 'c' | 'n' | 's';
    includeFileHistory?: boolean;
    maxFilesWithHistory?: number;
    maxRevisions?: number;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  const workflowConcurrency = getWorkflowConcurrency();
  if (!args.changelist || !/^\d+$/.test(args.changelist)) {
    return {
      ok: false,
      command: 'change.inspect',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'changelist parameter is required and must be numeric',
      },
    };
  }

  const includeFileHistory = args.includeFileHistory === true;
  const maxFilesWithHistory = Math.max(1, Math.min(args.maxFilesWithHistory || 5, 20));
  const maxRevisions = Math.max(1, Math.min(args.maxRevisions || 5, 50));

  const [describeResult, fixesResult, reviewersResult] = await Promise.all([
    p4Describe(context, {
      changelist: args.changelist,
      includeDiff: args.includeDiff,
      diffFormat: args.diffFormat,
      workspacePath: args.workspacePath,
    }),
    p4Fixes(context, { changelist: args.changelist, workspacePath: args.workspacePath }),
    p4Reviews(context, { changelist: args.changelist, workspacePath: args.workspacePath }),
  ]);

  if (!describeResult.ok) {
    return {
      ok: false,
      command: 'change.inspect',
      args: [],
      cwd: describeResult.cwd,
      configUsed: describeResult.configUsed || {},
      error: describeResult.error,
      warnings: describeResult.warnings,
      result: {
        steps: {
          describe: { ok: false, error: describeResult.error } as CompositeStep,
        },
      },
    };
  }

  const describeData =
    describeResult.result && typeof describeResult.result === 'object'
      ? (describeResult.result as Record<string, unknown>)
      : {};

  const files = Array.isArray(describeData.files)
    ? (describeData.files as Array<Record<string, unknown>>)
    : [];

  const warnings: string[] = [
    ...(describeResult.warnings || []),
    ...(fixesResult.warnings || []),
    ...(reviewersResult.warnings || []),
  ];
  const subcallCounts: Record<string, number> = {
    describe: 1,
    fixes: 1,
    reviews: 1,
    filelog: 0,
  };

  const fileHistory: Array<{ filespec: string; step: CompositeStep }> = [];
  if (includeFileHistory && files.length > 0) {
    const fileSpecs = files
      .map((f) => (typeof f.depotFile === 'string' ? f.depotFile : null))
      .filter((f): f is string => f !== null)
      .slice(0, maxFilesWithHistory);

    const historyResults = await runWithConcurrencyLimit(
      fileSpecs,
      workflowConcurrency,
      async (filespec) => {
        const history = await p4Filelog(context, {
          filespec,
          maxRevisions,
          workspacePath: args.workspacePath,
        });
        return { filespec, history };
      }
    );
    subcallCounts.filelog = historyResults.length;

    for (const entry of historyResults) {
      fileHistory.push({
        filespec: entry.filespec,
        step: {
          ok: entry.history.ok,
          result: entry.history.result,
          error: entry.history.error,
        },
      });
      if (!entry.history.ok && entry.history.error) {
        warnings.push(`filelog failed for ${entry.filespec}`);
      }
    }
  }

  return {
    ok: true,
    command: 'change.inspect',
    args: [],
    cwd: describeResult.cwd,
    configUsed: describeResult.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary: {
        changelist: args.changelist,
        fileCount: files.length,
        fixesCount: getArrayResult(fixesResult.result).length,
        reviewerCount: getArrayResult(reviewersResult.result).length,
        hasDiff:
          typeof describeData.hasDiff === 'boolean'
            ? describeData.hasDiff
            : false,
        includeFileHistory,
      },
      meta: {
        subcallCounts,
        totalSubcalls: Object.values(subcallCounts).reduce((sum, value) => sum + value, 0),
        workflowConcurrency,
      },
      steps: {
        describe: {
          ok: describeResult.ok,
          result: describeResult.result,
          error: describeResult.error,
        } as CompositeStep,
        fixes: {
          ok: fixesResult.ok,
          result: fixesResult.result,
          error: fixesResult.error,
        } as CompositeStep,
        reviews: {
          ok: reviewersResult.ok,
          result: reviewersResult.result,
          error: reviewersResult.error,
        } as CompositeStep,
        fileHistory,
      },
    },
  };
}

/**
 * p4.path.synccheck - Compare integration drift between two paths
 */
export async function p4PathSyncCheck(
  context: ToolContext,
  args: {
    sourcePath: string;
    targetPath: string;
    maxInterchanges?: number;
    includeIntegrated?: boolean;
    checkBothDirections?: boolean;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  if (!args.sourcePath || !args.targetPath) {
    return {
      ok: false,
      command: 'path.synccheck',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'sourcePath and targetPath are required',
      },
    };
  }

  const maxInterchanges = Math.max(1, Math.min(args.maxInterchanges || 50, 200));
  const includeIntegrated = args.includeIntegrated !== false;
  const checkBothDirections = args.checkBothDirections !== false;
  const workflowConcurrency = getWorkflowConcurrency();

  const interchangesPromises: Array<Promise<P4RunResult>> = [
    p4Interchanges(context, {
      sourcePath: args.sourcePath,
      targetPath: args.targetPath,
      max: maxInterchanges,
      workspacePath: args.workspacePath,
    }),
  ];
  if (checkBothDirections) {
    interchangesPromises.push(
      p4Interchanges(context, {
        sourcePath: args.targetPath,
        targetPath: args.sourcePath,
        max: maxInterchanges,
        workspacePath: args.workspacePath,
      })
    );
  }
  const [forwardInterchanges, reverseInterchangesResult] = await Promise.all(interchangesPromises);
  let reverseInterchanges: P4RunResult | null = checkBothDirections ? (reverseInterchangesResult || null) : null;

  if (!forwardInterchanges.ok) {
    return {
      ok: false,
      command: 'path.synccheck',
      args: [],
      cwd: forwardInterchanges.cwd,
      configUsed: forwardInterchanges.configUsed || {},
      error: forwardInterchanges.error,
      warnings: forwardInterchanges.warnings,
      result: {
        steps: {
          interchangesForward: {
            ok: false,
            error: forwardInterchanges.error,
          } as CompositeStep,
        },
      },
    };
  }

  const warnings: string[] = [...(forwardInterchanges.warnings || [])];
  const subcallCounts: Record<string, number> = {
    interchanges: checkBothDirections ? 2 : 1,
    integrated: 0,
  };
  if (reverseInterchanges?.warnings) {
    warnings.push(...reverseInterchanges.warnings);
  }
  if (checkBothDirections && reverseInterchanges && !reverseInterchanges.ok) {
    warnings.push('reverse interchanges check failed');
  }

  let integratedForward: P4RunResult | null = null;
  let integratedReverse: P4RunResult | null = null;
  if (includeIntegrated) {
    [integratedForward, integratedReverse] = await Promise.all([
      p4Integrated(context, {
        sourcePath: args.sourcePath,
        targetPath: args.targetPath,
        workspacePath: args.workspacePath,
      }),
      checkBothDirections
        ? p4Integrated(context, {
            sourcePath: args.targetPath,
            targetPath: args.sourcePath,
            workspacePath: args.workspacePath,
          })
        : Promise.resolve(null as P4RunResult | null),
    ]);
    subcallCounts.integrated = checkBothDirections ? 2 : 1;
    if (integratedForward?.warnings) {
      warnings.push(...integratedForward.warnings);
    }
    if (integratedReverse?.warnings) {
      warnings.push(...integratedReverse.warnings);
    }
  }

  const aheadToTarget = getArrayResult(forwardInterchanges.result).length;
  const aheadToSource = reverseInterchanges && reverseInterchanges.ok
    ? getArrayResult(reverseInterchanges.result).length
    : checkBothDirections
      ? null
      : 0;

  const syncState =
    aheadToSource === null
      ? 'partial'
      : aheadToTarget === 0 && aheadToSource === 0
      ? 'in_sync'
      : aheadToTarget > 0 && aheadToSource > 0
        ? 'diverged'
        : aheadToTarget > 0
          ? 'source_ahead'
          : 'target_ahead';

  return {
    ok: true,
    command: 'path.synccheck',
    args: [],
    cwd: forwardInterchanges.cwd,
    configUsed: forwardInterchanges.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary: {
        sourcePath: args.sourcePath,
        targetPath: args.targetPath,
        aheadToTarget,
        aheadToSource,
        syncState,
        includeIntegrated,
        checkBothDirections,
        workflowConcurrency,
      },
      meta: {
        subcallCounts,
        totalSubcalls: Object.values(subcallCounts).reduce((sum, value) => sum + value, 0),
      },
      steps: {
        interchangesForward: {
          ok: forwardInterchanges.ok,
          result: forwardInterchanges.result,
          error: forwardInterchanges.error,
        } as CompositeStep,
        interchangesReverse: reverseInterchanges
          ? ({
              ok: reverseInterchanges.ok,
              result: reverseInterchanges.result,
              error: reverseInterchanges.error,
            } as CompositeStep)
          : undefined,
        integratedForward: integratedForward
          ? ({
              ok: integratedForward.ok,
              result: integratedForward.result,
              error: integratedForward.error,
            } as CompositeStep)
          : undefined,
        integratedReverse: integratedReverse
          ? ({
              ok: integratedReverse.ok,
              result: integratedReverse.result,
              error: integratedReverse.error,
            } as CompositeStep)
          : undefined,
      },
    },
  };
}

/**
 * p4.file.inspect - Aggregate metadata, history, content, and blame for one or more files
 */
export async function p4FileInspect(
  context: ToolContext,
  args: {
    filespec?: string;
    filespecs?: string[];
    includeFstat?: boolean;
    includeHistory?: boolean;
    includeContent?: boolean;
    includeBlame?: boolean;
    maxFiles?: number;
    maxRevisions?: number;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  const requestedFiles = mergeStringArgs(args.filespec, args.filespecs);
  if (requestedFiles.length === 0) {
    return {
      ok: false,
      command: 'file.inspect',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'filespec or filespecs is required',
      },
    };
  }

  const workflowConcurrency = getWorkflowConcurrency();
  const maxFiles = Math.max(1, Math.min(args.maxFiles || requestedFiles.length, 25));
  const maxRevisions = Math.max(1, Math.min(args.maxRevisions || 5, 50));
  const selectedFiles = requestedFiles.slice(0, maxFiles);
  const includeFstat = args.includeFstat !== false;
  const includeHistory = args.includeHistory !== false;
  const includeContent = args.includeContent === true;
  const includeBlame = args.includeBlame === true;

  const warnings: string[] = [];
  const subcallCounts: Record<string, number> = {
    fstat: 0,
    filelog: 0,
    print: 0,
    blame: 0,
  };

  let fstatStep: CompositeStep | undefined;
  let fstatRecords: Record<string, unknown>[] = [];
  if (includeFstat) {
    const fstatResult = await p4Fstat(context, {
      filespecs: selectedFiles,
      workspacePath: args.workspacePath,
    });
    subcallCounts.fstat = 1;
    fstatStep = {
      ok: fstatResult.ok,
      result: fstatResult.result,
      error: fstatResult.error,
    };
    fstatRecords = getArrayResult(fstatResult.result);
    if (fstatResult.warnings) {
      warnings.push(...fstatResult.warnings);
    }
  }

  const historyResults = includeHistory
    ? await runWithConcurrencyLimit(
        selectedFiles,
        workflowConcurrency,
        async (filespec) => ({
          filespec,
          response: await p4Filelog(context, {
            filespec,
            maxRevisions,
            workspacePath: args.workspacePath,
          }),
        })
      )
    : [];
  subcallCounts.filelog = historyResults.length;

  const printResults = includeContent
    ? await runWithConcurrencyLimit(
        selectedFiles,
        workflowConcurrency,
        async (filespec) => ({
          filespec,
          response: await p4Print(context, {
            filespec,
            quiet: true,
            workspacePath: args.workspacePath,
          }),
        })
      )
    : [];
  subcallCounts.print = printResults.length;

  const blameResults = includeBlame
    ? await runWithConcurrencyLimit(
        selectedFiles,
        workflowConcurrency,
        async (filespec) => ({
          filespec,
          response: await p4Blame(context, {
            file: filespec,
            workspacePath: args.workspacePath,
          }),
        })
      )
    : [];
  subcallCounts.blame = blameResults.length;

  const historyByFile = new Map(historyResults.map((entry) => [entry.filespec, entry.response]));
  const printByFile = new Map(printResults.map((entry) => [entry.filespec, entry.response]));
  const blameByFile = new Map(blameResults.map((entry) => [entry.filespec, entry.response]));

  for (const entry of [...historyResults, ...printResults, ...blameResults]) {
    if (entry.response.warnings) {
      warnings.push(...entry.response.warnings);
    }
  }

  const inspectedFiles = selectedFiles.map((filespec) => {
    const history = historyByFile.get(filespec);
    const printed = printByFile.get(filespec);
    const blame = blameByFile.get(filespec);
    return {
      filespec,
      fstat: includeFstat
        ? ({
            ok: !!fstatStep?.ok,
            result: getFstatRecordForInput(fstatRecords, filespec),
            error: fstatStep?.ok ? undefined : fstatStep?.error,
          } as CompositeStep)
        : undefined,
      history: history
        ? ({
            ok: history.ok,
            result: history.result,
            error: history.error,
          } as CompositeStep)
        : undefined,
      content: printed
        ? ({
            ok: printed.ok,
            result: printed.result,
            error: printed.error,
          } as CompositeStep)
        : undefined,
      blame: blame
        ? ({
            ok: blame.ok,
            result: blame.result,
            error: blame.error,
          } as CompositeStep)
        : undefined,
    };
  });

  const firstResponse =
    historyResults[0]?.response ||
    printResults[0]?.response ||
    blameResults[0]?.response;

  return {
    ok: true,
    command: 'file.inspect',
    args: [],
    cwd: firstResponse?.cwd || process.cwd(),
    configUsed: firstResponse?.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary: {
        requestedFiles: requestedFiles.length,
        includedFiles: inspectedFiles.length,
        includeFstat,
        includeHistory,
        includeContent,
        includeBlame,
        maxRevisions,
        workflowConcurrency,
      },
      files: inspectedFiles,
      meta: {
        subcallCounts,
        totalSubcalls: Object.values(subcallCounts).reduce((sum, value) => sum + value, 0),
      },
      steps: {
        fstat: fstatStep,
      },
    },
  };
}

/**
 * p4.workspace.snapshot - Aggregate workspace info, status, config, and optional details
 */
export async function p4WorkspaceSnapshot(
  context: ToolContext,
  args: {
    includeConfig?: boolean;
    includeOpened?: boolean;
    includeRecentChanges?: boolean;
    recentChangesMax?: number;
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  const includeConfig = args.includeConfig !== false;
  const includeOpened = args.includeOpened === true;
  const includeRecentChanges = args.includeRecentChanges === true;
  const recentChangesMax = Math.max(1, Math.min(args.recentChangesMax || 10, 50));

  const [infoResult, statusResult, configResult, openedResult, recentChangesResult] = await Promise.all([
    p4Info(context, { workspacePath: args.workspacePath }),
    p4Status(context, { workspacePath: args.workspacePath }),
    includeConfig ? p4ConfigDetect(context, { workspacePath: args.workspacePath }) : Promise.resolve(null),
    includeOpened ? p4Opened(context, { workspacePath: args.workspacePath }) : Promise.resolve(null),
    includeRecentChanges
      ? p4Changes(context, {
          max: recentChangesMax,
          workspacePath: args.workspacePath,
        })
      : Promise.resolve(null),
  ]);

  if (!infoResult.ok && !statusResult.ok) {
    return {
      ok: false,
      command: 'workspace.snapshot',
      args: [],
      cwd: statusResult.cwd || infoResult.cwd || process.cwd(),
      configUsed: statusResult.configUsed || infoResult.configUsed || {},
      error: statusResult.error || infoResult.error,
      warnings: [...(infoResult.warnings || []), ...(statusResult.warnings || [])],
    };
  }

  const warnings: string[] = [
    ...(infoResult.warnings || []),
    ...(statusResult.warnings || []),
    ...(configResult?.warnings || []),
    ...(openedResult?.warnings || []),
    ...(recentChangesResult?.warnings || []),
  ];

  const statusData =
    statusResult.result && typeof statusResult.result === 'object'
      ? (statusResult.result as Record<string, unknown>)
      : {};
  const summaryData =
    statusData.summary && typeof statusData.summary === 'object'
      ? (statusData.summary as Record<string, unknown>)
      : {};

  return {
    ok: true,
    command: 'workspace.snapshot',
    args: [],
    cwd: statusResult.cwd || infoResult.cwd || process.cwd(),
    configUsed: statusResult.configUsed || infoResult.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary: {
        totalOpenedFiles: summaryData.totalOpenedFiles || 0,
        totalPendingChanges: summaryData.totalPendingChanges || 0,
        filesByAction: summaryData.filesByAction || {},
        recentChangesCount: recentChangesResult ? getArrayResult(recentChangesResult.result).length : 0,
        includeConfig,
        includeOpened,
        includeRecentChanges,
      },
      steps: {
        info: {
          ok: infoResult.ok,
          result: infoResult.result,
          error: infoResult.error,
        } as CompositeStep,
        status: {
          ok: statusResult.ok,
          result: statusResult.result,
          error: statusResult.error,
        } as CompositeStep,
        config: configResult
          ? ({
              ok: configResult.ok,
              result: configResult.result,
              error: configResult.error,
            } as CompositeStep)
          : undefined,
        opened: openedResult
          ? ({
              ok: openedResult.ok,
              result: openedResult.result,
              error: openedResult.error,
            } as CompositeStep)
          : undefined,
        recentChanges: recentChangesResult
          ? ({
              ok: recentChangesResult.ok,
              result: recentChangesResult.result,
              error: recentChangesResult.error,
            } as CompositeStep)
          : undefined,
      },
      meta: {
        subcallCounts: {
          info: 1,
          status: 1,
          config: includeConfig ? 1 : 0,
          opened: includeOpened ? 1 : 0,
          changes: includeRecentChanges ? 1 : 0,
        },
      },
    },
  };
}

/**
 * p4.search.inspect - Aggregate grep matches with grouped file metadata and optional content snippets
 */
export async function p4SearchInspect(
  context: ToolContext,
  args: {
    pattern: string;
    filespec?: string;
    filespecs?: string[];
    caseInsensitive?: boolean;
    maxFiles?: number;
    maxMatchesPerFile?: number;
    includeFstat?: boolean;
    includeContentPreview?: boolean;
    previewContextLines?: number;
    workspacePath?: string;
  }
): Promise<P4RunResult> {
  if (!args.pattern) {
    return {
      ok: false,
      command: 'search.inspect',
      args: [],
      cwd: process.cwd(),
      configUsed: {},
      error: {
        code: 'P4_INVALID_ARGS',
        message: 'pattern is required',
      },
    };
  }

  const requestedFilespecs = mergeStringArgs(args.filespec, args.filespecs);
  const maxFiles = Math.max(1, Math.min(args.maxFiles || 20, 100));
  const maxMatchesPerFile = Math.max(1, Math.min(args.maxMatchesPerFile || 10, 100));
  const previewContextLines = Math.max(0, Math.min(args.previewContextLines || 2, 20));
  const includeFstat = args.includeFstat !== false;
  const includeContentPreview = args.includeContentPreview === true;
  const workflowConcurrency = getWorkflowConcurrency();

  const grepResult = await p4Grep(context, {
    pattern: args.pattern,
    filespecs: requestedFilespecs.length > 0 ? requestedFilespecs : undefined,
    caseInsensitive: args.caseInsensitive,
    workspacePath: args.workspacePath,
  });

  if (!grepResult.ok) {
    return {
      ok: false,
      command: 'search.inspect',
      args: [],
      cwd: grepResult.cwd,
      configUsed: grepResult.configUsed || {},
      error: grepResult.error,
      warnings: grepResult.warnings,
    };
  }

  const grepMatches = getArrayResult(grepResult.result);
  const groupedMatches = new Map<string, Record<string, unknown>[]>();
  for (const match of grepMatches) {
    const file = typeof match.file === 'string' ? match.file : null;
    if (!file) continue;
    const existing = groupedMatches.get(file) || [];
    if (existing.length < maxMatchesPerFile) {
      existing.push(match);
      groupedMatches.set(file, existing);
    }
  }

  const selectedFiles = Array.from(groupedMatches.keys()).slice(0, maxFiles);
  const warnings: string[] = [...(grepResult.warnings || [])];
  const subcallCounts: Record<string, number> = {
    grep: 1,
    fstat: 0,
    print: 0,
  };

  let fstatRecords: Record<string, unknown>[] = [];
  if (includeFstat && selectedFiles.length > 0) {
    const fstatResult = await p4Fstat(context, {
      filespecs: selectedFiles,
      workspacePath: args.workspacePath,
    });
    subcallCounts.fstat = 1;
    fstatRecords = getArrayResult(fstatResult.result);
    if (fstatResult.warnings) {
      warnings.push(...fstatResult.warnings);
    }
  }

  const printResults = includeContentPreview && selectedFiles.length > 0
    ? await runWithConcurrencyLimit(
        selectedFiles,
        workflowConcurrency,
        async (filespec) => ({
          filespec,
          response: await p4Print(context, {
            filespec,
            quiet: true,
            workspacePath: args.workspacePath,
          }),
        })
      )
    : [];
  subcallCounts.print = printResults.length;
  const printByFile = new Map(printResults.map((entry) => [entry.filespec, entry.response]));
  for (const entry of printResults) {
    if (entry.response.warnings) {
      warnings.push(...entry.response.warnings);
    }
  }

  const files = selectedFiles.map((filespec) => {
    const matches = groupedMatches.get(filespec) || [];
    const printed = printByFile.get(filespec);
    const content =
      printed &&
      printed.result &&
      typeof printed.result === 'object' &&
      typeof (printed.result as Record<string, unknown>).content === 'string'
        ? ((printed.result as Record<string, unknown>).content as string)
        : '';
    const matchLines = matches
      .map((match) => (typeof match.line === 'number' ? match.line : null))
      .filter((line): line is number => line !== null);
    return {
      filespec,
      totalMatches: matches.length,
      matches,
      fstat: includeFstat ? getFstatRecordForInput(fstatRecords, filespec) : undefined,
      previews: includeContentPreview && content
        ? buildContextSnippets(content, matchLines, previewContextLines)
        : undefined,
    };
  });

  return {
    ok: true,
    command: 'search.inspect',
    args: [],
    cwd: grepResult.cwd,
    configUsed: grepResult.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary: {
        pattern: args.pattern,
        requestedFilespecs: requestedFilespecs.length,
        matchedFiles: groupedMatches.size,
        includedFiles: files.length,
        totalMatches: grepMatches.length,
        includeFstat,
        includeContentPreview,
        previewContextLines,
        workflowConcurrency,
      },
      files,
      meta: {
        subcallCounts,
        totalSubcalls: Object.values(subcallCounts).reduce((sum, value) => sum + value, 0),
      },
      steps: {
        grep: {
          ok: grepResult.ok,
          result: grepResult.result,
          error: grepResult.error,
        } as CompositeStep,
      },
    },
  };
}

/**
 * p4.review.prepare - Build review-ready context for explicit or discovered changelists
 */
export async function p4ReviewPrepare(
  context: ToolContext,
  args: {
    changelist?: string;
    changelists?: string[];
    status?: 'submitted' | 'pending' | 'shelved';
    user?: string;
    client?: string;
    filespec?: string;
    filespecs?: string[];
    maxChanges?: number;
    includeDiff?: boolean;
    diffFormat?: 'u' | 'c' | 'n' | 's';
    includeFileHistory?: boolean;
    maxFilesWithHistory?: number;
    maxRevisions?: number;
    workspacePath?: string;
  } = {}
): Promise<P4RunResult> {
  const explicitChanges = mergeStringArgs(args.changelist, args.changelists).filter((value) => /^\d+$/.test(value));
  const maxChanges = Math.max(1, Math.min(args.maxChanges || explicitChanges.length || 10, 50));
  const workflowConcurrency = getWorkflowConcurrency();

  let selectedChanges = explicitChanges.slice(0, maxChanges);
  let discoveryStep: CompositeStep | undefined;
  const warnings: string[] = [];
  const subcallCounts: Record<string, number> = {
    changes: 0,
    changeInspect: 0,
  };

  if (selectedChanges.length === 0) {
    const filespecs = mergeStringArgs(args.filespec, args.filespecs);
    const changesResult = await p4Changes(context, {
      status: args.status,
      user: args.user,
      client: args.client,
      filespecs: filespecs.length > 0 ? filespecs : undefined,
      max: maxChanges,
      workspacePath: args.workspacePath,
    });
    subcallCounts.changes = 1;
    discoveryStep = {
      ok: changesResult.ok,
      result: changesResult.result,
      error: changesResult.error,
    };
    if (!changesResult.ok) {
      return {
        ok: false,
        command: 'review.prepare',
        args: [],
        cwd: changesResult.cwd,
        configUsed: changesResult.configUsed || {},
        error: changesResult.error,
        warnings: changesResult.warnings,
        result: {
          steps: {
            discovery: discoveryStep,
          },
        },
      };
    }
    if (changesResult.warnings) {
      warnings.push(...changesResult.warnings);
    }
    selectedChanges = getArrayResult(changesResult.result)
      .map((record) => getStringChangelist(record.change))
      .filter((value): value is string => value !== null)
      .slice(0, maxChanges);
  }

  const inspectionResults = await runWithConcurrencyLimit(
    selectedChanges,
    workflowConcurrency,
    async (changelist) => ({
      changelist,
      response: await p4ChangeInspect(context, {
        changelist,
        includeDiff: args.includeDiff,
        diffFormat: args.diffFormat,
        includeFileHistory: args.includeFileHistory,
        maxFilesWithHistory: args.maxFilesWithHistory,
        maxRevisions: args.maxRevisions,
        workspacePath: args.workspacePath,
      }),
    })
  );
  subcallCounts.changeInspect = inspectionResults.length;

  for (const entry of inspectionResults) {
    if (entry.response.warnings) {
      warnings.push(...entry.response.warnings);
    }
  }

  const changes = inspectionResults.map((entry) => ({
    changelist: entry.changelist,
    inspection: {
      ok: entry.response.ok,
      result: entry.response.result,
      error: entry.response.error,
    } as CompositeStep,
  }));

  const firstResponse = inspectionResults[0]?.response;

  return {
    ok: true,
    command: 'review.prepare',
    args: [],
    cwd: firstResponse?.cwd || process.cwd(),
    configUsed: firstResponse?.configUsed || {},
    warnings: warnings.length > 0 ? warnings : undefined,
    result: {
      summary: {
        selectedChanges: selectedChanges.length,
        includeDiff: args.includeDiff === true,
        includeFileHistory: args.includeFileHistory === true,
        workflowConcurrency,
      },
      changes,
      meta: {
        subcallCounts,
        totalSubcalls: Object.values(subcallCounts).reduce((sum, value) => sum + value, 0),
      },
      steps: {
        discovery: discoveryStep,
      },
    },
  };
}
