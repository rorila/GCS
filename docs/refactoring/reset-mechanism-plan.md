# Reset-Mechanismus auf TComponent-Basis

## Ziel

Implementierung eines zuverlässigen Reset-Mechanismus für alle Komponenten und Variablen, der auf der TComponent-Basisklasse aufbaut und ein vollständiges Zurücksetzen des Spiels ermöglicht.

## Hintergrund

Bisherige Ansätze für einen Spiel-Reset wurden mehrfach versucht, aber keiner hat erfolgreich funktioniert. Im Folgenden werden die verschiedenen Ansätze detailliert beschrieben, warum sie gescheitert sind und welche Probleme aufgetreten sind.

### Ansatz 1: navigate_stage mit Reset-Checkbox

**Idee**: Die `navigate_stage` Action wurde um eine `reset`-Checkbox erweitert. Wenn diese aktiviert ist, sollte die Stage komplett neu aufgebaut werden.

**Implementierung**:
- DOM-Elemente wurden gelöscht
- Stage-JSON objects wurden neu geladen
- merged objects wurden neu kombiniert
- triggerStageStartEvents wurde aufgerufen
- GameLoopManager wurde neu initialisiert
- Timer wurden auf 0 zurückgesetzt

**Probleme**:
- Die Stage wurde nicht korrekt angezeigt
- pool-Objekte fehlten in der neuen objects-Liste
- Merged objects mussten mit der initialen Kopie kombiniert werden
- Blueprint-Elemente sind global und müssten in die Stage verlagert werden

**Ergebnis**: Funktioniert nicht, die Stage wird praktisch genau so angezeigt, wie bei den vorherigen Versuchen.

### Ansatz 2: Komplette Neuinitialisierung mit initMainGame()

**Idee**: Beim Reset wird `initMainGame()` aufgerufen, um das Spiel komplett neu zu initialisieren.

**Implementierung**:
- Alle Objekte werden neu initialisiert
- Timer werden auf 0 zurückgesetzt
- GameLoopManager wird neu initialisiert
- DOM wird neu aufgebaut

**Probleme**:
- Die Stage wird nicht korrekt angezeigt
- pool-Objekte werden nicht korrekt erstellt
- Globale Variablen werden nicht zurückgesetzt

**Ergebnis**: Funktioniert nicht, die Stage wird praktisch genau so angezeigt, wie bei den vorherigen Versuchen.

### Ansatz 3: location.reload()

**Idee**: Beim Reset wird `location.reload()` aufgerufen, um die Seite neu zu laden.

**Implementierung**:
- `location.reload()` wird aufgerufen

**Probleme**:
- Die Seite wird neu geladen
- Der Editor wird neu geladen
- GameRuntime muss neu erstellt werden ohne Seiten-Reload

**Ergebnis**: Funktioniert nicht, da der Editor neu geladen wird und nicht nur das Spiel.

### Ansatz 4: onRuntimeReset-Callback

**Idee**: Ein Callback `onRuntimeReset` wird implementiert, der die Runtime neu erstellt ohne Editor-Reload.

**Implementierung**:
- Callback wird an ActionExecutor übergeben
- Callback wird in NavigationActions aufgerufen
- Callback ruft setRunMode(false) und setRunMode(true) auf

**Probleme**:
- Callback wird aufgerufen aber Ergebnis ist falsch
- Die Stage wird nicht korrekt angezeigt
- pool-Objekte werden nicht korrekt erstellt

**Ergebnis**: Funktioniert nicht, die Stage wird praktisch genau so angezeigt, wie bei den vorherigen Versuchen.

### Ansatz 5: Kopie der Stage beim initialen Laden

**Idee**: Beim initialen Laden wird eine Kopie der Stage erstellt. Beim Reset wird diese Kopie verwendet.

**Implementierung**:
- Kopie der Stage beim initialen Laden erstellen
- Beim Reset diese Kopie verwenden
- Kopie filtern - nur Objekte mit className behalten
- Merged objects mit initialer Kopie kombinieren

**Probleme**:
- Deserialisierungsfehler behoben: Kopie filtern - nur Objekte mit className behalten
- Stage wird nicht angezeigt - Merged objects mit initialer Kopie kombinieren
- Blueprint-Elemente sind global und müssten in die Stage verlagert werden

**Ergebnis**: Funktioniert nicht, die Stage wird praktisch genau so angezeigt, wie bei den vorherigen Versuchen.

### Ansatz 6: restart_game Action

**Idee**: Eine neue Action `restart_game` wird erstellt, die `setRunMode(false)` und `setRunMode(true)` aufruft.

**Implementierung**:
- Action `restart_game` erstellen
- onRestartGame-Callback an ActionExecutor übergeben
- Callback ruft setRunMode(false) und setRunMode(true) auf

**Probleme**:
- Callback wird aufgerufen aber Ergebnis ist falsch
- Die Stage wird nicht korrekt angezeigt
- pool-Objekte werden nicht korrekt erstellt

**Ergebnis**: Funktioniert nicht, die Stage wird praktisch genau so angezeigt, wie bei den vorherigen Versuchen.

### Ansatz 7: SpritePool.destroy()

**Idee**: Vor Erstellung einer neuen GameRuntime wird `SpritePool.destroy()` aufgerufen.

**Implementierung**:
- SpritePool.destroy() aufrufen in stopRuntime
- Debug-Logs für SpritePool.destroy() hinzufügen

**Probleme**:
- SpritePool.destroy() hat nicht funktioniert
- Analyse warum: SpritePool ist Instanzvariable, keine Singleton

**Ergebnis**: Funktioniert nicht, da SpritePool eine Instanzvariable der Runtime ist und nicht separat zurückgesetzt werden muss.

### Ansatz 8: Tiefere Analyse mit Debug-Logs

**Idee**: Debug-Logs werden hinzugefügt, um zu analysieren, warum die pool-Objekte nicht korrekt erstellt werden.

**Implementierung**:
- Debug-Logs in SpritePool.init hinzufügen
- Debug-Logs in GameRuntime.ts hinzufügen
- Debug-Logs in EditorRunManager.ts hinzufügen

**Ergebnisse**:
- pool-Objekte werden korrekt erstellt (31→84 objects)
- pool-Objekte werden nicht gerendert
- GameLoopManager ist Singleton - sprites werden beim Restart nicht aktualisiert

**Ergebnis**: Die Analyse hat gezeigt, dass pool-Objekte korrekt erstellt werden, aber nicht gerendert werden, da der GameLoopManager ein Singleton ist und die sprites-Liste nicht aktualisiert wird.

### Hauptprobleme aller Ansätze

1. **Singleton-Problem**: Der GameLoopManager ist ein Singleton und wird beim Restart nicht neu erstellt. Die sprites-Liste im GameLoopManager wird nicht mit den neuen pool-Objekten aktualisiert.

2. **DOM-Management**: DOM-Elemente müssen entfernt und neu erstellt werden, Event-Listener müssen neu gebunden werden.

3. **Timer-Management**: Alle Timer (TTimer, varTimers, splashTimerId) müssen gestoppt werden, Timer-IDs müssen gespeichert und beim Reset gelöscht werden.

4. **Event-Listener**: Event-Listener müssen entfernt werden, um Memory Leaks zu vermeiden, und neu gebunden werden.

5. **ReactiveRuntime**: ReactiveRuntime Proxy muss zurückgesetzt werden, Reactive Objects müssen neu registriert werden.

6. **Multiplayer**: Multiplayer-Verbindung muss zurückgesetzt werden, Multiplayer-Events müssen neu gebunden werden.

### Warum der neue Ansatz funktionieren sollte

Der neue Ansatz basiert auf TComponent, der Basisklasse für alle Komponenten, und nutzt den bereits vorhandenen DESIGN_VALUES Mechanismus. Dieser Ansatz hat folgende Vorteile:

1. **Zentralisiert**: Reset-Logik in TComponent statt verteilt über viele Klassen
2. **Wiederverwendbar**: Alle Komponenten erben automatisch die Reset-Funktionalität
3. **Erweiterbar**: Unterklassen können onReset() überschreiben für komponentenspezifisches Verhalten
4. **Konsistent**: DESIGN_VALUES Mechanismus wird bereits für Serialisierung verwendet
5. **Rekursiv**: Kinder werden automatisch resetted

Durch die zentrale Reset-Logik in TComponent und die explizite Behandlung von Singletons (GameLoopManager) und DOM-Elementen sollten die Probleme der vorherigen Ansätze gelöst werden.

## Architektur

### TComponent-Basis

#### Neue Methoden in TComponent

```typescript
/**
 * Setzt alle Properties auf ihre Initialwerte zurück
 */
public reset(): void {
    // Alle Properties auf DESIGN_VALUES zurücksetzen
    const designValues = (this as any)[DESIGN_VALUES];
    if (designValues) {
        const props = this.getInspectorProperties();
        props.forEach(p => {
            if (designValues[p.name] !== undefined) {
                this.setPropertyValue(p.name, designValues[p.name]);
            }
        });
    }
    
    // Kinder rekursiv resetten
    this.children.forEach(child => {
        if (child instanceof TComponent) {
            child.reset();
        }
    });
    
    // Komponentenspezifisches Reset (überschreibbar)
    this.onReset();
}

/**
 * Virtuelle Methode für komponentenspezifisches Reset
 * Unterklassen können diese Methode überschreiben
 */
protected onReset(): void {
    // Default-Implementierung: nichts tun
}
```

#### InitialValues Symbol

Für Properties ohne DESIGN_VALUES (z.B. velocityX, current Position) wird ein neues Symbol eingeführt:

```typescript
export const INITIAL_VALUES = Symbol('INITIAL_VALUES');
```

Dieses Symbol speichert die Initialwerte beim ersten Runtime-Start.

### Runtime-Manager

#### RuntimeVariableManager.reset()

```typescript
public reset(): void {
    // Alle globalen Variablen auf defaultValue zurücksetzen
    Object.keys(this.projectVariables).forEach(name => {
        const def = this.globalDefinitions.get(name);
        if (def && def.defaultValue !== undefined) {
            this.projectVariables[name] = def.defaultValue;
        }
    });
    
    // Alle stage-Variablen auf defaultValue zurücksetzen
    Object.keys(this.stageVariables).forEach(name => {
        const def = this.globalDefinitions.get(name);
        if (def && def.defaultValue !== undefined) {
            this.stageVariables[name] = def.defaultValue;
        }
    });
    
    // contextVars neu erstellen
    this.contextVars = this.createVariableContext();
    
    // ReactiveRuntime synchronisieren
    this.syncAllToReactive();
}
```

#### SpritePool.reset()

```typescript
public reset(): void {
    // Alle Pool-Einträge zurücksetzen
    this.pools.forEach(pool => {
        pool.entries.forEach(entry => {
            entry.busy = false;
            entry.sprite.visible = false;
            entry.sprite.x = -100;
            entry.sprite.y = -100;
            entry.sprite.velocityX = 0;
            entry.sprite.velocityY = 0;
            entry.acquiredAt = 0;
        });
    });
}
```

#### GameLoopManager.reset()

```typescript
public reset(): void {
    // Alle Cooldowns löschen
    this.collisionCooldowns.clear();
    this.boundaryCooldowns.clear();
    this.exitedSprites.clear();
    
    // sprites neu initialisieren
    // (wird von GameRuntime.reset() aufgerufen)
}
```

### Komponenten

#### TSprite.reset()

```typescript
protected onReset(): void {
    super.onReset();
    const initialValues = (this as any)[INITIAL_VALUES];
    if (initialValues) {
        this.x = initialValues.x;
        this.y = initialValues.y;
        this.velocityX = 0;
        this.velocityY = 0;
        this.visible = initialValues.visible;
    }
}
```

#### TVariable.reset()

```typescript
protected onReset(): void {
    super.onReset();
    this.value = this.defaultValue;
}
```

#### TTimer.reset()

```typescript
protected onReset(): void {
    super.onReset();
    this.current = 0;
    this.stop();
}
```

#### TSpriteTemplate.reset()

```typescript
protected onReset(): void {
    super.onReset();
    // Pool-Einträge werden von SpritePool.reset() zurückgesetzt
}
```

### GameRuntime

#### GameRuntime.reset()

```typescript
public reset(): void {
    // Alle Timer stoppen
    this.varTimers.forEach((timer, prop) => {
        clearInterval(timer);
    });
    this.varTimers.clear();
    
    if (this.splashTimerId) {
        clearTimeout(this.splashTimerId);
        this.splashTimerId = null;
    }
    
    // Alle Objekte resetten
    this.objects.forEach(obj => {
        if (obj instanceof TComponent) {
            obj.reset();
        }
    });
    
    // Variablen resetten
    this.variableManager.reset();
    
    // SpritePool resetten
    this.spritePool.reset();
    
    // GameLoopManager resetten
    const glm = GameLoopManager.getInstance();
    glm.reset();
    glm.updateSprites(this.objects);
    
    // Stage resetten
    if (this.stageController) {
        this.stageController.goToMainStage();
    }
    
    // Flags zurücksetzen
    this.isSplashActive = false;
    this.isMainGameStarted = false;
    
    // Input resetten
    this.inputHandler.reset();
    
    // Multiplayer resetten
    this.multiplayerHandler.reset();
}
```

## Phasen

### Phase 1: Basis (8-12 Stunden)

#### Aufgabe 1.1: TComponent.reset() implementieren (4-6 Stunden)
- reset() Methode in TComponent hinzufügen
- onReset() virtuelle Methode hinzufügen
- DESIGN_VALUES Mechanismus erweitern
- Tests schreiben

#### Aufgabe 1.2: RuntimeVariableManager.reset() implementieren (2-3 Stunden)
- reset() Methode in RuntimeVariableManager hinzufügen
- Alle Variablen auf defaultValue zurücksetzen
- contextVars neu erstellen
- Tests schreiben

#### Aufgabe 1.3: GameRuntime.reset() implementieren (2-3 Stunden)
- reset() Methode in GameRuntime hinzufufen
- Alle Objekte durchiterieren und reset() aufrufen
- variableManager.reset() aufrufen
- Tests schreiben

### Phase 2: Runtime (8-12 Stunden)

#### Aufgabe 2.1: SpritePool.reset() implementieren (2-3 Stunden)
- reset() Methode in SpritePool hinzufügen
- Alle Pool-Einträge zurücksetzen
- Tests schreiben

#### Aufgabe 2.2: GameLoopManager.reset() implementieren (2-3 Stunden)
- reset() Methode in GameLoopManager hinzufügen
- Alle Cooldowns löschen
- updateSprites() Methode implementieren
- Tests schreiben

#### Aufgabe 2.3: GameRuntime.reset() erweitern (2-3 Stunden)
- spritePool.reset() aufrufen
- GameLoopManager.reset() aufrufen
- Timer-Management
- Tests schreiben

#### Aufgabe 2.4: DOM-Management (2-3 Stunden)
- DOM-Elemente entfernen
- DOM-Elemente neu erstellen
- Event-Listener neu binden
- Tests schreiben

### Phase 3: Komponenten (8-12 Stunden)

#### Aufgabe 3.1: TSprite.reset() implementieren (1-2 Stunden)
- INITIAL_VALUES Mechanismus
- onReset() überschreiben
- Tests schreiben

#### Aufgabe 3.2: TVariable.reset() implementieren (1-2 Stunden)
- onReset() überschreiben
- defaultValue zurücksetzen
- Tests schreiben

#### Aufgabe 3.3: TTimer.reset() implementieren (1-2 Stunden)
- onReset() überschreiben
- current auf 0 setzen
- stop() aufrufen
- Tests schreiben

#### Aufgabe 3.4: TSpriteTemplate.reset() implementieren (2-3 Stunden)
- onReset() überschreiben
- Pool-Einträge zurücksetzen
- Tests schreiben

#### Aufgabe 3.5: TStageController.reset() implementieren (1-2 Stunden)
- onReset() überschreiben
- Stage-Status zurücksetzen
- Tests schreiben

#### Aufgabe 3.6: Weitere Komponenten (optional) (2-3 Stunden)
- TWindow.reset()
- TPanel.reset()
- TInputController.reset()
- Tests schreiben

### Phase 4: UI (4-6 Stunden)

#### Aufgabe 4.1: reset_game Action implementieren (1-2 Stunden)
- Action in NavigationActions hinzufügen
- GameRuntime.reset() aufrufen
- Tests schreiben

#### Aufgabe 4.2: Editor-Integration (1-2 Stunden)
- Restart-Button im Editor
- Callback an GameRuntime.reset()
- Tests schreiben

#### Aufgabe 4.3: Dokumentation (1-2 Stunden)
- README aktualisieren
- Beispiele hinzufügen
- API-Dokumentation

## Aufwandsschätzung

### Minimal (MVP): 20-30 Stunden
- Phase 1: 8-12 Stunden
- Phase 2: 8-12 Stunden
- Phase 3: 4-6 Stunden (nur wichtige Komponenten)
- Phase 4: 0-2 Stunden (keine UI)

### Vollständig: 28-44 Stunden
- Phase 1: 8-12 Stunden
- Phase 2: 8-12 Stunden
- Phase 3: 8-12 Stunden
- Phase 4: 4-6 Stunden

## Risiken

### Hoch (4-6 Stunden Zusatzaufwand)
- **Singleton-Problem**: GameLoopManager muss separat behandelt werden
- **DOM-Management**: DOM-Elemente müssen neu erstellt werden
- **Timer-Management**: Alle Timer müssen korrekt gestoppt werden

### Mittel (2-3 Stunden Zusatzaufwand)
- **InitialValues Speicherung**: DESIGN_VALUES reicht nicht für alle Properties
- **Komponentenspezifisches Reset**: Manche Komponenten haben komplexe Reset-Logik

### Niedrig (1-2 Stunden Zusatzaufwand)
- **Tests schreiben**: Umfangreiche Tests sind notwendig
- **Bugfixing**: Unvorhergesehene Probleme

## Empfehlung

Beginnen mit **Phase 1 (8-12 Stunden)**, um zu prüfen, ob der Ansatz funktioniert. Wenn Phase 1 erfolgreich ist, mit Phase 2 fortfahren. Phasen 3 und 4 sind optional und können später implementiert werden.

## Erfolgskriterien

### Phase 1
- [ ] TComponent.reset() funktioniert
- [ ] RuntimeVariableManager.reset() funktioniert
- [ ] GameRuntime.reset() funktioniert
- [ ] Tests sind grün

### Phase 2
- [ ] SpritePool.reset() funktioniert
- [ ] GameLoopManager.reset() funktioniert
- [ ] DOM-Elemente werden korrekt zurückgesetzt
- [ ] Timer werden korrekt gestoppt
- [ ] Tests sind grün

### Phase 3
- [ ] TSprite.reset() funktioniert
- [ ] TVariable.reset() funktioniert
- [ ] TTimer.reset() funktioniert
- [ ] TSpriteTemplate.reset() funktioniert
- [ ] Tests sind grün

### Phase 4
- [ ] reset_game Action funktioniert
- [ ] Editor-Integration funktioniert
- [ ] Dokumentation ist vollständig

## Nächste Schritte

1. Phase 1 starten
2. Erfolgskriterien prüfen
3. Phase 2 starten (wenn Phase 1 erfolgreich)
4. Erfolgskriterien prüfen
5. Phase 3 starten (wenn Phase 2 erfolgreich)
6. Erfolgskriterien prüfen
7. Phase 4 starten (wenn Phase 3 erfolgreich)
8. Erfolgskriterien prüfen
