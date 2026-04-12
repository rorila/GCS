import { TComponent, TPropertyDef } from './TComponent';
import { Logger } from '../utils/Logger';

const logger = Logger.get('TAuthService');

/**
 * TAuthService - Kapselt die Authentifizierungs-Logik (JWT Simulation).
 * Diese Komponente hat keine visuelle Repräsentation auf der Stage.
 */
export class TAuthService extends TComponent {
    public secret: string = 'gcs-super-secret';
    public tokenExpiration: number = 3600; // in Sekunden

    constructor(name: string = 'AuthService') {
        super(name);
        this.isVariable = true; // Verhält sich wie ein Dienst
    }

    /**
     * Verfügbare Events für den Service
     */
    public getEvents(): string[] {
        return ['onLoginSuccess', 'onLoginFailure', 'onTokenVerified', 'onTokenInvalid'];
    }

    /**
     * Inspector-Eigenschaften
     */
    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...this.getBaseProperties(),
            { name: 'secret', label: 'JWT Secret', type: 'string', group: 'AUTH-CONFIG' },
            { name: 'tokenExpiration', label: 'Token Ablauf (Sek.)', type: 'number', group: 'AUTH-CONFIG', defaultValue: 3600 }
        ];
    }

    /**
     * Erstellt einen simulierten JWT Token
     */
    public createToken(payload: any): string {
        const header = btoa(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
        const data = btoa(JSON.stringify({
            ...payload,
            exp: Math.floor(Date.now() / 1000) + this.tokenExpiration
        }));
        // Einfache Mock-Signatur
        const signature = btoa(this.secret).substring(0, 10);
        return `${header}.${data}.${signature}`;
    }

    /**
     * Validiert einen simulierten JWT Token
     */
    public verifyToken(token: string): any | null {
        try {
            const parts = token.split('.');
            if (parts.length !== 3) return null;

            const payload = JSON.parse(atob(parts[1]));
            if (payload.exp < Date.now() / 1000) {
                logger.warn('[TAuthService] Token abgelaufen');
                return null;
            }

            return payload;
        } catch (e) {
            logger.error('[TAuthService] Token Validierung fehlgeschlagen', e);
            return null;
        }
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            secret: this.secret,
            tokenExpiration: this.tokenExpiration
        };
    }
}
