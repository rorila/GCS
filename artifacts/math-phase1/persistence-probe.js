"use strict";
(() => {
  var __defProp = Object.defineProperty;
  var __getOwnPropNames = Object.getOwnPropertyNames;
  var __esm = (fn, res) => function __init() {
    return fn && (res = (0, fn[__getOwnPropNames(fn)[0]])(fn = 0)), res;
  };
  var __export = (target, all) => {
    for (var name in all)
      __defProp(target, name, { get: all[name], enumerable: true });
  };

  // <define:import.meta.env>
  var define_import_meta_env_default;
  var init_define_import_meta_env = __esm({
    "<define:import.meta.env>"() {
      define_import_meta_env_default = {};
    }
  });

  // src/utils/LogTypes.ts
  var init_LogTypes = __esm({
    "src/utils/LogTypes.ts"() {
      "use strict";
      init_define_import_meta_env();
    }
  });

  // src/config.ts
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
  var env, Config;
  var init_config = __esm({
    "src/config.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_LogTypes();
      env = define_import_meta_env_default || {};
      Config = {
        APP_TITLE: env.VITE_APP_TITLE || "GCS Game Builder",
        // Globales Log-Level
        LOG_LEVEL: parseLogLevel(env.VITE_LOG_LEVEL),
        // Spezifische Log-Level für einzelne Präfixe/Klassen
        // Beispiel in .env: VITE_LOG_LEVEL_StageRenderer=DEBUG
        PREFIX_LOG_LEVELS: parsePrefixLogLevels(env)
      };
    }
  });

  // src/utils/Logger.ts
  var Logger;
  var init_Logger = __esm({
    "src/utils/Logger.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_config();
      init_LogTypes();
      Logger = class _Logger {
        static logHandler;
        static globalLevel = Config.LOG_LEVEL;
        static useCaseFilter = () => false;
        static useCaseLabelProvider = (id) => id;
        static lastUseCaseId = void 0;
        prefix;
        level;
        useCase;
        constructor(prefix = "", useCase, level) {
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
        /**
         * PERF: Prueft, ob eine Ausgabe fuer dieses Level ueberhaupt erfolgen wuerde.
         * Aufrufer in heissen Pfaden (Render-Loop) koennen damit die Konstruktion
         * teurer Nachrichten (Template-Strings, JSON, Objekt-Traversierung) vermeiden.
         */
        isEnabled(level) {
          if (level < this.level || level < _Logger.globalLevel) return false;
          if (level < 3 /* ERROR */ && this.useCase && !_Logger.useCaseFilter(this.useCase)) return false;
          return true;
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
            const safeStringify = (a) => {
              if (typeof a !== "object" || a === null) return String(a);
              try {
                const seen = /* @__PURE__ */ new WeakSet();
                return JSON.stringify(a, (key, value) => {
                  if (["renderer", "host", "parent", "stage", "editor", "_listeners", "_eventTarget"].includes(key)) return void 0;
                  if (typeof value === "object" && value !== null) {
                    if (seen.has(value)) return "[Circular]";
                    seen.add(value);
                  }
                  return value;
                });
              } catch {
                return "[Object]";
              }
            };
            _Logger.logHandler(level, this.prefix, args.map(safeStringify).join(" "), this.useCase);
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
    }
  });

  // src/utils/BlobUrlCache.ts
  function dataUrlToBlobUrl(src) {
    if (!src || !src.startsWith("data:")) return src;
    const cached = blobUrlByDataUrl.get(src);
    if (cached) return cached;
    const comma = src.indexOf(",");
    if (comma < 0) return src;
    const meta = src.slice(5, comma);
    if (!meta.endsWith(";base64")) return src;
    try {
      const binary = atob(src.slice(comma + 1));
      const bytes = new Uint8Array(binary.length);
      for (let i = 0; i < binary.length; i++) {
        bytes[i] = binary.charCodeAt(i);
      }
      const blob = new Blob([bytes], { type: meta.slice(0, -7) });
      const blobUrl = URL.createObjectURL(blob);
      blobUrlByDataUrl.set(src, blobUrl);
      return blobUrl;
    } catch (err2) {
      logger2.warn("[dataUrlToBlobUrl] Umwandlung fehlgeschlagen, nutze Original.", err2);
      return src;
    }
  }
  function cssUrlToBlobUrl(cssUrl) {
    if (!cssUrl) return cssUrl;
    let inner = cssUrl.trim();
    if (!inner.startsWith("url(") || !inner.endsWith(")")) return cssUrl;
    inner = inner.slice(4, -1).trim();
    if (inner.startsWith('"') || inner.startsWith("'")) inner = inner.slice(1, -1);
    if (!inner.startsWith("data:")) return cssUrl;
    const blobUrl = dataUrlToBlobUrl(inner);
    if (blobUrl === inner) return cssUrl;
    return `url("${blobUrl}")`;
  }
  var logger2, blobUrlByDataUrl;
  var init_BlobUrlCache = __esm({
    "src/utils/BlobUrlCache.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_Logger();
      logger2 = Logger.get("BlobUrlCache");
      blobUrlByDataUrl = /* @__PURE__ */ new Map();
    }
  });

  // package.json
  var version;
  var init_package = __esm({
    "package.json"() {
      version = "3.9.1";
    }
  });

  // src/utils/PerfOverlay.ts
  var PerfOverlay;
  var init_PerfOverlay = __esm({
    "src/utils/PerfOverlay.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_GameLoopManager();
      init_package();
      PerfOverlay = class _PerfOverlay {
        static instance = null;
        el = null;
        autoCheckbox = null;
        textEl = null;
        rafId = null;
        running = false;
        // Frame-Messung der laufenden Sekunde
        lastFrameTime = 0;
        secondStart = 0;
        frameCount = 0;
        worstFrameMs = 0;
        // Kumulative Werte
        hitchCount = 0;
        worstEverMs = 0;
        gcCount = 0;
        // Heap-Beobachtung
        lastHeap = 0;
        allocBytes = 0;
        // Trennung: eigene JS-Arbeit im Loop vs. alles andere (Paint/Raster/Compositing)
        workStart = 0;
        lastWorkMs = 0;
        worstWorkMs = 0;
        worstRestMs = 0;
        shownWorkMs = 0;
        shownRestMs = 0;
        // Mittelwerte: der Maximalwert allein sagt nicht, ob eine Sekunde
        // durchgehend teuer war oder nur einen Ausreisser enthielt.
        workSumMs = 0;
        workFrames = 0;
        shownWorkAvgMs = 0;
        // Phasen-Aufschluesselung der Loop-Arbeit (Summen der laufenden Sekunde)
        phaseStart = { spr: 0, upd: 0, anim: 0, interp: 0, coll: 0, dom: 0, timer: 0, ev: 0 };
        phaseSum = { spr: 0, upd: 0, anim: 0, interp: 0, coll: 0, dom: 0, timer: 0, ev: 0 };
        shownPhase = { spr: 0, upd: 0, anim: 0, interp: 0, coll: 0, dom: 0, timer: 0, ev: 0 };
        // Kontext, ohne den die Phasenzeiten nicht einzuordnen sind: Wie viele
        // Physikschritte lief die Fixed-Step-Schleife, und wie viele Sprites
        // stecken ueberhaupt in der Liste (Pool-Instanzen zaehlen mit).
        stepsSum = 0;
        shownStepsAvg = 0;
        spriteCount = 0;
        timerTickCount = 0;
        shownTimerTickCount = 0;
        lastSlowEvent = null;
        shownSlowEvent = "-";
        SLOW_EVENT_MS = 16;
        // Anzeigewerte der letzten abgeschlossenen Sekunde
        fps = 0;
        shownWorstMs = 0;
        allocPerSec = 0;
        // Snapshot des letzten sichtbaren Aussetzers (bleibt 3 Sekunden stehen)
        lastHitchSnapshot = null;
        HITCH_FREEZE_MS = 3e3;
        staticInfo = "";
        /** Ab dieser Frame-Dauer gilt ein Frame als sichtbarer Aussetzer. */
        HITCH_MS = 50;
        constructor() {
          this.tick = this.tick.bind(this);
        }
        static getInstance() {
          if (!_PerfOverlay.instance) {
            _PerfOverlay.instance = new _PerfOverlay();
          }
          return _PerfOverlay.instance;
        }
        /**
         * Prueft die URL und startet die Anzeige nur bei ausdruecklicher Anforderung.
         * Zusaetzlich werden Umschalter registriert, weil sich auf einem fremden
         * Geraet die URL oft nicht bequem aendern laesst.
         */
        static startIfRequested() {
          if (typeof window === "undefined") return;
          _PerfOverlay.installCornerGesture();
          window.addEventListener("keydown", (e) => {
            const isF9 = e.key === "F9";
            const isCombo = e.ctrlKey && e.shiftKey && (e.key === "P" || e.key === "p");
            if (isF9 || isCombo) {
              _PerfOverlay.getInstance().toggle();
            }
          });
          try {
            const params = new URLSearchParams(window.location.search);
            const wanted = params.get("perf") || "";
            const debugParam = (params.get("debug") || "").toLowerCase();
            const enabled = wanted === "1" || wanted.toLowerCase() === "true" || debugParam === "perf";
            if (enabled) {
              _PerfOverlay.getInstance().start();
            }
          } catch (e) {
          }
        }
        /**
         * Aktivierung ohne Tastatur: dreimal kurz hintereinander in die linke obere
         * Bildschirmecke tippen oder klicken.
         *
         * Bewusst so gewaehlt, dass es das Spiel nicht stoert:
         * - Nur ein kleines Eckfeld reagiert.
         * - Es sind drei Beruehrungen innerhalb von 1,5 Sekunden noetig.
         * - Das Ereignis wird nur mitgelesen (capture) und NICHT abgefangen —
         *   `preventDefault`/`stopPropagation` werden nicht aufgerufen, damit die
         *   Spielsteuerung unveraendert weiterlaeuft.
         */
        static installCornerGesture() {
          const CORNER_PX = 64;
          const WINDOW_MS = 1500;
          const NEEDED_TAPS = 3;
          let tapCount = 0;
          let firstTapTime = 0;
          window.addEventListener("pointerdown", (e) => {
            if (e.clientX > CORNER_PX || e.clientY > CORNER_PX) return;
            const now = performance.now();
            if (now - firstTapTime > WINDOW_MS) {
              firstTapTime = now;
              tapCount = 1;
              return;
            }
            tapCount++;
            if (tapCount >= NEEDED_TAPS) {
              tapCount = 0;
              firstTapTime = 0;
              _PerfOverlay.getInstance().toggle();
            }
          }, true);
        }
        toggle() {
          if (this.running) {
            this.stop();
          } else {
            this.start();
          }
        }
        /**
         * Markiert den Beginn der eigenen Loop-Arbeit (Physik, Kollision, DOM-Update).
         * Ist die Anzeige aus, kostet der Aufruf nur eine Null-Pruefung.
         */
        static markWorkBegin() {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running) return;
          inst.workStart = performance.now();
        }
        /** Markiert das Ende der eigenen Loop-Arbeit. */
        static markWorkEnd() {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running || inst.workStart === 0) return;
          const ms = performance.now() - inst.workStart;
          inst.workStart = 0;
          inst.lastWorkMs = ms;
          if (ms > inst.worstWorkMs) inst.worstWorkMs = ms;
          inst.workSumMs += ms;
          inst.workFrames++;
        }
        /** Startet die Messung eines Loop-Abschnitts. */
        static phaseBegin(phase) {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running) return;
          inst.phaseStart[phase] = performance.now();
        }
        /** Beendet die Messung eines Loop-Abschnitts und summiert die Dauer. Liefert die Dauer zurück. */
        static phaseEnd(phase) {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running) return void 0;
          const start = inst.phaseStart[phase];
          if (start === 0) return void 0;
          inst.phaseStart[phase] = 0;
          const ms = performance.now() - start;
          inst.phaseSum[phase] += ms;
          return ms;
        }
        static markTimerTick() {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running) return;
          inst.timerTickCount++;
        }
        static markSlowEvent(name, ms) {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running) return;
          if (ms > inst.SLOW_EVENT_MS) {
            inst.lastSlowEvent = { name, ms };
          }
        }
        /**
         * Meldet Rahmendaten des Frames: Anzahl der Physikschritte und Groesse der
         * Sprite-Liste. Ohne diese Werte laesst sich nicht unterscheiden, ob eine
         * Phase teuer ist oder nur oft ausgefuehrt wird.
         */
        static markFrameStats(steps, sprites) {
          const inst = _PerfOverlay.instance;
          if (!inst || !inst.running) return;
          inst.stepsSum += steps;
          inst.spriteCount = sprites;
        }
        /** Setzt alle Phasensummen der abgelaufenen Sekunde zurueck. */
        resetPhaseSums() {
          this.phaseSum.spr = 0;
          this.phaseSum.upd = 0;
          this.phaseSum.anim = 0;
          this.phaseSum.interp = 0;
          this.phaseSum.coll = 0;
          this.phaseSum.dom = 0;
          this.phaseSum.timer = 0;
          this.phaseSum.ev = 0;
        }
        start() {
          if (this.running) return;
          this.running = true;
          this.staticInfo = this.collectStaticInfo();
          const begin = () => {
            this.createElement();
            const now = performance.now();
            this.lastFrameTime = now;
            this.secondStart = now;
            this.lastHeap = this.readHeap()?.usedJSHeapSize || 0;
            this.rafId = requestAnimationFrame(this.tick);
          };
          if (document.body) {
            begin();
          } else {
            window.addEventListener("DOMContentLoaded", begin, { once: true });
          }
        }
        stop() {
          this.running = false;
          if (this.rafId !== null) {
            cancelAnimationFrame(this.rafId);
            this.rafId = null;
          }
          if (this.el && this.el.parentNode) {
            this.el.parentNode.removeChild(this.el);
          }
          this.el = null;
        }
        // ─────────────────────────────────────────────────────────────
        // Messung
        // ─────────────────────────────────────────────────────────────
        tick(now) {
          if (!this.running) return;
          const frameMs = now - this.lastFrameTime;
          this.lastFrameTime = now;
          this.frameCount++;
          if (frameMs > this.worstFrameMs) this.worstFrameMs = frameMs;
          if (frameMs > this.worstEverMs) this.worstEverMs = frameMs;
          if (frameMs > this.HITCH_MS) {
            this.hitchCount++;
            this.lastHitchSnapshot = {
              frameMs,
              workMs: this.lastWorkMs,
              restMs: frameMs - this.lastWorkMs,
              time: now
            };
          }
          const restMs = frameMs - this.lastWorkMs;
          if (restMs > this.worstRestMs) this.worstRestMs = restMs;
          const heap = this.readHeap();
          if (heap) {
            const used = heap.usedJSHeapSize;
            const delta = used - this.lastHeap;
            if (delta > 0) {
              this.allocBytes += delta;
            } else if (delta < 0) {
              this.gcCount++;
            }
            this.lastHeap = used;
          }
          const elapsed = now - this.secondStart;
          if (elapsed >= 1e3) {
            this.fps = Math.round(this.frameCount * 1e3 / elapsed);
            this.shownWorstMs = this.worstFrameMs;
            this.shownWorkMs = this.worstWorkMs;
            this.shownRestMs = this.worstRestMs;
            this.allocPerSec = this.allocBytes;
            const loopFrames = this.workFrames || 1;
            this.shownWorkAvgMs = this.workSumMs / loopFrames;
            this.shownPhase.spr = this.phaseSum.spr / loopFrames;
            this.shownPhase.upd = this.phaseSum.upd / loopFrames;
            this.shownPhase.anim = this.phaseSum.anim / loopFrames;
            this.shownPhase.interp = this.phaseSum.interp / loopFrames;
            this.shownPhase.coll = this.phaseSum.coll / loopFrames;
            this.shownPhase.dom = this.phaseSum.dom / loopFrames;
            this.shownPhase.timer = this.phaseSum.timer / loopFrames;
            this.shownPhase.ev = this.phaseSum.ev / loopFrames;
            this.shownStepsAvg = this.stepsSum / loopFrames;
            this.shownTimerTickCount = this.timerTickCount;
            this.timerTickCount = 0;
            this.shownSlowEvent = this.lastSlowEvent ? `${this.lastSlowEvent.name} ${this.lastSlowEvent.ms.toFixed(1)}ms` : "-";
            this.lastSlowEvent = null;
            this.frameCount = 0;
            this.worstFrameMs = 0;
            this.worstWorkMs = 0;
            this.worstRestMs = 0;
            this.workSumMs = 0;
            this.workFrames = 0;
            this.stepsSum = 0;
            this.resetPhaseSums();
            this.allocBytes = 0;
            this.secondStart = now;
            this.render();
          }
          this.rafId = requestAnimationFrame(this.tick);
        }
        readHeap() {
          const mem = performance.memory;
          if (mem && typeof mem.usedJSHeapSize === "number") {
            return mem;
          }
          return null;
        }
        // ─────────────────────────────────────────────────────────────
        // Darstellung
        // ─────────────────────────────────────────────────────────────
        createElement() {
          if (this.el) return;
          const el = document.createElement("div");
          el.id = "perf-overlay";
          const s = el.style;
          s.position = "fixed";
          s.top = "0";
          s.left = "0";
          s.zIndex = "2147483647";
          s.background = "rgba(0, 0, 0, 0.88)";
          s.color = "#00ff66";
          s.font = '16px/1.45 Consolas, "Courier New", monospace';
          s.padding = "28px 14px 10px 14px";
          s.minWidth = "200px";
          s.margin = "0";
          s.whiteSpace = "pre";
          s.pointerEvents = "none";
          s.borderBottomRightRadius = "4px";
          s.textShadow = "none";
          const checkbox = document.createElement("input");
          checkbox.type = "checkbox";
          checkbox.checked = GameLoopManager.getInstance().getAutoAdjustFPS();
          checkbox.style.pointerEvents = "auto";
          checkbox.onchange = () => {
            GameLoopManager.getInstance().setAutoAdjustFPS(checkbox.checked);
          };
          const label = document.createElement("label");
          label.style.cssText = "position:absolute;top:4px;right:8px;display:inline-flex;align-items:center;gap:4px;cursor:pointer;pointer-events:auto;";
          label.appendChild(checkbox);
          label.appendChild(document.createTextNode(" Auto FPS"));
          const pre = document.createElement("pre");
          pre.style.cssText = "margin:0;white-space:pre;pointer-events:none;";
          el.appendChild(label);
          el.appendChild(pre);
          document.body.appendChild(el);
          this.el = el;
          this.autoCheckbox = checkbox;
          this.textEl = pre;
        }
        render() {
          if (!this.el || !this.textEl) return;
          if (this.autoCheckbox) {
            this.autoCheckbox.checked = GameLoopManager.getInstance().getAutoAdjustFPS();
          }
          const heap = this.readHeap();
          const usedMb = heap ? (heap.usedJSHeapSize / 1048576).toFixed(1) : "?";
          const limitMb = heap ? (heap.jsHeapSizeLimit / 1048576).toFixed(0) : "?";
          const allocMb = (this.allocPerSec / 1048576).toFixed(2);
          this.el.style.color = this.shownWorstMs > this.HITCH_MS ? "#ff5555" : "#00ff66";
          const target = GameLoopManager.getInstance().getTargetFPS();
          const targetStr = GameLoopManager.getInstance().getAutoAdjustFPS() ? String(target) : `${target} (manuell)`;
          let frozenLine = "";
          if (this.lastHitchSnapshot) {
            const age = performance.now() - this.lastHitchSnapshot.time;
            if (age < this.HITCH_FREEZE_MS) {
              frozenLine = `LAST DROP  ${this.lastHitchSnapshot.frameMs.toFixed(0)}ms  js ${this.lastHitchSnapshot.workMs.toFixed(1)}  rest ${this.lastHitchSnapshot.restMs.toFixed(0)}
`;
            }
          }
          this.textEl.textContent = `FPS ${this.fps}   target ${targetStr}   worst ${this.shownWorstMs.toFixed(0)}ms
js \xF8${this.shownWorkAvgMs.toFixed(1)} / max ${this.shownWorkMs.toFixed(1)}ms   rest ${this.shownRestMs.toFixed(0)}ms
spr ${this.shownPhase.spr.toFixed(1)}  upd ${this.shownPhase.upd.toFixed(1)}  anim ${this.shownPhase.anim.toFixed(1)}  interp ${this.shownPhase.interp.toFixed(1)}
coll ${this.shownPhase.coll.toFixed(1)}  dom ${this.shownPhase.dom.toFixed(1)}  timer ${this.shownPhase.timer.toFixed(1)}  ev ${this.shownPhase.ev.toFixed(1)} (\xF8ms)
ticks ${this.shownTimerTickCount}  slow ${this.shownSlowEvent}
steps \xF8${this.shownStepsAvg.toFixed(2)}   sprites ${this.spriteCount}
hitches ${this.hitchCount}  (max ${this.worstEverMs.toFixed(0)}ms)
` + frozenLine + `alloc ${allocMb} MB/s   GC ${this.gcCount}
heap ${usedMb} / ${limitMb} MB
` + this.staticInfo;
        }
        collectStaticInfo() {
          const nav = navigator;
          const ram = typeof nav.deviceMemory === "number" ? `${nav.deviceMemory} GB` : "?";
          const cores = typeof nav.hardwareConcurrency === "number" ? nav.hardwareConcurrency : "?";
          const dpr = window.devicePixelRatio || 1;
          const w = window.innerWidth;
          const h = window.innerHeight;
          const version2 = version || "?";
          return `v${version2}  RAM ${ram}  cores ${cores}  dpr ${dpr}
view ${w}x${h}
gpu ${this.detectGpu()}`;
        }
        /**
         * Liest den GPU-Namen einmalig ueber WebGL aus. Die Grafikspeichergroesse
         * ist im Browser grundsaetzlich nicht abfragbar — nur der Treibername.
         */
        detectGpu() {
          try {
            const canvas = document.createElement("canvas");
            const gl = canvas.getContext("webgl") || canvas.getContext("experimental-webgl");
            if (!gl) return "kein WebGL";
            const info = gl.getExtension("WEBGL_debug_renderer_info");
            let name = "unbekannt";
            if (info) {
              name = String(gl.getParameter(info.UNMASKED_RENDERER_WEBGL) || "unbekannt");
            }
            const lose = gl.getExtension("WEBGL_lose_context");
            if (lose) lose.loseContext();
            return name.length > 38 ? name.substring(0, 38) : name;
          } catch (e) {
            return "nicht ermittelbar";
          }
        }
      };
    }
  });

  // src/runtime/InputManager.ts
  var InputManager;
  var init_InputManager = __esm({
    "src/runtime/InputManager.ts"() {
      "use strict";
      init_define_import_meta_env();
      InputManager = class {
        update(controllers) {
          for (const ic of controllers) {
            if (ic && typeof ic.update === "function") {
              ic.update();
            }
          }
        }
      };
    }
  });

  // src/runtime/RenderLoop.ts
  var RenderLoop;
  var init_RenderLoop = __esm({
    "src/runtime/RenderLoop.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_AnimationManager();
      RenderLoop = class {
        renderCallback = null;
        spriteRenderCallback = null;
        dirtySprites = /* @__PURE__ */ new Set();
        renderObjectBuffer = [];
        renderObjectSeen = /* @__PURE__ */ new Set();
        setCallbacks(renderCallback, spriteRenderCallback) {
          this.renderCallback = renderCallback;
          this.spriteRenderCallback = spriteRenderCallback;
        }
        markSpriteDirty(sprite) {
          this.dirtySprites.add(sprite);
        }
        getAndClearDirtySprites() {
          const sprites = Array.from(this.dirtySprites);
          this.dirtySprites.clear();
          return sprites;
        }
        syncRenderCoordinates(sprites) {
          for (const sprite of sprites) {
            sprite.renderX = sprite.x;
            sprite.renderY = sprite.y;
          }
        }
        updateRenderPositions(sprites, alpha) {
          for (const sprite of sprites) {
            if (!sprite.visible) continue;
            const dx = sprite.x - sprite.previousX;
            const dy = sprite.y - sprite.previousY;
            sprite.renderX = sprite.x + dx * alpha;
            sprite.renderY = sprite.y + dy * alpha;
          }
        }
        collectRenderObjects(sprites) {
          const out = this.renderObjectBuffer;
          out.length = 0;
          const animationManager = AnimationManager.getInstance();
          if (!animationManager.hasActiveTweens()) {
            for (let i = 0; i < sprites.length; i++) {
              out.push(sprites[i]);
            }
            return out;
          }
          const seen = this.renderObjectSeen;
          seen.clear();
          for (let i = 0; i < sprites.length; i++) {
            const sprite = sprites[i];
            if (seen.has(sprite)) continue;
            seen.add(sprite);
            out.push(sprite);
          }
          const animated = animationManager.getAnimatedObjects();
          for (let i = 0; i < animated.length; i++) {
            const obj = animated[i];
            if (seen.has(obj)) continue;
            seen.add(obj);
            out.push(obj);
          }
          seen.clear();
          return out;
        }
        render(objects, dirtySprites) {
          if (this.spriteRenderCallback) {
            this.spriteRenderCallback(objects, dirtySprites);
          } else if (this.renderCallback) {
            this.renderCallback();
          }
        }
        clear() {
          this.dirtySprites.clear();
          this.renderObjectBuffer.length = 0;
          this.renderObjectSeen.clear();
          this.renderCallback = null;
          this.spriteRenderCallback = null;
        }
      };
    }
  });

  // src/runtime/PhysicsEngine.ts
  var logger3, PhysicsEngine;
  var init_PhysicsEngine = __esm({
    "src/runtime/PhysicsEngine.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_Logger();
      logger3 = Logger.get("PhysicsEngine", "Runtime_Execution");
      PhysicsEngine = class {
        /**
         * Löst eine Kollision zwischen zwei Sprites durch Push-Out auf.
         * Das schnellere Sprite (nach Betrag der Geschwindigkeit) wird bewegt;
         * seine Geschwindigkeit auf der aufgelösten Achse wird genullt, damit
         * z.B. Gravitation nicht ungebremst weiter aufschaukelt.
         */
        static resolveSpriteCollision(spriteA, spriteB, overlap) {
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
        }
        /**
         * Löst eine Kollision zwischen Sprite und Panel durch Push-Out auf.
         */
        static resolvePanelCollision(sprite, hitSide, depth, boundaryMode) {
          logger3.debug(`[PHYSICS] pre-resolution y: ${sprite.y}, hitSide: ${hitSide}`);
          if (hitSide === "left" || hitSide === "right") {
            sprite.x -= (hitSide === "left" ? -1 : 1) * depth;
            if (boundaryMode === "bounce") {
              sprite.velocityX = -sprite.velocityX;
            } else {
              sprite.velocityX = 0;
            }
          } else {
            sprite.y -= (hitSide === "top" ? -1 : 1) * depth;
            if (boundaryMode === "bounce") {
              sprite.velocityY = -sprite.velocityY;
            } else {
              sprite.velocityY = 0;
            }
          }
          logger3.debug(`[PHYSICS] post-resolution y: ${sprite.y}, resolved on ${hitSide}`);
        }
        /**
         * Wendet die reaktive Randbehandlung (clamp oder bounce) auf ein Sprite an.
         * Nur aufgerufen, wenn ein onBoundaryHit-Handler existiert.
         */
        static applyBoundaryResponse(sprite, side, bounds, boundaryMode) {
          const EPSILON = 0.01;
          if (boundaryMode === "clamp") {
            if (side === "left" || side === "right") {
              sprite._prevVelocityX = sprite.velocityX;
              sprite.velocityX = 0;
            }
            if (side === "top" || side === "bottom") {
              sprite._prevVelocityY = sprite.velocityY;
              sprite.velocityY = 0;
            }
            if (side === "left") sprite.x = EPSILON;
            if (side === "right") sprite.x = bounds.width - sprite.width - EPSILON;
            if (side === "top") sprite.y = bounds.offsetTop + EPSILON;
            if (side === "bottom") sprite.y = bounds.height - bounds.offsetBottom - sprite.height - EPSILON;
          } else if (boundaryMode === "bounce") {
            if (side === "left" || side === "right") sprite.velocityX = -sprite.velocityX;
            if (side === "top" || side === "bottom") sprite.velocityY = -sprite.velocityY;
            if (side === "left") sprite.x = EPSILON;
            if (side === "right") sprite.x = bounds.width - sprite.width - EPSILON;
            if (side === "top") sprite.y = bounds.offsetTop + EPSILON;
            if (side === "bottom") sprite.y = bounds.height - bounds.offsetBottom - sprite.height - EPSILON;
          }
        }
      };
    }
  });

  // src/runtime/CollisionManager.ts
  var logger4, CollisionManager;
  var init_CollisionManager = __esm({
    "src/runtime/CollisionManager.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_PhysicsEngine();
      init_Logger();
      logger4 = Logger.get("CollisionManager", "Runtime_Execution");
      CollisionManager = class {
        boundaryMode = "clamp";
        eventCallback = null;
        gridConfig = null;
        collisionCooldowns = /* @__PURE__ */ new Map();
        boundaryCooldowns = /* @__PURE__ */ new Map();
        collidedThisFrame = /* @__PURE__ */ new Set();
        exitedSprites = /* @__PURE__ */ new Set();
        activeSpriteBuffer = [];
        activePanelBuffer = [];
        COLLISION_COOLDOWN_MS = 200;
        BOUNDARY_COOLDOWN_MS = 500;
        configure(gridConfig, boundaryMode, eventCallback) {
          this.gridConfig = gridConfig;
          this.boundaryMode = boundaryMode || "clamp";
          this.eventCallback = eventCallback || null;
        }
        clear() {
          this.collisionCooldowns.clear();
          this.boundaryCooldowns.clear();
          this.collidedThisFrame.clear();
          this.exitedSprites.clear();
          this.activeSpriteBuffer.length = 0;
          this.activePanelBuffer.length = 0;
        }
        clearTrackingFor(spriteId) {
          if (!spriteId) return;
          this.collidedThisFrame.delete(spriteId);
          this.exitedSprites.delete(spriteId);
          for (const key of Array.from(this.collisionCooldowns.keys())) {
            if (key.startsWith(`${spriteId}_`) || key.endsWith(`_${spriteId}`)) {
              this.collisionCooldowns.delete(key);
            }
          }
          for (const key of Array.from(this.boundaryCooldowns.keys())) {
            if (key.startsWith(`${spriteId}_`)) {
              this.boundaryCooldowns.delete(key);
            }
          }
        }
        checkCollisions(sprites, panels) {
          this.collidedThisFrame.clear();
          const activeSprites = this.activeSpriteBuffer;
          activeSprites.length = 0;
          for (const sprite of sprites) {
            if (!sprite.visible) continue;
            if (sprite.isAnimating) continue;
            if (sprite.collisionEnabled === false) continue;
            activeSprites.push(sprite);
          }
          this.checkSpriteVsSpriteCollisions(activeSprites);
          this.checkSpriteVsPanelCollisions(activeSprites, panels);
        }
        checkSpriteVsSpriteCollisions(activeSprites) {
          for (let i = 0; i < activeSprites.length; i++) {
            for (let j = i + 1; j < activeSprites.length; j++) {
              const spriteA = activeSprites[i];
              const spriteB = activeSprites[j];
              if (!spriteA.visible || !spriteB.visible) continue;
              if (spriteA.isAnimating || spriteB.isAnimating) continue;
              if (spriteA.collisionEnabled === false || spriteB.collisionEnabled === false) continue;
              const parentA = spriteA.parentId || (spriteA.parent ? spriteA.parent.id : null);
              const parentB = spriteB.parentId || (spriteB.parent ? spriteB.parent.id : null);
              if (parentA !== parentB) continue;
              const groupA = spriteA.collisionGroup || "default";
              const groupB = spriteB.collisionGroup || "default";
              if (groupA !== "default" && groupA === groupB) continue;
              const eventsA = spriteA.events || spriteA.Tasks || {};
              const eventsB = spriteB.events || spriteB.Tasks || {};
              const hasCollisionHandler = eventsA.onCollision || eventsA.onCollisionTop || eventsA.onCollisionBottom || eventsA.onCollisionLeft || eventsA.onCollisionRight || eventsB.onCollision || eventsB.onCollisionTop || eventsB.onCollisionBottom || eventsB.onCollisionLeft || eventsB.onCollisionRight;
              if (!hasCollisionHandler) continue;
              const overlap = spriteA.getCollisionOverlap(spriteB);
              if (overlap) {
                const wantsPushOut = spriteA.pushOutOnCollision || spriteB.pushOutOnCollision;
                if (wantsPushOut) {
                  PhysicsEngine.resolveSpriteCollision(spriteA, spriteB, overlap);
                }
                const now = performance.now();
                const pairKey = `${spriteA.id}_${spriteB.id}`;
                const lastCollision = this.collisionCooldowns.get(pairKey) || 0;
                if (now - lastCollision < this.COLLISION_COOLDOWN_MS) continue;
                this.collisionCooldowns.set(pairKey, now);
                if (this.eventCallback) {
                  this.eventCallback(spriteA.id, "onCollision", {
                    other: spriteB.name,
                    otherSprite: spriteB,
                    hitSide: overlap.side,
                    contactX: overlap.contactX,
                    contactY: overlap.contactY
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
                    hitSide: oppositeSide,
                    contactX: overlap.contactX,
                    contactY: overlap.contactY
                  });
                  this.eventCallback(spriteA.id, `onCollision${this.capitalize(overlap.side)}`, {
                    other: spriteB.name,
                    otherSprite: spriteB,
                    hitSide: overlap.side,
                    contactX: overlap.contactX,
                    contactY: overlap.contactY
                  });
                  this.eventCallback(spriteB.id, `onCollision${this.capitalize(oppositeSide)}`, {
                    other: spriteA.name,
                    otherSprite: spriteA,
                    hitSide: oppositeSide,
                    contactX: overlap.contactX,
                    contactY: overlap.contactY
                  });
                  this.collidedThisFrame.add(spriteA.id);
                  this.collidedThisFrame.add(spriteB.id);
                }
              }
            }
          }
        }
        checkSpriteVsPanelCollisions(activeSprites, panels) {
          const activePanels = this.activePanelBuffer;
          activePanels.length = 0;
          for (const panel of panels) {
            if (!panel.visible) continue;
            if (panel.isAnimating) continue;
            if (panel.collisionEnabled === false) continue;
            activePanels.push(panel);
          }
          for (let i = 0; i < activeSprites.length; i++) {
            for (let j = 0; j < activePanels.length; j++) {
              const sprite = activeSprites[i];
              const panel = activePanels[j];
              if (!sprite.visible || !panel.visible) continue;
              if (sprite.isAnimating || panel.isAnimating) continue;
              const spriteParentId = sprite.parentId || (sprite.parent ? sprite.parent.id : null);
              if (spriteParentId === panel.id || spriteParentId === panel.name) continue;
              const panelParentId = panel.parentId || (panel.parent ? panel.parent.id : null);
              if (spriteParentId !== panelParentId) continue;
              if (sprite.collisionEnabled === false || panel.collisionEnabled === false) continue;
              const panelHitbox = {
                x: panel.x,
                y: panel.y,
                w: panel.width,
                h: panel.height,
                shape: "rect"
              };
              const spriteHb = sprite.getHitbox();
              let isColliding = false;
              if (spriteHb.shape === "rect") {
                isColliding = spriteHb.x < panelHitbox.x + panelHitbox.w && spriteHb.x + spriteHb.w > panelHitbox.x && spriteHb.y < panelHitbox.y + panelHitbox.h && spriteHb.y + spriteHb.h > panelHitbox.y;
              } else if (spriteHb.shape === "circle") {
                const r = spriteHb.w / 2;
                const cx = spriteHb.x + r;
                const cy = spriteHb.y + spriteHb.h / 2;
                const closestX = Math.max(panelHitbox.x, Math.min(cx, panelHitbox.x + panelHitbox.w));
                const closestY = Math.max(panelHitbox.y, Math.min(cy, panelHitbox.y + panelHitbox.h));
                const dx = cx - closestX;
                const dy = cy - closestY;
                isColliding = dx * dx + dy * dy < r * r;
              }
              if (isColliding) {
                const dx = spriteHb.x + spriteHb.w / 2 - (panelHitbox.x + panelHitbox.w / 2);
                const dy = spriteHb.y + spriteHb.h / 2 - (panelHitbox.y + panelHitbox.h / 2);
                const combinedHalfWidths = (spriteHb.w + panelHitbox.w) / 2;
                const combinedHalfHeights = (spriteHb.h + panelHitbox.h) / 2;
                const overlapX = combinedHalfWidths - Math.abs(dx);
                const overlapY = combinedHalfHeights - Math.abs(dy);
                let hitSide = "left";
                let depth = 0;
                const vX = sprite.velocityX || 0;
                const vY = sprite.velocityY || 0;
                if (Math.abs(vX) > Math.abs(vY)) {
                  hitSide = dx > 0 ? "left" : "right";
                  depth = overlapX;
                  logger4.debug(`[PHYSICS] Velocity-Horizontal: vX=${vX}, vY=${vY}, hitSide=${hitSide}, depth=${depth}`);
                } else if (Math.abs(vY) > Math.abs(vX)) {
                  hitSide = dy > 0 ? "top" : "bottom";
                  depth = overlapY;
                  logger4.debug(`[PHYSICS] Velocity-Vertical: vX=${vX}, vY=${vY}, hitSide=${hitSide}, depth=${depth}`);
                } else {
                  if (overlapX < overlapY) {
                    hitSide = dx > 0 ? "left" : "right";
                    depth = overlapX;
                    logger4.debug(`[PHYSICS] Geometric-Horizontal: overlapX=${overlapX} < overlapY=${overlapY}, hitSide=${hitSide}, depth=${depth}`);
                  } else {
                    hitSide = dy > 0 ? "top" : "bottom";
                    depth = overlapY;
                    logger4.debug(`[PHYSICS] Geometric-Vertical: overlapY=${overlapY} <= overlapX=${overlapX}, hitSide=${hitSide}, depth=${depth}`);
                  }
                }
                const contactLeft = Math.max(spriteHb.x, panelHitbox.x);
                const contactTop = Math.max(spriteHb.y, panelHitbox.y);
                const contactRight = Math.min(spriteHb.x + spriteHb.w, panelHitbox.x + panelHitbox.w);
                const contactBottom = Math.min(spriteHb.y + spriteHb.h, panelHitbox.y + panelHitbox.h);
                const contactX = contactLeft + (contactRight - contactLeft) / 2;
                const contactY = contactTop + (contactBottom - contactTop) / 2;
                const wantsPushOut = sprite.pushOutOnCollision || panel.pushOutOnCollision;
                if (wantsPushOut) {
                  PhysicsEngine.resolvePanelCollision(sprite, hitSide, depth, this.boundaryMode);
                }
                const now = performance.now();
                const pairKey = `panel_${sprite.id}_${panel.id}`;
                const lastCollision = this.collisionCooldowns.get(pairKey) || 0;
                if (now - lastCollision < this.COLLISION_COOLDOWN_MS) continue;
                this.collisionCooldowns.set(pairKey, now);
                if (this.eventCallback) {
                  this.eventCallback(sprite.id, "onCollision", {
                    other: panel.name,
                    otherSprite: panel,
                    hitSide,
                    contactX,
                    contactY
                  });
                  this.eventCallback(sprite.id, `onCollision${this.capitalize(hitSide)}`, { other: panel });
                  this.collidedThisFrame.add(sprite.id);
                }
              }
            }
          }
        }
        checkBoundaries(sprites, panels, bounds) {
          for (const sprite of sprites) {
            if (!sprite.visible) continue;
            if (sprite.collisionEnabled === false) continue;
            if (sprite.isAnimating) continue;
            if (this.collidedThisFrame.has(sprite.id)) continue;
            const sb = this.getSpriteBounds(sprite, panels, bounds);
            const within = sprite.isWithinBounds(sb.width, sb.height, 0, 0);
            if (!within.left) this.triggerBoundaryEvent(sprite, "left", sb);
            if (!within.right) this.triggerBoundaryEvent(sprite, "right", sb);
            if (sprite.y < sb.offsetTop) this.triggerBoundaryEvent(sprite, "top", sb);
            const bottomBoundary = sb.height - sb.offsetBottom;
            if (sprite.y + sprite.height > bottomBoundary) this.triggerBoundaryEvent(sprite, "bottom", sb);
          }
        }
        triggerBoundaryEvent(sprite, side, bounds) {
          const cooldownKey = `${sprite.id}_${side}`;
          const now = performance.now();
          const lastHit = this.boundaryCooldowns.get(cooldownKey) || 0;
          if (side === "left" && sprite.velocityX >= 0) return;
          if (side === "right" && sprite.velocityX <= 0) return;
          if (side === "top" && sprite.velocityY >= 0) return;
          if (side === "bottom" && sprite.velocityY <= 0) return;
          const hasBoundaryEvent = sprite.events?.onBoundaryHit;
          if (hasBoundaryEvent) {
            PhysicsEngine.applyBoundaryResponse(sprite, side, bounds, this.boundaryMode);
          }
          if (now - lastHit < this.BOUNDARY_COOLDOWN_MS) return;
          this.boundaryCooldowns.set(cooldownKey, now);
          const hb = sprite.getHitbox();
          let contactX = 0;
          let contactY = 0;
          if (side === "left") {
            contactX = 0;
            contactY = hb.y + hb.h / 2;
          } else if (side === "right") {
            contactX = bounds.width;
            contactY = hb.y + hb.h / 2;
          } else if (side === "top") {
            contactX = hb.x + hb.w / 2;
            contactY = bounds.offsetTop;
          } else if (side === "bottom") {
            contactX = hb.x + hb.w / 2;
            contactY = bounds.height - bounds.offsetBottom;
          }
          if (this.eventCallback) {
            this.eventCallback(sprite.id, "onBoundaryHit", { hitSide: side, contactX, contactY });
          }
        }
        checkStageExits(sprites, panels, bounds) {
          for (const sprite of sprites) {
            if (sprite.isAnimating) continue;
            if (sprite.collisionEnabled === false) continue;
            const spriteKey = sprite.id || sprite.name;
            if (this.exitedSprites.has(spriteKey)) continue;
            const sb = this.getSpriteBounds(sprite, panels, bounds);
            let exitSide = null;
            if (sprite.x + sprite.width < 0) {
              exitSide = "left";
            } else if (sprite.x > sb.width) {
              exitSide = "right";
            } else if (sprite.y + sprite.height < sb.offsetTop) {
              exitSide = "top";
            } else if (sprite.y > sb.height - sb.offsetBottom) {
              exitSide = "bottom";
            }
            if (exitSide && this.eventCallback) {
              this.exitedSprites.add(spriteKey);
              this.eventCallback(sprite.id, "onStageExit", { exitSide });
            }
          }
        }
        getSpriteBounds(sprite, panels, defaultBounds) {
          let parentPanel = null;
          if (sprite.parentId) {
            parentPanel = panels.find((p) => p.id === sprite.parentId || p.name === sprite.parentId);
          } else if (sprite.parent) {
            parentPanel = sprite.parent;
          }
          if (parentPanel && (parentPanel.className === "TPanel" || parentPanel.className === "TGroupPanel")) {
            let bw = 0;
            if (parentPanel.style?.borderWidth) {
              bw = parseInt(String(parentPanel.style.borderWidth), 10) || 0;
            }
            const cellSize = this.gridConfig?.cellSize ?? this.gridConfig?.grid?.cellSize ?? 20;
            const bwCells = bw / cellSize;
            return {
              width: parentPanel.width - bwCells * 2,
              height: parentPanel.height - bwCells * 2,
              offsetTop: 0,
              offsetBottom: 0
            };
          }
          return defaultBounds;
        }
        capitalize(s) {
          return s.charAt(0).toUpperCase() + s.slice(1);
        }
      };
    }
  });

  // src/runtime/LoopLifecycle.ts
  var logger5, LoopLifecycle;
  var init_LoopLifecycle = __esm({
    "src/runtime/LoopLifecycle.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_Logger();
      logger5 = Logger.get("LoopLifecycle", "Runtime_Execution");
      LoopLifecycle = class {
        constructor(host) {
          this.host = host;
          this.loop = this.loop.bind(this);
        }
        host;
        state = "stopped";
        animationFrameId = null;
        lastTime = 0;
        lastFrameTime = 0;
        resyncClock = true;
        accumulator = 0;
        fixedDt = 1 / 60;
        targetFPS = 60;
        userTargetFPS = 60;
        autoAdjustFPS = true;
        frameTimeHistory = [];
        frameTimeIndex = 0;
        fpsCheckCounter = 0;
        fpsWarmupFrames = 0;
        idleFrameCount = 0;
        FPS_WINDOW_SIZE = 90;
        FPS_CHECK_INTERVAL = 30;
        FPS_WARMUP_FRAMES = 30;
        FPS_SLOW_THRESHOLD_MS = 22;
        FPS_UPGRADE_AVG_MS = 17;
        FPS_UPGRADE_SLOW_PCT = 0.1;
        FPS_DOWNGRADE_AVG_MS = 24;
        FPS_DOWNGRADE_SLOW_PCT = 0.35;
        IDLE_THRESHOLD = 30;
        configure(targetFPS, autoAdjust) {
          this.targetFPS = Math.max(1, targetFPS);
          this.userTargetFPS = this.targetFPS;
          this.autoAdjustFPS = autoAdjust;
          this.fixedDt = 1 / this.targetFPS;
        }
        start() {
          if (this.state === "running") return;
          this.state = "running";
          this.lastTime = performance.now();
          this.lastFrameTime = this.lastTime;
          this.accumulator = 0;
          this.idleFrameCount = 0;
          this.resyncClock = true;
          if (this.autoAdjustFPS) {
            this.resetFPSHistory();
            logger5.info(`[LoopLifecycle] Starte dynamische FPS-\xDCberwachung`);
          }
          this.animationFrameId = requestAnimationFrame(this.loop);
        }
        stop() {
          this.state = "stopped";
          if (this.animationFrameId !== null) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
          }
          this.idleFrameCount = 0;
        }
        pause() {
          if (this.state === "running" || this.state === "sleeping") {
            this.state = "paused";
            if (this.animationFrameId !== null) {
              cancelAnimationFrame(this.animationFrameId);
              this.animationFrameId = null;
            }
            logger5.debug(`Paused`);
          }
        }
        resume() {
          if (this.state === "paused") {
            this.state = "running";
            this.lastTime = performance.now();
            this.resyncClock = true;
            logger5.debug(`Resumed`);
            this.animationFrameId = requestAnimationFrame(this.loop);
          }
        }
        wakeUp() {
          if (this.state === "sleeping") {
            this.state = "running";
            this.lastTime = performance.now();
            this.idleFrameCount = 0;
            this.resyncClock = true;
            logger5.debug(`Woke up from sleep`);
            this.animationFrameId = requestAnimationFrame(this.loop);
          }
        }
        getState() {
          return this.state;
        }
        isRunning() {
          return this.state === "running" || this.state === "sleeping";
        }
        getTargetFPS() {
          return this.targetFPS;
        }
        getAutoAdjustFPS() {
          return this.autoAdjustFPS;
        }
        setAutoAdjustFPS(value) {
          this.autoAdjustFPS = value;
          if (value) {
            this.targetFPS = this.userTargetFPS;
            this.fixedDt = 1 / this.targetFPS;
            this.resetFPSHistory();
          }
        }
        setTargetFPS(value) {
          const clamped = Math.max(1, Math.min(120, value));
          this.userTargetFPS = clamped;
          this.targetFPS = clamped;
          this.fixedDt = 1 / clamped;
          this.autoAdjustFPS = false;
        }
        resetIdle() {
          this.idleFrameCount = 0;
        }
        resetFPSHistory() {
          this.frameTimeHistory = new Array(this.FPS_WINDOW_SIZE).fill(0);
          this.frameTimeIndex = 0;
          this.fpsCheckCounter = 0;
          this.fpsWarmupFrames = 0;
        }
        loop(timestamp) {
          if (this.state !== "running") return;
          const now = timestamp !== void 0 ? timestamp : performance.now();
          if (this.resyncClock) {
            this.resyncClock = false;
            this.lastFrameTime = now;
            this.accumulator = 0;
          }
          const frameMs = now - this.lastFrameTime;
          this.lastFrameTime = now;
          if (this.autoAdjustFPS) {
            this.fpsWarmupFrames++;
            if (this.fpsWarmupFrames > this.FPS_WARMUP_FRAMES) {
              const cappedFrameMs = Math.min(frameMs, 100);
              this.frameTimeHistory[this.frameTimeIndex] = cappedFrameMs;
              this.frameTimeIndex = (this.frameTimeIndex + 1) % this.FPS_WINDOW_SIZE;
              this.fpsCheckCounter++;
              if (this.fpsCheckCounter >= this.FPS_CHECK_INTERVAL) {
                this.fpsCheckCounter = 0;
                this.evaluateAdaptiveFPS();
              }
            }
          }
          this.accumulator += Math.min(frameMs / 1e3, 0.1);
          this.lastTime = now;
          let steps = 0;
          while (this.accumulator >= this.fixedDt) {
            this.accumulator -= this.fixedDt;
            steps++;
          }
          const alpha = this.accumulator / this.fixedDt;
          const didWork = this.host.processFrame(steps, alpha, this.fixedDt);
          if (didWork) {
            this.idleFrameCount = 0;
          } else {
            this.idleFrameCount++;
            if (this.idleFrameCount >= this.IDLE_THRESHOLD) {
              this.state = "sleeping";
              logger5.debug(`Entering sleep (${this.idleFrameCount} idle frames)`);
              return;
            }
          }
          this.animationFrameId = requestAnimationFrame(this.loop);
        }
        evaluateAdaptiveFPS() {
          let total = 0;
          let slow = 0;
          let count = 0;
          for (const ms of this.frameTimeHistory) {
            if (ms <= 0) continue;
            total += ms;
            count++;
            if (ms > this.FPS_SLOW_THRESHOLD_MS) slow++;
          }
          if (count === 0) return;
          const avgMs = total / count;
          const slowRatio = slow / count;
          const previous = this.targetFPS;
          if (this.targetFPS === 60) {
            if (avgMs > this.FPS_DOWNGRADE_AVG_MS && slowRatio > this.FPS_DOWNGRADE_SLOW_PCT) {
              this.targetFPS = 30;
            }
          } else if (this.targetFPS === 30) {
            if (avgMs < this.FPS_UPGRADE_AVG_MS && slowRatio < this.FPS_UPGRADE_SLOW_PCT) {
              this.targetFPS = 60;
            }
          }
          if (this.targetFPS !== previous) {
            this.fixedDt = 1 / this.targetFPS;
            this.host.onTargetFPSChanged(this.targetFPS);
            logger5.info(`[LoopLifecycle] FPS-Anpassung: avg=${avgMs.toFixed(2)}ms, ${(slowRatio * 100).toFixed(0)}% langsam -> targetFPS=${this.targetFPS}`);
          }
        }
      };
    }
  });

  // src/runtime/ReactiveProperty.ts
  function unwrap(obj) {
    if (obj !== null && typeof obj === "object" && obj.__isProxy__) {
      return obj.__target__;
    }
    return obj;
  }
  var logger6;
  var init_ReactiveProperty = __esm({
    "src/runtime/ReactiveProperty.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_Logger();
      init_LogTypes();
      logger6 = Logger.get("Proxy", "Variable_Management");
    }
  });

  // src/runtime/GameLoopManager.ts
  var GameLoopManager_exports = {};
  __export(GameLoopManager_exports, {
    GameLoopManager: () => GameLoopManager
  });
  var logger7, GameLoopManager;
  var init_GameLoopManager = __esm({
    "src/runtime/GameLoopManager.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_PerfOverlay();
      init_AnimationManager();
      init_Logger();
      init_InputManager();
      init_RenderLoop();
      init_CollisionManager();
      init_LoopLifecycle();
      init_ReactiveProperty();
      logger7 = Logger.get("GameLoopManager", "Runtime_Execution");
      GameLoopManager = class _GameLoopManager {
        static instance = null;
        lifecycle;
        pauseOwners = /* @__PURE__ */ new Set();
        manualPause = false;
        renderLoop;
        collisionManager;
        inputManager;
        // Configuration
        boundsOffsetTop = 0;
        boundsOffsetBottom = 0;
        boundaryMode = "clamp";
        // Grid reference - bounds are derived from this
        gridConfig = null;
        gameState = null;
        gameLoopRef = null;
        // Objects
        sprites = [];
        inputControllers = [];
        panels = [];
        runtimeUpdatables = [];
        pendingTimerTicks = [];
        /**
         * True, während der Loop seinen eigenen Arbeitsblock abarbeitet.
         */
        isLoopUpdating = false;
        constructor() {
          this.lifecycle = new LoopLifecycle(this);
          this.renderLoop = new RenderLoop();
          this.collisionManager = new CollisionManager();
          this.inputManager = new InputManager();
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
        init(objects, gridConfig, renderCallback, eventCallback, spriteRenderCallback) {
          const pauseOwners = new Set([...this.pauseOwners].filter((owner) => objects.some((obj) => unwrap(obj) === owner)));
          this.stop();
          this.pauseOwners = pauseOwners;
          this.gridConfig = gridConfig;
          this.sprites = objects.filter(
            (obj) => obj.className === "TSprite" || obj.constructor.name === "TSprite"
          );
          this.sprites.forEach((sprite) => {
            sprite.previousX = sprite.x;
            sprite.previousY = sprite.y;
            sprite.renderX = sprite.x;
            sprite.renderY = sprite.y;
          });
          this.inputControllers = objects.filter(
            (obj) => obj.className === "TInputController" || obj.constructor?.name === "TInputController"
          );
          this.panels = objects.filter(
            (obj) => obj.className === "TPanel" || obj.className === "TGroupPanel" || obj.constructor?.name === "TPanel" || obj.constructor?.name === "TGroupPanel"
          );
          this.runtimeUpdatables = objects.filter((obj) => typeof obj.onRuntimeUpdate === "function");
          const gameStateObj = objects.find(
            (obj) => obj.className === "TGameState" || obj.constructor?.name === "TGameState"
          );
          this.gameState = gameStateObj || null;
          const gameLoopObj = objects.find(
            (obj) => obj.className === "TGameLoop" || obj.constructor?.name === "TGameLoop"
          );
          this.gameLoopRef = gameLoopObj || null;
          let targetFPS = 60;
          let autoAdjust = true;
          if (gameLoopObj) {
            this.boundsOffsetTop = gameLoopObj.boundsOffsetTop || 0;
            this.boundsOffsetBottom = gameLoopObj.boundsOffsetBottom || 0;
            this.boundaryMode = gameLoopObj.boundaryMode || "clamp";
            targetFPS = typeof gameLoopObj.targetFPS === "number" ? Math.max(1, gameLoopObj.targetFPS) : 60;
            autoAdjust = gameLoopObj.autoAdjustFPS !== false;
          }
          this.lifecycle.configure(targetFPS, autoAdjust);
          this.collisionManager.configure(this.gridConfig, this.boundaryMode, eventCallback);
          this.collisionManager.clear();
          this.renderLoop.clear();
          this.pendingTimerTicks.length = 0;
          this.renderLoop.setCallbacks(renderCallback, spriteRenderCallback || null);
        }
        /**
         * Synchronisiert die internen Objekt-Listen mit einer geaenderten
         * Runtime-Objektliste (z.B. nach einem Pool-Reset zur Laufzeit),
         * ohne den Loop zu stoppen oder Konfiguration zu verlieren.
         */
        syncObjects(objects) {
          this.sprites = objects.filter(
            (obj) => obj.className === "TSprite" || obj.constructor.name === "TSprite"
          );
          this.sprites.forEach((sprite) => {
            if (sprite.previousX === void 0) {
              sprite.previousX = sprite.x;
              sprite.previousY = sprite.y;
              sprite.renderX = sprite.x;
              sprite.renderY = sprite.y;
            }
          });
          this.inputControllers = objects.filter(
            (obj) => obj.className === "TInputController" || obj.constructor?.name === "TInputController"
          );
          this.panels = objects.filter(
            (obj) => obj.className === "TPanel" || obj.className === "TGroupPanel" || obj.constructor?.name === "TPanel" || obj.constructor?.name === "TGroupPanel"
          );
          this.runtimeUpdatables = objects.filter((obj) => typeof obj.onRuntimeUpdate === "function");
        }
        /**
         * Start the game loop
         */
        start() {
          this.lifecycle.start();
          if (this.manualPause || this.pauseOwners.size > 0) this.lifecycle.pause();
        }
        /**
         * Stop the game loop
         */
        stop() {
          this.lifecycle.stop();
          this.pauseOwners.clear();
          this.manualPause = false;
          this.collisionManager.clear();
          this.renderLoop.clear();
          this.sprites = [];
          this.inputControllers = [];
          this.panels = [];
          this.runtimeUpdatables = [];
          this.pendingTimerTicks.length = 0;
          this.gameState = null;
          this.gridConfig = null;
          this.gameLoopRef = null;
          this.boundsOffsetTop = 0;
          this.boundsOffsetBottom = 0;
          this.boundaryMode = "clamp";
          this.isLoopUpdating = false;
        }
        /**
         * Pause the game loop
         */
        pause() {
          this.manualPause = true;
          this.lifecycle.pause();
        }
        /**
         * Resume the game loop
         */
        resume() {
          this.manualPause = false;
          if (this.pauseOwners.size === 0) this.lifecycle.resume();
        }
        acquirePause(owner) {
          this.pauseOwners.add(unwrap(owner));
          this.lifecycle.pause();
        }
        releasePause(owner) {
          if (this.pauseOwners.delete(unwrap(owner)) && this.pauseOwners.size === 0 && !this.manualPause) {
            this.lifecycle.resume();
          }
        }
        /**
         * Get current state
         */
        getState() {
          return this.lifecycle.getState();
        }
        /**
         * Liefert die aktuell gewählte Ziel-Framerate.
         */
        getTargetFPS() {
          return this.lifecycle.getTargetFPS();
        }
        /**
         * Liefert, ob die automatische FPS-Anpassung aktiv ist.
         */
        getAutoAdjustFPS() {
          return this.lifecycle.getAutoAdjustFPS();
        }
        /**
         * Schaltet die automatische FPS-Anpassung ein oder aus.
         */
        setAutoAdjustFPS(value) {
          this.lifecycle.setAutoAdjustFPS(value);
          if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = this.lifecycle.getTargetFPS();
            this.gameLoopRef.autoAdjustFPS = value;
          }
        }
        /**
         * Setzt die Ziel-FPS manuell (deaktiviert automatische Anpassung).
         */
        setTargetFPS(value) {
          this.lifecycle.setTargetFPS(value);
          if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = this.lifecycle.getTargetFPS();
            this.gameLoopRef.autoAdjustFPS = false;
          }
        }
        /**
         * Check if running (includes sleeping state — loop is initialized but idle)
         */
        isRunning() {
          return this.lifecycle.isRunning();
        }
        /**
         * Weckt den Loop aus dem Sleep-Zustand auf.
         */
        wakeUp() {
          this.lifecycle.wakeUp();
        }
        enqueueTimerTick(tick) {
          this.pendingTimerTicks.push(tick);
          if (this.lifecycle.getState() === "sleeping") {
            this.lifecycle.wakeUp();
          }
        }
        flushPendingTimerTicks() {
          if (this.pendingTimerTicks.length === 0) return;
          const ticks = this.pendingTimerTicks;
          this.pendingTimerTicks = [];
          for (const tick of ticks) {
            try {
              tick();
            } catch (e) {
              logger7.error("Error executing timer tick:", e);
            }
          }
        }
        /**
         * Erzwingt einen einmaligen Render-Frame für Sprites.
         */
        requestRender() {
          if (this.isLoopUpdating) return;
          this.renderLoop.syncRenderCoordinates(this.sprites);
          const state = this.lifecycle.getState();
          if (state === "paused") {
            this.renderLoop.render(this.sprites, this.renderLoop.getAndClearDirtySprites());
            return;
          }
          if (state === "sleeping") {
            this.lifecycle.wakeUp();
            this.renderLoop.render(this.sprites, this.renderLoop.getAndClearDirtySprites());
            return;
          }
          this.lifecycle.resetIdle();
          this.renderLoop.render(this.sprites, this.renderLoop.getAndClearDirtySprites());
        }
        /**
         * Markiert einen Sprite als dirty, weil sich dessen Bild geändert hat.
         */
        markSpriteDirty(sprite) {
          this.renderLoop.markSpriteDirty(sprite);
        }
        /**
         * Liefert alle als dirty markierten Sprites und leert die Menge.
         */
        getAndClearDirtySprites() {
          return this.renderLoop.getAndClearDirtySprites();
        }
        /**
         * Wird vom LoopLifecycle einmal pro Frame aufgerufen.
         */
        processFrame(steps, alpha, fixedDt) {
          this.inputManager.update(this.inputControllers);
          const spritesMoving = this.gameState ? this.gameState.spritesMoving : true;
          const hasActiveAnimations = AnimationManager.getInstance().hasActiveTweens();
          let hasMovingSprites = false;
          if (spritesMoving) {
            for (let i = 0; i < this.sprites.length; i++) {
              const sprite = this.sprites[i];
              if (sprite.velocityX !== 0 || sprite.velocityY !== 0 || sprite.isAnimating) {
                hasMovingSprites = true;
                break;
              }
            }
          }
          const hasRuntimeUpdatables = this.runtimeUpdatables.length > 0;
          const hasPendingTimerTicks = this.pendingTimerTicks.length > 0;
          const needsUpdate = hasActiveAnimations || hasMovingSprites || hasRuntimeUpdatables || hasPendingTimerTicks;
          if (!needsUpdate) {
            return false;
          }
          PerfOverlay.markWorkBegin();
          this.isLoopUpdating = true;
          this.flushPendingTimerTicks();
          for (let i = 0; i < steps; i++) {
            PerfOverlay.phaseBegin("spr");
            this.updateSprites(fixedDt, spritesMoving);
            PerfOverlay.phaseEnd("spr");
          }
          PerfOverlay.markFrameStats(steps, this.sprites.length);
          PerfOverlay.phaseBegin("upd");
          this.updateRuntimeUpdatables(steps * fixedDt);
          PerfOverlay.phaseEnd("upd");
          PerfOverlay.phaseBegin("anim");
          AnimationManager.getInstance().update();
          PerfOverlay.phaseEnd("anim");
          const bounds = {
            width: this.boundsWidth,
            height: this.boundsHeight,
            offsetTop: this.boundsOffsetTop,
            offsetBottom: this.boundsOffsetBottom
          };
          PerfOverlay.phaseBegin("coll");
          if (spritesMoving) {
            this.collisionManager.checkCollisions(this.sprites, this.panels);
            this.collisionManager.checkBoundaries(this.sprites, this.panels, bounds);
            this.collisionManager.checkStageExits(this.sprites, this.panels, bounds);
          }
          PerfOverlay.phaseEnd("coll");
          PerfOverlay.phaseBegin("interp");
          this.renderLoop.updateRenderPositions(this.sprites, alpha);
          PerfOverlay.phaseEnd("interp");
          PerfOverlay.phaseBegin("dom");
          this.renderLoop.render(
            this.renderLoop.collectRenderObjects(this.sprites),
            this.renderLoop.getAndClearDirtySprites()
          );
          PerfOverlay.phaseEnd("dom");
          this.isLoopUpdating = false;
          PerfOverlay.markWorkEnd();
          return true;
        }
        /**
         * Update all sprites based on velocity
         */
        updateSprites(deltaTime, applyVelocity = true) {
          this.sprites.forEach((sprite) => {
            if (!sprite.visible) return;
            sprite.previousX = sprite.x;
            sprite.previousY = sprite.y;
            sprite.update(deltaTime, applyVelocity);
          });
        }
        /**
         * Update components that provide their own runtime loop hook.
         */
        updateRuntimeUpdatables(deltaTime) {
          for (let i = 0; i < this.runtimeUpdatables.length; i++) {
            const obj = this.runtimeUpdatables[i];
            if (obj && typeof obj.onRuntimeUpdate === "function") {
              obj.onRuntimeUpdate(deltaTime);
            }
          }
        }
        /**
         * Setzt alle Kollisions-/Boundary-Cooldowns eines Sprites zurück.
         */
        clearTrackingFor(spriteId) {
          this.collisionManager.clearTrackingFor(spriteId);
        }
        /**
         * Kollisionsprüfung (wird von Tests direkt aufgerufen).
         */
        checkCollisions() {
          this.collisionManager.checkCollisions(this.sprites, this.panels);
        }
        onTargetFPSChanged(targetFPS) {
          if (this.gameLoopRef) {
            this.gameLoopRef.targetFPS = targetFPS;
          }
        }
      };
    }
  });

  // src/runtime/AnimationManager.ts
  var logger8, Easing, AnimationManager;
  var init_AnimationManager = __esm({
    "src/runtime/AnimationManager.ts"() {
      "use strict";
      init_define_import_meta_env();
      init_Logger();
      init_BlobUrlCache();
      logger8 = Logger.get("AnimationManager");
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
      AnimationManager = class _AnimationManager {
        activeTweens = [];
        static instance = null;
        constructor() {
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
        addTween(target, property, to, duration, easingName = "easeOut", onComplete, onUpdate) {
          const previousCount = this.activeTweens.length;
          this.cancelTween(target, property);
          if (this.activeTweens.length !== previousCount) {
          }
          const from = property === "_virtual" ? 0 : this.getPropertyValue(target, property);
          const easing = Easing[easingName] || Easing.easeOut;
          if (!Easing[easingName]) {
            logger8.warn(`[AnimationManager.addTween] Unknown easing "${easingName}", falling back to easeOut`);
          }
          if (property === "x" || property === "y") {
            target.isAnimating = true;
          }
          const tween = {
            target,
            property,
            from,
            to,
            duration,
            startTime: -1,
            // Lazy-Init: wird beim ersten update() auf performance.now() gesetzt
            easing,
            onComplete,
            onUpdate
          };
          this.activeTweens.push(tween);
          Promise.resolve().then(() => (init_GameLoopManager(), GameLoopManager_exports)).then(({ GameLoopManager: GameLoopManager2 }) => {
            GameLoopManager2.getInstance().wakeUp();
          }).catch((err2) => logger8.error("[AnimationManager] Fehler beim Lazy-Import von GameLoopManager:", err2));
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
         * Gibt eine Liste aller aktuell animierten Objekte zurück.
         */
        getAnimatedObjects() {
          const objects = /* @__PURE__ */ new Set();
          this.activeTweens.forEach((t) => objects.add(t.target));
          return Array.from(objects);
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
              if (tween.startTime < 0) {
                tween.startTime = now;
              }
              const elapsed = now - tween.startTime;
              let progress = Math.min(elapsed / tween.duration, 1);
              const easedProgress = tween.easing(progress);
              const newValue = tween.from + (tween.to - tween.from) * easedProgress;
              if (tween.property !== "_virtual") {
                this.setPropertyValue(tween.target, tween.property, newValue);
              }
              if (tween.onUpdate) {
                tween.onUpdate(newValue, tween.target);
              }
              if (progress >= 1) {
                if (tween.property !== "_virtual") {
                  this.setPropertyValue(tween.target, tween.property, tween.to);
                }
                if (tween.onUpdate) {
                  tween.onUpdate(tween.to, tween.target);
                }
                completedTweens.push(tween);
              }
            } catch (error) {
              logger8.error(`[AnimationManager] Error updating tween for ${tween.target.name || tween.target.id}.${tween.property}:`, error);
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
        // --- CORE EFFECT MACROS ---
        /**
         * Erzeugt einen Schütteleffekt (Shake) auf einem Objekt via CSS Transform.
         */
        shake(target, intensity = 5, duration = 500) {
          if (!target) return;
          const el = this.findVisibleElement(target.id);
          if (!el) return;
          const stepCount = Math.max(2, Math.round(duration / 50));
          const stepDuration = Math.max(1, Math.round(duration / stepCount));
          const steps = [];
          for (let i = 0; i < stepCount; i++) {
            const offsetX = (Math.random() - 0.5) * intensity * 2;
            const offsetY = (Math.random() - 0.5) * intensity * 2;
            steps.push({
              transform: `translate(${offsetX}px, ${offsetY}px)`,
              duration: stepDuration,
              easing: "linear"
            });
          }
          this.runCssTransform(el, steps);
        }
        /**
         * Lässt ein Objekt kurzzeitig aufpumpen und wieder schrumpfen (Pulse).
         */
        pulse(target, scale = 1.15, duration = 500) {
          if (!target) return;
          const el = this.findVisibleElement(target.id);
          if (!el) return;
          const half = Math.max(1, duration / 2);
          this.runCssTransform(el, [
            { transform: `scale(${scale})`, duration: half, easing: "ease-out" },
            { transform: "scale(1)", duration: half, easing: "ease-in" }
          ]);
        }
        /**
         * Lässt ein Objekt einmal nach oben hüpfen (Bounce).
         */
        bounce(target, heightPx = 20, duration = 500) {
          if (!target) return;
          const el = this.findVisibleElement(target.id);
          if (!el) return;
          const half = Math.max(1, duration / 2);
          this.runCssTransform(el, [
            { transform: `translateY(-${heightPx}px)`, duration: half, easing: "ease-out" },
            { transform: "translateY(0px)", duration: half, easing: "ease-in" }
          ]);
        }
        /**
         * Ändert die Transparenz (Fade In / Fade Out)
         */
        fade(target, toOpacity, duration = 500) {
          if (!target || !target.style) return;
          if (target.style.opacity === void 0) target.style.opacity = 1;
          this.addTween(target, "style.opacity", toOpacity, duration, "linear");
        }
        // --- NEUE SPRITE-ANIMATIONS-EFFEKTE (v3.31.0) ---
        /**
         * Langsam größer werden (width + height skalieren, Bild wächst mit).
         * Ändert die echten width/height-Werte → beeinflusst auch die Hitbox.
         */
        grow(target, targetScale = 2, duration = 500) {
          if (!target) return;
          const startW = target.width || 1;
          const startH = target.height || 1;
          this.addTween(target, "width", startW * targetScale, duration, "easeOut");
          this.addTween(target, "height", startH * targetScale, duration, "easeOut");
        }
        /**
         * Langsam kleiner werden (Gegenteil von grow).
         * Bei targetScale ≈ 0 wird das Objekt am Ende unsichtbar.
         */
        shrink(target, targetScale = 0.3, duration = 500) {
          if (!target) return;
          const startW = target.width || 1;
          const startH = target.height || 1;
          const targetW = startW * targetScale;
          const targetH = startH * targetScale;
          this.addTween(target, "width", targetW, duration, "easeIn");
          this.addTween(target, "height", targetH, duration, "easeIn", () => {
            if (targetScale <= 0.05) {
              target.visible = false;
            }
          });
        }
        /**
         * Zieht das Zielobjekt in Richtung einer (optionalen) Quelle zusammen
         * und blendet es aus. Ohne Quelle kollabiert es in die eigene Mitte.
         */
        implode(target, source = null, duration = 500) {
          if (!target) return;
          const startW = target.width || 1;
          const startH = target.height || 1;
          const targetCenterX = (target.x || 0) + startW / 2;
          const targetCenterY = (target.y || 0) + startH / 2;
          let toX = targetCenterX;
          let toY = targetCenterY;
          if (source) {
            const sourceW = source.width ?? startW;
            const sourceH = source.height ?? startH;
            toX = (source.x ?? 0) + sourceW / 2;
            toY = (source.y ?? 0) + sourceH / 2;
          }
          if (target.style.opacity === void 0) target.style.opacity = 1;
          this.addTween(target, "x", toX, duration, "easeInOut");
          this.addTween(target, "y", toY, duration, "easeInOut");
          this.addTween(target, "width", 0, duration, "easeInOut");
          this.addTween(target, "height", 0, duration, "easeInOut");
          this.addTween(target, "style.opacity", 0, duration, "linear", () => {
            target.visible = false;
          });
        }
        /**
         * Wandelt einen CSS-Bildwert der Form url("data:image/png;base64,...") in
         * eine Blob-URL um.
         *
         * Die Umwandlung liegt jetzt zentral in BlobUrlCache und wird dort global
         * zwischengespeichert: dasselbe Bild teilt sich ueber alle Komponenten und
         * Animationen hinweg eine einzige Blob-URL. Zuvor erzeugte jeder explode()
         * einen neuen Blob, der bis zum Seitenwechsel im Speicher blieb.
         */
        static toBlobUrl(cssUrl) {
          return cssUrlToBlobUrl(cssUrl);
        }
        /**
         * Sucht das sichtbare DOM-Element einer Komponente.
         *
         * Objekte koennen in mehreren Stages (z.B. Blueprint) gerendert und dort
         * versteckt sein. Entscheidend ist das Element mit echter Ausdehnung — sonst
         * animiert der Effekt eine unsichtbare Kopie.
         */
        findVisibleElement(id) {
          if (!id) return null;
          const elements = document.querySelectorAll(`[data-id="${id}"]`);
          for (let i = 0; i < elements.length; i++) {
            const el = elements[i];
            if (el.offsetWidth > 0 && el.offsetHeight > 0) {
              return el;
            }
          }
          return elements.length > 0 ? elements[0] : null;
        }
        /**
         * Fuehrt eine Transform-Animation ueber eine CSS-Transition aus, statt den
         * Wert pro Frame zu setzen.
         *
         * Hintergrund: Ein Tween schreibt bis zu 60x pro Sekunde auf
         * target.style.transform. Da Komponenten reaktive Proxies sind, loest jeder
         * dieser Schreibzugriffe die komplette PropertyWatcher-Kette und darueber
         * einen Renderer-Update aus — pro Frame und pro betroffenem Objekt. Eine
         * CSS-Transition dagegen wird vom Browser auf dem Compositor-Thread
         * abgearbeitet: es fallen genau zwei Zuweisungen an, ganz ohne JavaScript
         * pro Frame. Denselben Weg nutzt explode() bereits fuer seine Fragmente.
         *
         * Geschrieben wird direkt am DOM-Element, nicht am Modell. Ein vollstaendiger
         * Re-Render mitten in der Animation setzt den Transform daher zurueck — das
         * Verhalten entspricht explode().
         *
         * @param steps Liste der Zwischenziele, die nacheinander angefahren werden.
         * @param onDone Wird nach dem letzten Schritt aufgerufen.
         */
        runCssTransform(el, steps, onDone) {
          el.style.willChange = "transform";
          el._cssAnimActive = true;
          const runStep = (index) => {
            if (index >= steps.length) {
              el.style.transition = "";
              el.style.transform = "";
              el.style.willChange = "";
              delete el._cssAnimActive;
              if (onDone) {
                try {
                  onDone();
                } catch (e) {
                  logger8.error("[AnimationManager.runCssTransform] Fehler im onDone-Callback:", e);
                }
              }
              return;
            }
            const step = steps[index];
            if (step.onStart) {
              try {
                step.onStart();
              } catch (e) {
                logger8.error("[AnimationManager.runCssTransform] Fehler im onStart-Callback:", e);
              }
            }
            el.style.transition = `transform ${step.duration}ms ${step.easing}`;
            el.style.transform = step.transform;
            window.setTimeout(() => runStep(index + 1), step.duration);
          };
          requestAnimationFrame(() => runStep(0));
        }
        /**
         * Platzen/Zerbersten: Sprite wird in N Fragmente zerlegt, die in
         * zufällige Richtungen wegfliegen (mit Rotation, Skalierung→0, Fade-out).
         * Danach wird das Sprite unsichtbar (visible=false, recyclebar im Pool).
         * Unterstützt: Direktbilder, Sprite-Sheet-Frames und einfarbige Sprites.
         */
        explode(target, fragments = 9, spread = 120, duration = 600) {
          if (!target) {
            logger8.warn(`[AnimationManager.explode] Ziel-Objekt ist undefined oder null.`);
            return;
          }
          const spriteEl = this.findVisibleElement(target.id);
          if (!spriteEl) {
            logger8.warn(`[AnimationManager.explode] DOM-Element f\xFCr "${target.name}" nicht gefunden. Gesuchter Selektor: [data-id="${target.id}"]`);
            target.visible = false;
            return;
          }
          const rect = spriteEl.getBoundingClientRect();
          const gridSize = Math.max(2, Math.round(Math.sqrt(fragments)));
          const fragW = rect.width / gridSize;
          const fragH = rect.height / gridSize;
          const imgLayer = spriteEl.querySelector(".sprite-image-layer");
          const sheetLayer = spriteEl.querySelector(".sprite-sheet-layer");
          let bgImage = "";
          let bgColor = "";
          const frame = sheetLayer ? sheetLayer._frame : null;
          const cached = spriteEl._explodeBg;
          if (cached && cached.listId === target.imageListId) {
            bgImage = cached.image;
            bgColor = cached.color;
          } else {
            if (sheetLayer && sheetLayer.style.backgroundImage) {
              bgImage = sheetLayer.style.backgroundImage;
            } else if (imgLayer && imgLayer.tagName === "DIV") {
              bgImage = imgLayer.style.backgroundImage;
            } else if (imgLayer && imgLayer.tagName === "IMG") {
              bgImage = `url("${imgLayer.src}")`;
            } else {
              bgColor = target.spriteColor || target.style?.backgroundColor || "#ff6b6b";
            }
            bgImage = _AnimationManager.toBlobUrl(bgImage);
            spriteEl._explodeBg = {
              listId: target.imageListId,
              image: bgImage,
              color: bgColor
            };
          }
          const stageEl = spriteEl.closest(".stage-container") || spriteEl.parentElement;
          if (!stageEl) return;
          target.visible = false;
          spriteEl.style.display = "none";
          const fragmentEls = [];
          for (let row = 0; row < gridSize; row++) {
            for (let col = 0; col < gridSize; col++) {
              const frag = document.createElement("div");
              frag.className = "explode-fragment";
              frag.style.position = "fixed";
              frag.style.left = `${rect.left + col * fragW}px`;
              frag.style.top = `${rect.top + row * fragH}px`;
              frag.style.width = `${Math.max(1, fragW)}px`;
              frag.style.height = `${Math.max(1, fragH)}px`;
              frag.style.overflow = "hidden";
              frag.style.pointerEvents = "none";
              frag.style.zIndex = "999999";
              frag.style.transition = `transform ${duration}ms ease-out, opacity ${duration}ms ease-in`;
              frag.style.willChange = "transform, opacity";
              if (bgImage && frame) {
                frag.style.backgroundImage = bgImage;
                frag.style.backgroundSize = `${rect.width * frame.hCount}px ${rect.height * frame.vCount}px`;
                frag.style.backgroundPosition = `${-(frame.col * rect.width + col * fragW)}px ${-(frame.row * rect.height + row * fragH)}px`;
                frag.style.backgroundRepeat = "no-repeat";
              } else if (bgImage) {
                frag.style.backgroundImage = bgImage;
                frag.style.backgroundSize = `${rect.width}px ${rect.height}px`;
                frag.style.backgroundPosition = `${-col * fragW}px ${-row * fragH}px`;
                frag.style.backgroundRepeat = "no-repeat";
              } else {
                frag.style.backgroundColor = bgColor;
              }
              if (target.shape === "circle") {
                frag.style.borderRadius = "30%";
              }
              fragmentEls.push(frag);
            }
          }
          for (let i = 0; i < fragmentEls.length; i++) {
            document.body.appendChild(fragmentEls[i]);
          }
          setTimeout(() => {
            fragmentEls.forEach((frag) => {
              const angle = Math.random() * Math.PI * 2;
              const dist = spread * (0.5 + Math.random() * 0.5);
              const rotDeg = (Math.random() - 0.5) * 720;
              frag.style.transform = `translate(${Math.cos(angle) * dist}px, ${Math.sin(angle) * dist}px) rotate(${rotDeg}deg) scale(0.1)`;
              frag.style.opacity = "0";
            });
          }, 30);
          setTimeout(() => {
            fragmentEls.forEach((f) => f.remove());
            logger8.info(`[AnimationManager.explode] Animation f\xFCr "${target.name}" abgeschlossen. DOM aufger\xE4umt.`);
          }, duration + 50);
        }
        /**
         * Kombination: Kurz aufblähen (grow 1.3x) → dann explode.
         * Simuliert ein Platzen wie bei einem Luftballon.
         */
        pop(target, fragments = 9, duration = 800) {
          if (!target) return;
          const growDuration = Math.round(duration * 0.3);
          const explodeDuration = Math.round(duration * 0.7);
          this.grow(target, 1.3, growDuration);
          setTimeout(() => {
            this.explode(target, fragments, 120, explodeDuration);
          }, growDuration);
        }
        /**
         * Sanftes Einblenden: Setzt visible=true und animiert Opacity 0 → 1.
         */
        fadeIn(target, duration = 500) {
          if (!target) return;
          if (!target.style) target.style = {};
          target.style.opacity = 0;
          target.visible = true;
          this.addTween(target, "style.opacity", 1, duration, "easeOut");
        }
        /**
         * Sanftes Ausblenden: Animiert Opacity 1 → 0, dann visible=false.
         */
        fadeOut(target, duration = 500) {
          if (!target) return;
          if (!target.style) target.style = {};
          if (target.style.opacity === void 0) target.style.opacity = 1;
          this.addTween(target, "style.opacity", 0, duration, "easeIn", () => {
            target.visible = false;
          });
        }
        /**
         * Rotation um die eigene Achse.
         */
        spin(target, degrees = 360, duration = 500) {
          if (!target) return;
          const el = this.findVisibleElement(target.id);
          if (!el) return;
          this.runCssTransform(el, [
            { transform: `rotate(${degrees}deg)`, duration: Math.max(1, duration), easing: "ease-in-out" }
          ]);
        }
        /**
         * Wackel-Effekt: Leichtes Hin-und-Her-Rotieren via Sinus-Funktion.
         */
        wobble(target, intensity = 15, duration = 500) {
          if (!target) return;
          const el = this.findVisibleElement(target.id);
          if (!el) return;
          const stepCount = 12;
          const stepDuration = Math.max(1, Math.round(duration / stepCount));
          const steps = [];
          for (let i = 1; i <= stepCount; i++) {
            const val = i / stepCount;
            const angle = Math.sin(val * Math.PI * 6) * intensity * (1 - val);
            steps.push({
              transform: `rotate(${angle}deg)`,
              duration: stepDuration,
              easing: "linear"
            });
          }
          this.runCssTransform(el, steps);
        }
        /**
         * Frame-Animation: imageIndex wird von fromFrame → toFrame durchiteriert.
         * Einmalige Ausführung, kein Loop.
         */
        spriteAnimate(target, fromFrame = 0, toFrame = 7, duration = 1e3) {
          if (!target) return;
          const frameCount = Math.abs(toFrame - fromFrame) + 1;
          target.imageIndex = fromFrame;
          this.addTween(target, "_virtual", 1, duration, "linear", () => {
            target.imageIndex = toFrame;
          }, (val) => {
            const frame = Math.min(
              fromFrame + Math.floor(val * frameCount),
              toFrame
            );
            target.imageIndex = frame;
          });
        }
        /**
         * Flip-Effekt: Dreht das Objekt visuell um (scaleX 1 -> 0 -> 1).
         * Feuert bei exakt 50% der Dauer den optionalen onMidpoint-Callback,
         * damit Inhalte (Bilder/Texte) gewechselt werden können.
         */
        flip(target, duration = 600, onMidpoint, _children, threeDimensional = false) {
          if (!target) return;
          let midpointFired = false;
          const fireMidpoint = () => {
            if (midpointFired) return;
            midpointFired = true;
            if (typeof onMidpoint === "function") {
              try {
                onMidpoint();
              } catch (e) {
                logger8.error("[AnimationManager.flip] Fehler im onMidpoint-Callback:", e);
              }
            }
          };
          const el = this.findVisibleElement(target.id);
          if (!el) {
            logger8.warn(`[AnimationManager.flip] DOM-Element f\xFCr "${target.name}" nicht gefunden. F\xFChre nur den Midpoint-Task aus.`);
            fireMidpoint();
            return;
          }
          const half = Math.max(1, duration / 2);
          if (threeDimensional) {
            this.runCssTransform(el, [
              { transform: "perspective(1000px) rotateY(90deg)", duration: half, easing: "ease-in" },
              { transform: "perspective(1000px) rotateY(0deg)", duration: half, easing: "ease-out", onStart: () => {
                fireMidpoint();
                el.style.transition = "none";
                el.style.transform = "perspective(1000px) rotateY(-90deg)";
                void el.offsetWidth;
              } }
            ], fireMidpoint);
            return;
          }
          this.runCssTransform(el, [
            { transform: "scaleX(0)", duration: half, easing: "ease-in" },
            { transform: "scaleX(1)", duration: half, easing: "ease-out", onStart: fireMidpoint }
          ], fireMidpoint);
        }
      };
    }
  });

  // scripts/math-phase1/browser-persistence-entry.ts
  init_define_import_meta_env();

  // src/services/ProjectPersistenceService.ts
  init_define_import_meta_env();

  // src/services/registry/CoreStore.ts
  init_define_import_meta_env();
  init_Logger();

  // src/runtime/ThemeRegistry.ts
  init_define_import_meta_env();
  init_Logger();
  var ThemeRegistry = class _ThemeRegistry {
    static instance;
    static logger = Logger.get("ThemeRegistry");
    themes = /* @__PURE__ */ new Map();
    activeThemeId = "modern-glass";
    /**
     * Wird aufgerufen, wenn sich das aktive Theme ändert.
     * Kann zum Neu-Rendern genutzt werden.
     */
    onChange;
    /**
     * Komponenten-Klassen, die im Theme beschrieben werden können und in einer
     * Theme-Stage angelegt werden.
     */
    themeableComponents = [
      "TButton",
      "TPanel",
      "TCard",
      "TLabel",
      "TNumberLabel",
      "TDialogRoot",
      "TSidePanel",
      "TEdit",
      "TTextInput",
      "TStickyNote"
    ];
    constructor() {
      this.registerDefaultThemes();
      this.registerKidFriendlyThemes();
    }
    static getInstance() {
      if (!_ThemeRegistry.instance) {
        _ThemeRegistry.instance = new _ThemeRegistry();
      }
      return _ThemeRegistry.instance;
    }
    registerDefaultThemes() {
      this.registerTheme({
        id: "modern-glass",
        name: "Modern Glassmorphism",
        description: "Ein modernes, dunkles Glass-Theme mit leichten Transparenzen und Schatten.",
        components: {
          "TButton": {
            backgroundColor: "rgba(255, 255, 255, 0.08)",
            borderColor: "rgba(255, 255, 255, 0.15)",
            borderWidth: 1,
            color: "#ffffff",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "0 4px 6px rgba(0,0,0,0.2), inset 0 1px 0 rgba(255,255,255,0.1)"
          },
          "TPanel": {
            backgroundColor: "rgba(20, 20, 30, 0.65)",
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1,
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0, 0, 0, 0.4)"
          },
          "TCard": {
            backgroundColor: "rgba(30, 30, 40, 0.85)",
            borderColor: "rgba(255, 255, 255, 0.05)",
            borderWidth: 1,
            borderRadius: 16,
            boxShadow: "0 10px 20px rgba(0,0,0,0.3)"
          },
          "TLabel": {
            color: "#e0e0e0",
            fontSize: 14,
            fontFamily: "system-ui, -apple-system, sans-serif"
          },
          "TNumberLabel": {
            color: "#e0e0e0",
            fontSize: 14,
            fontFamily: "Consolas, monospace",
            fontWeight: "bold"
          },
          "TDialogRoot": {
            backgroundColor: "rgba(15, 15, 25, 0.95)",
            borderColor: "rgba(100, 150, 255, 0.25)",
            borderWidth: 1,
            borderRadius: 16,
            boxShadow: "0 20px 40px rgba(0,0,0,0.6)"
          },
          "TSidePanel": {
            backgroundColor: "rgba(25, 25, 35, 0.95)",
            borderColor: "rgba(255, 255, 255, 0.1)",
            borderWidth: 1,
            boxShadow: "-10px 0 30px rgba(0,0,0,0.5)"
          },
          "TStickyNote": {
            backgroundColor: "#fff9c4",
            borderColor: "#fbc02d",
            borderWidth: 1,
            color: "#333333",
            borderRadius: 2,
            boxShadow: "2px 4px 8px rgba(0,0,0,0.2)",
            fontFamily: '"Comic Sans MS", cursive, sans-serif'
          }
        }
      });
      this.registerTheme({
        id: "legacy-dark",
        name: "Legacy Dark (Alt)",
        description: "Das klassische GCS Dark-Theme ohne Transparenzen.",
        components: {
          "TButton": { backgroundColor: "#444444", color: "#ffffff", textAlign: "center", borderWidth: 1, borderColor: "#000000", borderRadius: 4 },
          "TPanel": { backgroundColor: "#222222", borderColor: "#444444", borderWidth: 1 },
          "TCard": { backgroundColor: "#333333", borderColor: "#111111", borderWidth: 1 },
          "TLabel": { color: "#ffffff" },
          "TDialogRoot": { backgroundColor: "#2a2a3e", borderColor: "#4fc3f7", borderWidth: 1 }
        }
      });
    }
    registerKidFriendlyThemes() {
      const glowPink = "0 0 8px #ff69b4, 0 0 16px rgba(255, 105, 180, 0.4)";
      const glowCyan = "0 0 8px #00f0ff, 0 0 16px rgba(0, 240, 255, 0.4)";
      const glowPurple = "0 0 8px #b388ff, 0 0 16px rgba(179, 136, 255, 0.4)";
      const glowOrange = "0 0 8px #ff9e80, 0 0 16px rgba(255, 158, 128, 0.4)";
      this.registerTheme({
        id: "candy-pop",
        name: "Candy Pop",
        description: "S\xFC\xDFe Pastellfarben mit rosa Glow \u2014 perfekt f\xFCr verspielte Spiele.",
        components: {
          "TButton": {
            backgroundColor: "#ff80ab",
            borderColor: "#ff4081",
            borderWidth: 2,
            color: "#ffffff",
            borderRadius: 16,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: glowPink
          },
          "TPanel": {
            backgroundColor: "#fff0f6",
            borderColor: "#f8bbd0",
            borderWidth: 2,
            borderRadius: 20,
            boxShadow: "0 8px 24px rgba(255, 64, 129, 0.15)"
          },
          "TCard": {
            backgroundColor: "#fce4ec",
            borderColor: "#f48fb1",
            borderWidth: 2,
            borderRadius: 24,
            boxShadow: "0 10px 20px rgba(255, 105, 180, 0.2)"
          },
          "TLabel": {
            color: "#880e4f",
            fontSize: 14,
            fontFamily: '"Comic Sans MS", cursive, sans-serif',
            fontWeight: "bold"
          },
          "TDialogRoot": {
            backgroundColor: "#fff0f6",
            borderColor: "#f06292",
            borderWidth: 2,
            borderRadius: 24,
            boxShadow: "0 20px 40px rgba(255, 64, 129, 0.25)"
          },
          "TSidePanel": {
            backgroundColor: "#f8bbd0",
            borderColor: "#ec407a",
            borderWidth: 2,
            boxShadow: "10px 0 30px rgba(255, 105, 180, 0.2)"
          },
          "TEdit": {
            backgroundColor: "#fff5f8",
            borderColor: "#f06292",
            borderWidth: 2,
            color: "#880e4f",
            borderRadius: 12
          },
          "TTextInput": {
            backgroundColor: "#fff5f8",
            borderColor: "#f06292",
            borderWidth: 2,
            color: "#880e4f",
            borderRadius: 12
          },
          "TStickyNote": {
            backgroundColor: "#fff9c4",
            borderColor: "#fbc02d",
            borderWidth: 1,
            color: "#880e4f",
            borderRadius: 4,
            boxShadow: "2px 4px 8px rgba(0,0,0,0.2)",
            fontFamily: '"Comic Sans MS", cursive, sans-serif'
          }
        }
      });
      this.registerTheme({
        id: "neon-arcade",
        name: "Neon Arcade",
        description: "Dunkler Hintergrund mit leuchtendem Cyan- und Magenta-Glow.",
        components: {
          "TButton": {
            backgroundColor: "#161822",
            borderColor: "#00f0ff",
            borderWidth: 2,
            color: "#00f0ff",
            borderRadius: 8,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: glowCyan
          },
          "TPanel": {
            backgroundColor: "#0b0c15",
            borderColor: "#00f0ff",
            borderWidth: 2,
            borderRadius: 12,
            boxShadow: "0 8px 32px rgba(0, 240, 255, 0.2)"
          },
          "TCard": {
            backgroundColor: "#101221",
            borderColor: "#ff00aa",
            borderWidth: 2,
            borderRadius: 16,
            boxShadow: "0 10px 20px rgba(255, 0, 170, 0.25)"
          },
          "TLabel": {
            color: "#e0f7fa",
            fontSize: 14,
            fontFamily: "Consolas, monospace",
            fontWeight: "bold",
            textShadow: "0 0 6px #00f0ff"
          },
          "TDialogRoot": {
            backgroundColor: "#0f111a",
            borderColor: "#ff00aa",
            borderWidth: 2,
            borderRadius: 20,
            boxShadow: "0 20px 40px rgba(255, 0, 170, 0.3)"
          },
          "TSidePanel": {
            backgroundColor: "#0b0c15",
            borderColor: "#00f0ff",
            borderWidth: 2,
            boxShadow: "-10px 0 30px rgba(0, 240, 255, 0.2)"
          },
          "TEdit": {
            backgroundColor: "#0b0c15",
            borderColor: "#00f0ff",
            borderWidth: 2,
            color: "#e0f7fa",
            borderRadius: 8,
            boxShadow: glowCyan
          },
          "TTextInput": {
            backgroundColor: "#0b0c15",
            borderColor: "#00f0ff",
            borderWidth: 2,
            color: "#e0f7fa",
            borderRadius: 8,
            boxShadow: glowCyan
          }
        }
      });
      this.registerTheme({
        id: "superhero",
        name: "Superhero",
        description: "Mutige Comic-Farben mit kantigen Borders und starkem Kontrast.",
        components: {
          "TButton": {
            backgroundColor: "#f44336",
            borderColor: "#ffeb3b",
            borderWidth: 3,
            color: "#ffffff",
            borderRadius: 4,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "4px 4px 0 #ffeb3b"
          },
          "TPanel": {
            backgroundColor: "#1a237e",
            borderColor: "#ffeb3b",
            borderWidth: 3,
            borderRadius: 8,
            boxShadow: "6px 6px 0 #ffeb3b"
          },
          "TCard": {
            backgroundColor: "#283593",
            borderColor: "#ffeb3b",
            borderWidth: 3,
            borderRadius: 12,
            boxShadow: "6px 6px 0 #ffeb3b"
          },
          "TLabel": {
            color: "#ffeb3b",
            fontSize: 14,
            fontFamily: "Impact, sans-serif",
            fontWeight: "bold",
            textShadow: "2px 2px 0 #000000"
          },
          "TDialogRoot": {
            backgroundColor: "#1a237e",
            borderColor: "#f44336",
            borderWidth: 4,
            borderRadius: 12,
            boxShadow: "8px 8px 0 #f44336"
          },
          "TSidePanel": {
            backgroundColor: "#1a237e",
            borderColor: "#ffeb3b",
            borderWidth: 3,
            boxShadow: "-6px 0 0 #ffeb3b"
          },
          "TEdit": {
            backgroundColor: "#3949ab",
            borderColor: "#ffeb3b",
            borderWidth: 3,
            color: "#ffffff",
            borderRadius: 4
          },
          "TTextInput": {
            backgroundColor: "#3949ab",
            borderColor: "#ffeb3b",
            borderWidth: 3,
            color: "#ffffff",
            borderRadius: 4
          }
        }
      });
      this.registerTheme({
        id: "magic-forest",
        name: "Magic Forest",
        description: "Mystische Lila- und Gr\xFCnt\xF6ne mit sanftem Glow.",
        components: {
          "TButton": {
            backgroundColor: "#4527a0",
            borderColor: "#b388ff",
            borderWidth: 2,
            color: "#e1bee7",
            borderRadius: 16,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: glowPurple
          },
          "TPanel": {
            backgroundColor: "#1a0b2e",
            borderColor: "#7c4dff",
            borderWidth: 2,
            borderRadius: 18,
            boxShadow: "0 8px 32px rgba(124, 77, 255, 0.25)"
          },
          "TCard": {
            backgroundColor: "#311b92",
            borderColor: "#b388ff",
            borderWidth: 2,
            borderRadius: 20,
            boxShadow: "0 10px 20px rgba(179, 136, 255, 0.25)"
          },
          "TLabel": {
            color: "#b388ff",
            fontSize: 14,
            fontFamily: "Georgia, serif",
            fontWeight: "bold",
            textShadow: "0 0 6px #b388ff"
          },
          "TDialogRoot": {
            backgroundColor: "#1a0b2e",
            borderColor: "#b388ff",
            borderWidth: 2,
            borderRadius: 22,
            boxShadow: "0 20px 40px rgba(124, 77, 255, 0.35)"
          },
          "TSidePanel": {
            backgroundColor: "#1a0b2e",
            borderColor: "#7c4dff",
            borderWidth: 2,
            boxShadow: "10px 0 30px rgba(124, 77, 255, 0.25)"
          },
          "TEdit": {
            backgroundColor: "#311b92",
            borderColor: "#b388ff",
            borderWidth: 2,
            color: "#e1bee7",
            borderRadius: 12,
            boxShadow: glowPurple
          },
          "TTextInput": {
            backgroundColor: "#311b92",
            borderColor: "#b388ff",
            borderWidth: 2,
            color: "#e1bee7",
            borderRadius: 12,
            boxShadow: glowPurple
          }
        }
      });
      this.registerTheme({
        id: "ocean-deep",
        name: "Ocean Deep",
        description: "Tiefes Blau mit leuchtendem Cyan f\xFCr Unterwasser-Abenteuer.",
        components: {
          "TButton": {
            backgroundColor: "#006064",
            borderColor: "#00e5ff",
            borderWidth: 2,
            color: "#e0f7fa",
            borderRadius: 14,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "0 0 10px #00e5ff, 0 0 18px rgba(0, 229, 255, 0.35)"
          },
          "TPanel": {
            backgroundColor: "#001e36",
            borderColor: "#00bcd4",
            borderWidth: 2,
            borderRadius: 16,
            boxShadow: "0 8px 32px rgba(0, 188, 212, 0.25)"
          },
          "TCard": {
            backgroundColor: "#004d5c",
            borderColor: "#00e5ff",
            borderWidth: 2,
            borderRadius: 18,
            boxShadow: "0 10px 20px rgba(0, 229, 255, 0.25)"
          },
          "TLabel": {
            color: "#00e5ff",
            fontSize: 14,
            fontFamily: "Verdana, sans-serif",
            fontWeight: "bold",
            textShadow: "0 0 6px #00bcd4"
          },
          "TDialogRoot": {
            backgroundColor: "#001e36",
            borderColor: "#00e5ff",
            borderWidth: 2,
            borderRadius: 20,
            boxShadow: "0 20px 40px rgba(0, 229, 255, 0.3)"
          },
          "TSidePanel": {
            backgroundColor: "#001e36",
            borderColor: "#00bcd4",
            borderWidth: 2,
            boxShadow: "-10px 0 30px rgba(0, 188, 212, 0.25)"
          },
          "TEdit": {
            backgroundColor: "#004d5c",
            borderColor: "#00e5ff",
            borderWidth: 2,
            color: "#e0f7fa",
            borderRadius: 10,
            boxShadow: "0 0 8px #00e5ff"
          },
          "TTextInput": {
            backgroundColor: "#004d5c",
            borderColor: "#00e5ff",
            borderWidth: 2,
            color: "#e0f7fa",
            borderRadius: 10,
            boxShadow: "0 0 8px #00e5ff"
          }
        }
      });
      this.registerTheme({
        id: "pixel-adventure",
        name: "Pixel Adventure",
        description: "Retro-Block-Look in Gr\xFCn und Braun f\xFCr Abenteuer-Spiele.",
        components: {
          "TButton": {
            backgroundColor: "#8d6e63",
            borderColor: "#5d4037",
            borderWidth: 4,
            color: "#ffffff",
            borderRadius: 0,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "4px 4px 0 #3e2723"
          },
          "TPanel": {
            backgroundColor: "#2e7d32",
            borderColor: "#1b5e20",
            borderWidth: 4,
            borderRadius: 0,
            boxShadow: "6px 6px 0 #1b5e20"
          },
          "TCard": {
            backgroundColor: "#4caf50",
            borderColor: "#2e7d32",
            borderWidth: 4,
            borderRadius: 0,
            boxShadow: "6px 6px 0 #2e7d32"
          },
          "TLabel": {
            color: "#fff9c4",
            fontSize: 14,
            fontFamily: '"Press Start 2P", cursive, monospace',
            fontWeight: "bold",
            textShadow: "2px 2px 0 #1b5e20"
          },
          "TDialogRoot": {
            backgroundColor: "#2e7d32",
            borderColor: "#8d6e63",
            borderWidth: 4,
            borderRadius: 0,
            boxShadow: "8px 8px 0 #5d4037"
          },
          "TSidePanel": {
            backgroundColor: "#2e7d32",
            borderColor: "#1b5e20",
            borderWidth: 4,
            boxShadow: "-6px 0 0 #1b5e20"
          },
          "TEdit": {
            backgroundColor: "#a1887f",
            borderColor: "#5d4037",
            borderWidth: 4,
            color: "#3e2723",
            borderRadius: 0
          },
          "TTextInput": {
            backgroundColor: "#a1887f",
            borderColor: "#5d4037",
            borderWidth: 4,
            color: "#3e2723",
            borderRadius: 0
          }
        }
      });
      this.registerTheme({
        id: "sunset-vibes",
        name: "Sunset Vibes",
        description: "Warmer Orange-Lila-Verlauf mit weichem Glow.",
        components: {
          "TButton": {
            backgroundColor: "#ff7043",
            borderColor: "#ff9e80",
            borderWidth: 2,
            color: "#ffffff",
            borderRadius: 18,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: glowOrange
          },
          "TPanel": {
            backgroundColor: "#2d1b2e",
            borderColor: "#ff9e80",
            borderWidth: 2,
            borderRadius: 20,
            boxShadow: "0 8px 32px rgba(255, 158, 128, 0.25)"
          },
          "TCard": {
            backgroundColor: "#4a148c",
            borderColor: "#ffab91",
            borderWidth: 2,
            borderRadius: 22,
            boxShadow: "0 10px 20px rgba(255, 158, 128, 0.25)"
          },
          "TLabel": {
            color: "#ffe0b2",
            fontSize: 14,
            fontFamily: '"Trebuchet MS", sans-serif',
            fontWeight: "bold",
            textShadow: "0 0 6px #ff7043"
          },
          "TDialogRoot": {
            backgroundColor: "#2d1b2e",
            borderColor: "#ff9e80",
            borderWidth: 2,
            borderRadius: 24,
            boxShadow: "0 20px 40px rgba(255, 112, 67, 0.35)"
          },
          "TSidePanel": {
            backgroundColor: "#2d1b2e",
            borderColor: "#ff9e80",
            borderWidth: 2,
            boxShadow: "10px 0 30px rgba(255, 158, 128, 0.25)"
          },
          "TEdit": {
            backgroundColor: "#4a148c",
            borderColor: "#ff9e80",
            borderWidth: 2,
            color: "#ffe0b2",
            borderRadius: 12,
            boxShadow: glowOrange
          },
          "TTextInput": {
            backgroundColor: "#4a148c",
            borderColor: "#ff9e80",
            borderWidth: 2,
            color: "#ffe0b2",
            borderRadius: 12,
            boxShadow: glowOrange
          }
        }
      });
      this.registerTheme({
        id: "unicorn-glitter",
        name: "Unicorn Glitter",
        description: "Regenbogen-Pastell mit vielen Rundungen und einem sanften Glow.",
        components: {
          "TButton": {
            backgroundColor: "#ea80fc",
            borderColor: "#e040fb",
            borderWidth: 2,
            color: "#ffffff",
            borderRadius: 22,
            textAlign: "center",
            fontWeight: "bold",
            boxShadow: "0 0 10px #e040fb, 0 0 18px rgba(224, 64, 251, 0.35)"
          },
          "TPanel": {
            backgroundColor: "#f3e5f5",
            borderColor: "#ce93d8",
            borderWidth: 2,
            borderRadius: 26,
            boxShadow: "0 8px 24px rgba(206, 147, 216, 0.25)"
          },
          "TCard": {
            backgroundColor: "#e1bee7",
            borderColor: "#ba68c8",
            borderWidth: 2,
            borderRadius: 28,
            boxShadow: "0 10px 20px rgba(186, 104, 200, 0.25)"
          },
          "TLabel": {
            color: "#4a148c",
            fontSize: 14,
            fontFamily: '"Comic Sans MS", cursive, sans-serif',
            fontWeight: "bold"
          },
          "TDialogRoot": {
            backgroundColor: "#f3e5f5",
            borderColor: "#e040fb",
            borderWidth: 2,
            borderRadius: 30,
            boxShadow: "0 20px 40px rgba(224, 64, 251, 0.3)"
          },
          "TSidePanel": {
            backgroundColor: "#f3e5f5",
            borderColor: "#ce93d8",
            borderWidth: 2,
            boxShadow: "10px 0 30px rgba(206, 147, 216, 0.25)"
          },
          "TEdit": {
            backgroundColor: "#f8bbd0",
            borderColor: "#e040fb",
            borderWidth: 2,
            color: "#4a148c",
            borderRadius: 16
          },
          "TTextInput": {
            backgroundColor: "#f8bbd0",
            borderColor: "#e040fb",
            borderWidth: 2,
            color: "#4a148c",
            borderRadius: 16
          }
        }
      });
    }
    registerTheme(theme) {
      this.themes.set(theme.id, theme);
    }
    /**
     * Liefert alle Komponenten-Klassen, die in einer Theme-Stage bearbeitet werden können.
     */
    getThemeableComponentClasses() {
      return [...this.themeableComponents];
    }
    /**
     * Klont ein bestehendes Theme unter einer neuen ID.
     */
    cloneTheme(id, newId, newName) {
      const source = this.themes.get(id);
      if (!source) return null;
      return {
        id: newId,
        name: newName,
        description: source.description,
        components: JSON.parse(JSON.stringify(source.components))
      };
    }
    loadProjectThemes(themes) {
      if (!themes) return;
      themes.forEach((t) => this.registerTheme(t));
    }
    /**
     * Lädt eine einzelne Theme-JSON-Datei von einer URL.
     */
    async loadThemeFromUrl(url) {
      try {
        const response = await fetch(url);
        if (!response.ok) {
          _ThemeRegistry.logger.warn(`Theme-Datei konnte nicht geladen werden: ${url} (${response.status})`);
          return null;
        }
        const theme = await response.json();
        if (!theme || !theme.id || !theme.components) {
          _ThemeRegistry.logger.warn(`Ung\xFCltiges Theme-Format in ${url}`);
          return null;
        }
        this.registerTheme(theme);
        _ThemeRegistry.logger.info(`Theme geladen: ${theme.id} (${theme.name || "unbenannt"})`);
        return theme;
      } catch (e) {
        _ThemeRegistry.logger.warn(`Fehler beim Laden der Theme-Datei ${url}:`, e);
        return null;
      }
    }
    /**
     * Lädt alle Theme-Dateien, die in einer Index-JSON-Datei aufgelistet sind.
     */
    async loadThemesFromIndex(indexUrl) {
      try {
        const response = await fetch(indexUrl);
        if (!response.ok) {
          _ThemeRegistry.logger.warn(`Theme-Index konnte nicht geladen werden: ${indexUrl} (${response.status})`);
          return;
        }
        const urls = await response.json();
        if (!Array.isArray(urls)) return;
        const base = new URL(indexUrl, document.baseURI).href;
        for (const relativeUrl of urls) {
          const resolved = relativeUrl.startsWith("http") ? relativeUrl : new URL(relativeUrl, base).href;
          await this.loadThemeFromUrl(resolved);
        }
      } catch (e) {
        _ThemeRegistry.logger.warn(`Fehler beim Laden des Theme-Index ${indexUrl}:`, e);
      }
    }
    setActiveTheme(id) {
      if (this.themes.has(id)) {
        this.activeThemeId = id;
        _ThemeRegistry.logger.info(`Aktives Theme gesetzt auf: ${id}`);
        if (this.onChange) {
          this.onChange(id);
        }
      } else {
        _ThemeRegistry.logger.warn(`Theme ${id} nicht gefunden. Fallback auf modern-glass.`);
        this.activeThemeId = "modern-glass";
      }
    }
    getActiveThemeId() {
      return this.activeThemeId;
    }
    getAvailableThemes() {
      return Array.from(this.themes.values());
    }
    getStageStyle() {
      const theme = this.themes.get(this.activeThemeId);
      return {
        backgroundColor: theme?.stage?.backgroundColor || "#ffffff",
        gridColor: theme?.stage?.gridColor || "#dddddd"
      };
    }
    getComponentStyle(className) {
      const theme = this.themes.get(this.activeThemeId);
      if (!theme) return {};
      return { ...theme.components[className] || {} };
    }
    getMergedStyle(className, localStyle) {
      const themeStyle = this.getComponentStyle(className);
      const local = localStyle || {};
      if (local.boxShadow !== void 0 || local.glowColor !== void 0 || local.shadowColor !== void 0) {
        delete themeStyle.boxShadow;
      }
      return { ...themeStyle, ...local };
    }
  };
  var themeRegistry = ThemeRegistry.getInstance();

  // src/services/registry/CoreStore.ts
  var CoreStore = class {
    project = null;
    activeStageId = null;
    logger = Logger.get("ProjectRegistry", "Project_Validation");
    setProject(project) {
      this.project = project;
      if (project.activeStageId) {
        this.activeStageId = project.activeStageId;
      }
      if (project.themes) {
        themeRegistry.loadProjectThemes(project.themes);
      }
      if (project.activeThemeId) {
        themeRegistry.setActiveTheme(project.activeThemeId);
      } else {
        themeRegistry.setActiveTheme("modern-glass");
      }
    }
    getProject() {
      return this.project;
    }
    getStages() {
      return this.project?.stages || [];
    }
    setActiveStageId(id) {
      this.activeStageId = id;
    }
    getActiveStageId() {
      return this.activeStageId;
    }
    getActiveStage() {
      if (!this.project || !this.activeStageId) return null;
      return this.project.stages?.find((s) => s.id === this.activeStageId) || null;
    }
  };
  var coreStore = new CoreStore();

  // src/export/GameExporter.ts
  init_define_import_meta_env();

  // node_modules/fflate/esm/browser.js
  init_define_import_meta_env();
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
  var hMap = (function(cd, mb, r) {
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
  });
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
  var flm = /* @__PURE__ */ hMap(flt, 9, 0);
  var fdm = /* @__PURE__ */ hMap(fdt, 5, 0);
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
  var wbits = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
  };
  var wbits16 = function(d, p, v) {
    v <<= p & 7;
    var o = p / 8 | 0;
    d[o] |= v;
    d[o + 1] |= v >> 8;
    d[o + 2] |= v >> 16;
  };
  var hTree = function(d, mb) {
    var t = [];
    for (var i = 0; i < d.length; ++i) {
      if (d[i])
        t.push({ s: i, f: d[i] });
    }
    var s = t.length;
    var t2 = t.slice();
    if (!s)
      return { t: et, l: 0 };
    if (s == 1) {
      var v = new u8(t[0].s + 1);
      v[t[0].s] = 1;
      return { t: v, l: 1 };
    }
    t.sort(function(a, b) {
      return a.f - b.f;
    });
    t.push({ s: -1, f: 25001 });
    var l = t[0], r = t[1], i0 = 0, i1 = 1, i2 = 2;
    t[0] = { s: -1, f: l.f + r.f, l, r };
    while (i1 != s - 1) {
      l = t[t[i0].f < t[i2].f ? i0++ : i2++];
      r = t[i0 != i1 && t[i0].f < t[i2].f ? i0++ : i2++];
      t[i1++] = { s: -1, f: l.f + r.f, l, r };
    }
    var maxSym = t2[0].s;
    for (var i = 1; i < s; ++i) {
      if (t2[i].s > maxSym)
        maxSym = t2[i].s;
    }
    var tr = new u16(maxSym + 1);
    var mbt = ln(t[i1 - 1], tr, 0);
    if (mbt > mb) {
      var i = 0, dt = 0;
      var lft = mbt - mb, cst = 1 << lft;
      t2.sort(function(a, b) {
        return tr[b.s] - tr[a.s] || a.f - b.f;
      });
      for (; i < s; ++i) {
        var i2_1 = t2[i].s;
        if (tr[i2_1] > mb) {
          dt += cst - (1 << mbt - tr[i2_1]);
          tr[i2_1] = mb;
        } else
          break;
      }
      dt >>= lft;
      while (dt > 0) {
        var i2_2 = t2[i].s;
        if (tr[i2_2] < mb)
          dt -= 1 << mb - tr[i2_2]++ - 1;
        else
          ++i;
      }
      for (; i >= 0 && dt; --i) {
        var i2_3 = t2[i].s;
        if (tr[i2_3] == mb) {
          --tr[i2_3];
          ++dt;
        }
      }
      mbt = mb;
    }
    return { t: new u8(tr), l: mbt };
  };
  var ln = function(n, l, d) {
    return n.s == -1 ? Math.max(ln(n.l, l, d + 1), ln(n.r, l, d + 1)) : l[n.s] = d;
  };
  var lc = function(c) {
    var s = c.length;
    while (s && !c[--s])
      ;
    var cl = new u16(++s);
    var cli = 0, cln = c[0], cls = 1;
    var w = function(v) {
      cl[cli++] = v;
    };
    for (var i = 1; i <= s; ++i) {
      if (c[i] == cln && i != s)
        ++cls;
      else {
        if (!cln && cls > 2) {
          for (; cls > 138; cls -= 138)
            w(32754);
          if (cls > 2) {
            w(cls > 10 ? cls - 11 << 5 | 28690 : cls - 3 << 5 | 12305);
            cls = 0;
          }
        } else if (cls > 3) {
          w(cln), --cls;
          for (; cls > 6; cls -= 6)
            w(8304);
          if (cls > 2)
            w(cls - 3 << 5 | 8208), cls = 0;
        }
        while (cls--)
          w(cln);
        cls = 1;
        cln = c[i];
      }
    }
    return { c: cl.subarray(0, cli), n: s };
  };
  var clen = function(cf, cl) {
    var l = 0;
    for (var i = 0; i < cl.length; ++i)
      l += cf[i] * cl[i];
    return l;
  };
  var wfblk = function(out, pos, dat) {
    var s = dat.length;
    var o = shft(pos + 2);
    out[o] = s & 255;
    out[o + 1] = s >> 8;
    out[o + 2] = out[o] ^ 255;
    out[o + 3] = out[o + 1] ^ 255;
    for (var i = 0; i < s; ++i)
      out[o + i + 4] = dat[i];
    return (o + 4 + s) * 8;
  };
  var wblk = function(dat, out, final, syms, lf, df, eb, li, bs, bl, p) {
    wbits(out, p++, final);
    ++lf[256];
    var _a2 = hTree(lf, 15), dlt = _a2.t, mlb = _a2.l;
    var _b2 = hTree(df, 15), ddt = _b2.t, mdb = _b2.l;
    var _c = lc(dlt), lclt = _c.c, nlc = _c.n;
    var _d = lc(ddt), lcdt = _d.c, ndc = _d.n;
    var lcfreq = new u16(19);
    for (var i = 0; i < lclt.length; ++i)
      ++lcfreq[lclt[i] & 31];
    for (var i = 0; i < lcdt.length; ++i)
      ++lcfreq[lcdt[i] & 31];
    var _e = hTree(lcfreq, 7), lct = _e.t, mlcb = _e.l;
    var nlcc = 19;
    for (; nlcc > 4 && !lct[clim[nlcc - 1]]; --nlcc)
      ;
    var flen = bl + 5 << 3;
    var ftlen = clen(lf, flt) + clen(df, fdt) + eb;
    var dtlen = clen(lf, dlt) + clen(df, ddt) + eb + 14 + 3 * nlcc + clen(lcfreq, lct) + 2 * lcfreq[16] + 3 * lcfreq[17] + 7 * lcfreq[18];
    if (bs >= 0 && flen <= ftlen && flen <= dtlen)
      return wfblk(out, p, dat.subarray(bs, bs + bl));
    var lm, ll, dm, dl;
    wbits(out, p, 1 + (dtlen < ftlen)), p += 2;
    if (dtlen < ftlen) {
      lm = hMap(dlt, mlb, 0), ll = dlt, dm = hMap(ddt, mdb, 0), dl = ddt;
      var llm = hMap(lct, mlcb, 0);
      wbits(out, p, nlc - 257);
      wbits(out, p + 5, ndc - 1);
      wbits(out, p + 10, nlcc - 4);
      p += 14;
      for (var i = 0; i < nlcc; ++i)
        wbits(out, p + 3 * i, lct[clim[i]]);
      p += 3 * nlcc;
      var lcts = [lclt, lcdt];
      for (var it = 0; it < 2; ++it) {
        var clct = lcts[it];
        for (var i = 0; i < clct.length; ++i) {
          var len = clct[i] & 31;
          wbits(out, p, llm[len]), p += lct[len];
          if (len > 15)
            wbits(out, p, clct[i] >> 5 & 127), p += clct[i] >> 12;
        }
      }
    } else {
      lm = flm, ll = flt, dm = fdm, dl = fdt;
    }
    for (var i = 0; i < li; ++i) {
      var sym = syms[i];
      if (sym > 255) {
        var len = sym >> 18 & 31;
        wbits16(out, p, lm[len + 257]), p += ll[len + 257];
        if (len > 7)
          wbits(out, p, sym >> 23 & 31), p += fleb[len];
        var dst = sym & 31;
        wbits16(out, p, dm[dst]), p += dl[dst];
        if (dst > 3)
          wbits16(out, p, sym >> 5 & 8191), p += fdeb[dst];
      } else {
        wbits16(out, p, lm[sym]), p += ll[sym];
      }
    }
    wbits16(out, p, lm[256]);
    return p + ll[256];
  };
  var deo = /* @__PURE__ */ new i32([65540, 131080, 131088, 131104, 262176, 1048704, 1048832, 2114560, 2117632]);
  var et = /* @__PURE__ */ new u8(0);
  var dflt = function(dat, lvl, plvl, pre, post, st) {
    var s = st.z || dat.length;
    var o = new u8(pre + s + 5 * (1 + Math.ceil(s / 7e3)) + post);
    var w = o.subarray(pre, o.length - post);
    var lst = st.l;
    var pos = (st.r || 0) & 7;
    if (lvl) {
      if (pos)
        w[0] = st.r >> 3;
      var opt = deo[lvl - 1];
      var n = opt >> 13, c = opt & 8191;
      var msk_1 = (1 << plvl) - 1;
      var prev = st.p || new u16(32768), head = st.h || new u16(msk_1 + 1);
      var bs1_1 = Math.ceil(plvl / 3), bs2_1 = 2 * bs1_1;
      var hsh = function(i2) {
        return (dat[i2] ^ dat[i2 + 1] << bs1_1 ^ dat[i2 + 2] << bs2_1) & msk_1;
      };
      var syms = new i32(25e3);
      var lf = new u16(288), df = new u16(32);
      var lc_1 = 0, eb = 0, i = st.i || 0, li = 0, wi = st.w || 0, bs = 0;
      for (; i + 2 < s; ++i) {
        var hv = hsh(i);
        var imod = i & 32767, pimod = head[hv];
        prev[imod] = pimod;
        head[hv] = imod;
        if (wi <= i) {
          var rem = s - i;
          if ((lc_1 > 7e3 || li > 24576) && (rem > 423 || !lst)) {
            pos = wblk(dat, w, 0, syms, lf, df, eb, li, bs, i - bs, pos);
            li = lc_1 = eb = 0, bs = i;
            for (var j = 0; j < 286; ++j)
              lf[j] = 0;
            for (var j = 0; j < 30; ++j)
              df[j] = 0;
          }
          var l = 2, d = 0, ch_1 = c, dif = imod - pimod & 32767;
          if (rem > 2 && hv == hsh(i - dif)) {
            var maxn = Math.min(n, rem) - 1;
            var maxd = Math.min(32767, i);
            var ml = Math.min(258, rem);
            while (dif <= maxd && --ch_1 && imod != pimod) {
              if (dat[i + l] == dat[i + l - dif]) {
                var nl = 0;
                for (; nl < ml && dat[i + nl] == dat[i + nl - dif]; ++nl)
                  ;
                if (nl > l) {
                  l = nl, d = dif;
                  if (nl > maxn)
                    break;
                  var mmd = Math.min(dif, nl - 2);
                  var md = 0;
                  for (var j = 0; j < mmd; ++j) {
                    var ti = i - dif + j & 32767;
                    var pti = prev[ti];
                    var cd = ti - pti & 32767;
                    if (cd > md)
                      md = cd, pimod = ti;
                  }
                }
              }
              imod = pimod, pimod = prev[imod];
              dif += imod - pimod & 32767;
            }
          }
          if (d) {
            syms[li++] = 268435456 | revfl[l] << 18 | revfd[d];
            var lin = revfl[l] & 31, din = revfd[d] & 31;
            eb += fleb[lin] + fdeb[din];
            ++lf[257 + lin];
            ++df[din];
            wi = i + l;
            ++lc_1;
          } else {
            syms[li++] = dat[i];
            ++lf[dat[i]];
          }
        }
      }
      for (i = Math.max(i, wi); i < s; ++i) {
        syms[li++] = dat[i];
        ++lf[dat[i]];
      }
      pos = wblk(dat, w, lst, syms, lf, df, eb, li, bs, i - bs, pos);
      if (!lst) {
        st.r = pos & 7 | w[pos / 8 | 0] << 3;
        pos -= 7;
        st.h = head, st.p = prev, st.i = i, st.w = wi;
      }
    } else {
      for (var i = st.w || 0; i < s + lst; i += 65535) {
        var e = i + 65535;
        if (e >= s) {
          w[pos / 8 | 0] = lst;
          e = s;
        }
        pos = wfblk(w, pos + 1, dat.subarray(i, e));
      }
      st.i = s;
    }
    return slc(o, 0, pre + shft(pos) + post);
  };
  var crct = /* @__PURE__ */ (function() {
    var t = new Int32Array(256);
    for (var i = 0; i < 256; ++i) {
      var c = i, k = 9;
      while (--k)
        c = (c & 1 && -306674912) ^ c >>> 1;
      t[i] = c;
    }
    return t;
  })();
  var crc = function() {
    var c = -1;
    return {
      p: function(d) {
        var cr = c;
        for (var i = 0; i < d.length; ++i)
          cr = crct[cr & 255 ^ d[i]] ^ cr >>> 8;
        c = cr;
      },
      d: function() {
        return ~c;
      }
    };
  };
  var dopt = function(dat, opt, pre, post, st) {
    if (!st) {
      st = { l: 1 };
      if (opt.dictionary) {
        var dict = opt.dictionary.subarray(-32768);
        var newDat = new u8(dict.length + dat.length);
        newDat.set(dict);
        newDat.set(dat, dict.length);
        dat = newDat;
        st.w = dict.length;
      }
    }
    return dflt(dat, opt.level == null ? 6 : opt.level, opt.mem == null ? st.l ? Math.ceil(Math.max(8, Math.min(13, Math.log(dat.length))) * 1.5) : 20 : 12 + opt.mem, pre, post, st);
  };
  var mrg = function(a, b) {
    var o = {};
    for (var k in a)
      o[k] = a[k];
    for (var k in b)
      o[k] = b[k];
    return o;
  };
  var wbytes = function(d, b, v) {
    for (; v; ++b)
      d[b] = v, v >>>= 8;
  };
  var gzh = function(c, o) {
    var fn = o.filename;
    c[0] = 31, c[1] = 139, c[2] = 8, c[8] = o.level < 2 ? 4 : o.level == 9 ? 2 : 0, c[9] = 3;
    if (o.mtime != 0)
      wbytes(c, 4, Math.floor(new Date(o.mtime || Date.now()) / 1e3));
    if (fn) {
      c[3] = 8;
      for (var i = 0; i <= fn.length; ++i)
        c[i + 10] = fn.charCodeAt(i);
    }
  };
  var gzhl = function(o) {
    return 10 + (o.filename ? o.filename.length + 1 : 0);
  };
  function deflateSync(data, opts) {
    return dopt(data, opts || {}, 0, 0);
  }
  function gzipSync(data, opts) {
    if (!opts)
      opts = {};
    var c = crc(), l = data.length;
    c.p(data);
    var d = dopt(data, opts, gzhl(opts), 8), s = d.length;
    return gzh(d, opts), wbytes(d, s - 8, c.d()), wbytes(d, s - 4, l), d;
  }
  var fltn = function(d, p, t, o) {
    for (var k in d) {
      var val = d[k], n = p + k, op = o;
      if (Array.isArray(val))
        op = mrg(o, val[1]), val = val[0];
      if (val instanceof u8)
        t[n] = [val, op];
      else {
        t[n += "/"] = [new u8(0), op];
        fltn(val, n, t, o);
      }
    }
  };
  var te = typeof TextEncoder != "undefined" && /* @__PURE__ */ new TextEncoder();
  var td = typeof TextDecoder != "undefined" && /* @__PURE__ */ new TextDecoder();
  var tds = 0;
  try {
    td.decode(et, { stream: true });
    tds = 1;
  } catch (e) {
  }
  function strToU8(str, latin1) {
    if (latin1) {
      var ar_1 = new u8(str.length);
      for (var i = 0; i < str.length; ++i)
        ar_1[i] = str.charCodeAt(i);
      return ar_1;
    }
    if (te)
      return te.encode(str);
    var l = str.length;
    var ar = new u8(str.length + (str.length >> 1));
    var ai = 0;
    var w = function(v) {
      ar[ai++] = v;
    };
    for (var i = 0; i < l; ++i) {
      if (ai + 5 > ar.length) {
        var n = new u8(ai + 8 + (l - i << 1));
        n.set(ar);
        ar = n;
      }
      var c = str.charCodeAt(i);
      if (c < 128 || latin1)
        w(c);
      else if (c < 2048)
        w(192 | c >> 6), w(128 | c & 63);
      else if (c > 55295 && c < 57344)
        c = 65536 + (c & 1023 << 10) | str.charCodeAt(++i) & 1023, w(240 | c >> 18), w(128 | c >> 12 & 63), w(128 | c >> 6 & 63), w(128 | c & 63);
      else
        w(224 | c >> 12), w(128 | c >> 6 & 63), w(128 | c & 63);
    }
    return slc(ar, 0, ai);
  }
  var exfl = function(ex) {
    var le = 0;
    if (ex) {
      for (var k in ex) {
        var l = ex[k].length;
        if (l > 65535)
          err(9);
        le += l + 4;
      }
    }
    return le;
  };
  var wzh = function(d, b, f, fn, u, c, ce, co) {
    var fl2 = fn.length, ex = f.extra, col = co && co.length;
    var exl = exfl(ex);
    wbytes(d, b, ce != null ? 33639248 : 67324752), b += 4;
    if (ce != null)
      d[b++] = 20, d[b++] = f.os;
    d[b] = 20, b += 2;
    d[b++] = f.flag << 1 | (c < 0 && 8), d[b++] = u && 8;
    d[b++] = f.compression & 255, d[b++] = f.compression >> 8;
    var dt = new Date(f.mtime == null ? Date.now() : f.mtime), y = dt.getFullYear() - 1980;
    if (y < 0 || y > 119)
      err(10);
    wbytes(d, b, y << 25 | dt.getMonth() + 1 << 21 | dt.getDate() << 16 | dt.getHours() << 11 | dt.getMinutes() << 5 | dt.getSeconds() >> 1), b += 4;
    if (c != -1) {
      wbytes(d, b, f.crc);
      wbytes(d, b + 4, c < 0 ? -c - 2 : c);
      wbytes(d, b + 8, f.size);
    }
    wbytes(d, b + 12, fl2);
    wbytes(d, b + 14, exl), b += 16;
    if (ce != null) {
      wbytes(d, b, col);
      wbytes(d, b + 6, f.attrs);
      wbytes(d, b + 10, ce), b += 14;
    }
    d.set(fn, b);
    b += fl2;
    if (exl) {
      for (var k in ex) {
        var exf = ex[k], l = exf.length;
        wbytes(d, b, +k);
        wbytes(d, b + 2, l);
        d.set(exf, b + 4), b += 4 + l;
      }
    }
    if (col)
      d.set(co, b), b += col;
    return b;
  };
  var wzf = function(o, b, c, d, e) {
    wbytes(o, b, 101010256);
    wbytes(o, b + 8, c);
    wbytes(o, b + 10, c);
    wbytes(o, b + 12, d);
    wbytes(o, b + 16, e);
  };
  function zipSync(data, opts) {
    if (!opts)
      opts = {};
    var r = {};
    var files = [];
    fltn(data, "", r, opts);
    var o = 0;
    var tot = 0;
    for (var fn in r) {
      var _a2 = r[fn], file = _a2[0], p = _a2[1];
      var compression = p.level == 0 ? 0 : 8;
      var f = strToU8(fn), s = f.length;
      var com = p.comment, m = com && strToU8(com), ms = m && m.length;
      var exl = exfl(p.extra);
      if (s > 65535)
        err(11);
      var d = compression ? deflateSync(file, p) : file, l = d.length;
      var c = crc();
      c.p(file);
      files.push(mrg(p, {
        size: file.length,
        crc: c.d(),
        c: d,
        f,
        m,
        u: s != fn.length || m && com.length != ms,
        o,
        compression
      }));
      o += 30 + s + exl + l;
      tot += 76 + 2 * (s + exl) + (ms || 0) + l;
    }
    var out = new u8(tot + 22), oe = o, cdl = tot - o;
    for (var i = 0; i < files.length; ++i) {
      var f = files[i];
      wzh(out, f.o, f, f.f, f.u, f.c.length);
      var badd = 30 + f.f.length + exfl(f.extra);
      out.set(f.c, f.o + badd);
      wzh(out, o, f, f.f, f.u, f.c.length, f.o, f.m), o += 16 + badd + (f.m ? f.m.length : 0);
    }
    wzf(out, o, files.length, cdl, oe);
    return out;
  }

  // src/export/GameExporter.ts
  init_Logger();

  // src/editor/ui/NotificationToast.ts
  init_define_import_meta_env();
  var NotificationToast = class {
    static container = null;
    /**
     * Zeigt eine nicht-modale Toast-Benachrichtigung.
     * @param message  Nachricht (mehrzeilig mit \n möglich)
     * @param type     Typ: 'info' | 'success' | 'warning' | 'error'
     * @param duration Anzeigedauer in ms (0 = bleibt bis manuell geschlossen)
     */
    static show(message, type = "info", duration = 4e3) {
      if (!this.container) {
        this.container = document.createElement("div");
        this.container.style.cssText = "position:fixed; top:16px; right:16px; z-index:999999; display:flex; flex-direction:column; gap:8px; pointer-events:none;";
        document.body.appendChild(this.container);
      }
      const colors = {
        info: { bg: "#1a1a3e", border: "#4fc3f7", icon: "\u2139\uFE0F" },
        success: { bg: "#1a2e1a", border: "#66bb6a", icon: "\u2705" },
        warning: { bg: "#2e2a1a", border: "#ffa726", icon: "\u26A0\uFE0F" },
        error: { bg: "#2e1a1a", border: "#ef5350", icon: "\u274C" }
      };
      const c = colors[type] || colors.info;
      const toast = document.createElement("div");
      toast.className = "notification-toast";
      toast.style.cssText = `
            background: ${c.bg};
            border: 1px solid ${c.border};
            border-left: 4px solid ${c.border};
            border-radius: 8px;
            padding: 12px 16px;
            color: #e0e0e0;
            font-size: 13px;
            line-height: 1.5;
            max-width: 420px;
            box-shadow: 0 8px 32px rgba(0,0,0,0.4);
            pointer-events: auto;
            cursor: pointer;
            opacity: 0;
            transform: translateX(100%);
            transition: opacity 0.3s ease, transform 0.3s ease;
            white-space: pre-wrap;
            word-break: break-word;
        `;
      const content = document.createElement("div");
      content.style.cssText = "display:flex; align-items:flex-start; gap:8px;";
      const icon = document.createElement("span");
      icon.innerText = c.icon;
      icon.style.cssText = "flex-shrink:0; font-size:16px;";
      content.appendChild(icon);
      const text2 = document.createElement("span");
      text2.innerText = message;
      content.appendChild(text2);
      toast.appendChild(content);
      this.container.appendChild(toast);
      requestAnimationFrame(() => {
        toast.style.opacity = "1";
        toast.style.transform = "translateX(0)";
      });
      const remove = () => {
        toast.style.opacity = "0";
        toast.style.transform = "translateX(100%)";
        setTimeout(() => {
          toast.remove();
          if (this.container && this.container.children.length === 0) {
            this.container.remove();
            this.container = null;
          }
        }, 300);
      };
      toast.onclick = remove;
      if (duration > 0) {
        setTimeout(remove, duration);
      }
    }
  };

  // src/utils/SecurityUtils.ts
  init_define_import_meta_env();

  // node_modules/dompurify/dist/purify.es.mjs
  init_define_import_meta_env();
  function _arrayLikeToArray(r, a) {
    (null == a || a > r.length) && (a = r.length);
    for (var e = 0, n = Array(a); e < a; e++) n[e] = r[e];
    return n;
  }
  function _arrayWithHoles(r) {
    if (Array.isArray(r)) return r;
  }
  function _iterableToArrayLimit(r, l) {
    var t = null == r ? null : "undefined" != typeof Symbol && r[Symbol.iterator] || r["@@iterator"];
    if (null != t) {
      var e, n, i, u, a = [], f = true, o = false;
      try {
        if (i = (t = t.call(r)).next, 0 === l) ;
        else for (; !(f = (e = i.call(t)).done) && (a.push(e.value), a.length !== l); f = true) ;
      } catch (r2) {
        o = true, n = r2;
      } finally {
        try {
          if (!f && null != t.return && (u = t.return(), Object(u) !== u)) return;
        } finally {
          if (o) throw n;
        }
      }
      return a;
    }
  }
  function _nonIterableRest() {
    throw new TypeError("Invalid attempt to destructure non-iterable instance.\nIn order to be iterable, non-array objects must have a [Symbol.iterator]() method.");
  }
  function _slicedToArray(r, e) {
    return _arrayWithHoles(r) || _iterableToArrayLimit(r, e) || _unsupportedIterableToArray(r, e) || _nonIterableRest();
  }
  function _unsupportedIterableToArray(r, a) {
    if (r) {
      if ("string" == typeof r) return _arrayLikeToArray(r, a);
      var t = {}.toString.call(r).slice(8, -1);
      return "Object" === t && r.constructor && (t = r.constructor.name), "Map" === t || "Set" === t ? Array.from(r) : "Arguments" === t || /^(?:Ui|I)nt(?:8|16|32)(?:Clamped)?Array$/.test(t) ? _arrayLikeToArray(r, a) : void 0;
    }
  }
  var entries = Object.entries;
  var setPrototypeOf = Object.setPrototypeOf;
  var isFrozen = Object.isFrozen;
  var getPrototypeOf = Object.getPrototypeOf;
  var getOwnPropertyDescriptor = Object.getOwnPropertyDescriptor;
  var freeze = Object.freeze;
  var seal = Object.seal;
  var create = Object.create;
  var _ref = typeof Reflect !== "undefined" && Reflect;
  var apply = _ref.apply;
  var construct = _ref.construct;
  if (!freeze) {
    freeze = function freeze2(x) {
      return x;
    };
  }
  if (!seal) {
    seal = function seal2(x) {
      return x;
    };
  }
  if (!apply) {
    apply = function apply2(func, thisArg) {
      for (var _len = arguments.length, args = new Array(_len > 2 ? _len - 2 : 0), _key = 2; _key < _len; _key++) {
        args[_key - 2] = arguments[_key];
      }
      return func.apply(thisArg, args);
    };
  }
  if (!construct) {
    construct = function construct2(Func) {
      for (var _len2 = arguments.length, args = new Array(_len2 > 1 ? _len2 - 1 : 0), _key2 = 1; _key2 < _len2; _key2++) {
        args[_key2 - 1] = arguments[_key2];
      }
      return new Func(...args);
    };
  }
  var arrayForEach = unapply(Array.prototype.forEach);
  var arrayLastIndexOf = unapply(Array.prototype.lastIndexOf);
  var arrayPop = unapply(Array.prototype.pop);
  var arrayPush = unapply(Array.prototype.push);
  var arraySplice = unapply(Array.prototype.splice);
  var arrayIsArray = Array.isArray;
  var stringToLowerCase = unapply(String.prototype.toLowerCase);
  var stringToString = unapply(String.prototype.toString);
  var stringMatch = unapply(String.prototype.match);
  var stringReplace = unapply(String.prototype.replace);
  var stringIndexOf = unapply(String.prototype.indexOf);
  var stringTrim = unapply(String.prototype.trim);
  var numberToString = unapply(Number.prototype.toString);
  var booleanToString = unapply(Boolean.prototype.toString);
  var bigintToString = typeof BigInt === "undefined" ? null : unapply(BigInt.prototype.toString);
  var symbolToString = typeof Symbol === "undefined" ? null : unapply(Symbol.prototype.toString);
  var objectHasOwnProperty = unapply(Object.prototype.hasOwnProperty);
  var objectToString = unapply(Object.prototype.toString);
  var regExpTest = unapply(RegExp.prototype.test);
  var typeErrorCreate = unconstruct(TypeError);
  function unapply(func) {
    return function(thisArg) {
      if (thisArg instanceof RegExp) {
        thisArg.lastIndex = 0;
      }
      for (var _len3 = arguments.length, args = new Array(_len3 > 1 ? _len3 - 1 : 0), _key3 = 1; _key3 < _len3; _key3++) {
        args[_key3 - 1] = arguments[_key3];
      }
      return apply(func, thisArg, args);
    };
  }
  function unconstruct(Func) {
    return function() {
      for (var _len4 = arguments.length, args = new Array(_len4), _key4 = 0; _key4 < _len4; _key4++) {
        args[_key4] = arguments[_key4];
      }
      return construct(Func, args);
    };
  }
  function addToSet(set, array) {
    let transformCaseFunc = arguments.length > 2 && arguments[2] !== void 0 ? arguments[2] : stringToLowerCase;
    if (setPrototypeOf) {
      setPrototypeOf(set, null);
    }
    if (!arrayIsArray(array)) {
      return set;
    }
    let l = array.length;
    while (l--) {
      let element = array[l];
      if (typeof element === "string") {
        const lcElement = transformCaseFunc(element);
        if (lcElement !== element) {
          if (!isFrozen(array)) {
            array[l] = lcElement;
          }
          element = lcElement;
        }
      }
      set[element] = true;
    }
    return set;
  }
  function cleanArray(array) {
    for (let index = 0; index < array.length; index++) {
      const isPropertyExist = objectHasOwnProperty(array, index);
      if (!isPropertyExist) {
        array[index] = null;
      }
    }
    return array;
  }
  function clone(object) {
    const newObject = create(null);
    for (const _ref2 of entries(object)) {
      var _ref3 = _slicedToArray(_ref2, 2);
      const property = _ref3[0];
      const value = _ref3[1];
      const isPropertyExist = objectHasOwnProperty(object, property);
      if (isPropertyExist) {
        if (arrayIsArray(value)) {
          newObject[property] = cleanArray(value);
        } else if (value && typeof value === "object" && value.constructor === Object) {
          newObject[property] = clone(value);
        } else {
          newObject[property] = value;
        }
      }
    }
    return newObject;
  }
  function stringifyValue(value) {
    switch (typeof value) {
      case "string": {
        return value;
      }
      case "number": {
        return numberToString(value);
      }
      case "boolean": {
        return booleanToString(value);
      }
      case "bigint": {
        return bigintToString ? bigintToString(value) : "0";
      }
      case "symbol": {
        return symbolToString ? symbolToString(value) : "Symbol()";
      }
      case "undefined": {
        return objectToString(value);
      }
      case "function":
      case "object": {
        if (value === null) {
          return objectToString(value);
        }
        const valueAsRecord = value;
        const valueToString = lookupGetter(valueAsRecord, "toString");
        if (typeof valueToString === "function") {
          const stringified = valueToString(valueAsRecord);
          return typeof stringified === "string" ? stringified : objectToString(stringified);
        }
        return objectToString(value);
      }
      default: {
        return objectToString(value);
      }
    }
  }
  function lookupGetter(object, prop) {
    while (object !== null) {
      const desc = getOwnPropertyDescriptor(object, prop);
      if (desc) {
        if (desc.get) {
          return unapply(desc.get);
        }
        if (typeof desc.value === "function") {
          return unapply(desc.value);
        }
      }
      object = getPrototypeOf(object);
    }
    function fallbackValue() {
      return null;
    }
    return fallbackValue;
  }
  function isRegex(value) {
    try {
      regExpTest(value, "");
      return true;
    } catch (_unused) {
      return false;
    }
  }
  var html$1 = freeze(["a", "abbr", "acronym", "address", "area", "article", "aside", "audio", "b", "bdi", "bdo", "big", "blink", "blockquote", "body", "br", "button", "canvas", "caption", "center", "cite", "code", "col", "colgroup", "content", "data", "datalist", "dd", "decorator", "del", "details", "dfn", "dialog", "dir", "div", "dl", "dt", "element", "em", "fieldset", "figcaption", "figure", "font", "footer", "form", "h1", "h2", "h3", "h4", "h5", "h6", "head", "header", "hgroup", "hr", "html", "i", "img", "input", "ins", "kbd", "label", "legend", "li", "main", "map", "mark", "marquee", "menu", "menuitem", "meter", "nav", "nobr", "ol", "optgroup", "option", "output", "p", "picture", "pre", "progress", "q", "rp", "rt", "ruby", "s", "samp", "search", "section", "select", "shadow", "slot", "small", "source", "spacer", "span", "strike", "strong", "style", "sub", "summary", "sup", "table", "tbody", "td", "template", "textarea", "tfoot", "th", "thead", "time", "tr", "track", "tt", "u", "ul", "var", "video", "wbr"]);
  var svg$1 = freeze(["svg", "a", "altglyph", "altglyphdef", "altglyphitem", "animatecolor", "animatemotion", "animatetransform", "circle", "clippath", "defs", "desc", "ellipse", "enterkeyhint", "exportparts", "filter", "font", "g", "glyph", "glyphref", "hkern", "image", "inputmode", "line", "lineargradient", "marker", "mask", "metadata", "mpath", "part", "path", "pattern", "polygon", "polyline", "radialgradient", "rect", "stop", "style", "switch", "symbol", "text", "textpath", "title", "tref", "tspan", "view", "vkern"]);
  var svgFilters = freeze(["feBlend", "feColorMatrix", "feComponentTransfer", "feComposite", "feConvolveMatrix", "feDiffuseLighting", "feDisplacementMap", "feDistantLight", "feDropShadow", "feFlood", "feFuncA", "feFuncB", "feFuncG", "feFuncR", "feGaussianBlur", "feImage", "feMerge", "feMergeNode", "feMorphology", "feOffset", "fePointLight", "feSpecularLighting", "feSpotLight", "feTile", "feTurbulence"]);
  var svgDisallowed = freeze(["animate", "color-profile", "cursor", "discard", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "foreignobject", "hatch", "hatchpath", "mesh", "meshgradient", "meshpatch", "meshrow", "missing-glyph", "script", "set", "solidcolor", "unknown", "use"]);
  var mathMl$1 = freeze(["math", "menclose", "merror", "mfenced", "mfrac", "mglyph", "mi", "mlabeledtr", "mmultiscripts", "mn", "mo", "mover", "mpadded", "mphantom", "mroot", "mrow", "ms", "mspace", "msqrt", "mstyle", "msub", "msup", "msubsup", "mtable", "mtd", "mtext", "mtr", "munder", "munderover", "mprescripts"]);
  var mathMlDisallowed = freeze(["maction", "maligngroup", "malignmark", "mlongdiv", "mscarries", "mscarry", "msgroup", "mstack", "msline", "msrow", "semantics", "annotation", "annotation-xml", "mprescripts", "none"]);
  var text = freeze(["#text"]);
  var html = freeze(["accept", "action", "align", "alt", "autocapitalize", "autocomplete", "autopictureinpicture", "autoplay", "background", "bgcolor", "border", "capture", "cellpadding", "cellspacing", "checked", "cite", "class", "clear", "color", "cols", "colspan", "command", "commandfor", "controls", "controlslist", "coords", "crossorigin", "datetime", "decoding", "default", "dir", "disabled", "disablepictureinpicture", "disableremoteplayback", "download", "draggable", "enctype", "enterkeyhint", "exportparts", "face", "for", "headers", "height", "hidden", "high", "href", "hreflang", "id", "inert", "inputmode", "integrity", "ismap", "kind", "label", "lang", "list", "loading", "loop", "low", "max", "maxlength", "media", "method", "min", "minlength", "multiple", "muted", "name", "nonce", "noshade", "novalidate", "nowrap", "open", "optimum", "part", "pattern", "placeholder", "playsinline", "popover", "popovertarget", "popovertargetaction", "poster", "preload", "pubdate", "radiogroup", "readonly", "rel", "required", "rev", "reversed", "role", "rows", "rowspan", "spellcheck", "scope", "selected", "shape", "size", "sizes", "slot", "span", "srclang", "start", "src", "srcset", "step", "style", "summary", "tabindex", "title", "translate", "type", "usemap", "valign", "value", "width", "wrap", "xmlns"]);
  var svg = freeze(["accent-height", "accumulate", "additive", "alignment-baseline", "amplitude", "ascent", "attributename", "attributetype", "azimuth", "basefrequency", "baseline-shift", "begin", "bias", "by", "class", "clip", "clippathunits", "clip-path", "clip-rule", "color", "color-interpolation", "color-interpolation-filters", "color-profile", "color-rendering", "cx", "cy", "d", "dx", "dy", "diffuseconstant", "direction", "display", "divisor", "dur", "edgemode", "elevation", "end", "exponent", "fill", "fill-opacity", "fill-rule", "filter", "filterunits", "flood-color", "flood-opacity", "font-family", "font-size", "font-size-adjust", "font-stretch", "font-style", "font-variant", "font-weight", "fx", "fy", "g1", "g2", "glyph-name", "glyphref", "gradientunits", "gradienttransform", "height", "href", "id", "image-rendering", "in", "in2", "intercept", "k", "k1", "k2", "k3", "k4", "kerning", "keypoints", "keysplines", "keytimes", "lang", "lengthadjust", "letter-spacing", "kernelmatrix", "kernelunitlength", "lighting-color", "local", "marker-end", "marker-mid", "marker-start", "markerheight", "markerunits", "markerwidth", "maskcontentunits", "maskunits", "max", "mask", "mask-type", "media", "method", "mode", "min", "name", "numoctaves", "offset", "operator", "opacity", "order", "orient", "orientation", "origin", "overflow", "paint-order", "path", "pathlength", "patterncontentunits", "patterntransform", "patternunits", "points", "preservealpha", "preserveaspectratio", "primitiveunits", "r", "rx", "ry", "radius", "refx", "refy", "repeatcount", "repeatdur", "restart", "result", "rotate", "scale", "seed", "shape-rendering", "slope", "specularconstant", "specularexponent", "spreadmethod", "startoffset", "stddeviation", "stitchtiles", "stop-color", "stop-opacity", "stroke-dasharray", "stroke-dashoffset", "stroke-linecap", "stroke-linejoin", "stroke-miterlimit", "stroke-opacity", "stroke", "stroke-width", "style", "surfacescale", "systemlanguage", "tabindex", "tablevalues", "targetx", "targety", "transform", "transform-origin", "text-anchor", "text-decoration", "text-rendering", "textlength", "type", "u1", "u2", "unicode", "values", "viewbox", "visibility", "version", "vert-adv-y", "vert-origin-x", "vert-origin-y", "width", "word-spacing", "wrap", "writing-mode", "xchannelselector", "ychannelselector", "x", "x1", "x2", "xmlns", "y", "y1", "y2", "z", "zoomandpan"]);
  var mathMl = freeze(["accent", "accentunder", "align", "bevelled", "close", "columnalign", "columnlines", "columnspacing", "columnspan", "denomalign", "depth", "dir", "display", "displaystyle", "encoding", "fence", "frame", "height", "href", "id", "largeop", "length", "linethickness", "lquote", "lspace", "mathbackground", "mathcolor", "mathsize", "mathvariant", "maxsize", "minsize", "movablelimits", "notation", "numalign", "open", "rowalign", "rowlines", "rowspacing", "rowspan", "rspace", "rquote", "scriptlevel", "scriptminsize", "scriptsizemultiplier", "selection", "separator", "separators", "stretchy", "subscriptshift", "supscriptshift", "symmetric", "voffset", "width", "xmlns"]);
  var xml = freeze(["xlink:href", "xml:id", "xlink:title", "xml:space", "xmlns:xlink"]);
  var MUSTACHE_EXPR = seal(/{{[\w\W]*|^[\w\W]*}}/g);
  var ERB_EXPR = seal(/<%[\w\W]*|^[\w\W]*%>/g);
  var TMPLIT_EXPR = seal(/\${[\w\W]*/g);
  var DATA_ATTR = seal(/^data-[\-\w.\u00B7-\uFFFF]+$/);
  var ARIA_ATTR = seal(/^aria-[\-\w]+$/);
  var IS_ALLOWED_URI = seal(
    /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|sms|cid|xmpp|matrix):|[^a-z]|[a-z+.\-]+(?:[^a-z+.\-:]|$))/i
    // eslint-disable-line no-useless-escape
  );
  var IS_SCRIPT_OR_DATA = seal(/^(?:\w+script|data):/i);
  var ATTR_WHITESPACE = seal(
    /[\u0000-\u0020\u00A0\u1680\u180E\u2000-\u2029\u205F\u3000]/g
    // eslint-disable-line no-control-regex
  );
  var DOCTYPE_NAME = seal(/^html$/i);
  var CUSTOM_ELEMENT = seal(/^[a-z][.\w]*(-[.\w]+)+$/i);
  var NODE_TYPE = {
    element: 1,
    attribute: 2,
    text: 3,
    cdataSection: 4,
    entityReference: 5,
    // Deprecated
    entityNode: 6,
    // Deprecated
    progressingInstruction: 7,
    comment: 8,
    document: 9,
    documentType: 10,
    documentFragment: 11,
    notation: 12
    // Deprecated
  };
  var getGlobal = function getGlobal2() {
    return typeof window === "undefined" ? null : window;
  };
  var _createTrustedTypesPolicy = function _createTrustedTypesPolicy2(trustedTypes, purifyHostElement) {
    if (typeof trustedTypes !== "object" || typeof trustedTypes.createPolicy !== "function") {
      return null;
    }
    let suffix = null;
    const ATTR_NAME = "data-tt-policy-suffix";
    if (purifyHostElement && purifyHostElement.hasAttribute(ATTR_NAME)) {
      suffix = purifyHostElement.getAttribute(ATTR_NAME);
    }
    const policyName = "dompurify" + (suffix ? "#" + suffix : "");
    try {
      return trustedTypes.createPolicy(policyName, {
        createHTML(html2) {
          return html2;
        },
        createScriptURL(scriptUrl) {
          return scriptUrl;
        }
      });
    } catch (_) {
      console.warn("TrustedTypes policy " + policyName + " could not be created.");
      return null;
    }
  };
  var _createHooksMap = function _createHooksMap2() {
    return {
      afterSanitizeAttributes: [],
      afterSanitizeElements: [],
      afterSanitizeShadowDOM: [],
      beforeSanitizeAttributes: [],
      beforeSanitizeElements: [],
      beforeSanitizeShadowDOM: [],
      uponSanitizeAttribute: [],
      uponSanitizeElement: [],
      uponSanitizeShadowNode: []
    };
  };
  function createDOMPurify() {
    let window2 = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : getGlobal();
    const DOMPurify = (root) => createDOMPurify(root);
    DOMPurify.version = "3.4.9";
    DOMPurify.removed = [];
    if (!window2 || !window2.document || window2.document.nodeType !== NODE_TYPE.document || !window2.Element) {
      DOMPurify.isSupported = false;
      return DOMPurify;
    }
    let document2 = window2.document;
    const originalDocument = document2;
    const currentScript = originalDocument.currentScript;
    window2.DocumentFragment;
    const HTMLTemplateElement = window2.HTMLTemplateElement, Node2 = window2.Node, Element = window2.Element, NodeFilter = window2.NodeFilter, _window$NamedNodeMap = window2.NamedNodeMap;
    _window$NamedNodeMap === void 0 ? window2.NamedNodeMap || window2.MozNamedAttrMap : _window$NamedNodeMap;
    window2.HTMLFormElement;
    const DOMParser = window2.DOMParser, trustedTypes = window2.trustedTypes;
    const ElementPrototype = Element.prototype;
    const cloneNode = lookupGetter(ElementPrototype, "cloneNode");
    const remove = lookupGetter(ElementPrototype, "remove");
    const getNextSibling = lookupGetter(ElementPrototype, "nextSibling");
    const getChildNodes = lookupGetter(ElementPrototype, "childNodes");
    const getParentNode = lookupGetter(ElementPrototype, "parentNode");
    const getShadowRoot = lookupGetter(ElementPrototype, "shadowRoot");
    const getAttributes = lookupGetter(ElementPrototype, "attributes");
    const getNodeType = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "nodeType") : null;
    const getNodeName = Node2 && Node2.prototype ? lookupGetter(Node2.prototype, "nodeName") : null;
    if (typeof HTMLTemplateElement === "function") {
      const template = document2.createElement("template");
      if (template.content && template.content.ownerDocument) {
        document2 = template.content.ownerDocument;
      }
    }
    let trustedTypesPolicy;
    let emptyHTML = "";
    let defaultTrustedTypesPolicy;
    let defaultTrustedTypesPolicyResolved = false;
    let IN_TRUSTED_TYPES_POLICY = 0;
    const _assertNotInTrustedTypesPolicy = function _assertNotInTrustedTypesPolicy2() {
      if (IN_TRUSTED_TYPES_POLICY > 0) {
        throw typeErrorCreate('A configured TRUSTED_TYPES_POLICY callback (createHTML or createScriptURL) must not call DOMPurify.sanitize, as that causes infinite recursion. Do not pass a policy whose callbacks wrap DOMPurify as TRUSTED_TYPES_POLICY; see the "DOMPurify and Trusted Types" section of the README.');
      }
    };
    const _createTrustedHTML = function _createTrustedHTML2(html2) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createHTML(html2);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _createTrustedScriptURL = function _createTrustedScriptURL2(scriptUrl) {
      _assertNotInTrustedTypesPolicy();
      IN_TRUSTED_TYPES_POLICY++;
      try {
        return trustedTypesPolicy.createScriptURL(scriptUrl);
      } finally {
        IN_TRUSTED_TYPES_POLICY--;
      }
    };
    const _getDefaultTrustedTypesPolicy = function _getDefaultTrustedTypesPolicy2() {
      if (!defaultTrustedTypesPolicyResolved) {
        defaultTrustedTypesPolicy = _createTrustedTypesPolicy(trustedTypes, currentScript);
        defaultTrustedTypesPolicyResolved = true;
      }
      return defaultTrustedTypesPolicy;
    };
    const _document = document2, implementation = _document.implementation, createNodeIterator = _document.createNodeIterator, createDocumentFragment = _document.createDocumentFragment, getElementsByTagName = _document.getElementsByTagName;
    const importNode = originalDocument.importNode;
    let hooks = _createHooksMap();
    DOMPurify.isSupported = typeof entries === "function" && typeof getParentNode === "function" && implementation && implementation.createHTMLDocument !== void 0;
    const MUSTACHE_EXPR$1 = MUSTACHE_EXPR, ERB_EXPR$1 = ERB_EXPR, TMPLIT_EXPR$1 = TMPLIT_EXPR, DATA_ATTR$1 = DATA_ATTR, ARIA_ATTR$1 = ARIA_ATTR, IS_SCRIPT_OR_DATA$1 = IS_SCRIPT_OR_DATA, ATTR_WHITESPACE$1 = ATTR_WHITESPACE, CUSTOM_ELEMENT$1 = CUSTOM_ELEMENT;
    let IS_ALLOWED_URI$1 = IS_ALLOWED_URI;
    let ALLOWED_TAGS = null;
    const DEFAULT_ALLOWED_TAGS = addToSet({}, [...html$1, ...svg$1, ...svgFilters, ...mathMl$1, ...text]);
    let ALLOWED_ATTR = null;
    const DEFAULT_ALLOWED_ATTR = addToSet({}, [...html, ...svg, ...mathMl, ...xml]);
    let CUSTOM_ELEMENT_HANDLING = Object.seal(create(null, {
      tagNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeNameCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      allowCustomizedBuiltInElements: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: false
      }
    }));
    let FORBID_TAGS = null;
    let FORBID_ATTR = null;
    const EXTRA_ELEMENT_HANDLING = Object.seal(create(null, {
      tagCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      },
      attributeCheck: {
        writable: true,
        configurable: false,
        enumerable: true,
        value: null
      }
    }));
    let ALLOW_ARIA_ATTR = true;
    let ALLOW_DATA_ATTR = true;
    let ALLOW_UNKNOWN_PROTOCOLS = false;
    let ALLOW_SELF_CLOSE_IN_ATTR = true;
    let SAFE_FOR_TEMPLATES = false;
    let SAFE_FOR_XML = true;
    let WHOLE_DOCUMENT = false;
    let SET_CONFIG = false;
    let FORCE_BODY = false;
    let RETURN_DOM = false;
    let RETURN_DOM_FRAGMENT = false;
    let RETURN_TRUSTED_TYPE = false;
    let SANITIZE_DOM = true;
    let SANITIZE_NAMED_PROPS = false;
    const SANITIZE_NAMED_PROPS_PREFIX = "user-content-";
    let KEEP_CONTENT = true;
    let IN_PLACE = false;
    let USE_PROFILES = {};
    let FORBID_CONTENTS = null;
    const DEFAULT_FORBID_CONTENTS = addToSet({}, [
      "annotation-xml",
      "audio",
      "colgroup",
      "desc",
      "foreignobject",
      "head",
      "iframe",
      "math",
      "mi",
      "mn",
      "mo",
      "ms",
      "mtext",
      "noembed",
      "noframes",
      "noscript",
      "plaintext",
      "script",
      // <selectedcontent> mirrors the selected <option>'s subtree, cloned by
      // the UA (customizable <select>) — including any on* handlers — and the
      // engine re-mirrors synchronously whenever a removal changes which
      // option/selectedcontent is current, even inside DOMPurify's inert
      // DOMParser document. Hoisting its children on removal re-inserts a fresh
      // mirror target ahead of the walk, which the engine refills, looping
      // forever (DoS) and amplifying output. Dropping its content on removal
      // (rather than hoisting) breaks that cascade; the content is a duplicate
      // of the option, which is sanitized on its own. See campaign-3 F1/F6.
      "selectedcontent",
      "style",
      "svg",
      "template",
      "thead",
      "title",
      "video",
      "xmp"
    ]);
    let DATA_URI_TAGS = null;
    const DEFAULT_DATA_URI_TAGS = addToSet({}, ["audio", "video", "img", "source", "image", "track"]);
    let URI_SAFE_ATTRIBUTES = null;
    const DEFAULT_URI_SAFE_ATTRIBUTES = addToSet({}, ["alt", "class", "for", "id", "label", "name", "pattern", "placeholder", "role", "summary", "title", "value", "style", "xmlns"]);
    const MATHML_NAMESPACE = "http://www.w3.org/1998/Math/MathML";
    const SVG_NAMESPACE = "http://www.w3.org/2000/svg";
    const HTML_NAMESPACE = "http://www.w3.org/1999/xhtml";
    let NAMESPACE = HTML_NAMESPACE;
    let IS_EMPTY_INPUT = false;
    let ALLOWED_NAMESPACES = null;
    const DEFAULT_ALLOWED_NAMESPACES = addToSet({}, [MATHML_NAMESPACE, SVG_NAMESPACE, HTML_NAMESPACE], stringToString);
    let MATHML_TEXT_INTEGRATION_POINTS = addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
    let HTML_INTEGRATION_POINTS = addToSet({}, ["annotation-xml"]);
    const COMMON_SVG_AND_HTML_ELEMENTS = addToSet({}, ["title", "style", "font", "a", "script"]);
    let PARSER_MEDIA_TYPE = null;
    const SUPPORTED_PARSER_MEDIA_TYPES = ["application/xhtml+xml", "text/html"];
    const DEFAULT_PARSER_MEDIA_TYPE = "text/html";
    let transformCaseFunc = null;
    let CONFIG = null;
    const formElement = document2.createElement("form");
    const isRegexOrFunction = function isRegexOrFunction2(testValue) {
      return testValue instanceof RegExp || testValue instanceof Function;
    };
    const _parseConfig = function _parseConfig2() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      if (CONFIG && CONFIG === cfg) {
        return;
      }
      if (!cfg || typeof cfg !== "object") {
        cfg = {};
      }
      cfg = clone(cfg);
      PARSER_MEDIA_TYPE = // eslint-disable-next-line unicorn/prefer-includes
      SUPPORTED_PARSER_MEDIA_TYPES.indexOf(cfg.PARSER_MEDIA_TYPE) === -1 ? DEFAULT_PARSER_MEDIA_TYPE : cfg.PARSER_MEDIA_TYPE;
      transformCaseFunc = PARSER_MEDIA_TYPE === "application/xhtml+xml" ? stringToString : stringToLowerCase;
      ALLOWED_TAGS = objectHasOwnProperty(cfg, "ALLOWED_TAGS") && arrayIsArray(cfg.ALLOWED_TAGS) ? addToSet({}, cfg.ALLOWED_TAGS, transformCaseFunc) : DEFAULT_ALLOWED_TAGS;
      ALLOWED_ATTR = objectHasOwnProperty(cfg, "ALLOWED_ATTR") && arrayIsArray(cfg.ALLOWED_ATTR) ? addToSet({}, cfg.ALLOWED_ATTR, transformCaseFunc) : DEFAULT_ALLOWED_ATTR;
      ALLOWED_NAMESPACES = objectHasOwnProperty(cfg, "ALLOWED_NAMESPACES") && arrayIsArray(cfg.ALLOWED_NAMESPACES) ? addToSet({}, cfg.ALLOWED_NAMESPACES, stringToString) : DEFAULT_ALLOWED_NAMESPACES;
      URI_SAFE_ATTRIBUTES = objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR) ? addToSet(clone(DEFAULT_URI_SAFE_ATTRIBUTES), cfg.ADD_URI_SAFE_ATTR, transformCaseFunc) : DEFAULT_URI_SAFE_ATTRIBUTES;
      DATA_URI_TAGS = objectHasOwnProperty(cfg, "ADD_DATA_URI_TAGS") && arrayIsArray(cfg.ADD_DATA_URI_TAGS) ? addToSet(clone(DEFAULT_DATA_URI_TAGS), cfg.ADD_DATA_URI_TAGS, transformCaseFunc) : DEFAULT_DATA_URI_TAGS;
      FORBID_CONTENTS = objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS) ? addToSet({}, cfg.FORBID_CONTENTS, transformCaseFunc) : DEFAULT_FORBID_CONTENTS;
      FORBID_TAGS = objectHasOwnProperty(cfg, "FORBID_TAGS") && arrayIsArray(cfg.FORBID_TAGS) ? addToSet({}, cfg.FORBID_TAGS, transformCaseFunc) : clone({});
      FORBID_ATTR = objectHasOwnProperty(cfg, "FORBID_ATTR") && arrayIsArray(cfg.FORBID_ATTR) ? addToSet({}, cfg.FORBID_ATTR, transformCaseFunc) : clone({});
      USE_PROFILES = objectHasOwnProperty(cfg, "USE_PROFILES") ? cfg.USE_PROFILES && typeof cfg.USE_PROFILES === "object" ? clone(cfg.USE_PROFILES) : cfg.USE_PROFILES : false;
      ALLOW_ARIA_ATTR = cfg.ALLOW_ARIA_ATTR !== false;
      ALLOW_DATA_ATTR = cfg.ALLOW_DATA_ATTR !== false;
      ALLOW_UNKNOWN_PROTOCOLS = cfg.ALLOW_UNKNOWN_PROTOCOLS || false;
      ALLOW_SELF_CLOSE_IN_ATTR = cfg.ALLOW_SELF_CLOSE_IN_ATTR !== false;
      SAFE_FOR_TEMPLATES = cfg.SAFE_FOR_TEMPLATES || false;
      SAFE_FOR_XML = cfg.SAFE_FOR_XML !== false;
      WHOLE_DOCUMENT = cfg.WHOLE_DOCUMENT || false;
      RETURN_DOM = cfg.RETURN_DOM || false;
      RETURN_DOM_FRAGMENT = cfg.RETURN_DOM_FRAGMENT || false;
      RETURN_TRUSTED_TYPE = cfg.RETURN_TRUSTED_TYPE || false;
      FORCE_BODY = cfg.FORCE_BODY || false;
      SANITIZE_DOM = cfg.SANITIZE_DOM !== false;
      SANITIZE_NAMED_PROPS = cfg.SANITIZE_NAMED_PROPS || false;
      KEEP_CONTENT = cfg.KEEP_CONTENT !== false;
      IN_PLACE = cfg.IN_PLACE || false;
      IS_ALLOWED_URI$1 = isRegex(cfg.ALLOWED_URI_REGEXP) ? cfg.ALLOWED_URI_REGEXP : IS_ALLOWED_URI;
      NAMESPACE = typeof cfg.NAMESPACE === "string" ? cfg.NAMESPACE : HTML_NAMESPACE;
      MATHML_TEXT_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "MATHML_TEXT_INTEGRATION_POINTS") && cfg.MATHML_TEXT_INTEGRATION_POINTS && typeof cfg.MATHML_TEXT_INTEGRATION_POINTS === "object" ? clone(cfg.MATHML_TEXT_INTEGRATION_POINTS) : addToSet({}, ["mi", "mo", "mn", "ms", "mtext"]);
      HTML_INTEGRATION_POINTS = objectHasOwnProperty(cfg, "HTML_INTEGRATION_POINTS") && cfg.HTML_INTEGRATION_POINTS && typeof cfg.HTML_INTEGRATION_POINTS === "object" ? clone(cfg.HTML_INTEGRATION_POINTS) : addToSet({}, ["annotation-xml"]);
      const customElementHandling = objectHasOwnProperty(cfg, "CUSTOM_ELEMENT_HANDLING") && cfg.CUSTOM_ELEMENT_HANDLING && typeof cfg.CUSTOM_ELEMENT_HANDLING === "object" ? clone(cfg.CUSTOM_ELEMENT_HANDLING) : create(null);
      CUSTOM_ELEMENT_HANDLING = create(null);
      if (objectHasOwnProperty(customElementHandling, "tagNameCheck") && isRegexOrFunction(customElementHandling.tagNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.tagNameCheck = customElementHandling.tagNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "attributeNameCheck") && isRegexOrFunction(customElementHandling.attributeNameCheck)) {
        CUSTOM_ELEMENT_HANDLING.attributeNameCheck = customElementHandling.attributeNameCheck;
      }
      if (objectHasOwnProperty(customElementHandling, "allowCustomizedBuiltInElements") && typeof customElementHandling.allowCustomizedBuiltInElements === "boolean") {
        CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements = customElementHandling.allowCustomizedBuiltInElements;
      }
      if (SAFE_FOR_TEMPLATES) {
        ALLOW_DATA_ATTR = false;
      }
      if (RETURN_DOM_FRAGMENT) {
        RETURN_DOM = true;
      }
      if (USE_PROFILES) {
        ALLOWED_TAGS = addToSet({}, text);
        ALLOWED_ATTR = create(null);
        if (USE_PROFILES.html === true) {
          addToSet(ALLOWED_TAGS, html$1);
          addToSet(ALLOWED_ATTR, html);
        }
        if (USE_PROFILES.svg === true) {
          addToSet(ALLOWED_TAGS, svg$1);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.svgFilters === true) {
          addToSet(ALLOWED_TAGS, svgFilters);
          addToSet(ALLOWED_ATTR, svg);
          addToSet(ALLOWED_ATTR, xml);
        }
        if (USE_PROFILES.mathMl === true) {
          addToSet(ALLOWED_TAGS, mathMl$1);
          addToSet(ALLOWED_ATTR, mathMl);
          addToSet(ALLOWED_ATTR, xml);
        }
      }
      EXTRA_ELEMENT_HANDLING.tagCheck = null;
      EXTRA_ELEMENT_HANDLING.attributeCheck = null;
      if (objectHasOwnProperty(cfg, "ADD_TAGS")) {
        if (typeof cfg.ADD_TAGS === "function") {
          EXTRA_ELEMENT_HANDLING.tagCheck = cfg.ADD_TAGS;
        } else if (arrayIsArray(cfg.ADD_TAGS)) {
          if (ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
            ALLOWED_TAGS = clone(ALLOWED_TAGS);
          }
          addToSet(ALLOWED_TAGS, cfg.ADD_TAGS, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_ATTR")) {
        if (typeof cfg.ADD_ATTR === "function") {
          EXTRA_ELEMENT_HANDLING.attributeCheck = cfg.ADD_ATTR;
        } else if (arrayIsArray(cfg.ADD_ATTR)) {
          if (ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
            ALLOWED_ATTR = clone(ALLOWED_ATTR);
          }
          addToSet(ALLOWED_ATTR, cfg.ADD_ATTR, transformCaseFunc);
        }
      }
      if (objectHasOwnProperty(cfg, "ADD_URI_SAFE_ATTR") && arrayIsArray(cfg.ADD_URI_SAFE_ATTR)) {
        addToSet(URI_SAFE_ATTRIBUTES, cfg.ADD_URI_SAFE_ATTR, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "FORBID_CONTENTS") && arrayIsArray(cfg.FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.FORBID_CONTENTS, transformCaseFunc);
      }
      if (objectHasOwnProperty(cfg, "ADD_FORBID_CONTENTS") && arrayIsArray(cfg.ADD_FORBID_CONTENTS)) {
        if (FORBID_CONTENTS === DEFAULT_FORBID_CONTENTS) {
          FORBID_CONTENTS = clone(FORBID_CONTENTS);
        }
        addToSet(FORBID_CONTENTS, cfg.ADD_FORBID_CONTENTS, transformCaseFunc);
      }
      if (KEEP_CONTENT) {
        ALLOWED_TAGS["#text"] = true;
      }
      if (WHOLE_DOCUMENT) {
        addToSet(ALLOWED_TAGS, ["html", "head", "body"]);
      }
      if (ALLOWED_TAGS.table) {
        addToSet(ALLOWED_TAGS, ["tbody"]);
        delete FORBID_TAGS.tbody;
      }
      if (cfg.TRUSTED_TYPES_POLICY) {
        if (typeof cfg.TRUSTED_TYPES_POLICY.createHTML !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createHTML" hook.');
        }
        if (typeof cfg.TRUSTED_TYPES_POLICY.createScriptURL !== "function") {
          throw typeErrorCreate('TRUSTED_TYPES_POLICY configuration option must provide a "createScriptURL" hook.');
        }
        const previousTrustedTypesPolicy = trustedTypesPolicy;
        trustedTypesPolicy = cfg.TRUSTED_TYPES_POLICY;
        try {
          emptyHTML = _createTrustedHTML("");
        } catch (error) {
          trustedTypesPolicy = previousTrustedTypesPolicy;
          throw error;
        }
      } else if (cfg.TRUSTED_TYPES_POLICY === null) {
        trustedTypesPolicy = void 0;
        emptyHTML = "";
      } else {
        if (trustedTypesPolicy === void 0) {
          trustedTypesPolicy = _getDefaultTrustedTypesPolicy();
        }
        if (trustedTypesPolicy && typeof emptyHTML === "string") {
          emptyHTML = _createTrustedHTML("");
        }
      }
      if ((hooks.uponSanitizeElement.length > 0 || hooks.uponSanitizeAttribute.length > 0) && ALLOWED_TAGS === DEFAULT_ALLOWED_TAGS) {
        ALLOWED_TAGS = clone(ALLOWED_TAGS);
      }
      if (hooks.uponSanitizeAttribute.length > 0 && ALLOWED_ATTR === DEFAULT_ALLOWED_ATTR) {
        ALLOWED_ATTR = clone(ALLOWED_ATTR);
      }
      if (freeze) {
        freeze(cfg);
      }
      CONFIG = cfg;
    };
    const ALL_SVG_TAGS = addToSet({}, [...svg$1, ...svgFilters, ...svgDisallowed]);
    const ALL_MATHML_TAGS = addToSet({}, [...mathMl$1, ...mathMlDisallowed]);
    const _checkValidNamespace = function _checkValidNamespace2(element) {
      let parent = getParentNode(element);
      if (!parent || !parent.tagName) {
        parent = {
          namespaceURI: NAMESPACE,
          tagName: "template"
        };
      }
      const tagName = stringToLowerCase(element.tagName);
      const parentTagName = stringToLowerCase(parent.tagName);
      if (!ALLOWED_NAMESPACES[element.namespaceURI]) {
        return false;
      }
      if (element.namespaceURI === SVG_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "svg";
        }
        if (parent.namespaceURI === MATHML_NAMESPACE) {
          return tagName === "svg" && (parentTagName === "annotation-xml" || MATHML_TEXT_INTEGRATION_POINTS[parentTagName]);
        }
        return Boolean(ALL_SVG_TAGS[tagName]);
      }
      if (element.namespaceURI === MATHML_NAMESPACE) {
        if (parent.namespaceURI === HTML_NAMESPACE) {
          return tagName === "math";
        }
        if (parent.namespaceURI === SVG_NAMESPACE) {
          return tagName === "math" && HTML_INTEGRATION_POINTS[parentTagName];
        }
        return Boolean(ALL_MATHML_TAGS[tagName]);
      }
      if (element.namespaceURI === HTML_NAMESPACE) {
        if (parent.namespaceURI === SVG_NAMESPACE && !HTML_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        if (parent.namespaceURI === MATHML_NAMESPACE && !MATHML_TEXT_INTEGRATION_POINTS[parentTagName]) {
          return false;
        }
        return !ALL_MATHML_TAGS[tagName] && (COMMON_SVG_AND_HTML_ELEMENTS[tagName] || !ALL_SVG_TAGS[tagName]);
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && ALLOWED_NAMESPACES[element.namespaceURI]) {
        return true;
      }
      return false;
    };
    const _forceRemove = function _forceRemove2(node) {
      arrayPush(DOMPurify.removed, {
        element: node
      });
      try {
        getParentNode(node).removeChild(node);
      } catch (_) {
        remove(node);
        if (!getParentNode(node)) {
          throw typeErrorCreate("a node selected for removal could not be detached from its tree and cannot be safely returned; refusing to sanitize in place");
        }
      }
    };
    const _neutralizeRoot = function _neutralizeRoot2(root) {
      const childNodes = getChildNodes ? getChildNodes(root) : root.childNodes;
      if (childNodes) {
        const snapshot = [];
        arrayForEach(childNodes, (child) => {
          arrayPush(snapshot, child);
        });
        arrayForEach(snapshot, (child) => {
          try {
            remove(child);
          } catch (_) {
          }
        });
      }
      const attributes = getAttributes ? getAttributes(root) : null;
      if (attributes) {
        for (let i = attributes.length - 1; i >= 0; --i) {
          const attribute = attributes[i];
          const name = attribute && attribute.name;
          if (typeof name === "string") {
            try {
              root.removeAttribute(name);
            } catch (_) {
            }
          }
        }
      }
    };
    const _removeAttribute = function _removeAttribute2(name, element) {
      try {
        arrayPush(DOMPurify.removed, {
          attribute: element.getAttributeNode(name),
          from: element
        });
      } catch (_) {
        arrayPush(DOMPurify.removed, {
          attribute: null,
          from: element
        });
      }
      element.removeAttribute(name);
      if (name === "is") {
        if (RETURN_DOM || RETURN_DOM_FRAGMENT) {
          try {
            _forceRemove(element);
          } catch (_) {
          }
        } else {
          try {
            element.setAttribute(name, "");
          } catch (_) {
          }
        }
      }
    };
    const _stripDisallowedAttributes = function _stripDisallowedAttributes2(element) {
      const attributes = getAttributes ? getAttributes(element) : element.attributes;
      if (!attributes) {
        return;
      }
      for (let i = attributes.length - 1; i >= 0; --i) {
        const attribute = attributes[i];
        const name = attribute && attribute.name;
        if (typeof name !== "string" || ALLOWED_ATTR[transformCaseFunc(name)]) {
          continue;
        }
        try {
          element.removeAttribute(name);
        } catch (_) {
        }
      }
    };
    const _neutralizeSubtree = function _neutralizeSubtree2(root) {
      const stack = [root];
      while (stack.length > 0) {
        const node = stack.pop();
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        if (nodeType === NODE_TYPE.element) {
          _stripDisallowedAttributes(node);
        }
        const childNodes = getChildNodes ? getChildNodes(node) : node.childNodes;
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push(childNodes[i]);
          }
        }
      }
    };
    const _initDocument = function _initDocument2(dirty) {
      let doc = null;
      let leadingWhitespace = null;
      if (FORCE_BODY) {
        dirty = "<remove></remove>" + dirty;
      } else {
        const matches = stringMatch(dirty, /^[\r\n\t ]+/);
        leadingWhitespace = matches && matches[0];
      }
      if (PARSER_MEDIA_TYPE === "application/xhtml+xml" && NAMESPACE === HTML_NAMESPACE) {
        dirty = '<html xmlns="http://www.w3.org/1999/xhtml"><head></head><body>' + dirty + "</body></html>";
      }
      const dirtyPayload = trustedTypesPolicy ? _createTrustedHTML(dirty) : dirty;
      if (NAMESPACE === HTML_NAMESPACE) {
        try {
          doc = new DOMParser().parseFromString(dirtyPayload, PARSER_MEDIA_TYPE);
        } catch (_) {
        }
      }
      if (!doc || !doc.documentElement) {
        doc = implementation.createDocument(NAMESPACE, "template", null);
        try {
          doc.documentElement.innerHTML = IS_EMPTY_INPUT ? emptyHTML : dirtyPayload;
        } catch (_) {
        }
      }
      const body = doc.body || doc.documentElement;
      if (dirty && leadingWhitespace) {
        body.insertBefore(document2.createTextNode(leadingWhitespace), body.childNodes[0] || null);
      }
      if (NAMESPACE === HTML_NAMESPACE) {
        return getElementsByTagName.call(doc, WHOLE_DOCUMENT ? "html" : "body")[0];
      }
      return WHOLE_DOCUMENT ? doc.documentElement : body;
    };
    const _createNodeIterator = function _createNodeIterator2(root) {
      return createNodeIterator.call(
        root.ownerDocument || root,
        root,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_ELEMENT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_TEXT | NodeFilter.SHOW_PROCESSING_INSTRUCTION | NodeFilter.SHOW_CDATA_SECTION,
        null
      );
    };
    const _scrubTemplateExpressions2 = function _scrubTemplateExpressions(node) {
      var _node$querySelectorAl, _node$querySelectorAl2;
      node.normalize();
      const walker = createNodeIterator.call(
        node.ownerDocument || node,
        node,
        // eslint-disable-next-line no-bitwise
        NodeFilter.SHOW_TEXT | NodeFilter.SHOW_COMMENT | NodeFilter.SHOW_CDATA_SECTION | NodeFilter.SHOW_PROCESSING_INSTRUCTION,
        null
      );
      let currentNode = walker.nextNode();
      while (currentNode) {
        let data = currentNode.data;
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          data = stringReplace(data, expr, " ");
        });
        currentNode.data = data;
        currentNode = walker.nextNode();
      }
      const templates = (_node$querySelectorAl = (_node$querySelectorAl2 = node.querySelectorAll) === null || _node$querySelectorAl2 === void 0 ? void 0 : _node$querySelectorAl2.call(node, "template")) !== null && _node$querySelectorAl !== void 0 ? _node$querySelectorAl : [];
      arrayForEach(Array.from(templates), (tmpl) => {
        if (_isDocumentFragment(tmpl.content)) {
          _scrubTemplateExpressions2(tmpl.content);
        }
      });
    };
    const _isClobbered = function _isClobbered2(element) {
      const realTagName = getNodeName ? getNodeName(element) : null;
      if (typeof realTagName !== "string") {
        return false;
      }
      if (transformCaseFunc(realTagName) !== "form") {
        return false;
      }
      return typeof element.nodeName !== "string" || typeof element.textContent !== "string" || typeof element.removeChild !== "function" || // Realm-safe NamedNodeMap detection: equality against the cached
      // prototype getter. Clobbered .attributes (e.g. <input name="attributes">)
      // makes the direct read diverge from the cached read; a clean form
      // (same-realm OR foreign-realm) has both reads pointing at the same
      // canonical NamedNodeMap.
      element.attributes !== getAttributes(element) || typeof element.removeAttribute !== "function" || typeof element.setAttribute !== "function" || typeof element.namespaceURI !== "string" || typeof element.insertBefore !== "function" || typeof element.hasChildNodes !== "function" || // NodeType clobbering probe. Cached Node.prototype.nodeType getter
      // returns the integer 1 for any Element regardless of realm; direct
      // read on a clobbered form (e.g. <input name="nodeType">) returns
      // the named child element. Cheap addition — nodeType is read from
      // an internal slot, no serialization cost — and removes a residual
      // clobbering surface used by several mXSS / PI / comment branches
      // in _sanitizeElements that compare currentNode.nodeType directly.
      element.nodeType !== getNodeType(element) || // HTMLFormElement has [LegacyOverrideBuiltIns]: a descendant named
      // "childNodes" shadows the prototype getter. Direct reads of
      // form.childNodes from a clobbered form return the named child
      // instead of the real NodeList, so any walk that reads it directly
      // skips the form's real children. Compare the direct read to the
      // cached Node.prototype getter — when the form's named-property
      // getter intercepts the read, the two values differ and we flag
      // the form. This catches every clobbering child type (input,
      // select, etc.) regardless of whether the named child happens to
      // carry a numeric .length, which a typeof-based probe would miss
      // (e.g. HTMLSelectElement.length is a defined unsigned-long).
      element.childNodes !== getChildNodes(element);
    };
    const _isDocumentFragment = function _isDocumentFragment2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return getNodeType(value) === NODE_TYPE.documentFragment;
      } catch (_) {
        return false;
      }
    };
    const _isNode = function _isNode2(value) {
      if (!getNodeType || typeof value !== "object" || value === null) {
        return false;
      }
      try {
        return typeof getNodeType(value) === "number";
      } catch (_) {
        return false;
      }
    };
    function _executeHooks(hooks2, currentNode, data) {
      arrayForEach(hooks2, (hook) => {
        hook.call(DOMPurify, currentNode, data, CONFIG);
      });
    }
    const _sanitizeElements = function _sanitizeElements2(currentNode) {
      let content = null;
      _executeHooks(hooks.beforeSanitizeElements, currentNode, null);
      if (_isClobbered(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      const tagName = transformCaseFunc(getNodeName ? getNodeName(currentNode) : currentNode.nodeName);
      _executeHooks(hooks.uponSanitizeElement, currentNode, {
        tagName,
        allowedTags: ALLOWED_TAGS
      });
      if (SAFE_FOR_XML && currentNode.hasChildNodes() && !_isNode(currentNode.firstElementChild) && regExpTest(/<[/\w!]/g, currentNode.innerHTML) && regExpTest(/<[/\w!]/g, currentNode.textContent)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.namespaceURI === HTML_NAMESPACE && tagName === "style" && _isNode(currentNode.firstElementChild)) {
        _forceRemove(currentNode);
        return true;
      }
      if (currentNode.nodeType === NODE_TYPE.progressingInstruction) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_XML && currentNode.nodeType === NODE_TYPE.comment && regExpTest(/<[/\w]/g, currentNode.data)) {
        _forceRemove(currentNode);
        return true;
      }
      if (FORBID_TAGS[tagName] || !(EXTRA_ELEMENT_HANDLING.tagCheck instanceof Function && EXTRA_ELEMENT_HANDLING.tagCheck(tagName)) && !ALLOWED_TAGS[tagName]) {
        if (!FORBID_TAGS[tagName] && _isBasicCustomElement(tagName)) {
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, tagName)) {
            return false;
          }
          if (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(tagName)) {
            return false;
          }
        }
        if (KEEP_CONTENT && !FORBID_CONTENTS[tagName]) {
          const parentNode = getParentNode(currentNode);
          const childNodes = getChildNodes(currentNode);
          if (childNodes && parentNode) {
            const childCount = childNodes.length;
            for (let i = childCount - 1; i >= 0; --i) {
              const hoisted = IN_PLACE ? childNodes[i] : cloneNode(childNodes[i], true);
              parentNode.insertBefore(hoisted, getNextSibling(currentNode));
            }
          }
        }
        _forceRemove(currentNode);
        return true;
      }
      const nt = getNodeType ? getNodeType(currentNode) : currentNode.nodeType;
      if (nt === NODE_TYPE.element && !_checkValidNamespace(currentNode)) {
        _forceRemove(currentNode);
        return true;
      }
      if ((tagName === "noscript" || tagName === "noembed" || tagName === "noframes") && regExpTest(/<\/no(script|embed|frames)/i, currentNode.innerHTML)) {
        _forceRemove(currentNode);
        return true;
      }
      if (SAFE_FOR_TEMPLATES && currentNode.nodeType === NODE_TYPE.text) {
        content = currentNode.textContent;
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          content = stringReplace(content, expr, " ");
        });
        if (currentNode.textContent !== content) {
          arrayPush(DOMPurify.removed, {
            element: currentNode.cloneNode()
          });
          currentNode.textContent = content;
        }
      }
      _executeHooks(hooks.afterSanitizeElements, currentNode, null);
      return false;
    };
    const _isValidAttribute = function _isValidAttribute2(lcTag, lcName, value) {
      if (FORBID_ATTR[lcName]) {
        return false;
      }
      if (SANITIZE_DOM && (lcName === "id" || lcName === "name") && (value in document2 || value in formElement)) {
        return false;
      }
      const nameIsPermitted = ALLOWED_ATTR[lcName] || EXTRA_ELEMENT_HANDLING.attributeCheck instanceof Function && EXTRA_ELEMENT_HANDLING.attributeCheck(lcName, lcTag);
      if (ALLOW_DATA_ATTR && !FORBID_ATTR[lcName] && regExpTest(DATA_ATTR$1, lcName)) ;
      else if (ALLOW_ARIA_ATTR && regExpTest(ARIA_ATTR$1, lcName)) ;
      else if (!nameIsPermitted || FORBID_ATTR[lcName]) {
        if (
          // First condition does a very basic check if a) it's basically a valid custom element tagname AND
          // b) if the tagName passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          // and c) if the attribute name passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.attributeNameCheck
          _isBasicCustomElement(lcTag) && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, lcTag) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(lcTag)) && (CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.attributeNameCheck, lcName) || CUSTOM_ELEMENT_HANDLING.attributeNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.attributeNameCheck(lcName, lcTag)) || // Alternative, second condition checks if it's an `is`-attribute, AND
          // the value passes whatever the user has configured for CUSTOM_ELEMENT_HANDLING.tagNameCheck
          lcName === "is" && CUSTOM_ELEMENT_HANDLING.allowCustomizedBuiltInElements && (CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof RegExp && regExpTest(CUSTOM_ELEMENT_HANDLING.tagNameCheck, value) || CUSTOM_ELEMENT_HANDLING.tagNameCheck instanceof Function && CUSTOM_ELEMENT_HANDLING.tagNameCheck(value))
        ) ;
        else {
          return false;
        }
      } else if (URI_SAFE_ATTRIBUTES[lcName]) ;
      else if (regExpTest(IS_ALLOWED_URI$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if ((lcName === "src" || lcName === "xlink:href" || lcName === "href") && lcTag !== "script" && stringIndexOf(value, "data:") === 0 && DATA_URI_TAGS[lcTag]) ;
      else if (ALLOW_UNKNOWN_PROTOCOLS && !regExpTest(IS_SCRIPT_OR_DATA$1, stringReplace(value, ATTR_WHITESPACE$1, ""))) ;
      else if (value) {
        return false;
      } else ;
      return true;
    };
    const RESERVED_CUSTOM_ELEMENT_NAMES = addToSet({}, ["annotation-xml", "color-profile", "font-face", "font-face-format", "font-face-name", "font-face-src", "font-face-uri", "missing-glyph"]);
    const _isBasicCustomElement = function _isBasicCustomElement2(tagName) {
      return !RESERVED_CUSTOM_ELEMENT_NAMES[stringToLowerCase(tagName)] && regExpTest(CUSTOM_ELEMENT$1, tagName);
    };
    const _sanitizeAttributes = function _sanitizeAttributes2(currentNode) {
      _executeHooks(hooks.beforeSanitizeAttributes, currentNode, null);
      const attributes = currentNode.attributes;
      if (!attributes || _isClobbered(currentNode)) {
        return;
      }
      const hookEvent = {
        attrName: "",
        attrValue: "",
        keepAttr: true,
        allowedAttributes: ALLOWED_ATTR,
        forceKeepAttr: void 0
      };
      let l = attributes.length;
      while (l--) {
        const attr = attributes[l];
        const name = attr.name, namespaceURI = attr.namespaceURI, attrValue = attr.value;
        const lcName = transformCaseFunc(name);
        const initValue = attrValue;
        let value = name === "value" ? initValue : stringTrim(initValue);
        hookEvent.attrName = lcName;
        hookEvent.attrValue = value;
        hookEvent.keepAttr = true;
        hookEvent.forceKeepAttr = void 0;
        _executeHooks(hooks.uponSanitizeAttribute, currentNode, hookEvent);
        value = hookEvent.attrValue;
        if (SANITIZE_NAMED_PROPS && (lcName === "id" || lcName === "name") && stringIndexOf(value, SANITIZE_NAMED_PROPS_PREFIX) !== 0) {
          _removeAttribute(name, currentNode);
          value = SANITIZE_NAMED_PROPS_PREFIX + value;
        }
        if (SAFE_FOR_XML && regExpTest(/((--!?|])>)|<\/(style|script|title|xmp|textarea|noscript|iframe|noembed|noframes)/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (lcName === "attributename" && stringMatch(value, "href")) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (hookEvent.forceKeepAttr) {
          continue;
        }
        if (!hookEvent.keepAttr) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (!ALLOW_SELF_CLOSE_IN_ATTR && regExpTest(/\/>/i, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (SAFE_FOR_TEMPLATES) {
          arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
            value = stringReplace(value, expr, " ");
          });
        }
        const lcTag = transformCaseFunc(currentNode.nodeName);
        if (!_isValidAttribute(lcTag, lcName, value)) {
          _removeAttribute(name, currentNode);
          continue;
        }
        if (trustedTypesPolicy && typeof trustedTypes === "object" && typeof trustedTypes.getAttributeType === "function") {
          if (namespaceURI) ;
          else {
            switch (trustedTypes.getAttributeType(lcTag, lcName)) {
              case "TrustedHTML": {
                value = _createTrustedHTML(value);
                break;
              }
              case "TrustedScriptURL": {
                value = _createTrustedScriptURL(value);
                break;
              }
            }
          }
        }
        if (value !== initValue) {
          try {
            if (namespaceURI) {
              currentNode.setAttributeNS(namespaceURI, name, value);
            } else {
              currentNode.setAttribute(name, value);
            }
            if (_isClobbered(currentNode)) {
              _forceRemove(currentNode);
            } else {
              arrayPop(DOMPurify.removed);
            }
          } catch (_) {
            _removeAttribute(name, currentNode);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeAttributes, currentNode, null);
    };
    const _sanitizeShadowDOM2 = function _sanitizeShadowDOM(fragment) {
      let shadowNode = null;
      const shadowIterator = _createNodeIterator(fragment);
      _executeHooks(hooks.beforeSanitizeShadowDOM, fragment, null);
      while (shadowNode = shadowIterator.nextNode()) {
        _executeHooks(hooks.uponSanitizeShadowNode, shadowNode, null);
        _sanitizeElements(shadowNode);
        _sanitizeAttributes(shadowNode);
        if (_isDocumentFragment(shadowNode.content)) {
          _sanitizeShadowDOM2(shadowNode.content);
        }
        const shadowNodeType = getNodeType ? getNodeType(shadowNode) : shadowNode.nodeType;
        if (shadowNodeType === NODE_TYPE.element) {
          const innerSr = getShadowRoot ? getShadowRoot(shadowNode) : shadowNode.shadowRoot;
          if (_isDocumentFragment(innerSr)) {
            _sanitizeAttachedShadowRoots(innerSr);
            _sanitizeShadowDOM2(innerSr);
          }
        }
      }
      _executeHooks(hooks.afterSanitizeShadowDOM, fragment, null);
    };
    const _sanitizeAttachedShadowRoots = function _sanitizeAttachedShadowRoots2(root) {
      const stack = [{
        node: root,
        shadow: null
      }];
      while (stack.length > 0) {
        const item = stack.pop();
        if (item.shadow) {
          _sanitizeShadowDOM2(item.shadow);
          continue;
        }
        const node = item.node;
        const nodeType = getNodeType ? getNodeType(node) : node.nodeType;
        const isElement = nodeType === NODE_TYPE.element;
        const childNodes = getChildNodes ? getChildNodes(node) : node.childNodes;
        if (childNodes) {
          for (let i = childNodes.length - 1; i >= 0; --i) {
            stack.push({
              node: childNodes[i],
              shadow: null
            });
          }
        }
        if (isElement) {
          const rootName = getNodeName ? getNodeName(node) : null;
          if (typeof rootName === "string" && transformCaseFunc(rootName) === "template") {
            const content = node.content;
            if (_isDocumentFragment(content)) {
              stack.push({
                node: content,
                shadow: null
              });
            }
          }
        }
        if (isElement) {
          const sr = getShadowRoot ? getShadowRoot(node) : node.shadowRoot;
          if (_isDocumentFragment(sr)) {
            stack.push({
              node: null,
              shadow: sr
            }, {
              node: sr,
              shadow: null
            });
          }
        }
      }
    };
    DOMPurify.sanitize = function(dirty) {
      let cfg = arguments.length > 1 && arguments[1] !== void 0 ? arguments[1] : {};
      let body = null;
      let importedNode = null;
      let currentNode = null;
      let returnNode = null;
      IS_EMPTY_INPUT = !dirty;
      if (IS_EMPTY_INPUT) {
        dirty = "<!-->";
      }
      if (typeof dirty !== "string" && !_isNode(dirty)) {
        dirty = stringifyValue(dirty);
        if (typeof dirty !== "string") {
          throw typeErrorCreate("dirty is not a string, aborting");
        }
      }
      if (!DOMPurify.isSupported) {
        return dirty;
      }
      if (!SET_CONFIG) {
        _parseConfig(cfg);
      }
      DOMPurify.removed = [];
      const inPlace = IN_PLACE && typeof dirty !== "string" && _isNode(dirty);
      if (inPlace) {
        const nn = getNodeName ? getNodeName(dirty) : dirty.nodeName;
        if (typeof nn === "string") {
          const tagName = transformCaseFunc(nn);
          if (!ALLOWED_TAGS[tagName] || FORBID_TAGS[tagName]) {
            throw typeErrorCreate("root node is forbidden and cannot be sanitized in-place");
          }
        }
        if (_isClobbered(dirty)) {
          throw typeErrorCreate("root node is clobbered and cannot be sanitized in-place");
        }
        try {
          _sanitizeAttachedShadowRoots(dirty);
        } catch (error) {
          _neutralizeRoot(dirty);
          throw error;
        }
      } else if (_isNode(dirty)) {
        body = _initDocument("<!---->");
        importedNode = body.ownerDocument.importNode(dirty, true);
        if (importedNode.nodeType === NODE_TYPE.element && importedNode.nodeName === "BODY") {
          body = importedNode;
        } else if (importedNode.nodeName === "HTML") {
          body = importedNode;
        } else {
          body.appendChild(importedNode);
        }
        _sanitizeAttachedShadowRoots(importedNode);
      } else {
        if (!RETURN_DOM && !SAFE_FOR_TEMPLATES && !WHOLE_DOCUMENT && // eslint-disable-next-line unicorn/prefer-includes
        dirty.indexOf("<") === -1) {
          return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(dirty) : dirty;
        }
        body = _initDocument(dirty);
        if (!body) {
          return RETURN_DOM ? null : RETURN_TRUSTED_TYPE ? emptyHTML : "";
        }
      }
      if (body && FORCE_BODY) {
        _forceRemove(body.firstChild);
      }
      const nodeIterator = _createNodeIterator(inPlace ? dirty : body);
      try {
        while (currentNode = nodeIterator.nextNode()) {
          _sanitizeElements(currentNode);
          _sanitizeAttributes(currentNode);
          if (_isDocumentFragment(currentNode.content)) {
            _sanitizeShadowDOM2(currentNode.content);
          }
        }
      } catch (error) {
        if (inPlace) {
          _neutralizeRoot(dirty);
        }
        throw error;
      }
      if (inPlace) {
        arrayForEach(DOMPurify.removed, (entry) => {
          if (entry.element) {
            _neutralizeSubtree(entry.element);
          }
        });
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions2(dirty);
        }
        return dirty;
      }
      if (RETURN_DOM) {
        if (SAFE_FOR_TEMPLATES) {
          _scrubTemplateExpressions2(body);
        }
        if (RETURN_DOM_FRAGMENT) {
          returnNode = createDocumentFragment.call(body.ownerDocument);
          while (body.firstChild) {
            returnNode.appendChild(body.firstChild);
          }
        } else {
          returnNode = body;
        }
        if (ALLOWED_ATTR.shadowroot || ALLOWED_ATTR.shadowrootmode) {
          returnNode = importNode.call(originalDocument, returnNode, true);
        }
        return returnNode;
      }
      let serializedHTML = WHOLE_DOCUMENT ? body.outerHTML : body.innerHTML;
      if (WHOLE_DOCUMENT && ALLOWED_TAGS["!doctype"] && body.ownerDocument && body.ownerDocument.doctype && body.ownerDocument.doctype.name && regExpTest(DOCTYPE_NAME, body.ownerDocument.doctype.name)) {
        serializedHTML = "<!DOCTYPE " + body.ownerDocument.doctype.name + ">\n" + serializedHTML;
      }
      if (SAFE_FOR_TEMPLATES) {
        arrayForEach([MUSTACHE_EXPR$1, ERB_EXPR$1, TMPLIT_EXPR$1], (expr) => {
          serializedHTML = stringReplace(serializedHTML, expr, " ");
        });
      }
      return trustedTypesPolicy && RETURN_TRUSTED_TYPE ? _createTrustedHTML(serializedHTML) : serializedHTML;
    };
    DOMPurify.setConfig = function() {
      let cfg = arguments.length > 0 && arguments[0] !== void 0 ? arguments[0] : {};
      _parseConfig(cfg);
      SET_CONFIG = true;
    };
    DOMPurify.clearConfig = function() {
      CONFIG = null;
      SET_CONFIG = false;
      trustedTypesPolicy = defaultTrustedTypesPolicy;
      emptyHTML = "";
    };
    DOMPurify.isValidAttribute = function(tag, attr, value) {
      if (!CONFIG) {
        _parseConfig({});
      }
      const lcTag = transformCaseFunc(tag);
      const lcName = transformCaseFunc(attr);
      return _isValidAttribute(lcTag, lcName, value);
    };
    DOMPurify.addHook = function(entryPoint, hookFunction) {
      if (typeof hookFunction !== "function") {
        return;
      }
      arrayPush(hooks[entryPoint], hookFunction);
    };
    DOMPurify.removeHook = function(entryPoint, hookFunction) {
      if (hookFunction !== void 0) {
        const index = arrayLastIndexOf(hooks[entryPoint], hookFunction);
        return index === -1 ? void 0 : arraySplice(hooks[entryPoint], index, 1)[0];
      }
      return arrayPop(hooks[entryPoint]);
    };
    DOMPurify.removeHooks = function(entryPoint) {
      hooks[entryPoint] = [];
    };
    DOMPurify.removeAllHooks = function() {
      hooks = _createHooksMap();
    };
    return DOMPurify;
  }
  var purify = createDOMPurify();

  // src/utils/SecurityUtils.ts
  var SecurityUtils = class {
    /**
     * Bereinigt HTML mit DOMPurify für sichere innerHTML-Zuweisungen.
     * Erlaubt grundlegende Formatierung (b, i, u, strong, em, a, br, p, span)
     * aber blockiert alle Scripts, Event-Handler und gefährlichen URLs.
     */
    static sanitizeHTML(html2) {
      if (!html2) return "";
      return purify.sanitize(html2, {
        ALLOWED_TAGS: ["b", "i", "u", "strong", "em", "a", "br", "p", "span", "div", "h1", "h2", "h3", "h4", "h5", "h6", "ul", "ol", "li", "blockquote", "code", "pre"],
        ALLOWED_ATTR: ["href", "target", "title", "class", "style", "data-*"],
        ALLOW_DATA_ATTR: true,
        SANITIZE_DOM: true,
        // Links nur mit http/https/ftp/mailto - kein javascript:
        ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i
      });
    }
    /**
     * Escaped HTML special characters so strings can be safely inserted into DOM via innerHTML (e.g. tooltips)
     */
    static escapeHtml(str) {
      if (!str) return "";
      const map = {
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;"
      };
      return String(str).replace(/[&<>"']/g, (m) => map[m]);
    }
    /**
     * Checks if a CSS color value is reasonably safe to use.
     */
    static isValidCssColor(color) {
      if (!color) return false;
      const colorTrimmed = color.trim();
      return /^#[0-9a-fA-F]{3,8}$/.test(colorTrimmed) || /^(rgb|hsl)a?\([^)]+\)$/.test(colorTrimmed) || /^[a-zA-Z]+$/.test(colorTrimmed);
    }
    /**
     * Guard for ExpressionParser to prevent Arbitrary Code Execution (ACE)
     */
    static sanitizeExpression(expr) {
      if (!expr) return true;
      const blocked = /\b(fetch|XMLHttpRequest|eval|Function|import|require|window|document|localStorage|sessionStorage|electronFS|alert|confirm|prompt|process|global|globalThis)\b/i;
      return !blocked.test(expr);
    }
  };

  // src/utils/RuntimeVersion.ts
  init_define_import_meta_env();
  var RUNTIME_VERSION = "1.5.0";

  // src/multiplayer/index.ts
  init_define_import_meta_env();

  // src/multiplayer/NetworkManager.ts
  init_define_import_meta_env();
  init_Logger();

  // src/utils/ServerUrl.ts
  init_define_import_meta_env();
  var DEV_SERVER_PORT = "5173";
  var GAME_SERVER_PORT = "8080";
  var GAME_WS_PATH = "/ws/game";
  function loc() {
    return typeof window !== "undefined" ? window.location : null;
  }
  function gameServerBase() {
    const l = loc();
    if (!l) return "";
    if (l.port === DEV_SERVER_PORT) return `${l.protocol}//${l.hostname}:${GAME_SERVER_PORT}`;
    return l.origin;
  }
  function gameServerHttp(path) {
    return gameServerBase() + path;
  }
  function gameServerWs(path = GAME_WS_PATH) {
    const l = loc();
    if (!l) return path;
    const protocol = l.protocol === "https:" ? "wss:" : "ws:";
    const host = l.port === DEV_SERVER_PORT ? `${l.hostname}:${GAME_SERVER_PORT}` : l.host;
    return `${protocol}//${host}${path}`;
  }

  // src/multiplayer/NetworkManager.ts
  var logger = Logger.get("NetworkManager");
  var NetworkManager = class {
    ws = null;
    serverUrl;
    eventHandlers = /* @__PURE__ */ new Set();
    state = "disconnected";
    roomCode = null;
    playerNumber = null;
    constructor(serverUrl = "") {
      this.serverUrl = serverUrl;
    }
    /** Effektive WebSocket-URL — leer/alter Localhost-Default → same-origin. */
    resolvedUrl() {
      return this.serverUrl && this.serverUrl !== "ws://localhost:8080" ? this.serverUrl : gameServerWs();
    }
    /**
     * Get the HTTP base URL based on the WebSocket URL
     */
    getHttpUrl() {
      return this.serverUrl && this.serverUrl !== "ws://localhost:8080" ? this.serverUrl.replace("ws://", "http://").replace("wss://", "https://") : gameServerHttp("");
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
        this.ws = new WebSocket(this.resolvedUrl());
        this.ws.onopen = () => {
          this.state = "connected";
          logger.info("[Network] Connected to server");
          resolve();
        };
        this.ws.onerror = (error) => {
          logger.error("[Network] Connection error:", error);
          this.state = "disconnected";
          reject(error);
        };
        this.ws.onclose = () => {
          logger.info("[Network] Disconnected from server");
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
     * Send trigger_task for triggerMode: broadcast
     */
    sendTriggerTask(taskName, params) {
      this.send({ type: "trigger_task", taskName, params });
    }
    /**
     * Send sync_task for triggerMode: local-sync
     */
    sendSyncTask(taskName, params) {
      this.send({ type: "sync_task", taskName, params });
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
          logger.info(`[Network] SENT: ${message.type}`, message);
        }
      } else if (isSyncMessage) {
      } else {
        logger.warn("[Network] Cannot send message - not connected", this.ws?.readyState);
      }
    }
    /**
     * Handle incoming server message
     */
    handleMessage(data) {
      try {
        const message = JSON.parse(data);
        if (message.type === "remote_state") {
          logger.info(`[Network] RECV remote_state for ${message.objectId} from P${message.player}`, message);
        } else if (message.type !== "remote_input") {
          logger.info(`[Network] RECV: ${message.type}`, message);
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
            logger.error("[Network] Server error:", message.message);
            break;
        }
        this.eventHandlers.forEach((handler) => handler(message));
      } catch (error) {
        logger.error("[Network] Failed to parse message:", error);
      }
    }
  };
  var network = new NetworkManager();

  // src/multiplayer/MultiplayerLobby.ts
  init_define_import_meta_env();

  // src/components/TPanel.ts
  init_define_import_meta_env();

  // src/components/TWindow.ts
  init_define_import_meta_env();

  // src/components/TComponent.ts
  init_define_import_meta_env();
  var DESIGN_VALUES = /* @__PURE__ */ Symbol("DESIGN_VALUES");
  var GROUP_ICONS = {
    "IDENTIT\xC4T": "\u{1F3F7}\uFE0F",
    "GEOMETRIE": "\u{1F4D0}",
    "DARSTELLUNG": "\u{1F3A8}",
    "STIL": "\u{1F3A8}",
    "INHALT": "\u{1F4DD}",
    "TYPOGRAFIE": "\u{1F524}",
    "ICON": "\u{1F5BC}\uFE0F",
    "INTERAKTION": "\u{1F5B1}\uFE0F",
    "KONFIGURATION": "\u2699\uFE0F",
    "DATEN": "\u{1F4CA}",
    "ANIMATION": "\u{1F3AC}",
    "NETZWERK": "\u{1F310}",
    "SICHERHEIT": "\u{1F512}",
    // DataAction SQL-Gruppen
    "FROM / DATENQUELLE": "\u{1F4E6}",
    "SELECT / FELDER": "\u{1F50D}",
    "INTO / ERGEBNIS": "\u{1F4BE}",
    "WHERE / FILTER": "\u{1F50E}",
    "HTTP / REQUEST": "\u2699\uFE0F",
    "SERVER / BETRIEB": "\u{1F5A5}\uFE0F",
    "SERVER / REQUEST": "\u{1F4E5}",
    "SERVER / PR\xDCFUNG": "\u2705",
    "SERVER / SICHERHEIT": "\u{1F512}",
    "SERVER / RESPONSE": "\u{1F4E4}",
    "SERVER / R\xDCCKMELDUNG": "\u{1F4AC}",
    "SERVER / DIAGNOSE": "\u{1F50E}"
  };
  var TComponent = class {
    id;
    name;
    className;
    // Explicit className for production builds
    parent = null;
    children = [];
    events;
    // EventName -> TaskName
    scope = "stage";
    // Visibility scope
    isVariable = false;
    // Flag for variable-like components
    isTransient = false;
    // If true, this component is not persisted in project files
    // Visibility & Scoping Meta-Flags
    isService = false;
    // If true, component is merged globally across stages
    isHiddenInRun = false;
    // If true, component is hidden in run mode
    isManagedInSidepanel = false;
    // If true, component is managed in the editor sidepanel
    // Drag & Drop Properties
    draggable = false;
    dragMode = "move";
    droppable = false;
    constructor(name) {
      this.id = `obj_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
      this.name = name;
      this.className = this.constructor.name;
      this.events = {};
    }
    getBaseProperties() {
      return [
        { name: "name", label: "Name", type: "string", group: "IDENTIT\xC4T" },
        { name: "draggable", label: "Draggable", type: "boolean", group: "INTERAKTION", visualOnly: true, editorOnly: true, inline: true },
        { name: "droppable", label: "Droppable", type: "boolean", group: "INTERAKTION", visualOnly: true, editorOnly: true, inline: true },
        { name: "dragMode", label: "Drag Mode", type: "select", group: "INTERAKTION", visualOnly: true, options: ["move", "copy"], editorOnly: true }
      ];
    }
    // =========================================================================
    // IInspectable: Component-Owned Inspector
    // =========================================================================
    /** Ressourcen/Services ohne eigene Laufzeitdarstellung brauchen keine visuellen Basisfelder. */
    get hasVisualInspector() {
      return !this.isHiddenInRun;
    }
    /**
     * Auto-Konvertierung: Gruppiert getInspectorProperties() nach 'group'
     * und erzeugt daraus InspectorSection[].
     * 
     * Unterklassen können diese Methode überschreiben um eigene Sektionen zu definieren.
     */
    getInspectorSections() {
      const props = this.getInspectorProperties();
      const groupMap = /* @__PURE__ */ new Map();
      const groupOrder = [];
      for (const prop of props) {
        const group = prop.group || "ALLGEMEIN";
        if (!this.hasVisualInspector && prop.visualOnly) continue;
        if (!groupMap.has(group)) {
          groupMap.set(group, []);
          groupOrder.push(group);
        }
        groupMap.get(group).push(prop);
      }
      return groupOrder.map((groupName) => ({
        id: groupName.toLowerCase().replace(/[^a-z0-9]/g, "_"),
        label: groupName,
        icon: GROUP_ICONS[groupName] || "\u{1F4CB}",
        collapsed: false,
        properties: groupMap.get(groupName)
      }));
    }
    /**
     * Property-Änderung anwenden.
     * Wird vom InspectorHost aufgerufen um zu prüfen ob ein Re-Render nötig ist.
     * Die eigentliche Persistierung läuft über eventHandler.handleControlChange().
     * 
     * @returns true wenn ein vollständiger Inspector-Re-Render nötig ist
     */
    applyChange(propertyName, _newValue, _oldValue) {
      if (propertyName === "name") return true;
      if (propertyName === "scope") return true;
      return false;
    }
    /**
     * Liefert die Liste aller unterstützten Events für diese Komponente.
     */
    getEvents() {
      return ["onClick", "onDoubleClick", "onMouseEnter", "onMouseLeave", "onDragStart", "onDragEnd", "onDrop", "onTouchStart", "onTouchMove", "onTouchEnd", "onFlipMidpoint"];
    }
    /**
     * Events-Tab: Exportiert die Event-Bindings für den Inspector.
     */
    getInspectorEvents() {
      if (!this.events) return [];
      const standardEvents = this.getEvents();
      return standardEvents.map((eventName) => ({
        name: eventName,
        label: eventName.replace(/^on/, ""),
        mappedTask: this.events?.[eventName] || void 0
      }));
    }
    // =========================================================================
    // Serialization
    // =========================================================================
    /**
     * Konvertiert die Komponente in ein reines Daten-Objekt (DTO) ohne
     * Zirkelreferenzen, Methoden oder Runtime-Properties.
     * 
     * Nutzt die Inspector-Metadaten (getInspectorProperties) um nur
     * serialisierbare Properties zu extrahieren. Bevorzugt DESIGN_VALUES
     * (Formeln) gegenüber aktuellen Runtime-Werten.
     * 
     * @since v3.22.0 (CleanCode Phase 2, Slice 2.5)
     */
    toDTO() {
      const dto = {
        className: this.className || this.constructor.name,
        id: this.id,
        name: this.name,
        scope: this.scope,
        isVariable: this.isVariable || void 0,
        isService: this.isService || void 0,
        isHiddenInRun: this.isHiddenInRun || void 0,
        isManagedInSidepanel: this.isManagedInSidepanel || void 0,
        isTransient: this.isTransient || void 0,
        draggable: this.draggable || void 0,
        droppable: this.droppable || void 0,
        dragMode: this.dragMode !== "move" ? this.dragMode : void 0
      };
      if (this.events && Object.keys(this.events).length > 0) {
        dto.events = { ...this.events };
      }
      const props = this.getInspectorProperties();
      props.forEach((p) => {
        if (p.serializable === false) return;
        const designValues = this[DESIGN_VALUES];
        const value = designValues && designValues[p.name] !== void 0 ? designValues[p.name] : this.getPropertyValue(p.name);
        if (value !== void 0) {
          if (!p.name.includes(".")) {
            dto[p.name] = value;
          } else {
            const parts = p.name.split(".");
            let current = dto;
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
        dto.children = this.children.map((child) => {
          if (typeof child.toDTO === "function") {
            return child.toDTO();
          }
          if (typeof child.toJSON === "function") {
            return child.toJSON();
          }
          return child;
        });
      }
      Object.keys(dto).forEach((key) => {
        if (dto[key] === void 0) delete dto[key];
      });
      return dto;
    }
    /**
     * Abwärtskompatibilität: JSON.stringify() ruft toJSON() automatisch auf.
     * Delegiert an toDTO().
     */
    toJSON() {
      return this.toDTO();
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

  // src/components/TWindow.ts
  init_AnimationManager();
  init_Logger();
  var logger9 = Logger.get("TWindow");
  var TWindow = class extends TComponent {
    description = "";
    // Dokumentation für Variablen; ohne Laufzeiteffekt.
    x;
    y;
    width;
    height;
    zIndex;
    _align = "NONE";
    style;
    // Focus event callbacks (available to all components)
    onFocusCallback = null;
    onBlurCallback = null;
    // Align property with position enforcement
    get align() {
      return this._align;
    }
    set align(value) {
      this._align = value;
      if (value === "NONE") return;
      if (!this._initialized) return;
      const stageCols = this._gridCols || 64;
      const stageRows = this._gridRows || 40;
      if (value === "TOP") {
        this.x = 0;
        this.y = 0;
        this.width = stageCols;
      } else if (value === "BOTTOM") {
        this.x = 0;
        this.y = stageRows - (this.height || 2);
        this.width = stageCols;
      } else if (value === "LEFT") {
        this.x = 0;
        this.y = 0;
        this.height = stageRows;
      } else if (value === "RIGHT") {
        this.x = stageCols - (this.width || 4);
        this.y = 0;
        this.height = stageRows;
      } else if (value === "CLIENT") {
        this.x = 0;
        this.y = 0;
        this.width = stageCols;
        this.height = stageRows;
      }
    }
    _winVisible = true;
    get visible() {
      return this._winVisible;
    }
    set visible(v) {
      if (this._winVisible !== v) {
        this._winVisible = v;
        if (this.style) {
          this.style.visible = v;
        }
        this.onVisibilityChanged(v);
      }
    }
    /**
     * Hook that subclasses can override to react to visibility changes
     */
    onVisibilityChanged(_v) {
    }
    text = "";
    // Rotation in Grad (0-360)
    rotation = 0;
    // Opt-in: Dieses Objekt darf von Overlay-Einblendungen nicht verdeckt
    // werden — der Editor meldet Ueberschneidungen als Warnhinweis.
    protectFromOverlay = false;
    // Animation flag - wenn true, wird Physik pausiert
    isAnimating = false;
    // Collision flag for ALL components (Sprite vs Panel, Panel vs Sprite, etc)
    collisionEnabled = false;
    constructor(name, x, y, width, height) {
      super(name);
      this.x = x;
      this.y = y;
      this.width = width;
      this.height = height;
      this.zIndex = 0;
      this._align = "NONE";
      this._winVisible = true;
      this.text = "";
      this.rotation = 0;
      this.style = {
        backgroundColor: "transparent",
        borderColor: "transparent",
        borderWidth: 0
      };
      this._initialized = true;
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
      logger9.info(`[TWindow.moveTo] Called on "${this.name}": from (${this.x}, ${this.y}) to (${x}, ${y}), duration=${duration}ms, easing=${easing}`);
      const manager = AnimationManager.getInstance();
      logger9.info(`[TWindow.moveTo] AnimationManager instance obtained, activeTweens=${manager.getActiveTweenCount()}`);
      const tweenX = manager.addTween(this, "x", x, duration, easing);
      logger9.info(`[TWindow.moveTo] Added X tween: from=${tweenX.from} to=${tweenX.to}`);
      const tweenY = manager.addTween(this, "y", y, duration, easing, onComplete);
      logger9.info(`[TWindow.moveTo] Added Y tween: from=${tweenY.from} to=${tweenY.to}`);
      logger9.info(`[TWindow.moveTo] After adding tweens, activeTweens=${manager.getActiveTweenCount()}`);
    }
    /**
     * Führt eine Flip-Animation (Umdrehen) auf der Komponente aus.
     * @param duration Dauer in Millisekunden (default: 600)
     */
    flip(duration = 600) {
      const manager = AnimationManager.getInstance();
      manager.flip(this, duration);
    }
    /**
     * Get available events for this component
     * Override in subclasses to add more events
     */
    getEvents() {
      if (this.isHiddenInRun) {
        return [];
      }
      return Array.from(/* @__PURE__ */ new Set([...super.getEvents(), "onFocus", "onBlur", "onFlipMidpoint"]));
    }
    /**
     * Align-Änderungen erfordern einen vollständigen Inspector-Re-Render,
     * weil der Setter x/y/width/height beeinflusst.
     */
    applyChange(propertyName, newValue, oldValue) {
      if (propertyName === "align") return true;
      return super.applyChange(propertyName, newValue, oldValue);
    }
    /**
     * Berechnet dynamische min/max Constraints für Geometrie-Properties
     * basierend auf der aktuellen Stage-GridConfig.
     * Regel: Komponente muss vollständig auf der Stage liegen.
     *   x >= 0, y >= 0, x + width <= cols, y + height <= rows
     */
    getGeometryConstraints() {
      const project = coreStore.getProject();
      const activeStage = coreStore.getActiveStage();
      const grid = activeStage?.grid || project?.stage?.grid || { cols: 64, rows: 40 };
      const cols = grid.cols;
      const rows = grid.rows;
      return {
        xMax: Math.max(0, cols - (this.width || 1)),
        yMax: Math.max(0, rows - (this.height || 1)),
        wMax: Math.max(1, cols - (this.x || 0)),
        hMax: Math.max(1, rows - (this.y || 0)),
        cols,
        rows
      };
    }
    getInspectorProperties() {
      const gc = this.getGeometryConstraints();
      const visualProperties = [
        { name: "visible", label: "Sichtbar", type: "boolean", group: "IDENTIT\xC4T" },
        { name: "x", label: "X", type: "number", group: "GEOMETRIE", min: 0, max: gc.xMax, step: 1, inline: true, hint: `Stage: ${gc.cols}\xD7${gc.rows} Zellen` },
        { name: "y", label: "Y", type: "number", group: "GEOMETRIE", min: 0, max: gc.yMax, step: 1, inline: true, hint: `Stage: ${gc.cols}\xD7${gc.rows} Zellen` },
        { name: "width", label: "Breite", type: "number", group: "GEOMETRIE", min: 1, max: gc.wMax, step: 1, inline: true },
        { name: "height", label: "H\xF6he", type: "number", group: "GEOMETRIE", min: 1, max: gc.hMax, step: 1, inline: true },
        { name: "zIndex", label: "Z-Index", type: "number", group: "GEOMETRIE", min: 0, max: 9999, step: 1, inline: true },
        { name: "rotation", label: "Rotation", type: "number", group: "GEOMETRIE", min: 0, max: 360, step: 90, hint: "Winkel in Grad" },
        { name: "align", label: "Ausrichtung", type: "select", group: "GEOMETRIE", options: ["NONE", "TOP", "BOTTOM", "LEFT", "RIGHT", "CLIENT"], inline: true },
        { name: "collisionEnabled", label: "Kollision aktiv", type: "boolean", group: "PHYSIK" },
        { name: "protectFromOverlay", label: "Vor Overlays sch\xFCtzen", type: "boolean", group: "GEOMETRIE", hint: "Editor warn\xADt bei \xDCberdeckung durch Einblendungen (kompakt und aufgeklappt)." },
        { name: "style.color", label: "Textfarbe", type: "color", group: "TYPOGRAFIE" },
        { name: "style.fontSize", label: "Schriftgr\xF6\xDFe", type: "number", group: "TYPOGRAFIE", min: 6, max: 120, step: 1, inline: true },
        { name: "style.fontFamily", label: "Schriftart", type: "select", group: "TYPOGRAFIE", options: [{ value: "", label: "Standard" }, { value: "Arial", label: "Arial" }, { value: "Segoe UI, Arial, sans-serif", label: "Segoe UI" }, { value: "Verdana", label: "Verdana" }, { value: "Times New Roman", label: "Times New Roman" }, { value: "Courier New", label: "Courier New" }, { value: "Georgia", label: "Georgia" }] },
        { name: "style.fontWeight", label: "Fett", type: "boolean", group: "TYPOGRAFIE", inline: true },
        { name: "style.fontStyle", label: "Kursiv", type: "boolean", group: "TYPOGRAFIE", inline: true },
        { name: "style.textAlign", label: "Ausrichtung", type: "select", group: "TYPOGRAFIE", options: [{ value: "", label: "Standard" }, { value: "left", label: "Links" }, { value: "center", label: "Zentriert" }, { value: "right", label: "Rechts" }] },
        { name: "style.backgroundColor", label: "Hintergrund", type: "color", group: "STIL" },
        { name: "style.borderColor", label: "Rahmenfarbe", type: "color", group: "STIL" },
        { name: "style.borderWidth", label: "Rahmenbreite", type: "number", group: "STIL", min: 0, max: 20, step: 1 },
        { name: "style.borderRadius", label: "Abrundung", type: "number", group: "STIL", min: 0, max: 100, step: 1 },
        { name: "style.opacity", label: "Deckkraft", type: "number", group: "STIL", min: 0, max: 1, step: 0.1 },
        { name: "style.glowColor", label: "Glow Farbe", type: "color", group: "GLOW-EFFEKT" },
        { name: "style.glowBlur", label: "Glow Unsch\xE4rfe", type: "number", group: "GLOW-EFFEKT", min: 0, max: 100, step: 1 },
        { name: "style.glowSpread", label: "Glow Ausbreitung", type: "number", group: "GLOW-EFFEKT", min: 0, max: 50, step: 1 },
        { name: "style.shadowColor", label: "Schatten Farbe", type: "color", group: "SCHATTEN" },
        { name: "style.shadowOffsetX", label: "Offset X", type: "number", group: "SCHATTEN", min: -100, max: 100, step: 1, inline: true },
        { name: "style.shadowOffsetY", label: "Offset Y", type: "number", group: "SCHATTEN", min: -100, max: 100, step: 1, inline: true },
        { name: "style.shadowBlur", label: "Unsch\xE4rfe", type: "number", group: "SCHATTEN", min: 0, max: 100, step: 1, inline: true },
        { name: "style.shadowSpread", label: "Ausbreitung", type: "number", group: "SCHATTEN", min: -50, max: 50, step: 1, inline: true },
        { name: "style.shadowInset", label: "Innen", type: "boolean", group: "SCHATTEN", inline: true },
        { name: "style.boxShadow", label: "Box-Shadow (CSS)", type: "string", group: "SCHATTEN", hint: "\xDCberschreibt alle obigen Felder" }
      ];
      return [
        ...this.getBaseProperties(),
        ...this.isVariable ? [{ name: "description", label: "Bemerkung", type: "string", group: "Variable", defaultValue: "", hint: "Zweck und Verwendung dieser Variable" }] : [],
        ...visualProperties.map((prop) => ({ ...prop, visualOnly: true }))
      ];
    }
  };

  // src/utils/ComponentRegistry.ts
  init_define_import_meta_env();
  init_Logger();
  var logger10 = Logger.get("ComponentRegistry", "Core");
  var ComponentRegistry = class {
    static factories = /* @__PURE__ */ new Map();
    static originalClassNames = /* @__PURE__ */ new Map();
    // Zum Speichern des echten Namens, falls Aliase (wie TEdit/TTextInput) existieren
    /**
     * Registriert eine Komponente in der globalen ComponentRegistry
     * @param className Name der Klasse, wie sie serialisiert wird (z.B. 'TButton')
     * @param factory Fabrik-Funktion, die ein unfertiges {objData} erhält und die Instanz zurückgibt
     * @param aliases Optionale Aliase (für Abwärtskompatibilität, z.B. 'TRepeater' für 'TIntervalTimer')
     */
    static register(className, factory, aliases = []) {
      this.factories.set(className, factory);
      this.originalClassNames.set(className, className);
      for (const alias of aliases) {
        this.factories.set(alias, factory);
        this.originalClassNames.set(alias, className);
      }
    }
    /**
     * Instanziiert eine Komponente basierend auf ihrem className.
     */
    static create(objData) {
      if (!objData || !objData.className) return null;
      const factory = this.factories.get(objData.className);
      if (factory) {
        return factory(objData);
      }
      logger10.warn(`Unbekannte Komponente: ${objData.className}`);
      return null;
    }
    /**
     * Listet alle registrierten Komponentennamen auf.
     */
    static getRegisteredComponents() {
      return Array.from(this.factories.keys());
    }
  };

  // src/components/TPanel.ts
  var TPanel = class extends TWindow {
    _showGrid = false;
    _gridColor = "#000000";
    _gridStyle = "lines";
    constructor(name, x, y, width, height) {
      super(name, x, y, width, height);
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
  ComponentRegistry.register("TPanel", (objData) => new TPanel(objData.name, objData.x, objData.y, objData.width, objData.height));

  // src/components/TButton.ts
  init_define_import_meta_env();

  // src/components/TTextControl.ts
  init_define_import_meta_env();
  var TTextControl = class extends TWindow {
    constructor(name, x, y, width, height) {
      super(name, x, y, width, height);
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "text", label: "Inhalt", type: "textarea", group: "INHALT" }
        // TYPOGRAFIE-Felder (fontSize, fontWeight, fontStyle, textAlign, fontFamily)
        // kommen bereits von TWindow.getInspectorProperties() – NICHT doppelt hinzufügen!
      ];
    }
  };
  ComponentRegistry.register("TTextControl", (objData) => new TTextControl(objData.name, objData.x, objData.y, objData.width, objData.height));

  // src/components/TButton.ts
  var TButton = class extends TTextControl {
    icon = "";
    constructor(name, x, y, width, height, text2) {
      super(name, x, y, width, height);
      this.text = text2 !== void 0 ? text2 : name;
    }
    getInspectorProperties() {
      const props = super.getInspectorProperties();
      return [
        ...props,
        { name: "icon", label: "Icon", type: "image_picker", group: "ICON" }
      ];
    }
  };
  ComponentRegistry.register("TButton", (objData) => new TButton(objData.name, objData.x, objData.y, objData.width, objData.height, objData.caption));

  // src/components/TLabel.ts
  init_define_import_meta_env();
  var TLabel = class extends TTextControl {
    constructor(name, x, y, text2) {
      super(name, x, y, 8, 2);
      this.text = text2 !== void 0 ? text2 : name;
    }
    getInspectorProperties() {
      return super.getInspectorProperties();
    }
  };
  ComponentRegistry.register("TLabel", (objData) => new TLabel(objData.name, objData.x, objData.y, objData.text));

  // src/components/TEdit.ts
  init_define_import_meta_env();
  var TEdit = class extends TTextControl {
    text;
    placeholder;
    maxLength;
    inputType = "text";
    autocomplete = "off";
    // TEdit-specific event callbacks
    onChangeCallback = null;
    onEnterCallback = null;
    constructor(name, x, y, width = 8, height = 2) {
      super(name, x, y, width, height);
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
        { name: "inputType", label: "Eingabetyp", type: "select", options: ["text", "password"], group: "EINGABE" },
        { name: "autocomplete", label: "Autovervollst\xE4ndigung", type: "select", options: ["off", "username", "current-password", "new-password"], group: "EINGABE" },
        { name: "placeholder", label: "Platzhalter", type: "string", group: "EINGABE" },
        { name: "maxLength", label: "Max. L\xE4nge", type: "number", group: "EINGABE" }
        // Inherits styles from TTextControl
      ];
    }
  };
  ComponentRegistry.register("TEdit", (objData) => new TEdit(objData.name, objData.x, objData.y, objData.width, objData.height), ["TTextInput"]);

  // src/multiplayer/MultiplayerLobby.ts
  init_Logger();
  var logger11 = Logger.get("MultiplayerLobby");
  var MultiplayerLobby = class {
    container = null;
    onGameStart = null;
    // UI Components
    panel;
    titleLabel;
    statusLabel;
    createButton;
    roomCodeEdit;
    joinButton;
    roomCodeLabel;
    readyButton;
    constructor() {
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
        logger11.error("Connection failed:", error);
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
  init_define_import_meta_env();
  var RemotePaddle = class {
    y = 0;
    velocity = 0;
    speed = 0.3;
    targetY = null;
    correctionRate = 0.15;
    boundsTop = 0;
    boundsBottom = 24;
    constructor(initialY = 10, boundsTop = 0, boundsBottom = 24) {
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
    remotePaddle;
    _localPlayerNumber = 1;
    opponentPlayerNumber = 2;
    positionSyncInterval = null;
    localPaddleGetter = null;
    constructor() {
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
  init_define_import_meta_env();
  var CollisionSyncer = class {
    localPlayerNumber = 1;
    onBallStateUpdate = null;
    onScoreUpdate = null;
    constructor() {
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

  // src/multiplayer/Protocol.ts
  init_define_import_meta_env();

  // src/export/GameExporter.ts
  var logger12 = Logger.get("GameExporter", "Export_System");
  var GameExporter = class {
    /**
     * Export the project as a standalone HTML file
     */
    async exportHTML(project) {
      let runtimeCode = "";
      try {
        try {
          const resp = await fetch("runtime-standalone.js");
          if (resp.ok) {
            const code = await resp.text();
            if (!code.trim().startsWith("<!DOCTYPE") && !code.trim().startsWith("<html")) {
              runtimeCode = code;
            }
          }
        } catch (fetchErr) {
          logger12.warn("GameExporter: Fetch failed, falling back to FS...", fetchErr);
        }
        if (!runtimeCode && window.electronFS && !window.__TAURI_INTERNALS__) {
          const appPath = await window.electronFS.getAppPath();
          try {
            runtimeCode = await window.electronFS.readFile(`${appPath}/dist/runtime-standalone.js`);
          } catch {
            runtimeCode = await window.electronFS.readFile(`${appPath}/public/runtime-standalone.js`);
          }
        }
      } catch (e) {
        logger12.error("GameExporter: Network/FS error fetching runtime bundle:", e);
      }
      const cleanedProject = this.getCleanProject(project);
      try {
        await this.embedMedia(cleanedProject);
      } catch (e) {
        logger12.warn("GameExporter: Error embedding images:", e);
      }
      const html2 = this.generateStandaloneHTML(cleanedProject, runtimeCode);
      await this.downloadFile(html2, `${project.meta.name.replace(/\s+/g, "_")}.html`, "text/html");
    }
    /**
     * Export the project as a clean JSON file (without editor/flow info)
     */
    async exportJSON(project) {
      const cleanedProject = this.getCleanProject(project);
      try {
        await this.embedMedia(cleanedProject);
      } catch (e) {
        logger12.warn("GameExporter: Error embedding images in JSON:", e);
      }
      const json = JSON.stringify(cleanedProject, null, 2);
      await this.downloadFile(json, `${project.meta.name.replace(/\s+/g, "_")}.json`, "application/json");
    }
    /**
     * Legacy method for backward compatibility
     */
    async export(project) {
      return this.exportHTML(project);
    }
    /**
     * Export the project as a gzip-compressed standalone HTML file
     */
    async exportHTMLCompressed(project) {
      let runtimeCode = "";
      try {
        try {
          const resp = await fetch("runtime-standalone.js");
          if (resp.ok) {
            const code = await resp.text();
            if (!code.trim().startsWith("<!DOCTYPE") && !code.trim().startsWith("<html")) {
              runtimeCode = code;
            }
          }
        } catch (fetchErr) {
          logger12.warn("GameExporter: Fetch compressed failed, falling back to FS...", fetchErr);
        }
        if (!runtimeCode && window.electronFS && !window.__TAURI_INTERNALS__) {
          const appPath = await window.electronFS.getAppPath();
          try {
            runtimeCode = await window.electronFS.readFile(`${appPath}/dist/runtime-standalone.js`);
          } catch {
            runtimeCode = await window.electronFS.readFile(`${appPath}/public/runtime-standalone.js`);
          }
        }
      } catch (e) {
        logger12.error("GameExporter: Network/FS error fetching runtime bundle:", e);
      }
      const cleanedProject = this.getCleanProject(project);
      try {
        await this.embedMedia(cleanedProject);
      } catch (e) {
        logger12.warn("GameExporter: Error embedding images:", e);
      }
      const html2 = this.generateCompressedHTML(cleanedProject, runtimeCode);
      await this.downloadFile(html2, `${project.meta.name.replace(/\s+/g, "_")}_compressed.html`, "text/html");
    }
    /**
     * Export the project as a gzip-compressed JSON file
     */
    async exportJSONCompressed(project) {
      const cleanedProject = this.getCleanProject(project);
      try {
        await this.embedMedia(cleanedProject);
      } catch (e) {
        logger12.warn("GameExporter: Error embedding images in JSON:", e);
      }
      const compressedData = this.compressProject(cleanedProject);
      const wrapper = {
        _compressed: true,
        _version: RUNTIME_VERSION,
        data: compressedData
      };
      const json = JSON.stringify(wrapper, null, 2);
      await this.downloadFile(json, `${project.meta.name.replace(/\s+/g, "_")}_compressed.json`, "application/json");
    }
    /**
     * Export the project as a ZIP bundle for the CMS upload:
     * <Name>.json keeps its relative media paths (./images/…) and every
     * referenced media file is packed under its cleaned relative path —
     * exactly what the CMS upload validator expects.
     */
    async exportCmsBundle(project) {
      const cleanedProject = this.getCleanProject(project);
      const { refs: mediaRefs, patterns } = this.collectMediaRefs(cleanedProject);
      const projectName = (project.meta?.name || "spiel").replace(/\s+/g, "_");
      const files = {};
      files[`${projectName}.json`] = new TextEncoder().encode(JSON.stringify(cleanedProject, null, 2));
      const cleanRel = (ref) => {
        let rel = ref;
        if (rel.startsWith("./")) rel = rel.substring(2);
        if (rel.startsWith("/")) rel = rel.substring(1);
        return rel;
      };
      const baseUrl = project.meta?.baseUrl || network.getHttpUrl() || window.location.href;
      const pack = async (ref) => {
        const rel = cleanRel(ref);
        if (files[rel]) return true;
        try {
          const urls = [new URL(rel, baseUrl).href];
          if (!rel.startsWith("images/")) urls.push(new URL(`images/${rel}`, baseUrl).href);
          for (const tryUrl of urls) {
            const resp = await fetch(tryUrl);
            if (resp.ok && !(resp.headers.get("content-type") || "").includes("text/html")) {
              files[rel] = new Uint8Array(await resp.arrayBuffer());
              return true;
            }
          }
        } catch (e) {
          logger12.warn(`[GameExporter] Bundle medium not loadable: ${ref}`, e);
        }
        return false;
      };
      const missing = [];
      for (const ref of mediaRefs.keys()) {
        if (!await pack(ref)) missing.push(cleanRel(ref));
      }
      const unresolvedPatterns = [];
      if (patterns.length) {
        const manifestFiles = await this.loadMediaManifest(baseUrl);
        for (const pattern of patterns) {
          const regex = this.mediaPatternToRegExp(cleanRel(pattern));
          const hits = manifestFiles.filter((f) => regex.test(f));
          let packed = 0;
          for (const hit of hits) if (await pack(hit)) packed += 1;
          if (!packed) unresolvedPatterns.push(pattern);
        }
      }
      const zipped = zipSync(files);
      const blob = new Blob([zipped.buffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      setTimeout(() => URL.revokeObjectURL(url), 2e3);
      const mediaCount = Object.keys(files).length - 1;
      const problems = [...missing, ...unresolvedPatterns.map((p) => `Muster: ${p}`)];
      NotificationToast.show(problems.length === 0 ? `CMS-Bundle exportiert: ${projectName}.zip

${mediaCount} Mediendatei(en) enthalten \u2014 direkt unter \u201EMeine Spiele" hochladbar.` : `\u26A0 CMS-Bundle m\xF6glicherweise unvollst\xE4ndig: ${projectName}.zip

${mediaCount} Medien enthalten, ${problems.length} nicht gepackt:
${problems.slice(0, 10).join("\n")}${problems.length > 10 ? "\n\u2026" : ""}`);
    }
    /**
     * Export the project as a Node.js server bundle (ZIP)
     */
    async exportServerBundle(project) {
      let runtimeCode = "";
      try {
        const runtimeUrl = new URL("runtime-standalone.js", window.location.href).href;
        const resp = await fetch(runtimeUrl);
        if (resp.ok) {
          runtimeCode = await resp.text();
        }
      } catch (e) {
        logger12.error("GameExporter: Error fetching runtime:", e);
      }
      const cleanedProject = this.getCleanProject(project);
      const projectName = project.meta.name.replace(/\s+/g, "_");
      const files = {};
      const encoder = new TextEncoder();
      files["project.json"] = encoder.encode(JSON.stringify(cleanedProject, null, 2));
      files["runtime.js"] = encoder.encode(runtimeCode);
      files["server.js"] = encoder.encode(this.generateServerJS());
      files["package.json"] = encoder.encode(this.generateServerPackageJSON(projectName));
      files["Dockerfile"] = encoder.encode(this.generateDockerfile());
      files["fly.toml"] = encoder.encode(this.generateFlyToml(projectName));
      const zipped = zipSync(files);
      const blob = new Blob([zipped.buffer], { type: "application/zip" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `${projectName}_server_bundle.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      NotificationToast.show(`Server-Bundle exportiert: ${projectName}_server_bundle.zip

Enth\xE4lt Dockerfile und fly.toml f\xFCr das Deployment.`);
    }
    generateServerJS() {
      return `
/**
 * GCS Standalone Server Entry
 * L\xE4dt die GCS Engine (IIFE) und startet die Headless Runtime.
 */
require('./runtime.js'); 
const project = require('./project.json');

// HeadlessRuntime und HeadlessServer sind durch das IIFE-Bundle global verf\xFCgbar
const runtime = new HeadlessRuntime(project);
const server = new HeadlessServer(runtime);

logger.info('--- GCS Headless Server Start ---');
server.start();
`;
    }
    generateServerPackageJSON(name) {
      return JSON.stringify({
        name: name.toLowerCase(),
        version: "1.0.0",
        description: "GCS Exported Backend",
        main: "server.js",
        dependencies: {
          "express": "^4.18.2",
          "fflate": "^0.8.2"
        },
        scripts: {
          "start": "node server.js"
        }
      }, null, 2);
    }
    generateDockerfile() {
      return `
FROM node:18-slim
WORKDIR /app
COPY package*.json ./
RUN npm install --production
COPY . .
EXPOSE 3000
CMD ["npm", "start"]
`;
    }
    generateFlyToml(name) {
      return `
app = "${name.toLowerCase()}"
primary_region = "fra"

[http_service]
  internal_port = 3000
  force_https = true
  auto_stop_machines = true
  auto_start_machines = true
  min_machines_running = 0
  processes = ["app"]
`;
    }
    /**
     * Compress project JSON using gzip and encode as Base64
     */
    compressProject(project) {
      const json = JSON.stringify(project);
      const compressed = gzipSync(new TextEncoder().encode(json));
      let binary = "";
      for (let i = 0; i < compressed.length; i++) {
        binary += String.fromCharCode(compressed[i]);
      }
      return btoa(binary);
    }
    /** Helfer zum sicheren Serialisieren von Objekten mit zirkulären Referenzen (z.B. Editor-Instanzen) */
    safeStringify(obj) {
      const seen = /* @__PURE__ */ new WeakSet();
      const SKIP_KEYS = /* @__PURE__ */ new Set(["renderer", "host", "parent", "stage", "editor", "__rawSource", "_listeners", "_eventTarget"]);
      return JSON.stringify(obj, (key, value) => {
        if (SKIP_KEYS.has(key)) return void 0;
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return void 0;
          seen.add(value);
        }
        return value;
      });
    }
    /**
     * Removes all editor-only properties (flow editor, node positions, etc.)
     * to keep the game file small and clean for the platform.
     */
    getCleanProject(project) {
      const whitelist = ["meta", "stages", "activeStageId", "variables", "tasks", "actions", "stage", "objects", "flowCharts", "splashAutoHide", "splashDuration", "themes", "activeThemeId"];
      const clean = {};
      whitelist.forEach((key) => {
        if (project[key] !== void 0) {
          clean[key] = JSON.parse(this.safeStringify(project[key]));
        }
      });
      this.deepClean(clean);
      if (clean.stages) {
      }
      if (!clean.meta) clean.meta = {};
      const mainStage = clean.stages?.find((s) => s.type === "main");
      if (mainStage) {
        if (mainStage.gameName) clean.meta.name = mainStage.gameName;
        if (mainStage.author) clean.meta.author = mainStage.author;
        if (mainStage.description) clean.meta.description = mainStage.description;
      }
      clean.meta.exportedAt = (/* @__PURE__ */ new Date()).toISOString();
      clean.meta.type = "standalone_game";
      clean.meta.runtimeVersion = RUNTIME_VERSION;
      return clean;
    }
    /**
     * Recursively removes internal properties and editor-only noise
     */
    deepClean(obj) {
      if (!obj || typeof obj !== "object") return;
      if (Array.isArray(obj)) {
        obj.forEach((item) => this.deepClean(item));
        return;
      }
      const editorOnlyKeys = ["flow", "flowGraph", "nodePositions", "description", "details", "showDetails"];
      Object.keys(obj).forEach((key) => {
        if (editorOnlyKeys.includes(key) || key === "__v_isRef" || key === "__v_raw") {
          delete obj[key];
        } else {
          this.deepClean(obj[key]);
        }
      });
    }
    /**
     * Generate a complete standalone HTML file with embedded runtime
     */
    generateStandaloneHTML(project, runtimeJS) {
      const projectJSON = JSON.stringify(project, null, 2).replace(/<\/script>/gi, "<\/script>").replace(/<!--/g, "<!--");
      const mainStage = project.stages?.find((s) => s.type === "main") || project.stages?.[0] || project.stage;
      const gridConfig = mainStage?.grid || { cols: 20, rows: 15, cellSize: 32, backgroundColor: "#ffffff" };
      const stageWidth = gridConfig.cols * gridConfig.cellSize;
      const stageHeight = gridConfig.rows * gridConfig.cellSize;
      const pwaHead = this.generatePWAHead(project);
      return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
${pwaHead}
    <title>${SecurityUtils.escapeHtml(project.meta.name || "New Game")}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #0f172a;
        }
        body {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }
        #stage-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }
        #run-stage {
            position: relative;
            width: ${stageWidth}px;
            height: ${stageHeight}px;
            background: ${gridConfig.backgroundColor || "#ffffff"};
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            border-radius: 4px;
            overflow: hidden;
            transform-origin: center center;
            flex-shrink: 0;
            touch-action: none; /* Verhindert Browser-Scroll/Zoom auf Touch-Ger\xE4ten */
        }
        .game-object {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
            user-select: none;
        }
    </style>
</head>
<body>
    <div id="stage-container">
        <div id="run-stage"></div>
    </div>
    
    <script>
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    // Standalone Runtime Bundle (Shared Logic)
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    ${runtimeJS}

    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    // Start Game
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    <\/script>
    <script type="application/json" id="gcs-project-data">
${projectJSON}
    <\/script>
    <script>
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.startStandalone === 'function') {
            try {
                const projectDataStr = document.getElementById('gcs-project-data').textContent;
                window.PROJECT = JSON.parse(projectDataStr);
                window.startStandalone(window.PROJECT);
            } catch (e) {
                logger.error('Failed to parse project data:', e);
                document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:20%">Error: Project initialization failed.</h2>';
            }
        } else {
            logger.error('Standalone Runtime not found! Check if runtime-standalone.js was bundled correctly.');
            document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:20%">Error: Runtime not found.</h2>';
        }
    });
    <\/script>
</body>
</html>`;
    }
    /**
     * Generate a compressed standalone HTML file with gzip-encoded project data
     */
    generateCompressedHTML(project, runtimeJS) {
      const compressedData = this.compressProject(project);
      const mainStage = project.stages?.find((s) => s.type === "main") || project.stages?.[0] || project.stage;
      const gridConfig = mainStage?.grid || { cols: 20, rows: 15, cellSize: 32, backgroundColor: "#ffffff" };
      const stageWidth = gridConfig.cols * gridConfig.cellSize;
      const stageHeight = gridConfig.rows * gridConfig.cellSize;
      const pwaHead = this.generatePWAHead(project);
      return `<!DOCTYPE html>
<html lang="de">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
${pwaHead}
    <title>${SecurityUtils.escapeHtml(project.meta.name || "New Game")}</title>
    <style>
        * { box-sizing: border-box; margin: 0; padding: 0; }
        html, body {
            width: 100%;
            height: 100%;
            overflow: hidden;
            background: #0f172a;
        }
        body {
            background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
            display: flex;
            justify-content: center;
            align-items: center;
            font-family: 'Segoe UI', system-ui, -apple-system, sans-serif;
        }
        #stage-container {
            position: relative;
            width: 100vw;
            height: 100vh;
            display: flex;
            justify-content: center;
            align-items: center;
            overflow: hidden;
        }
        #run-stage {
            position: relative;
            width: ${stageWidth}px;
            height: ${stageHeight}px;
            background: ${gridConfig.backgroundColor || "#ffffff"};
            box-shadow: 0 20px 50px rgba(0,0,0,0.5);
            border-radius: 4px;
            overflow: hidden;
            transform-origin: center center;
            flex-shrink: 0;
            touch-action: none; /* Verhindert Browser-Scroll/Zoom auf Touch-Ger\xE4ten */
        }
        .game-object {
            position: absolute;
            display: flex;
            align-items: center;
            justify-content: center;
            box-sizing: border-box;
            overflow: hidden;
            user-select: none;
        }
    </style>
</head>
<body>
    <div id="stage-container">
        <div id="run-stage"></div>
    </div>
    
    <script>
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    // Standalone Runtime Bundle (Shared Logic)
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    ${runtimeJS}

    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    // Compressed Project Data (gzip + Base64)
    // \u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550\u2550
    window.PROJECT_DATA = "${compressedData}";
    
    document.addEventListener('DOMContentLoaded', () => {
        if (typeof window.startStandalone === 'function') {
            // Runtime will detect PROJECT_DATA and decompress automatically
            window.startStandalone(null);
        } else {
            logger.error('Standalone Runtime not found!');
            document.body.innerHTML = '<h2 style="color:white;text-align:center;margin-top:20%">Error: Runtime not found.</h2>';
        }
    });
    <\/script>
</body>
</html>`;
    }
    /**
     * Collects all referenced media paths in the project (./images/…,
     * variable bindings, list entries). Keys of `refs` are the raw references;
     * embedMedia() fills the values with data URLs, the CMS bundle
     * needs only the keys.
     *
     * `patterns` sammelt zusaetzlich Medienpfade mit ${…}-Interpolationsstellen
     * (z. B. images/madn/w${Var_Wurf}.svg): Sie sind zur Laufzeit dynamisch,
     * koennen also nicht direkt gefetcht werden — der CMS-Bundle-Export loest
     * sie gegen das Medienmanifest auf und packt alle passenden Dateien.
     */
    collectMediaRefs(project) {
      const mediaRefs = /* @__PURE__ */ new Map();
      const patterns = [];
      const mediaExtensions = /\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|mp3|ogg|wav|m4a|mp4|webm|woff|woff2|ttf|otf)$/i;
      const isMediaPath = (s) => {
        if (!s || typeof s !== "string" || s.length === 0) return false;
        if (s.startsWith("data:") || s.startsWith("http://") || s.startsWith("https://")) return false;
        return /(^|\/)(images|audio|video|assets|media|fonts)\//i.test(s) || mediaExtensions.test(s);
      };
      const varMap = /* @__PURE__ */ new Map();
      const collectVariables = (obj) => {
        if (Array.isArray(obj)) {
          obj.forEach(collectVariables);
          return;
        }
        if (!obj || typeof obj !== "object") return;
        if ((obj.className === "TVariable" || obj.className === "Variable") && typeof obj.name === "string") {
          varMap.set(obj.name, obj.value);
        }
        if ((obj.className === "TListVariable" || obj.className === "ListVariable") && typeof obj.name === "string" && Array.isArray(obj.items)) {
          varMap.set(obj.name, obj.items);
        }
        Object.values(obj).forEach(collectVariables);
      };
      collectVariables(project);
      const resolveBinding = (s, depth = 3) => {
        if (typeof s !== "string") return void 0;
        const m = s.match(/^\s*\$\{([^}]+)\}\s*$/);
        if (!m || depth <= 0) return void 0;
        const expr = m[1].trim();
        const idxMatch = expr.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*(\d+)\s*\]$/);
        if (idxMatch) {
          const list = varMap.get(idxMatch[1]);
          if (Array.isArray(list)) {
            const resolved = list[parseInt(idxMatch[2], 10)];
            if (typeof resolved === "string" && resolved) {
              return resolveBinding(resolved, depth - 1) ?? resolved;
            }
            return typeof resolved === "string" ? resolved : void 0;
          }
          return void 0;
        }
        const val = varMap.get(expr);
        if (typeof val === "string" && val) return resolveBinding(val, depth - 1) ?? val;
        if (typeof val === "string") return val;
        if (val !== void 0 && val !== null) return String(val);
        return void 0;
      };
      const collectPaths = (obj) => {
        const tryCollect = (s) => {
          if (/\$\{[^}]+\}/.test(s)) {
            const resolved = resolveBinding(s);
            if (typeof resolved === "string" && isMediaPath(resolved)) {
              mediaRefs.set(resolved, "");
            } else if (isMediaPath(s) && !patterns.includes(s)) {
              patterns.push(s);
            }
          } else if (isMediaPath(s)) {
            mediaRefs.set(s, "");
          } else {
            const resolved = resolveBinding(s);
            if (typeof resolved === "string" && isMediaPath(resolved)) {
              mediaRefs.set(resolved, "");
            }
          }
        };
        if (Array.isArray(obj)) {
          obj.forEach((item) => {
            if (typeof item === "string") {
              tryCollect(item);
            } else if (item && typeof item === "object") {
              collectPaths(item);
            }
          });
          return;
        }
        if (!obj || typeof obj !== "object") return;
        Object.values(obj).forEach((val) => {
          if (typeof val === "string") {
            tryCollect(val);
          } else if (val && typeof val === "object") {
            collectPaths(val);
          }
        });
      };
      collectPaths(project);
      return { refs: mediaRefs, patterns };
    }
    /**
     * Laedt public/media-manifest.json und liefert alle enthaltenen
     * Medienpfade vollqualifiziert (images/<ordner>/<datei>).
     * Leere Liste, wenn das Manifest nicht erreichbar ist.
     */
    async loadMediaManifest(baseUrl) {
      try {
        const resp = await fetch(new URL("media-manifest.json", baseUrl).href);
        if (!resp.ok) return [];
        const manifest = await resp.json();
        const files = [];
        for (const [section, folders] of Object.entries(manifest)) {
          if (!folders || typeof folders !== "object") continue;
          for (const [folder, names] of Object.entries(folders)) {
            if (!Array.isArray(names)) continue;
            for (const name of names) files.push(`${section}/${folder ? folder + "/" : ""}${name}`);
          }
        }
        return files;
      } catch {
        return [];
      }
    }
    /**
     * Baut aus einem dynamischen Medienpfad eine Regex:
     * statische Teile werden escaped, jede ${…}-Stelle matcht ein
     * Nicht-Separator-Segment — images/madn/w${Var_Wurf}.svg trifft
     * also w1.svg…w6.svg, aber keine Dateien in Unterordnern.
     */
    mediaPatternToRegExp(pattern) {
      const escaped = pattern.split(/\$\{[^}]+\}/).map((part) => part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("[^/]+?");
      return new RegExp(`^${escaped}$`);
    }
    /**
     * Finds and embeds all media references (Images, Audio) in the project as Base64 Data URLs.
     */
    async embedMedia(project) {
      const { refs: mediaRefs, patterns: mediaPatterns } = this.collectMediaRefs(project);
      if (mediaPatterns.length) {
        logger12.warn("[GameExporter] Dynamische Medienpfade koennen im Einzelfile-Export nicht eingebettet werden:", mediaPatterns);
      }
      logger12.info(`[GameExporter] Found ${mediaRefs.size} unique media files to embed.`);
      for (const [path, _] of mediaRefs) {
        try {
          let relativePath = path;
          if (relativePath.startsWith("./")) {
            relativePath = relativePath.substring(2);
          }
          if (relativePath.startsWith("/")) {
            relativePath = relativePath.substring(1);
          }
          const baseUrl = project.meta?.baseUrl || network.getHttpUrl() || window.location.href;
          const url = new URL(relativePath, baseUrl).href;
          const urls = [url];
          if (!relativePath.startsWith("images/")) {
            urls.push(new URL(`images/${relativePath}`, baseUrl).href);
          }
          let embedded = false;
          for (const tryUrl of urls) {
            logger12.info(`[GameExporter] Fetching media: ${tryUrl}`);
            const resp = await fetch(tryUrl);
            if (resp.ok) {
              const contentType = resp.headers.get("content-type") || "";
              if (contentType.includes("text/html")) {
                logger12.warn(`[GameExporter] Media path returned HTML, not a media file: ${tryUrl}`);
              } else {
                const blob = await resp.blob();
                const dataUrl = await this.blobToDataUrl(blob);
                mediaRefs.set(path, dataUrl);
                logger12.info(`[GameExporter] Successfully embedded: ${path} from ${tryUrl}`);
                embedded = true;
                break;
              }
            }
          }
          if (!embedded) {
            logger12.warn(`[GameExporter] Failed to embed media: ${path}`);
          }
        } catch (e) {
          logger12.warn(`[GameExporter] Network error embedding media: ${path}`, e);
        }
      }
      const replacePaths = (obj) => {
        if (Array.isArray(obj)) {
          obj.forEach((item, i) => {
            if (typeof item === "string" && mediaRefs.has(item)) {
              const dataUrl = mediaRefs.get(item);
              if (dataUrl) obj[i] = dataUrl;
            } else if (item && typeof item === "object") {
              replacePaths(item);
            }
          });
          return;
        }
        if (!obj || typeof obj !== "object") return;
        Object.keys(obj).forEach((key) => {
          const val = obj[key];
          if (typeof val === "string" && mediaRefs.has(val)) {
            const dataUrl = mediaRefs.get(val);
            if (dataUrl) obj[key] = dataUrl;
          } else if (val && typeof val === "object") {
            replacePaths(val);
          }
        });
      };
      replacePaths(project);
    }
    /**
     * Convert a Blob to a Base64 Data URL
     */
    blobToDataUrl(blob) {
      return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onloadend = () => resolve(reader.result);
        reader.onerror = reject;
        reader.readAsDataURL(blob);
      });
    }
    // D-02: escapeHtml wurde auf SecurityUtils.escapeHtml() konsolidiert (kein Duplikat mehr)
    /**
     * Trigger file download.
     * Unterstützt: Electron (window.electronFS) > FileSystem Access API > Blob-Download.
     */
    async downloadFile(content, filename, mimeType) {
      if (window.electronFS) {
        try {
          const ext = mimeType === "text/html" ? "html" : "json";
          const fileType = mimeType === "text/html" ? "HTML Game" : "JSON Game Project";
          const targetPath = await window.electronFS.showSaveDialog({
            defaultPath: filename,
            filters: [{ name: fileType, extensions: [ext] }]
          });
          if (!targetPath) return;
          await window.electronFS.writeFile(targetPath, content);
          NotificationToast.show(`Export erfolgreich!

Datei: ${targetPath}`);
          return;
        } catch (err2) {
          logger12.warn("Electron FS failed, falling back:", err2);
        }
      }
      if ("showSaveFilePicker" in window) {
        try {
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: mimeType === "text/html" ? "HTML Game File" : "JSON Game File",
              accept: { [mimeType]: [mimeType === "text/html" ? ".html" : ".json"] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(content);
          await writable.close();
          NotificationToast.show(`Game exported successfully!

File: ${handle.name}

Open it in any browser to play.`);
          return;
        } catch (err2) {
          if (err2.name === "AbortError") return;
          logger12.warn("File System Access API failed, using fallback:", err2);
        }
      }
      const blob = new Blob([content], { type: mimeType });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 2e3);
      NotificationToast.show(`Game exported to Downloads folder.

File: ${filename}`);
    }
    /**
     * Generiert PWA-Head-Markup: ein data-URI Manifest und Apple-Meta-Tags.
     * Im Single-File-Export kann keine separate manifest.json ausgeliefert werden,
     * deshalb wird das Manifest inline als data:application/json;base64 verpackt.
     */
    generatePWAHead(project) {
      const name = SecurityUtils.escapeHtml(project.meta?.name || "GCS Spiel");
      const shortName = name.length > 12 ? name.substring(0, 9) + "..." : name;
      const themeColor = "#0f172a";
      const backgroundColor = "#0f172a";
      const manifest = {
        name: project.meta?.name || "GCS Spiel",
        short_name: shortName,
        start_url: ".",
        display: "standalone",
        background_color: backgroundColor,
        theme_color: themeColor,
        lang: "de",
        orientation: "any",
        icons: [
          { src: "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxOTIiIGhlaWdodD0iMTkyIiB2aWV3Qm94PSIwIDAgMTkyIDE5MiI+PHJlY3Qgd2lkdGg9IjE5MiIgaGVpZ2h0PSIxOTIiIGZpbGw9IiMwZjE3MmEiLz48dGV4dCB4PSI5NiIgeT0iMTEwIiBmb250LXNpemU9IjcwIiB0ZXh0LWFuY2hvcj0ibWlkZGxlIiBmaWxsPSIjNGZhY2ZlIj7wn5iBPC90ZXh0Pjwvc3ZnPg==", sizes: "192x192", type: "image/svg+xml" }
        ]
      };
      const manifestJson = JSON.stringify(manifest);
      const manifestB64 = btoa(manifestJson);
      return `    <meta name="theme-color" content="${themeColor}">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
    <meta name="apple-mobile-web-app-title" content="${name}">
    <meta name="mobile-web-app-capable" content="yes">
    <link rel="manifest" href="data:application/json;base64,${manifestB64}">`;
    }
  };

  // src/services/ProjectPersistenceService.ts
  init_Logger();

  // src/adapters/ServerStorageAdapter.ts
  init_define_import_meta_env();
  init_Logger();
  var ServerStorageAdapter = class _ServerStorageAdapter {
    static logger = Logger.get("ServerStorageAdapter", "Project_Save_Load");
    name = "ServerStorage";
    isAvailable() {
      return typeof fetch !== "undefined";
    }
    async save(project, _) {
      void _;
      const res = await fetch("/api/dev/save-project", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(project)
      });
      const data = await res.json();
      if (!data.success) {
        throw new Error(`Server save failed: ${data.error || "unknown"}`);
      }
      _ServerStorageAdapter.logger.info("Projekt auf Server gespeichert.");
    }
    async load(filename) {
      const path = filename || "./projects/project.json";
      const response = await fetch(`${path}?t=${Date.now()}`);
      if (!response.ok) return null;
      return await response.json();
    }
    async list() {
      try {
        const res = await fetch("/api/dev/list-projects");
        if (!res.ok) return [];
        const data = await res.json();
        return data.files || [];
      } catch {
        return [];
      }
    }
  };

  // src/adapters/IndexedDBAdapter.ts
  init_define_import_meta_env();
  init_Logger();
  var DB_NAME = "gcs_project_store";
  var DB_VERSION = 1;
  var STORE_NAME = "projects";
  var PROJECT_KEY = "last_project";
  var IndexedDBAdapter = class _IndexedDBAdapter {
    static logger = Logger.get("IndexedDBAdapter", "Project_Save_Load");
    name = "IndexedDB";
    /** Cached DB-Verbindung (wird lazy initialisiert) */
    db = null;
    /**
     * Öffnet die IndexedDB-Verbindung (lazy, einmalig).
     * Erstellt den ObjectStore beim ersten Aufruf automatisch.
     */
    openDB() {
      if (this.db) return Promise.resolve(this.db);
      return new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);
        request.onupgradeneeded = () => {
          const db = request.result;
          if (!db.objectStoreNames.contains(STORE_NAME)) {
            db.createObjectStore(STORE_NAME);
          }
        };
        request.onsuccess = () => {
          this.db = request.result;
          resolve(this.db);
        };
        request.onerror = () => {
          _IndexedDBAdapter.logger.error("IndexedDB konnte nicht ge\xF6ffnet werden:", request.error);
          reject(request.error);
        };
      });
    }
    isAvailable() {
      return typeof indexedDB !== "undefined";
    }
    async save(project, _) {
      void _;
      const db = await this.openDB();
      return new Promise((resolve, reject) => {
        const tx = db.transaction(STORE_NAME, "readwrite");
        const store = tx.objectStore(STORE_NAME);
        const record = {
          project,
          savedAt: Date.now()
        };
        const request = store.put(record, PROJECT_KEY);
        request.onsuccess = () => {
          resolve();
        };
        request.onerror = () => {
          _IndexedDBAdapter.logger.error("IndexedDB save fehlgeschlagen:", request.error);
          reject(request.error);
        };
      });
    }
    async load(_) {
      void _;
      const record = await this.loadWithMetadata();
      return record?.project || null;
    }
    /** Liefert zusätzlich den Browser-Speicherzeitpunkt für die Startprüfung. */
    async loadWithMetadata() {
      try {
        const db = await this.openDB();
        return new Promise((resolve, reject) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const request = store.get(PROJECT_KEY);
          request.onsuccess = () => {
            const record = request.result;
            if (record && record.project) {
              try {
                const objects = record.project?.stages?.[0]?.objects || [];
                const ufo = objects.find((o) => o.name === "UfoTemplate");
                if (ufo) {
                  const bgLength = ufo.backgroundImage ? ufo.backgroundImage.length : 0;
                  _IndexedDBAdapter.logger.info(`[INDEXEDDB-LOAD] UfoTemplate backgroundImage length: ${bgLength}`);
                  if (bgLength > 100) {
                    _IndexedDBAdapter.logger.info(`[INDEXEDDB-LOAD] UfoTemplate has BASE64 image! Prefix: ${ufo.backgroundImage.substring(0, 50)}`);
                  }
                }
              } catch {
              }
              resolve({ project: record.project, savedAt: Number(record.savedAt) || 0 });
            } else {
              resolve(null);
            }
          };
          request.onerror = () => {
            _IndexedDBAdapter.logger.warn("IndexedDB load fehlgeschlagen:", request.error);
            reject(request.error);
          };
        });
      } catch {
        return null;
      }
    }
    async list() {
      try {
        const db = await this.openDB();
        return new Promise((resolve) => {
          const tx = db.transaction(STORE_NAME, "readonly");
          const store = tx.objectStore(STORE_NAME);
          const request = store.getAllKeys();
          request.onsuccess = () => {
            resolve(request.result.map((k) => String(k)));
          };
          request.onerror = () => {
            resolve([]);
          };
        });
      } catch {
        return [];
      }
    }
  };

  // src/adapters/NativeFileAdapter.ts
  init_define_import_meta_env();
  init_Logger();
  var NativeFileAdapter = class _NativeFileAdapter {
    static logger = Logger.get("NativeFileAdapter", "Project_Save_Load");
    name = "NativeFile";
    /** Aktiver FileHandle (Browser-Modus, für "Speichern" ohne erneuten Dialog) */
    currentHandle = null;
    /** Aktiver absoluter Pfad (Electron-Modus, für "Speichern" ohne erneuten Dialog) */
    currentPath = null;
    isAvailable() {
      if ("showSaveFilePicker" in window) return true;
      if (window.electronFS) return true;
      return false;
    }
    async save(project, filename) {
      const json = JSON.stringify(project, null, 2);
      const defaultName = filename || this.generateFilename(project);
      if (window.electronFS) {
        let targetPath = this.currentPath;
        if (!targetPath) {
          targetPath = await window.electronFS.showSaveDialog?.({
            defaultPath: defaultName,
            filters: [{ name: "JSON Project File", extensions: ["json"] }]
          }) ?? null;
        }
        if (!targetPath) return;
        await window.electronFS.writeFile(targetPath, json);
        this.currentPath = targetPath;
        _NativeFileAdapter.logger.info(`Electron: Gespeichert als ${targetPath}`);
        return;
      }
      if (this.currentHandle) {
        try {
          const writable2 = await this.currentHandle.createWritable();
          await writable2.write(json);
          await writable2.close();
          _NativeFileAdapter.logger.info(`Nativ gespeichert: ${this.currentHandle.name}`);
          return;
        } catch (err2) {
          _NativeFileAdapter.logger.warn("Vorheriger FileHandle ung\xFCltig, \xF6ffne Dialog.", err2);
          this.currentHandle = null;
        }
      }
      const handle = await window.showSaveFilePicker({
        suggestedName: defaultName,
        types: [{
          description: "JSON Project File",
          accept: { "application/json": [".json"] }
        }]
      });
      const writable = await handle.createWritable();
      await writable.write(json);
      await writable.close();
      this.currentHandle = handle;
      _NativeFileAdapter.logger.info(`Nativ gespeichert: ${handle.name}`);
    }
    async load(_filename) {
      if (window.electronFS) {
        let targetPath = _filename;
        if (!targetPath) {
          targetPath = await window.electronFS.showOpenDialog?.({
            properties: ["openFile"],
            filters: [{ name: "JSON Project File", extensions: ["json"] }]
          });
        }
        if (!targetPath) return null;
        const content = await window.electronFS.readFile(targetPath);
        this.currentPath = targetPath;
        return JSON.parse(content);
      }
      const [handle] = await window.showOpenFilePicker({
        types: [{
          description: "JSON Project File",
          accept: { "application/json": [".json"] }
        }]
      });
      const file = await handle.getFile();
      const text2 = await file.text();
      this.currentHandle = handle;
      return JSON.parse(text2);
    }
    async list() {
      if (window.electronFS) {
        return window.electronFS.listFiles?.(".", ".json") ?? [];
      }
      return [];
    }
    /** Setzt den aktiven FileHandle (z.B. nach dem Laden eines Projekts) */
    setHandle(handle) {
      this.currentHandle = handle;
    }
    getHandle() {
      return this.currentHandle;
    }
    /** Setzt den aktiven Dateipfad explizit (Electron-Modus) */
    setPath(path) {
      this.currentPath = path;
    }
    getPath() {
      return this.currentPath;
    }
    /**
     * Führt ein "Silent" Save aus, d.h. wenn keine Berechtigung besteht, 
     * öffnet es keinen Dialog, sondern schlägt fehl (wichtig für Background Autosave).
     */
    async autoSave(project) {
      const json = JSON.stringify(project, null, 2);
      if (window.electronFS && this.currentPath) {
        try {
          await window.electronFS.writeFile(this.currentPath, json);
          _NativeFileAdapter.logger.info(`[AutoSave] Electron: Gespeichert in ${this.currentPath}`);
          return true;
        } catch (err2) {
          _NativeFileAdapter.logger.warn(`[AutoSave] Electron failed:`, err2);
          return false;
        }
      }
      if (this.currentHandle) {
        try {
          const perm = await this.currentHandle.queryPermission({ mode: "readwrite" });
          if (perm !== "granted") {
            _NativeFileAdapter.logger.info("[AutoSave] Browser: Schreibberechtigung nicht aktiv, \xFCberspringe.");
            return false;
          }
          const writable = await this.currentHandle.createWritable();
          await writable.write(json);
          await writable.close();
          _NativeFileAdapter.logger.info(`[AutoSave] Browser Nativ: Gespeichert (${this.currentHandle.name})`);
          return true;
        } catch (err2) {
          _NativeFileAdapter.logger.warn("[AutoSave] Browser Nativ fehlgeschlagen (Handle verloren/Rechte fehlen).", err2);
          return false;
        }
      }
      return false;
    }
    generateFilename(project) {
      const name = project.stages?.find((s) => s.type === "main")?.gameName || project.meta?.name || "New Game";
      return `project_${name.replace(/\s+/g, "_")}.json`;
    }
  };

  // src/services/ProjectPersistenceService.ts
  var ProjectPersistenceService = class _ProjectPersistenceService {
    static logger = Logger.get("ProjectPersistenceService", "Project_Save_Load");
    static instance;
    /** Registrierte Adapter in Prioritätsreihenfolge */
    adapters = [];
    /** Autostart-Adapter (IndexedDB für Crash-Schutz, ersetzt LocalStorage wegen 5MB-Limit) */
    autoSaveAdapter = null;
    /** Server-Adapter (für Dev-Modus Persistenz auf Disk) */
    serverAdapter = null;
    /** Nativer File-Adapter (für Save/Load-Dialoge) */
    nativeAdapter = null;
    constructor() {
      this.initAdapters();
    }
    /**
     * Initialisiert die verfügbaren Adapter basierend auf der Umgebung.
     */
    initAdapters() {
      const native = new NativeFileAdapter();
      const server = new ServerStorageAdapter();
      const idb = new IndexedDBAdapter();
      if (native.isAvailable()) {
        this.adapters.push(native);
        this.nativeAdapter = native;
      }
      if (server.isAvailable()) {
        this.adapters.push(server);
        this.serverAdapter = server;
      }
      if (idb.isAvailable()) {
        this.adapters.push(idb);
        this.autoSaveAdapter = idb;
      }
      _ProjectPersistenceService.logger.info(
        `Adapter initialisiert: ${this.adapters.map((a) => a.name).join(", ") || "keine"}`
      );
    }
    /**
     * @deprecated Seit v3.22.0 (CleanCode Phase 2): Nicht mehr nötig, da TComponent.toJSON()
     * an toDTO() delegiert und nur serialisierbare Properties ausgibt.
     * Wird beibehalten für mögliche Drittanbieter-Nutzung.
     */
    static safeReplacer() {
      const seen = /* @__PURE__ */ new WeakSet();
      const SKIP_KEYS = /* @__PURE__ */ new Set(["renderer", "host", "parent", "stage", "editor", "__rawSource", "_listeners", "_eventTarget", "_gridCols", "_gridRows"]);
      return (key, value) => {
        if (SKIP_KEYS.has(key)) return void 0;
        if (typeof value === "object" && value !== null) {
          if (seen.has(value)) return void 0;
          seen.add(value);
        }
        return value;
      };
    }
    /**
     * Fetches the current project.json from the server.
     * Delegiert an ServerStorageAdapter.
     */
    async fetchProjectFromServer() {
      if (this.serverAdapter) {
        const project = await this.serverAdapter.load("./projects/project.json");
        if (project) return project;
      }
      const response = await fetch("./projects/project.json?t=" + Date.now());
      if (!response.ok) {
        throw new Error(`Failed to fetch project from server: ${response.statusText}`);
      }
      return await response.json();
    }
    static getInstance() {
      if (!_ProjectPersistenceService.instance) {
        _ProjectPersistenceService.instance = new _ProjectPersistenceService();
      }
      return _ProjectPersistenceService.instance;
    }
    /** Returns the native file adapter if available */
    getNativeAdapter() {
      return this.nativeAdapter;
    }
    /**
     * Saves the project to a JSON file.
     * Delegiert an NativeFileAdapter (FileSystem Access / Electron).
     * Fallback: Blob-Download im Browser.
     */
    async saveProject(project) {
      const targetProject = project || coreStore.getProject();
      if (!targetProject) {
        _ProjectPersistenceService.logger.error("No project found to save");
        return;
      }
      if (this.nativeAdapter) {
        try {
          await this.nativeAdapter.save(targetProject);
          return;
        } catch (err2) {
          if (err2.name === "AbortError") return;
          _ProjectPersistenceService.logger.warn("NativeFileAdapter failed, using fallback:", err2);
        }
      }
      const json = JSON.stringify(targetProject, null, 2);
      const projName = targetProject.stages?.find((s) => s.type === "main")?.gameName || targetProject.meta.name || "New Game";
      const filename = `project_${projName.replace(/\s+/g, "_")}.json`;
      const blob = new Blob([json], { type: "application/json" });
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      a.style.display = "none";
      document.body.appendChild(a);
      a.click();
      setTimeout(() => document.body.removeChild(a), 2e3);
    }
    /** Flag: LocalStorage-Quota erschöpft → keine weiteren Versuche */
    localStorageQuotaExceeded = false;
    /**
     * Persists the project to browser's LocalStorage.
     * Delegiert an LocalStorageAdapter.
     */
    autoSaveToLocalStorage(project) {
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      if (this.localStorageQuotaExceeded) return;
      let cleanProject;
      try {
        cleanProject = JSON.parse(JSON.stringify(targetProject));
      } catch (e) {
        _ProjectPersistenceService.logger.error("Failed to stringify project for auto-save:", e);
        return;
      }
      if (this.autoSaveAdapter) {
        this.autoSaveAdapter.save(cleanProject).catch((err2) => {
          if (err2?.name === "QuotaExceededError" || err2?.message && err2.message.includes("quota")) {
            this.localStorageQuotaExceeded = true;
            _ProjectPersistenceService.logger.warn(
              "LocalStorage-Quota ersch\xF6pft. Auto-Save in LocalStorage deaktiviert. Bitte speichern Sie das Projekt manuell auf Disk (Strg+S)."
            );
          } else {
            _ProjectPersistenceService.logger.error("Auto-save failed:", err2);
          }
        });
      }
    }
    /**
     * Triggers file input and returns the parsed JSON data along with the filename.
     * Delegiert an NativeFileAdapter für FileSystem Access / Electron.
     */
    async triggerLoad() {
      if (this.nativeAdapter) {
        try {
          const project = await this.nativeAdapter.load();
          if (project) {
            let actualFileName = "loaded_project.json";
            const handle = this.nativeAdapter.getHandle();
            const pathString = this.nativeAdapter.getPath();
            if (handle && handle.name) {
              actualFileName = handle.name;
            } else if (pathString) {
              actualFileName = pathString.replace(/\\/g, "/");
            }
            return { data: project, filename: actualFileName };
          }
        } catch (err2) {
          if (err2.name === "AbortError") return null;
          _ProjectPersistenceService.logger.warn("NativeFileAdapter load failed, fallback to input", err2);
        }
      }
      return new Promise((resolve, reject) => {
        const fileInput = document.createElement("input");
        fileInput.type = "file";
        fileInput.accept = ".json";
        fileInput.style.display = "none";
        const cleanup = () => {
          if (fileInput.parentNode) {
            fileInput.parentNode.removeChild(fileInput);
          }
        };
        fileInput.onchange = (e) => {
          const file = e.target.files?.[0];
          if (!file) {
            cleanup();
            resolve(null);
            return;
          }
          const fileName = file.name;
          const reader = new FileReader();
          reader.onload = (evt) => {
            cleanup();
            try {
              const json = JSON.parse(evt.target?.result);
              resolve({ data: json, filename: fileName });
            } catch (err2) {
              reject(err2);
            }
          };
          reader.onerror = () => {
            cleanup();
            reject(new Error("File reading failed"));
          };
          reader.readAsText(file);
        };
        document.body.appendChild(fileInput);
        fileInput.click();
      });
    }
    /**
     * Speichert das Projekt auf dem Dev-Server (für Auto-Sync).
     * Delegiert an ServerStorageAdapter.
     */
    async saveToServer(project) {
      const targetProject = project || coreStore.getProject();
      if (!targetProject || !this.serverAdapter) return false;
      try {
        await this.serverAdapter.save(targetProject);
        return true;
      } catch (err2) {
        _ProjectPersistenceService.logger.warn("Server save failed:", err2);
        return false;
      }
    }
    // =========================================================================
    // Export-Methoden (Umgestellt auf IExportAdapter)
    // =========================================================================
    async executeExport(adapter, project) {
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      try {
        const blob = await adapter.export(targetProject);
        const projName = targetProject.stages?.find((s) => s.type === "main")?.gameName || targetProject.meta.name || "New Game";
        const filename = `project_${projName.replace(/\s+/g, "_")}${adapter.fileExtension}`;
        if (this.nativeAdapter && window.electronFS) {
          const ext = adapter.fileExtension.substring(1);
          const targetPath = await window.electronFS.showSaveDialog({
            defaultPath: filename,
            filters: [{ name: adapter.formatName, extensions: [ext] }]
          });
          if (!targetPath) return;
          const arrayBuffer = await blob.arrayBuffer();
          await window.electronFS.writeFile(targetPath, new Uint8Array(arrayBuffer));
        } else if ("showSaveFilePicker" in window) {
          const ext = adapter.fileExtension;
          const handle = await window.showSaveFilePicker({
            suggestedName: filename,
            types: [{
              description: adapter.formatName,
              accept: { [blob.type]: [ext] }
            }]
          });
          const writable = await handle.createWritable();
          await writable.write(blob);
          await writable.close();
        } else {
          const url = URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = filename;
          a.style.display = "none";
          document.body.appendChild(a);
          a.click();
          setTimeout(() => document.body.removeChild(a), 2e3);
        }
      } catch (e) {
        if (e.name !== "AbortError") {
          _ProjectPersistenceService.logger.error(`Export (${adapter.formatName}) failed:`, e);
        }
      }
    }
    async exportHTML(project) {
      _ProjectPersistenceService.logger.warn("exportHTML is deprecated. Use executeExport() with an IExportAdapter instead.");
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      const exporter = new GameExporter();
      await exporter.exportHTML(targetProject);
    }
    async exportJSON(project) {
      _ProjectPersistenceService.logger.warn("exportJSON is deprecated. Use executeExport() with an IExportAdapter instead.");
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      const exporter = new GameExporter();
      await exporter.exportJSON(targetProject);
    }
    async exportHTMLCompressed(project) {
      _ProjectPersistenceService.logger.warn("exportHTMLCompressed is deprecated.");
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      const exporter = new GameExporter();
      await exporter.exportHTMLCompressed(targetProject);
    }
    async exportJSONCompressed(project) {
      _ProjectPersistenceService.logger.warn("exportJSONCompressed is deprecated.");
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      const exporter = new GameExporter();
      await exporter.exportJSONCompressed(targetProject);
    }
    async exportCmsBundle(project) {
      const targetProject = project || coreStore.getProject();
      if (!targetProject) return;
      const exporter = new GameExporter();
      await exporter.exportCmsBundle(targetProject);
    }
  };
  var projectPersistenceService = ProjectPersistenceService.getInstance();

  // scripts/math-phase1/browser-persistence-entry.ts
  globalThis.mathProbePersistence = { save: (project) => projectPersistenceService.saveProject(project) };
})();
/*! Bundled license information:

dompurify/dist/purify.es.mjs:
  (*! @license DOMPurify 3.4.9 | (c) Cure53 and other contributors | Released under the Apache license 2.0 and Mozilla Public License 2.0 | github.com/cure53/DOMPurify/blob/3.4.9/LICENSE *)
*/
