import { TComponent } from './TComponent';
/**
 * TSystemInfo - System and Hardware Information Component
 *
 * Provides read-only access to browser and hardware information.
 * Useful for debugging, adaptive UI, or performance optimization.
 */
export class TSystemInfo extends TComponent {
    constructor(name = 'SystemInfo') {
        super(name);
        // Initialize with current values
        this.browserName = this.detectBrowserName();
        this.browserVersion = this.detectBrowserVersion();
        this.userAgent = navigator.userAgent;
        this.language = navigator.language;
        this.platform = navigator.platform;
        this.online = navigator.onLine;
        this.screenWidth = screen.width;
        this.screenHeight = screen.height;
        this.screenColorDepth = screen.colorDepth;
        this.devicePixelRatio = window.devicePixelRatio || 1;
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.windowOuterWidth = window.outerWidth;
        this.windowOuterHeight = window.outerHeight;
        this.hardwareConcurrency = navigator.hardwareConcurrency || 0;
        this.deviceMemory = navigator.deviceMemory || 0;
        this.maxTouchPoints = navigator.maxTouchPoints || 0;
    }
    /**
     * Refresh all dynamic values (e.g., window size, online status)
     */
    refresh() {
        this.online = navigator.onLine;
        this.windowWidth = window.innerWidth;
        this.windowHeight = window.innerHeight;
        this.windowOuterWidth = window.outerWidth;
        this.windowOuterHeight = window.outerHeight;
        this.devicePixelRatio = window.devicePixelRatio || 1;
    }
    detectBrowserName() {
        const ua = navigator.userAgent;
        if (ua.includes('Firefox'))
            return 'Firefox';
        if (ua.includes('Edg/'))
            return 'Edge';
        if (ua.includes('Chrome'))
            return 'Chrome';
        if (ua.includes('Safari'))
            return 'Safari';
        if (ua.includes('Opera') || ua.includes('OPR'))
            return 'Opera';
        return 'Unknown';
    }
    detectBrowserVersion() {
        const ua = navigator.userAgent;
        const match = ua.match(/(Firefox|Edg|Chrome|Safari|OPR|Opera)[\/\s](\d+(\.\d+)?)/);
        return match ? match[2] : 'Unknown';
    }
    getInspectorProperties() {
        const props = this.getBaseProperties();
        return [
            ...props,
            // Browser
            { name: 'browserName', label: 'Browser', type: 'string', group: 'Browser', readonly: true },
            { name: 'browserVersion', label: 'Version', type: 'string', group: 'Browser', readonly: true },
            { name: 'userAgent', label: 'User Agent', type: 'string', group: 'Browser', readonly: true },
            { name: 'language', label: 'Language', type: 'string', group: 'Browser', readonly: true },
            { name: 'platform', label: 'Platform', type: 'string', group: 'Browser', readonly: true },
            { name: 'online', label: 'Online', type: 'boolean', group: 'Browser', readonly: true },
            // Screen
            { name: 'screenWidth', label: 'Screen Width', type: 'number', group: 'Screen', readonly: true },
            { name: 'screenHeight', label: 'Screen Height', type: 'number', group: 'Screen', readonly: true },
            { name: 'screenColorDepth', label: 'Color Depth', type: 'number', group: 'Screen', readonly: true },
            { name: 'devicePixelRatio', label: 'Pixel Ratio', type: 'number', group: 'Screen', readonly: true },
            // Window
            { name: 'windowWidth', label: 'Window Width', type: 'number', group: 'Window', readonly: true },
            { name: 'windowHeight', label: 'Window Height', type: 'number', group: 'Window', readonly: true },
            { name: 'windowOuterWidth', label: 'Outer Width', type: 'number', group: 'Window', readonly: true },
            { name: 'windowOuterHeight', label: 'Outer Height', type: 'number', group: 'Window', readonly: true },
            // Hardware
            { name: 'hardwareConcurrency', label: 'CPU Cores', type: 'number', group: 'Hardware', readonly: true },
            { name: 'deviceMemory', label: 'RAM (GB)', type: 'number', group: 'Hardware', readonly: true },
            { name: 'maxTouchPoints', label: 'Touch Points', type: 'number', group: 'Hardware', readonly: true }
        ];
    }
    toJSON() {
        return {
            ...super.toJSON(),
            browserName: this.browserName,
            browserVersion: this.browserVersion,
            userAgent: this.userAgent,
            language: this.language,
            platform: this.platform,
            online: this.online,
            screenWidth: this.screenWidth,
            screenHeight: this.screenHeight,
            screenColorDepth: this.screenColorDepth,
            devicePixelRatio: this.devicePixelRatio,
            windowWidth: this.windowWidth,
            windowHeight: this.windowHeight,
            windowOuterWidth: this.windowOuterWidth,
            windowOuterHeight: this.windowOuterHeight,
            hardwareConcurrency: this.hardwareConcurrency,
            deviceMemory: this.deviceMemory,
            maxTouchPoints: this.maxTouchPoints
        };
    }
}
