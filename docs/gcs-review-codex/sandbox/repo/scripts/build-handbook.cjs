#!/usr/bin/env node
/**
 * build-handbook.cjs — Erzeugt beide HTML-Editionen des GCS-Autoren-Handbuchs.
 *
 * Quelle (einzige!): docs/user-guide/kapitel-*.md + b-kapitel-*.md
 * Ausgaben:
 *   docs/handbook-html/shared/handbook-content.js  – Kapitel-Daten für beide Editionen
 *   docs/handbook-html/gcs-native/project.js       – deklaratives GCS-Projekt (window.PROJECT)
 *
 * Aufruf:  node scripts/build-handbook.cjs
 */
const fs = require('fs');
const path = require('path');
const { marked } = require('marked');

const ROOT = path.join(__dirname, '..');
const SRC = path.join(ROOT, 'docs', 'user-guide');
const OUT = path.join(ROOT, 'docs', 'handbook-html');
const OUT_SHARED = path.join(OUT, 'shared');
const OUT_GCS = path.join(OUT, 'gcs-native');

/* ─────────────────────────────────────────────────────────────
   1. Kapitel-Liste aus README.md (Reihenfolge + Lernziele)
   ───────────────────────────────────────────────────────────── */
function parseReadme() {
    const md = fs.readFileSync(path.join(SRC, 'README.md'), 'utf-8');
    const chapters = [];
    const rowRe = /\|\s*([AB]?\d+)\s*\|\s*\[([^\]]+)\]\(([^)]+\.md)\)\s*\|\s*([^|]*)\|\s*([^|]*)\|/g;
    let m;
    while ((m = rowRe.exec(md))) {
        const file = m[3].trim();
        const isB = file.startsWith('b-');
        chapters.push({
            file,
            num: isB ? 'B' + m[1].replace(/^B/, '') : 'A' + m[1],
            navId: isB ? 'b' + m[1].replace(/^B/, '').padStart(2, '0') : 'a' + m[1].padStart(2, '0'),
            tocTitle: m[2].trim(),
            lernziel: m[4].trim(),
            ergebnis: m[5].trim()
        });
    }
    return chapters;
}

/* ─────────────────────────────────────────────────────────────
   2. Markdown → HTML mit Handbuch-spezifischen Erweiterungen
   ───────────────────────────────────────────────────────────── */
function prepareMarkdown(md) {
    // Sprecher-Drehbuch einklappbar machen — Quellformat ist
    // „**Sprecher-Drehbuch:** Text …" (Text kann in derselben Zeile beginnen,
    // endet vor „**Sync-Hinweise:**" oder der nächsten Überschrift)
    md = md.replace(
        /\*\*Sprecher-Drehbuch(?:\s*\(deutsch\))?:\*\*\s*([\s\S]*?)(?=\n\*\*Sync-Hinweise|\n## |\n---)/g,
        (match, body) =>
            `\n\n<details class="drehbuch"><summary>🎙️ Sprecher-Drehbuch (deutsch) — zum Aufklappen klicken</summary>\n\n${body.trim()}\n\n</details>\n\n`
    );
    // Screenshot-Platzhalter als sichtbare Boxen
    md = md.replace(
        /`\[SCREENSHOT FEHLT:\s*([^\]]+)\]`/g,
        (match, text) =>
            `\n\n<div class="screenshot-placeholder">📷 <strong>Screenshot folgt</strong><br><span>${text.trim()}</span></div>\n\n`
    );
    return md;
}

function linkRewrite(mode) {
    return (href) => {
        const m = href.match(/^(b-)?kapitel-(\d+)-[^)]*\.md$/);
        if (!m) return href;
        const navId = (m[1] ? 'b' : 'a') + m[2];
        return mode === 'gcs' ? `stage:stage_${navId}` : `#${navId}`;
    };
}

/**
 * TRichText bereinigt HTML zur Laufzeit mit DOMPurify (SecurityUtils).
 * Erlaubt sind: b i u strong em a br p span div h1–h6 ul ol li blockquote
 * code pre — sowie Attribute href/target/title/class/style/data-*.
 * Tabellen-, details-/input-Markup wird daher in erlaubte Strukturen
 * überführt; Kapitel-Links werden als data-stage-Attribute abgelegt
 * (href="stage:…" würde die URI-Prüfung nicht bestehen; der Renderer
 * wertet data-stage zuerst aus — TextObjectRenderer).
 */
function sanitizeForGcs(html) {
    return html
        // Kapitel-Links: stage:-href → data-stage (DOMPurify-kompatibel)
        .replace(/<a href="(stage:[^"]+)"/g, '<a data-stage="$1" href="#"')
        // Tabellen → div/span-Struktur mit Inline-Styles (kein CSS in GCS;
        // 'style' ist im Sanitizer erlaubt). Farben erben vom Container,
        // dadurch funktionieren sie in beiden Themes.
        .replace(/<\/?(thead|tbody|tfoot)[^>]*>/g, '')
        .replace(/<table[^>]*>/g,
            '<div style="display:flex;flex-direction:column;margin:0.9em 0;border:1px solid rgba(120,135,170,0.45);border-radius:8px;overflow:hidden">')
        .replace(/<\/table>/g, '</div>')
        .replace(/<tr[^>]*>/g,
            '<div style="display:flex;border-bottom:1px solid rgba(120,135,170,0.25)">')
        .replace(/<\/tr>/g, '</div>')
        .replace(/<th[^>]*>/g,
            '<div style="flex:1;padding:7px 10px;font-weight:600;background:rgba(120,135,170,0.12)">')
        .replace(/<\/th>/g, '</div>')
        .replace(/<td[^>]*>/g, '<div style="flex:1;padding:6px 10px">')
        .replace(/<\/td>/g, '</div>')
        // details/summary → statischer, eingerückter Block
        .replace(/<details class="drehbuch"><summary>([\s\S]*?)<\/summary>/g,
            '<div style="margin:0.9em 0;padding:10px 14px;border-left:3px solid rgba(120,135,170,0.55);background:rgba(120,135,170,0.08);border-radius:0 8px 8px 0"><strong>$1</strong>')
        .replace(/<\/details>/g, '</div>')
        // Checkboxen aus Aufgabenlisten → Symbol
        .replace(/<input[^>]*type="checkbox"[^>]*>/g, '☐ ');
}

/**
 * Teilt Kapitel-HTML in Seiten. Standalone-TRichText kann nicht scrollen
 * (Runtime setzt overflow:hidden), deshalb wird deklarativ geblättert:
 * jede Seite ist ein eigenes TRichText, sichtbar gesteuert über `visible`.
 * Umbruch an Blockgrenzen, bevorzugt vor h2/h3-Überschriften.
 */
function splitChapterHtml(html, maxChars = 2400) {
    const blocks = html.split(/(?<=<\/(?:p|li|ul|ol|blockquote|h1|h2|h3|h4|pre|div)>)/).filter(b => b.trim());
    // Kosten-Schätzung statt reiner Zeichenzahl: Tabellenzeilen, Code-
    // Blöcke und Platzhalter brauchen feste Höhe unabhängig vom Text.
    const blockCost = (b) => {
        let cost = b.length;
        if (/^\s*<pre/.test(b)) cost *= 3;
        cost += (b.match(/display:flex;border-bottom/g) || []).length * 400;
        cost += (b.match(/border-left:3px|Screenshot folgt/g) || []).length * 300;
        if (/^\s*<h[23][^>]*>/.test(b)) cost += 200;
        return cost;
    };
    const pages = [];
    let cur = '', curCost = 0;
    for (const b of blocks) {
        const isHeading = /^\s*<h[23][^>]*>/.test(b);
        const cost = blockCost(b);
        // Vor Überschriften nur umbrechen, wenn die Seite bereits gut gefüllt
        // ist — sonst entstehen fast leere Seiten (z. B. nur die Status-Box).
        if (cur && (curCost + cost > maxChars || (isHeading && curCost > 900))) {
            pages.push(cur);
            cur = '';
            curCost = 0;
        }
        cur += b;
        curCost += cost;
    }
    if (cur.trim()) pages.push(cur);
    return pages.length ? pages : [html];
}

function renderHtml(md, mode) {
    const src = prepareMarkdown(md);
    let html = marked.parse(src);
    // Die erste H1 entfällt: Beide Editionen zeigen den Kapiteltitel
    // bereits im eigenen Kopf (V1: chapterBadge/chapterTitle, V2: KapitelTitel-Label).
    html = html.replace(/<h1[^>]*>[\s\S]*?<\/h1>/, '');
    const rewrite = linkRewrite(mode);
    html = html.replace(/<a href="([^"]+)"/g, (all, href) => `<a href="${rewrite(href)}"`);
    return mode === 'gcs' ? sanitizeForGcs(html) : html;
}

function plainText(md) {
    return md
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/`[^`]*`/g, ' ')
        .replace(/\|[^\n]+\|/g, ' ')
        .replace(/[#>*_\[\]()`-]+/g, ' ')
        .replace(/\s+/g, ' ')
        .trim();
}

/* ─────────────────────────────────────────────────────────────
   3. GCS-Projekt generieren (Version 2 – gcs-native)
   ───────────────────────────────────────────────────────────── */
// backgroundColor als Ausdruck: player-standalone interpoliert
// grid.backgroundColor bei jedem Render (updateBackground). Die Theme-Stage-
// Farbe greift dagegen nur einmalig (applyActiveThemeStageStyle setzt sie
// nicht, wenn die Stage einen eigenen Wert trägt). Daher steuert die globale
// Variable 'Hintergrund' den Stage-Hintergrund dynamisch — sie wird von den
// Act_Stil*-Actions mitgesetzt.
const GRID = { cols: 96, rows: 54, cellSize: 14, snapToGrid: false, visible: false, backgroundColor: '${Hintergrund.value}' };

const THEMES = [
    {
        id: 'handbook-hell',
        name: 'Handbuch Hell',
        description: 'Helle Lesedarstellung',
        stage: { backgroundColor: '#f6f8fc', gridColor: '#dde4f0' },
        components: {
            TButton: { backgroundColor: '#ffffff', color: '#1c2b4a', borderColor: '#c9d5e8', borderWidth: 1, borderRadius: 8 },
            TPanel: { backgroundColor: '#ffffff', borderColor: '#d8e0ee', borderWidth: 1, color: '#1c2b4a' },
            TLabel: { color: '#1c2b4a', backgroundColor: 'transparent' },
            TRichText: { color: '#24324b', backgroundColor: '#ffffff', borderColor: '#d8e0ee', borderWidth: 1 },
            TEdit: { backgroundColor: '#ffffff', color: '#1c2b4a', borderColor: '#b8c6de' }
        }
    },
    {
        id: 'handbook-dunkel',
        name: 'Handbuch Dunkel',
        description: 'Dunkle Lesedarstellung',
        stage: { backgroundColor: '#10141f', gridColor: '#232a3a' },
        components: {
            TButton: { backgroundColor: '#1d2637', color: '#e7edf7', borderColor: '#33415c', borderWidth: 1, borderRadius: 8 },
            TPanel: { backgroundColor: '#182033', borderColor: '#2c3a55', borderWidth: 1, color: '#e7edf7' },
            TLabel: { color: '#e7edf7', backgroundColor: 'transparent' },
            TRichText: { color: '#dde5f2', backgroundColor: '#161d2e', borderColor: '#2c3a55', borderWidth: 1 },
            TEdit: { backgroundColor: '#141b2b', color: '#e7edf7', borderColor: '#33415c' }
        }
    }
];

let uidCounter = 0;
const uid = (p) => `${p}_${(++uidCounter).toString(36)}`;

function headerObjects(chapterStageId) {
    // Auf jeder Stage: Home, Titel-Platzhalter, Suche, Theme, Fortschritt
    return [
        {
            className: 'TButton', name: 'BtnHome', x: 1, y: 1, width: 7, height: 2,
            caption: '⌂ Übersicht', id: uid('home'),
            events: { onClick: 'NavUebersicht' }
        },
        {
            className: 'TButton', name: 'BtnSuche', x: 72, y: 1, width: 10, height: 2,
            caption: '🔍 Suche', id: uid('search'),
            events: { onClick: 'NavSuche' }
        },
        {
            className: 'TButton', name: 'BtnTheme', x: 83, y: 1, width: 11, height: 2,
            caption: '🌓 Hell/Dunkel', id: uid('theme'),
            events: { onClick: 'ThemeWechseln' }
        },
        {
            className: 'TLabel', name: 'FortschrittLabel', x: 55, y: 1, width: 16, height: 2,
            text: '0 / 23 gelesen', id: uid('prog'),
            style: { textAlign: 'right', fontSize: 15 }
        }
    ];
}

/**
 * Erzeugt die property-changes für Hell-/Dunkel-Styling aller benannten
 * Objekte. Hintergrund: Hydrierte Komponenten tragen Konstruktor-Defaults in
 * `style` (z. B. TRichText color '#000000', backgroundColor 'transparent'),
 * die bei getMergedStyle als lokale Angaben das Theme schlagen. Themes liefern
 * zuverlässig nur den Stage-Hintergrund — Objektfarben werden daher
 * deklarativ über property-Actions gesetzt.
 */
function themeStyleChanges(dark, extra) {
    const pal = dark ? {
        btnBg: '#1d2637', btnColor: '#e7edf7', btnBorder: '#33415c',
        lblColor: '#e7edf7',
        rtBg: '#161d2e', rtColor: '#dde5f2', rtBorder: '#2c3a55',
        edtBg: '#141b2b', edtColor: '#e7edf7', edtBorder: '#33415c'
    } : {
        btnBg: '#ffffff', btnColor: '#1c2b4a', btnBorder: '#c9d5e8',
        lblColor: '#1c2b4a',
        rtBg: '#ffffff', rtColor: '#24324b', rtBorder: '#d8e0ee',
        edtBg: '#ffffff', edtColor: '#1c2b4a', edtBorder: '#b8c6de'
    };
    // Kopfzeilen-Objekte liegen auf der Blueprint und sind auf jeder Stage
    // auflösbar — sie werden deshalb überall mitgestylt.
    const buttons = ['BtnHome', 'BtnSuche', 'BtnTheme', ...(extra.buttons || [])];
    const labels = ['FortschrittLabel', ...(extra.labels || [])];
    const richTexts = extra.rts || [];
    const edits = extra.edits || [];

    const changes = {};
    buttons.forEach(n => {
        changes[`${n}.style.backgroundColor`] = pal.btnBg;
        changes[`${n}.style.color`] = pal.btnColor;
        changes[`${n}.style.borderColor`] = pal.btnBorder;
    });
    labels.forEach(n => { changes[`${n}.style.color`] = pal.lblColor; });
    richTexts.forEach(n => {
        changes[`${n}.style.color`] = pal.rtColor;
        changes[`${n}.style.backgroundColor`] = pal.rtBg;
        changes[`${n}.style.borderColor`] = pal.rtBorder;
    });
    edits.forEach(n => {
        changes[`${n}.style.backgroundColor`] = pal.edtBg;
        changes[`${n}.style.color`] = pal.edtColor;
        changes[`${n}.style.borderColor`] = pal.edtBorder;
    });
    // Stage-Hintergrund: die Stages interpolieren '${Hintergrund.value}'.
    changes['Hintergrund'] = dark ? '#10141f' : '#f6f8fc';
    return changes;
}

// Stage-lokale Stil-Actions: Gleicher Aktionsname auf jeder Stage —
// die Stage-Variante überdeckt die Blueprint-Variante (mergedActions,
// RuntimeStageManager). Die Blueprint-Task 'StyleAnwenden' (onEnter) und
// 'ThemeWechseln' lösen ihre 'Act_Stil*'-Aufrufe daher stage-lokal auf.
// Jede Stage referenziert so nur Objekte, die auf ihr existieren —
// verhindert Streu-Variablen durch fehlgeschlagene Namensauflösung.
function stageStyleActions(extra) {
    return [
        { id: uid('act'), name: 'Act_StilHell', type: 'property', changes: themeStyleChanges(false, extra) },
        { id: uid('act'), name: 'Act_StilDunkel', type: 'property', changes: themeStyleChanges(true, extra) }
    ];
}

function headerActionsAndTasks(chapters) {
    const actions = [
        { id: uid('act'), name: 'Act_NavUebersicht', type: 'navigate_stage', stageId: 'stage_overview' },
        { id: uid('act'), name: 'Act_NavSuche', type: 'navigate_stage', stageId: 'stage_suche' },
        // savePreference: false — der Dunkelmodus-Zustand lebt in der globalen
        // Variable Dunkelmodus; eine persistierte Theme-Wahl würde beim
        // nächsten Start mit den Objekt-Stilen aus dem Tritt geraten.
        { id: uid('act'), name: 'Act_ThemeHell', type: 'set_active_theme', themeId: 'handbook-hell', savePreference: false },
        { id: uid('act'), name: 'Act_DunkelmodusAus', type: 'property', changes: { 'Dunkelmodus': 'false' } },
        { id: uid('act'), name: 'Act_ThemeDunkel', type: 'set_active_theme', themeId: 'handbook-dunkel', savePreference: false },
        { id: uid('act'), name: 'Act_DunkelmodusAn', type: 'property', changes: { 'Dunkelmodus': 'true' } },
        // Objekt-Stile je Modus (Begründung siehe themeStyleChanges).
        // Blueprint-Fallback: nur Kopfzeilen-Objekte — jede Stage definiert
        // eigene Act_Stil*-Varianten mit ihren lokalen Objekten.
        { id: uid('act'), name: 'Act_StilHell', type: 'property', changes: themeStyleChanges(false, {}) },
        { id: uid('act'), name: 'Act_StilDunkel', type: 'property', changes: themeStyleChanges(true, {}) },
        ...chapters.map(c => ({
            id: uid('act'), name: `Act_Zu_${c.navId}`, type: 'navigate_stage', stageId: c.stageId
        }))
    ];
    const tasks = [
        {
            name: 'NavUebersicht', description: 'Zur Kursübersicht', triggerMode: 'local-sync', params: [], id: uid('task'),
            actionSequence: [{ type: 'action', name: 'Act_NavUebersicht' }]
        },
        {
            name: 'NavSuche', description: 'Zur Suche', triggerMode: 'local-sync', params: [], id: uid('task'),
            actionSequence: [{ type: 'action', name: 'Act_NavSuche' }]
        },
        {
            name: 'ThemeWechseln', description: 'Hell/Dunkel umschalten', triggerMode: 'local-sync',
            params: [], id: uid('task'),
            // Stil-Props zuerst, set_active_theme zuletzt: dessen onChange löst
            // den Neu-Render aus, der die gesetzten Objekt-Stile anwendet.
            actionSequence: [{
                type: 'condition',
                condition: { variable: 'Dunkelmodus', operator: '==', value: 'true' },
                then: [
                    { type: 'action', name: 'Act_StilHell' },
                    { type: 'action', name: 'Act_DunkelmodusAus' },
                    { type: 'action', name: 'Act_ThemeHell' }
                ],
                else: [
                    { type: 'action', name: 'Act_StilDunkel' },
                    { type: 'action', name: 'Act_DunkelmodusAn' },
                    { type: 'action', name: 'Act_ThemeDunkel' }
                ]
            }]
        },
        {
            // Läuft bei jedem Stage-Eintritt (Blueprint-events.onEnter) und
            // stellt Objekt-Stile + Stage-Hintergrund zum gespeicherten
            // Dunkelmodus-Flag her — nötig, weil frisch hydrierte
            // Kapitel-Objekte ihre Konstruktor-Defaults mitbringen.
            name: 'StyleAnwenden', description: 'Wendet den aktiven Modus auf die Stage an', triggerMode: 'local-sync',
            params: [], id: uid('task'),
            actionSequence: [{
                type: 'condition',
                condition: { variable: 'Dunkelmodus', operator: '==', value: 'true' },
                then: [
                    { type: 'action', name: 'Act_StilDunkel' },
                    { type: 'action', name: 'Act_ThemeDunkel' }
                ],
                else: [
                    { type: 'action', name: 'Act_StilHell' },
                    { type: 'action', name: 'Act_ThemeHell' }
                ]
            }]
        },
        ...chapters.map(c => ({
            name: `Zu_${c.navId}`, description: `Öffnet Kapitel ${c.num}`, triggerMode: 'local-sync', params: [],
            id: uid('task'),
            actionSequence: [{ type: 'action', name: `Act_Zu_${c.navId}` }]
        }))
    ];
    return { actions, tasks };
}

function chapterActionsAndTasks(chapter, prevStageId, nextStageId, pageCount) {
    const actVor = `Act_NavVor_${chapter.navId}`;
    const actZurueck = `Act_NavZurueck_${chapter.navId}`;
    const actSetGelesen = `Act_SetGelesen_${chapter.navId}`;
    const actIncFortschritt = `Act_IncFortschritt_${chapter.navId}`;
    const actUpdateProg = `Act_UpdateProg_${chapter.navId}`;
    const actUpdateBtn = `Act_UpdateBtn_${chapter.navId}`;

    const actions = [
        { id: uid('act'), name: actVor, type: 'navigate_stage', stageId: prevStageId || 'stage_overview' },
        { id: uid('act'), name: actZurueck, type: 'navigate_stage', stageId: nextStageId || 'stage_overview' },
        { id: uid('act'), name: actSetGelesen, type: 'property', changes: { [`Gelesen_${chapter.navId}`]: 'true' } },
        { id: uid('act'), name: actIncFortschritt, type: 'increment', changes: { 'Fortschritt': 1 } },
        { id: uid('act'), name: actUpdateProg, type: 'property', changes: { 'FortschrittLabel.text': '${Fortschritt} / 23 gelesen' } },
        { id: uid('act'), name: actUpdateBtn, type: 'property', changes: { 'BtnGelesen.caption': '✔ Gelesen' } }
    ];

    // Blättern: eine Show-Action pro Seite (Sichtbarkeit + Zähler + Label)
    for (let i = 1; i <= pageCount; i++) {
        const changes = { 'Seite': String(i), 'SeiteAnzeige.text': `Seite ${i} / ${pageCount}` };
        for (let j = 1; j <= pageCount; j++) changes[`KapitelSeite_${j}.visible`] = j === i ? 'true' : 'false';
        actions.push({ id: uid('act'), name: `Act_ZeigeSeite_${i}`, type: 'property', changes });
    }
    const seiteStep = (dir) => {
        const conds = [];
        // Vorwärts absteigend / rückwärts aufsteigend prüfen: Die Bedingungen
        // laufen sequenziell — ein Zielwert darf keine später geprüfte
        // Bedingung erneut auslösen, sonst kaskadiert der Sprung bis zum Rand.
        const order = Array.from({ length: pageCount }, (_, i) => i + 1);
        if (dir > 0) order.reverse();
        for (const i of order) {
            const target = i + dir;
            if (target < 1 || target > pageCount) continue;
            conds.push({
                type: 'condition',
                condition: { variable: 'Seite', operator: '==', value: String(i) },
                then: [{ type: 'action', name: `Act_ZeigeSeite_${target}` }],
                else: []
            });
        }
        return conds;
    };

    const tasks = [
        {
            name: 'NavVor', description: 'Vorheriges Kapitel', triggerMode: 'local-sync', params: [], id: uid('task'),
            actionSequence: [{ type: 'action', name: actVor }]
        },
        {
            name: 'NavZurueck', description: 'Nächstes Kapitel', triggerMode: 'local-sync', params: [], id: uid('task'),
            actionSequence: [{ type: 'action', name: actZurueck }]
        },
        {
            name: 'KapitelGelesen', description: 'Kapitel als gelesen markieren', triggerMode: 'local-sync',
            params: [], id: uid('task'),
            actionSequence: [{
                type: 'condition',
                condition: { variable: `Gelesen_${chapter.navId}`, operator: '==', value: 'false' },
                then: [
                    { type: 'action', name: actSetGelesen },
                    { type: 'action', name: actIncFortschritt },
                    { type: 'action', name: actUpdateProg },
                    { type: 'action', name: actUpdateBtn }
                ],
                else: []
            }]
        },
        {
            name: 'SeiteWeiter', description: 'Nächste Inhaltsseite', triggerMode: 'local-sync',
            params: [], id: uid('task'), actionSequence: seiteStep(1)
        },
        {
            name: 'SeiteZurueck', description: 'Vorherige Inhaltsseite', triggerMode: 'local-sync',
            params: [], id: uid('task'), actionSequence: seiteStep(-1)
        }
    ];
    return { actions, tasks };
}

function chapterStage(chapter, prevStageId, nextStageId) {
    const pages = chapter.pages;
    const multi = pages.length > 1;
    const objects = [
        {
            className: 'TLabel', name: 'KapitelTitel', x: 10, y: 1, width: 44, height: 2,
            text: `${chapter.num} — ${chapter.tocTitle}`, id: uid('title'),
            style: { fontSize: 25, fontWeight: '600', textAlign: 'left' }
        },
        // Kapitelinhalt als Seiten: Standalone-TRichText scrollt nicht
        // (overflow:hidden der Runtime), daher deklaratives Blättern.
        // fontSize 22 rendert zu ~16px (Standalone-Skalierung ~0,71).
        ...pages.map((html, i) => ({
            className: 'TRichText', name: `KapitelSeite_${i + 1}`, x: 4, y: 4, width: 88, height: 43,
            htmlContent: html, id: uid('rt'), visible: i === 0,
            style: { fontSize: 22, padding: '18px', borderRadius: 10 }
        })),
        {
            className: 'TButton', name: 'BtnPrev', x: 3, y: 49, width: 13, height: 3,
            caption: '◀ Kapitel', id: uid('prev'),
            events: { onClick: 'NavVor' }, visible: !!prevStageId
        },
        {
            className: 'TButton', name: 'BtnSeiteZurueck', x: 17.5, y: 49, width: 10, height: 3,
            caption: '◀ Seite', id: uid('sprev'), visible: multi,
            events: { onClick: 'SeiteZurueck' }
        },
        {
            className: 'TLabel', name: 'SeiteAnzeige', x: 28.5, y: 49, width: 12, height: 3,
            text: `Seite 1 / ${pages.length}`, id: uid('slbl'), visible: multi,
            style: { fontSize: 16, textAlign: 'center' }
        },
        {
            className: 'TButton', name: 'BtnSeiteWeiter', x: 41.5, y: 49, width: 10, height: 3,
            caption: 'Seite ▶', id: uid('snext'), visible: multi,
            events: { onClick: 'SeiteWeiter' }
        },
        {
            className: 'TButton', name: 'BtnGelesen', x: 54, y: 49, width: 19, height: 3,
            caption: '☐ Als gelesen markieren', id: uid('done'),
            events: { onClick: 'KapitelGelesen' }
        },
        {
            className: 'TButton', name: 'BtnNext', x: 76, y: 49, width: 16, height: 3,
            caption: 'Kapitel ▶', id: uid('next'),
            events: { onClick: 'NavZurueck' }
        }
    ];
    const { actions, tasks } = chapterActionsAndTasks(chapter, prevStageId, nextStageId, pages.length);
    actions.push(...stageStyleActions({
        buttons: ['BtnPrev', 'BtnNext', 'BtnGelesen', 'BtnSeiteZurueck', 'BtnSeiteWeiter'],
        labels: ['KapitelTitel', 'SeiteAnzeige'],
        rts: pages.map((_, i) => `KapitelSeite_${i + 1}`)
    }));
    return {
        id: chapter.stageId, name: `${chapter.num} ${chapter.tocTitle}`, type: 'standard',
        objects, tasks,
        actions,
        // Stage-Variable für die Blätterposition (Scope 'stage' — pro Kapitel eigenständig)
        variables: [{
            className: 'TIntegerVariable', isVariable: true, scope: 'stage',
            name: 'Seite', type: 'integer', defaultValue: 1, value: 1, id: uid('var')
        }],
        flowCharts: {}, events: {}, grid: { ...GRID }
    };
}

function overviewStage(chapters) {
    const objects = [
        {
            className: 'TLabel', name: 'Titel', x: 10, y: 1, width: 50, height: 3,
            text: '📖 GCS Autoren-Handbuch', id: uid('ovtitle'),
            style: { fontSize: 30, fontWeight: '700', textAlign: 'left' }
        },
        {
            className: 'TLabel', name: 'TeilA', x: 4, y: 4.5, width: 60, height: 2,
            text: '🌱 Teil A — „Mein erster interaktiver Baum" (Einsteiger)',
            id: uid('pa'), style: { fontSize: 22, fontWeight: '600' }
        },
        {
            className: 'TLabel', name: 'TeilB', x: 4, y: 31.5, width: 60, height: 2,
            text: '🌳 Teil B — „Der wachsende Baum" (Fortgeschritten)',
            id: uid('pb'), style: { fontSize: 22, fontWeight: '600' }
        },
        {
            className: 'TLabel', name: 'Hinweis', x: 4, y: 49.5, width: 88, height: 2,
            text: 'Tipp: Kapitel-Karten anklicken. Fortschritt wird für diese Sitzung gezählt.',
            id: uid('hint'), style: { fontSize: 16, textAlign: 'center' }
        }
    ];
    const aChaps = chapters.filter(c => !c.navId.startsWith('b'));
    const bChaps = chapters.filter(c => c.navId.startsWith('b'));
    const place = (list, startY) => list.forEach((c, i) => {
        const col = i % 3, row = Math.floor(i / 3);
        objects.push({
            className: 'TButton', name: `Karte_${c.navId}`,
            x: 4 + col * 31, y: startY + row * 4.9, width: 28, height: 4.2,
            caption: `${c.num} · ${c.tocTitle}`, id: uid('card'),
            style: { fontSize: 21, textAlign: 'left' },
            events: { onClick: `Zu_${c.navId}` }
        });
    });
    place(aChaps, 7);
    place(bChaps, 34);
    return {
        id: 'stage_overview', name: 'Übersicht', type: 'standard',
        objects, tasks: [],
        actions: stageStyleActions({
            buttons: chapters.map(c => `Karte_${c.navId}`),
            labels: ['Titel', 'TeilA', 'TeilB', 'Hinweis']
        }),
        variables: [], flowCharts: {}, events: {}, grid: { ...GRID }
    };
}

function searchStage(chapters) {
    const objects = [
        {
            className: 'TLabel', name: 'SuchTitel', x: 10, y: 1, width: 44, height: 2,
            text: '🔍 Suche im Handbuch', id: uid('stitle'),
            style: { fontSize: 24, fontWeight: '600' }
        },
        {
            className: 'TEdit', name: 'SuchFeld', x: 20, y: 5, width: 40, height: 3,
            placeholder: 'Suchbegriff eingeben und Enter drücken …', id: uid('edit'),
            events: { onEnter: 'SucheAusfuehren' }
        },
        {
            className: 'TButton', name: 'BtnSuchen', x: 62, y: 5, width: 12, height: 3,
            caption: 'Suchen', id: uid('sbtn'), events: { onClick: 'SucheAusfuehren' }
        },
        {
            className: 'TLabel', name: 'SuchHinweis', x: 20, y: 9, width: 56, height: 2,
            text: 'Leere Suche zeigt alle Kapitel. Durchsucht werden Titel, Lernziele und Kapiteltext.',
            id: uid('shint'), style: { fontSize: 16 }
        }
    ];
    const actions = [];
    const sucheTask = {
        name: 'SucheAusfuehren', description: 'Filtert die Trefferliste',
        triggerMode: 'local-sync', params: [], id: uid('task'), actionSequence: []
    };
    const tasks = [sucheTask];
    chapters.forEach((c, i) => {
        const col = i % 2, row = Math.floor(i / 2);
        objects.push({
            className: 'TButton', name: `Treffer_${c.navId}`,
            x: 12 + col * 38, y: 11.5 + row * 3.4, width: 36, height: 2.8,
            caption: `${c.num} · ${c.tocTitle}`, id: uid('hit'),
            style: { fontSize: 17, textAlign: 'left' },
            visible: false,
            events: { onClick: `Zu_${c.navId}` }
        });
        const calcActName = `Act_CalcTreffer_${c.navId}`;
        actions.push({
            id: uid('act'),
            name: calcActName,
            type: 'calculate',
            formula: `(SuchText_${c.navId}.value||'').toLowerCase().includes((SuchFeld.text||'').toLowerCase())`,
            resultVariable: `Treffer_${c.navId}.visible`
        });
        sucheTask.actionSequence.push({
            type: 'action',
            name: calcActName
        });
    });
    actions.push(...stageStyleActions({
        buttons: ['BtnSuchen', ...chapters.map(c => `Treffer_${c.navId}`)],
        labels: ['SuchTitel', 'SuchHinweis'],
        edits: ['SuchFeld']
    }));
    return {
        id: 'stage_suche', name: 'Suche', type: 'standard',
        objects, tasks, actions, variables: [], flowCharts: {}, events: {},
        grid: { ...GRID }
    };
}

function buildProject(chapters) {
    chapters.forEach(c => {
        c.stageId = `stage_${c.navId}`;
        c.pages = splitChapterHtml(c.htmlGcs);
    });
    const maxPages = Math.max(...chapters.map(c => c.pages.length));
    const stages = [];
    const { actions: bpActions, tasks: bpTasks } = headerActionsAndTasks(chapters, maxPages);
    // Blueprint: Dienste, globale Variablen, globale Kopfzeile sowie globale Navigationstasks & Actions
    stages.push({
        id: 'stage_blueprint', name: 'Globale Basis', type: 'blueprint',
        objects: [{
            className: 'TStageController', name: 'StageController', x: 1, y: 1,
            scope: 'global', isService: true, isHiddenInRun: true, id: uid('sc')
        },
        // Kopfzeile (Home/Suche/Theme/Fortschritt) — die Runtime merged
        // Blueprint-Objekte in jede Stage (RuntimeStageManager).
        ...headerObjects('stage_blueprint')],
        tasks: bpTasks, actions: bpActions,
        // Läuft bei jedem Stage-Eintritt (globaler Blueprint-Fallback,
        // RuntimeStageService) und stellt Objekt-Stile zum Modus her.
        events: { onEnter: 'StyleAnwenden' },
        variables: [
            // CMS_LAUNCH=true unterdrückt den Netzwerk-/Multiplayer-Manager des
            // Standalone-Players (player-standalone.ts) — das Handbuch ist lokal.
            { className: 'TBooleanVariable', isVariable: true, scope: 'global', name: 'CMS_LAUNCH', type: 'boolean', defaultValue: true, value: true, id: uid('var') },
            { className: 'TIntegerVariable', isVariable: true, scope: 'global', name: 'Fortschritt', type: 'integer', defaultValue: 0, value: 0, id: uid('var') },
            { className: 'TBooleanVariable', isVariable: true, scope: 'global', name: 'Dunkelmodus', type: 'boolean', defaultValue: false, value: false, id: uid('var') },
            // Stage-Hintergrund wird interpoliert (grid.backgroundColor =
            // '${Hintergrund.value}') — die Act_Stil*-Actions setzen den Wert.
            { className: 'TStringVariable', isVariable: true, scope: 'global', name: 'Hintergrund', type: 'string', defaultValue: '#f6f8fc', value: '#f6f8fc', id: uid('var') },
            ...chapters.map(c => ({
                className: 'TBooleanVariable', isVariable: true, scope: 'global',
                name: `Gelesen_${c.navId}`, type: 'boolean', defaultValue: false, value: false,
                id: uid('var')
            })),
            ...chapters.map(c => ({
                className: 'TStringVariable', isVariable: true, scope: 'global',
                name: `SuchText_${c.navId}`, type: 'string',
                defaultValue: c.searchText, value: c.searchText, id: uid('var')
            }))
        ],
        flowCharts: {}, grid: { ...GRID }
    });
    stages.push(overviewStage(chapters));
    stages.push(searchStage(chapters));
    chapters.forEach((c, i) => {
        stages.push(chapterStage(
            c,
            i > 0 ? chapters[i - 1].stageId : null,
            i < chapters.length - 1 ? chapters[i + 1].stageId : 'stage_overview'
        ));
    });
    return {
        meta: {
            id: 'gcs-autoren-handbuch', name: 'GCS Autoren-Handbuch',
            author: 'GCS Dokumentationsprojekt', version: '1.0.0',
            description: 'Deklarative GCS-Umsetzung des Autoren-Handbuchs (23 Kapitel).'
        },
        stage: { grid: { ...GRID } },
        stages,
        themes: THEMES,
        activeThemeId: 'handbook-hell',
        activeStageId: 'stage_overview',
        actions: [], tasks: [], variables: [], objects: [],
        flow: {}, input: {}, splashObjects: [], schemaVersion: '3.22.0'
    };
}

/* ─────────────────────────────────────────────────────────────
   4. Hauptprogramm
   ───────────────────────────────────────────────────────────── */
function main() {
    const chapters = parseReadme();
    if (chapters.length !== 23) {
        console.error(`ERWARTET 23 Kapitel, gefunden: ${chapters.length}`);
        process.exit(1);
    }
    for (const c of chapters) {
        const md = fs.readFileSync(path.join(SRC, c.file), 'utf-8');
        const titleM = md.match(/^#\s+(.+)$/m);
        c.title = titleM ? titleM[1].replace(/[#*_]/g, '').trim() : c.tocTitle;
        c.html = renderHtml(md, 'modern');
        c.htmlGcs = renderHtml(md, 'gcs');
        c.text = plainText(md);
        c.searchText = `${c.num} ${c.tocTitle} ${c.lernziel} ${c.text}`.slice(0, 20000);
    }

    fs.mkdirSync(OUT_SHARED, { recursive: true });
    fs.mkdirSync(OUT_GCS, { recursive: true });

    const contentJs =
        `// GENERIERT von scripts/build-handbook.cjs — nicht manuell bearbeiten.\n` +
        `window.HANDBOOK = ${JSON.stringify({
            title: 'GCS Autoren-Handbuch',
            generated: new Date().toISOString().slice(0, 10),
            chapters: chapters.map(c => ({
                id: c.navId, file: c.file, num: c.num, part: c.navId.startsWith('b') ? 'B' : 'A',
                title: c.tocTitle, fullTitle: c.title, lernziel: c.lernziel, ergebnis: c.ergebnis,
                html: c.html, text: c.text
            }))
        }, null, 1)};\n`;
    fs.writeFileSync(path.join(OUT_SHARED, 'handbook-content.js'), contentJs, 'utf-8');

    const project = buildProject(chapters);
    fs.writeFileSync(
        path.join(OUT_GCS, 'project.js'),
        `// GENERIERT von scripts/build-handbook.cjs — nicht manuell bearbeiten.\nwindow.PROJECT = ${JSON.stringify(project)};\n`,
        'utf-8'
    );

    console.log(`OK — ${chapters.length} Kapitel verarbeitet`);
    console.log(`  shared/handbook-content.js  ${(fs.statSync(path.join(OUT_SHARED, 'handbook-content.js')).size / 1024).toFixed(0)} KB`);
    console.log(`  gcs-native/project.js       ${(fs.statSync(path.join(OUT_GCS, 'project.js')).size / 1024).toFixed(0)} KB`);
}
main();
