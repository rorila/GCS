import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import express from 'express';
import { registerProjectRoutes } from '../game-server/src/routes/projectRoutes';
import { PUBLIC_DIR } from '../game-server/src/serverState';

const relative = 'projects/__revision_guard_test__.json';
const file = path.join(PUBLIC_DIR, relative);
const app = express();
app.use(express.json({ limit: '10mb' }));
registerProjectRoutes(app);
const server = app.listen(15341, '127.0.0.1');
const base = 'http://127.0.0.1:15341';
const post = async (route: string, body: any) => {
    const response = await fetch(base + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
    return { status: response.status, data: await response.json() };
};

try {
    fs.writeFileSync(file, JSON.stringify({ meta: { name: '__revision_guard_test__' }, marker: 'browser-baseline' }, null, 2));
    const first = await post('/api/dev/project-version', { filePath: relative });
    assert.equal(first.status, 200);
    assert.ok(first.data.revision);

    fs.writeFileSync(file, JSON.stringify({ meta: { name: '__revision_guard_test__' }, marker: 'extern-neuer' }, null, 2));
    const current = await post('/api/dev/project-version', { filePath: relative });
    assert.notEqual(current.data.revision, first.data.revision);

    const stale = await post('/api/dev/save-project', {
        filePath: relative,
        expectedRevision: first.data.revision,
        projectData: { meta: { name: '__revision_guard_test__' }, marker: 'alter-browser' }
    });
    assert.equal(stale.status, 409);
    assert.equal(stale.data.conflict, true);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).marker, 'extern-neuer');

    const accepted = await post('/api/dev/save-project', {
        filePath: relative,
        expectedRevision: current.data.revision,
        projectData: { meta: { name: '__revision_guard_test__' }, marker: 'bewusst-aktualisiert' }
    });
    assert.equal(accepted.status, 200);
    assert.ok(accepted.data.revision);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).marker, 'bewusst-aktualisiert');

    fs.writeFileSync(file, JSON.stringify({ meta: { name: '__revision_guard_test__' }, marker: 'nochmals-extern' }, null, 2));
    const staleManual = await post('/api/dev/save-custom', {
        filePath: relative,
        expectedRevision: accepted.data.revision,
        projectData: { meta: { name: '__revision_guard_test__' }, marker: 'alter-manueller-save' }
    });
    assert.equal(staleManual.status, 409);
    assert.equal(JSON.parse(fs.readFileSync(file, 'utf8')).marker, 'nochmals-extern');
    console.log('5/5: Revision lesen, externe Änderung erkennen, AutoSave und manuellen Save blockieren, aktuellen Save zulassen.');
} finally {
    await new Promise<void>(resolve => server.close(() => resolve()));
    fs.rmSync(file, { force: true });
}
