#!/usr/bin/env node
/** Erzeugt aus einem GCS-Projekt ein uploadfähiges ZIP-Bundle:
 *  <name>.zip enthält die Projektdatei plus alle referenzierten
 *  Medien (./images/…, ./audio/…, ./media/…, ./fonts/…) mit ihren
 *  relativen Pfaden — so, wie der CMS-Upload sie erwartet.
 *  Aufruf: node scripts/bundle-game.cjs <projekt.json> [medienwurzel]
 *  medienwurzel: Basis für ./-Pfade (Standard: public/)              */
const fs=require('node:fs'),path=require('node:path'),{zipSync}=require('fflate');
const[,,projectFile,mediaRoot='public']=process.argv;
if(!projectFile){console.error('Aufruf: node scripts/bundle-game.cjs <projekt.json> [medienwurzel]');process.exit(1);}
const project=JSON.parse(fs.readFileSync(projectFile,'utf8'));
const files={[path.basename(projectFile)]:new TextEncoder().encode(JSON.stringify(project,null,2))};
const seen=new Set();let missing=0;
const walk=o=>{if(o&&typeof o==='object')for(const v of Object.values(o)){
 if(typeof v==='string'&&/^\.\/(images|audio|media|fonts)\//i.test(v)){
  const rel=v.slice(2).replace(/\\/g,'/'),file=path.join(mediaRoot,rel);
  if(!seen.has(rel)){seen.add(rel);if(fs.existsSync(file))files[rel]=fs.readFileSync(file);else{missing++;console.warn('fehlt:',rel);}}
 }else walk(v);}};
walk(project);
const out=projectFile.replace(/\.json$/i,'.zip');
fs.writeFileSync(out,zipSync(files));
console.log(`${out}: ${Object.keys(files).length} Dateien (${(fs.statSync(out).size/1024/1024).toFixed(1)} MB)${missing?` — ${missing} Referenzen ohne Datei!`:''}`);
if(missing)process.exit(2);
