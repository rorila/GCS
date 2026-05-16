# User-Stories Tab - Detaillierter Implementierungsplan

## Ziel

Implementierung eines User-Stories Tabs, der dem User die Möglichkeit bietet, UseCases besser zu beschreiben und damit sauberer zu implementieren. Der Tab soll drei Hauptziele erfüllen:

1. **Bessere Beschreibung von UseCases**: Strukturierte Dokumentation der Spielmechaniken
2. **KI-gestützte Implementierung**: Strukturierte User-Stories sind ideal für KI-gestützte Code-Generierung
3. **Navigation**: Direkter Zugriff auf relevante Editoren aus den User-Stories heraus

## Hintergrund

Derzeit gibt es keine zentrale Dokumentation für User-Stories im Game Builder. Die Spielmechaniken werden direkt im Flow-Editor implementiert, ohne vorherige Beschreibung oder Dokumentation. Dies führt zu folgenden Problemen:

- **Fehlende Dokumentation**: Neue Entwickler müssen den Code analysieren, um die Spielmechaniken zu verstehen
- **Inkonsistente Implementierung**: Ähnliche Mechaniken werden unterschiedlich implementiert
- **Schwierige KI-Integration**: KI hat keinen strukturierten Kontext für die Implementierung
- **Keine Navigation**: Es gibt keine zentrale Übersicht über alle Spielmechaniken

Der User-Stories Tab soll diese Probleme lösen, indem er eine strukturierte Dokumentation der Spielmechaniken bereitstellt und direkte Verbindungen zu den Editoren herstellt.

## Architektur

### Datenmodell

#### ProjectDescription
```typescript
interface ProjectDescription {
    id: string;
    title: string;
    description: string;
    genre?: string; // z.B. "Shooter", "Platformer", "RPG"
    targetAudience?: string; // z.B. "Kids", "Teens", "Adults"
    platform?: string[]; // z.B. ["Web", "Mobile", "Desktop"]
    coreMechanics?: string[]; // z.B. ["Shooting", "Collecting", "Puzzle Solving"]
    gameGoals?: string[]; // z.B. ["High Score", "Level Completion", "Story Progression"]
    technicalRequirements?: string[]; // z.B. ["WebGL", "Web Audio API", "LocalStorage"]
    narrative?: string; // Story/Narrative (falls vorhanden)
    references?: string[]; // Referenzen/Inspirationen
    createdAt: Date;
    updatedAt: Date;
}
```

#### UserStory
```typescript
interface UserStory {
    id: string;
    projectId: string; // Verknüpfung zum Projekt
    title: string;
    description: string;
    acceptanceCriteria: string[];
    priority: 'high' | 'medium' | 'low';
    status: 'idea' | 'in_progress' | 'completed' | 'blocked';
    relatedComponents: string[]; // IDs der zugehörigen Komponenten
    relatedVariables: string[]; // IDs der zugehörigen Variablen
    relatedStages: string[]; // IDs der zugehörigen Stages
    interactions: Interaction[]; // Liste der Interaktionen
    tags?: string[]; // Tags für Kategorisierung
    createdAt: Date;
    updatedAt: Date;
    createdBy?: string; // User, der die Story erstellt hat
    assignee?: string; // User, der die Story bearbeitet
}
```

#### Interaction
```typescript
interface Interaction {
    id: string;
    userStoryId: string;
    title: string;
    description: string;
    triggerComponent: TriggerComponent;
    event: Event;
    task: Task;
    actions: Action[];
    preConditions?: Condition[];
    postConditions?: Condition[];
    variableChanges?: VariableChange[];
    audioVisualEffects?: AudioVisualEffect[];
    alternativePaths?: AlternativePath[];
    testing?: Testing;
    createdAt: Date;
    updatedAt: Date;
}
```

#### TriggerComponent
```typescript
interface TriggerComponent {
    componentId: string;
    componentName: string;
    componentType: string; // z.B. "TSprite", "TButton", "TTimer"
    triggerType: string; // z.B. "onClick", "onCollision", "onTimer"
    description: string;
}
```

#### Event
```typescript
interface Event {
    eventId: string;
    eventName: string; // z.B. "onClick", "onCollision"
    description: string;
    parameters?: Record<string, any>;
}
```

#### Task
```typescript
interface Task {
    taskId: string;
    taskName: string;
    taskType: string; // z.B. "Flow", "Action"
    description: string;
    flowChartId?: string; // Verknüpfung zum Flow-Chart
}
```

#### Action
```typescript
interface Action {
    actionId: string;
    actionName: string;
    actionType: string; // z.B. "set_variable", "navigate_stage", "spawn_object"
    description: string;
    parameters?: Record<string, any>;
}
```

#### Condition
```typescript
interface Condition {
    conditionId: string;
    description: string;
    expression?: string; // Boolean-Ausdruck
    variableId?: string;
    operator?: string; // z.B. "==", "!=", ">", "<", ">=", "<="
    value?: any;
}
```

#### VariableChange
```typescript
interface VariableChange {
    variableId: string;
    variableName: string;
    oldValue?: any;
    newValue: any;
    changeType: 'set' | 'increment' | 'decrement' | 'toggle';
}
```

#### AudioVisualEffect
```typescript
interface AudioVisualEffect {
    effectId: string;
    effectType: 'audio' | 'visual' | 'both';
    description: string;
    audioFile?: string;
    visualEffect?: string;
    duration?: number;
}
```

#### AlternativePath
```typescript
interface AlternativePath {
    pathId: string;
    description: string;
    condition: Condition;
    actions: Action[];
}
```

#### Testing
```typescript
interface Testing {
    testId: string;
    testName: string;
    description: string;
    testSteps: TestStep[];
    expectedResult: string;
    automated?: boolean;
}
```

#### TestStep
```typescript
interface TestStep {
    stepId: string;
    description: string;
    action: string;
    expectedResult: string;
}
```

### UI-Komponenten

#### UserStoriesTab
```typescript
class UserStoriesTab {
    // Projektbeschreibung anzeigen/bearbeiten
    projectDescription: ProjectDescription;
    
    // User-Stories anzeigen/bearbeiten
    userStories: UserStory[];
    
    // Filterung und Suche
    filter: Filter;
    search: Search;
    
    // Navigation
    navigateTo(componentId: string, editorType: EditorType): void;
    navigateToFlowChart(flowChartId: string): void;
    navigateToStage(stageId: string): void;
}
```

#### ProjectDescriptionEditor
```typescript
class ProjectDescriptionEditor {
    // Formular für Projektbeschreibung
    form: Form;
    
    // Felder
    title: Input;
    description: TextArea;
    genre: Select;
    targetAudience: Select;
    platform: MultiSelect;
    coreMechanics: MultiSelect;
    gameGoals: MultiSelect;
    technicalRequirements: MultiSelect;
    narrative: TextArea;
    references: MultiInput;
    
    // Speichern
    save(): void;
    
    // Laden
    load(): void;
}
```

#### UserStoryEditor
```typescript
class UserStoryEditor {
    // Formular für User-Story
    form: Form;
    
    // Felder
    title: Input;
    description: TextArea;
    acceptanceCriteria: MultiInput;
    priority: Select;
    status: Select;
    relatedComponents: MultiSelect;
    relatedVariables: MultiSelect;
    relatedStages: MultiSelect;
    tags: MultiInput;
    
    // Interaktionen
    interactions: Interaction[];
    
    // Interaktion hinzufügen
    addInteraction(): void;
    
    // Interaktion bearbeiten
    editInteraction(interactionId: string): void;
    
    // Interaktion löschen
    deleteInteraction(interactionId: string): void;
    
    // Speichern
    save(): void;
    
    // Laden
    load(): void;
}
```

#### InteractionEditor
```typescript
class InteractionEditor {
    // Formular für Interaktion
    form: Form;
    
    // Felder
    title: Input;
    description: TextArea;
    triggerComponent: ComponentSelector;
    event: EventSelector;
    task: TaskSelector;
    actions: ActionList;
    preConditions: ConditionList;
    postConditions: ConditionList;
    variableChanges: VariableChangeList;
    audioVisualEffects: AudioVisualEffectList;
    alternativePaths: AlternativePathList;
    testing: TestingEditor;
    
    // Diagramm
    diagram: Diagram;
    
    // Diagramm aktualisieren
    updateDiagram(): void;
    
    // Speichern
    save(): void;
    
    // Laden
    load(): void;
}
```

#### Diagram
```typescript
class Diagram {
    // Diagramm-Typ
    type: 'flowchart' | 'sequence' | 'state_machine' | 'entity_relationship';
    
    // Elemente
    elements: DiagramElement[];
    
    // Verbindungen
    connections: DiagramConnection[];
    
    // Interaktivität
    onClick(elementId: string): void;
    onHover(elementId: string): void;
    onDrag(elementId: string, x: number, y: number): void;
    
    // Navigation
    zoom: number;
    pan: { x: number, y: number };
    
    // Rendering
    render(): void;
}
```

#### DiagramElement
```typescript
interface DiagramElement {
    id: string;
    type: 'trigger' | 'event' | 'task' | 'action' | 'condition' | 'variable' | 'effect';
    label: string;
    x: number;
    y: number;
    width: number;
    height: number;
    color: string;
    icon?: string;
    data?: any; // Zusätzliche Daten für das Element
}
```

#### DiagramConnection
```typescript
interface DiagramConnection {
    id: string;
    fromElementId: string;
    toElementId: string;
    label?: string;
    color: string;
    arrow: 'arrow' | 'diamond' | 'circle';
}
```

#### Filter
```typescript
class Filter {
    // Filter-Kriterien
    status?: string[];
    priority?: string[];
    tags?: string[];
    relatedComponents?: string[];
    relatedVariables?: string[];
    relatedStages?: string[];
    
    // Filter anwenden
    apply(userStories: UserStory[]): UserStory[];
    
    // Filter zurücksetzen
    reset(): void;
}
```

#### Search
```typescript
class Search {
    // Suchbegriff
    query: string;
    
    // Suche durchführen
    search(userStories: UserStory[]): UserStory[];
    
    // Suche zurücksetzen
    reset(): void;
}
```

### Integration mit bestehenden Komponenten

#### Verbindung zum Flow-Editor
```typescript
// User-Story → Flow-Editor
interface UserStoryToFlowEditor {
    // Klick auf Task öffnet Flow-Editor
    onTaskClick(taskId: string): void;
    
    // Flow-Editor öffnen
    openFlowEditor(flowChartId: string): void;
}

// Flow-Editor → User-Story
interface FlowEditorToUserStory {
    // Flow kann User-Story zugeordnet werden
    assignUserStory(flowChartId: string, userStoryId: string): void;
    
    // User-Story-Zuordnung entfernen
    unassignUserStory(flowChartId: string): void;
}
```

#### Verbindung zum Inspector
```typescript
// User-Story → Inspector
interface UserStoryToInspector {
    // Klick auf Komponente öffnet Inspector
    onComponentClick(componentId: string): void;
    
    // Inspector öffnen
    openInspector(componentId: string): void;
}

// Inspector → User-Story
interface InspectorToUserStory {
    // Komponente kann User-Story zugeordnet werden
    assignUserStory(componentId: string, userStoryId: string): void;
    
    // User-Story-Zuordnung entfernen
    unassignUserStory(componentId: string): void;
}
```

#### Verbindung zum Stage-Editor
```typescript
// User-Story → Stage-Editor
interface UserStoryToStageEditor {
    // Klick auf Stage öffnet Stage-Editor
    onStageClick(stageId: string): void;
    
    // Stage-Editor öffnen
    openStageEditor(stageId: string): void;
}

// Stage-Editor → User-Story
interface StageEditorToUserStory {
    // Stage kann User-Story zugeordnet werden
    assignUserStory(stageId: string, userStoryId: string): void;
    
    // User-Story-Zuordnung entfernen
    unassignUserStory(stageId: string): void;
}
```

### KI-Integration

#### KI-generierte User-Stories
```typescript
interface AIGeneratedUserStories {
    // Projekt analysieren
    analyzeProject(project: any): ProjectAnalysis;
    
    // User-Stories vorschlagen
    suggestUserStories(project: any): UserStory[];
    
    // Diagramme generieren
    generateDiagram(interaction: Interaction): Diagram;
    
    // Fehlende Interaktionen identifizieren
    identifyMissingInteractions(project: any, userStories: UserStory[]): Interaction[];
}
```

#### KI-gestützte Implementierung
```typescript
interface AIGuidedImplementation {
    // User-Story implementieren
    implementUserStory(userStory: UserStory): ImplementationResult;
    
    // Flow-Charts generieren
    generateFlowChart(userStory: UserStory): FlowChart;
    
    // Verbesserungen vorschlagen
    suggestImprovements(userStory: UserStory): Improvement[];
}
```

### Test-Integration

#### Test-Generation
```typescript
interface TestGeneration {
    // Test generieren
    generateTest(userStory: UserStory): Test;
    
    // Test ausführen
    executeTest(test: Test): TestResult;
    
    // Test-Ergebnis anzeigen
    displayTestResult(result: TestResult): void;
}
```

### Kollaboration

#### Sharing
```typescript
interface Sharing {
    // User-Stories exportieren
    export(userStories: UserStory[], format: 'json' | 'markdown'): string;
    
    // User-Stories importieren
    import(data: string, format: 'json' | 'markdown'): UserStory[];
    
    // User-Stories teilen
    share(userStories: UserStory[], recipients: string[]): void;
}
```

#### Kommentare und Feedback
```typescript
interface CommentsAndFeedback {
    // Kommentar hinzufügen
    addComment(userStoryId: string, comment: Comment): void;
    
    // Kommentar bearbeiten
    editComment(commentId: string, comment: Comment): void;
    
    // Kommentar löschen
    deleteComment(commentId: string): void;
    
    // Feedback geben
    giveFeedback(userStoryId: string, feedback: Feedback): void;
}
```

#### Versionierung
```typescript
interface Versioning {
    // User-Story versionieren
    versionUserStory(userStoryId: string): void;
    
    // Änderungshistorie anzeigen
    showHistory(userStoryId: string): Version[];
    
    // Rollback zu früherer Version
    rollback(userStoryId: string, versionId: string): void;
}
```

### Analytics

#### Statistiken
```typescript
interface Statistics {
    // Anzahl der User-Stories pro Status
    userStoriesByStatus: Record<string, number>;
    
    // Anzahl der User-Stories pro Priorität
    userStoriesByPriority: Record<string, number>;
    
    // Anzahl der User-Stories pro Komponente
    userStoriesByComponent: Record<string, number>;
    
    // Zeit bis zur Fertigstellung
    timeToCompletion: Record<string, number>;
}
```

#### Berichte
```typescript
interface Reports {
    // Fortschrittsbericht
    generateProgressReport(): ProgressReport;
    
    // Risikobewertung
    generateRiskReport(): RiskReport;
    
    // Testabdeckung
    generateTestCoverageReport(): TestCoverageReport;
}
```

## Implementierungsphasen

### Phase 1: Grundlagen (8-12 Stunden)

#### Aufgabe 1.1: Tab im Tab-Management erstellen (2-3 Stunden)
- Tab im Tab-Management hinzufügen
- Tab-Icon und Label definieren
- Tab-Route definieren
- Tests schreiben

#### Aufgabe 1.2: Projektbeschreibung (1. Ebene) implementieren (3-4 Stunden)
- ProjectDescription Datenmodell implementieren
- ProjectDescriptionEditor UI-Komponente implementieren
- CRUD-Operationen für Projektbeschreibung
- Speicherung im Projekt-JSON
- Tests schreiben

#### Aufgabe 1.3: User-Story Template erstellen (2-3 Stunden)
- UserStory Datenmodell implementieren
- UserStoryEditor UI-Komponente implementieren
- CRUD-Operationen für User-Stories
- Speicherung im Projekt-JSON
- Tests schreiben

#### Aufgabe 1.4: Filterung und Suche (2-3 Stunden)
- Filter UI-Komponente implementieren
- Search UI-Komponente implementieren
- Filter-Logik implementieren
- Such-Logik implementieren
- Tests schreiben

### Phase 2: Interaktionen (10-14 Stunden)

#### Aufgabe 2.1: Interaktionen Datenmodell implementieren (1-2 Stunden)
- Interaction Datenmodell implementieren
- TriggerComponent Datenmodell implementieren
- Event Datenmodell implementieren
- Task Datenmodell implementieren
- Action Datenmodell implementieren
- Tests schreiben

#### Aufgabe 2.2: Automatische Extraktion aus JSON-Daten (3-4 Stunden)
- Trigger-Komponente aus project.objects extrahieren (das Objekt selbst)
- Event-Typ aus events in objects extrahieren (inkl. spezifische Tastenbelegungen wie "onKeyDown_ArrowLeft")
- Task aus project.flowCharts extrahieren (name des Flow-Charts)
- Action aus actionSequence in flowCharts extrahieren
- Struktur automatisch generieren
- Tests schreiben

#### Aufgabe 2.3: Verbindung zum Flow-Editor (2-3 Stunden)
- UserStoryToFlowEditor Schnittstelle implementieren
- FlowEditorToUserStory Schnittstelle implementieren
- Klick auf Task öffnet Flow-Editor
- Flow kann User-Story zugeordnet werden
- Tests schreiben

#### Aufgabe 2.4: Automatische Diagramm-Generierung aus JSON-Daten (3-4 Stunden)
- Flowchart aus project.flowCharts generieren (Nodes + Connections)
- Sequence-Diagramm aus project.objects (events) + project.flowCharts generieren
- State Machine aus project.variables + project.actions generieren
- Entity-Relationship aus project.objects (parent/child) generieren
- Diagramm-Rendering implementieren
- Tests schreiben

#### Aufgabe 2.5: Manuelle Erweiterung (1-2 Stunden)
- Prä-Conditions hinzufügen (nicht im JSON)
- Post-Conditions hinzufügen (nicht im JSON)
- Variable-Changes hinzufügen (nicht im JSON)
- Audio/Visuelle Effekte hinzufügen (nicht im JSON)
- Alternative Pfade hinzufügen (nicht im JSON)
- Testing hinzufügen (nicht im JSON)
- Tests schreiben

#### Aufgabe 2.6: Speicherung (1-2 Stunden)
- User-Story-Zuordnung im Projekt-JSON speichern
- Manuelle Erweiterungen im User-Story JSON speichern
- Automatische Generierung beim Laden
- Tests schreiben

### Phase 3: Visualisierung (8-12 Stunden)

#### Aufgabe 3.1: Interaktivität (3-4 Stunden)
- onClick implementieren (Element im Diagramm klicken → Editor öffnen)
- onHover implementieren (Hover → Details anzeigen)
- onDrag implementieren (Elemente im Diagramm verschieben)
- Tooltips implementieren
- Tests schreiben

#### Aufgabe 3.2: Zoom/Pan (2-3 Stunden)
- Zoom implementieren
- Pan implementieren
- Zoom/Pan Controls implementieren
- Tests schreiben

#### Aufgabe 3.3: Diagramm-Layout-Algorithmus (3-4 Stunden)
- Automatisches Layout für Flowcharts
- Automatisches Layout für Sequence-Diagramme
- Automatisches Layout für State Machines
- Automatisches Layout für Entity-Relationship-Diagramme
- Tests schreiben

### Phase 4: Integration (8-12 Stunden)

#### Aufgabe 4.1: Verbindung zum Inspector (3-4 Stunden)
- UserStoryToInspector Schnittstelle implementieren
- InspectorToUserStory Schnittstelle implementieren
- Klick auf Komponente öffnet Inspector
- Komponente kann User-Story zugeordnet werden
- Tests schreiben

#### Aufgabe 4.2: Verbindung zum Stage-Editor (3-4 Stunden)
- UserStoryToStageEditor Schnittstelle implementieren
- StageEditorToUserStory Schnittstelle implementieren
- Klick auf Stage öffnet Stage-Editor
- Stage kann User-Story zugeordnet werden
- Tests schreiben

#### Aufgabe 4.3: Bidirektionale Links (2-3 Stunden)
- Links von User-Story zu Komponenten
- Links von Komponenten zu User-Story
- Links von User-Story zu Stages
- Links von Stages zu User-Story
- Tests schreiben

### Phase 5: KI-Integration (16-20 Stunden)

#### Aufgabe 5.1: KI-generierte User-Stories (4-5 Stunden)
- AIGeneratedUserStories Schnittstelle implementieren
- Projekt analysieren
- User-Stories vorschlagen
- Tests schreiben

#### Aufgabe 5.2: KI-generierte Diagramme (4-5 Stunden)
- Diagramm generieren
- Diagramm-Typ auswählen
- Diagramm optimieren
- Tests schreiben

#### Aufgabe 5.3: Fehlende Interaktionen identifizieren (3-4 Stunden)
- Fehlende Interaktionen identifizieren
- Interaktionen vorschlagen
- Tests schreiben

#### Aufgabe 5.4: KI-gestützte Implementierung (4-5 Stunden)
- AIGuidedImplementation Schnittstelle implementieren
- User-Story implementieren
- Flow-Charts generieren
- Verbesserungen vorschlagen
- Tests schreiben

### Phase 6: Test-Integration (8-12 Stunden)

#### Aufgabe 6.1: Test-Generation (3-4 Stunden)
- TestGeneration Schnittstelle implementieren
- Test generieren
- Test-Template implementieren
- Tests schreiben

#### Aufgabe 6.2: Test-Ausführung (3-4 Stunden)
- Test ausführen
- Test-Ergebnis anzeigen
- Test-History anzeigen
- Tests schreiben

#### Aufgabe 6.3: Test-Ergebnis-Anzeige (2-3 Stunden)
- Test-Ergebnis in User-Story anzeigen
- Test-Status anzeigen
- Test-Statistiken anzeigen
- Tests schreiben

### Phase 7: Kollaboration (8-12 Stunden)

#### Aufgabe 7.1: Sharing (Export/Import) (2-3 Stunden)
- Sharing Schnittstelle implementieren
- User-Stories exportieren (JSON)
- User-Stories exportieren (Markdown)
- User-Stories importieren (JSON)
- User-Stories importieren (Markdown)
- Tests schreiben

#### Aufgabe 7.2: Kommentare und Feedback (3-4 Stunden)
- CommentsAndFeedback Schnittstelle implementieren
- Kommentar hinzufügen
- Kommentar bearbeiten
- Kommentar löschen
- Feedback geben
- Tests schreiben

#### Aufgabe 7.3: Versionierung (3-4 Stunden)
- Versioning Schnittstelle implementieren
- User-Story versionieren
- Änderungshistorie anzeigen
- Rollback zu früherer Version
- Tests schreiben

### Phase 8: Analytics (4-6 Stunden)

#### Aufgabe 8.1: Statistiken (2-3 Stunden)
- Statistics Schnittstelle implementieren
- Anzahl der User-Stories pro Status
- Anzahl der User-Stories pro Priorität
- Anzahl der User-Stories pro Komponente
- Zeit bis zur Fertigstellung
- Tests schreiben

#### Aufgabe 8.2: Berichte (2-3 Stunden)
- Reports Schnittstelle implementieren
- Fortschrittsbericht generieren
- Risikobewertung generieren
- Testabdeckung generieren
- Tests schreiben

## Aufwandsschätzung

### Minimal (MVP): 18-26 Stunden
- Phase 1: 8-12 Stunden
- Phase 2: 10-14 Stunden
- Keine Phasen 3-8

### Vollständig: 70-98 Stunden
- Phase 1: 8-12 Stunden
- Phase 2: 10-14 Stunden
- Phase 3: 8-12 Stunden
- Phase 4: 8-12 Stunden
- Phase 5: 16-20 Stunden
- Phase 6: 8-12 Stunden
- Phase 7: 8-12 Stunden
- Phase 8: 4-6 Stunden

## Risiken

### Hoch (4-6 Stunden Zusatzaufwand)
- **KI-Integration**: KI-Integration ist komplex und erfordert umfangreiche Tests
- **Diagramm-Rendering**: Diagramm-Rendering kann performance-problematisch sein
- **Datenmodell-Komplexität**: Das Datenmodell ist sehr komplex und kann schwer zu pflegen sein

### Mittel (2-3 Stunden Zusatzaufwand)
- **Integration mit bestehenden Komponenten**: Die Integration mit dem Flow-Editor, Inspector und Stage-Editor kann komplex sein
- **Test-Integration**: Die Test-Integration kann komplex sein, da Tests nicht automatisch generiert werden können
- **Kollaboration**: Die Kollaboration kann komplex sein, da User-Management und Permissions implementiert werden müssen

### Niedrig (1-2 Stunden Zusatzaufwand)
- **Tests schreiben**: Umfangreiche Tests sind notwendig
- **Bugfixing**: Unvorhergesehene Probleme

## Erfolgskriterien

### Phase 1
- [ ] Tab im Tab-Management erstellt
- [ ] Projektbeschreibung kann erstellt/bearbeitet werden
- [ ] User-Stories können erstellt/bearbeitet/gelöscht werden
- [ ] Filterung und Suche funktionieren
- [ ] Tests sind grün

### Phase 2
- [ ] Trigger-Komponente wird aus project.objects extrahiert
- [ ] Event-Typ wird aus events in objects extrahiert (inkl. spezifische Tastenbelegungen)
- [ ] Task wird aus project.flowCharts extrahiert
- [ ] Action wird aus actionSequence in flowCharts extrahiert
- [ ] Struktur wird automatisch generiert
- [ ] Verbindung zum Flow-Editor funktioniert
- [ ] Automatische Diagramm-Generierung funktioniert (aus project.flowCharts, project.objects, project.variables)
- [ ] User-Story-Zuordnung wird im Projekt-JSON gespeichert
- [ ] Tests sind grün

### Phase 3
- [ ] Interaktivität (Klick, Hover, Drag) funktioniert
- [ ] Zoom/Pan funktioniert
- [ ] Automatisches Layout für alle Diagramm-Typen funktioniert
- [ ] Tests sind grün

### Phase 4
- [ ] Verbindung zum Inspector funktioniert
- [ ] Verbindung zum Stage-Editor funktioniert
- [ ] Bidirektionale Links funktionieren
- [ ] Tests sind grün

### Phase 5
- [ ] KI-generierte User-Stories funktionieren
- [ ] KI-generierte Diagramme funktionieren
- [ ] Fehlende Interaktionen werden identifiziert
- [ ] KI-gestützte Implementierung funktioniert
- [ ] Tests sind grün

### Phase 6
- [ ] Test-Generation funktioniert
- [ ] Test-Ausführung funktioniert
- [ ] Test-Ergebnis-Anzeige funktioniert
- [ ] Tests sind grün

### Phase 7
- [ ] Sharing (Export/Import) funktioniert
- [ ] Kommentare und Feedback funktionieren
- [ ] Versionierung funktioniert
- [ ] Tests sind grün

### Phase 8
- [ ] Statistiken funktionieren
- [ ] Berichte funktionieren
- [ ] Tests sind grün

## Empfehlung

Beginnen mit **Phase 1 und 2 (18-26 Stunden)**, um die Grundfunktionalität zu implementieren. Phase 2 extrahiert ALLE Informationen automatisch aus den JSON-Daten (Trigger-Komponente aus project.objects, Event-Typ aus events in objects inkl. spezifische Tastenbelegungen, Task aus project.flowCharts, Action aus actionSequence). Nur die User-Story-Zuordnung wird gespeichert. Manuelle Erweiterungen (Prä-Conditions, Post-Conditions, etc.) sind optional. Wenn dies erfolgreich ist, mit Phase 3 und 4 fortfahren. Phasen 5-8 sind optional und können später implementiert werden.

Die KI-Integration (Phase 5) sollte erst implementiert werden, wenn die Grundfunktionalität stabil ist und die Benutzerfeedback vorliegt.

## Nächste Schritte

1. Phase 1 starten
2. Erfolgskriterien prüfen
3. Phase 2 starten (wenn Phase 1 erfolgreich)
4. Erfolgskriterien prüfen
5. Phase 3 starten (wenn Phase 2 erfolgreich)
6. Erfolgskriterien prüfen
7. Phase 4 starten (wenn Phase 3 erfolgreich)
8. Erfolgskriterien prüfen
9. Phase 5 starten (optional, wenn Phase 4 erfolgreich)
10. Erfolgskriterien prüfen
11. Phase 6 starten (optional, wenn Phase 5 erfolgreich)
12. Erfolgskriterien prüfen
13. Phase 7 starten (optional, wenn Phase 6 erfolgreich)
14. Erfolgskriterien prüfen
15. Phase 8 starten (optional, wenn Phase 7 erfolgreich)
16. Erfolgskriterien prüfen
