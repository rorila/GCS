#!/usr/bin/env node
/**
 * generate-components-doc.mjs
 *
 * Scannt src/components/*.ts und erzeugt docs/components-generated.md —
 * eine maschinell generierte Komponenten-Referenz für die RAG-Wissensbasis.
 *
 * Extrahiert pro Komponente:
 * - Klassenname + Basisklasse (Vererbung)
 * - JSDoc-Klassenbeschreibung
 * - Öffentliche Properties (Typ, Default, Inline-Kommentar)
 * - Inspector-Properties aus getInspectorProperties() (name, label, type, group, options)
 * - Events aus getEvents()
 * - ComponentRegistry-Registrierungsname
 *
 * Aufruf: node scripts/generate-components-doc.mjs
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const SRC_DIR = path.join(ROOT, 'src', 'components');
const OUT_FILE = path.join(ROOT, 'docs', 'components-generated.md');

/** Dateien, die keine echten Komponenten sind */
const SKIP_FILES = new Set([
    'index.ts', 'components.md', 'ImageCapable.ts', 'ExpertDialog.ts',
    'PlaybackControls.ts', 'PlaybackOverlay.ts', 'scopes.ts',
    // Editor-/System-Interna: nicht für KI-generierte Projekte relevant
    // (nicht in ComponentRegistry registriert oder reine Editor-/Protokoll-Klassen)
    'TDebugLog.ts',          // Debug-Overlay (Editor)
    'TFlowStage.ts',         // Flow-Editor-Stage
    'TStage.ts',             // Abstrakte Stage-Basis (nicht registriert)
    'TSplashStage.ts',       // Stage-Interna
    'TStageController.ts',   // Stage-Verwaltung (intern)
    'TDialogRoot.ts',        // Dialog-System-Basis
    'TThemeDialog.ts',       // Editor-Dialog
    'TInspectorTemplate.ts', // Inspector-Interna
    'THandshake.ts',         // Multiplayer-Protokoll (intern)
    'THeartbeat.ts',         // Multiplayer-Protokoll (intern)
]);

// ─────────────────────────────────────────────────────────────
// Parsing-Helfer (regex-basiert, bewusst einfach gehalten)
// ─────────────────────────────────────────────────────────────

function extractClassInfo(source) {
    const m = source.match(/export\s+(?:abstract\s+)?class\s+(T\w+)\s+extends\s+(\w+)/);
    if (!m) return null;
    return { className: m[1], baseClass: m[2], abstract: /export\s+abstract\s+class/.test(m[0]) };
}

function extractClassDoc(source, className) {
    // JSDoc-Block direkt vor "export class TXxx"
    const re = new RegExp(`/\\*\\*([\\s\\S]*?)\\*/\\s*export\\s+(?:abstract\\s+)?class\\s+${className}\\b`);
    const m = source.match(re);
    if (!m) return '';
    return m[1]
        .split('\n')
        .map(l => l.replace(/^\s*\*\s?/, '').trim())
        .filter(l => l && !l.startsWith('@'))
        .join(' ')
        .trim();
}

function extractPublicProperties(source) {
    const props = [];
    // public name: Type = default; // kommentar  |  public name: Type;
    const re = /^(\s*(?:\/\*\*[\s\S]*?\*\/\s*|\/\/[^\n]*\n\s*)*)public\s+(?!get\s|set\s|constructor|static)(\w+)\s*:\s*([^=;\n]+)(?:=\s*([^;\n]+))?;/gm;
    let m;
    while ((m = re.exec(source)) !== null) {
        const commentMatch = m[1]?.match(/\/\*\*([\s\S]*?)\*\//) || m[1]?.match(/\/\/([^\n]*)/);
        const comment = commentMatch
            ? (commentMatch[1] || '').replace(/\n\s*\*?\s?/g, ' ').trim()
            : '';
        // Inline-Kommentar hinter dem Semikolon
        const lineEnd = source.indexOf('\n', m.index + m[0].length);
        const tail = source.slice(m.index + m[0].length, lineEnd === -1 ? undefined : lineEnd);
        const inline = tail.match(/\/\/\s*(.+)/)?.[1]?.trim() || '';
        props.push({
            name: m[2],
            type: m[3].trim(),
            def: m[4]?.trim(),
            doc: comment || inline,
        });
    }
    return props;
}

function extractInspectorProperties(source) {
    const props = [];
    // { name: 'x', label: 'Y', type: 'number', group: 'G', options: [...] }
    const re = /\{\s*name:\s*'([^']+)'\s*,\s*label:\s*'([^']+)'\s*,\s*type:\s*'([^']+)'\s*(?:,\s*group:\s*'([^']+)')?\s*(?:,\s*options:\s*(\[[^\]]*\]))?/g;
    let m;
    while ((m = re.exec(source)) !== null) {
        props.push({ name: m[1], label: m[2], type: m[3], group: m[4] || '', options: m[5] || '' });
    }
    return props;
}

function extractEvents(source) {
    // getEvents(): string[] { return ['onClick', ...] }  — auch über super.getEvents() ergänzt
    const events = new Set();
    const re = /getEvents\(\)[^{]*\{[\s\S]*?return\s*\[([^\]]*)\]/g;
    let m;
    while ((m = re.exec(source)) !== null) {
        for (const e of m[1].matchAll(/'([^']+)'/g)) events.add(e[1]);
    }
    return [...events];
}

function extractRegistryName(source) {
    const m = source.match(/ComponentRegistry\.register\(\s*'([^']+)'/);
    return m ? m[1] : null;
}

// ─────────────────────────────────────────────────────────────
// Markdown-Erzeugung
// ─────────────────────────────────────────────────────────────

function renderComponent(c) {
    const lines = [];
    lines.push(`## ${c.className} — Komponente`);
    lines.push('');
    if (c.doc) lines.push(c.doc, '');
    lines.push(`- **Basisklasse:** \`${c.baseClass}\`${c.abstract ? ' (abstrakt)' : ''}`);
    if (c.registryName && c.registryName !== c.className) {
        lines.push(`- **Registry-Name:** \`${c.registryName}\``);
    }
    lines.push('');

    if (c.inspectorProps.length > 0) {
        lines.push('### Inspector-Eigenschaften');
        lines.push('');
        lines.push('| Property | Label | Typ | Gruppe | Optionen |');
        lines.push('|---|---|---|---|---|');
        for (const p of c.inspectorProps) {
            lines.push(`| \`${p.name}\` | ${p.label} | ${p.type} | ${p.group || '—'} | ${p.options || '—'} |`);
        }
        lines.push('');
    }

    const ownProps = c.publicProps.filter(p => !c.inspectorProps.some(ip => ip.name === p.name));
    if (ownProps.length > 0) {
        lines.push('### Weitere öffentliche Properties');
        lines.push('');
        for (const p of ownProps) {
            const def = p.def !== undefined ? ` = ${p.def}` : '';
            const doc = p.doc ? ` — ${p.doc}` : '';
            lines.push(`- \`${p.name}: ${p.type}\`${def}${doc}`);
        }
        lines.push('');
    }

    if (c.events.length > 0) {
        lines.push('### Ereignisse');
        lines.push('');
        lines.push(c.events.map(e => `\`${e}\``).join(', '));
        lines.push('');
    }

    return lines.join('\n');
}

// ─────────────────────────────────────────────────────────────
// Main
// ─────────────────────────────────────────────────────────────

const files = fs.readdirSync(SRC_DIR)
    .filter(f => f.endsWith('.ts') && !SKIP_FILES.has(f))
    .sort();

const components = [];
for (const file of files) {
    const source = fs.readFileSync(path.join(SRC_DIR, file), 'utf-8');
    const cls = extractClassInfo(source);
    if (!cls) continue;
    components.push({
        ...cls,
        file,
        doc: extractClassDoc(source, cls.className),
        publicProps: extractPublicProperties(source),
        inspectorProps: extractInspectorProperties(source),
        events: extractEvents(source),
        registryName: extractRegistryName(source),
    });
}

const out = [];
out.push('# Komponenten-Referenz (generiert)');
out.push('');
out.push(`> Automatisch generiert aus \`src/components/*.ts\` — ${components.length} Komponenten.`);
out.push('> Nicht manuell editieren! Änderungen: `node scripts/generate-components-doc.mjs`');
out.push('');
out.push('## Inhaltsverzeichnis');
out.push('');
for (const c of components) out.push(`- [${c.className}](#${c.className.toLowerCase()}--komponente) — extends \`${c.baseClass}\``);
out.push('');
out.push('---');
out.push('');
for (const c of components) {
    out.push(renderComponent(c));
    out.push('---');
    out.push('');
}

fs.mkdirSync(path.dirname(OUT_FILE), { recursive: true });
fs.writeFileSync(OUT_FILE, out.join('\n'), 'utf-8');
console.log(`[components-doc] ${components.length} Komponenten → ${path.relative(ROOT, OUT_FILE)}`);
