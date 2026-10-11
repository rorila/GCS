const fs = require('node:fs');
const path = require('node:path');
const net = require('node:net');
const { spawn, execFileSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const { DEFAULT_VOICES } = require('./cms-tts.cjs');

function loadEnvironment(root, env = { ...process.env }) {
  const file = path.join(root, '.env');
  if (fs.existsSync(file)) for (const line of fs.readFileSync(file, 'utf8').split(/\r?\n/)) {
    const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
    if (match && !(match[1] in env)) env[match[1]] = match[2].replace(/^["']|["']$/g, '');
  }
  return env;
}
async function portFree(port) {
  return await new Promise(resolve => {
    const probe = net.createServer();
    probe.once('error', () => resolve(false));
    probe.listen(port, '127.0.0.1', () => probe.close(() => resolve(true)));
  });
}
function alive(pid) { try { process.kill(pid, 0); return true; } catch { return false; } }
function readState(file) { try { return JSON.parse(fs.readFileSync(file, 'utf8')); } catch { return null; } }
function removeState(file, pid) { if (readState(file)?.pid === pid) fs.rmSync(file, { force: true }); }
async function stopChild(child) {
  if (child.exitCode !== null || child.signalCode !== null) return;
  await new Promise(resolve => {
    const timer = setTimeout(() => { child.kill('SIGKILL'); resolve(); }, 3000);
    child.once('exit', () => { clearTimeout(timer); resolve(); });
    child.kill('SIGTERM');
  });
}

// Only a matching project-owned record can be reused. Unknown services stay untouched.
async function ensureLocalService({ name, preferredPort, stateFile, identity, command, argsForPort, cwd,
  ready, timeoutMs = 60000, logger = console.log, env = process.env, signal }) {
  if (!Number.isInteger(preferredPort) || preferredPort < 1024 || preferredPort > 65515) throw Error('Ungueltiger lokaler Sprachdienst-Port.');
  if (signal?.aborted) throw Error('Start der Sprachdienste abgebrochen.');
  const state = readState(stateFile);
  if (state?.identity === identity && Number.isInteger(state.pid) && Number.isInteger(state.port)
    && state.port >= 1024 && state.port <= 65535 && alive(state.pid) && await ready(state.port)) {
    logger(`[OK] ${name} aus v2 laeuft bereits auf Port ${state.port}.`);
    return { port: state.port, owned: false, stop: async () => {} };
  }
  let port = preferredPort;
  while (!await portFree(port)) {
    if (++port > preferredPort + 20) throw Error(`Kein freier lokaler Port fuer ${name}.`);
  }
  if (port !== preferredPort) logger(`[INFO] Port ${preferredPort} ist belegt; ${name} aus v2 verwendet Port ${port}.`);
  fs.mkdirSync(path.dirname(stateFile), { recursive: true });
  const out = fs.openSync(stateFile + '.stdout.log', 'a'), err = fs.openSync(stateFile + '.stderr.log', 'a');
  let child;
  try { child = spawn(command, argsForPort(port), { cwd, env, windowsHide: true, stdio: ['ignore', out, err] }); }
  finally { fs.closeSync(out); fs.closeSync(err); }
  let spawnError;
  child.once('error', error => { spawnError = error; });
  let stopping;
  const stop = () => stopping ||= (async () => { await stopChild(child); removeState(stateFile, child.pid); })();
  try {
    const deadline = Date.now() + timeoutMs;
    while (Date.now() < deadline) {
      if (signal?.aborted) throw Error('Start der Sprachdienste abgebrochen.');
      if (spawnError) throw spawnError;
      if (child.exitCode !== null || child.signalCode !== null) throw Error(`${name} konnte nicht starten. Details: ${stateFile}.stderr.log`);
      if (await ready(port)) {
        // State-Datei atomar schreiben. Windows kann Rename kurz blockieren
        // (Defender/Indexer greifen frisch geschriebene Dateien an) — kleine
        // Retry-Schleife, danach direkter Schreibpfad als Fallback.
        const temporary = stateFile + '.' + randomUUID() + '.tmp', payload = JSON.stringify({ pid: child.pid, port, identity });
        let lastError;
        for (let attempt = 0; attempt < 5; attempt++) {
          try { fs.writeFileSync(temporary, payload); fs.renameSync(temporary, stateFile); lastError = undefined; break; }
          catch (error) { lastError = error; await new Promise(resolve => setTimeout(resolve, 200)); }
        }
        fs.rmSync(temporary, { force: true });
        if (lastError) try { fs.writeFileSync(stateFile, payload); }
        catch { throw lastError; }
        logger(`[OK] ${name} aus v2 ist bereit auf Port ${port}.`);
        return { port, owned: true, stop };
      }
      await new Promise(resolve => setTimeout(resolve, 250));
    }
    throw Error(`${name} wurde nicht rechtzeitig bereit. Details: ${stateFile}.stderr.log`);
  } catch (error) { await stop(); throw error; }
}
async function fetchJson(url) {
  try { const response = await fetch(url, { signal: AbortSignal.timeout(1500) }); return response.ok ? await response.json() : null; }
  catch { return null; }
}
function localPort(url, pathname) {
  const value = new URL(url);
  if (value.protocol !== 'http:' || value.hostname !== '127.0.0.1' || value.pathname !== pathname
    || value.username || value.password || value.hash || value.search) throw Error('Sprachdienste muessen auf lokale HTTP-Endpunkte zeigen.');
  return Number(value.port || 80);
}
async function startLocalServices({ root = path.resolve(__dirname, '../..'), env = loadEnvironment(root), logger = console.log, signal } = {}) {
  const owned = [];
  const stop = async () => { await Promise.allSettled(owned.map(service => service.stop())); };
  try {
    const directory = path.join(root, 'game-server/tts');
    const python = path.join(directory, '.venv', process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
    const voicesDir = path.join(directory, 'voices');
    if (!fs.existsSync(python)) throw Error('Die lokale Sprachumgebung in v2 fehlt. Einmalig npm run setup:speech ausfuehren.');
    const voices = JSON.parse(env.TTS_VOICES || JSON.stringify(DEFAULT_VOICES));
    if (!voices || Array.isArray(voices) || !Object.keys(voices).length
      || Object.entries(voices).some(([id, model]) => !/^[a-zA-Z0-9_-]{1,80}$/.test(id) || typeof model !== 'string' || !/^[a-zA-Z0-9_-]+$/.test(model))) throw Error('Ungueltiger Stimmenkatalog.');
    const models = [...new Set(Object.values(voices))];
    for (const model of models) for (const extension of ['.onnx', '.onnx.json']) {
      const file = path.join(voicesDir, model + extension);
      if (!fs.existsSync(file) || !fs.statSync(file).size) throw Error(`Lokales Stimmenmodell fehlt: ${file}. npm run setup:speech ausfuehren.`);
    }
    const ffmpeg = execFileSync(python, ['-c', 'import piper, imageio_ffmpeg; print(imageio_ffmpeg.get_ffmpeg_exe())'], { encoding: 'utf8', windowsHide: true, timeout: 30000 }).trim();
    env.TTS_FFMPEG = ffmpeg;
    env.TTS_VOICES = JSON.stringify(voices);
    env.TTS_MODEL_VERSION ||= 'piper-1.4.2-thorsten-medium-v1';
    env.TTS_PIPER_SYNTHESIS_PATH = '/';
    const piper = await ensureLocalService({ name: 'Piper', preferredPort: localPort(env.CMS_TTS_URL || 'http://127.0.0.1:5000/', '/'),
      stateFile: path.join(directory, 'run/piper.json'), identity: JSON.stringify([python, voicesDir, models]), command: python, cwd: voicesDir, env, logger, signal,
      argsForPort: port => ['-m', 'piper.http_server', '-m', models[0], '--host', '127.0.0.1', '--port', String(port), '--data-dir', voicesDir],
      ready: async port => { const inventory = await fetchJson(`http://127.0.0.1:${port}/voices`); return !!inventory && models.every(model => Object.hasOwn(inventory, model)); }
    });
    owned.push(piper);
    env.CMS_TTS_URL = `http://127.0.0.1:${piper.port}/`;
    env.TTS_PIPER_URL = env.CMS_TTS_URL.slice(0, -1);
    const whisperDir = path.join(root, 'tools/speech-service');
    const executable = path.join(whisperDir, 'whisper/Release/whisper-server.exe'), model = path.join(whisperDir, 'models/ggml-small.bin');
    if (!fs.existsSync(executable) || !fs.existsSync(model)) throw Error('Lokaler Whisper-Dienst in v2 fehlt. Siehe scripts/speech/install-speech-service.ps1.');
    const whisper = await ensureLocalService({ name: 'Whisper', preferredPort: localPort(env.CMS_SPEECH_URL || 'http://127.0.0.1:8177/inference', '/inference'),
      stateFile: path.join(whisperDir, 'run/whisper.json'), identity: JSON.stringify([executable, model]), command: executable, cwd: path.dirname(executable), env, logger, signal,
      argsForPort: port => ['--host', '127.0.0.1', '--port', String(port), '-m', model, '-l', 'de', '-t', '8', '--no-timestamps'],
      ready: async port => { try { const response = await fetch(`http://127.0.0.1:${port}/`, { signal: AbortSignal.timeout(1500) }); await response.arrayBuffer(); return response.ok; } catch { return false; } }
    });
    owned.push(whisper);
    env.CMS_SPEECH_URL = `http://127.0.0.1:${whisper.port}/inference`;
    return { env, stop, services: owned };
  } catch (error) { await stop(); throw error; }
}
module.exports = { startLocalServices, ensureLocalService, loadEnvironment, portFree };
