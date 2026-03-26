import { TSprite } from '../components/TSprite';
import { TSpriteTemplate } from '../components/TSpriteTemplate';
import { hydrateObjects } from '../utils/Serialization';

import { Logger } from '../utils/Logger';

const logger = Logger.get('SpritePool', 'ObjectPooling');

interface PoolEntry {
    sprite: TSprite;
    busy: boolean;
    acquiredAt: number;  // performance.now() Zeitpunkt des acquire
}

interface TemplatePool {
    templateId: string;
    templateName: string;
    entries: PoolEntry[];
    autoRecycle: boolean;
    lifetime: number;     // Sekunden; 0 = keine automatische Lebensdauer
}

/**
 * SpritePool – Object Pool Manager für TSpriteTemplate-Instanzen.
 * 
 * Erzeugt beim Runtime-Start N echte TSprite-Instanzen pro Template.
 * Diese werden in die globale Object-Liste eingefügt und bekommen
 * echte DOM-Elemente. spawn_object holt eine Instanz (acquire),
 * destroy_object gibt sie zurück (release).
 */
export class SpritePool {
    private pools: Map<string, TemplatePool> = new Map();

    /**
     * Pool für ein Template initialisieren.
     * Erzeugt `template.poolSize` echte TSprite-Instanzen.
     * 
     * @param template Das TSpriteTemplate-Objekt
     * @param targetObjects Die globale Object-Liste, in die Instanzen eingefügt werden
     * @returns Die erzeugten Pool-Sprites (zum Einfügen in this.objects)
     */
    public init(template: TSpriteTemplate, targetObjects: any[]): TSprite[] {
        const poolSize = template.poolSize || 10;
        const createdSprites: TSprite[] = [];

        logger.info(`Initialisiere Pool für "${template.name}" mit ${poolSize} Instanzen`);

        const entries: PoolEntry[] = [];

        for (let i = 0; i < poolSize; i++) {
            // Klon-JSON erzeugen aus dem Template
            const cloneData: any = {
                id: `${template.id}_pool_${i}`,
                name: `${template.name}_pool_${i}`,
                className: 'TSprite',  // Pool-Instanzen sind echte TSprites, keine Templates
                x: -100,               // Offscreen parken
                y: -100,
                width: template.width,
                height: template.height,
                visible: false,         // Im Leerlauf unsichtbar
                // Sprite-Properties vom Template übernehmen
                velocityX: 0,           // Velocity wird erst bei acquire gesetzt
                velocityY: 0,
                collisionEnabled: template.collisionEnabled,
                collisionGroup: template.collisionGroup,
                shape: template.shape,
                spriteColor: template.spriteColor,
                lerpSpeed: template.lerpSpeed,
                // Pool-Metadata
                templateId: template.id,
                templateName: template.name,
                isPoolInstance: true,
                isTransient: true,      // Nicht speichern
                events: template.events ? { ...template.events } : undefined,
            };

            // Bild vom Template übernehmen (falls vorhanden)
            if (template.backgroundImage) {
                cloneData.backgroundImage = template.backgroundImage;
                cloneData.objectFit = template.objectFit;
            }

            // Hydrieren in echte TSprite-Instanz
            const hydrated = hydrateObjects([cloneData]);
            if (hydrated && hydrated.length > 0) {
                const sprite = hydrated[0] as TSprite;
                entries.push({
                    sprite,
                    busy: false,
                    acquiredAt: 0,
                });
                createdSprites.push(sprite);
                targetObjects.push(sprite);
            }
        }

        this.pools.set(template.id, {
            templateId: template.id,
            templateName: template.name,
            entries,
            autoRecycle: template.autoRecycle,
            lifetime: template.lifetime,
        });

        logger.info(`Pool "${template.name}": ${entries.length} Instanzen erzeugt`);
        return createdSprites;
    }

    /**
     * Eine freie Instanz aus dem Pool holen.
     * Setzt visible=true, Position und Velocity vom Template.
     */
    public acquire(templateId: string, x: number, y: number, template: TSpriteTemplate): TSprite | null {
        const pool = this.pools.get(templateId);
        if (!pool) {
            logger.warn(`Kein Pool für Template "${templateId}" gefunden`);
            return null;
        }

        // 1. Zuerst lifetime-abgelaufene Instanzen freigeben
        if (pool.lifetime > 0) {
            const now = performance.now();
            const lifetimeMs = pool.lifetime * 1000;
            pool.entries.forEach(entry => {
                if (entry.busy && (now - entry.acquiredAt) > lifetimeMs) {
                    this.releaseEntry(entry);
                }
            });
        }

        // 2. Freie Instanz suchen
        let entry = pool.entries.find(e => !e.busy);

        // 3. Wenn keine frei und autoRecycle aktiv → älteste recyclen
        if (!entry && pool.autoRecycle) {
            let oldest: PoolEntry | null = null;
            let oldestTime = Infinity;
            pool.entries.forEach(e => {
                if (e.busy && e.acquiredAt < oldestTime) {
                    oldestTime = e.acquiredAt;
                    oldest = e;
                }
            });
            if (oldest) {
                this.releaseEntry(oldest);
                entry = oldest;
                logger.info(`Pool "${pool.templateName}": Auto-Recycle der ältesten Instanz`);
            }
        }

        if (!entry) {
            logger.warn(`Pool "${pool.templateName}" erschöpft (${pool.entries.length} Instanzen belegt)`);
            return null;
        }

        // 4. Instanz konfigurieren
        const sprite = entry.sprite;
        sprite.x = x;
        sprite.y = y;
        sprite.velocityX = template.velocityX;
        sprite.velocityY = template.velocityY;
        sprite.visible = true;

        entry.busy = true;
        entry.acquiredAt = performance.now();

        logger.info(`Pool "${pool.templateName}": acquire → ${sprite.name} @ (${x}, ${y})`);
        return sprite;
    }

    /**
     * Eine Instanz zurück in den Pool geben.
     * Setzt visible=false, Position offscreen.
     */
    public release(instanceId: string): boolean {
        for (const pool of this.pools.values()) {
            const entry = pool.entries.find(e => e.sprite.id === instanceId);
            if (entry && entry.busy) {
                this.releaseEntry(entry);
                logger.info(`Pool "${pool.templateName}": release → ${entry.sprite.name}`);
                return true;
            }
        }
        return false;
    }

    /**
     * Release über Sprite-Name (für %Self%-Auflösung)
     */
    public releaseByName(name: string): boolean {
        for (const pool of this.pools.values()) {
            const entry = pool.entries.find(e => e.sprite.name === name);
            if (entry && entry.busy) {
                this.releaseEntry(entry);
                logger.info(`Pool "${pool.templateName}": release (by name) → ${entry.sprite.name}`);
                return true;
            }
        }
        return false;
    }

    /**
     * Alle Instanzen aller Pools freigeben (Run-Stop).
     */
    public releaseAll(): void {
        for (const pool of this.pools.values()) {
            pool.entries.forEach(entry => {
                if (entry.busy) {
                    this.releaseEntry(entry);
                }
            });
        }
        logger.info('Alle Pools released');
    }

    /**
     * Prüfe ob eine Instanz-ID zu einem Pool gehört.
     */
    public isPoolInstance(instanceId: string): boolean {
        for (const pool of this.pools.values()) {
            if (pool.entries.some(e => e.sprite.id === instanceId)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Prüfe ob ein Template-ID einen Pool hat.
     */
    public hasPool(templateId: string): boolean {
        return this.pools.has(templateId);
    }

    /**
     * Alle aktiven (busy) Instanzen über alle Pools.
     */
    public getActiveInstances(): TSprite[] {
        const result: TSprite[] = [];
        for (const pool of this.pools.values()) {
            pool.entries.forEach(e => {
                if (e.busy) result.push(e.sprite);
            });
        }
        return result;
    }

    /**
     * Lifetime-Check für alle Pools (wird pro Frame vom GameLoopManager aufgerufen).
     */
    public checkLifetimes(): void {
        const now = performance.now();
        for (const pool of this.pools.values()) {
            if (pool.lifetime <= 0) continue;
            const lifetimeMs = pool.lifetime * 1000;
            pool.entries.forEach(entry => {
                if (entry.busy && (now - entry.acquiredAt) > lifetimeMs) {
                    this.releaseEntry(entry);
                    logger.info(`Pool "${pool.templateName}": Lifetime abgelaufen → ${entry.sprite.name}`);
                }
            });
        }
    }

    /**
     * Pool komplett verwerfen (Cleanup bei Runtime-Destroy).
     */
    public destroy(): void {
        this.pools.clear();
    }

    // ─────────────────────────────────────────────
    // Private
    // ─────────────────────────────────────────────

    private releaseEntry(entry: PoolEntry): void {
        entry.sprite.visible = false;
        entry.sprite.x = -100;
        entry.sprite.y = -100;
        entry.sprite.velocityX = 0;
        entry.sprite.velocityY = 0;
        entry.busy = false;
        entry.acquiredAt = 0;
    }
}
