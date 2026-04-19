# Offene Befunde: Fehlende ComponentRegistry-Registrierung

> **Datum:** 2026-04-19  
> **Quelle:** Guard T-11 (`tests/guards.test.ts`) im Test-Lauf vom 19.04.  
> **Status:** 🟡 Offen — Verifizierung nötig, ob echte Bugs oder Sonderfälle  
> **Zu bearbeiten:** Später

---

## Ausgangspunkt

Der Guard-Test **T-11 „Component Registrierung (Barrel + Registry)"** prüft seit dem 19.04.2026 für jede Datei `src/components/T*.ts`:

1. Existiert ein Re-Export in `src/components/index.ts`? (Barrel)  
2. Existiert `ComponentRegistry.register('TName', ...)` in der Datei selbst?

Der initiale Testlauf hat **5 Komponenten** gefunden, die im Barrel exportiert sind, aber **keine** `ComponentRegistry.register(...)`-Zeile enthalten.

---

## Die 5 betroffenen Klassen

### 1. `TStage` — 🟡 Vermutlich Sonderfall

- **Datei:** `src/components/TStage.ts` (317 Zeilen)
- **Erbt von:** `TWindow`
- **Beobachtung:** Die Datei endet bei Zeile 316 ohne `ComponentRegistry.register`.
- **Hypothese:** Stages werden vermutlich durch eine **spezialisierte Stage-Factory** (z.B. `EditorStageManager`, `GameRuntime`) verwaltet, nicht über die generische Component-Registry. Das wäre architektonisch legitim.
- **Verifikations-Schritt:** Suchen, ob `new TStage(...)` irgendwo außerhalb der Hydration direkt aufgerufen wird und ob es einen `stageFactory`-Mechanismus gibt.
- **Wenn bestätigt:** Aufnahme in `NON_HYDRATABLE`-Liste des Guards mit Kommentar „Wird über Stage-Factory hydriert".

---

### 2. `TFlowStage` — 🟡 Vermutlich Sonderfall

- **Datei:** `src/components/TFlowStage.ts` (31 Zeilen)
- **Erbt von:** `TStage`
- **Beobachtung:** Dünne Spezialisierung von `TStage`. Gleiche Architektur-Logik.
- **Hypothese:** Gleiche wie `TStage` — Stages laufen über separate Factory.
- **Verifikations-Schritt:** Parallel zu `TStage` prüfen.
- **Wenn bestätigt:** Aufnahme in `NON_HYDRATABLE`.

---

### 3. `TDebugLog` — 🔴 **Möglicher echter Bug**

- **Datei:** `src/components/TDebugLog.ts` (633 Zeilen)
- **Erbt von:** (Klassen-Definition nicht auf einer Zeile — möglicherweise `TWindow` oder `TComponent`)
- **Kritischer Punkt:** Die Klasse hat
  - `toDTO()` — wird für Serialisierung genutzt
  - `getInspectorProperties()` — wird im Editor angezeigt
- **Implikation:** Wenn ein User eine `TDebugLog`-Komponente über den Editor anlegt und das Projekt speichert, wird das Objekt in die JSON geschrieben. Beim erneuten Laden ruft `hydrateObjects` → `ComponentRegistry.create(objData)` auf. Da **keine** Factory registriert ist, gibt `ComponentRegistry.create` nur eine Warn-Log zurück und `null`. **Ergebnis: Die Komponente verschwindet stumm beim Reload.**
- **Verifikations-Schritt:** 
  1. Editor öffnen, `TDebugLog`-Komponente anlegen
  2. Projekt speichern, neu laden
  3. Prüfen, ob Komponente noch da ist oder verschwunden
- **Wenn Bug bestätigt:** `ComponentRegistry.register('TDebugLog', (objData) => new TDebugLog(objData.name))` am Dateiende ergänzen.
- **Alternative Hypothese:** Eventuell ist `TDebugLog` nur System-intern (Debug-Panel, nicht vom User platzierbar). Dann gehört die Klasse in `NON_HYDRATABLE`.

---

### 4. `TAuthService` — 🔴 **Möglicher echter Bug**

- **Datei:** `src/components/TAuthService.ts` (80 Zeilen)
- **Erbt von:** `TComponent`
- **Kommentar in der Datei:** „Diese Komponente hat keine visuelle Repräsentation auf der Stage."
- **Kritischer Punkt:** Hat `toDTO()` und `getInspectorProperties()`.
- **Implikation:** Wie `TDebugLog` — unsichtbarer Datenverlust beim Reload, wenn über den Editor konfiguriert.
- **Verifikations-Schritt:** 
  1. Im Editor prüfen, ob `TAuthService` in der Komponenten-Palette auftaucht
  2. Falls ja → Instanz anlegen, speichern, reload, testen
- **Wenn Bug bestätigt:** `ComponentRegistry.register('TAuthService', (objData) => new TAuthService(objData.name))` ergänzen.

---

### 5. `TUserManager` — 🔴 **Möglicher echter Bug**

- **Datei:** `src/components/TUserManager.ts` (42 Zeilen)
- **Erbt von:** `TComponent`
- **Setter:** `this.isVariable = true` im Konstruktor
- **Kritischer Punkt:** Hat `toDTO()` mit `userCollection` und `hashPasswords`-Properties. `isVariable = true` bedeutet, dass der Serialization-Loop in `hydrateObjects` sogar **extra-Logik** für diese Klasse hat (Variable-Behandlung).
- **Implikation:** Wenn ein User im Editor `userCollection` oder `hashPasswords` konfiguriert und speichert, wird die Konfiguration beim Reload verworfen — die Komponente verschwindet komplett.
- **Verifikations-Schritt:** 
  1. Editor → TUserManager anlegen, `userCollection` auf „admins" setzen
  2. Projekt speichern, schließen, neu laden
  3. Prüfen, ob Komponente noch da und `userCollection === 'admins'`
- **Wenn Bug bestätigt:** `ComponentRegistry.register('TUserManager', (objData) => new TUserManager(objData.name))` ergänzen.

---

## Systemische Bedenken

### B-1: `toDTO()` ohne `ComponentRegistry.register` ist immer ein Widerspruch

Wenn eine Klasse ein `toDTO()` implementiert, bedeutet das: „Ich kann in JSON geschrieben werden." Wenn sie aber keine Factory in der Registry hat, kann sie nicht aus JSON rekonstruiert werden. Das ist ein **strukturelles Smell**, das in `TDebugLog`, `TAuthService` und `TUserManager` vorkommt.

**Vorschlag für nachgelagerten Schutz:** Ein zweiter, strengerer Guard **T-11b**, der prüft:
> *„Jede Klasse mit `toDTO()` MUSS entweder `ComponentRegistry.register(...)` haben ODER in einer expliziten `NON_HYDRATABLE_HAS_DTO`-Liste stehen."*

Damit wäre der Widerspruch automatisch gefangen.

---

### B-2: Stille Regressionen durch `ComponentRegistry.create` → `null`

Der aktuelle Fehlerpfad ist:

```ts
// ComponentRegistry.ts Zeile 39
logger.warn(`Unbekannte Komponente: ${objData.className}`);
return null;
```

Das ist eine **Warnung** — kein Fehler. In der Produktion wird das möglicherweise herausgefiltert und der User merkt nicht, dass sein Objekt verschwindet.

**Vorschlag:** In `Serialization.ts` (wo `hydrateObjects` `null` zurückbekommt) zumindest einen **Error-Level-Log** mit User-sichtbarer Meldung werfen — oder im Editor einen visuellen Hinweis anzeigen („X Komponenten konnten nicht geladen werden").

---

### B-3: Der Guard fängt das Symptom, nicht die Ursache

T-11 prüft pro Dateiname, aber die eigentliche Registrierung hängt am String `'TButton'` in `ComponentRegistry.register('TButton', ...)`. Ein Tippfehler (`'TBuuton'`) würde vom Guard nicht entdeckt.

**Vorschlag für nachgelagerte Verbesserung:** Die Registrierung auf Dekorator-Basis oder mittels `class.name` umstellen, sodass Tippfehler unmöglich werden:

```ts
ComponentRegistry.registerClass(TButton, (objData) => new TButton(...));
// intern: factories.set(TButton.name, factory)
```

Damit entfällt die String-Duplikation komplett.

---

## Empfohlene Reihenfolge beim Abarbeiten

| # | Schritt | Aufwand |
|:---:|:---|:---:|
| 1 | `TUserManager` manuell im Editor testen (speichert/lädt korrekt?) | 5 min |
| 2 | `TAuthService` manuell im Editor testen | 5 min |
| 3 | `TDebugLog` manuell im Editor testen | 5 min |
| 4 | Je nach Ergebnis: `ComponentRegistry.register` ergänzen **ODER** in `NON_HYDRATABLE` aufnehmen | 2–5 min pro Klasse |
| 5 | `TStage` / `TFlowStage` Factory-Mechanismus verifizieren, dann `NON_HYDRATABLE` mit Kommentar | 15 min |
| 6 | Optional: Guard T-11b einführen (toDTO ↔ Registry Konsistenz) | 30 min |
| 7 | Optional: Registry auf typed Registrierung umbauen (B-3) | 1 h |

**Gesamtaufwand für Schritte 1–5:** ca. 45 Minuten.

---

## Status-Tabelle (zum Abhaken beim Bearbeiten)

| Klasse | Verifiziert | Lösung | Status |
|:---|:---:|:---|:---:|
| `TStage` | ☐ | — | ⏳ Offen |
| `TFlowStage` | ☐ | — | ⏳ Offen |
| `TDebugLog` | ☐ | — | ⏳ Offen |
| `TAuthService` | ☐ | — | ⏳ Offen |
| `TUserManager` | ☐ | — | ⏳ Offen |

---

## Referenzen

- Guard: `@tests/guards.test.ts` — Sektion T-11 (Zeilen 39–91)
- Registry: `@src/utils/ComponentRegistry.ts`
- Hydration: `@src/utils/Serialization.ts` — `hydrateObjects()`
- Betroffene Dateien: `src/components/TStage.ts`, `TFlowStage.ts`, `TDebugLog.ts`, `TAuthService.ts`, `TUserManager.ts`

---

> **Hinweis:** Bis dieser Befund abgearbeitet ist, **schlägt T-11 im Test-Runner fehl**. Das ist gewünscht — so bleibt das Thema sichtbar. Alternativ kann die Baseline temporär auf „5 fehlende" hochgesetzt werden, um die CI grün zu bekommen, ohne den Befund zu vergessen. Empfehlung: **NICHT** die Baseline lockern, sondern das Problem lösen.
