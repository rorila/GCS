import { serviceRegistry } from './ServiceRegistry';
/**
 * Service to handle image related operations (listing, uploading)
 */
export class ImageService {
    constructor() {
        this.baseUrl = 'http://localhost:8080/api';
        console.log('[ImageService] Initialized');
    }
    /**
     * Lists all available images from the server
     */
    async listImages() {
        try {
            const response = await fetch(`${this.baseUrl}/images`);
            if (!response.ok)
                throw new Error('Failed to fetch images');
            return await response.json();
        }
        catch (error) {
            console.error('[ImageService] listImages error:', error);
            return [];
        }
    }
    /**
     * Helper to flatten the image tree into a simple list of files
     */
    flattenImages(tree) {
        let results = [];
        tree.forEach(item => {
            if (item.type === 'file') {
                results.push(item);
            }
            else if (item.children) {
                results.push(...this.flattenImages(item.children));
            }
        });
        console.log(`[ImageService] Flattened ${tree.length} items to ${results.length} files`);
        return results;
    }
    /**
     * Reads a local file and returns it as a Base64 string
     */
    readFileAsBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
}
export const imageService = new ImageService();
serviceRegistry.register('imageService', imageService);
