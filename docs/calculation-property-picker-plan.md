# Berechnungs-Action: Property-Picker & Inspector-Ausbau

Schritt-für-Schritt-Plan für den ersten Implementierungsschritt.
Ziel: Der Property-Picker im Editor soll **Variable**, **Komponente**, **Listen-Element** und **Komponenten-Referenz** korrekt unterscheiden und bei Komponenten-Referenzen warnen.

---

## 1. Ausgangslage

- `JSONDialogRenderer.ts` rendert die Berechnungs-Action mit `resultVariable` und `formula`.
- `PropertyPickerDialog.ts` zeigt Properties eines Objekts (nur Eigenschaften).
- `VariablePickerDialog.ts` wählt Variablen (nur Werte).
- `TVariable.ts` hat bereits `type: VariableType`.

---

## 2. Step 1: Inspector-Labels korrigieren

**Ziel:** Verwirrende Bezeichnungen anpassen.

- [ ] In `JSONDialogRenderer.ts` (Bereich `calculate`) das Label `Ziel-Variable` auf **Ziel** ändern.
- [ ] In `JSONDialogRenderer.ts` das Label `Formel` auf **Ausdruck** oder **Wert** ändern.
- [ ] Tooltips ergänzen, z. B.:
  - **Ziel**: "Variable, Komponente oder Eigenschaft, die verändert wird."
  - **Wert**: "Zahl, String, Variable, Komponente oder Ausdruck."

**Dateien:**
- `src/editor/JSONDialogRenderer.ts`

---

## 3. Step 2: Property-Picker-Modi einführen

**Ziel:** Beim Öffnen des Pickers kann der User zuerst die Kategorie wählen.

- [ ] `PropertyPickerDialog.ts` um einen **Modus-Selektor** erweitern:
  - `Variable`
  - `Komponente`
  - `Listen-Element`
  - `Komponenten-Referenz`
  - `Sonderwert` (z. B. `StageTimer`)
- [ ] Je nach Modus unterschiedliche Listen rendern:
  - **Variable:** vorhandene Variablen (`RuntimeVariableManager` / `project.variables`).
  - **Komponente:** Objekte der aktuellen Stage + globale Objekte.
  - **Listen-Element:** Object-Lists + Index-Auswahl (`[0]`, `[]` für current).
  - **Komponenten-Referenz:** wie Komponente, aber speichert den Objekt-Namen.
  - **Sonderwert:** Laufzeit-Werte wie `StageTimer`, `currentInterval`.
- [ ] Rückgabe einheitlich als String, z. B.:
  - Variable: `${myVar}`
  - Komponenten-Eigenschaft: `Player.x`
  - Listen-Element: `myList[0]`
  - Komponenten-Referenz: `Ufo` (ohne Property)

**Dateien:**
- `src/editor/inspector/PropertyPickerDialog.ts`
- `src/editor/inspector/VariablePickerDialog.ts` (ggf. wiederverwenden)

---

## 4. Step 3: Warnung bei Komponenten-Referenz

**Ziel:** User über Laufzeit-Risiken informieren.

- [ ] In `PropertyPickerDialog.ts` / `JSONDialogRenderer.ts` erkennen, wenn ein Wert eine Komponenten-Referenz ist (keine Eigenschaft, sondern ein Objekt).
- [ ] Gelbe Warnmeldung anzeigen:
  > "Achtung: Hier wird eine Komponentenreferenz gespeichert. Sie wird ungültig, wenn die Komponente zerstört oder recycelt wird."
- [ ] Optional: Warnung nur einmal pro Action speichern, damit sie nicht nervt.

**Kriterium für Warnung:**
- Ziel ist eine `TVariable`.
- Ausdruck ist ein einzelner Komponenten-Name (`Ufo`) oder `MyObjList[0]` und nicht nur eine Eigenschaft (`Ufo.x`).

**Dateien:**
- `src/editor/JSONDialogRenderer.ts`
- `src/editor/inspector/PropertyPickerDialog.ts`

---

## 5. Step 4: Berechnungs-Action-Karte anpassen

**Ziel:** Neue Felder und Layout aufnehmen.

- [ ] `calculate`-UI in `JSONDialogRenderer.ts` oder `ActionParamRenderer.ts` anpassen:
  - Ziel: Breite Zeile mit Picker-Button.
  - Wert: Separate volle Zeile mit Picker-Button.
  - Keine `:=`-Darstellung im Eingabefeld, sondern als Überschrift zwischen den Feldern.
- [ ] Bereits vorhandene `CalcFormulaInput` und `CalcResultVariable` auf neues Layout umbauen.
- [ ] Speicherformat bleibt `resultVariable` + `formula`.

**Dateien:**
- `src/editor/JSONDialogRenderer.ts`
- `src/editor/ActionParamRenderer.ts` (falls dort rendern)

---

## 6. Step 5: Validierung & Build

- [ ] `npx tsc --noEmit` laufen lassen.
- [ ] `npm run bundle:runtime` (falls Runtime betroffen — hier eher nicht).
- [ ] Editor neu laden und eine `Calculate`-Action testen:
  - `myVar := 5`
  - `Player.x := Player.x + 1`
  - `myList[0].score := myList[0].score + 10`
  - `myVar := Ufo` (Warnung prüfen)

---

## 7. Out of Scope (später)

- Variable-Typen (`TSprite`, `TUfo`) ergänzen.
- ID-basierte sichere Komponentenreferenzen (`myVar := "Ufo"`).
- Autocomplete im Formel-Feld.
- Live-Vorschau des Ergebnisses.

---

## 8. Nächster Schritt

**Go geben** für Step 1 → `JSONDialogRenderer.ts` Labels anpassen.
