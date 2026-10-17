// Add optional distractors without changing the meaning of the accepted answers field.
function configureCardChoiceEditor(project){
 const s=project.stages.find(s=>s.id==='stage_card_edit');if(!s)throw Error('Karteneditor fehlt.');
 const by=name=>s.objects.find(o=>o.name===name);
 const clone=(source,name,extra)=>{if(!by(name))s.objects.push({...structuredClone(by(source)),id:'card_choice_'+name,name,...extra});};
 by('AntwortLabel').text='RICHTIGE ANTWORTEN';
 clone('AntwortLabel','FalscheAntwortenLabel',{text:'FALSCHE ANTWORTEN (OPTIONAL)',x:4,y:31,width:56,height:1.5});
 clone('AntwortenNeu','FalscheAntwortenNeu',{text:'',placeholder:'Zum Beispiel 54; 60 — leer: bei Zahlen automatisch erzeugen',x:4,y:33,width:56,height:3});
 by('KarteSpeichern').y=38;by('KarteLoeschen').y=38;by('Hinweis').y=43;s.grid.rows=Math.max(s.grid.rows,47);
 for(const o of s.objects){if(o.name==='Panel_stage_card_edit_2')o.height=34.4;if(o.name==='Panel_stage_card_edit_3')o.y=42.4;}
 s.actions.find(a=>a.name==='Act_Modus_Neu').changes['FalscheAntwortenNeu.text']='';
 s.actions.find(a=>a.name==='Act_Karte_Uebernehmen').changes['FalscheAntwortenNeu.text']='${KarteAntwort.card.wrongAnswersText}';
 const save=s.actions.find(a=>a.name==='Act_Speichern_Server');if(typeof save.body==='string')save.body=JSON.parse(save.body);save.body.wrongAnswers='${FalscheAntwortenNeu.text}';
 const server=project.stages.find(s=>s.id==='stage_server_cards');
 for(const a of server?.actions||[])if(a.target==='Karten'&&a.method==='save'&&a.params?.[0])a.params[0].wrongAnswers='$body.wrongAnswers';
 return project;
}
module.exports={configureCardChoiceEditor};
if(require.main===module){const fs=require('node:fs'),path=require('node:path'),file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');const raw=fs.readFileSync(file,'utf8');fs.writeFileSync(file,JSON.stringify(configureCardChoiceEditor(JSON.parse(raw)),null,2)+(raw.endsWith('\n')?'\n':''));}
