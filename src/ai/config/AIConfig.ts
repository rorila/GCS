import { AgentScript } from '../../services/agent/AgentScriptTypes';
import { ProjectDiff } from '../diff/DiffTypes';
import { DryRunResult } from '../dryrun/DryRunResult';

/**
 * AIConfig
 *
 * Zentrale Konfiguration für den lokalen KI-Betrieb.
 * Unterstützt Ollama und LM Studio über OpenAI-kompatible bzw.
 * Ollama-native Endpunkte.
 */

export type LLMProviderType = 'ollama' | 'lmstudio';

export interface AIConfig {
    provider: LLMProviderType;
    endpoint: string;
    chatModel: string;
    embeddingModel?: string;
    temperature: number;
    contextWindow: number;
    topK: number;
    requestTimeoutMs: number;
}

export const defaultAIConfig: AIConfig = {
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    chatModel: 'qwen2.5-coder:7b',
    embeddingModel: 'nomic-embed-text',
    temperature: 0.1,
    contextWindow: 8192,
    topK: 3,
    requestTimeoutMs: 120000,
};

export const ollamaDefaultConfig: AIConfig = {
    ...defaultAIConfig,
    provider: 'ollama',
    endpoint: 'http://localhost:11434',
    chatModel: 'qwen2.5-coder:7b',
    embeddingModel: 'nomic-embed-text',
};

export const lmStudioDefaultConfig: AIConfig = {
    ...defaultAIConfig,
    provider: 'lmstudio',
    endpoint: 'http://localhost:1234/v1',
    chatModel: 'qwen-coder-local',
    embeddingModel: 'nomic-embed-text',
};

export function sanitizeAIConfig(config: Partial<AIConfig>): AIConfig {
    return {
        provider: config.provider ?? defaultAIConfig.provider,
        endpoint: config.endpoint ?? defaultAIConfig.endpoint,
        chatModel: config.chatModel ?? defaultAIConfig.chatModel,
        embeddingModel: config.embeddingModel ?? defaultAIConfig.embeddingModel,
        temperature: config.temperature ?? defaultAIConfig.temperature,
        contextWindow: config.contextWindow ?? defaultAIConfig.contextWindow,
        topK: config.topK ?? defaultAIConfig.topK,
        requestTimeoutMs: config.requestTimeoutMs ?? defaultAIConfig.requestTimeoutMs,
    };
}

export type GenerationScope =
    | 'selectedUserStory'
    | 'plannedUserStories'
    | 'activeStage'
    | 'project';

export interface AIGenerationRequest {
    instruction: string;
    scope: GenerationScope;
    activeStageId?: string;
    selectedUserStoryIds?: string[];
    conflictStrategy: 'error' | 'rename' | 'overwrite' | 'skip';
}

export interface AIPlanStep {
    order: number;
    operationIntent?: string;
    description?: string;
}

export interface AIEntityGroup {
    stages?: string[];
    objects?: string[];
    tasks?: string[];
    actions?: string[];
}

export interface AIImplementationPlan {
    goal?: string;
    existingEntities?: AIEntityGroup;
    entitiesToCreate?: AIEntityGroup;
    steps?: AIPlanStep[];
    assumptions?: string[];
    risks?: string[];
    rawResponse?: string;
}

export interface AIValidationReport {
    valid: boolean;
    errors: string[];
    warnings: string[];
}

export interface AIGenerationResult {
    success: boolean;
    plan?: AIImplementationPlan;
    agentScript?: AgentScript;
    explanation?: string;
    validation: AIValidationReport;
    diff?: ProjectDiff;
    dryRunResult?: DryRunResult;
    rawResponse?: string;
    sentPrompt?: { system: string; user: string };
}
