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

// src/utils/AnswerChoices.ts
var AnswerChoices_exports = {};
__export(AnswerChoices_exports, {
  createAnswerChoices: () => createAnswerChoices
});
module.exports = __toCommonJS(AnswerChoices_exports);

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
function checkNumberAnswer(input, answers) {
  const actual = normalizeSpokenNumber(input);
  const list = Array.isArray(answers) ? answers : [];
  const expected = list.map(normalizeSpokenNumber).filter((n) => n !== null);
  return { valid: actual !== null && expected.length > 0, correct: actual !== null && expected.includes(actual), solution: String(list[0] ?? "") };
}
function checkCardAnswer(input, answers) {
  const list = Array.isArray(answers) ? answers : [];
  if (list.length && list.every((answer) => normalizeSpokenNumber(answer) !== null)) return checkNumberAnswer(input, list);
  const text = typeof input === "string" ? input.trim() : "";
  return { valid: !!text && list.length > 0, correct: list.some((answer) => String(answer).trim() === text), solution: String(list[0] ?? "") };
}

// src/utils/AnswerChoices.ts
function createAnswerChoices(input, random = Math.random) {
  const card = input?.value && !input.answers ? input.value : input;
  const answers = Array.isArray(card?.answers) ? card.answers.map((v) => String(v).trim()).filter(Boolean) : [];
  const solution = answers[0] || "";
  const wrong = [];
  const key = (text) => normalizeSpokenNumber(text) ?? text;
  const add = (value) => {
    const text = String(value ?? "").trim();
    if (!text || wrong.length === 2 || checkCardAnswer(text, answers).correct || answers.some((v) => key(v) === key(text)) || wrong.some((v) => key(v) === key(text))) return;
    wrong.push(text);
  };
  if (solution) {
    for (const value of Array.isArray(card.wrongAnswers) ? card.wrongAnswers : []) add(value);
    if (/^[+-]?\d+(?:[.,]\d+)?$/.test(solution)) {
      const value = Number(solution.replace(",", "."));
      const decimals = Math.min(6, (solution.split(/[.,]/)[1] || "").length);
      const unit = 10 ** -decimals;
      for (const offset of [-2, 4, 2, -4, 1, -1, 3, -3, 5, -5]) {
        const candidate = Number((value + offset * unit).toFixed(decimals));
        if (Number.isFinite(candidate) && (value < 0 || candidate >= 0)) add(String(candidate).replace(".", solution.includes(",") ? "," : "."));
      }
    }
  }
  const options = solution && wrong.length === 2 ? [solution, ...wrong] : [];
  for (let i = options.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.max(0, Math.floor(random() * (i + 1))));
    [options[i], options[j]] = [options[j], options[i]];
  }
  return { valid: options.length === 3, solution, options };
}
// Annotate the CommonJS export names for ESM import in node:
0 && (module.exports = {
  createAnswerChoices
});
