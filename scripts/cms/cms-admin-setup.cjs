// Lokale einmalige Einrichtung. Keine Passwörter im Projekt oder im Browser-Bundle.
const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const dir=path.resolve(__dirname,'../../game-server/data'),auth=path.join(dir,'cms-admin-auth.json');
if(fs.existsSync(auth))throw Error('Verwaltungszugang existiert bereits; wird nicht überschrieben.');
const db=JSON.parse(fs.readFileSync(path.join(dir,'cms-v1.json'),'utf8'));
if(!db.people.some(p=>p.id==='demo-adult'&&p.active))throw Error('Das bestehende Demo-Erwachsenenprofil fehlt.');
const password=crypto.randomBytes(18).toString('base64url'),salt=crypto.randomBytes(16).toString('hex'),hash=crypto.scryptSync(password,salt,64).toString('hex');
fs.writeFileSync(auth,JSON.stringify([{personId:'demo-adult',username:'verwaltung',salt,hash}],null,2),{flag:'wx',mode:0o600});
fs.writeFileSync(path.join(dir,'CMS-VERWALTUNGSZUGANG.txt'),'Lokaler Verwaltungszugang\nhttp://localhost:8081/admin\nBenutzername: verwaltung\nPasswort: '+password+'\n\nPrivat aufbewahren. Das Passwort wird serverseitig nur als scrypt-Hash gespeichert. Diese Übergabedatei kann nach Übernahme ins Passwortprogramm entfernt werden.\n',{flag:'wx',mode:0o600});
console.log('Zugang eingerichtet. Private Übergabedatei: game-server/data/CMS-VERWALTUNGSZUGANG.txt');
