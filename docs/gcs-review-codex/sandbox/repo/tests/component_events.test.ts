import { componentRegistry } from '../src/services/ComponentRegistry';
import { TComponent } from '../src/components/TComponent';
import { TButton } from '../src/components/TButton';

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runComponentEventsTests(): Promise<TestResult[]> {
    console.log("🧪 Testing Component Events...");
    const results: TestResult[] = [];

    const addResult = (name: string, passed: boolean, details?: string) => {
        results.push({
            name,
            type: 'Component Events',
            expectedSuccess: true,
            actualSuccess: passed,
            passed,
            details
        });
    };

    try {
        // 1. TComponent base events
        const button = new TButton();
        const baseEvents = button.getEvents();
        const hasMouseEnter = baseEvents.includes('onMouseEnter');
        const hasMouseLeave = baseEvents.includes('onMouseLeave');
        
        addResult("TComponent.getEvents includes Hover Events", hasMouseEnter && hasMouseLeave, `Found: ${baseEvents.join(', ')}`);

        // 2. ComponentRegistry Fallback
        const registryEvents = componentRegistry.getEvents({ className: 'unknown_type' });
        const regHasMouseEnter = registryEvents.includes('onMouseEnter');
        const regHasMouseLeave = registryEvents.includes('onMouseLeave');
        
        addResult("ComponentRegistry Fallback includes Hover Events", regHasMouseEnter && regHasMouseLeave, `Found: ${registryEvents.join(', ')}`);

    } catch (e: any) {
        addResult("Component Events Execution", false, e.message);
    }

    return results;
}

// Standalone execution if called directly
const isMain = import.meta.url?.includes(process.argv[1]?.replace(/\\/g, '/')) || process.argv[1]?.endsWith('component_events.test.ts');
if (isMain) {
    runComponentEventsTests().then(results => {
        const allPassed = results.every(r => r.passed);
        console.log(allPassed ? "✅ SUCCESS" : "❌ FAILED");
        process.exit(allPassed ? 0 : 1);
    });
}
