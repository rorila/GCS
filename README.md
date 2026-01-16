# Web-based Game Builder (M1)

Ein webbasiertes Programm zur visuellen Erstellung von Spielen, implementiert mit reinem TypeScript und Vite.

## Status: Meilenstein 1 (M1)
- [x] Projekt-Setup (Vite + TypeScript)
- [x] Editor-Layout (Toolbox, Stage, Inspector)
- [x] Stage + Grid-System
- [x] Toolbox mit Drag-&-Drop Vorbereitung

## Setup & Start

### Voraussetzungen
- Node.js (v18+)

### Installation
```bash
npm install
```

### Starten (Development)
```bash
npm run dev
```

### Build
```bash
npm run build
```

## Architektur

- **/src/editor**: Enthält die Editor-Komponenten (Stage, Toolbox, Inspector).
- **/src/model**: TypeScript Interfaces für das Projektmodell (GameProject, GameObject).
- **/src/engine**: (Geplant) Laufzeitumgebung für die Spiele.
- **/src/runtime**: (Geplant) Compiler und Runner für den Play-Mode.

## Bedienung (M1)
- Das Grid auf der Stage zeigt die Rasterung an.
- Objekte in der Toolbox können "genommen" werden (Drag-Start), Drop-Logik folgt in M2.
