function isCircular(obj) {
    const seen = new WeakSet();
    function detect(val, path = 'root') {
        if (val && typeof val === 'object') {
            if (seen.has(val)) {
                console.log('Circular reference detected at:', path);
                return true;
            }
            seen.add(val);
            for (const key in val) {
                if (Object.prototype.hasOwnProperty.call(val, key)) {
                    if (detect(val[key], path + '.' + key)) return true;
                }
            }
        }
        return false;
    }
    return detect(obj);
}

const fs = require('fs');
const file = process.argv[2] || 'demos/project_GCS_Spieleplattform4.json';
try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'));
    if (isCircular(data)) {
        console.log('Project has circular references.');
    } else {
        console.log('Project is clean of circular references.');
    }
} catch (err) {
    console.error('Error reading/parsing file:', err);
}
