var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
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
var __toCommonJS = (mod) => __copyProps(__defProp({}, "__esModule", { value: true }), mod);
var __publicField = (obj, key, value) => __defNormalProp(obj, typeof key !== "symbol" ? key + "" : key, value);
var stdin_exports = {};
__export(stdin_exports, {
  PiperSpeechEngine: () => PiperSpeechEngine
});
module.exports = __toCommonJS(stdin_exports);
var import_child_process = require("child_process");
var import_SpeechCache = require("./SpeechCache.cjs");
class PiperSpeechEngine {
  constructor(version, url, voices, ffmpeg = "ffmpeg", synthesisPath = "/") {
    __publicField(this, "version", version);
    __publicField(this, "url", url);
    __publicField(this, "voices", voices);
    __publicField(this, "ffmpeg", ffmpeg);
    __publicField(this, "synthesisPath", synthesisPath);
    __publicField(this, "baseVersion");
    this.baseVersion = version;
    this.version += ":" + JSON.stringify(Object.entries(voices).sort());
  }
  cacheVersion(voice) {
    return this.baseVersion + ":" + this.voices[voice];
  }
  legacyVersions(voice) {
    return voice === "default" && this.voices[voice] === "de_DE-thorsten-medium" ? [this.baseVersion + ':[["default","de_DE-thorsten-medium"]]'] : [];
  }
  async synthesize(text, voice) {
    const model = this.voices[voice];
    if (!model) throw new import_SpeechCache.SpeechError("Unbekannte Stimmen-ID.", 400);
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 3e4);
    let wav;
    try {
      const inventory = await fetch(this.url.replace(/\/$/, "") + "/voices", { signal: controller.signal });
      if (!inventory.ok || !Object.prototype.hasOwnProperty.call(await inventory.json(), model)) {
        throw new import_SpeechCache.SpeechError("Gew\xE4hlte Stimme ist nicht installiert.", 503);
      }
      const response = await fetch(this.url.replace(/\/$/, "") + this.synthesisPath, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text, voice: model, length_scale: 1 }),
        signal: controller.signal
      });
      if (!response.ok || !response.body) throw new import_SpeechCache.SpeechError("Piper konnte keine Sprache erzeugen.");
      const chunks = [];
      let bytes = 0;
      for await (const chunk of response.body) {
        bytes += chunk.length;
        if (bytes > 16 * 1024 ** 2) {
          controller.abort();
          throw new import_SpeechCache.SpeechError("Piper-Audio zu gro\xDF.");
        }
        chunks.push(Buffer.from(chunk));
      }
      wav = Buffer.concat(chunks);
      if (wav.toString("ascii", 0, 4) !== "RIFF" || wav.toString("ascii", 8, 12) !== "WAVE") {
        throw new import_SpeechCache.SpeechError("Ung\xFCltiges Audio von Piper.");
      }
    } catch (error) {
      if (error instanceof import_SpeechCache.SpeechError) throw error;
      throw new import_SpeechCache.SpeechError("Piper nicht erreichbar oder Zeitlimit \xFCberschritten.");
    } finally {
      clearTimeout(timer);
    }
    return new Promise((resolve, reject) => {
      const process = (0, import_child_process.spawn)(this.ffmpeg, [
        "-hide_banner",
        "-loglevel",
        "error",
        "-i",
        "pipe:0",
        "-f",
        "mp3",
        "-ac",
        "1",
        "-b:a",
        "48k",
        "pipe:1"
      ], { windowsHide: true });
      const chunks = [];
      let bytes = 0;
      const timeout = setTimeout(() => {
        process.kill();
        reject(new import_SpeechCache.SpeechError("Audiokompression zu langsam."));
      }, 15e3);
      process.stdout.on("data", (chunk) => {
        bytes += chunk.length;
        if (bytes > 4 * 1024 ** 2) {
          process.kill();
          reject(new import_SpeechCache.SpeechError("Komprimiertes Audio zu gro\xDF."));
        } else chunks.push(chunk);
      });
      process.stderr.resume();
      process.stdin.on("error", () => {
      });
      process.on("error", () => {
        clearTimeout(timeout);
        reject(new import_SpeechCache.SpeechError("FFmpeg fehlt oder kann nicht gestartet werden."));
      });
      process.on("close", (code) => {
        clearTimeout(timeout);
        if (code === 0 && bytes) resolve(Buffer.concat(chunks));
        else reject(new import_SpeechCache.SpeechError("Audiokompression fehlgeschlagen."));
      });
      process.stdin.end(wav);
    });
  }
}
