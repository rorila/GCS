import type { ITrainingAdapter, TrainingJob, TrainingAnswers } from '../ports/ITrainingAdapter';

/** Trainings-I/O getrennt von GameProject-Persistenz. Vite verwendet den vorhandenen API-Proxy. */
export class ServerTrainingAdapter implements ITrainingAdapter {
    private token = '';
    constructor(private readonly endpoint = '/api/training') {}
    private async request<T>(route: string, body?: unknown): Promise<T> {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 15000);
        try {
            const response = await fetch(this.endpoint + route, {
                method: body === undefined ? 'GET' : 'POST', signal: controller.signal,
                headers: { 'Content-Type': 'application/json', 'X-GCS-Training-Token': this.token },
                body: body === undefined ? undefined : JSON.stringify(body)
            });
            const data = await response.json();
            if (!response.ok) throw new Error(data.error || `Training-Server: HTTP ${response.status}`);
            return data as T;
        } finally { clearTimeout(timeout); }
    }
    async preflight() {
        const data = await this.request<{ ready: boolean; error?: string; token: string }>('/preflight');
        this.token = data.token;
        return data;
    }
    status() { return this.request<{ job: TrainingJob | null }>('/status'); }
    start(input: Parameters<ITrainingAdapter['start']>[0]) {
        return this.request<{ job: TrainingJob }>('/start', input);
    }
    cancel() { return this.request<{ job: TrainingJob }>('/cancel', {}); }
    results(id: string) {
        return this.request<{ before: TrainingAnswers[] | null; after: TrainingAnswers[] | null }>(`/${encodeURIComponent(id)}/results`);
    }
}
