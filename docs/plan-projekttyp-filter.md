# Umsetzungsplan: Projekttypen und Filter im Game Builder

Stand: 12.10.2026. Dieser Plan basiert auf dem vorhandenen Quellcode. Er beschreibt die Umsetzung; die Anwendung wird durch dieses Dokument noch nicht verändert.

## 1. Ziel und Umfang

Es bleibt eine App. Die Auswahl unter **Datei** erzeugt ein Projekt mit einem dauerhaft gespeicherten Projekttyp:

| Menüeintrag | Vorgeschlagener interner Wert | Zweck |
|---|---|---|
| Neues Single-Player-Projekt | `single-player` | Ein Spieler; lokale Spieldaten, keine CMS-Anbindung |
| Neues Single-Player-CMS-Projekt | `single-player-cms` | Ein Spieler; persönliche Daten/Karteikästen über das CMS |
| Neues Multi-Player-Projekt | `multi-player` | Mehrere Spieler; CMS-Anbindung, Partien und Synchronisation |

Der Projekttyp steuert Menü, Toolbar, Komponentenpalette, Assistenten, Inspector und auswählbare Services. Nicht benötigte Angebote werden **ausgeblendet**, nicht lediglich ausgegraut. Leere Kategorien, Menüs und überflüssige Trennlinien verschwinden ebenfalls.

Die drei Einträge zum Anlegen eines Projekts bleiben in jedem Projekttyp sichtbar. Sie erzeugen ein neues Projekt und schalten nicht den Typ des bereits geöffneten Projekts um. Eine nachträgliche Typumstellung gehört nicht zum ersten Umsetzungsschritt.

**Planungsannahme:** Multi-Player erlaubt auch CMS-Datenzugriff. Lokales Spielen mit zwei Personen wird in den beiden Single-Player-Typen ebenfalls nicht angeboten. KI-Unterstützung ist eine spätere, unabhängige Erweiterung; vorhandene KI-Funktionen werden in dieser Umsetzung nicht umgebaut oder neu gefiltert.

## 2. Befund im aktuellen Code

- `public/editor/menu_bar.json` enthält tatsächlich zwei Neuanlage-Einträge: `new-project` („Neues Projekt (angeleitet)“) und `new-project-direct` („Neues Projekt...“). Beide sind durch die drei gewünschten Einträge zu ersetzen, damit kein ungefilterter Einstieg übrig bleibt.
- `src/editor/services/EditorMenuManager.ts` verteilt diese Aktionen an `newProject()` und `newProjectDirect()`.
- `src/editor/EditorProjectFactory.ts` erzeugt Standardprojekte und Wizard-Projekte. Der Wizard fügt bei `players === '2net'` einen `TGameServer` hinzu. Ein persistenter Projekttyp fehlt.
- `src/editor/dialogs/StageDialogs.ts` bietet im Projekt-Wizard unter anderem die Auswahl `2net` an. Dieser Wizard wird auch über „Projekt konfigurieren“ erneut geöffnet.
- Zwei Palettenkonfigurationen existieren: `public/editor/toolbox.json` und `public/editor/toolbox_horizontal.json`. Die vertikale enthält zusätzlich `Handshake` und `Heartbeat`; beide müssen dieselbe Filterregel verwenden.
- `src/editor/EditorShelfModel.ts` sammelt nichtvisuelle Services und globale/geerbte Objekte für das Seitenpanel. Ein Filter muss auch diese Oberfläche berücksichtigen.
- `src/services/ServiceRegistry.ts` liefert derzeit ungefilterte Service-Listen. `src/editor/inspector/DynamicOptionsRenderer.ts` nutzt diese Listen für Auswahlelemente.
- Es gibt zwei Komponentenregistrierungen: `src/services/ComponentRegistry.ts` und `src/utils/ComponentRegistry.ts`. Die Filterung darf ihre Fähigkeit zum Laden vorhandener Komponenten nicht entfernen.
- `TDataStore` unterstützt lokale Speicherung. Es ist daher keine ausschließlich CMS-bezogene Komponente.
- Multiplayer existiert über `TGameServer` sowie über CMS-Komponenten wie `TCmsLiveSync` und `TServerParty`. Beide Wege müssen vom selben Typ abhängen.

## 3. Filtermatrix für Komponenten und Services

„Verfügbar“ bedeutet: im passenden Editor-Kontext auswählbar, soweit dort bereits angeboten. Die Tabelle verlangt nicht, sämtliche registrierten Komponenten neu in die Toolbar aufzunehmen.

| Elemente | Single-Player | Single-Player-CMS | Multi-Player |
|---|---|---|---|
| Standard-, Media-, Game-, Dialog- und Variablenkomponenten | Verfügbar | Verfügbar | Verfügbar |
| `TStageController`, `TInputController`, `TVirtualGamepad`, `TGameLoop`, normale Timer, `TGameState` | Verfügbar | Verfügbar | Verfügbar |
| `TDataStore`, lokale Datenlisten und lokale Datenspeicherung | Verfügbar | Verfügbar | Verfügbar |
| `TAPIServer`, `TAuthService`, `TUserManager` | Ausblenden | Verfügbar | Verfügbar |
| `TServerEndpoint`, `TServerValidate`, `TServerAuthenticate`, `TServerSession`, `TServerResponse` | Ausblenden | Verfügbar | Verfügbar |
| `TServerProfile`, `TServerAccess`, `TServerEnroll`, `TServerParentAccount` | Ausblenden | Verfügbar | Verfügbar |
| `TServerDecks`, `TServerCards`, `TServerQuery`, `TServerStore`, `TServerUpload` | Ausblenden | Verfügbar | Verfügbar |
| `TServerPlaySession` | Ausblenden | Verfügbar für Einzelspiel | Verfügbar |
| `TGameServer`, `THandshake`, `THeartbeat` | Ausblenden | Ausblenden | Verfügbar |
| `TCmsLiveSync`, `TServerLiveSync`, `TServerParty` | Ausblenden | Ausblenden | Verfügbar |
| `TFilePicker` | Verfügbar für lokale Auswahl | Verfügbar | Verfügbar |
| `TFileUpload` als Server-Upload-Angebot | Ausblenden | Verfügbar | Verfügbar |
| `RemoteGameManager` in Service-Auswahllisten | Ausblenden | Ausblenden | Verfügbar |
| `HttpServer`, `ApiSimulator` in Service-Auswahllisten | Ausblenden | Verfügbar | Verfügbar |
| Allgemeine Editor-Services, Projektverwaltung und lokale Datenbearbeitung | Verfügbar | Verfügbar | Verfügbar |

### Version 1: Neues Single-Player-Projekt

**Auszufiltern:** alle oben aufgeführten CMS-/Server-Workflow-, Authentifizierungs-, Benutzerverwaltungs-, Server-Upload- und Multiplayer-Angebote. In „System“ bleiben lokale Spielservices sichtbar; `GameServer` und `APIServer` verschwinden. „Server-Workflow“ entfällt vollständig. „Daten & Auth“ bleibt mit `DataStore` bestehen. „Dateien und Upload“ enthält nur die lokale Dateiauswahl.

Keine automatische Erzeugung von Login, CMS-Datenzugriff, GameServer, Partien oder Synchronisationsdiensten. Allgemeine Kartenkomponenten wie `Card` und `GameCard` bleiben nutzbar: ihre Darstellung ist nicht automatisch ein persönlicher CMS-Karteikasten.

### Version 2: Neues Single-Player-CMS-Projekt

**Auszufiltern:** `TGameServer`, `THandshake`, `THeartbeat`, `TCmsLiveSync`, `TServerLiveSync`, `TServerParty`, `RemoteGameManager` sowie sämtliche Multiplayer-Einstellungen und Multiplayer-Testaktionen.

Authentifizierung, eigenes Profil, Karten/Stapel und Einzelspiel-Sitzungen bleiben verfügbar. `TServerSession` ist eine Verwaltungssitzung und kein Beleg für Multiplayer. Auch `TServerPlaySession` darf nicht pauschal als Multiplayer eingestuft werden.

CMS-Zugang und Datenquelle werden konfigurierbar angeboten. Nicht jeder CMS-Typ benötigt automatisch alle Server-Komponenten im Blueprint: nur die tatsächlich gewählten Funktionen erzeugen Instanzen.

### Version 3: Neues Multi-Player-Projekt

**Auszufiltern:** keine der in dieser Matrix aufgeführten CMS- oder Multiplayer-Funktionen. Alle allgemeinen Funktionen bleiben erhalten. Kontextabhängige Filter, etwa auf den aktiven Stage-Typ, gelten weiterhin.

Partien, Lobby, Spieleranzahl, Netzwerkverbindung und Live-Synchronisation werden angeboten. Die vorhandenen CMS- und GameServer-Wege bleiben auswählbar; nicht automatisch beide gleichzeitig anlegen. Insbesondere darf die bestehende `2net`-Regel nicht bei jedem CMS-Multiplayer-Projekt zusätzlich einen unbenötigten `TGameServer` erzeugen.

### Einordnung fachlicher Grenzfälle

Die Einstufung von API-, Auth- und Benutzerverwaltung als CMS-Funktionen ist eine Produktentscheidung für diese drei vereinfachten Profile. Die Klassen könnten technisch auch andere Zwecke erfüllen. Lokaler `TDataStore` bleibt bewusst im Basisprofil verfügbar. Für `TFileUpload` ist vor Umsetzung zu prüfen, ob zusätzlich eine rein lokale Verwendung existiert; gegebenenfalls lokale Methoden freigeben und nur Server-Ziele filtern. `TServerPlaySession` muss anhand seiner Einzelspiel-/Partie-Parameter gefiltert werden. Unbekannte Erweiterungskomponenten erhalten eine explizite Einstufung statt einer pauschalen Namensheuristik.

## 4. Menü, Toolbar, Assistenten und Inspector

| Angebot / bestehende ID | Single-Player | Single-Player-CMS | Multi-Player | Hinweis |
|---|---|---|---|---|
| Drei neue Datei-Einträge | Sichtbar | Sichtbar | Sichtbar | Ersetzen beide bisherigen Neuanlage-Einträge |
| Öffnen, Speichern, Speichern unter, Projekteigenschaften | Sichtbar | Sichtbar | Sichtbar | Typ in Projekteigenschaften zunächst nur anzeigen |
| HTML-/JSON-Export einschließlich Komprimierung | Sichtbar | Sichtbar | Sichtbar | CMS-/Netzwerkabhängigkeiten bei Export kenntlich machen |
| `export-cms-bundle` | Ausblenden | Sichtbar | Sichtbar | CMS-Upload-ZIP |
| `multiplayer` | Ausblenden | Ausblenden | Sichtbar | „Multiplayer testen“ |
| `seed-data` | Ausblenden | Sichtbar | Sichtbar | Bestehende Aktion verändert serverbezogene Testdaten |
| `force-reload` | Sichtbar | Sichtbar | Sichtbar | Lädt das Editor-Projekt; nicht mit Spiel-CMS gleichsetzen |
| Themes, Stageverwaltung, Undo/Redo, Medienwerkzeuge, lokale Vorschau | Sichtbar | Sichtbar | Sichtbar | Allgemeine Bearbeitung |
| Spielerzahl/Steuerung für Spieler 2, Wizard-Optionen für lokale oder Netzwerk-Mehrspieler | Ausblenden | Ausblenden | Sichtbar | In Single-Player fest ein Spieler |
| CMS-Zugang, Profil, eigene Karten/Stapel | Ausblenden | Sichtbar | Sichtbar | Nur in passenden Konfigurationskontexten |
| Multiplayer-Inspectorabschnitt, Netzwerk-`sync`, entfernte Trigger-/Broadcast-Optionen | Ausblenden | Ausblenden | Sichtbar | Lokale Ereignisse und lokale Trigger bleiben erhalten |
| Flow-Menüs für Raum erstellen/beitreten, Netzwerk-Tasks und Remote-Aktionen | Ausblenden | Ausblenden | Sichtbar | Lokale Flow-Aktionen bleiben verfügbar |
| Server-Konfiguration, API-Simulator und serverbezogene Debugangebote | Ausblenden | Sichtbar | Sichtbar | Allgemeines Debugging bleibt verfügbar |

`force-reload` wird absichtlich nicht allein wegen des Wortes „Server“ ausgeblendet: der Editor kann auch einfache Spiele vom Entwicklungsserver laden. Entsprechend werden interne Speicher- und Editorservices nicht abgeschaltet, nur weil das Spiel keinen CMS-Zugang benötigt.

Vorhandene KI-Generierung, manuelle UseCases/Features und AgentScript-Funktionen werden in diesem Arbeitspaket nicht verändert. Eine spätere KI-Freigabe sollte als unabhängige Fähigkeit modelliert werden, damit KI in jedem der drei Projekttypen ergänzt werden kann.

## 5. Technisches Konzept

### 5.1 Persistenter Typ

In `src/model/types.ts` einen Typ `ProjectType = 'single-player' | 'single-player-cms' | 'multi-player'` und zunächst ein optionales Feld `ProjectMetadata.projectType` ergänzen. Neue Projekte erhalten es immer. Die optionale Definition ermöglicht das kontrollierte Laden alter Dateien.

Beispiel:

```json
{
  "meta": {
    "name": "Mein Memory",
    "version": "1.0.0",
    "author": "",
    "projectType": "single-player-cms"
  }
}
```

`meta.version` bleibt die Version des Spiels. Projekttyp und App-Version werden nicht vermischt. Der gespeicherte Projekttyp ist die Quelle für den Filter, keine separate dauerhaft gespeicherte globale App-Einstellung.

### 5.2 Zentrale Filterregeln

Neue Datei `src/editor/ProjectCapabilities.ts` vorsehen. Sie beschreibt die Fähigkeiten je Typ, die Anforderungen von Komponenten, Menüaktionen, Service-Angeboten und optional einzelnen Eigenschaften/Methoden. Beispielsweise `cmsData`, `cmsAuth`, `serverWorkflow`, `serverUpload`, `multiplayer` und `cmsLiveSync`.

Vorgesehene Funktionen: `getProjectCapabilities(project)`, `isComponentAvailable(className, project)`, `isMenuActionAvailable(action, project)` und `isServiceAvailable(name, project)`. Aliase wie `GameServer` werden über die vorhandene Zuordnung auf `TGameServer` normalisiert. Komponenten und Services erhalten keine unterschiedlichen Regeln je Toolbar-Layout.

Die Regelprüfung verwendet den aktuellen Projektzustand. Keine bei Modulimport eingefrorenen Fähigkeiten, keine destruktive Entfernung global registrierter Klassen. Rohkonfigurationen bleiben erhalten; jeder Renderdurchlauf leitet daraus eine gefilterte Ansicht ab. So kann nach dem Öffnen eines anderen Projekttyps ein zuvor ausgeblendetes Element wieder erscheinen.

### 5.3 Erstellen und Laden

1. Menüaktion übergibt explizit den gewünschten Typ an die Projektfactory.
2. Ungespeicherte Änderungen werden wie bisher berücksichtigt.
3. Projekt-/Stage-Assistent bekommt diesen Typ bereits vor der Anzeige und bietet nur passende Optionen.
4. Neues Projekt wird erst nach erfolgreichem Abschluss übernommen; Abbruch behält Projekt und bisherigen Filter.
5. Factory setzt `meta.projectType` in jedem Pfad, einschließlich direkter Erstellung und E2E-Pfad.
6. Beim Laden, Projektwechsel, Wiederherstellen und Undo/Redo eines Projektzustands werden die sichtbaren Angebote aktualisiert.
7. Initialisierung von Menü und Palette erfolgt teilweise asynchron: unmittelbar nach Laden ihrer Konfigurationen ebenfalls den aktuellen Typ anwenden.

Bestehendes `localStorage.clear()` in der Neuanlage vor Abschluss des Wizards überprüfen: Abbruch darf nicht bereits gespeicherten Editorzustand löschen. Nur projektbezogene Daten gezielt beim erfolgreichen Wechsel bereinigen.

### 5.4 Vorhandene Projekte und Import

Ein gespeicherter gültiger Typ hat Vorrang. Für Dateien ohne Typ eine zentrale Kompatibilitätsauflösung in der Ladepipeline vorsehen:

- Multiplayer erkennen über eindeutige Merkmale wie `TGameServer`, `THandshake`, `THeartbeat`, `TCmsLiveSync`, `TServerLiveSync`, `TServerParty`, Multiplayer-Metadaten und tatsächliche Remote-Aktionen.
- Andernfalls CMS erkennen über CMS-/Auth-/Server-Workflow-Komponenten und CMS-Datenkonfiguration.
- Andernfalls `single-player` verwenden. `TDataStore`, `GameCard` oder allgemeine Eingabefelder allein lösen keine CMS-/Multiplayer-Erkennung aus.
- Alle Stages, Blueprint, verschachtelte Kinder, ältere Objektlisten und Flows einbeziehen. Bei uneindeutigem Legacy-Projekt einmalig die Typauswahl anbieten, bevor Funktionen eingeschränkt werden.
- Ermittelten Typ in den geladenen Arbeitszustand übernehmen und bei der nächsten regulären Speicherung persistieren; Quelldateien nicht ungefragt überschreiben.
- Unbekannte Typwerte als Kompatibilitätsfall behandeln, nicht stillschweigend zum kleinsten Profil herabstufen.

Vorhandene Objekte niemals durch Filterung löschen. Bei ausdrücklich gespeichertem Typ mit unpassenden Objekten diese weiterhin inspizierbar halten und den Konflikt anzeigen. Neue unpassende Objekte und Bindungen nicht anbieten. Speichern zur Datenerhaltung erlauben; Test/Export mit widersprüchlichen Anforderungen vorab validieren.

Stage-, Template- und AgentScript-Import dürfen den Typ nicht unbemerkt umgehen. Vor Übernahme prüfen, welche Fähigkeiten benötigt werden; bei Unvereinbarkeit Import mit konkretem Hinweis abbrechen. Vollständiger Projektimport kann einen anderen Projekttyp übernehmen, muss dann aber die komplette Filteraktualisierung auslösen.

## 6. Dateien und konkrete Änderungen

Pfade sind relativ zum Repository. „Prüfen“ bedeutet, dass eine Änderung nur erforderlich ist, wenn dort der Typ verloren geht oder ein relevantes Angebot erzeugt wird.

| Datei | Status | Geplante Änderung |
|---|---|---|
| `src/model/types.ts` | Ändern | `ProjectType` und `meta.projectType` ergänzen |
| `src/editor/ProjectCapabilities.ts` | Neu | Zentrale Fähigkeiten und Verfügbarkeitsregeln |
| `src/services/ProjectTypeResolver.ts` | Neu | Legacy-Erkennung und Prüfung gültiger Typwerte |
| `public/editor/menu_bar.json` | Ändern | Zwei alte Neuanlage-Punkte durch drei neue ersetzen; Anforderungsmetadaten für typabhängige Aktionen |
| `src/editor/services/EditorMenuManager.ts` | Ändern | Drei Aktionen dispatchen, Host-Signaturen erweitern, dynamisch ergänzte Menüs ebenfalls filtern; direkte Aktionen prüfen |
| `src/editor/MenuBar.ts` | Ändern | Gefilterte Darstellung aus Rohkonfiguration, leere Menüs/Separatoren entfernen, Aktualisierung ermöglichen |
| `src/editor/EditorProjectFactory.ts` | Ändern | Alle Erstellungspfade typisieren; passende Defaults und Wizard-Parameter; Abbruch und Storage-Bereinigung absichern |
| `src/editor/Editor.ts` | Ändern | Typ weiterreichen; gemeinsame Aktualisierung von Menü, Paletten, Inspector und Seitenpanel beim Projektwechsel |
| `src/editor/EditorViewManager.ts` | Ändern | Typ/Kontext an Dialoge weiterreichen; serverbezogene Ansichten anhand Fähigkeiten prüfen |
| `src/editor/dialogs/StageDialogs.ts` | Ändern | Spieleroptionen filtern; CMS-/Netzwerkangebote an Typ binden; erneute Konfiguration berücksichtigen |
| `src/editor/userstories/UserStoriesListRenderer.ts` | Prüfen/ändern | Einstieg „Projekt konfigurieren“ übernimmt aktuellen Typ; manuelle UseCases bleiben erreichbar |
| `public/editor/toolbox.json` | Ändern | Anforderungen der vertikalen Palettenelemente hinterlegen |
| `public/editor/toolbox_horizontal.json` | Ändern | Dieselben Anforderungen für horizontale Palette hinterlegen |
| `src/editor/JSONComponentPalette.ts` | Ändern | Kategorien und Elemente vor Darstellung filtern; aktiven Kategorieindex korrigieren |
| `src/editor/EditorSidepanel.ts` | Ändern | Verfügbare Service-Angebote filtern; existierende Konfliktobjekte zugänglich halten |
| `src/editor/EditorShelfModel.ts` | Prüfen/ändern | Fähigkeiten in Angebotslisten berücksichtigen; Sammlung vorhandener Objekte nicht destruktiv filtern |
| `src/editor/services/EditorCommandManager.ts` | Ändern | Zentrale Erzeugungsprüfung auch für Drag-and-drop und direkte Aufrufe |
| `src/editor/inspector/DynamicOptionsRenderer.ts` | Ändern | Service-/Methoden-/Objektoptionen projekttypabhängig anbieten |
| `src/editor/inspector/InspectorRenderer.ts`, `src/editor/inspector/InspectorUIRenderer.ts` | Prüfen/ändern | Multiplayer-Abschnitte und Einzeloptionen vor Rendern filtern |
| `public/editor/inspector_layout.json` | Prüfen/ändern | Anforderungen für Netzwerk-/Synchronisationseigenschaften hinterlegen |
| `src/editor/services/FlowContextMenuProvider.ts` | Ändern | Resolver, insbesondere Abschnitt `multiplayer`, filtern |
| `src/editor/services/flow/FlowContextMenuSubmenus.ts`, `src/editor/MethodRegistry.ts` | Prüfen/ändern | Remote-/CMS-Aktionen und Methodenangebote filtern |
| `src/services/ServiceRegistry.ts` | Prüfen/ändern | Kontextabhängige Listen oder separate gefilterte Listen-API; Standardzugriff intern erhalten |
| `src/services/RemoteGameManager.ts` | Prüfen | Importzeit-Registrierung nicht mit projekttypabhängiger Sichtbarkeit verwechseln |
| `src/editor/services/EditorSimulatorManager.ts` | Prüfen/ändern | `HttpServer`/`ApiSimulator` nur passend anbieten; aktive Simulation bei Projektwechsel beenden |
| `src/editor/services/EditorProjectLoader.ts` | Ändern | Typ auflösen und Filter vor abschließender Darstellung anwenden |
| `src/editor/services/EditorProjectSaver.ts`, `src/services/ProjectPersistenceService.ts`, `src/services/ProjectStore.ts` | Prüfen/ändern | Typ beim Serialisieren, Kopieren und Wiederherstellen erhalten |
| `src/editor/EditorSessionManager.ts` | Prüfen/ändern | Typ bei Wiederherstellung erhalten, kein veralteter globaler Filter |
| `src/services/ProjectIntegrityValidator.ts` | Ändern | Typ-/Fähigkeitskonflikte mit konkreten Objekt-/Stagehinweisen prüfen |
| `src/editor/EditorStageImporter.ts`, `src/services/agent/AgentScriptImportService.ts` | Prüfen/ändern | Fähigkeitserfordernisse vor Import prüfen |
| `src/services/agent/AgentProjectService.ts`, `src/services/agent/AgentObjectService.ts` | Prüfen/ändern | Projekterstellung und Objekterzeugung dürfen Filter nicht umgehen; keine neue KI-Freigabelogik |
| `src/editor/services/EditorRunManager.ts` | Prüfen/ändern | CMS-/Multiplayer-Setup nur passend starten, vorige Netzwerkverbindungen beim Wechsel beenden |
| `src/editor/services/EditorMultiplayerTest.ts`, `src/editor/services/EditorCmsMultiplayerTest.ts` | Prüfen/ändern | Multiplayer-Test auch bei direktem Aufruf auf passenden Typ begrenzen |
| `src/editor/services/EditorCmsTest.ts` | Prüfen/ändern | CMS-Test für CMS-/Multi-Player erlauben |
| `src/export/GameExporter.ts`, `src/player-standalone.ts` | Prüfen/ändern | Typ erhalten und widersprüchliche Export-/Startkonfiguration erkennen |
| `src/services/ComponentRegistry.ts`, `src/utils/ComponentRegistry.ts` | Prüfen | Aliasnormalisierung nutzen; Registrierungen nicht entfernen |
| `docs/components.md`, `docs/components-generated.md` | Prüfen | Dokumentation der Profile; generierte Dokumente über vorhandenen Generator aktualisieren |

Die Komponentenklassen selbst sowie CMS- und Game-Server benötigen für einen reinen Editor-Angebotsfilter zunächst keine grundlegende Änderung. Der Filter ist keine neue serverseitige Berechtigungskontrolle. Serveränderungen erst dann einplanen, wenn die Prüfung zeigt, dass Projektmetadaten dort entfernt oder zwingend Multiplayer-Dienste gestartet werden.

## 7. Arbeitspakete und Reihenfolge

### A. Modell und Regeln

1. Drei Typwerte, Fähigkeiten und Komponenten-/Servicezuordnung implementieren.
2. Lokale Datenspeicherung von CMS-Datenzugriff unterscheiden.
3. Legacy-Auflösung und Konfliktdiagnose implementieren.

**Ergebnis:** Jeder geladene Arbeitszustand besitzt einen aufgelösten Typ; dieselbe Regel beantwortet alle Verfügbarkeitsfragen.

### B. Neuanlage und Dateimenü

1. Menüeinträge ersetzen und Factory-Schnittstellen anpassen.
2. Wizard typisieren; direkte Erstellung als internen Pfad erhalten, falls Tests oder weitere Aufrufer sie benötigen.
3. Für die drei neuen Einträge zunächst den bestehenden angeleiteten Ablauf verwenden; kein zusätzlicher sechsfacher Menüblock für „angeleitet/direkt“.
4. Standardprojekt beim App-Start als Single-Player initialisieren, soweit keine Sitzung wiederhergestellt wird.
5. Abbruch vor Typ-/Storage-Übernahme absichern.

**Ergebnis:** Der gewünschte Typ ist bereits während des Wizards wirksam und wird mit dem neuen Projekt gespeichert.

### C. Sichtbare Oberflächen

1. Menü und beide Paletten filtern.
2. Seitenpanel, Inspector, Service-Auswahl und Flow-Kontextmenüs anbinden.
3. Dynamisch erzeugte Menüs sowie erneutes Öffnen der Projektkonfiguration prüfen.
4. Projekttyp in Projekteigenschaften und möglichst im vorhandenen Projekt-Infobereich anzeigen.

**Ergebnis:** Die drei Profile entsprechen den Tabellen; Projektwechsel stellt sämtliche Angebote korrekt wieder her.

### D. Laden, Import, Vorschau und Export

1. Dateien, Autosave, Session und Import vereinheitlichen.
2. Nichtpassende Neuerzeugung zentral abfangen.
3. Aktive CMS-/Netzwerk-Testverbindungen beim Projektwechsel schließen.
4. Export und Teststart gegen Typkonflikte prüfen.

**Ergebnis:** Filter können nicht versehentlich durch einen alternativen Editor-Einstieg umgangen werden; bestehende Projektdaten bleiben erhalten.

### E. Prüfung und Dokumentation

1. Tests für Fähigkeiten, Neuanlage, Persistenz und UI ergänzen.
2. Vorhandene E2E-Selektoren für die bisherigen Datei-Einträge anpassen.
3. Bestehende CMS-/Multiplayer-Regressionen ausführen, soweit betroffene Pfade geändert wurden.
4. Profilbeschreibung und fachliche Ausnahmen dokumentieren.

## 8. Testplan und Abnahmekriterien

| Prüfung | Erwartung |
|---|---|
| Alle drei Datei-Einträge | Exakte gewünschte Beschriftungen; beide alten Einträge entfallen |
| Single-Player anlegen | Kein CMS-/Multiplayer-Angebot; lokale Komponenten und DataStore verfügbar |
| Single-Player-CMS anlegen | CMS/Auth/Karten verfügbar; keine Partie-/LiveSync-/Multiplayer-Angebote |
| Multi-Player anlegen | CMS- und Multiplayer-Angebote verfügbar; keine doppelte automatische Netzwerkarchitektur |
| Toolbar-Layout wechseln | Gleiche Verfügbarkeit in horizontaler und vertikaler Palette |
| Typfolge Multi → Single → CMS → Multi | Versteckte Einträge kommen korrekt zurück; keine veralteten Serviceoptionen |
| Wizard abbrechen | Vorheriges Projekt, Filter und Wiederherstellungsdaten bleiben erhalten |
| Speichern/Öffnen/Autosave/Session | Gespeicherter Typ und passende Oberfläche bleiben erhalten |
| Legacy-Projekt mit nur lokalem DataStore | Wird als Single-Player behandelt |
| Legacy-Projekt mit CMS-Karten bzw. CMS-LiveSync | CMS bzw. Multiplayer korrekt erkannt |
| Expliziter Typ mit inkompatiblen Objekten | Daten bleiben erhalten und inspizierbar; konkrete Konfliktdiagnose |
| Unpassender Komponenten-/Template-/Stage-Import | Verständlicher Hinweis; keine teilweise Übernahme |
| Direkter Aufruf einer Multiplayer-Aktion im Single-Profil | Keine Erstellung oder Testverbindung |
| Server-Projektladen für Single-Player | Weiterhin möglich; Spiel-CMS und Editor-Speicherung nicht vermischt |
| KI-/manuelle UseCase-Funktionen | Bestehendes Verhalten bleibt erhalten; keine Version-4-Implementierung |

Vorgesehene neue Tests: `tests/project_capabilities.test.ts`, `tests/project_type_resolution.test.ts`, `tests/e2e/project-type-filter.spec.ts`. Bestehende Tests `tests/e2e/01_ProjectCreation.spec.ts`, `tests/e2e/08_ProjectSaving.spec.ts`, `tests/project_store.test.ts` und `tests/project_integrity.test.ts` anpassen beziehungsweise ergänzen. Bei neuen Unit-Tests zunächst prüfen, wie `scripts/run-tests.mjs` diese entdeckt.

Validierung während der Implementierung: gezielte neue Tests und betroffene Regressionen, anschließend `npm run test:fast`, relevante Playwright-Szenarien und `npm run build`. Dieser Dokumentationsschritt selbst erfordert keinen App-Build.

## 9. Abgrenzung zur späteren KI-Version

Keine vierte Projektart, kein neuer KI-Menüeintrag und keine Änderung an Modellkonfiguration oder KI-Generierung in diesem Arbeitspaket. Die zentrale Fähigkeitsstruktur kann später eine separate KI-Freigabe aufnehmen. Vorhandene KI- und AgentScript-Zugänge bleiben zunächst bestehen; erzeugte oder importierte Inhalte unterliegen trotzdem den fachlichen Anforderungen des ausgewählten Projekttyps.

## 10. Fertigstellung

Die Umsetzung ist abgeschlossen, wenn die drei Datei-Einträge den Projekttyp festlegen, jede betroffene Oberfläche denselben Filter verwendet, Speichern und erneutes Öffnen diesen Typ erhalten und vorhandene Projektinhalte durch Filterung nicht verloren gehen. Die oben ausdrücklich markierten Planungsannahmen und Grenzfälle sind vor Änderungen an den betreffenden Pfaden zu bestätigen oder anhand ihrer tatsächlichen Verwendung zu präzisieren.
