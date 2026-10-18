# RAG-Readiness und Eignung für den GCS-KI-Planner

Stand: 18.10.2026. **Bedingt geeignetes Rohmaterial für die Weiterentwicklung; nicht für ungeprüfte automatisierte Planung freigegeben.** Die Dateien sind eine strukturierte Wissensbasis, noch keine vollständige RAG-Infrastruktur.

## Was bereits belastbar vorhanden ist

688 typisierte Entities aus neun Kategorien mit stabilen IDs, Statusachsen, Quellen, Provenance und Relationen bilden einen sinnvollen Ausgangspunkt. Die Daten können ohne Portal gelesen werden. 1774 Textsegmente sind mit vorhandenen Entities verknüpft; charCount stimmt, es gibt keine leeren Chunks. Für die vorhandenen Segmente stimmen Entity-Art, Entwicklungsstatus und Confidence mit der jeweiligen Entity überein. Das sind nachgewiesene strukturelle Eigenschaften, keine Bestätigung sämtlicher inhaltlicher Aussagen.

Es existieren maschinenlesbare Komponenten-, Action-, Methoden- und Eventdaten, aber ihr Umfang und ihre technische Präzision unterscheiden sich erheblich. Insbesondere sind Registry-Methoden, dokumentierte Methoden und tatsächlich im Runtimekontext aufrufbare Methoden keine automatisch identischen Mengen. Einsatzkontext und Besitzer müssen vor einer Planung gesondert geklärt werden.

## Kritische Datenlücken

| Aspekt | Befund | Folge für Retrieval/Planung |
|---|---|---|
| Identität | 82 ID-Wiederholungen bei 51 Chunk-IDs | Upsert/Cache/Zitatzuordnung kann Inhalte überschreiben oder vermischen |
| Abdeckung | Chunks für 171 Entities; 517 ohne eigenen Chunk | Reiner Chunk-Retriever findet Actions, Methoden, Events und Schemas nicht gezielt als eigene Entity |
| Quellen | 88 Chunks ohne direktes metadata.sourceDoc; teilweise sources/docs-Fallback möglich | Metadaten müssen normalisiert werden, fehlender direkter Pfad ist nicht gleich fehlender Herkunft |
| Parameter | 181 Metadatenfelder verloren | Falsche Defaults, Referenzwahl, Bindungen oder Sichtbarkeitsbedingungen möglich |
| Events | sichtbares TSprite 23 Quellereignisse, Wissen nur zehn | Planner könnte gültige Ereignisse nicht verwenden oder falsche Workarounds erzeugen |
| Properties | Portal ergänzt 333 Markdown-Zeilen, 13 Optionsdefinitionen gehen bei Projektion verloren | Agent und menschlicher Autor sehen unterschiedliche technische Verträge |
| Vertrauen | zehn entitätsweite verified-Einstufungen beruhen teilweise auf Dokumentationsstatus | Kein Beweis aller Einzelangaben und kein erfolgreicher Runtime-Test |
| Lebenszyklus | current snapshot ist frisch, aber Import prüft keine Inhaltsbindung | Veraltete oder lokal geänderte Aussagen können als aktueller Stand erscheinen |

Drei Chunks sind länger als ungefähr 4000 Zeichen (Maximum 4406). Das ist bei der Vertragsformulierung kein alleiniger Freigabeblocker, sollte aber bei tokenbasierter Segmentierung berücksichtigt werden. Ein einzelner Inhaltsverzeichnis-Chunk kann trotz gültiger Form wenig fachlichen Nutzen besitzen. Die semantische Qualität sämtlicher 1774 Texte wurde nicht manuell einzeln bewertet.

Im geprüften Chunk-Metadatenvergleich gab es keine Abweichung von status.dev oder confidence gegenüber den Entities. Ein konkreter inhaltlicher Widerspruch liegt jedoch bei TSprite vor: Die Referenzprosa beschreibt geerbte Standardereignisse, während die strukturierte Eventliste sie weglässt. Formal passende Metadaten verhindern solche Widersprüche nicht.

## Was noch keine RAG-Infrastruktur ist

Die Portalsuche verwendet lokale Zeichenkettenprüfung und eine einfache lexikalische Gewichtung. Es wurden keine Embeddings, Vektordatenbank, hybrides Retrieval, Cross-Encoder-Reranking, tokenbudgetierte Kontextaufbereitung oder Planner-Modellaufrufe nachgewiesen. Die Bezeichnung „semantische Suche“ in der Oberfläche belegt diese Fähigkeiten nicht.

Weder Recall/Precision noch MRR, nDCG, Halluzinationsrate oder Qualität generierter GCS-Projekte wurden gemessen. Lokale und cloudbasierte RAG-Nutzung sind technisch plausible Erweiterungen, keine bereits getesteten Eigenschaften. Es wurde kein externer Dienst angeschlossen und keine Dokumentation an einen Cloudanbieter gesendet.

## Konkrete Weiterentwicklung

1. Kanonischen Snapshot reparieren und validieren; alle Entities erhalten mindestens einen technischen Basischunk mit ID, Name, Art, Status, Confidence, Scope/Voraussetzungen und vollständigen Parametern/Optionen.
2. Originaltextsegmente getrennt davon erhalten. Chunk-Identität aus Entity, Quelle, Abschnitt und Teilsegment bilden; kurze Quellenzitate/Anker für Belege vorsehen.
3. Deterministische ID-/Name-Suche als erste Retrievalstufe nutzen. Für technische Befehle gehen exakte Registry-/Schema-Treffer vor ähnlichen Prosatexten.
4. Danach optional BM25 und Embeddings kombinieren; verwandte Entities über geprüfte Relationen ergänzen. Reranking und Deduplizierung verhindern, dass viele ähnliche FEAT-0005-Segmente den Kontext verdrängen.
5. Kontextpakete nach Tokenbudget bilden, dabei Status, Einschränkungen, Herkunft und Voraussetzungen niemals wegkürzen. Geplante/veraltete Funktionen standardmäßig ausschließen oder explizit begründen; inferred erfordert sichtbare Unsicherheit.
6. Scope/Eigentümer und Runtime-Fähigkeit explizit prüfen: Stage vs. global, Editor vs. Runtime, Server-/Multiplayerbedarf, Methodenbesitzer und Event-Vererbung. Nicht aus bloßem Namensvorkommen ableiten.
7. Planner-Ausgabe gegen reale GCS-Schemas und Registry prüfen, Referenzen auflösen, sichere Tests/Simulation verwenden und vor produktiver Nutzung menschlich prüfen.

## Empfohlene Evaluation

Ein kleiner versionierter Goldstandard sollte exakte IDs, Parametervorgaben, geerbte Events, mehrere gleichnamige Methoden, geplante/veraltete Einträge und ungültige Wünsche enthalten. Beispiele: „Welche Parameter und Defaults benötigt animate?“, „Welche Events besitzt ein sichtbares TSprite?“, „Darf TImage uneingeschränkt verwendet werden?“, „Wo ist MTH-0001 registriert?“, „Welche Funktion benötigt einen Server?“.

Zunächst exakte Entity-Abdeckung und Quellenkorrektheit messen. Erst danach Retrieval-Recall/Ranking und anschließend faktisch richtige, schema-/runtimevalide Planner-Ausgaben bewerten. Dokumentations-/Wissensinhalte als Daten behandeln; darin enthaltene Anweisungen dürfen keine Systemanweisungen des späteren Agenten ersetzen. Eine umfassende Prompt-Injection-Evaluation ist noch nicht durchgeführt.

Freigabe für einen Planner erst nach Reparatur der P0/P1-Befunde, erfolgreicher Retrieval-Evaluation und einer eigenen End-to-End-Prüfung. Als unabhängiger Rohdatenbestand kann SWE-2 bereits untersucht und weiterentwickelt werden; die aktuelle Datenlage reicht nicht für eine verlässliche automatische GCS-Projekterzeugung.
