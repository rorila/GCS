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
export function hydrateObjects(objectsData) {
    const objects = [];
    objectsData.forEach((objData) => {
        let newObj = null;
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
                newObj = new TSystemInfo(objData.name);
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
                const splashStage = new TSplashStage(objData.name, objData.x, objData.y, objData.cols, objData.rows, objData.cellSize);
                if (objData.duration !== undefined)
                    splashStage.duration = objData.duration;
                if (objData.autoHide !== undefined)
                    splashStage.autoHide = objData.autoHide;
                newObj = splashStage;
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
            default:
                console.warn("Unknown class during load:", objData.className);
                break;
        }
        if (newObj) {
            // Generic ID restore
            newObj.id = objData.id;
            // IMPORTANT: Explicitly set className for production builds where constructor.name is minified
            newObj.className = objData.className;
            newObj.scope = objData.scope || 'stage';
            newObj.isVariable = objData.isVariable || false;
            // Restore width/height (may have been overwritten by constructor defaults)
            if (objData.width !== undefined)
                newObj.width = objData.width;
            if (objData.height !== undefined)
                newObj.height = objData.height;
            if (objData.x !== undefined)
                newObj.x = objData.x;
            if (objData.y !== undefined)
                newObj.y = objData.y;
            if (objData.visible !== undefined)
                newObj.visible = objData.visible;
            if (objData.zIndex !== undefined)
                newObj.zIndex = objData.zIndex;
            // Drag & Drop properties
            if (objData.draggable !== undefined)
                newObj.draggable = objData.draggable;
            if (objData.dragMode !== undefined)
                newObj.dragMode = objData.dragMode;
            if (objData.droppable !== undefined)
                newObj.droppable = objData.droppable;
            // Generic Style restore (safely merge)
            if (objData.style) {
                Object.assign(newObj.style, objData.style);
            }
            // Restore specific properties if available
            if (objData.caption !== undefined)
                newObj.caption = objData.caption;
            if (objData.text !== undefined)
                newObj.text = objData.text;
            if (objData.fontSize !== undefined)
                newObj.fontSize = objData.fontSize;
            if (objData.alignment !== undefined)
                newObj.alignment = objData.alignment;
            if (objData.align !== undefined)
                newObj.align = objData.align;
            if (objData.title !== undefined)
                newObj.title = objData.title;
            if (objData.titleAlign !== undefined)
                newObj.titleAlign = objData.titleAlign;
            if (objData.textColor !== undefined)
                newObj.textColor = objData.textColor;
            if (objData.fontWeight !== undefined)
                newObj.fontWeight = objData.fontWeight;
            if (objData.fontFamily !== undefined)
                newObj.fontFamily = objData.fontFamily;
            if (objData.placeholder !== undefined)
                newObj.placeholder = objData.placeholder;
            if (objData.maxLength !== undefined)
                newObj.maxLength = objData.maxLength;
            if (objData.readOnly !== undefined)
                newObj.readOnly = objData.readOnly;
            if (objData.color !== undefined && 'color' in newObj) {
                newObj.color = objData.color;
            }
            // TSprite specific properties
            if (objData.velocityX !== undefined)
                newObj.velocityX = objData.velocityX;
            if (objData.velocityY !== undefined)
                newObj.velocityY = objData.velocityY;
            if (objData.lerpSpeed !== undefined)
                newObj.lerpSpeed = objData.lerpSpeed;
            if (objData.collisionEnabled !== undefined)
                newObj.collisionEnabled = objData.collisionEnabled;
            if (objData.collisionGroup !== undefined)
                newObj.collisionGroup = objData.collisionGroup;
            if (objData.shape !== undefined)
                newObj.shape = objData.shape;
            if (objData.spriteColor !== undefined)
                newObj.spriteColor = objData.spriteColor;
            // ImageCapable properties (TImage, TSprite, TStage)
            if (objData.backgroundImage !== undefined)
                newObj.backgroundImage = objData.backgroundImage;
            // Fallback for TImage/TSprite which might use 'src'
            if (objData.src !== undefined && (newObj.className === 'TImage' || newObj.className === 'TSprite')) {
                // console.log(`[Serialization] Applying src->backgroundImage fallback for "${objData.name}" (${(newObj as any).className}): ${objData.src}`);
                newObj.backgroundImage = objData.src;
            }
            if (objData.objectFit !== undefined)
                newObj.objectFit = objData.objectFit;
            if (objData.imageOpacity !== undefined)
                newObj.imageOpacity = objData.imageOpacity;
            if (objData.icon !== undefined)
                newObj.icon = objData.icon;
            // TImage specific properties
            if (objData.alt !== undefined)
                newObj.alt = objData.alt;
            if (objData.fallbackColor !== undefined)
                newObj.fallbackColor = objData.fallbackColor;
            // TVideo specific properties
            if (objData.videoSource !== undefined)
                newObj.videoSource = objData.videoSource;
            if (objData.autoplay !== undefined)
                newObj.autoplay = objData.autoplay;
            if (objData.loop !== undefined)
                newObj.loop = objData.loop;
            if (objData.muted !== undefined)
                newObj.muted = objData.muted;
            if (objData.playbackRate !== undefined)
                newObj.playbackRate = objData.playbackRate;
            // TSplashScreen specific properties
            if (objData.duration !== undefined)
                newObj.duration = objData.duration;
            if (objData.autoHide !== undefined)
                newObj.autoHide = objData.autoHide;
            if (objData.fadeSpeed !== undefined)
                newObj.fadeSpeed = objData.fadeSpeed;
            if (objData.onFinishTask !== undefined)
                newObj.onFinishTask = objData.onFinishTask;
            // TGameLoop specific properties
            if (objData.targetFPS !== undefined)
                newObj.targetFPS = objData.targetFPS;
            if (objData.boundsWidth !== undefined)
                newObj.boundsWidth = objData.boundsWidth;
            if (objData.boundsHeight !== undefined)
                newObj.boundsHeight = objData.boundsHeight;
            if (objData.bounceTop !== undefined)
                newObj.bounceTop = objData.bounceTop;
            if (objData.bounceBottom !== undefined)
                newObj.bounceBottom = objData.bounceBottom;
            if (objData.bounceLeft !== undefined)
                newObj.bounceLeft = objData.bounceLeft;
            if (objData.bounceRight !== undefined)
                newObj.bounceRight = objData.bounceRight;
            if (objData.boundsOffsetTop !== undefined)
                newObj.boundsOffsetTop = objData.boundsOffsetTop;
            if (objData.boundsOffsetBottom !== undefined)
                newObj.boundsOffsetBottom = objData.boundsOffsetBottom;
            // Legacy support
            if (objData.bounceOnBoundary !== undefined) {
                newObj.bounceTop = objData.bounceOnBoundary;
                newObj.bounceBottom = objData.bounceOnBoundary;
                newObj.bounceLeft = objData.bounceOnBoundary;
                newObj.bounceRight = objData.bounceOnBoundary;
            }
            // TInputController specific properties
            if (objData.enabled !== undefined)
                newObj.enabled = objData.enabled;
            if (objData.player1Controls !== undefined)
                newObj.player1Controls = objData.player1Controls;
            if (objData.player1Target !== undefined)
                newObj.player1Target = objData.player1Target;
            if (objData.player1Speed !== undefined)
                newObj.player1Speed = objData.player1Speed;
            if (objData.player2Controls !== undefined)
                newObj.player2Controls = objData.player2Controls;
            if (objData.player2Target !== undefined)
                newObj.player2Target = objData.player2Target;
            if (objData.player2Speed !== undefined)
                newObj.player2Speed = objData.player2Speed;
            if (objData.verticalOnly !== undefined)
                newObj.verticalOnly = objData.verticalOnly;
            if (objData.horizontalOnly !== undefined)
                newObj.horizontalOnly = objData.horizontalOnly;
            // TPanel specific properties
            if (objData.showGrid !== undefined)
                newObj.showGrid = objData.showGrid;
            if (objData.gridColor !== undefined)
                newObj.gridColor = objData.gridColor;
            if (objData.gridStyle !== undefined)
                newObj.gridStyle = objData.gridStyle;
            // TTimer specific properties
            if (objData.interval !== undefined)
                newObj.interval = objData.interval;
            if (objData.enabled !== undefined)
                newObj.enabled = objData.enabled;
            if (objData.maxInterval !== undefined)
                newObj.maxInterval = objData.maxInterval;
            if (objData.currentInterval !== undefined)
                newObj.currentInterval = objData.currentInterval;
            // TDropdown specific properties
            if (objData.options !== undefined)
                newObj.options = objData.options;
            if (objData.selectedIndex !== undefined)
                newObj.selectedIndex = objData.selectedIndex;
            if (objData.selectedValue !== undefined)
                newObj.selectedValue = objData.selectedValue;
            // TCheckbox specific properties
            if (objData.checked !== undefined)
                newObj.checked = objData.checked;
            if (objData.label !== undefined)
                newObj.label = objData.label;
            // TColorPicker specific properties
            if (objData.color !== undefined && newObj.className === 'TColorPicker') {
                newObj.color = objData.color;
            }
            // TNumberInput specific properties
            if (objData.value !== undefined)
                newObj.value = objData.value;
            if (objData.min !== undefined)
                newObj.min = objData.min;
            if (objData.max !== undefined)
                newObj.max = objData.max;
            if (objData.step !== undefined)
                newObj.step = objData.step;
            // TNumberLabel specific properties
            if (objData.value !== undefined)
                newObj.value = objData.value;
            if (objData.startValue !== undefined)
                newObj.startValue = objData.startValue;
            if (objData.maxValue !== undefined)
                newObj.maxValue = objData.maxValue;
            // TTabControl specific properties
            if (objData.tabs !== undefined)
                newObj.tabs = objData.tabs;
            if (objData.activeTabIndex !== undefined)
                newObj.activeTabIndex = objData.activeTabIndex;
            if (objData.activeTabName !== undefined)
                newObj.activeTabName = objData.activeTabName;
            // TInspectorTemplate specific properties
            if (objData.layoutConfig !== undefined)
                newObj.layoutConfig = objData.layoutConfig;
            // --- GENERIC PROPERTIY RESTORATION (The "Magic" Loop) ---
            // Instead of listing every single property for every single component type,
            // we iterate over all keys in the JSON object and assign them to the new instance
            // if they are not reserved internal keys.
            const reservedKeys = [
                'className', 'id', 'children', 'Tasks', 'style', // Handled explicitly
                'shapeType', // Often constructor arg, but safe to re-assign if public
                'type' // Sometimes used for internal typing
            ];
            // 1. Generic assignment for all primitive properties
            Object.keys(objData).forEach(key => {
                if (reservedKeys.includes(key))
                    return;
                const val = objData[key];
                if (val === undefined)
                    return;
                // Handle nested properties like "style.fontSize"
                if (key.includes('.')) {
                    const parts = key.split('.');
                    let target = newObj;
                    for (let i = 0; i < parts.length - 1; i++) {
                        const part = parts[i];
                        if (!target[part])
                            target[part] = {};
                        target = target[part];
                    }
                    target[parts[parts.length - 1]] = val;
                }
                else {
                    // Direct assignment
                    newObj[key] = val;
                }
            });
            // 2. Variable Special Case: Force 'value' restoration if it exists
            // (Some variables might not have 'value' in their interface explicitly defined as public field 
            // but act as containers, so we ensure it's set)
            if (newObj.isVariable && objData.value !== undefined) {
                newObj.value = objData.value;
            }
            // 3. Style Merging (Explicit handling)
            // We blindly restore style properties if they exist in JSON
            if (objData.style) {
                const targetStyle = newObj.style || {};
                // Merge restored style into existing default style
                Object.assign(targetStyle, objData.style);
                newObj.style = targetStyle;
            }
            // Restore Tasks (Explicit handling)
            // Restore Tasks
            if (objData.Tasks) {
                newObj.Tasks = objData.Tasks;
            }
            // Restore children for container components (TDialogRoot, TPanel)
            if (objData.children && Array.isArray(objData.children) && objData.children.length > 0) {
                const hydratedChildren = hydrateObjects(objData.children);
                hydratedChildren.forEach((child) => {
                    newObj.addChild(child);
                });
            }
            objects.push(newObj);
        }
    });
    return objects;
}
