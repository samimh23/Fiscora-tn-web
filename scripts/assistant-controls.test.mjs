import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import test from 'node:test';
import assert from 'node:assert/strict';
import ts from 'typescript';

function load(file) {
  const source = readFileSync(new URL(`../src/features/assistant/${file}.ts`, import.meta.url), 'utf8');
  const code = ts.transpileModule(source, {
    compilerOptions: { module: ts.ModuleKind.CommonJS, target: ts.ScriptTarget.ES2022 },
  }).outputText;
  const context = { module: { exports: {} }, AbortController };
  context.exports = context.module.exports;
  vm.runInNewContext(code, context);
  return context.module.exports;
}
const { AssistantRequestFence } = load('request-fence');
const { safeAssistantPath, assistantMode, isDocumentCitation } = load('source-target');

test('reset/stop invalidates and aborts a request even if its response arrives later', () => {
  const fence = new AssistantRequestFence();
  const old = fence.begin('org:dossier:conversation-one');
  fence.invalidate();
  assert.equal(old.signal.aborted, true);
  assert.equal(fence.isCurrent(old, old.scope), false);
  const next = fence.begin('org:dossier:conversation-two');
  assert.equal(fence.isCurrent(next, next.scope), true);
  assert.equal(fence.isCurrent(old, next.scope), false);
});

test('changing user or dossier rejects an otherwise current response', () => {
  const fence = new AssistantRequestFence();
  const token = fence.begin('user-one:dossier-one');
  assert.equal(fence.isCurrent(token, 'user-two:dossier-one'), false);
  assert.equal(fence.isCurrent(token, 'user-one:dossier-two'), false);
});

test('a newer request wins without aborting itself when an old response settles', () => {
  const fence = new AssistantRequestFence();
  const old = fence.begin('scope');
  const fresh = fence.begin('scope');
  assert.equal(old.signal.aborted, true);
  assert.equal(fresh.signal.aborted, false);
  assert.equal(fence.isCurrent(old, 'scope'), false);
  assert.equal(fence.isCurrent(fresh, 'scope'), true);
});

test('source navigation rejects external, protocol-relative, backslash and control paths', () => {
  for (const path of ['https://example.com', '//example.com', '/\\example.com', '/a\nother', 'javascript:alert(1)']) {
    assert.equal(safeAssistantPath(path), null);
  }
  assert.equal(safeAssistantPath('/factures?dossierId=one'), '/factures?dossierId=one');
});

test('only document UUID citations use the authenticated original viewer', () => {
  const id = '00000000-0000-4000-8000-000000000001';
  assert.equal(isDocumentCitation({ sourceId: id, chunkId: id }), true);
  assert.equal(isDocumentCitation({ sourceId: id, chunkId: 'any', kind: 'DOCUMENT' }), true);
  assert.equal(isDocumentCitation({ sourceId: id, chunkId: id, kind: 'BUSINESS_INVOICE' }), false);
  assert.equal(isDocumentCitation({ sourceId: '../secret', chunkId: id, kind: 'DOCUMENT' }), false);
});

test('answer badges distinguish live records, exact calculations, documents and help', () => {
  assert.match(assistantMode({ scope: 'LIVE_FINANCIAL' }), /actuelles.*lecture seule/);
  assert.match(assistantMode({ model: 'deterministic-accounting-v1' }), /déterministe/);
  assert.match(assistantMode({ citations: [{ kind: 'PRODUCT_HELP' }] }), /Guide/);
  assert.match(assistantMode({ scope: 'DOCUMENT' }), /documentaires/);
  assert.match(assistantMode({ scope: 'CLARIFICATION' }), /Précision/);
});
