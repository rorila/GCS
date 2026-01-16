
import * as fs from 'fs';
import * as path from 'path';

const projectPath = path.join(__dirname, '../demos/project_NewTennis33.json');
const rawData = fs.readFileSync(projectPath, 'utf8');
const project = JSON.parse(rawData);

const descriptions: Record<string, string> = {
    // Tasks
    "InitialAllGameElements": "Resets the score, ball position, and synchronizes the ball for Player 1.",
    "ResetScore": "Resets the scores of both players to zero.",
    "StartGame": "Orchestrates the game start: initializes elements, serves the ball, sends start message, and enables movement/collisions.",
    "ServeBall": "Sets the initial velocity for the ball to start the rally.",
    "HandleBallBoundary": "Handles collision with walls: bounces off top/bottom, or triggers scoring if hits left/right.",
    "RightPlayerScores": "Increments Player 2 score and resets the ball direction.",
    "LeftPlayerScores": "Increments Player 1 score and resets the ball direction.",
    "HandlePaddleHit": "Calculates the bounce angle based on relative impact position and reverses horizontal direction.",
    "PauseGame": "Pauses the game loop, stopping usage of physics and inputs.",
    "ResumeGame": "Resumes the game loop, re-enabling physics and inputs.",
    "PeriodicSync": "Periodically synchronizes critical game state (paddles, ball) across the network.",
    "SendStartMessage": "Updates UI elements to inform players that the game has begun.",

    // Actions (Input/Movement)
    "SendLeftPaddleUp": "Moves the left paddle upwards by setting negative Y velocity.",
    "SendLeftPaddleDown": "Moves the left paddle downwards by setting positive Y velocity.",
    "StopLeftPaddle": "Stops the left paddle by setting Y velocity to zero.",
    "SendRightPaddleUp": "Moves the right paddle upwards by setting negative Y velocity.",
    "SendRightPaddleDown": "Moves the right paddle downwards by setting positive Y velocity.",
    "StopRightPaddle": "Stops the right paddle by setting Y velocity to zero.",

    // Actions (Logic)
    "resetBall": "Resets the ball sprite to the center of the court (32, 19).",
    "SyncBall": "Broadcasts current ball position and velocity to connected peers.",
    "setToastInfoToRunning": "Displays a toast message 'Das Spiel wurde gestartet'.",
    "setStatusLabelToRunning": "Updates the status label text to 'Spiel wurde gestartet'.",
    "setGameStatusToPaused": "Sets the GameState.spritesMoving to false to pause physics.",
    "SetSpriteMovingToTrue": "Sets GameState.spritesMoving to true to enable physics.",
    "SetCollisionsToTrue": "Enables collision detection in the GameState.",
    "SyncLeftPaddle": "Syncs LeftPaddle properties (y, velocityY) to network.",
    "SyncRightPaddle": "Syncs RightPaddle properties (y, velocityY) to network.",
    "SyncGameState": "Syncs global game state flags to network.",
    "Log Start": "Logs debug info when a boundary is hit.",
    "Calc Paddle Half": "Calculates half the height of the paddle for collision math.",
    "Calc Bounce Factor": "Determines the angle of reflection based on impact point."
};

let updateCount = 0;

// Update Tasks
if (project.tasks) {
    project.tasks.forEach((task: any) => {
        if (descriptions[task.name]) {
            task.description = descriptions[task.name];
            updateCount++;
        }
    });
}

// Update Actions
if (project.actions) {
    project.actions.forEach((action: any) => {
        if (descriptions[action.name]) {
            action.description = descriptions[action.name];
            updateCount++;
        }
    });
}

// Update embedded elements in flowGraph (for persistence) 
// Note: FlowEditor usually rebuilds from tasks/actions but good to have consistency
if (project.tasks) {
    project.tasks.forEach((task: any) => {
        if (task.flowGraph && task.flowGraph.elements) {
            task.flowGraph.elements.forEach((el: any) => {
                if (el.properties && descriptions[el.properties.name]) {
                    el.properties.description = descriptions[el.properties.name];
                    // Also update data.description if present
                    if (el.data) el.data.description = descriptions[el.properties.name];
                    updateCount++;
                }
            });
        }
    });
}

fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf8');
console.log(`Updated ${updateCount} items with descriptions in ${projectPath}`);
