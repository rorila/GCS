/**
 * LLMResponseParser
 *
 * Hilfsfunktionen, um JSON aus LLM-Antworten zu extrahieren.
 * Unterstützt Markdown-Code-Blöcke und reine JSON-Strings.
 */

export class LLMResponseParser {
    /**
     * Extrahiert ein JSON-Objekt aus einer beliebigen Antwort.
     * Erkennt zuerst ```json Code-Blöcke, dann fallweise geschweifte Klammern.
     */
    public static extractJson<T = any>(text: string): T {
        const trimmed = text.trim();
        if (!trimmed) {
            throw new Error('LLM response is empty.');
        }

        // Versuch 1: Erstes Code-Block-JSON extrahieren
        const codeBlockMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
        if (codeBlockMatch) {
            const candidate = codeBlockMatch[1].trim();
            const parsed = this.tryParse(candidate);
            if (parsed !== undefined) return parsed as T;
        }

        // Versuch 2: Erstes geschweiftes Objekt/Array ab der ersten '{' oder '['
        const start = this.findJsonStart(trimmed);
        if (start !== -1) {
            const candidate = trimmed.substring(start);
            const parsed = this.tryParse(candidate);
            if (parsed !== undefined) return parsed as T;
        }

        throw new Error('No valid JSON found in LLM response.');
    }

    /**
     * Extrahiert ein JSON-Array oder -Objekt; wirft bei Fehler.
     */
    public static parseJson<T = any>(text: string): T {
        return this.extractJson<T>(text);
    }

    private static tryParse(text: string): any | undefined {
        try {
            return JSON.parse(text);
        } catch (e) {
            // Manchmal generiert das Modell trailing Kommentare oder Text.
            // Wir versuchen, bis zum letzten validen JSON-Token zu finden.
            return this.tryParseByTruncation(text);
        }
    }

    private static tryParseByTruncation(text: string): any | undefined {
        for (let i = text.length; i > 0; i--) {
            const candidate = text.substring(0, i);
            try {
                return JSON.parse(candidate);
            } catch (e) {
                // continue truncating
            }
        }
        return undefined;
    }

    private static findJsonStart(text: string): number {
        const objectStart = text.indexOf('{');
        const arrayStart = text.indexOf('[');

        if (objectStart === -1 && arrayStart === -1) return -1;
        if (objectStart === -1) return arrayStart;
        if (arrayStart === -1) return objectStart;
        return Math.min(objectStart, arrayStart);
    }
}
