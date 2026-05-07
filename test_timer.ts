import { GameRuntime } from './src/runtime/GameRuntime';
import fs from 'fs';
const proj = JSON.parse(fs.readFileSync('game-server/public/projects/Spawning Shooter DemoUmbennenung der Sprites Tasks und Actions.json', 'utf8'));
const rt = new GameRuntime(proj, undefined, { makeReactive: true });
rt.start();
const timer = rt.objects.find(o => o.name === 'KanonenTemplateTimer');
console.log('Timer Events:', timer.events);
console.log('Timer Tasks:', timer.Tasks);
