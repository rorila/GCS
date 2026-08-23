# Implementierungsplan: Dirty-Frame + Fast-Path für Sprite-Animationen

## 1. Ausgangslage

Aktuelle Performance-Metriken beim animierten Spiel:

```
spr 0.4, upd 154, anim 0.0, interp 0.1, coll 0.6, dom 1.4,
steps 2.83, sprites 35
```

- `anim 0.0` zeigt: die reine Frame-Berechnung in `TAnimation.onRuntimeUpdate` ist fast gratis.
- `upd 154` zeigt: die Folgekosten sind enorm, weil jeder Bildwechsel über `sprite.image` einen vollständigen Sprite-Render auslöst.
- Schaltet man Animationen ab, sinkt JS massiv, weil der Loop schlafen kann (`needsUpdate` wird unwahr).

**Kernproblem:** Nicht das Erkennen des Frame-Wechsels ist teuer, sondern die *Reaktion* darauf: `SpriteRenderer.render()` baut das Sprite-DOM jedes Mal neu auf.

## 2. Ziel

- Animations-Frame-Wechsel werden am Ende eines Display-Frames *einmalig* abgearbeitet.
- Jeder Bildwechsel aktualisiert nur `background-image` und `background-position`, nicht das ganze Sprite.
- `upd` soll deutlich unter `10 ms` sinken (aktuell `154 ms`).

## 3. Grundidee

**Dirty-Frame:** `TAnimation` trägt Sprites, deren Bild sich ändert, in eine zentrale Liste ein. Der eigentliche Render passiert erst im `dom`-Teil des Game-Loops in einem Durchlauf.

**Fast-Path:** Statt `SpriteRenderer.render()` aufzurufen, rechnet `StageRenderer` aus der `imageList` und dem neuen Frame-Index direkt `background-image` und `background-position` aus und setzt sie auf dem bestehenden DOM-Element.

## 4. Betroffene Dateien

- `src/runtime/GameLoopManager.ts`
- `src/components/TAnimation.ts`
- `src/runtime/GameRuntime.ts`
- `src/editor/services/StageRenderer.ts`
- `src/player-standalone.ts`

## 5. Schritte

### 5.1 Zentrale Dirty-Sprite-Verwaltung einführen

Ort: `src/runtime/GameRuntime.ts`

Aktuell löst der globale Listener bei `image`-Änderungen direkt `requestRender()` aus. Stattdessen markiert er den Sprite nur noch als dirty.

```ts
private dirtySprites: Set<TSprite> = new Set();

public markSpriteDirty(sprite: TSprite): void {
    this.dirtySprites.add(sprite);
}

public getAndClearDirtySprites(): TSprite[] {
    const sprites = Array.from(this.dirtySprites);
    this.dirtySprites.clear();
    return sprites;
}
```

Der globale Listener bei `image`-Änderungen ruft `markSpriteDirty(sprite)` statt `requestRender()`.

Bei Positionsänderungen kann weiterhin `requestRender()` oder ein separates `dirtyPositions`-Set genutzt werden.

### 5.2 GameLoop sammelt Dirty-Sprites

Ort: `src/runtime/GameLoopManager.ts`, Methode `loop()`

- Nach `updateRuntimeUpdatables` und `AnimationManager.update()` werden alle Sprites gesammelt, deren Bild sich in diesem Frame geändert hat.
- Diese Liste wird an den `dom`-Callback übergeben, nicht einzeln pro Sprite.

```ts
// nach updateRuntimeUpdatables / AnimationManager.update
const dirtySprites = this.gameRuntime.getAndClearDirtySprites();

// im dom-Teil
PerfOverlay.phaseBegin('dom');
if (this.spriteRenderCallback) {
    this.spriteRenderCallback(dirtySprites, this.sprites);
}
// ...
```

### 5.3 TAnimation verzichtet auf sofortiges Rendern

Ort: `src/components/TAnimation.ts`, Methode `onRuntimeUpdate`

- Wenn der Frame wechselt, setzt `TAnimation` `sprite.image` (oder `currentFrame`) und ruft `this.gameRuntime.markSpriteDirty(sprite)` auf.
- Direkte `requestRender()`-Aufrufe in `TAnimation` entfallen.

```ts
public onRuntimeUpdate(deltaTime: number): void {
    if (!this.isRunning) return;

    this.elapsed += deltaTime;
    const nextFrame = Math.floor(this.elapsed / this.frameDuration) % this.frames.length;

    if (nextFrame !== this.lastAppliedFrame) {
        this.lastAppliedFrame = nextFrame;
        this.targetSprite.image = this.frames[nextFrame];
        this.gameRuntime.markSpriteDirty(this.targetSprite);
    }
}
```

### 5.4 Fast-Path für Sprite-Frames in StageRenderer

Ort: `src/editor/services/StageRenderer.ts`

- Neue Methode `updateSpriteFrames(sprites: TSprite[])`.
- Pro Sprite:
  1. `imageList` und aktueller Frame auflösen.
  2. Berechne `background-image` und `background-position` aus den Frame-Definitionen.
  3. Setze beide CSS-Eigenschaften direkt auf dem bereits existierenden DOM-Element.
  4. Nur bei Größenänderung, Sichtbarkeit oder fehlendem DOM-Element auf `SpriteRenderer.render()` zurückfallen.

```ts
public updateSpriteFrames(sprites: TSprite[]): void {
    for (const sprite of sprites) {
        this.updateSpriteFrameFast(sprite);
    }
}

private updateSpriteFrameFast(sprite: TSprite): void {
    const el = this.getSpriteElement(sprite);
    if (!el) {
        this.spriteRenderer.render(sprite); // First render
        return;
    }

    const imageList = this.resolveImageList(sprite);
    const frame = imageList.frames[imageList.currentIndex];

    if (!frame) return;

    // Bei Größenänderung vollständig rendern
    if (frame.width !== sprite.width || frame.height !== sprite.height) {
        this.spriteRenderer.render(sprite);
        return;
    }

    el.style.backgroundImage = `url('${frame.url}')`;
    el.style.backgroundPosition = `${-frame.x}px ${-frame.y}px`;
    el.style.width = `${frame.width}px`;
    el.style.height = `${frame.height}px`;
}
```

### 5.5 player-standalone.ts anpassen

Ort: `src/player-standalone.ts`, Methode `renderSpritesOnly` / `onComponentUpdate`

- Der Callback erhält die `dirtySprites`-Liste.
- Für diese ruft er `stageRenderer.updateSpriteFrames(dirtySprites)` auf.
- Positions-Updates laufen weiterhin über `stageRenderer.updateSpritePositions(...)`.

```ts
public renderSpritesOnly(dirtySprites: TSprite[]): void {
    if (dirtySprites.length > 0) {
        this.stageRenderer.updateSpriteFrames(dirtySprites);
    }
    // Positions-Updates optional in einem separaten Pfad
    this.stageRenderer.updateSpritePositions(this.gameState.sprites);
}
```

## 6. Optionale Erweiterung: Animation aus dem Fixed-Step herausziehen

- `TAnimation.onRuntimeUpdate` wird aktuell pro Fixed-Step aufgerufen.
- Bei `steps > 1` wird dieselbe Prüfung mehrfach pro Display-Frame ausgeführt.
- Lösung: `TAnimation` einmal pro Display-Frame aktualisieren und die *reale* vergangene Zeit seit dem letzten Frame übergeben.

Diese Maßnahme ist *nicht* zwingend nötig, wenn Dirty-Frame + Fast-Path greifen, aber sie reduziert redundante Berechnungen weiter.

## 7. Tests und Verifikation

### Performance

- `upd` sollte deutlich sinken (Ziel: `< 10 ms` bei 35 Sprites).
- `dom` sollte stabil oder leicht sinken.
- `js` total sollte von `160 ms` deutlich unter `30 ms` kommen.

### Funktionalität

- [ ] Animationen laufen weiterhin flüssig.
- [ ] Verschiedene Animationsgeschwindigkeiten funktionieren.
- [ ] Pause / Wake rendert initial korrekt.
- [ ] Sofortige Positionsänderungen (z.B. per Tastatur) bleiben sichtbar.
- [ ] Sprites mit unterschiedlichen Bildgrößen pro Frame rendern korrekt.
- [ ] Untracked / neu gespawnte Sprites rendern beim ersten Mal vollständig.

## 8. Risiken und Hinweise

- **DOM-Element-Mapping:** `StageRenderer` muss das DOM-Element eines Sprites schnell auflösen können. Bei Fehlen muss ein Full-Render stattfinden.
- **Größenänderungen:** Bildwechsel mit unterschiedlichen Frame-Größen erfordern weiterhin einen vollständigen Render, weil `width`, `height` und Bounds neu berechnet werden müssen.
- **Dirty-Set-Race:** Das Dirty-Set muss am Beginn jeder `dom`-Phase geleert werden, damit keine Sprites aus einem vorherigen Frame hängen bleiben.
- **Schlafen der Loop:** Der Loop darf nicht schlafen, wenn Dirty-Sprites vorhanden sind (`needsUpdate` muss wahr bleiben, solange Sprites dirty sind).

## 9. Fazit

Die Kombination aus **Dirty-Frame-Sammlung** und **Fast-Path für Bildwechsel** greift genau die Stelle, die in den Messungen `upd 154 ms` verursacht. Sie verhindert redundante vollständige Sprite-Renders und ersetzt sie durch gezielte CSS-Updates. Sie ist der effizienteste erste Optimierungsschritt.
