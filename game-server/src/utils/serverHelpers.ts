import fs from 'fs';
import path from 'path';
import express from 'express';
import jwt from 'jsonwebtoken';

export function authenticateToken(secret: string) {
    return (req: express.Request, res: express.Response, next: express.NextFunction) => {
        const authHeader = req.headers['authorization'];
        const token = authHeader && authHeader.split(' ')[1]; // Bearer TOKEN

        if (!token) return res.sendStatus(401);

        jwt.verify(token, secret, (err: any, user: any) => {
            if (err) return res.sendStatus(403);
            (req as any).user = user;
            next();
        });
    };
}

/**
 * Backup-Rotation: Benennt eine vorhandene Datei in .bakN um (hochzählend).
 * Beispiel: project.json → project.json.bak1, .bak2, .bak3, ...
 */
export function rotateBackup(filePath: string): string | null {
    if (!fs.existsSync(filePath)) return null;

    let bakIndex = 1;
    while (fs.existsSync(`${filePath}.bak${bakIndex}`)) {
        bakIndex++;
    }
    const bakPath = `${filePath}.bak${bakIndex}`;
    fs.renameSync(filePath, bakPath);
    console.log(`[Backup] ${path.basename(filePath)} → ${path.basename(bakPath)}`);
    return bakPath;
}

/**
 * Helper: Recursively gets all paths in an object
 */
export function getDeepPaths(obj: any, prefix: string = ''): string[] {
    let paths: string[] = [];
    if (!obj || typeof obj !== 'object') return paths;

    Object.keys(obj).forEach(key => {
        const path = prefix ? `${prefix}.${key}` : key;
        paths.push(path);

        const val = obj[key];
        if (val && typeof val === 'object' && !Array.isArray(val)) {
            paths = paths.concat(getDeepPaths(val, path));
        }
    });
    return paths;
}
