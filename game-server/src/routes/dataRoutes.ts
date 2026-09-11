import express from 'express';
import fs from 'fs';
import path from 'path';
import { db, saveDB, DATA_DIR } from '../serverState';

export function registerDataRoutes(app: express.Application) {
    /**
     * GET /api/dev/data/:file - Get a raw data file (Development only)
     * Used to sync server-side data (like users.json) with Editor simulator.
     */
    app.get('/api/dev/data/:file', (req, res) => {
        const filename = req.params.file;
        const filePath = path.join(DATA_DIR, filename);

        if (fs.existsSync(filePath)) {
            try {
                const content = JSON.parse(fs.readFileSync(filePath, 'utf-8'));
                res.json(content);
            } catch (e) {
                res.status(500).json({ error: 'Failed to parse data file' });
            }
        } else {
            res.status(404).json({ error: 'Data file not found' });
        }
    });

    /**
     * Generic Data API
     */
    app.get('/api/data/:resource', (req, res) => {
        const { resource } = req.params;
        const query = req.query;

        let data = db[resource];

        if (!data && db.hierarchy && db.hierarchy[resource]) {
            data = db.hierarchy[resource];
        }

        if (data && Array.isArray(data)) {
            // Simple query filtering
            let filtered = data;
            if (Object.keys(query).length > 0) {
                filtered = data.filter((item: any) => {
                    return Object.entries(query).every(([key, val]) => {
                        const itemVal = item[key];
                        // Handle array comparisons (e.g. authCode)
                        if (Array.isArray(itemVal)) {
                            try {
                                const targetArr = Array.isArray(val) ? val : (typeof val === 'string' && val.startsWith('[') ? JSON.parse(val) : [val]);
                                return JSON.stringify(itemVal) === JSON.stringify(targetArr);
                            } catch (e) { return false; }
                        }
                        return String(itemVal) === String(val);
                    });
                });
            }
            res.json(filtered);
        } else {
            res.status(404).json({ error: `Resource '${resource}' not found or not an array` });
        }
    });

    /**
     * GET /api/data/:resource/:id - Get a specific item
     */
    app.get('/api/data/:resource/:id', (req, res) => {
        const { resource, id } = req.params;
        let data = db[resource];
        if (!data && db.hierarchy && db.hierarchy[resource]) {
            data = db.hierarchy[resource];
        }

        if (data && Array.isArray(data)) {
            const item = data.find((i: any) => String(i.id) === String(id));
            if (item) res.json(item);
            else res.status(404).json({ error: 'Item not found' });
        } else {
            res.status(404).json({ error: `Resource '${resource}' not found` });
        }
    });

    app.post('/api/data/:resource', (req, res) => {
        const { resource } = req.params;
        const newItem = req.body;

        let target = db[resource];
        let isHierarchy = false;

        if (!target && db.hierarchy && db.hierarchy[resource]) {
            target = db.hierarchy[resource];
            isHierarchy = true;
        }

        if (target && Array.isArray(target)) {
            // Simple auto-id if missing
            if (!newItem.id) {
                newItem.id = `${resource}_${Date.now()}`;
            }
            target.push(newItem);
            saveDB();
            res.json({ success: true, item: newItem });
        } else {
            res.status(404).json({ error: `Resource '${resource}' not found` });
        }
    });

    app.delete('/api/data/:resource/:id', (req, res) => {
        const { resource, id } = req.params;
        let target = db[resource];

        if (!target && db.hierarchy && db.hierarchy[resource]) {
            target = db.hierarchy[resource];
        }

        if (target && Array.isArray(target)) {
            const idx = target.findIndex((item: any) => String(item.id) === String(id));
            if (idx !== -1) {
                target.splice(idx, 1);
                saveDB();
                res.json({ success: true });
            } else {
                res.status(404).json({ error: 'Item not found' });
            }
        } else {
            res.status(404).json({ error: `Resource '${resource}' not found` });
        }
    });
}
