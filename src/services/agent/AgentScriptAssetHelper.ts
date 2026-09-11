import type { AgentScriptOperation } from './AgentScriptTypes';

/**
 * AgentScriptAssetHelper
 *
 * Hilfsmethoden zum Sammeln, Remappen und Prüfen von Asset-Pfaden in
 * AgentScript-Operationen.
 */
export class AgentScriptAssetHelper {
    private static readonly ASSET_KEYS = ['backgroundImage', 'videoSource', 'audioSource', 'src', 'image', 'sound', 'texture', 'icon'];

    public static collectAssetPaths(operations: AgentScriptOperation[]): string[] {
        const paths = new Set<string>();

        const scan = (value: any) => {
            if (typeof value === 'string') {
                if (value.match(/\.(png|jpg|jpeg|gif|webp|mp3|wav|ogg|mp4|webm|svg|json)$/i)) {
                    paths.add(value);
                }
            } else if (Array.isArray(value)) {
                value.forEach(scan);
            } else if (value && typeof value === 'object') {
                for (const key of Object.keys(value)) {
                    if (AgentScriptAssetHelper.ASSET_KEYS.includes(key) && typeof value[key] === 'string') {
                        paths.add(value[key]);
                    } else {
                        scan(value[key]);
                    }
                }
            }
        };

        for (const op of operations) {
            for (const param of op.params) {
                scan(param);
            }
        }

        return Array.from(paths);
    }

    public static remapAssetPaths(
        operations: AgentScriptOperation[],
        remap: Record<string, string>
    ): AgentScriptOperation[] {
        const remapValue = (value: any): any => {
            if (typeof value === 'string' && remap[value]) {
                return remap[value];
            }
            if (Array.isArray(value)) {
                return value.map(remapValue);
            }
            if (value && typeof value === 'object') {
                const out: Record<string, any> = {};
                for (const key of Object.keys(value)) {
                    out[key] = remapValue(value[key]);
                }
                return out;
            }
            return value;
        };

        return operations.map(op => ({
            method: op.method,
            params: op.params.map(remapValue)
        }));
    }

    public static assetExists(assetPath: string, projectRoot?: string): boolean {
        try {
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const fs = require('fs');
            // eslint-disable-next-line @typescript-eslint/no-require-imports
            const path = require('path');
            if (fs.existsSync(assetPath)) return true;
            if (projectRoot) {
                const resolved = path.join(projectRoot, assetPath);
                if (fs.existsSync(resolved)) return true;
            }
            return false;
        } catch {
            return false;
        }
    }
}
