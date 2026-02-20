import { ExpressionParser } from './ExpressionParser';
import { PropertyWatcher } from './PropertyWatcher';
import { makeReactive } from './ReactiveProperty';
import { DESIGN_VALUES } from '../components/TComponent';

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
            const objName = parts[0];
            const propPath = parts.slice(1).join('.');

            const sourceObj = this.objectsByName.get(objName) || this.variables;

            if (sourceObj) {
                // Initial watch
                this.watcher.watch(sourceObj, propPath || objName, () => {
                    binding.update();
                });

                // SPECIAL CASE: If we depend on a Variable Component (objName) 
                // but didn't specify a property (like .value), automatically watch .value
                // because we intelligently stringify variables by their value.
                if (!propPath && sourceObj.isVariable === true) {
                    console.log(`[ReactiveRuntime] Deep watch enabled for variable: ${objName}.value`);
                    this.watcher.watch(sourceObj, 'value', () => binding.update());
                    this.watcher.watch(sourceObj, 'items', () => binding.update());
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
        const context: Record<string, any> = {};

        // 1. Add all variables (Data) first as baseline
        this.variables.forEach((value, name) => {
            context[name] = value;
        });

        // 2. Add all registered objects (Proxies/Components) - they only overwrite if no variable exists
        this.objectsByName.forEach((obj, name) => {
            if (context[name] === undefined) {
                context[name] = obj;
            }
        });

        // 3. Add by ID
        this.objectsById.forEach((obj, id) => {
            if (!context[id]) context[id] = obj;
        });

        // console.debug('[ReactiveRuntime] Context generated:', Object.keys(context));

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
        console.log('[ReactiveRuntime] Active Bindings:');
        this.bindings.forEach((bindingList, id) => {
            bindingList.forEach(binding => {
                const targetName = binding.targetObj.name || 'Unknown';
                console.log(`  ${id}: ${targetName}.${binding.targetProp} ← ${binding.expression}`);
                console.log(`    Dependencies:`, binding.dependencies);
            });
        });

        console.log('[ReactiveRuntime] Registered Objects (Names):', Array.from(this.objectsByName.keys()));
        console.log('[ReactiveRuntime] Registered Objects (IDs):', Array.from(this.objectsById.keys()));
        console.log('[ReactiveRuntime] Variables:', Array.from(this.variables.keys()));

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
