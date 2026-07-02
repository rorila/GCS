import { AgentScript } from './AgentScriptTypes';

/**
 * AgentScriptRepository
 *
 * Persistiert und lädt AgentScript-Dateien. Standard-Implementierung nutzt
 * das Node.js-Dateisystem; kann für Browser/Storage durch einen Adapter ersetzt werden.
 */
export class AgentScriptRepository {
    constructor(private baseDirectory: string = './snippets') {}

    public save(script: AgentScript, filename?: string): string {
        const fs = require('fs');
        const path = require('path');
        const name = (filename || script.name).replace(/[^a-z0-9_-]/gi, '_');
        const filePath = path.join(this.baseDirectory, `${name}.agent.json`);

        if (!fs.existsSync(this.baseDirectory)) {
            fs.mkdirSync(this.baseDirectory, { recursive: true });
        }

        fs.writeFileSync(filePath, JSON.stringify(script, null, 2), 'utf-8');
        return filePath;
    }

    public load(filePath: string): AgentScript {
        const fs = require('fs');
        if (!fs.existsSync(filePath)) {
            throw new Error(`Skript nicht gefunden: ${filePath}`);
        }
        const content = fs.readFileSync(filePath, 'utf-8');
        return JSON.parse(content) as AgentScript;
    }

    public list(): { name: string; path: string; script?: AgentScript }[] {
        const fs = require('fs');
        const path = require('path');
        if (!fs.existsSync(this.baseDirectory)) {
            return [];
        }

        return fs
            .readdirSync(this.baseDirectory)
            .filter((f: string) => f.endsWith('.agent.json'))
            .map((f: string) => {
                const fullPath = path.join(this.baseDirectory, f);
                try {
                    const script = this.load(fullPath);
                    return { name: script.name, path: fullPath, script };
                } catch (e) {
                    return { name: f, path: fullPath };
                }
            });
    }
}
