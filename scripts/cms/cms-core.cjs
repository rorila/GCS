// Bereichsbezogener CMS-Kern. Keine implizite Rechtevergabe durch Emoji-Einwahl.
const crypto=require('node:crypto');
const {SCHEMA_VERSION}=require('./cms-migrations.cjs');
// Kanonische Form von Emoji-Codes sind IDs; ältere Codes sind als Zeichen gespeichert.
const EMOJI_IDS=['dog','cat','tree','house','elephant','owl','flower','pig'];
const EMOJI_GLYPHS=['🐶','🐱','🌳','🏠','🐘','🦉','🌷','🐷'];
const GLYPH_TO_ID=new Map(EMOJI_GLYPHS.map((g,i)=>[g,EMOJI_IDS[i]]));
const canonEmojiSeq=seq=>Array.isArray(seq)?seq.map(v=>GLYPH_TO_ID.get(v)||v):seq;
function validate(db){
 if(db.version!==SCHEMA_VERSION)throw Error('Unbekannte CMS-Datenversion: '+db.version);
 for(const key of ['people','areas','memberships','roles','guardians','games','grants','codes','invites','timeBudgets','playSessions','progress','deviceGrants'])if(!Array.isArray(db[key]))throw Error('Fehlende Liste: '+key);
 for(const key of ['people','areas','games'])if(new Set(db[key].map(x=>x.id)).size!==db[key].length)throw Error('Doppelte IDs: '+key);
 const person=id=>db.people.some(p=>p.id===id),area=id=>db.areas.some(a=>a.id===id);
 for(const p of db.people)if(!['child','adult'].includes(p.kind))throw Error('Ungültige Personenart: '+p.id);
 for(const a of db.areas){const seen=new Set([a.id]);let p=a.parentId;while(p){if(seen.has(p)||!area(p))throw Error('Ungültige Bereichshierarchie');seen.add(p);p=db.areas.find(x=>x.id===p).parentId;}}
 for(const x of [...db.memberships,...db.roles])if(!person(x.personId)||!area(x.areaId))throw Error('Ungültige Person-/Bereichsreferenz');
 for(const x of db.guardians)if(!person(x.childId)||!person(x.guardianId)||x.childId===x.guardianId||!['pending','confirmed','revoked'].includes(x.status))throw Error('Ungültige Erziehungsbeziehung');
 for(const g of db.games)if(!person(g.ownerId))throw Error('Ungültiger Spieleigentümer');
 for(const g of db.grants)if(!area(g.areaId)||!db.games.some(x=>x.id===g.gameId))throw Error('Ungültige Spielfreigabe');
 for(const i of db.invites)if(!person(i.personId)||!area(i.houseId)||typeof i.hash!=='string'||typeof i.purpose!=='string')throw Error('Ungültige Einladung');
 for(const t of db.timeBudgets)if(!person(t.childId))throw Error('Ungültiges Zeitbudget');
 for(const s of db.playSessions)if(!person(s.childId)||!db.games.some(g=>g.id===s.gameId))throw Error('Ungültige Spielsitzung');
 for(const r of db.progress)if(!person(r.childId)||typeof r.metric!=='string'||typeof r.eventId!=='string')throw Error('Ungültige Bewertung');
 for(const d of db.deviceGrants)if(!area(d.houseId))throw Error('Ungültige Gerätefreigabe');
 const codes=new Set();for(const c of db.codes){const k=c.areaId+':'+JSON.stringify(canonEmojiSeq(c.sequence));if(!person(c.personId)||!area(c.areaId)||!Array.isArray(c.sequence)||c.sequence.length!==4||codes.has(k))throw Error('Ungültige oder doppelte Emoji-Folge');codes.add(k);}
 return db;
}
function within(db,id,parent){const seen=new Set();while(id&&!seen.has(id)){if(id===parent)return true;seen.add(id);id=db.areas.find(a=>a.id===id)?.parentId;}return false;}
// Eltern-Sicht entsteht ausschließlich aus bestätigten Guardian-Beziehungen
// (E01/E02): Verwaltungsrollen verleihen niemals Zugriff auf fremde Kinder.
function childrenOf(db,guardianId){return db.guardians.filter(g=>g.guardianId===guardianId&&g.status==='confirmed').map(g=>g.childId);}
function guardiansOf(db,childId){return db.guardians.filter(g=>g.childId===childId&&g.status==='confirmed').map(g=>g.guardianId);}
function areaActive(db,id){const seen=new Set();while(id){if(seen.has(id))return false;seen.add(id);const a=db.areas.find(a=>a.id===id);if(!a||!a.active)return false;id=a.parentId;}return seen.size>0;}
function active(db,id){return db.people.some(p=>p.id===id&&p.active);}
function rooms(db,id){return db.areas.filter(a=>a.type==='room'&&areaActive(db,a.id)&&db.memberships.some(m=>m.personId===id&&m.active&&m.areaId===a.id));}
function can(db,session,action,{areaId,game,childId}={}){
 if(!session||!active(db,session.personId))return false;
 if(action==='play')return game?.status==='published'&&rooms(db,session.personId).some(r=>r.id===areaId)&&db.grants.some(g=>g.gameId===game.id&&g.areaId===areaId&&g.active);
 // Elternsicht: nur über bestätigte Beziehung, unabhängig von assurance/ Rolle.
 if(action==='viewChild'||action==='viewProgress')return childrenOf(db,session.personId).includes(childId);
 // Beobachter: eigene Rolle auf Raum/Haus, kein Admin-Zugang nötig (E01).
 if(action==='observe')return db.roles.some(r=>r.personId===session.personId&&r.role==='observer'&&r.active&&areaActive(db,r.areaId)&&within(db,areaId,r.areaId));
 if(session.assurance!=='admin')return false;
 const roles=db.roles.filter(r=>r.personId===session.personId&&r.active&&areaActive(db,r.areaId));
 if(action==='moderate')return roles.some(r=>r.role==='oversight'&&r.areaId==='root');
 if(action==='publish'||action==='editOwnGame')return roles.some(r=>r.role==='superAdmin'&&r.areaId==='root')&&(!game||game.ownerId===session.personId);
 if(action==='manageArea')return roles.some(r=>['areaAdmin','superAdmin'].includes(r.role)&&within(db,areaId,r.areaId));
 return false;
}
function createCore(db){validate(db);const sessions=new Map();
 function login(areaId,sequence,onStep=()=>{}){const wanted=JSON.stringify(canonEmojiSeq(sequence));const c=db.codes.find(c=>c.areaId===areaId&&JSON.stringify(canonEmojiSeq(c.sequence))===wanted);onStep('Zugangsdaten zuordnen',{output:{matched:!!c}});if(!c)return null;const personActive=active(db,c.personId),houseActive=areaActive(db,areaId);onStep('Person und Bereich prüfen',{output:{personActive,houseActive}});if(!personActive||!houseActive)return null;const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{personId:c.personId,assurance:'profile',expires:Date.now()+3600000});onStep('Spielersitzung erstellen',{output:{personId:c.personId,assurance:'profile',validSeconds:3600}});return {token,person:db.people.find(p=>p.id===c.personId)};}
 function session(token){const s=sessions.get(token);if(!s||s.expires<=Date.now()||!active(db,s.personId)){sessions.delete(token);return null;}return s;}
 // Verifizierte Konto-Sitzung (Eltern/Beobachter): Aufrufer muss Zugangsdaten
 // selbst geprüft haben — issueSession prüft nichts.
 function issueSession(personId,assurance='account',ttlMs=3600000){if(!active(db,personId))return null;const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{personId,assurance,expires:Date.now()+ttlMs});return token;}
 return {db,login,session,logout:token=>sessions.delete(token),dropPerson:id=>{for(const [t,s]of sessions)if(s.personId===id)sessions.delete(t);},rooms:id=>rooms(db,id),childrenOf:id=>childrenOf(db,id),guardiansOf:id=>guardiansOf(db,id),issueSession,can:(s,a,c)=>can(db,s,a,c)};
}
module.exports={areaActive,validate,within,can,rooms,childrenOf,guardiansOf,createCore,canonEmojiSeq,EMOJI_IDS};
