# CMS-Entwickler: Rolle, Online-GCS und geschützte Projekte

Stand: 13.10.2026

Status: Umsetzungsplan, keine Implementierungsfreigabe. Fachlich bestätigte Anforderungen sind verbindlich; technische Empfehlungen und noch offene Entscheidungen sind ausdrücklich gekennzeichnet. Der Plan beschreibt Version 1 und ihre Abnahme, nicht bereits nachgewiesene Funktionen.

Die bewerteten Optimierungen sind eingearbeitet: drei funktionale Meilensteine A–C plus Komfortphase D, Hybrid-Medienverwaltung, kompatibler revisionsfähiger Speichervertrag, Notfallentwürfe und präzisierte Vorschau-/Blueprint-Grenzen. Die Altersregel und die Dauer bereits eingeräumter Nutzungsrechte bleiben offen; die Freigabe zur Planergänzung entscheidet diese Punkte nicht automatisch.

## 1. Ziel

Das CMS erhält die zusätzliche Rolle **Entwickler**. Entwickler können über das CMS einen im Netz erreichbaren GCS-Editor verwenden, eigene Spieleprojekte erstellen und verwalten sowie ausdrücklich freigegebene Projekte lesen und kopieren.

Entwicklung, Projektbesitz und Entwicklungsberechtigungen sind unabhängig von Häusern und Räumen. Die spätere Spielverfügbarkeit bleibt dagegen dem bestehenden CMS-Modell aus Veröffentlichung, Hauskatalog und Raumzuordnung unterworfen.

Bilder, Audios und Videos müssen ebenfalls über das Netz verfügbar sein und dürfen nicht allein aufgrund eines bekannten Dateipfads zugänglich werden.

## 2. Bestätigte fachliche Anforderungen

### 2.1 Rollenvergabe und Einladung

- Die Rolle heißt in der Oberfläche **Entwickler**, vorgeschlagene interne Kennung: `developer`.
- In Version 1 vergibt ausschließlich ein SuperAdmin diese Rolle.
- Der SuperAdmin kann eine neue Person erstellen und einladen.
- Bei einer bestehenden Person wird die Entwicklerrolle zusätzlich vergeben. Andere Rollen, Beziehungen und bestehende Kontozugänge bleiben erhalten.
- Keine öffentliche Selbstregistrierung als Entwickler.
- Keine notwendige Haus- oder Raumzuordnung für den Entwicklerzugang.

### 2.2 Projekte

Ein Entwickler sieht ausschließlich:

1. eigene Projekte;
2. Projekte, die deren Eigentümer ihm ausdrücklich zum Lesen und Kopieren freigegeben hat;
3. Projekte, die der SuperAdmin innerhalb seiner Berechtigung für einzelne Entwickler oder für alle Entwickler bereitstellt.

Der Zugriff auf freigegebene fremde Originalprojekte ist schreibgeschützt. Bearbeitung erfolgt nur an einer eigenen Kopie. Das bloße Ausblenden fremder Projekte in einer Liste genügt nicht; dieselben Regeln gelten für direkte API-Aufrufe, Downloads, Vorschauen, Revisionen und Exporte.

### 2.3 Zwei unabhängige Freigaben

**Spielfreigabe:** Der Entwickler bestimmt, ob sein Projekt zur Veröffentlichung als Spiel freigegeben werden darf.

**Sourcecode-Freigabe:** Der Entwickler bestimmt ausdrücklich, welche anderen Entwickler sein vollständiges Editorprojekt lesen und kopieren dürfen. Zielgruppen können einzelne Entwickler oder alle Entwickler sein.

Eine Zustimmung zur Spielfreigabe ist niemals automatisch eine Freigabe des Sourcecodes. Der SuperAdmin darf aus der Spielfreigabe keine Sourcecode-Weitergaberechte ableiten.

### 2.4 Medien und Benachrichtigungen

- Eigene und ausdrücklich freigegebene Bilder, Audios und Videos stehen online zur Verfügung.
- Private Medien anderer Eigentümer sind nicht frei zugänglich.
- Optional werden HouseAdmins und Eltern über neu verfügbare Spiele informiert.
- Benachrichtigung, Veröffentlichung, Sourcecode-Zugriff und Haus-/Raumzuordnung sind voneinander getrennte Vorgänge.

## 3. Abgrenzung und technische Grenzen

Version 1 umfasst keine gemeinsame Bearbeitung fremder Originalprojekte, keine öffentliche Entwicklerregistrierung und keine automatische Migration bestehender Projekte in eine allgemein zugängliche Bibliothek.

Die Entwicklerrolle verleiht weder Serveradministration noch Zugriff auf Personendaten, Zugangsdaten, fremde Kinder, Trainingsbestände oder beliebige Dateien des Servers.

### 3.1 Was Sourcecode-Schutz bedeutet

Browser benötigen Laufzeitdaten und Spielmedien. Diese können von berechtigten Spielern grundsätzlich untersucht oder gespeichert werden. Auch GCS-Projektlogik kann in einer ausgelieferten Laufzeitrepräsentation erkennbar sein.

Geschützt werden der Zugriff auf vollständige bearbeitbare Editorprojekte, private Entwürfe, Entwicklungshistorie und Entwicklungsmedien. Eine Garantie der Geheimhaltung bereits ausgelieferter Spiellogik gehört nicht zum Vertrag. Minifizierung oder das Weglassen von Editor-Metadaten ist kein Ersatz für Berechtigungsprüfung.

### 3.2 Grenzen eines Widerrufs

Ein Widerruf verhindert zukünftige Zugriffe und neue Kopien. Bereits rechtmäßig heruntergeladene Daten oder angelegte Kopien lassen sich technisch nicht zurückholen. Nutzung, Weitergabe und Veröffentlichung einer Kopie müssen zusätzlich durch die erteilten Rechte gedeckt sein.

## 4. Ausgangslage und Anschlussstellen im Repository

Die folgenden Befunde beruhen auf Codelektüre bei der Planung. Sie sind keine funktionale Abnahme eines neuen Entwicklerpfads.

| Bereich | Vorhandene Anschlussstelle | Konsequenz |
| --- | --- | --- |
| Globale Zusatzrolle und Einladung | `scripts/cms/cms-sponsor-admin.cjs` | Muster für Rolle an bestehender Person, neue Person, Hash-Ticket und Einrichtung verwenden; Sponsorfachlogik nicht verändern. |
| Anmeldung | `scripts/cms/cms-admin.cjs` | Entwickler ohne Verwaltungszuständigkeit müssen einen eigenen Kontokontext erhalten. |
| Bereichsnavigation | `TServerQuery.contexts` in `scripts/cms/cms-server-components.cjs` | Entwicklerkontext ergänzen; Navigationsflags bleiben ohne eigene Berechtigungswirkung. |
| Rechte und Raumspielbarkeit | `scripts/cms/cms-core.cjs` | Entwicklerrechte ergänzen, bestehende `play`-Prüfung aus Hauskatalog und Raumzuordnung erhalten. |
| CMS-Server und Spielauslieferung | `scripts/cms/cms-server.cjs` | Geschützten Editorzugang und neue Transportpfade einbinden; Launch-Vertrag nicht verwässern. |
| Projektdateien | `game-server/src/routes/projectRoutes.ts` | Aktuelle `/api/dev/*`-Dateipfadoperationen nicht als geschützte Online-API übernehmen. |
| Öffentliche Dateien | `game-server/src/server.ts` | Private Quellen und Medien außerhalb statischer öffentlicher Verzeichnisse halten. |
| Medienmanifest und Uploads | `game-server/src/routes/mediaRoutes.ts`, `vite.config.ts` | Globales Manifest nicht für private Online-Medien verwenden. |
| Editor-Speichern | `src/editor/services/EditorProjectSaver.ts` | Autosave und manuelles Speichern an Online-Speichervertrag anbinden. |
| Revisionsschutz | `src/editor/services/DiskRevisionGuard.ts` | Konflikterkennung in Online-Kontext übernehmen; nicht ausschließlich Dateipfade verwenden. |
| Speicheradapter | `src/ports/IStorageAdapter.ts`, `src/adapters/ServerStorageAdapter.ts` | Bestehenden `Promise<void>`-/Projekt-Vertrag kompatibel erhalten und um revisionsfähige Fähigkeiten ergänzen; geschützten Online-Adapter vorsehen. |
| Browsersicherung | `src/adapters/IndexedDBAdapter.ts`, `src/editor/EditorSessionManager.ts` | Gemeinsamen bisherigen `last_project`-Schlüssel nicht für mehrere Onlinekonten verwenden; kontogetrennte Notfallentwürfe und kontrollierte Wiederherstellung. |
| Medienauswahl und Analyse | `src/editor/inspector/MediaPickerDialog.ts`, `src/utils/ImageGalleryModel.ts`, `src/editor/tools/AssetAnalyzer.ts` | Berechtigungsgefilterten Medienkatalog statt globalem Manifest verwenden. |
| Export | `src/export/GameExporter.ts` | Medienrechte und Versionsabhängigkeiten vor Export/Kopie/Veröffentlichung prüfen. |
| CMS-Spielbundles | `scripts/cms/cms-uploads.cjs` | Vorhandene Strukturprüfung und Bundle-/Medienkonvention nutzen; Fachrechte ergänzen. |
| Migration und Speicher | `scripts/cms/cms-migrations.cjs`, `scripts/cms/cms-store.cjs` | Versionsmigration und bestehende Transaktions-/Wiederherstellungsregeln erweitern. |

Die aktuellen lokalen Projektoperationen prüfen den Speicherpfad und teilweise die Revision, enthalten dort aber keine CMS-Entwickler-/Eigentümerprüfung. Der Express-Server liefert Projekt- und Medienverzeichnisse statisch aus. Eine neue Rolle plus gefilterte Liste würde diese alternativen Zugriffswege nicht schließen.

## 5. Verbindliche Architekturleitlinien

1. CMS-Oberflächen und Abläufe werden mit GCS-Stages, Events, Tasks, Actions und Conditions modelliert.
2. Serverabläufe werden über deklarative `TServerEndpoint`-Tasks ausgeführt.
3. Fachoperationen sind registrierte Komponentenmethoden mit dokumentiertem Vertrag.
4. Sicherheitskritische Zustandsänderungen bleiben atomar, beispielsweise Rollenzuweisung, Ticketverbrauch oder Veröffentlichung derselben genehmigten Version.
5. Kein paralleles klassisches CMS-Controller-/UI-System und keine versteckten Workflow-Dispatcher.
6. Transportadapter übernehmen Sitzungseinbindung, Binärübertragung und Auslieferung. Sie ersetzen keine Fachberechtigung.
7. Rechte werden bei jeder Operation erneut geprüft. Weder Listenfilter noch URL-Parameter, Browserflags oder beim Editorstart geladene Rechte sind ausreichend.
8. Lokaler Editor-, Desktop-, Upload-Sandbox- und Multiplayerbetrieb bleiben erhalten. Der Online-Kontext ist explizit, kein stiller Fallback auf lokale Dev-Endpunkte.
9. Handgeschriebene Module gemäß `DEVELOPER_GUIDELINES.md` auf höchstens 1000 Zeilen begrenzen; Modularisierung und Zeilengrenze bei jeder Etappe prüfen. Die gespeicherte Gesamt-Projekt-JSON wird nicht allein dafür künstlich in mehrere Projekte zerlegt.
10. Globale Clientvariablen, -komponenten, -tasks und -actions gehören in `stage_blueprint`. Serverkomponenten und Endpoint-Abläufe bleiben entsprechend der bestehenden CMS-Runtime stage-lokal in `stage_server_developer_*`; sie werden nicht pauschal zu globalen Clientinhalten erklärt.

## 6. Rollen- und Sitzungskonzept

### 6.1 Globale Plattformrolle

Empfehlung: `developer` als Rollenrecord mit `personId`, `areaId: 'root'` und `active` speichern. `root` ist hier ein technischer Plattform-Scope, keine Hauszuordnung und keine Mitgliedschaft.

Die Entwicklerberechtigung verlangt eine aktive Person, eine aktive Rolle und eine geeignete authentifizierte Kontositzung. Emoji-Einwahl allein gewährt keine Entwicklungsrechte. Eine aktive Entwicklerrolle verleiht insbesondere nicht `assurance: 'admin'` oder SuperAdminrechte.

Mehrfachrollen müssen im vorhandenen Rollen-/Kontextwahlmodell sichtbar bleiben. Entwickleroperationen sind an den aktiven Entwicklungskontext gebunden; SuperAdminoperationen an den aktiven SuperAdminkontext. Kontextwechsel darf keine implizite Rechteaddition erzeugen.

### 6.2 Neue Person

Deklarativer Ablauf:

`SuperAdmin bestätigt → Person/Einladung atomar anlegen → Einladungslink anzeigen → Ticket prüfen → Konto einrichten → Ticket konsumieren und Rolle aktivieren`.

Empfehlungen:

- Zweckkennung `developer-setup`;
- einmaliges Ticket, zunächst 24 Stunden gültig;
- nur Ticket-Hash persistieren;
- erneut einladen macht den bisherigen Link ungültig;
- Rolle erst nach erfolgreicher Zugangseinrichtung aktivieren;
- aktiven ausstellenden SuperAdmin bei Einlösung erneut prüfen;
- Einrichtung von Konto und CMS-Status nach bestehendem Speichervertrag absichern, einschließlich Fehler-/Wiederholungsfällen;
- Ticketwerte nicht in Audit, Trace, Analytics oder normalen Serverlogs speichern;
- Version 1 erzeugt einen Link zur Weitergabe durch den SuperAdmin; automatischer E-Mail-Versand ist eine separate Erweiterung.

### 6.3 Bestehende Person

- Keine zweite Person anlegen.
- Rolle idempotent hinzufügen oder reaktivieren.
- Bestehende Rollen und Erziehungsbeziehungen unverändert lassen.
- Vorhandenen geeigneten Kontozugang weiterverwenden.
- Falls kein geeigneter Zugang besteht, ein personenbezogenes Einrichtungsticket ausstellen. Die Person darf nicht unbemerkt mit einem neuen Konto dupliziert werden.

### 6.4 Entzug

Rollentzug sperrt sofort neue Lese-, Schreib-, Medien-, Kopier- und Vorschauoperationen. Projektbesitz und andere Rollen bleiben erhalten. Entzug löscht keine Projekte und überträgt kein Eigentum.

Ein geöffneter Editor muss den Berechtigungsverlust anzeigen und weitere Serveroperationen stoppen. Ungespeicherte Änderungen nicht stillschweigend verwerfen; eine lokale Sicherungsmöglichkeit darf nur bereits rechtmäßig geladene Inhalte betreffen und keine zusätzlichen Serverdaten abrufen.

## 7. Projekt- und Rechtemodell

### 7.1 Projekt und veröffentlichtes Spiel trennen

Ein **Entwicklungsprojekt** ist ein privater, editierbarer Arbeitsbestand. Ein **Release** ist eine unveränderliche, geprüfte Version für Spielbetrieb und Moderation. Das vorhandene `games`-Modell verweist auf ein Release, nicht auf den jeweils neuesten privaten Entwurf.

Damit benötigen private Entwürfe weder Haus noch Spielstatus. Ein Speichervorgang im Editor verändert keine laufende veröffentlichte Version.

### 7.2 Vorgeschlagene Datenbestände

Namen sind Empfehlungen, bei der Implementierung mit dem aktuellen Schema abstimmen.

| Bestand | Kernfelder und Zweck |
| --- | --- |
| `developerProjects` | `id`, `ownerId`, Titel, Zustand, aktuelle Revision, Zeitstempel, private Speicherreferenz, optionale Herkunft einer Kopie. |
| `developerProjectVersions` | Unveränderliche Projektrevision, Inhaltshash, Medienabhängigkeiten, Ersteller und Zeitpunkt. |
| `developerSourceGrants` | Eigentümerzustimmung zu einer festen Projektrevision einschließlich ihres gebündelten Medienmanifests, Zielgruppe, Rechte `read`/`copy`, aktiv/widerrufen, Revision und Akteur. |
| `developerReleaseApprovals` | Eigentümerzustimmung zu exakt einer Release-Version, Inhaltshash, Zustand und Widerruf. |
| `developerReleases` | Unveränderlicher Spielstand, Projektrevision, Medienversionen, Rechtebelege, Prüfung und Veröffentlichungszustand. |
| `developerMedia` | Medien-ID, Eigentümer, Typ, Name, Größe, private Speicherreferenz, Zustand und Speicherklasse `bundled`/`shared`; bei `bundled` zusätzlich Projektbezug. |
| `developerMediaVersions` | Unveränderliche Mediendatei mit Hash, MIME-Typ, Version und Herkunfts-/Nutzungsbelegen; gebündelte Versionen über das Projektmanifest auswählen. |
| `developerMediaGrants` | Explizite Rechte für `shared`-Bibliotheksmedien: Entwicklungszugriff, Kopieren, Spielverwendung und gegebenenfalls Weitergabe, Zielgruppe und Widerruf. Eigene `bundled`-Medien benötigen keine Einzelgrants. |
| `developerCommandReceipts` | Idempotenzbelege für Kopieren, Release-Erstellung, Veröffentlichung und andere nichttriviale Wiederholungen. |

Audit und Benachrichtigungen bevorzugt in bestehende Infrastruktur integrieren. Eine eigene Ereigniscollection nur ergänzen, falls der bestehende Vertrag die benötigte Historie nicht abbildet.

### 7.3 Identität und Eigentum

- `ownerId` beim Erstellen serverseitig aus der Sitzung bestimmen.
- Ein Client kann weder Eigentümer noch administrative Freigabe durch Projekt-JSON setzen.
- Projekt-ID und Dateiname sind keine Berechtigung.
- Keine frei wählbaren Serverpfade in der Online-API.
- Fachmetadaten getrennt von frei bearbeitbarem GCS-Projektinhalt führen.
- Listenantworten enthalten ausschließlich erlaubte Metadaten, niemals Tickets, Kontodaten oder private Speicherpfade.

### 7.4 Berechtigungsmatrix

| Operation | Eigentümer als Entwickler | Berechtigter fremder Entwickler | SuperAdmin |
| --- | --- | --- | --- |
| Eigenes Projekt erstellen | Ja | Ja, eigenes Projekt | Im eigenen berechtigten Entwicklungskontext |
| Privatprojekt lesen | Ja | Nur mit Sourcecode-Freigabe | Kein implizites Recht durch Spielfreigabe |
| Original verändern | Ja | Nein | Kein automatisches Bearbeitungsrecht |
| Projekt kopieren | Ja | Mit ausdrücklicher Lese-/Kopierfreigabe | Mit entsprechender Berechtigung |
| Sourcecode-Empfänger bestimmen | Ja | Nein, nur für eigene Kopie innerhalb deren Weitergaberechte | Nur innerhalb ausdrücklich eingeräumter Eigentümerrechte |
| Spielfreigabe erteilen | Ja, für bestimmte Version | Nein für fremdes Original | Nicht anstelle des Eigentümers |
| Spiel veröffentlichen | Veröffentlichung beantragen | Nein | Mit gültiger Eigentümerzustimmung und Prüfungen |
| Veröffentlichung sperren | Widerruf/Antrag nach definierter Regel | Nein | Administrativ möglich |

SuperAdmin darf eigene oder rechtmäßig verwaltete Bibliotheksprojekte für einzelne oder alle Entwickler freigeben. Bei fremden Projekten kann er nur Zielgruppen und Rechte nutzen, die der Eigentümer ausdrücklich erlaubt hat. Ein allgemeines Moderationsrecht darf nicht zu einer stillen Sourcecode-Offenlegung führen.

### 7.5 Versionsbezug der Sourcecode-Freigabe

Für Version 1 werden ausschließlich ausgewählte unveränderliche Revisionen freigegeben. Der Snapshot umfasst Projektinhalt und feste gebündelte Medienversionen. Neue private Änderungen, Notizen oder Medien werden dadurch nicht automatisch offengelegt.

Eine fortlaufende Freigabe zukünftiger Revisionen ist nicht Bestandteil von Version 1 und wäre eine spätere, gesondert zu bestätigende Option. Die Oberfläche zeigt stets, welche Revision lesbar und kopierbar ist.

### 7.6 Kopiervertrag

Eine Kopie erhält eine neue Projekt-ID und den kopierenden Entwickler als Eigentümer. Herkunftsprojekt, Herkunftsrevision und Rechtebeleg werden dokumentiert; diese Herkunft erzeugt später keine zusätzliche Zugriffsmöglichkeit auf das Original.

Kopieren bedeutet nicht automatisch:

- fremde private Medien zu erhalten;
- das Spiel veröffentlichen zu dürfen;
- die Kopie an Dritte weitergeben zu dürfen;
- Originalfreigaben oder administrative Freigaben zu übernehmen.

Empfehlung: Lese-/Kopierfreigabe erlaubt zunächst die eigene private Bearbeitung. Veröffentlichung und erneute Sourcecode-Weitergabe einer abgeleiteten Kopie verlangen entsprechende Rechte. Die Herkunftsrechte werden unveränderlich dokumentiert und serverseitig bei späteren Freigaben geprüft; editierbare Projektmetadaten dürfen sie nicht aufheben.

Ob eine ursprünglich erteilte Erlaubnis für bereits bestehende Kopien dauerhaft gilt, ist vor Umsetzung festzulegen. Empfohlen ist: Widerruf beendet neue Zugriffe/Kopien, ändert aber nicht rückwirkend die bei rechtmäßiger Kopie dokumentierten Nutzungsrechte. Administrative Sperren aus Sicherheits- oder Rechtsgründen bleiben davon getrennt.

Eine SuperAdmin-Sperre kann die Veröffentlichung oder Nutzung innerhalb dieses CMS verhindern. Sie ist kein automatischer rückwirkender Entzug sämtlicher externer Nutzungsrechte. Der Plan verspricht weder die Rückholung von Downloads noch eine technische Durchsetzung außerhalb der Plattform.

## 8. Medienvertrag

### 8.1 Hybrid-Modell: Projektmedien und geteilte Bibliothek

Medien werden über stabile IDs/Versionen verwaltet. Öffentliche Dateinamen oder ein globales Verzeichnis sind kein Identitäts- und Rechtemodell. Die Bedienung unterscheidet zwei Speicherklassen:

| Klasse | Verwaltung | Freigabe |
| --- | --- | --- |
| `bundled`: projektgebundene Medien | Upload in den privaten Projektbestand; feste Medienversionen gehören zum Manifest einer Projektrevision. | Eigene, rechtmäßig weitergebbare Medien folgen der Lese-/Kopierfreigabe des Projekt-Snapshots. Kein zusätzlicher Grantdialog für jedes Icon oder Geräusch. |
| `shared`: geteilte Medienbibliothek | Eigenständiger Bibliotheksbestand, einzeln oder als Medienpaket auswählbar. | Explizite Rechte für Entwicklungszugriff, Kopieren, Spielverwendung und gegebenenfalls Weitergabe. |

Der Online-Medienpicker trennt Projektmedien und zugängliche Bibliotheksmedien sichtbar. Projektmedien sind nicht allein durch eine Sourcecode-Freigabe auch eigenständig in einer globalen Bibliothek auffindbar. Private Inhalte bleiben außerhalb statischer öffentlicher Ordner; ein logischer Pfad wie `/projects/{projectId}/assets/...` ist keine Berechtigung und darf keinen ungeschützten Dateizugriff eröffnen.

Der Online-Medienkatalog liefert ausschließlich eigene und berechtigte Medien. Dieselbe Prüfung gilt für Originaldateien, Thumbnails, Vorschaudaten, Suchergebnisse und HTTP-Range-Requests. Caches dürfen Antworten verschiedener Benutzer nicht vermischen.

**Rechtevorbehalt:** Die Speicherklasse ersetzt keine Herkunftsrechte. Wird ein fremdes `shared`-Medium in den Projektbestand kopiert oder eingebettet, bleiben dessen Nutzungs-/Weitergabebelege erhalten. Aus `shared` wird durch Umbenennen, Kopieren oder neue Eigentümermetadaten kein frei weitergebbares eigenes Medium.

Eigentümer können einzelne Entwickler oder alle Entwickler berechtigen. SuperAdmin-Bibliotheksfreigaben setzen ausreichende Rechte voraus. Die gebündelte Projektfreigabe vereinfacht den Bedienweg, nicht die Prüfung fremder Nutzungsrechte.

### 8.2 Abhängigkeiten einer Projektfreigabe

Vor Freigabe und Kopie wird ein Medien-Abhängigkeitsmanifest erstellt und geprüft. Eigene `bundled`-Medien werden mit dem Projekt-Snapshot freigegeben; referenzierte oder eingebettete fremde Medien müssen ausreichend berechtigt sein. Eine Sourcecode-Freigabe erweitert nicht automatisch die Rechte an Medien anderer Eigentümer.

Die Abhängigkeitsprüfung wird automatisch ausgeführt und zeigt fehlende Rechte gesammelt an. Bei einer typischen Freigabe eigener Projektmedien ist nur die Projektfreigabe zu bestätigen, nicht jede einzelne Mediendatei.

Der Kopiervorgang ist fachlich atomar: entweder entsteht eine verwendbare Kopie mit berechtigten Medienversionen oder eine konkrete Ablehnung mit fehlenden Abhängigkeiten. Keine stillschweigend unvollständigen Projekte.

Zulässige Medien können physisch kopiert oder über unveränderliche Versionen referenziert werden. Speicher-Deduplizierung nach Hash ist möglich, darf aber niemals Rechte verschiedener Nutzer zusammenführen oder Hash-Abfragen als Existenzleck verwenden.

### 8.3 Spielmedien

Empfehlung: Releases erhalten einen unveränderlichen Medien-Snapshot mit den notwendigen Nutzungsbelegen. Spieler erhalten ausschließlich die vom Release benötigten Medien über dessen Spielberechtigung.

Ein Widerruf künftiger Entwicklungszugriffe muss nicht automatisch bestehende rechtmäßig veröffentlichte Spiele zerstören. Verhalten von Nutzungsrechten, Release-Sperren und rechtlichen Löschungen wird ausdrücklich getrennt festgelegt.

### 8.4 Upload und Betrieb

- Typ- und Inhaltsprüfung, Größen-/Pixel-/Dauergrenzen und Benutzerquoten;
- sichere SVG-Behandlung; aktive Inhalte nicht ungeprüft als vertrauenswürdiges Editor-Dokument ausliefern;
- keine beliebigen Dateipfade oder externen serverseitigen Abrufe aus Clientangaben;
- private temporäre Ablage, atomare Aktivierung nach erfolgreicher Fachprüfung;
- Abbruch und fehlerhafte Uploads hinterlassen keine sichtbaren halben Datensätze;
- passende MIME-Typen, `nosniff`, geschützte Auslieferung und begrenzte Range-Anfragen;
- Löschung eines Mediums prüft aktive Projekt-/Releaseabhängigkeiten.

## 9. Veröffentlichung und Spielbetrieb

### 9.1 Ablauf

`Projekt speichern → Release-Kandidat mit festen Medienversionen erzeugen → Rechte/Struktur prüfen → Eigentümer stimmt dieser Version zu → SuperAdmin prüft → Veröffentlichung atomar aktivieren → optional informieren`.

Ein Veröffentlichungskandidat wird nach Zustimmung nicht verändert. Änderungen erzeugen einen neuen Kandidaten und benötigen neue Zustimmung. Ein Hash oder eine feste Revisionskennung verbindet Prüfung, Zustimmung und ausgelieferten Inhalt.

SuperAdmin kann veröffentlichen, ablehnen oder sperren. Entwickler dürfen ihren privaten Arbeitsstand weiterbearbeiten, ohne den veröffentlichten Spielstand zu verändern.

### 9.2 Zustände

Vorgeschlagene Release-Zustände: `candidate`, `approved-by-owner`, `published`, `rejected`, `blocked`, `withdrawn`. Die zulässigen Übergänge liegen in den Fachmethoden, nicht in beliebigen Property-Actions.

Eigentümerzustimmung und administrative Veröffentlichung bleiben getrennte Fakten. Ein Release kann technisch geprüft sein, ohne eine Eigentümerzustimmung zu besitzen.

### 9.3 Widerruf

Empfehlung:

- vor Veröffentlichung: Zustimmung sofort unwirksam, Veröffentlichung danach abgewiesen;
- nach Veröffentlichung: neue Spielstarts sperren;
- laufende Sitzungen kontrolliert beenden, vorhandene Ende-/Heartbeat-/Launch-Verträge erhalten;
- Sperren und Widerruf auditieren;
- Haus-/Raumzuordnungen nicht automatisch löschen, aber ohne wirksames Release keine Spielberechtigung gewähren.

Bei parallelem Widerruf und Veröffentlichung muss die endgültige Entscheidung innerhalb derselben atomaren Fachprüfung erfolgen. Bereits vorgeladene Browserflags sind keine Zustimmung.

### 9.4 Hauskatalog und Räume

Nach Veröffentlichung kann ein HouseAdmin das Spiel in seinen Hauskatalog aufnehmen und Räumen zuordnen. Ein Entwickler erhält daraus keine Hausverwaltungsrechte.

Bestehende Prüfung erhalten: spielbare Veröffentlichung **und** wirksamer Hauskatalog **und** Raumzuordnung **und** Spielerzutritt. Benachrichtigungen ersetzen keinen dieser Schritte.

## 10. Online-GCS und Deployment

### 10.1 Empfohlene Bereitstellung

Produktions-Webeditor, CMS und geschützte APIs bevorzugt unter einer gemeinsamen HTTPS-Origin bereitstellen. Statische Editorprogrammdateien dürfen öffentlich erreichbar sein; Entwicklerdaten und Operationen bleiben authentifiziert und autorisiert.

Die frei programmierbare Vorschau-Runtime ist davon getrennt: Für den Onlinebetrieb eine dedizierte HTTPS-Vorschau-Origin ohne CMS-Kontocookies vorsehen. Damit bleiben vertrauenswürdiger Editor und API einfach angebunden, ohne die untrusted Spielvorschau in ihren Kontokontext zu übernehmen.

Nicht den lokalen Vite-/Express-Entwicklungsserver pauschal veröffentlichen. Lokale Dev-Endpunkte, Dateisystem-, Reset-, Agent-, Trainings- und Datenoperationen bleiben im Netzbetrieb gesperrt, sofern keine eigene begrenzte Freigabe existiert. Eine bloße Bindung an `0.0.0.0` erfüllt den Onlinevertrag nicht.

Falls Editor und CMS auf getrennten Diensten laufen, muss ein serverseitiger, kurzlebiger und zweckgebundener Sitzungsaustausch entworfen werden. Langfristige Kontotokens nicht per URL übergeben. Version 1 bevorzugt die einfachere Same-Origin-Variante.

### 10.2 Sitzung und HTTP

- bestehende Kontositzung verwenden, Entwicklerrolle serverseitig nachprüfen;
- HTTPS, geeignete `HttpOnly`-/`Secure`-/`SameSite`-Cookies;
- CSRF-Schutz für zustandsändernde Kontooperationen;
- erlaubte Origins ausdrücklich konfigurieren, kein pauschales CORS;
- `401` für fehlende/abgelaufene Sitzung, `403` für unzulässige Operationen nach definiertem Anti-Enumeration-Vertrag;
- Online-Sitzung niemals gegen beliebige vom Projekt vorgegebene URLs verwenden;
- private Antworten nicht in öffentliche oder benutzerübergreifende Caches übernehmen.

### 10.3 Speicherung

Private Quellprojekte, Versionen und Medien liegen außerhalb `public/`, `game-server/public/` und statischer Buildassets. Empfehlung: eigener persistenter Bereich neben der CMS-Datenablage, genaue Pfade erst in der Implementierung festlegen.

Fachmetadaten und Dateien müssen wiederherstellbar zusammenpassen. Die vorhandene Store-Härtung nutzen; für große Binärdateien private Stagingdateien und unveränderliche Inhalte vorsehen. Erst nach erfolgreichem Commit werden sie referenziert. Verwaiste Stagingdateien dürfen mit geprüftem Cleanup entfernt werden; Restore darf keine freigegebenen Records ohne Inhalt oder gelöschte Berechtigungen wiederbeleben.

Betrieb verlangt persistente Volumes, Quoten, Backup/Restore, Erreichbarkeitsprüfung und konsistente Runtime-/Editorversionen. Rolloutschritte und Build-/Startbefehle werden dokumentiert, nicht ohne gesonderten Auftrag ausgeführt.

### 10.4 Editoradapter

Vorgeschlagener Online-Speicherport mit Operationen:

- sichtbare Projekte auflisten;
- Projekt/Revision laden;
- eigenes Projekt erstellen;
- mit erwarteter Revision speichern;
- berechtigtes Fremdprojekt kopieren;
- Medien suchen/laden/hochladen;
- geschützte Vorschau anfordern.

Onlineadapter und lokaler Speicheradapter teilen Projekt-/Revisionsverträge, aber nicht ungesicherte Dateipfade. `EditorProjectSaver`, `DiskRevisionGuard`, Projektliste und Speichern-unter-Dialog dürfen im Onlinebetrieb nicht auf `/api/dev/*` zurückfallen.

#### 10.4.1 Kompatible Evolution des Speicherports

Der aktuelle `IStorageAdapter` enthält `name`, `isAvailable()`, `save(project, filename?): Promise<void>`, `load(filename?): Promise<GameProject | null>` und `list(): Promise<string[]>`. Ein Onlineadapter darf nicht unter derselben `save`-Signatur plötzlich `Promise<StorageSaveResult>` liefern; das würde den vorhandenen Interfacevertrag verletzen.

Empfehlung: den bisherigen Port kompatibel erhalten und einen expliziten revisionsfähigen Zusatzvertrag einführen, zum Beispiel `IRevisionedStorageAdapter` mit `loadWithRevision`, `saveWithRevision` und einer separaten Erstelloperation. Ein `CmsOnlineStorageAdapter` kann beide Verträge bedienen. Im Onlinekontext verwendet der zentrale Editor-Speicherablauf zwingend die revisionsfähige Operation; ein Legacy-Aufruf ohne sicheren Projekt-/Revisionskontext schlägt geschlossen fehl und darf keinen Blind-Save auslösen.

| Vertrag | Erforderliche Information |
| --- | --- |
| Laden | Projekt-ID, Projektinhalt und Basisrevision aus demselben serverseitigen Stand, Snapshotbezug und aktuell ausgewertete Schreibberechtigung. |
| Bestehendes Projekt speichern | Projekt-ID, verpflichtende `expectedRevision`, Projektinhalt und ein Idempotenzschlüssel für den konkreten Speicherauftrag. |
| Neues Projekt erstellen | Separate Operation ohne vorgetäuschte Basisrevision; neue ID/Eigentümer serverseitig bestimmen. |
| Erfolgreiches Speichern | Eindeutiger Erfolgsstatus und neue Revision; erst danach den Server-Speicherstand als bestätigt markieren. |
| Konflikt | Eindeutiger Konfliktstatus mit zulässiger aktueller Revision; keine Erfolgsrevision, kein stilles Überschreiben. |
| Sonstige Ablehnung | Unterscheidbare Zustände für `unauthenticated`, `forbidden`, `network-error` und `validation-error`; weder mit Konflikt noch mit Erfolg vermischen. |

Statt mehrerer unabhängig optionaler Booleans ist ein diskriminiertes Ergebnis vorzuziehen, dessen Status die zulässigen Felder bestimmt. Ein `403` ist insbesondere kein Netzwerkfehler, bei dem unbeschränkt weitergespeichert werden darf. Eine erfolgreiche lokale Sicherung bedeutet nicht, dass der Server gespeichert hat.

Autosave und explizites Speichern verlangen `expectedRevision`. Konflikte liefern `409` mit sicherer Revisionsinformation, ohne den fremden Stand zu überschreiben. Freigegebene Originale werden read-only geöffnet. Speichern-unter erzeugt eine neue eigene Kopie und prüft dabei die Kopier-/Medienrechte.

Der bestehende `EditorProjectSaver` verwendet direkte HTTP-Aufrufe zusätzlich zur Speicherabstraktion. Diese Doppelspur muss bei der Integration auf einen gemeinsamen Speicherablauf zurückgeführt werden. Gemeinsame reine Revisionsentscheidungen wiederverwenden, transportspezifische Datei-/Projektidentität in den Adapter verlagern. Lokale, native und Desktopadapter über Vertragstests absichern; keine parallele Online-Speicherlogik im UI aufbauen.

#### 10.4.2 Notfallentwurf und kontrollierte Wiederherstellung

Bei Netzwerkabbruch oder abgelaufener Sitzung wird ein Notfallentwurf aus bereits rechtmäßig geladenem Inhalt und lokalen Änderungen gesichert. Die bestehende IndexedDB-Infrastruktur verwenden, aber ihren gemeinsamen `last_project`-Schlüssel nicht auf Onlinekonten übertragen.

- Schlüssel nach Installation/Plattformkontext, Benutzer-ID und Projekt-ID trennen; mehrere Tabs mit Entwurfs-ID oder Generation konfliktfrei berücksichtigen.
- Inhalt, Basisrevision, Zeitstempel und Kennzeichnung `local-only` speichern, aber keine Sitzungscookies, Konto- oder Preview-Tokens.
- In der Oberfläche getrennt anzeigen: „auf dem Server gespeichert“ und „lokal gesichert“. Bei Quoten-/Transaktionsfehlern ausdrücklich warnen; keine erfolgte Notfallsicherung behaupten.
- Beim nächsten Öffnen eine Wiederherstellung anbieten, nicht automatisch durchführen.
- Vor Wiederherstellung im Onlinekontext dasselbe Konto, aktive Rolle und aktuelle Projektberechtigung prüfen. Keine Cache-Wiederherstellung fremder Quellen nach Rechteverlust.
- Serverrevision vergleichen. Ein älterer Entwurf darf einen neueren Serverstand nicht überschreiben; Vergleich/Konfliktlösung oder berechtigte eigene Kopie anbieten.
- Bei unbekanntem Ergebnis eines abgebrochenen Server-Saves dessen Idempotenzbeleg/Revision prüfen, bevor erneut gespeichert wird.
- Aufbewahrung, Löschung nach erfolgreichem Save und Verhalten bei expliziter Abmeldung festlegen. Kontowechsel darf keinen Entwurf eines anderen Kontos anzeigen.

Die Persistenz soll bereits während der Bearbeitung erfolgen; nicht allein auf eine asynchrone Sicherung beim Schließen des Tabs vertrauen. Bestehende Debounce- und Serialisierungsregeln erhalten.

**Verschlüsselung:** Ein benutzerbezogenes Präfix ist keine Sicherheitsgrenze gegen anderen Code derselben Origin. Verschlüsselung ist nur mit dokumentiertem Schutzziel und Schlüsselverwaltung sinnvoll. Ein ausschließlich flüchtiger Schlüssel ermöglicht keine verlässliche Wiederherstellung nach Browserneustart; ein Schlüssel neben dem verschlüsselten Inhalt schützt nicht zuverlässig vor XSS oder gleichberechtigtem Origin-Code. Version 1 verspricht daher keine pauschal „sichere verschlüsselte Notfallsicherung“. Die Schlüssellösung und Lösch-/Aufbewahrungsregel müssen vor Produktivaktivierung der persistenten Onlineentwürfe geklärt werden; bis dahin ist ein ausdrücklich gewählter lokaler Sicherungsexport eine begrenzte Alternative.

Browsercache nach Konto und Projekt trennen; Abmeldung oder Kontowechsel darf private Inhalte eines anderen Benutzers nicht wiederherstellen. Keine Kontoschlüssel im Projekt-JSON, Export oder persistenten Browser-Projektdatensatz.

### 10.5 Vorschau und aktive Inhalte

Entwicklervorschau erfolgt mit einer eigenen kurzlebigen Projekt-/Versionsberechtigung, ohne Haus, Raum, Kinder-Spielzeitbuchung oder allgemeine CMS-Kontorechte.

#### 10.5.1 Sandbox-Origin und HTTP-Schutz

- Dedizierte Vorschau-Origin verwenden, die keine CMS-Sitzung akzeptiert und keine Entwicklungs-/Verwaltungsoperationen bereitstellt. CMS-Cookies hostgebunden setzen; keine breite Cookie-Domain verwenden, die den Vorschauhost einschließt.
- Vorschau im `iframe` mit `sandbox="allow-scripts"` ausführen, ohne `allow-same-origin`, Top-Navigation, Forms oder Popuprechte. Pointer Lock nur bei tatsächlichem Spielbedarf zusätzlich zulassen.
- Die Sandbox ohne `allow-same-origin` erzeugt eine opaque Origin. Sie ist nicht dasselbe wie eine getrennte gehostete Origin und garantiert allein nicht, dass HTTP-Anfragen niemals Cookies transportieren.
- Serverseitige Sandbox-CSP und restriktive Ressourcenregeln verwenden. Auch bei direkter Navigation zum Vorschau-Dokument und zu aktiven HTML-/SVG-Unterressourcen müssen die Grenzen gelten; iframe-Attribute allein reichen nicht.
- Netzwerk standardmäßig begrenzen: kein freier Kontakt zu CMS-Admin-APIs, keine Service-Worker-Registrierung oder Weitergabe von Kontoauthentifizierung. Benötigte Runtime- und Medienressourcen explizit zulassen.
- `credentialless` darf unterstützend verwendet werden, ist aber wegen eingeschränkter Browserunterstützung keine Voraussetzung der Zugriffssicherheit. Verhalten mit und ohne Unterstützung testen.
- Ein eventueller `postMessage`-Kanal prüft erwartetes Framefenster, zulässige Origin, Vorschaukontext, Nachrichtentyp und Größenlimit. Opaque Origin `null` allein identifiziert keinen berechtigten Absender. Nur konkret erforderliche Vorschauoperationen weiterleiten, keine allgemeine Konto-/Verwaltungsbridge.

Technischer Referenzhinweis: [MDN: IFrame credentialless](https://developer.mozilla.org/en-US/docs/Web/Security/IFrame_credentialless) beschreibt das zusätzliche flüchtige Umfeld und die eingeschränkte Browserverfügbarkeit. Die Zielbrowser müssen in der tatsächlichen Implementierung geprüft werden.

#### 10.5.2 Preview-Berechtigung und Startticket

Ein einmaliges Startticket ist von der kurzlebigen Vorschau-Berechtigung zu unterscheiden. Ein Dokument benötigt mehrere autorisierte Abrufe für Runtime, Bilder, Audio/Video und Range-Requests. Nicht nach dem ersten HTML- oder Medienabruf alle weiteren notwendigen Anfragen sperren.

Empfohlen: Der authentifizierte Editor fordert eine Berechtigung für eine feste Projektrevision einschließlich Medienmanifest an. Falls ein einmaliges Startticket eingesetzt wird, wird es am Vorschauhost gegen diesen begrenzten Kontext eingelöst. Die Inhaltsberechtigung gilt nur kurzzeitig, ist widerrufbar und umfasst ausschließlich den genehmigten Snapshot; sie gewährt kein Bearbeiten, Bibliothekslesen oder Veröffentlichen. Ablauf, Rollenentzug und Rechtewiderruf bei jeder Inhalts-/Range-Anfrage prüfen.

Ein URL-Token ist ein Bearer-Geheimnis: nicht in Projektdatei, Notfallentwurf, Trace, Analytics, Referer oder gewöhnliche Proxy-/Serverlogs übernehmen. `Referrer-Policy: no-referrer`, kein Drittinhalt und keine öffentlichen Caches für private Vorschauen. Beim Schließen oder Kontextwechsel Berechtigung nach Möglichkeit widerrufen; kurze Ablaufzeit bleibt der verlässliche Rückfall bei Tab-/Netzabbruch.

Projektlaufzeit bleibt isoliert: keine Kontocookies oder Verwaltungs-APIs in frei programmierbare Spiel-Frames weiterreichen. Bestehende Upload-Sandbox- und Bridgeprinzipien erhalten. Ein importiertes oder freigegebenes GCS-Projekt darf nicht automatisch beliebige Editor-/Agentmethoden im vertrauenswürdigen Host ausführen.

## 11. GCS-Stages, Komponenten und Endpunkte

Alle folgenden Namen sind technische Vorschläge.

### 11.1 Oberflächen

| Stage | Inhalt |
| --- | --- |
| `stage_super_developers` | Bestehende Personen auswählen, Entwicklerrolle ergänzen/entziehen, neue Person einladen, Einladung erneuern/widerrufen. |
| `stage_developer` | Eigene und freigegebene Projekte, GCS öffnen, neues Projekt, Kopie erzeugen. |
| `stage_developer_project` | Projektmetadaten, Revisionen, Empfänger, Sourcecode-Freigaben, Release-Kandidaten und Zustimmung. |
| `stage_developer_media` | Eigene/freigegebene Medien, Upload, Vorschau, Rechte und Abhängigkeiten. |
| `stage_super_developer_releases` | Kandidatenprüfung, Veröffentlichung, Ablehnung/Sperre und optionale Benachrichtigung. |

Der GCS-Editor bleibt der vorhandene Editor, keine zweite Projektbearbeitungsoberfläche im CMS. CMS-Stages steuern Berechtigungen, Listen und Öffnen. Servergeneratoren sind idempotent und erhalten vorhandene IDs und editorgeschützte Bereiche.

#### 11.1.1 Blueprint- und Server-Stage-Zuordnung

Die Global-Hosting-Regel aus `DEVELOPER_GUIDELINES.md` gilt für tatsächlich globale Inhalte, nicht pauschal für jede Backend-Komponente. Gemeinsam genutzte globale Clientvariablen, Komponenten, Tasks und Actions liegen in `stage_blueprint`; lokale UI-Abläufe können in ihrer jeweiligen Stage verbleiben.

Vorgeschlagene Server-Stages: `stage_server_developer_accounts`, `stage_server_developer_projects`, `stage_server_developer_grants`, `stage_server_developer_media` und `stage_server_developer_releases`. Endpoint-Komponenten, Requestvariablen, Tasks und Actions bleiben dort stage-lokal. Gemeinsame Fachimplementierungen werden als registrierte Methoden in Modulen wiederverwendet, ohne requestübergreifende globale Zustände.

Begründung im Bestand: `scripts/cms/cms-runtime.cjs` löst Objekte, Variablen, Tasks und Actions im Kontext der jeweiligen Endpoint-Stage auf und merged keine Client-Blueprint-Inhalte. `scripts/cms/cms-project.cjs` entfernt `stage_server_*` bei der Browserauslieferung. Serverkomponenten in `stage_blueprint` zu verschieben würde deshalb weder unverändert aufgelöst noch automatisch aus der Clientauslieferung entfernt.

Abnahme: Neue Server-Endpunkte funktionieren über die reale stage-lokale Runtime, Serverkonfigurationen fehlen im ausgelieferten Clientprojekt, und globale Clientreferenzen bleiben im Editor-Roundtrip korrekt. Ein Server-Blueprint-Merge wäre eine separate zentrale Architekturänderung und ist nicht Teil dieser Erweiterung.

### 11.2 Registrierte Komponentenmethoden

Vorgeschlagene Verantwortlichkeiten:

- `TServerDeveloperAccounts`: Rollenvergabe, Einladungen und Zugangseinrichtung;
- `TServerDeveloperProjects`: Lesen, Erstellen, Speichern, Versionen und atomare Kopie;
- `TServerDeveloperGrants`: Eigentümerzustimmungen und Empfängerrechte;
- `TServerDeveloperMedia`: Medienzugriff, Uploadabschluss und Rechte;
- `TServerDeveloperReleases`: Version erzeugen, prüfen, zustimmen, veröffentlichen, sperren;
- bestehende Benachrichtigungsinfrastruktur: interne Zustellung und Deduplizierung.

Methoden bleiben klar abgegrenzte Fachoperationen. Ein einzelner universeller `dispatch(operation)`-Workflow ist nicht vorgesehen.

### 11.3 Endpoint-Verträge

Vorgeschlagene Routenfamilien:

| Familie | Operationen |
| --- | --- |
| `/api/cms/developer-admin/*` | Liste, Rolle setzen, neue Einladung, erneuern, widerrufen; nur aktiver SuperAdmin. |
| `/api/cms/developer/projects/*` | Liste, lesen, erstellen, speichern, Revisionen, kopieren. |
| `/api/cms/developer/source-grants/*` | Eigene Freigaben lesen, erteilen und widerrufen. |
| `/api/cms/developer/media/*` | Katalog, Metadaten, Upload, Rechte und kontrollierte Inhaltsauslieferung. |
| `/api/cms/developer/releases/*` | Kandidat erstellen, Eigentümerzustimmung, Status und Widerruf. |
| `/api/cms/developer-admin/releases/*` | Kandidat prüfen, veröffentlichen, ablehnen/sperren, informieren. |

Konkrete Pfade, HTTP-Methoden und DTOs bei der Implementierung an bestehende Endpoint-Konventionen angleichen. Inhalts-/Range-Auslieferung kann einen schlanken GET-Transport benötigen; die zugrunde liegende Berechtigungsprüfung bleibt dieselbe registrierte Fachoperation.

Standardablauf eines deklarativen Tasks:

`Sitzung prüfen → Rolle/Kontext prüfen → Fachoperation mit Objektberechtigung → Ergebnisbedingung → erlaubtes DTO oder Fehler senden`.

Schreiboperationen zusätzlich: erwartete Revision, Idempotenzbeleg und Commit prüfen. Wiederholung desselben Kommandos liefert dasselbe Ergebnis; geänderte Nutzlast mit gleichem Idempotenzschlüssel wird abgewiesen.

## 12. Optionale Benachrichtigungen

Empfohlener Auslösezeitpunkt ist die erfolgreiche Veröffentlichung einer Spielversion, nicht das Anlegen eines privaten Projekts.

- HouseAdmins: optional Nachricht über einen neuen veröffentlichten Spielstand; gezielte Empfänger oder alle berechtigten HouseAdmins wählbar.
- Eltern: vorzugsweise erst nach Aufnahme in einen für ihre Kinder relevanten Haus-/Raumkatalog. Empfänger serverseitig aus wirksamen Beziehungen und Verfügbarkeit bestimmen.
- HouseAdmin kann bei Katalog-/Raumzuordnung eine entsprechende Elterninformation auslösen.
- Titel, Beschreibung und Katalogverweis, keine private Quelle oder Entwickler-Personendaten.
- Version 1: interne CMS-Nachricht, kein automatisch vorausgesetzter E-Mail-Dienst.
- Optionaler Versand wird zusammen mit dem Fachvorgang über einen persistenten Zustellauftrag/Outbox abgesichert, damit Wiederholungen keine Doppelzustellung erzeugen.
- Deduplizierung nach Ereignis/Release, Empfänger und Nachrichtentyp; Auswertung prüft aktuelle Empfängerberechtigung.
- Zustellauftrag und veröffentlichter Fachzustand werden atomar persistiert. Verarbeitung ist wiederanlauffähig; eindeutige Nachrichtenschlüssel verhindern doppelte sichtbare CMS-Nachrichten trotz erneuter Verarbeitung.
- Outbox und Idempotenzbelege sind keine automatische Exactly-once-Garantie. Absturz zwischen Zustellung und Bestätigung, geänderte Wiederholung und Neustart müssen ausdrücklich getestet werden.

Benachrichtigungen erteilen weder Spielerzutritt noch Haus-/Raumfreigaben. Die Komfortphase D kann separat ausgeliefert werden, bleibt aber Teil des geplanten Gesamtumfangs.

## 13. Migration, Audit und Datenschutz

Die vorhandene Migrationskette zum Zeitpunkt der Umsetzung prüfen und die nächste freie Schema-Version verwenden; keine Versionsnummer aus diesem Plan blind übernehmen.

Migration initialisiert neue Bestände leer, erhält Personen/Rollen und übernimmt vorhandene Projekte nur bei belastbarer Eigentümerzuordnung. Keine Eigentümerzuordnung aus Dateiname oder Browsermetadaten erraten. Unzugeordnete Bestandsprojekte bleiben außerhalb des Entwicklerkatalogs bis zur kontrollierten Zuordnung.

Bereits öffentlich ausgelieferte Beispielprojekte/-medien werden nicht nachträglich als geheim bezeichnet. Für eine Entwicklerbibliothek müssen Herkunft, Eigentum und erlaubte Nutzung ausdrücklich geprüft werden.

Validierung umfasst Referenzen, eindeutige IDs, aktive Zustände, Versions-/Hashbezüge und Zielgruppenrechte. Speicheroperationen verwenden den bestehenden Commit-/Journalvertrag; Veröffentlichung, Zustimmung und Benachrichtigungsauftrag dürfen nicht durch unabhängige Actions auseinanderfallen.

Auditieren: Rollenänderungen, Einladungsstatus, Projektkopien, Freigaben/Widerrufe, Releases, Veröffentlichungen/Sperren. Tickets, Passwörter, Sitzungswerte und vollständige private Projektinhalte gehören nicht in normale Logs oder Trace.

Privacy-Export und Anonymisierung erweitern. Kontoentzug ist keine Datenlöschung. Löschung und Eigentumsübertragung verlangen einen eigenen ausdrücklich bestätigten Prozess; aktive Releases und Rechte anderer Beteiligter sind zu berücksichtigen.

## 14. Geplante Dateien

Neue Dateien sind Vorschläge; vorhandene Konventionen sind bei der Umsetzung zu berücksichtigen.

| Datei/Bereich | Änderung |
| --- | --- |
| `scripts/cms/cms-core.cjs` | Entwicklerrolle und Objektberechtigungen, bestehende Haus-/Raumregeln erhalten. |
| `scripts/cms/cms-admin.cjs` | Kontozugang ohne Hausverwaltung und Mehrfachkontexte. |
| `scripts/cms/cms-server-components.cjs` | Entwicklerkontext und neue Komponentenmethoden registrieren. |
| `scripts/cms/cms-server.cjs` | Geschützter Editorzugang, neue Transportintegration, Enrollment und Medienauslieferung. |
| `scripts/cms/cms-developer-accounts.cjs` neu | Rollenvergabe, Ticket- und Kontoeinrichtung. |
| `scripts/cms/cms-developer-projects.cjs` neu | Projektbesitz, Revisionen und Kopieren. |
| `scripts/cms/cms-developer-grants.cjs` neu | Sourcecode- und Medienrechte einschließlich Herkunftsrechten. |
| `scripts/cms/cms-developer-media.cjs` neu | Medien-Fachoperationen und Abhängigkeiten. |
| `scripts/cms/cms-developer-releases.cjs` neu | Versionsbezogene Zustimmung und Veröffentlichung. |
| Generatoren für Entwickler-UI und Server-Stages neu | Idempotente GCS-Stages, registrierte Methods und Navigation. |
| `game-server/public/projects/GCS-CMS.json` | Generierte Entwickler-/SuperAdmin-Stages und Tasks. |
| `scripts/cms/cms-migrations.cjs`, `cms-store.cjs`, `cms-privacy.cjs`, `cms-trace.cjs` | Migration, konsistentes Speichern/Restore, Datenschutz und Redaction. |
| `src/components/TServerDeveloper*.ts` neu | Sichtbare Designverträge, Inspector-/Schema-/Registry-Anbindung. |
| `src/ports/IStorageAdapter.ts`, revisionsfähiger Zusatzport und `src/adapters/` | Bestehende Adapter kompatibel halten; revisionsfähigen CMS-Onlineadapter mit eindeutigen Ergebnis-/Konfliktverträgen ergänzen. |
| `src/adapters/IndexedDBAdapter.ts` und Notfallentwurfsverwaltung | Kontogetrennte lokale Entwürfe, Basisrevision, Tabkonkurrenz und kontrollierte Wiederherstellung; Schlüssel-/Aufbewahrungskonzept vor Produktivaktivierung klären. |
| `src/editor/services/EditorProjectSaver.ts`, `DiskRevisionGuard.ts`, `src/editor/EditorSessionManager.ts` | Online-Projektidentität, Revisionsschutz, Cache-/Kontotrennung. |
| `src/editor/SaveAsDialog.ts` | Eigene Projektkopie statt fremdem Dateipfad-Speichern. |
| Medienpicker, `ImageGalleryModel`, `AssetAnalyzer`, `GameExporter` | Berechtigungsgefilterte Medien und exportfähige Snapshots. |
| `game-server/src/server.ts` und `game-server/src/routes/` | Öffentliche Netzbereitstellung von Dev-/privaten Pfaden ausschließen; lokalen Entwicklungsweg erhalten. |
| Build-/Deploymentkonfiguration | Produktionseditor und CMS/API unter gemeinsamer HTTPS-Origin, davon getrennte Vorschau-Origin, geschützte Routinggrenzen und persistente Speicherung; keine private Quelle in Buildassets. |
| Tests und `package.json` | Gezielte Rollen-, Projekt-, Medien-, Freigabe- und Browserprüfungen erreichbar machen. |

## 15. Gestufter Rollout und reviewbare Schritte

Die Erweiterung wird nicht als ein einziger Block ausgeliefert. Drei funktionale Meilensteine A–C liefern jeweils eigenständig testbare Ergebnisse; Phase D ergänzt Komfort. Die vorhandenen acht Umsetzungsschritte bleiben als Arbeitszerlegung erhalten und werden den Phasen zugeordnet.

| Phase | Lieferumfang | Eintritts-/Abnahmegrenze |
| --- | --- | --- |
| **A: Privater Online-Entwickler (MVP 1)** | Schritte 1–4: Rolle/Einladung, eigene Projekte, eigene `bundled`-Medien, Onlineadapter, Revisionsschutz, sichere Vorschau und Notfallsicherung. Keine Freigabe an andere Entwickler, keine Releases. | Alters-/Kontoregel klären; private Speicherung und Netz-/Sandboxgrenzen von Beginn an. Tatsächlicher Login → eigenes Projekt/Medien → Save/Reload → Vorschau geprüft. |
| **B: Freigaben und Kopieren (MVP 2)** | Schritt 5: Einzel-/Alle-Entwicklerfreigaben auf feste Snapshots, read-only Fremdprojekte und vollständige Kopien; `shared`-Bibliothek mit expliziten Medien-/Herkunftsrechten. | Phase A abgenommen; Kopier-/Weitergaberechte festgelegt. Fremdzugriffe, Revisionen und Medienabhängigkeiten mit zwei Entwicklern und SuperAdmin geprüft. |
| **C: Release und Spielbetrieb (MVP 3)** | Schritt 6: Release-Snapshot, Eigentümerzustimmung, SuperAdminprüfung, Veröffentlichung und Widerruf. HouseAdmins nehmen veröffentlichte Spiele selbst in Hauskatalog/Räume auf. | Phase B abgenommen; Rechte und Ablauf für vorhandene Kopien/Releases beschlossen. Kein automatischer Hauskatalogeintrag und keine Sourcecode-Freigabe durch Veröffentlichung. |
| **D: Komfort/Benachrichtigungen** | Schritt 7: optionale HouseAdmin-/Elternnachrichten mit persistenter Outbox und Deduplizierung. | Veröffentlichungs-/Zuordnungsereignisse stabil; Zustellung nach Neustart und Empfängerprüfung abgenommen. |

Schritt 8 begleitet jede Phase als Test-/Regressionsgate; nach Phase D folgt zusätzlich die Gesamtpfadabnahme. Neue Collections, Endpunkte und Oberflächen erst mit ihrer Phase aktivieren. Nicht gelieferte Funktionen sind nicht nur versteckt, sondern serverseitig unzugänglich. Jede Phase hat getrennte Migrationen soweit nötig, isolierte Fixtures und nachvollziehbare QA-Ergebnisse. Der erste private MVP benötigt keine leeren Lizenz-/Release-Verwaltungsoberflächen auf Vorrat.

**Keine Sicherheitsverschiebung:** Eigentümerprüfung, CSRF/Origin-Schutz, private Medienablage, Rollentzug, Revisionskonflikte und Vorschauisolation gehören bereits zu Phase A. Phase D darf verzögert werden, die verlangte Benachrichtigungsoption bleibt jedoch im Gesamtplan und in den Fertigstellungskriterien erhalten.

### Schritt 1 (Phase A): Verträge, Datenmodell und Speichergrenzen

Für Phase A erforderliche offene Entscheidungen aus Abschnitt 17 festlegen; Kopier-/Releasefragen bleiben spätestens vor Phase B/C zu entscheiden. Rechtefunktionen, DTOs, Zustandsübergänge und kompatible Revisions-/Idempotenzkontrakte definieren. Private Projektmedien und Ablage samt Backup/Restore vorbereiten; nur phasenweise benötigte Bestände migrieren.

**Abnahme:** Leere Entwicklerbestände nach Migration; keine unbeabsichtigte Bestandsfreigabe; keine öffentlichen privaten Projekt-/Medienpfade.

### Schritt 2 (Phase A): Rolle, Einladung und Kontokontext

SuperAdmin-Stage, deklarative Endpunkte und Einladungseinlösung implementieren. Entwicklerzugang für neue und vorhandene Personen ohne Haus ermöglichen. Bestehende Mehrfachrollen erhalten.

**Abnahme:** Nur aktiver SuperAdmin vergibt Rolle; Neuerstellung/Bestandsnutzer/Widerruf/Einladung funktionieren über echte Runtime und HTTP.

### Schritt 3 (Phase A): Geschützte Projekt- und Medien-API

Besitz, Zugriff, Revisionen, Upload und private `bundled`-Projektmedien implementieren. Direkte und alternative Zugriffswege schließen. Lokale Dev-APIs bleiben im Onlinebetrieb unerreichbar. Vorschau-Berechtigungen, Cookiegrenzen und CSP mit ihrer separaten Origin vorbereiten; keine unsichere Vorschau als Übergangslösung.

**Abnahme:** Zwei Entwickler können keine fremden privaten Inhalte oder deren Existenz über alternative Pfade ermitteln; Upload-/Range-/Cachegrenzen geprüft.

### Schritt 4 (Phase A): Online-GCS integrieren

Vorhandenen Editor mit Onlineadapter, eigener Projektliste und geschütztem Projektmedienpicker anbinden. Autosave und manuelles Speichern durch denselben revisionsfähigen Ablauf führen. Sichere Vorschau, Kontowechsel, Notfallentwurf, Quoten- und Netzwerkfehler behandeln. Freigegebene Fremdprojekte erst in Phase B anbieten.

**Abnahme:** Tatsächlicher Browser lädt und speichert eigene Projekte/Medien online; parallele Änderungen erzeugen `409`. Notfallentwurf übersteht den zulässigen Wiederherstellungsfall ohne fremden Zugriff oder Überschreiben. Vorschau kann keine CMS-Sitzung oder Verwaltungsoperation verwenden.

### Schritt 5 (Phase B): Sourcecode-Freigaben und Kopien

Einzel-/Alle-Entwicklerfreigaben auf feste Snapshots, read-only Fremdprojekte und serverseitige Kopien samt gebündelten Medien-/Herkunftsrechten umsetzen. `shared`-Bibliothek mit expliziten Nutzungsrechten ergänzen. Projektinterne eigene Medien ohne Einzelgrant-Konfiguration freigeben; fremde Medien automatisch anhand ihrer Belege prüfen.

**Abnahme:** Nur genehmigte Revisionen und Empfänger; Kopie vollständig und privat; keine stille Rechteeskalation durch neue Eigentümer-ID.

### Schritt 6 (Phase C): Spielfreigabe und Veröffentlichung

Release-Snapshot, Eigentümerzustimmung, SuperAdminmoderation, Spielintegration und Widerruf implementieren. Bestehende Launch-/Sitzungs- und Haus-/Raumregeln erhalten.

**Abnahme:** Veröffentlicht wird ausschließlich exakt der genehmigte Inhalt; Originalentwurf bleibt privat; Widerruf/Parallelität getestet.

### Schritt 7 (Phase D): Benachrichtigungen

Optionalen HouseAdmin-/Elternversand über interne CMS-Infrastruktur und persistente Deduplizierung integrieren.

**Abnahme:** Richtiger Empfängerkreis, kein Doppelversand, keine privaten Inhalte oder impliziten Spielrechte.

### Schritt 8 (jede Phase): Gesamtpfad und Regressionen

Online-Browser-, direkte HTTP-, GCS-Runtime-, Medien-, Lifecycle- und Restoretests nach dem Lieferumfang der jeweiligen Phase durchführen. Lokale Editor-, Upload-, Rollen-, Eltern-, Sponsoring- und Multiplayerregressionen ausführen. Adapter-Vertragstests und die 1000-Zeilen-Grenze prüfen. Ergebnisse einschließlich noch nicht gelieferter Phasen im QA-Bericht nachvollziehbar dokumentieren; ein grüner Phase-A-Bericht ist keine Gesamtfreigabe für A–D. Produktionsbereitstellung anhand eines isolierten Testsystems abnehmen.

**Abnahme:** Pro Phase ist der jeweils gelieferte Gesamtpfad nachzuweisen, nicht nur Methoden-/Dateiexistenz. Nach Phase A: Login → GCS → eigenes Projekt/Medien → Save/Reload/Vorschau. Nach B zusätzlich Freigabe/read-only/Kopie, nach C Veröffentlichung → Haus-/Raumzuordnung → Raumspiel, nach D optionale Zustellung samt Wiederanlauf.

## 16. Konkrete Prüfmatrix

| Prüfung | Erwartung |
| --- | --- |
| Neuer Entwickler ohne Haus | Einladung einlösen, anmelden, eigenes Projekt erstellen und online öffnen. |
| Bestehender Eltern-/HouseAdmin-Benutzer | Rolle ergänzt; Zugang und bisherige Rollen unverändert. |
| Nicht-SuperAdmin vergibt Rolle | Abgewiesen, keine Teilmutation. |
| Doppelter Rollenauftrag | Idempotent, kein zweiter Rollenrecord. |
| Einladung erneut/abgelaufen/widerrufen/verbraucht | Nur aktuelles einmaliges Ticket verwendbar; keine Wiederverwendung. |
| Emoji-Sitzung mit Entwicklerrolle | Kein Entwicklungszugriff ohne geeignete Kontositzung. |
| Entwicklerrolle entzogen bei offenem Editor | Folgende Reads/Writes/Uploads gesperrt; verständlicher Zustand. |
| Fremdes Privatprojekt: Liste, ID, Revision, Datei, Export | Keine unberechtigten Daten oder Existenzdetails. |
| Gefälschte `ownerId`/Freigabe im Projekt-JSON | Kein Effekt auf serverseitige Fachrechte. |
| Einzel-Sourcecode-Freigabe an A | A darf lesen/kopieren, B nicht. |
| Sourcecode-Freigabe für alle Entwickler | Nur aktive Entwickler im zulässigen Kontokontext. |
| Neue private Projektrevision | Ohne passende Zustimmung nicht durch alte Freigabe offengelegt. |
| Fremdes Original speichern/Autosave/manueller Save | Abgewiesen, Original unverändert. |
| Wiederholte Kopie mit gleichem Kommandoschlüssel | Dasselbe Ergebnis, keine Doppelkopie. |
| Geänderte Wiederholung | Konflikt/Ablehnung statt falscher Wiederverwendung. |
| Kopie ohne Weiterveröffentlichungsrecht | Privat nutzbar, Veröffentlichung/Weitergabe abgewiesen. |
| Sourcecode-Widerruf | Keine neuen Reads/Kopien; bestehende rechtmäßige Kopien nicht technisch zurückgerufen. |
| Spielfreigabe ohne Sourcecode-Freigabe | Spiel kann nach Moderation verfügbar sein, vollständiges Editorprojekt bleibt gesperrt. |
| Zustimmung zu Version 1, Veröffentlichung von Version 2 | Abgewiesen. |
| Zustimmung/Widerruf während Veröffentlichung | Atomare Prüfung, keine Veröffentlichung nach wirksamem Widerruf. |
| Private Medien: Manifest, Thumbnail, Original, Range | Dieselbe Zugriffskontrolle, kein globales Datenleck. |
| Eigene gebündelte Projektmedien freigeben | Projekt-Snapshot reicht, keine Einzelgrants nötig; Medienversionen bleiben fest. |
| Fremdes Bibliotheksmedium als `bundled` kopieren/einbetten | Herkunftsrechte bleiben erhalten; keine zusätzliche Weitergabeberechtigung durch Speicherklassenwechsel. |
| Projektfreigabe mit Medien | Erlaubte Projektmedien erreichbar, keine unabhängige Offenlegung privater Bibliotheksbestände. |
| Projektkopie mit unberechtigten Medien | Konkrete Ablehnung, kein kaputtes sichtbares Teilprojekt. |
| Medienupdate nach Veröffentlichung | Bestehendes Release unverändert. |
| Schadhaftes SVG/zu großer Upload/Pfadmanipulation | Abgewiesen bzw. sicher behandelt, kein Überschreiben fremder Daten. |
| Zwei parallele Speicherstände | Revisionskonflikt statt Datenverlust. |
| Online-Save ohne Basisrevision für vorhandenes Projekt | Abgewiesen, kein Legacy-/Dev-Fallback. |
| Speicherresultate: Erfolg, Konflikt, `401`, `403`, Netzwerkfehler | Eindeutige Zustände; lokaler Draft erzeugt keine falsche Server-Erfolgsmeldung. |
| Lokale/native/Desktop-Speicheradapter nach Porterweiterung | Bestehende Signaturen und Verhalten kompatibel; kein erzwungener Onlinekontext. |
| Unbekanntes Save-Ergebnis nach Netzabbruch | Kommandobeleg/Revision prüfen; keine unkontrollierte Wiederholung mit geänderter Nutzlast. |
| Notfallentwurf nach Neustart | Gleiches Konto und Berechtigung geprüft, Wiederherstellung angeboten, Basisrevision berücksichtigt. |
| Notfallentwurf und inzwischen neuerer Serverstand | Kein automatisches Überschreiben; Konfliktlösung oder berechtigte Kopie. |
| Notfallentwurf: Quotenfehler, zwei Tabs, explizite Abmeldung | Sichtbare Sicherungsfehler, keine Entwurfsüberschreibung zwischen Tabs, definierte Aufbewahrung/Löschung. |
| Netzwerkabbruch bei Save/Upload/Kopie | Keine sichtbaren halben Zustände; sichere Wiederholung. |
| Vorschau | Kein Zugriff auf Kontocookies, Verwaltungsrechte, fremde Medien oder Kinder-Spielzeit. |
| Vorschau mit und ohne `credentialless`-Unterstützung | Gleiche Sicherheitsgrenzen; kein unsicherer Browser-Fallback. |
| Vorschau als Frame und direkt geöffnetes HTML/SVG | Sandbox/CSP auch bei direkter Navigation, keine CMS-Cookies/Originrechte. |
| Vorschau-HTML, Runtime, Medien und wiederholte Range-Anfragen | Begrenzte Berechtigung funktioniert für alle erlaubten Ressourcen, keine einmalige Gesamtsperre nach Erstabruf. |
| Preview-Ticket abgelaufen/widerrufen/Rolle entzogen | Folgende Inhalte abgewiesen, keine neuen Bibliotheks- oder Kontorechte. |
| Preview-Token in Referer, Logs, Draft oder Export | Keine Weitergabe/Persistenz des Bearer-Geheimnisses. |
| `postMessage` aus fremdem Frame mit Origin `null` | Keine Weiterleitung, Frame-/Kontextprüfung greift. |
| Öffentliche `/projects`, `/images`, Dev-Endpunkte, Backups | Kein alternativer Zugriff auf private Onlinebestände. |
| Benutzerwechsel/Logout und Browsercache | Kein Wiederherstellen fremder privater Projekte. |
| Backup/Restore nach Widerruf | Metadaten/Dateien konsistent; widerrufene Rechte nicht ungewollt reaktiviert. |
| Neues veröffentlichtes Spiel ohne Haus-/Raumzuordnung | Noch nicht im Raum spielbar. |
| Optionaler Benachrichtigungsauftrag wiederholt | Keine Doppelzustellung, keine implizite Freigabe. |
| Neustart/Absturz nach Nachrichtenerzeugung vor Outboxbestätigung | Wiederanlauf ohne doppelte sichtbare CMS-Nachricht. |
| Elterninformation | Nur relevante bestätigte Beziehungen, keine private Sourcecode-Verlinkung. |
| Editor-Roundtrip der neuen CMS-Stages | Tasks, Actions, Referenzen und IDs erhalten. |
| Server-Endpoint mit stage-lokalen Aufgaben | Tatsächliche Runtime löst alle Zielkomponenten, Tasks und Actions auf. |
| Ausgeliefertes Clientprojekt | Globale Clientinhalte verfügbar, keine `TServerDeveloper*`-/Endpoint-Konfiguration aus Server-Stages. |
| Phase A ohne B/C/D | Kein zugänglicher Freigabe-/Release-/Benachrichtigungsendpoint; eigene Medien und sichere Vorschau vollständig nutzbar. |
| Veröffentlichung in Phase C | Keine automatische Hauskatalog-/Raumzuordnung; HouseAdminentscheidung bleibt nötig. |
| Bestehende lokale/Browser-/Desktop-/Upload-/MP-Pfade | Unverändert funktionsfähig. |

Vorgeschlagene gezielte Testdateien: `test-cms-developer-accounts.cjs`, `test-cms-developer-projects.cjs`, `test-cms-developer-media.cjs`, `test-cms-developer-preview.cjs`, `test-cms-developer-releases.cjs`, `test-cms-developer-ui.cjs`. Zusätzlich revisionsfähige Adapter-Vertragstests und Browserentwurfs-/Kontowechseltests einplanen. Der genaue Zuschnitt folgt der bestehenden Testkonvention.

Die Matrix ist ein konkretes Mindestprüfnetz, keine Behauptung lückenloser Sicherheit. Phasengrenzen, Browserunterstützung, Speicherung und Berechtigungsänderungen benötigen tatsächliche Laufnachweise; neue Befunde führen zu ergänzenden Regressionen.

Serverfachtests laufen über echte deklarative Endpoint-Tasks und registrierte Methoden. Zusätzlich direkte HTTP-Prüfungen und Browserabläufe ausführen; reine Methodenaufrufe beweisen keinen sicheren Transport-/Editorpfad. Testdaten und Speicherung sind isoliert, produktive Personen-/Projektbestände bleiben unverändert.

## 17. Offene Entscheidungen und empfohlene Defaults

| Entscheidung | Empfehlung | Status |
| --- | --- | --- |
| Kinder als Entwickler | Erwachsene-only ist eine mögliche Produktbegrenzung für Version 1, aber noch nicht beschlossen. `people.kind: 'adult'` weist keine rechtliche Geschäftsfähigkeit nach; Kontozugang und Alters-/Einwilligungsregeln ausdrücklich festlegen. Entwicklungszeit nicht stillschweigend mit Kinder-Spielzeit gleichsetzen. | Fachlich offen; vor Phase A entscheiden. |
| Fremdprojekte lesen/kopieren, Original nicht bearbeiten | So umsetzen. | Bestätigt. |
| Zielgruppe einzelne/alle Entwickler | Beide unterstützen, Zustimmung des Eigentümers beachten. | Bestätigt. |
| Spielfreigabe getrennt vom Sourcecode | Strikte Trennung. | Bestätigt. |
| Sourcecode-Freigabe für zukünftige Revisionen | Version 1 ausschließlich feste Projekt-/Medien-Snapshots, keine automatische Zwischenstandsfreigabe. | In den Plan übernommen. |
| Hybridmedien | Eigene `bundled`-Projektmedien folgen der Snapshotfreigabe; `shared`-Medien und fremde Herkunftsrechte explizit prüfen. | In den Plan übernommen. |
| Rollout | Drei funktionale MVPs A–C plus Benachrichtigungsphase D; Sicherheitsgrenzen bereits in A. | In den Plan übernommen. |
| Weiterveröffentlichung/Weitergabe von Kopien | Nur mit ausdrücklich eingeräumten Herkunftsrechten. | Vor Umsetzung bestätigen. |
| Widerruf und bestehende Kopien/Releases | Keine rückwirkende technische Rückholung; zukünftige Zugriffe sperren. Eine administrative CMS-Sperre entzieht nicht automatisch sämtliche externen Nutzungsrechte. Dauer eingeräumter Rechte und Plattform-Sperren getrennt festlegen. | Fachlich offen; vor Phase B/C bestätigen. |
| Veröffentlichungsentscheidung | SuperAdmin veröffentlicht nach versionsbezogener Eigentümerzustimmung. | Empfohlener Ablauf. |
| Elternbenachrichtigung | Erst bei relevanter Haus-/Raumverfügbarkeit; HouseAdmins bereits bei Veröffentlichung optional informieren. | Empfohlener Default. |
| Netzbereitstellung | Editor/CMS/API unter gemeinsamer HTTPS-Origin, Vorschau auf getrennter cookie-freier Origin mit Sandbox/CSP; `credentialless` nur zusätzliche Härtung. | Architektur präzisiert; konkrete Hostingdetails offen. |
| Speicherport | `IStorageAdapter` kompatibel erhalten, revisionsfähigen Zusatzvertrag und gemeinsamen Editor-Speicherablauf verwenden. | In den Plan übernommen. |
| Notfallentwurf | Konto-/Projekt-/Tabtrennung und revisionssichere Wiederherstellung; keine pauschale Verschlüsselungsgarantie. | In den Plan übernommen; Schlüssel-, Aufbewahrungs- und Logoutregel vor Produktivaktivierung klären. |
| Blueprint-Konformität | Globale Clientinhalte in `stage_blueprint`, Backend-Endpoints/Komponenten stage-lokal in `stage_server_developer_*`; keine Server-Blueprint-Migration. | Bestandsgerechte Zuordnung in den Plan übernommen. |
| Einladungs-/Benachrichtigungs-E-Mail | Version 1 Linkweitergabe und interne CMS-Nachrichten, kein neuer E-Mail-Dienst. | Empfohlener Default. |

Diese offenen Punkte sind keine stillschweigend bereits genehmigten Änderungen am fachlichen Verhalten.

## 18. Fertigstellungskriterien

Ein MVP kann nach seinem eigenen Phasengate abgenommen werden. Die vollständige erste Version einschließlich der optional auswählbaren Benachrichtigungsfunktion ist erst nach A–D fertig, wenn:

1. SuperAdmin neue und bestehende Entwicklerkonten ohne Hausabhängigkeit verwalten kann;
2. der GCS tatsächlich über das Netz erreichbar und seine Datenoperationen geschützt sind;
3. Entwickler ausschließlich eigene oder ausdrücklich zugängliche Projekte und Medien sehen;
4. freigegebene Originale schreibgeschützt und Kopien mit korrekten Herkunfts-/Medienrechten nutzbar sind;
5. Spielfreigabe, Sourcecode-Freigabe, administrative Veröffentlichung und Haus-/Raumfreigabe getrennt geprüft werden;
6. Versionen, Revisionskonflikte, kompatible Speicheradapter, Notfallentwürfe, Widerruf, Rollentzug, Kontotrennung und Restore nachgewiesen funktionieren;
7. optionale interne Benachrichtigungen korrekt und dedupliziert arbeiten;
8. tatsächliche Browser-, HTTP-, GCS-Runtime- und Regressionstests erfolgreich sind, einschließlich der separaten Vorschau-Origin, Server-/Client-Stage-Trennung und Hybridmedienrechte.

Codelektüre, vorhandene Dateien und einzelne grüne Fachtests ersetzen diese Gesamtpfadabnahme nicht. Builds, Dienststarts, produktive Datenmigration, Löschungen und externe Nachrichten werden nicht durch diesen Plan automatisch zur Ausführung freigegeben.
