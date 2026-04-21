import { ProjectVariable, GameTask, GameAction, ComponentData } from '../../model/types';

export type ScopedVariable = ProjectVariable & { uiScope?: 'global' | 'stage' | 'local' | (string & {}), uiEmoji?: string, usageCount?: number };
export type ScopedTask = GameTask & { uiScope?: 'global' | 'stage' | 'library' | (string & {}), uiEmoji?: string, usageCount?: number };
export type ScopedAction = GameAction & { uiScope?: 'global' | 'stage' | 'library' | (string & {}), uiEmoji?: string, usageCount?: number };
export type ScopedObject = ComponentData & { uiScope?: 'global' | 'stage' | (string & {}), usageCount?: number, isInherited?: boolean };

export type VariableScopeContext = {
    taskName?: string;
    actionId?: string;
};
