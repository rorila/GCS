# Kapitel-Vorlage (interne Arbeitsvorlage)

Jedes Handbuch-Kapitel folgt diesem Aufbau. Beim Kopieren die Platzhalter
ersetzen; die Nachweis- und Markierungsregeln beibehalten.

```markdown
# Kapitel N — <Titel>

> Status: quellverifizierter Entwurf · alle Schritte im Code nachgewiesen
> (Zeilenanker im Abschnitt „Quellen"), noch nicht in der UI nachgespielt.

## Lernziel
<Am Ende kannst du … (eine konkrete, beobachtbare Fähigkeit)>

## Voraussetzungen
- <abgeschlossene Kapitel / vorhandenes Projekt / benötigte Dateien>

## Verwendete Bausteine
| Baustein | Was er tut | Woher (Toolbox-Kategorie) |
|---|---|---|
| <Komponente> | <Ein Satz für Laien> | <Toolbox-Kategorie> |

## Bedienungsschritte
1. <konkrete Aktion, mit Menü-/Panel-Namen in **fett**>
2. …
> **Nachweis:** <Quelldatei : Zeile> für jeden nicht offensichtlichen Schritt.

[SCREENSHOT FEHLT: …] — wo nötig

## Erwartetes Ergebnis
<Was du jetzt sehen musst — konkret überprüfbar>

## Selbst prüfen (Funktionsprüfung)
- [ ] <Checkliste: „Öffne X → du siehst Y">
- [ ] <Im Run-Modus: „Klicke Z → das passiert">

## Typische Stolpersteine
- <Häufiger Fehler + wie man ihn behebt — nur dokumentierte Verhaltensweisen>

## Was du gelernt hast
✔ <3–5 Stichpunkte>

## Quellen
<Quelldateien mit Zeilenangaben>
```

Regeln:
- Keine Schritte erfinden — nur Code- oder UI-belegte Abläufe
- `[SCREENSHOT FEHLT: …]` statt frei erfundener Bildbeschreibung
- Unfertige Funktionen (TD-009/010/011) explizit als „noch nicht benutzbar"
  kennzeichnen, siehe TECHNICAL-DEBT.md
