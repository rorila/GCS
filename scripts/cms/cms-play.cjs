// Spielsitzungen mit Zeitbuchung (Phase 3, E06/E07/E08).
// Eine aktive Sitzung pro Kind; Minuten werden aus Heartbeat-Deltas
// serverseitig gebucht (Client-Angaben sind nur Hinweise).
// Die Abläufe sind deklarativ: stage_server_play in der Projektdatei steuert
// Tasks/Actions — dieses Modul ist nur noch der Modul-Adapter für Tests/Server.
const path = require('node:path');

const CMS_FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const fail = (status, message) => ({ status, data: { ok: false, message } });

function createPlay(core, store, cmsFile) {
  let _rt;
  const rt = () => _rt ?? (_rt = require('./cms-runtime.cjs').loadRuntime(cmsFile || CMS_FILE));
  const commit = (s, action, areaId, change) => store.commit(core.db, { actor: s.personId, action, areaId }, change);

  // Modul-Adapter: Routen laufen über die TServerEndpoint-Tasks der Projektdatei.
  function api(session, route, b = {}) {
    if (!session) return fail(401, 'Bitte anmelden.');
    const ep = rt().find('/api/cms/play/' + route, 'POST');
    return ep ? rt().run(ep, { session, body: b, core, commit }, { strict: true })
            : fail(404, 'Unbekannte Aktion.');
  }

  return { api };
}

module.exports = { createPlay };
