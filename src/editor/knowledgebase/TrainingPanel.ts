import type { ITrainingAdapter, TrainingJob } from '../../ports/ITrainingAdapter';
import { ServerTrainingAdapter } from '../../adapters/ServerTrainingAdapter';

/** Begrenzte lokale SFT-Läufe; keine automatische Modellaktivierung. */
export class TrainingPanel {
    private timer?: ReturnType<typeof setTimeout>;
    private disposed = false;
    private busy = false;
    private ready = false;
    private dataset = '';
    private job: TrainingJob | null = null;
    private selection = 0;
    constructor(private readonly root: HTMLElement, private readonly api: ITrainingAdapter = new ServerTrainingAdapter()) {
        root.innerHTML = `<section style="background:#12122a;border:1px solid #40406a;border-radius:8px;padding:16px;margin-bottom:20px">
          <h3 style="margin-top:0">Lokales Modell trainieren</h3>
          <p>Geprüfte Beispiele in den gespeicherten Adapter einlernen. Das aktive Ollama-Modell bleibt bis zum späteren Export unverändert.</p>
          <label>Trainingsdatei (JSONL, maximal 2 MB) <input data-field="file" type="file" accept=".jsonl,application/json"></label>
          <p data-field="summary">Noch keine Datei ausgewählt.</p>
          <details><summary>Beispiele prüfen</summary><pre data-field="preview" style="white-space:pre-wrap;max-height:220px;overflow:auto"></pre></details>
          <label style="display:block;margin-top:12px">Separate Prüffragen – eine Frage pro Zeile
            <textarea data-field="questions" rows="3" style="display:block;width:100%;box-sizing:border-box" placeholder="Neue Formulierungen und bisherige Fähigkeiten prüfen"></textarea></label>
          <label>Trainingsschritte (1–200) <input data-field="steps" type="number" min="1" max="200" value="10" style="width:75px"></label>
          <label style="display:block;margin:12px 0"><input data-field="approval" type="checkbox"> Ich habe die Beispiele geprüft und gebe sie für das Training frei.</label>
          <div style="display:flex;gap:10px;flex-wrap:wrap"><button data-field="connect">Verbindung prüfen</button><button data-field="start" disabled>Training starten</button><button data-field="cancel" disabled>Training abbrechen</button></div>
          <p data-field="status" role="status" aria-live="polite">Verbindung wird geprüft …</p>
          <progress data-field="progress" max="1" value="0" style="width:100%"></progress>
          <div data-field="results" style="white-space:pre-wrap;overflow-wrap:anywhere"></div>
          <small>Ein vollständiger GGUF-Export und die Übernahme in Ollama folgen in der nächsten Ausbaustufe.</small>
        </section>`;
        this.get<HTMLInputElement>('file').onchange = () => { void this.loadFile(); };
        for (const field of ['approval', 'questions', 'steps']) this.get(field).addEventListener('input', () => this.buttons());
        this.get('connect').onclick = () => { void this.connect(); };
        this.get('start').onclick = () => { void this.start(); };
        this.get('cancel').onclick = () => { void this.cancel(); };
        void this.connect();
    }
    dispose() { this.disposed = true; this.selection++; clearTimeout(this.timer); }
    private get<T extends HTMLElement = HTMLElement>(field: string): T {
        return this.root.querySelector(`[data-field="${field}"]`)! as T;
    }
    private message(text: string) { if (!this.disposed) this.get('status').textContent = text; }
    private active() { return !!this.job && ['starting', 'running', 'cancelling'].includes(this.job.state); }
    private questions() { return this.get<HTMLTextAreaElement>('questions').value.split('\n').map(q => q.trim()).filter(Boolean); }
    private buttons() {
        const active = this.active();
        const questions = this.questions();
        const steps = this.get<HTMLInputElement>('steps').valueAsNumber;
        this.get<HTMLButtonElement>('start').disabled = this.busy || !this.ready || active || !this.dataset
            || !this.get<HTMLInputElement>('approval').checked || !questions.length || questions.length > 20
            || questions.some(q => q.length > 2000) || !Number.isInteger(steps) || steps < 1 || steps > 200;
        this.get<HTMLButtonElement>('cancel').disabled = this.busy || !active || this.job?.state === 'cancelling';
        this.get<HTMLButtonElement>('connect').disabled = this.busy;
        for (const field of ['file', 'questions', 'steps', 'approval']) {
            (this.get(field) as HTMLInputElement).disabled = this.busy || active;
        }
    }
    private async loadFile() {
        const version = ++this.selection;
        this.dataset = '';
        this.get<HTMLInputElement>('approval').checked = false;
        this.get('preview').textContent = '';
        this.get('summary').textContent = 'Datei wird geprüft …';
        this.buttons();
        try {
            const file = this.get<HTMLInputElement>('file').files?.[0];
            if (!file) { this.get('summary').textContent = 'Noch keine Datei ausgewählt.'; return; }
            if (file.size > 2000000) throw new Error('Die Datei überschreitet 2 MB.');
            const text = (await file.text()).replace(/^\uFEFF/, '');
            if (version !== this.selection || this.disposed) return;
            const lines = text.split(/\r?\n/).filter(line => line.trim());
            if (!lines.length || lines.length > 500) throw new Error('1 bis 500 Beispiele erforderlich.');
            const seen = new Set<string>();
            const preview = lines.map((line, index) => {
                const messages = JSON.parse(line)?.messages;
                if (!Array.isArray(messages) || !['user,assistant', 'system,user,assistant'].includes(messages.map(m => m?.role).join(','))
                    || messages.some(m => typeof m?.content !== 'string' || !m.content.trim())) {
                    throw new Error(`Zeile ${index + 1}: system? / user / assistant mit nicht leerem Inhalt erforderlich.`);
                }
                const key = JSON.stringify(messages.map(m => [m.role, m.content]));
                if (seen.has(key)) throw new Error(`Zeile ${index + 1}: doppeltes Beispiel.`);
                seen.add(key);
                return messages.map(m => `${m.role}: ${m.content}`).join('\n');
            });
            this.dataset = text;
            this.get('summary').textContent = `${file.name}: ${lines.length} Beispiele. Tokenlängen prüft der Worker vor dem Modellladen.`;
            this.get('preview').textContent = preview.join('\n\n────────────────\n\n');
        } catch (error) { this.get('summary').textContent = String(error); }
        finally { if (!this.disposed) this.buttons(); }
    }
    private async connect() {
        this.busy = true; this.ready = false; this.buttons(); clearTimeout(this.timer);
        this.message('Verbindung zum lokalen Trainingsserver wird geprüft …');
        this.get('connect').textContent = 'Prüfe Verbindung …';
        try {
            const check = await this.api.preflight();
            if (this.disposed) return;
            this.ready = check.ready;
            if (!check.ready) throw new Error(check.error || 'Lokale Trainingskonfiguration fehlt.');
            await this.refresh();
        } catch (error) { this.message(`${String(error)} Verbindung prüfen nach Aktivierung des lokalen Servers mit GCS_TRAINING_ENABLED=1.`); }
        finally { this.busy = false; if (!this.disposed) { this.get('connect').textContent = 'Verbindung prüfen'; this.buttons(); } }
    }
    private async start() {
        this.busy = true; this.buttons(); clearTimeout(this.timer);
        this.get('results').textContent = '';
        try {
            const normalize = (s: string) => s.toLocaleLowerCase().split(/\s+/).filter(Boolean).join(' ');
            const prompts = new Set(this.dataset.split(/\r?\n/).filter(l => l.trim()).map(l => {
                const messages = JSON.parse(l).messages; return normalize(messages[messages.length - 2].content);
            }));
            if (this.questions().some(q => prompts.has(normalize(q)))) throw new Error('Prüffragen dürfen nicht in den Trainingsbeispielen vorkommen.');
            this.job = (await this.api.start({ dataset: this.dataset, evaluation: this.questions(),
                steps: this.get<HTMLInputElement>('steps').valueAsNumber, approved: this.get<HTMLInputElement>('approval').checked })).job;
            this.get<HTMLInputElement>('approval').checked = false;
            await this.refresh();
        } catch (error) {
            this.ready = false; // Unklare Netzwerkantwort: erst Status prüfen, nie blind erneut starten.
            this.message(`${String(error)} Bitte Verbindung prüfen, bevor ein weiterer Start versucht wird.`);
        } finally { this.busy = false; if (!this.disposed) { this.get('connect').textContent = 'Verbindung prüfen'; this.buttons(); } }
    }
    private async cancel() {
        this.busy = true; this.buttons();
        try { this.job = (await this.api.cancel()).job; await this.refresh(); }
        catch (error) { this.message(String(error)); }
        finally { this.busy = false; if (!this.disposed) { this.get('connect').textContent = 'Verbindung prüfen'; this.buttons(); } }
    }
    private async refresh() {
        if (this.disposed) return;
        clearTimeout(this.timer);
        try {
            const response = await this.api.status();
            if (this.disposed) return;
            this.job = response.job;
            const labels: Record<string, string> = { starting: 'Startet', running: 'Läuft', cancelling: 'Abbruch angefordert',
                cancelled: 'Abgebrochen', completed: 'Adapter gespeichert', failed: 'Fehlgeschlagen', interrupted: 'Unterbrochen' };
            const event = this.job?.event;
            this.message(this.job ? `${labels[this.job.state] || this.job.state} · ${this.job.id}${this.job.error ? ': ' + this.job.error : ''}${event?.step ? ` · Schritt ${event.step}/${event.total}` : ''}${event?.phase ? ` · Prüfung ${event.phase}: ${event.completed}/${event.total}` : ''}` : 'Verbindung erfolgreich. Trainingsserver und Dateipfade bereit. Zum Starten: Datei auswählen, 1–20 separate Prüffragen eingeben und Beispiele freigeben.');
            const progress = this.get<HTMLProgressElement>('progress');
            if (this.active() && !event?.step) progress.removeAttribute('value');
            else { progress.max = event?.total || 1; progress.value = this.job?.state === 'completed' ? progress.max : event?.step || 0; }
            if (this.job && !this.active()) {
                const answers = await this.api.results(this.job.id);
                if (this.disposed) return;
                const sections = [['Vorher', answers.before], ['Nachher', answers.after]] as const;
                this.get('results').textContent = sections.map(([label, rows]) => `${label}\n${rows?.map(row => `${row.question}\n${row.answer}`).join('\n\n') || 'Keine Antworten vorhanden.'}`).join('\n\n');
            }
            this.buttons();
            if (this.active()) this.timer = setTimeout(() => { void this.refresh(); }, 2000);
        } catch (error) { this.ready = false; this.message(`${String(error)} Status unklar; Verbindung erneut prüfen.`); this.buttons(); }
    }
}
