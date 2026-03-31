import { ExpressionParser } from './ExpressionParser';
import { PropertyWatcher } from './PropertyWatcher';
import { makeReactive } from './ReactiveProperty';
import { DESIGN_VALUES } from '../components/TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('ReactiveRuntime', 'Runtime_Execution');

/**
 * ReactiveRuntime - Manages reactive bindings between objects and UI
 * 
 * Combines ExpressionParser and PropertyWatcher to create automatic
 * bidirectional data binding:
 * - Data changes → UI updates automatically
 * - UI changes → Data updates via actions
 */
export class ReactiveRuntime {
    private watcher: PropertyWatcher;
    private bindings: Map<string, ReactiveBinding[]> = new Map();
    private objectsById: Map<string, any> = new Map();
    private objectsByName: Map<string, any> = new Map();
    private variables: Map<string, any> = new Map();

    constructor() {
        this.watcher = new PropertyWatcher();
    }

    /**
     * Registers an object to be tracked
     * @param name Object name
     * @param obj Object to track
     * @param makeReactiveFlag Whether to wrap in Proxy (default: true)
     */
    registerObject(name: string, obj: any, makeReactiveFlag: boolean = true): any {
        // CRITICAL: Exclude certain components from Proxy wrapping
        // These components use arrow functions with internal state that breaks when proxied
        const excludeFromProxy = ['TGameLoop', 'TGameState', 'TInputController'];
        const shouldProxy = makeReactiveFlag && !excludeFromProxy.includes(obj.className || obj.constructor?.name);

        const reactiveObj = shouldProxy ? makeReactive(obj, this.watcher) : obj;
        const id = obj.id || name;
        this.objectsById.set(id, reactiveObj);
        this.objectsByName.set(name, reactiveObj);

        if (name === 'currentRooms' || obj.name === 'currentRooms') {
            logger.debug(`Registered currentRooms:`, {
                scope: obj.scope,
                isVariable: obj.isVariable,
                className: obj.className
            });
        }

        return reactiveObj;
    }

    /**
     * Registers a variable
     * @param name Variable name
     * @param value Initial value
     */
    registerVariable(name: string, value: any): void {
        this.variables.set(name, value);
    }

    /**
     * Gets a registered object
     */
    getObject(idOrName: string): any {
        return this.objectsById.get(idOrName) || this.objectsByName.get(idOrName);
    }

    /**
     * Gets a variable value
     */
    getVariable(name: string): any {
        return this.variables.get(name);
    }

    /**
     * Sets a variable value and triggers updates
     */
    setVariable(name: string, value: any): void {
        this.variables.set(name, value);

        // Trigger bindings that depend on this variable
        this.updateBindingsForVariable(name);
    }

    /**
     * Creates a reactive binding
     * @param targetObj Target object to update
     * @param targetProp Property to update
     * @param expression Expression to evaluate (e.g., "${player.score}")
     * @returns Binding ID for later removal
     */
    bind(targetObj: any, targetProp: string, expression: string): string {
        const bindingId = `${Date.now()}_${Math.random()}`;

        // Extract dependencies from expression
        const deps = ExpressionParser.findExpressions(expression);

        // Create binding
        const binding: ReactiveBinding = {
            id: bindingId,
            targetObj,
            targetProp,
            expression,
            dependencies: deps,
            update: () => {
                // Pre-update: Store expression as design value to protect it from SSoT loss
                if (!targetObj[DESIGN_VALUES]) targetObj[DESIGN_VALUES] = {};
                targetObj[DESIGN_VALUES][targetProp] = expression;

                const context = this.getContext();
                const newValue = ExpressionParser.interpolate(expression, context);

                // Update target property
                if (targetProp.includes('.')) {
                    ExpressionParser.setNestedProperty(targetProp, newValue, targetObj);
                } else {
                    targetObj[targetProp] = newValue;
                }
            }
        };

        // Watch all dependencies
        deps.forEach(dep => {
            const parts = dep.split('.');
            let objName = parts[0];
            let propPath = parts.slice(1).join('.');

            // NEW: Handle namespace prefixes (global., stage.)
            if ((objName === 'global' || objName === 'stage') && parts.length > 1) {
                objName = parts[1];
                propPath = parts.slice(2).join('.');
            }

            const sourceObj = this.objectsByName.get(objName) || this.variables;

            if (sourceObj) {
                // Initial watch
                const watchPath = propPath || objName;
                this.watcher.watch(sourceObj, watchPath, () => {
                    binding.update();
                });

                // SPECIAL CASE: If we depend on a Variable Component (objName) 
                // but didn't specify a property (like .value), automatically watch .value
                // because we intelligently stringify variables by their value.
                if (!propPath) {
                    if ((sourceObj as any).isVariable === true) {
                        this.watcher.watch(sourceObj, 'value', () => binding.update());
                        this.watcher.watch(sourceObj, 'items', () => binding.update());
                        this.watcher.watch(sourceObj, 'data', () => binding.update());
                    }
                }
            }
        });

        // Store binding
        if (!this.bindings.has(bindingId)) {
            this.bindings.set(bindingId, []);
        }
        this.bindings.get(bindingId)!.push(binding);

        // Initial update
        binding.update();

        return bindingId;
    }

    /**
     * Removes a binding
     */
    unbind(bindingId: string): void {
        this.bindings.delete(bindingId);
    }

    /**
     * Updates all bindings that depend on a variable
     */
    private updateBindingsForVariable(varName: string): void {
        this.bindings.forEach(bindingList => {
            bindingList.forEach(binding => {
                if (binding.dependencies.some(dep => dep.startsWith(varName))) {
                    binding.update();
                }
            });
        });
    }

    /**
     * Gets the evaluation context (all objects + variables)
     */
    public getContext(): Record<string, any> {
        const self = this;

        // Root context Proxy
        const context = new Proxy({}, {
            get: (_target, prop: string) => {
                // SPECIAL: Namespaces
                if (prop === 'global' || prop === 'stage') {
                    return new Proxy({}, {
                        get: (_target, subProp: string) => {
                            // Priority 1: Object (Component)
                            const obj = self.objectsByName.get(subProp);
                            const matchesScope = obj && (prop === 'global' ? obj.scope === 'global' : obj.scope === 'stage');

                            if (subProp === 'currentRooms') {
                                logger.debug(`Resolving ${prop}.${subProp}:`, {
                                    foundObj: !!obj,
                                    objScope: obj?.scope,
                                    matchesScope,
                                    variableValue: self.variables.get(subProp)
                                });
                            }

                            if (matchesScope) {
                                return obj;
                            }
                            // Priority 2: Variable Value
                            return self.variables.get(subProp);
                        },
                        has: (_target, subProp: string) => {
                            return self.objectsByName.has(subProp) || self.variables.has(subProp);
                        },
                        ownKeys: () => {
                            const keys = new Set([...self.objectsByName.keys(), ...self.variables.keys()]);
                            return Array.from(keys);
                        },
                        getOwnPropertyDescriptor: (_target, _subProp: string) => {
                            return { enumerable: true, configurable: true };
                        }
                    });
                }

                // Normal access (Root)
                // Priority 1: Registered Object (Proxy/Component)
                const obj = self.objectsByName.get(prop);

                if (obj !== undefined) {
                    // CRITICAL: For variable components, the runtime value takes priority.
                    // Without this, ${currentUser.name} returns the component's .name ('currentUser')
                    // instead of the assigned value's .name ('Rolf').
                    // See UC: GlobalVariablePersistence, GlobalElementPersistenceFix
                    if (obj.isVariable === true || obj.className?.includes('Variable')) {
                        const varValue = self.variables.get(prop);
                        if (varValue !== undefined) return varValue;
                    }
                    return obj;
                }

                // Priority 2: Variable Value
                const variable = self.variables.get(prop);
                if (variable !== undefined) return variable;

                // Priority 3: ID lookup
                return self.objectsById.get(prop);
            },
            has: (_target, prop: string) => {
                return prop === 'global' || prop === 'stage' || self.objectsByName.has(prop) || self.variables.has(prop) || self.objectsById.has(prop);
            },
            ownKeys: () => {
                const keys = new Set(['global', 'stage', ...self.objectsByName.keys(), ...self.variables.keys(), ...self.objectsById.keys()]);
                return Array.from(keys);
            },
            getOwnPropertyDescriptor: (_target, _unused) => {
                return { enumerable: true, configurable: true };
            }
        });

        return context;
    }

    /**
     * Evaluates an expression with current context
     */
    evaluate(expression: string): any {
        return ExpressionParser.interpolate(expression, this.getContext());
    }

    /**
     * Sets up bidirectional binding for a UI component
     * @param component UI component (e.g., TEdit)
     * @param componentProp Property to bind (e.g., "text")
     * @param dataExpression Data expression (e.g., "${player.name}")
     * @param onChange Optional callback when component changes
     */
    bindComponent(
        component: any,
        componentProp: string,
        dataExpression: string,
        onChange?: (newValue: any) => void
    ): string {
        // Bind data → component (one-way)
        const bindingId = this.bind(component, componentProp, dataExpression);

        // Bind component → data (reverse direction)
        if (onChange) {
            this.watcher.watch(component, componentProp, (newValue) => {
                onChange(newValue);
            });
        }

        return bindingId;
    }

    /**
     * Debug: Shows all active bindings
     */
    debug(): void {
        logger.info('Active Bindings:');
        this.bindings.forEach((bindingList, id) => {
            bindingList.forEach(binding => {
                const targetName = binding.targetObj.name || 'Unknown';
                logger.info(`  ${id}: ${targetName}.${binding.targetProp} ← ${binding.expression}`);
                logger.info(`    Dependencies:`, binding.dependencies);
            });
        });

        logger.info('Registered Objects (Names):', Array.from(this.objectsByName.keys()));
        logger.info('Registered Objects (IDs):', Array.from(this.objectsById.keys()));
        logger.info('Variables:', Array.from(this.variables.keys()));

        this.watcher.debug();
    }

    /**
     * Clears all bindings and watchers
     * @param clearVariables Whether to also clear the variables map (default: true)
     */
    clear(clearVariables: boolean = true): void {
        this.bindings.clear();
        this.objectsById.clear();
        this.objectsByName.clear();
        if (clearVariables) {
            this.variables.clear();
        }
        this.watcher.clear();
    }

    /**
     * Gets statistics
     */
    getStats(): ReactiveStats {
        return {
            bindingCount: this.bindings.size,
            objectCount: this.objectsById.size,
            variableCount: this.variables.size,
            watcherCount: this.watcher.getTotalWatchers()
        };
    }

    /**
     * Returns the property watcher instance
     */
    public getWatcher(): PropertyWatcher {
        return this.watcher;
    }

    /**
     * Returns all registered objects (proxies)
     */
    getObjects(): any[] {
        return Array.from(this.objectsById.values());
    }
}

/**
 * Reactive binding definition
 */
interface ReactiveBinding {
    id: string;
    targetObj: any;
    targetProp: string;
    expression: string;
    dependencies: string[];
    update: () => void;
}

/**
 * Statistics about reactive system
 */
interface ReactiveStats {
    bindingCount: number;
    objectCount: number;
    variableCount: number;
    watcherCount: number;
}
