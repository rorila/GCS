/* cms-merge-rolf-child.cjs — Kind-Identität „Rolf" in Erwachsenenkonto überführen (einmalig).
 *
 * person-f49aa775 (kind) trug den Emoji-Code elephant×4 und die player-Rolle
 * auf Haus Rolf. Diese Identität gehört zum Erwachsenenkonto
 * person-8774ad52 (superAdmin + areaAdmin Haus + areaAdmin Gemeinschaftszimmer).
 * Überführt: Emoji-Code und player-Rolle; die doppelte Haus-Mitgliedschaft
 * entfällt, die Kind-Person wird gelöscht (Freigabe: „kann gelöscht werden").
 * Danach gilt: Emoji-Login elephant×4 → Erwachsener → accountRoles
 * [player@Haus, areaAdmin@Gemeinschaftszimmer] → Rollenwahl.
 * Ausführen: node scripts/cms/cms-merge-rolf-child.cjs
 */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const KEEP='person-8774ad52-1d82-4ce8-9475-b747c39297c1';
const DROP='person-f49aa775-f98f-4aa2-93d2-287f4536fcd1';

const dataPath=path.join(root,'game-server','data','cms-v1.json');
const db=JSON.parse(fs.readFileSync(dataPath,'utf8'));

const report={codesMoved:0,rolesMoved:0,membershipsMoved:0,duplicatesRemoved:0,childDeleted:false};

// 1) Alle personId-Referenzen der üblichen Listen auf die Erwachsenen-ID umbiegen.
for(const [list,key]of [['codes','codesMoved'],['roles','rolesMoved'],['memberships','membershipsMoved'],['guardians',''],['invites',''],['timeBudgets',''],['deviceGrants',''],['notifications',''],['parties',''],['temporaryRoomAccess','']]){
 for(const row of db[list]||[]){
  if(row.personId===DROP){row.personId=KEEP;if(key)report[key]++;}
  if(row.childId===DROP)row.childId=KEEP;
  if(row.guardianId===DROP)row.guardianId=KEEP;
 }
}

// 2) Exakte Duplikate entfernen (z. B. Haus-Mitgliedschaft existiert doppelt).
const dedupe=(list,keys)=>{const seen=new Set();db[list]=(db[list]||[]).filter(r=>{const k=keys.map(x=>r[x]).join('|');if(seen.has(k)){report.duplicatesRemoved++;return false;}seen.add(k);return true;});};
dedupe('memberships',['personId','areaId']);
dedupe('roles',['personId','areaId','role']);
dedupe('codes',['personId','areaId']);

// 3) Kind-Person löschen (Referenzen sind alle umgehängt bzw. dedupliziert).
const i=db.people.findIndex(p=>p.id===DROP);
if(i>=0){db.people.splice(i,1);report.childDeleted=true;}

fs.writeFileSync(dataPath,JSON.stringify(db,null,2)+'\n');
console.log(JSON.stringify(report));
