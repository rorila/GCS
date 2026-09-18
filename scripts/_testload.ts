import { SchemaMigrator } from '../src/services/SchemaMigrator';
import { hydrateObjects } from '../src/utils/Serialization';
import * as fs from 'fs';
for (const f of ['Kopfrechnen','MathePuzzle','UfoShoter4']) {
  try {
    const j = JSON.parse(fs.readFileSync('game-server/public/projects/'+f+'.json','utf8'));
    const sm: any = SchemaMigrator;
    if (typeof sm.migrate === 'function') sm.migrate(j);
    if (typeof sm.ensureUserStories === 'function') sm.ensureUserStories(j);
    for (const st of (j.stages||[])) { hydrateObjects(st.objects||[]); hydrateObjects(st.variables||[]); }
    console.log(f, 'OK');
  } catch(e:any) { console.log(f, 'CRASH:', e.message); console.log((e.stack||'').split('\n').slice(0,5).join('\n')); }
}
