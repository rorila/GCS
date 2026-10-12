# Sponsor: Korrekturen und Abschlussprüfung

Stand: 12.10.2026. Die im Erstreview beschriebenen 13 Befunde wurden im aktuellen Arbeitsstand bearbeitet. Bestehende Änderungen des Projekts wurden beibehalten. Es wurde kein produktiver CMS-Datenbestand geändert und keine Bereitstellung durchgeführt.

## Änderungen nach Review-Befund

| Befund | Korrektur |
| --- | --- |
| 1. Fremdzugriff | Vereinbarungen, Versionsvergleich und Belohnungslisten prüfen die Beziehung des Akteurs zum Kind und die aktuelle Zugriffsberechtigung. |
| 2. Sichtvorschläge | Der Validator erlaubt den Status `proposed`; Umfang und Eingaben werden geprüft. |
| 3. Elternpause | Sponsor und Kind können eine elterliche Pause nicht aufheben. Eine Kindpause kann nur das Kind aufheben. Die Elternansicht bietet Fortsetzen an. |
| 4. Erste Freigabe | Alle erforderlichen Eltern stimmen derselben unveränderlichen Sichtversion zu. Unterschiedliche Freigaben werden abgewiesen. |
| 5. Sichtausweitung | Leere Aktivitäten bedeuten alle Aktivitäten und werden entsprechend als Erweiterung behandelt. Einschränkungen widerrufen veraltete Vorschläge; Erweiterungen benötigen Elternzustimmung. |
| 6. Idempotenz | Vorgangsschlüssel sind akteurbezogen und an den Inhalt gebunden. Ohne ausdrücklichen Schlüssel entsteht ein neuer Vorschlag. Abweichende Wiederholungen werden abgewiesen. |
| 7. Vertrags-ID | Die Oberfläche übermittelt `agreementId` und die gewählte Version an Zustimmung und Ablehnung. |
| 8. Punkteverbrauch | Reservieren, Ablehnen, erneutes Beantragen und Erfüllen funktionieren ohne doppelte Belastung. Fachlich abgewiesene Transaktionen speichern keine Teilmutationen. |
| 9. Leistungsnachweis | Clientmeldungen bleiben unbestätigt. Sie zählen erst nach elterlicher Anerkennung; Quellereignis, Kind, Regel, Wert und Zeitpunkt werden geprüft. Alte fälschlich als verifiziert markierte Clientmeldungen zählen ebenfalls nicht automatisch. |
| 10. Pause/Ende | Sponsorzugriff auf Fortschritt, Historie und Nachrichten sowie neuer Kontakt werden gesperrt. Bestehende eigene Erfüllungspflichten bleiben gezielt abwickelbar. |
| 11. Transparenz | Eltern und Kind erhalten eigene Mitteilungsseiten mit vollständigem Nachrichtentext. Nachrichten erzeugen Historieneinträge. Eltern können Sichtfreigaben verwalten und Leistungsereignisse anerkennen. |
| 12. Benachrichtigungen | Neue Ereignisse erzeugen neue Hinweise; die Unterdrückung gilt nicht mehr dauerhaft für einen Ereignistyp. |
| 13. Fortschritt | Sichtbare Punkte und vertraglich anrechenbare Punkte werden getrennt ausgewiesen. Anspruchsprüfung und Vertragsfortschritt verwenden dieselbe Berechnung. |

Zusätzlich bleiben bereits erreichte Ansprüche bei einem Versionswechsel erhalten. Punkteübertrag und Zeitgrenzen werden berücksichtigt. Ziel-/Belohnungsänderungen über die Eltern- und Kindansicht übernehmen die übrigen Bedingungen der gewählten Vertragsversion. Ungültige Vertragsstrukturen werden ohne Mutation abgewiesen. Eine fehlende Privacy-Komponente in der Eltern-Serverstage wurde ergänzt.

## Betroffene Dateien

- `scripts/cms/cms-sponsor.cjs`: Berechtigungen, Elternfreigaben, Sichtversionen, Vorschläge, Nachrichten und Hinweise.
- `scripts/cms/cms-sponsor-components.cjs`: atomare Runtime-Aufrufe, Eingabeprüfung und Vertragsänderungen.
- `scripts/cms/cms-performance.cjs`: vertrauenswürdige Leistungsnachweise, Zeitgrenzen und Anspruchsberechnung.
- `scripts/cms/cms-rewards.cjs`: Punktebilanz, Reservierung und Belohnungsabwicklung.
- `scripts/cms/cms-core.cjs` und `scripts/cms/cms-store.cjs`: Validierung und Rücknahme abgewiesener Transaktionen.
- `scripts/cms/cms-add-sponsor-stages.cjs` und `game-server/public/projects/GCS-CMS.json`: Eltern-, Kind- und Sponsoroberflächen samt Aufgaben und API-Verknüpfungen.
- `scripts/test-cms-sponsor-regressions.cjs`: neue Sicherheits- und Workflowtests.
- `scripts/test-cms-testdata.cjs`, `scripts/test_runner.ts` und `package.json`: angepasster Wiederholungstest und Einbindung der neuen Regressionen.

## Durchgeführte Prüfungen

| Prüfung | Ergebnis |
| --- | --- |
| `node scripts/test-cms-sponsor-regressions.cjs` | 24 Testgruppen bestanden; echte CMS-Runtime, synthetische Daten und echter Store-Rollback. |
| `node scripts/test-cms-testdata.cjs` | 38 Tests bestanden. |
| `node --test scripts/test-cms-ui-integrity.cjs` | 10 Tests bestanden; CMS-Master ohne Integritätsfehler oder Warnungen. |
| `npm run build` | Erfolgreich; bestehende Vite-Hinweise zu externen Node-Modulen und Chunk-Größe. |
| `git diff --check` | Keine Whitespace-Fehler. |

Die Regressionen sind über `npm run test:cms:sponsor` erreichbar und im regulären Testlauf eingebunden. Geprüft wurden Fachlogik, Runtime-Aufrufe und strukturelle UI-Verknüpfungen. Eine visuelle Browser-Abnahme sämtlicher neuer Seiten und ein Test gegen einen produktiven CMS-Server wurden nicht durchgeführt. Der Abschluss bestätigt diese konkreten Prüfungen und stellt keine umfassende Sicherheitszertifizierung dar.

## Hinweis für bestehende Daten

Frühere Client-Leistungsdaten mit `verified` und nicht vertrauenswürdiger Herkunft werden nicht mehr automatisch angerechnet. Sie können nach Prüfung über den Elternablauf anerkannt werden. Bereits gespeicherte Belohnungsansprüche bleiben erhalten; historische fehlerhafte Buchungen oder Freigaben werden durch diese Codekorrektur nicht automatisch bereinigt und sollten bei bestehenden Installationen gesondert geprüft werden.
