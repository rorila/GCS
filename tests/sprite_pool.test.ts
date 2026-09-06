import { describe, it, expect, beforeEach } from 'vitest';
import { SpritePool } from '../src/runtime/SpritePool';
import { TSpriteTemplate } from '../src/components/TSpriteTemplate';

describe('SpritePool', () => {
    let pool: SpritePool;
    let template: TSpriteTemplate;
    let objects: any[];

    beforeEach(() => {
        pool = new SpritePool();
        template = new TSpriteTemplate('BulletTemplate', -5, -5, 1, 1);
        template.id = 'bullet_template';
        template.poolSize = 5;
        template.autoRecycle = true;
        template.lifetime = 0;
        template.velocityX = 0;
        template.velocityY = -0.5;
        template.collisionEnabled = true;
        template.spriteColor = '#ffff00';
        template.shape = 'circle';
        objects = [template];
    });

    describe('init()', () => {
        it('erzeugt poolSize Instanzen', () => {
            const created = pool.init(template, objects);
            expect(created.length).toBe(5);
            // Template + 5 Pool-Instanzen
            expect(objects.length).toBe(6);
        });

        it('Pool-Instanzen sind unsichtbar und haben korrekte IDs', () => {
            const created = pool.init(template, objects);
            created.forEach((sprite, i) => {
                expect(sprite.visible).toBe(false);
                expect(sprite.id).toBe(`bullet_template_pool_${i}`);
                expect(sprite.name).toBe(`BulletTemplate_pool_${i}`);
            });
        });

        it('Pool-Instanzen erben Sprite-Properties vom Template', () => {
            const created = pool.init(template, objects);
            created.forEach(sprite => {
                expect(sprite.width).toBe(1);
                expect(sprite.height).toBe(1);
                expect(sprite.collisionEnabled).toBe(true);
                expect(sprite.spriteColor).toBe('#ffff00');
                expect(sprite.shape).toBe('circle');
            });
        });
    });

    describe('acquire()', () => {
        it('holt eine freie Instanz und macht sie sichtbar', () => {
            pool.init(template, objects);
            const instance = pool.acquire('bullet_template', 10, 20, template);
            expect(instance).not.toBeNull();
            expect(instance!.visible).toBe(true);
            expect(instance!.x).toBe(10);
            expect(instance!.y).toBe(20);
            expect(instance!.velocityY).toBe(-0.5);
        });

        it('gibt null zurück wenn Pool leer und autoRecycle=false', () => {
            template.autoRecycle = false;
            pool.init(template, objects);
            // Alle 5 Instanzen belegen
            for (let i = 0; i < 5; i++) {
                pool.acquire('bullet_template', i, i, template);
            }
            const result = pool.acquire('bullet_template', 99, 99, template);
            expect(result).toBeNull();
        });

        it('recycelt älteste Instanz wenn Pool leer und autoRecycle=true', () => {
            pool.init(template, objects);
            const instances: any[] = [];
            for (let i = 0; i < 5; i++) {
                instances.push(pool.acquire('bullet_template', i, i, template));
            }
            // Pool ist jetzt voll – nächster acquire recycelt die älteste
            const recycled = pool.acquire('bullet_template', 99, 99, template);
            expect(recycled).not.toBeNull();
            expect(recycled!.x).toBe(99);
            // Die erste Instanz wurde recycled und ist jetzt die neue
            expect(recycled!.id).toBe(instances[0]!.id);
        });
    });

    describe('release()', () => {
        it('macht Instanz unsichtbar und parkt sie offscreen', () => {
            pool.init(template, objects);
            const instance = pool.acquire('bullet_template', 10, 20, template);
            expect(instance!.visible).toBe(true);
            
            pool.release(instance!.id);
            expect(instance!.visible).toBe(false);
            expect(instance!.x).toBe(-100);
            expect(instance!.velocityX).toBe(0);
            expect(instance!.velocityY).toBe(0);
        });

        it('released Instanz kann erneut acquired werden', () => {
            pool.init(template, objects);
            const first = pool.acquire('bullet_template', 10, 20, template);
            pool.release(first!.id);
            const second = pool.acquire('bullet_template', 30, 40, template);
            // Gleiche Instanz wiederverwendet
            expect(second!.id).toBe(first!.id);
            expect(second!.x).toBe(30);
        });
    });

    describe('releaseByName()', () => {
        it('released über Sprite-Name', () => {
            pool.init(template, objects);
            const instance = pool.acquire('bullet_template', 10, 20, template);
            expect(pool.releaseByName(instance!.name)).toBe(true);
            expect(instance!.visible).toBe(false);
        });
    });

    describe('releaseAll()', () => {
        it('gibt alle busy Instanzen frei', () => {
            pool.init(template, objects);
            pool.acquire('bullet_template', 1, 1, template);
            pool.acquire('bullet_template', 2, 2, template);
            pool.acquire('bullet_template', 3, 3, template);
            
            expect(pool.getActiveInstances().length).toBe(3);
            pool.releaseAll();
            expect(pool.getActiveInstances().length).toBe(0);
        });
    });

    describe('isPoolInstance()', () => {
        it('erkennt Pool-Instanzen', () => {
            pool.init(template, objects);
            expect(pool.isPoolInstance('bullet_template_pool_0')).toBe(true);
            expect(pool.isPoolInstance('some_other_id')).toBe(false);
        });
    });
});
