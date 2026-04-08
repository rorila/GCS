import { TWindow } from '../components/TWindow';
import { ComponentRegistry } from './ComponentRegistry';
import '../components/index'; // Import all components to trigger their auto-registration
import { Logger } from './Logger';

const logger = Logger.get('Serialization', 'Project_Save_Load');

export function hydrateObjects(objectsData: any[]): TWindow[] {
    const objects: TWindow[] = [];

    objectsData.forEach((objData: any) => {
        if (!objData) return;

        // Factory based on ComponentRegistry (Auto-discovered)
        let newObj: TWindow | null = ComponentRegistry.create(objData);

        if (newObj) {
            const internalContainers = ['TDataList', 'TTable', 'TObjectList', 'TEmojiPicker'];
            if (internalContainers.includes(objData.className)) {
                (newObj as any).isInternalContainer = true;
            }

            // Generic ID restore
            newObj.id = objData.id;

            // IMPORTANT: Explicitly set className for production builds where constructor.name is minified
            (newObj as any).className = objData.className;

            // Legacy support for TGameLoop
            if (objData.className === 'TGameLoop' && objData.bounceOnBoundary !== undefined) {
                (newObj as any).bounceTop = objData.bounceOnBoundary;
                (newObj as any).bounceBottom = objData.bounceOnBoundary;
                (newObj as any).bounceLeft = objData.bounceOnBoundary;
                (newObj as any).bounceRight = objData.bounceOnBoundary;
            }

            // --- GENERIC PROPERTIY RESTORATION (The "Magic" Loop) ---
            // Instead of listing every single property for every single component type,
            // we iterate over all keys in the JSON object and assign them to the new instance
            // if they are not reserved internal keys.

            const reservedKeys = [
                'className', 'id', 'children', 'Tasks', 'style', // Handled explicitly
                'shapeType', // Often constructor arg, but safe to re-assign if public
                '_type', // Private backing field - must go through 'type' setter instead
                // TStageController: alle computed getter (nur getter, kein setter)
                'currentStageId', 'currentStageName', 'currentStageType',
                'currentStageIndex', 'stageCount', 'mainStageId',
                'isOnMainStage', 'isOnSplashStage',
                // TImageList: getter-only Properties
                'maxImageCount'
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
                        logger.debug(`SETTING type via generic loop for "${newObj.name}":`, val);
                    }
                }
            });

            // 2. Variable Special Case: Force 'value' restoration if it exists
            if ((newObj as any).isVariable) {
                if (objData.value !== undefined) (newObj as any).value = objData.value;
                // CRITICAL: Restore 'type' via setter (not _type) for correct morphing
                if (objData.type !== undefined) {
                    logger.debug(`RESTORING type via explicit setter for "${newObj.name}":`, objData.type);
                    (newObj as any).type = objData.type;
                } else {
                    logger.warn(`No type found in JSON for variable "${newObj.name}", falling back to constructor default:`, (newObj as any).type);
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


            // Restore children for container components (TDialogRoot, TPanel, TGroupPanel)
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

