import { TTimer } from '../src/components/TTimer';
import { ReactiveRuntime } from '../src/runtime/ReactiveRuntime';

const timer = new TTimer('CreateSpritesTimer', 0, 9);
timer.interval = 50; // fast tick
timer.enabled = true;
timer.events = { onTimer: 'CreateANewUfo' };

// Simulate makeReactive
const reactiveRuntime = new ReactiveRuntime();
const proxyTimer = reactiveRuntime.registerObject(timer.name, timer, true);

let eventFired = false;

// Simulate EditorRunManager
proxyTimer.onEvent = (ev) => {
    console.log('EditorRunManager received:', ev);
};
proxyTimer.start(() => proxyTimer.onEvent('onTimer'));

// Simulate GameRuntime initMainGame
const callbacks = {
    handleEvent: (id, ev) => {
        console.log('GameRuntime handleEvent called for:', id, ev);
        eventFired = true;
    }
};

proxyTimer.initRuntime(callbacks);
proxyTimer.onRuntimeStart();

setTimeout(() => {
    if (!eventFired) {
        console.error('FAIL: onTimer did not fire!');
        process.exit(1);
    } else {
        console.log('SUCCESS: onTimer fired!');
        process.exit(0);
    }
}, 200);
