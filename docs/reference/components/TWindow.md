# TWindow

> **Kuratierte Referenzkarte** — `docStatus: technisch geprüft` · Quelle: `src/components/TWindow.ts`

| Feld | Wert |
|---|---|
| ID | `COMP-xxxx` (siehe FEATURE-INVENTORY) |
| Kategorie | basis |
| Basisklasse | `TComponent` |
| Vererbungskette | `TWindow → TComponent` |
| Entwicklungsstatus | implementiert |
| Registry | Editor + Runtime registriert |

## Zweck

Visuelle Basisklasse aller auf einer Stage platzierbaren Komponenten. Besitzt
Geometrie (x/y/width/height), `ComponentStyle` (Farben, Rahmen, Schatten,
Font, `borderRadius`, `opacity`, Glow, Box-Shadow mit Offset/Blur/Spread/Inset),
`align`-Docking (`NONE|TOP|BOTTOM|LEFT|RIGHT|CLIENT`) und Sichtbarkeit.

## Eigene Events (zusätzlich zu `TComponent`)

`onFocus`, `onBlur`, `onFlipMidpoint` (Z. 208–215).
**Sonderregel:** ist `isHiddenInRun` gesetzt, liefert `getEvents()` ein
**leeres** Array — unsichtbare Komponenten können zur Laufzeit nicht
angeklickt/fokussiert/gedraggt werden (UI-Events ausgeblendet).

## Wichtiges Verhalten

- `applyChange('align', …)` erzwingt einen **vollständigen Inspector-Re-Render**,
  weil der Align-Setter x/y/width/height verändert (Z. 222–225).
- Geometrie-Constraints werden dynamisch aus der Stage-`GridConfig` berechnet —
  eine Komponente muss vollständig auf der Stage liegen (min/max).
- `toDTO()` serialisiert für Projekt-JSON.

## Einschränkungen

- Keine eigene Render-Logik — abgeleitete Klassen (TPanel, TTextControl, …)
  oder der Runtime-Renderer zeichnen.
- `align`-Werte sind Großbuchstaben-Konstanten; Legacy-JSON mit Kleinschreibung
  wird toleriert, aber nicht kanonisiert.

## Beispiel (Projekt-JSON)

```json
{ "type": "TWindow", "name": "Panel1", "x": 2, "y": 2,
  "width": 10, "height": 4,
  "style": { "backgroundColor": "#222", "borderRadius": 8, "opacity": 0.9 } }
```

## Quellen

- `src/components/TWindow.ts` (ComponentStyle Z. 3–33, getEvents Z. 208–215, applyChange Z. 222–225)

_Analyse: 2026-10-17 · Commit 53e3dfb + Worktree · Devin (Cognition) — SWE-2 High_
