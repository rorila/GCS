import { PropertyHelper } from './src/runtime/PropertyHelper';
import { ExpressionParser } from './src/runtime/ExpressionParser';

const context = {
    "StringMap_4": {
        "GoToReactiveSystemStory": "Gehe zur Story..."
    }
};

const result = ExpressionParser.interpolate('${StringMap_4.GoToReactiveSystemStory}', context);
console.log("Interpolation Result:", result);
