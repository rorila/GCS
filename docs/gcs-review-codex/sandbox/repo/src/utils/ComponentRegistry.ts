import { TWindow } from '../components/TWindow';
import { Logger } from './Logger';

const logger = Logger.get('ComponentRegistry', 'Core');

export type ComponentFactory = (objData: any) => TWindow | null | any;

export class ComponentRegistry {
    private static factories = new Map<string, ComponentFactory>();
    private static originalClassNames = new Map<string, string>(); // Zum Speichern des echten Namens, falls Aliase (wie TEdit/TTextInput) existieren

    /**
     * Registriert eine Komponente in der globalen ComponentRegistry
     * @param className Name der Klasse, wie sie serialisiert wird (z.B. 'TButton')
     * @param factory Fabrik-Funktion, die ein unfertiges {objData} erhält und die Instanz zurückgibt
     * @param aliases Optionale Aliase (für Abwärtskompatibilität, z.B. 'TRepeater' für 'TIntervalTimer')
     */
    static register(className: string, factory: ComponentFactory, aliases: string[] = []) {
        this.factories.set(className, factory);
        this.originalClassNames.set(className, className);
        
        for (const alias of aliases) {
            this.factories.set(alias, factory);
            this.originalClassNames.set(alias, className); // Speichern, zu welcher echten Klasse der Alias gehört
        }
    }

    /**
     * Instanziiert eine Komponente basierend auf ihrem className.
     */
    static create(objData: any): TWindow | null {
        if (!objData || !objData.className) return null;
        
        const factory = this.factories.get(objData.className);
        if (factory) {
            return factory(objData);
        }
        
        logger.warn(`Unbekannte Komponente: ${objData.className}`);
        return null;
    }
    
    /**
     * Listet alle registrierten Komponentennamen auf.
     */
    static getRegisteredComponents(): string[] {
        return Array.from(this.factories.keys());
    }
}
