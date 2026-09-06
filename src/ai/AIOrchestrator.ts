import { GameProject } from '../model/types';
import { AIGenerationRequest, AIGenerationResult, AIConfig, AIImplementationPlan, AIValidationReport } from './config/AIConfig';
import { AgentScriptGenerator } from './generation/AgentScriptGenerator';
import { Planner } from './planner/Planner';
import { AgentScriptDryRunner } from './dryrun/AgentScriptDryRunner';
import { DiffGenerator } from './diff/DiffGenerator';
import { AgentScriptRepairer } from './repair/AgentScriptRepairer';
import { AIValidator, AIValidationIssue } from './validation/AIValidator';
import { AuditLogger } from './security/AuditLogger';

/**
 * AIOrchestrator
 *
 * Koordiniert alle KI-Dienste: Kontext, Planung, Generierung,
 * Validierung, Dry-Run und Diff-Vorschau.
 */

export class AIOrchestrator {
    constructor(private project: GameProject) {}

    public async generate(request: AIGenerationRequest, config: AIConfig, plan?: AIImplementationPlan): Promise<AIGenerationResult> {
        const audit = AuditLogger.getInstance();
        audit.log('generation.request', { instruction: request.instruction, scope: request.scope, model: config.chatModel });

        if (!plan) {
            const planner = new Planner(this.project);
            plan = await planner.plan(request, config);
            audit.log('generation.plan', { goal: plan.goal, steps: plan.steps?.length });
        }

        const generator = new AgentScriptGenerator(this.project);
        let result = await generator.generate(request, config, plan);

        if (result.agentScript && result.validation.errors.length > 0) {
            audit.log('generation.repair.request', { errors: result.validation.errors });
            const repairer = new AgentScriptRepairer(this.project);
            const repaired = await repairer.repair(
                result.agentScript,
                result.validation.errors,
                request,
                config,
                plan
            );
            result.agentScript = repaired;
            const aiValidation = new AIValidator(this.project).validate(repaired);
            result.validation = this.toValidationReport(aiValidation.issues);
            result.success = result.validation.valid;
            audit.log('generation.repair.result', { success: result.success, errors: result.validation.errors });
        }

        if (!result.success || !result.agentScript) {
            audit.log('generation.result', { success: result.success, hasAgentScript: !!result.agentScript, errors: result.validation.errors });
            return result;
        }

        try {
            const dryRunner = new AgentScriptDryRunner();
            const dryRunResult = dryRunner.run(result.agentScript, {
                conflictStrategy: request.conflictStrategy,
                targetStageId: request.activeStageId,
            });

            result.dryRunResult = dryRunResult;

            if (dryRunResult.resultProject) {
                result.diff = new DiffGenerator().generate(this.project, dryRunResult.resultProject);
            }

            if (!dryRunResult.success) {
                result.success = false;
                result.validation = {
                    valid: false,
                    errors: [
                        ...result.validation.errors,
                        ...dryRunResult.importResult.errors,
                        ...dryRunResult.validationIssues.filter(i => i.level === 'error').map(i => i.message),
                    ],
                    warnings: [
                        ...result.validation.warnings,
                        ...dryRunResult.validationIssues.filter(i => i.level === 'warning').map(i => i.message),
                    ],
                };
            }
        } catch (err: any) {
            result.success = false;
            result.validation = {
                valid: false,
                errors: [...result.validation.errors, `Dry-Run fehlgeschlagen: ${err.message || err}`],
                warnings: result.validation.warnings,
            };
        }

        audit.log('generation.result', {
            success: result.success,
            hasAgentScript: !!result.agentScript,
            hasDiff: !!result.diff,
            errors: result.validation.errors,
        });

        return result;
    }

    private toValidationReport(issues: AIValidationIssue[]): AIValidationReport {
        return {
            valid: !issues.some(i => i.level === 'error'),
            errors: issues.filter(i => i.level === 'error').map(i => i.message),
            warnings: issues.filter(i => i.level === 'warning').map(i => i.message),
        };
    }
}
