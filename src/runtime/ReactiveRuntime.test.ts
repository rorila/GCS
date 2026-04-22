import { ReactiveRuntime } from './ReactiveRuntime';

describe('ReactiveRuntime', () => {
    let runtime: ReactiveRuntime;

    beforeEach(() => {
        runtime = new ReactiveRuntime();
    });

    afterEach(() => {
        runtime.clear();
    });

    describe('object and variable registration', () => {
        it('should register and retrieve objects', () => {
            const player = { name: 'Alice', score: 0 };
            runtime.registerObject('player', player);

            expect(runtime.getObject('player')).toBeDefined();
            expect(runtime.getObject('player').name).toBe('Alice');
        });

        it('should register and retrieve variables', () => {
            runtime.registerVariable('gameTitle', 'My Game');

            expect(runtime.getVariable('gameTitle')).toBe('My Game');
        });
    });

    describe('one-way binding (data → UI)', () => {
        it('should update target when source changes', () => {
            const player = { score: 0 };
            const label = { text: '' };

            runtime.registerObject('player', player);
            runtime.bind(label, 'text', '${player.score}');

            // Initial value
            expect(label.text).toBe(0);

            // Change source
            player.score = 100;

            // Target should update automatically
            expect(label.text).toBe(100);
        });

        it('should support nested properties', () => {
            const player = { stats: { score: 0 } };
            const label = { text: '' };

            runtime.registerObject('player', player);
            runtime.bind(label, 'text', '${player.stats.score}');

            expect(label.text).toBe(0);

            player.stats.score = 50;

            expect(label.text).toBe(50);
        });

        it('should support expressions', () => {
            const player = { score: 10 };
            const label = { text: '' };

            runtime.registerObject('player', player);
            runtime.bind(label, 'text', '${player.score + 5}');

            expect(label.text).toBe(15);

            player.score = 20;

            expect(label.text).toBe(25);
        });

        it('should support multiple bindings to same source', () => {
            const player = { score: 0 };
            const label1 = { text: '' };
            const label2 = { text: '' };

            runtime.registerObject('player', player);
            runtime.bind(label1, 'text', '${player.score}');
            runtime.bind(label2, 'text', 'Score: ${player.score}');

            player.score = 100;

            expect(label1.text).toBe(100);
            expect(label2.text).toBe('Score: 100');
        });
    });

    describe('type coercion (String -> Number)', () => {
        it('should coerce string bindings to numbers if target expects a number', () => {
            const config = { padding: "15" }; // String from config (like StringMap)
            const component = { borderWidth: 0 }; // Target has a number

            runtime.registerObject('config', config);
            runtime.bind(component, 'borderWidth', '${config.padding}');

            // Target should be cast to a number
            expect(component.borderWidth).toBe(15);
            expect(typeof component.borderWidth).toBe('number');
        });

        it('should coerce string bindings to numbers if property name is a known numeric property', () => {
            const config = { radius: "20" };
            const component = { borderRadius: undefined }; // Target has no type yet

            runtime.registerObject('config', config);
            runtime.bind(component, 'borderRadius', '${config.radius}');

            // Target should be cast to a number because 'borderRadius' is in the known list
            expect(component.borderRadius).toBe(20);
            expect(typeof component.borderRadius).toBe('number');
        });

        it('should NOT coerce if target is a string and not a known numeric property', () => {
            const config = { id: "1234" };
            const component = { text: "default" };

            runtime.registerObject('config', config);
            runtime.bind(component, 'text', '${config.id}');

            // Target should remain a string
            expect(component.text).toBe("1234");
            expect(typeof component.text).toBe('string');
        });
    });

    describe('bidirectional binding', () => {
        it('should update data when component changes', () => {
            const player = { name: 'Alice' };
            const input = { text: '' };
            let dataUpdated = false;

            runtime.registerObject('player', player);
            runtime.bindComponent(
                input,
                'text',
                '${player.name}',
                (newValue) => {
                    player.name = newValue;
                    dataUpdated = true;
                }
            );

            // Initial: data → component
            expect(input.text).toBe('Alice');

            // Component changes → data
            input.text = 'Bob';

            expect(dataUpdated).toBe(true);
            expect(player.name).toBe('Bob');
        });
    });

    describe('variable updates', () => {
        it('should trigger bindings when variable changes', () => {
            const label = { text: '' };

            runtime.registerVariable('title', 'Hello');
            runtime.bind(label, 'text', '${title}');

            expect(label.text).toBe('Hello');

            runtime.setVariable('title', 'World');

            expect(label.text).toBe('World');
        });
    });

    describe('evaluate', () => {
        it('should evaluate expressions with current context', () => {
            const player = { score: 50 };

            runtime.registerObject('player', player);

            const result = runtime.evaluate('${player.score + 10}');

            expect(result).toBe(60);
        });
    });

    describe('unbind', () => {
        it('should remove binding', () => {
            const player = { score: 0 };
            const label = { text: '' };

            runtime.registerObject('player', player);
            const bindingId = runtime.bind(label, 'text', '${player.score}');

            expect(label.text).toBe(0);

            runtime.unbind(bindingId);
            player.score = 100;

            // Should not update after unbind
            expect(label.text).toBe(0);
        });
    });

    describe('statistics', () => {
        it('should track stats', () => {
            const player = { score: 0 };
            const label = { text: '' };

            runtime.registerObject('player', player);
            runtime.registerVariable('title', 'Game');
            runtime.bind(label, 'text', '${player.score}');

            const stats = runtime.getStats();

            expect(stats.objectCount).toBe(1);
            expect(stats.variableCount).toBe(1);
            expect(stats.bindingCount).toBeGreaterThan(0);
        });
    });
});
