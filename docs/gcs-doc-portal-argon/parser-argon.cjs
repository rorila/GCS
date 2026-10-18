/**
 * parser-argon.cjs — Markdown-, Tabellen-, Komponenten- und Querverweis-Parser
 * für das GCS Documentation Portal (Argon).
 * Liest alle Quellen strikt read-only und erzeugt reichhaltiges HTML + Metadaten.
 */
const fs = require('node:fs');
const path = require('node:path');

// Kapitel-Spezifikation (23 Kapitel: 15 Teil A + 8 Teil B)
const CHAPTER_SPECS = [
  { id: 'kapitel-01', num: 'A1', index: 1, part: 'A', group: 'A1 — Ankommen im Editor', file: 'kapitel-01-projekt-anlegen.md', shortTitle: 'Projekt anlegen' },
  { id: 'kapitel-02', num: 'A2', index: 2, part: 'A', group: 'A1 — Ankommen im Editor', file: 'kapitel-02-arbeitsplatz.md', shortTitle: 'Der Arbeitsplatz' },
  { id: 'kapitel-03', num: 'A3', index: 3, part: 'A', group: 'A1 — Ankommen im Editor', file: 'kapitel-03-baum-platzieren.md', shortTitle: 'Den Baum platzieren' },
  { id: 'kapitel-04', num: 'A4', index: 4, part: 'A', group: 'A2 — Logik ohne Programmieren', file: 'kapitel-04-variablen-wasser.md', shortTitle: 'Variablen: Wasservorrat' },
  { id: 'kapitel-05', num: 'A5', index: 5, part: 'A', group: 'A2 — Logik ohne Programmieren', file: 'kapitel-05-tasks-verstehen.md', shortTitle: 'Tasks verstehen' },
  { id: 'kapitel-06', num: 'A6', index: 6, part: 'A', group: 'A2 — Logik ohne Programmieren', file: 'kapitel-06-giess-knopf.md', shortTitle: 'Aktionen: Gieß-Knopf' },
  { id: 'kapitel-07', num: 'A7', index: 7, part: 'A', group: 'A2 — Logik ohne Programmieren', file: 'kapitel-07-bedingungen.md', shortTitle: 'Bedingungen' },
  { id: 'kapitel-08', num: 'A8', index: 8, part: 'A', group: 'A2 — Logik ohne Programmieren', file: 'kapitel-08-flow-editor.md', shortTitle: 'Der Flow-Editor' },
  { id: 'kapitel-09', num: 'A9', index: 9, part: 'A', group: 'A2 — Logik ohne Programmieren', file: 'kapitel-09-wachstumsstufen.md', shortTitle: 'Wachstumsstufen' },
  { id: 'kapitel-10', num: 'A10', index: 10, part: 'A', group: 'A3 — Leben einhauchen', file: 'kapitel-10-durst-timer.md', shortTitle: 'Der Durst-Timer' },
  { id: 'kapitel-11', num: 'A11', index: 11, part: 'A', group: 'A3 — Leben einhauchen', file: 'kapitel-11-bilder-media.md', shortTitle: 'Bildquellen & Media' },
  { id: 'kapitel-12', num: 'A12', index: 12, part: 'A', group: 'A3 — Leben einhauchen', file: 'kapitel-12-game-state.md', shortTitle: 'Game State & Sieg' },
  { id: 'kapitel-13', num: 'A13', index: 13, part: 'A', group: 'A4 — Testen & Teilen', file: 'kapitel-13-run-test.md', shortTitle: 'Im Run-Modus testen' },
  { id: 'kapitel-14', num: 'A14', index: 14, part: 'A', group: 'A4 — Testen & Teilen', file: 'kapitel-14-export.md', shortTitle: 'Speichern & Export' },
  { id: 'kapitel-15', num: 'A15', index: 15, part: 'A', group: 'A4 — Testen & Teilen', file: 'kapitel-15-feintuning.md', shortTitle: 'Feintuning & Abschluss' },
  { id: 'b-kapitel-01', num: 'B1', index: 16, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-01-aufgaben-stufe.md', shortTitle: 'Die Aufgaben-Stufe' },
  { id: 'b-kapitel-02', num: 'B2', index: 17, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-02-richtige-antworten.md', shortTitle: 'Lernfortschritt zählen' },
  { id: 'b-kapitel-03', num: 'B3', index: 18, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-03-weltreaktion.md', shortTitle: 'Weltreaktion' },
  { id: 'b-kapitel-04', num: 'B4', index: 19, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-04-baumhaus.md', shortTitle: 'Das Baumhaus entsteht' },
  { id: 'b-kapitel-05', num: 'B5', index: 20, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-05-dragdrop.md', shortTitle: 'Dekor per Drag & Drop' },
  { id: 'b-kapitel-06', num: 'B6', index: 21, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-06-neustart.md', shortTitle: 'Freiwilliger Neustart' },
  { id: 'b-kapitel-07', num: 'B7', index: 22, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-07-zufallsaufgaben.md', shortTitle: 'Zufallsaufgaben' },
  { id: 'b-kapitel-08', num: 'B8', index: 23, part: 'B', group: 'B — Lernwelt „Der wachsende Baum“', file: 'b-kapitel-08-feinschliff.md', shortTitle: 'Startmenü, Übergang & Klang' }
];

const FALLBACK_SPEAKER_SCRIPTS = {
  'kapitel-01': {
    videoTitle: 'Video (ca. 60 s): „Neues Projekt mit dem Assistenten anlegen“',
    script: 'Willkommen im GCS-Editor! Wir starten unser erstes Spiel: „Mein erster interaktiver Baum“. Klicke oben links auf Datei und wähle „Neues Projekt (angeleitet)“. Der Projekt-Assistent führt uns in sechs kurzen Schritten durch den Namen und die Grundstruktur. Direkt danach fragt der Stage-Assistent nach unserem ersten Spielfeld: Wir nennen es „Die Wiese“, aktivieren Maus-Steuerung sowie Hintergrund und Buttons. Mit einem Klick auf Fertig steht unsere Bühne bereit!',
    syncNotes: 'Fokus auf Menü Datei → Neues Projekt (angeleitet); Wizard-Schritte 1–6 im flüssigen Durchlauf; Abschluss-Zoom auf die frisch erzeugte Stage „Die Wiese“.'
  },
  'kapitel-02': {
    videoTitle: 'Video (ca. 50 s): „Rundgang durch die vier Arbeitsbereiche“',
    script: 'Schauen wir uns unseren Arbeitsplatz an: Oben liegt die Menüzeile zum Speichern und Exportieren. Links findest du die Toolbox – deine Bausteinkiste mit 11 Kategorien. In der Mitte siehst du die Stage, also dein Spielfeld, und darüber die Ansichten-Tabs wie Stage, Run und Flow. Rechts sitzt der Inspector: Klickst du ein Objekt auf der Wiese an, kannst du hier sofort seine Eigenschaften und Events anpassen.',
    syncNotes: 'Nacheinander Rahmen-Hervorhebung um A) Menüzeile, B) Toolbox, C) Stage + Tabs und D) Inspector; am Ende kurzer Klick auf den Start-Button.'
  },
  'kapitel-03': {
    videoTitle: 'Video (ca. 45 s): „Den Baum als Sprite auf die Wiese setzen“',
    script: 'Jetzt pflanzen wir unseren Baum! Öffne links in der Toolbox die Kategorie „Game“ und ziehe den Baustein „Sprite“ mitten auf die Wiese. Noch ist es ein farbiges Quadrat – unser Platzhalter. Rechts im Inspector taufen wir das Objekt auf den Namen „Baum“, setzen die Position auf x gleich 28, y gleich 20 und geben ihm unter Sprite Color ein kräftiges Blattgrün.',
    syncNotes: 'Drag & Drop von Game → Sprite auf die Stage; Nahaufnahme Inspector bei der Eingabe von Name „Baum“, Koordinaten 28/20 und Farbauswahl.'
  },
  'kapitel-04': {
    videoTitle: 'Video (ca. 50 s): „Die Variable Wasser im Komponenten-Regal“',
    script: 'Woher weiß das Spiel, wie oft wir gegossen haben? Dafür brauchen wir eine Variable als Merkzettel. Ziehe aus der Toolbox „Variablen“ eine Variable ins Projekt. Weil Variablen im Spiel unsichtbar sind, wohnen sie im Komponenten-Regal: Klicke oben links neben den Tabs auf das Regal-Symbol. Wähle die neue Variable aus, nenne sie „Wasser“, lasse den Typ auf Integer und den Startwert auf 0.',
    syncNotes: 'Ziehen der Variable; Pfeil-Animation auf den ☰-Schalter (Komponenten-Regal); Ausfüllen des Smart Variable Inspectors (Name: Wasser, Integer, 0).'
  },
  'kapitel-05': {
    videoTitle: 'Video (ca. 40 s): „Unser erster Task im Flow-Editor“',
    script: 'Ein Task ist eine benannte To-do-Liste für unser Spiel. Wechsle oben in den Tab „Flow“. Auf der dunklen Zeichenfläche klicken wir mit der rechten Maustaste ins Freie und wählen „Task hinzufügen“. Wir geben ihm den Namen „Giessen“. Schon liegt das Start-Kästchen bereit – im nächsten Kapitel füllen wir es mit Leben.',
    syncNotes: 'Tab-Wechsel auf Flow; Rechtsklick-Kontextmenü „📁 Task hinzufügen“; Namenseingabe „Giessen“ im Dialog.'
  },
  'kapitel-06': {
    videoTitle: 'Video (ca. 60 s): „Gieß-Knopf verdrahten und Wasser erhöhen“',
    script: 'Machen wir aus dem Start-Button unseren Gieß-Knopf! Auf der Stage ändern wir seine Beschriftung im Inspector auf „Gießen!“. Im Tab Events verknüpfen wir „onClick“ mit unserem Task „Giessen“. Jetzt wechseln wir in den Flow-Editor, fügen per Rechtsklick eine Aktion namens „WasserPlus1“ vom Typ „Werte addieren“ hinzu, tragen Wasser plus 1 ein und ziehen einen Pfeil vom Task zur Aktion. Fertig ist die erste Spiellogik!',
    syncNotes: 'Stage: Button-Caption ändern & Events → onClick → Giessen; Flow: Aktion anlegen, Inspector „Werte addieren“ (Wasser: 1), Pfeil ziehen von Giessen nach WasserPlus1.'
  }
};

const FILE_TO_CHAPTER_ID = {};
for (const spec of CHAPTER_SPECS) {
  FILE_TO_CHAPTER_ID[spec.file] = spec.id;
}

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function slugify(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[ä]/g, 'ae').replace(/[ö]/g, 'oe').replace(/[ü]/g, 'ue').replace(/[ß]/g, 'ss')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
}

/**
 * Formatiert Inline-Markdown und verlinkt automatisch:
 * - `T*`-Komponenten auf #components/TName
 * - `FEAT-xxxx` auf #features/FEAT-xxxx
 * - `COMP-xxxx` auf #components/TName (falls bekannt)
 * - `TD-xxx` auf #devref/technical-debt
 * - Kapitel-Links auf #handbook/<kapitel-id>
 */
function formatInlinePortal(text, knownComponents = new Set(), compIdToName = {}) {
  let out = escapeHtml(text);

  // Code spans `...`
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    const trimmed = code.trim();
    if (/^T[A-Z][a-zA-Z0-9]+$/.test(trimmed) && (knownComponents.size === 0 || knownComponents.has(trimmed))) {
      return `<a href="#components/${trimmed}" class="hb-code hb-comp-ref" title="Zur Komponentenreferenz: ${trimmed}">${trimmed}</a>`;
    }
    if (/^FEAT-\d{4}$/.test(trimmed)) {
      return `<a href="#features/${trimmed}" class="hb-code hb-feat-ref" title="Zum Feature ${trimmed}">${trimmed}</a>`;
    }
    if (/^COMP-\d{4}$/.test(trimmed) && compIdToName[trimmed]) {
      const cName = compIdToName[trimmed];
      return `<a href="#components/${cName}" class="hb-code hb-comp-ref" title="Komponente ${cName} (${trimmed})">${trimmed}</a>`;
    }
    if (/^TD-\d{3}$/.test(trimmed)) {
      return `<a href="#devref/technical-debt" class="hb-code hb-td-ref" title="Technical Debt ${trimmed}">${trimmed}</a>`;
    }
    return `<code class="hb-code">${code}</code>`;
  });

  // Markdown links [label](href)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const cleanHref = href.trim();
    const baseName = path.basename(cleanHref);
    if (FILE_TO_CHAPTER_ID[cleanHref] || FILE_TO_CHAPTER_ID[baseName]) {
      const targetId = FILE_TO_CHAPTER_ID[cleanHref] || FILE_TO_CHAPTER_ID[baseName];
      return `<a href="#handbook/${targetId}" class="hb-chapter-link">${label}</a>`;
    }
    // Component markdown link e.g. TWindow.md or ../reference/components/TSprite.md
    const compMatch = baseName.match(/^(T[A-Z][a-zA-Z0-9]+)\.md$/);
    if (compMatch) {
      return `<a href="#components/${compMatch[1]}" class="hb-chapter-link">${label}</a>`;
    }
    // Architecture markdown link
    if (cleanHref.includes('overview.md')) return `<a href="#architecture/overview" class="hb-chapter-link">${label}</a>`;
    if (cleanHref.includes('module-map.md')) return `<a href="#architecture/module-map" class="hb-chapter-link">${label}</a>`;
    if (cleanHref.includes('execution-flow.md')) return `<a href="#architecture/execution-flow" class="hb-chapter-link">${label}</a>`;
    if (cleanHref.includes('TECHNICAL-DEBT.md')) return `<a href="#devref/technical-debt" class="hb-chapter-link">${label}</a>`;
    if (cleanHref.includes('SECURITY-PLAN.md')) return `<a href="#devref/security-plan" class="hb-chapter-link">${label}</a>`;
    if (cleanHref.includes('ID-SCHEMA.md')) return `<a href="#devref/id-schema" class="hb-chapter-link">${label}</a>`;
    if (cleanHref === '_vorlage.md') {
      return `<span class="hb-doc-ref" title="docs/user-guide/_vorlage.md">${label}</span>`;
    }
    return `<span class="hb-doc-ref" title="${escapeHtml(cleanHref)}">${label}</span>`;
  });

  // Bold **...** and Italic *...*
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return out;
}

/**
 * Allgemeiner Markdown-zu-AST-Blöcke-Parser für Handbuch, Komponentenkarten, Features, Architektur & DevRef
 */
function parseMarkdownBlocks(raw, options = {}) {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const specId = options.id || 'doc';
  let title = options.defaultTitle || specId;
  let statusNote = '';
  const headings = [];
  const checklists = [];
  const screenshots = [];
  const blocks = [];
  let currentSection = '';
  let i = 0;

  while (i < lines.length) {
    const line = lines[i];

    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      i++;
      continue;
    }
    if (line.startsWith('## ')) {
      const h2Text = line.slice(3).trim();
      currentSection = h2Text;
      const hid = slugify(h2Text);
      headings.push({ level: 2, text: h2Text, id: hid });
      blocks.push({ type: 'h2', text: h2Text, id: hid });
      i++;
      continue;
    }
    if (line.startsWith('### ')) {
      const h3Text = line.slice(4).trim();
      const hid = slugify(h3Text);
      headings.push({ level: 3, text: h3Text, id: hid });
      blocks.push({ type: 'h3', text: h3Text, id: hid });
      i++;
      continue;
    }
    if (line.startsWith('#### ')) {
      const h4Text = line.slice(5).trim();
      const hid = slugify(h4Text);
      blocks.push({ type: 'h4', text: h4Text, id: hid });
      i++;
      continue;
    }
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++;
      blocks.push({ type: 'code', lang, code: codeLines.join('\n'), section: currentSection });
      continue;
    }

    const screenMatch = line.trim().match(/^`?\[SCREENSHOT FEHLT:\s*([^\]]+)\]`?$/);
    if (screenMatch) {
      const desc = screenMatch[1].trim();
      const shotIndex = screenshots.length + 1;
      const mediaFile = `${specId}-shot-${String(shotIndex).padStart(2, '0')}.png`;
      screenshots.push({ index: shotIndex, description: desc, mediaFile });
      blocks.push({ type: 'screenshot', index: shotIndex, description: desc, mediaFile, section: currentSection });
      i++;
      continue;
    }

    if (line.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        qLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const qText = qLines.join('\n').trim();
      if (!statusNote && (qText.includes('Status:') || qText.includes('Referenzkarte') || qText.includes('Generiert'))) {
        statusNote = qText.replace(/\*\*/g, '');
      }
      blocks.push({ type: 'blockquote', text: qText, section: currentSection });
      continue;
    }

    if (line.trim().startsWith('|')) {
      const tLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tLines.push(lines[i].trim());
        i++;
      }
      if (tLines.length >= 2) {
        const parseRow = r => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headers = parseRow(tLines[0]);
        const rows = [];
        for (let r = 1; r < tLines.length; r++) {
          if (/^[\s|:-]+$/.test(tLines[r])) continue;
          rows.push(parseRow(tLines[r]));
        }
        blocks.push({ type: 'table', headers, rows, section: currentSection });
      }
      continue;
    }

    if (/^(\s*[-*]\s+|✔\s+)/.test(line)) {
      const items = [];
      while (i < lines.length && /^(\s*[-*]\s+|✔\s+)/.test(lines[i])) {
        const rawItem = lines[i].replace(/^(\s*[-*]\s+|✔\s+)/, '').trim();
        const isCheck =
          lines[i].trim().startsWith('✔') ||
          rawItem.startsWith('[ ]') ||
          rawItem.startsWith('[x]') ||
          currentSection.toLowerCase().includes('fertig-check') ||
          currentSection.toLowerCase().includes('checkliste');
        const cleanItem = rawItem.replace(/^\[[ xX]\]\s*/, '');
        if (isCheck) {
          const checkId = `${specId}-chk-${checklists.length + 1}`;
          checklists.push({ id: checkId, text: cleanItem });
          items.push({ text: cleanItem, isCheck: true, checkId });
        } else {
          items.push({ text: cleanItem, isCheck: false });
        }
        i++;
      }
      blocks.push({ type: 'ul', items, section: currentSection });
      continue;
    }

    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && /^\s*\d+\.\s+/.test(lines[i])) {
        items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        i++;
      }
      blocks.push({ type: 'ol', items, section: currentSection });
      continue;
    }

    if (!line.trim()) {
      i++;
      continue;
    }

    const pLines = [];
    while (
      i < lines.length &&
      lines[i].trim() !== '' &&
      !lines[i].startsWith('#') &&
      !lines[i].startsWith('>') &&
      !lines[i].startsWith('```') &&
      !lines[i].trim().startsWith('|') &&
      !lines[i].trim().match(/^`?\[SCREENSHOT FEHLT:/) &&
      !/^---+\s*$/.test(lines[i]) &&
      !/^\s*[-*]\s+/.test(lines[i]) &&
      !/^✔\s+/.test(lines[i]) &&
      !/^\s*\d+\.\s+/.test(lines[i])
    ) {
      pLines.push(lines[i].trim());
      i++;
    }
    if (pLines.length > 0) {
      blocks.push({ type: 'p', text: pLines.join(' '), section: currentSection });
    } else {
      i++;
    }
  }

  return { title, statusNote, headings, checklists, screenshots, blocks };
}

function renderBlocksToHtml(blocks, context = {}) {
  const { knownComponents = new Set(), compIdToName = {}, skipMediaSection = false } = context;
  const fmt = txt => formatInlinePortal(txt, knownComponents, compIdToName);
  const html = [];
  let inLernziel = false;
  let inStolpersteine = false;

  for (const b of blocks) {
    if (skipMediaSection && b.section && b.section.toLowerCase().includes('medien-vorschlag')) {
      continue;
    }
    if (b.type === 'h2') {
      inLernziel = b.text.toLowerCase().includes('lernziel');
      inStolpersteine = b.text.toLowerCase().includes('stolpersteine');
      if (skipMediaSection && b.text.toLowerCase().includes('medien-vorschlag')) continue;
      html.push(`<h2 id="${b.id}" class="hb-h2">${fmt(b.text)}</h2>`);
      continue;
    }
    if (b.type === 'h3') {
      html.push(`<h3 id="${b.id}" class="hb-h3">${fmt(b.text)}</h3>`);
      continue;
    }
    if (b.type === 'h4') {
      html.push(`<h4 id="${b.id}" class="hb-h4">${fmt(b.text)}</h4>`);
      continue;
    }
    if (b.type === 'hr') {
      html.push(`<hr class="hb-hr" />`);
      continue;
    }
    if (b.type === 'p') {
      if (inLernziel) {
        html.push(`<div class="hb-callout hb-callout-goal"><div class="hb-callout-icon">🎯</div><div class="hb-callout-body"><strong>Lernziel:</strong> ${fmt(b.text)}</div></div>`);
        inLernziel = false;
      } else if (b.text.startsWith('*Quellen:') || b.text.startsWith('_Analyse:')) {
        html.push(`<div class="hb-sources">📚 ${fmt(b.text)}</div>`);
      } else {
        html.push(`<p class="hb-p">${fmt(b.text)}</p>`);
      }
      continue;
    }
    if (b.type === 'blockquote') {
      const isProof = b.text.includes('Stand:') || b.text.includes('Beleg') || b.text.includes('Referenzkarte') || b.text.includes('Generiert');
      const cls = isProof ? 'hb-callout hb-callout-proof' : 'hb-callout hb-callout-info';
      const icon = isProof ? '🔍' : '💡';
      html.push(`<blockquote class="${cls}"><div class="hb-callout-icon">${icon}</div><div class="hb-callout-body">${fmt(b.text.replace(/\n/g, '<br/>'))}</div></blockquote>`);
      continue;
    }
    if (b.type === 'screenshot') {
      html.push(`
        <figure class="hb-media-placeholder" data-media-file="${escapeHtml(b.mediaFile)}">
          <div class="hb-media-frame">
            <div class="hb-media-badge">📸 Screenshot-Platzhalter #${b.index}</div>
            <div class="hb-media-title">${fmt(b.description)}</div>
            <div class="hb-media-meta">Geplante Mediendatei: <code>shared/media/${escapeHtml(b.mediaFile)}</code></div>
          </div>
        </figure>
      `);
      continue;
    }
    if (b.type === 'code') {
      html.push(`
        <div class="hb-codeblock-wrap">
          <div class="hb-codeblock-bar">
            <span class="hb-codeblock-lang">${escapeHtml(b.lang.toUpperCase())}</span>
            <button type="button" class="hb-copy-btn" data-copy-code="true" title="Code in Zwischenablage kopieren">Kopieren</button>
          </div>
          <pre class="hb-pre"><code class="language-${escapeHtml(b.lang)}">${escapeHtml(b.code)}</code></pre>
        </div>
      `);
      continue;
    }
    if (b.type === 'table') {
      const ths = b.headers.map(h => `<th>${fmt(h)}</th>`).join('');
      const trs = b.rows.map(row => `<tr>${row.map(c => `<td>${fmt(c)}</td>`).join('')}</tr>`).join('');
      html.push(`<div class="hb-table-wrap"><table class="hb-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`);
      continue;
    }
    if (b.type === 'ul') {
      const hasChecks = b.items.some(it => it.isCheck);
      if (hasChecks) {
        const lis = b.items.map(it => {
          if (it.isCheck) {
            return `
              <li class="hb-check-item">
                <label class="hb-check-label">
                  <input type="checkbox" class="hb-check-input" data-check-id="${it.checkId}" />
                  <span class="hb-check-box"></span>
                  <span class="hb-check-text">${fmt(it.text)}</span>
                </label>
              </li>`;
          }
          return `<li>${fmt(it.text)}</li>`;
        }).join('');
        html.push(`<div class="hb-checklist-card"><div class="hb-checklist-head">✅ Interaktive Kapitel-Checkliste (Fortschritt wird im Browser gespeichert)</div><ul class="hb-checklist">${lis}</ul></div>`);
      } else {
        const lis = b.items.map(it => `<li>${fmt(it.text)}</li>`).join('');
        html.push(`<ul class="hb-ul ${inStolpersteine ? 'hb-ul-warn' : ''}">${lis}</ul>`);
      }
      continue;
    }
    if (b.type === 'ol') {
      const lis = b.items.map(it => `<li>${fmt(it)}</li>`).join('');
      html.push(`<ol class="hb-ol">${lis}</ol>`);
      continue;
    }
  }

  return html.join('\n');
}

function parseHandbookChapter(spec, userGuideDir, context) {
  const fullPath = path.join(userGuideDir, spec.file);
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
  const parsed = parseMarkdownBlocks(raw, { id: spec.id, defaultTitle: spec.shortTitle });

  const compMatches = raw.match(/\bT[A-Z][a-zA-Z0-9]+\b/g) || [];
  const components = Array.from(new Set(compMatches)).filter(c => context.knownComponents.size === 0 || context.knownComponents.has(c));

  let mediaSection = null;
  const mediaMatch = raw.match(/## Medien-Vorschlag[^\n]*\n+([\s\S]*?)(?=\n## |\n---|$)/);
  if (mediaMatch) {
    const mBlock = mediaMatch[1].trim();
    const videoMatch = mBlock.match(/\*\*Video[^*]*\*\*:?\s*([^\n]+)/);
    const scriptMatch = mBlock.match(/\*\*Sprecher-Drehbuch[^*]*\*\*:?\s*([\s\S]*?)(?=\n\*\*Sync-Hinweise|\n\n|$)/);
    const syncMatch = mBlock.match(/\*\*Sync-Hinweise[^*]*\*\*:?\s*([\s\S]*?)(?=\n\n|$)/);
    mediaSection = {
      isFallback: false,
      videoTitle: videoMatch ? videoMatch[0].replace(/\*\*/g, '').trim() : 'Video-Vorschlag',
      script: scriptMatch ? scriptMatch[1].replace(/\n+/g, ' ').replace(/^[„"]|[“"]$/g, '').trim() : mBlock,
      syncNotes: syncMatch ? syncMatch[1].replace(/\n+/g, ' ').trim() : ''
    };
  } else if (FALLBACK_SPEAKER_SCRIPTS[spec.id]) {
    mediaSection = { isFallback: true, ...FALLBACK_SPEAKER_SCRIPTS[spec.id] };
  } else {
    mediaSection = {
      isFallback: true,
      videoTitle: `Video: „${spec.shortTitle}“`,
      script: `In diesem Kapitel (${spec.num}: ${spec.shortTitle}) setzen wir den nächsten Baustein unseres Projekts Schritt für Schritt im GCS-Editor um.`,
      syncNotes: `Fokus auf Stage und Inspector für ${spec.shortTitle}.`
    };
  }

  let learningGoal = '';
  const goalMatch = raw.match(/## Lernziel\n+([\s\S]*?)(?=\n## )/);
  if (goalMatch) {
    learningGoal = goalMatch[1].replace(/\n+/g, ' ').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  }

  let sources = '';
  const sourceMatch = raw.match(/\*Quellen:([\s\S]*?)\*\s*$/);
  if (sourceMatch) {
    sources = sourceMatch[1].replace(/\n+/g, ' ').trim();
  }

  const modernHtml = renderBlocksToHtml(parsed.blocks, { ...context, skipMediaSection: true });
  const searchText = raw.replace(/```[\s\S]*?```/g, ' ').replace(/[#>*`|_\[\]()]/g, ' ').replace(/\s+/g, ' ').trim();

  return {
    ...spec,
    title: parsed.title,
    statusNote: parsed.statusNote,
    learningGoal,
    sources,
    headings: parsed.headings,
    checklists: parsed.checklists,
    screenshots: parsed.screenshots,
    components,
    mediaSection,
    modernHtml,
    searchText
  };
}

module.exports = {
  CHAPTER_SPECS,
  escapeHtml,
  slugify,
  formatInlinePortal,
  parseMarkdownBlocks,
  renderBlocksToHtml,
  parseHandbookChapter
};
