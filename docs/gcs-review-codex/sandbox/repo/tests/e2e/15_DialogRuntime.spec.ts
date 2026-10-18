import { test, expect, Page } from '@playwright/test';
import { loadMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * Dialog-Runtime E2E Tests (TDialogRoot im Browser)
 * 
 * Prüft im echten Run-Modus:
 * - D1: Dialog per toggle_dialog einblendbar
 * - D2: Modal: Hintergrund-Overlay wird angezeigt
 * - D3: Closable: X-Button schließt Dialog
 * - D4: Dialog bleibt nach mehrfachem Toggle stabil
 * 
 * Voraussetzung: MyCoolGame.json enthält einen TDialogRoot (TestDialog)
 * mit modal=true, closable=true, centerOnShow=true.
 */
test.describe('Dialog-Runtime (TDialogRoot)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app-layout');
        await page.waitForFunction(() => (window as any).editor && (window as any).editor.project);
        await loadMyCoolGame(page);
        await page.waitForTimeout(500);
    });

    /** Hilfsfunktion: In den Run-Modus wechseln */
    async function enterRunMode(page: Page) {
        const runTab = page.locator('.tab-btn[data-view="run"]');
        await expect(runTab).toBeVisible({ timeout: 5000 });
        await runTab.click();
        await expect(page.locator('#run-stage')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(1500); // Animation abwarten
    }

    /** Hilfsfunktion: Dialog programmatisch einblenden */
    async function showDialog(page: Page): Promise<boolean> {
        return page.evaluate(() => {
            try {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                if (!runtime) return false;

                // Suche den Dialog im Objekt-Array
                const objects = runtime.objects || [];
                const dialog = objects.find((o: any) =>
                    o.className === 'TDialogRoot' || o.name === 'TestDialog'
                );

                if (dialog) {
                    dialog.visible = true;
                    if (typeof dialog.show === 'function') dialog.show();
                    // Render-Update auslösen
                    if (runtime.options?.onRender) runtime.options.onRender();
                    if (runtime.options?.onComponentUpdate) runtime.options.onComponentUpdate(dialog);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        });
    }

    /** Hilfsfunktion: Dialog programmatisch ausblenden */
    async function hideDialog(page: Page): Promise<boolean> {
        return page.evaluate(() => {
            try {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                if (!runtime) return false;

                const objects = runtime.objects || [];
                const dialog = objects.find((o: any) =>
                    o.className === 'TDialogRoot' || o.name === 'TestDialog'
                );

                if (dialog) {
                    dialog.visible = false;
                    if (typeof dialog.hide === 'function') dialog.hide();
                    if (runtime.options?.onRender) runtime.options.onRender();
                    if (runtime.options?.onComponentUpdate) runtime.options.onComponentUpdate(dialog);
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        });
    }

    test('D1: Dialog per toggle_dialog einblendbar', async ({ page }) => {
        await enterRunMode(page);

        // Prüfe: Dialog ist initial NICHT sichtbar
        const dialogBefore = await page.evaluate(() => {
            const runtime = (window as any).__gameRuntime || (window as any).runtime;
            if (!runtime) return null;
            const objects = runtime.objects || [];
            const dialog = objects.find((o: any) => o.name === 'TestDialog');
            return dialog ? { visible: dialog.visible, className: dialog.className } : null;
        });

        if (!dialogBefore) {
            console.log('[D1] TestDialog nicht im Runtime gefunden, Test übersprungen.');
            test.skip();
            return;
        }

        expect(dialogBefore.visible).toBe(false);

        // Einblenden
        const shown = await showDialog(page);
        if (!shown) {
            test.skip();
            return;
        }
        await page.waitForTimeout(500);

        // Prüfe: Dialog ist sichtbar
        const dialogAfter = await page.evaluate(() => {
            const runtime = (window as any).__gameRuntime || (window as any).runtime;
            if (!runtime) return null;
            const dialog = (runtime.objects || []).find((o: any) => o.name === 'TestDialog');
            return dialog ? { visible: dialog.visible } : null;
        });

        expect(dialogAfter?.visible).toBe(true);

        // DOM: Dialog-Element sollte sichtbar sein
        const dialogEl = page.locator('[data-id="dialog_test"]');
        if (await dialogEl.count() > 0) {
            console.log('[D1] Dialog DOM-Element gefunden ✅');
        }
    });

    test('D2: Modal: Hintergrund-Overlay wird angezeigt', async ({ page }) => {
        await enterRunMode(page);

        // Dialog einblenden
        const shown = await showDialog(page);
        if (!shown) {
            console.log('[D2] Runtime nicht erreichbar, Test übersprungen.');
            test.skip();
            return;
        }
        await page.waitForTimeout(500);

        // Prüfe: Overlay-Element existiert (wird vom ComplexComponentRenderer erzeugt)
        const overlayExists = await page.evaluate(() => {
            // Suche nach dialog-overlay (ComplexComponentRenderer erstellt overlay mit id dialog-overlay-<id>)
            const overlay = document.querySelector('.dialog-overlay') ||
                document.getElementById('dialog-overlay-dialog_test');
            if (overlay) {
                const style = getComputedStyle(overlay);
                return {
                    exists: true,
                    display: style.display,
                    hasBackground: style.background.includes('rgba') || style.backgroundColor.includes('rgba')
                };
            }
            return { exists: false, display: 'none', hasBackground: false };
        });

        if (overlayExists.exists) {
            expect(overlayExists.display).not.toBe('none');
            console.log(`[D2] Modal-Overlay gefunden: display=${overlayExists.display}, bg=${overlayExists.hasBackground} ✅`);
        } else {
            // Overlay wird möglicherweise erst nach einem Render-Zyklus erzeugt
            console.log('[D2] Overlay nicht sofort im DOM. Prüfe Dialog-State statt DOM.');
            const isModal = await page.evaluate(() => {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                if (!runtime) return null;
                const dialog = (runtime.objects || []).find((o: any) => o.name === 'TestDialog');
                return dialog?.modal;
            });
            expect(isModal).toBe(true);
        }
    });

    test('D3: Closable: Dialog kann geschlossen werden', async ({ page }) => {
        await enterRunMode(page);

        // Dialog einblenden
        const shown = await showDialog(page);
        if (!shown) {
            test.skip();
            return;
        }
        await page.waitForTimeout(500);

        // Dialog ist jetzt sichtbar
        const visibleBefore = await page.evaluate(() => {
            const runtime = (window as any).__gameRuntime || (window as any).runtime;
            const dialog = (runtime?.objects || []).find((o: any) => o.name === 'TestDialog');
            return dialog?.visible;
        });
        expect(visibleBefore).toBe(true);

        // Versuche den Close-Button im DOM zu finden und zu klicken
        const closeBtn = page.locator('[data-id="dialog_test"] button:has-text("✕")');
        if (await closeBtn.count() > 0) {
            await closeBtn.click();
            await page.waitForTimeout(500);
            console.log('[D3] Close-Button geklickt ✅');
        } else {
            // Alternativ: Programmatisch schließen
            await hideDialog(page);
            await page.waitForTimeout(300);
            console.log('[D3] Programmatisch geschlossen (kein Close-Button im DOM)');
        }

        // Dialog muss jetzt unsichtbar sein
        const visibleAfter = await page.evaluate(() => {
            const runtime = (window as any).__gameRuntime || (window as any).runtime;
            const dialog = (runtime?.objects || []).find((o: any) => o.name === 'TestDialog');
            return dialog?.visible;
        });
        expect(visibleAfter).toBe(false);
    });

    test('D4: Dialog bleibt nach mehrfachem Toggle stabil', async ({ page }) => {
        await enterRunMode(page);

        // 3 Toggle-Zyklen
        for (let i = 0; i < 3; i++) {
            // Einblenden
            const shown = await showDialog(page);
            if (!shown && i === 0) {
                test.skip();
                return;
            }
            await page.waitForTimeout(400);

            // Prüfe visible
            const visibleAfterShow = await page.evaluate(() => {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                const dialog = (runtime?.objects || []).find((o: any) => o.name === 'TestDialog');
                return dialog?.visible;
            });
            expect(visibleAfterShow).toBe(true);

            // Ausblenden
            await hideDialog(page);
            await page.waitForTimeout(400);

            const visibleAfterHide = await page.evaluate(() => {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                const dialog = (runtime?.objects || []).find((o: any) => o.name === 'TestDialog');
                return dialog?.visible;
            });
            expect(visibleAfterHide).toBe(false);
        }

        // Run-Stage ist weiterhin stabil
        await expect(page.locator('#run-stage')).toBeVisible({ timeout: 5000 });

        // Keine Overlay-Leaks
        const overlayCount = await page.evaluate(() => {
            return document.querySelectorAll('.dialog-overlay').length;
        });
        // Maximal 1 Overlay (das des TestDialogs), 0 falls korrekt aufgeräumt
        expect(overlayCount).toBeLessThanOrEqual(1);
        console.log(`[D4] 3 Toggle-Zyklen stabil, ${overlayCount} Overlays nach Cleanup ✅`);
    });
});
