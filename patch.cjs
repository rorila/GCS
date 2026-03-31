const fs = require('fs');
const file = 'src/editor/services/StageRenderer.ts';
let code = fs.readFileSync(file, 'utf8');

const target1 = `    public renderObjects(objects: any[]) {
        if (!this.host || !this.host.element) return;
        
        // Update object hash for internal bookkeeping
        const objectHash = objects.map(o => \`\${o.id}@\${Number(o.x || 0).toFixed(1)},\${Number(o.y || 0).toFixed(1)}\`).join('|');

        if (this.host.runMode) {`;

const repl1 = `    public renderObjects(objects: any[], parentDOM?: HTMLElement) {
        if (!this.host || !this.host.element) return;
        
        const isRootPass = !parentDOM;
        const targetDOM = parentDOM || this.host.element;

        if (isRootPass) {
            // Update object hash for internal bookkeeping
            const objectHash = objects.map(o => \`\${o.id}@\${Number(o.x || 0).toFixed(1)},\${Number(o.y || 0).toFixed(1)}\`).join('|');

            if (this.host.runMode) {`;

code = code.replace(target1, repl1);

const target2 = `        }

        this.host.lastRenderedObjects = objects;
        const gridConfig = this.host.grid;`;

const repl2 = `        }

        if (isRootPass) {
            this.host.lastRenderedObjects = objects;
        }
        
        const gridConfig = this.host.grid;`;

code = code.replace(target2, repl2);

const target3 = `        const currentIds = this.collectAllIds(objects);
        const renderedElements = Array.from(this.host.element.querySelectorAll('.game-object')) as HTMLElement[];

        // Remove elements that are no longer in the objects list
        renderedElements.forEach(el => {
            const id = el.getAttribute('data-id');
            if (id && !currentIds.has(id)) {
                el.remove();
            }
        });`;

const repl3 = `        if (isRootPass) {
            const currentIds = this.collectAllIds(objects);
            const renderedElements = Array.from(this.host.element.querySelectorAll('.game-object')) as HTMLElement[];

            // Remove elements that are no longer in the objects list
            renderedElements.forEach(el => {
                const id = el.getAttribute('data-id');
                if (id && !currentIds.has(id)) {
                    el.remove();
                }
            });
        }`;

code = code.replace(target3, repl3);

const target4 = `                el.style.userSelect = 'none';
                this.host.element.appendChild(el);
                isNew = true;
            }`;

const repl4 = `                el.style.userSelect = 'none';
                targetDOM.appendChild(el);
                isNew = true;
            } else if (el.parentElement !== targetDOM) {
                targetDOM.appendChild(el);
            }`;

code = code.replace(target4, repl4);

const target5 = `            // Component specific rendering
            this.renderComponentContent(el, obj, className, isNew);

            // Highlight selected
            this.updateSelectionState(el, objId);
        });
    }`;

const repl5 = `            // Component specific rendering
            this.renderComponentContent(el, obj, className, isNew);

            // Highlight selected
            this.updateSelectionState(el, objId);

            // --- RECURSIVE DOM NESTING FOR CHILDREN (TGroupPanel etc.) ---
            if (obj.children && Array.isArray(obj.children) && obj.children.length > 0) {
                this.renderObjects(obj.children, el);
            }
        });
    }`;

code = code.replace(target5, repl5);

const target6 = `    private collectAllIds(objs: any[]): Set<string> {
        const ids = new Set<string>();
        objs.forEach(o => {
            const objId = o.id || o.name;
            if (objId) ids.add(objId);
            if (o.children && Array.isArray(o.children)) {
                o.children.forEach((c: any) => {
                    const childId = c.id || c.name;
                    if (childId) ids.add(childId);
                });
            }
        });
        return ids;
    }`;

const repl6 = `    private collectAllIds(objs: any[]): Set<string> {
        const ids = new Set<string>();
        objs.forEach(o => {
            const objId = o.id || o.name;
            if (objId) ids.add(objId);
            if (o.children && Array.isArray(o.children)) {
                const childIds = this.collectAllIds(o.children);
                childIds.forEach(id => ids.add(id));
            }
        });
        return ids;
    }`;

code = code.replace(target6, repl6);

fs.writeFileSync(file, code);
console.log("Replaced successfully!");
