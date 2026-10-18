import { GameProject } from '../../model/types';

/** Resolve only explicitly configured, populated project filters. */
export function stageOverviewFilters(project: GameProject) {
    const seen = new Set<string>();
    return (project.stageOverview?.filters || []).filter(filter => {
        if (!filter.id || seen.has(filter.id)) return false;
        seen.add(filter.id);
        return true;
    }).map(filter => {
        const optionIds = new Set<string>();
        return { ...filter, options: filter.options.filter(option => {
            if (!option.id || optionIds.has(option.id)) return false;
            optionIds.add(option.id);
            return project.stages?.some(stage => stage.overviewTags?.[filter.id]?.includes(option.id));
        }) };
    }).filter(filter => filter.options.length > 1);
}
