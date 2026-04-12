import { TStringMap } from './src/components/TStringMap';
import { ComponentRegistry } from './src/utils/ComponentRegistry';

const initial = new TStringMap("Test", 0, 0);
initial.entries = { "GoToReactiveSystemStory": "Gehe zur Story" };

// Simulating RuntimeStageManager output
const objData = initial;

// Simulating GameRuntime map
const cloned = ComponentRegistry.create(objData);

console.log("Cloned object:", cloned);
console.log("Cloned entries:", cloned.entries);
