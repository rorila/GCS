const MAX_BYTES = 480044;
const fail = (status, message) => ({ status, data: { ok: false, message } });
function validWav(bytes) {
  return bytes.length >= 3244 && bytes.length <= MAX_BYTES && bytes.toString('ascii', 0, 4) === 'RIFF'
    && bytes.readUInt32LE(4) === bytes.length - 8 && bytes.toString('ascii', 8, 16) === 'WAVEfmt '
    && bytes.readUInt32LE(16) === 16 && bytes.readUInt16LE(20) === 1 && bytes.readUInt16LE(22) === 1
    && bytes.readUInt32LE(24) === 16000 && bytes.readUInt32LE(28) === 32000
    && bytes.readUInt16LE(32) === 2 && bytes.readUInt16LE(34) === 16
    && bytes.toString('ascii', 36, 40) === 'data' && bytes.readUInt32LE(40) === bytes.length - 44 && bytes.length % 2 === 0;
}
function createSpeechService({ core, launches, endpoint = process.env.CMS_SPEECH_URL || '', fetchImpl = fetch }) {
  const guards = require('./cms-http-guard.cjs').createHttpGuards();
  let upstream;
  if (endpoint) {
    upstream = new URL(endpoint);
    if (upstream.protocol !== 'http:' || !['127.0.0.1', '[::1]'].includes(upstream.hostname) || upstream.username || upstream.password || upstream.search || upstream.hash || upstream.pathname !== '/inference') throw new Error('CMS_SPEECH_URL muss auf den lokalen Whisper-Endpunkt /inference zeigen.');
  }
  const busy = new Set(), recent = new Map();
  function authorized(key) {
    const launch = typeof key === 'string' && /^[a-f0-9]{48}$/.test(key) && launches.get(key);
    const session = launch && core.session(launch.token);
    const ps = launch && core.db.playSessions.find(s => s.id === launch.playSessionId);
    const game = launch && core.db.games.find(g => g.id === launch.gameId);
    return launch && !launch.preview && session && ps?.childId === session.personId && ps.status === 'active'
      && ps.gameId === launch.gameId && core.can(session, 'play', { game, areaId: launch.areaId }) ? session.personId : null;
  }
  async function handle(req) {
    if (!guards.originOk(req)) return fail(403, 'Ungültiger Anfrageursprung.');
    const key = req.headers['x-gcs-launch'], person = authorized(key);
    if (!person) return fail(403, 'Keine aktive Spielberechtigung.');
    if (!upstream) return fail(503, 'Lokaler Spracherkennungsdienst ist nicht eingerichtet.');
    if (req.method !== 'POST') return fail(405, 'Methode nicht unterstützt.');
    if (req.url === '/api/cms/speech/status') return { status: 200, data: { ok: true, configured: true } };
    if (req.headers['content-type'] !== 'audio/wav') return fail(415, 'Nur WAV-Audio ist erlaubt.');
    if (!['de', 'de-DE'].includes(req.headers['x-speech-language'] || 'de-DE')) return fail(400, 'Diese Erkennung unterstützt Deutsch.');
    let prompt = '';
    try { prompt = decodeURIComponent(String(req.headers['x-speech-prompt'] || '')).trim(); } catch { return fail(400, 'Ungültiger Erkennungshinweis.'); }
    if (prompt.length > 240) return fail(400, 'Der Erkennungshinweis ist zu lang.');
    for (const [id, time] of recent) if (Date.now() - time > 60000) recent.delete(id);
    if (busy.has(person) || busy.size >= 2 || Date.now() - (recent.get(person) || 0) < 1000) return fail(429, 'Spracherkennung ist beschäftigt. Bitte erneut versuchen.');
    busy.add(person); recent.set(person, Date.now());
    const controller = new AbortController();
    const timeout = setTimeout(() => { controller.abort(); req.destroy?.(); }, 25000);
    const abort = () => controller.abort();
    req.once('aborted', abort);
    try {
      let size = 0; const chunks = [];
      for await (const chunk of req.iterator({ destroyOnReturn: false })) {
        size += chunk.length;
        if (size > MAX_BYTES) { req.resume(); return fail(413, 'Aufnahme ist zu groß.'); }
        chunks.push(Buffer.from(chunk));
      }
      const bytes = Buffer.concat(chunks);
      if (!validWav(bytes)) return fail(400, 'Ungültige Aufnahme: PCM16, mono, 16 kHz, maximal 15 Sekunden erforderlich.');
      if (!authorized(key)) return fail(403, 'Spielsitzung beendet.');
      const form = new FormData();
      form.append('file', new Blob([bytes], { type: 'audio/wav' }), 'answer.wav');
      form.append('language', 'de'); form.append('response_format', 'json'); form.append('temperature', '0'); form.append('temperature_inc', '0');
      if (prompt) form.append('prompt', prompt);
      const response = await fetchImpl(upstream, { method: 'POST', body: form, signal: controller.signal, redirect: 'error' });
      if (!response.ok) return fail(502, 'Spracherkennung konnte die Aufnahme nicht verarbeiten.');
      const output = []; let outputBytes = 0;
      for await (const chunk of response.body) {
        outputBytes += chunk.length;
        if (outputBytes > 4096) { controller.abort(); return fail(502, 'Ungültige Antwort des Spracherkennungsdienstes.'); }
        output.push(Buffer.from(chunk));
      }
      const result = JSON.parse(Buffer.concat(output).toString('utf8'));
      if (!authorized(key)) return fail(403, 'Spielsitzung beendet.');
      if (typeof result.text !== 'string' || result.text.length > 500) return fail(502, 'Ungültige Antwort des Spracherkennungsdienstes.');
      return { status: 200, data: { ok: true, text: result.text.trim() } };
    } catch { return fail(controller.signal.aborted ? 504 : 503, 'Spracherkennungsdienst nicht erreichbar oder Zeitlimit überschritten.'); }
    finally { clearTimeout(timeout); req.removeListener('aborted', abort); busy.delete(person); }
  }
  return { handle };
}
module.exports = { createSpeechService, validWav, MAX_BYTES };
