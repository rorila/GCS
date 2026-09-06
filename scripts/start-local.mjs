import path from 'node:path';
import net from 'node:net';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
// Belegte Ports können zu einem anderen Projekt gehören. Niemals Prozesse beenden.
async function requireFreePort(port) {
    await new Promise((resolve, reject) => {
        const probe = net.createServer();
        probe.once('error', () => reject(new Error(
            'Port ' + port + ' ist belegt. Bitte die dort laufende Instanz selbst beenden.'
        )));
        probe.listen(port, () => probe.close(resolve));
    });
}
await requireFreePort(5173);
await requireFreePort(8080);
const children = [];
function run(script, args = [], cwd = root) {
    const child = spawn(process.execPath, [path.join(root, script), ...args], {
        cwd, stdio: 'inherit', env: { ...process.env, PORT: '8080' }
    });
    children.push(child);
    return child;
}
async function build(script) {
    const child = run(script);
    await new Promise((resolve, reject) => {
        child.once('error', reject);
        child.once('exit', code => code === 0 ? resolve() : reject(new Error(script + ' fehlgeschlagen')));
    });
}
function stop() {
    for (const child of children) if (child.exitCode === null) child.kill();
}
process.once('SIGINT', stop);
process.once('SIGTERM', stop);
process.once('exit', stop);
await build('scripts/bundle-runtime.mjs');
await build('scripts/generate-media-manifest.mjs');
const server = spawn(process.execPath, ['--import', 'tsx', 'src/server.ts'], {
    cwd: path.join(root, 'game-server'), stdio: 'inherit',
    env: { ...process.env, PORT: '8080' }
});
children.push(server);
const frontend = run('node_modules/vite/bin/vite.js', ['--strictPort']);
for (const child of [server, frontend]) {
    child.once('error', error => { console.error(error.message); process.exitCode = 1; stop(); });
    child.once('exit', code => { process.exitCode = code ?? 0; stop(); });
}
