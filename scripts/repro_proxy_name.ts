
import { makeReactive } from '../src/runtime/ReactiveProperty';
import { PropertyWatcher } from '../src/runtime/PropertyWatcher';
import { PropertyHelper } from '../src/runtime/PropertyHelper';

// Mock HTMLElement for Node environment
(global as any).HTMLElement = class { };
(global as any).Node = class { };

class MockFlowTask {
    private _name: string;
    constructor(name: string) {
        this._name = name;
    }
    get Name(): string {
        return this._name;
    }
    set Name(v: string) {
        this._name = v;
    }
}

const watcher = new PropertyWatcher();
const rawTask = new MockFlowTask('InitialName');
const proxiedTask = makeReactive(rawTask, watcher);

console.log('--- Direct Access ---');
console.log('Raw Task .Name:', rawTask.Name);
console.log('Raw Task constructor.name:', rawTask.constructor.name);
console.log('Proxied Task .Name:', (proxiedTask as any).Name);
console.log('Proxied Task constructor.name:', proxiedTask.constructor.name);

console.log('\n--- PropertyHelper.getPropertyValue ---');
const context = { selectedObject: proxiedTask };
const result = PropertyHelper.getPropertyValue(context, 'selectedObject.Name');
console.log('PropertyHelper result:', result);

if (result === 'InitialName') {
    console.log('\n✅ PropertyHelper resolved .Name correctly!');
} else {
    console.log('\n❌ PropertyHelper FAILED to resolve .Name! (Result:', result, ')');
}
