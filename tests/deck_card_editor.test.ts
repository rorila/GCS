import assert from 'node:assert/strict';
import { test } from 'node:test';
import fs from 'node:fs';
import { createRequire } from 'node:module';
import { TaskExecutor } from '../src/runtime/TaskExecutor';
import { ActionExecutor } from '../src/runtime/ActionExecutor';
import { PropertyHelper } from '../src/runtime/PropertyHelper';
const require=createRequire(import.meta.url);
const flatten=(objects:any[]):any[]=>objects.flatMap(o=>[o,...flatten(o.children||[])]);
const source=()=>JSON.parse(fs.readFileSync(new URL('../game-server/public/projects/GCS-CMS.json',import.meta.url),'utf8'));
function fixture({editing=false,fail=false,allowed=true,liveEvents=false}={}){
 const project=source(),stage=project.stages.find((s:any)=>s.id==='stage_deck_card_edit'),blue=project.stages.find((s:any)=>s.type==='blueprint');
 const objects=liveEvents?[...flatten(blue.objects),...blue.variables,...flatten(stage.objects),...stage.variables]:[...flatten(stage.objects),...stage.variables,...blue.variables];
 const get=(n:string)=>[...objects].reverse().find(o=>o.name===n);
 const vars:any=Object.fromEntries([...blue.variables,...stage.variables].map((v:any)=>[v.name,v.value]));
 vars.DeckKontextId='deck-demo';vars.DeckKarteKontextId=editing?'card-demo':'';
 get('DeckKontextId').value=vars.DeckKontextId;get('DeckKarteKontextId').value=vars.DeckKarteKontextId;
 const requests:any[]=[],navigation:any[]=[];
 const actions=new ActionExecutor(objects),execute=actions.execute.bind(actions);
 actions.execute=async(a,local,global,...rest)=>{
  if(a.type==='navigate_stage'){navigation.push(a);return;}
  if(a.type!=='http')return execute(a,local,global,...rest);
  const body=JSON.parse(PropertyHelper.interpolate(JSON.stringify(a.body),local,objects));requests.push({url:a.url,...body});
  let result:any;
  if(a.url.endsWith('/info'))result={ok:true,currentUserName:'Anna Müller',deck:{name:'Rechnen bis 20',subject:'Mathe',ownerName:'Stapelautor',manageable:allowed}};
  else if(a.url.endsWith('/cards'))result={ok:true,card:{id:'card-demo',question:'8 + 7',answersText:'15; fünfzehn',wrongAnswersText:'14; 16',subject:'Mathe',topic:'Addition',createdByName:'Ursprünglicher Autor',answerFormat:'self'}};
  else result=fail?{ok:false,message:'Speichern fehlgeschlagen'}:{ok:true,cardId:'new-card'};
  local[a.resultVariable]=result;if(global)global[a.resultVariable]=result;get(a.resultVariable).value=result;
 };
 const tasks=new TaskExecutor(project,stage.actions,actions,undefined,undefined,stage.tasks);actions.setTaskExecutor(tasks);
 return{vars,get,requests,navigation,run:(name:string)=>{
  const eventVars=liveEvents?Object.create(Object.fromEntries(objects.map(o=>[o.name,o]))):vars;
  return tasks.execute(name,eventVars,vars);
 }};
}
test('all authoring buttons work across separate events with global blueprint variables present',async()=>{
 const q=fixture({liveEvents:true});await q.run('Initialisieren');
 await q.run('Format_Self_Waehlen');assert.equal(q.get('Format').value,'self');
 await q.run('Format_Text_Waehlen');assert.equal(q.get('Format').value,'text');
 q.get('FrageNeu').text='8 + 7';q.get('AntwortenNeu').text='15';await Promise.all([q.run('Speichern_Weiter'),q.run('Speichern_Weiter')]);
 assert.equal(q.requests.filter(r=>r.url.endsWith('/card-save')).length,1);
 assert.equal(q.get('FrageNeu').text,'');
 q.get('FrageNeu').text='4 + 5';q.get('AntwortenNeu').text='9';await q.run('Speichern');
 assert.equal(q.navigation.at(-1).stageId,'stage_decks_edit');
 const back=fixture({liveEvents:true});await back.run('Initialisieren');await back.run('Navigation_Zurueck');assert.equal(back.navigation.length,1);
 const editing=fixture({liveEvents:true,editing:true});await editing.run('Initialisieren');await editing.run('Karte_Loeschen');
 assert.equal(editing.requests.filter(r=>r.url.endsWith('/card-delete')).length,1);assert.equal(editing.navigation.length,1);
});
test('new paper-card editor inherits deck metadata, saves once and retains context for next card',async()=>{
 const q=fixture();await q.run('Initialisieren');
 for(const side of ['Frage','Antwort']){assert.equal(q.get('Stapelname'+side).caption,'Rechnen bis 20');assert.equal(q.get('Stapelart'+side).caption,'Mathe');assert.equal(q.get('Stapelersteller'+side).caption,'Stapelautor');}
 q.get('FrageNeu').text='8 + 7';q.get('AntwortenNeu').text='15';q.get('FalscheAntwortenNeu').text='14; 16';
 await Promise.all([q.run('Speichern_Weiter'),q.run('Speichern_Weiter')]);
 const saves=q.requests.filter(r=>r.url.endsWith('/card-save'));assert.equal(saves.length,1);
 assert.equal(saves[0].deckId,'deck-demo');assert.equal(saves[0].question,'8 + 7');assert.equal(saves[0].wrongAnswers,'14; 16');
 assert.equal(q.get('FrageNeu').text,'');assert.equal(q.get('AntwortenNeu').text,'');
 assert.equal(q.vars.KartenEditorFach,'Mathe');assert.equal(q.vars.KartenEditorThema,'Rechnen bis 20');assert.equal(q.navigation.length,0);
 q.get('FrageNeu').text='6 + 6';q.get('AntwortenNeu').text='12';await q.run('Speichern');
 assert.equal(q.navigation[0].stageId,'stage_decks_edit');assert.equal(q.navigation[0].reset,true);
});
test('editing preserves deck author, answer variants, format and card identity',async()=>{
 const q=fixture({editing:true});await q.run('Initialisieren');
 assert.equal(q.get('AntwortenNeu').text,'15; fünfzehn');assert.equal(q.get('FalscheAntwortenNeu').text,'14; 16');
 assert.equal(q.vars.Format,'self');assert.equal(q.get('StapelerstellerAntwort').caption,'Stapelautor');
 await q.run('Speichern');assert.equal(q.requests.find(r=>r.url.endsWith('/card-save')).cardId,'card-demo');
});
test('save failure preserves draft; permission denial prevents save',async()=>{
 const q=fixture({fail:true});await q.run('Initialisieren');q.get('FrageNeu').text='Entwurf';q.get('AntwortenNeu').text='Antwort';
 await q.run('Speichern_Weiter');assert.equal(q.get('FrageNeu').text,'Entwurf');assert.equal(q.navigation.length,0);assert.equal(q.vars.KartenEditorBusy,0);
 const denied=fixture({allowed:false});await denied.run('Initialisieren');await denied.run('Speichern');
 assert.equal(denied.requests.filter(r=>r.url.endsWith('/card-save')).length,0);
 assert.equal(denied.get('Zurueck').enabled,true);await denied.run('Navigation_Zurueck');assert.equal(denied.navigation.length,1);
});
test('configuration is idempotent, custom paper design survives theme and references remain valid',()=>{
 const p=source(),configure=require('../scripts/cms/cms-deck-card-editor.cjs').configureDeckCardEditor;
 configure(p);const once=JSON.stringify(p);configure(p);assert.equal(JSON.stringify(p),once);
 const s=p.stages.find((s:any)=>s.id==='stage_deck_card_edit'),before=JSON.stringify(s);
 const blueprintNames=new Set([...p.stages.find((s:any)=>s.type==='blueprint').objects,...p.stages.find((s:any)=>s.type==='blueprint').variables].map((o:any)=>o.name));
 assert.deepEqual(s.variables.filter((v:any)=>blueprintNames.has(v.name)).map((v:any)=>v.name),[],'editor-local variables must not shadow blueprint variables');
 require('../scripts/cms/cms-style.cjs').applyCmsTheme({stages:[s]});assert.equal(JSON.stringify(s),before);
 assert.deepEqual(require('../scripts/cms/cms-project.cjs').checkIntegrity(p).filter((i:any)=>['stage_deck_card_edit','stage_decks_edit','stage_server_decks'].includes(i.stage)),[]);
 for(const o of s.objects.filter((o:any)=>!o.isHiddenInRun)){assert.ok(o.x+o.width<=64,o.name);assert.ok(o.y+o.height<=43,o.name);}
 const overview=p.stages.find((s:any)=>s.id==='stage_decks_edit');assert.equal(overview.objects.some((o:any)=>o.name==='FrageNeu'),false);
});
test('repair preserves all card positions and sizes while restoring paper and unique metadata names',()=>{
 const p=source(),s=p.stages.find((s:any)=>s.id==='stage_deck_card_edit');
 const geometry=()=>flatten(s.objects).map(o=>({id:o.id,x:o.x,y:o.y,width:o.width,height:o.height,children:(o.children||[]).map((c:any)=>c.id)}));
 const before=geometry();
 for(const o of s.objects.filter((o:any)=>['FragePapier','AntwortPapier'].includes(o.name)))delete o.backgroundImage;
 require('../scripts/cms/cms-repair-card-layout.cjs').repairDeckCardLayout(p);
 assert.deepEqual(geometry(),before);
 const objects=flatten(s.objects),names=objects.map(o=>o.name);
 assert.equal(new Set(names).size,names.length);
 for(const card of s.objects.filter((o:any)=>['FragePapier','AntwortPapier'].includes(o.name)))assert.ok(card.backgroundImage.startsWith('data:image/svg+xml;base64,'));
 const save=s.actions.find((a:any)=>a.name==='Act_Speichern_Server');assert.equal(save.body.subject,'${KartenEditorFach}');
});
