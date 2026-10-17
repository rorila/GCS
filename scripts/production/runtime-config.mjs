import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');

export function validateProductionEnvironment(env) {
    if (!env.JWT_SECRET) throw new Error('JWT_SECRET fehlt.');
    if (env.CMS_STORAGE !== 'sqlite' || !env.CMS_SQLITE_PATH) throw new Error('Produktion benötigt einen expliziten SQLite-Pfad.');
    const origin = new URL(env.PUBLIC_ORIGIN || '');
    if (origin.protocol !== 'https:' || origin.username || origin.password || /[<>]/.test(env.PUBLIC_ORIGIN))
        throw new Error('PUBLIC_ORIGIN muss eine echte HTTPS-Adresse sein.');
    if (env.GCS_EDITOR_PUBLIC === '1') throw new Error('Öffentlicher Editor benötigt zuerst eine eigene API-Authentifizierung.');
    if (env.GCS_EDITOR_APIS !== 'off' || env.CMS_EDITOR_TEST !== 'off') throw new Error('Editor-/Test-APIs müssen in Produktion deaktiviert sein.');
    const interval = Number(env.CMS_BACKUP_INTERVAL_MIN || 10);
    if (!Number.isFinite(interval) || interval < 1) throw new Error('Ungültiges Backupintervall.');
    if (env.CMS_BACKUP_REQUIRE_EXTERNAL === '1') {
        const key = Buffer.from(env.CMS_BACKUP_ENCRYPTION_KEY || '', 'base64');
        if (key.length !== 32 || key.toString('base64') !== env.CMS_BACKUP_ENCRYPTION_KEY)
            throw new Error('Backupschlüssel mit 32 Bytes (Base64) erforderlich.');
        for (const name of ['ENDPOINT', 'BUCKET', 'REGION', 'ACCESS_KEY', 'SECRET_KEY'])
            if (!env['CMS_BACKUP_S3_' + name]) throw new Error('Externe Backupkonfiguration unvollständig: ' + name);
        const endpoint = new URL(env.CMS_BACKUP_S3_ENDPOINT);
        if (endpoint.protocol !== 'https:' || endpoint.username || endpoint.password || endpoint.search || endpoint.hash)
            throw new Error('Externer Backupendpunkt muss HTTPS verwenden.');
    }
    return { interval };
}

export function singleFlight(operation) {
    let running = false;
    return async (...args) => {
        if (running) return { skipped: true };
        running = true;
        try { return await operation(...args); }
        finally { running = false; }
    };
}
