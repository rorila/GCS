import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import express from 'express';
import { createTrainingRouter } from '../game-server/src/TrainingRouter';

const root = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-training-test-'));
const previous = process.env.GCS_TRAINING_ENABLED;
const app = express();
app.use(express.json());
app.use('/api/training', createTrainingRouter(root));
const server = app.listen(0, '127.0.0.1');
await new Promise<void>(resolve => server.once('listening', resolve));
const address = server.address() as { port: number };
const endpoint = `http://127.0.0.1:${address.port}/api/training`;
let token = '';
const request = (url: string, body?: unknown, headers = {}) => fetch(endpoint + url, {
    method: body === undefined ? 'GET' : 'POST', headers: {
        'Content-Type': 'application/json', 'X-GCS-Training-Token': token, ...headers
    }, body: body === undefined ? undefined : JSON.stringify(body)
});
try {
    delete process.env.GCS_TRAINING_ENABLED;
    assert.equal((await request('/preflight')).status, 503);
    process.env.GCS_TRAINING_ENABLED = '1';
    assert.equal((await request('/preflight', undefined, { Origin: 'https://example.com' })).status, 403);
    assert.equal((await request('/start', {})).status, 403);
    const missing = await (await request('/preflight')).json();
    assert.equal(missing.ready, false);
    token = missing.token;
    const privateDir = path.join(root, 'game-server/private-training');
    fs.mkdirSync(privateDir, { recursive: true });
    fs.mkdirSync(path.join(root, 'scripts/training'), { recursive: true });
    // Nur ein synthetischer Worker; keine Modellgewichte, GPU oder Downloads.
    fs.writeFileSync(path.join(root, 'scripts/training/worker.py'), `import time,json,argparse\nfrom pathlib import Path\np=argparse.ArgumentParser();p.add_argument('--config');c=json.loads(Path(p.parse_args().config).read_text())\nfor i in range(100):\n if Path(c['cancelFile']).exists():\n  print(json.dumps({'event':'cancelled'}),flush=True);break\n time.sleep(.05)\nelse: print(json.dumps({'event':'completed'}),flush=True)\n`);
    fs.writeFileSync(path.join(privateDir, 'settings.json'), JSON.stringify({
        python: process.env.GCS_TEST_PYTHON || 'C:/Users/rolfr/gcs-ai/Scripts/python.exe',
        base: root, adapter: root, system: 'Test'
    }));
    assert.equal((await (await request('/preflight')).json()).ready, true);
    const payload = { dataset: '{"messages":[{"role":"user","content":"A"},{"role":"assistant","content":"B"}]}',
        evaluation: ['C'], steps: 1, approved: true };
    assert.equal((await request('/start', { ...payload, approved: false })).status, 400);
    assert.equal((await request('/start', { ...payload, steps: 201 })).status, 400);
    assert.equal((await request('/start', { ...payload, dataset: '{' })).status, 400);
    assert.equal((await request('/start', payload)).status, 202);
    assert.equal((await request('/start', payload)).status, 409);
    assert.equal((await request('/cancel', {})).status, 200);
    let job: any;
    for (let attempt = 0; attempt < 100; attempt++) {
        job = (await (await request('/status')).json()).job;
        if (job.state === 'cancelled') break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(job.state, 'cancelled');
    assert.equal((await (await request(`/${job.id}/results`)).json()).automaticApproval, false);
    // Falscher Interpreter startet, beendet sich aber erfolglos: Fehler muss sichtbar bleiben.
    fs.writeFileSync(path.join(privateDir, 'settings.json'), JSON.stringify({
        python: process.execPath, base: root, adapter: root, system: 'Test'
    }));
    assert.equal((await request('/start', payload)).status, 202);
    for (let attempt = 0; attempt < 100; attempt++) {
        job = (await (await request('/status')).json()).job;
        if (job.state === 'failed') break;
        await new Promise(resolve => setTimeout(resolve, 50));
    }
    assert.equal(job.state, 'failed');
    assert.ok(job.error);
    const restoredApp = express();
    restoredApp.use('/api/training', createTrainingRouter(root));
    const restoredServer = restoredApp.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => restoredServer.once('listening', resolve));
    try {
        const restored = await fetch(`http://127.0.0.1:${(restoredServer.address() as { port: number }).port}/api/training/status`);
        assert.equal((await restored.json()).job.state, 'failed');
    } finally { restoredServer.close(); }
    console.log('Training-API: Zugriffsschutz, Freigabe, Limits, Parallelstart, Abbruch, Ergebnisse und Neustart bestanden.');
} finally {
    if (previous === undefined) delete process.env.GCS_TRAINING_ENABLED;
    else process.env.GCS_TRAINING_ENABLED = previous;
    await new Promise<void>(resolve => server.close(() => resolve()));
    if (path.dirname(root) === path.resolve(os.tmpdir()) && path.basename(root).startsWith('gcs-training-test-')) {
        fs.rmSync(root, { recursive: true, force: true });
    }
}
