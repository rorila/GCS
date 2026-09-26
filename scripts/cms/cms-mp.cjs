// Hausinterner Multiplayer (Phase 4): Partien (Lobbies) mit Aktionslog.
// Synchronisation per Polling — keine WebSockets, keine Fremdnetzwerk-Teilnahme.
// Hausgrenze entsteht fachlich: Mitgliedschaft + Spielfreigabe sind raumgebunden,
// hausfremde Kinder können den Raum der Partie nicht betreten (can 'play').
// Die Abläufe sind deklarativ: stage_server_mp steuert Tasks/Actions —
// dieses Modul ist nur noch der Modul-Adapter. ctx.play koppelt die
// Sitzungslogik (Zeitbudget greift auch in der Gruppe).
const path = require('node:path');

const CMS_FILE = path.join(__dirname, '../../game-server/public/projects/GCS-CMS.json');
const fail = (status, message) => ({ status, data: { ok: false, message } });

function createMp(core, store, play, cmsFile, launches) {
  let _rt;
  const launchRegistry=launches||new Map();
  const rt = () => _rt ?? (_rt = require('./cms-runtime.cjs').loadRuntime(cmsFile || CMS_FILE));
  const commit = (s, action, areaId, change) => store.commit(core.db, { actor: s.personId, action, areaId }, change);

  function api(session, route, b = {}) {
    if (!session) return fail(401, 'Bitte anmelden.');
    const ep = rt().find('/api/cms/mp/' + route, 'POST');
    return ep ? rt().run(ep, { session, body: b, core, commit, play, launches:launchRegistry }, { strict: true })
            : fail(404, 'Unbekannte Aktion.');
  }

  return { api };
}

module.exports = { createMp };
