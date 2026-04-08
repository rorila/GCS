import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = path.resolve('./src');

const METHOD_MAPPINGS: Record<string, { module: string, exportName: string }> = {
    // VariableRegistry
    getVariables: { module: 'projectVariableRegistry', exportName: 'VariableRegistry' },
    validateVariableName: { module: 'projectVariableRegistry', exportName: 'VariableRegistry' },
    renameVariable: { module: 'projectVariableRegistry', exportName: 'VariableRegistry' },

    // TaskRegistry
    getTasks: { module: 'projectTaskRegistry', exportName: 'TaskRegistry' },
    getTaskContainer: { module: 'projectTaskRegistry', exportName: 'TaskRegistry' },
    validateTaskName: { module: 'projectTaskRegistry', exportName: 'TaskRegistry' },
    findOriginalTask: { module: 'projectTaskRegistry', exportName: 'TaskRegistry' },
    renameTask: { module: 'projectTaskRegistry', exportName: 'TaskRegistry' },
    deleteTask: { module: 'projectTaskRegistry', exportName: 'TaskRegistry' },

    // ActionRegistry
    getActions: { module: 'projectActionRegistry', exportName: 'ActionRegistry' },
    findOriginalAction: { module: 'projectActionRegistry', exportName: 'ActionRegistry' },
    getNextSmartActionName: { module: 'projectActionRegistry', exportName: 'ActionRegistry' },
    renameAction: { module: 'projectActionRegistry', exportName: 'ActionRegistry' },
    deleteAction: { module: 'projectActionRegistry', exportName: 'ActionRegistry' },

    // ObjectRegistry
    getObjects: { module: 'projectObjectRegistry', exportName: 'ObjectRegistry' },
    getFlowObjects: { module: 'projectObjectRegistry', exportName: 'ObjectRegistry' },
    getObjectsWithMetadata: { module: 'projectObjectRegistry', exportName: 'ObjectRegistry' },
    validateObjectName: { module: 'projectObjectRegistry', exportName: 'ObjectRegistry' },

    // ReferenceTracker
    findReferences: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },
    getObjectUsage: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },
    getTaskUsage: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },
    getActionUsage: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },
    getVariableUsage: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },
    getAllReferencedTaskNames: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },
    getLogicalUsage: { module: 'projectReferenceTracker', exportName: 'ReferenceTracker' },

    // CoreStore
    setProject: { module: 'coreStore', exportName: 'CoreStore' },
    getProject: { module: 'coreStore', exportName: 'CoreStore' },
    getStages: { module: 'coreStore', exportName: 'CoreStore' },
    setActiveStageId: { module: 'coreStore', exportName: 'CoreStore' },
    getActiveStageId: { module: 'coreStore', exportName: 'CoreStore' },
    getActiveStage: { module: 'coreStore', exportName: 'CoreStore' }
};

function processDirectory(dir: string) {
    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            if (fullPath.includes('registry') && dir.includes('services')) continue; // Skip the new registry implementations themselves
            processDirectory(fullPath);
        } else if (fullPath.endsWith('.ts') && fullPath !== path.resolve('./src/services/ProjectRegistry.ts')) {
            processFile(fullPath);
        }
    }
}

function processFile(filePath: string) {
    let content = fs.readFileSync(filePath, 'utf-8');
    
    // Check if it even uses ProjectRegistry / projectRegistry
    if (!content.includes('projectRegistry')) return;

    let modified = false;
    let requiredImports = new Set<string>();

    for (const [method, target] of Object.entries(METHOD_MAPPINGS)) {
        const regex = new RegExp(`(?:projectRegistry|projectTaskRegistry|projectActionRegistry|projectVariableRegistry|projectObjectRegistry|projectReferenceTracker|taskRegistry|actionRegistry|variableRegistry|objectRegistry|referenceTracker)\\.${method}`, 'g');
        if (regex.test(content)) {
            content = content.replace(regex, `${target.module}.${method}`);
            requiredImports.add(target.module);
            modified = true;
        }
    }

    if (modified) {
        // Evaluate the relative path to src/services/registry
        const fileDir = path.dirname(filePath);
        let registryDir = path.resolve('./src/services/registry');
        
        for (const imp of requiredImports) {
            let relativePath = path.relative(fileDir, path.join(registryDir, `${targetExportNameForImp(imp)}`));
            relativePath = relativePath.replace(/\\/g, '/');
            if (!relativePath.startsWith('.')) relativePath = './' + relativePath;
            
            // Add import to top if not present
            if (!content.includes(`import { ${imp} }`)) {
                content = `import { ${imp} } from '${relativePath}';\n` + content;
            }
        }
        
        // Remove old projectRegistry import
        content = content.replace(/import\s*{\s*ProjectRegistry\s*,\s*projectRegistry\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        content = content.replace(/import\s*{\s*projectRegistry\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        content = content.replace(/import\s*{\s*taskRegistry\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        content = content.replace(/import\s*{\s*actionRegistry\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        content = content.replace(/import\s*{\s*variableRegistry\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        content = content.replace(/import\s*{\s*objectRegistry\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        content = content.replace(/import\s*{\s*referenceTracker\s*}\s*from\s*['"][^'"]+['"];?\n?/, '');
        
        fs.writeFileSync(filePath, content, 'utf-8');
        console.log(`Updated ${filePath}`);
    }
}

function targetExportNameForImp(imp: string): string {
    if (imp === 'projectTaskRegistry') return 'TaskRegistry';
    if (imp === 'projectActionRegistry') return 'ActionRegistry';
    if (imp === 'projectVariableRegistry') return 'VariableRegistry';
    if (imp === 'projectObjectRegistry') return 'ObjectRegistry';
    if (imp === 'projectReferenceTracker') return 'ReferenceTracker';
    if (imp === 'coreStore') return 'CoreStore';
    return imp.charAt(0).toUpperCase() + imp.slice(1);
}

processDirectory('./src');
processDirectory('./tests');
console.log('Refactoring complete.');
