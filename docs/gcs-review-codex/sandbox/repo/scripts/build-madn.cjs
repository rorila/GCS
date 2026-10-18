const fs=require('node:fs'),path=require('node:path');
/** Erzeugt Madn als GCS-Projekt (Solo/Hotseat, 2-4 Spieler):
 *  - Brett-/Figuren-/Würfel-SVGs nach game-server/public/images/madn/
 *  - Madn.json: 16 Figuren, absolute Ringpositionen 0-39, Ziel/Home-Slots,
 *    Regeln komplett deklarativ (Würfel, 3x6, 3 Versuche, Schlagen, Zielweg)
 *  Idempotent generierbar; kein Bestandscode wird angefasst.
 *  Hinweise: Var-Werte via `property` mit "${..}" werden zu Strings —
 *  bei Arithmetik immer mit *1 kovariieren (nur + konkateniert Strings). */
const root=path.resolve(__dirname,'..');
const imgDir=path.join(root,'game-server/public/images/madn');
fs.mkdirSync(imgDir,{recursive:true});

// ---------- Geometrie (aus dist/shared/types/games/madn.js, absoluter Ring) ----------
const RING=[[0,6],[1,6],[2,6],[3,6],[4,6],[4,7],[4,8],[4,9],[4,10],[5,10],[6,10],[6,9],[6,8],[6,7],[6,6],[7,6],[8,6],[9,6],[10,6],[10,5],[10,4],[9,4],[8,4],[7,4],[6,4],[6,3],[6,2],[6,1],[6,0],[5,0],[4,0],[4,1],[4,2],[4,3],[4,4],[3,4],[2,4],[1,4],[0,4],[0,5]];
// colorIdx: 0=rot,1=blau,2=gruen,3=gelb (Reihenfolge der Farbzuweisung)
const COLORS=['#dc143c','#1e90ff','#228b22','#ffd700'];
const STARTS=[0,10,30,20];   // rot[0,6]=0, blau[6,10]=10, gruen[4,0]=30, gelb[10,4]=20
const EINGANG=[39,9,29,19];  // letztes Feld vor dem eigenen Startfeld
const GOALS={0:[[1,5],[2,5],[3,5],[4,5]],1:[[5,9],[5,8],[5,7],[5,6]],2:[[5,1],[5,2],[5,3],[5,4]],3:[[9,5],[8,5],[7,5],[6,5]]};
const HOMES={0:[[1,8],[1,9],[2,8],[2,9]],1:[[8,8],[8,9],[9,8],[9,9]],2:[[1,1],[1,2],[2,1],[2,2]],3:[[8,1],[8,2],[9,1],[9,2]]};
// Slot-Kodierung: 0-39 Ring | 40+c*4+g Ziel | 56+c*4+h Home

// ---------- Medien ----------
const CS=50;
function boardSvg(){
 let s=`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${11*CS} ${11*CS}"><rect width="100%" height="100%" fill="#f5f5dc"/>`;
 for(let i=0;i<=11;i++){s+=`<line x1="${i*CS}" y1="0" x2="${i*CS}" y2="${11*CS}" stroke="#999" stroke-width="1"/><line x1="0" y1="${i*CS}" x2="${11*CS}" y2="${i*CS}" stroke="#999" stroke-width="1"/>`;}
 const circ=(r,c,fill,stroke,dash)=>`<circle cx="${c*CS+25}" cy="${r*CS+25}" r="18" fill="${fill}" stroke="${stroke}" stroke-width="2"${dash?' stroke-dasharray="5,5"':''}/>`;
 RING.forEach(([r,c],i)=>{const si=STARTS.indexOf(i);s+=circ(r,c,si>=0?COLORS[si]:'#ffffff','#333');});
 for(const c of [0,1,2,3]){GOALS[c].forEach(([r,cc])=>{s+=circ(r,cc,COLORS[c],'#333');});HOMES[c].forEach(([r,cc])=>{s+=circ(r,cc,'none',COLORS[c],true);});}
 return s+'</svg>';
}
const pawnSvg=color=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><circle cx="25" cy="25" r="20" fill="${color}" stroke="#222" stroke-width="3"/><circle cx="19" cy="18" r="6" fill="rgba(255,255,255,0.45)"/></svg>`;
const dieSvg=n=>{const P={1:[[25,25]],2:[[14,14],[36,36]],3:[[14,14],[25,25],[36,36]],4:[[14,14],[36,14],[14,36],[36,36]],5:[[14,14],[36,14],[25,25],[14,36],[36,36]],6:[[14,12],[36,12],[14,25],[36,25],[14,38],[36,38]]};return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 50 50"><rect x="2" y="2" width="46" height="46" rx="8" fill="#fff" stroke="#333" stroke-width="3"/>${P[n].map(([x,y])=>`<circle cx="${x}" cy="${y}" r="5" fill="#222"/>`).join('')}</svg>`;};
fs.writeFileSync(path.join(imgDir,'brett.svg'),boardSvg());
['rot','blau','gruen','gelb'].forEach((n,i)=>fs.writeFileSync(path.join(imgDir,'figur-'+n+'.svg'),pawnSvg(COLORS[i])));
for(let i=1;i<=6;i++)fs.writeFileSync(path.join(imgDir,'w'+i+'.svg'),dieSvg(i));

// ---------- Stage-Koordinaten ----------
const BX=1,BY=2,CU=3;
const slotXY=s=>{let rc;if(s<40)rc=RING[s];else if(s<56){const c=(s-40)>>2;rc=GOALS[c][(s-40)%4];}else{const c=(s-56)>>2;rc=HOMES[c][(s-56)%4];}const[r,c]=rc;return[+(BX+c*CU+0.3).toFixed(1),+(BY+r*CU+0.3).toFixed(1)];};
const FX=[],FY=[];for(let s=0;s<72;s++){const[x,y]=slotXY(s);FX.push(x);FY.push(y);}

// ---------- JSON-Bausteine ----------
let n=0;const uid=()=>`madn-${(++n).toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const objects=[],actions=[],tasks=[],variables=[],ALLVARS=[];
const obj=(cls,name,more)=>({className:cls,id:uid(),name,scope:'stage',x:0,y:0,width:3,height:3,visible:true,zIndex:1,align:'NONE',draggable:false,style:{},...more});
const tvar=(name,def)=>{const v={className:'TVariable',id:uid(),name,scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,draggable:false,description:'',visible:true,x:60,y:ALLVARS.length%38,width:5,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{color:'#000',backgroundColor:'#d1c4e9'},value:def,defaultValue:def};ALLVARS.push(v);return v;};
const tlist=(name,items)=>({className:'TListVariable',id:uid(),name,scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,draggable:false,description:'',visible:true,x:60,y:2,width:5,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{backgroundColor:'#9c27b0'},items,value:items.slice(),defaultValue:items.slice()});
const act=(name,type,more)=>({id:uid(),type,name,showDetails:false,...more});
const prop=(name,changes)=>act(name,'property',{changes});
const calc=(name,formula,resultVariable)=>act(name,'calculate',{formula,resultVariable});
const lget=(name,target,index,field,rv)=>act(name,'list_get',{target,index,...(field?{field}:{}) ,resultVariable:rv});
const ls=(name,list,index,value)=>act(name,'list_set',{target:list,index,value});
const rget=(name,idx,field,rv)=>act(name,'record_get',{target:String(idx),list:'FigurenListe',field,resultVariable:rv});
const rset=(name,idx,field,value)=>act(name,'record_set',{target:String(idx),list:'FigurenListe',field,value});
const A=name=>({type:'action',name});
const T=name=>({type:'task',name});
const C=(l,r,body,elseBody=[],opts={})=>({type:'condition',condition:{leftValue:l,rightValue:r,...(opts.op?{operator:opts.op}:{}),...(opts.rType?{rightType:opts.rType}:{})},body,elseBody});
const FOR=(it,from,to,body)=>({type:'for',iteratorVar:it,from,to,body,name:'for'});
const FEACH=(itemVar,indexVar,body)=>({type:'foreach',sourceArray:'FigurenListe',itemVar,indexVar,body,name:'foreach'});
const task=(name,seq,description)=>({id:uid(),name,description,actionSequence:seq,scope:'stage'});

// ---------- Objekte ----------
objects.push(obj('TImage','Brett',{x:BX,y:BY,width:33,height:33,src:'images/madn/brett.svg',objectFit:'fill',zIndex:0}));
const figIds=[];const colorName=['rot','blau','gruen','gelb'];
for(let p=0;p<16;p++){const[x,y]=slotXY(56+p);
 const o=obj('TImage','Figur_'+p,{x,y,width:2.4,height:2.4,src:'images/madn/figur-'+colorName[p>>2]+'.svg',objectFit:'contain',zIndex:10,visible:false,events:{onClick:'FigurGewaehlt',onTouchStart:'FigurGewaehlt'}});
 objects.push(o);figIds.push(o.id);}
// TObjectList: recordData ist per objectId verschluesselt und fields deklariert
// die Spalten — rebuildData() erzeugt daraus die data-View (index/objectId/name
// kommen dabei automatisch dazu). Ein reines data-Array wuerde ueberschrieben.
const figRecordData=Object.fromEntries(figIds.map((id,p)=>[id,{slot:56+p,colorIdx:p>>2,moveable:false,pieceIdx:p,figurName:'Figur_'+p}]));
objects.push({className:'TObjectList',id:uid(),name:'FigurenListe',scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,visible:true,x:58,y:0,width:5,height:2,zIndex:0,rotation:0,align:'NONE',style:{},
 items:figIds,
 fields:[{name:'slot',type:'number',defaultValue:0},{name:'colorIdx',type:'number',defaultValue:0},{name:'moveable',type:'boolean',defaultValue:false},{name:'pieceIdx',type:'number',defaultValue:0},{name:'figurName',type:'string',defaultValue:''}],
 recordData:figRecordData,
 data:figIds.map((id,p)=>({index:p,objectId:id,name:'Figur_'+p,...figRecordData[id]}))});
objects.push(obj('TLabel','TitelLabel',{x:36,y:2,width:26,height:3,text:'Mensch ärgere dich nicht',style:{fontSize:26,fontWeight:'700',color:'#333',backgroundColor:'transparent'}}));
objects.push(obj('TLabel','WahlLabel',{x:36,y:6,width:20,height:2,text:'Wie viele Spieler?',style:{fontSize:16,color:'#444',backgroundColor:'transparent'}}));
const mkBtn=(name,text,x,y,ev,vis)=>obj('TButton',name,{x,y,width:7,height:3,text,visible:vis!==false,zIndex:5,events:{onClick:ev},style:{color:'#fff',fontSize:15,fontWeight:'700',backgroundColor:'#1976d2',borderColor:'#0d47a1',borderWidth:2,borderRadius:8}});
objects.push(mkBtn('Btn2','2 Spieler',36,9,'Anzahl2'),mkBtn('Btn3','3 Spieler',45,9,'Anzahl3'),mkBtn('Btn4','4 Spieler',54,9,'Anzahl4'));
objects.push(mkBtn('WuerfelnBtn','Würfeln',36,20,'Wuerfeln',false));
objects.push(obj('TImage','WuerfelBild',{x:46,y:18,width:6,height:6,src:'images/madn/w6.svg',visible:false,zIndex:5,objectFit:'contain'}));
objects.push(obj('TLabel','StatusLabel',{x:36,y:15,width:26,height:4,text:'',visible:true,style:{fontSize:15,color:'#222',backgroundColor:'transparent'},zIndex:5}));
objects.push(mkBtn('NeustartBtn','Neu starten',36,26,'Neustart',false));
for(const l of[tlist('RingListe',Array(40).fill(-1)),tlist('GoalListe',Array(16).fill(-1)),tlist('FeldX',FX),tlist('FeldY',FY),tlist('StartFelder',STARTS),tlist('EingangFelder',EINGANG)])objects.push(l);
// Variablen (deklarativ registriert; werden am Ende in objects+variables gespiegelt)
['Var_PlayerCount',0,'Var_CurrPlayer',0,'Var_Wurf',0,'Var_Phase','setup','Var_Versuche',0,'Var_Sechser',0,
 'Var_Gewaehlt',-1,'Var_Moveable',0,'Var_PSlot',-1,'Var_PColor',0,'Var_Ziel',-1,'Var_ZielCapture',-1,
 'Var_Dist',0,'Var_Gi',0,'Var_G',0,'Var_Gefunden',-1,'Var_GefundenFarbe',0,'Var_Potential',false,
 'Var_GoalCount',0,'Var_X',0,'Var_Y',0,'Var_SlotTmp',-1,'Var_FigurName','','Var_FarbName','',
 'Var_WegFrei',true,'Var_SlotZiel',0,'Var_GVon',0,'Var_GiM1',0,'Var_GoalNeuSlot',0,'Var_MoveOk',false,
 'Var_ZielFeld',0,'Var_Eingang',0,'Var_ZielRing',0,'Var_GoalNeu',0,'Var_GIdx',0,'Var_GoalIdx1',0,'Var_GoalIdx2',0,'i',0
].forEach((v,i,a)=>{if(i%2===0)tvar(v,a[i+1]);});

// ---------- Actions ----------
actions.push(
 // Würfel + Zähler
 calc('Act_WurfWert','Math.floor(Math.random()*6)+1','Var_Wurf'),
 prop('Act_WurfBild',{'WuerfelBild.src':'images/madn/w${Var_Wurf}.svg','WuerfelBild.visible':true}),
 prop('Act_PhaseWurf',{Var_Phase:'wurf'}),prop('Act_PhasePick',{Var_Phase:'pick'}),prop('Act_PhaseEnde',{Var_Phase:'ende'}),prop('Act_PhaseSetup',{Var_Phase:'setup'}),
 prop('Act_ZaehlerNull',{Var_Versuche:0,Var_Sechser:0}),
 prop('Act_SechsR',{Var_Sechser:0}),
 calc('Act_SechserPlus','Var_Sechser + 1','Var_Sechser'),
 calc('Act_VersuchePlus','Var_Versuche + 1','Var_Versuche'),
 calc('Act_MoveablePlus','Var_Moveable + 1','Var_Moveable'),
 prop('Act_MoveableNull',{Var_Moveable:0}),
 calc('Act_NaechsterIdx','(Var_CurrPlayer + 1) % Var_PlayerCount','Var_CurrPlayer'),
 // Spieleranzahl / Setup
 prop('Act_Set2',{Var_PlayerCount:2}),prop('Act_Set3',{Var_PlayerCount:3}),prop('Act_Set4',{Var_PlayerCount:4}),
 prop('Act_SetupAus',{'WahlLabel.visible':false,'Btn2.visible':false,'Btn3.visible':false,'Btn4.visible':false,'WuerfelnBtn.visible':true,'NeustartBtn.visible':true}),
 prop('Act_SetupAn',{'WahlLabel.visible':true,'Btn2.visible':true,'Btn3.visible':true,'Btn4.visible':true,'WuerfelnBtn.visible':false,'NeustartBtn.visible':false,'WuerfelBild.visible':false,'StatusLabel.text':''}),
 prop('Act_S0',{Var_CurrPlayer:0,Var_Sechser:0,Var_Versuche:0,Var_Gewaehlt:-1,Var_Moveable:0}),
 // Listen-Init / Figuren
 calc('Act_HomeSlot','56 + i','Var_SlotTmp'),
 ls('Act_RingLeer','RingListe','${i}',-1),
 ls('Act_GoalLeer','GoalListe','${i}',-1),
 rset('Act_FigurHome','${i}','slot','${Var_SlotTmp}'),
 rset('Act_FigurMoveable0','${i}','moveable','false'),
 rset('Act_FigurMoveable1','${i}','moveable','true'),
 rget('Act_FigurSlot','${i}','slot','Var_PSlot'),
 rget('Act_FigurColor','${i}','colorIdx','Var_PColor'),
 // Ziel-Ermittlung
 lget('Act_StartFeld','StartFelder','${Var_PColor}',null,'Var_ZielFeld'),
 lget('Act_EingangFeld','EingangFelder','${Var_PColor}',null,'Var_Eingang'),
 lget('Act_RingBelegt','RingListe','${Var_ZielFeld}',null,'Var_Gefunden'),
 lget('Act_RingBelegt2','RingListe','${Var_ZielRing}',null,'Var_Gefunden'),
 calc('Act_GefundenFarbe','Math.floor(Var_Gefunden / 4)','Var_GefundenFarbe'),
 calc('Act_Dist','(Var_Eingang - Var_PSlot*1 + 40) % 40','Var_Dist'),
 calc('Act_Gi','Var_Wurf - Var_Dist - 1','Var_Gi'),
 calc('Act_GiM1','Var_Gi - 1','Var_GiM1'),
 calc('Act_ZielRing','(Var_PSlot*1 + Var_Wurf*1) % 40','Var_ZielRing'),
 calc('Act_ZielGoal','40 + Var_PColor*4 + Var_Gi*1','Var_ZielGoal'),
 calc('Act_SlotZielI','Var_PSlot - 40 - Var_PColor*4','Var_SlotZiel'),
 calc('Act_GoalNeu','Var_SlotZiel*1 + Var_Wurf*1','Var_GoalNeu'),
 calc('Act_GoalNeuSlot','40 + Var_PColor*4 + Var_GoalNeu*1','Var_GoalNeuSlot'),
 calc('Act_GVon','Var_SlotZiel*1 + 1','Var_GVon'),
 calc('Act_GIdx','Var_PColor*4 + Var_G*1','Var_GIdx'),
 calc('Act_GIdxI','Var_PColor*4 + i*1','Var_GIdx'),
 calc('Act_GToGi','Var_Gi*1','Var_G'),
 lget('Act_GoalBelegt','GoalListe','${Var_GIdx}',null,'Var_Gefunden'),
 prop('Act_WegT',{Var_WegFrei:true}),prop('Act_WegFreiF',{Var_WegFrei:false}),
 // Ziel-Festschreibung (immer per calc -> Zahlen, nie interpolierte Strings)
 calc('Act_ZielStart','Var_ZielFeld*1','Var_Ziel'),calc('Act_ZielRingSet','Var_ZielRing*1','Var_Ziel'),
 calc('Act_ZielGoalSet','40 + Var_GIdx*1','Var_Ziel'),calc('Act_ZielGoalNeuSet','Var_GoalNeuSlot*1','Var_Ziel'),
 calc('Act_CapSet','Var_Gefunden*1','Var_ZielCapture'),
 prop('Act_CapKein',{Var_ZielCapture:-1}),
 prop('Act_ZielNein',{Var_Ziel:-1,Var_ZielCapture:-1}),
 // Zeichnen
 rget('Act_FigSlotX','${i}','slot','Var_SlotTmp'),
 lget('Act_FX','FeldX','${Var_SlotTmp}',null,'Var_X'),
 lget('Act_FY','FeldY','${Var_SlotTmp}',null,'Var_Y'),
 rget('Act_FigName','${i}','figurName','Var_FigurName'),
 rget('Act_FigCol','${i}','colorIdx','Var_PColor'),
 rget('Act_FigMov','${i}','moveable','Var_MoveOk'),
 prop('Act_FigurXY',{'${Var_FigurName}.x':'${Var_X}','${Var_FigurName}.y':'${Var_Y}'}),
 prop('Act_FigurAn',{'${Var_FigurName}.visible':true}),
 prop('Act_FigurAus',{'${Var_FigurName}.visible':false}),
 prop('Act_HlAn',{'${Var_FigurName}.style.borderColor':'#ffff00','${Var_FigurName}.style.borderWidth':6}),
 prop('Act_HlAus',{'${Var_FigurName}.style.borderColor':'transparent'}),
 // Zug ausführen
 rget('Act_GSlot','${Var_Gewaehlt}','slot','Var_PSlot'),
 rget('Act_GColor','${Var_Gewaehlt}','colorIdx','Var_PColor'),
 ls('Act_RingFrei','RingListe','${Var_PSlot}',-1),
 ls('Act_RingSetze','RingListe','${Var_Ziel}','${Var_Gewaehlt}'),
 ls('Act_GoalFrei','GoalListe','${Var_GoalIdx1}',-1),
 ls('Act_GoalSetze','GoalListe','${Var_GoalIdx2}','${Var_Gewaehlt}'),
 calc('Act_GoalIdx1','Var_PSlot - 40','Var_GoalIdx1'),
 calc('Act_GoalIdx2','Var_Ziel - 40','Var_GoalIdx2'),
 calc('Act_OpferSlot','56 + Var_ZielCapture*1','Var_SlotTmp'),
 rset('Act_OpferHome','${Var_ZielCapture}','slot','${Var_SlotTmp}'),
 rset('Act_OpferMov0','${Var_ZielCapture}','moveable','false'),
 rset('Act_MichNeu','${Var_Gewaehlt}','slot','${Var_Ziel}'),
 rset('Act_MichMov0','${Var_Gewaehlt}','moveable','false'),
 lget('Act_GoalCheck','GoalListe','${i}',null,'Var_Gefunden'),
 calc('Act_GoalCountPlus','Var_GoalCount + 1','Var_GoalCount'),
 prop('Act_GoalCount0',{Var_GoalCount:0}),
 prop('Act_Gewinn',{'StatusLabel.text':'🏆 ${Var_FarbName} hat gewonnen!','WuerfelnBtn.visible':false}),
 // Klick-Auflösung
 act('Act_ClickIdx','record_index',{target:'self',list:'FigurenListe',resultVariable:'Var_Gewaehlt'}),
 rget('Act_ClickColor','${Var_Gewaehlt}','colorIdx','Var_PColor'),
 rget('Act_ClickMov','${Var_Gewaehlt}','moveable','Var_MoveOk'),
 // Farbnamen + Status
 prop('Act_NameRot',{Var_FarbName:'Rot'}),prop('Act_NameBlau',{Var_FarbName:'Blau'}),prop('Act_NameGruen',{Var_FarbName:'Grün'}),prop('Act_NameGelb',{Var_FarbName:'Gelb'}),
 prop('Act_SpielerDran',{'StatusLabel.text':'${Var_FarbName} ist am Zug — würfeln!'}),
 prop('Act_SechsVerfall',{'StatusLabel.text':'${Var_FarbName}: 3× Sechs — Zug verfällt!'}),
 prop('Act_KeinZug',{'StatusLabel.text':'${Var_FarbName}: kein Zug möglich.'}),
 prop('Act_Nochmal',{'StatusLabel.text':'${Var_FarbName}: kein Zug — nochmal würfeln (Versuch ${Var_Versuche}/3)'}),
 prop('Act_Waehlen',{'StatusLabel.text':'${Var_FarbName}: ${Var_Wurf} gewürfelt — Figur wählen!'}),
 prop('Act_Nochmal6',{'StatusLabel.text':'${Var_FarbName}: Sechs — nochmal würfeln!'}),
 prop('Act_Schlug',{'StatusLabel.text':'${Var_FarbName} schlägt eine Figur!'}),
 prop('Act_PotF',{Var_Potential:false}),prop('Act_PotT',{Var_Potential:true}),
 calc('Act_GiPot','Var_PSlot - 40 - Var_PColor*4','Var_Gi'),
);

// ---------- Tasks ----------
const setzeFarbName=[C('${Var_CurrPlayer}',0,[A('Act_NameRot')]),C('${Var_CurrPlayer}',1,[A('Act_NameBlau')]),C('${Var_CurrPlayer}',2,[A('Act_NameGruen')]),C('${Var_CurrPlayer}',3,[A('Act_NameGelb')])];
// Ringziel prüfen: RingListe[Zielring] frei | gegner→schlagen | eigen→illegal
const ringZielPruefen=(ringListeAction,zielAktion)=>[
 ringListeAction,
 C('${Var_Gefunden}',-1,[zielAktion,A('Act_CapKein')],[
  A('Act_GefundenFarbe'),
  C('${Var_GefundenFarbe}','${Var_PColor}',[A('Act_ZielNein')],[zielAktion,A('Act_CapSet')],{rType:'variable'})
 ])
];

tasks.push(
 // Ziel-Ermittlung: Var_PSlot/Var_PColor/Var_Wurf → Var_Ziel (>=0), Var_ZielCapture
 task('ZielPruefen',[
  A('Act_ZielNein'),
  // Home (slot > 55): nur mit 6 aufs Startfeld
  C('${Var_PSlot}',55,[
   C('${Var_Wurf}',6,[
    A('Act_StartFeld'),...ringZielPruefen(A('Act_RingBelegt'),A('Act_ZielStart'))
   ])
  ],[],{op:'>'}),
  // Ziel (40..55): exakt + kein Überspringen eigener Steine
  C('${Var_PSlot}',39,[
   C('${Var_PSlot}',55,[
    A('Act_SlotZielI'),A('Act_GoalNeu'),
    C('${Var_GoalNeu}',4,[
     A('Act_GoalNeuSlot'),A('Act_GVon'),A('Act_WegT'),
     FOR('Var_G','${Var_GVon}','${Var_GoalNeu}',[
      A('Act_GIdx'),A('Act_GoalBelegt'),
      C('${Var_Gefunden}',-1,[A('Act_WegFreiF')],[],{op:'!='})
     ]),
     C('${Var_WegFrei}',true,[A('Act_ZielGoalNeuSet')])
    ],[],{op:'<'})
   ],[],{op:'<'})
  ],[],{op:'>'}),
  // Ring (0..39)
  C('${Var_PSlot}',40,[
   A('Act_EingangFeld'),A('Act_Dist'),
   C('${Var_Wurf}','${Var_Dist}',[
    // Einzug ins Ziel: gi = überschüssige Schritte - 1
    A('Act_Gi'),
    C('${Var_Gi}',4,[
     A('Act_GiM1'),A('Act_WegT'),
     FOR('Var_G',0,'${Var_GiM1}',[
      A('Act_GIdx'),A('Act_GoalBelegt'),
      C('${Var_Gefunden}',-1,[A('Act_WegFreiF')],[],{op:'!='})
     ]),
     // Zielzelle gi selbst frei?
     A('Act_GToGi'),A('Act_GIdx'),A('Act_GoalBelegt'),
     C('${Var_Gefunden}',-1,[A('Act_WegFreiF')],[],{op:'!='}),
     C('${Var_WegFrei}',true,[A('Act_ZielGoalSet')])
    ],[],{op:'<'})
   ],[
    // normaler Ringzug
    A('Act_ZielRing'),...ringZielPruefen(A('Act_RingBelegt2'),A('Act_ZielRingSet'))
   ],{op:'>',rType:'variable'})
  ],[],{op:'<'})
 ],'Ermittelt Var_Ziel/-Capture für (Var_PSlot, Var_PColor, Var_Wurf).'),

 task('SpielStarten',[
  A('Act_SetupAus'),
  FOR('i',0,39,[A('Act_RingLeer')]),
  FOR('i',0,15,[A('Act_GoalLeer')]),
  FEACH('item','i',[A('Act_HomeSlot'),A('Act_FigurHome'),A('Act_FigurMoveable0')]),
  A('Act_S0'),A('Act_PhaseWurf'),
  ...setzeFarbName,A('Act_SpielerDran'),T('AlleFigurenPositionieren')
 ],'Figuren ins Home, Listen leeren, Rot beginnt.'),

 task('AlleFigurenPositionieren',[
  FEACH('item','i',[
   A('Act_FigSlotX'),A('Act_FX'),A('Act_FY'),A('Act_FigName'),A('Act_FigCol'),A('Act_FigurXY'),A('Act_FigMov'),
   C('${Var_PColor}','${Var_PlayerCount}',[A('Act_FigurAn')],[A('Act_FigurAus')],{op:'<',rType:'variable'}),
   C('${Var_MoveOk}',true,[A('Act_HlAn')],[A('Act_HlAus')])
  ])
 ],'Figuren anhand ihrer Slots platzieren + Zug-Highlight.'),

 task('Wuerfeln',[
  C('${Var_Phase}','wurf',[
   A('Act_WurfWert'),A('Act_WurfBild'),
   C('${Var_Wurf}',6,[A('Act_SechserPlus')],[A('Act_SechsR')]),
   C('${Var_Sechser}',3,[
    A('Act_SechsVerfall'),T('NaechsterSpieler')
   ],[
    T('ZuegeErmitteln')
   ],{op:'>='})
  ])
 ],'Würfeln, 3×6-Regel, dann Züge ermitteln.'),

 task('ZuegeErmitteln',[
  A('Act_MoveableNull'),
  FEACH('item','i',[
   A('Act_FigurColor'),
   C('${Var_PColor}','${Var_CurrPlayer}',[
    A('Act_FigurMoveable0'),A('Act_FigurSlot'),T('ZielPruefen'),
    C('${Var_Ziel}',-1,[A('Act_FigurMoveable1'),A('Act_MoveablePlus')],[],{op:'!='})
   ],[],{rType:'variable'})
  ]),
  T('AlleFigurenPositionieren'),
  C('${Var_Moveable}',0,[
   A('Act_Waehlen'),A('Act_PhasePick')
  ],[
   T('PotentialPruefen')
  ],{op:'>'})
 ],'Alle eigenen Figuren prüfen; movable markieren oder Zugausfall.'),

 task('PotentialPruefen',[
  A('Act_PotF'),
  FEACH('item','i',[
   A('Act_FigurColor'),
   C('${Var_PColor}','${Var_CurrPlayer}',[
    A('Act_FigurSlot'),
    // aktiv: auf Ring (<=39) ODER im Ziel aber nicht auf letztem Feld
    C('${Var_PSlot}',55,[],[
     C('${Var_PSlot}',39,[A('Act_PotT')],[
      A('Act_GiPot'),C('${Var_Gi}',3,[A('Act_PotT')],[],{op:'<'})
     ],{op:'<='})
    ],{op:'>'})
   ],[],{rType:'variable'})
  ]),
  C('${Var_Potential}',true,[
   A('Act_KeinZug'),T('NaechsterSpieler')
  ],[
   A('Act_VersuchePlus'),
   C('${Var_Versuche}',3,[A('Act_KeinZug'),T('NaechsterSpieler')],[A('Act_Nochmal')],{op:'>='})
  ])
 ],'Kein Zug: Potential→Zugwechsel, sonst bis zu 3 Wurfversuche.'),

 task('FigurGewaehlt',[
  C('${Var_Phase}','pick',[
   A('Act_ClickIdx'),A('Act_ClickColor'),A('Act_ClickMov'),
   C('${Var_PColor}','${Var_CurrPlayer}',[
    C('${Var_MoveOk}',true,[T('ZugAusfuehren')])
   ],[],{rType:'variable'})
  ])
 ],'Klick auf Figur: Phase pick + eigene Farbe + bewegbar → Zug ausführen.'),

 task('ZugAusfuehren',[
  A('Act_GSlot'),A('Act_GColor'),T('ZielPruefen'),
  C('${Var_Ziel}',-1,[
   // Schlagen
   C('${Var_ZielCapture}',-1,[
    A('Act_OpferSlot'),A('Act_OpferHome'),A('Act_OpferMov0'),A('Act_Schlug')
   ],[],{op:'!='}),
   // Alten Platz freigeben
   C('${Var_PSlot}',39,[A('Act_RingFrei')],[],{op:'<='}),
   C('${Var_PSlot}',39,[
    C('${Var_PSlot}',55,[A('Act_GoalIdx1'),A('Act_GoalFrei')],[],{op:'<'})
   ],[],{op:'>'}),
   // Neue Position belegen
   C('${Var_Ziel}',39,[A('Act_RingSetze')],[],{op:'<='}),
   C('${Var_Ziel}',39,[
    C('${Var_Ziel}',55,[A('Act_GoalIdx2'),A('Act_GoalSetze')],[],{op:'<'})
   ],[],{op:'>'}),
   A('Act_MichNeu'),
   FEACH('item','i',[A('Act_FigurMoveable0')]),
   // Gewinnprüfung: eigene 4 Zielslots belegt?
   A('Act_GoalCount0'),
   FOR('i',0,3,[A('Act_GIdxI'),A('Act_GoalBelegt'),C('${Var_Gefunden}',-1,[A('Act_GoalCountPlus')],[],{op:'!='})]),
   T('AlleFigurenPositionieren'),
   C('${Var_GoalCount}',4,[A('Act_PhaseEnde'),A('Act_Gewinn')],[
    C('${Var_Wurf}',6,[A('Act_Nochmal6'),A('Act_PhaseWurf')],[T('NaechsterSpieler')])
   ],{op:'>='})
  ],[],{op:'!='})
 ],'Zug anwenden: schlagen, belegen, Gewinn prüfen, Zugrotation/6er.'),

 task('NaechsterSpieler',[
  A('Act_NaechsterIdx'),A('Act_ZaehlerNull'),A('Act_PhaseWurf'),
  ...setzeFarbName,A('Act_SpielerDran')
 ],'Zugwechsel: nächster Spieler, Zähler resetten.'),

 task('Neustart',[
  A('Act_SetupAn'),A('Act_PhaseSetup'),
  FEACH('item','i',[A('Act_FigurAus')])
 ],'Zurück zur Spielerwahl.'),

 task('Anzahl2',[A('Act_Set2'),T('SpielStarten')],'2 Spieler'),
 task('Anzahl3',[A('Act_Set3'),T('SpielStarten')],'3 Spieler'),
 task('Anzahl4',[A('Act_Set4'),T('SpielStarten')],'4 Spieler')
);

// Variablen NUR als Objekte in stage.objects (ElinsMemory-Konvention).
// stage.variables-Duplikate wuerden von getMergedStageData als eigene Objekte
// hydriert: objects.find (Schreiben) trifft das Original, objectNameMap (Lesen)
// das Duplikat — Writes gehen dann an gelesenen Werten vorbei.
objects.push(...ALLVARS);

const project={
 meta:{id:'madn',name:'Madn',description:'Mensch ärgere dich nicht — deklaratives GCS-Brettspiel (2-4 Spieler, Hotseat). Portierung des remote-games madn.',version:'1.0'},
 schemaVersion:1,
 activeStageId:'main',
 stages:[{id:'main',name:'Hauptstage',type:'main',grid:{cols:64,rows:40,cellSize:20,snapToGrid:true,visible:true,backgroundColor:'#f5f5f5'},objects,actions,tasks,variables,events:{},flow:{}}]
};
fs.writeFileSync(path.join(root,'game-server/public/projects/Madn.json'),JSON.stringify(project,null,2)+'\n');
// Upload-Bundle: CMS liefert Spielmedien nur aus ZIP-Bundles unter /play/<key>/ aus.
// Entspricht unpackGameBundle: genau eine .json + Medien unter ihren relativen Pfaden.
const {zipSync}=require('fflate');
const bundle={'Madn.json':Buffer.from(JSON.stringify(project))};
for(const f of fs.readdirSync(imgDir))bundle['images/madn/'+f]=fs.readFileSync(path.join(imgDir,f));
const distDir=path.join(root,'dist');fs.mkdirSync(distDir,{recursive:true});
fs.writeFileSync(path.join(distDir,'Madn.zip'),zipSync(bundle));
// Editor-Run (Vite) bedient Medien aus public/ am Repo-Root — Kopien dorthin,
// damit das Projekt auch im Editor lauffähig ist.
const editorImgDir=path.join(root,'public/images/madn');fs.mkdirSync(editorImgDir,{recursive:true});
for(const f of fs.readdirSync(imgDir))fs.copyFileSync(path.join(imgDir,f),path.join(editorImgDir,f));
fs.copyFileSync(path.join(root,'game-server/public/projects/Madn.json'),path.join(root,'public/projects/Madn.json'));
console.log('Madn.json:',objects.length,'Objekte,',tasks.length,'Tasks,',actions.length,'Actions | Bundle: dist/Madn.zip | Editor-Kopien: public/');
