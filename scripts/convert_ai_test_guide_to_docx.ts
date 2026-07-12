import fs from 'node:fs/promises';
import path from 'node:path';
import { marked } from 'marked';
// @ts-ignore - kein Typenpaket vorhanden
import HTMLtoDOCX from 'html-to-docx';

/**
 * Einmaliges Konvertierungsskript: docs/AI_Test_Anleitung.md -> docs/AI_Test_Anleitung.docx
 * Nutzt bereits vorhandene Projekt-Dependencies (marked, html-to-docx).
 */

async function main() {
    const mdPath = path.resolve(process.cwd(), 'docs/AI_Test_Anleitung.md');
    const docxPath = path.resolve(process.cwd(), 'docs/AI_Test_Anleitung.docx');

    const markdown = await fs.readFile(mdPath, 'utf-8');
    const html = await marked.parse(markdown);

    const fullHtml = `<!DOCTYPE html><html><head><meta charset="utf-8"></head><body>${html}</body></html>`;

    const buffer = await HTMLtoDOCX(fullHtml, null, {
        title: 'Test-Anleitung: KI-Integration (AIOrchestrator)',
        font: 'Calibri',
        fontSize: 22,
    });

    await fs.writeFile(docxPath, buffer);
    console.log(`DOCX erzeugt: ${docxPath}`);
}

main().catch(err => {
    console.error('Konvertierung fehlgeschlagen:', err);
    process.exit(1);
});
