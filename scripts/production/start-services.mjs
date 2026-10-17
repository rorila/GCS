// Produktions-Supervisor für den Fly-Container (PID 1).
//
// Startet und überwacht alle internen Dienste:
//   nginx (:8000, öffentlicher Eingang) → Game-Server (:8080) + CMS (:8081)
//   intern (nur Loopback): Piper (:5000, TTS) + whisper-server (:8177, STT)
//
// Reihenfolge: Sprachdienste → Node-Dienste → nginx (Eingang zuletzt).
// Verhalten: Readiness-Warte pro Dienst, SIGTERM-Weiterleitung, und wenn ein
// Dienst unerwartet aussteigt, wird der gesamte Container beendet (Fly startet
// die Machine neu — kein halb toter Zustand).
//
// Optionaler Backup-Scheduler: alle CMS_BACKUP_INTERVAL_MIN Minuten ein
// verschlüsseltes SQLite-Backup (cms-database.cjs backup), mit --upload wenn
// CMS_BACKUP_S3_* gesetzt ist.
import { spawn, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import net from 'node:net';
import path from 'node:path';
import { projectRoot, validateProductionEnvironment, singleFlight } from './runtime-config.mjs';

const root = projectRoot;
validateProductionEnvironment(process.env);
if (!fs.existsSync(process.env.CMS_SQLITE_PATH)) throw new Error('SQLite-Datenbank fehlt; zuerst explizit importieren.');
const log = (...args) => console.log('[supervisor]', ...args);
const children = [];
let stopping = false;

const spawnService = (name, command, args, opts = {}) => {
    const child = spawn(command, args, { stdio: ['ignore', 'inherit', 'inherit'], env: process.env, ...opts });
    child.on('error', error => { log(`${name}: ${error.message}`); void shutdown(1); });
    child.on('exit', (code, signal) => {
        log(`${name} beendet (code=${code}, signal=${signal})`);
        if (!stopping) { log(`${name} unerwartet beendet — fahre Container herunter.`); void shutdown(1); }
    });
    children.push({ name, child });
    return child;
};

const httpOk = async url => {
    try { const r = await fetch(url, { signal: AbortSignal.timeout(1500) }); await r.body?.cancel(); return r.ok; }
    catch { return false; }
};
const tcpOk = port => new Promise(resolve => {
    const s = net.connect(port, '127.0.0.1');
    s.once('connect', () => { s.end(); resolve(true); });
    s.once('error', () => resolve(false));
});
async function waitFor(name, check, timeoutMs = 120000) {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
        if (await check()) { log(`${name} bereit.`); return; }
        if (stopping) return;
        await new Promise(r => setTimeout(r, 500));
    }
    throw new Error(`${name} wurde nicht rechtzeitig bereit.`);
}

async function shutdown(code = 0) {
    if (stopping) return;
    stopping = true;
    log('Stoppe alle Dienste …');
    for (const { child } of children) { try { child.kill('SIGTERM'); } catch { /* bereits weg */ } }
    const deadline = Date.now() + 20000;
    while (Date.now() < deadline && children.some(c => c.child.exitCode === null && c.child.signalCode === null))
        await new Promise(r => setTimeout(r, 200));
    for (const { child } of children) { try { child.kill('SIGKILL'); } catch { /* bereits weg */ } }
    process.exit(code);
}
process.on('SIGTERM', () => void shutdown(0));
process.on('SIGINT', () => void shutdown(0));

// Interne Dienst-URLs — Loopback, niemals öffentlich.
process.env.CMS_TTS_URL ||= 'http://127.0.0.1:5000/';
process.env.TTS_PIPER_URL ||= 'http://127.0.0.1:5000';
process.env.CMS_SPEECH_URL ||= 'http://127.0.0.1:8177/inference';
process.env.CMS_SERVICES_MANAGED ||= '1';   // Sprachdienste laufen als eigene Prozesse
process.env.CMS_PORT ||= '8081';
process.env.PORT ||= '8080';
process.env.GCS_HOST ||= '127.0.0.1';
process.env.TTS_PIPER_SYNTHESIS_PATH ||= '/';

const piperPython = process.env.CMS_TTS_PYTHON || '/opt/venv/bin/python';
const voicesDir = process.env.CMS_TTS_VOICES_DIR || '/opt/models/voices';
const whisperBin = process.env.CMS_WHISPER_BIN || '/opt/whisper/whisper-server';
const whisperModel = process.env.CMS_WHISPER_MODEL || '/opt/models/ggml-small.bin';
const piperVoices = JSON.parse(process.env.TTS_VOICES || '{"default":"de_DE-thorsten-medium"}');
const piperModel = Object.values(piperVoices)[0] || 'de_DE-thorsten-medium';
// FFmpeg-Binary aus imageio-ffmpeg auflösen (Pip-Paket liefert das Binary mit);
// Fallback ist die System-Installation.
if (!process.env.TTS_FFMPEG) {
    try {
        const probe = spawnSync(piperPython, ['-c', 'import imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', timeout: 30000 });
        const ffmpeg = probe.status === 0 ? String(probe.stdout).trim() : '';
        if (ffmpeg) process.env.TTS_FFMPEG = ffmpeg;
    } catch { /* ohne Auflösung bleibt der Default 'ffmpeg' im Suchpfad */ }
}

try {
// 1) Interne Sprachdienste
spawnService('piper', piperPython, ['-m', 'piper.http_server', '-m', piperModel, '--host', '127.0.0.1', '--port', '5000', '--data-dir', voicesDir], { cwd: voicesDir });
spawnService('whisper', whisperBin, ['--host', '127.0.0.1', '--port', '8177', '-m', whisperModel, '-l', 'de', '-t', process.env.CMS_WHISPER_THREADS || '4', '--no-timestamps']);

// 2) Node-Dienste
spawnService('game-server', process.execPath, [path.join(root, 'game-server/dist/server.js')], { cwd: path.join(root, 'game-server') });
spawnService('cms', process.execPath, [path.join(root, 'scripts/cms/cms-server.cjs')], { cwd: root });

// 3) Readiness, dann öffentlicher Eingang
await waitFor('piper', () => httpOk('http://127.0.0.1:5000/voices'));
await waitFor('whisper', () => httpOk('http://127.0.0.1:8177/health'));
await waitFor('game-server', () => tcpOk(8080));
await waitFor('cms', () => httpOk('http://127.0.0.1:8081/api/cms/health'));
if (stopping) process.exit(1);
spawnService('nginx', 'nginx', ['-c', '/app/deploy/fly/nginx.conf', '-g', 'daemon off;']);
log('Alle Dienste bereit — öffentlicher Eingang auf :8000 aktiv.');

// 4) Backup-Scheduler (nur bei SQLite + gesetztem Schlüssel)
const backupIntervalMin = Number(process.env.CMS_BACKUP_INTERVAL_MIN || 10);
const sqlitePath = process.env.CMS_SQLITE_PATH;
if (process.env.CMS_STORAGE === 'sqlite' && sqlitePath && process.env.CMS_BACKUP_ENCRYPTION_KEY) {
    const staging = process.env.CMS_BACKUP_STAGING_DIR || '/tmp/cms-backups';
    fs.mkdirSync(staging, { recursive: true });
    const backup = singleFlight(() => new Promise((resolve, reject) => {
        const stamp = new Date().toISOString().replace(/[:.]/g, '-');
        const out = path.join(staging, 'backup-' + stamp);
        const args = [path.join(root, 'scripts/cms/cms-database.cjs'), 'backup',
            '--database', sqlitePath, '--output', out,
            '--uploads', process.env.CMS_UPLOAD_DIR || path.join(path.dirname(sqlitePath), 'uploads'),
            '--projects', path.join(root, 'game-server/public/projects')];
        if (process.env.CMS_BACKUP_S3_BUCKET) args.push('--upload');
        const child = spawn(process.execPath, args, { stdio: 'inherit' });
        const tracked = { name: 'backup', child };
        children.push(tracked);
        const timeout = setTimeout(() => { log('Backup-Zeitlimit überschritten.'); child.kill('SIGTERM'); }, 8 * 60000);
        timeout.unref();
        const cleanup = () => { clearTimeout(timeout); const index = children.indexOf(tracked); if (index >= 0) children.splice(index, 1); };
        child.once('error', error => { cleanup(); reject(error); });
        child.once('exit', code => {
            cleanup();
            try {
            if (code === 0) {
                log('Backup erstellt:', out, process.env.CMS_BACKUP_S3_BUCKET ? '(mit S3-Upload)' : '(nur lokal)');
                // Lokale Staging-Kopie nach erfolgreichem Upload entfernen —
                // die referenzierten Medien liegen weiterhin auf dem Volume.
                if (process.env.CMS_BACKUP_S3_BUCKET) fs.rmSync(out, { recursive: true, force: true });
            } else log('Backup fehlgeschlagen (code', code + ') — Datenbestand unverändert.');
            const copies = fs.readdirSync(staging, { withFileTypes: true })
                .filter(entry => entry.isDirectory() && /^backup-\d{4}-\d{2}-\d{2}T[\dTZ-]+$/.test(entry.name))
                .map(entry => entry.name).sort().reverse();
            for (const name of copies.slice(3)) fs.rmSync(path.join(staging, name), { recursive: true, force: true });
            resolve({ ok: code === 0 });
            } catch (error) { reject(error); }
        });
    }));
    await backup();
    const timer = setInterval(() => { backup().catch(e => log('Backup-Fehler:', e.message)); }, backupIntervalMin * 60000);
    timer.unref();
    log(`Backup-Scheduler aktiv: alle ${backupIntervalMin} min${process.env.CMS_BACKUP_S3_BUCKET ? ' + S3-Upload' : ' (nur lokal — CMS_BACKUP_S3_* fehlt)'}.`);
}
} catch (error) {
    log('Produktionsstart fehlgeschlagen:', error.message);
    await shutdown(1);
}
