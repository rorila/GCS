# AI Project Generation & Structure Guide

> [!CAUTION]
> Dies ist das zwingende Referenzhandbuch für KI-Agenten, die aufgefordert werden, GCS (Game Creation System) Projekte, Tasks, Actions oder Komponenten zu generieren oder zu manipulieren.

## 1. Das "Kein nacktes JSON" Gebot (Flow-Integrität)
Generiere **Niemals** manuell aus dem Nichts vollständige JSON-Projektdateien (`project.json`) für den User, die komplexe Flow-Graphen oder Diagramme enthalten.
- **Warum?** Die Flow-Engine von GCS speichert Logik-Pfade (Tasks, Actions) in einer redundanten Diagramm-Repräsentation (`flowCharts`), die extrem fehleranfällig gegenüber manuellen JSON-Eingriffen ist. Fehlt ein `connections`-Array, eine korrekte UUID oder ein Anchor-Type (`startAnchorType`, `endAnchorType`), stürzt der gesamte Editor/das Spiel ab.
- **Die Lösung:** Nutze primär den internen **AgentController** der Software, um Logik programmatisch aufzubauen, oder liefere dem User **verständliche Schritt-für-Schritt Klick-Anleitungen** für den GUI-Editor.

## 2. Das GCS Grid-System
Alle visuellen UI-Eigenschaften (X, Y, Width, Height) der GCS Komponenten (`TComponent`, `TSprite`, `TPanel`, `TLabel`, etc.) arbeiten **nicht in absoluten Bildschirmpixeln**.
- GCS stützt sich auf ein relatives Grid, standardmäßig **64 Spalten (Cols) und 40 Zeilen (Rows)**.
- **Negativ-Beispiel:** Ein Objekt mit `x: 375, y: 500, width: 50, height: 50` würde weit außerhalb des projizierten Bildschirms landen und 50 Zellen (fast die gesamte Viewport-Breite) einnehmen.
- **Positiv-Beispiel:** Ein Objekt auf Position `x: 30, y: 20` mit `width: 2, height: 2` liegt etwa zentriert und ist 2x2 Blöcke groß.

## 3. Basis-Pflichtfelder im JSON
Wenn du aus triftigen Gründen ein JSON modifizierst oder ein leeres Basis-Projekt als String füllst, MÜSSEN zwingend folgende Root-Arrays existieren:
```json
{
  "objects": [],
  "actions": [],
  "tasks": [],
  "flowCharts": []
}
```
Auch wenn diese in GCS in der Zwischenzeit in die Stages (`stages[0].objects`) verlagert wurden, zerschießt ein Fehlen dieser Arrays in der Root-Ebene Legacy-Migrationen und Hydrator-Skripte (`length of undefined` TypeError).

## 4. Blueprint & Scoping
1. **Blueprint-Stage Minimalismus:** Jedes GCS Projekt MUSS exakt eine Stage vom `type: "blueprint"` enthalten. ABER: Setze dorthin **ausschließlich** Logik, Komponenten (z.B. UI-Overlays) und Variablen, die zwingend level- bzw. szenenübergreifend benötigt werden. Templates (z.B. für Spawning), Gegner-Logiken oder lokale GameLoops gehören strikt auf die Stage, in der sie verwendet werden.
2. **Action-Scope Binding:** Wenn eine Action (`spawn_object`, `set_variable`) erstellt wird, gehört diese in das exakt selbe Scope-Array wie der Task, der sie aufruft. 
  - Rufst du aus einem Blueprint-Task (`stage_blueprint.tasks`) eine Aktion der Main-Stage ab, zerreißt es die Editor-Verbindung, da der Flow-Graphen Parser Actions einer Local-Stage nicht aus einem Global-Task heraus einlesen darf.

## 5. Bedingungs-Syntax (Condition Parser)
Nutze für Entscheidungen in Actions und Tasks immer nativ geparste **String-Conditions**:
```json
"condition": "${hitSide} == 'top'"
```
Verzichte auf nackte Objekt-Bedingungs-Bäume (wie `condition: { leftValue: "...", operator: "==" }`), da diese im Parameter-Literal-Parser Fehler auswerfen können (die JSON Single-Quotes werden dann nicht sauber aufgelöst und erzeugen Laufzeitfehler wie `"top" == "'top'"`).

## 6. Klon-Proxying (Runtime Spawning)
Wenn Objekte zur Laufzeit per Flow-Action (`spawn_object`) als "Klon" gespawnt werden, und Events auslösen (z.B. Kollision), lenkt die GCS Engine Workflow-Targets, die auf das *Original-Projektil (Template)* zielen, intelligent auf das `%Self%` der gespawnten Klon-Instanz um.
- Versuche nicht, im JSON hartcodierte Klon-IDs per String-Verkettung als Target aufzulösen. Adressiere in der Action immer `%Self%` oder das Template, und lass den `ActionExecutor` das Target-Routing übernehmen.
