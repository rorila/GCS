import { TTimer } from '../src/components/TTimer';

const timer = new TTimer('test_timer', 0, 0);
timer.interval = 100;
timer.enabled = true;

let fired = 0;
timer.initRuntime({
    handleEvent: (id, ev) => {
        console.log('Fired event:', ev);
        fired++;
        if (fired >= 3) {
            timer.stop();
            process.exit(0);
        }
    }
});

timer.onRuntimeStart();

setTimeout(() => {
    console.error('Timer did not fire in 500ms!');
    process.exit(1);
}, 500);
