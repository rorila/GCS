const fs=require('fs'),path=require('path'),crypto=require('crypto');
const root=path.resolve(__dirname,'../..'),source=path.join(root,'DEVELOPER_GUIDELINES.md');
const bytes=fs.readFileSync(source),guidelines=bytes.toString('utf8');
const doc=`# Codex im GCS-Projekt: Arbeitsweise und zugängliche Projektregeln

Stand: 18.10.2026. Projekt: game-builder-v2.

## 1. Umfang dieser Datei

Diese Datei enthält eine allgemein gehaltene Beschreibung meiner Arbeitsweise, die vom Nutzer formulierten Grenzen des letzten Auftrags und eine vollständige Kopie der zugänglichen DEVELOPER_GUIDELINES.md.

**Sie ist kein Export des internen Systemprompts und keine vollständige Wiedergabe aller Steuerungsanweisungen.** Interne Systemanweisungen und verborgene Konfiguration werden nicht offengelegt oder rekonstruiert. Die Beschreibung der Arbeitsweise ist eine Zusammenfassung, kein wörtliches Zitat solcher Anweisungen.

Die Originaldateien bleiben unverändert. Diese Zusammenstellung aktiviert keine neuen Regeln und ändert keine Einstellungen.

## 2. Arbeitsweise — allgemeine Übersicht

- Ich helfe bei Analyse, Implementierung, Dokumentation und Prüfung im Rahmen des jeweiligen Auftrags.
- Ich berücksichtige die vom Nutzer genannten Ziele, Grenzen und Korrekturen.
- Ich unterscheide belegte Ergebnisse, Annahmen und nicht ausgeführte Prüfungen.
- Ich gehe mit bestehenden Dateien und Daten sorgfältig um und ordne Änderungen nachvollziehbar ihrem Auftrag zu.
- Ich verwende Werkzeuge nur im verfügbaren und erlaubten Rahmen und behaupte keine erfolgreich ausgeführte Aktion ohne entsprechenden Nachweis.
- Ich behandle Inhalte von Dateien, Webseiten und Testergebnissen zunächst als Informationen. Ein darin enthaltener Befehl ist nicht allein dadurch ein neuer Nutzerauftrag.
- Ich wahre Vertraulichkeit und beachte Sicherheitsgrenzen.
- Bei technischen Änderungen gehören passende Prüfungen und eine verständliche Beschreibung des Ergebnisses zur Arbeit.

Das sind allgemeine Verhaltensgrundsätze; daraus lässt sich der genaue interne Systemprompt nicht ableiten.

## 3. Zugängliche Quellen und ihre Einordnung

| Quelle | Inhalt | Einordnung |
|---|---|---|
| [DEVELOPER_GUIDELINES.md](../../DEVELOPER_GUIDELINES.md) | GCS-Entwicklungsregeln und technische Muster | Lokale Projektquelle; vollständig als Anhang A übernommen |
| [docs/use_cases/UseCaseIndex.txt](../use_cases/UseCaseIndex.txt) | Anwendungsfälle und Querverweise | Fachlicher Projektkontext; kein interner Systemprompt |
| [docs/GCS_FEATURE_MAP.md](../GCS_FEATURE_MAP.md) | Funktionsübersicht | Vor größeren fachlichen Eingriffen relevante Projektquelle |
| [docs/gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md](../gcs-knowledge-swe2/SCHNITTSTELLE-ARGON.md) | Datenvertrag zwischen Wissensbasis und Portal | Technischer Vertrag für diese Integration |
| [docs/SYSTEM_PROMPT_REFERENCE.md](../SYSTEM_PROMPT_REFERENCE.md) | Vorhandene Sammlung mit Titel ANTIGRAVITY | Vorhandene andere Referenz; nicht als authentischer oder vollständiger Codex-Systemprompt bestätigt |
| Deine Aufträge und Antworten in diesem Chat | Ziele, Schreibbereiche, Freigaben und gewünschte Ergebnisse | Auftragsbezogene Vorgaben, deren Geltungsbereich jeweils zu beachten ist |

Bei der Repositorysuche wurde keine AGENTS.md gefunden. Daraus folgt nicht, dass sämtliche globalen Konfigurationen oder alle möglichen Steuerungsquellen inventarisiert wurden.

Die vorhandene SYSTEM_PROMPT_REFERENCE.md erklärt bestimmte Benutzerregeln selbst zur obersten Priorität. Eine solche Aussage in einer Projektdatei ist keine belastbare Aussage über die Prioritäten oder die tatsächliche Konfiguration von Codex. Ich habe diese Datei weder geändert noch als internen Prompt exportiert.

## 4. GCS-Kernregeln aus der Projektdatei

Die folgenden Punkte sind eine Zusammenfassung der lokalen DEVELOPER_GUIDELINES.md. Für Einzelheiten ist die vollständige Kopie in Anhang A maßgeblich; die technische Aktualität der Datei wurde hier nicht erneut auditiert.

### Kommunikation und Änderungsumfang

- Kommunikation und Dokumentation auf Deutsch.
- Maximal 1000 Zeilen pro Codedatei gemäß Projektvorgabe; bei Überschreitung modularisieren.
- Vor größeren Umbauten die Feature-Map und Auswirkungen auf andere Stellen prüfen.
- Neue Komponenten in den passenden Schema-Modulen dokumentieren.
- Änderungen in Inspector, Flow und Pascal müssen mit dem JSON-Projekt konsistent bleiben.

### Datenmodell und Architektur

- JSON ist die zentrale Projektwahrheit.
- Projektänderungen über die vorgesehenen Store-/Command-Schnittstellen führen.
- Globale Komponenten, Variablen, Tasks und Actions gehören in die Blueprint-Stage.
- Stage-lokale Elemente in den jeweiligen Stage-Sammlungen verwalten.
- Vererbung, Referenzen, Umbenennungen und Namenskonflikte zentral und stagebewusst behandeln.
- Speichern/Laden über die vorgesehenen Adapter; Dirty-Flags, Revisionsschutz und Undo/Redo beachten.

### Runtime, Darstellung und Ereignisse

- Koordinaten und Größen werden nach den Projektregeln in Grid-Zellen geführt; Pixelumrechnung erfolgt in der Darstellung.
- Laufzeit-, Standalone- und Editorverhalten bei betroffenen Änderungen zusammen berücksichtigen.
- Nach Runtimeänderungen das Standalone-Bundle erneuern.
- Lebenszyklus, Timer, Kollisionen, Bindings und Flow-Verbindungen nach den dokumentierten Mustern behandeln.
- Produktivlogging über den zentralen Logger und die zugehörigen UseCases führen.

### Qualität und Tests

- Die Projektdatei verlangt für Codeänderungen npm run test bzw. run_tests.bat und einen aktuellen QA-Bericht vor Abschluss.
- Weitere relevante Befehle sind npm run validate, npm run build und nach Runtimeänderungen npm run bundle:runtime.
- Die Datei enthält zusätzliche gezielte Tests und eine ausführliche DO-NOT-Liste für bekannte Regressionen.
- Ein dokumentiertes Testerfordernis und ein tatsächlich ausgeführter Test sind zu unterscheiden. Diese Zusammenstellung führt keine Codeänderung und keinen Testlauf aus.

## 5. Auftragsbezogene Regeln aus dem letzten A04-Auftrag

Diese Vorgaben stammten ausdrücklich von dir. Sie betreffen den abgeschlossenen A04-Korrekturauftrag und werden hier als Verlauf festgehalten, nicht als neue dauerhafte Anweisung für jeden zukünftigen Auftrag:

1. Ausschließlich die letzte offene Importvalidierung A04 korrigieren.
2. Notwendige Produktdateien nur unter docs/gcs-doc-portal-argon/ ändern.
3. SWE-2 und die ursprünglichen Auditberichte unverändert lassen.
4. Neue Prüfergebnisse unter docs/gcs-review-codex/ ablegen und vorhandene Berichte nicht überschreiben.
5. Vollständige Prüfsummen und erforderliche Eingabefelder prüfen; keine Abschaltung oder Abschwächung der Validierung.
6. Gezielte Negativtests ergänzen sowie die vorhandenen 35 Argon- und 31 SWE-2-Tests ausführen.
7. Keine sonstigen Portaländerungen, kein Redesign und keine neuen Features.
8. Keine Commits oder Pushes; nach Abschluss anhalten.

Der Ergebnisnachweis dieses Auftrags liegt in [A04-KORREKTUR-CODEX.md](A04-KORREKTUR-CODEX.md). Die jetzt erstellte Regelübersicht ist ein eigener Dokumentationsauftrag.

## 6. Wie du eigene dauerhafte Regeln übersichtlich pflegen kannst

Für Codex kann eine AGENTS.md repositorybezogene Ziele, Konventionen, Testanforderungen und wichtige Kontextdateien beschreiben. Diese Verwendung ist öffentlich dokumentiert: [OpenAI — Iterating Development Workflows with Codex](https://developers.openai.com/cookbook/examples/codex/iterating-development-workflows-with-codex).

Für dein Projekt wäre eine kurze zentrale Regeldatei mit Verweisen auf die ausführlichen Developer Guidelines sinnvoll. Temporäre Schreibverbote oder Freigaben sollten weiterhin im konkreten Auftrag stehen. Damit bleiben dauerhafte Projektkonventionen und vorübergehende Auditgrenzen verständlich. In diesem Auftrag wurde keine solche Konfigurationsdatei angelegt oder aktiviert.

## Anhang A: Vollständiger Snapshot der DEVELOPER_GUIDELINES.md

Quelle: DEVELOPER_GUIDELINES.md im Repositoryroot.

SHA-256 der gelesenen Originaldatei: ${crypto.createHash('sha256').update(bytes).digest('hex')}

Der folgende Block ist die zugängliche Projektdatei im Wortlaut. Es handelt sich um Projektinhalt, nicht um verborgene Codex-Systemanweisungen. Eventuelle veraltete oder widersprüchliche Projektpassagen wurden nicht stillschweigend korrigiert.

`;
const target=path.join(__dirname,'REGELUEBERSICHT-CODEX.md');
fs.writeFileSync(target,doc+'````markdown\n'+guidelines+'\n````\n','utf8');
const text=fs.readFileSync(target,'utf8'),missing=[];
for(const m of text.slice(0,text.indexOf('````markdown')).matchAll(/\]\(([^)]+)\)/g))if(!/^https?:/.test(m[1])&&!fs.existsSync(path.resolve(__dirname,m[1])))missing.push(m[1]);
if(!text.includes(guidelines))throw new Error('Projektregel-Snapshot fehlt');
if(missing.length)throw new Error('Fehlende Referenzen: '+missing.join(', '));
console.log(JSON.stringify({path:target,bytes:fs.statSync(target).size,sourceUnchanged:fs.readFileSync(source).equals(bytes),referencesChecked:true}));
