const fs = require('node:fs/promises'), path = require('node:path');
const { SpeechCache } = require('./tts/SpeechCache.cjs');
const { PiperSpeechEngine } = require('./tts/PiperSpeechEngine.cjs');
const { isSuper } = require('./cms-super.cjs');

const DEFAULT_VOICES = { default: 'de_DE-thorsten-medium', kerstin: 'de_DE-kerstin-low', ramona: 'de_DE-ramona-low' };
const SAMPLE = 'Hallo! Schön, dass du da bist. Lass uns in Ruhe die nächste Frage lösen.';
function createTtsService({ core, launches, store, cacheDirectory = path.join(__dirname, '../../game-server/data/tts-cache'), engine, endpoint = process.env.CMS_TTS_URL || '' }) {
  if (endpoint) {
    const url = new URL(endpoint);
    if (url.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(url.hostname) || url.username || url.password || url.search || url.hash || url.pathname !== '/') {
      throw new Error('CMS_TTS_URL muss auf einen lokalen Piper-Dienst zeigen (http://127.0.0.1:5000/).');
    }
  }
  const voices = JSON.parse(process.env.TTS_VOICES || JSON.stringify(DEFAULT_VOICES));
  if (!voices || Array.isArray(voices) || !Object.keys(voices).length || Object.entries(voices).some(([id, model]) => !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || typeof model !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(model))) throw new Error('Ungültige TTS_VOICES.');
  const speechEngine = engine || new PiperSpeechEngine(process.env.TTS_MODEL_VERSION || 'piper-1.4.2-thorsten-medium-v1', endpoint,
    voices, process.env.TTS_FFMPEG || 'ffmpeg', process.env.TTS_PIPER_SYNTHESIS_PATH || '/');
  const cache = new SpeechCache(cacheDirectory, speechEngine, Number(process.env.TTS_CACHE_MAX_BYTES || 5 * 1024 ** 3));
  const recent = new Map();
  let recovery, batch, batchRunning = false;
  const fail = (status, message) => ({ status, data: { ok: false, message } });
  const ok = data => ({ status: 200, data: { ok: true, ...data } });
  const enabled = () => Object.keys(voices).filter(id => !(core.db.ttsSettings?.disabledVoices || []).includes(id));
  const defaultVoice = () => enabled().includes(core.db.ttsSettings?.defaultVoice) ? core.db.ttsSettings.defaultVoice : enabled()[0];
  const labels = { default: 'Thorsten', kerstin: 'Kerstin', ramona: 'Ramona' };
  const catalog = () => Object.entries(voices).map(([id, model]) => ({ id, model, name: labels[id] || model.replace(/^de_DE-/, '').replace(/-/g, ' '), enabled: enabled().includes(id) }));
  function authorized(key) {
    const launch = typeof key === 'string' && /^[a-f0-9]{48}$/.test(key) && launches.get(key);
    const session = launch && core.session(launch.token);
    const ps = launch && core.db.playSessions.find(item => item.id === launch.playSessionId);
    const game = launch && core.db.games.find(item => item.id === launch.gameId);
    return launch && !launch.preview && session && ps?.childId === session.personId && ps.status === 'active'
      && ps.gameId === launch.gameId && core.can(session, 'play', { game, areaId: launch.areaId }) ? session.personId : null;
  }
  async function bodyOf(req) {
    if (req.headers.origin !== `http://${req.headers.host}`) throw Object.assign(new Error('Ungültiger Anfrageursprung.'), { status: 403 });
    if (req.method !== 'POST') throw Object.assign(new Error('Methode nicht unterstützt.'), { status: 405 });
    if (!(req.headers['content-type'] || '').startsWith('application/json')) throw Object.assign(new Error('JSON erforderlich.'), { status: 415 });
    let bytes = 0, chunks = [];
    for await (const chunk of req) { bytes += chunk.length; if (bytes > 4096) throw Object.assign(new Error('Sprachanfrage zu groß.'), { status: 413 }); chunks.push(Buffer.from(chunk)); }
    let body; try { body = JSON.parse(Buffer.concat(chunks).toString('utf8')); } catch { throw Object.assign(new Error('Ungültiges JSON.'), { status: 400 }); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw Object.assign(new Error('JSON-Objekt erforderlich.'), { status: 400 });
    return body;
  }
  function rate(person) {
    const now = Date.now(); for (const [key, item] of recent) if (item.until < now) recent.delete(key);
    const record = recent.get(person) || { count: 0, until: now + 60_000 }; recent.set(person, record);
    if (++record.count > 120) throw Object.assign(new Error('Zu viele Sprachanfragen.'), { status: 429 });
  }
  function commit(personId, action, change) {
    if (!store) throw Object.assign(new Error('Profilspeicherung nicht verfügbar.'), { status: 503 });
    store.commit(core.db, { actor: personId, action, areaId: null }, change);
  }
  function knownTexts() {
    return [...new Set((core.db.flashcards || []).flatMap(card => [card.question,
      ...(Array.isArray(card.answers) && card.answers.length ? [`Die richtige Antwort ist ${card.answers[0]}.`, `Die Antwort ist ${card.answers[0]}.`] : [])])
      .filter(text => typeof text === 'string' && text.trim() && text.length <= 500))];
  }
  async function recover() {
    if (!recovery) recovery = cache.recover(knownTexts(), Object.keys(voices), [
      'piper-1.4.2-thorsten-medium-v1:[["default","de_DE-thorsten-medium"]]',
      'piper-thorsten-medium-v1:[["default","de_DE-thorsten-medium"]]'
    ]).catch(error => { recovery = undefined; throw error; });
    return recovery;
  }
  async function synthesize(text, voice, regenerate = false) {
    if (!engine && !endpoint) throw Object.assign(new Error('Lokale Sprachausgabe ist nicht eingerichtet.'), { status: 503 });
    const { key, cached } = await cache.get(text, voice, regenerate);
    const audio = await cache.read(key);
    if (audio.length > 4 * 1024 ** 2) throw Object.assign(new Error('Sprachdatei zu groß.'), { status: 502 });
    return { audio: audio.toString('base64'), key, cached, voice };
  }
  function preferred(person) {
    const choice = core.db.people.find(p => p.id === person)?.ttsVoice;
    return enabled().includes(choice) ? choice : defaultVoice();
  }
  async function handle(req) {
    try {
      const body = await bodyOf(req), person = authorized(body.launchKey);
      if (!person) return fail(403, 'Keine aktive Spielberechtigung.');
      if (typeof body.text !== 'string' || !body.text.trim() || body.text.length > 500 || (body.voice !== undefined && (typeof body.voice !== 'string' || !Object.hasOwn(voices, body.voice)))) return fail(400, 'Text oder Stimme ungültig.');
      rate(person);
      const voice = body.voice && body.voice !== 'default' && enabled().includes(body.voice) ? body.voice : preferred(person);
      let result;
      try { result = await synthesize(body.text, voice); }
      catch (error) { if (voice === defaultVoice()) throw error; result = { ...await synthesize(body.text, defaultVoice()), fallback: true }; }
      if (!authorized(body.launchKey)) return fail(403, 'Spielsitzung beendet.');
      return ok(result);
    } catch (error) { return fail(error.status || 503, error.status ? error.message : 'Sprachausgabe vorübergehend nicht verfügbar.'); }
  }
  async function preferences(req) {
    try {
      const body = await bodyOf(req), person = authorized(body.launchKey);
      if (!person) return fail(403, 'Keine aktive Spielberechtigung.');
      if (body.op === 'set') {
        if (!enabled().includes(body.voice)) return fail(400, 'Stimme nicht freigegeben.');
        commit(person, 'tts-player-voice', next => { next.people.find(p => p.id === person).ttsVoice = body.voice; });
      } else if (body.op === 'preview') {
        if (!enabled().includes(body.voice)) return fail(400, 'Stimme nicht freigegeben.');
        rate(person); const result = await synthesize(SAMPLE, body.voice);
        if (!authorized(body.launchKey)) return fail(403, 'Spielsitzung beendet.');
        return ok(result);
      } else if (body.op !== 'state') return fail(400, 'Unbekannte Stimmenaktion.');
      return ok({ voices: catalog().filter(v => v.enabled), voice: preferred(person), defaultVoice: defaultVoice() });
    } catch (error) { return fail(error.status || 503, error.status ? error.message : 'Stimmenauswahl nicht verfügbar.'); }
  }
  async function manage(req, session) {
    try {
      if (!isSuper(core.db, session)) return fail(403, 'SuperAdmin-Anmeldung erforderlich.');
      const body = await bodyOf(req);
      if (body.op === 'settings') {
        if (!Object.hasOwn(voices, body.defaultVoice) || !Array.isArray(body.disabledVoices) || body.disabledVoices.some(id => !Object.hasOwn(voices, id)) || body.disabledVoices.includes(body.defaultVoice)) return fail(400, 'Eine freigegebene Standardstimme auswählen.');
        commit(session.personId, 'tts-settings', next => { next.ttsSettings = { defaultVoice: body.defaultVoice, disabledVoices: [...new Set(body.disabledVoices)] }; });
        return ok({ defaultVoice: defaultVoice(), voices: catalog() });
      }
      if (body.op === 'list' || body.op === 'recover') {
        if (body.op === 'recover') recovery = undefined;
        const recovered = await recover();
        const all = await cache.list(), q = String(body.q || '').toLocaleLowerCase('de'), voice = body.voice || '';
        const filtered = all.filter(item => (!voice || item.voice === voice || (voice === 'unassigned' && !item.assigned)) && (!q || (item.text || '').toLocaleLowerCase('de').includes(q)));
        const offset = Math.max(0, Math.trunc(Number(body.offset) || 0));
        return ok({ items: filtered.sort((a, b) => (a.voice || '~').localeCompare(b.voice || '~') || (a.text || a.key).localeCompare(b.text || b.key)).slice(offset, offset + 100), total: filtered.length,
          recovered, stats: await cache.stats(), voices: catalog(), defaultVoice: defaultVoice(), batch,
          byVoice: Object.values(all.reduce((groups, item) => { const id = item.voice || 'unassigned'; const g = groups[id] ||= { voice: id, files: 0, bytes: 0 }; g.files++; g.bytes += item.bytes; return groups; }, {})) });
      }
      if (body.op === 'audio') {
        const audio = await cache.read(body.key); return ok({ audio: audio.toString('base64') });
      }
      if (body.op === 'preview') {
        if (!Object.hasOwn(voices, body.voice)) return fail(400, 'Unbekannte Stimme.');
        rate(session.personId); return ok(await synthesize(SAMPLE, body.voice));
      }
      if (body.op === 'regenerate') {
        await recover(); const item = (await cache.list()).find(item => item.key === body.key);
        if (!item?.assigned || !Object.hasOwn(voices, item.voice)) return fail(400, 'Für dieses Audio fehlen Text oder verfügbare Stimme.');
        rate(session.personId);
        const result = await synthesize(item.text, item.voice, true);
        if (result.key !== item.key) await cache.retire(item.key);
        return ok(result);
      }
      if (body.op === 'prepare') {
        if (batchRunning) return fail(409, 'Vorbereitung läuft bereits.');
        if (!engine && !endpoint) return fail(503, 'Lokale Sprachausgabe ist nicht eingerichtet.');
        const texts = knownTexts().slice(0, 100), ids = enabled();
        batch = { total: texts.length * ids.length, completed: 0, failed: 0, status: 'running' }; batchRunning = true;
        (async () => {
          for (const text of texts) for (const voice of ids) {
            if (batch.status === 'cancelled' || !isSuper(core.db, session)) { batch.status = 'cancelled'; return; }
            try { await cache.get(text, voice); } catch { batch.failed++; }
            batch.completed++;
          }
          batch.status = batch.failed ? 'finished-with-errors' : 'finished';
        })().finally(() => { batchRunning = false; });
        return ok({ batch });
      }
      if (body.op === 'cancel') { if (batchRunning) batch.status = 'cancelled'; return ok({ batch }); }
      return fail(400, 'Unbekannte Audioaktion.');
    } catch (error) { return fail(error.status || 503, error.status ? error.message : 'Audioverwaltung vorübergehend nicht verfügbar.'); }
  }
  return { handle, preferences, manage };
}
module.exports = { createTtsService, DEFAULT_VOICES };
