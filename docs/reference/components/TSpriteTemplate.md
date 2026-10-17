# TSpriteTemplate

> Generierte Referenzkarte — Quelle: `src/components/TSpriteTemplate.ts`. Neu erzeugen: `node scripts/generate-component-cards.cjs`.

| Feld | Wert |
|---|---|
| ID | `COMP-0098` |
| Kategorie | spiel |
| Basisklasse | TSprite |
| Entwicklungsstatus | implementiert |
| Teststatus | test vorhanden |
| Dokumentationsstatus | Entwurf |
| Editor-Registry (services) | registriert |
| Runtime-Registry (utils, Selbstreg.) | registriert als `TSpriteTemplate` |
| Legacy-Typnamen (typeMapping) | SpriteTemplate |
| Schema-Datei | docs/schemas/schema_game.json |
| Verwendung in Projekten | 8 |
| Server-Methoden | — |
| Umfang | 116 Zeilen |

## Beschreibung

TSpriteTemplate – Blueprint-Vorlage für Object-Pooling. Im Editor sichtbar (zur Konfiguration von Hitbox, Velocity, Aussehen). Zur Laufzeit selbst unsichtbar – stattdessen werden `poolSize` echte TSprite-Instanzen vorhydriert, die über spawn_object/destroy_object aus dem Pool geholt bzw. zurückgegeben werden. Lebenszyklus: Runtime-Start → Pool mit N Instanzen (visible=false, idle) spawn_object  → Pool.acquire() → visible=true, Position setzen destroy_object → Pool.release() → visible=false, Position reset Runtime-Stop  → Pool komplett verworfen

## Inspector-Eigenschaften

| Name | Label | Typ | Gruppe |
|---|---|---|---|
| `poolSize` | Pool Size | string | Pool Settings |
| `autoRecycle` | Auto Recycle | boolean | Pool Settings |
| `lifetime` | Lifetime (Sek.) | number | Pool Settings |

## Ereignisse

`onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave`, `onDragStart`, `onDragEnd`, `onDrop`, `onTouchStart`, `onTouchMove`, `onTouchEnd`, `onFocus`, `onBlur`, `onFlipMidpoint`, `onCollision`, `onCollisionLeft`, `onCollisionRight`, `onCollisionTop`, `onCollisionBottom`, `onBoundaryHit`, `onStageExit`, `onPoolExhausted`

## Öffentliche Methoden

`getInspectorProperties`, `initRuntime`, `onRuntimeStop`, `resetPool`, `getEvents`

## Getter

`hasVisualInspector`

## Verwendete in Projekten

- `game-server\public\projects\LeonasAxolotlSpiel.json`
- `game-server\public\projects\MathePuzzle.json`
- `game-server\public\projects\Mine2D.json`
- `game-server\public\projects\PuzzleNeu.json`
- `game-server\public\projects\SuperMario_Templates.json`
- `game-server\public\projects\UfoShoter4.json`
- `public\test-projects\PuzzleNeu.json`
- `public\test-projects\UfoShoter4.json`

## Test-Erwähnungen

Namensvorkommen in Testskripten (kein Beleg für Testausführung):
- `scripts\test_mario_templates.ts`
- `scripts\test_mine2d.ts`
- `tests\jumpandrun_components.test.ts`
- `tests\nonvisual_inspector.test.ts`
- `tests\puzzle_neu_flow.test.ts`
- `tests\spawn_object_variable.test.ts`
- `tests\sprite_pool.test.ts`
- `tests\sprite_pool_variable.test.ts`

## Quellen

- `src/components/TSpriteTemplate.ts`
- `docs/schemas/schema_game.json`

_Analyse: 2026-10-17 · Commit 53e3dfb · Devin (Cognition) — SWE-2 High_
