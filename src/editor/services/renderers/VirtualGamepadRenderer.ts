import { IRenderContext } from './IRenderContext';

console.log("🚀🚀🚀 VIRTUAL GAMEPAD RENDERER MODULE LOADED - VERSION 8 🚀🚀🚀");

export class VirtualGamepadRenderer {
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any, _className: string): void {
        const isRunMode = ctx.host.runMode;

        // Im Editor ist es nur ein Umriss/Hinweis, außer es ist aktiv
        if (!isRunMode) {
            el.style.display = 'flex';
            el.style.alignItems = 'center';
            el.style.justifyContent = 'center';
            el.style.backgroundColor = 'rgba(0, 255, 204, 0.1)';
            el.style.border = '2px dashed rgba(0, 255, 204, 0.5)';
            el.style.color = '#00ffcc';
            el.style.fontWeight = 'bold';
            el.style.fontSize = '12px';
            el.innerText = '🎮 Virtual Gamepad\n(Auto-Adaptive)';
            return;
        }

        console.log(`[VirtualGamepadRenderer] render() gestartet. sichtbarkeit(obj.visible)=${obj.visible}, hiddenInRun=${obj.isHiddenInRun}`);

        // --- RUNTIME MODE ---
        // Auto-Hide auf Desktop wird im TVirtualGamepad via visible=false gesetzt.
        if (obj.visible === false || obj.isHiddenInRun === true) {
            console.log(`[VirtualGamepadRenderer] Abgebrochen: sichtbarkeit=${obj.visible}, hiddenInRun=${obj.isHiddenInRun}`);
            el.style.display = 'none';
            return;
        }

        let simulatedKeys = obj.simulatedKeys || [];
        
        // FALLBACK: Falls wir im Editor-Run-Mode sind und initRuntime nie gecallt wurde
        const stageObjects = (ctx.host as any).stage?.objects || ctx.host.lastRenderedObjects;
        if (simulatedKeys.length === 0 && stageObjects) {
            const keys = new Set<string>();
            const inputControllers = stageObjects.filter((o: any) => o.className === 'TInputController');
            inputControllers.forEach((ic: any) => {
                if (ic.events) {
                    Object.keys(ic.events).forEach((evtName: string) => {
                        const match = evtName.match(/^onKey(?:Down|Up)_(.+)$/);
                        if (match && match[1]) keys.add(match[1]);
                    });
                }
            });
            simulatedKeys = Array.from(keys);
        }

        console.log(`[VirtualGamepadRenderer] evaluiere Keys. result: `, simulatedKeys);
        
        if (simulatedKeys.length === 0) {
            console.warn(`[VirtualGamepadRenderer] Abgebrochen: Keine simulatedKeys vorhanden und kein TInputController gefunden!`);
            el.style.display = 'none'; // Keine Tasten gebunden -> Nichts anzeigen
            return;
        }

        console.log(`[VirtualGamepadRenderer] Erstelle Layout für ${simulatedKeys.length} Tasten...`);

        // Layout vorbereiten
        el.style.display = 'flex';
        el.style.flexDirection = 'row';
        el.style.justifyContent = 'space-between';
        
        const layoutStyle = obj.layoutStyle || 'split';
        const vAlign = obj.splitVerticalAlignment || 'bottom';
        el.style.alignItems = (layoutStyle === 'split' && vAlign === 'middle') ? 'center' : 'flex-end';
        
        el.style.pointerEvents = 'none'; // Wir machen den Container selbst nicht anklickbar, sondern nur die Buttons
        
        // ÜBERSCHREIBE StageRenderer Defaults, damit das Gamepad über den gesamten Screen liegen darf und niemals geclippt wird!
        el.style.overflow = 'visible';
        el.style.position = 'absolute';
        el.style.left = '0px';
        el.style.bottom = '0px';
        el.style.top = 'auto'; // Verhindert zwingende Top-Platzierung
        el.style.width = '100%';
        el.style.height = '100%'; 
        el.style.transform = 'none'; // Verhindere Grid-Skalierung, falls es transform nutzt
        
        el.innerHTML = ''; // Clear previous

        const opacity = obj.style?.opacity ?? 0.8;
        const scale = obj.scale || 1.0;

        // Container für Linken (D-Pad) und Rechten (Actions) Teil
        const leftZone = document.createElement('div');
        const rightZone = document.createElement('div');

        leftZone.style.cssText = `display: flex; flex-direction: column; align-items: center; pointer-events: none; transform: scale(${scale}); transform-origin: bottom left; opacity: ${opacity};`;
        rightZone.style.cssText = `display: flex; flex-direction: column; align-items: center; pointer-events: none; transform: scale(${scale}); transform-origin: bottom right; opacity: ${opacity};`;

        if (layoutStyle === 'split') {
            // Umgedrehtes Layout für Rechtshänder: D-Pad rechts (rightZone), Action links (leftZone)
            this.buildSplitLayout(rightZone, leftZone, simulatedKeys);
            el.appendChild(leftZone);
            el.appendChild(rightZone);
        } else {
            // Action-Bar Layout
            const barZone = document.createElement('div');
            barZone.style.cssText = `display: flex; flex-direction: row; justify-content: center; width: 100%; pointer-events: none; transform: scale(${scale}); opacity: ${opacity}; gap: 10px; padding-bottom: 10px;`;
            this.buildActionBarLayout(barZone, simulatedKeys);
            el.appendChild(barZone);
        }

        // Event Delegation
        this.attachDispatchListeners(el, simulatedKeys);
    }

    private static createButton(label: string, code: string): HTMLElement {
        const btn = document.createElement('div');
        btn.className = 'virtual-gamepad-btn';
        btn.dataset.code = code;
        btn.style.cssText = `
            width: 50px; height: 50px; border-radius: 50%;
            background: rgba(255, 255, 255, 0.2);
            backdrop-filter: blur(5px);
            border: 2px solid rgba(255, 255, 255, 0.4);
            display: flex; justify-content: center; align-items: center;
            color: white; font-weight: bold; font-family: sans-serif;
            user-select: none; box-shadow: 0 4px 10px rgba(0,0,0,0.3);
            pointer-events: auto; touch-action: none;
        `;
        btn.innerText = label;
        return btn;
    }

    private static buildSplitLayout(dirZone: HTMLElement, actionZone: HTMLElement, keys: string[]) {
        const directionalKeys = new Set(['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyW', 'KeyA', 'KeyS', 'KeyD']);
        
        const usedDirKeys = keys.filter(k => directionalKeys.has(k));
        const usedActionKeys = keys.filter(k => !directionalKeys.has(k));

        const hasArrows = ['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].some(k => usedDirKeys.includes(k));
        const hasWASD = ['KeyW', 'KeyA', 'KeyS', 'KeyD'].some(k => usedDirKeys.includes(k));

        const buildDPad = (container: HTMLElement, useArrows: boolean) => {
            container.style.position = 'relative';
            container.style.width = '150px';
            container.style.height = '150px';
            container.style.margin = '20px';

            const addDirBtn = (label: string, code: string, top: string, leftPos: string) => {
                if (usedDirKeys.includes(code)) {
                    const btn = this.createButton(label, code);
                    btn.style.position = 'absolute';
                    btn.style.top = top;
                    btn.style.left = leftPos;
                    container.appendChild(btn);
                }
            };

            if (useArrows) {
                addDirBtn('⬆️', 'ArrowUp', '0px', '50px');
                addDirBtn('⬇️', 'ArrowDown', '100px', '50px');
                addDirBtn('⬅️', 'ArrowLeft', '50px', '0px');
                addDirBtn('➡️', 'ArrowRight', '50px', '100px');
            } else {
                addDirBtn('W', 'KeyW', '0px', '50px');
                addDirBtn('S', 'KeyS', '100px', '50px');
                addDirBtn('A', 'KeyA', '50px', '0px');
                addDirBtn('D', 'KeyD', '50px', '100px');
            }
        };

        if (hasArrows && hasWASD) {
            // Multiplayer/Dual-Stick Setup: Pfeile in die Dir-Zone (für Rechtshänder -> rechts), WASD in Action-Zone (links)
            buildDPad(dirZone, true);
            buildDPad(actionZone, false);
            
            // Wenn trotzdem Action-Buttons existieren, tun wir sie einfach in die Action-Zone dazu
            if (usedActionKeys.length > 0) {
                const extraDiv = document.createElement('div');
                extraDiv.style.display = 'flex';
                extraDiv.style.gap = '10px';
                extraDiv.style.marginTop = '10px';
                usedActionKeys.forEach(k => extraDiv.appendChild(this.createButton(this.getLabelForKey(k), k)));
                actionZone.appendChild(extraDiv);
            }
            return;
        }

        // Standard Single-Player Ansatz:
        // D-Pad
        if (usedDirKeys.length > 0) {
            buildDPad(dirZone, hasArrows); // Falls nur eins von beiden da ist
        }

        // Action Buttons
        if (usedActionKeys.length > 0) {
            actionZone.style.position = 'relative';
            actionZone.style.margin = '20px';
            actionZone.style.width = '150px';
            actionZone.style.height = '150px';

            if (usedActionKeys.length <= 2) {
                // Diagonales Nintendo-Style
                usedActionKeys.forEach((key, index) => {
                    const label = this.getLabelForKey(key);
                    const btn = this.createButton(label, key);
                    btn.style.position = 'absolute';
                    if (index === 0) { btn.style.bottom = '0px'; btn.style.left = '0px'; }
                    if (index === 1) { btn.style.top = '20px'; btn.style.right = '20px'; }
                    actionZone.appendChild(btn);
                });
            } else if (usedActionKeys.length <= 4) {
                // Diamant / Xbox-Style
                const positions = [
                    { bottom: '0px', left: '50px' },    // Unten
                    { top: '50px', right: '0px' },      // Rechts
                    { top: '50px', left: '0px' },       // Links
                    { top: '0px', left: '50px' }        // Oben
                ];
                usedActionKeys.forEach((key, index) => {
                    const label = this.getLabelForKey(key);
                    const btn = this.createButton(label, key);
                    btn.style.position = 'absolute';
                    Object.assign(btn.style, positions[index % 4]);
                    actionZone.appendChild(btn);
                });
            } else {
                // Grid wenn viele
                actionZone.style.display = 'grid';
                actionZone.style.gridTemplateColumns = '1fr 1fr';
                actionZone.style.gap = '10px';
                usedActionKeys.forEach(key => {
                    actionZone.appendChild(this.createButton(this.getLabelForKey(key), key));
                });
            }
        }
    }

    private static buildActionBarLayout(bar: HTMLElement, keys: string[]) {
        keys.forEach(key => {
            const btn = this.createButton(this.getLabelForKey(key), key);
            bar.appendChild(btn);
        });
    }

    private static getLabelForKey(key: string): string {
        if (key === 'Space') return 'SPC';
        if (key === 'Enter') return 'ENT';
        if (key === 'ShiftLeft' || key === 'ShiftRight') return 'SHF';
        if (key.startsWith('Key')) return key.replace('Key', '');
        return key.substring(0, 3).toUpperCase();
    }

    private static attachDispatchListeners(el: HTMLElement, _keys: string[]) {
        const dispatchKey = (code: string, type: 'keydown' | 'keyup') => {
            window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
        };

        const activeTouches = new Map<number, string>(); // pointerId -> keyCode

        // iOS Safari Zoom-Verhinderung (Double-Tap) & Native Touch Priority
        el.addEventListener('touchstart', (e) => {
            const btn = (e.target as HTMLElement).closest('.virtual-gamepad-btn') as HTMLElement;
            if (btn) {
                e.preventDefault(); // Stop zoom and generic mouse-events!
            }
        }, { passive: false });

        // PointerDown = Button press
        el.addEventListener('pointerdown', (e) => {
            const btn = (e.target as HTMLElement).closest('.virtual-gamepad-btn') as HTMLElement;
            if (btn && btn.dataset.code) {
                btn.style.background = 'rgba(255, 255, 255, 0.5)'; // Visual feedback
                dispatchKey(btn.dataset.code, 'keydown');
                activeTouches.set(e.pointerId, btn.dataset.code);
            }
        });

        // PointerUp = Button release
        el.addEventListener('pointerup', (e) => {
            const code = activeTouches.get(e.pointerId);
            if (code) {
                dispatchKey(code, 'keyup');
                activeTouches.delete(e.pointerId);
                // Feedback reset
                const btn = el.querySelector(`[data-code="${code}"]`) as HTMLElement;
                if (btn) btn.style.background = 'rgba(255, 255, 255, 0.2)';
            }
        });

        el.addEventListener('pointercancel', (e) => {
            const code = activeTouches.get(e.pointerId);
            if (code) {
                dispatchKey(code, 'keyup');
                activeTouches.delete(e.pointerId);
                const btn = el.querySelector(`[data-code="${code}"]`) as HTMLElement;
                if (btn) btn.style.background = 'rgba(255, 255, 255, 0.2)';
            }
        });
    }
}
