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

console.log(JSON.stringify(target, null, 2));
