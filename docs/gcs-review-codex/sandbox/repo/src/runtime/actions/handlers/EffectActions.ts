import { actionRegistry } from '../../ActionRegistry';
import { Logger } from '../../../utils/Logger';

const logger = Logger.get('EffectActions', 'Runtime_Execution');

const SHAKE_STYLES_ID = 'gcs-camera-shake-styles';

function ensureShakeStyles(): void {
    if (document.getElementById(SHAKE_STYLES_ID)) return;

    const style = document.createElement('style');
    style.id = SHAKE_STYLES_ID;
    style.textContent = `
        @keyframes camera-shake-light {
            0% { transform: translate(0, 0); }
            25% { transform: translate(-3px, 1px); }
            50% { transform: translate(3px, -1px); }
            75% { transform: translate(-2px, 2px); }
            100% { transform: translate(0, 0); }
        }
        @keyframes camera-shake-medium {
            0% { transform: translate(0, 0); }
            20% { transform: translate(-5px, 2px); }
            40% { transform: translate(5px, -2px); }
            60% { transform: translate(-3px, -4px); }
            80% { transform: translate(3px, 4px); }
            100% { transform: translate(0, 0); }
        }
        @keyframes camera-shake-heavy {
            0% { transform: translate(0, 0); }
            20% { transform: translate(-8px, 4px); }
            40% { transform: translate(8px, -4px); }
            60% { transform: translate(-5px, -6px); }
            80% { transform: translate(5px, 6px); }
            100% { transform: translate(0, 0); }
        }
    `;
    document.head.appendChild(style);
}

/**
 * Registriert visuelle Effekt-Aktionen:
 * - shake_screen: Kurzes Kamera-Shake auf dem Stage-Viewport.
 */
export function registerEffectActions(): void {
    actionRegistry.register('shake_screen', (action) => {
        const intensity = action.intensity || 'medium';
        const duration = action.duration || 250;

        ensureShakeStyles();

        const viewport = document.querySelector('.gcs-stage-element') as HTMLElement | null;
        if (!viewport) {
            logger.warn('[shake_screen] Kein Stage-Viewport (.gcs-stage-element) gefunden');
            return;
        }

        const className = `camera-shake-${intensity}`;
        const classList = viewport.classList;

        // Reset ggf. laufende Animation
        classList.remove('camera-shake-light', 'camera-shake-medium', 'camera-shake-heavy');
        void viewport.offsetWidth; // Reflow erzwingen

        classList.add(className);

        setTimeout(() => {
            classList.remove(className);
        }, duration);

        logger.info(`[shake_screen] intensity=${intensity}, duration=${duration}ms`);
    }, {
        type: 'shake_screen',
        label: 'Kamera-Shake',
        description: 'Lässt den Stage-Viewport kurz wackeln.',
        parameters: [
            { name: 'intensity', label: 'Intensität', type: 'select', options: ['light', 'medium', 'heavy'], defaultValue: 'medium' },
            { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 250 }
        ]
    });
}
