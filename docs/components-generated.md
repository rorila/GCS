# Komponenten-Referenz (generiert)

> Automatisch generiert aus `src/components/*.ts` — 72 Komponenten.
> Nicht manuell editieren! Änderungen: `node scripts/generate-components-doc.mjs`

## Inhaltsverzeichnis

- [TAPIServer](#tapiserver--komponente) — extends `TPanel`
- [TAnimation](#tanimation--komponente) — extends `TWindow`
- [TAudio](#taudio--komponente) — extends `TWindow`
- [TAuthService](#tauthservice--komponente) — extends `TComponent`
- [TAvatar](#tavatar--komponente) — extends `TWindow`
- [TBadge](#tbadge--komponente) — extends `TWindow`
- [TBooleanVariable](#tbooleanvariable--komponente) — extends `TVariable`
- [TButton](#tbutton--komponente) — extends `TTextControl`
- [TCard](#tcard--komponente) — extends `TPanel`
- [TCheckbox](#tcheckbox--komponente) — extends `TTextControl`
- [TColorPicker](#tcolorpicker--komponente) — extends `TWindow`
- [TDataList](#tdatalist--komponente) — extends `TPanel`
- [TDataStore](#tdatastore--komponente) — extends `TPanel`
- [TDropdown](#tdropdown--komponente) — extends `TWindow`
- [TEdit](#tedit--komponente) — extends `TTextControl`
- [TEmojiPicker](#temojipicker--komponente) — extends `TPanel`
- [TForEach](#tforeach--komponente) — extends `TWindow`
- [TGameCard](#tgamecard--komponente) — extends `TWindow`
- [TGameHeader](#tgameheader--komponente) — extends `TTextControl`
- [TGameLoop](#tgameloop--komponente) — extends `TWindow`
- [TGameServer](#tgameserver--komponente) — extends `TWindow`
- [TGameState](#tgamestate--komponente) — extends `TWindow`
- [TGroupPanel](#tgrouppanel--komponente) — extends `TPanel`
- [TImage](#timage--komponente) — extends `TPanel`
- [TImageList](#timagelist--komponente) — extends `TImage`
- [TInfoWindow](#tinfowindow--komponente) — extends `TWindow`
- [TInputController](#tinputcontroller--komponente) — extends `TWindow`
- [TIntegerVariable](#tintegervariable--komponente) — extends `TVariable`
- [TIntervalTimer](#tintervaltimer--komponente) — extends `TWindow`
- [TKeyStore](#tkeystore--komponente) — extends `TWindow`
- [TLabel](#tlabel--komponente) — extends `TTextControl`
- [TLink](#tlink--komponente) — extends `TTextControl`
- [TList](#tlist--komponente) — extends `TWindow`
- [TListVariable](#tlistvariable--komponente) — extends `TWindow`
- [TMemo](#tmemo--komponente) — extends `TTextControl`
- [TNavBar](#tnavbar--komponente) — extends `TPanel`
- [TNumberInput](#tnumberinput--komponente) — extends `TTextControl`
- [TNumberLabel](#tnumberlabel--komponente) — extends `TTextControl`
- [TObjectList](#tobjectlist--komponente) — extends `TTable`
- [TObjectVariable](#tobjectvariable--komponente) — extends `TVariable`
- [TPanel](#tpanel--komponente) — extends `TWindow`
- [TParallaxBackground](#tparallaxbackground--komponente) — extends `TWindow`
- [TProgressBar](#tprogressbar--komponente) — extends `TWindow`
- [TRandomVariable](#trandomvariable--komponente) — extends `TWindow`
- [TRangeVariable](#trangevariable--komponente) — extends `TWindow`
- [TRealVariable](#trealvariable--komponente) — extends `TVariable`
- [TRichText](#trichtext--komponente) — extends `TPanel`
- [TShape](#tshape--komponente) — extends `TPanel`
- [TSidePanel](#tsidepanel--komponente) — extends `TDialogRoot`
- [TSpawner](#tspawner--komponente) — extends `TWindow`
- [TSpeedlines](#tspeedlines--komponente) — extends `TWindow`
- [TSplashScreen](#tsplashscreen--komponente) — extends `TPanel`
- [TSprite](#tsprite--komponente) — extends `TWindow`
- [TSpriteTemplate](#tspritetemplate--komponente) — extends `TSprite`
- [TStatusBar](#tstatusbar--komponente) — extends `TWindow`
- [TStickyNote](#tstickynote--komponente) — extends `TTextControl`
- [TStringMap](#tstringmap--komponente) — extends `TWindow`
- [TStringVariable](#tstringvariable--komponente) — extends `TVariable`
- [TSystemInfo](#tsysteminfo--komponente) — extends `TComponent`
- [TTabBar](#ttabbar--komponente) — extends `TPanel`
- [TTabControl](#ttabcontrol--komponente) — extends `TWindow`
- [TTable](#ttable--komponente) — extends `TWindow`
- [TTextControl](#ttextcontrol--komponente) — extends `TWindow`
- [TThresholdVariable](#tthresholdvariable--komponente) — extends `TWindow`
- [TTimer](#ttimer--komponente) — extends `TWindow`
- [TToast](#ttoast--komponente) — extends `TWindow`
- [TTriggerVariable](#ttriggervariable--komponente) — extends `TWindow`
- [TUserManager](#tusermanager--komponente) — extends `TComponent`
- [TVariable](#tvariable--komponente) — extends `TWindow`
- [TVideo](#tvideo--komponente) — extends `TPanel`
- [TVirtualGamepad](#tvirtualgamepad--komponente) — extends `TWindow`
- [TWindow](#twindow--komponente) — extends `TComponent`

---

## TAPIServer — Komponente

TAPIServer - Backend API Server Komponente Stellt einen virtuellen Server dar, der HTTP-Endpunkte (Tasks) verwaltet. Visuell wird er als Monitor-Icon im Flow-Editor oder auf der Stage dargestellt.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `caption` | Titel | string | IDENTITÄT | — |
| `port` | Netzwerk-Port | number | SERVER | — |
| `baseUrl` | Basis-URL | string | SERVER | — |
| `cors` | CORS erlauben | boolean | SERVER | — |
| `active` | Server Aktiv | boolean | SERVER | — |
| `testMethod` | Methode | select | API TESTER | ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'] |
| `testPath` | Relative Path | string | API TESTER | — |
| `testBody` | Request Body (JSON) | json | API TESTER | — |
| `testApiBtn` | 🚀 Request Senden | button | API TESTER | — |
| `testResponse` | Response | string | API TESTER | — |

### Ereignisse

`onRequest`, `onStart`, `onStop`, `onError`

---

## TAnimation — Komponente

TAnimation - Zyklisches Sprite-Sheet-Animation Kann einem oder mehreren Sprites zugeordnet werden. Das Sprite trägt `animationId` = Name dieser TAnimation.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `imageListId` | Image List | select | — | — |
| `imageCount` | Anzahl Bilder | number | — | — |
| `frameDuration` | Dauer pro Bild (ms) | number | — | — |
| `loop` | Wiederholen | boolean | ANIMATION | — |
| `enabled` | Aktiviert | boolean | ANIMATION | — |

---

## TAudio — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `src` | Audio Datei | audio_picker | Audio | — |
| `volume` | Lautstärke (0.0-1.0) | number | Audio | — |
| `loop` | Wiederholen (Loop) | boolean | Audio | — |
| `preload` | Preload in RAM (Zero-Latency) | boolean | Audio | — |
| `active` | Aktiv | boolean | Audio | — |

### Weitere öffentliche Properties

- `className: string` = 'TAudio'

### Ereignisse

`onPlay`, `onStop`

---

## TAuthService — Komponente

TAuthService - Kapselt die Authentifizierungs-Logik (JWT Simulation). Diese Komponente hat keine visuelle Repräsentation auf der Stage.

- **Basisklasse:** `TComponent`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `secret` | JWT Secret | string | AUTH-CONFIG | — |
| `tokenExpiration` | Token Ablauf (Sek.) | number | AUTH-CONFIG | — |

### Ereignisse

`onLoginSuccess`, `onLoginFailure`, `onTokenVerified`, `onTokenInvalid`

---

## TAvatar — Komponente

TAvatar - Ein kreisförmiges Profilbild mit optionalem Status-Indikator. Verwendet Grid-Zellen für die Größe.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `src` | Bild-URL / Icon | image_picker | AVATAR | — |
| `status` | Status | select | AVATAR | ['none', 'online', 'offline', 'busy'] |
| `shape` | Form | select | AVATAR | ['circle', 'square'] |

---

## TBadge — Komponente

TBadge - Ein kleiner Status-Indikator oder Label. Verwendet Grid-Zellen für Position und Größe.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `badgeType` | Typ | select | BADGE | ['info', 'success', 'warning', 'error', 'primary', 'secondary'] |
| `pill` | Pill-Style | boolean | BADGE | — |

---

## TBooleanVariable — Komponente

- **Basisklasse:** `TVariable`

### Weitere öffentliche Properties

- `className: string` = 'TBooleanVariable'

---

## TButton — Komponente

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `icon` | Icon | image_picker | ICON | — |

---

## TCard — Komponente

TCard - Ein moderner Inhalts-Container mit Titel, Subtitel und Schatten-Optik. Verwendet Grid-Zellen für das Layout.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `title` | Titel | string | CARD | — |
| `subtitle` | Subtitel | string | CARD | — |
| `showHeader` | Header anzeigen | boolean | CARD | — |
| `showFooter` | Footer anzeigen | boolean | CARD | — |

### Weitere öffentliche Properties

- `isContainer: boolean` = true — Flaggt diese Komponente als Drop-Target für den StageInteractionManager

---

## TCheckbox — Komponente

TCheckbox - Checkbox/Toggle component Allows users to toggle boolean values on/off. Useful for settings, feature toggles, visibility controls, etc.

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `checked` | Checked | checkbox | Specifics | — |
| `label` | Label | string | Specifics | — |

---

## TColorPicker — Komponente

TColorPicker - Color selection component Allows users to select colors using a color picker. Useful for styling, theming, sprite colors, etc.

- **Basisklasse:** `TWindow`

### Weitere öffentliche Properties

- `color: string`

### Ereignisse

`onChange`

---

## TDataList — Komponente

TDataList - Repeater-Container für dynamisches Karten-/Zeilendesign Hostet ein inneres TPanel als Karten-Vorlage (erstes Kind). Zur Laufzeit wird dieses Template pro Datensatz geklont, und ${item.xyz}-Expressions in den Children aufgelöst. Design-Time: 1 TPanel-Kind (Karten-Template) mit Labels, Buttons etc. Runtime: N geklonte Karten, eine pro Datensatz aus der DataAction

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `dataAction` | Datenquelle (DataAction) | select | — | — |
| `rowHeight` | Kartenhöhe (px) | number | LAYOUT | — |
| `rowGap` | Kartenabstand (px) | number | LAYOUT | — |

### Weitere öffentliche Properties

- `_runtimeRows: any[][]` = [] — Runtime-Only: Geklonte Zeilen-Daten (wird NICHT serialisiert)

### Ereignisse

`onRowClick`, `onRowDoubleClick`

---

## TDataStore — Komponente

TDataStore - Datenbank-Komponente für GCS Ermöglicht das Speichern und Abrufen von Daten in Collections. Im Editor wird localStorage genutzt, im Server-Modus das Dateisystem.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `caption` | Titel | string | IDENTITÄT | — |
| `storagePath` | Datei-Pfad | string | DATABASE | — |
| `defaultCollection` | Standard-Collection | string | DATABASE | — |

### Ereignisse

`onDataChanged`, `onSave`, `onDelete`, `onError`

---

## TDropdown — Komponente

TDropdown - Dropdown/Select component Allows users to select from a list of options. Useful for property editors, settings, menus, etc.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `options` | Options (comma-separated) | string | Specifics | — |
| `selectedIndex` | Selected Index | number | Specifics | — |
| `selectedValue` | Selected Value | string | Specifics | — |
| `style.color` | Text Color | color | Style | — |
| `style.borderColor` | Border Color | color | Style | — |

### Ereignisse

`onChange`

---

## TEdit — Komponente

TEdit - Text input component Allows users to enter and edit text in the game. Useful for forms, name input, chat, etc. Events (inherited from TWindow): onClick  - Fires when clicked onFocus  - Fires when input gains focus onBlur   - Fires when input loses focus Events (specific to TEdit): onChange - Fires when text changes onEnter  - Fires when Enter key is pressed

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `placeholder` | Platzhalter | string | EINGABE | — |
| `maxLength` | Max. Länge | number | EINGABE | — |

### Weitere öffentliche Properties

- `text: string`

### Ereignisse

`onChange`, `onEnter`

---

## TEmojiPicker — Komponente

TEmojiPicker - Eine Komponente zur Auswahl von Emojis. Ideal für kinderfreundliche Logins oder Interfaces.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `columns` | Spalten | number | PICKER | — |
| `itemSize` | Emoji-Größe (Cells) | number | PICKER | — |
| `emojis` | Emoji-Liste (JSON) | json | PICKER | — |
| `selectedEmoji` | Selektiertes Emoji | string | PICKER | — |

### Ereignisse

`onSelect`, `onClick`, `onFocus`, `onBlur`

---

## TForEach — Komponente

TForEach — Deklarativer Repeater-Container. Erzeugt zur Laufzeit dynamisch Kinder-Komponenten basierend auf einer Listen- oder Map-Variable. Jedes Item der Source bekommt einen Klon des Templates zugewiesen. Properties (Design-Time): - source: Name der Quell-Variable (Array oder Object/Map) - template: JSON-Definition der zu klonenden Komponente - layout: 'grid' | 'horizontal' | 'vertical' - cols: Spaltenanzahl bei layout='grid' - gap: Abstand zwischen Items (in Grid-Cells) - itemWidth: Breite pro Item (in Grid-Cells) - itemHeight: Höhe pro Item (in Grid-Cells) - namePattern: Naming-Pattern für Klone (default: '{name}_{index}') Template-Bindings: - ${item} → Aktuelles Element (Wert oder Objekt) - ${item.property} → Property eines Objekt-Elements - ${index} → 0-basierter Index des Elements - ${key} → Schlüssel bei Map-Iteration

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `source` | Quell-Variable | string | DATEN | — |
| `layout` | Layout | select | — | ['grid', 'horizontal', 'vertical', 'absolute'] |
| `cols` | Spalten (grid) | number | DATEN | — |
| `rows` | Zeilen (max) | number | DATEN | — |
| `gap` | Abstand (Grid-Cells) | number | DATEN | — |
| `itemWidth` | Item-Breite (Cells) | number | DATEN | — |
| `itemHeight` | Item-Höhe (Cells) | number | DATEN | — |
| `namePattern` | Name-Pattern | string | DATEN | — |
| `emptyMessage` | Leer-Nachricht | string | DATEN | — |

### Weitere öffentliche Properties

- `template: any` = null — Komponenten-Template (JSON)

---

## TGameCard — Komponente

TGameCard - A card component for displaying a game in the lobby. Shows game name, waiting room count, and Single/Multi buttons.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `gameName` | Game Name | string | Game | — |
| `gameFile` | Game File | string | Game | — |
| `waitingCount` | Waiting Rooms | number | Game | — |
| `hostName` | Host Name | string | Game | — |
| `hostAvatar` | Host Avatar | string | Game | — |
| `roomCode` | Room Code | string | Game | — |

---

## TGameHeader — Komponente

TGameHeader - A header component for games Contains a title that can be aligned left, center, or right. Default dock position is TOP with full width.

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `title` | Titel | string | IDENTITÄT | — |

---

## TGameLoop — Komponente

TGameLoop - Konfigurations-Container für den Game-Loop. Auf der Stage platzierbar. Konfiguriert boundsOffsetTop/Bottom und targetFPS im Inspector. Der eigentliche Loop wird vom GameLoopManager (Singleton) betrieben, der diese Werte bei GameRuntime.initMainGame() ausliest. WICHTIG: TGameLoop startet KEINEN eigenen Loop! Der GameLoopManager übernimmt Sprite-Updates, Kollisionen und Boundary-Checks.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `targetFPS` | Target FPS | number | Loop Settings | — |
| `autoAdjustFPS` | Auto FPS anpassen | boolean | Loop Settings | — |
| `boundaryMode` | Boundary Mode | select | Boundaries | ['clamp', 'event-only', 'bounce'] |
| `boundsOffsetTop` | Bounds Offset Top | number | Boundaries | — |
| `boundsOffsetBottom` | Bounds Offset Bottom | number | Boundaries | — |

### Weitere öffentliche Properties

- `state: GameLoopState` = 'stopped'

---

## TGameServer — Komponente

TGameServer - A stage-placeable component that manages multiplayer server connection. Place on stage, configure in Inspector, and use events to trigger Tasks.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `serverUrl` | Server URL | string | Server | — |
| `autoConnect` | Auto Connect | boolean | Server | — |

### Ereignisse

`onConnected`, `onDisconnected`, `onRoomCreated`, `onRoomJoined`, `onPlayerJoined`, `onPlayerLeft`, `onGameStart`, `onError`

---

## TGameState — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `state` | Initial State | select | Game State | ['menu', 'playing', 'paused', 'gameover', 'won'] |
| `spritesMoving` | Sprites Moving | boolean | Game State | — |
| `collisionsEnabled` | Collisions Enabled | boolean | Game State | — |
| `score` | Punkte | number | Spielstand | — |
| `level` | Level | number | Spielstand | — |
| `lives` | Leben | number | Spielstand | — |
| `maxLives` | Max. Leben | number | Spielstand | — |

### Ereignisse

`onStateChanged`, `onGameOver`, `onLifeLost`, `onScoreChanged`

---

## TGroupPanel — Komponente

TGroupPanel Ein unsichtbarer logischer Container, in den andere Komponenten gedropped werden können. Alle Children bewegen sich relativ zu diesem Container mit. Eignet sich hervorragend als Vorlage/Template für den ObjectPool.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `isHiddenInRun` | Als Template verbergen | boolean | KONFIGURATION | — |

### Weitere öffentliche Properties

- `isContainer: boolean` = true — Flaggt diese Komponente als Drop-Target für den StageInteractionManager

---

## TImage — Komponente

TImage - Eigenständige Bild-Komponente Zeigt ein Bild an, das auf dem Server gespeichert ist. Erbt von TPanel für Container-Funktionalität. Das eigentliche Rendering erfolgt durch den Stage-Renderer, diese Klasse hält nur die Daten.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `src` | Bildquelle | image_picker | BILD | — |
| `objectFit` | Skalierung | select | BILD | ['cover', 'contain', 'fill', 'none'] |
| `alt` | Alt-Text | string | BILD | — |
| `imageOpacity` | Bild-Deckkraft | number | BILD | — |
| `fallbackColor` | Fallback-Farbe | color | BILD | — |
| `matchValue` | Match-Wert | number | DATEN | — |

---

## TImageList — Komponente

TImageList - Sprite-Sheet-Komponente Zeigt ein einzelnes Teilbild aus einem Sprite-Sheet (Raster-Bild) an. Das Quellbild wird durch `imageCountHorizontal` × `imageCountVertical` in gleichgroße Frames aufgeteilt. `currentImageNumber` (0-basiert) bestimmt, welcher Frame sichtbar ist. Verwaltung erfolgt über den dedizierten ImageListEditorDialog. Rendering: Der StageRenderer nutzt CSS `background-position` + `background-size` um den korrekten Ausschnitt des Sprite-Sheets sichtbar zu machen.

- **Basisklasse:** `TImage`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `imageCountHorizontal` | Spalten (H) | number | SPRITE SHEET | — |
| `imageCountVertical` | Zeilen (V) | number | SPRITE SHEET | — |
| `currentImageNumber` | Aktuelles Bild | number | SPRITE SHEET | — |
| `maxImageCount` | Max. Bilder | number | SPRITE SHEET | — |
| `openImageListEditor` | 🎞️ Editor öffnen | button | SPRITE SHEET | — |

### Weitere öffentliche Properties

- `isHiddenInRun: boolean` = true — Im Run-Mode unsichtbar — ImageLists sind reine Editor-/Ressourcen-Komponenten

### Ereignisse

`onFrameChange`

---

## TInfoWindow — Komponente

TInfoWindow - Modal info window for feedback and waiting states Shows messages with optional spinner, cancel/confirm buttons, and auto-close functionality.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `title` | Title | string | Content | — |
| `message` | Message | string | Content | — |
| `icon` | Icon | image_picker | Content | — |
| `iconSize` | Icon Size | number | Content | — |
| `showCancelButton` | Show Cancel | boolean | Buttons | — |
| `cancelButtonText` | Cancel Text | string | Buttons | — |
| `showConfirmButton` | Show Confirm | boolean | Buttons | — |
| `confirmButtonText` | Confirm Text | string | Buttons | — |
| `showSpinner` | Show Spinner | boolean | Behavior | — |
| `autoClose` | Auto Close | boolean | Behavior | — |
| `autoCloseDelay` | Auto Close Delay (ms) | number | Behavior | — |
| `padding` | Padding | number | Style | — |

### Weitere öffentliche Properties

- `borderRadius: number` = 12 — Styling
- `onCancelTask: string` = '' — Events (Task names)
- `onConfirmTask: string` = ''
- `onAutoCloseTask: string` = ''

### Ereignisse

`onCancel`, `onConfirm`, `onAutoClose`

---

## TInputController — Komponente

TInputController - A stage-placeable component that handles keyboard input. Place on stage, configure target sprites in Inspector, and it will handle player controls. WICHTIG (v3.29.0): Die Event-Listener auf `window` werden NICHT von dieser Komponente verwaltet, sondern von GameRuntime.initInputControllers() über ein Single-Global-Handler Pattern. Dies verhindert stale Listener, die durch hydrateObjects()-Instanzwiederverwendung entstehen können.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `enabled` | Enabled | boolean | Input | — |

### Weitere öffentliche Properties

- `keysPressed: Set<string>` = new Set() — Internal state
- `isActive: boolean` = false
- `eventCallback: ((id: string, event: string, data?: any)` = > void) | null = null

### Ereignisse

`onKeyDown_KeyW`, `onKeyDown_KeyS`, `onKeyDown_KeyA`, `onKeyDown_KeyD`, `onKeyDown_ArrowUp`, `onKeyDown_ArrowDown`, `onKeyDown_ArrowLeft`, `onKeyDown_ArrowRight`, `onKeyDown_Space`, `onKeyDown_Enter`, `onKeyUp_KeyW`, `onKeyUp_KeyS`, `onKeyUp_KeyA`, `onKeyUp_KeyD`, `onKeyUp_ArrowUp`, `onKeyUp_ArrowDown`, `onKeyUp_ArrowLeft`, `onKeyUp_ArrowRight`, `onKeyUp_Space`, `onKeyUp_Enter`

---

## TIntegerVariable — Komponente

- **Basisklasse:** `TVariable`

### Weitere öffentliche Properties

- `className: string` = 'TIntegerVariable'

---

## TIntervalTimer — Komponente

TIntervalTimer – Intervall-basierter Timer (Ersatz für TRepeater) Feuert `onIntervall` bei jedem Durchlauf und `onTimeout` wenn die konfigurierte Anzahl erreicht ist. Verwendung: - duration (ms): Dauer eines Intervalls - count: Anzahl der Intervalle (0 = unendlich) - enabled: Ob der Timer beim Runtime-Start automatisch losläuft Events: - onIntervall: Wird bei jedem abgelaufenen Intervall gefeuert - onTimeout:   Wird gefeuert wenn alle Intervalle durchlaufen sind (count erreicht)

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `duration` | Dauer (ms) | number | Intervall | — |
| `count` | Anzahl (0=∞) | number | Intervall | — |
| `enabled` | Aktiviert | boolean | Intervall | — |

### Ereignisse

`onIntervall`, `onTimeout`

---

## TKeyStore — Komponente

TKeyStore - Schlüssel-Wert-Speicher Variable Speichert Datensätze mit einem eindeutigen Schlüssel (z.B. Kundennummer). Unterstützt CRUD-Operationen und Filterfunktionen.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `keyProperty` | Schlüssel-Property | string | KeyStore | — |

### Weitere öffentliche Properties

- `items: Record<string, any>` = {} — Die gespeicherten Schlüssel-Wert-Paare

### Ereignisse

`onItemCreated`, `onItemUpdated`, `onItemDeleted`, `onItemRead`, `onNotFound`, `onCleared`

---

## TLabel — Komponente

- **Basisklasse:** `TTextControl`

---

## TLink — Komponente

TLink - Link-Komponente Zeigt einen anklickbaren Link an, der eine URL in einem neuen Browser-Tab öffnet.

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `url` | URL | string | LINK | — |
| `underline` | Unterstrichen | boolean | LINK | — |

---

## TList — Komponente

TList - Eine datengetriebene Listen-Komponente. Zeigt eine Liste von Elementen an und erlaubt Selektion. Verwendet Grid-Zellen für die Dimensionierung.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `items` | Items (JSON) | json | LISTE | — |
| `displayField` | Anzeige-Feld | string | LISTE | — |
| `itemHeight` | Zeilenhöhe (Cells) | number | LISTE | — |
| `selectedIndex` | Gewählter Index | number | LISTE | — |

### Ereignisse

`onSelect`, `onDoubleClick`

---

## TListVariable — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `items` | Werte | value_list | List | — |

### Weitere öffentliche Properties

- `className: string` = 'TListVariable'

### Ereignisse

`onItemAdded`, `onItemRemoved`, `onCleared`

---

## TMemo — Komponente

TMemo - Multi-line text component Allows users to display or edit multiple lines of text. Perfect for logs, large descriptions, or JSON data.

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `text` | Text | string | Specifics | — |
| `placeholder` | Placeholder | string | Specifics | — |
| `readOnly` | Read Only | boolean | Specifics | — |

---

## TNavBar — Komponente

TNavBar - Eine Sidebar für die CMS-Navigation. Unterstützt vertikale Ausrichtung und Stage-Wechsel.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `navItems` | Menü-Items (JSON) | json | NAVIGATION | — |
| `activeId` | Aktive ID | string | NAVIGATION | — |
| `collapsed` | Eingeklappt | boolean | NAVIGATION | — |

### Ereignisse

`onSelect`, `onCollapse`, `onExpand`

---

## TNumberInput — Komponente

TNumberInput - Specialized number input component Allows users to enter numeric values with constraints. Useful for coordinates, sizes, speeds, and other numeric properties.

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `value` | Value | number | Specifics | — |
| `min` | Min | number | Specifics | — |
| `max` | Max | number | Specifics | — |
| `step` | Step | number | Specifics | — |

---

## TNumberLabel — Komponente

TNumberLabel - A specialized component for displaying and managing numeric values. It provides methods for incrementing and decrementing values and fires events when maximum or minimum values are reached.

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `startValue` | Anfangswert | number | Numeric | — |
| `value` | Aktueller Wert | number | Numeric | — |
| `minValue` | Minimalwert (Optional) | number | Numeric | — |
| `maxValue` | Maximalwert (Optional) | number | Numeric | — |
| `step` | Schrittweite | number | Numeric | — |

### Weitere öffentliche Properties

- `className: string` = 'TNumberLabel'
- `onEvent: ((eventName: string)` = > void) | null = null

### Ereignisse

`onMaxValueReached`, `onMinValueReached`

---

## TObjectList — Komponente

- **Basisklasse:** `TTable`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `fields` | Record-Felder (Schema) | record_schema | RECORDS | — |
| `items` | Enthaltene Objekte | object_list | List | — |
| `searchValue` | Suche (Wert) | string | List | — |
| `searchProperty` | Suche (Property) | string | List | — |

### Weitere öffentliche Properties

- `className: string` = 'TObjectList'
- `recordData: Record<string, Record<string, any>>` = {} — Werte pro Objekt: recordData[objectId][fieldName]
- `_runtimeObjects: any[]` = [] — Runtime-Only: Referenz auf alle Objekte, fuer rebuildData nach record_*-Aktionen

---

## TObjectVariable — Komponente

- **Basisklasse:** `TVariable`

### Weitere öffentliche Properties

- `className: string` = 'TObjectVariable'

---

## TPanel — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `caption` | Titel | string | IDENTITÄT | — |
| `showGrid` | Gitter anzeigen | boolean | GITTER | — |
| `gridColor` | Gitterfarbe | color | GITTER | — |
| `gridStyle` | Gitterstil | select | — | ['lines', 'dots'] |

---

## TParallaxBackground — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `layers` | Parallax-Ebenen (JSON) | json | KONFIGURATION | — |
| `velocityX` | Geschwindigkeit-X (Zellen/Frame) | number | KONFIGURATION | — |
| `scrollSource` | Scroll-Quelle (optional, z.B. ${globalGameTime}) | string | KONFIGURATION | — |
| `repeat` | Nahtlos wiederholen | boolean | KONFIGURATION | — |
| `direction` | Richtung | select | — | ['right-to-left', 'left-to-right', 'top-to-bottom', 'bottom-to-top'] |
| `addLayer` | + Ebene hinzufügen | button | KONFIGURATION | — |

---

## TProgressBar — Komponente

TProgressBar - Fortschrittsbalken / Lebensbalken Zeigt einen gefüllten Balken proportional zu value/maxValue an. Perfekt für: HP-Balken, Glücksmeter, Ladebalken, XP-Balken. Properties: value: Aktueller Wert (z.B. aktuelle HP) maxValue: Maximaler Wert (z.B. maximale HP) barColor: Farbe des gefüllten Bereichs barBackgroundColor: Farbe des leeren Bereichs showText: Text auf dem Balken anzeigen textTemplate: Template für den Text, z.B. "${value}/${maxValue}" borderRadius: Ecken-Abrundung animateChanges: Wertänderungen animieren

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `value` | Wert | number | Fortschritt | — |
| `maxValue` | Maximum | number | Fortschritt | — |
| `barColor` | Balkenfarbe | color | Fortschritt | — |
| `barBackgroundColor` | Hintergrund | color | Fortschritt | — |
| `showText` | Text anzeigen | boolean | Fortschritt | — |
| `textTemplate` | Text-Vorlage | string | Fortschritt | — |
| `animateChanges` | Animiert | boolean | Fortschritt | — |

### Weitere öffentliche Properties

- `className: string` = 'TProgressBar'

### Ereignisse

`onComplete`, `onEmpty`

---

## TRandomVariable — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `min` | Minimum | number | Random | — |
| `max` | Maximum | number | Random | — |
| `isInteger` | Nur Ganzzahlen | boolean | Random | — |
| `value` | Aktueller Wert | number | Random | — |

### Weitere öffentliche Properties

- `className: string` = 'TRandomVariable'

### Ereignisse

`onGenerated`

---

## TRangeVariable — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `value` | Wert | number | Range | — |
| `min` | Minimum | number | Range | — |
| `max` | Maximum | number | Range | — |

### Weitere öffentliche Properties

- `className: string` = 'TRangeVariable'

### Ereignisse

`onMinReached`, `onMaxReached`, `onInside`, `onOutside`

---

## TRealVariable — Komponente

- **Basisklasse:** `TVariable`

### Weitere öffentliche Properties

- `className: string` = 'TRealVariable'

---

## TRichText — Komponente

TRichText - Erweitert das TPanel um WYSIWYG-formatierbaren HTML-Inhalt. Bietet Schutz vor XSS in der Laufzeit-Rendering-Pipeline und unterstützt Variablen-Binding.

- **Basisklasse:** `TPanel`

### Weitere öffentliche Properties

- `className: string` = 'TRichText'
- `htmlContent: string` = '<h1>Rich Text Panel</h1><p>Bearbeiten für eigenen Inhalt.</p>' — Gespeicherter HTML-Inhalt (Sanitized)

---

## TShape — Komponente

TShape - Vielseitige Grafik-Komponente Unterstützt verschiedene geometrische Formen und dient als Container für Kind-Komponenten (z.B. Emojis via TLabel).

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `shapeType` | Form-Typ | select | FORM | ['circle', 'rect', 'square', 'ellipse', 'triangle', 'arrow', 'line'] |
| `fillColor` | Füllfarbe | color | FORM | — |
| `strokeColor` | Linienfarbe (Rand) | color | FORM | — |
| `strokeWidth` | Linienstärke | number | FORM | — |
| `opacity` | Deckkraft | number | FORM | — |
| `text` | Text/Emoji | string | INHALT | — |
| `contentImage` | Bild-Inhalt | image_picker | INHALT | — |

---

## TSidePanel — Komponente

TSidePanel — Generisches Side-Panel (erbt von TDialogRoot) Ein Container-Panel, das von der Seite (links/rechts) einschiebt. Unterstützt Kinder-Komponenten, Overlay-Dimming, Resize im Run-Modus, und alle Dialog-Features (closable, show/hide/toggle, Events). Unterschiede zu TDialogRoot: - Dockt an linken oder rechten Bühnenrand an (side-Property) - Volle Bühnenhöhe (Full Height) - Resize-Handle im Run-Modus (resizable) - overlayDimming separat steuerbar - modal default = false (Side-Panel blockiert Hintergrund normalerweise nicht) - centerOnShow = false (Side-Panel dockt am Rand an) - draggableAtRuntime = false (Side-Panel ist nicht verschiebbar)

- **Basisklasse:** `TDialogRoot`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `side` | Seite | select | — | ['left', 'right'] |
| `resizable` | Resize (Run) | boolean | Side Panel | — |
| `overlayDimming` | Hintergrund dimmen | boolean | Side Panel | — |
| `pauseGame` | Spiel pausieren | boolean | Side Panel | — |

---

## TSpawner — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `templateName` | Template-Name | string | SPAWNER ALLGEMEIN | — |
| `enabled` | Aktiviert | boolean | SPAWNER ALLGEMEIN | — |
| `spawnInterval` | Spawn-Intervall (s) | number | SPAWNER ALLGEMEIN | — |
| `spawnAxis` | Spawn-Achse | select | SPAWNER ALLGEMEIN | [{ value: 'Y', label: 'Y' }, { value: 'X', label: 'X' }, { value: 'XY', label: 'XY' }] |
| `spawnCountStart` | Start-Spawns | number | SPAWNER ALLGEMEIN | — |
| `recycleOffScreen` | Recyclen wenn außerhalb | boolean | SPAWNER ALLGEMEIN | — |
| `spawnY` | Spawn-Y (fix, wenn X) | number | SPAWNER X | — |
| `spawnXMin` | Spawn-X Min (Zellen) | number | SPAWNER X | — |
| `spawnXMax` | Spawn-X Max (Zellen) | number | SPAWNER X | — |
| `randomizeX` | X zufällig | boolean | SPAWNER X | — |
| `spawnX` | Spawn-X (fix, wenn Y) | number | SPAWNER Y | — |
| `spawnYMin` | Spawn-Y Min (Zellen) | number | SPAWNER Y | — |
| `spawnYMax` | Spawn-Y Max (Zellen) | number | SPAWNER Y | — |
| `randomizeY` | Y zufällig | boolean | SPAWNER Y | — |

---

## TSpeedlines — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `lineCount` | Anzahl Linien | number | KONFIGURATION | — |
| `speed` | Geschwindigkeit (s) | number | KONFIGURATION | — |
| `lineColor` | Linien-Farbe | string | KONFIGURATION | — |
| `overlayOpacity` | Overlay-Deckkraft | number | KONFIGURATION | — |
| `lineWidth` | Linien-Breite (px) | number | KONFIGURATION | — |
| `lineLength` | Linien-Länge (px) | number | KONFIGURATION | — |

---

## TSplashScreen — Komponente

TSplashScreen - Intro-Bildschirm Komponente Zeigt ein Bild oder Video für eine bestimmte Dauer an. Kann als Container für animierte Sprites (z.B. Logos) dienen.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `duration` | Duration (ms) | number | Splash | — |
| `autoHide` | Auto Hide | boolean | Splash | — |
| `videoSource` | Background Video | video_picker | Splash | — |
| `fadeSpeed` | Fade Speed | number | Splash | — |

### Ereignisse

`onFinish`

---

## TSprite — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `velocityX` | Velocity X | number | Motion | — |
| `velocityY` | Velocity Y | number | Motion | — |
| `gravity` | Gravity | number | Motion | — |
| `lerpSpeed` | Lerp Speed | number | Interpolation | — |
| `collisionGroup` | Collision Group | string | PHYSIK | — |
| `pushOutOnCollision` | Push-Out (Bounce) | boolean | PHYSIK | — |
| `shape` | Shape | select | Appearance | ['rect', 'circle'] |
| `spriteColor` | Sprite Color | color | Appearance | — |
| `appearanceMode` | Aktive Darstellungsart | select | Appearance | ['simple', 'spritesheet', 'animation', 'video'] |
| `sepImage` | Einfaches Bild | separator | Appearance | — |
| `backgroundImage` | Sprite Image | image_picker | Appearance | — |
| `objectFit` | Image Fit | select | Appearance | ['cover', 'contain', 'fill', 'none'] |
| `sepSpritesheet` | Sprite-Sheet | separator | Appearance | — |
| `imageListId` | Sprite Sheet | select | — | — |
| `imageIndex` | Frame Index | number | — | — |
| `sepAnimation` | Animation | separator | Appearance | — |
| `animationId` | Animation | select | — | — |
| `sepVideo` | Video | separator | Appearance | — |
| `videoSource` | Video | video_picker | Appearance | — |
| `videoObjectFit` | Video Fit | select | Appearance | ['cover', 'contain', 'fill', 'none'] |
| `videoAutoplay` | Autoplay | boolean | Appearance | — |
| `videoLoop` | Loop | boolean | Appearance | — |
| `videoMuted` | Muted | boolean | Appearance | — |
| `videoVolume` | Volume | number | Appearance | — |
| `videoPlaybackRate` | Playback Rate | number | Appearance | — |
| `customHitbox` | Custom Hitbox | boolean | Hitbox | — |
| `hitboxShape` | Hitbox Shape | select | Hitbox | ['auto', 'rect', 'circle'] |
| `hitboxOffsetX` | Offset X | number | Hitbox | — |
| `hitboxOffsetY` | Offset Y | number | Hitbox | — |
| `hitboxWidth` | Width (0=auto) | number | Hitbox | — |
| `hitboxHeight` | Height (0=auto) | number | Hitbox | — |

### Weitere öffentliche Properties

- `previousX: number` = 0 — Sub-frame interpolation for smooth rendering
- `previousY: number` = 0
- `renderX: number | null` = null
- `renderY: number | null` = null
- `templateId: string` = '' — Pool-Metadata (gesetzt durch SpritePool bei Pool-Instanzen)
- `templateName: string` = ''
- `isPoolInstance: boolean` = false

### Ereignisse

`onEnter`, `onCollision`, `onCollisionLeft`, `onCollisionRight`, `onCollisionTop`, `onCollisionBottom`, `onBoundaryHit`, `onStageExit`

---

## TSpriteTemplate — Komponente

TSpriteTemplate – Blueprint-Vorlage für Object-Pooling. Im Editor sichtbar (zur Konfiguration von Hitbox, Velocity, Aussehen). Zur Laufzeit selbst unsichtbar – stattdessen werden `poolSize` echte TSprite-Instanzen vorhydriert, die über spawn_object/destroy_object aus dem Pool geholt bzw. zurückgegeben werden. Lebenszyklus: Runtime-Start → Pool mit N Instanzen (visible=false, idle) spawn_object  → Pool.acquire() → visible=true, Position setzen destroy_object → Pool.release() → visible=false, Position reset Runtime-Stop  → Pool komplett verworfen

- **Basisklasse:** `TSprite`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `poolSize` | Pool Size | string | Pool Settings | — |
| `autoRecycle` | Auto Recycle | boolean | Pool Settings | — |
| `lifetime` | Lifetime (Sek.) | number | Pool Settings | — |

### Ereignisse

`onClick`, `onDoubleClick`, `onMouseEnter`, `onMouseLeave`, `onDragStart`, `onDragEnd`, `onDrop`, `onTouchStart`, `onTouchMove`, `onTouchEnd`, `onFocus`, `onBlur`, `onFlipMidpoint`, `onCollision`, `onCollisionLeft`, `onCollisionRight`, `onCollisionTop`, `onCollisionBottom`, `onBoundaryHit`, `onStageExit`, `onPoolExhausted`

---

## TStatusBar — Komponente

Status bar section configuration / export interface StatusSection { id: string; text: string; icon?: string; width?: number | 'auto'; align?: 'left' | 'center' | 'right'; clickTask?: string;  // Task name to execute on click } /** TStatusBar - Persistent status bar component Shows persistent status information in sections. Can be placed at the bottom of the screen or anywhere in the scene.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `text` | Status Text | string | Basic | — |
| `textColor` | Text Color | color | Style | — |
| `fontSize` | Font Size | number | Style | — |
| `paddingX` | Padding X | number | Style | — |
| `paddingY` | Padding Y | number | Style | — |
| `sectionGap` | Section Gap | number | Style | — |
| `separatorColor` | Separator Color | color | Style | — |
| `showSeparators` | Show Separators | boolean | Style | — |
| `style.borderColor` | Border Color | color | Style | — |

### Weitere öffentliche Properties

- `sections: StatusSection[]` = [] — Sections configuration

---

## TStickyNote — Komponente

- **Basisklasse:** `TTextControl`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `title` | Titel | string | INHALT | — |
| `noteColor` | Kategorie | select | DARSTELLUNG | ['yellow', 'green', 'blue', 'red'] |

### Weitere öffentliche Properties

- `className: string` = 'TStickyNote'

---

## TStringMap — Komponente

TStringMap - Eine Key-Value-Komponente für Texte. Speichert benannte Strings (z.B. Button-Texte, Labels, Übersetzungen). Zugriff zur Laufzeit via: ${MapName.key} Beispiel: ${Texte.btnLogin} → "Anmelden" Der value-Getter gibt entries zurück, damit PropertyHelper.resolveValue() die Map korrekt auflöst (isVariable → val.value → entries).

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `editEntries` | 📝 Einträge bearbeiten... | button | — | — |

### Weitere öffentliche Properties

- `className: string` = 'TStringMap'
- `entries: Record<string, string>` = {}

### Ereignisse

`onEntryChanged`

---

## TStringVariable — Komponente

- **Basisklasse:** `TVariable`

### Weitere öffentliche Properties

- `className: string` = 'TStringVariable'

---

## TSystemInfo — Komponente

TSystemInfo - System and Hardware Information Component Provides read-only access to browser and hardware information. Useful for debugging, adaptive UI, or performance optimization.

- **Basisklasse:** `TComponent`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `browserName` | Browser | string | Browser | — |
| `browserVersion` | Version | string | Browser | — |
| `userAgent` | User Agent | string | Browser | — |
| `language` | Language | string | Browser | — |
| `platform` | Platform | string | Browser | — |
| `online` | Online | boolean | Browser | — |
| `screenWidth` | Screen Width | number | Screen | — |
| `screenHeight` | Screen Height | number | Screen | — |
| `screenColorDepth` | Color Depth | number | Screen | — |
| `devicePixelRatio` | Pixel Ratio | number | Screen | — |
| `windowWidth` | Window Width | number | Window | — |
| `windowHeight` | Window Height | number | Window | — |
| `windowOuterWidth` | Outer Width | number | Window | — |
| `windowOuterHeight` | Outer Height | number | Window | — |
| `hardwareConcurrency` | CPU Cores | number | Hardware | — |
| `deviceMemory` | RAM (GB) | number | Hardware | — |
| `maxTouchPoints` | Touch Points | number | Hardware | — |

---

## TTabBar — Komponente

TTabBar - Eine horizontale Tab-Leiste für Unter-Navigation. Verwendet Grid-Zellen.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `tabs` | Tabs (JSON) | json | TABS | — |
| `activeTabIndex` | Aktiver Tab (Index) | number | TABS | — |

### Ereignisse

`onChange`

---

## TTabControl — Komponente

TTabControl - Tab navigation component Allows switching between different content panels using tabs. Useful for organizing complex UIs like the Inspector.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `tabs` | Tabs (comma-separated) | string | Specifics | — |
| `activeTabIndex` | Active Tab Index | number | Specifics | — |
| `activeTabName` | Active Tab Name | string | Specifics | — |
| `style.color` | Text Color | color | Style | — |
| `style.borderColor` | Border Color | color | Style | — |

---

## TTable — Komponente

TTable - Eine dynamische Tabellen-Komponente. Visualisiert Arrays von Objekten (z.B. aus APIs oder Variablen). Besitzt Auto-Column-Generierung als Fallback in Stage.ts.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `data` | Daten-Basis (JSON) | json | Tabelle | — |
| `columns` | Spalten (JSON) | json | Tabelle | — |
| `displayMode` | Anzeige-Modus | select | — | ['table', 'cards'] |
| `cardConfig` | Karten-Design (JSON) | json | Tabelle | — |
| `rowHeight` | Zeilenhöhe (px) | number | Tabelle | — |
| `showHeader` | Kopfzeile zeigen | boolean | Tabelle | — |
| `striped` | Zebra-Streifen | boolean | Tabelle | — |

### Weitere öffentliche Properties

- `className: string` = 'TTable'
- `selectedIndex: number` = -1

### Ereignisse

`onSelect`, `onDoubleClick`

---

## TTextControl — Komponente

TTextControl - Base class for components with text Centralizes text styling properties: - Font Size, Weight, Style, Family - Text Align - Text Color

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `text` | Inhalt | textarea | INHALT | — |

---

## TThresholdVariable — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `value` | Wert | number | Threshold | — |
| `threshold` | Schwellenwert | number | Threshold | — |
| `comparison` | Vergleich | select | Threshold | ['>=', '<=', '==', '>', '<', '!='] |

### Weitere öffentliche Properties

- `className: string` = 'TThresholdVariable'

### Ereignisse

`onThresholdReached`, `onThresholdLeft`, `onThresholdExceeded`

---

## TTimer — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `interval` | Interval (ms) | number | Timer | — |
| `enabled` | Aktiviert | boolean | Timer | — |
| `maxInterval` | Max Intervalle (0=∞) | string | Timer | — |
| `currentInterval` | Aktuelle Anzahl | number | Timer | — |

### Weitere öffentliche Properties

- `className: string` = 'TTimer'
- `onEvent: ((eventName: string)` = > void) | null = null
- `watcherQuery: ((prop: string)` = > boolean) | null = null

### Ereignisse

`onTimer`, `onMaxIntervalReached`

---

## TToast — Komponente

Toast notification type / export type ToastType = 'info' | 'success' | 'warning' | 'error'; /** Toast animation type / export type ToastAnimation = 'slide-left' | 'slide-up' | 'fade' | 'bounce'; /** Toast position / export type ToastPosition = 'bottom-left' | 'bottom-right' | 'top-left' | 'top-right'; /** Internal toast item / interface ToastItem { id: number; message: string; type: ToastType; element: HTMLElement; } /** TToast - Toast notification component Shows brief, animated notifications that auto-dismiss. Configurable animations, positions, and styling.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `animation` | Animation | select | Animation | ['slide-left', 'slide-up', 'fade', 'bounce'] |
| `position` | Position | select | Animation | ['bottom-left', 'bottom-right', 'top-left', 'top-right'] |
| `duration` | Duration (ms) | number | Timing | — |
| `maxVisible` | Max Visible | number | Timing | — |
| `infoColor` | Info Color | color | Colors | — |
| `successColor` | Success Color | color | Colors | — |
| `warningColor` | Warning Color | color | Colors | — |
| `errorColor` | Error Color | color | Colors | — |
| `textColor` | Text Color | color | Colors | — |
| `fontSize` | Font Size | number | Style | — |
| `borderRadius` | Border Radius | number | Style | — |
| `padding` | Padding | number | Style | — |

---

## TTriggerVariable — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `value` | Wert | string | Trigger | — |
| `triggerValue` | Trigger-Wert | string | Trigger | — |

### Weitere öffentliche Properties

- `className: string` = 'TTriggerVariable'

### Ereignisse

`onTriggerEnter`, `onTriggerExit`

---

## TUserManager — Komponente

TUserManager - Spezialisierte Komponente für das Benutzer-Management. Bietet High-Level Operationen für User-CRUD.

- **Basisklasse:** `TComponent`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `userCollection` | DB Collection | string | USER-CONFIG | — |
| `hashPasswords` | Passwörter hashen | boolean | USER-CONFIG | — |

### Ereignisse

`onUserCreated`, `onUserUpdated`, `onUserDeleted`, `onAuthFailed`

---

## TVariable — Komponente

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `type` | Typ | select | Variable | ['integer', 'real', 'string', 'boolean', 'timer', 'random', 'list', 'object', 'object_list', 'threshold', 'trigger', 'range', 'keystore', 'any', 'json'] |
| `defaultValue` | Standardwert | string | Variable | — |
| `value` | Aktueller Wert | string | Variable | — |
| `objectModel` | Modell (Entität) | select | Variable | — |

### Weitere öffentliche Properties

- `className: string` = 'TVariable'

### Ereignisse

`onValueChanged`

---

## TVideo — Komponente

TVideo - Eigenständige Video-Komponente Zeigt ein Video an und bietet Steuerungsmethoden. Erbt von TPanel für Container-Funktionalität.

- **Basisklasse:** `TPanel`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `videoSource` | Video Source | video_picker | Video | — |
| `objectFit` | Object Fit | select | Video | ['cover', 'contain', 'fill', 'none'] |
| `imageOpacity` | Opacity | number | Video | — |
| `autoplay` | Autoplay | boolean | Video | — |
| `loop` | Loop | boolean | Video | — |
| `muted` | Muted | boolean | Video | — |
| `playbackRate` | Playback Rate | number | Video | — |

### Weitere öffentliche Properties

- `resetRequested: boolean` = false

---

## TVirtualGamepad — Komponente

TVirtualGamepad Overlay für Touch-Geräte, welches automatisch die Tastenbelegungen des TInputControllers ausliest und Touchflächen generiert, die beim Drücken KeyboardEvents ins Dokument dispatchen.

- **Basisklasse:** `TWindow`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `layoutStyle` | Layout Stil | select | Einstellungen | ['split', 'action_bar'] |
| `splitVerticalAlignment` | Vertikale Ausrichtung | select | Einstellungen | ['bottom', 'middle'] |
| `autoHideOnDesktop` | Auf PC ausblenden | boolean | Einstellungen | — |
| `scale` | Skalierung | number | Einstellungen | — |
| `pressDelay` | Press-Verzögerung (ms) | number | Zeiten | — |
| `keyCooldown` | Tasten-Cooldown (ms) | number | Zeiten | — |

### Weitere öffentliche Properties

- `simulatedKeys: string[]` = [] — Laufzeit-Daten (intern)

---

## TWindow — Komponente

- **Basisklasse:** `TComponent`

### Inspector-Eigenschaften

| Property | Label | Typ | Gruppe | Optionen |
|---|---|---|---|---|
| `visible` | Sichtbar | boolean | IDENTITÄT | — |
| `x` | X | number | GEOMETRIE | — |
| `y` | Y | number | GEOMETRIE | — |
| `width` | Breite | number | GEOMETRIE | — |
| `height` | Höhe | number | GEOMETRIE | — |
| `zIndex` | Z-Index | number | GEOMETRIE | — |
| `rotation` | Rotation | number | GEOMETRIE | — |
| `align` | Ausrichtung | select | GEOMETRIE | ['NONE', 'TOP', 'BOTTOM', 'LEFT', 'RIGHT', 'CLIENT'] |
| `collisionEnabled` | Kollision aktiv | boolean | PHYSIK | — |
| `style.color` | Textfarbe | color | TYPOGRAFIE | — |
| `style.fontSize` | Schriftgröße | number | TYPOGRAFIE | — |
| `style.fontFamily` | Schriftart | select | TYPOGRAFIE | [{value: '', label: 'Standard'}, {value: 'Arial', label: 'Arial'}, {value: 'Segoe UI, Arial, sans-serif', label: 'Segoe UI'}, {value: 'Verdana', label: 'Verdana'}, {value: 'Times New Roman', label: 'Times New Roman'}, {value: 'Courier New', label: 'Courier New'}, {value: 'Georgia', label: 'Georgia'}] |
| `style.fontWeight` | Fett | boolean | TYPOGRAFIE | — |
| `style.fontStyle` | Kursiv | boolean | TYPOGRAFIE | — |
| `style.textAlign` | Ausrichtung | select | TYPOGRAFIE | [{value: '', label: 'Standard'}, {value: 'left', label: 'Links'}, {value: 'center', label: 'Zentriert'}, {value: 'right', label: 'Rechts'}] |
| `style.backgroundColor` | Hintergrund | color | STIL | — |
| `style.borderColor` | Rahmenfarbe | color | STIL | — |
| `style.borderWidth` | Rahmenbreite | number | STIL | — |
| `style.borderRadius` | Abrundung | number | STIL | — |
| `style.opacity` | Deckkraft | number | STIL | — |
| `style.glowColor` | Glow Farbe | color | GLOW-EFFEKT | — |
| `style.glowBlur` | Glow Unschärfe | number | GLOW-EFFEKT | — |
| `style.glowSpread` | Glow Ausbreitung | number | GLOW-EFFEKT | — |
| `style.shadowColor` | Schatten Farbe | color | SCHATTEN | — |
| `style.shadowOffsetX` | Offset X | number | SCHATTEN | — |
| `style.shadowOffsetY` | Offset Y | number | SCHATTEN | — |
| `style.shadowBlur` | Unschärfe | number | SCHATTEN | — |
| `style.shadowSpread` | Ausbreitung | number | SCHATTEN | — |
| `style.shadowInset` | Innen | boolean | SCHATTEN | — |
| `style.boxShadow` | Box-Shadow (CSS) | string | SCHATTEN | — |

### Weitere öffentliche Properties

- `style: ComponentStyle`
- `text: string` = ""
- `isAnimating: boolean` = false — Animation flag - wenn true, wird Physik pausiert

### Ereignisse

`visible`, `Sichtbar`, `boolean`, `IDENTITÄT`, `x`, `X`, `number`, `GEOMETRIE`, `y`, `Y`, `width`, `Breite`, `height`, `Höhe`, `zIndex`, `Z-Index`, `rotation`, `Rotation`, `Winkel in Grad`, `align`, `Ausrichtung`, `select`, `NONE`, `TOP`, `BOTTOM`, `LEFT`, `RIGHT`, `CLIENT`

---
