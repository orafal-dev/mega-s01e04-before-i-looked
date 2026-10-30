import { mkdtempSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { describe, expect, it } from 'vitest';
import { createApp } from '../src/app.js';

const baseConfig = {
  adapter: 'shim',
  installed: '2026-10-29T14:06:00+01:00',
  beatEverySeconds: 60,
  runsDir: 'runs',
};

describe('digest routes', () => {
  it('GET /digest/2026-10-28 renders the jobs', async () => {
    const res = await createApp(baseConfig).request('/digest/2026-10-28');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('digest · 2026-10-28');
    expect(html).toContain('digest/render');
    expect(html).toContain('fixtures/refresh');
    expect(html).toContain('lane/sync');
    expect(html).toContain('notes/backup');
    expect(html).toContain('rig/rotate-logs');
    expect(html).toContain('—');
  });

  it('GET /api/digest/2026-10-28 matches the page job order', async () => {
    const app = createApp(baseConfig);
    const page = await (await app.request('/digest/2026-10-28')).text();
    const api = await app.request('/api/digest/2026-10-28');
    const rows = (await api.json()) as { job: string }[];
    expect(api.status).toBe(200);
    const jobs = rows.map((r) => r.job);
    expect(jobs).toEqual([
      'digest/render',
      'fixtures/refresh',
      'lane/sync',
      'notes/backup',
      'rig/rotate-logs',
    ]);
    for (const job of jobs) {
      expect(page.indexOf(job)).toBeGreaterThan(-1);
    }
    // Same order on the page as in JSON: each next job appears after the previous.
    let cursor = 0;
    for (const job of jobs) {
      const at = page.indexOf(job, cursor);
      expect(at).toBeGreaterThanOrEqual(cursor);
      cursor = at + job.length;
    }
  });

  it('returns 404 when the night file is missing', async () => {
    const app = createApp(baseConfig);
    expect((await app.request('/digest/2099-01-01')).status).toBe(404);
    expect((await app.request('/api/digest/2099-01-01')).status).toBe(404);
  });

  it('empty night renders nothing ran and empty JSON', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(join(dir, '2026-01-01.jsonl'), '');
    const app = createApp({ ...baseConfig, runsDir: dir });

    const page = await app.request('/digest/2026-01-01');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('nothing ran');

    const api = await app.request('/api/digest/2026-01-01');
    expect(api.status).toBe(200);
    expect(await api.json()).toEqual([]);
  });

  it('a night with a bad line still renders', async () => {
    const dir = mkdtempSync(join(tmpdir(), 'rig-runs-'));
    writeFileSync(
      join(dir, '2026-01-02.jsonl'),
      [
        '{"at":"2026-01-02T01:00:00+01:00","job":"a/job","status":"ok","owner":"rook"}',
        'not-json',
        '',
      ].join('\n'),
    );
    const app = createApp({ ...baseConfig, runsDir: dir });
    const page = await app.request('/digest/2026-01-02');
    expect(page.status).toBe(200);
    expect(await page.text()).toContain('a/job');
    const rows = await (await app.request('/api/digest/2026-01-02')).json();
    expect(rows).toHaveLength(1);
  });
});

describe('status board digest links', () => {
  it('links both nights on disk to digests with counts', async () => {
    const res = await createApp(baseConfig).request('/');
    const html = await res.text();
    expect(res.status).toBe(200);
    expect(html).toContain('href="/digest/2026-10-28"');
    expect(html).toContain('href="/digest/2026-10-27"');
    expect(html).toContain('ok ');
    expect(html).toContain('retry ');
    expect(html).toContain('fail ');
  });
});
