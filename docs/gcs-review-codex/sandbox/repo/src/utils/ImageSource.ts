/** Keep bundle-relative paths relative to the document's base URL. */
export function normalizeImageSource(raw: string): string {
    if (!raw) return '';
    if (raw.startsWith('/images/') || raw.startsWith('/audio/')) return '.' + raw;
    if (/^(?:https?:|data:|blob:)/i.test(raw) || raw.startsWith('/') || raw.startsWith('.')) return raw;
    if (raw.startsWith('images/') || raw.startsWith('assets/')) return './' + raw;
    return './images/' + raw;
}
