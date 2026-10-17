const fs=require('node:fs'),path=require('node:path');
/** Repair bindings and paper without rebuilding or repositioning an editor-designed stage. */
function repairDeckCardLayout(project){
 const stage=project.stages.find(s=>s.id==='stage_deck_card_edit');if(!stage)throw Error('Kartenstage fehlt.');
 const paper='data:image/svg+xml;base64,'+fs.readFileSync(path.join(__dirname,'../../public/images/karteikarte-kariert.svg')).toString('base64');
 const all=[];const walk=objects=>{for(const o of objects||[]){all.push(o);walk(o.children);}};walk(stage.objects);
 const bands=[];
 for(const side of ['Frage','Antwort']){
  const card=all.find(o=>o.id==='deck_card_'+side+'Papier');if(!card)throw Error(side+'-Karte fehlt.');
  card.backgroundImage=paper;card.objectFit='100% 100%';card.caption='';
  const footer=(card.children||[]).filter(o=>o.className==='TPanel'&&o.style?.backgroundColor==='#285984').sort((a,b)=>a.x-b.x);
  if(footer.length!==3)throw Error('Drei blaue Labels für '+side+' erwartet.');
  for(const [index,o]of footer.entries()){
   o.name=['Stapelname','Stapelart','Stapelersteller'][index]+side;
   o.caption=['Stapelname','Stapelart','Stapelersteller'][index];
   Object.assign(o.style,{color:'#ffffff',fontSize:12,fontFamily:'Segoe UI, sans-serif',textAlign:'center'});
   bands.push({object:o,expression:['${InfoAntwort.deck.name}','${InfoAntwort.deck.subject}','${InfoAntwort.deck.ownerName}'][index]});
  }
 }
 const question=all.find(o=>o.text==='?');if(question)question.name='FrageSymbol';
 const answer=all.find(o=>o.text==='!');if(answer)answer.name='AntwortSymbol';
 stage.variables||=[];
 for(const name of ['KartenEditorFach','KartenEditorThema'])if(!stage.variables.some(v=>v.name===name))stage.variables.push({id:'deck_card_var_'+name,name,className:'TStringVariable',scope:'stage',isVariable:true,isHiddenInRun:true,type:'string',value:'',defaultValue:''});
 const retired=new Set(['StapelInfo','ErstellerInfo','FachInfo','FachKarte','ThemaInfo','ThemaKarte','FrageTitel','AntwortTitel']);
 for(const a of stage.actions){
  if(a.type==='property'){
   if(Object.hasOwn(a.changes||{},'FachKarte.text')){a.changes.KartenEditorFach=a.changes['FachKarte.text'];}
   if(Object.hasOwn(a.changes||{},'ThemaKarte.text')){a.changes.KartenEditorThema=a.changes['ThemaKarte.text'];}
   for(const key of Object.keys(a.changes||{}))if(retired.has(key.split('.')[0]))delete a.changes[key];
  }
  if(a.name==='Act_Stapel_Uebernehmen')Object.assign(a.changes,Object.fromEntries(bands.map(({object,expression})=>[object.name+'.caption',expression])));
  if(a.name==='Act_Speichern_Server'){
   if(typeof a.body==='string')a.body=JSON.parse(a.body);
   a.body.subject='${KartenEditorFach}';a.body.topic='${KartenEditorThema}';
  }
 }
 stage.cmsDeckCardLayout='compact';
 return project;
}
module.exports={repairDeckCardLayout};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json'),raw=fs.readFileSync(file,'utf8');fs.writeFileSync(file,JSON.stringify(repairDeckCardLayout(JSON.parse(raw)),null,2)+(raw.endsWith('\n')?'\n':''));}
