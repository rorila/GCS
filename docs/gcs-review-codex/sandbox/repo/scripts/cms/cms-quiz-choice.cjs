// Declarative three-choice flow for Kopfrechnen-App, reusable by games via createAnswerChoices().
function configureMathChoices(project){
 const s=project.stages.find(s=>s.id==='stage_rechnen');if(!s)throw Error('Kopfrechnen-Stage fehlt.');
 const up=(list,name,data)=>{const old=list.find(x=>x.name===name);if(old)Object.assign(old,data);else list.push({id:'choice_'+name,name,scope:'stage',...data});};
 const act=(name,type,data)=>{up(s.actions,name,{type,...data});return{type:'action',name};};
 const prop=(name,changes)=>act(name,'property',{changes});
 const calc=(name,formula,resultVariable)=>act(name,'calculate',{formula,resultVariable});
 const run=name=>({type:'task',name});
 const cond=(variable,operator,value,body,elseBody=[])=>({type:'condition',condition:{variable,operator,value,...(typeof value==='string'&&value.startsWith('${')?{rightType:'variable'}:{})},body,elseBody});
 const task=(name,actionSequence)=>up(s.tasks,name,{actionSequence,triggerMode:'local-sync',params:[]});
 for(const [name,value,className]of[['Phase','idle','TStringVariable'],['AktuelleAntwort','','TStringVariable'],['Auswahl',null,'TObjectVariable'],['FeedbackFertig',false,'TBooleanVariable'],['BuchungFertig',false,'TBooleanVariable']])up(s.variables,name,{className,isVariable:true,isHiddenInRun:true,value,defaultValue:value,type:className.replace(/^T|Variable$/g,'').toLowerCase()});
 const buttons=['BtnAntwortA','BtnAntwortB','BtnAntwortC'];
 const locked=Object.fromEntries(buttons.map(n=>[n+'.enabled',false]));
 const hidden=Object.fromEntries(buttons.map(n=>[n+'.visible',false]));
 up(s.objects,'AntwortTimer',{className:'TTimer',isService:true,isHiddenInRun:true,x:1,y:1,width:4,height:2,interval:2000,enabled:false,maxInterval:1,currentInterval:0,events:{onTimer:'Antwortzeit_Vorbei'}});
 const next=s.objects.find(o=>o.name==='Naechste');if(next){next.text='Erneut laden';next.events={onClick:'Laden_Wiederholen'};}
 const draw=s.actions.find(a=>a.name==='Act_Karte_Server');const body=typeof draw.body==='string'?JSON.parse(draw.body):draw.body;draw.body={...body,learningPoints:true};
 for(const [name,correct]of[['Act_BewertungR_Server',true],['Act_BewertungF_Server',false]])s.actions.find(a=>a.name===name).body={launchKey:'${CMS_LAUNCH}',action:'cardAnswer',cardId:'${AktuelleKarte.id}',attemptId:'${AktuelleKarte.attemptId}',answer:'${AktuelleAntwort}',correct};
 task('App_Start',[cond('Phase','==','idle',[prop('Act_Start_Auswahl',{Phase:'next'}),run('Aufgabe_Ziehen')])]);
 task('Laden_Wiederholen',[cond('Phase','==','load-error',[prop('Act_Laden_Erneut',{Phase:'next'}),run('Aufgabe_Ziehen')])]);
 task('Aufgabe_Ziehen',[cond('Phase','==','next',[cond('AufgabenNr','>=','${Aufgaben}',[run('Abschluss')],[
  prop('Act_Ziehen_Start',{Phase:'loading',Busy:1,...hidden,...locked,'StatusLabel.text':'Aufgabe wird geladen …','LoesungLabel.text':'','Naechste.visible':false,'AntwortTimer.enabled':false,AktuelleAntwort:''}),{type:'action',name:'Act_Karte_Server'},
  cond('Phase','==','loading',[cond('KartenAntwort.ok','==',true,[cond('KartenAntwort.card','truthy',true,[
   {type:'action',name:'Act_Karte_Objekt'},calc('Act_Auswahl_Erzeugen','createAnswerChoices(AktuelleKarte)','Auswahl'),
   cond('Auswahl.valid','==',true,[calc('Act_Nr_Plus','AufgabenNr + 1','AufgabenNr'),prop('Act_Auswahl_Bereit',{
    Phase:'answering',Busy:0,'FrageLabel.text':'${AktuelleKarte.question}','FachLabel.text':'${AktuelleKarte.subject} · ${AktuelleKarte.topic} · Fach ${AktuelleKarte.box}',
    'FortschrittLabel.text':'Aufgabe ${AufgabenNr} von ${Aufgaben}','StatusLabel.text':'Wähle die richtige Antwort.',
    ...Object.fromEntries(buttons.flatMap((n,i)=>[[n+'.text','${Auswahl.options['+i+']}'],[n+'.matchValue','${Auswahl.options['+i+']}'],[n+'.visible',true],[n+'.enabled',true]]))
   })],[prop('Act_Auswahl_Fehler',{Phase:'load-error',Busy:0,'StatusLabel.text':'Für diese Karte fehlen zwei passende falsche Antworten. Bitte im Karteneditor ergänzen.','Naechste.visible':true})])
  ],[run('Abschluss')])],[prop('Act_ZiehFehler',{Phase:'load-error',Busy:0,'StatusLabel.text':'Aufgabe konnte nicht geladen werden. Bitte erneut laden.','Naechste.visible':true})])])
 ])])]);
 task('Antwort_Gewaehlt',[cond('Phase','==','answering',[
  // Claim the attempt synchronously, before the first asynchronous HTTP action.
  prop('Act_Antwort_Sperren',{Phase:'selected',Busy:1,...locked}),
  calc('Act_Antwort_Uebernehmen','String(self.matchValue)','AktuelleAntwort'),
  calc('Act_Antwort_Pruefen','checkCardAnswer(AktuelleAntwort, AktuelleKarte.value.answers)','AntwortPruefung'),
  cond('AntwortPruefung.correct','==',true,[run('Bewerten_Richtig')],[run('Bewerten_Falsch')])
 ])]);
 up(s.variables,'AntwortPruefung',{className:'TObjectVariable',isVariable:true,isHiddenInRun:true,value:null,defaultValue:null,type:'object'});
 for(const [suffix,correct,counter]of[['R',true,'Richtig'],['F',false,'Falsch']])task('Bewerten_'+(correct?'Richtig':'Falsch'),[cond('Phase','==','selected',[
  prop('Act_Bewerten'+suffix+'_Start',{Phase:'feedback',Busy:1,...locked,FeedbackFertig:false,BuchungFertig:false,'LoesungLabel.text':'Die richtige Antwort ist ${Auswahl.solution}.','StatusLabel.text':'Lernstand wird gespeichert …','AntwortTimer.currentInterval':0,'AntwortTimer.enabled':true}),
  {type:'action',name:'Act_Bewertung'+suffix+'_Server'},
  cond('Phase','==','feedback',[cond('BewertungAntwort.ok','==',true,[
   calc('Act_'+counter+'_Plus',counter+' + 1',counter),prop('Act_Bewertet'+suffix,{BuchungFertig:true,'ZaehlerLabel.text':'Richtig: ${Richtig} · Falsch: ${Falsch}','StatusLabel.text':'',GezogeneIds:'${GezogeneIds}${AktuelleKarte.id},'}),run('Weiter_Nach_Antwort')
  ],[prop('Act_BuchFehler'+suffix,{Phase:'save-error',Busy:1,'AntwortTimer.enabled':false,'StatusLabel.text':'Lernstand konnte nicht sicher gespeichert werden. Bitte Spiel beenden und Verbindung prüfen.'})])])
 ])]);
 task('Antwortzeit_Vorbei',[cond('Phase','==','feedback',[prop('Act_Antwortzeit_Ende',{FeedbackFertig:true,'AntwortTimer.enabled':false}),run('Weiter_Nach_Antwort')])]);
 task('Weiter_Nach_Antwort',[cond('Phase','==','feedback',[cond('FeedbackFertig','==',true,[cond('BuchungFertig','==',true,[prop('Act_Antwort_Weiter',{Phase:'next'}),run('Aufgabe_Ziehen')])])])]);
 // Existing end actions keep their result reporting; late answer responses cannot resume the game.
 for(const name of ['Abschluss','App_Beenden']){const seq=(name==='Abschluss'?['Act_Sitzung_Ende','Act_Ergebnis_Rueckmelden']:['Act_Ende_Server','Act_Beendet']).map(name=>({type:'action',name}));task(name,[cond('Phase','!=','ended',[prop('Act_Stop_'+name,{Phase:'ended',Busy:1,...hidden,...locked,'AntwortTimer.enabled':false,'Naechste.visible':false,...(name==='Abschluss'?{'FrageLabel.text':'🎉 Geschafft!','LoesungLabel.text':'','StatusLabel.text':'Richtig: ${Richtig} · Falsch: ${Falsch}'}:{})}),...seq])]);}
 s.tasks.find(t=>t.name==='Bewerten_Richtig').description='Einmal buchen, richtige Antwort zeigen und nach zwei Sekunden weiter.';
 s.tasks.find(t=>t.name==='Bewerten_Falsch').description='Einmal buchen, richtige Antwort zeigen und nach zwei Sekunden weiter.';
 return project;
}
module.exports={configureMathChoices};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../../game-server/public/projects/Kopfrechnen-App.json');const raw=fs.readFileSync(file,'utf8');fs.writeFileSync(file,JSON.stringify(configureMathChoices(JSON.parse(raw)),null,1)+(raw.endsWith('\n')?'\n':''));}
