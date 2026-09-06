
import { TVariable } from '../src/components/TVariable';
import { PropertyHelper } from '../src/runtime/PropertyHelper';

async function testVariableResolution() {
    console.log("--- Testing Variable Property Resolution ---");

    // 1. Setup Variable
    const myVar = new TVariable("TestVar", 0, 0);
    myVar.type = "string";
    myVar.defaultValue = "Default";
    myVar.value = "CurrentValue";

    console.log(`Variable created: name=${myVar.name}, type=${myVar.type}, value=${myVar.value}`);

    // 2. Test Property Access
    const resolvedValue = PropertyHelper.getPropertyValue(myVar, "value");
    const resolvedType = PropertyHelper.getPropertyValue(myVar, "type");
    const resolvedDefault = PropertyHelper.getPropertyValue(myVar, "defaultValue");
    const resolvedName = PropertyHelper.getPropertyValue(myVar, "name");

    console.log(`Resolved 'value':        ${resolvedValue} (Expected: "CurrentValue")`);
    console.log(`Resolved 'type':         ${resolvedType} (Expected: "string")`);
    console.log(`Resolved 'defaultValue': ${resolvedDefault} (Expected: "Default")`);
    console.log(`Resolved 'name':         ${resolvedName} (Expected: "TestVar")`);

    // 3. Assertions
    let success = true;
    if (resolvedValue !== "CurrentValue") { console.error("❌ FAILED: 'value' resolution"); success = false; }
    if (resolvedType !== "string") { console.error("❌ FAILED: 'type' resolution (metadata fallback)"); success = false; }
    if (resolvedDefault !== "Default") { console.error("❌ FAILED: 'defaultValue' resolution"); success = false; }
    if (resolvedName !== "TestVar") { console.error("❌ FAILED: 'name' resolution"); success = false; }

    if (success) {
        console.log("\n✅ ALL TESTS PASSED: Variable Property Resolution is robust.");
    } else {
        process.exit(1);
    }
}

testVariableResolution().catch(err => {
    console.error(err);
    process.exit(1);
});
