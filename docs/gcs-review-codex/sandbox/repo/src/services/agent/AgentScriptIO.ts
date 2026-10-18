import { Logger } from '../../utils/Logger';
import type { AgentController } from '../AgentController';
import { AgentScript, ImportOptions, ImportResult, ExportOptions } from './AgentScriptTypes';
import { AgentScriptExportService } from './AgentScriptExportService';
import { AgentScriptImportService } from './AgentScriptImportService';

export { STAGE_CONFIG_EXCLUDE } from './AgentScriptIOTypes';

/**
 * AgentScriptIO
 *
 * Öffentliche Fassade für den Import/Export von AgentController-Operationen als
 * wiederverwendbare JSON-Skripte. Alle Implementierungsdetails wurden in
 * spezialisierte Services ausgelagert.
 */
export class AgentScriptIO {
    private logger = Logger.get('AgentScriptIO', 'Editor_Diagnostics');
    private exportService: AgentScriptExportService;
    private importService: AgentScriptImportService;

    constructor(private controller: AgentController) {
        this.exportService = new AgentScriptExportService(this.controller, this.logger);
        this.importService = new AgentScriptImportService(this.controller, this.logger);
    }

    public exportScript(options: ExportOptions): AgentScript {
        return this.exportService.exportScript(options);
    }

    public importScript(script: AgentScript, options: ImportOptions = {}): ImportResult {
        return this.importService.importScript(script, options);
    }
}
