import { test, expect } from '@playwright/test';
import * as fs from 'fs';
import * as path from 'path';

test.describe('Movement Debug Test', () => {
    test('sollte das Movement der Kanone loggen', async ({ page }) => {
        const consoleLogs: string[] = [];
        page.on('console', msg => {
            const txt = msg.text();
            consoleLogs.push(txt);
            console.log('BROWSER:', txt);
        });

        console.log('Test: Starte Editor...');
        await page.goto('http://localhost:5173/?e2e=true');
        await page.waitForSelector('#app-layout');

        // Lade Silvias_Shooter_Demo.json
        const filePath = path.join(process.cwd(), 'game-server/public/projects/UfoShoter2.json');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Datei nicht gefunden: ${filePath}`);
        }
        const raw = fs.readFileSync(filePath, 'utf-8');
        const projectData = JSON.parse(raw);

        console.log('Test: Lade Silvias_Shooter_Demo...');
        await page.evaluate((data) => {
            (window as any).editor.loadProject(data);
        }, projectData);
        await page.waitForTimeout(1000);

        // Wechsle in den Run-Tab
        console.log('Test: Wechsle in den Run-Tab...');
        const runTab = page.locator('.tab-btn[data-view="run"]');
        await runTab.click();
        await page.waitForTimeout(500);

        // Klicke auf den Start-Button im Run-Mode (falls vorhanden)
        const startBtn = page.locator('#run-start-game-btn');
        if (await startBtn.count() > 0) {
            console.log('Test: Klicke Start-Button...');
            await startBtn.click();
            await page.waitForTimeout(500);
        }

        // Drücke ArrowLeft und halte sie gedrückt
        console.log('Test: Drücke ArrowLeft...');
        await page.keyboard.down('ArrowLeft');
        await page.waitForTimeout(1500); // 1.5 Sekunden halten
        console.log('Test: Lasse ArrowLeft los...');
        await page.keyboard.up('ArrowLeft');
        await page.waitForTimeout(500);

        console.log('Test: Beendet.');
    });
});
