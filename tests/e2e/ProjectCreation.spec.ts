import { test, expect } from '@playwright/test';

test.describe('UseCase: Ein neues Projekt (Spiel) erzeugen', () => {
    test('Kompletter Flow: Erzeugung, Metadata, Dirty-Check, Stages & Grid', async ({ page }) => {
        console.log('Test: Starte Editor...');
        // Starte den Editor im E2E-Modus
        await page.goto('http://localhost:5173/?e2e=true');
        console.log('Test: Warte auf #app-layout...');
        await page.waitForSelector('#app-layout');

        console.log('Test: Warte auf Editor-Objekte...');
        // 1. Trigger "Neues Projekt" (Warten bis Editor bereit ist)
        await page.waitForFunction(() => (window as any).editor && (window as any).mediatorService);

        console.log('Test: Trigger newProject...');
        await page.evaluate(() => {
            (window as any).editor.newProject();
        });
        console.log('Test: newProject getriggert.');

        // 2. Initial-Validierung
        console.log('Test: 2. Initial-Validierung...');
        let projectData = await page.evaluate(() => (window as any).editor.project);

        // Metadata
        expect(projectData.meta.name).toBe('Neues Spiel');
        expect(projectData.meta.author).toBe('');
        expect(projectData.meta.description).toBe('');

        // Main Stage Check (leer)
        let mainStage = projectData.stages.find((s: any) => s.id === 'main');
        expect(mainStage).toBeDefined();
        expect(mainStage.objects.length).toBe(0);
        expect(mainStage.actions.length).toBe(0);
        expect(mainStage.tasks.length).toBe(0);
        expect(mainStage.variables.length).toBe(0);
        expect(mainStage.grid.snapToGrid).toBe(true); // default from implementation

        // Blueprint Stage Check
        let blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        expect(blueprint).toBeDefined();
        expect(blueprint.objects.find((o: any) => o.name === 'StageController')).toBeDefined();
        let changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar).toBeDefined();
        expect(changeVar.defaultValue).toBe(false);

        // 3. Metadata & Dirty-Check
        console.log('Test: 3. Metadata & Dirty-Check...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            editor.project.meta.name = 'MyCoolGame';
            (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
        });

        // Warten auf Debounce im Mediator (300ms)
        await page.waitForTimeout(400);

        projectData = await page.evaluate(() => (window as any).editor.project);
        blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true);

        // 4. Stage Umbenennung
        console.log('Test: 4. Stage Umbenennung...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const blueprint = editor.project.stages.find((s: any) => s.id === 'blueprint');
            const changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
            changeVar.defaultValue = false; // Reset dirty check for next step

            const mainStage = editor.project.stages.find((s: any) => s.id === 'main');
            mainStage.name = 'MainStage';
            (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
        });

        await page.waitForTimeout(400);

        projectData = await page.evaluate(() => (window as any).editor.project);
        mainStage = projectData.stages.find((s: any) => s.id === 'main');
        expect(mainStage.name).toBe('MainStage');
        blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true); // Must be dirty again

        // 5. Metadaten ergänzen (Autor & Beschreibung)
        console.log('Test: 5. Metadaten (Autor & Beschreibung)...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const blueprint = editor.project.stages.find((s: any) => s.id === 'blueprint');
            const changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
            changeVar.defaultValue = false; // Reset dirty check

            editor.project.meta.author = 'GCS-Team';
            editor.project.meta.description = 'Das ist mein cooles Spiel';
            (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
        });

        await page.waitForTimeout(400);

        projectData = await page.evaluate(() => (window as any).editor.project);
        expect(projectData.meta.author).toBe('GCS-Team');
        expect(projectData.meta.description).toBe('Das ist mein cooles Spiel');
        blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true); // Must be dirty again

        // 6. Raster- und Stage-Einstellungen (Grid, Color, Line/Snap visibility)
        console.log('Test: 6. Grid-Einstellungen...');
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages.find((s: any) => s.id === 'main');

            const blueprint = editor.project.stages.find((s: any) => s.id === 'blueprint');
            const changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
            changeVar.defaultValue = false; // Reset dirty check

            mainStage.grid.cols = 60;
            mainStage.grid.rows = 38;
            mainStage.grid.cellSize = 22;
            mainStage.grid.backgroundColor = '#16da36';
            mainStage.grid.visible = false; // Rasterlinien
            mainStage.grid.snapToGrid = false;

            (window as any).mediatorService.notifyDataChanged(editor.project, 'inspector');
        });

        await page.waitForTimeout(400);

        console.log('Test: Validate Grid changes...');
        projectData = await page.evaluate(() => (window as any).editor.project);
        mainStage = projectData.stages.find((s: any) => s.id === 'main');

        expect(mainStage.grid.cols).toBe(60);
        expect(mainStage.grid.rows).toBe(38);
        expect(mainStage.grid.cellSize).toBe(22);
        expect(mainStage.grid.backgroundColor).toBe('#16da36');
        expect(mainStage.grid.visible).toBe(false);
        expect(mainStage.grid.snapToGrid).toBe(false);

        blueprint = projectData.stages.find((s: any) => s.id === 'blueprint');
        changeVar = blueprint.variables.find((v: any) => v.name === 'isProjectChangeAvailable');
        expect(changeVar.defaultValue).toBe(true);

        console.log('Test: Completed flow.');
    });
});
