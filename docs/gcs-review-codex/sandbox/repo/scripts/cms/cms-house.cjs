// Hausverwaltungs-Endpunkte sind deklarativ: stage_server_house in der
// Projektdatei steuert die Abläufe (Tasks/Actions im Flow-Editor).
// houseApi ist der Modul-Adapter für Tests — gleiche Signatur wie bisher.
const path = require('node:path');
const CMS_FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
let _rt;
const rt = () => _rt ?? (_rt = require('./cms-runtime.cjs').loadRuntime(CMS_FILE));

function houseApi(core, s, route, b, commit) {
  const ep = rt().find('/api/cms/admin/' + route, 'POST');
  return ep ? rt().run(ep, { session: s, body: b, core, commit }, { strict: true }) : null;
}
module.exports = { houseApi };
