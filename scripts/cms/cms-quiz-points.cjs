// Ergänzt das bestehende Quiz, ohne Sprach-/TTS- oder Wiederholungsabläufe neu aufzubauen.
function configureQuizPoints(project){
 const s=project.stages.find(s=>s.id==='stage_quiz');if(!s)return;
 for(const name of ['Act_BewertungR_Server','Act_BewertungF_Server']){
  const a=s.actions.find(a=>a.name===name);if(!a)continue;
  const body=typeof a.body==='string'?JSON.parse(a.body):a.body;
  Object.assign(body,{attemptId:'${AktuelleKarte.attemptId}',answer:'${AktuelleAntwort}'});
  a.body=body;
 }
 const draw=s.actions.find(a=>a.name==='Act_Karte_Server');const body=typeof draw.body==='string'?JSON.parse(draw.body):draw.body;draw.body={...body,learningPoints:true};
 const base=s.objects.find(o=>o.name==='ZaehlerLabel');
 if(!s.objects.some(o=>o.name==='LernpunkteLabel'))s.objects.push({...structuredClone(base),id:'quiz_learning_points',name:'LernpunkteLabel',text:'Lernpunkte werden beim Start geladen.',style:{...base.style,fontSize:16}});
 Object.assign(s.objects.find(o=>o.name==='LernpunkteLabel'),{x:4,y:39,width:56,height:2});s.grid.rows=Math.max(s.grid.rows,43);
 for(const name of ['Act_BewertetR','Act_BewertetF'])Object.assign(s.actions.find(a=>a.name===name).changes,{'LernpunkteLabel.text':'Lernpunkte: ${BewertungAntwort.learning.totalPoints} · Änderung: ${BewertungAntwort.pointsDelta} · Abgeschlossen: ${BewertungAntwort.learning.completedCards}'});
 Object.assign(s.actions.find(a=>a.name==='Act_Karte_Uebernehmen').changes,{'LernpunkteLabel.text':'Lernpunkte: ${KartenAntwort.card.learning.totalPoints} · ${KartenAntwort.card.learning.modeLabel} · Abgeschlossen: ${KartenAntwort.card.learning.completedCards}'});
 Object.assign(s.actions.find(a=>a.name==='Act_QuizEnde').changes,{'LernpunkteLabel.text':'Lernpunkte: ${KartenAntwort.learning.totalPoints} · ${KartenAntwort.learning.modeLabel} · Abgeschlossen: ${KartenAntwort.learning.completedCards}'});
 const check=s.actions.find(a=>a.name==='Act_Zahlantwort_Pruefen');if(check)check.formula=check.formula.replace('checkNumberAnswer','checkCardAnswer');
 const unknown=s.actions.find(a=>a.name==='Act_Unverstanden');if(unknown)unknown.changes['StatusLabel.text']='Antwort nicht eindeutig erkannt. Bitte erneut antworten.';
 project.meta={...project.meta,cardLearningPoints:'leitner-v1'};
 return project;
}
module.exports={configureQuizPoints};
