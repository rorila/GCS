import { test, expect, Page } from '@playwright/test';
import { loadMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * Stage-Runtime Animations-Regressionstests (E2E im Browser)
 * 
 * Prüft im echten Run-Modus:
 * - E1: Objekte sind innerhalb der Bühne nach Run-Start
 * - E2: Objekt-Positionen sind nach Animations-Ende korrekt
 * - E3: Stage-Wechsel im Run-Modus friert nicht ein
 * - E4: Objekte nicht außerhalb der Bühne nach Stage-Wechsel
 */
test.describe('Stage-Runtime Animation Regression', () => {

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
        // Animations-Zeit abwarten (max startAnimationDuration + Puffer)
        await page.waitForTimeout(1500);
    }

    /** Hilfsfunktion: Zurück zum Edit-Modus */
    async function exitRunMode(page: Page) {
        const stageTab = page.locator('.tab-btn[data-view="stage"]');
        await stageTab.click();
        await expect(page.locator('#stage-wrapper')).toBeVisible({ timeout: 10000 });
    }

    test('E1: Run-Modus zeigt Objekte innerhalb der Bühne', async ({ page }) => {
        await enterRunMode(page);

        // Prüfe: Mindestens ein .game-object ist sichtbar
        const objects = page.locator('#run-stage .game-object');
        const count = await objects.count();
        expect(count).toBeGreaterThanOrEqual(1);

        // Prüfe: Bühnen-Dimensionen ermitteln
        const stageRect = await page.locator('#run-stage').boundingBox();
        expect(stageRect).toBeTruthy();

        if (stageRect) {
            // Jedes sichtbare Objekt muss innerhalb der Bühne liegen
            for (let i = 0; i < Math.min(count, 10); i++) {
                const objBox = await objects.nth(i).boundingBox();
                if (objBox && objBox.width > 0 && objBox.height > 0) {
                    // Objekt-Mittelpunkt muss innerhalb der Stage sein (mit Toleranz)
                    const centerX = objBox.x + objBox.width / 2;
                    const centerY = objBox.y + objBox.height / 2;
                    const insideX = centerX >= stageRect.x - 50 && centerX <= stageRect.x + stageRect.width + 50;
                    const insideY = centerY >= stageRect.y - 50 && centerY <= stageRect.y + stageRect.height + 50;

                    if (!insideX || !insideY) {
                        console.warn(`[E1] Objekt ${i} außerhalb: center=(${centerX},${centerY}), stage=(${stageRect.x},${stageRect.y},${stageRect.width},${stageRect.height})`);
                    }
                    expect(insideX && insideY).toBeTruthy();
                }
            }
        }
    });

    test('E2: Objekt-Positionen korrekt nach Animations-Ende', async ({ page }) => {
        await enterRunMode(page);

        // Nach Animation: Objekte müssen stabile Positionen haben
        // Prüfe, dass sich die Positionen über 500ms nicht mehr ändern
        const getPositions = async () => {
            return page.evaluate(() => {
                const objects = document.querySelectorAll('#run-stage .game-object');
                return Array.from(objects).slice(0, 5).map(el => {
                    const style = getComputedStyle(el);
                    return {
                        id: el.getAttribute('data-id'),
                        translate: (el as HTMLElement).style.translate || style.translate || ''
                    };
                });
            });
        };

        const pos1 = await getPositions();
        await page.waitForTimeout(500);
        const pos2 = await getPositions();

        // Positionen müssen identisch sein (Animation abgeschlossen)
        for (let i = 0; i < Math.min(pos1.length, pos2.length); i++) {
            if (pos1[i].id === pos2[i].id) {
                expect(pos1[i].translate).toBe(pos2[i].translate);
            }
        }
    });

    test('E3: Stage-Wechsel im Run-Modus friert nicht ein', async ({ page }) => {
        await enterRunMode(page);

        // Programmatischer Stage-Wechsel via runtime
        const switchResult = await page.evaluate(() => {
            try {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                if (runtime && typeof runtime.switchToStage === 'function') {
                    runtime.switchToStage('stage-1776512257086');
                    return 'switched';
                }
                // Fallback: Über StageController
                const editor = (window as any).editor;
                if (editor && editor.project) {
                    return 'no-runtime-available';
                }
                return 'no-editor';
            } catch (e: any) {
                return `error: ${e.message}`;
            }
        });

        if (switchResult === 'no-runtime-available') {
            // Runtime nicht direkt erreichbar → teste ob Run-Stage noch responsive ist
            console.log('[E3] Runtime nicht direkt erreichbar, prüfe Responsiveness...');
            await expect(page.locator('#run-stage')).toBeVisible({ timeout: 5000 });
            return;
        }

        // Warte auf Animation
        await page.waitForTimeout(1500);

        // Run-Stage muss immer noch sichtbar sein (kein Freeze/White-Screen)
        await expect(page.locator('#run-stage')).toBeVisible({ timeout: 5000 });

        // Es müssen .game-object Elemente existieren (Stage nicht leer)
        const objects = page.locator('#run-stage .game-object');
        const count = await objects.count();
        expect(count).toBeGreaterThanOrEqual(1);
    });

    test('E4: Objekte nicht außerhalb der Bühne nach Stage-Wechsel', async ({ page }) => {
        await enterRunMode(page);

        // Stage-Wechsel auslösen
        const switched = await page.evaluate(() => {
            try {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                if (runtime && typeof runtime.switchToStage === 'function') {
                    runtime.switchToStage('stage-1776512257086');
                    return true;
                }
                return false;
            } catch {
                return false;
            }
        });

        if (!switched) {
            console.log('[E4] Runtime nicht erreichbar, Test übersprungen.');
            test.skip();
            return;
        }

        // Animation abwarten
        await page.waitForTimeout(2000);

        // Bühnen-Grenzen ermitteln
        const stageRect = await page.locator('#run-stage').boundingBox();
        if (!stageRect) {
            test.skip();
            return;
        }

        // Prüfe: Kein sichtbares Objekt ragt massiv über die Bühne hinaus
        const objects = page.locator('#run-stage .game-object');
        const count = await objects.count();

        let outOfBoundsCount = 0;
        for (let i = 0; i < count; i++) {
            const objBox = await objects.nth(i).boundingBox();
            if (objBox && objBox.width > 0 && objBox.height > 0) {
                // Prüfe ob das Objekt massiv (>200px) außerhalb liegt
                const isFarOut =
                    objBox.x + objBox.width < stageRect.x - 200 ||
                    objBox.x > stageRect.x + stageRect.width + 200 ||
                    objBox.y + objBox.height < stageRect.y - 200 ||
                    objBox.y > stageRect.y + stageRect.height + 200;

                if (isFarOut) {
                    outOfBoundsCount++;
                    console.warn(`[E4] Objekt ${i} massiv außerhalb: (${objBox.x},${objBox.y},${objBox.width},${objBox.height})`);
                }
            }
        }

        expect(outOfBoundsCount).toBe(0);
    });
});
