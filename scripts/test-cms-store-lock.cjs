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
