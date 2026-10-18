const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const root=path.join(__dirname,'../../game-server/public/projects'),uid=()=>crypto.randomUUID();
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(v,then,else_=[])=>({type:'condition',name:'Erfolgreich?',condition:{variable:v,operator:'==',value:true},then,else:else_});
const action=(name,type,extra)=>({id:uid(),name,type,scope:'stage',...extra});
const task=(name,seq)=>({id:uid(),name,scope:'stage',triggerMode:'local-sync',params:[],description:name,actionSequence:seq});
function merge(s,key,items){s[key]??=[];for(const o of items){const old=s[key].find(x=>x.name===o.name);if(old)Object.assign(old,o,{id:old.id});else s[key].push(o);}}
function apply(p){
 const emptyReply=p.stages.find(s=>s.id==='stage_server_play')?.actions.find(a=>a.name==='KarteZiehen_AntwortLeer');
 if(emptyReply) emptyReply.params=[{merge:'${Karte}'}];
 const route=(sid,url,prefix,target,method)=>{
  const s=p.stages.find(s=>s.id===sid);
  merge(s,'objects',[{id:uid(),name:prefix+'Endpoint',className:'TServerEndpoint',scope:'stage',executionSide:'server',isService:true,isHiddenInRun:true,endpointPath:url,httpMethod:'POST',traceEnabled:true,events:{onRequest:prefix+'Task'},x:32,y:30,width:12,height:3}]);
  merge(s,'actions',[action(prefix+'Call','call_method',{target,method,params:method==='propose'?['$body']:[],resultVariable:'Ergebnis'}),action(prefix+'Send','call_method',{target:'AntwortSenden',method:'send',params:[{merge:'${Ergebnis}'}]}),action(prefix+'Fail','call_method',{target:'AntwortSenden',method:'fail',params:['${Ergebnis.status}','${Ergebnis.message}']})]);
  merge(s,'variables',[{id:uid(),name:'Ergebnis',className:'TObjectVariable',scope:'stage',isVariable:true,type:'object',defaultValue:null,value:null,x:0,y:0,width:6,height:2}]);
  merge(s,'tasks',[task(prefix+'Task',[A(prefix+'Call'),C('Ergebnis.ok',[A(prefix+'Send')],[A(prefix+'Fail')])])]);
 };
 const cards=p.stages.find(s=>s.id==='stage_server_cards'),cardName=cards.objects.find(o=>o.className==='TServerCards').name;
 route('stage_server_cards','/api/cms/cards/points','CardPoints',cardName,'pointSummary');
 // Eltern-Adapter löst das Kind aus childId auf; Fachmethode prüft erneut.
 const par=p.stages.find(s=>s.id==='stage_server_parent');let parCards=par.objects.find(o=>o.className==='TServerCards');
 if(!parCards){parCards={...structuredClone(cards.objects.find(o=>o.className==='TServerCards')),id:uid(),name:'LernkartenPunkte'};par.objects.push(parCards);}
 route('stage_server_parent','/api/cms/parent/child-card-points','ParentCardPoints',parCards.name,'pointSummary');
 route('stage_server_parent','/api/cms/parent/child-card-point-mode','ParentCardMode',parCards.name,'setPointMode');
 const sp=p.stages.find(s=>s.id==='stage_server_sponsor');route(sp.id,'/api/cms/sponsorship/card-agreement-propose','CardReward',sp.objects.find(o=>o.className==='TServerSponsorAgreement').name,'propose');
 const obj=(className,name,text,x,y,width,height,extra={})=>({id:uid(),className,name,text,x,y,width,height,scope:'stage',visible:true,align:'NONE',style:{color:'#e8f2f5',fontSize:18,fontFamily:'Segoe UI, sans-serif',backgroundColor:className==='TButton'?'#285464':'transparent',borderRadius:8},...extra});
 const label=(n,t,x,y,w,h=3)=>obj('TLabel',n,t,x,y,w,h);
 const btn=(n,t,x,y,w)=>obj('TButton',n,t,x,y,w,3,{events:{onClick:n}});
 const shell=(id,name)=>({id,name,type:'standard',generatedBy:'cms-add-card-points.cjs',grid:{cols:64,rows:48,cellSize:18,visible:false,backgroundColor:'#122b39'},objects:[],variables:[{id:uid(),name:'Antwort',className:'TObjectVariable',scope:'stage',isVariable:true,type:'object',defaultValue:null,value:null}],actions:[],tasks:[],features:[],events:{},flowCharts:[]});
 const http=(n,url,body)=>action(n,'http',{url,method:'POST',body,resultVariable:'Antwort'});
 const prop=(n,changes)=>action(n,'property',{changes});
 const save=s=>{const old=p.stages.find(x=>x.id===s.id);if(old){for(const k of ['objects','variables','actions','tasks']){const ids=new Map(old[k].map(x=>[x.name,x.id]));for(const x of s[k])x.id=ids.get(x.name)||x.id;}Object.assign(old,s);}else p.stages.push(s);};
 const link=(sid,target,name,y=34)=>{const s=p.stages.find(s=>s.id===sid);if(!s)return;merge(s,'objects',[{...btn(name,'Lernpunkte',2,y,16),height:2}]);merge(s,'actions',[action(name+'Nav','navigate_stage',{stageId:target,reset:false})]);merge(s,'tasks',[task(name,[A(name+'Nav')])]);};
 for(const parent of [false,true]){
  const id=parent?'stage_parent_card_points':'stage_card_points',s=shell(id,parent?'Eltern · Lernpunkte':'Meine Lernpunkte');
  s.objects.push(label('Titel',parent?'KARTEIKASTEN · LERNPUNKTE':'MEINE LERNPUNKTE',3,4,58,2),label('Status','Wird geladen …',3,8,58,3),label('Hinweis','Ein Aufstieg bringt +1. Fach 6 bedeutet abgeschlossen. Bei einem Rückfall nach Fach 1 entscheidet die Elternregel über den Abzug. Wiederholte Fehler in Fach 1 kosten nichts.',3,11,58,5),btn('Zurueck','Zum Karteikasten',3,41,24));
  s.objects.push(obj('TObjectList','PunkteListe','',0,0,1,1,{isService:true,isHiddenInRun:true,visible:false,sourceMode:'records',recordKey:'eventId',records:[]}),obj('TTable','PunkteTabelle','',3,18,58,17,{dataSource:'PunkteListe',keyField:'eventId',columns:[{field:'at',label:'Zeit',type:'text'},{field:'subject',label:'Schulfach',type:'text'},{field:'fromBox',label:'Von',type:'number'},{field:'toBox',label:'Nach',type:'number'},{field:'points',label:'Punkte',type:'number'},{field:'verification',label:'Nachweis',type:'text'}]}));
  s.objects.push(obj('TTimer','InitTimer','',0,0,1,1,{isService:true,isHiddenInRun:true,visible:false,interval:350,enabled:true,maxInterval:1,currentInterval:0,events:{onTimer:'Laden'}}));
  s.actions.push(http('LadenServer',parent?'/api/cms/parent/child-card-points':'/api/cms/cards/points',parent?{childId:'${CMSKindId}'}:{token:'${Token}'}),prop('Meldung',{'Status.text':'${Antwort.message}'}),action('Liste','call_method',{target:'PunkteListe',method:'tryReplaceRecords',params:['${Antwort.items}']}),action('ZurueckNav','navigate_stage',{stageId:parent?'stage_child_cards':'stage_cards',reset:false}));
  s.tasks.push(task('Laden',[A('LadenServer'),A('Meldung'),C('Antwort.ok',[A('Liste')])]),task('Zurueck',[A('ZurueckNav')]));
  if(parent){s.objects.push(btn('Fortschritt','+1 · ohne Abzug',3,36.5,26),btn('Konsequent','+1 · mit −1 Rückfall',32,36.5,29));for(const [n,mode]of [['Fortschritt','progress'],['Konsequent','strict']]){s.actions.push(http(n+'Server','/api/cms/parent/child-card-point-mode',{childId:'${CMSKindId}',mode}));s.tasks.push(task(n,[A(n+'Server'),A('Meldung'),C('Antwort.ok',[T('Laden')])]));}}
  save(s);link(parent?'stage_child_cards':'stage_cards',id,parent?'ElternLernpunkte':'MeineLernpunkte');
 }
 const reward=shell('stage_card_reward_agreement','Karteikasten · Sponsorvereinbarung');
 reward.objects.push(label('Titel','KARTEIKASTEN · BELOHNUNG VEREINBAREN',3,4,58,2),label('Status','Zuerst eine Begleitung in deren Übersicht auswählen.',3,8,58),label('Hinweis','Der Sponsor legt das Ziel fest; die Eltern stimmen zu. Gesamtpunkte bleiben erhalten. Nach bestätigter Übergabe beginnt die nächste Runde mit dem Überschuss. Zieländerungen gelten nach einer ausstehenden Belohnung für die nächste Runde.',3,10,58,6),obj('TEdit','Ziel','',3,18,20,3,{placeholder:'Punkteziel'}),obj('TEdit','Belohnung','',25,18,36,3,{placeholder:'Vereinbarte Belohnung'}),btn('FortschrittVertrag','Belohnungsziel vorschlagen',3,24,58),btn('Zurueck','Begleitungen / Freigaben',3,40,32),label('Vertrauenshinweis','Selbstbewertungen zählen für Sponsorbelohnungen erst nach elterlicher Anerkennung. Bereits erreichte Ansprüche bleiben bei späteren Rückfällen erhalten.',3,34,58,5));
 for(const[n,mode]of [['FortschrittVertrag','progress']]){reward.actions.push(http(n+'Server','/api/cms/sponsorship/card-agreement-propose',{token:'${Token}',sponsorshipId:'${CMSBegleitungId}',rewardMode:'cardRounds',metricKeysCsv:'cards.promotions,cards.resets',pointsTarget:'${Ziel.text}',rewardText:'${Belohnung.text}'}));reward.tasks.push(task(n,[A(n+'Server'),A('Meldung')]));}
 reward.actions.push(prop('Meldung',{'Status.text':'${Antwort.message}'}),action('ZurueckNav','navigate_stage',{stageId:'stage_sponsor_detail',reset:false}));reward.tasks.push(task('Zurueck',[A('ZurueckNav')]));
 // Zurück führt in den passenden Erwachsenen-Kontext, anhand der bereits vorhandenen Kontext-Flags.
 reward.variables.push({id:uid(),name:'KontextAntwort',className:'TObjectVariable',scope:'stage',isVariable:true,type:'object',defaultValue:null,value:null});
 reward.actions.push(http('KontextServer','/api/cms/contexts',{}),action('ElternZurueck','navigate_stage',{stageId:'stage_parent_sponsor_detail',reset:false}));
 reward.tasks.find(t=>t.name==='Zurueck').actionSequence=[A('KontextServer'),C('Antwort.parent',[A('ElternZurueck')],[A('ZurueckNav')])];save(reward);
 for(const sid of ['stage_sponsor_detail','stage_parent_sponsor_detail']){const s=p.stages.find(s=>s.id===sid);merge(s,'objects',[btn('KartenBelohnung','Kartenbelohnung',1,sid==='stage_sponsor_detail'?13:26,12)]);merge(s,'actions',[action('KartenBelohnungNav','navigate_stage',{stageId:reward.id,reset:false})]);merge(s,'tasks',[task('KartenBelohnung',[A('KartenBelohnungNav')])]);}
 return p;
}
if(require.main===module){const file=path.join(root,'GCS-CMS.json'),p=JSON.parse(fs.readFileSync(file));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,1));const qfile=path.join(root,'Karteikasten-Quiz.json'),q=JSON.parse(fs.readFileSync(qfile));require('./cms-quiz-points.cjs').configureQuizPoints(q);fs.writeFileSync(qfile,JSON.stringify(q,null,2)+'\n');console.log('CMS-Lernpunkte, Kartenbelohnungen und Quiz ergänzt.');}
module.exports={apply};
