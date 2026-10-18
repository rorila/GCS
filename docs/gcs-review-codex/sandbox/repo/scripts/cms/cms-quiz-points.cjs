// Ergänzt das bestehende Quiz, ohne Sprach-/TTS- oder Wiederholungsabläufe neu aufzubauen.
// Seit der Overlay-Umstellung zeigt ein TLearningPointsOverlay den zentralen
// Lernpunktestand — das fruehere LernpunkteLabel (reine Textzeile) entfaellt.
// Die Fachanzeige bekommt ihre Daten deklarativ ueber call_method:
//   cardAnswer → Lernpunkte.applyLearningResult(BewertungAntwort)
//   cardNext   → Lernpunkte.applyLearningResult(KartenAntwort(.card))
//   end        → Lernpunkte.applyEndResult(EndeAntwort)
const crypto=require('node:crypto');
const uid=p=>p+'-'+crypto.randomUUID();

// call_method-Action erzeugen (gleiche Form wie im Hauptgenerator).
const callAct=(name,target,method,params)=>({id:uid('q_act'),name,type:'call_method',target,method,params:params||[],scope:'stage'});
const ref=name=>({type:'action',name});

// Sucht in einer Actionsequenz verschachtelt die Position direkt nach
// einer Action und fuegt dort eine Referenz ein (idempotent).
function insertAfter(seq,afterName,entry){
 for(let i=0;i<(seq||[]).length;i++){
  const st=seq[i];
  if(st.type==='action'&&st.name===afterName){
   if(!(seq[i+1]&&seq[i+1].type==='action'&&seq[i+1].name===entry.name)&&!(st===entry))seq.splice(i+1,0,entry);
   return true;
  }
  if(insertAfter(st.then,afterName,entry))return true;
  if(insertAfter(st.else,afterName,entry))return true;
  if(insertAfter(st.body,afterName,entry))return true;
  if(insertAfter(st.elseBody,afterName,entry))return true;
 }
 return false;
}

function configureQuizPoints(project){
 const s=project.stages.find(s=>s.id==='stage_quiz');if(!s)return;
 for(const name of ['Act_BewertungR_Server','Act_BewertungF_Server']){
  const a=s.actions.find(a=>a.name===name);if(!a)continue;
  const body=typeof a.body==='string'?JSON.parse(a.body):a.body;
  Object.assign(body,{attemptId:'${AktuelleKarte.attemptId}',answer:'${AktuelleAntwort}'});
  a.body=body;
 }
 const draw=s.actions.find(a=>a.name==='Act_Karte_Server');const body=typeof draw.body==='string'?JSON.parse(draw.body):draw.body;draw.body={...body,learningPoints:true};

 // ── LernpunkteLabel → TLearningPointsOverlay ───────────────────────
 // Die Textzeile wird ersetzt; die Objekt-ID 'quiz_learning_points'
 // bleibt stabil, damit Verweise und Snapshots nicht kippen.
 s.objects=s.objects.filter(o=>o.name!=='LernpunkteLabel');
 if(!s.objects.some(o=>o.name==='Lernpunkte')){
  s.objects.push({
   className:'TLearningPointsOverlay',id:'quiz_learning_points',name:'Lernpunkte',scope:'stage',
   draggable:false,droppable:false,dragMode:'move',visible:true,
   x:42,y:39,width:20,height:2,zIndex:100,rotation:0,align:'NONE',collisionEnabled:false,
   text:'Lernpunkte',expandedText:'',
   expandedBounds:{x:14,y:8,width:36,height:18},
   initialState:'compact',interactionMode:'interactive',activationAction:'toggleExpanded',
   expandedModal:false,showCloseButton:true,closeOnEscape:true,pauseGame:false,
   refreshIntervalSeconds:15,previewExpanded:false,isExpanded:false,
   style:{color:'#ffffff',fontSize:16,backgroundColor:'rgba(16,45,58,0.92)',borderColor:'#58bdb2',borderWidth:1},
   events:{}
  });
 }
 s.grid.rows=Math.max(s.grid.rows,43);

 // ── Zweiter Anwendungsfall: generisches Hilfe-Inline-Overlay ────────
 // Belegt, dass TInlineOverlay ohne Fachkomponente funktioniert: statischer
 // Detailtext, keine Datenanbindung, nicht modal.
 if(!s.objects.some(o=>o.name==='HilfeOverlay')){
  s.objects.push({
   className:'TInlineOverlay',id:'quiz_help_overlay',name:'HilfeOverlay',scope:'stage',
   draggable:false,droppable:false,dragMode:'move',visible:true,
   x:2,y:2,width:10,height:2,zIndex:100,rotation:0,align:'NONE',collisionEnabled:false,
   text:'ℹ Hilfe',
   expandedText:'So funktioniert das Karteikasten-Quiz:\n\n• Karten kommen aus deinem persönlichen Leitner-Kasten (Fach 1–5).\n• Richtige Antworten wandern ein Fach hoch — Fach 6 gilt als gelernt.\n• Falsche Antworten gehen zurück auf Fach 1.\n• Die Lernpunkte unten zählt der Server, nicht das Spiel.',
   expandedBounds:{x:10,y:6,width:44,height:22},
   initialState:'compact',interactionMode:'interactive',activationAction:'toggleExpanded',
   expandedModal:false,showCloseButton:true,closeOnEscape:true,pauseGame:false,
   previewExpanded:false,isExpanded:false,
   style:{color:'#d8f3ff',fontSize:15,backgroundColor:'rgba(16,45,58,0.92)',borderColor:'#58bdb2',borderWidth:1},
   events:{}
  });
 }

 // Alte Text-Property-Ziele vollstaendig entfernen — die Anzeige wird
 // ausschliesslich ueber die Fachmethoden gespeist (kein Doppelkanal).
 for(const name of ['Act_BewertetR','Act_BewertetF','Act_Karte_Uebernehmen','Act_QuizEnde']){
  const a=s.actions.find(a=>a.name===name);if(a?.changes)delete a.changes['LernpunkteLabel.text'];
 }

 // ── Deklarative Fachverdrahtung ────────────────────────────────────
 // Gebuchte Kartenbewertung → bestaetigte Punkteaenderung + Hinweis.
 for(const act of [
  callAct('Act_Lernpunkte_Bewertung','Lernpunkte','applyLearningResult',['${BewertungAntwort}']),
  callAct('Act_Lernpunkte_Karte','Lernpunkte','applyLearningResult',['${KartenAntwort.card}']),
  callAct('Act_Lernpunkte_Leer','Lernpunkte','applyLearningResult',['${KartenAntwort}']),
  callAct('Act_Lernpunkte_Endstand','Lernpunkte','applyEndResult',['${EndeAntwort}'])
 ]){
  const idx=s.actions.findIndex(a=>a.name===act.name);
  if(idx>=0){act.id=s.actions[idx].id;s.actions[idx]=act;}else s.actions.push(act);
 }
 const taskOf=name=>s.tasks.find(t=>t.name===name);
 for(const t of s.tasks){
  insertAfter(t.actionSequence,'Act_BewertetR',ref('Act_Lernpunkte_Bewertung'));
  insertAfter(t.actionSequence,'Act_BewertetF',ref('Act_Lernpunkte_Bewertung'));
  insertAfter(t.actionSequence,'Act_Karte_Uebernehmen',ref('Act_Lernpunkte_Karte'));
  insertAfter(t.actionSequence,'Act_QuizEnde',ref('Act_Lernpunkte_Leer'));
  insertAfter(t.actionSequence,'Act_Sitzung_Ende',ref('Act_Lernpunkte_Endstand'));
 }

 const check=s.actions.find(a=>a.name==='Act_Zahlantwort_Pruefen');if(check)check.formula=check.formula.replace('checkNumberAnswer','checkCardAnswer');
 const unknown=s.actions.find(a=>a.name==='Act_Unverstanden');if(unknown)unknown.changes['StatusLabel.text']='Antwort nicht eindeutig erkannt. Bitte erneut antworten.';
 project.meta={...project.meta,cardLearningPoints:'leitner-v1'};
 return project;
}
module.exports={configureQuizPoints};
