export type RunStatus = 'ok' | 'retry' | 'fail';

export type DigestRow = {
  job: string;
  owner: string | null;
  runs: number;
  retries: number;
  lastStatus: RunStatus;
  lastError: string | null;
  firstAt: string;
  lastAt: string;
};

export type NightDigest = {
  night: string;
  rows: DigestRow[];
  badLines: number;
  counts: { ok: number; retry: number; fail: number };
};

/** Read `runs/<night>.jsonl` into one row per job. Missing file → null. */
export type ReadNight = (runsDir: string, night: string) => NightDigest | null;
