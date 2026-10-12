# CMS-Erweiterung: Sponsor — detaillierter fachlicher und technischer Umsetzungsplan

**Status: Plan zur fachlichen und technischen Freigabe. Nicht implementiert.**

Dieser Plan basiert auf dem aktuell gelesenen Arbeitsstand von `game-builder-v2`, einschließlich der noch uncommitteten HouseAdmin-Raumzuordnungsänderungen. Er ist keine Bestätigung eines erfolgreichen Builds oder Browserlaufs. Im Rahmen dieser Planung werden ausschließlich diese Markdown-Datei erstellt und bestehende Dateien gelesen; keine Generatoren, Migrationen, Builds, Dienste oder Tests gestartet.

## 1. Auftrag, Umfang und verbindliche Leitplanken

Ein Sponsor begleitet ausdrücklich genehmigte Kinder bei Lern- und Spielleistungen und bietet dafür vereinbarte Belohnungen an. Die Eltern kontrollieren die Begleitung, den Datenzugriff, die Vereinbarungen und die Einlösung. Das Kind kann widersprechen oder die Begleitung pausieren. Keine Sponsor-Kind-Interaktion darf vor den zuständigen Eltern verborgen sein.

### 1.1 Verbindlich aus der Anforderung

- Kein Kindzugriff vor Genehmigung und kein fortgesetzter Leistungszugriff nach Beendigung.
- Sponsorberechtigung immer aus konkreter genehmigter Beziehung, niemals aus Hausmitgliedschaft oder einer allgemeinen Rolle allein.
- Sponsor verändert weder bestehende Leistungen noch erspielte Punkte.
- Eltern bestimmen Fächer, Aktivitäten, Zeiträume und Detailgrad der Einsicht. Eine Erweiterung braucht neue Zustimmung.
- Einzelantworten, Fehler und persönliche Lerninhalte sind standardmäßig verborgen; kein genereller Karteikasten-/Stapelzugriff.
- Vereinbarungen und Zustimmungen werden versioniert. Eltern und Sponsor müssen derselben konkreten Version zugestimmt haben.
- Änderungen treten erst mit den erforderlichen Zustimmungen in Kraft. Bis dahin gilt die bisherige wirksame Version.
- Bestehende Ansprüche bleiben bei Änderung und Beendigung erhalten und werden nach ihrer ursprünglichen Regel abgewickelt.
- Nachrichten, sofern angeboten, nur im gemeinsamen Familienbereich, mit vollständiger elterlicher Einsicht.
- Zustandswechsel, Akteure, Zeitpunkte, alte/neue Werte und Zustimmungen dauerhaft nachvollziehbar.
- Keine doppelte Anspruchserzeugung, Einlösung oder Punkteabbuchung.
- Keine Zahlungsabwicklung, Bankdaten, Gutscheinkäufe oder automatischen externen Leistungen im ersten Schritt.
- Bestehende Rollen/Rechte und die Browser-Version erhalten.

### 1.2 Noch nicht genehmigte Empfehlungen

Alle im Plan mit „Empfehlung“ bezeichneten Festlegungen sind Vorschläge, keine bereits erteilte Implementierungsfreigabe. Besonders Zustimmungsquorum, Punktebewertung, Sponsorregistrierung, Nachrichtenumfang und Speicherhärtung sind vor Umsetzung zu entscheiden (Kapitel 15).

### 1.3 Nicht-Ziele

Kein öffentlicher Kinderkatalog, keine Ranglisten, kein privater Direktchat, keine automatische Alters-/Identitätsprüfung, kein Umbau aller Spiele in serverautoritative Simulationen, keine globale Schulnote, keine Ablösung des CMS durch ein neues Backend. Native Desktop-Rechte und Multiplayer-Spielrechte werden durch Sponsoring nicht erweitert.

## 2. Bestandsanalyse und konkrete technische Ausgangslage

### 2.1 Personen, Rollen, Beziehungen und Sitzungen

| Vorhandene Struktur | Aktueller Befund | Verwendung für Sponsor |
|---|---|---|
| `people` | Personenart `child` oder `adult`; `active`, `authVersion` | Sponsor als bestehende erwachsene Person, keine neue Personenart |
| `roles` | Bereichsrollen mit `personId`, `areaId`, `role`, `active` | Neue Rolle `sponsor`, ohne Verwaltungs-/Raumrechte |
| `guardians` | `childId`, `guardianId`, Status `pending/confirmed/revoked` | Einzige Grundlage, wer als Elternkonto für dieses Kind zuständig ist |
| `memberships` | Zutritt zu Haus/Raum, keine Familienberechtigung | Nicht als Sponsor-Kind-Freigabe verwenden |
| `core.can()` | `viewChild/viewProgress` nur bestätigte Eltern; Karten für Kind/Eltern; Verwaltung getrennt | Zusätzliche Sponsoraktionen, keine Aufweichung dieser bisherigen Aktionen |
| Passwortkonto | Zugangsdaten in `cms-admin-auth.json`; verifizierte Kontositzung über `core.issueSession()` | Vorhandenen Passwortkanal nutzen, keine ungeschützten Sponsor-Tokens |
| `cms_admin` | Verwaltungssitzung; `adminRoles/activeRole` | Keine Sponsorrolle in `adminRoles` aufnehmen |
| `cms_account` | Eltern-/Beobachterkonto; Kind zusätzlich Emoji-/Profilsitzung | Sponsor als weiterer Kontokontext; Kind bleibt bei vorhandener Anmeldung |

Maßgebliche Dateien:

- `scripts/cms/cms-core.cjs`: `validate`, `childrenOf`, `guardiansOf`, `activeRoles`, `can`, `issueSession`, `session`.
- `scripts/cms/cms-admin.cjs`: `verify`, Kontextbestimmung, Verwaltungssitzungen.
- `scripts/cms/cms-parent.cjs`: Elternadapter und Eltern-/Beobachtereinrichtung.
- `scripts/cms/cms-server-components.cjs`: `TServerSession`, `TServerQuery.contexts`, Fachmethoden.
- `scripts/cms/cms-add-login-player-server-stages.cjs`: deklarative Anmeldung und Kontextantwort.

Wichtig: `requireRole('account')` und auch die derzeitige Richtlinie `requireRole('admin')` prüfen zunächst nur das Vorhandensein einer Sitzung. Die fachliche Objektberechtigung muss zusätzlich geprüft werden. Ein neues Sponsor-Frontend mit versteckten Buttons oder ein account-Guard allein wären keine ausreichende Absicherung.

### 2.2 Welche Eltern dürfen zustimmen?

`childrenOf/guardiansOf` berücksichtigen bestätigte Guardian-Beziehungen. Für Sponsorentscheidungen muss zusätzlich die Aktivität der Elternperson geprüft werden. Eine ausstehende oder widerrufene Beziehung darf nicht zustimmen.

Es existieren verschiedene, nicht verallgemeinerbare Regeln:

1. Die Einrichtung einer Elternbeziehung folgt einem Vier-Augen-Verfahren; einladende/betroffene Person dürfen die Zuordnung nicht selbst bestätigen (`approveGuardian`, `enrollParent`).
2. Die Budgetverwaltung erlaubt Einschränkungen sofort; bei mehreren Eltern und einer Erhöhung der Minuten verlangt der Code einen anderen Elternteil (`set-budget`, `approve-budget`).
3. Der bestehende Fachplan `docs/CMS-Plan.md`, E06, beschreibt dagegen die Zustimmung der anderen berechtigten Elternteile. Für drei oder mehr Eltern ist das strenger als die implementierte Zweitbestätigung.

**Ergebnis: Der Kreis der grundsätzlich zuständigen Eltern ist vorhanden; ein eindeutiges allgemeines Quorum für Sponsorfreigaben fehlt.** Die bestehende Budgetregel wird nicht stillschweigend verändert oder als Sponsorregel übernommen. Entscheidung D1 ist notwendig.

### 2.3 Leistungsdaten sind noch kein CMS-Punktekonto

`progress` speichert derzeit Ereignisse mit `eventId`, `childId`, `gameId`, `sessionId`, `metric`, `value`, `unit`, `reportedAt`, `source:'game'`, `schemaVersion`.

Der bestehende Berichtspfad prüft:

- autorisierte Spielsitzung und laufenden/pausierten Zustand,
- aktivierte Spielbewertungen (`ratings`), bekannte Metrik,
- vorhandene Ereignis-ID, numerischen Wert,
- Duplikate anhand der Ereignis-ID.

Er prüft **nicht automatisch die Richtigkeit der gemeldeten Spielleistung**. Das Spiel liefert Wert und neue Ereignis-ID. Wiederholte Meldungen mit neuen IDs, unrealistische numerische Werte und die Vertrauenswürdigkeit eines hochgeladenen Spiels benötigen für belohnungswirksame Ergebnisse zusätzliche Regeln. `TServerCards.answer` erhält die Angabe `correct` vom Kind/Client; ein Leitner-Fach ist ebenfalls kein unabhängiger Leistungsnachweis.

Weitere Einschränkungen:

- Kein allgemeines Leistungspunkte-Ledger, kein einlösbares Punkteguthaben und keine Belohnungssammlung gefunden.
- Spielinterne Scores, etwa Tetris/PingPong, sind keine vergleichbaren CMS-Leistungspunkte.
- `progress` enthält keine allgemeine, stabile Fach-/Aktivitätstaxonomie und speichert derzeit keine vollständige Prüfprovenienz.
- Der bestehende Fachplan E07 sieht Einzelmetriken statt einer pauschalen Gesamtnote vor. Eine neue Punktedarstellung ist daher als transparente, vereinbarungsbezogene Bewertung zu planen, nicht als heimliche Umdeutung aller bisherigen Leistungen.
- Fehlende Meldungen bedeuten „keine Daten“, nicht null Leistung oder Misserfolg.

Betroffen: `cms-add-play-mp-server-stages.cjs`, `cms-server-components.cjs` (`reportProgress`, `progressList`), gegebenenfalls der Leistungsmeldevertrag ausgewählter Spiele.

### 2.4 Benachrichtigungen, Historie und Datenschutz

- `notifications` existiert bereits; Empfängerprüfung in `TServerParty.notifications/markNotification`.
- Momentan überwiegend Multiplayer-bezogen: Antwort-DTO enthält `invitationId`, Typ, Zeitpunkt, Lesestatus. Sponsorreferenzen und eine allgemeine Familien-Inbox fehlen.
- Audit liegt append-only aus Anwendungssicht in `<data>-log.jsonl`.
- Ein Auditeintrag enthält derzeit ID, Zeitpunkt, Akteur, Aktion und Bereich, aber keine vollständigen vorherigen/neuen Fachzustände oder Vereinbarungsversionen.
- Das Audit wird nach der Zustandsdatei geschrieben. Der Code akzeptiert ausdrücklich, dass bei Fehler/Absturz eine Logzeile fehlen kann. Das genügt nicht als alleiniger Nachweis vollständiger Sponsorinteraktionen.
- `cms-trace.cjs` maskiert Zugangsdaten, nicht automatisch Nachrichten und Leistungsinhalte. Diagnose-Traces dürfen nicht zur Hintertür für Sponsor-/Familieninhalte werden.
- `cms-privacy.cjs` und `store.applyDeletions` anonymisieren Personen, entfernen Beziehungen und verhindern Wiedereinführung gelöschter Personen durch Backups. Sponsorobjekte müssen in beide Pfade aufgenommen werden.

### 2.5 Persistenz, Nebenläufigkeit, Wiederherstellung und Bereinigung

`createJsonStore` ist der gemeinsame CMS-Speicheradapter:

- Stammdaten in der Hauptdatei, Betriebsdaten einschließlich `progress/notifications` in `<data>-ops.json`.
- `commit`: Kopie erzeugen → ändern → validieren → Dateien speichern → In-memory-Übernahme → Audit anhängen.
- Schreibpfad synchron innerhalb eines Node-Prozesses; keine Datenbanktransaktion, keine Mehrprozess-Sperre und kein allgemeines Compare-and-swap.
- `save` schreibt Ops- und Stammdatei nacheinander. Ein Absturz dazwischen kann unterschiedliche Generationen hinterlassen.
- `atomicWrite` hat für Windows einen Copy-Fallback. Dieser ist nicht dieselbe atomare/durable Garantie wie erfolgreicher Rename.
- `snapshot` sichert derzeit die Stammdatei, nicht den vollständigen verbundenen Zustand; `restore` übernimmt alte Stammdaten und behält aktuelle Ops-Daten.
- Der Retention-Sweep entfernt Spielsitzungen **und progress** standardmäßig nach 30 Tagen. Dokument E09 nennt für Bewertungen teilweise 90 Tage. Der Plan orientiert sich für den Iststand am Code und kennzeichnet die Fristenfrage.

**Folgerung:** Einfach neue Arrays und einen Punkte-Zähler hinzufügen wäre für einmalige Ansprüche, unverlierbare Zustimmungen und vollständige Historie nicht belastbar. Kapitel 9 behandelt die nötige, ausdrücklich freizugebende Speicherhärtung.

### 2.6 Deklarative Architektur und UI

- Routen sind `TServerEndpoint`-Objekte in `game-server/public/projects/GCS-CMS.json`.
- `cms-runtime.cjs` führt benannte Tasks/Actions aus; nur registrierte Komponentenmethoden werden aufgerufen, kein freies eval.
- Runtime ist synchron: `execAction` wartet nicht auf Promises. Neue asynchrone Methoden wären ein Architekturwechsel.
- Serverkomponenten besitzen TypeScript-Designklassen sowie serverseitige CJS-Implementierungen.
- Elternstages entstehen über `cms-add-parent-stages.cjs`, Serverelternstages über `cms-add-parent-server-stage.cjs`; HouseAdmin-/RaumAdmin-Workspaces über `cms-build-role-workspaces.cjs`.
- Mehrere ältere CMS-Dokumente und Katalogtests beschreiben historische GUIs. Neue Tests werden gegen die aktuellen Tabellen/Stages erstellt, nicht auf Basis alter Kartenobjektnamen.

## 3. Empfohlene Zielarchitektur

```text
Bestehende Anmeldung / Kontositzung
  ├── Elternkontext: bestätigte Guardian-Beziehung
  ├── Kinderkontext: eigenes Profil
  └── Sponsorkontext: aktive Sponsorrolle
          │
Deklarative TServerEndpoint-Tasks in GCS-CMS.json
          │
Registrierte Sponsor-Fachkomponenten
  ├── Beziehung + genehmigte Datensicht
  ├── unveränderliche Vereinbarungsversionen + Zustimmungen
  ├── geprüfte Leistungsquellen + Punktedarstellung
  ├── Anspruchs- und Einlöseautomat
  └── Familienereignisse + Benachrichtigungen
          │
Bestehender CMS-Speicheradapter, transaktional gehärtet
```

### 3.1 Trennung der Verantwortung

- **Identität:** `people`, vorhandene Credentials und Sitzungen.
- **Allgemeiner Kontext:** `roles` mit Rolle `sponsor`.
- **Kindbezogenes Mandat:** `sponsorships` und freigegebene Zugriffsversion.
- **Vertragliche Regeln:** unveränderliche `sponsorAgreementVersions`.
- **Zustimmung:** `sponsorApprovals` mit Zieltyp, Versions-ID und Inhaltshash.
- **Leistung:** bestehende Rohmeldungen bleiben unverändert; neue prüfbare Bewertungs-/Ledger-Einträge daneben.
- **Anspruch:** eigenes dauerhaftes Objekt, das auf die bei Erreichen gültige Vertragsversion zeigt.
- **Transparenz:** ereignisbasierte Familienhistorie als Fachbestand, bestehendes Audit zusätzlich als technischer Nachweis.

### 3.2 Integration ohne heimliche Rechteerweiterung

Sponsor nicht zu `guardians` hinzufügen, nicht als `observer` führen, nicht zu Mitgliedern des Kindesraums machen. `viewChild`, `viewProgress`, `viewCards`, `viewDecks` und Verwaltungsrechte bleiben in ihrer bestehenden Bedeutung erhalten.

Empfehlung: Sponsorrolle als `{personId, areaId:'root', role:'sponsor', active:true}` speichern. `root` bezeichnet hier nur den Kontokontext, **keine globale Leseberechtigung**. Die neue Rolle ist in sämtlichen Verwaltungs-Allowlisten ausgeschlossen. Bereichsaktivität und Personaktivität werden weiterhin geprüft.

Ein Erwachsener kann mehrere Rollen besitzen. Jede neue Sponsoraktion läuft im eindeutig gewählten Sponsorkontext und mit Beziehungskontrolle. Unabhängig vorhandene Elternrechte bleiben vorhanden, sind aber nicht Teil des Sponsor-DTO. Gleiche Person darf nicht als Sponsor und zustimmendes Elternteil dieselbe Zustimmungspflicht umgehen (D3).

### 3.3 Neue Fachkomponenten statt Ausbau fachfremder Multiplayer-Methoden

Vorgeschlagen:

- `TServerSponsorship`: Anfrage, Sichtfreigabe, Pause, Ende, Projektionen.
- `TServerSponsorAgreement`: Vorschlag, Version, Differenz, Zustimmung, Aktivierung.
- `TServerReward`: Anspruch, Anforderung, Freigabe, Erfüllung, Punkte-Reservierung.
- Leistungsbewertung als gekapseltes CJS-Fachmodul, nicht als frei beschreibbarer Browser-Punktezähler.
- Allgemeine Notification-Projektion aus bestehenden `notifications`, kompatibel mit Multiplayer-Routen.

Die Designklassen folgen `TServerDesignComponent`; die ausführbare Logik wird in registrierten Servermethoden bereitgestellt. Keine Ausführung im Browser. `cms-runtime.cjs` soll synchron bleiben. Anpassung nur falls eine später ausdrücklich genehmigte Speicherlösung dies erfordert.

### 3.4 Verbindliches GCS-Prinzip für die gesamte Erweiterung

**Die Sponsor-Erweiterung wird als GCS-Anwendung innerhalb des bestehenden CMS realisiert, nicht als separat programmierte Oberfläche oder paralleles Workflow-System.** Diese Leitlinie gilt für sämtliche nachfolgenden Daten-, API-, Komponenten- und Umsetzungsvorschläge.

| Ebene | Verbindliche Zuordnung |
|---|---|
| Oberfläche | GCS-Stages mit vorhandenen Komponenten; keine separate Sponsor-SPA und keine in HTML/JavaScript versteckte Fachbedienung |
| Bedienablauf | Benannte Events, Tasks, Actions, Bedingungen und Variablen; Navigation und Fehler-/Erfolgsanzeige im GCS-Projekt |
| Serverorchestrierung | `TServerEndpoint` mit `onRequest`-Task; sichtbare Ablaufsteuerung durch die bestehende GCS-Server-Runtime |
| Fachliche Operation | Klar abgegrenzte, registrierte Komponentenmethoden mit dokumentierten Parametern, Ergebnissen und Sicherheitsgarantien |
| Infrastruktur | Authentifizierung, Transport, Transaktionen, Speicherung, Recovery und technische Integritätsprüfungen; kein zweiter fachlicher Ablaufcontroller |
| Generierung | Generatoren erzeugen beziehungsweise ergänzen GCS-Stages/Tasks/Actions; sie sind keine alternative Laufzeit |

Die in Kapitel 13 vorgeschlagenen CJS-Fachmodule implementieren die Methoden der GCS-Komponenten. Sie dürfen Hilfsfunktionen und gemeinsame Berechnungen kapseln, aber keine unabhängige Routing-, UI- oder Workflow-Schicht etablieren. Insbesondere kein generischer `executeWorkflow`-/`dispatchEverything`-Aufruf, hinter dem sämtliche GCS-Abläufe unsichtbar verschwinden.

### 3.5 Grenze zwischen deklarativem Ablauf und atomarer Sicherheit

**Tasks beschreiben den Ablauf; Komponenten stellen sichere Operationen bereit.** Fachlich unterscheidbare Entscheidungen und Ergebnisverzweigungen müssen im GCS-Task nachvollziehbar sein. Sicherheitskritische Invarianten werden zusätzlich innerhalb der jeweiligen Komponentenoperation gegen den aktuellen Zustand geprüft.

Beispiel einer geplanten Zustimmung:

```text
TServerEndpoint.onRequest
  → Task: Sitzung prüfen
  → Action: Beziehung und Zuständigkeit prüfen
  → Action: konkrete Vereinbarungsversion laden
  → Bedingungen: zulässige Version und Eingaben?
  → Action: Zustimmung zur Version atomar speichern
  → Bedingungen: wirksam geworden / weitere Zustimmung fehlt / Konflikt?
  → Action: rollengerechte Antwort senden
```

Der Zustimmungs-Commit prüft Mandat, Revision, Hash und Quorum nochmals. Wenn dadurch die Vereinbarung wirksam wird, speichert dieselbe atomare Operation auch den Versionswechsel, das Familienereignis und die erforderlichen Benachrichtigungen. Das Ergebnis wird anschließend im Task verständlich ausgewertet.

Die Transaktion darf **nicht** aus GCS-Konformitätsgründen in mehrere unabhängig speichernde Actions zerlegt werden. Sonst könnten Zustimmung, Aktivierung und Historie auseinanderfallen. Umgekehrt ist Atomarität kein Grund, die komplette Benutzerführung und alle fachlichen Alternativen in eine monolithische Komponente zu verlagern.

Regeln, die Benutzer konfigurieren dürfen, werden als typisierte, validierte GCS-Daten beziehungsweise Komponentenparameter dargestellt. Berechtigungs- und Integritätsgarantien sind keine frei abschaltbaren Task-/Inspectoroptionen. Keine frei eingebetteten Skripte oder eval-Formeln für Punkteberechnung und Zustimmung.

### 3.6 Editor, Methodenschema und Hintergrundverarbeitung

Für jede neue Komponentenmethodik sind Designklasse, Registrierung, Methodenschema, Parameter-/Ergebnisvertrag und verständliche Inspectorbeschreibung vorzusehen. Jeder Ablauf besitzt benannte Tasks/Actions und, entsprechend den bestehenden Projektkonventionen, Feature-/Blueprint-Zuordnungen. Der gespeicherte Projektstand muss im Editor geladen und über die vorhandene GCS-Darstellung untersucht werden können; keine versteckten separaten Ablaufdefinitionen.

Auch Hintergrundauswertung ist kein fachliches Nebenprogramm: Ein technischer Timer oder ein Leistungseingangsadapter stößt einen benannten GCS-Server-Task an. Dieser ruft die registrierte Bewertungs-/Anspruchsmethode auf. Mathematische Berechnung, Deduplizierung und atomare Anspruchsbuchung bleiben Komponentenoperationen. Recovery des Speichers ist dagegen Infrastruktur und benötigt keinen künstlichen UI-Task.

Die aktuelle Runtime führt HTTP-Tasks synchron aus. Für einen Hintergrundaufruf ist bei Umsetzung zuerst zu prüfen, ob ein bestehender Einstieg wiederverwendet werden kann. Falls dafür eine neue Runtime-Einstiegsmethode nötig ist, wird diese Änderung vorab ausdrücklich vorgelegt; kein künstlicher öffentlich erreichbarer Evaluationsendpunkt und kein ungefragter Runtime-Umbau.

## 4. Datenmodell

Alle IDs serverseitig erzeugen. Fachzeitpunkte aus Serverzeit, UTC speichern; fachliche Zeitfenster erhalten eine vereinbarte Zeitzone. Veränderliche Aggregate besitzen `revision`. Vertrags-/Zugriffsversionen sind nach Veröffentlichung des Vorschlags unveränderlich; Änderungen erzeugen neue Versionen.

### 4.1 Neue Collections

| Collection | Wichtige Felder | Invarianten/Zweck |
|---|---|---|
| `sponsorshipRequestCapabilities` | `id`, `tokenHash`, interne `childId`, `issuedByGuardianId`, `expiresAt`, `usedAt`, ggf. festgelegte `sponsorId` | Elternseitiger Kontakt-/Anfragecode, kein Leistungszugriff; verhindert Suche durch erratene Kinder-IDs |
| `sponsorships` | `id`, `sponsorId`, `childId`, interner `houseId`, `status`, `revision`, `purpose`, `requestedFrom/Until`, `activeFrom/Until`, `activeAccessVersionId`, `approvalPolicy`, `pauseReasons`, `endedAt/By`, `endReason` | Höchstens eine offene Beziehung pro Sponsor/Kind; Historie geschlossener Beziehungen erhalten |
| `sponsorAccessVersions` | `id`, `sponsorshipId`, `version`, `baseVersionId`, `scope`, `contentHash`, `createdBy/At`, `status`, `effectiveAt` | Explizit genehmigte Sicht; Erweiterung niemals automatisch |
| `sponsorAgreements` | `id`, `sponsorshipId`, `activeVersionId`, `pendingVersionId`, `revision`, `status` | Stabiler Vertrag über Versionswechsel hinweg |
| `sponsorAgreementVersions` | `id`, `agreementId`, `version`, `baseVersionId`, `contentHash`, vollständige `terms`, `proposedBy/At`, `effectiveAt`, `status` | Unveränderlicher vollständiger Vertragssnapshot |
| `sponsorApprovals` | `id`, `targetType`, `targetId`, `contentHash`, `actorId`, `actorKind`, `decision`, `decidedAt`, `guardianPolicyVersion` | Eindeutig je Ziel/Person/Entscheidungsfolge; Zustimmung anderer Versionen zählt nicht |
| `performanceRuleVersions` | `id`, `version`, erlaubte Quellen/Metriken/Einheiten, Fach-/Aktivitätsschlüssel, Wertgrenzen, Gewichtung, Ereignissemantik, Vertrauensklasse | Serverseitig gepflegte Regelversion, keine Sponsor-Punkteschreibrechte |
| `performanceLedger` | `id`, `childId`, `sourceEventKey`, `sourceVersion`, `ruleVersionId`, `activityKey`, `subjectKey`, `occurredAt/recordedAt`, `points`, `verification`, `reversalOf` | Append-only; Punkteursprung nachprüfbar; keine Karten-/Antworttexte |
| `rewardClaims` | `id`, `sponsorshipId`, `agreementId`, `agreementVersionId`, `entitlementKey`, `status`, `revision`, `earnedAt`, eingefrorene `termsSnapshot`, `evidenceSummary`, `reservedPoints`, `fulfilledAt/By` | Unverlierbarer Anspruch; eindeutiger fachlicher Schlüssel |
| `rewardPointEntries` | `id`, `accountKey`, `kind`, `amount`, `sourceKey`, `claimId`, `reversalOf`, `createdAt` | Optionales einlösbares Konto: Gutschrift/Reservierung/Freigabe/Verbrauch; einmal je fachlichem Vorgang |
| `sponsorEvents` | `id`, `sequence`, `transactionId`, `sponsorshipId`, `childId`, `actorId/type`, `eventType`, `at`, `entityType/Id`, `before`, `after`, `versionId`, `reason` | Vollständige Familienhistorie, nur neue Ereignisse; getrennt vom technischen Audit |
| `sponsorCommandReceipts` | `actorId`, `operation`, `idempotencyKey`, `requestHash`, `resultRefs`, `createdAt` | Persistente Wiederholsicherheit über Neustarts; keine Cache-Wiedergabe ohne aktuelle Rechteprüfung |

Nicht jede Collection muss eine eigene Datei werden. Empfohlen ist die Integration in das gemeinsame validierte CMS-Objekt; physische Aufteilung erst nach Speicherentscheidung. Sponsor-Fachbestände sind dauerhafte Vertragsdaten, **keine nach 30 Tagen löschbaren Ops-Daten**.

### 4.2 Genehmigter Sichtumfang (`scope`)

```json
{
  "subjectKeys": ["math"],
  "activityKeys": ["arithmetic-round"],
  "allowedMetricKeys": ["round_complete"],
  "period": {"from": "<UTC>", "until": "<UTC>", "timezone": "Europe/Berlin"},
  "aggregation": "weekly",
  "detailLevel": "points-only",
  "showActivityLabels": false,
  "includeHistoricData": false,
  "allowMessages": false,
  "showIndividualAnswers": false,
  "showErrors": false,
  "showPersonalContent": false
}
```

Das Beispiel ist ein Schemaentwurf, keine Implementierung. Fach-/Aktivitätsschlüssel kommen aus einem kontrollierten Katalog, nicht aus beliebigen persönlichen Kartenthemen. Detailstufen beispielsweise `points-only`, `subject-totals`, `activity-totals`, `approved-metric-aggregates`. Genaue Namen und zulässige Metriken sind abzustimmen.

Der tatsächliche Sponsorzugriff ist die Schnittmenge aus gültiger Beziehung, genehmigtem Zeitraum, gültiger Zugriffsversion und angefragtem Filter. Nicht genehmigte Filter ablehnen, nicht auf einen weiteren Standardumfang zurückfallen. „Alle zukünftigen Spiele/Fächer“ nicht implizit freigeben.

Erste Stufe: keine APIs für Einzelantworten, Fehlerdetails, Fragen, Kartentexte oder persönliche Lerninhalte. Auch eine großzügige Aggregatfreigabe öffnet keine Karten-/Stapelendpunkte. Eine spätere Inhaltsfreigabe wäre ein zusätzlicher Plan und eine neue Elternzustimmung.

### 4.3 Vertragsinhalt (`terms`)

Eine Version enthält mindestens:

- berücksichtigte Fächer/Aktivitäten/Metriken und feste `ruleVersionIds`,
- erforderliche Leistungspunkte und verständliche Berechnungsbeschreibung,
- Belohnungstext, Umfang/Menge, erfüllender Sponsor,
- Leistungszeitraum, Vertragsgültigkeit und gesonderte Einlöse-/Erfüllungsfrist,
- einmalig oder wiederholbar; Empfehlung erster Schritt: ein einmaliger Anspruch je stabiler Vereinbarung,
- keine Anrechnung alter Punkte oder ausdrückliches begrenztes Historienfenster mit eingefrorenem Ausgangswert,
- Punkteverbrauch ja/nein, ggf. Einlösekosten und eindeutig abgegrenzter Kontotopf,
- Umgang mit Pause, Ende, Übertrag alter Fortschritte und bereits erreichten Ansprüchen,
- erforderliche Elternfreigabe der Einlösung und Erfüllungsbestätigung,
- erforderlicher Sichtumfang; kein stillschweigender Vorrang des Vertrags über die Sichtfreigabe.

Eine serverseitige Normalisierung erstellt kanonischen Inhalt und SHA-256-Hash. Hash dient Bindung an den Inhalt, ist allein kein Manipulationsschutz gegenüber einem Betreiber mit Dateizugriff.

### 4.4 Validierung

`validate` erweitern um Referenzen, Erwachsenen-/Kinderart, eindeutige IDs, Zustände, positive sichere Ganzzahlen, gültige ISO-Zeitpunkte, Reihenfolge von Zeitfenstern, Versionseinzigartigkeit und Zustimmungshashes. Keine aktive Vereinbarung ohne gültige erforderliche Zustimmungen. Kein erreichter Anspruch ohne konkrete Version und Beleg. Kein negatives verfügbares Einlöseguthaben. Geschlossene Beziehung kann Ansprüche haben, aber keinen aktiven Leistungszugriff.

Bei anonymisierten Personen erlauben definierte Tombstone-Referenzen weiterhin Nachweis bestehender Ansprüche, ohne Namen/Inhalte aufzubewahren. Keine neuen Freigaben für Tombstones.

## 5. Rollen- und Berechtigungsmatrix

Die Tabelle beschreibt neue Sponsorobjekte. Sie entzieht keine bisherigen Rechte außerhalb dieses Features.

| Aktion | Sponsor | Zuständige bestätigte, aktive Eltern | Betroffenes Kind | House-/RaumAdmin nur als Verwaltung | Anderer Sponsor/Familie |
|---|---|---|---|---|---|
| Anfrage stellen | Eigene Identität + gültiger Anfragecode | Kontaktcode ermöglichen | Nein | Keine Genehmigung im Elternersatz | Nein |
| Offene Anfrage lesen | Eigene Anfragedaten und neutraler Status; keine Leistungsdaten | Vollständig | Kindgerechte eigene Anfrage | Nein | Nein |
| Begleitung genehmigen | Keine Elternzustimmung ersetzen | Gemäß Quorum | Widerspruch/Veto | Nein | Nein |
| Genehmigten Fortschritt lesen | Nur aktive eigene Beziehung + Scope | Bestehende Elternrechte | Eigene Daten | Keine neue Leistungsberechtigung | Nein |
| Persönliche Karten/Inhalte lesen | Nein in erster Stufe | Bisherige Rechte bleiben | Bisherige Rechte bleiben | Bisherige Rechte bleiben, keine Sponsor-Erweiterung | Nein |
| Punkte/Leistungen direkt ändern | Nein | Kein neuer freier Punktezähler; Korrektur nur geregelter Nachweisprozess | Nein | Keine neue Befugnis | Nein |
| Vereinbarung/Änderung vorschlagen | Eigene Beziehung | Eigenes Kind | Eigene Beziehung | Nein | Nein |
| Vertrag wirksam bestätigen | Eigene Verpflichtung, konkrete Version | Erforderliche Elternzustimmung, konkrete Version | Keine Eltern-/Sponsor-Zustimmung ersetzen | Nein | Nein |
| Zugriff erweitern | Antrag, nicht selbst aktivieren | Neue ausdrückliche Freigabe | Information/Veto | Nein | Nein |
| Zugriff einschränken | Freiwilliger Verzicht | Sofort, Quorum für Erweiterung nicht abwarten | Pause/Veto | Nein | Nein |
| Begleitung pausieren | Verfügbarkeit melden, Empfehlung eigener Pausenwunsch | Sofort | Sofort | Nein | Nein |
| Begleitung beenden | Eigene Teilnahme beenden, Ansprüche bleiben | Sofort | Widerspruch/Beendigungswunsch nach festgelegter Kindregel | Nein | Nein |
| Gemeinsame Nachrichten | Nur aktive Beziehung, wenn freigegeben | Vollständig, inkl. Historie | Eigene Beziehung | Nein | Nein |
| Belohnung anfordern | Für eigene Verpflichtung vorschlagen, nicht elterlich freigeben | Für Kind | Eigener erreichter Anspruch | Nein | Nein |
| Einlösung freigeben | Nein | Gemäß vereinbartem Elternquorum | Nein | Nein | Nein |
| Erfüllung melden | Eigene freigegebene Verpflichtung | Eigene bestätigen/ablehnen | Empfang melden, keine endgültige Freigabe ersetzen | Nein | Nein |
| Historie nach Ende | Kein Kind-/Leistungszugriff; ggf. minimierte eigene Abwicklung | Vollständige relevante Familienhistorie | Eigene verständliche Historie | Nein | Nein |

Neue Berechtigungsaktionen vorschlagen: `requestSponsorship`, `viewSponsorship`, `viewSponsoredProgress`, `manageChildSponsorship`, `proposeSponsorAgreement`, `approveSponsorAgreement`, `manageRewardClaim`, `viewSponsorHistory`. Kind-/Sponsor-/Elternobjektchecks in den Fachmethoden nochmals prüfen, nicht nur in Task-Branches.

Kein allgemeiner SuperAdmin-Bypass für private Sponsorleistungen/Nachrichten. Eventueller Supportzugriff braucht einen getrennten, befristeten, protokollierten Prozess; dieser ist nicht Bestandteil der ersten Stufe. Bereits vorhandene Verwaltungsrechte bleiben unverändert.

## 6. Zustandsautomaten

### 6.1 Begleitung

Technische Werte: `requested`, `active`, `rejected`, `paused`, `ended`. Anzeige: angefragt, aktiv, abgelehnt, pausiert, beendet.

| Ausgang | Ereignis/Voraussetzungen | Ziel | Wirkung |
|---|---|---|---|
| Nicht vorhanden | Sponsor sendet gültige Anfrage | `requested` | Eltern benachrichtigen; keinerlei Kind-/Leistungszugriff |
| `requested` | Erforderliche Elternzustimmungen zur Anfrage und Zugriffsversion, keine Kindablehnung, Personen aktiv, Zeitraum gültig | `active` | Scope wirksam; Vertragsvorschlag ist noch kein aktiver Vertrag |
| `requested` | Eltern oder Kind lehnen ab | `rejected` | Kein Zugriff; Antrag/Historie bleiben |
| `requested` | Sponsor zieht zurück / Anfragefrist endet | `ended` | Grund `withdrawn/expired`, kein Zugriff |
| `active` | Kind oder Eltern pausieren | `paused` | Sofort keine neuen Sponsor-Leistungsdaten und keine neue Nachrichtenkommunikation |
| `paused` | Alle Pausengründe aufgehoben, nötige Freigaben gültig | `active` | Kein automatisches Reaktivieren nach Kindwiderspruch |
| `active/paused` | Eltern beenden / Sponsor beendet / Dauer endet | `ended` | Sofortiger Zugriffsentzug, Ansprüche erhalten |
| `ended/rejected` | Neuer Begleitungswunsch | Neue `requested`-Beziehung | Keine Wiederbelebung alter Zustimmung |

Pause als Menge begründeter Blocker modellieren, etwa `child`, `guardian`, `sponsor`, `consent-invalid`. Niemand darf einen fremden Blocker entfernen. Kind hebt eigene Pause ausdrücklich auf; Elternfreigabe für Wiederaufnahme gemäß D2. Sponsor darf Kind-/Elternpause nicht überschreiben. Ablaufdatum wirkt im Rechtecheck auch ohne erfolgreichen Sweep.

Bei Entzug eines zuständigen Elternkontos oder Änderung der Elternmenge erforderliche Zustimmungen neu bewerten. Empfehlung: bei unklarer Genehmigungsgrundlage fail-closed pausieren; keine neue Einsicht, bis erforderliche aktuelle Freigabe vorliegt. Die Familienhistorie bleibt für aktuell zuständige Eltern erreichbar.

### 6.2 Zugriffsversion

`proposed → awaiting-approval → active → superseded`, alternativ `rejected/withdrawn`.

- Elternbeschränkung sofort wirksam, auch wenn Sponsor nicht zustimmt.
- Erweiterung oder längerer Zeitraum nur über neue genehmigte Version.
- Vertrag, der mehr Daten benötigt, darf diese Freigabe nicht selbst schaffen.
- Bei Restriktion bestehende Ansprüche schützen; für nicht mehr belegbar fortführbare Regeln Elternentscheidung anzeigen statt mehr Daten herauszugeben.

### 6.3 Vereinbarungsversion

`draft → proposed → awaiting-approval → active → superseded`, alternativ `rejected/withdrawn/expired`.

- Entwurf darf sein Ersteller ändern; veröffentlichter Vorschlag bleibt unveränderlich.
- Jede inhaltliche Änderung erzeugt neue Versions-ID und neuen Hash; alte Zustimmungen werden nicht übertragen.
- Erforderliche Eltern + Sponsor stimmen derselben Version zu. Empfehlung: bei jeder Vertragsversion Sponsorzustimmung, nicht nur bei geänderten Verpflichtungen; einfacher, eindeutiger Nachweis.
- Wenn Kind einen Vorschlag erzeugt, zählt das nicht als Zustimmung des Sponsors oder eines Elternteils.
- Aktivierung atomar: aktuellen `baseVersionId` und Quorum prüfen, alte Version ablösen, neue Version aktivieren, Historie und Notifications speichern.
- Parallel eingereichte Nachfolgeversion auf veralteter Basis erhält `409`; Nutzer muss gegen den aktuellen Stand neu vergleichen.
- Keine rückwirkende Neubewertung ohne ausdrücklich freigegebenen Anrechnungsplan. Alte Leistungseinträge werden nicht umgeschrieben.

### 6.4 Belohnung und Anspruch

Die sieben gewünschten Anzeigezustände werden fachlich getrennt:

- **angeboten:** Belohnungsvorschlag, noch keine wirksame Verpflichtung.
- **vereinbart:** aktive Vertragsversion; Schwelle noch nicht erreicht.
- **erreicht:** dauerhaft angelegter Anspruch mit eingefrorenem Vertragssnapshot.
- **angefordert:** Kind/Eltern wünschen Einlösung; ggf. Punkte reserviert.
- **freigegeben:** erforderliche Eltern haben diese Einlösung bestätigt.
- **erfüllt:** Erfüllung nach vereinbartem Nachweis bestätigt; ggf. Reservierung endgültig verbraucht.
- **storniert:** klar begründeter Vorgang; keine heimliche Löschung erworbener Ansprüche.

Technisch sind `offered/agreed` Zustände des Angebots/Vertrags, ab `earned` existiert ein `rewardClaim`. Nicht nur ein einziges Statusfeld am Vertragsobjekt verwenden: Vertrag kann Nachfolger haben, während alter Anspruch noch offen ist.

| Übergang | Voraussetzungen und Folgen |
|---|---|
| angeboten → vereinbart | Vertrag mit erforderlichen Zustimmungen aktiv |
| vereinbart → erreicht | Serverseitiger Evaluator erkennt Schwelle; eindeutigen Anspruch anlegen |
| erreicht → angefordert | Autorisierter Antrag, gültige Einlöseregel; ggf. Reservierung atomar |
| angefordert → freigegeben | Elternquorum zur konkreten Claim-Revision erfüllt |
| freigegeben → erfüllt | Sponsor meldet Erfüllung; Empfehlung endgültige Elternbestätigung, Kind kann Empfang melden |
| angefordert → erreicht | Antrag zurückgezogen/abgelehnt; Reservierung freigeben, Anspruch bleibt |
| angeboten/vereinbart → storniert | Nicht erworbener Vorschlag/Vertrag beendet, Historiensatz |
| erreicht/angefordert/freigegeben → storniert | Nur ausdrücklich vereinbarter, berechtigter Klärungsprozess mit Grund; keine Standardwirkung von Vertrags-/Beziehungsende |

Ein Erfüllungsbericht des Sponsors ist zunächst ein Ereignis am Claim, noch kein endgültiger Status `fulfilled`. So wird kein privater Empfangsnachweis erfunden. Standardmäßig laufen erworbene Ansprüche nicht automatisch ab; Frist und Folgen sind D7.

## 7. Punkte, Bewertungsregeln und Schutz erworbener Ansprüche

### 7.1 Drei getrennte Begriffe

1. **Erschlossene Leistungspunkte:** aus belegten, zugelassenen Leistungsereignissen berechnet; niemals beim Einlösen löschen.
2. **Punkteschwelle:** Ziel einer konkreten Vereinbarung, beispielsweise 100 nach Regelversion R3. Kein Kontostand und keine Abbuchung.
3. **Einlösbare Belohnungspunkte:** optionales Guthaben mit separatem Ledger, Reservierung und Verbrauch. Nur erforderlich, wenn ausdrücklich „Punkteverbrauch“ vereinbart wird.

Ein Kunde darf `value`, `points`, `balance`, `earned`, `approvedBy`, `fulfilledAt` nicht frei in einen Sponsor-Schreibendpunkt übergeben. Server leitet alles aus Ereignissen und freigegebenen Regeln ab.

### 7.2 Bewertungsregeln statt pauschaler Spielscore

Empfehlung erster Schritt: ein freigegebener Referenzaktivitätstyp, feste kleine Ganzzahlpunkte, einmaliger Anspruch je Vereinbarung. Keine freie Formel/eval, keine automatische Gesamtwertung aller Spiele.

Regelversion beschreibt:

- Quelle/Spiel und relevante Spiel-/Metrikversion,
- Deltaereignis oder kumulativer Stand (bei kumulativen Meldungen nicht alle Summen addieren),
- Ganzzahlbereich, erlaubte Einheit, Maximalwert pro Runde/Zeitabschnitt,
- eindeutiger fachlicher Ergebnis-/Rundenschlüssel,
- notwendige Vertrauens-/Prüfstufe,
- Fach- und Aktivitätsschlüssel sowie Punktgewichtung,
- Umgang mit Wiederholung, Hilfen, Teamleistung und Korrekturen.

Beispiel nur zur Erklärung: zehn serverseitig bestätigte abgeschlossene Rechenrunden, je zehn Punkte, ergeben 100 Leistungspunkte. Das ist keine Schulnote. Ein Sponsor sieht nur genehmigte Aggregationen dieser Ereignisse, nicht die zugehörigen Aufgaben.

### 7.3 Vertrauensgrenze und Leistungseingang

Der vorhandene `progress`-Pfad bleibt zunächst für seine bisherige Berichtsaufgabe erhalten. Seine Rohdaten dürfen nicht ungeprüft Ansprüche auslösen.

Für belohnungsfähige Quellen ist zusätzlich erforderlich:

1. Stabile serverseitige Aktivitäts-/Regelversion und fachlicher Ergebnisbezeichner.
2. Identität, Spielversion, Sitzung und Zeit aus autorisiertem Serverkontext.
3. Prüfung endlicher Werte, sicherer Ganzzahlen, Einheiten, Werteobergrenzen und erlaubter Häufigkeit.
4. Duplikatschutz über fachlichen Rundenschlüssel, nicht nur vom Client neu generierbare UUID.
5. Serverseitige Ergebnisprüfung, soweit die Quelle dafür geeignet ist. Clientseitiger Code oder ein eingebettetes Geheimnis ist keine vertrauenswürdige Signaturquelle.
6. Klar sichtbare Provenienz `reported/verified` beziehungsweise explizit elterlich bestätigter Nachweis, falls als Produktalternative genehmigt.
7. Keine Sponsor-APIs für Meldung/Korrektur von Leistungen. Keine fremde `childId` aus Clientbody übernehmen.

**Freigabegate D5:** Entweder eine konkret ausgewählte Aktivität serverseitig prüfen und nur diese automatisiert bewerten, oder eine gesonderte elterliche Anerkennung gemeldeter Leistungen vorsehen. Ohne Entscheidung/Quellenprüfung keine produktive automatische Anspruchserzeugung aus heutigen Rohmeldungen. Die Wahl eines Referenzspiels wird vor Änderung seiner Funktionen vorgelegt; nicht sämtliche Spiele umbauen.

Korrekturen nur append-only als Gegenbuchung mit Begründung und berechtigtem Prüfprozess, nicht durch Sponsor oder durch Überschreiben alter Rohdaten. Eine nachträgliche Korrektur darf erfüllte/erworbene Ansprüche nicht stillschweigend löschen; möglicher Konflikt wird sichtbar geklärt.

### 7.4 Berechnung und Zeitbezug

Für jede Vertragsversion gilt ein festes Leistungsfenster `[from, until)` und eine festgelegte Regelmenge. Eltern müssen den vereinbarten Bewertungsumfang vollständig prüfen können, unabhängig davon, ob der Sponsor nur einen gröberen Stand sehen darf.

```text
berücksichtigte Leistung = zulässige geprüfte Ledger-Ereignisse im vereinbarten Fenster
                          + ausdrücklich freigegebener historischer Ausgangswert
Vertragsfortschritt     = transparente Summe nach fixierter Regelversion
Anspruch erreicht       = Vertragsfortschritt >= vereinbarte Schwelle
verfügbares Einlösekonto = Gutschriften - endgültiger Verbrauch - offene Reservierungen
```

Doppelte Anrechnung eines historischen Ausgangswerts und derselben später eingelesenen Ereignisse ausschließen. Historienfenster beim Vorschlag offen anzeigen; endgültigen Ausgangswert und Belegreferenzen bei Aktivierung fixieren. Sind historische Rohdaten wegen Retention nicht mehr verfügbar, „nicht rekonstruierbar“ anzeigen, nicht null annehmen oder rückwirkend schätzen.

Während Pause Empfehlung: keine neue vertragliche Anrechnung; bestehende Leistungspunkte außerhalb dieses Vertrags bleiben erhalten. Nachträgliche Anrechnung der Pause nur als bewusste neue Version (D2). Dauer-/Endrechte in jedem Zugriff prüfen.

### 7.5 Einmaligkeit und Versionen

Empfehlung v1: ein einmaliger Anspruch je `agreementId`, nicht je neue Versions-ID. Schlüssel beispielsweise `agreementId + ':one-time'`. Ein bloßer Versionswechsel darf keine zweite Belohnung erzeugen. Der Claim speichert die beim ersten Erreichen aktive Version.

Falls wiederkehrende Belohnungen später erlaubt werden: vorab deterministische Perioden-/Zykluskennungen, Obergrenzen und mehrere Schwellen definieren. Kein Schlüssel nur aus Request-ID oder aktueller Uhrzeit.

Punkte-Ledger dedupliziert pro `childId + sourceEventKey + ruleVersionId`; erneute Auswertung erzeugt keine zweite Gutschrift. Verschiedene Vereinbarungen dürfen denselben belegten Lernfortschritt nur gemäß ausdrücklich festgelegter Mehrfachanrechnungsregel nutzen (D6). Das optional verbrauchbare Konto ist kein globaler, beliebig zwischen Sponsoren übertragbarer Topf.

### 7.6 Einlösen mit Punkteverbrauch

Wenn Verbrauch aktiviert wird:

- Kontotopf eindeutig an Kind, Beziehung und genehmigtes Punkteprogramm binden.
- Request prüft verfügbare Punkte und reserviert einmalig; zwei parallele Einlösungen können nicht dasselbe Guthaben reservieren.
- Elternfreigabe belässt Reservierung, Erfüllungsbestätigung wandelt sie einmalig in Verbrauch um.
- Rückzug/Abweisung gibt Reservierung genau einmal frei.
- Reversals verweisen auf ursprüngliche Buchung, keine mutable Saldo-Manipulation.
- Nichtverbrauchsmodus benötigt keine Abbuchung, hat aber denselben Anspruchs-Duplikatschutz.
- Ein erworbener Claim und ein aktuell verfügbares Einlöseguthaben sind getrennte Informationen; konkurrierende Angebote müssen die vereinbarte Budgetregel anzeigen.

### 7.7 Änderung ohne Anspruchsverlust

Beispiel: Kind erreicht 100 Punkte für einen Ausflug. Ein vorgeschlagener Nachfolger verlangt 150 Punkte. Der vorhandene 100-Punkte-Anspruch bleibt als Claim mit alter Version erhalten. Ein noch nicht aktivierter Vorschlag ändert weder Schwelle noch Belohnung.

Auch nicht eingelöste Belohnungspunkte dürfen nicht durch Änderung der Bewertung oder des Zeitfensters verschwinden. Bereits gebuchte Punkte bleiben; neue Regeln gelten nur ab explizitem Wirksamkeitszeitpunkt. Übernahme des bisherigen Fortschritts in einen Nachfolger muss als eigene Anrechnungsregel sichtbar vereinbart werden.

Beim Übergang zu neuer Version oder beim Beenden Beziehung vorherige wirksame Version bis zum Übergangszeitpunkt evaluieren und erreichte Ansprüche materialisieren. Das muss mit Wechsel/Ende in einer fachlichen Transaktion geschehen; ein verzögerter Evaluator darf keinen gerade erworbenen Anspruch verlieren.

## 8. Anfrage, Zustimmung, Kommunikation und sofortiger Widerruf

### 8.1 Kontaktweg ohne Kinderverzeichnis

Empfehlung: Zuständige Eltern erzeugen einen zufälligen, befristeten Anfragecode. Der Sponsor benutzt ihn, um die Begleitungsanfrage mit Identität, Zweck, Dauer und erstem Belohnungsvorschlag zu stellen. Der Code erlaubt nur Antragserstellung, keine Datenabfrage. Hash statt Klartext persistieren; nicht in Logs schreiben.

Keine Suche nach allen Kindern, Familiennamen oder Hausbewohnern für Sponsoren. Raw `childId` als alleiniger Antragsnachweis reicht nicht. Antwort vor Genehmigung enthält nur eigene Antragsdaten, bekannte vom Sponsor selbst eingegebene Angaben und neutralen Status.

Sponsor muss bereits verifiziert angemeldet sein oder über kontrollierten Einrichtungsflow ein Konto erhalten. Registrierung neuer erwachsener Sponsoren, wer Konten einrichten darf und ob Einladung an konkrete Sponsorperson gebunden ist, sind D3. Vor Genehmigung keinen Kindnamen automatisch offenlegen.

Doppelte aktive/offene Anfrage desselben Sponsors für dasselbe Kind: Idempotenzschlüssel wiederholen oder bestehenden eigenen Antragsstatus zurückgeben; neue parallele Beziehung verhindern. Anfragecode atomar verbrauchen. Abgelaufene/revokierte Codes generisch ablehnen.

### 8.2 Zustimmungsverfahren

Eine Zustimmung bindet an:

- Objekt und konkrete Versions-ID,
- normalisierten Inhaltshash,
- tatsächliche handelnde Person aus Sitzung,
- Art der Zustimmung (Eltern / Sponsor),
- Zeitpunkt und zugrundeliegende Eltern-/Quorumsregel.

Keine Zustimmung nur zu `agreementId` oder zu „der jeweils aktuellen Vereinbarung“. Antrag und Sichtfreigabe getrennt vom ersten Vertrag, in der Oberfläche aber verständlich gemeinsam prüfbar.

Bei jeder Aktivierung erforderliche aktuelle Elternmenge neu ermitteln. Änderung der Elternzuständigkeit darf eine alte Kandidatenliste nicht zur Berechtigung machen. Kein Zählen doppelt gespeicherter Guardian-Zeilen als mehrere Personen. Ausstehende Zuordnungen zählen nicht. Fehlende aktive Eltern → keine neue Aktivierung.

Empfehlung D1: alle aktuell bestätigten, aktiven Eltern stimmen neuen Begleitungen, erweitertem Scope und Vertragsänderungen zu; jeder einzelne zuständige Elternteil darf sofort einschränken/pausieren/beenden. Bei uneinheitlichen Entscheidungen keine Aktivierung; bisherige gültige Version bleibt, soweit nicht ein Sicherheitswiderruf sie sperrt.

### 8.3 Nachrichten

Empfehlung erster Schritt: strukturierte Kommentare an Anfrage, Vertragsvorschlag oder Belohnungsclaim statt eines allgemeinen Live-Chats. Freitext nur, wenn D8 ausdrücklich genehmigt wird.

Falls Kommunikation:

- genau eine Familienkonversation pro Beziehung; keine frei wählbaren privaten Empfänger,
- alle zuständigen Eltern können sämtliche Nachrichten und Versionen sehen, auch ohne individuellen Benachrichtigungs-Lesestatus,
- Sender und Zeit serverseitig, sichere Textdarstellung ohne ausführbares HTML,
- begrenzte Textlänge, Requestgröße, Frequenz; keine Anhänge, Bilder oder versteckten Nebenkanäle in v1,
- Bearbeitung nur als neue korrigierende Nachricht mit Bezug; keine spurenlose Änderung/Löschung,
- Pause/Ende blockiert neue Sponsor-Kind-Nachrichten sofort,
- nach Ende gegebenenfalls ausschließlich Eltern-Sponsor-Abwicklungsereignisse ohne neue Kind-Leistungsdaten.

Einzelnachrichten/-antworten können sprachlich Lerninhalte enthalten. Deshalb Freitext bewusst minimieren, Elternansicht vollständig, Sponsor-Leserechte begrenzt. Keine ungefragte Aufnahme von Kartentexten in Nachrichten oder Notifications.

### 8.4 Zugriffsentzug

Nach erfolgreichem Beenden/Pausieren verweigern alle folgenden Daten-/Export-/Nachrichten-/Bewertungsabfragen dieselbe Beziehung, auch mit altem gültigen Accountcookie, alter ID, altem Idempotenzschlüssel oder direktem API-Aufruf.

- Rechte an aktueller DB-Beziehung, Elternbasis, Gültigkeit und Scope prüfen, nicht im Login dauerhaft cachen.
- `Cache-Control: no-store`, keine Leistungsdaten in URL/LocalStorage, keine dauerhaften Sponsor-Downloadlinks.
- Frontend leert Tabellen/Detaildaten beim erkannten Widerruf und zeigt einen neutralen Sperrstatus.
- Erste Stufe HTTP/Polling, keine neue Sponsor-WebSocket-Schnittstelle. Ein späterer Pushkanal muss jede Zustandsänderung/Übertragung erneut prüfen und bei Widerruf geschlossen werden; Multiplayer-Livesync nicht als Sponsor-Datenkanal verwenden.
- Bereits vor Widerruf rechtmäßig ausgelieferte Daten können technisch nicht aus dem Gedächtnis oder einer Kopie des Sponsors zurückgeholt werden. Die Garantie betrifft alle weiteren Serverausgaben, nicht rückwirkliches Löschen fremder Kopien.
- Im synchronen Server ist Beendigung eine klare lineare Grenze; bei späteren asynchronen Lesepfaden vor Auslieferung nochmals prüfen.

### 8.5 Anspruchsabwicklung nach Ende

Eltern und Kind sehen ihre alten Ansprüche weiterhin. Sponsor hat keinen allgemeinen Zugriff auf Beziehung, Kinddaten oder Fortschritt mehr. Empfehlung: separater minimaler Endpunkt für eigene bereits bestehende Verpflichtungen mit Claim-ID, Belohnungsbeschreibung und Erfüllungsstatus, ohne neue Leistung/Kindprofil. Erfüllungsmeldung nur an Eltern; keine neue Sponsor-Kind-Kommunikation.

Ob diese minimierte Verpflichtungsansicht zulässig sein soll oder Eltern die Abwicklung vollständig übernehmen, ist D7. Sie darf nicht als Ausnahme für erneute `viewSponsoredProgress`-Rechte implementiert werden.

## 9. Speicherung, Transaktionssicherheit und gleichzeitige Änderungen

### 9.1 Minimale Garantie

Ein Sponsorfachbefehl muss gemeinsam und dauerhaft speichern:

1. Fachzustand/Version/Claim,
2. dazugehörige Zustimmungen oder Buchungen,
3. vollständiges Familienereignis,
4. Benachrichtigungen an berechtigte Empfänger,
5. Wiederholungsbeleg mit Ergebnisreferenzen.

Kein „erst Anspruch, danach optional Historie“. Die Familienhistorie liegt im transaktionalen Fachbestand; das bisherige technische JSONL-Audit bleibt zusätzlich erhalten. Ausfall der Diagnose/Benachrichtigungsanzeige darf weder doppelte Belohnung noch unsichtbare Zustandsänderung erzeugen.

### 9.2 Empfohlene Speicherhärtung bei Erhalt des JSON-Adapters

**Technisch notwendige Erweiterung, ausdrücklich freizugeben (D9):** `createJsonStore` um ein wiederherstellbares Transaktionsjournal bzw. generationenbasierte Speicherung erweitern, statt alle Sponsorbestände unkoordiniert auf bisherige Dateien zu verteilen.

Vorgeschlagener Ablauf:

1. Ein einziger schreibender CMS-Prozess für einen Datenpfad; zweite Instanz über exklusive Sperre erkennen und verweigern. Sperrenentfernung nach Absturz nur mit geprüftem Wiederherstellungsablauf, nicht pauschal löschen.
2. Im gesperrten/synchronen Befehlsabschnitt aktuelle Objektberechtigung, `revision`, Status, fachliche Unique-Keys und Guthaben prüfen.
3. Auf einem geklonten gemeinsamen Zustand sämtliche Änderungen einschließlich Historie/Notifications/Commandreceipt anwenden und validieren.
4. Transaktions-ID und eine vollständige konsistente neue Generation in temporäre Dateien schreiben; Dateien synchronisieren, anschließend vorbereiteten Journal-/Manifestnachweis dauerhaft publizieren.
5. Generation durch atomaren Commitmarker aktiv setzen; erst nach dauerhaftem Commitmarker Erfolg antworten und In-memory-Stand übernehmen.
6. Projektionen in bisherige Dateien/Audit bei Bedarf nachziehen; sie dürfen nicht die einzige Wahrheitsquelle eines Fachkommandos sein.
7. Beim Laden unvollständige Vorbereitung verwerfen oder vollständig committed Generation wiederherstellen. Niemals Stamm-/Ops-Zustände unterschiedlicher Transaktionen mischen.
8. Commit nach Crash erneut ausführen: vorhandener Commandreceipt/Unique-Key liefert denselben Claim, kein zweiter Verbrauch.

Die konkrete Manifest-/Journalform erst in einem isolierten Speichertest festlegen. Die Garantie muss auch bei Windows-Dateisperren geprüft werden; kein stiller Copy-Fallback für den verbindlichen Commitmarker. Dateiinhalte/-Metadaten und fsync-Grenzen dokumentieren. Journal enthält sensible Snapshots und benötigt dieselbe Zugriffsbeschränkung, Rotation und Datenschutzbehandlung wie Datenfiles.

Dies erweitert bestehende Speicherfunktionen und ist daher eine eigene ausdrücklich zu genehmigende Änderung. Keine automatische SQLite-Einführung. SQLite mit Transaktionen/Unique-Constraints wäre eine Alternative, aber eine zusätzliche Architektur- und Abhängigkeitsentscheidung. Ohne tragfähige D9-Lösung ist die Sponsorfunktion nicht als manipulations-/wiederholsicher abzunehmen.

### 9.3 Optimistische Sperren und Idempotenz

- Mutationen erwarten `expectedRevision`; bei abweichendem Stand `409 CONFLICT` mit zulässiger aktueller Revision, nicht fremden Daten.
- `baseVersionId` bei Nachfolgevorschlägen und Aktivierung vergleichen.
- Persistenter Idempotenzschlüssel pro Akteur/Operation; Requesthash verhindern Wiederverwendung desselben Schlüssels mit anderem Inhalt (`409`).
- Aktuelle Authentifizierung/Berechtigung vor jeder Receipt-Wiedergabe. Nach Ende keine im Receipt versteckten Leistungsdaten erneut ausliefern.
- Fachliche Einzigartigkeit unabhängig von Idempotenz: zwei verschiedene Schlüssel dürfen nicht denselben Anspruch/Verbrauch zweimal erzeugen.
- Transitions erneut im Commit prüfen, nicht nur per vorgeschaltetem Task-Lookup. Kein asynchrones I/O zwischen Check und Mutation.
- Wiederholte Bestätigung desselben Inhalts ist idempotent; Zustimmung zu superseded Version kann keine heutige Aktivierung auslösen.

### 9.4 Auswertung und Performance

- Leistungspunkte und erreichter Anspruch möglichst im selben Fachcommit wie Anerkennung eines geprüften Ereignisses materialisieren.
- Nachhol-Evaluator für Neustart/Altbestand mit deterministischen Schlüsseln und persistentem Cursor; wiederholbar, keine doppelte Gutschrift.
- Vor Beendigung/Versionswechsel bis zur Grenze auswerten (Kapitel 7.7).
- Nur aktive relevante Verträge evaluieren, Daten per Kind/Beziehung/Version indexieren; keine komplette Fortschrittshistorie pro Poll neu summieren.
- Aggregate sind Projektionen und aus Ledger rekonstruierbar, keine frei überschreibbare Wahrheit.
- Begrenzte Listen/Pagination und Cursor; keine unbeschränkten Nachrichten-/Historienantworten.
- JSON-Speicher skaliert wegen Clone/Full-write begrenzt. Volumenmessung und vereinbarte Obergrenze als Abnahme; erst danach größere Datenbankmigration planen, nicht ungefragt ausführen.

### 9.5 Backup/Restore als Sicherheitsgrenze

- Raum-Backup/-Restore bleibt auf bestehende Raumzutritte/Spielgrants begrenzt, enthält keine Sponsorbeziehungen, Punktledger oder Zustimmungen.
- Vollständiges Snapshot muss künftig alle zusammengehörigen Zustände/Generation/Journalposition umfassen, nicht nur die Stammdatei.
- Ein altes Backup darf keine beendete Begleitung automatisch reaktivieren oder einen erfüllten Claim wieder einlösbar machen.
- Empfehlung: dauerhaftes Widerrufs-/Erfüllungsledger außerhalb rücksetzbarer Stammsnapshots, aus dem Restore terminale Zustände/Verbrauch und Löschungen erneut angewendet werden; alternativ vollständiges committed Fachjournal mit geprüfter Replaygrenze.
- Beim Restore unklare Begleitungen fail-closed pausieren und elterliche Prüfung verlangen; Claim-Einmaligkeit bleibt über persistente Schlüssel erhalten.
- Restore ist kein legaler Weg, Elternzustimmungen oder Punkteverbrauch rückgängig zu machen. Konfliktzustände anzeigen und nicht stillschweigend überschreiben.

## 10. API-Entwurf

Alle Angaben sind geplante Routen, keine derzeit vorhandenen Endpunkte. Stil: bestehende JSON-POST-API, deklarative Tasks. Personenidentität stets aus Sitzung; Client darf keine handelnde Person festlegen.

Gemeinsame Envelope für Mutationen: `{entityId, expectedRevision, idempotencyKey, ...fachlicherInput}`. Verträge/Zugriffe zusätzlich `versionId/contentHash`; Status-/Zeitfelder setzt der Server. Antwort enthält nur rollengerechte DTOs. Fachliche Fehlercodes zusätzlich zum HTTP-Status.

### 10.1 Sponsor

| Geplante Route | Inhalt / zusätzliche Kontrolle |
|---|---|
| `/api/cms/sponsor/my-requests` | Nur eigene Antragstexte/Status; vor Genehmigung keine Kinder-/Leistungsdaten |
| `/api/cms/sponsor/request` | Anfragecode, Zweck, Dauer, erster Vorschlag; Codeprüfung, Rate-Limit, Doppelanfragekontrolle |
| `/api/cms/sponsor/request-withdraw` | Eigene noch offene Anfrage zurücknehmen |
| `/api/cms/sponsor/companionships` | Nur genehmigte aktive eigene Begleitungen mit minimalen genehmigten Aliasdaten |
| `/api/cms/sponsor/detail` | Beziehung und wirksamer Scope; aktive Beziehung erforderlich |
| `/api/cms/sponsor/progress` | Aggregierte zugelassene Leistungen, Punkte und Berechnung im genehmigten Scope |
| `/api/cms/sponsor/agreement-propose` | Neue unveränderliche Version auf aktueller Basis, kein Wirksamwerden |
| `/api/cms/sponsor/agreement-consent` | Eigene Zustimmung zu exakter Version/Hash |
| `/api/cms/sponsor/end` | Eigene Begleitung beenden; Ansprüche vorher materialisieren, keine Anspruchslöschung |
| `/api/cms/sponsor/obligations` | Optional D7: eigene minimale Anspruchsabwicklung nach Ende, keine Kind-/Leistungsdaten |
| `/api/cms/sponsor/reward-fulfillment-report` | Erfüllungsmeldung eigener freigegebener Verpflichtung, noch keine Elternbestätigung |

### 10.2 Eltern

Neue Elternrouten im bestehenden Adapter tragen `childId`, damit dessen `viewChild`-Vorspann greift. Objekt-ID/`childId`-Konsistenz zusätzlich im Fachmodul prüfen.

| Geplante Route unter `/api/cms/parent/` | Inhalt |
|---|---|
| `sponsor-contact-create` | Befristeten Anfragecode für eigenes Kind erzeugen |
| `sponsor-requests` | Alle Begleitungsanfragen für eigenes Kind |
| `sponsor-request-decision` | Zustimmen/Ablehnen zur konkreten Anfrage-/Scopeversion |
| `sponsor-companionships` | Aktive, pausierte und beendete eigene Begleitungen |
| `sponsor-access-propose`, `sponsor-access-consent` | Scope-Version beantragen/freigeben; Elternbeschränkung sofort |
| `sponsor-pause`, `sponsor-resume`, `sponsor-end` | Zustandswechsel mit nachvollziehbarem Grund |
| `sponsor-agreements`, `sponsor-agreement-propose`, `sponsor-agreement-consent` | Wirksame und vorgeschlagene Versionen, strukturierter Diff, Zustimmung |
| `sponsor-history` | Vollständige Familienereignisse einschließlich Nachrichten und Ablehnungen |
| `sponsor-rewards`, `sponsor-reward-request` | Erworbene/offene/erfüllte Ansprüche und Einlöseantrag |
| `sponsor-reward-decision` | Elternentscheidung zur konkreten Claim-Revision |
| `sponsor-reward-fulfillment-confirm` | Erfüllung bestätigen oder begründet als ungeklärt markieren |

### 10.3 Kind

Geplante Routen unter `/api/cms/child/sponsorship/`: `list`, `detail`, `access-preview`, `decline`, `pause`, `resume-request`, `agreement-propose`, `rewards`, `reward-request`, `receipt-report`, `history`.

Kindidentität ausschließlich `session.personId`, keine frei gewählte Ziel-Kind-ID. Verwaltungsrolle eines Kindes verleiht keine Sponsorverwaltung für andere Kinder. Kind darf Sicherheits-/Vetoaktionen auch bei pausierter Beziehung und jederzeit in der eigenen Sitzung nutzen.

### 10.4 Gemeinsame Views / Notifications

- `/api/cms/sponsorship/agreement-diff`: rollengerechter Vergleich aktueller/vorgeschlagener Version, keine unautorisierten Daten.
- Optional `/api/cms/sponsorship/message-list` und `message-send`: nur gemeinsame Konversation, D8.
- `/api/cms/account/notifications` und `notification-read`: allgemeine Inbox, Empfänger- und aktuelle Objektberechtigung prüfen.
- Bestehende `/api/cms/mp/notifications`-Routen kompatibel erhalten; Multiplayer-DTO nicht stillschweigend verändern.

### 10.5 Transport/Sicherheitsverhalten

- `401`: fehlende/abgelaufene Sitzung; `403`: fehlendes Mandat oder Zugriff nach Ende; `404`: Objekt im erlaubten Kontext nicht vorhanden; Existenz fremder Kinder nicht offenlegen.
- `400`: ungültiger Input; `409`: Revision/Version/Idempotenzkonflikt; `429`: Limit.
- Zustandsändernde Cookie-Anfragen mit strengem Origin-/CSRF-Schutz. Bestehender allgemeiner Pfad akzeptiert teilweise fehlenden Origin; Sponsorpfade müssen die erforderliche Prüfung explizit erzwingen, ohne Legacyverhalten ungefragt global zu ändern.
- Allowlist für Felder, Text-/Payloadgrenzen, Pagination, keine Mass-assignment-Übernahme.
- Kein direkter Zugriff auf Storedateien, Fachledger oder Diagnose-Traces aus dem Browser.
- Sponsorpfade nicht über die Spiel-IFrame-Bridge freischalten. Spiel-Launchkeys gelten nicht als Sponsor-/Elternzustimmung.

## 11. Eltern-, Sponsor- und Kinderansichten

Alle Oberflächen mit vorhandenen GCS-Komponenten: `TTable`, `TObjectList`, `TLabel`, Eingaben, Buttons, Variablen, Tasks und HTTP-Actions. Keine neue allgemeine Frontend-Plattform.

### 11.1 Eltern

Geplante Stages:

- `stage_parent_sponsors`: pro gewähltem eigenen Kind, Anfragen und Begleitungen.
- `stage_parent_sponsor_request`: Sponsoridentität, Zweck, Dauer, Belohnungsvorschlag, verlangte Sicht; Genehmigen/Ablehnen; ausstehende Elternzustimmungen.
- `stage_parent_sponsor_detail`: Status, aktueller Scope, Pause/Ende, „Diese Informationen sieht der Sponsor“.
- `stage_parent_sponsor_agreement`: wirksame Version links, Vorschlag rechts, Änderungen hervorgehoben, Zustimmungsnachweise und Wirksamkeitsdatum.
- `stage_parent_sponsor_rewards`: Leistungspunkte, Schwelle, ggf. Einlöseguthaben separat; Anspruchsstatus, Einlösung, Erfüllung.
- `stage_parent_sponsor_history`: Filter nach Ereignis/Zeitraum/Akteur, komplette relevante Familiegeschichte mit Versionsverweisen.

„Genehmigen“ darf nicht implizit ungezeigte Scopefelder oder zukünftige Vertragsänderungen einschließen. Warnung bei historischem Datenzugriff/erweiterten Details. Konflikt `409` führt zu Neuladen und erneutem Diff, nicht blindem Überschreiben.

### 11.2 Sponsor

- `stage_sponsor`: eigene Anfragen, zulässige Begleitungen, eigene Verpflichtungen; keine globale Kinderliste.
- `stage_sponsor_request`: Eingabe des Kontaktcodes und der Anfrage; keine Datenvorschau des Kindes.
- `stage_sponsor_companionship`: nur genehmigter Alias, Zeitraum, genehmigte Aggregationen, aktiver Vertrag, offene Vorschläge.
- `stage_sponsor_agreement`: Vorschlag und explizite eigene Verpflichtungszustimmung.
- `stage_sponsor_rewards`: eigene erworbene Verpflichtungen; Erfüllung melden, keine Elternfreigabe simulieren.

Sponsor-only-Konto muss sich über den Passwortkanal anmelden können. Der aktuelle `admin.verify` würde ein Konto ohne Verwaltung/Eltern/Beobachterkontext ablehnen: Sponsorkontext ausdrücklich ergänzen und Navigation testen. GET `/sponsor` rendert nur den Sponsorbereich; vorhandene Parent-/Observerredirects um eindeutig gewählten Kontext ergänzen. Mehrrollenperson bekommt Bereichsauswahl, bestehende reine House-/SuperAdmin-Startwege unverändert.

### 11.3 Kind

- `stage_child_sponsors`: verständliche Übersicht mit Sponsoridentität, Zweck und sichtbaren Informationen.
- `stage_child_sponsor_detail`: „Was sieht mein Sponsor?“, klare Aktionen Ablehnen/Pause, keine versteckten Zustimmungsfolgen.
- `stage_child_sponsor_rewards`: konkrete Belohnung, Schwelle, eigener Fortschritt und Anspruch, Einlösung anfordern.
- Änderung vorschlagen statt selbst Vertrag verändern; Hinweise „Wartet auf Eltern/Sponsor“.
- Historie mit verständlichen Bezeichnungen; keine internen IDs/Hashes als Hauptinformation.
- Kein Leistungsdruck durch Ranglisten, keine Belohnung als Voraussetzung für normale Spielrechte.

### 11.4 Benachrichtigungen

An alle aktuell zuständigen aktiven Eltern bei Anfrage, Zugriffsvorschlag, Vertragsänderung, Zustimmung/Wirksamwerden, Pause/Ende, erreichtem Anspruch, Anforderung, Freigabe, Erfüllungsmeldung und Erfüllungsbestätigung.

Notification enthält nur Typ, Beziehung-/Vertrags-/Claimreferenz, neutralen Kurztext, serverseitigen Zeitpunkt und Lesestatus. Einzigartig nach `eventId + recipientPersonId`. Empfänger aus Guardian-Beziehungen, nicht Clientbody. Beim Öffnen erneut Rechte prüfen; Lesestatus eines Elternteils verbirgt weder Historie noch Notification anderer Eltern. Neu bestätigte Eltern können die Familienhistorie einsehen, auch wenn sie keine alten Pushhinweise erhalten haben.

Erste Stufe In-App-Inbox/Polling. Keine E-Mail/SMS/externe Pushdienste erforderlich.

## 12. Datenschutz, Retention und Historienintegrität

- Elterntransparenz bedeutet alle relevanten Interaktionen ihrer betroffenen Kinder, nicht anderer Familien oder Sponsorenbeziehungen.
- Keine Kontakte, Geburtsdaten, Adressen, Haus-/Raummitgliederlisten oder anderen Kinder im Sponsor-DTO.
- Aggregation kann kleine Gruppen/Einzelrunden indirekt offenlegen. Detailstufe und Zeitraum bewusst begrenzen; kein Drilldown über Aggregatfreigabe hinaus.
- Sponsor-DTOs als Feld-Allowlist erzeugen; bestehende `childCard`/`progressList` nicht ungefiltert wiederverwenden.
- Ereignishistorie kann Vertrags-/Nachrichtentexte enthalten und ist deshalb geschützter Fachbestand, kein öffentliches Diagnoseaudit.
- Sponsor/Kind haben keine Edit/Delete-API für Historie. Korrekturereignis referenziert Original; vorher/nachher bleiben sichtbar.
- Hashkette/Sequenzen können Änderungen erkennen helfen, garantieren aber ohne extern gesicherten Anker keine Unveränderbarkeit gegenüber Betreiberzugriff. Keine absolute Unveränderbarkeitsbehauptung.
- Explizite Retentionmatrix festlegen: Rohleistung, Punktbeleg, Vertragsversion, Zustimmung, Nachricht, Claim, Idempotenzbeleg, Journal und Backup. D10 vor realem Kindbetrieb.
- Bestehenden 30-Tage-Sweep nicht auf Sponsorledger/Claims erweitern. Vor Rohdatenlöschung notwendige zulässige, minimale Beleg-/Aggregationsdaten dauerhaft sichern; keine Anspruchsermittlung nur aus bald gelöschtem `progress`.
- Historienaufbewahrung ist zweckgebunden, nicht pauschal unbegrenzt. Aufbewahrung offener Ansprüche und Familiennachvollziehbarkeit mit Löschrechten abstimmen.
- `exportPerson`: eigene Sponsorobjekte und Kind/Elternnachweise ergänzen, fremde Familien-/Kontaktdaten herausfiltern.
- `deletePerson` und `applyDeletions`: Begleitungen schließen, Zugriff sofort entziehen, Nachrichten/Identitäten nach beschlossenem Konzept redigieren/anonymisieren; nicht bloß Arrays löschen und Anspruchsnachweise verlieren.
- Wiederherstellung wendet Lösch-/Widerrufsnachweise erneut an. Bereits exportierte Kopien/Caches im Löschkonzept berücksichtigen.
- Diagnose-Traces bei Sponsorendpunkten standardmäßig ohne Inhalte oder mit zusätzlicher Redaction; Parent-/Admintrace darf keine kostenlose private Inhaltssicht eröffnen.

## 13. Betroffene Dateien und geplante neue Dateien

### 13.1 Vorhandene Dateien, deren Änderungen vor Umsetzung konkret freizugeben sind

| Datei | Geplante Änderung |
|---|---|
| `scripts/cms/cms-core.cjs` | Validierung neuer Sammlungen; zusätzliche Sponsorpermissions, bestehende Parent-/Adminchecks nicht erweitern |
| `scripts/cms/cms-admin.cjs` | Sponsorkontext beim verifizierten Passwortlogin, keine Sponsorverwaltungssitzung |
| `scripts/cms/cms-server-components.cjs` | Neue Komponentenmethoden registrieren; contexts/Notificationprojektion erweitern; klar begrenzte Leistungshooks |
| `scripts/cms/cms-parent.cjs` | Neue Elternrouten mit bestehendem Kind-Gate integrieren; bestehende Einrichtungsregeln erhalten |
| `scripts/cms/cms-server.cjs` | GET `/sponsor`, Kontonavigation, Runtime-Kontext, strenge Originprüfungen neuer Pfade, Evaluator-/Retentionintegration |
| `scripts/cms/cms-store.cjs` | D9: transaktionale Speicherung, Generation/Recovery, vollständige Snapshots, sicherer Restore, Sponsor-Löschschutz |
| `scripts/cms/cms-migrations.cjs` | Neue additive Migration ab aktuellem Schema 7; nächster freier Versionsstand bei Implementierung neu prüfen |
| `scripts/cms/cms-privacy.cjs` | Export/Anonymisierung/Beziehungsende und Anspruchserhalt |
| `scripts/cms/cms-trace.cjs` | Gezielte Inhaltsmaskierung für Sponsor-/Nachrichtendaten, keine Abschaltung vorhandener Schutzregeln |
| `scripts/cms/cms-add-login-player-server-stages.cjs` | Sponsorflag/Anmeldeantwort und Kontokontextnavigation |
| `scripts/cms/cms-add-parent-server-stage.cjs` | Sponsor-Elternendpunkte ergänzen, bestehende Endpunkte erhalten |
| `scripts/cms/cms-add-parent-stages.cjs` | Nur nötige Navigations-/Context-Erweiterung; keine pauschale Neugenerierung alter Serverstages |
| `scripts/cms/cms-add-play-mp-server-stages.cjs` | D5: gezielte Validierungs-/Provenienz-/Leistungshooks; Multiplayer unverändert |
| `scripts/cms/cms-seed-testdata.cjs` | Synthetische Sponsoren, mehrere Familien, Begleitungen, Versionen und Claims; keine echten Daten |
| `scripts/cms/cms-demo.json` | Nur falls aktuelle Startschemaanpassung erforderlich; keine automatischen Sponsorfreigaben |
| `game-server/public/projects/GCS-CMS.json` | Neue deklarative Server/UI-Stages und Navigation, bestehende Editorarbeiten schützen |
| `src/components/index.ts` | Exporte neuer Serverdesignkomponenten |
| `src/services/ComponentRegistry.ts` | Import/Registrierung analog vorhandener Serverklassen |
| `docs/schemas/schema_server_cms.json` | Konkrete neue Komponenten-/Methodenverträge dokumentieren |
| Vorhandene `scripts/test-cms-*.cjs` | Rollen-/Login-/Parent-/Play-/Privacy-/Store-Regression und neue Fixtures |

`cms-build-role-workspaces.cjs` ist Referenz für Tabellen-/Taskstil. Sponsorstages vorzugsweise eigener Generator; HouseAdmin/RaumAdmin nicht unnötig umbauen. `cms-shell.js`, `CmsGameHost.ts` und Spieleprojekte nur dann ändern, wenn die gewählte D5-Quelle dies konkret benötigt; vorher separat vorlegen.

### 13.2 Vorgeschlagene neue Implementierungsdateien

- `scripts/cms/cms-sponsor.cjs`: gekapselte Beziehungs-/Zustimmungs-/Scopefachlogik.
- `scripts/cms/cms-performance.cjs`: Regelversionen, Provenienzprüfung, Leistungspunkte und Evaluator.
- `scripts/cms/cms-rewards.cjs`: Anspruchsautomat und optionales Einlösekonto.
- `scripts/cms/cms-add-sponsor-server-stages.cjs`: deklarative neue Sponsor-/Kinder-/gemeinsame Endpunkte.
- `scripts/cms/cms-add-sponsor-stages.cjs`: Sponsor-/Eltern-/Kinderansichten und gezielte Navigation.
- `src/components/TServerSponsorship.ts`, `TServerSponsorAgreement.ts`, `TServerReward.ts`: Designklassen.
- Neue `scripts/test-cms-sponsor-*.cjs` nach Kapitel 16.

CJS-Fachmodule können ihre Methodentabellen in `cms-server-components.cjs` registrieren, ähnlich dem bestehenden Deck-Modul. Keine unabhängige zweite Datenbank, keine direkten unkoordinierten Dateischreibpfade.

Diese Dateien sind nur geplant, in diesem Schritt nicht angelegt. Der finale Zuschnitt wird vor Implementierung am dann aktuellen Code geprüft. Keine Funktionslöschungen geplant.

## 14. Kontrollierte Migration und Generatorstrategie

### 14.1 Datenmigration

1. Bei Umsetzung zuerst aktuellen `SCHEMA_VERSION` und alle noch offenen Arbeitsänderungen erneut prüfen. Der gelesene Stand ist 7; keine feste zukünftige 8 annehmen, falls parallel erweitert wurde.
2. Additive `v7 → nächste freie Version`-Migration mit leeren Sponsorcollections, ohne Rollenvergabe, Kindzugriff, retroaktive Punkte oder Ansprüche.
3. Bestehende Personen/Rollen/Guardians/Grants/Budgets/Leistungsereignisse unverändert übernehmen.
4. Alte `progress`-Einträge nicht als geprüft umetikettieren. Historische Anerkennung nur über D5/D6 mit Elternfreigabe.
5. Neue Referenz- und Unique-Invarianten an Altfällen prüfen. Inkonsistenter Bestand führt zu konkretem Bericht/Abbruch, nicht stiller Datenkorrektur.
6. Vor Migration vollständige konsistente Sicherung einschließlich Ops-/Lösch-/Journalstand; bestehender Stammdatei-Snapshot allein reicht nicht.
7. Dry-run auf Kopie: Diff, Schema-/Integritätsprüfung, Berechtigungsbaseline, zweimalige Ausführung idempotent.
8. Produktivmigration durch Nutzer im kontrolliert gestoppten Dienst oder ausdrücklich genehmigten Wartungsmodus; kein paralleler Seed/Generator auf Echtdaten.
9. Rollback nur mit vereinbarter Daten-/Journalstrategie. Nach echten Sponsortransaktionen keine ältere App starten, die neue Felder ignoriert und widerrufene Beziehungen/Claims zurücksetzt.

### 14.2 Projektdatei

- Aktuelle `GCS-CMS.json` enthält uncommittete Änderungen; vor jeder Aktualisierung Diff und Eigentum der Stages prüfen.
- Bestehende Generatoren können ganze Stages ersetzen. Neue Stages gezielt ergänzen, bekannte eigene Tasks/Actions nach Namen mergen, fremde/editorgeänderte Inhalte nicht überschreiben.
- Insbesondere `cms-add-parent-stages.cjs` erzeugt auch historische Servermarker. Nicht blind allein ausführen und dadurch aktuelle Serverstages zurücksetzen.
- Generierung auf temporärer Projektkopie prüfen; Tasks, Methoden, Targets, Variablen, events/onRequest und Endpoint-Einzigartigkeit validieren.
- Bestehende Login-/Role-/Parent-/Room-/MP-Stages müssen nach Generierung semantisch unverändert sein, abgesehen von ausdrücklich genehmigter Sponsor-Navigation.

## 15. Offene fachliche und technische Entscheidungen

| ID | Entscheidung | Empfohlener Ausgangspunkt | Warum vor Umsetzung nötig |
|---|---|---|---|
| D1 | Wer genehmigt bei mehreren Eltern? | Alle aktuell bestätigten, aktiven Eltern für neue Begleitung, mehr Zugriff und Vertragsänderung; jeder einzeln darf schützen/beenden | Bestehender Code/Fachplan haben keine eindeutige allgemeine Sponsorregel |
| D2 | Kindveto, Pause und Wiederaufnahme | Sofortige Kindpause; Kindablehnung blockiert Antrag; Wiederaufnahme nach Kindfreigabe und nötiger Elternbestätigung, keine Anrechnung während Pause | Sponsor darf Pause nicht umgehen; Auswirkung auf Leistung/Zeitraum |
| D3 | Sponsoridentität und Registrierung, eigene Familie | Kontrollierter Erwachsenen-Passwortzugang, kein Kinderkatalog; Sponsor darf nicht seine eigene Elternzustimmung ersetzen; eigene-Kind-Sponsoring zunächst nicht anbieten | Rollenvermischung, Vertrauen und Kontoanlage |
| D4 | Zulässige Sichtstufen | Punkte/aggregierte genehmigte Fächer/Aktivitäten; keine Einzelantworten/Fehler/Inhalte in v1 | Filtertaxonomie und datensparsame DTOs |
| D5 | Punktequelle und Prüfstandard | Eine konkret freigegebene, serverprüfbare Referenzaktivität; gemeldete Rohleistungen nicht automatisch belohnen | Aktuelle Clientmeldungen sind kein unabhängiger Nachweis |
| D6 | Historische Punkte, Verbrauch, Wiederholung, Mehrfachsponsoren | Neue Leistungen ab Aktivierung; einmaliger Claim je Vertrag; kein Verbrauch als einfachste Standardregel, Verbrauch nur ausdrücklich; getrennte Kontotöpfe | Kein unbeabsichtigter Punktverlust/Doppelanspruch; Ledgerauslegung |
| D7 | Ansprüche nach Ende/Fristen/Erfüllung | Erhalten; endgültige Elternbestätigung der Erfüllung; minimierte Sponsor-Verpflichtungsansicht oder nur Elternabwicklung bewusst wählen | Sofortiger Zugriffsentzug muss mit Abwicklung vereinbar sein |
| D8 | Kommunikation | Strukturierte gemeinsame Kommentare; kein allgemeiner Chat, keine Anhänge | Umfang, elterliche Einsicht, Missbrauchsschutz und Datenschutz |
| D9 | Speichergarantie | Bestehenden JSON-Adapter mit Recoveryjournal/Generationen, Single-Writer und Restore-Schutz härten | Bestehende Mehrdateischreibung/Audit ist nicht transaktional |
| D10 | Aufbewahrung und Löschung | Zweckgebundene Fristen separat für Leistung/Vertrag/Anspruch/Nachricht/Journal; vor echten Daten organisatorisch prüfen | Historie/Anspruchserhalt vs. Datenschutz; Code/Dokumentfristen unterscheiden sich |
| D11 | Gleichzeitig mehrere offene/aktive Sponsoren pro Kind? | Eine Beziehung je Sponsor/Kind, ggf. mehrere unterschiedliche Sponsoren ohne gegenseitige Einsicht; keine Rangliste | Anrechnung/Kindbelastung und elterliche Übersicht |
| D12 | Nachträgliche Korrekturen und Streitfälle | Append-only begründeter Prüfprozess, keine Sponsor-Korrekturrechte, kein automatischer Entzug bereits erfüllter Ansprüche | Fehler-/Manipulationsklärung ohne stillen Anspruchsverlust |

Nicht jede UI-Detailfrage blockiert die technische Vorarbeit; D1, D3, D5, D6 und D9 beeinflussen jedoch unmittelbar Datenmodell, Sicherheitsgarantie und Umfang. Sie sind vor entsprechender Implementierung ausdrücklich festzulegen. Dieser Plan erteilt keine Zustimmung für Änderungen bestehender Funktionen.

## 16. Tests und konkrete Abnahmekriterien

Neue Tests mit `node:assert/strict`, temporären Daten, künstlicher Uhr und echter deklarativer Runtime. Playwright nur für serverstartende API-/Browserprüfungen nach ausdrücklicher Freigabe bzw. durch den Nutzer. Keine Tests gegen den produktiven CMS-Datenpfad.

### 16.1 Testdateien (geplant)

- `scripts/test-cms-sponsor-permissions.cjs`: Rollenmatrix, Objekt-/Scopeisolierung, Elternmenge, Kindveto.
- `scripts/test-cms-sponsor-state.cjs`: vollständige Übergänge, Pause/Ende/Ablauf, Wiederaufnahme.
- `scripts/test-cms-sponsor-agreements.cjs`: Versionen, Hashbindung, Quorum, Diff, alte Ansprüche.
- `scripts/test-cms-sponsor-points.cjs`: geprüfte Quellen, Delta/kumulativ, Wertebereiche, Zeitfenster, Historienbaseline.
- `scripts/test-cms-sponsor-rewards.cjs`: Unique-Claims, Reservierung/Verbrauch, Erfüllung, Nach-Ende-Abwicklung.
- `scripts/test-cms-sponsor-store.cjs`: Absturz-/Recovery-/Backup-/Restore-/Mehrprozessfälle.
- `scripts/test-cms-sponsor-privacy.cjs`: DTO-Feldgrenzen, Familieisolation, Export/Anonymisierung/Retention.
- `scripts/test-cms-sponsor-ui.cjs`: aktuelle GCS-Stages und echte Eltern-/Sponsor-/Kinderflows.

### 16.2 Berechtigungs- und Datenschutzfälle

1. Sponsorrolle ohne Beziehung: alle Kinddaten-/Fortschritt-/Karten-/Deck-/Export-/Familienrouten verweigert.
2. `requested`, `rejected`, abgelaufen und `paused`: kein Sponsor-Leistungszugriff.
3. Genehmigte Beziehung A: Zugriff nur auf Kind A im Scope; fremde Kind-/Beziehungs-/Versions-/Claim-ID blockiert.
4. Genehmigtes Mathe/Woche/Punkteaggregat: Deutsch, anderer Zeitraum, Tagesdetail, Antworttext oder Fehlerfilter blockiert.
5. Eltern- und Kinder-Vorschau zeigt exakt denselben freigegebenen Scope wie der Sponsor; keine unsichtbaren Zusatzfelder.
6. Persönliche Karten/Stapel weiterhin nur nach bisherigen Regeln; Sponsorrolle verleiht keine dieser Rechte.
7. Nach erfolgreichem Ende: alte Cookies, gespeicherte IDs, direkte APIs und wiederholte Commandreceipts geben keine Kinddaten mehr aus.
8. Deaktivierte Sponsor-/Elternperson oder widerrufene Elternbasis greift unmittelbar; kein privilegierter Login-Cache.
9. Zweiter Sponsor desselben Kindes sieht keine fremde Sponsorkonversation; andere Familie keinerlei Einsicht.
10. Sponsor + Eltern-/Adminrolle: keine Selbstgenehmigung oder vermischte Sponsorprojektion; bestehende separate Rollen erhalten.

### 16.3 Zustimmungs-/Versionsfälle

11. Eltern zustimmen V1, Sponsor V2: keine Aktivierung.
12. Zustimmung V1 plus nachträglich veränderter Inhalt/Hash: nicht wirksam; neue Version benötigt neue Zustimmungen.
13. Kindänderung/Sponsoränderung ohne Eltern: bisherige V1 gilt weiter.
14. Geänderte Sponsorverpflichtung ohne Sponsorzustimmung: nicht wirksam.
15. Zwei parallele Nachfolger: nur einer auf aktueller Basis aktivierbar; anderer `409` und neuer Diff.
16. Mehrere Eltern gemäß D1, pending/revoked/inaktive Beziehungen, doppelte Guardianzeilen und geänderte Elternmenge korrekt.
17. Kindpause kann Sponsor/Eltern nicht ohne beschlossenes Wiederaufnahmeverfahren entfernen.
18. Zugriffseinschränkung sofort, Erweiterung nur neu genehmigt; kein Vertrag als Zugriffsbypass.

### 16.4 Punkte-/Belohnungsfälle

19. NaN, Infinity, negative/übergroße/gebrochene Werte, falsche Einheit/Quellversion blockiert für belohnungsfähige Leistung.
20. Roh gemeldetes Ergebnis ohne geprüfte Quelle erzeugt keinen Anspruch; Sponsor kann keine Punkte melden.
21. Gleiche Runde mit anderer Request-/Ereignis-ID erzeugt nur einen Leistungsbeleg.
22. Kumulative Werte 10 und 20 ergeben nach kumulativer Regel 20, nicht 30; Deltaquellen anders behandeln.
23. Historische Ausgangswerte und neue Ledgerereignisse nicht doppelt anrechnen; Retentionlücke sichtbar.
24. Schwelle wird serverseitig erkannt, auch ohne geöffneten Sponsorbrowser; wiederholter Evaluator idempotent.
25. Zwei gleichzeitige Requests, verschiedene Idempotenzschlüssel, Neustart und wiederholte Freigabe/Erfüllung erzeugen exakt einen Claim/Verbrauch.
26. Zwei konkurrierende Einlösungen desselben Kontoguthabens können nicht überziehen; Rückzug gibt Reservierung einmalig frei.
27. Schwelle steigt oder Belohnung ändert sich: bereits erworbener Claim bleibt mit alter Vertragsversion/Umfang erhalten.
28. Ende/Versionswechsel vor verzögertem Evaluator: bis zur Grenze tatsächlich erworbener Anspruch wird nicht verloren.
29. Erfüllungsmeldung des Sponsors allein gilt noch nicht als bestätigte Erfüllung; Elternbestätigung genau einmal.
30. Nach Ende erworbene Ansprüche sichtbar für Eltern/Kind; optionale Sponsorabwicklung liefert keine neuen Leistungsdaten.

### 16.5 Persistenz, Historie und Wiederherstellung

31. Jeder fachliche Wechsel hat Familienereignis mit Zeitpunkt, Akteur, altem/neuem Zustand und Versionsbezug.
32. Fehler bei History-/Notificationwrite: keine teilweise erfolgreiche Fachmutation; Recovery stellt konsistenten Zustand her.
33. Crashinjektion vor/nach Journal, Commitmarker, Dateiprojektion und Auditschreibung; Neustart jeweils konsistent, kein Doppelclaim.
34. Zweite schreibende CMS-Instanz für denselben Pfad verweigert; Journal/Lock-Recovery kontrolliert.
35. Restore alten Backups reaktiviert keine beendete Begleitung und setzt keinen erfüllten Anspruch/Verbrauch zurück.
36. Raumrestore verändert Sponsorverträge/-punkte nicht.
37. Rohleistungsbereinigung nach 30 Tagen löscht nicht Leistungspunktbelege/erreichte Ansprüche; langfristige Nachvollziehbarkeit gemäß D10.
38. Personanonymisierung und Restore bringen keine Sponsorberechtigung oder privaten Namen/Inhalte zurück.
39. Benachrichtigung je Ereignis/Empfänger einmal; ein Elternlesestatus beeinflusst andere Eltern nicht.
40. Nachrichtenkorrektur erzeugt neue Version/Ereignis; Kind/Sponsor können Geschichte nicht spurenlos editieren.

### 16.6 UI, Integration und Regression

- Neue Serverendpunkte besitzen gültige Tasks, Methoden und eindeutige Pfade; alle Komponenten/Registries/Schemaverträge vorhanden.
- Sponsor-only-Login, Eltern-only-Login, Mehrrollen-Kontextwahl, Kindzugang und bestehende House-/Super-/RaumAdminwege.
- Antrag ohne Kindzugriff, Genehmigung, Scopevorschau, Änderungsdiff, ausstehende Zustimmung, Claim, Pause/Ende als echte UI-Task-HTTP-Kette.
- `409` lädt aktuellen Stand; UI behauptet keine erfolgte Genehmigung bei fehlender Zustimmung.
- Bestehende Regressionen: `test-cms-parent.cjs`, `test-cms-play.cjs`, `test-cms-store.cjs`, `test-cms-privacy.cjs`, `test-cms-login-session.cjs`, `test-cms-role-choice.cjs`, `test-cms-role-workspaces.cjs`, `test-cms-testdata.cjs`, Multiplayer-/Cards-/Decktests gemäß Berührung.
- Historische Katalogtests nicht als einziges Abnahmekriterium verwenden; vorher dokumentieren, welche tatsächliche GUI sie prüfen.
- Lastprüfung mit definierter Anzahl Kinder/Verträge/Ereignisse; begrenzte Pollantworten und keine Endlosschleifen der synchronen Runtime.

### 16.7 Verbindliche GCS-Architekturabnahme

Zusätzlich zu den fachlichen Fällen sind folgende Nachweise erforderlich:

1. Alle neuen Eltern-, Sponsor- und Kinderansichten sind GCS-Stages; sämtliche Interaktionen führen über Events, Tasks und Actions. Kein separater JavaScript-/HTML-Fachworkflow.
2. Jeder neue fachliche API-Endpunkt besitzt eine eindeutige `TServerEndpoint`-Definition und einen benannten `onRequest`-Task. Transportadapter enthalten keine parallele fachliche Ablaufsteuerung.
3. Ablaufprüfungen und Erfolgs-/Fehler-/Konfliktverzweigungen lassen sich im GCS-Projekt nachvollziehen; keine vollständigen Abläufe hinter einem generischen Dispatcher versteckt.
4. Jede verwendete Servermethode ist registriert, schema-dokumentiert und ihrer Designkomponente zugeordnet. Projekt-, Komponenten- und Methodennamen stimmen überein.
5. GCS-Projekt im Editor laden und die neuen Stages, Tasks, Actions und vorhandenen Ablaufdarstellungen prüfen. Speichern/erneutes Laden erhält Endpunktbindungen und Methodendaten.
6. Generatorlauf auf einer Projektkopie erhält fremde/editorgeänderte Inhalte; neue Abläufe bleiben nach Generierung und Editor-Roundtrip ausführbar.
7. Integrationstests führen die echte GCS-Runtime aus und prüfen mindestens Anfrage, Zustimmung, Versionskonflikt, Pause/Ende und Einlösung als Task-Action-Komponenten-Kette; ein direkter Fachmodultest allein genügt nicht.
8. Geprüfte Leistungs-/Hintergrundauswertung benutzt einen benannten GCS-Task und registrierte Komponentenmethoden. Technische Scheduler treffen keine zusätzlichen verborgenen Sponsorentscheidungen.
9. Direkte Komponentenaufrufe beziehungsweise manipulierte Taskdaten können Objektberechtigungen, Hashbindung, Quorum oder Einmaligkeitsgarantien nicht umgehen. Sicherheitsinvarianten bleiben innerhalb der atomaren Operation wirksam.
10. Zusammengehörige Zustimmung, Aktivierung, Historie, Benachrichtigung und Buchung bleiben transaktional konsistent. GCS-Actions dürfen die erforderliche Atomarität nicht aufbrechen.

**Zwingende Release-Abnahme:** Fälle 1/2 (kein Zugriff vor Genehmigung), 7 (sofortiger Zugriffsentzug), 11–18 (wirksame Änderung nur mit nötiger Zustimmung), 31/39/40 (vollständige Elterntransparenz), 21/25/26 (keine Doppelvergabe) und 27/28/30/35 (Anspruchserhalt) müssen nachweislich bestehen. Die GCS-Nachweise aus Kapitel 16.7, die D5-Quellenprüfung und die D9-Recoveryprüfung sind verbindliche Abnahmegates, keine optionalen Schönheitsprüfungen.

## 17. Schrittweise Umsetzungsreihenfolge und Freigabegates

### Phase A — Entscheidungen und technische Vertragsfreigabe

1. D1–D12 mit Nutzer abstimmen; strittige Regeln schriftlich fixieren.
2. Aktuellen Arbeitsstand erneut lesen, andere uncommittete Arbeiten abgrenzen.
3. Finale Collection-/API-/Komponentennamen sowie genau zu ändernde bestehende Funktionen vorlegen.
4. Keine Umsetzung allein durch Erstellung dieses Plans.

**Abnahme:** eindeutige Elternregel, Datenumfang, Punktequelle, Anspruchsregel und Speicherarchitektur freigegeben.

### Phase B — Speichergrundlage und Migration

1. Zuerst fehlende Recovery-/Idempotenz-/Restoretests schreiben.
2. Nach D9-Freigabe JSON-Adapter härten, Bestandsregression prüfen.
3. Neue leere Sammlungen/Validierung und additive Migration auf Kopien.
4. Kein Sponsorzugriff in Altdaten; kein automatisch bewerteter Altpunktestand.

**Abnahme:** konsistenter Zustand über Abstürze/Neustarts, alte Daten/Rechte unverändert, Wiederherstellung ohne Reaktivierung widerrufener Mandate.

### Phase C — Rolle, Anfrage, Freigabe, Pause und Ende

1. Sponsor-Passwortkontext ohne Admin-/Elternrechte.
2. Kontaktcode und Anfrage, Elternentscheidungen, Scopeversionen.
3. Kindwiderspruch/Pause und dynamischer Zugriffsentzug.
4. Familienereignisse und Notifications von Beginn an, nicht später anhängen.

**Abnahme:** kein Zugriff vor Freigabe, rollen-/familienisolierte Projektionen, sofortiger Entzug bei direkten APIs.

### Phase D — Versionierte Vereinbarungen

1. Unveränderliche Vorschläge und Hashbindung.
2. Vergleich bisher/neuer Vorschlag, Zustimmungsquorum, Sponsorverpflichtung.
3. Atomare Aktivierung und Konfliktprüfung; wirksame alte Version bleibt bis Freigabe.

**Abnahme:** keine Änderung ohne erforderliche Zustimmung derselben Version.

### Phase E — Prüffähige Leistungspunkte und Ansprüche

1. Gewählte D5-Referenzquelle separat prüfen und Änderungen vorlegen.
2. Leistungsledger und Regelversionen; keine stillen Scorekonvertierungen.
3. Claim-Evaluator und eindeutiger Anspruch je Vereinbarung.
4. Optionales Verbrauchskonto nur entsprechend D6; Reservierung/Verbrauch genau einmal.
5. Anspruchserhalt bei Pause, Änderung, Ende und Retention.

**Abnahme:** belegbare Berechnung, keine doppelte Gutschrift/Belohnung, keine verlorenen erworbenen Ansprüche.

### Phase F — Oberflächen und gemeinsame Interaktionen

1. Sponsor-, Eltern-, Kinderstages und Scopevorschau.
2. Strukturierte gemeinsame Kommentare nur im freigegebenen D8-Umfang.
3. Inbox und rollenrichtige Verlaufansichten; Widerruf leert aktive Sponsoranzeige.
4. Generatoren auf Projektkopie validieren, dann freigegebene Einträge übernehmen.

**Abnahme:** vollständiger Elternblick, verständlicher Diff, keine privaten Nebenkanäle.

### Phase G — Datenschutz und Gesamtabnahme

1. Export/Anonymisierung/Retention/Restorefälle.
2. Gezielte Modul-/Runtime-/Storetests und Berichte der tatsächlichen Ergebnisse.
3. Browser-/HTTP-/Buildprüfung durch Nutzer oder nur nach ausdrücklich erteilter Ausführungsfreigabe.
4. Sicherheits-/Funktionslücken offen ausweisen; keine automatische Produktivmigration.

**Abnahme:** alle sechs geforderten Kernnachweise sowie Bestandsregression und freigegebene Betriebsvoraussetzungen erfüllt.

## 18. Verifikationsbefehle für die spätere Umsetzung

Die folgenden Befehle werden hier nur geplant, nicht ausgeführt:

```powershell
# Syntaxchecks nach Umsetzung, beispielhaft für neue CJS-Fachmodule
node --check scripts/cms/cms-sponsor.cjs
node --check scripts/cms/cms-performance.cjs
node --check scripts/cms/cms-rewards.cjs

# Geplante direkte Modul-/Runtime-Tests, ohne listen()/Serverstart
node scripts/test-cms-sponsor-permissions.cjs
node scripts/test-cms-sponsor-state.cjs
node scripts/test-cms-sponsor-agreements.cjs
node scripts/test-cms-sponsor-points.cjs
node scripts/test-cms-sponsor-rewards.cjs
node scripts/test-cms-sponsor-store.cjs
node scripts/test-cms-sponsor-privacy.cjs

# Bestehende relevante Modulregression, jeweils vorher tatsächlichen Ablauf prüfen
node scripts/test-cms-parent.cjs
node scripts/test-cms-store.cjs
node scripts/test-cms-privacy.cjs
node scripts/test-cms-testdata.cjs

# Nutzer: Build und ausdrücklich freizugebender serverstartender UI-Test
npm run build
node scripts/test-cms-sponsor-ui.cjs
```

Neue Testdateien existieren derzeit nicht. Jeder Test wird vor Ausführung darauf geprüft, ob er Dienste startet oder Bestandsdaten verändert. Der allgemeine `npm test`-Runner ist keine belegte automatische Registrierung der neuen CMS-CJS-Suites; Einbindung oder separate Testmatrix bei Umsetzung ausdrücklich festlegen.

## 19. Zusammenfassung der Architekturentscheidung zur Freigabe

Die Sponsorrolle ist mit der bestehenden CMS-Architektur vereinbar. Vorhandene Personen, Passwortkonten, Guardian-Beziehungen, deklarative Endpunkte, GCS-UI und Notifications werden weiterverwendet. Neu erforderlich sind kindbezogene Mandate, explizite Sichtversionen, unveränderliche Vertragsversionen/Zustimmungen, geprüfte Punktebelege, eindeutige Ansprüche und eine vollständige Familienhistorie.

Die zwei größten technischen Lücken sind die bisher nur clientgemeldete Leistung und die nicht transaktionale Mehrdateispeicherung. Beide dürfen bei einer Umsetzung nicht hinter einer funktionierenden Oberfläche verborgen bleiben. Ohne Lösung dieser Lücken kann die geforderte Manipulations- und Einmaligkeitsgarantie nicht seriös zugesagt werden.

**Nächster Schritt ist ausschließlich die Freigabe der offenen Entscheidungen und des daraus konkretisierten Änderungsumfangs — nicht die automatische Implementierung.**
