export interface SpeechOptions {
    language: string;
    maxDurationMs: number;
    silenceMs: number;
    prompt?: string;
}
export interface ISpeechRecognitionAdapter {
    prepare(launchKey: string): Promise<void>;
    listen(launchKey: string, options: SpeechOptions): Promise<{ text: string }>;
    stop(): void;
    cancel(): void;
}
