import { test, expect } from '@playwright/test';

/**
 * Theme-Switching E2E Tests.
 * Prüft, dass Themes aus public/themes/index.json geladen,
 * im Menü angezeigt und aktiviert werden können.
 */
test.describe('Theme Switching', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await expect(page.locator('#app-layout')).toBeVisible({ timeout: 10000 });
        // Menü und Theme-JSON-Laden abwarten
        await page.waitForTimeout(1000);
    });

    test('sollte das Themes-Menü mit allen JSON-Themes anzeigen', async ({ page }) => {
        const themesButton = page.locator('.menu-bar-button', { hasText: 'Themes' });
        await expect(themesButton).toBeVisible();
        await themesButton.click();

        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible();

        await expect(dropdown.locator('.menu-item').filter({ hasText: 'Candy Pop' })).toBeVisible();
        await expect(dropdown.locator('.menu-item').filter({ hasText: 'Neon Arcade' })).toBeVisible();
        await expect(dropdown.locator('.menu-item').filter({ hasText: 'Superhero' })).toBeVisible();
    });

    test('sollte ein Theme aktivieren und im Menü als aktiv markieren', async ({ page }) => {
        const themesButton = page.locator('.menu-bar-button', { hasText: 'Themes' });
        await themesButton.click();

        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible();

        // Candy Pop aktivieren
        const candyItem = dropdown.locator('.menu-item').filter({ hasText: 'Candy Pop' });
        await expect(candyItem).toBeVisible();
        await candyItem.click();

        // Dropdown schließt sich nach Auswahl; neu öffnen um Häkchen zu prüfen
        await themesButton.click();
        await expect(dropdown).toBeVisible();
        await expect(dropdown.locator('.menu-item').filter({ hasText: '✅ Candy Pop' })).toBeVisible();
    });

    test('sollte den Theme-Editor über das Stages-Menü öffnen', async ({ page }) => {
        const stagesButton = page.locator('.menu-bar-button', { hasText: 'Stages' });
        await expect(stagesButton).toBeVisible();
        await stagesButton.click();

        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible();

        const themeEditorItem = dropdown.locator('.menu-item').filter({ hasText: 'Theme-Editor öffnen' });
        await expect(themeEditorItem).toBeVisible();
        await themeEditorItem.click();

        // Theme-Editor-Stage sollte angelegt werden; Banner erscheint
        await expect(page.locator('text=Als Theme speichern')).toBeVisible({ timeout: 5000 });
    });
});
