// Erkennt, ob in Tauri-Kontext, und stellt die electronFS-API bereit
import { readTextFile, writeTextFile, readDir } from '@tauri-apps/plugin-fs';
import { open, save } from '@tauri-apps/plugin-dialog';
import { resourceDir } from '@tauri-apps/api/path';

export function installTauriFSAdapter() {
    if (!(window as any).__TAURI_INTERNALS__) return; // Prüfe, ob in Tauri Umgebung

    (window as any).electronFS = {
        readFile: (p: string) => readTextFile(p),
        writeFile: (p: string, c: string) => writeTextFile(p, c),
        listFiles: async (d: string, ext?: string) => {
            try {
                // Liest das Verzeichnis absolut (da d typischerweise schon ein absoluter Pfad im Editor ist)
                // Tauri verbietet standardmäßig absolute Pfade in v2 ohne spezielle Flags.
                // Da wir die Scope-Liste festlegen, funktioniert es, wenn der Pfad in der Scope ist.
                const entries = await readDir(d);
                return ext ? entries.filter(e => e.name?.endsWith(ext)).map(e => e.name!) 
                           : entries.map(e => e.name!);
            } catch(e) {
                console.error("TauriFSAdapter listFiles error:", e);
                return [];
            }
        },
        showOpenDialog: async (opts: any) => {
            // Mapping der Electron Optionen auf Tauri Optionen
            const options: any = {};
            if (opts?.filters) {
                options.filters = opts.filters;
            }
            if (opts?.defaultPath) {
                options.defaultPath = opts.defaultPath;
            }
            const res = await open(options);
            // Tauri gibt string oder string[] oder null zurück
            if (res === null) return null;
            if (Array.isArray(res)) return res[0];
            return res;
        },
        showSaveDialog: async (opts: any) => {
            const options: any = {};
            if (opts?.filters) {
                options.filters = opts.filters;
            }
            if (opts?.defaultPath) {
                options.defaultPath = opts.defaultPath;
            }
            const res = await save(options);
            return res;
        },
        allowPath: async () => true, // Allowlist ist in tauri.conf.json statisch
        getAppPath: async () => {
            try {
                return await resourceDir(); 
            } catch(e) {
                return "/";
            }
        }
    };
    console.log("Tauri FS Adapter successfully installed.");
}
