import { AgentController } from './AgentController';
import { Logger } from '../utils/Logger';

/**
 * SchemaLoader — Lädt und merged alle Schema-Module aus docs/schemas/*.json
 * 
 * Modulare Struktur:
 *   docs/ComponentSchema.json       → Basis (baseProperties, actionTypes, semantik) + bestehende Kern-Komponenten
 *   docs/schemas/schema_containers.json → TPanel, TGroupPanel
 *   docs/schemas/schema_dialogs.json    → TDialogRoot, TSidePanel
 *   docs/schemas/schema_inputs.json     → TNumberInput, TCheckbox, TDropdown, TColorPicker, TMemo
 *   docs/schemas/schema_display.json    → TShape, TProgressBar, TRichText, TImage, TNumberLabel
 *   docs/schemas/schema_timers.json     → TIntervalTimer
 *   docs/schemas/schema_media.json      → TAudio, TVideo, TImageList
 *   docs/schemas/schema_variables.json  → TRealVariable, TObjectVariable, TListVariable, etc.
 */

const logger = Logger.get('SchemaLoader', 'Editor_Diagnostics');

// Liste aller Modul-Dateien (relativ zum public/docs/ Pfad)
const SCHEMA_MODULES = [
    'schemas/schema_containers.json',
    'schemas/schema_dialogs.json',
    'schemas/schema_inputs.json',
    'schemas/schema_display.json',
    'schemas/schema_timers.json',
    'schemas/schema_media.json',
    'schemas/schema_variables.json'
];

/**
 * Lädt die Basis-Schema-Datei und alle Modul-Dateien,
 * merged die components-Objekte und setzt das Ergebnis auf dem AgentController.
 */
export async function loadComponentSchemas(basePath: string = './docs/'): Promise<void> {
    try {
        // 1. Basis-Schema laden (enthält baseProperties, actionTypes, semantik + Kern-Komponenten)
        const baseResponse = await fetch(`${basePath}ComponentSchema.json`);
        if (!baseResponse.ok) {
            logger.warn(`Basis-Schema nicht gefunden: ${basePath}ComponentSchema.json`);
            return;
        }
        const baseSchema = await baseResponse.json();

        // 2. Alle Module laden und mergen
        let totalModuleComponents = 0;
        for (const modulePath of SCHEMA_MODULES) {
            try {
                const moduleResponse = await fetch(`${basePath}${modulePath}`);
                if (!moduleResponse.ok) {
                    logger.warn(`Schema-Modul nicht gefunden: ${modulePath}`);
                    continue;
                }
                const moduleData = await moduleResponse.json();

                if (moduleData.components) {
                    const componentCount = Object.keys(moduleData.components).length;
                    Object.assign(baseSchema.components, moduleData.components);
                    totalModuleComponents += componentCount;
                    logger.info(`Schema-Modul '${moduleData.$module || modulePath}' geladen: ${componentCount} Komponenten`);
                }
            } catch (moduleError) {
                logger.warn(`Fehler bei Schema-Modul '${modulePath}':`, moduleError);
            }
        }

        // 3. Auf AgentController setzen
        AgentController.setComponentSchema(baseSchema);
        const totalComponents = Object.keys(baseSchema.components || {}).length;
        logger.info(`ComponentSchema geladen: ${totalComponents} Komponenten (${totalModuleComponents} aus Modulen)`);

    } catch (error) {
        logger.error('Fehler beim Laden des ComponentSchemas:', error);
    }
}

/**
 * Synchrone Variante für Node.js-Umgebung (Tests).
 * Liest die Dateien vom Dateisystem.
 */
export function loadComponentSchemasSync(basePath: string = './docs/'): any {
    // Im Node.js-Kontext: fs.readFileSync nutzen
    // Wird in Tests verwendet
    try {
        const fs = require('fs');
        const path = require('path');

        const baseSchemaPath = path.resolve(basePath, 'ComponentSchema.json');
        if (!fs.existsSync(baseSchemaPath)) {
            logger.warn(`Basis-Schema nicht gefunden: ${baseSchemaPath}`);
            return null;
        }

        const baseSchema = JSON.parse(fs.readFileSync(baseSchemaPath, 'utf-8'));

        for (const modulePath of SCHEMA_MODULES) {
            try {
                const fullPath = path.resolve(basePath, modulePath);
                if (!fs.existsSync(fullPath)) continue;

                const moduleData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
                if (moduleData.components) {
                    Object.assign(baseSchema.components, moduleData.components);
                }
            } catch (_) { /* skip */ }
        }

        AgentController.setComponentSchema(baseSchema);
        return baseSchema;
    } catch (_) {
        return null;
    }
}
