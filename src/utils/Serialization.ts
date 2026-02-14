import { TWindow } from '../components/TWindow';
import { TButton } from '../components/TButton';
import { TPanel } from '../components/TPanel';
import { TLabel } from '../components/TLabel';
import { TEdit } from '../components/TEdit';
import { TSystemInfo } from '../components/TSystemInfo';
import { TGameHeader } from '../components/TGameHeader';
import { TSprite } from '../components/TSprite';
import { TGameLoop } from '../components/TGameLoop';
import { TInputController } from '../components/TInputController';
import { TTimer } from '../components/TTimer';
import { TRepeater } from '../components/TRepeater';
import { TGameCard } from '../components/TGameCard';
import { TGameServer } from '../components/TGameServer';
import { TDropdown } from '../components/TDropdown';
import { TCheckbox } from '../components/TCheckbox';
import { TColorPicker } from '../components/TColorPicker';
import { TNumberInput } from '../components/TNumberInput';
import { TTabControl } from '../components/TTabControl';
import { TInspectorTemplate } from '../components/TInspectorTemplate';
// New dialog components
import { TDialogRoot } from '../components/TDialogRoot';
import { TInfoWindow } from '../components/TInfoWindow';
import { TToast } from '../components/TToast';
import { TStatusBar } from '../components/TStatusBar';
import { TGameState } from '../components/TGameState';
import { THandshake } from '../components/THandshake';
import { THeartbeat } from '../components/THeartbeat';
import { TImage } from '../components/TImage';
import { TVideo } from '../components/TVideo';
import { TSplashScreen } from '../components/TSplashScreen';
import { TSplashStage } from '../components/TSplashStage';
import { TStageController } from '../components/TStageController';
import { TNumberLabel } from '../components/TNumberLabel';
import { TMemo } from '../components/TMemo';
import { TShape } from '../components/TShape';
import { TVariable } from '../components/TVariable';
import { TObjectList } from '../components/TObjectList';
import { TThresholdVariable } from '../components/TThresholdVariable';
import { TTriggerVariable } from '../components/TTriggerVariable';
import { TRangeVariable } from '../components/TRangeVariable';
import { TListVariable } from '../components/TListVariable';
import { TRandomVariable } from '../components/TRandomVariable';
import { TKeyStore } from '../components/TKeyStore';
// NEW: Missing component imports
import { TEmojiPicker } from '../components/TEmojiPicker';
import { TStringVariable } from '../components/TStringVariable';
import { TIntegerVariable } from '../components/TIntegerVariable';
import { TBooleanVariable } from '../components/TBooleanVariable';
import { TRealVariable } from '../components/TRealVariable';
import { TObjectVariable } from '../components/TObjectVariable';
import { TNavBar } from '../components/TNavBar';
import { TCard } from '../components/TCard';
import { TList } from '../components/TList';
import { TDataStore } from '../components/TDataStore';
import { TBadge } from '../components/TBadge';
import { TAvatar } from '../components/TAvatar';
import { TTabBar } from '../components/TTabBar';
import { TAuthService } from '../components/TAuthService';
import { TUserManager } from '../components/TUserManager';
import { TAPIServer } from '../components/TAPIServer';
import { TTextControl } from '../components/TTextControl';
import { TTable } from '../components/TTable';

export function hydrateObjects(objectsData: any[]): TWindow[] {
    const objects: TWindow[] = [];

    objectsData.forEach((objData: any) => {
        let newObj: TWindow | null = null;

        /** DEBUG LOG START **/
        // console.log(`[Serialization] Hydrating: ${objData.className} (${objData.name})`);
        /** DEBUG LOG END **/

        // Factory based on className
        switch (objData.className) {
            case 'TButton':
                newObj = new TButton(objData.name, objData.x, objData.y, objData.width, objData.height, objData.caption);
                break;
            case 'TPanel':
                newObj = new TPanel(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TLabel':
                newObj = new TLabel(objData.name, objData.x, objData.y, objData.text);
                break;
            case 'TEdit':
            case 'TTextInput':
                newObj = new TEdit(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TSystemInfo':
                newObj = new TSystemInfo(objData.name) as unknown as TWindow;
                break;
            case 'TGameHeader':
                newObj = new TGameHeader(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TSprite':
                newObj = new TSprite(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TGameLoop':
                newObj = new TGameLoop(objData.name, objData.x, objData.y);
                break;
            case 'TInputController':
                newObj = new TInputController(objData.name, objData.x, objData.y);
                break;
            case 'TTimer':
                newObj = new TTimer(objData.name, objData.x, objData.y);
                break;
            case 'TRepeater':
                newObj = new TRepeater(objData.name, objData.x, objData.y);
                break;
            case 'TGameCard':
                newObj = new TGameCard(objData.name, objData.x, objData.y);
                break;
            case 'TGameServer':
                newObj = new TGameServer(objData.name, objData.x, objData.y);
                break;
            case 'TDropdown':
                newObj = new TDropdown(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TCheckbox':
                newObj = new TCheckbox(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TColorPicker':
                newObj = new TColorPicker(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TNumberInput':
                newObj = new TNumberInput(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TTabControl':
                newObj = new TTabControl(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TInspectorTemplate':
                newObj = new TInspectorTemplate(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            // New dialog components
            case 'TDialogRoot':
                newObj = new TDialogRoot(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TInfoWindow':
                newObj = new TInfoWindow(objData.name, objData.x, objData.y);
                break;
            case 'TToast':
                newObj = new TToast(objData.name);
                break;
            case 'TStatusBar':
                newObj = new TStatusBar(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TGameState':
                newObj = new TGameState(objData.name, objData.x, objData.y);
                break;
            case 'TStageController':
                newObj = new TStageController(objData.name, objData.x, objData.y);
                break;
            case 'THandshake':
                newObj = new THandshake(objData.name, objData.x, objData.y);
                break;
            case 'THeartbeat':
                newObj = new THeartbeat(objData.name, objData.x, objData.y);
                break;
            case 'TImage':
                newObj = new TImage(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TVideo':
                newObj = new TVideo(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TSplashScreen':
                newObj = new TSplashScreen(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TSplashStage':
                // TSplashStage - spezielle Stage für Splash-Screens
                // Hinweis: TSplashStage wird normalerweise über das stages-Array gehandhabt,
                // dieser Case existiert für Legacy-Kompatibilität
                const splashStage = new TSplashStage(
                    objData.name, objData.x, objData.y, objData.cols, objData.rows, objData.cellSize
                );
                if (objData.duration !== undefined) splashStage.duration = objData.duration;
                if (objData.autoHide !== undefined) splashStage.autoHide = objData.autoHide;
                newObj = splashStage as unknown as TWindow;
                break;
            case 'TNumberLabel':
                newObj = new TNumberLabel(objData.name, objData.x, objData.y, objData.startValue);
                break;
            case 'TMemo':
                newObj = new TMemo(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TShape':
                newObj = new TShape(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TVariable':
                newObj = new TVariable(objData.name, objData.x, objData.y);
                break;
            case 'TObjectList':
                newObj = new TObjectList(objData.name, objData.x, objData.y);
                break;
            case 'TThresholdVariable':
                newObj = new TThresholdVariable(objData.name, objData.x, objData.y);
                break;
            case 'TTriggerVariable':
                newObj = new TTriggerVariable(objData.name, objData.x, objData.y);
                break;
            case 'TRangeVariable':
                newObj = new TRangeVariable(objData.name, objData.x, objData.y);
                break;
            case 'TListVariable':
                newObj = new TListVariable(objData.name, objData.x, objData.y);
                break;
            case 'TRandomVariable':
                newObj = new TRandomVariable(objData.name, objData.x, objData.y);
                break;
            case 'TKeyStore':
                newObj = new TKeyStore(objData.name, objData.x, objData.y);
                break;
            // NEW: Missing component cases
            case 'TEmojiPicker':
                newObj = new TEmojiPicker(objData.name, objData.x, objData.y);
                break;
            case 'TStringVariable':
                newObj = new TStringVariable(objData.name, objData.x, objData.y);
                break;
            case 'TIntegerVariable':
                newObj = new TIntegerVariable(objData.name, objData.x, objData.y);
                break;
            case 'TBooleanVariable':
                newObj = new TBooleanVariable(objData.name, objData.x, objData.y);
                break;
            case 'TRealVariable':
                newObj = new TRealVariable(objData.name, objData.x, objData.y);
                break;
            case 'TObjectVariable':
                newObj = new TObjectVariable(objData.name, objData.x, objData.y);
                break;
            case 'TNavBar':
                newObj = new TNavBar(objData.name, objData.x, objData.y);
                break;
            case 'TCard':
                newObj = new TCard(objData.name, objData.x, objData.y);
                break;
            case 'TList':
                newObj = new TList(objData.name, objData.x, objData.y);
                break;
            case 'TDataStore':
                newObj = new TDataStore(objData.name, objData.x, objData.y);
                // Explicitly restore critical properties immediately
                if (objData.storagePath) (newObj as any).storagePath = objData.storagePath;
                if (objData.defaultCollection) (newObj as any).defaultCollection = objData.defaultCollection;
                break;
            case 'TBadge':
                newObj = new TBadge(objData.name, objData.x, objData.y);
                break;
            case 'TAvatar':
                newObj = new TAvatar(objData.name, objData.x, objData.y);
                break;
            case 'TTabBar':
                newObj = new TTabBar(objData.name, objData.x, objData.y);
                break;
            case 'TAuthService':
                newObj = new TAuthService(objData.name) as any;
                break;
            case 'TUserManager':
                newObj = new TUserManager(objData.name) as any;
                break;
            case 'TAPIServer':
                newObj = new TAPIServer(objData.name, objData.x, objData.y);
                break;
            case 'TTextControl':
                newObj = new TTextControl(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            case 'TTable':
                newObj = new TTable(objData.name, objData.x, objData.y, objData.width, objData.height);
                break;
            default:
                console.warn("Unknown class during load:", objData.className);
                break;
        }

        if (newObj) {
            // Generic ID restore
            newObj.id = objData.id;

            // IMPORTANT: Explicitly set className for production builds where constructor.name is minified
            (newObj as any).className = objData.className;
            newObj.scope = objData.scope || 'stage';
            newObj.isVariable = objData.isVariable || false;

            // Restore width/height (may have been overwritten by constructor defaults)
            if (objData.width !== undefined) newObj.width = objData.width;
            if (objData.height !== undefined) newObj.height = objData.height;
            if (objData.x !== undefined) newObj.x = objData.x;
            if (objData.y !== undefined) newObj.y = objData.y;
            if (objData.visible !== undefined) newObj.visible = objData.visible;
            if (objData.zIndex !== undefined) newObj.zIndex = objData.zIndex;

            // Drag & Drop properties
            if (objData.draggable !== undefined) newObj.draggable = objData.draggable;
            if (objData.dragMode !== undefined) newObj.dragMode = objData.dragMode;
            if (objData.droppable !== undefined) newObj.droppable = objData.droppable;

            // Generic Style restore (safely merge) - only if the object has a style property
            if (objData.style && newObj.style) {
                Object.assign(newObj.style, objData.style);
            }

            // Restore specific properties if available
            if (objData.caption !== undefined) {
                if (newObj.constructor.name === 'TDataStore') {
                    console.log(`[Serialization] Assigning caption "${objData.caption}" to TDataStore "${objData.name}"`);
                }
                (newObj as any).caption = objData.caption;
            }
            if (objData.text !== undefined) (newObj as any).text = objData.text;
            if (objData.fontSize !== undefined) (newObj as any).fontSize = objData.fontSize;
            if (objData.alignment !== undefined) (newObj as any).alignment = objData.alignment;
            if (objData.align !== undefined) (newObj as any).align = objData.align;
            if (objData.title !== undefined) (newObj as any).title = objData.title;
            if (objData.titleAlign !== undefined) (newObj as any).titleAlign = objData.titleAlign;
            if (objData.textColor !== undefined) (newObj as any).textColor = objData.textColor;
            if (objData.fontWeight !== undefined) (newObj as any).fontWeight = objData.fontWeight;
            if (objData.fontFamily !== undefined) (newObj as any).fontFamily = objData.fontFamily;
            if (objData.placeholder !== undefined) (newObj as any).placeholder = objData.placeholder;
            if (objData.maxLength !== undefined) (newObj as any).maxLength = objData.maxLength;
            if (objData.readOnly !== undefined) (newObj as any).readOnly = objData.readOnly;

            if (objData.color !== undefined && 'color' in newObj) {
                (newObj as any).color = objData.color;
            }

            // TSprite specific properties
            if (objData.velocityX !== undefined) (newObj as any).velocityX = objData.velocityX;
            if (objData.velocityY !== undefined) (newObj as any).velocityY = objData.velocityY;
            if (objData.lerpSpeed !== undefined) (newObj as any).lerpSpeed = objData.lerpSpeed;
            if (objData.collisionEnabled !== undefined) (newObj as any).collisionEnabled = objData.collisionEnabled;
            if (objData.collisionGroup !== undefined) (newObj as any).collisionGroup = objData.collisionGroup;
            if (objData.shape !== undefined) (newObj as any).shape = objData.shape;
            if (objData.spriteColor !== undefined) (newObj as any).spriteColor = objData.spriteColor;

            // ImageCapable properties (TImage, TSprite, TStage)
            if (objData.backgroundImage !== undefined) (newObj as any).backgroundImage = objData.backgroundImage;
            // Fallback for TImage/TSprite which might use 'src'
            if (objData.src !== undefined && ((newObj as any).className === 'TImage' || (newObj as any).className === 'TSprite')) {
                // console.log(`[Serialization] Applying src->backgroundImage fallback for "${objData.name}" (${(newObj as any).className}): ${objData.src}`);
                (newObj as any).backgroundImage = objData.src;
            }
            if (objData.objectFit !== undefined) (newObj as any).objectFit = objData.objectFit;
            if (objData.imageOpacity !== undefined) (newObj as any).imageOpacity = objData.imageOpacity;
            if (objData.icon !== undefined) (newObj as any).icon = objData.icon;

            // TImage specific properties
            if (objData.alt !== undefined) (newObj as any).alt = objData.alt;
            if (objData.fallbackColor !== undefined) (newObj as any).fallbackColor = objData.fallbackColor;

            // TVideo specific properties
            if (objData.videoSource !== undefined) (newObj as any).videoSource = objData.videoSource;
            if (objData.autoplay !== undefined) (newObj as any).autoplay = objData.autoplay;
            if (objData.loop !== undefined) (newObj as any).loop = objData.loop;
            if (objData.muted !== undefined) (newObj as any).muted = objData.muted;
            if (objData.playbackRate !== undefined) (newObj as any).playbackRate = objData.playbackRate;

            // TSplashScreen specific properties
            if (objData.duration !== undefined) (newObj as any).duration = objData.duration;
            if (objData.autoHide !== undefined) (newObj as any).autoHide = objData.autoHide;
            if (objData.fadeSpeed !== undefined) (newObj as any).fadeSpeed = objData.fadeSpeed;
            if (objData.onFinishTask !== undefined) (newObj as any).onFinishTask = objData.onFinishTask;

            // TGameLoop specific properties
            if (objData.targetFPS !== undefined) (newObj as any).targetFPS = objData.targetFPS;
            if (objData.boundsWidth !== undefined) (newObj as any).boundsWidth = objData.boundsWidth;
            if (objData.boundsHeight !== undefined) (newObj as any).boundsHeight = objData.boundsHeight;
            if (objData.bounceTop !== undefined) (newObj as any).bounceTop = objData.bounceTop;
            if (objData.bounceBottom !== undefined) (newObj as any).bounceBottom = objData.bounceBottom;
            if (objData.bounceLeft !== undefined) (newObj as any).bounceLeft = objData.bounceLeft;
            if (objData.bounceRight !== undefined) (newObj as any).bounceRight = objData.bounceRight;
            if (objData.boundsOffsetTop !== undefined) (newObj as any).boundsOffsetTop = objData.boundsOffsetTop;
            if (objData.boundsOffsetBottom !== undefined) (newObj as any).boundsOffsetBottom = objData.boundsOffsetBottom;
            // Legacy support
            if (objData.bounceOnBoundary !== undefined) {
                (newObj as any).bounceTop = objData.bounceOnBoundary;
                (newObj as any).bounceBottom = objData.bounceOnBoundary;
                (newObj as any).bounceLeft = objData.bounceOnBoundary;
                (newObj as any).bounceRight = objData.bounceOnBoundary;
            }

            // TInputController specific properties
            if (objData.enabled !== undefined) (newObj as any).enabled = objData.enabled;
            if (objData.player1Controls !== undefined) (newObj as any).player1Controls = objData.player1Controls;
            if (objData.player1Target !== undefined) (newObj as any).player1Target = objData.player1Target;
            if (objData.player1Speed !== undefined) (newObj as any).player1Speed = objData.player1Speed;
            if (objData.player2Controls !== undefined) (newObj as any).player2Controls = objData.player2Controls;
            if (objData.player2Target !== undefined) (newObj as any).player2Target = objData.player2Target;
            if (objData.player2Speed !== undefined) (newObj as any).player2Speed = objData.player2Speed;
            if (objData.verticalOnly !== undefined) (newObj as any).verticalOnly = objData.verticalOnly;
            if (objData.horizontalOnly !== undefined) (newObj as any).horizontalOnly = objData.horizontalOnly;

            // TPanel specific properties
            if (objData.showGrid !== undefined) (newObj as any).showGrid = objData.showGrid;
            if (objData.gridColor !== undefined) (newObj as any).gridColor = objData.gridColor;
            if (objData.gridStyle !== undefined) (newObj as any).gridStyle = objData.gridStyle;

            // TTimer specific properties
            if (objData.interval !== undefined) (newObj as any).interval = objData.interval;
            if (objData.enabled !== undefined) (newObj as any).enabled = objData.enabled;
            if (objData.maxInterval !== undefined) (newObj as any).maxInterval = objData.maxInterval;
            if (objData.currentInterval !== undefined) (newObj as any).currentInterval = objData.currentInterval;

            // TDropdown specific properties
            if (objData.options !== undefined) (newObj as any).options = objData.options;
            if (objData.selectedIndex !== undefined) (newObj as any).selectedIndex = objData.selectedIndex;
            if (objData.selectedValue !== undefined) (newObj as any).selectedValue = objData.selectedValue;

            // TCheckbox specific properties
            if (objData.checked !== undefined) (newObj as any).checked = objData.checked;
            if (objData.label !== undefined) (newObj as any).label = objData.label;

            // TColorPicker specific properties
            if (objData.color !== undefined && (newObj as any).className === 'TColorPicker') {
                (newObj as any).color = objData.color;
            }

            // TNumberInput specific properties
            if (objData.value !== undefined) (newObj as any).value = objData.value;
            if (objData.min !== undefined) (newObj as any).min = objData.min;
            if (objData.max !== undefined) (newObj as any).max = objData.max;
            if (objData.step !== undefined) (newObj as any).step = objData.step;

            // TNumberLabel specific properties
            if (objData.value !== undefined) (newObj as any).value = objData.value;
            if (objData.startValue !== undefined) (newObj as any).startValue = objData.startValue;
            if (objData.maxValue !== undefined) (newObj as any).maxValue = objData.maxValue;

            // TTabControl specific properties
            if (objData.tabs !== undefined) (newObj as any).tabs = objData.tabs;
            if (objData.activeTabIndex !== undefined) (newObj as any).activeTabIndex = objData.activeTabIndex;
            if (objData.activeTabName !== undefined) (newObj as any).activeTabName = objData.activeTabName;

            // TInspectorTemplate specific properties
            if (objData.layoutConfig !== undefined) (newObj as any).layoutConfig = objData.layoutConfig;

            // --- GENERIC PROPERTIY RESTORATION (The "Magic" Loop) ---
            // Instead of listing every single property for every single component type,
            // we iterate over all keys in the JSON object and assign them to the new instance
            // if they are not reserved internal keys.

            const reservedKeys = [
                'className', 'id', 'children', 'Tasks', 'style', // Handled explicitly
                'shapeType', // Often constructor arg, but safe to re-assign if public
                '_type' // Private backing field - must go through 'type' setter instead
            ];

            // 1. Generic assignment for all primitive properties
            Object.keys(objData).forEach(key => {
                if (reservedKeys.includes(key)) return;

                const val = (objData as any)[key];
                if (val === undefined) return;

                // Handle nested properties like "style.fontSize"
                if (key.includes('.')) {
                    const parts = key.split('.');
                    let target: any = newObj;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];
                        if (!target[part]) target[part] = {};
                        target = target[part];
                    }
                    target[parts[parts.length - 1]] = val;
                } else {
                    // Direct assignment
                    (newObj as any)[key] = val;
                    if ((newObj as any).isVariable && key === 'type') {
                        console.log(`[Serialization] SETTING type via generic loop for "${newObj.name}":`, val);
                    }
                }
            });

            // 2. Variable Special Case: Force 'value' restoration if it exists
            if ((newObj as any).isVariable) {
                if (objData.value !== undefined) (newObj as any).value = objData.value;
                // CRITICAL: Restore 'type' via setter (not _type) for correct morphing
                if (objData.type !== undefined) {
                    console.log(`[Serialization] RESTORING type via explicit setter for "${newObj.name}":`, objData.type);
                    (newObj as any).type = objData.type;
                } else {
                    console.log(`[Serialization] WARNING: No type found in JSON for variable "${newObj.name}", falling back to constructor default:`, (newObj as any).type);
                }
            }

            // 3. Style Merging (Explicit handling)
            // We blindly restore style properties if they exist in JSON
            if (objData.style) {
                const targetStyle = (newObj as any).style || {};
                // Merge restored style into existing default style
                Object.assign(targetStyle, objData.style);
                (newObj as any).style = targetStyle;
            }

            // Restore events (with fallback for 'Tasks')
            newObj.events = objData.events || objData.Tasks || {};


            // Restore children for container components (TDialogRoot, TPanel)
            if (objData.children && Array.isArray(objData.children) && objData.children.length > 0) {
                const hydratedChildren = hydrateObjects(objData.children);
                hydratedChildren.forEach((child: any) => {
                    (newObj as any).addChild(child);
                });
            }

            objects.push(newObj);
        }
    });

    return objects;
}

