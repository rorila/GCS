# Teil B · Kapitel 5 — Dekor-Sprites per Drag-and-drop

> Status: **quellverifizierter Entwurf** — Laufzeit-Drag&Drop (`draggable`,
> `droppable`, `dragMode`, `onDrop`/`onDragEnd`-Payload) ist im Stage-Code
> nachgewiesen; konkrete Klickwege UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels kann das Kind **Deko-Sprites** (Vogel, Blume,
Schaukel) mit der Maus auf den Baum ziehen — die Spielwelt verändert sich
durch eigene Entscheidung, nicht nur durch Lernfortschritt.

## Voraussetzungen

- Kapitel B1–B4 abgeschlossen.

## Verwendete Bausteine — mit Funktionsstatus

| Baustein | Funktion | Status |
|---|---|---|
| **`draggable`** am Deko-Sprite | zur Laufzeit per Maus verschiebbar | ✅ implementiert & quellverifiziert |
| **`droppable`** am Baum | Baum akzeptiert „Abwürfe" | ✅ implementiert & quellverifiziert |
| **Event `onDrop`** am Baum | feuert beim Loslassen über dem Baum | ✅ implementiert & quellverifiziert |
| **`dragMode`** | `move` (verschieben) oder `copy` (Kopie ziehen) | ✅ implementiert & quellverifiziert |
| Automatisches Andocken an Plätze | „Snap" auf Baum-Positionen | 🔧 **Entwicklungsbedarf** — Drop liefert Koordinaten, Einrast-Fachlogik müsste gebaut werden |

*Fachbegriffe:*
- **`draggable`** = „darf gezogen werden"; **`droppable`** = „darf etwas
  empfangen". Beides sind Schalter in der Inspector-Gruppe
  **Interaktion**.
- Das **`onDrop`-Event** bekommt mitgeliefert, *was* abgelegt wurde:
  `draggedName`/`draggedId` plus die Abwurf-Koordinaten `x`/`y` — in
  Bedingungen direkt lesbar.

> **Nachweise:** `StageInteractionManager.ts` — Drag-Start für
> `draggable`-Objekte im Run-Modus (Z. 252–293, inkl. Geist-Kopie bei
> `dragMode:'copy'` Z. 270–278); beim Loslassen wandert das Objekt
> (`onObjectMove`) und feuert `onDrop` auf dem `droppable`-Ziel mit
> Payload `{draggedId, draggedName, draggedObj, x, y}` sowie `onDragEnd`
> am gezogenen Objekt mit `dropTargetId` (Z. 556–608). Serialisierung:
> `TComponent.ts` Z. 115–116, 237–239. EventData-Fallback in Bedingungen:
> `TaskConditionEvaluator.ts` Z. 129–132.

## Bedienungsschritte

### Schritt 1 — Deko-Sprites anlegen

1. Drei Sprites aus **Game → Sprite**: `Vogel`, `Blume`, `Schaukel` —
   am Rand der Stage parken (z. B. unten links).
2. Bei jedem im Inspector unter **Interaktion**:
   - **Draggable** ✅ an
   - **Drag Mode** = `move` *(der Vogel wandert wirklich; wer „unendlich
     viele Blumen" will, nimmt `copy` — dann bleibt das Original liegen
     und eine Kopie wandert)*
3. Dem `Baum` im Inspector **Droppable** ✅ geben.

### Schritt 2 — Reaktion `AufBaumGelegt`

1. Flow → Task `AufBaumGelegt` anlegen.
2. `Baum` auswählen → Tab **Events** → `onDrop` → `AufBaumGelegt`.
3. Im Task eine **Bedingung**, die erkennt, *was* abgelegt wurde — der
   gezogene Name steht im Event als `draggedName`:

```text
AufBaumGelegt
 └─ 💎 draggedName == "Vogel" ──wahr──▶ 🔔 Toast „Der Vogel singt! 🐦"
     │falsch
     └─ 💎 draggedName == "Blume" ──wahr──▶ 🔔 Toast „Es blüht! 🌸"
         │falsch
         └─ 🔔 Toast „Schön dekoriert!"
```

> **Nachweis:** `draggedName` kommt aus dem `onDrop`-Payload
> (`StageInteractionManager.ts` Z. 588–593); die Bedingungs-Auswertung
> findet Event-Daten automatisch (`resolveVarPath` eventData-Fallback,
> Z. 129–132).

`[SCREENSHOT FEHLT: Baum mit Droppable-Markierung + Vogel beim Ziehen]`

### Schritt 3 — (Optional) Verbleib regeln

Das Deko-Objekt bleibt einfach liegen, wo es losgelassen wurde. Wer es
**am Stamm verankern** will, hängt hinter die Bedingung eine
`move_to`-Aktion („Bewegen zu": Ziel = `${draggedName}`, feste
Koordinaten im Baum) — Nachweis: `move_to` in den Action-Metadaten.

## Erwartetes Ergebnis

Vogel/Blume/Schaukel lassen sich im Run-Modus greifen und auf den Baum
legen; beim Abwurf entscheidet `draggedName`, welche Reaktion die Welt
zeigt. Die Entscheidung liegt beim Kind — kein Schwellwert nötig.

## Selbst prüfen (Funktionsprüfung)

- [ ] `Vogel`, `Blume`, `Schaukel`: `draggable` ✅
- [ ] `Baum`: `droppable` ✅, Events-Tab `onDrop → AufBaumGelegt`
- [ ] Bedingungen lesen `draggedName`
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **Ziehen klappt nicht** → `draggable` am *Deko*-Objekt (nicht am Baum);
  außerdem greift Drag nur im **Run**-Modus — im Editor ziehst du Objekte
  zum Bauen.
- **Baum reagiert nicht** → `droppable` am Baum + `onDrop` muss an den
  Task gebunden sein.
- **`draggedName` leer in der Bedingung** → exakt so schreiben
  (klein `d` am Anfang, großes `N` in der Mitte).
- **Sprite rutscht unter den Baum** → Deko-Sprites sind evtl. Kinder des
  Hintergrund-Panels (wie in Kap. 3) — für Drag am besten **nicht** aufs
  Panel legen, sondern daneben.

## Was du gelernt hast

✔ Laufzeit-Drag&Drop mit `draggable`/`droppable`/`dragMode`
✔ `onDrop`-Payload (`draggedName`, Koordinaten) in Bedingungen lesen
✔ Weltreaktionen durch freie Entscheidung (ohne Lernfortschritt)
✔ Grenze kennengelernt: automatisches Einrasten ist Entwicklungsbedarf

## Funktionsstatus dieses Kapitels

| Feature | Status |
|---|---|
| Objekte zur Laufzeit ziehen/ablegen | ✅ implementiert & quellverifiziert |
| Kopie-Modus (`dragMode: copy`) | ✅ implementiert & quellverifiziert |
| `onDrop`-Reaktionen je Sprite | ✅ implementiert & quellverifiziert |
| Automatisches Snap-in-Slots im Baum | 🔧 Entwicklungsbedarf (kein eingebauter Slot-Mechanismus; `move_to` als manueller Ersatz) |
| Touch-Drag auf Tablets | 🟡 teilweise — Pointer-Drag vorhanden, Touch-Pfade nicht verifiziert |

## Medien-Vorschlag

**Video (ca. 60 s):** „Zieh den Vogel auf den Baum"
**Sprecher-Drehbuch:** „Jetzt darf das Kind selbst gestalten: Vogel, Blume,
Schaukel — alle bekommen den Schalter Draggable. Der Baum bekommt
Droppable und ein onDrop-Ereignis. Wird etwas abgelegt, schaut die
Bedingung: Wer war es? Beim Vogel singt es, bei der Blume blüht es.
Freie Entscheidung, sichtbare Wirkung."
**Sync-Hinweise:** Interaktions-Schalter im Inspector einblenden; Drag-Geste
in Echtzeit zeigen; `draggedName`-Bedingung im Flow groß.

## Nächstes Kapitel

[Kapitel B6 — Selbst entscheiden: Neustart](b-kapitel-06-neustart.md) —
nach dem Ziel wählt das Kind, ob es von vorn beginnt.

---

*Quellen: `src/editor/services/StageInteractionManager.ts`
(Z. 252–293, 556–608), `src/components/TComponent.ts` (Z. 115–116,
131–133, 237–239), `src/runtime/executor/TaskConditionEvaluator.ts`
(Z. 129–132), `docs/inventory/action-metadata.json` (`move_to`).*
