import { promises as fs } from 'fs';
import path from 'path';
import { createHash, randomUUID } from 'crypto';

export interface SpeechEngine {
    readonly version: string;
    cacheVersion?(voice: string): string;
    legacyVersions?(voice: string): string[];
    synthesize(text: string, voice: string): Promise<Buffer>;
}
export class SpeechError extends Error {
    constructor(message: string, public status = 503) { super(message); }
}
interface Entry { bytes: number; accessed: number; }
interface Metadata { text: string; voice: string; engine: string; createdAt: string; }

/** Ein Prozess besitzt den Cache. Synthese seriell, identische Aufträge zusammengefasst. */
export class SpeechCache {
    private entries = new Map<string, Entry>();
    private metadata = new Map<string, Metadata>();
    private pending = new Map<string, Promise<string>>();
    private tail: Promise<unknown> = Promise.resolve();
    private initialized?: Promise<void>;
    private bytes = 0;
    private metrics = { hits: 0, misses: 0, failures: 0, synthesisMs: 0 };

    constructor(public directory: string, private engine: SpeechEngine,
        private maxBytes = 5 * 1024 ** 3, private maxQueue = 32,
        private protectedKeys = new Set<string>()) {
        if (!Number.isSafeInteger(maxBytes) || maxBytes <= 0) throw new Error('Ungültiges TTS-Cache-Limit');
    }
    private init(): Promise<void> {
        return this.initialized ??= (async () => {
            await fs.mkdir(this.directory, { recursive: true });
            for (const name of await fs.readdir(this.directory)) {
                if (!/^[a-f0-9]{64}\.mp3$/.test(name)) continue;
                const stat = await fs.stat(path.join(this.directory, name));
                this.entries.set(name.slice(0, -4), { bytes: stat.size, accessed: stat.mtimeMs });
                this.bytes += stat.size;
                try {
                    const meta = JSON.parse(await fs.readFile(path.join(this.directory, name.slice(0, -4) + '.json'), 'utf8'));
                    if (typeof meta.text === 'string' && typeof meta.voice === 'string' && typeof meta.engine === 'string'
                        && this.keyFor(meta.text, meta.voice, meta.engine) === name.slice(0, -4)) this.metadata.set(name.slice(0, -4), meta);
                } catch { /* Legacy audio stays visible as unassigned. */ }
            }
            await this.evict(0);
        })();
    }
    private async evict(extra: number, keepKey?: string): Promise<void> {
        for (const [key, entry] of [...this.entries].sort((a, b) => a[1].accessed - b[1].accessed)) {
            if (this.bytes + extra <= this.maxBytes) break;
            if (this.protectedKeys.has(key) || key === keepKey) continue;
            await fs.unlink(path.join(this.directory, key + '.mp3'));
            this.entries.delete(key);
            this.bytes -= entry.bytes;
            this.metadata.delete(key);
            await fs.unlink(path.join(this.directory, key + '.json')).catch(() => {});
        }
        if (this.bytes + extra > this.maxBytes) throw new SpeechError('Geschützter Sprachcache belegt das Speicherlimit.', 507);
    }
    keyFor(text: string, voice: string, engine = this.engine.cacheVersion?.(voice) || this.engine.version): string {
        return createHash('sha256').update(JSON.stringify({ text: text.normalize('NFC').replace(/\s+/g, ' ').trim(), voice,
            engine, format: 'mp3-48k-mono-v1' })).digest('hex');
    }
    private async remember(key: string, text: string, voice: string, engine: string): Promise<void> {
        if (this.metadata.has(key)) return;
        const meta = { text, voice, engine, createdAt: new Date().toISOString() };
        const temporary = path.join(this.directory, key + '.' + randomUUID() + '.json.tmp');
        try {
            await fs.writeFile(temporary, JSON.stringify(meta), { flag: 'wx' });
            await fs.rename(temporary, path.join(this.directory, key + '.json'));
            this.metadata.set(key, meta);
        } finally { await fs.unlink(temporary).catch(() => {}); }
    }
    async recover(texts: string[], voices: string[], versions: string[] = []): Promise<number> {
        await this.init();
        let recovered = 0;
        for (const text of new Set(texts)) for (const voice of voices) {
            for (const version of new Set([this.engine.cacheVersion?.(voice) || this.engine.version, this.engine.version, ...versions])) {
                const key = this.keyFor(text, voice, version);
                if (this.entries.has(key) && !this.metadata.has(key)) {
                    await this.remember(key, text.normalize('NFC').replace(/\s+/g, ' ').trim(), voice, version); recovered++;
                }
            }
        }
        return recovered;
    }
    async list(): Promise<object[]> {
        await this.init();
        return [...this.entries].map(([key, entry]) => ({ key, bytes: entry.bytes,
            lastUsedAt: new Date(entry.accessed).toISOString(), ...this.metadata.get(key), assigned: this.metadata.has(key) }));
    }
    async read(key: string): Promise<Buffer> {
        if (!/^[a-f0-9]{64}$/.test(key)) throw new SpeechError('Ungültiger Audio-Schlüssel.', 400);
        await this.touch(key);
        return fs.readFile(path.join(this.directory, key + '.mp3'));
    }
    async retire(key: string): Promise<void> {
        if (!/^[a-f0-9]{64}$/.test(key)) throw new SpeechError('Ungültiger Audio-Schlüssel.', 400);
        await this.init();
        const entry = this.entries.get(key);
        if (!entry) return;
        if (this.protectedKeys.has(key)) throw new SpeechError('Dieses Audio ist geschützt.', 409);
        await fs.unlink(path.join(this.directory, key + '.mp3'));
        this.entries.delete(key); this.metadata.delete(key); this.bytes -= entry.bytes;
        await fs.unlink(path.join(this.directory, key + '.json')).catch(() => {});
    }
    async get(text: string, voice: string, regenerate = false): Promise<{ key: string; cached: boolean }> {
        await this.init();
        const normalized = text.normalize('NFC').replace(/\s+/g, ' ').trim();
        if (!normalized || normalized.length > 500) throw new SpeechError('Sprechtext muss 1–500 Zeichen enthalten.', 400);
        const version = this.engine.cacheVersion?.(voice) || this.engine.version;
        let key = this.keyFor(normalized, voice, version);
        if (!regenerate && !this.entries.has(key)) {
            for (const legacy of [this.engine.version, ...(this.engine.legacyVersions?.(voice) || [])]) {
                const oldKey = this.keyFor(normalized, voice, legacy);
                if (this.entries.has(oldKey)) {
                    await this.remember(oldKey, normalized, voice, legacy);
                    key = oldKey; break;
                }
            }
        }
        if (this.entries.has(key) && !regenerate) {
            await this.remember(key, normalized, voice, version);
            await this.touch(key); this.metrics.hits++; return { key, cached: true };
        }
        const existing = this.pending.get(key);
        if (existing) { await existing; return { key, cached: true }; }
        if (this.pending.size >= this.maxQueue) throw new SpeechError('Sprachserver ausgelastet. Bitte erneut versuchen.', 429);
        this.metrics.misses++;
        const job = this.tail.then(async () => {
            const started = Date.now();
            const temporary = path.join(this.directory, key + '.' + randomUUID() + '.tmp');
            try {
                const audio = await this.engine.synthesize(normalized, voice);
                if (!audio.length || audio.length > this.maxBytes) throw new SpeechError('Audio überschreitet das Cache-Limit.', 507);
                const previousBytes = this.entries.get(key)?.bytes || 0;
                await this.evict(Math.max(0, audio.length - previousBytes), key);
                await fs.writeFile(temporary, audio, { flag: 'wx' });
                await fs.rename(temporary, path.join(this.directory, key + '.mp3'));
                this.entries.set(key, { bytes: audio.length, accessed: Date.now() });
                this.bytes += audio.length - previousBytes;
                await this.remember(key, normalized, voice, version);
                this.metrics.synthesisMs += Date.now() - started;
                return key;
            } catch (error) {
                this.metrics.failures++;
                throw error;
            } finally {
                await fs.unlink(temporary).catch(() => {});
                this.pending.delete(key);
            }
        });
        this.pending.set(key, job);
        this.tail = job.catch(() => {});
        await job;
        return { key, cached: false };
    }
    async touch(key: string): Promise<void> {
        await this.init();
        const entry = this.entries.get(key);
        if (!entry) throw new SpeechError('Audio nicht vorhanden. Bitte erneut anfordern.', 404);
        entry.accessed = Date.now();
        const now = new Date();
        await fs.utimes(path.join(this.directory, key + '.mp3'), now, now).catch(() => {});
    }
    async stats(): Promise<object> {
        await this.init();
        return { ...this.metrics, bytes: this.bytes, files: this.entries.size,
            queued: this.pending.size, maxBytes: this.maxBytes };
    }
}
