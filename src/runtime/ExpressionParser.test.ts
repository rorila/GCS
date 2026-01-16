import { ExpressionParser } from '../runtime/ExpressionParser';

describe('ExpressionParser', () => {
    describe('findExpressions', () => {
        it('should find simple variable expressions', () => {
            const result = ExpressionParser.findExpressions('Hello ${name}!');
            expect(result).toEqual(['name']);
        });

        it('should find multiple expressions', () => {
            const result = ExpressionParser.findExpressions('${firstName} ${lastName}');
            expect(result).toEqual(['firstName', 'lastName']);
        });

        it('should find nested property expressions', () => {
            const result = ExpressionParser.findExpressions('Score: ${player.score}');
            expect(result).toEqual(['player.score']);
        });

        it('should find complex expressions', () => {
            const result = ExpressionParser.findExpressions('${x + 10} and ${y > 5}');
            expect(result).toEqual(['x + 10', 'y > 5']);
        });

        it('should return empty array for no expressions', () => {
            const result = ExpressionParser.findExpressions('No expressions here');
            expect(result).toEqual([]);
        });
    });

    describe('interpolate', () => {
        it('should interpolate simple variables', () => {
            const result = ExpressionParser.interpolate('Hello ${name}!', { name: 'Alice' });
            expect(result).toBe('Hello Alice!');
        });

        it('should interpolate multiple variables', () => {
            const result = ExpressionParser.interpolate(
                '${firstName} ${lastName}',
                { firstName: 'John', lastName: 'Doe' }
            );
            expect(result).toBe('John Doe');
        });

        it('should interpolate nested properties', () => {
            const result = ExpressionParser.interpolate(
                'Score: ${player.score}',
                { player: { score: 100 } }
            );
            expect(result).toBe('Score: 100');
        });

        it('should preserve type for single expression', () => {
            const result = ExpressionParser.interpolate('${score}', { score: 42 });
            expect(result).toBe(42);
            expect(typeof result).toBe('number');
        });

        it('should handle arithmetic expressions', () => {
            const result = ExpressionParser.interpolate('${score + 10}', { score: 50 });
            expect(result).toBe(60);
        });

        it('should handle comparison expressions', () => {
            const result = ExpressionParser.interpolate('${score > 100}', { score: 150 });
            expect(result).toBe(true);
        });

        it('should return original for non-string input', () => {
            const result = ExpressionParser.interpolate(42, {});
            expect(result).toBe(42);
        });

        it('should return original for no expressions', () => {
            const result = ExpressionParser.interpolate('No expressions', {});
            expect(result).toBe('No expressions');
        });

        it('should handle missing variables gracefully', () => {
            const result = ExpressionParser.interpolate('Hello ${missing}!', {});
            expect(result).toBe('Hello !');
        });
    });

    describe('evaluate', () => {
        it('should evaluate simple variable access', () => {
            const result = ExpressionParser.evaluate('name', { name: 'Alice' });
            expect(result).toBe('Alice');
        });

        it('should evaluate nested property access', () => {
            const result = ExpressionParser.evaluate('player.score', { player: { score: 100 } });
            expect(result).toBe(100);
        });

        it('should evaluate arithmetic expressions', () => {
            expect(ExpressionParser.evaluate('x + 10', { x: 5 })).toBe(15);
            expect(ExpressionParser.evaluate('x - 5', { x: 10 })).toBe(5);
            expect(ExpressionParser.evaluate('x * 2', { x: 3 })).toBe(6);
            expect(ExpressionParser.evaluate('x / 2', { x: 10 })).toBe(5);
        });

        it('should evaluate comparison expressions', () => {
            expect(ExpressionParser.evaluate('x > 5', { x: 10 })).toBe(true);
            expect(ExpressionParser.evaluate('x < 5', { x: 10 })).toBe(false);
            expect(ExpressionParser.evaluate('x >= 10', { x: 10 })).toBe(true);
            expect(ExpressionParser.evaluate('x <= 5', { x: 10 })).toBe(false);
            expect(ExpressionParser.evaluate('x == 10', { x: 10 })).toBe(true);
            expect(ExpressionParser.evaluate('x != 5', { x: 10 })).toBe(true);
        });

        it('should evaluate logical expressions', () => {
            expect(ExpressionParser.evaluate('x > 5 && y < 10', { x: 10, y: 5 })).toBe(true);
            expect(ExpressionParser.evaluate('x > 5 || y > 10', { x: 3, y: 15 })).toBe(true);
            expect(ExpressionParser.evaluate('!flag', { flag: false })).toBe(true);
        });

        it('should handle undefined variables', () => {
            const result = ExpressionParser.evaluate('missing', {});
            expect(result).toBeUndefined();
        });
    });

    describe('getNestedProperty', () => {
        it('should get top-level property', () => {
            const result = ExpressionParser.getNestedProperty('name', { name: 'Alice' });
            expect(result).toBe('Alice');
        });

        it('should get nested property', () => {
            const result = ExpressionParser.getNestedProperty(
                'player.score',
                { player: { score: 100 } }
            );
            expect(result).toBe(100);
        });

        it('should get deeply nested property', () => {
            const result = ExpressionParser.getNestedProperty(
                'game.player.stats.score',
                { game: { player: { stats: { score: 100 } } } }
            );
            expect(result).toBe(100);
        });

        it('should return undefined for missing property', () => {
            const result = ExpressionParser.getNestedProperty('missing.path', {});
            expect(result).toBeUndefined();
        });
    });

    describe('setNestedProperty', () => {
        it('should set top-level property', () => {
            const obj: any = {};
            ExpressionParser.setNestedProperty('name', 'Alice', obj);
            expect(obj.name).toBe('Alice');
        });

        it('should set nested property', () => {
            const obj: any = { player: {} };
            ExpressionParser.setNestedProperty('player.score', 100, obj);
            expect(obj.player.score).toBe(100);
        });

        it('should create missing intermediate objects', () => {
            const obj: any = {};
            ExpressionParser.setNestedProperty('player.stats.score', 100, obj);
            expect(obj.player.stats.score).toBe(100);
        });
    });

    describe('extractDependencies', () => {
        it('should extract simple variable', () => {
            const result = ExpressionParser.extractDependencies('score');
            expect(result).toEqual(['score']);
        });

        it('should extract multiple variables', () => {
            const result = ExpressionParser.extractDependencies('x + y');
            expect(result).toContain('x');
            expect(result).toContain('y');
        });

        it('should extract from complex expression', () => {
            const result = ExpressionParser.extractDependencies('player.score > enemy.score');
            expect(result).toContain('player');
            expect(result).toContain('score');
            expect(result).toContain('enemy');
        });

        it('should not include keywords', () => {
            const result = ExpressionParser.extractDependencies('x > 5 && true');
            expect(result).not.toContain('true');
        });
    });
});
