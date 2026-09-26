import { test, expect } from '@playwright/test';
import { readFileSync } from 'node:fs';

const diskProject = JSON.parse(readFileSync(new URL('../../game-server/public/projects/GCS-FeatureVideos.json', import.meta.url), 'utf8'));

test('Browserstart verwirft alten IndexedDB-Stand bei abweichender Plattenrevision', async ({ page }) => {
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).editor);

    const localProject = structuredClone(diskProject);
    localProject.meta.name = 'ALTER_BROWSERSTAND';
    localProject.meta._sourcePath = 'projects/__startup_guard__.json';
    localProject.meta._diskRevision = 'alte-revision';
    const savedAt = Date.now();
    await page.evaluate(async ({ localProject, savedAt }) => {
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

    const newerDisk = structuredClone(diskProject);
    newerDisk.meta.name = 'NEUER_PLATTENSTAND';
    newerDisk.meta._sourcePath = 'projects/__startup_guard__.json';
    delete newerDisk.meta._diskRevision;
    await page.route('**/api/dev/project-version', route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify({ exists: true, revision: 'neue-revision', mtimeMs: savedAt + 1000 })
    }));
    await page.route('**/projects/__startup_guard__.json?*', route => route.fulfill({
        status: 200, contentType: 'application/json', body: JSON.stringify(newerDisk)
    }));

    await page.reload();
    await page.waitForFunction(() => (window as any).editor?.project?.meta?.name === 'NEUER_PLATTENSTAND', null, { timeout: 10000 });
    const state = await page.evaluate(() => ({
        name: (window as any).editor.project.meta.name,
        source: (window as any).editor.project.meta._sourcePath
    }));
    expect(state).toEqual({ name: 'NEUER_PLATTENSTAND', source: 'projects/__startup_guard__.json' });
});
