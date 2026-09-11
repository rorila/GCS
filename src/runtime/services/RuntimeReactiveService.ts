import { Logger } from '../../utils/Logger';
import type { GameRuntime } from '../GameRuntime';
import { GameLoopManager } from '../GameLoopManager';
import { DESIGN_VALUES } from '../../components/TComponent';
const logger = Logger.get('RuntimeReactiveService', 'Runtime_Execution');

export class RuntimeReactiveService {
    public initializeReactiveBindings(runtime: GameRuntime): void {
            logger.debug('[BIND-DEBUG] initializeReactiveBindings() started. Total objects:', runtime.objects.length);
            logger.debug('[BIND-DEBUG] Stage Objects in Runtime:', runtime.objects.map(o => `${o.name || o.id} (${o.className})`));
    
            const process = (objs: any[]) => {
                objs.forEach(obj => {
                    const targetObj = runtime.reactiveRuntime.getObject(obj.id || obj.name) || obj;
                    if (targetObj.className === 'TLabel' || targetObj.className === 'TTextControl') {
                        logger.debug(`[LABEL-SCAN] "${targetObj.name}" text="${targetObj.text}"`);
                    }
                    this.bindObjectProperties(runtime, targetObj);
                    if (obj.children && obj.children.length > 0) {
                        process(obj.children);
                    }
                });
            };
    
            process(runtime.objects);
            
            // Stage-Objekt selbst binden, da der Hintergrund z.B. in runtime.stage.grid gespeichert ist
            if (runtime.stage) {
                const targetStage = runtime.reactiveRuntime.getObject(runtime.stage.id || runtime.stage.name) || runtime.stage;
                this.bindObjectProperties(runtime, targetStage);
            }
    
            // SYNC POINT: Give ReactiveRuntime access to ALL global variables
            // so it can evaluate expressions like ${MainTheme.ButtonBackground} 
            // that are defined project-wide but not explicitly placed on a Stage as objects.
            if (runtime.variableManager && runtime.variableManager.contextVars) {
                Object.entries(runtime.variableManager.contextVars).forEach(([key, val]) => {
                    runtime.reactiveRuntime.registerVariable(key, val);
                });
            }
    
            // BRIDGE: If a component is a variable, its property changes (value, items)
            // must be directed to the VariableManager to fire events (onTriggerEnter, etc.)
            // because actions often target the component directly (TestVar.value = ...)
            // bypassing the contextVars proxy.
            const variableComponents = runtime.objects.filter(obj => obj.isVariable || obj.className?.includes('Variable'));
    
            variableComponents.forEach(obj => {
                // Watch 'value'
                runtime.reactiveRuntime.getWatcher().watch(obj, 'value', (newValue, oldValue) => {
                    const varDef = runtime.getVarDef(obj.name);
                    if (varDef) {
                        runtime.variableManager.processVariableEvents(obj.name, newValue, oldValue, varDef);
                    }
                });
    
                // Watch 'items' for TListVariable
                runtime.reactiveRuntime.getWatcher().watch(obj, 'items', (newValue, oldValue) => {
                    const varDef = runtime.getVarDef(obj.name);
                    if (varDef) {
                        runtime.variableManager.processVariableEvents(obj.name, newValue, oldValue, varDef);
                    }
                });
    
                // INITIAL SYNC: Map initial component values back to VariableManager
                // This ensures contextVars correctly reflect stage-specific variable values from the start.
                // FIX: DO NOT overwrite global variables that have been preserved across stages!
                const isGlobalVar = obj.scope === 'global' || (obj.name && (obj.name in runtime.variableManager.projectVariables));
    
                if (!isGlobalVar) {
                    if (obj.value !== undefined) {
                        runtime.contextVars[obj.name] = obj.value;
                    } else if (Array.isArray((obj as any).items)) {
                        runtime.contextVars[obj.name] = (obj as any).items;
                    }
                }
            });
    
            // Debug-Logs für alle aktiven Bindings sofort zu Runtime-Beginn ausgeben
            runtime.reactiveRuntime.debug();
        }

    public bindObjectProperties(runtime: GameRuntime, obj: any): void {
            // Pool-Instanzen erben Ausdrücke wie ${Var} vom Template. Sie müssen einmalig
            // aufgelöst werden (sonst bleiben z.B. width/height rohe Strings und zerstören
            // das Layout), dürfen aber keine Live-Watcher erhalten — sonst würden bereits
            // gespawnte Instanzen bei jeder Variablenänderung mitaktualisiert.
            const once = obj?.isPoolInstance === true;
    
            const skipProps = ['id', 'name', 'className', 'parentId', 'constructor', 'Tasks'];
    
            const bindProps = (target: any, pathPrefix: string = '') => {
                if (!target || typeof target !== 'object') return;
    
                Object.keys(target).forEach(key => {
                    if (skipProps.includes(key)) return;
    
                    const val = target[key];
                    const propPath = pathPrefix ? `${pathPrefix}.${key}` : key;
    
                    // PRESERVE DESIGN VALUES: Fallback to the original expression if it was overwritten during runtime
                    const designVal = obj[DESIGN_VALUES]?.[propPath];
                    if (designVal && typeof designVal === 'string' && designVal.includes('${')) {
                        logger.debug(`Restoring and binding reactive expression: ${obj.name}.${propPath} ← ${designVal}`);
                        runtime.reactiveRuntime.bindComponent(obj, propPath, designVal, undefined, once);
                    } else if (typeof val === 'string' && val.includes('${')) {
                        logger.debug(`Creating reactive binding: ${obj.name}.${propPath} ← ${val}`);
                        runtime.reactiveRuntime.bindComponent(obj, propPath, val, undefined, once);
                    } else if (val && typeof val === 'object' && !Array.isArray(val) && (key === 'style' || key === 'events' || key === 'Tasks' || key === 'grid')) {
                        // Recursive binding for nested objects like style, grid or events
                        bindProps(val, propPath);
                    }
                });
            };
    
            bindProps(obj);
        }

    public syncVariableComponents(runtime: GameRuntime) {
            if (!runtime.objects) return;
            runtime.objects.forEach(obj => {
                if ((obj as any).isVariable && obj.name) {
                    const runtimeValue = runtime.variableManager.contextVars[obj.name];
                    if (obj.name === 'StringMap_BluePrintStage') {
                        logger.debug(`[SYNC-TRACE] StringMap_BluePrintStage sync! runtimeValue:`, runtimeValue);
                        if (runtimeValue && typeof runtimeValue === 'object') {
                            logger.debug(`[SYNC-TRACE] runtimeValue keys:`, Object.keys(runtimeValue));
                        }
                    }
                    if (runtimeValue !== undefined) {
                        if (obj.items !== undefined && Array.isArray(runtimeValue)) {
                            obj.items = runtimeValue;
                        } else {
                            // SCHUTZVORRICHTUNG: Verhindere Zerstörung des Dictionaries durch einen leeren Proxy!
                            if (obj.className === 'TStringMap' && typeof runtimeValue === 'object' && Object.keys(runtimeValue).length === 0) {
                                if ((obj as any).value && Object.keys((obj as any).value).length > 0) {
                                    return; // Erhalte den internen gesunden State der Komponente
                                }
                            }
                            (obj as any).value = runtimeValue;
                            if (obj.name === 'StringMap_BluePrintStage') {
                                logger.debug(`[SYNC-TRACE] After assignment to obj.value. obj.entries keys =`, Object.keys((obj as any).entries || {}));
                            }
                        }
                    }
                }
            });
        }

    public configureReactiveWatcher(runtime: GameRuntime): void {
        const options = runtime.options;
        if (options.makeReactive) {
                        runtime.objects.forEach(obj => runtime.reactiveRuntime.registerObject(obj.name, obj, true));
                        if (runtime.stage) {
                            runtime.stage = runtime.reactiveRuntime.registerObject(runtime.stage.name || 'main', runtime.stage, true);
                        }
                        
                        runtime.reactiveRuntime.setVariable('isSplashActive', runtime.isSplashActive);
                        const mp = options.multiplayerManager || (window as any).multiplayerManager;
                        runtime.reactiveRuntime.setVariable('isMultiplayer', !!mp);
                        if (mp) {
                            runtime.reactiveRuntime.setVariable('playerNumber', mp.playerNumber || 1);
                            runtime.reactiveRuntime.setVariable('isHost', mp.isHost !== undefined ? mp.isHost : (mp.playerNumber === 1));
                        } else {
                            runtime.reactiveRuntime.setVariable('playerNumber', 1);
                            runtime.reactiveRuntime.setVariable('isHost', true);
                        }
        
                        if (options.onRender) {
                            // Eigenschaften, die der Game-Loop selbst fuehrt. Sie duerfen NICHT
                            // in den generischen onComponentUpdate-Pfad laufen, sonst loest jede
                            // Zuweisung ein einzelnes DOM-Update aus — 60x pro Sekunde und Sprite.
                            // previousX/Y und renderX/Y fehlten hier, waehrend die alten Namen
                            // _prevX/_prevY noch gelistet sind: bei einer Umbenennung wurde diese
                            // Liste nicht mitgezogen.
                            const SPRITE_PROPS = new Set([
                                'x', 'y', 'velocityX', 'velocityY', 'errorX', 'errorY', 'visible',
                                'previousX', 'previousY', 'renderX', 'renderY',
                                '_prevVelocityX', '_prevVelocityY', '_prevX', '_prevY',
                                'imageListId', 'imageIndex'
                            ]);
                            let renderScheduled = false;
        
                            runtime.reactiveRuntime.getWatcher().addGlobalListener(
                                (obj: any, prop: string) => {
                                    if (SPRITE_PROPS.has(prop) && obj?.className === 'TSprite') {
                                        if (prop === 'x' || prop === 'y') {
                                            GameLoopManager.getInstance().requestRender();
                                        } else if (prop === 'imageListId' || prop === 'imageIndex') {
                                            GameLoopManager.getInstance().markSpriteDirty(obj);
                                            GameLoopManager.getInstance().requestRender();
                                        }
                                        return;
                                    }
        
                                    if (prop && prop.startsWith('_')) return;
        
                                    // Prüfen, ob es sich um eine Variable, ein Array oder ein Objekt ohne eindeutige ID handelt
                                    const isVariableLike = obj?.isVariable || obj?.className?.includes('Variable') || !obj?.id || Array.isArray(obj);
        
                                    if (isVariableLike && options.onComponentUpdate) {
                                        // PERF: Frueher wurde hier JEDES Objekt der Buehne
                                        // aufgefrischt — samt Theme-Merge und Layout-Rechnung —
                                        // auch wenn es die Variable gar nicht verwendet. Bei einer
                                        // Variable im Sekundentakt (Zeitanzeige) verursachte das
                                        // sekuendliche Aussetzer.
                                        if (!(runtime as any)._pendingVarProps) {
                                            (runtime as any)._pendingVarProps = new Set<string>();
                                        }
                                        // Bei echten Variablen-Objekten den Objektnamen verwenden,
                                        // nicht die Property "value", damit getObjectsDependingOn
                                        // die Labels findet, die diese Variable anzeigen.
                                        const isVariableObject = obj?.isVariable || obj?.className?.includes('Variable');
                                        const varName = isVariableObject && obj?.name ? obj.name : prop;
                                        (runtime as any)._pendingVarProps.add(varName);
        
                                        if (!(runtime as any)._softRenderScheduled) {
                                            (runtime as any)._softRenderScheduled = true;
                                            requestAnimationFrame(() => {
                                                (runtime as any)._softRenderScheduled = false;
                                                const props: Set<string> = (runtime as any)._pendingVarProps || new Set<string>();
                                                (runtime as any)._pendingVarProps = new Set<string>();
        
                                                const targets = new Set<any>();
                                                props.forEach(p => {
                                                    const deps = runtime.reactiveRuntime.getObjectsDependingOn(p);
                                                    deps.forEach(d => targets.add(d));
                                                });
        
                                                const objs = Array.from(targets);
        
                                                for (let i = 0; i < objs.length; i++) {
                                                    const o = objs[i];
                                                    if (o && o.id && !o.isVariable && !o.isService) {
                                                        options.onComponentUpdate!(o, 'variable');
                                                    }
                                                }
                                            });
                                        }
                                        return; // Voll-Render zwingend umgehen!
                                    }
        
                                    // PERF: Komponenten ohne sichtbares DOM (TAnimation, TTimer,
                                    // TImageList, TSpawner ...) haben zur Laufzeit nichts zu
                                    // zeichnen. Ohne diesen Ausstieg loeste JEDER Schreibzugriff
                                    // auf ihren internen Zustand ein vollstaendiges
                                    // updateSingleObject() aus — mit Theme-Merge, querySelector
                                    // und erzwungenem Layout, synchron mitten im Game-Loop.
                                    // Bei fuenf Animationen waren das ueber 150 ms pro Frame.
                                    if (obj?.isHiddenInRun || obj?.isService) return;
        
                                    const isDialog = obj?.className === 'TDialogRoot' || obj?.className === 'TDialog' || obj?.className === 'TThemeDialog' || obj?.className === 'TSidePanel' || obj?.constructor?.name === 'TDialogRoot' || obj?.constructor?.name === 'TThemeDialog';
        
                                    // Targeted Rendering: Update nur eine einzelne Objektstruktur im DOM (für echte UI-Komponenten)
                                    // AUSNAHME: Dialoge erfordern einen Full-Render, da ihre Sichtbarkeit (Slide-In/Out)
                                    // sich auf alle untergeordneten Kinder auswirkt (Layout/Translate Rekursion).
                                    const needsFullRender = isDialog;
        
                                    if (obj && obj.id && options.onComponentUpdate && !needsFullRender) {
                                        options.onComponentUpdate(obj, prop);
                                        return;
                                    }
        
                                    // Fallback: Voll-Render (sollte bei Variablen nicht mehr greifen)
                                    if (!renderScheduled) {
                                        renderScheduled = true;
                                        requestAnimationFrame(() => {
                                            renderScheduled = false;
                                            options.onRender!();
                                        });
                                    }
                                }
                            );
                        }
        
                        runtime.objects = runtime.reactiveRuntime.getObjects();
                        this.initializeReactiveBindings(runtime);
                    }
    }
}
