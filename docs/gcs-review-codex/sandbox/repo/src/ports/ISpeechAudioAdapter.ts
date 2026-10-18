/** Austauschbarer Port für serverseitige Sprache; keine Projekt-Persistenz. */
export interface ISpeechAudioAdapter {
    prepare(endpoint: string, text: string, voice: string, signal: AbortSignal, launchKey?: string): Promise<string>;
    releaseAudio?(url: string): void;
    createAudio(): HTMLAudioElement;
}
