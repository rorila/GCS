import { TWindow } from '../components/TWindow';
import { TVirtualGamepad } from '../components/TVirtualGamepad';
import { TAudio } from '../components/TAudio';
import { TImage } from '../components/TImage';
import { TImageList } from '../components/TImageList';
import { TSprite } from '../components/TSprite';
import { TSpriteTemplate } from '../components/TSpriteTemplate';
import { TButton } from '../components/TButton';
import { TCheckbox } from '../components/TCheckbox';
import { TColorPicker } from '../components/TColorPicker';
import { TDropdown } from '../components/TDropdown';
import { TEdit } from '../components/TEdit';
import { TLabel } from '../components/TLabel';
import { TMemo } from '../components/TMemo';
import { TNumberInput } from '../components/TNumberInput';
import { TNumberLabel } from '../components/TNumberLabel';
import { TPanel } from '../components/TPanel';
import { TRichText } from '../components/TRichText';
import { TGroupPanel } from '../components/TGroupPanel';
import { TIntervalTimer } from '../components/TIntervalTimer';
import { TShape } from '../components/TShape';
import { TTable } from '../components/TTable';
import { TTextControl } from '../components/TTextControl';
import { TStickyNote } from '../components/TStickyNote';
import { TVideo } from '../components/TVideo';
import { TVariable } from '../components/TVariable';
import { TTriggerVariable } from '../components/TTriggerVariable';
import { TTimer } from '../components/TTimer';
import { TThresholdVariable } from '../components/TThresholdVariable';
import { TRangeVariable } from '../components/TRangeVariable';
import { TRandomVariable } from '../components/TRandomVariable';
import { TListVariable } from '../components/TListVariable';
import { TStringMap } from '../components/TStringMap';
import { TStringVariable } from '../components/TStringVariable';
import { TIntegerVariable } from '../components/TIntegerVariable';
import { TBooleanVariable } from '../components/TBooleanVariable';
import { TRealVariable } from '../components/TRealVariable';
import { TObjectVariable } from '../components/TObjectVariable';
import { Logger } from '../utils/Logger';

// Zusätzliche System-Komponenten
import { TSplashScreen } from '../components/TSplashScreen';
import { TSystemInfo } from '../components/TSystemInfo';
import { TGameHeader } from '../components/TGameHeader';
import { TKeyStore } from '../components/TKeyStore';
import { TGameCard } from '../components/TGameCard';
import { TGameServer } from '../components/TGameServer';
import { TGameLoop } from '../components/TGameLoop';
import { TInputController } from '../components/TInputController';
import { THandshake } from '../components/THandshake';
import { THeartbeat } from '../components/THeartbeat';
import { TStageController } from '../components/TStageController';
import { TGameState } from '../components/TGameState';
import { TDialogRoot } from '../components/TDialogRoot';
import { TInfoWindow } from '../components/TInfoWindow';
import { TStatusBar } from '../components/TStatusBar';
import { TProgressBar } from '../components/TProgressBar';
import { TObjectList } from '../components/TObjectList';
import { TTabControl } from '../components/TTabControl';
import { TInspectorTemplate } from '../components/TInspectorTemplate';
import { TAPIServer } from '../components/TAPIServer';
import { TToast } from '../components/TToast';
import { TEmojiPicker } from '../components/TEmojiPicker';
import { TDataStore } from '../components/TDataStore';
import { TBadge } from '../components/TBadge';
import { TAvatar } from '../components/TAvatar';
import { TCard } from '../components/TCard';
import { TNavBar } from '../components/TNavBar';
import { TTabBar } from '../components/TTabBar';
import { TList } from '../components/TList';
import { TDataList } from '../components/TDataList';
import { TAuthService } from '../components/TAuthService';
import { TUserManager } from '../components/TUserManager';
import { TSidePanel } from '../components/TSidePanel';
/**
 * ComponentRegistry - Der zentrale "Broker" für alle GCS-Komponenten.
 */
export class ComponentRegistry {
    private static logger = Logger.get('ComponentRegistry', 'Project_Validation');
    private static instance: ComponentRegistry;
    private registry: Map<string, any> = new Map();
    private typeMapping: Map<string, string> = new Map(); // Mapping von Kurz-Typen (z.B. 'Button') zu Klassennamen

    private constructor() {
        ComponentRegistry.logger.info("Initialisierung startet...");
        this.registerDefaultComponents();
        this.setupTypeMappings();
    }

    public static getInstance(): ComponentRegistry {
        if (!ComponentRegistry.instance) {
            ComponentRegistry.instance = new ComponentRegistry();
        }
        return ComponentRegistry.instance;
    }

    /**
     * Registriert die Standard-Bibliothek von GCS.
     */
    private registerDefaultComponents() {
        // UI & Visuelle Objekte
        this.register('TWindow', TWindow);
        this.register('TVirtualGamepad', TVirtualGamepad);
        this.register('TAudio', TAudio);
        this.register('TImage', TImage);
        this.register('TImageList', TImageList);
        this.register('TSprite', TSprite);
        this.register('TSpriteTemplate', TSpriteTemplate);
        this.register('TButton', TButton);
        this.register('TCheckbox', TCheckbox);
        this.register('TColorPicker', TColorPicker);
        this.register('TDropdown', TDropdown);
        this.register('TEdit', TEdit);
        this.register('TLabel', TLabel);
        this.register('TMemo', TMemo);
        this.register('TNumberInput', TNumberInput);
        this.register('TNumberLabel', TNumberLabel);
        this.register('TPanel', TPanel);
        this.register('TRichText', TRichText);
        this.register('TGroupPanel', TGroupPanel);
        this.register('TIntervalTimer', TIntervalTimer);
        this.register('TShape', TShape);
        this.register('TTable', TTable);
        this.register('TTextControl', TTextControl);
        this.register('TStickyNote', TStickyNote);
        this.register('TVideo', TVideo);
        this.register('TProgressBar', TProgressBar);

        // System Komponenten
        this.register('TSplashScreen', TSplashScreen);
        this.register('TSystemInfo', TSystemInfo);
        this.register('TGameHeader', TGameHeader);
        this.register('TKeyStore', TKeyStore);
        this.register('TGameCard', TGameCard);
        this.register('TGameServer', TGameServer);
        this.register('TGameLoop', TGameLoop);
        this.register('TInputController', TInputController);
        this.register('THandshake', THandshake);
        this.register('THeartbeat', THeartbeat);
        this.register('TStageController', TStageController);
        this.register('TGameState', TGameState);
        this.register('TDialogRoot', TDialogRoot);
        this.register('TInfoWindow', TInfoWindow);
        this.register('TStatusBar', TStatusBar);
        this.register('TObjectList', TObjectList);
        this.register('TTabControl', TTabControl);
        this.register('TInspectorTemplate', TInspectorTemplate);
        this.register('TAPIServer', TAPIServer);
        this.register('TToast', TToast);
        this.register('TEmojiPicker', TEmojiPicker);
        this.register('TDataStore', TDataStore);
        this.register('TBadge', TBadge);
        this.register('TAvatar', TAvatar);
        this.register('TCard', TCard);
        this.register('TNavBar', TNavBar);
        this.register('TTabBar', TTabBar);
        this.register('TList', TList);
        this.register('TDataList', TDataList);
        this.register('TAuthService', TAuthService);
        this.register('TUserManager', TUserManager);
        this.register('TSidePanel', TSidePanel);

        // Variablen & Spezial-Variablen
        this.register('TVariable', TVariable);
        this.register('TStringMap', TStringMap);
        this.register('TTriggerVariable', TTriggerVariable);
        this.register('TTimer', TTimer);
        this.register('TThresholdVariable', TThresholdVariable);
        this.register('TRangeVariable', TRangeVariable);
        this.register('TRandomVariable', TRandomVariable);
        this.register('TListVariable', TListVariable);
        this.register('TStringVariable', TStringVariable);
        this.register('TIntegerVariable', TIntegerVariable);
        this.register('TBooleanVariable', TBooleanVariable);
        this.register('TRealVariable', TRealVariable);
        this.register('TObjectVariable', TObjectVariable);

        ComponentRegistry.logger.info(`${this.registry.size} Komponenten erfolgreich registriert.`);
    }

    /**
     * Erstellt das Mapping für Kurznamen (Legacy/Toolbox Support).
     */
    private setupTypeMappings() {
        this.typeMapping.set('Button', 'TButton');
        this.typeMapping.set('Panel', 'TPanel');
        this.typeMapping.set('RichText', 'TRichText');
        this.typeMapping.set('GroupPanel', 'TGroupPanel');
        this.typeMapping.set('Audio', 'TAudio');
        this.typeMapping.set('Image', 'TImage');
        this.typeMapping.set('ImageList', 'TImageList');
        this.typeMapping.set('Video', 'TVideo');
        this.typeMapping.set('SplashScreen', 'TSplashScreen');
        this.typeMapping.set('Label', 'TLabel');
        this.typeMapping.set('StickyNote', 'TStickyNote');
        this.typeMapping.set('NumberLabel', 'TNumberLabel');
        this.typeMapping.set('Edit', 'TEdit');
        this.typeMapping.set('SystemInfo', 'TSystemInfo');
        this.typeMapping.set('GameHeader', 'TGameHeader');
        this.typeMapping.set('Sprite', 'TSprite');
        this.typeMapping.set('SpriteTemplate', 'TSpriteTemplate');
        this.typeMapping.set('EmojiPicker', 'TEmojiPicker');
        this.typeMapping.set('Shape', 'TShape');
        this.typeMapping.set('GameLoop', 'TGameLoop');
        this.typeMapping.set('InputController', 'TInputController');
        this.typeMapping.set('VirtualGamepad', 'TVirtualGamepad');
        this.typeMapping.set('Timer', 'TTimer');
        this.typeMapping.set('Repeater', 'TIntervalTimer');  // Legacy
        this.typeMapping.set('IntervalTimer', 'TIntervalTimer');
        this.typeMapping.set('TRepeater', 'TIntervalTimer');  // Legacy className
        this.typeMapping.set('GameCard', 'TGameCard');
        this.typeMapping.set('GameServer', 'TGameServer');
        this.typeMapping.set('Dropdown', 'TDropdown');
        this.typeMapping.set('Checkbox', 'TCheckbox');
        this.typeMapping.set('ColorPicker', 'TColorPicker');
        this.typeMapping.set('NumberInput', 'TNumberInput');
        this.typeMapping.set('TabControl', 'TTabControl');
        this.typeMapping.set('InspectorTemplate', 'TInspectorTemplate');
        this.typeMapping.set('DialogRoot', 'TDialogRoot');
        this.typeMapping.set('InfoWindow', 'TInfoWindow');
        this.typeMapping.set('Toast', 'TToast'); // TToast fehlt ggf. noch als registrierte Klasse oben? (muss nachgeholt werden falls nötig)
        this.typeMapping.set('StatusBar', 'TStatusBar');
        this.typeMapping.set('ProgressBar', 'TProgressBar');
        this.typeMapping.set('GameState', 'TGameState');
        this.typeMapping.set('Handshake', 'THandshake');
        this.typeMapping.set('Heartbeat', 'THeartbeat');
        this.typeMapping.set('StageController', 'TStageController');
        this.typeMapping.set('Variable', 'TVariable');
        this.typeMapping.set('StringMap', 'TStringMap');
        this.typeMapping.set('ObjectList', 'TObjectList');
        this.typeMapping.set('Threshold', 'TThresholdVariable');
        this.typeMapping.set('Trigger', 'TTriggerVariable');
        this.typeMapping.set('Range', 'TRangeVariable');
        this.typeMapping.set('List', 'TListVariable');
        this.typeMapping.set('Table', 'TTable');
        this.typeMapping.set('Random', 'TRandomVariable');
        this.typeMapping.set('StringVariable', 'TStringVariable');
        this.typeMapping.set('IntegerVariable', 'TIntegerVariable');
        this.typeMapping.set('BooleanVariable', 'TBooleanVariable');
        this.typeMapping.set('RealVariable', 'TRealVariable');
        this.typeMapping.set('ObjectVariable', 'TObjectVariable');
        this.typeMapping.set('KeyStore', 'TKeyStore');
        this.typeMapping.set('APIServer', 'TAPIServer');
        this.typeMapping.set('Database', 'TDataStore');
        this.typeMapping.set('DataStore', 'TDataStore');
        this.typeMapping.set('DataList', 'TDataList');
        this.typeMapping.set('SidePanel', 'TSidePanel');
        this.typeMapping.set('Card', 'TCard');
    }

    /**
     * Registriert eine neue Klasse der Registry.
     */
    public register(className: string, constructor: any) {
        this.registry.set(className, constructor);
    }

    /**
     * Erzeugt eine Instanz basierend auf dem Typ-Namen oder Klassennamen.
     */
    public createInstance(data: any): TWindow | null {
        let className = data.className;
        const typeName = data.type || data; // Akzeptiert auch reinen Typ-String

        // Falls kein className da ist, versuche über typeMapping
        if (!className && typeof typeName === 'string') {
            className = this.typeMapping.get(typeName) || typeName;
        }

        if (!className) {
            // Suppress warning for Editor classes (they are not GCS components)
            const constructorName = data?.constructor?.name;
            if (constructorName && (constructorName.endsWith('Editor') || constructorName.endsWith('Manager'))) {
                return null; // Silently ignore editor/manager instances
            }
            ComponentRegistry.logger.warn("Konnte Klasse nicht bestimmen für:", data);
            return null;
        }

        const Constructor = this.registry.get(className);
        if (!Constructor) {
            // Suppress error if the type is actually a registered action or system type
            const actionTypes = ['standard', 'system', 'data_action', 'if_condition', 'event_listener', 'action', 'toggle_dialog'];
            if (className.includes('_') || actionTypes.includes(className)) {
                ComponentRegistry.logger.debug(`Action-Type "${className}" wird im ComponentRegistry ignoriert.`);
                return null;
            }
            
            ComponentRegistry.logger.error(`Klasse "${className}" ist nicht registriert!`);
            return null;
        }

        try {
            const name = typeof data === 'object' ? (data.name || "neuesObjekt") : "neuesObjekt";
            const x = typeof data === 'object' ? (data.x || 0) : 0;
            const y = typeof data === 'object' ? (data.y || 0) : 0;

            ComponentRegistry.logger.info(`Hydriere "${name}" (Typ: ${className})`);
            const instance = new Constructor(name, x, y);

            // IMPORTANT: explicitly set className using the resolved registry mapping
            // to prevent minification issues (like $t) from sticking to the instance.
            (instance as any).className = className;

            // Daten übernehmen
            if (typeof data === 'object') {
                Object.keys(data).forEach(key => {
                    if (key === 'style' && typeof data.style === 'object') {
                        instance.style = { ...instance.style, ...data.style };
                    } else if (key !== 'className' && key !== 'name' && key !== 'x' && key !== 'y') {
                        instance[key] = data[key];
                    }
                });
            }

            return instance;
        } catch (error) {
            ComponentRegistry.logger.error(`Fehler beim Hydrieren von "${className}":`, error);
            return null;
        }
    }

    /**
     * Liefert die verfügbaren Events für eine Klasse.
     * Nutzt Hydrierung einer temporären Instanz, um die "echten" Klassendaten abzufragen.
     */
    public getEvents(data: any): string[] {
        const instance = this.createInstance(data);
        if (instance && typeof instance.getEvents === 'function') {
            const events = instance.getEvents();
            ComponentRegistry.logger.info(`Events für ${data.className} erfolgreich ermittelt:`, events);
            return events;
        }
        return ['onClick', 'onDoubleClick', 'onMouseEnter', 'onMouseLeave', 'onDragStart', 'onDragEnd', 'onDrop', 'onTouchStart', 'onTouchMove', 'onTouchEnd']; // Fallback
    }

    /**
     * Liefert die Inspector-Properties für eine Klasse.
     */
    public getInspectorProperties(data: any): any[] {
        const instance = this.createInstance(data);
        if (instance && typeof instance.getInspectorProperties === 'function') {
            return instance.getInspectorProperties();
        }
        return [];
    }
}

// Singleton Export
export const componentRegistry = ComponentRegistry.getInstance();
