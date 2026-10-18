import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const root = fileURLToPath(new URL('../', import.meta.url));
const fast = process.argv.includes('--fast');
const temporary = fs.mkdtempSync(path.join(os.tmpdir(), 'gcs-tests-'));
try {
    const database = path.join(temporary, 'db.json');
    fs.writeFileSync(database, JSON.stringify({ users: [
        { id: 'test-user', authCode: ['🍎', '🍌'] },
        { id: 'test-admin', authCode: ['🚀', '⭐'] },
        { id: 'test-bug', authCode: ['🐛', '💣'] }
    ] }));
    const result = spawnSync(process.execPath, [
        path.join(root, 'node_modules/tsx/dist/cli.mjs'),
        'scripts/test_runner.ts'
    ], {
        cwd: root, stdio: 'inherit',
        env: { ...process.env, ...(fast ? { SKIP_E2E: '1' } : {}), GCS_TEST_DB: database }
    });
    if (result.error) throw result.error;
    process.exitCode = result.status ?? 1;
} finally {
    // mkdtemp liefert einen eigenen absoluten Ordner; keine Benutzerdaten entfernen.
    const resolved = path.resolve(temporary);
    const tempRoot = path.resolve(os.tmpdir()) + path.sep;
    if (!resolved.startsWith(tempRoot) || !path.basename(resolved).startsWith('gcs-tests-')) {
        throw new Error('Unerwarteter Testordner');
    }
    fs.rmSync(resolved, { recursive: true });
}
