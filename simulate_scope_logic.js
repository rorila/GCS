
import fs from 'fs';

const path = './game-server/public/platform/project.json';

try {
    const project = JSON.parse(fs.readFileSync(path, 'utf8'));

    // MOCK Active Stage: Login
    const activeStageId = 'stage_login';
    const activeStage = project.stages.find(s => s.id === activeStageId);

    console.log(`--- SIMULATING SCOPE VISIBILITY for Stage: ${activeStageId} ---`);

    // MOCK Editor Logic (Updated)
    function Editor_getResolvedInheritanceObjects_Mock() {
        const mergedMap = new Map();
        const targetIsBlueprint = activeStage.id === 'stage_blueprint';

        // 1. Blueprint Stages (Global)
        const blueprintStages = project.stages.filter(s => s.id === 'stage_blueprint') || [];

        blueprintStages.forEach(bs => {
            const isBlueprintStage = activeStage.type === 'blueprint';
            const showPreview = activeStage._showGlobalPreview === true;
            const visibleGlobals = activeStage.visibleGlobalIds || [];

            // 1. Blueprint Stage Logic
            if (isBlueprintStage) {
                const objectsToInclude = [...(bs.objects || []), ...(bs.variables || [])];
                objectsToInclude.forEach((obj) => mergedMap.set(obj.id || obj.name, obj));
                return;
            }

            // 2. Normal Stage Logic
            const objectsToInclude = [...(bs.objects || [])];
            objectsToInclude.forEach((obj) => {
                if (obj.isService) return;

                const isExplicitlyVisible = visibleGlobals.includes(obj.id);

                if (isExplicitlyVisible) {
                    mergedMap.set(obj.id || obj.name, obj);
                } else if (showPreview) {
                    const copy = JSON.parse(JSON.stringify(obj));
                    copy.isInherited = true;
                    copy.isGhost = true;
                    mergedMap.set(obj.id || obj.name, copy);
                }
            });
        });

        // 2. Root Globals 
        const rootGlobals = [
            ...(project.objects || []).filter(obj => obj.scope === 'global'),
            ...(project.variables || []).filter(v => v.scope === 'global')
        ];
        rootGlobals.forEach(obj => {
            if (targetIsBlueprint) {
                mergedMap.set(obj.id || obj.name, obj);
            }
        });

        // 3. Local Objects
        const chain = [activeStage];
        for (let i = chain.length - 1; i >= 0; i--) {
            const s = chain[i];
            const combined = [...(s.objects || []), ...(s.variables || [])];
            combined.forEach(obj => {
                mergedMap.set(obj.id || obj.name, obj);
            });
        }

        return Array.from(mergedMap.values());
    }

    // --- TEST SCENARIOS ---

    console.log('\n--- SCENARIO 1: Default (Strict Scope) ---');
    // Ensure Clean State
    activeStage.visibleGlobalIds = [];
    activeStage._showGlobalPreview = false;

    let results = Editor_getResolvedInheritanceObjects_Mock();
    let apiServer = results.find(o => o.name === 'API Server');
    let pinPicker = results.find(o => o.id === 'pin_picker'); // Use ID for pin picker

    if (!apiServer && pinPicker) {
        console.log('✅ Default: Global Hidden, Local Visible.');
    } else {
        console.error('❌ Default Failed:', { apiServer: !!apiServer, pinPicker: !!pinPicker });
    }

    console.log('\n--- SCENARIO 2: Pinning (Selective Visibility) ---');
    // Add dummy visual global to blueprint for testing
    const blueprintStage = project.stages.find(s => s.id === 'stage_blueprint');
    if (blueprintStage) {
        if (!blueprintStage.objects) blueprintStage.objects = [];
        blueprintStage.objects.push({ id: 'glob_hud', name: 'GlobalHUD', scope: 'global', className: 'TPanel', isService: false });
    }

    activeStage.visibleGlobalIds = ['glob_hud'];
    results = Editor_getResolvedInheritanceObjects_Mock();
    let hud = results.find(o => o.name === 'GlobalHUD');

    if (hud && !hud.isGhost) {
        console.log('✅ Pinning: GlobalHUD is VISIBLE and NOT a ghost.');
    } else {
        console.error('❌ Pinning Failed:', hud);
    }

    console.log('\n--- SCENARIO 3: Preview Mode ---');
    activeStage.visibleGlobalIds = []; // Reset Pin
    activeStage._showGlobalPreview = true;

    results = Editor_getResolvedInheritanceObjects_Mock();
    hud = results.find(o => o.name === 'GlobalHUD');
    apiServer = results.find(o => o.name === 'API Server');

    if (hud && hud.isGhost && !apiServer) {
        console.log('✅ Preview: GlobalHUD is VISIBLE (Ghost), Service Hidden.');
    } else {
        console.error('❌ Preview Failed:', { hud: !!hud, isGhost: hud?.isGhost, apiServer: !!apiServer });
    }


} catch (e) {
    console.error('Error:', e);
}
