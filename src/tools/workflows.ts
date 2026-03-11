/**
 * Composite workflow tools for MCP Perforce server
 */

import { P4RunResult } from '../p4/runner.js';
import { ToolContext, p4Interchanges, p4Integrated, p4Review, p4Reviews } from './basic.js';
import { p4Describe } from './changelist.js';
import { p4Fixes } from './advanced.js';
import { p4Filelog } from './utils.js';

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
