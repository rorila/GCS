import { TSprite } from '../components/TSprite';
import { Logger } from '../utils/Logger';

const logger = Logger.get('PhysicsEngine', 'Runtime_Execution');

type BoundsLike = {
    width: number;
    height: number;
    offsetTop: number;
    offsetBottom: number;
};

/**
 * Physik-Engine für kollisions- und randbedingte Auflösung.
 *
 * Diese Engine ist zustandslos; sie führt Push-Out- und Bounce/Clamp-Operationen
 * an Sprite-Positionen und -Geschwindigkeiten durch. Sie enthält keine
 * Schleifenlogik oder Zustandsverwaltung, die verbleibt im GameLoopManager.
 */
export class PhysicsEngine {
    /**
     * Löst eine Kollision zwischen zwei Sprites durch Push-Out auf.
     * Das schnellere Sprite (nach Betrag der Geschwindigkeit) wird bewegt;
     * seine Geschwindigkeit auf der aufgelösten Achse wird genullt, damit
     * z.B. Gravitation nicht ungebremst weiter aufschaukelt.
     */
    public static resolveSpriteCollision(
        spriteA: TSprite,
        spriteB: TSprite,
        overlap: { side: string; depth: number }
    ): void {
        if (overlap.side === 'left' || overlap.side === 'right') {
            if (Math.abs(spriteA.velocityX) >= Math.abs(spriteB.velocityX)) {
                spriteA.x -= (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                spriteA.velocityX = 0;
            } else {
                spriteB.x += (overlap.side === 'left' ? -1 : 1) * overlap.depth;
                spriteB.velocityX = 0;
            }
        } else {
            if (Math.abs(spriteA.velocityY) >= Math.abs(spriteB.velocityY)) {
                spriteA.y -= (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                spriteA.velocityY = 0;
            } else {
                spriteB.y += (overlap.side === 'top' ? -1 : 1) * overlap.depth;
                spriteB.velocityY = 0;
            }
        }
    }

    /**
     * Löst eine Kollision zwischen Sprite und Panel durch Push-Out auf.
     */
    public static resolvePanelCollision(
        sprite: TSprite,
        hitSide: string,
        depth: number,
        boundaryMode: string
    ): void {
        logger.debug(`[PHYSICS] pre-resolution y: ${sprite.y}, hitSide: ${hitSide}`);

        if (hitSide === 'left' || hitSide === 'right') {
            sprite.x -= (hitSide === 'left' ? -1 : 1) * depth;
            if (boundaryMode === 'bounce') {
                sprite.velocityX = -sprite.velocityX;
            } else {
                sprite.velocityX = 0;
            }
        } else {
            sprite.y -= (hitSide === 'top' ? -1 : 1) * depth;
            if (boundaryMode === 'bounce') {
                sprite.velocityY = -sprite.velocityY;
            } else {
                sprite.velocityY = 0;
            }
        }

        logger.debug(`[PHYSICS] post-resolution y: ${sprite.y}, resolved on ${hitSide}`);
    }

    /**
     * Wendet die reaktive Randbehandlung (clamp oder bounce) auf ein Sprite an.
     * Nur aufgerufen, wenn ein onBoundaryHit-Handler existiert.
     */
    public static applyBoundaryResponse(
        sprite: TSprite,
        side: 'left' | 'right' | 'top' | 'bottom',
        bounds: BoundsLike,
        boundaryMode: string
    ): void {
        const EPSILON = 0.01;

        if (boundaryMode === 'clamp') {
            if (side === 'left' || side === 'right') {
                (sprite as any)._prevVelocityX = sprite.velocityX;
                sprite.velocityX = 0;
            }
            if (side === 'top' || side === 'bottom') {
                (sprite as any)._prevVelocityY = sprite.velocityY;
                sprite.velocityY = 0;
            }
            if (side === 'left') sprite.x = EPSILON;
            if (side === 'right') sprite.x = bounds.width - sprite.width - EPSILON;
            if (side === 'top') sprite.y = bounds.offsetTop + EPSILON;
            if (side === 'bottom') sprite.y = bounds.height - bounds.offsetBottom - sprite.height - EPSILON;
        } else if (boundaryMode === 'bounce') {
            if (side === 'left' || side === 'right') sprite.velocityX = -sprite.velocityX;
            if (side === 'top' || side === 'bottom') sprite.velocityY = -sprite.velocityY;

            if (side === 'left') sprite.x = EPSILON;
            if (side === 'right') sprite.x = bounds.width - sprite.width - EPSILON;
            if (side === 'top') sprite.y = bounds.offsetTop + EPSILON;
            if (side === 'bottom') sprite.y = bounds.height - bounds.offsetBottom - sprite.height - EPSILON;
        }
    }
}
