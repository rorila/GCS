import { test, expect } from '@playwright/test';

/**
 * Play-Mode Lifecycle E2E Tests.
 * Prüft Start/Stop/Restart des Run-Modus.
 */
test.describe('Play-Mode Lifecycle', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#app-layout')).toBeVisible();
    });

    test('sollte den Run-Modus starten und stoppen können', async ({ page }) => {
        // 1. Wechsle in den Run-Tab
        const runTab = page.locator('.tab-btn[data-view="run"]');
        await expect(runTab).toBeVisible({ timeout: 5000 });
        await runTab.click();

        // 2. Prüfe: Run-Stage wird sichtbar
        const runStage = page.locator('#run-stage');
        await expect(runStage).toBeVisible({ timeout: 10000 });

        // 3. Wechsle zurück zur Stage-View
        const stageTab = page.locator('.tab-btn[data-view="stage"]');
        await stageTab.click();

        // 4. Prüfe: Stage-Wrapper ist wieder sichtbar
        await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });
    });

    test('sollte den Run-Modus erneut starten können (Restart)', async ({ page }) => {
        const runTab = page.locator('.tab-btn[data-view="run"]');
        const stageTab = page.locator('.tab-btn[data-view="stage"]');

        // Erster Run-Zyklus
        await runTab.click();
        await expect(page.locator('#run-stage')).toBeVisible({ timeout: 10000 });
        await stageTab.click();
        await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });

        // Zweiter Run-Zyklus (darf nicht crashen)
        await runTab.click();
        await expect(page.locator('#run-stage')).toBeVisible({ timeout: 10000 });
        await stageTab.click();
        await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });
    });
});
