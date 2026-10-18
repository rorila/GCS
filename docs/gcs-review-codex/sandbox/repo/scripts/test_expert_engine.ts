import { ExpertRuleEngine } from '../src/editor/services/ExpertRuleEngine';

// Simuliere einen Headless-Lauf
console.log("=== Testing Expert Rule Engine (Headless) ===");

const engine = new ExpertRuleEngine();

// 1. Session starten
console.log("\n-> Starting Session for: 'task'");
let currentNode = engine.startSession('task');

// 2. Ersten Node beantworten (ask_task_name)
console.log(`\nENGINE ASKS: ${currentNode.prompt} (Property: ${currentNode.propName})`);
const answer1 = "My Awesome Wizard Task";
console.log(`USER ANSWERS: "${answer1}"`);
currentNode = engine.submitAnswer(answer1)!;

// 3. Zweiten Node beantworten (ask_task_desc)
console.log(`\nENGINE ASKS: ${currentNode.prompt} (Property: ${currentNode.propName})`);
const answer2 = "This task was created by the CLI test script.";
console.log(`USER ANSWERS: "${answer2}"`);
const finalNode = engine.submitAnswer(answer2);

// 4. Abschluss prüfen
if (engine.isSessionComplete()) {
    console.log("\n✅ SESSION COMPLETE!");
    console.log("FINAL PAYLOAD:", JSON.stringify(engine.getSessionPayload(), null, 2));
} else {
    console.log("❌ Error: Session should be complete but isn't.");
    process.exit(1);
}
