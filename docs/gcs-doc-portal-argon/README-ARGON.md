# GCS Documentation Portal — Argon Edition (`README-ARGON.md`)

Willkommen im **GCS Documentation Portal (Argon Edition)**! Diese Webanwendung erweitert die moderne Argon-Handbuchoberfläche zu einer vollständigen, offlinefähigen Wissens- und Referenzplattform für das **Game Construction Set (GCS)**.

---

## 1. Enthaltene Dokumentationsbereiche (6 Säulen)

1. **🏠 Portal-Startseite (`#home`)**
   - Rollenbasierter Einstieg für **Spiele-Autoren & Einsteiger**, **Fortgeschrittene Spielentwickler** sowie **Engine- & KI-Entwickler (SWE-2)**.
   - Live-Kennzahlen über sämtliche Dokumentationsbereiche und direkter Wiedereinstieg in das aktuelle Handbuch-Kapitel.

2. **📖 Autoren-Handbuch (`#handbook`)**
   - Vollständige Darstellung aller **23 Kapitel** aus `docs/user-guide/`:
     - **Teil A (Kapitel A1–A15):** *„Mein erster interaktiver Baum“* (für absolute Einsteiger ohne Programmierkenntnisse).
     - **Teil B (Kapitel B1–B8):** *„Der wachsende Baum“* (vom Einzelbaum zur mehrstufigen Lernwelt mit Aufgaben-Stage, Baumhaus, Drag & Drop und Zufallsfragen).
   - **Interaktive Funktionen:** Abhakbare Checklisten, Kapitel-Fortschrittsring (`localStorage`), einblendbare **deutsche Sprecher-Drehbücher (Voice-Over)**, Video-/Screenshot-Platzhalter sowie klickbare Komponenten-Badges (`T*`).

3. **🧩 Komponentenreferenz (`#components`)**
   - Vollständiger Katalog aller **128 inventarisierten GCS-Komponenten** (`COMP-0001` bis `COMP-0128`) aus `docs/inventory/FEATURE-INVENTORY.json` und den **121 Markdown-Referenzkarten** unter `docs/reference/components/`.
   - **11 Kategorien** mit Live-Textfilter, Status-Filter (*Alle*, *Im Autoren-Handbuch genutzt*, *In Spielprojekten verwendet*, *Kuratierte Referenzkarten*).
   - **Detailansichten (`#components/<TName>`):** 3-Achsen-Status (*Dev / Test / Doku*), Vererbungskette (klickbar), Inspector-Eigenschaften & Standardwerte, Events, Methoden, Verwendungsbeispiele sowie bidirektionale Querverweise auf Handbuch-Kapitel und System-Features.

4. **✨ Feature-Katalog (`#features`)**
   - Übersicht und Detailansichten aller **12 übergeordneten GCS-Features** (`FEAT-0001` bis `FEAT-0012`) inkl. maßgeblicher Quelldateien, Testskripten, protokollierten Testläufen, Einschränkungen und Abhängigkeiten (`dependsOn`).
   - Zusätzlich **12 aufbereitete Feature-Fachartikel** aus `docs/features/` (Editor, Flow-Editor, Inspector, Stage-Editor, Runtime, Multiplayer, CMS, Lernwelten) und `docs/GCS_FEATURE_MAP.md`.

5. **🏛️ Architektur-Dokumentation (`#architecture`)**
   - Die **4 kanonischen Architekturdokumente** aus `docs/architecture/`:
     - `overview.md` — Systemübersicht & Schichtenmodell
     - `module-map.md` — Vollständige Modulkarte aller Verzeichnisse
     - `execution-flow.md` — Laufzeit-Ausführungsfluss (Event → Task → Action → Variable/UI)
     - `README.md` — Navigationsübersicht der Architektur-Sektion

6. **🛠️ Entwicklerreferenz (`#devref`)**
   - **⚡ Runtime-Action-Katalog (`#devref/actions`):** Interaktive Suche über alle **59 Action-Typen** und deren Parameter aus `docs/inventory/action-metadata.json`.
   - **🗂️ Dokumenten-Inventar (`#devref/doc-inventory`):** Durchsuchbare und nach Kanonizität/Bewertung filterbare Tabelle aller **242 inventarisierten Dokumente** (`DOC-0001` bis `DOC-0242`).
   - **🤝 SWE-2 Datenschnittstelle (`#devref/swe2-interface`):** Spezifikation des JSON-Datenvertrags und der kanonischen Join-Schlüssel für die Zusammenarbeit mit SWE-2.
   - **📄 Technische Referenzdokumente:** `DEVELOPER_GUIDELINES.md`, Runtime-Entwicklerhandbuch (`docs/Developer-Guide_Runtime.md`), Stage-Schnittstellen (`docs/Stage_Interfaces.md`), Security-Masterplan (`docs/Security_Masterplan.md`), Technical-Debt-Register (`TD-001` bis `TD-017` aus `docs/inventory/TECHNICAL-DEBT.md`), ID-Schema und Tooling.

7. **🔍 Globale Volltextsuche (`Strg+K` oder `/`)**
   - Durchsucht in Echtzeit alle **23 Kapitel**, **128 Komponenten**, **12 Features + 12 Fachartikel**, **4 Architekturdokumente**, **59 Actions** und **17 Technical-Debt-Einträge**.
   - Mit Bereichs-Filter-Pills (*Alle*, *Handbuch*, *Komponenten*, *Features*, *Architektur*, *Entwickler & Actions*), gewichteter Relevanzsortierung und `<mark>`-Hervorhebung.

---

## 2. Lokaler Start unter Windows 11 (Zero-Server & Offlinefähig)

Das Portal ist nach dem Build zu **100 % offlinefähig** und benötigt keinen laufenden Webserver:

### Option A: Direktstart im Browser (`file://`)
Öffne im Windows-Explorer einfach per Doppelklick die Datei:
```text
docs/gcs-doc-portal-argon/index-argon.html
```
*(Dank der vorab generierten Datei `data/portal-data-argon.js` stehen alle Daten sofort ohne `fetch()`/CORS-Blockade zur Verfügung.)*

### Option B: Start über lokalen Entwicklungsserver
Falls du einen lokalen HTTP-Server bevorzugst:
```powershell
npx serve docs/gcs-doc-portal-argon
```
oder aus dem Projekt-Stammverzeichnis:
```powershell
npm run dev
# Anschließend im Browser öffnen:
# http://localhost:5173/docs/gcs-doc-portal-argon/index-argon.html
```

---

## 3. Daten-Build aktualisieren (`build-argon.cjs`)

Wenn sich Markdown-Dokumente unter `docs/user-guide/`, `docs/reference/components/`, `docs/features/`, `docs/architecture/` oder Inventardateien unter `docs/inventory/` ändern, führe einfach folgenden Befehl aus dem Projekt-Stammverzeichnis aus:

```powershell
node docs/gcs-doc-portal-argon/build-argon.cjs
```

Der Build-Prozess liest alle Quellen **strikt read-only** ein und erzeugt:
- `docs/gcs-doc-portal-argon/data/portal-data-argon.json` (reines JSON für Werkzeuge & KI-Agenten)
- `docs/gcs-doc-portal-argon/data/portal-data-argon.js` (`window.GCS_PORTAL_DATA_ARGON` für den `file://`-Direktstart)

---

## 4. Dateistruktur im Argon-Arbeitsbereich

Alle Dateien liegen isoliert unter `docs/gcs-doc-portal-argon/`:

| Datei | Beschreibung |
|---|---|
| `index-argon.html` | HTML-Einstiegspunkt des Portals (6-Bereichs-Topbar, Kontext-Sidebar, Lese-/Detailbereich, Spotlight-Suche) |
| `styles-argon.css` | Responsives „Editorial Studio“-Designsystem mit Dark/Light-Theme |
| `app-argon.js` | Hash-Router, Zustandsverwaltung (`localStorage`), Sidebar-Controller & Globale Volltextsuche |
| `views-argon.js` | Darstellungs-Templates für Startseite, Handbuch, Komponentenreferenz, Feature-Katalog, Architektur & Entwicklerreferenz |
| `build-argon.cjs` | Reproduzierbarer Node.js-Build-Prozess (Zero-Dependency, strikt read-only gegenüber Bestandsdateien) |
| `parser-argon.cjs` | Markdown-AST-Parser & automatischer Cross-Linker (`T*`, `FEAT-xxxx`, `COMP-xxxx`, `TD-xxx`) |
| `portal-config-argon.json` | Deklarative Quellpfade und SWE-2-Datenschnittstellen-Konfiguration |
| `ARCHITEKTUR-ARGON.md` | Technische Architektur-Dokumentation & Spezifikation der SWE-2-Datenschnittstelle |
| `README-ARGON.md` | Diese Start- und Bedienungsanleitung |
| `data/portal-data-argon.json` | Generierter strukturierter Gesamtdatenbestand (JSON) |
| `data/portal-data-argon.js` | Generiertes JS-Datenbundle für `file://`-Offlinebetrieb |
