import { AIProjectContext } from '../context/ProjectContextBuilder';

/**
 * RagQueryPlanner
 *
 * Variante A: Regelbasierter Query-Planner.
 *
 * Leitet aus der Aufgabenbeschreibung und dem Projektkontext
 * gezielte RAG-Suchanfragen ab, ohne einen LLM-Aufruf zu benötigen.
 *
 * Quellen für die Ableitung:
 * - className der betroffenen Objekte (z.B. TSprite → Events + Properties)
 * - plannedEvent / plannedTask aus der User Story
 * - Schlüsselwörter in der Aufgabenbeschreibung (mehrsprachig)
 */

export interface RagQueryPlan {
    queries: string[];
    reasoning: string[];
}

/**
 * Synonym-Map: Prosa-Begriffe (mehrsprachig) → technische RAG-Queries.
 * Erweitert die semantische Reichweite des Keyword-Matchings erheblich.
 * Neue Einträge hier hinzufügen wenn neue Komponenten/Properties verfügbar sind.
 */
const SYNONYM_MAP: Array<{ terms: string[]; queries: string[]; label: string }> = [
    // Bewegung / Position
    {
        terms: ['läuft', 'laufen', 'spring', 'hüpf', 'fliegt', 'fliegen', 'gleitet', 'gleiten', 'schleich', 'renn', 'rennt'],
        queries: ['TSprite x y position velocity increment', 'addAction increment changes x y'],
        label: 'Bewegung (Prosa-Synonym)',
    },
    {
        terms: ['nach links', 'nach rechts', 'nach oben', 'nach unten', 'seitwärts', 'vorwärts', 'rückwärts'],
        queries: ['TSprite x y increment position', 'addAction increment changes x y'],
        label: 'Richtungsangabe erkannt',
    },
    // Sichtbarkeit / Ein-Ausblenden
    {
        terms: ['verschwind', 'auftauch', 'erschein', 'einblend', 'ausblend', 'fade', 'blendet'],
        queries: ['TSprite visible opacity property', 'addAction property changes visible opacity'],
        label: 'Sichtbarkeit (Prosa-Synonym)',
    },
    // Kollision / Treffer
    {
        terms: ['trifft', 'getroffen', 'berührt', 'berühren', 'aufprall', 'prallt', 'zusammenstoß', 'zusammenstoßen'],
        queries: ['collision event onCollision TSprite', 'connectEvent onCollision'],
        label: 'Kollision (Prosa-Synonym)',
    },
    // Farbe
    {
        terms: ['bunt', 'leuchtet rot', 'leuchtet blau', 'leuchtet grün', 'verfärbt', 'wird rot', 'wird blau', 'wird grün'],
        queries: ['TSprite spriteColor style.backgroundColor color property', 'addAction property changes spriteColor'],
        label: 'Farbänderung (Prosa-Synonym)',
    },
    // Glow / Leuchten / Blinken
    {
        terms: ['blinkt', 'blinken', 'glüht', 'glühen', 'strahlt', 'strahlen', 'leuchtet auf', 'aufleuchten', 'highlight', 'hervorheb'],
        queries: ['style.glowColor glowBlur glowSpread property', 'addAction property changes glowColor'],
        label: 'Glow/Blinken (Prosa-Synonym)',
    },
    // Schatten
    {
        terms: ['wirft schatten', 'schattiert', 'mit schatten', 'dunkel umrandet'],
        queries: ['style.shadowColor shadowOffsetX shadowOffsetY shadowBlur shadowSpread property'],
        label: 'Schatten (Prosa-Synonym)',
    },
    // Größe
    {
        terms: ['wächst', 'wachsen', 'schrumpft', 'schrumpfen', 'größer', 'kleiner', 'skalier'],
        queries: ['TSprite width height property increment', 'addAction increment changes width height'],
        label: 'Größenänderung erkannt',
    },
    // Text / Anzeige
    {
        terms: ['zeigt an', 'anzeigen', 'schreibt', 'schreiben', 'zählt', 'zähler', 'punkte zeigen', 'ergebnis'],
        queries: ['TLabel text property', 'addAction property changes text'],
        label: 'Textanzeige (Prosa-Synonym)',
    },
    // Sound
    {
        terms: ['piept', 'klickt', 'klingelt', 'tönt', 'geräusch', 'spielt ab', 'sound abspielen'],
        queries: ['sound audio play action TAudioPlayer'],
        label: 'Sound (Prosa-Synonym)',
    },
    // Timer / Verzögerung
    {
        terms: ['nach einer sekunde', 'nach 2 sekunden', 'verzögert', 'warte', 'warten', 'nach kurzer zeit', 'zeitgesteuert'],
        queries: ['TTimer TIntervalTimer interval onTimer connectEvent', 'addAction property changes'],
        label: 'Timer/Verzögerung erkannt',
    },
    // Zufall / Random
    {
        terms: ['zufall', 'zufällig', 'zufallszahl', 'zufallswert', 'random', 'würfel', 'wuerfel', 'dice', 'random value'],
        queries: ['TRandomVariable randomValue min max isInteger', 'addVariable random min max isInteger'],
        label: 'Zufallsvariable erkannt',
    },
    // Tastatur
    {
        terms: ['drückt', 'drücken', 'tippt', 'tippen', 'eingabe', 'steuer', 'steuerung', 'pfeiltaste', 'leertaste', 'enter'],
        queries: ['onKeyDown onKeyUp key event addTaskParam', 'keyboard input TInputController'],
        label: 'Tastatur (Prosa-Synonym)',
    },
    // Spielstart / Spielende
    {
        terms: ['spiel startet', 'beim start', 'spielbeginn', 'level start', 'wenn das spiel beginnt'],
        queries: ['onStart event connectEvent stage', 'TGameState'],
        label: 'Spielstart erkannt',
    },
    {
        terms: ['game over', 'spiel endet', 'spielende', 'verloren', 'gewonnen', 'level end'],
        queries: ['TGameState onGameOver stage navigation', 'connectEvent'],
        label: 'Spielende erkannt',
    },
];

export class RagQueryPlanner {
    public plan(instruction: string, context: AIProjectContext): RagQueryPlan {
        const queries: string[] = [];
        const reasoning: string[] = [];
        const lower = instruction.toLowerCase();

        // --- Synonym-Map: Prosa → technische Queries ---
        for (const entry of SYNONYM_MAP) {
            if (this.matchesAny(lower, entry.terms)) {
                queries.push(...entry.queries);
                reasoning.push(entry.label);
            }
        }

        // --- Aus Projektkontext: className der betroffenen Objekte ---
        const classNames = this.extractClassNames(context);
        for (const cls of classNames) {
            queries.push(`${cls} properties events`);
            reasoning.push(`Klasse "${cls}" im Projektkontext gefunden`);
        }

        // --- Aus User Story: plannedEvent ---
        const plannedEvents = this.extractPlannedEvents(context);
        for (const ev of plannedEvents) {
            queries.push(`${ev} event connectEvent`);
            reasoning.push(`plannedEvent "${ev}" in User Story gefunden`);
        }

        // --- Aus User Story: plannedTask → Hinweis auf benötigte ActionTypes ---
        const plannedTasks = this.extractPlannedTasks(context);
        if (plannedTasks.length > 0) {
            queries.push('addAction property ActionType connectEvent');
            reasoning.push(`plannedTask vorhanden: ActionType-Referenz hinzugefügt`);
        }

        // --- Aus Aufgabentext: Interaktions-Typ ---
        if (this.matchesAny(lower, ['klick', 'click', 'maus', 'mouse', 'pointer', 'tap'])) {
            queries.push('click mouse pointer event');
            queries.push('connectEvent');
            reasoning.push('Klick-Interaktion erkannt');
        }

        if (this.matchesAny(lower, ['taste', 'key', 'keyboard', 'keydown', 'keyup'])) {
            queries.push('onKeyDown onKeyUp key event');
            queries.push('addTaskParam key string');
            reasoning.push('Tastatur-Interaktion erkannt');
        }

        if (this.matchesAny(lower, ['kollision', 'collision', 'treffer', 'berühr'])) {
            queries.push('collision event onCollision');
            reasoning.push('Kollisions-Event erkannt');
        }

        // --- Aus Aufgabentext: beabsichtigte Änderung ---
        if (this.matchesAny(lower, ['farb', 'color', 'blau', 'rot', 'grün', 'blue', 'red', 'green', 'tint', 'fill'])) {
            queries.push('TSprite spriteColor style.backgroundColor color property');
            queries.push('addAction property changes spriteColor');
            reasoning.push('Farbänderung erkannt');
        }

        if (this.matchesAny(lower, ['glow', 'leuchт', 'leucht', 'schein', 'neon', 'glüh', 'glühen'])) {
            queries.push('style.glowColor glowBlur glowSpread property');
            reasoning.push('Glow-Effekt erkannt');
        }

        if (this.matchesAny(lower, ['schatten', 'shadow', 'boxshadow', 'schlag', 'tiefe', 'depth'])) {
            queries.push('style.shadowColor shadowOffsetX shadowOffsetY shadowBlur shadowSpread shadowInset property');
            reasoning.push('Schatten-Effekt erkannt');
        }

        if (this.matchesAny(lower, ['beweg', 'move', 'links', 'rechts', 'oben', 'unten', 'left', 'right', 'up', 'down', 'position', 'x ', ' y '])) {
            queries.push('TSprite x y position velocity property');
            queries.push('addAction property changes x y');
            reasoning.push('Bewegung/Position erkannt');
        }

        if (this.matchesAny(lower, ['sichtbar', 'visible', 'ausblend', 'einblend', 'zeig', 'hide', 'show'])) {
            queries.push('TSprite visible opacity property');
            reasoning.push('Sichtbarkeit erkannt');
        }

        if (this.matchesAny(lower, ['text', 'label', 'beschrift', 'anzeig', 'score', 'punkte'])) {
            queries.push('TLabel text property');
            reasoning.push('Text/Label erkannt');
        }

        if (this.matchesAny(lower, ['sound', 'musik', 'audio', 'abspielen', 'play'])) {
            queries.push('sound audio play action');
            reasoning.push('Sound/Audio erkannt');
        }

        // --- Fallback: immer mindestens die wichtigsten Grundlagen ---
        if (queries.length === 0) {
            queries.push('connectEvent addAction property ActionType');
            reasoning.push('Keine spezifischen Muster erkannt – allgemeine Grundlagen');
        }

        // Basis-Anfrage als letzte Option, falls topK noch nicht erreicht
        queries.push(instruction.trim());

        return { queries: this.deduplicate(queries), reasoning };
    }

    private extractClassNames(context: AIProjectContext): string[] {
        const names = new Set<string>();
        const objects = context.activeStage?.objects ?? [];
        for (const obj of objects) {
            if (obj.className && obj.className !== 'Sonstige') {
                names.add(obj.className);
            }
        }
        return Array.from(names);
    }

    private extractPlannedEvents(context: AIProjectContext): string[] {
        const events = new Set<string>();
        for (const story of context.selectedUserStories ?? []) {
            if ((story as any).plannedEvent) {
                events.add((story as any).plannedEvent);
            }
        }
        return Array.from(events);
    }

    private extractPlannedTasks(context: AIProjectContext): string[] {
        const tasks: string[] = [];
        for (const story of context.selectedUserStories ?? []) {
            if ((story as any).plannedTask) {
                tasks.push((story as any).plannedTask);
            }
        }
        return tasks;
    }

    private matchesAny(text: string, terms: string[]): boolean {
        return terms.some(t => text.includes(t));
    }

    private deduplicate(queries: string[]): string[] {
        const seen = new Set<string>();
        return queries.filter(q => {
            if (seen.has(q)) return false;
            seen.add(q);
            return true;
        });
    }
}
