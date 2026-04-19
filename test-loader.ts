import path from 'path';
import fs from 'fs';

function testLoader(basePath: string) {
    const SCHEMA_MODULES = [
        'schemas/schema_containers.json',
        'schemas/schema_dialogs.json',
        'schemas/schema_inputs.json',
        'schemas/schema_display.json',
        'schemas/schema_timers.json',
        'schemas/schema_media.json',
        'schemas/schema_variables.json',
        'schemas/schema_game.json',
        'schemas/schema_services.json'
    ];

    const baseSchemaPath = path.resolve(basePath, 'schemas/schema_base.json');
    if (!fs.existsSync(baseSchemaPath)) {
        throw new Error(`Basis-Schema nicht gefunden: ${baseSchemaPath}`);
    }

    const baseSchema = JSON.parse(fs.readFileSync(baseSchemaPath, 'utf-8'));

    for (const modulePath of SCHEMA_MODULES) {
        const fullPath = path.resolve(basePath, modulePath);
        if (!fs.existsSync(fullPath)) {
            console.log("Missing:", fullPath);
            continue;
        }

        try {
            const moduleData = JSON.parse(fs.readFileSync(fullPath, 'utf-8'));
            if (moduleData.components) {
                Object.assign(baseSchema.components, moduleData.components);
            }
        } catch (e) { 
            console.log("Parse Err:", fullPath, e);
        }
    }
    return baseSchema;
}

try {
    const s = testLoader(path.resolve(process.cwd(), 'docs'));
    console.log(Object.keys(s.components));
} catch(e) {
    console.error("Crash", e);
}
