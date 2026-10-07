import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const diskProject = JSON.parse(readFileSync(new URL('../../game-server/public/projects/GCS-FeatureVideos.json', import.meta.url), 'utf8'));

async function seedIndexedDb(page: any, localProject: any, savedAt: number) {
    await page.evaluate(async ({ localProject, savedAt }: any) => {
        await new Promise<void>((resolve, reject) => {
            const req = indexedDB.open('gcs_project_store', 1);
            req.onupgradeneeded = () => req.result.createObjectStore('projects');
            req.onerror = () => reject(req.error);
            req.onsuccess = () => {
                const tx = req.result.transaction('projects', 'readwrite');
                tx.objectStore('projects').put({ project: localProject, savedAt }, 'last_project');
                tx.oncomplete = () => resolve();
                tx.onerror = () => reject(tx.error);
            };
        });
    }, { localProject, savedAt });
}

test('Browserstart verwirft alten IndexedDB-Stand bei abweichender Plattenrevision', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).editor);

    const localProject = structuredClone(diskProject);
    localProject.meta.name = 'ALTER_BROWSERSTAND';
    localProject.meta._sourcePath = 'projects/__startup_guard__.json';
    localProject.meta._diskRevision = 'alte-revision';
    const savedAt = Date.now();
    await seedIndexedDb(page, localProject, savedAt);

    const newerDisk = structuredClone(diskProject);
    newerDisk.meta.name = 'NEUER_PLATTENSTAND';
    newerDisk.meta._sourcePath = 'projects/__startup_guard__.json';
    delete newerDisk.meta._diskRevision;
    // Startprüfung liest Inhalt + Revision atomar über /api/dev/project-file (NICHT über Vite /projects/…)
    await page.route('**/api/dev/project-file', route => route.fulfill({
        status: 200, contentType: 'application/json',
        body: JSON.stringify({ exists: true, revision: 'neue-revision', mtimeMs: savedAt + 1000, project: newerDisk })
    }));
    await page.route('**/api/dev/project-version', route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ exists: true, revision: 'neue-revision', mtimeMs: savedAt + 1000 })
    }));

    await page.reload();
    await page.waitForFunction(() => (window as any).editor?.project?.meta?.name === 'NEUER_PLATTENSTAND', null, { timeout: 10000 });
    const state = await page.evaluate(() => ({
        name: (window as any).editor.project.meta.name,
        source: (window as any).editor.project.meta._sourcePath
    }));
    expect(state).toEqual({ name: 'NEUER_PLATTENSTAND', source: 'projects/__startup_guard__.json' });
});

test('Schlechtfall: Plattenstand nicht lesbar → alter Browserstand wird geladen, Disk-AutoSave bleibt gesperrt', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).editor);

    const localProject = structuredClone(diskProject);
    localProject.meta.name = 'ALTER_BROWSERSTAND';
    localProject.meta._sourcePath = 'projects/__startup_guard__.json';
    localProject.meta._diskRevision = 'alte-revision';
    await seedIndexedDb(page, localProject, Date.now());

    let saveCalls = 0;
    await page.route('**/api/dev/project-file', route => route.fulfill({ status: 500, contentType: 'application/json', body: '{"error":"down"}' }));
    await page.route('**/api/dev/project-version', route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ exists: true, revision: 'ki-revision', mtimeMs: Date.now() })
    }));
    await page.route('**/api/dev/save-project', route => { saveCalls++; return route.fulfill({ status: 200, contentType: 'application/json', body: '{"success":true,"revision":"x"}' }); });

    await page.reload();
    await page.waitForFunction(() => (window as any).editor?.project?.meta?.name === 'ALTER_BROWSERSTAND', null, { timeout: 10000 });
    // Konflikt muss erkannt werden (alte-revision ≠ ki-revision) — AutoSave gesperrt
    await page.waitForFunction(() => {
        const dm = (window as any).editor?.dataManager;
        return dm && dm.diskRevisionReady === true && dm.diskSaveConflict === true;
    }, null, { timeout: 10000 });

    await page.waitForTimeout(2500);
    await page.evaluate(() => (window as any).editor.autoSaveToLocalStorage());
    await page.waitForTimeout(1500);
    expect(saveCalls).toBe(0);
});
