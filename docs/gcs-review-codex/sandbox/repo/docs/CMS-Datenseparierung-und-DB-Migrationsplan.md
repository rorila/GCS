# CMS-Datenseparierung und Vorbereitung der Datenbankmigration

Stand: 13.10.2026

Status: Erweiterter Architektur- und Umsetzungsplan nach der Abstimmung zum Betrieb auf Fly.io. Die Grundentscheidungen aus Abschnitt 1.1 sind festgelegt; technische Betriebswerte sind empfohlene Start-/Abnahmeziele, keine bereits nachgewiesene Kapazität. Der Auftrag betrifft ausschließlich die Planung, nicht die Implementierung, Migration, Änderung produktiver Daten oder Ausführung von Deployments.

## 1. Ziel und zentrale Empfehlung

Die CMS-Daten werden fachlich getrennt, bleiben aber hinter einer gemeinsamen Speicher- und Transaktionsgrenze. Die Fachlogik soll nicht davon abhängen, ob ein Bestand heute in JSON-Dateien oder später in Datenbanktabellen liegt.

**Empfehlung:**

1. Fachbereiche, Referenzen und gemeinsame Geschäftsoperationen beschreiben.
2. Einen gemeinsamen serverseitigen CMS-Store als einzigen koordinierten Schreibpfad erhalten und dessen Vertrag festigen.
3. Fachbezogene Abfragen und Transaktionen schrittweise hinter dieser Grenze kapseln.
4. Keine zusätzlichen JSON-Bereichsdateien einführen; die aktuelle JSON-Ablage nur bis zum kontrollierten DB-Import erhalten.
5. Direkt nach SQLite migrieren und erst danach Lerninhalte/Lernstände als gesonderte Etappe normalisieren.

Keine unabhängige JSON-Datenbank pro Sammlung, Person oder Haus aufbauen. Die Separation erfolgt fachlich in Modulen und Tabellen einer gemeinsamen Datenbank, nicht durch neue Dateidatenbanken.

### 1.1 Festgelegte Grundentscheidungen

| Entscheidung | Planungsfestlegung |
| --- | --- |
| Hosting | Docker-Container auf Fly.io mit einer aktiven Fly Machine und persistentem Volume. |
| Parallelität | Mehrere Nutzer spielen und entwickeln gleichzeitig; genau eine aktive CMS-Instanz koordiniert dauerhafte CMS-Schreiboperationen. |
| Datenbank | SQLite als Ziel, eine gemeinsame DB für die CMS-Fachbereiche. Kein aktiver Mehrserverbetrieb oder verteiltes SQLite-Schreibmodell. |
| Migrationsweg | Logische Speichergrenze vorbereiten, dann direkt JSON → SQLite; kein zusätzlicher physischer JSON-Split. |
| Reihenfolge | Bestehende Fachbedeutung beim Adapterwechsel erhalten; weitergehende Trennung von Karteninhalt und persönlichem Lernstand danach. |
| Dauerhaftigkeit | Fachänderungen unmittelbar transaktional speichern; Erfolg erst nach bestätigtem Commit. WAL, `synchronous=FULL` und aktivierte Fremdschlüssel als Produktionsbasis. |
| Sicherung | Eigene konsistente, externe Backups einschließlich benötigter Dateien. Fly-Volume-Snapshots nur als zusätzliche Sicherung. |
| Verfügbarkeit | Kein Hochverfügbarkeitsversprechen: eine Machine kann bei Deployment oder Hardwareausfall vorübergehend ausfallen. Wiederanlauf und Restore sind Pflicht. |

Eine einzelne Instanz bedeutet nicht nur einen gleichzeitigen Benutzer. SQLite kann parallele Reads und kurze serialisierte Writes bedienen; die Lastziele aus Abschnitt 8.6 sind praktisch nachzuweisen. Die Empfehlung weicht bewusst von Fly.io's Redundanzempfehlung mehrerer Machines/Volumes ab und setzt deshalb externe Sicherung und akzeptierte Unterbrechungen voraus.

### 1.2 Beziehung zum Fly.io-Rollout

`Flyio-Migrationsplan.md` beschreibt Container, Routing und Betrieb; dieser Plan bestimmt die CMS-Persistenz und den DB-Cutover. Ein Fly-Stagingbetrieb mit der vorhandenen JSON-Quelle kann den Deploymentpfad prüfen, ist aber nicht die Abnahme des SQLite-Zielbetriebs. Hostingumzug und Speicherwechsel getrennt testen; produktive SQLite-Aktivierung erst nach DB-Import-/Recoveryabnahme.

## 2. Bezug zu vorhandenen Plänen

- `CMS-Plan.md`, Abschnitt 6.2: E03 sieht JSON zunächst und die Vorbereitung einer späteren SQLite-Migration vor. Die inzwischen abgestimmte nächste Etappe konkretisiert diese Option zu SQLite für eine aktive CMS-Instanz auf Fly.io; JSON bleibt bis zum freigegebenen Cutover die Quelle.
- `Flyio-Migrationsplan.md`: persistentes Volume, eine aktive Machine, kontrollierter Start/Shutdown, unabhängige Backups und getrennt getesteter Hosting-/DB-Umzug.
- `CMS-Entwickler-Umsetzungsplan.md`: neue Entwicklerprojekte, Freigaben, Medienmetadaten, Release-Zustimmungen und Idempotenzbelege müssen dieselbe Speichergrenze verwenden.
- `CMS-Sponsor-Umsetzungsplan.md`: atomare Vereinbarungs-, Leistungs- und Belohnungsabläufe sowie dauerhafte Nachweise erhalten.
- `DEVELOPER_GUIDELINES.md`: GCS-Konformität, systemweite Auswirkungsanalyse, Modularisierung, Projekt-SSoT und Regressionen beachten.

Der Datenbestand `game-server/data/cms-v1.json` ist nicht das deklarative GCS-Projekt `game-server/public/projects/GCS-CMS.json`. Dieser Plan separiert Fachdatensätze, nicht Stages/Tasks/Actions des CMS-Projekts. Die spätere DB speichert keine alternative Workflow-Architektur.

## 3. Ausgangslage

### 3.1 Inhalt der Hauptdatei

`cms-v1.json` enthält wesentlich mehr als Rollenverknüpfungen:

- Personen- und Organisationsstammdaten;
- Rollen, Mitgliedschaften, Familienbeziehungen und Zugänge;
- Spielekatalog und Spielzuordnungen;
- tatsächliche Lerninhalte samt persönlichen Lernständen;
- Bewertungsregeln und Leistungsbuchungen;
- Sponsoring-, Zustimmungs- und Belohnungsbestände;
- Anfragen und technische Verwaltungs-/Wiederherstellungsinformationen.

Bei der vorausgehenden Analyse enthielt die Datei Schemaversion 9, 10 Personen, 21 Rollenzuordnungen, 140 Karteikarten, 9 Kartenstapel und 18 Leistungsbuchungen. Diese Zahlen sind eine Momentaufnahme, keine Zielgröße oder Migrationsannahme. Produktive Inhalte und Zugangswerte werden nicht in diesen Plan übernommen.

### 3.2 Bereits vorhandene Separation

Der aktuelle `scripts/cms/cms-store.cjs` trennt:

| Speicher | Zweck |
| --- | --- |
| `cms-v1.json` | Hauptbestand ohne die explizit ausgelagerten Ops-Sammlungen. |
| `cms-v1-ops.json` | `playSessions`, `parties`, `gameInvitations`, `notifications`, `temporaryRoomAccess`, `progress`. |
| `cms-v1-log.jsonl` | Append-only Auditprotokoll fachlicher Aktionen. |
| Kontozugangsdatei | Separater Zugangsdatenbestand; im aktuellen Server `cms-admin-auth.json`. |
| Projekt-/Upload-/Medienablagen | Projektinhalte und Binärdateien außerhalb des Hauptdatensatzes. |

Im Arbeitsspeicher bilden Haupt- und Ops-Datei weiterhin ein gemeinsames `db`-Objekt. Der Dateiname `cms-v1.json` beschreibt nicht die aktuell enthaltene Schemaversion.

### 3.3 Tatsächlicher Commitvertrag und Grenzen

Der aktuelle Store führt eine Änderung auf einer Kopie des gemeinsamen Zustands aus, verwirft fachlich abgelehnte Ergebnisse, validiert, persistiert und übernimmt den neuen Zustand anschließend in das laufende `db`-Objekt. Ein Pending-Journal ermöglicht den Wiederanlauf eines unterbrochenen Zwei-Dateien-Commits.

Das ist eine vorhandene Grundlage, kein Nachweis einer universellen Mehrdateien-Transaktion:

- das Journal kennt derzeit konkret Haupt- und Ops-Bestand;
- Fachmodule lesen und bearbeiten vielfach direkt Arrays des gemeinsamen `db`-Objekts;
- der Audit-Logeintrag erfolgt nach dem persistierten Fachzustand und kann bei einem Abbruch dazwischen fehlen;
- nicht jede zusätzliche Zugangsdaten- oder Binärdatei ist automatisch Teil dieser Transaktion;
- direkte Leser der Einzeldateien könnten bei einem unterbrochenen Mehrdateien-Schreiben einen Zwischenstand sehen.

Bei der Vorbereitung zwischen dem gewünschten Adapterprinzip und dem aktuellen Implementierungsstand unterscheiden. Eine bloße neue Interfacebezeichnung macht diese Grenzen nicht verschwinden.

**Sofortiges Schreiben ist nicht unabhängige Sicherung:** Der aktuelle Commit schreibt synchron vor Ergebnisrückgabe. `fs.writeFileSync()` allein garantiert aber keine physische Dauerhaftigkeit bei Strom-/Betriebssystemausfall; im geprüften `atomicWrite`-Pfad fehlt ein explizites `fsync`. Ein gewöhnlicher Prozessneustart mit intaktem Speicher ist deshalb von Volume-/Datenträgerverlust und Wiederherstellung eines älteren Backups zu unterscheiden. Die SQLite-Zielkonfiguration verbessert den Dauerhaftigkeitsvertrag, ersetzt jedoch keine externen Backups.

## 4. Logische Datenbereiche

Die Bereiche dienen der Zuständigkeit, den Abfragen und den späteren Tabellen. Sie sind keine unabhängigen Services oder Datenbanken.

| Bereich | Zugeordnete Daten | Eigenschaften |
| --- | --- | --- |
| **Identität und Organisation** | `people`, `areas`, `memberships`, `roles`, `guardians`. | Stabile Identitäten, Hierarchien und wirksame Beziehungen; aktive und historische Zustände unterscheiden. |
| **Zugang und Berechtigungen** | `codes`, `invites`, `deviceGrants`, Kontozugangsdaten; künftig Entwickler- und Medienfreigaben. | Zweckgebunden, widerrufbar, sensibel; keine implizite Offenlegung in Listen oder Logs. |
| **Spielekatalog und Verfügbarkeit** | `games`, `grants`; künftig veröffentlichte Releases und deren Haus-/Raumverfügbarkeit. | Eigentümer, Version, Veröffentlichung und Raumzuordnung getrennt erhalten. |
| **Lernen und Spielzeitregeln** | `cardDecks`, `flashcards`, persönliche Lernstände/Lernversuche, `performanceRuleVersions`, `timeBudgets`. | Inhalte, Zustand und Bewertungsregeln logisch unterscheiden; Lernzeit und Spielzeit nicht ungeprüft gleichsetzen. |
| **Sponsoring und Belohnungslebenszyklus** | `sponsorshipRequestCapabilities`, `sponsorships`, `sponsorAccessVersions`, `sponsorAgreements`, `sponsorAgreementVersions`, `sponsorApprovals`, `rewardClaims`. | Zustandsübergänge, Versionen, Quoren und erreichte Ansprüche. |
| **Buchungen und dauerhafte Nachweise** | `performanceLedger`, `rewardPointEntries`, `sponsorEvents`, `sponsorCommandReceipts`; später weitere Idempotenzbelege und erforderliche Transaktionsereignisse. | Append-only oder versionsbasiert; Gegenbuchungen und Eindeutigkeit statt stiller Historienüberschreibung. |
| **Betrieb und Kommunikation** | `playSessions`, `parties`, `gameInvitations`, `temporaryRoomAccess`, `progress`, `notifications`, `sponsorMessages`, `profileRequests`. | Unterschiedliche Aufbewahrung je Typ; nicht alles hier ist flüchtig oder technisch entbehrlich. |
| **Technische Verwaltung** | `version`, `meta`, `roomBackups`, Migrationshistorie, Lösch-/Widerrufsbelege, Backupmanifeste. | Von normalen Fachdatensätzen unterscheiden; Sicherung und fachliche Wiederherstellung getrennt behandeln. |

Die finale Zuordnung kann feinere Unterbereiche haben. Beispielsweise sind Spielzeitregeln ein eigener Regeltyp und Sponsor-Kontaktfähigkeiten zugleich Zugangsrechte; pro Sammlung muss dennoch genau ein kanonischer Speicherzuständiger festgelegt sein. Die Tabelle beschreibt die empfohlene primäre Zuordnung.

**Keine Lebenszyklusentscheidung nur aus dem Bereich ableiten:** Benachrichtigungen, Mitteilungen, Leistungsmeldungen und Sitzungsabrechnung können fachlich relevante Historie sein. Sie dürfen nicht gemeinsam pauschal als kurzlebige Ops gelöscht oder bei Restore beliebig verworfen werden.

## 5. Gemeinsame Transaktionen über Bereichsgrenzen

### 5.1 Beispiel Kartenantwort

Die aktuelle Kartenbewertung in `scripts/cms/cms-card-points.cjs` kann in einem Commit:

1. den wirksamen Lernversuch prüfen;
2. den persönlichen Leitner-Lernstand ändern;
3. eine Fortschrittsmeldung anlegen;
4. eine bestätigte beziehungsweise gemeldete Leistungsbuchung erzeugen;
5. Sponsoransprüche auswerten;
6. das Antwortergebnis für eine idempotente Wiederholung hinterlegen.

Diese Änderungen müssen weiterhin gemeinsam erfolgreich sein oder gemeinsam verworfen werden. Eine Datei-/Tabellengrenze ist keine neue fachliche Commitgrenze.

### 5.2 Weitere bereichsübergreifende Operationen

| Operation | Zusammengehöriger Zustand |
| --- | --- |
| Einladung einlösen | Ticketverbrauch, Kontoeinrichtung und aktivierte Rolle. Zugangsdatenablage explizit in das Konsistenzkonzept einbeziehen. |
| Sponsorzustimmung | Zustimmung zu genau einer Version, wirksame Vereinbarung und gegebenenfalls Anspruchsauswertung. |
| Belohnung erfüllen | Anspruchszustand, erforderliche Bestätigung, Punkte-/Verbrauchsbuchung und Wiederholungsbeleg. |
| Spielsitzung beenden | Minuten-/Sitzungszustand, beendete Berechtigung und konsistente Endeantwort; flüchtige Launch-Maps nach Commit abgleichen. |
| Entwicklerprojekt kopieren | Neue Projektidentität, Herkunfts-/Rechtebelege und verwendbare Medienversionen. |
| Spiel veröffentlichen | Release-Version, aktuelle Eigentümerzustimmung, administrative Veröffentlichung und optionaler persistenter Zustellauftrag. |

### 5.3 Zielvertrag

- Es gibt einen koordinierten Store und eine gemeinsame Transaktion/Unit of Work.
- Fachrepositories arbeiten innerhalb desselben Transaktionskontexts; keine autonomen Commits pro Repository.
- Berechtigung, aktuelle Revision und Idempotenz werden innerhalb der wirksamen Transaktionsentscheidung erneut geprüft.
- Antwort erst nach erfolgreicher Persistenz. Lokaler Cache oder vorbereitete Dateien sind keine Commitbestätigung.
- Externe Nachrichten oder andere nicht rückrollbare Nebenwirkungen nicht mitten in der Transaktion ausführen; persistente Outbox und idempotente Verarbeitung nutzen.
- Flüchtige Caches und Launchberechtigungen sind keine alleinige Quelle für dauerhafte Rechte. Nach Commit/Wiederanlauf müssen sie zum persistierten Zustand passen.

## 6. Serverseitige Speichergrenze und Fachzugriffe

### 6.1 CMS-Store ist nicht der Editor-Speicheradapter

`src/ports/IStorageAdapter.ts` beschreibt die clientseitige GCS-Projektpersistenz. Er ist nicht automatisch der Port für die serverseitigen CMS-Daten.

Empfohlene eigenständige Serververträge, Namen vorläufig:

- `ICmsStore`: Öffnen, Schema-/Speicherstatus, konsistente Reads und gemeinsame Transaktionen;
- `ICmsTransaction`: transaktionsgebundene Fachzugriffe und Idempotenz-/Ereignisbelege;
- Fachrepositories für Personen/Organisation, Katalog, Lernen, Sponsoring und Buchungen;
- Snapshot-/Restore-Service mit expliziten fachlichen Richtlinien, nicht beliebigem `save(backup)`.

Keine allgemeine SQL- oder Dateipfad-API in GCS-Tasks veröffentlichen. Fachmethoden bleiben registrierte Komponentenoperationen; Repositories sind interne Persistenzhilfen, keine parallele Controllerarchitektur.

### 6.2 Schrittweise Kapselung

Zunächst gezielte Zugriffe formulieren, beispielsweise:

- aktive Rollenzuordnungen einer Person ermitteln;
- spielbare Veröffentlichungen in einem Raum bestimmen;
- Karte samt persönlichem Lernstand laden;
- wirksame Vereinbarungsversion und Zustimmungsliste ermitteln;
- Lernereignis/Anspruch genau einmal buchen.

Die erste Implementierung darf auf dem vorhandenen gemeinsamen In-Memory-Zustand arbeiten. Direkte `db.*`-Zugriffe schrittweise nach Geschäftsoperation ersetzen, nicht in einem Big-Bang-Refactoring. Besonders sensible und häufige Operationen zuerst umstellen.

### 6.3 Keine dauerhafte Vollsnapshot-SQL-Lösung

Ein späterer SQL-Adapter soll gezielte Reads und Änderungen innerhalb einer DB-Transaktion ermöglichen. Die gesamte DB für jede Operation in ein Objekt laden und danach alle Tabellen ersetzen wäre allenfalls eine klar befristete Übergangslösung, keine erfolgreiche DB-Zielarchitektur.

Das aktuelle Clone-/Callbackmodell ist nicht automatisch in effiziente SQL-Transaktionen übersetzbar. Vor Adapterwechsel müssen die betroffenen Fachoperationen über überprüfbare transaktionsgebundene Zugriffe verfügen.

### 6.4 Synchronität und Requestkontext

Die aktuelle CMS-Runtime und viele registrierte Methoden arbeiten synchron. Wird ein asynchroner DB-Treiber gewählt, müssen Runtime, Methodenvertrag, Commit und Antwortversand gemeinsam dafür angepasst werden. Eine Promise darf nicht unbemerkt als Fachresultat in einer Taskvariablen landen.

Ein synchroner SQLite-Treiber kann den ersten Übergang erleichtern, ist aber keine vorgeschriebene Bibliothekswahl. Blockierungszeit und Last testen. Reads in einer Operation müssen einen konsistenten Stand besitzen; das gemeinsame In-Memory-Objekt darf bei mehreren Prozessen nicht zu einer veralteten autoritativen Rechtequelle werden.

## 7. Entschieden: kein weiterer physischer JSON-Split

Die zuvor erwogene Aufteilung in `cms-core.json`, `cms-catalog.json`, `cms-learning.json`, `cms-sponsoring.json` und `cms-ledger.json` wird nicht umgesetzt. Sie würde einen zusätzlichen Mehrdateien-Commit-, Recovery- und Backupvertrag benötigen, der beim unmittelbar vorgesehenen SQLite-Wechsel wieder abgelöst würde.

Die vorhandene Haupt-/Ops-Aufteilung bleibt ausschließlich bis zum kontrollierten Import erhalten. Ihre Journal-/Restoregrenzen weiter absichern, aber keine neue allgemeine Dateidatenbank entwickeln. Die fachlichen Bereiche aus Abschnitt 4 werden Repositoryzuständigkeiten und Tabellen derselben SQLite-DB.

Für die Quelle gelten weiterhin:

- vollständige Inventur von Haupt-/Ops-Dateien, Zugängen, Löschbelegen und erforderlichen Dateireferenzen;
- Journal-Recovery vor Import beziehungsweise Bestandsfreigabe;
- korrupte Dateien nicht stillschweigend als leere Bestände ersetzen;
- keine unabhängigen Writer oder unkoordinierten Dateileser während finaler Sicherung/Import;
- keine Entfernung der Altquelle vor geprüfter Migration und gesondert freigegebenem Aufbewahrungs-/Löschprozess.

Ein zukünftiger Wechsel zurück zu weiterer JSON-Separation oder verteilten Writern wäre eine neue Architekturentscheidung, nicht ein automatischer Fallback dieses Plans.

## 8. Datenbank-Zielmodell

### 8.1 Speicherwahl

SQLite ist die festgelegte Zieldatenbank für eine zentrale aktive CMS-Instanz auf Fly.io. Eine gemeinsame DB liegt auf einem persistenten lokalen Fly Volume; die Fachbereiche werden nicht auf unabhängige SQLite-Dateien verteilt.

Mehrere Browser können gleichzeitig spielen, Heartbeats senden oder Entwicklerprojekte speichern. WAL verbessert die Parallelität von Lesen und Schreiben, SQLite erlaubt jedoch weiterhin nur eine aktive Schreibtransaktion gleichzeitig. Die CMS-Instanz hält Transaktionen kurz und koordiniert Writes; dauerhafte Warteschlangen nicht nur im Arbeitsspeicher bestätigen.

SQLite-Dateien nicht als frei geteilten Schreibbestand mehrerer verteilter Server behandeln. Ein später erforderlicher Mehrserverbetrieb würde Speicher-, Sitzungs-, Upload- und Multiplayerarchitektur erneut zur Entscheidung stellen; er ist kein Lieferziel dieser Etappe.

### 8.2 Tabellen statt unabhängiger Datenbanken

Die logischen Bereiche werden vorzugsweise Tabellen/Module in derselben Datenbank. Dadurch bleiben bereichsübergreifende Transaktionen, Fremdschlüssel und eindeutige Constraints einfach durchsetzbar.

Beispiele für spätere Tabellenfamilien:

- Personen, Bereiche, Mitgliedschaften, Rollen und Erziehungsbeziehungen;
- Zugänge, zweckgebundene Einladungen und Geräteberechtigungen;
- Spiele, Releases und Bereichsfreigaben;
- Karteninhalte/-versionen, persönliche Lernstände und Lernversuche;
- Regelversionen und Leistungsbuchungen;
- Sponsorships, Vereinbarungen, Zustimmungen, Ansprüche und Punktebuchungen;
- Sitzungen, Partien, Nachrichten, Outbox und Kommandobelege.

Nicht sämtliche Fachbestände in eine einzige SQL-Tabelle mit einem großen JSON-Blob verschieben. Stabile Beziehungen, Eindeutigkeit und häufig abgefragte Felder relational abbilden; flexible GCS-Projektinhalte dürfen einen klar versionierten JSON-Dokumentvertrag behalten.

### 8.3 IDs, Constraints und Indizes

- Bestehende stabile IDs erhalten; keine Beziehungen über Anzeigenamen oder Dateipfade.
- Fremdschlüssel und fachlich geeignete Löschregeln setzen; keine pauschalen Cascade-Löschungen von historischen Buchungen.
- Eindeutigkeit von Rollen-/Zuordnungsidentitäten, Quellereignissen, Anspruchsschlüsseln und Kommandobelegen explizit definieren. Historische/inaktive Records bei der Constraintwahl berücksichtigen.
- Revisionen serverseitig erhöhen; erwartete Revision mit dem Update atomar vergleichen.
- Unveränderliche Regel-/Releaseversionen nach Veröffentlichung nicht in place ändern.
- Indizes aus tatsächlichen Abfragen ableiten, etwa Kind + Karte, Person + aktive Rolle, Raum + Spiel, Quellereignis und Anspruchsschlüssel.
- Parametrisierte Abfragen und begrenzte Transaktionen verwenden; technische DB-Ausnahmen in sichere fachliche Fehler übersetzen.

### 8.4 Projekt- und Mediendateien

Bilder, Audio, Videos und größere Projekt-Snapshots müssen nicht sämtlich als große DB-BLOBs gespeichert werden. Empfehlung: geschützte Datei-/Objektablage, DB für Metadaten, Rechte, Versions-/Hashbezüge und aktivierte Referenzen.

DB-Transaktion und Dateischreiben sind nicht automatisch atomar. Inhalte zunächst privat und unveränderlich vorbereiten; Referenzen erst bei erfolgreichem Commit aktivieren. Verwaiste Inhalte später kontrolliert bereinigen. Backup/Restore muss die referenzierten Inhalte mit berücksichtigen.

### 8.5 SQLite-Betriebsvertrag auf Fly.io

Empfohlene Zielablage: `/data/cms/cms.sqlite`. Der Name ist ein Konfigurationsvorschlag, keine bereits existierende Datei. `cms.sqlite-wal` und `cms.sqlite-shm` liegen im selben beschreibbaren Volumeverzeichnis. Projekt-/Upload-/Medieninhalte erhalten eigene private Pfade auf `/data` beziehungsweise geprüfter geschützter Objektablage.

| Einstellung/Regel | Produktionsbasis |
| --- | --- |
| `journal_mode` | `WAL`; Rückgabewert nach Initialisierung prüfen, eine abweichende Betriebsart nicht still akzeptieren. |
| `synchronous` | `FULL` auf jeder relevanten Verbindung; ein erfolgreicher Commit fordert die WAL-Synchronisierung an. Nicht still auf `NORMAL`/`OFF` reduzieren, um Lasttests zu bestehen. |
| `foreign_keys` | `ON` je Verbindung, bevor Transaktionen beginnen. Zusätzlich fachliche Validierung und gezielte Constraints. |
| Schreibzugriff | Ein aktiver CMS-Writerdienst. Andere interne Dienste erhalten keinen unabhängigen CMS-Mutationspfad. Backup-/Leserverbindungen sind keine zweite aktive CMS-Instanz. |
| Transaktionsbeginn | Für bekannte Schreibvorgänge frühzeitig den Write-Lock erwerben, zum Beispiel `BEGIN IMMEDIATE`, und Rechte/Revision/Idempotenz innerhalb dieser Entscheidung prüfen. |
| Sperrkonflikte | Kurze begrenzte Wartezeit; Startwert `busy_timeout` 250 ms. Höchstens zwei zusätzliche Wiederholungen bei passenden Busy-Konflikten, mit kurzer Rückstellung und absoluter Requestfrist. Nach Rollback den gesamten sicheren Fachvorgang erneut prüfen. |
| Fehlerantwort | Bei nicht auflösbarem temporärem Konflikt wiederholbaren Fehler mit Idempotenzkontext liefern; keine Erfolgsmeldung. Kein Retry für Rechtefehler, Validierungsfehler, vollen Datenträger oder Korruption. |
| WAL-Checkpoint | Kontrolliert überwachen; lang laufende Reads und WAL-Wachstum vermeiden. Auto-/Passive-Checkpoint zunächst verwenden und unter Last messen; kein erzwungenes `TRUNCATE` nach jedem Commit. |
| Start | Gemountetes Volume, vorhandene DB, kompatibles Schema und wirksame PRAGMAs prüfen. Fehlende DB nicht als Anlass für stillen Demo-Neustart behandeln. |
| Shutdown | Neue Mutationen stoppen, laufende Transaktionen innerhalb der Shutdownfrist abschließen oder zurückrollen, DB-Verbindungen schließen. WAL-Dateien niemals zur „Bereinigung“ manuell löschen. |

Bei synchronem Treiber blockiert Busy-Warten möglicherweise den Node-Eventloop. Timeout-/Retrywerte und Backupschritte daher gemeinsam mit WebSocket- und Sprachlast testen; bei Bedarf gezielte Worker-/Treiberintegration vorsehen, ohne einen zweiten autoritativen CMS-Writer zu starten. Eine abgebrochene Requestverbindung beweist nicht, dass eine Transaktion nicht committed wurde; der Wiederholungsbeleg entscheidet.

`FULL` beschreibt eine Dauerhaftigkeitsanforderung an SQLite/Dateisystem, keine Garantie gegen Hardwaredefekte, verlorenes Volume, fehlerhafte Storageimplementierungen oder unberechtigte Änderungen. Für einen reinen Prozessabsturz mit intaktem Volume sollen alle bestätigten DB-Commits erhalten bleiben. Ein Commit kann im WAL stehen; ein vorheriger Checkpoint in die Hauptdatei ist dafür nicht erforderlich.

Bibliothekswahl vor der Implementierung auf Node-/Linux-/Desktopkompatibilität, tatsächliche SQLite-Version, Backup-API, native Buildabhängigkeiten und Releasealter prüfen. Keine konkrete neue Dependency durch diesen Plan automatisch installieren.

### 8.6 Last- und Betriebsabnahme

Ausgangspunkt ist das bereits im `CMS-Plan.md` vereinbarte Pilotziel: 10 Häuser, 1.000 Konten, 100 gleichzeitig aktive Spieler und 20 parallele kleine Multiplayer-Partien. Normale CMS-Anfragen sollen im dokumentierten Testaufbau zu 95 % unter einer Sekunde liegen. Das sind Abnahmeziele, keine vorhandene Kapazitätszusage.

Als ergänzendes Startprofil zehn gleichzeitig aktive Entwickler mit wiederkehrenden Autosaves und Medienzugriffen prüfen. Diese technische Empfehlung ist bei Staging anhand realistischer Projektgrößen anzupassen. Gleichzeitige Zahlen nicht blind addieren; Konto-/Nutzerprofile und tatsächlich erzeugte Last dokumentieren.

- Gemischte Last aus Login/Rollenprüfung, Heartbeats, Lernantworten, Sponsor-/Belohnungsoperationen, Multiplayer und Entwickler-Saves testen.
- Burst gleicher und unterschiedlicher Lernereignisse prüfen; keine verlorenen Updates, Doppelbuchungen oder teilweise erfüllten Ansprüche.
- Echtzeitbewegung/Input nicht ungeprüft als einzelne dauerhafte DB-Buchung persistieren. Dauerhafte Fachereignisse, Wiederverbindungsstände und Spielzeitabrechnung explizit definieren; eine bestätigte relevante Mutation nicht später still fallenlassen.
- Transaktionsdauer, Busy-Konflikte, Requestlatenz, Node-Eventloop, WAL-/DB-Größe und Disk-I/O messen.
- Piper/Whisper-Jobs und Backup gleichzeitig testen, jedoch mit eigenen Latenz-/Parallelitätskriterien; Sprachinferenz und Dateitransfers nie innerhalb einer DB-Transaktion ausführen.
- Volumenwarnung als Startwert bei 80 % Belegung, kritisch bei 90 %. Vor Upload-/Backupfehlern ausreichenden Arbeitsraum sicherstellen; persistente Buchungen nicht automatisch löschen.
- Vertikal innerhalb der einen Machine skalieren, wenn Messungen es erfordern. Kein automatischer zweiter CMS-Writer als Lastkorrektur.

Machinegröße, Kostenbudget und Volumegröße werden vor Produktivfreigabe anhand dieser Messungen festgelegt. Ein einzelner Compiler-/Unit-Testlauf weist weder Last noch Cloud-Dauerhaftigkeit nach.

## 9. Lerninhalt, Lernstand und Lernversuch trennen

`flashcards` verbindet aktuell Frage/Antwort mit persönlichem Leitner-Zustand. Für das DB-Zielmodell empfehlen sich vier logische Datensatztypen:

| Typ | Inhalt |
| --- | --- |
| Karteninhalt/-version | Frage, Antworten, Fach/Thema, Antwortformat, Ersteller und Inhaltsversion. |
| Persönlicher Lernstand | Kind, Karte beziehungsweise Inhaltsversion, Leitner-Fach, Aktivstatus und letzter Lernzeitpunkt. |
| Lernversuch | Sitzung, geprüfter Inhalt/Lernstand, Versuchssignatur, Antwortresultat und Wiederholungskennung. |
| Leistungsbuchung | Ereignis, bestätigte Bewertung, Punkteänderung, damalige Regelversion und gegebenenfalls Gegenbuchung. |

Diese Normalisierung ist ein eigener Migrationsschritt, nicht zwingend gleichzeitig mit dem Speicheradapterwechsel. Zunächst vorhandene Records semantisch erhalten; danach mit Tests normalisieren.

- Persönlich bearbeitete Karten nicht aufgrund gleicher Fragetexte zusammenlegen.
- Gemeinsamen Inhalt nur dann deduplizieren, wenn Herkunft und fachliche Identität belastbar bekannt sind.
- Historische Buchungen bleiben an ihren damaligen Inhalt/Lernstand und die damalige Regel gebunden.
- Laufende Versuche nach Inhaltsänderung oder Migration korrekt invalidieren oder konsistent übernehmen.
- Kopieren eines Stapels überträgt nicht automatisch den persönlichen Lernfortschritt eines anderen Kindes.
- Leitner-Fach 6, Rückfallregeln, abgeschlossene Karten und bestehende Lernpunktesummen unverändert nachweisen.

## 10. Versionsbegriffe und Idempotenz

| Begriff | Bedeutung |
| --- | --- |
| Daten-/DB-Schemaversion | Struktur des gespeicherten Datenmodells und angewandte Migrationen. |
| Speicherlayoutversion | Zuordnung der JSON-Bereichsdateien beziehungsweise Importformat; unabhängig von Fachrevisionen. |
| Datensatzrevision | Optimistische Konkurrenzkontrolle eines veränderlichen Datensatzes. |
| Regel-/Projekt-/Releaseversion | Fachlich unveränderlicher Stand, auf den Prüfung und Zustimmung Bezug nehmen. |
| Transaktion/Generation | Konsistenter Commitstand eines koordinierten Speichers. |
| Backupformatversion | Aufbau und Vollständigkeit eines Sicherungspakets. |

Diese Begriffe nicht in einem einzigen Feld `version` vermischen.

Idempotenzschlüssel sind an Akteur, Operation und gegebenenfalls Ziel zu binden. Nutzlastsignatur und Ergebnis gehören zum Beleg. Wiederholung gleicher Nutzlast liefert dasselbe Ergebnis; geänderte Nutzlast mit gleichem Schlüssel wird abgewiesen. Zugriff bei Ergebniswiederholung erneut prüfen, damit ein alter Beleg kein widerrufenes Leserecht ersetzt.

## 11. Backup, Restore, Audit und Datenschutz

### 11.1 Sicherung und Wiederherstellung unterscheiden

Eine technische Gesamtsicherung soll einen konsistenten Gesamtstand einschließlich Schema-/Layoutversion und benötigter Medienreferenzen dokumentieren. Drei Vorgänge ausdrücklich unterscheiden:

| Vorgang | Ziel und Grenze |
| --- | --- |
| Prozess-/Machine-Neustart bei intaktem Volume | SQLite-Recovery und geordneter Wiederanlauf; kein Zurückspielen eines älteren Backups. Bestätigte Commits bleiben erhalten. |
| Technische Komplettwiederherstellung nach Volumeverlust/Korruption | Einen vollständigen gültigen DB-/Dateistand auf neuer Ablage wiederherstellen; Datenverlust seit der jüngsten verfügbaren konsistenten Sicherung ist möglich. |
| Fachliche Korrektur im laufenden Bestand | Einzelne Änderungen nachvollziehbar korrigieren, ohne den gesamten Bestand oder andere Buchungen zurückzudrehen. |

Der aktuelle JSON-Store behält Ops-Daten bei seinem fachlichen Restore und vereinigt bestimmte Sponsor-Endzustände/Buchungen. Diese vorhandene Semantik als gesonderten Fachrestore behandeln, nicht ungeprüft auf ein technisches Disaster Recovery übertragen. Nach vollständigem Volumeverlust existiert möglicherweise kein aktueller Zustand, aus dem spätere Endzustände noch vereinigt werden könnten.

### 11.1.1 Unabhängige SQLite-/Dateisicherungen

- Konsistente SQLite-Sicherung über Online Backup API oder einen gleichwertig geprüften treibergestützten Mechanismus erzeugen. `VACUUM INTO` ist eine mögliche Alternative, deren I/O-/Lockverhalten gesondert zu messen ist.
- Niemals nur die geöffnete `.sqlite`-Hauptdatei kopieren und das WAL ignorieren. Auch unkoordiniertes Kopieren von Hauptdatei und WAL ersetzt keinen konsistenten Snapshot.
- Während eines Backups benötigte unveränderliche Projekt-/Medienversionen vor Cleanup schützen. Ein Manifest verbindet DB-Backup, Inhaltshashes, Schema, Image-/Runtimeversion, Snapshotzeitpunkt und Vollständigkeitsstatus. Dateien/Objekte vor einem als vollständig veröffentlichten Sicherungsmanifest übertragen.
- Verschlüsselte Übertragung und verschlüsselte, zugriffsgeschützte Ablage außerhalb des produktiven Volumes, bevorzugt in separatem Objektstorage-Konto/Bucket mit begrenzten Zugangsschlüsseln. Backupschlüssel und Wiederherstellungsanleitung dürfen nicht nur auf derselben Machine liegen; Entschlüsselung und Zugang in der Restoreprobe praktisch prüfen.
- Ein Backup gilt erst als verfügbar, wenn DB-Snapshot, referenzierte Dateien und Manifest extern bestätigt sind. Lokale temporäre Kopie oder gestarteter Upload ist kein erfolgreicher Sicherungsstand.
- Fly-Volume-Snapshots aktiviert lassen, aber nur als zusätzliche Notfalloption. Fly.io weist selbst darauf hin, dass sie kein primärer eigener Backupplan sind.

**Empfohlene Startwerte, vor Produktivbetrieb zu testen:**

| Parameter | Empfehlung |
| --- | --- |
| Sicherungsintervall | Alle 10 Minuten ein konsistenter DB-Snapshot mit den benötigten Dateiversionen/Manifesten extern bereitstellen; keine überlappenden unkontrollierten Backupjobs. |
| RPO bei vollständigem Volumeverlust | Ziel: höchstens 15 Minuten Datenverlust, gemessen am Datenzeitpunkt des jüngsten vollständigen extern verfügbaren Backups. Nur bei nachgewiesen eingehaltenem Sicherungsbetrieb; keine Garantie durch das Intervall allein. |
| Aufbewahrung | 10-Minuten-Stände 24 Stunden, stündliche Stände 7 Tage, tägliche Stände 30 Tage. Snapshotauswahl/Tags dürfen denselben Stand wiederverwenden; Dateiversionen nur solange sie von aufbewahrten Backups benötigt werden. |
| RTO | Technisches Betriebsziel: Wiederherstellung innerhalb von 2 Stunden ab erkannter Störung bei verfügbarer Infrastruktur, Zugang und gültiger Sicherung. In Staging messen, kein SLA oder Arbeitszeitversprechen. |
| Backupalarm | Fehlgeschlagenen Job sofort melden; bei mehr als 15 Minuten Snapshotalter RPO-Zielverletzung melden, ab 30 Minuten kritisch eskalieren. Warnung an einen unabhängig erreichbaren Betreiberkanal. |
| Restoreprobe | Vor Cutover, nach Änderungen an Backup/Schema und anschließend mindestens monatlich auf isoliertem neuen Volume durchführen. |

Die Werte sind eine konkrete Ausgangsempfehlung, kein universeller Standard. Kosten, Datenwachstum und Datenschutz-Aufbewahrung vor Freigabe prüfen. Bei nicht erreichbarem Ziel zuerst Backupverfahren/Last reduzieren oder Ziel neu abstimmen, nicht unbemerkt als eingehalten melden. Für geringeren Verlust wäre später geprüfte WAL-basierte kontinuierliche Sicherung möglich; das bedeutet keine zweite aktive CMS-Instanz und ist keine bereits eingeplante Bibliotheksinstallation.

### 11.1.2 Wiederherstellung nach verlorenem Volume

1. Schreibbetrieb sperren; defekte Quelle nicht in place überschreiben. Neues Volume und kompatibles Image vorbereiten.
2. Jüngste vollständige externe Sicherung samt erforderlicher Schlüssel und Dateien laden; Vollständigkeit und Prüfsummen kontrollieren.
3. SQLite-Integrität, Fremdschlüssel, Schema und fachliche Buchungs-/Anspruchsinvarianten prüfen.
4. Alte Sitzungen, Launches, Vorschautokens und laufende Partien nicht automatisch wieder als aktive Berechtigungen aus dem Backup aufnehmen. Neue Anmeldung und definierter Sitzungsabschluss/Wiederanlauf erforderlich.
5. Möglicherweise verlorene Änderungen nach Backupzeitpunkt sichtbar kennzeichnen. Potentiell nach diesem Zeitpunkt erfüllte Belohnungen, externe Wirkungen und Rechteänderungen vor erneuter Ausführung prüfen; keine künstliche Behauptung, verlorene Widerrufe oder Buchungen seien rekonstruiert.
6. Login, Rechte, Lernpunktesummen, Ansprüche und Spiel-/Medienzugriff im Wartungsmodus prüfen; erst danach genau eine aktive CMS-Instanz freigeben und eine neue vollständige Sicherung erzeugen.

Ein Backup schützt nicht gegen unbegrenzten Datenverlust. Bei Hardware-/Volumeverlust können Änderungen seit dem letzten externen Stand fehlen; `WAL` und `FULL` ersetzen diese unabhängige Sicherung nicht.

### 11.2 Richtlinie je Datensatztyp

Vor Umsetzung festlegen:

- Welche Bestände dürfen auf einen früheren Stand zurückgesetzt werden?
- Welche abgeschlossenen/erfüllten/widerrufenen Fakten bleiben erhalten?
- Welche Buchungen werden vereinigt oder durch Gegenbuchungen korrigiert?
- Welche Sitzungen müssen beendet werden, statt alte Berechtigungen wiederherzustellen?
- Wie werden Datenlöschungen/Anonymisierungen über alte Backups hinweg respektiert?
- Wie wird eine aktuelle Buchung behandelt, deren referenzierter Inhalt im alten Backup fehlt?

Terminale Zustände zu erhalten genügt nicht, wenn danach Fremdschlüssel, Kartenstände oder Punktesummen widersprüchlich sind. Konsistente Referenzen und fachlicher Abgleich gehören zur Restoreabnahme.

Empfohlene fachliche Korrekturregeln:

- Veröffentlichte Inhalte/Regeln durch neue Version ersetzen, nicht historische Versionen überschreiben.
- Falsche Punkte-/Verbrauchsbuchungen über referenzierte Gegenbuchungen beziehungsweise dokumentierte Korrekturereignisse berichtigen.
- Erfüllte/stornierte Ansprüche nicht durch Rückspielen eines alten Stands erneut ausführbar machen.
- Widerrufene Rollen, Einladungen und Freigaben im aktuellen Bestand nicht durch einen Inhaltsrestore reaktivieren.
- Lernstände nur gezielt und mit Akteur, Grund und Revision korrigieren; keine pauschale Rücksetzung aller Kinder.
- Fachkorrektur benötigt eine explizite Berechtigung, Vorschau der Auswirkungen und Bestätigung. Sie ist kein öffentliches frei wählbares SQL-/Restorekommando.

Aufbewahrungsfristen für dauerhafte Buchungen und personenbezogene Lernhistorie bleiben anhand des Datenschutzkonzepts festzulegen. Die 30-Tage-Backupempfehlung ist keine automatische Löschfrist für aktive Fachdatensätze.

### 11.3 Audit und Outbox

Der aktuelle nachgelagerte Audit-Log ist keine vollständig atomare Transaktionshistorie. Er darf nicht allein zum Wiederaufbau bestätigter Fachzustände verwendet werden.

Für erforderliche verlässliche Nachweise Ereignis-/Outboxrecord im selben fachlichen Commit speichern. JSONL kann ein nachgelagerter Diagnose-/Exportkanal bleiben. Genau-einmal-Verarbeitung nicht pauschal versprechen; eindeutige Schlüssel und wiederanlauffähige Zustellung testen.

### 11.4 Schutz und Lebenszyklus

- Zugangswerte, Passwort-/Ticketdaten und private Inhalte nicht in normale Logs oder Migrationsberichte aufnehmen.
- Backuprechte und Zugangsdatenablage gesondert schützen.
- Aufbewahrung nach Datensatztyp definieren; Ledger nicht nur wegen Dateigröße löschen.
- Rollentzug, Löschung, Anonymisierung und Eigentumsübertragung getrennte Prozesse.
- Keine produktiven Datensätze oder Altdateien automatisch löschen, nur um die neue Aufteilung sauber erscheinen zu lassen.

## 12. Migrationsablauf

### Phase A: Bestandsaufnahme und Vertragsnetz

Sammlungen, Referenzen, Schreibpfade, Transaktionsfälle und Restoresemantik vollständig inventarisieren. Laufende Fachregressionen als Ausgangsnachweis sichern. Bestehende direkte Reads/Writes und separate Zugangsdaten-/Dateioperationen erfassen.

**Abnahme:** Jede Sammlung hat eine primäre Zuständigkeit; keine unberücksichtigten Bestände, keine neu behaupteten Rechte.

### Phase B: Logische Speichergrenze

Fachzugriffe und gemeinsame Transaktionen schrittweise kapseln. Zunächst bestehende JSON-Ablage erhalten. JSON-Adapter und Fachoperationen erhalten Vertragstests für Ablehnung, Konflikt, Wiederholung und Recovery.

**Abnahme:** GCS-Endpunkte und Fachresultate unverändert; technische Dateipfade sind keine Workflowparameter.

### Festgelegter Übergang: direkt JSON → SQLite

Keine weitere JSON-Separation umsetzen. Phase B bereitet ausschließlich die logischen Fachzugriffe und den gemeinsamen Transaktionsvertrag vor. Hostingumzug und DB-Import jeweils mit isolierten Daten prüfen; nicht gleichzeitig neue Fachsemantik, ungetestetes Deployment und produktive Datenmigration aktivieren.

### Phase C: SQLite-Import und Adapterwechsel

1. Mit isolierter Kopie einen wiederholbaren Testimport durchführen.
2. DDL, Constraints und Migrationshistorie versionieren.
3. Alle Quellen einbeziehen: Haupt-/Ops-Bestand, relevante separate Zugänge, Nachweise und Dateimetadaten.
4. IDs, Zeitstempel, Revisionen, inactive/terminal Zustände und Buchungsidentitäten erhalten; unklare Referenzen melden statt erraten.
5. Counts, kanonische Inhaltsvergleiche, Lernpunktesummen, Anspruchszustände und Rechteentscheidungen gegen die Quelle vergleichen. Normalisierung benötigt einen semantischen Vergleich, nicht nur Dateihashes.
6. Unterbrochenen Import in eine Staging-DB sicher verwerfen oder idempotent fortsetzen; keine halb importierte DB aktivieren.
7. Beim später ausdrücklich freigegebenen Cutover Schreibzugriffe koordiniert anhalten, finalen Stand sichern/importieren/prüfen und genau einen autoritativen Adapter aktivieren.
8. Alten Store nicht parallel weiterbeschreiben. Kein dauerhaftes unkoordiniertes Dual-Write.
9. Nach Aktivierung Smoke-/Regressionstests und Betriebsüberwachung durchführen.

Eine Shadow-Leseprüfung ist vor Cutover möglich, ersetzt aber keine konsistente letzte Übernahme.

**Fly.io-Ausführung:** Migration auf der kontrolliert angehaltenen beziehungsweise noch nicht als ready markierten Ziel-Machine mit gemountetem `/data` ausführen. Das Fly-Volume ist beim Docker-Build und auf der temporären `release_command`-Machine nicht verfügbar. Produktive DB-Migration daher nicht blind in `release_command` legen. Globalen Migrations-/Writerlock prüfen; der Game-Server, Hintergrundjobs und CLI-Import dürfen währenddessen keinen parallelen CMS-Schreibbetrieb aufnehmen. Schemafehler blockieren Readiness, ohne neue leere DB oder JSON-Fallback anzulegen.

### Phase D: Zielmodell gezielt verbessern

Erst nach erfolgreichem Adapterwechsel Lerninhalte/Lernstände normalisieren, gezielte Indizes optimieren und Übergangs-Fullsnapshotzugriffe entfernen. Falls bereits für den Import zwingend nötig, diese Schritte gesondert abnehmen statt verborgen gleichzeitig umzubauen.

### Rückweg

Vor Annahme neuer DB-Schreibvorgänge kann zur gesicherten Quelle zurückgekehrt werden. Nach neuen DB-Schreibvorgängen ist ein Rückwechsel auf das alte JSON ohne Abgleich Datenverlust. Deshalb Reexport-/Rückmigrationsvertrag oder explizites Wartungs-/Recoveryverfahren vor Cutover festlegen. Keine automatische Rückkehr zum veralteten JSON bei DB-Fehlern.

## 13. Konkrete Prüfmatrix

| Prüfung | Erwartung |
| --- | --- |
| Collection-Mapping und Import | Alle bekannten Bestände enthalten; unbekannte Felder/Sammlungen gemeldet, nicht verloren. |
| IDs, Referenzen, inactive/terminal Zustände | Unverändert oder durch dokumentierte semantische Migration erhalten. |
| Karte bewerten über echten GCS-Endpoint | Lernstand, Ledger, Anspruchsauswertung und Versuchsergebnis konsistent. |
| Fachliche Ablehnung nach Teilmutation | Kein Teilzustand persistiert. |
| Fehler beim zweiten Bereich einer Transaktion | Gesamte Operation verworfen oder vor Dienstfreigabe vollständig recovered. |
| Parallelität/Zweitschreiber | Mehrere Nutzer korrekt bedient; zweite aktive CMS-Writerinstanz abgewiesen, keine verlorenen Updates. |
| SQLite-Start und Verbindungsinitialisierung | WAL/`FULL`/Fremdschlüssel wirksam; fehlendes Volume/Schema blockiert Readiness statt Demo- oder JSON-Fallback. |
| Prozessabbruch vor/nach Commit | Keine Teilmutation; bestätigte Commits bei intaktem Volume erhalten, unbestätigtes Resultat per Idempotenzbeleg klären. |
| Busy-Konflikt und volle Disk | Busy nur begrenzt wiederholen; keine falsche Erfolgsmeldung, keine unendlichen Retries oder automatische Historienlöschung. |
| Gemischtes Pilotlastprofil | 100 aktive Spieler/20 kleine Partien plus dokumentierte Entwickler-/Sprach-/Backuplast prüfen; p95 normaler CMS-Anfragen gemäß Ziel, keine Kapazität nur aus Unit-Tests ableiten. |
| Doppelte/geänderte Lernereignisse und Kommandos | Kein Doppelpunkt/Doppelanspruch; geänderte Wiederholung abgewiesen. |
| Regelwechsel | Historische Buchungen behalten ihre ursprüngliche Bedeutung. |
| Persönliche Karten mit identischem Text | Keine unbeabsichtigte Zusammenlegung. |
| Import ohne notwendige Referenz | Sichtbarer Fehler, keine stillschweigende Eigentümer-/Beziehungszuordnung. |
| JSON-Journal/Datei beschädigt | Sicherer Abbruch statt leerem Ersatzbestand. |
| DB-Treiber/Methoden synchron oder asynchron | Resultate vollständig abgewartet, keine Promise als Task-DTO. |
| Revisionskonflikt | Fehler statt stiller Überschreibung. |
| Rollen-/Freigabeentzug während Operation | Aktuelle Rechte wirksam; keine veraltete Cacheautorisierung. |
| Fachrestore mit vorhandenem aktuellem Bestand und späteren erfüllten Ansprüchen/Buchungen | Keine erneute Erfüllung; referenziell und fachlich konsistenter Zustand. |
| Fachrestore nach Löschung/Widerruf bei vorhandenem aktuellem Bestand | Keine unbeabsichtigte Wiederbelebung personenbezogener Daten oder Rechte. |
| Backup während Aktivität | Konsistente SQLite-Sicherung einschließlich benötigter Dateien; Hauptdatei nicht unkoordiniert ohne WAL kopieren. |
| Externes Backupziel ausgefallen | Jobfehler und Snapshotalter sichtbar; RPO-Zielverletzung melden, lokale Sicherung nicht als extern verfügbar zählen. |
| Volumeverlust/Disaster Recovery | Neues isoliertes Volume; Manifest/Integrität/Referenzen prüfen, jüngsten vollständigen Stand verwenden, mögliche verlorene Änderungen offen benennen. |
| Alte Sitzungen/Belohnungen nach Disaster Recovery | Keine automatische Wiederaktivierung alter Tokens/Partien; möglicherweise verlorene externe Erfüllungen vor erneuter Ausführung prüfen. |
| Restoreprobe und Betriebsziele | Vollständigen externen Stand wiederherstellen, gemessene RPO/RTO dokumentieren; kein Nullverlust-/Hochverfügbarkeitsversprechen. |
| Fly-Build/Release Command | Kein Zugriff auf erwartetes Produktivvolume voraussetzen; DB-Migration nur unter kontrolliertem Ziel-Mount und Lock. |
| Dateimetadaten/Medien nach Restore | Alle aktiv referenzierten Inhalte vorhanden und geschützt. |
| Audit-/Outbox-Neustart | Erforderliche Nachweise erhalten, sichtbare Nachrichten nicht dupliziert. |
| Cutover und Rückweg | Ein autoritativer Store; neue DB-Änderungen nicht durch alten JSON-Stand verloren. |
| Rechte-/Rollen-/Raum-/Eltern-/Sponsor-/MP-Regressionen | Bestehende Fachentscheidungen und Browserpfade unverändert. |
| Entwicklerprojekt-/Medien-/Releasebestand | Gleiche zentrale Rechte- und Transaktionsgrenze, kein separater Dateistore mit Bypass. |

Gezielte Store-/Adaptertests, tatsächliche deklarative Runtime-/HTTP-Tests und Browserregressionen ergänzen sich. Methoden- oder Dateiexistenz ist kein Gesamtpfadnachweis. Ausschließlich isolierte Testdaten verwenden.

## 14. Technische Anschlussstellen

| Datei/Bereich | Geplante Untersuchung/Änderung |
| --- | --- |
| `scripts/cms/cms-store.cjs` | Gemeinsamer Commitvertrag und SQLite-Adaptergrenze vorbereiten; bestehende JSON-Quelle für kontrollierten Import, keine weitere Dateiseparation. |
| `scripts/cms/cms-core.cjs` | Validierung, Referenz-/Rechteabfragen und kontrollierte Kapselung direkter Datenzugriffe. |
| `scripts/cms/cms-migrations.cjs` | Fachschema-Migrationen von Speicherlayout-/DB-Migrationen unterscheiden. |
| `scripts/cms/cms-runtime.cjs` | Methoden-/Transaktionsresultate korrekt ausführen; bei async Treiber bewusst anpassen. |
| `scripts/cms/cms-server-components.cjs` und Fachmodule | Bereichsübergreifende Operationen beibehalten, Datenzugriffe schrittweise ersetzen. |
| `scripts/cms/cms-card-points.cjs`, `cms-performance.cjs`, `cms-rewards.cjs` | Lern-/Buchungs-/Anspruchstransaktionen und historische Werte absichern. |
| Konto-/Einladungsadapter | Separate Zugangsdaten in Konsistenz- und Schutzvertrag einbeziehen. |
| `scripts/cms/cms-privacy.cjs`, `cms-trace.cjs` | Aufbewahrung, Redaction, Lösch-/Restoreverhalten erhalten. |
| Entwickler- und Medienmodule gemäß Entwicklerplan | Neue Bestände direkt hinter gemeinsamer Speichergrenze integrieren. |
| Neue Store-/Repository-/DB-Adaptermodule | Kleine fachliche Module gemäß 1000-Zeilen-Regel; keine neue Workflowdispatch-Architektur. |
| Bestehende Store-/CMS-Regressions- und neue Adaptertests | Gemeinsamen Vertrag gegen Quelle und SQLite-Ziel ausführen; Recovery-/Migrationstests und gemischte Last ergänzen. |
| Backup-/Restore-/Startwerkzeuge und Fly-Deploymentplan | Externe konsistente Sicherung, Readiness, Single-Writer-Cutover und Recovery auf neuem Volume dokumentieren und testen. |

## 15. Festgelegt und vor Produktivfreigabe zu konkretisieren

### 15.1 Festgelegte Richtung

- Eine aktive CMS-Instanz auf einer Fly Machine, Docker, persistentes Volume; mehrere gleichzeitige Nutzer.
- Direkter JSON → SQLite-Wechsel, gemeinsame Datenbank, keine neuen JSON-Bereichsdateien.
- Sofortiger Commit vor Erfolg, WAL/`FULL`/Fremdschlüssel, externe konsistente Backups.
- Logische Kapselung vor Adapterwechsel, zusätzliche Karten-/Lernstandnormalisierung danach.
- Technisches Disaster Recovery getrennt von fachlichen Korrekturen; keine Rückholung verlorener Fakten versprechen.
- Stop-before-start-/Wartungsablauf, keine aktiven parallelen Datenquellen und kein automatischer JSON-Rückfall.

### 15.2 Technische Auswahl und Freigabegates

| Punkt | Behandlung |
| --- | --- |
| SQLite-Treiber und Version | Technisch anhand Runtime, Node/Linux, Backupfähigkeit und Tests auswählen; keine zusätzliche fachliche Grundsatzfrage. |
| Fly-App/Domain/Region und Secrets | Konkrete Kontowerte und Zugang müssen vor Deployment bereitstehen; Region zunächst Frankfurt als Empfehlung aus dem Fly-Plan. |
| Machine-/Volumegröße und Budget | Nach gemischtem Pilotlasttest festlegen; keine ungeprüfte Kapazitätszusage. |
| Backupziel und Schlüsselzugang | Externen Provider/Bucket, Rollen und unabhängigen Wiederherstellungszugang festlegen. |
| RPO/RTO/Aufbewahrung | Empfohlene Werte aus Abschnitt 11.1.1 in Staging messen und mit Datenschutz/Budget abgleichen; Abweichungen ausdrücklich dokumentieren. |
| Fachkorrektur-/Aufbewahrungsregeln | Vorschläge aus Abschnitt 11.2 pro Datensatztyp konkretisieren; Datenschutz-Löschfristen bleiben gesonderte Vorgabe. |
| Zugangsdaten und Dateizugriffe | Alle persistierten CMS-Identitäts-/Ticket-/Rollenänderungen in den neuen Vertrag aufnehmen; Binärdateien über private Vorbereitung und Recovery, nicht als vermeintliche DB-Transaktion. |
| Produktiver Cutover/Rückweg | Prüfprotokoll, aktuelles Backup, Wartungsfenster und explizite Ausführungsfreigabe erforderlich. |

Der Auftrag genehmigt die Empfehlungen im Plan, nicht die Ausführung produktiver Migrationen, Löschungen, Secretsänderungen oder Deployments.

### 15.3 Technische Quellen

Am 13.10.2026 für die Planergänzung geprüft:

- [SQLite PRAGMA](https://www.sqlite.org/pragma.html): WAL, Synchronisierung, Fremdschlüssel, Busy-Timeout und Integritätsprüfungen.
- [SQLite Online Backup API](https://www.sqlite.org/backup.html): konsistentes Backup der laufenden DB und alternative Sicherungsverfahren.
- [Fly Volumes overview](https://fly.io/docs/volumes/overview/): flüchtiges Root-Dateisystem, lokale persistente Volumes, fehlende automatische Replikation, Snapshots und fehlendes Volume bei Build/Release Command.

Konkrete Treiber-, Plattform- und Versionsdetails vor Umsetzung erneut prüfen. Dokumentierte Empfehlungen sind keine bereits ausgeführte Cloudprüfung.

## 16. Fertigstellungskriterien

Die Separation ist erfolgreich, wenn Fachzuständigkeiten nachvollziehbar sind, gemeinsame Geschäftsoperationen atomar bleiben und GCS-Tasks keine Speichertechnik kennen.

Die DB-Migration ist erst abgeschlossen, wenn Bestandssemantik, Rechte, Buchungen, Revisionen, Restore, tatsächliche Laufzeitpfade und der Rückweg nachgewiesen sind. Nur Dateien zu verkleinern oder JSON in SQL zu schreiben ist kein ausreichendes Ergebnis.

Der Dokumentationsauftrag führt keine Builds, Dienststarts, produktiven Migrationen, Löschungen, Commits oder Pushes aus. Bestehende Daten und Anwendungscode bleiben unverändert.
