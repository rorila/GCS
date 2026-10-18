# Kapitel 8 — Der Flow-Editor im Detail

> Status: **quellverifizierter Entwurf** — alle Elemente im Code
> nachgewiesen; Feinbedienung (Ziehen, Löschen) noch UI-ungeprüft.
> 2026-10-17

## Lernziel

Am Ende dieses Kapitels kennst du alle Bausteine und Werkzeuge des
Flow-Editors: Kästchen-Sorten, Pfeile, Anker, die eigene Flow-Werkzeugleiste
— und welche Elemente du (noch) nicht anfassen solltest.

## Voraussetzungen

- Kapitel 1–7 abgeschlossen; im Projekt existiert die Kette
  `Giessen → WasserPlus1 → Bedingung → BaumWaechst`.

## Verwendete Bausteine

| Baustein | Was er tut | Woher |
|---|---|---|
| **Flow-Toolbox** | Werkzeugleiste „Flow Logic" in der linken Leiste | automatisch sichtbar im Flow-Tab |
| **Knoten-Kontextmenü** | Rechtsklick auf freie Fläche | Flow-Zeichenfläche |
| **Anker-Punkte** | An-/Abschlüsse für Pfeile an jedem Kästchen | am Kästchen-Rand |

## Die Flow-Toolbox (linke Leiste)

Im Tab **Flow** zeigt die linke Leiste statt der Komponenten-Toolbox die
**„Flow Logic"-Liste** — mit Klick oder Drag&Drop legst du Kästchen an:

| Element | Symbol | Zweck |
|---|---|---|
| Task | ⚡ | Startpunkt einer To-do-Liste |
| Action | 🎬 | Einzelner Schritt |
| If Condition | ❓ | Ja/Nein-Verzweigung |
| For Loop / ForEach / While | 🔁🔄🔂 | Wiederholungen (fortgeschritten) |
| **Repeat Loop** | ⏭️ | ⚠️ **ohne Wirkung — nicht benutzen** (TD-009) |
| Variable | 📦 | Task-lokale Variable |
| Pfeil | 🔗 | Freie Verbindung |
| Notiz | 📝 | Kommentar-Kästchen |

*Sonderfall:* „HTTP Request" und „Data Action" erscheinen **nur**, wenn das
Projekt einen `TGameServer` enthält — bei unserem Baum-Projekt fehlen sie
also (normal).

> **Nachweis:** `FlowToolbox.ts` Z. 22–45 — Itemliste, Server-Bedingung,
> Klick/DnD (Z. 81–93).

`[SCREENSHOT FEHLT: Flow-Toolbox „Flow Logic" mit allen Einträgen]`

## Die Zeichenfläche

- **Kästchen verschieben:** mit gedrückter Maustaste am Kästchen ziehen —
  Pfeile folgen mit.
- **Anker:** kleine Punkte am Kästchen-Rand. Oben/Eingang nimmt Pfeile auf,
  unten/Ausgang startet sie. Bedingungen haben zusätzlich **Wahr**- und
  **Falsch**-Anker.
- **Pfeil löschen:** Pfeil anklicken (markiert) → Entf-Taste
  *(UI-ungeprüft — `deleteConnection` ist im Code vorhanden,
  `FlowEditor.ts` Z. 791; Tastenweg beim Praxistest bestätigen).*
- **Kästchen löschen:** Kästchen markieren → Entf — oder Inspector-Fußzeile
  **Löschen** (rot).
- **Zoom/Übersicht:** vorhandene Zoom-Steuerung UI-ungeprüft — bei großen
  Aufgaben ggf. seitlich scrollen.

> **Nachweis:** Knoten-Drag und Anker-Magnetik in
> `FlowInteractionManager.ts` (Z. 237–506); Löschen via Inspector-Fußzeile
> in `inspector_action.json` (`DeleteBtn`).

## Bedienungsschritte — Übung: Aufräumen

1. Tab **Flow**: Ziehe die vier Kästchen ordentlich in eine Reihe —
   `Giessen` ganz links, dann `WasserPlus1`, dann die Bedingung, dann
   `BaumWaechst`.
2. Füge eine **Notiz** hinzu (Toolbox „📝 Notiz" oder Rechtsklick) mit dem
   Text „Erst gießen, dann wachsen" und stelle sie über die Kette.
3. Prüfe die Pfeile: jeder Pfeil zeigt in Laufrichtung (von `Giessen` weg).

## Erwartetes Ergebnis

Ein aufgeräumtes Flussdiagramm: `Giessen → WasserPlus1 → [Wasser >= 3?]
→(wahr)→ BaumWaechst`, plus eine erklärende Notiz darüber.

## Selbst prüfen (Funktionsprüfung)

- [ ] Alle vier Kästchen sind sichtbar und in Leserichtung angeordnet
- [ ] Die Notiz ist sichtbar
- [ ] Pfeile sind nach dem Verschieben noch verbunden
- [ ] **Datei → Projekt Speichern** meldet Erfolg

## Typische Stolpersteine

- **„Repeat Loop" sieht nützlich aus** → ist wirkungslos (TD-009);
  für Wiederholungen **While** verwenden.
- **Pfeil löscht Kästchen nicht mit** → Pfeile und Kästchen sind getrennte
  Elemente; beide einzeln markieren/löschen.
- **Kästchen doppelt angelegt** → markieren und löschen; Speichern nicht
  vergessen.

## Was du gelernt hast

✔ Die Flow-Toolbox und ihre Elemente
✔ Kästchen ordnen, Pfeile ziehen, Notizen setzen
✔ Welche Elemente (noch) nicht funktionieren (Repeat)
✔ Serverabhängige Einträge (HTTP/Data Action) verstehen

## Medien-Vorschlag

**Video (ca. 40 s):** „Der Flow-Editor — Kästchen und Pfeile"
**Sprecher-Drehbuch:** „In der Flow-Ansicht sehen wir unsere Spiellogik als
Bild. Links liegt die Werkzeugleiste Flow Logic: Tasks, Aktionen,
Bedingungen, Notizen. Kästchen verschieben wir einfach mit der Maus, die
Pfeile folgen automatisch. Achtung: Den Baustein Repeat Loop lassen wir
weg — der tut in dieser Version noch nichts."
**Sync-Hinweise:** Schnitt auf Toolbox-Hover, Drag eines Kästchens,
Markieren der Notiz; eingeblendetes Warnschild beim Repeat-Eintrag.

## Nächstes Kapitel

**Kapitel 9 — Bilder wechseln: Wachstumsstufen** *(in Vorbereitung)* — der
Baum verändert je nach Wasserstand Aussehen und Größe.

---

*Quellen: `src/editor/FlowToolbox.ts` (Z. 14–106),
`src/editor/services/FlowInteractionManager.ts` (Z. 237–506),
`src/editor/FlowEditor.ts` (Z. 787–793), `docs/inventory/TECHNICAL-DEBT.md`
(TD-009).*
