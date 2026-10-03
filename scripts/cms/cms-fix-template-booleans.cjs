const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
/** Einmaliger Patch (keine Laufzeitlogik): Client-HTTP-Bodies mit '${Var}'
 *  werden vom Runtime-Templating als String gesendet — boolesche Felder wie
 *  'active' wurden deshalb von EingabePruefung.boolean abgelehnt (400).
 *  Die betroffenen Actions der drei Super-Stages (ohne generatedBy-Schutz,
 *  Re-Run der Migrations-Skripte wuerde Editoraenderungen ueberschreiben)
 *  werden in je zwei Varianten mit literalem true/false aufgeteilt; die
 *  aufrufende Stelle verzweigt auf die Zielvariable — gleiches Muster wie
 *  Act_Annehmen_Server/Act_Ablehnen_Server. Idempotent: No-Op, falls gepatcht. */
const file=path.join(__dirname,'../../game-server/public/projects/GCS-CMS.json');
const raw=fs.readFileSync(file,'utf8');
const project=JSON.parse(raw);
const uid=p=>p+'-'+crypto.randomUUID();

const SITES=[
 {stage:'stage_super_house',action:'Act_AdminSet_Server',condVar:'Ziel',on:'Act_AdminSet_Zuweisen_Server',off:'Act_AdminSet_Entziehen_Server'},
 {stage:'stage_super_house',action:'Act_HausSave_Server',condVar:'GewaehltesHausAktiv',on:'Act_HausSave_Aktiv_Server',off:'Act_HausSave_Inaktiv_Server'},
 {stage:'stage_super_house',action:'Act_AnAus_Server',condVar:'ZielAktiv',on:'Act_AnAus_Aktivieren_Server',off:'Act_AnAus_Deaktivieren_Server'},
 {stage:'stage_super_admin_detail',action:'Act_Rolle_Server',condVar:'ZielRolle',on:'Act_Rolle_Erlauben_Server',off:'Act_Rolle_Entziehen_Server'},
 {stage:'stage_super_admin_detail',action:'Act_Konto_Server',condVar:'ZielAktiv',on:'Act_Konto_Aktivieren_Server',off:'Act_Konto_Deaktivieren_Server'},
 {stage:'stage_super_admins',action:'Act_AdminSet_Server',condVar:'Ziel',on:'Act_AdminSet_Zuweisen_Server',off:'Act_AdminSet_Entziehen_Server'},
];

const replaceStep=(seq,site)=>{
 let n=0;
 (seq||[]).forEach((s,i)=>{
  if(s.type==='action'&&s.name===site.action){
   seq[i]={type:'condition',name:'Branch: '+site.condVar+' == true',
    condition:{variable:site.condVar,operator:'==',value:true},
    then:[{type:'action',name:site.on}],else:[{type:'action',name:site.off}]};
   n++;
  }
  n+=replaceStep(s.then,site)+replaceStep(s.else,site)+replaceStep(s.body,site);
 });
 return n;
};

let changed=0;
for(const site of SITES){
 const s=project.stages.find(x=>x.id===site.stage);
 if(!s)throw Error('Stage fehlt: '+site.stage);
 if(s.actions.some(a=>a.name===site.on))continue;
 const orig=s.actions.find(a=>a.name===site.action);
 if(!orig)throw Error(site.stage+': Action fehlt: '+site.action);
 if(!orig.body||typeof orig.body!=='object'||!('active' in orig.body))
  throw Error(site.stage+': '+site.action+' hat kein boolesches active-Feld.');
 for(const [name,flag] of [[site.on,true],[site.off,false]]){
  const a=JSON.parse(JSON.stringify(orig));
  a.id=uid('act');a.name=name;a.body.active=flag;s.actions.push(a);
 }
 s.actions=s.actions.filter(a=>a!==orig);
 const n=s.tasks.reduce((acc,t)=>acc+replaceStep(t.actionSequence,site),0);
 if(!n)throw Error(site.stage+': kein Aufruf von '+site.action+' gefunden.');
 changed+=n;
}
if(!changed){console.log('bereits gepatcht — nichts zu tun.');process.exit(0);}
fs.writeFileSync(file,JSON.stringify(project,null,1)+(raw.endsWith('\n')?'\n':''));
console.log('Gepatcht: '+changed+' Aufrufstellen aufgeteilt (literaler Boolean im Body).');
