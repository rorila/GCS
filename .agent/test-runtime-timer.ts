import { TTimer } from '../src/components/TTimer';
import { GameRuntime } from '../src/runtime/GameRuntime';
import { ProjectStore } from '../src/services/ProjectStore';
import { hydrateObjects } from '../src/utils/Serialization';
import { safeDeepCopy } from '../src/utils/DeepCopy';

// Create a project
const project = {
    settings: {},
    stages: [
        {
            id: 'stage_1',
            type: 'main',
            objects: [
                {
                    className: 'TTimer',
                    id: 'timer_1',
                    name: 'CreateSpritesTimer',
                    interval: 50,
                    enabled: true,
                    maxInterval: 10,
                    events: { onTimer: 'CreateANewUfo' }
                }
            ],
            tasks: [
                {
                    name: 'CreateANewUfo',
                    actionSequence: [ { type: 'action', name: 'Play_Schuss' } ]
                }
            ]
        }
    ]
};

const hydratedProject = safeDeepCopy(project);
hydratedProject.stages[0].objects = hydrateObjects(hydratedProject.stages[0].objects);

// monkey patch
const origHandleEvent = GameRuntime.prototype.handleEvent;
GameRuntime.prototype.handleEvent = function(id, ev, data) {
    console.log('[DEBUG] handleEvent called:', id, ev);
    return origHandleEvent.call(this, id, ev, data);
};

const runtime = new GameRuntime(hydratedProject, undefined, {
    startStageId: 'stage_1',
    makeReactive: true
});

console.log('--- STARTING RUNTIME ---');
runtime.start();

setTimeout(() => {
    console.log('Done wait.');
    process.exit(0);
}, 500);
