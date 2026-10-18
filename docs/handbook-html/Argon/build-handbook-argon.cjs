const fs = require('node:fs');
const path = require('node:path');

const ROOT = path.resolve(__dirname, '..', '..', '..');
const USER_GUIDE_DIR = path.join(ROOT, 'docs', 'user-guide');
const OUT_DIR = __dirname;
const SHARED_DIR = path.join(OUT_DIR, 'shared');
const MODERN_DIR = path.join(OUT_DIR, 'modern');
const NATIVE_DIR = path.join(OUT_DIR, 'gcs-native');

// Kapitel-Reihenfolge (15 Kapitel Teil A + 8 Kapitel Teil B = 23 Kapitel)
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

// Ergänzende deutsche Sprecher-Drehbücher für Kapitel 1–6 (in denen die Markdown-Quelle noch keinen Medien-Vorschlag hat)
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

// Map file links like kapitel-02-arbeitsplatz.md to chapter IDs
const FILE_TO_CHAPTER_ID = {};
for (const spec of CHAPTER_SPECS) {
  FILE_TO_CHAPTER_ID[spec.file] = spec.id;
}

function formatInline(text, mode = 'modern') {
  let out = escapeHtml(text);

  // Code spans `...`
  out = out.replace(/`([^`]+)`/g, (_, code) => {
    // Check if it's a known T* component to add a badge/tooltip class
    if (/^T[A-Z][a-zA-Z0-9]+$/.test(code.trim())) {
      const comp = code.trim();
      if (mode === 'modern') {
        return `<code class="hb-code hb-comp-ref" title="GCS-Komponente ${comp} (Referenz: docs/reference/components/${comp}.md)">${comp}</code>`;
      }
      return `<code class="gcs-code-comp">${comp}</code>`;
    }
    return `<code class="${mode === 'modern' ? 'hb-code' : 'gcs-code'}">${code}</code>`;
  });

  // Links [label](url)
  out = out.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (_, label, href) => {
    const cleanHref = href.trim();
    if (FILE_TO_CHAPTER_ID[cleanHref]) {
      const targetId = FILE_TO_CHAPTER_ID[cleanHref];
      if (mode === 'modern') {
        return `<a href="#${targetId}" class="hb-chapter-link" data-chapter="${targetId}">${label}</a>`;
      } else {
        const navId = targetId.replace(/[^a-zA-Z0-9]/g, '_');
        return `<a data-stage="stage:stage_${navId}" href="#" class="gcs-inline-link" style="color:#0ed7b5;font-weight:bold;text-decoration:underline;">${label}</a>`;
      }
    }
    if (cleanHref === '_vorlage.md') {
      return `<span class="hb-doc-ref" title="docs/user-guide/_vorlage.md">${label}</span>`;
    }
    return `<a href="${cleanHref}" target="_blank" rel="noopener">${label}</a>`;
  });

  // Bold **...**
  out = out.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // Italic *...*
  out = out.replace(/\*([^*]+)\*/g, '<em>$1</em>');

  return out;
}

function parseMarkdownChapter(spec) {
  const fullPath = path.join(USER_GUIDE_DIR, spec.file);
  const raw = fs.readFileSync(fullPath, 'utf8').replace(/\r\n/g, '\n');
  const lines = raw.split('\n');

  let title = spec.shortTitle;
  let statusNote = '';
  const headings = [];
  const checklists = [];
  const screenshots = [];
  const componentsUsed = new Set();

  // Extract T* components mentioned in text
  const compMatches = raw.match(/\bT[A-Z][a-zA-Z0-9]+\b/g) || [];
  compMatches.forEach(c => componentsUsed.add(c));

  // Extract speaker script if present in Markdown
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
    mediaSection = {
      isFallback: true,
      ...FALLBACK_SPEAKER_SCRIPTS[spec.id]
    };
  } else {
    mediaSection = {
      isFallback: true,
      videoTitle: `Video: „${spec.shortTitle}“`,
      script: `In diesem Kapitel (${spec.num}: ${spec.shortTitle}) setzen wir den nächsten Baustein unseres Projekts Schritt für Schritt im GCS-Editor um.`,
      syncNotes: `Fokus auf Stage und Inspector für ${spec.shortTitle}.`
    };
  }

  // Extract Lernziel summary
  let learningGoal = '';
  const goalMatch = raw.match(/## Lernziel\n+([\s\S]*?)(?=\n## )/);
  if (goalMatch) {
    learningGoal = goalMatch[1].replace(/\n+/g, ' ').replace(/\*\*([^*]+)\*\*/g, '$1').replace(/`([^`]+)`/g, '$1').trim();
  }

  // Extract Quellen
  let sources = '';
  const sourceMatch = raw.match(/\*Quellen:([\s\S]*?)\*\s*$/);
  if (sourceMatch) {
    sources = sourceMatch[1].replace(/\n+/g, ' ').trim();
  }

  // Now compile AST blocks to render both Modern HTML and GCS-Native (DOMPurify-safe) HTML
  const blocks = [];
  let i = 0;
  let currentSection = '';

  while (i < lines.length) {
    const line = lines[i];

    // H1
    if (line.startsWith('# ')) {
      title = line.slice(2).trim();
      i++;
      continue;
    }

    // H2
    if (line.startsWith('## ')) {
      const h2Text = line.slice(3).trim();
      currentSection = h2Text;
      const hid = slugify(h2Text);
      headings.push({ level: 2, text: h2Text, id: hid });
      blocks.push({ type: 'h2', text: h2Text, id: hid });
      i++;
      continue;
    }

    // H3
    if (line.startsWith('### ')) {
      const h3Text = line.slice(4).trim();
      const hid = slugify(h3Text);
      headings.push({ level: 3, text: h3Text, id: hid });
      blocks.push({ type: 'h3', text: h3Text, id: hid });
      i++;
      continue;
    }

    // Horizontal rule
    if (/^---+\s*$/.test(line)) {
      blocks.push({ type: 'hr' });
      i++;
      continue;
    }

    // Fenced code block
    if (line.startsWith('```')) {
      const lang = line.slice(3).trim() || 'text';
      const codeLines = [];
      i++;
      while (i < lines.length && !lines[i].startsWith('```')) {
        codeLines.push(lines[i]);
        i++;
      }
      i++; // skip closing ```
      blocks.push({ type: 'code', lang, code: codeLines.join('\n') });
      continue;
    }

    // Screenshot placeholder line `[SCREENSHOT FEHLT: ...]`
    const screenMatch = line.trim().match(/^`?\[SCREENSHOT FEHLT:\s*([^\]]+)\]`?$/);
    if (screenMatch) {
      const desc = screenMatch[1].trim();
      const shotIndex = screenshots.length + 1;
      const mediaFile = `${spec.id}-shot-${String(shotIndex).padStart(2, '0')}.png`;
      screenshots.push({ index: shotIndex, description: desc, mediaFile });
      blocks.push({ type: 'screenshot', index: shotIndex, description: desc, mediaFile });
      i++;
      continue;
    }

    // Blockquote > ...
    if (line.startsWith('>')) {
      const qLines = [];
      while (i < lines.length && lines[i].startsWith('>')) {
        qLines.push(lines[i].replace(/^>\s?/, ''));
        i++;
      }
      const qText = qLines.join('\n').trim();
      if (!statusNote && qText.toLowerCase().includes('status:')) {
        statusNote = qText.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/\n+/g, ' ');
      }
      blocks.push({ type: 'blockquote', text: qText, isProof: qText.includes('Nachweis:') || qText.includes('Nachweise:') });
      continue;
    }

    // Table | ... |
    if (line.trim().startsWith('|')) {
      const tLines = [];
      while (i < lines.length && lines[i].trim().startsWith('|')) {
        tLines.push(lines[i].trim());
        i++;
      }
      if (tLines.length >= 2) {
        const parseRow = (r) => r.replace(/^\||\|$/g, '').split('|').map(c => c.trim());
        const headers = parseRow(tLines[0]);
        const rows = [];
        for (let r = 2; r < tLines.length; r++) {
          rows.push(parseRow(tLines[r]));
        }
        blocks.push({ type: 'table', headers, rows });
      }
      continue;
    }

    // Checklist - [ ] ...
    if (/^\s*-\s*\[\s*[xX ]?\s*\]\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*-\s*\[\s*[xX ]?\s*\]\s+/.test(lines[i]) || (lines[i].startsWith('  ') && items.length > 0))) {
        if (/^\s*-\s*\[\s*[xX ]?\s*\]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*-\s*\[\s*[xX ]?\s*\]\s+/, '').trim());
        } else {
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      items.forEach(it => checklists.push(it));
      blocks.push({ type: 'checklist', items });
      continue;
    }

    // Unordered list (- ... or ✔ ...)
    if (/^\s*[-*]\s+/.test(line) || /^✔\s+/.test(line)) {
      const isLearned = line.startsWith('✔');
      const items = [];
      while (i < lines.length && (/^\s*[-*]\s+/.test(lines[i]) || /^✔\s+/.test(lines[i]) || (lines[i].startsWith('  ') && items.length > 0))) {
        if (/^\s*[-*]\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*[-*]\s+/, '').trim());
        } else if (/^✔\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^✔\s+/, '').trim());
        } else {
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      blocks.push({ type: 'ul', items, isLearned, section: currentSection });
      continue;
    }

    // Ordered list (1. ...)
    if (/^\s*\d+\.\s+/.test(line)) {
      const items = [];
      while (i < lines.length && (/^\s*\d+\.\s+/.test(lines[i]) || (lines[i].startsWith('   ') && items.length > 0))) {
        if (/^\s*\d+\.\s+/.test(lines[i])) {
          items.push(lines[i].replace(/^\s*\d+\.\s+/, '').trim());
        } else {
          items[items.length - 1] += ' ' + lines[i].trim();
        }
        i++;
      }
      blocks.push({ type: 'ol', items });
      continue;
    }

    // Empty line
    if (!line.trim()) {
      i++;
      continue;
    }

    // Paragraph
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

  return {
    ...spec,
    title,
    statusNote,
    learningGoal,
    sources,
    headings,
    checklists,
    screenshots,
    components: Array.from(componentsUsed),
    mediaSection,
    blocks,
    rawTextForSearch: raw
      .replace(/```[\s\S]*?```/g, ' ')
      .replace(/[#>*`|_\[\]()]/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
  };
}

function renderModernHtml(chapter) {
  const html = [];
  let inLernziel = false;
  let inStolpersteine = false;

  for (const b of chapter.blocks) {
    if (b.type === 'h2') {
      inLernziel = b.text.toLowerCase().includes('lernziel');
      inStolpersteine = b.text.toLowerCase().includes('stolpersteine');
      // Skip Medien-Vorschlag in normal flow because we render a dedicated interactive Speaker/Video Card
      if (b.text.toLowerCase().includes('medien-vorschlag')) {
        continue;
      }
      html.push(`<h2 id="${b.id}" class="hb-h2">${formatInline(b.text, 'modern')}</h2>`);
      continue;
    }
    if (b.type === 'h3') {
      html.push(`<h3 id="${b.id}" class="hb-h3">${formatInline(b.text, 'modern')}</h3>`);
      continue;
    }
    if (b.type === 'hr') {
      html.push(`<hr class="hb-hr" />`);
      continue;
    }
    if (b.type === 'p') {
      if (b.section && b.section.toLowerCase().includes('medien-vorschlag')) continue;
      if (inLernziel) {
        html.push(`<div class="hb-callout hb-callout-goal"><div class="hb-callout-icon">🎯</div><div class="hb-callout-body"><strong>Lernziel:</strong> ${formatInline(b.text, 'modern')}</div></div>`);
        inLernziel = false;
      } else if (b.text.startsWith('*Quellen:')) {
        html.push(`<div class="hb-sources">📚 ${formatInline(b.text, 'modern')}</div>`);
      } else {
        html.push(`<p class="hb-p">${formatInline(b.text, 'modern')}</p>`);
      }
      continue;
    }
    if (b.type === 'blockquote') {
      const cls = b.isProof ? 'hb-callout hb-callout-proof' : 'hb-callout hb-callout-info';
      const icon = b.isProof ? '🔎' : '💡';
      html.push(`<div class="${cls}"><div class="hb-callout-icon">${icon}</div><div class="hb-callout-body">${formatInline(b.text, 'modern')}</div></div>`);
      continue;
    }
    if (b.type === 'code') {
      html.push(`<div class="hb-codeblock-wrap"><div class="hb-codeblock-header"><span>${escapeHtml(b.lang.toUpperCase())}</span><button type="button" class="hb-copy-btn" data-copy="true">📋 Kopieren</button></div><pre class="hb-pre"><code class="hb-code-block">${escapeHtml(b.code)}</code></pre></div>`);
      continue;
    }
    if (b.type === 'screenshot') {
      html.push(`
        <figure class="hb-media-placeholder" data-media-slot="../shared/media/${b.mediaFile}">
          <div class="hb-media-frame">
            <div class="hb-media-badge">📸 SCREENSHOT-PLATZHALTER #${b.index}</div>
            <div class="hb-media-title">${formatInline(b.description, 'modern')}</div>
            <div class="hb-media-meta">Vorbereiteter Asset-Slot: <code>docs/handbook-html/shared/media/${b.mediaFile}</code></div>
          </div>
        </figure>
      `);
      continue;
    }
    if (b.type === 'table') {
      const ths = b.headers.map(h => `<th>${formatInline(h, 'modern')}</th>`).join('');
      const trs = b.rows.map(r => `<tr>${r.map(c => `<td>${formatInline(c, 'modern')}</td>`).join('')}</tr>`).join('');
      html.push(`<div class="hb-table-wrap"><table class="hb-table"><thead><tr>${ths}</tr></thead><tbody>${trs}</tbody></table></div>`);
      continue;
    }
    if (b.type === 'checklist') {
      const itemsHtml = b.items.map((it, idx) => {
        const chkId = `${chapter.id}-chk-${idx}`;
        return `<li class="hb-check-item"><label for="${chkId}"><input type="checkbox" id="${chkId}" class="hb-check-input" data-chapter="${chapter.id}" data-check-index="${idx}" /><span>${formatInline(it, 'modern')}</span></label></li>`;
      }).join('');
      html.push(`<div class="hb-checklist-box"><div class="hb-checklist-header"><span>✅ Selbst prüfen (Interaktive Funktionsprüfung)</span><span class="hb-checklist-hint">Wird lokal im Browser gespeichert</span></div><ul class="hb-checklist">${itemsHtml}</ul></div>`);
      continue;
    }
    if (b.type === 'ul') {
      const cls = b.isLearned ? 'hb-list hb-list-learned' : (inStolpersteine ? 'hb-list hb-list-pitfalls' : 'hb-list');
      const lis = b.items.map(it => `<li>${b.isLearned ? '<span class="hb-check-mark">✔</span> ' : ''}${formatInline(it, 'modern')}</li>`).join('');
      html.push(`<ul class="${cls}">${lis}</ul>`);
      continue;
    }
    if (b.type === 'ol') {
      const lis = b.items.map(it => `<li>${formatInline(it, 'modern')}</li>`).join('');
      html.push(`<ol class="hb-list hb-ol">${lis}</ol>`);
      continue;
    }
  }

  return html.join('\n');
}

/**
 * Kompiliert das Kapitel in DOMPurify-kompatibles HTML für GCS Native `TRichText`.
 * WICHTIG: `SecurityUtils.sanitizeHTML` erlaubt:
 * ['b', 'i', 'u', 'strong', 'em', 'a', 'br', 'p', 'span', 'div', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'ul', 'ol', 'li', 'blockquote', 'code', 'pre']
 * und Attribute: ['href', 'target', 'title', 'class', 'style', 'data-*']
 * Daher werden Tabellen als `<div class="gcs-table">` gerendert!
 */
function renderGcsNativeRichTextHtml(chapter, includeSpeaker = false) {
  const html = [];
  const partBadgeColor = chapter.part === 'A' ? '#10b981' : '#6366f1';
  const partLabel = chapter.part === 'A' ? '🌱 Teil A · Einsteiger-Tutorial' : '🌳 Teil B · Fortgeschrittene Lernwelt';

  html.push(`<div class="gcs-doc-article" data-chapter="${chapter.id}">`);
  html.push(`<div class="gcs-doc-header">`);
  html.push(`<div class="gcs-doc-badges"><span class="gcs-badge" style="background:${partBadgeColor};color:#ffffff;padding:3px 10px;border-radius:99px;font-size:12px;font-weight:bold;">${partLabel}</span> <span class="gcs-badge-group" style="opacity:0.75;font-size:12px;margin-left:8px;">${escapeHtml(chapter.group)}</span></div>`);
  html.push(`<h1 class="gcs-h1">${escapeHtml(chapter.title)}</h1>`);
  if (chapter.statusNote) {
    html.push(`<div class="gcs-status-note">📌 ${escapeHtml(chapter.statusNote)}</div>`);
  }
  html.push(`</div>`);

  if (includeSpeaker && chapter.mediaSection) {
    html.push(`<div class="gcs-speaker-box">`);
    html.push(`<div class="gcs-speaker-title">🎙️ Deutsches Sprecher-Drehbuch &amp; Video-Regie — ${escapeHtml(chapter.mediaSection.videoTitle)}</div>`);
    html.push(`<p class="gcs-speaker-text"><strong>Sprechertext:</strong> „${escapeHtml(chapter.mediaSection.script)}“</p>`);
    if (chapter.mediaSection.syncNotes) {
      html.push(`<p class="gcs-speaker-sync"><em>🎬 Sync- &amp; Schnitt-Hinweise: ${escapeHtml(chapter.mediaSection.syncNotes)}</em></p>`);
    }
    html.push(`</div>`);
  }

  let inLernziel = false;
  let inStolpersteine = false;

  for (const b of chapter.blocks) {
    if (b.type === 'h2') {
      inLernziel = b.text.toLowerCase().includes('lernziel');
      inStolpersteine = b.text.toLowerCase().includes('stolpersteine');
      if (b.text.toLowerCase().includes('medien-vorschlag')) continue;
      html.push(`<h2 class="gcs-h2">${formatInline(b.text, 'native')}</h2>`);
      continue;
    }
    if (b.type === 'h3') {
      html.push(`<h3 class="gcs-h3">${formatInline(b.text, 'native')}</h3>`);
      continue;
    }
    if (b.type === 'p') {
      if (b.section && b.section.toLowerCase().includes('medien-vorschlag')) continue;
      if (inLernziel) {
        html.push(`<div class="gcs-callout gcs-callout-goal"><strong>🎯 Lernziel:</strong> ${formatInline(b.text, 'native')}</div>`);
        inLernziel = false;
      } else if (b.text.startsWith('*Quellen:')) {
        html.push(`<div class="gcs-sources">📚 ${formatInline(b.text, 'native')}</div>`);
      } else {
        html.push(`<p class="gcs-p">${formatInline(b.text, 'native')}</p>`);
      }
      continue;
    }
    if (b.type === 'blockquote') {
      const cls = b.isProof ? 'gcs-callout gcs-callout-proof' : 'gcs-callout gcs-callout-info';
      html.push(`<blockquote class="${cls}">${formatInline(b.text, 'native')}</blockquote>`);
      continue;
    }
    if (b.type === 'code') {
      html.push(`<pre class="gcs-pre"><code class="gcs-codeblock">${escapeHtml(b.code)}</code></pre>`);
      continue;
    }
    if (b.type === 'screenshot') {
      html.push(`<div class="gcs-media-slot" data-slot="../shared/media/${b.mediaFile}"><strong>📸 [SCREENSHOT-PLATZHALTER #${b.index}]:</strong> ${formatInline(b.description, 'native')} <span class="gcs-media-path">(Slot: shared/media/${b.mediaFile})</span></div>`);
      continue;
    }
    if (b.type === 'table') {
      const headerCells = b.headers.map(h => `<div class="gcs-th">${formatInline(h, 'native')}</div>`).join('');
      const bodyRows = b.rows.map(r => `<div class="gcs-tr">${r.map(c => `<div class="gcs-td">${formatInline(c, 'native')}</div>`).join('')}</div>`).join('');
      html.push(`<div class="gcs-table"><div class="gcs-thead"><div class="gcs-tr gcs-tr-head">${headerCells}</div></div><div class="gcs-tbody">${bodyRows}</div></div>`);
      continue;
    }
    if (b.type === 'checklist') {
      const lis = b.items.map(it => `<li class="gcs-check-li">☐ ${formatInline(it, 'native')}</li>`).join('');
      html.push(`<div class="gcs-checklist-wrap"><div class="gcs-checklist-title">✅ Funktionsprüfung (Checkliste):</div><ul class="gcs-checklist">${lis}</ul></div>`);
      continue;
    }
    if (b.type === 'ul') {
      const cls = b.isLearned ? 'gcs-ul gcs-ul-learned' : (inStolpersteine ? 'gcs-ul gcs-ul-pitfalls' : 'gcs-ul');
      const lis = b.items.map(it => `<li>${b.isLearned ? '✔ ' : ''}${formatInline(it, 'native')}</li>`).join('');
      html.push(`<ul class="${cls}">${lis}</ul>`);
      continue;
    }
    if (b.type === 'ol') {
      const lis = b.items.map(it => `<li>${formatInline(it, 'native')}</li>`).join('');
      html.push(`<ol class="gcs-ol">${lis}</ol>`);
      continue;
    }
  }

  html.push(`</div>`);
  return html.join('\n');
}

const chapters = CHAPTER_SPECS.map(spec => {
  const parsed = parseMarkdownChapter(spec);
  return {
    ...parsed,
    modernHtml: renderModernHtml(parsed),
    nativeHtmlNormal: renderGcsNativeRichTextHtml(parsed, false),
    nativeHtmlSpeaker: renderGcsNativeRichTextHtml(parsed, true)
  };
});

fs.mkdirSync(SHARED_DIR, { recursive: true });
fs.mkdirSync(path.join(SHARED_DIR, 'media'), { recursive: true });
fs.mkdirSync(MODERN_DIR, { recursive: true });
fs.mkdirSync(NATIVE_DIR, { recursive: true });

const handbookPayload = {
  meta: {
    title: 'GCS Autoren-Handbuch',
    subtitle: 'Interaktive Spiele und Lernwelten entwickeln — Schritt für Schritt ohne Programmierkenntnisse',
    generatedAt: new Date().toISOString(),
    sourceDir: 'docs/user-guide/',
    totalChapters: chapters.length,
    partACount: chapters.filter(c => c.part === 'A').length,
    partBCount: chapters.filter(c => c.part === 'B').length
  },
  chapters: chapters.map(c => ({
    id: c.id,
    num: c.num,
    index: c.index,
    part: c.part,
    group: c.group,
    file: c.file,
    shortTitle: c.shortTitle,
    title: c.title,
    statusNote: c.statusNote,
    learningGoal: c.learningGoal,
    sources: c.sources,
    headings: c.headings,
    checklists: c.checklists,
    screenshots: c.screenshots,
    components: c.components,
    mediaSection: c.mediaSection,
    modernHtml: c.modernHtml,
    nativeHtmlNormal: c.nativeHtmlNormal,
    nativeHtmlSpeaker: c.nativeHtmlSpeaker,
    searchText: c.rawTextForSearch
  }))
};

fs.writeFileSync(
  path.join(SHARED_DIR, 'handbook-data.json'),
  JSON.stringify(handbookPayload, null, 2),
  'utf8'
);

fs.writeFileSync(
  path.join(SHARED_DIR, 'handbook-data.js'),
  `window.GCS_HANDBOOK_DATA = ${JSON.stringify(handbookPayload).replace(/</g, '\\u003c')};\n`,
  'utf8'
);

const { buildGcsNativeProject, writeGcsNativeFiles } = require('./build-gcs-native-argon.cjs');
const nativeProject = buildGcsNativeProject(chapters);
writeGcsNativeFiles(NATIVE_DIR, nativeProject, chapters);

const rtSrc = path.join(ROOT, 'public', 'runtime-standalone.js');
if (fs.existsSync(rtSrc)) {
  fs.copyFileSync(rtSrc, path.join(NATIVE_DIR, 'runtime-standalone.js'));
}

console.log(`[build-handbook-argon] Parsed ${chapters.length} chapters and built Argon editions in ${OUT_DIR}.`);
module.exports = { handbookPayload, chapters, nativeProject };

