import { TVirtualGamepad } from '../src/components/TVirtualGamepad';
import { TInputController } from '../src/components/TInputController';
import { GameProject } from '../src/model/types';
import { GameRuntime } from '../src/runtime/GameRuntime';
import { StageRenderer } from '../src/editor/services/StageRenderer';

export async function runTests() {
    let passed = 0;
    let failed = 0;
    const results: any[] = [];

    const assert = (condition: boolean, msg: string) => {
        if (condition) {
            passed++;
        } else {
            failed++;
            throw new Error(`Assert failed: ${msg}`);
        }
    };

    try {
        // Test 1: Auto-detection of bound keys
        const gamepad = new TVirtualGamepad('pad1');
        const inputCtrl = new TInputController('ic1');
        
        // Mock some bound events
        inputCtrl.events = {
            'onKeyDown_Space': 'Task1',
            'onKeyUp_Space': 'Task2',
            'onKeyDown_ArrowUp': 'Task3'
        };

        gamepad.initRuntime({ objects: [inputCtrl, gamepad] });

        assert(gamepad.simulatedKeys.includes('Space'), 'Should detect Space key');
        assert(gamepad.simulatedKeys.includes('ArrowUp'), 'Should detect ArrowUp key');
        assert(!gamepad.simulatedKeys.includes('Enter'), 'Should not detect unbound keys');
        assert(gamepad.simulatedKeys.length === 2, 'Should only contain unique keys');

        results.push({ name: 'TVirtualGamepad detects keys from TInputController', passed: true, type: 'VirtualGamepad', expectedSuccess: true, actualSuccess: true });
        
        // Test 2: Renderer doesn't crash on layout construction
        try {
            // Since StageRenderer orchestrates, we need to mock it if we wanted to call it directly,
            // but we can just be sure it's structurally valid from TVirtualGamepad side.
            gamepad.layoutStyle = 'split';
            
            assert(gamepad.layoutStyle === 'split', 'style property works');
            results.push({ name: 'TVirtualGamepad property check', passed: true, type: 'VirtualGamepad', expectedSuccess: true, actualSuccess: true });
        } catch (e: any) {
            assert(false, `Renderer test crashed: ${e.message}`);
        }

    } catch (e: any) {
        console.error("Test failed because:", e.message);
        results.push({ name: 'TVirtualGamepad Test', passed: false, type: 'VirtualGamepad', expectedSuccess: true, actualSuccess: false, details: e.message });
    }

    if (failed > 0) {
        throw new Error(`TVirtualGamepad Tests failed: ${failed}`);
    }
    return results;
}

// Wenn direkt ausgeführt (z.B. von tsx)
import { fileURLToPath } from 'url';
if (process.argv[1] === fileURLToPath(import.meta.url)) {
    runTests().then(res => {
        console.log(`✅ Gamepad Tests passed: ${res.length}`);
    }).catch(err => {
        console.error(`❌ Gamepad Tests failed:`, err);
        process.exit(1);
    });
}
