import { ExpressionParser } from './ExpressionParser';
import { PropertyHelper } from './PropertyHelper';
import { TIntegerVariable } from '../components/TIntegerVariable';
import { TStringVariable } from '../components/TStringVariable';
import { TListVariable } from '../components/TListVariable';

describe('Variable Consolidation', () => {
    let intVar: TIntegerVariable;
    let strVar: TStringVariable;
    let listVar: TListVariable;
    let context: any;

    beforeEach(() => {
        intVar = new TIntegerVariable('score', 0, 0);
        intVar.value = 10;

        strVar = new TStringVariable('pin', 0, 0);
        strVar.value = '123';

        listVar = new TListVariable('items', 0, 0);
        listVar.items = ['A', 'B'];

        context = {
            score: intVar,
            pin: strVar,
            items: listVar,
            $params: { emoji: '🍎' }
        };
    });

    describe('JS Operator Compatibility (valueOf)', () => {
        it('should allow arithmetic with integer variables', () => {
            const result = ExpressionParser.evaluate('score + 5', context);
            expect(result).toBe(15);
        });

        it('should allow string concatenation with string variables', () => {
            const result = ExpressionParser.evaluate('pin + $params.emoji', context);
            expect(result).toBe('123🍎');
        });

        it('should handle addition of two variables correctly', () => {
            const result = ExpressionParser.evaluate('score + score', context);
            expect(result).toBe(20);
        });
    });

    describe('Interpolation (resolveValue)', () => {
        it('should interpolate simple variables', () => {
            const result = PropertyHelper.interpolate('Value: ${score}', context, [intVar]);
            expect(result).toBe('Value: 10');
        });

        it('should interpolate list variables', () => {
            const result = PropertyHelper.interpolate('Items: ${items}', context, [listVar]);
            expect(result).toBe('Items: A, B');
        });

        it('should interpolate string variables', () => {
            const result = ExpressionParser.interpolate('PIN: ${pin}', context);
            expect(result).toBe('PIN: 123');
        });
    });

    describe('Nested Access', () => {
        it('should still allow access to component properties', () => {
            // valueOf only kicks in for operators or when specifically requested.
            // getNestedProperty should resolve the value am Ende.
            const result = ExpressionParser.evaluate('score.name', context);
            expect(result).toBe('score');
        });
    });
});
