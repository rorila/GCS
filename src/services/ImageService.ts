import { serviceRegistry } from './ServiceRegistry';
import { Logger } from '../utils/Logger';

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
    private logger = Logger.get('ImageService', 'Project_Save_Load');
    private baseUrl: string = 'http://localhost:8080/api';

    constructor() {
        this.logger.info('Initialized');
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
            this.logger.error('listImages error:', error);
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
        this.logger.info(`Flattened ${tree.length} items to ${results.length} files`);
        return results;
    }

    /**
     * Reads a local file and returns it as a Base64 string
     */
    readFileAsBase64(file: File): Promise<string> {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result as string);
            reader.onerror = error => reject(error);
            reader.readAsDataURL(file);
        });
    }
}

export const imageService = new ImageService();
serviceRegistry.register('imageService', imageService);
