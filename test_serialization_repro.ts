
// Minimal reproduction of the circular JSON issue
class MockComponent {
    parent: MockComponent | null = null;
    children: MockComponent[] = [];
    name: string;
    constructor(name: string) { this.name = name; }

    addChild(c: MockComponent) {
        c.parent = this;
        this.children.push(c);
    }

    // CURRENT BROKEN IMPLEMENTATION (simulated)
    toJSON() {
        return {
            className: 'MockComponent',
            ...this
        };
    }
}

// Test
try {
    const root = new MockComponent("root");
    const child = new MockComponent("child");
    root.addChild(child);

    console.log("Attempting stringify...");
    const json = JSON.stringify(root);
    console.log("Success:", json);
} catch (e: any) {
    console.error("Caught expected error:", e.message);
}
