import { Router } from 'express';
import fs from 'fs';
import path from 'path';
import { randomUUID, randomBytes, createHash } from 'crypto';
import { spawn, ChildProcess } from 'child_process';
import { createInterface } from 'readline';

interface Settings { python: string; base: string; adapter: string; system: string }
interface Job { id: string; state: string; pid?: number; created: string; event?: unknown; error?: string }
const activeStates = ['starting', 'running', 'cancelling'];
const origins = new Set(['http://localhost:5173', 'http://127.0.0.1:5173',
    'http://localhost:8080', 'http://127.0.0.1:8080']);
const loopback = (value = '') => ['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(value);

/** Getrennte, explizit aktivierte lokale Trainings-API. Keine Projekt-Persistenz. */
export function createTrainingRouter(root: string): Router {
    const router = Router();
    const token = randomBytes(32).toString('hex');
    const directory = path.join(root, 'game-server', 'private-training');
    const settingsFile = path.join(directory, 'settings.json');
    const worker = path.join(root, 'scripts', 'training', 'worker.py');
    let child: ChildProcess | undefined;
    let current: Job | undefined;
    let recovered = false;
    const save = () => {
        if (!current) return;
        const target = path.join(directory, current.id, 'job.json');
        fs.writeFileSync(target + '.tmp', JSON.stringify(current, null, 2));
        fs.renameSync(target + '.tmp', target);
    };
    const alive = (pid?: number) => {
        if (!pid) return false;
        try { process.kill(pid, 0); return true; } catch { return false; }
    };
    const recover = () => {
        if (recovered) return;
        recovered = true;
        if (!fs.existsSync(directory)) return;
        const jobs = fs.readdirSync(directory).filter(id => /^[a-f0-9-]{36}$/.test(id))
            .map(id => JSON.parse(fs.readFileSync(path.join(directory, id, 'job.json'), 'utf8')) as Job)
            .sort((a, b) => b.created.localeCompare(a.created));
        current = jobs.find(job => activeStates.includes(job.state)) || jobs[0];
        if (current && activeStates.includes(current.state) && !alive(current.pid)) {
            current.state = 'interrupted';
            save();
        }
    };
    router.use((req, res, next) => {
        if (process.env.GCS_TRAINING_ENABLED !== '1') {
            res.status(503).json({ error: 'Lokales Training ist nicht aktiviert (GCS_TRAINING_ENABLED=1).' }); return;
        }
        const host = req.headers.host || '';
        if (!loopback(req.socket.remoteAddress) || !/^(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.test(host)
            || (req.headers.origin && !origins.has(req.headers.origin))) {
            res.status(403).json({ error: 'Training ist nur lokal aus dem GCS erlaubt.' }); return;
        }
        if (req.method !== 'GET' && req.headers['x-gcs-training-token'] !== token) {
            res.status(403).json({ error: 'Training-Token fehlt oder ist ungültig.' }); return;
        }
        try { recover(); next(); } catch (error) { next(error); }
    });
    const settings = (): Settings => {
        const value = JSON.parse(fs.readFileSync(settingsFile, 'utf8')) as Settings;
        for (const key of ['python', 'base', 'adapter'] as const) {
            if (typeof value[key] !== 'string' || !path.isAbsolute(value[key]) || !fs.existsSync(value[key])) {
                throw new Error(`Ungültiger lokaler Pfad: ${key}`);
            }
        }
        if (typeof value.system !== 'string') throw new Error('System-Prompt fehlt');
        return value;
    };
    router.get('/preflight', (_req, res) => {
        try {
            settings();
            res.json({ ready: true, token, limits: { bytes: 2000000, examples: 500, steps: 200 },
                note: 'Dateipfade geprüft; GPU und Tokenlängen prüft der Worker vor dem Training.' });
        } catch (error) { res.json({ ready: false, token, error: String(error) }); }
    });
    router.get('/status', (_req, res) => {
        if (current && !child && activeStates.includes(current.state) && !alive(current.pid)) {
            current.state = 'interrupted'; save();
        }
        res.json({ job: current || null });
    });
    router.get('/:id/results', (req, res) => {
        if (!/^[a-f0-9-]{36}$/.test(req.params.id)) { res.sendStatus(400); return; }
        const run = path.join(directory, req.params.id);
        if (!fs.existsSync(path.join(run, 'job.json'))) { res.sendStatus(404); return; }
        const read = (name: string) => {
            const file = path.join(run, 'output', name + '.json');
            return fs.existsSync(file) ? JSON.parse(fs.readFileSync(file, 'utf8')) : null;
        };
        res.json({ job: JSON.parse(fs.readFileSync(path.join(run, 'job.json'), 'utf8')),
            before: read('before'), after: read('after'), automaticApproval: false });
    });
    router.post('/start', (req, res) => {
        if (current && activeStates.includes(current.state)) {
            res.status(409).json({ error: 'Ein Trainingsprozess ist noch aktiv.' }); return;
        }
        try {
            const { dataset, evaluation, steps, approved } = req.body;
            if (approved !== true) throw new Error('Datensatz muss ausdrücklich freigegeben sein');
            if (typeof dataset !== 'string' || Buffer.byteLength(dataset) > 2000000) throw new Error('Ungültiger Datensatz');
            const lines = dataset.split(/\r?\n/).filter((line: string) => line.trim());
            if (!lines.length || lines.length > 500) throw new Error('1 bis 500 Beispiele erforderlich');
            // Vollständige Rollen-, Duplikat- und Tokenprüfung erfolgt im Worker vor dem Modellladen.
            lines.forEach((line: string) => JSON.parse(line));
            if (!Number.isInteger(steps) || steps < 1 || steps > 200) throw new Error('1 bis 200 Schritte erforderlich');
            if (!Array.isArray(evaluation) || !evaluation.length || evaluation.length > 20
                || evaluation.some(q => typeof q !== 'string' || !q.trim() || q.length > 2000)) {
                throw new Error('1 bis 20 separate Prüffragen erforderlich');
            }
            const config = settings();
            const id = randomUUID();
            const run = path.join(directory, id);
            fs.mkdirSync(run, { recursive: true });
            fs.writeFileSync(path.join(run, 'dataset.jsonl'), dataset);
            fs.writeFileSync(path.join(run, 'approval.json'), JSON.stringify({ approved: true,
                at: new Date().toISOString(), sha256: createHash('sha256').update(dataset).digest('hex') }));
            fs.writeFileSync(path.join(run, 'config.json'), JSON.stringify({ ...config, steps, evaluation,
                dataset: path.join(run, 'dataset.jsonl'), output: path.join(run, 'output'),
                cancelFile: path.join(run, 'cancel'), maxTokens: 512 }));
            current = { id, state: 'starting', created: new Date().toISOString() };
            save();
            const job = current;
            const processHandle = spawn(config.python, ['-u', worker, '--config', path.join(run, 'config.json')],
                { shell: false, windowsHide: true, stdio: ['ignore', 'pipe', 'pipe'],
                    env: { ...process.env, PYTHONIOENCODING: 'utf-8', HF_HUB_OFFLINE: '1' } });
            child = processHandle;
            job.pid = processHandle.pid;
            job.state = 'running'; save();
            let terminalEvent: string | undefined;
            const linesReader = createInterface({ input: processHandle.stdout! });
            linesReader.on('line', line => {
                fs.appendFileSync(path.join(run, 'events.jsonl'), line + '\n');
                try {
                    const event = JSON.parse(line);
                    job.event = event;
                    if (['completed', 'cancelled', 'failed'].includes(event.event)) terminalEvent = event.event;
                    if (event.event === 'failed') job.error = event.error;
                    save();
                } catch { /* Bibliotheksausgaben bleiben im Protokoll. */ }
            });
            processHandle.stderr!.on('data', chunk => fs.appendFileSync(path.join(run, 'stderr.log'), chunk));
            processHandle.on('error', error => { job.error = error.message; save(); });
            processHandle.on('close', code => {
                job.state = code === 0 && terminalEvent ? terminalEvent : 'failed';
                if (job.state === 'failed' && !job.error) job.error = `Worker beendet: ${code}`;
                child = undefined; save();
            });
            res.status(202).json({ job });
        } catch (error) { res.status(400).json({ error: String(error) }); }
    });
    router.post('/cancel', (_req, res) => {
        if (!current || !activeStates.includes(current.state)) { res.sendStatus(409); return; }
        fs.writeFileSync(path.join(directory, current.id, 'cancel'), 'cancel');
        current.state = 'cancelling'; save();
        const handle = child;
        if (handle) {
            const timer = setTimeout(() => { if (child === handle) handle.kill(); }, 60000);
            timer.unref();
            handle.once('close', () => clearTimeout(timer));
        }
        res.json({ job: current, note: 'Abbruch an der nächsten Schrittgrenze; nach 60 Sekunden erzwungen, falls erreichbar.' });
    });
    return router;
}
