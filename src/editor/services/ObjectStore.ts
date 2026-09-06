/**
 * ObjectStore – Single Source of Truth für alle aktuell sichtbaren Objekte.
 *
 * Löst das Kernproblem der 4 parallelen Objekt-Listen:
 *   1. stage.lastRenderedObjects
 *   2. editor.currentObjects
 *   3. getResolvedInheritanceObjects() (berechnet)
 *   4. runtime.getObjects() (nur Run-Mode)
 *
 * Alle Komponenten (StageInteractionManager, EditorCommandManager,
 * InspectorHost, EditorRenderManager) lesen künftig aus dem ObjectStore.
 */
import { Logger } from '../../utils/Logger';

const logger = Logger.get('ObjectStore');


type ObjectStoreListener = () => void;

export class ObjectStore {
    private objects: Map<string, any> = new Map();
    private orderedIds: string[] = [];
    private listeners: ObjectStoreListener[] = [];

    /**
     * Setzt die gesamte Objekt-Liste. Wird aufgerufen von:
     * - EditorRenderManager.render()  (bei jedem Render)
     * - EditorRunManager.setRunMode() (beim Start/Stop der Runtime)
     */
    public setObjects(objs: any[]): void {
        this.objects.clear();
        this.orderedIds = [];
        for (const obj of objs) {
            if (obj && obj.id) {
                this.objects.set(obj.id, obj);
                this.orderedIds.push(obj.id);
            }
        }
        this.notifyListeners();
    }

    /**
     * Gibt alle Objekte in ihrer ursprünglichen Reihenfolge zurück.
     */
    public getAll(): any[] {
        return this.orderedIds.map(id => this.objects.get(id)).filter(Boolean);
    }

    /**
     * Findet ein Objekt anhand seiner ID.
     * ZENTRAL: Ersetzt alle eigenständigen findObjectById()-Implementierungen.
     */
    public getById(id: string): any | null {
        return this.objects.get(id) || null;
    }

    /**
     * Findet ein Objekt anhand seines Namens.
     */
    public getByName(name: string): any | null {
        for (const obj of this.objects.values()) {
            if (obj.name === name) return obj;
        }
        return null;
    }

    /**
     * Aktualisiert ein einzelnes Objekt (z.B. nach Property-Änderung im Inspector).
     */
    public updateObject(id: string, updates: Partial<any>): void {
        const existing = this.objects.get(id);
        if (existing) {
            Object.assign(existing, updates);
            this.notifyListeners();
        }
    }

    /**
     * Entfernt ein Objekt.
     */
    public removeObject(id: string): void {
        this.objects.delete(id);
        this.orderedIds = this.orderedIds.filter(oid => oid !== id);
        this.notifyListeners();
    }

    /**
     * Prüft ob ein Objekt existiert.
     */
    public has(id: string): boolean {
        return this.objects.has(id);
    }

    /**
     * Gibt die Anzahl der Objekte zurück.
     */
    public get count(): number {
        return this.objects.size;
    }

    /**
     * Registriert einen Listener für Änderungen.
     */
    public onChange(listener: ObjectStoreListener): void {
        this.listeners.push(listener);
    }

    /**
     * Entfernt einen Listener.
     */
    public offChange(listener: ObjectStoreListener): void {
        this.listeners = this.listeners.filter(l => l !== listener);
    }

    /**
     * Benachrichtigt alle Listener über eine Änderung.
     */
    private notifyListeners(): void {
        for (const listener of this.listeners) {
            try {
                listener();
            } catch (err) {
                logger.error('[ObjectStore] Listener error:', err);
            }
        }
    }
}
