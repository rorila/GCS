"use strict";
(() => {
  var __create = Object.create;
  var __defProp = Object.defineProperty;
  var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __getProtoOf = Object.getPrototypeOf;
  var __hasOwnProp = Object.prototype.hasOwnProperty;
  var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
  var __require = /* @__PURE__ */ ((x) => typeof require !== "undefined" ? require : typeof Proxy !== "undefined" ? new Proxy(x, {
    get: (a, b) => (typeof require !== "undefined" ? require : a)[b]
  }) : x)(function(x) {
    if (typeof require !== "undefined") return require.apply(this, arguments);
    throw Error('Dynamic require of "' + x + '" is not supported');
  });
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
  var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
    // If the importer is in node compatibility mode or this is not an ESM
    // file that has been converted to a CommonJS file using a Babel-
    // compatible transform (i.e. "__esModule" has not been set), then set
    // "default" to the CommonJS "module.exports" for node compatibility.
    isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
    mod
  ));
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

  // src/config.ts
  var import_meta = {};
  var env = import_meta.env || {};
  var Config = {
    APP_TITLE: env.VITE_APP_TITLE || "GCS Game Builder",
    // Globales Log-Level
    LOG_LEVEL: parseLogLevel(env.VITE_LOG_LEVEL),
    // Spezifische Log-Level für einzelne Präfixe/Klassen
    // Beispiel in .env: VITE_LOG_LEVEL_StageRenderer=DEBUG
    PREFIX_LOG_LEVELS: parsePrefixLogLevels(env)
  };
  function parseLogLevel(val) {
    if (!val) return 0 /* DEBUG */;
    switch (val.toUpperCase()) {
      case "DEBUG":
        return 0 /* DEBUG */;
      case "INFO":
        return 1 /* INFO */;
      case "WARN":
        return 2 /* WARN */;
      case "ERROR":
        return 3 /* ERROR */;
      case "NONE":
        return 4 /* NONE */;
      default:
        return 0 /* DEBUG */;
    }
  }
  function parsePrefixLogLevels(env2) {
    const levels = {};
    const prefix = "VITE_LOG_LEVEL_";
    for (const key in env2) {
      if (key.startsWith(prefix)) {
        const moduleName = key.substring(prefix.length);
        if (moduleName && moduleName !== "LEVEL") {
          levels[moduleName] = parseLogLevel(env2[key]);
        }
      }
    }
    return levels;
  }

  // src/utils/Logger.ts
  var _Logger = class _Logger {
    constructor(prefix = "", useCase, level) {
      __publicField(this, "prefix");
      __publicField(this, "level");
      __publicField(this, "useCase");
      this.prefix = prefix ? `[${prefix}] ` : "";
      this.useCase = useCase;
      if (level !== void 0) {
        this.level = level;
      } else if (prefix && Config.PREFIX_LOG_LEVELS[prefix] !== void 0) {
        this.level = Config.PREFIX_LOG_LEVELS[prefix];
      } else {
        this.level = _Logger.globalLevel;
      }
    }
    /**
     * Sets the global log level.
     */
    static setGlobalLevel(level) {
      this.globalLevel = level;
    }
    /**
     * Sets the log handler callback.
     */
    static setLogHandler(handler) {
      this.logHandler = handler;
    }
    /**
     * Sets the filter function for UseCases.
     */
    static setUseCaseFilter(filter) {
      this.useCaseFilter = filter;
    }
    /**
     * Sets the provider function for UseCase labels.
     */
    static setUseCaseLabelProvider(provider) {
      this.useCaseLabelProvider = provider;
    }
    /**
     * Creates a new logger instance with a prefix and optional useCase.
     */
    static get(prefix, useCase) {
      return new _Logger(prefix, useCase);
    }
    debug(...args) {
      this.log(0 /* DEBUG */, ...args);
    }
    info(...args) {
      this.log(1 /* INFO */, ...args);
    }
    warn(...args) {
      this.log(2 /* WARN */, ...args);
    }
    error(...args) {
      this.log(3 /* ERROR */, ...args);
    }
    log(level, ...args) {
      if (level < this.level || level < _Logger.globalLevel) return;
      if (level < 3 /* ERROR */ && this.useCase && !_Logger.useCaseFilter(this.useCase)) {
        return;
      }
      if (this.useCase && level < 3 /* ERROR */ && this.useCase !== _Logger.lastUseCaseId) {
        const label = _Logger.useCaseLabelProvider(this.useCase);
        console.log(
          `%c
--- UseCase: '${label}' ---`,
          "color: #673ab7; font-weight: bold; border-top: 1px solid #ddd; padding-top: 8px; margin-top: 8px;"
        );
        _Logger.lastUseCaseId = this.useCase;
      }
      const timestamp = (/* @__PURE__ */ new Date()).toISOString().split("T")[1].split("Z")[0];
      const prefix = `${timestamp} ${this.prefix}`;
      if (_Logger.logHandler) {
        _Logger.logHandler(level, this.prefix, args.map((a) => typeof a === "object" ? JSON.stringify(a) : String(a)).join(" "), this.useCase);
      }
      switch (level) {
        case 0 /* DEBUG */:
          console.debug(prefix, ...args);
          break;
        case 1 /* INFO */:
          console.info(prefix, ...args);
          break;
        case 2 /* WARN */:
          console.warn(prefix, ...args);
          break;
        case 3 /* ERROR */:
          console.error(prefix, ...args);
          break;
      }
    }
  };
  __publicField(_Logger, "logHandler");
  __publicField(_Logger, "globalLevel", Config.LOG_LEVEL);
  __publicField(_Logger, "useCaseFilter", () => false);
  __publicField(_Logger, "useCaseLabelProvider", (id) => id);
  __publicField(_Logger, "lastUseCaseId");
  var Logger = _Logger;

  // src/runtime/PropertyHelper.ts
  var logger = Logger.get("PropertyHelper", "Variable_Handling");
  var PropertyHelper = class _PropertyHelper {
    /**
     * Reads a property value using a dot-path (e.g., "style.backgroundColor")
     */
    static getPropertyValue(obj, propPath) {
      if (!obj || !propPath) return void 0;
      const parts = propPath.split(".");
      let current = obj;
      for (const part of parts) {
        if (current === void 0 || current === null) return void 0;
        let target = current;
        if (current.isVariable === true || current.className && current.className.includes("Variable")) {
          target = this.resolveValue(current);
        }
        if (Array.isArray(target) && target.length === 1 && target[part] === void 0 && part !== "length") {
          target = target[0];
        }
        const hasInContent = target !== null && typeof target === "object" && part in target || target !== void 0 && target !== null && target[part] !== void 0;
        if (hasInContent) {
          current = target[part];
        } else if (current && current.isFlowNode === true && current.data && current.data[part] !== void 0) {
          current = current.data[part];
        } else if (target && target.isFlowNode === true && target.data && target.data[part] !== void 0) {
          current = target.data[part];
        } else if (current !== target && (current[part] !== void 0 || Object.getOwnPropertyDescriptor(Object.getPrototypeOf(current), part)?.get !== void 0)) {
          current = current[part];
        } else if (target === current) {
          current = current[part];
        } else {
          current = void 0;
        }
        if (propPath.includes("LeftOperand") || propPath.includes("BaseVar")) {
          logger.info(`getPropertyValue("${propPath}") member "${part}":`, {
            targetType: target.constructor?.name || typeof target,
            hasInContent,
            result: typeof current === "string" ? `"${current}"` : current === void 0 ? "undefined" : "object/val"
          });
        }
        if (current === void 0 || current === null) return void 0;
      }
      return this.resolveValue(current);
    }
    /**
     * Resolves a value from an object, unpacking variable components if necessary.
     */
    static resolveValue(val) {
      if (val && typeof val === "object" && (val.isVariable === true || val.className?.includes("Variable"))) {
        if (Array.isArray(val.data)) return val.data;
        if (Array.isArray(val.items)) return val.items;
        if (val.value !== void 0) return val.value;
      }
      return val;
    }
    /**
     * Sets a property value using a dot-path
     */
    static setPropertyValue(obj, propPath, value) {
      if (!obj || !propPath) return;
      const parts = propPath.split(".");
      if (parts.length === 1) {
        const part = parts[0];
        if (obj.isFlowNode === true && obj.data && !(part in obj) && Object.getOwnPropertyDescriptor(Object.getPrototypeOf(obj), part)?.set === void 0) {
          obj.data[part] = value;
        } else {
          obj[part] = value;
        }
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
        logger.info(`Starting interpolation for path: "${trimmedPath}"`);
        if (trimmedPath === "true") return "true";
        if (trimmedPath === "false") return "false";
        if (!isNaN(Number(trimmedPath))) return trimmedPath;
        if (objects) {
          if (trimmedPath.includes(".")) {
            const [objName, ...propParts] = trimmedPath.split(".");
            const propPath = propParts.join(".");
            const obj = objects.find((o) => o.name === objName || o.id === objName);
            if (obj) {
              const val2 = this.getPropertyValue(obj, propPath);
              logger.info(`Interpolate "${trimmedPath}" matched Object "${objName}". Prop: "${propPath}", Value: "${val2}"`);
              if (val2 !== void 0) return String(val2);
            }
          } else {
            const obj = objects.find((o) => o.name === trimmedPath || o.id === trimmedPath);
            if (obj) {
              const resolved = this.resolveValue(obj);
              logger.info(`Interpolate "${trimmedPath}" found Object. ID: ${obj.id}, Name: ${obj.name}, Value: "${resolved}"`);
              if (resolved !== obj) return String(resolved ?? "");
              return obj.name || obj.id || String(obj);
            }
          }
        }
        let val = vars[trimmedPath];
        if (val === void 0 && trimmedPath.includes(".")) {
          const [rootVar, ...parts] = trimmedPath.split(".");
          if (vars[rootVar] !== void 0) {
            val = _PropertyHelper.getPropertyValue(vars[rootVar], parts.join("."));
          }
        }
        if (val !== void 0) {
          const resolvedVal = this.resolveValue(val);
          logger.info(`Interpolate "${trimmedPath}" found in vars. Value: "${resolvedVal}"`);
          return String(resolvedVal);
        }
        logger.warn(`Interpolation failed for path: "${trimmedPath}". Variable not found.`);
        return "";
      });
    }
    /**
     * Tries to convert a string value back to its likely intended type (number or boolean)
     */
    static autoConvert(value) {
      if (typeof value !== "string") return value;
      if (value === "") return value;
      const trimmed = value.trim();
      if (trimmed.startsWith("[") && trimmed.endsWith("]") || trimmed.startsWith("{") && trimmed.endsWith("}")) {
        try {
          return JSON.parse(trimmed);
        } catch (e) {
        }
      }
      const num = Number(value);
      if (!isNaN(num) && value.trim() !== "") {
        return num;
      }
      if (value.toLowerCase() === "true") return true;
      if (value.toLowerCase() === "false") return false;
      return value;
    }
  };

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
      if (typeof text !== "string" || !text.includes("${")) {
        return text;
      }
      let result = "";
      let i = 0;
      while (i < text.length) {
        if (text[i] === "$" && text[i + 1] === "{") {
          let braceDepth = 1;
          let start = i + 2;
          let j = start;
          while (j < text.length && braceDepth > 0) {
            if (text[j] === "$" && text[j + 1] === "{") {
              braceDepth++;
              j++;
            } else if (text[j] === "}") {
              braceDepth--;
            }
            j++;
          }
          if (braceDepth === 0) {
            const expression = text.substring(start, j - 1);
            try {
              const interpolatedExpr = this.interpolate(expression, context);
              const evaluated = this.evaluate(interpolatedExpr.trim(), context);
              if (i === 0 && j === text.length) {
                if (evaluated === void 0 && (interpolatedExpr.includes("${") || expression.includes("${"))) {
                  return text;
                }
                return evaluated;
              }
              if (evaluated === void 0 && (interpolatedExpr.includes("${") || expression.includes("${"))) {
                result += `\${${interpolatedExpr}}`;
              } else {
                result += this.valueToString(evaluated);
              }
            } catch (error) {
              console.error(`[ExpressionParser] Error evaluating expression "${expression}":`, error);
              result += `\${${expression}}`;
            }
            i = j;
            continue;
          }
        }
        result += text[i];
        i++;
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
      const resolved = PropertyHelper.resolveValue(value);
      if (resolved !== value) return this.valueToString(resolved);
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
        const deps = this.extractDependencies(expression);
        const contextKeys = deps.filter((key) => {
          if (!validIdentifierRegex.test(key)) return false;
          return key in context || !expression.includes(`.${key}`);
        });
        const contextValues = contextKeys.map((key) => {
          const val = context[key];
          try {
            const resolved = PropertyHelper.resolveValue(val);
            return resolved;
          } catch (e) {
            return void 0;
          }
        });
        const func = new Function(...contextKeys, `return ${expression}`);
        const result = func(...contextValues);
        if (result === void 0 || result !== result && typeof result === "number") {
          console.log(`%c[ExpressionParser] Suspicious result for "${expression}":`, "color: #ff9800", {
            result,
            contextKeys,
            contextValues: contextValues.map((v) => typeof v === "object" ? v?.name || v?.className || "Object" : v)
          });
        }
        return result;
      } catch (error) {
        const msg = error?.message || "";
        const name = error?.name || "";
        if (name === "ReferenceError" || error instanceof ReferenceError) {
          console.warn(`%c[ExpressionParser] ReferenceError in "${expression}": ${msg}`, "color: #f44336; font-weight: bold");
          const deps = this.extractDependencies(expression);
          console.log(`[ExpressionParser] Available context keys:`, deps.filter((k) => k in context));
          return void 0;
        }
        if ((name === "TypeError" || error instanceof TypeError) && (msg.includes("undefined") || msg.includes("null"))) {
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
      return PropertyHelper.getPropertyValue(context, path);
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
      const regex = /(\.)?([a-zA-Z_$][a-zA-Z0-9_$]*)/g;
      const deps = /* @__PURE__ */ new Set();
      let match;
      while ((match = regex.exec(expression)) !== null) {
        const dot = match[1];
        const name = match[2];
        if (!dot) {
          deps.add(name);
        }
      }
      const keywords = /* @__PURE__ */ new Set(["true", "false", "null", "undefined", "typeof", "instanceof", "new", "return", "if", "else", "for", "while"]);
      return Array.from(deps).filter((m) => !keywords.has(m));
    }
    /**
     * Evaluates an expression and returns the raw value (preserving type)
     */
    static evaluateRaw(expression, context) {
      if (expression.startsWith("${") && expression.endsWith("}")) {
        expression = expression.slice(2, -1).trim();
      }
      const result = this.evaluate(expression, context);
      if (expression.includes("BaseVar") || expression.includes("availableVariableFields")) {
        console.log(`[ExpressionParser] evaluateRaw("${expression}") ->`, result);
      }
      return result;
    }
  };

  // src/services/DebugLogService.ts
  var _DebugLogService = class _DebugLogService {
    constructor() {
      __publicField(this, "logs", []);
      __publicField(this, "listeners", []);
      __publicField(this, "maxLogs", 1e3);
      __publicField(this, "counter", 0);
      __publicField(this, "contextStack", []);
      __publicField(this, "enabled", false);
      __publicField(this, "isNotifying", false);
      Logger.setLogHandler((level, prefix, message, useCase) => {
        this.log("System", `${prefix}${message}`, {
          level: String(level),
          category: useCase
        });
      });
    }
    pushContext(id) {
      if (id) this.contextStack.push(id);
    }
    popContext() {
      this.contextStack.pop();
    }
    setEnabled(enabled) {
      _DebugLogService.logger.info(`setEnabled(${enabled})`);
      this.enabled = enabled;
    }
    isEnabled() {
      return this.enabled;
    }
    static getInstance() {
      const globalScope4 = typeof window !== "undefined" ? window : global;
      if (!globalScope4._globalDebugLogService) {
        globalScope4._globalDebugLogService = new _DebugLogService();
      }
      return globalScope4._globalDebugLogService;
    }
    log(type, message, options = {}) {
      if (!this.enabled || this.isNotifying) return "";
      if (options.level) {
        const level = options.level;
        const numericLevel = typeof level === "number" ? level : 0;
        if (level === "DEBUG" || numericLevel === 0) return "";
      }
      const parentId = options.flatten ? void 0 : options.parentId || (this.contextStack.length > 0 ? this.contextStack[this.contextStack.length - 1] : void 0);
      const id = `log-${Date.now()}-${this.counter++}`;
      const entry = {
        id,
        type,
        message,
        timestamp: Date.now(),
        parentId,
        children: [],
        isExpanded: true,
        data: options.data,
        objectName: options.objectName,
        eventName: options.eventName
      };
      if (parentId) {
        const parent = this.findEntry(this.logs, parentId);
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
  __publicField(_DebugLogService, "logger", Logger.get("DebugLogService", "Editor_Diagnostics"));
  var DebugLogService = _DebugLogService;
  var globalScope = typeof window !== "undefined" ? window : global;
  var debugLogService = globalScope._globalDebugLogService || DebugLogService.getInstance();
  globalScope._globalDebugLogService = debugLogService;

  // src/runtime/PropertyWatcher.ts
  var _PropertyWatcher = class _PropertyWatcher {
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
        _PropertyWatcher.logger.warn(`Cannot watch non-object: ${target}`);
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
      const INTERNAL_PROPERTIES = /* @__PURE__ */ new Set(["eventCallback", "onEvent", "events", "Tasks", "id", "className"]);
      if (DebugLogService.getInstance().isEnabled()) {
        if (INTERNAL_PROPERTIES.has(propertyPath)) return;
        const displayNew = typeof newValue === "object" ? JSON.stringify(newValue)?.substring(0, 50) : newValue;
        const displayOld = typeof oldValue === "object" ? JSON.stringify(oldValue)?.substring(0, 50) : oldValue;
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
        propertyWatchers.forEach((callback) => {
          try {
            callback(newValue, oldValue);
          } catch (error) {
            _PropertyWatcher.logger.error("Callback error:", error);
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
          _PropertyWatcher.logger.error("Global callback error:", error);
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
      _PropertyWatcher.logger.info("Active Watchers:");
      this.watchers.forEach((objectWatchers, object) => {
        const objName = object.name || object.id || "Unknown";
        objectWatchers.forEach((callbacks, propertyPath) => {
          _PropertyWatcher.logger.info(`  ${objName}.${propertyPath}: ${callbacks.size} watchers`);
        });
      });
    }
  };
  __publicField(_PropertyWatcher, "logger", Logger.get("PropertyWatcher", "Variable_Management"));
  var PropertyWatcher = _PropertyWatcher;

  // src/runtime/ReactiveProperty.ts
  var logger2 = Logger.get("Proxy", "Variable_Management");
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
          logger2.info(`Set ${objName}.${propertyPath} = ${newValue}`);
          watcher.notify(actualRoot, propertyPath, newValue, oldValue);
        } else {
          target[property] = newValue;
        }
        return true;
      }
    });
  }

  // src/components/TComponent.ts
  var DESIGN_VALUES = Symbol("DESIGN_VALUES");
  var TComponent = class {
    constructor(name) {
      __publicField(this, "id");
      __publicField(this, "name");
      __publicField(this, "className");
      // Explicit className for production builds
      __publicField(this, "parent", null);
      __publicField(this, "children", []);
      __publicField(this, "events");
      // EventName -> TaskName
      __publicField(this, "scope", "stage");
      // Visibility scope
      __publicField(this, "isVariable", false);
      // Flag for variable-like components
      __publicField(this, "isTransient", false);
      // If true, this component is not persisted in project files
      // Visibility & Scoping Meta-Flags
      __publicField(this, "isService", false);
      // If true, component is merged globally across stages
      __publicField(this, "isHiddenInRun", false);
      // If true, component is hidden in run mode
      // Drag & Drop Properties
      __publicField(this, "draggable", false);
      __publicField(this, "dragMode", "move");
      __publicField(this, "droppable", false);
      this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.name = name;
      this.className = this.constructor.name;
      this.events = {};
    }
    getBaseProperties() {
      return [
        { name: "name", label: "Name", type: "string", group: "IDENTIT\xC4T" },
        { name: "scope", label: "Scope", type: "select", group: "IDENTIT\xC4T", options: ["global", "stage"] },
        { name: "draggable", label: "Draggable", type: "boolean", group: "INTERAKTION", editorOnly: true, inline: true },
        { name: "droppable", label: "Droppable", type: "boolean", group: "INTERAKTION", editorOnly: true, inline: true },
        { name: "dragMode", label: "Drag Mode", type: "select", group: "INTERAKTION", options: ["move", "copy"], editorOnly: true }
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
        isVariable: this.isVariable,
        isService: this.isService,
        isHiddenInRun: this.isHiddenInRun
      };
      if (this.events && Object.keys(this.events).length > 0) {
        json.events = this.events;
      }
      const props = this.getInspectorProperties();
      props.forEach((p) => {
        if (p.serializable === false) return;
        const designValues = this[DESIGN_VALUES];
        const value = designValues && designValues[p.name] !== void 0 ? designValues[p.name] : this.getPropertyValue(p.name);
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
        json.children = this.children.map((child) => {
          if (typeof child.toJSON === "function") {
            return child.toJSON();
          }
          return child;
        });
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
    /**
     * JS-Integration: Erlaubt es Komponenten, in Ausdrücken (z.B. currentPIN + '2')
     * direkt ihren Wert zu verwenden.
     */
    valueOf() {
      if (this.isVariable) {
        if (this.value !== void 0) return this.value;
        if (this.items !== void 0) return this.items;
      }
      return this;
    }
    toString() {
      const val = this.valueOf();
      if (val === this) return `[${this.className || this.constructor.name}: ${this.name}]`;
      if (Array.isArray(val)) return val.join(", ");
      return String(val ?? "");
    }
  };

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
      if (name === "currentRooms" || obj.name === "currentRooms") {
        console.log(`%c[ReactiveRuntime] Registered currentRooms:`, "color: #4caf50; font-weight: bold", {
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
          if (!targetObj[DESIGN_VALUES]) targetObj[DESIGN_VALUES] = {};
          targetObj[DESIGN_VALUES][targetProp] = expression;
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
        let objName = parts[0];
        let propPath = parts.slice(1).join(".");
        if ((objName === "global" || objName === "stage") && parts.length > 1) {
          objName = parts[1];
          propPath = parts.slice(2).join(".");
        }
        const sourceObj = this.objectsByName.get(objName) || this.variables;
        if (sourceObj) {
          const watchPath = propPath || objName;
          this.watcher.watch(sourceObj, watchPath, () => {
            binding.update();
          });
          if (!propPath) {
            if (sourceObj.isVariable === true) {
              this.watcher.watch(sourceObj, "value", () => binding.update());
              this.watcher.watch(sourceObj, "items", () => binding.update());
              this.watcher.watch(sourceObj, "data", () => binding.update());
            }
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
      const self = this;
      const context = new Proxy({}, {
        get: (_target, prop) => {
          if (prop === "global" || prop === "stage") {
            return new Proxy({}, {
              get: (_target2, subProp) => {
                const obj2 = self.objectsByName.get(subProp);
                const matchesScope = obj2 && (prop === "global" ? obj2.scope === "global" : obj2.scope === "stage");
                if (subProp === "currentRooms") {
                  console.log(`[ReactiveRuntime] Resolving ${prop}.${subProp}:`, {
                    foundObj: !!obj2,
                    objScope: obj2?.scope,
                    matchesScope,
                    variableValue: self.variables.get(subProp)
                  });
                }
                if (matchesScope) {
                  return obj2;
                }
                return self.variables.get(subProp);
              },
              has: (_target2, subProp) => {
                return self.objectsByName.has(subProp) || self.variables.has(subProp);
              },
              ownKeys: () => {
                const keys = /* @__PURE__ */ new Set([...self.objectsByName.keys(), ...self.variables.keys()]);
                return Array.from(keys);
              },
              getOwnPropertyDescriptor: (_target2, _subProp) => {
                return { enumerable: true, configurable: true };
              }
            });
          }
          const obj = self.objectsByName.get(prop);
          if (obj !== void 0) {
            if (obj.isVariable === true || obj.className?.includes("Variable")) {
              const varValue = self.variables.get(prop);
              if (varValue !== void 0) return varValue;
            }
            return obj;
          }
          const variable = self.variables.get(prop);
          if (variable !== void 0) return variable;
          return self.objectsById.get(prop);
        },
        has: (_target, prop) => {
          return prop === "global" || prop === "stage" || self.objectsByName.has(prop) || self.variables.has(prop) || self.objectsById.has(prop);
        },
        ownKeys: () => {
          const keys = /* @__PURE__ */ new Set(["global", "stage", ...self.objectsByName.keys(), ...self.variables.keys(), ...self.objectsById.keys()]);
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
     * @param clearVariables Whether to also clear the variables map (default: true)
     */
    clear(clearVariables = true) {
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

  // src/runtime/actions/StandardActions.ts
  init_AnimationManager();

  // src/services/ServiceRegistry.ts
  var _ServiceRegistryClass = class _ServiceRegistryClass {
    constructor() {
      __publicField(this, "id", Math.random().toString(36).substr(2, 9));
      __publicField(this, "services", /* @__PURE__ */ new Map());
      _ServiceRegistryClass.logger.info(`INSTANCE CREATED: ${this.id}`);
      const globalScope4 = typeof window !== "undefined" ? window : typeof global !== "undefined" ? global : {};
      globalScope4._serviceRegistryInstances = globalScope4._serviceRegistryInstances || [];
      globalScope4._serviceRegistryInstances.push(this.id);
    }
    /**
     * Register a service with the registry
     * @param name Unique name for the service (e.g., 'RemoteGameManager')
     * @param instance The service instance
     * @param description Optional description for the service
     */
    register(name, instance, description) {
      const methods = [];
      const instanceMethods = Object.getOwnPropertyNames(instance).filter((prop) => typeof instance[prop] === "function");
      for (const methodName of instanceMethods) {
        methods.push({ name: methodName });
      }
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
      _ServiceRegistryClass.logger.info(`Registered service: ${name} with methods:`, methods.map((m) => m.name));
    }
    /**
     * Unregister a service
     */
    unregister(name) {
      this.services.delete(name);
      _ServiceRegistryClass.logger.info(`Unregistered service: ${name} `);
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
      _ServiceRegistryClass.logger.debug(`Calling ${serviceName}.${methodName} (`, params, ")");
      try {
        const result = await method.apply(serviceInfo.instance, params || []);
        _ServiceRegistryClass.logger.debug(`${serviceName}.${methodName} returned: `, result);
        return result;
      } catch (error) {
        _ServiceRegistryClass.logger.error(`${serviceName}.${methodName} threw: `, error);
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
  __publicField(_ServiceRegistryClass, "logger", Logger.get("ServiceRegistry", "Editor_Diagnostics"));
  var ServiceRegistryClass = _ServiceRegistryClass;
  var globalScope2 = typeof window !== "undefined" ? window : global;
  var serviceRegistry = globalScope2._globalServiceRegistry || new ServiceRegistryClass();
  globalScope2._globalServiceRegistry = serviceRegistry;
  ServiceRegistryClass.logger.info(`Singleton bound to window. ID: ${serviceRegistry.id}`);

  // src/services/DataService.ts
  var _DataService = class _DataService {
    constructor() {
    }
    static getInstance() {
      if (!_DataService.instance) {
        _DataService.instance = new _DataService();
      }
      return _DataService.instance;
    }
    /**
     * Lädt Daten von einer URL und speichert sie im localStorage (Seeding).
     */
    async seedFromUrl(storagePath, url) {
      if (typeof window === "undefined") return;
      try {
        _DataService.logger.info(`Seeding '${storagePath}' from ${url}...`);
        const response = await fetch(url);
        if (!response.ok) {
          _DataService.logger.error(`Seeding failed: HTTP ${response.status} ${response.statusText} from ${url}`);
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        const data = await response.json();
        if (storagePath === "db.json") {
          _DataService.logger.debug(`Validating seed data. Keys: ${Object.keys(data).join(", ")}`);
        }
        await this.writeDb(storagePath, data);
        _DataService.logger.info(`Seeding successful for '${storagePath}'. Saved to localStorage as gcs_db_${storagePath}`);
      } catch (e) {
        _DataService.logger.error(`Seeding CRITICAL FAILURE for '${storagePath}':`, e);
      }
    }
    /**
     * Speichert oder aktualisiert ein Objekt in einer Collection.
     */
    async saveItem(storagePath, collection, item) {
      if (!item.id) item.id = "id_" + Math.random().toString(36).substr(2, 9);
      const db = await this.readDb(storagePath);
      if (!db[collection]) db[collection] = [];
      const index = db[collection].findIndex((i) => i.id === item.id);
      if (index !== -1) {
        db[collection][index] = { ...db[collection][index], ...item };
      } else {
        db[collection].push(item);
      }
      await this.writeDb(storagePath, db);
      return item;
    }
    /**
     * Findet Objekte in einer Collection basierend auf Filtern.
     */
    async findItems(storagePath, collection, query = {}, operator = "==") {
      _DataService.logger.debug(`findItems in '${storagePath}' -> '${collection}' with query:`, JSON.stringify(query), `Operator: ${operator}`);
      const db = await this.readDb(storagePath);
      if (!db[collection]) {
        _DataService.logger.warn(`Collection '${collection}' not found in '${storagePath}'`);
        return [];
      }
      const list = db[collection] || [];
      _DataService.logger.debug(`Searching in ${list.length} items...`);
      const results = list.filter((item) => {
        for (const key in query) {
          const itemValue = item[key];
          const queryValue = query[key];
          switch (operator) {
            case ">":
              if (!(Number(itemValue) > Number(queryValue))) return false;
              break;
            case ">=":
              if (!(Number(itemValue) >= Number(queryValue))) return false;
              break;
            case "<":
              if (!(Number(itemValue) < Number(queryValue))) return false;
              break;
            case "<=":
              if (!(Number(itemValue) <= Number(queryValue))) return false;
              break;
            case "CONTAINS":
              if (Array.isArray(itemValue)) {
                if (!itemValue.includes(queryValue)) return false;
              } else if (typeof itemValue === "string") {
                if (!itemValue.includes(String(queryValue))) return false;
              } else {
                if (itemValue != queryValue) return false;
              }
              break;
            case "IN":
              const set = String(queryValue).split(",").map((s) => s.trim());
              if (!set.includes(String(itemValue))) return false;
              break;
            case "==":
            default:
              if (itemValue == queryValue) continue;
              if (Array.isArray(itemValue) && typeof queryValue === "string") {
                if (itemValue.join("") === queryValue) continue;
                if (itemValue.toString() === queryValue) return false;
              } else {
                return false;
              }
          }
        }
        return true;
      });
      _DataService.logger.debug(`Found ${results.length} matches.`);
      if (results.length === 0 && list.length > 0) {
        _DataService.logger.debug("No matches found. Dump first item for debug:", list[0]);
      }
      return results;
    }
    /**
     * Löscht ein Objekt anhand seiner ID.
     */
    async deleteItem(storagePath, collection, id) {
      const db = await this.readDb(storagePath);
      if (!db[collection]) return false;
      const initialLength = db[collection].length;
      db[collection] = db[collection].filter((item) => item.id !== id);
      if (db[collection].length !== initialLength) {
        await this.writeDb(storagePath, db);
        return true;
      }
      return false;
    }
    /**
     * Liefert eine Liste aller verfügbaren Collections (Modelle) in der Datenbank.
     */
    async getModels(storagePath) {
      const db = await this.readDb(storagePath);
      return Object.keys(db).filter((key) => Array.isArray(db[key]));
    }
    /**
     * Synchrones Auslesen der Modelle (nur für Browser/Editor).
     */
    getModelsSync(storagePath) {
      if (typeof window === "undefined") return [];
      try {
        const key = `gcs_db_${storagePath}`;
        const content = localStorage.getItem(key);
        if (!content) return [];
        const db = JSON.parse(content);
        return Object.keys(db).filter((k) => Array.isArray(db[k]));
      } catch (e) {
        return [];
      }
    }
    /**
     * Liefert die Felder (Keys) des ersten Eintrags eines Modells.
     * Dient als "Schema-Erkennung" für IntelliSense.
     */
    async getModelFields(storagePath, modelName) {
      const db = await this.readDb(storagePath);
      const collection = db[modelName];
      if (!Array.isArray(collection) || collection.length === 0) {
        return [];
      }
      const allKeys = /* @__PURE__ */ new Set();
      collection.forEach((item) => {
        if (typeof item === "object" && item !== null) {
          Object.keys(item).forEach((key) => allKeys.add(key));
        }
      });
      return Array.from(allKeys);
    }
    /**
     * Synchrones Auslesen der Felder eines Modells (nur für Browser/Editor).
     */
    getModelFieldsSync(storagePath, modelName) {
      if (typeof window === "undefined") return [];
      try {
        const key = `gcs_db_${storagePath}`;
        const content = localStorage.getItem(key);
        if (!content) return [];
        const db = JSON.parse(content);
        let collection = db[modelName];
        if (!collection && !modelName.endsWith("s")) collection = db[modelName + "s"];
        if (!collection && modelName.endsWith("s")) collection = db[modelName.slice(0, -1)];
        if (!Array.isArray(collection) || collection.length === 0) return [];
        const allKeys = /* @__PURE__ */ new Set();
        collection.forEach((item) => {
          if (typeof item === "object" && item !== null) {
            Object.keys(item).forEach((key2) => allKeys.add(key2));
          }
        });
        return Array.from(allKeys);
      } catch (e) {
        return [];
      }
    }
    /**
     * Interne Methode zum Lesen der gesamten DB-Struktur
     */
    async readDb(storagePath) {
      if (typeof window !== "undefined") {
        const key = `gcs_db_${storagePath}`;
        const content = localStorage.getItem(key);
        _DataService.logger.debug(`Reading from localStorage: ${key} (${content ? "found" : "not found"})`);
        try {
          return content ? JSON.parse(content) : {};
        } catch (e) {
          return {};
        }
      } else {
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const fullPath = path.join(process.cwd(), "data", storagePath);
          _DataService.logger.info(`Reading from file: ${fullPath}`);
          const content = await fs.readFile(fullPath, "utf-8");
          return JSON.parse(content);
        } catch (e) {
          return {};
        }
      }
    }
    /**
     * Interne Methode zum Schreiben der gesamten DB-Struktur
     */
    async writeDb(storagePath, db) {
      if (typeof window !== "undefined") {
        const key = `gcs_db_${storagePath}`;
        localStorage.setItem(key, JSON.stringify(db));
      } else {
        try {
          const fs = await import("fs/promises");
          const path = await import("path");
          const dir = path.join(process.cwd(), "data");
          const fullPath = path.join(dir, storagePath);
          try {
            await fs.mkdir(dir, { recursive: true });
          } catch (e) {
          }
          await fs.writeFile(fullPath, JSON.stringify(db, null, 2));
        } catch (e) {
          _DataService.logger.error("Fehler beim Schreiben der Datei:", e);
        }
      }
    }
  };
  __publicField(_DataService, "logger", Logger.get("DataService", "DataStore_Sync"));
  __publicField(_DataService, "instance");
  var DataService = _DataService;
  var dataService = DataService.getInstance();

  // src/components/actions/ActionApiHandler.ts
  var ActionApiHandler = class {
    static async handle(_action, params, globalObjects) {
      console.log("[ActionApiHandler] Handling API Request:", params);
      const path = params.path || "";
      const method = params.method || "GET";
      if (_action.dataStore) {
        const storeName = _action.dataStore;
        const dataStore = globalObjects.find((obj) => obj.name === storeName && obj.className === "TDataStore");
        if (dataStore) {
          console.log(`[ActionApiHandler] Using TDataStore: ${storeName}`);
          const storagePath = dataStore.storagePath || "db.json";
          const collection = dataStore.defaultCollection || "items";
          const query = params.query || _action.query || {};
          return this.performDataQuery(storagePath, collection, query, params);
        } else {
          console.warn(`[ActionApiHandler] DataStore not found: ${storeName}`);
          return { status: 500, data: { error: `DataStore component not found: ${storeName}` } };
        }
      }
      if (path.includes("/users") && method === "GET") {
        return this.handleUserSearch(params, globalObjects);
      }
      return {
        status: 404,
        data: { error: `Resource not found: ${path} (and no dataStore configured)` }
      };
    }
    static async performDataQuery(storagePath, collection, query, params) {
      let requestPin = query.code || query.authCode || query.pin;
      if (!requestPin && params.body?.code) requestPin = params.body.code;
      if (!requestPin && params.body?.pin) requestPin = params.body.pin;
      console.log(`[ActionApiHandler] Querying ${storagePath}/${collection}. Query:`, query);
      const allItems = await DataService.getInstance().findItems(storagePath, collection, {});
      if (requestPin) {
        const found = allItems.find((item) => {
          let itemPin = "";
          if (Array.isArray(item.authCode)) itemPin = item.authCode.join("");
          else if (item.authCode) itemPin = item.authCode;
          else if (item.pin) itemPin = item.pin;
          return itemPin === requestPin;
        });
        if (found) {
          return { status: 200, data: { user: found, token: "sim-new-token" } };
        } else {
          return { status: 401, data: { error: "Not found" } };
        }
      }
      return { status: 200, data: allItems };
    }
    static async handleUserSearch(params, globalObjects) {
      const userDataStore = globalObjects.find((obj) => obj.name === "UserData" && obj.className === "TDataStore");
      const storagePath = userDataStore?.storagePath || "db.json";
      const collection = userDataStore?.defaultCollection || "users";
      return this.performDataQuery(storagePath, collection, params.query, params);
    }
  };

  // src/runtime/actions/StandardActions.ts
  var runtimeLogger = Logger.get("Action", "Runtime_Execution");
  var dataLogger = Logger.get("Action", "DataStore_Sync");
  function resolveTarget(targetName, objects, vars, _contextObj) {
    if (!targetName) return null;
    let actualName = targetName;
    if (targetName.startsWith("${") && targetName.endsWith("}")) {
      const varName = targetName.substring(2, targetName.length - 1);
      actualName = String(vars[varName] || targetName);
    }
    return objects.find((o) => o.name === actualName || o.id === actualName);
  }
  function registerStandardActions() {
    actionRegistry.register("property", (action, context) => {
      const target = resolveTarget(action.target, context.objects, context.vars, context.contextVars);
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      if (target && action.changes) {
        Object.keys(action.changes).forEach((prop) => {
          const rawValue = action.changes[prop];
          const value = PropertyHelper.interpolate(String(rawValue), combinedContext, context.objects);
          const finalValue = PropertyHelper.autoConvert(value);
          PropertyHelper.setPropertyValue(target, prop, finalValue);
          DebugLogService.getInstance().log("Variable", `${target.name || target.id}.${prop} = ${finalValue}`, {
            objectName: target.name || target.id,
            flatten: true
          });
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
      let val = void 0;
      const sourceName = action.source;
      const variableName = action.variableName;
      const srcObj = resolveTarget(sourceName, context.objects, context.vars, context.contextVars);
      if (srcObj) {
        if (action.sourceProperty) {
          val = PropertyHelper.getPropertyValue(srcObj, action.sourceProperty);
        } else {
          val = srcObj;
        }
      }
      if (val === void 0) {
        const varVal = context.vars[sourceName] !== void 0 ? context.vars[sourceName] : context.contextVars[sourceName];
        if (varVal !== void 0) {
          if (action.sourceProperty && typeof varVal === "object" && varVal !== null) {
            val = PropertyHelper.getPropertyValue(varVal, action.sourceProperty);
          } else {
            val = varVal;
          }
        }
      }
      if (val === void 0 && sourceName && String(sourceName).includes("${")) {
        val = PropertyHelper.interpolate(String(sourceName), { ...context.contextVars, ...context.vars }, context.objects);
      }
      if ((val === void 0 || !action.source && !action.sourceProperty) && action.value !== void 0) {
        const combinedCtx = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        val = PropertyHelper.interpolate(String(action.value), combinedCtx, context.objects);
      }
      if (val !== void 0 && variableName) {
        context.vars[variableName] = val;
        context.contextVars[variableName] = val;
        DebugLogService.getInstance().log("Variable", `Variable "${variableName}" auf "${val}" gesetzt (Quelle: ${sourceName || action.value})${action.sourceProperty ? "." + action.sourceProperty : ""}`, {
          data: { value: val, source: sourceName, property: action.sourceProperty }
        });
      } else {
        runtimeLogger.warn(`Quelle "${sourceName}" (Value: ${action.value}) konnte nicht aufgel\xF6st werden oder variableName fehlt.`);
        DebugLogService.getInstance().log("Action", `\u26A0\uFE0F Variable konnte nicht gelesen werden. Quelle: ${sourceName}, Value: ${action.value}`, {
          data: action
        });
      }
    }, {
      type: "variable",
      label: "Variable lesen / setzen",
      description: "Liest einen Wert aus einer Quelle (Objekt-Eigenschaft, Wert oder andere Variable) und speichert ihn in einer Ziel-Variable.",
      parameters: [
        { name: "variableName", label: "Ziel-Variable", type: "variable", source: "variables" },
        { name: "value", label: "Einfacher Wert (z.B. 555)", type: "string", placeholder: "Literal oder ${var}" },
        { name: "source", label: "(oder) Quell-Objekt / Variable", type: "object", source: "objects" },
        { name: "sourceProperty", label: "(oder) Eigenschaft (optional)", type: "string", placeholder: "z.B. text oder value" }
      ]
    });
    actionRegistry.register("set_variable", actionRegistry.getHandler("variable"), {
      type: "set_variable",
      label: "Variable setzen (Zuweisung)",
      description: "Liest einen Wert aus einer Quelle und speichert ihn in einer Ziel-Variable.",
      parameters: [
        { name: "variableName", label: "Ziel-Variable", type: "variable", source: "variables" },
        { name: "value", label: "Einfacher Wert (z.B. 555)", type: "string", placeholder: "Literal oder ${var}" },
        { name: "source", label: "(oder) Quell-Objekt / Variable", type: "object", source: "objects" },
        { name: "sourceProperty", label: "(oder) Eigenschaft (optional)", type: "string", placeholder: "z.B. text oder value" }
      ]
    });
    actionRegistry.register("calculate", (action, context) => {
      const formula = action.formula || action.expression;
      if (formula) {
        const objectMap = context.objects.reduce((acc, obj) => {
          if (obj.id) acc[obj.id] = obj;
          if (obj.name) acc[obj.name] = obj;
          return acc;
        }, {});
        const evalContext = {
          ...objectMap,
          ...context.contextVars,
          ...context.vars,
          $eventData: context.eventData
        };
        try {
          const result = ExpressionParser.evaluate(formula, evalContext);
          runtimeLogger.info(`Result of "${formula}" -> ${JSON.stringify(result)} (Target: ${action.resultVariable})`);
          if (action.resultVariable) {
            context.contextVars[action.resultVariable] = result;
            if (context.vars) {
              context.vars[action.resultVariable] = result;
            }
          }
        } catch (err2) {
          runtimeLogger.error(`Error evaluating "${formula}":`, err2);
        }
      } else {
        runtimeLogger.warn("No formula/expression provided in action:", action);
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
      const target = resolveTarget(action.target, context.objects, context.vars, context.contextVars);
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      if (target) {
        const toValue = Number(PropertyHelper.interpolate(String(action.to), combinedContext, context.objects));
        AnimationManager.getInstance().addTween(target, action.property || "x", toValue, action.duration || 500, action.easing || "easeOut");
      }
    }, {
      type: "animate",
      label: "Animieren",
      description: "Animiert eine Eigenschaft eines Objekts.",
      parameters: [
        { name: "target", label: "Ziel-Objekt", type: "object", source: "objects" },
        { name: "property", label: "Eigenschaft", type: "string", defaultValue: "x" },
        { name: "to", label: "Ziel-Wert", type: "string" },
        { name: "duration", label: "Dauer (ms)", type: "number", defaultValue: 500 },
        { name: "easing", label: "Easing", type: "select", source: "easing-functions", defaultValue: "easeOut" }
      ]
    });
    actionRegistry.register("move_to", (action, context) => {
      const target = resolveTarget(action.target, context.objects, context.vars, context.contextVars);
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      if (target) {
        const toX = Number(PropertyHelper.interpolate(String(action.x), combinedContext, context.objects));
        const toY = Number(PropertyHelper.interpolate(String(action.y), combinedContext, context.objects));
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
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      let targetGame = PropertyHelper.interpolate(action.target, combinedContext, context.objects);
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
      const stageId = action.stageId;
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      if (!stageId) return;
      const resolved = PropertyHelper.interpolate(String(stageId), combinedContext, context.objects);
      const stageController = context.objects.find(
        (o) => o.className === "TStageController" || o.constructor?.name === "TStageController"
      );
      if (stageController && typeof stageController.goToStage === "function") {
        runtimeLogger.info(`Via TStageController \u2192 ${resolved}`);
        DebugLogService.getInstance().log("Action", `Stage wechselt zu: ${resolved}`, {
          objectName: "TStageController",
          data: { stageId: resolved }
        });
        stageController.goToStage(resolved);
        return;
      }
      if (context.onNavigate) {
        runtimeLogger.info(`Via onNavigate fallback \u2192 stage:${resolved}`);
        DebugLogService.getInstance().log("Action", `Navigation zu Stage: ${resolved}`, {
          data: { stageId: resolved }
        });
        context.onNavigate(`stage:${resolved}`, action.params);
      }
    }, {
      type: "navigate_stage",
      label: "Stage wechseln",
      description: "Wechselt zu einer anderen Stage innerhalb des Projekts.",
      parameters: [
        { name: "stageId", label: "Ziel-Stage", type: "select", source: "stages" }
      ]
    });
    actionRegistry.register("service", async (action, context) => {
      if (action.service && action.method && serviceRegistry.has(action.service)) {
        const params = (Array.isArray(action.serviceParams) ? action.serviceParams : []).map(
          (v) => PropertyHelper.interpolate(String(v), { ...context.contextVars, ...context.vars }, context.objects)
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
        { name: "serviceParams", label: "Parameter-Liste", type: "json" },
        { name: "resultVariable", label: "Ergebnis speichern in", type: "variable", source: "variables" }
      ]
    });
    actionRegistry.register("create_room", (action, context) => {
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      if (context.multiplayerManager) {
        let gameName = PropertyHelper.interpolate(action.game, combinedContext, context.objects);
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
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      if (context.multiplayerManager) {
        let code = action.params?.code ? PropertyHelper.interpolate(String(action.params.code), combinedContext, context.objects) : "";
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
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      let effectiveUrl = String(action.url || "");
      if (!effectiveUrl) {
        let res = action.resource;
        if (!res && action.dataStore) {
          const dsName = action.dataStore;
          const dsComponent = context.objects.find((o) => o.name === dsName || o.id === dsName);
          res = dsComponent?.defaultCollection;
        }
        if (res) {
          effectiveUrl = `/api/data/${res}`;
          const qProp = action.queryProperty || action.property;
          const qVal = action.queryValue || action.value;
          const qOp = action.queryOperator || "==";
          if (qProp && qVal) {
            const interpValue = PropertyHelper.interpolate(String(qVal), combinedContext, context.objects);
            effectiveUrl += `?${qProp}=${encodeURIComponent(interpValue)}&operator=${qOp}`;
          }
        }
      }
      let url = PropertyHelper.interpolate(effectiveUrl, combinedContext, context.objects);
      let method = action.method || "GET";
      if (action.requestJWT) {
        if (!url || url === "/" || url.startsWith("/api/data/")) {
          dataLogger.info(`Auto-fixing URL for JWT request: ${url} -> /api/platform/login`);
          url = "/api/platform/login";
        }
        if (method === "GET") {
          dataLogger.info(`Auto-fixing METHOD for JWT request: GET -> POST`);
          method = "POST";
        }
      }
      let body = null;
      let parsedBody = {};
      if (method !== "GET" && action.body) {
        const bodyStr = typeof action.body === "object" ? JSON.stringify(action.body) : String(action.body);
        body = PropertyHelper.interpolate(bodyStr, combinedContext, context.objects);
        try {
          parsedBody = JSON.parse(body);
        } catch (e) {
          parsedBody = body;
        }
      }
      if (action.requestJWT && !action.body) {
        const qProp = action.queryProperty || action.property;
        const qVal = action.queryValue || action.value;
        if (qProp && qVal) {
          dataLogger.info(`Interpolating qVal "${qVal}" for qProp "${qProp}"`);
          const interpValue = PropertyHelper.interpolate(String(qVal), combinedContext, context.objects);
          dataLogger.info(`Interpolated Value: "${interpValue}"`);
          parsedBody = { [qProp]: interpValue };
          body = JSON.stringify(parsedBody);
          dataLogger.info(`Auto-constructed Login Body (JWT):`, parsedBody);
        }
      }
      DebugLogService.getInstance().log("Action", `HTTP: ${method} ${url}`, {
        data: { type: "http", method, url, body: parsedBody }
      });
      if (serviceRegistry.has("ApiSimulator")) {
        dataLogger.info(`Using API Simulation for: ${method} ${url}`);
        try {
          const dsName = action.dataStore;
          const dsComponent = context.objects.find((o) => o.name === dsName || o.id === dsName);
          const storageFile = dsComponent?.storagePath || "db.json";
          if (action.requestJWT) {
            dataLogger.info(`JWT Simulation Request: ${method} ${url}`, parsedBody);
          }
          let result = await serviceRegistry.call("ApiSimulator", "request", [method, url, parsedBody, storageFile]);
          if (action.requestJWT) {
            dataLogger.info(`JWT Simulation Result:`, result);
            if (result && result.token) {
              localStorage.setItem("auth_token", result.token);
              dataLogger.info('Auto-saved JWT token to localStorage "auth_token"');
            }
            if (result && result.user) {
              result = result.user;
              dataLogger.info("Auto-unwrapped user object from JWT response");
            }
          }
          if (action.resultPath && result) {
            result = PropertyHelper.getPropertyValue(result, action.resultPath);
          }
          if (action.selectFields && action.selectFields !== "*" && result) {
            const fields = action.selectFields.split(",").map((f) => f.trim()).filter((f) => f);
            const isCountOnly = fields.length === 1 && fields[0] === "count(*)";
            if (isCountOnly && Array.isArray(result)) {
              result = result.length;
              dataLogger.info(`Applied SQL COUNT Projection: ${result}`);
            } else {
              const project = (obj) => {
                if (typeof obj !== "object" || obj === null) return obj;
                const partial = {};
                fields.forEach((f) => {
                  if (f === "count(*)" || f === "count") {
                    partial["count"] = 1;
                  } else if (f in obj) {
                    partial[f] = obj[f];
                  }
                });
                return partial;
              };
              result = Array.isArray(result) ? result.map(project) : project(result);
              dataLogger.info(`Applied SQL Projection (${action.selectFields}):`, result);
            }
          }
          if (action.requestJWT && Array.isArray(result) && result.length === 1) {
            dataLogger.info(`Auto-Unwrapping single-item JWT result for ${action.resultVariable}`);
            result = result[0];
          }
          const resVar = action.resultVariable || action.variable;
          if (resVar) {
            context.vars[resVar] = result;
            context.contextVars[resVar] = result;
            const varName = context.objects?.find((o) => o.id === resVar)?.name || resVar;
            const displayValue = Array.isArray(result) ? `[${result.length} Eintr\xE4ge]` : typeof result === "object" && result !== null ? JSON.stringify(result)?.substring(0, 80) : String(result);
            DebugLogService.getInstance().log("Variable", `${varName} \u2190 HTTP-Ergebnis: ${displayValue}`, {
              objectName: varName,
              data: result
            });
            if (action.requestJWT) {
              dataLogger.info(`Variable "${varName}" gesetzt auf:`, displayValue);
            }
          }
          if (result && (result.error || result.status >= 400)) {
            return false;
          }
        } catch (err2) {
          dataLogger.error("Simulation Error:", err2);
          if (action.resultVariable) {
            const errorObj = { error: String(err2), status: 500 };
            context.vars[action.resultVariable] = errorObj;
            context.contextVars[action.resultVariable] = errorObj;
          }
          return false;
        }
        return;
      }
      try {
        const options = {
          method,
          headers: { "Content-Type": "application/json", ...action.headers || {} }
        };
        const token = localStorage.getItem("auth_token");
        if (token) {
          options.headers["Authorization"] = `Bearer ${token}`;
        }
        if (body) options.body = body;
        if (action.requestJWT) {
          dataLogger.info(`JWT Real Request: ${method} ${url}`, { headers: options.headers, body: parsedBody });
        }
        const response = await fetch(url, options);
        let data = await response.json();
        if (action.requestJWT) {
          dataLogger.info(`JWT Real Response:`, data);
          if (data && data.token) {
            localStorage.setItem("auth_token", data.token);
            dataLogger.info('Auto-saved JWT token to localStorage "auth_token"');
          }
          if (data && data.user) {
            data = data.user;
            dataLogger.info("Auto-unwrapped user object from JWT response");
          }
        }
        if (action.resultPath && data) {
          data = PropertyHelper.getPropertyValue(data, action.resultPath);
        }
        if (action.requestJWT && Array.isArray(data) && data.length === 1) {
          dataLogger.info(`Auto-Unwrapping single-item JWT result for ${action.resultVariable}`);
          data = data[0];
        }
        if (action.resultVariable) {
          context.vars[action.resultVariable] = data;
          context.contextVars[action.resultVariable] = data;
          const varName = context.objects?.find((o) => o.id === action.resultVariable)?.name || action.resultVariable;
          const displayValue = Array.isArray(data) ? `[${data.length} Eintr\xE4ge]` : typeof data === "object" && data !== null ? JSON.stringify(data).substring(0, 80) : String(data);
          DebugLogService.getInstance().log("Variable", `${varName} \u2190 HTTP-Ergebnis: ${displayValue}`, {
            objectName: varName,
            data
          });
          if (action.requestJWT) {
            dataLogger.info(`Produktion: Variable "${varName}" gesetzt auf:`, displayValue);
          }
        }
        if (!response.ok) {
          return false;
        }
      } catch (err2) {
        dataLogger.error("Error:", err2);
        if (action.resultVariable) {
          const errorObj = { error: String(err2) };
          context.vars[action.resultVariable] = errorObj;
          context.contextVars[action.resultVariable] = errorObj;
        }
        return false;
      }
    }, {
      type: "http",
      label: "HTTP Request",
      description: "F\xFChrt einen API-Call aus (REST/JSON).",
      parameters: [
        { name: "url", label: "URL", type: "string" },
        { name: "method", label: "Methode", type: "select", options: ["GET", "POST", "PUT", "DELETE"], defaultValue: "GET" },
        { name: "body", label: "Body (JSON-String oder Objekt)", type: "string" },
        { name: "resultVariable", label: "Ergebnis speichern in", type: "variable", source: "variables" },
        { name: "resultPath", label: "Daten-Pfad (Selektor)", type: "string", hint: 'Optional: Pfad zum Objekt in der Response (z.B. "user")' },
        { name: "selectFields", label: "Felder (SELECT)", type: "string", hint: "Kommagetrennte Liste der Felder oder count(*)" },
        { name: "queryProperty", label: "Filter-Feld (WHERE)", type: "string", hint: "z.B. id oder email" },
        { name: "queryOperator", label: "Operator", type: "select", options: ["==", "!=", ">", "<", ">=", "<=", "CONTAINS"], defaultValue: "==" },
        { name: "queryValue", label: "Filter-Wert", type: "string", hint: "Wert oder ${variable}" }
      ]
    });
    actionRegistry.register("store_token", (action, context) => {
      const key = action.tokenKey || "auth_token";
      const operation = action.operation || "set";
      if (operation === "delete") {
        localStorage.removeItem(key);
      } else {
        const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
        const token = PropertyHelper.interpolate(String(action.token || ""), combinedContext, context.objects);
        dataLogger.info(`Speichere Token "${key}":`, token ? token.substring(0, 15) + "..." : "null");
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
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      const message = PropertyHelper.interpolate(String(action.message || ""), combinedContext, context.objects);
      const toastType = action.toastType || "info";
      const toaster = context.objects.find((o) => o.className === "TToast" || o.constructor?.name === "TToast");
      if (toaster && typeof toaster.show === "function") {
        toaster.show(message, toastType);
      } else {
        runtimeLogger.info(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
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
    actionRegistry.register("call_method", async (action, context) => {
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      const targetName = action.target;
      const methodName = action.method;
      const rawParams = Array.isArray(action.params) ? action.params : [];
      const resolvedParams = rawParams.map(
        (p) => PropertyHelper.interpolate(String(p), combinedContext, context.objects)
      );
      const targetObj = resolveTarget(targetName, context.objects, context.vars, context.contextVars);
      if (targetObj && typeof targetObj[methodName] === "function") {
        const result = await targetObj[methodName](...resolvedParams);
        if (action.resultVariable) {
          context.vars[action.resultVariable] = result;
          context.contextVars[action.resultVariable] = result;
        }
        runtimeLogger.info(`${targetName}.${methodName}(${resolvedParams.join(", ")}) aufgerufen.`);
        return;
      }
      if (serviceRegistry.has(targetName)) {
        const result = await serviceRegistry.call(targetName, methodName, resolvedParams);
        if (action.resultVariable) {
          context.vars[action.resultVariable] = result;
          context.contextVars[action.resultVariable] = result;
        }
        runtimeLogger.info(`Service ${targetName}.${methodName}(${resolvedParams.join(", ")}) aufgerufen.`);
        return;
      }
      if (targetName === "Toaster" && methodName === "show") {
        const message = resolvedParams[0] || "";
        const toastType = resolvedParams[1] || "info";
        const toaster = context.objects.find(
          (o) => o.className === "TToast" || o.constructor?.name === "TToast"
        );
        if (toaster && typeof toaster.show === "function") {
          toaster.show(message, toastType);
        } else {
          runtimeLogger.info(`[TOAST: ${toastType.toUpperCase()}] ${message}`);
        }
        return;
      }
      console.warn(`[Action: call_method] Ziel "${targetName}" nicht gefunden oder Methode "${methodName}" nicht vorhanden.`);
    }, {
      type: "call_method",
      label: "Methode aufrufen",
      description: "Ruft eine Methode auf einem Objekt oder registrierten Service auf.",
      parameters: [
        { name: "target", label: "Ziel (Objekt oder Service)", type: "string" },
        { name: "method", label: "Methode", type: "string" },
        { name: "params", label: "Parameter (Array)", type: "json", hint: '["param1", "param2"]' },
        { name: "resultVariable", label: "Ergebnis speichern in", type: "variable", source: "variables" }
      ]
    });
    actionRegistry.register("respond_http", async (action, context) => {
      const combinedContext = { ...context.contextVars, ...context.vars, $eventData: context.eventData };
      const requestId = PropertyHelper.interpolate(String(action.requestId || ""), combinedContext, context.objects);
      const status = Number(PropertyHelper.interpolate(String(action.status || 200), combinedContext, context.objects));
      const dataStr = PropertyHelper.interpolate(String(action.data || "{}"), combinedContext, context.objects);
      let data = dataStr;
      try {
        if (dataStr.trim().startsWith("{") || dataStr.trim().startsWith("[")) {
          data = JSON.parse(dataStr);
        }
      } catch (e) {
        dataLogger.warn("Could not parse data as JSON, sending as string:", e);
      }
      dataLogger.info(`Sending response for ${requestId}:`, { status, data });
      if (serviceRegistry.has("HttpServer")) {
        await serviceRegistry.call("HttpServer", "respond", [requestId, status, data]);
      } else {
        dataLogger.warn("No HttpServer service registered!");
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
    actionRegistry.register("execute_login_request", async (_action, context) => {
      const pin = context.vars["currentPIN"] || context.contextVars["currentPIN"];
      dataLogger.info("Attempting login with PIN:", pin);
      if (!pin) {
        dataLogger.warn("No PIN provided!");
        return false;
      }
      try {
        const response = await fetch("http://localhost:8080/api/auth/login", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ pin })
        });
        if (response.ok) {
          const data = await response.json();
          dataLogger.info("Login success:", data);
          context.contextVars["loginResult"] = data;
          context.vars["loginResult"] = data;
          return true;
        } else {
          dataLogger.warn("Login failed:", response.status);
          return false;
        }
      } catch (error) {
        dataLogger.error("Network error:", error);
        return false;
      }
    }, {
      type: "execute_login_request",
      label: "Login Request ausf\xFChren",
      description: "F\xFChrt den Login-Request gegen das Backend aus.",
      parameters: []
    });
    actionRegistry.register("data_action", async (action, context) => {
      const subType = action.data?.type || action.subType || "http";
      runtimeLogger.info(`Delegating to ${subType}`);
      const handler = actionRegistry.getHandler(subType);
      if (handler) {
        const mergedAction = { ...action.data, ...action, type: subType };
        return await handler(mergedAction, context);
      } else {
        runtimeLogger.warn(`No handler found for sub-type "${subType}"`);
        return false;
      }
    }, {
      type: "data_action",
      label: "Data Action",
      description: "F\xFChrt eine Daten-Aktion aus (HTTP, SQL, etc.).",
      parameters: [
        { name: "dataStore", label: "Data Store (Komponente)", type: "select", source: "components", hint: "W\xE4hle eine TDataStore-Komponente (z.B. UserData)" },
        { name: "selectFields", label: "Felder (SELECT)", type: "string", hint: "Kommagetrennte Liste der Felder oder count(*)" },
        { name: "queryProperty", label: "Filter-Feld (WHERE)", type: "string", hint: "z.B. id oder email" },
        { name: "queryOperator", label: "Operator", type: "select", options: ["==", "!=", ">", "<", ">=", "<=", "CONTAINS"], defaultValue: "==" },
        { name: "queryValue", label: "Filter-Wert", type: "string", hint: "Wert oder ${variable}" }
      ]
      // Dynamic based on sub-type
    });
    actionRegistry.register("handle_api_request", async (action, context) => {
      const eventData = context.vars?.eventData || context.eventData;
      if (!eventData || !eventData.requestId) {
        console.warn("[Action: handle_api_request] Missing requestId in eventData. Is this triggered by onRequest?");
        return false;
      }
      const logicResponse = await ActionApiHandler.handle(action, {
        path: eventData.path,
        method: eventData.method,
        body: eventData.body,
        query: eventData.query
      }, context.objects);
      const pendingMap = window.__pendingApiResponses;
      if (pendingMap) {
        const resolver = pendingMap.get(eventData.requestId);
        if (resolver) {
          resolver(logicResponse);
          pendingMap.delete(eventData.requestId);
          console.log(`[Action: handle_api_request] Sent response for ${eventData.requestId}`, logicResponse);
          return true;
        }
      }
      console.warn(`[Action: handle_api_request] Could not find pending response resolver for ${eventData.requestId}`);
      return false;
    }, {
      type: "handle_api_request",
      label: "API Request verarbeiten",
      description: "Verarbeitet einen API-Request mit Datenbank-Logik und sendet die Antwort.",
      parameters: []
    });
  }

  // src/runtime/ActionExecutor.ts
  var _ActionExecutor = class _ActionExecutor {
    constructor(objects, multiplayerManager, onNavigate) {
      this.objects = objects;
      this.multiplayerManager = multiplayerManager;
      this.onNavigate = onNavigate;
      registerStandardActions();
    }
    setObjects(objects) {
      this.objects = objects;
    }
    /**
     * Executes a single action
     */
    async execute(action, vars, globalVars = {}, contextObj, parentId) {
      if (!action || !action.type) return;
      const actionName = action.name || this.getDescriptiveName(action);
      const logId = DebugLogService.getInstance().log("Action", actionName, {
        parentId,
        data: action
      });
      _ActionExecutor.logger.debug(`Executing: type="${action.type}"`, {
        action,
        localVars: vars,
        globalVars,
        eventData: contextObj
      });
      DebugLogService.getInstance().pushContext(logId);
      try {
        const handler = actionRegistry.getHandler(action.type);
        if (handler) {
          return await handler(action, {
            vars,
            contextVars: globalVars,
            objects: this.objects,
            eventData: contextObj,
            multiplayerManager: this.multiplayerManager,
            onNavigate: this.onNavigate
          });
        }
        if (!handler) {
          _ActionExecutor.logger.warn(`Unknown action type: ${action.type}`);
        }
      } finally {
        DebugLogService.getInstance().popContext();
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
  __publicField(_ActionExecutor, "logger", Logger.get("ActionExecutor", "Runtime_Execution"));
  var ActionExecutor = _ActionExecutor;

  // src/services/LibraryService.ts
  var LibraryService = class {
    constructor() {
      __publicField(this, "logger", Logger.get("LibraryService", "Project_Save_Load"));
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
        this.logger.info(`Loaded ${this.libraryTasks.length} tasks and ${this.libraryTemplates.length} templates.`);
      } catch (err2) {
        this.logger.error("Failed to load library.json:", err2);
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
          this.logger.info(`Template "${template.name}" saved successfully.`);
          return true;
        } else {
          this.logger.error("Failed to save template:", await response.text());
          return false;
        }
      } catch (err2) {
        this.logger.error("Error saving template:", err2);
        return false;
      }
    }
  };
  var libraryService = new LibraryService();

  // src/runtime/executor/TaskConditionEvaluator.ts
  var _TaskConditionEvaluator = class _TaskConditionEvaluator {
    static evaluateCondition(condition, vars, globalVars) {
      if (!condition) return false;
      let leftValue;
      let rightValue;
      let operator = "==";
      let conditionStr = "";
      if (typeof condition === "string") {
        conditionStr = condition;
        const parts = condition.split(/\s*(==|!=|>|<|>=|<=)\s*/);
        if (parts.length === 3) {
          const left = parts[0].trim();
          operator = parts[1];
          const right = parts[2].trim();
          leftValue = this.resolveValue(left, vars, globalVars);
          rightValue = this.resolveValue(right, vars, globalVars);
        } else {
          return !!this.resolveValue(condition, vars, globalVars);
        }
      } else {
        const leftType = condition.leftType || "variable";
        const rightType = condition.rightType || "literal";
        const leftValRaw = condition.leftValue || condition.variable;
        const rightValRaw = condition.rightValue || condition.value;
        operator = condition.operator || "==";
        if (leftType === "variable" || leftType === "property") {
          leftValue = this.resolveValue(leftValRaw, vars, globalVars);
        } else {
          leftValue = leftValRaw;
        }
        if (rightType === "variable" || rightType === "property") {
          rightValue = this.resolveValue(rightValRaw, vars, globalVars);
        } else {
          rightValue = rightValRaw;
        }
        conditionStr = `${leftValRaw} (${leftType}) ${operator} ${rightValRaw} (${rightType})`;
      }
      _TaskConditionEvaluator.logger.debug(`Evaluating Condition: "${conditionStr}"`);
      _TaskConditionEvaluator.logger.debug(`               Left:  "${leftValue}" (type: ${typeof leftValue})`);
      _TaskConditionEvaluator.logger.debug(`               Right: "${rightValue}" (type: ${typeof rightValue})`);
      _TaskConditionEvaluator.logger.debug(`               Op:    "${operator}"`);
      switch (operator) {
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
        default:
          return String(leftValue) === String(rightValue);
      }
    }
    static resolveValue(value, vars, globalVars) {
      if (typeof value === "number") return value;
      if (typeof value === "boolean") return value;
      if (value === void 0 || value === null) return value;
      if (typeof value === "string") {
        if (value.startsWith("'") && value.endsWith("'") || value.startsWith('"') && value.endsWith('"')) {
          return value.substring(1, value.length - 1);
        }
        const match = value.match(/^\$\{(.+)\}$/);
        if (match) {
          return this.resolveVarPath(match[1], vars, globalVars);
        }
        return this.resolveVarPath(value, vars, globalVars);
      }
      return value;
    }
    static resolveVarPath(path, vars, globalVars) {
      let root = vars;
      let lookup = path;
      if (lookup.startsWith("${") && lookup.endsWith("}")) {
        lookup = lookup.slice(2, -1);
      }
      if (lookup.startsWith("global.")) {
        root = globalVars;
        lookup = lookup.substring(7);
      } else if (lookup.startsWith("stage.")) {
        root = vars;
        lookup = lookup.substring(6);
      }
      return PropertyHelper.getPropertyValue(root, lookup);
    }
  };
  __publicField(_TaskConditionEvaluator, "logger", Logger.get("TaskConditionEvaluator", "Runtime_Execution"));
  var TaskConditionEvaluator = _TaskConditionEvaluator;

  // src/runtime/executor/TaskLoopHandler.ts
  var _TaskLoopHandler = class _TaskLoopHandler {
    static async handleWhile(item, vars, globalVars, contextObj, depth, parentId, executeBody) {
      if (!item.condition || !item.body) {
        _TaskLoopHandler.logger.warn("WHILE loop missing condition or body");
        return;
      }
      let iterations = 0;
      while (TaskConditionEvaluator.evaluateCondition(item.condition, vars, globalVars)) {
        if (iterations++ >= this.MAX_ITERATIONS) {
          _TaskLoopHandler.logger.error(`WHILE loop exceeded max iterations(${this.MAX_ITERATIONS})`);
          break;
        }
        await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      }
      _TaskLoopHandler.logger.info(`WHILE loop completed after ${iterations} iterations`);
    }
    static async handleFor(item, vars, globalVars, contextObj, depth, parentId, executeBody) {
      if (!item.iteratorVar || !item.body) {
        _TaskLoopHandler.logger.warn("FOR loop missing iteratorVar or body");
        return;
      }
      const from = TaskConditionEvaluator.resolveValue(item.from, vars, globalVars);
      const to = TaskConditionEvaluator.resolveValue(item.to, vars, globalVars);
      const step = item.step || 1;
      let iterations = 0;
      for (let i = from; step > 0 ? i <= to : i >= to; i += step) {
        if (iterations++ >= this.MAX_ITERATIONS) {
          _TaskLoopHandler.logger.error(`FOR loop exceeded max iterations(${this.MAX_ITERATIONS})`);
          break;
        }
        vars[item.iteratorVar] = i;
        globalVars[item.iteratorVar] = i;
        await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
      }
      _TaskLoopHandler.logger.info(`FOR loop completed after ${iterations} iterations`);
    }
    static async handleForeach(item, vars, globalVars, contextObj, depth, parentId, executeBody) {
      if (!item.sourceArray || !item.itemVar || !item.body) {
        _TaskLoopHandler.logger.warn("FOREACH loop missing sourceArray, itemVar, or body");
        return;
      }
      const arrayName = item.sourceArray;
      const arr = vars[arrayName] !== void 0 ? vars[arrayName] : globalVars[arrayName];
      if (!Array.isArray(arr)) {
        _TaskLoopHandler.logger.warn(`FOREACH: ${arrayName} is not an array`);
        return;
      }
      let idx = 0;
      for (const element of arr) {
        if (idx >= this.MAX_ITERATIONS) {
          _TaskLoopHandler.logger.error(`FOREACH loop exceeded max iterations(${this.MAX_ITERATIONS})`);
          break;
        }
        vars[item.itemVar] = element;
        globalVars[item.itemVar] = element;
        if (item.indexVar) {
          vars[item.indexVar] = idx;
          globalVars[item.indexVar] = idx;
        }
        await executeBody(item.body, vars, globalVars, contextObj, depth, parentId);
        idx++;
      }
      _TaskLoopHandler.logger.info(`FOREACH loop completed after ${idx} iterations`);
    }
  };
  __publicField(_TaskLoopHandler, "logger", Logger.get("TaskLoopHandler", "Runtime_Execution"));
  __publicField(_TaskLoopHandler, "MAX_ITERATIONS", 1e3);
  var TaskLoopHandler = _TaskLoopHandler;

  // src/runtime/TaskExecutor.ts
  var logger3 = Logger.get("TaskExecutor", "Runtime_Execution");
  var _TaskExecutor = class _TaskExecutor {
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
    async execute(taskName, vars = {}, globalVars = {}, contextObj = null, depth = 0, parentId, params = null, isRemoteExecution = false) {
      if (depth > _TaskExecutor.MAX_DEPTH) {
        logger3.error(`Max recursion depth reached for task ${taskName}`);
        return;
      }
      const isMultiplayer = !!this.multiplayerManager;
      const isEnabled = DebugLogService.getInstance().isEnabled();
      if (isEnabled) {
        console.error(`[TaskExecutor] EXECUTING: ${taskName} (depth: ${depth}, context: ${contextObj?.name || "none"})`);
      }
      const taskLogId = DebugLogService.getInstance().log("Task", `START: ${taskName}`, {
        parentId,
        objectName: contextObj?.name,
        flatten: depth > 0
        // Bei Rekursion flach halten für E2E Sichtbarkeit
      });
      let task = this.tasks?.find((t) => t.name === taskName);
      if (!task) {
        const blueprintStage = this.project.stages?.find((s) => s.type === "blueprint" || s.id === "stage_blueprint");
        if (blueprintStage) {
          task = blueprintStage.tasks?.find((t) => t.name === taskName);
        }
      }
      if (!task) {
        task = this.project.tasks?.find((t) => t.name === taskName);
      }
      if (!task) {
        task = libraryService.getTask(taskName);
      }
      if (!task && taskName.includes(".")) {
        const [objName, evtName] = taskName.split(".");
        let foundTaskName = "";
        let objectFound = null;
        if (contextObj && (contextObj.name === objName || contextObj.id === objName)) {
          objectFound = contextObj;
          const evts = contextObj.events || contextObj.Tasks;
          if (evts && evts[evtName]) {
            foundTaskName = evts[evtName];
            logger3.debug(`Resolved "${taskName}" via direct contextObj match: "${foundTaskName}"`);
          }
        }
        if (!foundTaskName) {
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
            if (obj) {
              objectFound = obj;
              if ((obj.events || obj.Tasks) && (obj.events || obj.Tasks)[evtName]) {
                foundTaskName = (obj.events || obj.Tasks)[evtName];
              }
            }
            if (!foundTaskName && s.variables) {
              const v = s.variables.find((v2) => v2.name === objName);
              if (v) {
                objectFound = v;
                if (v.events && v.events[evtName]) {
                  foundTaskName = v.events[evtName];
                } else if (v.Tasks && v.Tasks[evtName]) {
                  foundTaskName = v.Tasks[evtName];
                }
              }
            }
          });
          if (!foundTaskName && this.project.variables) {
            const v = this.project.variables.find((v2) => v2.name === objName);
            if (v) {
              objectFound = v;
              if (v.events && v.events[evtName]) {
                foundTaskName = v.events[evtName];
              } else if (v.Tasks && v.Tasks[evtName]) {
                foundTaskName = v.Tasks[evtName];
              }
            }
          }
          if (!foundTaskName && this.project.objects) {
            const obj = findDeep(this.project.objects);
            if (obj) {
              objectFound = obj;
              if ((obj.events || obj.Tasks) && (obj.events || obj.Tasks)[evtName]) {
                foundTaskName = (obj.events || obj.Tasks)[evtName];
              }
            }
          }
        }
        if (foundTaskName) {
          logger3.debug(`Final resolution for "${taskName}": "${foundTaskName}"`);
          return this.execute(foundTaskName, vars, globalVars, objectFound, depth + 1, taskLogId, params, isRemoteExecution);
        }
        const optionalEvents = ["onStart", "onStop", "onValueChanged", "onLoad", "onUnload", "onFocus", "onBlur", "onEnter", "onLeave"];
        const isOptionalEvent = optionalEvents.includes(evtName);
        if (!isOptionalEvent) {
          if (objectFound) {
            logger3.warn(`Object "${objName}" found, but no task mapping for event "${evtName}".`);
          } else {
            logger3.warn(`Could not resolve dot-notation "${taskName}". Object "${objName}" not found in current project.`);
          }
        }
        return;
      }
      if (!task) {
        const flowChart = this.flowCharts?.[taskName];
        const hasFlowChart = flowChart && flowChart.elements && flowChart.elements.length > 0;
        if (!hasFlowChart) {
          logger3.warn(`Task definition or FlowChart not found: ${taskName}`);
          return;
        }
      }
      const triggerMode = task?.triggerMode || "local-sync";
      DebugLogService.getInstance().pushContext(taskLogId);
      try {
        const flowChart = this.flowCharts?.[taskName];
        const hasFlowChart = flowChart && flowChart.elements && flowChart.elements.length > 0;
        const actionSequence = task?.actionSequence || [];
        if (hasFlowChart) {
          logger3.info(`Nutze Flussdiagramm f\xFCr "${taskName}" (Elemente: ${flowChart.elements.length})`);
          await this.executeFlowChart(taskName, flowChart, vars, globalVars, contextObj, depth, taskLogId);
        } else {
          if (actionSequence.length === 0) {
            logger3.debug(`Task "${taskName}" hat weder FlowChart noch ActionSequence.`);
          }
          for (const seqItem of actionSequence) {
            try {
              await this.executeSequenceItem(seqItem, vars, globalVars, contextObj, depth, taskLogId);
            } catch (err2) {
              logger3.error(`Error in item of task ${taskName}: ${err2}`);
              DebugLogService.getInstance().log("Event", `ERROR executing task ${taskName}: ${err2}`, { parentId: taskLogId });
            }
          }
        }
        if (isMultiplayer && triggerMode === "local-sync" && !isRemoteExecution) {
          logger3.info(`Syncing task "${taskName}" to other player`);
          this.multiplayerManager.sendSyncTask(taskName, params);
        }
      } finally {
        DebugLogService.getInstance().popContext();
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
        (e) => e.type === "task" && e.properties?.name === taskName || e.type === "start"
      );
      if (!startNode) {
        logger3.warn(`No start node found in flowChart for task: ${taskName}. elements:`, elements.map((e) => `${e.type}:${e.properties?.name || e.id}`));
        return;
      }
      logger3.debug(`FlowChart Elements for "${taskName}":`, elements.map((e) => `${e.type}:${e.properties?.name || e.id}`));
      logger3.debug(`FlowChart vars.eventData =`, vars.eventData, "contextObj =", contextObj?.name || contextObj?.className);
      const executeNode = async (node) => {
        if (!node || visited.has(node.id)) return;
        visited.add(node.id);
        const nodeType = node.type;
        const name = node.properties?.name || node.data?.name || node.data?.actionName;
        if (nodeType === "task" && name === taskName) {
          const outgoing = connections.filter((c) => c.startTargetId === node.id);
          for (const conn of outgoing) {
            const nextNode = elements.find((e) => e.id === conn.endTargetId);
            if (nextNode) await executeNode(nextNode);
          }
          return;
        }
        if (nodeType === "action") {
          let action = this.resolveAction({ type: "action", name });
          if (!action || action.type === "action" && !action.body) {
            action = node.data;
          }
          if (action && (!action.type || action.type === "action") && name) {
            logger3.warn(`Action "${name}" is missing or has generic type. Attempting rescue via resolveAction.`);
            const rescued = this.resolveAction(name);
            if (rescued && rescued !== action && rescued.type && rescued.type !== "action") {
              action = { ...rescued, ...action, type: rescued.type };
            } else if (node.data?.type && node.data.type !== "action") {
              action.type = node.data.type;
            }
          }
          if (action && action.type && action.type !== "action") {
            if (action.body && Array.isArray(action.body)) {
              const itemParams = node.data?.params || {};
              const resolvedParams = {};
              for (const [key, value] of Object.entries(itemParams)) {
                if (typeof value === "string") {
                  if (value === "$eventData") {
                    resolvedParams[key] = vars.eventData ?? contextObj;
                  } else if (value.startsWith("${") && value.endsWith("}")) {
                    const varName = value.slice(2, -1);
                    resolvedParams[key] = vars[varName] ?? globalVars[varName];
                  } else if (value.startsWith("$")) {
                    const varName = value.slice(1);
                    resolvedParams[key] = vars[varName] ?? globalVars[varName];
                  } else {
                    resolvedParams[key] = value;
                  }
                } else {
                  resolvedParams[key] = value;
                }
              }
              logger3.debug(`FlowChart: Executing action body for "${action.name}" with params:`, resolvedParams);
              const bodyVars = { ...vars, $params: resolvedParams };
              for (const bodyItem of action.body) {
                await this.actionExecutor.execute(bodyItem, bodyVars, globalVars, contextObj, parentId);
              }
            } else {
              await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            }
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
        if (nodeType === "task" || nodeType === "task") {
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
        if (nodeType === "data_action" || nodeType === "data_action") {
          const action = this.resolveAction({ type: "data_action", name }) || node.data;
          if (action) {
            logger3.info(`FlowChart: Executing DataAction "${name}"`);
            const result = await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            const isSuccess = result !== false;
            logger3.info(`DataAction "${name}" finished. Success: ${isSuccess}`);
            const successConn = connections.find(
              (c) => c.startTargetId === node.id && (c.data?.startAnchorType === "success" || c.data?.anchorType === "success" || c.data?.startAnchorType === "true")
            );
            const errorConn = connections.find(
              (c) => c.startTargetId === node.id && (c.data?.startAnchorType === "error" || c.data?.anchorType === "error" || c.data?.startAnchorType === "false")
            );
            if (isSuccess && successConn) {
              const successNode = elements.find((e) => e.id === successConn.endTargetId);
              if (successNode) await executeNode(successNode);
            } else if (!isSuccess && errorConn) {
              const errorNode = elements.find((e) => e.id === errorConn.endTargetId);
              if (errorNode) await executeNode(errorNode);
            } else {
              const outgoing = connections.find(
                (c) => c.startTargetId === node.id && !["success", "error", "true", "false"].includes(c.data?.startAnchorType || c.data?.anchorType || "")
              );
              if (outgoing) {
                const nextNode = elements.find((e) => e.id === outgoing.endTargetId);
                if (nextNode) await executeNode(nextNode);
              }
            }
          }
          return;
        }
        if (nodeType === "condition" || nodeType === "condition") {
          const condition = node.data?.condition;
          if (!condition) {
            logger3.warn(`Condition node without condition data: ${node.id} `);
            return;
          }
          const result = this.evaluateCondition(condition, vars, globalVars);
          const left = condition.leftValue || condition.variable || "?";
          const right = condition.rightValue || condition.value || "?";
          logger3.debug(`Condition ${left} ${condition.operator || "=="} ${right} => ${result} `);
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
      logger3.debug(`Processing item: type = "${item.type}" name = "${item.name || "N/A"}" condition = "${item.condition?.variable || "none"}"`);
      if (item.type !== "condition") {
        const condition = item.itemCondition || (typeof item.condition === "string" ? item.condition : null);
        if (condition && !this.evaluateCondition(condition, vars, globalVars)) {
          logger3.debug(`Item condition FALSE, skipping: ${condition} `);
          return;
        }
      }
      switch (item.type) {
        case "condition":
          await this.handleCondition(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "data_action":
          await this.handleDataAction(item, vars, globalVars, contextObj, depth, parentId);
          break;
        case "task":
          await this.execute(item.name, vars, globalVars, contextObj, depth + 1, parentId, item.params);
          break;
        case "action":
          const action = this.resolveAction(item);
          if (action) {
            if (action.body && Array.isArray(action.body)) {
              const resolvedParams = {};
              if (item.params) {
                for (const [key, value] of Object.entries(item.params)) {
                  if (typeof value === "string") {
                    if (value === "$eventData") {
                      resolvedParams[key] = vars.eventData ?? contextObj;
                    } else if (value.startsWith("${") && value.endsWith("}")) {
                      const varName = value.slice(2, -1);
                      resolvedParams[key] = TaskConditionEvaluator.resolveVarPath(varName, vars, globalVars);
                    } else if (value.startsWith("$")) {
                      resolvedParams[key] = TaskConditionEvaluator.resolveVarPath(value, vars, globalVars);
                    } else {
                      resolvedParams[key] = value;
                    }
                  } else {
                    resolvedParams[key] = value;
                  }
                }
              }
              logger3.debug(`Executing action body for "${action.name}" with params:`, resolvedParams);
              const bodyVars = { ...vars, $params: resolvedParams };
              for (const bodyItem of action.body) {
                await this.actionExecutor.execute(bodyItem, bodyVars, globalVars, contextObj, parentId);
              }
            } else {
              await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
            }
          } else {
            logger3.warn(`Action definition not found: ${item.name} `);
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
      if (!item) return null;
      if (typeof item === "string") {
        return this.actions.find((a) => a.name === item) || null;
      }
      if (item.name) {
        const found = this.actions.find((a) => a.name === item.name);
        if (found) return found;
      }
      if (item.type === "action" && !item.body) {
        return null;
      }
      return item;
    }
    evaluateCondition(condition, vars, globalVars) {
      return TaskConditionEvaluator.evaluateCondition(condition, vars, globalVars);
    }
    async handleCondition(item, vars, globalVars, contextObj, depth, parentId) {
      if (!item.condition) return;
      const result = this.evaluateCondition(item.condition, vars, globalVars);
      let conditionExpr = "";
      let logData = { result };
      if (typeof item.condition === "string") {
        conditionExpr = item.condition;
        logData.expression = item.condition;
      } else {
        const varName = item.condition.variable;
        const varValue = vars[varName] !== void 0 ? vars[varName] : globalVars[varName];
        const compareValue = item.condition.value;
        const operator = item.condition.operator || "==";
        conditionExpr = `${varName} ${operator} "${compareValue}"`;
        logData = { variable: varName, value: varValue, expected: compareValue, result };
      }
      DebugLogService.getInstance().log(
        "Condition",
        `${conditionExpr} => ${result ? "TRUE" : "FALSE"}`,
        {
          parentId,
          objectName: contextObj?.name,
          data: logData
        }
      );
      logger3.debug(`Condition: ${conditionExpr} => ${result}`);
      if (result) {
        if (item.thenAction) {
          const action = this.resolveAction(item.thenAction);
          logger3.debug(`Condition TRUE, executing thenAction: ${item.thenAction} `);
          if (action) await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
        }
        if (item.thenTask) {
          logger3.debug(`Condition TRUE, executing thenTask: ${item.thenTask} `);
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
      await TaskLoopHandler.handleWhile(item, vars, globalVars, contextObj, depth, parentId, this.executeBody.bind(this));
    }
    /**
     * FOR loop: Execute body for each value from 'from' to 'to'
     */
    async handleFor(item, vars, globalVars, contextObj, depth, parentId) {
      await TaskLoopHandler.handleFor(item, vars, globalVars, contextObj, depth, parentId, this.executeBody.bind(this));
    }
    /**
     * FOREACH loop: Execute body for each item in array
     */
    async handleForeach(item, vars, globalVars, contextObj, depth, parentId) {
      await TaskLoopHandler.handleForeach(item, vars, globalVars, contextObj, depth, parentId, this.executeBody.bind(this));
    }
    /**
     * Executes a data action and branches based on the result
     */
    async handleDataAction(item, vars, globalVars, contextObj, depth, parentId) {
      const action = this.resolveAction(item);
      if (!action) {
        logger3.warn(`DataAction definition not found: ${item.name || item.type}`);
        return false;
      }
      logger3.debug(`Executing DataAction: ${action.name || action.type}`);
      const result = await this.actionExecutor.execute(action, vars, globalVars, contextObj, parentId);
      const isSuccess = result !== false;
      logger3.debug(`DataAction "${action.name || action.type}" finished. Success: ${isSuccess}`);
      const body = isSuccess ? item.successBody : item.errorBody;
      if (body && Array.isArray(body)) {
        await this.executeBody(body, vars, globalVars, contextObj, depth, parentId);
      }
      return isSuccess;
    }
  };
  __publicField(_TaskExecutor, "MAX_DEPTH", 10);
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
  var _RuntimeVariableManager = class _RuntimeVariableManager {
    constructor(host, initialGlobalVars = {}) {
      this.host = host;
      __publicField(this, "projectVariables", {});
      __publicField(this, "stageVariables", {});
      __publicField(this, "contextVars");
      // Registry for ALL global variables from all stages (Key: Name AND Key: ID)
      __publicField(this, "globalDefinitions", /* @__PURE__ */ new Map());
      this.projectVariables = { ...initialGlobalVars };
      this.contextVars = this.createVariableContext();
    }
    initializeVariables(project) {
      if (project.stages) {
        project.stages.forEach((stage) => {
          if (stage.variables) {
            stage.variables.forEach((v) => {
              if (!v.scope || v.scope === "global") {
                this.globalDefinitions.set(v.name, v);
                if (v.id) this.globalDefinitions.set(v.id, v);
                const initialValue = v.defaultValue !== void 0 ? v.defaultValue : v.value;
                if (this.projectVariables[v.name] === void 0) {
                  this.projectVariables[v.name] = initialValue !== void 0 ? initialValue : 0;
                }
              }
            });
          }
        });
      }
      if (project.variables) {
        project.variables.forEach((v) => {
          this.globalDefinitions.set(v.name, v);
          if (v.id) this.globalDefinitions.set(v.id, v);
          this.importVariables([v], true);
        });
      }
      this.syncAllToReactive();
    }
    syncAllToReactive() {
      Object.keys(this.projectVariables).forEach((name) => {
        this.host.reactiveRuntime.setVariable(name, this.projectVariables[name]);
      });
      Object.keys(this.stageVariables).forEach((name) => {
        this.host.reactiveRuntime.setVariable(name, this.stageVariables[name]);
      });
    }
    initializeStageVariables(stage) {
      if (stage && stage.variables) {
        this.importVariables(stage.variables);
        this.syncAllToReactive();
      }
    }
    importVariables(vars, isFallback = false) {
      vars.forEach((v) => {
        const isGlobal = !v.scope || v.scope === "global";
        const initialValue = v.defaultValue !== void 0 ? v.defaultValue : v.value;
        if (isGlobal) {
          if (this.projectVariables[v.name] === void 0) {
            this.projectVariables[v.name] = initialValue !== void 0 ? initialValue : 0;
          } else if (!isFallback) {
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
            _RuntimeVariableManager.logger.warn(`Access denied: Variable '${prop}' in stage '${stage.name}' is private.`);
            return void 0;
          }
          if (this.host.stage && this.host.stage.id === stage.id) {
            return this.stageVariables[prop];
          }
          return variableDef.defaultValue;
        },
        set: () => {
          _RuntimeVariableManager.logger.warn(`Cannot set properties on Stage Proxy '${stage.name}'. Cross-stage writes are forbidden.`);
          return false;
        }
      });
    }
    createVariableContext() {
      return new Proxy({}, {
        get: (_target, prop) => {
          if (prop === "global") return this.projectVariables;
          if (prop === "stage") return this.stageVariables;
          if (prop in this.stageVariables) return this.stageVariables[prop];
          if (prop in this.projectVariables) return this.projectVariables[prop];
          return void 0;
        },
        set: (_target, prop, value) => {
          const oldValue = this.stageVariables[prop] !== void 0 ? this.stageVariables[prop] : this.projectVariables[prop];
          let varDef = this.host.stage?.variables?.find((v) => v.name === prop || v.id === prop);
          if (!varDef) {
            varDef = this.globalDefinitions.get(prop);
          }
          if (!varDef && prop.startsWith("var_")) {
            const cleanName = prop.substring(4);
            varDef = this.host.stage?.variables?.find((v) => v.name === cleanName);
            if (!varDef) {
              varDef = this.globalDefinitions.get(cleanName);
            }
          }
          let finalValue = value;
          if (varDef && varDef.isInteger && typeof value === "number") {
            finalValue = Math.floor(value);
          }
          const actualProp = varDef ? varDef.name : prop;
          if (actualProp in this.stageVariables) {
            this.stageVariables[actualProp] = finalValue;
          } else if (actualProp in this.projectVariables) {
            this.projectVariables[actualProp] = finalValue;
          } else {
            this.stageVariables[actualProp] = finalValue;
          }
          const component = this.host.objects?.find(
            (o) => varDef && o.id === varDef.id || o.name === prop && (o.isVariable || o.className?.includes("Variable"))
          );
          let componentUpdated = false;
          if (component) {
            if (component.data !== void 0 && Array.isArray(value)) {
              if (JSON.stringify(component.data) !== JSON.stringify(value)) {
                component.data = value;
                componentUpdated = true;
                _RuntimeVariableManager.logger.debug(`[Sync] ${prop} \u2192 component.data (${value.length} items)`);
              }
            } else if (component.items !== void 0 && Array.isArray(value)) {
              if (JSON.stringify(component.items) !== JSON.stringify(value)) {
                component.items = value;
                componentUpdated = true;
              }
            } else if (component.value !== value) {
              component.value = value;
              componentUpdated = true;
            }
          }
          if (!componentUpdated) {
            this.logVariableChange(prop, finalValue, oldValue, varDef);
          }
          const displayName = varDef ? varDef.name : prop;
          const finalStr = finalValue !== void 0 ? JSON.stringify(finalValue)?.substring(0, 200) || String(finalValue) : "undefined";
          const oldStr = oldValue !== void 0 ? JSON.stringify(oldValue)?.substring(0, 100) || String(oldValue) : "undefined";
          _RuntimeVariableManager.logger.info(`[Set] ${displayName} = ${finalStr} (Old: ${oldStr})`);
          this.host.reactiveRuntime.setVariable(actualProp, finalValue);
          if (this.host.taskExecutor) {
            if (varDef) {
              this.processVariableEvents(actualProp, finalValue, oldValue, varDef);
            }
          }
          return true;
        },
        ownKeys: () => {
          const keys = /* @__PURE__ */ new Set([
            "global",
            "stage",
            ...Object.keys(this.projectVariables),
            ...Object.keys(this.stageVariables)
          ]);
          return Array.from(keys);
        },
        has: (_target, prop) => {
          return prop === "global" || prop === "stage" || prop in this.stageVariables || prop in this.projectVariables;
        },
        getOwnPropertyDescriptor: (_target, prop) => {
          let val;
          if (prop === "global") val = this.projectVariables;
          else if (prop === "stage") val = this.stageVariables;
          else val = this.stageVariables[prop] !== void 0 ? this.stageVariables[prop] : this.projectVariables[prop];
          if (val !== void 0) {
            return { configurable: true, enumerable: true, value: val };
          }
          return void 0;
        }
      });
    }
    async processVariableEvents(prop, value, oldValue, varDef) {
      const executor = this.host.taskExecutor;
      if (!executor) return;
      if (oldValue !== value) {
        await this.executeVariableEvent(varDef, "onValueChanged");
      }
      if (value === "" || value === null || value === void 0) {
        await this.executeVariableEvent(varDef, "onValueEmpty");
      }
      if (typeof value === "number" && typeof oldValue === "number" && typeof varDef.threshold === "number") {
        const t = varDef.threshold;
        if (oldValue < t && value >= t) {
          await this.executeVariableEvent(varDef, "onThresholdReached");
        }
        if (oldValue >= t && value < t) {
          await this.executeVariableEvent(varDef, "onThresholdLeft");
        }
        if (oldValue <= t && value > t) {
          await this.executeVariableEvent(varDef, "onThresholdExceeded");
        }
      }
      if (varDef.triggerValue !== void 0 && varDef.triggerValue !== "" && varDef.triggerValue !== null) {
        const isTrigger = value == varDef.triggerValue;
        const wasTrigger = oldValue == varDef.triggerValue;
        if (isTrigger && !wasTrigger) {
          await this.executeVariableEvent(varDef, "onTriggerEnter");
        }
        if (!isTrigger && wasTrigger) {
          await this.executeVariableEvent(varDef, "onTriggerExit");
        }
      }
      if (typeof value === "number" && varDef.min !== void 0 && varDef.max !== void 0) {
        const min = Number(varDef.min);
        const max2 = Number(varDef.max);
        if (value <= min && (oldValue > min || oldValue === void 0)) {
          await this.executeVariableEvent(varDef, "onMinReached");
        }
        if (value >= max2 && (oldValue < max2 || oldValue === void 0)) {
          await this.executeVariableEvent(varDef, "onMaxReached");
        }
        const isInside = value > min && value < max2;
        const wasInside = oldValue > min && oldValue < max2;
        if (isInside && !wasInside) {
          await this.executeVariableEvent(varDef, "onInside");
        }
        if (!isInside && wasInside) {
          await this.executeVariableEvent(varDef, "onOutside");
        }
      }
      if (varDef.isRandom && oldValue !== value) {
        await this.executeVariableEvent(varDef, "onGenerated");
      }
      if (varDef.type === "list" && value !== oldValue) {
        await this.processListEvents(value, oldValue, varDef);
      }
      if (varDef.type === "timer" && typeof value === "number" && value > 0 && (oldValue === 0 || oldValue === void 0)) {
        this.host.startTimer(prop, varDef, value);
      }
    }
    /**
     * Helper to execute a variable event. 
     * Delegated to TaskExecutor using ComponentName.EventName notation.
     */
    async executeVariableEvent(varDef, eventName) {
      const executor = this.host.taskExecutor;
      if (!executor) return;
      const hasExplicitHandler = varDef.Tasks && varDef.Tasks[eventName];
      if (!hasExplicitHandler) {
        return;
      }
      const eventLogId = DebugLogService.getInstance().log("Event", `Triggered: ${varDef.name}.${eventName}`, {
        objectName: varDef.name,
        eventName
      });
      const taskName = `${varDef.name}.${eventName}`;
      await executor.execute(taskName, { sender: varDef }, this.contextVars, void 0, 0, eventLogId);
    }
    logVariableChange(id, value, oldValue, varDef) {
      if (value === oldValue) return;
      const displayName = varDef ? varDef.name : id;
      const displayValue = typeof value === "object" && value !== null ? JSON.stringify(value) : String(value);
      const displayOldValue = typeof oldValue === "object" && oldValue !== null ? JSON.stringify(oldValue) : String(oldValue);
      const message = `${displayName} := ${displayValue} (vorher: ${displayOldValue})`;
      DebugLogService.getInstance().log("Variable", message, {
        objectName: displayName,
        data: {
          type: "variable",
          variableName: displayName,
          value,
          oldValue
        }
      });
    }
    async processListEvents(value, oldValue, varDef) {
      const executor = this.host.taskExecutor;
      if (!executor) return;
      try {
        const list = Array.isArray(value) ? value : JSON.parse(value);
        const oldList = Array.isArray(oldValue) ? oldValue : oldValue ? JSON.parse(oldValue) : [];
        if (list.length > oldList.length) {
          await this.executeVariableEvent(varDef, "onItemAdded");
        }
        if (list.length < oldList.length) {
          await this.executeVariableEvent(varDef, "onItemRemoved");
        }
        if (varDef.searchValue) {
          const contains = list.includes(varDef.searchValue);
          const wasContains = oldList.includes(varDef.searchValue);
          if (contains && !wasContains) {
            await this.executeVariableEvent(varDef, "onContains");
          }
          if (!contains && wasContains) {
            await this.executeVariableEvent(varDef, "onNotContains");
          }
        }
      } catch (e) {
      }
    }
  };
  __publicField(_RuntimeVariableManager, "logger", Logger.get("RuntimeVariableManager", "Variable_Management"));
  var RuntimeVariableManager = _RuntimeVariableManager;

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
        { name: "visible", label: "Sichtbar", type: "boolean", group: "IDENTIT\xC4T" },
        { name: "x", label: "X", type: "number", group: "GEOMETRIE", inline: true },
        { name: "y", label: "Y", type: "number", group: "GEOMETRIE", inline: true },
        { name: "width", label: "Breite", type: "number", group: "GEOMETRIE", inline: true },
        { name: "height", label: "H\xF6he", type: "number", group: "GEOMETRIE", inline: true },
        { name: "zIndex", label: "Z-Index", type: "number", group: "GEOMETRIE", inline: true },
        { name: "align", label: "Ausrichtung", type: "select", group: "GEOMETRIE", options: ["NONE", "TOP", "BOTTOM", "LEFT", "RIGHT", "CLIENT"], inline: true },
        { name: "style.color", label: "Textfarbe", type: "color", group: "TYPOGRAFIE" },
        { name: "style.backgroundColor", label: "Hintergrund", type: "color", group: "STIL" },
        { name: "style.borderColor", label: "Rahmenfarbe", type: "color", group: "STIL" },
        { name: "style.borderWidth", label: "Rahmenbreite", type: "number", group: "STIL", min: 0, step: 1 },
        { name: "style.borderRadius", label: "Abrundung", type: "number", group: "STIL", min: 0, step: 1 },
        { name: "style.opacity", label: "Deckkraft", type: "number", group: "STIL", min: 0, max: 1, step: 0.1 }
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
        { name: "text", label: "Inhalt", type: "string", group: "INHALT" },
        { name: "style.fontSize", label: "Schriftgr\xF6\xDFe", type: "number", group: "TYPOGRAFIE" },
        { name: "style.fontWeight", label: "Fett", type: "boolean", group: "TYPOGRAFIE", inline: true },
        { name: "style.fontStyle", label: "Kursiv", type: "boolean", group: "TYPOGRAFIE", inline: true },
        { name: "style.textAlign", label: "Ausrichtung", type: "select", group: "TYPOGRAFIE", options: ["left", "center", "right"] },
        { name: "style.fontFamily", label: "Schriftart", type: "select", group: "TYPOGRAFIE", options: ["Arial", "Verdana", "Times New Roman", "Courier New", "Georgia", "Tahoma", "Trebuchet MS"] }
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
        { name: "icon", label: "Icon", type: "image_picker", group: "ICON" }
      ];
    }
  };

  // src/components/TPanel.ts
  var _TPanel = class _TPanel extends TWindow {
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
      _TPanel.logger.info(`set caption("${v}") - Renaming ${this.name} to ${v}`);
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
        { name: "caption", label: "Titel", type: "string", group: "IDENTIT\xC4T" },
        { name: "showGrid", label: "Gitter anzeigen", type: "boolean", group: "GITTER" },
        { name: "gridColor", label: "Gitterfarbe", type: "color", group: "GITTER" },
        { name: "gridStyle", label: "Gitterstil", type: "select", options: ["lines", "dots"], group: "GITTER" }
      ];
    }
  };
  __publicField(_TPanel, "logger", Logger.get("TPanel", "Component_Manipulation"));
  var TPanel = _TPanel;

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
        { name: "placeholder", label: "Platzhalter", type: "string", group: "EINGABE" },
        { name: "maxLength", label: "Max. L\xE4nge", type: "number", group: "EINGABE" }
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
      this.isService = true;
      this.isHiddenInRun = true;
      this.isBlueprintOnly = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      this.isService = true;
      this.isHiddenInRun = true;
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
        { name: "src", label: "Bildquelle", type: "image_picker", group: "BILD" },
        {
          name: "objectFit",
          label: "Skalierung",
          type: "select",
          group: "BILD",
          options: ["cover", "contain", "fill", "none"]
        },
        { name: "alt", label: "Alt-Text", type: "string", group: "BILD" },
        { name: "imageOpacity", label: "Bild-Deckkraft", type: "number", group: "BILD", min: 0, max: 1, step: 0.1 },
        { name: "fallbackColor", label: "Fallback-Farbe", type: "color", group: "BILD" }
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
        { name: "description", label: "Beschreibung", type: "string", group: "INFO" },
        { name: "cols", label: "Spalten", type: "number", group: "RASTER", inline: true },
        { name: "rows", label: "Zeilen", type: "number", group: "RASTER", inline: true },
        { name: "cellSize", label: "Zellengr\xF6\xDFe", type: "number", group: "RASTER", inline: true },
        { name: "snapToGrid", label: "Am Raster ausrichten", type: "boolean", group: "RASTER" },
        { name: "showGrid", label: "Raster sichtbar", type: "boolean", group: "RASTER" },
        // Background
        { name: "backgroundImage", label: "Hintergrundbild", type: "image_picker", group: "DARSTELLUNG" },
        { name: "objectFit", label: "Bild-Skalierung", type: "select", group: "DARSTELLUNG", options: ["cover", "contain", "fill", "none"] },
        // Start Animation
        { name: "startAnimation", label: "Start-Animation", type: "select", group: "ANIMATION", options: ["none", "UpLeft", "UpMiddle", "UpRight", "Left", "Right", "BottomLeft", "BottomMiddle", "BottomRight", "ChaosIn", "ChaosOut", "Matrix", "Random"] },
        { name: "startAnimationDuration", label: "Dauer (ms)", type: "number", group: "ANIMATION", inline: true },
        { name: "startAnimationEasing", label: "Easing", type: "select", group: "ANIMATION", options: ["linear", "easeIn", "easeOut", "easeInOut", "bounce", "elastic"], inline: true }
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
  var _TStageController = class _TStageController extends TWindow {
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
      this.isService = true;
      this.isHiddenInRun = true;
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
      _TStageController.logger.info(`Initialized with ${stages.length} stages. Starting at: ${this._currentStageId}`);
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
      _TStageController.logger.info(`Switching from ${oldStageId} to ${stageId}`);
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
      _TStageController.logger.debug(`Event triggered: ${eventName}`, data);
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
  __publicField(_TStageController, "logger", Logger.get("TStageController", "Stage_Management"));
  var TStageController = _TStageController;

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
          group: "FORM",
          options: ["circle", "rect", "square", "ellipse", "triangle", "arrow", "line"]
        },
        { name: "fillColor", label: "F\xFCllfarbe", type: "color", group: "FORM" },
        { name: "strokeColor", label: "Linienfarbe (Rand)", type: "color", group: "FORM" },
        { name: "strokeWidth", label: "Linienst\xE4rke", type: "number", group: "FORM" },
        { name: "opacity", label: "Deckkraft", type: "number", group: "FORM", min: 0, max: 1, step: 0.1 },
        // Content group
        { name: "text", label: "Text/Emoji", type: "string", group: "INHALT" },
        { name: "contentImage", label: "Bild-Inhalt", type: "image_picker", group: "INHALT" }
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
  var _TVariable = class _TVariable extends TWindow {
    constructor(name, x, y) {
      super(name, x, y, 6, 2);
      __publicField(this, "className", "TVariable");
      __publicField(this, "value");
      __publicField(this, "defaultValue");
      __publicField(this, "_type", "integer");
      __publicField(this, "objectModel", "");
      this.isVariable = true;
      this.style.backgroundColor = "#d1c4e9";
      this.style.borderColor = "#9575cd";
      this.style.borderWidth = 1;
      this.style.color = "#000000";
      this.isHiddenInRun = true;
    }
    get type() {
      return this._type;
    }
    set type(v) {
      if (this._type !== v) {
        _TVariable.logger.info(`type update: ${this._type} -> ${v} (Object: ${this.name}, ID: ${this.id})`);
        _TVariable.logger.debug(`Trace for type update ${this.name}`);
        this._type = v;
      } else {
        _TVariable.logger.debug(`type setter called with SAME value: ${v} (Object: ${this.name})`);
      }
    }
    // Alias for backward compatibility
    get variableType() {
      return this.type;
    }
    set variableType(v) {
      this.type = v;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const variableProps = [
        {
          name: "type",
          label: "Typ",
          type: "select",
          group: "Variable",
          options: ["integer", "real", "string", "boolean", "timer", "random", "list", "object", "object_list", "threshold", "trigger", "range", "keystore", "any", "json"],
          selectedValue: this.type,
          // Explicitly bind current value
          defaultValue: "integer"
        },
        { name: "defaultValue", label: "Standardwert", type: "string", group: "Variable" },
        { name: "value", label: "Aktueller Wert", type: "string", group: "Variable" }
      ];
      if (this.type === "object" || this.type === "object_list") {
        variableProps.splice(1, 0, {
          name: "objectModel",
          label: "Modell (Entit\xE4t)",
          type: "select",
          group: "Variable",
          source: "availableModels",
          // Will be populated by Discovery in InspectorHost
          placeholder: "Modell w\xE4hlen..."
        });
      }
      return [
        ...props,
        ...variableProps
      ];
    }
    getEvents() {
      return [
        ...super.getEvents(),
        "onValueChanged"
      ];
    }
    /**
     * Custom toJSON to ensure the 'type' getter is serialized as 'type'
     * instead of the private '_type' field. Without this, JSON.stringify
     * does not call prototype getters, causing type loss on reload.
     */
    toJSON() {
      const json = super.toJSON();
      json.type = this.type;
      json.objectModel = this.objectModel;
      _TVariable.logger.debug(`Serializing "${this.name}" (ID: ${this.id}):`, {
        className: this.className,
        type: json.type,
        scope: this.scope,
        events: !!json.events
      });
      return json;
    }
  };
  __publicField(_TVariable, "logger", Logger.get("TVariable", "Project_Validation"));
  var TVariable = _TVariable;

  // src/components/TTable.ts
  var TTable = class extends TWindow {
    constructor(name = "Table", x = 0, y = 0, width = 10, height = 8) {
      super(name, x, y, width, height);
      __publicField(this, "className", "TTable");
      __publicField(this, "data", []);
      // Daten-Basis (gebunden via RuntimeVariableManager)
      __publicField(this, "columns", []);
      // JSON-Konfiguration (TColumnDef[])
      __publicField(this, "selectedIndex", -1);
      __publicField(this, "rowHeight", 30);
      __publicField(this, "showHeader", true);
      __publicField(this, "striped", true);
      __publicField(this, "displayMode", "table");
      __publicField(this, "cardConfig", {
        width: 250,
        height: 100,
        gap: 10,
        padding: 10,
        borderRadius: 12,
        backgroundColor: "rgba(255, 255, 255, 0.05)",
        borderColor: "rgba(255, 255, 255, 0.1)",
        borderWidth: 1
      });
      this.style.backgroundColor = "#ffffff";
      this.style.color = "#333333";
      this.style.borderColor = "#bdc3c7";
      this.style.borderWidth = 1;
      this.style.borderRadius = 4;
      this.style.fontSize = 14;
    }
    getEvents() {
      return ["onSelect", "onDoubleClick", ...super.getEvents()];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "data", label: "Daten-Basis (JSON)", type: "json", group: "Tabelle", hint: "Wird oft zur Laufzeit \xFCberschrieben" },
        { name: "columns", label: "Spalten (JSON)", type: "json", group: "Tabelle", hint: '[{"field":"id", "label":"ID"}] - Leer lassen f\xFCr Auto-Columns' },
        { name: "displayMode", label: "Anzeige-Modus", type: "select", options: ["table", "cards"], group: "Tabelle" },
        { name: "cardConfig", label: "Karten-Design (JSON)", type: "json", group: "Tabelle", hint: 'Nur im Modus "cards" relevant' },
        { name: "rowHeight", label: "Zeilenh\xF6he (px)", type: "number", group: "Tabelle" },
        { name: "showHeader", label: "Kopfzeile zeigen", type: "boolean", group: "Tabelle" },
        { name: "striped", label: "Zebra-Streifen", type: "boolean", group: "Tabelle" }
      ];
    }
    getInspectorFile() {
      return "./inspector_table.json";
    }
    toJSON() {
      return {
        ...super.toJSON(),
        data: this.data,
        columns: this.columns,
        selectedIndex: this.selectedIndex,
        rowHeight: this.rowHeight,
        showHeader: this.showHeader,
        striped: this.striped,
        displayMode: this.displayMode,
        cardConfig: this.cardConfig
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

  // src/components/TEmojiPicker.ts
  var TEmojiPicker = class extends TPanel {
    constructor(name = "EmojiPicker", x = 0, y = 0) {
      super(name, x, y, 10, 5);
      __publicField(this, "emojis", ["\u{1F600}", "\u{1F60E}", "\u{1F680}", "\u2B50", "\u{1F308}", "\u{1F355}", "\u{1F3AE}", "\u{1F984}", "\u{1F388}", "\u{1F3A8}"]);
      __publicField(this, "columns", 5);
      __publicField(this, "itemSize", 2);
      // In Grid-Zellen
      __publicField(this, "selectedEmoji", "");
      this.style.backgroundColor = "rgba(255, 255, 255, 0.1)";
      this.style.borderColor = "rgba(255, 255, 255, 0.2)";
      this.style.borderWidth = 1;
      this.style.borderRadius = 12;
    }
    /**
     * Verfügbare Events für den Picker
     */
    getEvents() {
      return ["onSelect", "onClick", "onFocus", "onBlur"];
    }
    /**
     * Inspector-Eigenschaften
     */
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "columns", label: "Spalten", type: "number", group: "PICKER", defaultValue: 5 },
        { name: "itemSize", label: "Emoji-Gr\xF6\xDFe (Cells)", type: "number", group: "PICKER", defaultValue: 2 },
        { name: "emojis", label: "Emoji-Liste (JSON)", type: "json", group: "PICKER" },
        { name: "selectedEmoji", label: "Selektiertes Emoji", type: "string", group: "PICKER", readonly: true }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        emojis: this.emojis,
        columns: this.columns,
        itemSize: this.itemSize,
        selectedEmoji: this.selectedEmoji
      };
    }
  };

  // src/components/TStringVariable.ts
  var TStringVariable = class extends TVariable {
    constructor(name, x, y) {
      super(name, x, y);
      __publicField(this, "className", "TStringVariable");
      this.variableType = "string";
      this.defaultValue = "";
      this.value = "";
      this.caption = `\u{1F4DD} ${name}`;
    }
  };

  // src/components/TIntegerVariable.ts
  var TIntegerVariable = class extends TVariable {
    constructor(name, x, y) {
      super(name, x, y);
      __publicField(this, "className", "TIntegerVariable");
      this.variableType = "integer";
      this.defaultValue = 0;
      this.value = 0;
      this.caption = `\u{1F522} ${name}`;
    }
  };

  // src/components/TBooleanVariable.ts
  var TBooleanVariable = class extends TVariable {
    constructor(name, x, y) {
      super(name, x, y);
      __publicField(this, "className", "TBooleanVariable");
      this.variableType = "boolean";
      this.defaultValue = false;
      this.value = false;
      this.caption = `\u2696\uFE0F ${name}`;
    }
  };

  // src/components/TRealVariable.ts
  var TRealVariable = class extends TVariable {
    constructor(name, x, y) {
      super(name, x, y);
      __publicField(this, "className", "TRealVariable");
      this.variableType = "real";
      this.defaultValue = 0;
      this.value = 0;
      this.caption = `\u{1F4CF} ${name}`;
    }
  };

  // src/components/TObjectVariable.ts
  var TObjectVariable = class extends TVariable {
    constructor(name, x, y) {
      super(name, x, y);
      __publicField(this, "className", "TObjectVariable");
      this.type = "object";
      this.defaultValue = {};
      this.value = {};
      this.caption = `\u{1F4E6} ${name}`;
    }
  };

  // src/components/TNavBar.ts
  var TNavBar = class extends TPanel {
    constructor(name = "Sidebar", x = 0, y = 0) {
      super(name, x, y, 4, 30);
      __publicField(this, "navItems", [
        { id: "dashboard", label: "Dashboard", icon: "\u{1F4CA}", targetStage: "stage_main" },
        { id: "users", label: "Benutzer", icon: "\u{1F465}", targetStage: "stage_user_admin" },
        { id: "settings", label: "Einstellungen", icon: "\u2699\uFE0F", targetStage: "stage_settings" }
      ]);
      __publicField(this, "activeId", "dashboard");
      __publicField(this, "collapsed", false);
      this.align = "LEFT";
      this.style.backgroundColor = "#2c3e50";
      this.style.borderColor = "#34495e";
      this.style.borderWidth = 0;
      this.style.borderRadius = 0;
      this.style.color = "#ecf0f1";
    }
    getEvents() {
      return ["onSelect", "onCollapse", "onExpand", ...super.getEvents()];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const filtered = props.filter((p) => !p.name.startsWith("grid"));
      return [
        ...filtered,
        { name: "navItems", label: "Men\xFC-Items (JSON)", type: "json", group: "NAVIGATION" },
        { name: "activeId", label: "Aktive ID", type: "string", group: "NAVIGATION" },
        { name: "collapsed", label: "Eingeklappt", type: "boolean", group: "NAVIGATION", defaultValue: false }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        navItems: this.navItems,
        activeId: this.activeId,
        collapsed: this.collapsed
      };
    }
  };

  // src/components/TCard.ts
  var TCard = class extends TPanel {
    constructor(name = "Card", x = 0, y = 0) {
      super(name, x, y, 8, 10);
      __publicField(this, "title", "Card Titel");
      __publicField(this, "subtitle", "Subtitel");
      __publicField(this, "showHeader", true);
      __publicField(this, "showFooter", false);
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "rgba(0,0,0,0.05)";
      this.style.borderWidth = 1;
      this.style.borderRadius = 12;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const filtered = props.filter((p) => !p.name.startsWith("grid"));
      return [
        ...filtered,
        { name: "title", label: "Titel", type: "string", group: "CARD" },
        { name: "subtitle", label: "Subtitel", type: "string", group: "CARD" },
        { name: "showHeader", label: "Header anzeigen", type: "boolean", group: "CARD", defaultValue: true },
        { name: "showFooter", label: "Footer anzeigen", type: "boolean", group: "CARD", defaultValue: false }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        title: this.title,
        subtitle: this.subtitle,
        showHeader: this.showHeader,
        showFooter: this.showFooter
      };
    }
  };

  // src/components/TList.ts
  var TList = class extends TWindow {
    // In Grid-Zellen
    constructor(name = "List", x = 0, y = 0) {
      super(name, x, y, 10, 12);
      __publicField(this, "items", []);
      __publicField(this, "displayField", "");
      // Falls Objekte in der Liste sind
      __publicField(this, "selectedIndex", -1);
      __publicField(this, "itemHeight", 1.5);
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#bdc3c7";
      this.style.borderWidth = 1;
      this.style.borderRadius = 4;
      this.style.fontSize = 14;
    }
    getEvents() {
      return ["onSelect", "onDoubleClick", ...super.getEvents()];
    }
    getInspectorProperties() {
      return [
        ...super.getInspectorProperties(),
        { name: "items", label: "Items (JSON)", type: "json", group: "LISTE" },
        { name: "displayField", label: "Anzeige-Feld", type: "string", group: "LISTE", hint: "Property-Name f\xFCr Objekt-Anzeige" },
        { name: "itemHeight", label: "Zeilenh\xF6he (Cells)", type: "number", group: "LISTE", defaultValue: 1.5 },
        { name: "selectedIndex", label: "Gew\xE4hlter Index", type: "number", group: "LISTE", readonly: true }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        items: this.items,
        displayField: this.displayField,
        selectedIndex: this.selectedIndex,
        itemHeight: this.itemHeight
      };
    }
  };

  // src/components/TDataStore.ts
  var _TDataStore = class _TDataStore extends TPanel {
    constructor(name = "DataStore", x = 0, y = 0) {
      super(name, x, y, 6, 4);
      __publicField(this, "storagePath", "data.json");
      __publicField(this, "defaultCollection", "items");
      // Explicitly decouple caption from name prevents runtime renaming issues
      __publicField(this, "_caption", "\u{1F5C4}\uFE0F Database");
      // Runtime-Callback für Events (z.B. onDataChanged)
      __publicField(this, "eventCallback", null);
      _TDataStore.dsLogger.info(`Constructor: name=${this.name} (arg=${name})`);
      this.style.backgroundColor = "#2c3e50";
      this.style.borderColor = "#bdc3c7";
      this.style.borderWidth = 2;
      this.style.borderRadius = 8;
      this.isService = true;
      this.isHiddenInRun = true;
    }
    get caption() {
      return this._caption;
    }
    set caption(v) {
      _TDataStore.dsLogger.info(`set caption("${v}") - Current name: ${this.name}`);
      this._caption = v;
      if (this.name !== "UserData" && this.name !== "DataStore" && this.name !== "LocalStore") {
        _TDataStore.dsLogger.warn(`Warning: name has changed to ${this.name}!`);
      }
    }
    /**
     * Verfügbare Events
     */
    getEvents() {
      return ["onDataChanged", "onSave", "onDelete", "onError"];
    }
    /**
     * Runtime-Initialisierung
     */
    initRuntime(callbacks) {
      this.eventCallback = (ev, data) => callbacks.handleEvent(this.id, ev, data);
    }
    /**
     * Hilfsmethode zum Feuern von Events
     */
    triggerEvent(eventName, data) {
      if (this.eventCallback) {
        this.eventCallback(eventName, data);
      }
    }
    /**
     * Inspector-Eigenschaften
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      const filtered = baseProps.filter((p) => !["showGrid", "gridColor", "caption"].includes(p.name));
      return [
        ...filtered,
        { name: "caption", label: "Titel", type: "string", group: "IDENTIT\xC4T" },
        { name: "storagePath", label: "Datei-Pfad", type: "string", group: "DATABASE", defaultValue: "data.json" },
        { name: "defaultCollection", label: "Standard-Collection", type: "string", group: "DATABASE", defaultValue: "items" }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        storagePath: this.storagePath,
        defaultCollection: this.defaultCollection
      };
    }
  };
  __publicField(_TDataStore, "dsLogger", Logger.get("TDataStore", "Project_Validation"));
  var TDataStore = _TDataStore;

  // src/components/TBadge.ts
  var TBadge = class extends TWindow {
    constructor(name = "Badge", x = 0, y = 0) {
      super(name, x, y, 3, 1);
      __publicField(this, "badgeType", "info");
      __publicField(this, "pill", false);
      this.style.borderRadius = 4;
      this.style.borderWidth = 0;
      this.style.fontSize = 12;
      this.style.fontWeight = "bold";
      this.style.textAlign = "center";
      this.style.color = "#ffffff";
      this.updateStyle();
    }
    /**
     * Aktualisiert die Farben basierend auf dem Typ
     */
    updateStyle() {
      switch (this.badgeType) {
        case "success":
          this.style.backgroundColor = "#2ecc71";
          break;
        case "warning":
          this.style.backgroundColor = "#f1c40f";
          break;
        case "error":
          this.style.backgroundColor = "#e74c3c";
          break;
        case "primary":
          this.style.backgroundColor = "#3498db";
          break;
        case "secondary":
          this.style.backgroundColor = "#95a5a6";
          break;
        default:
          this.style.backgroundColor = "#34495e";
          break;
      }
      if (this.pill) {
        this.style.borderRadius = 15;
      } else {
        this.style.borderRadius = 4;
      }
    }
    getInspectorProperties() {
      return [
        ...super.getInspectorProperties(),
        {
          name: "badgeType",
          label: "Typ",
          type: "select",
          group: "BADGE",
          options: ["info", "success", "warning", "error", "primary", "secondary"],
          defaultValue: "info"
        },
        { name: "pill", label: "Pill-Style", type: "boolean", group: "BADGE", defaultValue: false }
      ];
    }
    toJSON() {
      this.updateStyle();
      return {
        ...super.toJSON(),
        badgeType: this.badgeType,
        pill: this.pill
      };
    }
  };

  // src/components/TAvatar.ts
  var TAvatar = class extends TWindow {
    constructor(name = "Avatar", x = 0, y = 0) {
      super(name, x, y, 2, 2);
      __publicField(this, "src", "");
      __publicField(this, "status", "none");
      __publicField(this, "shape", "circle");
      this.style.backgroundColor = "#ecf0f1";
      this.style.borderRadius = 100;
      this.style.borderColor = "#bdc3c7";
      this.style.borderWidth = 1;
      this.updateStyle();
    }
    updateStyle() {
      this.style.borderRadius = this.shape === "circle" ? 100 : 8;
    }
    getInspectorProperties() {
      return [
        ...super.getInspectorProperties(),
        { name: "src", label: "Bild-URL / Icon", type: "image_picker", group: "AVATAR" },
        {
          name: "status",
          label: "Status",
          type: "select",
          group: "AVATAR",
          options: ["none", "online", "offline", "busy"],
          defaultValue: "none"
        },
        {
          name: "shape",
          label: "Form",
          type: "select",
          group: "AVATAR",
          options: ["circle", "square"],
          defaultValue: "circle"
        }
      ];
    }
    toJSON() {
      this.updateStyle();
      return {
        ...super.toJSON(),
        src: this.src,
        status: this.status,
        shape: this.shape
      };
    }
  };

  // src/components/TTabBar.ts
  var TTabBar = class extends TPanel {
    constructor(name = "TabBar", x = 0, y = 0) {
      super(name, x, y, 20, 2);
      __publicField(this, "tabs", [
        { label: "\xDCbersicht", icon: "\u{1F3E0}" },
        { label: "Details", icon: "\u{1F4DD}" },
        { label: "Historie", icon: "\u{1F4DC}" }
      ]);
      __publicField(this, "activeTabIndex", 0);
      this.style.backgroundColor = "#ffffff";
      this.style.borderColor = "#bdc3c7";
      this.style.borderWidth = 0;
      this.style.borderRadius = 0;
      this.style.fontSize = 14;
    }
    getEvents() {
      return ["onChange", ...super.getEvents()];
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      const filtered = props.filter((p) => !p.name.startsWith("grid"));
      return [
        ...filtered,
        { name: "tabs", label: "Tabs (JSON)", type: "json", group: "TABS" },
        { name: "activeTabIndex", label: "Aktiver Tab (Index)", type: "number", group: "TABS", defaultValue: 0 }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        tabs: this.tabs,
        activeTabIndex: this.activeTabIndex
      };
    }
  };

  // src/components/TAuthService.ts
  var TAuthService = class extends TComponent {
    // in Sekunden
    constructor(name = "AuthService") {
      super(name);
      __publicField(this, "secret", "gcs-super-secret");
      __publicField(this, "tokenExpiration", 3600);
      this.isVariable = true;
    }
    /**
     * Verfügbare Events für den Service
     */
    getEvents() {
      return ["onLoginSuccess", "onLoginFailure", "onTokenVerified", "onTokenInvalid"];
    }
    /**
     * Inspector-Eigenschaften
     */
    getInspectorProperties() {
      return [
        ...this.getBaseProperties(),
        { name: "secret", label: "JWT Secret", type: "string", group: "AUTH-CONFIG" },
        { name: "tokenExpiration", label: "Token Ablauf (Sek.)", type: "number", group: "AUTH-CONFIG", defaultValue: 3600 }
      ];
    }
    /**
     * Erstellt einen simulierten JWT Token
     */
    createToken(payload) {
      const header = btoa(JSON.stringify({ alg: "HS256", typ: "JWT" }));
      const data = btoa(JSON.stringify({
        ...payload,
        exp: Math.floor(Date.now() / 1e3) + this.tokenExpiration
      }));
      const signature = btoa(this.secret).substring(0, 10);
      return `${header}.${data}.${signature}`;
    }
    /**
     * Validiert einen simulierten JWT Token
     */
    verifyToken(token) {
      try {
        const parts = token.split(".");
        if (parts.length !== 3) return null;
        const payload = JSON.parse(atob(parts[1]));
        if (payload.exp < Date.now() / 1e3) {
          console.warn("[TAuthService] Token abgelaufen");
          return null;
        }
        return payload;
      } catch (e) {
        console.error("[TAuthService] Token Validierung fehlgeschlagen", e);
        return null;
      }
    }
    toJSON() {
      return {
        ...super.toJSON(),
        secret: this.secret,
        tokenExpiration: this.tokenExpiration
      };
    }
  };

  // src/components/TUserManager.ts
  var TUserManager = class extends TComponent {
    constructor(name = "UserManager") {
      super(name);
      __publicField(this, "userCollection", "users");
      __publicField(this, "hashPasswords", true);
      this.isVariable = true;
    }
    /**
     * Verfügbare Events
     */
    getEvents() {
      return ["onUserCreated", "onUserUpdated", "onUserDeleted", "onAuthFailed"];
    }
    /**
     * Inspector-Eigenschaften
     */
    getInspectorProperties() {
      return [
        ...this.getBaseProperties(),
        { name: "userCollection", label: "DB Collection", type: "string", group: "USER-CONFIG", defaultValue: "users" },
        { name: "hashPasswords", label: "Passw\xF6rter hashen", type: "boolean", group: "USER-CONFIG", defaultValue: true }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        userCollection: this.userCollection,
        hashPasswords: this.hashPasswords
      };
    }
  };

  // src/components/TAPIServer.ts
  var TAPIServer = class extends TPanel {
    constructor(name = "APIServer", x = 0, y = 0) {
      super(name, x, y, 6, 4);
      __publicField(this, "port", 3e3);
      __publicField(this, "baseUrl", "/api");
      __publicField(this, "cors", true);
      __publicField(this, "active", true);
      // Tester-Properties (nur für Editor/Simulation)
      __publicField(this, "testMethod", "GET");
      __publicField(this, "testPath", "/");
      __publicField(this, "testBody", "{}");
      __publicField(this, "testResponse", "");
      // Runtime-Callback
      __publicField(this, "eventCallback", null);
      this.style.backgroundColor = "#1a1a2e";
      this.style.borderColor = "#4fc3f7";
      this.style.borderWidth = 2;
      this.style.borderRadius = 8;
      this.caption = "\u{1F5A5}\uFE0F API Server";
      this.isService = true;
      this.isHiddenInRun = true;
    }
    /**
     * Verfügbare Events für den Server
     */
    getEvents() {
      return ["onRequest", "onStart", "onStop", "onError"];
    }
    /**
     * Simuliert einen API-Request (für den Editor-Tester)
     */
    simulateRequest() {
      const requestId = "sim-" + Math.floor(Math.random() * 1e6);
      let body = {};
      try {
        if (this.testBody) body = JSON.parse(this.testBody);
      } catch (e) {
        console.error("[TAPIServer] Invalid JSON in testBody");
      }
      console.log(`[TAPIServer] Simuliere Request: ${this.testMethod} ${this.testPath}`, body);
      this.testResponse = "Warte auf Antwort...";
      this.triggerEvent("onRequest", {
        method: this.testMethod,
        path: this.testPath,
        body,
        requestId,
        isSimulation: true
      });
    }
    /**
     * Runtime-Initialisierung
     */
    initRuntime(callbacks) {
      this.eventCallback = (ev, data) => callbacks.handleEvent(this.id, ev, data);
    }
    /**
     * Hilfsmethode zum Feuern von Events
     */
    triggerEvent(eventName, data) {
      if (this.eventCallback) {
        this.eventCallback(eventName, data);
      } else {
        console.warn(`[TAPIServer] Event ${eventName} gefeuert, aber kein Runtime-Callback registriert.`);
      }
    }
    /**
     * Inspector-Eigenschaften für den Server
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      const filtered = baseProps.filter((p) => !["showGrid", "gridColor", "caption"].includes(p.name));
      return [
        ...filtered,
        { name: "caption", label: "Titel", type: "string", group: "IDENTIT\xC4T" },
        { name: "port", label: "Netzwerk-Port", type: "number", group: "SERVER", defaultValue: 3e3 },
        { name: "baseUrl", label: "Basis-URL", type: "string", group: "SERVER", defaultValue: "/api" },
        { name: "cors", label: "CORS erlauben", type: "boolean", group: "SERVER", defaultValue: true },
        { name: "active", label: "Server Aktiv", type: "boolean", group: "SERVER", defaultValue: true },
        // TESTER GROUP
        { name: "testMethod", label: "Methode", type: "select", group: "API TESTER", options: ["GET", "POST", "PUT", "DELETE", "PATCH"], defaultValue: "GET" },
        { name: "testPath", label: "Relative Path", type: "string", group: "API TESTER", defaultValue: "/" },
        { name: "testBody", label: "Request Body (JSON)", type: "json", group: "API TESTER", defaultValue: "{}" },
        {
          name: "testApiBtn",
          label: "\u{1F680} Request Senden",
          type: "button",
          group: "API TESTER",
          action: "testApi",
          style: { backgroundColor: "#4caf50", color: "#fff", marginTop: 12, fontWeight: "bold" }
        },
        { name: "testResponse", label: "Response", type: "string", group: "API TESTER", readonly: true }
      ];
    }
    toJSON() {
      return {
        ...super.toJSON(),
        port: this.port,
        baseUrl: this.baseUrl,
        cors: this.cors,
        active: this.active,
        testMethod: this.testMethod,
        testPath: this.testPath,
        testBody: this.testBody
      };
    }
  };

  // src/components/TDataList.ts
  var _TDataList = class _TDataList extends TPanel {
    constructor(name = "DataList", x = 0, y = 0, width = 200, height = 300) {
      super(name, x, y, width, height);
      // Name der DataAction, von der Daten bezogen werden
      __publicField(this, "dataAction", "");
      this.style.backgroundColor = "#1e1e1e";
      this.style.borderColor = "#4da6ff";
      this.style.borderWidth = 2;
      this.style.overflow = "auto";
      _TDataList.listLogger.info(`TDataList Constructor: name=${this.name}`);
    }
    /**
     * Erweitert die Inspector-Eigenschaften um die dataSource
     */
    getInspectorProperties() {
      const baseProps = super.getInspectorProperties();
      return [
        ...baseProps,
        {
          name: "dataAction",
          label: "Datenquelle (DataAction)",
          type: "select",
          source: "dataActions",
          group: "DATENBINDUNG",
          hint: "Name der DataAction"
        }
      ];
    }
    /**
     * Bereitet die Serialisierung für project.json vor
     */
    toJSON() {
      return {
        ...super.toJSON(),
        dataAction: this.dataAction
      };
    }
    // --- IRuntimeComponent Implementation ---
    initRuntime(_callbacks) {
      _TDataList.listLogger.info(`TDataList initRuntime: dataAction=${this.dataAction}`);
    }
  };
  __publicField(_TDataList, "listLogger", Logger.get("TDataList", "Component_Manipulation"));
  var TDataList = _TDataList;

  // src/utils/Serialization.ts
  var logger4 = Logger.get("Serialization", "Project_Save_Load");
  function hydrateObjects(objectsData) {
    const objects = [];
    objectsData.forEach((objData) => {
      if (!objData) return;
      if (objData.className && typeof objData.clone === "function" && objData.constructor.name !== "Object") {
        objects.push(objData);
        return;
      }
      const internalContainers = ["TDataList", "TTable", "TObjectList", "TEmojiPicker"];
      const isInternal = internalContainers.includes(objData.className);
      let newObj = null;
      if (newObj) newObj.isInternalContainer = isInternal;
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
        case "TEmojiPicker":
          newObj = new TEmojiPicker(objData.name, objData.x, objData.y);
          break;
        case "TStringVariable":
          newObj = new TStringVariable(objData.name, objData.x, objData.y);
          break;
        case "TIntegerVariable":
          newObj = new TIntegerVariable(objData.name, objData.x, objData.y);
          break;
        case "TBooleanVariable":
          newObj = new TBooleanVariable(objData.name, objData.x, objData.y);
          break;
        case "TRealVariable":
          newObj = new TRealVariable(objData.name, objData.x, objData.y);
          break;
        case "TObjectVariable":
          newObj = new TObjectVariable(objData.name, objData.x, objData.y);
          break;
        case "TNavBar":
          newObj = new TNavBar(objData.name, objData.x, objData.y);
          break;
        case "TCard":
          newObj = new TCard(objData.name, objData.x, objData.y);
          break;
        case "TList":
          newObj = new TList(objData.name, objData.x, objData.y);
          break;
        case "TDataStore":
          newObj = new TDataStore(objData.name, objData.x, objData.y);
          if (objData.storagePath) newObj.storagePath = objData.storagePath;
          if (objData.defaultCollection) newObj.defaultCollection = objData.defaultCollection;
          break;
        case "TBadge":
          newObj = new TBadge(objData.name, objData.x, objData.y);
          break;
        case "TAvatar":
          newObj = new TAvatar(objData.name, objData.x, objData.y);
          break;
        case "TTabBar":
          newObj = new TTabBar(objData.name, objData.x, objData.y);
          break;
        case "TAuthService":
          newObj = new TAuthService(objData.name);
          break;
        case "TUserManager":
          newObj = new TUserManager(objData.name);
          break;
        case "TAPIServer":
          newObj = new TAPIServer(objData.name, objData.x, objData.y);
          break;
        case "TTextControl":
          newObj = new TTextControl(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TTable":
          newObj = new TTable(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        case "TDataList":
          newObj = new TDataList(objData.name, objData.x, objData.y, objData.width, objData.height);
          break;
        default:
          logger4.warn("Unknown class during load:", objData.className);
          break;
      }
      if (newObj) {
        newObj.id = objData.id;
        newObj.className = objData.className;
        newObj.scope = objData.scope || "stage";
        if (objData.isVariable !== void 0) newObj.isVariable = objData.isVariable;
        if (objData.width !== void 0) newObj.width = objData.width;
        if (objData.height !== void 0) newObj.height = objData.height;
        if (objData.x !== void 0) newObj.x = objData.x;
        if (objData.y !== void 0) newObj.y = objData.y;
        if (objData.visible !== void 0) newObj.visible = objData.visible;
        if (objData.zIndex !== void 0) newObj.zIndex = objData.zIndex;
        if (objData.draggable !== void 0) newObj.draggable = objData.draggable;
        if (objData.dragMode !== void 0) newObj.dragMode = objData.dragMode;
        if (objData.droppable !== void 0) newObj.droppable = objData.droppable;
        if (objData.style && newObj.style) {
          Object.assign(newObj.style, objData.style);
        }
        if (objData.caption !== void 0) {
          if (newObj.constructor.name === "TDataStore") {
            logger4.debug(`Assigning caption "${objData.caption}" to TDataStore "${objData.name}"`);
          }
          newObj.caption = objData.caption;
        }
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
          "_type",
          // Private backing field - must go through 'type' setter instead
          "currentStageId"
          // Read-only property on TStageController
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
            if (newObj.isVariable && key === "type") {
              logger4.debug(`SETTING type via generic loop for "${newObj.name}":`, val);
            }
          }
        });
        if (newObj.isVariable) {
          if (objData.value !== void 0) newObj.value = objData.value;
          if (objData.type !== void 0) {
            logger4.debug(`RESTORING type via explicit setter for "${newObj.name}":`, objData.type);
            newObj.type = objData.type;
          } else {
            logger4.warn(`No type found in JSON for variable "${newObj.name}", falling back to constructor default:`, newObj.type);
          }
        }
        if (objData.style) {
          const targetStyle = newObj.style || {};
          Object.assign(targetStyle, objData.style);
          newObj.style = targetStyle;
        }
        newObj.events = objData.events || objData.Tasks || {};
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
      // Manager instance
      // Cache für globale Objekte, damit deren State bei Stage-Wechseln erhalten bleibt
      __publicField(this, "cachedGlobalObjects", null);
      __publicField(this, "project");
      this.project = project;
    }
    getMergedStageData(stageId) {
      const stage = this.project.stages?.find((s) => s.id === stageId);
      const stageChain = stage ? [stage] : [];
      let mergedObjects = [];
      let mergedTasks = [...this.project.tasks || []];
      let mergedActions = [...this.project.actions || []];
      let mergedFlowCharts = { ...this.project.flowCharts || {} };
      const objectIdSet = /* @__PURE__ */ new Set();
      const processStage = (stage2, useCache = false) => {
        if (useCache) {
          if (!this.cachedGlobalObjects) {
            this.cachedGlobalObjects = [];
            const sObjects = hydrateObjects(stage2.objects || []);
            const sVars = hydrateObjects(stage2.variables || []);
            sVars.forEach((v) => v.isVariable = true);
            this.cachedGlobalObjects.push(...sObjects, ...sVars);
          }
          this.cachedGlobalObjects.forEach((obj) => {
            mergedObjects = mergedObjects.filter((o) => o.id !== obj.id);
            mergedObjects.push(obj);
            objectIdSet.add(obj.id);
          });
        } else {
          const stageObjects = hydrateObjects(stage2.objects || []);
          stageObjects.forEach((obj) => {
            mergedObjects = mergedObjects.filter((o) => o.id !== obj.id);
            mergedObjects.push(obj);
            objectIdSet.add(obj.id);
          });
          if (stage2.variables) {
            const hydratedVars = hydrateObjects(stage2.variables);
            hydratedVars.forEach((vObj) => {
              vObj.isVariable = true;
              mergedObjects = mergedObjects.filter((o) => o.id !== vObj.id);
              mergedObjects.push(vObj);
              objectIdSet.add(vObj.id);
            });
          }
        }
        if (stage2.tasks) {
          stage2.tasks.forEach((t) => {
            mergedTasks = mergedTasks.filter((existing) => existing.name !== t.name);
            mergedTasks.push(t);
          });
        }
        if (stage2.actions) {
          stage2.actions.forEach((a) => {
            mergedActions = mergedActions.filter((existing) => existing.name !== a.name);
            mergedActions.push(a);
          });
        }
        if (stage2.flowCharts) {
          Object.assign(mergedFlowCharts, stage2.flowCharts);
        }
      };
      const targetIsBlueprint = this.project.stages?.find((s) => s.id === stageId)?.type === "blueprint";
      const blueprintStages = this.project.stages?.filter((s) => s.type === "blueprint") || [];
      blueprintStages.forEach((bs) => {
        const preCount = mergedObjects.length;
        processStage(bs, true);
        const postCount = mergedObjects.length;
        if (!targetIsBlueprint) {
          for (let i = preCount; i < postCount; i++) {
            if (mergedObjects[i]) {
              mergedObjects[i].isInherited = true;
              mergedObjects[i].isFromBlueprint = true;
            }
          }
        }
      });
      stageChain.forEach((s) => {
        if (s.type !== "blueprint") processStage(s, false);
      });
      const activeStage = stageChain[stageChain.length - 1];
      if (activeStage && activeStage.type !== "splash" && activeStage.type !== "main") {
        const mainStage = this.project.stages?.find((s) => s.type === "main");
        if (mainStage) {
          processStage(mainStage, true);
        }
      }
      return {
        objects: mergedObjects,
        tasks: mergedTasks,
        actions: mergedActions,
        flowCharts: mergedFlowCharts,
        grid: activeStage?.grid || blueprintStages[0]?.grid,
        backgroundColor: activeStage?.grid?.backgroundColor || blueprintStages[0]?.grid?.backgroundColor,
        backgroundImage: activeStage?.backgroundImage || blueprintStages[0]?.backgroundImage
      };
    }
  };

  // src/runtime/GameRuntime.ts
  var logger5 = Logger.get("GameRuntime", "Runtime_Execution");
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
        if (merged.grid) activeStage.grid = { ...activeStage.grid, ...merged.grid };
        if (merged.backgroundColor) {
          if (!activeStage.grid) activeStage.grid = {};
          activeStage.grid.backgroundColor = merged.backgroundColor;
        }
        if (merged.backgroundImage) activeStage.backgroundImage = merged.backgroundImage;
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
    /**
     * Aktualisiert die Projektdaten zur Laufzeit (Live Sync)
     */
    updateRuntimeData(project) {
      this.project = project;
      if (this.taskExecutor) {
        logger5.info("Updating runtime data (FlowCharts, Actions, Tasks)");
        const stageId = this.stage?.id || this.project.activeStageId;
        const merged = this.stageManager.getMergedStageData(stageId);
        this.taskExecutor.setFlowCharts(merged.flowCharts);
        this.taskExecutor.setActions(merged.actions);
        this.taskExecutor.setTasks(merged.tasks || []);
        this.objects.forEach((obj) => {
          const projectObj = merged.objects.find((po) => po.id === obj.id);
          if (projectObj) {
            if (projectObj.style) {
              obj.style = { ...obj.style || {}, ...projectObj.style };
            }
            if (projectObj.caption !== void 0) obj.caption = projectObj.caption;
            if (projectObj.text !== void 0 && !obj.isVariable) obj.text = projectObj.text;
            if (projectObj.x !== void 0) obj.x = projectObj.x;
            if (projectObj.y !== void 0) obj.y = projectObj.y;
            if (projectObj.width !== void 0) obj.width = projectObj.width;
            if (projectObj.height !== void 0) obj.height = projectObj.height;
            if (projectObj.visible !== void 0) obj.visible = projectObj.visible;
            if (projectObj.opacity !== void 0) obj.opacity = projectObj.opacity;
          }
        });
        if (this.options.onRender) this.options.onRender();
      }
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
      if (!this.stageController) {
        logger5.info("No TStageController found in project. Creating virtual controller for navigation support.");
        this.stageController = new TStageController("VirtualStageController", 0, 0);
        this.stageController.isTransient = true;
        this.objects.push(this.stageController);
      }
      if (this.stageController && this.project.stages) {
        this.stageController.setStages(this.project.stages);
        this.stageController.setOnStageChangeCallback((oldId, newId) => this.handleStageChange(oldId, newId));
      }
    }
    switchToStage(stageId) {
      const currentId = this.stage ? this.stage.id : "";
      if (currentId !== stageId) {
        this.handleStageChange(currentId, stageId);
      }
    }
    handleStageChange(_oldStageId, newStageId) {
      if (this.stage && this.taskExecutor) {
        const onLeaveTask = (this.stage.events || this.stage.Tasks)?.onLeave;
        if (onLeaveTask) {
          logger5.info(`Triggering onLeave for stage: ${this.stage.id} (Task: ${onLeaveTask})`);
          try {
            this.taskExecutor.execute(onLeaveTask, { sender: this.stage }, this.contextVars, this.stage);
          } catch (e) {
            logger5.error(`Error executing onLeave for stage ${this.stage.id}:`, e);
          }
        }
      }
      this.stage = this.project.stages?.find((s) => s.id === newStageId);
      if (!this.stage) return;
      const merged = this.stageManager.getMergedStageData(newStageId);
      this.objects = merged.objects;
      if (this.taskExecutor) {
        this.taskExecutor.setFlowCharts(merged.flowCharts);
        this.taskExecutor.setTasks(merged.tasks);
        this.taskExecutor.setActions(merged.actions);
      }
      logger5.info(`--- STAGE CHANGE: ${newStageId} ---`);
      logger5.debug(`Global Vars BEFORE reactive clear:`, this.reactiveRuntime.getContext());
      if (this.options.makeReactive) {
        this.reactiveRuntime.clear(false);
        this.clearAllTimers();
        AnimationManager.getInstance().clear();
        logger5.debug(`Global Vars AFTER reactive clear:`, this.reactiveRuntime.getContext());
        this.objects.forEach((obj) => this.reactiveRuntime.registerObject(obj.name, obj, true));
        this.reactiveRuntime.setVariable("isSplashActive", false);
        if (this.options.onRender) {
          this.reactiveRuntime.getWatcher().addGlobalListener(() => this.options.onRender());
        }
        this.objects = this.reactiveRuntime.getObjects();
        this.initializeReactiveBindings();
        logger5.debug(`Global Vars AFTER initializeReactiveBindings:`, this.reactiveRuntime.getContext());
      }
      if (this.actionExecutor) {
        this.actionExecutor.setObjects(this.objects);
      }
      this.variableManager.stageVariables = {};
      this.variableManager.initializeStageVariables(this.stage);
      this.syncVariableComponents();
      this.actionExecutor.setObjects(this.objects);
      this.initStageController();
      this.start();
      if (this.stage && this.taskExecutor) {
        const onEnterTask = (this.stage.events || this.stage.Tasks)?.onEnter;
        if (onEnterTask) {
          logger5.debug(`Triggering onEnter for stage: ${this.stage.id} (Task: ${onEnterTask})`);
          const enterLogId = DebugLogService.getInstance().log("Event", `Triggered: ${this.stage.name || this.stage.id}.onEnter`, {
            objectName: this.stage.name || this.stage.id,
            eventName: "onEnter"
          });
          try {
            this.taskExecutor.execute(onEnterTask, { sender: this.stage }, this.contextVars, this.stage, 0, enterLogId);
          } catch (e) {
            logger5.error(`Error executing onEnter for stage ${this.stage.id}:`, e);
          }
        }
        const onRuntimeStartTask = (this.stage.events || this.stage.Tasks)?.onRuntimeStart;
        if (onRuntimeStartTask) {
          logger5.debug(`Triggering onRuntimeStart for stage: ${this.stage.id} (Task: ${onRuntimeStartTask})`);
          const startLogId = DebugLogService.getInstance().log("Event", `Triggered: ${this.stage.name || this.stage.id}.onRuntimeStart`, {
            objectName: this.stage.name || this.stage.id,
            eventName: "onRuntimeStart"
          });
          try {
            this.taskExecutor.execute(onRuntimeStartTask, { sender: this.stage }, this.contextVars, this.stage, 0, startLogId);
          } catch (e) {
            logger5.error(`Error executing onRuntimeStart for stage ${this.stage.id}:`, e);
          }
        }
      }
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
      console.info(`[DIAGNOSTIC] handleEvent entry: objId=${objectId}, event=${eventName}`);
      const obj = this.objects.find((o) => o.id === objectId);
      if (!obj) {
        console.warn(`[DIAGNOSTIC] Object not found: ${objectId}`);
        return;
      }
      const hasOnEventMap = obj.onEvent && obj.onEvent[eventName];
      const hasTaskMap = obj.events && obj.events[eventName] || obj.Tasks && obj.Tasks[eventName];
      console.info(`[DIAGNOSTIC] Object found: ${obj.name}. hasOnEventMap=${!!hasOnEventMap}, hasTaskMap=${!!hasTaskMap}`);
      let eventLogId = void 0;
      if (hasOnEventMap || hasTaskMap) {
        eventLogId = DebugLogService.getInstance().log("Event", `Triggered: ${obj.name}.${eventName}`, {
          objectName: obj.name,
          eventName,
          data
        });
        DebugLogService.getInstance().pushContext(eventLogId);
      }
      try {
        if (obj.className === "TEmojiPicker" && eventName === "onSelect" && typeof data === "string") {
          logger5.debug(`Syncing selectedEmoji for ${obj.name}: ${data}`);
          obj.selectedEmoji = data;
        }
        if (obj.onEvent) {
          const actions = obj.onEvent[eventName];
          if (actions) {
            const actionList = Array.isArray(actions) ? actions : [actions];
            for (const action of actionList) {
              this.actionExecutor.execute(action, {}, this.contextVars, data, eventLogId);
            }
          }
        }
        if (this.taskExecutor && hasTaskMap) {
          const taskName = typeof hasTaskMap === "string" ? hasTaskMap : `${obj.name}.${eventName}`;
          const eventVars = typeof data === "object" && data !== null ? { ...data, eventData: data, sender: obj } : { eventData: data, sender: obj };
          this.taskExecutor.execute(taskName, eventVars, this.contextVars, obj, 0, eventLogId);
        }
      } finally {
        if (eventLogId) {
          DebugLogService.getInstance().popContext();
        }
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
      const process2 = (objs, parentX = 0, parentY = 0, parentZ = 0) => {
        objs.forEach((obj) => {
          const resolveCoord = (val) => {
            if (val === void 0 || val === null) return val;
            if (typeof val === "string" && val.includes("${")) {
              try {
                const evaluated = this.reactiveRuntime.evaluate(val);
                const n = Number(evaluated);
                return isNaN(n) ? evaluated : n;
              } catch (e) {
                return val;
              }
            }
            if (typeof val === "string") {
              const n = Number(val);
              return isNaN(n) ? val : n;
            }
            return typeof val === "number" ? val : 0;
          };
          const rx = resolveCoord(obj.x);
          const ry = resolveCoord(obj.y);
          const absoluteX = parentX + rx;
          const absoluteY = parentY + ry;
          if (obj.name?.includes("Button") || obj.name && obj.name.includes("Emoji")) {
            console.log(`[GameRuntime:Layout] ${obj.name}: x=${obj.x} (resolved=${rx}), parentX=${parentX} -> absoluteX=${absoluteX}`);
          }
          const absoluteZ = parentZ + resolveCoord(obj.zIndex);
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
          copy.width = resolveCoord(obj.width);
          copy.height = resolveCoord(obj.height);
          copy.zIndex = absoluteZ;
          results.push(copy);
          const shouldRecurse = !obj.isInternalContainer;
          if (shouldRecurse && obj.children && obj.children.length > 0) {
            const gridConfig = this.stage?.grid || this.project.stage?.grid || { cellSize: 20 };
            const cellSize = gridConfig.cellSize || 20;
            const isDialog = obj.className === "TDialogRoot" || obj.className === "TDialog";
            const childOffsetY = isDialog ? 30 / cellSize : 0;
            process2(obj.children, absoluteX, absoluteY + childOffsetY, absoluteZ + 1);
          }
        });
      };
      process2(this.objects);
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
      const process2 = (objs) => {
        objs.forEach((obj) => {
          this.bindObjectProperties(obj);
          if (obj.children && obj.children.length > 0) {
            process2(obj.children);
          }
        });
      };
      process2(this.objects);
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
        const isGlobalVar = obj.name && obj.name in this.variableManager.projectVariables;
        if (!isGlobalVar) {
          if (obj.value !== void 0) {
            this.contextVars[obj.name] = obj.value;
          } else if (Array.isArray(obj.items)) {
            this.contextVars[obj.name] = obj.items;
          }
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
            logger5.debug(`Creating reactive binding: ${obj.name}.${propPath} \u2190 ${val}`);
            this.reactiveRuntime.bindComponent(obj, propPath, val);
          } else if (val && typeof val === "object" && !Array.isArray(val) && (key === "style" || key === "events" || key === "Tasks")) {
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
            if (obj.items !== void 0 && Array.isArray(runtimeValue)) {
              obj.items = runtimeValue;
            } else {
              obj.value = runtimeValue;
            }
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

  // src/editor/services/EmojiPickerRenderer.ts
  var logger6 = Logger.get("EmojiPickerRenderer", "Inspector_Update");
  var EmojiPickerRenderer = class {
    /**
     * Renders the internal emoji grid for a TEmojiPicker object.
     */
    static renderEmojiPicker(el, obj, cellSize, onEvent) {
      try {
        el.style.display = "grid";
        el.style.gridTemplateColumns = `repeat(${obj.columns || 5}, 1fr)`;
        el.style.gap = "5px";
        el.style.padding = "10px";
        el.style.overflowY = "auto";
        el.style.alignContent = "start";
        el.style.justifyItems = "center";
        el.innerHTML = "";
        const emojiList = Array.isArray(obj.emojis) ? obj.emojis : [];
        const itemSizePx = (obj.itemSize || 2) * cellSize;
        emojiList.forEach((emoji) => {
          const btn = document.createElement("div");
          btn.style.width = `${itemSizePx}px`;
          btn.style.height = `${itemSizePx}px`;
          btn.style.display = "flex";
          btn.style.alignItems = "center";
          btn.style.justifyContent = "center";
          btn.style.fontSize = `${itemSizePx * 0.7}px`;
          btn.style.cursor = "pointer";
          btn.style.borderRadius = "8px";
          btn.style.transition = "background 0.2s, transform 0.1s";
          btn.innerText = emoji;
          if (emoji === obj.selectedEmoji) {
            btn.style.backgroundColor = "rgba(255, 255, 255, 0.2)";
            btn.style.boxShadow = "0 0 0 2px #4fc3f7";
          }
          btn.onclick = (e) => {
            e.stopPropagation();
            obj.selectedEmoji = emoji;
            if (onEvent) onEvent(obj.id, "onSelect", emoji);
            this.renderEmojiPicker(el, obj, cellSize, onEvent);
          };
          el.appendChild(btn);
        });
      } catch (e) {
        logger6.error("Error rendering EmojiPicker:", e);
      }
    }
  };

  // src/editor/services/TableRenderer.ts
  var logger7 = Logger.get("TableRenderer", "Inspector_Update");
  var TableRenderer = class {
    /**
     * Main entry point for rendering any table/grid structure.
     */
    static renderTable(el, obj, onEvent, cellSize = 20) {
      try {
        el.innerHTML = "";
        const scrollArea = document.createElement("div");
        scrollArea.style.cssText = "width:100%; height:100%; overflow:auto;";
        el.appendChild(scrollArea);
        const cols = Array.isArray(obj.columns) ? obj.columns : [];
        const rawData = Array.isArray(obj.data) ? obj.data : [];
        if (obj.viewType === "grid") {
          this.renderGrid(scrollArea, el, obj, cols, rawData, onEvent, cellSize);
        } else {
          this.renderStandardTable(scrollArea, el, obj, cols, rawData, onEvent);
        }
      } catch (e) {
        logger7.error("Error rendering table:", e);
      }
    }
    static renderGrid(scrollArea, el, obj, cols, rawData, onEvent, cellSize = 20) {
      const config = obj.gridConfig || {};
      const cardWidth = config.cardWidth || 180;
      const cardHeight = config.cardHeight || 120;
      const gap = config.gap || 16;
      scrollArea.style.display = "flex";
      scrollArea.style.flexWrap = "wrap";
      scrollArea.style.gap = `${gap}px`;
      scrollArea.style.padding = `${gap}px`;
      scrollArea.style.alignContent = "flex-start";
      rawData.forEach((row, idx) => {
        const card = document.createElement("div");
        card.className = "gcs-card-item";
        card.style.cssText = `position: relative; width: ${cardWidth}px; height: ${cardHeight}px; background: ${config.backgroundColor || "rgba(255, 255, 255, 0.05)"}; border: ${config.borderWidth || 1}px solid ${config.borderColor || "rgba(255, 255, 255, 0.1)"}; border-radius: ${config.borderRadius || 12}px; padding: ${config.padding || 12}px; cursor: pointer; overflow: hidden; transition: transform 0.2s, background 0.2s; box-sizing: border-box;`;
        if (idx === obj.selectedIndex) {
          card.style.background = "rgba(255, 255, 255, 0.15)";
          card.style.borderColor = "#0ed7b5";
        }
        card.onmouseenter = () => card.style.transform = "translateY(-2px)";
        card.onmouseleave = () => card.style.transform = "none";
        card.onclick = (e) => {
          e.stopPropagation();
          obj.selectedIndex = idx;
          if (onEvent) onEvent(obj.id, "onSelect", { index: idx, data: row });
          this.renderTable(el, obj, onEvent);
        };
        cols.forEach((col) => {
          const fieldName = col.field || col.property;
          const value = row[fieldName] ?? "";
          const type = col.type || "text";
          const colStyle = col.style || {};
          const itemEl = document.createElement("div");
          itemEl.style.position = "absolute";
          if (col.x !== void 0) itemEl.style.left = `${col.x * cellSize}px`;
          if (col.y !== void 0) itemEl.style.top = `${col.y * cellSize}px`;
          if (col.width !== void 0) itemEl.style.width = `${col.width * cellSize}px`;
          if (col.height !== void 0) itemEl.style.height = `${col.height * cellSize}px`;
          if (colStyle.fontSize) itemEl.style.fontSize = typeof colStyle.fontSize === "number" ? `${colStyle.fontSize}px` : colStyle.fontSize;
          if (colStyle.color) itemEl.style.color = colStyle.color;
          if (colStyle.fontWeight) itemEl.style.fontWeight = colStyle.fontWeight;
          if (type === "image") {
            itemEl.style.borderRadius = "50%";
            itemEl.style.backgroundImage = `url(${value})`;
            itemEl.style.backgroundSize = "cover";
            itemEl.style.backgroundPosition = "center";
            if (!col.width) itemEl.style.width = "40px";
            if (!col.height) itemEl.style.height = "40px";
          } else if (type === "badge") {
            itemEl.innerText = String(value).toUpperCase();
            itemEl.style.cssText += "padding: 2px 8px; border-radius: 100px; font-size: 9px; font-weight: bold; border: 1px solid currentColor; background: rgba(0,0,0,0.2); display: inline-flex; align-items: center; justify-content: center;";
          } else {
            itemEl.innerText = String(value);
            if (type === "header") itemEl.style.fontWeight = "bold";
            else if (type === "meta") itemEl.style.opacity = "0.6";
          }
          card.appendChild(itemEl);
        });
        scrollArea.appendChild(card);
      });
    }
    static renderStandardTable(scrollArea, el, obj, cols, rawData, onEvent) {
      const table = document.createElement("table");
      table.style.cssText = "width:100%; border-collapse:collapse; color:inherit; text-align:left;";
      if (obj.showHeader !== false && cols.length > 0) {
        const thead = document.createElement("thead");
        const hRow = document.createElement("tr");
        hRow.style.cssText = "background:rgba(0,0,0,0.05); position:sticky; top:0; z-index:1;";
        cols.forEach((col) => {
          const th = document.createElement("th");
          th.style.cssText = `padding:8px 12px; border-bottom:1px solid rgba(0,0,0,0.1); width:${col.width || "auto"}; font-weight:600;`;
          th.innerText = col.label || col.field || col.property;
          hRow.appendChild(th);
        });
        thead.appendChild(hRow);
        table.appendChild(thead);
      }
      const tbody = document.createElement("tbody");
      if (rawData.length === 0) {
        const tr = document.createElement("tr");
        const td2 = document.createElement("td");
        td2.colSpan = Math.max(1, cols.length);
        td2.innerText = "Keine Daten vorhanden.";
        td2.style.cssText = "padding:12px; text-align:center; opacity:0.6; font-style:italic;";
        tr.appendChild(td2);
        tbody.appendChild(tr);
      } else {
        rawData.forEach((row, idx) => {
          const tr = document.createElement("tr");
          tr.style.cssText = `border-bottom:1px solid rgba(0,0,0,0.05); cursor:pointer; height:${obj.rowHeight || 30}px;`;
          const isSelected = idx === obj.selectedIndex;
          const isStriped = obj.striped !== false && idx % 2 === 1;
          tr.style.backgroundColor = isSelected ? "rgba(0,0,0,0.1)" : isStriped ? "rgba(0,0,0,0.02)" : "transparent";
          tr.onclick = (e) => {
            e.stopPropagation();
            obj.selectedIndex = idx;
            if (onEvent) onEvent(obj.id, "onSelect", { index: idx, data: row });
            this.renderTable(el, obj, onEvent);
          };
          cols.forEach((col) => {
            const td2 = document.createElement("td");
            td2.style.cssText = "padding:6px 12px;";
            td2.innerText = String(row[col.field || col.property] ?? "");
            tr.appendChild(td2);
          });
          tbody.appendChild(tr);
        });
      }
      table.appendChild(tbody);
      scrollArea.appendChild(table);
    }
  };

  // src/editor/services/StageRenderer.ts
  var logger8 = Logger.get("StageRenderer", "Component_Manipulation");
  var StageRenderer = class _StageRenderer {
    constructor(host) {
      __publicField(this, "host");
      this.host = host;
    }
    renderObjects(objects) {
      const objectHash = objects.map((o) => `${o.id}@${o.x?.toFixed(1)},${o.y?.toFixed(1)}`).join("|");
      if (this.host.runMode) {
        this.host.lastObjectHash = objectHash;
        const gridConfig2 = this.host.grid;
        logger8.info(`%c[Layout] renderObjects: Using cellSize=${gridConfig2.cellSize} for ${objects.length} objects`, "color: #00ff00; font-weight: bold");
        if (!this.host.runModeLogDone) {
          this.host.runModeLogDone = true;
          logger8.info(`RunMode Render Start. Rendering ${objects.length} objects.`);
          if (objects.length > 0) {
            console.table(objects.slice(0, 20).map((o) => ({
              name: o.name,
              class: o.className || o.constructor?.name,
              visible: o.visible,
              isVar: o.isVariable || false,
              scope: o.scope || "-",
              value: o.isVariable ? JSON.stringify(o.value)?.substring(0, 80) : "-",
              text: typeof o.text === "string" ? o.text.substring(0, 60) : "-"
            })));
          } else {
            console.warn("[StageRenderer] Rendering an EMPTY stage in RunMode!");
          }
        }
      }
      this.host.lastRenderedObjects = objects;
      const gridConfig = this.host.grid;
      const stageWidth = gridConfig.cols * gridConfig.cellSize;
      const stageHeight = gridConfig.rows * gridConfig.cellSize;
      if (this.host.runMode) {
        logger8.info(`[StageRenderer:Layout] Stage Size: ${stageWidth}x${stageHeight} (cols: ${gridConfig.cols}, nodes: ${objects.length})`);
      }
      const dockArea = { left: 0, top: 0, right: stageWidth, bottom: stageHeight };
      const dockPositions = /* @__PURE__ */ new Map();
      objects.forEach((obj) => {
        const align = obj.align || "NONE";
        if (align === "NONE" || align === "CLIENT") return;
        const objId = obj.id || obj.name;
        if (!objId) return;
        const objHeight = (obj.height || 0) * gridConfig.cellSize;
        const objWidth = (obj.width || 0) * gridConfig.cellSize;
        let actualHeight = objHeight;
        let actualWidth = objWidth;
        if (obj.className === "TStatusBar" || obj.name?.startsWith("Status")) {
          actualHeight = obj.height || 0;
          actualWidth = obj.width || 0;
        }
        const availableWidth = dockArea.right - dockArea.left;
        const availableHeight = dockArea.bottom - dockArea.top;
        if (align === "TOP") {
          dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: availableWidth, height: actualHeight });
          dockArea.top += actualHeight;
        } else if (align === "BOTTOM") {
          dockPositions.set(objId, { left: dockArea.left, top: dockArea.bottom - actualHeight, width: availableWidth, height: actualHeight });
          dockArea.bottom -= actualHeight;
        } else if (align === "LEFT") {
          dockPositions.set(objId, { left: dockArea.left, top: dockArea.top, width: actualWidth, height: availableHeight });
          dockArea.left += actualWidth;
        } else if (align === "RIGHT") {
          dockPositions.set(objId, { left: dockArea.right - actualWidth, top: dockArea.top, width: actualWidth, height: availableHeight });
          dockArea.right -= actualWidth;
        }
      });
      objects.forEach((obj) => {
        const align = obj.align || "NONE";
        if (align !== "CLIENT") return;
        const objId = obj.id || obj.name;
        if (!objId) return;
        const clientWidth = dockArea.right - dockArea.left;
        const clientHeight = dockArea.bottom - dockArea.top;
        dockPositions.set(objId, {
          left: dockArea.left,
          top: dockArea.top,
          width: clientWidth,
          height: clientHeight
        });
      });
      const currentIds = this.collectAllIds(objects);
      const renderedElements = Array.from(this.host.element.querySelectorAll(".game-object"));
      renderedElements.forEach((el) => {
        const id = el.getAttribute("data-id");
        if (id && !currentIds.has(id)) {
          el.remove();
        }
      });
      const sortedObjects = [...objects].sort((a, b) => (a.zIndex || 0) - (b.zIndex || 0));
      sortedObjects.forEach((obj) => {
        const objId = obj.id || obj.name;
        if (!objId) return;
        let el = this.host.element.querySelector(`[data-id="${objId}"]`);
        let isNew = false;
        if (!el) {
          el = document.createElement("div");
          el.setAttribute("data-id", objId);
          el.style.position = "absolute";
          el.style.boxSizing = "border-box";
          el.style.overflow = "hidden";
          el.style.display = "flex";
          el.style.alignItems = "center";
          el.style.justifyContent = "center";
          el.style.userSelect = "none";
          this.host.element.appendChild(el);
          isNew = true;
        }
        const className = obj.className || obj.constructor?.name;
        el.className = "game-object" + (className ? " " + className : "");
        el.setAttribute("data-align", obj.align || "NONE");
        const dockPos = dockPositions.get(objId);
        let finalX, finalY, finalW, finalH;
        if (dockPos) {
          finalX = dockPos.left;
          finalY = dockPos.top;
          finalW = dockPos.width;
          finalH = dockPos.height;
        } else {
          finalX = (obj.x || 0) * gridConfig.cellSize;
          finalY = (obj.y || 0) * gridConfig.cellSize;
          finalW = (obj.width || 0) * gridConfig.cellSize;
          finalH = (obj.height || 0) * gridConfig.cellSize;
        }
        el.style.left = `${finalX}px`;
        el.style.top = `${finalY}px`;
        el.style.width = `${finalW}px`;
        el.style.height = `${finalH}px`;
        if (this.host.runMode) {
          const isMetric = obj.name?.includes("Metric") || obj.id?.includes("metric");
          if (isMetric || obj.id === "dash_title" || obj.id === "dash_back_btn" || obj.name?.includes("Button") || obj.name && obj.name.includes("Emoji")) {
            logger8.info(`%c[Layout:${this.host.element.id}] ${obj.name || obj.id} (RUN): align=${obj.align}, x=${obj.x}, y=${obj.y}, w=${obj.width}, cellSize=${gridConfig.cellSize} -> left=${finalX}, top=${finalY}`, "color: #ff00ff; font-weight: bold");
          }
        }
        let isVisible = this.checkVisible(obj.visible) && this.checkVisible(obj.style?.visible);
        const isInherited = !!obj.isInherited;
        const isFromBlueprint = !!obj.isFromBlueprint;
        const isBlueprintOnly = !!obj.isBlueprintOnly;
        const isService = !!obj.isService;
        if (!this.host.isBlueprint) {
          if (isFromBlueprint && (isService || isBlueprintOnly)) {
            isVisible = false;
          }
        } else {
          if (isFromBlueprint || isService || isBlueprintOnly) {
            isVisible = true;
          }
        }
        el.style.display = isVisible ? "flex" : "none";
        if (isInherited) {
          el.classList.add("inherited-object");
          el.style.pointerEvents = "none";
        } else {
          el.classList.remove("inherited-object");
          el.style.pointerEvents = "auto";
        }
        const opacity = obj.style && obj.style.opacity !== void 0 && obj.style.opacity !== null ? obj.style.opacity : obj.imageOpacity !== void 0 ? obj.imageOpacity : void 0;
        if (opacity !== void 0 && opacity !== null) {
          el.style.opacity = String(opacity);
        } else if (isInherited) {
          el.style.opacity = "0.4";
        } else {
          el.style.opacity = "1";
        }
        if (obj.style) {
          const isTShape = className === "TShape";
          if (!isTShape) {
            el.style.border = `${obj.style.borderWidth || 0}px solid ${obj.style.borderColor || "transparent"}`;
          } else {
            el.style.border = "none";
          }
          if (obj.style.color) {
            el.style.color = obj.style.color;
            if (obj.className === "TLabel" || obj.className === "TButton") {
            }
          }
          if (obj.style.fontSize) el.style.fontSize = typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize;
          if (obj.style.fontWeight) el.style.fontWeight = obj.style.fontWeight;
          if (obj.style.borderRadius) el.style.borderRadius = typeof obj.style.borderRadius === "number" ? `${obj.style.borderRadius}px` : obj.style.borderRadius;
          if (obj.zIndex !== void 0) {
            el.style.zIndex = String(obj.zIndex);
          } else if (obj.name && (obj.name.startsWith("Overlay") || obj.name.startsWith("Btn") || obj.name.startsWith("Input") || obj.name.startsWith("Status"))) {
            el.style.zIndex = "2000";
          }
        }
        if (obj.showGrid && !this.host.runMode) {
          this.applyGridOverlay(el, obj);
        } else {
          this.applyBackground(el, obj, className, objId);
        }
        const hasTaskClick = obj.Tasks && (obj.Tasks.onClick || obj.Tasks.onSingleClick || obj.Tasks.onMultiClick) || obj.events && (obj.events.onClick || obj.events.onSingleClick || obj.events.onMultiClick);
        const isClickable = hasTaskClick || this.host.runMode && className === "TButton";
        if (this.host.runMode && isClickable) {
          el.style.cursor = "pointer";
          el.onclick = (e) => {
            e.stopPropagation();
            console.log(`[StageRenderer] Click on ${obj.name} (${obj.id}). Task: ${obj.events?.onClick || obj.Tasks?.onClick || "none"}`);
            if (this.host.onEvent) {
              this.host.onEvent(obj.id, "onClick");
            }
          };
        } else if (this.host.runMode) {
          el.style.cursor = "default";
          if (isNew) el.onclick = null;
        }
        this.renderComponentContent(el, obj, className, isNew);
        this.updateSelectionState(el, objId);
      });
    }
    collectAllIds(objs) {
      const ids = /* @__PURE__ */ new Set();
      objs.forEach((o) => {
        const objId = o.id || o.name;
        if (objId) ids.add(objId);
        if (o.children && Array.isArray(o.children)) {
          o.children.forEach((c) => {
            const childId = c.id || c.name;
            if (childId) ids.add(childId);
          });
        }
      });
      return ids;
    }
    checkVisible(val) {
      if (val === void 0 || val === null) return true;
      if (typeof val === "boolean") return val;
      if (typeof val === "string") {
        const clean = val.trim().toLowerCase();
        if (clean === "false") return false;
        if (clean === "true") return true;
      }
      return !!val;
    }
    applyGridOverlay(el, obj) {
      const cellSize = this.host.grid.cellSize;
      const bgColor = obj.style?.backgroundColor || "transparent";
      const gridColor = obj.gridColor || "#000000";
      const gridStyle = obj.gridStyle || "lines";
      const hexToRgba = (hex, alpha) => {
        let r = 0, g = 0, b = 0;
        if (hex.length === 4) {
          r = parseInt(hex[1] + hex[1], 16);
          g = parseInt(hex[2] + hex[2], 16);
          b = parseInt(hex[3] + hex[3], 16);
        } else if (hex.length === 7) {
          r = parseInt(hex.slice(1, 3), 16);
          g = parseInt(hex.slice(3, 5), 16);
          b = parseInt(hex.slice(5, 7), 16);
        }
        return `rgba(${r}, ${g}, ${b}, ${alpha})`;
      };
      const gridRgba = hexToRgba(gridColor, 0.4);
      const dotRgba = hexToRgba(gridColor, 0.25);
      if (gridStyle === "dots") {
        const halfCell = cellSize / 2;
        el.style.background = `radial-gradient(circle, ${dotRgba} 1px, transparent 1px), ${bgColor}`;
        el.style.backgroundSize = `${cellSize}px ${cellSize}px, 100% 100%`;
        el.style.backgroundPosition = `${halfCell}px ${halfCell}px, 0 0`;
      } else {
        el.style.background = `linear-gradient(to right, ${gridRgba} 1px, transparent 1px), linear-gradient(to bottom, ${gridRgba} 1px, transparent 1px), ${bgColor}`;
        el.style.backgroundSize = `${cellSize}px ${cellSize}px, ${cellSize}px ${cellSize}px, 100% 100%`;
      }
    }
    applyBackground(el, obj, className, objId) {
      const bgColor = obj.style?.backgroundColor || "transparent";
      let bgImg = obj.backgroundImage || obj.src || obj.style?.backgroundImage;
      if (bgImg && bgImg.startsWith("url(")) {
        const match = bgImg.match(/url\(['"]?([^'"]+)['"]?\)/);
        if (match) bgImg = match[1];
      }
      if (this.host.runMode && !el.runModeTraceDone) {
        el.lastLoggedSrc = null;
        el.runModeTraceDone = true;
      }
      if (bgImg) {
        let src = bgImg.startsWith("http") || bgImg.startsWith("/") || bgImg.startsWith("data:") ? bgImg : `/images/${bgImg}`;
        if (!src.startsWith("data:")) {
          const parts = src.split("/");
          const lastPart = parts.pop() || "";
          src = [...parts, encodeURIComponent(lastPart)].join("/");
        }
        if (el.lastLoggedSrc !== src) {
          console.log(`[StageRenderer] Component "${objId}" (${className}) setting image: "${src}"`);
          el.lastLoggedSrc = src;
        }
        const fit = obj.objectFit || "contain";
        el.style.backgroundImage = `url("${src}")`;
        el.style.backgroundPosition = "center";
        el.style.backgroundSize = fit;
        el.style.backgroundRepeat = "no-repeat";
        el.style.backgroundColor = bgColor;
      } else {
        el.style.background = bgColor;
      }
    }
    renderComponentContent(el, obj, className, isNew) {
      if (className === "TCheckbox") {
        this.renderCheckbox(el, obj, isNew);
      } else if (className === "TNumberInput") {
        this.renderNumberInput(el, obj, isNew);
      } else if (className === "TEdit" || className === "TTextInput") {
        this.renderTextInput(el, obj, isNew);
      } else if (className === "TGameCard") {
        this.renderGameCard(el, obj, isNew);
      } else if (className === "TButton") {
        this.renderButton(el, obj, isNew);
      } else if (className === "TEmojiPicker") {
        this.renderEmojiPickerInternal(el, obj);
      } else if (className === "TTable" || className === "TObjectList" || className === "TDataList") {
        _StageRenderer.renderTable(el, obj, this.host.onEvent?.bind(this.host), this.host.grid.cellSize);
      } else if (className === "TStringVariable" || className === "TObjectVariable" || className === "TIntegerVariable" || className === "TBooleanVariable" || className === "TListVariable" || obj.isVariable || obj.isService) {
        this.renderSystemComponent(el, obj, className);
      } else if (className === "TLabel" || className === "TNumberLabel") {
        this.renderLabel(el, obj);
      } else if (className === "TPanel") {
        this.renderPanel(el, obj);
      } else if (className === "TGameHeader") {
        this.renderGameHeader(el, obj);
      } else if (className === "TSprite") {
        this.renderSprite(el, obj);
      } else if (className === "TShape") {
        this.renderShape(el, obj, isNew);
      } else if (className === "TInspectorTemplate") {
        this.renderInspectorTemplate(el, obj);
      } else if (className === "TDialogRoot") {
        this.renderDialogRoot(el, obj);
      } else if (className !== "TShape" && ("text" in obj || "value" in obj)) {
        this.renderLabel(el, obj);
      }
    }
    renderCheckbox(el, obj, isNew) {
      if (isNew) {
        el.innerHTML = "";
        const label = document.createElement("label");
        label.style.display = "flex";
        label.style.alignItems = "center";
        label.style.gap = "8px";
        label.style.width = "100%";
        label.style.height = "100%";
        label.style.cursor = "inherit";
        const input2 = document.createElement("input");
        input2.type = "checkbox";
        input2.style.cursor = "pointer";
        const textSpan2 = document.createElement("span");
        textSpan2.className = "checkbox-label";
        label.appendChild(input2);
        label.appendChild(textSpan2);
        el.appendChild(label);
      }
      const input = el.querySelector("input");
      const textSpan = el.querySelector(".checkbox-label");
      if (input) {
        if (this.host.runMode) {
          input.onchange = () => {
            obj.checked = input.checked;
          };
        }
        input.checked = !!obj.checked;
      }
      if (textSpan) {
        textSpan.innerText = obj.label || obj.name;
        textSpan.style.color = obj.style?.color || "#000000";
        textSpan.style.fontSize = obj.style?.fontSize ? typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize : "14px";
        const fw = obj.style?.fontWeight;
        textSpan.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
        const fs = obj.style?.fontStyle;
        textSpan.style.fontStyle = fs === true || fs === "italic" ? "italic" : "normal";
        if (obj.style?.fontFamily) textSpan.style.fontFamily = obj.style.fontFamily;
      }
    }
    renderNumberInput(el, obj, isNew) {
      if (isNew) {
        el.innerHTML = "";
        const input2 = document.createElement("input");
        input2.type = "number";
        input2.style.width = "100%";
        input2.style.height = "100%";
        input2.style.border = "none";
        input2.style.background = "transparent";
        input2.style.padding = "0 8px";
        input2.style.fontSize = "inherit";
        input2.style.outline = "none";
        input2.style.boxSizing = "border-box";
        el.appendChild(input2);
      }
      const input = el.querySelector("input");
      if (input) {
        if (this.host.runMode) {
          input.oninput = () => {
            obj.value = parseFloat(input.value);
          };
        }
        if (parseFloat(input.value) !== obj.value) input.value = String(obj.value || 0);
        if (obj.min !== void 0 && obj.min !== -Infinity) input.min = String(obj.min);
        if (obj.max !== void 0 && obj.max !== Infinity) input.max = String(obj.max);
        if (obj.step !== void 0) input.step = String(obj.step);
        input.style.color = obj.style?.color || "#000000";
        input.style.backgroundColor = obj.style?.backgroundColor || "transparent";
        input.style.fontSize = obj.style?.fontSize ? typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize : "inherit";
        input.style.textAlign = obj.style?.textAlign || "left";
        const fw = obj.style?.fontWeight;
        input.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
        const fs = obj.style?.fontStyle;
        input.style.fontStyle = fs === true || fs === "italic" ? "italic" : "normal";
        if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
      }
    }
    renderTextInput(el, obj, isNew) {
      const isInput = !this.host.runMode || obj.className === "TTextInput" || obj.className === "TEdit";
      if (isInput) {
        if (isNew) {
          el.innerHTML = "";
          const input2 = document.createElement("input");
          input2.type = "text";
          input2.style.width = "100%";
          input2.style.height = "100%";
          input2.style.border = "none";
          input2.style.background = "transparent";
          input2.style.padding = "0 8px";
          input2.style.fontSize = "inherit";
          input2.style.outline = "none";
          input2.style.boxSizing = "border-box";
          el.appendChild(input2);
        }
        const input = el.querySelector("input");
        if (input) {
          if (this.host.runMode) {
            input.oninput = () => {
              let val = input.value;
              if (obj.uppercase) val = val.toUpperCase();
              obj.text = val;
              input.value = val;
            };
          }
          if (input.value !== (obj.text || "")) input.value = obj.text || "";
          input.placeholder = obj.placeholder || "";
          input.style.color = obj.style?.color || "#000000";
          input.style.backgroundColor = obj.style?.backgroundColor || "transparent";
          input.style.textAlign = obj.style?.textAlign || "left";
          input.style.fontSize = obj.style?.fontSize ? typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize : "inherit";
          const fw = obj.style?.fontWeight;
          input.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
          const fs = obj.style?.fontStyle;
          input.style.fontStyle = fs === true || fs === "italic" ? "italic" : "normal";
          if (obj.style?.fontFamily) input.style.fontFamily = obj.style.fontFamily;
        }
      } else {
        el.innerText = obj.text || obj.placeholder || "Enter text...";
      }
    }
    renderGameCard(el, obj, isNew) {
      if (isNew) {
        el.innerHTML = `
                <div class="card-title" style="font-weight:bold;margin-bottom:10px"></div>
                <div class="card-btns" style="display:flex;gap:5px">
                    <button class="btn-single" style="padding:6px;border:none;border-radius:4px;background:#4caf50;color:#fff;cursor:pointer">\u25B6 Single</button>
                    <button class="btn-multi" style="padding:6px;border:none;border-radius:4px;background:#2196f3;color:#fff;cursor:pointer">\u{1F465} Multi</button>
                </div>
            `;
        el.style.flexDirection = "column";
        el.querySelector(".btn-single")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.host.onEvent) this.host.onEvent(obj.id, "onSingleClick");
        });
        el.querySelector(".btn-multi")?.addEventListener("click", (e) => {
          e.stopPropagation();
          if (this.host.onEvent) this.host.onEvent(obj.id, "onMultiClick");
        });
      }
      const titleEl = el.querySelector(".card-title");
      if (titleEl && titleEl.innerText !== obj.gameName) titleEl.innerText = obj.gameName;
    }
    renderButton(el, obj, _isNew) {
      if (el.querySelector(".table-title-bar")) el.innerHTML = "";
      if (el.innerText !== (obj.caption || obj.name)) el.innerText = obj.caption || obj.name;
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
      const fstyle = obj.style?.fontStyle;
      el.style.fontStyle = fstyle === true || fstyle === "italic" ? "italic" : "normal";
      if (obj.style?.fontSize) el.style.fontSize = typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize;
      if (obj.style?.color) el.style.color = obj.style.color;
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      const align = obj.style?.textAlign;
      el.style.justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      if (this.host.runMode) {
        el.onmouseenter = () => el.style.filter = "brightness(1.1)";
        el.onmouseleave = () => el.style.filter = "none";
        el.onmousedown = () => el.style.transform = "scale(0.98)";
        el.onmouseup = () => el.style.transform = "none";
        el.onclick = (e) => {
          e.stopPropagation();
          if (this.host.onEvent) {
            logger8.debug(`[StageRenderer] Button clicked: ${obj.id} (${obj.name})`);
            this.host.onEvent(obj.id, "onClick");
          }
        };
      }
    }
    renderEmojiPickerInternal(el, obj) {
      el.innerHTML = "";
      el.style.display = "grid";
      el.style.gridTemplateColumns = `repeat(${obj.columns || 5}, 1fr)`;
      el.style.gap = "4px";
      el.style.padding = "8px";
      el.style.alignItems = "center";
      el.style.justifyItems = "center";
      el.style.overflowY = "auto";
      const emojis = obj.emojis || ["\u{1F600}", "\u{1F60E}", "\u{1F680}", "\u2B50", "\u{1F308}", "\u{1F355}", "\u{1F3AE}", "\u{1F984}", "\u{1F388}", "\u{1F3A8}"];
      emojis.forEach((emoji) => {
        const btn = document.createElement("div");
        btn.innerText = emoji;
        btn.style.fontSize = "24px";
        btn.style.cursor = this.host.runMode ? "pointer" : "default";
        btn.style.width = "100%";
        btn.style.height = "100%";
        btn.style.display = "flex";
        btn.style.alignItems = "center";
        btn.style.justifyContent = "center";
        btn.style.borderRadius = "8px";
        btn.style.transition = "background 0.2s, transform 0.1s";
        btn.style.userSelect = "none";
        if (obj.selectedEmoji === emoji) {
          btn.style.background = "rgba(255, 255, 255, 0.3)";
          btn.style.border = "1px solid rgba(255, 255, 255, 0.5)";
        } else {
          btn.style.border = "1px solid transparent";
        }
        if (this.host.runMode) {
          btn.onmouseenter = () => {
            if (obj.selectedEmoji !== emoji) btn.style.background = "rgba(255, 255, 255, 0.1)";
            btn.style.transform = "scale(1.1)";
          };
          btn.onmouseleave = () => {
            if (obj.selectedEmoji !== emoji) btn.style.background = "transparent";
            btn.style.transform = "scale(1)";
          };
          btn.onclick = (e) => {
            e.stopPropagation();
            obj.selectedEmoji = emoji;
            if (this.host.onEvent) {
              this.host.onEvent(obj.id, "onSelect", emoji);
              this.host.onEvent(obj.id, "propertyChange", { property: "selectedEmoji", value: emoji });
            }
            this.renderObjects(this.host.lastRenderedObjects);
          };
        }
        el.appendChild(btn);
      });
    }
    renderSystemComponent(el, obj, className) {
      let effectivelyVisible = true;
      if (this.host.runMode) {
        if (obj.isHiddenInRun || obj.isVariable) effectivelyVisible = false;
      } else {
        if (obj.isBlueprintOnly && !this.host.isBlueprint && obj.isInherited) effectivelyVisible = false;
      }
      if (!effectivelyVisible) {
        el.style.display = "none";
      } else {
        el.style.display = "flex";
        if (!this.host.runMode) {
          el.style.backgroundColor = this.getSystemComponentColor(className, obj);
          let val = obj.value !== void 0 ? obj.value : obj.defaultValue;
          if (val === void 0) val = "-";
          el.innerText = obj.isVariable ? `${obj.name}
(${val})` : obj.name;
          el.style.color = "#ffffff";
          el.style.fontSize = "10px";
          el.style.textAlign = "center";
          el.style.whiteSpace = "pre-wrap";
          if (obj.isVariable) {
            el.style.border = "1px solid rgba(255, 255, 255, 0.5)";
          }
        } else {
          el.innerText = "";
        }
      }
    }
    getSystemComponentColor(className, obj) {
      switch (className) {
        case "TGameLoop":
          return "#2196f3";
        case "TInputController":
          return "#9c27b0";
        case "TRepeater":
          return "#ff9800";
        case "TGameState":
          return "#607d8b";
        case "TGameServer":
          return "#4caf50";
        case "THandshake":
          return "#5c6bc0";
        case "THeartbeat":
          return "#e91e63";
        case "TStageController":
          return "#9c27b0";
        case "TAPIServer":
          return "#f44336";
        case "TDataStore":
          return "#3f51b5";
        default:
          return obj.isVariable ? obj.style?.backgroundColor || "#673ab7" : "#4caf50";
      }
    }
    renderLabel(el, obj) {
      const textValue = obj.text !== void 0 && obj.text !== null ? String(obj.text) : obj.value !== void 0 && obj.value !== null ? String(obj.value) : "";
      if (el.innerText !== textValue) el.innerText = textValue;
      const fs = obj.style?.fontSize || obj.fontSize;
      if (fs) el.style.fontSize = typeof fs === "number" ? `${fs}px` : fs;
      const color = obj.style?.color;
      if (color) {
        el.style.color = color;
      } else {
        el.style.color = "";
      }
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : "normal";
      const fstyle = obj.style?.fontStyle;
      el.style.fontStyle = fstyle === true || fstyle === "italic" ? "italic" : "normal";
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
      el.style.userSelect = "text";
      el.style.cursor = "text";
      const align = obj.style?.textAlign || obj.alignment;
      if (align === "center") el.style.justifyContent = "center";
      else if (align === "right") el.style.justifyContent = "flex-end";
      else el.style.justifyContent = "flex-start";
    }
    renderPanel(el, obj) {
      const textValue = obj.caption || (this.host.runMode ? "" : obj.name);
      if (el.innerText !== textValue) el.innerText = textValue;
      if (!this.host.runMode) {
        el.style.color = obj.style?.color || "#777";
        el.style.fontSize = "12px";
        el.style.justifyContent = "center";
        el.style.alignItems = "center";
      } else {
        if (obj.style?.color) el.style.color = obj.style.color;
        if (obj.style?.fontSize) el.style.fontSize = typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize;
        const align = obj.style?.textAlign || "center";
        el.style.justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
        el.style.alignItems = "center";
      }
    }
    renderGameHeader(el, obj) {
      if (el.innerText !== (obj.title || obj.caption || obj.name)) el.innerText = obj.title || obj.caption || obj.name;
      el.style.fontSize = obj.style?.fontSize ? typeof obj.style.fontSize === "number" ? `${obj.style.fontSize}px` : obj.style.fontSize : "18px";
      if (obj.style?.color) el.style.color = obj.style.color;
      const fw = obj.style?.fontWeight;
      el.style.fontWeight = fw === true || fw === "bold" ? "bold" : fw || "bold";
      const align = obj.style?.textAlign;
      el.style.justifyContent = align === "left" ? "flex-start" : align === "right" ? "flex-end" : "center";
      if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
    }
    renderSprite(el, obj) {
      el.style.backgroundColor = obj.style?.backgroundColor || obj.spriteColor || "#ff6b6b";
      el.style.borderRadius = obj.shape === "circle" ? "50%" : "0";
      if (obj.style?.color) el.style.color = obj.style.color;
      const textValue = obj.caption || (this.host.runMode ? "" : obj.name);
      if (el.innerText !== textValue) el.innerText = textValue;
    }
    renderShape(el, obj, isNew) {
      const shapeType = obj.shapeType || "circle";
      const fillColor = obj.style?.backgroundColor && obj.style.backgroundColor !== "transparent" ? obj.style.backgroundColor : obj.fillColor || "#4fc3f7";
      const strokeColor = obj.style?.borderColor && obj.style.borderColor !== "transparent" ? obj.style.borderColor : obj.strokeColor || "#29b6f6";
      const strokeWidth = obj.style?.borderWidth !== void 0 && obj.style.borderWidth !== 0 ? obj.style.borderWidth : obj.strokeWidth || 0;
      const opacity = obj.style?.opacity ?? obj.opacity ?? 1;
      let svgContent = "";
      if (shapeType === "circle") {
        svgContent = `<circle cx="50" cy="50" r="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
      } else if (shapeType === "square" || shapeType === "rectangle" || shapeType === "rect") {
        svgContent = `<rect x="1" y="1" width="98" height="98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
      } else if (shapeType === "triangle") {
        svgContent = `<polygon points="50,2 2,98 98,98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
      } else if (shapeType === "ellipse") {
        svgContent = `<ellipse cx="50" cy="50" rx="48" ry="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
      }
      if (obj.contentImage) {
        svgContent += `<image href="${obj.contentImage}" x="15" y="15" width="70" height="70" preserveAspectRatio="xMidYMid meet" />`;
      }
      if (obj.text) {
        const fontSize = obj.style?.fontSize || 50;
        const fontColor = obj.style?.color || "#ffffff";
        svgContent += `<text x="50" y="52" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}" fill="${fontColor}" font-family="${obj.style?.fontFamily || "Arial"}">${obj.text}</text>`;
      }
      let svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; top:0; left:0; display:block; overflow:visible; pointer-events:all;">`;
      svgTag += svgContent;
      svgTag += `</svg>`;
      el.innerHTML = svgTag;
      if (isNew) {
        const label = document.createElement("span");
        label.innerText = obj.name;
        label.style.cssText = "position:absolute; font-size:10px; color:rgba(255,255,255,0.5); pointer-events:none;";
        el.appendChild(label);
      }
    }
    renderInspectorTemplate(el, obj) {
      if (this.host.runMode) {
        el.style.display = "none";
      } else {
        el.style.backgroundColor = obj.style?.backgroundColor || "#2a2a2a";
        el.style.flexDirection = "column";
        el.style.alignItems = "stretch";
        el.style.justifyContent = "flex-start";
        el.style.padding = "8px";
        el.style.overflow = "auto";
        el.innerHTML = "";
        const header = document.createElement("div");
        header.className = "inspector-preview-header";
        header.style.cssText = "font-weight:bold;color:#fff;margin-bottom:8px;padding-bottom:4px;border-bottom:1px solid #444";
        header.innerText = "\u{1F4CB} Inspector Designer";
        el.appendChild(header);
        const preview = document.createElement("div");
        preview.className = "inspector-preview";
        preview.style.cssText = "display:flex;flex-direction:column;gap:6px;font-size:11px;color:#ccc";
        const layoutConfig = obj.layoutConfig;
        if (layoutConfig && layoutConfig.properties) {
          const groupedProps = /* @__PURE__ */ new Map();
          const sortedProps = Object.values(layoutConfig.properties).filter((p) => p.visible !== false).sort((a, b) => a.order - b.order);
          sortedProps.forEach((prop) => {
            const groupId = prop.groupId || "default";
            if (!groupedProps.has(groupId)) groupedProps.set(groupId, []);
            groupedProps.get(groupId).push(prop);
          });
          layoutConfig.groups?.sort((a, b) => a.order - b.order).forEach((group) => {
            const props = groupedProps.get(group.id);
            if (props && props.length > 0) {
              const groupEl = document.createElement("div");
              groupEl.style.cssText = "font-weight:bold;color:#888;margin-top:6px;font-size:10px";
              groupEl.innerText = group.label.toUpperCase();
              preview.appendChild(groupEl);
              props.forEach((prop) => {
                const row = document.createElement("div");
                row.style.cssText = "display:flex;align-items:center;gap:4px";
                const label = document.createElement("span");
                label.style.cssText = "flex:1";
                if (prop.style?.color) label.style.color = prop.style.color;
                else label.style.color = "#aaa";
                if (prop.style?.fontSize) label.style.fontSize = prop.style.fontSize;
                label.innerText = prop.label;
                const input = document.createElement("span");
                input.style.cssText = "flex:1;background:#333;padding:2px 4px;border-radius:2px;color:#fff";
                input.innerText = prop.type === "boolean" ? "\u2610" : prop.type === "color" ? "\u{1F3A8}" : prop.type === "select" ? "\u25BC" : "...";
                row.appendChild(label);
                row.appendChild(input);
                preview.appendChild(row);
              });
            }
          });
        }
        el.appendChild(preview);
      }
    }
    renderDialogRoot(el, obj) {
      el.style.borderRadius = "12px";
      el.style.flexDirection = "column";
      el.style.alignItems = "stretch";
      el.style.justifyContent = "flex-start";
      el.style.overflow = "visible";
      if (!el.querySelector(".dialog-title-bar")) {
        const titleBar2 = document.createElement("div");
        titleBar2.className = "dialog-title-bar";
        titleBar2.style.cssText = `display: flex; justify-content: space-between; align-items: center; padding: 8px 12px; border-bottom: 1px solid ${obj.style?.borderColor || "#4fc3f7"}; color: #fff; font-weight: bold;`;
        titleBar2.textContent = obj.caption || obj.title || obj.name;
        el.appendChild(titleBar2);
      }
      const titleBar = el.querySelector(".dialog-title-bar");
      if (titleBar && titleBar.textContent !== (obj.caption || obj.title || obj.name)) {
        titleBar.textContent = obj.caption || obj.title || obj.name;
      }
      if (!this.host.runMode && obj.children && Array.isArray(obj.children)) {
        const cellSize = this.host.grid.cellSize;
        const parentX = obj.x * cellSize;
        const parentY = obj.y * cellSize;
        obj.children.forEach((child) => {
          let childEl = this.host.element.querySelector(`[data-id="${child.id}"]`);
          if (!childEl) {
            childEl = document.createElement("div");
            childEl.className = "game-object dialog-child";
            childEl.setAttribute("data-id", child.id);
            childEl.style.position = "absolute";
            childEl.style.boxSizing = "border-box";
            childEl.style.display = "flex";
            childEl.style.alignItems = "center";
            childEl.style.justifyContent = "center";
            this.host.element.appendChild(childEl);
          }
          const childX = parentX + (child.x || 0) * cellSize;
          const childY = parentY + (child.y || 0) * cellSize + 30;
          childEl.style.left = `${childX}px`;
          childEl.style.top = `${childY}px`;
          childEl.style.width = `${(child.width || 4) * cellSize}px`;
          childEl.style.height = `${(child.height || 2) * cellSize}px`;
          childEl.style.zIndex = "10";
          childEl.setAttribute("data-parent-x", (parentX / cellSize).toString());
          childEl.setAttribute("data-parent-y", ((parentY + 30) / cellSize).toString());
          if (child.style) {
            childEl.style.backgroundColor = child.style.backgroundColor || "transparent";
            childEl.style.border = `${child.style.borderWidth || 0}px solid ${child.style.borderColor || "transparent"}`;
            if (child.style.color) childEl.style.color = child.style.color;
          }
          const childClassName = child.className || child.constructor?.name;
          if (childClassName === "TButton") {
            childEl.innerText = child.caption || child.name;
            childEl.style.fontWeight = "bold";
            childEl.style.cursor = "pointer";
          } else if (childClassName === "TLabel" || child.text) {
            childEl.innerText = child.text || "";
          } else if (childClassName === "TEdit") {
            if (!childEl.querySelector("input")) {
              const input = document.createElement("input");
              input.type = "text";
              input.style.cssText = "width:100%;height:100%;border:none;background:transparent;padding:0 8px;font-size:inherit;";
              childEl.appendChild(input);
            }
          } else {
            childEl.innerText = child.name || "";
          }
          this.updateSelectionState(childEl, child.id);
        });
      }
    }
    updateSelectionState(el, id) {
      if (this.host.selectedIds.has(id)) {
        el.classList.add("selected");
        el.style.overflow = "visible";
        el.style.outline = "2px solid #4fc3f7";
        if (!el.querySelector(".resize-handle")) {
          this.addResizeHandles(el);
        }
      } else {
        el.classList.remove("selected");
        el.style.overflow = "hidden";
        el.style.outline = "none";
        el.querySelectorAll(".resize-handle").forEach((h) => h.remove());
      }
    }
    addResizeHandles(el) {
      const handleSize = 6;
      const handles = ["n", "s", "e", "w", "nw", "ne", "sw", "se"];
      const handleStyles = {
        "nw": { top: "-6px", left: "-6px", cursor: "nwse-resize" },
        "n": { top: "-6px", left: "50%", cursor: "ns-resize", transform: "translateX(-50%)" },
        "ne": { top: "-6px", right: "-6px", cursor: "nesw-resize" },
        "w": { top: "50%", left: "-6px", cursor: "ew-resize", transform: "translateY(-50%)" },
        "e": { top: "50%", right: "-6px", cursor: "ew-resize", transform: "translateY(-50%)" },
        "sw": { bottom: "-6px", left: "-6px", cursor: "nesw-resize" },
        "s": { bottom: "-6px", left: "50%", cursor: "ns-resize", transform: "translateX(-50%)" },
        "se": { bottom: "-6px", right: "-6px", cursor: "nwse-resize" }
      };
      handles.forEach((dir) => {
        const handle = document.createElement("div");
        handle.className = `resize-handle ${dir}`;
        handle.style.position = "absolute";
        handle.style.width = `${handleSize}px`;
        handle.style.height = `${handleSize}px`;
        handle.style.backgroundColor = "#000000";
        handle.style.zIndex = "100";
        handle.style.cursor = handleStyles[dir].cursor;
        if (handleStyles[dir].top) handle.style.top = handleStyles[dir].top;
        if (handleStyles[dir].bottom) handle.style.bottom = handleStyles[dir].bottom;
        if (handleStyles[dir].left) handle.style.left = handleStyles[dir].left;
        if (handleStyles[dir].right) handle.style.right = handleStyles[dir].right;
        if (handleStyles[dir].transform) handle.style.transform = handleStyles[dir].transform;
        el.appendChild(handle);
      });
    }
    static renderTable(el, obj, onEvent, cellSize = 20) {
      TableRenderer.renderTable(el, obj, onEvent, cellSize);
    }
    static renderEmojiPicker(el, obj, cellSize, onEvent) {
      EmojiPickerRenderer.renderEmojiPicker(el, obj, cellSize, onEvent);
    }
  };

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
      __publicField(this, "element");
      // From StageHost
      __publicField(this, "techClasses", ["TGameLoop", "TInputController", "TGameState", "TTimer", "TRemoteGameManager", "TGameServer", "THandshake", "THeartbeat", "TStageController"]);
      __publicField(this, "currentProject", null);
      __publicField(this, "isStarted", false);
      __publicField(this, "animationTickerId", null);
      __publicField(this, "renderer");
      // --- StageHost Implementation ---
      __publicField(this, "runMode", true);
      __publicField(this, "isBlueprint", false);
      __publicField(this, "selectedIds", /* @__PURE__ */ new Set());
      __publicField(this, "lastRenderedObjects", []);
      __publicField(this, "onEvent", null);
      // --------------------------------
      // Drag & Drop State
      __publicField(this, "dragTarget", null);
      __publicField(this, "dragPhantom", null);
      __publicField(this, "isDragging", false);
      __publicField(this, "dragOffset", { x: 0, y: 0 });
      this.element = document.getElementById("run-stage");
      this.renderer = new StageRenderer(this);
      this.onEvent = (id, ev, data) => {
        if (this.runtime) this.runtime.handleEvent(id, ev, data);
      };
      this.init();
    }
    get grid() {
      const activeStage = this.runtime ? this.runtime.stage : this.currentProject?.stage || this.currentProject?.stages?.[0];
      if (!activeStage?.grid) {
        console.warn(`%c[UniversalPlayer:Grid] Fallback to 20px because grid is missing in ${activeStage?.name || "unknown stage"}`, "color: red");
        return {
          cols: 64,
          rows: 40,
          cellSize: 20,
          snapToGrid: true,
          visible: true,
          backgroundColor: "#ffffff"
        };
      }
      return activeStage.grid;
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
        this.element.innerHTML = "";
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
      if (target.startsWith("stage:")) {
        const stageId = target.substring(6);
        this.handleStageNavigation(stageId);
      } else if (target.startsWith("game:")) {
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
    /**
     * Robuste Stage-Navigation für Standalone/Server-Umfeld.
     * Nutzt TStageController wenn vorhanden, sonst direkten Runtime-Aufruf.
     */
    handleStageNavigation(stageId) {
      if (!this.runtime || !this.currentProject) {
        console.warn(`[UniversalPlayer] Cannot navigate to stage '${stageId}': no active runtime.`);
        return;
      }
      const stageExists = this.currentProject.stages?.some((s) => s.id === stageId);
      if (!stageExists) {
        console.warn(`[UniversalPlayer] Stage '${stageId}' not found in project.stages.`);
        return;
      }
      const objects = this.runtime.getObjects();
      const stageController = objects.find(
        (o) => o.className === "TStageController" || o.constructor?.name === "TStageController"
      );
      if (stageController && typeof stageController.goToStage === "function") {
        console.log(`[UniversalPlayer] Stage navigation via TStageController \u2192 ${stageId}`);
        stageController.goToStage(stageId);
      } else {
        console.log(`[UniversalPlayer] Stage navigation via direct runtime call \u2192 ${stageId}`);
        this.runtime.handleStageChange(
          this.runtime.stage?.id || "",
          stageId
        );
      }
    }
    setupScaling() {
      if (!this.currentProject) return;
      const activeStage = this.runtime ? this.runtime.stage : this.currentProject.stage || this.currentProject.stages?.[0];
      if (!activeStage || !activeStage.grid) {
        console.warn("%c[UniversalPlayer:Layout] No active stage or grid found for scaling", "color: orange");
        return;
      }
      const grid = activeStage.grid;
      const cellSize = grid.cellSize || 32;
      const stageWidth = grid.cols * cellSize;
      const stageHeight = grid.rows * cellSize;
      const windowWidth = window.innerWidth;
      const windowHeight = window.innerHeight;
      const margin = 20;
      const scale = Math.min((windowWidth - margin) / stageWidth, (windowHeight - margin) / stageHeight, 1);
      console.log(`%c[UniversalPlayer:Layout] Scaling Stage "${activeStage.name || activeStage.id}": cellSize=${cellSize}, size=${stageWidth}x${stageHeight}, scale=${scale.toFixed(3)}`, "color: #00ff00; font-weight: bold");
      this.element.style.width = `${stageWidth}px`;
      this.element.style.height = `${stageHeight}px`;
      this.element.style.transform = `translate(-50%, -50%) scale(${scale})`;
      this.element.style.left = "50%";
      this.element.style.top = "50%";
      this.element.style.position = "absolute";
      const bg = grid.backgroundColor || "#ffffff";
      const bgImg = activeStage.backgroundImage;
      if (bgImg) {
        const url = bgImg.startsWith("http") || bgImg.startsWith("/") || bgImg.startsWith("data:") ? bgImg : `./images/${bgImg}`;
        this.element.style.background = `url("${url}") center center / ${activeStage.objectFit || "cover"} no-repeat, ${bg}`;
      } else {
        this.element.style.background = bg;
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
      const objects = this.runtime.getObjects().filter((obj) => !this.techClasses.includes(obj.className));
      this.renderer.renderObjects(objects);
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
      const rect = this.element.getBoundingClientRect();
      const relativeX = clientX - rect.left;
      const relativeY = clientY - rect.top;
      const style = window.getComputedStyle(this.element);
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
