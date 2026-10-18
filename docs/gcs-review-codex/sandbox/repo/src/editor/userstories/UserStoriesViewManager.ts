import type { IViewHost } from '../EditorViewManager';
import * as UserStoriesListRenderer from './UserStoriesListRenderer';
import * as UserStoryStateManager from './UserStoryStateManager';
import * as UserStoryMenuManager from './UserStoryMenuManager';
import * as UserStoryDialogManager from './UserStoryDialogManager';
import * as UserStoryFeatureManager from './UserStoryFeatureManager';
import * as UserStoryAIManager from './UserStoryAIManager';

export class UserStoriesViewManager {
    public host: IViewHost;
    public selectedForFeature: Set<string> = new Set();
    public selectedInteractions: Set<string> = new Set();
    public collapsedFeatures: Set<string> = new Set();
    public collapsedStages: Set<string> = new Set();
    public aiReachable: boolean | null = null;
    public aiChecking: boolean = false;
    public lastExtractedInteractions: any[] = [];
constructor(host: IViewHost) {
        this.host = host;
    }

public renderUserStoriesView(panel: HTMLElement) { UserStoriesListRenderer.renderUserStoriesView(this, panel); }
public renderUserStoriesList(lastExtractedRef: { value: any[] }) { UserStoriesListRenderer.renderUserStoriesList(this, lastExtractedRef); }
public bindFilterBarListeners() { UserStoriesListRenderer.bindFilterBarListeners(this); }
public showStageDescriptionEditor(stageId?: string) { UserStoryDialogManager.showStageDescriptionEditor(this, stageId); }
public showProjectDescriptionEditor() { UserStoryDialogManager.showProjectDescriptionEditor(this); }
public editUseCaseManual(interactionId: string, extracted: any[]) { UserStoryDialogManager.editUseCaseManual(this, interactionId, extracted); }
public deleteUseCaseManual(interactionId: string) { UserStoryDialogManager.deleteUseCaseManual(this, interactionId); }
public editUserStory(userStoryId: string) { UserStoryDialogManager.editUserStory(this, userStoryId); }
public deleteUserStory(userStoryId: string) { UserStoryDialogManager.deleteUserStory(this, userStoryId); }
public async saveUserStoryAsFeature(userStoryId: string) { await UserStoryAIManager.saveUserStoryAsFeature(this, userStoryId); }
public async exportUserStoryAsFeatureScript(userStoryId: string) { await UserStoryFeatureManager.exportUserStoryAsFeatureScript(this, userStoryId); }
public async saveUseCaseAsFeature(interactionId: string) { await UserStoryAIManager.saveUseCaseAsFeature(this, interactionId); }
public async exportUseCaseAsFeatureScript(interactionId: string) { await UserStoryFeatureManager.exportUseCaseAsFeatureScript(this, interactionId); }
public deleteUseCase(interactionId: string) { UserStoryMenuManager.deleteUseCase(this, interactionId); }
public toggleUserStoryForFeature(userStoryId: string, checked: boolean) { UserStoryStateManager.toggleUserStoryForFeature(this, userStoryId, checked); }
public toggleAllPlannedForFeature(checked: boolean) { UserStoryStateManager.toggleAllPlannedForFeature(this, checked); }
public clearFeatureSelection() { UserStoryStateManager.clearFeatureSelection(this); }
public updateFeatureSelectionCount() { UserStoryStateManager.updateFeatureSelectionCount(this); }
public async saveSelectedUserStoriesAsFeature() { await UserStoryAIManager.saveSelectedUserStoriesAsFeature(this); }
public toggleInteractionForFeature(interactionId: string, checked: boolean) { UserStoryStateManager.toggleInteractionForFeature(this, interactionId, checked); }
public clearInteractionSelection() { UserStoryStateManager.clearInteractionSelection(this); }
public updateInteractionSelectionCount() { UserStoryStateManager.updateInteractionSelectionCount(this); }
public async saveSelectedInteractionsAsFeature() { await UserStoryAIManager.saveSelectedInteractionsAsFeature(this); }
public async sendUserStoryToAI(userStoryId: string) { await UserStoryAIManager.sendUserStoryToAI(this, userStoryId); }
public async groupSelectedUserStoriesAsFeature() { await UserStoryFeatureManager.groupSelectedUserStoriesAsFeature(this); }
public async groupSelectedUserStoriesForStage(stageId: string) { await UserStoryFeatureManager.groupSelectedUserStoriesForStage(this, stageId); }
public showFeatureDialog(stageId: string, featureId?: string, initialUserStoryIds?: string[]) { UserStoryFeatureManager.showFeatureDialog(this, stageId, featureId, initialUserStoryIds); }
public async loadFeatureFromKnowledgeBase(stageId: string) { await UserStoryAIManager.loadFeatureFromKnowledgeBase(this, stageId); }
public toggleFeatureCollapse(stageId: string, featureId: string) { UserStoryStateManager.toggleFeatureCollapse(this, stageId, featureId); }
public toggleStageCollapse(stageId: string) { UserStoryStateManager.toggleStageCollapse(this, stageId); }
public closeOpenMenus() { UserStoryMenuManager.closeOpenMenus(); }
public createActionMenuItem(menu: HTMLDivElement, label: string, color: string, onClick: () => void) { UserStoryMenuManager.createActionMenuItem(menu, label, color, onClick); }
public showStageActionsMenu(event: MouseEvent, stageId: string) { UserStoryMenuManager.showStageActionsMenu(this, event, stageId); }
public showFeatureActionsMenu(event: MouseEvent, stageId: string, featureId: string) { UserStoryMenuManager.showFeatureActionsMenu(this, event, stageId, featureId); }
public showUseCaseActionsMenu(event: MouseEvent, interactionId: string, flowChartId: string) { UserStoryMenuManager.showUseCaseActionsMenu(this, event, interactionId, flowChartId); }
public showUserStoryActionsMenu(event: MouseEvent, userStoryId: string, flowChartId: string, interactionId: string, plannedTask: string, featureId: string) { UserStoryMenuManager.showUserStoryActionsMenu(this, event, userStoryId, flowChartId, interactionId, plannedTask, featureId); }
public async renameFeature(stageId: string, featureId: string) { await UserStoryFeatureManager.renameFeature(this, stageId, featureId); }
public async deleteFeature(stageId: string, featureId: string) { await UserStoryFeatureManager.deleteFeature(this, stageId, featureId); }
public async exportFeatureScript(stageId: string, featureId: string) { await UserStoryFeatureManager.exportFeatureScript(this, stageId, featureId); }
public async removeUserStoryFromFeature(userStoryId: string) { await UserStoryFeatureManager.removeUserStoryFromFeature(this, userStoryId); }
public async createEmptyFeature(stageId: string) { await UserStoryFeatureManager.createEmptyFeature(this, stageId); }
public async addSelectedInteractionsToFeature(stageId: string, featureId: string) { await UserStoryFeatureManager.addSelectedInteractionsToFeature(this, stageId, featureId); }
public buildUserStoryFromInteraction(interaction: any, stageId: string): any { return UserStoryFeatureManager.buildUserStoryFromInteraction(this, interaction, stageId); }
public async saveFeatureToKnowledgeBase(stageId: string, featureId: string) { await UserStoryAIManager.saveFeatureToKnowledgeBase(this, stageId, featureId); }
public async sendUseCaseToAI(interactionId: string) { await UserStoryAIManager.sendUseCaseToAI(this, interactionId); }
public async generateFeatureWithAI(stageId: string, featureId: string) { await UserStoryAIManager.generateFeatureWithAI(this, stageId, featureId); }
public showAIGeneratingOverlay(text: string) { UserStoryAIManager.showAIGeneratingOverlay(text); }
public hideAIGeneratingOverlay() { UserStoryAIManager.hideAIGeneratingOverlay(); }
public async generateAndApplyForUserStory(userStoryId: string) { await UserStoryAIManager.generateAndApplyForUserStory(this, userStoryId); }
public async testAIReachability() { await UserStoryAIManager.testAIReachability(this); }
public showAIPromptMonitor() { UserStoryAIManager.showAIPromptMonitor(this); }
public showFeatureConflictDialog(featureName: string): Promise<'overwrite' | 'rename' | null> { return UserStoryDialogManager.showFeatureConflictDialog(featureName); }
public showPromptDialog(title: string, label: string, defaultValue: string = '', multiline: boolean = false): Promise<string | null> { return UserStoryDialogManager.showPromptDialog(title, label, defaultValue, multiline); }
}
