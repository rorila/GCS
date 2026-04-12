import fs from 'fs';

const data = JSON.parse(fs.readFileSync('./game-server/public/projects/GCS_Doku.json', 'utf8'));

let target = null;
if (data.variables) {
    const v = data.variables.find((v: any) => v.name === 'StringMap_4');
    if (v) target = v;
}
if (!target && data.stages) {
    for (const s of data.stages) {
        if (s.variables) {
            const v = s.variables.find((v: any) => v.name === 'StringMap_4');
            if (v) target = v;
        }
        if (s.objects) {
            const o = s.objects.find((o: any) => o.name === 'StringMap_4');
            if (o && !target) target = o;
        }
    }
}

let initialValue = target.defaultValue !== undefined ? target.defaultValue : target.value;
console.log("1. initialValue is:", initialValue);

if (initialValue === undefined) {
    if (target.entries !== undefined) initialValue = target.entries;
    else if (target.items !== undefined) initialValue = target.items;
    else if (target.data !== undefined) initialValue = target.data;
}

console.log("2. initialValue is:", initialValue);

const result = initialValue !== undefined ? initialValue : 0;

console.log("3. result is:", result);
