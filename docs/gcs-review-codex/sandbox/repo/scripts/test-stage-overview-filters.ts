import assert from 'node:assert/strict';
import fs from 'node:fs';
import { stageOverviewFilters } from '../src/editor/services/StageOverviewFilters';
import { GameProject } from '../src/model/types';

const cms: GameProject = JSON.parse(fs.readFileSync('game-server/public/projects/GCS-CMS.json', 'utf8'));
const snapshot = JSON.stringify(cms);
assert.equal(stageOverviewFilters(cms)[0].options.length, 7);
assert.ok(cms.stages!.find(s => s.id === 'stage_decks')!.overviewTags!.roles.includes('parent'));
for (const file of ['PingPong.json', 'ElinsMemory.json', 'BonsaiTetris.json']) {
    const game = JSON.parse(fs.readFileSync(`game-server/public/projects/${file}`, 'utf8'));
    assert.deepEqual(stageOverviewFilters(game), [], file);
}
const custom = {
    stages: [{ id: 'stage_parent', overviewTags: { worlds: ['forest'] } }, { overviewTags: { worlds: ['sea'] } }],
    stageOverview: { filters: [{ id: 'worlds', label: 'Welten', options: [
        { id: 'forest', label: 'Wald' }, { id: 'sea', label: 'Meer' },
        { id: 'unused', label: 'Unbenutzt' }, { id: 'forest', label: 'Doppelt' }
    ] }] }
} as unknown as GameProject;
assert.deepEqual(stageOverviewFilters(custom)[0].options.map(o => o.id), ['forest', 'sea']);
custom.stages!.pop();
assert.deepEqual(stageOverviewFilters(custom), [], 'single-value facets are hidden');
assert.equal(JSON.stringify(cms), snapshot, 'filter resolution must not mutate projects');
console.log('OK: CMS roles, ordinary games, custom filters, empty/duplicate options, no mutation');
