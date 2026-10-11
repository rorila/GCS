var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __defNormalProp = (obj, key, value) => key in obj ? __defProp(obj, key, { enumerable: true, configurable: true, writable: true, value }) : obj[key] = value;
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
var stdin_exports = {};
__export(stdin_exports, {
  SpeechCache: () => SpeechCache,
  SpeechError: () => SpeechError
});
module.exports = __toCommonJS(stdin_exports);
var import_fs = require("fs");
var import_path = __toESM(require("path"));
var import_crypto = require("crypto");
class SpeechError extends Error {
  constructor(message, status = 503) {
    super(message);
    __publicField(this, "status", status);
  }
}
class SpeechCache {
  constructor(directory, engine, maxBytes = 5 * 1024 ** 3, maxQueue = 32, protectedKeys = /* @__PURE__ */ new Set()) {
    __publicField(this, "directory", directory);
    __publicField(this, "engine", engine);
    __publicField(this, "maxBytes", maxBytes);
    __publicField(this, "maxQueue", maxQueue);
    __publicField(this, "protectedKeys", protectedKeys);
    __publicField(this, "entries", /* @__PURE__ */ new Map());
    __publicField(this, "metadata", /* @__PURE__ */ new Map());
    __publicField(this, "pending", /* @__PURE__ */ new Map());
    __publicField(this, "tail", Promise.resolve());
    __publicField(this, "initialized");
    __publicField(this, "bytes", 0);
    __publicField(this, "metrics", { hits: 0, misses: 0, failures: 0, synthesisMs: 0 });
    if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error("Ung\xFCltiges TTS-Cache-Limit");
  }
  init() {
    return this.initialized ?? (this.initialized = (async () => {
      await import_fs.promises.mkdir(this.directory, { recursive: true });
      for (const name of await import_fs.promises.readdir(this.directory)) {
        if (!/^[a-f0-9]{64}\.mp3$/.test(name)) continue;
        const stat = await import_fs.promises.stat(import_path.default.join(this.directory, name));
        this.entries.set(name.slice(0, -4), { bytes: stat.size, accessed: stat.mtimeMs });
        this.bytes += stat.size;
        try {
          const meta = JSON.parse(await import_fs.promises.readFile(import_path.default.join(this.directory, name.slice(0, -4) + ".json"), "utf8"));
          if (typeof meta.text === "string" && typeof meta.voice === "string" && typeof meta.engine === "string" && this.keyFor(meta.text, meta.voice, meta.engine) === name.slice(0, -4)) this.metadata.set(name.slice(0, -4), meta);
        } catch {
        }
      }
      await this.evict(0);
    })());
  }
  async evict(extra, keepKey) {
    for (const [key, entry] of [...this.entries].sort((a, b) => a[1].accessed - b[1].accessed)) {
      if (this.bytes + extra <= this.maxBytes) break;
      if (this.protectedKeys.has(key) || key === keepKey) continue;
      await import_fs.promises.unlink(import_path.default.join(this.directory, key + ".mp3"));
      this.entries.delete(key);
      this.bytes -= entry.bytes;
      this.metadata.delete(key);
      await import_fs.promises.unlink(import_path.default.join(this.directory, key + ".json")).catch(() => {
      });
    }
    if (this.bytes + extra > this.maxBytes) throw new SpeechError("Gesch\xFCtzter Sprachcache belegt das Speicherlimit.", 507);
  }
  keyFor(text, voice, engine = this.engine.cacheVersion?.(voice) || this.engine.version) {
    return (0, import_crypto.createHash)("sha256").update(JSON.stringify({
      text: text.normalize("NFC").replace(/\s+/g, " ").trim(),
      voice,
      engine,
      format: "mp3-48k-mono-v1"
    })).digest("hex");
  }
  async remember(key, text, voice, engine) {
    if (this.metadata.has(key)) return;
    const meta = { text, voice, engine, createdAt: (/* @__PURE__ */ new Date()).toISOString() };
    const temporary = import_path.default.join(this.directory, key + "." + (0, import_crypto.randomUUID)() + ".json.tmp");
    try {
      await import_fs.promises.writeFile(temporary, JSON.stringify(meta), { flag: "wx" });
      await import_fs.promises.rename(temporary, import_path.default.join(this.directory, key + ".json"));
      this.metadata.set(key, meta);
    } finally {
      await import_fs.promises.unlink(temporary).catch(() => {
      });
    }
  }
  async recover(texts, voices, versions = []) {
    await this.init();
    let recovered = 0;
    for (const text of new Set(texts)) for (const voice of voices) {
      for (const version of /* @__PURE__ */ new Set([this.engine.cacheVersion?.(voice) || this.engine.version, this.engine.version, ...versions])) {
        const key = this.keyFor(text, voice, version);
        if (this.entries.has(key) && !this.metadata.has(key)) {
          await this.remember(key, text.normalize("NFC").replace(/\s+/g, " ").trim(), voice, version);
          recovered++;
        }
      }
    }
    return recovered;
  }
  async list() {
    await this.init();
    return [...this.entries].map(([key, entry]) => ({
      key,
      bytes: entry.bytes,
      lastUsedAt: new Date(entry.accessed).toISOString(),
      ...this.metadata.get(key),
      assigned: this.metadata.has(key)
    }));
  }
  async read(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new SpeechError("Ung\xFCltiger Audio-Schl\xFCssel.", 400);
    await this.touch(key);
    return import_fs.promises.readFile(import_path.default.join(this.directory, key + ".mp3"));
  }
  async retire(key) {
    if (!/^[a-f0-9]{64}$/.test(key)) throw new SpeechError("Ung\xFCltiger Audio-Schl\xFCssel.", 400);
    await this.init();
    const entry = this.entries.get(key);
    if (!entry) return;
    if (this.protectedKeys.has(key)) throw new SpeechError("Dieses Audio ist gesch\xFCtzt.", 409);
    await import_fs.promises.unlink(import_path.default.join(this.directory, key + ".mp3"));
    this.entries.delete(key);
    this.metadata.delete(key);
    this.bytes -= entry.bytes;
    await import_fs.promises.unlink(import_path.default.join(this.directory, key + ".json")).catch(() => {
    });
  }
  async get(text, voice, regenerate = false) {
    await this.init();
    const normalized = text.normalize("NFC").replace(/\s+/g, " ").trim();
    if (!normalized || normalized.length > 500) throw new SpeechError("Sprechtext muss 1\u2013500 Zeichen enthalten.", 400);
    const version = this.engine.cacheVersion?.(voice) || this.engine.version;
    let key = this.keyFor(normalized, voice, version);
    if (!regenerate && !this.entries.has(key)) {
      for (const legacy of [this.engine.version, ...this.engine.legacyVersions?.(voice) || []]) {
        const oldKey = this.keyFor(normalized, voice, legacy);
        if (this.entries.has(oldKey)) {
          await this.remember(oldKey, normalized, voice, legacy);
          key = oldKey;
          break;
        }
      }
    }
    if (this.entries.has(key) && !regenerate) {
      await this.remember(key, normalized, voice, version);
      await this.touch(key);
      this.metrics.hits++;
      return { key, cached: true };
    }
    const existing = this.pending.get(key);
    if (existing) {
      await existing;
      return { key, cached: true };
    }
    if (this.pending.size >= this.maxQueue) throw new SpeechError("Sprachserver ausgelastet. Bitte erneut versuchen.", 429);
    this.metrics.misses++;
    const job = this.tail.then(async () => {
      const started = Date.now();
      const temporary = import_path.default.join(this.directory, key + "." + (0, import_crypto.randomUUID)() + ".tmp");
      try {
        const audio = await this.engine.synthesize(normalized, voice);
        if (!audio.length || audio.length > this.maxBytes) throw new SpeechError("Audio \xFCberschreitet das Cache-Limit.", 507);
        const previousBytes = this.entries.get(key)?.bytes || 0;
        await this.evict(Math.max(0, audio.length - previousBytes), key);
        await import_fs.promises.writeFile(temporary, audio, { flag: "wx" });
        await import_fs.promises.rename(temporary, import_path.default.join(this.directory, key + ".mp3"));
        this.entries.set(key, { bytes: audio.length, accessed: Date.now() });
        this.bytes += audio.length - previousBytes;
        await this.remember(key, normalized, voice, version);
        this.metrics.synthesisMs += Date.now() - started;
        return key;
      } catch (error) {
        this.metrics.failures++;
        throw error;
      } finally {
        await import_fs.promises.unlink(temporary).catch(() => {
        });
        this.pending.delete(key);
      }
    });
    this.pending.set(key, job);
    this.tail = job.catch(() => {
    });
    await job;
    return { key, cached: false };
  }
  async touch(key) {
    await this.init();
    const entry = this.entries.get(key);
    if (!entry) throw new SpeechError("Audio nicht vorhanden. Bitte erneut anfordern.", 404);
    entry.accessed = Date.now();
    const now = /* @__PURE__ */ new Date();
    await import_fs.promises.utimes(import_path.default.join(this.directory, key + ".mp3"), now, now).catch(() => {
    });
  }
  async stats() {
    await this.init();
    return {
      ...this.metrics,
      bytes: this.bytes,
      files: this.entries.size,
      queued: this.pending.size,
      maxBytes: this.maxBytes
    };
  }
}
