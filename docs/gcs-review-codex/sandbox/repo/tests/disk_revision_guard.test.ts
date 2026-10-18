/**
 * Tests: Schutz gegen Überschreiben extern (z.B. KI) geänderter Projektdateien.
 *
 * - decideDiskRevision: Entscheidungsregeln (Gut-/Schlechtfälle)
 * - readBaseRevision / isServerManagedPath / stampDiskProject
 * - Endpunkt /api/dev/project-file liest aus game-server/public (Revision + Inhalt atomar)
 * - End-to-End-Kette: alter Browserstand + extern geänderte Datei → Konflikt, Server lehnt Save ab
 */
import fs from 'node:fs';
import path from 'node:path';
import type { AddressInfo } from 'node:net';
import express from 'express';
import { registerProjectRoutes } from '../game-server/src/routes/projectRoutes';
import { PUBLIC_DIR } from '../game-server/src/serverState';
import { decideDiskRevision, readBaseRevision, isServerManagedPath, stampDiskProject } from '../src/editor/services/DiskRevisionGuard';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runDiskRevisionGuardTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const check = (name: string, passed: boolean, expectedSuccess = true, details?: string) => {
        results.push({ name, type: 'DiskRevisionGuard', expectedSuccess, actualSuccess: expectedSuccess ? passed : !passed, passed, details });
    };

    // --- Unit: Entscheidungsregeln ---
    const base = { sessionRevision: null, sessionVerified: false };
    check('Guard: Daten frisch von Platte (kein Feld) → accept',
        decideDiskRevision({ ...base, baseKnown: false, base: null, current: 'R2' }) === 'accept');
    check('Guard: Basis == Platte → accept',
        decideDiskRevision({ ...base, baseKnown: true, base: 'R1', current: 'R1' }) === 'accept');
    check('Guard: neue Datei (null == null) → accept',
        decideDiskRevision({ ...base, baseKnown: true, base: null, current: null }) === 'accept');
    check('Guard (Schlechtfall): alter Browserstand R1, KI-Datei R2 → conflict',
        decideDiskRevision({ ...base, baseKnown: true, base: 'R1', current: 'R2' }) === 'conflict', false);
    check('Guard (Schlechtfall): unverifizierter Browserstand (null), Datei existiert → conflict',
        decideDiskRevision({ ...base, baseKnown: true, base: null, current: 'R2' }) === 'conflict', false);
    check('Guard: Undo-Snapshot nach eigenem AutoSave (Session-Revision) → accept',
        decideDiskRevision({ baseKnown: true, base: 'R1', current: 'R3', sessionRevision: 'R3', sessionVerified: true }) === 'accept');
    check('Guard (Schlechtfall): Session-Revision unverifiziert → conflict',
        decideDiskRevision({ baseKnown: true, base: 'R1', current: 'R3', sessionRevision: 'R3', sessionVerified: false }) === 'conflict', false);

    // --- Unit: Helfer ---
    const r1 = readBaseRevision({ meta: { name: 'x' } });
    const r2 = readBaseRevision({ meta: { _diskRevision: null } });
    const r3 = readBaseRevision({ meta: { _diskRevision: 'abc' } });
    check('readBaseRevision unterscheidet „fehlt" von „null"',
        !r1.baseKnown && r2.baseKnown && r2.base === null && r3.baseKnown && r3.base === 'abc');
    check('isServerManagedPath: relativ ja, Windows-absolut nein',
        isServerManagedPath('projects/A.json') && !isServerManagedPath('C:\\Spiele\\A.json') && !isServerManagedPath(null));
    const stamped = stampDiskProject({ exists: true, revision: 'R9', mtimeMs: 1, project: { meta: {} } }, 'projects/A.json');
    check('stampDiskProject setzt _sourcePath und _diskRevision',
        stamped?.meta?._diskRevision === 'R9' && stamped?.meta?._sourcePath === 'projects/A.json');

    // --- Integration: Server-Endpunkte ---
    const relative = 'projects/__disk_revision_guard_test__.json';
    const file = path.join(PUBLIC_DIR, relative);
    const app = express();
    app.use(express.json({ limit: '10mb' }));
    registerProjectRoutes(app);
    const server = app.listen(0, '127.0.0.1');
    await new Promise<void>(resolve => server.once('listening', () => resolve()));
    const url = `http://127.0.0.1:${(server.address() as AddressInfo).port}`;
    const post = async (route: string, body: any) => {
        const response = await fetch(url + route, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) });
        return { status: response.status, data: await response.json() };
    };

    try {
        fs.writeFileSync(file, '\uFEFF' + JSON.stringify({ meta: { name: 'guard' }, marker: 'manuell' }, null, 2));
        const first = await post('/api/dev/project-file', { filePath: relative });
        const version = await post('/api/dev/project-version', { filePath: relative });
        check('project-file liefert Inhalt aus game-server/public (inkl. BOM-Toleranz)',
            first.status === 200 && first.data.exists === true && first.data.project?.marker === 'manuell');
        check('project-file und project-version liefern identische Revision',
            !!first.data.revision && first.data.revision === version.data.revision);

        // Browserstand basiert auf R1; KI ändert die Datei → R2
        const browserProject = { meta: { name: 'guard', _diskRevision: first.data.revision }, marker: 'alter-browser' };
        fs.writeFileSync(file, JSON.stringify({ meta: { name: 'guard' }, marker: 'ki-optimiert' }, null, 2));
        const current = await post('/api/dev/project-file', { filePath: relative });
        const { baseKnown, base: baseRev } = readBaseRevision(browserProject);
        const decision = decideDiskRevision({ baseKnown, base: baseRev, current: current.data.revision, sessionRevision: null, sessionVerified: false });
        check('Kette (Schlechtfall): Browserstand R1 vs. KI-Datei R2 → Konflikt erkannt', decision === 'conflict', false);

        // Im Konfliktfall sendet der Editor die Basis-Revision → Server muss ablehnen
        const save = await post('/api/dev/save-project', { filePath: relative, expectedRevision: baseRev, projectData: browserProject });
        const onDisk = JSON.parse(fs.readFileSync(file, 'utf8'));
        check('Kette: AutoSave mit Basis-Revision wird abgelehnt (409), KI-Stand bleibt erhalten',
            save.status === 409 && onDisk.marker === 'ki-optimiert');

        const missing = await post('/api/dev/project-file', { filePath: 'projects/__gibt_es_nicht__.json' });
        check('project-file: fehlende Datei → exists=false', missing.status === 200 && missing.data.exists === false && missing.data.project === null);

        const outside = await post('/api/dev/project-file', { filePath: '../package.json' });
        check('project-file (Schlechtfall): Pfad außerhalb projects/ → 403', outside.status === 403, false);

        fs.writeFileSync(file, '{ kaputt');
        const broken = await post('/api/dev/project-file', { filePath: relative });
        check('project-file (Schlechtfall): ungültiges JSON → 422', broken.status === 422, false);
    } catch (e: any) {
        check('DiskRevisionGuard Integration', false, true, e?.message || String(e));
    } finally {
        await new Promise<void>(resolve => server.close(() => resolve()));
        fs.rmSync(file, { force: true });
    }

    return results;
}
