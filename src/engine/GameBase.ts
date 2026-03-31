
import { Logger } from '../utils/Logger';

const logger = Logger.get('GameBase');
export class GameBase {
    private isRunning: boolean = false;
    private isPaused: boolean = false;

    constructor() {
        // Init
    }

    public start() {
        this.isRunning = true;
        logger.info("Game Engine Started");
    }

    public stop() {
        this.isRunning = false;
        logger.info("Game Engine Stopped");
    }

    public pause() {
        if (this.isRunning) {
            this.isPaused = true;
        }
    }

    public resume() {
        if (this.isRunning && this.isPaused) {
            this.isPaused = false;
        }
    }
}
