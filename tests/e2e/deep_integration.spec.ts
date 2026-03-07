import { test, expect, Page, Locator } from '@playwright/test';

/**
 * DEEP INTEGRATION TESTS
 * Verifiziert die Kern-Use-Cases: Drag & Drop, Inspector, JSON-Sync, Flow-Editor & Run-Mode.
 */

test.describe('Deep Integration: Editor & Engine', () => {

    test.beforeEach(async ({ page }) => {
        // Handle native dialogs (confirm/alert) automatically
        page.on('dialog', dialog => dialog.accept());

        await page.goto('/?e2e=true');
        await expect(page.locator('#app-layout')).toBeVisible();

        // Load clean project state
        await page.evaluate(async () => {
            const res = await fetch('platform/project.json');
            const project = await res.json();
            (window as any).editor.setProject(project);
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
        await page.evaluate((v) => {
            const ed = (window as any).editor;
            if (ed) ed.switchView(v);
        }, view);
        // Wait for class change on tab
        await expect(page.locator(`.tab-btn[data-view="${view}"]`)).toHaveClass(/active/);
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

        // The click places it at a default position (e.g., 10,10)
        // We look for the newly created button on the stage
        const placedButton = page.locator('#stage-viewport .game-object').filter({ hasText: 'Button' }).first();
        await expect(placedButton).toBeVisible({ timeout: 15000 });

        // 2. Drag on Stage (This uses mouse move and is stable)
        const box = await placedButton.boundingBox();
        if (box) {
            await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
            await page.mouse.down();
            await page.mouse.move(box.x + box.width / 2 + 100, box.y + box.height / 2 + 50);
            await page.mouse.up();
        }

        await placedButton.click({ force: true });

        const nameInput = page.locator('#inspector').locator('input[name="nameInput"]').first();
        await expect(nameInput).toBeVisible({ timeout: 10000 });

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
        const nameInput = page.locator('#inspector').locator('input[name="nameInput"], input[name="NameInput"]').first();
        await expect(nameInput).toBeVisible();
        await nameInput.fill('MainTask');
        await nameInput.press('Enter');

        const flowCanvas = page.locator('#flow-canvas');
        const actionItem = page.locator('#toolbox-content .toolbox-item:has-text("Action")').first();
        await manualDragAndDrop(page, actionItem, flowCanvas, { x: 200, y: 150 });

        const actionNode = page.locator('.flow-node:has-text("Action")').first();
        await expect(actionNode).toBeVisible();
        await actionNode.click({ force: true });
        await expect(nameInput).toBeVisible();
        await nameInput.fill('GlobalAction');
        await nameInput.press('Enter');

        const outputBtn = page.locator('.flow-node:has-text("MainTask")').locator('.flow-anchor.output');
        const inputBtn = page.locator('.flow-node:has-text("GlobalAction")').locator('.flow-anchor.input');
        await manualDragAndDrop(page, outputBtn, inputBtn);

        await switchView(page, 'json');
        const jsonContent = page.locator('#json-viewer');
        await expect(jsonContent).toContainText('"name": "MainTask"');
        await expect(jsonContent).toContainText('"name": "GlobalAction"');
    });

    test('Use Case: Run-Mode & Execution', async ({ page }) => {
        test.slow(); // Mark as slow test (increases timeout)
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
        await onClickSelect.selectOption({ value: 'RunTestTask' });

        await switchView(page, 'run');
        const runButton = page.locator('#run-stage-viewport .TButton').first();
        await expect(runButton).toBeVisible({ timeout: 10000 });

        // Open Debug Log before clicking
        const debugLogToggle = page.locator('#debug-log-toggle');
        await expect(debugLogToggle).toBeVisible();
        await debugLogToggle.click();

        const debugLogPanel = page.locator('#debug-log-panel');
        await expect(debugLogPanel).toBeVisible({ timeout: 5000 });

        // Force click the run button
        await runButton.click({ force: true });
        await page.waitForTimeout(1000); // Wait for execution

        // Check if RunTestTask appeared in the log
        // The message is "START: RunTestTask"
        await expect(debugLogPanel).toContainText('RunTestTask', { timeout: 15000 });
    });
});
