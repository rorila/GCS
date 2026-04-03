import { GameRuntime } from './src/runtime/GameRuntime.ts';
import * as fs from 'fs';

const project = JSON.parse(fs.readFileSync('test_rutnime.json', 'utf8'));
const runtime = new GameRuntime(project, undefined, { makeReactive: false });
const objects = runtime.getObjects();
console.log(JSON.stringify(objects, null, 2));
