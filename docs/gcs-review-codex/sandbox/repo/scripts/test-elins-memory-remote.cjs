// ElinsMemoryRemote — Serverseitiger Mehrspieler-E2E:
// Zwei Spielsitzungen (zwei „Geräte") über Emoji-Code + Launch, Partie per
// launchKey: create/list/join/begin, Aktionslog mit Layout-/Flip-Payloads,
// since-Delta, Sequenz, Sitzlogik (maxPlayers=2), Hausgrenze, Beenden.
// Fachlogik (Kartenflips) bleibt im Projekt-Flow — hier wird der Kanal
// geprüft, den ElinsMemoryRemote nutzt.
const fs = require('node:fs'), path = require('node:path'), os = require('node:os'), assert = require('node:assert');
const { createJsonStore } = require('./cms/cms-store.cjs');
const { createCore } = require('./cms/cms-core.cjs');
const { createServer } = require('./cms/cms-server.cjs');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');

const results = [];
const check = (name, fn) => Promise.resolve().then(fn).then(() => results.push(['OK', name])).catch(e => results.push(['FEHLER', name + ' :: ' + e.message]));

(async () => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'cms-mem-remote-'));
  const dp = path.join(dir, 'cms.json');
  const seed = buildDb();
  // Aktive Seed-Sitzungen beenden, damit die Einzelsitzungsregel nicht stört.
  for (const s of seed.playSessions) if (['active', 'paused'].includes(s.status)) { s.status = 'ended'; s.endedAt = new Date().toISOString(); }
  // Drittes Kind für den „Partie voll"-Check: child-emil ist Hausmitglied,
  // aber nur im Lernraum — für diesen Test bekommt er Spielraum-Zutritt.
  seed.memberships.push({ personId: 'child-emil', areaId: 'room-sun-play', active: true });
  // Seed muss das Spiel kennen (games + grants werden hier gesetzt).
  assert.ok(seed.games.some(g => g.id === 'game-memory-remote'), 'Seed: Spiel registriert');
  fs.writeFileSync(dp, JSON.stringify(seed));
  const app = createServer({ dataPath: dp });
  const PORT = 15221;
  try {
    await new Promise(r => app.server.listen(PORT, '127.0.0.1', r));
    const base = 'http://127.0.0.1:' + PORT;
    const post = async (route, body = {}) => {
      const r = await fetch(base + '/api/cms/' + route, { method: 'POST', headers: { 'Content-Type': 'application/json', Origin: base }, body: JSON.stringify(body) });
      let data = null; try { data = await r.json(); } catch { }
      return { status: r.status, data };
    };
    const party = (key, op, extra = {}) => post('party', { launchKey: key, op, ...extra });

    let tom, lina, finn, mia;
    await check('login: zwei Kinder desselben Hauses', async () => {
      tom = (await post('login', { sequence: ['owl', 'flower', 'pig', 'elephant'] })).data;
      lina = (await post('login', { sequence: ['dog', 'cat', 'tree', 'house'] })).data;
      assert.ok(tom.token && lina.token, 'beide angemeldet');
    });

    let keyTom, keyLina;
    await check('launch: beide starten ElinsMemoryRemote im selben Raum', async () => {
      const lt = (await post('launch', { token: tom.token, gameId: 'game-memory-remote', areaId: 'room-sun-play' })).data;
      const ll = (await post('launch', { token: lina.token, gameId: 'game-memory-remote', areaId: 'room-sun-play' })).data;
      assert.ok(lt.launch && ll.launch, 'Launch-Links vorhanden');
      keyTom = lt.launch.slice(6); keyLina = ll.launch.slice(6);
      const page = await fetch(base + '/play/' + keyTom);
      assert.strictEqual(page.status, 200, 'Spielseite wird ausgeliefert (Whitelist)');
      assert.ok((await page.text()).includes('startStandalone'), 'GCS-Runtime-Seite');
    });

    let pid;
    await check('create: Spieler 1 erstellt Partie (gameId aus Launch)', async () => {
      const r = await party(keyTom, 'create', { gameId: 'game-memory-remote' });
      assert.strictEqual(r.status, 200, JSON.stringify(r.data));
      pid = r.data.partyId; assert.ok(pid, 'partyId');
      const p = JSON.parse(fs.readFileSync(dp, 'utf8')).parties.find(x => x.id === pid);
      assert.strictEqual(p.gameId, 'game-memory-remote', 'Partie ans richtige Spiel gebunden');
      assert.strictEqual(p.areaId, 'room-sun-play', 'Raum aus Launch-Grant');
    });

    await check('list: Spieler 2 sieht offene Partie mit Spielbezug', async () => {
      const r = await party(keyLina, 'list');
      const it = (r.data.items || []).find(i => i.id === pid);
      assert.ok(it, 'Partie in Liste'); assert.strictEqual(it.gameId, 'game-memory-remote');
      assert.ok(String(it.platz).startsWith('1/'), 'Platz 1/2 belegt');
    });

    await check('join: Spieler 2 tritt bei; youAreHost korrekt', async () => {
      assert.strictEqual((await party(keyLina, 'join', { partyId: pid })).status, 200);
      const st = await party(keyLina, 'state', { partyId: pid, since: 0 });
      assert.strictEqual(st.data.memberCount, 2);
      assert.strictEqual(st.data.youAreHost, false, 'Gast ist nicht Host');
      const stH = await party(keyTom, 'state', { partyId: pid, since: 0 });
      assert.strictEqual(stH.data.youAreHost, true, 'Tom ist Host');
      assert.ok(stH.data.memberNames.length > 0, 'memberNames gesetzt');
    });

    await check('join: drittes Kind → Partie voll (maxPlayers 2)', async () => {
      finn = (await post('login', { sequence: ['house', 'tree', 'owl', 'pig'] })).data; // child-emil
      const lf = (await post('launch', { token: finn.token, gameId: 'game-memory-remote', areaId: 'room-sun-play' })).data;
      const r = await party(lf.launch.slice(6), 'join', { partyId: pid });
      assert.notStrictEqual(r.status, 200, 'Beitritt verweigert, Status=' + r.status);
    });

    await check('begin + Aktionslog: layout/start/flip in Sequenz', async () => {
      assert.strictEqual((await party(keyTom, 'begin', { partyId: pid })).status, 200);
      // Host-Layout: m0..m19 wie Act_MpLayoutSenden
      const layout = { zug: 'layout', seat: 1 }; for (let i = 0; i < 20; i++) layout['m' + i] = (i * 7) % 10;
      assert.strictEqual((await party(keyTom, 'action', { partyId: pid, payload: layout })).status, 200);
      await party(keyTom, 'action', { partyId: pid, payload: { zug: 'start', seat: 1, beginner: 1 } });
      await party(keyTom, 'action', { partyId: pid, payload: { zug: 'flip', seat: 1, card: 4, cp: 1, mc: 0 } });
      const st = await party(keyLina, 'state', { partyId: pid, since: 0 });
      assert.strictEqual(st.data.status, 'playing');
      assert.strictEqual(st.data.lastSeq, 3);
      const seqs = st.data.actions.map(a => a.seq); assert.deepStrictEqual(seqs, [1, 2, 3]);
      assert.strictEqual(st.data.actions[0].payload.zug, 'layout');
      assert.strictEqual(st.data.actions[0].payload.m7, (7 * 7) % 10, 'Layout-Feld m7 erhalten');
      assert.strictEqual(st.data.actions[2].payload.card, 4, 'Flip-Kartenindex erhalten');
      assert.strictEqual(st.data.actions[2].payload.seat, 1, 'Seat markiert eigene Aktionen');
      assert.strictEqual(st.data.actions[2].payload.cp, 1, 'Sync-Punkt cp mitgesendet');
    });

    await check('state/since: Delta und Reconnect-Aufholen', async () => {
      await party(keyLina, 'action', { partyId: pid, payload: { zug: 'flip', seat: 2, card: 9, cp: 2, mc: 0 } });
      const delta = await party(keyTom, 'state', { partyId: pid, since: 3 });
      assert.strictEqual(delta.data.actions.length, 1, 'nur neuer Zug');
      assert.strictEqual(delta.data.actions[0].payload.seat, 2);
      const full = await party(keyTom, 'state', { partyId: pid, since: 0 });
      assert.strictEqual(full.data.actions.length, 4, 'Reconnect lädt komplette Folge');
    });

    await check('Sicherheit: fremder Key 401, fremde Partie 404, anderes Haus', async () => {
      assert.strictEqual((await party('x'.repeat(48), 'state', { partyId: pid })).status, 401);
      assert.strictEqual((await party(keyTom, 'action', { partyId: 'party-fremd', payload: {} })).status, 404);
      mia = (await post('login', { sequence: ['owl', 'dog', 'cat', 'tree'] })).data;
      const lm = await post('launch', { token: mia.token, gameId: 'game-memory-remote', areaId: 'room-sun-play' });
      assert.notStrictEqual(lm.status, 200, 'Hausgrenze: kein Launch in fremdem Raum');
    });

    await check('leave/end: Mitglied verlässt, Host beendet', async () => {
      assert.strictEqual((await party(keyLina, 'leave', { partyId: pid })).status, 200);
      assert.strictEqual((await party(keyTom, 'end', { partyId: pid })).status, 200);
      const st = await party(keyTom, 'state', { partyId: pid, since: 0 });
      assert.strictEqual(st.data.status, 'ended');
    });
  } finally {
    await new Promise(r => app.server.close(r));
  }

  const failed = results.filter(r => r[0] === 'FEHLER');
  for (const [s, n] of results) console.log(s.padEnd(7), n);
  console.log(`\n${results.length - failed.length}/${results.length} bestanden`);
  process.exit(failed.length ? 1 : 0);
})();
