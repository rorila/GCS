# Login Flow (Use-Case)

Dieser Use-Case beschreibt den detaillierten technischen Ablauf des Logins im Game Builder, von der Benutzer-Interaktion über die API-Simulation bis zur Datenbank-Abfrage und zurück.

## Übersicht
Der Login-Prozess ist ein **dreistufiger Ablauf**:
1.  **Client-Side**: Der Benutzer gibt eine PIN ein und klickt "Login". Eine `DataAction` wird ausgeführt.
2.  **API-Simulation**: Der Editor fängt den HTTP-Request ab und leitet ihn an einen simulierten Server (`TAPIServer`) weiter.
3.  **Server-Logic**: Der Server verarbeitet den Request, prüft die Credentials gegen `users.json` und sendet eine Antwort.

## Detaillierter Ablauf (Stack Trace)

### 1. Trigger & Task Execution
*   **Event**: `LoginButton.onClick` löst den Task `AttemptLogin` aus.
*   **TaskExecutor**: Führt den Task aus. Da `DataAction1` nun global definiert ist, wird sie korrekt aufgelöst.
    *   **Methode**: `TaskExecutor.executeFlowChart` (Fallback für FlowCharts)
    *   **Quelle**: `src/runtime/TaskExecutor.ts:241`

### 2. Client-Action: `DataAction` -> `HTTP`
Der Task führt die `DataAction1` aus.
*   **Handler**: `data_action` delegiert an den Sub-Typ `http`.
    *   **Quelle**: `src/runtime/actions/StandardActions.ts:499`
*   **Handler**: `http` bereitet den Request vor und prüft auf den `ApiSimulator`.
    *   **Quelle**: `src/runtime/actions/StandardActions.ts:290`
    *   **Logic**: Interpoliert URL (`/api/data/users?authCode=...`) und ruft `serviceRegistry.call('ApiSimulator', ...)` auf (Zeile 316).

### 3. Editor: API Simulation
Der `ApiSimulator` (im `Editor` registriert) fängt den Call ab.
*   **Service**: `ApiSimulator.request`
    *   **Quelle**: `src/editor/Editor.ts:195`
*   **URL Parsing**: Hier wird die URL geparst, um `pathname` und `query` Parameter zu extrahieren.
    *   **Fix**: Nutzt `new URL(url, 'http://localhost')`, um auch relative URLs korrekt zu parsen.
    *   **Quelle**: `src/editor/Editor.ts:199-206`
*   **Event Trigger**: Der Simulator feuert das `onRequest` Event auf dem `TAPIServer`-Objekt.
    *   **Quelle**: `src/editor/Editor.ts:222`
    *   **Payload**: `{ method, path, body, query, requestId, isSimulation: true }`

### 4. Server-Task: `HandleApiRequest`
Das `onRequest` Event triggert den Task `HandleApiRequest` auf dem Server-Objekt.
*   **Action**: `SendApiResponse` (Typ: `handle_api_request`) wird ausgeführt.
    *   **Quelle**: `src/runtime/actions/StandardActions.ts:532`
*   **Context Fix**: List `requestId` robust aus `vars.eventData` (Zeile 535).

### 5. Server-Logic: `ActionApiHandler`
Die Action delegiert die Geschäftslogik an eine statische Helper-Klasse.
*   **Handler**: `ActionApiHandler.handle`
    *   **Quelle**: `src/components/actions/ActionApiHandler.ts:4`
*   **Routing**: Erkennt `/users` und ruft `handleUserSearch` auf.
    *   **Quelle**: `src/components/actions/ActionApiHandler.ts:18`
*   **User Search**: `handleUserSearch`
    *   **Quelle**: `src/components/actions/ActionApiHandler.ts:29`
    *   **Fallback Fix**: Falls `query` im Editor nicht geparst wurde, parst dieser Handler die Parameter erneut aus `params.path` (Zeile 36+).
    *   **DB Query**: Lädt `users.json` via `DataService` (Zeile 65) und vergleicht `authCode` (Array) oder `pin` (String) mit dem Request-Parameter.

### 6. Response Flow
*   **Result**: `ActionApiHandler` gibt `{ status: 200, data: { user, token } }` zurück.
*   **Simulator Callback**: `handle_api_request` nutzt den `requestId`, um den wartenden Promise im Simulator aufzulösen.
    *   **Quelle**: `src/runtime/actions/StandardActions.ts:555`
*   **Client Completion**: Die `http` Action im Client erhält die Daten und speichert sie in `apiLoginResult`.
    *   **Quelle**: `src/runtime/actions/StandardActions.ts:317`

Damit ist der Zyklus geschlossen und der Client kann basierend auf `apiLoginResult` navigieren.
