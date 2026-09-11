import express from 'express';
import fs from 'fs';
import path from 'path';
import { PUBLIC_DIR } from '../serverState';
import { rotateBackup } from '../utils/serverHelpers';

export function registerProjectRoutes(app: express.Application) {
    /**
     * POST /api/dev/save-project - Speichert die project.json auf Disk
     * NUR FÜR ENTWICKLUNGSZWECKE (Dev-Mode)
     */
    app.post('/api/dev/save-project', (req, res) => {
        try {
            const projectData = req.body;
            if (!projectData || typeof projectData !== 'object') {
                return res.status(400).json({ error: 'Ungültige Projektdaten' });
            }

            // Speicherpfad ergibt sich aus dem Spielnamen
            const gameName = (projectData.meta?.name || 'project').replace(/[^a-zA-Z0-9_-]/g, '_');
            const relativePath = `projects/${gameName}.json`;
            const projectPath = path.join(PUBLIC_DIR, relativePath);

            // Sicherheits-Check: Verzeichnis sicherstellen
            const dir = path.dirname(projectPath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            const actionCount = projectData.actions?.length || 0;
            const taskCount = projectData.tasks?.length || 0;
            const stageCount = projectData.stages?.length || 0;

            console.log(`[TRACE] [API] Saving project to ${projectPath}`);
            console.log(`[TRACE] [API] Data summary: Actions=${actionCount}, Tasks=${taskCount}, Stages=${stageCount}`);

            // _sourcePath immer auf den einheitlichen Pfad setzen
            if (projectData.meta) {
                projectData.meta._sourcePath = relativePath;
            }

            // KEIN rotateBackup hier! save-project ist AutoSave und wird ständig aufgerufen.
            // Backup-Rotation nur beim expliziten Speichern via save-custom.

            fs.writeFileSync(projectPath, JSON.stringify(projectData, null, 2), 'utf-8');

            console.log(`[TRACE] [API] Project saved successfully.`);
            res.json({ success: true, message: 'Projekt erfolgreich gespeichert' });
        } catch (err) {
            console.error('[TRACE] [API] Fehler beim Speichern des Projekts:', err);
            res.status(500).json({ error: 'Serverfehler beim Speichervorgang', details: (err as any).message });
        }
    });

    /**
     * POST /api/dev/save-kb - Speichert die KnowledgeBase
     * NUR FÜR ENTWICKLUNGSZWECKE (Dev-Mode)
     */
    app.post('/api/dev/save-kb', (req, res) => {
        try {
            const kbData = req.body;
            if (!kbData || typeof kbData !== 'object') {
                return res.status(400).json({ error: 'Ungültige KB-Daten' });
            }

            const kbDir = path.join(PUBLIC_DIR, 'kb');
            const kbPath = path.join(kbDir, 'kb.json');

            if (!fs.existsSync(kbDir)) {
                fs.mkdirSync(kbDir, { recursive: true });
            }

            fs.writeFileSync(kbPath, JSON.stringify(kbData, null, 2), 'utf-8');
            res.json({ success: true, message: 'KnowledgeBase gespeichert' });
        } catch (err) {
            console.error('[TRACE] [API] Fehler beim Speichern der KnowledgeBase:', err);
            res.status(500).json({ error: 'Serverfehler beim Speichern der KnowledgeBase', details: (err as any).message });
        }
    });

    /**
     * GET /kb/kb.json - Liefert die KnowledgeBase-Datei aus (für RagStore.load)
     */
    app.get('/kb/kb.json', (req, res) => {
        const kbPath = path.join(PUBLIC_DIR, 'kb', 'kb.json');
        if (!fs.existsSync(kbPath)) {
            return res.json({ chunks: [], embeddings: {} });
        }
        res.setHeader('Content-Type', 'application/json');
        res.sendFile(kbPath);
    });

    /**
     * POST /api/dev/reset-project - Setzt die project.json auf den Template-Zustand zurück
     * NUR FÜR E2E-TESTS
     */
    app.post('/api/dev/reset-project', (req, res) => {
        try {
            const projectPath = path.join(PUBLIC_DIR, 'projects/master_test/PingPong.json');
            const templatePath = path.join(PUBLIC_DIR, 'projects/project_template.json');

            if (!fs.existsSync(templatePath)) {
                console.error(`[TRACE] [API] Reset failed: Template not found at ${templatePath}`);
                return res.status(404).json({ error: 'Projekt-Template nicht gefunden' });
            }

            fs.copyFileSync(templatePath, projectPath);
            console.log(`[TRACE] [API] Project reset to template state.`);
            res.json({ success: true, message: 'Projekt erfolgreich zurückgesetzt' });
        } catch (err) {
            console.error('[TRACE] [API] Fehler beim Reset des Projekts:', err);
            res.status(500).json({ error: 'Serverfehler beim Reset', details: (err as any).message });
        }
    });

    /**
     * POST /api/library/tasks - Add/update a task in library.json
     */
    app.post('/api/library/tasks', (req, res) => {
        try {
            const task = req.body;
            if (!task || !task.name) {
                return res.status(400).json({ error: 'Missing task data or task name' });
            }

            const libraryPath = path.join(PUBLIC_DIR, 'library.json');
            let library: { tasks: any[] } = { tasks: [] };

            if (fs.existsSync(libraryPath)) {
                library = JSON.parse(fs.readFileSync(libraryPath, 'utf-8'));
            }

            // Find existing task or add new
            const existingIdx = library.tasks.findIndex(t => t.name === task.name);
            if (existingIdx !== -1) {
                library.tasks[existingIdx] = task;
                console.log(`[API] Library: Updated task "${task.name}"`);
            } else {
                library.tasks.push(task);
                console.log(`[API] Library: Added new task "${task.name}"`);
            }

            fs.writeFileSync(libraryPath, JSON.stringify(library, null, 4));
            res.json({ success: true, taskName: task.name });
        } catch (err) {
            console.error('[API] Error updating library:', err);
            res.status(500).json({ error: 'Failed to update library' });
        }
    });

    /**
     * POST /api/library/templates - Add/update a template in library.json
     */
    app.post('/api/library/templates', (req, res) => {
        try {
            const template = req.body;
            if (!template || !template.name) {
                return res.status(400).json({ error: 'Missing template data or template name' });
            }

            const libraryPath = path.join(PUBLIC_DIR, 'library.json');
            let library: { tasks: any[], templates: any[] } = { tasks: [], templates: [] };

            if (fs.existsSync(libraryPath)) {
                const content = fs.readFileSync(libraryPath, 'utf-8');
                library = JSON.parse(content);
                if (!library.templates) library.templates = [];
            }

            // Find existing template or add new
            const existingIdx = library.templates.findIndex(t => t.name === template.name);
            if (existingIdx !== -1) {
                library.templates[existingIdx] = template;
                console.log(`[API] Library: Updated template "${template.name}"`);
            } else {
                library.templates.push(template);
                console.log(`[API] Library: Added new template "${template.name}"`);
            }

            fs.writeFileSync(libraryPath, JSON.stringify(library, null, 4));
            res.json({ success: true, templateName: template.name });
        } catch (err) {
            console.error('[API] Error updating library:', err);
            res.status(500).json({ error: 'Failed to update library' });
        }
    });

    /**
     * GET /api/dev/list-projects - Listet alle Ordner und JSON-Dateien unter projects/
     */
    app.get('/api/dev/list-projects', (_req, res) => {
        try {
            const projectsRoot = path.resolve(__dirname, '../../projects');
            if (!fs.existsSync(projectsRoot)) {
                return res.json({ folders: [] });
            }

            const entries = fs.readdirSync(projectsRoot, { withFileTypes: true });
            const folders = entries
                .filter(e => e.isDirectory())
                .map(dir => {
                    const dirPath = path.join(projectsRoot, dir.name);
                    const files = fs.readdirSync(dirPath)
                        .filter(f => f.endsWith('.json'));
                    return { name: dir.name, files };
                });

            res.json({ folders });
        } catch (e) {
            console.error('[Dev] Error listing projects:', e);
            res.status(500).json({ error: 'Fehler beim Auflisten der Projekte' });
        }
    });

    /**
     * POST /api/dev/check-exists - Prüft ob eine Datei im Projekt-Verzeichnis existiert
     */
    app.post('/api/dev/check-exists', (req, res) => {
        try {
            const { filePath } = req.body;
            if (!filePath || typeof filePath !== 'string') {
                return res.status(400).json({ error: 'Ungültiger Pfad' });
            }

            // Sicherheits-Check: Nur Dateien im game-builder-v1/projects zulassen
            const absolutePath = path.resolve(__dirname, '../../', filePath);
            const projectsRoot = path.resolve(__dirname, '../../projects');

            if (!absolutePath.startsWith(projectsRoot)) {
                return res.status(403).json({ error: 'Zugriff verweigert: Pfad außerhalb des Projekt-Ordners' });
            }

            const exists = fs.existsSync(absolutePath);
            res.json({ exists });
        } catch (e) {
            res.status(500).json({ error: 'Fehler beim Prüfen der Datei-Existenz' });
        }
    });

    /**
     * POST /api/dev/save-custom - Speichert Projektdaten an einen benutzerdefinierten Ort
     */
    app.post('/api/dev/save-custom', (req, res) => {
        try {
            const { filePath, projectData } = req.body;
            if (!filePath || !projectData) {
                return res.status(400).json({ error: 'Ungültige Parameter' });
            }

            // Sicherheits-Check: Dateien im projects/ ODER game-server/public/ Ordner zulassen
            const absolutePath = path.resolve(__dirname, '../../', filePath);
            const projectsRoot = path.resolve(__dirname, '../../projects');
            const publicRoot = path.resolve(PUBLIC_DIR);

            if (!absolutePath.startsWith(projectsRoot) && !absolutePath.startsWith(publicRoot)) {
                return res.status(403).json({ error: 'Zugriff verweigert: Pfad außerhalb des erlaubten Bereichs' });
            }

            // Verzeichnis sicherstellen
            const dir = path.dirname(absolutePath);
            if (!fs.existsSync(dir)) {
                fs.mkdirSync(dir, { recursive: true });
            }

            // _sourcePath in Metadaten schreiben (damit loadProject den Quellpfad kennt)
            if (projectData.meta) {
                projectData.meta._sourcePath = filePath;
            }

            // Backup-Rotation: Vorhandene Datei umbenennen
            rotateBackup(absolutePath);

            fs.writeFileSync(absolutePath, JSON.stringify(projectData, null, 2));
            console.log(`[Dev] Project saved to custom path: ${filePath}`);
            res.json({ success: true });
        } catch (e) {
            console.error('[Dev] Error in save-custom:', e);
            res.status(500).json({ error: 'Fehler beim benutzerdefinierten Speichern' });
        }
    });
}
