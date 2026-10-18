const fs=require('node:fs'),path=require('node:path');
function apply(p){
 const s=p.stages.find(s=>s.id==='stage_gallery'),server=p.stages.find(s=>s.id==='stage_server_player');if(!s||!server)return;
 const up=(list,name,data)=>{const old=list.find(x=>x.name===name);if(old)Object.assign(old,data);else list.push({id:'gallery_table_'+name,name,scope:'stage',...data});};
 const a=name=>({type:'action',name}),t=name=>({type:'task',name});
 const prop=(name,changes)=>up(s.actions,name,{type:'property',changes});
 const table=structuredClone(s.objects.find(o=>o.name==='RaumTabelle'));Object.assign(table,{id:'gallery_table_games',name:'SpieleTabelle',dataSource:'GalerieSpiele',visible:false,displayMode:'cards',x:5,y:10,width:54,height:24,events:{onRowClick:'Tabellenspiel_Starten'},selectedKey:'',selectedRecord:null,selectedIndex:-1,cardConfig:{width:280,height:180,gap:14,padding:14,borderRadius:14,backgroundColor:'#214858',borderColor:'#548493',borderWidth:1},style:{...table.style,fontFamily:'Segoe UI, Segoe UI Emoji, sans-serif',color:'#f1fbff'},columns:[
  {field:'avatar',label:'',type:'text',x:.8,y:.5,width:14,height:2.6,style:{fontSize:36,color:'#ffffff'}},
  {field:'title',label:'Spiel',type:'header',x:.8,y:3.4,width:14,height:3.6,style:{fontSize:20,color:'#ffffff',fontWeight:'600'}},
  {field:'modeLabel',label:'Spielart',type:'text',x:.8,y:8,width:14,height:1.2,style:{fontSize:13,color:'#b9dce5'}}
 ]});up(s.objects,'SpieleTabelle',table);
 const back=s.objects.find(o=>o.name==='Zurueck');if(back)Object.assign(back,{x:5,y:35,width:10,height:3});
 const companions=s.objects.find(o=>o.name==='NavBegleiter');if(companions)Object.assign(companions,{x:45,y:35,width:14,height:3});
 const list=structuredClone(s.objects.find(o=>o.name==='Raeume'));Object.assign(list,{id:'gallery_table_records',name:'GalerieSpiele',fields:[],records:[],items:[],data:[]});up(s.objects,'GalerieSpiele',list);
 up(s.actions,'Act_Galeriespiele_Uebernehmen',{type:'call_method',target:'GalerieSpiele',method:'tryReplaceRecords',params:['${Antwort.items}'],resultVariable:'GaleriespieleGueltig'});
 up(s.variables,'GaleriespieleGueltig',{className:'TBooleanVariable',isVariable:true,isHiddenInRun:true,type:'boolean',value:false,defaultValue:false});
 const hideCards=Object.fromEntries([0,1,2,3].map(i=>['Karte'+i+'.visible',false]));
 prop('Act_Galeriespiele_Anzeigen',{Busy:0,...hideCards,'RaumTabelle.visible':false,'SpieleTabelle.visible':true,'Vorher.visible':false,'Weiter.visible':false,'Zurueck.visible':true,'Hinweis.text':'${Antwort.message}'});
 prop('Act_Galeriespiele_Verbergen',{'SpieleTabelle.visible':false,...hideCards});
 prop('Act_Tabellenspiel_Merken',{Auswahl:'${SpieleTabelle.selectedKey}'});
 prop('Act_Galerie_Partie_Merken',{CMSMpRoomId:'${Raum}',CMSMpRoomName:'${RaumTabelle.selectedRecord.name}',CMSMpGameId:'${SpieleTabelle.selectedKey}',CMSMpGameName:'${SpieleTabelle.selectedRecord.title}',CMSMpCandidateId:'',CMSGalleryParty:true});
 up(s.actions,'Act_Galerie_Partie_Oeffnen',{type:'navigate_stage',stageId:'stage_multiplayer_lobby',reset:false});
 const condition=(variable,value,body,elseBody=[])=>({type:'condition',condition:{variable,operator:'==',value},body,elseBody});
 up(s.tasks,'KartenZeigen',{triggerMode:'local-sync',params:[],actionSequence:[a('Act_Galeriespiele_Uebernehmen'),condition('GaleriespieleGueltig',true,[a('Act_Galeriespiele_Anzeigen')],[a('Act_Galeriespiele_Verbergen')])]});
 up(s.tasks,'Tabellenspiel_Starten',{triggerMode:'local-sync',params:[],actionSequence:[condition('Busy',0,[{type:'condition',condition:{variable:'SpieleTabelle.selectedKey',operator:'!=',value:''},body:[a('Act_Tabellenspiel_Merken'),condition('SpieleTabelle.selectedRecord.solo',true,[t('SpielStarten')],[a('Act_Galerie_Partie_Merken'),a('Act_Galerie_Partie_Oeffnen')])],elseBody:[]}])]});
 for(const name of ['Raeume','Spiele']){const task=s.tasks.find(x=>x.name===name);if(task&&!task.actionSequence.some(x=>x.name==='Act_Galeriespiele_Verbergen'))task.actionSequence.unshift(a('Act_Galeriespiele_Verbergen'));}
 const request=s.actions.find(x=>x.url==='/api/cms/games');if(request)request.body={token:'${Token}',areaId:'${Raum}',includeParty:true};
 const load=server.actions.find(x=>x.method==='gamesFor');if(load)load.params=['$body.areaId','$body.includeParty'];
 const send=server.actions.find(x=>x.name==='Spiele_Antworten');if(send)send.params=[{merge:'${Seite}',items:'${Spiele.items}'}];
 const blueprint=p.stages.find(x=>x.type==='blueprint');if(blueprint)up(blueprint.variables,'CMSGalleryParty',{className:'TBooleanVariable',scope:'global',isVariable:true,isHiddenInRun:true,type:'boolean',value:false,defaultValue:false});
 const lobby=p.stages.find(x=>x.id==='stage_multiplayer_lobby');if(lobby){
  up(lobby.actions,'Act_Galerie_Partie_Bereit',{type:'property',changes:{CMSGalleryParty:false,'Status.text':'Spiel gewählt: ${CMSMpGameName} · Wähle einen Mitspieler.'}});
  const init=lobby.tasks.find(x=>x.name==='Lobby_Init');if(init&&!init.actionSequence.some(x=>x.name==='Galerieauswahl übernehmen'))init.actionSequence.push({...condition('CMSGalleryParty',true,[t('Spiele_Laden'),a('Act_Galerie_Partie_Bereit')]),name:'Galerieauswahl übernehmen'});
 }
 require('./cms-gallery-session-stop.cjs').apply(p);
}
module.exports={apply};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),p=JSON.parse(fs.readFileSync(file,'utf8'));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');}
