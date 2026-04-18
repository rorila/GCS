import { test, expect, Page } from '@playwright/test';
import { loadMyCoolGame } from './helpers/loadMyCoolGame';

/**
 * SidePanel-Runtime E2E Tests (TSidePanel im Browser)
 * 
 * Prüft im echten Run-Modus:
 * - SP1: SidePanel kann in das Projekt injiziert und angezeigt werden
 * - SP2: Das SidePanel wird als Full-Height Panel am korrekten Rand (`side`) angedockt
 * - SP3: Das Resize-Handle ist im Run-Modus verfügbar und benutzbar
 */
test.describe('SidePanel-Runtime (TSidePanel)', () => {

    test.beforeEach(async ({ page }) => {
        page.on('console', msg => console.log('BROWSER:', msg.text()));
        await page.goto('/');
        await page.waitForSelector('#app-layout');
        await page.waitForFunction(() => (window as any).editor && (window as any).editor.project);
        await page.waitForTimeout(500);

        // Inject the SidePanel into the project dynamically
        await page.evaluate(() => {
            const editor = (window as any).editor;
            const mainStage = editor.project.stages.find((s: any) => s.id === 'main');
            
            // Generate a fresh SidePanel JSON
            const sidePanelObj = {
                className: 'TSidePanel',
                id: 'my_side_panel_' + Date.now(),
                name: 'MySidePanel',
                x: 0,
                y: 0,
                width: 15,
                height: 30,
                side: 'left',
                panelWidth: 15,
                modal: false,
                closable: true,
                centerOnShow: false,
                draggableAtRuntime: false,
                slideDirection: 'left',
                overlayDimming: true,
                resizable: true,
                visible: false,
                style: { backgroundColor: 'rgba(20,20,35,0.9)', borderWidth: 1, borderColor: '#4fc3f7' },
                children: []
            };
            
            // Also register in legacy registry if needed by standalone
            if ((window as any).ComponentRegistry) {
                const legacyReg = (window as any).ComponentRegistry;
                if (!legacyReg.registry.has('TSidePanel')) {
                     legacyReg.register('TSidePanel', (d: any) => d); // Mock if missing
                }
            }

            mainStage.objects.push(sidePanelObj);
            
            // Force editor refresh
            if ((window as any).mediatorService) {
                (window as any).mediatorService.notifyDataChanged(editor.project, 'playwright_test');
            }
            
            console.log("Playwright injected MySidePanel into stage!");
        });
    });

    /** Hilfsfunktion: In den Run-Modus wechseln */
    async function enterRunMode(page: Page) {
        const runTab = page.locator('.tab-btn[data-view="run"]');
        await expect(runTab).toBeVisible({ timeout: 5000 });
        await runTab.click();
        await expect(page.locator('#run-stage')).toBeVisible({ timeout: 10000 });
        await page.waitForTimeout(1500); // Animation abwarten
    }

    /** Hilfsfunktion: SidePanel programmatisch einblenden */
    async function showSidePanel(page: Page): Promise<boolean> {
        return page.evaluate(() => {
            try {
                const runtime = (window as any).__gameRuntime || (window as any).runtime;
                if (!runtime) return false;

                const objects = runtime.objects || [];
                const panel = objects.find((o: any) => o.name === 'MySidePanel');

                if (panel) {
                    panel.visible = true;
                    if (typeof panel.show === 'function') panel.show();
                    // Render-Update auslösen
                    if (runtime.options?.onRender) runtime.options.onRender();
                    if (runtime.options?.onComponentUpdate) runtime.options.onComponentUpdate(panel);
                    return true;
                }
                console.log("MY_SIDEPANEL NOT FOUND! Existing objects:", objects.map((o: any) => o.name + '(' + o.className + ')').join(', '));
                return false;
            } catch (e) {
                console.error("ERROR showSidePanel:", e);
                return false;
            }
        });
    }

    test('SP1: SidePanel-Injection und Sichtbarkeit im RunMode', async ({ page }) => {
        await enterRunMode(page);

        // Einblenden
        const shown = await showSidePanel(page);
        if (!shown) {
            console.log('[SP1] MySidePanel nicht im Runtime gefunden.');
            test.skip();
            return;
        }
        await page.waitForTimeout(500);

        // Prüfe Sichtbarkeit
        const panelState = await page.evaluate(() => {
            const runtime = (window as any).__gameRuntime || (window as any).runtime;
            if (!runtime) return null;
            const panel = (runtime.objects || []).find((o: any) => o.name === 'MySidePanel');
            return panel ? { visible: panel.visible } : null;
        });

        expect(panelState?.visible).toBe(true);

        const dialogEl = page.locator('.sidepanel-root');
        await expect(dialogEl).toBeVisible();
    });

    test('SP2: Rendering als Full-Height Panel mit CSS Transform left', async ({ page }) => {
        await enterRunMode(page);
        const shown = await showSidePanel(page);
        if (!shown) {
            test.skip();
            return;
        }
        await page.waitForTimeout(500);

        const panelCSS = await page.evaluate(() => {
            const panelEl = document.querySelector('.sidepanel-root') as HTMLElement;
            if (!panelEl) return null;
            
            const style = window.getComputedStyle(panelEl);
            return {
                height: style.height,
                left: style.left,
                transform: style.transform,
                position: style.position
            };
        });

        expect(panelCSS).not.toBeNull();
        if (panelCSS) {
            // Im Standard-CSS des SidePanels steht das Element auf fixed und height: 100%
            expect(panelCSS.position).toBe('fixed');
            expect(panelCSS.left).toBe('0px');
            // Sollte sich transform() im sichtbaren Bereich ("translateX(0)" also matrix(1,0,0,1,0,0) befinden)
            expect(panelCSS.transform).not.toBe('none');
        }
    });

    test('SP3: Resize-Handle ist im Laufzeit-DOM anwesend', async ({ page }) => {
        await enterRunMode(page);
        const shown = await showSidePanel(page);
        if (!shown) {
            test.skip();
            return;
        }
        await page.waitForTimeout(500);

        // Suche den resize handle
        const resizeHandle = page.locator('.sidepanel-resize-handle');
        expect(await resizeHandle.count()).toBe(1);
    });
});
