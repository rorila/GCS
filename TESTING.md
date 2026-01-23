# Game Builder - Test-Anleitung

## Voraussetzungen

```bash
npm install
```

---

## 1. Editor starten

```bash
npm run dev
```

Öffne http://localhost:5173 im Browser.

### Testen:
- [ ] Toolbox zeigt Button, Panel, Label
- [ ] Drag & Drop auf Stage funktioniert
- [ ] Objekt auswählen → Inspector zeigt Properties
- [ ] Properties ändern → Objekt aktualisiert sich
- [ ] Resize-Handle (rechts unten) funktioniert

---

## 2. Projekt speichern/laden

### Speichern:
1. Erstelle einige Objekte
2. Klicke **Save Project** in der Toolbar
3. `.json`-Datei wird heruntergeladen

### Laden:
1. Klicke **Load Project**
2. Wähle eine `.json`-Datei
3. Objekte werden wiederhergestellt

### Testen:
- [ ] Speichern erstellt gültige JSON
- [ ] Laden stellt alle Objekte wieder her
- [ ] Positionen, Styles, Namen bleiben erhalten

---

## 3. Play-Modus (im Editor)

1. Klicke **Run** in der View-Toolbar
2. Grid verschwindet
3. Klicke auf Buttons → Tasks werden ausgeführt

### Testen:
- [ ] Run-Modus deaktiviert Drag/Resize
- [ ] Button-Klicks triggern Tasks
- [ ] **Stage** schaltet zurück in Edit-Modus

---

## 4. Standalone Player

```bash
npm run build
```

1. Kopiere deine `project.json` als `game.json` nach `dist/`
2. Starte einen lokalen Server:

```bash
npx serve dist
```

3. Öffne http://localhost:8080/play.html (oder den Port Ihres Standalone-Servers)

### Testen:
- [ ] Spiel lädt ohne Editor
- [ ] Objekte werden gerendert
- [ ] Tasks funktionieren

---

## 5. TypeScript-Check

```bash
npx tsc --noEmit
```

✅ Keine Fehler = Code ist korrekt typisiert.

---

## 6. Komponenten-Hierarchie

| Komponente | Basis | Beschreibung |
|------------|-------|--------------|
| `TComponent` | - | Abstrakte Basis |
| `TWindow` | `TComponent` | Geometrie + Style |
| `TButton` | `TWindow` | Klickbarer Button |
| `TPanel` | `TWindow` | Container |
| `TLabel` | `TWindow` | Text-Anzeige |
| `TStage` | `TWindow` | Spielfeld mit Grid |

---

## Schnell-Checkliste

```
[ ] npm run dev → Editor läuft
[ ] Objekte erstellen/verschieben
[ ] Speichern/Laden
[ ] Play-Modus testen
[ ] npm run build → dist/ wird erstellt
[ ] npx tsc --noEmit → keine Fehler
```
