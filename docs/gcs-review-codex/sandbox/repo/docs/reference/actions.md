# Referenz: Action-Typen (Runtime)

> **Status:** `entwurf` · **Analyse-Basis:** Working Tree (uncommittet) · Metadaten wurden aus der **tatsächlichen Registry extrahiert** (esbuild-Bundle von `ActionRegistry` + allen Handlern, nicht geraten)
> **Quellen:** `src/runtime/ActionRegistry.ts`, `src/runtime/ActionExecutor.ts`, `src/runtime/actions/StandardActions.ts` + `src/runtime/actions/handlers/*.ts`

## Übersicht

**59 registrierte Action-Typen** (inkl. Alias-Typen). Jeder Typ ist in `ActionRegistry` mit einem `ActionMetadata`-Record und einem Handler verknüpft. `ActionExecutor` löst das Item gegen die Registry auf und übergibt dem Handler einen `ActionContext` mit `vars`, `contextVars`, `objects`, `eventData`, `multiplayerManager`, `runTask` u. a.

Flag-Legende:

- **`[hidden]`** — Typ ist registriert, aber nicht in der Editor-Palette sichtbar (`hidden: true`)
- **`[server]`** — nur im deklarativen Server-Modus (`requiresServer: true`, z. B. `TServerEndpoint`-Kontext)
- **`[mp]`** — erfordert aktive Multiplayer-Verbindung (`requiresMultiplayer: true`)

## Dispatch-Mechanismus

`ActionExecutor.execute(action, vars, contextVars, eventData, logId)`:

1. Typ-Auflösung: explizites `type`-Feld, sonst Inferenz aus Schlüsselfeldern (`changes` → `property`, `variableName` → `variable`, …)
2. `${…}`-Interpolation aller Parameterwerte via `PropertyHelper`
3. `ActionRegistry.execute(type, params, context)` → Handler-Aufruf mit Diagnose-Wrapper
4. `$params`-Objekt für Action-Bodies (composite actions)

Echte JSON-Beispiele aus `GCS-CMS.json` (`stage_blueprint.actions`):

```json
{
  "id": "9aa50fa9-51a5-4bac-ace3-69e3dd8df6be",
  "name": "Act_Fehlermeldung_anzeigen__Status_Und_Anzeige_Aktualisieren",
  "type": "property",
  "changes": { "Busy": 0, "Hinweis.text": "${Antwort.message}" },
  "scope": "global"
}
```

```json
{
  "name": "Act_Spielersitzung_beenden__Server_Sitzung_Beenden",
  "type": "http",
  "url": "/api/cms/logout",
  "method": "POST",
  "body": "{\"token\":\"${Token}\"}",
  "resultVariable": "Antwort",
  "queryOperator": "==",
  "scope": "global"
}
```

---

## 1. Daten &amp; Eigenschaften

`PropertyActions.ts` — Kern aller Zuweisungen. `changes` ist eine Key-Value-Map: Schlüssel = Zielpfad (`VarName`, `Objekt.prop`, `global.X`, `stage.X`), Wert = neuer Wert (wird interpoliert).

| Typ | Flags | Parameter | Wirkung |
|---|---|---|---|
| `property` | — | `changes` (keyvalue) | Setzt Variablen/Objekt-Props auf neue Werte |
| `action` | — | `changes` | Alias für `property` |
| `set_child_property` | — | `target` (TGroupPanel), `childName`, `changes` (JSON) | Ändert Property eines Kind-Elements im Group-Panel |
| `variable` | — | `variableName`, `value` / `source`+`sourceProperty` | Liest Quelle → schreibt Ziel-Variable |
| `set_variable` | `[hidden]` | wie `variable` | identisch — nur Registrierungs-Alias |
| `calculate` | — | `resultVariable`, `formula` | `Ziel := Ausdruck` — Formel über `ExpressionParser` |
| `negate` | — | `changes` (Liste von Zielen) | `x` → `-x` auf Ziel-Variablen/-Props |
| `increment` | — | `changes` | Addiert Wert auf bestehende Ziele |

**Voraussetzungen:** Ziel existiert (Variable/Objekt), sonst Warn-Log + No-op. `changes`-Schlüssel werden über `PropertyHelper.setNestedProperty` aufgelöst; bei `X.prop`-Form wird die Komponente gesucht und `prop` geschrieben (reactive).

## 2. Animation

`AnimationActions.ts` + `EffectActions.ts`.

| Typ | Parameter | Wirkung |
|---|---|---|
| `animate` | `target`, `effect`, `duration` + effect-spezifisch: `source`, `targetScale`, `fragments`, `spread`, `degrees`, `intensity`, `height`, `targetOpacity`, `midpointTask` | Startet Effekt auf Objekt |
| `move_to` | `target`, `x`, `y`, `duration`, `easing`, `lockDuringMove` | Positions-Tween |
| `sprite_animate` | `target`, `fromFrame`, `toFrame`, `duration` | Frame-Animation auf `TImageList`-Sprite |
| `shake_screen` | `intensity`, `duration` | Kamera-Shake (Screen-Level) |

**`animate`-Effekte** (Select-Optionen, real aus Registry): `shake`, `pulse`, `bounce`, `fade`, `grow`, `shrink`, `explode`, `pop`, `implode`, `fadeIn`, `fadeOut`, `spin`, `wobble`, `flip`, `flip3d`. Effekt-spezifische Parameter sind über `visibleWhen`-Regeln im Editor konditioniert.

```json
{ "type": "animate", "target": "self", "effect": "flip", "duration": 400, "midpointTask": "BildWechseln" }
```

## 3. Navigation &amp; Spiel-Lebenszyklus

`NavigationActions.ts`.

| Typ | Flags | Parameter | Wirkung |
|---|---|---|---|
| `navigate` | `[hidden]` | `target` | Wechsel zu anderem Projekt (CMS-Modus) |
| `navigate_stage` | — | `stageId`, `reset` | Stage-Wechsel im selben Projekt; `reset` baut Stage komplett neu auf |
| `restart_game` | — | — | Komplettes Projekt neu (inkl. Blueprint) — alle Werte zurück |

## 4. HTTP / Server

`HttpActions.ts`.

| Typ | Flags | Parameter |
|---|---|---|
| `http` | — | `url`, `method` (GET/POST/PUT/DELETE), `body`, `resultVariable`, `resultPath`, `selectFields`, `queryProperty`, `queryOperator` (==/!=/&gt;/&lt;/&gt;=/&lt;=/CONTAINS), `queryValue`, `directFetch` |
| `respond_http` | `[server]` | `requestId`, `status`, `data` — Antwort auf `TServerEndpoint.onRequest` |
| `execute_login_request` | `[hidden]` | — (intern verwaltet) |
| `data_action` | — | `dataStore`, `selectFields`, `queryProperty`, `queryOperator`, `queryValue` — deklarative Datenaktion gegen `TDataStore` |
| `handle_api_request` | `[server]` | — Dispatcher für API-Route im Server-Stage |

**Voraussetzungen:** `respond_http`/`handle_api_request` nur wenn die Runtime im Server-Modus läuft (`cms-runtime.cjs`); im Browser sind sie No-ops bzw. werden in der Palette verborgen.

## 5. Objekt-Pool

`ObjectPoolActions.ts`.

| Typ | Parameter | Wirkung |
|---|---|---|
| `spawn_object` | `templateId`, `referenceObject`, `spawnMode` (`normal`/`all_active`/`random_active`), `offsetX`, `offsetY`, `x`, `y` | Holt Pool-Instanz von `TSpriteTemplate` |
| `destroy_object` | `target` | Gibt Instanz zurück in Pool (unsichtbar) |

Pool-Instanzen werden mit `isPoolInstance: true` und `templateId`/`templateName` markiert — TaskExecutor's `preferLiveInstance` bevorzugt sie bei Dot-Notation-Auflösung.

## 6. Collections (Listen &amp; Maps)

`CollectionActions.ts`. Ziel (`target`) ist eine `TObjectList`/`TStringMap`-Variable.

| Listen-Typ | Parameter |
|---|---|
| `list_push` | `target`, `value` |
| `list_pop` | `target`, `resultVariable` |
| `list_get` | `target`, `index`, `field`, `resultVariable`, `defaultValue` |
| `list_set` | `target`, `index`, `value` |
| `list_remove` | `target`, `index`, `resultVariable` |
| `list_clear` | `target` |
| `list_shuffle` | `target`, `seed` |
| `list_contains` | `target`, `value`, `resultVariable` |
| `list_length` | `target`, `resultVariable` |

| Map-Typ | Parameter |
|---|---|
| `map_get` | `target`, `key`, `resultVariable`, `defaultValue` |
| `map_set` | `target`, `key`, `value` |
| `map_delete` | `target`, `key` |
| `map_has` | `target`, `key`, `resultVariable` |
| `map_keys` | `target`, `resultVariable` |

```json
{ "type": "list_push", "target": "Hand", "value": "${GezogeneKarte}" }
```

## 7. Record-Listen (strukturierte Zeilen)

`RecordListActions.ts` — für `TObjectList` mit `sourceMode: 'records'` (spalten-orientierte Daten).

| Typ | Parameter |
|---|---|
| `record_set` | `list`, `target` (Zeilen-Selector), `field`, `value` |
| `record_get` | `list`, `target`, `field`, `resultVariable` |
| `record_index` | `list`, `target`, `resultVariable` |
| `record_find` | `list`, `field`, `value`, `resultVariable` |
| `record_count` | `list`, `field`, `value`, `resultVariable` |
| `record_reset` | `list`, `field`, `value` |

## 8. Events

`EventActions.ts`.

| Typ | Parameter | Wirkung |
|---|---|---|
| `bind_event` | `target`, `event`, `task` | Laufzeit-Binding: Objekt-Event → Task |
| `unbind_event` | `target`, `event` | Löst das Binding |

## 9. Dialog &amp; UI

`DialogActions.ts`.

| Typ | Parameter |
|---|---|
| `toggle_dialog` | `target`, `mode` (open/close/toggle) |
| `show_toast` | `message`, `toastType` |
| `close_overlay` | `result` |

## 10. Stage-Interface (Server↔Client-Kommunikation)

`StageInterfaceActions.ts` — Brücke für deklarative Server-Stages.

| Typ | Parameter | Zweck |
|---|---|---|
| `stage_input` | `eventName`, `payload`, `correlationId`, `stageId`, `eventId`, `resultVariable` | Eingangs-Event in eine (Remote-)Stage injizieren |
| `stage_output` | `eventName`, `payload`, `correlationId`, `resultVariable` | Ausgang — Ergebnis an Aufrufer zurücksenden |

## 11. Sonstiges

`MiscActions.ts`.

| Typ | Flags | Parameter |
|---|---|---|
| `service` | — | `service`, `method`, `serviceParams` (JSON), `resultVariable` — ruft registrierte Service-Methode auf (z. B. `TServerSql`, `TServerData`) |
| `create_room` | `[mp]` | `game` — Multiplayer-Raum erzeugen |
| `join_room` | `[mp]` | `code` — Raum beitreten |
| `store_token` | `[hidden]` | `operation` (set/delete), `token`, `tokenKey` (default `auth_token`) |
| `call_method` | — | `target`, `method`, `params`, `resultVariable` — beliebige Objekt-Methode |
| `play_audio` / `stop_audio` | — | `target` |
| `load_theme_map` | — | `target`, `source` (TStringMap) |
| `set_active_theme` | — | `themeId`, `savePreference` |
| `show_theme_dialog` | — | `target` |

## Gemeinsame Voraussetzungen &amp; Grenzen

- **Ziel-Auflösung:** `target`-Parameter akzeptieren Objekt-Name, `-ID`, `"self"`/`%Self%` oder `${Var}`. Multi-Target: `animate` erlaubt Komma-Listen (`"Karte1, Karte2"`).
- **Nicht gefundene Ziele:** → Warn-Log + No-op (kein Exception).
- **Unbekannter `type`:** → `ActionExecutor` loggt `MISSING`, Ausführung wird übersprungen.
- **Interpolation:** alle String-Parameter laufen durch `${…}`-Evaluation vor dem Handler — unresolved `${…}` bleibt wörtlich und wird als Warnung geloggt (Registry-Diagnose-Wrapper).
- **`[server]`-Actions** in Browser-Runtime: Handler ist zwar registriert, schlägt aber fehl bzw. wird in der Editor-Palette ausgeblendet.
- **Typ-Inferenz:** fehlt `type`, wird aus Feldern geschlossen (`changes`→`property` etc.) — dokumentiertes Feature, aber Fehlerquelle bei nicht-eindeutigen Objekten.

## Tests

Kein dedizierter Action-Handler-Test identifiziert — das Gros wird über die Integrations-Tests (`test-cms-*.cjs`, `tests/reactive_runtime.test.ts` u. a.) indirekt mitgedeckt. **Test-Existenz ≠ Ausführung.**
