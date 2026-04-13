import { projectObjectRegistry } from '../../../services/registry/ObjectRegistry';
import { projectVariableRegistry } from '../../../services/registry/VariableRegistry';

import { hydrateObjects } from '../../../utils/Serialization';
import { MethodRegistry } from '../../MethodRegistry';
import { serviceRegistry } from '../../../services/ServiceRegistry';
import { Logger } from '../../../utils/Logger';
import { IDialogContext } from '../IDialogContext';

const logger = Logger.get('JSONDialogRenderer', 'DialogDomainHelper');

export class DialogDomainHelper {
    
    public static findVariable(ctx: IDialogContext, objectName: string): any {
        if (!objectName) return null;

        let allVars = ctx.enrichedProject?.variables || [];
        let variable = allVars.find(v => v.name === objectName);

        if (!variable) {
            const cleanName = objectName.replace(/[^\w]/g, '').toLowerCase();
            variable = allVars.find(v => (v.name || '').replace(/[^\w]/g, '').toLowerCase() === cleanName);
        }

        if (!variable) {
            const regVars = projectVariableRegistry.getVariables({
                taskName: ctx.dialogData.taskName,
                actionId: ctx.dialogData.actionId || ctx.dialogData.name
            });

            variable = regVars.find(v => v.name === objectName);
            
            if (!variable) {
                const cleanName = objectName.replace(/[^\w]/g, '').toLowerCase();
                variable = regVars.find(v => (v.name || '').replace(/[^\w]/g, '').toLowerCase() === cleanName);
            }
        }

        return variable;
    }

    public static getPropertiesForObject(ctx: IDialogContext, objectName: string): string[] {
        const variable = DialogDomainHelper.findVariable(ctx, objectName);
        
        if (variable) {
            const props = ["value"];
            const vt = (variable.type || '').toLowerCase();

            if (vt.includes('timer') || variable.duration !== undefined) {
                props.push("duration", "currentTime", "onFinish", "onTick", "onFinished");
            }
            if (vt.includes('threshold') || variable.threshold !== undefined) {
                props.push("threshold", "onThresholdReached", "onThresholdLeft", "onThresholdExceeded");
            }
            if (vt.includes('trigger') || variable.triggerValue !== undefined) {
                props.push("triggerValue", "onTriggerEnter", "onTriggerExit");
            }
            if (vt.includes('range') || vt.includes('random') || variable.min !== undefined || variable.max !== undefined) {
                props.push("min", "max");
            }
            if (vt.includes('random') || variable.isRandom) {
                props.push("isRandom", "isInteger", "onGenerated");
            }
            if (vt.includes('list')) {
                props.push("onItemAdded", "onItemRemoved", "count", "isEmpty");
                if (vt.includes('object') || variable.searchProperty !== undefined) {
                    props.push("searchProperty", "searchValue", "onContains", "onNotContains");
                }
            }

            return Array.from(new Set(props));
        }

        const objects = projectObjectRegistry.getObjects();
        const objData = objects.find(o => o.name === objectName);
        if (!objData) return ["x", "y", "width", "height", "caption", "text", "style.visible"];

        try {
            const hydrated = hydrateObjects([objData]);
            if (hydrated.length > 0) {
                const hProps = hydrated[0].getInspectorProperties().map((p: any) => {
                    if (typeof p === 'string') return p;
                    return p.name;
                });
                return Array.from(new Set(["x", "y", "width", "height", "visible", ...hProps]));
            }
        } catch (e) {
            logger.warn(`Failed to hydrate ${objectName} for properties`, e);
        }
        return ["x", "y", "width", "height", "caption", "text", "style.visible"];
    }

    public static getMethodsForObject(ctx: IDialogContext, objectName: string): string[] {
        const variable = DialogDomainHelper.findVariable(ctx, objectName);
        if (variable) {
            const methods = ["reset"];
            const vt = (variable.type || '').toLowerCase();

            if (vt.includes('timer') || variable.duration !== undefined) {
                methods.push("start", "stop");
            }
            if (vt.includes('random') || variable.isRandom) {
                methods.push("roll");
            }
            if (vt.includes('list')) {
                methods.push("add", "remove", "clear", "contains", "sort");
            }

            return Array.from(new Set(methods));
        }

        const objects = projectObjectRegistry.getObjects();
        const objData = objects.find(o => o.name === objectName);
        if (!objData) {
            const serviceMethods = serviceRegistry.listMethods(objectName);
            if (serviceMethods && serviceMethods.length > 0) {
                return serviceMethods.map(m => m.name);
            }
            return [];
        }

        const className = objData.className || 'TComponent';

        const methodMap: Record<string, string[]> = {
            'TNumberLabel': ['incValue', 'decValue', 'reset'],
            'TToast': ['info', 'success', 'warning', 'error', 'clear'],
            'TTimer': ['timerStart', 'timerStop', 'reset'],
            'TIntervalTimer': ['start', 'stop', 'reset'],
            'TGameLoop': ['start', 'stop', 'pause', 'resume'],
            'TGameState': ['setState', 'reset'],
            'TSprite': ['moveTo', 'setVelocity', 'stop', 'reset'],
            'TButton': ['click', 'enable', 'disable', 'moveTo'],
            'TLabel': ['setText', 'moveTo'],
            'TEdit': ['setText', 'clear', 'focus', 'moveTo'],
            'TPanel': ['show', 'hide', 'toggle', 'moveTo'],
            'TImage': ['setSrc', 'show', 'hide', 'moveTo'],
            'TVideo': ['play', 'pause', 'stop', 'setSrc', 'moveTo'],
            'TAudio': ['play', 'pause', 'stop', 'setSrc'],
            'TGameServer': ['connect', 'disconnect', 'createRoom', 'joinRoom', 'leaveRoom', 'sendMessage'],
            'TGameCard': ['flip', 'reset', 'moveTo'],
            'TInputController': ['enable', 'disable'],
            'TStatusBar': ['setSection', 'show', 'hide', 'moveTo'],
            'TWindow': ['open', 'close', 'toggle', 'moveTo'],
            'TTabControl': ['selectTab'],
            'TStageController': ['goToStage', 'goToMainStage', 'goToFirstStage', 'nextStage', 'previousStage'],
        };

        return methodMap[className] || [];
    }

    public static getMethodSignature(_targetName: string, methodName: string): any[] {
        if (!methodName) return [];
        const signature = MethodRegistry[methodName];
        if (signature) {
            return signature;
        }
        return [{ name: 'params', type: 'string', label: 'Parameter', isGeneric: true }];
    }
}
