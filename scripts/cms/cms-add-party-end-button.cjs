// Ergänzt in stage_multiplayer_lobby einen "Partie beenden"-Button.
// Hintergrund: Eine Partie im Status open/playing blockiert neue Einladungen
// ("bereits in einer Partie") — beenden/verlassen ging bisher nur aus dem
// Spielframe heraus. Der Button nutzt die vorhandenen deklarativen Endpunkte
// /api/cms/mp/end (Gastgeber: beendet Partie + alle Mitglieds-Sitzungen) und
// /api/cms/mp/leave (Mitglied: verlässt die Partie).
// Idempotent: bricht ab, wenn der Button bereits existiert.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const project=JSON.parse(fs.readFileSync(file,'utf8'));
const uid=prefix=>prefix+'_'+crypto.randomUUID();
const action=(name,type,extra={})=>({id:uid('cms_act'),name,type,scope:'stage',...extra});
const task=(name,actionSequence,description=name)=>({id:uid('cms_task'),name,description,actionSequence,triggerMode:'local-sync',params:[],scope:'stage'});
const A=name=>({type:'action',name}),T=name=>({type:'task',name});
const C=(name,variable,operator,value,then,else_=[])=>({type:'condition',name,condition:{variable,operator,value},then,else:else_});
const http=(name,url,body,resultVariable='Antwort')=>action(name,'http',{url,method:'POST',body,resultVariable,queryOperator:'=='});
const prop=(name,changes)=>action(name,'property',{changes});
const variable=(name,type,def)=>({className:type==='string'?'TStringVariable':'TBooleanVariable',id:uid('cms_var'),name,scope:'stage',draggable:false,droppable:false,dragMode:'move',visible:true,zIndex:0,rotation:0,align:'NONE',collisionEnabled:false,isVariable:true,isHiddenInRun:true,x:0,y:0,width:1,height:1,type,defaultValue:def,value:def,description:''});

const st=project.stages.find(s=>s.id==='stage_multiplayer_lobby');
if(!st)throw Error('stage_multiplayer_lobby fehlt.');
if(st.objects.some(o=>o.name==='PartieBeenden'))throw Error('PartieBeenden existiert bereits — Skript war schon aktiv.');
const A_=n=>{const a=st.actions.find(a=>a.name===n);if(!a)throw Error('Action fehlt: '+n);return a;};
const T_=n=>{const t=st.tasks.find(t=>t.name===n);if(!t)throw Error('Task fehlt: '+n);return t;};

// ── Variablen: gemerkte Partie + eigene Rolle ──
st.variables.push(variable('AktivePartieId','string',''),variable('AktivePartieHost','boolean',false));

// ── Button (Stil wie PartieFortsetzen, warnende Rahmenfarbe) ──
const vorlage=st.objects.find(o=>o.name==='PartieFortsetzen');
if(!vorlage)throw Error('Button PartieFortsetzen fehlt.');
st.objects.push({...structuredClone(vorlage),id:uid('cms_obj'),name:'PartieBeenden',
 text:'⏹ Partie beenden',visible:false,x:3,y:38,
 events:{onClick:'Partie_Beenden'},style:{...vorlage.style,borderColor:'#ef8354'}});

// ── Bestehende Anzeige-Actions erweitern (nur changes-Maps) ──
// Resume-Fall (aktive eigene Mitgliedschaft): Button zeigen + Partie merken.
Object.assign(A_('Act_Resume_Vorhanden').changes,{
 'PartieBeenden.visible':true,
 AktivePartieId:'${ResumeAntwort.item.partyId}',
 AktivePartieHost:'${ResumeAntwort.item.youAreHost}'});
// Rejoin-Fall (ausgetreten, Partie läuft noch): nur der Gastgeber kann die
// Partie noch enden — ein bereits ausgetretenes Mitglied hat nichts zu
// verlassen. Darum Sichtbarkeit nicht pauschal in Act_Rejoin_Vorhanden,
// sondern bedingt im Prüf-Task (s.u.) gesteuert.
Object.assign(A_('Act_Rejoin_Verbergen').changes,{'PartieBeenden.visible':false});
Object.assign(A_('Act_Resume_Verbergen').changes,{'PartieBeenden.visible':false});

// ── Neue Actions ──
st.actions.push(
 http('Act_PartyEnd_Server','/api/cms/mp/end',{token:'${Token}',partyId:'${AktivePartieId}'}),
 http('Act_PartyLeave_Server','/api/cms/mp/leave',{token:'${Token}',partyId:'${AktivePartieId}'}),
 // Rejoin-Fall: Button nur für den Gastgeber sichtbar machen.
 prop('Act_RejoinBeenden_An',{'PartieBeenden.visible':true,AktivePartieId:'${RejoinableAntwort.item.partyId}',AktivePartieHost:true}),
 prop('Act_PartyEnde_Fertig',{
  'PartieBeenden.visible':false,'PartieFortsetzen.visible':false,'PartieWiederbeitreten.visible':false,
  AktivePartieId:'',AktivePartieHost:false,'Status.text':'Partie beendet — du kannst eine neue starten.'})
);

// ── Rejoin-Prüftask: nach Act_Rejoin_Vorhanden den Host-Fall ergänzen ──
const rejoin=T_('Partie_Wiederbeitritt_Pruefen');
const rejoinCond=rejoin.actionSequence.find(i=>i.type==='condition'&&i.condition?.variable==='RejoinableAntwort.ok');
const inner=rejoinCond?.then?.find(i=>i.type==='condition'&&i.condition?.variable==='RejoinableAntwort.rejoin');
if(!inner)throw Error('RejoinableAntwort.rejoin-Bedingung nicht gefunden.');
inner.then=[A('Act_Rejoin_Vorhanden'),
 C('Eigene Partie als Gastgeber?','RejoinableAntwort.item.youAreHost','==',true,[A('Act_RejoinBeenden_An')])];

// ── Task: Klick -> Host beendet, Mitglied verlässt ──
st.tasks.push(task('Partie_Beenden',[
 C('Gastgeber?','AktivePartieHost','==',true,[A('Act_PartyEnd_Server')],[A('Act_PartyLeave_Server')]),
 C('Beenden erfolgreich?','Antwort.ok','==',true,
  [A('Act_PartyEnde_Fertig'),T('Partie_Resume_Pruefen')],
  [T('Fehler')])
],'Beendet die laufende eigene Partie (Gastgeber) bzw. tritt als Mitglied aus.'));

fs.writeFileSync(file,JSON.stringify(project,null,1));
console.log('GCS-CMS.json: Button "PartieBeenden" + Task Partie_Beenden ergänzt (Lobby).');
