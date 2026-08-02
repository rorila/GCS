# Jump & Run Endless Runner — Implementierungs-Zusammenfassung

Diese Datei fasst die vier Schritte zusammen, die umgesetzt wurden, um ein Jump & Run Endless Runner Spiel zu unterstützen.

---

## Schritt 1: `TParallaxBackground` — Parallax-Hintergrund

**Datei:** `src/components/TParallaxBackground.ts`

- Mehrere scrollende Hintergrund-Ebenen mit individuellem `speedFactor`
- Lokale Zeit-Integration (`baseSpeed * deltaTime`)
- Optionaler `scrollSource` für exakte Multiplayer-Synchronisation

**Verwendung:**

```typescript
agent.addObject('stage_main', {
  className: 'TParallaxBackground', name: 'Bg',
  x: 0, y: 0, width: 64, height: 40,
  baseSpeed: 5,
  layers: [
    { image: 'sky.png', speedFactor: 0.1, y: 0, height: 40 },
    { image: 'mountains.png', speedFactor: 0.4, y: 0, height: 40 },
    { image: 'ground.png', speedFactor: 1.0, y: 0, height: 40 }
  ],
  scrollSource: '${gameTime}' // optional für Multiplayer
});
```

---

## Schritt 2: `TSpawner` — Object Pooling für Plattformen/Hindernisse

**Datei:** `src/components/TSpawner.ts`

- Spawnt Instanzen aus einem `TSpriteTemplate`
- Konfigurierbares Spawn-Intervall, Position, zufällige Y-Lage
- Off-Screen-Recycling für Endless-Runner-Flow
- Optionale Velocity-Überschreibung

**Verwendung:**

```typescript
agent.addObject('stage_main', {
  className: 'TSpawner', name: 'PlatformSpawner',
  x: 0, y: 0, width: 4, height: 2,
  templateName: 'PlatformTemplate',
  spawnInterval: 1.5,
  spawnX: 70, spawnYMin: 30, spawnYMax: 34,
  velocityX: -4,
  recycleOffScreen: true
});
```

---

## Schritt 3: Kamera-Shake & Speedlines

### `shake_screen` Action

**Datei:** `src/runtime/actions/handlers/EffectActions.ts`

- CSS-Keyframe-Shake auf dem Stage-Viewport
- Intensitäten: `light`, `medium`, `heavy`
- Dauer in Millisekunden konfigurierbar

**Verwendung:**

```typescript
agent.addAction('LandShake', 'shake_screen', 'OnHardLanding', {
  intensity: 'medium',
  duration: 250
});
```

### `TSpeedlines` Overlay

**Datei:** `src/components/TSpeedlines.ts`

- Animierter Geschwindigkeits-Effekt über die ganze Stage
- Konfigurierbare Anzahl, Farbe, Geschwindigkeit, Liniengröße und Overlay-Deckkraft

**Verwendung:**

```typescript
agent.addObject('stage_main', {
  className: 'TSpeedlines', name: 'Speedlines',
  x: 0, y: 0, width: 64, height: 40,
  visible: false, zIndex: 500,
  lineCount: 16, speed: 0.3,
  lineColor: 'rgba(255,255,255,0.7)',
  overlayOpacity: 0.1
});

// Ein-/Ausschalten per Property-Action:
agent.addAction('ShowSpeedlines', 'property', 'ShowSpeedlines', {
  target: '', changes: { 'Speedlines.visible': true }
});
```

---

## Schritt 4: Tests

**Datei:** `tests/jumpandrun_components.test.ts`

Abgedeckte Szenarien:

1. Registrierung aller drei neuer Komponenten
2. Parallax-Scroll mit lokaler Zeit
3. `scrollSource`-Binding für Multiplayer-Sync
4. `TSpawner` Spawn & Recycle
5. `TSpeedlines` Eigenschaften
6. `shake_screen` Action-Registrierung

**Ausführung:**

```powershell
npx tsx tests/jumpandrun_components.test.ts
```

oder über den zentralen Runner:

```powershell
npm test
```

---

## Integration in Editor & Runtime

- `src/editor/services/StageRenderer.ts` — Rendering-Handler für `TParallaxBackground`, `TSpawner`, `TSpeedlines`
- `src/runtime/GameRuntime.ts` — Weitergabe von `spawnObject` / `destroyObject` an Runtime-Komponenten
- `src/runtime/GameLoopManager.ts` — Aufruf von `onRuntimeUpdate` für alle Runtime-Komponenten
- `src/runtime/actions/StandardActions.ts` — Registrierung der neuen `EffectActions`
- `src/editor/Stage.ts` — Stage-Viewport bekommt `.gcs-stage-element` für den Shake-Effekt

---

## Dokumentation

- `docs/AGENT_API_REFERENCE.md` — Aktualisierte Komponenten-Steckbriefe und Komponenten-Zählung
- `docs/JumpAndRun_BestPractice_Guide.md` — Schritt-für-Schritt Best Practices
- `docs/JumpAndRun_EndlessRunner_Guide.md` — Endless Runner Spezialguide

---

## Nächster Schritt

Ein konkretes Jump & Run Spiel bauen: Player, Sprungmechanik, Hindernisse, Score, Game Over.
