/**
 * FeatureChunker
 *
 * Erzeugt ein FeatureTemplate aus einer Menge von User Stories und dem
 * aktuellen Projektkontext. Das valide oneShotExample kommt aus einem
 * optional exportierten AgentScript.
 */

import { FeatureTemplate, FeaturePrerequisite, FeatureComponent, FeatureVariable, FeatureTask } from './FeatureTemplate';
import { AIProjectContext, AIUserStorySummary, AIVariableSummary } from '../context/ProjectContextBuilder';
import { AgentScript } from '../../services/agent/AgentScriptTypes';

const FEATURE_KEYWORDS = new Set([
    'shooter', 'backup', 'ersatz', 'ersatzspieler',
    'memory', 'karten', 'umdrehen', 'karte', 'card', 'flip',
    'timer', 'score', 'punkte', 'collision', 'kollision',
    'keyboard', 'tastatur', 'maus', 'click', 'klick',
    'variable', 'task', 'action', 'stage', 'object',
    'spieler', 'player', 'gegner', 'enemy', 'bullet', 'geschoss',
]);

export class FeatureChunker {
    static fromUserStories(
        featureId: string,
        name: string,
        stories: AIUserStorySummary[],
        projectContext: AIProjectContext,
        example?: AgentScript
    ): FeatureTemplate {
        const fullText = this.buildFullText(stories);
        const narrative = this.buildNarrative(stories);

        return {
            featureId,
            name,
            description: this.buildDescription(stories),
            tags: this.extractTags(fullText),
            entities: this.extractEntities(fullText, stories, projectContext),
            prerequisites: this.inferPrerequisites(fullText, projectContext),
            components: this.inferComponents(fullText, projectContext),
            variables: this.inferVariables(fullText, projectContext),
            tasks: this.inferTasks(fullText, projectContext),
            narrative,
            oneShotExample: example?.operations
                ? JSON.stringify(example.operations, null, 2)
                : '[]',
        };
    }

    private static buildFullText(stories: AIUserStorySummary[]): string {
        return stories
            .map(s => {
                const parts = [s.title, s.description, s.agentHints, s.plannedComponentName, s.plannedTask, s.plannedEvent]
                    .filter(Boolean)
                    .join(' ');
                return parts;
            })
            .join('\n');
    }

    private static buildDescription(stories: AIUserStorySummary[]): string {
        return stories
            .filter(s => s.description)
            .map(s => s.description!)
            .join(' ')
            .trim();
    }

    private static buildNarrative(stories: AIUserStorySummary[]): string {
        return stories
            .map(s => `- ${s.title}: ${s.description || ''}`)
            .join('\n');
    }

    private static extractTags(text: string): string[] {
        const lower = text.toLowerCase();
        return Array.from(FEATURE_KEYWORDS).filter(k => lower.includes(k));
    }

    private static extractEntities(text: string, stories: AIUserStorySummary[], ctx: AIProjectContext): string[] {
        const names = new Set<string>();
        const lower = text.toLowerCase();

        // Aus dem Projektkontext bekannte Objekte/Tasks/Variablen
        for (const obj of ctx.activeStage?.objects ?? []) {
            if (lower.includes(obj.name.toLowerCase())) names.add(obj.name);
        }
        for (const task of [...(ctx.globalInventory.tasks ?? []), ...(ctx.activeStage?.tasks ?? [])]) {
            if (lower.includes(task.name.toLowerCase())) names.add(task.name);
        }
        for (const variable of [...(ctx.globalInventory.variables ?? []), ...(ctx.activeStage?.variables ?? [])]) {
            if (lower.includes(variable.name.toLowerCase())) names.add(variable.name);
        }

        // Geplante Komponenten/Tasks aus den Stories selbst
        for (const s of stories) {
            if (s.plannedComponentName) names.add(s.plannedComponentName);
            if (s.plannedTask) names.add(s.plannedTask);
            if (s.plannedEvent) names.add(s.plannedEvent);
        }

        return Array.from(names);
    }

    private static inferPrerequisites(text: string, ctx: AIProjectContext): FeaturePrerequisite[] {
        const lower = text.toLowerCase();
        const results: FeaturePrerequisite[] = [];
        const seen = new Set<string>();

        for (const obj of ctx.activeStage?.objects ?? []) {
            const name = obj.name;
            if (seen.has(name) || !lower.includes(name.toLowerCase())) continue;
            seen.add(name);
            results.push({
                className: obj.className,
                name,
                role: this.guessRole(lower, name),
            });
        }

        return results;
    }

    private static inferComponents(text: string, ctx: AIProjectContext): FeatureComponent[] {
        const prerequisites = this.inferPrerequisites(text, ctx);
        return prerequisites
            .filter(p => p.className)
            .map(p => ({
                name: p.name!,
                className: p.className!,
                defaults: {},
            }));
    }

    private static inferVariables(text: string, ctx: AIProjectContext): FeatureVariable[] {
        const lower = text.toLowerCase();
        const results: FeatureVariable[] = [];
        const seen = new Set<string>();

        for (const variable of this.allVariables(ctx)) {
            const name = variable.name;
            if (seen.has(name) || !lower.includes(name.toLowerCase())) continue;
            seen.add(name);
            results.push({
                name,
                type: variable.type,
                initialValue: variable.initialValue,
                scope: variable.scope,
            });
        }

        return results;
    }

    private static inferTasks(text: string, ctx: AIProjectContext): FeatureTask[] {
        const lower = text.toLowerCase();
        const results: FeatureTask[] = [];
        const seen = new Set<string>();

        for (const task of this.allTasks(ctx)) {
            const name = task.name;
            if (seen.has(name) || !lower.includes(name.toLowerCase())) continue;
            seen.add(name);
            results.push({
                name,
                description: task.description,
                actionSequence: [],
            });
        }

        return results;
    }

    private static allVariables(ctx: AIProjectContext): AIVariableSummary[] {
        const globals = (ctx.globalInventory.variables ?? []).map(v => ({
            name: v.name,
            type: v.type,
            scope: v.scope,
            initialValue: undefined,
        } as AIVariableSummary));
        const stage = ctx.activeStage?.variables ?? [];
        return [...globals, ...stage];
    }

    private static allTasks(ctx: AIProjectContext): { name: string; description?: string }[] {
        const globals = (ctx.globalInventory.tasks ?? []).map(t => ({ name: t.name }));
        const stage = (ctx.activeStage?.tasks ?? []).map(t => ({ name: t.name, description: t.description }));
        return [...globals, ...stage];
    }

    private static guessRole(text: string, name: string): string | undefined {
        const l = text.toLowerCase();
        const n = name.toLowerCase();
        if (l.includes(`spieler ${n}`) || l.includes(`player ${n}`)) return 'player';
        if (l.includes(`ersatz ${n}`) || l.includes(`backup ${n}`)) return 'backup';
        if (l.includes(`gegner ${n}`) || l.includes(`enemy ${n}`)) return 'enemy';
        if (l.includes(`karte ${n}`) || l.includes(`card ${n}`)) return 'card';
        if (l.includes(`geschoss ${n}`) || l.includes(`bullet ${n}`)) return 'bullet';
        return undefined;
    }
}
