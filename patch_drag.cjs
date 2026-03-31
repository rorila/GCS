const fs = require('fs');
let code = fs.readFileSync('src/editor/services/StageInteractionManager.ts', 'utf8');

const regex = /const draggedIds = Array\.from\(this\.initialPositions\.keys\(\)\);\s*draggedIds\.forEach\(id => \{\s*const el = this\.host\.element\.querySelector\(`\[data-id="\$\{id\}"\]`\) as HTMLElement;\s*if \(el\) \{\s*el\.style\.transform = '';\s*const iP = this\.initialPositions\.get\(id\), iG = this\.initialDragPositions\.get\(id\);\s*if \(iP && iG\) \{\s*const gX = this\.snap\(iP\.left \+ dx\), gY = this\.snap\(iP\.top \+ dy\);\s*if \(gX !== iG\.x \|\| gY !== iG\.y\) \{\s*const obj = this\.host\.lastRenderedObjects\.find\(o => \(o\.id \|\| o\.name\) === id\);\s*if \(obj\) \{\s*changeRecorder\.record\(\{ type: 'drag', description: `\$\{obj\.name \|\| id\} verschoben nach \(\$\{gX\}, \$\{gY\}\)`, objectId: id, objectType: 'object', startPosition: \{ x: iG\.x, y: iG\.y \}, endPosition: \{ x: gX, y: gY \}, dragPath: \[\.\.\.this\.currentDragPath\] \}\);\s*if \(this\.host\.onObjectMove\) this\.host\.onObjectMove\(id, Math\.max\(0, gX\), Math\.max\(0, gY\)\);\s*\}\s*\}\s*\}\s*\}\s*\}\);/m;

const replacement = `const draggedIds = Array.from(this.initialPositions.keys());
                draggedIds.forEach(id => {
                    const el = this.host.element.querySelector(\`[data-id="\${id}"]\`) as HTMLElement;
                    if (el) {
                        el.style.transform = '';
                        const iP = this.initialPositions.get(id), iG = this.initialDragPositions.get(id);
                        if (iP && iG) {
                            let gX = this.snap(iP.left + dx), gY = this.snap(iP.top + dy);
                            
                            const obj = this.host.lastRenderedObjects.find(o => (o.id || o.name) === id);
                            if (obj) {
                                // NEU: Check Reparenting
                                el.style.display = 'none';
                                const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
                                el.style.display = '';

                                let dropParentId: string | null = null;
                                if (dropTarget) {
                                    const panelEl = dropTarget.closest('.game-object[data-type="TGroupPanel"]');
                                    if (panelEl && panelEl !== el && !el.contains(panelEl)) {
                                        dropParentId = panelEl.getAttribute('data-id') || null;
                                    }
                                }

                                const currentParentId = obj.parentId || null;
                                
                                if (dropParentId !== currentParentId) {
                                    const getAbs = (tgtId: string | null) => {
                                        let ax = 0, ay = 0, curr = tgtId;
                                        while (curr) {
                                            const p = this.host.lastRenderedObjects.find(o => o.id === curr);
                                            if (p) { ax += p.x || 0; ay += p.y || 0; curr = p.parentId || null; }
                                            else break;
                                        }
                                        return { x: ax, y: ay };
                                    };

                                    const oldParentAbs = getAbs(currentParentId);
                                    const absX = gX + oldParentAbs.x;
                                    const absY = gY + oldParentAbs.y;

                                    const newParentAbs = getAbs(dropParentId);
                                    gX = absX - newParentAbs.x;
                                    gY = absY - newParentAbs.y;
                                }

                                if (gX !== iG.x || gY !== iG.y || dropParentId !== currentParentId) {
                                    changeRecorder.record({ type: 'drag', description: \`\${obj.name || id} verschoben\`, objectId: id, objectType: 'object', startPosition: { x: iG.x, y: iG.y }, endPosition: { x: gX, y: gY }, dragPath: [...this.currentDragPath] });
                                    if (this.host.onObjectMove) this.host.onObjectMove(id, Math.max(0, gX), Math.max(0, gY), dropParentId);
                                }
                            }
                        }
                    }
                });`;

if(regex.test(code)) {
    code = code.replace(regex, replacement);
    fs.writeFileSync('src/editor/services/StageInteractionManager.ts', code);
    console.log('successfully patched StageInteractionManager');
} else {
    console.error('Regex did not match!');
}`;
