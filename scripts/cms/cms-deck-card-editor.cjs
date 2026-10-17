// Move deck-card authoring out of the deck overview into a pair of paper cards.
const fs=require('node:fs'),path=require('node:path');
function configureDeckCardEditor(project){
 const old=project.stages.find(s=>s.id==='stage_decks_edit');if(!old)throw Error('Stapelbearbeitung fehlt.');
 const blueprint=project.stages.find(s=>s.type==='blueprint');if(!blueprint)throw Error('Blueprint fehlt.');
 const up=(list,name,data)=>{const found=list.find(o=>o.name===name);if(found)Object.assign(found,data);else list.push({id:'deck_card_'+(data.actionSequence?'task_':data.type?'action_':'var_')+name,name,scope:'stage',...data});};
 blueprint.variables||=[];up(blueprint.variables,'DeckKarteKontextId',{className:'TStringVariable',isVariable:true,isHiddenInRun:true,type:'string',value:'',defaultValue:''});
 const removed=new Set(['KarteTitel','FrageNeu','AntwortenNeu','FachKarte','ThemaKarte','FormatText','FormatSelf','KarteSpeichern','KarteLoeschen']);
 old.objects=old.objects.filter(o=>!removed.has(o.name)&&!o.cmsChrome);
 const newButton=old.objects.find(o=>o.name==='KarteNeu');Object.assign(newButton,{text:'＋ Neue Karte',x:44,y:16,width:16,height:2.5});
 Object.assign(old.objects.find(o=>o.name==='KartenTitel'),{x:4,y:16,width:30});
 Object.assign(old.objects.find(o=>o.name==='StapelKartenTabelle'),{x:4,y:20,width:56,height:17});
 const removeTasks=new Set(['Karte_Speichern','Karte_Loeschen','Format_Text_Waehlen','Format_Self_Waehlen','Sperre_KarteSpeichern','Sperre_KarteLoeschen']);
 old.tasks=old.tasks.filter(t=>!removeTasks.has(t.name));
 const ref=name=>({type:'action',name}),run=name=>({type:'task',name});
 const cond=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value,...(typeof value==='string'&&value.startsWith('${')?{rightType:'variable'}:{})},body,elseBody});
 const oldAct=(name,type,data)=>{up(old.actions,name,{type,...data});return ref(name);};
 up(old.tasks,'Karte_Neu',{triggerMode:'local-sync',params:[],actionSequence:[cond('Busy',0,[cond('Manageable',true,[oldAct('Act_Karteneditor_Neu','property',{changes:{DeckKarteKontextId:''}}),oldAct('Act_Nav_Karteneditor','navigate_stage',{stageId:'stage_deck_card_edit',reset:true})])])]});
 up(old.tasks,'Karte_Auswaehlen',{triggerMode:'local-sync',params:[],actionSequence:[cond('Busy',0,[cond('Manageable',true,[oldAct('Act_Karteneditor_Auswahl','property',{changes:{DeckKarteKontextId:'${StapelKartenTabelle.selectedKey}'}}),ref('Act_Nav_Karteneditor')])])]});
 for(const a of old.actions)if(a.type==='property')for(const key of Object.keys(a.changes||{}))if(removed.has(key.split('.')[0]))delete a.changes[key];
 const used=new Set();const walk=seq=>{for(const step of seq||[]){if(step.type==='action')used.add(step.name);for(const branch of ['then','else','body','elseBody'])walk(step[branch]);}};old.tasks.forEach(t=>walk(t.actionSequence));old.actions=old.actions.filter(a=>used.has(a.name));
 const s={id:'stage_deck_card_edit',name:'Stapel · Karte gestalten',type:'standard',group:old.group,overviewTags:structuredClone(old.overviewTags||{}),cmsTheme:'custom',grid:{cols:64,rows:43,cellSize:18,visible:false,snapToGrid:true,backgroundColor:'#0c1b26'},objects:[],variables:[],tasks:[],actions:[],flowCharts:{},events:{},startAnimation:'none'};
 const object=(className,name,x,y,width,height,extra={})=>({className,id:'deck_card_'+name,name,scope:'stage',draggable:false,droppable:false,visible:true,x,y,width,height,zIndex:1,rotation:0,align:'NONE',collisionEnabled:false,...extra});
 const label=(name,text,x,y,w,h,size=18,color='#d6e6f0')=>object('TLabel',name,x,y,w,h,{text,style:{color,fontSize:size,fontFamily:'Segoe UI, sans-serif',textAlign:'left',backgroundColor:'transparent',borderWidth:0}});
 const edit=(className,name,x,y,w,h,placeholder,size=24)=>object(className,name,x,y,w,h,{text:'',placeholder,style:{color:'#193b5c',fontSize:size,fontFamily:'Segoe UI, sans-serif',textAlign:'left',backgroundColor:'rgba(255,254,250,0.68)',borderColor:'#9ebbd1',borderWidth:1,borderRadius:5}});
 const button=(name,text,x,y,w,event,primary=false)=>object('TButton',name,x,y,w,2.8,{text,enabled:false,events:{onClick:event},style:{fontSize:17,fontFamily:'Segoe UI, sans-serif',fontWeight:'bold',color:primary?'#07342c':'#dceaf4',backgroundColor:primary?'#67ddbf':'#193445',borderColor:primary?'#8aebd3':'#45677e',borderWidth:1,borderRadius:8}});
 const paper='data:image/svg+xml;base64,'+fs.readFileSync(path.join(__dirname,'../../public/images/karteikarte-kariert.svg')).toString('base64');
 s.objects.push(label('Titel','NEUE KARTE',3,2,50,2.5,28),label('Untertitel','Eine Lernkarte · zwei Seiten',3,4.6,50,1.5,15,'#8faebf'),
  label('StapelInfo','Stapel wird geladen …',5,12,24,1.6,14,'#ffffff'),label('ErstellerInfo','',35,12,24,1.6,13,'#ffffff'),label('FachInfo','Fach:',5,26.3,4,1.4,13,'#ffffff'),label('FachKarte','',9,26.3,20,1.4,14,'#ffffff'),label('ThemaInfo','Thema:',35,26.3,5,1.4,13,'#ffffff'),label('ThemaKarte','',40,26.3,19,1.4,14,'#ffffff'));
 for(const [name,x]of[['FragePapier',3],['AntwortPapier',33]])s.objects.push(object('TPanel',name,x,9,28,19.5,{caption:'',zIndex:0,backgroundImage:paper,objectFit:'100% 100%',style:{backgroundColor:'#fffefa',borderWidth:0,borderRadius:8,boxShadow:'0 12px 30px rgba(0,0,0,.28)'}}));
 for(const [suffix,x]of[['Frage',4],['Antwort',34]]){
  s.objects.push(object('TPanel','Kopfband'+suffix,x,9.8,26,4.2,{caption:'',zIndex:1,style:{backgroundColor:'#285984',borderWidth:0,borderRadius:4}}));
  s.objects.push(object('TPanel','Fussband'+suffix,x,26,26,2,{caption:'',zIndex:1,style:{backgroundColor:'#285984',borderWidth:0,borderRadius:4}}));
 }
 for(const name of ['StapelInfo','ErstellerInfo','FachInfo','FachKarte','ThemaInfo','ThemaKarte'])s.objects.find(o=>o.name===name).zIndex=2;
 s.objects.push(label('FrageTitel','FRAGE',5,10.1,24,1.6,17,'#ffffff'),label('AntwortTitel','ANTWORT',35,10.1,24,1.6,17,'#ffffff'),
  edit('TMemo','FrageNeu',5,15,24,10,'Aufgabe oder Frage eingeben',30),edit('TMemo','AntwortenNeu',35,15,24,4.5,'Richtige Antwort eingeben',30),
  label('FalscheHinweis','Falsche Antworten · optional',35,20.3,24,1.4,13,'#365a77'),edit('TEdit','FalscheAntwortenNeu',35,22,24,2,'Zum Beispiel 54; 60',17),
  label('AntwortHinweis','Mehrere richtige Antworten mit ; trennen.',35,24.4,24,1.1,11,'#476980'),
  button('Zurueck','← Zurück',3,34,11,'Navigation_Zurueck'),button('FormatText','⌨ Eingabe ✓',3,30,13,'Format_Text_Waehlen'),button('FormatSelf','🙋 Selbst',17,30,13,'Format_Self_Waehlen'),
  button('Speichern','Speichern',30,34,12,'Speichern',true),button('SpeichernWeiter','Speichern & nächste Karte',43,34,18,'Speichern_Weiter',true),
  button('KarteLoeschen','Karte löschen',46,30,15,'Karte_Loeschen'),label('Status','',3,38,58,1.6,15));
 for(const name of ['FrageTitel','AntwortTitel'])s.objects.find(o=>o.name===name).zIndex=2;
 s.objects.find(o=>o.name==='Zurueck').enabled=true;s.objects.find(o=>o.name==='KarteLoeschen').visible=false;
 s.objects.push(object('TTimer','KarteneditorInit',0,0,1,1,{isService:true,isHiddenInRun:true,interval:200,enabled:true,maxInterval:1,currentInterval:0,events:{onTimer:'Initialisieren'}}));
 for(const [name,value,className]of[['KartenEditorBusy',1,'TIntegerVariable'],['Manageable',false,'TBooleanVariable'],['Format','text','TStringVariable'],['Weiter',false,'TBooleanVariable'],['InfoAntwort',null,'TObjectVariable'],['KartenAntwort',null,'TObjectVariable'],['SpeicherAntwort',null,'TObjectVariable'],['LoeschAntwort',null,'TObjectVariable']])s.variables.push({id:'deck_card_var_'+name,name,className,scope:'stage',isVariable:true,isHiddenInRun:true,value,defaultValue:value,type:className.replace(/^T|Variable$/g,'').toLowerCase()});
 const act=(name,type,data)=>{up(s.actions,name,{type,...data});return ref(name);};
 const prop=(name,changes)=>act(name,'property',{changes});
 const http=(name,url,body,resultVariable)=>act(name,'http',{url,method:'POST',body,resultVariable});
 const task=(name,actionSequence)=>up(s.tasks,name,{actionSequence,triggerMode:'local-sync',params:[]});
 const enabled=value=>Object.fromEntries(['Zurueck','Speichern','SpeichernWeiter','FormatText','FormatSelf','KarteLoeschen'].map(n=>[n+'.enabled',value]));
 const back=act('Act_Zurueck','navigate_stage',{stageId:'stage_decks_edit',reset:true});
 task('Initialisieren',[prop('Act_Laden',{KartenEditorBusy:1,...enabled(false),'Status.text':'Stapel wird geladen …'}),http('Act_Info_Server','/api/cms/decks/info',{token:'${Token}',deckId:'${DeckKontextId}'},'InfoAntwort'),cond('InfoAntwort.ok',true,[cond('InfoAntwort.deck.manageable',true,[
  prop('Act_Stapel_Uebernehmen',{Manageable:true,'StapelInfo.text':'Stapel: ${InfoAntwort.deck.name}','FachKarte.text':'${InfoAntwort.deck.subject}','ThemaKarte.text':'${InfoAntwort.deck.name}','ErstellerInfo.text':'Erstellt von: ${InfoAntwort.currentUserName}'}),
  cond('DeckKarteKontextId','',[run('Neue_Karte_Bereit')],[run('Karte_Laden')])
 ],[prop('Act_Keine_Rechte',{KartenEditorBusy:0,Manageable:false,'Zurueck.enabled':true,'Status.text':'Dieser Stapel kann nicht bearbeitet werden.'})])],[prop('Act_Ladefehler',{KartenEditorBusy:0,'Zurueck.enabled':true,'Status.text':'${InfoAntwort.message}'})])]);
 task('Neue_Karte_Bereit',[prop('Act_Neu',{KartenEditorBusy:0,DeckKarteKontextId:'',Format:'text',...enabled(true),'Titel.text':'NEUE KARTE','FrageNeu.text':'','AntwortenNeu.text':'','FalscheAntwortenNeu.text':'','KarteLoeschen.visible':false,'ErstellerInfo.text':'Erstellt von: ${InfoAntwort.currentUserName}','FormatText.text':'⌨ Eingabe ✓','FormatSelf.text':'🙋 Selbst','Status.text':'Frage und Antwort eingeben.'})]);
 task('Karte_Laden',[http('Act_Karten_Server','/api/cms/decks/cards',{token:'${Token}',deckId:'${DeckKontextId}',cardId:'${DeckKarteKontextId}'},'KartenAntwort'),cond('KartenAntwort.ok',true,[
  cond('KartenAntwort.card.id','${DeckKarteKontextId}',[prop('Act_Karte_Uebernehmen',{KartenEditorBusy:0,...enabled(true),'Titel.text':'KARTE BEARBEITEN','FrageNeu.text':'${KartenAntwort.card.question}','AntwortenNeu.text':'${KartenAntwort.card.answersText}','FalscheAntwortenNeu.text':'${KartenAntwort.card.wrongAnswersText}','FachKarte.text':'${KartenAntwort.card.subject}','ThemaKarte.text':'${KartenAntwort.card.topic}',Format:'${KartenAntwort.card.answerFormat}','ErstellerInfo.text':'Erstellt von: ${KartenAntwort.card.createdByName}','KarteLoeschen.visible':true,'Status.text':'Frage oder Antwort ändern und speichern.'}),run('Format_Anzeigen')],[prop('Act_Karte_Fehlt',{KartenEditorBusy:0,'Zurueck.enabled':true,'Status.text':'Die Karte wurde nicht gefunden.'})])
 ],[prop('Act_Kartenfehler',{KartenEditorBusy:0,'Zurueck.enabled':true,'Status.text':'${KartenAntwort.message}'})])]);
 for(const [name,value]of[['Speichern',false],['Speichern_Weiter',true]])task(name,[cond('KartenEditorBusy',0,[cond('Manageable',true,[prop('Act_Modus_'+name,{Weiter:value,KartenEditorBusy:1}),run('Karte_Speichern')])])]);
 task('Karte_Speichern',[prop('Act_Speichern_Start',{KartenEditorBusy:1,...enabled(false),'Status.text':'Karte wird gespeichert …'}),http('Act_Speichern_Server','/api/cms/decks/card-save',{token:'${Token}',deckId:'${DeckKontextId}',cardId:'${DeckKarteKontextId}',question:'${FrageNeu.text}',answers:'${AntwortenNeu.text}',wrongAnswers:'${FalscheAntwortenNeu.text}',subject:'${FachKarte.text}',topic:'${ThemaKarte.text}',answerFormat:'${Format}'},'SpeicherAntwort'),cond('SpeicherAntwort.ok',true,[cond('Weiter',true,[run('Neue_Karte_Bereit'),prop('Act_Weitere_Karte',{'Status.text':'Karte gespeichert. Die nächste Karte kann eingegeben werden.'})],[back])],[prop('Act_Speicherfehler',{KartenEditorBusy:0,...enabled(true),'Status.text':'${SpeicherAntwort.message}'})])]);
 task('Navigation_Zurueck',[cond('KartenEditorBusy',0,[back])]);
 task('Karte_Loeschen',[cond('KartenEditorBusy',0,[cond('Manageable',true,[prop('Act_Loeschen_Start',{KartenEditorBusy:1,...enabled(false)}),http('Act_Loeschen_Server','/api/cms/decks/card-delete',{token:'${Token}',deckId:'${DeckKontextId}',cardId:'${DeckKarteKontextId}'},'LoeschAntwort'),cond('LoeschAntwort.ok',true,[back],[prop('Act_Loeschfehler',{KartenEditorBusy:0,...enabled(true),'Status.text':'${LoeschAntwort.message}'})])])])]);
 task('Format_Anzeigen',[cond('Format','self',[prop('Act_Self_Anzeige',{'FormatText.text':'⌨ Eingabe','FormatSelf.text':'🙋 Selbst ✓'})],[prop('Act_Text_Anzeige',{'FormatText.text':'⌨ Eingabe ✓','FormatSelf.text':'🙋 Selbst'})])]);
 for(const [name,value]of[['Text','text'],['Self','self']])task('Format_'+name+'_Waehlen',[cond('KartenEditorBusy',0,[prop('Act_Format_'+name,{Format:value}),run('Format_Anzeigen')])]);
 for(const feature of old.features||[])if(feature.id==='decks-edit'){feature.description='Stapelmetadaten und Kartenliste; Karten auf eigener Stage gestalten.';feature.blueprintTaskNames=old.tasks.map(t=>t.name);}
 s.features=[{id:'deck-card-authoring',name:'Karte gestalten',description:'Frage und Antwort auf karierten Karten; Stapel, Fach und Ersteller übernehmen.',tags:['CMS','Karteikarten'],userStoryIds:[],blueprintTaskNames:s.tasks.map(t=>t.name)}];
 require('./cms-style.cjs').applyCmsTheme({stages:[old]});
 for(const panel of old.objects.filter(o=>o.cmsChrome))panel.id='deck_card_chrome_'+panel.name;
 const index=project.stages.findIndex(stage=>stage.id===s.id);if(index>=0&&project.stages[index].cmsDeckCardLayout==='compact')require('./cms-repair-card-layout.cjs').repairDeckCardLayout(project);else if(index<0)project.stages.push(s);else project.stages[index]=s;
 const server=project.stages.find(s=>s.id==='stage_server_decks');for(const a of server?.actions||[]){if(a.method==='deckCardSave')a.params[0].wrongAnswers='$body.wrongAnswers';if(a.method==='deckCards')a.params[0].cardId='$body.cardId';}
 return project;
}
module.exports={configureDeckCardEditor};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),raw=fs.readFileSync(file,'utf8');fs.writeFileSync(file,JSON.stringify(configureDeckCardEditor(JSON.parse(raw)),null,2)+(raw.endsWith('\n')?'\n':''));}
