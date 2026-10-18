const fs = require('node:fs');
const path = require('node:path');

const root = process.argv[2] || path.resolve(__dirname, '../..');
const projectFile = path.join(root, 'game-server/public/projects/GCS-CMS.json');
const project = JSON.parse(fs.readFileSync(projectFile, 'utf8'));

const house = project.stages.find(stage => stage.id === 'stage_house');
const server = project.stages.find(stage => stage.id === 'stage_server_house');
if (!house || !server) throw new Error('Haus- oder Server-Stage fehlt');

const roomView = house.actions.find(action => action.name === 'Act_Raeume_anzeigen__Ansicht_Umschalten_Und_Seitenauswahl_Setzen');
if (!roomView?.changes) throw new Error('Raumansicht-Aktion fehlt');
Object.assign(roomView.changes, {
  'PersonInfo.visible': false,
  'NameEingabe.visible': false,
  'AvatarEingabe.visible': false,
  'CodeEingabe.visible': false,
  'PersonCreate.visible': false,
  'PersonToggle.visible': false,
  'Hilfe.text': 'Raum anklicken → bearbeiten. Bewohner werden unter „Bewohner“ angelegt und anschließend in der Raumverwaltung zugeordnet.',
});
delete roomView.changes['PersonInfo.text'];
delete roomView.changes['PersonCreate.text'];
const personInfo = house.objects.find(object => object.name === 'PersonInfo');
const personCreate = house.objects.find(object => object.name === 'PersonCreate');
if (personInfo) personInfo.text = 'Hausbewohnerprofil anlegen';
if (personCreate) personCreate.text = 'Bewohner anlegen';

const oldWait = 'Act_Spielerprofil_mit_Emoji_Code_anlegen__Eingabe_Sperren_Und_Warten_Anzeigen';
const newWait = 'Act_Hausbewohnerprofil_anlegen__Eingabe_Sperren_Und_Warten_Anzeigen';
const waitAction = house.actions.find(action => action.name === oldWait || action.name === newWait);
if (!waitAction) throw new Error('Warteaktion für Bewohnerprofil fehlt');
waitAction.name = newWait;

const replaceActionRef = value => {
  if (Array.isArray(value)) return value.forEach(replaceActionRef);
  if (!value || typeof value !== 'object') return;
  if (value.type === 'action' && value.name === oldWait) value.name = newWait;
  Object.values(value).forEach(replaceActionRef);
};
replaceActionRef(house.tasks);

const obsoleteHouseActions = new Set([
  'Act_Spielerprofil_mit_Emoji_Code_anlegen__Server_Spielerprofil_Und_EmojiCode_Anlegen',
  'Act_Spielerprofil_Ohne_Raum_Hinweis',
]);
house.actions = house.actions.filter(action => !obsoleteHouseActions.has(action.name));

const createTask = house.tasks.find(task => task.name === 'PersonCreateTask');
if (!createTask) throw new Error('PersonCreateTask fehlt');
createTask.description = 'Hausbewohnerprofil im ausgewählten Haus anlegen';
createTask.actionSequence = [{
  type: 'condition',
  name: 'Hausbewohner-Modus?',
  condition: { variable: 'VerwaltungsModus', operator: '==', value: 'house-people' },
  then: [{ type: 'task', name: 'HausbewohnerAnlegen' }],
  else: [],
}];

const playerFeature = house.features?.find(feature => feature.id === 'cms_workflow_person');
if (playerFeature) Object.assign(playerFeature, {
  name: '01 · Hausbewohnerprofil hinzufügen',
  description: 'Bewohner öffnen → Anzeigename, Emoji und Code eingeben → Profil im Haus anlegen. Die Raumzuordnung erfolgt anschließend in der Raumverwaltung.',
  blueprintTaskNames: ['Sperre_Bewohner', 'BewohnerTask', 'Laden', 'Zeigen', 'Fehler', 'Sperre_PersonCreate', 'PersonCreateTask', 'HausbewohnerAnlegen'],
});
const playerStory = project.userStories?.userStories?.find(story => story.id === 'stage_house_cms_workflow_person_stage_main_PersonCreate_onClick');
if (playerStory) Object.assign(playerStory, {
  title: 'Hausbewohner anlegen – Bewohnerprofil hinzufügen',
  description: 'Bewohner öffnen → Anzeigename, Emoji und Code eingeben → Profil im Haus anlegen. Die Raumzuordnung erfolgt separat in der Raumverwaltung.',
  acceptanceCriteria: [
    'Das Profil wird als Bewohner des ausgewählten Hauses angelegt.',
    'Beim Anlegen entsteht keine automatische Raumzuordnung.',
    'Serverfehler werden verständlich angezeigt.',
  ],
});

server.objects = server.objects.filter(object => object.name !== 'Ep_person-create' && object.endpointPath !== '/api/cms/admin/person-create');
server.tasks = server.tasks.filter(task => task.name !== 'Server_SpielerAnlegen_Verarbeiten');
server.actions = server.actions.filter(action => !String(action.name || '').startsWith('SpielerAnlegen_'));

const serialized = JSON.stringify(project, null, 2);
for (const forbidden of [
  '/api/cms/admin/person-create',
  'Server_SpielerAnlegen_Verarbeiten',
  'Act_Spielerprofil_mit_Emoji_Code_anlegen__Server_Spielerprofil_Und_EmojiCode_Anlegen',
  'Neues Spielerprofil im ausgewählten Raum',
]) {
  if (serialized.includes(forbidden)) throw new Error(`Altpfad blieb erhalten: ${forbidden}`);
}
fs.writeFileSync(projectFile, serialized + '\n');
console.log('GCS-CMS: direkten Spielerprofil-Workflow aus der Raumansicht entfernt');
