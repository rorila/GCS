const fs=require('node:fs'),path=require('node:path');
/** Erzeugt ElinsMemoryRemote.json aus ElinsMemory.json:
 *  - meta/Mehrspieler-Flags
 *  - Lobby-Schicht (Mitspielen/Partie starten, Status, Poll-Timer)
 *  - Sync-Flow: Layout-Aktion (m0..m19), Flip-Aktionen über Partie-Aktionslog,
 *    Zugrecht-Gate in GetCardValues (Solo-Betrieb bleibt unverändert möglich)
 *  Idempotent: immer aus ElinsMemory.json neu generieren. */
const root=path.resolve(__dirname,'..');
const src=path.join(root,'game-server/public/projects/ElinsMemory.json');
const dst=path.join(root,'game-server/public/projects/ElinsMemoryRemote.json');
const p=JSON.parse(fs.readFileSync(src,'utf8'));
const stage=p.stages.find(s=>s.type==='main');
if(!stage)throw Error('Hauptstage nicht gefunden');
const listRef=(stage.objects.find(o=>o.name==='MemoryCardsList')||{}).id;
if(!listRef)throw Error('MemoryCardsList fehlt');

let n=0;const uid=()=>`node-mp-${Date.now().toString(36)}-${(++n).toString(36)}`;
// Variablen liegen bei ElinsMemory als TVariable-Objekte in stage.objects
// (Editor-Konvention + findVariableObject/list_get/map_get loesen sie auf).
const tvar=(name,type,def)=>({className:'TVariable',id:uid(),name,scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,draggable:false,droppable:false,dragMode:'move',description:'',visible:true,x:64,y:Math.floor(n/4),width:5,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{color:'#000000',backgroundColor:'#d1c4e9'},value:def,defaultValue:def});
const act=(name,type,more)=>({id:uid(),type,name,showDetails:false,...more});
const http=(name,body,resultVariable)=>act(name,'http',{method:'POST',url:'/api/cms/party',body,resultVariable});
const prop=(name,changes)=>act(name,'property',{changes});
const lget=(name,target,index,field,resultVariable)=>act(name,'list_get',{target,index,...(field?{field}:{}) ,resultVariable});
const mget=(name,target,key,resultVariable)=>act(name,'map_get',{target,key,resultVariable});
const calc=(name,formula,resultVariable)=>act(name,'calculate',{formula,resultVariable});
const rset=(name,target,field,value)=>act(name,'record_set',{target,list:'MemoryCardsList',list_ref:listRef,field,value});
const cmethod=(name,target,method,params,resultVariable)=>act(name,'call_method',{target,method,params,resultVariable});
const A=name=>({type:'action',name});
const T=name=>({type:'task',name});
// C(l, r, body, elseBody, opts:{op,rType}) — Gleichheit ist Standard; rType 'variable' für Var-vs-Var.
const C=(l,r,body,elseBody=[],opts={})=>({type:'condition',condition:{leftValue:l,rightValue:r,...(opts.op?{operator:opts.op}:{}),...(opts.rType?{rightType:opts.rType}:{})},body,elseBody});
const task=(name,seq,description)=>({id:uid(),name,description,actionSequence:seq,scope:'stage'});

// ---------- Meta ----------
p.meta.id='elins-memory-remote';
p.meta.name='ElinsMemoryRemote';
p.meta.description='Elins Memory als Mehrspieler-Variante: Züge laufen über den Partie-Aktionslog (/api/cms/party); beide Clients wenden denselben Flow an. Solo bleibt über „Mischen" spielbar.';
p.meta.multiplayer={minPlayers:2,maxPlayers:2};

// ---------- Variablen ----------
const vars=[
 tvar('CMS_LAUNCH','string',''),
 tvar('PartyId','string',''),tvar('LastSeq','number',0),tvar('PartyState','object',null),
 tvar('PartyListe','object',null),tvar('PartyItems','object',null),tvar('PartyAnzahl','number',0),tvar('OffenePartyId','string',''),
 tvar('DuBistHost','boolean',false),tvar('MeineSpielernummer','number',0),
 tvar('Var_RemoteMode','boolean',false),tvar('Var_RemoteApply','boolean',false),
 tvar('AktionsListe','object',null),tvar('AktPayload','object',null),
 tvar('AktIdx','number',0),tvar('AktAnzahl','number',0),tvar('PartieStatusVar','string',''),
 tvar('AktZug','string',''),tvar('AktSeat','number',0),tvar('AktKarte','number',0),tvar('AktBeginner','number',1),
 tvar('AktCp','number',0),tvar('AktMc','number',0),
 tvar('RemoteOk','boolean',false),tvar('SpielerNamen','string',''),
 ...Array.from({length:20},(_,i)=>tvar('M'+i,'number',0))
];
stage.objects.push(...vars);
// Zusatzlich in stage.variables (ZahlenDuell-Konvention): Der Projekt-Validator
// und aeltere Lookup-Pfade lesen diese Liste; Werte identisch, Objekte gewinnen.
stage.variables=[...(stage.variables||[]),...vars.map(v=>({className:'TVariable',id:v.id+'-v',name:v.name,scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,value:v.value,defaultValue:v.defaultValue}))];

// ---------- Lobby-Objekte ----------
const btn=(name,text,x,y,w,h,event,visible)=>({className:'TButton',id:uid(),name,scope:'stage',x,y,width:w,height:h,text,visible,zIndex:5,align:'NONE',events:{onClick:event},style:{color:'#08151b',fontSize:14,fontWeight:'700',backgroundColor:'#4fc3f7',borderColor:'#0288d1',borderWidth:2,borderRadius:8}});
stage.objects.push(
 btn('MpMitspielenBtn','Mitspielen',56,37,8,2,'MpMitspielen',true),
 btn('MpStartenBtn','Starten',56,37,8,2,'MpStarten',false),
 {className:'TLabel',id:uid(),name:'MpStatus',scope:'stage',x:36,y:37,width:11,height:2,text:'Solo: Mischen drücken.',visible:true,zIndex:5,align:'NONE',style:{color:'#555555',fontSize:11,backgroundColor:'transparent'}},
 {className:'TTimer',id:uid(),name:'MpPollTimer',scope:'stage',isService:true,isHiddenInRun:true,x:62,y:0,width:2,height:2,visible:true,interval:700,enabled:false,maxInterval:0,currentInterval:0,events:{onTimer:'MpZustandLesen'},style:{backgroundColor:'#4caf50'}}
);

// ---------- Neue Actions ----------
stage.actions.push(
 // Lobby
 http('Act_MpPartien','{"launchKey":"${CMS_LAUNCH}","op":"list"}','PartyListe'),
 mget('Act_MpPartieItems','PartyListe','items','PartyItems'),
 act('Act_MpPartieZaehlen','list_length',{target:'PartyItems',resultVariable:'PartyAnzahl'}),
 lget('Act_MpErste','PartyItems','0','id','OffenePartyId'),
 http('Act_MpBeitreten','{"launchKey":"${CMS_LAUNCH}","op":"join","partyId":"${OffenePartyId}"}','PartyState'),
 prop('Act_MpGast',{PartyId:'${OffenePartyId}',MeineSpielernummer:2,'MpStatus.text':'Beigetreten — warte auf Start.'}),
 http('Act_MpErstellen','{"launchKey":"${CMS_LAUNCH}","op":"create","gameId":"game-memory-remote"}','PartyState'),
 mget('Act_MpNeueId','PartyState','partyId','PartyId'),
 prop('Act_MpHost',{MeineSpielernummer:1,'MpStatus.text':'Partie erstellt — warte auf Mitspieler.'}),
 prop('Act_MpPollAn',{Var_RemoteMode:true,'MpPollTimer.enabled':true,'MpMitspielenBtn.visible':false,'MischenBtn.visible':false}),
 http('Act_MpBegin','{"launchKey":"${CMS_LAUNCH}","op":"begin","partyId":"${PartyId}"}','PartyState'),
 // Zug senden (eigener, erlaubter Klick)
 http('Act_RemoteZugSenden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"flip","card":${Var_CurrListIndex},"seat":${MeineSpielernummer},"cp":${Var_CurrPlayer},"mc":${Var_MatchCounter}}}'),
 // Polling
 http('Act_MpZustand','{"launchKey":"${CMS_LAUNCH}","op":"state","partyId":"${PartyId}","since":${LastSeq}}','PartyState'),
 mget('Act_MpSeqNeu','PartyState','lastSeq','LastSeq'),
 mget('Act_MpAktionen','PartyState','actions','AktionsListe'),
 act('Act_MpAktZaehlen','list_length',{target:'AktionsListe',resultVariable:'AktAnzahl'}),
 prop('Act_MpIdxNull',{AktIdx:0}),
 mget('Act_MpNamen','PartyState','memberNames','SpielerNamen'),
 prop('Act_MpNamenUi',{'MpStatus.text':'Mit dabei: ${SpielerNamen}'}),
 mget('Act_MpHostFlag','PartyState','youAreHost','DuBistHost'),
 mget('Act_MpPartieStatus','PartyState','status','PartieStatusVar'),
 prop('Act_MpHostUi',{'MpStartenBtn.visible':true,'MpStatus.text':'Du bist Gastgeber — starte, wenn alle da sind.'}),
 // Aktionslog lesen: payload als Map holen, dann Felder flach per map_get
 lget('Act_AktPayload','AktionsListe','${AktIdx}','payload','AktPayload'),
 mget('Act_AktZug','AktPayload','zug','AktZug'),
 mget('Act_AktSeat','AktPayload','seat','AktSeat'),
 mget('Act_AktKarte','AktPayload','card','AktKarte'),
 mget('Act_AktBeginner','AktPayload','beginner','AktBeginner'),
 mget('Act_AktCp','AktPayload','cp','AktCp'),
 mget('Act_AktMc','AktPayload','mc','AktMc'),
 calc('Act_AktIdxHoch','AktIdx + 1','AktIdx'),
 prop('Act_RemoteApplyAn',{Var_RemoteApply:true}),
 prop('Act_RemoteApplyAus',{Var_RemoteApply:false}),
 cmethod('Act_RemoteKarte','MemoryCardsList','emitRecordEvent',['${AktKarte}','onClick'],'RemoteOk'),
 // Layout senden (Host): MatchIndexList -> m0..m19
 ...Array.from({length:20},(_,i)=>lget('Act_MpM'+i,'MatchIndexList',String(i),null,'M'+i)),
 http('Act_MpLayoutSenden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"layout","seat":1,'+Array.from({length:20},(_,i)=>`"m${i}":\${M${i}}`).join(',')+'}}'),
 http('Act_MpStartSenden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"start","seat":1,"beginner":1}}'),
 // Layout anwenden (Gast): AktPayload.mI -> record.matchIndex
 ...Array.from({length:20},(_,i)=>mget('Act_LayM'+i,'AktPayload','m'+i,'M'+i)),
 ...Array.from({length:20},(_,i)=>rset('Act_LaySet'+i,String(i),'matchIndex','${M'+i+'}')),
 prop('Act_MpLobbyAus',{'MpStartenBtn.visible':false,'MpMitspielenBtn.visible':false,'MpStatus.text':'Partie läuft — viel Spaß!'}),
 prop('Act_MpSyncFehler',{'MpStatus.text':'⚠ Sync-Fehler: Zug nicht anwendbar.'})
);

// ---------- Neue Tasks ----------
// Eingelesene Aktion (AktIdx) behandeln: eigene Aktions-Seats überspringen.
const aktionBehandeln=[
 A('Act_AktPayload'),A('Act_AktZug'),A('Act_AktSeat'),
 C('${AktZug}','layout',[
   C('${AktSeat}','${MeineSpielernummer}',[],[T('LayoutAnwenden')],{rType:'variable'})
 ]),
 C('${AktZug}','flip',[
   C('${AktSeat}','${MeineSpielernummer}',[],[
    A('Act_AktKarte'),A('Act_AktCp'),A('Act_AktMc'),
    A('Act_RemoteApplyAn'),A('Act_RemoteKarte'),A('Act_RemoteApplyAus'),
    C('${RemoteOk}',false,[A('Act_MpSyncFehler')]),
    C('${Var_CurrPlayer}','${AktCp}',[],[A('Act_MpSyncFehler')],{rType:'variable'}),
    C('${Var_MatchCounter}','${AktMc}',[],[A('Act_MpSyncFehler')],{rType:'variable'})
   ],{rType:'variable'})
 ]),
 C('${AktZug}','start',[
   C('${AktSeat}','${MeineSpielernummer}',[],[T('RemotePartieStart')],{rType:'variable'})
 ])
];
stage.tasks.push(
 task('MpMitspielen',[
  A('Act_MpPartien'),A('Act_MpPartieItems'),A('Act_MpPartieZaehlen'),
  C('${PartyAnzahl}',0,[
   A('Act_MpErste'),A('Act_MpBeitreten'),A('Act_MpGast')
  ],[
   A('Act_MpErstellen'),A('Act_MpNeueId'),A('Act_MpHost')
  ],{op:'>'}),
  A('Act_MpPollAn')
 ],'Offene Partie des Raums suchen und beitreten — sonst selbst eine erstellen.'),
 task('MpStarten',[
  A('Act_MpBegin'),T('KartenMischenMP'),
  ...Array.from({length:20},(_,i)=>A('Act_MpM'+i)),
  A('Act_MpLayoutSenden'),A('Act_MpStartSenden'),
  T('SetBeginnerIsPlayer1'),A('Act_MpLobbyAus')
 ],'Gastgeber: Partie beginnen, Karten mischen, Belegung + Start an alle senden.'),
 task('KartenMischenMP',[
  T('SetAllVariableBack'),A('Act_SetIsMatchedToFalse'),A('Act_SetResetScores'),
  T('SetBackCardToAllCards'),A('Act_MatchIndexMischen'),
  {type:'foreach',body:[A('Act_SetNewMatchIndexToVar_NewMatchIndex'),A('Act_SetANewMatchValueToCard')],sourceArray:'MemoryCardsList',itemVar:'item',indexVar:'i',name:'foreach'}
 ],'Wie KatenMischen, aber ohne List_15-Shuffle — die Kartenbelegung wird per Layout-Aktion synchron gehalten.'),
 task('MpZustandLesen',[
  A('Act_MpZustand'),A('Act_MpSeqNeu'),A('Act_MpAktionen'),A('Act_MpAktZaehlen'),A('Act_MpIdxNull'),
  A('Act_MpPartieStatus'),A('Act_MpNamen'),A('Act_MpHostFlag'),
  C('${PartieStatusVar}','open',[
   C('${DuBistHost}',true,[A('Act_MpHostUi')],[A('Act_MpNamenUi')])
  ]),
  T('AktionenVerarbeiten')
 ],'Partiezustand abrufen; neue Aktionen der Reihe nach anwenden.'),
 task('AktionenVerarbeiten',[
  C('${AktIdx}','${AktAnzahl}',[
   ...aktionBehandeln,
   A('Act_AktIdxHoch'),T('AktionenVerarbeiten')
  ],null,{op:'<',rType:'variable'})
 ],'Alle neuen Aktionslog-Einträge in Sequenz anwenden.'),
 task('LayoutAnwenden',[
  T('SetAllVariableBack'),A('Act_SetIsMatchedToFalse'),A('Act_SetResetScores'),T('SetBackCardToAllCards'),
  ...Array.from({length:20},(_,i)=>[A('Act_LayM'+i),A('Act_LaySet'+i)]).flat()
 ],'Kartenbelegung des Gastgebers übernehmen (matchIndex pro Datensatz).'),
 task('RemotePartieStart',[
  A('Act_AktBeginner'),T('SetBeginnerIsPlayer1'),A('Act_MpLobbyAus')
 ],'Gast: Partiebeginn anwenden (Beginner übernehmen, Lobby ausblenden).')
);

// ---------- Zugrecht-Gate in GetCardValues ----------
const gcv=stage.tasks.find(t=>t.name==='GetCardValues');
const outer=gcv.actionSequence[0];
if(!outer||outer.type!=='condition')throw Error('GetCardValues-Struktur unerwartet');
const chain=outer.body; // 5 Schritte: Info/Match/MatchIndex/ListIndex + CheckTheSelection
outer.body=[
 C('${Var_RemoteApply}',true,[...chain],[
  C('${Var_RemoteMode}',true,[
   C('${Var_CurrPlayer}','${MeineSpielernummer}',[...chain,A('Act_RemoteZugSenden')],null,{rType:'variable'})
  ],[...chain])
 ])
];

fs.writeFileSync(dst,JSON.stringify(p,null,2)+'\n');
console.log('ElinsMemoryRemote.json geschrieben:',stage.objects.length,'Objekte,',stage.tasks.length,'Tasks,',stage.actions.length,'Actions');
