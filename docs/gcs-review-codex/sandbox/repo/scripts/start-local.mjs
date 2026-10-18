import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { startLocalServices, loadEnvironment } = require('./cms/cms-local-services.cjs');
const root = fileURLToPath(new URL('../', import.meta.url));
const environment = loadEnvironment(root);
const frontendPort = Number(environment.VITE_PORT || 5173);
const gamePort = Number(environment.PORT || 8080);
const cmsPort = Number(environment.CMS_PORT || 8081);
async function requireFreePort(port) {
    await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', () => reject(new Error('Port ' + port + ' ist belegt. Bitte die dort laufende Instanz zuerst beenden.')));
        probe.listen(port, '127.0.0.1', () => probe.close(resolve));
    });
}
await requireFreePort(frontendPort);
await requireFreePort(gamePort);
await requireFreePort(cmsPort);
const children = [];
let services, stopping;
const startup = new AbortController();
async function stop() {
    if (stopping) return stopping;
    stopping = (async () => {
        const closed = children.filter(child => child.exitCode === null && child.signalCode === null).map(child => new Promise(resolve => {
            const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
            child.once('exit', () => { clearTimeout(timer); resolve(); });
            child.kill();
        }));
        await Promise.all(closed);
        await services?.stop();
        if (process.connected) process.disconnect();
    })();
    return stopping;
}
const shutdown = () => { startup.abort(); void stop().catch(error => { console.error(error.message); process.exitCode = 1; }); };
process.once('SIGINT', shutdown); process.once('SIGTERM', shutdown);
process.on('message', message => { if (message?.type === 'shutdown') shutdown(); });
function run(script, args = [], cwd = root, extraEnv = {}) {
    const child = spawn(process.execPath, [path.join(root, script), ...args], {
        cwd, stdio: 'inherit', windowsHide: true, env: { ...environment, ...extraEnv }
    });
    children.push(child);
    return child;
}
async function build(script) {
    if (startup.signal.aborted) throw Error('Projektstart abgebrochen.');
    const child = run(script);
    await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(script + ' fehlgeschlagen')));
    });
}
try {
    await build('scripts/bundle-runtime.mjs');
    await build('scripts/generate-media-manifest.mjs');
    services = await startLocalServices({ root, env: environment, signal: startup.signal });
    if (startup.signal.aborted) { await services.stop(); throw Error('Projektstart abgebrochen.'); }
    const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
        cwd: path.join(root, 'game-server'), stdio: 'inherit', windowsHide: true,
        env: { ...environment, PORT: String(gamePort), TTS_CACHE_DIR: path.join(root, 'game-server/data/tts-editor-cache') }
    });
    children.push(server);
    const cms = run('scripts/cms/cms-server.cjs', [], root, { CMS_SERVICES_MANAGED: '1' });
    const frontend = run('node_modules/vite/bin/vite.js', ['--strictPort', '--host', '127.0.0.1', '--port', String(frontendPort)]);
    for (const child of [server, cms, frontend]) {
        child.once('error', error => { console.error(error.message); process.exitCode = 1; shutdown(); });
        child.once('exit', code => { if (!stopping) { process.exitCode = code ?? 0; shutdown(); } });
    }
    console.log('Game Builder v2: Editor ' + frontendPort + ' | Game-Server ' + gamePort + ' | CMS ' + cmsPort);
} catch (error) { console.error(error.message); process.exitCode = 1; await stop(); }
