import { PropertyHelper } from './src/runtime/PropertyHelper';
import { ExpressionParser } from './src/runtime/ExpressionParser';
import { TStringMap } from './src/components/TStringMap';
import { ReactiveRuntime } from './src/runtime/ReactiveRuntime';

// Mock ComponentRegistry behavior
const stringMap = new TStringMap('StringMap_4', 0, 0);
stringMap.entries = { 'GoToReactiveSystemStory': 'Gehe zur Story...' };

const rr = new ReactiveRuntime();
const proxy = rr.registerObject('StringMap_4', stringMap, true);

const ctx = rr.getContext();

const result = ExpressionParser.interpolate('${StringMap_4.GoToReactiveSystemStory}', ctx);

console.log("Interpolation Result:", result);
console.log("Proxy Entries:", proxy.value);
