/**
 * AssetAnalyzer - Ermittelt fuer alle im Projekt verwendeten Bilder das
 * Verhaeltnis zwischen Quell-Auflösung und tatsaechlicher Anzeigegroesse.
 *
 * Hintergrund: Der Speicherbedarf eines Bildes im RAM ist `Breite * Hoehe * 4 Byte`
 * und damit unabhaengig von der Dateigroesse. Ein Spritesheet, das deutlich groesser
 * ist als seine Darstellung, kostet Speicher und Skalierzeit bei jedem Repaint --
 * auf schwacher Hardware die haeufigste Ursache fuer Ruckeln.
 *
 * Diese Klasse enthaelt ausschliesslich Analyse-Logik (kein DOM-Markup), damit sie
 * spaeter auch von einem Spritesheet-Optimierungs-Tool genutzt werden kann.
 */
import { Logger } from '../../utils/Logger';
import { SpriteGeometry } from '../../runtime/SpriteGeometry';

const logger = Logger.get('AssetAnalyzer');

/** Empfohlener Bereich fuer Frame-Groesse / Anzeigegroesse. */
export const SCALE_TARGET_MIN = 0.9;
export const SCALE_TARGET_MAX = 2.2;
/** Ab diesem Faktor gilt ein Bild als deutlich zu gross. */
export const SCALE_CRITICAL = 4;
/** Maximale Texturgroesse, die aeltere integrierte GPUs zuverlaessig koennen. */
export const MAX_SAFE_TEXTURE_SIZE = 2048;

export type AssetRating = 'ok' | 'lowres' | 'oversized' | 'critical' | 'unused' | 'unknown';

export interface AssetConsumer {
    objectName: string;
    className: string;
    stageName: string;
    displayWidthPx: number;
    displayHeightPx: number;
    /** Wie das Objekt an das Bild kommt. */
    via: 'direct' | 'imageList' | 'animation' | 'stage-background';
    /** True, wenn das Bild wegen einer aktiven ImageList/Animation gar nicht dargestellt wird. */
    shadowed?: boolean;
    /** Anzahl Pool-Instanzen (TSpriteTemplate.poolSize), sonst 1. */
    instances: number;
}

export interface AssetAnalysis {
    /** Rohpfad, wie im Projekt hinterlegt. */
    rawUrl: string;
    /** Aufgeloester Pfad, mit dem das Bild geladen wurde. */
    resolvedUrl: string;
    loaded: boolean;
    error?: string;
    width: number;
    height: number;
    /** Dekodierter Speicherbedarf in Byte (Breite * Hoehe * 4). */
    decodedBytes: number;
    columns: number;
    rows: number;
    frameWidth: number;
    frameHeight: number;
    frameCount: number;
    consumers: AssetConsumer[];
    /** Groesste Anzeigegroesse ueber alle Verwender. */
    maxDisplayWidthPx: number;
    maxDisplayHeightPx: number;
    /** frameWidth / maxDisplayWidthPx (bzw. Hoehe, je nachdem was groesser ist). */
    scaleFactor: number;
    /** Empfohlene Quellgroesse des gesamten Sheets. */
    recommendedWidth: number;
    recommendedHeight: number;
    /** Einsparung in Byte, wenn auf die Empfehlung skaliert wird. */
    savingBytes: number;
    rating: AssetRating;
    hints: string[];
}

export interface AssetReport {
    assets: AssetAnalysis[];
    totalDecodedBytes: number;
    totalSavingBytes: number;
    /** Bilder im media-manifest.json, die im Projekt nicht referenziert werden. */
    unreferenced: string[];
}

interface UsageDraft {
    rawUrl: string;
    columns: number;
    rows: number;
    consumers: AssetConsumer[];
}

export class AssetAnalyzer {
    /**
     * Loest einen Projekt-Bildpfad in eine im Editor ladbare URL auf.
     * Entspricht der Logik in SpriteRenderer/player-standalone.
     */
    public static resolveUrl(raw: string): string {
        if (!raw) return '';
        if (raw.startsWith('data:') || raw.startsWith('http')) return raw;
        if (raw.startsWith('./')) return raw.substring(1);
        if (raw.startsWith('/')) return raw;
        if (raw.startsWith('images/') || raw.startsWith('assets/')) return '/' + raw;
        return `/images/${raw}`;
    }

    /**
     * Packt CSS-Schreibweisen wie `url("images/a.png")` aus.
     * `style.backgroundImage` wird im Projekt teils so hinterlegt.
     */
    public static unwrapCssUrl(s: unknown): string {
        if (typeof s !== 'string') return '';
        const match = /^\s*url\(\s*['"]?(.*?)['"]?\s*\)\s*$/i.exec(s);
        return match ? match[1] : s;
    }

    /** Grobe Heuristik: Ist der String ein Bild (und nicht Audio/Video)? */
    public static isImagePath(s: unknown): boolean {
        if (typeof s !== 'string' || !s) return false;
        if (s.includes('${')) return false;
        if (s === 'none') return false;
        if (s.startsWith('data:image')) return true;
        if (s.startsWith('data:')) return false;
        return /\.(png|jpe?g|webp|gif|bmp|svg)(\?.*)?$/i.test(s);
    }

    /**
     * Fuehrt die vollstaendige Analyse durch: Verwendungen sammeln, Bildmasse laden,
     * bewerten. Nicht referenzierte Dateien werden aus dem media-manifest ergaenzt.
     */
    public static async analyze(project: any): Promise<AssetReport> {
        const drafts = this.collectUsages(project);
        const assets: AssetAnalysis[] = [];

        for (const draft of drafts.values()) {
            assets.push(await this.measure(draft));
        }

        // Nach Einsparpotenzial sortieren, damit die Ausreisser oben stehen.
        assets.sort((a, b) => b.savingBytes - a.savingBytes || b.decodedBytes - a.decodedBytes);

        const totalDecodedBytes = assets.reduce((sum, a) => sum + a.decodedBytes, 0);
        const totalSavingBytes = assets.reduce((sum, a) => sum + a.savingBytes, 0);
        const unreferenced = await this.findUnreferenced(drafts);

        logger.info(`Analyse abgeschlossen: ${assets.length} Bilder, ${(totalDecodedBytes / 1048576).toFixed(1)} MB dekodiert`);

        return { assets, totalDecodedBytes, totalSavingBytes, unreferenced };
    }

    /**
     * Klappt eine Objektliste inklusive verschachtelter `children` flach.
     *
     * Ohne diesen Schritt wurden Sprites innerhalb eines TGroupPanel/TPanel
     * komplett uebersehen — und damit genau die Bilder, die am haeufigsten
     * optimiert werden muessen.
     */
    private static flattenObjects(objects: any[]): any[] {
        const out: any[] = [];
        const seen = new Set<any>();

        const walk = (list: any[], depth: number): void => {
            if (!Array.isArray(list) || depth > 50) return;
            for (const obj of list) {
                if (!obj || typeof obj !== 'object') continue;
                if (seen.has(obj)) continue; // Schutz vor Zyklen
                seen.add(obj);
                out.push(obj);
                if (Array.isArray(obj.children)) {
                    walk(obj.children, depth + 1);
                }
            }
        };

        walk(objects, 0);
        return out;
    }

    /**
     * Bestimmt, welche Bildquelle zur Laufzeit tatsaechlich dargestellt wird.
     * `TSprite.appearanceMode` leitet sich ohne expliziten Wert aus den
     * gesetzten Referenzen ab — dieselbe Reihenfolge wird hier gespiegelt.
     */
    private static resolveAppearanceMode(obj: any): string {
        const explicit = obj?.appearanceMode;
        if (explicit) return String(explicit);
        if (obj?.animationId) return 'animation';
        if (obj?.imageListId) return 'spritesheet';
        if (obj?.videoSource) return 'video';
        return 'simple';
    }

    /**
     * Sammelt alle Bildverwendungen inklusive der jeweiligen Anzeigegroesse.
     * Aufloesungsketten: Sprite -> TAnimation -> TImageList -> Bilddatei.
     */
    private static collectUsages(project: any): Map<string, UsageDraft> {
        const drafts = new Map<string, UsageDraft>();

        const add = (rawUrl: string, columns: number, rows: number, consumer: AssetConsumer | null) => {
            if (!this.isImagePath(rawUrl)) return;
            let draft = drafts.get(rawUrl);
            if (!draft) {
                draft = { rawUrl, columns, rows, consumers: [] };
                drafts.set(rawUrl, draft);
            }
            // Das feinere Raster gewinnt (eine ImageList kennt es, ein Sprite nicht).
            if (columns * rows > draft.columns * draft.rows) {
                draft.columns = columns;
                draft.rows = rows;
            }
            if (consumer) draft.consumers.push(consumer);
        };

        const stages: any[] = [];
        if (Array.isArray(project?.stages) && project.stages.length > 0) {
            stages.push(...project.stages);
        } else if (project?.stage) {
            stages.push(project.stage);
        }

        // Legacy-Ablagen: Projekte vor der Multi-Stage-Migration halten ihre
        // Objekte direkt am Projekt. Das Grid kommt dann aus project.stage.
        const legacyGrid = project?.stage?.grid;
        if (Array.isArray(project?.objects) && project.objects.length > 0) {
            stages.push({ name: 'Haupt-Level (Legacy)', grid: legacyGrid, objects: project.objects });
        }
        if (Array.isArray(project?.splashObjects) && project.splashObjects.length > 0) {
            stages.push({ name: 'Splash (Legacy)', grid: legacyGrid, objects: project.splashObjects });
        }

        for (const stage of stages) {
            const cellSize = stage?.grid?.cellSize || 20;
            const stageName = stage?.name || stage?.id || 'Stage';
            // Verschachtelte Container aufloesen, sonst fehlen alle Kind-Sprites.
            const objects: any[] = this.flattenObjects(stage?.objects || []);

            const byRef = new Map<string, any>();
            for (const o of objects) {
                if (o?.name) byRef.set(o.name, o);
                if (o?.id) byRef.set(o.id, o);
            }

            // Stage-Hintergrund
            if (this.isImagePath(stage?.backgroundImage)) {
                add(stage.backgroundImage, 1, 1, {
                    objectName: stageName,
                    className: 'Stage',
                    stageName,
                    displayWidthPx: (stage?.grid?.cols || 64) * cellSize,
                    displayHeightPx: (stage?.grid?.rows || 40) * cellSize,
                    via: 'stage-background',
                    instances: 1
                });
            }

            for (const obj of objects) {
                const className = obj?.className || 'Unbekannt';
                const objectName = obj?.name || obj?.id || '?';
                const displayWidthPx = (Number(obj?.width) || 0) * cellSize;
                const displayHeightPx = (Number(obj?.height) || 0) * cellSize;
                const instances = Number(obj?.poolSize) > 0 ? Number(obj.poolSize) : 1;

                // Indirekte Kette aufloesen: animationId -> TAnimation.imageListId -> TImageList
                let listRef: string | undefined = obj?.imageListId || undefined;
                let via: AssetConsumer['via'] = 'imageList';
                if (!listRef && obj?.animationId) {
                    const anim = byRef.get(obj.animationId);
                    if (anim?.imageListId) {
                        listRef = anim.imageListId;
                        via = 'animation';
                    }
                }

                // Welche Quelle zur Laufzeit gewinnt, entscheidet appearanceMode.
                // Vorher galt das direkte Bild pauschal als verdeckt, sobald
                // irgendeine ImageList verknuepft war — das verschwieg genau die
                // Faelle mit appearanceMode 'simple' und hinterlegtem Bild.
                const appearanceMode = this.resolveAppearanceMode(obj);
                const sheetActive = appearanceMode === 'spritesheet' || appearanceMode === 'animation';
                const directActive = appearanceMode === 'simple';

                const list = listRef ? byRef.get(listRef) : undefined;
                const listSrc = this.unwrapCssUrl(list?.src || list?.backgroundImage || list?.style?.backgroundImage);
                if (this.isImagePath(listSrc)) {
                    add(listSrc, Number(list.imageCountHorizontal) || 1, Number(list.imageCountVertical) || 1, {
                        objectName, className, stageName, displayWidthPx, displayHeightPx, via, instances,
                        shadowed: !sheetActive
                    });
                }

                // Direktes Bild des Objekts (auch aus style.backgroundImage,
                // der Renderer wertet diese Quelle ebenfalls aus).
                const directSrc = this.unwrapCssUrl(obj?.src || obj?.backgroundImage || obj?.style?.backgroundImage);
                if (this.isImagePath(directSrc)) {
                    const isOwnImageList = className === 'TImageList';
                    add(
                        directSrc,
                        isOwnImageList ? (Number(obj.imageCountHorizontal) || 1) : 1,
                        isOwnImageList ? (Number(obj.imageCountVertical) || 1) : 1,
                        isOwnImageList
                            // Eine TImageList ist im Run-Mode selbst unsichtbar; ihre
                            // Anzeigegroesse ergibt sich aus den nutzenden Sprites.
                            ? null
                            : {
                                objectName, className, stageName, displayWidthPx, displayHeightPx,
                                via: 'direct',
                                // Nur Sprites kennen appearanceMode; bei allen anderen
                                // Komponenten ist das direkte Bild immer die Quelle.
                                shadowed: className === 'TSprite' ? !directActive : false,
                                instances
                            }
                    );
                }
            }
        }

        return drafts;
    }

    /** Laedt ein Bild und ermittelt seine natuerlichen Masse. */
    private static loadDimensions(url: string): Promise<{ width: number; height: number; error?: string }> {
        return new Promise((resolve) => {
            let done = false;
            const finish = (r: { width: number; height: number; error?: string }) => {
                if (done) return;
                done = true;
                resolve(r);
            };
            const timer = window.setTimeout(() => finish({ width: 0, height: 0, error: 'Timeout' }), 10000);
            const img = new Image();
            img.onload = () => {
                window.clearTimeout(timer);
                finish({ width: img.naturalWidth, height: img.naturalHeight });
            };
            img.onerror = () => {
                window.clearTimeout(timer);
                finish({ width: 0, height: 0, error: 'Nicht gefunden' });
            };
            img.src = url;
        });
    }

    /** Misst ein Bild und bewertet das Verhaeltnis zur Anzeigegroesse. */
    private static async measure(draft: UsageDraft): Promise<AssetAnalysis> {
        const resolvedUrl = this.resolveUrl(draft.rawUrl);
        const dim = await this.loadDimensions(resolvedUrl);

        const columns = Math.max(1, draft.columns);
        const rows = Math.max(1, draft.rows);
        const frameWidth = dim.width / columns;
        const frameHeight = dim.height / rows;

        const visible = draft.consumers.filter(c => !c.shadowed);
        const maxDisplayWidthPx = Math.max(0, ...visible.map(c => c.displayWidthPx));
        const maxDisplayHeightPx = Math.max(0, ...visible.map(c => c.displayHeightPx));

        const decodedBytes = dim.width * dim.height * 4;
        const hints: string[] = [];
        let rating: AssetRating = 'unknown';
        let scaleFactor = 0;
        let recommendedWidth = dim.width;
        let recommendedHeight = dim.height;

        if (!dim.width || !dim.height) {
            rating = 'unknown';
            hints.push(dim.error || 'Masse nicht ermittelbar');
        } else if (draft.consumers.length === 0 || (maxDisplayWidthPx === 0 && maxDisplayHeightPx === 0)) {
            rating = 'unused';
            hints.push('Kein sichtbarer Verwender gefunden — wird das Bild noch gebraucht?');
        } else {
            // Der groessere der beiden Faktoren bestimmt die Bewertung.
            const fx = maxDisplayWidthPx > 0 ? frameWidth / maxDisplayWidthPx : 0;
            const fy = maxDisplayHeightPx > 0 ? frameHeight / maxDisplayHeightPx : 0;
            scaleFactor = Math.max(fx, fy);

            if (scaleFactor >= SCALE_CRITICAL) {
                rating = 'critical';
            } else if (scaleFactor > SCALE_TARGET_MAX) {
                rating = 'oversized';
            } else if (scaleFactor < SCALE_TARGET_MIN) {
                rating = 'lowres';
                hints.push('Quelle kleiner als die Darstellung — wird unscharf hochskaliert.');
            } else {
                rating = 'ok';
            }

            if (rating === 'oversized' || rating === 'critical') {
                // Zielgroesse: 2x Anzeigegroesse (scharf auf HiDPI, ohne Verschwendung).
                const target = SCALE_TARGET_MAX / scaleFactor;
                const targetW = Math.max(1, Math.round(dim.width * target));
                const targetH = Math.max(1, Math.round(dim.height * target));
                const whole = SpriteGeometry.wholeFrameSize(targetW, targetH, columns, rows);
                recommendedWidth = whole.width;
                recommendedHeight = whole.height;
                hints.push(`Frame ist ${scaleFactor.toFixed(1)}x groesser als die Darstellung.`);
            }
        }

        if (dim.width > MAX_SAFE_TEXTURE_SIZE || dim.height > MAX_SAFE_TEXTURE_SIZE) {
            hints.push(`Ueber ${MAX_SAFE_TEXTURE_SIZE}px — aeltere GPUs fallen auf Software-Rendering zurueck.`);
        }
        if (draft.consumers.some(c => c.shadowed)) {
            const names = draft.consumers.filter(c => c.shadowed).map(c => c.objectName).join(', ');
            hints.push(`Von der aktiven Darstellungsart (appearanceMode) nicht genutzt bei: ${names}.`);
        }
        const poolTotal = draft.consumers.reduce((s, c) => s + c.instances, 0);
        if (poolTotal > 20) {
            hints.push(`${poolTotal} Instanzen (Pool) verwenden dieses Bild.`);
        }

        const recommendedBytes = recommendedWidth * recommendedHeight * 4;
        const savingBytes = Math.max(0, decodedBytes - recommendedBytes);

        return {
            rawUrl: draft.rawUrl,
            resolvedUrl,
            loaded: !!dim.width,
            error: dim.error,
            width: dim.width,
            height: dim.height,
            decodedBytes,
            columns,
            rows,
            frameWidth,
            frameHeight,
            frameCount: columns * rows,
            consumers: draft.consumers,
            maxDisplayWidthPx,
            maxDisplayHeightPx,
            scaleFactor,
            recommendedWidth,
            recommendedHeight,
            savingBytes,
            rating,
            hints
        };
    }

    /** Vergleicht die Projektverwendungen mit dem media-manifest.json. */
    private static async findUnreferenced(drafts: Map<string, UsageDraft>): Promise<string[]> {
        try {
            const resp = await fetch(`./media-manifest.json?t=${Date.now()}`, { cache: 'no-store' });
            if (!resp.ok) return [];
            const manifest = await resp.json();
            const images = manifest?.images || {};

            const usedFileNames = new Set<string>();
            for (const raw of drafts.keys()) {
                const name = raw.split('/').pop();
                if (name) usedFileNames.add(decodeURIComponent(name).toLowerCase());
            }

            const unreferenced: string[] = [];
            for (const [folder, files] of Object.entries(images)) {
                if (!Array.isArray(files)) continue;
                for (const file of files as string[]) {
                    if (!usedFileNames.has(String(file).toLowerCase())) {
                        unreferenced.push(folder === '.' ? file : `${folder}/${file}`);
                    }
                }
            }
            return unreferenced.sort();
        } catch (e) {
            logger.warn('media-manifest.json nicht lesbar, ueberspringe Suche nach unbenutzten Bildern:', e);
            return [];
        }
    }

    /** Formatiert Byte-Werte lesbar. */
    public static formatBytes(bytes: number): string {
        if (!bytes) return '0';
        if (bytes < 1024) return `${bytes} B`;
        if (bytes < 1048576) return `${(bytes / 1024).toFixed(0)} KB`;
        return `${(bytes / 1048576).toFixed(2)} MB`;
    }
}
