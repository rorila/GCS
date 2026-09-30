/** Test der Madn-Umsetzung:
 *  1) Struktur-Checks der generierten Madn.json (Objekte, Referenzen, Brett-Geometrie)
 *  2) Regelabgleich: Slot-Kodierung (40 Ring + 40..55 Ziel + 56..71 Home) wird in einer
 *     Mirror-Funktion nachgebaut und gegen die ORIGINALE madnGameLogic.js verglichen
 *     (calculatePossibleMoves + hasMovementPotential).
 *  Ausführen: node scripts/test-madn.cjs  (vorher ggf. node scripts/build-madn.cjs) */
const fs=require('node:fs'),path=require('node:path'),{execSync}=require('node:child_process');
process.env.LOG_LEVEL='error';
const root=path.resolve(__dirname,'..');
const projPath=path.join(root,'game-server/public/projects/Madn.json');
if(!fs.existsSync(projPath)){console.log('Madn.json fehlt – baue...');execSync('node scripts/build-madn.cjs',{cwd:root,stdio:'inherit'});}
const ORIG='C:/Users/rolfr/remote-games-backup/dist';
const {MadnGameLogic}=require(path.join(ORIG,'server/games/madn/logic/madnGameLogic.js'));
const TYPES=require(path.join(ORIG,'shared/types/games/madn.js'));

let pass=0,fail=0;const ok=(cond,name)=>{if(cond){pass++;}else{fail++;console.log('  ✗',name);}};
const section=t=>console.log('\n== '+t);

// ---------- 1. Struktur ----------
section('Struktur Madn.json');
const p=require(projPath),s=p.stages[0];
const names=new Set();const missing=[];
for(const o of s.objects)names.add('o:'+o.name);
for(const a of s.actions)names.add('a:'+a.name);
for(const t of s.tasks)names.add('t:'+t.name);
const chk=(seq,w)=>{for(const i of seq||[]){if(i.type==='action'&&!names.has('a:'+i.name))missing.push(i.name+' @'+w);if(i.type==='task'&&!names.has('t:'+i.name))missing.push('task '+i.name+' @'+w);if(i.type==='condition'){chk(i.body,w);chk(i.elseBody,w);}if(i.type==='foreach'||i.type==='for')chk(i.body,w);}};
for(const t of s.tasks)chk(t.actionSequence,t.name);
ok(missing.length===0,'alle Action-/Task-Referenzen vorhanden ('+missing.join(', ')+')');
const figs=s.objects.filter(o=>o.name&&o.name.startsWith('Figur_')&&o.className==='TImage');
ok(figs.length===16,'16 Figuren ('+figs.length+')');
ok(figs.every(f=>f.events&&f.events.onClick==='FigurGewaehlt'),'alle Figuren → FigurGewaehlt');
const liste=s.objects.find(o=>o.name==='FigurenListe');
ok(liste&&liste.data.length===16,'FigurenListe 16 Records');
ok(liste&&liste.data.every((d,i)=>d.slot===56+i&&d.colorIdx===(i>>2)&&d.pieceIdx===i),'Slots/Home/ColorIdx init korrekt');
ok(liste&&Array.isArray(liste.fields)&&liste.fields.some(f=>f.name==='slot'&&f.type==='number'),'FigurenListe fields deklariert (slot:number …)');
ok(liste&&liste.recordData&&Object.keys(liste.recordData).length===16&&liste.items.every(id=>liste.recordData[id]&&typeof liste.recordData[id].slot==='number'),'recordData je objectId befuellt (Runtime-Format!)');
const ring=s.objects.find(o=>o.name==='RingListe'),goal=s.objects.find(o=>o.name==='GoalListe');
ok(ring&&ring.items.length===40&&ring.items.every(v=>v===-1),'RingListe 40×-1');
ok(goal&&goal.items.length===16,'GoalListe 16 Einträge');
const fx=s.objects.find(o=>o.name==='FeldX'),fy=s.objects.find(o=>o.name==='FeldY');
const xy=new Set();for(let i=0;i<72;i++)xy.add(fx.items[i]+','+fy.items[i]);
ok(fx.items.length===72&&xy.size===72,'72 eindeutige Slot-Koordinaten');
// Startfelder farblich korrekt (Ringfelder 0/10/30/20 = rot/blau/gruen/gelb-Start)
ok(figs.every(f=>f.visible===false),'Figuren initial unsichtbar');
const btns=['Btn2','Btn3','Btn4','WuerfelnBtn','NeustartBtn'].map(b=>s.objects.find(o=>o.name===b));
ok(btns.every(b=>b&&b.events&&b.events.onClick),'Alle Buttons verdrahtet');
console.log('  Objekte:',s.objects.length,'| Tasks:',s.tasks.length,'| Actions:',s.actions.length);

// ---------- 2. Regel-Mirror (identisch zur deklarativen Flow-Logik) ----------
const STARTS=[0,10,30,20],EINGANG=[39,9,29,19];      // colorIdx: 0=rot,1=blau,2=gruen,3=gelb
const COLORIDX={red:0,blue:1,green:2,yellow:3};
const ORIG_START={red:0,green:10,yellow:20,blue:30};
function zielPruefen(slot,color,wurf,ring,goals){
 // Spiegelbild der GCS-Task ZielPruefen → {ziel,capture}
 let ziel=-1,capture=-1;
 const ringPruef=t=>{const occ=ring[t];if(occ===-1){ziel=t;}else if((occ>>2)===color){ziel=-1;}else{ziel=t;capture=occ;}};
 if(slot>55){if(wurf===6)ringPruef(STARTS[color]);}
 else if(slot>39&&slot<56){
  const sz=slot-40-color*4,gn=sz+wurf;
  if(gn<4){let frei=true;for(let g=sz+1;g<=gn;g++)if(goals[color*4+g]!==-1)frei=false;
   if(frei)ziel=40+color*4+gn;}
 }else if(slot<40){
  const dist=(EINGANG[color]-slot+40)%40;
  if(wurf>dist){const gi=wurf-dist-1;
   if(gi<4){let frei=true;for(let g=0;g<=gi;g++)if(goals[color*4+g]!==-1)frei=false;
    if(frei)ziel=40+color*4+gi;}
  }else ringPruef((slot+wurf)%40);
 }
 return{ziel,capture};
}
const potential=(slots,color)=>slots.some((sl,i)=>((i>>2)===color)&&(sl<40||(sl<56&&sl-40-color*4<3)));

// Übersetzung Original-State → Slot-Modell
function toSlots(game,playerCount){
 const players=game.players;
 const slots=new Array(16).fill(-1),ring=new Array(40).fill(-1),goals=new Array(16).fill(-1);
 const idxOf={};let j=0;
 for(const piece of game.pieces){
  const pl=players.find(x=>x.id===piece.playerId),c=COLORIDX[pl.color];
  const my=piece.homeIndex;const idx=c*4+my;idxOf[piece.id]=idx;
  let slot;
  if(piece.isInHome)slot=56+idx;
  else if(piece.isInGoal)slot=40+c*4+piece.goalIndex;
  else slot=(piece.position-ORIG_START[piece.color]+STARTS[c]+40)%40; // orig-abs → mein Absolutring
  slots[idx]=slot;
  if(slot<40)ring[slot]=idx;else if(slot<56)goals[slot-40]=idx;
 }
 return{slots,ring,goals,idxOf};
}
function toMyTarget(piece,color,toPos){
 const c=COLORIDX[color];
 if(toPos>=40)return 40+c*4+(toPos-40);
 return (toPos-ORIG_START[color]+STARTS[c]+40)%40;
}

// ---------- 3. Regelabgleich ----------
section('Regelabgleich vs. Originallogik');
const mkGame=n=>{const g=new MadnGameLogic({playerCount:n});
 g.initialize(Array.from({length:n},(_,i)=>({id:'p'+i,name:'P'+i,isReady:true,isActive:true,joinedAt:0})));
 return g;};

// Szenario-Setups: [playerCount, pieceMutations]
function setPiece(g,playerIdx,pieceIdx,mut){const pl=g.players[playerIdx];const piece=g.pieces.find(x=>x.playerId===pl.id&&x.homeIndex===pieceIdx);Object.assign(piece,mut);return piece;}
const scenarios=[
 {n:2,name:'Init: alle Home, Würfel 6 → nur Aussetzen',setup:g=>{},wurf:6},
 {n:2,name:'Init: Würfel 3 → keine Züge',setup:g=>{},wurf:3},
 {n:4,name:'Ringzug frei',setup:g=>{setPiece(g,0,0,{isInHome:false,position:5});},wurf:3},
 {n:4,name:'Eigenes Feld blockiert',setup:g=>{setPiece(g,0,0,{isInHome:false,position:5});setPiece(g,0,1,{isInHome:false,position:8});},wurf:3},
 {n:4,name:'Schlagen (rot schlägt blau)',setup:g=>{setPiece(g,0,0,{isInHome:false,position:5});setPiece(g,1,0,{isInHome:false,position:8});},wurf:3},
 {n:4,name:'Heimkehren auf besetztes Startfeld (eigen)',setup:g=>{setPiece(g,0,0,{isInHome:false,position:0});},wurf:6},
 {n:4,name:'Schlagen auf Startfeld',setup:g=>{setPiece(g,1,0,{isInHome:false,position:30});setPiece(g,0,0,{isInHome:false,position:5});},wurf:5},
 {n:4,name:'Zieleinzug exakt',setup:g=>{setPiece(g,0,0,{isInHome:false,position:36});},wurf:4},
 {n:4,name:'Zieleinzug zu weit (gi>=4)',setup:g=>{setPiece(g,0,0,{isInHome:false,position:38});},wurf:6},
 {n:4,name:'Zielpfad blockiert beim Einzug',setup:g=>{setPiece(g,0,0,{isInHome:false,position:35});setPiece(g,0,1,{isInHome:false,isInGoal:true,position:41,goalIndex:1});},wurf:4},
 {n:4,name:'Zielintern bewegen frei',setup:g=>{setPiece(g,0,0,{isInHome:false,isInGoal:true,position:40,goalIndex:0});},wurf:2},
 {n:4,name:'Zielintern blockiert (Überspringen)',setup:g=>{setPiece(g,0,0,{isInHome:false,isInGoal:true,position:40,goalIndex:0});setPiece(g,0,1,{isInHome:false,isInGoal:true,position:42,goalIndex:2});},wurf:3},
 {n:4,name:'Zielintern übers Ziel hinaus',setup:g=>{setPiece(g,0,0,{isInHome:false,isInGoal:true,position:42,goalIndex:2});},wurf:3},
 {n:3,name:'3 Spieler: nur aktive Farben',setup:g=>{setPiece(g,2,0,{isInHome:false,position:12});},wurf:2},
];
for(const sc of scenarios){
 const g=mkGame(sc.n);sc.setup(g);
 const{slots,ring,goals,idxOf}=toSlots(g,sc.n);
 let allOk=true;
 for(const pl of g.players){
  const origMoves=g.calculatePossibleMoves(pl.id,sc.wurf);
  const c=COLORIDX[pl.color];
  const mine=[];
  for(let i=0;i<16;i++){if((i>>2)!==c)continue;const r=zielPruefen(slots[i],c,sc.wurf,ring,goals);if(r.ziel>=0)mine.push({idx:i,ziel:r.ziel,cap:r.capture});}
  // Vergleiche: gleiche Figur → gleiches Ziel + gleiche Capture-Info
  const oByPiece={};for(const m of origMoves)oByPiece[idxOf[m.pieceId]]=m;
  const setO=Object.keys(oByPiece).map(Number).sort(),setM=mine.map(m=>m.idx).sort();
  if(JSON.stringify(setO)!==JSON.stringify(setM)){allOk=false;console.log('    Moves ungleich @',pl.color,'orig',setO,'meins',setM);continue;}
  for(const m of mine){const om=oByPiece[m.idx];
   const want=toMyTarget(om?om:{},pl.color,om?om.toPosition:-1);
   if(m.ziel!==want){allOk=false;console.log('    Ziel abw. @',pl.color,'fig',m.idx,'orig',want,'meins',m.ziel);}
   if((m.cap>=0)!==!!om.willCapture){allOk=false;console.log('    Capture abw. @',pl.color,'fig',m.idx);}
  }
 }
 ok(allOk,sc.name+' (W'+sc.wurf+')');
}

// Zufalls-Stellungen robust abgleichen
section('Zufallsvergleich (200 Stellungen)');
let randFails=0;
for(let k=0;k<200;k++){
 const n=2+Math.floor(Math.random()*3);const g=mkGame(n);
 // Nur regelkonform erreichbare Stellungen: keine zwei Figuren auf demselben
 // visuellen Feld bzw. derselben Zielzelle (Schlagen/Aussetzen verhindert das).
 const usedAbs=new Set(),usedGoal=new Set();
 const origStart={red:0,green:10,yellow:20,blue:30};
 const visOf=(pos,color)=>{const arr={red:TYPES.RED_FIELD_POSITIONS,green:TYPES.GREEN_FIELD_POSITIONS,yellow:TYPES.YELLOW_FIELD_POSITIONS,blue:TYPES.BLUE_FIELD_POSITIONS}[color];return arr[(pos-origStart[color]+40)%40].join(',');};
 for(const piece of g.pieces){
  const r=Math.random();
  if(r<0.4){}else if(r<0.8){
   let pos,tries=0;do{pos=Math.floor(Math.random()*40);}while(usedAbs.has(visOf(pos,piece.color))&&++tries<50);
   if(tries<50){usedAbs.add(visOf(pos,piece.color));piece.isInHome=false;piece.position=pos;}
  }else{
   const goalKey=piece.color+':' ;let gi,tries=0;do{gi=Math.floor(Math.random()*4);}while(usedGoal.has(goalKey+gi)&&++tries<8);
   if(tries<8){usedGoal.add(goalKey+gi);piece.isInHome=false;piece.isInGoal=true;piece.goalIndex=gi;piece.position=40+gi;}
  }
 }
 const wurf=1+Math.floor(Math.random()*6);
 const{slots,ring,goals,idxOf}=toSlots(g,n);
 for(const pl of g.players){
  const origMoves=g.calculatePossibleMoves(pl.id,wurf);
  const c=COLORIDX[pl.color];const setO=origMoves.map(m=>idxOf[m.pieceId]).sort();
  const setM=[];for(let i=0;i<16;i++){if((i>>2)!==c)continue;const r2=zielPruefen(slots[i],c,wurf,ring,goals);if(r2.ziel>=0)setM.push(i);}setM.sort();
  const targetsOk=origMoves.every(m=>{const mine=zielPruefen(slots[idxOf[m.pieceId]],c,wurf,ring,goals);const want=toMyTarget(m,pl.color,m.toPosition);if(mine.ziel!==want||(mine.capture>=0)!==m.willCapture){if(randFails<4)console.log('    Detail: fig',idxOf[m.pieceId],'toPos',m.toPosition,'want',want,'meins',mine.ziel,'| cap orig',m.willCapture,'meins',mine.capture);return false;}return true;});
  if(JSON.stringify(setO)!==JSON.stringify(setM)||!targetsOk){randFails++;if(randFails<4)console.log('    Mismatch Stellung',k,'Spieler',pl.color,'W',wurf,'orig',setO,'meins',setM);}
 }
 // Potential
 for(const pl of g.players){
  const c=COLORIDX[pl.color];
  const hp=g.hasMovementPotential(pl.id);
  const mp=potential(slots,c);
  if(hp!==mp){randFails++;console.log('    Potential abw.',k,pl.color,'orig',hp,'meins',mp);}
 }
}
ok(randFails===0,'200 Zufallsstellungen: Moves+Ziele+Captures+Potential identisch ('+randFails+' Abweichungen)');

console.log('\nErgebnis:',pass,'bestanden,',fail,'fehlgeschlagen.');
process.exit(fail?1:0);
