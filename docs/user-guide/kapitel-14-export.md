# Kapitel 14 — Speichern & Export

> Status: **quellverifizierter Entwurf** — Menüpunkte und Aktionen sind in
> `menu_bar.json` / `EditorMenuManager` nachgewiesen; Download-Verhalten
> UI-ungeprüft. 2026-10-17

## Lernziel

Am Ende dieses Kapitels ist das Projekt sicher gespeichert und als
**ZIP-Paket exportiert** — fertig für den Upload ins CMS oder zum
Weitergeben.

## Voraussetzungen

- Kapitel 1–13 abgeschlossen (fertiges, getestetes Spiel).

## Verwendete Bausteine

| Baustein | Was er tut |
|---|---|
| **Datei → Projekt Speichern** | Schreibt die Projektdatei |
| **Datei → Speichern unter…** | Speichern mit neuem Namen/Pfad |
| **Plattform → Export als ZIP (CMS-Upload)** | Paket für die CMS-Galerie |
| **Plattform → Export als HTML/JSON** | Alternative Ausgaben |

*Fachbegriff:* **Export** = dein Projekt wird in ein Format gepackt, das
andere Systeme (Webbrowser, CMS) verstehen — ohne dass sie den Editor
brauchen.

## Bedienungsschritte

### Schritt 1 — Speichern

1. **Datei → Projekt Speichern** — die Datei landet unter dem Namen, den
   der Assistent in Kapitel 1 vorgeschlagen hat
   (`projects/Mein_erster_interaktiver_Baum.json`).
2. Bei Erfolg erscheint eine Bestätigungs-Meldung.

> **Nachweis:** Menüaktion `save` → `saveProjectToFile()`
> (`EditorMenuManager.ts`); Dateiname wurde im Wizard erzeugt
> (`EditorProjectFactory.ts` Z. 225–233).

### Schritt 2 — Export für das CMS

1. **Plattform → Export als ZIP (CMS-Upload)** wählen.
2. Der Browser lädt eine ZIP-Datei herunter *(Ablageort =
   Browser-Downloads; Dialog UI-ungeprüft)*.
3. Die ZIP enthält das spielbare Projekt — bereit für den CMS-Upload durch
   den HouseAdmin.

> **Nachweis:** Menüpunkt `export-zip-cms` in `menu_bar.json`
> (Menü „Plattform"). Alternativ: „Export als HTML"/„JSON" für andere
> Zwecke.

`[SCREENSHOT FEHLT: Menü „Plattform" mit ZIP-Export-Eintrag]`

### Schritt 3 — Sicherungskopie (optional, empfohlen)

**Datei → Speichern unter…** mit Versionsname, z. B.
`Mein_erster_interaktiver_Baum_v1.json` — so kannst du später zu diesem
Stand zurück.

## Erwartetes Ergebnis

- Projektdatei gespeichert (`projects/…json`)
- ZIP-Datei im Download-Ordner
- Optional: Versionskopie per „Speichern unter…"

## Selbst prüfen (Funktionsprüfung)

- [ ] Speichern meldet Erfolg
- [ ] ZIP im Download-Ordner vorhanden
- [ ] *Optional:* ZIP in CMS-Galerie hochladbar (Test folgt im CMS-Teil
  des Handbuchs / durch HouseAdmin)
- [ ] Projekt lässt sich über **Datei → Projekt öffnen…** wieder laden

## Typische Stolpersteine

- **Exportiertes ZIP lässt sich nicht entpacken** → Browser hat evtl.
  den Download blockiert; nochmal versuchen.
- **„Speichern" ohne Rückmeldung** → auf die Toast-Meldung achten;
  im Zweifel Browser-Konsole prüfen (fortgeschritten).
- **Veralteter Export** → Export erzeugt eine *Momentaufnahme*; nach jeder
  Änderung neu exportieren.

## Was du gelernt hast

✔ Projekt speichern und Versionen anlegen
✔ ZIP-Export für das CMS erzeugen
✔ Unterschied zwischen Arbeitsdatei und Export-Paket

## Medien-Vorschlag

**Video (ca. 30 s):** „Speichern und als Paket exportieren"
**Sprecher-Drehbuch:** „Zum Schluss wird alles gesichert: Datei, Projekt
speichern — fertig. Für das CMS gibt es einen eigenen Export: Plattform,
Export als ZIP. Das Paket landet in den Downloads und kann von der
Hausverwaltung hochgeladen werden."
**Sync-Hinweise:** Schnitt auf Menü „Datei" (Speichern), dann „Plattform"
(ZIP-Export), Schlussbild Download-Ordner mit ZIP.

## Nächstes Kapitel

[Kapitel 15 — Feintuning](kapitel-15-feintuning.md) — Rückgängig-Meister
werden, Themes, Stage duplizieren.

---

*Quellen: `public/editor/menu_bar.json` (Datei/Plattform),
`src/editor/services/EditorMenuManager.ts` (`save`/`save-as`/Export),
`src/editor/EditorProjectFactory.ts` (Z. 225–233, Dateiname).*
