# Referenz: ExpressionParser

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (uncommittet)
> **Quelle:** `src/runtime/ExpressionParser.ts` (463 Zeilen) — Parser-Basis: `jsep`, Evaluierung: eigener AST-Interpreter mit Sicherheits-Allowlists

Der `ExpressionParser` wertet `${…}`-Ausdrücke in Strings aus. Er wird überall dort benutzt, wo Parameterwerte, Bedingungen oder Bindings Strings enthalten: Action-Parameter, Condition-Operanden, Property-Bindings in Komponenten.

## 1. Eintrittspunkte

| Methode | Zweck |
|---|---|
| `interpolate(text, context, allowedCalls?)` | String mit `${…}` mischen → interpolierter String oder Rohwert (wenn Gesamt-String nur ein Ausdruck) |
| `evaluate(expression, context, allowedCalls?)` | Ausdruck ohne `${…}`-Wrapper → Wert |
| `evaluateRaw(expression, context, allowedCalls?)` | wie `evaluate`, entfernt vorher `${…}` falls vorhanden |
| `findExpressions(text)` | Liste aller `${…}`-Inhalte |
| `getNestedProperty(path, context)` / `setNestedProperty(path, value, context)` | Pfad-Zugriff mit `.`-Notation und `[i]`-Indizes |
| `extractDependencies(expression)` | Root-Identifier einer Expression (Binding-Abhängigkeiten) |

## 2. Unterstützte Syntax

**Interpolation:** `"Punkte: ${score}"` — geschachtelte `${…}` werden inner-out aufgelöst (`interpolate` ist rekursiv). Bleibt das Ergebnis `undefined` und enthält der Ausdruck noch `${`, wird das Tag wörtlich beibehalten (Fail-Safe).

**Literale:** `true`, `false`, `null`, `undefined`, Zahlen (automatisch `Number()`), Strings in Anführungszeichen.

**Pfade:** `playerName`, `player.score`, `List_15[0]` (Index-Notation wird zu `.0` normalisiert).

**AST-Ausdrücke (jsep):**

| Kategorie | Operatoren / Konstrukte |
|---|---|
| Arithmetik | `+ - * / %` |
| Vergleich | `== != === !== < > <= >=` |
| Logik | `&& \|\|` (Short-Circuit), `!` (unär) |
| Unär | `- + ~ typeof` |
| Bedingt | `a ? b : c` (ConditionalExpression) |
| Array | `[1, 2, x]` (ArrayExpression) |
| Member | `obj.prop`, `obj[expr]` |
| Aufruf | `f(a, b)` — **nur Allowlist** |

## 3. Aufruf-Allowlists (Sicherheit)

**Freie Funktionen** (als Identifier): `Math`, `Number`, `String`, `Boolean`, `parseInt`, `parseFloat`, `isNaN`, `checkNumberAnswer`, `checkCardAnswer`, `createAnswerChoices`.

**Aufrufbare Funktionen** (`funcNameStr` gegen Set): `Math.floor`, `Math.ceil`, `Math.round`, `Math.random`, `Math.min`, `Math.max`, `Math.abs`, `Math.sqrt`, `Math.pow`, `parseInt`, `parseFloat`, `isNaN`, `isFinite`, `Number`, `String`, `Boolean`, `checkNumberAnswer`, `checkCardAnswer`, `createAnswerChoices`.

**Prototyp-Methoden auf primitiven Objekten** (Member-Call, egal welches Objekt): `toUpperCase`, `toLowerCase`, `trim`, `replace`, `substring`, `substr`, `split`, `includes`, `indexOf`, `lastIndexOf`, `charAt`, `concat`, `join`, `slice`, `push`, `pop`, `shift`, `unshift`, `splice`, `reverse`.

**Projekt-spezifisch erweiterbar:** `allowedCalls`-Parameter erlaubt dem Aufrufer zusätzliche Funktionsnamen (z. B. `GameRuntime` reicht erlaubte Task-Aufrufe durch).

**Hart gesperrt:** `__proto__`, `constructor`, `prototype` als Member/Call → `Security Violation`-Error.

Nicht-allowlistete Aufrufe → `Function call '…' blocked by security allowlist` → `undefined` (kein Throw nach außen — wird geloggt).

## 4. Wert-Auflösung &amp; Kontext

`context` ist i. d. R. der `RuntimeVariableManager.contextVars`-Proxy (siehe `variables.md`). Identifier-Auflösung:

- `Identifier` → `context[name]` → `PropertyHelper.resolveValue()` (entpackt `TVariable.value` etc.)
- `MemberExpression` auf Identifier → **roher** Zugriff ohne Pre-Resolve (Fix: `TVariable.value` würde sonst vorzeitig primitiv werden → `NaN`)
- Spezial-Scope-Prefixe werden vom Proxy, nicht vom Parser gehandhabt: `global.X`, `stage.X`, `$event.data.y`, `$params.p`

**Fail-Safe-Verhalten:** `ReferenceError` → Warn + `undefined`. Jeder andere Evaluierungsfehler → Warn + `undefined`. Parse-Fehler → Warn + `undefined`. **Kein Throw nach außen.**

## 5. Stringifizierung (`valueToString`)

Wird der `${…}`-Wert in einen größeren String eingebettet:

| Wert | Ergebnis |
|---|---|
| `undefined` / `null` | `''` |
| `number` / `boolean` | `String(v)` |
| `TVariable` etc. | aufgelöster Inhalt (rekursiv) |
| `Array` | Elemente kommasepariert |
| Objekt mit `name`-String | `name` |
| Objekt mit `className` | `[ClassName]` |
| sonstiges Objekt | `JSON.stringify` (max. 50 Zeichen, dann `…`) |

## 6. Beispiele

```json
{ "type": "property", "changes": { "Hinweis.text": "Fehler: ${Antwort.message}" } }
```

```json
{ "type": "calculate", "resultVariable": "Summe", "formula": "Summe := ${Punkte} + 10" }
```

Innerhalb von `formula` toleriert `evaluate` `${…}`-Tags — sie werden vor dem Parsen entfernt (`Z. 156–158`). Bedeutung: `${score} + 1` und `score + 1` sind äquivalent.

Gültige Ausdrücke: `${Math.floor(score / 10)}`, `${player.name.toUpperCase()}`, `${items[0]}`, `${x > 5 ? 'groß' : 'klein'}`, `${$event.source.name}`.

## 7. Bekannte Einschränkungen &amp; Fehler

- **Debug-Logging-Artefakte:** mehrere Stellen loggen bei Pfaden, die `StageTimer`/`currentInterval`/`BaseVar`/`availableVariableFields` enthalten (`BIND-DEBUG`, Z. 176, 187, 397, 458) — Entwicklungs-Reste.
- **Array-Methoden auf beliebigen Objekten:** die Prototyp-Allowlist wird nicht auf den Typ geprüft — `obj.push()` auf Nicht-Arrays wirft einen Laufzeitfehler im Handler (wird als `undefined` geloggt).
- **`setNestedProperty`** erzeugt bei fehlenden Zwischengliedern automatisch `{}` (Auto-Vivification, Z. 415–418).
- **Verschachtelte `${…}`** werden inner-out interpoliert; bei unauflösbarem äußeren Ausdruck bleibt das innere Tag wörtlich stehen — kann zu `undefined`-Impressionen führen.
- **`extractDependencies`** ist heuristisch (Regex), erkennt keine String-Literale/Keywords jenseits der harten Liste.

## 8. Tests

| Datei | Status |
|---|---|
| `src/runtime/ExpressionParser.test.ts` | Test vorhanden, nicht ausgeführt |
