// Bereichsbezogener CMS-Kern. Keine implizite Rechtevergabe durch Emoji-Einwahl.
const crypto=require('node:crypto');
function validate(db){
 if(db.version!==1)throw Error('Unbekannte CMS-Datenversion');
 for(const key of ['people','areas','memberships','roles','guardians','games','grants','codes'])if(!Array.isArray(db[key]))throw Error('Fehlende Liste: '+key);
 for(const key of ['people','areas','games'])if(new Set(db[key].map(x=>x.id)).size!==db[key].length)throw Error('Doppelte IDs: '+key);
 const person=id=>db.people.some(p=>p.id===id),area=id=>db.areas.some(a=>a.id===id);
 for(const a of db.areas){const seen=new Set([a.id]);let p=a.parentId;while(p){if(seen.has(p)||!area(p))throw Error('Ungültige Bereichshierarchie');seen.add(p);p=db.areas.find(x=>x.id===p).parentId;}}
 for(const x of [...db.memberships,...db.roles])if(!person(x.personId)||!area(x.areaId))throw Error('Ungültige Person-/Bereichsreferenz');
 for(const x of db.guardians)if(!person(x.childId)||!person(x.guardianId)||x.childId===x.guardianId)throw Error('Ungültige Erziehungsbeziehung');
 for(const g of db.games)if(!person(g.ownerId))throw Error('Ungültiger Spieleigentümer');
 for(const g of db.grants)if(!area(g.areaId)||!db.games.some(x=>x.id===g.gameId))throw Error('Ungültige Spielfreigabe');
 const codes=new Set();for(const c of db.codes){const k=c.areaId+':'+JSON.stringify(c.sequence);if(!person(c.personId)||!area(c.areaId)||!Array.isArray(c.sequence)||c.sequence.length!==4||codes.has(k))throw Error('Ungültige oder doppelte Emoji-Folge');codes.add(k);}
 return db;
}
function within(db,id,parent){const seen=new Set();while(id&&!seen.has(id)){if(id===parent)return true;seen.add(id);id=db.areas.find(a=>a.id===id)?.parentId;}return false;}
function areaActive(db,id){const seen=new Set();while(id){if(seen.has(id))return false;seen.add(id);const a=db.areas.find(a=>a.id===id);if(!a||!a.active)return false;id=a.parentId;}return seen.size>0;}
function active(db,id){return db.people.some(p=>p.id===id&&p.active);}
function rooms(db,id){return db.areas.filter(a=>a.type==='room'&&areaActive(db,a.id)&&db.memberships.some(m=>m.personId===id&&m.active&&m.areaId===a.id));}
function can(db,session,action,{areaId,game}={}){
 if(!session||!active(db,session.personId))return false;
 if(action==='play')return game?.status==='published'&&rooms(db,session.personId).some(r=>r.id===areaId)&&db.grants.some(g=>g.gameId===game.id&&g.areaId===areaId&&g.active);
 if(session.assurance!=='admin')return false;
 const roles=db.roles.filter(r=>r.personId===session.personId&&r.active&&areaActive(db,r.areaId));
 if(action==='moderate')return roles.some(r=>r.role==='oversight'&&r.areaId==='root');
 if(action==='publish'||action==='editOwnGame')return roles.some(r=>r.role==='superAdmin'&&r.areaId==='root')&&(!game||game.ownerId===session.personId);
 if(action==='manageArea')return roles.some(r=>['areaAdmin','superAdmin'].includes(r.role)&&within(db,areaId,r.areaId));
 return false;
}
function createCore(db){validate(db);const sessions=new Map();
 function login(areaId,sequence,onStep=()=>{}){const c=db.codes.find(c=>c.areaId===areaId&&JSON.stringify(c.sequence)===JSON.stringify(sequence));onStep('Zugangsdaten zuordnen',{output:{matched:!!c}});if(!c)return null;const personActive=active(db,c.personId),houseActive=areaActive(db,areaId);onStep('Person und Bereich prüfen',{output:{personActive,houseActive}});if(!personActive||!houseActive)return null;const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{personId:c.personId,assurance:'profile',expires:Date.now()+3600000});onStep('Spielersitzung erstellen',{output:{personId:c.personId,assurance:'profile',validSeconds:3600}});return {token,person:db.people.find(p=>p.id===c.personId)};}
 function session(token){const s=sessions.get(token);if(!s||s.expires<=Date.now()||!active(db,s.personId)){sessions.delete(token);return null;}return s;}
 return {db,login,session,logout:token=>sessions.delete(token),rooms:id=>rooms(db,id),can:(s,a,c)=>can(db,s,a,c)};
}
module.exports={areaActive,validate,within,can,rooms,createCore};
