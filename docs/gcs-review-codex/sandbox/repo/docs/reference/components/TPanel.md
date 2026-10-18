# TPanel

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TPanel.ts`

| Feld | Wert |
|---|---|
| Kategorie | basis / container |
| Vererbungskette | `TPanel → TWindow → TComponent` |
| Entwicklungsstatus | implementiert |
| Kinder-Verwaltung | `TGroupPanel` (ableitend) für logische Gruppen |

## Zweck

Generischer **Container** für andere Komponenten — trägt Position/Größe und
optionale **Grid-Anzeige** (`showGrid`, `gridColor`, `gridStyle: 'lines'|'dots'`).
Panels werden vom `GameLoopManager` separat registriert (Z. 124) — sie sind
**Layout-Träger**, keine Sprites.

## Eigene Eigenschaften

| Name | Typ | Zweck |
|---|---|---|
| `showGrid` | boolean | Hilfslinien ein/aus |
| `gridColor` | string | Linienfarbe (default `#000000`) |
| `gridStyle` | `'lines'\|'dots'` | Raster-Darstellung |

## Verhalten

- „Default style wird nun über ThemeRegistry gesteuert" (Kommentar Z. 8) —
  Panel-Optik kommt aus `ThemeRegistry`, nicht aus hartkodierten Defaults.
- Panels sind Rendering-Container: Kinder werden relativ zur Panel-Position
  gezeichnet (Editor: Verschachtelung in der Objektliste).

## Einschränkungen

- Kein eigenes Clipping/Overflow-Verhalten dokumentiert — Kinder können über
  den Rand hinausragen.
- `showGrid` ist ein Editor-/Debug-Hilfsmittel, kein Spielfeature.

## Beispiel

```json
{ "type": "TPanel", "name": "HUD", "x": 0, "y": 0, "width": 32, "height": 2,
  "showGrid": false }
```

## Quellen

- `src/components/TPanel.ts` (grid-Felder Z. 2–30)
- `src/runtime/GameLoopManager.ts` Z. 124, `src/runtime/ThemeRegistry.ts`

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
