import { IExportAdapter } from '../ports/IStorageAdapter';
import { GameProject } from '../model/types';
import { GameExporter } from '../export/GameExporter';

export class HtmlExportAdapter implements IExportAdapter {
    public readonly formatName = 'Standalone HTML Game';
    public readonly fileExtension = '.html';

    public async export(project: GameProject): Promise<Blob> {
        const exporter = new GameExporter();
        const cleaned = exporter.getCleanProject(project);

        await (exporter as any).embedMedia(cleaned);

        let runtimeCode = '';
        if ((window as any).electronFS) {
            const appPath = await (window as any).electronFS.getAppPath();
            try {
                runtimeCode = await (window as any).electronFS.readFile(`${appPath}/dist/runtime-standalone.js`);
            } catch {
                runtimeCode = await (window as any).electronFS.readFile(`${appPath}/public/runtime-standalone.js`);
            }
        } else {
            const resp = await fetch('runtime-standalone.js');
            if (resp.ok) {
                const code = await resp.text();
                if (!code.trim().startsWith('<!DOCTYPE') && !code.trim().startsWith('<html')) {
                    runtimeCode = code;
                }
            }
        }

        const html = exporter.generateStandaloneHTML(cleaned, runtimeCode);
        return new Blob([html], { type: 'text/html' });
    }
}

export class JsonExportAdapter implements IExportAdapter {
    public readonly formatName = 'JSON Game Data';
    public readonly fileExtension = '.json';

    public async export(project: GameProject): Promise<Blob> {
        const exporter = new GameExporter();
        const cleaned = exporter.getCleanProject(project);

        await (exporter as any).embedMedia(cleaned);

        const json = JSON.stringify(cleaned, null, 2);
        return new Blob([json], { type: 'application/json' });
    }
}
