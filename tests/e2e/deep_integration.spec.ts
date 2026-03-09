import { test, expect, Page, Locator } from '@playwright/test';

/**
 * DEEP INTEGRATION TESTS
 * Verifiziert die Kern-Use-Cases: Drag & Drop, Inspector, JSON-Sync, Flow-Editor & Run-Mode.
 */

test.describe('Deep Integration: Editor & Engine', () => {

    test.beforeEach(async ({ page, request }) => {
        // 1. Reset project to clean template state on disk before each test
        const resetResponse = await request.post('/api/dev/reset-project');
        expect(resetResponse.ok()).toBeTruthy();

        // 2. Handle native dialogs (confirm/alert) automatically
        page.on('dialog', dialog => dialog.accept());

        await page.goto('/?e2e=true');
        await page.evaluate(() => localStorage.clear());
        await page.reload();
        await expect(page.locator('#app-layout')).toBeVisible();

        // 3. Load project state from the freshly reset file into browser memory
        await page.evaluate(async () => {
            const res = await fetch('platform/project.json');
            const project = await res.json();
            // Use loadProject instead of setProject to ensure objects are hydrated (class instances)
            (window as any).editor.loadProject(project);
        });

        await expect(page.locator('#stage-viewport')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(500);
    });

    async function switchStage(page: Page, stageName: string) {
        const stagesMenuBtn = page.locator('.menu-bar-button:has-text("Stages")');
        await stagesMenuBtn.click();
        const dropdown = page.locator('.menu-dropdown');
        await expect(dropdown).toBeVisible();
        const stageItem = dropdown.locator('.menu-item').filter({ hasText: stageName });
        await stageItem.click();

        // Wait for stage to render (check for viewport visibility)
        await expect(page.locator('#stage-viewport')).toBeVisible({ timeout: 15000 });
        await page.waitForTimeout(500);
    }

    async function expandToolboxCategory(page: Page, categoryName: string) {
        await page.evaluate((cat) => {
            const ed = (window as any).editor;
            if (ed && ed.jsonToolbox) {
                ed.jsonToolbox.expandedState.set(cat, true);
                ed.jsonToolbox.render();
            }
        }, categoryName);
        await page.waitForTimeout(500);
    }

    async function switchView(page: Page, view: string) {
        const tabBtn = page.locator(`.tab-btn[data-view="${view}"]`);
        await tabBtn.click({ force: true });

        // Wait for class change on tab
        await expect(tabBtn).toHaveClass(/active/);

        // Wait for the panel to be visible (specific for each view)
        const panelMap: Record<string, string> = {
            'stage': '#stage-wrapper',
            'run': '#run-stage',
            'json': '#json-viewer',
            'flow': '#flow-viewer',
            'code': '#code-viewer',
            'management': '#management-viewer'
        };
        const panelId = panelMap[view];
        if (panelId) {
            await expect(page.locator(panelId)).toBeVisible({ timeout: 10000 });
        }
        await page.waitForTimeout(500);
    }

    async function manualDragAndDrop(page: Page, sourceLocator: Locator, targetLocator: Locator, targetOffset = { x: 0, y: 0 }) {
        const sourceBox = await sourceLocator.boundingBox();
        const targetBox = await targetLocator.boundingBox();
        if (!sourceBox || !targetBox) throw new Error('Source or target not found');

        const startX = sourceBox.x + sourceBox.width / 2;
        const startY = sourceBox.y + sourceBox.height / 2;
        const endX = targetBox.x + targetBox.width / 2 + targetOffset.x;
        const endY = targetBox.y + targetBox.height / 2 + targetOffset.y;

        await page.mouse.move(startX, startY);
        await page.mouse.down();
        await page.waitForTimeout(500); // Wait for dragstart

        // Move to target
        await page.mouse.move(endX, endY, { steps: 10 });
        await page.waitForTimeout(200);
        await page.mouse.up();
        await page.waitForTimeout(1000); // Wait for drop processing
    }

    test('Use Case: Komponente & Inspector (D&D, Rename, JSON Sync, Delete)', async ({ page }) => {
        await expandToolboxCategory(page, 'Standard');

        // 1. Click-to-Add (Reliable fallback for E2E instead of DnD)
        const toolboxButton = page.locator('#json-toolbox-content .toolbox-item').filter({ hasText: 'Button' }).first();
        await toolboxButton.click();

        const placedButton = page.locator('#stage-viewport .game-object').filter({ hasText: 'Button' }).first();
        await expect(placedButton).toBeVisible({ timeout: 15000 });

        // 2. Drag on Stage
        const box = await placedButton.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
            await page.mouse.up();
        }

        await placedButton.click({ force: true });
        await page.waitForTimeout(500);

        // Robust selector for inspector input
        const nameInput = page.locator('#inspector').locator('input[name="nameInput"], input[name="NameInput"]').first();
        await expect(nameInput).toBeVisible({ timeout: 15000 });

        await nameInput.fill('TestButton1');
        await nameInput.press('Enter');
        await page.waitForTimeout(500);

        await switchView(page, 'json');
        const jsonContent = page.locator('#json-viewer');
        await expect(jsonContent).toContainText('"name": "TestButton1"');

        await switchView(page, 'stage');
        const stage = page.locator('#stage-viewport');
        const toolboxPanel = page.locator('.toolbox-item:has-text("Panel")');
        await manualDragAndDrop(page, toolboxPanel, stage, { x: 300, y: 300 });

        const placedPanel = page.locator('#stage-viewport .game-object').filter({ hasText: 'Panel' }).first();
        await expect(placedPanel).toBeVisible();

        await placedPanel.click({ force: true });
        await page.waitForTimeout(500); // Wait for selection to settle
        await page.keyboard.press('Delete');
        await expect(placedPanel).not.toBeVisible();
    });

    test('Use Case: Flow-Editor & Refactoring (Task/Action, Linking, JSON)', async ({ page }) => {
        await switchView(page, 'flow');
        await page.locator('button[title="New Task Flow"]').click();

        const taskNode = page.locator('.flow-node:has-text("ANewTask")');
        await expect(taskNode).toBeVisible({ timeout: 15000 });

        await taskNode.click({ force: true });
        let nameInput = page.locator('input[name="NameInput"]');
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill('MainTask');
        await nameInput.press('Enter');

        const flowCanvas = page.locator('#flow-canvas');
        const actionItem = page.locator('#toolbox-content .toolbox-item:has-text("Action")').first();
        await manualDragAndDrop(page, actionItem, flowCanvas, { x: 200, y: 150 });

        const actionNode = page.locator('.flow-node:has-text("Action")').first();
        await expect(actionNode).toBeVisible();
        await actionNode.click({ force: true });
        nameInput = page.locator('input[name="NameInput"]');
        await nameInput.fill('GlobalAction');
        await nameInput.press('Enter');

        const outputBtn = page.locator('.flow-node:has-text("MainTask")').locator('.flow-anchor.output');
        const inputBtn = page.locator('.flow-node:has-text("GlobalAction")').locator('.flow-anchor.input');
        await manualDragAndDrop(page, outputBtn, inputBtn);

        await switchView(page, 'json');
        const jsonContent = page.locator('#json-viewer');
        await expect(jsonContent).toContainText('"name": "MainTask"');
        await expect(jsonContent).toContainText('"name": "GlobalAction"');

        // Kurze Pause für Mediator-Sync (WICHTIG für UI-Stabilität)
        await page.waitForTimeout(1000);

        // --- NEU: Manager-Tab & Dropdown Sync Check (Anforderung 2) ---
        // 1. Check Manager-Tab
        await switchView(page, 'management');
        const tasksSidebarBtn = page.locator('.management-sidebar-btn').filter({ hasText: 'Tasks' });
        await expect(tasksSidebarBtn).toBeVisible({ timeout: 10000 });
        await tasksSidebarBtn.click({ force: true });

        // Manager-Inhalt finden (robuster ohne ID-Zwang)
        const managerContent = page.locator('.management-content');
        await expect(managerContent).toBeVisible({ timeout: 15000 });

        // Flexiblerer Selektor für die Tabellenzelle
        const tableCell = managerContent.locator('td').filter({ hasText: 'MainTask' });
        await expect(tableCell).toBeVisible({ timeout: 15000 });

        // 2. Check Dropdowns in Inspector (Stage View)
        await switchView(page, 'stage');
        await expandToolboxCategory(page, 'Standard');

        // Sicherstellen, dass die Toolbox gerendert ist
        const toolboxBtn = page.locator('#json-toolbox-content .toolbox-item').filter({ hasText: 'Button' }).first();
        await expect(toolboxBtn).toBeVisible({ timeout: 10000 });
        await toolboxBtn.click();

        const testBtn = page.locator('#stage-viewport .TButton').first();
        await expect(testBtn).toBeVisible({ timeout: 10000 });
        await testBtn.click({ force: true });

        await page.locator('.inspector-tab').filter({ hasText: 'Events' }).click();
        const onClickSelect = page.locator('select[name="event_onClick"]');
        await expect(onClickSelect).toBeVisible({ timeout: 10000 });

        // Prüfen, ob der umbenannte Task im Dropdown erscheint (mit Emoji-Support)
        // Hinweis: Wir nutzen toBeAttached, da native Optionen oft nicht "visible" sind
        const taskOption = onClickSelect.locator('option[value="MainTask"]');
        await expect(taskOption).toBeAttached({ timeout: 10000 });

        // Selektieren via Value (umgeht das Emoji im Label)
        await onClickSelect.selectOption('MainTask');
        await expect(onClickSelect).toHaveValue('MainTask');
    });

    test('Use Case: Run-Mode & Execution', async ({ page }) => {
        test.slow(); // Mark as slow test
        await switchView(page, 'stage');
        await expandToolboxCategory(page, 'Standard');

        const stage = page.locator('#stage-viewport');
        await manualDragAndDrop(page, page.locator('#json-toolbox-content .toolbox-item:has-text("Button")').first(), stage, { x: 100, y: 100 });

        const placedButton = stage.locator('.game-object.TButton').first();
        await expect(placedButton).toBeVisible({ timeout: 15000 });

        await switchView(page, 'flow');
        await page.locator('button[title="New Task Flow"]').click();
        const taskNode = page.locator('.flow-node').filter({ hasText: 'ANewTask' });
        await expect(taskNode).toBeVisible({ timeout: 15000 });

        await taskNode.click({ force: true });
        const nameInput = page.locator('#inspector').locator('input[name="nameInput"], input[name="NameInput"]').first();
        await expect(nameInput).toBeVisible({ timeout: 10000 });
        await nameInput.fill('RunTestTask');
        await nameInput.press('Enter');

        const flowCanvas = page.locator('#flow-canvas');
        const actionItem = page.locator('#toolbox-content .toolbox-item:has-text("Action")').first();
        await manualDragAndDrop(page, actionItem, flowCanvas, { x: 100, y: 100 });

        const actionNode = page.locator('.flow-node:has-text("Action")').first();
        await expect(actionNode).toBeVisible();

        const outputBtn = page.locator('.flow-node:has-text("RunTestTask")').locator('.flow-anchor.output');
        const inputBtn = actionNode.locator('.flow-anchor.input');
        await manualDragAndDrop(page, outputBtn, inputBtn);

        await switchView(page, 'stage');
        await expect(stage).toBeVisible();
        await placedButton.click({ force: true });
        await page.locator('.inspector-tab:has-text("Events")').click();

        const onClickSelect = page.locator('select[name="event_onClick"]');
        await expect(onClickSelect).toBeVisible({ timeout: 10000 });

        // Select via value (Task name) to bypass Emoji in label
        await onClickSelect.selectOption('RunTestTask');

        await switchView(page, 'run');
        const runButton = page.locator('#run-stage-viewport .TButton').first();
        await expect(runButton).toBeVisible({ timeout: 10000 });

        // Open Debug Log
        const debugLogToggle = page.locator('#debug-log-toggle');
        await expect(debugLogToggle).toBeVisible();
        await debugLogToggle.click();

        const debugLogPanel = page.locator('#debug-log-panel');
        await expect(debugLogPanel).toBeVisible({ timeout: 5000 });

        await runButton.click({ force: true });
        await page.waitForTimeout(1000); // Wait for execution

        await expect(debugLogPanel).toContainText('RunTestTask', { timeout: 15000 });
    });

    test('Use Case: Stage-Switch-Action (Anforderung 4)', async ({ page }) => {
        test.slow();
        // 1. Create a second stage "Level2" via Menu
        const projectMenu = page.locator('.menu-bar-button').filter({ hasText: 'Stages' });
        await projectMenu.click();
        const addStageItem = page.locator('.menu-item').filter({ hasText: 'Neue Stage' });
        await expect(addStageItem).toBeVisible({ timeout: 5000 });
        await addStageItem.click();

        await page.waitForTimeout(1500); // Wait for stage creation and hydration

        // 2. Setup Flow for Stage Switch
        await switchView(page, 'flow');
        await page.locator('button[title="New Task Flow"]').click();
        const taskNode = page.locator('.flow-node').filter({ hasText: 'ANewTask' });
        await expect(taskNode).toBeVisible({ timeout: 15000 });
        await taskNode.click({ force: true });

        const nameInput = page.locator('#inspector').locator('input[name="nameInput"], input[name="NameInput"]').first();
        await expect(nameInput).toBeVisible();
        await nameInput.fill('GotoLevel2');
        await nameInput.press('Enter');

        const flowCanvas = page.locator('#flow-canvas');
        const actionItem = page.locator('#toolbox-content .toolbox-item').filter({ hasText: 'Action' }).first();
        await manualDragAndDrop(page, actionItem, flowCanvas, { x: 100, y: 100 });

        const actionNode = page.locator('.flow-node').filter({ hasText: 'Action' }).first();
        await actionNode.click({ force: true });

        // Select navigate_stage type (Technischer Name: "ActionTypeSelect")
        const typeSelect = page.locator('select[name="ActionTypeSelect"]');
        await expect(typeSelect).toBeVisible({ timeout: 10000 });
        await typeSelect.selectOption('navigate_stage');

        // Select target stage (Technischer Name: "stageId")
        const stageSelect = page.locator('select[name="stageId"]');
        await expect(stageSelect).toBeVisible({ timeout: 10000 });

        // Robustere Auswahl der Stage: Wir nehmen einfach die letzte Option
        await page.waitForTimeout(500);
        const optionsCount = await stageSelect.locator('option').count();
        if (optionsCount > 1) {
            await stageSelect.selectOption({ index: optionsCount - 1 });
        }

        const outputBtn = page.locator('.flow-node').filter({ hasText: 'GotoLevel2' }).locator('.flow-anchor.output');
        const inputBtn = actionNode.locator('.flow-anchor.input');
        await manualDragAndDrop(page, outputBtn, inputBtn);

        // 3. Bind to Button and Test in Run-Mode
        await switchView(page, 'stage');
        await expandToolboxCategory(page, 'Standard');
        const toolboxButton = page.locator('#json-toolbox-content .toolbox-item').filter({ hasText: 'Button' }).first();
        await toolboxButton.click();

        const btn = page.locator('#stage-viewport .TButton').first();
        await expect(btn).toBeVisible();
        await btn.click({ force: true });
        await page.locator('.inspector-tab').filter({ hasText: 'Events' }).click();
        const eventSelect = page.locator('select[name="event_onClick"]');
        await expect(eventSelect).toBeVisible();
        // Select via value (Task name) to bypass Emoji in label
        await eventSelect.selectOption('GotoLevel2');

        await switchView(page, 'run');
        const runBtn = page.locator('#run-stage-viewport .TButton').first();
        await expect(runBtn).toBeVisible({ timeout: 15000 });
        await runBtn.click({ force: true });

        // 4. Verify Stage Switch via Debug Log
        const debugLogToggle = page.locator('#debug-log-toggle');
        await expect(debugLogToggle).toBeVisible();
        await debugLogToggle.click();

        // Check for TStageController log entry which indicates stage transition
        const debugLogPanel = page.locator('#debug-log-panel');
        await expect(debugLogPanel).toContainText('TStageController', { timeout: 15000 });
    });
});
