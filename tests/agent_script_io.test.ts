import { describe, it, expect, beforeEach } from '@jest/globals';
import { AgentController } from '../src/services/AgentController';
import { AgentScriptValidator } from '../src/services/agent/AgentScriptValidator';
import { AgentScriptRepository } from '../src/services/agent/AgentScriptRepository';
import { AgentScript, AGENT_SCRIPT_VERSION } from '../src/services/agent/AgentScriptTypes';

const makeProject = () => ({
    id: 'test-project',
    name: 'Test Project',
    version: '1.0',
    stages: [{
        id: 'stage_main',
        name: 'Main Stage',
        type: 'standard',
        objects: [],
        tasks: [],
        actions: [],
        variables: [],
        flowCharts: {},
        events: {}
    }],
    variables: [],
    actions: [],
    flowCharts: {}
} as any);

describe('AgentScriptIO', () => {
    let agent: AgentController;

    beforeEach(() => {
        agent = AgentController.getInstance();
        agent.setProject(makeProject());
    });

    it('exportiert einen Task als AgentScript', () => {
        agent.createTask('stage_main', 'Tick', 'Score erhöhen');
        agent.addAction('Tick', 'calculate', 'Inc', { formula: 'score + 1', resultVariable: 'score' });

        const script = agent.exportScript({ scope: 'task', targetId: 'Tick' });

        expect(script.version).toBe(AGENT_SCRIPT_VERSION);
        expect(script.operations.some(o => o.method === 'createTask')).toBe(true);
        expect(script.operations.some(o => o.method === 'addAction' && o.params[1] === 'calculate')).toBe(true);
    });

    it('importiert ein einfaches Skript in leere Stage', () => {
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [
                { method: 'addVariable', params: ['score', 'integer', 0, 'global'] }
            ]
        };

        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });

        expect(result.success).toBe(true);
        expect(result.appliedOperations).toBe(1);
        expect(agent.listVariables().some(v => v.name === 'score')).toBe(true);
    });

    it('erkennt Namenskonflikt im Fehler-Modus', () => {
        agent.addVariable('score', 'integer', 0, 'global');
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [
                { method: 'addVariable', params: ['score', 'integer', 0, 'global'] }
            ]
        };

        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'error' });

        expect(result.success).toBe(false);
        expect(result.errors.some(e => e.includes("Variable 'score' existiert bereits"))).toBe(true);
    });

    it('benennt Konflikte im Rename-Modus um', () => {
        agent.addVariable('score', 'integer', 0, 'global');
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [
                { method: 'addVariable', params: ['score', 'integer', 0, 'global'] }
            ]
        };

        const result = agent.importScript(script, { targetStageId: 'stage_main', conflictStrategy: 'rename', autoRenameSuffix: '_import' });

        expect(result.success).toBe(true);
        expect(result.renamedItems['score']).toBe('score_import');
        expect(agent.listVariables().some(v => v.name === 'score_import')).toBe(true);
    });

    it('dryRun führt nichts aus', () => {
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'ScoreVariable',
            operations: [
                { method: 'addVariable', params: ['score', 'integer', 0, 'global'] }
            ]
        };

        const result = agent.importScript(script, { targetStageId: 'stage_main', dryRun: true });

        expect(result.success).toBe(true);
        expect(result.appliedOperations).toBe(0);
        expect(agent.listVariables().some(v => v.name === 'score')).toBe(false);
    });

    it('Validator lehnt unerlaubte Methode ab', () => {
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'BadScript',
            operations: [
                { method: 'executeBatch', params: [] }
            ]
        };

        const validation = AgentScriptValidator.validate(script, agent);
        expect(validation.valid).toBe(false);
        expect(validation.errors.some(e => e.includes("'executeBatch' ist nicht erlaubt"))).toBe(true);
    });

    it('Repository speichert und lädt Skript', () => {
        const repo = new AgentScriptRepository('./tmp-snippets');
        const script: AgentScript = {
            version: AGENT_SCRIPT_VERSION,
            name: 'PongBall',
            operations: []
        };

        const path = repo.save(script);
        const loaded = repo.load(path);
        expect(loaded.name).toBe('PongBall');
    });
});
