import { TSprite } from './TSprite';
import { TPropertyDef } from './TComponent';

/**
 * TSpriteTemplate – Blueprint-Vorlage für Object-Pooling.
 * 
 * Im Editor sichtbar (zur Konfiguration von Hitbox, Velocity, Aussehen).
 * Zur Laufzeit selbst unsichtbar – stattdessen werden `poolSize` echte
 * TSprite-Instanzen vorhydriert, die über spawn_object/destroy_object
 * aus dem Pool geholt bzw. zurückgegeben werden.
 * 
 * Lebenszyklus:
 *   Runtime-Start → Pool mit N Instanzen (visible=false, idle)
 *   spawn_object  → Pool.acquire() → visible=true, Position setzen
 *   destroy_object → Pool.release() → visible=false, Position reset
 *   Runtime-Stop  → Pool komplett verworfen
 */
export class TSpriteTemplate extends TSprite {
    /**
     * Anzahl der vorhydrierten Pool-Instanzen.
     * Werden beim Runtime-Start erzeugt und bekommen echte DOM-Elemente.
     */
    public poolSize: number = 10;

    /**
     * Wenn true und der Pool erschöpft ist, wird die älteste aktive
     * Instanz recycled (zurück in den Pool + sofort neu vergeben).
     * Wenn false, gibt acquire() null zurück wenn der Pool leer ist.
     */
    public autoRecycle: boolean = true;

    /**
     * Automatische Lebensdauer in Sekunden. Nach Ablauf wird die
     * Instanz automatisch zurück in den Pool released.
     * 0 = keine automatische Lebensdauer (manuell releasen).
     */
    public lifetime: number = 0;

    constructor(name: string, x: number, y: number, width: number, height: number) {
        super(name, x, y, width, height);
        // Templates sind im Run-Modus unsichtbar, sollen aber im Edit-Modus normal sichtbar sein
        this.isHiddenInRun = true;
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            // Pool Settings group
            { name: 'poolSize', label: 'Pool Size', type: 'number', group: 'Pool Settings' },
            { name: 'autoRecycle', label: 'Auto Recycle', type: 'boolean', group: 'Pool Settings' },
            { name: 'lifetime', label: 'Lifetime (Sek.)', type: 'number', group: 'Pool Settings' },
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onPoolExhausted',   // Alle Instanzen belegt und autoRecycle=false
        ];
    }
}
