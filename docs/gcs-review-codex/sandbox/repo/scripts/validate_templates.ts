import * as fs from 'fs';
import * as path from 'path';

/**
 * Validator for JSON templates to prevent balanced brace errors.
 * Run with: npx tsx scripts/validate_templates.ts
 */

function validateBraces(text: string, filePath: string): boolean {
    let i = 0;
    let errors = 0;

    while (i < text.length) {
        if (text[i] === '$' && text[i + 1] === '{') {
            let braceDepth = 1;
            const startPos = i;
            i += 2;

            while (i < text.length && braceDepth > 0) {
                if (text[i] === '$' && text[i + 1] === '{') {
                    braceDepth++;
                    i++;
                } else if (text[i] === '}') {
                    braceDepth--;
                }
                i++;
            }

            if (braceDepth !== 0) {
                console.error(`❌ Unbalanced braces in ${filePath} starting at position ${startPos}`);
                console.error(`   Snippet: ${text.substring(startPos, Math.min(startPos + 50, text.length))}...`);
                errors++;
            }
        } else {
            i++;
        }
    }
    return errors === 0;
}

function scanDirectory(dir: string) {
    console.log(`--- Scanning ${dir} for template errors ---`);
    let totalFiles = 0;
    let errorFiles = 0;

    const files = fs.readdirSync(dir);
    for (const file of files) {
        const fullPath = path.join(dir, file);
        if (fs.statSync(fullPath).isDirectory()) {
            scanDirectory(fullPath);
            continue;
        }

        if (file.endsWith('.json')) {
            totalFiles++;
            const content = fs.readFileSync(fullPath, 'utf8');
            if (!validateBraces(content, fullPath)) {
                errorFiles++;
            }
        }
    }

    if (totalFiles > 0) {
        console.log(`Scanned ${totalFiles} files. Found errors in ${errorFiles} files.`);
    }
}

const publicDir = path.join(process.cwd(), 'public');
const configDir = path.join(process.cwd(), 'src/editor/config');

if (fs.existsSync(publicDir)) scanDirectory(publicDir);
if (fs.existsSync(configDir)) scanDirectory(configDir);
