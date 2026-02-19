// Script: fix_attemptlogin_flow.js
// Zweck: Raute (Condition "Login Check") aus AttemptLogin Flow entfernen.
//        DataAction direkt mit Success->GotoDashboard und Error->ShowLoginError/ClearPIN verbinden.

const fs = require('fs');
const path = 'game-server/public/platform/project.json';
const p = JSON.parse(fs.readFileSync(path, 'utf8'));

const bp = p.stages.find(s => s.type === 'blueprint');
if (!bp) { console.error('Keine Blueprint-Stage gefunden!'); process.exit(1); }

const fc = bp.flowCharts && bp.flowCharts['AttemptLogin'];
if (!fc) { console.error('Kein AttemptLogin flowChart gefunden!'); process.exit(1); }

const idTask = 'node-1771513021504-1';  // AttemptLogin Task-Knoten
const idData = 'node-1771513021504-2';  // doTheAuthenfification DataAction
const idCond = 'node-1771513021504-3';  // Login Check (Raute) <- wird entfernt
const idOk = 'node-1771513021504-4';  // GotoDashboard
const idErr = 'node-1771513021504-5';  // ShowLoginError
const idClr = 'node-1771513021504-6';  // ClearPIN

// 1. Raute-Element entfernen
fc.elements = fc.elements.filter(el => el.id !== idCond);
console.log('Raute entfernt. Verbleibende Elemente:', fc.elements.map(e => e.type + ':' + (e.properties?.name || '?')));

// 2. Alle Verbindungen die die Raute berühren oder vom DataAction weggehen entfernen
fc.connections = fc.connections.filter(c =>
    c.startTargetId !== idCond &&
    c.endTargetId !== idCond &&
    c.startTargetId !== idData   // DataAction-Verbindungen werden neu gesetzt
);

// 3. Neue Verbindungen setzen
fc.connections.push({
    startTargetId: idTask, endTargetId: idData,
    startX: 0, startY: 0, endX: 0, endY: 0,
    data: { startAnchorType: 'output', endAnchorType: 'input' }
});
fc.connections.push({
    startTargetId: idData, endTargetId: idOk,
    startX: 0, startY: 0, endX: 0, endY: 0,
    data: { startAnchorType: 'success', endAnchorType: 'input' }
});
fc.connections.push({
    startTargetId: idData, endTargetId: idErr,
    startX: 0, startY: 0, endX: 0, endY: 0,
    data: { startAnchorType: 'error', endAnchorType: 'input' }
});

// ShowLoginError -> ClearPIN sicherstellen
const hasClearConn = fc.connections.some(c => c.startTargetId === idErr && c.endTargetId === idClr);
if (!hasClearConn) {
    fc.connections.push({
        startTargetId: idErr, endTargetId: idClr,
        startX: 0, startY: 0, endX: 0, endY: 0,
        data: { startAnchorType: 'output', endAnchorType: 'input' }
    });
    console.log('ShowLoginError->ClearPIN Verbindung hinzugefügt.');
}

console.log('Verbindungen jetzt:', fc.connections.length);

// 4. actionSequence des AttemptLogin-Tasks korrekter Typ-Struktur
const task = bp.tasks.find(t => t.name === 'AttemptLogin');
if (task) {
    // Globale Action-Daten holen
    const allActions = [...(p.actions || []), ...(p.stages.flatMap(s => s.actions || []))];
    const authActionDef = allActions.find(a => a.name === 'doTheAuthenfification') || {};

    task.actionSequence = [
        {
            ...authActionDef,
            type: 'data_action',
            name: 'doTheAuthenfification',
            successBody: [
                { type: 'action', name: 'GotoDashboard' }
            ],
            errorBody: [
                { type: 'action', name: 'ShowLoginError' },
                { type: 'action', name: 'ClearPIN' }
            ]
        }
    ];
    console.log('actionSequence aktualisiert - DataAction mit successBody/errorBody.');
} else {
    console.warn('AttemptLogin Task nicht gefunden!');
}

fs.writeFileSync(path, JSON.stringify(p, null, 2), 'utf8');
console.log('Fertig. platform/project.json gespeichert.');
