// CMS-Testkontext für den Editor-RunTab: ein isolierter, flüchtiger
// Datenbestand pro Testlauf (eigenes Core + eigener Store im Arbeitsspeicher).
// Testspieler, Karten und Lernstände berühren die echten CMS-Daten nie.
// Alle fachlichen Regeln (Berechtigung, Leitner, Zeitbuchung, Sprache/TTS)
// laufen über dieselben Adapter wie im Spielbetrieb.
const crypto = require('node:crypto');
const { Readable } = require('node:stream');
const { createCore, validate } = require('./cms-core.cjs');
const { createPlay } = require('./cms-play.cjs');
const { createSpeechService } = require('./cms-speech.cjs');
const { createTtsService } = require('./cms-tts.cjs');
const { buildDb } = require('./cms-seed-testdata.cjs');

const PLAYERS = {
  'test-a': { id: 'test-a', name: 'Testkind A' },
  'test-b': { id: 'test-b', name: 'Testkind B' },
  'test-c': { id: 'test-c', name: 'Testkind C' },
  'test-d': { id: 'test-d', name: 'Testkind D' },
};
const AREA = 'room-sun-play', GAME_ID = 'game-editor-test';
const MATH = [['2 × 3', ['6', 'sechs']], ['4 × 5', ['20', 'zwanzig']], ['7 × 8', ['56', 'sechsundfünfzig']],
  ['9 × 6', ['54', 'vierundfünfzig']], ['12 + 8', ['20', 'zwanzig']], ['15 − 7', ['8', 'acht']]];
const DECKS = {
  math: MATH.map(([question, answers], i) => card('tcard-math-' + i, question, answers, 'text')),
  self: [card('tcard-self-0', 'Wie heißt die Hauptstadt von Frankreich?', ['Paris'], 'self'),
         card('tcard-self-1', 'Wie viele Beine hat eine Spinne?', ['8', 'acht'], 'self')],
  empty: [],
};
function card(id, question, answers, answerFormat) {
  const now = new Date().toISOString();
  return { id, childId: '', subject: 'Mathe', topic: 'Einmaleins', question, answers, answerFormat,
    box: 1, active: true, createdBy: '', createdAt: now, updatedAt: now, lastReviewedAt: null };
}
const fail = (status, message) => ({ status, data: { ok: false, message } });
const ok = data => ({ status: 200, data: { ok: true, ...data } });

// Flüchtiger Store: gleiche commit-Semantik (Kopie → Änderung → Validierung →
// In-place-Übernahme), aber ohne Datei- und Audit-Schreibpfad.
function memoryStore(db) {
  return {
    load: () => db,
    commit: (target, _meta, change) => {
      const next = structuredClone(target);
      change(next);
      validate(next);
      Object.keys(target).forEach(k => delete target[k]);
      Object.assign(target, next);
    },
  };
}

function buildContext({ player, deck, project, cmsFile }) {
  const db = buildDb();
  db.people.push({ id: player, name: PLAYERS[player].name, kind: 'child', avatar: '🧪', active: true });
  db.memberships.push({ personId: player, areaId: 'house-sun', active: true });
  db.memberships.push({ personId: player, areaId: AREA, active: true });
  db.roles.push({ personId: player, areaId: AREA, role: 'player', active: true });
  db.games.push({ id: GAME_ID, name: 'Editor-Test', ownerId: 'super-admin', status: 'published', file: 'editor-test.json', storage: 'test', active: true });
  db.grants.push({ gameId: GAME_ID, areaId: AREA, active: true });
  db.flashcards.push(...DECKS[deck].map(c => ({ ...c, childId: player, createdBy: player })));
  const core = createCore(db), store = memoryStore(db);
  const launches = new Map();
  return { core, store, launches, project, player, created: Date.now(),
    play: createPlay(core, store, cmsFile),
    speech: createSpeechService({ core, launches }),
    tts: createTtsService({ core, launches, store }) };
}

function playPage(key, project, partyId) {
  // Gleiche Seite wie /play/<key>: eigene Sandbox, Bridge und Zeitbuchung —
  // nur die Transportziele tragen das editor-test-Präfix.
  const clone = JSON.parse(JSON.stringify(project));
  for (const st of clone.stages || [])
    for (const v of st.variables || [])
      { if (v.name === 'CMS_LAUNCH') v.value = key; if (partyId && v.name === 'PartyId') v.value = partyId; if (v.name === 'CMS_AUTO_PARTY') v.value = !!partyId; }
  if (partyId) for (const st of clone.stages || []) for (const o of st.objects || []) {
    if (o.name === 'TimerPoll') { o.enabled = true; o.maxInterval = 0; o.currentInterval = 0; }
    if (o.name === 'BtnMitspielen' || o.name === 'BtnStarten') o.visible = false;
  }
  const encoded = JSON.stringify(clone).replace(/</g, '\\u003c');
  const bridge = '<script>(function(){var K=' + JSON.stringify(key) + ',P=new Map(),F=window.fetch.bind(window);'
    + 'window.fetch=function(u,o){var r=typeof u==="string"?u:u.url;if(!["/api/cms/party","/api/cms/play"].includes(r))return F(u,o);'
    + 'var b;try{b=JSON.parse(o&&o.body||"{}")}catch(err){console.error("[GCS-TEST-BRIDGE] Body nicht als JSON lesbar:",err);return Promise.reject(Error("Ungültige Spielanfrage"))}'
    + 'if(b.launchKey!==K){console.error("[GCS-TEST-BRIDGE] launchKey weicht ab:",JSON.stringify(b.launchKey),"erwartet wird der eingebettete Schlüssel — wurde CMS_LAUNCH nicht ersetzt?");return Promise.reject(Error("Ungültige Spielberechtigung"))}'
    + 'var id=crypto.randomUUID();console.info("[GCS-TEST-BRIDGE]",r,b.action||"","→ Elternfenster");'
    + 'return new Promise(function(resolve,reject){var t=setTimeout(function(){P.delete(id);console.error("[GCS-TEST-BRIDGE] Zeitlimit: keine Antwort des Elternfensters für",r);reject(Error("Spielserver antwortet nicht"))},8000);'
    + 'P.set(id,{resolve:resolve,reject:reject,t:t});parent.postMessage({type:"gcs-cms-bridge",id:id,route:r.replace("/api/cms","/api/cms/editor-test"),body:b},"*")})};'
    + 'addEventListener("message",function(e){if(e.source!==parent||e.origin!==new URL(document.baseURI).origin||!e.data)return;'
    + 'if(e.data.type==="gcs-cms-live"){dispatchEvent(new CustomEvent("gcs-cms-live",{detail:e.data.data}));return}'
    + 'if(e.data.type!=="gcs-cms-result")return;var p=P.get(e.data.id);if(!p)return;P.delete(e.data.id);clearTimeout(p.t);'
    + 'var st=typeof e.data.status==="number"&&e.data.status>=200&&e.data.status<=599?e.data.status:502;'
    + 'try{p.resolve(new Response(JSON.stringify(e.data.data),{status:st,headers:{"Content-Type":"application/json"}}))}catch(err){console.error("[GCS-TEST-BRIDGE] Antwortaufbau fehlgeschlagen:",err);p.reject(err)}})})();</script>';
  const heart = '<script>(function(){var K=' + JSON.stringify(key) + ',overlay=null;'
    + 'function note(t,c){if(!overlay){overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;background:rgba(8,21,27,.92);color:#edf7f4;display:flex;align-items:center;justify-content:center;font:28px Segoe UI;z-index:99999;text-align:center";document.body.appendChild(overlay)}overlay.textContent=t;overlay.style.color=c||"#edf7f4"}'
    + 'function send(a,x){return fetch("/api/cms/play",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({launchKey:K,action:a},x||{}))}).then(function(r){return r.json()}).catch(function(){return{ok:false}})}'
    + 'window.CMS={report:function(m,v,u){return send("progress",{eventId:crypto.randomUUID(),metric:m,value:v,unit:u,schemaVersion:1})},end:function(){return send("end")}};'
    + 'setInterval(function(){send("heartbeat").then(function(r){if(!r.ok)return;if(r.warn==="5min")note("Noch 5 Minuten","#ffd166");if(r.warn==="1min")note("Noch 1 Minute","#ef8354");if(r.warn==="grace")note("Zeit um — wird gespeichert","#ef8354");if(r.ended||r.status==="ended")note("Zeit für heute ist um. Gut gemacht!","#edf7f4")})},30000);'
    + 'addEventListener("pagehide",function(){navigator.sendBeacon("/api/cms/editor-test/play",new Blob([JSON.stringify({launchKey:K,action:"end"})],{type:"application/json"}))});'
    + '})();</script>';
  return '<!doctype html><meta charset="utf-8"><base href="/"><style>html,body{margin:0;width:100%;height:100%;overflow:hidden;background:#08151b}#run-stage{position:absolute;transform-origin:center center}'
    + '#pv{position:fixed;left:0;right:0;top:0;height:26px;z-index:99998;background:#3c2a00;color:#ffd166;font:14px Segoe UI;line-height:26px;text-align:center}</style>'
    + '<div id="pv">CMS-Testkontext — synthetische Testdaten, keine echten Lernstände</div><main id="run-stage"></main>'
    + '<script>window.PROJECT=' + encoded + '</script>' + bridge + heart
    + '<script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT))</script>';
}

function createEditorTestService({ cmsFile, enabled = process.env.CMS_EDITOR_TEST !== 'off', maxContexts = 5, ttlMs = 30 * 60_000, now = () => Date.now() } = {}) {
  const contexts = new Map(); // launchKey -> ctx (shared for multiplayer)
  const count = () => new Set(contexts.values()).size;
  const remove = ctx => {
    ctx.live?.close();
    ctx.launches.clear();
    for (const [key, value] of contexts) if (value === ctx) contexts.delete(key);
  };
  const upgrade = (req, socket, head) => {
    const url = new URL(req.url, 'http://localhost');
    if (url.pathname !== '/api/cms/editor-test/party/live') return false;
    const ip = req.socket?.remoteAddress || '';
    const ctx = contextOf(url.searchParams.get('launchKey'));
    if (!enabled || !['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip) || !ctx?.live) {
      socket.end('HTTP/1.1 401 Unauthorized\r\nConnection: close\r\n\r\n'); return true;
    }
    ctx.live.upgrade(req, socket, head); return true;
  };
  const launchKeyOf = req => req.headers['x-gcs-launch'] || keyOf(req.url);
  const keyOf = url => (url || '').split('/').pop()?.split('?')[0] || '';
  const contextOf = key => {
    const ctx = contexts.get(key);
    if (ctx && now() - ctx.created > ttlMs) { remove(ctx); return null; }
    return ctx;
  };
  async function jsonOf(req, cap = 8 * 1024 * 1024) {
    let bytes = 0; const chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > cap) { req.resume(); throw fail(413, 'Testanfrage zu groß.'); } chunks.push(chunk); }
    try { return JSON.parse(Buffer.concat(chunks).toString('utf8') || '{}'); } catch { throw fail(400, 'Ungültiges JSON.'); }
  }
  async function handle(req) {
    if (!enabled) return fail(404, 'CMS-Testkontext deaktiviert.');
    const ip = req.socket?.remoteAddress || '';
    if (!['127.0.0.1', '::1', '::ffff:127.0.0.1'].includes(ip)) return fail(403, 'Nur lokale Testanfragen.');
    const url = new URL(req.url, 'http://localhost'), route = url.pathname.replace('/api/cms/editor-test', '') || '/';
    if (req.headers.origin && req.headers.origin !== `http://${req.headers.host}`) return fail(403, 'Ungültiger Anfrageursprung.');
    // Kontext-Erzeugung verlangt die Editor-Kennzeichnung; spielbezogene Routen
    // sind (wie im Spielbetrieb) allein über den Launch-Schlüssel abgesichert.
    if (['/start', '/multiplayer/start'].includes(route) && req.headers['x-gcs-editor-test'] !== '1') return fail(403, 'Testanfrage ohne Kennzeichnung.');
    // GET nur für die Testspiel-Seite; Medien bietet der Testkontext nicht an.
    if (req.method === 'GET') {
      const key = keyOf(url.pathname), ctx = contextOf(key);
      if (route.startsWith('/page/') && ctx?.project)
        return { status: 200, html: playPage(key, ctx.project, ctx.launches.get(key)?.partyId),
          headers: { 'Content-Security-Policy': "sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline'; img-src 'self' data: blob:; media-src 'self' data: blob:; font-src 'self' data:; worker-src 'self' blob:; connect-src 'none'; base-uri 'self'; form-action 'none'", 'Cache-Control': 'no-store' } };
      return fail(404, 'Testseite nicht gefunden.');
    }
    // Audio-/TTS-Dienste lesen den Request-Stream selbst — Kontext per Key.
    // Der Sprachdienst prüft req.url für seine Status-Route: auf die im
    // Spielbetrieb üblichen Pfade normalisieren, bevor delegiert wird.
    if (route === '/speech' || route === '/speech/status') {
      const ctx = contextOf(launchKeyOf(req)); if (!ctx) return fail(401, 'Testsitzung abgelaufen.');
      req.url = '/api/cms' + route;
      return ctx.speech.handle(req);
    }
    if (route === '/tts' || route === '/tts/preferences') {
      // TTS trägt den Schlüssel im JSON-Body: einmal lesen, Kontext wählen,
      // dann als neuer Stream an den fachlichen Dienst weiterreichen.
      let bytes = 0; const chunks = [];
      for await (const chunk of req) { bytes += chunk.length; if (bytes > 8192) { req.resume(); return fail(413, 'Sprachanfrage zu groß.'); } chunks.push(Buffer.from(chunk)); }
      const raw = Buffer.concat(chunks); let body; try { body = JSON.parse(raw.toString('utf8') || '{}'); } catch { return fail(400, 'Ungültiges JSON.'); }
      const ctx = contextOf(body.launchKey); if (!ctx) return fail(401, 'Testsitzung abgelaufen.');
      const replay = Object.assign(Readable.from([raw]), { headers: req.headers, method: req.method });
      return (route === '/tts' ? ctx.tts.handle(replay) : ctx.tts.preferences(replay));
    }
    let body; try { body = await jsonOf(req); } catch (e) { return e; }
    if (route !== '/play' || body.action !== 'heartbeat')
      console.log('[editor-test]', route, body?.action ?? '', 'key:', String(body?.launchKey || '').slice(0, 8) || '—');
    if (route === '/multiplayer/start') {
      for (const ctx of new Set(contexts.values())) if (now() - ctx.created > ttlMs) remove(ctx);
      if (count() >= maxContexts) return fail(429, 'Zu viele Testkontexte.');
      if (!body.project || !Array.isArray(body.project.stages)) return fail(400, 'Projektkopie fehlt.');
      const spec = body.project.meta?.multiplayer || body.project.multiplayer || {};
      const min = Math.max(2, Number(spec.minPlayers) || 2), max = Math.min(4, Number(spec.maxPlayers) || 2);
      const number = body.players === undefined ? 2 : Number(body.players);
      if (!Number.isInteger(number) || number < min || number > max) return fail(400, 'Spieleranzahl nicht vom Spiel unterstützt.');
      const ctx = buildContext({ player: 'test-a', deck: 'math', project: body.project, cmsFile });
      ctx.created = now();
      const db = ctx.core.db; db.games.find(g => g.id === GAME_ID).multiplayer = { minPlayers: min, maxPlayers: max };
      const ids = Object.keys(PLAYERS).slice(0, number);
      for (const id of ids.slice(1)) {
        db.people.push({ id, name: 'Testspieler ' + (ids.indexOf(id) + 1), kind: 'child', active: true });
        db.memberships.push({ personId: id, areaId: 'house-sun', active: true }, { personId: id, areaId: AREA, active: true });
        db.roles.push({ personId: id, areaId: AREA, role: 'player', active: true });
      }
      db.people.find(p => p.id === 'test-a').name = 'Testspieler 1';
      const mp = require('./cms-mp.cjs').createMp(ctx.core, ctx.store, ctx.play, cmsFile, ctx.launches);
      ctx.mp = mp;
      const tokens = ids.map(id => ctx.core.issueSession(id, 'profile'));
      const call = (index, op, extra = {}) => mp.api(ctx.core.session(tokens[index]), op, { token: tokens[index], gameId: GAME_ID, areaId: AREA, ...extra });
      const created = call(0, 'create');
      if (!created.data.ok) return created;
      ctx.partyId = created.data.partyId;
      for (let i = 1; i < number; i++) { const joined = call(i, 'join', { partyId: ctx.partyId }); if (!joined.data.ok) return joined; }
      const begun = call(0, 'begin', { partyId: ctx.partyId }); if (!begun.data.ok) return begun;
      ctx.live = require('./cms-live.cjs').createLiveSync({ core: ctx.core, launches: ctx.launches, component: { endpointPath: '/api/cms/editor-test/party/live' } });
      const players = ids.map((id, index) => {
        const key = crypto.randomBytes(24).toString('hex');
        const member = db.parties.find(p => p.id === ctx.partyId).members.find(m => m.personId === id);
        ctx.launches.set(key, { token: tokens[index], gameId: GAME_ID, areaId: AREA, playSessionId: member.playSessionId, partyId: ctx.partyId });
        contexts.set(key, ctx);
        return { player: index + 1, name: 'Testspieler ' + (index + 1), launchKey: key, page: '/api/cms/editor-test/page/' + key };
      });
      return ok({ partyId: ctx.partyId, players });
    }
    if (route === '/start') {
      for (const [key, ctx] of contexts) if (now() - ctx.created > ttlMs) remove(ctx);
      if (count() >= maxContexts) return fail(429, 'Zu viele Testkontexte.');
      const player = String(body.player || 'test-a'), deck = String(body.deck || 'math');
      if (!PLAYERS[player]) return fail(400, 'Unbekannter Testspieler.');
      if (!Object.hasOwn(DECKS, deck)) return fail(400, 'Unbekanntes Testdeck.');
      if (!body.project || !Array.isArray(body.project.stages)) return fail(400, 'Projektkopie fehlt.');
      const ctx = buildContext({ player, deck, project: body.project, cmsFile });
      ctx.created = now();
      const token = ctx.core.issueSession(player, 'profile'), session = ctx.core.session(token);
      const started = ctx.play.api(session, 'start', { gameId: GAME_ID, areaId: AREA });
      if (!started.data.ok) return fail(started.status || 500, started.data.message || 'Testsitzung nicht möglich.');
      const key = crypto.randomBytes(24).toString('hex');
      ctx.launches.set(key, { token, gameId: GAME_ID, areaId: AREA, playSessionId: started.data.playSessionId });
      contexts.set(key, ctx);
      return ok({ launchKey: key, page: '/api/cms/editor-test/page/' + key, player: PLAYERS[player].name, deck, cards: ctx.core.db.flashcards.length });
    }
    const ctx = contextOf(body.launchKey || launchKeyOf(req));
    if (!ctx) return fail(401, 'Testsitzung abgelaufen.');
    if (route === '/party') {
      const launch = ctx.launches.get(body.launchKey), session = launch && ctx.core.session(launch.token);
      if (!launch || !session || !ctx.mp) return fail(401, 'Testpartie abgelaufen.');
      if (body.partyId !== launch.partyId) return fail(403, 'Spiellink und Partie passen nicht zusammen.');
      if (!['state', 'action', 'begin', 'end', 'leave'].includes(body.op)) return fail(400, 'Unzulässige Partieaktion.');
      return ctx.mp.api(session, body.op, { ...body, token: launch.token, gameId: launch.gameId, areaId: launch.areaId });
    }
    if (route === '/play') {
      const launch = ctx.launches.get(body.launchKey), session = launch && ctx.core.session(launch.token);
      if (!launch || !session) return fail(401, 'Testsitzung abgelaufen.');
      if (typeof body.action !== 'string' || !['heartbeat', 'end', 'progress', 'pause', 'resume', 'status', 'cards', 'cardNext', 'cardAnswer'].includes(body.action)) return fail(400, 'Aktion fehlt oder unzulässig.');
      const result = ctx.play.api(session, body.action, { ...body, playSessionId: launch.playSessionId });
      if (result.status === 200 && result.data.status === 'ended') ctx.launches.delete(body.launchKey);
      return result;
    }
    if (route === '/state') {
      return ok({ player: ctx.player, cards: ctx.core.db.flashcards.map(c => ({ id: c.id, childId: c.childId, box: c.box, question: c.question, lastReviewedAt: c.lastReviewedAt })),
        sessions: ctx.core.db.playSessions.map(s => ({ id: s.id, status: s.status, minutes: s.minutes })) });
    }
    if (route === '/close' || route === '/reset') {
      if (ctx.partyId) { remove(ctx); return ok({ closed: true }); }
      const launch = ctx.launches.get(body.launchKey), session = launch && ctx.core.session(launch.token);
      if (session && launch?.playSessionId) ctx.play.api(session, 'end', { playSessionId: launch.playSessionId });
      for (const [key] of ctx.launches) ctx.launches.delete(key);
      contexts.delete(body.launchKey);
      return ok({ closed: true });
    }
    return fail(404, 'Unbekannte Testaktion.');
  }
  const expiry = setInterval(() => { for (const ctx of new Set(contexts.values())) if (now() - ctx.created > ttlMs) remove(ctx); }, 60000);
  expiry.unref?.();
  return { handle, upgrade, size: count, dispose: () => { clearInterval(expiry); for (const ctx of new Set(contexts.values())) remove(ctx); } };
}
module.exports = { createEditorTestService, PLAYERS };
