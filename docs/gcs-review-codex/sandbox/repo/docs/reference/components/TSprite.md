# TSprite

> **Kuratierte Referenzkarte** (Qualitätsvorlage) — `docStatus: technisch geprüft`.
> `manualReview: true` im Inventar; `generate-component-cards.cjs` überschreibt sie nicht (außer mit `--force`).

| Feld | Wert |
|---|---|
| ID | `COMP-0097` |
| Kategorie | spiel |
| Vererbungskette | `TSprite` → `TWindow` → `TComponent` |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden (u. a. `tests/component_events.test.ts`; dedizierter Physik-Test nicht belegt) |
| Dokumentationsstatus | technisch geprüft |
| Registrierung | Editor-Registry ✔ · Runtime-Factory ✔ (`'TSprite'`), Legacy-Alias `Sprite` |
| Schema | `docs/schemas/schema_game.json` |
| Umfang | `src/components/TSprite.ts` — 417 Zeilen |

## Zweck

Das zentrale Spielelement: bewegliches Bild-/Video-Objekt mit Physik
(`velocityX/Y`, `gravity`), Kollision (Form `shape`, `collisionGroup`,
konfigurierbare Hitbox), Sprite-Sheet-Ausschnitten (`sourceRect*`,
`imageListId`/`imageIndex`), Animation (`animationId` → `TAnimation`) und
Pool-/Template-Unterstützung (`templateId`, `isPoolInstance` — vgl.
`src/runtime/actions/handlers/ObjectPoolActions.ts`).

## Eigene Inspector-Eigenschaften (Auszug)

Gruppen: **Motion** (`spawnX/Y`, `spawnWidth/Height`, `velocityX/Y`, `gravity`,
`lerpSpeed`), **Kollision/Physik** (`collisionGroup`, `pushOutOnCollision`,
`customHitbox`, `hitboxShape/OffsetX/Y/Width/Height`), **Bild** (`appearanceMode`,
`imageListId`, `imageIndex`, `sourceWidth/Height`, `sourceRectX/Y/Width/Height`,
`puzzleEdges`, `puzzleTabDepth`, `matchValue`), **Video** (`videoSource`,
`videoObjectFit`, `videoAutoplay`, `videoLoop`, `videoMuted`, `videoVolume`,
`videoPlaybackRate`), **Template/Pool** (`templateId`, `templateName`).

## Geerbte Inspector-Eigenschaften

**von `TWindow`:** Geometrie (`x`, `y`, `width`, `height`, `zIndex`, `rotation`,
`align`), `visible`, `collisionEnabled` (Basis-Schalter, unabhängig von der
Sprite-Hitbox), `protectFromOverlay`, `style.*`, `description`.
**von `TComponent`:** `name`, `draggable`, `droppable`, `dragMode`.

## Ereignisse

**Eigen** (`TSprite.getEvents()`, Z. ~340): `onEnter`, `onImageReady`,
`onImageError`, `onCollision`, `onCollisionLeft`, `onCollisionRight`,
`onCollisionTop`, `onCollisionBottom`, `onBoundaryHit`, `onStageExit`.

**Geerbt:** Standard-UI-Ereignisse aus `TComponent` (`onClick`, `onDrag*`,
`onTouch*`, …) plus `onFocus`/`onBlur`/`onFlipMidpoint` aus `TWindow`.

## Runtime-Verdrahtung

- Bewegung/Physik: `src/runtime/GameLoopManager.ts`, `update()`/`smoothSync()` in `TSprite`
- Kollision: `src/runtime/CollisionManager.ts` (richtet `onCollision*`/`onBoundaryHit`)
- Animation: `src/runtime/AnimationManager.ts` (`animationId` ↔ `TAnimation`)
- Editor-Rendering: `src/editor/services/renderers/SpriteRenderer.ts`
- Pool-Instanzen: `src/runtime/actions/handlers/ObjectPoolActions.ts` (`TSpawner`)

## Verwendung

Sprites erscheinen in den meisten Spielprojekten (`PingPong`, `Snake`,
`Tetris`, `Madn`, `LeonasAxolotlSpiel`, Lernprojekte). Multiplayer-relevant:
`smoothSync`/`renderX/renderY` interpolieren entfernte Positionen
(`lerpSpeed`), vgl. `src/multiplayer/InputSyncer.ts`/`CollisionSyncer.ts`.

## Einschränkungen / Offene Fragen

- `puzzleEdges`/`puzzleTabDepth`/`matchValue` sind Spezialfelder für
  `TPuzzleBoard`-Zusammenspiel — Semantik in AP 5 vertiefen.
- ⚠ Vollständige Liste der ~40 Inspector-Felder: siehe generierte Karte
  (vorheriger Stand) bzw. `getInspectorProperties()` in `TSprite.ts`.

## Quellen

- `src/components/TSprite.ts` (417 Z.)
- `src/runtime/CollisionManager.ts`, `src/runtime/AnimationManager.ts`, `src/runtime/GameLoopManager.ts`
- `src/runtime/actions/handlers/ObjectPoolActions.ts`
- `src/editor/services/renderers/SpriteRenderer.ts`
- `docs/schemas/schema_game.json`

_Analyse: 2026-10-17 · Commit `53e3dfb` + Arbeitsstand · Devin (Cognition) — SWE-2 High_
