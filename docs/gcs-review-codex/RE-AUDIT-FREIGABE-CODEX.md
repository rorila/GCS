# Freigabeentscheidung nach Regression A01–A15

## Entscheidung: KEINE FREIGABE

**14 von 15 ursprünglichen Befunden sind nachweislich behoben. A04 ist teilweise offen.** Der frühere P0-XSS-Pfad ist geschlossen; es wurde kein neuer P0 nachgewiesen. Eine verbleibende P1-Integritätslücke verhindert die im Auftrag definierte Freigabe.

Die positiven Nachweise sind deutlich: SWE-2 31/31, Argon 35/35, Validator auf dem gültigen Stand erfolgreich; Schema 1.1.0, 693 Entities, 1774 eindeutige Chunks und 2510 Suchdatensätze stimmen. HTTP und Offline-Browser funktionieren einschließlich aller 693 ID-Suchen, konkreter Suchklicks, mobiler Navigation und Fehlerseiten. Builds mit festem Zeitpunkt sind byte-identisch.

Trotzdem akzeptieren Importer, Portalbuild und SWE-2-Validator ein Manifest mit checksums: {} und geänderten Nutzdaten. Die Snapshot-Bindung ist dann aufgehoben, obwohl die übrigen Schritte Erfolg melden. Dies widerspricht dem Freigabekriterium einer nachgewiesenen zuverlässigen Integration. Die positive Entwicklersuite deckt diesen Fehlfall nicht ab. Zusätzlich prüft der Portalimport provenance.facts und einige Status-Enums nicht vollständig.

## Erforderliche begrenzte Nacharbeit

1. R01/P1: Prüfsummenabdeckung aller tatsächlich genutzten Manifestdateien zwingend prüfen; leere und einzeln unvollständige Prüfsummenlisten müssen vor einer Ausgabe scheitern.
2. R02/P2: Dieselbe semantische Vertragsprüfung im Portalbuild wie im SWE-2-Validator anwenden, insbesondere facts/max(facts) und Status-Enums.
3. Danach ausschließlich diese Negativfälle und einen gültigen Import-/Build-Smoke-Test erneut prüfen. Die bereits bestandenen Oberflächenprüfungen müssen ohne neue Änderungen nicht beliebig wiederholt werden.

Eine bedingte Freigabe ist nach der vorgegebenen Definition erst möglich, wenn kein P0/P1 mehr offen ist. Die grundsätzlich nutzbare Oberfläche ändert daran nichts. Diese Entscheidung betrifft die vorgelegten Freigabekriterien; die separate Eignung eines zukünftigen RAG-Planners wurde nicht erneut bewertet.

Geprüft wurde HEAD 40968be44dbebe5b15e94d29d1af56675ff85d8b plus dokumentierter uncommitteter Arbeitsstand. Details: [Gesamtbericht](RE-AUDIT-CODEX.md), [Befunde](RE-AUDIT-FINDINGS-CODEX.json), [Testbericht](RE-AUDIT-TESTS-CODEX.md). Keine Korrekturen implementiert, keine Commits/Pushes. Arbeit nach diesem Bericht angehalten.
