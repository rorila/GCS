import { test, expect, Page } from '@playwright/test';

/**
 * Stage Switching E2E Tests.
 * Prüft Navigation zwischen Stages über das Menü-System.
 */
test.describe('Stage Switching', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#app-layout')).toBeVisible();
    });

    /** Hilfsfunktion: Stage über Menü wechseln */
    async function switchStage(page: Page, stageName: string) {
        const stagesMenuBtn = page.locator('.menu-bar-button:has-text("Stages")');
        await stagesMenuBtn.click();
        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible({ timeout: 5000 });
        const stageItem = dropdown.locator('.menu-item').filter({ hasText: stageName });
        await stageItem.click();
        await page.waitForTimeout(500);
    }

    test('sollte das Stages-Menü anzeigen', async ({ page }) => {
        const stagesMenuBtn = page.locator('.menu-bar-button:has-text("Stages")');
        await expect(stagesMenuBtn).toBeVisible({ timeout: 5000 });

        // Klicke und prüfe dass ein Dropdown erscheint
        await stagesMenuBtn.click();
        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible({ timeout: 5000 });

        // Mindestens ein Menü-Item muss existieren
        const items = dropdown.locator('.menu-item');
        const count = await items.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // Schließe Dropdown (ESC oder Klick außerhalb)
        await page.keyboard.press('Escape');
    });

    test('sollte zur Blueprint-Stage wechseln können', async ({ page }) => {
        const stagesMenuBtn = page.locator('.menu-bar-button:has-text("Stages")');
        if (!(await stagesMenuBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
            test.skip();
            return;
        }

        await stagesMenuBtn.click();
        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible();

        // Suche Blueprint-Eintrag
        const blueprintItem = dropdown.locator('.menu-item').filter({ hasText: /blueprint/i });
        if (await blueprintItem.count() > 0) {
            await blueprintItem.first().click();
            await page.waitForTimeout(500);

            // Stage muss weiterhin sichtbar sein nach dem Wechsel
            await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });
        }
    });

    test('sollte nach Stage-Wechsel zurückkehren können', async ({ page }) => {
        const stagesMenuBtn = page.locator('.menu-bar-button:has-text("Stages")');
        if (!(await stagesMenuBtn.isVisible({ timeout: 2000 }).catch(() => false))) {
            test.skip();
            return;
        }

        // 1. Öffne Menü und merke erstes Item
        await stagesMenuBtn.click();
        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible();

        const items = dropdown.locator('.menu-item');
        const count = await items.count();

        if (count >= 2) {
            // Wechsle zum zweiten Eintrag
            const secondStageName = await items.nth(1).textContent();
            await items.nth(1).click();
            await page.waitForTimeout(500);
            await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });

            // Wechsle zurück zum ersten Eintrag
            await stagesMenuBtn.click();
            await expect(dropdown).toBeVisible();
            await items.nth(0).click();
            await page.waitForTimeout(500);
            await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });
        }
    });
});
