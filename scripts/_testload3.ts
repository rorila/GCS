import { coreStore } from '../src/services/registry/CoreStore';
import * as fs from 'fs';
for (const f of ['Kopfrechnen','MathePuzzle','UfoShoter4']) {
  try {
    const j = JSON.parse(fs.readFileSync('game-server/public/projects/'+f+'.json','utf8'));
    (coreStore as any).setProject(j);
    console.log(f, 'OK');
  } catch(e:any) { console.log(f, 'CRASH:', e.message); console.log((e.stack||'').split('\n').slice(0,6).join('\n')); }
}
