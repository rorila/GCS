import { Logger } from '../../utils/Logger';
import type { GameRuntime } from '../GameRuntime';
import { AnimationManager } from '../AnimationManager';
import { GameLoopManager } from '../GameLoopManager';
import { AudioManager } from '../AudioManager';
const logger = Logger.get('RuntimeLifecycleService', 'Runtime_Execution');

export class RuntimeLifecycleService {
    public stop(runtime: GameRuntime) {
            logger.info(`[GameRuntime] STOP() called, objectCount=${runtime.objects.length}`);
            if (runtime.splashTimerId) { clearTimeout(runtime.splashTimerId); runtime.splashTimerId = null; }
    
            runtime.inputHandler.dispose();
    
            // 1. Sicheres Stoppen ALLER Komponenten
            runtime.objects.forEach(obj => {
                try {
                    if (typeof obj.onRuntimeStop === 'function') obj.onRuntimeStop();
                    if (typeof (obj as any).stop === 'function') (obj as any).stop();
                } catch (e) {
                    logger.error(`Error stopping object ${obj.id}:`, e);
                }
            });
    
            GameLoopManager.getInstance().stop();
            AnimationManager.getInstance().clear();
            AudioManager.getInstance().stopAll();
    
            // 2. Objekt-Pools leeren
            if (runtime.spritePool) {
                runtime.spritePool.destroy();
            }
    
            // 3. Komplettes Wipe-Out der Proxies und Context-Referenzen
            if (runtime.reactiveRuntime) {
                runtime.reactiveRuntime.clear(true);
            }
    
            runtime.objects = [];
            logger.info(`[GameRuntime] STOP() done`);
        }

    public start(runtime: GameRuntime) {
            if (runtime.isMainGameStarted) return;
            runtime.isMainGameStarted = true;
    
            logger.info(`[GameRuntime] START() called, objectCount=${runtime.objects.length}, splash=${runtime.isSplashActive}, stage=${runtime.stage?.id}`);
    
            // TNumberLabel und TTimer muessen ihre onEvent-Callbacks an GameRuntime binden,
            // damit onMaxValueReached/onMinValueReached/onTimer in Standalone-Engine feuern.
            runtime.objects.forEach(obj => {
                if (obj.className === 'TNumberLabel' || obj.className === 'TTimer') {
                    if ('onEvent' in obj) {
                        (obj as any).onEvent = (eventName: string) => runtime.handleEvent(obj.id, eventName);
                    }
                }
                if (obj.className === 'TTimer') {
                    (obj as any).watcherQuery = (prop: string) => runtime.reactiveRuntime.hasWatcher(obj, prop);
                }
            });
    
            if (runtime.options.onRender) runtime.options.onRender();
            runtime.objects.forEach(obj => runtime.handleEvent(obj.id, 'onStart'));
    
            // InputController MUSS vor dem Splash-Check initialisiert werden,
            // damit Keyboard-Events bereits während/nach dem Splash funktionieren.
            runtime.inputHandler.init();
    
            if (runtime.isSplashActive) {
                if (runtime.project.splashAutoHide) {
                    const duration = (runtime.stage as any)?.duration || runtime.project.splashDuration || 3000;
                    runtime.splashTimerId = setTimeout(() => runtime.stageService.finishSplash(runtime), duration);
                }
                return;
            }
            runtime.initMainGame();
        }

    public init(runtime: GameRuntime) {
            if (runtime.options.makeReactive) {
                runtime.objects.forEach(obj => {
                    const mp = runtime.options.multiplayerManager || (window as any).multiplayerManager;
                    if (obj.className === 'THandshake' && mp) {
                        obj._setRoomInfo(mp.roomCode, mp.playerNumber, mp.isHost);
                        obj._setStatus(mp.roomCode ? 'playing' : 'idle');
                    }
                });
            }
        }
}
