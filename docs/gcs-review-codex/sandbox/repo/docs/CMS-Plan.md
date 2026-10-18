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
- P4.3: Gruppen, Lobby-Beitritt, Synchronisation, Reconnect und Ende einer Partie umsetzen. — **umgesetzt**: `TServerParty` (`cms-mp.cjs`, `stage_server_mp`), Schema v3 mit `parties`-Collection, Polling-Synchronisation über sequenzierten Aktionslog.
- P4.4: Zeitlimits und Abbruchregeln mit mehreren Teilnehmern integrieren. — **umgesetzt**: jedes Mitglied spielt über eine eigene `TServerPlaySession`; Budget/Grace gelten pro Kind; `state` meldet Verbindungsstatus aller Mitglieder.
- P4.5: Ein kooperatives Mathe-Referenzspiel über unterschiedliche Geräte prüfen. — **umgesetzt**: `ZahlenDuell.json` (kooperatives Kopfrechnen, Team-Punktzahl, Gastgeber sendet Aufgaben über den Aktionslog); Synchronisation über `/api/cms/party` mit Launch-Schlüssel statt Spieler-Token; E2E-Nachweis mit zwei Sitzungen in `test-cms-mp.cjs`.

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

## 12. Detailplan: feste Rollen- und Mandantenszenarien

**Status: geplant, nicht implementiert.** Dieser Abschnitt ist ein eigenständig
abarbeitbarer Arbeitsauftrag. Die Erstellung des Plans erlaubt noch keine
Änderung bestehender Funktionen. Jeden Umsetzungsschritt separat freigeben lassen.

### 12.1 Ziel, Grenzen und Arbeitsregeln

Ziel ist ein dauerhafter fachlicher Testvertrag: Für benannte Personen mit festen
Rollen und Bereichen werden erlaubte UND verbotene Abläufe nachgewiesen.
Technische Einzeltests bleiben bestehen; Szenarien ergänzen sie, statt sie zu ersetzen.

1. Vor jedem Schritt dessen Voraussetzungen und betroffene Dateien lesen.
2. Änderungen bestehender Funktionen vorher mit dem Nutzer abstimmen.
3. Keine Produktivdaten lesen oder kopieren, um Testpersonen zu erzeugen.
4. Ausschließlich synthetische Daten in einem eigenen temporären Verzeichnis verwenden.
5. `game-server/data/cms-v1.json`, `cms-v2.json` und echte Zugangsdaten nicht verändern.
6. Keine fachlichen CMS-Abläufe in einen neuen CJS-Workflow verlagern.
7. Testhelfer dürfen Daten vorbereiten, HTTP/Browser bedienen und Ergebnisse prüfen.
8. `GCS-CMS.json` bleibt die fachliche Quelle. Änderungen daran sind separate Fehlerbehebungen.
9. Build und Serverstart führt der Nutzer aus. Auch isolierte Testserver nur nach
   ausdrücklicher Freigabe starten; diese Freigabe vor Integrationstests einholen.
10. Fehlgeschlagene Tests nicht durch Aufweichen der Erwartung grün machen.
11. Bei Abweichungen unterscheiden: Produktfehler, Fixturefehler, Testfehler oder offene Fachregel.
12. Keine Funktionen, Kommentare oder vorhandenen Tests ungefragt entfernen.
13. Dateien unter 1000 Zeilen halten; keine allgemeine Testplattform auf Vorrat bauen.
14. Keine Commits oder Pushes ohne Auftrag. Arbeitsänderungen anderer Personen erhalten.

### 12.2 Verifizierter Ausgangspunkt und erneut zu prüfende Dateien

Bei Erstellung dieses Plans wurden folgende Strukturen gelesen:

| Datei | Bekannter Ausgangspunkt | Vor Umsetzung kontrollieren |
|---|---|---|
| `scripts/cms/cms-seed-testdata.cjs` | Exportiert `buildDb(now)` und `TEST_PASSWORD`; enthält stabile IDs, Rollen, Guardians und `testMeta` | Aktuelles Schema, alle Verbraucher und Listenlängenannahmen |
| `scripts/cms/katalog-report.cjs` | `boot(port, patchDb)` erzeugt temporäre Daten; eigene `AUTH_USERS`-Liste | Lebenszyklus, Cookiehilfe und Neustartbereinigung |
| `scripts/start-testserver.cjs` | Verwendet separate Testdateien | Fehlende-Dateien-Pfad verwendet `require`, während Seed-Ausgabe unter `require.main === module` liegt; separat prüfen, nicht blind darauf vertrauen |
| `scripts/test-admin-login.cjs` | Vorhandener Login-Vertrag | Aktuelle Endpunkte, Rollenlandung und Mehrhausprüfungen lesen |
| `scripts/test-cms-login-session.cjs` | Vorhandene Sitzungsregression | Cookie-, Browser- und Rollenwechselprüfungen lesen |
| `scripts/test-cms-testdata.cjs` | Bestehende Fixturetests | Bekannte fachliche Konflikte von neuen Fehlern trennen |
| `scripts/test-katalog-2-houseadmin.cjs` | Bestehende HouseAdmin-Abnahme | Vorhandene Fälle wiederverwenden, keine doppelte Pflege |
| `docs/CMS-Testkatalog.md`, `docs/CMS-Testluecken.md` | Bestehende fachliche Nachweise | Szenario-IDs mit Testfällen verknüpfen |
| `DEVELOPER_GUIDELINES.md`, `docs/QA_Report.md`, `package.json` | Projektregeln und Testintegration | Aktuelle Pflichtprüfungen und tatsächliche Testbefehle lesen |

Wichtig: RaumAdmin ist im vorhandenen Seed `areaAdmin` auf einem Bereich vom Typ
`room`; HouseAdmin ist `areaAdmin` auf `house`. Keinen neuen Rollennamen `roomAdmin`
erfinden. Eine Elternberechtigung wird über eine bestätigte Guardian-Beziehung
modelliert, nicht durch eine erfundene Rolle `parent`.

### 12.3 Verbindlicher Umfang der Szenariomatrix

Die IDs unten sind geplante Testfall-IDs, keine neuen Produktivrollen.
Die genaue API-Antwort und der Statuscode werden in Schritt R0 festgelegt.

| ID | Ausgangslage | Erlaubter Ablauf | Verbot / Fehlernachweis |
|---|---|---|---|
| RS01 | Reiner RaumAdmin in Sonne/Spielraum | Login führt zu `stage_admin`; eigenen Raum verwalten | Kein Zugriff auf Sonne/Lernraum, Mond oder Haus-/SuperAdmin-Funktionen |
| RS02 | HouseAdmin nur für Sonne | Login führt zu `stage_house`; Sonne und dessen aktive Räume verwalten | Mond und dessen Räume weder lesen noch verändern |
| RS03 | HouseAdmin für Sonne UND Mond | Beide Häuser sehen, auswählen und bearbeiten | Kein Zugriff auf ein drittes aktives Haus ohne Rolle |
| RS04 | HouseAdmin Sonne sendet ausdrücklich IDs aus Mond | Eigene Kontrolloperation funktioniert | Fremde Haus-, Raum- und Personenreferenzen werden serverseitig abgewiesen |
| RS05 | HouseAdmin + bestätigter Elternteil | Verwaltung und eigene Elternsicht funktionieren | Verwaltungsrolle erweitert Elternsicht nicht auf fremde Kinder |
| RS06 | RaumAdmin + bestätigter Elternteil | Raumverwaltung und eigene Elternsicht funktionieren | Weder Hausverwaltung noch private Daten anderer Raumkinder |
| RS07 | Aktive Person, einzige Verwaltungsrolle inaktiv | Kein Verwaltungszugang | Vorhandene Credentials allein erlauben keinen Zugriff |
| RS08 | Aktive Hausrolle, Haus selbst inaktiv | Kein Zugriff auf dieses Haus oder seine Räume | Aktive Rolle überstimmt inaktiven Bereich nicht |
| RS09 | Person inaktiv, Rolle und Haus aktiv | Anmeldung wird abgewiesen | Auch bestehende Sitzung kann keine geschützte Operation mehr ausführen |
| RS10 | HouseAdmin für aktives und inaktives Haus | Aktives Haus bleibt nutzbar | Inaktives Haus bleibt gesperrt; kein vollständiger Rechteverlust für das aktive |
| RS11 | SuperAdmin als Kontrollkonto | Landung `stage_super`; SuperAdmin-Aktion funktioniert | Keine automatische private Elternsicht |
| RS12 | Keine Sitzung / abgelaufene Sitzung | Öffentliche Anmeldung erreichbar | Geschützte Daten und Änderungen bleiben gesperrt |
| RS13 | Bereits angemeldeter SuperAdmin; danach anderer Loginversuch | Bestehende Identität wird angezeigt; Abmelden möglich | Fehlgeschlagener neuer Login darf alte SuperAdmin-Sitzung nicht fortführen |
| RS14 | HouseAdmin in neuem Haus ohne Räume | Hausverwaltung zeigt leeren Zustand und Weg zum ersten Raum | Keine Landung in einer unbrauchbaren Raumverwaltung |
| RS15 | HouseAdmin Sonne + RaumAdmin in Mond/Spielraum | Je Bereich nur die dort erteilten Fähigkeiten | Raumrolle in Mond verleiht keine Hausverwaltung für Mond |
| RS16 | Laufende Sitzung, danach Zuständigkeit entzogen | Verbleibende gültige Rechte gelten weiter | Entzogene Zuständigkeit wirkt beim nächsten geschützten Request nicht mehr |

RS04 und RS08 sind ausdrücklich getrennt: Ein fremdes aktives Haus testet
Mandantentrennung; ein inaktives Haus testet Bereichssperrung. Das eine ersetzt
nicht das andere. RS03 benötigt deshalb ein drittes AKTIVES Kontrollhaus.

### 12.4 Form eines Szenariovertrags

Pro Szenario zentral und deklarativ hinterlegen:

- `id`, verständlicher Titel und fachliche Begründung.
- Referenz auf ein synthetisches Konto; Benutzername, niemals echte Zugangsdaten.
- Ausgangsrollen mit Bereichs-ID und Aktivstatus; bestätigte Beziehungen separat.
- Eigene und fremde Haus-/Raum-/Kind-IDs ausdrücklich benennen.
- Erwartete Loginentscheidung und Zielstage.
- Exakte erlaubte Haus-/Raummengen, soweit der betreffende Endpunkt diese liefert.
- Erlaubte Aktionen und negative Aktionen mit Ressource und erwarteter Antwort.
- Varianten für Rechteentzug oder Sitzung, getrennt vom unveränderten Ausgangsfall.
- Referenzen auf automatisierte Tests und manuelle Katalogpunkte.

Erwartungen müssen unabhängig von der Produktiv-Berechtigungsfunktion formuliert
sein. Nicht dieselbe Berechtigungsfunktion aufrufen, um Soll- und Istwerte zu bilden.
Keine erlaubten Mengen aus der Serverantwort ableiten. Mengen sortiert vergleichen,
nicht nur `includes(eigeneId)` prüfen: Zusätzliche fremde Einträge sind ein Fehler.

### 12.5 R0 — Bestand aufnehmen und fachlichen Vertrag bestätigen

**Voraussetzung:** Nur lesende Arbeit; noch keine Funktionsänderung.

- [ ] Git-Status aufnehmen; fremde Änderungen notieren und unverändert lassen.
- [ ] Dateien aus §12.2 sowie `docs/GCS_FEATURE_MAP.md` lesen.
- [ ] Nach `buildDb`, `AUTH_USERS`, `testMeta`, `boot` und Rollen-IDs suchen.
- [ ] Alle Testverbraucher mit fest erwarteten Personen-/Hauszahlen erfassen.
- [ ] Tatsächliche Endpunkte für Login, Kontexte, Haus-/Raumlisten und Änderungen ermitteln.
- [ ] Pro negativem Fall genauen Antwortvertrag notieren: Status UND Antwortinhalt.
- [ ] 401 für fehlende Sitzung von fehlender Zuständigkeit unterscheiden; bei fremden
      IDs gegebenenfalls vorhandene 404-Verbergung erhalten. Nicht pauschal 403 erfinden.
- [ ] Für RS05/06/15 Navigation bei mehreren Rollen und Kontextwechsel bestätigen lassen.
- [ ] Für RS16 klären, welche Rechte nach Entzug bleiben; nicht zwingend vollständigen
      Logout verlangen, wenn nur eine von mehreren Zuständigkeiten entfällt.
- [ ] Bekannte rote Tests vorab als Ausgangsbefund notieren, nicht als bestanden werten.

**Ergebnis:** Abgestimmte Matrix mit konkreten Endpunkten und Erwartungen.
**Abnahme:** Keine offene Fachregel wird stillschweigend durch Testcode entschieden.

### 12.6 R1 — Gemeinsame synthetische Fixtures und Konten festlegen

**Voraussetzung:** R0 abgeschlossen; Änderung von `buildDb` und betroffenen Helfern freigegeben.

- [ ] Bestehende IDs möglichst wiederverwenden: `teacher-sun`, `admin-sun`,
      `admin-parent`, `admin-moon`, `super-admin` und vorhandene Bereiche.
- [ ] Nur fehlende Konstellationen ergänzen: Zweihäuser-Admin, RaumAdmin-Elternteil,
      gemischte Haus-/Raumrolle, inaktive Person/Rolle und leeres Haus.
- [ ] Zusätzlich ein drittes aktives Haus für den Negativfall von RS03 bereitstellen.
- [ ] Neue Konten und Bereiche mit stabilen IDs benennen; niemals zufällige IDs als Sollwerte.
- [ ] Kontoliste an einer gemeinsamen Stelle bereitstellen; duplizierte `AUTH_USERS`
      erst nach Prüfung aller Verbraucher konsolidieren.
- [ ] Szenarioverträge bevorzugt in bestehendem `testMeta` ergänzen. Falls die Datei
      dadurch unübersichtlich wird, kleines separates Datenmodul vorschlagen und freigeben lassen.
- [ ] Für jeden Test einen frischen Datenbestand erzeugen; keine mutable globale Fixture teilen.
- [ ] Zeitabhängige Fälle mit explizitem `now` erstellen; keine ablaufenden festen Datumswerte.
- [ ] Test-Credentials ausschließlich im isolierten Testverzeichnis erzeugen.
- [ ] Bestehende Testfälle und ihre Ausgangsdaten nicht versehentlich fachlich verändern.

**Prüfung:** Schema validiert; alle referenzierten IDs existieren; erwartete Rollen
und Beziehungen stimmen exakt; wiederholter Aufbau mit gleichem `now` ist reproduzierbar.
**Abnahme:** Die vier Kernfälle RS01–RS05 sind aus benannten Fixtures herstellbar;
RS03 und RS04 haben garantiert aktive, fremde Kontrollressourcen.

### 12.7 R2 — Kleine gemeinsame Testhilfe bereitstellen

**Voraussetzung:** R1 abgeschlossen; betroffene Testhelfer zur Änderung freigegeben.

- [ ] Zuerst bestehende Hilfen in `katalog-report.cjs` wiederverwenden.
- [ ] Nur falls nötig `scripts/cms/cms-test-roles.cjs` als kleines Hilfsmodul ergänzen.
- [ ] `getScenario(id)` liefert den Vertrag; unbekannte ID muss klar fehlschlagen.
- [ ] Login über reale Anmeldeendpunkte ausführen, nicht Sessionobjekte direkt einsetzen.
- [ ] Cookies aus echten Antworten übernehmen; korrekten Origin für Requests verwenden.
- [ ] Browserlogin und HTTP-Login getrennt halten, statt einen komplexen Universalhelfer zu bauen.
- [ ] Mengenvergleich meldet fehlende und unerlaubte IDs mit Szenario-ID.
- [ ] Jeden Testkontext samt Server und Browser in `finally` schließen.
- [ ] Nach Neustart immer den tatsächlich aktuellen Server schließen.
- [ ] Temporäre Verzeichnisse nur entfernen, wenn sie vom jeweiligen Test erzeugt wurden.

**Prüfung:** Unbekanntes Szenario, absichtlich zusätzliche fremde ID und absichtlich
fehlende eigene ID lassen die Testhilfe zuverlässig fehlschlagen.
**Abnahme:** Kein Helfer implementiert die fachliche Berechtigungslogik erneut.

### 12.8 R3 — API-Verträge für Rollen und Mandanten testen

**Voraussetzung:** R2 abgeschlossen; isolierter Testserverstart ausdrücklich erlaubt.
**Zieldatei:** `scripts/test-cms-role-scenarios.cjs` oder passende vorhandene Tests;
Entscheidung nach R0 dokumentieren. Bestehende Tests nicht ersatzlos umziehen.

Für RS01–RS06, RS11, RS14 und RS15 jeweils:

1. Frische Fixture laden, über echtes Login anmelden.
2. Loginantwort, Sitzung und Zielstage prüfen.
3. Haus-/Raumlisten mit exakten erwarteten Mengen vergleichen.
4. Eine erlaubte Mutation ausführen und persistiertes Ergebnis kontrollieren.
5. Entsprechende Mutation mit fremder ID senden; Status und Fehlervertrag prüfen.
6. Fachliche Datensätze vor/nach Ablehnung vergleichen: keine unerlaubte Änderung.
7. Erwartete technische Auditänderungen separat bewerten, nicht pauschal gesamte Datei vergleichen.
8. Ohne Cookie dieselbe geschützte Anfrage senden und Ablehnung prüfen.

- [ ] Fremde Haus-ID, fremde Raum-ID und widersprüchliches Haus-/Raumpaar testen.
- [ ] Sofern Endpunkt verfügbar: fremde Personen-/Kind-ID im erlaubten Hauskontext testen.
- [ ] Private Kinderdaten für Mehrfachrollen nur über gültige Elternbeziehung prüfen.
- [ ] Positive Kontrollen verwenden: Eine komplett kaputte API darf nicht alle Negativtests bestehen.
- [ ] Antwortdaten auf unerlaubte Namen/IDs prüfen, nicht nur HTTP-Status.

**Abnahme:** Jede getestete Ressourcengrenze hat mindestens einen positiven und
negativen Nachweis; Fehler nennen Szenario, Aktion, Soll und Ist.

### 12.9 R4 — Inaktivität, Rollenentzug und gemeinsame Browser prüfen

**Voraussetzung:** R3 abgeschlossen; fachliche Sitzungsverträge aus R0 bestätigt.

- [ ] RS07: Rolle inaktiv, Person aktiv; Login/Verwaltungszugriff abgewiesen.
- [ ] RS08: Haus inaktiv, Rolle aktiv; Haus und untergeordnete Räume gesperrt.
- [ ] RS09: Person inaktiv; neuer Login und bereits bestehende Sitzung geprüft.
- [ ] RS10: Ein aktives Haus bleibt nutzbar, das andere bleibt gesperrt.
- [ ] RS12: Fehlende und tatsächlich abgelaufene Sitzung getrennt testen.
- [ ] Ablauf über vorhandene Uhr-/Session-Testmöglichkeit erzeugen; keine langen Sleeps.
- [ ] RS13: SuperAdmin anmelden, Loginseite öffnen, angezeigte Identität prüfen,
      fehlgeschlagenen Fremdlogin versuchen und danach SuperAdmin-API aufrufen: gesperrt.
- [ ] RS16: Einem Zweihäuser-Admin während laufender Sitzung eine Hausrolle entziehen;
      nächster Request auf dieses Haus scheitert, verbleibendes Haus bleibt nach Vertrag erreichbar.
- [ ] Rechteentzug möglichst über den realen Verwaltungsablauf auslösen, nicht nur
      eine JSON-Datei ändern, die der laufende Server möglicherweise nicht neu liest.
- [ ] Einladungs-/Resettests verknüpfen: alter Zugang bzw. alte Sitzung verhält sich
      gemäß freigegebenem Vertrag; neue Credentials werden tatsächlich zur Anmeldung benutzt.

**Abnahme:** Rechteänderungen werden ohne Browser-Neustart am nächsten geschützten
Request wirksam. Der konkrete Sitzungsvertrag ist dokumentiert, nicht geraten.

### 12.10 R5 — Echte Bedienwege und sichtbare Zustände testen

**Voraussetzung:** API-Verträge stehen; Browser-Teststart freigegeben.

- [ ] Pro unabhängigen Fall frischen Browserkontext verwenden; nur RS13 teilt ihn absichtlich.
- [ ] Loginformular wirklich bedienen und resultierende GCS-Stage prüfen.
- [ ] RS01 landet in Raumverwaltung, RS02/03/14 in Hausverwaltung, RS11 in SuperAdmin.
- [ ] RS03 zwischen Häusern wechseln: Tabellen, Auswahl und Formularwerte wechseln mit.
- [ ] Auswahl aus Haus A darf nach Wechsel nach B keine Aktion versehentlich auf A ausführen.
- [ ] RS14: Leerer Zustand ist verständlich; ersten Raum anlegen und in Liste wiederfinden.
- [ ] Direkte Navigation auf `/super` und `/house` mit unpassender Rolle prüfen.
- [ ] Rollenabhängige Navigation und sichtbare Identität kontrollieren.
- [ ] Echte DOM-Klicks verwenden. Direkter Aufruf von Runtime-Events allein beweist
      weder Klickbarkeit noch fehlende Überdeckung eines Buttons.
- [ ] Auf konkrete Antwort-/UI-Zustände warten; feste Sleeps nicht als Synchronisation verwenden.
- [ ] Fehler werden sichtbar; gesperrte Aktionen hinterlassen keine Erfolgsmeldung.
- [ ] Screenshot/visuelle Abnahme ergänzen: keine Überlagerung, abgeschnittenen Felder
      oder Elemente außerhalb des Rasters. Screenshot allein ist kein Autorisierungsnachweis.
- [ ] Standalone und Editor-Run getrennt als geprüft oder offen kennzeichnen.

**Abnahme:** Kernfälle sind über reale Bedienung reproduzierbar. Serverseitiger
Zugriffsschutz bleibt unabhängig von ausgeblendeten Buttons nachgewiesen.

### 12.11 R6 — Katalog, Regression und Abschluss

- [ ] Szenario-ID in Testnamen und vorhandenen Katalogpunkten ergänzen.
- [ ] `docs/CMS-Testluecken.md` nur dort schließen, wo ein ausführbarer Nachweis besteht.
- [ ] `docs/QA_Report.md` um Befehle, Ergebnisse, Ausgangsfehler und offene Punkte ergänzen.
- [ ] Tatsächliche Testintegration in `package.json` prüfen; neue Skripte nicht nur ablegen.
- [ ] Nach Freigabe gezielte Tests und Pflichtregression `npm run test` bzw.
      `run_tests.bat` ausführen; zusätzliche Katalogbefehle aus dem Repository ermitteln.
- [ ] Betroffene Suites wiederholt ausführen: keine Portlecks, Reihenfolgeabhängigkeit
      oder gegenseitig veränderten Fixtures.
- [ ] Git-Diff prüfen: ausschließlich beabsichtigte Änderungen, keine echten Daten,
      Zugangsdaten, temporären Dateien oder Screenshots unbeabsichtigt aufgenommen.
- [ ] Keine Produktivkorrektur als Teil einer Testanpassung verstecken: bei Fund
      reproduzierenden Test erhalten, separaten Lösungsvorschlag freigeben lassen.

**Gesamtabnahme:** RS01–RS16 sind entweder nachgewiesen oder ausdrücklich als offen
mit Ursache und nächstem Schritt ausgewiesen. Nicht ausgeführte Tests sind nicht grün.
Ein roter Ausgangsbefund bleibt sichtbar, auch wenn er nicht durch diese Arbeit entstand.

### 12.12 Übergabeprotokoll für jeden einzelnen Umsetzungsschritt

Nach jedem Schritt diese Angaben in der Arbeitsübergabe verwenden:

- Schritt-ID und Freigabe: Was war konkret erlaubt?
- Geänderte Dateien/Funktionen: Was wurde tatsächlich geändert?
- Szenarien: Welche RS-IDs sind jetzt zusätzlich abgedeckt?
- Prüfung: Exakter Befehl, Ergebnis, nicht ausgeführte Prüfungen.
- Abweichungen: Produktfehler, Testfehler oder offene Fachentscheidung?
- Nächster Schritt: Voraussetzungen und eventuell nötige Nutzerentscheidung.

### 12.13 Aktuelle Übergabe: Aufbau ab null und kleine KI-Arbeitspakete

**Vorrang vor der bisherigen Fixture-Reihenfolge:** Der fachliche Haupttest baut das
CMS ab genau einem SuperAdmin über echte Bedienwege auf. Maßgeblich ist jetzt
`CMS-Testkatalog.md`, Abschnitt „Aufbau ab null“, mit Aufgaben-IDs, Voraussetzungen
und Fehlerfortsetzung. R0–R6 bleiben Prüfdetails; Seed-Fixtures sind nur ergänzende
Einzelregression. Nicht sofort sämtliche Zusatzfixtures aus R1 implementieren.

| Paket | Exakter Auftrag | Erlaubter Umfang nach Freigabe / Abnahme |
|---|---|---|
| P0 | R0 lesen; Aufgaben-IDs vorhandenen Tests zuordnen; offene Bedienwege/Verträge nennen | Nur lesen und bestehende Dokumente aktualisieren; keine Codeänderung |
| P1 | Minimalbestand und isolierte Testumgebung für BASIS-01 vorbereiten | Testdaten-/Testhilfen; genau ein SuperAdmin, keine fachlichen Folgedaten; bestehende Seeds erhalten |
| P2 | Aufgabenresultate, Abhängigkeiten, Fortsetzung und stabile IDs implementieren | Teststeuerung/Reporter; mit künstlichen Aufgaben Erfolg, Assertionfehler, UI-Fehler, Blockade und unabhängige Fortsetzung nachweisen; Alt-Reporterzuordnung erhalten |
| P3 | BASIS-01 und HAUS-01 als echte Browseraktionen | Login, Leerzustand, Hausanlage und gespeichertes Ergebnis prüfen; keine weiteren Rollen vorziehen |
| P4 | ADMIN-01 bis ADMIN-03 | Person, Rolle, Einladung, Einlösung, neuer Kontext und Haus-Landung; jede Teilaufgabe separat bewerten |
| P5 | RAUM-01 bis RAUM-03, danach ERZ-01 | Räume und reiner RaumAdmin; Umbenennungsfehler blockiert keine unabhängige Aufgabe |
| P6 | Weitere Katalog-Aufgaben einzeln beauftragen | Je Auftrag genau eine Tabellen-ID samt nötiger Unterfälle; Abhängigkeiten vorher lesen, keine Komplettimplementierung |
| P7 | Vollständige Zuordnung Kapitel 0–8 und Gesamtlauf | Fehlende/manuelle Punkte offen ausweisen; Regression und QA-Nachweis, keine automatische Produktivkorrektur |

**Kopiervorlage für den nächsten Auftrag:** „Bearbeite ausschließlich Paket P0 aus
`docs/CMS-Plan.md` §12.13. Lies den Abschnitt Aufbau ab null in
`docs/CMS-Testkatalog.md`, `docs/CMS-Testluecken.md`, die Projektregeln und nur die
jeweils relevanten Testdateien. Ordne bestehende Prüfungen zu, benenne fehlende
Bedienwege und lege konkrete Änderungen für P1 vor. Keine Tests starten, keine
Produktivfunktionen ändern. Melde Ergebnis und offene Entscheidungen knapp.“

Für jedes spätere Paket zuerst Dateien/Funktionen und Prüfkommando vorschlagen und
freigeben lassen; isolierter Testserverstart benötigt ebenfalls Erlaubnis. Vorhandene
Hilfen wiederverwenden, kein neues Universalframework. Erwartungen nicht abschwächen,
keine Dateninjektion als Reparatur. Nach jedem Paket gemäß §12.12 übergeben und stoppen.
Dieser Plan ist keine pauschale Implementierungsfreigabe.
