// Bereichsbezogener CMS-Kern. Keine implizite Rechtevergabe durch Emoji-Einwahl.
const crypto=require('node:crypto');
const {SCHEMA_VERSION}=require('./cms-migrations.cjs');
// Kanonische Form von Emoji-Codes sind IDs; ältere Codes sind als Zeichen gespeichert.
const EMOJI_IDS=['dog','cat','tree','house','elephant','owl','flower','pig'];
const EMOJI_GLYPHS=['🐶','🐱','🌳','🏠','🐘','🦉','🌷','🐷'];
const GLYPH_TO_ID=new Map(EMOJI_GLYPHS.map((g,i)=>[g,EMOJI_IDS[i]]));
const ID_TO_GLYPH=new Map(EMOJI_IDS.map((id,i)=>[id,EMOJI_GLYPHS[i]]));
const canonEmojiSeq=seq=>Array.isArray(seq)?seq.map(v=>GLYPH_TO_ID.get(v)||v):seq;
const avatarGlyph=value=>ID_TO_GLYPH.get(value)||value||'🙂';
function validate(db){
 if(db.version!==SCHEMA_VERSION)throw Error('Unbekannte CMS-Datenversion: '+db.version);
 for(const key of ['people','areas','memberships','roles','guardians','games','grants','codes','invites','timeBudgets','playSessions','progress','deviceGrants','parties','gameInvitations','notifications','temporaryRoomAccess'])if(!Array.isArray(db[key]))throw Error('Fehlende Liste: '+key);
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
 for(const p of db.parties){if(!person(p.hostId)||!area(p.areaId)||!db.games.some(g=>g.id===p.gameId))throw Error('Ungültige Partie');for(const m of p.members||[])if(!person(m.personId))throw Error('Ungültiges Partymitglied');}
 for(const i of db.gameInvitations)if(!person(i.inviterPersonId)||!person(i.invitedPersonId)||!db.parties.some(p=>p.id===i.sessionId))throw Error('Ungültige Multiplayer-Einladung');
 for(const n of db.notifications)if(!person(n.recipientPersonId))throw Error('Ungültige Benachrichtigung');
 for(const a of db.temporaryRoomAccess)if(!person(a.personId)||!area(a.roomId)||!db.parties.some(p=>p.id===a.sessionId))throw Error('Ungültiger temporärer Raumzutritt');
 const codes=new Set();for(const c of db.codes){const k=JSON.stringify(canonEmojiSeq(c.sequence));if(!person(c.personId)||!area(c.areaId)||!Array.isArray(c.sequence)||c.sequence.length!==4||codes.has(k))throw Error('Ungültige oder doppelte Emoji-Folge');codes.add(k);}
 return db;
}
function within(db,id,parent){const seen=new Set();while(id&&!seen.has(id)){if(id===parent)return true;seen.add(id);id=db.areas.find(a=>a.id===id)?.parentId;}return false;}
// Eltern-Sicht entsteht ausschließlich aus bestätigten Guardian-Beziehungen
// (E01/E02): Verwaltungsrollen verleihen niemals Zugriff auf fremde Kinder.
function childrenOf(db,guardianId){return db.guardians.filter(g=>g.guardianId===guardianId&&g.status==='confirmed').map(g=>g.childId);}
function guardiansOf(db,childId){return db.guardians.filter(g=>g.childId===childId&&g.status==='confirmed').map(g=>g.guardianId);}
function areaActive(db,id){const seen=new Set();while(id){if(seen.has(id))return false;seen.add(id);const a=db.areas.find(a=>a.id===id);if(!a||!a.active)return false;id=a.parentId;}return seen.size>0;}
function active(db,id){return db.people.some(p=>p.id===id&&p.active);}
function rooms(db,id){const now=Date.now();return db.areas.filter(a=>a.type==='room'&&areaActive(db,a.id)&&(
 db.memberships.some(m=>m.personId===id&&m.active&&m.areaId===a.id)||
 // Raumverwaltung schließt Zutritt ein: ein areaAdmin betritt den Raum,
 // den er verwaltet, ohne separate Mitgliedschaft.
 db.roles.some(r=>r.personId===id&&r.role==='areaAdmin'&&r.areaId===a.id&&r.active)||
 (db.temporaryRoomAccess||[]).some(x=>x.personId===id&&x.roomId===a.id&&x.active&&Number(x.expiresAt)>now)
));}
function houseOf(db,areaId){let a=db.areas.find(x=>x.id===areaId),seen=new Set();while(a&&a.type!=='house'&&!seen.has(a.id)){seen.add(a.id);a=db.areas.find(x=>x.id===a.parentId);}return a?.type==='house'?a:null;}
// Haus einer Person über ihre aktive Hausmitgliedschaft.
function houseOfPerson(db,personId){
 const m=db.memberships.find(m=>m.personId===personId&&m.active&&areaActive(db,m.areaId));
 return m?houseOf(db,m.areaId)?.id||null:null;
}
// Wirksame Verwaltungsrollen der Sitzung: activeRole scopet (null = noch
// keine Wahl → keine Rolle), fehlende Angabe nutzt alle aktiven Rollen.
function activeRoles(db,session){
 if(session.activeRole===null)return[];
 const all=db.roles.filter(r=>r.personId===session.personId&&r.active&&areaActive(db,r.areaId));
 return session.activeRole?all.filter(r=>r.role===session.activeRole.role&&r.areaId===session.activeRole.areaId):all;
}
// Stapel-Sichtbarkeit für ein Kind: eigener Stapel immer; sonst nur
// veröffentlichte — entweder dem Kind zugeordnet oder freigegebener
// Kind-Stapel aus demselben Haus (Zuordnung an Kinder, nicht Räume).
function deckVisibleForChild(db,deck,childId){
 if(deck.ownerId===childId)return true;
 if(!deck.published||deck.pendingApproval)return false;
 if((deck.assignedChildIds||[]).includes(childId))return true;
 return deck.ownerType==='child'&&deck.houseId&&deck.houseId===houseOfPerson(db,childId);
}
function can(db,session,action,{areaId,game,childId,deck}={}){
 if(!session||!active(db,session.personId))return false;
 if(action==='play'){
  const permanent=rooms(db,session.personId).some(r=>r.id===areaId);
  const temporary=db.temporaryRoomAccess.some(a=>a.personId===session.personId&&a.roomId===areaId&&a.active&&a.expiresAt>Date.now());
  const house=houseOf(db,areaId);
  const granted=db.grants.some(g=>g.gameId===game?.id&&g.active&&(g.areaId===areaId||g.areaId===house?.id));
  return game?.status==='published'&&(permanent||temporary)&&granted;
 }
 // Elternsicht: nur über bestätigte Beziehung, unabhängig von assurance/ Rolle.
 if(action==='viewChild'||action==='viewProgress')return childrenOf(db,session.personId).includes(childId);
 // Karteikasten: das Kind selbst (jede aktive Sitzung) oder ein bestätigter
 // Erziehungsberechtigter. Feinrechte (eigene vs. fremde Karten) liegen in
 // den Card-Methoden, nicht in can().
 if(action==='manageCards'||action==='viewCards')return session.personId===childId||childrenOf(db,session.personId).includes(childId);
 // Kartenstapel: Sicht- und Importkontext ist der Karteikasten eines Kindes
 // (das Kind selbst oder bestätigte Erziehungsberechtigte, wie bei Karten).
 if(action==='viewDecks'||action==='importDeck')return session.personId===childId||childrenOf(db,session.personId).includes(childId);
 if(action==='viewDeck')return!!deck&&(session.personId===childId||childrenOf(db,session.personId).includes(childId))&&deckVisibleForChild(db,deck,childId);
 // Stapel erstellen: Kinder (eigene Stapel) sowie Erwachsene mit Mandat —
 // Eltern (bestätigte Kinder), Haus-/RaumAdmin oder SuperAdmin.
 if(action==='createDeck'){
  const p=db.people.find(x=>x.id===session.personId);
  if(!p)return false;
  if(p.kind==='child')return true;
  return childrenOf(db,session.personId).length>0||activeRoles(db,session).some(r=>['areaAdmin','superAdmin'].includes(r.role));
 }
 // Stapel pflegen: Ersteller (Kind nur solange unveröffentlicht — danach
 // eingefroren) plus Moderation durch SuperAdmin/HouseAdmin des Stapel-Hauses.
 if(action==='manageDeck'){
  if(!deck)return false;
  if(deck.ownerId===session.personId){
   const p=db.people.find(x=>x.id===session.personId);
   return p?.kind==='child'?!deck.published:true;
  }
  return activeRoles(db,session).some(r=>(r.role==='superAdmin'&&r.areaId==='root')||(r.role==='areaAdmin'&&deck.houseId&&r.areaId===deck.houseId));
 }
 // Freigabe veröffentlichter Kind-Stapel: Erziehungsberechtigte des Kindes,
 // HouseAdmin des Stapel-Hauses oder SuperAdmin (Kinderschutz).
 if(action==='approveDeck'){
  if(!deck||deck.ownerType!=='child'||!deck.pendingApproval)return false;
  if(childrenOf(db,session.personId).includes(deck.ownerId))return true;
  return activeRoles(db,session).some(r=>(r.role==='superAdmin'&&r.areaId==='root')||(r.role==='areaAdmin'&&deck.houseId&&r.areaId===deck.houseId));
 }
 // Stapel einem Kind zuordnen — rollenbegrenzt: Eltern nur eigene Kinder,
 // HouseAdmin Kinder seines Hauses, RaumAdmin Kinder seiner Räume,
 // SuperAdmin alle. Fremde Stapel nur wenn veröffentlicht.
 if(action==='assignDeck'){
  if(!deck||!childId||!(deck.published||deck.ownerId===session.personId))return false;
  if(childrenOf(db,session.personId).includes(childId))return true;
  const rs=activeRoles(db,session);
  if(rs.some(r=>r.role==='superAdmin'&&r.areaId==='root'))return true;
  const childHouse=houseOfPerson(db,childId);
  if(childHouse&&rs.some(r=>r.role==='areaAdmin'&&r.areaId===childHouse))return true;
  return rs.some(r=>r.role==='areaAdmin'&&db.areas.find(a=>a.id===r.areaId)?.type==='room'&&db.memberships.some(m=>m.personId===childId&&m.areaId===r.areaId&&m.active&&areaActive(db,m.areaId)));
 }
 // Beobachter: eigene Rolle auf Raum/Haus, kein Admin-Zugang nötig (E01).
 if(action==='observe')return db.roles.some(r=>r.personId===session.personId&&r.role==='observer'&&r.active&&areaActive(db,r.areaId)&&within(db,areaId,r.areaId));
 if(session.assurance!=='admin'){
  // RaumAdmin agiert über die Konto-Sitzung in der gewählten Raum-Rolle.
  if(action==='manageArea')return session.activeRole?.role==='areaAdmin'&&areaActive(db,session.activeRole.areaId)&&db.roles.some(r=>r.personId===session.personId&&r.role==='areaAdmin'&&r.areaId===session.activeRole.areaId&&r.active)&&within(db,areaId,session.activeRole.areaId);
  return false;
 }
 // Verwaltungsrollenwahl: noch nicht gewählte Rolle (null) sperrt, die
 // gewählte scopet die Sitzung; Sitzungen ohne Feld (legacy) nutzen alle Rollen.
 if(session.activeRole===null)return false;
 const roles=session.activeRole?[session.activeRole]:db.roles.filter(r=>r.personId===session.personId&&r.active&&areaActive(db,r.areaId));
 if(action==='moderate')return roles.some(r=>r.role==='oversight'&&r.areaId==='root');
 if(action==='publish'||action==='editOwnGame')return roles.some(r=>r.role==='superAdmin'&&r.areaId==='root')&&(!game||game.ownerId===session.personId);
 if(action==='manageArea')return roles.some(r=>['areaAdmin','superAdmin'].includes(r.role)&&within(db,areaId,r.areaId));
 return false;
}
function createCore(db){validate(db);const sessions=new Map(),roomPresence=new Map(),presenceTtlMs=Number(process.env.CMS_ROOM_PRESENCE_MS)||90000;
 function login(sequence,onStep=()=>{}){const wanted=JSON.stringify(canonEmojiSeq(sequence)),matches=db.codes.filter(c=>JSON.stringify(canonEmojiSeq(c.sequence))===wanted);onStep('Zugangsdaten zuordnen',{output:{matched:matches.length===1,matches:matches.length}});if(matches.length!==1)return null;const c=matches[0],areaId=c.areaId,personActive=active(db,c.personId),houseActive=areaActive(db,areaId);onStep('Person und Bereich prüfen',{output:{personActive,houseActive}});const memberActive=db.memberships.some(m=>m.personId===c.personId&&m.areaId===areaId&&m.active&&areaActive(db,m.areaId));onStep('Hausmitgliedschaft prüfen',{output:{memberActive,areaId}});if(!personActive||!houseActive||!memberActive)return null;const token=crypto.randomBytes(32).toString('hex');
 // Konto-Rollenwahl (Emoji-Kanal): jede Einwahl ist Spieler; kommen
 // Raumverwaltungsrollen (areaAdmin auf Räumen dieses Hauses) hinzu,
 // wartet die Sitzung mit activeRole=null auf die Wahl.
 const accountRoles=[{role:'player',areaId,label:'Als Spieler · '+(db.areas.find(a=>a.id===areaId)?.name||areaId)}];
 for(const r of db.roles.filter(r=>r.personId===c.personId&&r.role==='areaAdmin'&&r.active&&areaActive(db,r.areaId)&&db.areas.find(a=>a.id===r.areaId)?.type==='room'&&houseOf(db,r.areaId)?.id===areaId))
  accountRoles.push({role:'areaAdmin',areaId:r.areaId,label:'Raumverwaltung · '+(db.areas.find(a=>a.id===r.areaId)?.name||r.areaId)});
 // Erziehungsberechtigte bekommen ihren Kontext nicht über den Emoji-Kanal —
 // ihr Zugang ist der Passwort-Login (cms-admin-auth.json) mit 'account'-Sitzung.
 sessions.set(token,{personId:c.personId,assurance:'profile',authVersion:db.people.find(p=>p.id===c.personId)?.authVersion||0,expires:Date.now()+3600000,houseId:areaId,accountRoles,activeRole:accountRoles.length===1?accountRoles[0]:null});onStep('Spielersitzung erstellen',{output:{personId:c.personId,assurance:'profile',validSeconds:3600}});return {token,person:db.people.find(p=>p.id===c.personId),roles:accountRoles,houseId:areaId,needRole:accountRoles.length>1};}
 function session(token){const s=sessions.get(token);if(!s||s.expires<=Date.now()||!active(db,s.personId)||(db.people.find(p=>p.id===s.personId)?.authVersion||0)!==(s.authVersion||0)){sessions.delete(token);return null;}return s;}
 function prunePresence(now=Date.now()){for(const [personId,row]of roomPresence)if(now-row.lastSeenAt>=presenceTtlMs)roomPresence.delete(personId);}
 function clearPresence(personId){if(personId)roomPresence.delete(personId);}
 function setPresence(personId,roomId,present,now=Date.now()){prunePresence(now);if(!present){clearPresence(personId);return{ok:true,message:'Raum verlassen.'};}if(!roomId||!rooms(db,personId).some(r=>r.id===roomId))return{ok:false,status:403,message:'Für diesen Raum fehlt der Zutritt.'};roomPresence.set(personId,{roomId,lastSeenAt:now});return{ok:true,message:'Raum geöffnet.'};}
 function presenceFor(roomId,now=Date.now()){prunePresence(now);return[...roomPresence].filter(([personId,row])=>row.roomId===roomId&&active(db,personId)).map(([personId])=>personId);}
 function logout(token){const s=sessions.get(token);sessions.delete(token);if(s)clearPresence(s.personId);}
 // Verifizierte Konto-Sitzung (Eltern/Beobachter): Aufrufer muss Zugangsdaten
 // selbst geprüft haben — issueSession prüft nichts.
 function issueSession(personId,assurance='account',ttlMs=3600000){if(!active(db,personId))return null;const token=crypto.randomBytes(32).toString('hex');sessions.set(token,{personId,assurance,authVersion:db.people.find(p=>p.id===personId)?.authVersion||0,expires:Date.now()+ttlMs});return token;}
 return {db,login,session,logout,dropPerson:id=>{for(const [t,s]of sessions)if(s.personId===id)sessions.delete(t);clearPresence(id);},rooms:id=>rooms(db,id),childrenOf:id=>childrenOf(db,id),guardiansOf:id=>guardiansOf(db,id),issueSession,can:(s,a,c)=>can(db,s,a,c),setPresence,presenceFor,clearPresence,presenceTtlMs};
}
module.exports={areaActive,validate,within,can,rooms,houseOf,houseOfPerson,activeRoles,deckVisibleForChild,childrenOf,guardiansOf,createCore,canonEmojiSeq,avatarGlyph,EMOJI_IDS};
