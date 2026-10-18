# Offene Datenlücken — GCS Knowledge Base (SWE-2)

Ehrliche Bestandsaufnahme dessen, was die Wissensbasis **nicht** abdeckt.
Nichts davon wurde durch Schätzung ergänzt.

## 1. Komponenten ohne Referenzkarte (7)

| ID | Komponente | Vorhanden | Fehlt |
|---|---|---|---|
| COMP-0122 | TServerAuthorize | Inventar + `schema_server_cms.json` | Referenzkarte (Zweck, Methoden, Ereignisse) |
| COMP-0123 | TServerGuardian | dto. | dto. |
| COMP-0124 | TServerRateLimit | dto. | dto. |
| COMP-0125 | TServerProgress | dto. | dto. |
| COMP-0126 | TServerPrivacy | dto. | dto. |
| COMP-0127 | TServerInvite | dto. | dto. |
| COMP-0128 | TServerDeviceGrant | dto. | dto. |

**Auswirkung:** Eigenschaften + Defaults sind schema-belegt
(`confidence: documented`); Zweck, Methoden und Ereignisse fehlen —
`limitations` vermerkt die Lücke pro Entity. Abhilfe: Referenzkarten nach
Vorlage `docs/reference/components/_TEMPLATE` ergänzen (Up-Stream-Aufgabe
der Dokumentationspflege, nicht der Pipeline).

## 2. Gelöschte Dokumente (12)

`docs/handbook-html/**` (TESTBERICHT, VERGLEICH, GCS-PRINZIPIEN, beide
Editionen, shared content) — im Inventar verzeichnet, physisch entfernt.
Markiert: `missing: true`, `status.dev: "veraltet"`. Das Inventar selbst
müsste aktualisiert werden (Upstream).

## 3. Methoden-Komponenten-Zuordnung

`MethodRegistry`-Methoden sind globale Namen ohne Komponenten-Bezug in den
Quellen (Ausnahme: Kommentargruppen wie „// TGameServer"). Die Entities
`method` tragen daher **keine** `declaredBy`-Beziehung — die Zuordnung wäre
geraten. Abhilfe: Quellcode-Zuordnung je Methode (Methode→aufrufende
Komponentenklasse) in einer späteren Pipeline-Stufe.

## 4. Event-Payloads

`events.md` dokumentiert Payloads nur für einen Teil der Events
(`onSelect`, `onClick` u. a.). Der Rest hat keine belegten Payload-Typen —
`EVT`-Entities enthalten bewusst kein `payload`-Feld wo unbelegt.

## 5. docStatus „entwurf" bei Registry-Extrakten

Action-Typen, Methoden und Events stammen aus verifiziertem Code
(`confidence: verified`), sind aber **dokumentarisch nicht fachlich
geprüft** → `status.doc: "entwurf"`. Keine Selbstauszeichnung.

## 6. testStatus-Abdeckung

Extrahierte Entities (ACT/MTH/EVT/SCM/GUIDE/CON) tragen
`test: "nicht getestet"` — Inventar-Testzuordnung existiert nur für
COMP/FEAT/DOC. Abhilfe: Testdatei-Mapping erweitern.

## 7. `action-metadata.json`-Aktualität

Stand 2026-10-17. Die Wissensbasis spiegelt die Registry zum Extrakt-
Zeitpunkt; bei ActionRegistry-Änderungen muss zuerst
`scripts/docs/dump-action-metadata.cjs` laufen (Upstream-Abhängigkeit,
dokumentiert in `ARCHITEKTUR-SWE2.md`).

## 8. Feature→Dokument-Zuordnung

Feature-Chunks stammen aus `relatedDocs` + `docs/features/**`. Einzelne
Inventar-`relatedDocs` zeigen auf nicht existierende oder sehr große
Dokumente — Chunks decken nur ab, was physisch vorhanden ist.

## 9. Nicht erfasste Quellbereiche

- `game-server/`-Server-Code (nur über Inventar-`sources` referenziert)
- `docs/schemas/`-interne `stage`-/`category`-Felder (übernommen, nicht
  eigenständig verifiziert)
- Editor-interne Dialog-/Inspector-Logik (außerhalb des GCS-Projektmodells)
