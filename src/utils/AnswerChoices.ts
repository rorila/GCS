import { checkCardAnswer, normalizeSpokenNumber } from './SpokenNumber';

/** One correct choice, two distinct distractors; accepted answer variants are never distractors. */
export function createAnswerChoices(input: any, random: () => number = Math.random) {
    const card = input?.value && !input.answers ? input.value : input;
    const answers = Array.isArray(card?.answers) ? card.answers.map((v: unknown) => String(v).trim()).filter(Boolean) : [];
    const solution = answers[0] || '';
    const wrong: string[] = [];
    const key = (text: string) => normalizeSpokenNumber(text) ?? text;
    const add = (value: unknown) => {
        const text = String(value ?? '').trim();
        if (!text || wrong.length === 2 || checkCardAnswer(text, answers).correct || answers.some((v: string) => key(v) === key(text)) || wrong.some(v => key(v) === key(text))) return;
        wrong.push(text);
    };
    if (solution) {
        for (const value of Array.isArray(card.wrongAnswers) ? card.wrongAnswers : []) add(value);
        // Generate alternatives only for plain numeric solutions, never parseInt arbitrary text.
        if (/^[+-]?\d+(?:[.,]\d+)?$/.test(solution)) {
            const value = Number(solution.replace(',', '.'));
            const decimals = Math.min(6, (solution.split(/[.,]/)[1] || '').length);
            const unit = 10 ** -decimals;
            for (const offset of [-2, 4, 2, -4, 1, -1, 3, -3, 5, -5]) {
                const candidate = Number((value + offset * unit).toFixed(decimals));
                if (Number.isFinite(candidate) && (value < 0 || candidate >= 0)) add(String(candidate).replace('.', solution.includes(',') ? ',' : '.'));
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
