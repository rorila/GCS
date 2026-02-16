
import fs from 'fs';

const path = './game-server/public/platform/project.json';

try {
    const project = JSON.parse(fs.readFileSync(path, 'utf8'));

    // MOCK Active Stage: Login
    const activeStageId = 'stage_login';
    const activeStage = project.stages.find(s => s.id === activeStageId);

    console.log(`--- SIMULATING EDITOR LOGIC for Stage: ${activeStageId} ---`);

    function getResolvedInheritanceObjects() {
        const mergedMap = new Map();

        // 1. Process Blueprint Stages first
        const blueprintStages = project.stages.filter(s => s.id === 'stage_blueprint') || [];
        const targetIsBlueprint = activeStage.id === 'stage_blueprint';

        blueprintStages.forEach(bs => {
            const objectsToInclude = targetIsBlueprint
                ? [...(bs.objects || []), ...(bs.variables || [])]
                : [...(bs.objects || [])];

            objectsToInclude.forEach((obj) => {
                if (!targetIsBlueprint) {
                    // MY FILTER LOGIC
                    if (obj.isService) {
                        console.log(`[Editor] Filtering out service: ${obj.name} (${obj.id}) from blueprint`);
                        return;
                    }

                    const copy = JSON.parse(JSON.stringify(obj));
                    copy.isInherited = true;
                    copy.isFromBlueprint = true;
                    mergedMap.set(obj.id || obj.name, copy);
                } else {
                    mergedMap.set(obj.id || obj.name, obj);
                }
            });
        });

        // 2. Project Globals (Should be empty now)
        const rootGlobals = [
            ...(project.objects || []).filter(obj => obj.scope === 'global'),
            ...(project.variables || []).filter(v => v.scope === 'global')
        ];
        rootGlobals.forEach(obj => {
            // ... logic ...
            mergedMap.set(obj.id || obj.name, obj);
        });

        // 3. Inheritance Chain
        // For stage_login (standard), chain is just itself [stage_login]
        const chain = [activeStage]; // Simplified, assuming no inheritsFrom

        // Loop bottom-up
        for (let i = chain.length - 1; i >= 0; i--) {
            const s = chain[i];
            const isTopLevel = (i === 0);

            const combined = [
                ...(s.objects || []),
                ...(s.variables || [])
            ];

            combined.forEach(obj => {
                const key = obj.id || obj.name;
                if (isTopLevel) {
                    mergedMap.set(key, obj);
                } else {
                    // ...
                }
            });
        }

        const finalResults = Array.from(mergedMap.values());
        console.log(`[Editor] Resolved Objects count: ${finalResults.length}`);
        finalResults.forEach(o => console.log(` - ${o.name} (${o.className}) [ID: ${o.id}]`));
        return finalResults;
    }

    const results = getResolvedInheritanceObjects();
    const hasPinPicker = results.find(r => r.id === 'pin_picker');

    if (hasPinPicker) {
        console.log('\nSUCCESS: PinPicker IS present in resolved objects.');
    } else {
        console.log('\nFAILURE: PinPicker is MISSING from resolved objects.');
    }

} catch (e) {
    console.error('Error:', e);
}
