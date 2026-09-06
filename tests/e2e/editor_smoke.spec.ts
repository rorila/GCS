import { test, expect, Page } from '@playwright/test';

test.describe('Editor Smoke Tests', () => {

    test.beforeEach(async ({ page }) => {
        // Navigiere zum Editor
        await page.goto('/');
        // Warte bis die App geladen ist (Suche nach dem App-Layout ID)
        await expect(page.locator('#app-layout')).toBeVisible();
    });

    async function expandToolboxCategory(page: Page, categoryName: string) {
        const header = page.locator('.toolbox-category-header', { hasText: categoryName });
        const icon = header.locator('span').first();
        if (await icon.textContent() === '▶') {
            await header.click();
            await page.waitForTimeout(500);
        }
    }

    test('sollte den Editor korrekt laden', async ({ page }) => {
        await expect(page).toHaveTitle(/Game Builder v1/);
        await expect(page.locator('#stage-container')).toBeVisible();
        await expect(page.locator('#toolbox')).toBeVisible();
        await expect(page.locator('#inspector')).toBeVisible();
    });

    test('sollte zwischen Views umschalten können', async ({ page }) => {
        // JSON View
        await page.click('button[data-view="json"]');
        await expect(page.locator('#json-viewer')).toBeVisible();

        // Flow View
        await page.click('button[data-view="flow"]');
        await expect(page.locator('#flow-viewer')).toBeVisible();

        // Pascal Code View
        await page.click('button[data-view="code"]');
        await expect(page.locator('#code-viewer')).toBeVisible();

        // Zurück zur Stage
        await page.click('button[data-view="stage"]');
        await expect(page.locator('#stage-wrapper')).toBeVisible();
    });

    test('sollte die Komponenten-Palette in der Toolbox anzeigen', async ({ page }) => {
        await expandToolboxCategory(page, 'Standard');

        // Die Toolbox-Items haben Text wie "Button", "Panel" etc.
        const toolbox = page.locator('#json-toolbox-content');
        await expect(toolbox.getByText('Button', { exact: true })).toBeVisible();
        await expect(toolbox.getByText('Panel', { exact: true })).toBeVisible();
    });

});
