# Developer Guidelines

## Rendering & Game Loop
- **GameRuntime Authority**: Die `GameRuntime` ist die "Source of Truth" für den Spielzustand im Run-Modus.
- **Keine manuelle GameLoop-Init**: Der `Editor` darf den `TGameLoop` nicht manuell initialisieren (`init/start`), wenn die `GameRuntime` verwendet wird. Die `GameRuntime.start()` Methode übernimmt dies.
- **Render-Callback**: Übergib den Render-Callback (`onRender`) direkt an den `GameRuntime`-Konstruktor (`options.onRender`).
- **Proxy-Verwendung**: Verwende immer die Objekte aus `runtime.getObjects()` für das Rendering, da diese die reaktiven Proxies enthalten.

## FlowChart-Daten (Single Source of Truth)
- **Link-basierte Architektur**: Action-Daten werden NICHT mehr redundant in FlowCharts gespeichert. FlowChart-Elemente halten nur noch einen Link (`isLinked: true`) auf die globale Definition in `project.actions`.
- **Automatische Migration**: Beim Laden in `restoreNode` (FlowEditor.ts) werden Legacy-Daten automatisch als Links markiert, falls sie in `project.actions` existieren.
- **Speichern**: `FlowAction.toJSON()` stellt sicher, dass verlinkte Assets nur mit Name und Flag gespeichert werden.
- **Schutzmechanismus**: `updateGlobalActionDefinition` verhindert, dass valide globale Definitionen durch minimale Link-Daten (nur Name) überschrieben werden.
- **Copy vs Link**: Kopien (`Embed Action (Copy)`) erstellen neue, unabhängige Archive in `project.actions` mit eindeutigen Namen.

## Task-Logik (Primat der FlowCharts)
- **Master-Status**: Flow-Diagramme sind die primäre Quelle für die Task-Logik. Die `actionSequence` wird bei jedem Speichern/Export automatisch aus dem Diagramm regeneriert.
- **UI-Sperre**: Wenn ein Flow existiert, muss die Listen-Ansicht (`TaskEditor.ts`) schreibgeschützt sein. Verwende das `isReadOnly`-Flag in `createSequenceItemElement`.
- **Synchronisation**: Rufe vor allen Persistenz-Operationen `flowEditor.syncAllTasksFromFlow(project)` auf, um Datenkonsistenz zu garantieren.

## Debugging
- **Identitäts-Prüfung**: Bei Verdacht auf "Geister-Objekte" (Logik läuft, Rendering steht), prüfe die Objekt-Identität mit einem temporären "Tag" (`__debugId`), das vor der Proxy-Erstellung angehängt wird.
- **JSON-Vergleich**: Nutze `JSON.stringify`, um tiefere Unterschiede in Objekt-Strukturen zu erkennen, falls die Identität gleich scheint.

## Internationalisierung (i18n)
- **Browser-Übersetzung kontrollieren**: Code-Bereiche (Pascal, JSON, Flow-Details, Expressions) müssen mit `translate="no"` markiert werden, um Browser-Übersetzungen (Google Translate etc.) zu verhindern.
- **Betroffene Elemente**: `<pre>`, monospace-Bereiche, JSON-Tree, FlowAction-Details, ActionEditor-Vorschauen.
- **Muster**: `<pre translate="no">` oder `element.setAttribute('translate', 'no')`.
- **UI-Texte**: Button-Labels, Tooltips, Menüs sollen übersetzbar bleiben (kein `translate="no"`).

## Export-System
- **Formate**: Plain (lesbar) und gZip (komprimiert, ~70% kleiner).
- **gZip-Frontend**: `JSON → gzipSync (fflate) → Base64 → PROJECT_DATA` (HTML) oder `{_compressed: true, data: "..."}` (JSON). Siehe `GameExporter.ts`.
- **Runtime-Kompatibilität**: `player-standalone.ts` erkennt automatisch komprimierte Daten und dekomprimiert via `gunzipSync`.
- **Backend-Dekomprimierung**: Die Game Platform (`server.ts`) dekomprimiert hochgeladene, komprimierte JSONs on-the-fly (`zlib.gunzipSync`), um dem Spieler unabhängig vom Speicherformat immer valides JSON zu liefern.
- **Bibliotheken**: `fflate` im Frontend, `zlib` im Backend.

