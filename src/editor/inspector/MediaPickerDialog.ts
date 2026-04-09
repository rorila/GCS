/**
 * MediaPickerDialog - Modaler Dialog zur Auswahl von Images, Audio und Videos.
 * 
 * Image-Modus: Thumbnail-Grid mit Ordner-Navigation
 * Audio-Modus: Dateiliste mit Play/Stop-Buttons
 * Video-Modus: Dateiliste mit Vorschau
 * 
 * Nutzt public/media-manifest.json (erzeugt durch scripts/generate-media-manifest.ts)
 * 
 * @since v3.29.1
 */
import { Logger } from '../../utils/Logger';

const logger = Logger.get('MediaPickerDialog');


type MediaMode = 'image' | 'audio' | 'video';

interface MediaPickerOptions {
    mode: MediaMode;
    currentValue?: string;
}

interface MediaManifest {
    images: Record<string, string[]>;
    audio: Record<string, string[]>;
    videos: Record<string, string[]>;
}

// Cache für das Manifest (wird nur einmal geladen)
let manifestCache: MediaManifest | null = null;

async function loadManifest(): Promise<MediaManifest> {
    if (manifestCache) return manifestCache;
    try {
        // Lade relativ, damit es im Electron file:// Protokoll (bzw. dist-Ordner) funktioniert
        const resp = await fetch('./media-manifest.json');
        if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
        manifestCache = await resp.json();
        return manifestCache!;
    } catch (e) {
        logger.warn('[MediaPickerDialog] Manifest nicht gefunden, verwende leeres Manifest:', e);
        return { images: {}, audio: {}, videos: {} };
    }
}

const MODE_CONFIG: Record<MediaMode, { title: string; icon: string; basePath: string; manifestKey: keyof MediaManifest }> = {
    image: { title: 'Bild auswählen', icon: '🖼️', basePath: './images', manifestKey: 'images' },
    audio: { title: 'Audio auswählen', icon: '🔊', basePath: './audio', manifestKey: 'audio' },
    video: { title: 'Video auswählen', icon: '🎬', basePath: './videos', manifestKey: 'videos' },
};

export class MediaPickerDialog {

    /**
     * Zeigt den Dialog an und gibt den ausgewählten Pfad zurück.
     * @returns relativer Pfad (z.B. "images/backgrounds/bg.png") oder null bei Abbruch
     */
    public static async show(options: MediaPickerOptions): Promise<string | null> {
        const manifest = await loadManifest();
        return new Promise((resolve) => {
            const dialog = new MediaPickerDialog(options, manifest, resolve);
            dialog.open();
        });
    }

    private overlay!: HTMLDivElement;
    private contentArea!: HTMLDivElement;
    private breadcrumb!: HTMLDivElement;
    private currentFolder: string = '';
    private audioElement: HTMLAudioElement | null = null;
    private playingFile: string | null = null;

    private constructor(
        private options: MediaPickerOptions,
        private manifest: MediaManifest,
        private resolve: (value: string | null) => void
    ) {}

    private open(): void {
        const config = MODE_CONFIG[this.options.mode];

        // Overlay
        this.overlay = document.createElement('div');
        Object.assign(this.overlay.style, {
            position: 'fixed', top: '0', left: '0', width: '100%', height: '100%',
            backgroundColor: 'rgba(0,0,0,0.85)', zIndex: '90000',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            backdropFilter: 'blur(4px)',
        });
        this.overlay.onclick = (e) => { if (e.target === this.overlay) this.close(null); };

        // Dialog-Container
        const dialog = document.createElement('div');
        Object.assign(dialog.style, {
            backgroundColor: '#1e1e2e', borderRadius: '12px', padding: '0',
            width: '720px', maxWidth: '90vw', maxHeight: '80vh',
            display: 'flex', flexDirection: 'column',
            boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #333',
            overflow: 'hidden',
        });

        // Header
        const header = document.createElement('div');
        Object.assign(header.style, {
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
            padding: '14px 20px', backgroundColor: '#2a2a3e', borderBottom: '1px solid #333',
        });
        const title = document.createElement('span');
        title.textContent = `${config.icon} ${config.title}`;
        Object.assign(title.style, { color: '#fff', fontSize: '16px', fontWeight: 'bold' });
        const closeBtn = document.createElement('button');
        closeBtn.textContent = '✕';
        Object.assign(closeBtn.style, {
            background: 'none', border: 'none', color: '#888', fontSize: '20px',
            cursor: 'pointer', padding: '4px 8px', borderRadius: '4px',
        });
        closeBtn.onmouseover = () => closeBtn.style.color = '#fff';
        closeBtn.onmouseout = () => closeBtn.style.color = '#888';
        closeBtn.onclick = () => this.close(null);
        header.appendChild(title);
        header.appendChild(closeBtn);
        dialog.appendChild(header);

        // Breadcrumb (nur für Image-Modus relevant, aber sinnvoll für alle)
        this.breadcrumb = document.createElement('div');
        Object.assign(this.breadcrumb.style, {
            padding: '8px 20px', backgroundColor: '#252535', borderBottom: '1px solid #2a2a3a',
            fontSize: '12px', color: '#89b4fa', display: 'flex', gap: '4px', alignItems: 'center',
            flexWrap: 'wrap',
        });
        dialog.appendChild(this.breadcrumb);

        // Content Area
        this.contentArea = document.createElement('div');
        Object.assign(this.contentArea.style, {
            flex: '1', overflowY: 'auto', padding: '16px 20px',
        });
        dialog.appendChild(this.contentArea);

        // Aktueller Wert anzeigen
        if (this.options.currentValue) {
            const currentBar = document.createElement('div');
            Object.assign(currentBar.style, {
                padding: '8px 20px', backgroundColor: '#1a2a1a', borderTop: '1px solid #2a3a2a',
                fontSize: '11px', color: '#a6e3a1',
            });
            currentBar.textContent = `Aktuell: ${this.options.currentValue}`;
            dialog.appendChild(currentBar);
        }

        this.overlay.appendChild(dialog);
        document.body.appendChild(this.overlay);

        // Keyboard
        const keyHandler = (e: KeyboardEvent) => {
            if (e.key === 'Escape') { this.close(null); document.removeEventListener('keydown', keyHandler); }
        };
        document.addEventListener('keydown', keyHandler);

        // Content rendern
        this.renderContent();
    }

    private close(value: string | null): void {
        if (this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
        }
        if (this.overlay.parentElement) {
            this.overlay.parentElement.removeChild(this.overlay);
        }
        this.resolve(value);
    }

    private renderContent(): void {
        const config = MODE_CONFIG[this.options.mode];
        const folders = this.manifest[config.manifestKey] || {};

        // Breadcrumb aktualisieren
        this.renderBreadcrumb(config);

        // Content leeren
        this.contentArea.innerHTML = '';

        // Unterordner anzeigen (wenn im Root)
        const subfolders = Object.keys(folders).filter(f => {
            if (!this.currentFolder) {
                // Im Root: Zeige nur direkte Unterordner (kein /)
                return f !== '' && !f.includes('/');
            } else {
                // In einem Ordner: Zeige direkte Kind-Ordner
                return f.startsWith(this.currentFolder + '/') &&
                       !f.substring(this.currentFolder.length + 1).includes('/');
            }
        });

        if (subfolders.length > 0) {
            const folderGrid = document.createElement('div');
            Object.assign(folderGrid.style, {
                display: 'flex', flexWrap: 'wrap', gap: '8px', marginBottom: '16px',
            });
            subfolders.forEach(folder => {
                const folderName = this.currentFolder
                    ? folder.substring(this.currentFolder.length + 1)
                    : folder;
                const btn = document.createElement('button');
                btn.textContent = `📁 ${folderName}`;
                Object.assign(btn.style, {
                    backgroundColor: '#2a2a3e', color: '#89b4fa', border: '1px solid #333',
                    borderRadius: '6px', padding: '8px 14px', cursor: 'pointer',
                    fontSize: '13px', transition: 'all 0.15s',
                });
                btn.onmouseover = () => { btn.style.backgroundColor = '#3a3a4e'; btn.style.borderColor = '#89b4fa'; };
                btn.onmouseout = () => { btn.style.backgroundColor = '#2a2a3e'; btn.style.borderColor = '#333'; };
                btn.onclick = () => { this.currentFolder = folder; this.renderContent(); };
                folderGrid.appendChild(btn);
            });
            this.contentArea.appendChild(folderGrid);
        }

        // Dateien des aktuellen Ordners
        const files = folders[this.currentFolder] || [];

        if (files.length === 0 && subfolders.length === 0) {
            const empty = document.createElement('div');
            empty.textContent = 'Keine Dateien in diesem Ordner.';
            Object.assign(empty.style, { color: '#666', fontStyle: 'italic', padding: '20px', textAlign: 'center' });
            this.contentArea.appendChild(empty);
            return;
        }

        switch (this.options.mode) {
            case 'image': this.renderImageGrid(files, config.basePath); break;
            case 'audio': this.renderAudioList(files, config.basePath); break;
            case 'video': this.renderVideoList(files, config.basePath); break;
        }
    }

    private renderBreadcrumb(config: typeof MODE_CONFIG[MediaMode]): void {
        this.breadcrumb.innerHTML = '';

        const rootBtn = document.createElement('span');
        rootBtn.textContent = config.icon + ' ' + config.basePath.replace('/', '');
        Object.assign(rootBtn.style, { cursor: 'pointer', color: '#89b4fa' });
        rootBtn.onclick = () => { this.currentFolder = ''; this.renderContent(); };
        this.breadcrumb.appendChild(rootBtn);

        if (this.currentFolder) {
            const parts = this.currentFolder.split('/');
            let accumulated = '';
            parts.forEach(part => {
                accumulated = accumulated ? `${accumulated}/${part}` : part;
                const sep = document.createElement('span');
                sep.textContent = ' / ';
                sep.style.color = '#555';
                this.breadcrumb.appendChild(sep);

                const link = document.createElement('span');
                link.textContent = part;
                const target = accumulated;
                Object.assign(link.style, { cursor: 'pointer', color: '#cba6f7' });
                link.onclick = () => { this.currentFolder = target; this.renderContent(); };
                this.breadcrumb.appendChild(link);
            });
        }
    }

    // ──────────────────────────────────────
    // IMAGE MODE: Thumbnail Grid
    // ──────────────────────────────────────

    private renderImageGrid(files: string[], basePath: string): void {
        const grid = document.createElement('div');
        Object.assign(grid.style, {
            display: 'grid', gridTemplateColumns: 'repeat(4, 1fr)',
            gap: '12px',
        });

        files.forEach(file => {
            const subPath = this.currentFolder ? `${this.currentFolder}/${file}` : file;
            const fullPath = `${basePath}/${subPath}`;

            const card = document.createElement('div');
            Object.assign(card.style, {
                backgroundColor: '#2a2a3e', borderRadius: '8px', overflow: 'hidden',
                cursor: 'pointer', border: '2px solid transparent',
                transition: 'all 0.2s', display: 'flex', flexDirection: 'column',
            });
            card.onmouseover = () => { card.style.borderColor = '#89b4fa'; card.style.transform = 'scale(1.03)'; };
            card.onmouseout = () => { card.style.borderColor = 'transparent'; card.style.transform = 'scale(1)'; };
            card.onclick = () => this.close(fullPath);

            // Highlight wenn aktuell ausgewählt
            if (this.options.currentValue === fullPath) {
                card.style.borderColor = '#a6e3a1';
            }

            // Thumbnail
            const img = document.createElement('img');
            img.src = fullPath;
            img.alt = file;
            img.loading = 'lazy';
            Object.assign(img.style, {
                width: '100%', height: '100px', objectFit: 'cover',
                backgroundColor: '#1a1a2e',
            });
            img.onerror = () => {
                img.style.display = 'none';
                const placeholder = document.createElement('div');
                placeholder.textContent = '🖼️';
                Object.assign(placeholder.style, {
                    width: '100%', height: '100px', display: 'flex',
                    alignItems: 'center', justifyContent: 'center',
                    fontSize: '32px', backgroundColor: '#1a1a2e',
                });
                card.insertBefore(placeholder, card.firstChild);
            };
            card.appendChild(img);

            // Dateiname
            const label = document.createElement('div');
            label.textContent = file;
            Object.assign(label.style, {
                padding: '6px 8px', fontSize: '11px', color: '#ccc',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                textAlign: 'center',
            });
            label.title = file;
            card.appendChild(label);

            grid.appendChild(card);
        });

        this.contentArea.appendChild(grid);
    }

    // ──────────────────────────────────────
    // AUDIO MODE: List with Play/Stop
    // ──────────────────────────────────────

    private renderAudioList(files: string[], basePath: string): void {
        const list = document.createElement('div');
        Object.assign(list.style, { display: 'flex', flexDirection: 'column', gap: '4px' });

        files.forEach(file => {
            const subPath = this.currentFolder ? `${this.currentFolder}/${file}` : file;
            const fullPath = `${basePath}/${subPath}`;

            const row = document.createElement('div');
            Object.assign(row.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '8px 12px', backgroundColor: '#2a2a3e', borderRadius: '6px',
                border: '1px solid #333', transition: 'all 0.15s',
            });
            if (this.options.currentValue === fullPath) {
                row.style.borderColor = '#a6e3a1';
            }

            // Play/Stop Button
            const playBtn = document.createElement('button');
            playBtn.textContent = '▶️';
            Object.assign(playBtn.style, {
                background: 'none', border: '1px solid #555', borderRadius: '50%',
                width: '32px', height: '32px', cursor: 'pointer', fontSize: '14px',
                display: 'flex', alignItems: 'center', justifyContent: 'center',
                flexShrink: '0', transition: 'all 0.15s',
            });
            playBtn.onclick = (e) => {
                e.stopPropagation();
                this.toggleAudio(fullPath, playBtn);
            };
            row.appendChild(playBtn);

            // Dateiname
            const nameEl = document.createElement('span');
            nameEl.textContent = file;
            Object.assign(nameEl.style, {
                flex: '1', color: '#ccc', fontSize: '13px',
                cursor: 'pointer', overflow: 'hidden', textOverflow: 'ellipsis',
            });
            nameEl.title = fullPath;
            row.appendChild(nameEl);

            // Auswählen-Button
            const selectBtn = document.createElement('button');
            selectBtn.textContent = 'Auswählen';
            Object.assign(selectBtn.style, {
                backgroundColor: '#1e3a5f', color: '#4fc3f7', border: '1px solid #2a5a8f',
                borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
                fontSize: '12px', flexShrink: '0', transition: 'all 0.15s',
            });
            selectBtn.onmouseover = () => selectBtn.style.backgroundColor = '#2a5a8f';
            selectBtn.onmouseout = () => selectBtn.style.backgroundColor = '#1e3a5f';
            selectBtn.onclick = () => this.close(fullPath);
            row.appendChild(selectBtn);

            list.appendChild(row);
        });

        this.contentArea.appendChild(list);
    }

    private toggleAudio(src: string, btn: HTMLButtonElement): void {
        if (this.playingFile === src && this.audioElement) {
            this.audioElement.pause();
            this.audioElement = null;
            this.playingFile = null;
            btn.textContent = '▶️';
            return;
        }

        // Stoppe vorheriges Audio
        if (this.audioElement) {
            this.audioElement.pause();
            // Reset alle Play-Buttons
            this.contentArea.querySelectorAll('button').forEach(b => {
                if (b.textContent === '⏹') b.textContent = '▶️';
            });
        }

        this.audioElement = new Audio(src);
        this.playingFile = src;
        btn.textContent = '⏹';

        this.audioElement.onended = () => {
            this.playingFile = null;
            btn.textContent = '▶️';
        };
        this.audioElement.play().catch(e => {
            logger.warn('[MediaPicker] Audio playback failed:', e);
            btn.textContent = '▶️';
            this.playingFile = null;
        });
    }

    // ──────────────────────────────────────
    // VIDEO MODE: List with Preview
    // ──────────────────────────────────────

    private renderVideoList(files: string[], basePath: string): void {
        const list = document.createElement('div');
        Object.assign(list.style, { display: 'flex', flexDirection: 'column', gap: '8px' });

        files.forEach(file => {
            const subPath = this.currentFolder ? `${this.currentFolder}/${file}` : file;
            const fullPath = `${basePath}/${subPath}`;

            const card = document.createElement('div');
            Object.assign(card.style, {
                backgroundColor: '#2a2a3e', borderRadius: '8px', overflow: 'hidden',
                border: '1px solid #333',
            });
            if (this.options.currentValue === fullPath) {
                card.style.borderColor = '#a6e3a1';
            }

            // Info-Zeile
            const infoRow = document.createElement('div');
            Object.assign(infoRow.style, {
                display: 'flex', alignItems: 'center', gap: '10px',
                padding: '10px 14px',
            });

            const icon = document.createElement('span');
            icon.textContent = '🎬';
            icon.style.fontSize = '20px';
            infoRow.appendChild(icon);

            const nameEl = document.createElement('span');
            nameEl.textContent = file;
            Object.assign(nameEl.style, { flex: '1', color: '#ccc', fontSize: '13px' });
            infoRow.appendChild(nameEl);

            // Vorschau-Button
            const previewBtn = document.createElement('button');
            previewBtn.textContent = '▶️ Vorschau';
            Object.assign(previewBtn.style, {
                backgroundColor: '#333', color: '#ccc', border: '1px solid #555',
                borderRadius: '4px', padding: '4px 10px', cursor: 'pointer',
                fontSize: '11px', flexShrink: '0',
            });
            previewBtn.onclick = () => {
                const existingVideo = card.querySelector('video');
                if (existingVideo) {
                    existingVideo.remove();
                    previewBtn.textContent = '▶️ Vorschau';
                } else {
                    const video = document.createElement('video');
                    video.src = fullPath;
                    video.controls = true;
                    video.autoplay = true;
                    Object.assign(video.style, {
                        width: '100%', maxHeight: '200px', backgroundColor: '#000',
                        borderTop: '1px solid #333',
                    });
                    card.appendChild(video);
                    previewBtn.textContent = '⏹ Schließen';
                }
            };
            infoRow.appendChild(previewBtn);

            // Auswählen-Button
            const selectBtn = document.createElement('button');
            selectBtn.textContent = 'Auswählen';
            Object.assign(selectBtn.style, {
                backgroundColor: '#1e3a5f', color: '#4fc3f7', border: '1px solid #2a5a8f',
                borderRadius: '4px', padding: '4px 12px', cursor: 'pointer',
                fontSize: '12px', flexShrink: '0',
            });
            selectBtn.onmouseover = () => selectBtn.style.backgroundColor = '#2a5a8f';
            selectBtn.onmouseout = () => selectBtn.style.backgroundColor = '#1e3a5f';
            selectBtn.onclick = () => this.close(fullPath);
            infoRow.appendChild(selectBtn);

            card.appendChild(infoRow);
            list.appendChild(card);
        });

        this.contentArea.appendChild(list);
    }
}
