import { ThresholdComparison } from '../../components/TThresholdVariable';

/**
 * Gemeinsam genutzte Typen für die AgentController-Dienste.
 */

export interface VariableOptions {
    id?: string;
    x?: number;
    y?: number;
    width?: number;
    height?: number;
    style?: any;
    description?: string;
    isPublic?: boolean;
    objectModel?: string;

    // Typ-spezifische Eigenschaften
    threshold?: number;
    comparison?: ThresholdComparison;
    triggerValue?: any;
    duration?: number;
    min?: number;
    max?: number;
    isRandom?: boolean;
    isInteger?: boolean;
    searchValue?: string;
    searchProperty?: string;

    // Event-Handler (Task-Namen)
    onValueChanged?: string;
    onValueEmpty?: string;
    onThresholdReached?: string;
    onThresholdLeft?: string;
    onThresholdExceeded?: string;
    onTriggerEnter?: string;
    onTriggerExit?: string;
    onFinished?: string;
    onTick?: string;
    onHour?: string;
    onMinute?: string;
    onSecond?: string;
    onMinReached?: string;
    onMaxReached?: string;
    onInside?: string;
    onOutside?: string;
    onItemAdded?: string;
    onItemRemoved?: string;
    onContains?: string;
    onNotContains?: string;
    onCleared?: string;
    onGenerated?: string;
    onItemCreated?: string;
    onItemUpdated?: string;
    onItemDeleted?: string;
    onItemRead?: string;
    onNotFound?: string;
}

export interface AgentBatchOperation {
    method: string;
    params: any[];
}

export interface AgentBatchResult {
    method: string;
    success: boolean;
    data: any;
    error: string | null;
}
