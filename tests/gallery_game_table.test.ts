import assert from 'node:assert/strict';
import {test} from 'node:test';
import fs from 'node:fs';
import {createRequire} from 'node:module';
import {TaskExecutor} from '../src/runtime/TaskExecutor';
import {ActionExecutor} from '../src/runtime/ActionExecutor';
import {PropertyHelper} from '../src/runtime/PropertyHelper';
const require=createRequire(import.meta.url);
const project=JSON.parse(fs.readFileSync(new URL('../game-server/public/projects/GCS-CMS.json',import.meta.url),'utf8'));
test('launch conflict survives forwarding; stop ends only own session and allows another launch',()=>{
 const db=require('../scripts/cms/cms-seed-testdata.cjs').buildDb(),core=require('../scripts/cms/cms-core.cjs').createCore(db),rt=require('../scripts/cms/cms-runtime.cjs').loadRuntime('game-server/public/projects/GCS-CMS.json');
 const session={personId:'child-finn',assurance:'profile'},commit=(_s:any,_a:any,_id:any,fn:any)=>fn(db),launches=new Map();
 db.playSessions=[];db.timeBudgets.find((b:any)=>b.childId==='child-finn').dailyMinutes=240;
 const game=db.games.find((g:any)=>g.status==='published'&&core.can(session,'play',{game:g,areaId:'room-sun-play'}));assert.ok(game);
 const now=new Date().toISOString();
 db.playSessions.push({id:'stuck',childId:'child-finn',gameId:game.id,areaId:'room-sun-play',status:'active',minutes:0,lastHeartbeatAt:now,startedAt:now},{id:'other-child',childId:'child-lina',gameId:game.id,areaId:'room-sun-play',status:'active',minutes:0,lastHeartbeatAt:now,startedAt:now});
 const play={api:(who:any,route:string,body:any)=>rt.run(rt.find('/api/cms/play/'+route,'POST'),{core,session:who,body,commit},{strict:true})};
 const api=(route:string,body:any={})=>rt.run(rt.find('/api/cms/'+route,'POST'),{core,session,body,commit,play,launches},{strict:true});
 const conflict=api('launch',{gameId:game.id,areaId:'room-sun-play'});assert.equal(conflict.status,409);assert.equal(conflict.data.conflict,true);
 assert.equal(api('session-stop').status,200);assert.equal(db.playSessions.find((x:any)=>x.id==='stuck').status,'ended');assert.equal(db.playSessions.find((x:any)=>x.id==='other-child').status,'active');
 const next=api('launch',{gameId:game.id,areaId:'room-sun-play'});assert.equal(next.status,200,JSON.stringify(next.data));assert.ok(next.data.launch);
});
test('conflict shows adjacent stop button; successful stop restores normal header and error permits retry',async()=>{
 for(const success of [true,false]){
 const p=structuredClone(project),s=p.stages.find((s:any)=>s.id==='stage_gallery'),blueprint=p.stages.find((s:any)=>s.type==='blueprint');
 const objects=[...s.objects,...s.variables,...blueprint.objects,...blueprint.variables],get=(n:string)=>objects.find(o=>o.name===n);
 const vars:Record<string,any>={...Object.fromEntries(objects.filter(o=>o.isVariable).map(o=>[o.name,o.value])),Antwort:{ok:false,conflict:true,message:'Es läuft bereits eine Spielsitzung — erst beenden.'},Busy:0};get('Busy').value=0;
 const actions=new ActionExecutor(objects),execute=actions.execute.bind(actions);let stops=0;
 actions.execute=async(action:any,local:any,global:any,...rest:any[])=>{if(action.type==='http'){stops++;assert.equal(action.url,'/api/cms/session-stop');const result={ok:success,message:'Testfehler'};local.StopAntwort=result;global.StopAntwort=result;return;}return execute(action,local,global,...rest);};
 const tasks=new TaskExecutor(p,s.actions,actions,undefined,undefined,s.tasks);actions.setTaskExecutor(tasks);
 await tasks.execute('Fehler',vars,vars);assert.equal(get('SitzungBeenden').visible,true);assert.equal(get('MeinKarteikasten').visible,false);assert.equal(get('SitzungBeenden').y,get('Hinweis').y);assert.ok(get('Hinweis').x+get('Hinweis').width<=get('SitzungBeenden').x);
 await tasks.execute('Sitzung_Beenden',vars,vars);assert.equal(stops,1);assert.equal(vars.Busy,0);assert.equal(get('SitzungBeenden').visible,!success);assert.equal(get('MeinKarteikasten').visible,success);assert.equal(get('SitzungBeenden').enabled,true);
 }
});
test('card fields and footer controls occupy separate readable areas',()=>{
 const s=project.stages.find((s:any)=>s.id==='stage_gallery'),table=s.objects.find((o:any)=>o.name==='SpieleTabelle'),size=s.grid.cellSize;
 assert.equal(table.displayMode,'cards');
 for(const col of table.columns){assert.ok(col.x>=0&&col.y>=0);assert.ok((col.x+col.width)*size<=table.cardConfig.width);assert.ok((col.y+col.height)*size<=table.cardConfig.height);}
 const fields=[...table.columns].sort((a:any,b:any)=>a.y-b.y);
 for(let i=1;i<fields.length;i++)assert.ok(fields[i-1].y+fields[i-1].height<=fields[i].y);
 const back=s.objects.find((o:any)=>o.name==='Zurueck'),companions=s.objects.find((o:any)=>o.name==='NavBegleiter');
 assert.ok(back.x+back.width<=companions.x);assert.ok(table.y+table.height<back.y);
 assert.ok(fields.find((c:any)=>c.field==='title').style.fontSize>=20);
});
test('room endpoint returns all authorized games for table, including multiplayer, without four-row limit',()=>{
 const db=require('../scripts/cms/cms-seed-testdata.cjs').buildDb(),core=require('../scripts/cms/cms-core.cjs').createCore(db),rt=require('../scripts/cms/cms-runtime.cjs').loadRuntime('game-server/public/projects/GCS-CMS.json');
 for(let i=0;i<11;i++){db.games.push({id:'table-'+i,title:'Game '+i,status:'published',availableHouseIds:['house-sun'],...(i===10?{multiplayer:{minPlayers:2,maxPlayers:4}}:{})});db.grants.push({gameId:'table-'+i,areaId:'house-sun',active:true},{gameId:'table-'+i,areaId:'room-sun-play',active:true});}
 const ctx={core,session:{personId:'child-finn',assurance:'profile'},body:{areaId:'room-sun-play',includeParty:true}};
 const r=rt.run(rt.find('/api/cms/games','POST'),ctx,{strict:true});assert.equal(r.status,200);
 assert.equal(r.data.items.filter((g:any)=>g.id.startsWith('table-')).length,11);
 assert.equal(r.data.items.find((g:any)=>g.id==='table-10').solo,false);
 assert.equal(r.data.items.find((g:any)=>g.id==='table-0').solo,true);
 const denied=rt.run(rt.find('/api/cms/games','POST'),{...ctx,body:{areaId:'room-moon-play',includeParty:true}},{strict:true});assert.equal(denied.status,403);
});
test('table consumes entire response, hides cards and pagination, and routes selected solo or party game',async()=>{
 const p=structuredClone(project),s=p.stages.find((s:any)=>s.id==='stage_gallery'),blueprint=p.stages.find((s:any)=>s.type==='blueprint');
 const flatten=(os:any[]):any[]=>os.flatMap(o=>[o,...flatten(o.children||[])]);
 const objects=[...flatten(s.objects),...s.variables,...blueprint.variables,...blueprint.objects,...p.stages.flatMap((stage:any)=>[...stage.variables||[],...stage.objects||[]].filter((o:any)=>o.scope==='global'))];
 const get=(name:string)=>objects.find(o=>o.name===name);
 const vars:Record<string,any>={...Object.fromEntries(objects.filter(o=>o.isVariable).map(o=>[o.name,o.value])),Busy:0,Raum:'room-sun-play',Modus:'games'};
 get('Busy').value=0;get('Modus').value='games';get('Raum').value='room-sun-play';
 vars.SpieleTabelle=get('SpieleTabelle');vars.RaumTabelle=get('RaumTabelle');
 const rows=Array.from({length:11},(_,i)=>({id:'game-'+i,title:'Game '+i,solo:i!==10}));
 vars.Antwort={ok:true,items:rows,message:'Wähle ein Spiel'};
 let stored:any[],launch:any,navigation:string|undefined;
 get('GalerieSpiele').tryReplaceRecords=(items:any[])=>{stored=items;return true;};
 const actions=new ActionExecutor(objects),execute=actions.execute.bind(actions);
 actions.execute=async(action:any,local:any,global:any,...rest:any[])=>{
  if(action.type==='http'){launch=JSON.parse(PropertyHelper.interpolate(typeof action.body==='string'?action.body:JSON.stringify(action.body),local,objects));local[action.resultVariable]={ok:false,message:'Test launch'};global[action.resultVariable]=local[action.resultVariable];return;}
  if(action.type==='navigate_stage'){navigation=action.stageId;return;}
  return execute(action,local,global,...rest);
 };
 const tasks=new TaskExecutor(p,s.actions,actions,undefined,undefined,s.tasks);actions.setTaskExecutor(tasks);
 await tasks.execute('KartenZeigen',vars,vars);
 assert.equal(stored!.length,11);assert.equal(get('SpieleTabelle').visible,true);assert.equal(get('Weiter').visible,false);assert.equal(get('Vorher').visible,false);
 for(let i=0;i<4;i++)assert.equal(get('Karte'+i).visible,false);
 Object.assign(get('SpieleTabelle'),{selectedKey:rows[8].id,selectedRecord:rows[8]});
 await tasks.execute('Tabellenspiel_Starten',vars,vars);assert.ok(launch,JSON.stringify({navigation,Busy:vars.Busy,Auswahl:vars.Auswahl,solo:get('SpieleTabelle').selectedRecord.solo}));assert.equal(launch.gameId,rows[8].id);assert.equal(launch.areaId,'room-sun-play');
 vars.Busy=0;if(get('Busy'))get('Busy').value=0;
 Object.assign(get('SpieleTabelle'),{selectedKey:rows[10].id,selectedRecord:rows[10]});
 await tasks.execute('Tabellenspiel_Starten',vars,vars);assert.equal(navigation,'stage_multiplayer_lobby');assert.equal(vars.CMSMpGameId,rows[10].id);assert.equal(vars.CMSMpRoomId,'room-sun-play');
});
