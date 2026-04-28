import { Logger } from '../utils/Logger';
import { ComponentStyle } from '../components/TWindow';

export interface ThemeDefinition {
    id: string;
    name: string;
    description?: string;
    components: Record<string, Partial<ComponentStyle>>;
}

export class ThemeRegistry {
    private static instance: ThemeRegistry;
    private static logger = Logger.get('ThemeRegistry');

    private themes: Map<string, ThemeDefinition> = new Map();
    private activeThemeId: string = 'modern-glass';

    private constructor() {
        this.registerDefaultThemes();
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

    public registerTheme(theme: ThemeDefinition) {
        this.themes.set(theme.id, theme);
    }

    public loadProjectThemes(themes: ThemeDefinition[]) {
        if (!themes) return;
        themes.forEach(t => this.registerTheme(t));
    }

    public setActiveTheme(id: string) {
        if (this.themes.has(id)) {
            this.activeThemeId = id;
            ThemeRegistry.logger.info(`Aktives Theme gesetzt auf: ${id}`);
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

    public getComponentStyle(className: string): any {
        const theme = this.themes.get(this.activeThemeId);
        if (!theme) return {};
        
        // Frische Kopie zurückgeben, um Referenz-Probleme zu vermeiden
        return { ...(theme.components[className] || {}) };
    }

    public getMergedStyle(className: string, localStyle: any): any {
        const themeStyle = this.getComponentStyle(className);
        return { ...themeStyle, ...(localStyle || {}) };
    }
}

export const themeRegistry = ThemeRegistry.getInstance();
