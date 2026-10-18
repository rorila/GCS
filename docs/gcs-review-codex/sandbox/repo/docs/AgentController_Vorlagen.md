# 🤖 AgentController — Auftrags-Vorlagen

> Kopiere die passende Vorlage, fülle die `{Platzhalter}` aus und sende sie mir.
> Ich baue dann alles mit dem AgentController ins Projekt ein.

---

## 📋 1. Task mit Actions erstellen

```
AUFGABE: Erstelle einen Task

Stage: {stage_id}                    ← z.B. stage_login, stage_blueprint
Task-Name: {TaskName}                ← z.B. ValidateLogin
Beschreibung: {Kurzbeschreibung}

Actions (in Reihenfolge):
1. [{ActionTyp}] {ActionName} → {was soll passieren}
2. [{ActionTyp}] {ActionName} → {was soll passieren}
3. ...

Bedingung (optional):
  Wenn {Variable} {Operator} {Wert}:
    Dann: {ActionName1}, {ActionName2}
    Sonst: {ActionName3}
```

**Beispiel:**
```
AUFGABE: Erstelle einen Task

Stage: stage_login
Task-Name: ValidateLogin
Beschreibung: Prüft Login-Daten und zeigt Ergebnis

Actions (in Reihenfolge):
1. [APICall] CallLoginAPI → POST /api/login mit username + password
2. [SetVariable] SetLoginResult → Speichere Antwort in loginResult

Bedingung:
  Wenn loginResult.success == true:
    Dann: ShowDashboard (NavigateTo stage_dashboard)
    Sonst: ShowError (SetVariable errorMessage = "Login fehlgeschlagen")
```

---

## 🎨 2. Stage mit UI-Komponenten erstellen

```
AUFGABE: Erstelle eine Stage

Stage-ID: {stage_id}
Stage-Name: {Anzeigename}

Komponenten:
┌──────────────────────────────────────┐
│ [{Typ}] {Name}                       │
│   Position: {x}, {y} | Größe: {w}x{h}│
│   Text: {Anzeige-Text}              │
│   Stil: {Farbe, Schrift, etc.}      │
│   Binding: {Variable} (optional)    │
│   Event: {onClick → TaskName}       │
└──────────────────────────────────────┘

Variablen (optional):
- {Name}: {Typ} = {Startwert}
```

**Beispiel:**
```
AUFGABE: Erstelle eine Stage

Stage-ID: stage_dashboard
Stage-Name: Dashboard

Komponenten:
┌──────────────────────────────────────┐
│ [TPanel] HeaderPanel                 │
│   Position: 0, 0 | Größe: 20x2      │
│   Ausrichtung: TOP                   │
│   Stil: Hintergrund #1a1a2e,        │
│         Glow blau (Blur 20, Spread 5)│
├──────────────────────────────────────┤
│ [TLabel] WelcomeLabel                │
│   Position: 1, 0 | Größe: 10x2      │
│   Text: "Willkommen"                │
│   Binding: ${currentUser.name}       │
│   Stil: Weiß, 24px, Bold            │
├──────────────────────────────────────┤
│ [TButton] LogoutBtn                  │
│   Position: 16, 0 | Größe: 4x2      │
│   Text: "Abmelden"                  │
│   Stil: Rot, Abrundung 8            │
│   Event: onClick → LogoutTask        │
└──────────────────────────────────────┘
```

---

## 🔄 3. Bestehende Komponenten ändern

```
AUFGABE: Ändere Komponenten

Stage: {stage_id}

Änderungen:
- {Objektname}.{Property} = {neuer Wert}
- {Objektname}.{Property} = {neuer Wert}
- {Objektname}.events.{Event} → {TaskName}
```

**Beispiel:**
```
AUFGABE: Ändere Komponenten

Stage: stage_login

Änderungen:
- LoginPanel.style.backgroundColor = #1e1e2e
- LoginPanel.style.glowColor = rgba(100, 100, 255, 0.3)
- LoginPanel.style.glowBlur = 25
- LoginBtn.text = "Jetzt anmelden"
- LoginBtn.events.onClick → ValidateLogin
- ErrorLabel.text = ${loginError}
```

---

## 📸 4. Stage nach Vorlage (Screenshot)

```
AUFGABE: Erstelle Stage nach Screenshot

Stage-ID: {stage_id}
Stage-Name: {Name}

[Screenshot hier einfügen]

Zusätzliche Hinweise:
- {Farbschema, Besonderheiten, Funktionalität}
- Events: {welche Buttons sollen was auslösen}
```

---

## 🗑️ 5. Elemente löschen

```
AUFGABE: Lösche Elemente

- Task löschen: {TaskName}
- Action löschen: {ActionName}
- Objekt entfernen: {Objektname} aus {stage_id}
- Variable löschen: {Variablenname}
- Stage löschen: {stage_id}
```

---

## ✏️ 6. Umbenennen

```
AUFGABE: Umbenennen

- Task: {AlterName} → {NeuerName}
- Action: {AlterName} → {NeuerName}
```

---

## 📊 7. Inventar abfragen

```
AUFGABE: Zeige mir

- [ ] Alle Stages (mit Objekt- und Task-Anzahl)
- [ ] Alle Tasks (in Stage {stage_id})
- [ ] Alle Actions (in Stage {stage_id})
- [ ] Alle Variablen
- [ ] Alle Objekte in {stage_id}
- [ ] Details zu Task {TaskName}
```

---

## ✅ 8. Projekt validieren

```
AUFGABE: Validiere das Projekt

Prüfe auf:
- [ ] Inline-Actions (verboten)
- [ ] Fehlende Action-Referenzen
- [ ] Verwaiste Actions (definiert, nie benutzt)
- [ ] Tasks ohne FlowChart
```

---

## 🔗 9. Kompletter Workflow (Task + UI + Events)

> Für komplexe Anforderungen, die Task-Logik UND UI gleichzeitig betreffen.

```
AUFGABE: Kompletter Workflow

Ziel: {Was soll der User erreichen können?}
Stage: {stage_id}

UI-Elemente:
1. [{Typ}] {Name} — {Beschreibung}
2. [{Typ}] {Name} — {Beschreibung}

Variablen:
- {Name}: {Typ} = {Startwert}

Ablauf:
1. User klickt auf {Komponente}
2. → Task {TaskName} wird ausgeführt:
   a) [{ActionTyp}] {was passiert}
   b) [{ActionTyp}] {was passiert}
   c) Wenn {Bedingung}: {was dann} / Sonst: {was sonst}
3. Ergebnis wird in {Komponente} angezeigt via Binding ${Variable}
```

**Beispiel:**
```
AUFGABE: Kompletter Workflow

Ziel: User kann sich einloggen und sieht Fehlermeldung bei falschem Passwort
Stage: stage_login

UI-Elemente:
1. [TEdit] UsernameInput — Eingabefeld für Benutzername
2. [TEdit] PasswordInput — Eingabefeld für Passwort (masked)
3. [TButton] LoginBtn — "Anmelden" Button
4. [TLabel] ErrorLabel — Fehlermeldung (initial unsichtbar)

Variablen:
- loginResult: TObjectVariable = {}
- loginError: TStringVariable = ""

Ablauf:
1. User klickt auf LoginBtn
2. → Task "DoLogin" wird ausgeführt:
   a) [APICall] Sende POST /api/login mit UsernameInput.text + PasswordInput.text
   b) [SetVariable] Speichere Antwort in loginResult
   c) Wenn loginResult.success == true: NavigateTo stage_dashboard
      Sonst: SetVariable loginError = loginResult.message, zeige ErrorLabel
3. ErrorLabel zeigt ${loginError}
```

---

## 🧩 Verfügbare Komponenten-Typen

| Typ | Beschreibung |
|---|---|
| `TPanel` | Container/Bereich |
| `TButton` | Klickbarer Button |
| `TLabel` | Text-Anzeige |
| `TEdit` | Eingabefeld |
| `TImage` | Bild |
| `TCheckbox` | Checkbox |
| `TDropdown` | Auswahlliste |
| `TMemo` | Mehrzeiliges Textfeld |
| `TTable` | Tabelle / Card-Grid |
| `TList` | Listendarstellung |

## 🎬 Verfügbare Action-Typen

| Typ | Beschreibung |
|---|---|
| `SetVariable` | Variable setzen |
| `APICall` | HTTP-Request |
| `NavigateTo` | Stage wechseln |
| `ShowMessage` | Nachricht anzeigen |
| `SetProperty` | Komponenten-Property ändern |
| `Calculation` | Berechnung |
| `PlaySound` | Sound abspielen |
| `Timer` | Zeitgesteuert |
