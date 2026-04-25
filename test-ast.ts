import jsep from 'jsep';

try {
    const ast = jsep('State == "idle" && Card1_State == 0');
    console.log(JSON.stringify(ast, null, 2));
} catch(e) {
    console.error(e);
}
