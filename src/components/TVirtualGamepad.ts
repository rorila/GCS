import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { Logger } from '../utils/Logger';

export type GamepadLayoutStyle = 'split' | 'action_bar';

/**
 * TVirtualGamepad
 * Overlay für Touch-Geräte, welches automatisch die Tastenbelegungen des TInputControllers
 * ausliest und Touchflächen generiert, die beim Drücken KeyboardEvents ins Dokument dispatchen.
 */
export class TVirtualGamepad extends TWindow implements IRuntimeComponent {
    private static logger = Logger.get('TVirtualGamepad', 'Input_Simulator');

    public layoutStyle: GamepadLayoutStyle = 'split';
    public splitVerticalAlignment: 'bottom' | 'middle' = 'bottom';
    public autoHideOnDesktop: boolean = true;
    public scale: number = 1.0;

    // Laufzeit-Daten (intern)
    public simulatedKeys: string[] = [];

    constructor(name: string, x: number = 0, y: number = 0) {
        // Das Gamepad ist im Editor nur ein kleines Service-Icon (4x4)
        // Die exakte Button-Platzierung im Run-Modus übernimmt der VirtualGamepadRenderer.
        super(name, x, y, 4, 4);
        
        // Unsichtbar im Editor (damit es nicht im Weg umgeht), außer man markiert es
        this.style.backgroundColor = 'transparent';
        this.style.borderColor = '#00ffcc';
        this.style.borderWidth = 1;

        this.isService = true; // Logische Komponente, rendert im RunMode als Screen-Overlay
        this.style.opacity = 0.8;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'layoutStyle', label: 'Layout Stil', type: 'select', group: 'Einstellungen', options: ['split', 'action_bar'] },
            { name: 'splitVerticalAlignment', label: 'Vertikale Ausrichtung', type: 'select', group: 'Einstellungen', options: ['bottom', 'middle'], visibleWhen: { field: 'layoutStyle', values: ['split'] } },
            { name: 'autoHideOnDesktop', label: 'Auf PC ausblenden', type: 'boolean', group: 'Einstellungen' },
            { name: 'scale', label: 'Skalierung', type: 'number', group: 'Einstellungen', min: 0.5, max: 2, step: 0.1, inline: true }
        ];
    }

    public applyChange(propertyName: string, newValue: any, _oldValue: any): boolean {
        (this as any)[propertyName] = newValue;
        if (propertyName === 'layoutStyle') {
            return true; // Zwingt den Inspector zum Re-Render wegen visibleWhen
        }
        return false;
    }

    public initRuntime(callbacks: { objects: any[] }): void {
        const objects = callbacks.objects || [];
        const keys = new Set<string>();
        
        TVirtualGamepad.logger.info(`initRuntime gestartet. Anzahl Objekte in der Stage: ${objects.length}`);

        // 1. Finde den InputController im aktuellen Stage-Objektbaum
        const inputControllers = objects.filter(o => o.className === 'TInputController');
        
        TVirtualGamepad.logger.info(`Gefundene InputController: ${inputControllers.length}`);

        if (inputControllers.length > 0) {
            // 2. Extrahiere alle gebundenen Tasten (Events)
            inputControllers.forEach(ic => {
                if (ic.events) {
                    const eventKeys = Object.keys(ic.events);
                    TVirtualGamepad.logger.info(`Untersuche InputController Events:`, eventKeys);
                    eventKeys.forEach(evtName => {
                        // evtName ist i.d.R. "onKeyDown_ArrowUp" oder "onKeyUp_Space"
                        const match = evtName.match(/^onKey(?:Down|Up)_(.+)$/);
                        if (match && match[1]) {
                            keys.add(match[1]);
                        }
                    });
                }
            });
        }

        this.simulatedKeys = Array.from(keys);
        TVirtualGamepad.logger.info(`Ermittelte simulierte Tasten: ${this.simulatedKeys.join(', ')}`);
        
        // 3. Fallback: Bei leeren Keys
        if (this.simulatedKeys.length === 0) {
           TVirtualGamepad.logger.warn(`ACHTUNG: simulatedKeys ist LEER! Das Gamepad wird sich im Renderer verstecken.`);
        }

        // 4. Auto-Hide Logik (Wenn keine Touch-Unterstützung da ist und Flag aktiv)
        TVirtualGamepad.logger.info(`Prüfe Auto-Hide: autoHideOnDesktop=${this.autoHideOnDesktop}`);
        if (this.autoHideOnDesktop) {
            const hasTouch = typeof window !== 'undefined' && ('ontouchstart' in window || (navigator && navigator.maxTouchPoints > 0));
            if (!hasTouch) {
                TVirtualGamepad.logger.info('Desktop Device (bzw. kein Touch) erkannt UND autoHideOnDesktop ist true -> Gamepad wird auf visible=false gesetzt!');
                this.visible = false;
            } else {
                TVirtualGamepad.logger.info('Touch Device erkannt. Gamepad bleibt sichtbar.');
            }
        } else {
            TVirtualGamepad.logger.info('autoHideOnDesktop ist FALSE -> Gamepad bleibt (was Device-Types angeht) sichtbar.');
        }
    }
}
