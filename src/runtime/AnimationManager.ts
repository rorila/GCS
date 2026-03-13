/**
 * AnimationManager - Zentrale Verwaltung von Tween-Animationen.
 * Ermöglicht die weiche Animation beliebiger numerischer Eigenschaften.
 */

export type EasingFunction = (t: number) => number;

export interface Tween {
    target: any;
    property: string;
    from: number;
    to: number;
    duration: number;
    startTime: number;
    easing: EasingFunction;
    onComplete?: () => void;
}

// Standard Easing-Funktionen
export const Easing = {
    linear: (t: number): number => t,
    easeIn: (t: number): number => t * t,
    easeOut: (t: number): number => t * (2 - t),
    easeInOut: (t: number): number => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
    bounce: (t: number): number => {
        if (t < 1 / 2.75) {
            return 7.5625 * t * t;
        } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
        } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
        } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
        }
    },
    elastic: (t: number): number => {
        if (t === 0 || t === 1) return t;
        return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
    }
};

export class AnimationManager {
    private activeTweens: Tween[] = [];
    private static instance: AnimationManager | null = null;

    private constructor() { }

    public static getInstance(): AnimationManager {
        if (!AnimationManager.instance) {
            AnimationManager.instance = new AnimationManager();
        }
        return AnimationManager.instance;
    }

    /**
     * Fügt einen neuen Tween hinzu.
     * @param target Das Zielobjekt (z.B. ein TSprite)
     * @param property Der Property-Pfad (z.B. 'x', 'y', 'style.opacity')
     * @param to Der Zielwert
     * @param duration Dauer in Millisekunden
     * @param easingName Name der Easing-Funktion (default: 'easeOut')
     * @param onComplete Optionaler Callback nach Abschluss
     */
    public addTween(
        target: any,
        property: string,
        to: number,
        duration: number,
        easingName: string = 'easeOut',
        onComplete?: () => void
    ): Tween {
        // Nur bei Debug-Bedarf einkommentieren, NICHT im Normalbetrieb:
        // console.log(`[AnimationManager.addTween] target=${target?.name}, prop=${property}, to=${to}, dur=${duration}, easing=${easingName}`);

        // Vorherigen Tween auf dasselbe Property abbrechen
        const previousCount = this.activeTweens.length;
        this.cancelTween(target, property);
        if (this.activeTweens.length !== previousCount) {
            // cancelled existing tween
        }

        // Aktuellen Wert auslesen
        const from = this.getPropertyValue(target, property);
        // console.log(`[AnimationManager.addTween] Current value of ${property}: ${from}`);

        // Easing-Funktion bestimmen
        const easing = (Easing as any)[easingName] || Easing.easeOut;
        if (!(Easing as any)[easingName]) {
            console.warn(`[AnimationManager.addTween] Unknown easing "${easingName}", falling back to easeOut`);
        }

        // Flag setzen, um Physik zu pausieren (falls vorhanden)
        if (property === 'x' || property === 'y') {
            target.isAnimating = true;
            // console.log(`[AnimationManager.addTween] Set isAnimating=true on ${target?.name}`);
        }

        const tween: Tween = {
            target,
            property,
            from,
            to,
            duration,
            startTime: -1, // Lazy-Init: wird beim ersten update() auf performance.now() gesetzt
            easing,
            onComplete
        };

        this.activeTweens.push(tween);
        // console.log(`[AnimationManager.addTween] Added tween, total active: ${this.activeTweens.length}`);
        return tween;
    }

    /**
     * Animiert mehrere Eigenschaften eines Objekts gleichzeitig.
     */
    public animate(
        target: any,
        properties: Record<string, number>,
        duration: number,
        easingName: string = 'easeOut',
        onComplete?: () => void
    ): void {
        const keys = Object.keys(properties);
        let completedCount = 0;

        keys.forEach(prop => {
            this.addTween(target, prop, properties[prop], duration, easingName, () => {
                completedCount++;
                if (completedCount === keys.length && onComplete) {
                    onComplete();
                }
            });
        });
    }

    /**
     * Bricht einen laufenden Tween ab.
     */
    public cancelTween(target: any, property: string): void {
        this.activeTweens = this.activeTweens.filter(t =>
            !(t.target === target && t.property === property)
        );

        // Safety: If no more position tweens exist, clear isAnimating
        if (property === 'x' || property === 'y') {
            const hasMore = this.activeTweens.some(t =>
                t.target === target && (t.property === 'x' || t.property === 'y')
            );
            if (!hasMore && target.isAnimating !== undefined) {
                target.isAnimating = false;
            }
        }
    }

    /**
     * Bricht alle Tweens eines Objekts ab.
     */
    public cancelAllTweens(target: any): void {
        this.activeTweens = this.activeTweens.filter(t => t.target !== target);
        if (target.isAnimating !== undefined) {
            target.isAnimating = false;
        }
    }

    /**
     * Aktualisiert alle aktiven Tweens. Muss pro Frame aufgerufen werden.
     */
    public update(): void {
        const now = performance.now();
        const completedTweens: Tween[] = [];

        if (this.activeTweens.length > 0) {
            // HIGH-FREQ LOG ENTFERNT — wurde 60x/sec aufgerufen, blockierte Main-Thread
            // console.log(`[AnimationManager.update] Updating ${this.activeTweens.length} active tweens at t=${now.toFixed(0)}`);
        }

        for (const tween of this.activeTweens) {
            try {
                // Lazy-Init: startTime beim ersten update()-Aufruf setzen
                // Verhindert Timing-Bug wenn Tweens zwischen Game-Loop-Zyklen erstellt werden
                if (tween.startTime < 0) {
                    tween.startTime = now;
                }
                const elapsed = now - tween.startTime;
                let progress = Math.min(elapsed / tween.duration, 1);

                // Easing anwenden
                const easedProgress = tween.easing(progress);

                // Neuen Wert berechnen und setzen
                const newValue = tween.from + (tween.to - tween.from) * easedProgress;
                this.setPropertyValue(tween.target, tween.property, newValue);

                // Tween abgeschlossen?
                if (progress >= 1) {
                    // FORCE final value to avoid floating point errors or race conditions
                    this.setPropertyValue(tween.target, tween.property, tween.to);
                    console.log(`[AnimationManager] Tween completed for ${tween.target.name || tween.target.id}.${tween.property} (Forced to ${tween.to})`);
                    completedTweens.push(tween);
                }
            } catch (error) {
                console.error(`[AnimationManager] Error updating tween for ${tween.target.name || tween.target.id}.${tween.property}:`, error);
                completedTweens.push(tween); // Mark as completed to remove it and prevent further errors
            }
        }

        // Abgeschlossene Tweens entfernen und Callbacks ausführen
        for (const tween of completedTweens) {
            this.activeTweens = this.activeTweens.filter(t => t !== tween);

            // Physik-Flag zurücksetzen
            if (tween.property === 'x' || tween.property === 'y') {
                // Prüfen ob noch andere x/y Tweens laufen
                const hasMorePositionTweens = this.activeTweens.some(t =>
                    t.target === tween.target && (t.property === 'x' || t.property === 'y')
                );
                if (!hasMorePositionTweens && tween.target.isAnimating !== undefined) {
                    tween.target.isAnimating = false;
                }
            }

            if (tween.onComplete) {
                tween.onComplete();
            }
        }
    }

    /**
     * Gibt zurück, ob aktuell Animationen laufen.
     */
    public hasActiveTweens(): boolean {
        return this.activeTweens.length > 0;
    }

    /**
     * Bricht alle aktiven Tweens ab und leert die Liste.
     */
    public clear(): void {
        this.activeTweens = [];
    }

    /**
     * Gibt die Anzahl aktiver Tweens zurück.
     */
    public getActiveTweenCount(): number {
        return this.activeTweens.length;
    }

    // Hilfsfunktionen für Property-Zugriff (unterstützt Pfade wie 'style.opacity')
    private getPropertyValue(target: any, path: string): number {
        const parts = path.split('.');
        let value = target;
        for (const part of parts) {
            value = value?.[part];
        }
        return Number(value) || 0;
    }

    private setPropertyValue(target: any, path: string, value: number): void {
        const parts = path.split('.');
        let obj = target;
        for (let i = 0; i < parts.length - 1; i++) {
            obj = obj?.[parts[i]];
        }
        if (obj) {
            obj[parts[parts.length - 1]] = value;
        }
    }
    /**
     * Erzeugt einen Schütteleffekt (Shake) auf einem Objekt.
     * @param target Das Zielobjekt
     * @param intensity Intensität des Schüttelns in Pixeln (default: 5)
     * @param duration Gesamtdauer in Millisekunden (default: 500)
     */
    public shake(target: any, intensity: number = 5, duration: number = 500): void {
        const originalX = target.x;
        const originalY = target.y;
        const startTime = performance.now();

        const shakeInterval = 50; //ms

        const performShake = () => {
            const now = performance.now();
            const elapsed = now - startTime;

            if (elapsed < duration) {
                // Zufälligen Offset berechnen
                const offsetX = (Math.random() - 0.5) * intensity * 2;
                const offsetY = (Math.random() - 0.5) * intensity * 2;

                target.x = originalX + offsetX;
                target.y = originalY + offsetY;

                setTimeout(performShake, shakeInterval);
            } else {
                // Zurück zur Originalposition
                target.x = originalX;
                target.y = originalY;
            }
        };

        performShake();
    }
}

