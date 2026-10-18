# Naming-Conventions (Benennungs-Regeln) für Tasks & Actions

> **Zweck:** Aus umgangssprachlich formulierten Anforderungen reproduzierbar gute Namen für Tasks und Actions ableiten.
>
> **Geltungsbereich:** AgentController-Skripte (`scripts/*.builder.ts`, `demos/builders/*`), Inspector-Editor und alle manuell angelegten GCS-Projekte.

---

## §1 Theoretische Einordnung

Dein GCS-System ist im Kern **Event-Driven** (ereignis-getrieben) mit **CQRS-Charakter** (*Command Query Responsibility Segregation* — Trennung von Befehl- und Abfrage-Verantwortung):

| GCS-Konzept | Theoretische Entsprechung |
|:---|:---|
| **Event** (`onClick`, `onTimer`) | Domain Event (Domänen-Ereignis) |
| **Task** | Command Handler (Befehls-Verarbeiter) / Use Case (Anwendungsfall) |
| **Action** | Atomic Operation (atomare Operation) auf einem Aggregat |
| **Variable / Komponente** | Aggregate (Aggregat) bzw. State-Container (Zustands-Speicher) |

Daher gelten die Naming-Conventions aus folgenden Disziplinen direkt für GCS:

- **CQRS Commands** → Imperativ `Verb + Substantiv` (`CreateOrder`, `CancelReservation`)
- **Event Storming** → Domänen-Sprache statt Tech-Sprache
- **DDD Ubiquitous Language** (Allgegenwärtige Domänen-Sprache) → Begriffe aus der Anwendungs-Domäne wiederverwenden
- **BDD/Gherkin** (*Behavior-Driven Development*) → Given/When/Then-Sätze (Gegeben/Wenn/Dann) als Quelle der Verb-Phrasen
- **Clean Code (Robert C. Martin)** → "Intention-revealing names" (Absichts-offenbarende Namen)

---

## §2 Die 5-Schritte-Pipeline (Ableitungs-Verfahren)

```
Umgangssprache  →  Trigger  →  Task-Name  →  atomare Schritte  →  Action-Namen
```

### Schritt 1 — User-Story als Ein-Satz-Aussage

Formuliere die Anforderung in genau **einem Satz** mit klarer Auslöser-Wirkung-Kette:

> *"Wenn der Spieler die zweite Karte anklickt, sollen die Versuche erhöht und geprüft werden, ob beide Karten gleich sind."*

### Schritt 2 — Trigger (Auslöser) isolieren

Der Trigger hat immer die Form `<Komponente>.<Event>`:

- `Card.onClick`
- `CountdownTimer.onTimer`
- `Stage.onRuntimeStart`

### Schritt 3 — Task benennen

**Schema:** `<Modus><Domain-Verb><Domain-Objekt>` in **PascalCase**, **maximal 3 Worte**.

Zwei Modi haben sich bewährt:

| Modus | Wann verwenden | Beispiel |
|:---|:---|:---|
| **`On<Event>`** | Direkter Event-Handler, der mehrere Schritte koordiniert | `OnCardClick`, `OnTimerTick` |
| **Imperativ-Verb** (Befehlsform) | Wiederverwendbare Sub-Tasks oder Initial-Setup | `InitGame`, `ShuffleCards`, `CheckWin` |

**Faustregel:** An genau **ein** Event direkt gebunden → `On<Event>`. Von mehreren Stellen oder als Sub-Task aufgerufen → Imperativ-Verb.

### Schritt 4 — Aktions-Plan in Verben

Zerlege die User-Story in einen "Plan in Verben" (jeder Schritt = eine Action):

> "Versuche erhöhen" + "erste Karte holen" + "Match prüfen" + (wenn Match) "markieren + Score erhöhen + IDs zurücksetzen"

Das sind 4 logische Phasen → 4 Actions (oder ein Sub-Task für die letzte Phase).

### Schritt 5 — Action-Namen nach Schema bilden

**Schema:** `<Verb><Objekt>[<Qualifier>]` in **PascalCase**, **maximal 3-4 Worte**.

| Action-Kategorie | Pattern | Beispiel |
|:---|:---|:---|
| **State-Mutation** (Zustands-Änderung) | `Set/Reset/Inc/Dec/Toggle + <Var>` | `IncScore`, `ResetFirstIdx` |
| **Komponenten-Property** | `<Verb><Komponente>` oder `<Property><Komponente>` | `HideFirstCard`, `FlipUpCard` |
| **Berechnung / Evaluation** (Auswertung) | `Eval/Calc/Check + <Subject>` | `EvalCanFlip`, `EvalMatch` |
| **Datenzugriff** (lesend) | `Get/Read/Load + <Item>` | `GetClickedCard`, `GetFirstCard` |
| **Listen-Operation** | `Push/Pop/Shuffle/Clear + <Liste>` | `ShuffleCards`, `PushCard` |
| **UI-Sichtbarkeit** | `Show/Hide/Open/Close + <Komponente>` | `ShowWinDialog`, `CloseMenu` |

---

## §3 Verb-Inventar (mit deutscher Bedeutung)

> **Hinweis:** Verwende im Code-Namen immer die **englische** PascalCase-Form (international, kürzer, frei von Umlauten). Die deutsche Übersetzung dient nur dem Verständnis.

### §3.1 Zustand & State-Mutation (Zustand & Zustands-Änderung)

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Set` | setzen | Wert zuweisen: `SetScore`, `SetFirstIdx` |
| `Reset` | zurücksetzen | Auf Default-Wert: `ResetScore`, `ResetTimer` |
| `Clear` | leeren | Container/Liste leeren: `ClearCards`, `ClearLog` |
| `Inc` / `Increment` | erhöhen (um 1) | `IncScore`, `IncAttempts` |
| `Dec` / `Decrement` | verringern (um 1) | `DecLives`, `DecCountdown` |
| `Toggle` | umschalten | Boolean kippen: `ToggleSound`, `TogglePause` |
| `Init` / `Initialize` | initialisieren | Erst-Aufbau: `InitGame`, `InitDeck` |

### §3.2 Lebenszyklus (*Lifecycle*)

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Start` | starten | `StartTimer`, `StartGame` |
| `Stop` | anhalten / stoppen | `StopTimer`, `StopAudio` |
| `Pause` | pausieren | `PauseGame`, `PauseAnimation` |
| `Resume` | fortsetzen | `ResumeGame`, `ResumeTimer` |
| `Restart` | neu starten | `RestartLevel`, `RestartTimer` |
| `Tick` | Takt-Schritt | meist als Trigger: `OnTimerTick` |

### §3.3 Sichtbarkeit & UI-Effekt

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Show` | anzeigen | `ShowWinDialog`, `ShowMenu` |
| `Hide` | verbergen | `HideMenu`, `HideButton` |
| `Reveal` | aufdecken (mit Inhalt zeigen) | `RevealCard`, `RevealAnswer` |
| `Conceal` | verdecken / verstecken | `ConcealAnswer` |
| `Flash` | aufblitzen lassen | `FlashError`, `FlashScore` |
| `FadeIn` | einblenden | `FadeInOverlay` |
| `FadeOut` | ausblenden | `FadeOutOverlay` |
| `Open` | öffnen | `OpenSidebar`, `OpenDialog` |
| `Close` | schließen | `CloseDialog`, `CloseMenu` |

### §3.4 Datenzugriff

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Get` | holen / lesen (lokal) | `GetFirstCard`, `GetScore` |
| `Read` | lesen (explizit, oft externe Quelle) | `ReadFile`, `ReadInput` |
| `Load` | laden (vollständig, oft async) | `LoadLevel`, `LoadAssets` |
| `Fetch` | abrufen (von außen, meist HTTP) | `FetchHighscore`, `FetchUser` |
| `Find` | suchen / finden | `FindEnemy`, `FindMatch` |
| `Capture` | erfassen (Snapshot) | `CaptureClickedIdx`, `CaptureScreen` |
| `Save` | speichern | `SaveScore`, `SaveProgress` |
| `Store` | ablegen (in Variable/Cache) | `StoreToken`, `StoreResult` |

### §3.5 Listen-Operationen (*Collection*)

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Push` | anhängen (am Ende) | `PushCard`, `PushLog` |
| `Pop` | entnehmen (vom Ende) | `PopLastCard` |
| `Append` | anhängen (Synonym zu Push) | `AppendMessage` |
| `Insert` | einfügen (an Position) | `InsertCardAt` |
| `Remove` | entfernen | `RemoveCard`, `RemoveEnemy` |
| `Shuffle` | mischen | `ShuffleCards`, `ShuffleDeck` |
| `Sort` | sortieren | `SortHighscores` |
| `Filter` | filtern | `FilterMatched` |

### §3.6 Berechnung & Auswertung

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Eval` / `Evaluate` | auswerten (boolesch oder Ausdruck) | `EvalCanFlip`, `EvalIsFirst` |
| `Calc` / `Calculate` | berechnen (numerisch) | `CalcDistance`, `CalcDamage` |
| `Compute` | berechnen (Synonym, oft komplexer) | `ComputePath` |
| `Compare` | vergleichen | `CompareValues` |
| `Check` | prüfen (mit Konsequenz) | `CheckWin`, `CheckCollision` |
| `Validate` | validieren (gegen Regeln) | `ValidateInput`, `ValidateForm` |

### §3.7 Mutation & Transformation

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Mark` | markieren (logisches Flag setzen) | `MarkAsMatched`, `MarkVisited` |
| `Tag` | etikettieren | `TagAsActive` |
| `Flip` | umklappen / wenden | `FlipCard`, `FlipImage` |
| `Rotate` | drehen | `RotateSprite` |
| `Move` | bewegen | `MovePlayer`, `MoveCamera` |
| `Spawn` | erzeugen / hervorrufen | `SpawnEnemy`, `SpawnParticle` |
| `Destroy` | zerstören / entfernen | `DestroyEnemy` |

### §3.8 Navigation

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Goto` | gehe zu | `GotoMainMenu`, `GotoLevel2` |
| `Navigate` | navigieren | `NavigateToStage` |
| `Back` | zurück | `BackToMenu` |
| `Forward` | vorwärts | `ForwardToNext` |

### §3.9 Kommunikation

| Verb (EN) | Bedeutung (DE) | Typische Verwendung |
|:---|:---|:---|
| `Notify` | benachrichtigen | `NotifyPlayer` |
| `Alert` | warnen | `AlertGameOver` |
| `Log` | protokollieren | `LogScore`, `LogError` |
| `Emit` | aussenden (Event) | `EmitWin`, `EmitDamage` |
| `Broadcast` | rundsenden | `BroadcastChat` |

---

## §4 Disambiguierung (Eindeutigmachung) bei Wiederholung

Wenn dieselbe Operation in einem Task mehrfach vorkommt, **niemals** mit `_1`, `_2`, `_3` durchnummerieren — stattdessen mit **kontextueller Bedeutung** suffigieren:

| ❌ Schlecht (durchnummeriert) | ✅ Besser (kontextuell) |
|:---|:---|
| `ResetFirstIdx_1` | `ResetFirstIdx_Init` |
| `ResetFirstIdx_2` | `ResetFirstIdx_Flip` |
| `ResetFirstIdx_3` | `ResetFirstIdx_Match` |
| `HideCard_1` | `HideCard_OnFlip` |
| `HideCard_2` | `HideCard_OnReset` |

**Begründung:** Suffix beschreibt **warum** diese Instanz existiert, nicht nur **dass** es eine weitere ist.

---

## §5 Anti-Patterns (Anti-Muster — was nicht tun)

| Anti-Pattern | Problem | Beispiel | Korrektur |
|:---|:---|:---|:---|
| **Tech-Slang im Namen** | nicht-Domänen-Vokabular leakt rein | `ProcessXmlPayload` | `ParseConfig` |
| **Nichtssagende Verben** | sagt nichts über die Wirkung | `DoStuff`, `HandleData`, `Manage` | `UpdateScore`, `ValidateInput` |
| **Negation im Namen** | erschwert Lesen bei Branches | `IfNotEmpty` | `IfHasItems` |
| **Substantiv statt Verb** (Tasks/Actions) | klingt wie Datenstruktur | `CardClick`, `ScoreUpdate` | `OnCardClick`, `UpdateScore` |
| **Abkürzungen** | ohne Kontext kryptisch | `EvCFlp`, `IncSc` | `EvalCanFlip`, `IncScore` |
| **Implementierungs-Detail** | Name ändert sich bei Refactoring | `LoopThrough16Cards` | `IterateCards` |
| **Doppelte Verneinung** | logisch verwirrend | `DisableNotEnabled` | `EnableX` / `DisableX` |
| **Zu generisch** | Wiederverwendung unklar | `Update`, `Process` | `UpdateScore`, `ProcessClick` |

---

## §6 Selbstkritik am Memory-Beispiel (Stand `scripts/MemoryGameBuilder.ts`)

Wenn man dieses Schema strikt anwendet, ergibt sich folgende Bewertung:

| Action | Bewertung | Verbesserungs-Vorschlag |
|:---|:---:|:---|
| `ShuffleCards` | ✅ | klar, idiomatisch |
| `IncScore`, `IncAttempts` | ✅ | klar |
| `EvalCanFlip`, `EvalIsFirst`, `EvalMatch` | ✅ | konsistentes `Eval`-Präfix |
| `ResetFirstIdxInit`, `ResetFirstIdxFlip`, `ResetFirstIdxMatch` | ✅ | Suffix beschreibt Kontext, nicht Reihenfolge — vorbildlich |
| `ShowWinDialog` | ✅ | Verb + Komponente |
| `GetIdxStr` | ⚠️ | technisch (`Str` = Datentyp) — besser: `CaptureClickedIdx` |
| `ParseIdx` | ⚠️ | besser: `ConvertIdxToNumber` oder `NormalizeIdx` |
| `FlipUp` | ⚠️ | Komponente fehlt — besser: `RevealCard` oder `FlipCardUp` |
| `MatchFirst`, `MatchSecond` | ⚠️ | Verb mehrdeutig — besser: `MarkFirstAsMatched`, `MarkSecondAsMatched` |
| `HideFirstFlip`, `HideSecondFlip` | ⚠️ | "Flip" als Suffix unscharf — besser: `HideFirstCard_OnReset`, `HideSecondCard_OnReset` |

**Erkenntnis:** Etwa 70 % folgen dem Schema bereits intuitiv. Verbleibende Schwachstellen entstehen, wenn Variablen-Namen (statt Komponenten-Namen) im Action-Namen auftauchen oder wenn Datentypen (`Str`, `Idx`) ins Naming leaken.

---

## §7 Praktische Heuristiken (Faustregeln)

1. **Lies den Namen laut vor.** Wenn er sich wie eine Anweisung anfühlt → gut. Wenn er sich wie ein Datenfeld anhört → schlecht.
2. **Würfeltest:** Lass jemanden den Namen sehen, der den Code nicht kennt. Kann er die Wirkung erraten? → Name ist gut.
3. **Kein Datentyp im Namen.** Nicht `Str`, `Int`, `Bool`, `List`, `Idx` — der Name beschreibt **was**, nicht **wie**.
4. **Komponente und Eigenschaft im Action-Namen.** Mindestens **eines** von beidem muss vorkommen.
5. **Maximal 3-4 Worte.** Längere Namen weisen auf zu viel Verantwortung in einer Action hin → in zwei Actions splitten.
6. **Konsistenz schlägt Eleganz.** Wenn du im Projekt überall `IncX` benutzt, dann nicht plötzlich `IncrementY` schreiben.
7. **Ein Task hat ein Ziel, nicht zwei.** Wenn du im Task-Namen ein "and" / "Und" einbauen willst → in zwei Tasks aufteilen.

---

## §8 Quellen / Webseiten

| Thema | Link |
|:---|:---|
| **CQRS Command Naming** | `martinfowler.com/bliki/CommandQuerySeparation.html` |
| **Event Storming** (Workshop-Methode für Domain-Events) | `eventstorming.com` |
| **DDD Ubiquitous Language** | `martinfowler.com/bliki/UbiquitousLanguage.html` |
| **DDD Community** | `dddcommunity.org` |
| **BDD / Gherkin Reference** | `cucumber.io/docs/gherkin/reference` |
| **Clean Code Cheat-Sheet (deutsch)** | `clean-code-developer.com` |
| **Clean Code Naming Cheat-Sheet (englisch, sehr kompakt)** | `gist.github.com/wojteklu/73c6914cc446146b8b533c0988cf8d29` |
| **Naming Cheatsheet (GitHub, ⭐ 23k+)** | `github.com/kettanaito/naming-cheatsheet` |
| **REST/API Resource Naming** | `restfulapi.net/resource-naming` |
| **.NET Member Naming Guidelines** (übertragbar auf PascalCase) | `learn.microsoft.com/en-us/dotnet/standard/design-guidelines/names-of-type-members` |
| **Refactoring.Guru — Code Smells & Patterns** | `refactoring.guru/refactoring/smells` |
| **Microservices Pattern (Chris Richardson) — Event-Driven** | `microservices.io/patterns/data/event-driven-architecture.html` |

### §8.1 Empfohlene Bücher (jeweils mit Naming-Kapiteln)

- **Robert C. Martin** — *Clean Code* (Kapitel 2: "Meaningful Names" / "Aussagekräftige Namen")
- **Eric Evans** — *Domain-Driven Design* (Teil II: "Ubiquitous Language")
- **Vaughn Vernon** — *Implementing Domain-Driven Design* (praxisnäher als Evans)
- **Alberto Brandolini** — *Introducing EventStorming* (Online: `leanpub.com/introducing_eventstorming`)
- **Steve McConnell** — *Code Complete* (Kapitel 11: "The Power of Variable Names")

---

## §9 Offene Diskussionspunkte

Diese Punkte sind nicht abschließend entschieden und sollten projekt-intern festgelegt werden:

| Frage | Optionen | Empfehlung (vorläufig) |
|:---|:---|:---|
| `On<Event>` vs. `Handle<Event>`? | Beide gängig | `On*` — kürzer, in JS/TS verbreitet |
| Komponententyp im Namen? | `ShowWinDialog` vs. `ShowWin` | Komponente nennen wenn nötig zur Disambiguierung |
| Suffix-Stil für Wiederholungen? | `_Init` / `OnInit` / `Initial` | `_Init` (bestehender Stil im Memory) |
| Inc/Dec ausschreiben? | `IncScore` vs. `IncrementScore` | Kurzform — international Standard |
| Boolean-Eval-Präfix? | `Eval*` vs. `Is*` vs. `Has*` | `Eval*` für Action-Name, `is*`/`has*` für die Variable |

---

**Stand:** 06.05.2026 · **Autor:** initial diskutiert mit Cascade · **Verbindlichkeit:** Empfehlung — Abweichungen mit Begründung sind erlaubt.
