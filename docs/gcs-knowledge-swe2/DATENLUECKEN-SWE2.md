# Offene Datenlücken — GCS Knowledge Base (SWE-2)

Ehrliche Bestandsaufnahme dessen, was die Wissensbasis **nicht** abdeckt.
Stand: schemaVersion 1.1.0 (nach Codex-Korrektur).

## Behoben seit 1.0.0 (keine Lücke mehr)

- ~~Chunk-ID-Kollisionen~~ → eindeutige IDs mit Quelldokument-Identität.
- ~~88 Chunks ohne `sourceDoc`~~ → Pflichtfeld, 0 fehlende.
- ~~181 verlorene Action-Parameter-Metadaten~~ → verlustfrei + Vergleichstest.
- ~~Geerbte Events fehlen~~ → AST-Auflösung inkl. `conditions`.
- ~~Entitätsweite `verified`-Überzeichnung~~ → `provenance.facts` +
  per-Feld-Confidence.
- ~~Validator akzeptierte fehlende Pflichtfelder/Zähler~~ → harte Gates
  + 9 Negativtests.
- ~~Snapshot nicht gebunden~~ → `index.checksums`.

## 1. Komponenten ohne Referenzkarte (7)

| ID | Komponente | Vorhanden | Fehlt |
|---|---|---|---|
| COMP-0122 | TServerAuthorize | Inventar + `schema_server_cms.json` + AST-Events | Referenzkarte (Zweck, Methoden, narrativer Kontext) |
| COMP-0123 | TServerGuardian | dto. | dto. |
| COMP-0124 | TServerRateLimit | dto. | dto. |
| COMP-0125 | TServerProgress | dto. | dto. |
| COMP-0126 | TServerPrivacy | dto. | dto. |
| COMP-0127 | TServerInvite | dto. | dto. |
| COMP-0128 | TServerDeviceGrant | dto. | dto. |

**Auswirkung:** Eigenschaften schema-belegt, Events quellcode-belegt;
narrative Beschreibung fehlt → keine Chunks (Validator-Warnung).
Abhilfe: Referenzkarten nach `docs/reference/components/_TEMPLATE`
(Upstream-Dokumentationspflege).

## 2. Gelöschte Dokumente (12)

`docs/handbook-html/**` — im Inventar verzeichnet, physisch entfernt.
Markiert: `missing: true`, `status.dev: "veraltet"`. Das Inventar
selbst müsste aktualisiert werden (Upstream).

## 3. Methoden-Komponenten-Zuordnung

`MethodRegistry`-Methoden sind globale Namen ohne belegten
Komponenten-Bezug. Die Entities `method` tragen bewusst keine
`declaredBy`-Beziehung — die Zuordnung wäre geraten. Abhilfe:
Quellcode-Zuordnung je Methode in einer späteren Pipeline-Stufe.

## 4. Event-Payloads

`events.md` dokumentiert Payloads nur für einen Teil der Events.
Der Rest hat keine belegten Payload-Typen — `EVT`-Entities enthalten
bewusst kein `payload`-Feld wo unbelegt. Die neuen `conditions`
(isHiddenInRun) sind quellcode-belegt, Payloads hingegen nicht.

## 5. docStatus „entwurf" bei Registry-Extrakten

Action-Typen, Methoden und Events stammen aus verifiziertem Code
(`confidence: verified`), sind aber dokumentarisch nicht fachlich
geprüft → `status.doc: "entwurf"`. Keine Selbstauszeichnung.

## 6. testStatus-Abdeckung

Extrahierte Entities (ACT/MTH/EVT/SCM/GUIDE/CON) tragen
`test: "nicht getestet"` — Inventar-Testzuordnung existiert nur für
COMP/FEAT/DOC. Abhilfe: Testdatei-Mapping erweitern.

## 7. `action-metadata.json`-Aktualität

Stand 2026-10-17. Die Wissensbasis spiegelt die Registry zum
Extrakt-Zeitpunkt; bei ActionRegistry-Änderungen muss zuerst
`scripts/docs/dump-action-metadata.cjs` laufen (Upstream-Abhängigkeit).

## 8. Vererbung außerhalb `src/components/`

Die AST-Auflösung deckt Klassen in `src/components/*.ts` ab. Eltern
außerhalb (keine bekannten Fälle) würden die Kette still abbrechen —
die betroffene Entity bekäme nur `own`-Events. Der Validator meldet
solche Unterschiede nicht automatisch; Regressionstests decken die
Referenzfälle TComponent/TWindow/TSprite/TButton ab.

## 9. Nicht erfasste Quellbereiche

- `game-server/`-Server-Code (nur über Inventar-`sources` referenziert)
- Editor-interne Dialog-/Inspector-Logik (außerhalb des
  GCS-Projektmodells)
- `docs/schemas/`-interne `stage`-/`category`-Felder (übernommen,
  nicht eigenständig verifiziert)
