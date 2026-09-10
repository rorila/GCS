// Einmaliger, lokal ausgeführter Bootstrap des bisherigen Verwaltungszugangs.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {validate}=require('./cms-core.cjs'),{fileStore}=require('./cms-admin.cjs');
const dir=path.resolve(__dirname,'../../game-server/data'),file=path.join(dir,'cms-v1.json');
const db=JSON.parse(fs.readFileSync(file,'utf8'));
if(db.roles.some(r=>r.role==='superAdmin'&&r.areaId==='root'&&r.active)){console.log('SuperAdmin existiert bereits; keine Änderung.');process.exit(0);}
const credentials=JSON.parse(fs.readFileSync(path.join(dir,'cms-admin-auth.json'),'utf8')),account=credentials.find(c=>c.username==='verwaltung');
if(!account||!db.people.some(p=>p.id===account.personId&&p.active)||!db.areas.some(a=>a.id==='root'&&a.active))throw Error('Bestehender Verwaltungszugang oder aktiver Wurzelbereich fehlt.');
db.roles.push({personId:account.personId,areaId:'root',role:'superAdmin',active:true});db.audit=[...(db.audit||[]),{id:crypto.randomUUID(),at:new Date().toISOString(),actor:account.personId,action:'local-superadmin-bootstrap',areaId:'root'}];validate(db);fileStore(file).save(db);console.log('Bisheriger Zugang verwaltung erhält die SuperAdmin-Rolle. Passwort unverändert.');
