// Probe: repliziert den E2E-Kontext von Test 3 (17_PuzzleSourceRect)
const { chromium } = require('@playwright/test');
const { readFileSync } = require('node:fs');
const path = require('node:path');

const project = JSON.parse(readFileSync(path.join(__dirname, '../game-server/public/projects/PuzzleNeu.json'), 'utf8'));
const splitterDef = project.stages.find(s => s.id === 'stage_main').objects.find(o => o.name === 'Bildaufteiler');
const pieceCount = Number(splitterDef.columns) * Number(splitterDef.rows);

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1779, height: 893 } });
    page.on('console', m => { if (m.text().includes('PUZZLE-DIAG')) console.log('  [page]', m.text()); });
    await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method()) ? route.continue() : route.abort());
    await page.goto('http://localhost:5173/');
    await page.waitForFunction(() => !!(window).editor);
    await page.evaluate(async data => {
        const editor = (window).editor;
        editor.loadProject(data);
        await new Promise(r => setTimeout(r, 500));
        editor.hideManagedObjectsOnStage = true;
        await editor.switchView('flow');
        editor.flowEditor.switchActionFlow('GeneratePuzzleSprites');
        editor.flowEditor.syncToProject();
        await editor.switchView('run');
    }, structuredClone(project));

    await page.locator('#run-start-game-btn').click();
    await page.waitForTimeout(2000);
    await page.locator('#run-stage [data-id="pn_btn_puzzle_sprites_erzeugen"]').click();
    await page.waitForFunction(pc => (window).editor.runtime.spritePool.getActiveInstances().length === pc, pieceCount);

    const result = await page.evaluate(async () => {
        const editor = (window).editor;
        const { coreStore } = await import('/src/services/registry/CoreStore.ts');
        const { projectObjectRegistry } = await import('/src/services/registry/ObjectRegistry.ts');
        const { DialogDomainHelper } = await import('/src/editor/dialogs/utils/DialogDomainHelper.ts');
        const objects = projectObjectRegistry.getObjects();
        return {
            coreStoreProjectLoaded: !!coreStore.project,
            projectSameAsEditor: coreStore.project === editor.project,
            coreStoreStageCount: coreStore.project?.stages?.length,
            activeStageId: coreStore.activeStageId,
            editorActiveStageId: editor.project?.activeStageId,
            registrySize: objects.length,
            registryNames: objects.map(o => o.name),
            templateInRegistry: !!objects.find(o => o.name === 'PuzzleTeilTemplate'),
            methods: DialogDomainHelper.getMethodsForObject({ project: editor.project, enrichedProject: { variables: [] }, dialogData: {} }, 'PuzzleTeilTemplate'),
            templateHasMethod: typeof editor.runtime.objects.find(o => o.name === 'PuzzleTeilTemplate')?.resetPool
        };
    });
    console.log(JSON.stringify(result, null, 2));
    await browser.close();
})().catch(e => { console.error(e); process.exit(1); });
