import assert from 'node:assert/strict';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import test from 'node:test';
import { endpoint, packageName, updateBadge } from '../scripts/update-npm-downloads-badge.mjs';

const fixture = { package: packageName, downloads: 5052, start: '2026-09-12', end: '2026-10-11' };
const success = data => async url => {
  assert.equal(url, endpoint);
  return Response.json(data);
};

async function temporaryDirectory(t) {
  const directory = await mkdtemp(path.join(os.tmpdir(), 'npm-badge-test-'));
  t.after(() => rm(directory, { recursive: true, force: true }));
  return directory;
}

async function files(directory) {
  return Promise.all(['svg', 'json'].map(ext => readFile(path.join(directory, `rhythmguard-downloads.${ext}`), 'utf8')));
}

test('a successful refresh records the actual window and displays the count', async t => {
  const directory = await temporaryDirectory(t);
  const result = await updateBadge({ directory, fetchImpl: success(fixture), now: new Date('2026-10-13T12:00:00Z') });
  assert.equal(result.status, 'updated');
  const [svg, json] = await files(directory);
  assert.match(svg, /5\.1k\/month/);
  assert.match(svg, /2026-09-12 to 2026-10-11/);
  assert.deepEqual(JSON.parse(json), { schemaVersion: 1, ...fixture, fetchedAt: '2026-10-13T12:00:00.000Z', source: endpoint });
});

test('upstream failures and invalid responses preserve both files byte-for-byte', async t => {
  const directory = await temporaryDirectory(t);
  await updateBadge({ directory, fetchImpl: success(fixture) });
  const original = await files(directory);
  const failures = [
    async () => new Response('Rate limited', { status: 429 }),
    async () => { throw new Error('Network unavailable'); },
    async () => new Response('<html>Unavailable</html>', { status: 200 }),
    success({ ...fixture, package: 'another-package' }),
    success({ ...fixture, downloads: -1 }),
    success({ ...fixture, start: '2026-02-30' }),
    success({ ...fixture, start: '2026-10-12' }),
  ];
  for (const fetchImpl of failures) {
    assert.equal((await updateBadge({ directory, fetchImpl })).status, 'stale');
    assert.deepEqual(await files(directory), original);
  }
});

test('the same reporting data is a no-op, while zero is a valid new count', async t => {
  const directory = await temporaryDirectory(t);
  await updateBadge({ directory, fetchImpl: success(fixture) });
  const original = await files(directory);
  assert.equal((await updateBadge({ directory, fetchImpl: success(fixture) })).status, 'unchanged');
  assert.deepEqual(await files(directory), original);
  assert.equal((await updateBadge({ directory, fetchImpl: success({ ...fixture, downloads: 0 }) })).status, 'updated');
  assert.match((await files(directory))[0], /0\/month/);
});

test('a failed first fetch does not fabricate a badge', async t => {
  const directory = await temporaryDirectory(t);
  await assert.rejects(updateBadge({ directory, fetchImpl: async () => new Response('', { status: 503 }) }), /HTTP 503/);
  await assert.rejects(readFile(path.join(directory, 'rhythmguard-downloads.svg')), { code: 'ENOENT' });
});
