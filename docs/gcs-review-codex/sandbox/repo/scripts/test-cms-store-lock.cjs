const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { test } = require('node:test');
const { createJsonStore } = require('./cms/cms-store.cjs');

function fixture(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-lock-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  const dataPath = path.join(dir, 'data.json');
  return { dataPath, lockPath: dataPath + '.lock' };
}

test('CMS reclaims a lock left by an exited process', t => {
  const { dataPath, lockPath } = fixture(t);
  const child = spawnSync(process.execPath, ['-e', 'process.stdout.write(String(process.pid))'], { encoding: 'utf8' });
  assert.equal(child.status, 0);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: Number(child.stdout), at: new Date().toISOString() }));
  createJsonStore({ dataPath });
  assert.equal(JSON.parse(fs.readFileSync(lockPath, 'utf8')).pid, process.pid);
  createJsonStore({ dataPath });
});

test('CMS refuses a second writer while the owning process is alive', t => {
  const { dataPath, lockPath } = fixture(t);
  const original = JSON.stringify({ pid: process.pid, at: new Date().toISOString() });
  fs.writeFileSync(lockPath, original);
  const child = spawnSync(process.execPath, ['-e', 'require(process.argv[1]).createJsonStore({dataPath:process.argv[2]})',
    path.resolve(__dirname, 'cms/cms-store.cjs'), dataPath], { encoding: 'utf8' });
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Zweite Writer-Instanz verweigert/);
  assert.equal(fs.readFileSync(lockPath, 'utf8'), original);
});

test('CMS preserves an unreadable lock rather than stealing it', t => {
  const { dataPath, lockPath } = fixture(t);
  fs.writeFileSync(lockPath, '');
  assert.throws(() => createJsonStore({ dataPath }), /nicht sicher geprüft/);
  assert.equal(fs.readFileSync(lockPath, 'utf8'), '');
});

function openInChild(dataPath) {
  return spawnSync(process.execPath, ['-e',
    'const fs=require("node:fs");require(process.argv[1]).createJsonStore({dataPath:process.argv[2]});process.stdout.write(fs.readFileSync(process.argv[2]+".lock","utf8"))',
    path.resolve(__dirname, 'cms/cms-store.cjs'), dataPath], { encoding: 'utf8' });
}

test('CMS records process identity and refuses a second writer with the same identity', t => {
  const { dataPath, lockPath } = fixture(t);
  createJsonStore({ dataPath });
  const original = fs.readFileSync(lockPath, 'utf8');
  assert.ok(JSON.parse(original).processStartedAt > 0, 'process start time must be available');
  const child = openInChild(dataPath);
  assert.notEqual(child.status, 0);
  assert.match(child.stderr, /Zweite Writer-Instanz verweigert/);
  assert.equal(fs.readFileSync(lockPath, 'utf8'), original);
});

test('CMS reclaims a reused live PID with a different process start time', t => {
  const { dataPath, lockPath } = fixture(t);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), processStartedAt: 1 }));
  const child = openInChild(dataPath);
  assert.equal(child.status, 0, child.stderr);
  const claimed = JSON.parse(child.stdout);
  assert.notEqual(claimed.pid, process.pid);
  assert.ok(claimed.processStartedAt > 1);
});

test('CMS reclaims a legacy lock whose live PID started after the lock was written', t => {
  const { dataPath, lockPath } = fixture(t);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: '2000-01-01T00:00:00.000Z' }));
  const child = openInChild(dataPath);
  assert.equal(child.status, 0, child.stderr);
  assert.notEqual(JSON.parse(child.stdout).pid, process.pid);
});

test('CMS also replaces a stale identity when the reused PID is its own', t => {
  const { dataPath, lockPath } = fixture(t);
  fs.writeFileSync(lockPath, JSON.stringify({ pid: process.pid, at: new Date().toISOString(), processStartedAt: 1 }));
  createJsonStore({ dataPath });
  assert.ok(JSON.parse(fs.readFileSync(lockPath, 'utf8')).processStartedAt > 1);
});
