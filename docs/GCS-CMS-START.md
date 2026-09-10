# GCS-CMS – erster ausführbarer Schritt

Stand: 09.09.2026. Lokaler Entwicklungsstand mit fiktiven Profilen. Noch kein vollständiges CMS und keine Verwaltungsanmeldung.

## Start und Bedienung
Im V2-Verzeichnis ausführen:

```powershell
node scripts/cms/cms-server.cjs
```

Anschließend http://localhost:8081 öffnen. Der Dienst bindet ausschließlich an 127.0.0.1. Der bisherige Game-Server bleibt unabhängig.

- Fuchskind: Hund → Baum → Haus → Elefant, dann ✓. Zugang zu Spielegarten und Sternenzimmer.
- Eulenfreund: Katze → Katze → Baum → Haus, dann ✓. Zugang zum Spielegarten.
- Spielegarten enthält Snake und Breakout, Sternenzimmer nur Snake.
- ⌫ löscht das letzte Bild; die Tür meldet ab. Im Spiel führt ⬅ 🏠 zurück zur Galerie.

## Was bereits funktioniert
Die Oberfläche ist ein GCS-Projekt mit TButton, TLabel, Variablen, HTTP-Actions, Branches und Tasks. Vier Features sind angelegt. Keine neue GCS-Komponente war dafür erforderlich. Karten werden in Vierergruppen geladen; Vor/Zurück blättert. Der kleine Vorschau-Host cms-shell.js bettet ein freigegebenes Spiel ein und bietet die Rückkehr; Einwahl und Galerie sind GCS-Tasks.

Der Server ermittelt das Profil aus einer privaten Datei und gibt nur dessen Räume beziehungsweise deren freigegebene Spiele zurück. Sitzungen sind zufällige, einstündige Profilsitzungen; Emoji-Einwahl erzeugt keinerlei Adminrechte. Abmeldung widerruft die Sitzung. Der Spielendpunkt prüft Sitzung, Mitgliedschaft und Freigabe auch beim direkten Aufruf. Eine Sperre verhindert neue Starts, beendet aber noch keine bereits geladene Spielinstanz.

Der Datenkern trennt Personen, beliebig verschachtelbare Bereiche, Mitgliedschaften, Mehrfachrollen, Erziehungsbeziehungen, Spieleigentümer und Freigaben. Ein separater Berechtigungsprüfer enthält die Grundlage für Eigentümerschutz und Aufsicht. Seine Adminpfade sind isoliert getestet; es gibt noch keine öffentlich erreichbaren Admin-Schreibendpunkte oder Admin-Anmeldung.

## Dateien
- scripts/build-cms.ts: reproduzierbarer AgentController-Generator. Bei bestehendem Projekt Abbruch; --replace-generated überschreibt bewusst das generierte Projekt und die Vorschau. Eigene Änderungen vorher sichern.
- game-server/public/projects/GCS-CMS.json: im Editor untersuchbares Projekt.
- public/cms.html: generierte Vorschau; über den CMS-Dienst öffnen, nicht direkt über Vite, da die CMS-API dort nicht eingerichtet ist.
- scripts/cms/cms-core.cjs: Datenvalidierung und Berechtigungsgrundlage.
- scripts/cms/cms-server.cjs: lokaler Dienst und eingeschränkte Spielauslieferung.
- scripts/cms/cms-demo.json: ausschließlich fiktive Startdaten.
- game-server/data/cms-v1.json: beim ersten Start angelegte private Arbeitsdatei. Bestehende Datei wird nicht überschrieben. Änderungen aktuell bei gestopptem Dienst vornehmen; beim Neustart neu laden.
- scripts/test-cms.cjs / docs/cms-test.json: gezielte API-, Berechtigungs- und Browserprüfungen.

## Befund der Bestandsanalyse
TDataList, TDataStore und HTTP-/Navigations-Actions sind vorhanden. TUserManager beschreibt Konfiguration und Events. TAuthService erzeugt simulierte Tokens und prüft keine kryptografische Signatur; daher nicht für die neue Verwaltungsanmeldung verwendet. Der ältere Plattformserver hat eigene, feste Stadt-/Haus-/Raumstrukturen und generische Datenendpunkte. Das neue CMS verwendet deshalb einen getrennten Dienst und eine separate Datei. Bestehende öffentliche Spielkopien auf dem alten Server werden dadurch nicht geschützt; die Sperrgarantie gilt für den neuen CMS-Spielendpunkt.

## Nächste Schritte
1. Reale Verwaltungsanmeldung und vollständige Berechtigungsmatrix einschließlich Delegation konkretisieren.
2. Persistente, validierte Verwaltungsoperationen mit Änderungsprotokoll, Sicherung und Wiederherstellung ergänzen.
3. Raumverwaltung und Spielverwaltung für eigene Spiele, danach House-/SuperAdmin und Aufsicht.
4. Bestätigung von Erziehungsbeziehungen und deren konkrete Befugnisse umsetzen.
5. Galerie um echte Vorschaubilder, Spielinformationen und optionale Sprachausgabe erweitern; Haus-/Raumkontext aus Einladungs- oder QR-Link übernehmen. Aktuell ist das Demo-Haus in der Einwahl vorkonfiguriert.

Noch fehlen unter anderem Rollenwechsel-Oberfläche, Spielmeldungen, Verwaltungsformulare, Uploads, Sicherungsoberfläche und frei konfigurierbare Spielstarts. Der Spielhost lässt zunächst ausschließlich die geprüften lokalen Snake-/Breakout-Projekte zu. Das ist ein ausführbarer erster Baustein, keine Freigabe für öffentlichen Betrieb mit echten Kinderdaten.

## Prüfung
23 gezielte CMS-Prüfungen bestanden; Browser-Einwahl, Galerie und Rückkehr sowie API-Zugriffsgrenzen. 354 allgemeine Regressionstests bestanden. Die allgemeine Browser-E2E-Suite wurde mangels Game-Server auf Port 8080 übersprungen; separate CMS-Browsertests liefen gegen einen temporären Dienst mit temporärer Datendatei. Keine bestehenden Personen- oder Spieldaten verändert.

## Aktualisierung: zweiter Ausbauschritt
Verwaltungsanmeldung, native GCS-Raumverwaltung, persistente Freigaben/Mitgliedschaften, Haus-Emoji-Änderungen, Protokoll und Raumsicherung sind inzwischen implementiert. Der oben dokumentierte erste Stand ist historisch. Aktuelle Anleitung: [GCS-CMS-VERWALTUNG.md](GCS-CMS-VERWALTUNG.md).
