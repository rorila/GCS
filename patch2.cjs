const fs = require('fs');
const file = 'src/runtime/GameRuntime.ts';
let code = fs.readFileSync(file, 'utf8');

const target1 = `    public spawnObject(templateId: string, x?: number, y?: number): any {
        // Template-Objekt finden (für Velocity-Defaults)
        const template = this.objects.find(o => o.id === templateId) as TSpriteTemplate | undefined;
        if (!template) {
            logger.warn(\`spawnObject: Template "\${templateId}" nicht gefunden\`);
            return null;
        }

        // Pool-basiertes Spawning
        if (this.spritePool.hasPool(templateId)) {
            const spawnX = x ?? template.x;
            const spawnY = y ?? template.y;
            const instance = this.spritePool.acquire(templateId, spawnX, spawnY, template);
            return instance;
        }

        logger.warn(\`spawnObject: Kein Pool für Template "\${templateId}" – kein Spawning möglich\`);
        return null;
    }`;

const repl1 = `    public spawnObject(templateId: string, x?: number, y?: number): any {
        // Template-Objekt finden
        const template = this.objects.find(o => o.id === templateId);
        if (!template) {
            logger.warn(\`spawnObject: Template "\${templateId}" nicht gefunden\`);
            return null;
        }

        // 1. TSpriteTemplate Pool-basiertes Spawning
        if (this.spritePool.hasPool(templateId)) {
            const spawnX = x ?? template.x;
            const spawnY = y ?? template.y;
            const instance = this.spritePool.acquire(templateId, spawnX, spawnY, template as any);
            return instance;
        }

        // 2. Generic Template Spawning (z.B. TGroupPanel)
        if ((template as any).isTemplate) {
            const cloneData = JSON.parse(JSON.stringify(template));
            const suffix = \`_spawn_\${Date.now()}_\${Math.random().toString(36).substr(2,5)}\`;
            
            cloneData.id = template.id + suffix;
            if (cloneData.name) {
                cloneData.name = cloneData.name + \`_spawn\`;
            }
            cloneData.isTemplate = false;
            cloneData.visible = true;
            if (x !== undefined) cloneData.x = x;
            if (y !== undefined) cloneData.y = y;
            
            // Rekursiv IDs neu vergeben
            const assignNewIds = (items: any[]) => {
                if (!items) return;
                items.forEach(c => {
                    c.id = c.id + suffix;
                    if (c.children) assignNewIds(c.children);
                });
            };
            if (cloneData.children) assignNewIds(cloneData.children);

            const hydrated = hydrateObjects([cloneData]);
            if (hydrated && hydrated.length > 0) {
                 const instance = hydrated[0];
                 this.objects.push(instance);
                 
                 // Runtime Init
                 const gridConfig = (this.stage && this.stage.grid) || this.project.stage?.grid || this.project.grid;
                 const runtimeCallbacks = {
                     handleEvent: (id: string, ev: string, data?: any) => this.handleEvent(id, ev, data),
                     render: this.options.onRender || (() => { }),
                     gridConfig,
                     objects: this.objects
                 };
                 if (instance.initRuntime) instance.initRuntime(runtimeCallbacks);
                 if (instance.onRuntimeStart) instance.onRuntimeStart();
                 
                 // Ggf. Reactive Binding
                 if (this.options.makeReactive) {
                     this.reactiveRuntime.registerObject(instance.name || instance.id, instance, true);
                 }
                 
                 return instance;
            }
        }

        logger.warn(\`spawnObject: Weder Pool noch isTemplate=true für "\${templateId}" – kein Spawning möglich\`);
        return null;
    }`;

code = code.replace(target1, repl1);

const target2 = `    public destroyObject(instanceId: string): void {
        // Versuche nach ID
        if (this.spritePool.release(instanceId)) {
            return;
        }

        // Versuche nach Name (für %Self%-Auflösung)
        if (this.spritePool.releaseByName(instanceId)) {
            return;
        }

        logger.warn(\`destroyObject: Instanz "\${instanceId}" nicht im Pool gefunden\`);
    }`;

const repl2 = `    public destroyObject(instanceId: string): void {
        // Versuche nach ID
        if (this.spritePool.release(instanceId)) {
            return;
        }

        // Versuche nach Name (für %Self%-Auflösung)
        if (this.spritePool.releaseByName(instanceId)) {
            return;
        }
        
        // Dynamisch persistente Objecte (Generic Templates)
        const idx = this.objects.findIndex(o => o.id === instanceId || o.name === instanceId);
        if (idx !== -1) {
            this.objects.splice(idx, 1);
            if (this.options.onRender) this.options.onRender();
            return;
        }

        logger.warn(\`destroyObject: Instanz "\${instanceId}" nicht im Pool oder Objekten gefunden\`);
    }`;

code = code.replace(target2, repl2);

fs.writeFileSync(file, code);
console.log('Replaced successfully!');
