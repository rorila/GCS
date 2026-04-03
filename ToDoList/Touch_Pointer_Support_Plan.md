# Touch & Pointer Support für exportierte Spiele

**Ziel:** Exportierte GCS-Spiele sollen auf Tablets und Smartphones vollständig spielbar sein – insbesondere Puzzle-Spiele mit Drag-Mechanik.

## Strategie: Pointer Events API

Anstatt separate Mouse- und Touch-Handler zu implementieren, nutzen wir die **Pointer Events API**. Diese vereint Maus, Touch und Stift in einem einzigen Event-System:

| Pointer Event     | Ersetzt Mouse-Event  | Ersetzt Touch-Event | GCS Event-Name    |
|-------------------|----------------------|---------------------|--------------------|
| `pointerdown`     | `mousedown`          | `touchstart`        | `onPointerDown`    |
| `pointermove`     | `mousemove`          | `touchmove`         | `onPointerMove`    |
| `pointerup`       | `mouseup`            | `touchend`          | `onPointerUp`      |
| `pointercancel`   | –                    | `touchcancel`       | (intern)           |

**Vorteil:** Der Spiele-Designer muss sich nicht entscheiden – ein einziger Event-Handler funktioniert für Maus UND Touch UND Stift.

## Phase 1: Runtime – Pointer Events im StageRenderer (Standalone)

### Betroffene Dateien
- `src/editor/services/StageRenderer.ts` – DOM-Elemente erhalten Pointer-Listener
- `src/runtime/GameRuntime.ts` – Event-Dispatch um Pointer-Events erweitern
- `src/player-standalone.ts` – Sicherstellen, dass Pointer-Events im Export funktionieren

### Umsetzung
- [ ] Jedes gerenderte Objekt-Element (`el`) bekommt neben dem bestehenden `onclick` auch `onpointerdown`, `onpointermove`, `onpointerup`
- [ ] Diese Events rufen `this.host.onEvent(obj.id, 'onPointerDown', { x, y, pointerId })` auf
- [ ] `GameRuntime.handleEvent()` leitet diese Events an den TaskExecutor weiter (analog zu `onClick`)
- [ ] Auf Touch-Geräten: `touch-action: none` auf der Stage setzen, um Browser-Scroll zu unterbinden

### Neue Event-Daten (übergeben an Tasks/Actions)
```
{
  x: number,          // Position relativ zur Stage
  y: number,
  pointerId: number,  // Welcher Finger (Multi-Touch)
  pointerType: string // 'mouse' | 'touch' | 'pen'
}
```

## Phase 2: Drag & Drop für Puzzle-Spiele

### Neue Action: `drag_object`
- [ ] Action-Typ `drag_object` erstellen
- [ ] Wird im `onPointerDown`-Event eines Objekts ausgelöst
- [ ] Bindet das Objekt an die Fingerposition bis `onPointerUp`
- [ ] Optional: Snap-to-Grid beim Loslassen

### Ablauf im Spiel (User-Perspektive im Flow-Editor)
```
Puzzle-Teil "onPointerDown" → Task "TeilAufheben"
  → Action: drag_object (target: self)

Puzzle-Teil "onPointerUp" → Task "TeilAblegen"
  → Action: snap_to_grid (target: self)
  → Action: check_position (Prüfe ob richtig)
```

## Phase 3: Virtuelles Gamepad (optional, für Action-Spiele)

### Neue Komponente: `TVirtualGamepad`
- [ ] Visuelles On-Screen D-Pad + Action-Buttons
- [ ] Kann vom Designer auf die Stage gezogen werden
- [ ] Sendet intern synthetische KeyboardEvents an die Runtime
- [ ] Konfigurierbar: Welche Tasten werden simuliert (Pfeiltasten, WASD, Leertaste etc.)
- [ ] Nur sichtbar auf Touch-Geräten (`navigator.maxTouchPoints > 0`)

## Phase 4: Editor-Integration

- [ ] Inspector: Pointer-Events als wählbare Events in der Event-Liste anzeigen
- [ ] Flow-Editor: Neue Event-Trigger-Typen für Pointer-Events
- [ ] Dokumentation: `GCS_FEATURE_MAP.md` aktualisieren

## Prioritäts-Reihenfolge

1. **Phase 1** (Pointer Events in Runtime) – Grundvoraussetzung
2. **Phase 2** (Drag & Drop Action) – Puzzle-Spiele ermöglichen
3. **Phase 4** (Editor-Integration) – Designer-Komfort
4. **Phase 3** (Virtuelles Gamepad) – Nice-to-have für Action-Spiele

## Risiken & Hinweise

- **Browser-Support:** Pointer Events werden von allen modernen Browsern unterstützt (Chrome, Safari, Firefox, Edge). Kein Polyfill nötig.
- **Bestehende onClick-Logik:** Bleibt vollständig erhalten. `onclick` funktioniert weiterhin für einfache Taps/Klicks. Pointer-Events sind eine *Ergänzung*, kein Ersatz.
- **Performance:** `pointermove` kann sehr hochfrequent feuern. Im Handler sollte ein Throttle (requestAnimationFrame) eingebaut werden.
- **CSS:** `touch-action: none` auf der Game-Stage verhindert ungewolltes Scrollen/Zoomen des Browsers während des Spielens.

---
*Dieser Plan kann Schritt für Schritt umgesetzt werden. Phase 1 allein reicht bereits für einfache Touch-Interaktionen.*
