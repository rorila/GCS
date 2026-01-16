import { serviceRegistry } from './ServiceRegistry';

export interface ImageFile {
    name: string;
    type: 'file' | 'directory';
    path: string;
    size?: number;
    children?: ImageFile[];
}

/**
 * Service to handle image related operations (listing, uploading)
 */
export class ImageService {
    private baseUrl: string = 'http://localhost:3000/api';

    constructor() {
        console.log('[ImageService] Initialized');
    }

    /**
     * Lists all available images from the server
     */
    async listImages(): Promise<ImageFile[]> {
        try {
            const response = await fetch(`${this.baseUrl}/images`);
            if (!response.ok) throw new Error('Failed to fetch images');
            return await response.json();
        } catch (error) {
            console.error('[ImageService] listImages error:', error);
            return [];
        }
    }

    /**
     * Helper to flatten the image tree into a simple list of files
     */
    flattenImages(tree: ImageFile[]): ImageFile[] {
        let results: ImageFile[] = [];
        tree.forEach(item => {
            if (item.type === 'file') {
                results.push(item);
            } else if (item.children) {
                results.push(...this.flattenImages(item.children));
            }
        });
        console.log(`[ImageService] Flattened ${tree.length} items to ${results.length} files`);
        return results;
    }
}

export const imageService = new ImageService();
serviceRegistry.register('imageService', imageService);
