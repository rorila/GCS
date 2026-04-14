const { ExpressionParser } = require('./dist/runtime/ExpressionParser.js');
const ctx = { 
    value: 'onClick', 
    selectedObject: { 
        events: { onClick: 'ShowDirectory' } 
    } 
};
console.log('OUT:', ExpressionParser.interpolate('${selectedObject.events.${value}}', ctx));
