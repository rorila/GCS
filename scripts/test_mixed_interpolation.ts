import { ExpressionParser } from '../src/runtime/ExpressionParser.js';
import { PropertyHelper } from '../src/runtime/PropertyHelper.js';

const context = {
    currentUser: {
        id: 'u_rolf',
        name: 'Rolf'
    }
};

const mixedText = "Hallo, ${currentUser.name}, schön dass du dich angemeldet hast.";
const result = ExpressionParser.interpolate(mixedText, context);

console.log('--- Mixed Interpolation Test ---');
console.log('Source:', mixedText);
console.log('Result:', result);

if (result === "Hallo, Rolf, schön dass du dich angemeldet hast.") {
    console.log('✅ Success: Mixed text and expressions work perfectly in one string.');
} else {
    console.log('❌ Failure: Unexpected result.');
    process.exit(1);
}

// Case 2: Missing property (as in user's typo 'nam')
const typoText = "Hallo, ${currentUser.nam}!";
const typoResult = ExpressionParser.interpolate(typoText, context);
console.log('\n--- Typo Case Test ---');
console.log('Source:', typoText);
console.log('Result:', typoResult);
if (typoResult === "Hallo, !") {
    console.log('✅ Info: Undefined variables result in empty strings (prevents "undefined").');
}
