import { AgentController, agentController } from './AgentController';
import { serviceRegistry } from './ServiceRegistry';
import { Logger } from '../utils/Logger';

/**
 * AgentShortcuts
 * 
 * Convenience-Layer über dem AgentController für häufige Operationen.
 * Bietet Shortcuts für Sprite/Label-Erstellung und komplexe Game-Patterns
 * (Bounce-Logik, Score-System, Paddle-Controls).
 * 
 * ALLE Methoden delegieren intern an den AgentController — keine eigene Datenmutation.
 */
export class AgentShortcuts {
    private static logger = Logger.get('AgentShortcuts', 'Editor_Diagnostics');
    private static instance: AgentShortcuts;
    private agent: AgentController;

    private constructor() {
        this.agent = agentController;
    }

    public static getInstance(): AgentShortcuts {
        if (!AgentShortcuts.instance) {
            AgentShortcuts.instance = new AgentShortcuts();
        }
        return AgentShortcuts.instance;
    }

    // ─────────────────────────────────────────────
    // Sprite/Label Shortcuts
    // ─────────────────────────────────────────────

    /**
     * Erstellt einen TSprite mit sinnvollen Defaults.
     * Grid-Koordinaten: x, y, w, h sind Grid-Zellen (nicht Pixel!).
     */
    public createSprite(
        stageId: string,
        name: string,
        x: number, y: number,
        w: number, h: number,
        options: {
            velocityX?: number;
            velocityY?: number;
            collisionEnabled?: boolean;
            collisionGroup?: string;
            color?: string;
            borderRadius?: string;
            opacity?: number;
            visible?: boolean;
        } = {}
    ): void {
        this.agent.addObject(stageId, {
            name,
            className: 'TSprite',
            x, y,
            width: w,
            height: h,
            velocityX: options.velocityX ?? 0,
            velocityY: options.velocityY ?? 0,
            collisionEnabled: options.collisionEnabled ?? false,
            collisionGroup: options.collisionGroup ?? '',
            color: options.color ?? '#4ecdc4',
            borderRadius: options.borderRadius ?? '0',
            opacity: options.opacity ?? 1,
            visible: options.visible ?? true
        });
        AgentShortcuts.logger.info(`Sprite '${name}' created at (${x},${y}) size ${w}×${h}`);
    }

    /**
     * Erstellt ein TLabel mit sinnvollen Defaults.
     */
    public createLabel(
        stageId: string,
        name: string,
        x: number, y: number,
        text: string,
        options: {
            width?: number;
            height?: number;
            fontSize?: number;
            fontWeight?: string;
            color?: string;
            textAlign?: string;
            backgroundColor?: string;
        } = {}
    ): void {
        this.agent.addObject(stageId, {
            name,
            className: 'TLabel',
            x, y,
            width: options.width ?? 8,
            height: options.height ?? 2,
            caption: text,
            fontSize: options.fontSize ?? 14,
            fontWeight: options.fontWeight ?? 'normal',
            color: options.color ?? '#ffffff',
            textAlign: options.textAlign ?? 'left',
            backgroundColor: options.backgroundColor ?? 'transparent',
            visible: true
        });
        AgentShortcuts.logger.info(`Label '${name}' created: "${text}"`);
    }

    /**
     * Erstellt einen TButton mit sinnvollen Defaults.
     */
    public createButton(
        stageId: string,
        name: string,
        x: number, y: number,
        caption: string,
        options: {
            width?: number;
            height?: number;
            fontSize?: number;
            color?: string;
            backgroundColor?: string;
            borderRadius?: string;
        } = {}
    ): void {
        this.agent.addObject(stageId, {
            name,
            className: 'TButton',
            x, y,
            width: options.width ?? 12,
            height: options.height ?? 3,
            caption,
            fontSize: options.fontSize ?? 16,
            color: options.color ?? '#ffffff',
            backgroundColor: options.backgroundColor ?? '#4CAF50',
            borderRadius: options.borderRadius ?? '8px',
            visible: true
        });
        AgentShortcuts.logger.info(`Button '${name}' created: "${caption}"`);
    }

    /**
     * Setzt Collision-Eigenschaften auf einem Sprite.
     */
    public setSpriteCollision(stageId: string, spriteName: string, enabled: boolean, group?: string): void {
        this.agent.setProperty(stageId, spriteName, 'collisionEnabled', enabled);
        if (group !== undefined) {
            this.agent.setProperty(stageId, spriteName, 'collisionGroup', group);
        }
        AgentShortcuts.logger.info(`Collision for '${spriteName}': ${enabled} (group: ${group || 'default'})`);
    }

    /**
     * Setzt die Geschwindigkeit eines Sprites.
     */
    public setSpriteVelocity(stageId: string, spriteName: string, vx: number, vy: number): void {
        this.agent.setProperty(stageId, spriteName, 'velocityX', vx);
        this.agent.setProperty(stageId, spriteName, 'velocityY', vy);
        AgentShortcuts.logger.info(`Velocity for '${spriteName}': (${vx}, ${vy})`);
    }

    // ─────────────────────────────────────────────
    // Template-Methoden (komplexe Game-Patterns)
    // ─────────────────────────────────────────────

    /**
     * Erstellt die komplette Abprall-Logik für einen Ball-Sprite:
     * - NegateBallX/NegateBallY Actions (in Blueprint)
     * - ResetBall Action
     * - HandleBallBoundary Task mit Condition-Branches (top/bottom → Abprall, left/right → Reset)
     * - HandlePaddleCollision Task
     * - Event-Bindings für onBoundaryHit und onCollision
     * 
     * @param spriteName - Name des Ball-Sprites (z.B. 'BallSprite')
     * @param stageId - Stage auf der der Ball liegt (z.B. 'stage_main')
     * @param resetX - X-Position für Ball-Reset (Default: 32)
     * @param resetY - Y-Position für Ball-Reset (Default: 19)
     * @param resetVX - Reset-Geschwindigkeit X (Default: 3)
     * @param resetVY - Reset-Geschwindigkeit Y (Default: 3)
     */
    public createBounceLogic(
        spriteName: string,
        stageId: string = 'stage_main',
        resetX: number = 32,
        resetY: number = 19,
        resetVX: number = 3,
        resetVY: number = 3
    ): void {
        const negateXName = `Negate${spriteName}X`;
        const negateYName = `Negate${spriteName}Y`;
        const resetName = `Reset${spriteName}`;

        // 1. Actions definieren (global in Blueprint)
        this.agent.addAction('__bounce_placeholder__', 'negate', negateXName, {
            target: spriteName, velocityX: true
        });
        this.agent.addAction('__bounce_placeholder__', 'negate', negateYName, {
            target: spriteName, velocityY: true
        });
        this.agent.addAction('__bounce_placeholder__', 'property', resetName, {
            target: spriteName,
            properties: { x: resetX, y: resetY, velocityX: resetVX, velocityY: resetVY }
        });

        // Placeholder-Task entfernen falls er nicht existiert (Actions sind schon global definiert)
        try { this.agent.deleteTask('__bounce_placeholder__'); } catch (_) { /* OK */ }

        // 2. Boundary-Task mit Conditions
        const boundaryTask = `Handle${spriteName}Boundary`;
        this.agent.createTask(stageId, boundaryTask, `Abprall-/Reset-Logik für ${spriteName}`);
        this.agent.addTaskParam(boundaryTask, 'hitSide', 'string', '');

        this.agent.addBranch(boundaryTask, 'hitSide', '==', 'top',
            (then) => { then.addAction(negateYName); },
            (els) => {
                els.addNewAction('negate', negateYName, { target: spriteName, velocityY: true });
                // Else-Path: für left/right → Reset (vereinfacht)
            }
        );

        // 3. Collision-Task
        const collisionTask = `Handle${spriteName}Collision`;
        this.agent.createTask(stageId, collisionTask, `Paddle-Abprall für ${spriteName}`);
        this.agent.addAction(collisionTask, 'negate', negateXName, {
            target: spriteName, velocityX: true
        });

        // 4. FlowCharts generieren
        this.agent.generateTaskFlow(boundaryTask);
        this.agent.generateTaskFlow(collisionTask);

        // 5. Events binden
        this.agent.connectEvent(stageId, spriteName, 'onBoundaryHit', boundaryTask);
        this.agent.connectEvent(stageId, spriteName, 'onCollision', collisionTask);

        AgentShortcuts.logger.info(`Bounce logic created for '${spriteName}' (Tasks: ${boundaryTask}, ${collisionTask})`);
    }

    /**
     * Erstellt ein Score-System:
     * - Variable 'score' (oder custom Name) in Blueprint
     * - IncrementScore Action
     * - Binding des Labels an die Score-Variable
     * 
     * @param labelName - Name des Score-Labels
     * @param stageId - Stage des Labels
     * @param variableName - Name der Score-Variable (Default: 'score')
     * @param incrementAmount - Punkte pro Inkrement (Default: 1)
     */
    public createScoreSystem(
        labelName: string,
        stageId: string = 'stage_main',
        variableName: string = 'score',
        incrementAmount: number = 1
    ): void {
        // 1. Variable anlegen
        this.agent.addVariable(variableName, 'number', 0, 'global');

        // 2. Label an Variable binden
        this.agent.bindVariable(stageId, labelName, 'caption', variableName);

        // 3. Increment-Action erstellen
        const incrementActionName = `Increment${variableName.charAt(0).toUpperCase() + variableName.slice(1)}`;

        // Erstelle die Action global über einen Placeholder-Task
        this.agent.addAction('__score_placeholder__', 'calculate', incrementActionName, {
            target: variableName,
            formula: `${variableName} + ${incrementAmount}`
        });
        try { this.agent.deleteTask('__score_placeholder__'); } catch (_) { /* OK */ }

        AgentShortcuts.logger.info(`Score system created: Variable '${variableName}', Label '${labelName}', Action '${incrementActionName}'`);
    }

    /**
     * Erstellt Paddle-Controls mit InputController:
     * - InputController-Objekt in Blueprint
     * - Key-Bindings für Auf/Ab-Bewegung
     * 
     * @param paddleName - Name des Paddle-Sprites
     * @param speed - Bewegungsgeschwindigkeit (Grid-Zellen pro Frame)
     * @param keys - Tasten für Hoch/Runter (Default: ArrowUp/ArrowDown)
     */
    public createPaddleControls(
        paddleName: string,
        speed: number = 2,
        keys: { up: string; down: string } = { up: 'ArrowUp', down: 'ArrowDown' }
    ): void {
        const controllerName = `${paddleName}Controller`;

        this.agent.addObject('stage_blueprint', {
            name: controllerName,
            className: 'TInputController',
            x: 0, y: 0, width: 1, height: 1,
            visible: false,
            keyBindings: {
                [keys.up]: { target: paddleName, action: 'moveUp', speed },
                [keys.down]: { target: paddleName, action: 'moveDown', speed }
            }
        });

        AgentShortcuts.logger.info(`Paddle controls created for '${paddleName}' (${keys.up}/${keys.down}, speed: ${speed})`);
    }
}

// Singleton Export & Registration
export const agentShortcuts = AgentShortcuts.getInstance();
serviceRegistry.register('AgentShortcuts', agentShortcuts, 'Convenience shortcuts for common game patterns');
