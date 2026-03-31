const fs = require('fs');
let code = fs.readFileSync('src/editor/services/StageInteractionManager.ts', 'utf8');

const searchStr = `                        const iP = this.initialPositions.get(id), iG = this.initialDragPositions.get(id);
                        if (iP && iG) {
                            const gX = this.snap(iP.left + dx), gY = this.snap(iP.top + dy);
                            if (gX !== iG.x || gY !== iG.y) {
                                const obj = this.host.lastRenderedObjects.find(o => (o.id || o.name) === id);
                                if (obj) {
                                    changeRecorder.record({ type: 'drag', description: \`\${obj.name || id} verschoben nach (\${gX}, \${gY})\`, objectId: id, objectType: 'object', startPosition: { x: iG.x, y: iG.y }, endPosition: { x: gX, y: gY }, dragPath: [...this.currentDragPath] });
                                    if (this.host.onObjectMove) this.host.onObjectMove(id, Math.max(0, gX), Math.max(0, gY));
                                }
                            }
                        }`;

const replStr = `                        const iP = this.initialPositions.get(id), iG = this.initialDragPositions.get(id);
                        if (iP && iG) {
                            let gX = this.snap(iP.left + dx), gY = this.snap(iP.top + dy);
                            
                            const obj = this.host.lastRenderedObjects.find(o => (o.id || o.name) === id);
                            if (obj) {
                                // NEU: Check Reparenting
                                el.style.display = 'none';
                                const dropTarget = document.elementFromPoint(e.clientX, e.clientY);
                                el.style.display = '';

                                let dropParentId = null;
                                // We check if there's a drop target that is a TGroupPanel
                                if (dropTarget) {
                                    const panelEl = dropTarget.closest('.game-object[data-type="TGroupPanel"]');
                                    if (panelEl && panelEl !== el && !el.contains(panelEl)) {
                                        dropParentId = panelEl.getAttribute('data-id') || null;
                                    }
                                }

                                const currentParentId = obj.parentId || null;
                                
                                if (dropParentId !== currentParentId) {
                                    const getAbs = (tgtId) => {
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
                        }`;

code = code.replace(searchStr, replStr);
fs.writeFileSync('src/editor/services/StageInteractionManager.ts', code);
console.log('patched successfully');
