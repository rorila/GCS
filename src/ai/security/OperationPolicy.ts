import { AgentScriptOperation } from '../../services/agent/AgentScriptTypes';
import { AI_ALLOWED_METHODS } from '../generation/AIAllowedMethods';
import { METHOD_POLICIES } from '../validation/MethodPolicies';
import type { AIValidationIssue } from '../validation/AIValidator';

/**
 * OperationPolicy
 *
 * Zentrale Sicherheitsrichtlinie für AgentScript-Operationen.
 * Prüft Methoden-Whitelist, Parameter-Anzahl und entfernt/verweigert
 * gefährliche Schlüssel wie __proto__, constructor, prototype.
 */

export interface OperationPolicyResult {
    allowed: boolean;
    issues: AIValidationIssue[];
    sanitizedParams: any[];
}

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

export class OperationPolicy {
    public isAllowed(method: string): boolean {
        return AI_ALLOWED_METHODS.has(method);
    }

    public getMethodPolicy(method: string) {
        return METHOD_POLICIES[method];
    }

    public sanitizeValue(value: any): any {
        if (value === null || value === undefined) {
            return value;
        }

        if (typeof value === 'string') {
            return value;
        }

        if (Array.isArray(value)) {
            return value.map(item => this.sanitizeValue(item));
        }

        if (typeof value === 'object') {
            const sanitized: Record<string, any> = {};
            for (const key of Object.keys(value)) {
                if (this.isForbiddenKey(key)) {
                    continue;
                }
                sanitized[key] = this.sanitizeValue(value[key]);
            }
            return sanitized;
        }

        return value;
    }

    public sanitizeParams(operation: AgentScriptOperation): any[] {
        return (operation.params || []).map(p => this.sanitizeValue(p));
    }

    public validate(operation: AgentScriptOperation, index: number): AIValidationIssue[] {
        const issues: AIValidationIssue[] = [];
        const method = operation.method;

        if (!this.isAllowed(method)) {
            issues.push({
                level: 'error',
                code: 'forbidden-method',
                message: `Operation ${index} verwendet nicht erlaubte Methode: ${method}`,
                operationIndex: index,
                method,
            });
            return issues;
        }

        const policy = this.getMethodPolicy(method);
        if (policy) {
            const params = operation.params || [];
            if (params.length < policy.minParams || params.length > policy.maxParams) {
                issues.push({
                    level: 'error',
                    code: 'param-count',
                    message: `Operation ${index} (${method}) erwartet ${policy.minParams}-${policy.maxParams} Parameter, hat aber ${params.length}.`,
                    operationIndex: index,
                    method,
                });
            }

            if (policy.mutating && this.hasForbiddenKey(params)) {
                issues.push({
                    level: 'error',
                    code: 'forbidden-key',
                    message: `Operation ${index} (${method}) enthält verbotene Schlüssel (__proto__, constructor, prototype).`,
                    operationIndex: index,
                    method,
                });
            }
        }

        if (this.hasForbiddenKey(operation.params)) {
            issues.push({
                level: 'error',
                code: 'forbidden-key',
                message: `Operation ${index} enthält verbotene Schlüssel (__proto__, constructor, prototype).`,
                operationIndex: index,
                method,
            });
        }

        return issues;
    }

    private isForbiddenKey(key: string): boolean {
        return FORBIDDEN_KEYS.has(key);
    }

    private hasForbiddenKey(value: any): boolean {
        if (value === null || value === undefined) {
            return false;
        }

        if (typeof value === 'string') {
            return FORBIDDEN_KEYS.has(value);
        }

        if (Array.isArray(value)) {
            return value.some(item => this.hasForbiddenKey(item));
        }

        if (typeof value === 'object') {
            for (const key of Object.keys(value)) {
                if (this.isForbiddenKey(key) || this.hasForbiddenKey(value[key])) {
                    return true;
                }
            }
        }

        return false;
    }
}
