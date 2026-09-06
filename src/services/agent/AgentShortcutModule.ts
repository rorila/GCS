import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';

/**
 * AgentShortcutModule
 *
 * Kapselt alle Komponenten-Shortcuts des AgentController.
 * Jedes `createXxx` baut nur die Datenstruktur auf und delegiert an
 * `AgentController.addObject()` / `AgentController.setProperty()`.
 */
export class AgentShortcutModule {
    private logger = Logger.get('AgentShortcutModule', 'Editor_Diagnostics');

    constructor(private controller: AgentController) {}

    // ─────────────────────────────────────────────
    // Sprite-Shortcuts & Container
    // ─────────────────────────────────────────────

    /**
     * Erstellt ein TSprite-Objekt mit Physik-Defaults.
     * @param opts - Optionale Properties: velocityX, velocityY, collisionEnabled, collisionGroup, shape, spriteColor, backgroundImage, objectFit
     */
    public createSprite(stageId: string, name: string, x: number, y: number, width: number, height: number, opts: Record<string, any> = {}): void {
        const spriteData: any = {
            className: 'TSprite',
            name,
            x, y, width, height,
            velocityX: opts.velocityX ?? 0,
            velocityY: opts.velocityY ?? 0,
            collisionEnabled: opts.collisionEnabled ?? false,
            collisionGroup: opts.collisionGroup ?? 'default',
            shape: opts.shape ?? 'rect',
            spriteColor: opts.spriteColor ?? '#ff6b6b',
            style: {
                backgroundColor: opts.spriteColor ?? opts.style?.backgroundColor ?? '#ff6b6b',
                borderColor: opts.style?.borderColor ?? '#333',
                borderWidth: opts.style?.borderWidth ?? 1,
                borderRadius: opts.shape === 'circle' ? 999 : (opts.style?.borderRadius ?? 0),
                ...(opts.style || {})
            }
        };
        if (opts.backgroundImage) spriteData.backgroundImage = opts.backgroundImage;
        if (opts.objectFit) spriteData.objectFit = opts.objectFit;
        if (opts.lerpSpeed !== undefined) spriteData.lerpSpeed = opts.lerpSpeed;

        this.controller.addObject(stageId, spriteData);
        this.logger.info(`Sprite '${name}' created in '${stageId}' at (${x},${y}) ${width}×${height}`);
    }

    /**
     * Erstellt ein TGroupPanel-Objekt (Container für Logik-Gruppierung).
     * @param opts - Optionale Properties: style, children (wird als leer initialisiert)
     */
    public createGroupPanel(stageId: string, name: string, x: number, y: number, width: number, height: number, opts: Record<string, any> = {}): void {
        const panelData: any = {
            className: 'TGroupPanel',
            name,
            x, y, width, height,
            children: opts.children ?? [],
            style: {
                backgroundColor: opts.backgroundColor ?? opts.style?.backgroundColor ?? 'rgba(255,255,255,0.05)',
                borderColor: opts.borderColor ?? opts.style?.borderColor ?? '#444',
                borderWidth: opts.borderWidth ?? opts.style?.borderWidth ?? 1,
                borderRadius: opts.borderRadius ?? opts.style?.borderRadius ?? 4,
                ...(opts.style || {})
            }
        };
        this.controller.addObject(stageId, panelData);
        this.logger.info(`GroupPanel '${name}' created in '${stageId}' at (${x},${y})`);
    }

    /**
     * Erstellt ein TDialogRoot-Objekt (Popup/Dialog).
     * @param opts - Optionale Properties: title, modal, closable, draggable
     */
    public createDialog(stageId: string, name: string, x: number, y: number, width: number, height: number, opts: Record<string, any> = {}): void {
        const dialogData: any = {
            className: 'TDialogRoot',
            name,
            x, y, width, height,
            title: opts.title ?? name,
            modal: opts.modal ?? true,
            closable: opts.closable ?? true,
            draggable: opts.draggable ?? true,
            visible: opts.visible ?? false,
            children: opts.children ?? [],
            style: {
                backgroundColor: opts.backgroundColor ?? opts.style?.backgroundColor ?? '#2b2b2b',
                borderColor: opts.borderColor ?? opts.style?.borderColor ?? '#555',
                borderWidth: opts.borderWidth ?? opts.style?.borderWidth ?? 2,
                borderRadius: opts.borderRadius ?? opts.style?.borderRadius ?? 8,
                ...(opts.style || {})
            }
        };
        this.controller.addObject(stageId, dialogData);
        this.logger.info(`Dialog '${name}' created in '${stageId}' at (${x},${y})`);
    }

    /**
     * Erstellt ein TLabel-Objekt mit optionalem Variable-Binding.
     * @param text - Anzeige-Text. Für Variable-Binding: ${VariablenName}
     * @param opts - Optionale Style-Properties: fontSize, fontWeight, color, textAlign, backgroundColor
     */
    public createLabel(stageId: string, name: string, x: number, y: number, text: string, opts: Record<string, any> = {}): void {
        const labelData: any = {
            className: 'TLabel',
            name,
            x, y,
            width: opts.width ?? 6,
            height: opts.height ?? 2,
            text,
            style: {
                color: opts.color ?? '#ffffff',
                fontSize: opts.fontSize ?? 16,
                fontWeight: opts.fontWeight ?? 'normal',
                textAlign: opts.textAlign ?? 'center',
                backgroundColor: opts.backgroundColor ?? 'transparent',
                ...(opts.style || {})
            }
        };

        this.controller.addObject(stageId, labelData);
        this.logger.info(`Label '${name}' created in '${stageId}': "${text}"`);
    }

    /**
     * Setzt die Kollisions-Konfiguration eines Sprites.
     */
    public setSpriteCollision(stageId: string, spriteName: string, enabled: boolean, group?: string): void {
        this.controller.setProperty(stageId, spriteName, 'collisionEnabled', enabled);
        if (group !== undefined) {
            this.controller.setProperty(stageId, spriteName, 'collisionGroup', group);
        }
        this.logger.info(`Collision config for '${spriteName}': enabled=${enabled}, group=${group ?? '(unchanged)'}`);
    }

    /**
     * Setzt die Geschwindigkeit eines Sprites.
     */
    public setSpriteVelocity(stageId: string, spriteName: string, velocityX: number, velocityY: number): void {
        this.controller.setProperty(stageId, spriteName, 'velocityX', velocityX);
        this.controller.setProperty(stageId, spriteName, 'velocityY', velocityY);
        this.logger.info(`Velocity for '${spriteName}': vx=${velocityX}, vy=${velocityY}`);
    }

    // ─────────────────────────────────────────────
    // Komponenten-Shortcuts für neuere Komponenten
    // ─────────────────────────────────────────────

    /**
     * Erstellt einen TTimer (Wiederholungs-Timer mit currentInterval).
     * @param opts - Optionale Properties: interval, enabled, maxInterval, currentInterval, width, height, style
     */
    public createTimer(stageId: string, name: string, x: number = 0, y: number = 0, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TTimer',
            name,
            x, y,
            width: opts.width ?? 4,
            height: opts.height ?? 2,
            interval: opts.interval ?? 1000,
            enabled: opts.enabled ?? false,
            maxInterval: opts.maxInterval ?? 0,
            currentInterval: opts.currentInterval ?? 0,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`Timer '${name}' created in '${stageId}'`);
    }

    /**
     * Erstellt einen TIntervalTimer (feuert onIntervall / onTimeout).
     * @param opts - Optionale Properties: duration, count, enabled, width, height, style
     */
    public createIntervalTimer(stageId: string, name: string, x: number = 0, y: number = 0, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TIntervalTimer',
            name,
            x, y,
            width: opts.width ?? 4,
            height: opts.height ?? 2,
            duration: opts.duration ?? 1000,
            count: opts.count ?? 0,
            enabled: opts.enabled ?? false,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`IntervalTimer '${name}' created in '${stageId}'`);
    }

    /**
     * Erstellt eine TThresholdVariable als Stage-Objekt.
     * @param opts - Optionale Properties: value, threshold, comparison, onThresholdReached, onThresholdLeft, onThresholdExceeded, width, height, style
     */
    public createThresholdVariable(stageId: string, name: string, x: number = 0, y: number = 0, opts: Record<string, any> = {}): void {
        const events: Record<string, string> = {};
        if (opts.onThresholdReached) events.onThresholdReached = opts.onThresholdReached;
        if (opts.onThresholdLeft) events.onThresholdLeft = opts.onThresholdLeft;
        if (opts.onThresholdExceeded) events.onThresholdExceeded = opts.onThresholdExceeded;

        const data: any = {
            className: 'TThresholdVariable',
            name,
            x, y,
            width: opts.width ?? 4,
            height: opts.height ?? 2,
            value: opts.value ?? 0,
            threshold: opts.threshold ?? 100,
            comparison: opts.comparison ?? '>=',
            isVariable: true,
            style: { ...(opts.style || {}) }
        };
        if (Object.keys(events).length > 0) data.events = events;
        this.controller.addObject(stageId, data);
        this.logger.info(`ThresholdVariable '${name}' created in '${stageId}'`);
    }

    /**
     * Erstellt einen TInputController.
     * @param opts - Optionale Properties: keyBindings, enabled, width, height, style
     */
    public createInputController(stageId: string, name: string, x: number = 0, y: number = 0, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TInputController',
            name,
            x, y,
            width: opts.width ?? 4,
            height: opts.height ?? 2,
            enabled: opts.enabled ?? true,
            keyBindings: opts.keyBindings ?? {},
            visible: opts.visible ?? false,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`InputController '${name}' created in '${stageId}'`);
    }

    /**
     * Erstellt einen TButton.
     * @param opts - Optionale Properties: width, height, fontSize, color, backgroundColor, borderRadius, icon, style
     */
    public createButton(stageId: string, name: string, x: number, y: number, caption: string, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TButton',
            name,
            x, y,
            width: opts.width ?? 12,
            height: opts.height ?? 3,
            caption,
            fontSize: opts.fontSize ?? 16,
            color: opts.color ?? '#ffffff',
            backgroundColor: opts.backgroundColor ?? '#4CAF50',
            borderRadius: opts.borderRadius ?? '8px',
            icon: opts.icon ?? '',
            visible: opts.visible ?? true,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`Button '${name}' created in '${stageId}': "${caption}"`);
    }

    /**
     * Erstellt eine TVideo-Komponente.
     * @param opts - Optionale Properties: autoplay, loop, muted, objectFit, imageOpacity, playbackRate, visible, style
     */
    public createVideo(stageId: string, name: string, x: number, y: number, width: number, height: number, videoSource: string, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TVideo',
            name,
            x, y, width, height,
            videoSource,
            autoplay: opts.autoplay ?? false,
            loop: opts.loop ?? false,
            muted: opts.muted ?? false,
            objectFit: opts.objectFit ?? 'contain',
            imageOpacity: opts.imageOpacity ?? 1,
            playbackRate: opts.playbackRate ?? 1,
            visible: opts.visible ?? true,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`Video '${name}' created in '${stageId}'`);
    }

    /**
     * Erstellt eine TLink-Komponente.
     * @param opts - Optionale Properties: width, height, text, underline, color, visible, style
     */
    public createLink(stageId: string, name: string, x: number, y: number, url: string, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TLink',
            name,
            x, y,
            width: opts.width ?? 8,
            height: opts.height ?? 2,
            text: opts.text ?? name,
            url,
            underline: opts.underline ?? true,
            color: opts.color ?? '#4fc3f7',
            visible: opts.visible ?? true,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`Link '${name}' created in '${stageId}' → ${url}`);
    }

    /**
     * Erstellt eine TProgressBar-Komponente.
     * @param opts - Optionale Properties: value, maxValue, barColor, barBackgroundColor, showText, textTemplate, animateChanges, visible, style
     */
    public createProgressBar(stageId: string, name: string, x: number, y: number, width: number, height: number, opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TProgressBar',
            name,
            x, y, width, height,
            value: opts.value ?? 75,
            maxValue: opts.maxValue ?? 100,
            barColor: opts.barColor ?? '#4caf50',
            barBackgroundColor: opts.barBackgroundColor ?? '#333333',
            showText: opts.showText ?? true,
            textTemplate: opts.textTemplate ?? '${value} / ${maxValue}',
            animateChanges: opts.animateChanges ?? true,
            visible: opts.visible ?? true,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`ProgressBar '${name}' created in '${stageId}'`);
    }

    /**
     * Erstellt eine TStickyNote (nur im Editor sichtbar).
     * @param opts - Optionale Properties: title, noteColor, width, height, visible, style
     */
    public createStickyNote(stageId: string, name: string, x: number, y: number, text: string = 'Neue Notiz...', opts: Record<string, any> = {}): void {
        this.controller.addObject(stageId, {
            className: 'TStickyNote',
            name,
            x, y,
            width: opts.width ?? 6,
            height: opts.height ?? 4,
            title: opts.title ?? 'Notiz',
            text,
            noteColor: opts.noteColor ?? 'yellow',
            visible: opts.visible ?? true,
            style: { ...(opts.style || {}) }
        });
        this.logger.info(`StickyNote '${name}' created in '${stageId}'`);
    }
}
