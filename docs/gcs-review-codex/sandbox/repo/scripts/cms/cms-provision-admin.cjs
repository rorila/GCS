// Lokale Einrichtung eines zusätzlichen Verwaltungszugangs nach Rollenvergabe.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {can}=require('./cms-core.cjs');
const [personId,username]=process.argv.slice(2);if(!/^[a-zA-Z0-9_-]{1,80}$/.test(personId||'')||!/^[a-zA-Z0-9_-]{3,40}$/.test(username||''))throw Error('Aufruf: node scripts/cms/cms-provision-admin.cjs PERSON-ID BENUTZERNAME');
const dir=path.resolve(__dirname,'../../game-server/data'),file=path.join(dir,'cms-admin-auth.json'),db=JSON.parse(fs.readFileSync(path.join(dir,'cms-v1.json'),'utf8'));
if(!db.areas.some(a=>can(db,{personId,assurance:'admin'},'manageArea',{areaId:a.id})))throw Error('Person hat keine aktive Verwaltungsrolle.');
const entries=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):[];if(entries.some(c=>c.personId===personId||c.username===username))throw Error('Zugang oder Benutzername existiert bereits; kein Überschreiben.');
const password=crypto.randomBytes(18).toString('base64url'),salt=crypto.randomBytes(16).toString('hex');entries.push({personId,username,salt,hash:crypto.scryptSync(password,salt,64).toString('hex')});
const handoff=path.join(dir,'CMS-ZUGANG-'+personId+'.txt');fs.writeFileSync(handoff,'http://localhost:8081/admin\nBenutzername: '+username+'\nPasswort: '+password+'\nPrivat aufbewahren. Nach Übernahme in ein Passwortprogramm kann diese Übergabedatei entfernt werden.\n',{flag:'wx',mode:0o600});
fs.writeFileSync(file+'.tmp',JSON.stringify(entries,null,2),{mode:0o600});fs.renameSync(file+'.tmp',file);console.log('Zugang eingerichtet. Private Übergabedatei: '+handoff);
