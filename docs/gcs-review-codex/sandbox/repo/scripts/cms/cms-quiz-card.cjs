// Paper flashcard presentation using the runtime's existing flip/midpoint action.
const fs=require('node:fs'),path=require('node:path');
function configureQuizCard(project){
 const s=project.stages.find(s=>s.id==='stage_quiz');if(!s)throw Error('Quiz-Stage fehlt.');
 const flatten=os=>(os||[]).flatMap(o=>[o,...flatten(o.children)]),objects=flatten(s.objects),by=n=>objects.find(o=>o.name===n);
 const up=(list,name,data)=>{const old=list.find(o=>o.name===name);if(old)Object.assign(old,data);else list.push({id:'quiz_paper_'+name,name,scope:'stage',...data});};
 const object=(name,className,x,y,width,height,extra={})=>({id:'quiz_paper_'+name,name,className,scope:'stage',x,y,width,height,visible:true,zIndex:1,align:'NONE',rotation:0,draggable:false,droppable:false,...extra});
 const text=(name,value,x,y,w,h,size,color='#193b5c',bg='transparent')=>object(name,'TLabel',x,y,w,h,{text:value,style:{fontSize:size,color,fontFamily:'Segoe UI, sans-serif',textAlign:'center',backgroundColor:bg,borderWidth:0,borderRadius:4}});
 const front=['FrageLabel','KartenSymbol','KartenStapel','KartenArt','KartenAutor'];
 const frontVisible=value=>Object.fromEntries(front.map(name=>[name+'.visible',value]));
 const question=by('FrageLabel'),solution=by('LoesungLabel');
 Object.assign(question,{x:3,y:4,width:34,height:14,zIndex:1,style:{color:'#193b5c',fontSize:38,fontFamily:'Segoe UI, sans-serif',textAlign:'center',backgroundColor:'transparent',borderWidth:0}});
 Object.assign(solution,{x:3,y:3,width:34,height:18,zIndex:1,visible:false,style:{color:'#193b5c',fontSize:56,fontFamily:'Segoe UI, sans-serif',textAlign:'center',backgroundColor:'transparent',borderWidth:0}});
 const paper='data:image/svg+xml;base64,'+fs.readFileSync(path.join(__dirname,'../../public/images/karteikarte-kariert.svg')).toString('base64');
 const card=object('QuizKarte','TPanel',12,7,40,24,{caption:'',zIndex:0,backgroundImage:paper,objectFit:'100% 100%',style:{backgroundColor:'#fffefa',borderWidth:0,borderRadius:8,boxShadow:'0 12px 30px #0005'},children:[
  question,solution,text('KartenSymbol','?',17,1,6,2.5,40,'#c90d0d'),
  text('KartenStapel','',2,20.5,11.3,2,13,'#ffffff','#285984'),text('KartenArt','',14.3,20.5,11.3,2,13,'#ffffff','#285984'),text('KartenAutor','',26.6,20.5,11.3,2,12,'#ffffff','#285984')
 ]});
 s.objects=s.objects.filter(o=>!['QuizKarte',...front,'LoesungLabel'].includes(o.name));s.objects.unshift(card);
 const set=(name,data)=>{const o=by(name);if(o)Object.assign(o,data);};
 s.grid.rows=48;set('Titel',{y:1,height:2.5});set('FachLabel',{visible:false});set('ZaehlerLabel',{y:4,height:1.5});
 for(const name of ['AntwortEdit','AntwortZeigen','Start'])set(name,{y:33});set('AntwortEdit',{x:12,width:24});set('Pruefen',{x:38,y:33,width:14});
 for(const name of ['Richtig','FalschSelbst','Wiederholen'])set(name,{y:36});set('Naechste',{y:36});set('StatusLabel',{y:39,height:2});set('SprachStatus',{y:41.5,height:1.5});
 set('Beenden',{y:44});set('Tastatur',{y:44});set('Lernpunkte',{y:46});
 set('LoesungsTimer',{interval:2550}); // Remaining half-flip (550ms) plus two fully visible seconds.
 const action=(name,type,data)=>{up(s.actions,name,{type,...data});return{type:'action',name};};
 const prop=(name,changes)=>action(name,'property',{changes});
 const changes=name=>s.actions.find(a=>a.name===name)?.changes;
 Object.assign(changes('Act_Ziehen_Start'),{...frontVisible(true),'LoesungLabel.visible':false,'QuizKarte.visible':false});
 Object.assign(changes('Act_Karte_Uebernehmen'),{...frontVisible(true),'LoesungLabel.visible':false,'QuizKarte.visible':true,'KartenStapel.text':'${KartenAntwort.card.deckName}','KartenArt.text':'${KartenAntwort.card.deckSubject}','KartenAutor.text':'${KartenAntwort.card.deckOwnerName}'});
 // Older servers/cards already provide topic, subject and createdByName.
 // Prefer authoritative deck metadata, but keep their existing values visible too.
 const fallbackFields=[['deckName','KartenStapel','topic'],['deckSubject','KartenArt','subject'],['deckOwnerName','KartenAutor','createdByName']];
 up(s.tasks,'Kartenbeschriftung_Ergaenzen',{triggerMode:'local-sync',params:[],actionSequence:fallbackFields.map(([field,label,legacy])=>({type:'condition',condition:{variable:'KartenAntwort.card.'+field,operator:'truthy',value:true},body:[],elseBody:[prop('Act_'+label+'_Bestandskarte',{[label+'.text']:'${KartenAntwort.card.'+legacy+'}'})]}))});
 const addFallback=seq=>{for(let i=0;i<(seq||[]).length;i++){const step=seq[i];if(step.type==='action'&&step.name==='Act_Karte_Uebernehmen'&&seq[i+1]?.name!=='Kartenbeschriftung_Ergaenzen')seq.splice(i+1,0,{type:'task',name:'Kartenbeschriftung_Ergaenzen'});for(const branch of ['body','elseBody','then','else'])addFallback(step[branch]);}};
 addFallback(s.tasks.find(t=>t.name==='Karte_Ziehen').actionSequence);
 Object.assign(changes('Act_BewertenF_Start'),{'LoesungLabel.text':'','LoesungLabel.visible':false,'LoesungsTimer.enabled':false});
 Object.assign(changes('Act_Loesung_Anzeigen'),{...frontVisible(false),'LoesungLabel.visible':true,'LoesungLabel.text':'${AktuelleKarte.answers.0}'});
 Object.assign(changes('Act_Quiz_Stop'),{'LoesungsTimer.enabled':false,'QuizKarte.visible':false});
 const midpoint=prop('Act_Kartenrueckseite',{...frontVisible(false),'LoesungLabel.text':'${AktuelleKarte.answers.0}','LoesungLabel.visible':true,'LoesungsTimer.currentInterval':0,'LoesungsTimer.enabled':true});
 up(s.tasks,'Kartenrueckseite_Zeigen',{triggerMode:'local-sync',params:[],actionSequence:[{type:'condition',condition:{variable:'global.Phase',operator:'==',value:'feedback'},body:[midpoint],elseBody:[]}]});
 const flip=action('Act_Karte_Umdrehen','animate',{target:'QuizKarte',effect:'flip3d',duration:1100,midpointTask:'Kartenrueckseite_Zeigen'});
 const wrong=s.tasks.find(t=>t.name==='Bewerten_Falsch').actionSequence[0].body;
 if(!wrong.some(st=>st.name===flip.name)){const index=wrong.findIndex(st=>st.name==='Act_BewertenF_Start');if(index<0)throw Error('Fehlerfeedback fehlt.');wrong.splice(index+1,0,flip);}
 // Self-rating buttons are named Richtig/Falsch; keep score variables unambiguous.
 for(const [oldName,newName]of [['Richtig','QuizRichtig'],['Falsch','QuizFalsch']]){
  const variable=s.variables.find(v=>v.name===oldName);if(variable)variable.name=newName;
  for(const a of s.actions){
   if(a.resultVariable===oldName)a.resultVariable=newName;
   if(a.formula)a.formula=a.formula.replace(new RegExp('\\b'+oldName+'\\b','g'),newName);
   for(const key of Object.keys(a.changes||{}))if(typeof a.changes[key]==='string')a.changes[key]=a.changes[key].replaceAll('${'+oldName+'}','${'+newName+'}');
   if(a.type==='close_overlay'&&typeof a.result==='string')a.result=a.result.replaceAll('${'+oldName+'}','${'+newName+'}');
  }
 }
 project.meta.paperFlashcard=true;
 return require('./cms-quiz-counting-layout.cjs').apply(project);
}
module.exports={configureQuizCard};
if(require.main===module){const file=path.join(__dirname,'../../game-server/public/projects/Karteikasten-Quiz.json'),raw=fs.readFileSync(file,'utf8');fs.writeFileSync(file,JSON.stringify(configureQuizCard(JSON.parse(raw)),null,1)+(raw.endsWith('\n')?'\n':''));}
