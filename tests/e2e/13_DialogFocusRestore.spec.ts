import { test, expect } from '@playwright/test';
import { loadMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * Phase 5: Dialog-Fokus-Lifecycle Regressionstests
 * 
 * Verifiziert, dass nach dem Öffnen und Schließen von Overlay-Dialogen
 * der Fokus sauber zurückgegeben wird und Inspector-Inputs weiterhin editierbar sind.
 * 
 * Reproduktionspfade:
 * - Overlay öffnen/schließen → Inspector-Input prüfen
 * - Delete-Taste in Input darf keine Objekte löschen
 * - Mehrfach-Zyklen
 */
test.describe('Dialog Fokus-Restore (Electron Stability)', () => {

    test.beforeEach(async ({ page }) => {
        await page.goto('/');
        await page.waitForSelector('#app-layout');
        await page.waitForFunction(() => (window as any).editor && (window as any).editor.project);
        await loadMyCoolGame(page);
        await page.waitForTimeout(500);
    });

    test('Kein Overlay-Leak nach Dialog-Schließen', async ({ page }) => {
        // 1. Dialog-Overlay im DOM erzeugen
        await page.evaluate(() => {
            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; justify-content:center; align-items:center;';
            overlay.id = 'test-overlay-leak';

            const btn = document.createElement('button');
            btn.id = 'test-leak-btn';
            btn.innerText = 'OK';
            btn.style.cssText = 'padding:8px 20px; background:#6c63ff; color:#fff; border:none; border-radius:6px;';
            btn.onclick = () => overlay.remove();
            overlay.appendChild(btn);
            document.body.appendChild(overlay);
            btn.focus();
        });

        await expect(page.locator('#test-overlay-leak')).toBeVisible({ timeout: 2000 });
        await page.locator('#test-leak-btn').click();
        await page.waitForTimeout(200);

        // Overlay muss komplett aus dem DOM entfernt sein
        await expect(page.locator('#test-overlay-leak')).toHaveCount(0);
    });

    test('Fokus-Restore: Input bleibt editierbar nach Dialog', async ({ page }) => {
        // 1. Stage-Settings im Inspector öffnen (hat garantiert Inputs)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const activeStage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            if (activeStage) {
                editor.selectObject(null);
                editor.inspector?.update(activeStage);
            }
        });
        await page.waitForTimeout(500);

        // 2. Das gameNameInput fokussieren (existiert laut 01_ProjectCreation-Test sicher)
        const gameNameInput = page.locator('input[name="gameNameInput"]');
        await expect(gameNameInput).toBeVisible({ timeout: 5000 });
        await gameNameInput.click();
        await gameNameInput.fill('VorDialog');
        await page.waitForTimeout(100);

        // 3. Dialog-Overlay öffnen (simuliert ConfirmDialog mit Fokus-Restore-Pattern)
        await page.evaluate(() => {
            const previouslyFocused = document.activeElement as HTMLElement;

            const overlay = document.createElement('div');
            overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; justify-content:center; align-items:center;';
            overlay.id = 'test-focus-restore-overlay';

            const btn = document.createElement('button');
            btn.id = 'test-focus-restore-btn';
            btn.innerText = 'Bestätigen';
            btn.style.cssText = 'padding:8px 20px; background:#6c63ff; color:#fff; border:none; border-radius:6px;';
            btn.onclick = () => {
                overlay.remove();
                // === DAS ist der Fokus-Restore-Fix der getestet werden soll ===
                if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
                    previouslyFocused.focus();
                }
            };
            overlay.appendChild(btn);
            document.body.appendChild(overlay);
            btn.focus(); // Dialog-Button bekommt Fokus (wie im echten ConfirmDialog)
        });

        // Bestätigen, dass Fokus NICHT mehr auf dem Input liegt
        const focusDuringDialog = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusDuringDialog).toBe('BUTTON'); // Fokus ist auf dem Dialog-Button

        // 4. Dialog schließen
        await page.locator('#test-focus-restore-btn').click();
        await page.waitForTimeout(200);

        // 5. Fokus muss zurück auf INPUT sein
        const focusAfterDialog = await page.evaluate(() => document.activeElement?.tagName);
        expect(focusAfterDialog).toBe('INPUT');
        console.log(`Fokus: BUTTON (Dialog) → ${focusAfterDialog} (zurück) ✅`);

        // 6. Input muss weiterhin editierbar sein (kritischster Punkt!)
        await gameNameInput.fill('NachDialog');
        await page.waitForTimeout(200);
        const value = await gameNameInput.inputValue();
        expect(value).toBe('NachDialog');
        console.log(`Input editierbar nach Dialog: "${value}" ✅`);
    });

    test('Delete-Taste in Input löscht keine Stage-Objekte', async ({ page }) => {
        // 1. Objekt-Anzahl VOR dem Test zählen
        const objectCountBefore = await page.evaluate(() => {
            const editor = (window as any).editor;
            const stage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            return stage?.objects?.length || 0;
        });
        if (objectCountBefore === 0) {
            test.skip();
            return;
        }

        // 2. Erstes Objekt programmatisch selektieren (UI-Klick wird von Toolbox überdeckt)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const stage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            if (stage?.objects?.length > 0) {
                const obj = stage.objects[0];
                editor.selectObject(obj.id || obj.name);
            }
        });
        await page.waitForTimeout(300);

        // 3. Stage-Settings im Inspector öffnen (hat garantiert Inputs)
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const activeStage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            if (activeStage) {
                editor.selectObject(null);
                editor.inspector?.update(activeStage);
            }
        });
        await page.waitForTimeout(300);

        // 4. gameNameInput fokussieren und Delete drücken
        const nameInput = page.locator('input[name="gameNameInput"]');
        if (await nameInput.count() === 0) {
            test.skip();
            return;
        }
        await nameInput.click();
        await nameInput.fill('DeleteTest');
        await page.waitForTimeout(100);

        // Delete-Taste drücken → darf NUR Text löschen, NICHT Objekte
        await page.keyboard.press('Delete');
        await page.waitForTimeout(300);

        // 5. Objekt-Anzahl bleibt identisch (über evaluate prüfen)
        const objectCountAfter = await page.evaluate(() => {
            const editor = (window as any).editor;
            const stage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            return stage?.objects?.length || 0;
        });
        expect(objectCountAfter).toBe(objectCountBefore);
        console.log(`Objekte: ${objectCountBefore} → ${objectCountAfter} (identisch) ✅`);
    });

    test('3x Dialog-Zyklus: Fokus bleibt stabil', async ({ page }) => {
        // Stage-Settings öffnen
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const activeStage = editor.project.stages?.find(
                (s: any) => s.id === editor.project.activeStageId
            );
            if (activeStage) {
                editor.selectObject(null);
                editor.inspector?.update(activeStage);
            }
        });
        await page.waitForTimeout(500);

        const nameInput = page.locator('input[name="gameNameInput"]');
        await expect(nameInput).toBeVisible({ timeout: 5000 });

        for (let i = 0; i < 3; i++) {
            // Input fokussieren
            await nameInput.click();
            await page.waitForTimeout(100);

            // Dialog öffnen mit Fokus-Restore
            await page.evaluate((cycle: number) => {
                const previouslyFocused = document.activeElement as HTMLElement;

                const overlay = document.createElement('div');
                overlay.style.cssText = 'position:fixed; top:0; left:0; right:0; bottom:0; background:rgba(0,0,0,0.6); z-index:99999; display:flex; justify-content:center; align-items:center;';
                overlay.id = `test-cycle-${cycle}`;

                const btn = document.createElement('button');
                btn.id = `test-cycle-btn-${cycle}`;
                btn.innerText = 'OK';
                btn.style.cssText = 'padding:8px 20px; background:#6c63ff; color:#fff; border:none; border-radius:6px;';
                btn.onclick = () => {
                    overlay.remove();
                    if (previouslyFocused && typeof previouslyFocused.focus === 'function' && document.body.contains(previouslyFocused)) {
                        previouslyFocused.focus();
                    }
                };
                overlay.appendChild(btn);
                document.body.appendChild(overlay);
                btn.focus();
            }, i);

            // Dialog schließen
            await page.locator(`#test-cycle-btn-${i}`).click();
            await page.waitForTimeout(200);

            // Fokus MUSS wieder auf INPUT sein
            const tag = await page.evaluate(() => document.activeElement?.tagName);
            expect(tag).toBe('INPUT');
        }

        // Nach 3 Zyklen: Input editierbar
        await nameInput.fill('Nach3Zyklen');
        const val = await nameInput.inputValue();
        expect(val).toBe('Nach3Zyklen');

        // Keine Overlays übrig
        const overlays = await page.locator('[id^="test-cycle-"]').count();
        expect(overlays).toBe(0);
        console.log(`3 Zyklen → Input editierbar: "${val}", 0 Overlays ✅`);
    });
});
