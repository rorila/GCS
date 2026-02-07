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
          console.log(`[AnimationManager.addTween] START: target=${target?.name || target?.id}, property=${property}, to=${to}, duration=${duration}, easing=${easingName}`);
          const previousCount = this.activeTweens.length;
          this.cancelTween(target, property);
          if (this.activeTweens.length !== previousCount) {
            console.log(`[AnimationManager.addTween] Cancelled existing tween for ${property}, tweens: ${previousCount} -> ${this.activeTweens.length}`);
          }
          const from = this.getPropertyValue(target, property);
          console.log(`[AnimationManager.addTween] Current value of ${property}: ${from}`);
          const easing = Easing[easingName] || Easing.easeOut;
          if (!Easing[easingName]) {
            console.warn(`[AnimationManager.addTween] Unknown easing "${easingName}", falling back to easeOut`);
          }
          if (property === "x" || property === "y") {
            target.isAnimating = true;
            console.log(`[AnimationManager.addTween] Set isAnimating=true on ${target?.name || target?.id}`);
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
          console.log(`[AnimationManager.addTween] END: Added tween, total active tweens: ${this.activeTweens.length}`);
          return tween;
        }
        /**
         * Animiert mehrere Eigenschaften eines Objekts gleichzeitig.
         */
        animate(target, properties, duration, easingName = "easeOut", onComplete) {
          const keys = Object.keys(properties);
          let completedCount = 0;
          keys.forEach((prop) => {
            this.addTween(target, prop, properties[prop], duration, easingName, () => {
              completedCount++;
              if (completedCount === keys.length && onComplete) {
                onComplete();
              }
            });
          });
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
            console.log(`[AnimationManager.update] Updating ${this.activeTweens.length} active tweens at t=${now.toFixed(0)}`);
          }
          for (const tween of this.activeTweens) {
            try {
              const elapsed = now - tween.startTime;
              let progress = Math.min(elapsed / tween.duration, 1);
              const easedProgress = tween.easing(progress);
              const newValue = tween.from + (tween.to - tween.from) * easedProgress;
              this.setPropertyValue(tween.target, tween.property, newValue);
              if (progress >= 1) {
                this.setPropertyValue(tween.target, tween.property, tween.to);
                console.log(`[AnimationManager] Tween completed for ${tween.target.name || tween.target.id}.${tween.property} (Forced to ${tween.to})`);
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
         * Bricht alle aktiven Tweens ab und leert die Liste.
         */
        clear() {
          this.activeTweens = [];
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
        /**
         * Erzeugt einen Schütteleffekt (Shake) auf einem Objekt.
         * @param target Das Zielobjekt
         * @param intensity Intensität des Schüttelns in Pixeln (default: 5)
         * @param duration Gesamtdauer in Millisekunden (default: 500)
         */
        shake(target, intensity = 5, duration = 500) {
          const originalX = target.x;
          const originalY = target.y;
          const startTime = performance.now();
          const shakeInterval = 50;
          const performShake = () => {
            const now = performance.now();
            const elapsed = now - startTime;
            if (elapsed < duration) {
              const offsetX = (Math.random() - 0.5) * intensity * 2;
              const offsetY = (Math.random() - 0.5) * intensity * 2;
              target.x = originalX + offsetX;
              target.y = originalY + offsetY;
              setTimeout(performShake, shakeInterval);
            } else {
              target.x = originalX;
              target.y = originalY;
            }
          };
          performShake();
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
          return this.valueToString(value);
        } catch (error) {
          console.warn(`[ExpressionParser] Failed to evaluate: ${expression}`, error);
          return match;
        }
      });
      const trimmedText = text.trim();
      if (trimmedText.startsWith("${") && trimmedText.endsWith("}") && !trimmedText.includes("${", 2)) {
        const expression = trimmedText.slice(2, -1).trim();
        try {
          const value = this.evaluate(expression, context);
          if (value !== null && typeof value === "object") {
            return this.valueToString(value);
          }
          return value;
        } catch (error) {
          return result;
        }
      }
      return result;
    }
    /**
     * Converts any value to a human-readable string representation
     */
    static valueToString(value) {
      if (value === void 0 || value === null) return "";
      if (typeof value === "string") return value;
      if (typeof value === "number" || typeof value === "boolean") return String(value);
      if (value.isVariable === true) {
        if (value.value !== void 0) return this.valueToString(value.value);
        if (Array.isArray(value.items)) return this.valueToString(value.items);
      }
      if (Array.isArray(value)) {
        return value.map((v) => this.valueToString(v)).join(", ");
      }
      if (value.name && typeof value.name === "string") {
        return value.name;
      }
      try {
        if (value.className) return `[${value.className}]`;
        if (value.constructor && value.constructor.name !== "Object") {
          return `[${value.constructor.name}]`;
        }
        const json = JSON.stringify(value);
        return json.length > 50 ? json.substring(0, 47) + "..." : json;
      } catch (e) {
        return "[Object]";
      }
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
    /**
     * Evaluates an expression and returns the raw value (preserving type)
     */
    static evaluateRaw(expression, context) {
      if (expression.startsWith("${") && expression.endsWith("}")) {
        expression = expression.slice(2, -1).trim();
      }
      return this.evaluate(expression, context);
    }
  };

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
  var globalScope = typeof window !== "undefined" ? window : global;
  var debugLogService = globalScope._globalDebugLogService || DebugLogService.getInstance();
  globalScope._globalDebugLogService = debugLogService;

  // src/runtime/PropertyWatcher.ts
  var PropertyWatcher = class {
    constructor() {
      // Map: Object -> Map: PropertyPath -> Set of Callbacks
      __publicField(this, "watchers", /* @__PURE__ */ new Map());
      // Global listeners called for ANY property change
      __publicField(this, "globalListeners", /* @__PURE__ */ new Set());
    }
    /**
     * Helper to get the raw object if it's a proxy
     */
    unwrap(obj) {
      if (obj !== null && typeof obj === "object" && obj.__isProxy__) {
        return obj.__target__;
      }
      return obj;
    }
    /**
     * Registers a watcher for a specific property
     * @param object Object to watch
     * @param propertyPath Property path (e.g., "score" or "style.color")
     * @param callback Function to call when property changes
     */
    watch(object, propertyPath, callback) {
      const target = this.unwrap(object);
      if (!target || typeof target !== "object") {
        console.warn("[PropertyWatcher] Cannot watch non-object:", target);
        return;
      }
      if (!this.watchers.has(target)) {
        this.watchers.set(target, /* @__PURE__ */ new Map());
      }
      const objectWatchers = this.watchers.get(target);
      if (!objectWatchers.has(propertyPath)) {
        objectWatchers.set(propertyPath, /* @__PURE__ */ new Set());
      }
      objectWatchers.get(propertyPath).add(callback);
    }
    /**
     * Adds a global listener
     */
    addGlobalListener(callback) {
      this.globalListeners.add(callback);
    }
    /**
     * Removes a global listener
     */
    removeGlobalListener(callback) {
      this.globalListeners.delete(callback);
    }
    /**
     * Removes a specific watcher
     * @param object Object being watched
     * @param propertyPath Property path
     * @param callback Callback to remove (if omitted, removes all callbacks for this property)
     */
    unwatch(object, propertyPath, callback) {
      const target = this.unwrap(object);
      const objectWatchers = this.watchers.get(target);
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
        this.watchers.delete(target);
      }
    }
    /**
     * Removes all watchers for an object
     * @param object Object to stop watching
     */
    unwatchAll(object) {
      this.watchers.delete(this.unwrap(object));
    }
    /**
     * Notifies all watchers that a property has changed
     * @param object Object that changed
     * @param propertyPath Property that changed
     * @param newValue New value
     * @param oldValue Old value (optional)
     */
    notify(object, propertyPath, newValue, oldValue) {
      const target = this.unwrap(object);
      const objectWatchers = this.watchers.get(target);
      const objName = target.name || target.id || "Unknown";
      if (DebugLogService.getInstance().isEnabled()) {
        const displayNew = typeof newValue === "object" ? JSON.stringify(newValue).substring(0, 50) : newValue;
        const displayOld = typeof oldValue === "object" ? JSON.stringify(oldValue).substring(0, 50) : oldValue;
        DebugLogService.getInstance().log(
          "Variable",
          `${objName}.${propertyPath} changed: ${displayOld} -> ${displayNew}`,
          {
            objectName: objName,
            data: { newValue, oldValue }
          }
        );
      }
      if (!objectWatchers) {
        this.notifyGlobal(target, propertyPath, newValue, oldValue);
        return;
      }
      const propertyWatchers = objectWatchers.get(propertyPath);
      if (propertyWatchers && propertyWatchers.size > 0) {
        console.log(`[PropertyWatcher] Notifying ${propertyWatchers.size} listeners for ${objName}.${propertyPath}`);
        propertyWatchers.forEach((callback) => {
          try {
            callback(newValue, oldValue);
          } catch (error) {
            console.error("[PropertyWatcher] Callback error:", error);
          }
        });
      }
      this.notifyGlobal(target, propertyPath, newValue, oldValue);
    }
    /**
     * Gets the number of watchers for a specific property
     */
    getWatcherCount(object, propertyPath) {
      const target = this.unwrap(object);
      const objectWatchers = this.watchers.get(target);
      if (!objectWatchers) return 0;
      const propertyWatchers = objectWatchers.get(propertyPath);
      return propertyWatchers ? propertyWatchers.size : 0;
    }
    notifyGlobal(object, propertyPath, newValue, oldValue) {
      this.globalListeners.forEach((callback) => {
        try {
          callback(object, propertyPath, newValue, oldValue);
        } catch (error) {
          console.error("[PropertyWatcher] Global callback error:", error);
        }
      });
    }
    /**
     * Gets total number of watched objects
     */
    getTotalWatchedObjects() {
      return this.watchers.size;
    }
    /**
     * Gets total number of watchers across all objects
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
     * Clears all watchers (useful for cleanup)
     */
    clear() {
      this.watchers.clear();
      this.globalListeners.clear();
    }
    /**
     * Debug: Lists all active watchers
     */
    debug() {
      console.log("[PropertyWatcher] Active Watchers:");
      this.watchers.forEach((objectWatchers, object) => {
        const objName = object.name || object.id || "Unknown";
        objectWatchers.forEach((callbacks, propertyPath) => {
          console.log(`  ${objName}.${propertyPath}: ${callbacks.size} watchers`);
        });
      });
    }
  };

  // src/runtime/ReactiveProperty.ts
  function makeReactive(obj, watcher, path = "", root = null) {
    if (obj === null || typeof obj !== "object") {
      return obj;
    }
    if (obj instanceof HTMLElement || obj instanceof Node || obj instanceof Set || obj instanceof Map || obj instanceof Date || obj instanceof RegExp) {
      return obj;
    }
    const actualRoot = root || obj;
    return new Proxy(obj, {
      get(target, property) {
        if (property === "__isProxy__") return true;
        if (property === "__target__") return target;
        if (typeof property === "symbol") {
          return target[property];
        }
        const value = target[property];
        if (value && typeof value === "object" && !(value instanceof HTMLElement) && !(value instanceof Set) && !(value instanceof Map) && !(value instanceof Date) && !(value instanceof RegExp)) {
          const nestedPath = path ? `${path}.${property}` : property;
          return makeReactive(value, watcher, nestedPath, actualRoot);
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
          const objName = actualRoot.name || actualRoot.id || "Unknown";
          console.log(`%c[Proxy] Set ${objName}.${propertyPath} = ${newValue}`, "color: #2196f3");
          watcher.notify(actualRoot, propertyPath, newValue, oldValue);
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
      const excludeFromProxy = ["TGameLoop", "TGameState", "TInputController"];
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
          const targetName = targetObj.name || targetObj.id || "Unknown";
          console.debug(`%c[Binding] Updating ${targetName}.${targetProp} \u2190 ${newValue}`, "color: #9c27b0; font-weight: bold");
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
          if (!propPath && sourceObj.isVariable === true) {
            console.log(`[ReactiveRuntime] Deep watch enabled for variable: ${objName}.value`);
            this.watcher.watch(sourceObj, "value", () => binding.update());
            this.watcher.watch(sourceObj, "items", () => binding.update());
          }
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
      this.variables.forEach((value, name) => {
        context[name] = value;
      });
      this.objectsByName.forEach((obj, name) => {
        context[name] = obj;
      });
      this.objectsById.forEach((obj, id) => {
        if (!context[id]) context[id] = obj;
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
     * Returns the property watcher instance
     */
    getWatcher() {
      return this.watcher;
    }
    /**
     * Returns all registered objects (proxies)
     */
    getObjects() {
      return Array.from(this.objectsById.values());
    }
  };

  // src/runtime/ActionRegistry.ts
  var _ActionRegistry = class _ActionRegistry {
    constructor() {
      __publicField(this, "handlers", /* @__PURE__ */ new Map());
      __publicField(this, "metadata", /* @__PURE__ */ new Map());
    }
    static getInstance() {
      if (!_ActionRegistry.instance) {
        _ActionRegistry.instance = new _ActionRegistry();
      }
      return _ActionRegistry.instance;
    }
    register(type, handler, meta) {
      this.handlers.set(type, handler);
      if (meta) {
        this.metadata.set(type, meta);
      }
    }
    getHandler(type) {
      return this.handlers.get(type);
    }
    getMetadata(type) {
      return this.metadata.get(type);
    }
    getAllMetadata() {
      return Array.from(this.metadata.values());
    }
    hasHandler(type) {
      return this.handlers.has(type);
    }
  };
  __publicField(_ActionRegistry, "instance", null);
  var ActionRegistry = _ActionRegistry;
  var actionRegistry = ActionRegistry.getInstance();

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
        const trimmedPath = path.trim();
        if (trimmedPath === "true") return "true";
        if (trimmedPath === "false") return "false";
        if (!isNaN(Number(trimmedPath))) return trimmedPath;
        if (vars[trimmedPath] !== void 0) return String(vars[trimmedPath]);
        if (objects && trimmedPath.includes(".")) {
          const [objName, ...propParts] = trimmedPath.split(".");
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
    /**
     * Tries to convert a string value back to its likely intended type (number or boolean)
     */
    static autoConvert(value) {
      if (typeof value !== "string") return value;
      if (value === "") return value;
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== "") {
        return num;
      }
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      return value;
    }
  };

  // src/runtime/actions/StandardActions.ts
  init_AnimationManager();

  // src/services/ServiceRegistry.ts
  var ServiceRegistryClass = class {
    constructor() {
      __publicField(this, "id", Math.random().toString(36).substr(2, 9));
      __publicField(this, "services", /* @__PURE__ */ new Map());
      console.log(`%c[ServiceRegistry] INSTANCE CREATED: ${this.id}`, "background: #000; color: #fff; font-size: 14px; padding: 4px;");
      window._serviceRegistryInstances = window._serviceRegistryInstances || [];
      window._serviceRegistryInstances.push(this.id);
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
      console.log(`[ServiceRegistry:${this.id}] Registered service: ${name} with methods:`, methods.map((m) => m.name));
    }
    /**
     * Unregister a service
     */
    unregister(name) {
      this.services.delete(name);
      console.log(`[ServiceRegistry] Unregistered service: ${name} `);
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
      console.log(`[ServiceRegistry] Calling ${serviceName}.${methodName} (`, params, ")");
      try {
        const result = await method.apply(serviceInfo.instance, params || []);
        console.log(`[ServiceRegistry] ${serviceName}.${methodName} returned: `, result);
        return result;
      } catch (error) {
        console.error(`[ServiceRegistry] ${serviceName}.${methodName} threw: `, error);
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
  var globalScope2 = typeof window !== "undefined" ? window : global;
  var serviceRegistry = globalScope2._globalServiceRegistry || new ServiceRegistryClass();
  globalScope2._globalServiceRegistry = serviceRegistry;
  console.log(`[ServiceRegistry] Singleton bound to window. ID: ${serviceRegistry.id}`);

  // src/runtime/actions/StandardActions.ts
  function resolveTarget(targetName, objects, vars, contextObj) {
    if (!targetName) return null;
    if ((targetName === "$eventSource" || targetName === "self" || targetName === "$self") && contextObj) return contextObj;
    if ((targetName === "other" || targetName === "$other") && vars.otherSprite) return vars.otherSprite;
    let actualName = targetName;
    if (targetName.startsWith("${") && targetName.endsWith("}")) {
      const varName = targetName.substring(2, targetName.length - 1);
      const varVal = vars[varName];
      if (varVal && typeof varVal === "object" && varVal.id) return varVal;
      if (varVal) actualName = String(varVal);
    }
    return objects.find((o) => o.name === actualName || o.id === actualName || o.name?.toLowerCase() === actualName.toLowerCase());
  }
  function registerStandardActions(objects) {
    actionRegistry.register("property", (action, context) => {
      const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
      if (target && action.changes) {
        Object.keys(action.changes).forEach((prop) => {
          const rawValue = action.changes[prop];
          const value = PropertyHelper.interpolate(String(rawValue), context.vars, objects);
          PropertyHelper.setPropertyValue(target, prop, PropertyHelper.autoConvert(value));
        });
      }
    }, {
      type: "property",
      label: "Eigenschaft \xE4ndern",
      description: "\xC4ndert eine oder mehrere Eigenschaften eines Objekts.",
      parameters: [
        { name: "target", label: "Ziel-Objekt", type: "object", source: "objects" },
        { name: "changes", label: "\xC4nderungen (JSON)", type: "json", hint: 'Beispiel: { "text": "Hallo", "visible": true }' }
      ]
    });
    actionRegistry.register("variable", (action, context) => {
      const srcObj = resolveTarget(action.source, objects, context.vars, context.contextVars);
      if (srcObj && action.variableName && action.sourceProperty) {
        const val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
        context.vars[action.variableName] = val;
        context.contextVars[action.variableName] = val;
      }
    }, {
      type: "variable",
      label: "Variable setzen",
      description: "Kopiert den Wert einer Objekteigenschaft in eine Variable.",
      parameters: [
        { name: "variableName", label: "Variablen-Name", type: "variable", source: "variables" },
        { name: "source", label: "Quell-Objekt", type: "object", source: "objects" },
        { name: "sourceProperty", label: "Quell-Eigenschaft", type: "string", placeholder: "z.B. x" }
      ]
    });
    actionRegistry.register("calculate", (action, context) => {
      if (action.formula) {
        const result = ExpressionParser.evaluate(action.formula, { ...context.contextVars, ...context.vars });
        if (action.resultVariable) {
          context.vars[action.resultVariable] = result;
          context.contextVars[action.resultVariable] = result;
        }
      }
    }, {
      type: "calculate",
      label: "Berechnung",
      description: "F\xFChrt eine mathematische Berechnung aus.",
      parameters: [
        { name: "resultVariable", label: "Ziel-Variable", type: "variable", source: "variables" },
        { name: "formula", label: "Formel", type: "string", placeholder: "z.B. score + 10" }
      ]
    });
    actionRegistry.register("animate", (action, context) => {
      const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
      if (target) {
        const toValue = Number(PropertyHelper.interpolate(String(action.to), context.vars, objects));
        AnimationManager.getInstance().addTween(target, action.property || "x", toValue, action.duration || 500, action.easing || "easeOut");
      }
    }, {
      type: "animate",
      label: "Animieren",
      description: "Animiert eine Eigenschaft eines Objekts.",
      parameters: [
        { name: "target", label: "Ziel-Objekt", type: "object", source: "objects" },
        { name: "property", label: "Eigenschaft", type: "string", defaultValue: "x" },
        { name: "to", label: "Ziel-Wert", type: "number" },
        { name: "duration", label: "Dauer (ms)", type: "number", defaultValue: 500 },
        { name: "easing", label: "Easing", type: "select", source: "easing-functions", defaultValue: "easeOut" }
      ]
    });
    actionRegistry.register("move_to", (action, context) => {
      const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
      if (target) {
        const toX = Number(PropertyHelper.interpolate(String(action.x), context.vars, objects));
        const toY = Number(PropertyHelper.interpolate(String(action.y), context.vars, objects));
        if (typeof target.moveTo === "function") {
          target.moveTo(toX, toY, action.duration || 500, action.easing || "easeOut");
        } else {
          AnimationManager.getInstance().addTween(target, "x", toX, action.duration || 500, action.easing || "easeOut");
          AnimationManager.getInstance().addTween(target, "y", toY, action.duration || 500, action.easing || "easeOut");
        }
      }
    }, {
      type: "move_to",
      label: "Bewegen zu",
      description: "Bewegt ein Objekt an eine bestimmte Position.",
      parameters: [
        { name: "target", label: "Ziel-Objekt", type: "object", source: "objects" },
        { name: "x", label: "Ziel-X", type: "number" },
        { name: "y", label: "Ziel-Y", type: "number" },
        { name: "duration", label: "Dauer (ms)", type: "number", defaultValue: 500 },
        { name: "easing", label: "Easing", type: "select", source: "easing-functions", defaultValue: "easeOut" }
      ]
    });
    actionRegistry.register("navigate", (action, context) => {
      let targetGame = PropertyHelper.interpolate(action.target, context.vars, objects);
      if (targetGame && context.onNavigate) {
        context.onNavigate(targetGame, action.params);
      }
    }, {
      type: "navigate",
      label: "Spiel wechseln",
      description: "Wechselt zu einem anderen Projekt.",
      parameters: [
        { name: "target", label: "Ziel-Projekt", type: "string" }
      ]
    });
    actionRegistry.register("navigate_stage", (action, context) => {
      const stageId = action.params?.stageId || action.stageId;
      if (stageId && context.onNavigate) {
        const resolved = PropertyHelper.interpolate(String(stageId), context.vars, objects);
        context.onNavigate(`stage:${resolved}`, action.params);
      }
    }, {
      type: "navigate_stage",
      label: "Stage wechseln",
      description: "Wechselt zu einer anderen Stage innerhalb des Projekts.",
      parameters: [
        { name: "stageId", label: "Ziel-Stage", type: "stage", source: "stages" }
      ]
    });
    actionRegistry.register("service", async (action, context) => {
      if (action.service && action.method && serviceRegistry.has(action.service)) {
        const params = Object.values(action.serviceParams || {}).map(
          (v) => PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, objects)
        );
        const result = await serviceRegistry.call(action.service, action.method, params);
        if (action.resultVariable) {
          context.vars[action.resultVariable] = result;
          context.contextVars[action.resultVariable] = result;
        }
      }
    }, {
      type: "service",
      label: "Service aufrufen",
      description: "Ruft eine Methode eines registrierten Services auf.",
      parameters: [
        { name: "service", label: "Service", type: "select", source: "services" },
        { name: "method", label: "Methode", type: "string" },
        { name: "serviceParams", label: "Parameter (JSON)", type: "json" },
        { name: "resultVariable", label: "Ergebnis speichern in", type: "variable", source: "variables" }
      ]
    });
    actionRegistry.register("create_room", (action, context) => {
      if (context.multiplayerManager) {
        let gameName = PropertyHelper.interpolate(action.game, context.vars, objects);
        context.multiplayerManager.createRoom(gameName);
      }
    }, {
      type: "create_room",
      label: "Multiplayer-Raum erstellen",
      description: "Erstellt einen neuen Multiplayer-Raum.",
      parameters: [
        { name: "game", label: "Spiel-Identifikator", type: "string" }
      ]
    });
    actionRegistry.register("join_room", (action, context) => {
      if (context.multiplayerManager) {
        let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), context.vars, objects) : "";
        if (code.length >= 4) {
          context.multiplayerManager.joinRoom(code);
        }
      }
    }, {
      type: "join_room",
      label: "Multiplayer-Raum beitreten",
      description: "Tritt einem Multiplayer-Raum bei.",
      parameters: [
        { name: "code", label: "Raum-Code", type: "string" }
      ]
    });
    actionRegistry.register("http", async (action, context) => {
      const url = PropertyHelper.interpolate(String(action.url || ""), context.vars, objects);
      const method = action.method || "GET";
      let body = null;
      if (method !== "GET" && action.body) {
        const bodyStr = typeof action.body === "object" ? JSON.stringify(action.body) : String(action.body);
        body = PropertyHelper.interpolate(bodyStr, context.vars, objects);
      }
      try {
        const options = {
          method,
          headers: { "Content-Type": "application/json", ...action.headers || {} }
        };
        if (body) options.body = body;
        const response = await fetch(url, options);
        const data = await response.json();
        if (action.resultVariable) {
          context.vars[action.resultVariable] = data;
          context.contextVars[action.resultVariable] = data;
        }
      } catch (err2) {
        console.error("[Action: http] Error:", err2);
      }
    }, {
      type: "http",
      label: "HTTP Request",
      description: "F\xFChrt einen API-Call aus (REST/JSON).",
      parameters: [
        { name: "url", label: "URL", type: "string" },
        { name: "method", label: "Methode", type: "select", options: ["GET", "POST", "PUT", "DELETE"], defaultValue: "GET" },
        { name: "body", label: "Body (JSON-String oder Objekt)", type: "string" },
        { name: "resultVariable", label: "Ergebnis speichern in", type: "variable", source: "variables" }
      ]
    });
    actionRegistry.register("store_token", (action, context) => {
      const key = action.tokenKey || "auth_token";
      const operation = action.operation || "set";
      if (operation === "delete") {
        localStorage.removeItem(key);
      } else {
        const token = PropertyHelper.interpolate(String(action.token || ""), context.vars, objects);
        localStorage.setItem(key, token);
      }
    }, {
      type: "store_token",
      label: "Token speichern/l\xF6schen",
      description: "Verwaltet Authentifizierungs-Token (JWT) im LocalStorage.",
      parameters: [
        { name: "operation", label: "Operation", type: "select", options: ["set", "delete"], defaultValue: "set" },
        { name: "token", label: "Token (Daten)", type: "string" },
        { name: "tokenKey", label: "Speicher-Schl\xFCssel", type: "string", defaultValue: "auth_token" }
      ]
    });
    actionRegistry.register("show_toast", (action, context) => {
      const message = PropertyHelper.interpolate(String(action.message || ""), context.vars, objects);
      const toastType = action.toastType || "info";
      const toaster = objects.find((o) => o.className === "TToast" || o.constructor?.name === "TToast");
      if (toaster && typeof toaster.show === "function") {
        toaster.show(message, toastType);
      } else {
        console.log(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
      }
    }, {
      type: "show_toast",
      label: "Toast anzeigen",
      description: "Blendet eine kurze Nachricht am Bildschirmrand ein.",
      parameters: [
        { name: "message", label: "Nachricht", type: "string" },
        { name: "toastType", label: "Typ", type: "select", options: ["info", "success", "warning", "error"], defaultValue: "info" }
      ]
    });
    actionRegistry.register("respond_http", async (action, context) => {
      const requestId = PropertyHelper.interpolate(String(action.requestId || ""), context.vars, objects);
      const status = Number(PropertyHelper.interpolate(String(action.status || 200), context.vars, objects));
      const dataStr = typeof action.data === "object" ? JSON.stringify(action.data) : String(action.data || "{}");
      const data = JSON.parse(PropertyHelper.interpolate(dataStr, context.vars, objects));
      if (requestId && serviceRegistry.has("HttpServer")) {
        await serviceRegistry.call("HttpServer", "respond", [requestId, status, data]);
      } else {
        console.warn("[Action: respond_http] Konnte Antwort nicht senden. requestId fehlt oder HttpServer nicht registriert.");
      }
    }, {
      type: "respond_http",
      label: "HTTP Antwort senden",
      description: "Sendet eine Antwort auf einen eingehenden HTTP-Request (nur im Server-Modus).",
      parameters: [
        { name: "requestId", label: "Request ID", type: "string", hint: "Wird automatisch vom onRequest-Event bereitgestellt." },
        { name: "status", label: "HTTP Status", type: "number", defaultValue: 200 },
        { name: "data", label: "Antwort-Daten (JSON)", type: "string", hint: "Das Objekt, das als JSON gesendet wird." }
      ]
    });
    actionRegistry.register("db_save", async (action, context) => {
      const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
      const storagePath = PropertyHelper.interpolate(target?.storagePath || action.storagePath || "data.json", context.vars, objects);
      const collection = PropertyHelper.interpolate(action.collection || target?.defaultCollection || "items", context.vars, objects);
      const dataStr = typeof action.data === "object" ? JSON.stringify(action.data) : String(action.data || "{}");
      const data = JSON.parse(PropertyHelper.interpolate(dataStr, context.vars, objects));
      const result = await serviceRegistry.call("Data", "saveItem", [storagePath, collection, data]);
      if (action.resultVariable) {
        context.vars[action.resultVariable] = result;
        context.contextVars[action.resultVariable] = result;
      }
      if (target && typeof target.triggerEvent === "function") {
        target.triggerEvent("onDataChanged", { collection, operation: "save", item: result });
        target.triggerEvent("onSave", { collection, item: result });
      }
    }, {
      type: "db_save",
      label: "DB: Speichern",
      description: "Speichert oder aktualisiert ein Objekt in der Datenbank.",
      parameters: [
        { name: "target", label: "DataStore Objekt", type: "object", source: "objects" },
        { name: "collection", label: "Collection", type: "string", placeholder: "z.B. users" },
        { name: "data", label: "Daten (JSON)", type: "string" },
        { name: "resultVariable", label: "Ergebnis (mit ID) speichern in", type: "variable", source: "variables" }
      ]
    });
    actionRegistry.register("db_find", async (action, context) => {
      const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
      const storagePath = PropertyHelper.interpolate(target?.storagePath || action.storagePath || "data.json", context.vars, objects);
      const collection = PropertyHelper.interpolate(action.collection || target?.defaultCollection || "items", context.vars, objects);
      const queryStr = typeof action.query === "object" ? JSON.stringify(action.query) : String(action.query || "{}");
      const query = JSON.parse(PropertyHelper.interpolate(queryStr, context.vars, objects));
      const results = await serviceRegistry.call("Data", "findItems", [storagePath, collection, query]);
      if (action.resultVariable) {
        context.vars[action.resultVariable] = results;
        context.contextVars[action.resultVariable] = results;
      }
    }, {
      type: "db_find",
      label: "DB: Suchen",
      description: "Sucht Objekte in der Datenbank anhand von Filtern.",
      parameters: [
        { name: "target", label: "DataStore Objekt", type: "object", source: "objects" },
        { name: "collection", label: "Collection", type: "string", placeholder: "z.B. users" },
        { name: "query", label: "Filter (JSON)", type: "string", hint: 'Beispiel: { "name": "Rolf" }' },
        { name: "resultVariable", label: "Ergebnisse speichern in", type: "variable", source: "variables" }
      ]
    });
    actionRegistry.register("db_delete", async (action, context) => {
      const target = resolveTarget(action.target, objects, context.vars, context.contextVars);
      const storagePath = PropertyHelper.interpolate(target?.storagePath || action.storagePath || "data.json", context.vars, objects);
      const collection = PropertyHelper.interpolate(action.collection || target?.defaultCollection || "items", context.vars, objects);
      const id = PropertyHelper.interpolate(String(action.id || ""), context.vars, objects);
      const success = await serviceRegistry.call("Data", "deleteItem", [storagePath, collection, id]);
      if (action.resultVariable) {
        context.vars[action.resultVariable] = success;
        context.contextVars[action.resultVariable] = success;
      }
      if (success && target && typeof target.triggerEvent === "function") {
        target.triggerEvent("onDataChanged", { collection, operation: "delete", id });
        target.triggerEvent("onDelete", { collection, id });
      }
    }, {
      type: "db_delete",
      label: "DB: L\xF6schen",
      description: "L\xF6scht ein Objekt aus der Datenbank.",
      parameters: [
        { name: "target", label: "DataStore Objekt", type: "object", source: "objects" },
        { name: "collection", label: "Collection", type: "string", placeholder: "z.B. users" },
        { name: "id", label: "ID des Objekts", type: "string" },
        { name: "resultVariable", label: "Erfolg (true/false) speichern in", type: "variable", source: "variables" }
      ]
    });
  }

  // src/runtime/ActionExecutor.ts
  var ActionExecutor = class {
    constructor(objects, multiplayerManager, onNavigate) {
      this.objects = objects;
      this.multiplayerManager = multiplayerManager;
      this.onNavigate = onNavigate;
      registerStandardActions(this.objects);
    }
    setObjects(objects) {
      this.objects = objects;
      registerStandardActions(this.objects);
    }
    /**
     * Executes a single action
     */
    async execute(action, vars, globalVars = {}, contextObj, parentId) {
      if (!action || !action.type) return;
      const actionName = action.name || this.getDescriptiveName(action);
      DebugLogService.getInstance().log("Action", actionName, {
        parentId,
        data: action
      });
      console.log(`%c[Action] Executing: type="${action.type}"`, "color: #4caf50", action);
      const handler = actionRegistry.getHandler(action.type);
      if (handler) {
        await handler(action, {
          vars,
          contextVars: globalVars,
          eventData: contextObj,
          multiplayerManager: this.multiplayerManager,
          onNavigate: this.onNavigate
        });
        return;
      }
      if (!handler) {
        console.warn(`[ActionExecutor] Unknown action type: ${action.type}`);
      }
    }
    getDescriptiveName(action) {
      const meta = actionRegistry.getMetadata(action.type);
      if (meta) {
        let name = meta.label;
        if (action.target) name += ` auf ${action.target}`;
        else if (action.variableName) name += ` (${action.variableName})`;
        return name;
      }
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
        case "shake":
          return `Shake ${action.target}`;
        default:
          return `Action: ${action.type || "unknown"}`;
      }
    }
  };

  // src/services/LibraryService.ts
  var LibraryService = class {
    constructor() {
      __publicField(this, "libraryTasks", []);
      __publicField(this, "libraryTemplates", []);
      __publicField(this, "isLoaded", false);
    }
    async loadLibrary() {
      if (this.isLoaded) return;
      try {
        const response = await fetch("/library.json");
        const data = await response.json();
        this.libraryTasks = data.tasks || [];
        this.libraryTemplates = data.templates || [];
        this.isLoaded = true;
        console.log(`[LibraryService] Loaded ${this.libraryTasks.length} tasks and ${this.libraryTemplates.length} templates.`);
      } catch (err2) {
        console.error("[LibraryService] Failed to load library.json:", err2);
      }
    }
    getTasks() {
      return this.libraryTasks;
    }
    getTask(name) {
      return this.libraryTasks.find((t) => t.name === name);
    }
    getTemplates() {
      return this.libraryTemplates;
    }
    getTemplate(id) {
      return this.libraryTemplates.find((t) => t.id === id);
    }
    /**
     * Saves a template to the library via the API.
     * Updates local cache if successful.
     */
    async saveTemplate(template) {
      try {
        const response = await fetch("/api/library/templates", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(template)
        });
        if (response.ok) {
          const existingIdx = this.libraryTemplates.findIndex((t) => t.name === template.name);
          if (existingIdx !== -1) {
            this.libraryTemplates[existingIdx] = template;
          } else {
            this.libraryTemplates.push(template);
          }
          console.log(`[LibraryService] Template "${template.name}" saved successfully.`);
          return true;
        } else {
          console.error("[LibraryService] Failed to save template:", await response.text());
          return false;
        }
      } catch (err2) {
        console.error("[LibraryService] Error saving template:", err2);
        return false;
      }
    }
  };
  var libraryService = new LibraryService();

  // src/runtime/TaskExecutor.ts
  var _TaskExecutor = class _TaskExecutor {
    // Prevent infinite loops
    constructor(project, actions, actionExecutor, flowCharts, multiplayerManager, tasks) {
      this.project = project;
      this.actions = actions;
      this.actionExecutor = actionExecutor;
      this.flowCharts = flowCharts;
      this.multiplayerManager = multiplayerManager;
      this.tasks = tasks;
      this.tasks = tasks || project.tasks || [];
    }
    /**
     * Aktualisiert die FlowCharts (z.B. bei Stage-Wechsel)
     */
    setFlowCharts(flowCharts) {
      this.flowCharts = flowCharts;
    }
    setTasks(tasks) {
      this.tasks = tasks;
    }
    setActions(actions) {
      this.actions = actions;
    }
    async execute(taskName, vars, globalVars, contextObj, depth = 0, parentId, params, isRemoteExecution = false) {
      if (depth >= _TaskExecutor.MAX_DEPTH) {
        console.error(`[TaskExecutor] Max recursion depth exceeded: ${taskName} `);
        return;
      }
      if (params) {
        vars = { ...vars, ...params };
      }
      let task = this.tasks?.find((t) => t.name === taskName) || this.project.tasks?.find((t) => t.name === taskName);
      if (!task) {
        task = libraryService.getTask(taskName);
      }
      if (!task && taskName.includes(".")) {
        const [objName, evtName] = taskName.split(".");
        let foundTaskName = "";
        const findDeep = (objs) => {
          for (const o of objs) {
            if (o.name === objName || o.id === objName) return o;
            if (o.children && o.children.length > 0) {
              const found = findDeep(o.children);
              if (found) return found;
            }
          }
          return null;
        };
        this.project.stages?.forEach((s) => {
          if (foundTaskName) return;
          const obj = findDeep(s.objects || []);
          if (obj && obj.Tasks && obj.Tasks[evtName]) {
            foundTaskName = obj.Tasks[evtName];
          }
          if (!foundTaskName && s.variables) {
            const v = s.variables.find((v2) => v2.name === objName);
            if (v && v.Tasks && v.Tasks[evtName]) {
              foundTaskName = v.Tasks[evtName];
            }
          }
        });
        if (!foundTaskName && this.project.variables) {
          const v = this.project.variables.find((v2) => v2.name === objName);
          if (v && v.Tasks && v.Tasks[evtName]) {
            foundTaskName = v.Tasks[evtName];
          }
        }
        if (foundTaskName) {
          console.log(`[TaskExecutor] Resolved "${taskName}" to assigned task: "${foundTaskName}"`);
          return this.execute(foundTaskName, vars, globalVars, contextObj, depth + 1, parentId, params, isRemoteExecution);
        }
      }
      if (!task) {
        console.warn(`[TaskExecutor] Task definition not found: ${taskName}`);
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
      if (hasFlowChart) {
        console.log(`[TaskExecutor] Nutze Flussdiagramm f\xFCr "${taskName}" (Elemente: ${flowChart.elements.length})`);
        await this.executeFlowChart(taskName, flowChart, vars, globalVars, contextObj, depth, taskLogId);
      } else {
        if (actionSequence.length === 0) {
          console.log(`[TaskExecutor] Task "${taskName}" hat weder FlowChart noch ActionSequence.`);
        }
        for (const seqItem of actionSequence) {
          try {
            await this.executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, taskLogId);
          } catch (err2) {
            console.error(`[TaskExecutor] Error in item of task ${taskName}: `, err2);
            DebugLogService.getInstance().log("Event", `ERROR executing task ${taskName}: ${err2}`, { parentId: taskLogId });
          }
        }
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
    async executeFlowChart(taskName, flowChart, vars, globalVars, contextObj, depth, parentId) {
      const { elements, connections } = flowChart;
      const visited = /* @__PURE__ */ new Set();
      const startNode = elements.find(
        (e) => e.type === "Task" && e.properties?.name === taskName || e.type === "Start"
      );
      if (!startNode) {
        console.warn(`[TaskExecutor] No start node found in flowChart for task: ${taskName}. elements:`, elements.map((e) => `${e.type}:${e.properties?.name || e.id}`));
        return;
      }
      console.log(`[TaskExecutor] FlowChart Elements for "${taskName}":`, elements.map((e) => `${e.type}:${e.properties?.name || e.id}`));
      const executeNode = async (node) => {
        if (!node || visited.has(node.id)) return;
        visited.add(node.id);
        const nodeType = node.type;
        const name = node.properties?.name || node.data?.name || node.data?.actionName;
        if (nodeType === "Task" && name === taskName) {
          const outgoing = connections.filter((c) => c.startTargetId === node.id);
          for (const conn of outgoing) {
            const nextNode = elements.find((e) => e.id === conn.endTargetId);
            if (nextNode) await executeNode(nextNode);
          }
          return;
        }
        if (nodeType === "Action" || nodeType === "action") {
          const action = this.resolveAction({ type: "action", name }) || node.data;
          if (action) {
            await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
          }
          const outgoing = connections.find(
            (c) => c.startTargetId === node.id && !["true", "false"].includes(c.data?.startAnchorType || c.data?.anchorType || "")
          );
          if (outgoing) {
            const nextNode = elements.find((e) => e.id === outgoing.endTargetId);
            if (nextNode) await executeNode(nextNode);
          }
          return;
        }
        if (nodeType === "Task" || nodeType === "task") {
          await this.execute(name, vars, globalVars, contextObj, depth + 1, parentId, node.data?.params);
          const outgoing = connections.find(
            (c) => c.startTargetId === node.id && !["true", "false"].includes(c.data?.startAnchorType || c.data?.anchorType || "")
          );
          if (outgoing) {
            const nextNode = elements.find((e) => e.id === outgoing.endTargetId);
            if (nextNode) await executeNode(nextNode);
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
            if (trueNode) await executeNode(trueNode);
          } else if (!result && falseConn) {
            const falseNode = elements.find((e) => e.id === falseConn.endTargetId);
            if (falseNode) await executeNode(falseNode);
          }
          return;
        }
      };
      const initialOutgoing = connections.filter((c) => c.startTargetId === startNode.id);
      for (const conn of initialOutgoing) {
        const firstNode = elements.find((e) => e.id === conn.endTargetId);
        if (firstNode) await executeNode(firstNode);
      }
    }
    async executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, parentId) {
      const item = typeof seqItem === "string" ? { type: "action", name: seqItem } : seqItem;
      console.log(`[TaskExecutor] Processing item: type = "${item.type}" name = "${item.name || "N/A"}" condition = "${item.condition?.variable || "none"}"`);
      const condition = item.itemCondition || (typeof item.condition === "string" ? item.condition : null);
      if (condition && !this.evaluateCondition(condition, vars, globalVars)) {
        console.log(`[TaskExecutor] Item condition FALSE, skipping: ${condition} `);
        return;
      }
      switch (item.type) {
        case "condition":
          await this.handleCondition(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "task":
          await this.execute(item.name, vars, globalVars, contextObj, depth + 1, parentId, item.params);
          break;
        case "action":
          const action = this.resolveAction(item);
          if (action) {
            await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
          } else {
            console.warn(`[TaskExecutor] Action definition not found: ${item.name} `);
          }
          break;
        case "while":
          await this.handleWhile(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "for":
          await this.handleFor(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "foreach":
          await this.handleForeach(item, vars, globalVars, contextObj, depth, parentId);
          break;
        default:
          if (item.type) {
            await this.actionExecutor.execute(item, vars, globalVars, contextObj, parentId);
          }
      }
    }
    async executeBody(body, vars, globalVars, contextObj, depth, parentId) {
      if (!body || !Array.isArray(body)) return;
      for (const item of body) {
        await this.executeSequenceItem(item, vars, globalVars, contextObj, depth, parentId);
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
    async handleCondition(item, vars, globalVars, contextObj, depth, parentId) {
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
          if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
        }
        if (item.thenTask) {
          console.log(`[TaskExecutor] Condition TRUE, executing thenTask: ${item.thenTask} `);
          await this.execute(item.thenTask, vars, globalVars, contextObj, depth + 1, parentId);
        }
        if (item.body) await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      } else {
        if (item.elseAction) {
          const action = this.resolveAction(item.elseAction);
          if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
        }
        if (item.elseTask) await this.execute(item.elseTask, vars, globalVars, contextObj, depth + 1, parentId);
        if (item.elseBody) await this.executeBody(item.elseBody, vars, globalVars, contextObj, depth, parentId);
      }
    }
    /**
     * WHILE loop: Execute body while condition is true
     */
    async handleWhile(item, vars, globalVars, contextObj, depth, parentId) {
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
        await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      }
      console.log(`[TaskExecutor] WHILE loop completed after ${iterations} iterations`);
    }
    /**
     * FOR loop: Execute body for each value from 'from' to 'to'
     */
    async handleFor(item, vars, globalVars, contextObj, depth, parentId) {
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
        await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      }
      console.log(`[TaskExecutor] FOR loop completed after ${iterations} iterations`);
    }
    /**
     * FOREACH loop: Execute body for each item in array
     */
    async handleForeach(item, vars, globalVars, contextObj, depth, parentId) {
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
        await this.executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
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

  // src/runtime/GameLoopManager.ts
  init_AnimationManager();
  var _GameLoopManager = class _GameLoopManager {
    constructor() {
      // State
      __publicField(this, "state", "stopped");
      __publicField(this, "animationFrameId", null);
      __publicField(this, "lastTime", 0);
      // Configuration
      __publicField(this, "boundsOffsetTop", 0);
      __publicField(this, "boundsOffsetBottom", 0);
      // Grid reference - bounds are derived from this
      __publicField(this, "gridConfig", null);
      __publicField(this, "gameState", null);
      // Objects
      __publicField(this, "sprites", []);
      __publicField(this, "inputControllers", []);
      // Callbacks
      __publicField(this, "renderCallback", null);
      __publicField(this, "eventCallback", null);
      // Cooldowns and tracking
      __publicField(this, "collisionCooldowns", /* @__PURE__ */ new Map());
      __publicField(this, "boundaryCooldowns", /* @__PURE__ */ new Map());
      __publicField(this, "collidedThisFrame", /* @__PURE__ */ new Set());
      __publicField(this, "COLLISION_COOLDOWN_MS", 200);
      __publicField(this, "BOUNDARY_COOLDOWN_MS", 500);
      this.loop = this.loop.bind(this);
    }
    static getInstance() {
      if (!_GameLoopManager.instance) {
        _GameLoopManager.instance = new _GameLoopManager();
      }
      return _GameLoopManager.instance;
    }
    // Getters for bounds - derived from gridConfig
    get boundsWidth() {
      const grid = this.gridConfig;
      return grid?.grid?.cols ?? grid?.cols ?? 64;
    }
    get boundsHeight() {
      const grid = this.gridConfig;
      return grid?.grid?.rows ?? grid?.rows ?? 40;
    }
    /**
     * Initialize the game loop with objects, grid config, and callbacks
     */
    init(objects, gridConfig, renderCallback, eventCallback) {
      console.log(`[GameLoopManager] init() called with ${objects.length} objects`);
      this.stop();
      this.gridConfig = gridConfig;
      this.renderCallback = renderCallback;
      this.eventCallback = eventCallback || null;
      this.sprites = objects.filter(
        (obj) => obj.className === "TSprite" || obj.constructor.name === "TSprite"
      );
      this.inputControllers = objects.filter(
        (obj) => obj.className === "TInputController" || obj.constructor?.name === "TInputController"
      );
      const gameStateObj = objects.find(
        (obj) => obj.className === "TGameState" || obj.constructor?.name === "TGameState"
      );
      this.gameState = gameStateObj || null;
      const gameLoopObj = objects.find(
        (obj) => obj.className === "TGameLoop" || obj.constructor?.name === "TGameLoop"
      );
      if (gameLoopObj) {
        this.boundsOffsetTop = gameLoopObj.boundsOffsetTop || 0;
        this.boundsOffsetBottom = gameLoopObj.boundsOffsetBottom || 0;
        if (gameLoopObj.targetFPS) {
          console.log(`[GameLoopManager] Target FPS: ${gameLoopObj.targetFPS} (not currently used for capping)`);
        }
      }
      this.collisionCooldowns.clear();
      this.boundaryCooldowns.clear();
      console.log(`[GameLoopManager] Initialized with ${this.sprites.length} sprites, ${this.inputControllers.length} input controllers, gameState: ${this.gameState?.name || "null"}`);
    }
    /**
     * Start the game loop
     */
    start() {
      console.log(`[GameLoopManager] start() called. Current state: ${this.state}`);
      if (this.state === "running") {
        console.log(`[GameLoopManager] Already running, returning.`);
        return;
      }
      this.state = "running";
      this.lastTime = performance.now();
      console.log(`[GameLoopManager] Starting loop with ${this.sprites.length} sprites`);
      this.loop();
    }
    /**
     * Stop the game loop
     */
    stop() {
      console.log(`[GameLoopManager] stop() called. Current state: ${this.state}`);
      this.state = "stopped";
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
      this.collisionCooldowns.clear();
      this.boundaryCooldowns.clear();
      this.collidedThisFrame.clear();
      this.sprites = [];
      this.inputControllers = [];
      this.renderCallback = null;
      this.eventCallback = null;
      this.gameState = null;
      this.gridConfig = null;
    }
    /**
     * Pause the game loop
     */
    pause() {
      if (this.state === "running") {
        this.state = "paused";
        console.log(`[GameLoopManager] Paused`);
      }
    }
    /**
     * Resume the game loop
     */
    resume() {
      if (this.state === "paused") {
        this.state = "running";
        this.lastTime = performance.now();
        console.log(`[GameLoopManager] Resumed`);
        this.loop();
      }
    }
    /**
     * Get current state
     */
    getState() {
      return this.state;
    }
    /**
     * Check if running
     */
    isRunning() {
      return this.state === "running";
    }
    /**
     * Main game loop - NORMAL METHOD, not arrow function
     * OPTIMIZATION: Only renders when something has changed to avoid endless log spam
     */
    loop() {
      if (this.state !== "running") {
        return;
      }
      const now = performance.now();
      const deltaTime = (now - this.lastTime) / 1e3;
      this.lastTime = now;
      this.inputControllers.forEach((ic) => {
        if (ic.update) ic.update();
      });
      const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
      const hasActiveAnimations = AnimationManager.getInstance().hasActiveTweens();
      const hasMovingSprites = spritesMoving && this.sprites.some(
        (sprite) => sprite.velocityX !== 0 || sprite.velocityY !== 0 || sprite.isAnimating
      );
      const needsUpdate = hasActiveAnimations || hasMovingSprites;
      if (needsUpdate) {
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
      }
      this.animationFrameId = requestAnimationFrame(this.loop);
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
              this.eventCallback(spriteA.id, `onCollision${this.capitalize(overlap.side)}`, { other: spriteB });
              this.eventCallback(spriteB.id, `onCollision${this.capitalize(oppositeSide)}`, { other: spriteA });
              this.collidedThisFrame.add(spriteA.id);
              this.collidedThisFrame.add(spriteB.id);
            }
          }
        }
      }
    }
    capitalize(s) {
      return s.charAt(0).toUpperCase() + s.slice(1);
    }
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
      if (now - lastHit < this.BOUNDARY_COOLDOWN_MS) return;
      if (side === "left" && sprite.velocityX >= 0) return;
      if (side === "right" && sprite.velocityX <= 0) return;
      if (side === "top" && sprite.velocityY >= 0) return;
      if (side === "bottom" && sprite.velocityY <= 0) return;
      this.boundaryCooldowns.set(cooldownKey, now);
      if (side === "left" || side === "right") sprite.velocityX = 0;
      if (side === "top" || side === "bottom") sprite.velocityY = 0;
      const EPSILON = 0.01;
      if (side === "left") sprite.x = EPSILON;
      if (side === "right") sprite.x = this.boundsWidth - sprite.width - EPSILON;
      if (side === "top") sprite.y = this.boundsOffsetTop + EPSILON;
      if (side === "bottom") sprite.y = this.boundsHeight - this.boundsOffsetBottom - sprite.height - EPSILON;
      if (this.eventCallback) {
        console.log(`[GameLoopManager] Boundary Hit: ${sprite.name} on ${side}. Task should handle bounce.`);
        this.eventCallback(sprite.id, "onBoundaryHit", { hitSide: side });
      }
    }
  };
  __publicField(_GameLoopManager, "instance", null);
  var GameLoopManager = _GameLoopManager;

  // src/runtime/RuntimeVariableManager.ts
  var RuntimeVariableManager = class {
    constructor(host, initialGlobalVars = {}) {
      this.host = host;
      __publicField(this, "projectVariables", {});
      __publicField(this, "stageVariables", {});
      __publicField(this, "contextVars");
      this.projectVariables = { ...initialGlobalVars };
      this.contextVars = this.createVariableContext();
    }
    initializeVariables(project) {
      if (project.variables) {
        this.importVariables(project.variables);
      }
      if (project.stages) {
        const mainStage = project.stages.find((s) => s.type === "main");
        if (mainStage && mainStage.variables) {
          this.importVariables(mainStage.variables);
        }
      }
    }
    initializeStageVariables(stage) {
      if (stage && stage.variables) {
        this.importVariables(stage.variables);
      }
    }
    importVariables(vars) {
      vars.forEach((v) => {
        const isGlobal = !v.scope || v.scope === "global";
        const initialValue = v.defaultValue !== void 0 ? v.defaultValue : v.value;
        if (isGlobal) {
          if (this.projectVariables[v.name] === void 0) {
            this.projectVariables[v.name] = initialValue !== void 0 ? initialValue : 0;
          }
        } else {
          if (this.stageVariables[v.name] === void 0) {
            this.stageVariables[v.name] = initialValue !== void 0 ? initialValue : 0;
          }
        }
      });
    }
    createStageProxy(stage) {
      return new Proxy({}, {
        get: (_target, prop) => {
          const variableDef = stage.variables?.find((v) => v.name === prop);
          if (!variableDef) return void 0;
          if (!variableDef.isPublic) {
            console.warn(`[Scope] Access denied: Variable '${prop}' in stage '${stage.name}' is private.`);
            return void 0;
          }
          if (this.host.stage && this.host.stage.id === stage.id) {
            return this.stageVariables[prop];
          }
          return variableDef.defaultValue;
        },
        set: () => {
          console.warn(`[Scope] Cannot set properties on Stage Proxy '${stage.name}'. Cross-stage writes are forbidden.`);
          return false;
        }
      });
    }
    createVariableContext() {
      return new Proxy({}, {
        get: (_target, prop) => {
          if (prop in this.stageVariables) return this.stageVariables[prop];
          if (prop in this.projectVariables) return this.projectVariables[prop];
          return void 0;
        },
        set: (_target, prop, value) => {
          const oldValue = this.stageVariables[prop] !== void 0 ? this.stageVariables[prop] : this.projectVariables[prop];
          let varDef = this.host.stage?.variables?.find((v) => v.name === prop);
          if (!varDef && this.host.project.variables) {
            varDef = this.host.project.variables.find((v) => v.name === prop);
          }
          let finalValue = value;
          if (varDef && varDef.isInteger && typeof value === "number") {
            finalValue = Math.floor(value);
          }
          if (prop in this.stageVariables) {
            this.stageVariables[prop] = finalValue;
          } else if (prop in this.projectVariables) {
            this.projectVariables[prop] = finalValue;
          } else {
            this.stageVariables[prop] = finalValue;
          }
          const component = this.host.objects?.find((o) => o.name === prop && o.isVariable);
          if (component && component.value !== finalValue) {
            component.value = finalValue;
          }
          this.host.reactiveRuntime.setVariable(prop, finalValue);
          if (this.host.taskExecutor) {
            if (varDef) {
              this.processVariableEvents(prop, finalValue, oldValue, varDef);
            }
          }
          return true;
        },
        ownKeys: () => {
          const keys = /* @__PURE__ */ new Set([...Object.keys(this.projectVariables), ...Object.keys(this.stageVariables)]);
          return Array.from(keys);
        },
        has: (_target, prop) => {
          return prop in this.stageVariables || prop in this.projectVariables;
        },
        getOwnPropertyDescriptor: (_target, prop) => {
          const val = this.stageVariables[prop] !== void 0 ? this.stageVariables[prop] : this.projectVariables[prop];
          if (val !== void 0) {
            return { configurable: true, enumerable: true, value: val };
          }
          return void 0;
        }
      });
    }
    processVariableEvents(prop, value, oldValue, varDef) {
      const executor = this.host.taskExecutor;
      if (!executor) return;
      if (oldValue !== value) {
        this.executeVariableEvent(varDef, "onValueChanged");
      }
      if (value === "" || value === null || value === void 0) {
        this.executeVariableEvent(varDef, "onValueEmpty");
      }
      if (typeof value === "number" && typeof oldValue === "number" && typeof varDef.threshold === "number") {
        const t = varDef.threshold;
        if (oldValue < t && value >= t) {
          this.executeVariableEvent(varDef, "onThresholdReached");
        }
        if (oldValue >= t && value < t) {
          this.executeVariableEvent(varDef, "onThresholdLeft");
        }
        if (oldValue <= t && value > t) {
          this.executeVariableEvent(varDef, "onThresholdExceeded");
        }
      }
      if (varDef.triggerValue !== void 0 && varDef.triggerValue !== "" && varDef.triggerValue !== null) {
        const isTrigger = value == varDef.triggerValue;
        const wasTrigger = oldValue == varDef.triggerValue;
        if (isTrigger && !wasTrigger) {
          this.executeVariableEvent(varDef, "onTriggerEnter");
        }
        if (!isTrigger && wasTrigger) {
          this.executeVariableEvent(varDef, "onTriggerExit");
        }
      }
      if (typeof value === "number" && varDef.min !== void 0 && varDef.max !== void 0) {
        const min = Number(varDef.min);
        const max2 = Number(varDef.max);
        if (value <= min && (oldValue > min || oldValue === void 0)) {
          this.executeVariableEvent(varDef, "onMinReached");
        }
        if (value >= max2 && (oldValue < max2 || oldValue === void 0)) {
          this.executeVariableEvent(varDef, "onMaxReached");
        }
        const isInside = value > min && value < max2;
        const wasInside = oldValue > min && oldValue < max2;
        if (isInside && !wasInside) {
          this.executeVariableEvent(varDef, "onInside");
        }
        if (!isInside && wasInside) {
          this.executeVariableEvent(varDef, "onOutside");
        }
      }
      if (varDef.isRandom && oldValue !== value) {
        this.executeVariableEvent(varDef, "onGenerated");
      }
      if (varDef.type === "list" && value !== oldValue) {
        this.processListEvents(value, oldValue, varDef);
      }
      if (varDef.type === "timer" && typeof value === "number" && value > 0 && (oldValue === 0 || oldValue === void 0)) {
        this.host.startTimer(prop, varDef, value);
      }
    }
    /**
     * Helper to execute a variable event. 
     * Delegated to TaskExecutor using ComponentName.EventName notation.
     */
    executeVariableEvent(varDef, eventName) {
      const executor = this.host.taskExecutor;
      if (!executor) return;
      const eventLogId = DebugLogService.getInstance().log("Event", `Triggered: ${varDef.name}.${eventName}`, {
        objectName: varDef.name,
        eventName
      });
      const taskName = `${varDef.name}.${eventName}`;
      executor.execute(taskName, { sender: varDef }, this.contextVars, void 0, 0, eventLogId);
    }
    processListEvents(value, oldValue, varDef) {
      const executor = this.host.taskExecutor;
      if (!executor) return;
      try {
        const list = Array.isArray(value) ? value : JSON.parse(value);
        const oldList = Array.isArray(oldValue) ? oldValue : oldValue ? JSON.parse(oldValue) : [];
        if (list.length > oldList.length) {
          this.executeVariableEvent(varDef, "onItemAdded");
        }
        if (list.length < oldList.length) {
          this.executeVariableEvent(varDef, "onItemRemoved");
        }
        if (varDef.searchValue) {
          const contains = list.includes(varDef.searchValue);
          const wasContains = oldList.includes(varDef.searchValue);
          if (contains && !wasContains) {
            this.executeVariableEvent(varDef, "onContains");
          }
          if (!contains && wasContains) {
            this.executeVariableEvent(varDef, "onNotContains");
          }
        }
      } catch (e) {
      }
    }
  };

  // src/components/TComponent.ts
  var TComponent = class {
    constructor(name) {
      __publicField(this, "id");
      __publicField(this, "name");
      __publicField(this, "className");
      // Explicit className for production builds
      __publicField(this, "parent", null);
      __publicField(this, "children", []);
      __publicField(this, "Tasks");
      // EventName -> TaskName
      __publicField(this, "scope", "stage");
      // Visibility scope
      __publicField(this, "isVariable", false);
      // Flag for variable-like components
      __publicField(this, "isTransient", false);
      // If true, this component is not persisted in project files
      // Drag & Drop Properties
      __publicField(this, "draggable", false);
      __publicField(this, "dragMode", "move");
      __publicField(this, "droppable", false);
      this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.name = name;
      this.className = this.constructor.name;
      this.Tasks = {};
    }
    getBaseProperties() {
      return [
        { name: "name", label: "Name", type: "string", group: "IDENTIT\xC4T" },
        { name: "id", label: "ID", type: "string", group: "IDENTIT\xC4T", readonly: true },
        { name: "scope", label: "Scope", type: "select", group: "IDENTIT\xC4T", options: ["global", "stage"] },
        { name: "draggable", label: "Draggable", type: "boolean", group: "INTERAKTION", editorOnly: true },
        { name: "dragMode", label: "Drag Mode", type: "select", group: "INTERAKTION", options: ["move", "copy"], editorOnly: true },
        { name: "droppable", label: "Droppable", type: "boolean", group: "INTERAKTION", editorOnly: true }
      ];
    }
    /**
     * Generisches toJSON, das die Metadaten aus getInspectorProperties nutzt.
     * Unterstützt verschachtelte Property-Pfade (z.B. 'style.backgroundColor').
     */
    toJSON() {
      const json = {
        className: this.className || this.constructor.name,
        id: this.id,
        isVariable: this.isVariable
      };
      if (this.Tasks && Object.keys(this.Tasks).length > 0) {
        json.Tasks = this.Tasks;
      }
      const props = this.getInspectorProperties();
      props.forEach((p) => {
        if (p.serializable === false) return;
        const value = this.getPropertyValue(p.name);
        if (value !== void 0) {
          if (!p.name.includes(".")) {
            json[p.name] = value;
          } else {
            const parts = p.name.split(".");
            let current = json;
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              if (!current[part]) current[part] = {};
              current = current[part];
            }
            current[parts[parts.length - 1]] = value;
          }
        }
      });
      if (this.children.length > 0) {
        json.children = this.children.map((child) => child.toJSON());
      }
      return json;
    }
    /**
     * Hilfsmethode um Property-Werte (auch verschachtelte) zu lesen
     */
    getPropertyValue(path) {
      if (!path.includes(".")) return this[path];
      const parts = path.split(".");
      let current = this;
      for (const part of parts) {
        if (current === void 0 || current === null) return void 0;
        current = current[part];
      }
      return current;
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
      __publicField(this, "text", "");
      // Animation flag - wenn true, wird Physik pausiert
      __publicField(this, "isAnimating", false);
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.zIndex = 0;
      this._align = "NONE";
      this.visible = true;
      this.text = "";
      this.style = {
        // visible: true, // Do NOT force true here, let it be undefined so it falls back to this.visible
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
    // Alias for backward compatibility (JSON loading)
    get caption() {
      return this.text;
    }
    set caption(v) {
      this.text = v;
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
      console.log(`[TWindow.moveTo] Called on "${this.name}": from (${this.x}, ${this.y}) to (${x}, ${y}), duration=${duration}ms, easing=${easing}`);
      const manager = AnimationManager.getInstance();
      console.log(`[TWindow.moveTo] AnimationManager instance obtained, activeTweens=${manager.getActiveTweenCount()}`);
      const tweenX = manager.addTween(this, "x", x, duration, easing);
      console.log(`[TWindow.moveTo] Added X tween: from=${tweenX.from} to=${tweenX.to}`);
      const tweenY = manager.addTween(this, "y", y, duration, easing, onComplete);
      console.log(`[TWindow.moveTo] Added Y tween: from=${tweenY.from} to=${tweenY.to}`);
      console.log(`[TWindow.moveTo] After adding tweens, activeTweens=${manager.getActiveTweenCount()}`);
    }
    /**
     * Get available events for this component
     * Override in subclasses to add more events
     */
    getEvents() {
      return ["onClick", "onFocus", "onBlur", "onDragStart", "onDragEnd", "onDrop"];
    }
    getInspectorProperties() {
      return [
        ...this.getBaseProperties(),
        { name: "x", label: "X Position", type: "number", group: "GEOMETRIE" },
        { name: "y", label: "Y Position", type: "number", group: "GEOMETRIE" },
        { name: "width", label: "Breite", type: "number", group: "GEOMETRIE" },
        { name: "height", label: "H\xF6he", type: "number", group: "GEOMETRIE" },
        { name: "zIndex", label: "Z-Index", type: "number", group: "GEOMETRIE" },
        { name: "align", label: "Ausrichtung", type: "select", group: "GEOMETRIE", options: ["NONE", "TOP", "BOTTOM", "LEFT", "RIGHT", "CLIENT"] },
        { name: "text", label: "Text", type: "string", group: "INHALT" },
        { name: "visible", label: "Sichtbar", type: "boolean", group: "IDENTIT\xC4T" },
        { name: "style.visible", label: "Style Sichtbar", type: "boolean", group: "STIL", editorOnly: true },
        { name: "style.backgroundColor", label: "Hintergrund", type: "color", group: "STIL" },
        { name: "style.borderColor", label: "Rahmenfarbe", type: "color", group: "STIL" },
        { name: "style.borderWidth", label: "Rahmenbreite", type: "number", group: "STIL" },
        { name: "style.borderRadius", label: "Abrundung", type: "number", group: "STIL" }
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
        { name: "style.fontSize", label: "Schriftgr\xF6\xDFe", type: "number", group: "TYPOGRAFIE" },
        { name: "style.fontWeight", label: "Fett", type: "boolean", group: "TYPOGRAFIE" },
        { name: "style.fontStyle", label: "Kursiv", type: "boolean", group: "TYPOGRAFIE" },
        { name: "style.textAlign", label: "Ausrichtung", type: "select", group: "TYPOGRAFIE", options: ["left", "center", "right"] },
        { name: "style.fontFamily", label: "Schriftart", type: "select", group: "TYPOGRAFIE", options: ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Tahoma", "Trebuchet MS"] },
        { name: "style.color", label: "Textfarbe", type: "color", group: "TYPOGRAFIE" }
      ];
    }
  };

  // src/components/TButton.ts
  var TButton = class extends TTextControl {
    constructor(name, x, y, width, height, text) {
      super(name, x, y, width, height);
      __publicField(this, "icon", "");
      this.text = text !== void 0 ? text : name;
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
        { name: "icon", label: "Icon", type: "image_picker", group: "DARSTELLUNG" }
      ];
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
  };

  // src/components/TLabel.ts
  var TLabel = class extends TTextControl {
    constructor(name, x, y, text) {
      super(name, x, y, 100, 20);
      this.text = text !== void 0 ? text : name;
      this.style.backgroundColor = "transparent";
      this.style.color = "#000000";
      this.style.textAlign = "left";
    }
    getInspectorProperties() {
      return super.getInspectorProperties();
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
        { name: "placeholder", label: "Placeholder", type: "string", group: "Specifics" },
        { name: "maxLength", label: "Max Length", type: "number", group: "Specifics" }
        // Inherits styles from TTextControl
      ];
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
      const props = this.getBaseProperties();
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
        { name: "title", label: "Titel", type: "string", group: "IDENTIT\xC4T" }
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
      return [
        ...super.getInspectorProperties(),
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
      // Prevent repeated boundary events
      // CRITICAL: Private flag to bypass ReactiveRuntime proxy issues
      // Arrow functions bind 'this' to original object, but proxy changes are not reflected there
      __publicField(this, "_isRunning", false);
      /**
       * Main game loop
       */
      __publicField(this, "loop", () => {
        if (!this._isRunning) {
          console.log(`[TGameLoop] loop() not running - _isRunning is false`);
          return;
        }
        const now = performance.now();
        const deltaTime = (now - this.lastTime) / 1e3;
        this.lastTime = now;
        this.inputControllers.forEach((ic) => {
          if (ic.update) ic.update();
        });
        const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
        console.log(`[TGameLoop] loop: spritesMoving=${spritesMoving}, sprites=${this.sprites.length}, gameState=${this.gameState?.name}`);
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
      return [
        ...super.getInspectorProperties(),
        { name: "targetFPS", label: "Target FPS", type: "number", group: "Loop Settings" },
        { name: "boundsOffsetTop", label: "Bounds Offset Top", type: "number", group: "Boundaries" },
        { name: "boundsOffsetBottom", label: "Bounds Offset Bottom", type: "number", group: "Boundaries" }
      ];
    }
    toJSON() {
      return super.toJSON();
    }
    onRuntimeStart() {
    }
    initRuntime(callbacks) {
      this.init(
        callbacks.objects,
        callbacks.gridConfig,
        callbacks.render,
        callbacks.handleEvent
      );
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
      console.log(`[TGameLoop] start() called. _isRunning: ${this._isRunning}, sprites: ${this.sprites.length}`);
      if (this._isRunning) {
        console.log(`[TGameLoop] Already running, returning.`);
        return;
      }
      this.state = "running";
      this._isRunning = true;
      console.log(`[TGameLoop] _isRunning set to: ${this._isRunning}`);
      this.lastTime = performance.now();
      if (this.eventCallback) {
        this.eventCallback(this.id, "onStart");
      }
      console.log(`[TGameLoop] Starting loop with ${this.sprites.length} sprites`);
      this.loop();
    }
    /**
     * Stop the game loop
     */
    stop() {
      this.state = "stopped";
      this._isRunning = false;
      if (this.animationFrameId !== null) {
        cancelAnimationFrame(this.animationFrameId);
        this.animationFrameId = null;
      }
    }
    /**
     * Pause the game loop
     */
    pause() {
      if (this._isRunning) {
        this.state = "paused";
        this._isRunning = false;
      }
    }
    /**
     * Resume the game loop
     */
    resume() {
      if (this.state === "paused" && !this._isRunning) {
        this.state = "running";
        this._isRunning = true;
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
      return [
        ...super.getInspectorProperties(),
        { name: "enabled", label: "Enabled", type: "boolean", group: "Input" }
      ];
    }
    toJSON() {
      return super.toJSON();
    }
    initRuntime(callbacks) {
      this.init(callbacks.objects, callbacks.handleEvent);
    }
    onRuntimeStart() {
      this.start();
    }
    onRuntimeStop() {
      this.stop();
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
      this.isVariable = true;
      this.style.backgroundColor = "#4caf50";
      this.style.borderColor = "#2e7d32";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      return [
        ...super.getInspectorProperties(),
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
      return super.toJSON();
    }
    initRuntime(callbacks) {
      this.onEvent = (ev) => callbacks.handleEvent(this.id, ev);
    }
    onRuntimeStart() {
      if (this.enabled) {
        this.start(() => {
        });
      }
    }
    onRuntimeStop() {
      this.stop();
    }
    /**
     * Start the timer with a callback. Used internally by Editor/GameRuntime.
     */
    start(callback) {
      this.stop();
      this.onTimerCallback = callback;
      if (this.name === "SynchronTimer") {
        const mp = window.multiplayerManager;
        if (!mp || !mp.isConnected) {
          return;
        }
      }
      if (this.enabled) {
        this.timerId = window.setInterval(() => {
          this.currentInterval++;
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
    constructor(name, x = 0, y = 0) {
      super(name, x, y, 6, 5);
      // Game info
      __publicField(this, "gameName", "Game");
      __publicField(this, "gameFile", "");
      // e.g., "pong.json"
      __publicField(this, "waitingCount", 0);
      // Number of waiting rooms
      __publicField(this, "hostName", "");
      __publicField(this, "hostAvatar", "");
      __publicField(this, "roomCode", "");
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
        { name: "waitingCount", label: "Waiting Rooms", type: "number", group: "Game" },
        { name: "hostName", label: "Host Name", type: "string", group: "Game" },
        { name: "hostAvatar", label: "Host Avatar", type: "string", group: "Game" },
        { name: "roomCode", label: "Room Code", type: "string", group: "Game" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        gameName: this.gameName,
        gameFile: this.gameFile,
        waitingCount: this.waitingCount,
        hostName: this.hostName,
        hostAvatar: this.hostAvatar,
        roomCode: this.roomCode,
        Tasks: this.Tasks
      };
    }
  };

  // src/multiplayer/NetworkManager.ts
  var NetworkManager = class {
    constructor(serverUrl = "ws://localhost:8080") {
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
      __publicField(this, "serverUrl", "ws://localhost:8080");
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
      return [
        ...super.getInspectorProperties(),
        { name: "serverUrl", label: "Server URL", type: "string", group: "Server" },
        { name: "autoConnect", label: "Auto Connect", type: "boolean", group: "Server" }
      ];
    }
    toJSON() {
      return super.toJSON();
    }
    initRuntime(callbacks) {
      this.eventCallback = (ev, data) => callbacks.handleEvent(this.id, ev, data);
    }
    onRuntimeStart() {
      if (this.autoConnect) {
        this.connect();
      }
    }
    onRuntimeStop() {
      this.stop();
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
      this.isVariable = true;
      this.style.backgroundColor = "#4caf50";
      this.style.color = "#ffffff";
      this.style.visible = true;
    }
    getInspectorProperties() {
      return [
        ...super.getInspectorProperties(),
        { name: "state", label: "Initial State", type: "select", group: "Game State", options: ["menu", "playing", "paused", "gameover"] },
        { name: "spritesMoving", label: "Sprites Moving", type: "boolean", group: "Game State" },
        { name: "collisionsEnabled", label: "Collisions Enabled", type: "boolean", group: "Game State" }
      ];
    }
    toJSON() {
      return super.toJSON();
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
  };

  // src/components/TVideo.ts
  var TVideo = class extends TPanel {
    constructor(name, x, y, width = 10, height = 6) {
      super(name, x, y, width, height);
      __publicField(this, "_videoSource", "");
      __publicField(this, "_objectFit", "contain");
      __publicField(this, "_imageOpacity", 1);
      __publicField(this, "_autoplay", false);
      __publicField(this, "_loop", false);
      __publicField(this, "_muted", false);
      __publicField(this, "_playbackRate", 1);
      // Runtime state (renderer should sync with this)
      __publicField(this, "_isPlaying", false);
      this.style.backgroundColor = "#000000";
      this.style.borderWidth = 0;
    }
    get videoSource() {
      return this._videoSource;
    }
    set videoSource(value) {
      this._videoSource = value || "";
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
    get autoplay() {
      return this._autoplay;
    }
    set autoplay(value) {
      this._autoplay = value;
      if (value) this._isPlaying = true;
    }
    get loop() {
      return this._loop;
    }
    set loop(value) {
      this._loop = value;
    }
    get muted() {
      return this._muted;
    }
    set muted(value) {
      this._muted = value;
    }
    get playbackRate() {
      return this._playbackRate;
    }
    set playbackRate(value) {
      this._playbackRate = value;
    }
    get isPlaying() {
      return this._isPlaying;
    }
    // ─────────────────────────────────────────────
    // Methods (callable via Action System)
    // ─────────────────────────────────────────────
    play() {
      this._isPlaying = true;
      console.log(`[TVideo] ${this.name}.play()`);
    }
    pause() {
      this._isPlaying = false;
      console.log(`[TVideo] ${this.name}.pause()`);
    }
    stop() {
      this._isPlaying = false;
      console.log(`[TVideo] ${this.name}.stop()`);
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
        { name: "videoSource", label: "Video Source", type: "string", group: "Video" },
        {
          name: "objectFit",
          label: "Object Fit",
          type: "select",
          group: "Video",
          options: ["cover", "contain", "fill", "none"]
        },
        { name: "imageOpacity", label: "Opacity", type: "number", group: "Video" },
        { name: "autoplay", label: "Autoplay", type: "boolean", group: "Video" },
        { name: "loop", label: "Loop", type: "boolean", group: "Video" },
        { name: "muted", label: "Muted", type: "boolean", group: "Video" },
        { name: "playbackRate", label: "Playback Rate", type: "number", group: "Video" }
      ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
      return {
        ...super.toJSON(),
        videoSource: this._videoSource,
        objectFit: this._objectFit,
        imageOpacity: this._imageOpacity,
        autoplay: this._autoplay,
        loop: this._loop,
        muted: this._muted,
        playbackRate: this._playbackRate
      };
    }
  };

  // src/components/TSplashScreen.ts
  var TSplashScreen = class extends TPanel {
    constructor(name, x, y, width = 32, height = 24) {
      super(name, x, y, width, height);
      __publicField(this, "_duration", 3e3);
      __publicField(this, "_autoHide", true);
      __publicField(this, "_videoSource", "");
      __publicField(this, "_fadeSpeed", 0.5);
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.align = "NONE";
      this.style.backgroundColor = "#000000";
      this.zIndex = 1e3;
    }
    get duration() {
      return this._duration;
    }
    set duration(value) {
      this._duration = value;
    }
    get autoHide() {
      return this._autoHide;
    }
    set autoHide(value) {
      this._autoHide = value;
    }
    get videoSource() {
      return this._videoSource;
    }
    set videoSource(value) {
      this._videoSource = value || "";
    }
    get fadeSpeed() {
      return this._fadeSpeed;
    }
    set fadeSpeed(value) {
      this._fadeSpeed = value;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const filtered = props.filter(
        (p) => !["showGrid", "gridColor", "gridStyle", "caption"].includes(p.name)
      );
      return [
        ...filtered,
        { name: "duration", label: "Duration (ms)", type: "number", group: "Splash" },
        { name: "autoHide", label: "Auto Hide", type: "boolean", group: "Splash" },
        { name: "videoSource", label: "Background Video", type: "string", group: "Splash" },
        { name: "fadeSpeed", label: "Fade Speed", type: "number", group: "Splash" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onFinish"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        duration: this._duration,
        autoHide: this._autoHide,
        videoSource: this._videoSource,
        fadeSpeed: this._fadeSpeed
      };
    }
  };

  // src/components/TStage.ts
  var TStage = class extends TWindow {
    constructor(name, x = 0, y = 0, cols = 32, rows = 24, cellSize = 20) {
      super(name, x, y, cols * cellSize, rows * cellSize);
      __publicField(this, "_config");
      __publicField(this, "description", "");
      // Background Image Support
      __publicField(this, "_backgroundImage", "");
      __publicField(this, "_objectFit", IMAGE_DEFAULTS.objectFit);
      // Start Animation Settings
      __publicField(this, "startAnimation", "none");
      // Fly-In Pattern bei Spielstart
      __publicField(this, "startAnimationDuration", 1e3);
      // Dauer in ms
      __publicField(this, "startAnimationEasing", "easeOut");
      this._config = {
        cols,
        rows,
        cellSize,
        snapToGrid: true,
        showGrid: false
      };
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#999999";
      this.style.borderWidth = 1;
    }
    // ─────────────────────────────────────────────
    // Config Accessors
    // ─────────────────────────────────────────────
    get cols() {
      return this._config.cols;
    }
    set cols(value) {
      this._config.cols = value;
      this.width = value * this._config.cellSize;
    }
    get rows() {
      return this._config.rows;
    }
    set rows(value) {
      this._config.rows = value;
      this.height = value * this._config.cellSize;
    }
    get cellSize() {
      return this._config.cellSize;
    }
    set cellSize(value) {
      this._config.cellSize = value;
      this.width = this._config.cols * value;
      this.height = this._config.rows * value;
    }
    get snapToGrid() {
      return this._config.snapToGrid;
    }
    set snapToGrid(value) {
      this._config.snapToGrid = value;
    }
    get showGrid() {
      return this._config.showGrid;
    }
    set showGrid(value) {
      this._config.showGrid = value;
    }
    get config() {
      return { ...this._config };
    }
    // ─────────────────────────────────────────────
    // Background Image
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
    // ─────────────────────────────────────────────
    // Grid Helpers
    // ─────────────────────────────────────────────
    /** Convert pixel position to grid position */
    pixelToGrid(pixelX, pixelY) {
      return {
        x: Math.floor(pixelX / this._config.cellSize),
        y: Math.floor(pixelY / this._config.cellSize)
      };
    }
    /** Convert grid position to pixel position */
    gridToPixel(gridX, gridY) {
      return {
        x: gridX * this._config.cellSize,
        y: gridY * this._config.cellSize
      };
    }
    /** Snap a pixel position to the nearest grid cell */
    snapToGridPosition(pixelX, pixelY) {
      const grid = this.pixelToGrid(pixelX, pixelY);
      return this.gridToPixel(grid.x, grid.y);
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "description", label: "Description", type: "string", group: "Info" },
        { name: "cols", label: "Columns", type: "number", group: "Grid" },
        { name: "rows", label: "Rows", type: "number", group: "Grid" },
        { name: "cellSize", label: "Cell Size", type: "number", group: "Grid" },
        { name: "snapToGrid", label: "Snap to Grid", type: "boolean", group: "Grid" },
        { name: "showGrid", label: "Show Grid", type: "boolean", group: "Grid" },
        // Background
        { name: "backgroundImage", label: "Background Image", type: "image_picker", group: "Appearance" },
        { name: "objectFit", label: "Image Fit", type: "select", group: "Appearance", options: ["cover", "contain", "fill", "none"] },
        // Start Animation
        { name: "startAnimation", label: "Start Animation", type: "select", group: "Animation", options: ["none", "UpLeft", "UpMiddle", "UpRight", "Left", "Right", "BottomLeft", "BottomMiddle", "BottomRight", "ChaosIn", "ChaosOut", "Matrix", "Random"] },
        { name: "startAnimationDuration", label: "Duration (ms)", type: "number", group: "Animation" },
        { name: "startAnimationEasing", label: "Easing", type: "select", group: "Animation", options: ["linear", "easeIn", "easeOut", "easeInOut", "bounce", "elastic"] }
      ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
      return {
        ...super.toJSON(),
        description: this.description,
        cols: this._config.cols,
        rows: this._config.rows,
        cellSize: this._config.cellSize,
        snapToGrid: this._config.snapToGrid,
        showGrid: this._config.showGrid,
        backgroundImage: this._backgroundImage,
        objectFit: this._objectFit,
        startAnimation: this.startAnimation,
        startAnimationDuration: this.startAnimationDuration,
        startAnimationEasing: this.startAnimationEasing
      };
    }
    /**
     * Berechnet die Startposition für ein Objekt basierend auf dem Muster.
     */
    getPatternStartPosition(pattern, targetX, targetY, index) {
      const stageWidth = this._config.cols * this._config.cellSize;
      const stageHeight = this._config.rows * this._config.cellSize;
      const outsideMargin = 50;
      switch (pattern) {
        case "UpLeft":
          return { x: -outsideMargin, y: -outsideMargin };
        case "UpMiddle":
          return { x: stageWidth / 2, y: -outsideMargin };
        case "UpRight":
          return { x: stageWidth + outsideMargin, y: -outsideMargin };
        case "Left":
          return { x: -outsideMargin, y: targetY };
        case "Right":
          return { x: stageWidth + outsideMargin, y: targetY };
        case "BottomLeft":
          return { x: -outsideMargin, y: stageHeight + outsideMargin };
        case "BottomMiddle":
          return { x: stageWidth / 2, y: stageHeight + outsideMargin };
        case "BottomRight":
          return { x: stageWidth + outsideMargin, y: stageHeight + outsideMargin };
        case "ChaosIn":
          const angle = Math.random() * Math.PI * 2;
          const distance = Math.max(stageWidth, stageHeight) + outsideMargin;
          return {
            x: stageWidth / 2 + Math.cos(angle) * distance,
            y: stageHeight / 2 + Math.sin(angle) * distance
          };
        case "ChaosOut":
          return { x: stageWidth / 2, y: stageHeight / 2 };
        case "Matrix":
          return { x: targetX, y: -outsideMargin - index * 20 };
        case "Random":
          const simplePatterns = ["UpLeft", "UpMiddle", "UpRight", "Left", "Right", "BottomLeft", "BottomMiddle", "BottomRight"];
          const randomPattern = simplePatterns[Math.floor(Math.random() * simplePatterns.length)];
          return this.getPatternStartPosition(randomPattern, targetX, targetY, index);
        default:
          return { x: 0, y: 0 };
      }
    }
    /**
     * Lässt alle Kinder-Objekte von einer Startposition zu ihren initialen Koordinaten fliegen.
     * @param pattern Das Muster für die Startpositionen
     * @param duration Dauer in Millisekunden (default: 1000)
     * @param easing Easing-Funktion (default: 'easeOut')
     */
    flyToInitialPositions(pattern = "ChaosIn", duration = 1e3, easing = "easeOut") {
      this.children.forEach((child, index) => {
        if ("moveTo" in child && typeof child.moveTo === "function") {
          const targetX = child.x;
          const targetY = child.y;
          const start = this.getPatternStartPosition(pattern, targetX, targetY, index);
          child.x = start.x;
          child.y = start.y;
          child.moveTo(targetX, targetY, duration, easing);
        }
      });
    }
    /**
     * Lässt alle Kinder-Objekte von ihren aktuellen Positionen zu Zielkoordinaten fliegen (Exit-Animation).
     * @param pattern Das Muster für die Zielpositionen
     * @param duration Dauer in Millisekunden (default: 1000)
     * @param easing Easing-Funktion (default: 'easeIn')
     * @param hideAfter Objekte nach der Animation unsichtbar machen (default: true)
     */
    flyToExitPositions(pattern = "ChaosIn", duration = 1e3, easing = "easeIn", hideAfter = true) {
      this.children.forEach((child, index) => {
        if ("moveTo" in child && typeof child.moveTo === "function") {
          const currentX = child.x;
          const currentY = child.y;
          const target = this.getPatternStartPosition(pattern, currentX, currentY, index);
          child.moveTo(target.x, target.y, duration, easing, () => {
            if (hideAfter) {
              child.visible = false;
            }
          });
        }
      });
    }
  };
  // ─────────────────────────────────────────────
  // Stage Animations
  // ─────────────────────────────────────────────
  /**
   * Mögliche Fly-In/-Out Muster.
   */
  __publicField(TStage, "FlyPatterns", [
    "UpLeft",
    "UpMiddle",
    "UpRight",
    "Left",
    "Right",
    "BottomLeft",
    "BottomMiddle",
    "BottomRight",
    "ChaosIn",
    "ChaosOut",
    "Matrix",
    "Random"
  ]);

  // src/components/TSplashStage.ts
  var TSplashStage = class extends TStage {
    constructor(name = "SplashStage", x = 0, y = 0, cols = 32, rows = 24, cellSize = 20) {
      super(name, x, y, cols, rows, cellSize);
      __publicField(this, "_duration", 3e3);
      __publicField(this, "_autoHide", true);
      this.style.backgroundColor = "#000000";
    }
    // ─────────────────────────────────────────────
    // Splash-spezifische Properties
    // ─────────────────────────────────────────────
    get duration() {
      return this._duration;
    }
    set duration(value) {
      this._duration = Math.max(0, value);
    }
    get autoHide() {
      return this._autoHide;
    }
    set autoHide(value) {
      this._autoHide = value;
    }
    // ─────────────────────────────────────────────
    // Inspector Properties (überschreibt TStage)
    // ─────────────────────────────────────────────
    getInspectorProperties() {
      const parentProps = super.getInspectorProperties();
      const filteredProps = parentProps.filter(
        (p) => !["description"].includes(p.name)
      );
      return [
        ...filteredProps,
        { name: "duration", label: "Duration (ms)", type: "number", group: "Splash" },
        { name: "autoHide", label: "Auto Hide", type: "boolean", group: "Splash" }
      ];
    }
    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────
    getEvents() {
      return [
        ...super.getEvents(),
        "onFinish"
        // Wird ausgelöst wenn Splash-Duration abgelaufen ist
      ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
      return {
        ...super.toJSON(),
        duration: this._duration,
        autoHide: this._autoHide
      };
    }
  };

  // src/components/TStageController.ts
  var TStageController = class extends TWindow {
    constructor(name = "StageController", x = 0, y = 0) {
      super(name, x, y, 5, 2);
      // Referenz auf das Projekt (wird von GameRuntime gesetzt)
      __publicField(this, "_stages", []);
      __publicField(this, "_currentStageId", "");
      __publicField(this, "_mainStageId", "main");
      // Callback für Stage-Wechsel (wird von GameRuntime registriert)
      __publicField(this, "_onStageChangeCallback", null);
      this.style.backgroundColor = "#9c27b0";
      this.style.color = "#ffffff";
      this.visible = true;
    }
    // ─────────────────────────────────────────────
    // Properties (Nur-Lesen im Inspector)
    // ─────────────────────────────────────────────
    get currentStageId() {
      return this._currentStageId;
    }
    get currentStageIndex() {
      return this._stages.findIndex((s) => s.id === this._currentStageId);
    }
    get stageCount() {
      return this._stages.length;
    }
    get mainStageId() {
      return this._mainStageId;
    }
    get currentStageName() {
      const stage = this._stages.find((s) => s.id === this._currentStageId);
      return stage?.name || "";
    }
    get currentStageType() {
      const stage = this._stages.find((s) => s.id === this._currentStageId);
      return stage?.type || "standard";
    }
    get isOnMainStage() {
      return this._currentStageId === this._mainStageId;
    }
    get isOnSplashStage() {
      const stage = this._stages.find((s) => s.id === this._currentStageId);
      return stage?.type === "splash";
    }
    /**
     * Gibt die Objekte der aktuellen Stage zurück
     */
    getCurrentStageObjects() {
      const stage = this._stages.find((s) => s.id === this._currentStageId);
      return stage?.objects || [];
    }
    /**
     * Registriert einen Callback für Stage-Wechsel
     */
    setOnStageChangeCallback(cb) {
      this._onStageChangeCallback = cb;
    }
    // ─────────────────────────────────────────────
    // Initialisierung (von GameRuntime aufgerufen)
    // ─────────────────────────────────────────────
    /**
     * Setzt die Stages-Liste und initialisiert den Controller
     */
    setStages(stages) {
      this._stages = stages;
      const mainStage = stages.find((s) => s.type === "main");
      if (mainStage) {
        this._mainStageId = mainStage.id;
      } else {
        const standardStage = stages.find((s) => s.type === "standard");
        if (standardStage) {
          this._mainStageId = standardStage.id;
        }
      }
      const splashStage = stages.find((s) => s.type === "splash");
      this._currentStageId = splashStage?.id || this._mainStageId;
      console.log(`[TStageController] Initialized with ${stages.length} stages. Starting at: ${this._currentStageId}`);
    }
    // ─────────────────────────────────────────────
    // Methoden (aufrufbar via call_method Action)
    // ─────────────────────────────────────────────
    /**
     * Wechselt zur nächsten Stage in der Reihenfolge
     */
    nextStage() {
      const currentIndex = this.currentStageIndex;
      if (currentIndex < this._stages.length - 1) {
        const nextStage = this._stages[currentIndex + 1];
        this.goToStage(nextStage.id);
      } else {
        console.log("[TStageController] Already at last stage");
        this.triggerEvent("onAllStagesCompleted");
      }
    }
    /**
     * Wechselt zur vorherigen Stage
     */
    previousStage() {
      const currentIndex = this.currentStageIndex;
      if (currentIndex > 0) {
        const prevStage = this._stages[currentIndex - 1];
        this.goToStage(prevStage.id);
      } else {
        console.log("[TStageController] Already at first stage");
      }
    }
    /**
     * Wechselt zu einer bestimmten Stage
     */
    goToStage(stageId) {
      const stage = this._stages.find((s) => s.id === stageId);
      if (!stage) {
        console.warn(`[TStageController] Stage not found: ${stageId}`);
        return;
      }
      const oldStageId = this._currentStageId;
      this._currentStageId = stageId;
      console.log(`[TStageController] Switching from ${oldStageId} to ${stageId}`);
      if (this._onStageChangeCallback) {
        this._onStageChangeCallback(oldStageId, stageId, stage.objects || []);
      }
      this.triggerEvent("onStageChange", {
        oldStageId,
        newStageId: stageId,
        stageName: stage.name,
        stageType: stage.type
      });
    }
    /**
     * Wechselt zur HauptStage
     */
    goToMainStage() {
      this.goToStage(this._mainStageId);
    }
    /**
     * Wechselt zur ersten Stage (Splash wenn vorhanden)
     */
    goToFirstStage() {
      if (this._stages.length > 0) {
        this.goToStage(this._stages[0].id);
      }
    }
    /**
     * Prüft ob eine Stage existiert
     */
    hasStage(stageId) {
      return this._stages.some((s) => s.id === stageId);
    }
    /**
     * Prüft ob ein Splashscreen existiert
     */
    hasSplashStage() {
      return this._stages.some((s) => s.type === "splash");
    }
    /**
     * Prüft ob die HauptStage existiert
     */
    hasMainStage() {
      return this._stages.some((s) => s.type === "main");
    }
    // ─────────────────────────────────────────────
    // Events
    // ─────────────────────────────────────────────
    getEvents() {
      return [
        ...super.getEvents(),
        "onStageChange",
        // Wird bei jedem Stage-Wechsel ausgelöst
        "onAllStagesCompleted",
        // Letzte Stage erreicht (für Level-Ende)
        "onSplashFinished"
        // SplashStage abgeschlossen
      ];
    }
    triggerEvent(eventName, data) {
      this.emit?.(eventName, data);
      console.log(`[TStageController] Event: ${eventName}`, data);
    }
    // ─────────────────────────────────────────────
    // Inspector Properties
    // ─────────────────────────────────────────────
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        // Nur-Lesen Properties (disabled im Inspector)
        { name: "currentStageId", label: "Current Stage ID", type: "string", group: "Stage Info" },
        { name: "currentStageName", label: "Current Stage Name", type: "string", group: "Stage Info" },
        { name: "currentStageType", label: "Current Stage Type", type: "string", group: "Stage Info" },
        { name: "stageCount", label: "Total Stages", type: "number", group: "Stage Info" },
        { name: "isOnMainStage", label: "Is Main Stage", type: "boolean", group: "Stage Info" },
        { name: "isOnSplashStage", label: "Is Splash Stage", type: "boolean", group: "Stage Info" }
      ];
    }
    // ─────────────────────────────────────────────
    // Serialization
    // ─────────────────────────────────────────────
    toJSON() {
      return {
        ...super.toJSON()
        // Stages werden nicht hier gespeichert, sondern im project.stages Array
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

  // src/components/TMemo.ts
  var TMemo = class extends TTextControl {
    constructor(name, x, y, width = 20, height = 10) {
      super(name, x, y, width, height);
      __publicField(this, "text");
      __publicField(this, "placeholder");
      __publicField(this, "readOnly");
      this.text = "";
      this.placeholder = "";
      this.readOnly = false;
      this.style.backgroundColor = "#1e1e1e";
      this.style.borderColor = "#444444";
      this.style.borderWidth = 1;
      this.style.color = "#9cdcfe";
      this.style.fontFamily = "monospace";
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "text", label: "Text", type: "string", group: "Specifics" },
        { name: "placeholder", label: "Placeholder", type: "string", group: "Specifics" },
        { name: "readOnly", label: "Read Only", type: "boolean", group: "Specifics" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        text: this.text,
        placeholder: this.placeholder,
        readOnly: this.readOnly
      };
    }
  };

  // src/components/TShape.ts
  var TShape = class extends TPanel {
    constructor(name, x, y, width = 100, height = 100) {
      super(name, x, y, width, height);
      __publicField(this, "shapeType", "circle");
      // Style properties
      __publicField(this, "fillColor", "transparent");
      __publicField(this, "strokeColor", "#29b6f6");
      __publicField(this, "strokeWidth", 2);
      __publicField(this, "opacity", 1);
      // New Content properties
      __publicField(this, "text", "");
      __publicField(this, "contentImage", "");
      this.style.backgroundColor = "transparent";
      this.style.borderWidth = 0;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const filtered = props.filter((p) => !["showGrid", "gridColor", "gridStyle", "caption"].includes(p.name));
      return [
        ...filtered,
        {
          name: "shapeType",
          label: "Form-Typ",
          type: "select",
          group: "Form",
          options: ["circle", "rect", "square", "ellipse", "triangle", "arrow", "line"]
        },
        { name: "fillColor", label: "F\xFCllfarbe", type: "color", group: "Form" },
        { name: "strokeColor", label: "Linienfarbe (Rand)", type: "color", group: "Form" },
        { name: "strokeWidth", label: "Linienst\xE4rke", type: "number", group: "Form" },
        { name: "opacity", label: "Deckkraft", type: "number", group: "Form" },
        // Content group
        { name: "text", label: "Text/Emoji", type: "string", group: "Inhalt" },
        { name: "contentImage", label: "Bild-Inhalt", type: "image_picker", group: "Inhalt" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        shapeType: this.shapeType,
        fillColor: this.fillColor,
        strokeColor: this.strokeColor,
        strokeWidth: this.strokeWidth,
        opacity: this.opacity,
        text: this.text,
        contentImage: this.contentImage
      };
    }
  };

  // src/components/TVariable.ts
  var TVariable = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "className", "TVariable");
      __publicField(this, "value");
      __publicField(this, "defaultValue");
      __publicField(this, "variableType", "integer");
      this.isVariable = true;
      this.style.backgroundColor = "#673ab7";
      this.style.borderColor = "#512da8";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "variableType", label: "Typ", type: "select", group: "Variable", options: ["integer", "real", "string", "boolean"] },
        { name: "defaultValue", label: "Standardwert", type: "string", group: "Variable" },
        { name: "value", label: "Aktueller Wert", type: "string", group: "Variable" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onValueChanged"
      ];
    }
  };

  // src/components/TTable.ts
  var TTable = class extends TWindow {
    constructor(name, x, y, width = 8, height = 6) {
      super(name, x, y, width, height);
      __publicField(this, "className", "TTable");
      __publicField(this, "data", []);
      __publicField(this, "columns", []);
      __publicField(this, "selectedIndex", -1);
      __publicField(this, "rowHeight", 30);
      __publicField(this, "showHeader", true);
      __publicField(this, "onRowClick");
      this.style.backgroundColor = "#2c3e50";
      this.style.color = "#ecf0f1";
      this.style.borderColor = "rgba(255,255,255,0.1)";
      this.style.borderWidth = 1;
      this.columns = [
        { property: "name", label: "Name", width: "1fr" },
        { property: "type", label: "Typ", width: "80px" }
      ];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "rowHeight", label: "Zeilenh\xF6he", type: "number", group: "Table" },
        { name: "showHeader", label: "Header anzeigen", type: "boolean", group: "Table" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        data: this.data,
        columns: this.columns,
        selectedIndex: this.selectedIndex,
        rowHeight: this.rowHeight,
        showHeader: this.showHeader
      };
    }
  };

  // src/components/TObjectList.ts
  var TObjectList = class extends TTable {
    constructor(name, x, y) {
      super(name, x, y, 8, 4);
      __publicField(this, "className", "TObjectList");
      __publicField(this, "items", []);
      // List of object IDs or names
      __publicField(this, "searchValue", "");
      __publicField(this, "searchProperty", "name");
      this.isVariable = true;
      this.style.backgroundColor = "#009688";
      this.style.borderColor = "#00796b";
      this.style.borderWidth = 2;
      this.rowHeight = 28;
      this.columns = [
        { property: "name", label: "Name", width: "1fr" },
        { property: "uiScope", label: "Scope", width: "60px" },
        { property: "usageCount", label: "Links", width: "50px" }
      ];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "searchValue", label: "Suche (Wert)", type: "string", group: "List" },
        { name: "searchProperty", label: "Suche (Property)", type: "string", group: "List" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        items: this.items,
        searchValue: this.searchValue,
        searchProperty: this.searchProperty
      };
    }
  };

  // src/components/TThresholdVariable.ts
  var TThresholdVariable = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "className", "TThresholdVariable");
      __publicField(this, "value");
      __publicField(this, "threshold", 100);
      this.isVariable = true;
      this.style.backgroundColor = "#ff9800";
      this.style.borderColor = "#f57c00";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "value", label: "Wert", type: "number", group: "Threshold" },
        { name: "threshold", label: "Schwellenwert", type: "number", group: "Threshold" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onThresholdReached",
        "onThresholdLeft",
        "onThresholdExceeded"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        value: this.value,
        threshold: this.threshold
      };
    }
  };

  // src/components/TTriggerVariable.ts
  var TTriggerVariable = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "className", "TTriggerVariable");
      __publicField(this, "value");
      __publicField(this, "triggerValue", 1);
      this.isVariable = true;
      this.style.backgroundColor = "#f44336";
      this.style.borderColor = "#d32f2f";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "value", label: "Wert", type: "string", group: "Trigger" },
        { name: "triggerValue", label: "Trigger-Wert", type: "string", group: "Trigger" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onTriggerEnter",
        "onTriggerExit"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        value: this.value,
        triggerValue: this.triggerValue
      };
    }
  };

  // src/components/TRangeVariable.ts
  var TRangeVariable = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "className", "TRangeVariable");
      __publicField(this, "value");
      __publicField(this, "min", 0);
      __publicField(this, "max", 100);
      this.isVariable = true;
      this.style.backgroundColor = "#2196f3";
      this.style.borderColor = "#1976d2";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "value", label: "Wert", type: "number", group: "Range" },
        { name: "min", label: "Minimum", type: "number", group: "Range" },
        { name: "max", label: "Maximum", type: "number", group: "Range" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onMinReached",
        "onMaxReached",
        "onInside",
        "onOutside"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        value: this.value,
        min: this.min,
        max: this.max
      };
    }
  };

  // src/components/TListVariable.ts
  var TListVariable = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 2);
      __publicField(this, "className", "TListVariable");
      __publicField(this, "items", []);
      this.isVariable = true;
      this.style.backgroundColor = "#9c27b0";
      this.style.borderColor = "#7b1fa2";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props
        // Value editing for lists might be complex in property inspector,
        // but we can show the item count at least.
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onItemAdded",
        "onItemRemoved",
        "onCleared"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        items: this.items
      };
    }
  };

  // src/components/TRandomVariable.ts
  var TRandomVariable = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 3, 1);
      __publicField(this, "className", "TRandomVariable");
      __publicField(this, "value", 0);
      __publicField(this, "min", 1);
      __publicField(this, "max", 100);
      __publicField(this, "isInteger", true);
      this.isVariable = true;
      this.style.backgroundColor = "#607d8b";
      this.style.borderColor = "#455a64";
      this.style.borderWidth = 2;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "min", label: "Minimum", type: "number", group: "Random" },
        { name: "max", label: "Maximum", type: "number", group: "Random" },
        { name: "isInteger", label: "Nur Ganzzahlen", type: "boolean", group: "Random" },
        { name: "value", label: "Aktueller Wert", type: "number", group: "Random", readonly: true }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onGenerated"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        min: this.min,
        max: this.max,
        isInteger: this.isInteger,
        value: this.value
      };
    }
    /**
     * Generates a new random value (callable via call_method)
     */
    generate() {
      if (this.isInteger) {
        this.value = Math.floor(Math.random() * (this.max - this.min + 1)) + this.min;
      } else {
        this.value = Math.random() * (this.max - this.min) + this.min;
      }
      console.log(`[TRandomVariable] ${this.name} generated: ${this.value}`);
    }
  };

  // src/components/TKeyStore.ts
  var TKeyStore = class extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 4, 2);
      __publicField(this, "className", "TKeyStore");
      /** Welche Property als Schlüssel dient (z.B. 'id', 'kundennummer') */
      __publicField(this, "keyProperty", "id");
      /** Die gespeicherten Schlüssel-Wert-Paare */
      __publicField(this, "items", {});
      this.isVariable = true;
      this.style.backgroundColor = "#00796b";
      this.style.borderColor = "#004d40";
      this.style.borderWidth = 2;
    }
    // ─────────────────────────────────────────────
    // CRUD Operations
    // ─────────────────────────────────────────────
    /**
     * Erstellt einen neuen Eintrag
     * @param key - Der eindeutige Schlüssel
     * @param data - Die zu speichernden Daten
     * @returns true bei Erfolg, false wenn Schlüssel bereits existiert
     */
    create(key, data) {
      if (this.items.hasOwnProperty(key)) {
        return false;
      }
      this.items[key] = data;
      this.fireEvent("onItemCreated", { key, data });
      return true;
    }
    /**
     * Liest einen Eintrag anhand des Schlüssels
     * @param key - Der Schlüssel des Eintrags
     * @returns Die Daten oder undefined
     */
    read(key) {
      const data = this.items[key];
      if (data !== void 0) {
        this.fireEvent("onItemRead", { key, data });
        return data;
      }
      this.fireEvent("onNotFound", { key });
      return void 0;
    }
    /**
     * Alias für read - für intuitivere Nutzung
     */
    get(key) {
      return this.read(key);
    }
    /**
     * Aktualisiert einen bestehenden Eintrag
     * @param key - Der Schlüssel des Eintrags
     * @param data - Die neuen Daten (werden mit bestehenden gemergt)
     * @returns true bei Erfolg, false wenn Schlüssel nicht existiert
     */
    update(key, data) {
      if (!this.items.hasOwnProperty(key)) {
        this.fireEvent("onNotFound", { key });
        return false;
      }
      const oldData = this.items[key];
      if (typeof oldData === "object" && typeof data === "object" && oldData !== null && data !== null) {
        this.items[key] = { ...oldData, ...data };
      } else {
        this.items[key] = data;
      }
      this.fireEvent("onItemUpdated", { key, oldData, newData: this.items[key] });
      return true;
    }
    /**
     * Erstellt oder aktualisiert einen Eintrag (Upsert)
     */
    set(key, data) {
      const exists = this.items.hasOwnProperty(key);
      this.items[key] = data;
      if (exists) {
        this.fireEvent("onItemUpdated", { key, newData: data });
      } else {
        this.fireEvent("onItemCreated", { key, data });
      }
    }
    /**
     * Löscht einen Eintrag
     * @param key - Der Schlüssel des Eintrags
     * @returns true bei Erfolg, false wenn Schlüssel nicht existiert
     */
    delete(key) {
      if (!this.items.hasOwnProperty(key)) {
        this.fireEvent("onNotFound", { key });
        return false;
      }
      const data = this.items[key];
      delete this.items[key];
      this.fireEvent("onItemDeleted", { key, data });
      return true;
    }
    // ─────────────────────────────────────────────
    // Filter & Suche
    // ─────────────────────────────────────────────
    /**
     * Filtert Einträge nach einer Property
     * @param property - Die zu prüfende Property
     * @param value - Der gesuchte Wert
     * @returns Array der passenden Einträge
     */
    filter(property, value) {
      return Object.values(this.items).filter((item) => {
        if (typeof item === "object" && item !== null) {
          return item[property] === value;
        }
        return false;
      });
    }
    /**
     * Findet den ersten Eintrag mit passendem Property-Wert
     * @param property - Die zu prüfende Property
     * @param value - Der gesuchte Wert
     * @returns Der gefundene Eintrag oder null
     */
    find(property, value) {
      for (const item of Object.values(this.items)) {
        if (typeof item === "object" && item !== null && item[property] === value) {
          return item;
        }
      }
      return null;
    }
    /**
     * Prüft ob ein Schlüssel existiert
     */
    has(key) {
      return this.items.hasOwnProperty(key);
    }
    /**
     * Gibt alle Schlüssel zurück
     */
    keys() {
      return Object.keys(this.items);
    }
    /**
     * Gibt alle Werte zurück
     */
    values() {
      return Object.values(this.items);
    }
    /**
     * Gibt Schlüssel-Wert-Paare als Array zurück
     */
    entries() {
      return Object.entries(this.items);
    }
    /**
     * Gibt die Anzahl der Einträge zurück
     */
    count() {
      return Object.keys(this.items).length;
    }
    /**
     * Löscht alle Einträge
     */
    clear() {
      const count = this.count();
      this.items = {};
      this.fireEvent("onCleared", { count });
    }
    // ─────────────────────────────────────────────
    // Hilfsmethoden
    // ─────────────────────────────────────────────
    fireEvent(eventName, data) {
      const handler = this[eventName];
      if (handler && typeof handler === "string") {
        console.log(`[TKeyStore] Event ${eventName}:`, data);
      }
    }
    // ─────────────────────────────────────────────
    // Inspector Properties & Events
    // ─────────────────────────────────────────────
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "keyProperty", label: "Schl\xFCssel-Property", type: "string", group: "KeyStore" }
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onItemCreated",
        "onItemUpdated",
        "onItemDeleted",
        "onItemRead",
        "onNotFound",
        "onCleared"
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        keyProperty: this.keyProperty,
        items: this.items
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
        case "TStageController":
          newObj = new TStageController(objData.name, objData.x, objData.y);
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
        case "TVideo":
          newObj = new TVideo(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TSplashScreen":
          newObj = new TSplashScreen(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TSplashStage":
          const splashStage = new TSplashStage(
            objData.name,
            objData.x,
            objData.y,
            objData.cols,
            objData.rows,
            objData.cellSize
          );
          if (objData.duration !== void 0) splashStage.duration = objData.duration;
          if (objData.autoHide !== void 0) splashStage.autoHide = objData.autoHide;
          newObj = splashStage;
          break;
        case "TNumberLabel":
          newObj = new TNumberLabel(objData.name, objData.x, objData.y, objData.startValue);
          break;
        case "TMemo":
          newObj = new TMemo(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TShape":
          newObj = new TShape(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TVariable":
          newObj = new TVariable(objData.name, objData.x, objData.y);
          break;
        case "TObjectList":
          newObj = new TObjectList(objData.name, objData.x, objData.y);
          break;
        case "TThresholdVariable":
          newObj = new TThresholdVariable(objData.name, objData.x, objData.y);
          break;
        case "TTriggerVariable":
          newObj = new TTriggerVariable(objData.name, objData.x, objData.y);
          break;
        case "TRangeVariable":
          newObj = new TRangeVariable(objData.name, objData.x, objData.y);
          break;
        case "TListVariable":
          newObj = new TListVariable(objData.name, objData.x, objData.y);
          break;
        case "TRandomVariable":
          newObj = new TRandomVariable(objData.name, objData.x, objData.y);
          break;
        case "TKeyStore":
          newObj = new TKeyStore(objData.name, objData.x, objData.y);
          break;
        default:
          console.warn("Unknown class during load:", objData.className);
          break;
      }
      if (newObj) {
        newObj.id = objData.id;
        newObj.className = objData.className;
        newObj.scope = objData.scope || "stage";
        newObj.isVariable = objData.isVariable || false;
        if (objData.width !== void 0) newObj.width = objData.width;
        if (objData.height !== void 0) newObj.height = objData.height;
        if (objData.x !== void 0) newObj.x = objData.x;
        if (objData.y !== void 0) newObj.y = objData.y;
        if (objData.visible !== void 0) newObj.visible = objData.visible;
        if (objData.zIndex !== void 0) newObj.zIndex = objData.zIndex;
        if (objData.draggable !== void 0) newObj.draggable = objData.draggable;
        if (objData.dragMode !== void 0) newObj.dragMode = objData.dragMode;
        if (objData.droppable !== void 0) newObj.droppable = objData.droppable;
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
        if (objData.readOnly !== void 0) newObj.readOnly = objData.readOnly;
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
        if (objData.src !== void 0 && (newObj.className === "TImage" || newObj.className === "TSprite")) {
          newObj.backgroundImage = objData.src;
        }
        if (objData.objectFit !== void 0) newObj.objectFit = objData.objectFit;
        if (objData.imageOpacity !== void 0) newObj.imageOpacity = objData.imageOpacity;
        if (objData.icon !== void 0) newObj.icon = objData.icon;
        if (objData.alt !== void 0) newObj.alt = objData.alt;
        if (objData.fallbackColor !== void 0) newObj.fallbackColor = objData.fallbackColor;
        if (objData.videoSource !== void 0) newObj.videoSource = objData.videoSource;
        if (objData.autoplay !== void 0) newObj.autoplay = objData.autoplay;
        if (objData.loop !== void 0) newObj.loop = objData.loop;
        if (objData.muted !== void 0) newObj.muted = objData.muted;
        if (objData.playbackRate !== void 0) newObj.playbackRate = objData.playbackRate;
        if (objData.duration !== void 0) newObj.duration = objData.duration;
        if (objData.autoHide !== void 0) newObj.autoHide = objData.autoHide;
        if (objData.fadeSpeed !== void 0) newObj.fadeSpeed = objData.fadeSpeed;
        if (objData.onFinishTask !== void 0) newObj.onFinishTask = objData.onFinishTask;
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
        const reservedKeys = [
          "className",
          "id",
          "children",
          "Tasks",
          "style",
          // Handled explicitly
          "shapeType",
          // Often constructor arg, but safe to re-assign if public
          "type"
          // Sometimes used for internal typing
        ];
        Object.keys(objData).forEach((key) => {
          if (reservedKeys.includes(key)) return;
          const val = objData[key];
          if (val === void 0) return;
          if (key.includes(".")) {
            const parts = key.split(".");
            let target = newObj;
            for (let i = 0; i < parts.length - 1; i++) {
              const part = parts[i];
              if (!target[part]) target[part] = {};
              target = target[part];
            }
            target[parts[parts.length - 1]] = val;
          } else {
            newObj[key] = val;
          }
        });
        if (newObj.isVariable && objData.value !== void 0) {
          newObj.value = objData.value;
        }
        if (objData.style) {
          const targetStyle = newObj.style || {};
          Object.assign(targetStyle, objData.style);
          newObj.style = targetStyle;
        }
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

  // src/runtime/RuntimeStageManager.ts
  var RuntimeStageManager = class {
    constructor(project) {
      this.project = project;
    }
    resolveInheritanceChain(stageId, visited = /* @__PURE__ */ new Set()) {
      if (visited.has(stageId)) {
        console.error(`[RuntimeStageManager] Circular inheritance detected for stage: ${stageId}`);
        return [];
      }
      visited.add(stageId);
      const stage = this.project.stages?.find((s) => s.id === stageId);
      if (!stage) return [];
      const chain = [stage];
      if (stage.inheritsFrom) {
        chain.unshift(...this.resolveInheritanceChain(stage.inheritsFrom, visited));
      }
      return chain;
    }
    getMergedStageData(stageId) {
      const stageChain = this.resolveInheritanceChain(stageId);
      let mergedObjects = [];
      let mergedTasks = [];
      let mergedActions = [];
      let mergedFlowCharts = { ...this.project.flowCharts || {} };
      const objectIdSet = /* @__PURE__ */ new Set();
      stageChain.forEach((stage) => {
        const stageObjects = hydrateObjects(stage.objects || []);
        stageObjects.forEach((obj) => {
          mergedObjects = mergedObjects.filter((o) => o.id !== obj.id);
          mergedObjects.push(obj);
          objectIdSet.add(obj.id);
        });
        if (stage.tasks) {
          stage.tasks.forEach((t) => {
            mergedTasks = mergedTasks.filter((existing) => existing.name !== t.name);
            mergedTasks.push(t);
          });
        }
        if (stage.actions) {
          stage.actions.forEach((a) => {
            mergedActions = mergedActions.filter((existing) => existing.name !== a.name);
            mergedActions.push(a);
          });
        }
        if (stage.flowCharts) {
          Object.assign(mergedFlowCharts, stage.flowCharts);
        }
        if (stage.variables) {
          const hydratedVars = hydrateObjects(stage.variables);
          hydratedVars.forEach((vObj) => {
            mergedObjects = mergedObjects.filter((o) => o.id !== vObj.id);
            mergedObjects.push(vObj);
            objectIdSet.add(vObj.id);
          });
        }
      });
      const activeStage = stageChain[stageChain.length - 1];
      if (activeStage && activeStage.type !== "splash" && activeStage.type !== "main") {
        const mainStage = this.project.stages?.find((s) => s.type === "main");
        if (mainStage && mainStage.objects) {
          const globalObjects = hydrateObjects(mainStage.objects);
          const globalVariables = hydrateObjects(mainStage.variables || []);
          [...globalObjects, ...globalVariables].forEach((gObj) => {
            const isGlobal = gObj.scope === "global" || gObj.isVariable;
            const systemClasses = [
              "TGameLoop",
              "TStageController",
              "TGameState",
              "THandshake",
              "THeartbeat",
              "TGameServer",
              "TInputController",
              "TDebugLog"
            ];
            const isSystem = systemClasses.includes(gObj.className);
            if ((isGlobal || isSystem) && !objectIdSet.has(gObj.id)) {
              const nameCollision = mergedObjects.find((l) => l.name === gObj.name);
              if (!nameCollision) {
                mergedObjects.push(gObj);
              }
            }
          });
        }
      }
      return {
        objects: mergedObjects,
        tasks: mergedTasks,
        actions: mergedActions,
        flowCharts: mergedFlowCharts
      };
    }
  };

  // src/runtime/GameRuntime.ts
  var GameRuntime = class {
    constructor(project, objects, options = {}) {
      this.project = project;
      this.options = options;
      __publicField(this, "reactiveRuntime");
      __publicField(this, "actionExecutor");
      __publicField(this, "taskExecutor", null);
      __publicField(this, "variableManager");
      __publicField(this, "stageManager");
      __publicField(this, "objects", []);
      __publicField(this, "isSplashActive", false);
      __publicField(this, "splashTimerId", null);
      __publicField(this, "stage", null);
      __publicField(this, "stageController", null);
      __publicField(this, "varTimers", /* @__PURE__ */ new Map());
      this.reactiveRuntime = new ReactiveRuntime();
      this.variableManager = new RuntimeVariableManager(this, options.initialGlobalVars);
      this.variableManager.initializeVariables(project);
      this.stageManager = new RuntimeStageManager(project);
      const hasStages = project.stages && project.stages.length > 0;
      let activeStage = null;
      if (options.startStageId && hasStages) {
        activeStage = project.stages.find((s) => s.id === options.startStageId);
      } else if (hasStages) {
        activeStage = project.stages.find((s) => s.type === "splash") || project.stages.find((s) => s.id === project.activeStageId) || project.stages[0];
      }
      if (objects) {
        this.objects = objects;
        this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
        this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
      } else if (activeStage) {
        this.stage = activeStage;
        this.isSplashActive = activeStage.type === "splash";
        const merged = this.stageManager.getMergedStageData(activeStage.id);
        this.objects = merged.objects;
        this.variableManager.initializeStageVariables(activeStage);
        this.syncVariableComponents();
        if (options.makeReactive) {
          this.objects.forEach((obj) => this.reactiveRuntime.registerObject(obj.name, obj, true));
          this.reactiveRuntime.setVariable("isSplashActive", this.isSplashActive);
          const mp = options.multiplayerManager || window.multiplayerManager;
          this.reactiveRuntime.setVariable("isMultiplayer", !!mp);
          if (mp) {
            this.reactiveRuntime.setVariable("playerNumber", mp.playerNumber || 1);
            this.reactiveRuntime.setVariable("isHost", mp.isHost !== void 0 ? mp.isHost : mp.playerNumber === 1);
          } else {
            this.reactiveRuntime.setVariable("playerNumber", 1);
            this.reactiveRuntime.setVariable("isHost", true);
          }
          if (options.onRender) {
            this.reactiveRuntime.getWatcher().addGlobalListener(() => options.onRender());
          }
          this.objects = this.reactiveRuntime.getObjects();
          this.initializeReactiveBindings();
        }
        this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
        this.taskExecutor = new TaskExecutor(project, merged.actions, this.actionExecutor, merged.flowCharts, options.multiplayerManager, merged.tasks);
      } else {
        this.objects = [];
        this.actionExecutor = new ActionExecutor(this.objects, options.multiplayerManager, options.onNavigate);
        this.taskExecutor = new TaskExecutor(project, project.actions || [], this.actionExecutor, project.flowCharts, options.multiplayerManager, project.tasks);
      }
      if (options.multiplayerManager) {
        options.multiplayerManager.onRemoteTask = (msg) => this.executeRemoteTask(msg.taskName, msg.params);
      }
      this.init();
      this.initStageController();
      if (activeStage && options.onStageSwitch) options.onStageSwitch(activeStage.id);
    }
    get contextVars() {
      return this.variableManager.contextVars;
    }
    get projectVariables() {
      return this.variableManager.projectVariables;
    }
    get stageVariables() {
      return this.variableManager.stageVariables;
    }
    stop() {
      if (this.splashTimerId) {
        clearTimeout(this.splashTimerId);
        this.splashTimerId = null;
      }
      this.objects.forEach((obj) => obj.onRuntimeStop?.());
      GameLoopManager.getInstance().stop();
      AnimationManager.getInstance().clear();
    }
    start() {
      if (this.options.onRender) this.options.onRender();
      this.objects.forEach((obj) => this.handleEvent(obj.id, "onStart"));
      if (this.isSplashActive) {
        if (this.project.splashAutoHide) {
          const duration = this.stage?.duration || this.project.splashDuration || 3e3;
          this.splashTimerId = setTimeout(() => this.finishSplash(), duration);
        }
        return;
      }
      this.initMainGame();
    }
    initMainGame() {
      let stageConfig = this.stage || this.project.stage || this.project.grid;
      if (stageConfig?.startAnimation && stageConfig.startAnimation !== "none") {
        this.triggerStartAnimation(stageConfig);
      }
      const gridConfig = this.stage && this.stage.grid || this.project.stage?.grid || this.project.grid;
      const runtimeCallbacks = {
        handleEvent: (id, ev, data) => this.handleEvent(id, ev, data),
        render: this.options.onRender || (() => {
        }),
        gridConfig,
        objects: this.objects
      };
      this.objects.forEach((obj) => {
        obj.initRuntime?.(runtimeCallbacks);
        obj.onRuntimeStart?.();
      });
      this.initMultiplayer();
      this.objects.filter((o) => o.className === "TSplashScreen").forEach((splash) => {
        setTimeout(() => {
          this.handleEvent(splash.id, "onFinish");
          if (splash.autoHide) {
            splash.visible = false;
            this.options.onRender?.();
          }
        }, splash.duration || 3e3);
      });
      this.options.onRender?.();
    }
    finishSplash() {
      if (!this.isSplashActive) return;
      if (this.splashTimerId) {
        clearTimeout(this.splashTimerId);
        this.splashTimerId = null;
      }
      this.isSplashActive = false;
      if (this.stageController) this.stageController.goToMainStage();
      else this.legacyStageSwitch();
    }
    initStageController() {
      this.stageController = this.objects.find((o) => o.className === "TStageController");
      if (this.stageController && this.project.stages) {
        this.stageController.setStages(this.project.stages);
        this.stageController.setOnStageChangeCallback((oldId, newId) => this.handleStageChange(oldId, newId));
      }
    }
    handleStageChange(_oldStageId, newStageId) {
      this.stage = this.project.stages?.find((s) => s.id === newStageId);
      if (!this.stage) return;
      const merged = this.stageManager.getMergedStageData(newStageId);
      this.objects = merged.objects;
      if (this.taskExecutor) {
        this.taskExecutor.setFlowCharts(merged.flowCharts);
        this.taskExecutor.setTasks(merged.tasks);
        this.taskExecutor.setActions(merged.actions);
      }
      if (this.options.makeReactive) {
        this.reactiveRuntime.clear();
        this.clearAllTimers();
        AnimationManager.getInstance().clear();
        this.objects.forEach((obj) => this.reactiveRuntime.registerObject(obj.name, obj, true));
        this.reactiveRuntime.setVariable("isSplashActive", false);
        if (this.options.onRender) {
          this.reactiveRuntime.getWatcher().addGlobalListener(() => this.options.onRender());
        }
        this.objects = this.reactiveRuntime.getObjects();
        this.initializeReactiveBindings();
      }
      this.variableManager.stageVariables = {};
      this.variableManager.initializeStageVariables(this.stage);
      this.syncVariableComponents();
      this.actionExecutor.setObjects(this.objects);
      this.initStageController();
      this.start();
      if (this.options.onStageSwitch) this.options.onStageSwitch(newStageId);
    }
    legacyStageSwitch() {
      const mainStage = this.project.stages?.find((s) => s.type === "main");
      if (mainStage) this.handleStageChange("splash", mainStage.id);
      else {
        this.objects = hydrateObjects(this.project.objects || []);
        this.start();
      }
    }
    initMultiplayer() {
      const mp = this.options.multiplayerManager || window.multiplayerManager;
      if (!mp?.on) return;
      mp.on((msg) => {
        this.objects.filter((o) => o.className === "THandshake").forEach((hs) => {
          if (msg.type === "room_joined") {
            hs._setRoomInfo(msg.roomCode, msg.playerNumber, msg.playerNumber === 1);
            hs._setStatus("waiting");
            hs._fireEvent("onRoomJoined", msg);
          } else if (msg.type === "game_start") {
            hs._setStatus("playing");
            hs._fireEvent("onGameStart", msg);
          } else if (msg.type === "room_created") {
            hs._setRoomInfo(msg.roomCode, 1, true);
            hs._setStatus("waiting");
            hs._fireEvent("onRoomCreated", msg);
          }
        });
        this.objects.filter((o) => o.className === "THeartbeat").forEach((hb) => {
          if (msg.type === "pong") hb._handlePong(msg.serverTime);
          else if (msg.type === "player_timeout") hb._setConnectionLost();
        });
      });
    }
    triggerStartAnimation(stageConfig) {
      let animationType = stageConfig.startAnimation || "fade-in";
      let duration = stageConfig.startAnimationDuration || 1e3;
      this.objects.forEach((obj) => {
        if (obj.visible !== false) {
          if (animationType === "fade-in") {
            const originalOpacity = obj.opacity !== void 0 ? obj.opacity : 1;
            obj.opacity = 0;
            AnimationManager.getInstance().animate(obj, { opacity: originalOpacity }, duration);
          } else if (animationType === "slide-up") {
            const originalY = obj.y;
            obj.y += 100;
            AnimationManager.getInstance().animate(obj, { y: originalY }, duration);
          }
        }
      });
    }
    handleEvent(objectId, eventName, data = {}) {
      const obj = this.objects.find((o) => o.id === objectId);
      if (!obj) return;
      const eventLogId = DebugLogService.getInstance().log("Event", `Triggered: ${obj.name}.${eventName}`, {
        objectName: obj.name,
        eventName,
        data
      });
      if (obj.onEvent) {
        const actions = obj.onEvent[eventName];
        if (actions) {
          const actionList = Array.isArray(actions) ? actions : [actions];
          for (const action of actionList) {
            this.actionExecutor.execute(action, {
              vars: this.contextVars,
              contextVars: this.contextVars,
              eventData: data
            }, {}, void 0, eventLogId);
          }
        }
      }
      if (this.taskExecutor) {
        const taskName = `${obj.name}.${eventName}`;
        this.taskExecutor.execute(taskName, { ...data, sender: obj }, this.contextVars, obj, 0, eventLogId);
      }
    }
    updateRemoteState(objectIdOrName, state) {
      const obj = this.objects.find((o) => o.id === objectIdOrName || o.name === objectIdOrName);
      if (obj) {
        Object.assign(obj, state);
        if (this.options.onRender) this.options.onRender();
      }
    }
    triggerRemoteEvent(objectId, eventName, params) {
      const obj = this.objects.find((o) => o.id === objectId);
      if (obj) this.handleEvent(objectId, eventName, params);
    }
    executeRemoteAction(action) {
      this.actionExecutor.execute(action, {
        vars: this.contextVars,
        contextVars: this.contextVars
      });
    }
    executeRemoteTask(taskName, params = {}, mode) {
      if (!this.taskExecutor) return;
      this.taskExecutor.execute(taskName, params, this.contextVars, mode === "sequential");
    }
    getContext() {
      const context = {
        project: this.project
      };
      Object.assign(context, this.contextVars);
      this.objects.forEach((obj) => {
        if (obj.name) {
          context[obj.name] = obj;
        }
        if (obj.id) {
          context[obj.id] = obj;
        }
      });
      return context;
    }
    getObjects() {
      const results = [];
      const process = (objs, parentX = 0, parentY = 0, parentZ = 0) => {
        objs.forEach((obj) => {
          if (obj.visible === false) return;
          const absoluteX = parentX + (obj.x || 0);
          const absoluteY = parentY + (obj.y || 0);
          const absoluteZ = parentZ + (obj.zIndex || 0);
          const copy = { ...obj };
          let proto = Object.getPrototypeOf(obj);
          while (proto && proto !== Object.prototype) {
            const descriptors = Object.getOwnPropertyDescriptors(proto);
            for (const key in descriptors) {
              const descriptor = descriptors[key];
              if (descriptor.get && !(key in copy)) {
                try {
                  copy[key] = obj[key];
                } catch (e) {
                }
              }
            }
            proto = Object.getPrototypeOf(proto);
          }
          copy.x = absoluteX;
          copy.y = absoluteY;
          copy.zIndex = absoluteZ;
          results.push(copy);
          if (obj.children && obj.children.length > 0) {
            process(obj.children, absoluteX, absoluteY, absoluteZ);
          }
        });
      };
      process(this.objects);
      return results;
    }
    createPhantom(original) {
      return {
        ...original,
        id: "phantom_" + Math.random().toString(36).substr(2, 9),
        isPhantom: true,
        opacity: (original.opacity || 1) * 0.5
      };
    }
    removeObject(id) {
      this.objects = this.objects.filter((o) => o.id !== id);
      if (this.options.onRender) this.options.onRender();
    }
    init() {
      if (this.options.makeReactive) {
        this.objects.forEach((obj) => {
          const mp = this.options.multiplayerManager || window.multiplayerManager;
          if (obj.className === "THandshake" && mp) {
            obj._setRoomInfo(mp.roomCode, mp.playerNumber, mp.isHost);
            obj._setStatus(mp.roomCode ? "playing" : "idle");
          }
        });
      }
    }
    startTimer(prop, varDef, duration) {
      if (this.varTimers.has(prop)) clearInterval(this.varTimers.get(prop));
      let timeLeft = duration;
      const interval = setInterval(() => {
        timeLeft--;
        this.contextVars[prop] = timeLeft;
        if (timeLeft <= 0) {
          clearInterval(interval);
          this.varTimers.delete(prop);
          if (this.taskExecutor && varDef.onTimerEnd) {
            const eventLogId = DebugLogService.getInstance().log("Event", `Triggered: ${prop}.onTimerEnd`, {
              objectName: prop,
              eventName: "onTimerEnd"
            });
            this.taskExecutor.execute(varDef.onTimerEnd, {}, this.contextVars, void 0, 0, eventLogId);
          }
        }
      }, 1e3);
      this.varTimers.set(prop, interval);
    }
    clearAllTimers() {
      this.varTimers.forEach((t) => clearInterval(t));
      this.varTimers.clear();
    }
    handleVariableAction(name, action, ...params) {
      const varDef = this.getVarDef(name);
      if (!varDef) return;
      switch (action) {
        case "set":
          this.contextVars[name] = params[0];
          break;
        case "reset":
          this.contextVars[name] = varDef.defaultValue;
          break;
        case "start":
          if (varDef.type === "timer") this.startTimer(name, varDef, params[0] || varDef.duration || 10);
          break;
        case "stop":
          if (varDef.type === "timer" && this.varTimers.has(name)) {
            clearInterval(this.varTimers.get(name));
            this.varTimers.delete(name);
          }
          break;
        case "add":
          if (varDef.type === "list" || varDef.type === "object_list") {
            const list = Array.isArray(this.contextVars[name]) ? [...this.contextVars[name]] : [];
            list.push(params[0]);
            this.contextVars[name] = list;
          }
          break;
        case "remove":
          if (varDef.type === "list" || varDef.type === "object_list") {
            const list = Array.isArray(this.contextVars[name]) ? [...this.contextVars[name]] : [];
            const idx = list.indexOf(params[0]);
            if (idx > -1) {
              list.splice(idx, 1);
              this.contextVars[name] = list;
            }
          }
          break;
        case "clear":
          if (varDef.type === "list" || varDef.type === "object_list") this.contextVars[name] = [];
          break;
        case "roll":
          if (varDef.type === "random" || varDef.isRandom) {
            const min = Number(varDef.min) || 0;
            const max2 = Number(varDef.max) || 100;
            this.contextVars[name] = min + Math.random() * (max2 - min);
          }
          break;
      }
    }
    getVarDef(name) {
      let varDef = this.stage?.variables?.find((v) => v.name === name);
      if (!varDef && this.project.variables) {
        varDef = this.project.variables.find((v) => v.name === name);
      }
      return varDef;
    }
    /**
     * Traverses all objects and registers reactive bindings for properties containing ${...}
     */
    initializeReactiveBindings() {
      const process = (objs) => {
        objs.forEach((obj) => {
          this.bindObjectProperties(obj);
          if (obj.children && obj.children.length > 0) {
            process(obj.children);
          }
        });
      };
      process(this.objects);
      const variableComponents = this.objects.filter((obj) => obj.isVariable || obj.className?.includes("Variable"));
      variableComponents.forEach((obj) => {
        this.reactiveRuntime.getWatcher().watch(obj, "value", (newValue, oldValue) => {
          const varDef = this.getVarDef(obj.name);
          if (varDef) {
            this.variableManager.processVariableEvents(obj.name, newValue, oldValue, varDef);
          }
        });
        this.reactiveRuntime.getWatcher().watch(obj, "items", (newValue, oldValue) => {
          const varDef = this.getVarDef(obj.name);
          if (varDef) {
            this.variableManager.processVariableEvents(obj.name, newValue, oldValue, varDef);
          }
        });
        if (obj.value !== void 0) {
          this.contextVars[obj.name] = obj.value;
        } else if (Array.isArray(obj.items)) {
          this.contextVars[obj.name] = obj.items;
        }
      });
    }
    bindObjectProperties(obj) {
      const skipProps = ["id", "name", "className", "parentId", "constructor", "Tasks"];
      const bindProps = (target, pathPrefix = "") => {
        if (!target || typeof target !== "object") return;
        Object.keys(target).forEach((key) => {
          if (skipProps.includes(key)) return;
          const val = target[key];
          const propPath = pathPrefix ? `${pathPrefix}.${key}` : key;
          if (typeof val === "string" && val.includes("${")) {
            console.log(`%c[GameRuntime] Creating reactive binding: ${obj.name}.${propPath} \u2190 ${val}`, "color: #4caf50; font-weight: bold");
            this.reactiveRuntime.bindComponent(obj, propPath, val);
          } else if (val && typeof val === "object" && !Array.isArray(val) && (key === "style" || key === "Tasks")) {
            bindProps(val, propPath);
          }
        });
      };
      bindProps(obj);
    }
    syncVariableComponents() {
      if (!this.objects) return;
      this.objects.forEach((obj) => {
        if (obj.isVariable && obj.name) {
          const runtimeValue = this.variableManager.contextVars[obj.name];
          if (runtimeValue !== void 0) {
            obj.value = runtimeValue;
          }
        }
      });
    }
  };

  // node_modules/fflate/esm/browser.js
  var u8 = Uint8Array;
  var u16 = Uint16Array;
  var i32 = Int32Array;
  var fleb = new u8([
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    0,
    1,
    1,
    1,
    1,
    2,
    2,
    2,
    2,
    3,
    3,
    3,
    3,
    4,
    4,
    4,
    4,
    5,
    5,
    5,
    5,
    0,
    /* unused */
    0,
    0,
    /* impossible */
    0
  ]);
  var fdeb = new u8([
    0,
    0,
    0,
    0,
    1,
    1,
    2,
    2,
    3,
    3,
    4,
    4,
    5,
    5,
    6,
    6,
    7,
    7,
    8,
    8,
    9,
    9,
    10,
    10,
    11,
    11,
    12,
    12,
    13,
    13,
    /* unused */
    0,
    0
  ]);
  var clim = new u8([16, 17, 18, 0, 8, 7, 9, 6, 10, 5, 11, 4, 12, 3, 13, 2, 14, 1, 15]);
  var freb = function(eb, start) {
    var b = new u16(31);
    for (var i = 0; i < 31; ++i) {
      b[i] = start += 1 << eb[i - 1];
    }
    var r = new i32(b[30]);
    for (var i = 1; i < 30; ++i) {
      for (var j = b[i]; j < b[i + 1]; ++j) {
        r[j] = j - b[i] << 5 | i;
      }
    }
    return { b, r };
  };
  var _a = freb(fleb, 2);
  var fl = _a.b;
  var revfl = _a.r;
  fl[28] = 258, revfl[258] = 28;
  var _b = freb(fdeb, 0);
  var fd = _b.b;
  var revfd = _b.r;
  var rev = new u16(32768);
  for (i = 0; i < 32768; ++i) {
    x = (i & 43690) >> 1 | (i & 21845) << 1;
    x = (x & 52428) >> 2 | (x & 13107) << 2;
    x = (x & 61680) >> 4 | (x & 3855) << 4;
    rev[i] = ((x & 65280) >> 8 | (x & 255) << 8) >> 1;
  }
  var x;
  var i;
  var hMap = function(cd, mb, r) {
    var s = cd.length;
    var i = 0;
    var l = new u16(mb);
    for (; i < s; ++i) {
      if (cd[i])
        ++l[cd[i] - 1];
    }
    var le = new u16(mb);
    for (i = 1; i < mb; ++i) {
      le[i] = le[i - 1] + l[i - 1] << 1;
    }
    var co;
    if (r) {
      co = new u16(1 << mb);
      var rvb = 15 - mb;
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          var sv = i << 4 | cd[i];
          var r_1 = mb - cd[i];
          var v = le[cd[i] - 1]++ << r_1;
          for (var m = v | (1 << r_1) - 1; v <= m; ++v) {
            co[rev[v] >> rvb] = sv;
          }
        }
      }
    } else {
      co = new u16(s);
      for (i = 0; i < s; ++i) {
        if (cd[i]) {
          co[i] = rev[le[cd[i] - 1]++] >> 15 - cd[i];
        }
      }
    }
    return co;
  };
  var flt = new u8(288);
  for (i = 0; i < 144; ++i)
    flt[i] = 8;
  var i;
  for (i = 144; i < 256; ++i)
    flt[i] = 9;
  var i;
  for (i = 256; i < 280; ++i)
    flt[i] = 7;
  var i;
  for (i = 280; i < 288; ++i)
    flt[i] = 8;
  var i;
  var fdt = new u8(32);
  for (i = 0; i < 32; ++i)
    fdt[i] = 5;
  var i;
  var flrm = /* @__PURE__ */ hMap(flt, 9, 1);
  var fdrm = /* @__PURE__ */ hMap(fdt, 5, 1);
  var max = function(a) {
    var m = a[0];
    for (var i = 1; i < a.length; ++i) {
      if (a[i] > m)
        m = a[i];
    }
    return m;
  };
  var bits = function(d, p, m) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8) >> (p & 7) & m;
  };
  var bits16 = function(d, p) {
    var o = p / 8 | 0;
    return (d[o] | d[o + 1] << 8 | d[o + 2] << 16) >> (p & 7);
  };
  var shft = function(p) {
    return (p + 7) / 8 | 0;
  };
  var slc = function(v, s, e) {
    if (s == null || s < 0)
      s = 0;
    if (e == null || e > v.length)
      e = v.length;
    return new u8(v.subarray(s, e));
  };
  var ec = [
    "unexpected EOF",
    "invalid block type",
    "invalid length/literal",
    "invalid distance",
    "stream finished",
    "no stream handler",
    ,
    "no callback",
    "invalid UTF-8 data",
    "extra field too long",
    "date not in range 1980-2099",
    "filename too long",
    "stream finishing",
    "invalid zip data"
    // determined by unknown compression method
  ];
  var err = function(ind, msg, nt) {
    var e = new Error(msg || ec[ind]);
    e.code = ind;
    if (Error.captureStackTrace)
      Error.captureStackTrace(e, err);
    if (!nt)
      throw e;
    return e;
  };
  var inflt = function(dat, st, buf, dict) {
    var sl = dat.length, dl = dict ? dict.length : 0;
    if (!sl || st.f && !st.l)
      return buf || new u8(0);
    var noBuf = !buf;
    var resize = noBuf || st.i != 2;
    var noSt = st.i;
    if (noBuf)
      buf = new u8(sl * 3);
    var cbuf = function(l2) {
      var bl = buf.length;
      if (l2 > bl) {
        var nbuf = new u8(Math.max(bl * 2, l2));
        nbuf.set(buf);
        buf = nbuf;
      }
    };
    var final = st.f || 0, pos = st.p || 0, bt = st.b || 0, lm = st.l, dm = st.d, lbt = st.m, dbt = st.n;
    var tbts = sl * 8;
    do {
      if (!lm) {
        final = bits(dat, pos, 1);
        var type = bits(dat, pos + 1, 3);
        pos += 3;
        if (!type) {
          var s = shft(pos) + 4, l = dat[s - 4] | dat[s - 3] << 8, t = s + l;
          if (t > sl) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + l);
          buf.set(dat.subarray(s, t), bt);
          st.b = bt += l, st.p = pos = t * 8, st.f = final;
          continue;
        } else if (type == 1)
          lm = flrm, dm = fdrm, lbt = 9, dbt = 5;
        else if (type == 2) {
          var hLit = bits(dat, pos, 31) + 257, hcLen = bits(dat, pos + 10, 15) + 4;
          var tl = hLit + bits(dat, pos + 5, 31) + 1;
          pos += 14;
          var ldt = new u8(tl);
          var clt = new u8(19);
          for (var i = 0; i < hcLen; ++i) {
            clt[clim[i]] = bits(dat, pos + i * 3, 7);
          }
          pos += hcLen * 3;
          var clb = max(clt), clbmsk = (1 << clb) - 1;
          var clm = hMap(clt, clb, 1);
          for (var i = 0; i < tl; ) {
            var r = clm[bits(dat, pos, clbmsk)];
            pos += r & 15;
            var s = r >> 4;
            if (s < 16) {
              ldt[i++] = s;
            } else {
              var c = 0, n = 0;
              if (s == 16)
                n = 3 + bits(dat, pos, 3), pos += 2, c = ldt[i - 1];
              else if (s == 17)
                n = 3 + bits(dat, pos, 7), pos += 3;
              else if (s == 18)
                n = 11 + bits(dat, pos, 127), pos += 7;
              while (n--)
                ldt[i++] = c;
            }
          }
          var lt = ldt.subarray(0, hLit), dt = ldt.subarray(hLit);
          lbt = max(lt);
          dbt = max(dt);
          lm = hMap(lt, lbt, 1);
          dm = hMap(dt, dbt, 1);
        } else
          err(1);
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
      }
      if (resize)
        cbuf(bt + 131072);
      var lms = (1 << lbt) - 1, dms = (1 << dbt) - 1;
      var lpos = pos;
      for (; ; lpos = pos) {
        var c = lm[bits16(dat, pos) & lms], sym = c >> 4;
        pos += c & 15;
        if (pos > tbts) {
          if (noSt)
            err(0);
          break;
        }
        if (!c)
          err(2);
        if (sym < 256)
          buf[bt++] = sym;
        else if (sym == 256) {
          lpos = pos, lm = null;
          break;
        } else {
          var add = sym - 254;
          if (sym > 264) {
            var i = sym - 257, b = fleb[i];
            add = bits(dat, pos, (1 << b) - 1) + fl[i];
            pos += b;
          }
          var d = dm[bits16(dat, pos) & dms], dsym = d >> 4;
          if (!d)
            err(3);
          pos += d & 15;
          var dt = fd[dsym];
          if (dsym > 3) {
            var b = fdeb[dsym];
            dt += bits16(dat, pos) & (1 << b) - 1, pos += b;
          }
          if (pos > tbts) {
            if (noSt)
              err(0);
            break;
          }
          if (resize)
            cbuf(bt + 131072);
          var end = bt + add;
          if (bt < dt) {
            var shift = dl - dt, dend = Math.min(dt, end);
            if (shift + bt < 0)
              err(3);
            for (; bt < dend; ++bt)
              buf[bt] = dict[shift + bt];
          }
          for (; bt < end; ++bt)
            buf[bt] = buf[bt - dt];
        }
      }
      st.l = lm, st.p = lpos, st.b = bt, st.f = final;
      if (lm)
        final = 1, st.m = lbt, st.d = dm, st.n = dbt;
    } while (!final);
    return bt != buf.length && noBuf ? slc(buf, 0, bt) : buf.subarray(0, bt);
  };
  var et = /* @__PURE__ */ new u8(0);
  var gzs = function(d) {
    if (d[0] != 31 || d[1] != 139 || d[2] != 8)
      err(6, "invalid gzip data");
    var flg = d[3];
    var st = 10;
    if (flg & 4)
      st += (d[10] | d[11] << 8) + 2;
    for (var zs = (flg >> 3 & 1) + (flg >> 4 & 1); zs > 0; zs -= !d[st++])
      ;
    return st + (flg & 2);
  };
  var gzl = function(d) {
    var l = d.length;
    return (d[l - 4] | d[l - 3] << 8 | d[l - 2] << 16 | d[l - 1] << 24) >>> 0;
  };
  function gunzipSync(data, opts) {
    var st = gzs(data);
    if (st + 8 > data.length)
      err(6, "invalid gzip data");
    return inflt(data.subarray(st, -8), { i: 2 }, opts && opts.out || new u8(gzl(data)), opts && opts.dictionary);
  }
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }

  // src/player-standalone.ts
  var globalScope3 = typeof window !== "undefined" ? window : global;
  globalScope3.ExpressionParser = ExpressionParser;
  globalScope3.GameRuntime = GameRuntime;
  function decompressProject(data) {
    try {
      const binary = atob(data);
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const decompressed = gunzipSync(bytes);
      const json = new TextDecoder().decode(decompressed);
      return JSON.parse(json);
    } catch (e) {
      console.error("[UniversalPlayer] Failed to decompress project:", e);
      return null;
    }
  }
  var UniversalPlayer = class {
    constructor() {
      __publicField(this, "runtime", null);
      __publicField(this, "stage");
      __publicField(this, "techClasses", ["TGameLoop", "TInputController", "TGameState", "TTimer", "TRemoteGameManager", "TGameServer", "THandshake", "THeartbeat", "TStageController"]);
      __publicField(this, "currentProject", null);
      __publicField(this, "isStarted", false);
      __publicField(this, "animationTickerId", null);
      // Drag & Drop State
      __publicField(this, "dragTarget", null);
      __publicField(this, "dragPhantom", null);
      __publicField(this, "isDragging", false);
      __publicField(this, "dragOffset", { x: 0, y: 0 });
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
      window.addEventListener("mousedown", (e) => this.handleMouseDown(e));
      window.addEventListener("mousemove", (e) => this.handleMouseMove(e));
      window.addEventListener("mouseup", (e) => this.handleMouseUp(e));
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
      } else if (window.PROJECT_DATA) {
        console.log("[UniversalPlayer] Loading compressed embedded project");
        const project = decompressProject(window.PROJECT_DATA);
        if (project) {
          this.startProject(project);
        } else {
          console.error("[UniversalPlayer] Failed to decompress project data");
        }
      } else if (window.PROJECT) {
        console.log("[UniversalPlayer] Loading embedded project");
        this.startProject(window.PROJECT);
      } else {
        console.log("[UniversalPlayer] No game selected, loading platform UI...");
        const baseUrl = network.getHttpUrl();
        await this.loadProjectFromUrl(`${baseUrl}/platform/project.json`);
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
          const data = await resp.json();
          let project = data;
          if (data._compressed === true && data.data) {
            console.log("[UniversalPlayer] Decompressing project from URL");
            project = decompressProject(data.data);
            if (!project) {
              console.error("[UniversalPlayer] Failed to decompress project");
              return;
            }
          }
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
        onNavigate: (target) => this.handleNavigation(target),
        onStageSwitch: (stageId) => {
          console.log(`[UniversalPlayer] Stage switched to: ${stageId}`);
          this.setupScaling();
          this.render();
        }
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
      const activeStage = this.runtime ? this.runtime.stage : this.currentProject.stage || this.currentProject.stages?.[0];
      if (!activeStage || !activeStage.grid) {
        console.warn("[UniversalPlayer] No active stage or grid found for scaling");
        return;
      }
      const grid = activeStage.grid;
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
      const bgImg = activeStage.backgroundImage;
      if (bgImg) {
        const url = bgImg.startsWith("http") || bgImg.startsWith("/") || bgImg.startsWith("data:") ? bgImg : `./images/${bgImg}`;
        this.stage.style.background = `url("${url}") center center / ${activeStage.objectFit || "cover"} no-repeat, ${bg}`;
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
      const activeStage = this.runtime.stage || (this.currentProject.stage || this.currentProject.stages?.[0]);
      const grid = activeStage?.grid;
      if (!grid) return;
      const cellSize = grid.cellSize;
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
        case "TVideo":
        case "TSplashScreen": {
          const videoSrc = obj.videoSource || "";
          if (!videoSrc) {
            el.innerHTML = '<div style="color: #444; font-size: 10px; text-align: center;">No Video Source</div>';
            break;
          }
          let video = el.querySelector("video");
          if (!video) {
            el.innerHTML = "";
            video = document.createElement("video");
            video.style.width = "100%";
            video.style.height = "100%";
            video.playsInline = true;
            el.appendChild(video);
          }
          const fullSrc = videoSrc.startsWith("http") || videoSrc.startsWith("/") || videoSrc.startsWith("data:") ? videoSrc : `./images/${videoSrc}`;
          if (video.src !== new URL(fullSrc, window.location.href).href) {
            video.src = fullSrc;
            if (obj.autoplay) video.play().catch(() => {
            });
          }
          video.style.objectFit = obj.objectFit || "contain";
          video.style.opacity = String(obj.imageOpacity ?? 1);
          video.loop = !!obj.loop;
          video.muted = !!obj.muted;
          if (obj.playbackRate) video.playbackRate = obj.playbackRate;
          if (obj.isPlaying && video.paused) {
            video.play().catch((e) => console.warn("[Player] Video play failed:", e));
          } else if (!obj.isPlaying && !video.paused) {
            video.pause();
          }
          break;
        }
        case "TGameCard": {
          el.innerHTML = "";
          el.style.flexDirection = "column";
          el.style.padding = "15px";
          el.style.gap = "10px";
          el.style.borderRadius = "12px";
          el.style.background = "rgba(255, 255, 255, 0.05)";
          el.style.border = "1px solid rgba(255, 255, 255, 0.1)";
          el.style.backdropFilter = "blur(10px)";
          const hostRow = document.createElement("div");
          hostRow.style.display = "flex";
          hostRow.style.alignItems = "center";
          hostRow.style.gap = "10px";
          hostRow.style.width = "100%";
          const avatar = document.createElement("div");
          avatar.style.width = "40px";
          avatar.style.height = "40px";
          avatar.style.borderRadius = "50%";
          avatar.style.background = "#4fc3f7";
          avatar.style.display = "flex";
          avatar.style.alignItems = "center";
          avatar.style.justifyContent = "center";
          avatar.style.fontSize = "20px";
          avatar.innerText = obj.hostAvatar || "\u{1F464}";
          hostRow.appendChild(avatar);
          const nameAndGame = document.createElement("div");
          nameAndGame.style.flex = "1";
          const hostNameEl = document.createElement("div");
          hostNameEl.style.fontSize = "14px";
          hostNameEl.style.color = "#94a3b8";
          hostNameEl.innerText = obj.hostName || "Anonym";
          nameAndGame.appendChild(hostNameEl);
          const gameTitleEl = document.createElement("div");
          gameTitleEl.style.fontSize = "18px";
          gameTitleEl.style.fontWeight = "bold";
          gameTitleEl.innerText = obj.gameName || "Unbekanntes Spiel";
          nameAndGame.appendChild(gameTitleEl);
          hostRow.appendChild(nameAndGame);
          el.appendChild(hostRow);
          const joinBtn = document.createElement("div");
          joinBtn.style.width = "100%";
          joinBtn.style.padding = "8px";
          joinBtn.style.textAlign = "center";
          joinBtn.style.background = "#10b981";
          joinBtn.style.color = "white";
          joinBtn.style.borderRadius = "6px";
          joinBtn.style.cursor = "pointer";
          joinBtn.style.fontWeight = "bold";
          joinBtn.innerText = "Beitreten";
          joinBtn.onclick = () => {
            if (obj.roomCode) {
              this.handleNavigation(`room:${obj.roomCode}`);
            }
          };
          el.appendChild(joinBtn);
          break;
        }
        case "TShape": {
          el.innerHTML = "";
          el.style.backgroundColor = obj.fillColor || "transparent";
          el.style.border = `${obj.strokeWidth || 0}px solid ${obj.strokeColor || "transparent"}`;
          el.style.opacity = String(obj.opacity ?? 1);
          if (obj.shapeType === "circle") {
            el.style.borderRadius = "50%";
          } else if (obj.shapeType === "rect" || obj.shapeType === "square") {
            el.style.borderRadius = "0";
          } else if (obj.shapeType === "ellipse") {
            el.style.borderRadius = "50% / 50%";
          } else if (obj.shapeType === "triangle") {
            el.style.backgroundColor = "transparent";
            el.style.border = "none";
            el.style.clipPath = "polygon(50% 0%, 0% 100%, 100% 100%)";
            el.style.background = obj.fillColor || "white";
          } else if (obj.shapeType === "arrow") {
            el.style.backgroundColor = "transparent";
            el.style.border = "none";
            el.style.clipPath = "polygon(0% 20%, 60% 20%, 60% 0%, 100% 50%, 60% 100%, 60% 80%, 0% 80%)";
            el.style.background = obj.fillColor || "white";
          }
          break;
        }
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
    // ─────────────────────────────────────────────
    // Drag & Drop Handling
    // ─────────────────────────────────────────────
    handleMouseDown(e) {
      if (!this.runtime) return;
      const el = e.target.closest(".game-object");
      if (!el) return;
      const obj = this.runtime.getObjects().find((o) => o.id === el.id);
      if (!obj || !obj.draggable) return;
      console.log(`[Player] Start dragging: ${obj.name} (mode: ${obj.dragMode})`);
      this.isDragging = true;
      const gridCoords = this.screenToGrid(e.clientX, e.clientY);
      this.dragOffset = {
        x: gridCoords.x - obj.x,
        y: gridCoords.y - obj.y
      };
      if (obj.dragMode === "copy") {
        this.dragPhantom = this.runtime.createPhantom(obj);
        this.dragTarget = this.dragPhantom;
      } else {
        this.dragTarget = obj;
      }
      this.runtime.handleEvent(obj.id, "onDragStart", { x: gridCoords.x, y: gridCoords.y });
    }
    handleMouseMove(e) {
      if (!this.isDragging || !this.dragTarget || !this.runtime) return;
      const coords = this.screenToGrid(e.clientX, e.clientY);
      this.dragTarget.x = coords.x - this.dragOffset.x;
      this.dragTarget.y = coords.y - this.dragOffset.y;
      this.render();
    }
    handleMouseUp(e) {
      if (!this.isDragging || !this.runtime) return;
      const originalTarget = this.dragPhantom ? this.dragTarget._original : this.dragTarget;
      const elementsAtPoint = document.elementsFromPoint(e.clientX, e.clientY);
      let dropTargetObj = null;
      for (const el of elementsAtPoint) {
        const gameObjEl = el.closest(".game-object");
        if (gameObjEl && gameObjEl.id !== this.dragTarget.id) {
          const found = this.runtime.getObjects().find((o) => o.id === gameObjEl.id);
          if (found && found.droppable) {
            dropTargetObj = found;
            break;
          }
        }
      }
      if (dropTargetObj) {
        console.log(`[Player] Dropped ${originalTarget.name} on ${dropTargetObj.name}`);
        this.runtime.handleEvent(dropTargetObj.id, "onDrop", {
          draggedId: originalTarget.id,
          draggedName: originalTarget.name,
          draggedObj: originalTarget
        });
      }
      if (this.dragPhantom) {
        this.runtime.removeObject(this.dragPhantom.id);
      }
      this.isDragging = false;
      this.dragTarget = null;
      this.dragPhantom = null;
      this.render();
    }
    screenToGrid(clientX, clientY) {
      const rect = this.stage.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      const style = window.getComputedStyle(this.stage);
      const matrix = new DOMMatrix(style.transform);
      const scale = matrix.a;
      const activeStage = this.runtime?.stage || (this.currentProject?.stage || this.currentProject?.stages?.[0]);
      const cellSize = activeStage?.grid?.cellSize || 32;
      return {
        x: relativeX / scale / cellSize,
        y: relativeY / scale / cellSize
      };
    }
  };
  if (typeof document !== "undefined") {
    document.addEventListener("DOMContentLoaded", () => {
      window.player = new UniversalPlayer();
    });
  }
  window.startStandalone = (project) => {
    console.log("[UniversalPlayer] Standalone trigger received");
    const player = window.player;
    if (project === null && window.PROJECT_DATA) {
      console.log("[UniversalPlayer] Decompressing PROJECT_DATA");
      project = decompressProject(window.PROJECT_DATA);
    }
    if (player && typeof player.startProject === "function" && project) {
      player.startProject(project);
    } else if (project) {
      window.PROJECT = project;
    } else {
      console.error("[UniversalPlayer] No project data available");
    }
  };
})();
