const {createMauMauProject,SUITS,RANKS}=require('./build-maumau.cjs');

let pass=0,fail=0;
const ok=(cond,name)=>{if(cond)pass++;else{fail++;console.log('  ✗',name);}};
const section=t=>console.log('\n== '+t);

const {project,media,cardIds}=createMauMauProject();
const stage=project.stages[0];

section('Struktur');
const names=new Set(),dup=[];
for(const o of stage.objects){const k='o:'+o.name;if(names.has(k))dup.push(o.name);names.add(k);}
for(const a of stage.actions){const k='a:'+a.name;if(names.has(k))dup.push(a.name);names.add(k);}
for(const t of stage.tasks){const k='t:'+t.name;if(names.has(k))dup.push(t.name);names.add(k);}
ok(dup.length===0,'keine doppelten Objekt-/Action-/Task-Namen ('+dup.join(', ')+')');
const missing=[];
const chk=(seq,w)=>{for(const i of seq||[]){
 if(i.type==='action'&&!names.has('a:'+i.name))missing.push(i.name+' @'+w);
 if(i.type==='task'&&!names.has('t:'+i.name))missing.push('task '+i.name+' @'+w);
 if(i.type==='condition'){chk(i.body,w);chk(i.elseBody,w);}
 if(i.type==='foreach'||i.type==='for'||i.type==='while')chk(i.body,w);
}};
for(const t of stage.tasks)chk(t.actionSequence,t.name);
ok(missing.length===0,'alle Action-/Task-Referenzen vorhanden ('+missing.join(', ')+')');

const cards=stage.objects.filter(o=>/^Karte_\d\d$/.test(o.name||'')&&o.className==='TImage');
const zones=stage.objects.filter(o=>o.className==='TCardZone');
ok(cards.length===0,'keine einzelnen Kartenobjekte mehr ('+cards.length+')');
ok(zones.length===5,'5 TCardZone-Objekte ('+zones.map(z=>z.name).join(', ')+')');
ok(['Hand0Zone','Hand1Zone','Hand2Zone','Hand3Zone','AblageZone'].every(n=>zones.some(z=>z.name===n)),'alle Karten-Zonen vorhanden');
ok(zones.filter(z=>z.name.startsWith('Hand')).every(z=>z.events?.onRowClick==='KarteGewaehlt'),'Hand-Zonen sind mit KarteGewaehlt verdrahtet');
ok(zones.every(z=>z.dataSource==='KartenListe'&&z.searchProperty==='owner'&&z.src==='images/maumau/back.svg'),'Karten-Zonen nutzen KartenListe, owner-Filter und Rückseite');
ok(zones.every(z=>z.highlightField==='playable'&&z.selectionColor),'Karten-Zonen markieren spielbare Records');
ok(zones.every(z=>typeof z.itemWidth==='number'&&typeof z.itemHeight==='number'&&typeof z.gap==='number'),'Karten-Zonen nutzen itemWidth/itemHeight/gap in Grid-Cells');
const stapelBild=stage.objects.find(o=>o.name==='StapelBild');
const ablagePlatz=stage.objects.find(o=>o.name==='AblagePlatz');
const cardW=zones[0]?.itemWidth,cardH=zones[0]?.itemHeight;
ok(stapelBild?.width===cardW&&stapelBild?.height===cardH&&ablagePlatz?.width===cardW&&ablagePlatz?.height===cardH,'Stapel- und Ablagebild haben normale Kartengröße');
ok(stage.variables.length===0,'Variablen nur in stage.objects, keine stage.variables-Duplikate');

const liste=stage.objects.find(o=>o.name==='KartenListe');
ok(!!liste&&liste.className==='TObjectList'&&liste.items.length===32,'KartenListe enthält 32 logische Karten');
ok(!!liste&&Object.keys(liste.recordData).length===32&&liste.data.length===32,'recordData und data sind vollständig');
ok(!!liste&&['owner','handIndex','pileIndex','playable','faceUp','suit','rank','cardId','cardName','image'].every(f=>liste.fields.some(x=>x.name===f)),'Karten-Recordschema vollständig');
ok(cardIds.every(id=>liste.items.includes(id)&&liste.recordData[id]),'alle logischen Karten-IDs sind indiziert');

section('Karten und Medien');
const expectedRanks=new Set(RANKS.map(r=>r.rank));
ok(liste.data.every(r=>r.suit>=0&&r.suit<4&&expectedRanks.has(r.rank)&&r.owner===-1&&r.handIndex===-1),'32 Datensätze: 4 Farben × 8 Werte, initial im Stapel');
const images=new Set(liste.data.map(r=>r.image));
ok(images.size===32,'32 eindeutige Kartenbilder');
ok(Object.keys(media).length===34,'34 Medien erzeugt ('+Object.keys(media).length+': 32 Karten + back + ablage)');
ok([...images].every(img=>Object.prototype.hasOwnProperty.call(media,img.replace(/^images\/maumau\//,''))),'jedes Kartenbild liegt als Datei vor');
ok(Object.prototype.hasOwnProperty.call(media,'back.svg')&&Object.prototype.hasOwnProperty.call(media,'ablage.svg'),'back.svg und ablage.svg vorhanden');
const refs=[];
const walk=v=>{if(typeof v==='string'&&v.includes('images/maumau/'))refs.push(v);else if(v&&typeof v==='object')Object.values(v).forEach(walk);};
walk(stage);
ok(new Set(refs).size===34,'alle Medien sind als konkrete Projektpfade referenziert ('+new Set(refs).size+')');
ok(![...refs].some(r=>r.includes('${')),'kein dynamischer Bildpfad im Projekt');

section('Deklarative Regeln');
const actionByName=Object.fromEntries(stage.actions.map(a=>[a.name,a]));
ok(actionByName.Act_SpielbarCalc?.formula?.includes('Var_CardRank === 11'),'Bube ist unabhängig von Farbe/Wert spielbar');
ok(actionByName.Act_SpielbarCalc?.formula?.includes('Var_CardSuit === Var_Wunsch'),'Farbwunsch wird bei Bube ausgewertet');
ok(actionByName.Act_SpielbarCalc?.formula?.includes('Var_CardSuit === Var_AblageSuit')&&actionByName.Act_SpielbarCalc?.formula?.includes('Var_CardRank === Var_AblageRank'),'normale Karten passen nach Farbe oder Wert');
ok(actionByName.Act_ZiehPflichtPlus?.formula==='Var_ZiehPflicht + 2','7 legt zwei Zieh-Pflichten fest');
ok(actionByName.Act_NextPlayer?.formula?.includes('1 + Var_Skip'),'8 lässt den nächsten Spieler aussetzen');
const ausspielen=stage.tasks.find(t=>t.name==='KarteAusspielen');
const flat=seq=>(seq||[]).flatMap(i=>[i,...(i.body?flat(i.body):[]),...(i.elseBody?flat(i.elseBody):[])]);
const ausspielenItems=flat(ausspielen?.actionSequence);
ok(ausspielenItems.some(i=>i.type==='condition'&&i.condition?.leftValue==='${Var_PlayedRank}'&&i.condition?.rightValue===7),'7-Sonderregel deklarativ im Ausspiel-Task');
ok(ausspielenItems.some(i=>i.type==='condition'&&i.condition?.leftValue==='${Var_PlayedRank}'&&i.condition?.rightValue===8),'8-Sonderregel deklarativ im Ausspiel-Task');
ok(ausspielenItems.some(i=>i.type==='condition'&&i.condition?.leftValue==='${Var_PlayedRank}'&&i.condition?.rightValue===11),'Buben-Farbwunsch deklarativ im Ausspiel-Task');
const zeichnen=stage.tasks.find(t=>t.name==='KartenZeichnen');
const zeichnenItems=flat(zeichnen?.actionSequence);
ok(actionByName.Act_ClickIdx?.type==='variable'&&actionByName.Act_ClickIdx?.source==='self'&&actionByName.Act_ClickIdx?.sourceProperty==='selectedRecord.cardIdx','Kartenklick liest selectedRecord.cardIdx der TCardZone');
ok(zeichnenItems.some(i=>i.type==='action'&&i.name==='Act_KarteIdxFaceUp'),'KartenZeichnen aktualisiert faceUp-Records');
ok(stage.tasks.some(t=>t.name==='StapelNachmischen'),'Stapel-Neumischen ist vorhanden');

section('Regel-Mirror');
const playable=(card,top,wish=-1,pending=0)=>pending===0&&(card.rank===11||(wish>=0?card.suit===wish:card.suit===top.suit||card.rank===top.rank));
const byIdx=Object.fromEntries(liste.data.map(r=>[r.cardIdx,r]));
ok(playable(byIdx[0],{suit:0,rank:9}),'Herz 7 passt auf Herz 9');
ok(playable(byIdx[10],{suit:0,rank:9}),'Karo 9 passt auf Herz 9');
ok(playable(byIdx[4],{suit:2,rank:7}),'Bube ist immer spielbar');
ok(!playable(byIdx[16],{suit:0,rank:9}),'Pik 7 passt nicht auf Herz 9');
ok(playable(byIdx[24],{suit:0,rank:9},3),'Kreuz 10 erfüllt Kreuz-Wunsch');
ok(!playable(byIdx[0],{suit:0,rank:9},-1,2),'bei Zieh-Pflicht ist keine Karte spielbar');

console.log('\nErgebnis:',pass,'bestanden,',fail,'fehlgeschlagen.');
process.exit(fail?1:0);
