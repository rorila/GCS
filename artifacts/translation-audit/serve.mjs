import fs from 'node:fs';
import http from 'node:http';
import {build} from 'esbuild';
const project=JSON.parse(fs.readFileSync('game-server/public/projects/GCS-CMS.json','utf8'));
const pairs={'Verwaltung':'Administration','Anmelden':'Sign in','Passwort':'Password','Abbrechen':'Cancel','Anlegen':'Create','Speichern':'Save','Profil speichern':'Save profile','Zuordnung bestätigen':'Confirm assignment','📁 Bild hochladen':'📁 Upload image','✕ Entfernen':'✕ Remove','↺ Zurücksetzen':'↺ Reset','Bestätigen':'Confirm','Ablehnen':'Decline','← Zurück':'← Back','Spiel starten':'Start game','Meine Kinder':'My children','Benutzername':'Username'};
const samples=[];
for(const stage of project.stages)for(const obj of stage.objects||[])if(obj.className==='TButton'&&pairs[obj.text])samples.push({stage:stage.id,obj,english:pairs[obj.text],cell:stage.grid?.cellSize||project.stage.grid.cellSize});
const entry=`import {TextObjectRenderer as R} from './src/editor/services/renderers/TextObjectRenderer';
const samples=${JSON.stringify(samples)};
const ctx={host:{runMode:true,onEvent:()=>{}},scaleFontSize:v=>v+'px'};
const checks=[];
const label=document.createElement('div');document.body.append(label);R.renderLabel(ctx,label,{text:'Anmelden'});label.innerHTML='<font>Sign in</font>';R.renderLabel(ctx,label,{text:'Anmelden'});checks.push({test:'Label after external translation and unchanged rerender',actual:label.innerText,translationOverwritten:label.innerText==='Anmelden'});label.remove();
const button=document.createElement('div');document.body.append(button);R.renderButton(ctx,button,{text:'Anmelden'},true);button.querySelector('.btn-text').innerHTML='<font>Sign in</font>';R.renderButton(ctx,button,{text:'Anmelden'},false);checks.push({test:'Button after external translation and unchanged rerender',actual:button.innerText,translationOverwritten:button.innerText==='Anmelden'});button.remove();
let clicked=false;const click=document.createElement('div');document.body.append(click);R.renderButton({...ctx,host:{runMode:true,onEvent:()=>clicked=true}},click,{id:'login',text:'Anmelden'},true);click.querySelector('.btn-text').innerHTML='<font>Sign in</font>';click.querySelector('font').click();checks.push({test:'Click on translated nested button text',passed:clicked});click.remove();
const results=[];
for(const s of samples){const el=document.createElement('div');el.style.cssText='position:absolute;left:-10000px;display:flex;box-sizing:border-box;overflow:hidden;align-items:center;justify-content:center;padding:4px;font-family:Segoe UI,sans-serif;';el.style.width=s.obj.width*s.cell+'px';el.style.height=s.obj.height*s.cell+'px';document.body.append(el);R.renderButton(ctx,el,s.obj,true);const measure=()=>({width:el.clientWidth,height:el.clientHeight,scrollWidth:el.scrollWidth,scrollHeight:el.scrollHeight,clipped:el.scrollWidth>el.clientWidth+1||el.scrollHeight>el.clientHeight+1});const de=measure();el.querySelector('.btn-text').textContent=s.english;const en=measure();results.push({stage:s.stage,text:s.obj.text,english:s.english,de,en});el.remove();}
const result={note:'Controlled DOM-translation simulation, not Google Translate. Layout uses source dimensions, Segoe UI and 4px padding; no theme/inheritance resolution.',checks,sampleCount:results.length,newEnglishOverflows:results.filter(r=>!r.de.clipped&&r.en.clipped),existingOverflows:results.filter(r=>r.de.clipped)};
const pre=document.createElement('pre');pre.id='results';pre.textContent=JSON.stringify(result,null,2);document.body.append(pre);`;
const extraTests=`
const updated=document.createElement('div');document.body.append(updated);R.renderLabel(ctx,updated,{text:'Anmelden'});updated.innerHTML='<font>Sign in</font>';R.renderLabel(ctx,updated,{text:'Abmelden'});checks.push({test:'Changed label source still updates',passed:updated.innerText==='Abmelden'});updated.remove();
const fresh=document.createElement('div');document.body.append(fresh);R.renderLabel(ctx,fresh,{text:'Anmelden'});checks.push({test:'Fresh stage elements initialize with source',passed:fresh.innerText==='Anmelden'});fresh.remove();
`;
const bundle=await build({stdin:{contents:entry.replace('const results=[];',extraTests+'const results=[];'),resolveDir:process.cwd(),sourcefile:'audit.ts',loader:'ts'},bundle:true,write:false,format:'iife',logLevel:'silent'});
fs.writeFileSync('artifacts/translation-audit/harness.js',bundle.outputFiles[0].text);
const server=http.createServer((req,res)=>{res.setHeader('Content-Type','text/html; charset=utf-8');res.end('<!doctype html><html lang="en"><meta charset="utf-8"><title>GCS translation compatibility audit</title><h1>GCS translation compatibility audit</h1><script>'+bundle.outputFiles[0].text.replaceAll('</script','<\\/script')+'</script></html>');});
server.listen(0,'127.0.0.1',()=>console.log('AUDIT http://127.0.0.1:'+server.address().port));
