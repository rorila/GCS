import { ExpressionParser } from "./src/runtime/ExpressionParser.js";
import { PropertyHelper } from "./src/runtime/PropertyHelper.js";

const context = {
    MainThemes: {
        className: "TStringMap",
        entries: {
            StageBackground: "#0e2000"
        }
    }
};

const result = ExpressionParser.interpolate("${MainThemes.StageBackground}", context);
console.log("INTERPOLATED:", result);
