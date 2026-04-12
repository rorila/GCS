/**
 * SecurityUtils - Zentrale Schutzmechanismen gegen XSS und Injection Attacks.
 */
export class SecurityUtils {
    
    /**
     * Einfache Bereinigung von potenziell gefährlichen Tags und Attributen,
     * um Cross-Site Scripting (XSS) in innerHTML Zuweisungen zu verhindern.
     */
    public static sanitizeHTML(html: string): string {
        if (!html) return '';
        
        const parser = new DOMParser();
        const doc = parser.parseFromString(html, 'text/html');
        
        const removeDangerousNodes = (node: Node) => {
            const el = node as HTMLElement;
            
            if (el.tagName) {
                const tag = el.tagName.toLowerCase();
                // Gefährliche Tags komplett entfernen
                if (['script', 'iframe', 'object', 'embed', 'applet', 'meta', 'link', 'base'].includes(tag)) {
                    el.remove();
                    return;
                }

                // Gefährliche Attribute (wie onload, onerror) entfernen
                if (el.attributes) {
                    for (let i = el.attributes.length - 1; i >= 0; i--) {
                        const attr = el.attributes[i];
                        if (attr.name.toLowerCase().startsWith('on')) {
                            el.removeAttribute(attr.name);
                        }
                        if (attr.name.toLowerCase() === 'href' || attr.name.toLowerCase() === 'src') {
                            if (attr.value.toLowerCase().trim().startsWith('javascript:')) {
                                el.removeAttribute(attr.name);
                            }
                        }
                    }
                }
            }

            // Schleife Rückwärts, weil remove() die Länge children verändert
            for (let i = node.childNodes.length - 1; i >= 0; i--) {
                removeDangerousNodes(node.childNodes[i]);
            }
        };

        removeDangerousNodes(doc.body);
        return doc.body.innerHTML;
    }

    /**
     * Escaped HTML special characters so strings can be safely inserted into DOM via innerHTML (e.g. tooltips)
     */
    public static escapeHtml(str: string): string {
        if (!str) return '';
        const map: Record<string, string> = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return String(str).replace(/[&<>"']/g, m => map[m]);
    }

    /**
     * Checks if a CSS color value is reasonably safe to use.
     */
    public static isValidCssColor(color: string): boolean {
        if (!color) return false;
        const colorTrimmed = color.trim();
        // #RRGGBBAA hex, rgb(), hsl() or simple color name format
        return /^#[0-9a-fA-F]{3,8}$/.test(colorTrimmed) || 
               /^(rgb|hsl)a?\([^)]+\)$/.test(colorTrimmed) ||
               /^[a-zA-Z]+$/.test(colorTrimmed);
    }

    /**
     * Guard for ExpressionParser to prevent Arbitrary Code Execution (ACE)
     */
    public static sanitizeExpression(expr: string): boolean {
        if (!expr) return true;
        // Block dangerous identifiers often used for RCE in JS
        const blocked = /\b(fetch|XMLHttpRequest|eval|Function|import|require|window|document|localStorage|sessionStorage|electronFS|alert|confirm|prompt|process|global|globalThis)\b/i;
        return !blocked.test(expr);
    }
}
