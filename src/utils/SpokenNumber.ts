const units = ['null', 'eins', 'zwei', 'drei', 'vier', 'fuenf', 'sechs', 'sieben', 'acht', 'neun'];
const words = new Map<string, number>(units.map((word, value) => [word, value]));
words.set('ein', 1);
words.set('zwo', 2);
['zehn', 'elf', 'zwoelf', 'dreizehn', 'vierzehn', 'fuenfzehn', 'sechzehn', 'siebzehn', 'achtzehn', 'neunzehn'].forEach((word, i) => words.set(word, i + 10));
const tens = ['', '', 'zwanzig', 'dreissig', 'vierzig', 'fuenfzig', 'sechzig', 'siebzig', 'achtzig', 'neunzig'];
// Typische Verhörer bei isoliert gesprochenen Zahlwoertern (Kindstimmen, kurze Clips).
const mishearings = new Map<string, number>([
    ['einst', 1], ['heinz', 1],
    ['frei', 3],
    ['fuer', 4], ['fier', 4],
    ['fuenfe', 5],
    ['sex', 6], ['sechse', 6],
    ['siebens', 7],
    ['nacht', 8],
    ['nein', 9], ['neue', 9],
    ['zahn', 10], ['zehnt', 10],
    ['zwoelfe', 12],
]);
for (let t = 2; t < 10; t++) {
    words.set(tens[t], t * 10);
    for (let u = 1; u < 10; u++) words.set((u === 1 ? 'ein' : units[u]) + 'und' + tens[t], t * 10 + u);
}
function integer(word: string): number | null {
    if (words.has(word)) return words.get(word)!;
    for (const [unit, scale] of [['tausend', 1000], ['hundert', 100]] as const) {
        const parts = word.split(unit);
        if (parts.length !== 2) continue;
        const head = parts[0] ? integer(parts[0]) : 1;
        const tail = parts[1] ? integer(parts[1]) : 0;
        if (head !== null && head > 0 && head < (scale === 100 ? 10 : 1000) && tail !== null && tail < scale) return head * scale + tail;
    }
    return null;
}
export function normalizeSpokenNumber(value: unknown): number | null {
    if (typeof value === 'number') return Number.isFinite(value) ? value : null;
    if (typeof value !== 'string' || value.length > 160) return null;
    let text = value.trim().toLowerCase().replace(/[.!?]+$/, '').trim();
    if (/^[+-]?\d+(?:[.,]\d+)?$/.test(text)) {
        const number = Number(text.replace(',', '.'));
        return Number.isSafeInteger(number) || (Number.isFinite(number) && Math.abs(number) < 1e12) ? number : null;
    }
    text = text.replace(/ä/g, 'ae').replace(/ö/g, 'oe').replace(/ü/g, 'ue').replace(/ß/g, 'ss');
    let sign = 1;
    if (text.startsWith('minus ')) { sign = -1; text = text.slice(6); }
    if (!text.includes(' ') && mishearings.has(text)) return sign * mishearings.get(text)!;
    const parts = text.split('komma');
    if (parts.length > 2 || !/^[a-z\s]+$/.test(text)) return null;
    const whole = integer(parts[0].replace(/\s+/g, ''));
    if (whole === null) return null;
    if (parts.length === 1) return sign * whole;
    const digits = parts[1].trim().split(/\s+/).map(word => units.indexOf(word));
    if (!digits.length || digits.length > 6 || digits.some(digit => digit < 0)) return null;
    return sign * (whole + Number('0.' + digits.join('')));
}
export function checkNumberAnswer(input: unknown, answers: unknown): { valid: boolean; correct: boolean; solution: string } {
    const actual = normalizeSpokenNumber(input);
    const list = Array.isArray(answers) ? answers : [];
    const expected = list.map(normalizeSpokenNumber).filter((n): n is number => n !== null);
    return { valid: actual !== null && expected.length > 0, correct: actual !== null && expected.includes(actual), solution: String(list[0] ?? '') };
}
