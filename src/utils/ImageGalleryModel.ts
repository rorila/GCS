import { resolveSplitterImageSource } from './ImageSplitterModel';

export interface GalleryItem {
    file: string;
    path: string;
    url: string;
}

export interface MediaManifest {
    images?: Record<string, string[]>;
    audio?: Record<string, string[]>;
    videos?: Record<string, string[]>;
}

let manifestRequest: Promise<MediaManifest> | null = null;

export function invalidateImageGalleryManifest(): void {
    manifestRequest = null;
}

export function loadImageGalleryManifest(): Promise<MediaManifest> {
    if (!manifestRequest) {
        manifestRequest = fetch(`./media-manifest.json?t=${Date.now()}`, { cache: 'no-store' })
            .then(resp => {
                if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
                return resp.json() as Promise<MediaManifest>;
            })
            .catch(error => {
                manifestRequest = null;
                throw error;
            });
    }
    return manifestRequest;
}

export function listGalleryFolders(manifest: MediaManifest | null | undefined): string[] {
    return Object.keys(manifest?.images || {});
}

export function hasGalleryFolder(manifest: MediaManifest | null | undefined, folder: string): boolean {
    return Array.isArray(manifest?.images?.[folder]);
}

export function getGalleryItems(manifest: MediaManifest | null | undefined, folder: string): GalleryItem[] {
    const files = manifest?.images?.[folder];
    if (!Array.isArray(files)) return [];
    const prefix = folder ? `./images/${folder}/` : './images/';
    return files.map(file => {
        const path = prefix + file;
        return { file, path, url: resolveSplitterImageSource(path) };
    });
}
