export class PascalHighlighter {
    private static readonly KEYWORDS = [
        'PROGRAM', 'USES', 'VAR', 'PROCEDURE', 'BEGIN', 'END', 'IF', 'THEN', 'ELSE',
        'WHILE', 'DO', 'FOR', 'TO', 'IN', 'TYPE', 'INTERFACE', 'IMPLEMENTATION', 'UNIT'
    ];

    private static readonly TYPES = ['INTEGER', 'REAL', 'STRING', 'BOOLEAN', 'CHAR', 'TEXT'];

    /**
     * Highlights a string of Pascal code safely using single-pass regex matching
     */
    public static highlight(code: string): string {
        const tokens = [
            { name: 'comment', regex: /\{[^}]*\}|\/\/.*/g, color: '#6a9955' },
            { name: 'string', regex: /'[^']*'/g, color: '#ce9178' },
            { name: 'keyword', regex: new RegExp(`\\b(${this.KEYWORDS.join('|')})\\b`, 'gi'), color: '#c586c0' },
            { name: 'type', regex: new RegExp(`\\b(${this.TYPES.join('|')})\\b`, 'gi'), color: '#4ec9b0' },
            { name: 'number', regex: /\b\d+(\.\d+)?\b/g, color: '#b5cea8' },
            { name: 'procedure', regex: /\b([a-z_][a-z0-9_]*)(?=\s*[;(\.])/gi, color: '#dcdcaa' },
            { name: 'variable', regex: /\b([a-z_][a-z0-9_]*)(?=\s*:)/gi, color: '#9cdcfe' }
        ];

        // Find all matches
        const matches: { start: number, end: number, color: string, text: string }[] = [];

        tokens.forEach(token => {
            let match;
            token.regex.lastIndex = 0;
            while ((match = token.regex.exec(code)) !== null) {
                // If it's a keyword or type, we might want to prioritize it or normalize case
                let text = match[0];
                if (token.name === 'keyword') text = text.toUpperCase();
                if (token.name === 'type') text = text.charAt(0).toUpperCase() + text.slice(1).toLowerCase();
                if (token.name === 'procedure' || token.name === 'variable') {
                    // Don't highlight keywords as identifiers
                    if (this.KEYWORDS.includes(text.toUpperCase()) || this.TYPES.includes(text.toUpperCase())) continue;
                }

                matches.push({
                    start: match.index,
                    end: match.index + match[0].length,
                    color: token.color,
                    text: text
                });
            }
        });

        // Sort matches by start position, then length (descending)
        matches.sort((a, b) => a.start - b.start || (b.end - b.start) - (a.end - a.start));

        // Filter out overlapping matches (keep the first/longest one)
        const activeMatches: typeof matches = [];
        let lastPos = -1;
        matches.forEach(m => {
            if (m.start >= lastPos) {
                activeMatches.push(m);
                lastPos = m.end;
            }
        });

        // Build HTML
        let result = '';
        let currentPos = 0;
        activeMatches.forEach(m => {
            // Add plain text before match
            result += this.escape(code.substring(currentPos, m.start));
            // Add highlighted match
            result += `<span style="color: ${m.color};">${this.escape(m.text)}</span>`;
            currentPos = m.end;
        });
        // Add remaining text
        result += this.escape(code.substring(currentPos));

        return result;
    }

    private static escape(text: string): string {
        return text
            .replace(/&/g, '&amp;')
            .replace(/</g, '&lt;')
            .replace(/>/g, '&gt;');
    }
}
