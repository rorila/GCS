/* test-cms-role-choice.cjs — Rollenwahl: Serverantwort → Liste → Tabelle.
 *
 * Prüft ohne HTTP-Server die Kette, die im Browser sichtbar sein muss:
 * deklarative Endpunkt-Tasks (cms-runtime) liefern Datensätze, die die
 * echte TObjectList-Komponente (recordKey 'id') akzeptiert und die
 * TTable als Zeilen rendert. Regression für „Keine Daten vorhanden"
 * trotz korrekter Rollen (fehlende Datensatz-ID).
 * Ausführen: npx tsx scripts/test-cms-role-choice.cjs   (oder: node --import tsx)
 */
const assert=require('node:assert/strict');
const path=require('node:path');
const {loadRuntime}=require('./cms/cms-runtime.cjs');
const root=path.join(__dirname,'..');
const project=path.join(root,'game-server/public/projects/GCS-CMS.json');
const runtime=loadRuntime(project);

const checks=[];
const check=(name,ok,extra='')=>{assert.ok(ok,name);checks.push(name+(extra?' — '+extra:''));};

// Endpunkte existieren in der deklarativen Runtime (Editor-Patch vorhanden).
for(const p of ['/api/cms/admin/roles','/api/cms/admin/role','/api/cms/account-roles','/api/cms/account-role'])
 check('Endpunkt registriert: '+p,!!runtime.find(p,'POST'));

const CASES=[
 {stage:'stage_server_admin_login',url:'/api/cms/admin/roles',channel:'adminRoles',assurance:'admin',
  roles:[{role:'superAdmin',areaId:'root',label:'Super-Administration · GCS'},{role:'areaAdmin',areaId:'house-x',label:'Hausverwaltung · Haus X'}],
  expectIds:['superAdmin:root','areaAdmin:house-x']},
 {stage:'stage_server_player',url:'/api/cms/account-roles',channel:'accountRoles',assurance:'profile',
  roles:[{role:'player',areaId:'house-x',label:'Als Spieler · Haus X'},{role:'areaAdmin',areaId:'room-y',label:'Raumverwaltung · Raum Y'}],
  expectIds:['player:house-x','areaAdmin:room-y']},
];

(async()=>{
 const {TObjectList}=await import('../src/components/TObjectList.ts');
 const {TTable}=await import('../src/components/TTable.ts');
 const json=runtime.endpoints?null:null;
 const proj=require(project);
 for(const c of CASES){
  const ep=runtime.find(c.url,'POST');
  const session={personId:'test-person',assurance:c.assurance,[c.channel]:c.roles};
  const result=runtime.run(ep,{session,body:{},emit:()=>{}},{strict:true});
  check('Antwort ok: '+c.url,result.status===200&&result.data.ok===true);
  const rows=result.data.roles;
  check('Rollenanzahl: '+c.url,rows.length===c.roles.length);
  check('Rollen tragen Datensatz-ID: '+c.url,rows.every(r=>typeof r.id==='string'&&r.id.length>0));
  check('IDs stabil/eindeutig: '+c.url,c.expectIds.every(id=>rows.some(r=>r.id===id)));
  // Client-Sicht: die deklarierte Listenkomponente der Wahlseite muss die Daten annehmen.
  const st=proj.stages.find(s=>s.id===(c.channel==='adminRoles'?'stage_admin_roles':'stage_player_roles'));
  const list=Object.assign(new TObjectList('RollenListe',0,0),st.objects.find(o=>o.name==='RollenListe'));
  const table=Object.assign(new TTable('RollenTabelle'),st.objects.find(o=>o.name==='RollenTabelle'));
  table.setDataContext([list,table]);
  check('tryReplaceRecords akzeptiert: '+st.id,list.tryReplaceRecords(rows)===true,list.lastError||'ok');
  check('Tabelle zeigt Zeilen: '+st.id,table.getRows().length===c.roles.length,table.getRows().length+' sichtbar');
 }
 // chooseRole-Pfad: Request-Body muss über '$body' aufgelöst werden und
 // die aktive Rolle der Sitzung setzen. Mini-DB: aktive Haus-/Raum-Areas
 // + passende aktive Rollenzeilen für 'test-person' (für areaActive-Check).
 const db={
  areas:[{id:'house-x',type:'house',name:'Haus X',active:true},{id:'room-y',type:'room',name:'Raum Y',parentId:'house-x',active:true},{id:'room-fremd',type:'room',name:'Fremd',parentId:'house-z',active:true}],
  roles:[{personId:'test-person',role:'superAdmin',areaId:'root',active:true},{personId:'test-person',role:'areaAdmin',areaId:'house-x',active:true},{personId:'test-person',role:'player',areaId:'house-x',active:true},{personId:'test-person',role:'areaAdmin',areaId:'room-y',active:true}],
  people:[{id:'test-person',name:'Test'}],
 };
 const admSess={personId:'test-person',assurance:'admin',adminRoles:[{role:'superAdmin',areaId:'root'},{role:'areaAdmin',areaId:'house-x'}]};
 const chosen=runtime.run(runtime.find('/api/cms/admin/role','POST'),{session:admSess,body:{role:'superAdmin',areaId:'root'},emit:()=>{},core:{db}},{strict:true});
 check('chooseRole ok: admin',chosen.status===200&&chosen.data.ok===true&&chosen.data.target==='/super');
 check('activeRole gesetzt: admin',admSess.activeRole?.role==='superAdmin'&&admSess.activeRole?.areaId==='root');
 const foreign=runtime.run(runtime.find('/api/cms/admin/role','POST'),{session:{personId:'test-person',assurance:'admin',adminRoles:[{role:'superAdmin',areaId:'root'}]},body:{role:'areaAdmin',areaId:'house-x'},emit:()=>{},core:{db}},{strict:true});
 check('Fremdrolle abgelehnt',foreign.data?.ok===false||foreign.status===403);
 const accSess={personId:'test-person',assurance:'profile',houseId:'house-x',accountRoles:[{role:'player',areaId:'house-x'},{role:'areaAdmin',areaId:'room-y'}]};
 const chosenAcc=runtime.run(runtime.find('/api/cms/account-role','POST'),{session:accSess,body:{token:'t',role:'areaAdmin',areaId:'room-y'},emit:()=>{},core:{db}},{strict:true});
 check('chooseRole ok: konto',chosenAcc.status===200&&chosenAcc.data.ok===true&&chosenAcc.data.stage==='stage_room_overview'&&chosenAcc.data.roomId==='room-y');
 // Negativ: ohne Session bleibt der Endpunkt gesperrt.
 const denied=runtime.run(runtime.find('/api/cms/admin/roles','POST'),{session:null,body:{},emit:()=>{}},{strict:true});
 check('Ohne Sitzung abgelehnt',denied.status===401||denied.data?.ok===false);
 console.log(JSON.stringify({passed:checks.length,checks},null,2));
})().catch(e=>{console.error(e);process.exitCode=1;});
