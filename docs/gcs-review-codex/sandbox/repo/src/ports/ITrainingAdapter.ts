export interface TrainingJob {
    id: string; state: string; error?: string;
    event?: { event: string; step?: number; total?: number; loss?: number; phase?: string; completed?: number };
}
export interface TrainingAnswers { question: string; answer: string }
export interface ITrainingAdapter {
    preflight(): Promise<{ ready: boolean; error?: string }>;
    status(): Promise<{ job: TrainingJob | null }>;
    start(input: { dataset: string; evaluation: string[]; steps: number; approved: boolean }): Promise<{ job: TrainingJob }>;
    cancel(): Promise<{ job: TrainingJob }>;
    results(id: string): Promise<{ before: TrainingAnswers[] | null; after: TrainingAnswers[] | null }>;
}
