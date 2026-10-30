import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import type { DigestRow, NightDigest, ReadNight, RunStatus } from './types.js';

const STATUSES = new Set<RunStatus>(['ok', 'retry', 'fail']);

type LogLine = {
  at: string;
  job: string;
  status: RunStatus;
  owner: string | null;
  error?: string;
};

const parseLine = (line: string): LogLine | null => {
  let raw: unknown;
  try {
    raw = JSON.parse(line);
  } catch {
    return null;
  }
  if (raw === null || typeof raw !== 'object') return null;
  const obj = raw as Record<string, unknown>;
  if (typeof obj.at !== 'string' || typeof obj.job !== 'string') return null;
  if (typeof obj.status !== 'string' || !STATUSES.has(obj.status as RunStatus)) return null;
  if (!('owner' in obj)) return null;
  if (obj.owner !== null && typeof obj.owner !== 'string') return null;
  if (obj.error !== undefined && typeof obj.error !== 'string') return null;
  return {
    at: obj.at,
    job: obj.job,
    status: obj.status as RunStatus,
    owner: obj.owner,
    error: obj.error,
  };
};

export const readNight: ReadNight = (runsDir, night) => {
  const path = join(runsDir, `${night}.jsonl`);
  let text: string;
  try {
    text = readFileSync(path, 'utf8');
  } catch {
    return null;
  }

  const byJob = new Map<string, DigestRow>();
  const counts = { ok: 0, retry: 0, fail: 0 };
  let badLines = 0;

  for (const line of text.split('\n')) {
    if (line.trim() === '') continue;
    const parsed = parseLine(line);
    if (!parsed) {
      badLines += 1;
      continue;
    }
    counts[parsed.status] += 1;
    const existing = byJob.get(parsed.job);
    if (!existing) {
      byJob.set(parsed.job, {
        job: parsed.job,
        owner: parsed.owner,
        runs: 1,
        retries: parsed.status === 'retry' ? 1 : 0,
        lastStatus: parsed.status,
        lastError: parsed.error ?? null,
        firstAt: parsed.at,
        lastAt: parsed.at,
      });
      continue;
    }
    existing.runs += 1;
    if (parsed.status === 'retry') existing.retries += 1;
    existing.owner = parsed.owner;
    existing.lastStatus = parsed.status;
    existing.lastError = parsed.error ?? null;
    existing.lastAt = parsed.at;
  }

  const rows = [...byJob.values()].sort((a, b) => a.job.localeCompare(b.job));
  return { night, rows, badLines, counts };
};
