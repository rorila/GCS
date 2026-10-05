import { SchemaMigrator } from '../src/services/SchemaMigrator';
import { RefactoringManager } from '../src/editor/RefactoringManager';
import * as fs from 'fs';
for (const f of ['Kopfrechnen','MathePuzzle','UfoShoter4']) {
  try {
    const j = JSON.parse(fs.readFileSync('game-server/public/projects/'+f+'.json','utf8'));
    RefactoringManager.cleanActionSequences(j);
    SchemaMigrator.migrateToV4(j);
    console.log(f, 'OK');
  } catch(e:any) { console.log(f, 'CRASH:', e.message); console.log((e.stack||'').split('\n').slice(0,6).join('\n')); }
}
