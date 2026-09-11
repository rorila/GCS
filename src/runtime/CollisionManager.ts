import { TSprite } from '../components/TSprite';
import { GridConfig } from '../model/types';
import { PhysicsEngine } from './PhysicsEngine';
import { Logger } from '../utils/Logger';

const logger = Logger.get('CollisionManager', 'Runtime_Execution');

export interface BoundsInfo {
    width: number;
    height: number;
    offsetTop: number;
    offsetBottom: number;
}

/**
 * Kollisionsmanager: Erkennt Sprite-Sprite- und Sprite-Panel-Überschneidungen,
 * verwaltet Kollisions-Cooldowns und feuert die zugehörigen Events.
 */
export class CollisionManager {
    private boundaryMode: 'clamp' | 'bounce' | 'event-only' = 'clamp';
    private eventCallback: ((spriteId: string, eventName: string, data?: any) => void) | null = null;
    private gridConfig: GridConfig | null = null;

    private readonly collisionCooldowns = new Map<string, number>();
    private readonly boundaryCooldowns = new Map<string, number>();
    private readonly collidedThisFrame = new Set<string>();
    private readonly exitedSprites = new Set<string>();

    private readonly activeSpriteBuffer: TSprite[] = [];
    private readonly activePanelBuffer: any[] = [];

    private readonly COLLISION_COOLDOWN_MS = 200;
    private readonly BOUNDARY_COOLDOWN_MS = 500;

    public configure(
        gridConfig: GridConfig | null,
        boundaryMode: any,
        eventCallback?: (spriteId: string, eventName: string, data?: any) => void
    ): void {
        this.gridConfig = gridConfig;
        this.boundaryMode = boundaryMode || 'clamp';
        this.eventCallback = eventCallback || null;
    }

    public clear(): void {
        this.collisionCooldowns.clear();
        this.boundaryCooldowns.clear();
        this.collidedThisFrame.clear();
        this.exitedSprites.clear();
        this.activeSpriteBuffer.length = 0;
        this.activePanelBuffer.length = 0;
    }

    public clearTrackingFor(spriteId: string): void {
        if (!spriteId) return;

        this.collidedThisFrame.delete(spriteId);
        this.exitedSprites.delete(spriteId);

        for (const key of Array.from(this.collisionCooldowns.keys())) {
            if (key.startsWith(`${spriteId}_`) || key.endsWith(`_${spriteId}`)) {
                this.collisionCooldowns.delete(key);
            }
        }
        for (const key of Array.from(this.boundaryCooldowns.keys())) {
            if (key.startsWith(`${spriteId}_`)) {
                this.boundaryCooldowns.delete(key);
            }
        }
    }

    public checkCollisions(sprites: TSprite[], panels: any[]): void {
        this.collidedThisFrame.clear();

        const activeSprites = this.activeSpriteBuffer;
        activeSprites.length = 0;
        for (const sprite of sprites) {
            if (!sprite.visible) continue;
            if (sprite.isAnimating) continue;
            if ((sprite as any).collisionEnabled === false) continue;
            activeSprites.push(sprite);
        }

        this.checkSpriteVsSpriteCollisions(activeSprites);
        this.checkSpriteVsPanelCollisions(activeSprites, panels);
    }

    private checkSpriteVsSpriteCollisions(activeSprites: TSprite[]): void {
        for (let i = 0; i < activeSprites.length; i++) {
            for (let j = i + 1; j < activeSprites.length; j++) {
                const spriteA = activeSprites[i];
                const spriteB = activeSprites[j];

                if (!spriteA.visible || !spriteB.visible) continue;
                if (spriteA.isAnimating || spriteB.isAnimating) continue;
                if ((spriteA as any).collisionEnabled === false || (spriteB as any).collisionEnabled === false) continue;

                const parentA = (spriteA as any).parentId || (spriteA.parent ? spriteA.parent.id : null);
                const parentB = (spriteB as any).parentId || (spriteB.parent ? spriteB.parent.id : null);
                if (parentA !== parentB) continue;

                const groupA = (spriteA as any).collisionGroup || 'default';
                const groupB = (spriteB as any).collisionGroup || 'default';
                if (groupA !== 'default' && groupA === groupB) continue;

                const eventsA = (spriteA as any).events || (spriteA as any).Tasks || {};
                const eventsB = (spriteB as any).events || (spriteB as any).Tasks || {};
                const hasCollisionHandler =
                    eventsA.onCollision || eventsA.onCollisionTop || eventsA.onCollisionBottom ||
                    eventsA.onCollisionLeft || eventsA.onCollisionRight ||
                    eventsB.onCollision || eventsB.onCollisionTop || eventsB.onCollisionBottom ||
                    eventsB.onCollisionLeft || eventsB.onCollisionRight;
                if (!hasCollisionHandler) continue;

                const overlap = spriteA.getCollisionOverlap(spriteB);
                if (overlap) {
                    const now = performance.now();
                    const pairKey = `${spriteA.id}_${spriteB.id}`;
                    const lastCollision = this.collisionCooldowns.get(pairKey) || 0;

                    if (now - lastCollision < this.COLLISION_COOLDOWN_MS) continue;

                    this.collisionCooldowns.set(pairKey, now);

                    const wantsPushOut = (spriteA as any).pushOutOnCollision || (spriteB as any).pushOutOnCollision;
                    if (wantsPushOut) {
                        PhysicsEngine.resolveSpriteCollision(spriteA, spriteB, overlap);
                    }

                    if (this.eventCallback) {
                        this.eventCallback(spriteA.id, 'onCollision', {
                            other: spriteB.name,
                            otherSprite: spriteB,
                            hitSide: overlap.side,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });

                        const oppositeSide = {
                            'left': 'right',
                            'right': 'left',
                            'top': 'bottom',
                            'bottom': 'top'
                        }[overlap.side] as string;

                        this.eventCallback(spriteB.id, 'onCollision', {
                            other: spriteA.name,
                            otherSprite: spriteA,
                            hitSide: oppositeSide,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });

                        this.eventCallback(spriteA.id, `onCollision${this.capitalize(overlap.side)}`, {
                            other: spriteB.name,
                            otherSprite: spriteB,
                            hitSide: overlap.side,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });
                        this.eventCallback(spriteB.id, `onCollision${this.capitalize(oppositeSide)}`, {
                            other: spriteA.name,
                            otherSprite: spriteA,
                            hitSide: oppositeSide,
                            contactX: overlap.contactX,
                            contactY: overlap.contactY
                        });

                        this.collidedThisFrame.add(spriteA.id);
                        this.collidedThisFrame.add(spriteB.id);
                    }
                }
            }
        }
    }

    private checkSpriteVsPanelCollisions(activeSprites: TSprite[], panels: any[]): void {
        const activePanels = this.activePanelBuffer;
        activePanels.length = 0;
        for (const panel of panels) {
            if (!panel.visible) continue;
            if (panel.isAnimating) continue;
            if (panel.collisionEnabled === false) continue;
            activePanels.push(panel);
        }

        for (let i = 0; i < activeSprites.length; i++) {
            for (let j = 0; j < activePanels.length; j++) {
                const sprite = activeSprites[i];
                const panel = activePanels[j];

                if (!sprite.visible || !panel.visible) continue;
                if (sprite.isAnimating || panel.isAnimating) continue;

                const spriteParentId = (sprite as any).parentId || (sprite.parent ? sprite.parent.id : null);
                if (spriteParentId === panel.id || spriteParentId === panel.name) continue;

                const panelParentId = (panel as any).parentId || (panel.parent ? panel.parent.id : null);
                if (spriteParentId !== panelParentId) continue;

                if ((sprite as any).collisionEnabled === false || (panel as any).collisionEnabled === false) continue;

                const panelHitbox = {
                    x: panel.x,
                    y: panel.y,
                    w: panel.width,
                    h: panel.height,
                    shape: 'rect' as const
                };

                const spriteHb = sprite.getHitbox();

                let isColliding = false;
                if (spriteHb.shape === 'rect') {
                    isColliding = spriteHb.x < panelHitbox.x + panelHitbox.w &&
                                  spriteHb.x + spriteHb.w > panelHitbox.x &&
                                  spriteHb.y < panelHitbox.y + panelHitbox.h &&
                                  spriteHb.y + spriteHb.h > panelHitbox.y;
                } else if (spriteHb.shape === 'circle') {
                    const r = spriteHb.w / 2;
                    const cx = spriteHb.x + r;
                    const cy = spriteHb.y + spriteHb.h / 2;
                    const closestX = Math.max(panelHitbox.x, Math.min(cx, panelHitbox.x + panelHitbox.w));
                    const closestY = Math.max(panelHitbox.y, Math.min(cy, panelHitbox.y + panelHitbox.h));
                    const dx = cx - closestX;
                    const dy = cy - closestY;
                    isColliding = (dx * dx + dy * dy) < (r * r);
                }

                if (isColliding) {
                    const now = performance.now();
                    const pairKey = `panel_${sprite.id}_${panel.id}`;
                    const lastCollision = this.collisionCooldowns.get(pairKey) || 0;

                    if (now - lastCollision < this.COLLISION_COOLDOWN_MS) continue;
                    this.collisionCooldowns.set(pairKey, now);

                    const dx = (spriteHb.x + spriteHb.w / 2) - (panelHitbox.x + panelHitbox.w / 2);
                    const dy = (spriteHb.y + spriteHb.h / 2) - (panelHitbox.y + panelHitbox.h / 2);
                    const combinedHalfWidths = (spriteHb.w + panelHitbox.w) / 2;
                    const combinedHalfHeights = (spriteHb.h + panelHitbox.h) / 2;

                    const overlapX = combinedHalfWidths - Math.abs(dx);
                    const overlapY = combinedHalfHeights - Math.abs(dy);

                    let hitSide = 'left';
                    let depth = 0;

                    const vX = sprite.velocityX || 0;
                    const vY = sprite.velocityY || 0;

                    if (Math.abs(vX) > Math.abs(vY)) {
                        hitSide = dx > 0 ? 'left' : 'right';
                        depth = overlapX;
                        logger.debug(`[PHYSICS] Velocity-Horizontal: vX=${vX}, vY=${vY}, hitSide=${hitSide}, depth=${depth}`);
                    } else if (Math.abs(vY) > Math.abs(vX)) {
                        hitSide = dy > 0 ? 'top' : 'bottom';
                        depth = overlapY;
                        logger.debug(`[PHYSICS] Velocity-Vertical: vX=${vX}, vY=${vY}, hitSide=${hitSide}, depth=${depth}`);
                    } else {
                        if (overlapX < overlapY) {
                            hitSide = dx > 0 ? 'left' : 'right';
                            depth = overlapX;
                            logger.debug(`[PHYSICS] Geometric-Horizontal: overlapX=${overlapX} < overlapY=${overlapY}, hitSide=${hitSide}, depth=${depth}`);
                        } else {
                            hitSide = dy > 0 ? 'top' : 'bottom';
                            depth = overlapY;
                            logger.debug(`[PHYSICS] Geometric-Vertical: overlapY=${overlapY} <= overlapX=${overlapX}, hitSide=${hitSide}, depth=${depth}`);
                        }
                    }

                    const contactLeft = Math.max(spriteHb.x, panelHitbox.x);
                    const contactTop = Math.max(spriteHb.y, panelHitbox.y);
                    const contactRight = Math.min(spriteHb.x + spriteHb.w, panelHitbox.x + panelHitbox.w);
                    const contactBottom = Math.min(spriteHb.y + spriteHb.h, panelHitbox.y + panelHitbox.h);
                    const contactX = contactLeft + (contactRight - contactLeft) / 2;
                    const contactY = contactTop + (contactBottom - contactTop) / 2;

                    if (this.eventCallback) {
                        this.eventCallback(sprite.id, 'onCollision', {
                            other: panel.name,
                            otherSprite: panel,
                            hitSide: hitSide,
                            contactX,
                            contactY
                        });
                        this.eventCallback(sprite.id, `onCollision${this.capitalize(hitSide)}`, { other: panel });
                        this.collidedThisFrame.add(sprite.id);
                    }

                    const wantsPushOut = (sprite as any).pushOutOnCollision || (panel as any).pushOutOnCollision;
                    if (wantsPushOut) {
                        PhysicsEngine.resolvePanelCollision(sprite, hitSide, depth, this.boundaryMode);
                    }
                }
            }
        }
    }

    public checkBoundaries(sprites: TSprite[], panels: any[], bounds: BoundsInfo): void {
        for (const sprite of sprites) {
            if (!sprite.visible) continue;
            if ((sprite as any).collisionEnabled === false) continue;
            if (sprite.isAnimating) continue;
            if (this.collidedThisFrame.has(sprite.id)) continue;

            const sb = this.getSpriteBounds(sprite, panels, bounds);
            const within = sprite.isWithinBounds(sb.width, sb.height, 0, 0);

            if (!within.left) this.triggerBoundaryEvent(sprite, 'left', sb);
            if (!within.right) this.triggerBoundaryEvent(sprite, 'right', sb);
            if (sprite.y < sb.offsetTop) this.triggerBoundaryEvent(sprite, 'top', sb);
            const bottomBoundary = sb.height - sb.offsetBottom;
            if (sprite.y + sprite.height > bottomBoundary) this.triggerBoundaryEvent(sprite, 'bottom', sb);
        }
    }

    private triggerBoundaryEvent(
        sprite: TSprite,
        side: 'left' | 'right' | 'top' | 'bottom',
        bounds: BoundsInfo
    ): void {
        const cooldownKey = `${sprite.id}_${side}`;
        const now = performance.now();
        const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;

        if (side === 'left' && sprite.velocityX >= 0) return;
        if (side === 'right' && sprite.velocityX <= 0) return;
        if (side === 'top' && sprite.velocityY >= 0) return;
        if (side === 'bottom' && sprite.velocityY <= 0) return;

        const hasBoundaryEvent = sprite.events?.onBoundaryHit;

        if (hasBoundaryEvent) {
            PhysicsEngine.applyBoundaryResponse(sprite, side, bounds, this.boundaryMode);
        }

        if (now - lastHit < this.BOUNDARY_COOLDOWN_MS) return;
        this.boundaryCooldowns.set(cooldownKey, now);

        const hb = sprite.getHitbox();
        let contactX = 0;
        let contactY = 0;
        if (side === 'left') {
            contactX = 0;
            contactY = hb.y + hb.h / 2;
        } else if (side === 'right') {
            contactX = bounds.width;
            contactY = hb.y + hb.h / 2;
        } else if (side === 'top') {
            contactX = hb.x + hb.w / 2;
            contactY = bounds.offsetTop;
        } else if (side === 'bottom') {
            contactX = hb.x + hb.w / 2;
            contactY = bounds.height - bounds.offsetBottom;
        }

        if (this.eventCallback) {
            this.eventCallback(sprite.id, 'onBoundaryHit', { hitSide: side, contactX, contactY });
        }
    }

    public checkStageExits(sprites: TSprite[], panels: any[], bounds: BoundsInfo): void {
        for (const sprite of sprites) {
            if (sprite.isAnimating) continue;
            if ((sprite as any).collisionEnabled === false) continue;

            const spriteKey = sprite.id || sprite.name;
            if (this.exitedSprites.has(spriteKey)) continue;

            const sb = this.getSpriteBounds(sprite, panels, bounds);
            let exitSide: string | null = null;

            if (sprite.x + sprite.width < 0) {
                exitSide = 'left';
            } else if (sprite.x > sb.width) {
                exitSide = 'right';
            } else if (sprite.y + sprite.height < sb.offsetTop) {
                exitSide = 'top';
            } else if (sprite.y > sb.height - sb.offsetBottom) {
                exitSide = 'bottom';
            }

            if (exitSide && this.eventCallback) {
                this.exitedSprites.add(spriteKey);
                this.eventCallback(sprite.id, 'onStageExit', { exitSide });
            }
        }
    }

    private getSpriteBounds(sprite: TSprite, panels: any[], defaultBounds: BoundsInfo): BoundsInfo {
        let parentPanel: any = null;
        if ((sprite as any).parentId) {
            parentPanel = panels.find((p: any) => p.id === (sprite as any).parentId || p.name === (sprite as any).parentId);
        } else if (sprite.parent) {
            parentPanel = sprite.parent;
        }

        if (parentPanel && (parentPanel.className === 'TPanel' || parentPanel.className === 'TGroupPanel')) {
            let bw = 0;
            if (parentPanel.style?.borderWidth) {
                bw = parseInt(String(parentPanel.style.borderWidth), 10) || 0;
            }
            const cellSize = (this.gridConfig as any)?.cellSize ?? (this.gridConfig as any)?.grid?.cellSize ?? 20;
            const bwCells = bw / cellSize;
            return {
                width: parentPanel.width - (bwCells * 2),
                height: parentPanel.height - (bwCells * 2),
                offsetTop: 0,
                offsetBottom: 0
            };
        }

        return defaultBounds;
    }

    private capitalize(s: string): string {
        return s.charAt(0).toUpperCase() + s.slice(1);
    }
}
