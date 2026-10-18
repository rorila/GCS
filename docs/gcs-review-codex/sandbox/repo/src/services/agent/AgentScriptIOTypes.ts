/**
 * AgentScriptIOTypes
 *
 * IO-spezifische Konstanten und Hilfstypen, die von AgentScriptIO und den
 * zugehörigen Services gemeinsam genutzt werden.
 */

/**
 * Single Source of Truth: Stage-Felder, die NICHT als generische Config
 * exportiert/übernommen werden. Positionsargumente von createStage sowie
 * Kind-Sammlungen (werden separat über eigene Operationen exportiert).
 */
export const STAGE_CONFIG_EXCLUDE = new Set<string>([
    'id', 'name', 'type',
    'objects', 'tasks', 'actions', 'variables', 'flowCharts',
]);
