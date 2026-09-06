import { test, expect, Page } from '@playwright/test';

test.describe('12 Security: HTML-Injection Abwehr (XSS)', () => {

    test.beforeEach(async ({ page }) => {
        // Navigiere zum Editor (leeres Projekt / Default)
        await page.goto('/');
        await expect(page.locator('#app-layout')).toBeVisible();
    });

    test('Szenario 1: JSON Import Injection wird vom StageRenderer blockiert', async ({ page }) => {
        // Konstruiere ein bösartiges Projekt JSON mit XSS-Tags
        const maliciousProjectData = {
            meta: { name: "Malicious Project" },
            tasks: [],
            variables: [],
            actions: [],
            objects: [],
            flowCharts: {},
            stages: [
                {
                    id: "stage_main",
                    type: "main",
                    name: "Main Stage",
                    grid: { width: 800, height: 600, cols: 25, rows: 20, cellSize: 32 },
                    flowCharts: {},
                    tasks: [],
                    variables: [],
                    actions: [],
                    objects: [
                        {
                            id: "trich_malicious_1",
                            name: "InfectedText",
                            className: "TRichText",
                            x: 2,
                            y: 2,
                            width: 10,
                            height: 10,
                            // XSS HTML Injection Versuch:
                            htmlContent: `<h1>Innocent Text</h1>
                                        <script>window.XSS_HACK_JSON = 'exploited';</script>
                                        <img src="invalid.jpg" onerror="window.XSS_HACK_JSON_IMG = 'exploited'" />`
                        }
                    ]
                }
            ]
        };

        // Lade das Projekt tief in den Speicher (Simulation einer per API oder aus File geladenen Datei)
        await page.evaluate((projectData) => {
            (window as any).editor.loadProject(projectData);
        }, maliciousProjectData);

        // Gib dem Renderer Zeit, das DOM zu aktualisieren
        await page.waitForTimeout(1000);

        const stageContainer = page.locator('#stage-container');
        await expect(stageContainer).toBeVisible();

        // 1. Suche nach existierenden Script-Tags im gesamten HTML innerhalb des Editors
        const scriptTags = await stageContainer.locator('script').count();
        expect(scriptTags).toBe(0); // Dürfen gar nicht erst ins DOM gelangen!

        // 2. Prüfe ob das Image-Tag eventuell sein OnError Attribut behalten hat
        const imgTags = await stageContainer.locator('img').count();
        if (imgTags > 0) {
            const onErrorAttr = await stageContainer.locator('img').first().getAttribute('onerror');
            expect(onErrorAttr).toBeNull(); // Attribut MUSS entfernt worden sein
        }

        // 3. Evaluiere ob Javascript tatsächlich ausgeführt wurde
        const xssGlobalVar1 = await page.evaluate(() => (window as any).XSS_HACK_JSON);
        const xssGlobalVar2 = await page.evaluate(() => (window as any).XSS_HACK_JSON_IMG);
        
        expect(xssGlobalVar1).toBeUndefined();
        expect(xssGlobalVar2).toBeUndefined();
    });

    test('Szenario 2: Inspector UI (Rich-Text Dialog) Injection wird gefiltert', async ({ page }) => {
        // Erzeuge zuerst legal ein Projekt mit standard TRichText
        const defaultProject = {
            meta: { name: "Safe Project" },
            tasks: [],
            variables: [],
            actions: [],
            objects: [],
            flowCharts: {},
            stages: [
                {
                    id: "stage_main",
                    type: "main",
                    name: "Main Stage",
                    grid: { width: 800, height: 600, cols: 25, rows: 20, cellSize: 32 },
                    flowCharts: {},
                    tasks: [],
                    variables: [],
                    actions: [],
                    objects: [
                        {
                            id: "trich_safe_1",
                            name: "SafeText",
                            className: "TRichText",
                            x: 2,
                            y: 2,
                            width: 5,
                            height: 5,
                            htmlContent: `<p>Hallo Welt</p>`
                        }
                    ]
                }
            ]
        };

        await page.evaluate((projectData) => {
            (window as any).editor.loadProject(projectData);
        }, defaultProject);
        await page.waitForTimeout(500);

        // Klick auf das TRichText Objekt im Editor-Raster (um es auszuwählen)
        await page.locator('.game-object', { hasText: 'Hallo Welt' }).click();
        
        // Warte bis der Inspector erscheint
        await expect(page.locator('#inspector')).toBeVisible();
        await page.waitForTimeout(200);

        // Klicke auf den "Text bearbeiten" Button im Inspector
        await page.locator('button', { hasText: 'Text bearbeiten' }).first().click();

        // Warte auf den Dialog
        const richTextEditorArea = page.locator('.richtext-editor-area');
        await expect(richTextEditorArea).toBeVisible();

        // Füge schädlichen Code ein, um die "Quellcode bearbeiten" Schwachstelle zu testen
        // Weil der Editor contenteditable ist, werten wir innerHTML tief als "Hacker-Schnittstelle" aus.
        await richTextEditorArea.evaluate((el) => {
            el.innerHTML = `<h3>Malicious</h3>
            <iframe src="javascript:alert('xss UI')"></iframe>
            <a href="javascript:alert('xss A')">Klick mich</a>`;
        });

        // Klick auf Übernehmen
        const saveDialogBtn = page.locator('button', { hasText: 'Übernehmen' });
        await saveDialogBtn.first().click();
        
        // Dialog sollte geschlossen sein
        await page.waitForTimeout(500);

        const stageContainer = page.locator('#stage-container');
        
        // 1. Iframe wurde direkt entfernt
        const iframeTags = await stageContainer.locator('iframe').count();
        expect(iframeTags).toBe(0);

        // 2. Das A-Tag ist da, hat aber kein javascript:href mehr
        const anchorCount = await stageContainer.locator('a').count();
        if (anchorCount > 0) {
            const anchorHref = await stageContainer.locator('a').first().getAttribute('href');
            // SecurityUtils löscht href Attribute mit "javascript:" vollständig
            expect(anchorHref).toBeNull();
        }
    });
    
    test('Szenario 3: Laden einer manipulierten externen JSON-Datei (Drag Drop Simulation)', async ({ page }) => {
        // Angreifer bereitet eine externe JSON-Datei vor z.B. GameBuilderProjekt.json
        const externalJSONPayload = {
            meta: { name: "Hacked JSON file" },
            tasks: [],
            variables: [],
            actions: [],
            objects: [],
            flowCharts: {},
            stages: [
                {
                    id: "stage_main",
                    type: "main",
                    name: "Main Stage",
                    grid: { width: 800, height: 600, cols: 25, rows: 20, cellSize: 32 },
                    flowCharts: {},
                    tasks: [],
                    variables: [],
                    actions: [],
                    objects: [
                        {
                            id: "trich_hacked_ext",
                            name: "HackedFileText",
                            className: "TRichText",
                            x: 0,
                            y: 0,
                            width: 10,
                            height: 10,
                            htmlContent: `<p>Gefälschte Datei</p><script>window.XSS_FILE = true;</script>`
                        }
                    ]
                }
            ]
        };

        // 1. Manuell über Editor-View laden, als ob der User im Import-Tab ist
        await page.evaluate((payload) => {
            (window as any).editor.viewManager.switchView('import');
            const textarea = document.querySelector('.import-textarea') as HTMLTextAreaElement;
            if (textarea) {
                textarea.value = JSON.stringify(payload);
                // Dispatch event, damit Validierung anspringt
                textarea.dispatchEvent(new Event('input', { bubbles: true }));
            }
        }, externalJSONPayload);

        await page.waitForTimeout(500); // Warten bis Validierung läuft

        // 2. Klick auf den "Projekt laden" Button
        const loadBtn = page.locator('button', { hasText: 'Projekt laden' });
        
        // Clicke nur wenn er interaktiv ist
        if (await loadBtn.count() > 0) {
            await loadBtn.first().click();
        } else {
            // Fallback auf loadProject falls UI nicht greift (für headless Zuverlässigkeit)
            await page.evaluate((payload) => {
                (window as any).editor.loadProject(payload);
            }, externalJSONPayload);
        }

        await page.waitForTimeout(1000);

        const stageContainer = page.locator('#stage-container');
        
        // Prüfe ob das Script-Tag nicht im DOM existiert
        const scriptTags = await stageContainer.locator('script').count();
        expect(scriptTags).toBe(0); // SecurityUtils muss es entfernen

        // Prüfe ob die Variable initialisiert wurde
        const xssGlobalVar = await page.evaluate(() => (window as any).XSS_FILE);
        expect(xssGlobalVar).toBeUndefined();
    });

});
