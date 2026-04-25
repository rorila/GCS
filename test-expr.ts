import { ExpressionParser } from './src/runtime/ExpressionParser';

const context = {
    State: 'idle',
    Card1_State: 0
};

console.log('Test 1:', ExpressionParser.evaluate('State == "idle" && Card1_State == 0', context));
console.log('Test 2:', ExpressionParser.evaluate('State == "idle"', context));
console.log('Test 3:', ExpressionParser.evaluate('Card1_State == 0', context));

