type ContentMode = 'innerText' | 'textContent' | 'innerHTML';
const sources = new WeakMap<HTMLElement, { mode: ContentMode; value: string }>();

/** Compare source values, so browser translations survive unchanged runtime renders. */
export function setRenderedContent(
    element: HTMLElement, value: unknown, mode: ContentMode, preserveTranslation: boolean
): void {
    const source = String(value ?? '');
    const previous = sources.get(element);
    if (preserveTranslation && previous?.mode === mode && previous.value === source) return;
    if (element[mode] !== source) element[mode] = source;
    sources.set(element, { mode, value: source });
}
