import DOMPurify from 'dompurify';

/**
 * SecurityUtils - Zentrale Schutzmechanismen gegen XSS und Injection Attacks.
 */
export class SecurityUtils {
    
    /**
     * Bereinigt HTML mit DOMPurify für sichere innerHTML-Zuweisungen.
     * Erlaubt grundlegende Formatierung (b, i, u, strong, em, a, br, p, span)
     * aber blockiert alle Scripts, Event-Handler und gefährlichen URLs.
     */
    public static sanitizeHTML(html: string): string {
        if (!html) return '';
        
        return DOMPurify.sanitize(html, {
            ALLOWED_TAGS: ['b', 'i', 'u', 'strong', 'em', 'a', 'br', 'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre'],
            ALLOWED_ATTR: ['href', 'target', 'title', 'class', 'style', 'data-*'],
            ALLOW_DATA_ATTR: true,
            SANITIZE_DOM: true,
            // Links nur mit http/https/ftp/mailto - kein javascript:
            ALLOWED_URI_REGEXP: /^(?:(?:(?:f|ht)tps?|mailto|tel|callto|cid|xmpp|xxx):|[^a-z]|[a-z+.-]+(?:[^a-z+.-:]|$))/i,
        });
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
