// Testet die Muster-Erkennung + Manifest-Aufloesung des CMS-Bundle-Exports
// anhand von Madn-Remote.json (ohne Editor/Browser).
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..');
const p=JSON.parse(fs.readFileSync(path.join(root,'game-server/public/projects/Madn-Remote.json'),'utf8'));

const mediaExtensions=/\.(png|jpg|jpeg|gif|svg|webp|bmp|ico|mp3|ogg|wav|m4a|mp4|webm|woff|woff2|ttf|otf)$/i;
const isMediaPath=s=>{if(!s||typeof s!=='string'||!s.length)return false;if(s.startsWith('data:')||s.startsWith('http://')||s.startsWith('https://'))return false;return (/(^|\/)(images|audio|video|assets|media|fonts)\//i).test(s)||mediaExtensions.test(s);};
const varMap=new Map();
const collectVars=o=>{if(Array.isArray(o)){o.forEach(collectVars);return;}if(!o||typeof o!=='object')return;
 if((o.className==='TVariable'||o.className==='Variable')&&typeof o.name==='string')varMap.set(o.name,o.value);
 if((o.className==='TListVariable'||o.className==='ListVariable')&&typeof o.name==='string'&&Array.isArray(o.items))varMap.set(o.name,o.items);
 Object.values(o).forEach(collectVars);};
collectVars(p);
const resolveBinding=(s,depth=3)=>{if(typeof s!=='string')return undefined;const m=s.match(/^\s*\$\{([^}]+)\}\s*$/);if(!m||depth<=0)return undefined;const expr=m[1].trim();
 const idx=expr.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*\[\s*(\d+)\s*\]$/);
 if(idx){const list=varMap.get(idx[1]);if(Array.isArray(list)){const r=list[parseInt(idx[2],10)];if(typeof r==='string'&&r)return resolveBinding(r,depth-1)??r;return typeof r==='string'?r:undefined;}return undefined;}
 const val=varMap.get(expr);if(typeof val==='string'&&val)return resolveBinding(val,depth-1)??val;if(typeof val==='string')return val;return val!==undefined&&val!==null?String(val):undefined;};

const patterns=[],refs=new Set();
const tryCollect=s=>{
 if(/\$\{[^}]+\}/.test(s)){const r=resolveBinding(s);if(typeof r==='string'&&isMediaPath(r))refs.add(r);else if(isMediaPath(s)&&!patterns.includes(s))patterns.push(s);}
 else if(isMediaPath(s))refs.add(s);
 else{const r=resolveBinding(s);if(typeof r==='string'&&isMediaPath(r))refs.add(r);}};
const walk=o=>{if(Array.isArray(o)){o.forEach(v=>typeof v==='string'?tryCollect(v):v&&typeof v==='object'&&walk(v));return;}if(!o||typeof o!=='object')return;Object.values(o).forEach(v=>{if(typeof v==='string')tryCollect(v);else if(v&&typeof v==='object')walk(v);});};
walk(p);
console.log('statische refs:',[...refs].sort().join(', '));
console.log('muster:',patterns.join(', ')||'keine');

const toRe=pattern=>{const esc=pattern.split(/\$\{[^}]+\}/).map(part=>part.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('[^/]+?');return new RegExp('^'+esc+'$');};
const m=JSON.parse(fs.readFileSync(path.join(root,'public/media-manifest.json'),'utf8'));
const files=[];
for(const[sec,folders]of Object.entries(m))for(const[fold,names]of Object.entries(folders))for(const n of names)files.push(sec+'/'+(fold?fold+'/':'')+n);
let fail=0;
for(const pat of patterns){
 const rel=pat.replace(/^\.?\//,'');
 const hits=files.filter(f=>toRe(rel).test(f));
 console.log(pat,'→',hits.join(', ')||'!! KEINE TREFFER');
 if(!hits.length)fail++;
 // Erwartung: jede w*.svg 1..6 muss dabei sein
 for(let i=1;i<=6;i++)if(!hits.includes('images/madn/w'+i+'.svg')){console.log('   !! fehlt w'+i+'.svg');fail++;}
}
// Sonderfälle der Regex
const cases=[
 ['images/madn/w${Var_Wurf}.svg',['images/madn/w1.svg','images/madn/w2.svg'],'darf nicht w10x unterordner treffen'],
 ['images/x/a${A}b${B}.png',['images/x/a1b2.png'],'zwei stellen'],
];
for(const[pat,expect]of cases){const re=toRe(pat);for(const e of expect)if(!re.test(e)){console.log('!! regex fail',pat,e);fail++;}}
if(toRe('images/madn/w${V}.svg').test('images/madn/sub/w1.svg')){console.log('!! regex trifft Unterordner');fail++;}
console.log(fail?('FEHLGESCHLAGEN ('+fail+')'):'ALLE CHECKS OK');
process.exit(fail?1:0);
