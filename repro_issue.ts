
// Mock HTMLElement for Node environment
if (typeof global !== 'undefined' && !(global as any).HTMLElement) {
    (global as any).HTMLElement = class { };
    (global as any).Node = class { };
}

import { TStringVariable } from './src/components/TStringVariable';
import { ExpressionParser } from './src/runtime/ExpressionParser';
import { PropertyHelper } from './src/runtime/PropertyHelper';
import { ReactiveRuntime } from './src/runtime/ReactiveRuntime';

// Fix for ts-node issue: ensure we can import from src
// In a real environment, this is handled by tsconfig.json

async function test() {
    console.log('--- START REPRO TEST ---');
    const runtime = new ReactiveRuntime();

    // 1. Create a variable component
    const currentPIN = new TStringVariable('currentPIN', 0, 0);
    currentPIN.value = '';

    // 2. Register it
    const proxy = runtime.registerObject('currentPIN', currentPIN, true);
    console.log('Proxy created, name:', proxy.name);

    // 3. Create a binding like PinDisplay.text
    const display = { name: 'PinDisplay', text: '' };
    runtime.bind(display, 'text', 'PIN: ${currentPIN}');

    console.log('Initial text:', display.text);

    // 4. Update the variable (simulate calculate action)
    console.log('Setting proxy.value to 🍎...');
    proxy.value = '🍎';

    console.log('Proxy.value is now:', proxy.value);
    console.log('Text after update:', display.text);

    if (display.text === 'PIN: 🍎') {
        console.log('SUCCESS: Interpolation works correctly.');
    } else {
        console.log('FAILURE: Interpolation did not update correctly. Found:', display.text);

        // Debug context
        const context = runtime.getContext();
        console.log('Context currentPIN:', context.currentPIN);
        console.log('Resolved currentPIN:', PropertyHelper.resolveValue(context.currentPIN));
    }
}

test().catch(err => console.error('Test failed:', err));
