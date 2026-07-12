import type { IViewHost } from '../EditorViewManager';
import { Logger } from '../../utils/Logger';

/**
 * UseCaseDialog - Wizard-Dialog zum Hinzufügen von UseCases.
 *
 * Extrahiert aus EditorViewManager für bessere Wartbarkeit.
 * Enthält:
 * - showAddUseCaseDialog()   (6-Schritte Wizard + Experten-Modus)
 */
export class UseCaseDialog {
    private host: IViewHost;

    private static readonly LOGGER = Logger.get('UseCaseDialog', 'Editor_Diagnostics');

    /** Default-Parameter fuer eine Action anhand des Action-Typs erzeugen. */
    private static getDefaultActionParams(actionType: string, compName: string): Record<string, any> {
        const target = compName || 'Objekt';
        const map: Record<string, Record<string, any>> = {
            spawn_object: { target: 'TemplateName', x: 0, y: 0 },
            destroy_object: { target: compName || 'ObjektName' },
            set_variable: { variableName: 'MeineVariable', value: '0' },
            navigate_stage: { stageId: 'stage_ziel' },
            play_audio: { target: 'AudioObjekt' },
            stop_audio: { target: 'AudioObjekt' },
            set_velocity: { target, changes: { velocityX: 0, velocityY: -5 } },
            set_position: { target, changes: { x: 10, y: 10 } },
            set_property: { target, changes: { visible: true } },
            show_object: { target, changes: { visible: true } },
            hide_object: { target, changes: { visible: false } },
            increment: { target: 'MeineVariable', formula: 'MeineVariable + 1' },
            decrement: { target: 'MeineVariable', formula: 'MeineVariable - 1' },
            restart_game: {},
            show_toast: { message: 'Deine Nachricht', toastType: 'info' },
            call_task: {},
            other_action: {}
        };
        return map[actionType] || {};
    }

    /** Params-Objekt in JS-Objekt-Literal-String umwandeln (valid fuer AgentController-Code). */
    private static paramsToCode(params: Record<string, any>): string {
        return JSON.stringify(params || {}, null, 2);
    }

    /** Ermittelt, ob fuer einen Action-Typ ein AgentController-Code sinnvoll ist. */
    private static generateActionCode(a: any, taskName: string, compName: string): string {
        const actionName = a.name || a.type;
        if (a.type === 'other_action') {
            return `// Etwas anderes: ${a.otherDesc || '(keine Beschreibung)'}\n// agentController.addAction('${taskName}', '<type>', '${actionName}', { /* params */ });`;
        }
        if (a.type === 'call_task') {
            return `agentController.addTaskCall('${taskName}', '${actionName}');`;
        }
        const params = a.params || UseCaseDialog.getDefaultActionParams(a.type, compName);
        return `agentController.addAction('${taskName}', '${a.type}', '${actionName}', ${UseCaseDialog.paramsToCode(params)});`;
    }

    /** Komplettes AgentController-Skript aus den Wizard-Daten generieren. */
    private static generateAgentControllerScript(wData: any, stageId: string): string {
        const otherTriggerNote = wData.triggerType === 'other' && wData.otherTriggerDesc
            ? `// Eigener Auslöser: ${wData.otherTriggerDesc}\n// Passe compType und eventName manuell an!\n`
            : '';
        const actionsCode = (wData.actions || []).map((a: any) => UseCaseDialog.generateActionCode(a, wData.taskName, wData.compName)).join('\n');
        const condCode = wData.condition
            ? `agentController.addBranch('${wData.taskName}',\n  '${wData.condition.leftValue}', '${wData.condition.op}', '${wData.condition.rightValue}',\n  (then) => { then.addAction('...'); },\n  (els) => { els.addAction('...'); }\n);`
            : '';
        const eventParamCode = wData.eventParam
            ? `agentController.addTaskParam('${wData.taskName}', 'key', 'string', '${wData.eventParam}');`
            : '';
        return `${otherTriggerNote}// -- 1. UseCase speichern ----------------------
agentController.addUseCase('${stageId}', {
  title: '${(wData.title||'').replace(/'/g,"\\'")}',
  description: '${(wData.description||'').replace(/'/g,"\\'")}',
  priority: '${wData.priority}',
  compType: '${wData.compType}', compName: '${wData.compName}',
  eventName: '${wData.eventName}',${wData.eventParam ? `\n  eventParam: '${wData.eventParam}',` : ''}
  taskName: '${wData.taskName}',
  agentHints: '${(wData.agentHints||'').replace(/'/g,"\\'")}',
});

// -- 2. Task erstellen --------------------------
agentController.createTask('${stageId}', '${wData.taskName}', '${(wData.title||'').replace(/'/g,"\\'")}');
${eventParamCode ? eventParamCode + '\n' : ''}
// -- 3. Actions hinzufügen ---------------------
${actionsCode || '// (keine Actions definiert)'}
${condCode ? '\n// -- 3b. Bedingung ----------------------------\n' + condCode : ''}

// -- 4. Event verknüpfen -----------------------
agentController.connectEvent('${stageId}', '${wData.compName}', '${wData.eventName}', '${wData.taskName}');

// -- 5. Flow generieren ────────────────────────
agentController.generateTaskFlow('${wData.taskName}');

// -- 6. Status auf "in_progress" setzen ───────
// agentController.updateUseCaseStatus('<id>', 'in_progress');
${wData.agentHints ? `\n// Hinweise: ${wData.agentHints}` : ''}`;
    }

    constructor(host: IViewHost) {
        this.host = host;
    }

    // ═══════════════════════════════════════════════════════════
    // MODAL HELPER
    // ═══════════════════════════════════════════════════════════

    private ensureModal(): HTMLElement {
        let modal = document.getElementById('userstories-edit-modal');
        if (!modal) {
            UseCaseDialog.LOGGER.info('[Wizard] ensureModal: erzeuge fehlendes Modal-Element in document.body');
            modal = document.createElement('div');
            modal.id = 'userstories-edit-modal';
            modal.style.display = 'none';
            document.body.appendChild(modal);
        }
        return modal;
    }

    // ═══════════════════════════════════════════════════════════
    // showAddUseCaseDialog (6-Schritte Wizard)
    // ═══════════════════════════════════════════════════════════

    public showAddUseCaseDialog(stageId: string, prefilled?: { className?: string, name?: string }) {
        UseCaseDialog.LOGGER.info('[Wizard] showAddUseCaseDialog aufgerufen, stageId=' + stageId + ', prefilled=' + JSON.stringify(prefilled));
        const modal = this.ensureModal();
        const project = this.host.project;
        const stage = (project.stages || []).find((s: any) => s.id === stageId);
        const stageName = (stage as any)?.stageDescription?.title || (stage as any)?.name || stageId;

        // Bekannte Komponenten-Arten mit ihren Events
        const COMPONENT_EVENTS: Record<string, string[]> = {
            'TSprite':          ['onCollision', 'onBoundaryHit', 'onClick', 'onMouseEnter', 'onMouseLeave'],
            'TInputController': ['onKeyDown', 'onKeyUp', 'onKeyPress'],
            'TIntervalTimer':   ['onIntervall', 'onTimeout'],
            'TButton':          ['onClick', 'onMouseEnter', 'onMouseLeave'],
            'TGameLoop':        ['onLoop'],
            'TGameState':       ['onStateChange'],
            'TFlowStage':       ['onEnter', 'onExit'],
            'Sonstige':         ['onClick', 'onCollision', 'onKeyDown', 'onTimer', 'onLoop', 'onStateChange']
        };

        // Wizard-State
        let wizardMode: 'guided' | 'expert' = 'guided';
        let wizardStep = 1;
        const WIZARD_STEPS = 6;
        const wData: any = {
            title: '', description: '', priority: 'medium',
            triggerType: '',
            compType: prefilled?.className || '',
            compName: prefilled?.name || '',
            eventName: '', eventParam: '',
            taskName: '', actions: [], condition: null, agentHints: '',
            otherTriggerDesc: '', otherActionDesc: ''
        };
        // Wenn Komponente per Kontextmenü vorausgewählt wurde, Schritt "Objekt" als erledigt markieren
        const componentStepPrefilled = !!(prefilled?.className && prefilled?.name);

        // Trigger-Kacheln
        const TRIGGERS = [
            { id: 'collision',  icon: '💥', label: 'Zwei Objekte\nstoßen zusammen', compType: 'TSprite',          event: 'onCollision' },
            { id: 'key',        icon: '⌨️', label: 'Eine Taste\nwird gedrückt',      compType: 'TInputController', event: 'onKeyDown' },
            { id: 'sprite',     icon: '🏃', label: 'Ein Spieler-Objekt\nwird angeklickt', compType: 'TSprite',    event: 'onClick' },
            { id: 'timer',      icon: '⏱️', label: 'Ein Timer\nläuft ab',             compType: 'TIntervalTimer', event: 'onIntervall' },
            { id: 'button',     icon: '🔘', label: 'Ein Button\nwird gedrückt',       compType: 'TButton',        event: 'onClick' },
            { id: 'loop',       icon: '🔄', label: 'Jeder Spiel-\nDurchlauf',          compType: 'TGameLoop',      event: 'onLoop' },
            { id: 'boundary',   icon: '🚧', label: 'Objekt trifft\nden Rand',          compType: 'TSprite',        event: 'onBoundaryHit' },
            { id: 'other',      icon: '❓', label: 'Etwas\nanderes',                   compType: 'Sonstige',       event: '' },
        ];

        // Action-Kacheln
        const ACTION_TILES = [
            { type: 'spawn_object',   icon: '✨', label: 'Objekt erscheinen\nlassen' },
            { type: 'destroy_object', icon: '💣', label: 'Objekt\nentfernen' },
            { type: 'set_variable',   icon: '🔢', label: 'Zahl/Wert\nändern' },
            { type: 'navigate_stage', icon: '🚀', label: 'Zur nächsten\nStage' },
            { type: 'play_audio',     icon: '🔊', label: 'Ton\nabspielen' },
            { type: 'set_velocity',   icon: '💨', label: 'Geschwindigkeit\nsetzen' },
            { type: 'set_position',   icon: '📍', label: 'Position\nsetzen' },
            { type: 'set_property',   icon: '🔧', label: 'Eigenschaft\nändern' },
            { type: 'call_task',      icon: '📣', label: 'Andere Aufgabe\nauslösen' },
            { type: 'show_object',    icon: '👁️', label: 'Objekt\nanzeigen' },
            { type: 'hide_object',    icon: '🙈', label: 'Objekt\nverstecken' },
            { type: 'increment',      icon: '➕', label: 'Zahl\nerhöhen' },
            { type: 'stop_audio',     icon: '🔇', label: 'Ton\nstoppen' },
            { type: 'restart_game',   icon: '🔁', label: 'Spiel neu\nstarten' },
            { type: 'show_toast',     icon: '💬', label: 'Nachricht\nanzeigen' },
            { type: 'other_action',   icon: '❓', label: 'Etwas\nanderes' },
        ];

        const allObjects: any[] = [];
        (project.stages || []).forEach((s: any) => (s.objects || []).forEach((o: any) => allObjects.push(o)));

        const inputStyle = 'width:100%;padding:8px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;box-sizing:border-box;font-size:14px;';
        const labelStyle = 'display:block;font-size:13px;margin-bottom:5px;color:#c0c8e0;font-weight:bold;';
        const sectionStyle = 'background:#12122a;border:1px solid #2a2a5a;border-radius:8px;padding:18px;margin-bottom:14px;';

        // Schritt-Fortschrittsbalken generieren
        const renderProgress = () => {
            if (wizardMode !== 'guided') return '';
            const steps = ['Idee', 'Auslöser', 'Objekt', 'Aktionen', 'Bedingung', 'Fertig'];
            return `<div style="display:flex;gap:0;margin-bottom:20px;border-radius:6px;overflow:hidden;">
                ${steps.map((s, i) => {
                    const num = i + 1;
                    const active = num === wizardStep;
                    // Schritt 3 ('Objekt') vorausgefüllt-grün markieren, wenn per Kontextmenü gestartet
                    const done = num < wizardStep || (componentStepPrefilled && num === 3);
                    const bg = done ? '#2e7d32' : active ? '#1565c0' : '#1a1a3a';
                    const color = (done || active) ? '#fff' : '#606080';
                    return `<div style="flex:1;padding:7px 4px;background:${bg};text-align:center;font-size:11px;font-weight:bold;color:${color};border-right:1px solid #0a0a20;">
                        <div style="font-size:13px;">${done ? '✓' : num}</div>
                        <div style="margin-top:2px;font-size:10px;">${s}</div>
                    </div>`;
                }).join('')}
            </div>`;
        };

        // Schritt-Inhalte rendern
        const renderStep = (): string => {
            if (wizardStep === 1) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">💡 Was soll in deinem Spiel passieren?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">Beschreibe deine Idee. Du kannst einfach drauflosschreiben!</div>
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Gib deiner Idee einen Namen:</label>
                        <input id="w-title" type="text" placeholder="z.B. Spieler schießt eine Kugel" value="${wData.title}"
                            style="${inputStyle}">
                    </div>
                    <div>
                        <label style="${labelStyle}">Erkläre es genauer (wenn du möchtest):</label>
                        <textarea id="w-desc" rows="3" placeholder="z.B. Wenn der Spieler die Leertaste drückt, soll eine Kugel nach oben fliegen."
                            style="${inputStyle}resize:vertical;">${wData.description}</textarea>
                    </div>
                    <div style="margin-top:12px;">
                        <label style="${labelStyle}">Wie wichtig ist das?</label>
                        <div style="display:flex;gap:8px;">
                            ${[['high','🔴','Sehr wichtig'],['medium','🟡','Normal'],['low','🟢','Kann warten']].map(([v,ic,lbl]) =>
                                `<div onclick="window._wSetPriority('${v}')" style="flex:1;padding:8px;border:2px solid ${wData.priority===v?'#1976d2':'#2a2a5a'};border-radius:6px;background:${wData.priority===v?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                                    <div style="font-size:18px;">${ic}</div>
                                    <div style="font-size:12px;color:#c0c8e0;margin-top:3px;">${lbl}</div>
                                </div>`
                            ).join('')}
                        </div>
                    </div>
                </div>`;

            if (wizardStep === 2) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">⚡ Wie wird das ausgelöst?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">Was muss passieren, damit deine Idee startet?</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;">
                        ${TRIGGERS.map(t => `
                            <div onclick="window._wSetTrigger('${t.id}')"
                                style="padding:12px 8px;border:2px solid ${wData.triggerType===t.id?'#1976d2':'#2a2a5a'};border-radius:8px;background:${wData.triggerType===t.id?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                                <div style="font-size:24px;">${t.icon}</div>
                                <div style="font-size:11px;color:#c0c8e0;margin-top:6px;white-space:pre-line;">${t.label}</div>
                            </div>`).join('')}
                    </div>
                    ${wData.triggerType === 'other' ? `
                    <div style="margin-top:14px;background:#0f1830;border:1px solid #3a3a6a;border-radius:6px;padding:14px;">
                        <label style="${labelStyle}">📝 Beschreibe in eigenen Worten, was das auslösen soll:</label>
                        <textarea id="w-other-trigger-desc" rows="3"
                            placeholder="z.B. Der Spieler betritt ein bestimmtes Feld, ein Gegenstand wird eingesammelt ..."
                            style="${inputStyle}resize:vertical;">${wData.otherTriggerDesc}</textarea>
                    </div>` : ''}
                </div>`;

            if (wizardStep === 3) {
                const trigger = TRIGGERS.find(t => t.id === wData.triggerType);
                const objNames = [...new Set(allObjects.filter(o => o.className === wData.compType).map((o: any) => o.name))];
                const keyOptions = ['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space',' ','Enter','a','d','w','s']
                    .map(k => `<option value="${k}" ${wData.eventParam===k?'selected':''}>${k}</option>`).join('');
                return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">🧩 Welches Objekt macht das?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">
                        ${trigger ? `Du hast gewählt: <strong style="color:#60a0ff;">${trigger.icon} ${trigger.label.replace('\n',' ')}</strong>` : ''}
                    </div>
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Name des Objekts:</label>
                        <input id="w-comp-name" type="text" list="w-comp-name-list" placeholder="z.B. Spieler"
                            value="${wData.compName}" style="${inputStyle}">
                        <datalist id="w-comp-name-list">
                            ${objNames.map(n => `<option value="${n}">`).join('')}
                        </datalist>
                    </div>
                    ${wData.triggerType === 'key' ? `
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Welche Taste?</label>
                        <select id="w-event-param" style="${inputStyle}">
                            ${keyOptions}
                        </select>
                    </div>` : ''}
                    ${wData.triggerType === 'collision' ? `
                    <div style="margin-bottom:12px;">
                        <label style="${labelStyle}">Mit welchem anderen Objekt kollidiert es?</label>
                        <input id="w-event-param" type="text" list="w-comp-name-list2" placeholder="z.B. Feind"
                            value="${wData.eventParam}" style="${inputStyle}">
                        <datalist id="w-comp-name-list2">
                            ${objNames.map(n => `<option value="${n}">`).join('')}
                        </datalist>
                    </div>` : ''}
                    <div>
                        <label style="${labelStyle}">Welchen Namen soll die Aufgabe (Task) haben?</label>
                        <input id="w-task" type="text" placeholder="z.B. SpielerSchiesst" value="${wData.taskName}" style="${inputStyle}">
                        <div style="color:#6060a0;font-size:11px;margin-top:4px;">💡 Tipp: Kein Leerzeichen, fang mit Großbuchstaben an</div>
                    </div>
                </div>`;
            }

            if (wizardStep === 4) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">⚙️ Was soll dann passieren?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:14px;">Wähle aus, was dein Spiel tun soll. Du kannst mehrere auswählen!</div>
                    <div style="display:grid;grid-template-columns:repeat(4,1fr);gap:8px;margin-bottom:14px;">
                        ${ACTION_TILES.map(a => {
                            const sel = wData.actions.some((x: any) => x.type === a.type && !x._detail);
                            return `<div onclick="window._wToggleAction('${a.type}')"
                                style="padding:10px 6px;border:2px solid ${sel?'#388e3c':'#2a2a5a'};border-radius:8px;background:${sel?'#0d2a14':'#12122a'};cursor:pointer;text-align:center;">
                                <div style="font-size:22px;">${a.icon}</div>
                                <div style="font-size:10px;color:#c0c8e0;margin-top:5px;white-space:pre-line;">${a.label}</div>
                            </div>`;
                        }).join('')}
                    </div>
                    <div id="w-action-details" style="display:flex;flex-direction:column;gap:8px;">
                        ${wData.actions.map((a: any, i: number) => `
                            <div style="display:flex;flex-direction:column;gap:6px;background:#0f1830;border:1px solid #2a3a6a;border-radius:6px;padding:8px;">
                                <div style="display:flex;gap:6px;align-items:center;">
                                    <span style="font-size:18px;">${ACTION_TILES.find(t=>t.type===a.type)?.icon||'❓'}</span>
                                    <input type="text" value="${a.name}" placeholder="Name der Aktion" data-idx="${i}" class="w-action-name"
                                        style="flex:1;padding:6px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                                    <span style="color:#6080c0;font-size:12px;min-width:90px;">${a.type}</span>
                                    <button onclick="window._wMoveAction(${i},-1)" style="padding:3px 7px;background:#1a2a4a;color:#c0c8e0;border:none;border-radius:3px;cursor:pointer;">↑</button>
                                    <button onclick="window._wMoveAction(${i},1)" style="padding:3px 7px;background:#1a2a4a;color:#c0c8e0;border:none;border-radius:3px;cursor:pointer;">↓</button>
                                    <button onclick="window._wRemoveAction(${i})" style="padding:3px 8px;background:#b71c1c;color:white;border:none;border-radius:3px;cursor:pointer;">✕</button>
                                </div>
                                ${a.type === 'other_action' ? `
                                <textarea data-other-idx="${i}" class="w-other-action-desc" rows="2"
                                    placeholder="Beschreibe in eigenen Worten, was passieren soll ..."
                                    style="width:100%;padding:6px;background:#0a1020;border:1px solid #4a3a7a;border-radius:4px;color:#e0e0e0;font-size:12px;box-sizing:border-box;resize:vertical;">${a.otherDesc||''}</textarea>` : ''}
                            </div>`).join('')}
                    </div>
                </div>`;

            if (wizardStep === 5) return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:6px;">🔀 Gibt es eine Bedingung?</div>
                    <div style="color:#9090c0;font-size:13px;margin-bottom:16px;">Soll die Aktion nur passieren, wenn etwas Bestimmtes gilt?</div>
                    <div style="display:flex;gap:10px;margin-bottom:16px;">
                        <div onclick="window._wSetCondition(false)"
                            style="flex:1;padding:14px;border:2px solid ${!wData.condition?'#1976d2':'#2a2a5a'};border-radius:8px;background:${!wData.condition?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                            <div style="font-size:24px;">✅</div>
                            <div style="font-size:13px;color:#c0c8e0;margin-top:6px;">Nein, immer ausführen</div>
                        </div>
                        <div onclick="window._wSetCondition(true)"
                            style="flex:1;padding:14px;border:2px solid ${wData.condition?'#1976d2':'#2a2a5a'};border-radius:8px;background:${wData.condition?'#0d2a4a':'#12122a'};cursor:pointer;text-align:center;">
                            <div style="font-size:24px;">🔀</div>
                            <div style="font-size:13px;color:#c0c8e0;margin-top:6px;">Ja, nur wenn ...</div>
                        </div>
                    </div>
                    ${wData.condition ? `
                    <div style="background:#0f1830;border:1px solid #3a3a6a;border-radius:6px;padding:14px;">
                        <div style="color:#b0b0d0;font-size:13px;margin-bottom:10px;">Nur ausführen, wenn diese Variable ...</div>
                        <div style="display:flex;gap:8px;align-items:center;">
                            <input id="w-cond-left" type="text" placeholder="Variable (z.B. \${punkte})"
                                value="${wData.condition?.leftValue||''}" style="flex:2;padding:7px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                            <select id="w-cond-op" style="flex:1;padding:7px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                                <option ${wData.condition?.op==='=='?'selected':''}>==</option>
                                <option ${wData.condition?.op==='>='?'selected':''}>>=</option>
                                <option ${wData.condition?.op==='<='?'selected':''}><=</option>
                                <option ${wData.condition?.op==='>'?'selected':''}>&gt;</option>
                                <option ${wData.condition?.op==='<'?'selected':''}>&lt;</option>
                            </select>
                            <input id="w-cond-right" type="text" placeholder="Wert (z.B. 0)"
                                value="${wData.condition?.rightValue||''}" style="flex:2;padding:7px;background:#0a1020;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:13px;">
                        </div>
                    </div>` : ''}
                    <div style="margin-top:14px;">
                        <label style="${labelStyle}">Noch weitere Hinweise für den AgentController?</label>
                        <textarea id="w-hints" rows="2" placeholder="z.B. Die Kugel soll nach oben fliegen, Vorlage: BulletTemplate"
                            style="${inputStyle}resize:vertical;">${wData.agentHints}</textarea>
                    </div>
                </div>`;

            if (wizardStep === 6) {
                const trigger = TRIGGERS.find(t => t.id === wData.triggerType);

                // AgentController-Skript generieren
                const prompt = UseCaseDialog.generateAgentControllerScript(wData, stageId);
                // Diagramm
                const arrow = `<div style="text-align:center;color:#607d8b;font-size:18px;">↓</div>`;
                const box = (bg: string, lbl: string, val: string) =>
                    `<div style="background:${bg};border-radius:6px;padding:7px 14px;display:inline-block;min-width:200px;margin:1px 0;">
                        <div style="font-size:10px;text-transform:uppercase;color:rgba(255,255,255,0.6);">${lbl}</div>
                        <div style="font-weight:bold;font-size:13px;color:#fff;">${val}</div>
                    </div>`;
                let diag = `<div style="display:flex;flex-direction:column;align-items:flex-start;gap:1px;">`;
                diag += box('#1565c0', `${trigger?.icon||''} ${wData.compType}`, wData.compName||'?') + arrow;
                diag += box('#e65100', 'Event', wData.eventName + (wData.eventParam?` (${wData.eventParam})`:'')) + arrow;
                diag += box('#2e7d32', 'Task', wData.taskName||'?');
                if (wData.actions.length > 0) {
                    diag += arrow + `<div style="border-left:3px solid #4caf50;margin-left:20px;padding-left:10px;display:flex;flex-direction:column;gap:3px;">`;
                    wData.actions.forEach((a: any, i: number) => {
                        diag += box('#6a1b9a', `Action ${i+1} · ${a.type}`, a.name||a.type);
                        if (i < wData.actions.length-1) diag += arrow;
                    });
                    diag += `</div>`;
                }
                if (wData.condition) {
                    diag += arrow + box('#e65100', '⬡ Bedingung', `${wData.condition.leftValue} ${wData.condition.op} ${wData.condition.rightValue}`);
                }
                diag += arrow + box('#455a64','','Ende') + `</div>`;

                return `
                <div style="${sectionStyle}">
                    <div style="font-size:18px;font-weight:bold;color:#fff;margin-bottom:14px;">🎉 Super! Das hast du geplant:</div>
                    <div style="display:flex;gap:14px;">
                        <div style="flex:1;">
                            <div style="background:#f8f8ff;border-radius:6px;padding:12px;">${diag}</div>
                        </div>
                        <div style="flex:1;">
                            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                                <span style="color:#c080ff;font-size:11px;font-weight:bold;text-transform:uppercase;">AgentController-Prompt</span>
                                <button id="w-copy-prompt" style="padding:3px 10px;background:#7b1fa2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">📋 Kopieren</button>
                            </div>
                            <pre id="w-prompt-text" style="background:#0a0a1a;border:1px solid #4a3a7a;border-radius:6px;padding:12px;color:#d0d0ff;font-size:11px;white-space:pre-wrap;margin:0;line-height:1.5;max-height:280px;overflow-y:auto;">${prompt}</pre>
                        </div>
                    </div>
                </div>`;
            }
            return '';
        };

        // Dialog-HTML zusammenbauen
        const renderDialog = () => {
            const isGuided = wizardMode === 'guided';
            modal.style.display = 'block';
            modal.innerHTML = `
            <div style="position:fixed;inset:0;background:rgba(0,0,0,0.75);z-index:1000;display:flex;align-items:flex-start;justify-content:center;overflow-y:auto;padding:24px 0;">
                <div style="background:#1a1a2e;border:1px solid #3a3a6a;border-radius:10px;padding:28px;width:720px;color:#e0e0e0;margin:auto;">
                    <div style="display:flex;justify-content:space-between;align-items:flex-start;margin-bottom:16px;">
                        <div>
                            <h3 style="margin:0 0 4px 0;color:#fff;font-size:17px;">UseCase hinzufügen</h3>
                            <div style="color:#60a0e0;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;">Stage: ${stageName}</div>
                        </div>
                        <div style="display:flex;gap:6px;">
                            <button id="w-mode-guided" style="padding:5px 14px;border:2px solid ${isGuided?'#1976d2':'#2a2a5a'};background:${isGuided?'#0d2a4a':'#12122a'};color:${isGuided?'#60a0ff':'#6060a0'};border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">🧙 Geführt</button>
                            <button id="w-mode-expert" style="padding:5px 14px;border:2px solid ${!isGuided?'#1976d2':'#2a2a5a'};background:${!isGuided?'#0d2a4a':'#12122a'};color:${!isGuided?'#60a0ff':'#6060a0'};border-radius:4px;cursor:pointer;font-size:12px;font-weight:bold;">⚙️ Experte</button>
                        </div>
                    </div>

                    ${isGuided ? renderProgress() : ''}

                    <div id="w-content">
                        ${isGuided ? renderStep() : renderExpertMode()}
                    </div>

                    <div style="display:flex;justify-content:space-between;margin-top:16px;">
                        <button id="w-cancel" style="padding:7px 18px;background:#3a3a5a;color:#e0e0e0;border:none;border-radius:4px;cursor:pointer;font-size:13px;">Abbrechen</button>
                        <div style="display:flex;gap:8px;">
                            ${isGuided && wizardStep > 1 ? `<button id="w-back" style="padding:7px 18px;background:#1a2a4a;color:#c0c8e0;border:1px solid #3a3a6a;border-radius:4px;cursor:pointer;font-size:13px;">◀ Zurück</button>` : ''}
                            ${isGuided && wizardStep < WIZARD_STEPS
                                ? `<button id="w-next" style="padding:7px 20px;background:#1565c0;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">Weiter ▶</button>`
                                : `<button id="w-save" style="padding:7px 20px;background:#388e3c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:13px;font-weight:bold;">✓ Speichern</button>`}
                        </div>
                    </div>
                </div>
            </div>`;

            bindDialogListeners();
        };

        const renderExpertMode = (): string => {
            const ACTION_TYPES = ['spawn_object','destroy_object','set_variable','increment','decrement',
                'navigate_stage','play_audio','stop_audio','set_velocity','set_position','call_task','show_object','hide_object','set_property'];
            const compTypes = Object.keys(COMPONENT_EVENTS);
            const renderEventOpts = (t: string) => (COMPONENT_EVENTS[t]||COMPONENT_EVENTS['Sonstige']).map(e=>`<option value="${e}" ${wData.eventName===e?'selected':''}>${e}</option>`).join('');
            const objNames = [...new Set(allObjects.filter(o => o.className === wData.compType).map((o:any)=>o.name))];
            return `
            <div style="${sectionStyle}">
                <div style="color:#a0c0ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">① Idee</div>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:2;"><label style="${labelStyle}">Titel</label>
                        <input id="e-title" type="text" value="${wData.title}" placeholder="z.B. Spieler schießt Kugel" style="${inputStyle}"></div>
                    <div style="flex:1;"><label style="${labelStyle}">Priorität</label>
                        <select id="e-priority" style="${inputStyle}">
                            <option value="high" ${wData.priority==='high'?'selected':''}>🔴 Hoch</option>
                            <option value="medium" ${wData.priority!=='high'&&wData.priority!=='low'?'selected':''}>🟡 Mittel</option>
                            <option value="low" ${wData.priority==='low'?'selected':''}>🟢 Niedrig</option>
                        </select></div>
                </div>
                <div><label style="${labelStyle}">Beschreibung</label>
                    <textarea id="e-desc" rows="2" style="${inputStyle}resize:vertical;">${wData.description}</textarea></div>
            </div>
            <div style="${sectionStyle}">
                <div style="color:#a0c0ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:12px;">② Technische Spezifikation</div>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:1;"><label style="${labelStyle}">Komponenten-Art</label>
                        <select id="e-comp-type" style="${inputStyle}">
                            ${compTypes.map(t=>`<option value="${t}" ${wData.compType===t?'selected':''}>${t}</option>`).join('')}
                        </select></div>
                    <div style="flex:1;"><label style="${labelStyle}">Komponenten-Name</label>
                        <input id="e-comp-name" type="text" list="e-comp-name-list" value="${wData.compName}" placeholder="z.B. Spieler" style="${inputStyle}">
                        <datalist id="e-comp-name-list">${objNames.map(n=>`<option value="${n}">`).join('')}</datalist></div>
                </div>
                <div style="display:flex;gap:10px;margin-bottom:10px;">
                    <div style="flex:1;"><label style="${labelStyle}">Event</label>
                        <select id="e-event" style="${inputStyle}">${renderEventOpts(wData.compType||compTypes[0])}</select></div>
                    <div style="flex:1;"><label style="${labelStyle}">Task-Name</label>
                        <input id="e-task" type="text" value="${wData.taskName}" placeholder="z.B. SpielerSchiesst" style="${inputStyle}"></div>
                </div>
                <div>
                    <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:6px;">
                        <label style="${labelStyle}margin-bottom:0;">Actions</label>
                        <button id="e-add-action" style="padding:3px 10px;background:#1976d2;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">+ Action</button>
                    </div>
                    <div id="e-actions-list" style="display:flex;flex-direction:column;gap:6px;">
                        ${wData.actions.map((a:any,i:number)=>`
                        <div class="e-action-row" style="display:flex;gap:6px;align-items:center;">
                            <input type="text" value="${a.name}" placeholder="Action-Name" class="e-action-name" data-idx="${i}"
                                style="flex:1;padding:6px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                            <select class="e-action-type" style="flex:1;padding:5px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                                ${ACTION_TYPES.map(t=>`<option value="${t}" ${a.type===t?'selected':''}>${t}</option>`).join('')}
                            </select>
                            <button class="e-remove-action" style="padding:4px 8px;background:#b71c1c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
                        </div>`).join('')}
                        ${wData.actions.length===0?`<div class="e-action-row" style="display:flex;gap:6px;align-items:center;">
                            <input type="text" placeholder="Action-Name" class="e-action-name"
                                style="flex:1;padding:6px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                            <select class="e-action-type" style="flex:1;padding:5px;background:#0f1830;border:1px solid #3a3a6a;border-radius:4px;color:#e0e0e0;font-size:12px;">
                                ${ACTION_TYPES.map(t=>`<option value="${t}">${t}</option>`).join('')}
                            </select>
                            <button class="e-remove-action" style="padding:4px 8px;background:#b71c1c;color:white;border:none;border-radius:4px;cursor:pointer;font-size:12px;">✕</button>
                        </div>`:''}
                    </div>
                </div>
            </div>
            <div style="${sectionStyle}">
                <div style="color:#a0c0ff;font-size:11px;font-weight:bold;text-transform:uppercase;letter-spacing:1px;margin-bottom:8px;">③ Hinweise für AgentController</div>
                <textarea id="e-hints" rows="2" placeholder="z.B. Kugel fliegt nach oben, Template: BulletTemplate"
                    style="${inputStyle}resize:vertical;">${wData.agentHints}</textarea>
            </div>`;
        };

        const saveWizardData = () => {
            if (wizardMode === 'guided') {
                if (wizardStep === 1) {
                    wData.title       = (document.getElementById('w-title') as HTMLInputElement)?.value || '';
                    wData.description = (document.getElementById('w-desc') as HTMLTextAreaElement)?.value || '';
                }
                if (wizardStep === 2) {
                    wData.otherTriggerDesc = (document.getElementById('w-other-trigger-desc') as HTMLTextAreaElement)?.value || '';
                }
                if (wizardStep === 3) {
                    wData.compName  = (document.getElementById('w-comp-name') as HTMLInputElement)?.value || '';
                    wData.taskName  = (document.getElementById('w-task') as HTMLInputElement)?.value || '';
                    wData.eventParam = (document.getElementById('w-event-param') as HTMLSelectElement)?.value || '';
                    wData.actions.forEach((a: any) => {
                        if (a && a.type) {
                            a.params = UseCaseDialog.getDefaultActionParams(a.type, wData.compName || '');
                        }
                    });
                }
                if (wizardStep === 4) {
                    document.querySelectorAll('.w-action-name').forEach((el, i) => {
                        if (wData.actions[i]) wData.actions[i].name = (el as HTMLInputElement).value;
                    });
                    document.querySelectorAll('.w-other-action-desc').forEach((el) => {
                        const idx = parseInt((el as HTMLElement).dataset.otherIdx || '0');
                        if (wData.actions[idx]) wData.actions[idx].otherDesc = (el as HTMLTextAreaElement).value;
                    });
                    wData.actions.forEach((a: any) => {
                        if (a && a.type) {
                            a.params = UseCaseDialog.getDefaultActionParams(a.type, wData.compName || '');
                        }
                    });
                }
                if (wizardStep === 5) {
                    wData.agentHints = (document.getElementById('w-hints') as HTMLTextAreaElement)?.value || '';
                    if (wData.condition) {
                        wData.condition.leftValue  = (document.getElementById('w-cond-left') as HTMLInputElement)?.value || '';
                        wData.condition.op         = (document.getElementById('w-cond-op') as HTMLSelectElement)?.value || '==';
                        wData.condition.rightValue = (document.getElementById('w-cond-right') as HTMLInputElement)?.value || '';
                    }
                }
            } else {
                wData.title       = (document.getElementById('e-title') as HTMLInputElement)?.value || '';
                wData.description = (document.getElementById('e-desc') as HTMLTextAreaElement)?.value || '';
                wData.priority    = (document.getElementById('e-priority') as HTMLSelectElement)?.value || 'medium';
                wData.compType    = (document.getElementById('e-comp-type') as HTMLSelectElement)?.value || '';
                wData.compName    = (document.getElementById('e-comp-name') as HTMLInputElement)?.value || '';
                wData.eventName   = (document.getElementById('e-event') as HTMLSelectElement)?.value || '';
                wData.taskName    = (document.getElementById('e-task') as HTMLInputElement)?.value || '';
                wData.agentHints  = (document.getElementById('e-hints') as HTMLTextAreaElement)?.value || '';
                wData.actions = [];
                document.querySelectorAll('.e-action-row').forEach(row => {
                    const name = (row.querySelector('.e-action-name') as HTMLInputElement).value;
                    const type = (row.querySelector('.e-action-type') as HTMLSelectElement).value;
                    if (name) wData.actions.push({ name, type, params: UseCaseDialog.getDefaultActionParams(type, wData.compName || '') });
                });
            }
        };

        const bindDialogListeners = () => {
            // Modus-Umschalter
            document.getElementById('w-mode-guided')?.addEventListener('click', () => { saveWizardData(); wizardMode='guided'; wizardStep=1; renderDialog(); });
            document.getElementById('w-mode-expert')?.addEventListener('click', () => { saveWizardData(); wizardMode='expert'; renderDialog(); });

            // Navigation
            document.getElementById('w-cancel')?.addEventListener('click', () => { modal.style.display='none'; modal.innerHTML=''; });
            document.getElementById('w-back')?.addEventListener('click', () => { saveWizardData(); wizardStep--; renderDialog(); });
            document.getElementById('w-next')?.addEventListener('click', () => { saveWizardData(); wizardStep++; renderDialog(); });

            // Wizard-Kacheln (Priorität)
            (window as any)._wSetPriority = (v: string) => { saveWizardData(); wData.priority=v; renderDialog(); };

            // Wizard-Kacheln (Trigger)
            (window as any)._wSetTrigger = (id: string) => {
                saveWizardData();
                wData.triggerType = id;
                const t = TRIGGERS.find(x=>x.id===id);
                if (t) { wData.compType=t.compType; wData.eventName=t.event; }
                renderDialog();
            };

            // Wizard-Actions
            (window as any)._wToggleAction = (type: string) => {
                saveWizardData();
                const idx = wData.actions.findIndex((a: any) => a.type===type);
                if (idx>=0) wData.actions.splice(idx,1);
                else wData.actions.push({ name: '', type, params: UseCaseDialog.getDefaultActionParams(type, wData.compName || '') });
                renderDialog();
            };
            (window as any)._wMoveAction = (i: number, dir: number) => {
                saveWizardData();
                const j = i+dir;
                if (j>=0 && j<wData.actions.length) { const tmp=wData.actions[i]; wData.actions[i]=wData.actions[j]; wData.actions[j]=tmp; }
                renderDialog();
            };
            (window as any)._wRemoveAction = (i: number) => { saveWizardData(); wData.actions.splice(i,1); renderDialog(); };

            // Condition toggle
            (window as any)._wSetCondition = (on: boolean) => {
                saveWizardData();
                wData.condition = on ? { leftValue:'', op:'==', rightValue:'' } : null;
                renderDialog();
            };

            // Experten-Modus: Komponenten-Art ändert Events
            document.getElementById('e-comp-type')?.addEventListener('change', (e) => {
                const t = (e.target as HTMLSelectElement).value;
                const evSel = document.getElementById('e-event') as HTMLSelectElement;
                if (evSel) evSel.innerHTML = (COMPONENT_EVENTS[t]||COMPONENT_EVENTS['Sonstige']).map(ev=>`<option value="${ev}">${ev}</option>`).join('');
                const dl = document.getElementById('e-comp-name-list') as HTMLDataListElement;
                const names = [...new Set(allObjects.filter((o:any)=>o.className===t).map((o:any)=>o.name))];
                if (dl) dl.innerHTML = names.map(n=>`<option value="${n}">`).join('');
            });
            document.getElementById('e-add-action')?.addEventListener('click', () => {
                saveWizardData();
                wData.actions.push({ name:'', type:'spawn_object', params: UseCaseDialog.getDefaultActionParams('spawn_object', wData.compName || '') });
                renderDialog();
            });
            document.querySelectorAll('.e-remove-action').forEach(btn => {
                btn.addEventListener('click', () => (btn.closest('.e-action-row') as HTMLElement)?.remove());
            });

            // Prompt kopieren (Schritt 6)
            document.getElementById('w-copy-prompt')?.addEventListener('click', () => {
                const text = (document.getElementById('w-prompt-text') as HTMLElement)?.textContent||'';
                navigator.clipboard.writeText(text).then(()=>{
                    const btn=document.getElementById('w-copy-prompt');
                    if(btn){btn.textContent='✓ Kopiert!';setTimeout(()=>{btn.textContent='📋 Kopieren';},2000);}
                });
            });

            // Speichern
            document.getElementById('w-save')?.addEventListener('click', () => {
                saveWizardData();
                if (!project.userStories) (project as any).userStories={userStories:[]};
                if (!project.userStories!.userStories) project.userStories!.userStories=[];
                project.userStories!.userStories!.push({
                    id: `us_${Date.now()}`,
                    projectId: project.meta?.id || project.meta?.name || '',
                    title: wData.title||'(kein Titel)',
                    description: wData.description,
                    status: 'idea',
                    priority: wData.priority,
                    acceptanceCriteria: [],
                    relatedComponents: [],
                    relatedVariables: [],
                    relatedStages: [stageId],
                    interactions: [],
                    plannedComponent: { type: wData.compType, name: wData.compName },
                    plannedEvent: wData.eventName,
                    plannedEventParam: wData.eventParam,
                    plannedTask: wData.taskName,
                    plannedActions: wData.actions,
                    agentControllerScript: UseCaseDialog.generateAgentControllerScript(wData, stageId),
                    plannedCondition: wData.condition,
                    agentHints: wData.agentHints,
                    createdAt: new Date(),
                    updatedAt: new Date()
                });
                this.host.isProjectDirty = true;
                modal.style.display='none';
                modal.innerHTML='';
                this.host.renderUserStoriesList();
            });
        };

        renderDialog();
    }
}
