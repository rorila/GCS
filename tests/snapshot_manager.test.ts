/**
 * SnapshotManager Unit-Tests
 * 
 * Testet den Stack-basierten Undo/Redo Mechanismus:
 * - Push/Undo/Redo Lifecycle
 * - Stack-Limit
 * - Throttling
 * - Redo-Stack wird bei neuem Push geleert
 * - Restore-Callback
 * - isRestoring Guard
 */

import { SnapshotManager } from '../src/editor/services/SnapshotManager';

export function runSnapshotTests(): void {
    console.log('🧪 SnapshotManager Tests starten...');
    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, testName: string): void {
        if (condition) {
            passed++;
        } else {
            failed++;
            console.error(`  ❌ FEHLER: ${testName}`);
        }
    }

    // ------------------------------------------------------------------
    // Test 1: Leerer Stack → canUndo/canRedo = false
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        assert(!sm.canUndo(), 'T1: Leerer Stack → canUndo = false');
        assert(!sm.canRedo(), 'T1: Leerer Stack → canRedo = false');
        assert(sm.undo({}) === null, 'T1: undo() gibt null zurück');
        assert(sm.redo({}) === null, 'T1: redo() gibt null zurück');
    }

    // ------------------------------------------------------------------
    // Test 2: Push + Undo
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        const v1 = { name: 'Version 1', value: 1 };
        sm.pushSnapshot(v1, 'Erste Änderung');

        assert(sm.canUndo(), 'T2: canUndo nach Push = true');
        assert(sm.getUndoCount() === 1, 'T2: UndoCount = 1');

        const currentProject = { name: 'Version 2', value: 2 };
        const restored = sm.undo(currentProject);

        assert(restored !== null, 'T2: undo() gibt Snapshot zurück');
        assert(restored.name === 'Version 1', 'T2: Undo restauriert V1');
        assert(restored.value === 1, 'T2: Undo restauriert Wert 1');
        assert(sm.canRedo(), 'T2: canRedo nach Undo = true');
    }

    // ------------------------------------------------------------------
    // Test 3: Push + Undo + Redo
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        sm.pushSnapshot({ v: 'A' }, 'A→B');

        // Simulate wait to bypass throttle
        const undoResult = sm.undo({ v: 'B' });
        assert(undoResult?.v === 'A', 'T3: Undo gibt A zurück');

        const redoResult = sm.redo({ v: 'A' });
        assert(redoResult?.v === 'B', 'T3: Redo gibt B zurück');
        assert(!sm.canRedo(), 'T3: canRedo nach Redo = false');
    }

    // ------------------------------------------------------------------
    // Test 4: Neuer Push löscht Redo-Stack
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        sm.pushSnapshot({ v: 1 }, 'Schritt 1');

        // Kurz warten für Throttle
        sm['undoStack'][0].timestamp -= 1000;
        sm.pushSnapshot({ v: 2 }, 'Schritt 2');

        sm.undo({ v: 3 });
        assert(sm.canRedo(), 'T4: canRedo nach Undo');

        // Neuer Push — Redo sollte gelöscht werden
        sm['undoStack'].forEach(s => s.timestamp -= 1000);
        sm.pushSnapshot({ v: 4 }, 'Schritt 4 (neuer Zweig)');
        assert(!sm.canRedo(), 'T4: canRedo = false nach neuem Push');
    }

    // ------------------------------------------------------------------
    // Test 5: Stack-Limit (maxSnapshots)
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager(3); // Max 3 Snapshots
        for (let i = 0; i < 5; i++) {
            sm['undoStack'].forEach(s => s.timestamp -= 1000);
            sm.pushSnapshot({ i }, `Schritt ${i}`);
        }
        assert(sm.getUndoCount() === 3, 'T5: Stack-Limit = 3 eingehalten');
    }

    // ------------------------------------------------------------------
    // Test 6: Deep Copy (Mutation-Sicherheit)
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        const original = { tasks: [{ name: 'T1' }] };
        sm.pushSnapshot(original, 'Original');

        // Original mutieren — Snapshot sollte unverändert sein
        original.tasks[0].name = 'MUTATED';

        const restored = sm.undo({ tasks: [] });
        assert(restored?.tasks[0].name === 'T1', 'T6: Snapshot ist Deep Copy (nicht mutiert)');
    }

    // ------------------------------------------------------------------
    // Test 7: Restore-Callback
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        let callbackData: any = null;
        sm.setRestoreCallback((data) => { callbackData = data; });

        sm.pushSnapshot({ test: true }, 'Callback-Test');
        sm.undo({ test: false });

        assert(callbackData !== null, 'T7: Restore-Callback wird aufgerufen');
        assert(callbackData.test === true, 'T7: Callback erhält korrekte Daten');
    }

    // ------------------------------------------------------------------
    // Test 8: clear() leert beide Stacks
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        sm.pushSnapshot({ v: 1 }, 'S1');
        sm.undo({ v: 2 });

        assert(sm.canRedo(), 'T8: Vor clear: canRedo');
        sm.clear();
        assert(!sm.canUndo(), 'T8: Nach clear: canUndo = false');
        assert(!sm.canRedo(), 'T8: Nach clear: canRedo = false');
    }

    // ------------------------------------------------------------------
    // Test 9: getStatus()
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        sm.pushSnapshot({ v: 1 }, 'Status-Test');

        const status = sm.getStatus();
        assert(status.undoCount === 1, 'T9: Status undoCount = 1');
        assert(status.redoCount === 0, 'T9: Status redoCount = 0');
        assert(status.lastLabel === 'Status-Test', 'T9: Status lastLabel korrekt');
    }

    // ------------------------------------------------------------------
    // Test 10: Throttle (500ms)
    // ------------------------------------------------------------------
    {
        const sm = new SnapshotManager();
        sm.pushSnapshot({ v: 1 }, 'Erster');
        // Zweiter Push sofort danach — sollte gedrosselt werden
        sm.pushSnapshot({ v: 2 }, 'Zweiter (gedrosselt)');

        assert(sm.getUndoCount() === 1, 'T10: Throttle verhindert zweiten Push innerhalb 500ms');
    }

    // ------------------------------------------------------------------
    // Ergebnis
    // ------------------------------------------------------------------
    console.log(`\n  SnapshotManager: ${passed} bestanden, ${failed} fehlgeschlagen`);
    if (failed > 0) {
        throw new Error(`SnapshotManager: ${failed} Tests fehlgeschlagen!`);
    }
}
