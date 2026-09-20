# GCS-CMS — Anforderungen, Architektur und Umsetzungsplan

Status: Überarbeiteter Plan zur schrittweisen Abstimmung und Umsetzung.
Diese Überarbeitung betrifft ausschließlich die Planung, nicht die Implementierung.

## 1. Zielbild und Verbindlichkeit

Ein modernes, übersichtliches, praktisches CMS für viele GCS-Spiele und
Internet-Multiplayer. Fachliche Abläufe werden durchgängig als GCS-Komponenten,
Properties, Events, Tasks und Actions beschrieben. Entwickler sollen sowohl
das Verhalten als auch die notwendigen Sicherheits- und Fehlerschritte verstehen.

### 1.1 Status von Anforderungen

- **Beschlossen**: ausdrücklich vom Nutzer bestätigte fachliche Anforderungen.
- **Vorgeschlagen**: empfohlene Architektur, Funktion oder Umsetzung; noch keine
  Freigabe, bestehende Funktionen zu ändern.
- **Offen**: Entscheidung erforderlich; mit Entscheidungszeitpunkt in §11.
- Aussagen über vorhandene Implementierung sind in Phase 0 am Code zu prüfen.
  Dieser Plan ist kein Nachweis, dass eine Schutzmaßnahme bereits funktioniert.

### 1.2 Beschlossene Leitplanken

- Wartbare, erweiterbare Software nach dem GCS-Komponenten-Prinzip, auch serverseitig.
- Eltern sehen das aktuelle Spiel, die Spielzeit und gegebenenfalls Bewertungen
  ausschließlich ihrer zugeordneten Kinder; sie können Zeitlimits festlegen.
- Spiele können Bewertungen melden, müssen dies aber nicht. Gespeicherte
  Bewertungen sind ausschließlich den Eltern des jeweiligen Kindes zugänglich.
- Rollen sind kombinierbar, insbesondere HouseAdmin und Elternteil.
- Der HouseAdmin entscheidet in v1 über die Aufnahme von Kindern und Eltern.
- Erzieher und RaumAdmin bilden in v1 eine Rolle; spätere Trennung bleibt möglich.
- Beobachter erhalten einen eigenen Login.
- Internet-Multiplayer bleibt in v1 innerhalb eines Hauses. Hausübergreifende
  Wettkämpfe sollen später ohne Aufweichen der grundsätzlichen Trennung möglich sein.
- Versionierte Datenmigration und umfangreiche synthetische Testdaten für alle Rollen.
- Bestehende Spiele, öffentliche Einstiegspunkte und GCS-Verhalten bleiben kompatibel.

### 1.3 Arbeitsweise

Vor Änderungen an Funktionen werden Lösung, Auswirkungen und Tests vorgestellt
und freigegeben. Build- und Startbefehle führt der Nutzer selbst aus, sofern er
nicht ausdrücklich etwas anderes beauftragt. Keine automatische Änderung des
Startverhaltens und keine automatische Übernahme von Testdaten in Bestandsdaten.

Die folgenden technischen Zielregeln und Phasen sind Vorschläge. Ihre Aufnahme
in diesen Plan ist keine pauschale Implementierungsfreigabe.

## 2. Berechtigungen: Identität, Rolle und Beziehung

### 2.1 Keine automatische Rechtehierarchie

SuperAdmin, HouseAdmin und RaumAdmin sind Verwaltungszuständigkeiten, keine
Vererbungsleiter zu privaten Elternrechten. Eine höhere Verwaltungsrolle
verleiht insbesondere keinen Zugriff auf Bewertungen anderer Kinder.

Das vorgeschlagene Modell trennt:

| Konzept | Zweck | Beispiel |
|---|---|---|
| Identität | Wer ist angemeldet? | Ein Benutzerkonto |
| Mitgliedschaft | Zu welchem Haus/Raum gehört die Person? | Kind in Haus A, Raum 1 |
| Rollenzuweisung | Welche Fähigkeiten gelten in welchem Bereich? | HouseAdmin für Haus A |
| Eltern-Kind-Beziehung | Welche privaten Kinderdaten sind zugänglich? | Bestätigte Zuordnung zu Kind X |

Rollen kombinieren registrierte Fähigkeiten. Neue Kombinationen erfordern
keinen neuen Rollentyp im Code; neue Fähigkeiten selbst benötigen weiterhin
Implementierung, Schema, Rechteprüfung und Tests. Standard ist Verweigerung.

### 2.2 Rollen und Sichtbarkeit

| Rolle | Fachlicher Bereich | Zugriff auf gespeicherte Bewertungen |
|---|---|---|
| Kind/Spieler | Freigegebene Spiele, eigenes Profil | Kein CMS-Lesezugriff; unmittelbares Spielfeedback ist davon getrennt |
| Elternteil | Aktivität eigener Kinder, Spielzeit, Zeitlimits | Nur bei gültiger Eltern-Kind-Zuordnung |
| Beobachter | Read-only mit eigenem Login; genauer Beobachtungsumfang noch offen | Nein |
| RaumAdmin / Erzieher | Räume und Spielfreigaben im zugewiesenen Bereich | Nein, außer unabhängig davon als Elternteil des Kindes |
| HouseAdmin | Hausverwaltung, Aufnahme von Kindern und Eltern, Zuständigkeiten | Nein, außer unabhängig davon als Elternteil des Kindes |
| SuperAdmin | Plattformverwaltung und freigegebene Betriebsinformationen | Nein, außer unabhängig davon als Elternteil des Kindes |

Eltern erhalten durch ihre Elternrolle keine Sicht auf fremde Kinder.

**Beschlossen (E01):** Zwei klar getrennte Ansichten:

- **RaumAdmin**: Anzeigename/Alias, aktuelles Spiel und Verbindungsstatus der
  Teilnehmer in seinen zugewiesenen Räumen.
- **Beobachter**: standardmäßig nur zusammengefasste Informationen
  („8 Teilnehmer verbunden, 5 spielen"). Personenbezogene Liveansicht nur bei
  ausdrücklich zugewiesener Berechtigung für einen bestimmten Raum.
- **Eltern**: aktuelles Spiel, Spielzeit und gespeicherte Bewertungen
  ausschließlich ihrer zugeordneten Kinder.
- Keine privaten Zeitverläufe oder Bewertungen durch Verwaltungsrollen.
- Eine Person mit mehreren Rollen wechselt sichtbar zwischen den Kontexten
  („Raum verwalten" / „Meine Kinder").

Die Prüfung gilt für HTTP, WebSockets, Exporte, Berichte, Suchergebnisse und
Diagnoseoberflächen. Unzulässige Felder werden serverseitig entfernt, nicht
lediglich im Client versteckt. Änderungen an Rechten wirken auch auf bestehende
Sitzungen und Abonnements; eine beim Login kopierte Rolle reicht nicht aus.

### 2.3 Aufnahme und Elternzuordnung

Beschlossen: Der HouseAdmin entscheidet über die Aufnahme von Kind und Eltern.

**Beschlossen (E02):** Verfahren mit zwei Bestätigungen:

1. Der HouseAdmin prüft die Zuordnung anhand eines außerhalb des CMS bekannten
   Kontakts und erstellt eine Einladung.
2. Der eingeladene Elternteil richtet seinen Zugang ein und bestätigt die Zuordnung.
   Ein angenommener Einladungslink allein beweist keine Erziehungsberechtigung —
   die organisatorische Prüfung bleibt erforderlich.
3. Ein HouseAdmin darf seine eigene Eltern-Kind-Zuordnung **nicht selbst freigeben**;
   dafür braucht es einen zweiten zuständigen Verantwortlichen. Beim ersten Haus
   übernimmt das eine ausdrücklich benannte Vertrauensperson; eine höhere Rolle
   allein ermöglicht keine beliebige Selbstzuordnung.
4. Bestehende Elternteile werden über neue Zuordnungen und Änderungen informiert.
   Bei strittiger Zuordnung wird der betroffene Zugang bis zur Klärung gesperrt.
5. Beim Widerruf private Zugriffe und laufende Abonnements entziehen.

Der HouseAdmin vergibt keine dauerhaft bekannten Elternpasswörter — eine
zeitlich begrenzte Einladung zur Zugangseinrichtung (E05).

Anwendungsberechtigungen schützen nicht automatisch vor dem Betreiber mit
Datenbankzugriff. Betreiberrechte, Supportzugriff und Schutz gespeicherter Daten
sind ausdrücklich Teil des Bedrohungsmodells.

## 3. Funktionen und Bedienbarkeit

### 3.1 Anmeldung und Sitzungen

**Beschlossen (E05):** Zugangsmodell je Nutzergruppe:

| Nutzergruppe | Zugang für v1 |
|---|---|
| Kinder auf gemeinsam genutzten Geräten | Erwachsener gibt das Gerät zeitlich begrenzt für ein Haus frei; danach kindgerechte Emoji-Anmeldung |
| Kinder zu Hause | Elternteil autorisiert den Zugang/das Gerät; danach Emoji-Auswahl |
| Eltern | Persönliche Einladung, eigener Zugang, sichere Wiederherstellung |
| Verwaltungsrollen | Eigener Zugang mit verpflichtender Mehrfaktor-Authentifizierung |

- Gerätefreigaben müssen sichtbar, widerrufbar und befristet sein. Ein
  öffentlicher Hausname plus kurzer Emoji-Code reicht als Internetzugang nicht aus.
- Wiederherstellung über einmaligen, kurz gültigen Wiederherstellungslink/
  Einrichtungscode — kein Passwort-Reset auf einen Standardwert.
- Für privilegierte Konten ist MFA Pflicht; Wiederherstellung und Austausch des
  zweiten Faktors müssen ebenfalls abgesichert sein (OWASP MFA Cheat Sheet).

Anmeldesitzungen und Spielsitzungen sind getrennt. Laufzeiten, Logout, Gerätewechsel,
Rollenänderung und Sperrung haben definierte Auswirkungen auf beide.

### 3.2 Elternansicht, Bewertungen und Berichte

- Aktuelles Spiel, Verbindungsstatus und Spielzeit eigener Kinder anzeigen.
- Optionale Bewertungen mit verständlicher Metrik, Einheit und Spielversion anzeigen.
- Fehlende Bewertungen bedeuten „keine Meldung“, nicht null Punkte oder Misserfolg.
- Keine raumweite Bewertungsübersicht für Erzieher, Beobachter oder Administratoren.
- Export privater Daten nur nach derselben Beziehungsprüfung wie bei der Anzeige.
- Berichte verschiedener Spiele nur bei fachlich vergleichbaren Metriken zusammenfassen.

**Beschlossen (E07):** Verständliche Einzelwerte statt Gesamtnoten:

- bearbeitete Aufgaben,
- richtige Antworten,
- verwendete Hilfen,
- abgeschlossene Runde.

Beispiel: „8 von 10 Aufgaben richtig, 2 Hilfen verwendet." Keine automatisch
abgeleitete Schulnote, kein pauschaler Gesamtwert über verschiedene Spiele.
Jede Metrik erhält eine stabile Kennung, eine Beschreibung und eine Version.
Das CMS unterscheidet „vom Spiel gemeldet" und „serverseitig geprüft".

Das Bewertungsformat wird versioniert. Meldungsfelder: Ereignis-ID,
Formatversion, Metrik-Kennung, Wert, optionale Einheit. Kind, Spielversion, Haus
und Empfangszeit leitet der Server aus der autorisierten Spielsitzung ab —
Clientangaben zu Identität und Zeit sind keine vertrauenswürdige Quelle.
Wiederholte Meldungen dürfen keine doppelten Bewertungen erzeugen.
Für spätere Wettkämpfe sind eigene Regeln zur Ergebnisprüfung erforderlich.
Freitext wird nur bei begründetem Bedarf und mit klaren Grenzen zugelassen.

### 3.3 Spielzeit und Zeitlimits

**Beschlossen (E06):** In v1 nur Tagesbudget und erlaubte Zeitfenster.
Regelwerk:

- Ein gemeinsames Budget pro Kind über alle Geräte und Häuser.
- Höchstens eine aktive Spielsitzung pro Kind.
- Die Galerie zählt nicht als Spielzeit.
- Eine laufende Partie zählt; eine echte, bestätigte Spielpause zählt nicht.
- Ein Hintergrund-Tab zählt weiter, solange das Spiel nicht tatsächlich pausiert.
- Warnungen 5 Minuten und 1 Minute vor Budgetende (konfigurierbare Werte).
- Danach keine neue Runde; höchstens 2 Minuten Abschlusszeit für die laufende
  Runde — Spiele ohne Rundensignal erhalten ebenfalls diese Abschlusszeit.
- Bei Verbindungsverlust wird der Status „unbekannt" statt „beendet" angezeigt;
  Online-Spiele erhalten nur eine kurze, begrenzte Fortsetzungsfrist.
- Mehrere Eltern: Verschärfungen wirken sofort; Lockerungen benötigen die
  Zustimmung der anderen berechtigten Elternteile. Ohne Einigung bleibt die
  strengere Einstellung bestehen.
- Hausvorgaben können das Elternbudget einschränken, nicht erweitern.
- Die Zeitzone des Budgets gehört zum Kinderprofil; Gerätewechsel erzeugt
  keinen neuen Tag.

Der Server entscheidet über Starts und verbucht Zeit konkurrenzsicher.
Heartbeats und zeitlich begrenzte Sitzungen erkennen fehlende Endmeldungen;
Browser-Schließen allein ist kein zuverlässiges Sitzungsende. Anwesenheit ist
kein sicherer Nachweis tatsächlicher Aufmerksamkeit.

Eine bereits geladene, vollständig lokale Spielkopie lässt sich bei manipuliertem
oder offline betriebenem Client nicht zuverlässig aus der Ferne stoppen.
Online durchsetzbare Regeln und bewusst nicht unterstütztes Offlineverhalten
werden benannt, statt eine absolute Sperrgarantie zu versprechen.

### 3.4 Spielekatalog und Multiplayer

**Beschlossen (E11):** Drei getrennte Zuständigkeiten:

- **Eigentümer**: lädt eigene Spiele hoch und verwaltet ihre Versionen.
- **Plattformprüfung/Aufsicht**: prüft Zulässigkeit und kann jedes Spiel sperren
  — auch Spiele anderer Eigentümer entfernen.
- **HouseAdmin / berechtigter RaumAdmin**: entscheidet, welche veröffentlichten
  Spiele im eigenen Bereich genutzt werden dürfen.

Neue Versionen werden erneut geprüft; laufende Partien bleiben an ihre konkrete
Version gebunden. Bei kritischem Problem muss sofortige Sperrung möglich sein.
Für v1 ausgeschlossen: externe Werbung, offene Chats, beliebige Netzwerkzugriffe
und eigene Datenerfassung durch hochgeladene Spiele.

Weiterhin vorgeschlagen:

- Suche, Filter, Tags und Sammlungen; serverseitig begrenzte, paginierte Listen.
- Metadaten zu Lernziel, Sprache, Altersgruppe, Eingabearten und Spielerzahl.
- Versionierte Veröffentlichung: Entwurf → Prüfung → Freigabe → Rücknahme.
- Spielsitzung an konkrete Spiel-, Runtime- und Protokollversion binden.
- Wiederverwendbare Medien und geprüfte Pakete aus Projekt und Assets.
- Hausinterne Gruppenzuordnung, Lobby, Beitrittsrechte und Reconnect-Regeln.
- Zulässige Zustandsänderungen und Ergebnisse serverseitig prüfen; Synchronisations-
  und Autoritätsmodell der jeweiligen Spielart vor Multiplayer-Freigabe festlegen.

CMS-Räume und flüchtige Multiplayer-Lobbys sind unterschiedliche Objekte.
Eine Lobby-ID allein ist keine Beitrittsberechtigung. Bei jedem Beitritt und
Reconnect werden Mitgliedschaft, Freigabe und Sitzungsstatus geprüft.
Hausübergreifende Wettkämpfe benötigen später eine explizite Veranstaltung mit
Freigaben beider Häuser und minimalem Datenaustausch, keine globale Datenfreigabe.

### 3.5 Moderne Oberfläche und Gerätegrenzen

Vorgeschlagen: konsistentes Layout, eindeutiger Haus-/Rollenkontext, verständliche
Navigation, Suche und klare Rückmeldungen. Jede Ansicht berücksichtigt Laden,
leere Daten, Fehler, abgelaufene Sitzung und fehlende Berechtigung.

Touch, Tastatur, Fokusführung, verständliche Beschriftungen, ausreichende Kontraste
und Vergrößerung sind Abnahmekriterien; WCAG 2.2 AA ist ein vorgeschlagenes Ziel.
Dunkler Modus ist optional, nicht Voraussetzung für v1.

**Beschlossen (E10) — Pilot-Prüfumfang und Lastziele:**

- Geräte/Browser: Windows (Edge, Chrome), Android-Tablet (Chrome), iPad (Safari),
  Smartphone für Eltern-/Verwaltungsansichten; Touch- und Tastaturbedienung.
- Lasttestziel (Vorgabe, keine nachgewiesene Leistung): 10 Häuser, 1.000 Konten,
  100 gleichzeitig aktive Spieler, 20 parallele kleine Multiplayer-Partien.
- Normale CMS-Anfragen: im vereinbarten Testaufbau 95 % unter 1 Sekunde.
  Spielladezeit und Multiplayer-Reaktionszeit erhalten eigene Kriterien.

Spiellayout und Koordinatensystem bleiben Aufgabe der Runtime. Das CMS verwaltet
Kompatibilitätsangaben und zeigt bei ungeeigneten Eingabearten oder Runtime-Versionen
einen verständlichen Hinweis. Multiplayer überträgt logischen Spielzustand statt
gerätespezifischer Bildschirmkoordinaten.

## 4. Durchgängige GCS-Architektur

### 4.1 Verantwortungsgrenzen

Fachliche Abläufe werden im GCS sichtbar komponiert. Technische und
sicherheitskritische Garantien werden durch wiederverwendbare Komponenten umgesetzt.

| Ebene | Verantwortung |
|---|---|
| Client-Stages | Anzeige, Interaktion, lokale Eingabeprüfung und Request-Zustand |
| Server-Stages | Sichtbare fachliche Abläufe mit Erfolgs- und Fehlerpfaden |
| Server-Komponenten | Verbindliche Autorisierung, Validierung und fachliche Operationen |
| Technische Adapter | Persistenz, Kryptografie, Transport, Uhr und Dateispeicher |
| Spiel-Runtime | Spielablauf, Darstellung und begrenzte CMS-/Multiplayer-Schnittstelle |

Beispiel: Sitzung prüfen → Elternbeziehung prüfen → erlaubte Bewertungen lesen
→ freigegebene Felder antworten. Entfernt ein Entwickler versehentlich den
sichtbaren Prüfschritt, muss der geschützte Datenzugriff trotzdem verweigert werden.
Direkte ungeschützte Datenadapter dürfen nicht beliebig aus Workflows aufrufbar sein.

Keine allumfassende CMS-Komponente, die sämtliche Schritte verbirgt; ebenso keine
manuell zusammengesetzten Kryptografie- oder Datenbankoperationen aus Property-Actions.
Neue Komponenten wie Rollenprüfung, Bewertungsspeicher oder Audit werden erst nach
Abgleich mit vorhandenen Fähigkeiten spezifiziert. Namen im Plan sind keine Zusage,
dass diese Komponenten bereits existieren.

### 4.2 Fachliche Module und eine maßgebliche Quelle

Vorgeschlagene Modulgrenzen:

1. Anmeldung und Sitzungen
2. Häuser, Räume und Mitgliedschaften
3. Rollen und Eltern-Kind-Beziehungen
4. Spielekatalog, Medien und Freigaben
5. Spielaktivität und Zeitlimits
6. Bewertungen
7. Multiplayer-Zuordnung
8. Betrieb und Audit

**Beschlossen (E04):** Ein CMS-Projekt mit mehreren fachlich getrennten Stages:

- Jede Stage hat eine klar erkennbare Aufgabe.
- Blueprint enthält ausschließlich tatsächlich gemeinsam verwendete Elemente.
- Der Editor kann Stages nach Bereichen gruppieren (Anmeldung, Hausverwaltung,
  Elternbereich, …).
- Eine Veröffentlichung erzeugt einen versionierten, geprüften Stand; der
  laufende Server verwendet diesen veröffentlichten Stand, keine gerade
  bearbeitete Datei.
- Aufteilung in mehrere Quelldateien erst, wenn der Editor sie zuverlässig als
  ein zusammenhängendes Projekt bearbeiten kann.
- Die 1000-Zeilen-Grenze gilt für handgeschriebenen Programmcode. Für eine vom
  Editor gespeicherte Gesamt-JSON sind Referenzprüfung und fachliche Übersicht
  aussagekräftiger als die Zeilenzahl.

GCS-JSON bleibt die maßgebliche Projektdefinition; keine parallelen manuell
gepflegten Generator- und JSON-Wahrheiten.

### 4.3 Komponentenverträge und Zustände

Jede Komponente beschreibt Properties, Methoden, Events, Ein-/Ausgabeschemas,
Fehlercodes, Ausführungsort, Berechtigungen und Versionsverhalten. Dazu gehören
Inspector-/Flow-Unterstützung, passende Schemaeinträge und Feature-Map-Einträge.

- Stabile IDs; sprechende Namen sind Anzeige und Orientierung, keine wechselnden Schlüssel.
- Lokaler Zustand bleibt lokal. Nur tatsächlich gemeinsame Elemente gehören ins Blueprint.
- Server-Anfragekontexte sind je Anfrage isoliert; kein gemeinsam veränderlicher
  globaler Benutzer-/Token-/Antwortzustand zwischen parallelen Anfragen.
- Busy-Zustände haben definierte Enden bei Erfolg, Fehler, Timeout und Abbruch.
- Verspätete Antworten dürfen nach Stage-Wechsel keine falsche Ansicht überschreiben.
- Wiederholung mutierender Anfragen nur mit definierten Regeln gegen Doppelverarbeitung.
- Wiederverwendung erst nach Verhaltensvergleich, nicht durch blindes Entfernen von Wrappern.

### 4.4 Feature-Schablone als Lern- und Abnahmestruktur

```text
Feature-ID und fachliches Ziel
Status: beschlossen / vorgeschlagen / offen
Akteure, Geltungsbereich und Vorbedingungen
Client-Stage: Ereignis → Task → Actions → Darstellung
Server-Stage: Sitzung → Validierung → Berechtigung → Fachoperation → Antwort
Komponenten: Properties, Methoden, Events, Ausführungsort
Daten: gelesene/geänderte Felder, Transaktionsgrenze und Aufbewahrung
Fehler: ungültige Eingabe, Rechteentzug, Timeout, Wiederholung und Abbruch
Sicherheit: Vertrauensgrenzen, zulässige Antwortfelder und Audit-Ereignisse
Kompatibilität: Bestandsverhalten, Migration und Rückfallstrategie
Abnahme: positive Fälle, verbotene Fälle und überprüfbares Ergebnis
```

## 5. Sicherheits- und Datenschutzkonzept

### 5.1 Prüfbare Ziele statt pauschaler Sicherheitsgarantie

Vorgeschlagen: Bedrohungsmodell und geeignete OWASP-ASVS-Prüfanforderungen in
Phase 0 festlegen. Sicherheitsprüfung und Datenschutz begleiten jede Phase.
Ein abschließender Audit ersetzt keine sicheren Entwurfsentscheidungen.

| Bereich | Vorgeschlagene verbindliche Schutzanforderung |
|---|---|
| Anmeldung | Begrenzte Versuche über mehrere Dimensionen; Schutz vor Kontenermittlung und absichtlich ausgelösten Dauersperren |
| Erwachsenenzugänge | Bewährtes Passwort-Hashing, sichere Wiederherstellung; MFA für privilegierte Konten |
| Sitzungen | TLS/WSS, sichere Cookieattribute bei Cookies, Rotation und Widerruf; keine Zugangsdaten in URLs |
| Autorisierung | Verweigerung als Standard; Haus-/Raumgrenzen und Elternbeziehungen serverseitig prüfen |
| Browserzugriffe | Kontextgerechte Ausgabe, CSP, CSRF-Schutz für Cookie-Endpunkte, begrenztes CORS und geprüfte Origins |
| WebSockets | Authentifizierter Handshake, Origin-Prüfung, Berechtigung pro Operation, begrenzte Nachrichten und Verbindungen |
| Eingaben/Persistenz | Typisierte Schemas, parametrisierte Datenbankzugriffe und Grenzen für Größe, Tiefe und Laufzeit |
| Uploads/Assets | Inhaltsprüfung statt Vertrauen auf MIME-Angabe; sichere Dateipfade, Archivlimits, Quarantäne und Quotas |
| Ausführung/Netzwerk | Erlaubnislisten für Fähigkeiten, Netzwerkziele und Protokolle; Schutz vor SSRF und beliebiger Codeausführung |
| Betrieb | Vertrauenswürdige Proxy-/Hostkonfiguration, Updates, Abhängigkeitsprüfung, minimale Dienstrechte und Vorfallsverfahren |
| Diagnose | Keine Tokens, Passwörter oder Bewertungsinhalte in Logs; geschützte Traces und begrenzte Aufbewahrung |

### 5.2 Spiele-Uploads sind eine Vertrauensgrenze

Ein GCS-Spiel beschreibt Verhalten, nicht nur Daten. Deshalb gelten zusätzlich:

- CMS-Server-Workflows stammen ausschließlich aus vertrauenswürdiger Veröffentlichung.
- Server-Stages aus Spiele-Uploads werden nicht in den CMS-Server übernommen.
- Erlaubte Spielkomponenten, Actions, Ausdrücke und Netzwerkfähigkeiten werden geprüft.
- Message-Bridge prüft Senderfenster, Origin, Nachrichtenformat und Sitzung;
  keine unbeschränkte Weiterleitung von Methoden oder beliebigen Nachrichten.
- Ein Spiel erhält niemals Eltern-/Adminzugangsdaten, sondern nur kurzlebige,
  zweckgebundene Spielberechtigungen mit minimalem Umfang.
- Veröffentlichung, Rücknahme und Sperrung kompromittierter Versionen sind nachvollziehbar.

**Beschlossen (E08):** Spiele laufen auf einer getrennten Browser-Origin und
erhalten weder die Eltern-/Adminsitzung noch direkten Zugriff auf deren Daten.
Der Startablauf bleibt im GCS sichtbar:

```text
Spiel auswählen → Sitzung und Freigabe prüfen → Spielversion festlegen
→ begrenzte Spielberechtigung ausstellen → Player starten
```

Das Spiel darf über eine eng begrenzte Schnittstelle senden (z.B. „Runde beendet",
„Bewertung melden"); Identität und Berechtigungen leitet das CMS aus der
Spielsitzung ab. Ein IFrame allein ist kein vollständiger Schutz — Origin,
Sandbox und erlaubte Nachrichten müssen zusammenpassen. Diese Absicherung wird
vor jeder weiteren Erweiterung ausführbarer Uploads vorgezogen.

### 5.3 Datenschutz und Audit

Für Datenarten werden Zweck, Zugriffsberechtigte und Aufbewahrungsdauer festgelegt.
Rechtsgrundlagen, gegebenenfalls Einwilligung, Verantwortlichkeiten und anwendbare
Datenschutzvorgaben sind vor dem Betrieb mit echten Kinderdaten zu klären —
die organisatorische Frage, wer Plattformbetreiber und wer für die jeweiligen
Daten verantwortlich ist, beantwortet eine HouseAdmin-Rolle nicht (E09).
Technische Maßnahmen allein sind kein Nachweis rechtlicher Konformität.

**Beschlossen (E09) — technische Startwerte für Aufbewahrung** (keine rechtlich
festgelegten Fristen; vor echten Kinderdaten anhand des Zwecks zu bestätigen):

| Datenart | Startvorschlag |
|---|---|
| Live-Präsenz | Nur aktueller Zustand; keine dauerhafte Bewegungs-/Klickhistorie |
| Einzelne Spielsitzungen | 30 Tage |
| Tageszusammenfassungen und Bewertungen | 90 Tage |
| Sicherheits- und Verwaltungsnachweise | 90 Tage, ohne Bewertungsinhalte |
| Rotierende Backups | 30 Tage |

Support erhält standardmäßig nur technische Diagnoseinformationen. Zugriff auf
private Inhalte benötigt einen gesonderten, befristeten und protokollierten
Prozess; Elternrechte werden dafür nicht künstlich vergeben.

Audit bedeutet vorgeschlagen: append-only aus Anwendungssicht, zugriffsbeschränkt
und gegen Manipulation abgesichert; nicht pauschal „unveränderbar“ gegenüber
Betreibern. Bewertungstexte und andere private Nutzdaten gehören nicht ins Audit.

Löschung umfasst Primärdaten, Exporte und Caches. Backups erhalten begrenzte
Aufbewahrung; nach Wiederherstellung werden zwischenzeitliche Löschungen erneut
angewendet. Ein pauschales sofortiges Umschreiben aller Backups ist kein belastbarer
Löschplan. Rechtmäßige Aufbewahrung und Datenminimierung sind zusammen zu betrachten.

Kein offener Chat und keine öffentlichen Ranglisten sind vorgeschlagene Nicht-Ziele.
Auch hausinterne Ranglisten werden nicht automatisch freigegeben: Sie könnten
private Leistungsbewertungen offenlegen und brauchen eine gesonderte Entscheidung.

## 6. Datenhaltung, Migration und Schnittstellen

### 6.1 Logisches Zielmodell

Diese Struktur ist ein Vorschlag, noch kein festgelegtes physisches Datenbankschema.

| Datenbereich | Inhalt |
|---|---|
| Konten und Personen | Identität, minimales Profil; Zugangsdaten getrennt von Anzeigeinformationen |
| Häuser, Räume, Mitgliedschaften | Mandantenzuordnung und zeitlich gültige Zugehörigkeit |
| Rollen und Zuweisungen | Fähigkeiten plus Haus-/Raumkontext; mehrere Rollen pro Person |
| Eltern-Kind-Beziehungen | Status, Gültigkeit und dokumentierter Bestätigungs-/Widerrufsprozess |
| Spiele, Versionen, Assets, Freigaben | Katalog und unverwechselbare veröffentlichte Versionen |
| Anmeldesitzungen | Ablauf, Widerruf und sicher verwahrte Sitzungsreferenzen |
| Spielsitzungen und Lobbys | Teilnehmer, Haus, Spielversion, Zustand und Verbindungsstatus |
| Spielzeit und Zeitlimits | Nachvollziehbare Zeitbuchung, Budgets und konkurrierende Änderungen |
| Bewertungen | Kind-/Sitzungszuordnung, Metrik, Formatversion und Vertrauensniveau |
| Einladungen | Begrenzter Zweck, Ablauf, Einmalnutzung und Widerruf |
| Audit und Betriebseinstellungen | Datensparsame Nachweise und mandantenspezifische Einstellungen |
| Migrationshistorie | Datenmodellversion, angewandte Schritte und Integritätsnachweise |

Hauszugehörigkeit und Referenzen werden beim Schreiben und Lesen geprüft.
Eindeutigkeit und Transaktionen sichern unter anderem Einmal-Einladungen,
Zeitbudgets, Rollenänderungen und doppelt gesendete Bewertungen.

### 6.2 Speicherentscheidung

**Beschlossen (E03):** v1 bleibt bei reinem JSON-Datenbestand. Die spätere
Einführung von SQLite wird jedoch **jetzt schon** vorbereitet:

- Alle Datenzugriffe laufen über eine Speicheradapter-Grenze — keine
  direkten `db.*`-Zugriffe in Workflows/Fachlogik.
- Atomare Speicherung, Schutz vor konkurrierenden Schreibzugriffen und die
  Grenzen der JSON-Lösung werden explizit nachgewiesen.
- Migration JSON → SQLite wird als späterer, geplanter Schritt vorgesehen.

Die Auswahl des späteren Speichers erfolgt anhand Betriebsmodell, Parallelität,
Backup, Deployment und Lastzielen (E10). Keine Datenbankdetails in fachlichen
GCS-Tasks.

### 6.3 Migration und Kompatibilität

- Bestandsmodell und Referenzen inventarisieren, vor Migration validieren.
- Versionierte, deterministische Schritte mit Sicherung, Probelauf und Ergebnisprüfung.
- Fehler führen weder zu halben Datenbeständen noch zu stiller Neuinitialisierung.
- Wiederanlauf und Wiederherstellung testen; Rückwärtsmigration nur, wenn verlustfrei möglich.
- Test-Seeding ausschließlich für ausdrücklich gewählte, isolierte Testdatenbestände.
- Projektformat, Datenmodell, API und Multiplayer-Protokoll separat versionieren.
- Neue API-Pfade allein sichern keine Kompatibilität: alte Verträge erhalten
  gegebenenfalls Adapter und einen ausdrücklich abgestimmten Ablöseprozess.
- Bestehende Spiele ohne neue Bewertungs-/Zeitmeldungen bleiben startbar;
  Grenzen neuer CMS-Funktionen werden sichtbar statt als Erfolg vorgetäuscht.

### 6.4 Prozess- und Betriebsgrenzen

CMS verwaltet Identitäten, Rechte, Freigaben und geschützte Daten. Der Spielserver
setzt autorisierte Spielsitzungen und Multiplayer-Regeln um. Die Service-zu-Service-
Kommunikation benötigt ebenfalls Authentifizierung und minimale Berechtigungen.

Ob beide Dienste getrennt oder gemeinsam betrieben werden, wird anhand der
Bestandsanalyse entschieden. Portnummern und ein automatischer gemeinsamer Start
sind keine fachlichen Anforderungen. Eine Änderung vorhandener Startbefehle
benötigt eigene Freigabe.

## 7. Testdaten und Qualitätssicherung

### 7.1 Umfangreiche Testdaten-Datei

Beschlossen ist eine synthetische Testdaten-Datei mit allen Rollen. Vorgeschlagener
Name: `cms-testdata.json`; Ablage und Loader werden in Phase 1 festgelegt.
Die Datei wird nicht im Rahmen dieser Planänderung erstellt.

Szenarien:

- Zwei Häuser mit jeweils Daten, damit Trennungsfehler sichtbar werden.
- SuperAdmin, HouseAdmin, RaumAdmin/Erzieher, Beobachter, Eltern und Kinder.
- HouseAdmin plus Elternrolle; eigenes und fremdes Kind im selben Haus.
- Eltern mit einem und mit mehreren Kindern; Kind mit mehreren Eltern.
- Mehrere Räume, gesperrte/ausgetretene Mitglieder und widerrufene Elternzuordnung.
- Spiele mit und ohne Bewertungen sowie ein hausinternes Multiplayer-Spiel.
- Neue, abgelaufene und bereits verwendete Einladungen.
- Aktive, pausierte, getrennte und beendete Spielsitzungen.
- Zeitbudgets verfügbar, fast verbraucht und erschöpft; Tageswechsel-Fälle.
- Bewertungen mit verschiedenen Metriken und wiederholt gesendete Ereignisse.

Stabile IDs und erwartete Sichtbarkeit je Testkonto machen Ergebnisse reproduzierbar.
Keine echten Kinderdaten oder produktiven Geheimnisse; Testzugänge sind nur in
der isolierten Testumgebung nutzbar. Fixtures wachsen mit dem Schema und dürfen
Bestandsdaten nicht implizit überschreiben.

### 7.2 Prüfebenen

1. Komponenten- und Schema-/Referenztests für Methoden, Events und ungültige Definitionen.
2. Autorisierungsmatrix: erlaubte und verbotene Kombinationen von Akteur und Ressource.
3. Integration über tatsächliche GCS-Tasks, Serverkomponenten und isolierten Speicher.
4. UI-End-to-End: Aufnahme, Einladung, Anmeldung, Spielstart, Elternansicht und Widerruf.
5. Konkurrenz-/Fehlerfälle: Doppelstart, Wiederholung, Timeout, Reconnect und Rechteentzug.
6. Kompatibilität: Editor, Standalone und Overlay; relevante Bestandsprojekte einschließlich
   Breakout, Memory, Snake und Tetris bei Änderungen an zentralen GCS-Komponenten.
7. Migration, Backup/Wiederherstellung, Löschung und Export.
8. Sicherheits-, Geräte-, Barrierefreiheits- und Lasttests gegen vereinbarte Ziele.

Vorhandene `test-cms-*`-Skripte werden auf Aussagekraft und Seiteneffekte geprüft,
bevor sie in die reguläre Suite aufgenommen werden. Tests laufen nicht gegen echte
Benutzerdaten. Bekannte Fehler werden möglichst vor dem Fix reproduziert.

## 8. Zeitliche Reihenfolge und Umsetzungstore

Die Reihenfolge ist abhängigkeitsgetrieben, kein Kalender- oder Aufwandversprechen.
Ein Phasenende bedeutet nachgewiesene Abnahme, nicht nur vorhandene Dateien.
Sicherheit, Datenschutz, Tests und Kompatibilität laufen in jeder Phase mit.
Keine neuen Features vorziehen, wenn deren Berechtigungs- oder Datenbasis fehlt.

### Phase 0 — Anforderungen, Bestand und Risiken

- P0.1: Features, Endpunkte, Datenflüsse und tatsächliche Schutzmaßnahmen inventarisieren.
- P0.2: Berechtigungsmatrix einschließlich Elternbeziehungen und Beobachterumfang abstimmen.
- P0.3: Bedrohungsmodell, Datenschutzrahmen, Betriebsmodell und messbare Lastziele festlegen.
- P0.4: Bestandsverhalten und vorhandene Tests als Kompatibilitätsbasis erfassen.
- P0.5: Modul-/Editor-Konzept, Speicheroptionen und Schnittstellenentwurf bewerten.

**Abnahme:** Anforderungen sind von Annahmen getrennt; priorisierte Risiken,
Entscheidungen und unverändert zu erhaltendes Verhalten sind nachvollziehbar.
Noch kein großflächiges Umbenennen oder Umbauen der Runtime.

### Phase 1 — Kleines, sicheres Fundament

Voraussetzung: die für das Fundament nötigen Entscheidungen aus Phase 0.

- P1.1: Speicheradapter, Zielmodellkern und getesteten Migrations-/Sicherungspfad schaffen.
- P1.2: Identitäten, kontextgebundene Rollen und Elternbeziehungen mit negativen Tests umsetzen.
- P1.3: Server-Anfrageisolation, Sitzungsprüfung, sichere Fehler und datensparsames Audit sichern.
- P1.4: GCS-Komponentenverträge und Modulkonzept an einem kleinen Ablauf nachweisen.
- P1.4a: **Spielstart-/Player-Isolation-Vertrag entwerfen (E08, vorgezogen)** —
  getrennte Origin, begrenzte Spielberechtigungen, Message-Whitelist; vor jeder
  weiteren Erweiterung ausführbarer Uploads.
- P1.5: Synthetische Testdatei mit allen Rollen und erster Sichtbarkeitsmatrix erstellen.
- P1.6: Grundlegenden Export-, Lösch- und Wiederherstellungspfad für die neuen Daten testen.
- P1.7: Speicheradapter-Grenze einführen (JSON jetzt, SQLite später — E03);
  Versionierter Veröffentlichungsstand für das CMS-Projekt (E04).

**Abnahme:** Mandanten-/Beziehungsgrenzen halten auch bei direktem API-Aufruf;
Migration und Restore sind geprüft; Testdaten können keine Bestandsdaten ersetzen.
Kein Vorratsbau sämtlicher denkbarer Komponenten: nur das nächste Feature ermöglichen.

### Phase 2 — Vollständiger Referenzablauf und erste nutzbare Oberfläche

Voraussetzung: abgesichertes Fundament und entschiedenes Eltern-Bestätigungsverfahren.

- P2.1: HouseAdmin nimmt Kind auf, ordnet Raum zu und lädt Eltern ein.
- P2.2: Eltern melden sich an und sehen ausschließlich ihre zugeordneten Kinder.
- P2.3: Rollen-/Hauskontext, Navigation und gemeinsame UI-Zustände praktisch erproben.
- P2.4: Beobachterlogin und ausdrücklich erlaubte Read-only-Sicht implementieren.
- P2.5: Widerruf, fremde IDs, fremdes Haus und Mehrfachrollen vollständig durchtesten.

**Abnahme:** Ein fachliches Feature funktioniert durch alle Schichten und ist im
GCS-Flow nachvollziehbar. Noch fehlende Live-Daten werden als nicht verfügbar
angezeigt, nicht simuliert. Die Feature-Schablone ist als Muster verwendbar.

### Phase 3 — Spielaktivität, Bewertungen und Zeitlimits

Voraussetzung: verlässliche Beziehungen; abgestimmte Zeitregeln sowie freigegebener
Entwurf für Spielstartvertrag und Player-Isolation. Die minimale Bindung an
Spielversionen wird hier benötigt, nicht erst beim späteren Ausbau des Katalogs.

- P3.1: Player-Isolation, sicheren Spielstart und begrenzte Spielberechtigungen für
  vertrauenswürdige, eindeutig versionierte Referenzspiele umsetzen und prüfen.
- P3.2: Spielsitzungszustände, Heartbeats und konkurrenzsichere Zeitbuchung ergänzen.
- P3.3: Eltern-Liveansicht mit Verbindungsstatus und nachvollziehbarer Spielzeit.
- P3.4: Optionale versionierte Bewertungsmeldung an einem Referenzspiel demonstrieren.
- P3.5: Zeitbudget, Vorwarnung und vereinbartes Ablaufverhalten durchsetzen.
- P3.6: Mehrgerätebetrieb, doppelte Meldungen, Unterbrechung und Rechtewiderruf prüfen.

**Abnahme:** Nur Eltern des Kindes lesen gespeicherte Bewertungen; Zeit wird nach
den vereinbarten Regeln verbucht. Spiele ohne Bewertungsfunktion bleiben nutzbar.
Online-/Offlinegrenzen und Genauigkeit der Aktivitätsanzeige sind verständlich.

### Phase 4 — Katalogausbau und hausinterner Multiplayer

Voraussetzung: geschützte Spielsitzungen, Versionen und vertrauenswürdige Veröffentlichung.

- P4.1: Katalogsuche, Metadaten, Versionierung und Freigabe-/Rücknahmeprozess ausbauen.
- P4.2: Uploadprüfung, Medienbibliothek und Paketimport/-export schrittweise ergänzen.
- P4.3: Gruppen, Lobby-Beitritt, Synchronisation, Reconnect und Ende einer Partie umsetzen.
- P4.4: Zeitlimits und Abbruchregeln mit mehreren Teilnehmern integrieren.
- P4.5: Ein kooperatives Mathe-Referenzspiel über unterschiedliche Geräte prüfen.

**Abnahme:** Keine hausfremden Teilnehmer; gleiche freigegebene Spielversion;
plausibles Verhalten bei Verbindungsabbruch, Versionsrücknahme und Zeitlimit.
Nicht jede Bibliothekskomfortfunktion muss den Multiplayer-Nachweis blockieren;
die Sicherheits- und Versionsverträge sind jedoch zwingende Voraussetzungen.

### Phase 5 — Freigabe für den Betrieb

Voraussetzung: die für den vereinbarten v1-Umfang vorgesehenen Abläufe sind abgenommen.

- P5.1: Sicherheitsprüfung und Datenschutzkontrolle gegen Anforderungen abschließen.
- P5.2: Last-, Geräte- und Barrierefreiheitstests mit vereinbarten Grenzwerten durchführen.
- P5.3: Backup-Restore, Migration, Löschwiederholung und Ausfallszenarien gemeinsam erproben.
- P5.4: Datensparsames Betriebsdashboard, Warnungen, Update- und Vorfallsabläufe prüfen.
- P5.5: Kontrollierten Pilotbetrieb erst nach Freigabe der Schutzanforderungen durchführen.

**Abnahme:** Keine offenen freigabeblockierenden Risiken; Betrieb und Wiederherstellung
sind nachgewiesen. Sicherheitsfunktionen werden hier überprüft, nicht erstmals gebaut.
Vor Einsatz echter Kinderdaten müssen die jeweils notwendigen rechtlichen und
technischen Schutzanforderungen bereits erfüllt sein.

### Spätere Ausbaustufe — Hausübergreifende Wettkämpfe

Explizite Freigaben beider Häuser, Veranstaltungskontext, minimale Teilnehmerdaten,
verifizierbare Ergebnisse und Widerruf. Kein automatisches Zusammenlegen von Häusern,
Elternrechten oder privaten Fortschrittsdaten. Eigene Bedrohungs- und Datenschutzprüfung.

## 9. Definition of Done pro Feature

- Fachlicher Ablauf und alle notwendigen Entscheidungen sind freigegeben.
- GCS-Flow zeigt Erfolg und Fehler; Komponentenverträge und Referenzen sind validiert.
- Berechtigungsprüfung einschließlich negativer Tests und Feldsichtbarkeit besteht.
- Konkurrenz, Wiederholung, Abbruch und Timeout haben definiertes Verhalten.
- Bestehende APIs und Spiele sind kompatibel oder erhalten einen freigegebenen Übergang.
- Migration, Audit, Löschung und Export sind für neu eingeführte Daten berücksichtigt.
- Bedienbarkeit und betroffene Gerätepfade sind geprüft.
- Projektkonforme Tests und QA-Nachweise liegen vor; ausstehende Prüfungen sind benannt.
- Build-/Startschritte für den Nutzer sind angegeben, nicht ungefragt ausgeführt.

## 10. Umfang und bewusste Zurückstellung

Beschlossen zurückgestellt: hausübergreifendes Spielen bis zu einer späteren Version.

Vorgeschlagen für v1 nicht einzuplanen: offener Chat, öffentliche Ranglisten,
Abrechnung, allgemeines Turniersystem und uneingeschränkte Drittanbieter-Plugins.
Hausinterne Ranglisten, Dark Mode, automatische Empfehlungen und umfangreiche
Benachrichtigungen sind optionale Erweiterungen, keine Voraussetzungen des Fundaments.

Versionierung, Freigabe, Medien und Pakete bleiben im Zielumfang, werden aber
inkrementell aufgebaut. Eine Komfortfunktion darf nicht zulasten von Zugriffsschutz,
Kompatibilität oder Verständlichkeit vorgezogen werden.

## 11. Entscheidungen

**Beschlossen** (alle E-Fragen beantwortet; Details in den genannten Abschnitten):

| ID | Beschluss | Umsetzungszeitpunkt | Verbleibende Restdetails |
|---|---|---|---|
| E01 | RaumAdmin: Name/Alias + aktuelles Spiel + Verbindungsstatus eigener Räume. Beobachter: aggregiert; personenbezogen nur bei ausdrücklicher Raum-Berechtigung. Rollenkontexte sichtbar getrennt | §2.2 — Phase 1 | — |
| E02 | Zwei-Bestätigungs-Verfahren: HouseAdmin prüft organisatorisch + erstellt Einladung; Elternteil bestätigt. Keine Selbstfreigabe; erstes Haus über benannte Vertrauensperson. Strittige Zuordnung → Zugang gesperrt | §2.3 — Phase 1 | Wer ist „zweiter Verantwortlicher" im Regelbetrieb |
| E03 | v1 bleibt bei reinem JSON; Speicheradapter-Grenze und spätere SQLite-Option werden jetzt schon vorbereitet | §6.2 — Phase 1 | Zeitpunkt des SQLite-Wechsels |
| E04 | Ein CMS-Projekt, fachlich getrennte Stages, Editor-Gruppierung, versionierter veröffentlichter Stand; kein Multi-Datei-Split bis Editor-Reife. 1000-Zeilen-Grenze gilt nicht für gespeicherte Gesamt-JSON | §4.2 — Phase 1 | Editor-Umbau für Stage-Gruppierung + Publish-Stand |
| E05 | Gerätefreigabe für Kinder (Erwachsener/Eltern autorisiert, befristet, widerrufbar); Eltern: Einladung + eigener Zugang + Link-Wiederherstellung; Verwaltung: MFA-Pflicht | §3.1 — Phase 1 | MFA-Verfahren wählen (TOTP etc.) |
| E06 | Tagesbudget + Zeitfenster; gemeinsames Budget pro Kind, max. 1 aktive Sitzung; Warnungen 5/1 min; 2 min Abschlussfrist; Lockerung nur mit Zustimmung aller Elternteile; Hausvorgaben deckeln | §3.3 — Phase 3 | Minutenwerte sind konfigurierbare Vorschläge |
| E07 | Einzelmetriken (Aufgaben, richtig, Hilfen, Runde) mit Kennung + Version; keine Gesamtnote; „gemeldet" vs „serverseitig geprüft" | §3.2 — Phase 3 | Konkrete Metrikliste am Mathe-Referenzspiel |
| E08 | Getrennte Browser-Origin; sichtbarer Startablauf mit begrenzter Spielberechtigung; enge Nachrichtenschnittstelle. Vorgezogen vor jeder Upload-Erweiterung | §5.2 + P1.4a — Phase 1 (Vertrag) / Phase 3 (Umsetzung) | Technische Umsetzung der Origin-Trennung |
| E09 | Startwerte Aufbewahrung (30/90 Tage, siehe §5.3); Support nur Diagnosedaten, Inhalte nur über gesonderten protokollierten Prozess. Verantwortlichkeit organisatorisch klären | §5.3 — Phase 1 (Datenarten), vor echtem Betrieb | Rechtliche Prüfung der Fristen; Verantwortliche benennen |
| E10 | Pilotumfang: Win (Edge/Chrome), Android-Tablet, iPad, Smartphone; Lastziel 10 Häuser / 1.000 Konten / 100 aktive / 20 MP-Partien; 95 % < 1 s | §3.5 — Phase 0 gesetzt | Testaufbau und Messung in Phase 5 |
| E11 | Drei Zuständigkeiten getrennt (Eigentümer / Aufsicht kann alles sperren / Haus entscheidet Nutzung); Versionsbindung, Sofortsperre, v1 ohne Werbung/Chat/Netzwerk/Datenerfassung | §3.4 — Phase 1 (Zuständigkeiten) / Phase 4 (Prozess) | — |

Priorität des Beschlusses: Pilotumfang und Betrieb → Rechte und Elternzuordnung →
parallel Spielstart-/Upload-Isolation absichern → Komfortfunktionen später.

Verbleibende Restdetails werden bei Erreichen des jeweiligen Zeitpunkts eingeholt;
keine davon blockiert den Start von Phase 1.
