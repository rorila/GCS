// Baut stage_server_sponsor: deklarative TServerEndpoint-Tasks für alle
// Sponsor-Endpunkte (Eltern, Sponsor, Kind, gemeinsame Sichten).
// Ablauf jedes Tasks (GCS-Prinzip, im Editor nachvollziehbar):
//   Sitzung prüfen → Fachmethode aufrufen → Ergebnis verzweigen → Antworten.
// Sicherheitsinvarianten liegen in den Komponentenmethoden — das Entfernen
// eines Flow-Schritts darf nie ungeschützten Zugriff ermöglichen.
// Idempotent: nur eigene (namensgleiche) Einträge werden ersetzt.
const fs = require('node:fs'), path = require('node:path'), crypto = require('node:crypto');
const file = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const project = JSON.parse(fs.readFileSync(file, 'utf8'));
const uid = p => p + '_' + crypto.randomUUID();
const comp = (className, name, extra = {}) => ({ className, id: uid('srv'), name, scope: 'stage', isService: true, isHiddenInRun: true, executionSide: 'server', x: 0, y: 0, width: 12, height: 3, ...extra });
const variable = name => ({ className: 'TObjectVariable', id: uid('cms_var'), name, scope: 'stage', isVariable: true, isHiddenInRun: true, draggable: false, droppable: false, dragMode: 'move', description: '', visible: true, x: 0, y: 0, width: 6, height: 2, zIndex: 0, rotation: 0, align: 'NONE', collisionEnabled: false, style: {}, type: 'object', defaultValue: null, value: null, objectModel: '' });
const nameOf = x => typeof x === 'string' ? x : x?.name;
const mergeByName = (existing = [], generated = []) => {
  const names = new Set(generated.map(nameOf));
  return [...existing.filter(x => !names.has(nameOf(x))), ...generated];
};

// [endpointPath, Slug, Komponente, Methode, Sitzungsart('account'|'any')]
// 'any' = Konto- oder Profilsitzung; die Fachmethode erzwingt Rolle+Beziehung.
const ENDPOINTS = [
  // --- Eltern ---
  ['/api/cms/parent/sponsorships', 'ElternListe', 'SponsorBegleitung', 'listParent', 'account'],
  ['/api/cms/parent/sponsor-contact-create', 'ElternKontaktcode', 'SponsorBegleitung', 'contactCodeCreate', 'account'],
  ['/api/cms/parent/sponsor-contact-codes', 'ElternKontaktcodes', 'SponsorBegleitung', 'contactCodes', 'account'],
  ['/api/cms/parent/sponsor-contact-revoke', 'ElternKontaktWiderruf', 'SponsorBegleitung', 'contactCodeRevoke', 'account'],
  ['/api/cms/parent/sponsor-request-decision', 'ElternAnfrageEntscheidung', 'SponsorBegleitung', 'requestDecide', 'account'],
  ['/api/cms/parent/sponsor-access-propose', 'ElternSichtVorschlag', 'SponsorBegleitung', 'accessPropose', 'account'],
  ['/api/cms/parent/sponsor-access-consent', 'ElternSichtZustimmung', 'SponsorBegleitung', 'accessConsent', 'account'],
  ['/api/cms/parent/sponsor-pause', 'ElternPause', 'SponsorBegleitung', 'pause', 'account'],
  ['/api/cms/parent/sponsor-resume', 'ElternFortsetzen', 'SponsorBegleitung', 'resume', 'account'],
  ['/api/cms/parent/sponsor-end', 'ElternBeenden', 'SponsorBegleitung', 'end', 'account'],
  ['/api/cms/parent/sponsor-progress', 'ElternFortschritt', 'SponsorBegleitung', 'progress', 'account'],
  ['/api/cms/parent/sponsor-history', 'ElternHistorie', 'SponsorBegleitung', 'history', 'account'],
  ['/api/cms/parent/sponsor-agreement-propose', 'ElternVertragVorschlag', 'SponsorVereinbarung', 'propose', 'account'],
  ['/api/cms/parent/sponsor-agreement-consent', 'ElternVertragZustimmung', 'SponsorVereinbarung', 'consent', 'account'],
  ['/api/cms/parent/sponsor-rewards', 'ElternBelohnungen', 'SponsorBelohnung', 'list', 'account'],
  ['/api/cms/parent/sponsor-reward-request', 'ElternEinloeseWunsch', 'SponsorBelohnung', 'request', 'account'],
  ['/api/cms/parent/sponsor-reward-decision', 'ElternEinloeseEntscheidung', 'SponsorBelohnung', 'decision', 'account'],
  ['/api/cms/parent/sponsor-reward-cancel', 'ElternAnspruchStorno', 'SponsorBelohnung', 'cancel', 'account'],
  ['/api/cms/parent/sponsor-fulfillment-confirm', 'ElternErfuellungOk', 'SponsorBelohnung', 'fulfillmentConfirm', 'account'],
  ['/api/cms/parent/sponsor-performance-recognize', 'ElternLeistungAnerkennen', 'SponsorLeistung', 'recognize', 'account'],
  ['/api/cms/parent/sponsor-performance-ledger', 'ElternLeistungskonto', 'SponsorLeistung', 'ledger', 'account'],
  ['/api/cms/parent/sponsor-messages', 'ElternNachrichten', 'SponsorBegleitung', 'messageList', 'account'],
  ['/api/cms/parent/sponsor-message-send', 'ElternNachrichtSenden', 'SponsorBegleitung', 'messageSend', 'account'],
  // --- Sponsor ---
  ['/api/cms/sponsor/requests', 'SponsorAnfragen', 'SponsorBegleitung', 'listSponsor', 'account'],
  ['/api/cms/sponsor/companionships', 'SponsorBegleitungen', 'SponsorBegleitung', 'listSponsor', 'account'],
  ['/api/cms/sponsor/request-create', 'SponsorAnfrageSenden', 'SponsorBegleitung', 'requestCreate', 'account'],
  ['/api/cms/sponsor/request-withdraw', 'SponsorAnfrageZurueck', 'SponsorBegleitung', 'requestWithdraw', 'account'],
  ['/api/cms/sponsor/progress', 'SponsorFortschritt', 'SponsorBegleitung', 'progress', 'account'],
  ['/api/cms/sponsor/access-propose', 'SponsorSichtVorschlag', 'SponsorBegleitung', 'accessPropose', 'account'],
  ['/api/cms/sponsor/agreement-propose', 'SponsorVertragVorschlag', 'SponsorVereinbarung', 'propose', 'account'],
  ['/api/cms/sponsor/agreement-consent', 'SponsorVertragZustimmung', 'SponsorVereinbarung', 'consent', 'account'],
  ['/api/cms/sponsor/pause', 'SponsorPause', 'SponsorBegleitung', 'pause', 'account'],
  ['/api/cms/sponsor/resume', 'SponsorFortsetzen', 'SponsorBegleitung', 'resume', 'account'],
  ['/api/cms/sponsor/end', 'SponsorBeenden', 'SponsorBegleitung', 'end', 'account'],
  ['/api/cms/sponsor/rewards', 'SponsorPflichten', 'SponsorBegleitung', 'obligations', 'account'],
  ['/api/cms/sponsor/reward-fulfillment', 'SponsorErfuellungMelden', 'SponsorBelohnung', 'fulfillmentReport', 'account'],
  ['/api/cms/sponsor/history', 'SponsorHistorie', 'SponsorBegleitung', 'history', 'account'],
  ['/api/cms/sponsor/messages', 'SponsorNachrichten', 'SponsorBegleitung', 'messageList', 'account'],
  ['/api/cms/sponsor/message-send', 'SponsorNachrichtSenden', 'SponsorBegleitung', 'messageSend', 'account'],
  // --- Kind (Profilsitzung via Token) ---
  ['/api/cms/child/sponsorship/list', 'KindListe', 'SponsorBegleitung', 'listChild', 'any'],
  ['/api/cms/child/sponsorship/detail', 'KindDetail', 'SponsorBegleitung', 'progress', 'any'],
  ['/api/cms/child/sponsorship/access-preview', 'KindSichtVorschau', 'SponsorBegleitung', 'progress', 'any'],
  ['/api/cms/child/sponsorship/decline', 'KindAblehnen', 'SponsorBegleitung', 'childDecision', 'any'],
  ['/api/cms/child/sponsorship/resume', 'KindFortsetzen', 'SponsorBegleitung', 'childDecision', 'any'],
  ['/api/cms/child/sponsorship/pause', 'KindPause', 'SponsorBegleitung', 'pause', 'any'],
  ['/api/cms/child/sponsorship/agreement-propose', 'KindVertragVorschlag', 'SponsorVereinbarung', 'propose', 'any'],
  ['/api/cms/child/sponsorship/rewards', 'KindBelohnungen', 'SponsorBelohnung', 'list', 'any'],
  ['/api/cms/child/sponsorship/reward-request', 'KindEinloesen', 'SponsorBelohnung', 'request', 'any'],
  ['/api/cms/child/sponsorship/history', 'KindHistorie', 'SponsorBegleitung', 'history', 'any'],
  ['/api/cms/child/sponsorship/messages', 'KindNachrichten', 'SponsorBegleitung', 'messageList', 'any'],
  ['/api/cms/child/sponsorship/message-send', 'KindNachrichtSenden', 'SponsorBegleitung', 'messageSend', 'any'],
  // --- Gemeinsam ---
  ['/api/cms/sponsorship/agreements', 'Vertraege', 'SponsorVereinbarung', 'list', 'any'],
  ['/api/cms/sponsorship/agreement-diff', 'VertragUnterschied', 'SponsorVereinbarung', 'diff', 'any'],
  ['/api/cms/sponsorship/rules', 'Leistungsarten', 'SponsorLeistung', 'rules', 'any'],
  ['/api/cms/account/notifications', 'KontoMitteilungen', 'SponsorBegleitung', 'notifications', 'any'],
  ['/api/cms/account/notification-read', 'KontoMitteilungGelesen', 'SponsorBegleitung', 'notificationRead', 'any'],
];

const tasks = [], actions = [], objects = [];
const act = (name, target, method, params, resultVariable) => ({ id: uid('srv_act'), name, type: 'call_method', target, method, params: params || [], resultVariable, scope: 'stage' });

ENDPOINTS.forEach(([path_, slug, component, method], i) => {
  const taskName = 'Server_' + slug + '_Verarbeiten';
  tasks.push({
    id: uid('srv_task'), name: taskName, scope: 'stage',
    description: 'Sitzung → ' + component + '.' + method + ' → Antwort (Fachprüfung in der Komponente)',
    actionSequence: [
      { type: 'action', name: 'Act_KontoRolle_Pruefen' },
      {
        type: 'condition', name: 'Sitzung gültig?', condition: { variable: 'Pruefung.ok', operator: '==', value: true },
        then: [
          { type: 'action', name: slug + '_Ausfuehren' },
          {
            type: 'condition', name: 'Ergebnis ok?', condition: { variable: 'Ergebnis.ok', operator: '==', value: true },
            then: [{ type: 'action', name: slug + '_Antworten' }],
            else: [{ type: 'action', name: slug + '_Fehler' }],
          },
        ],
        else: [{ type: 'action', name: 'Act_Fehler_Rolle' }],
      },
    ],
  });
  actions.push(
    act(slug + '_Ausfuehren', component, method, ['$body'], 'Ergebnis'),
    act(slug + '_Antworten', 'AntwortSenden', 'send', [{ merge: '${Ergebnis}' }]),
    act(slug + '_Fehler', 'AntwortSenden', 'fail', ['${Ergebnis.status}', '${Ergebnis.message}']),
  );
  objects.push(comp('TServerEndpoint', 'Ep_' + slug, { endpointPath: path_, httpMethod: 'POST', traceEnabled: true, events: { onRequest: taskName }, x: 16, y: 2 + i * 4 }));
});

objects.push(
  comp('TServerSession', 'Kontositzung', { x: 2, y: 2 }),
  comp('TServerResponse', 'AntwortSenden', { x: 2, y: 7 }),
  comp('TServerSponsorship', 'SponsorBegleitung', { x: 2, y: 12 }),
  comp('TServerSponsorAgreement', 'SponsorVereinbarung', { x: 2, y: 17 }),
  comp('TServerReward', 'SponsorBelohnung', { x: 2, y: 22 }),
  comp('TServerPerformance', 'SponsorLeistung', { x: 2, y: 27 }),
);
actions.unshift(
  act('Act_KontoRolle_Pruefen', 'Kontositzung', 'requireRole', ['account'], 'Pruefung'),
  act('Act_Fehler_Rolle', 'AntwortSenden', 'fail', ['${Pruefung.status}', '${Pruefung.message}']),
);

let stage = project.stages.find(s => s.id === 'stage_server_sponsor');
if (!stage) {
  stage = { id: 'stage_server_sponsor', type: 'standard', name: 'Server · Sponsoring', grid: {}, objects: [], tasks: [], actions: [], variables: [], flowCharts: [], events: {}, startAnimation: false, features: [] };
  project.stages.push(stage);
}
if (stage.generatedBy && stage.generatedBy !== 'cms-add-sponsor-server-stages.cjs') {
  console.log('stage_server_sponsor wurde im Editor verändert — Abbruch.');
  process.exit(1);
}
Object.assign(stage, {
  generatedBy: 'cms-add-sponsor-server-stages.cjs',
  objects: mergeByName(stage.objects, objects),
  tasks: mergeByName(stage.tasks, tasks),
  actions: mergeByName(stage.actions, actions),
  variables: mergeByName(stage.variables, ['Pruefung', 'Ergebnis'].map(variable)),
  features: mergeByName(stage.features, [{ id: 'stage_server_sponsor_v1', name: 'Sponsor-Begleitungen', description: 'Anfrage, Genehmigung, Sichtfreigaben, Vereinbarungen, Leistungspunkte und Belohnungsansprüche — alle Prüfungen in den Fachkomponenten.', tags: ['CMS', 'Server', 'Sponsoring'], userStoryIds: [], blueprintTaskNames: tasks.map(t => t.name) }]),
});
fs.writeFileSync(file, JSON.stringify(project, null, 1));
console.log('stage_server_sponsor: ' + ENDPOINTS.length + ' Endpunkte erzeugt');
