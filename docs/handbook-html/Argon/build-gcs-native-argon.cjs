/**
 * build-gcs-native-argon.cjs — Erzeugt die GCS Native Edition (Version 2) im Ordner Argon/gcs-native/.
 * Hält sämtliche verbindlichen GCS-Architekturprinzipien ein:
 * - Deklaratives GameProject (26 Stages: stage_blueprint, stage_overview, stage_suche + 23 Kapitel-Stages)
 * - Globale Elemente (TStageController, TToast, Kopfzeile, Variablen, globale Tasks & Actions) auf stage_blueprint
 * - 100 % Action-Referenzen in Task-Sequenzen (0 Inline-Actions, checkIntegrity = 0 Befunde)
 * - DOMPurify-konformes HTML in TRichText (Tabellen als div.gcs-table, Links als data-stage)
 * - Native Persistenz über store_token & Rehydrierung beim Start analog renderCms()
 */
const fs = require('node:fs');
const path = require('node:path');

const GRID = { cols: 96, rows: 54, cellSize: 14, snapToGrid: false, visible: false };

const THEMES = [
  {
    id: 'argon-workbench-light',
    name: 'Argon Workbench Hell',
    description: 'Helle Lesedarstellung für das GCS Autoren-Handbuch',
    stage: { backgroundColor: '#f1f5f9', gridColor: '#e2e8f0' },
    components: {
      TButton: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#cbd5e1', borderWidth: 1, borderRadius: 8 },
      TPanel: { backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1, color: '#0f172a' },
      TLabel: { color: '#0f172a', backgroundColor: 'transparent' },
      TRichText: { color: '#1e293b', backgroundColor: '#ffffff', borderColor: '#cbd5e1', borderWidth: 1 },
      TEdit: { backgroundColor: '#ffffff', color: '#0f172a', borderColor: '#94a3b8' },
      TProgressBar: { backgroundColor: '#e2e8f0', color: '#059669', borderColor: '#cbd5e1' }
    }
  },
  {
    id: 'argon-workbench-dark',
    name: 'Argon Workbench Dunkel',
    description: 'Dunkle GCS-Workbench-Darstellung für das Autoren-Handbuch',
    stage: { backgroundColor: '#0b1120', gridColor: '#1e293b' },
    components: {
      TButton: { backgroundColor: '#1e293b', color: '#f1f5f9', borderColor: '#334155', borderWidth: 1, borderRadius: 8 },
      TPanel: { backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1, color: '#f1f5f9' },
      TLabel: { color: '#f1f5f9', backgroundColor: 'transparent' },
      TRichText: { color: '#e2e8f0', backgroundColor: '#111827', borderColor: '#1e293b', borderWidth: 1 },
      TEdit: { backgroundColor: '#0f172a', color: '#f1f5f9', borderColor: '#334155' },
      TProgressBar: { backgroundColor: '#1e293b', color: '#10b981', borderColor: '#334155' }
    }
  }
];

function buildGcsNativeProject(chapters) {
  let uidCounter = 0;
  const uid = (p) => `${p}_${(++uidCounter).toString(36)}`;

  chapters.forEach(c => {
    c.navId = c.part === 'B'
      ? 'b' + String(c.index - 15).padStart(2, '0')
      : 'a' + String(c.index).padStart(2, '0');
    c.stageId = `stage_${c.navId}`;
  });

  // 1. Globale Kopfzeilen-Objekte auf stage_blueprint
  const bpHeaderObjects = [
    {
      className: 'TButton', name: 'BtnHome', x: 2, y: 1, width: 10, height: 2.2,
      caption: '⌂ Übersicht', id: uid('home'),
      events: { onClick: 'NavUebersicht' }
    },
    {
      className: 'TProgressBar', name: 'FortschrittBalken', x: 52, y: 1.2, width: 10, height: 1.8,
      value: 0, maxValue: 23, showLabel: false, id: uid('pbar')
    },
    {
      className: 'TLabel', name: 'FortschrittLabel', x: 63, y: 1, width: 11, height: 2.2,
      text: '0 / 23 gelesen', id: uid('prog'),
      style: { textAlign: 'right', fontSize: 13, fontWeight: '600' }
    },
    {
      className: 'TButton', name: 'BtnSuche', x: 75, y: 1, width: 9, height: 2.2,
      caption: '🔍 Suche', id: uid('search'),
      events: { onClick: 'NavSuche' }
    },
    {
      className: 'TButton', name: 'BtnTheme', x: 85, y: 1, width: 9, height: 2.2,
      caption: '🌓 Hell/Dunkel', id: uid('theme'),
      events: { onClick: 'ThemeWechseln' }
    }
  ];

  // 2. Globale Actions & Tasks auf stage_blueprint (100 % Action-Referenzen, 0 Inline-Actions)
  const bpActions = [
    { id: uid('act'), name: 'Act_NavUebersicht', type: 'navigate_stage', stageId: 'stage_overview' },
    { id: uid('act'), name: 'Act_NavSuche', type: 'navigate_stage', stageId: 'stage_suche' },
    { id: uid('act'), name: 'Act_ThemeHell', type: 'set_active_theme', themeId: 'argon-workbench-light', savePreference: true },
    { id: uid('act'), name: 'Act_DunkelmodusAus', type: 'property', changes: { 'Dunkelmodus': 'false' } },
    { id: uid('act'), name: 'Act_ThemeDunkel', type: 'set_active_theme', themeId: 'argon-workbench-dark', savePreference: true },
    { id: uid('act'), name: 'Act_DunkelmodusAn', type: 'property', changes: { 'Dunkelmodus': 'true' } },
    ...chapters.map(c => ({
      id: uid('act'), name: `Act_Zu_${c.navId}`, type: 'navigate_stage', stageId: c.stageId
    }))
  ];

  const bpTasks = [
    {
      name: 'NavUebersicht', description: 'Zur Kursübersicht wechseln', triggerMode: 'local-sync', params: [], id: uid('task'),
      actionSequence: [{ type: 'action', name: 'Act_NavUebersicht' }]
    },
    {
      name: 'NavSuche', description: 'Zur Volltextsuche wechseln', triggerMode: 'local-sync', params: [], id: uid('task'),
      actionSequence: [{ type: 'action', name: 'Act_NavSuche' }]
    },
    {
      name: 'ThemeWechseln', description: 'Hell-/Dunkelmodus umschalten', triggerMode: 'local-sync', params: [], id: uid('task'),
      actionSequence: [{
        type: 'condition',
        condition: { variable: 'Dunkelmodus', operator: '==', value: 'true' },
        then: [
          { type: 'action', name: 'Act_ThemeHell' },
          { type: 'action', name: 'Act_DunkelmodusAus' }
        ],
        else: [
          { type: 'action', name: 'Act_ThemeDunkel' },
          { type: 'action', name: 'Act_DunkelmodusAn' }
        ]
      }]
    },
    ...chapters.map(c => ({
      name: `Zu_${c.navId}`, description: `Öffnet Kapitel ${c.num}`, triggerMode: 'local-sync', params: [], id: uid('task'),
      actionSequence: [{ type: 'action', name: `Act_Zu_${c.navId}` }]
    }))
  ];

  const bpVariables = [
    { className: 'TBooleanVariable', isVariable: true, scope: 'global', name: 'CMS_LAUNCH', type: 'boolean', defaultValue: true, value: true, id: uid('var') },
    { className: 'TIntegerVariable', isVariable: true, scope: 'global', name: 'Fortschritt', type: 'integer', defaultValue: 0, value: 0, id: uid('var') },
    { className: 'TBooleanVariable', isVariable: true, scope: 'global', name: 'Dunkelmodus', type: 'boolean', defaultValue: false, value: false, id: uid('var') },
    ...chapters.map(c => ({
      className: 'TBooleanVariable', isVariable: true, scope: 'global',
      name: `Gelesen_${c.navId}`, type: 'boolean', defaultValue: false, value: false, id: uid('var')
    })),
    ...chapters.map(c => ({
      className: 'TBooleanVariable', isVariable: true, scope: 'global',
      name: `Sprecher_${c.navId}`, type: 'boolean', defaultValue: false, value: false, id: uid('var')
    })),
    ...chapters.map(c => ({
      className: 'TStringVariable', isVariable: true, scope: 'global',
      name: `SuchText_${c.navId}`, type: 'string',
      defaultValue: `${c.num} ${c.shortTitle} ${c.title} ${c.learningGoal} ${c.rawTextForSearch}`.slice(0, 20000),
      value: `${c.num} ${c.shortTitle} ${c.title} ${c.learningGoal} ${c.rawTextForSearch}`.slice(0, 20000),
      id: uid('var')
    }))
  ];

  const stageBlueprint = {
    id: 'stage_blueprint', name: 'Globale Basis (Blueprint)', type: 'blueprint',
    objects: [
      {
        className: 'TStageController', name: 'StageController', x: 1, y: 1,
        scope: 'global', isService: true, isHiddenInRun: true, id: uid('sc')
      },
      {
        className: 'TToast', name: 'HandbookToast', x: 1, y: 2,
        scope: 'global', isService: true, isHiddenInRun: true, id: uid('toast')
      },
      ...bpHeaderObjects
    ],
    tasks: bpTasks,
    actions: bpActions,
    variables: bpVariables,
    flowCharts: {}, events: {}, grid: { ...GRID }
  };

  // 3. Stage: Kursübersicht (stage_overview)
  const ovObjects = [
    {
      className: 'TLabel', name: 'Titel', x: 13, y: 1, width: 38, height: 2.4,
      text: '📖 GCS Autoren-Handbuch', id: uid('ovtitle'),
      style: { fontSize: 22, fontWeight: '700', textAlign: 'left' }
    },
    {
      className: 'TLabel', name: 'TeilA', x: 4, y: 4.8, width: 60, height: 2,
      text: '🌱 Teil A — „Mein erster interaktiver Baum" (15 Einsteiger-Kapitel)',
      id: uid('pa'), style: { fontSize: 15, fontWeight: '700' }
    },
    {
      className: 'TLabel', name: 'TeilB', x: 4, y: 29.8, width: 60, height: 2,
      text: '🌳 Teil B — „Der wachsende Baum" (8 Fortgeschrittenen-Kapitel)',
      id: uid('pb'), style: { fontSize: 15, fontWeight: '700' }
    },
    {
      className: 'TLabel', name: 'Hinweis', x: 4, y: 50.8, width: 88, height: 2,
      text: 'Tipp: Klicke eine Kapitel-Karte an. Dein Lernfortschritt und das gewählte Theme werden lokal im Browser gespeichert.',
      id: uid('hint'), style: { fontSize: 12, textAlign: 'center' }
    }
  ];

  const placeCards = (list, startY) => list.forEach((c, i) => {
    const col = i % 4, row = Math.floor(i / 4);
    ovObjects.push({
      className: 'TButton', name: `Karte_${c.navId}`,
      x: 4 + col * 22.5, y: startY + row * 4.6, width: 21, height: 3.7,
      caption: `${c.num} · ${c.shortTitle}`, id: uid('card'),
      style: { fontSize: 12, textAlign: 'left' },
      events: { onClick: `Zu_${c.navId}` }
    });
  });
  placeCards(chapters.filter(c => c.part === 'A'), 7.4);
  placeCards(chapters.filter(c => c.part === 'B'), 32.4);

  const stageOverview = {
    id: 'stage_overview', name: 'Kursübersicht', type: 'standard',
    objects: ovObjects, tasks: [], actions: [], variables: [],
    flowCharts: {}, events: {}, grid: { ...GRID }
  };

  // 4. Stage: Volltextsuche (stage_suche)
  const searchObjects = [
    {
      className: 'TLabel', name: 'SuchTitel', x: 13, y: 1, width: 38, height: 2.2,
      text: '🔍 Volltextsuche im Handbuch', id: uid('stitle'),
      style: { fontSize: 18, fontWeight: '700' }
    },
    {
      className: 'TEdit', name: 'SuchFeld', x: 16, y: 5, width: 46, height: 3,
      placeholder: 'Suchbegriff eingeben und Enter drücken …', id: uid('edit'),
      events: { onEnter: 'SucheAusfuehren' }
    },
    {
      className: 'TButton', name: 'BtnSuchen', x: 64, y: 5, width: 14, height: 3,
      caption: '🔍 Suchen', id: uid('sbtn'),
      events: { onClick: 'SucheAusfuehren' }
    },
    {
      className: 'TLabel', name: 'SuchHinweis', x: 16, y: 8.8, width: 64, height: 2,
      text: 'Durchsucht Titel, Lernziele, Bausteine und Volltext aller 23 Kapitel. Klick auf einen Treffer öffnet das Kapitel.',
      id: uid('shint'), style: { fontSize: 12 }
    }
  ];

  const searchActions = [];
  const sucheTask = {
    name: 'SucheAusfuehren', description: 'Filtert die 23 Kapitel-Trefferkarten',
    triggerMode: 'local-sync', params: [], id: uid('task'), actionSequence: []
  };

  chapters.forEach((c, i) => {
    const col = i % 2, row = Math.floor(i / 2);
    searchObjects.push({
      className: 'TButton', name: `Treffer_${c.navId}`,
      x: 10 + col * 40, y: 11.4 + row * 3.3, width: 38, height: 2.7,
      caption: `${c.num} · ${c.shortTitle} — ${c.title}`, id: uid('hit'),
      style: { fontSize: 12, textAlign: 'left' },
      visible: false,
      events: { onClick: `Zu_${c.navId}` }
    });
    const actName = `Act_CalcTreffer_${c.navId}`;
    searchActions.push({
      id: uid('act'),
      name: actName,
      type: 'calculate',
      formula: `(SuchText_${c.navId}.value||'').toLowerCase().includes((SuchFeld.text||'').toLowerCase())`,
      resultVariable: `Treffer_${c.navId}.visible`
    });
    sucheTask.actionSequence.push({ type: 'action', name: actName });
  });

  const stageSuche = {
    id: 'stage_suche', name: 'Volltextsuche', type: 'standard',
    objects: searchObjects, tasks: [sucheTask], actions: searchActions,
    variables: [], flowCharts: {}, events: {}, grid: { ...GRID }
  };

  // 5. 23 Kapitel-Stages (stage_a01 .. stage_b08)
  const chapterStages = chapters.map((c, idx) => {
    const prevStageId = idx > 0 ? chapters[idx - 1].stageId : null;
    const nextStageId = idx < chapters.length - 1 ? chapters[idx + 1].stageId : 'stage_overview';

    const actVor = `Act_NavVor_${c.navId}`;
    const actZurueck = `Act_NavZurueck_${c.navId}`;
    const actSetGelesen = `Act_SetGelesen_${c.navId}`;
    const actIncFortschritt = `Act_IncFortschritt_${c.navId}`;
    const actUpdateProg = `Act_UpdateProg_${c.navId}`;
    const actUpdateBar = `Act_UpdateBar_${c.navId}`;
    const actUpdateBtn = `Act_UpdateBtn_${c.navId}`;
    const actSaveToken = `Act_SaveToken_${c.navId}`;
    const actShowSpeaker = `Act_ShowSpeaker_${c.navId}`;
    const actHideSpeaker = `Act_HideSpeaker_${c.navId}`;

    const actions = [
      { id: uid('act'), name: actVor, type: 'navigate_stage', stageId: prevStageId || 'stage_overview' },
      { id: uid('act'), name: actZurueck, type: 'navigate_stage', stageId: nextStageId || 'stage_overview' },
      { id: uid('act'), name: actSetGelesen, type: 'property', changes: { [`Gelesen_${c.navId}`]: 'true' } },
      { id: uid('act'), name: actIncFortschritt, type: 'increment', changes: { 'Fortschritt': 1 } },
      { id: uid('act'), name: actUpdateProg, type: 'property', changes: { 'FortschrittLabel.text': '${Fortschritt} / 23 gelesen' } },
      { id: uid('act'), name: actUpdateBar, type: 'property', changes: { 'FortschrittBalken.value': '${Fortschritt}' } },
      { id: uid('act'), name: actUpdateBtn, type: 'property', changes: { 'BtnGelesen.caption': '✔ Gelesen' } },
      { id: uid('act'), name: actSaveToken, type: 'store_token', tokenKey: `gcs_argon_done_${c.navId}`, token: 'true' },
      {
        id: uid('act'), name: actShowSpeaker, type: 'property',
        changes: {
          [`Sprecher_${c.navId}`]: 'true',
          'BtnSprecher.caption': '🎙️ Drehbuch: EIN',
          'KapitelInhalt.htmlContent': c.nativeHtmlSpeaker
        }
      },
      {
        id: uid('act'), name: actHideSpeaker, type: 'property',
        changes: {
          [`Sprecher_${c.navId}`]: 'false',
          'BtnSprecher.caption': '🎙️ Drehbuch: AUS',
          'KapitelInhalt.htmlContent': c.nativeHtmlNormal
        }
      }
    ];

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
        name: 'KapitelGelesen', description: 'Kapitel als gelesen markieren und speichern', triggerMode: 'local-sync', params: [], id: uid('task'),
        actionSequence: [{
          type: 'condition',
          condition: { variable: `Gelesen_${c.navId}`, operator: '==', value: 'false' },
          then: [
            { type: 'action', name: actSetGelesen },
            { type: 'action', name: actIncFortschritt },
            { type: 'action', name: actUpdateProg },
            { type: 'action', name: actUpdateBar },
            { type: 'action', name: actUpdateBtn },
            { type: 'action', name: actSaveToken }
          ],
          else: []
        }]
      },
      {
        name: 'SprecherUmschalten', description: 'Deutsches Sprecher-Drehbuch ein-/ausblenden', triggerMode: 'local-sync', params: [], id: uid('task'),
        actionSequence: [{
          type: 'condition',
          condition: { variable: `Sprecher_${c.navId}`, operator: '==', value: 'false' },
          then: [{ type: 'action', name: actShowSpeaker }],
          else: [{ type: 'action', name: actHideSpeaker }]
        }]
      }
    ];

    const objects = [
      {
        className: 'TLabel', name: 'KapitelTitel', x: 13, y: 1, width: 38, height: 2.2,
        text: `${c.num} — ${c.shortTitle}`, id: uid('title'),
        style: { fontSize: 17, fontWeight: '700', textAlign: 'left' }
      },
      {
        className: 'TRichText', name: 'KapitelInhalt', x: 3, y: 4, width: 90, height: 43.5,
        htmlContent: c.nativeHtmlNormal, id: uid('rt'),
        style: { fontSize: 15, padding: '20px', borderRadius: 10 }
      },
      {
        className: 'TButton', name: 'BtnPrev', x: 3, y: 48.8, width: 16, height: 3.2,
        caption: '◀ Zurück', id: uid('prev'),
        events: { onClick: 'NavVor' }, visible: !!prevStageId
      },
      {
        className: 'TButton', name: 'BtnSprecher', x: 22, y: 48.8, width: 18, height: 3.2,
        caption: '🎙️ Drehbuch: AUS', id: uid('spk'),
        events: { onClick: 'SprecherUmschalten' }
      },
      {
        className: 'TButton', name: 'BtnGelesen', x: 43, y: 48.8, width: 22, height: 3.2,
        caption: '☐ Als gelesen markieren', id: uid('done'),
        events: { onClick: 'KapitelGelesen' }
      },
      {
        className: 'TButton', name: 'BtnNext', x: 77, y: 48.8, width: 16, height: 3.2,
        caption: 'Weiter ▶', id: uid('next'),
        events: { onClick: 'NavZurueck' }
      }
    ];

    return {
      id: c.stageId, name: `${c.num} ${c.shortTitle}`, type: 'standard',
      objects, tasks, actions, variables: [],
      flowCharts: {}, events: {}, grid: { ...GRID }
    };
  });

  return {
    meta: {
      id: 'gcs-autoren-handbuch-argon',
      name: 'GCS Autoren-Handbuch (Argon Workbench Edition)',
      author: 'GCS Architektur- & Dokumentationsprojekt',
      version: '1.0.0',
      description: 'Deklarative GCS-Native-Umsetzung des 23-teiligen Autoren-Handbuchs mit Blueprint-Hosting, 100% Action-Referenzen, Sprecher-Drehbuch-Toggle und store_token-Persistenz.'
    },
    stage: { grid: { ...GRID } },
    stages: [stageBlueprint, stageOverview, stageSuche, ...chapterStages],
    themes: THEMES,
    activeThemeId: 'argon-workbench-light',
    activeStageId: 'stage_overview',
    actions: [], tasks: [], variables: [], objects: [],
    flow: {}, input: {}, splashObjects: [], schemaVersion: '3.22.0'
  };
}

function writeGcsNativeFiles(nativeDir, project, chapters) {
  fs.mkdirSync(nativeDir, { recursive: true });

  // 1. handbook-project.json & project.js
  fs.writeFileSync(path.join(nativeDir, 'handbook-project.json'), JSON.stringify(project, null, 2), 'utf8');
  fs.writeFileSync(
    path.join(nativeDir, 'project.js'),
    `// GENERIERT von build-handbook-argon.cjs\nwindow.PROJECT = ${JSON.stringify(project).replace(/</g, '\\u003c')};\n`,
    'utf8'
  );

  // 2. gcs-handbook-overrides.css (Fix für TouchHardening Scroll/Select & DOMPurify div-Tabellen)
  const css = `/* Argon GCS Native Edition — Stylesheet für TRichText & TouchHardening-Freigabe */
html, body { margin: 0; width: 100%; height: 100%; overflow: hidden; background: #0b1120; font-family: 'Segoe UI', system-ui, -apple-system, sans-serif; }
#run-stage { position: absolute; transform-origin: top left; overflow: hidden; box-shadow: 0 20px 50px rgba(0, 0, 0, 0.45); }
.TRichText, .TRichText * { touch-action: pan-y !important; user-select: text !important; -webkit-user-select: text !important; }
#run-stage .gcs-doc-article { line-height: 1.65; font-size: 15px; }
#run-stage .gcs-doc-header { margin-bottom: 18px; padding-bottom: 12px; border-bottom: 2px solid rgba(16, 185, 129, 0.35); }
#run-stage .gcs-h1 { margin: 10px 0 6px; font-size: 1.55em; }
#run-stage .gcs-h2 { margin: 24px 0 10px; padding-bottom: 4px; border-bottom: 1px solid rgba(148, 163, 184, 0.3); font-size: 1.25em; }
#run-stage .gcs-h3 { margin: 18px 0 8px; font-size: 1.08em; }
#run-stage .gcs-status-note { font-size: 0.85em; opacity: 0.8; }
#run-stage .gcs-callout { padding: 12px 16px; border-radius: 8px; margin: 12px 0; border-left: 4px solid #10b981; background: rgba(16, 185, 129, 0.1); }
#run-stage .gcs-callout-proof { border-left-color: #64748b; background: rgba(100, 116, 139, 0.12); }
#run-stage .gcs-callout-info { border-left-color: #3b82f6; background: rgba(59, 130, 246, 0.1); }
#run-stage .gcs-speaker-box { padding: 14px 18px; border-radius: 10px; margin: 14px 0; border: 2px solid #a855f7; background: rgba(168, 85, 247, 0.12); }
#run-stage .gcs-speaker-title { font-weight: 700; color: #9333ea; margin-bottom: 6px; }
#run-stage .gcs-media-slot { border: 2px dashed rgba(148, 163, 184, 0.6); border-radius: 10px; padding: 16px; margin: 14px 0; text-align: center; background: rgba(148, 163, 184, 0.08); }
#run-stage .gcs-media-path { display: block; font-size: 0.82em; opacity: 0.7; margin-top: 4px; }
#run-stage .gcs-table { margin: 14px 0; border: 1px solid rgba(148, 163, 184, 0.45); border-radius: 8px; overflow: hidden; }
#run-stage .gcs-tr { display: flex; border-bottom: 1px solid rgba(148, 163, 184, 0.25); }
#run-stage .gcs-tr:last-child { border-bottom: 0; }
#run-stage .gcs-tr-head { font-weight: 700; background: rgba(148, 163, 184, 0.18); }
#run-stage .gcs-th, #run-stage .gcs-td { flex: 1; padding: 7px 10px; font-size: 0.92em; border-right: 1px solid rgba(148, 163, 184, 0.25); }
#run-stage .gcs-th:last-child, #run-stage .gcs-td:last-child { border-right: 0; }
#run-stage .gcs-pre { background: rgba(15, 23, 42, 0.88); color: #e2e8f0; padding: 12px 14px; border-radius: 8px; overflow-x: auto; }
#run-stage .gcs-code, #run-stage .gcs-code-comp { background: rgba(99, 102, 241, 0.16); padding: 1px 6px; border-radius: 4px; font-family: Consolas, monospace; font-size: 0.9em; }
#run-stage .gcs-checklist-wrap { padding: 12px 16px; border-radius: 8px; border: 1px solid rgba(16, 185, 129, 0.4); background: rgba(16, 185, 129, 0.06); margin: 14px 0; }
#run-stage .gcs-checklist-title { font-weight: 700; margin-bottom: 6px; }
#run-stage .gcs-inline-link { color: #10b981; font-weight: 600; text-decoration: underline; cursor: pointer; }
`;
  fs.writeFileSync(path.join(nativeDir, 'gcs-handbook-overrides.css'), css, 'utf8');

  // 3. index.html mit Rehydrierung der per store_token gespeicherten Fortschrittsdaten (analog renderCms)
  const navIdsJson = JSON.stringify(chapters.map(c => c.navId));
  const indexHtml = `<!DOCTYPE html>
<html lang="de">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>GCS Autoren-Handbuch — Argon GCS Native Edition (Version 2)</title>
  <link rel="stylesheet" href="./gcs-handbook-overrides.css" />
</head>
<body>
  <main id="run-stage" aria-label="GCS Autoren-Handbuch Stage"></main>
  <script src="./project.js"></script>
  <script src="./runtime-standalone.js"></script>
  <script>
    document.addEventListener('DOMContentLoaded', function () {
      try {
        var navIds = ${navIdsJson};
        var bp = window.PROJECT && window.PROJECT.stages && window.PROJECT.stages[0];
        if (bp && Array.isArray(bp.variables)) {
          var doneCount = 0;
          navIds.forEach(function (navId) {
            if (localStorage.getItem('gcs_argon_done_' + navId) === 'true') {
              doneCount++;
              var v = bp.variables.find(function (x) { return x.name === 'Gelesen_' + navId; });
              if (v) { v.value = true; v.defaultValue = true; }
              var st = window.PROJECT.stages.find(function (s) { return s.id === 'stage_' + navId; });
              var btn = st && st.objects && st.objects.find(function (o) { return o.name === 'BtnGelesen'; });
              if (btn) btn.caption = '✔ Gelesen';
            }
          });
          if (doneCount > 0) {
            var fv = bp.variables.find(function (x) { return x.name === 'Fortschritt'; });
            if (fv) { fv.value = doneCount; fv.defaultValue = doneCount; }
            var lbl = bp.objects && bp.objects.find(function (o) { return o.name === 'FortschrittLabel'; });
            if (lbl) lbl.text = doneCount + ' / 23 gelesen';
            var bar = bp.objects && bp.objects.find(function (o) { return o.name === 'FortschrittBalken'; });
            if (bar) bar.value = doneCount;
          }
          var savedTheme = localStorage.getItem('gcs-active-theme');
          if (savedTheme === 'argon-workbench-dark') {
            window.PROJECT.activeThemeId = 'argon-workbench-dark';
            var dv = bp.variables.find(function (x) { return x.name === 'Dunkelmodus'; });
            if (dv) { dv.value = true; dv.defaultValue = true; }
          }
        }
      } catch (e) {}
      window.startStandalone(window.PROJECT);
    });
  </script>
</body>
</html>
`;
  fs.writeFileSync(path.join(nativeDir, 'index.html'), indexHtml, 'utf8');
}

module.exports = { buildGcsNativeProject, writeGcsNativeFiles };
