import { TComponent, TPropertyDef } from './TComponent';

/**
 * TUserManager - Spezialisierte Komponente für das Benutzer-Management.
 * Bietet High-Level Operationen für User-CRUD.
 */
export class TUserManager extends TComponent {
    public userCollection: string = 'users';
    public hashPasswords: boolean = true;

    constructor(name: string = 'UserManager') {
        super(name);
        this.isVariable = true;
    }

    /**
     * Verfügbare Events
     */
    public getEvents(): string[] {
        return ['onUserCreated', 'onUserUpdated', 'onUserDeleted', 'onAuthFailed'];
    }

    /**
     * Inspector-Eigenschaften
     */
    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...this.getBaseProperties(),
            { name: 'userCollection', label: 'DB Collection', type: 'string', group: 'USER-CONFIG', defaultValue: 'users' },
            { name: 'hashPasswords', label: 'Passwörter hashen', type: 'boolean', group: 'USER-CONFIG', defaultValue: true }
        ];
    }

    public toDTO(): any {
        return {
            ...super.toDTO(),
            userCollection: this.userCollection,
            hashPasswords: this.hashPasswords
        };
    }
}

import { ComponentRegistry } from '../utils/ComponentRegistry';
ComponentRegistry.register('TUserManager', (objData: any) => new TUserManager(objData.name));
