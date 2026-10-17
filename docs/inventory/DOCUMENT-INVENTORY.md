# Dokumenten-Inventar (Altbestand docs/)

> **Generierte Datei** — Quelle: `docs/inventory/FEATURE-INVENTORY.json` (Sektion `documents`).
> Neu erzeugen: `node scripts/generate-feature-inventory.cjs`. Nicht manuell editieren.

Bewertung der vorhandenen Dokumente gemäß Auftrag Phase 1.
**Wichtig:** Dies ist eine **Vorbewertung, keine fachliche Endprüfung**. Die Spalte
„Prüftiefe" zeigt die Bewertungsgrundlage:
- `voll` — Inhalt vollständig gegen Quellcode/Laufzeit geprüft
- `stichprobe` — Dokument geöffnet, Aussagen teilweise abgeglichen
- `metadaten` — nur Dateialter/Metadaten/Selbstauskunft bewertet (keine inhaltliche Prüfung)

Kein Dokument wurde verschoben oder verändert; „möglicherweise veraltet" ist eine
Vormerkung für die Fachprüfung, keine Löschempfehlung.

## Kennzahlen

- aktuell: 42
- möglicherweise veraltet: 85
- redundant: 2
- noch nicht bewertet: 84

## Tabelle

„kanonisch“ = maßgebliches Dokument zum Thema (Quelle der Wahrheit).
`→ <pfad>` = durch das genannte Dokument ersetzt (Original bleibt erhalten).

| ID | Datei | Typ | Bewertung | Prüftiefe | Verweis | Grundlage | Anmerkung |
|---|---|---|---|---|---|---|---|
| `DOC-0001` | docs/.katalog-state.json | test-artefakt | noch nicht bewertet | metadaten |  | nicht geöffnet | Statusdatei zum CMS-Testkatalog. |
| `DOC-0002` | docs/AGENT_API_REFERENCE.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Aug. |
| `DOC-0006` | docs/AgentAPI.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0007` | docs/AgentController_Vorlagen.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0003` | docs/AI_Agent_Integration_Plan.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0004` | docs/AI_PROJECT_GENERATION.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0005` | docs/AI_Test_Anleitung.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Juli. |
| `DOC-0118` | docs/architecture.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März; Architektur-Standards teils noch gültig, Detailprüfung offen. |
| `DOC-0115` | docs/architecture/execution-flow.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0116` | docs/architecture/module-map.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0117` | docs/architecture/overview.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0114` | docs/architecture/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0008` | docs/Aufgabenbereich-Bedienung-und-Umsetzungsstand.md | umsetzungsstand | aktuell | voll |  | inhalt in dieser Analyse geprüft | Beschreibt implementierten ersten Stand (17.10.). |
| `DOC-0009` | docs/Aufgabenbereich-Plan-und-Eventvertrag.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0010` | docs/Aufgabenbereich-Spielwelt-Turmbau.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0011` | docs/BREAKOUT-LERNPROJEKT.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0012` | docs/BREAKOUT-OBJEKTLISTE.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0119` | docs/breakout-sieg.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0120` | docs/breakout-start.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0121` | docs/cms-anmeldung-initial.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0122` | docs/cms-anmeldung-sitzung.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0123` | docs/cms-anmeldung.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0124` | docs/cms-avatar-upload.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0013` | docs/CMS-Datenschutz-Kinderschutz-Audit.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0014` | docs/CMS-Datenseparierung-und-DB-Migrationsplan.md | konzept/plan | aktuell | voll |  | inhalt in dieser Analyse geprüft | JSON→SQLite-Migration umgesetzt. |
| `DOC-0125` | docs/cms-einwahl.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0015` | docs/CMS-Entwickler-Umsetzungsplan.md | umsetzungsstand | aktuell | voll |  | inhalt in dieser Analyse geprüft | Laufender CMS-Umsetzungsplan. |
| `DOC-0126` | docs/cms-galerie.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0127` | docs/cms-hausverwaltung.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0016` | docs/CMS-HouseAdmin-RaumAdmin-Multiplayer-Konzept.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0017` | docs/CMS-Karteikasten-Lernpunkte.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0018` | docs/CMS-Karteikasten.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0128` | docs/cms-login-test.json | test-artefakt | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Test-Artefakt. |
| `DOC-0019` | docs/CMS-Phase0-Inventar.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0020` | docs/CMS-Plan.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0129` | docs/cms-profil.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0021` | docs/CMS-Rollenmodell-Haus-Raum.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0130` | docs/cms-room-table.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0131` | docs/cms-spiele-upload.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0022` | docs/CMS-Spielstart-Vertrag.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0023` | docs/CMS-Sponsor-Umsetzungsplan.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0132` | docs/cms-superadmin-detail.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0133` | docs/cms-superadmin.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0024` | docs/CMS-Testkatalog-Ergebnis.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0025` | docs/CMS-Testkatalog.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0026` | docs/CMS-Testluecken.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0134` | docs/cms-unified-stages.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0135` | docs/cms-verwaltung.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0136` | docs/cms-workflow-browser-test.json | test-artefakt | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Test-Artefakt. |
| `DOC-0137` | docs/cms-workflows.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0138` | docs/coding-standards.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0139` | docs/components-generated.md | referenz | redundant | stichprobe | → `docs/reference/components/README.md` | generierte Datei (Skript vorhanden) | Deckt 72 Komponenten ab — vollständige Abdeckung nachgewiesen: alle 72 Namen haben eine Karte in docs/reference/components/ (121 Karten). |
| `DOC-0140` | docs/components.md | referenz | redundant | metadaten | → `docs/reference/components/README.md` | Änderungsdatum/Alter des Dokuments | März; inhaltlich durch die generierte Komponenten-Referenz (121 Karten, registry-verifiziert) ersetzt. |
| `DOC-0141` | docs/debug-elinsmemory.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0027` | docs/Editor_Komponenten_Regal.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0143` | docs/features/cms/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0145` | docs/features/editor/flow-editor.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0146` | docs/features/editor/inspector.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0147` | docs/features/editor/project-management.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0144` | docs/features/editor/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0148` | docs/features/editor/stage-editor.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0149` | docs/features/editor/views-run-simulator.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0150` | docs/features/lernwelten/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0151` | docs/features/multiplayer/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0152` | docs/features/multiplayer/sicherheit.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0142` | docs/features/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0153` | docs/features/runtime/spielablauf.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0028` | docs/FlowEditor_DV_Konzept.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0029` | docs/Flyio-Migrationsplan.md | konzept/plan | aktuell | voll |  | inhalt in dieser Analyse geprüft | Fly.io-Bereitstellung Single-Instance + Volume. |
| `DOC-0047` | docs/GameToolBox_KI_Integration_Schritt_fuer_Schritt.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Juli. |
| `DOC-0046` | docs/GCS_FEATURE_MAP.md | referenz | aktuell | voll |  | inhalt in dieser Analyse geprüft | Prosaische Feature-Karte (UseCase-Wegweiser). Gewollte Überschneidung: FEATURE-INVENTORY ist die strukturierte, maschinenlesbare SSoT; diese Datei bleibt Lesedoku. |
| `DOC-0030` | docs/GCS-Browseruebersetzung-Analyse.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0031` | docs/GCS-CMS-ANMELDUNG.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept.; CMS-Anmeldung seitdem mehrfach weiterentwickelt. |
| `DOC-0032` | docs/GCS-CMS-HAUSVERWALTUNG.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept.; Hausverwaltung inzwischen getrennte Workspace-Stages. |
| `DOC-0033` | docs/GCS-CMS-PROFIL.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept.; Profil-Flows geändert. |
| `DOC-0034` | docs/GCS-CMS-SPEZIFIKATION.md | konzept/plan | möglicherweise veraltet | stichprobe |  | Selbstauskunft im Dokument | Selbstauskunft: „Planungsstand, noch keine implementierten CMS-Funktionen" — Spezifikation, kein Umsetzungsstand. |
| `DOC-0035` | docs/GCS-CMS-SPIELSTART.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0036` | docs/GCS-CMS-STAGES.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept.; Stage-Aufteilung mehrfach umgebaut. |
| `DOC-0037` | docs/GCS-CMS-START.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0038` | docs/GCS-CMS-SUPERADMIN.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0039` | docs/GCS-CMS-UPLOADS.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0040` | docs/GCS-CMS-VERWALTUNG.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0041` | docs/GCS-CMS-WORKFLOWS.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0042` | docs/GCS-OBJEKTLISTEN-TABELLEN.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0043` | docs/GCS-SERVER-KOMPONENTEN.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept.; Server-Komponenten seitdem erweitert (u. a. TServerSql, TServerEnroll). |
| `DOC-0044` | docs/GCS-TRAINING-SCHRITTPLAN.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0045` | docs/GCS-TRAINING.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0048` | docs/HouseAdmin-Bewohneranlage-Avatar-Emoji-Plan.md | konzept/plan | aktuell | voll |  | inhalt in dieser Analyse geprüft | Plan wurde umgesetzt (Bewohneranlage mit Avatar/Emoji). |
| `DOC-0049` | docs/JumpAndRun_BestPractice_Guide.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Aug. |
| `DOC-0050` | docs/JumpAndRun_EndlessRunner_Guide.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Aug. |
| `DOC-0051` | docs/Karteikarten-Antwortauswahl.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0052` | docs/Karteikarten-Gestalten.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0053` | docs/Karteikasten-Abenteuer.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0054` | docs/Karteikasten-Belohnungsrunden.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0055` | docs/Karteikasten-Quiz-Papierkarte.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0056` | docs/Karteikasten-Quiz-Spielbeschreibung.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0057` | docs/Karteikasten-Statistik-Plan.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0058` | docs/Lernspiel-Geruest.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0059` | docs/Lernzielkatalog.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0060` | docs/Mathe-Insel-Flussbruecke.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0061` | docs/Mathe-Rechenpuzzle.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0062` | docs/Mathe-Sprache-und-Antwortzeit.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0063` | docs/Mathematik-Lernspiele-GCS-Ablauf-und-Architektur.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0064` | docs/Mathematik-Phase1-Schnittstellenpruefung.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0065` | docs/Mathematik-Umsetzungsstand.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0066` | docs/Multiplayer_Testen.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0067` | docs/NAMING_CONVENTIONS.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Mai. |
| `DOC-0068` | docs/Overlay-Implementierungsreview.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0069` | docs/Overlay-Komponenten-Umsetzungsplan.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0070` | docs/PingPong-Remote-Synchronisationsplan.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0154` | docs/plan-projekttyp-filter.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0071` | docs/Planner_Ollama_Schritt_fuer_Schritt_Anleitung.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Juli. |
| `DOC-0072` | docs/Planner_Prompt_Bereinigung_Schritt_fuer_Schritt.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Juli. |
| `DOC-0075` | docs/QA_Report_2026-10-07_16-50-49.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0076` | docs/QA_Report_2026-10-09_20-22-39.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0077` | docs/QA_Report_2026-10-09_20-24-42.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0078` | docs/QA_Report_2026-10-10_09-25-42.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0079` | docs/QA_Report_2026-10-10_09-29-30.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0080` | docs/QA_Report_2026-10-10_09-33-55.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0081` | docs/QA_Report_2026-10-10_10-30-07.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0082` | docs/QA_Report_2026-10-10_10-32-40.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0083` | docs/QA_Report_2026-10-10_11-06-52.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0084` | docs/QA_Report_2026-10-10_19-49-27.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0085` | docs/QA_Report_2026-10-10_19-57-16.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0086` | docs/QA_Report_2026-10-10_20-02-08.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0087` | docs/QA_Report_2026-10-11_17-22-10.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0088` | docs/QA_Report_2026-10-11_17-23-29.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0089` | docs/QA_Report_2026-10-11_17-23-56.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0090` | docs/QA_Report_2026-10-11_17-23-57.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0091` | docs/QA_Report_2026-10-11_17-24-31.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0092` | docs/QA_Report_2026-10-11_17-29-53.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0093` | docs/QA_Report_2026-10-11_17-30-39.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0094` | docs/QA_Report_2026-10-15_11-03-31.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0095` | docs/QA_Report_2026-10-16_10-55-30.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0096` | docs/QA_Report_2026-10-16_11-21-50.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0097` | docs/QA_Report_2026-10-16_14-39-56.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0098` | docs/QA_Report_2026-10-16_14-42-05.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0099` | docs/QA_Report_2026-10-16_14-42-50.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0100` | docs/QA_Report_2026-10-16_14-43-44.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0101` | docs/QA_Report_2026-10-16_16-27-26.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0102` | docs/QA_Report_2026-10-16_16-34-59.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0073` | docs/QA_Report.html | report | möglicherweise veraltet | metadaten |  | generierter QA-Snapshot (Stichtagsdatei) |  |
| `DOC-0074` | docs/QA_Report.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0103` | docs/Quiz_Sprachausgabe.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0104` | docs/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0105` | docs/Refactoring.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0156` | docs/reference/actions.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0157` | docs/reference/events.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0158` | docs/reference/expressions.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0159` | docs/reference/multiplayer-runtime.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0155` | docs/reference/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0160` | docs/reference/tasks-conditions.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0161` | docs/reference/variables.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0162` | docs/review-sponsor-umsetzung.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0163` | docs/runtime-guide.md | referenz | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März; grobe Zusammenhänge zutreffend, Details ungeprüft. |
| `DOC-0164` | docs/schemas/schema_base.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0165` | docs/schemas/schema_containers.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0166` | docs/schemas/schema_dialogs.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0167` | docs/schemas/schema_display.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0168` | docs/schemas/schema_game.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0169` | docs/schemas/schema_inputs.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0170` | docs/schemas/schema_media.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0172` | docs/schemas/schema_server_cms.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0171` | docs/schemas/schema_server.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0173` | docs/schemas/schema_services.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0174` | docs/schemas/schema_table_data.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0175` | docs/schemas/schema_timers.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0176` | docs/schemas/schema_variables.json | daten | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0177` | docs/server-request-response.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0178` | docs/server-toolbox-inspector.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0106` | docs/SNAKE-LERNPROJEKT.md | konzept/plan | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Sept. |
| `DOC-0179` | docs/snake-start.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0108` | docs/Spiele-Haeuserfreigabe.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0109` | docs/Spielegalerie-Tabelle.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0180` | docs/sponsor-verbesserungen.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0107` | docs/SQLite-Flyio-Pruefbericht.md | umsetzungsstand | aktuell | voll |  | inhalt in dieser Analyse geprüft | SQLite-/Fly.io-Prüfung (Okt.). |
| `DOC-0181` | docs/stage-overview-filters.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0110` | docs/Stage-Schnittstellen.md | referenz | aktuell | voll |  | inhalt in dieser Analyse geprüft | Externe Stage-Schnittstellen (Eingänge/Ausgänge) — implementiert. |
| `DOC-0182` | docs/superadmin-sponsorverwaltung.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0111` | docs/Tauri-Desktop-Umsetzungsplan.md | dokument | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0183` | docs/tutorials/README.md | dokumentation (Phase 1) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt |  |
| `DOC-0184` | docs/ui-inspector-guide.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0185` | docs/upload-debug.png | bild/asset | noch nicht bewertet | metadaten |  | nicht geöffnet |  |
| `DOC-0187` | docs/use_cases/ActionParameterStandardisierung.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0188` | docs/use_cases/ActionVisualisierungsSynchronisation.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0186` | docs/use_cases/AIAgentController.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0189` | docs/use_cases/Authentication_JWT.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0190` | docs/use_cases/BlueprintFlowDropdown.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0191` | docs/use_cases/DataActionInspector.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0192` | docs/use_cases/DataModels.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0193` | docs/use_cases/DynamicDropdowns.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0194` | docs/use_cases/EmojiPinFlow.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0195` | docs/use_cases/ExecuteCalculateVariable.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0196` | docs/use_cases/FlowEditorDetailAnzeige.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0197` | docs/use_cases/FlowEditorRenameSync.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0198` | docs/use_cases/LoginFlow.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0199` | docs/use_cases/SmartMapping.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0200` | docs/use_cases/SofortigeJSONSynchronisation.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0201` | docs/use_cases/SynchronisationLoeschenFlowEditor.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0202` | docs/use_cases/UseCaseIndex.txt | index | aktuell | metadaten |  | Änderungsdatum/Alter des Dokuments | Fortlaufender Use-Case-Index (Stand 17.10.). |
| `DOC-0203` | docs/use_cases/UseCaseTemplate.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Vorlage aus März; Gültigkeit ungeprüft. |
| `DOC-0204` | docs/use_cases/VariableMorphing.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0205` | docs/use_cases/VariablentypPersistenz.md | use-case | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | März. |
| `DOC-0208` | docs/user-guide/_vorlage.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) | Interne Kapitelvorlage |
| `DOC-0207` | docs/user-guide/kapitel-01-projekt-anlegen.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0209` | docs/user-guide/kapitel-02-arbeitsplatz.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0210` | docs/user-guide/kapitel-03-baum-platzieren.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0211` | docs/user-guide/kapitel-04-variablen-wasser.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0212` | docs/user-guide/kapitel-05-tasks-verstehen.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0213` | docs/user-guide/kapitel-06-giess-knopf.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0206` | docs/user-guide/README.md | dokumentation (Phase 2) | aktuell | metadaten | **kanonisch** | in dieser Analyse neu erstellt (Autoren-Handbuch) |  |
| `DOC-0112` | docs/VideoToSpriteSheet_GCS_Prompt.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | Aug. |
| `DOC-0113` | docs/VirtualGamepad_Anleitung_Kids.md | anleitung | möglicherweise veraltet | metadaten |  | Änderungsdatum/Alter des Dokuments | April. |

---
_Letzter Build: 2026-10-17_
