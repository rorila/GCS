import type { IViewHost } from '../EditorViewManager';
import { Logger } from '../../utils/Logger';
import { NotificationToast } from '../ui/NotificationToast';

/**
 * StageDialogs - Wizard-Dialoge für Stage- und Projekt-Konfiguration.
 *
 * Extrahiert aus EditorViewManager für bessere Wartbarkeit.
 * Enthält:
 * - showAddStageDialog()           (5-Schritte Wizard)
 * - showConfigureProjectDialog()   (6-Schritte Wizard)
 * - showEditProjectPropertiesDialog()
 */
export class StageDialogs {
    private host: IViewHost;

    private static readonly LOGGER = Logger.get('StageDialogs', 'Editor_Diagnostics');

    constructor(host: IViewHost) {
        this.host = host;
    }

    // ═══════════════════════════════════════════════════════════
    // MODAL HELPER
    // ═══════════════════════════════════════════════════════════

    public ensureModal(): HTMLElement {
        let modal = document.getElementById('userstories-edit-modal');
        if (!modal) {
            StageDialogs.LOGGER.info('[Wizard] ensureModal: erzeuge fehlendes Modal-Element in document.body');
            modal = document.createElement('div');
            modal.id = 'userstories-edit-modal';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }
        return modal;
    }

    // ═══════════════════════════════════════════════════════════
    // showAddStageDialog (5-Schritte Wizard)
    // ═══════════════════════════════════════════════════════════

    public showAddStageDialog(onComplete?: (data: any) => void) {
        StageDialogs.LOGGER.info('[Wizard] showAddStageDialog aufgerufen, hasCallback=' + !!onComplete);
        const modal = this.ensureModal();

        const WIZARD_STEPS = 5;
        let wizardStep = 1;

        const sData: any = {
            stageId: '',
            stageName: '',
            purposeType: '',
            purposeOther: '',
            controls: [] as string[],
            objects:  [] as string[],
            exitType: '',
        };

        const inputStyle   = 'width:100%;padding:8px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;font-size:14px;';
        const labelStyle   = 'display:block;font-size:13px;margin-bottom:5px;color:#c0c8e0;font-weight:bold;';
        const sectionStyle = 'background:#12122a;border:1px solid #2a2a5a;border-radius:8px;padding:18px;margin-bottom:14px;';
        const tileBase     = 'display:inline-flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 8px;border:2px solid #2a2a5a;border-radius:8px;cursor:pointer;background:#0a1020;min-width:110px;min-height:80px;font-size:11px;text-align:center;white-space:pre-line;color:#c0c8e0;gap:6px;';
        const tileSelected = 'border-color:#1976d2;background:#0a1a3a;color:#fff;';

        const renderProgress = () => {
            const steps = ['Name & Zweck', 'Steuerung', 'Objekte', 'Übergänge', 'Ergebnis'];
            return `<div style="display:flex;gap:4px;margin-bottom:18px;">
                ${steps.map((s, i) => {
                    const num = i + 1;
                    const active = num === wizardStep;
                    const done   = num < wizardStep;
                    const bg     = done ? '#1565c0' : active ? '#0d2a4a' : '#1a1a3a';
                    const col    = done || active ? '#fff' : '#6060a0';
                    const border = active ? '2px solid #60a0ff' : '2px solid transparent';
                    return `<div style="flex:1;padding:6px 4px;border-radius:6px;text-align:center;background:${bg};color:${col};font-size:11px;font-weight:bold;border:${border};">
                        ${done ? '✓' : num}. ${s}
                    </div>`;
                }).join('')}
            </div>`;
        };

        const renderStep = (): string => {
            if (wizardStep === 1) {
                const purposes = [
                    { id: 'menu',       icon: '🏠', label: 'Startmenü /\nTitelbildschirm' },
                    { id: 'gameplay',   icon: '🎮', label: 'Haupt-\nSpielfeld' },
                    { id: 'transition', icon: '🔄', label: 'Level-Übergang /\nLadescreen' },
                    { id: 'gameover',   icon: '🏆', label: 'Game Over /\nErgebnis' },
                    { id: 'settings',   icon: '⚙️', label: 'Einstellungen' },
                    { id: 'other',      icon: '❓', label: 'Etwas\nanderes' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">📋 Was ist diese Stage?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${purposes.map(p => `
                            <div class="stage-tile" data-field="purposeType" data-val="${p.id}"
                                style="${tileBase}${sData.purposeType===p.id?tileSelected:''}">
                                <span style="font-size:26px;">${p.icon}</span>
                                <span>${p.label}</span>
                            </div>`).join('')}
                    </div>
                    ${sData.purposeType === 'other' ? `
                    <div style="margin-top:12px;">
                        <label style="${labelStyle}">Beschreibe den Zweck:</label>
                        <input id="stage-purpose-other" type="text" placeholder="z.B. Charakterauswahl, Cutscene..."
                            style="${inputStyle}" value="${sData.purposeOther}">
                    </div>` : ''}
                    <div style="display:flex;gap:10px;margin-top:14px;">
                        <div style="flex:1;">
                            <label style="${labelStyle}">Stage-ID (technisch)</label>
                            <input id="stage-id-input" type="text" placeholder="z.B. stage_main"
                                style="${inputStyle}" value="${sData.stageId}">
                        </div>
                        <div style="flex:1;">
                            <label style="${labelStyle}">Stage-Name (Anzeige)</label>
                            <input id="stage-name-input" type="text" placeholder="z.B. Hauptspiel"
                                style="${inputStyle}" value="${sData.stageName}">
                        </div>
                    </div>
                </div>`;
            }

            if (wizardStep === 2) {
                const controls = [
                    { id: 'keyboard', icon: '⌨️',  label: 'Tastatur' },
                    { id: 'mouse',    icon: '🖱️',  label: 'Maus /\nPC-Klicks' },
                    { id: 'touch',    icon: '📱',  label: 'Touch /\nMobil' },
                    { id: 'auto',     icon: '🤖',  label: 'Nur\nautomatisch' },
                ];
                const needsInput   = sData.controls.includes('keyboard') || sData.controls.includes('mouse');
                const needsGamepad = sData.controls.includes('touch');
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">🕹️ Wie wird auf dieser Stage gesteuert? <span style="font-weight:normal;color:#8080b0;">(Mehrfachauswahl)</span></label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${controls.map(c => {
                            const sel = sData.controls.includes(c.id);
                            return `<div class="stage-ctrl-tile" data-ctrl="${c.id}"
                                style="${tileBase}${sel?tileSelected:''}">
                                <span style="font-size:26px;">${c.icon}</span>
                                <span>${c.label}</span>
                            </div>`;
                        }).join('')}
                    </div>
                    ${needsInput ? `<div style="margin-top:12px;padding:10px;background:#0a1a3a;border-radius:6px;border:1px solid #1976d2;"><span style="color:#60a0ff;font-size:12px;">ℹ️ Tastatur/Maus → <b>TInputController</b> wird in dieser Stage benötigt.</span></div>` : ''}
                    ${needsGamepad ? `<div style="margin-top:8px;padding:10px;background:#0a1a3a;border-radius:6px;border:1px solid #1976d2;"><span style="color:#60a0ff;font-size:12px;">ℹ️ Touch/Mobil → <b>TVirtualGamepad</b> wird in dieser Stage benötigt.</span></div>` : ''}
                </div>`;
            }

            if (wizardStep === 3) {
                const objects = [
                    { id: 'player',     icon: '🏃', label: 'Spieler-\nSprite(s)' },
                    { id: 'enemies',    icon: '👾', label: 'Gegner /\nHindernisse' },
                    { id: 'score',      icon: '🏆', label: 'Punkte-\nAnzeige' },
                    { id: 'lives',      icon: '❤️', label: 'Leben-\nAnzeige' },
                    { id: 'timer',      icon: '⏱️', label: 'Timer-\nAnzeige' },
                    { id: 'buttons',    icon: '🔘', label: 'Buttons\n(Start, Weiter...)' },
                    { id: 'background', icon: '🖼️', label: 'Hintergrund' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">🧩 Was soll auf der Stage sein? <span style="font-weight:normal;color:#8080b0;">(Mehrfachauswahl)</span></label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${objects.map(o => {
                            const sel = sData.objects.includes(o.id);
                            return `<div class="stage-obj-tile" data-obj="${o.id}"
                                style="${tileBase}${sel?tileSelected:''}">
                                <span style="font-size:26px;">${o.icon}</span>
                                <span>${o.label}</span>
                            </div>`;
                        }).join('')}
                    </div>
                </div>`;
            }

            if (wizardStep === 4) {
                const exits = [
                    { id: 'button',    icon: '🖱️', label: 'Button-Klick\n→ nächste Stage' },
                    { id: 'timer',     icon: '⏱️', label: 'Zeitlimit\n(TTimer)' },
                    { id: 'condition', icon: '🎯', label: 'Bedingung\nerfüllt' },
                    { id: 'restart',   icon: '🔁', label: 'Neustart /\nGame Over' },
                    { id: 'none',      icon: '—',  label: 'Gar nicht\n(Endscreen)' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">🚪 Wie verlässt der Spieler diese Stage?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${exits.map(e => `
                            <div class="stage-tile" data-field="exitType" data-val="${e.id}"
                                style="${tileBase}${sData.exitType===e.id?tileSelected:''}">
                                <span style="font-size:26px;">${e.icon}</span>
                                <span>${e.label}</span>
                            </div>`).join('')}
                    </div>
                </div>`;
            }

            if (wizardStep === 5) {
                const comps: { icon: string; name: string; reason: string; code: string }[] = [];
                const sid   = sData.stageId   || 'stage_neu';
                const sname = sData.stageName || 'Neue Stage';

                comps.push({ icon: '📋', name: `Stage "${sname}"`, reason: `ID: ${sid}`,
                    code: `agentController.createStage('${sid}', '${sname}');` });
                if (sData.controls.includes('keyboard') || sData.controls.includes('mouse'))
                    comps.push({ icon: '⌨️', name: 'TInputController', reason: 'Tastatur / Maus',
                        code: `agentController.addObject('${sid}', { className: 'TInputController', name: 'InputController', x: 0, y: 0, width: 2, height: 2, visible: false });` });
                if (sData.controls.includes('touch'))
                    comps.push({ icon: '📱', name: 'TVirtualGamepad', reason: 'Touch / Mobil',
                        code: `agentController.addObject('${sid}', { className: 'TVirtualGamepad', name: 'VirtualGamepad', x: 0, y: 0, width: 10, height: 4, visible: true });` });
                if (sData.objects.includes('player'))
                    comps.push({ icon: '🏃', name: 'TSprite (Spieler)', reason: 'Spieler-Sprite',
                        code: `agentController.createSprite('${sid}', 'Player', 30, 20, 3, 3, { collisionEnabled: true, collisionGroup: 'player', spriteColor: '#4ecdc4' });` });
                if (sData.objects.includes('enemies'))
                    comps.push({ icon: '👾', name: 'TSprite (Gegner)', reason: 'Gegner / Hindernisse',
                        code: `agentController.createSprite('${sid}', 'Enemy', 10, 5, 3, 3, { collisionEnabled: true, collisionGroup: 'enemy', spriteColor: '#e74c3c' });` });
                if (sData.objects.includes('score'))
                    comps.push({ icon: '🏆', name: 'TLabel (Punkte)', reason: 'Punkte-Anzeige',
                        code: `agentController.createLabel('${sid}', 'ScoreLabel', 1, 1, '\${score}', { fontSize: 20, color: '#ffffff' });` });
                if (sData.objects.includes('lives'))
                    comps.push({ icon: '❤️', name: 'TLabel (Leben)', reason: 'Leben-Anzeige',
                        code: `agentController.createLabel('${sid}', 'LivesLabel', 50, 1, '\${lives}', { fontSize: 20, color: '#e74c3c' });` });
                if (sData.objects.includes('timer') || sData.exitType === 'timer')
                    comps.push({ icon: '⏱️', name: 'TTimer', reason: 'Timer / Zeitlimit',
                        code: `agentController.addObject('${sid}', { className: 'TTimer', name: 'StageTimer', x: 0, y: 0, width: 2, height: 2, visible: false, interval: 1000, autoStart: true });` });
                if (sData.objects.includes('buttons'))
                    comps.push({ icon: '🔘', name: 'TButton', reason: 'Button',
                        code: `agentController.addObject('${sid}', { className: 'TButton', name: 'ActionButton', x: 20, y: 30, width: 12, height: 3, caption: 'Start', visible: true });` });
                if (sData.objects.includes('background'))
                    comps.push({ icon: '🖼️', name: 'TPanel (Hintergrund)', reason: 'Hintergrund',
                        code: `agentController.addObject('${sid}', { className: 'TPanel', name: 'Background', x: 0, y: 0, width: 64, height: 40, visible: true, style: { backgroundColor: '#1a1a2e' } });` });

                const codeLines = comps.map(c => c.code).join('\n');
                const purposeLabel: Record<string,string> = { menu:'Startmenü', gameplay:'Spielfeld', transition:'Übergang', gameover:'Game Over', settings:'Einstellungen', other: sData.purposeOther||'Eigener Zweck' };

                return `<div style="${sectionStyle}">
                    <div style="font-size:17px;font-weight:bold;color:#fff;margin-bottom:14px;">🎉 Stage ist konfiguriert!</div>
                    <div style="display:flex;gap:14px;">
                        <div style="flex:1;">
                            <div style="display:flex;flex-direction:column;gap:6px;">
                                ${[
                                    { icon:'📋', label:'Stage',     val: `${sname} (${sid})` },
                                    { icon:'🎯', label:'Zweck',     val: purposeLabel[sData.purposeType]||'—' },
                                    { icon:'🕹️', label:'Steuerung', val: sData.controls.join(', ')||'(keine)' },
                                    { icon:'🧩', label:'Objekte',   val: sData.objects.join(', ')||'(keine)' },
                                ].map(r => `<div style="display:flex;align-items:center;gap:10px;background:#0a1020;border-radius:6px;padding:7px 12px;">
                                    <span style="font-size:16px;">${r.icon}</span>
                                    <span style="color:#8090b0;font-size:11px;min-width:65px;">${r.label}</span>
                                    <span style="color:#e0e0ff;font-size:12px;font-weight:bold;">${r.val}</span>
                                </div>`).join('')}
                            </div>
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <span style="color:#60a0ff;font-size:11px;font-weight:bold;text-transform:uppercase;">AgentController-Code</span>
                                <button id="stage-copy-prompt" style="padding:3px 10px;background:#1565c0;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">📋 Kopieren</button>
                            </div>
                            <pre id="stage-prompt-text" style="background:#0a0a1a;border:1px solid #1a3a7a;border-radius:6px;padding:12px;color:#d0d0ff;font-size:11px;white-space:pre-wrap;margin:0;line-height:1.5;max-height:300px;overflow-y:auto;">${codeLines}</pre>
                        </div>
                    </div>
                </div>`;
            }
            return '';
        };

        const renderDialog = () => {
            modal.style.display = 'block';
            modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;">
                <div style="background:#1a1a2e;border:1px solid #3a3a6a;border-radius:10px;padding:28px;width:720px;color:#e0e0e0;margin:auto;">
                    <div style="margin-bottom:16px;">
                        <h3 style="margin:0 0 4px 0;color:#fff;font-size:17px;">📋 Stage hinzufügen</h3>
                        <div style="color:#60a0e0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Neue Stage konfigurieren</div>
                    </div>
                    ${renderProgress()}
                    <div id="stage-content">${renderStep()}</div>
                    <div style="display:flex;justify-content:space-between;margin-top:16px;">
                        <button id="stage-cancel" style="padding:7px 18px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Abbrechen</button>
                        <div style="display:flex;gap:8px;">
                            ${wizardStep > 1 ? `<button id="stage-back" style="padding:7px 18px;background:#1a2a4a;color:#c0c8e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;">◀ Zurück</button>` : ''}
                            ${wizardStep < WIZARD_STEPS
                                ? `<button id="stage-next" style="padding:7px 20px;background:#1565c0;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">Weiter ▶</button>`
                                : `<button id="stage-save" style="padding:7px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">✓ Fertig</button>`}
                        </div>
                    </div>
                </div>
            </div>`;

            document.getElementById('stage-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; onComplete?.(null); });
            document.getElementById('stage-save')?.addEventListener('click',   () => { modal.style.display = 'none'; modal.innerHTML = ''; onComplete?.(sData); });
            document.getElementById('stage-back')?.addEventListener('click',   () => { wizardStep--; renderDialog(); });
            document.getElementById('stage-next')?.addEventListener('click',   () => {
                if (wizardStep === 1) {
                    sData.purposeOther = (document.getElementById('stage-purpose-other') as HTMLInputElement)?.value || '';
                    sData.stageId      = (document.getElementById('stage-id-input')       as HTMLInputElement)?.value || '';
                    sData.stageName    = (document.getElementById('stage-name-input')     as HTMLInputElement)?.value || '';
                }
                wizardStep++;
                renderDialog();
            });
            document.getElementById('stage-copy-prompt')?.addEventListener('click', () => {
                const text = (document.getElementById('stage-prompt-text') as HTMLElement)?.innerText || '';
                navigator.clipboard.writeText(text).catch(() => {});
            });
            document.querySelectorAll('.stage-tile').forEach(tile => {
                tile.addEventListener('click', () => {
                    const field = (tile as HTMLElement).dataset.field!;
                    const val   = (tile as HTMLElement).dataset.val!;
                    sData[field] = val;
                    renderDialog();
                });
            });
            document.querySelectorAll('.stage-ctrl-tile').forEach(tile => {
                tile.addEventListener('click', () => {
                    const ctrl = (tile as HTMLElement).dataset.ctrl!;
                    const idx  = sData.controls.indexOf(ctrl);
                    if (idx >= 0) sData.controls.splice(idx, 1); else sData.controls.push(ctrl);
                    renderDialog();
                });
            });
            document.querySelectorAll('.stage-obj-tile').forEach(tile => {
                tile.addEventListener('click', () => {
                    const obj = (tile as HTMLElement).dataset.obj!;
                    const idx = sData.objects.indexOf(obj);
                    if (idx >= 0) sData.objects.splice(idx, 1); else sData.objects.push(obj);
                    renderDialog();
                });
            });
        };

        renderDialog();
    }

    // ═══════════════════════════════════════════════════════════
    // showConfigureProjectDialog (6-Schritte Wizard)
    // ═══════════════════════════════════════════════════════════

    public showConfigureProjectDialog(onComplete?: (data: any) => void) {
        StageDialogs.LOGGER.info('[Wizard] showConfigureProjectDialog aufgerufen, hasCallback=' + !!onComplete);
        const modal = this.ensureModal();

        const WIZARD_STEPS = 6;
        let wizardStep = 1;

        const pData: any = {
            projectName: '', author: '', description: '', gameType: '',
            players: '', networkPlay: false, stageCount: '', features: [] as string[],
        };

        const inputStyle   = 'width:100%;padding:8px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;font-size:14px;';
        const labelStyle   = 'display:block;font-size:13px;margin-bottom:5px;color:#c0c8e0;font-weight:bold;';
        const sectionStyle = 'background:#12122a;border:1px solid #2a2a5a;border-radius:8px;padding:18px;margin-bottom:14px;';
        const tileBase     = 'display:inline-flex;flex-direction:column;align-items:center;justify-content:center;padding:12px 8px;border:2px solid #2a2a5a;border-radius:8px;cursor:pointer;background:#0a1020;min-width:110px;min-height:80px;font-size:11px;text-align:center;white-space:pre-line;color:#c0c8e0;gap:6px;transition:border-color 0.15s;';
        const tileSelected = 'border-color:#7b1fa2;background:#1a0a2a;color:#fff;';

        const renderProgress = () => {
            const steps = ['Projekt', 'Spielart', 'Spieler', 'Struktur', 'Features', 'Ergebnis'];
            return `<div style="display:flex;gap:4px;margin-bottom:18px;">
                ${steps.map((s, i) => {
                    const num = i + 1;
                    const active = num === wizardStep;
                    const done   = num < wizardStep;
                    const bg     = done ? '#7b1fa2' : active ? '#4a1a7a' : '#1a1a3a';
                    const col    = done || active ? '#fff' : '#6060a0';
                    const border = active ? '2px solid #c060ff' : '2px solid transparent';
                    return `<div style="flex:1;padding:6px 4px;border-radius:6px;text-align:center;background:${bg};color:${col};font-size:11px;font-weight:bold;border:${border};">${done ? '✓' : num}. ${s}</div>`;
                }).join('')}
            </div>`;
        };

        const renderStep = (): string => {
            if (wizardStep === 1) {
                const safeFileName = pData.projectName
                    ? pData.projectName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_')
                    : 'Mein_Spiel';
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">📁 Projektname *</label>
                    <input id="proj-name" type="text" placeholder="z.B. Mein cooles Spiel" maxlength="50" style="${inputStyle}" value="${pData.projectName||''}">
                    <div style="font-size:11px;color:#8080b0;margin-top:4px;">Datei: projects/<span id="proj-filename-preview" style="color:#c080ff;">${safeFileName}</span>.json</div>
                </div>
                <div style="${sectionStyle}">
                    <label style="${labelStyle}">👤 Autor</label>
                    <input id="proj-author" type="text" placeholder="Dein Name" style="${inputStyle}" value="${pData.author||''}">
                </div>
                <div style="${sectionStyle}">
                    <label style="${labelStyle}">📝 Beschreibung</label>
                    <textarea id="proj-desc" placeholder="Kurze Beschreibung des Spiels..." rows="3" style="${inputStyle};resize:vertical;min-height:60px;">${pData.description||''}</textarea>
                </div>`;
            }
            if (wizardStep === 2) {
                const types = [
                    { id: 'arcade', icon: '🕹️', label: 'Arcade /\nAction' },
                    { id: 'puzzle', icon: '🧩', label: 'Rätsel /\nPuzzle' },
                    { id: 'quiz',   icon: '📝', label: 'Quiz /\nLernspiel' },
                    { id: 'story',  icon: '📖', label: 'Story /\nAbenteuer' },
                    { id: 'other',  icon: '❓', label: 'Etwas\nanderes' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">🎮 Was für ein Spiel wird es?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${types.map(t => `<div class="proj-tile" data-field="gameType" data-val="${t.id}" style="${tileBase}${pData.gameType===t.id?tileSelected:''}"><span style="font-size:26px;">${t.icon}</span><span>${t.label}</span></div>`).join('')}
                    </div>
                    ${pData.gameType === 'other' ? `<div style="margin-top:12px;"><label style="${labelStyle}">Beschreibe das Spiel:</label><input id="proj-gametype-other" type="text" placeholder="z.B. Simulation, Rennsport..." style="${inputStyle}" value="${pData.gameTypeOther||''}"></div>` : ''}
                </div>`;
            }
            if (wizardStep === 3) {
                const options = [
                    { id: '1',      icon: '🧑', label: '1 Spieler' },
                    { id: '2local', icon: '👥', label: '2 Spieler\nam selben Gerät' },
                    { id: '2net',   icon: '🌐', label: '2 Spieler\nüber Netz' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">👥 Wie viele Spieler?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${options.map(o => `<div class="proj-tile" data-field="players" data-val="${o.id}" style="${tileBase}${pData.players===o.id?tileSelected:''}"><span style="font-size:26px;">${o.icon}</span><span>${o.label}</span></div>`).join('')}
                    </div>
                    ${pData.players === '2net' ? `<div style="margin-top:12px;padding:10px;background:#1a0a2a;border-radius:6px;border:1px solid #7b1fa2;"><span style="color:#c080ff;font-size:12px;">ℹ️ Netzwerkspiel → <b>TGameServer</b> wird in der Blueprint-Stage benötigt.</span></div>` : ''}
                </div>`;
            }
            if (wizardStep === 4) {
                const options = [
                    { id: 'single', icon: '1️⃣', label: 'Eine Stage\n(einfach)' },
                    { id: 'multi',  icon: '📚', label: 'Mehrere Stages\n/ Level' },
                    { id: 'menu',   icon: '🏠', label: 'Startmenü +\nmehrere Stages' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">📐 Wie ist das Spiel aufgebaut?</label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${options.map(o => `<div class="proj-tile" data-field="stageCount" data-val="${o.id}" style="${tileBase}${pData.stageCount===o.id?tileSelected:''}"><span style="font-size:26px;">${o.icon}</span><span>${o.label}</span></div>`).join('')}
                    </div>
                    ${pData.stageCount !== '' && pData.stageCount !== 'single' ? `<div style="margin-top:12px;padding:10px;background:#1a0a2a;border-radius:6px;border:1px solid #7b1fa2;"><span style="color:#c080ff;font-size:12px;">ℹ️ Mehrere Stages → <b>TStageController</b> wird in der Blueprint-Stage benötigt.</span></div>` : ''}
                </div>`;
            }
            if (wizardStep === 5) {
                const features = [
                    { id: 'score', icon: '🏆', label: 'Punkte /\nScore' },
                    { id: 'audio', icon: '🔊', label: 'Töne /\nMusik' },
                    { id: 'save',  icon: '💾', label: 'Daten\nspeichern' },
                    { id: 'timer', icon: '⏱️', label: 'Zeitsteuerung\n/ Timer' },
                    { id: 'lives', icon: '❤️', label: 'Leben /\nVersuche' },
                ];
                return `<div style="${sectionStyle}">
                    <label style="${labelStyle}">⚙️ Was braucht das Spiel? <span style="font-weight:normal;color:#8080b0;">(Mehrfachauswahl)</span></label>
                    <div style="display:flex;flex-wrap:wrap;gap:10px;margin-top:8px;">
                        ${features.map(f => { const sel = pData.features.includes(f.id); return `<div class="proj-feature-tile" data-feat="${f.id}" style="${tileBase}${sel?tileSelected:''}"><span style="font-size:26px;">${f.icon}</span><span>${f.label}</span></div>`; }).join('')}
                    </div>
                </div>`;
            }
            if (wizardStep === 6) {
                const bComps: { icon: string; name: string; reason: string; code: string }[] = [];
                if (pData.players === '2net')
                    bComps.push({ icon: '🌐', name: 'TGameServer', reason: 'Netzwerk-Multiplayer', code: `agentController.addObject('stage_blueprint', { className: 'TGameServer', name: 'GameServer', x: 0, y: 0, width: 2, height: 2, visible: false });` });
                if (pData.stageCount === 'multi' || pData.stageCount === 'menu')
                    bComps.push({ icon: '📚', name: 'TStageController', reason: 'Mehrere Stages', code: `agentController.addObject('stage_blueprint', { className: 'TStageController', name: 'StageController', x: 0, y: 0, width: 2, height: 2, visible: false });` });
                if (pData.features.includes('score'))
                    bComps.push({ icon: '🏆', name: 'score (Variable)', reason: 'Punkte-System', code: `agentController.addVariable('score', 'number', 0, 'global');` });
                if (pData.features.includes('lives'))
                    bComps.push({ icon: '❤️', name: 'lives (Variable)', reason: 'Leben / Versuche', code: `agentController.addVariable('lives', 'number', 3, 'global');` });
                if (pData.features.includes('audio'))
                    bComps.push({ icon: '🔊', name: 'TAudio', reason: 'Töne / Musik', code: `agentController.addObject('stage_blueprint', { className: 'TAudio', name: 'GameAudio', x: 0, y: 0, width: 2, height: 2, visible: false, src: '' });` });

                const codeLines = bComps.length > 0 ? bComps.map(c => c.code).join('\n') : '// Keine Blueprint-Komponenten nötig.';
                return `<div style="${sectionStyle}">
                    <div style="font-size:17px;font-weight:bold;color:#fff;margin-bottom:14px;">🎉 Dein Projekt ist konfiguriert!</div>
                    <div style="flex:1;">
                        <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                            <span style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;">AgentController-Code</span>
                            <button id="proj-copy-prompt" style="padding:3px 10px;background:#7b1fa2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">📋 Kopieren</button>
                        </div>
                        <pre id="proj-prompt-text" style="background:#0a0a1a;border:1px solid #4a3a7a;border-radius:6px;padding:12px;color:#d0d0ff;font-size:11px;white-space:pre-wrap;margin:0;line-height:1.5;max-height:300px;overflow-y:auto;">${codeLines}</pre>
                    </div>
                </div>`;
            }
            return '';
        };

        const renderDialog = () => {
            modal.style.display = 'block';
            modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;">
                <div style="background:#1a1a2e;border:1px solid #3a3a6a;border-radius:10px;padding:28px;width:720px;color:#e0e0e0;margin:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 4px 0;color:#fff;font-size:17px;">🧙 Projekt konfigurieren</h3>
                            <div style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Blueprint-Komponenten ermitteln</div>
                        </div>
                    </div>
                    ${renderProgress()}
                    <div id="proj-content">${renderStep()}</div>
                    <div style="display:flex;justify-content:space-between;margin-top:16px;">
                        <button id="proj-cancel" style="padding:7px 18px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Abbrechen</button>
                        <div style="display:flex;gap:8px;">
                            ${wizardStep > 1 ? `<button id="proj-back" style="padding:7px 18px;background:#1a2a4a;color:#c0c8e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;">◀ Zurück</button>` : ''}
                            ${wizardStep < WIZARD_STEPS
                                ? `<button id="proj-next" style="padding:7px 20px;background:#7b1fa2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">Weiter ▶</button>`
                                : `<button id="proj-save" style="padding:7px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">✓ Fertig</button>`}
                        </div>
                    </div>
                </div>
            </div>`;

            document.getElementById('proj-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; onComplete?.(null); });
            document.getElementById('proj-save')?.addEventListener('click',   () => { modal.style.display = 'none'; modal.innerHTML = ''; onComplete?.(pData); });
            document.getElementById('proj-back')?.addEventListener('click',   () => { wizardStep--; renderDialog(); });
            document.getElementById('proj-next')?.addEventListener('click',   () => {
                if (wizardStep === 1) {
                    pData.projectName = (document.getElementById('proj-name')   as HTMLInputElement)?.value?.trim() || '';
                    pData.author      = (document.getElementById('proj-author') as HTMLInputElement)?.value?.trim() || '';
                    pData.description = (document.getElementById('proj-desc')   as HTMLTextAreaElement)?.value?.trim() || '';
                    if (!pData.projectName) {
                        const ni = document.getElementById('proj-name') as HTMLInputElement;
                        if (ni) { ni.style.borderColor = '#ff4444'; ni.placeholder = 'Bitte Projektname eingeben!'; ni.focus(); }
                        return;
                    }
                }
                if (wizardStep === 2) pData.gameTypeOther = (document.getElementById('proj-gametype-other') as HTMLInputElement)?.value || '';
                wizardStep++; renderDialog();
            });
            if (wizardStep === 1) {
                const nameInput  = document.getElementById('proj-name') as HTMLInputElement;
                const previewSpan = document.getElementById('proj-filename-preview');
                if (nameInput && previewSpan) {
                    nameInput.addEventListener('input', () => {
                        previewSpan.textContent = nameInput.value.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_') || 'Mein_Spiel';
                        nameInput.style.borderColor = '#3a3a6a';
                    });
                }
            }
            document.getElementById('proj-copy-prompt')?.addEventListener('click', () => {
                const text = (document.getElementById('proj-prompt-text') as HTMLElement)?.innerText || '';
                navigator.clipboard.writeText(text).catch(() => {});
            });
            document.querySelectorAll('.proj-tile').forEach(tile => {
                tile.addEventListener('click', () => { const field = (tile as HTMLElement).dataset.field!; pData[field] = (tile as HTMLElement).dataset.val!; renderDialog(); });
            });
            document.querySelectorAll('.proj-feature-tile').forEach(tile => {
                tile.addEventListener('click', () => {
                    const feat = (tile as HTMLElement).dataset.feat!;
                    const idx  = pData.features.indexOf(feat);
                    if (idx >= 0) pData.features.splice(idx, 1); else pData.features.push(feat);
                    renderDialog();
                });
            });
        };

        renderDialog();
    }

    // ═══════════════════════════════════════════════════════════
    // showEditProjectPropertiesDialog
    // ═══════════════════════════════════════════════════════════

    public showEditProjectPropertiesDialog() {
        StageDialogs.LOGGER.info('[ProjectProperties] Dialog geöffnet');
        const modal   = this.ensureModal();
        const project = this.host.project;
        const meta    = project.meta || {};

        const inputStyle   = 'width:100%;padding:8px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;font-size:14px;';
        const labelStyle   = 'display:block;font-size:13px;margin-bottom:5px;color:#c0c8e0;font-weight:bold;';
        const sectionStyle = 'background:#12122a;border:1px solid #2a2a5a;border-radius:8px;padding:18px;margin-bottom:14px;';
        const safeFileName = (meta.name || 'Mein_Spiel').replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_');

        modal.style.display = 'block';
        modal.innerHTML = `
        <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;">
            <div style="background:#1a1a2e;border:1px solid #3a3a6a;border-radius:10px;padding:28px;width:560px;color:#e0e0e0;margin:auto;">
                <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                    <div>
                        <h3 style="margin:0 0 4px 0;color:#fff;font-size:17px;">📁 Projekteigenschaften</h3>
                        <div style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Metadaten bearbeiten</div>
                    </div>
                </div>
                <div style="${sectionStyle}">
                    <label style="${labelStyle}">Spielname / Projektname *</label>
                    <input id="edit-proj-name" type="text" placeholder="z.B. Mein cooles Spiel" maxlength="50" style="${inputStyle}" value="${meta.name || ''}">
                    <div style="font-size:11px;color:#8080b0;margin-top:4px;">Datei: projects/<span id="edit-proj-filename-preview" style="color:#c080ff;">${safeFileName}</span>.json</div>
                </div>
                <div style="${sectionStyle}">
                    <label style="${labelStyle}">👤 Autor</label>
                    <input id="edit-proj-author" type="text" placeholder="Dein Name" style="${inputStyle}" value="${meta.author || ''}">
                </div>
                <div style="${sectionStyle}">
                    <label style="${labelStyle}">📝 Beschreibung</label>
                    <textarea id="edit-proj-desc" placeholder="Kurze Beschreibung des Spiels..." rows="4" style="${inputStyle};resize:vertical;min-height:80px;">${meta.description || ''}</textarea>
                </div>
                <div style="${sectionStyle}">
                    <label style="${labelStyle}">🔢 Version</label>
                    <input id="edit-proj-version" type="text" readonly style="${inputStyle};background:#0a1020;color:#8080b0;cursor:not-allowed;" value="${meta.version || '1.0.0'}">
                    <div style="font-size:11px;color:#606060;margin-top:4px;">Version wird automatisch verwaltet</div>
                </div>
                <div style="display:flex;justify-content:space-between;margin-top:20px;">
                    <button id="edit-proj-cancel" style="padding:7px 18px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Abbrechen</button>
                    <button id="edit-proj-save" style="padding:7px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">💾 Speichern</button>
                </div>
            </div>
        </div>`;

        const nameInput   = document.getElementById('edit-proj-name') as HTMLInputElement;
        const previewSpan = document.getElementById('edit-proj-filename-preview');
        if (nameInput && previewSpan) {
            nameInput.addEventListener('input', () => {
                previewSpan.textContent = nameInput.value.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_') || 'Mein_Spiel';
                nameInput.style.borderColor = '#3a3a6a';
            });
        }

        document.getElementById('edit-proj-cancel')?.addEventListener('click', () => { modal.style.display = 'none'; modal.innerHTML = ''; });
        document.getElementById('edit-proj-save')?.addEventListener('click', () => {
            const newName   = (document.getElementById('edit-proj-name')   as HTMLInputElement)?.value?.trim();
            const newAuthor = (document.getElementById('edit-proj-author') as HTMLInputElement)?.value?.trim();
            const newDesc   = (document.getElementById('edit-proj-desc')   as HTMLTextAreaElement)?.value?.trim();
            if (!newName) { if (nameInput) { nameInput.style.borderColor = '#ff4444'; nameInput.focus(); } return; }
            if (!project.meta) (project as any).meta = {};
            project.meta.name        = newName;
            project.meta.author      = newAuthor;
            project.meta.description = newDesc;
            project.meta._sourcePath = `projects/${newName.replace(/[^a-zA-Z0-9_\-äöüÄÖÜß ]/g, '').trim().replace(/\s+/g, '_')}.json`;
            this.host.autoSaveToLocalStorage();
            NotificationToast.show('Projekteigenschaften gespeichert!', 'success');
            modal.style.display = 'none';
            modal.innerHTML = '';
            StageDialogs.LOGGER.info('[ProjectProperties] Gespeichert:', { name: newName, author: newAuthor });
        });
    }
}
