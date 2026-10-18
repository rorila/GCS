import type { UserStoriesViewManager } from './UserStoriesViewManager';

export function toggleUserStoryForFeature(self: UserStoriesViewManager, userStoryId: string, checked: boolean) {
        if (checked) {
            self.selectedForFeature.add(userStoryId);
        } else {
            self.selectedForFeature.delete(userStoryId);
        }
        self.updateFeatureSelectionCount();
    }

export function toggleAllPlannedForFeature(self: UserStoriesViewManager, checked: boolean) {
        const planned = self.host.project?.userStories?.userStories || [];
        for (const us of planned) {
            if (checked) self.selectedForFeature.add(us.id);
            else self.selectedForFeature.delete(us.id);
        }
        self.host.renderUserStoriesList();
    }

export function clearFeatureSelection(self: UserStoriesViewManager) {
        self.selectedForFeature.clear();
        self.host.renderUserStoriesList();
    }

export function updateFeatureSelectionCount(self: UserStoriesViewManager) {
        const count = document.getElementById('userstories-feature-count');
        if (count) {
            count.textContent = `(${self.selectedForFeature.size} ausgewählt)`;
        }
    }

export function toggleInteractionForFeature(self: UserStoriesViewManager, interactionId: string, checked: boolean) {
        if (checked) {
            self.selectedInteractions.add(interactionId);
        } else {
            self.selectedInteractions.delete(interactionId);
        }
        self.updateInteractionSelectionCount();
    }

export function clearInteractionSelection(self: UserStoriesViewManager) {
        self.selectedInteractions.clear();
        self.host.renderUserStoriesList();
    }

export function updateInteractionSelectionCount(self: UserStoriesViewManager) {
        const count = document.getElementById('userstories-usecase-feature-count');
        if (count) {
            count.textContent = `(${self.selectedInteractions.size} ausgewählt)`;
        }
    }

export function toggleFeatureCollapse(self: UserStoriesViewManager, stageId: string, featureId: string) {
        const key = `${stageId}::${featureId}`;
        if (self.collapsedFeatures.has(key)) {
            self.collapsedFeatures.delete(key);
        } else {
            self.collapsedFeatures.add(key);
        }
        self.host.renderUserStoriesList();
    }

export function toggleStageCollapse(self: UserStoriesViewManager, stageId: string) {
        if (self.collapsedStages.has(stageId)) {
            self.collapsedStages.delete(stageId);
        } else {
            self.collapsedStages.add(stageId);
        }
        self.host.renderUserStoriesList();
    }
