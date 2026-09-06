import { Logger } from '../utils/Logger';
import { ComponentStyle } from '../components/TWindow';

export interface ThemeDefinition {
    id: string;
    name: string;
    description?: string;
    components: Record<string, Partial<ComponentStyle>>;
    stage?: {
        backgroundColor?: string;
        gridColor?: string;
    };
}

export class ThemeRegistry {
    private static instance: ThemeRegistry;
    private static logger = Logger.get('ThemeRegistry');

    private themes: Map<string, ThemeDefinition> = new Map();
    private activeThemeId: string = 'modern-glass';

    /**
     * Wird aufgerufen, wenn sich das aktive Theme ändert.
     * Kann zum Neu-Rendern genutzt werden.
     */
    public onChange?: (themeId: string) => void;

    /**
     * Komponenten-Klassen, die im Theme beschrieben werden können und in einer
     * Theme-Stage angelegt werden.
     */
    private themeableComponents: string[] = [
        'TButton',
        'TPanel',
        'TCard',
        'TLabel',
        'TNumberLabel',
        'TDialogRoot',
        'TSidePanel',
        'TEdit',
        'TTextInput',
        'TStickyNote'
    ];

    private constructor() {
        this.registerDefaultThemes();
        this.registerKidFriendlyThemes();
    }

    public static getInstance(): ThemeRegistry {
        if (!ThemeRegistry.instance) {
            ThemeRegistry.instance = new ThemeRegistry();
        }
        return ThemeRegistry.instance;
    }

    private registerDefaultThemes() {
        this.registerTheme({
            id: 'modern-glass',
            name: 'Modern Glassmorphism',
            description: 'Ein modernes, dunkles Glass-Theme mit leichten Transparenzen und Schatten.',
            components: {
                'TButton': {
                    backgroundColor: 'rgba(255, 255, 255, 0.08)',
                    borderColor: 'rgba(255, 255, 255, 0.15)',
                    borderWidth: 1,
                    color: '#ffffff',
                    borderRadius: 8,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: '0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)'
                },
                'TPanel': {
                    backgroundColor: 'rgba(20, 20, 30, 0.65)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0, 0, 0, 0.4)'
                },
                'TCard': {
                    backgroundColor: 'rgba(30, 30, 40, 0.85)',
                    borderColor: 'rgba(255, 255, 255, 0.05)',
                    borderWidth: 1,
                    borderRadius: 16,
                    boxShadow: '0 10px 20px rgba(0,0,0,0.3)'
                },
                'TLabel': {
                    color: '#e0e0e0',
                    fontSize: 14,
                    fontFamily: 'system-ui, -apple-system, sans-serif'
                },
                'TNumberLabel': {
                    color: '#e0e0e0',
                    fontSize: 14,
                    fontFamily: 'Consolas, monospace',
                    fontWeight: 'bold'
                },
                'TDialogRoot': {
                    backgroundColor: 'rgba(15, 15, 25, 0.95)',
                    borderColor: 'rgba(100, 150, 255, 0.25)',
                    borderWidth: 1,
                    borderRadius: 16,
                    boxShadow: '0 20px 40px rgba(0,0,0,0.6)'
                },
                'TSidePanel': {
                    backgroundColor: 'rgba(25, 25, 35, 0.95)',
                    borderColor: 'rgba(255, 255, 255, 0.1)',
                    borderWidth: 1,
                    boxShadow: '-10px 0 30px rgba(0,0,0,0.5)'
                },
                'TStickyNote': {
                    backgroundColor: '#fff9c4',
                    borderColor: '#fbc02d',
                    borderWidth: 1,
                    color: '#333333',
                    borderRadius: 2,
                    boxShadow: '2px 4px 8px rgba(0,0,0,0.2)',
                    fontFamily: '"Comic Sans MS", cursive, sans-serif'
                }
            }
        });
        
        this.registerTheme({
            id: 'legacy-dark',
            name: 'Legacy Dark (Alt)',
            description: 'Das klassische GCS Dark-Theme ohne Transparenzen.',
            components: {
                'TButton': { backgroundColor: '#444444', color: '#ffffff', textAlign: 'center', borderWidth: 1, borderColor: '#000000', borderRadius: 4 },
                'TPanel': { backgroundColor: '#222222', borderColor: '#444444', borderWidth: 1 },
                'TCard': { backgroundColor: '#333333', borderColor: '#111111', borderWidth: 1 },
                'TLabel': { color: '#ffffff' },
                'TDialogRoot': { backgroundColor: '#2a2a3e', borderColor: '#4fc3f7', borderWidth: 1 }
            }
        });
    }

    private registerKidFriendlyThemes() {
        const glowPink = '0 0 8px #ff69b4, 0 0 16px rgba(255, 105, 180, 0.4)';
        const glowCyan = '0 0 8px #00f0ff, 0 0 16px rgba(0, 240, 255, 0.4)';
        const glowPurple = '0 0 8px #b388ff, 0 0 16px rgba(179, 136, 255, 0.4)';
        const glowOrange = '0 0 8px #ff9e80, 0 0 16px rgba(255, 158, 128, 0.4)';

        this.registerTheme({
            id: 'candy-pop',
            name: 'Candy Pop',
            description: 'Süße Pastellfarben mit rosa Glow — perfekt für verspielte Spiele.',
            components: {
                'TButton': {
                    backgroundColor: '#ff80ab',
                    borderColor: '#ff4081',
                    borderWidth: 2,
                    color: '#ffffff',
                    borderRadius: 16,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: glowPink
                },
                'TPanel': {
                    backgroundColor: '#fff0f6',
                    borderColor: '#f8bbd0',
                    borderWidth: 2,
                    borderRadius: 20,
                    boxShadow: '0 8px 24px rgba(255, 64, 129, 0.15)'
                },
                'TCard': {
                    backgroundColor: '#fce4ec',
                    borderColor: '#f48fb1',
                    borderWidth: 2,
                    borderRadius: 24,
                    boxShadow: '0 10px 20px rgba(255, 105, 180, 0.2)'
                },
                'TLabel': {
                    color: '#880e4f',
                    fontSize: 14,
                    fontFamily: '"Comic Sans MS", cursive, sans-serif',
                    fontWeight: 'bold'
                },
                'TDialogRoot': {
                    backgroundColor: '#fff0f6',
                    borderColor: '#f06292',
                    borderWidth: 2,
                    borderRadius: 24,
                    boxShadow: '0 20px 40px rgba(255, 64, 129, 0.25)'
                },
                'TSidePanel': {
                    backgroundColor: '#f8bbd0',
                    borderColor: '#ec407a',
                    borderWidth: 2,
                    boxShadow: '10px 0 30px rgba(255, 105, 180, 0.2)'
                },
                'TEdit': {
                    backgroundColor: '#fff5f8',
                    borderColor: '#f06292',
                    borderWidth: 2,
                    color: '#880e4f',
                    borderRadius: 12
                },
                'TTextInput': {
                    backgroundColor: '#fff5f8',
                    borderColor: '#f06292',
                    borderWidth: 2,
                    color: '#880e4f',
                    borderRadius: 12
                },
                'TStickyNote': {
                    backgroundColor: '#fff9c4',
                    borderColor: '#fbc02d',
                    borderWidth: 1,
                    color: '#880e4f',
                    borderRadius: 4,
                    boxShadow: '2px 4px 8px rgba(0,0,0,0.2)',
                    fontFamily: '"Comic Sans MS", cursive, sans-serif'
                }
            }
        });

        this.registerTheme({
            id: 'neon-arcade',
            name: 'Neon Arcade',
            description: 'Dunkler Hintergrund mit leuchtendem Cyan- und Magenta-Glow.',
            components: {
                'TButton': {
                    backgroundColor: '#161822',
                    borderColor: '#00f0ff',
                    borderWidth: 2,
                    color: '#00f0ff',
                    borderRadius: 8,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: glowCyan
                },
                'TPanel': {
                    backgroundColor: '#0b0c15',
                    borderColor: '#00f0ff',
                    borderWidth: 2,
                    borderRadius: 12,
                    boxShadow: '0 8px 32px rgba(0, 240, 255, 0.2)'
                },
                'TCard': {
                    backgroundColor: '#101221',
                    borderColor: '#ff00aa',
                    borderWidth: 2,
                    borderRadius: 16,
                    boxShadow: '0 10px 20px rgba(255, 0, 170, 0.25)'
                },
                'TLabel': {
                    color: '#e0f7fa',
                    fontSize: 14,
                    fontFamily: 'Consolas, monospace',
                    fontWeight: 'bold',
                    textShadow: '0 0 6px #00f0ff'
                },
                'TDialogRoot': {
                    backgroundColor: '#0f111a',
                    borderColor: '#ff00aa',
                    borderWidth: 2,
                    borderRadius: 20,
                    boxShadow: '0 20px 40px rgba(255, 0, 170, 0.3)'
                },
                'TSidePanel': {
                    backgroundColor: '#0b0c15',
                    borderColor: '#00f0ff',
                    borderWidth: 2,
                    boxShadow: '-10px 0 30px rgba(0, 240, 255, 0.2)'
                },
                'TEdit': {
                    backgroundColor: '#0b0c15',
                    borderColor: '#00f0ff',
                    borderWidth: 2,
                    color: '#e0f7fa',
                    borderRadius: 8,
                    boxShadow: glowCyan
                },
                'TTextInput': {
                    backgroundColor: '#0b0c15',
                    borderColor: '#00f0ff',
                    borderWidth: 2,
                    color: '#e0f7fa',
                    borderRadius: 8,
                    boxShadow: glowCyan
                }
            }
        });

        this.registerTheme({
            id: 'superhero',
            name: 'Superhero',
            description: 'Mutige Comic-Farben mit kantigen Borders und starkem Kontrast.',
            components: {
                'TButton': {
                    backgroundColor: '#f44336',
                    borderColor: '#ffeb3b',
                    borderWidth: 3,
                    color: '#ffffff',
                    borderRadius: 4,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: '4px 4px 0 #ffeb3b'
                },
                'TPanel': {
                    backgroundColor: '#1a237e',
                    borderColor: '#ffeb3b',
                    borderWidth: 3,
                    borderRadius: 8,
                    boxShadow: '6px 6px 0 #ffeb3b'
                },
                'TCard': {
                    backgroundColor: '#283593',
                    borderColor: '#ffeb3b',
                    borderWidth: 3,
                    borderRadius: 12,
                    boxShadow: '6px 6px 0 #ffeb3b'
                },
                'TLabel': {
                    color: '#ffeb3b',
                    fontSize: 14,
                    fontFamily: 'Impact, sans-serif',
                    fontWeight: 'bold',
                    textShadow: '2px 2px 0 #000000'
                },
                'TDialogRoot': {
                    backgroundColor: '#1a237e',
                    borderColor: '#f44336',
                    borderWidth: 4,
                    borderRadius: 12,
                    boxShadow: '8px 8px 0 #f44336'
                },
                'TSidePanel': {
                    backgroundColor: '#1a237e',
                    borderColor: '#ffeb3b',
                    borderWidth: 3,
                    boxShadow: '-6px 0 0 #ffeb3b'
                },
                'TEdit': {
                    backgroundColor: '#3949ab',
                    borderColor: '#ffeb3b',
                    borderWidth: 3,
                    color: '#ffffff',
                    borderRadius: 4
                },
                'TTextInput': {
                    backgroundColor: '#3949ab',
                    borderColor: '#ffeb3b',
                    borderWidth: 3,
                    color: '#ffffff',
                    borderRadius: 4
                }
            }
        });

        this.registerTheme({
            id: 'magic-forest',
            name: 'Magic Forest',
            description: 'Mystische Lila- und Grüntöne mit sanftem Glow.',
            components: {
                'TButton': {
                    backgroundColor: '#4527a0',
                    borderColor: '#b388ff',
                    borderWidth: 2,
                    color: '#e1bee7',
                    borderRadius: 16,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: glowPurple
                },
                'TPanel': {
                    backgroundColor: '#1a0b2e',
                    borderColor: '#7c4dff',
                    borderWidth: 2,
                    borderRadius: 18,
                    boxShadow: '0 8px 32px rgba(124, 77, 255, 0.25)'
                },
                'TCard': {
                    backgroundColor: '#311b92',
                    borderColor: '#b388ff',
                    borderWidth: 2,
                    borderRadius: 20,
                    boxShadow: '0 10px 20px rgba(179, 136, 255, 0.25)'
                },
                'TLabel': {
                    color: '#b388ff',
                    fontSize: 14,
                    fontFamily: 'Georgia, serif',
                    fontWeight: 'bold',
                    textShadow: '0 0 6px #b388ff'
                },
                'TDialogRoot': {
                    backgroundColor: '#1a0b2e',
                    borderColor: '#b388ff',
                    borderWidth: 2,
                    borderRadius: 22,
                    boxShadow: '0 20px 40px rgba(124, 77, 255, 0.35)'
                },
                'TSidePanel': {
                    backgroundColor: '#1a0b2e',
                    borderColor: '#7c4dff',
                    borderWidth: 2,
                    boxShadow: '10px 0 30px rgba(124, 77, 255, 0.25)'
                },
                'TEdit': {
                    backgroundColor: '#311b92',
                    borderColor: '#b388ff',
                    borderWidth: 2,
                    color: '#e1bee7',
                    borderRadius: 12,
                    boxShadow: glowPurple
                },
                'TTextInput': {
                    backgroundColor: '#311b92',
                    borderColor: '#b388ff',
                    borderWidth: 2,
                    color: '#e1bee7',
                    borderRadius: 12,
                    boxShadow: glowPurple
                }
            }
        });

        this.registerTheme({
            id: 'ocean-deep',
            name: 'Ocean Deep',
            description: 'Tiefes Blau mit leuchtendem Cyan für Unterwasser-Abenteuer.',
            components: {
                'TButton': {
                    backgroundColor: '#006064',
                    borderColor: '#00e5ff',
                    borderWidth: 2,
                    color: '#e0f7fa',
                    borderRadius: 14,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px #00e5ff, 0 0 18px rgba(0, 229, 255, 0.35)'
                },
                'TPanel': {
                    backgroundColor: '#001e36',
                    borderColor: '#00bcd4',
                    borderWidth: 2,
                    borderRadius: 16,
                    boxShadow: '0 8px 32px rgba(0, 188, 212, 0.25)'
                },
                'TCard': {
                    backgroundColor: '#004d5c',
                    borderColor: '#00e5ff',
                    borderWidth: 2,
                    borderRadius: 18,
                    boxShadow: '0 10px 20px rgba(0, 229, 255, 0.25)'
                },
                'TLabel': {
                    color: '#00e5ff',
                    fontSize: 14,
                    fontFamily: 'Verdana, sans-serif',
                    fontWeight: 'bold',
                    textShadow: '0 0 6px #00bcd4'
                },
                'TDialogRoot': {
                    backgroundColor: '#001e36',
                    borderColor: '#00e5ff',
                    borderWidth: 2,
                    borderRadius: 20,
                    boxShadow: '0 20px 40px rgba(0, 229, 255, 0.3)'
                },
                'TSidePanel': {
                    backgroundColor: '#001e36',
                    borderColor: '#00bcd4',
                    borderWidth: 2,
                    boxShadow: '-10px 0 30px rgba(0, 188, 212, 0.25)'
                },
                'TEdit': {
                    backgroundColor: '#004d5c',
                    borderColor: '#00e5ff',
                    borderWidth: 2,
                    color: '#e0f7fa',
                    borderRadius: 10,
                    boxShadow: '0 0 8px #00e5ff'
                },
                'TTextInput': {
                    backgroundColor: '#004d5c',
                    borderColor: '#00e5ff',
                    borderWidth: 2,
                    color: '#e0f7fa',
                    borderRadius: 10,
                    boxShadow: '0 0 8px #00e5ff'
                }
            }
        });

        this.registerTheme({
            id: 'pixel-adventure',
            name: 'Pixel Adventure',
            description: 'Retro-Block-Look in Grün und Braun für Abenteuer-Spiele.',
            components: {
                'TButton': {
                    backgroundColor: '#8d6e63',
                    borderColor: '#5d4037',
                    borderWidth: 4,
                    color: '#ffffff',
                    borderRadius: 0,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: '4px 4px 0 #3e2723'
                },
                'TPanel': {
                    backgroundColor: '#2e7d32',
                    borderColor: '#1b5e20',
                    borderWidth: 4,
                    borderRadius: 0,
                    boxShadow: '6px 6px 0 #1b5e20'
                },
                'TCard': {
                    backgroundColor: '#4caf50',
                    borderColor: '#2e7d32',
                    borderWidth: 4,
                    borderRadius: 0,
                    boxShadow: '6px 6px 0 #2e7d32'
                },
                'TLabel': {
                    color: '#fff9c4',
                    fontSize: 14,
                    fontFamily: '"Press Start 2P", cursive, monospace',
                    fontWeight: 'bold',
                    textShadow: '2px 2px 0 #1b5e20'
                },
                'TDialogRoot': {
                    backgroundColor: '#2e7d32',
                    borderColor: '#8d6e63',
                    borderWidth: 4,
                    borderRadius: 0,
                    boxShadow: '8px 8px 0 #5d4037'
                },
                'TSidePanel': {
                    backgroundColor: '#2e7d32',
                    borderColor: '#1b5e20',
                    borderWidth: 4,
                    boxShadow: '-6px 0 0 #1b5e20'
                },
                'TEdit': {
                    backgroundColor: '#a1887f',
                    borderColor: '#5d4037',
                    borderWidth: 4,
                    color: '#3e2723',
                    borderRadius: 0
                },
                'TTextInput': {
                    backgroundColor: '#a1887f',
                    borderColor: '#5d4037',
                    borderWidth: 4,
                    color: '#3e2723',
                    borderRadius: 0
                }
            }
        });

        this.registerTheme({
            id: 'sunset-vibes',
            name: 'Sunset Vibes',
            description: 'Warmer Orange-Lila-Verlauf mit weichem Glow.',
            components: {
                'TButton': {
                    backgroundColor: '#ff7043',
                    borderColor: '#ff9e80',
                    borderWidth: 2,
                    color: '#ffffff',
                    borderRadius: 18,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: glowOrange
                },
                'TPanel': {
                    backgroundColor: '#2d1b2e',
                    borderColor: '#ff9e80',
                    borderWidth: 2,
                    borderRadius: 20,
                    boxShadow: '0 8px 32px rgba(255, 158, 128, 0.25)'
                },
                'TCard': {
                    backgroundColor: '#4a148c',
                    borderColor: '#ffab91',
                    borderWidth: 2,
                    borderRadius: 22,
                    boxShadow: '0 10px 20px rgba(255, 158, 128, 0.25)'
                },
                'TLabel': {
                    color: '#ffe0b2',
                    fontSize: 14,
                    fontFamily: '"Trebuchet MS", sans-serif',
                    fontWeight: 'bold',
                    textShadow: '0 0 6px #ff7043'
                },
                'TDialogRoot': {
                    backgroundColor: '#2d1b2e',
                    borderColor: '#ff9e80',
                    borderWidth: 2,
                    borderRadius: 24,
                    boxShadow: '0 20px 40px rgba(255, 112, 67, 0.35)'
                },
                'TSidePanel': {
                    backgroundColor: '#2d1b2e',
                    borderColor: '#ff9e80',
                    borderWidth: 2,
                    boxShadow: '10px 0 30px rgba(255, 158, 128, 0.25)'
                },
                'TEdit': {
                    backgroundColor: '#4a148c',
                    borderColor: '#ff9e80',
                    borderWidth: 2,
                    color: '#ffe0b2',
                    borderRadius: 12,
                    boxShadow: glowOrange
                },
                'TTextInput': {
                    backgroundColor: '#4a148c',
                    borderColor: '#ff9e80',
                    borderWidth: 2,
                    color: '#ffe0b2',
                    borderRadius: 12,
                    boxShadow: glowOrange
                }
            }
        });

        this.registerTheme({
            id: 'unicorn-glitter',
            name: 'Unicorn Glitter',
            description: 'Regenbogen-Pastell mit vielen Rundungen und einem sanften Glow.',
            components: {
                'TButton': {
                    backgroundColor: '#ea80fc',
                    borderColor: '#e040fb',
                    borderWidth: 2,
                    color: '#ffffff',
                    borderRadius: 22,
                    textAlign: 'center',
                    fontWeight: 'bold',
                    boxShadow: '0 0 10px #e040fb, 0 0 18px rgba(224, 64, 251, 0.35)'
                },
                'TPanel': {
                    backgroundColor: '#f3e5f5',
                    borderColor: '#ce93d8',
                    borderWidth: 2,
                    borderRadius: 26,
                    boxShadow: '0 8px 24px rgba(206, 147, 216, 0.25)'
                },
                'TCard': {
                    backgroundColor: '#e1bee7',
                    borderColor: '#ba68c8',
                    borderWidth: 2,
                    borderRadius: 28,
                    boxShadow: '0 10px 20px rgba(186, 104, 200, 0.25)'
                },
                'TLabel': {
                    color: '#4a148c',
                    fontSize: 14,
                    fontFamily: '"Comic Sans MS", cursive, sans-serif',
                    fontWeight: 'bold'
                },
                'TDialogRoot': {
                    backgroundColor: '#f3e5f5',
                    borderColor: '#e040fb',
                    borderWidth: 2,
                    borderRadius: 30,
                    boxShadow: '0 20px 40px rgba(224, 64, 251, 0.3)'
                },
                'TSidePanel': {
                    backgroundColor: '#f3e5f5',
                    borderColor: '#ce93d8',
                    borderWidth: 2,
                    boxShadow: '10px 0 30px rgba(206, 147, 216, 0.25)'
                },
                'TEdit': {
                    backgroundColor: '#f8bbd0',
                    borderColor: '#e040fb',
                    borderWidth: 2,
                    color: '#4a148c',
                    borderRadius: 16
                },
                'TTextInput': {
                    backgroundColor: '#f8bbd0',
                    borderColor: '#e040fb',
                    borderWidth: 2,
                    color: '#4a148c',
                    borderRadius: 16
                }
            }
        });
    }

    public registerTheme(theme: ThemeDefinition) {
        this.themes.set(theme.id, theme);
    }

    /**
     * Liefert alle Komponenten-Klassen, die in einer Theme-Stage bearbeitet werden können.
     */
    public getThemeableComponentClasses(): string[] {
        return [...this.themeableComponents];
    }

    /**
     * Klont ein bestehendes Theme unter einer neuen ID.
     */
    public cloneTheme(id: string, newId: string, newName: string): ThemeDefinition | null {
        const source = this.themes.get(id);
        if (!source) return null;
        return {
            id: newId,
            name: newName,
            description: source.description,
            components: JSON.parse(JSON.stringify(source.components))
        };
    }

    public loadProjectThemes(themes: ThemeDefinition[]) {
        if (!themes) return;
        themes.forEach(t => this.registerTheme(t));
    }

    /**
     * Lädt eine einzelne Theme-JSON-Datei von einer URL.
     */
    public async loadThemeFromUrl(url: string): Promise<ThemeDefinition | null> {
        try {
            const response = await fetch(url);
            if (!response.ok) {
                ThemeRegistry.logger.warn(`Theme-Datei konnte nicht geladen werden: ${url} (${response.status})`);
                return null;
            }
            const theme = await response.json();
            if (!theme || !theme.id || !theme.components) {
                ThemeRegistry.logger.warn(`Ungültiges Theme-Format in ${url}`);
                return null;
            }
            this.registerTheme(theme);
            ThemeRegistry.logger.info(`Theme geladen: ${theme.id} (${theme.name || 'unbenannt'})`);
            return theme;
        } catch (e) {
            ThemeRegistry.logger.warn(`Fehler beim Laden der Theme-Datei ${url}:`, e);
            return null;
        }
    }

    /**
     * Lädt alle Theme-Dateien, die in einer Index-JSON-Datei aufgelistet sind.
     */
    public async loadThemesFromIndex(indexUrl: string): Promise<void> {
        try {
            const response = await fetch(indexUrl);
            if (!response.ok) {
                ThemeRegistry.logger.warn(`Theme-Index konnte nicht geladen werden: ${indexUrl} (${response.status})`);
                return;
            }
            const urls: string[] = await response.json();
            if (!Array.isArray(urls)) return;
            const base = indexUrl.substring(0, indexUrl.lastIndexOf('/') + 1);
            for (const relativeUrl of urls) {
                const resolved = relativeUrl.startsWith('http') ? relativeUrl : new URL(relativeUrl, base).href;
                await this.loadThemeFromUrl(resolved);
            }
        } catch (e) {
            ThemeRegistry.logger.warn(`Fehler beim Laden des Theme-Index ${indexUrl}:`, e);
        }
    }

    public setActiveTheme(id: string) {
        if (this.themes.has(id)) {
            this.activeThemeId = id;
            ThemeRegistry.logger.info(`Aktives Theme gesetzt auf: ${id}`);
            if (this.onChange) {
                this.onChange(id);
            }
        } else {
            ThemeRegistry.logger.warn(`Theme ${id} nicht gefunden. Fallback auf modern-glass.`);
            this.activeThemeId = 'modern-glass';
        }
    }

    public getActiveThemeId(): string {
        return this.activeThemeId;
    }

    public getAvailableThemes(): ThemeDefinition[] {
        return Array.from(this.themes.values());
    }

    public getStageStyle(): { backgroundColor: string; gridColor: string } {
        const theme = this.themes.get(this.activeThemeId);
        return {
            backgroundColor: theme?.stage?.backgroundColor || '#ffffff',
            gridColor: theme?.stage?.gridColor || '#dddddd'
        };
    }

    public getComponentStyle(className: string): any {
        const theme = this.themes.get(this.activeThemeId);
        if (!theme) return {};
        
        // Frische Kopie zurückgeben, um Referenz-Probleme zu vermeiden
        return { ...(theme.components[className] || {}) };
    }

    public getMergedStyle(className: string, localStyle: any): any {
        const themeStyle = this.getComponentStyle(className);
        const local = localStyle || {};
        // Eigene Glow/Shadow- bzw. boxShadow-Angaben des Objekts dürfen nicht
        // vom Theme-boxShadow überschrieben/übergangen werden.
        if (local.boxShadow !== undefined || local.glowColor !== undefined || local.shadowColor !== undefined) {
            delete themeStyle.boxShadow;
        }
        return { ...themeStyle, ...local };
    }
}

export const themeRegistry = ThemeRegistry.getInstance();
