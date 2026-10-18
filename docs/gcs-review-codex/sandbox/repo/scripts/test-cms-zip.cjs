const assert=require('node:assert/strict');
const {zipSync,Zip,ZipDeflate}=require('../node_modules/fflate');
const {unpackGameBundle}=require('./cms/cms-zip.cjs');
let passed=0;
const check=(name,fn)=>{fn();passed++;console.log('OK',name)};
const zip=(files,options)=>Buffer.from(zipSync(Object.fromEntries(Object.entries(files).map(([name,data])=>[name,Buffer.isBuffer(data)?data:Buffer.from(data)])),options));
const rejects=(bytes,pattern)=>assert.throws(()=>unpackGameBundle(bytes),pattern);
check('GCS JSON + Medien',()=>{const b=unpackGameBundle(zip({'game.json':'{}','images/a.png':'image'}));assert.equal(b.kind,'json');assert.equal(b.entry.toString(),'{}');assert.equal(b.media.get('images/a.png').toString(),'image')});
check('Unkomprimierte Einträge',()=>assert.equal(unpackGameBundle(zip({'game.json':'{}'},{level:0})).entry.toString(),'{}'));
check('HTML + JS + SVG',()=>{const b=unpackGameBundle(zip({'index.html':'<html></html>','js/app.js':'1','icon.svg':'<svg/>'}));assert.equal(b.kind,'html');assert.equal(b.media.size,2)});
check('Verzeichniseinträge',()=>assert.equal(unpackGameBundle(zip({'images/':'','game.json':'{}','images/a.png':'a'})).media.size,1));
check('JS in GCS verboten',()=>rejects(zip({'game.json':'{}','app.js':'1'}),/Dateityp/));
check('Zwei Projektdateien verboten',()=>rejects(zip({'one.json':'{}','two.json':'{}'}),/Genau eine/));
check('Zwei HTML-Einstiegsdateien verboten',()=>rejects(zip({'index.html':'<html>','index.htm':'<html>'}),/Genau eine/));
check('Fehlende Einstiegsdatei',()=>rejects(zip({'a.png':'a'}),/Projektdatei/));
for(const name of ['../a.json','/a.json','C:/a.json','a/../../b.json','images/CON.png','a./b.json'])check('Unsicherer Pfad: '+name,()=>rejects(zip({[name]:'{}'}),/Pfad/));
check('Groß-/Kleinschreibung kollidiert',()=>rejects(zip({'game.json':'{}','a.png':'a','A.png':'b'}),/Doppelter/));
check('Datei und Unterverzeichnis kollidieren',()=>rejects(zip({'game.json':'{}','a.png':'a','a.png/b.png':'b'}),/Widersprüchliche/));
check('Mehr als 500 Einträge',()=>rejects(zip(Object.fromEntries([['game.json','{}'],...Array.from({length:500},(_,i)=>[i+'.png',''])])),/Zu viele/));
check('Abgeschnittenes Archiv',()=>{const b=zip({'game.json':'{}'});rejects(b.subarray(0,b.length-5),/konnte nicht gelesen/)});
check('CRC erkennt beschädigte Daten',()=>{const b=zip({'game.json':'{}'},{level:0});const start=30+b.readUInt16LE(26)+b.readUInt16LE(28);b[start]^=1;rejects(b,/konnte nicht gelesen/)});
check('Data-Descriptor-Archiv',()=>{const chunks=[],z=new Zip((err,data)=>{if(err)throw err;chunks.push(Buffer.from(data))});const f=new ZipDeflate('game.json');z.add(f);f.push(Buffer.from('{}'),true);z.end();assert.equal(unpackGameBundle(Buffer.concat(chunks)).entry.toString(),'{}')});
check('Angekündigte entpackte Größe über Limit',()=>{const b=zip({'game.json':'{}'});const central=b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));b.writeUInt32LE(51*1024*1024,22);b.writeUInt32LE(51*1024*1024,central+24);rejects(b,/zu groß/)});
check('ZIP-Bombe mit gefälschter Größenangabe',()=>{
 const b=zip({'index.html':Buffer.alloc(51*1024*1024,65)}),central=b.indexOf(Buffer.from([0x50,0x4b,0x01,0x02]));
 b.writeUInt32LE(1,22);b.writeUInt32LE(1,central+24);rejects(b,/zu groß/);
});
check('Aggregiertes Größenlimit trotz gefälschter Angaben',()=>{
 const data=Buffer.alloc(26*1024*1024,65),b=zip({'index.html':data,'a.txt':data});
 let pos=0;while(pos<b.length-46){if(b.readUInt32LE(pos)===0x02014b50){const local=b.readUInt32LE(pos+42),name=b.subarray(pos+46,pos+46+b.readUInt16LE(pos+28)).toString();if(name==='a.txt'){b.writeUInt32LE(1,pos+24);b.writeUInt32LE(1,local+22);}pos+=46+b.readUInt16LE(pos+28)+b.readUInt16LE(pos+30)+b.readUInt16LE(pos+32);}else pos++;}
 // The first file is valid; the second must hit the remaining output budget.
 rejects(b,/zu groß/);
});
check('Nicht-ZIP bleibt unbeeinflusst',()=>assert.equal(unpackGameBundle(Buffer.from('{}')),null));
console.log(JSON.stringify({passed,failed:0}));
