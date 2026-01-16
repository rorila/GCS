export class GameBase {
    private isRunning: boolean = false;
    private isPaused: boolean = false;

    constructor() {
        // Init
    }

    public start() {
        this.isRunning = true;
        console.log("Game Engine Started");
    }

    public stop() {
        this.isRunning = false;
        console.log("Game Engine Stopped");
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
