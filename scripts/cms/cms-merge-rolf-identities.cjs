/* cms-merge-rolf-identities.cjs — Identitätszusammenführung (einmalig).
 *
 * Es existierten zwei erwachsene „Rolf"-Personen:
 *   person-8774ad52… → superAdmin@root        (Credential „rolf")
 *   person-925be8c2… → areaAdmin@Haus Rolf    (Credential „Rolf")
 * Damit die Rollenwahl greift, gehören beide Verwaltungsrollen zu einer
 * Person: die areaAdmin-Rolle wird auf person-8774ad52 umgehängt,
 * person-925be8c2 deaktiviert (Historie bleibt lesbar) und der
 * doppelte Credential-Eintrag „Rolf" entfernt.
 * Ausführen: node scripts/cms/cms-merge-rolf-identities.cjs
 */
const fs=require('fs'),path=require('path');
const root=path.join(__dirname,'..','..');
const KEEP='person-8774ad52-1d82-4ce8-9475-b747c39297c1';
const DROP='person-925be8c2-547f-443d-80ea-bfc6e337682a';

const dataPath=path.join(root,'game-server','data','cms-v1.json');
const db=JSON.parse(fs.readFileSync(dataPath,'utf8'));

let moved=0,deactivated=false;
for(const r of db.roles)if(r.personId===DROP&&r.active){r.personId=KEEP;moved++;}
const dup=db.people.find(p=>p.id===DROP);
if(dup&&dup.active){dup.active=false;deactivated=true;}
fs.writeFileSync(dataPath,JSON.stringify(db,null,2));

const authPath=path.join(root,'game-server','data','cms-admin-auth.json');
const auth=JSON.parse(fs.readFileSync(authPath,'utf8'));
const kept=auth.filter(e=>e.personId!==DROP);
if(kept.length!==auth.length)fs.writeFileSync(authPath,JSON.stringify(kept,null,2));

console.log(JSON.stringify({rolesMoved:moved,duplicateDeactivated:deactivated,credentialsRemoved:auth.length-kept.length}));
