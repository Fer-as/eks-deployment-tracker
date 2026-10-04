import assert from 'node:assert/strict';
import { once } from 'node:events';
import { test } from 'node:test';
import { createApp } from '../src/app.js';

async function withApi(t, query) {
  const server = createApp({ query }).listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(() => new Promise(resolve => server.close(resolve)));
  return (path, options) => fetch(`http://127.0.0.1:${server.address().port}${path}`, options);
}
const deployment = { application_name: 'payments-api', environment: 'staging', version: '1.0.0', status: 'pending' };
const post = body => ({ method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });

test('health returns HTTP 200 and JSON without querying the database', async t => {
  const request = await withApi(t, () => { throw new Error('Must not query DB'); });
  const response = await request('/health');
  assert.equal(response.status, 200);
  assert.match(response.headers.get('content-type'), /application\/json/);
  assert.deepEqual(await response.json(), { status: 'ok' });
});

test('lists rows returned by the database, newest first', async t => {
  const rows = [{ id: 1, ...deployment, created_at: '2026-01-01T00:00:00Z' }];
  const request = await withApi(t, async sql => {
    assert.match(sql, /ORDER BY created_at DESC, id DESC/);
    return { rows };
  });
  const response = await request('/deployments');
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), rows);
});

test('creates a record with trimmed, parameterized values and returns HTTP 201', async t => {
  const name = "app'); DROP TABLE deployments; --";
  const row = { id: 2, ...deployment, application_name: name };
  const request = await withApi(t, async (sql, values) => {
    assert.match(sql, /VALUES \(\$1, \$2, \$3, \$4\)/);
    assert.equal(sql.includes(name), false);
    assert.deepEqual(values, [name, 'staging', '1.0.0', 'pending']);
    return { rows: [row] };
  });
  const response = await request('/deployments', post({ ...deployment, application_name: ` ${name} ` }));
  assert.equal(response.status, 201);
  assert.deepEqual(await response.json(), row);
});

test('rejects missing, blank, oversized, non-string, and invalid status fields before querying', async t => {
  let calls = 0;
  const request = await withApi(t, () => { calls++; });
  const invalid = [null, {}, { ...deployment, version: ' ' }, { ...deployment, version: 123 }, { ...deployment, application_name: 'x'.repeat(101) }, { ...deployment, status: 'unknown' }];
  for (const body of invalid) {
    const response = await request('/deployments', post(body));
    assert.equal(response.status, 400);
    assert.equal(typeof (await response.json()).error, 'string');
  }
  assert.equal(calls, 0);
});

test('handles malformed JSON and oversized request bodies', async t => {
  const request = await withApi(t, () => { throw new Error('Must not query DB'); });
  const malformed = await request('/deployments', { ...post({}), body: '{broken' });
  assert.equal(malformed.status, 400);
  assert.deepEqual(await malformed.json(), { error: 'Invalid JSON.' });
  const large = await request('/deployments', post({ data: 'x'.repeat(17000) }));
  assert.equal(large.status, 413);
});

test('database failures return a generic JSON error', async t => {
  const request = await withApi(t, async () => { throw new Error('Private database details'); });
  for (const [path, options] of [['/deployments', undefined], ['/deployments', post(deployment)]]) {
    const response = await request(path, options);
    assert.equal(response.status, 500);
    assert.deepEqual(await response.json(), { error: 'Unable to complete request.' });
  }
});

test('unknown routes return JSON 404', async t => {
  const request = await withApi(t, () => {});
  const response = await request('/missing');
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), { error: 'Not found.' });
});
