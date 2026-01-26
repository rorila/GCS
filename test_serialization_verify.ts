
import { TComponent } from './src/components/TComponent';

class MockComponent extends TComponent {
    constructor(name: string) { super(name); }
    getInspectorProperties() { return []; }
}

try {
    const root = new MockComponent("root");
    const child = new MockComponent("child");
    root.addChild(child);

    console.log("Attempting stringify on fixed component...");
    const json = JSON.stringify(root);
    console.log("Success! Serialization worked.");
    console.log("Length:", json.length > 0);
} catch (e) {
    console.error("FAIL: Serialization still failed:", e);
    process.exit(1);
}
