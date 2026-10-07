import { TPropertyDef, IRuntimeComponent } from './TComponent';
import { TWindow } from './TWindow';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TSpeech');

/**
 * TSpeech — Sprachausgabe über die Web Speech API (speechSynthesis).
 * Service-Komponente: kein sichtbares Element, steuerbar über call_method.
 * Funktioniert auf Desktop und Tablet; die erste Ausgabe muss aus einer
 * Nutzeraktion (Tap/Klick) kommen — Browser-Autoplay-Policy.
 */
export class TSpeech extends TWindow implements IRuntimeComponent {
    public className: string = 'TSpeech';
    public text: string = '';
    public lang: string = 'de-DE';
    public voice: string = '';          // Stimmname aus getVoices(), '' = Systemstandard
    public rate: number = 1.0;          // Sprechtempo 0.1–10
    public pitch: number = 1.0;         // Tonhöhe 0–2
    public volume: number = 1.0;        // Lautstärke 0–1
    public speaking: boolean = false;   // readonly: gerade am Sprechen
    public paused: boolean = false;     // readonly: pausiert
    public lastError: string = '';      // readonly: letzter Fehlercode

    public onEvent: ((eventName: string) => void) | null = null;

    constructor(name: string, x: number, y: number) {
        super(name, x, y, 4, 2);
        this.isService = true;
        this.isHiddenInRun = true;

        this.style.backgroundColor = '#00838f';
        this.style.borderColor = '#006064';
        this.style.borderWidth = 2;
        this.style.color = '#fff';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'text', label: 'Text', type: 'string', group: 'Sprache' },
            { name: 'lang', label: 'Sprache (BCP-47)', type: 'string', group: 'Sprache' },
            { name: 'voice', label: 'Stimme (Name)', type: 'string', group: 'Sprache', hint: 'Leer = Systemstimme; Namen via getVoices()' },
            { name: 'rate', label: 'Sprechtempo (0.1–10)', type: 'number', group: 'Sprache' },
            { name: 'pitch', label: 'Tonhöhe (0–2)', type: 'number', group: 'Sprache' },
            { name: 'volume', label: 'Lautstärke (0–1)', type: 'number', group: 'Sprache' },
            { name: 'speaking', label: 'Spricht gerade', type: 'boolean', group: 'Status', readonly: true },
            { name: 'paused', label: 'Pausiert', type: 'boolean', group: 'Status', readonly: true },
            { name: 'lastError', label: 'Letzter Fehler', type: 'string', group: 'Status', readonly: true }
        ];
    }

    public getEvents(): string[] {
        return [
            ...super.getEvents(),
            'onStart',
            'onEnd',
            'onError',
            'onPause',
            'onResume'
        ];
    }

    public toDTO(): any {
        const json = super.toDTO();
        json.text = this.text;
        json.lang = this.lang;
        json.voice = this.voice;
        json.rate = this.rate;
        json.pitch = this.pitch;
        json.volume = this.volume;
        return json;
    }

    // ----------------------------------------------------
    // Runtime Behaviour
    // ----------------------------------------------------

    public initRuntime(callbacks: { handleEvent: any }): void {
        this.onEvent = (ev: string) => callbacks.handleEvent(this.id, ev);
        // Stimmenliste lädt bei manchen Browsern asynchron — einmal anstupsen.
        this.synth()?.getVoices();
    }

    public onRuntimeStart(): void {
        // Keine automatische Ausgabe — Sprache wird über Actions ausgelöst.
    }

    public onRuntimeStop(): void {
        this.stop();
    }

    private synth(): SpeechSynthesis | null {
        return typeof window !== 'undefined' && 'speechSynthesis' in window ? window.speechSynthesis : null;
    }

    /**
     * Spricht den übergebenen Text oder — ohne Argument — die Property `text`.
     * Aufrufbar per call_method: speak('Punkt für links')
     */
    public speak(text?: string): void {
        const synth = this.synth();
        if (!synth) {
            this.lastError = 'not_supported';
            logger.warn(`[TSpeech] ${this.name}: speechSynthesis nicht verfügbar`);
            this.onEvent?.('onError');
            return;
        }
        const say = (typeof text === 'string' && text !== '') ? text : this.text;
        if (!say) return;

        synth.cancel();
        const u = new SpeechSynthesisUtterance(say);
        u.lang = this.lang;
        u.rate = this.rate;
        u.pitch = this.pitch;
        u.volume = this.volume;
        if (this.voice) {
            const v = synth.getVoices().find(v => v.name === this.voice || v.lang === this.voice);
            if (v) u.voice = v;
        }
        u.onstart = () => { this.speaking = true; this.paused = false; this.lastError = ''; this.onEvent?.('onStart'); };
        u.onend = () => { this.speaking = false; this.paused = false; this.onEvent?.('onEnd'); };
        u.onpause = () => { this.paused = true; this.onEvent?.('onPause'); };
        u.onresume = () => { this.paused = false; this.onEvent?.('onResume'); };
        u.onerror = (e: SpeechSynthesisErrorEvent) => {
            this.speaking = false; this.paused = false;
            // 'canceled'/'interrupted' sind Folge von stop()/erneutem speak() — kein Fehler.
            if (e.error === 'canceled' || e.error === 'interrupted') return;
            this.lastError = String(e.error || 'unknown');
            this.onEvent?.('onError');
        };
        synth.speak(u);
    }

    /** Stoppt die laufende und alle wartenden Ansagen. */
    public stop(): void {
        this.synth()?.cancel();
        this.speaking = false;
        this.paused = false;
    }

    public pause(): void {
        this.synth()?.pause();
    }

    public resume(): void {
        this.synth()?.resume();
    }

    /** Liefert die Namen der verfügbaren Stimmen (Ergebnis über resultVariable). */
    public getVoices(): string[] {
        return this.synth()?.getVoices().map(v => `${v.name} [${v.lang}]`) ?? [];
    }
}

// --- Auto-Registration ---
import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TSpeech', (objData: any) => new TSpeech(objData.name, objData.x, objData.y));
