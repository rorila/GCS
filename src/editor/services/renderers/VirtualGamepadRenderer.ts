import { IRenderContext } from './IRenderContext';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('VirtualGamepadRenderer');

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

        // --- RUNTIME MODE ---
        if (obj.visible === false || obj.isHiddenInRun === true) {
            el.style.display = 'none';
            return;
        }

        // 🚀 ALWAYS enforce full-screen layout for the gamepad wrapper
        el.style.display = 'flex';
        el.style.flexDirection = 'row';
        el.style.justifyContent = 'space-between';
        
        const layoutStyle = obj.layoutStyle || 'split';
        const vAlign = obj.splitVerticalAlignment || 'bottom';
        el.style.alignItems = (layoutStyle === 'split' && vAlign === 'middle') ? 'center' : 'flex-end';
        
        el.style.pointerEvents = 'none';
        
        // ÜBERSCHREIBE StageRenderer Defaults, damit das Gamepad über den gesamten Screen liegen darf!
        el.style.overflow = 'visible';
        el.style.position = 'fixed';
        el.style.left = '0px';
        el.style.bottom = '0px';
        el.style.top = 'auto'; // Verhindert zwingende Top-Platzierung
        el.style.width = '100%';
        el.style.height = '100%'; 
        el.style.transform = 'none'; // Verhindere Grid-Skalierung, falls es transform nutzt
        el.style.zIndex = '2147483646'; // Immer vor dem Spielbild, aber unter PerfOverlay

        // Aus dem Stage-Container herauslösen, damit z-index wirklich wirkt und
        // keine transformierten Elternelemente das Gamepad hinter Fische/Canvas schieben.
        if (document.body && el.parentElement !== document.body) {
            document.body.appendChild(el);
        }

        // 🚀 Verhindere ständigen Re-Render der Buttons (Crash/Performance)
        if ((el as any)._virtualGamepadBuilt) {
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

        if (!simulatedKeys || simulatedKeys.length === 0) {
            logger.warn('Abgebrochen: Keine simulatedKeys vorhanden und kein TInputController gefunden!');
            el.style.display = 'none'; // Keine Tasten gebunden -> Nichts anzeigen
            return;
        }

        (el as any)._virtualGamepadBuilt = true;
        
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
        this.attachDispatchListeners(el, simulatedKeys, obj.pressDelay ?? 150, obj.keyCooldown ?? 120);
    }

    private static createButton(label: string, code: string): HTMLElement {
        const btn = document.createElement('div');
        btn.className = 'virtual-gamepad-btn';
        btn.dataset.code = code;
        btn.style.cssText = `
            width: 50px; height: 50px; border-radius: 50%;
            background: rgba(255, 255, 255, 0.25);
            border: 2px solid rgba(255, 255, 255, 0.5);
            display: flex; justify-content: center; align-items: center;
            color: white; font-weight: bold; font-family: sans-serif;
            user-select: none;
            pointer-events: auto; touch-action: none;
            opacity: 1;
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

    private static attachDispatchListeners(el: HTMLElement, _keys: string[], pressDelay: number, keyCooldown: number) {
        const dispatchKey = (code: string, type: 'keydown' | 'keyup') => {
            window.dispatchEvent(new KeyboardEvent(type, { code, key: code, bubbles: true }));
        };

        const activeTouches = new Map<number, HTMLElement>(); // pointerId -> button element
        const pressedCodes = new Map<string, boolean>();      // code -> currently pressed or queued
        const lastKeydownTime = new Map<string, number>();    // code -> last keydown timestamp
        const pendingTimeouts = new Map<number, number>();    // pointerId -> setTimeout id
        const keydownFired = new Map<number, boolean>();      // pointerId -> keydown already dispatched
        const activePress = new Map<string, { pointerId: number; timeoutId: number; btn: HTMLElement }>(); // code -> active press
        const cachedPress = new Map<string, { pointerId: number; btn: HTMLElement; released: boolean } | null>(); // code -> cached press (max 1)
        const PRESS_DELAY_MS = Math.max(0, pressDelay);       // time before keydown is dispatched
        const KEY_COOLDOWN_MS = Math.max(0, keyCooldown);     // min time between keydowns for same code

        const setButtonVisual = (btn: HTMLElement | undefined, state: 'idle' | 'pending' | 'pressed') => {
            if (!btn) return;
            if (state === 'idle') btn.style.opacity = '1';
            else if (state === 'pending') btn.style.opacity = '0.75';
            else btn.style.opacity = '0.55';
        };

        const cleanupCode = (code: string) => {
            if (!activePress.has(code) && !cachedPress.has(code)) {
                pressedCodes.set(code, false);
            }
        };

        const scheduleKeydown = (code: string, pointerId: number, btn: HTMLElement, delayMs: number) => {
            activePress.set(code, { pointerId, btn, timeoutId: -1 });
            setButtonVisual(btn, 'pending');
            const timeoutId = window.setTimeout(() => {
                pendingTimeouts.delete(pointerId);
                if (activePress.get(code)?.pointerId !== pointerId || activeTouches.get(pointerId) !== btn) return;

                lastKeydownTime.set(code, performance.now());
                keydownFired.set(pointerId, true);
                setButtonVisual(btn, 'pressed');
                dispatchKey(code, 'keydown');
            }, delayMs);
            pendingTimeouts.set(pointerId, timeoutId);
            activePress.set(code, { pointerId, btn, timeoutId });
        };

        const processQueue = (code: string) => {
            const cached = cachedPress.get(code);
            if (!cached || activePress.has(code)) return;

            const now = performance.now();
            const last = lastKeydownTime.get(code) || 0;
            const remainingCooldown = Math.max(0, (last + KEY_COOLDOWN_MS) - now);

            cachedPress.delete(code);

            const timeoutId = window.setTimeout(() => {
                pendingTimeouts.delete(cached.pointerId);
                if (activePress.get(code)?.pointerId !== cached.pointerId) return;

                lastKeydownTime.set(code, performance.now());
                keydownFired.set(cached.pointerId, true);
                setButtonVisual(cached.btn, 'pressed');
                dispatchKey(code, 'keydown');

                if (cached.released) {
                    // Finger war schon losgelassen -> sofort keyup
                    dispatchKey(code, 'keyup');
                    activePress.delete(code);
                    keydownFired.delete(cached.pointerId);
                    activeTouches.delete(cached.pointerId);
                    setButtonVisual(cached.btn, 'idle');
                    cleanupCode(code);
                }
            }, remainingCooldown);

            pendingTimeouts.set(cached.pointerId, timeoutId);
            activePress.set(code, { pointerId: cached.pointerId, timeoutId, btn: cached.btn });
            setButtonVisual(cached.btn, 'pending');
        };

        // iOS Safari Zoom-Verhinderung (Double-Tap) & Native Touch Priority
        el.addEventListener('touchstart', (e) => {
            const btn = (e.target as HTMLElement).closest('.virtual-gamepad-btn') as HTMLElement;
            if (btn) {
                e.preventDefault(); // Stop zoom and generic mouse-events!
            }
        }, { passive: false });

        // PointerDown = Button press (with press delay and 1-slot cache)
        el.addEventListener('pointerdown', (e) => {
            const btn = (e.target as HTMLElement).closest('.virtual-gamepad-btn') as HTMLElement;
            if (btn && btn.dataset.code) {
                const code = btn.dataset.code;
                const now = performance.now();

                // Code already active or cached? Only one cached press allowed.
                if (pressedCodes.get(code)) {
                    if (cachedPress.has(code)) return;
                    cachedPress.set(code, { pointerId: e.pointerId, btn, released: false });
                    activeTouches.set(e.pointerId, btn);
                    return;
                }

                pressedCodes.set(code, true);
                activeTouches.set(e.pointerId, btn);
                keydownFired.set(e.pointerId, false);

                const last = lastKeydownTime.get(code) || 0;
                const delayMs = Math.max(PRESS_DELAY_MS, (last + KEY_COOLDOWN_MS) - now);
                scheduleKeydown(code, e.pointerId, btn, delayMs);
            }
        });

        // PointerUp = Button release
        el.addEventListener('pointerup', (e) => {
            const btn = activeTouches.get(e.pointerId);
            if (!btn) return;
            const code = btn.dataset.code as string;

            const cached = cachedPress.get(code);
            if (cached && cached.pointerId === e.pointerId) {
                cached.released = true;
                // No keyup yet; cached will fire keydown then keyup automatically
                return;
            }

            const active = activePress.get(code);
            if (active && active.pointerId === e.pointerId) {
                const timeoutId = pendingTimeouts.get(e.pointerId);
                if (timeoutId !== undefined) {
                    clearTimeout(timeoutId);
                    pendingTimeouts.delete(e.pointerId);
                }

                if (keydownFired.get(e.pointerId)) {
                    dispatchKey(code, 'keyup');
                }
                keydownFired.delete(e.pointerId);
                activePress.delete(code);
                activeTouches.delete(e.pointerId);
                setButtonVisual(btn, 'idle');

                if (cachedPress.has(code)) {
                    // pressedCodes bleibt true, da noch ein Cache vorhanden
                    processQueue(code);
                } else {
                    pressedCodes.set(code, false);
                }
            } else {
                activeTouches.delete(e.pointerId);
                setButtonVisual(btn, 'idle');
            }
        });

        el.addEventListener('pointercancel', (e) => {
            const btn = activeTouches.get(e.pointerId);
            if (!btn) return;
            const code = btn.dataset.code as string;

            const cached = cachedPress.get(code);
            if (cached && cached.pointerId === e.pointerId) {
                cached.released = true;
                return;
            }

            const active = activePress.get(code);
            if (active && active.pointerId === e.pointerId) {
                const timeoutId = pendingTimeouts.get(e.pointerId);
                if (timeoutId !== undefined) {
                    clearTimeout(timeoutId);
                    pendingTimeouts.delete(e.pointerId);
                }

                if (keydownFired.get(e.pointerId)) {
                    dispatchKey(code, 'keyup');
                }
                keydownFired.delete(e.pointerId);
                activePress.delete(code);
                activeTouches.delete(e.pointerId);
                setButtonVisual(btn, 'idle');

                if (cachedPress.has(code)) {
                    processQueue(code);
                } else {
                    pressedCodes.set(code, false);
                }
            } else {
                activeTouches.delete(e.pointerId);
                setButtonVisual(btn, 'idle');
            }
        });
    }
}
