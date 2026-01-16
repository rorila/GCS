"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };
  var __copyProps = (to, from, except, desc) => {
    if (from && typeof from === "object" || typeof from === "function") {
      for (let key of __getOwnPropNames(from))
        if (!__hasOwnProp.call(to, key) && key !== except)
          __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
    }
    return to;
  };
  var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
  var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);

  // src/runtime/AnimationManager.ts
  var AnimationManager_exports = {};
  __export(AnimationManager_exports, {
    AnimationManager: () => AnimationManager,
    Easing: () => Easing
  });
  var Easing, _AnimationManager, AnimationManager;
  var init_AnimationManager = __esm({
    "src/runtime/AnimationManager.ts"() {
      "use strict";
      Easing = {
        linear: (t) => t,
        easeIn: (t) => t * t,
        easeOut: (t) => t * (2 - t),
        easeInOut: (t) => t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,
        bounce: (t) => {
          if (t < 1 / 2.75) {
            return 7.5625 * t * t;
          } else if (t < 2 / 2.75) {
            return 7.5625 * (t -= 1.5 / 2.75) * t + 0.75;
          } else if (t < 2.5 / 2.75) {
            return 7.5625 * (t -= 2.25 / 2.75) * t + 0.9375;
          } else {
            return 7.5625 * (t -= 2.625 / 2.75) * t + 0.984375;
          }
        },
        elastic: (t) => {
          if (t === 0 || t === 1) return t;
          return Math.pow(2, -10 * t) * Math.sin((t - 0.1) * 5 * Math.PI) + 1;
        }
      };
      _AnimationManager = class _AnimationManager {
        constructor() {
          __publicField(this, "activeTweens", []);
        }
        static getInstance() {
          if (!_AnimationManager.instance) {
            _AnimationManager.instance = new _AnimationManager();
          }
          return _AnimationManager.instance;
        }
        /**
         * Fügt einen neuen Tween hinzu.
         * @param target Das Zielobjekt (z.B. ein TSprite)
         * @param property Der Property-Pfad (z.B. 'x', 'y', 'style.opacity')
         * @param to Der Zielwert
         * @param duration Dauer in Millisekunden
         * @param easingName Name der Easing-Funktion (default: 'easeOut')
         * @param onComplete Optionaler Callback nach Abschluss
         */
        addTween(target, property, to, duration, easingName = "easeOut", onComplete) {
          this.cancelTween(target, property);
          const from = this.getPropertyValue(target, property);
          const easing = Easing[easingName] || Easing.easeOut;
          if (property === "x" || property === "y") {
            target.isAnimating = true;
          }
          const tween = {
            target,
            property,
            from,
            to,
            duration,
            startTime: performance.now(),
            easing,
            onComplete
          };
          this.activeTweens.push(tween);
          return tween;
        }
        /**
         * Bricht einen laufenden Tween ab.
         */
        cancelTween(target, property) {
          this.activeTweens = this.activeTweens.filter(
            (t) => !(t.target === target && t.property === property)
          );
          if (property === "x" || property === "y") {
            const hasMore = this.activeTweens.some(
              (t) => t.target === target && (t.property === "x" || t.property === "y")
            );
            if (!hasMore && target.isAnimating !== void 0) {
              target.isAnimating = false;
            }
          }
        }
        /**
         * Bricht alle Tweens eines Objekts ab.
         */
        cancelAllTweens(target) {
          this.activeTweens = this.activeTweens.filter((t) => t.target !== target);
          if (target.isAnimating !== void 0) {
            target.isAnimating = false;
          }
        }
        /**
         * Aktualisiert alle aktiven Tweens. Muss pro Frame aufgerufen werden.
         */
        update() {
          const now = performance.now();
          const completedTweens = [];
          if (this.activeTweens.length > 0) {
          }
          for (const tween of this.activeTweens) {
            try {
              const elapsed = now - tween.startTime;
              let progress = Math.min(elapsed / tween.duration, 1);
              const easedProgress = tween.easing(progress);
              const newValue = tween.from + (tween.to - tween.from) * easedProgress;
              this.setPropertyValue(tween.target, tween.property, newValue);
              if (progress >= 1) {
                console.log(`[AnimationManager] Tween completed for ${tween.target.name || tween.target.id}.${tween.property}`);
                completedTweens.push(tween);
              }
            } catch (error) {
              console.error(`[AnimationManager] Error updating tween for ${tween.target.name || tween.target.id}.${tween.property}:`, error);
              completedTweens.push(tween);
            }
          }
          for (const tween of completedTweens) {
            this.activeTweens = this.activeTweens.filter((t) => t !== tween);
            if (tween.property === "x" || tween.property === "y") {
              const hasMorePositionTweens = this.activeTweens.some(
                (t) => t.target === tween.target && (t.property === "x" || t.property === "y")
              );
              if (!hasMorePositionTweens && tween.target.isAnimating !== void 0) {
                tween.target.isAnimating = false;
              }
            }
            if (tween.onComplete) {
              tween.onComplete();
            }
          }
        }
        /**
         * Gibt zurück, ob aktuell Animationen laufen.
         */
        hasActiveTweens() {
          return this.activeTweens.length > 0;
        }
        /**
         * Gibt die Anzahl aktiver Tweens zurück.
         */
        getActiveTweenCount() {
          return this.activeTweens.length;
        }
        // Hilfsfunktionen für Property-Zugriff (unterstützt Pfade wie 'style.opacity')
        getPropertyValue(target, path) {
          const parts = path.split(".");
          let value = target;
          for (const part of parts) {
            value = value?.[part];
          }
          return Number(value) || 0;
        }
        setPropertyValue(target, path, value) {
          const parts = path.split(".");
          let obj = target;
          for (let i = 0; i < parts.length - 1; i++) {
            obj = obj?.[parts[i]];
          }
          if (obj) {
            obj[parts[parts.length - 1]] = value;
          }
        }
      };
      __publicField(_AnimationManager, "instance", null);
      AnimationManager = _AnimationManager;
    }
  });

  // src/runtime/ExpressionParser.ts
  var ExpressionParser = class {
    /**
     * Finds all ${...} expressions in a string
     * @param text String to search
     * @returns Array of expression contents (without ${})
     */
    static findExpressions(text) {
      const regex = /\$\{([^}]+)\}/g;
      const matches = [];
      let match;
      while ((match = regex.exec(text)) !== null) {
        matches.push(match[1].trim());
      }
      return matches;
    }
    /**
     * Interpolates ${...} expressions with actual values
     * @param text String containing ${...} expressions
     * @param context Object containing variable values
     * @returns Interpolated value (string, number, boolean, etc.)
     */
    static interpolate(text, context) {
      if (typeof text !== "string") {
        return text;
      }
      if (!text.includes("${")) {
        return text;
      }
      const result = text.replace(/\$\{([^}]+)\}/g, (match, expression) => {
        try {
          const value = this.evaluate(expression.trim(), context);
          return value !== void 0 ? String(value) : "";
        } catch (error) {
          console.warn(`[ExpressionParser] Failed to evaluate: ${expression}`, error);
          return match;
        }
      });
      if (text.startsWith("${") && text.endsWith("}") && !text.includes("${", 2)) {
        const expression = text.slice(2, -1).trim();
        try {
          return this.evaluate(expression, context);
        } catch (error) {
          return result;
        }
      }
      return result;
    }
    /**
     * Evaluates an expression (without ${})
     * @param expression Expression to evaluate (e.g., "player.score", "x + 10")
     * @param context Object containing variable values
     * @returns Evaluated value
     */
    static evaluate(expression, context) {
      if (/^[\w.]+$/.test(expression)) {
        return this.getNestedProperty(expression, context);
      }
      try {
        const validIdentifierRegex = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/;
        const contextKeys = Object.keys(context).filter((key) => validIdentifierRegex.test(key));
        const contextValues = contextKeys.map((key) => context[key]);
        const func = new Function(...contextKeys, `return ${expression}`);
        return func(...contextValues);
      } catch (error) {
        const msg = error?.message || "";
        const name = error?.name || "";
        if ((name === "TypeError" || error instanceof TypeError) && (msg.includes("undefined") || msg.includes("null"))) {
          return void 0;
        }
        if (name === "ReferenceError" || error instanceof ReferenceError) {
          return void 0;
        }
        console.warn(`[ExpressionParser] Evaluation error for "${expression}":`, error);
        return void 0;
      }
    }
    /**
     * Gets a nested property value (e.g., "player.score.total")
     * @param path Property path (e.g., "player.score")
     * @param context Object containing values
     * @returns Property value or undefined
     */
    static getNestedProperty(path, context) {
      const parts = path.split(".");
      let current = context;
      for (const part of parts) {
        if (current === null || current === void 0) {
          return void 0;
        }
        current = current[part];
      }
      return current;
    }
    /**
     * Sets a nested property value (e.g., "player.score.total")
     * @param path Property path
     * @param value Value to set
     * @param context Object to modify
     */
    static setNestedProperty(path, value, context) {
      const parts = path.split(".");
      let current = context;
      for (let i = 0; i < parts.length - 1; i++) {
        const part = parts[i];
        if (!(part in current)) {
          current[part] = {};
        }
        current = current[part];
      }
      current[parts[parts.length - 1]] = value;
    }
    /**
     * Extracts variable dependencies from an expression
     * @param expression Expression to analyze
     * @returns Array of variable names used
     */
    static extractDependencies(expression) {
      const matches = expression.match(/\b[a-zA-Z_]\w*\b/g) || [];
      const keywords = /* @__PURE__ */ new Set(["true", "false", "null", "undefined", "typeof", "instanceof"]);
      return [...new Set(matches.filter((m) => !keywords.has(m)))];
    }
  };

  // src/runtime/PropertyWatcher.ts
  var PropertyWatcher = class {
    constructor() {
      // Map: Object -> Map: PropertyPath -> Set of Callbacks
      __publicField(this, "watchers", /* @__PURE__ */ new Map());
      // Track watched objects to prevent memory leaks
      __publicField(this, "watchedObjects", /* @__PURE__ */ new WeakSet());
    }
    /**
     * Registers a watcher for a specific property
     * @param object Object to watch
     * @param propertyPath Property path (e.g., "score" or "style.color")
     * @param callback Function to call when property changes
     */
    watch(object, propertyPath, callback) {
      if (!object || typeof object !== "object") {
        console.warn("[PropertyWatcher] Cannot watch non-object:", object);
        return;
      }
      if (!this.watchers.has(object)) {
        this.watchers.set(object, /* @__PURE__ */ new Map());
      }
      const objectWatchers = this.watchers.get(object);
      if (!objectWatchers.has(propertyPath)) {
        objectWatchers.set(propertyPath, /* @__PURE__ */ new Set());
      }
      objectWatchers.get(propertyPath).add(callback);
      this.watchedObjects.add(object);
    }
    /**
     * Removes a specific watcher
     * @param object Object being watched
     * @param propertyPath Property path
     * @param callback Callback to remove (if omitted, removes all callbacks for this property)
     */
    unwatch(object, propertyPath, callback) {
      const objectWatchers = this.watchers.get(object);
      if (!objectWatchers) return;
      const propertyWatchers = objectWatchers.get(propertyPath);
      if (!propertyWatchers) return;
      if (callback) {
        propertyWatchers.delete(callback);
      } else {
        propertyWatchers.clear();
      }
      if (propertyWatchers.size === 0) {
        objectWatchers.delete(propertyPath);
      }
      if (objectWatchers.size === 0) {
        this.watchers.delete(object);
      }
    }
    /**
     * Removes all watchers for an object
     * @param object Object to stop watching
     */
    unwatchAll(object) {
      this.watchers.delete(object);
    }
    /**
     * Notifies all watchers that a property has changed
     * @param object Object that changed
     * @param propertyPath Property that changed
     * @param newValue New value
     * @param oldValue Old value (optional)
     */
    notify(object, propertyPath, newValue, oldValue) {
      const objectWatchers = this.watchers.get(object);
      if (!objectWatchers) return;
      const propertyWatchers = objectWatchers.get(propertyPath);
      if (!propertyWatchers || propertyWatchers.size === 0) return;
      propertyWatchers.forEach((callback) => {
        try {
          callback(newValue, oldValue);
        } catch (error) {
          console.error("[PropertyWatcher] Callback error:", error);
        }
      });
    }
    /**
     * Gets the number of watchers for a specific property
     * @param object Object being watched
     * @param propertyPath Property path
     * @returns Number of watchers
     */
    getWatcherCount(object, propertyPath) {
      const objectWatchers = this.watchers.get(object);
      if (!objectWatchers) return 0;
      const propertyWatchers = objectWatchers.get(propertyPath);
      return propertyWatchers ? propertyWatchers.size : 0;
    }
    /**
     * Gets total number of watched objects
     * @returns Number of objects being watched
     */
    getTotalWatchedObjects() {
      return this.watchers.size;
    }
    /**
     * Gets total number of watchers across all objects
     * @returns Total watcher count
     */
    getTotalWatchers() {
      let total = 0;
      this.watchers.forEach((objectWatchers) => {
        objectWatchers.forEach((propertyWatchers) => {
          total += propertyWatchers.size;
        });
      });
      return total;
    }
    /**
     * Helper to get object name for logging
     */
    getObjectName(object) {
      return object.name || object.id || object.constructor?.name || "Unknown";
    }
    /**
     * Clears all watchers (useful for cleanup)
     */
    clear() {
      this.watchers.clear();
    }
    /**
     * Debug: Lists all active watchers
     */
    debug() {
      console.log("[PropertyWatcher] Active Watchers:");
      this.watchers.forEach((objectWatchers, object) => {
        const objName = this.getObjectName(object);
        objectWatchers.forEach((callbacks, propertyPath) => {
          console.log(`  ${objName}.${propertyPath}: ${callbacks.size} watchers`);
        });
      });
    }
  };

  // src/runtime/ReactiveProperty.ts
  function makeReactive(obj, watcher, path = "") {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (obj instanceof HTMLElement || obj instanceof Node || obj instanceof Set || obj instanceof Map || obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
    return new Proxy(obj, {
      get(target, property) {
        if (typeof property === "symbol") {
          return target[property];
        }
        const value = target[property];
        if (value && typeof value === "object" && !(value instanceof HTMLElement) && !(value instanceof Set) && !(value instanceof Map) && !(value instanceof Date) && !(value instanceof RegExp)) {
          const nestedPath = path ? `${path}.${property}` : property;
          return makeReactive(value, watcher, nestedPath);
        }
        return value;
      },
      set(target, property, newValue) {
        if (typeof property === "symbol") {
          target[property] = newValue;
          return true;
        }
        const oldValue = target[property];
        if (oldValue !== newValue) {
          target[property] = newValue;
          const propertyPath = path ? `${path}.${property}` : property;
          watcher.notify(target, propertyPath, newValue, oldValue);
        } else {
          target[property] = newValue;
        }
        return true;
      }
    });
  }

  // src/runtime/ReactiveRuntime.ts
  var ReactiveRuntime = class {
    constructor() {
      __publicField(this, "watcher");
      __publicField(this, "bindings", /* @__PURE__ */ new Map());
      __publicField(this, "objectsById", /* @__PURE__ */ new Map());
      __publicField(this, "objectsByName", /* @__PURE__ */ new Map());
      __publicField(this, "variables", /* @__PURE__ */ new Map());
      this.watcher = new PropertyWatcher();
    }
    /**
     * Registers an object to be tracked
     * @param name Object name
     * @param obj Object to track
     * @param makeReactiveFlag Whether to wrap in Proxy (default: true)
     */
    registerObject(name, obj, makeReactiveFlag = true) {
      const reactiveObj = makeReactiveFlag ? makeReactive(obj, this.watcher) : obj;
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
    registerVariable(name, value) {
      this.variables.set(name, value);
    }
    /**
     * Gets a registered object
     */
    getObject(idOrName) {
      return this.objectsById.get(idOrName) || this.objectsByName.get(idOrName);
    }
    /**
     * Gets a variable value
     */
    getVariable(name) {
      return this.variables.get(name);
    }
    /**
     * Sets a variable value and triggers updates
     */
    setVariable(name, value) {
      this.variables.set(name, value);
      this.updateBindingsForVariable(name);
    }
    /**
     * Creates a reactive binding
     * @param targetObj Target object to update
     * @param targetProp Property to update
     * @param expression Expression to evaluate (e.g., "${player.score}")
     * @returns Binding ID for later removal
     */
    bind(targetObj, targetProp, expression) {
      const bindingId = `${Date.now()}_${Math.random()}`;
      const deps = ExpressionParser.findExpressions(expression);
      const binding = {
        id: bindingId,
        targetObj,
        targetProp,
        expression,
        dependencies: deps,
        update: () => {
          const context = this.getContext();
          const newValue = ExpressionParser.interpolate(expression, context);
          if (targetProp.includes(".")) {
            ExpressionParser.setNestedProperty(targetProp, newValue, targetObj);
          } else {
            targetObj[targetProp] = newValue;
          }
        }
      };
      deps.forEach((dep) => {
        const parts = dep.split(".");
        const objName = parts[0];
        const propPath = parts.slice(1).join(".");
        const sourceObj = this.objectsByName.get(objName) || this.variables;
        if (sourceObj) {
          this.watcher.watch(sourceObj, propPath || objName, () => {
            binding.update();
          });
        }
      });
      if (!this.bindings.has(bindingId)) {
        this.bindings.set(bindingId, []);
      }
      this.bindings.get(bindingId).push(binding);
      binding.update();
      return bindingId;
    }
    /**
     * Removes a binding
     */
    unbind(bindingId) {
      this.bindings.delete(bindingId);
    }
    /**
     * Updates all bindings that depend on a variable
     */
    updateBindingsForVariable(varName) {
      this.bindings.forEach((bindingList) => {
        bindingList.forEach((binding) => {
          if (binding.dependencies.some((dep) => dep.startsWith(varName))) {
            binding.update();
          }
        });
      });
    }
    /**
     * Gets the evaluation context (all objects + variables)
     */
    getContext() {
      const context = {};
      this.objectsByName.forEach((obj, name) => {
        context[name] = obj;
      });
      this.objectsById.forEach((obj, id) => {
        context[id] = obj;
      });
      this.variables.forEach((value, name) => {
        context[name] = value;
      });
      return context;
    }
    /**
     * Evaluates an expression with current context
     */
    evaluate(expression) {
      return ExpressionParser.interpolate(expression, this.getContext());
    }
    /**
     * Sets up bidirectional binding for a UI component
     * @param component UI component (e.g., TEdit)
     * @param componentProp Property to bind (e.g., "text")
     * @param dataExpression Data expression (e.g., "${player.name}")
     * @param onChange Optional callback when component changes
     */
    bindComponent(component, componentProp, dataExpression, onChange) {
      const bindingId = this.bind(component, componentProp, dataExpression);
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
    debug() {
      console.log("[ReactiveRuntime] Active Bindings:");
      this.bindings.forEach((bindingList, id) => {
        bindingList.forEach((binding) => {
          const targetName = binding.targetObj.name || "Unknown";
          console.log(`  ${id}: ${targetName}.${binding.targetProp} \u2190 ${binding.expression}`);
          console.log(`    Dependencies:`, binding.dependencies);
        });
      });
      console.log("[ReactiveRuntime] Registered Objects (Names):", Array.from(this.objectsByName.keys()));
      console.log("[ReactiveRuntime] Registered Objects (IDs):", Array.from(this.objectsById.keys()));
      console.log("[ReactiveRuntime] Variables:", Array.from(this.variables.keys()));
      this.watcher.debug();
    }
    /**
     * Clears all bindings and watchers
     */
    clear() {
      this.bindings.clear();
      this.objectsById.clear();
      this.objectsByName.clear();
      this.variables.clear();
      this.watcher.clear();
    }
    /**
     * Gets statistics
     */
    getStats() {
      return {
        bindingCount: this.bindings.size,
        objectCount: this.objectsById.size,
        variableCount: this.variables.size,
        watcherCount: this.watcher.getTotalWatchers()
      };
    }
    /**
     * Returns all registered objects (proxies)
     */
    getObjects() {
      return Array.from(this.objectsById.values());
    }
  };

  // src/runtime/PropertyHelper.ts
  var PropertyHelper = class {
    /**
     * Reads a property value using a dot-path (e.g., "style.backgroundColor")
     */
    static getPropertyValue(obj, propPath) {
      if (!obj || !propPath) return void 0;
      const parts = propPath.split(".");
      let current = obj;
      for (const part of parts) {
        if (current === void 0 || current === null) return void 0;
        current = current[part];
      }
      return current;
    }
    /**
     * Sets a property value using a dot-path
     */
    static setPropertyValue(obj, propPath, value) {
      if (!obj || !propPath) return;
      const parts = propPath.split(".");
      if (parts.length === 1) {
        obj[parts[0]] = value;
      } else {
        let current = obj;
        for (let i = 0; i < parts.length - 1; i++) {
          const part = parts[i];
          if (!current[part]) {
            current[part] = {};
          }
          current = current[part];
        }
        current[parts[parts.length - 1]] = value;
      }
    }
    /**
     * Interpolates variables in a string template (e.g., "Score: ${score}" or "Value: ${Object.property}")
     */
    static interpolate(template, vars, objects) {
      if (typeof template !== "string" || !template.includes("${")) {
        return template;
      }
      return template.replace(/\$\{([^}]+)\}/g, (_, path) => {
        if (vars[path] !== void 0) return String(vars[path]);
        if (objects && path.includes(".")) {
          const [objName, ...propParts] = path.split(".");
          const propPath = propParts.join(".");
          const obj = objects.find((o) => o.name === objName || o.id === objName);
          if (obj) {
            const val = this.getPropertyValue(obj, propPath);
            if (val !== void 0) return String(val);
          }
        }
        return "";
      });
    }
  };

  // src/services/ServiceRegistry.ts
  var ServiceRegistryClass = class {
    constructor() {
      __publicField(this, "services", /* @__PURE__ */ new Map());
    }
    /**
     * Register a service with the registry
     * @param name Unique name for the service (e.g., 'RemoteGameManager')
     * @param instance The service instance
     * @param description Optional description for the service
     */
    register(name, instance, description) {
      const methods = [];
      let proto = Object.getPrototypeOf(instance);
      while (proto && proto !== Object.prototype) {
        const methodNames = Object.getOwnPropertyNames(proto).filter((prop) => {
          if (prop === "constructor") return false;
          try {
            return typeof instance[prop] === "function";
          } catch {
            return false;
          }
        });
        for (const methodName of methodNames) {
          if (!methods.find((m) => m.name === methodName)) {
            methods.push({ name: methodName });
          }
        }
        proto = Object.getPrototypeOf(proto);
      }
      this.services.set(name, {
        name,
        instance,
        methods,
        description
      });
      console.log(`[ServiceRegistry] Registered service: ${name} with methods:`, methods.map((m) => m.name));
    }
    /**
     * Unregister a service
     */
    unregister(name) {
      this.services.delete(name);
      console.log(`[ServiceRegistry] Unregistered service: ${name}`);
    }
    /**
     * Get a service by name
     */
    get(name) {
      return this.services.get(name)?.instance;
    }
    /**
     * Check if a service is registered
     */
    has(name) {
      return this.services.has(name);
    }
    /**
     * Call a method on a service
     * @param serviceName Name of the registered service
     * @param methodName Name of the method to call
     * @param params Optional parameters to pass to the method
     * @returns Promise with the method's return value
     */
    async call(serviceName, methodName, params) {
      const serviceInfo = this.services.get(serviceName);
      if (!serviceInfo) {
        throw new Error(`Service '${serviceName}' not found in registry`);
      }
      const method = serviceInfo.instance[methodName];
      if (typeof method !== "function") {
        throw new Error(`Method '${methodName}' not found on service '${serviceName}'`);
      }
      console.log(`[ServiceRegistry] Calling ${serviceName}.${methodName}(`, params, ")");
      try {
        const result = await method.apply(serviceInfo.instance, params || []);
        console.log(`[ServiceRegistry] ${serviceName}.${methodName} returned:`, result);
        return result;
      } catch (error) {
        console.error(`[ServiceRegistry] ${serviceName}.${methodName} threw:`, error);
        throw error;
      }
    }
    /**
     * List all registered service names (for Inspector dropdowns)
     */
    listServices() {
      return Array.from(this.services.keys());
    }
    /**
     * List all methods of a service (for Inspector dropdowns)
     */
    listMethods(serviceName) {
      return this.services.get(serviceName)?.methods || [];
    }
    /**
     * Get service info
     */
    getServiceInfo(serviceName) {
      return this.services.get(serviceName);
    }
    /**
     * Get all services info (for debugging)
     */
    getAllServices() {
      return Array.from(this.services.values());
    }
  };
  var serviceRegistry = new ServiceRegistryClass();

  // src/services/DebugLogService.ts
  var _DebugLogService = class _DebugLogService {
    constructor() {
      __publicField(this, "logs", []);
      __publicField(this, "listeners", []);
      __publicField(this, "maxLogs", 1e3);
      __publicField(this, "counter", 0);
      __publicField(this, "enabled", false);
    }
    setEnabled(enabled) {
      console.log(`[DebugLogService] setEnabled(${enabled})`);
      this.enabled = enabled;
    }
    isEnabled() {
      return this.enabled;
    }
    static getInstance() {
      if (!_DebugLogService.instance) {
        _DebugLogService.instance = new _DebugLogService();
      }
      return _DebugLogService.instance;
    }
    log(type, message, options = {}) {
      if (!this.enabled) return "";
      const id = `log-${Date.now()}-${this.counter++}`;
      const entry = {
        id,
        type,
        message,
        timestamp: Date.now(),
        parentId: options.parentId,
        children: [],
        isExpanded: true,
        data: options.data,
        objectName: options.objectName,
        eventName: options.eventName
      };
      if (options.parentId) {
        const parent = this.findEntry(this.logs, options.parentId);
        if (parent) {
          parent.children.push(entry);
          this.notify();
          return id;
        }
      }
      this.logs.push(entry);
      if (this.logs.length > this.maxLogs) {
        this.logs.shift();
      }
      this.notify();
      return id;
    }
    findEntry(list, id) {
      for (const entry of list) {
        if (entry.id === id) return entry;
        const found = this.findEntry(entry.children, id);
        if (found) return found;
      }
      return void 0;
    }
    getLogs() {
      return [...this.logs];
    }
    clear() {
      this.logs = [];
      this.notify();
    }
    subscribe(listener) {
      this.listeners.push(listener);
      listener(this.logs);
      return () => {
        this.listeners = this.listeners.filter((l) => l !== listener);
      };
    }
    notify() {
      this.listeners.forEach((l) => l(this.logs));
    }
    toggleExpand(id) {
      const entry = this.findEntry(this.logs, id);
      if (entry) {
        entry.isExpanded = !entry.isExpanded;
        this.notify();
      }
    }
    getUniqueObjects() {
      const objects = /* @__PURE__ */ new Set();
      const traverse = (list) => {
        list.forEach((e) => {
          if (e.objectName) objects.add(e.objectName);
          traverse(e.children);
        });
      };
      traverse(this.logs);
      return Array.from(objects).sort();
    }
    getUniqueEventsForObject(objectName) {
      const events = /* @__PURE__ */ new Set();
      const traverse = (list) => {
        list.forEach((e) => {
          if (e.objectName === objectName && e.eventName) events.add(e.eventName);
          traverse(e.children);
        });
      };
      traverse(this.logs);
      return Array.from(events).sort();
    }
  };
  __publicField(_DebugLogService, "instance");
  var DebugLogService = _DebugLogService;

  // src/runtime/ActionExecutor.ts
  init_AnimationManager();
  var ActionExecutor = class {
    constructor(objects, multiplayerManager, onNavigate) {
      this.objects = objects;
      this.multiplayerManager = multiplayerManager;
      this.onNavigate = onNavigate;
    }
    /**
     * Executes a single action
     * @param action The action definition (from project JSON)
     * @param vars Local task variables context
     * @param globalVars Persistent global variables context
     * @param contextObj The object that triggered the event (for $eventSource resolution)
     */
    execute(action, vars, globalVars = {}, contextObj, parentId) {
      console.log(`[ActionExecutor] execute start: type=${action?.type} name=${action?.name}`);
      if (!action || !action.type) return;
      const actionName = action.name || this.getDescriptiveName(action);
      const actionLogId = DebugLogService.getInstance().log("Action", actionName, {
        parentId,
        data: action
      });
      console.log(`%c[Action] Executing: type="${action.type}"`, "color: #4caf50", action);
      console.log(`[ActionExecutor] About to switch on type: ${action.type}`);
      switch (action.type) {
        case "variable":
          this.handleVariableAction(action, vars, globalVars, contextObj, actionLogId);
          break;
        case "set_variable":
          this.handleSetVariableAction(action, vars, globalVars);
          break;
        case "property":
          this.handlePropertyAction(action, vars, contextObj);
          break;
        case "increment":
          this.handleNumericAction(action, vars, "increment", contextObj);
          break;
        case "negate":
          this.handleNumericAction(action, vars, "negate", contextObj);
          break;
        case "navigate":
          this.handleNavigateAction(action, vars);
          break;
        case "create_room":
          this.handleCreateRoomAction(action, vars);
          break;
        case "join_room":
          this.handleJoinRoomAction(action, vars);
          break;
        case "send_multiplayer_sync":
          this.handleSendSyncAction(action, vars, contextObj);
          break;
        case "smooth_sync":
          this.handleSmoothSyncAction(action, vars, contextObj);
          break;
        case "service":
          this.handleServiceAction(action, vars, globalVars);
          break;
        case "calculate":
          this.handleCalculateAction(action, vars, globalVars, actionLogId);
          break;
        case "log":
          this.handleLogAction(action, vars);
          break;
        case "http":
          this.handleHttpAction(action, vars, globalVars);
          break;
        case "create_object":
          this.handleCreateObjectAction(action, vars);
          break;
        case "send_remote_event":
          this.handleSendRemoteEventAction(action, vars, contextObj);
          break;
        case "call_method":
          this.handleCallMethodAction(action, vars, contextObj);
          break;
        case "animate":
          this.handleAnimateAction(action, vars, contextObj);
          break;
        case "move_to":
          this.handleMoveToAction(action, vars, contextObj);
          break;
        default:
          console.warn(`[ActionExecutor] Unknown action type: ${action.type}`);
      }
    }
    resolveTarget(targetName, vars, contextObj) {
      if (!targetName) return null;
      if ((targetName === "$eventSource" || targetName === "self" || targetName === "$self") && contextObj) {
        return contextObj;
      }
      if ((targetName === "other" || targetName === "$other") && vars.otherSprite) {
        return vars.otherSprite;
      }
      let actualName = targetName;
      if (targetName.startsWith("${") && targetName.endsWith("}")) {
        const varName = targetName.substring(2, targetName.length - 1);
        const varVal = vars[varName];
        if (varVal && typeof varVal === "object" && varVal.id) return varVal;
        if (varVal) actualName = String(varVal);
      }
      let obj = this.objects.find((o) => o.name === actualName);
      if (!obj) {
        obj = this.objects.find((o) => o.name?.toLowerCase() === actualName.toLowerCase());
      }
      if (!obj) {
        obj = this.objects.find((o) => o.id === actualName);
      }
      return obj;
    }
    handleVariableAction(action, vars, globalVars, contextObj, parentId) {
      console.log(`[ActionExecutor] handleVariableAction: source=${action.source} var=${action.variableName} prop=${action.sourceProperty}`);
      const srcObj = this.resolveTarget(action.source, vars, contextObj);
      console.log(`%c[Variable] source="${action.source}" -> resolved=${srcObj?.name || "NULL"}`, "color: #9c27b0");
      if (srcObj && action.variableName && action.sourceProperty) {
        console.log(`[ActionExecutor] Getting property ${action.sourceProperty} from ${srcObj.name}`);
        const val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
        console.log(`[ActionExecutor] Value is: ${val}`);
        vars[action.variableName] = val;
        globalVars[action.variableName] = val;
        DebugLogService.getInstance().log("Variable", `${action.variableName} = ${srcObj.name}.${action.sourceProperty} = ${val}`, {
          parentId,
          objectName: srcObj.name
        });
        console.log(`%c[Variable] ${action.variableName} = ${srcObj.name}.${action.sourceProperty} = ${val}`, "color: #9c27b0");
      } else {
        console.warn(`[ActionExecutor] Variable action failed: srcObj=${!!srcObj} varName=${action.variableName} srcProp=${action.sourceProperty}`);
      }
    }
    handleSetVariableAction(action, vars, globalVars) {
      if (action.variable && action.value !== void 0) {
        vars[action.variable] = action.value;
        globalVars[action.variable] = action.value;
      }
    }
    handlePropertyAction(action, vars, contextObj) {
      const isSyncActive = action.hostOnly === true;
      if (action.changes) {
        Object.keys(action.changes).forEach((prop) => {
          const rawValue = action.changes[prop];
          let finalValue;
          if (typeof rawValue === "boolean") {
            finalValue = rawValue;
          } else if (typeof rawValue === "number") {
            finalValue = rawValue;
          } else {
            const value = PropertyHelper.interpolate(String(rawValue), vars, this.objects);
            if (value !== "" && !isNaN(Number(value))) {
              finalValue = Number(value);
            } else if (value === "true") {
              finalValue = true;
            } else if (value === "false") {
              finalValue = false;
            } else {
              finalValue = value;
            }
          }
          this.applyChange(action.target, prop, finalValue, vars, contextObj, isSyncActive);
        });
      }
    }
    handleNumericAction(action, vars, mode, contextObj) {
      const isSyncActive = action.hostOnly === true;
      if (action.changes) {
        Object.keys(action.changes).forEach((prop) => {
          const targetObj = this.resolveTarget(action.target, vars, contextObj);
          if (targetObj) {
            const currentValue = Number(PropertyHelper.getPropertyValue(targetObj, prop)) || 0;
            let newValue;
            if (mode === "increment") {
              const rawIncrementValue = action.changes[prop];
              const interpolatedValue = PropertyHelper.interpolate(String(rawIncrementValue), vars, this.objects);
              const incrementValue = Number(interpolatedValue) || 0;
              newValue = currentValue + incrementValue;
            } else {
              newValue = currentValue * -1;
              console.log(`[ActionExecutor] Negating ${action.target}.${prop}: ${currentValue} -> ${newValue}`);
            }
            this.applyChange(action.target, prop, newValue, vars, contextObj, isSyncActive);
          }
        });
      }
    }
    handleNavigateAction(action, vars) {
      let targetGame = PropertyHelper.interpolate(action.target, vars, this.objects);
      if (targetGame && this.onNavigate) {
        this.onNavigate(targetGame, action.params);
      }
    }
    handleLogAction(action, vars) {
      const message = PropertyHelper.interpolate(action.message || "", vars, this.objects);
      if (action.showToast) {
        const toast = this.objects.find((o) => o.className === "TToast");
        if (toast) {
          if (typeof toast.show === "function") {
            toast.show(message, "info");
          } else {
            toast.text = message;
          }
        }
      }
    }
    handleCreateRoomAction(action, vars) {
      if (this.multiplayerManager) {
        let gameName = PropertyHelper.interpolate(action.game, vars, this.objects);
        console.log(`[ActionExecutor] Creating room for game: ${gameName}`);
        this.multiplayerManager.createRoom(gameName);
      } else {
        console.error(`[ActionExecutor] Cannot create room: MultiplayerManager not available!`);
      }
    }
    handleJoinRoomAction(action, vars) {
      if (this.multiplayerManager) {
        const srcObj = this.objects.find((o) => o.name === action.source);
        let code = "";
        if (srcObj) {
          code = PropertyHelper.getPropertyValue(srcObj, "text");
        } else if (action.params && action.params.code) {
          code = PropertyHelper.interpolate(String(action.params.code), vars, this.objects);
        }
        if (code && String(code).length >= 4) {
          this.multiplayerManager.joinRoom(code);
        }
      }
    }
    handleSendSyncAction(action, vars, contextObj) {
      const target = this.resolveTarget(action.target, vars, contextObj);
      if (target && this.multiplayerManager) {
        const state = {
          x: target.x,
          y: target.y,
          vx: target.velocityX,
          vy: target.velocityY,
          text: target.text,
          value: target.value,
          spritesMoving: target.spritesMoving
          // Include GameState flag
        };
        if (target.name === "BallSprite") {
          console.log(`[MULTIPLAYER] Sending Sync for Ball: x=${target.x.toFixed(2)}, y=${target.y.toFixed(2)}, vx=${target.velocityX.toFixed(2)}`);
        }
        this.multiplayerManager.sendStateSync(target.id, state);
      } else if (!this.multiplayerManager) {
      }
    }
    handleSendRemoteEventAction(action, vars, _contextObj) {
      const objectId = PropertyHelper.interpolate(action.target, vars, this.objects);
      const eventName = action.event || "onClick";
      const params = action.params;
      if (objectId && this.multiplayerManager) {
        console.log(`[ActionExecutor] Sending remote event: ${objectId}.${eventName}`);
        this.multiplayerManager.triggerRemoteEvent(objectId, eventName, params);
      } else if (!this.multiplayerManager) {
      }
    }
    handleSmoothSyncAction(action, vars, contextObj) {
      const target = this.resolveTarget(action.target, vars, contextObj);
      if (target) {
        if (vars.targetX !== void 0) target.x = Number(vars.targetX);
        if (vars.targetY !== void 0) target.y = Number(vars.targetY);
        if (vars.targetVX !== void 0) target.velocityX = Number(vars.targetVX);
        if (vars.targetVY !== void 0) target.velocityY = Number(vars.targetVY);
        if (vars.targetText !== void 0) target.text = vars.targetText;
      }
    }
    applyChange(targetName, propPath, value, vars, contextObj, isSyncActive = false) {
      const targetObj = this.resolveTarget(targetName, vars, contextObj);
      if (targetObj) {
        PropertyHelper.setPropertyValue(targetObj, propPath, value);
        if (targetObj.name === "BallSprite" && (propPath === "x" || propPath === "y")) {
          console.log(`[ACTION] Local Ball Move: ${propPath} = ${value}`);
        }
        if (isSyncActive && this.multiplayerManager) {
          const motionProps = ["x", "y", "velocityX", "velocityY", "spritesMoving", "value"];
          if (motionProps.includes(propPath)) {
            this.handleSendSyncAction({ target: targetName }, vars, contextObj);
          }
        }
      } else {
        console.warn(`[ActionExecutor] Target not found: ${targetName}`);
      }
    }
    async handleServiceAction(action, vars, globalVars) {
      const serviceName = action.service;
      const methodName = action.method;
      const resultVarName = action.resultVariable;
      if (!serviceName || !methodName) {
        console.warn("[ActionExecutor] Service action missing service or method");
        return;
      }
      if (!serviceRegistry.has(serviceName)) {
        console.error(`[ActionExecutor] Service not found: ${serviceName}`);
        return;
      }
      const params = [];
      if (action.serviceParams && typeof action.serviceParams === "object") {
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
    handleCalculateAction(action, vars, globalVars, parentId) {
      let result = 0;
      const allVars = { ...globalVars, ...vars };
      console.log(`[ActionExecutor] handleCalculateAction: formula=${action.formula} resultVar=${action.resultVariable}`, { allVars });
      if (action.formula) {
        try {
          console.log(`[ActionExecutor] Evaluating formula: ${action.formula}`);
          result = ExpressionParser.evaluate(action.formula, allVars);
          console.log(`[ActionExecutor] Formula result: ${result}`);
        } catch (e) {
          console.error("[ActionExecutor] Failed to evaluate formula:", action.formula, e);
        }
      } else if (action.calcSteps && Array.isArray(action.calcSteps)) {
        console.log(`[ActionExecutor] Falling back to calcSteps`);
        action.calcSteps.forEach((step, index) => {
          let value = 0;
          if (step.operandType === "variable") {
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
              case "+":
                result += value;
                break;
              case "-":
                result -= value;
                break;
              case "*":
                result *= value;
                break;
              case "/":
                result = value !== 0 ? result / value : 0;
                break;
              case "%":
                result = value !== 0 ? result % value : 0;
                break;
              default:
                result += value;
                break;
            }
          }
        });
      } else {
        console.warn("[ActionExecutor] Calculate action missing formula or calcSteps");
        return;
      }
      if (action.resultVariable) {
        vars[action.resultVariable] = result;
        globalVars[action.resultVariable] = result;
        console.log(`  %c[Calculate] ${action.resultVariable} = ${result}`, "color: #9c27b0; font-style: italic;");
        DebugLogService.getInstance().log("Variable", `${action.resultVariable} = ${action.formula || "formula"} = ${result}`, {
          parentId
        });
      }
      const isSyncActive = action.hostOnly === true;
      if (action.target && action.changes) {
        Object.keys(action.changes).forEach((prop) => {
          const expression = action.changes[prop];
          try {
            const value = ExpressionParser.evaluate(expression, { ...globalVars, ...vars });
            this.applyChange(action.target, prop, value, vars, void 0, isSyncActive);
          } catch (e) {
            console.error(`[ActionExecutor] Calculate change failed for ${prop}:`, e);
          }
        });
      }
    }
    async handleHttpAction(action, vars, globalVars) {
      const url = PropertyHelper.interpolate(action.url, { ...vars, ...globalVars }, this.objects);
      const method = action.method || "GET";
      const resultVar = action.resultVariable || "httpResult";
      try {
        console.log(`[ActionExecutor] HTTP: ${method} ${url}`);
        const resp = await fetch(url, { method });
        if (resp.ok) {
          const data = await resp.json();
          vars[resultVar] = data;
          globalVars[resultVar] = data;
          console.log(`[ActionExecutor] HTTP Success, stored in ${resultVar}`, data);
        }
      } catch (e) {
        console.error("[ActionExecutor] HTTP Action failed:", e);
      }
    }
    handleCreateObjectAction(action, vars) {
      if (!action.objectData) return;
      const rawData = JSON.stringify(action.objectData);
      const interpolatedData = PropertyHelper.interpolate(rawData, vars, this.objects);
      const config = JSON.parse(interpolatedData);
      if (!config.id) config.id = crypto.randomUUID();
      this.objects.push(config);
      console.log(`[ActionExecutor] Created dynamic object: ${config.name} (${config.className})`);
    }
    handleCallMethodAction(action, vars, contextObj) {
      const target = this.resolveTarget(action.target, vars, contextObj);
      if (!target) {
        console.warn(`[ActionExecutor] call_method: Target not found: ${action.target}`);
        return;
      }
      const methodName = action.method;
      if (!methodName || typeof target[methodName] !== "function") {
        console.warn(`[ActionExecutor] call_method: Method '${methodName}' not found on ${target.name}`);
        return;
      }
      let params = [];
      if (action.params) {
        if (Array.isArray(action.params)) {
          params = action.params.map((p) => {
            if (typeof p === "string") {
              return PropertyHelper.interpolate(p, vars, this.objects);
            }
            return p;
          });
        } else if (typeof action.params === "string") {
          params = [PropertyHelper.interpolate(action.params, vars, this.objects)];
        }
      }
      console.log(`[ActionExecutor] Calling ${target.name || action.target}.${methodName}(${params.join(", ")})`);
      if (typeof target[methodName] === "function") {
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
    handleAnimateAction(action, vars, contextObj) {
      const target = this.resolveTarget(action.target, vars, contextObj);
      if (!target) {
        console.warn(`[ActionExecutor] animate: Target not found: ${action.target}`);
        return;
      }
      const property = action.property || "x";
      const toValue = typeof action.to === "string" ? Number(PropertyHelper.interpolate(action.to, vars, this.objects)) : Number(action.to);
      const duration = Number(action.duration) || 500;
      const easing = action.easing || "easeOut";
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
    handleMoveToAction(action, vars, contextObj) {
      const target = this.resolveTarget(action.target, vars, contextObj);
      if (!target) {
        console.warn(`[ActionExecutor] move_to: Target not found: ${action.target}`);
        return;
      }
      const toX = typeof action.x === "string" ? Number(PropertyHelper.interpolate(action.x, vars, this.objects)) : Number(action.x);
      const toY = typeof action.y === "string" ? Number(PropertyHelper.interpolate(action.y, vars, this.objects)) : Number(action.y);
      const duration = Number(action.duration) || 500;
      const easing = action.easing || "easeOut";
      console.log(`[ActionExecutor] Moving ${target.name} to (${toX}, ${toY}) over ${duration}ms (${easing})`);
      if (typeof target.moveTo === "function") {
        target.moveTo(toX, toY, duration, easing);
      } else {
        const manager = AnimationManager.getInstance();
        manager.addTween(target, "x", toX, duration, easing);
        manager.addTween(target, "y", toY, duration, easing);
      }
    }
    getDescriptiveName(action) {
      switch (action.type) {
        case "variable":
          return `Set ${action.variableName || "var"}`;
        case "calculate":
          return `Calc ${action.resultVariable || "result"}`;
        case "property": {
          const keys = action.changes ? Object.keys(action.changes) : [];
          const first = keys.length > 0 ? keys[0] : "";
          return `Set ${action.target || "target"}.${first}${keys.length > 1 ? "..." : ""}`;
        }
        case "service":
          return `Call ${action.service}.${action.method}`;
        case "call_method":
          return `Method ${action.method} on ${action.target}`;
        case "increment":
          return `Inc ${action.variableName}`;
        case "negate":
          return `Toggle ${action.variableName}`;
        case "animate":
          return `Animate ${action.target}`;
        case "navigate":
          return `To page ${action.pageId}`;
        default:
          return `Action: ${action.type || "unknown"}`;
      }
    }
  };

  // src/services/LibraryService.ts
  var LibraryService = class {
    constructor() {
      __publicField(this, "libraryTasks", []);
      __publicField(this, "isLoaded", false);
    }
    async loadLibrary() {
      if (this.isLoaded) return;
      try {
        const response = await fetch("/library.json");
        const data = await response.json();
        this.libraryTasks = data.tasks || [];
        this.isLoaded = true;
        console.log(`[LibraryService] Loaded ${this.libraryTasks.length} global tasks.`);
      } catch (err) {
        console.error("[LibraryService] Failed to load library.json:", err);
      }
    }
    getTasks() {
      return this.libraryTasks;
    }
    getTask(name) {
      return this.libraryTasks.find((t) => t.name === name);
    }
  };
  var libraryService = new LibraryService();

  // src/runtime/TaskExecutor.ts
  var _TaskExecutor = class _TaskExecutor {
    // Prevent infinite loops
    constructor(project, actions, actionExecutor, flowCharts, multiplayerManager) {
      this.project = project;
      this.actions = actions;
      this.actionExecutor = actionExecutor;
      this.flowCharts = flowCharts;
      this.multiplayerManager = multiplayerManager;
    }
    execute(taskName, vars, globalVars, contextObj, depth = 0, parentId, params, isRemoteExecution = false) {
      if (depth >= _TaskExecutor.MAX_DEPTH) {
        console.error(`[TaskExecutor] Max recursion depth exceeded: ${taskName} `);
        return;
      }
      if (params) {
        vars = { ...vars, ...params };
      }
      let task = this.project.tasks.find((t) => t.name === taskName);
      if (!task) {
        task = libraryService.getTask(taskName);
      }
      if (!task) {
        console.warn(`[TaskExecutor] Task definition not found: ${taskName} `);
        return;
      }
      const triggerMode = task.triggerMode || "local-sync";
      const isMultiplayer = this.multiplayerManager?.isConnected === true;
      const isHost = this.multiplayerManager?.isHost === true;
      if (isMultiplayer && !isRemoteExecution) {
        if (triggerMode === "broadcast" && !isHost) {
          console.log(`[TaskExecutor] Broadcasting task "${taskName}" to host (not executing locally)`);
          this.multiplayerManager.sendTriggerTask(taskName, params);
          return;
        }
      }
      if (isMultiplayer && isRemoteExecution) {
        if (triggerMode === "broadcast" && !isHost) {
          console.log(`[TaskExecutor] Skipping remote broadcast task "${taskName}" - only host executes`);
          return;
        }
      }
      if (task.params && Array.isArray(task.params)) {
        const paramDefaults = {};
        task.params.forEach((p) => {
          if (p.name && p.default !== void 0 && vars[p.name] === void 0) {
            paramDefaults[p.name] = p.default;
          }
        });
        if (Object.keys(paramDefaults).length > 0) {
          console.log(`[TaskExecutor] Applied param defaults for "${taskName}":`, paramDefaults);
          vars = { ...vars, ...paramDefaults };
        }
      }
      const taskLogId = DebugLogService.getInstance().log("Task", `START: ${taskName} `, {
        parentId,
        objectName: contextObj?.name
      });
      const flowChart = this.flowCharts?.[taskName];
      const hasFlowChart = flowChart && flowChart.elements && flowChart.elements.length > 0;
      const actionSequence = task.actionSequence || [];
      const hasConditionsInSequence = actionSequence.some((item) => item.type === "condition");
      const hasConditionsInFlowChart = hasFlowChart && flowChart.elements.some(
        (el) => el.type === "Condition" || el.type === "condition"
      );
      if (hasFlowChart && hasConditionsInFlowChart && !hasConditionsInSequence) {
        console.log(`[Task] START: ${taskName} (using flowChart with ${flowChart.elements.length} nodes)`);
        this.executeFlowChart(taskName, flowChart, vars, globalVars, contextObj, depth, taskLogId);
      } else {
        console.log(`[Task] START: ${taskName} (seq: ${actionSequence.length})`);
        actionSequence.forEach((seqItem, index) => {
          try {
            this.executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, taskLogId);
          } catch (err) {
            console.error(`[TaskExecutor] Error in item ${index} of task ${taskName}: `, err);
            DebugLogService.getInstance().log("Event", `ERROR executing task ${taskName} item ${index}: ${err}`, { parentId: taskLogId });
          }
        });
      }
      if (isMultiplayer && triggerMode === "local-sync" && !isRemoteExecution) {
        console.log(`[TaskExecutor] Syncing task "${taskName}" to other player`);
        this.multiplayerManager.sendSyncTask(taskName, params);
      }
    }
    /**
     * Execute a task's flowChart directly at runtime
     * This is a fallback for when actionSequence wasn't properly synced
     */
    executeFlowChart(taskName, flowChart, vars, globalVars, contextObj, depth, parentId) {
      const { elements, connections } = flowChart;
      const visited = /* @__PURE__ */ new Set();
      const startNode = elements.find(
        (e) => e.type === "Task" && e.properties?.name === taskName || e.type === "Start"
      );
      if (!startNode) {
        console.warn(`[TaskExecutor] No start node found in flowChart for task: ${taskName} `);
        return;
      }
      const executeNode = (node) => {
        if (!node || visited.has(node.id)) return;
        visited.add(node.id);
        const nodeType = node.type;
        const name = node.properties?.name || node.data?.name || node.data?.actionName;
        if (nodeType === "Task" && name === taskName) {
          const outgoing = connections.filter((c) => c.startTargetId === node.id);
          outgoing.forEach((conn) => {
            const nextNode = elements.find((e) => e.id === conn.endTargetId);
            if (nextNode) executeNode(nextNode);
          });
          return;
        }
        if (nodeType === "Action" || nodeType === "action") {
          const action = this.resolveAction({ type: "action", name }) || node.data;
          if (action) {
            this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
          }
          const outgoing = connections.find(
            (c) => c.startTargetId === node.id && !c.data?.startAnchorType && !c.data?.anchorType
          );
          if (outgoing) {
            const nextNode = elements.find((e) => e.id === outgoing.endTargetId);
            if (nextNode) executeNode(nextNode);
          }
          return;
        }
        if (nodeType === "Task" || nodeType === "task") {
          this.execute(name, vars, globalVars, contextObj, depth + 1, parentId, node.data?.params);
          const outgoing = connections.find(
            (c) => c.startTargetId === node.id && !c.data?.startAnchorType && !c.data?.anchorType
          );
          if (outgoing) {
            const nextNode = elements.find((e) => e.id === outgoing.endTargetId);
            if (nextNode) executeNode(nextNode);
          }
          return;
        }
        if (nodeType === "Condition" || nodeType === "condition") {
          const condition = node.data?.condition;
          if (!condition) {
            console.warn(`[TaskExecutor] Condition node without condition data: ${node.id} `);
            return;
          }
          const result = this.evaluateCondition(condition, vars, globalVars);
          console.log(`[TaskExecutor] Condition ${condition.variable} ${condition.operator || "=="} ${condition.value} => ${result} `);
          const trueConn = connections.find(
            (c) => c.startTargetId === node.id && (c.data?.startAnchorType === "true" || c.data?.anchorType === "true")
          );
          const falseConn = connections.find(
            (c) => c.startTargetId === node.id && (c.data?.startAnchorType === "false" || c.data?.anchorType === "false")
          );
          if (result && trueConn) {
            const trueNode = elements.find((e) => e.id === trueConn.endTargetId);
            if (trueNode) executeNode(trueNode);
          } else if (!result && falseConn) {
            const falseNode = elements.find((e) => e.id === falseConn.endTargetId);
            if (falseNode) executeNode(falseNode);
          }
          return;
        }
      };
      const initialOutgoing = connections.filter((c) => c.startTargetId === startNode.id);
      initialOutgoing.forEach((conn) => {
        const firstNode = elements.find((e) => e.id === conn.endTargetId);
        if (firstNode) executeNode(firstNode);
      });
    }
    executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, parentId) {
      const item = typeof seqItem === "string" ? { type: "action", name: seqItem } : seqItem;
      console.log(`[TaskExecutor] Processing item: type = "${item.type}" name = "${item.name || "N/A"}" condition = "${item.condition?.variable || "none"}"`);
      const condition = item.itemCondition || (typeof item.condition === "string" ? item.condition : null);
      if (condition && !this.evaluateCondition(condition, vars, globalVars)) {
        console.log(`[TaskExecutor] Item condition FALSE, skipping: ${condition} `);
        return;
      }
      switch (item.type) {
        case "condition":
          this.handleCondition(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "task":
          this.execute(item.name, vars, globalVars, contextObj, depth + 1, parentId, item.params);
          break;
        case "action":
          const action = this.resolveAction(item);
          if (action) {
            this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
          } else {
            console.warn(`[TaskExecutor] Action definition not found: ${item.name} `);
          }
          break;
        case "while":
          this.handleWhile(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "for":
          this.handleFor(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "foreach":
          this.handleForeach(item, vars, globalVars, contextObj, depth, parentId);
          break;
        default:
          if (item.type) {
            this.actionExecutor.execute(item, vars, globalVars, contextObj, parentId);
          }
      }
    }
    executeBody(body, vars, globalVars, contextObj, depth, parentId) {
      if (!body || !Array.isArray(body)) return;
      for (const item of body) {
        this.executeSequenceItem(item, vars, globalVars, contextObj, depth, parentId);
      }
    }
    resolveAction(item) {
      if (typeof item === "string") {
        return this.actions.find((a) => a.name === item);
      }
      if (item.type === "action" && item.name) {
        return this.actions.find((a) => a.name === item.name);
      }
      return item;
    }
    evaluateCondition(condition, vars, globalVars) {
      if (!condition) return false;
      if (typeof condition === "string") {
        const parts = condition.split(/\s*(==|!=|>|<|>=|<=)\s*/);
        if (parts.length === 3) {
          const left = parts[0].trim();
          const operator2 = parts[1];
          const right = parts[2].trim();
          const leftValue = vars[left] !== void 0 ? vars[left] : globalVars[left];
          const rightValue = right.startsWith("'") || right.startsWith('"') ? right.substring(1, right.length - 1) : isNaN(Number(right)) ? vars[right] !== void 0 ? vars[right] : globalVars[right] : Number(right);
          switch (operator2) {
            case "==":
              return String(leftValue) === String(rightValue);
            case "!=":
              return String(leftValue) !== String(rightValue);
            case ">":
              return Number(leftValue) > Number(rightValue);
            case "<":
              return Number(leftValue) < Number(rightValue);
            case ">=":
              return Number(leftValue) >= Number(rightValue);
            case "<=":
              return Number(leftValue) <= Number(rightValue);
          }
        }
        return !!vars[condition] || !!globalVars[condition];
      }
      const varName = condition.variable;
      const varValue = vars[varName] !== void 0 ? vars[varName] : globalVars[varName];
      const compareValue = condition.value;
      const operator = condition.operator || "==";
      switch (operator) {
        case "==":
          return String(varValue) === String(compareValue);
        case "!=":
          return String(varValue) !== String(compareValue);
        case ">":
          return Number(varValue) > Number(compareValue);
        case "<":
          return Number(varValue) < Number(compareValue);
        case ">=":
          return Number(varValue) >= Number(compareValue);
        case "<=":
          return Number(varValue) <= Number(compareValue);
        default:
          return String(varValue) === String(compareValue);
      }
    }
    resolveValue(value, vars, globalVars) {
      if (typeof value === "number") return value;
      if (typeof value === "string") {
        const match = value.match(/^\$\{(.+)\}$/);
        if (match) {
          const varName = match[1];
          const val = vars[varName] !== void 0 ? vars[varName] : globalVars[varName];
          return Number(val) || 0;
        }
        return Number(value) || 0;
      }
      return 0;
    }
    handleCondition(item, vars, globalVars, contextObj, depth, parentId) {
      if (!item.condition) return;
      const varName = item.condition.variable;
      const varValue = vars[varName] !== void 0 ? vars[varName] : globalVars[varName];
      const compareValue = item.condition.value;
      const operator = item.condition.operator || "==";
      const result = this.evaluateCondition(item.condition, vars, globalVars);
      const conditionExpr = `${varName} ${operator} "${compareValue}"`;
      DebugLogService.getInstance().log(
        "Condition",
        `${conditionExpr} => ${result ? "TRUE" : "FALSE"} (${varName}="${varValue}")`,
        {
          parentId,
          objectName: contextObj?.name,
          data: { variable: varName, value: varValue, expected: compareValue, result }
        }
      );
      console.log(`[TaskExecutor] Condition: ${varName}="${varValue}" == "${compareValue}" => ${result}`);
      if (result) {
        if (item.thenAction) {
          const action = this.resolveAction(item.thenAction);
          console.log(`[TaskExecutor] Condition TRUE, executing thenAction: ${item.thenAction} `);
          if (action) this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
        }
        if (item.thenTask) {
          console.log(`[TaskExecutor] Condition TRUE, executing thenTask: ${item.thenTask} `);
          this.execute(item.thenTask, vars, globalVars, contextObj, depth + 1, parentId);
        }
        if (item.body) this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      } else {
        if (item.elseAction) {
          const action = this.resolveAction(item.elseAction);
          if (action) this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
        }
        if (item.elseTask) this.execute(item.elseTask, vars, globalVars, contextObj, depth + 1, parentId);
        if (item.elseBody) this.executeBody(item.elseBody, vars, globalVars, contextObj, depth, parentId);
      }
    }
    /**
     * WHILE loop: Execute body while condition is true
     */
    handleWhile(item, vars, globalVars, contextObj, depth, parentId) {
      if (!item.condition || !item.body) {
        console.warn("[TaskExecutor] WHILE loop missing condition or body");
        return;
      }
      let iterations = 0;
      while (this.evaluateCondition(item.condition, vars, globalVars)) {
        if (iterations++ >= _TaskExecutor.MAX_ITERATIONS) {
          console.error(`[TaskExecutor] WHILE loop exceeded max iterations(${_TaskExecutor.MAX_ITERATIONS})`);
          break;
        }
        this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      }
      console.log(`[TaskExecutor] WHILE loop completed after ${iterations} iterations`);
    }
    /**
     * FOR loop: Execute body for each value from 'from' to 'to'
     */
    handleFor(item, vars, globalVars, contextObj, depth, parentId) {
      if (!item.iteratorVar || !item.body) {
        console.warn("[TaskExecutor] FOR loop missing iteratorVar or body");
        return;
      }
      const from = this.resolveValue(item.from, vars, globalVars);
      const to = this.resolveValue(item.to, vars, globalVars);
      const step = item.step || 1;
      let iterations = 0;
      for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
        if (iterations++ >= _TaskExecutor.MAX_ITERATIONS) {
          console.error(`[TaskExecutor] FOR loop exceeded max iterations(${_TaskExecutor.MAX_ITERATIONS})`);
          break;
        }
        vars[item.iteratorVar] = i;
        globalVars[item.iteratorVar] = i;
        this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      }
      console.log(`[TaskExecutor] FOR loop completed after ${iterations} iterations`);
    }
    /**
     * FOREACH loop: Execute body for each item in array
     */
    handleForeach(item, vars, globalVars, contextObj, depth, parentId) {
      if (!item.sourceArray || !item.itemVar || !item.body) {
        console.warn("[TaskExecutor] FOREACH loop missing sourceArray, itemVar, or body");
        return;
      }
      const arrayName = item.sourceArray;
      const arr = vars[arrayName] !== void 0 ? vars[arrayName] : globalVars[arrayName];
      if (!Array.isArray(arr)) {
        console.warn(`[TaskExecutor] FOREACH: ${arrayName} is not an array`);
        return;
      }
      let idx = 0;
      for (const element of arr) {
        if (idx >= _TaskExecutor.MAX_ITERATIONS) {
          console.error(`[TaskExecutor] FOREACH loop exceeded max iterations(${_TaskExecutor.MAX_ITERATIONS})`);
          break;
        }
        vars[item.itemVar] = element;
        globalVars[item.itemVar] = element;
        if (item.indexVar) {
          vars[item.indexVar] = idx;
          globalVars[item.indexVar] = idx;
        }
        this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        idx++;
      }
      console.log(`[TaskExecutor] FOREACH loop completed after ${idx} iterations`);
    }
  };
  __publicField(_TaskExecutor, "MAX_DEPTH", 10);
  __publicField(_TaskExecutor, "MAX_ITERATIONS", 1e3);
  var TaskExecutor = _TaskExecutor;

  // src/runtime/GameRuntime.ts
  init_AnimationManager();

  // src/components/TComponent.ts
  var TComponent = class {
    // EventName -> TaskName
    constructor(name) {
      __publicField(this, "id");
      __publicField(this, "name");
      __publicField(this, "className");
      // Explicit className for production builds
      __publicField(this, "parent", null);
      __publicField(this, "children", []);
      __publicField(this, "Tasks");
      this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.name = name;
      this.className = this.constructor.name;
      this.Tasks = {};
    }
    getInspectorProperties() {
      return [
        { name: "name", label: "Name", type: "string", group: "Identity" },
        { name: "id", label: "ID", type: "string", group: "Identity", readonly: true }
      ];
    }
    toJSON() {
      return {
        className: this.constructor.name,
        id: this.id,
        name: this.name,
        Tasks: this.Tasks
      };
    }
    addChild(child) {
      if (child.parent) {
        child.parent.removeChild(child);
      }
      child.parent = this;
      this.children.push(child);
    }
    removeChild(child) {
      const index = this.children.indexOf(child);
      if (index !== -1) {
        this.children.splice(index, 1);
        child.parent = null;
      }
    }
    findChild(name) {
      return this.children.find((c) => c.name === name) || null;
    }
  };

  // src/components/TWindow.ts
  init_AnimationManager();
  var TWindow = class extends TComponent {
    constructor(name, x, y, width, height) {
      super(name);
      __publicField(this, "x");
      __publicField(this, "y");
      __publicField(this, "width");
      __publicField(this, "height");
      __publicField(this, "zIndex");
      __publicField(this, "_align", "NONE");
      __publicField(this, "style");
      // Focus event callbacks (available to all components)
      __publicField(this, "onFocusCallback", null);
      __publicField(this, "onBlurCallback", null);
      __publicField(this, "visible", true);
      // Animation flag - wenn true, wird Physik pausiert
      __publicField(this, "isAnimating", false);
      __publicField(this, "_caption", "");
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.zIndex = 0;
      this._align = "NONE";
      this.visible = true;
      this.style = {
        visible: true,
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderWidth: 0
      };
    }
    // Align property with position enforcement
    get align() {
      return this._align;
    }
    set align(value) {
      this._align = value;
      if (value === "TOP") {
        this.y = 0;
      }
      if (value === "LEFT") {
        this.x = 0;
      }
    }
    toJSON() {
      return {
        ...super.toJSON(),
        x: this.x,
        y: this.y,
        width: this.width,
        height: this.height,
        zIndex: this.zIndex,
        visible: this.visible,
        align: this._align,
        style: { ...this.style },
        Tasks: this.Tasks
      };
    }
    get caption() {
      return this._caption;
    }
    set caption(v) {
      this._caption = v;
    }
    // Focus event methods
    triggerFocus() {
      if (this.onFocusCallback) {
        this.onFocusCallback();
      }
    }
    triggerBlur() {
      if (this.onBlurCallback) {
        this.onBlurCallback();
      }
    }
    setOnFocus(callback) {
      this.onFocusCallback = callback;
    }
    setOnBlur(callback) {
      this.onBlurCallback = callback;
    }
    /**
     * Bewegt das Objekt animiert zu einer neuen Position.
     * @param x Ziel-X-Koordinate
     * @param y Ziel-Y-Koordinate
     * @param duration Dauer in Millisekunden (default: 500)
     * @param easing Easing-Funktion (default: 'easeOut')
     * @param onComplete Optionaler Callback nach Abschluss
     */
    moveTo(x, y, duration = 500, easing = "easeOut", onComplete) {
      const manager = AnimationManager.getInstance();
      manager.addTween(this, "x", x, duration, easing);
      manager.addTween(this, "y", y, duration, easing, onComplete);
    }
    /**
     * Get available events for this component
     * Override in subclasses to add more events
     */
    getEvents() {
      return ["onClick", "onFocus", "onBlur"];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "x", label: "X", type: "number", group: "Geometry" },
        { name: "y", label: "Y", type: "number", group: "Geometry" },
        { name: "width", label: "Width", type: "number", group: "Geometry" },
        { name: "height", label: "Height", type: "number", group: "Geometry" },
        { name: "zIndex", label: "Z-Index", type: "number", group: "Geometry" },
        { name: "align", label: "Align", type: "select", group: "Geometry", options: ["NONE", "TOP", "BOTTOM", "LEFT", "RIGHT", "CLIENT"] },
        // Removed duplicate style.visible to reduce confusion. Use root 'visible' instead.
        { name: "visible", label: "Visible", type: "boolean", group: "Identity" },
        // Added root visible
        { name: "style.backgroundColor", label: "Background", type: "color", group: "Style" },
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" },
        { name: "style.borderWidth", label: "Border Width", type: "number", group: "Style" }
      ];
    }
  };

  // src/components/TTextControl.ts
  var TTextControl = class extends TWindow {
    constructor(name, x, y, width, height) {
      super(name, x, y, width, height);
      this.style.fontSize = 14;
      this.style.color = "#000000";
      this.style.fontWeight = "normal";
      this.style.fontStyle = "normal";
      this.style.textAlign = "left";
      this.style.fontFamily = "Arial";
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "style.fontSize", label: "Font Size", type: "number", group: "Typography" },
        { name: "style.fontWeight", label: "Bold", type: "boolean", group: "Typography" },
        { name: "style.fontStyle", label: "Italic", type: "boolean", group: "Typography" },
        { name: "style.textAlign", label: "Align", type: "select", group: "Typography", options: ["left", "center", "right"] },
        { name: "style.fontFamily", label: "Font Family", type: "select", group: "Typography", options: ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Tahoma", "Trebuchet MS"] },
        { name: "style.color", label: "Text Color", type: "color", group: "Typography" }
      ];
    }
  };

  // src/components/TButton.ts
  var TButton = class extends TTextControl {
    constructor(name, x, y, width, height, text) {
      super(name, x, y, width, height);
      __publicField(this, "icon", "");
      this.caption = text !== void 0 ? text : name;
      this.style.backgroundColor = "#007bff";
      this.style.borderColor = "#000000";
      this.style.borderWidth = 1;
      this.style.color = "#ffffff";
      this.style.textAlign = "center";
      this.style.fontWeight = "bold";
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        // Basic (Specifics only, styles inherited from TTextControl/TWindow)
        { name: "caption", label: "Caption", type: "string", group: "Specifics" },
        { name: "icon", label: "Icon Image", type: "image_picker", group: "Specifics" }
      ];
    }
    // Color property wrapper mapping to style (legacy support)
    get color() {
      return this.style.backgroundColor;
    }
    set color(value) {
      this.style.backgroundColor = value;
    }
    toJSON() {
      return {
        ...super.toJSON(),
        caption: this.caption,
        color: this.color,
        // Keep legacy mapping for now
        icon: this.icon
      };
    }
  };

  // src/components/TPanel.ts
  var TPanel = class extends TWindow {
    constructor(name, x, y, width, height) {
      super(name, x, y, width, height);
      __publicField(this, "_showGrid", false);
      __publicField(this, "_gridColor", "#000000");
      __publicField(this, "_gridStyle", "lines");
      this.style.backgroundColor = "#f0f0f0";
      this.style.borderColor = "#999999";
      this.style.borderWidth = 1;
    }
    get caption() {
      return this.name;
    }
    set caption(v) {
      this.name = v;
    }
    get showGrid() {
      return this._showGrid;
    }
    set showGrid(v) {
      this._showGrid = v;
    }
    get gridColor() {
      return this._gridColor;
    }
    set gridColor(v) {
      this._gridColor = v;
    }
    get gridStyle() {
      return this._gridStyle;
    }
    set gridStyle(v) {
      this._gridStyle = v;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "caption", label: "Caption", type: "string", group: "Specifics" },
        { name: "showGrid", label: "Show Grid", type: "boolean", group: "Specifics" },
        { name: "gridColor", label: "Grid Color", type: "color", group: "Specifics" },
        { name: "gridStyle", label: "Grid Style", type: "select", options: ["lines", "dots"], group: "Specifics" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        caption: this.caption,
        showGrid: this._showGrid,
        gridColor: this._gridColor,
        gridStyle: this._gridStyle,
        style: {
          ...super.toJSON().style,
          borderColor: this.style.borderColor,
          borderWidth: this.style.borderWidth,
          backgroundColor: this.style.backgroundColor
        }
      };
    }
  };

  // src/components/TLabel.ts
  var TLabel = class extends TTextControl {
    constructor(name, x, y, text) {
      super(name, x, y, 100, 20);
      __publicField(this, "text");
      this.text = text !== void 0 ? text : name;
      this.style.backgroundColor = "transparent";
      this.style.color = "#000000";
      this.style.textAlign = "left";
    }
    // Mapping caption to text for TLabel
    get caption() {
      return this.text;
    }
    set caption(v) {
      this.text = v;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "text", label: "Text", type: "string", group: "Specifics" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        text: this.text
      };
    }
  };

  // src/components/TEdit.ts
  var TEdit = class extends TTextControl {
    constructor(name, x, y, width = 8, height = 2) {
      super(name, x, y, width, height);
      __publicField(this, "text");
      __publicField(this, "placeholder");
      __publicField(this, "maxLength");
      // TEdit-specific event callbacks
      __publicField(this, "onChangeCallback", null);
      __publicField(this, "onEnterCallback", null);
      this.text = "";
      this.placeholder = "Enter text...";
      this.maxLength = 100;
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#cccccc";
      this.style.borderWidth = 1;
      this.style.color = "#000000";
    }
    // Mapping caption to text for consistency
    get caption() {
      return this.text;
    }
    set caption(v) {
      this.text = v;
    }
    /**
     * Called when text changes
     */
    triggerChange(newText) {
      this.text = newText;
      if (this.onChangeCallback) {
        this.onChangeCallback(newText);
      }
    }
    /**
     * Called when Enter key is pressed
     */
    triggerEnter() {
      if (this.onEnterCallback) {
        this.onEnterCallback(this.text);
      }
    }
    /**
     * Set TEdit-specific event handlers
     */
    setOnChange(callback) {
      this.onChangeCallback = callback;
    }
    setOnEnter(callback) {
      this.onEnterCallback = callback;
    }
    /**
     * Get available events for this component
     * Extends TWindow events with TEdit-specific events
     */
    getEvents() {
      return [...super.getEvents(), "onChange", "onEnter"];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "text", label: "Value", type: "string", group: "Specifics" },
        { name: "placeholder", label: "Placeholder", type: "string", group: "Specifics" },
        { name: "maxLength", label: "Max Length", type: "number", group: "Specifics" }
        // Inherits styles from TTextControl
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        text: this.text,
        placeholder: this.placeholder,
        maxLength: this.maxLength
      };
    }
  };

  // src/components/TSystemInfo.ts
  var TSystemInfo = class extends TComponent {
    // Touch support
    constructor(name = "SystemInfo") {
      super(name);
      // Browser Information
      __publicField(this, "browserName");
      __publicField(this, "browserVersion");
      __publicField(this, "userAgent");
      __publicField(this, "language");
      __publicField(this, "platform");
      __publicField(this, "online");
      // Screen Information
      __publicField(this, "screenWidth");
      __publicField(this, "screenHeight");
      __publicField(this, "screenColorDepth");
      __publicField(this, "devicePixelRatio");
      // Window Information
      __publicField(this, "windowWidth");
      __publicField(this, "windowHeight");
      __publicField(this, "windowOuterWidth");
      __publicField(this, "windowOuterHeight");
      // Hardware Information
      __publicField(this, "hardwareConcurrency");
      // CPU cores
      __publicField(this, "deviceMemory");
      // RAM in GB
      __publicField(this, "maxTouchPoints");
      this.browserName = this.detectBrowserName();
      this.browserVersion = this.detectBrowserVersion();
      this.userAgent = navigator.userAgent;
      this.language = navigator.language;
      this.platform = navigator.platform;
      this.online = navigator.onLine;
      this.screenWidth = screen.width;
      this.screenHeight = screen.height;
      this.screenColorDepth = screen.colorDepth;
      this.devicePixelRatio = window.devicePixelRatio || 1;
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
      this.windowOuterWidth = window.outerWidth;
      this.windowOuterHeight = window.outerHeight;
      this.hardwareConcurrency = navigator.hardwareConcurrency || 0;
      this.deviceMemory = navigator.deviceMemory || 0;
      this.maxTouchPoints = navigator.maxTouchPoints || 0;
    }
    /**
     * Refresh all dynamic values (e.g., window size, online status)
     */
    refresh() {
      this.online = navigator.onLine;
      this.windowWidth = window.innerWidth;
      this.windowHeight = window.innerHeight;
      this.windowOuterWidth = window.outerWidth;
      this.windowOuterHeight = window.outerHeight;
      this.devicePixelRatio = window.devicePixelRatio || 1;
    }
    detectBrowserName() {
      const ua = navigator.userAgent;
      if (ua.includes("Firefox")) return "Firefox";
      if (ua.includes("Edg/")) return "Edge";
      if (ua.includes("Chrome")) return "Chrome";
      if (ua.includes("Safari")) return "Safari";
      if (ua.includes("Opera") || ua.includes("OPR")) return "Opera";
      return "Unknown";
    }
    detectBrowserVersion() {
      const ua = navigator.userAgent;
      const match = ua.match(/(Firefox|Edg|Chrome|Safari|OPR|Opera)[\/\s](\d+(\.\d+)?)/);
      return match ? match[2] : "Unknown";
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        // Browser
        { name: "browserName", label: "Browser", type: "string", group: "Browser", readonly: true },
        { name: "browserVersion", label: "Version", type: "string", group: "Browser", readonly: true },
        { name: "userAgent", label: "User Agent", type: "string", group: "Browser", readonly: true },
        { name: "language", label: "Language", type: "string", group: "Browser", readonly: true },
        { name: "platform", label: "Platform", type: "string", group: "Browser", readonly: true },
        { name: "online", label: "Online", type: "boolean", group: "Browser", readonly: true },
        // Screen
        { name: "screenWidth", label: "Screen Width", type: "number", group: "Screen", readonly: true },
        { name: "screenHeight", label: "Screen Height", type: "number", group: "Screen", readonly: true },
        { name: "screenColorDepth", label: "Color Depth", type: "number", group: "Screen", readonly: true },
        { name: "devicePixelRatio", label: "Pixel Ratio", type: "number", group: "Screen", readonly: true },
        // Window
        { name: "windowWidth", label: "Window Width", type: "number", group: "Window", readonly: true },
        { name: "windowHeight", label: "Window Height", type: "number", group: "Window", readonly: true },
        { name: "windowOuterWidth", label: "Outer Width", type: "number", group: "Window", readonly: true },
        { name: "windowOuterHeight", label: "Outer Height", type: "number", group: "Window", readonly: true },
        // Hardware
        { name: "hardwareConcurrency", label: "CPU Cores", type: "number", group: "Hardware", readonly: true },
        { name: "deviceMemory", label: "RAM (GB)", type: "number", group: "Hardware", readonly: true },
        { name: "maxTouchPoints", label: "Touch Points", type: "number", group: "Hardware", readonly: true }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        browserName: this.browserName,
        browserVersion: this.browserVersion,
        userAgent: this.userAgent,
        language: this.language,
        platform: this.platform,
        online: this.online,
        screenWidth: this.screenWidth,
        screenHeight: this.screenHeight,
        screenColorDepth: this.screenColorDepth,
        devicePixelRatio: this.devicePixelRatio,
        windowWidth: this.windowWidth,
        windowHeight: this.windowHeight,
        windowOuterWidth: this.windowOuterWidth,
        windowOuterHeight: this.windowOuterHeight,
        hardwareConcurrency: this.hardwareConcurrency,
        deviceMemory: this.deviceMemory,
        maxTouchPoints: this.maxTouchPoints
      };
    }
  };

  // src/components/TGameHeader.ts
  var TGameHeader = class extends TTextControl {
    constructor(name, x = 0, y = 0, width = 32, height = 2) {
      super(name, x, y, width, height);
      __publicField(this, "_title");
      this.align = "TOP";
      this._title = name;
      this.style.backgroundColor = "#2c3e50";
      this.style.borderColor = "#34495e";
      this.style.borderWidth = 0;
      this.style.color = "#ffffff";
      this.style.fontSize = 18;
      this.style.fontWeight = "bold";
      this.style.fontFamily = "Segoe UI, sans-serif";
      this.style.textAlign = "center";
    }
    // Title property (mapped to caption/text)
    get title() {
      return this._title;
    }
    set title(value) {
      this._title = value;
      this.caption = value;
    }
    // Helper for legacy titleAlign
    get titleAlign() {
      const align = this.style.textAlign || "center";
      return align === "left" ? "LEFT" : align === "right" ? "RIGHT" : "CENTER";
    }
    set titleAlign(value) {
      this.style.textAlign = value.toLowerCase();
    }
    /**
     * Legacy Accessors for Inspector compatibility
     * These map strictly to TTextControl styles now.
     */
    get textColor() {
      return this.style.color || "#ffffff";
    }
    set textColor(v) {
      this.style.color = v;
    }
    get fontSize() {
      return this.style.fontSize;
    }
    set fontSize(v) {
      this.style.fontSize = v;
    }
    get fontWeight() {
      return this.style.fontWeight;
    }
    set fontWeight(v) {
      this.style.fontWeight = v;
    }
    get fontFamily() {
      return this.style.fontFamily;
    }
    set fontFamily(v) {
      this.style.fontFamily = v;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "title", label: "Title", type: "string", group: "Header" }
        // Inherits Typography group from TTextControl
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        title: this._title
        // titleAlign etc are stored in style now
      };
    }
  };

  // src/components/ImageCapable.ts
  var IMAGE_DEFAULTS = {
    backgroundImage: "",
    objectFit: "contain",
    imageOpacity: 1
  };

  // src/components/TSprite.ts
  var TSprite = class extends TWindow {
    constructor(name, x, y, width, height) {
      super(name, x, y, width, height);
      // Motion properties
      __publicField(this, "velocityX", 0);
      __publicField(this, "velocityY", 0);
      // Collision properties
      __publicField(this, "collisionEnabled", true);
      __publicField(this, "collisionGroup", "default");
      // Appearance
      __publicField(this, "shape", "rect");
      __publicField(this, "spriteColor", "#ff6b6b");
      __publicField(this, "lerpSpeed", 0.1);
      // 0 to 1
      // Image support (optional sprite graphic)
      __publicField(this, "_backgroundImage", "");
      __publicField(this, "_objectFit", IMAGE_DEFAULTS.objectFit);
      // Error offset for smooth correction
      __publicField(this, "errorX", 0);
      __publicField(this, "errorY", 0);
      this.style.backgroundColor = this.spriteColor;
      this.style.borderColor = "#333333";
      this.style.borderWidth = 1;
    }
    // ─────────────────────────────────────────────
    // Image Properties (optional sprite graphic)
    // ─────────────────────────────────────────────
    get backgroundImage() {
      return this._backgroundImage;
    }
    set backgroundImage(value) {
      this._backgroundImage = value || "";
    }
    get objectFit() {
      return this._objectFit;
    }
    set objectFit(value) {
      this._objectFit = value;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        // Motion group
        { name: "velocityX", label: "Velocity X", type: "number", group: "Motion" },
        { name: "velocityY", label: "Velocity Y", type: "number", group: "Motion" },
        // Interpolation group
        { name: "lerpSpeed", label: "Lerp Speed", type: "number", group: "Interpolation" },
        // Collision group
        { name: "collisionEnabled", label: "Collision", type: "boolean", group: "Collision" },
        { name: "collisionGroup", label: "Collision Group", type: "string", group: "Collision" },
        // Appearance group
        { name: "shape", label: "Shape", type: "select", group: "Appearance", options: ["rect", "circle"] },
        { name: "spriteColor", label: "Sprite Color", type: "color", group: "Appearance" },
        { name: "backgroundImage", label: "Sprite Image", type: "image_picker", group: "Appearance" },
        { name: "objectFit", label: "Image Fit", type: "select", group: "Appearance", options: ["cover", "contain", "fill", "none"] }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        velocityX: this.velocityX,
        velocityY: this.velocityY,
        lerpSpeed: this.lerpSpeed,
        collisionEnabled: this.collisionEnabled,
        collisionGroup: this.collisionGroup,
        shape: this.shape,
        spriteColor: this.spriteColor,
        backgroundImage: this._backgroundImage,
        objectFit: this._objectFit
      };
    }
    /**
     * Smoothly sync to a new position using additive error correction
     */
    smoothSync(remoteX, remoteY) {
      const dx = remoteX - this.x;
      const dy = remoteY - this.y;
      if (Math.abs(dx) > 10 || Math.abs(dy) > 10) {
        this.x = remoteX;
        this.y = remoteY;
        this.errorX = 0;
        this.errorY = 0;
        return;
      }
      this.errorX = dx;
      this.errorY = dy;
    }
    update(deltaTime, applyVelocity = true) {
      if (this.isAnimating) {
        return;
      }
      const moveFactor = deltaTime * 60;
      if (applyVelocity) {
        this.x += this.velocityX * moveFactor;
        this.y += this.velocityY * moveFactor;
      }
      if (this.errorX !== 0) {
        const corrX = this.errorX * this.lerpSpeed;
        this.x += corrX;
        this.errorX -= corrX;
        if (Math.abs(this.errorX) < 0.01) this.errorX = 0;
      }
      if (this.errorY !== 0) {
        const corrY = this.errorY * this.lerpSpeed;
        this.y += corrY;
        this.errorY -= corrY;
        if (Math.abs(this.errorY) < 0.01) this.errorY = 0;
      }
    }
    /**
     * Check collision with another sprite using AABB
     */
    checkCollision(other) {
      if (!this.collisionEnabled || !other.collisionEnabled) {
        return false;
      }
      return this.x < other.x + other.width && this.x + this.width > other.x && this.y < other.y + other.height && this.y + this.height > other.y;
    }
    /**
     * Get the side and depth of collision with another sprite
     */
    getCollisionOverlap(other) {
      if (!this.checkCollision(other)) return null;
      const dx = this.x + this.width / 2 - (other.x + other.width / 2);
      const dy = this.y + this.height / 2 - (other.y + other.height / 2);
      const combinedHalfWidths = (this.width + other.width) / 2;
      const combinedHalfHeights = (this.height + other.height) / 2;
      const overlapX = combinedHalfWidths - Math.abs(dx);
      const overlapY = combinedHalfHeights - Math.abs(dy);
      if (overlapX < overlapY) {
        return {
          side: dx > 0 ? "left" : "right",
          // 'left' of THIS means 'right' of OTHER
          depth: overlapX
        };
      } else {
        return {
          side: dy > 0 ? "top" : "bottom",
          depth: overlapY
        };
      }
    }
    /**
     * Check if sprite is within bounds
     */
    isWithinBounds(maxX, maxY) {
      return {
        left: this.x >= 0,
        right: this.x + this.width <= maxX,
        top: this.y >= 0,
        bottom: this.y + this.height <= maxY
      };
    }
    getEvents() {
      const events = super.getEvents();
      return [
        ...events,
        "onCollision",
        "onCollisionLeft",
        "onCollisionRight",
        "onCollisionTop",
        "onCollisionBottom",
        "onBoundaryHit"
      ];
    }
  };

  // src/components/TGameLoop.ts
  init_AnimationManager();
  var TGameLoop = class extends TWindow {
    // Prevent repeated boundary events
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 3, 1);
      // Loop settings
      __publicField(this, "targetFPS", 60);
      __publicField(this, "state", "stopped");
      // Grid reference (set via init) - bounds are derived from this
      __publicField(this, "gridConfig", null);
      __publicField(this, "gameState", null);
      // Offset for playable area (e.g., for headers)
      __publicField(this, "boundsOffsetTop", 0);
      __publicField(this, "boundsOffsetBottom", 0);
      // Internal state
      __publicField(this, "animationFrameId", null);
      __publicField(this, "lastTime", 0);
      __publicField(this, "sprites", []);
      __publicField(this, "inputControllers", []);
      __publicField(this, "renderCallback", null);
      __publicField(this, "eventCallback", null);
      __publicField(this, "collisionCooldowns", /* @__PURE__ */ new Map());
      __publicField(this, "boundaryCooldowns", /* @__PURE__ */ new Map());
      __publicField(this, "collidedThisFrame", /* @__PURE__ */ new Set());
      // Track sprites that collided this frame
      __publicField(this, "COLLISION_COOLDOWN_MS", 200);
      __publicField(this, "BOUNDARY_COOLDOWN_MS", 500);
      /**
       * Main game loop
       */
      __publicField(this, "loop", () => {
        if (this.state !== "running") return;
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1e3;
        this.lastTime = now;
        this.inputControllers.forEach((ic) => {
          if (ic.update) ic.update();
        });
        const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
        this.updateSprites(deltaTime, spritesMoving);
        AnimationManager.getInstance().update();
        this.collidedThisFrame.clear();
        if (spritesMoving) {
          this.checkCollisions();
          this.checkBoundaries();
        }
        if (this.renderCallback) {
          this.renderCallback();
        }
        this.animationFrameId = requestAnimationFrame(this.loop);
      });
      this.style.backgroundColor = "#2196f3";
      this.style.borderColor = "#1565c0";
      this.style.borderWidth = 2;
      this.style.color = "#ffffff";
    }
    // Getter for bounds - derived from gridConfig
    get boundsWidth() {
      const grid = this.gridConfig;
      return grid?.grid?.cols ?? grid?.cols ?? 64;
    }
    set boundsWidth(_) {
    }
    get boundsHeight() {
      const grid = this.gridConfig;
      return grid?.grid?.rows ?? grid?.rows ?? 40;
    }
    set boundsHeight(_) {
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "targetFPS", label: "Target FPS", type: "number", group: "Loop Settings" },
        { name: "boundsOffsetTop", label: "Bounds Offset Top", type: "number", group: "Boundaries" },
        { name: "boundsOffsetBottom", label: "Bounds Offset Bottom", type: "number", group: "Boundaries" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        targetFPS: this.targetFPS,
        boundsOffsetTop: this.boundsOffsetTop,
        boundsOffsetBottom: this.boundsOffsetBottom
      };
    }
    /**
     * Initialize the game loop with objects, grid config, and callbacks
     */
    init(objects, gridConfig, renderCallback, eventCallback) {
      this.gridConfig = gridConfig;
      this.sprites = objects.filter(
        (obj) => obj.className === "TSprite" || obj.constructor.name === "TSprite"
      );
      this.inputControllers = objects.filter(
        (obj) => obj.className === "TInputController" || obj.constructor.name === "TInputController"
      );
      this.gameState = objects.find(
        (obj) => obj.className === "TGameState" || obj.constructor.name === "TGameState"
      ) || null;
      this.renderCallback = renderCallback;
      this.eventCallback = eventCallback || null;
    }
    /**
     * Start the game loop
     */
    start() {
      if (this.state === "running") return;
      this.state = "running";
      this.lastTime = performance.now();
      if (this.eventCallback) {
        this.eventCallback(this.id, "onStart");
      }
      this.loop();
    }
    /**
     * Stop the game loop
     */
    stop() {
      this.state = "stopped";
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
    /**
     * Pause the game loop
     */
    pause() {
      if (this.state === "running") {
        this.state = "paused";
      }
    }
    /**
     * Resume the game loop
     */
    resume() {
      if (this.state === "paused") {
        this.state = "running";
        this.lastTime = performance.now();
        this.loop();
      }
    }
    /**
     * Update all sprites based on velocity
     */
    updateSprites(deltaTime, applyVelocity = true) {
      this.sprites.forEach((sprite) => {
        sprite.update(deltaTime, applyVelocity);
      });
    }
    /**
     * Check collisions between sprites
     */
    checkCollisions() {
      for (let i = 0; i < this.sprites.length; i++) {
        for (let j = i + 1; j < this.sprites.length; j++) {
          const spriteA = this.sprites[i];
          const spriteB = this.sprites[j];
          if (spriteA.isAnimating || spriteB.isAnimating) {
            continue;
          }
          const overlap = spriteA.getCollisionOverlap(spriteB);
          if (overlap) {
            const now = performance.now();
            const pairKey = `${spriteA.id}_${spriteB.id}`;
            const lastCollision = this.collisionCooldowns.get(pairKey) || 0;
            if (now - lastCollision < this.COLLISION_COOLDOWN_MS) {
              continue;
            }
            this.collisionCooldowns.set(pairKey, now);
            if (overlap.side === "left" || overlap.side === "right") {
              if (Math.abs(spriteA.velocityX) >= Math.abs(spriteB.velocityX)) {
                spriteA.x -= (overlap.side === "left" ? -1 : 1) * overlap.depth;
              } else {
                spriteB.x += (overlap.side === "left" ? -1 : 1) * overlap.depth;
              }
            } else {
              if (Math.abs(spriteA.velocityY) >= Math.abs(spriteB.velocityY)) {
                spriteA.y -= (overlap.side === "top" ? -1 : 1) * overlap.depth;
              } else {
                spriteB.y += (overlap.side === "top" ? -1 : 1) * overlap.depth;
              }
            }
            if (this.eventCallback) {
              this.eventCallback(spriteA.id, "onCollision", {
                other: spriteB.name,
                otherSprite: spriteB,
                hitSide: overlap.side
              });
              const oppositeSide = {
                "left": "right",
                "right": "left",
                "top": "bottom",
                "bottom": "top"
              }[overlap.side];
              this.eventCallback(spriteB.id, "onCollision", {
                other: spriteA.name,
                otherSprite: spriteA,
                hitSide: oppositeSide
              });
              if (overlap.side === "left") {
                this.eventCallback(spriteA.id, "onCollisionLeft", { other: spriteB });
              } else if (overlap.side === "right") {
                this.eventCallback(spriteA.id, "onCollisionRight", { other: spriteB });
              } else if (overlap.side === "top") {
                this.eventCallback(spriteA.id, "onCollisionTop", { other: spriteB });
              } else if (overlap.side === "bottom") {
                this.eventCallback(spriteA.id, "onCollisionBottom", { other: spriteB });
              }
              if (oppositeSide === "left") {
                this.eventCallback(spriteB.id, "onCollisionLeft", { other: spriteA });
              } else if (oppositeSide === "right") {
                this.eventCallback(spriteB.id, "onCollisionRight", { other: spriteA });
              } else if (oppositeSide === "top") {
                this.eventCallback(spriteB.id, "onCollisionTop", { other: spriteA });
              } else if (oppositeSide === "bottom") {
                this.eventCallback(spriteB.id, "onCollisionBottom", { other: spriteA });
              }
              this.collidedThisFrame.add(spriteA.id);
              this.collidedThisFrame.add(spriteB.id);
            }
          }
        }
      }
    }
    /**
     * Check if sprites hit stage boundaries
     */
    /**
     * Check if sprites hit stage boundaries
     */
    checkBoundaries() {
      this.sprites.forEach((sprite) => {
        if (sprite.isAnimating) {
          return;
        }
        if (this.collidedThisFrame.has(sprite.id)) {
          return;
        }
        const bounds = sprite.isWithinBounds(this.boundsWidth, this.boundsHeight);
        if (!bounds.left) {
          this.triggerBoundaryEvent(sprite, "left");
        }
        if (!bounds.right) {
          this.triggerBoundaryEvent(sprite, "right");
        }
        if (sprite.y < this.boundsOffsetTop) {
          this.triggerBoundaryEvent(sprite, "top");
        }
        const bottomBoundary = this.boundsHeight - this.boundsOffsetBottom;
        if (sprite.y + sprite.height > bottomBoundary) {
          this.triggerBoundaryEvent(sprite, "bottom");
        }
      });
    }
    triggerBoundaryEvent(sprite, side) {
      const cooldownKey = `${sprite.id}_${side}`;
      const now = performance.now();
      const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;
      if (now - lastHit > this.BOUNDARY_COOLDOWN_MS) {
        this.boundaryCooldowns.set(cooldownKey, now);
        if (side === "left" || side === "right") sprite.velocityX = 0;
        if (side === "top" || side === "bottom") sprite.velocityY = 0;
        if (side === "left") sprite.x = 0;
        if (side === "right") sprite.x = this.boundsWidth - sprite.width;
        if (side === "top") sprite.y = this.boundsOffsetTop;
        if (side === "bottom") sprite.y = this.boundsHeight - this.boundsOffsetBottom - sprite.height;
        if (this.eventCallback) {
          this.eventCallback(sprite.id, "onBoundaryHit", { hitSide: side });
        }
      }
    }
  };

  // src/components/TInputController.ts
  var TInputController = class extends TWindow {
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 3, 1);
      // Input settings
      __publicField(this, "enabled", true);
      // Internal state
      __publicField(this, "keysPressed", /* @__PURE__ */ new Set());
      // private sprites: TSprite[] = [];
      __publicField(this, "isActive", false);
      __publicField(this, "eventCallback", null);
      // Event handlers (bound for proper removal)
      __publicField(this, "handleKeyDown");
      __publicField(this, "handleKeyUp");
      this.style.backgroundColor = "#9c27b0";
      this.style.borderColor = "#6a1b9a";
      this.style.borderWidth = 2;
      this.style.color = "#ffffff";
      this.handleKeyDown = this.onKeyDown.bind(this);
      this.handleKeyUp = this.onKeyUp.bind(this);
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "enabled", label: "Enabled", type: "boolean", group: "Input" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        enabled: this.enabled
      };
    }
    /**
     * Initialize with game objects and event callback
     */
    init(_objects, eventCallback) {
      this.eventCallback = eventCallback || null;
    }
    /**
     * Start listening for keyboard events
     */
    start() {
      if (this.isActive || !this.enabled) return;
      window.addEventListener("keydown", this.handleKeyDown);
      window.addEventListener("keyup", this.handleKeyUp);
      this.isActive = true;
    }
    /**
     * Stop listening for keyboard events
     */
    stop() {
      if (!this.isActive) return;
      window.removeEventListener("keydown", this.handleKeyDown);
      window.removeEventListener("keyup", this.handleKeyUp);
      this.keysPressed.clear();
      this.isActive = false;
    }
    /**
     * Handle keydown event
     */
    onKeyDown(e) {
      if (["ArrowUp", "ArrowDown", "ArrowLeft", "ArrowRight", "KeyW", "KeyS", "KeyA", "KeyD"].includes(e.code)) {
        e.preventDefault();
      }
      if (!this.keysPressed.has(e.code)) {
        this.keysPressed.add(e.code);
        if (window.__multiplayerInputCallback) {
          window.__multiplayerInputCallback(e.code, "down");
        }
        if (this.eventCallback) {
          this.eventCallback(this.id, `onKeyDown_${e.code}`, { keyCode: e.code });
        }
      }
    }
    /**
     * Handle keyup event
     */
    onKeyUp(e) {
      this.keysPressed.delete(e.code);
      if (window.__multiplayerInputCallback) {
        window.__multiplayerInputCallback(e.code, "up");
      }
      if (this.eventCallback) {
        this.eventCallback(this.id, `onKeyUp_${e.code}`, { keyCode: e.code });
      }
    }
    /**
     * Simulate a remote key press (for multiplayer)
     */
    simulateKeyPress(code) {
      if (!this.keysPressed.has(code)) {
        this.keysPressed.add(code);
        if (this.eventCallback) {
          this.eventCallback(this.id, `onKeyDown_${code}`, { keyCode: code });
        }
      }
    }
    /**
     * Simulate a remote key release (for multiplayer)
     */
    simulateKeyRelease(code) {
      if (this.keysPressed.has(code)) {
        this.keysPressed.delete(code);
        if (this.eventCallback) {
          this.eventCallback(this.id, `onKeyUp_${code}`, { keyCode: code });
        }
      }
    }
    /**
     * Update sprites (called by GameLoop)
     */
    update() {
    }
    getEvents() {
      const events = super.getEvents();
      return [
        ...events,
        "onKeyDown_KeyW",
        "onKeyDown_KeyS",
        "onKeyDown_KeyA",
        "onKeyDown_KeyD",
        "onKeyDown_ArrowUp",
        "onKeyDown_ArrowDown",
        "onKeyDown_ArrowLeft",
        "onKeyDown_ArrowRight",
        "onKeyDown_Space",
        "onKeyDown_Enter",
        "onKeyUp_KeyW",
        "onKeyUp_KeyS",
        "onKeyUp_KeyA",
        "onKeyUp_KeyD",
        "onKeyUp_ArrowUp",
        "onKeyUp_ArrowDown",
        "onKeyUp_ArrowLeft",
        "onKeyUp_ArrowRight",
        "onKeyUp_Space",
        "onKeyUp_Enter"
      ];
    }
  };

  // src/components/TTimer.ts
  var TTimer = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "className", "TTimer");
      __publicField(this, "interval", 1e3);
      // in milliseconds
      __publicField(this, "enabled", true);
      __publicField(this, "maxInterval", 0);
      // 0 = infinite, >0 = max number of intervals
      __publicField(this, "currentInterval", 0);
      // current interval count
      __publicField(this, "timerId", null);
      __publicField(this, "onTimerCallback", null);
      __publicField(this, "onEvent", null);
      this.style.backgroundColor = "#4caf50";
      this.style.borderColor = "#2e7d32";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "interval", label: "Interval (ms)", type: "number", group: "Timer" },
        { name: "enabled", label: "Aktiviert", type: "boolean", group: "Timer" },
        { name: "maxInterval", label: "Max Intervalle (0=\u221E)", type: "number", group: "Timer" },
        { name: "currentInterval", label: "Aktuelle Anzahl", type: "number", group: "Timer" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onTimer",
        "onMaxIntervalReached"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        interval: this.interval,
        enabled: this.enabled,
        maxInterval: this.maxInterval,
        currentInterval: this.currentInterval
      };
    }
    /**
     * Start the timer with a callback. Used internally by Editor/GameRuntime.
     */
    start(callback) {
      this.stop();
      this.onTimerCallback = callback;
      if (this.enabled) {
        this.timerId = window.setInterval(() => {
          this.currentInterval++;
          console.log(`[TTimer] ${this.name}: Interval ${this.currentInterval}/${this.maxInterval || "\u221E"}`);
          if (this.onTimerCallback) {
            this.onTimerCallback();
          }
          if (this.onEvent) {
            this.onEvent("onTimer");
          }
          if (this.maxInterval > 0 && this.currentInterval >= this.maxInterval) {
            console.log(`[TTimer] ${this.name}: MaxInterval reached (${this.maxInterval})`);
            this.stop();
            if (this.onEvent) {
              this.onEvent("onMaxIntervalReached");
            }
          }
        }, this.interval);
      }
    }
    /**
     * Stop the timer
     */
    stop() {
      if (this.timerId !== null) {
        window.clearInterval(this.timerId);
        this.timerId = null;
      }
    }
    /**
     * Start the timer (callable via call_method action)
     */
    timerStart() {
      console.log(`[TTimer] ${this.name}: timerStart() called`);
      this.enabled = true;
      if (this.onEvent) {
        this.start(() => {
        });
      } else {
        this.start(() => {
        });
      }
    }
    /**
     * Stop the timer (callable via call_method action)
     */
    timerStop() {
      console.log(`[TTimer] ${this.name}: timerStop() called`);
      this.enabled = false;
      this.stop();
    }
    /**
     * Reset the interval counter to 0
     */
    reset() {
      console.log(`[TTimer] ${this.name}: reset() called`);
      this.currentInterval = 0;
    }
  };

  // src/components/TRepeater.ts
  var TRepeater = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "interval", 1e3);
      // Delay in milliseconds
      __publicField(this, "repeatCount", 1);
      // Number of repetitions (0 = infinite)
      __publicField(this, "enabled", true);
      __publicField(this, "timerId", null);
      __publicField(this, "currentCount", 0);
      __publicField(this, "onTimeoutCallback", null);
      this.style.backgroundColor = "#ff9800";
      this.style.borderColor = "#e65100";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "interval", label: "Interval (ms)", type: "number", group: "Repeater" },
        { name: "repeatCount", label: "Repeat Count", type: "number", group: "Repeater" },
        { name: "enabled", label: "Enabled", type: "boolean", group: "Repeater" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        interval: this.interval,
        repeatCount: this.repeatCount,
        enabled: this.enabled
      };
    }
    /**
     * Starts the repeater with optional callback
     * The callback is called each time the interval elapses
     */
    start(callback) {
      this.stop();
      this.currentCount = 0;
      if (callback) {
        this.onTimeoutCallback = callback;
      }
      if (!this.enabled) return;
      const tick = () => {
        this.currentCount++;
        if (this.onTimeoutCallback) {
          this.onTimeoutCallback();
        }
        if (this.Tasks?.onTimeout) {
        }
        if (this.repeatCount === 0 || this.currentCount < this.repeatCount) {
          this.timerId = window.setTimeout(tick, this.interval);
        } else {
          this.timerId = null;
        }
      };
      this.timerId = window.setTimeout(tick, this.interval);
    }
    /**
     * Stops the repeater before completion
     */
    stop() {
      if (this.timerId !== null) {
        window.clearTimeout(this.timerId);
        this.timerId = null;
      }
      this.currentCount = 0;
    }
    /**
     * Returns true if the repeater is currently running
     */
    isRunning() {
      return this.timerId !== null;
    }
  };

  // src/components/TGameCard.ts
  var TGameCard = class extends TWindow {
    // Number of waiting rooms
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 6, 5);
      // Game info
      __publicField(this, "gameName", "Game");
      __publicField(this, "gameFile", "");
      // e.g., "pong.json"
      __publicField(this, "waitingCount", 0);
      this.style.backgroundColor = "#2a2a2a";
      this.style.borderColor = "#4fc3f7";
      this.style.borderWidth = 2;
      this.style.color = "#ffffff";
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "gameName", label: "Game Name", type: "string", group: "Game" },
        { name: "gameFile", label: "Game File", type: "string", group: "Game" },
        { name: "waitingCount", label: "Waiting Rooms", type: "number", group: "Game" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        gameName: this.gameName,
        gameFile: this.gameFile,
        waitingCount: this.waitingCount,
        Tasks: this.Tasks
      };
    }
  };

  // src/multiplayer/NetworkManager.ts
  var NetworkManager = class {
    constructor(serverUrl = "ws://localhost:3000") {
      __publicField(this, "ws", null);
      __publicField(this, "serverUrl");
      __publicField(this, "eventHandlers", /* @__PURE__ */ new Set());
      __publicField(this, "state", "disconnected");
      __publicField(this, "roomCode", null);
      __publicField(this, "playerNumber", null);
      this.serverUrl = serverUrl;
    }
    /**
     * Get the HTTP base URL based on the WebSocket URL
     */
    getHttpUrl() {
      return this.serverUrl.replace("ws://", "http://").replace("wss://", "https://");
    }
    /**
     * Connect to the game server
     */
    connect() {
      return new Promise((resolve, reject) => {
        if (this.ws && this.ws.readyState === WebSocket.OPEN) {
          resolve();
          return;
        }
        this.state = "connecting";
        this.ws = new WebSocket(this.serverUrl);
        this.ws.onopen = () => {
          this.state = "connected";
          console.log("[Network] Connected to server");
          resolve();
        };
        this.ws.onerror = (error) => {
          console.error("[Network] Connection error:", error);
          this.state = "disconnected";
          reject(error);
        };
        this.ws.onclose = () => {
          console.log("[Network] Disconnected from server");
          this.state = "disconnected";
          this.roomCode = null;
          this.playerNumber = null;
        };
        this.ws.onmessage = (event) => {
          this.handleMessage(event.data);
        };
      });
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
      if (this.ws) {
        this.ws.close();
        this.ws = null;
      }
      this.state = "disconnected";
      this.roomCode = null;
      this.playerNumber = null;
    }
    /**
     * Create a new game room
     */
    createRoom(gameName) {
      this.send({ type: "create_room", gameName });
    }
    /**
     * Join an existing room
     */
    joinRoom(roomCode) {
      this.send({ type: "join_room", roomCode: roomCode.toUpperCase() });
    }
    /**
     * Mark player as ready
     */
    ready() {
      this.send({ type: "ready" });
    }
    /**
     * Send input event (key press/release)
     */
    sendInput(key, action) {
      this.send({ type: "input", key, action });
    }
    /**
     * Trigger an event on a remote object (e.g., onClick for a button)
     */
    triggerRemoteEvent(objectId, eventName, params) {
      this.send({ type: "trigger_event", objectId, eventName, params });
    }
    /**
     * Send generic state sync for any object
     */
    sendStateSync(objectId, state) {
      this.send({ type: "state_sync", objectId, state });
    }
    /**
     * Send project JSON to server (Master only)
     */
    syncProject(project) {
      this.send({ type: "sync_project", project });
    }
    /**
     * Broadcast an action to all players
     */
    sendBroadcastAction(action) {
      this.send({ type: "broadcast_action", action });
    }
    /**
     * Add event listener for server messages
     */
    on(handler) {
      this.eventHandlers.add(handler);
    }
    /**
     * Remove event listener
     */
    off(handler) {
      this.eventHandlers.delete(handler);
    }
    /**
     * Send a message to the server
     */
    send(message) {
      const isSyncMessage = message.type === "state_sync" || message.type === "trigger_event";
      if (isSyncMessage && this.state !== "playing") {
        return;
      }
      if (this.ws && this.ws.readyState === WebSocket.OPEN) {
        const data = JSON.stringify(message);
        this.ws.send(data);
        if (message.type !== "state_sync" && message.type !== "trigger_event") {
          console.log(`[Network] SENT: ${message.type}`, message);
        }
      } else if (isSyncMessage) {
      } else {
        console.warn("[Network] Cannot send message - not connected", this.ws?.readyState);
      }
    }
    /**
     * Handle incoming server message
     */
    handleMessage(data) {
      try {
        const message = JSON.parse(data);
        if (message.type === "remote_state") {
          console.log(`[Network] RECV remote_state for ${message.objectId} from P${message.player}`, message);
        } else if (message.type !== "remote_input") {
          console.log(`[Network] RECV: ${message.type}`, message);
        }
        switch (message.type) {
          case "room_created":
            this.roomCode = message.roomCode;
            this.playerNumber = 1;
            this.state = "in_room";
            break;
          case "room_joined":
            this.roomCode = message.roomCode;
            this.playerNumber = message.playerNumber;
            this.state = "in_room";
            break;
          case "game_start":
            this.playerNumber = message.yourPlayer;
            this.state = "playing";
            break;
          case "error":
            console.error("[Network] Server error:", message.message);
            break;
        }
        this.eventHandlers.forEach((handler) => handler(message));
      } catch (error) {
        console.error("[Network] Failed to parse message:", error);
      }
    }
  };
  var network = new NetworkManager();

  // src/multiplayer/MultiplayerLobby.ts
  var MultiplayerLobby = class {
    constructor() {
      __publicField(this, "container", null);
      __publicField(this, "onGameStart", null);
      // UI Components
      __publicField(this, "panel");
      __publicField(this, "titleLabel");
      __publicField(this, "statusLabel");
      __publicField(this, "createButton");
      __publicField(this, "roomCodeEdit");
      __publicField(this, "joinButton");
      __publicField(this, "roomCodeLabel");
      __publicField(this, "readyButton");
      this.panel = new TPanel("LobbyPanel", 8, 6, 16, 12);
      this.panel.style.backgroundColor = "rgba(26, 26, 46, 0.95)";
      this.panel.style.borderColor = "#4fc3f7";
      this.panel.style.borderWidth = 2;
      this.titleLabel = new TLabel("TitleLabel", 9, 7, "\u{1F3AE} Multiplayer");
      this.titleLabel.style.color = "#ffffff";
      this.titleLabel.style.backgroundColor = "transparent";
      this.titleLabel.style.fontSize = 24;
      this.statusLabel = new TLabel("StatusLabel", 9, 9, "Connecting to server...");
      this.statusLabel.style.color = "#888888";
      this.statusLabel.style.backgroundColor = "transparent";
      this.statusLabel.style.fontSize = 14;
      this.createButton = new TButton("CreateButton", 9, 11, 14, 2);
      this.createButton.caption = "Create Room";
      this.createButton.style.backgroundColor = "#4fc3f7";
      this.createButton.style.color = "#000000";
      this.roomCodeEdit = new TEdit("RoomCodeEdit", 9, 14, 8, 2);
      this.roomCodeEdit.placeholder = "CODE";
      this.roomCodeEdit.maxLength = 6;
      this.roomCodeEdit.style.backgroundColor = "#ffffff";
      this.joinButton = new TButton("JoinButton", 18, 14, 5, 2);
      this.joinButton.caption = "Join";
      this.joinButton.style.backgroundColor = "#ff8a65";
      this.joinButton.style.color = "#000000";
      this.roomCodeLabel = new TLabel("RoomCodeLabel", 9, 11, "");
      this.roomCodeLabel.style.color = "#4fc3f7";
      this.roomCodeLabel.style.backgroundColor = "transparent";
      this.roomCodeLabel.style.fontSize = 28;
      this.readyButton = new TButton("ReadyButton", 9, 14, 14, 2);
      this.readyButton.caption = "Ready!";
      this.readyButton.style.backgroundColor = "#66bb6a";
      this.readyButton.style.color = "#ffffff";
      network.on(this.handleServerMessage.bind(this));
    }
    /**
     * Show the lobby overlay
     */
    async show(container, onGameStart) {
      this.container = container;
      this.onGameStart = onGameStart;
      this.statusLabel.text = "Connecting to server...";
      try {
        await network.connect();
        this.statusLabel.text = "Connected! Create or join a room.";
      } catch (error) {
        this.statusLabel.text = "Failed to connect to server";
        console.error("Connection failed:", error);
      }
      this.render();
    }
    /**
     * Hide the lobby overlay
     */
    hide() {
      if (this.container) {
        const overlay = this.container.querySelector(".multiplayer-lobby-overlay");
        if (overlay) {
          overlay.remove();
        }
      }
    }
    /**
     * Handle server messages
     */
    handleServerMessage(msg) {
      switch (msg.type) {
        case "room_created":
          this.roomCodeLabel.text = `Room: ${msg.roomCode}`;
          this.statusLabel.text = "Waiting for opponent...";
          this.render();
          break;
        case "room_joined":
          this.roomCodeLabel.text = `Room: ${msg.roomCode}`;
          this.statusLabel.text = "Joined! Click Ready when ready.";
          this.render();
          break;
        case "player_joined":
          this.statusLabel.text = "Opponent joined! Click Ready when ready.";
          this.render();
          break;
        case "player_left":
          this.statusLabel.text = "Opponent left. Waiting for new player...";
          this.render();
          break;
        case "game_start":
          this.statusLabel.text = "Game starting!";
          setTimeout(() => {
            this.hide();
            if (this.onGameStart) {
              this.onGameStart(msg.yourPlayer, msg.seed);
            }
          }, 500);
          break;
        case "error":
          this.statusLabel.text = `Error: ${msg.message}`;
          this.render();
          break;
      }
    }
    /**
     * Render the lobby UI
     */
    render() {
      if (!this.container) return;
      this.hide();
      const overlay = document.createElement("div");
      overlay.className = "multiplayer-lobby-overlay";
      overlay.style.cssText = `
            position: absolute;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            display: flex;
            justify-content: center;
            align-items: center;
            background: rgba(0, 0, 0, 0.7);
            z-index: 1000;
        `;
      const panelEl = document.createElement("div");
      panelEl.style.cssText = `
            width: 320px;
            padding: 24px;
            background: ${this.panel.style.backgroundColor};
            border: ${this.panel.style.borderWidth}px solid ${this.panel.style.borderColor};
            border-radius: 12px;
            display: flex;
            flex-direction: column;
            gap: 16px;
        `;
      const titleEl = document.createElement("div");
      titleEl.textContent = this.titleLabel.text;
      titleEl.style.cssText = `
            font-size: ${this.titleLabel.style.fontSize}px;
            color: ${this.titleLabel.style.color};
            text-align: center;
            font-weight: bold;
        `;
      panelEl.appendChild(titleEl);
      const statusEl = document.createElement("div");
      statusEl.textContent = this.statusLabel.text;
      statusEl.style.cssText = `
            font-size: ${this.statusLabel.style.fontSize}px;
            color: ${this.statusLabel.style.color};
            text-align: center;
        `;
      panelEl.appendChild(statusEl);
      if (network.state === "connected") {
        const createBtn = this.createButtonElement(this.createButton, () => {
          network.createRoom();
        });
        panelEl.appendChild(createBtn);
        const divider = document.createElement("div");
        divider.textContent = "\u2014 or \u2014";
        divider.style.cssText = "text-align: center; color: #666; font-size: 12px;";
        panelEl.appendChild(divider);
        const joinRow = document.createElement("div");
        joinRow.style.cssText = "display: flex; gap: 8px;";
        const codeInput = document.createElement("input");
        codeInput.type = "text";
        codeInput.placeholder = this.roomCodeEdit.placeholder;
        codeInput.maxLength = this.roomCodeEdit.maxLength;
        codeInput.style.cssText = `
                flex: 1;
                padding: 12px;
                font-size: 16px;
                text-transform: uppercase;
                border: 1px solid #ccc;
                border-radius: 4px;
                text-align: center;
            `;
        codeInput.oninput = () => {
          this.roomCodeEdit.text = codeInput.value.toUpperCase();
        };
        joinRow.appendChild(codeInput);
        const joinBtn = this.createButtonElement(this.joinButton, () => {
          if (this.roomCodeEdit.text.length > 0) {
            network.joinRoom(this.roomCodeEdit.text);
          }
        });
        joinBtn.style.flex = "0 0 auto";
        joinRow.appendChild(joinBtn);
        panelEl.appendChild(joinRow);
      } else if (network.state === "in_room") {
        const codeEl = document.createElement("div");
        codeEl.textContent = this.roomCodeLabel.text;
        codeEl.style.cssText = `
                font-size: ${this.roomCodeLabel.style.fontSize}px;
                color: ${this.roomCodeLabel.style.color};
                text-align: center;
                font-weight: bold;
                font-family: monospace;
            `;
        panelEl.appendChild(codeEl);
        const readyBtn = this.createButtonElement(this.readyButton, () => {
          network.ready();
          this.statusLabel.text = "Waiting for opponent to be ready...";
          this.render();
        });
        panelEl.appendChild(readyBtn);
      }
      overlay.appendChild(panelEl);
      this.container.appendChild(overlay);
    }
    /**
     * Create a button element from TButton
     */
    createButtonElement(btn, onClick) {
      const el = document.createElement("button");
      el.textContent = btn.caption;
      el.style.cssText = `
            padding: 12px 24px;
            font-size: 16px;
            font-weight: bold;
            color: ${btn.style.color};
            background: ${btn.style.backgroundColor};
            border: none;
            border-radius: 4px;
            cursor: pointer;
            transition: opacity 0.2s;
        `;
      el.onmouseover = () => el.style.opacity = "0.9";
      el.onmouseout = () => el.style.opacity = "1";
      el.onclick = onClick;
      return el;
    }
  };
  var lobby = new MultiplayerLobby();

  // src/multiplayer/InputSyncer.ts
  var RemotePaddle = class {
    constructor(initialY = 10, boundsTop = 0, boundsBottom = 24) {
      __publicField(this, "y", 0);
      __publicField(this, "velocity", 0);
      __publicField(this, "speed", 0.3);
      __publicField(this, "targetY", null);
      __publicField(this, "correctionRate", 0.15);
      __publicField(this, "boundsTop", 0);
      __publicField(this, "boundsBottom", 24);
      this.y = initialY;
      this.boundsTop = boundsTop;
      this.boundsBottom = boundsBottom;
    }
    /**
     * Handle remote input event (key press/release)
     */
    onRemoteInput(key, action) {
      if (action === "down") {
        if (key === "w" || key === "KeyW" || key === "ArrowUp") {
          this.velocity = -this.speed;
        }
        if (key === "s" || key === "KeyS" || key === "ArrowDown") {
          this.velocity = +this.speed;
        }
      } else {
        this.velocity = 0;
      }
    }
    /**
     * Handle position sync (periodic correction)
     */
    onPositionSync(y, velocity) {
      this.targetY = y;
      this.velocity = velocity;
    }
    /**
     * Update paddle position (call every frame)
     */
    update(paddleHeight) {
      this.y += this.velocity;
      if (this.targetY !== null) {
        const error = this.targetY - this.y;
        if (Math.abs(error) > 0.1) {
          this.y += error * this.correctionRate;
        } else {
          this.targetY = null;
        }
      }
      this.y = Math.max(this.boundsTop, Math.min(this.boundsBottom - paddleHeight, this.y));
      return this.y;
    }
  };
  var InputSyncer = class {
    constructor() {
      __publicField(this, "remotePaddle");
      __publicField(this, "_localPlayerNumber", 1);
      __publicField(this, "opponentPlayerNumber", 2);
      __publicField(this, "positionSyncInterval", null);
      __publicField(this, "localPaddleGetter", null);
      this.remotePaddle = new RemotePaddle();
      network.on(this.handleServerMessage.bind(this));
    }
    /**
     * Initialize with player assignment
     */
    init(playerNumber, boundsTop, boundsBottom) {
      this._localPlayerNumber = playerNumber;
      this.opponentPlayerNumber = playerNumber === 1 ? 2 : 1;
      this.remotePaddle = new RemotePaddle(10, boundsTop, boundsBottom);
    }
    /**
     * Set getter for local paddle position (for sync)
     */
    setLocalPaddleGetter(getter) {
      this.localPaddleGetter = getter;
    }
    /**
     * Start periodic position sync
     */
    startPositionSync(intervalMs = 200) {
      this.stopPositionSync();
      this.positionSyncInterval = window.setInterval(() => {
        if (this.localPaddleGetter) {
          const { y, velocity } = this.localPaddleGetter();
          network.sendStateSync("paddle" + this._localPlayerNumber, { y, velocity });
        }
      }, intervalMs);
    }
    /**
     * Stop position sync
     */
    stopPositionSync() {
      if (this.positionSyncInterval !== null) {
        clearInterval(this.positionSyncInterval);
        this.positionSyncInterval = null;
      }
    }
    /**
     * Call when local player presses a key
     */
    onLocalInput(key, action) {
      network.sendInput(key, action);
    }
    /**
     * Update remote paddle (call every frame)
     */
    updateRemotePaddle(paddleHeight) {
      return this.remotePaddle.update(paddleHeight);
    }
    /**
     * Get current remote paddle Y position
     */
    getRemotePaddleY() {
      return this.remotePaddle.y;
    }
    /**
     * Get local player number
     */
    getLocalPlayerNumber() {
      return this._localPlayerNumber;
    }
    /**
     * Handle incoming server messages
     */
    handleServerMessage(msg) {
      switch (msg.type) {
        case "remote_input":
          if (msg.player === this.opponentPlayerNumber) {
            this.remotePaddle.onRemoteInput(msg.key, msg.action);
          }
          break;
        case "remote_state":
          if (msg.player === this.opponentPlayerNumber && msg.objectId === "paddle" + this.opponentPlayerNumber) {
            this.remotePaddle.onPositionSync(msg.state.y, msg.state.velocity);
          }
          break;
      }
    }
  };
  var inputSyncer = new InputSyncer();

  // src/multiplayer/CollisionSyncer.ts
  var CollisionSyncer = class {
    constructor() {
      __publicField(this, "localPlayerNumber", 1);
      __publicField(this, "onBallStateUpdate", null);
      __publicField(this, "onScoreUpdate", null);
      network.on(this.handleServerMessage.bind(this));
    }
    /**
     * Initialize with player assignment
     */
    init(playerNumber) {
      this.localPlayerNumber = playerNumber;
    }
    /**
     * Set callback for when ball state is updated by remote
     */
    onBallUpdate(callback) {
      this.onBallStateUpdate = callback;
    }
    /**
     * Set callback for when score is updated
     */
    onScore(callback) {
      this.onScoreUpdate = callback;
    }
    /**
     * Call when ball collides with LOCAL player's paddle
     * Only the paddle owner should call this!
     */
    sendPaddleCollision(ball) {
      network.sendStateSync("ball", ball);
    }
    /**
     * Call when ball exits on opponent's side (local player scored)
     * 
     * Logic:
     * - Player 1 owns left paddle → scores when ball exits RIGHT
     * - Player 2 owns right paddle → scores when ball exits LEFT
     */
    sendScore(exitSide) {
      const scorer = exitSide === "left" ? 2 : 1;
      if (scorer === this.localPlayerNumber) {
        network.triggerRemoteEvent("stage", "score", { scorer });
      }
    }
    /**
     * Check if local player should handle collision for a paddle
     * 
     * Player 1 owns left paddle, Player 2 owns right paddle
     */
    isLocalPaddle(paddleSide) {
      if (this.localPlayerNumber === 1) {
        return paddleSide === "left";
      } else {
        return paddleSide === "right";
      }
    }
    /**
     * Get local player number
     */
    getLocalPlayerNumber() {
      return this.localPlayerNumber;
    }
    /**
     * Handle server messages
     */
    handleServerMessage(msg) {
      switch (msg.type) {
        case "remote_state":
          if (msg.objectId === "ball" && this.onBallStateUpdate) {
            this.onBallStateUpdate(msg.state);
          }
          break;
        case "remote_event":
          if (msg.eventName === "score" && this.onScoreUpdate) {
            this.onScoreUpdate(msg.params.scorer);
          }
          break;
      }
    }
  };
  var collisionSyncer = new CollisionSyncer();

  // src/components/TGameServer.ts
  var TGameServer = class extends TWindow {
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 3, 1);
      // Connection settings
      __publicField(this, "serverUrl", "ws://localhost:3000");
      __publicField(this, "autoConnect", false);
      // Runtime state (not persisted)
      __publicField(this, "_connected", false);
      __publicField(this, "_roomCode", "");
      __publicField(this, "_playerNumber", null);
      __publicField(this, "_isHost", false);
      __publicField(this, "_lastError", "");
      // Event callback (set by Editor at runtime)
      __publicField(this, "eventCallback", null);
      this.style.backgroundColor = "#673ab7";
      this.style.borderColor = "#512da8";
      this.style.borderWidth = 2;
      this.style.color = "#ffffff";
    }
    // Getters for runtime state
    get connected() {
      return this._connected;
    }
    get roomCode() {
      return this._roomCode;
    }
    get playerNumber() {
      return this._playerNumber;
    }
    get isHost() {
      return this._isHost;
    }
    get lastError() {
      return this._lastError;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "serverUrl", label: "Server URL", type: "string", group: "Server" },
        { name: "autoConnect", label: "Auto Connect", type: "boolean", group: "Server" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        serverUrl: this.serverUrl,
        autoConnect: this.autoConnect,
        Tasks: this.Tasks
      };
    }
    /**
     * Set the event callback for triggering tasks
     */
    setEventCallback(callback) {
      this.eventCallback = callback;
    }
    /**
     * Connect to the game server
     */
    async connect() {
      try {
        network.serverUrl = this.serverUrl;
        await network.connect();
        this._connected = true;
        this.triggerEvent("onConnected");
      } catch (error) {
        this._lastError = error.message || "Connection failed";
        this.triggerEvent("onError", { message: this._lastError });
      }
    }
    /**
     * Disconnect from the server
     */
    disconnect() {
      network.disconnect();
      this._connected = false;
      this._roomCode = "";
      this._playerNumber = null;
      this._isHost = false;
      this.triggerEvent("onDisconnected");
    }
    /**
     * Create a new game room
     */
    createRoom() {
      if (!this._connected) {
        console.warn("[TGameServer] Not connected - cannot create room");
        return;
      }
      this._isHost = true;
      network.createRoom();
      this.setupNetworkListeners();
    }
    /**
     * Join an existing room
     */
    joinRoom(roomCode) {
      if (!this._connected) {
        console.warn("[TGameServer] Not connected - cannot join room");
        return;
      }
      this._isHost = false;
      network.joinRoom(roomCode);
      this.setupNetworkListeners();
    }
    /**
     * Signal that player is ready
     */
    ready() {
      if (!this._connected || !this._roomCode) {
        console.warn("[TGameServer] Not in a room - cannot signal ready");
        return;
      }
      network.ready();
    }
    /**
     * Setup network event listeners
     */
    setupNetworkListeners() {
      network.on((msg) => {
        switch (msg.type) {
          case "room_created":
            this._roomCode = msg.roomCode;
            this._playerNumber = 1;
            this.triggerEvent("onRoomCreated", { roomCode: msg.roomCode });
            break;
          case "room_joined":
            this._roomCode = msg.roomCode;
            this._playerNumber = msg.playerNumber;
            this.triggerEvent("onRoomJoined", { roomCode: msg.roomCode, playerNumber: msg.playerNumber });
            break;
          case "player_joined":
            this.triggerEvent("onPlayerJoined", { playerNumber: msg.playerNumber });
            break;
          case "player_left":
            this.triggerEvent("onPlayerLeft", { playerNumber: msg.playerNumber });
            break;
          case "game_start":
            this._playerNumber = msg.yourPlayer;
            this.triggerEvent("onGameStart", { playerNumber: msg.yourPlayer, seed: msg.seed });
            break;
          case "error":
            this._lastError = msg.message;
            this.triggerEvent("onError", { message: msg.message });
            break;
        }
      });
    }
    /**
     * Trigger an event (calls the event callback)
     */
    triggerEvent(eventName, data) {
      console.log(`[TGameServer] Event: ${eventName}`, data);
      if (this.eventCallback) {
        this.eventCallback(eventName, data);
      }
    }
    /**
     * Start (called when game runs) - auto-connect if enabled
     */
    start(callback) {
      this.eventCallback = callback;
      if (this.autoConnect) {
        this.connect();
      }
    }
    /**
     * Stop (called when game stops)
     */
    stop() {
      if (this._connected) {
        this.disconnect();
      }
      this.eventCallback = null;
    }
  };

  // src/components/TDropdown.ts
  var TDropdown = class extends TWindow {
    constructor(name, x, y, width = 8, height = 2) {
      super(name, x, y, width, height);
      __publicField(this, "options");
      __publicField(this, "selectedIndex");
      __publicField(this, "selectedValue");
      this.options = ["Option 1", "Option 2", "Option 3"];
      this.selectedIndex = 0;
      this.selectedValue = this.options[0];
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#cccccc";
      this.style.borderWidth = 1;
      this.style.color = "#000000";
    }
    /**
     * Set selected value by string
     */
    selectValue(value) {
      const index = this.options.indexOf(value);
      if (index !== -1) {
        this.selectedIndex = index;
        this.selectedValue = value;
      }
    }
    /**
     * Set selected value by index
     */
    selectIndex(index) {
      if (index >= 0 && index < this.options.length) {
        this.selectedIndex = index;
        this.selectedValue = this.options[index];
      }
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "options", label: "Options (comma-separated)", type: "string", group: "Specifics" },
        { name: "selectedIndex", label: "Selected Index", type: "number", group: "Specifics" },
        { name: "selectedValue", label: "Selected Value", type: "string", group: "Specifics", readonly: true },
        { name: "style.color", label: "Text Color", type: "color", group: "Style" },
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        options: this.options,
        selectedIndex: this.selectedIndex,
        selectedValue: this.selectedValue
      };
    }
  };

  // src/components/TCheckbox.ts
  var TCheckbox = class extends TTextControl {
    constructor(name, x, y, width = 8, height = 2) {
      super(name, x, y, width, height);
      __publicField(this, "checked");
      __publicField(this, "label");
      this.checked = false;
      this.label = name;
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#cccccc";
      this.style.borderWidth = 1;
      this.style.color = "#000000";
      this.style.textAlign = "left";
    }
    /**
     * Toggle the checkbox state
     */
    toggle() {
      this.checked = !this.checked;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "checked", label: "Checked", type: "checkbox", group: "Specifics" },
        { name: "label", label: "Label", type: "string", group: "Specifics" }
        // Inherits styles from TTextControl
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        checked: this.checked,
        label: this.label
      };
    }
  };

  // src/components/TColorPicker.ts
  var TColorPicker = class extends TWindow {
    constructor(name, x, y, width = 8, height = 2) {
      super(name, x, y, width, height);
      __publicField(this, "color");
      this.color = "#000000";
      this.style.backgroundColor = this.color;
      this.style.borderColor = "#cccccc";
      this.style.borderWidth = 1;
    }
    /**
     * Set color and update background
     */
    setColor(color) {
      this.color = color;
      this.style.backgroundColor = color;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "color", label: "Color", type: "color", group: "Specifics" },
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        color: this.color
      };
    }
  };

  // src/components/TNumberInput.ts
  var TNumberInput = class extends TTextControl {
    constructor(name, x, y, width = 8, height = 2) {
      super(name, x, y, width, height);
      __publicField(this, "value");
      __publicField(this, "min");
      __publicField(this, "max");
      __publicField(this, "step");
      this.value = 0;
      this.min = -Infinity;
      this.max = Infinity;
      this.step = 1;
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#cccccc";
      this.style.borderWidth = 1;
      this.style.color = "#000000";
    }
    /**
     * Set value with constraint validation
     */
    setValue(value) {
      this.value = Math.max(this.min, Math.min(this.max, value));
    }
    /**
     * Increment value by step
     */
    increment() {
      this.setValue(this.value + this.step);
    }
    /**
     * Decrement value by step
     */
    decrement() {
      this.setValue(this.value - this.step);
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "value", label: "Value", type: "number", group: "Specifics" },
        { name: "min", label: "Min", type: "number", group: "Specifics" },
        { name: "max", label: "Max", type: "number", group: "Specifics" },
        { name: "step", label: "Step", type: "number", group: "Specifics" }
        // Inherits styles from TTextControl
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        value: this.value,
        min: this.min,
        max: this.max,
        step: this.step
      };
    }
  };

  // src/components/TTabControl.ts
  var TTabControl = class extends TWindow {
    constructor(name, x, y, width = 20, height = 10) {
      super(name, x, y, width, height);
      __publicField(this, "tabs");
      __publicField(this, "activeTabIndex");
      __publicField(this, "activeTabName");
      this.tabs = ["Tab 1", "Tab 2", "Tab 3"];
      this.activeTabIndex = 0;
      this.activeTabName = this.tabs[0];
      this.style.backgroundColor = "#2a2a2a";
      this.style.borderColor = "#444";
      this.style.borderWidth = 1;
      this.style.color = "#ffffff";
    }
    /**
     * Switch to a tab by index
     */
    selectTabByIndex(index) {
      if (index >= 0 && index < this.tabs.length) {
        this.activeTabIndex = index;
        this.activeTabName = this.tabs[index];
      }
    }
    /**
     * Switch to a tab by name
     */
    selectTabByName(name) {
      const index = this.tabs.indexOf(name);
      if (index !== -1) {
        this.activeTabIndex = index;
        this.activeTabName = name;
      }
    }
    /**
     * Add a new tab
     */
    addTab(name) {
      if (!this.tabs.includes(name)) {
        this.tabs.push(name);
      }
    }
    /**
     * Remove a tab by name
     */
    removeTab(name) {
      const index = this.tabs.indexOf(name);
      if (index !== -1) {
        this.tabs.splice(index, 1);
        if (this.activeTabIndex >= this.tabs.length) {
          this.activeTabIndex = Math.max(0, this.tabs.length - 1);
          this.activeTabName = this.tabs[this.activeTabIndex] || "";
        }
      }
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "tabs", label: "Tabs (comma-separated)", type: "string", group: "Specifics" },
        { name: "activeTabIndex", label: "Active Tab Index", type: "number", group: "Specifics" },
        { name: "activeTabName", label: "Active Tab Name", type: "string", group: "Specifics", readonly: true },
        { name: "style.color", label: "Text Color", type: "color", group: "Style" },
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        tabs: this.tabs,
        activeTabIndex: this.activeTabIndex,
        activeTabName: this.activeTabName
      };
    }
  };

  // src/components/TInspectorTemplate.ts
  var TInspectorTemplate = class extends TWindow {
    constructor(name, x, y, width = 15, height = 20) {
      super(name, x, y, width, height);
      /** The current layout configuration */
      __publicField(this, "layoutConfig");
      /** Example properties demonstrating all supported types */
      __publicField(this, "exampleProperties", [
        // Identity Group
        { name: "name", label: "Name", type: "string", group: "Identity" },
        { name: "id", label: "ID", type: "string", group: "Identity", readonly: true },
        // Position & Size Group
        { name: "x", label: "X Position", type: "number", group: "Position" },
        { name: "y", label: "Y Position", type: "number", group: "Position" },
        { name: "width", label: "Breite", type: "number", group: "Position" },
        { name: "height", label: "H\xF6he", type: "number", group: "Position" },
        // Style Group
        { name: "backgroundColor", label: "Hintergrund", type: "color", group: "Style" },
        { name: "borderColor", label: "Rahmenfarbe", type: "color", group: "Style" },
        { name: "fontFamily", label: "Schriftart", type: "select", options: ["Arial", "Verdana", "Times New Roman"], group: "Style" },
        { name: "fontSize", label: "Schriftgr\xF6\xDFe", type: "number", group: "Style" },
        // Display Group
        { name: "visible", label: "Sichtbar", type: "boolean", group: "Display" },
        { name: "enabled", label: "Aktiviert", type: "boolean", group: "Display" },
        // Content Group
        { name: "text", label: "Text", type: "string", group: "Content" },
        { name: "caption", label: "Beschriftung", type: "string", group: "Content" }
      ]);
      this.className = "TInspectorTemplate";
      this.style.backgroundColor = "#2a2a2a";
      this.style.borderColor = "#444444";
      this.style.borderWidth = 1;
      this.layoutConfig = this.createDefaultLayout();
    }
    /**
     * Creates default layout configuration from example properties
     */
    createDefaultLayout() {
      const groups = /* @__PURE__ */ new Map();
      let groupOrder = 0;
      this.exampleProperties.forEach((prop) => {
        if (prop.group && !groups.has(prop.group)) {
          groups.set(prop.group, groupOrder++);
        }
      });
      const groupConfigs = [];
      groups.forEach((order, id) => {
        groupConfigs.push({
          id: id.toLowerCase().replace(/\s+/g, "_"),
          label: id,
          order,
          collapsed: order > 1
          // Collapse groups after first two
        });
      });
      const properties = {};
      this.exampleProperties.forEach((prop, index) => {
        const groupId = prop.group?.toLowerCase().replace(/\s+/g, "_") || "default";
        properties[prop.name] = {
          name: prop.name,
          label: prop.label,
          type: prop.type,
          visible: true,
          groupId,
          order: index
        };
      });
      return {
        version: "1.0",
        groups: groupConfigs,
        properties
      };
    }
    /**
     * Get properties for Inspector when this component is selected
     */
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "title", label: "Titel", type: "string", group: "Template" }
      ];
    }
    /**
     * Export layout configuration as JSON string
     */
    exportLayoutJSON() {
      return JSON.stringify(this.layoutConfig, null, 2);
    }
    /**
     * Import layout configuration from JSON object
     */
    importLayout(config) {
      this.layoutConfig = config;
    }
    toJSON() {
      return {
        ...super.toJSON(),
        layoutConfig: this.layoutConfig,
        exampleProperties: this.exampleProperties
      };
    }
  };

  // src/components/TDialogRoot.ts
  var TDialogRoot = class extends TWindow {
    constructor(name, x = 100, y = 100, width = 400, height = 300) {
      super(name, x, y, width, height);
      // Dialog appearance - using caption property for title
      __publicField(this, "_title", "Dialog");
      // Dialog behavior
      __publicField(this, "modal", true);
      // Block background?
      __publicField(this, "closable", true);
      // Show close button?
      __publicField(this, "draggableAtRuntime", true);
      // Draggable at runtime?
      __publicField(this, "centerOnShow", true);
      // Center when shown?
      // Events (Task names to execute)
      __publicField(this, "onShowTask", "");
      // Task to run when dialog shows
      __publicField(this, "onCloseTask", "");
      // Task to run when dialog closes
      __publicField(this, "onCancelTask", "");
      // Task to run when cancelled
      // Internal state for runtime
      __publicField(this, "_overlayElement", null);
      __publicField(this, "_dialogElement", null);
      __publicField(this, "_isDragging", false);
      __publicField(this, "_dragOffset", { x: 0, y: 0 });
      this.style.backgroundColor = "rgba(26, 26, 46, 0.98)";
      this.style.borderColor = "#4fc3f7";
      this.style.borderWidth = 2;
      this.style.visible = true;
      this._title = name;
    }
    // Title/Caption property
    get title() {
      return this._title;
    }
    set title(v) {
      this._title = v;
    }
    // Alias for compatibility
    get caption() {
      return this._title;
    }
    set caption(v) {
      this._title = v;
    }
    /**
     * Show the dialog
     */
    show() {
      if (this.visible) return;
      this.visible = true;
      console.log(`[TDialogRoot] Showing dialog: ${this.name}`);
      if (this.onShowTask) {
        this.triggerTask(this.onShowTask);
      }
      this.updateRuntimeVisibility();
    }
    /**
     * Hide the dialog
     */
    hide() {
      if (!this.visible) return;
      this.visible = false;
      console.log(`[TDialogRoot] Hiding dialog: ${this.name}`);
      this.updateRuntimeVisibility();
    }
    /**
     * Close the dialog (with close event)
     */
    close() {
      this.hide();
      if (this.onCloseTask) {
        this.triggerTask(this.onCloseTask);
      }
    }
    /**
     * Cancel the dialog (with cancel event)
     */
    cancel() {
      this.hide();
      if (this.onCancelTask) {
        this.triggerTask(this.onCancelTask);
      }
    }
    /**
     * Toggle dialog visibility
     */
    toggle() {
      if (this.visible) {
        this.hide();
      } else {
        this.show();
      }
    }
    /**
     * Trigger a task by name
     */
    triggerTask(taskName) {
      const event = new CustomEvent("dialog-task", {
        detail: { dialogName: this.name, taskName }
      });
      window.dispatchEvent(event);
    }
    /**
     * Check if a point is inside this dialog's bounds
     */
    containsPoint(px, py, cellSize) {
      const left = this.x * cellSize;
      const top = this.y * cellSize;
      const right = left + this.width * cellSize;
      const bottom = top + this.height * cellSize;
      return px >= left && px < right && py >= top && py < bottom;
    }
    /**
     * Check if another object overlaps with or is inside this dialog's bounds
     * An object is considered "inside" if its top-left corner is within the dialog
     */
    containsObject(obj) {
      const objX = obj.x;
      const objY = obj.y;
      const isInside = objX >= this.x && objY >= this.y && objX < this.x + this.width && objY < this.y + this.height;
      console.log(`[TDialogRoot] containsObject check: obj(${objX},${objY}) dialog(${this.x},${this.y},${this.width},${this.height}) = ${isInside}`);
      return isInside;
    }
    /**
     * Get inspector properties
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      return [
        ...baseProps,
        // Dialog Settings
        { name: "title", label: "Title", type: "string", group: "Dialog" },
        { name: "modal", label: "Modal", type: "boolean", group: "Dialog" },
        { name: "closable", label: "Closable", type: "boolean", group: "Dialog" },
        { name: "draggableAtRuntime", label: "Draggable", type: "boolean", group: "Dialog" },
        { name: "centerOnShow", label: "Center on Show", type: "boolean", group: "Dialog" },
        // Style
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" },
        { name: "style.borderWidth", label: "Border Width", type: "number", group: "Style" },
        // Events
        { name: "onShowTask", label: "On Show Task", type: "string", group: "Events" },
        { name: "onCloseTask", label: "On Close Task", type: "string", group: "Events" },
        { name: "onCancelTask", label: "On Cancel Task", type: "string", group: "Events" }
      ];
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
      const base = super.toJSON();
      return {
        ...base,
        title: this._title,
        modal: this.modal,
        closable: this.closable,
        draggableAtRuntime: this.draggableAtRuntime,
        centerOnShow: this.centerOnShow,
        onShowTask: this.onShowTask,
        onCloseTask: this.onCloseTask,
        onCancelTask: this.onCancelTask,
        style: {
          ...base.style,
          borderColor: this.style.borderColor,
          borderWidth: this.style.borderWidth
        },
        // Include children - only user-added children (not internal ones)
        children: this.children.map((child) => child.toJSON())
      };
    }
    // ========== Runtime Rendering (for GamePlayer) ==========
    /**
     * Create the DOM representation for runtime
     */
    createRuntimeElement(container) {
      if (this.modal) {
        this._overlayElement = document.createElement("div");
        this._overlayElement.className = "dialog-overlay";
        this._overlayElement.style.cssText = `
                position: fixed;
                top: 0;
                left: 0;
                width: 100%;
                height: 100%;
                background: rgba(0, 0, 0, 0.6);
                display: ${this.visible ? "flex" : "none"};
                justify-content: center;
                align-items: center;
                z-index: 1000;
            `;
        container.appendChild(this._overlayElement);
      }
      this._dialogElement = document.createElement("div");
      this._dialogElement.className = "dialog-root";
      this._dialogElement.style.cssText = `
            position: ${this.modal ? "relative" : "absolute"};
            left: ${this.modal ? "auto" : this.x + "px"};
            top: ${this.modal ? "auto" : this.y + "px"};
            width: ${this.width}px;
            min-height: ${this.height}px;
            background: ${this.style.backgroundColor};
            border: ${this.style.borderWidth}px solid ${this.style.borderColor};
            border-radius: 12px;
            display: ${this.visible ? "flex" : "none"};
            flex-direction: column;
            z-index: 1001;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
      const header = document.createElement("div");
      header.style.cssText = `
            display: flex;
            justify-content: space-between;
            align-items: center;
            padding: 16px;
            border-bottom: 1px solid ${this.style.borderColor};
            cursor: ${this.draggableAtRuntime ? "move" : "default"};
        `;
      const titleEl = document.createElement("span");
      titleEl.textContent = this._title;
      titleEl.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
        `;
      header.appendChild(titleEl);
      if (this.closable) {
        const closeBtn = document.createElement("button");
        closeBtn.textContent = "\u2715";
        closeBtn.style.cssText = `
                background: none;
                border: none;
                color: #888;
                font-size: 18px;
                cursor: pointer;
                padding: 4px 8px;
                border-radius: 4px;
                transition: all 0.2s;
            `;
        closeBtn.onmouseover = () => closeBtn.style.color = "#fff";
        closeBtn.onmouseout = () => closeBtn.style.color = "#888";
        closeBtn.onclick = () => this.close();
        header.appendChild(closeBtn);
      }
      this._dialogElement.appendChild(header);
      if (this.draggableAtRuntime) {
        this.setupDragging(header);
      }
      const content = document.createElement("div");
      content.className = "dialog-content";
      content.style.cssText = `
            flex: 1;
            padding: 16px;
            overflow: auto;
            position: relative;
        `;
      this._dialogElement.appendChild(content);
      if (this._overlayElement) {
        this._overlayElement.appendChild(this._dialogElement);
      } else {
        container.appendChild(this._dialogElement);
      }
      return this._dialogElement;
    }
    /**
     * Get the content container for children
     */
    getContentContainer() {
      return this._dialogElement?.querySelector(".dialog-content") || null;
    }
    /**
     * Setup drag behavior for runtime
     */
    setupDragging(handle) {
      handle.onmousedown = (e) => {
        if (!this._dialogElement || !this.draggableAtRuntime) return;
        this._isDragging = true;
        const rect = this._dialogElement.getBoundingClientRect();
        this._dragOffset = {
          x: e.clientX - rect.left,
          y: e.clientY - rect.top
        };
        document.onmousemove = (e2) => {
          if (!this._isDragging || !this._dialogElement) return;
          this._dialogElement.style.position = "fixed";
          this._dialogElement.style.left = e2.clientX - this._dragOffset.x + "px";
          this._dialogElement.style.top = e2.clientY - this._dragOffset.y + "px";
        };
        document.onmouseup = () => {
          this._isDragging = false;
          document.onmousemove = null;
          document.onmouseup = null;
        };
      };
    }
    /**
     * Update runtime visibility
     */
    updateRuntimeVisibility() {
      if (this._overlayElement) {
        this._overlayElement.style.display = this.visible ? "flex" : "none";
      }
      if (this._dialogElement) {
        this._dialogElement.style.display = this.visible ? "flex" : "none";
      }
    }
  };

  // src/components/TInfoWindow.ts
  var TInfoWindow = class extends TWindow {
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 320, 180);
      // Content
      __publicField(this, "title", "Information");
      __publicField(this, "message", "");
      __publicField(this, "icon", "\u2139\uFE0F");
      // Buttons
      __publicField(this, "showCancelButton", true);
      __publicField(this, "cancelButtonText", "Abbrechen");
      __publicField(this, "showConfirmButton", false);
      __publicField(this, "confirmButtonText", "OK");
      // Spinner/Loading
      __publicField(this, "showSpinner", false);
      // Auto-close
      __publicField(this, "autoClose", false);
      __publicField(this, "autoCloseDelay", 3e3);
      // ms
      // Styling
      __publicField(this, "borderRadius", 12);
      __publicField(this, "padding", 20);
      __publicField(this, "iconSize", 32);
      // Events (Task names)
      __publicField(this, "onCancelTask", "");
      __publicField(this, "onConfirmTask", "");
      __publicField(this, "onAutoCloseTask", "");
      // Internal
      __publicField(this, "_element", null);
      __publicField(this, "_overlayElement", null);
      __publicField(this, "_autoCloseTimeout", null);
      this.style.backgroundColor = "#2a2a4a";
      this.style.borderColor = "#4fc3f7";
      this.style.borderWidth = 2;
      this.style.visible = false;
      this.title = name;
    }
    /**
     * Show the info window with a message
     */
    showMessage(message, options) {
      this.message = message;
      if (options) {
        if (options.title !== void 0) this.title = options.title;
        if (options.icon !== void 0) this.icon = options.icon;
        if (options.showSpinner !== void 0) this.showSpinner = options.showSpinner;
        if (options.autoClose !== void 0) this.autoClose = options.autoClose;
        if (options.autoCloseDelay !== void 0) this.autoCloseDelay = options.autoCloseDelay;
      }
      this.visible = true;
      this.updateElement();
      if (this.autoClose) {
        this.startAutoClose();
      }
      console.log(`[TInfoWindow] Showing: ${this.title} - ${message}`);
    }
    /**
     * Update the displayed message
     */
    setMessage(message) {
      this.message = message;
      this.updateElement();
    }
    /**
     * Hide the info window
     */
    hide() {
      this.visible = false;
      this.cancelAutoClose();
      this.updateElement();
      console.log(`[TInfoWindow] Hidden: ${this.title}`);
    }
    /**
     * Handle cancel button click
     */
    handleCancel() {
      this.hide();
      if (this.onCancelTask) {
        this.triggerTask(this.onCancelTask);
      }
    }
    /**
     * Handle confirm button click
     */
    handleConfirm() {
      this.hide();
      if (this.onConfirmTask) {
        this.triggerTask(this.onConfirmTask);
      }
    }
    /**
     * Start auto-close timer
     */
    startAutoClose() {
      this.cancelAutoClose();
      this._autoCloseTimeout = window.setTimeout(() => {
        this.hide();
        if (this.onAutoCloseTask) {
          this.triggerTask(this.onAutoCloseTask);
        }
      }, this.autoCloseDelay);
    }
    /**
     * Cancel auto-close timer
     */
    cancelAutoClose() {
      if (this._autoCloseTimeout !== null) {
        clearTimeout(this._autoCloseTimeout);
        this._autoCloseTimeout = null;
      }
    }
    /**
     * Trigger a task by name
     */
    triggerTask(taskName) {
      const event = new CustomEvent("infowindow-task", {
        detail: { windowName: this.name, taskName }
      });
      window.dispatchEvent(event);
    }
    /**
     * Update the DOM element
     */
    updateElement() {
      if (this._overlayElement) {
        this._overlayElement.style.display = this.visible ? "flex" : "none";
      }
      if (this._element) {
        const messageEl = this._element.querySelector(".info-message");
        if (messageEl) {
          messageEl.textContent = this.message;
        }
        const spinnerEl = this._element.querySelector(".info-spinner");
        if (spinnerEl) {
          spinnerEl.style.display = this.showSpinner ? "block" : "none";
        }
      }
    }
    /**
     * Get inspector properties
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      return [
        ...baseProps,
        // Content
        { name: "title", label: "Title", type: "string", group: "Content" },
        { name: "message", label: "Message", type: "string", group: "Content" },
        { name: "icon", label: "Icon", type: "string", group: "Content" },
        { name: "iconSize", label: "Icon Size", type: "number", group: "Content" },
        // Buttons
        { name: "showCancelButton", label: "Show Cancel", type: "boolean", group: "Buttons" },
        { name: "cancelButtonText", label: "Cancel Text", type: "string", group: "Buttons" },
        { name: "showConfirmButton", label: "Show Confirm", type: "boolean", group: "Buttons" },
        { name: "confirmButtonText", label: "Confirm Text", type: "string", group: "Buttons" },
        // Spinner
        { name: "showSpinner", label: "Show Spinner", type: "boolean", group: "Behavior" },
        // Auto-close
        { name: "autoClose", label: "Auto Close", type: "boolean", group: "Behavior" },
        { name: "autoCloseDelay", label: "Auto Close Delay (ms)", type: "number", group: "Behavior" },
        // Style
        { name: "borderRadius", label: "Border Radius", type: "number", group: "Style" },
        { name: "padding", label: "Padding", type: "number", group: "Style" },
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" },
        // Events
        { name: "onCancelTask", label: "On Cancel Task", type: "string", group: "Events" },
        { name: "onConfirmTask", label: "On Confirm Task", type: "string", group: "Events" },
        { name: "onAutoCloseTask", label: "On Auto Close Task", type: "string", group: "Events" }
      ];
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
      return {
        ...super.toJSON(),
        title: this.title,
        message: this.message,
        icon: this.icon,
        iconSize: this.iconSize,
        showCancelButton: this.showCancelButton,
        cancelButtonText: this.cancelButtonText,
        showConfirmButton: this.showConfirmButton,
        confirmButtonText: this.confirmButtonText,
        showSpinner: this.showSpinner,
        autoClose: this.autoClose,
        autoCloseDelay: this.autoCloseDelay,
        borderRadius: this.borderRadius,
        padding: this.padding,
        onCancelTask: this.onCancelTask,
        onConfirmTask: this.onConfirmTask,
        onAutoCloseTask: this.onAutoCloseTask
      };
    }
    // ========== Runtime Rendering ==========
    /**
     * Create the DOM representation for runtime
     */
    createRuntimeElement(container) {
      this._overlayElement = document.createElement("div");
      this._overlayElement.className = "info-window-overlay";
      this._overlayElement.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            width: 100%;
            height: 100%;
            background: rgba(0, 0, 0, 0.5);
            display: ${this.visible ? "flex" : "none"};
            justify-content: center;
            align-items: center;
            z-index: 2000;
        `;
      this._element = document.createElement("div");
      this._element.className = "info-window";
      this._element.style.cssText = `
            background: ${this.style.backgroundColor};
            border: ${this.style.borderWidth}px solid ${this.style.borderColor};
            border-radius: ${this.borderRadius}px;
            padding: ${this.padding}px;
            min-width: 280px;
            max-width: 400px;
            text-align: center;
            box-shadow: 0 8px 32px rgba(0, 0, 0, 0.4);
        `;
      const iconEl = document.createElement("div");
      iconEl.className = "info-icon";
      iconEl.textContent = this.icon;
      iconEl.style.cssText = `
            font-size: ${this.iconSize}px;
            margin-bottom: 12px;
        `;
      this._element.appendChild(iconEl);
      const titleEl = document.createElement("div");
      titleEl.className = "info-title";
      titleEl.textContent = this.title;
      titleEl.style.cssText = `
            font-size: 18px;
            font-weight: bold;
            color: #ffffff;
            margin-bottom: 12px;
        `;
      this._element.appendChild(titleEl);
      const messageEl = document.createElement("div");
      messageEl.className = "info-message";
      messageEl.textContent = this.message;
      messageEl.style.cssText = `
            font-size: 14px;
            color: #cccccc;
            margin-bottom: 16px;
            line-height: 1.5;
        `;
      this._element.appendChild(messageEl);
      const spinnerEl = document.createElement("div");
      spinnerEl.className = "info-spinner";
      spinnerEl.innerHTML = "\u27F3";
      spinnerEl.style.cssText = `
            font-size: 24px;
            color: ${this.style.borderColor};
            margin-bottom: 16px;
            animation: spin 1s linear infinite;
            display: ${this.showSpinner ? "block" : "none"};
        `;
      this._element.appendChild(spinnerEl);
      if (!document.getElementById("info-window-styles")) {
        const style = document.createElement("style");
        style.id = "info-window-styles";
        style.textContent = `
                @keyframes spin {
                    from { transform: rotate(0deg); }
                    to { transform: rotate(360deg); }
                }
            `;
        document.head.appendChild(style);
      }
      const buttonsEl = document.createElement("div");
      buttonsEl.className = "info-buttons";
      buttonsEl.style.cssText = `
            display: flex;
            gap: 12px;
            justify-content: center;
        `;
      if (this.showCancelButton) {
        const cancelBtn = document.createElement("button");
        cancelBtn.textContent = this.cancelButtonText;
        cancelBtn.style.cssText = `
                padding: 8px 20px;
                background: #6c757d;
                color: #ffffff;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                transition: background 0.2s;
            `;
        cancelBtn.onmouseover = () => cancelBtn.style.background = "#5a6268";
        cancelBtn.onmouseout = () => cancelBtn.style.background = "#6c757d";
        cancelBtn.onclick = () => this.handleCancel();
        buttonsEl.appendChild(cancelBtn);
      }
      if (this.showConfirmButton) {
        const confirmBtn = document.createElement("button");
        confirmBtn.textContent = this.confirmButtonText;
        confirmBtn.style.cssText = `
                padding: 8px 20px;
                background: #4fc3f7;
                color: #000000;
                border: none;
                border-radius: 6px;
                cursor: pointer;
                font-size: 14px;
                font-weight: bold;
                transition: background 0.2s;
            `;
        confirmBtn.onmouseover = () => confirmBtn.style.background = "#3db8f0";
        confirmBtn.onmouseout = () => confirmBtn.style.background = "#4fc3f7";
        confirmBtn.onclick = () => this.handleConfirm();
        buttonsEl.appendChild(confirmBtn);
      }
      this._element.appendChild(buttonsEl);
      this._overlayElement.appendChild(this._element);
      container.appendChild(this._overlayElement);
      return this._element;
    }
  };

  // src/components/TToast.ts
  var TToast = class extends TWindow {
    constructor(name = "Toast") {
      super(name, 0, 0, 320, 60);
      // Animation settings
      __publicField(this, "animation", "slide-left");
      __publicField(this, "position", "bottom-left");
      // Timing
      __publicField(this, "duration", 3e3);
      // ms
      __publicField(this, "maxVisible", 3);
      // Max toasts shown at once
      // Styling
      __publicField(this, "infoColor", "#2196F3");
      __publicField(this, "successColor", "#4CAF50");
      __publicField(this, "warningColor", "#FF9800");
      __publicField(this, "errorColor", "#F44336");
      __publicField(this, "textColor", "#ffffff");
      __publicField(this, "fontSize", 14);
      __publicField(this, "borderRadius", 8);
      __publicField(this, "padding", 12);
      // Internal
      __publicField(this, "_container", null);
      __publicField(this, "_toasts", []);
      __publicField(this, "_toastIdCounter", 0);
      this.style.backgroundColor = "transparent";
      this.style.borderWidth = 0;
      this.style.visible = true;
    }
    /**
     * Show a toast notification
     */
    show(message, type = "info") {
      this.ensureContainer();
      const id = ++this._toastIdCounter;
      const element = this.createToastElement(message, type, id);
      const toast = { id, message, type, element };
      this._toasts.push(toast);
      this._container.appendChild(element);
      requestAnimationFrame(() => {
        element.classList.add("toast-visible");
      });
      while (this._toasts.length > this.maxVisible) {
        this.removeToast(this._toasts[0].id);
      }
      setTimeout(() => {
        this.removeToast(id);
      }, this.duration);
      console.log(`[TToast] ${type}: ${message}`);
    }
    /**
     * Show info toast
     */
    info(message) {
      this.show(message, "info");
    }
    /**
     * Show success toast
     */
    success(message) {
      this.show(message, "success");
    }
    /**
     * Show warning toast
     */
    warning(message) {
      this.show(message, "warning");
    }
    /**
     * Show error toast
     */
    error(message) {
      this.show(message, "error");
    }
    /**
     * Clear all toasts
     */
    clear() {
      for (const toast of [...this._toasts]) {
        this.removeToast(toast.id);
      }
    }
    /**
     * Remove a specific toast
     */
    removeToast(id) {
      const index = this._toasts.findIndex((t) => t.id === id);
      if (index === -1) return;
      const toast = this._toasts[index];
      toast.element.classList.remove("toast-visible");
      toast.element.classList.add("toast-hiding");
      setTimeout(() => {
        toast.element.remove();
        this._toasts.splice(index, 1);
      }, 300);
    }
    /**
     * Ensure container exists
     */
    ensureContainer() {
      if (this._container) return;
      this._container = document.createElement("div");
      this._container.className = "toast-container";
      this._container.id = `toast-container-${this.name}`;
      const positions = {
        "bottom-left": "bottom: 20px; left: 20px;",
        "bottom-right": "bottom: 20px; right: 20px;",
        "top-left": "top: 20px; left: 20px;",
        "top-right": "top: 20px; right: 20px;"
      };
      this._container.style.cssText = `
            position: fixed;
            ${positions[this.position]}
            display: flex;
            flex-direction: column;
            gap: 10px;
            z-index: 3000;
            pointer-events: none;
        `;
      document.body.appendChild(this._container);
      this.injectStyles();
    }
    /**
     * Inject CSS animation styles
     */
    injectStyles() {
      const styleId = "toast-animation-styles";
      if (document.getElementById(styleId)) return;
      const style = document.createElement("style");
      style.id = styleId;
      style.textContent = `
            /* Toast base */
            .toast-item {
                display: flex;
                align-items: center;
                gap: 10px;
                padding: 12px 16px;
                border-radius: 8px;
                box-shadow: 0 4px 12px rgba(0, 0, 0, 0.3);
                pointer-events: auto;
                opacity: 0;
                transition: all 0.3s ease;
            }
            
            /* Slide-left animation */
            .toast-slide-left {
                transform: translateX(-100%);
            }
            .toast-slide-left.toast-visible {
                transform: translateX(0);
                opacity: 1;
            }
            .toast-slide-left.toast-hiding {
                transform: translateX(-100%);
                opacity: 0;
            }
            
            /* Slide-up animation */
            .toast-slide-up {
                transform: translateY(100%);
            }
            .toast-slide-up.toast-visible {
                transform: translateY(0);
                opacity: 1;
            }
            .toast-slide-up.toast-hiding {
                transform: translateY(100%);
                opacity: 0;
            }
            
            /* Fade animation */
            .toast-fade {
                opacity: 0;
            }
            .toast-fade.toast-visible {
                opacity: 1;
            }
            .toast-fade.toast-hiding {
                opacity: 0;
            }
            
            /* Bounce animation */
            .toast-bounce {
                transform: scale(0.5);
                opacity: 0;
            }
            .toast-bounce.toast-visible {
                transform: scale(1);
                opacity: 1;
                animation: toastBounce 0.4s ease;
            }
            .toast-bounce.toast-hiding {
                transform: scale(0.5);
                opacity: 0;
            }
            
            @keyframes toastBounce {
                0% { transform: scale(0.5); }
                50% { transform: scale(1.1); }
                70% { transform: scale(0.95); }
                100% { transform: scale(1); }
            }
            
            /* Toast icon */
            .toast-icon {
                font-size: 18px;
            }
            
            /* Toast message */
            .toast-message {
                flex: 1;
                font-size: 14px;
            }
            
            /* Close button */
            .toast-close {
                background: none;
                border: none;
                color: inherit;
                opacity: 0.7;
                cursor: pointer;
                font-size: 16px;
                padding: 2px 6px;
            }
            .toast-close:hover {
                opacity: 1;
            }
        `;
      document.head.appendChild(style);
    }
    /**
     * Create a toast element
     */
    createToastElement(message, type, id) {
      const colors = {
        info: this.infoColor,
        success: this.successColor,
        warning: this.warningColor,
        error: this.errorColor
      };
      const icons = {
        info: "\u2139\uFE0F",
        success: "\u2713",
        warning: "\u26A0\uFE0F",
        error: "\u2715"
      };
      const element = document.createElement("div");
      element.className = `toast-item toast-${this.animation}`;
      element.style.cssText = `
            background: ${colors[type]};
            color: ${this.textColor};
            font-size: ${this.fontSize}px;
            border-radius: ${this.borderRadius}px;
            padding: ${this.padding}px ${this.padding + 4}px;
        `;
      const iconEl = document.createElement("span");
      iconEl.className = "toast-icon";
      iconEl.textContent = icons[type];
      element.appendChild(iconEl);
      const messageEl = document.createElement("span");
      messageEl.className = "toast-message";
      messageEl.textContent = message;
      element.appendChild(messageEl);
      const closeBtn = document.createElement("button");
      closeBtn.className = "toast-close";
      closeBtn.textContent = "\u2715";
      closeBtn.onclick = () => this.removeToast(id);
      element.appendChild(closeBtn);
      return element;
    }
    /**
     * Get inspector properties
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      return [
        ...baseProps,
        // Animation
        {
          name: "animation",
          label: "Animation",
          type: "select",
          group: "Animation",
          options: ["slide-left", "slide-up", "fade", "bounce"]
        },
        {
          name: "position",
          label: "Position",
          type: "select",
          group: "Animation",
          options: ["bottom-left", "bottom-right", "top-left", "top-right"]
        },
        // Timing
        { name: "duration", label: "Duration (ms)", type: "number", group: "Timing" },
        { name: "maxVisible", label: "Max Visible", type: "number", group: "Timing" },
        // Colors
        { name: "infoColor", label: "Info Color", type: "color", group: "Colors" },
        { name: "successColor", label: "Success Color", type: "color", group: "Colors" },
        { name: "warningColor", label: "Warning Color", type: "color", group: "Colors" },
        { name: "errorColor", label: "Error Color", type: "color", group: "Colors" },
        { name: "textColor", label: "Text Color", type: "color", group: "Colors" },
        // Style
        { name: "fontSize", label: "Font Size", type: "number", group: "Style" },
        { name: "borderRadius", label: "Border Radius", type: "number", group: "Style" },
        { name: "padding", label: "Padding", type: "number", group: "Style" }
      ];
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
      return {
        ...super.toJSON(),
        animation: this.animation,
        position: this.position,
        duration: this.duration,
        maxVisible: this.maxVisible,
        infoColor: this.infoColor,
        successColor: this.successColor,
        warningColor: this.warningColor,
        errorColor: this.errorColor,
        textColor: this.textColor,
        fontSize: this.fontSize,
        borderRadius: this.borderRadius,
        padding: this.padding
      };
    }
    // ========== Runtime Initialization ==========
    /**
     * Initialize for runtime (creates container)
     */
    createRuntimeElement(_container) {
      this.ensureContainer();
      return this._container;
    }
  };

  // src/components/TStatusBar.ts
  var TStatusBar = class extends TWindow {
    constructor(name, x = 0, y = 0, width = 800, height = 28) {
      super(name, x, y, width, height);
      // Sections configuration
      __publicField(this, "sections", []);
      // Styling
      __publicField(this, "textColor", "#ffffff");
      __publicField(this, "sectionGap", 16);
      __publicField(this, "fontSize", 12);
      __publicField(this, "paddingX", 12);
      __publicField(this, "paddingY", 6);
      __publicField(this, "separatorColor", "#444444");
      __publicField(this, "showSeparators", true);
      // Internal
      __publicField(this, "_element", null);
      __publicField(this, "_sectionElements", /* @__PURE__ */ new Map());
      this.style.backgroundColor = "#1a1a2e";
      this.style.borderColor = "#333333";
      this.style.borderWidth = 1;
      this.style.visible = true;
      this.sections = [
        { id: "status", text: "Ready", icon: "\u25CF", width: "auto", align: "left" }
      ];
    }
    /**
     * Text property alias for the main status section
     */
    get text() {
      return this.getSection("status")?.text || "";
    }
    set text(value) {
      this.setSection("status", value);
    }
    /**
     * Set or update a section
     */
    setSection(id, text, icon) {
      const existing = this.sections.find((s) => s.id === id);
      if (existing) {
        existing.text = text;
        if (icon !== void 0) existing.icon = icon;
      } else {
        this.sections.push({ id, text, icon, width: "auto" });
      }
      this.updateSectionElement(id);
      console.log(`[TStatusBar] Section '${id}' updated: ${icon || ""} ${text}`);
    }
    /**
     * Get a section by ID
     */
    getSection(id) {
      return this.sections.find((s) => s.id === id);
    }
    /**
     * Remove a section
     */
    removeSection(id) {
      const index = this.sections.findIndex((s) => s.id === id);
      if (index !== -1) {
        this.sections.splice(index, 1);
        const el = this._sectionElements.get(id);
        if (el) {
          el.remove();
          this._sectionElements.delete(id);
        }
      }
    }
    /**
     * Set connection status (convenience method)
     */
    setConnectionStatus(connected) {
      this.setSection(
        "connection",
        connected ? "Verbunden" : "Getrennt",
        connected ? "\u{1F50C}" : "\u26A1"
      );
    }
    /**
     * Set player info (convenience method)
     */
    setPlayerInfo(playerNumber, roomCode) {
      this.setSection("player", `Spieler ${playerNumber}`, "\u{1F3AE}");
      if (roomCode) {
        this.setSection("room", `Room: ${roomCode}`, "\u{1F3E0}");
      }
    }
    /**
     * Clear all sections
     */
    clear() {
      this.sections = [];
      for (const el of this._sectionElements.values()) {
        el.remove();
      }
      this._sectionElements.clear();
    }
    /**
     * Update a section element in the DOM
     */
    updateSectionElement(id) {
      const section = this.sections.find((s) => s.id === id);
      if (!section || !this._element) return;
      let el = this._sectionElements.get(id);
      if (!el) {
        el = this.createSectionElement(section);
        this._element.appendChild(el);
        this._sectionElements.set(id, el);
      } else {
        this.updateSectionContent(el, section);
      }
    }
    /**
     * Create a section element
     */
    createSectionElement(section) {
      const el = document.createElement("div");
      el.className = "statusbar-section";
      el.dataset.sectionId = section.id;
      const width = typeof section.width === "number" ? `${section.width}px` : "auto";
      el.style.cssText = `
            display: flex;
            align-items: center;
            gap: 6px;
            padding: 0 ${this.paddingX}px;
            width: ${width};
            cursor: ${section.clickTask ? "pointer" : "default"};
        `;
      this.updateSectionContent(el, section);
      if (section.clickTask) {
        el.onclick = () => {
          const event = new CustomEvent("statusbar-task", {
            detail: { sectionId: section.id, taskName: section.clickTask }
          });
          window.dispatchEvent(event);
        };
      }
      return el;
    }
    /**
     * Update section content
     */
    updateSectionContent(el, section) {
      el.innerHTML = "";
      if (section.icon) {
        const iconEl = document.createElement("span");
        iconEl.className = "section-icon";
        iconEl.textContent = section.icon;
        el.appendChild(iconEl);
      }
      const textEl = document.createElement("span");
      textEl.className = "section-text";
      textEl.textContent = section.text;
      el.appendChild(textEl);
    }
    /**
     * Get inspector properties
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      return [
        ...baseProps,
        // Main properties
        { name: "text", label: "Status Text", type: "string", group: "Basic" },
        // Style
        { name: "textColor", label: "Text Color", type: "color", group: "Style" },
        { name: "fontSize", label: "Font Size", type: "number", group: "Style" },
        { name: "paddingX", label: "Padding X", type: "number", group: "Style" },
        { name: "paddingY", label: "Padding Y", type: "number", group: "Style" },
        { name: "sectionGap", label: "Section Gap", type: "number", group: "Style" },
        { name: "separatorColor", label: "Separator Color", type: "color", group: "Style" },
        { name: "showSeparators", label: "Show Separators", type: "boolean", group: "Style" },
        { name: "style.borderColor", label: "Border Color", type: "color", group: "Style" }
      ];
    }
    /**
     * Serialize to JSON
     */
    toJSON() {
      return {
        ...super.toJSON(),
        sections: this.sections,
        textColor: this.textColor,
        fontSize: this.fontSize,
        paddingX: this.paddingX,
        paddingY: this.paddingY,
        sectionGap: this.sectionGap,
        separatorColor: this.separatorColor,
        showSeparators: this.showSeparators
      };
    }
    // ========== Runtime Rendering ==========
    /**
     * Create the DOM representation for runtime
     */
    createRuntimeElement(container) {
      this._element = document.createElement("div");
      this._element.className = "statusbar";
      this._element.style.cssText = `
            position: absolute;
            left: ${this.x}px;
            top: ${this.y}px;
            width: ${this.width}px;
            height: ${this.height}px;
            background: ${this.style.backgroundColor};
            border-top: ${this.style.borderWidth}px solid ${this.style.borderColor};
            display: flex;
            align-items: center;
            gap: ${this.sectionGap}px;
            color: ${this.textColor};
            font-size: ${this.fontSize}px;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            padding: ${this.paddingY}px 0;
        `;
      for (const section of this.sections) {
        const el = this.createSectionElement(section);
        this._element.appendChild(el);
        this._sectionElements.set(section.id, el);
        if (this.showSeparators && this.sections.indexOf(section) < this.sections.length - 1) {
          const separator = document.createElement("div");
          separator.className = "statusbar-separator";
          separator.style.cssText = `
                    width: 1px;
                    height: 60%;
                    background: ${this.separatorColor};
                `;
          this._element.appendChild(separator);
        }
      }
      container.appendChild(this._element);
      return this._element;
    }
    /**
     * Get the runtime element
     */
    getRuntimeElement() {
      return this._element;
    }
  };

  // src/components/TGameState.ts
  var TGameState = class extends TWindow {
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 100, 40);
      __publicField(this, "state", "menu");
      __publicField(this, "spritesMoving", false);
      __publicField(this, "collisionsEnabled", false);
      this.style.backgroundColor = "#4caf50";
      this.style.color = "#ffffff";
      this.style.visible = true;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "state", label: "Initial State", type: "select", group: "Game State", options: ["menu", "playing", "paused", "gameover"] },
        { name: "spritesMoving", label: "Sprites Moving", type: "boolean", group: "Game State" },
        { name: "collisionsEnabled", label: "Collisions Enabled", type: "boolean", group: "Game State" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        state: this.state,
        spritesMoving: this.spritesMoving,
        collisionsEnabled: this.collisionsEnabled
      };
    }
  };

  // src/components/THandshake.ts
  var THandshake = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 4, 1);
      __publicField(this, "className", "THandshake");
      // Status properties (readonly at runtime)
      __publicField(this, "protocolVersion", "1.0");
      __publicField(this, "peerVersion", "");
      __publicField(this, "isHost", false);
      __publicField(this, "playerNumber", 0);
      __publicField(this, "roomCode", "");
      __publicField(this, "status", "disconnected");
      __publicField(this, "enabled", true);
      // Whether handshake is active
      // Event callback (set by GameRuntime)
      __publicField(this, "onEvent", null);
      this.style.backgroundColor = "#5c6bc0";
      this.style.borderColor = "#3949ab";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "protocolVersion", label: "Protokoll-Version", type: "string", group: "Handshake", readonly: true },
        { name: "enabled", label: "Aktiviert", type: "boolean", group: "Handshake" },
        { name: "status", label: "Status", type: "string", group: "Handshake", readonly: true },
        { name: "roomCode", label: "Raum-Code", type: "string", group: "Handshake", readonly: true },
        { name: "playerNumber", label: "Spieler-Nr.", type: "number", group: "Handshake", readonly: true },
        { name: "isHost", label: "Ist Host", type: "boolean", group: "Handshake", readonly: true }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onConnected",
        "onRoomCreated",
        "onRoomJoined",
        "onPeerJoined",
        "onPeerReady",
        "onGameStart",
        "onPeerLeft",
        "onVersionMismatch"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        protocolVersion: this.protocolVersion,
        peerVersion: this.peerVersion,
        isHost: this.isHost,
        playerNumber: this.playerNumber,
        roomCode: this.roomCode,
        status: this.status,
        enabled: this.enabled
      };
    }
    // ─────────────────────────────────────────────
    // Methods callable via call_method action
    // ─────────────────────────────────────────────
    /**
     * Create a new room (Host)
     */
    createRoom() {
      console.log(`[THandshake] ${this.name}: createRoom() called`);
      if (this.onEvent) {
        this.onEvent("_createRoom");
      }
    }
    /**
     * Join an existing room with a code
     */
    joinRoom(code) {
      console.log(`[THandshake] ${this.name}: joinRoom(${code}) called`);
      if (this.onEvent) {
        this.onEvent("_joinRoom", { code });
      }
    }
    /**
     * Signal ready status
     */
    ready() {
      console.log(`[THandshake] ${this.name}: ready() called`);
      if (this.onEvent) {
        this.onEvent("_ready");
      }
    }
    // ─────────────────────────────────────────────
    // Internal methods (called by MultiplayerManager)
    // ─────────────────────────────────────────────
    _fireEvent(eventName, data) {
      if (this.onEvent) {
        this.onEvent(eventName, data);
      }
    }
    _setStatus(newStatus) {
      this.status = newStatus;
    }
    _setRoomInfo(roomCode, playerNumber, isHost) {
      this.roomCode = roomCode;
      this.playerNumber = playerNumber;
      this.isHost = isHost;
    }
    _setPeerVersion(version) {
      this.peerVersion = version;
    }
  };

  // src/components/THeartbeat.ts
  var THeartbeat = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 4, 1);
      __publicField(this, "className", "THeartbeat");
      // Configuration
      __publicField(this, "pingInterval", 5e3);
      // in milliseconds
      __publicField(this, "timeoutThreshold", 3);
      // max missed pongs
      __publicField(this, "latencyWarningThreshold", 500);
      // ms
      __publicField(this, "enabled", true);
      // Status (readonly at runtime)
      __publicField(this, "latency", 0);
      __publicField(this, "missedPongs", 0);
      __publicField(this, "status", "inactive");
      // Internal timer
      __publicField(this, "pingTimer", null);
      __publicField(this, "lastPingTime", 0);
      // Event callback (set by GameRuntime)
      __publicField(this, "onEvent", null);
      this.style.backgroundColor = "#e91e63";
      this.style.borderColor = "#c2185b";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "pingInterval", label: "Ping-Intervall (ms)", type: "number", group: "Heartbeat" },
        { name: "timeoutThreshold", label: "Max. verpasste Pongs", type: "number", group: "Heartbeat" },
        { name: "latencyWarningThreshold", label: "Latenz-Warnung (ms)", type: "number", group: "Heartbeat" },
        { name: "enabled", label: "Aktiviert", type: "boolean", group: "Heartbeat" },
        { name: "latency", label: "Aktuelle Latenz", type: "number", group: "Status", readonly: true },
        { name: "missedPongs", label: "Verpasste Pongs", type: "number", group: "Status", readonly: true },
        { name: "status", label: "Status", type: "string", group: "Status", readonly: true }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onPing",
        "onPong",
        "onLatencyWarning",
        "onMissedPong",
        "onPeerTimeout",
        "onReconnecting",
        "onReconnected",
        "onConnectionLost"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        pingInterval: this.pingInterval,
        timeoutThreshold: this.timeoutThreshold,
        latencyWarningThreshold: this.latencyWarningThreshold,
        enabled: this.enabled,
        latency: this.latency,
        missedPongs: this.missedPongs,
        status: this.status
      };
    }
    // ─────────────────────────────────────────────
    // Methods callable via call_method action
    // ─────────────────────────────────────────────
    /**
     * Start heartbeat manually
     */
    start() {
      console.log(`[THeartbeat] ${this.name}: start() called`);
      if (this.onEvent) {
        this.onEvent("_start");
      }
    }
    /**
     * Stop heartbeat
     */
    stop() {
      console.log(`[THeartbeat] ${this.name}: stop() called`);
      this._stopTimer();
      this.status = "inactive";
      if (this.onEvent) {
        this.onEvent("_stop");
      }
    }
    /**
     * Send immediate ping
     */
    forcePing() {
      console.log(`[THeartbeat] ${this.name}: forcePing() called`);
      if (this.onEvent) {
        this.onEvent("_forcePing");
      }
    }
    // ─────────────────────────────────────────────
    // Internal methods (called by MultiplayerManager)
    // ─────────────────────────────────────────────
    _startTimer(sendPingFn) {
      this._stopTimer();
      this.status = "healthy";
      this.missedPongs = 0;
      if (!this.enabled) return;
      this.pingTimer = window.setInterval(() => {
        this.lastPingTime = Date.now();
        this.missedPongs++;
        this._fireEvent("onPing", { timestamp: this.lastPingTime });
        if (this.missedPongs >= this.timeoutThreshold) {
          this.status = "critical";
          this._fireEvent("onPeerTimeout", {
            missedCount: this.missedPongs,
            threshold: this.timeoutThreshold
          });
        } else if (this.missedPongs >= 1) {
          this.status = "warning";
          this._fireEvent("onMissedPong", {
            missedCount: this.missedPongs,
            threshold: this.timeoutThreshold
          });
        }
        sendPingFn();
      }, this.pingInterval);
      console.log(`[THeartbeat] ${this.name}: Timer started (interval: ${this.pingInterval}ms)`);
    }
    _stopTimer() {
      if (this.pingTimer !== null) {
        window.clearInterval(this.pingTimer);
        this.pingTimer = null;
      }
    }
    _handlePong(serverTime) {
      const now = Date.now();
      this.latency = now - this.lastPingTime;
      const wasWarning = this.missedPongs > 0;
      this.missedPongs = 0;
      this.status = "healthy";
      this._fireEvent("onPong", { latency: this.latency, serverTime });
      if (this.latency > this.latencyWarningThreshold) {
        this._fireEvent("onLatencyWarning", { latency: this.latency });
      }
      if (wasWarning) {
        this._fireEvent("onReconnected", { downtime: this.latency });
      }
    }
    _fireEvent(eventName, data) {
      if (this.onEvent) {
        this.onEvent(eventName, data);
      }
    }
    _setConnectionLost() {
      this._stopTimer();
      this.status = "critical";
      this._fireEvent("onConnectionLost");
    }
  };

  // src/components/TImage.ts
  var TImage = class extends TPanel {
    constructor(name, x, y, width = 100, height = 100) {
      super(name, x, y, width, height);
      // Bild-Properties
      __publicField(this, "_backgroundImage", IMAGE_DEFAULTS.backgroundImage);
      __publicField(this, "_objectFit", IMAGE_DEFAULTS.objectFit);
      __publicField(this, "_imageOpacity", IMAGE_DEFAULTS.imageOpacity);
      // Fallback-Farbe wenn kein Bild geladen
      __publicField(this, "fallbackColor", "#2a2a2a");
      // Alt-Text für Barrierefreiheit
      __publicField(this, "alt", "");
      this.style.backgroundColor = this.fallbackColor;
      this.style.borderWidth = 0;
    }
    // ─────────────────────────────────────────────
    // Bild-Properties
    // ─────────────────────────────────────────────
    get src() {
      return this._backgroundImage;
    }
    set src(value) {
      this._backgroundImage = value || "";
    }
    // Alias für Kompatibilität
    get backgroundImage() {
      return this._backgroundImage;
    }
    set backgroundImage(value) {
      this._backgroundImage = value || "";
    }
    get objectFit() {
      return this._objectFit;
    }
    set objectFit(value) {
      this._objectFit = value;
    }
    get imageOpacity() {
      return this._imageOpacity;
    }
    set imageOpacity(value) {
      this._imageOpacity = Math.max(0, Math.min(1, value));
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const filtered = props.filter(
        (p) => !["showGrid", "gridColor", "gridStyle", "caption"].includes(p.name)
      );
      return [
        ...filtered,
        // Image-Gruppe
        { name: "src", label: "Image Path", type: "image_picker", group: "Image" },
        {
          name: "objectFit",
          label: "Object Fit",
          type: "select",
          group: "Image",
          options: ["cover", "contain", "fill", "none"]
        },
        { name: "alt", label: "Alt Text", type: "string", group: "Image" },
        { name: "imageOpacity", label: "Opacity", type: "number", group: "Image" },
        { name: "fallbackColor", label: "Fallback Color", type: "color", group: "Image" }
      ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
      return {
        ...super.toJSON(),
        backgroundImage: this._backgroundImage,
        objectFit: this._objectFit,
        imageOpacity: this._imageOpacity,
        alt: this.alt,
        fallbackColor: this.fallbackColor
      };
    }
  };

  // src/components/TNumberLabel.ts
  var TNumberLabel = class extends TTextControl {
    constructor(name, x, y, startValue = 0) {
      super(name, x, y, 100, 20);
      __publicField(this, "className", "TNumberLabel");
      __publicField(this, "value", 0);
      __publicField(this, "startValue", 0);
      __publicField(this, "maxValue", null);
      __publicField(this, "step", 1);
      __publicField(this, "onEvent", null);
      this.startValue = startValue;
      this.value = startValue;
      this.style.backgroundColor = "transparent";
      this.style.color = "#000000";
      this.style.textAlign = "center";
    }
    /**
     * Increments the value by the step amount.
     * Fires onMaxValueReached if maxValue is set and reached.
     */
    incValue() {
      const oldValue = this.value;
      this.value += this.step;
      console.log(`[TNumberLabel] incValue on ${this.name}: ${oldValue} + ${this.step} = ${this.value}, maxValue=${this.maxValue}, onEvent=${!!this.onEvent}`);
      if (this.maxValue !== null && this.value >= this.maxValue) {
        console.log(`[TNumberLabel] ${this.name}: MaxValue reached! value=${this.value} >= maxValue=${this.maxValue}. Firing onMaxValueReached...`);
        if (this.onEvent) {
          this.onEvent("onMaxValueReached");
          console.log(`[TNumberLabel] ${this.name}: onMaxValueReached event fired!`);
        } else {
          console.warn(`[TNumberLabel] ${this.name}: onEvent callback is NOT registered! Event cannot be fired.`);
        }
      }
    }
    /**
     * Decrements the value by the step amount.
     * Fires onMinValueReached if 0 is reached and startValue was > 0.
     */
    decValue() {
      const oldValue = this.value;
      this.value -= this.step;
      if (this.value < 0) this.value = 0;
      if (oldValue > 0 && this.value === 0 && this.startValue > 0) {
        if (this.onEvent) this.onEvent("onMinValueReached");
      }
    }
    /**
     * Resets the value to the startValue.
     */
    reset() {
      this.value = this.startValue;
    }
    // Mapping caption to value for display if needed generically
    get caption() {
      return String(this.value);
    }
    set caption(v) {
      this.value = Number(v) || 0;
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onMaxValueReached",
        "onMinValueReached"
      ];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "startValue", label: "Anfangswert", type: "number", group: "Numeric" },
        { name: "value", label: "Aktueller Wert", type: "number", group: "Numeric" },
        { name: "maxValue", label: "Maximalwert (Optional)", type: "number", group: "Numeric" },
        { name: "step", label: "Schrittweite", type: "number", group: "Numeric" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        value: this.value,
        startValue: this.startValue,
        maxValue: this.maxValue,
        step: this.step
      };
    }
  };

  // src/utils/Serialization.ts
  function hydrateObjects(objectsData) {
    const objects = [];
    objectsData.forEach((objData) => {
      let newObj = null;
      switch (objData.className) {
        case "TButton":
          newObj = new TButton(objData.name, objData.x, objData.y, objData.width, objData.height, objData.caption);
          break;
        case "TPanel":
          newObj = new TPanel(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TLabel":
          newObj = new TLabel(objData.name, objData.x, objData.y, objData.text);
          break;
        case "TEdit":
        case "TTextInput":
          newObj = new TEdit(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TSystemInfo":
          newObj = new TSystemInfo(objData.name);
          break;
        case "TGameHeader":
          newObj = new TGameHeader(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TSprite":
          newObj = new TSprite(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TGameLoop":
          newObj = new TGameLoop(objData.name, objData.x, objData.y);
          break;
        case "TInputController":
          newObj = new TInputController(objData.name, objData.x, objData.y);
          break;
        case "TTimer":
          newObj = new TTimer(objData.name, objData.x, objData.y);
          break;
        case "TRepeater":
          newObj = new TRepeater(objData.name, objData.x, objData.y);
          break;
        case "TGameCard":
          newObj = new TGameCard(objData.name, objData.x, objData.y);
          break;
        case "TGameServer":
          newObj = new TGameServer(objData.name, objData.x, objData.y);
          break;
        case "TDropdown":
          newObj = new TDropdown(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TCheckbox":
          newObj = new TCheckbox(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TColorPicker":
          newObj = new TColorPicker(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TNumberInput":
          newObj = new TNumberInput(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TTabControl":
          newObj = new TTabControl(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TInspectorTemplate":
          newObj = new TInspectorTemplate(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TDialogRoot":
          newObj = new TDialogRoot(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TInfoWindow":
          newObj = new TInfoWindow(objData.name, objData.x, objData.y);
          break;
        case "TToast":
          newObj = new TToast(objData.name);
          break;
        case "TStatusBar":
          newObj = new TStatusBar(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TGameState":
          newObj = new TGameState(objData.name, objData.x, objData.y);
          break;
        case "THandshake":
          newObj = new THandshake(objData.name, objData.x, objData.y);
          break;
        case "THeartbeat":
          newObj = new THeartbeat(objData.name, objData.x, objData.y);
          break;
        case "TImage":
          newObj = new TImage(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TNumberLabel":
          newObj = new TNumberLabel(objData.name, objData.x, objData.y, objData.startValue);
          break;
        default:
          console.warn("Unknown class during load:", objData.className);
          break;
      }
      if (newObj) {
        newObj.id = objData.id;
        newObj.className = objData.className;
        if (objData.width !== void 0) newObj.width = objData.width;
        if (objData.height !== void 0) newObj.height = objData.height;
        if (objData.x !== void 0) newObj.x = objData.x;
        if (objData.y !== void 0) newObj.y = objData.y;
        if (objData.visible !== void 0) newObj.visible = objData.visible;
        if (objData.style) {
          Object.assign(newObj.style, objData.style);
        }
        if (objData.caption !== void 0) newObj.caption = objData.caption;
        if (objData.text !== void 0) newObj.text = objData.text;
        if (objData.fontSize !== void 0) newObj.fontSize = objData.fontSize;
        if (objData.alignment !== void 0) newObj.alignment = objData.alignment;
        if (objData.align !== void 0) newObj.align = objData.align;
        if (objData.title !== void 0) newObj.title = objData.title;
        if (objData.titleAlign !== void 0) newObj.titleAlign = objData.titleAlign;
        if (objData.textColor !== void 0) newObj.textColor = objData.textColor;
        if (objData.fontWeight !== void 0) newObj.fontWeight = objData.fontWeight;
        if (objData.fontFamily !== void 0) newObj.fontFamily = objData.fontFamily;
        if (objData.placeholder !== void 0) newObj.placeholder = objData.placeholder;
        if (objData.maxLength !== void 0) newObj.maxLength = objData.maxLength;
        if (objData.color !== void 0 && "color" in newObj) {
          newObj.color = objData.color;
        }
        if (objData.velocityX !== void 0) newObj.velocityX = objData.velocityX;
        if (objData.velocityY !== void 0) newObj.velocityY = objData.velocityY;
        if (objData.lerpSpeed !== void 0) newObj.lerpSpeed = objData.lerpSpeed;
        if (objData.collisionEnabled !== void 0) newObj.collisionEnabled = objData.collisionEnabled;
        if (objData.collisionGroup !== void 0) newObj.collisionGroup = objData.collisionGroup;
        if (objData.shape !== void 0) newObj.shape = objData.shape;
        if (objData.spriteColor !== void 0) newObj.spriteColor = objData.spriteColor;
        if (objData.backgroundImage !== void 0) newObj.backgroundImage = objData.backgroundImage;
        if (objData.objectFit !== void 0) newObj.objectFit = objData.objectFit;
        if (objData.imageOpacity !== void 0) newObj.imageOpacity = objData.imageOpacity;
        if (objData.icon !== void 0) newObj.icon = objData.icon;
        if (objData.alt !== void 0) newObj.alt = objData.alt;
        if (objData.fallbackColor !== void 0) newObj.fallbackColor = objData.fallbackColor;
        if (objData.targetFPS !== void 0) newObj.targetFPS = objData.targetFPS;
        if (objData.boundsWidth !== void 0) newObj.boundsWidth = objData.boundsWidth;
        if (objData.boundsHeight !== void 0) newObj.boundsHeight = objData.boundsHeight;
        if (objData.bounceTop !== void 0) newObj.bounceTop = objData.bounceTop;
        if (objData.bounceBottom !== void 0) newObj.bounceBottom = objData.bounceBottom;
        if (objData.bounceLeft !== void 0) newObj.bounceLeft = objData.bounceLeft;
        if (objData.bounceRight !== void 0) newObj.bounceRight = objData.bounceRight;
        if (objData.boundsOffsetTop !== void 0) newObj.boundsOffsetTop = objData.boundsOffsetTop;
        if (objData.boundsOffsetBottom !== void 0) newObj.boundsOffsetBottom = objData.boundsOffsetBottom;
        if (objData.bounceOnBoundary !== void 0) {
          newObj.bounceTop = objData.bounceOnBoundary;
          newObj.bounceBottom = objData.bounceOnBoundary;
          newObj.bounceLeft = objData.bounceOnBoundary;
          newObj.bounceRight = objData.bounceOnBoundary;
        }
        if (objData.enabled !== void 0) newObj.enabled = objData.enabled;
        if (objData.player1Controls !== void 0) newObj.player1Controls = objData.player1Controls;
        if (objData.player1Target !== void 0) newObj.player1Target = objData.player1Target;
        if (objData.player1Speed !== void 0) newObj.player1Speed = objData.player1Speed;
        if (objData.player2Controls !== void 0) newObj.player2Controls = objData.player2Controls;
        if (objData.player2Target !== void 0) newObj.player2Target = objData.player2Target;
        if (objData.player2Speed !== void 0) newObj.player2Speed = objData.player2Speed;
        if (objData.verticalOnly !== void 0) newObj.verticalOnly = objData.verticalOnly;
        if (objData.horizontalOnly !== void 0) newObj.horizontalOnly = objData.horizontalOnly;
        if (objData.showGrid !== void 0) newObj.showGrid = objData.showGrid;
        if (objData.gridColor !== void 0) newObj.gridColor = objData.gridColor;
        if (objData.gridStyle !== void 0) newObj.gridStyle = objData.gridStyle;
        if (objData.interval !== void 0) newObj.interval = objData.interval;
        if (objData.enabled !== void 0) newObj.enabled = objData.enabled;
        if (objData.maxInterval !== void 0) newObj.maxInterval = objData.maxInterval;
        if (objData.currentInterval !== void 0) newObj.currentInterval = objData.currentInterval;
        if (objData.options !== void 0) newObj.options = objData.options;
        if (objData.selectedIndex !== void 0) newObj.selectedIndex = objData.selectedIndex;
        if (objData.selectedValue !== void 0) newObj.selectedValue = objData.selectedValue;
        if (objData.checked !== void 0) newObj.checked = objData.checked;
        if (objData.label !== void 0) newObj.label = objData.label;
        if (objData.color !== void 0 && newObj.className === "TColorPicker") {
          newObj.color = objData.color;
        }
        if (objData.value !== void 0) newObj.value = objData.value;
        if (objData.min !== void 0) newObj.min = objData.min;
        if (objData.max !== void 0) newObj.max = objData.max;
        if (objData.step !== void 0) newObj.step = objData.step;
        if (objData.value !== void 0) newObj.value = objData.value;
        if (objData.startValue !== void 0) newObj.startValue = objData.startValue;
        if (objData.maxValue !== void 0) newObj.maxValue = objData.maxValue;
        if (objData.tabs !== void 0) newObj.tabs = objData.tabs;
        if (objData.activeTabIndex !== void 0) newObj.activeTabIndex = objData.activeTabIndex;
        if (objData.activeTabName !== void 0) newObj.activeTabName = objData.activeTabName;
        if (objData.layoutConfig !== void 0) newObj.layoutConfig = objData.layoutConfig;
        if (objData.title !== void 0) newObj.title = objData.title;
        if (objData.borderRadius !== void 0) newObj.borderRadius = objData.borderRadius;
        if (objData.padding !== void 0) newObj.padding = objData.padding;
        if (objData.modal !== void 0) newObj.modal = objData.modal;
        if (objData.closable !== void 0) newObj.closable = objData.closable;
        if (objData.draggableAtRuntime !== void 0) newObj.draggableAtRuntime = objData.draggableAtRuntime;
        if (objData.centerOnShow !== void 0) newObj.centerOnShow = objData.centerOnShow;
        if (objData.onShowTask !== void 0) newObj.onShowTask = objData.onShowTask;
        if (objData.onCloseTask !== void 0) newObj.onCloseTask = objData.onCloseTask;
        if (objData.onCancelTask !== void 0) newObj.onCancelTask = objData.onCancelTask;
        if (objData.message !== void 0) newObj.message = objData.message;
        if (objData.icon !== void 0) newObj.icon = objData.icon;
        if (objData.iconSize !== void 0) newObj.iconSize = objData.iconSize;
        if (objData.showCancelButton !== void 0) newObj.showCancelButton = objData.showCancelButton;
        if (objData.cancelButtonText !== void 0) newObj.cancelButtonText = objData.cancelButtonText;
        if (objData.showConfirmButton !== void 0) newObj.showConfirmButton = objData.showConfirmButton;
        if (objData.confirmButtonText !== void 0) newObj.confirmButtonText = objData.confirmButtonText;
        if (objData.showSpinner !== void 0) newObj.showSpinner = objData.showSpinner;
        if (objData.autoClose !== void 0) newObj.autoClose = objData.autoClose;
        if (objData.autoCloseDelay !== void 0) newObj.autoCloseDelay = objData.autoCloseDelay;
        if (objData.onConfirmTask !== void 0) newObj.onConfirmTask = objData.onConfirmTask;
        if (objData.onAutoCloseTask !== void 0) newObj.onAutoCloseTask = objData.onAutoCloseTask;
        if (objData.animation !== void 0) newObj.animation = objData.animation;
        if (objData.position !== void 0) newObj.position = objData.position;
        if (objData.duration !== void 0) newObj.duration = objData.duration;
        if (objData.maxVisible !== void 0) newObj.maxVisible = objData.maxVisible;
        if (objData.infoColor !== void 0) newObj.infoColor = objData.infoColor;
        if (objData.successColor !== void 0) newObj.successColor = objData.successColor;
        if (objData.warningColor !== void 0) newObj.warningColor = objData.warningColor;
        if (objData.errorColor !== void 0) newObj.errorColor = objData.errorColor;
        if (objData.sections !== void 0) newObj.sections = objData.sections;
        if (objData.sectionGap !== void 0) newObj.sectionGap = objData.sectionGap;
        if (objData.separatorColor !== void 0) newObj.separatorColor = objData.separatorColor;
        if (objData.showSeparators !== void 0) newObj.showSeparators = objData.showSeparators;
        if (objData.paddingX !== void 0) newObj.paddingX = objData.paddingX;
        if (objData.paddingY !== void 0) newObj.paddingY = objData.paddingY;
        if (objData.textColor !== void 0) newObj.textColor = objData.textColor;
        if (objData.fontSize !== void 0) newObj.fontSize = objData.fontSize;
        if (objData.state !== void 0) newObj.state = objData.state;
        if (objData.spritesMoving !== void 0) newObj.spritesMoving = objData.spritesMoving;
        if (objData.collisionsEnabled !== void 0) newObj.collisionsEnabled = objData.collisionsEnabled;
        if (objData.service !== void 0) newObj.service = objData.service;
        if (objData.serviceMethod !== void 0) newObj.serviceMethod = objData.serviceMethod;
        if (objData.serviceParams !== void 0) newObj.serviceParams = objData.serviceParams;
        if (objData.onSuccessToast !== void 0) newObj.onSuccessToast = objData.onSuccessToast;
        if (objData.onSuccessToastType !== void 0) newObj.onSuccessToastType = objData.onSuccessToastType;
        if (objData.onSuccessStatusSection !== void 0) newObj.onSuccessStatusSection = objData.onSuccessStatusSection;
        if (objData.onSuccessStatusText !== void 0) newObj.onSuccessStatusText = objData.onSuccessStatusText;
        if (objData.onSuccessInfoWindow !== void 0) newObj.onSuccessInfoWindow = objData.onSuccessInfoWindow;
        if (objData.onSuccessInfoMessage !== void 0) newObj.onSuccessInfoMessage = objData.onSuccessInfoMessage;
        if (objData.onSuccessCloseDialog !== void 0) newObj.onSuccessCloseDialog = objData.onSuccessCloseDialog;
        if (objData.onErrorToast !== void 0) newObj.onErrorToast = objData.onErrorToast;
        if (objData.onErrorToastType !== void 0) newObj.onErrorToastType = objData.onErrorToastType;
        if (objData.Tasks) {
          newObj.Tasks = objData.Tasks;
        }
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

  // src/runtime/GameRuntime.ts
  var GameRuntime = class {
    constructor(project, objects, options = {}) {
      this.project = project;
      this.options = options;
      __publicField(this, "reactiveRuntime");
      __publicField(this, "actionExecutor");
      __publicField(this, "taskExecutor");
      __publicField(this, "globalVars");
      __publicField(this, "objects");
      this.globalVars = { ...options.initialGlobalVars };
      this.reactiveRuntime = new ReactiveRuntime();
      this.objects = objects || hydrateObjects(project.objects);
      if (options.makeReactive) {
        this.objects.forEach((obj) => {
          this.reactiveRuntime.registerObject(obj.name, obj, true);
        });
        const mp2 = options.multiplayerManager || window.multiplayerManager;
        this.reactiveRuntime.setVariable("isMultiplayer", !!mp2);
        if (mp2) {
          this.reactiveRuntime.setVariable("playerNumber", mp2.playerNumber || 1);
          this.reactiveRuntime.setVariable("isHost", mp2.isHost !== void 0 ? mp2.isHost : mp2.playerNumber === 1);
        } else {
          this.reactiveRuntime.setVariable("playerNumber", 1);
          this.reactiveRuntime.setVariable("isHost", true);
        }
        this.objects = this.reactiveRuntime.getObjects();
      }
      this.actionExecutor = new ActionExecutor(
        this.objects,
        options.multiplayerManager || window.multiplayerManager,
        options.onNavigate
      );
      const mp = options.multiplayerManager || window.multiplayerManager;
      this.taskExecutor = new TaskExecutor(
        project,
        project.actions || [],
        this.actionExecutor,
        project.flowCharts,
        // Pass flowCharts dictionary
        mp
        // For triggerMode handling
      );
      if (mp) {
        mp.onRemoteTask = (msg) => {
          this.executeRemoteTask(msg.taskName, msg.params, msg.mode);
        };
      }
      this.init();
    }
    start() {
      this.objects.forEach((obj) => {
        this.handleEvent(obj.id, "onStart");
      });
      const stageConfig = this.project.stage || this.project.grid;
      if (stageConfig && stageConfig.startAnimation && stageConfig.startAnimation !== "none") {
        console.log(`[GameRuntime] Triggering start animation: ${stageConfig.startAnimation} `);
        const invisibleClasses = ["TGameLoop", "TInputController", "TTimer", "TGameState", "THandshake", "THeartbeat", "TGameServer", "TStage"];
        const visualObjects = this.objects.filter((o) => !invisibleClasses.includes(o.className));
        console.log(`[GameRuntime] Found ${visualObjects.length} visual objects to animate.`);
        visualObjects.forEach((obj, index) => {
          if (typeof obj.moveTo === "function") {
            const targetX = obj.x;
            const targetY = obj.y;
            const duration = stageConfig.startAnimationDuration || 1e3;
            const easing = stageConfig.startAnimationEasing || "easeOut";
            const start = this.getPatternStartPosition(
              stageConfig.startAnimation,
              targetX,
              targetY,
              index,
              stageConfig
            );
            console.log(`[GameRuntime] Animating ${obj.name || obj.id}: from(${start.x}, ${start.y}) to(${targetX}, ${targetY}) with opacity 0 -> 1`);
            obj.x = start.x;
            obj.y = start.y;
            if (!obj.style) obj.style = {};
            obj.style.opacity = 0;
            obj.moveTo(targetX, targetY, duration, easing);
            const am = AnimationManager.getInstance();
            am.addTween(obj, "style.opacity", 1, duration, easing);
          } else {
            console.warn(`[GameRuntime] Object ${obj.name || obj.id} has no moveTo method!`);
          }
        });
      }
      const inputControllers = this.objects.filter((o) => o.className === "TInputController");
      inputControllers.forEach((ic) => {
        if (typeof ic.init === "function") {
          ic.init(
            this.objects,
            (id, event, data) => this.handleEvent(id, event, data)
          );
        }
        if (typeof ic.start === "function") ic.start();
      });
      const gameLoop = this.objects.find((o) => o.className === "TGameLoop");
      if (gameLoop && typeof gameLoop.start === "function") {
        if (typeof gameLoop.init === "function") {
          gameLoop.init(
            this.objects,
            this.project.stage.grid,
            this.options.onRender || (() => {
            }),
            (id, event, data) => this.handleEvent(id, event, data)
          );
        }
        gameLoop.start();
      }
      const timers = this.objects.filter((o) => o.className === "TTimer");
      timers.forEach((timer) => {
        if ("onEvent" in timer) {
          timer.onEvent = (eventName) => {
            this.handleEvent(timer.id, eventName);
          };
        }
        if (typeof timer.start === "function") {
          timer.start(() => {
            this.handleEvent(timer.id, "onTimer");
          });
        }
      });
      const numberLabels = this.objects.filter((o) => o.className === "TNumberLabel");
      numberLabels.forEach((nl) => {
        if ("onEvent" in nl) {
          nl.onEvent = (eventName) => {
            this.handleEvent(nl.id, eventName);
          };
        }
      });
      const mp = this.options.multiplayerManager || window.multiplayerManager;
      if (mp && typeof mp.on === "function") {
        mp.on((msg) => {
          const handshakes2 = this.objects.filter((o) => o.className === "THandshake");
          handshakes2.forEach((hs) => {
            if (msg.type === "room_joined") {
              hs._setRoomInfo(msg.roomCode, msg.playerNumber, msg.playerNumber === 1);
              hs._setStatus("waiting");
              hs._fireEvent("onRoomJoined", msg);
            } else if (msg.type === "player_joined") {
              hs._fireEvent("onPeerJoined", msg);
            } else if (msg.type === "game_start") {
              hs._setStatus("playing");
              hs._fireEvent("onGameStart", msg);
            } else if (msg.type === "room_created") {
              hs._setRoomInfo(msg.roomCode, 1, true);
              hs._setStatus("waiting");
              hs._fireEvent("onRoomCreated", msg);
            } else if (msg.type === "player_left") {
              hs._setStatus("waiting");
              hs._fireEvent("onPeerLeft", msg);
            }
          });
          const heartbeats2 = this.objects.filter((o) => o.className === "THeartbeat");
          heartbeats2.forEach((hb) => {
            if (msg.type === "pong") {
              hb._handlePong(msg.serverTime);
            } else if (msg.type === "player_timeout") {
              hb._setConnectionLost();
            }
          });
        });
      }
      const handshakes = this.objects.filter((o) => o.className === "THandshake");
      handshakes.forEach((hs) => {
        hs.onEvent = (eventName, data) => {
          if (!mp) return;
          if (eventName === "_createRoom") mp.createRoom();
          else if (eventName === "_joinRoom") mp.joinRoom(data?.code);
          else if (eventName === "_ready") mp.ready();
          else this.handleEvent(hs.id, eventName, data);
        };
      });
      const heartbeats = this.objects.filter((o) => o.className === "THeartbeat");
      heartbeats.forEach((hb) => {
        hb.onEvent = (eventName, data) => {
          if (!mp) return;
          if (eventName === "_start") {
            hb._startTimer(() => mp.send({ type: "ping", timestamp: Date.now() }));
          } else if (eventName === "_stop") {
            hb._stopTimer();
          } else if (eventName === "_forcePing") {
            mp.send({ type: "ping", timestamp: Date.now() });
          } else this.handleEvent(hb.id, eventName, data);
        };
      });
      const servers = this.objects.filter((o) => o.className === "TGameServer");
      servers.forEach((server) => {
        if (typeof server.start === "function") {
          server.start((eventName, data) => {
            this.handleEvent(server.id, eventName, data);
          });
        }
      });
      if (mp && mp.roomCode) {
        const handshakes2 = this.objects.filter((o) => o.className === "THandshake");
        handshakes2.forEach((hs) => {
          console.log(`[GameRuntime] Restoring existing room state for ${hs.name}: ${mp.roomCode} `);
          hs._setRoomInfo(mp.roomCode, mp.playerNumber, mp.playerNumber === 1);
          hs._setStatus("waiting");
          if (mp.playerNumber === 1) {
            hs._fireEvent("onRoomCreated", { roomCode: mp.roomCode });
          } else {
            hs._fireEvent("onRoomJoined", { roomCode: mp.roomCode, playerNumber: mp.playerNumber });
          }
        });
      }
    }
    stop() {
      const gameLoop = this.objects.find((o) => o.className === "TGameLoop");
      if (gameLoop && typeof gameLoop.stop === "function") {
        gameLoop.stop();
      }
      const inputControllers = this.objects.filter((o) => o.className === "TInputController");
      inputControllers.forEach((ic) => {
        if (typeof ic.stop === "function") ic.stop();
      });
      const timers = this.objects.filter((o) => o.className === "TTimer");
      timers.forEach((timer) => {
        if (typeof timer.stop === "function") timer.stop();
      });
      const servers = this.objects.filter((o) => o.className === "TGameServer");
      servers.forEach((server) => {
        if (typeof server.stop === "function") server.stop();
      });
    }
    updateRemoteState(objectIdOrName, state) {
      const target = this.objects.find((o) => o.id === objectIdOrName || o.name === objectIdOrName);
      if (!target) return;
      if (state.x !== void 0 || state.y !== void 0) {
        if (typeof target.smoothSync === "function") {
          target.smoothSync(state.x ?? target.x, state.y ?? target.y);
        } else {
          if (state.x !== void 0) target.x = state.x;
          if (state.y !== void 0) target.y = state.y;
        }
      }
      if (state.vx !== void 0) target.velocityX = state.vx;
      if (state.vy !== void 0) target.velocityY = state.vy;
      if (state.text !== void 0) target.text = state.text;
      if (state.value !== void 0) target.value = state.value;
      if (state.spritesMoving !== void 0) {
        target.spritesMoving = state.spritesMoving;
      }
      this.handleEvent(target.id, "onSyncState", {
        targetX: state.x,
        targetY: state.y,
        targetVX: state.vx,
        targetVY: state.vy,
        targetText: state.text,
        targetValue: state.value,
        syncedObject: target.name
      });
    }
    /**
     * Trigger an event on a remote object (called when receiving a remote_event message)
     */
    triggerRemoteEvent(objectIdOrName, eventName, params) {
      const target = this.objects.find((o) => o.id === objectIdOrName || o.name === objectIdOrName);
      if (!target) {
        console.warn(`[Runtime] triggerRemoteEvent: Object not found: ${objectIdOrName} `);
        return;
      }
      console.log(`[Runtime] Triggering remote event: ${target.name}.${eventName} `);
      this.globalVars["isRemoteTriggered"] = 1;
      this.handleEvent(target.id, eventName, params || {});
      this.globalVars["isRemoteTriggered"] = 0;
    }
    /**
     * Execute an action received from another player
     */
    executeRemoteAction(action) {
      const vars = {};
      if (this.project.variables) {
        this.project.variables.forEach((v) => {
          vars[v.name] = this.reactiveRuntime.getVariable(v.name);
        });
      }
      Object.assign(vars, this.globalVars);
      this.actionExecutor.execute(action, vars, this.globalVars, null, void 0);
    }
    /**
     * Executes a task received via network (triggerMode logic)
     */
    executeRemoteTask(taskName, params, mode) {
      console.log(`[Runtime] Executing remote task: ${taskName} (mode: ${mode})`);
      const vars = {};
      if (this.project.variables) {
        this.project.variables.forEach((v) => {
          vars[v.name] = this.reactiveRuntime.getVariable(v.name);
        });
      }
      Object.assign(vars, this.globalVars, params || {});
      this.taskExecutor.execute(taskName, vars, this.globalVars, null, 0, void 0, params, true);
    }
    init() {
      if (!this.options.makeReactive) {
        this.objects.forEach((obj) => {
          this.reactiveRuntime.registerObject(obj.name, obj, false);
        });
      }
      if (this.project.variables) {
        this.project.variables.forEach((v) => {
          const initialValue = this.globalVars[v.name] !== void 0 ? this.globalVars[v.name] : v.defaultValue;
          this.reactiveRuntime.registerVariable(v.name, initialValue);
        });
      }
      this.setupBindings();
    }
    setupBindings() {
      this.objects.forEach((obj) => {
        Object.keys(obj).forEach((prop) => {
          const value = obj[prop];
          if (typeof value === "string" && value.includes("${")) {
            this.reactiveRuntime.bind(obj, prop, value);
          }
          if (prop === "style" && typeof value === "object" && value !== null) {
            Object.keys(value).forEach((styleProp) => {
              const styleValue = value[styleProp];
              if (typeof styleValue === "string" && styleValue.includes("${")) {
                this.reactiveRuntime.bind(value, styleProp, styleValue);
              }
            });
          }
        });
      });
    }
    handleEvent(objectId, eventName, data = {}) {
      let targets = [];
      if (objectId === "global") {
        targets = this.objects.filter((o) => o.Tasks && o.Tasks[eventName]);
      } else {
        const obj = this.objects.find((o) => o.id === objectId || o.name === objectId);
        if (obj) {
          targets.push(obj);
        } else {
          console.warn(`[GameRuntime] No object found for objectId="${objectId}". Available objects:`, this.objects.map((o) => ({ id: o.id, name: o.name })));
        }
      }
      const taskTargets = targets.filter((o) => o.Tasks && o.Tasks[eventName]);
      if (taskTargets.length === 0) {
        if (eventName === "onBoundaryHit") {
          console.warn(`[GameRuntime] No targets found for ${eventName} on ${objectId}`);
        }
        return;
      }
      taskTargets.forEach((obj) => {
        const taskName = obj.Tasks[eventName];
        if (!taskName) return;
        const vars = {};
        if (this.project.variables) {
          this.project.variables.forEach((v) => {
            vars[v.name] = this.reactiveRuntime.getVariable(v.name);
          });
        }
        Object.assign(vars, this.globalVars);
        if (this.options.multiplayerManager) {
          const pNum = this.options.multiplayerManager.playerNumber;
          const inRoom = !!this.options.multiplayerManager.roomCode;
          if (inRoom) {
            vars["isPlayer1"] = pNum === 1 ? 1 : 0;
            vars["isPlayer2"] = pNum === 2 ? 1 : 0;
          } else {
            vars["isPlayer1"] = 1;
            vars["isPlayer2"] = 0;
          }
        } else {
          vars["isPlayer1"] = 1;
          vars["isPlayer2"] = 0;
        }
        if (data) {
          Object.assign(vars, data);
        }
        const eventLogId = DebugLogService.getInstance().log("Event", `${obj.name}.${eventName}`, {
          objectName: obj.name,
          eventName,
          data
        });
        this.taskExecutor.execute(taskName, vars, this.globalVars, obj, 0, eventLogId);
        Object.keys(this.globalVars).forEach((name) => {
          if (this.reactiveRuntime.getVariable(name) !== this.globalVars[name]) {
            this.reactiveRuntime.setVariable(name, this.globalVars[name]);
          }
        });
      });
    }
    setVariable(name, value) {
      this.globalVars[name] = value;
      this.reactiveRuntime.setVariable(name, value);
    }
    getVariable(name) {
      return this.globalVars[name] !== void 0 ? this.globalVars[name] : this.reactiveRuntime.getVariable(name);
    }
    getObjects() {
      return this.objects;
    }
    getGlobalState() {
      return { ...this.globalVars };
    }
    /**
     * Berechnet die Startposition für ein Objekt basierend auf dem Fly-In Muster.
     */
    getPatternStartPosition(pattern, targetX, targetY, index, stage) {
      const cols = stage.grid?.cols || stage.cols || 32;
      const rows = stage.grid?.rows || stage.rows || 24;
      const outsideMargin = 10;
      switch (pattern) {
        case "UpLeft":
          return { x: -outsideMargin, y: -outsideMargin };
        case "UpMiddle":
          return { x: cols / 2, y: -outsideMargin };
        case "UpRight":
          return { x: cols + outsideMargin, y: -outsideMargin };
        case "Left":
          return { x: -outsideMargin, y: targetY };
        case "Right":
          return { x: cols + outsideMargin, y: targetY };
        case "BottomLeft":
          return { x: -outsideMargin, y: rows + outsideMargin };
        case "BottomMiddle":
          return { x: cols / 2, y: rows + outsideMargin };
        case "BottomRight":
          return { x: cols + outsideMargin, y: rows + outsideMargin };
        case "ChaosIn": {
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.max(cols, rows) + outsideMargin;
          return {
            x: cols / 2 + Math.cos(angle) * distance,
            y: rows / 2 + Math.sin(angle) * distance
          };
        }
        case "ChaosOut":
          return { x: cols / 2, y: rows / 2 };
        case "Matrix":
          return { x: targetX, y: -outsideMargin - index * 2 };
        case "Random": {
          const simplePatterns = ["UpLeft", "UpMiddle", "UpRight", "Left", "Right", "BottomLeft", "BottomMiddle", "BottomRight"];
          const randomPattern = simplePatterns[Math.floor(Math.random() * simplePatterns.length)];
          return this.getPatternStartPosition(randomPattern, targetX, targetY, index, stage);
        }
        default:
          return { x: targetX, y: targetY };
      }
    }
  };

  // src/player-standalone.ts
  window.ExpressionParser = ExpressionParser;
  var UniversalPlayer = class {
    constructor() {
      __publicField(this, "runtime", null);
      __publicField(this, "stage");
      __publicField(this, "techClasses", ["TGameLoop", "TInputController", "TGameState", "TTimer", "TRemoteGameManager", "TGameServer", "THandshake", "THeartbeat"]);
      __publicField(this, "currentProject", null);
      __publicField(this, "isStarted", false);
      __publicField(this, "animationTickerId", null);
      this.stage = document.getElementById("stage");
      this.init();
    }
    async init() {
      window.addEventListener("resize", () => this.setupScaling());
      try {
        await network.connect();
        console.log("[UniversalPlayer] Connected to game server");
      } catch (e) {
        console.warn("[UniversalPlayer] Server not reachable, falling back to offline mode");
      }
      network.on((msg) => this.handleNetworkMessage(msg));
      window.__multiplayerInputCallback = (key, action) => {
        if (network.roomCode) {
          network.sendInput(key, action);
        }
      };
      const params = new URLSearchParams(window.location.search);
      const roomCode = params.get("room");
      const gameFile = params.get("game");
      const hostMode = params.get("host") === "true";
      if (roomCode) {
        console.log(`[UniversalPlayer] Joining room: ${roomCode}`);
        network.joinRoom(roomCode);
        this.showOverlay("Beitritt zum Raum...", roomCode);
      } else if (gameFile && hostMode) {
        console.log(`[UniversalPlayer] Hosting multiplayer game: ${gameFile}`);
        const baseUrl = network.getHttpUrl();
        await this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
        network.createRoom(gameFile);
        this.showOverlay("Raum wird erstellt...", "");
      } else if (gameFile) {
        console.log(`[UniversalPlayer] Loading game: ${gameFile}`);
        const baseUrl = network.getHttpUrl();
        await this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
      } else if (window.PROJECT) {
        console.log("[UniversalPlayer] Loading embedded project");
        this.startProject(window.PROJECT);
      } else {
        console.log("[UniversalPlayer] No game selected, loading lobby...");
        await this.loadProjectFromUrl("./multiplayer/lobby.json");
      }
    }
    handleNetworkMessage(msg) {
      switch (msg.type) {
        case "project_data":
          console.log("[UniversalPlayer] Received project JSON from server");
          this.startProject(msg.project);
          break;
        case "room_created":
          this.showOverlay("Raum erstellt", msg.roomCode);
          if (this.currentProject) {
            network.syncProject(this.currentProject);
          }
          network.ready();
          break;
        case "room_joined":
          this.showOverlay("Raum beigetreten", msg.roomCode);
          break;
        case "game_start":
          this.hideOverlay();
          if (this.runtime) {
            console.log(`[UniversalPlayer] Game Start received, triggering onGameStart`);
            this.runtime.handleEvent("global", "onGameStart");
          }
          break;
        case "remote_state":
          if (this.runtime) {
            console.log(`[NET] Received state for ${msg.objectId}:`, msg.state || msg);
            this.runtime.updateRemoteState(msg.objectId, msg.state || msg);
          }
          break;
        case "remote_event":
          if (this.runtime) {
            console.log(`[UniversalPlayer] Received remote_event: ${msg.objectId}.${msg.eventName}`);
            this.runtime.triggerRemoteEvent(msg.objectId, msg.eventName, msg.params);
          }
          break;
        case "remote_input":
          if (this.runtime) {
            const controllers = this.runtime.getObjects().filter((o) => o.className === "TInputController");
            controllers.forEach((ic) => {
              if (msg.action === "down") ic.simulateKeyPress(msg.key);
              else ic.simulateKeyRelease(msg.key);
            });
          }
          break;
        case "remote_action":
          if (this.runtime) {
            console.log(`[UniversalPlayer] Received remote_action from P${msg.player}:`, msg.action);
            this.runtime.executeRemoteAction(msg.action);
          }
          break;
        case "remote_task":
          if (this.runtime) {
            console.log(`[UniversalPlayer] Received remote_task: ${msg.taskName} (mode: ${msg.mode})`);
            this.runtime.executeRemoteTask(msg.taskName, msg.params, msg.mode);
          }
          break;
      }
    }
    async loadProjectFromUrl(url) {
      try {
        const resp = await fetch(url);
        if (resp.ok) {
          const project = await resp.json();
          this.startProject(project);
        } else {
          console.error(`[UniversalPlayer] Failed to load project from ${url}`);
          if (url !== "./multiplayer/lobby.json") {
            await this.loadProjectFromUrl("./multiplayer/lobby.json");
          }
        }
      } catch (e) {
        console.error("[UniversalPlayer] Error fetching project:", e);
      }
    }
    startProject(project) {
      if (this.isStarted && this.currentProject === project) return;
      this.isStarted = true;
      if (this.runtime) {
        this.runtime.stop();
        this.stopAnimationTicker();
        this.stage.innerHTML = "";
      }
      this.currentProject = project;
      this.runtime = new GameRuntime(project, void 0, {
        onRender: () => this.render(),
        multiplayerManager: network,
        onNavigate: (target) => this.handleNavigation(target)
      });
      this.setupScaling();
      this.render();
      if (this.runtime) {
        this.runtime.start();
        this.startAnimationTicker();
      }
      console.log(`[UniversalPlayer] Project "${project.meta?.name}" started`);
      if (network.roomCode) {
        console.log(`[UniversalPlayer] Signalling ready to server as Player ${network.playerNumber}`);
        network.ready();
        if (network.playerNumber === 1) {
          network.syncProject(project);
        }
      }
    }
    handleNavigation(target) {
      console.log(`[UniversalPlayer] Navigating to: ${target}`);
      if (target.startsWith("game:")) {
        const gameFile = target.replace("game:", "");
        const baseUrl = network.getHttpUrl();
        this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`);
      } else if (target.startsWith("host:")) {
        const gameFile = target.replace("host:", "");
        const baseUrl = network.getHttpUrl();
        this.loadProjectFromUrl(`${baseUrl}/platform/games/${gameFile}`).then(() => {
          console.log(`[UniversalPlayer] Hosting game: ${gameFile}`);
          network.createRoom(gameFile);
        });
      } else if (target === "lobby") {
        this.loadProjectFromUrl("./multiplayer/lobby.json");
      } else if (target.startsWith("room:")) {
        const code = target.replace("room:", "");
        network.joinRoom(code);
        this.showOverlay("Beitritt zum Raum...", code);
      }
    }
    setupScaling() {
      if (!this.currentProject) return;
      const grid = this.currentProject.stage.grid;
      const stageWidth = grid.cols * grid.cellSize;
      const stageHeight = grid.rows * grid.cellSize;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const margin = 20;
      const scale = Math.min((windowWidth - margin) / stageWidth, (windowHeight - margin) / stageHeight, 1);
      this.stage.style.width = `${stageWidth}px`;
      this.stage.style.height = `${stageHeight}px`;
      this.stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
      this.stage.style.left = "50%";
      this.stage.style.top = "50%";
      this.stage.style.position = "absolute";
      const bg = grid.backgroundColor || "#000";
      const bgImg = this.currentProject.stage.backgroundImage;
      if (bgImg) {
        const url = bgImg.startsWith("http") || bgImg.startsWith("/") || bgImg.startsWith("data:") ? bgImg : `./images/${bgImg}`;
        this.stage.style.background = `url("${url}") center center / ${this.currentProject.stage.objectFit || "cover"} no-repeat, ${bg}`;
      } else {
        this.stage.style.background = bg;
      }
    }
    startAnimationTicker() {
      if (this.animationTickerId) return;
      const tick = () => {
        if (!this.isStarted) return;
        const am = window.AnimationManager || this.getAnimationManager();
        if (am) am.getInstance().update();
        this.render();
        this.animationTickerId = requestAnimationFrame(tick);
      };
      this.animationTickerId = requestAnimationFrame(tick);
    }
    stopAnimationTicker() {
      if (this.animationTickerId) {
        cancelAnimationFrame(this.animationTickerId);
        this.animationTickerId = null;
      }
    }
    // Helper to get AnimationManager from bundle if needed
    getAnimationManager() {
      try {
        const { AnimationManager: AnimationManager2 } = (init_AnimationManager(), __toCommonJS(AnimationManager_exports));
        return AnimationManager2;
      } catch (e) {
        return window.AnimationManager;
      }
    }
    render() {
      if (!this.runtime) return;
      const objects = this.runtime.getObjects();
      const cellSize = this.currentProject.stage.grid.cellSize;
      const grid = this.currentProject.stage.grid;
      const stageWidth = grid.cols * cellSize;
      const stageHeight = grid.rows * cellSize;
      const dockArea = { left: 0, top: 0, right: stageWidth, bottom: stageHeight };
      const dockPositions = /* @__PURE__ */ new Map();
      objects.forEach((obj) => {
        const align = obj.align || "NONE";
        if (align === "NONE" || align === "CLIENT") return;
        const objId = obj.id;
        if (!objId) return;
        const objHeight = (obj.height || 0) * cellSize;
        const objWidth = (obj.width || 0) * cellSize;
        const availableWidth = dockArea.right - dockArea.left;
        const availableHeight = dockArea.bottom - dockArea.top;
        if (align === "TOP") {
          dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: availableWidth, height: objHeight });
          dockArea.top += objHeight;
        } else if (align === "BOTTOM") {
          dockPositions.set(objId, { left: dockArea.left, top: dockArea.bottom - objHeight, width: availableWidth, height: objHeight });
          dockArea.bottom -= objHeight;
        } else if (align === "LEFT") {
          dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: objWidth, height: availableHeight });
          dockArea.left += objWidth;
        } else if (align === "RIGHT") {
          dockPositions.set(objId, { left: dockArea.right - objWidth, top: dockArea.top, width: objWidth, height: availableHeight });
          dockArea.right -= objWidth;
        }
      });
      objects.forEach((obj) => {
        const align = obj.align || "NONE";
        if (align !== "CLIENT") return;
        const objId = obj.id;
        if (!objId) return;
        dockPositions.set(objId, {
          left: dockArea.left,
          top: dockArea.top,
          width: dockArea.right - dockArea.left,
          height: dockArea.bottom - dockArea.top
        });
      });
      const currentIds = new Set(objects.map((o) => o.id));
      const rendered = Array.from(this.stage.querySelectorAll(".game-object"));
      rendered.forEach((el) => {
        if (!currentIds.has(el.id)) el.remove();
      });
      objects.forEach((obj) => {
        if (this.techClasses.includes(obj.className)) return;
        const isVisible = obj.style?.visible !== false && obj.visible !== false;
        let el = document.getElementById(obj.id);
        if (!isVisible) {
          if (el) el.remove();
          return;
        }
        if (!el) {
          el = document.createElement("div");
          el.id = obj.id;
          el.className = "game-object";
          this.stage.appendChild(el);
        }
        const dockPos = dockPositions.get(obj.id);
        if (dockPos) {
          const offsetX = (obj.x || 0) * cellSize;
          const offsetY = (obj.y || 0) * cellSize;
          el.style.left = `${dockPos.left + offsetX}px`;
          el.style.top = `${dockPos.top + offsetY}px`;
          el.style.width = `${dockPos.width}px`;
          el.style.height = `${dockPos.height}px`;
        } else {
          el.style.left = `${(obj.x || 0) * cellSize}px`;
          el.style.top = `${(obj.y || 0) * cellSize}px`;
          el.style.width = `${(obj.width || 0) * cellSize}px`;
          el.style.height = `${(obj.height || 0) * cellSize}px`;
        }
        el.style.zIndex = String(obj.zIndex || 0);
        if (obj.style && obj.style.opacity !== void 0) {
          el.style.opacity = String(obj.style.opacity);
        } else {
          el.style.opacity = "1";
        }
        if (obj.style) {
          el.style.backgroundColor = obj.style.backgroundColor || "transparent";
          el.style.color = obj.style.color || "inherit";
          el.style.fontSize = (obj.style.fontSize || 16) + "px";
          el.style.textAlign = obj.style.textAlign || "left";
          el.style.border = `${obj.style.borderWidth || 0}px solid ${obj.style.borderColor || "transparent"}`;
          el.style.borderRadius = (obj.style.borderRadius || 0) + "px";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = obj.style.textAlign === "center" ? "center" : "flex-start";
          el.style.padding = obj.style.textAlign === "center" ? "0" : "0 10px";
        }
        this.renderComponentContent(el, obj);
      });
    }
    renderComponentContent(el, obj) {
      const type = obj.className;
      switch (type) {
        case "TImage": {
          el.innerHTML = "";
          const img = document.createElement("img");
          const src = obj.src || obj.backgroundImage || "";
          if (src) {
            img.src = src.startsWith("http") || src.startsWith("/") || src.startsWith("data:") ? src : `./images/${src}`;
          }
          img.style.width = "100%";
          img.style.height = "100%";
          img.style.objectFit = obj.objectFit || "contain";
          img.style.opacity = String(obj.imageOpacity ?? 1);
          img.style.display = src ? "block" : "none";
          el.appendChild(img);
          break;
        }
        case "TSprite": {
          el.style.backgroundColor = obj.spriteColor || el.style.backgroundColor;
          if (obj.shape === "circle") el.style.borderRadius = "50%";
          const bgImg = obj.backgroundImage;
          if (bgImg) {
            const url = bgImg.startsWith("http") || bgImg.startsWith("/") || bgImg.startsWith("data:") ? bgImg : `./images/${bgImg}`;
            el.style.backgroundImage = `url("${url}")`;
            el.style.backgroundSize = obj.objectFit || "cover";
            el.style.backgroundPosition = "center";
            el.style.backgroundRepeat = "no-repeat";
          } else {
            el.style.backgroundImage = "none";
          }
          break;
        }
        case "TButton":
          el.innerText = obj.caption || obj.name;
          el.style.cursor = "pointer";
          if (obj.icon) {
            const iconUrl = obj.icon.startsWith("http") || obj.icon.startsWith("/") || obj.icon.startsWith("data:") ? obj.icon : `./images/${obj.icon}`;
            el.style.display = "flex";
            el.style.gap = "8px";
            el.style.alignItems = "center";
            el.style.justifyContent = "center";
            el.innerHTML = `<img src="${iconUrl}" style="height: 1.2em; width: auto;"> <span>${obj.caption || obj.name}</span>`;
          }
          if (!el.onclick) {
            el.onclick = () => this.runtime?.handleEvent(obj.id, "onClick");
          }
          break;
        case "TLabel":
        case "TNumberLabel":
        case "TGameHeader":
          const labelText = obj.text !== void 0 && obj.text !== null ? String(obj.text) : obj.value !== void 0 && obj.value !== null ? String(obj.value) : obj.title || obj.caption || "";
          el.innerText = labelText;
          break;
        case "TEdit":
          if (!el.querySelector("input")) {
            el.innerHTML = "";
            const input = document.createElement("input");
            input.type = "text";
            input.style.width = "100%";
            input.style.height = "100%";
            input.style.border = "none";
            input.style.background = "transparent";
            input.style.padding = "0 10px";
            input.style.color = "inherit";
            input.style.fontSize = "inherit";
            input.style.textAlign = "center";
            input.style.outline = "none";
            input.oninput = () => {
              obj.text = input.value;
            };
            el.appendChild(input);
          }
          const ti = el.querySelector("input");
          const editValue = obj.text !== void 0 && obj.text !== null ? String(obj.text) : "";
          if (ti.value !== editValue) {
            ti.value = editValue;
          }
          break;
      }
    }
    showOverlay(text, subtext) {
      let overlay = document.getElementById("player-overlay");
      if (!overlay) {
        overlay = document.createElement("div");
        overlay.id = "player-overlay";
        overlay.style.cssText = `
                position: fixed; top: 0; left: 0; width: 100%; height: 100%;
                background: rgba(0,0,0,0.85); color: white; z-index: 20000;
                display: flex; flex-direction: column; align-items: center; justify-content: center;
                font-family: sans-serif; backdrop-filter: blur(5px);
            `;
        document.body.appendChild(overlay);
      }
      overlay.innerHTML = `
            <div style="font-size: 24px; font-weight: bold; margin-bottom: 10px;">${text}</div>
            ${subtext ? `<div style="font-size: 48px; color: #4fc3f7; letter-spacing: 5px;">${subtext}</div>` : ""}
            <div style="margin-top: 40px; color: #888; font-size: 14px;">Warten auf Gegenspieler...</div>
        `;
      overlay.style.display = "flex";
    }
    hideOverlay() {
      const overlay = document.getElementById("player-overlay");
      if (overlay) overlay.style.display = "none";
    }
  };
  document.addEventListener("DOMContentLoaded", () => {
    window.player = new UniversalPlayer();
  });
  window.startStandalone = (project) => {
    console.log("[UniversalPlayer] Standalone trigger received");
    const player = window.player;
    if (player && typeof player.startProject === "function") {
      player.startProject(project);
    } else {
      window.PROJECT = project;
    }
  };
})();
