import type { Editor } from '../Editor';
import { ThemeDefinition, themeRegistry } from '../../runtime/ThemeRegistry';
import { StageDefinition, StageType } from '../../model/types';
import { NotificationToast } from '../ui/NotificationToast';
import { PromptDialog } from '../ui/PromptDialog';

/**
 * Verwaltet den Theme-Editor-Modus.
 *
 * Der Theme-Editor zeigt je eine Instanz aller thematischen Komponenten auf einer
 * eigenen Stage an. Der User kann die Styles direkt im Inspector bearbeiten und
 * das Ergebnis unter einem neuen Theme-Namen speichern.
 */
export class ThemeStageService {
    private readonly THEME_STAGE_ID = '__theme_editor__';

    private host: Editor;
    private active = false;
    private previousStageId: string | null = null;
    private sourceThemeId: string | null = null;
    private bannerEl: HTMLElement | null = null;

    constructor(host: Editor) {
        this.host = host;
    }

    public isThemeEditorActive(): boolean {
        return this.active;
    }

    /**
     * Öffnet den Theme-Editor als eigenen Stage-Modus.
     * @param sourceThemeId ID des Themes, das als Ausgangspunkt dient.
     */
    public enterThemeEditor(sourceThemeId?: string): void {
        if (this.active) return;

        this.sourceThemeId = sourceThemeId || themeRegistry.getActiveThemeId();
        this.previousStageId = this.host.project.activeStageId || null;

        this.ensureThemeStage();

        this.active = true;
        this.host.project.activeStageId = this.THEME_STAGE_ID;
        this.host.stageManager.switchStage(this.THEME_STAGE_ID);
        this.host.selectObject(null);

        this.renderBanner();
    }

    /**
     * Wechselt das Ausgangstheme innerhalb des Theme-Editors.
     */
    public switchThemeEditorSource(themeId: string): void {
        if (!this.active) return;
        if (this.sourceThemeId === themeId) return;

        this.sourceThemeId = themeId;
        this.ensureThemeStage();
        this.host.stageManager.switchStage(this.THEME_STAGE_ID);
        this.renderBanner();
    }

    /**
     * Verlässt den Theme-Editor und wechselt zurück zur vorherigen Stage.
     */
    public exitThemeEditor(): void {
        if (!this.active) return;

        this.hideBanner();

        // Theme-Stage wieder aus dem Projekt entfernen, damit sie nicht persistiert wird.
        this.host.project.stages = (this.host.project.stages || []).filter(s => s.id !== this.THEME_STAGE_ID);

        this.active = false;
        this.sourceThemeId = null;
        this.host.selectObject(null);

        const backId = this.previousStageId || this.host.project.stages[0]?.id;
        this.previousStageId = null;

        if (backId) {
            this.host.switchStage(backId);
        } else {
            this.host.render();
            this.host.updateStagesMenu();
            this.host.updateStageLabel();
        }
    }

    /**
     * Speichert die aktuell bearbeiteten Styles aus der Theme-Stage als neues Theme.
     */
    public async saveThemeAs(): Promise<void> {
        if (!this.active) return;

        const sourceTheme = themeRegistry.getAvailableThemes().find(t => t.id === this.sourceThemeId);
        const defaultName = sourceTheme ? `${sourceTheme.name} (Kopie)` : 'Mein Theme';

        const name = await PromptDialog.show(
            'Name für das neue Theme:',
            defaultName,
            'Theme speichern'
        );

        if (!name) return;

        const stage = (this.host.project.stages || []).find(s => s.id === this.THEME_STAGE_ID);
        if (!stage || !stage.objects) {
            NotificationToast.show('Theme-Stage konnte nicht gefunden werden.', 'error');
            return;
        }

        const id = 'theme-' + name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '');

        const themeDef: ThemeDefinition = {
            id,
            name,
            description: `Vom Theme-Editor erstellt (basierend auf ${sourceTheme?.name || 'unbekannt'}).`,
            components: {}
        };

        stage.objects.forEach((obj: any) => {
            const className = obj.className;
            if (!className) return;
            themeDef.components[className] = JSON.parse(JSON.stringify(obj.style || {}));
        });

        const themeEditorStage = (this.host.project.stages || []).find(s => s.id === this.THEME_STAGE_ID);
        const grid: any = themeEditorStage?.grid || {};
        themeDef.stage = {
            backgroundColor: grid.backgroundColor,
            gridColor: grid.gridColor
        };

        if (!this.host.project.themes) {
            this.host.project.themes = [];
        }
        this.host.project.themes.push(themeDef);
        this.host.project.activeThemeId = id;
        themeRegistry.registerTheme(themeDef);
        themeRegistry.setActiveTheme(id);

        // Theme-Menü neu aufbauen, falls es existiert
        const menuBar = (this.host as any).menuBar;
        if (menuBar && typeof menuBar.updateMenu === 'function') {
            const activeThemeId = themeRegistry.getActiveThemeId();
            const items = themeRegistry.getAvailableThemes().map(t => ({
                id: `theme-${t.id}`,
                label: t.id === activeThemeId ? `✅ ${t.name}` : t.name,
                action: `switch-theme-${t.id}`,
                active: t.id === activeThemeId
            }));
            menuBar.updateMenu('themes', [
                { id: 'open-theme-editor', label: '🎨 Theme-Editor öffnen', action: 'open-theme-editor', icon: '🎨' },
                ...items
            ]);
        }

        // Bearbeitungs-Quelle auf das neue Theme umstellen, damit der Banner aktuell bleibt
        this.sourceThemeId = id;
        this.renderBanner();

        // Theme-Änderung persistieren, damit sie F5 / Seiten-Reload überlebt
        this.host.autoSaveToLocalStorage();

        NotificationToast.show(`Theme "${name}" wurde gespeichert und aktiviert.`, 'success');
    }

    /**
     * Klont ein bestehendes Theme und öffnet es im Theme-Editor.
     */
    public cloneAndEditTheme(themeId: string, newName: string): void {
        const cloned = themeRegistry.cloneTheme(themeId, `theme-${Date.now()}`, newName);
        if (!cloned) {
            NotificationToast.show(`Theme "${themeId}" konnte nicht geklont werden.`, 'error');
            return;
        }
        if (!this.host.project.themes) {
            this.host.project.themes = [];
        }
        this.host.project.themes.push(cloned);
        themeRegistry.registerTheme(cloned);
        this.enterThemeEditor(cloned.id);
    }

    private ensureThemeStage(): void {
        if (!this.host.project.stages) {
            this.host.project.stages = [];
        }
        const sourceTheme = themeRegistry.getAvailableThemes().find(t => t.id === this.sourceThemeId);

        let stage = this.host.project.stages.find(s => s.id === this.THEME_STAGE_ID) as StageDefinition | undefined;
        if (!stage) {
            const baseGrid = this.host.getActiveStage()?.grid || this.host.project.stage?.grid || {
                cols: 64,
                rows: 40,
                cellSize: 20,
                visible: true,
                backgroundColor: '#1e1e2e'
            };
            const themeStage = sourceTheme?.stage
                ? { backgroundColor: sourceTheme.stage.backgroundColor || '#ffffff', gridColor: sourceTheme.stage.gridColor || '#dddddd' }
                : themeRegistry.getStageStyle();
            stage = {
                id: this.THEME_STAGE_ID,
                name: 'Theme Editor',
                type: 'theme-editor' as StageType,
                grid: { ...baseGrid, backgroundColor: themeStage.backgroundColor, gridColor: themeStage.gridColor } as any,
                objects: []
            };
            this.host.project.stages.push(stage);
        }

        stage!.objects = [];

        const classes = themeRegistry.getThemeableComponentClasses();

        const cols = 3;
        const startX = 2;
        const startY = 2;
        const gapX = 12;
        const gapY = 6;

        classes.forEach((className, i) => {
            const col = i % cols;
            const row = Math.floor(i / cols);
            const x = startX + col * gapX;
            const y = startY + row * gapY;

            const typeName = className.replace(/^T/, '');
            const instance = this.host.commandManager.createObjectInstance(typeName, `Theme_${className}`, x, y);
            if (!instance) return;

            const obj: any = instance;
            if (!obj.className) {
                obj.className = className;
            }

            this.setComponentSize(obj, className);

            const compStyle = sourceTheme?.components[className] || {};
            obj.style = JSON.parse(JSON.stringify(compStyle));

            stage!.objects.push(obj);
        });
    }

    private setComponentSize(obj: any, className: string): void {
        const sizes: Record<string, { width: number; height: number }> = {
            'TButton': { width: 6, height: 2 },
            'TPanel': { width: 10, height: 5 },
            'TCard': { width: 8, height: 5 },
            'TLabel': { width: 6, height: 1 },
            'TNumberLabel': { width: 6, height: 1 },
            'TDialogRoot': { width: 12, height: 7 },
            'TSidePanel': { width: 8, height: 10 },
            'TEdit': { width: 6, height: 2 },
            'TTextInput': { width: 6, height: 2 },
            'TStickyNote': { width: 5, height: 3 }
        };
        const size = sizes[className] || { width: 5, height: 2 };
        obj.width = size.width;
        obj.height = size.height;
    }

    private renderBanner(): void {
        this.hideBanner();

        this.bannerEl = document.createElement('div');
        this.bannerEl.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            height: 42px;
            background: linear-gradient(90deg, #7c4dff, #00bcd4);
            color: #fff;
            display: flex;
            align-items: center;
            justify-content: space-between;
            padding: 0 16px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
            font-size: 13px;
            font-weight: 600;
            z-index: 10000;
            box-shadow: 0 2px 8px rgba(0,0,0,0.4);
        `;

        const title = document.createElement('span');
        title.textContent = '🎨 Theme-Editor';

        const actions = document.createElement('div');
        actions.style.display = 'flex';
        actions.style.gap = '10px';
        actions.style.alignItems = 'center';

        const themeSelect = document.createElement('select');
        themeSelect.style.cssText = `
            background: rgba(0,0,0,0.3);
            color: #fff;
            border: 1px solid rgba(255,255,255,0.3);
            border-radius: 4px;
            padding: 4px 8px;
            font-size: 12px;
            font-weight: 600;
            margin-right: 8px;
            cursor: pointer;
        `;
        const currentId = this.sourceThemeId || themeRegistry.getActiveThemeId();
        themeRegistry.getAvailableThemes().forEach(theme => {
            const opt = document.createElement('option');
            opt.value = theme.id;
            opt.textContent = theme.name;
            if (theme.id === currentId) opt.selected = true;
            themeSelect.appendChild(opt);
        });
        themeSelect.onchange = () => this.switchThemeEditorSource(themeSelect.value);

        const saveBtn = document.createElement('button');
        saveBtn.textContent = 'Speichern unter...';
        saveBtn.style.cssText = this.bannerButtonStyle('#00c853');
        saveBtn.onclick = () => this.saveThemeAs();

        const exitBtn = document.createElement('button');
        exitBtn.textContent = 'Schließen';
        exitBtn.style.cssText = this.bannerButtonStyle('#ff5252');
        exitBtn.onclick = () => this.exitThemeEditor();

        actions.appendChild(themeSelect);
        actions.appendChild(saveBtn);
        actions.appendChild(exitBtn);

        this.bannerEl.appendChild(title);
        this.bannerEl.appendChild(actions);
        document.body.appendChild(this.bannerEl);

        // Body etwas nach unten schieben, damit der Banner nichts verdeckt
        document.body.style.paddingTop = '42px';
    }

    private hideBanner(): void {
        if (this.bannerEl && this.bannerEl.parentElement) {
            this.bannerEl.parentElement.removeChild(this.bannerEl);
        }
        this.bannerEl = null;
        document.body.style.paddingTop = '';
    }

    private bannerButtonStyle(color: string): string {
        return `
            background: ${color};
            color: #fff;
            border: none;
            border-radius: 4px;
            padding: 6px 12px;
            font-size: 12px;
            font-weight: 600;
            cursor: pointer;
            box-shadow: 0 2px 4px rgba(0,0,0,0.3);
        `;
    }
}
