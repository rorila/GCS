import { DialogManager } from '../editor/DialogManager';

/**
 * DialogService - Service wrapper for DialogManager
 * Enables calling dialogs via ServiceRegistry: serviceRegistry.call('Dialog', 'showDialog', ['dialogName', true])
 */
export class DialogService {
    private dialogManager: DialogManager | null = null;

    /**
     * Sets the DialogManager instance
     */
    setDialogManager(dm: DialogManager): void {
        this.dialogManager = dm;
        console.log('[DialogService] DialogManager set');
    }

    /**
     * Shows a dialog by name
     * @param dialogName Name of the dialog (without path/extension)
     * @param modal Whether dialog is modal (true = fixed, false = draggable)
     * @returns Promise with dialog result { action: 'save'|'cancel', data: {...} }
     */
    async showDialog(dialogName: string, modal: boolean = true, data: any = {}): Promise<any> {
        if (!this.dialogManager) {
            console.error('[DialogService] DialogManager not set!');
            return { action: 'cancel', data: {} };
        }

        console.log(`[DialogService] showDialog('${dialogName}', ${modal})`, data);
        return this.dialogManager.showDialog(dialogName, modal, data);
    }

    /**
     * Shows a dialog with initial data
     * @param dialogName Name of the dialog
     * @param modal Whether dialog is modal
     * @param data Initial data to populate dialog fields
     */
    async showDialogWithData(dialogName: string, modal: boolean, data: any): Promise<any> {
        if (!this.dialogManager) {
            console.error('[DialogService] DialogManager not set!');
            return { action: 'cancel', data: {} };
        }

        console.log(`[DialogService] showDialogWithData('${dialogName}', ${modal}, data)`);
        return this.dialogManager.showDialog(dialogName, modal, data);
    }
}

// Singleton instance
export const dialogService = new DialogService();
