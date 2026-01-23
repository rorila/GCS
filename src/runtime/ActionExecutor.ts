import { PropertyHelper } from './PropertyHelper';
import { serviceRegistry } from '../services/ServiceRegistry';
import { DebugLogService } from '../services/DebugLogService';
import { ExpressionParser } from './ExpressionParser';
import { AnimationManager } from './AnimationManager';

/**
 * ActionExecutor handles the execution of all action types,
 * including core property changes and multiplayer/navigation actions.
 */
export class ActionExecutor {
    constructor(
        private objects: any[],
        private multiplayerManager?: any,
        private onNavigate?: (target: string, params?: any) => void
    ) {
        // Listener moved to player-standalone for better lifecycle management
    }

    public setObjects(objects: any[]) {
        this.objects = objects;
    }

    /**
     * Executes a single action
     * @param action The action definition (from project JSON)
     * @param vars Local task variables context
     * @param globalVars Persistent global variables context
     * @param contextObj The object that triggered the event (for $eventSource resolution)
     */
    async execute(action: any, vars: Record<string, any>, globalVars: Record<string, any> = {}, contextObj?: any, parentId?: string): Promise<void> {
        console.log(`[ActionExecutor] execute start: type=${action?.type} name=${action?.name}`);
        if (!action || !action.type) return;

        // Note: hostOnly logic has been moved to TaskExecutor.triggerMode
        // Actions now always execute locally when called

        const actionName = action.name || this.getDescriptiveName(action);
        const actionLogId = DebugLogService.getInstance().log('Action', actionName, {
            parentId,
            data: action
        });

        console.log(`%c[Action] Executing: type="${action.type}"`, 'color: #4caf50', action);
        console.log(`[ActionExecutor] About to switch on type: ${action.type}`);

        switch (action.type) {
            case 'variable':
                this.handleVariableAction(action, vars, globalVars, contextObj, actionLogId);
                break;
            case 'set_variable':
                this.handleSetVariableAction(action, vars, globalVars);
                break;
            case 'property':
                this.handlePropertyAction(action, vars, contextObj);
                break;
            case 'increment':
                this.handleNumericAction(action, vars, 'increment', contextObj);
                break;
            case 'negate':
                this.handleNumericAction(action, vars, 'negate', contextObj);
                break;
            case 'navigate':
                this.handleNavigateAction(action, vars);
                break;
            case 'create_room':
                this.handleCreateRoomAction(action, vars);
                break;
            case 'join_room':
                this.handleJoinRoomAction(action, vars);
                break;
            case 'send_multiplayer_sync':
                this.handleSendSyncAction(action, vars, contextObj);
                break;
            case 'smooth_sync':
                this.handleSmoothSyncAction(action, vars, contextObj);
                break;
            case 'service':
                this.handleServiceAction(action, vars, globalVars);
                break;
            case 'calculate':
                this.handleCalculateAction(action, vars, globalVars, actionLogId);
                break;
            case 'log':
                this.handleLogAction(action, vars);
                break;
            case 'http':
                await this.handleHttpAction(action, vars, globalVars);
                break;
            case 'create_object':
                this.handleCreateObjectAction(action, vars);
                break;
            case 'send_remote_event':
                this.handleSendRemoteEventAction(action, vars, contextObj);
                break;
            case 'call_method':
                this.handleCallMethodAction(action, vars, contextObj);
                break;
            case 'animate':
                this.handleAnimateAction(action, vars, contextObj);
                break;
            case 'move_to':
                this.handleMoveToAction(action, vars, contextObj);
                break;
            case 'navigate_stage':
                this.handleNavigateStageAction(action, vars);
                break;
            case 'shake':
                this.handleShakeAction(action, vars, contextObj);
                break;
            default:
                console.warn(`[ActionExecutor] Unknown action type: ${action.type}`);
        }
    }

    private resolveTarget(targetName: string, vars: Record<string, any>, contextObj?: any): any {
        if (!targetName) return null;

        // 1. Context shortcuts
        if ((targetName === '$eventSource' || targetName === 'self' || targetName === '$self') && contextObj) {
            return contextObj;
        }

        if ((targetName === 'other' || targetName === '$other') && vars.otherSprite) {
            return vars.otherSprite;
        }

        // 2. Variable resolution (e.g. ${other})
        let actualName = targetName;
        if (targetName.startsWith('${') && targetName.endsWith('}')) {
            const varName = targetName.substring(2, targetName.length - 1);
            const varVal = vars[varName];
            if (varVal && typeof varVal === 'object' && varVal.id) return varVal; // direct object ref
            if (varVal) actualName = String(varVal);
        }

        // 3. Name/ID lookup
        let obj = this.objects.find(o => o.name === actualName);
        if (!obj) {
            obj = this.objects.find(o => o.name?.toLowerCase() === actualName.toLowerCase());
        }
        if (!obj) {
            obj = this.objects.find(o => o.id === actualName);
        }
        return obj;
    }

    private handleVariableAction(action: any, vars: Record<string, any>, globalVars: Record<string, any>, contextObj?: any, parentId?: string) {
        console.log(`[ActionExecutor] handleVariableAction: source=${action.source} var=${action.variableName} prop=${action.sourceProperty}`);
        const srcObj = this.resolveTarget(action.source, vars, contextObj);
        console.log(`%c[Variable] source="${action.source}" -> resolved=${srcObj?.name || 'NULL'}`, 'color: #9c27b0');
        if (srcObj && action.variableName && action.sourceProperty) {
            console.log(`[ActionExecutor] Getting property ${action.sourceProperty} from ${srcObj.name}`);
            const val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
            console.log(`[ActionExecutor] Value is: ${val}`);
            vars[action.variableName] = val;
            globalVars[action.variableName] = val;

            DebugLogService.getInstance().log('Variable', `${action.variableName} = ${srcObj.name}.${action.sourceProperty} = ${val}`, {
                parentId,
                objectName: srcObj.name
            });

            console.log(`%c[Variable] ${action.variableName} = ${srcObj.name}.${action.sourceProperty} = ${val}`, 'color: #9c27b0');
        } else {
            console.warn(`[ActionExecutor] Variable action failed: srcObj=${!!srcObj} varName=${action.variableName} srcProp=${action.sourceProperty}`);
        }
    }

    private handleSetVariableAction(action: any, vars: Record<string, any>, globalVars: Record<string, any>) {
        if (action.variable && action.value !== undefined) {
            vars[action.variable] = action.value;
            globalVars[action.variable] = action.value;
        }
    }

    private handlePropertyAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const isSyncActive = action.hostOnly === true;
        const targetObj = this.resolveTarget(action.target, vars, contextObj);

        if (action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const rawValue = action.changes![prop];

                // Keep booleans as-is, only interpolate strings
                let finalValue: any;
                if (typeof rawValue === 'boolean') {
                    finalValue = rawValue;
                } else if (typeof rawValue === 'number') {
                    finalValue = rawValue;
                } else {
                    // String value - interpolate and then convert back to appropriate type
                    const value = PropertyHelper.interpolate(String(rawValue), vars, this.objects);

                    // Try to convert back to number if it looks like one
                    if (value !== '' && !isNaN(Number(value))) {
                        finalValue = Number(value);
                    } else if (value === 'true') {
                        finalValue = true;
                    } else if (value === 'false') {
                        finalValue = false;
                    } else {
                        finalValue = value;
                    }
                }

                if (targetObj) {
                    this.applyChange(action.target, prop, finalValue, vars, contextObj, isSyncActive);
                } else {
                    // Fallback: If not an object, try to set as a variable
                    const targetName = action.target;
                    // Check if it looks like a variable name (simple string)
                    if (targetName && typeof targetName === 'string') {
                        console.log(`[ActionExecutor] Setting variable ${targetName} to`, finalValue);
                        vars[targetName] = finalValue;
                    }
                }
            });
        }
    }

    private handleNumericAction(action: any, vars: Record<string, any>, mode: 'increment' | 'negate', contextObj?: any) {
        const isSyncActive = action.hostOnly === true;
        if (action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const targetObj = this.resolveTarget(action.target, vars, contextObj);
                if (targetObj) {
                    const currentValue = Number(PropertyHelper.getPropertyValue(targetObj, prop)) || 0;
                    let newValue: number;

                    if (mode === 'increment') {
                        const rawIncrementValue = action.changes![prop];
                        const interpolatedValue = PropertyHelper.interpolate(String(rawIncrementValue), vars, this.objects);
                        const incrementValue = Number(interpolatedValue) || 0;
                        newValue = currentValue + incrementValue;
                    } else { // mode === 'negate'
                        newValue = currentValue * -1;
                        console.log(`[ActionExecutor] Negating ${action.target}.${prop}: ${currentValue} -> ${newValue}`);
                    }

                    this.applyChange(action.target, prop, newValue, vars, contextObj, isSyncActive);
                } else {
                    // Fallback: If not an object, try to increment/negate a variable
                    const targetName = action.target;
                    if (targetName && typeof targetName === 'string' && (prop === 'value' || prop === 'defaultValue')) {
                        const currentValue = Number(vars[targetName]) || 0;
                        let newValue: number;

                        if (mode === 'increment') {
                            const rawIncrementValue = action.changes![prop];
                            const interpolatedValue = PropertyHelper.interpolate(String(rawIncrementValue), vars, this.objects);
                            const incrementValue = Number(interpolatedValue) || 0;
                            newValue = currentValue + incrementValue;
                            console.log(`[ActionExecutor] Incrementing variable ${targetName} by ${incrementValue}: ${currentValue} -> ${newValue}`);
                        } else { // mode === 'negate'
                            newValue = currentValue * -1;
                            console.log(`[ActionExecutor] Negating variable ${targetName}: ${currentValue} -> ${newValue}`);
                        }

                        vars[targetName] = newValue;
                    }
                }
            });
        }
    }

    private handleNavigateAction(action: any, vars: Record<string, any>) {
        let targetGame = PropertyHelper.interpolate(action.target, vars, this.objects);
        if (targetGame && this.onNavigate) {
            this.onNavigate(targetGame, action.params);
        }
    }

    /**
     * Handle navigate_stage action - switches to another stage at runtime.
     * Action format:
     * {
     *   type: 'navigate_stage',
     *   params: { stageId: 'level-2' }  // or stageId: 'next' for next stage
     * }
     */
    private handleNavigateStageAction(action: any, vars: Record<string, any>) {
        const stageId = action.params?.stageId || action.stageId;
        if (!stageId) {
            console.warn('[ActionExecutor] navigate_stage: Missing stageId');
            return;
        }

        const resolvedStageId = PropertyHelper.interpolate(String(stageId), vars, this.objects);
        console.log(`[ActionExecutor] Navigating to stage: ${resolvedStageId}`);

        // Nutze onNavigate mit speziellem 'stage:' Prefix
        if (this.onNavigate) {
            this.onNavigate(`stage:${resolvedStageId}`, action.params);
        }
    }

    private handleLogAction(action: any, vars: Record<string, any>) {
        const message = PropertyHelper.interpolate(action.message || '', vars, this.objects);
        // const data = action.data ? PropertyHelper.interpolate(JSON.stringify(action.data), vars) : '';
        // console.log(`%c[LogAction] ${message}`, 'background: #222; color: #bada55', data ? JSON.parse(data) : vars);

        // Also show in toast if configured
        if (action.showToast) {
            // Check if there is a Toast object available
            const toast = this.objects.find(o => o.className === 'TToast');
            if (toast) {
                // Assuming Toast has a text property or similar to show messages
                // This is a best-effort integration
                if (typeof toast.show === 'function') {
                    toast.show(message, 'info');
                } else {
                    toast.text = message;
                }
            }
        }
    }


    private handleCreateRoomAction(action: any, vars: Record<string, any>) {
        if (this.multiplayerManager) {
            let gameName = PropertyHelper.interpolate(action.game, vars, this.objects);
            console.log(`[ActionExecutor] Creating room for game: ${gameName}`);
            this.multiplayerManager.createRoom(gameName);
        } else {
            console.error(`[ActionExecutor] Cannot create room: MultiplayerManager not available!`);
        }
    }

    private handleJoinRoomAction(action: any, vars: Record<string, any>) {
        if (this.multiplayerManager) {
            const srcObj = this.objects.find(o => o.name === action.source);
            let code = '';
            if (srcObj) {
                code = PropertyHelper.getPropertyValue(srcObj, 'text');
            } else if (action.params && action.params.code) {
                code = PropertyHelper.interpolate(String(action.params.code), vars, this.objects);
            }

            if (code && String(code).length >= 4) {
                this.multiplayerManager.joinRoom(code);
            }
        }
    }

    private handleSendSyncAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const target = this.resolveTarget(action.target, vars, contextObj);
        if (target && this.multiplayerManager) {
            const state = {
                x: target.x,
                y: target.y,
                vx: target.velocityX,
                vy: target.velocityY,
                text: target.text,
                value: target.value,
                spritesMoving: target.spritesMoving // Include GameState flag
            };
            if (target.name === 'BallSprite') {
                console.log(`[MULTIPLAYER] Sending Sync for Ball: x=${target.x.toFixed(2)}, y=${target.y.toFixed(2)}, vx=${target.velocityX.toFixed(2)}`);
            }
            this.multiplayerManager.sendStateSync(target.id, state);
        } else if (!this.multiplayerManager) {
            // Quietly skip in singleplayer
            // console.warn('[ActionExecutor] Cannot send sync: multiplayerManager is undefined');
        }
    }

    private handleSendRemoteEventAction(action: any, vars: Record<string, any>, _contextObj?: any) {
        const objectId = PropertyHelper.interpolate(action.target, vars, this.objects);
        const eventName = action.event || 'onClick';
        const params = action.params;

        if (objectId && this.multiplayerManager) {
            this.multiplayerManager.triggerRemoteEvent(objectId, eventName, params);
        } else if (!this.multiplayerManager) {
            // Quietly skip in singleplayer
            // console.warn('[ActionExecutor] Cannot send remote event: multiplayerManager is undefined');
        }
    }

    private handleSmoothSyncAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const target = this.resolveTarget(action.target, vars, contextObj);
        if (target) {
            if (vars.targetX !== undefined) target.x = Number(vars.targetX);
            if (vars.targetY !== undefined) target.y = Number(vars.targetY);
            if (vars.targetVX !== undefined) target.velocityX = Number(vars.targetVX);
            if (vars.targetVY !== undefined) target.velocityY = Number(vars.targetVY);
            if (vars.targetText !== undefined) target.text = vars.targetText;
        }
    }

    private applyChange(targetName: string, propPath: string, value: any, vars: Record<string, any>, contextObj?: any, isSyncActive: boolean = false) {
        const targetObj = this.resolveTarget(targetName, vars, contextObj);
        if (targetObj) {
            PropertyHelper.setPropertyValue(targetObj, propPath, value);

            // Spezielles Logging für Ball-Koordinaten zur Fehlersuche
            if (targetObj.name === 'BallSprite' && (propPath === 'x' || propPath === 'y')) {
                console.log(`[ACTION] Local Ball Move: ${propPath} = ${value}`);
            }

            // Automatische Synchronisation bei Physik-Änderungen auf Sprites
            if (isSyncActive && this.multiplayerManager) {
                // Auto-sync motion properties OR numeric value
                const motionProps = ['x', 'y', 'velocityX', 'velocityY', 'spritesMoving', 'value'];
                if (motionProps.includes(propPath)) {
                    // console.log(`[ActionExecutor] Auto-Syncing ${targetObj.name} due to ${propPath} change`);
                    this.handleSendSyncAction({ target: targetName }, vars, contextObj);
                }
            }
        } else {
            console.warn(`[ActionExecutor] Target not found: ${targetName}`);
        }
    }

    private async handleServiceAction(action: any, vars: Record<string, any>, globalVars: Record<string, any>): Promise<void> {
        const serviceName = action.service;
        const methodName = action.method;
        const resultVarName = action.resultVariable;

        if (!serviceName || !methodName) {
            console.warn('[ActionExecutor] Service action missing service or method');
            return;
        }

        if (!serviceRegistry.has(serviceName)) {
            console.error(`[ActionExecutor] Service not found: ${serviceName}`);
            return;
        }

        const params: any[] = [];
        if (action.serviceParams && typeof action.serviceParams === 'object') {
            for (const [, value] of Object.entries(action.serviceParams)) {
                const interpolated = PropertyHelper.interpolate(String(value), { ...globalVars, ...vars });
                params.push(interpolated);
            }
        }

        try {
            const result = await serviceRegistry.call(serviceName, methodName, params);
            if (resultVarName) {
                vars[resultVarName] = result;
                globalVars[resultVarName] = result;
            }
        } catch (error) {
            console.error(`[ActionExecutor] Service call failed:`, error);
            if (resultVarName) {
                vars[resultVarName] = { error: String(error) };
                globalVars[resultVarName] = { error: String(error) };
            }
        }
    }

    private handleCalculateAction(action: any, vars: Record<string, any>, globalVars: Record<string, any>, parentId?: string) {
        let result = 0;
        const allVars = { ...globalVars, ...vars };
        console.log(`[ActionExecutor] handleCalculateAction: formula=${action.formula} resultVar=${action.resultVariable}`, { allVars });

        if (action.formula) {
            // New preferred way: direct formula string
            try {
                console.log(`[ActionExecutor] Evaluating formula: ${action.formula}`);
                result = ExpressionParser.evaluate(action.formula, allVars);
                console.log(`[ActionExecutor] Formula result: ${result}`);
            } catch (e) {
                console.error('[ActionExecutor] Failed to evaluate formula:', action.formula, e);
            }
        } else if (action.calcSteps && Array.isArray(action.calcSteps)) {
            // ... legacy ...
            console.log(`[ActionExecutor] Falling back to calcSteps`);
            // Legacy way: sequential steps
            action.calcSteps.forEach((step: any, index: number) => {
                let value = 0;
                if (step.operandType === 'variable') {
                    const varName = step.variable;
                    if (varName) {
                        const rawVal = allVars[varName];
                        value = Number(rawVal) || 0;
                    }
                } else {
                    value = Number(step.constant) || 0;
                }

                if (index === 0 || !step.operator) {
                    result = value;
                } else {
                    switch (step.operator) {
                        case '+': result += value; break;
                        case '-': result -= value; break;
                        case '*': result *= value; break;
                        case '/': result = value !== 0 ? result / value : 0; break;
                        case '%': result = value !== 0 ? result % value : 0; break;
                        default: result += value; break;
                    }
                }
            });
        } else {
            console.warn('[ActionExecutor] Calculate action missing formula or calcSteps');
            return;
        }

        if (action.resultVariable) {
            vars[action.resultVariable] = result;
            globalVars[action.resultVariable] = result;
            console.log(`  %c[Calculate] ${action.resultVariable} = ${result}`, 'color: #9c27b0; font-style: italic;');

            // Log variable change for debug log
            DebugLogService.getInstance().log('Variable', `${action.resultVariable} = ${action.formula || 'formula'} = ${result}`, {
                parentId: parentId,
            });
        }

        // NEU: Unterstützung für direkte Property-Änderungen via calculate
        const isSyncActive = action.hostOnly === true;
        if (action.target && action.changes) {
            Object.keys(action.changes).forEach(prop => {
                const expression = action.changes![prop];
                try {
                    const value = ExpressionParser.evaluate(expression, { ...globalVars, ...vars });
                    this.applyChange(action.target, prop, value, vars, undefined, isSyncActive);
                } catch (e) {
                    console.error(`[ActionExecutor] Calculate change failed for ${prop}:`, e);
                }
            });
        }
    }

    private async handleHttpAction(action: any, vars: Record<string, any>, globalVars: Record<string, any>) {
        const url = PropertyHelper.interpolate(action.url, { ...vars, ...globalVars }, this.objects);
        const method = action.method || 'GET';
        const resultVar = action.resultVariable || 'httpResult';

        try {
            console.log(`[ActionExecutor] HTTP: ${method} ${url}`);

            const options: RequestInit = { method };

            if (action.body && (method === 'POST' || method === 'PUT' || method === 'PATCH')) {
                options.headers = {
                    'Content-Type': 'application/json'
                };

                // Interpolate variables in the body if it's an object or string
                let bodyData = action.body;
                if (typeof bodyData === 'string') {
                    bodyData = PropertyHelper.interpolate(bodyData, { ...vars, ...globalVars }, this.objects);
                } else if (typeof bodyData === 'object' && bodyData !== null) {
                    // Deep interpolation for object values (simple level for now)
                    const stringified = JSON.stringify(bodyData);
                    const interpolated = PropertyHelper.interpolate(stringified, { ...vars, ...globalVars }, this.objects);
                    bodyData = JSON.parse(interpolated);
                }

                options.body = typeof bodyData === 'string' ? bodyData : JSON.stringify(bodyData);
                console.log(`[ActionExecutor] HTTP Body:`, options.body);
            }

            const resp = await fetch(url, options);
            if (resp.ok) {
                const data = await resp.json();
                vars[resultVar] = data;
                globalVars[resultVar] = data;
                console.log(`[ActionExecutor] HTTP Success, stored in ${resultVar}`, data);
            } else {
                const errorText = await resp.text();
                console.error(`[ActionExecutor] HTTP Error ${resp.status}: ${errorText}`);
                vars[resultVar] = { success: false, status: resp.status, error: errorText };
                globalVars[resultVar] = vars[resultVar];
            }
        } catch (e) {
            console.error('[ActionExecutor] HTTP Action failed:', e);
        }
    }

    private handleCreateObjectAction(action: any, vars: Record<string, any>) {
        if (!action.objectData) return;

        // Interpolate all string values in objectData
        const rawData = JSON.stringify(action.objectData);
        const interpolatedData = PropertyHelper.interpolate(rawData, vars, this.objects);
        const config = JSON.parse(interpolatedData);

        // Ensure ID
        if (!config.id) config.id = crypto.randomUUID();

        // Add to runtime objects
        this.objects.push(config);
        console.log(`[ActionExecutor] Created dynamic object: ${config.name} (${config.className})`);
    }

    private handleCallMethodAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const target = this.resolveTarget(action.target, vars, contextObj);
        if (!target) {
            console.warn(`[ActionExecutor] call_method: Target not found: ${action.target}`);
            return;
        }

        const methodName = action.method;
        if (!methodName || typeof target[methodName] !== 'function') {
            console.warn(`[ActionExecutor] call_method: Method '${methodName}' not found on ${target.name}`);
            return;
        }

        // Interpolate parameters and convert types
        let params: any[] = [];
        if (action.params) {
            if (Array.isArray(action.params)) {
                params = action.params.map((p: any) => {
                    if (typeof p === 'string') {
                        return PropertyHelper.autoConvert(PropertyHelper.interpolate(p, vars, this.objects));
                    }
                    return p;
                });
            } else if (typeof action.params === 'string') {
                const interpolated = PropertyHelper.interpolate(action.params, vars, this.objects);
                params = [PropertyHelper.autoConvert(interpolated)];
            }
        }

        if (typeof target[methodName] === 'function') {
            target[methodName](...params);
        } else {
            console.error(`[ActionExecutor] Method ${methodName} is not a function on`, target);
        }
    }

    /**
     * Handle animate action - animates any numeric property on a target.
     * Action format:
     * {
     *   type: 'animate',
     *   target: 'SpriteA',
     *   property: 'x',
     *   to: 100,
     *   duration: 500,
     *   easing: 'easeOut'
     * }
     */
    private handleAnimateAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const target = this.resolveTarget(action.target, vars, contextObj);
        if (!target) {
            console.warn(`[ActionExecutor] animate: Target not found: ${action.target}`);
            return;
        }

        const property = action.property || 'x';
        const toValue = typeof action.to === 'string'
            ? Number(PropertyHelper.interpolate(action.to, vars, this.objects))
            : Number(action.to);
        const duration = Number(action.duration) || 500;
        const easing = action.easing || 'easeOut';

        console.log(`[ActionExecutor] Animating ${target.name}.${property} to ${toValue} over ${duration}ms (${easing})`);

        AnimationManager.getInstance().addTween(target, property, toValue, duration, easing);
    }

    /**
     * Handle move_to action - convenience action to animate x and y together.
     * Action format:
     * {
     *   type: 'move_to',
     *   target: 'SpriteA',
     *   x: 100,
     *   y: 50,
     *   duration: 500,
     *   easing: 'easeOut'
     * }
     */
    private handleMoveToAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const target = this.resolveTarget(action.target, vars, contextObj);
        if (!target) {
            console.warn(`[ActionExecutor] move_to: Target not found: ${action.target}`);
            return;
        }

        const toX = typeof action.x === 'string'
            ? Number(PropertyHelper.interpolate(action.x, vars, this.objects))
            : Number(action.x);
        const toY = typeof action.y === 'string'
            ? Number(PropertyHelper.interpolate(action.y, vars, this.objects))
            : Number(action.y);
        const duration = Number(action.duration) || 500;
        const easing = action.easing || 'easeOut';

        console.log(`[ActionExecutor] Moving ${target.name} to (${toX}, ${toY}) over ${duration}ms (${easing})`);

        // Use moveTo method if available (preferred), otherwise use AnimationManager directly
        if (typeof target.moveTo === 'function') {
            target.moveTo(toX, toY, duration, easing);
        } else {
            const manager = AnimationManager.getInstance();
            manager.addTween(target, 'x', toX, duration, easing);
            manager.addTween(target, 'y', toY, duration, easing);
        }
    }

    /**
     * Handle shake action - shakes a target object.
     * Action format:
     * {
     *   type: 'shake',
     *   target: 'SpriteA',
     *   intensity: 5,
     *   duration: 500
     * }
     */
    private handleShakeAction(action: any, vars: Record<string, any>, contextObj?: any) {
        const target = this.resolveTarget(action.target, vars, contextObj);
        if (!target) {
            console.warn(`[ActionExecutor] shake: Target not found: ${action.target}`);
            return;
        }

        const intensity = typeof action.intensity === 'string'
            ? Number(PropertyHelper.interpolate(action.intensity, vars, this.objects))
            : Number(action.intensity) || 5;
        const duration = Number(action.duration) || 500;

        console.log(`[ActionExecutor] Shaking ${target.name} (intensity: ${intensity}, duration: ${duration}ms)`);

        AnimationManager.getInstance().shake(target, intensity, duration);
    }

    private getDescriptiveName(action: any): string {
        switch (action.type) {
            case 'variable': return `Set ${action.variableName || 'var'}`;
            case 'calculate': return `Calc ${action.resultVariable || 'result'}`;
            case 'property': {
                const keys = action.changes ? Object.keys(action.changes) : [];
                const first = keys.length > 0 ? keys[0] : '';
                return `Set ${action.target || 'target'}.${first}${keys.length > 1 ? '...' : ''}`;
            }
            case 'service': return `Call ${action.service}.${action.method}`;
            case 'call_method': return `Method ${action.method} on ${action.target}`;
            case 'increment': return `Inc ${action.variableName}`;
            case 'negate': return `Toggle ${action.variableName}`;
            case 'animate': return `Animate ${action.target}`;
            case 'navigate': return `To page ${action.pageId}`;
            case 'shake': return `Shake ${action.target}`;
            default: return `Action: ${action.type || 'unknown'}`;
        }
    }
}
