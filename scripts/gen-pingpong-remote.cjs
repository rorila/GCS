// Erzeugt PingPong-Remote.json aus PingPong.json (Multiplayer-Variante,
// Host-Authority ueber TCmsLiveSync + WebSocket /api/cms/party/live).
const fs=require('fs'),path=require('path');
const dir=path.join(__dirname,'..','game-server','public','projects');
const src=JSON.parse(fs.readFileSync(path.join(dir,'PingPong.json'),'utf8'));
const p=JSON.parse(JSON.stringify(src));
let n=0;const id=pfx=>pfx+'_'+(++n).toString().padStart(3,'0');
const style={color:'#000000',backgroundColor:'#d1c4e9',borderColor:'#9575cd',borderWidth:1};
const base={scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,draggable:false,droppable:false,dragMode:'move',visible:true,width:6,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style};
const V={
 s:(i,name,val='')=>({...base,className:'TStringVariable',id:i,name,type:'string',defaultValue:'',value:val,objectModel:''}),
 b:(i,name,val=false)=>({...base,className:'TBooleanVariable',id:i,name,type:'boolean',defaultValue:false,value:val}),
 i:(i,name,val=0)=>({...base,className:'TIntegerVariable',id:i,name,type:'integer',defaultValue:0,value:val,objectModel:''}),
 o:(i,name)=>({...base,className:'TObjectVariable',id:i,name,type:'object',defaultValue:{},value:null,objectModel:''})
};
const A=(i,name,type,extra)=>({id:i,name,type,...extra});
const prop=(i,name,changes)=>({id:i,name,type:'property',changes});
const mapGet=(i,name,target,key,res)=>({id:i,name,type:'map_get',target,key,resultVariable:res});
const listGet=(i,name,target,field,res)=>({id:i,name,type:'list_get',target,index:'${AktIdx}',field,resultVariable:res});
const calc=(i,name,formula,res)=>({id:i,name,type:'calculate',formula,resultVariable:res});
const call=(i,name,target,method,params,res)=>({id:i,name,type:'call_method',target,method,params,resultVariable:res});
const http=(i,name,body,res)=>({id:i,name,type:'http',method:'POST',url:'/api/cms/party',body,resultVariable:res});
const cond=(variable,operator,value,body,elseBody=[])=>{
 // '${Var}' auf der rechten Seite ist ein Variablenvergleich — als Literal
 // wertet der Evaluator ihn zu NaN aus und die Bedingung ist immer false.
 const m=typeof value==='string'&&value.match(/^\$\{(.+)\}$/);
 const condition=m?{variable,operator,rightType:'variable',rightValue:m[1]}:{variable,operator,value};
 return{type:'condition',condition,body,elseBody};};
const act=name=>({type:'action',name});
const task=name=>({type:'task',name});
const bp=name=>({type:'action',name,scope:'global',sourceStage:'stage_blueprint'});

p.meta={...p.meta,id:'pingpong-remote',name:'PingPong-Remote',version:'1.0.0',
 description:'Kompetitives PingPong fuer genau 2 Spieler im selben Haus. Der Gastgeber (links) ist die autoritative Instanz: Ball, Kollisionen und Punkte. Der Gast (rechts) sendet nur seine Schlaeger-Richtung. Synchronisation ueber TCmsLiveSync/WebSocket: Host-Snapshots (Interpolation via smoothSync), Gast-Eingaben. Zielpunkte 3/5/10 waehlt der Gastgeber. Launch-Schluessel kommt als CMS_LAUNCH-Variable vom Server.',
 _sourcePath:'projects/PingPong-Remote.json',multiplayer:{minPlayers:2,maxPlayers:2,scope:'house'}};

const bpStage=p.stages.find(s=>s.id==='stage_blueprint');
bpStage.objects=bpStage.objects.filter(o=>!['SynchronTimer','Heartbeat','Handshake'].includes(o.name));
const pause=bpStage.objects.find(o=>o.name==='PauseTimer');
Object.assign(pause,{interval:1000,maxInterval:1,currentInterval:0,events:{onTimer:'AufschlagStarten'}});
const input=bpStage.objects.find(o=>o.name==='InputController');
input.events={onKeyDown_KeyW:'EigenHoch',onKeyDown_KeyS:'EigenRunter',onKeyUp_KeyW:'EigenHochStop',onKeyUp_KeyS:'EigenRunterStop',
 onKeyDown_ArrowUp:'EigenHoch',onKeyDown_ArrowDown:'EigenRunter',onKeyUp_ArrowUp:'EigenHochStop',onKeyUp_ArrowDown:'EigenRunterStop',
 onKeyDown_Space:'StartTheGame'};

const main=p.stages.find(s=>s.id==='stage_main');
const startBtn=main.objects.find(o=>o.name==='StartBtn');
startBtn.visible=false;
const btnStyle=startBtn.style;
const mkBtn=(name,text,x,ev)=>({className:'TButton',id:id('pp_'+name.toLowerCase()),name,scope:'stage',draggable:false,droppable:false,dragMode:'move',
 events:{onClick:ev},visible:false,x,y:37,width:5,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,
 style:{...btnStyle,backgroundColor:'#3f6fb5'},text,icon:''});
const statusLabel=main.objects.find(o=>o.name==='StatusLabel');
statusLabel.text='Warte auf Mitspieler …';statusLabel.width=10;
const zielLabel={className:'TLabel',id:id('pp_ziellabel'),name:'ZielInfoLabel',scope:'stage',draggable:false,droppable:false,dragMode:'move',
 visible:true,x:22,y:34,width:12,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,
 style:{...statusLabel.style,textAlign:'left'},text:'Ziel: 5 Punkte'};
const timerPoll={className:'TTimer',id:id('pp_timerpoll'),name:'TimerPoll',scope:'stage',isService:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',
 events:{onTimer:'LiveSynchronisieren'},visible:true,x:1,y:18,width:3,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,
 style:{backgroundColor:'#4caf50',borderColor:'#2e7d32',borderWidth:2},interval:140,enabled:false,maxInterval:0,currentInterval:0};
const liveSync={className:'TCmsLiveSync',id:id('pp_livesync'),name:'LiveSync',scope:'stage',isService:true,isHiddenInRun:true,draggable:false,droppable:false,dragMode:'move',
 visible:true,x:5,y:18,width:3,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,events:{onDisconnected:'VerbindungVerloren',onLive:'LiveEmpfangen'},
 style:{color:'#ffffff',backgroundColor:'#00838f',borderColor:'#005662',borderWidth:2},launchKey:'',partyId:'',endpointPath:'/api/cms/party/live',enabled:false};
main.objects.push(timerPoll,liveSync,zielLabel,
 mkBtn('Ziel3Btn','3 Punkte',22,'Ziel3Waehlen'),mkBtn('Ziel5Btn','5 Punkte',28,'Ziel5Waehlen'),mkBtn('Ziel10Btn','10 Punkte',34,'Ziel10Waehlen'));

main.variables=[
 V.s('pp_var_launch','CMS_LAUNCH'),V.s('pp_var_party','PartyId'),V.b('pp_var_auto','CMS_AUTO_PARTY'),
 V.b('pp_var_host','DuBistHost'),V.b('pp_var_init','InitFertig'),V.b('pp_var_rolle','RollenInit'),
 V.i('pp_var_tick','LetzterTick'),V.i('pp_var_neuertick','NeuerTick'),V.i('pp_var_seq','LastSeq'),
 V.o('pp_var_antwort','LiveAntwort'),V.o('pp_var_state','LiveState'),V.o('pp_var_input','FernEingabe'),
 V.o('pp_var_aktionen','AktionsListe'),V.i('pp_var_aktidx','AktIdx'),V.i('pp_var_aktanzahl','AktAnzahl'),
 V.s('pp_var_aktzug','AktZug'),V.s('pp_var_aktsieger','AktSieger'),V.s('pp_var_phase','SpielPhase','wait'),
 V.i('pp_var_ziel','ZielPunkte',5),V.i('pp_var_dir','EigeneRichtung'),V.i('pp_var_dirsent','GesendeteRichtung'),V.i('pp_var_inseq','LetzterInputSeq'),
 V.i('pp_var_mitglieder','Mitglieder'),V.s('pp_var_pstatus','PartyStatus'),V.s('pp_var_namen','MitspielerNamen'),
 V.i('pp_var_links','PunkteLinks'),V.i('pp_var_rechts','PunkteRechts'),V.b('pp_var_liveok','LiveOk'),V.b('pp_var_vb','VbAktiv')];

main.actions=[
 prop('pp_act_init','LiveSync initialisieren',{'LiveSync.launchKey':'${CMS_LAUNCH}','LiveSync.partyId':'${PartyId}','LiveSync.enabled':true,'InitFertig':true}),
 call('pp_act_poll','Stand abrufen','LiveSync','poll',['${LastSeq}'],'LiveAntwort'),
 call('pp_act_hsend','Live als Host senden','LiveSync','sendState',['${BallSprite.x}','${BallSprite.y}','${BallSprite.velocityX}','${BallSprite.velocityY}','${LeftPaddle.y}','${LeftPaddle.velocityY}','${RightPaddle.y}','${RightPaddle.velocityY}','${ScoreLblLeft.value}','${ScoreLblRight.value}','${SpielPhase}','${ZielPunkte}','${LetzterInputSeq}','${LastSeq}'],'LiveAntwort'),
 call('pp_act_gsend','Live als Gast senden','LiveSync','sendInput',['${EigeneRichtung}','${RightPaddle.y}','${RightPaddle.velocityY}','${LastSeq}'],'LiveAntwort'),
 mapGet('pp_act_host','Gastgeber-Flag lesen','LiveAntwort','youAreHost','DuBistHost'),
 mapGet('pp_act_member','Mitglieder lesen','LiveAntwort','memberCount','Mitglieder'),
 mapGet('pp_act_pstatus','Partie-Status lesen','LiveAntwort','status','PartyStatus'),
 mapGet('pp_act_lseq','Letzte Seq lesen','LiveAntwort','lastSeq','LastSeq'),
 mapGet('pp_act_state','Live-Stand lesen','LiveAntwort','live','LiveState'),
 mapGet('pp_act_input','Fern-Eingabe lesen','LiveAntwort','remoteInput','FernEingabe'),
 mapGet('pp_act_acts','Aktionen lesen','LiveAntwort','actions','AktionsListe'),
 mapGet('pp_act_names','Mitspieler lesen','LiveAntwort','memberNames','MitspielerNamen'),
 mapGet('pp_act_liveok','Antwort-Gueltigkeit lesen','LiveAntwort','ok','LiveOk'),
 prop('pp_act_push','Push-Daten lesen',{'LastSeq':'${LiveSync.lastSeq}','Mitglieder':'${LiveSync.memberCount}','PartyStatus':'${LiveSync.partyStatus}','DuBistHost':'${LiveSync.youAreHost}',LiveOk:true}),
 mapGet('pp_act_pushstate','Push-Stand lesen','LiveSync','live','LiveState'),
 mapGet('pp_act_pushinput','Push-Eingabe lesen','LiveSync','remoteInput','FernEingabe'),
 mapGet('pp_act_pushacts','Push-Aktionen lesen','LiveSync','actions','AktionsListe'),
 prop('pp_act_dirsent','Richtung gesendet',{GesendeteRichtung:'${EigeneRichtung}'}),
 prop('pp_act_hostui','Hostoberflaeche',{RollenInit:true,'GameState.collisionsEnabled':true,'StartBtn.visible':true,'Ziel3Btn.visible':true,'Ziel5Btn.visible':true,'Ziel10Btn.visible':true,'StatusLabel.text':'Du bist Gastgeber — Ziel wählen, dann starten.'}),
 prop('pp_act_guestui','Gastoberflaeche',{RollenInit:true,'GameState.collisionsEnabled':false,'StartBtn.visible':false,'Ziel3Btn.visible':false,'Ziel5Btn.visible':false,'Ziel10Btn.visible':false,'StatusLabel.text':'Du bist Gast — warte auf den Start.'}),
 mapGet('pp_act_tick','Tick lesen','LiveState','tick','NeuerTick'),
 prop('pp_act_tickm','Tick merken',{LetzterTick:'${NeuerTick}'}),
 call('pp_act_ball','Ball anwenden','LiveSync','applyBall',['${BallSprite}']),
 call('pp_act_lpaddle','Linken Schlaeger anwenden','LiveSync','applyPaddle',['${LeftPaddle}','left']),
 prop('pp_act_scores','Punkte uebernehmen',{'ScoreLblLeft.value':'${LiveState.scoreLeft}','ScoreLblRight.value':'${LiveState.scoreRight}','PunkteLinks':'${LiveState.scoreLeft}','PunkteRechts':'${LiveState.scoreRight}','SpielPhase':'${LiveState.phase}','ZielPunkte':'${LiveState.targetScore}','ZielInfoLabel.text':'Ziel: ${LiveState.targetScore} Punkte'}),
 call('pp_act_rinput','Fern-Eingabe anwenden','LiveSync','syncRemotePaddle',['${RightPaddle}']),
 mapGet('pp_act_inseq','Eingabe-Seq merken','FernEingabe','seq','LetzterInputSeq'),
 {id:'pp_act_anzahl',name:'Aktionen zaehlen',type:'list_length',target:'AktionsListe',resultVariable:'AktAnzahl'},
 calc('pp_act_idx0','Index auf null','0','AktIdx'),
 listGet('pp_act_zug','Aktionsart lesen','AktionsListe','payload.zug','AktZug'),
 listGet('pp_act_target','Ziel aus Aktion','AktionsListe','payload.target','ZielPunkte'),
 listGet('pp_act_sieger','Sieger aus Aktion','AktionsListe','payload.sieger','AktSieger'),
 calc('pp_act_idxhoch','Index hochzaehlen','AktIdx + 1','AktIdx'),
 calc('pp_act_plinks','Punkt links','PunkteLinks + 1','PunkteLinks'),
 calc('pp_act_prechts','Punkt rechts','PunkteRechts + 1','PunkteRechts'),
 prop('pp_act_sl','Punkt links anzeigen',{'ScoreLblLeft.value':'${PunkteLinks}'}),
 prop('pp_act_sr','Punkt rechts anzeigen',{'ScoreLblRight.value':'${PunkteRechts}'}),
 prop('pp_act_serve','Aufschlag anzeigen',{'SpielPhase':'serve','PauseTimer.enabled':true,'PauseTimer.currentInterval':0,'StatusLabel.text':'Aufschlag …'}),
 prop('pp_act_play','Phase laeuft',{'SpielPhase':'play'}),
 prop('pp_act_stop','Spiel stoppen',{'GameState.spritesMoving':false,'TimerPoll.enabled':false,'StatusLabel.text':'Partie beendet.'}),
 prop('pp_act_ende','Spielende anzeigen',{'SpielPhase':'finished','GameState.spritesMoving':false,'TimerPoll.enabled':false}),
 prop('pp_act_dir_up','Richtung hoch',{EigeneRichtung:-1}),
 prop('pp_act_dir_down','Richtung runter',{EigeneRichtung:1}),
 prop('pp_act_dir_stop','Richtung stopp',{EigeneRichtung:0}),
 prop('pp_act_warte','Warten anzeigen',{'StatusLabel.text':'Warte auf Mitspieler …'}),
 prop('pp_act_hwait','Host-Startbereitschaft',{'StatusLabel.text':'Du bist Gastgeber — Ziel wählen, dann starten (Klick oder Leertaste).'}),
 prop('pp_act_gwait','Gast-Wartehinweis',{'StatusLabel.text':'Du bist Gast — warte auf den Start.'}),
 prop('pp_act_lost','Verbindungshinweis',{'StatusLabel.text':'Verbindung verloren — wird wiederhergestellt …'}),
 prop('pp_act_vbset','Vb merken',{VbAktiv:true}),prop('pp_act_vbclear','Vb loeschen',{VbAktiv:false}),
 prop('pp_act_gsprite','Gast-Simulation an',{'GameState.spritesMoving':true}),
 prop('pp_act_siegtext','Siegertext',{'StatusLabel.text':'${AktSieger} gewinnt!'}),
 prop('pp_act_winlinks','Sieg links anzeigen',{'StatusLabel.text':'Links gewinnt!'}),
 prop('pp_act_winrechts','Sieg rechts anzeigen',{'StatusLabel.text':'Rechts gewinnt!'}),
 prop('pp_act_zl','Ziel anzeigen',{'ZielInfoLabel.text':'Ziel: ${ZielPunkte} Punkte'}),
 prop('pp_act_z3','Ziel 3 setzen',{'ZielPunkte':3,'ZielInfoLabel.text':'Ziel: 3 Punkte'}),
 prop('pp_act_z5','Ziel 5 setzen',{'ZielPunkte':5,'ZielInfoLabel.text':'Ziel: 5 Punkte'}),
 prop('pp_act_z10','Ziel 10 setzen',{'ZielPunkte':10,'ZielInfoLabel.text':'Ziel: 10 Punkte'}),
 prop('pp_act_hstart','Startoberflaeche',{'StatusLabel.text':'läuft','StartBtn.visible':false,'Ziel3Btn.visible':false,'Ziel5Btn.visible':false,'Ziel10Btn.visible':false}),
 prop('pp_act_paus','PauseTimer aus',{'PauseTimer.enabled':false}),
 prop('pp_act_gstart','Gast startet',{'GameState.spritesMoving':true,'SpielPhase':'play','StatusLabel.text':'läuft','StartBtn.visible':false,'Ziel3Btn.visible':false,'Ziel5Btn.visible':false,'Ziel10Btn.visible':false}),
 http('pp_act_cfg','Konfig senden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"config","target":${ZielPunkte}}}'),
 http('pp_act_starts','Start senden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"start"}}'),
 http('pp_act_siegl','Sieg links senden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"sieg","sieger":"links"}}'),
 http('pp_act_siegr','Sieg rechts senden','{"launchKey":"${CMS_LAUNCH}","op":"action","partyId":"${PartyId}","payload":{"zug":"sieg","sieger":"rechts"}}'),
 http('pp_act_end','Partie beenden','{"launchKey":"${CMS_LAUNCH}","op":"end","partyId":"${PartyId}"}'),
 http('pp_act_pstate','Partie-Status abrufen','{"launchKey":"${CMS_LAUNCH}","op":"state","partyId":"${PartyId}","since":${LastSeq}}','LiveAntwort')
];

const moveTask=(name,dir,stop)=>{const own=stop?(dir<0?'VelUp':'VelDown'):(dir<0?'VelUp':'VelDown');return{name,description:'Eigener Schlaeger (Host links, Gast rechts)',triggerMode:'local-sync',params:[],id:id('pp_t_'+name.toLowerCase()),
 actionSequence:[act(stop?'Richtung stopp':dir<0?'Richtung hoch':'Richtung runter'),
  cond('DuBistHost','==','true',[bp((stop?'StopLeftPaddle':'SetLeftPaddle')+own)],[bp((stop?'StopRightPaddle':'SetRightPaddle')+own)]),
  cond('EigeneRichtung','!=','${GesendeteRichtung}',[act('Richtung gesendet'),
   cond('DuBistHost','==','true',[act('Live als Host senden')],[act('Live als Gast senden')])])]};};

const zielTask=n=>{return{name:'Ziel'+n+'Waehlen',description:'Host waehlt '+n+' Punkte als Ziel',triggerMode:'local-sync',params:[],id:id('pp_t_ziel'+n),
 actionSequence:[act('Ziel '+n+' setzen'),act('Konfig senden'),act('Live als Host senden')]};};

const punktTask=(side)=>{const links=side==='links';return{name:'PunktFuer'+(links?'Links':'Rechts'),description:'Punkt fuer '+(links?'links':'rechts')+' — nur Host',triggerMode:'local-sync',params:[],id:id('pp_t_punkt'+side),
 actionSequence:[act(links?'Punkt links':'Punkt rechts'),act(links?'Punkt links anzeigen':'Punkt rechts anzeigen'),bp('ResetBall'),
  cond(links?'PunkteLinks':'PunkteRechts','>=','${ZielPunkte}',
   [act(links?'Sieg links anzeigen':'Sieg rechts anzeigen'),act('Spielende anzeigen'),act(links?'Sieg links senden':'Sieg rechts senden'),act('Partie beenden')],
   [act('Aufschlag anzeigen')]),act('Live als Host senden')]};};

main.tasks=[
 {name:'LiveSynchronisieren',description:'TimerPoll: LiveSync initialisieren und Stand senden (Heartbeat/Fallback). Das Anwenden uebernimmt LiveEmpfangen (onLive).',triggerMode:'local-sync',params:[],id:id('pp_t_live'),
  actionSequence:[
   cond('PartyId','!=','',[cond('InitFertig','==','false',[act('LiveSync initialisieren')])]),
   cond('RollenInit','==','false',[cond('InitFertig','==','true',[act('Stand abrufen')])]),
   cond('RollenInit','==','true',[cond('DuBistHost','==','true',[act('Live als Host senden')],[act('Live als Gast senden')])]),
   act('Antwort-Gueltigkeit lesen'),
   cond('LiveOk','==','true',[act('Mitspieler lesen')])
  ]},
 {name:'LiveEmpfangen',description:'onLive: Push-Staende und Fern-Eingaben sofort anwenden — Snapshots, Punkte, Phase und Aktionen ohne Timer-Wartezeit.',triggerMode:'local-sync',params:[],id:id('pp_t_push'),
  actionSequence:[
   act('Push-Daten lesen'),act('Push-Stand lesen'),act('Push-Eingabe lesen'),act('Push-Aktionen lesen'),
   cond('VbAktiv','==','true',[act('Vb loeschen')]),
   cond('RollenInit','==','false',[cond('DuBistHost','==','true',[act('Hostoberflaeche')],[act('Gastoberflaeche')])]),
   cond('PartyStatus','==','ended',[act('Spiel stoppen')]),
   cond('PartyStatus','==','open',[act('Warten anzeigen')]),
   cond('PartyStatus','==','playing',[cond('SpielPhase','==','wait',[cond('DuBistHost','==','true',[act('Host-Startbereitschaft')],[act('Gast-Wartehinweis')])])]),
   cond('DuBistHost','==','false',[act('Tick lesen'),cond('NeuerTick','>','${LetzterTick}',[act('Tick merken'),act('Ball anwenden'),act('Linken Schlaeger anwenden'),act('Punkte uebernehmen'),cond('SpielPhase','==','play',[act('Gast-Simulation an')])])]),
   cond('DuBistHost','==','true',[act('Fern-Eingabe anwenden'),act('Eingabe-Seq merken')]),
   act('Aktionen zaehlen'),act('Index auf null'),
   cond('AktAnzahl','>','0',[task('AktionVerarbeiten')])
  ]},
 {name:'VerbindungVerloren',description:'onDisconnected: Partie-Status nachpruefen — beendet → Spiel stoppen, sonst Hinweis auf Wiederherstellung.',triggerMode:'local-sync',params:[],id:id('pp_t_vb'),
  actionSequence:[
   cond('VbAktiv','==','false',[act('Vb merken'),
    act('Partie-Status abrufen'),act('Antwort-Gueltigkeit lesen'),
    cond('LiveOk','==','true',[
     act('Partie-Status lesen'),
     cond('PartyStatus','==','ended',[act('Spiel stoppen')],[act('Verbindungshinweis')])
    ],[act('Verbindungshinweis')])
   ])
  ]},
 {name:'AktionVerarbeiten',description:'Rekursive Schleife ueber neue Partie-Aktionen (config/start/sieg).',triggerMode:'local-sync',params:[],id:id('pp_t_aktion'),
  actionSequence:[
   act('Aktionsart lesen'),
   cond('AktZug','==','config',[act('Ziel aus Aktion'),act('Ziel anzeigen')]),
   cond('AktZug','==','start',[cond('DuBistHost','==','false',[act('Gast startet')])]),
   cond('AktZug','==','sieg',[act('Sieger aus Aktion'),act('Siegertext'),act('Spielende anzeigen')]),
   act('Index hochzaehlen'),
   cond('AktIdx','<','${AktAnzahl}',[task('AktionVerarbeiten')])
  ]},
 moveTask('EigenHoch',-1,false),moveTask('EigenRunter',1,false),moveTask('EigenHochStop',-1,true),moveTask('EigenRunterStop',1,true),
 {name:'StartTheGame',description:'Host startet die Partie, sobald beide Mitspieler verbunden sind.',triggerMode:'local-sync',params:[],id:id('pp_t_start'),
  actionSequence:[
   cond('DuBistHost','==','true',[cond('Mitglieder','>=','2',[
    bp('EnableSpriteMoving'),bp('EnableCollisions'),bp('ResetBall'),bp('SetBallVelocity'),act('Phase laeuft'),
    act('Startoberflaeche'),
    act('Start senden'),act('Live als Host senden')],[act('Warten anzeigen')])])
  ]},
 zielTask(3),zielTask(5),zielTask(10),
 punktTask('links'),punktTask('rechts'),
 {name:'AufschlagStarten',description:'Nach der Aufschlag-Pause den Ball wieder in Bewegung setzen (nur Host).',triggerMode:'local-sync',params:[],id:id('pp_t_aufschlag'),
  actionSequence:[cond('DuBistHost','==','true',[act('PauseTimer aus'),bp('SetBallVelocity'),act('Phase laeuft'),act('Live als Host senden')])]},
 {name:'HandleBallBoundary',description:'Nur der Host wertet Banden aus: oben/unten Abprall, links/rechts Punkt.',triggerMode:'local-sync',params:[],id:id('pp_t_boundary'),
  actionSequence:[cond('DuBistHost','==','true',[
   cond('hitSide','==','top',[bp('NegateBallY'),act('Live als Host senden')],[cond('hitSide','==','bottom',[bp('NegateBallY'),act('Live als Host senden')],[cond('hitSide','==','left',[task('PunktFuerRechts')],[cond('hitSide','==','right',[task('PunktFuerLinks')])])])])
  ])]},
 {name:'HandlePaddleCollision',description:'Paddle-Abprall nur auf dem Host berechnen.',triggerMode:'local-sync',params:[],id:id('pp_t_collision'),
  actionSequence:[cond('DuBistHost','==','true',[bp('NegateBallX'),act('Live als Host senden')])]}
];

const out=path.join(dir,'PingPong-Remote.json');
fs.writeFileSync(out,JSON.stringify(p,null,1));
console.log('geschrieben:',out,'(',Math.round(fs.statSync(out).size/1024),'KB )');
