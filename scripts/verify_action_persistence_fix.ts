
import { FlowAction } from '../src/editor/flow/FlowAction';
import { GameProject } from '../src/model/types';

async function verifyFix() {
    console.log("🧪 Verifying FlowAction Persistence Fix...");

    const dummyContainer = document.createElement('div');
    const action = new FlowAction("test-id", 0, 0, dummyContainer, 20);
    (action as any).data = { name: "TestAction", isLinked: true };

    const project: GameProject = {
        name: "TestProject",
        stages: [],
        variables: [],
        objects: [],
        actions: [
            {
                name: "TestAction",
                type: "set_variable",
                variableName: "Score",
                source: "InitialValue",
                sourceProperty: "value"
            }
        ],
        tasks: []
    };

    action.setText("TestAction");
    action.setProjectRef(project);

    console.log("Checking if 'source' and 'sourceProperty' are accessible via FlowAction proxy...");

    // Test Getters
    const source = (action as any).source;
    const sourceProp = (action as any).sourceProperty;

    console.log(`- Source: ${source}`);
    console.log(`- SourceProperty: ${sourceProp}`);

    if (source === "InitialValue" && sourceProp === "value") {
        console.log("✅ Getters work correctly!");
    } else {
        console.error("❌ Getters FAILED!");
        process.exit(1);
    }

    // Test Setters
    console.log("Testing Setters...");
    (action as any).source = "NewSource";
    (action as any).sourceProperty = "newProp";

    const updatedAction = project.actions[0];
    console.log(`- Updated Source in Project: ${updatedAction.source}`);
    console.log(`- Updated SourceProperty in Project: ${updatedAction.sourceProperty}`);

    if (updatedAction.source === "NewSource" && updatedAction.sourceProperty === "newProp") {
        console.log("✅ Setters work correctly and update the original project reference!");
    } else {
        console.error("❌ Setters FAILED to update project reference!");
        process.exit(1);
    }

    console.log("\n✨ ALL VERIFICATION CHECKS PASSED!");
}

// Mocking DOM for script environment
if (typeof document === 'undefined') {
    const mockEl = {
        classList: { add: () => { }, remove: () => { } },
        appendChild: () => { },
        removeChild: () => { },
        addEventListener: () => { },
        removeEventListener: () => { },
        style: {},
        setAttribute: () => { },
        getAttribute: () => null,
        querySelectorAll: () => [],
        querySelector: () => null,
        innerHTML: ''
    };
    (global as any).document = {
        createElement: () => ({ ...mockEl })
    };
}

verifyFix().catch(err => {
    console.error(err);
    process.exit(1);
});
