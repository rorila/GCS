const fs=require('node:fs'),path=require('node:path');
const {zipSync}=require('fflate');
const root=path.resolve(__dirname,'..');
const imgDir=path.join(root,'game-server/public/images/maumau');

const SUITS=[
 {name:'Herz',file:'herz',color:'#c0392b'},
 {name:'Karo',file:'karo',color:'#e67e22'},
 {name:'Pik',file:'pik',color:'#2471a3'},
 {name:'Kreuz',file:'kreuz',color:'#229954'}
];
const RANKS=[
 {rank:7,label:'7'},{rank:8,label:'8'},{rank:9,label:'9'},{rank:10,label:'10'},
 {rank:11,label:'B'},{rank:12,label:'D'},{rank:13,label:'K'},{rank:14,label:'A'}
];
const PLAYER_COLORS=['#dc143c','#1e90ff','#228b22','#ffd700'];
const PLAYER_NAMES=['Spieler 1','Spieler 2','Spieler 3','Spieler 4'];
const CARD_W=3.1,CARD_H=4.5;

function cardSvg(suit,rank){
 return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100"><rect x="2" y="2" width="66" height="96" rx="8" fill="#fffdf7" stroke="#333" stroke-width="3"/><rect x="8" y="8" width="54" height="84" rx="6" fill="${suit.color}" fill-opacity="0.12"/><text x="10" y="24" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="${suit.color}">${rank.label}</text><text x="35" y="60" text-anchor="middle" font-family="Arial,sans-serif" font-size="34" font-weight="700" fill="${suit.color}">${rank.label}</text><text x="35" y="82" text-anchor="middle" font-family="Arial,sans-serif" font-size="13" font-weight="700" fill="${suit.color}">${suit.name}</text></svg>`;
}
const backSvg=()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100"><rect x="2" y="2" width="66" height="96" rx="8" fill="#2c3e50" stroke="#17202a" stroke-width="3"/><rect x="9" y="9" width="52" height="82" rx="5" fill="#34495e" stroke="#85c1e9" stroke-width="2" stroke-dasharray="5,4"/><text x="35" y="57" text-anchor="middle" font-family="Arial,sans-serif" font-size="18" font-weight="700" fill="#ecf0f1">Mau</text></svg>`;
const pileSvg=()=>`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 70 100"><rect x="3" y="3" width="64" height="94" rx="8" fill="none" stroke="#7f8c8d" stroke-width="3" stroke-dasharray="7,5"/><text x="35" y="55" text-anchor="middle" font-family="Arial,sans-serif" font-size="14" fill="#7f8c8d">Ablage</text></svg>`;

let n=0;
const uid=()=>`maumau-${(++n).toString(36)}-${Math.random().toString(36).slice(2,7)}`;
const objects=[],actions=[],tasks=[],variables=[],ALLVARS=[];
const obj=(cls,name,more)=>({className:cls,id:uid(),name,scope:'stage',x:0,y:0,width:3,height:3,visible:true,zIndex:1,align:'NONE',draggable:false,style:{},...more});
const tvar=(name,def)=>{const v={className:'TVariable',id:uid(),name,scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,draggable:false,description:'',visible:true,x:60,y:ALLVARS.length%38,width:5,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{color:'#000',backgroundColor:'#d1c4e9'},value:def,defaultValue:def};ALLVARS.push(v);return v;};
const tlist=(name,items)=>({className:'TListVariable',id:uid(),name,scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,draggable:false,description:'',visible:true,x:60,y:2,width:5,height:2,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,style:{backgroundColor:'#9c27b0'},items,value:items.slice(),defaultValue:items.slice()});
const act=(name,type,more)=>({id:uid(),type,name,showDetails:false,...more});
const prop=(name,changes)=>act(name,'property',{changes});
const calc=(name,formula,resultVariable)=>act(name,'calculate',{formula,resultVariable});
const lget=(name,target,index,field,rv)=>act(name,'list_get',{target,index,...(field?{field}:{}) ,resultVariable:rv});
const lset=(name,target,index,value)=>act(name,'list_set',{target,index,value});
const lpush=(name,target,value)=>act(name,'list_push',{target,value});
const lpop=(name,target,resultVariable)=>act(name,'list_pop',{target,resultVariable});
const lclear=(name,target)=>act(name,'list_clear',{target});
const lremove=(name,target,index,resultVariable)=>act(name,'list_remove',{target,index,resultVariable});
const llen=(name,target,resultVariable)=>act(name,'list_length',{target,resultVariable});
const lshuffle=(name,target)=>act(name,'list_shuffle',{target});
const rget=(name,target,field,resultVariable)=>act(name,'record_get',{target:String(target),list:'KartenListe',field,resultVariable});
const rset=(name,target,field,value)=>act(name,'record_set',{target:String(target),list:'KartenListe',field,value});
const rreset=(name,field,value)=>act(name,'record_reset',{list:'KartenListe',field,...(value!==undefined?{value}:{})});
const A=name=>({type:'action',name});
const T=name=>({type:'task',name});
const C=(l,r,body,elseBody=[],opts={})=>({type:'condition',condition:{leftValue:l,rightValue:r,...(opts.op?{operator:opts.op}:{}),...(opts.rType?{rightType:opts.rType}:{})},body,elseBody});
const FOR=(it,from,to,body)=>({type:'for',iteratorVar:it,from,to,body,name:'for'});
const WHILE=(condition,body)=>({type:'while',condition,body,name:'while'});
const FEACH=(sourceArray,itemVar,indexVar,body)=>({type:'foreach',sourceArray,itemVar,indexVar,body,name:'foreach'});
const task=(name,seq,description)=>({id:uid(),name,description,actionSequence:seq,scope:'stage'});

function createMauMauProject(){
 const media={};
 for(const suit of SUITS)for(const rank of RANKS)media[`karte-${suit.file}-${rank.label}.svg`]=cardSvg(suit,rank);
 media['back.svg']=backSvg();
 media['ablage.svg']=pileSvg();

 objects.push(obj('TLabel','TitelLabel',{x:2,y:1,width:34,height:3,text:'MauMau',style:{fontSize:27,fontWeight:'700',color:'#273746',backgroundColor:'transparent'}}));
 objects.push(obj('TLabel','WahlLabel',{x:42,y:7,width:18,height:2,text:'Wie viele Spieler?',style:{fontSize:16,color:'#34495e',backgroundColor:'transparent'}}));
 const mkBtn=(name,text,x,y,ev,vis,color='#1976d2')=>obj('TButton',name,{x,y,width:7,height:3,text,visible:vis!==false,zIndex:8,events:{onClick:ev},style:{color:'#fff',fontSize:15,fontWeight:'700',backgroundColor:color,borderColor:'#17202a',borderWidth:2,borderRadius:8}});
 objects.push(mkBtn('Btn2','2 Spieler',42,10,'Anzahl2'),mkBtn('Btn3','3 Spieler',50,10,'Anzahl3'),mkBtn('Btn4','4 Spieler',58,10,'Anzahl4'));
 objects.push(mkBtn('NeustartBtn','Neu starten',55,1,'Neustart',false,'#616a6b'));
 objects.push(obj('TLabel','StatusLabel',{x:20,y:8,width:26,height:4,text:'',zIndex:6,style:{fontSize:15,fontWeight:'700',color:'#1b2631',backgroundColor:'transparent'}}));
 objects.push(obj('TLabel','HandInfoLabel',{x:2,y:7,width:18,height:3,text:'',style:{fontSize:13,color:'#34495e',backgroundColor:'transparent'}}));
 objects.push(obj('TImage','StapelBild',{x:24,y:15,width:CARD_W,height:CARD_H,src:'images/maumau/back.svg',visible:false,zIndex:4,objectFit:'contain',events:{onClick:'Nachziehen',onTouchStart:'Nachziehen'}}));
 objects.push(obj('TImage','AblagePlatz',{x:31,y:15,width:CARD_W,height:CARD_H,src:'images/maumau/ablage.svg',visible:false,zIndex:1,objectFit:'contain'}));
 objects.push(mkBtn('WunschHerz','Herz',42,16,'WunschHerz',false,SUITS[0].color));
 objects.push(mkBtn('WunschKaro','Karo',50,16,'WunschKaro',false,SUITS[1].color));
 objects.push(mkBtn('WunschPik','Pik',42,20,'WunschPik',false,SUITS[2].color));
 objects.push(mkBtn('WunschKreuz','Kreuz',50,20,'WunschKreuz',false,SUITS[3].color));

 const cardConfig={padding:0,borderRadius:8,backgroundColor:'transparent',borderColor:'transparent',borderWidth:0};
 const zone=(name,x,y,width,height,orientation,searchValue,sortField='handIndex')=>objects.push(obj('TCardZone',name,{
  x,y,width,height,visible:false,zIndex:10,displayMode:'cards',dataSource:'KartenListe',keyField:'cardId',
  itemWidth:CARD_W,itemHeight:CARD_H,gap:0.4,searchProperty:'owner',searchValue,sortField,imageField:'image',faceUpField:'faceUp',highlightField:'playable',
  src:'images/maumau/back.svg',orientation,selectionColor:'#ffff00',cardConfig,
  events:orientation==='stack'?{}:{onRowClick:'KarteGewaehlt'},
  style:{backgroundColor:'transparent',borderColor:'transparent',borderWidth:0}
 }));
 zone('Hand0Zone',2,31,58,7,'horizontal',0);
 zone('Hand1Zone',6,2.5,48,7,'horizontal',1);
 zone('Hand2Zone',0,9,6.5,22,'vertical',2);
 zone('Hand3Zone',57.5,9,6.5,22,'vertical',3);
 zone('AblageZone',30.5,15,5,6,'stack',4,'pileIndex');

 const cardIds=[],recordData={},data=[];
 let cardIdx=0;
 for(const suit of SUITS)for(const rank of RANKS){
  const cardId=`Karte_${String(cardIdx).padStart(2,'0')}`;
  const image=`images/maumau/karte-${suit.file}-${rank.label}.svg`;
  cardIds.push(cardId);
  recordData[cardId]={cardIdx,suit:SUITS.indexOf(suit),suitName:suit.name,rank:rank.rank,rankName:rank.label,owner:-1,handIndex:-1,pileIndex:-1,playable:false,faceUp:false,cardName:cardId,cardId,image};
  data.push({index:cardIdx,objectId:cardId,name:cardId,...recordData[cardId]});
  cardIdx++;
 }
 objects.push({className:'TObjectList',id:uid(),name:'KartenListe',scope:'stage',isVariable:true,isHiddenInRun:true,isManagedInSidepanel:true,visible:true,x:58,y:0,width:5,height:2,zIndex:0,rotation:0,align:'NONE',style:{},
  items:cardIds,
  fields:[
   {name:'cardIdx',type:'number',defaultValue:-1},{name:'suit',type:'number',defaultValue:-1},{name:'suitName',type:'string',defaultValue:''},
   {name:'rank',type:'number',defaultValue:0},{name:'rankName',type:'string',defaultValue:''},{name:'owner',type:'number',defaultValue:-1},
   {name:'handIndex',type:'number',defaultValue:-1},{name:'pileIndex',type:'number',defaultValue:-1},{name:'playable',type:'boolean',defaultValue:false},
   {name:'faceUp',type:'boolean',defaultValue:false},{name:'cardName',type:'string',defaultValue:''},{name:'cardId',type:'string',defaultValue:''},{name:'image',type:'string',defaultValue:''}
  ],recordData,data});

 for(const l of[
  tlist('StapelBasis',cardIds),tlist('StapelListe',[]),tlist('AblageListe',[]),
  tlist('HandCounts',[0,0,0,0]),tlist('SpielerNamen',PLAYER_NAMES),tlist('Farben',PLAYER_COLORS)
 ])objects.push(l);

 [
  'Var_PlayerCount',0,'Var_CurrPlayer',0,'Var_NextPlayer',0,'Var_Richtung',1,'Var_Skip',0,
  'Var_Phase','setup','Var_ZiehPflicht',0,'Var_Wunsch',-1,'Var_AblageSuit',-1,'Var_AblageRank',0,
  'Var_CardIdx',-1,'Var_KarteId','','Var_CardOwner',-1,'Var_CardSuit',-1,'Var_CardRank',0,
  'Var_PlayedSuit',-1,'Var_PlayedRank',0,
  'Var_CardPlayable',false,'Var_CardFaceUp',false,'Var_Spielbar',false,
  'Var_PlayableCount',0,'Var_HandIndex',0,'Var_NextHandIndex',0,'Var_StapelLen',0,'Var_AblageLen',0,
  'Var_X',0,'Var_Y',0,'Var_Z',0,'Var_SpielerName','','Var_HandInfo','','Var_DrawTotal',0,
  'Var_LastPlayer',0,'i',0,'p',0,'k',0,'item',''
 ].forEach((v,i,a)=>{if(i%2===0)tvar(v,a[i+1]);});

 actions.push(
  prop('Act_Set2',{Var_PlayerCount:2}),prop('Act_Set3',{Var_PlayerCount:3}),prop('Act_Set4',{Var_PlayerCount:4}),
  calc('Act_LastPlayer','Var_PlayerCount - 1','Var_LastPlayer'),
  prop('Act_SetupAus',{'WahlLabel.visible':false,'Btn2.visible':false,'Btn3.visible':false,'Btn4.visible':false,'NeustartBtn.visible':true,'StapelBild.visible':true,'AblagePlatz.visible':true,'AblageZone.visible':true,'Hand0Zone.visible':false,'Hand1Zone.visible':false,'Hand2Zone.visible':false,'Hand3Zone.visible':false}),
  prop('Act_SetupAn',{'WahlLabel.visible':true,'Btn2.visible':true,'Btn3.visible':true,'Btn4.visible':true,'NeustartBtn.visible':false,'StapelBild.visible':false,'AblagePlatz.visible':false,'AblageZone.visible':false,'Hand0Zone.visible':false,'Hand1Zone.visible':false,'Hand2Zone.visible':false,'Hand3Zone.visible':false,'StatusLabel.text':'','HandInfoLabel.text':''}),
  prop('Act_Zonen2',{'Hand0Zone.visible':true,'Hand1Zone.visible':true,'Hand2Zone.visible':false,'Hand3Zone.visible':false}),
  prop('Act_Zonen3',{'Hand0Zone.visible':true,'Hand1Zone.visible':true,'Hand2Zone.visible':true,'Hand3Zone.visible':false}),
  prop('Act_Zonen4',{'Hand0Zone.visible':true,'Hand1Zone.visible':true,'Hand2Zone.visible':true,'Hand3Zone.visible':true}),
  prop('Act_WunschAn',{'WunschHerz.visible':true,'WunschKaro.visible':true,'WunschPik.visible':true,'WunschKreuz.visible':true}),
  prop('Act_WunschAus',{'WunschHerz.visible':false,'WunschKaro.visible':false,'WunschPik.visible':false,'WunschKreuz.visible':false}),
  prop('Act_StartWerte',{Var_CurrPlayer:0,Var_NextPlayer:0,Var_Richtung:1,Var_Skip:0,Var_ZiehPflicht:0,Var_Wunsch:-1,Var_AblageSuit:-1,Var_AblageRank:0,Var_PlayableCount:0}),
  prop('Act_PhaseSetup',{Var_Phase:'setup'}),prop('Act_PhasePlay',{Var_Phase:'play'}),prop('Act_PhaseDraw',{Var_Phase:'draw'}),prop('Act_PhaseWunsch',{Var_Phase:'wish'}),prop('Act_PhaseEnde',{Var_Phase:'ende'}),
  lclear('Act_StapelLeer','StapelListe'),lclear('Act_AblageLeer','AblageListe'),
  lpush('Act_StapelPush','StapelListe','${item}'),lshuffle('Act_StapelMischen','StapelListe'),
  lpop('Act_StapelPop','StapelListe','Var_KarteId'),lpop('Act_StartPop','StapelListe','Var_KarteId'),
  llen('Act_StapelLen','StapelListe','Var_StapelLen'),llen('Act_AblageLen','AblageListe','Var_AblageLen'),
  lremove('Act_AblageAlt','AblageListe',0,'Var_KarteId'),lpush('Act_StapelAltPush','StapelListe','${Var_KarteId}'),
  lset('Act_Count0','HandCounts',0,0),lset('Act_Count1','HandCounts',1,0),lset('Act_Count2','HandCounts',2,0),lset('Act_Count3','HandCounts',3,0),
  lget('Act_HandCount','HandCounts','${Var_CurrPlayer}',null,'Var_HandIndex'),
  lget('Act_HandCountP','HandCounts','${p}',null,'Var_HandIndex'),
  calc('Act_HandIndexPlus','Var_HandIndex + 1','Var_NextHandIndex'),
  lset('Act_HandCountSet','HandCounts','${Var_CurrPlayer}','${Var_NextHandIndex}'),
  lset('Act_HandCountSetP','HandCounts','${p}','${Var_NextHandIndex}'),
  lget('Act_CountByOwner','HandCounts','${Var_CardOwner}',null,'Var_HandIndex'),
  calc('Act_HandIndexNum','Var_HandIndex * 1','Var_HandIndex'),
  lset('Act_CountByOwnerSet','HandCounts','${Var_CardOwner}','${Var_NextHandIndex}'),
  rreset('Act_OwnerReset','owner',-1),rreset('Act_HandIdxReset','handIndex',-1),rreset('Act_PileReset','pileIndex',-1),rreset('Act_PlayableReset','playable',false),rreset('Act_FaceUpReset','faceUp',false),
  rset('Act_OwnerDeck','${Var_KarteId}','owner',-1),rset('Act_HandIdxLeer','${Var_KarteId}','handIndex',-1),rset('Act_PileLeer','${Var_KarteId}','pileIndex',-1),rset('Act_KarteNichtSpielbar','${Var_KarteId}','playable',false),
  rset('Act_OwnerCurr','${Var_KarteId}','owner','${Var_CurrPlayer}'),rset('Act_HandIdxCurr','${Var_KarteId}','handIndex','${Var_HandIndex}'),
  rset('Act_OwnerP','${Var_KarteId}','owner','${p}'),rset('Act_HandIdxP','${Var_KarteId}','handIndex','${Var_HandIndex}'),
  rset('Act_OwnerAblage','${Var_KarteId}','owner',4),rset('Act_PileSet','${Var_KarteId}','pileIndex','${Var_AblageLen}'),
  rget('Act_KarteSuit','${Var_KarteId}','suit','Var_CardSuit'),rget('Act_KarteRank','${Var_KarteId}','rank','Var_CardRank'),
  rget('Act_KarteIdxSuit','${i}','suit','Var_CardSuit'),rget('Act_KarteIdxRank','${i}','rank','Var_CardRank'),
  rget('Act_KarteIdxOwner','${i}','owner','Var_CardOwner'),rget('Act_KarteIdxHand','${i}','handIndex','Var_HandIndex'),
  rget('Act_KarteIdxPlayable','${i}','playable','Var_CardPlayable'),
  rset('Act_KarteIdxSpielbarSet','${i}','playable','${Var_Spielbar}'),rset('Act_KarteIdxUnspielbar','${i}','playable',false),
  rset('Act_KarteIdxHandSet','${i}','handIndex','${Var_HandIndex}'),rset('Act_KarteIdxFaceUp','${i}','faceUp','${Var_CardFaceUp}'),
  calc('Act_FaceUpCalc','Var_CardOwner === 4 || Var_CardOwner === Var_CurrPlayer','Var_CardFaceUp'),
  act('Act_ClickIdx','variable',{source:'self',sourceProperty:'selectedRecord.cardIdx',variableName:'Var_CardIdx'}),
  rget('Act_ClickOwner','${Var_CardIdx}','owner','Var_CardOwner'),rget('Act_ClickSuit','${Var_CardIdx}','suit','Var_CardSuit'),
  rget('Act_ClickRank','${Var_CardIdx}','rank','Var_CardRank'),rget('Act_ClickId','${Var_CardIdx}','cardId','Var_KarteId'),
  rget('Act_ClickPlayable','${Var_CardIdx}','playable','Var_CardPlayable'),
  prop('Act_PlayedMerken',{Var_PlayedSuit:'${Var_CardSuit}',Var_PlayedRank:'${Var_CardRank}'}),
  calc('Act_SpielbarCalc','Var_CardRank === 11 || (Var_Wunsch >= 0 ? Var_CardSuit === Var_Wunsch : (Var_CardSuit === Var_AblageSuit || Var_CardRank === Var_AblageRank))','Var_Spielbar'),
  prop('Act_PlayableNull',{Var_PlayableCount:0}),calc('Act_PlayablePlus','Var_PlayableCount + 1','Var_PlayableCount'),
  calc('Act_ZiehPflichtPlus','Var_ZiehPflicht + 2','Var_ZiehPflicht'),prop('Act_ZiehPflicht0',{Var_ZiehPflicht:0}),
  prop('Act_Skip1',{Var_Skip:1}),prop('Act_Skip0',{Var_Skip:0}),
  calc('Act_NextPlayer','(Var_CurrPlayer + Var_Richtung * (1 + Var_Skip) + Var_PlayerCount * 2) % Var_PlayerCount','Var_NextPlayer'),
  calc('Act_PlayerUebernehmen','Var_NextPlayer * 1','Var_CurrPlayer'),
  prop('Act_WunschHerz',{Var_Wunsch:0}),prop('Act_WunschKaro',{Var_Wunsch:1}),prop('Act_WunschPik',{Var_Wunsch:2}),prop('Act_WunschKreuz',{Var_Wunsch:3}),
  prop('Act_TopWerte',{Var_AblageSuit:'${Var_CardSuit}',Var_AblageRank:'${Var_CardRank}',Var_Wunsch:-1}),
  lpush('Act_AblagePush','AblageListe','${Var_KarteId}'),
  lget('Act_SpielerName','SpielerNamen','${Var_CurrPlayer}',null,'Var_SpielerName'),
  calc('Act_HandInfo','"Karten: " + HandCounts[0] + " | " + HandCounts[1] + (Var_PlayerCount > 2 ? " | " + HandCounts[2] : "") + (Var_PlayerCount > 3 ? " | " + HandCounts[3] : "")','Var_HandInfo'),
  prop('Act_HandInfoAn',{'HandInfoLabel.text':'${Var_HandInfo}'}),
  prop('Act_StatusZug',{'StatusLabel.text':'${Var_SpielerName} ist am Zug — Karte spielen oder ziehen.'}),
  prop('Act_StatusZiehen',{'StatusLabel.text':'${Var_SpielerName} muss ${Var_ZiehPflicht} Karten ziehen.'}),
  prop('Act_StatusWunsch',{'StatusLabel.text':'${Var_SpielerName}: Farbe wählen!'}),
  prop('Act_StatusUngueltig',{'StatusLabel.text':'Diese Karte passt nicht — Farbe, Wert oder Bube wählen.'}),
  prop('Act_StatusLeer',{'StatusLabel.text':'Der Stapel ist leer.'}),
  prop('Act_Gewinn',{'StatusLabel.text':'🏆 ${Var_SpielerName} hat gewonnen!','StapelBild.visible':false}),
  calc('Act_DrawTotal','Var_ZiehPflicht * 1','Var_DrawTotal')
 );

 tasks.push(
  task('SpielStarten',[
   A('Act_SetupAus'),A('Act_LastPlayer'),A('Act_StartWerte'),A('Act_PhasePlay'),A('Act_WunschAus'),
   A('Act_StapelLeer'),A('Act_AblageLeer'),
   A('Act_OwnerReset'),A('Act_HandIdxReset'),A('Act_PileReset'),A('Act_PlayableReset'),A('Act_FaceUpReset'),
   A('Act_Count0'),A('Act_Count1'),A('Act_Count2'),A('Act_Count3'),
   C('${Var_PlayerCount}',4,[A('Act_Zonen4')],[C('${Var_PlayerCount}',3,[A('Act_Zonen3')],[A('Act_Zonen2')])]),
   FEACH('StapelBasis','item','i',[A('Act_StapelPush')]),A('Act_StapelMischen'),
   FOR('p',0,'${Var_LastPlayer}',[FOR('k',0,4,[T('KarteAnSpieler')])]),
   T('StartkarteLegen'),T('RundeAktualisieren'),A('Act_StatusZug')
  ],'Karten mischen, je fünf Karten geben und die Startkarte ablegen.'),

  task('KarteAnSpieler',[
   A('Act_StapelPop'),A('Act_HandCountP'),A('Act_HandIndexNum'),A('Act_OwnerP'),A('Act_HandIdxP'),A('Act_HandIndexPlus'),A('Act_HandCountSetP')
  ],'Oberste Karte vom Stapel an Spieler p geben.'),

  task('StartkarteLegen',[
   A('Act_StartPop'),A('Act_AblageLen'),A('Act_OwnerAblage'),A('Act_PileSet'),
   A('Act_KarteSuit'),A('Act_KarteRank'),A('Act_TopWerte'),A('Act_AblagePush')
  ],'Erste Karte auf die Ablage legen und ihren Wert merken.'),

  task('HandIndizesBerechnen',[
   A('Act_Count0'),A('Act_Count1'),A('Act_Count2'),A('Act_Count3'),
   FEACH('KartenListe','item','i',[
    A('Act_KarteIdxOwner'),
    C('${Var_CardOwner}',0,[
     C('${Var_CardOwner}',4,[
      A('Act_CountByOwner'),A('Act_HandIndexNum'),A('Act_KarteIdxHandSet'),A('Act_HandIndexPlus'),A('Act_CountByOwnerSet')
     ],[],{op:'<'})
    ],[],{op:'>='})
   ])
  ],'Handpositionen der aktiven Spieler neu nummerieren und Kartenanzahl messen.'),

  task('KartenMarkieren',[
   A('Act_PlayableNull'),
   FEACH('KartenListe','item','i',[
    A('Act_KarteIdxUnspielbar'),A('Act_KarteIdxOwner'),
    C('${Var_CardOwner}','${Var_CurrPlayer}',[
     A('Act_KarteIdxSuit'),A('Act_KarteIdxRank'),
     C('${Var_ZiehPflicht}',0,[
      A('Act_SpielbarCalc'),A('Act_KarteIdxSpielbarSet'),
      C('${Var_Spielbar}',true,[A('Act_PlayablePlus')])
     ])
    ],[],{rType:'variable'})
   ])
  ],'Alle spielbaren Karten des aktiven Spielers markieren.'),

  task('KartenZeichnen',[
   FEACH('KartenListe','item','i',[
    A('Act_KarteIdxOwner'),A('Act_FaceUpCalc'),A('Act_KarteIdxFaceUp')
   ]),
   A('Act_HandInfo'),A('Act_HandInfoAn')
  ],'Karten-Records aktualisieren; TCardZone filtert, sortiert und zeichnet die Ansichten.'),

  task('RundeAktualisieren',[
   T('HandIndizesBerechnen'),T('KartenMarkieren'),T('KartenZeichnen'),A('Act_SpielerName')
  ],'Karten, Zählungen und Spieleranzeige aktualisieren.'),

  task('KarteGewaehlt',[
   C('${Var_Phase}','play',[
    A('Act_ClickIdx'),A('Act_ClickOwner'),A('Act_ClickId'),A('Act_ClickSuit'),A('Act_ClickRank'),A('Act_ClickPlayable'),
    C('${Var_CardOwner}','${Var_CurrPlayer}',[
     C('${Var_CardPlayable}',true,[T('KarteAusspielen')],[A('Act_StatusUngueltig')])
    ],[],{rType:'variable'})
   ])
  ],'Nur eigene, als spielbar markierte Karten ausspielen.'),

  task('KarteAusspielen',[
   A('Act_PlayedMerken'),
   A('Act_AblageLen'),A('Act_OwnerAblage'),A('Act_PileSet'),A('Act_KarteNichtSpielbar'),A('Act_TopWerte'),A('Act_AblagePush'),
   C('${Var_PlayedRank}',7,[A('Act_ZiehPflichtPlus')]),
   C('${Var_PlayedRank}',8,[A('Act_Skip1')]),
   T('RundeAktualisieren'),
   A('Act_HandCount'),A('Act_HandIndexNum'),
   C('${Var_HandIndex}',0,[
    A('Act_PhaseEnde'),A('Act_WunschAus'),A('Act_Gewinn')
   ],[
    C('${Var_PlayedRank}',11,[
     A('Act_PhaseWunsch'),A('Act_WunschAn'),A('Act_StatusWunsch')
    ],[
     T('SpielerWeiter')
    ])
   ],{op:'<='})
  ],'Karte ablegen, Sonderwirkung vormerken und Zug beenden.'),

  task('WunschHerz',[A('Act_WunschHerz'),T('WunschFertig')],'Herz wünschen.'),
  task('WunschKaro',[A('Act_WunschKaro'),T('WunschFertig')],'Karo wünschen.'),
  task('WunschPik',[A('Act_WunschPik'),T('WunschFertig')],'Pik wünschen.'),
  task('WunschKreuz',[A('Act_WunschKreuz'),T('WunschFertig')],'Kreuz wünschen.'),
  task('WunschFertig',[
   C('${Var_Phase}','wish',[A('Act_WunschAus'),T('SpielerWeiter')])
  ],'Farbwunsch speichern und den Zug weitergeben.'),

  task('Nachziehen',[
   C('${Var_Phase}','play',[
    C('${Var_ZiehPflicht}',0,[
     A('Act_DrawTotal'),
     FOR('i',1,'${Var_DrawTotal}',[T('KarteZiehen')]),
     A('Act_ZiehPflicht0'),T('SpielerWeiter')
    ],[
     T('KarteZiehen'),T('SpielerWeiter')
    ],{op:'>'})
   ],[
    C('${Var_Phase}','draw',[
     A('Act_DrawTotal'),
     FOR('i',1,'${Var_DrawTotal}',[T('KarteZiehen')]),
     A('Act_ZiehPflicht0'),T('SpielerWeiter')
    ])
   ])
  ],'Nachziehstapel: eine Karte oder die offene Zieh-Pflicht nehmen.'),

  task('KarteZiehen',[
   A('Act_StapelLen'),
   C('${Var_StapelLen}',0,[T('StapelNachmischen')]),
   A('Act_StapelLen'),
   C('${Var_StapelLen}',0,[
    A('Act_StapelPop'),A('Act_HandCount'),A('Act_HandIndexNum'),A('Act_OwnerCurr'),A('Act_HandIdxCurr'),A('Act_HandIndexPlus'),A('Act_HandCountSet')
   ],[A('Act_StatusLeer')],{op:'>'})
  ],'Eine Karte vom Stapel an den aktiven Spieler geben; leeren Stapel nachmischen.'),

  task('StapelNachmischen',[
   A('Act_AblageLen'),
   WHILE({leftValue:'${Var_AblageLen}',operator:'>',rightValue:1},[
    A('Act_AblageAlt'),A('Act_OwnerDeck'),A('Act_HandIdxLeer'),A('Act_PileLeer'),A('Act_KarteNichtSpielbar'),A('Act_StapelAltPush'),A('Act_AblageLen')
   ]),
   A('Act_StapelMischen')
  ],'Alle Ablagekarten außer der obersten in den Nachziehstapel zurücklegen und mischen.'),

  task('SpielerWeiter',[
   A('Act_NextPlayer'),A('Act_PlayerUebernehmen'),A('Act_Skip0'),T('RundeAktualisieren'),
   C('${Var_ZiehPflicht}',0,[
    A('Act_PhaseDraw'),A('Act_StatusZiehen')
   ],[
    A('Act_PhasePlay'),A('Act_StatusZug')
   ],{op:'>'})
  ],'Zum nächsten Spieler wechseln; 8 lässt einen Spieler aussetzen.'),

  task('Neustart',[
   A('Act_SetupAn'),A('Act_PhaseSetup'),A('Act_WunschAus'),
   A('Act_OwnerReset'),A('Act_HandIdxReset'),A('Act_PileReset'),A('Act_PlayableReset'),A('Act_FaceUpReset')
  ],'Zurück zur Spielerwahl.'),
  task('Anzahl2',[A('Act_Set2'),T('SpielStarten')],'2 Spieler'),
  task('Anzahl3',[A('Act_Set3'),T('SpielStarten')],'3 Spieler'),
  task('Anzahl4',[A('Act_Set4'),T('SpielStarten')],'4 Spieler')
 );

 objects.push(...ALLVARS);
 const project={
  meta:{id:'maumau',name:'MauMau',description:'MauMau — deklaratives GCS-Kartenspiel (2-4 Spieler, Hotseat), zunächst mit farbigen SVG-Karten.',version:'1.0'},
  schemaVersion:1,activeStageId:'main',
  stages:[{id:'main',name:'Hauptstage',type:'main',grid:{cols:64,rows:40,cellSize:20,snapToGrid:true,visible:true,backgroundColor:'#eaf2f8'},objects,actions,tasks,variables,events:{},flow:{}}]
 };
 return {project,media,cardIds};
}

function main(){
 fs.mkdirSync(imgDir,{recursive:true});
 const {project,media}=createMauMauProject();
 for(const [file,content] of Object.entries(media))fs.writeFileSync(path.join(imgDir,file),content);
 fs.writeFileSync(path.join(root,'game-server/public/projects/MauMau.json'),JSON.stringify(project,null,2)+'\n');
 const bundle={'MauMau.json':Buffer.from(JSON.stringify(project))};
 for(const [file,content] of Object.entries(media))bundle['images/maumau/'+file]=Buffer.from(content);
 const distDir=path.join(root,'dist');fs.mkdirSync(distDir,{recursive:true});
 fs.writeFileSync(path.join(distDir,'MauMau.zip'),zipSync(bundle));
 const editorImgDir=path.join(root,'public/images/maumau');fs.mkdirSync(editorImgDir,{recursive:true});
 for(const [file,content] of Object.entries(media))fs.writeFileSync(path.join(editorImgDir,file),content);
 fs.copyFileSync(path.join(root,'game-server/public/projects/MauMau.json'),path.join(root,'public/projects/MauMau.json'));
 console.log('MauMau.json:',objects.length,'Objekte,',tasks.length,'Tasks,',actions.length,'Actions | Bundle: dist/MauMau.zip | Editor-Kopien: public/');
}

if(require.main===module)main();
module.exports={createMauMauProject,SUITS,RANKS};
