"use strict";
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __hasOwnProp = Object.prototype.hasOwnProperty;
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

// src/math/MathCore.ts
var MathCore_exports = {};
__export(MathCore_exports, {
  adaptMultiplicationDeck: () => adaptMultiplicationDeck,
  curriculumSource: () => curriculumSource,
  generateMathTasks: () => generateMathTasks,
  getProfile: () => getProfile,
  normalizeSpokenNumber: () => normalizeSpokenNumber,
  profiles: () => profiles,
  validateMathTask: () => validateMathTask
});
module.exports = __toCommonJS(MathCore_exports);

// src/utils/SpokenNumber.ts
var units = ["null", "eins", "zwei", "drei", "vier", "fuenf", "sechs", "sieben", "acht", "neun"];
var words = new Map(units.map((word, value) => [word, value]));
words.set("ein", 1);
words.set("zwo", 2);
["zehn", "elf", "zwoelf", "dreizehn", "vierzehn", "fuenfzehn", "sechzehn", "siebzehn", "achtzehn", "neunzehn"].forEach((word, i) => words.set(word, i + 10));
var tens = ["", "", "zwanzig", "dreissig", "vierzig", "fuenfzig", "sechzig", "siebzig", "achtzig", "neunzig"];
var mishearings = /* @__PURE__ */ new Map([
  ["einst", 1],
  ["heinz", 1],
  ["frei", 3],
  ["fuer", 4],
  ["fier", 4],
  ["fuenfe", 5],
  ["sex", 6],
  ["sechse", 6],
  ["siebens", 7],
  ["nacht", 8],
  ["nein", 9],
  ["neue", 9],
  ["zahn", 10],
  ["zehnt", 10],
  ["zwoelfe", 12]
]);
for (let t = 2; t < 10; t++) {
  words.set(tens[t], t * 10);
  for (let u = 1; u < 10; u++) words.set((u === 1 ? "ein" : units[u]) + "und" + tens[t], t * 10 + u);
}
function integer(word) {
  if (words.has(word)) return words.get(word);
  for (const [unit, scale] of [["tausend", 1e3], ["hundert", 100]]) {
    const parts = word.split(unit);
    if (parts.length !== 2) continue;
    const head = parts[0] ? integer(parts[0]) : 1;
    const tail = parts[1] ? integer(parts[1]) : 0;
    if (head !== null && head > 0 && head < (scale === 100 ? 10 : 1e3) && tail !== null && tail < scale) return head * scale + tail;
  }
  return null;
}
function normalizeSpokenNumber(value) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || value.length > 160) return null;
  let text = value.trim().toLowerCase().replace(/[.!?]+$/, "").trim();
  if (/^[+-]?\d+(?:[.,]\d+)?$/.test(text)) {
    const number = Number(text.replace(",", "."));
    return Number.isSafeInteger(number) || Number.isFinite(number) && Math.abs(number) < 1e12 ? number : null;
  }
  text = text.replace(/ä/g, "ae").replace(/ö/g, "oe").replace(/ü/g, "ue").replace(/ß/g, "ss");
  let sign = 1;
  if (text.startsWith("minus ")) {
    sign = -1;
    text = text.slice(6);
  }
  if (!text.includes(" ") && mishearings.has(text)) return sign * mishearings.get(text);
  const parts = text.split("komma");
  if (parts.length > 2 || !/^[a-z\s]+$/.test(text)) return null;
  const whole = integer(parts[0].replace(/\s+/g, ""));
  if (whole === null) return null;
  if (parts.length === 1) return sign * whole;
  const digits = parts[1].trim().split(/\s+/).map((word) => units.indexOf(word));
  if (!digits.length || digits.length > 6 || digits.some((digit) => digit < 0)) return null;
  return sign * (whole + Number("0." + digits.join("")));
}

// src/math/MathCore.ts
var curriculumSource = { url: "https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/2/mathematik", section: "M1/2 1.2", retrievedAt: "2026-10-15", officialVersion: null, origin: "derived", reviewStatus: "technical-example-needs-pedagogical-review" };
var profiles = [
  { id: "multiplication-gap-deck-v1", version: 1, objectiveId: "by.gs.math.12.multiplication.missing-factor", operation: "multiplication-gap", crossingTen: "none", maxResult: 100 },
  { id: "add-to100-cross-ten-v1", version: 1, objectiveId: "by.gs.math.12.addition.bridge-ten.to100", operation: "addition", crossingTen: "required", maxResult: 100 },
  { id: "sub-to100-cross-ten-v1", version: 1, objectiveId: "by.gs.math.12.subtraction.bridge-ten.to100", operation: "subtraction", crossingTen: "required", maxResult: 100 },
  { id: "add-to100-no-cross-v1", version: 1, objectiveId: "by.gs.math.12.addition.no-cross.to100", operation: "addition", crossingTen: "none", maxResult: 100 },
  { id: "sub-to100-no-cross-v1", version: 1, objectiveId: "by.gs.math.12.subtraction.no-cross.to100", operation: "subtraction", crossingTen: "none", maxResult: 100 }
];
function getProfile(id) {
  const p = profiles.find((p2) => p2.id === id);
  if (!p) throw Error("Unbekanntes Aufgabenprofil.");
  return p;
}
function random(seed) {
  let state = 2166136261;
  for (const c of seed) state = Math.imul(state ^ c.charCodeAt(0), 16777619);
  state = state >>> 0 || 1;
  return () => {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    return (state >>> 0) / 4294967296;
  };
}
function shuffle(items, rng) {
  const a = [...items];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}
function validateMathTask(task) {
  if (task.profileId === "multiplication-gap-deck-v1") {
    const match = /^(\?|\d+) × (\?|\d+) = (\d+)$/.exec(task.prompt);
    if (!match || task.operation !== "multiplication-gap" || task.generatorVersion !== 1 || match[1] === "?" === (match[2] === "?")) throw Error("Ung\xFCltige Einmaleins-L\xFCcke.");
    const fixed = Number(match[1] === "?" ? match[2] : match[1]), product = Number(match[3]);
    if (!Number.isInteger(task.solution) || fixed < 1 || fixed > 10 || task.solution < 1 || task.solution > 10 || fixed * task.solution !== product || task.left !== fixed || task.right !== product || task.choices.length !== 3 || new Set(task.choices).size !== 3 || !task.choices.includes(task.solution) || task.choices.some((v) => !Number.isInteger(v) || v < 1 || v > 10) || JSON.stringify(task.steps) !== JSON.stringify([`${fixed} \xD7 ${task.solution} = ${product}`])) throw Error("Ung\xFCltige Einmaleins-Antwort.");
    return true;
  }
  const p = getProfile(task.profileId), solution = task.operation === "addition" ? task.left + task.right : task.left - task.right;
  if (task.generatorVersion !== 1 || task.operation !== p.operation || !Number.isInteger(task.left) || !Number.isInteger(task.right) || task.left < 1 || task.left > 99 || task.right < 1 || task.right > 9 || solution < 0 || solution > 100 || task.solution !== solution) throw Error("Ung\xFCltige Mathematikaufgabe.");
  const cross = p.operation === "addition" ? task.left % 10 + task.right > 10 : task.right > task.left % 10;
  if (p.crossingTen === "required" !== cross || p.crossingTen === "required" && task.left % 10 === 0) throw Error("Zehnerregel verletzt.");
  if (task.choices.length !== 3 || new Set(task.choices).size !== 3 || task.choices.filter((v) => v === solution).length !== 1 || task.choices.some((v) => !Number.isInteger(v) || v < 0 || v > 100)) throw Error("Ung\xFCltige Antwortauswahl.");
  if (!Array.isArray(task.steps) || task.steps.length < 1 || task.steps.length > 2) throw Error("L\xF6sungsweg fehlt.");
  let previous = task.left, total = 0;
  for (const step of task.steps) {
    const match = /^(\d+) ([+−-]) (\d+) = (\d+)$/.exec(step);
    if (!match || Number(match[1]) !== previous || match[2] === "+" !== (task.operation === "addition") || Number(match[4]) !== (match[2] === "+" ? Number(match[1]) + Number(match[3]) : Number(match[1]) - Number(match[3]))) throw Error("Ung\xFCltiger L\xF6sungsweg.");
    previous = Number(match[4]);
    total += Number(match[3]);
  }
  if (previous !== solution || total !== task.right) throw Error("L\xF6sungsweg geh\xF6rt nicht zur Aufgabe.");
  return true;
}
function generateMathTasks(profileId, seed, count = 10) {
  if (profileId === "multiplication-gap-deck-v1") throw Error("Dieses Profil ben\xF6tigt einen Kartenstapel.");
  const p = getProfile(profileId);
  if (typeof seed !== "string" || !seed || seed.length > 128 || !Number.isInteger(count) || count < 1 || count > 20) throw Error("Seed oder Aufgabenanzahl ung\xFCltig.");
  const pool = [];
  for (let a = 1; a <= 99; a++) for (let b = 1; b <= 9; b++) {
    const result = p.operation === "addition" ? a + b : a - b, cross = p.operation === "addition" ? a % 10 + b > 10 : b > a % 10;
    if (result >= 0 && result <= 100 && cross === (p.crossingTen === "required") && (p.crossingTen !== "required" || a % 10 !== 0)) pool.push({ a, b });
  }
  if (pool.length < count) throw Error("Zu wenige unterschiedliche Aufgaben f\xFCr dieses Profil.");
  const rng = random(`${profileId}|v1|${seed}`);
  return shuffle(pool, rng).slice(0, count).map(({ a, b }, i) => {
    const add = p.operation === "addition", solution = add ? a + b : a - b, symbol = add ? "+" : "\u2212", wrong = [];
    for (const v of [solution + (add ? -10 : 10), solution - 1, solution + 1, solution + 2, solution - 2]) if (v >= 0 && v <= 100 && v !== solution && !wrong.includes(v) && wrong.length < 2) wrong.push(v);
    const bridge = add ? 10 - a % 10 : a % 10, ten = add ? a + bridge : a - bridge, rest = b - bridge, cross = p.crossingTen === "required";
    const task = { id: `task-${i}`, contentKey: `${p.operation}:${a}:${b}:result`, profileId, generatorVersion: 1, left: a, right: b, operation: p.operation, prompt: `${a} ${symbol} ${b} = ?`, solution, choices: shuffle([solution, ...wrong], rng), hint: cross ? add ? `Wie viel fehlt von ${a} bis ${ten}? Zerlege ${b} passend.` : `Rechne zuerst von ${a} zur\xFCck bis ${ten}. Zerlege ${b} passend.` : `Gehe von ${a} genau ${b} Schritte ${add ? "vorw\xE4rts" : "zur\xFCck"}.`, steps: cross ? [`${a} ${symbol} ${bridge} = ${ten}`, `${ten} ${symbol} ${rest} = ${solution}`] : [`${a} ${symbol} ${b} = ${solution}`] };
    validateMathTask(task);
    return task;
  });
}
function adaptMultiplicationDeck(cards, seed) {
  if (cards.length !== 10 || !seed || seed.length > 128) throw Error("Ein geeigneter Stapel ben\xF6tigt genau zehn Karten.");
  const rng = random(seed), seen = /* @__PURE__ */ new Set();
  return shuffle(cards, rng).map((card, i) => {
    const prompt = String(card.question).trim().replace(/[xX*·]/g, "\xD7").replace(/\s*×\s*/g, " \xD7 ").replace(/\s*=\s*/g, " = ");
    const match = /^(\?|\d+) × (\?|\d+) = (\d+)$/.exec(prompt);
    if (!match || match[1] === "?" === (match[2] === "?") || card.answers.length !== 1 || !/^\d+$/.test(card.answers[0])) throw Error("Stapel enth\xE4lt keine eindeutige Einmaleins-L\xFCcke.");
    const fixed = Number(match[1] === "?" ? match[2] : match[1]), product = Number(match[3]), solution = Number(card.answers[0]);
    if (seen.has(prompt)) throw Error("Doppelte Aufgabe im Stapel.");
    seen.add(prompt);
    const supplied = (card.wrongAnswers || []).map((v) => /^\d+$/.test(v) ? Number(v) : NaN);
    if (supplied.some((v) => !Number.isInteger(v) || v < 1 || v > 10 || v === solution)) throw Error("Ung\xFCltige falsche Antwort im Stapel.");
    const wrong = [...new Set([...supplied, solution - 1, solution + 1, solution - 2, solution + 2].filter((v) => v >= 1 && v <= 10 && v !== solution))].slice(0, 2);
    const task = { id: `deck-task-${i}`, contentKey: prompt, profileId: "multiplication-gap-deck-v1", generatorVersion: 1, operation: "multiplication-gap", left: fixed, right: product, prompt, solution, choices: shuffle([solution, ...wrong], rng), hint: `Welche Zahl ergibt mal ${fixed} die Zahl ${product}? Denke an die ${fixed}er-Reihe.`, steps: [`${fixed} \xD7 ${solution} = ${product}`], sourceCardId: card.id };
    validateMathTask(task);
    return task;
  });
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  adaptMultiplicationDeck,
  curriculumSource,
  generateMathTasks,
  getProfile,
  normalizeSpokenNumber,
  profiles,
  validateMathTask
});
