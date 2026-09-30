import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

const source = readFileSync(new URL('../src/api/client.ts', import.meta.url), 'utf8')
  .replaceAll('import.meta.env', '{}');
const code = ts.transpileModule(source, {
  compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
}).outputText;
const initial = { accessToken: 'expired', refreshToken: 'old', user: { id: 'user' } };
const renewed = { ...initial, accessToken: 'new', refreshToken: 'rotated' };
const json = (body, status = 200) => new Response(JSON.stringify(body), { status });

function load(fetch) {
  const memory = new Map();
  const context = {
    exports: {}, module: { exports: {} }, Headers, Response, FormData,
    CustomEvent: class {}, window: { dispatchEvent() {} }, fetch,
    sessionStorage: {
      getItem: key => memory.get(key) ?? null,
      setItem: (key, value) => memory.set(key, value),
      removeItem: key => memory.delete(key),
    },
  };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  const api = context.module.exports;
  api.saveSession(initial);
  return api;
}

test('JSON and file requests share one token rotation', async () => {
  let calls = 0;
  const api = load(async (url, options) => {
    if (url === '/api/auth/refresh') {
      calls++;
      await new Promise(resolve => setTimeout(resolve, 5));
      return json(renewed);
    }
    return options.headers.get('Authorization') === 'Bearer new'
      ? json({ ok: true }) : json({ message: 'expired' }, 401);
  });
  await Promise.all([api.apiRequest('/a'), api.apiRequest('/b'), api.fetchApiFile('/file')]);
  assert.equal(calls, 1);
  assert.equal(api.readSession().refreshToken, 'rotated');
});

test('a delayed old 401 reuses the renewed session', async () => {
  let calls = 0;
  const api = load(async (url, options) => {
    if (url === '/api/auth/refresh') { calls++; return json(renewed); }
    if (options.headers.get('Authorization') === 'Bearer new') return json({ ok: true });
    if (url === '/slow') await new Promise(resolve => setTimeout(resolve, 20));
    return json({ message: 'expired' }, 401);
  });
  await Promise.all([api.apiRequest('/fast'), api.apiRequest('/slow')]);
  assert.equal(calls, 1);
});

test('transient refresh failure preserves the stored session', async () => {
  const api = load(async url => json({ message: 'unavailable' }, url === '/api/auth/refresh' ? 503 : 401));
  await assert.rejects(api.apiRequest('/a'), error => error.status === 503);
  assert.equal(api.readSession().refreshToken, 'old');
});

test('an invalid refresh token clears the session', async () => {
  const api = load(async () => json({ message: 'invalid' }, 401));
  await assert.rejects(api.apiRequest('/a'));
  assert.equal(api.readSession(), null);
});

test('logout during renewal cannot resurrect the old session', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  const api = load(async url => {
    if (url === '/api/auth/refresh') { started(); await gate; return json(renewed); }
    return json({ message: 'expired' }, 401);
  });
  const request = api.apiRequest('/a');
  await ready;
  api.saveSession(null);
  release();
  await assert.rejects(request);
  assert.equal(api.readSession(), null);
});

test('renewal cannot overwrite a new login or retry an old request as another user', async () => {
  let release;
  const gate = new Promise(resolve => { release = resolve; });
  let started;
  const ready = new Promise(resolve => { started = resolve; });
  let requests = 0;
  const api = load(async url => {
    if (url === '/api/auth/refresh') { started(); await gate; return json(renewed); }
    requests++;
    return json({ message: 'expired' }, 401);
  });
  const request = api.apiRequest('/a');
  await ready;
  api.saveSession({ accessToken: 'other-access', refreshToken: 'other-refresh', user: { id: 'other' } });
  release();
  await assert.rejects(request);
  assert.equal(api.readSession().refreshToken, 'other-refresh');
  assert.equal(requests, 1);
});
