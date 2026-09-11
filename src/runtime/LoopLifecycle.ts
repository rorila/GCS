import { Logger } from '../utils/Logger';

const logger = Logger.get('LoopLifecycle', 'Runtime_Execution');

export type GameLoopState = 'stopped' | 'running' | 'paused' | 'sleeping';

export interface ILoopHost {
    processFrame(steps: number, alpha: number, fixedDt: number): boolean;
    onTargetFPSChanged(targetFPS: number): void;
}

/**
 * LoopLifecycle verwaltet den Lebenszyklus des Spiel-Loops:
 * start/stop/pause/resume, requestAnimationFrame-Scheduling, Akkumulator,
 * adaptive FPS und Sleep-Logik.
 */
export class LoopLifecycle {
    private state: GameLoopState = 'stopped';
    private animationFrameId: number | null = null;
    private lastTime = 0;
    private lastFrameTime = 0;
    private resyncClock = true;
    private accumulator = 0;
    private fixedDt = 1 / 60;
    private targetFPS = 60;
    private userTargetFPS = 60;
    private autoAdjustFPS = true;

    private frameTimeHistory: number[] = [];
    private frameTimeIndex = 0;
    private fpsCheckCounter = 0;
    private fpsWarmupFrames = 0;

    private idleFrameCount = 0;

    private readonly FPS_WINDOW_SIZE = 90;
    private readonly FPS_CHECK_INTERVAL = 30;
    private readonly FPS_WARMUP_FRAMES = 30;
    private readonly FPS_SLOW_THRESHOLD_MS = 22;
    private readonly FPS_UPGRADE_AVG_MS = 17;
    private readonly FPS_UPGRADE_SLOW_PCT = 0.10;
    private readonly FPS_DOWNGRADE_AVG_MS = 24;
    private readonly FPS_DOWNGRADE_SLOW_PCT = 0.35;
    private readonly IDLE_THRESHOLD = 30;

    constructor(private host: ILoopHost) {
        this.loop = this.loop.bind(this);
    }

    public configure(targetFPS: number, autoAdjust: boolean): void {
        this.targetFPS = Math.max(1, targetFPS);
        this.userTargetFPS = this.targetFPS;
        this.autoAdjustFPS = autoAdjust;
        this.fixedDt = 1 / this.targetFPS;
    }

    public start(): void {
        if (this.state === 'running') return;

        this.state = 'running';
        this.lastTime = performance.now();
        this.lastFrameTime = this.lastTime;
        this.accumulator = 0;
        this.idleFrameCount = 0;
        this.resyncClock = true;

        if (this.autoAdjustFPS) {
            this.resetFPSHistory();
            logger.info(`[LoopLifecycle] Starte dynamische FPS-Überwachung`);
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    public stop(): void {
        this.state = 'stopped';
        if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
        this.idleFrameCount = 0;
    }

    public pause(): void {
        if (this.state === 'running' || this.state === 'sleeping') {
            this.state = 'paused';
            if (this.animationFrameId !== null) {
                cancelAnimationFrame(this.animationFrameId);
                this.animationFrameId = null;
            }
            logger.debug(`Paused`);
        }
    }

    public resume(): void {
        if (this.state === 'paused') {
            this.state = 'running';
            this.lastTime = performance.now();
            this.resyncClock = true;
            logger.debug(`Resumed`);
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    }

    public wakeUp(): void {
        if (this.state === 'sleeping') {
            this.state = 'running';
            this.lastTime = performance.now();
            this.idleFrameCount = 0;
            this.resyncClock = true;
            logger.debug(`Woke up from sleep`);
            this.animationFrameId = requestAnimationFrame(this.loop);
        }
    }

    public getState(): GameLoopState {
        return this.state;
    }

    public isRunning(): boolean {
        return this.state === 'running' || this.state === 'sleeping';
    }

    public getTargetFPS(): number {
        return this.targetFPS;
    }

    public getAutoAdjustFPS(): boolean {
        return this.autoAdjustFPS;
    }

    public setAutoAdjustFPS(value: boolean): void {
        this.autoAdjustFPS = value;
        if (value) {
            this.targetFPS = this.userTargetFPS;
            this.fixedDt = 1 / this.targetFPS;
            this.resetFPSHistory();
        }
    }

    public setTargetFPS(value: number): void {
        const clamped = Math.max(1, Math.min(120, value));
        this.userTargetFPS = clamped;
        this.targetFPS = clamped;
        this.fixedDt = 1 / clamped;
        this.autoAdjustFPS = false;
    }

    public resetIdle(): void {
        this.idleFrameCount = 0;
    }

    private resetFPSHistory(): void {
        this.frameTimeHistory = new Array(this.FPS_WINDOW_SIZE).fill(0);
        this.frameTimeIndex = 0;
        this.fpsCheckCounter = 0;
        this.fpsWarmupFrames = 0;
    }

    private loop(timestamp?: number): void {
        if (this.state !== 'running') return;

        const now = timestamp !== undefined ? timestamp : performance.now();

        if (this.resyncClock) {
            this.resyncClock = false;
            this.lastFrameTime = now;
            this.accumulator = 0;
        }

        const frameMs = now - this.lastFrameTime;
        this.lastFrameTime = now;

        if (this.autoAdjustFPS) {
            this.fpsWarmupFrames++;

            if (this.fpsWarmupFrames > this.FPS_WARMUP_FRAMES) {
                const cappedFrameMs = Math.min(frameMs, 100);
                this.frameTimeHistory[this.frameTimeIndex] = cappedFrameMs;
                this.frameTimeIndex = (this.frameTimeIndex + 1) % this.FPS_WINDOW_SIZE;
                this.fpsCheckCounter++;

                if (this.fpsCheckCounter >= this.FPS_CHECK_INTERVAL) {
                    this.fpsCheckCounter = 0;
                    this.evaluateAdaptiveFPS();
                }
            }
        }

        this.accumulator += Math.min(frameMs / 1000, 0.1);
        this.lastTime = now;

        let steps = 0;
        while (this.accumulator >= this.fixedDt) {
            this.accumulator -= this.fixedDt;
            steps++;
        }

        const alpha = this.accumulator / this.fixedDt;
        const didWork = this.host.processFrame(steps, alpha, this.fixedDt);

        if (didWork) {
            this.idleFrameCount = 0;
        } else {
            this.idleFrameCount++;
            if (this.idleFrameCount >= this.IDLE_THRESHOLD) {
                this.state = 'sleeping';
                logger.debug(`Entering sleep (${this.idleFrameCount} idle frames)`);
                return;
            }
        }

        this.animationFrameId = requestAnimationFrame(this.loop);
    }

    private evaluateAdaptiveFPS(): void {
        let total = 0;
        let slow = 0;
        let count = 0;

        for (const ms of this.frameTimeHistory) {
            if (ms <= 0) continue;
            total += ms;
            count++;
            if (ms > this.FPS_SLOW_THRESHOLD_MS) slow++;
        }
        if (count === 0) return;

        const avgMs = total / count;
        const slowRatio = slow / count;
        const previous = this.targetFPS;

        if (this.targetFPS === 60) {
            if (avgMs > this.FPS_DOWNGRADE_AVG_MS && slowRatio > this.FPS_DOWNGRADE_SLOW_PCT) {
                this.targetFPS = 30;
            }
        } else if (this.targetFPS === 30) {
            if (avgMs < this.FPS_UPGRADE_AVG_MS && slowRatio < this.FPS_UPGRADE_SLOW_PCT) {
                this.targetFPS = 60;
            }
        }

        if (this.targetFPS !== previous) {
            this.fixedDt = 1 / this.targetFPS;
            this.host.onTargetFPSChanged(this.targetFPS);
            logger.info(`[LoopLifecycle] FPS-Anpassung: avg=${avgMs.toFixed(2)}ms, ${(slowRatio * 100).toFixed(0)}% langsam -> targetFPS=${this.targetFPS}`);
        }
    }
}
