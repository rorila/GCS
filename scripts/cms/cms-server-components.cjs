const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {areaActive,canonEmojiSeq,avatarGlyph,EMOJI_IDS,childrenOf,guardiansOf,within,houseOf,houseOfPerson}=require('./cms-core.cjs');
const {isSuper}=require('./cms-super.cjs');
const {createPrivacy}=require('./cms-privacy.cjs');

/** Serverseitige Komponentenmethoden: das einzige Code-Vocabulary, das die Server-Runtime aufrufen darf.
 *  Jede Methode erhält (ctx, component, params) — ctx enthält session, body, core, admin, commit, credentialPath, emit, vars, result. */

// Rollenrichtlinien: welche Prüfung eine requireRole-Anforderung erzwingt und
// mit welcher fachlichen Meldung sie ablehnt.
const ROLES={
 superAdmin:{check:ctx=>isSuper(ctx.core.db,ctx.session),deny:'SuperAdmin-Zuständigkeit erforderlich.'},
 // 'admin' = eine gültige Verwaltungssitzung genügt; die fachliche Zuständigkeit
 // (manageArea) wird danach deklarativ in den Tasks geprüft.
 admin:{check:ctx=>!!ctx.session,deny:'Bitte Verwaltung neu anmelden.'},
 // 'account' = gültige Konto-/Spielersitzung (cms_account oder Token).
 account:{check:ctx=>!!ctx.session,deny:'Bitte neu anmelden.'}
};
// Format-Signatur des Upload-Rohmaterials (Whitelist bleibt in der Komponente).
const sniffImage=b=>b.length>11&&b[0]===0x89&&b[1]===0x50&&b[2]===0x4E&&b[3]===0x47?'png':b[0]===0xFF&&b[1]===0xD8?'jpeg':b.length>11&&b.toString('latin1',0,4)==='RIFF'&&b.toString('latin1',8,12)==='WEBP'?'webp':null;

// Fremd-Avatar (Admin/Betreuer → Bewohner): erlaubt für SuperAdmin,
// bestätigte Erziehungsberechtigte des Kindes (guardians) oder
// HouseAdmin — areaAdmin-Rolle auf einer Area vom Typ 'house', in der
// die Zielperson aktive Mitgliedschaft hat.
const isHouseAdmin=(db,session,houseId)=>{
 if(!session||!houseId)return false;
 const ar=session.activeRole;
 return !!(ar?.role==='areaAdmin'&&ar.areaId===houseId&&db.areas.find(a=>a.id===houseId)?.type==='house'
  &&areaActive(db,houseId)&&db.roles.some(r=>r.personId===session.personId&&r.role==='areaAdmin'&&r.areaId===houseId&&r.active));
};
const canAssignAvatar=(db,session,target)=>{
 if(!session||!target)return false;
 // Verwaltungspfade gelten nur in der gewählten Admin-Rolle der Sitzung
 // (activeRole) — die Rolle muss der Person zudem weiterhin gehören.
 const ar=session.activeRole;
 if(ar?.role==='superAdmin'&&db.roles.some(r=>r.personId===session.personId&&r.role==='superAdmin'&&r.areaId==='root'&&r.active))return true;
 if(target.kind==='child'&&childrenOf(db,session.personId).includes(target.id))return true;
 const houseId=ar?.role==='areaAdmin'&&areaActive(db,ar.areaId)
  &&db.areas.find(a=>a.id===ar.areaId)?.type==='house'
  &&db.roles.some(r=>r.personId===session.personId&&r.role==='areaAdmin'&&r.areaId===ar.areaId&&r.active)
  ?ar.areaId:null;
 if(!houseId)return false;
 return db.memberships.some(m=>m.personId===target.id&&m.active&&areaActive(db,m.areaId)
  &&houseOf(db,m.areaId)?.id===houseId);
};

// Deklaratives Mehrspieler-Flag aus meta.multiplayer der Projektdatei.
// Fehlt es → null (Solospiel); vorhanden, aber fehlerhaft → Upload wird
// laut abgelehnt, damit kein falscher Katalog-Eintrag entsteht.
const readMultiplayer=project=>{
 const mp=project&&project.meta?project.meta.multiplayer:null;
 if(mp===undefined||mp===null)return null;
 if(typeof mp!=='object'||Array.isArray(mp))throw Error('meta.multiplayer muss ein Objekt sein.');
 if(!Number.isInteger(mp.minPlayers)||!Number.isInteger(mp.maxPlayers)||mp.minPlayers<2||mp.maxPlayers<mp.minPlayers||mp.maxPlayers>8)throw Error('meta.multiplayer: minPlayers/maxPlayers als ganze Zahlen (2–8) angeben.');
 const scope=mp.scope===undefined?'house':mp.scope;
 if(scope!=='house')throw Error('meta.multiplayer.scope ist derzeit nur "house".');
 return{minPlayers:mp.minPlayers,maxPlayers:mp.maxPlayers,scope};
};

// Spielmodi aus meta.modes: 'solo' (allein/Hotseat) | 'party' (CMS-Partie).
// Altbestand ohne Angabe: multiplayer-Flag -> ['party'], sonst ['solo'].
// Konsistenz mit meta.multiplayer wird beim Upload erzwungen — eine Partie
// ohne deklarierte Spielerzahl oder umgekehrt ist ein abgelehnter Fehler.
const readModes=project=>{
 const meta=project&&project.meta||{},mp=meta.multiplayer,modes=meta.modes;
 if(modes===undefined||modes===null)return mp?['party']:['solo'];
 if(!Array.isArray(modes)||!modes.length||modes.some(m=>m!=='solo'&&m!=='party')||new Set(modes).size!==modes.length)throw Error('meta.modes muss eine nicht-leere Liste aus "solo"/"party" ohne Duplikate sein.');
 if(modes.includes('party')!==!!mp)throw Error('meta.modes und meta.multiplayer widersprechen sich: "party" erfordert meta.multiplayer und umgekehrt.');
 return modes;
};
// Gleiche Ableitung für Datensätze ohne explizites modes-Feld (Altbestand,
// Hand-seeds, vor dieser Erweiterung hochgeladene Spiele).
const modesOf=game=>game&&Array.isArray(game.modes)&&game.modes.length?game.modes:[game&&game.multiplayer?'party':'solo'];

const readCredentials=ctx=>{try{return fs.existsSync(ctx.credentialPath)?JSON.parse(fs.readFileSync(ctx.credentialPath,'utf8')):[];}catch(e){return[];}};
const DEFAULT_AVATAR='/images/default-avatar.svg';
const EMOJI_SEGMENTER=new Intl.Segmenter('de',{granularity:'grapheme'});
const emojiInputItems=raw=>{
 if(Array.isArray(raw))return raw;
 if(typeof raw!=='string')return raw;
 const text=raw.trim();
 if(!text)return[];
 return /[,;\s]/.test(text)?text.split(/[,;\s]+/).filter(Boolean):[...EMOJI_SEGMENTER.segment(text)].map(part=>part.segment);
};

// Prozesslokale Versuchszähler für TServerAuthenticate.throttle (DoS-Schutz).
const THROTTLES=new Map();
// Begrenzte JSON-Telegramme fuer generische Live-Staende/-Eingaben (rundenbasierte
// Spiele): serialisierbar, max. Bytes, max. Verschachtelungstiefe — verhindert
// gepolsterte oder zyklische Payloads im Partie-Live-Kanal.
const liveDataOk=(v,maxBytes,maxDepth)=>{
 try{
  const s=JSON.stringify(v);
  if(s===undefined||s.length>maxBytes)return false;
 }catch{return false;}
 const depth=o=>{
  if(typeof o!=='object'||o===null)return 0;
  return 1+Math.max(0,...Object.values(o).map(depth));
 };
 return depth(v)<=maxDepth;
};

function removeLaunchesFor(ctx,sessionIds){
 const ids=new Set(sessionIds);
 for(const [key,l]of ctx.launches||[])if(ids.has(l.playSessionId))ctx.launches.delete(key);
}

function expireInvitations(ctx){
 const db=ctx.core.db,now=Date.now(),expired=db.gameInvitations.filter(i=>i.status==='pending'&&Number(i.expiresAt)<=now);
 if(!expired.length)return;
 const ids=new Set(expired.map(i=>i.id)),parties=new Set(expired.map(i=>i.sessionId));
 ctx.commit(ctx.session,'party-invite-expire',null,next=>{
  for(const i of next.gameInvitations.filter(i=>ids.has(i.id))){
   i.status='expired';const access=next.temporaryRoomAccess.find(a=>a.invitationId===i.id);if(access)access.active=false;
   next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:i.inviterPersonId,type:'game-invitation-expired',invitationId:i.id,read:false,createdAt:new Date(now).toISOString()});
  }
  for(const p of next.parties.filter(p=>p.oneClick&&p.status==='open'&&parties.has(p.id))){
   if(next.gameInvitations.some(i=>i.sessionId===p.id&&i.status==='pending'))continue;
   p.status='ended';p.endedAt=new Date(now).toISOString();
  }
 });
 for(const p of db.parties.filter(p=>p.oneClick&&p.status==='ended'&&parties.has(p.id))){
  const sessionIds=p.members.filter(m=>!m.leftAt).map(m=>m.playSessionId);
  removeLaunchesFor(ctx,sessionIds);
  for(const id of sessionIds)ctx.play.api({personId:p.members.find(m=>m.playSessionId===id)?.personId},'end',{playSessionId:id});
 }
}

// Karteikasten-DTO: Karten werden flach für Listen/Quiz ausgeliefert.
const cardDto=(db,c)=>{const by=db.people.find(p=>p.id===c.createdBy);return{id:c.id,childId:c.childId,subject:c.subject,topic:c.topic,question:c.question,answers:c.answers,answerFormat:c.answerFormat,box:c.box,boxLabel:c.box===6?'✔ gelernt':'Fach '+c.box,createdBy:c.createdBy,createdByName:by?.name||'',createdAt:c.createdAt,updatedAt:c.updatedAt,lastReviewedAt:c.lastReviewedAt,active:c.active};};

const methods={
 TServerSession:{
  requireRole(ctx,_component,params){
   const policy=ROLES[params?.[0]];
   if(!policy)throw Error('Unbekannte Rollenrichtlinie: '+params?.[0]);
   if(!ctx.session)console.log('[Rollenwahl] requireRole('+params?.[0]+') ← KEINE Session');
   if(!ctx.session)return{ok:false,status:401,message:'Bitte Verwaltung neu anmelden.'};
   if(!policy.check(ctx))return{ok:false,status:403,message:policy.deny};
   return{ok:true,personId:ctx.session.personId};
  },
  logout(ctx){ctx.admin?.endSession(ctx.session);return{ok:true};},
  // Rollenwahl: liefert die Kandidaten der Sitzung (Verwaltung: adminRoles,
  // Konto: accountRoles). Rein lesend — die Rechte entscheidet can().
  roles(ctx){
   const list=ctx.session?.adminRoles||ctx.session?.accountRoles||[];
   // Die Wahl-Tabellen speichern Datensätze über recordKey 'id'; die
   // fachliche Rolle selbst hat keinen Primärschlüssel. Die ID bleibt
   // deterministisch, damit Runde und Browser dieselbe Auswahl finden.
   const roles=list.map(r=>({...r,id:r.id||`${r.role}:${r.areaId}`}));
   console.log('[Rollenwahl] roles() ← session:',ctx.session?ctx.session.personId+'/'+ctx.session.assurance:'KEINE','| adminRoles:',ctx.session?.adminRoles?.length??'-','| accountRoles:',ctx.session?.accountRoles?.length??'-','| liefert:',list.length);
   return{ok:true,roles};
  },
  // Wählt die aktive Rolle der Sitzung. Admin-Sitzungen bekommen ein
  // Oberflächen-Ziel (target), Konto-Sitzungen eine Stage + Kontextwerte.
  chooseRole(ctx,_component,params){
   console.log('[Rollenwahl] chooseRole ←',JSON.stringify(params?.[0]),'| session:',ctx.session?.personId||'KEINE');
   const sel=exprOf(ctx,params?.[0],{})||{},db=ctx.core.db;
   const list=ctx.session?.adminRoles||ctx.session?.accountRoles||[];
   const match=list.find(r=>r.role===sel.role&&r.areaId===sel.areaId);
   if(!match)return{ok:false,message:'Diese Rolle steht nicht zur Verfügung.'};
   // Abgeleitete Kontextrolle Spieler ist nie in db.roles; Eltern/Beobachter
   // wählen ihren Kontext über den Passwort-Login (stage_admin_login), nicht hier.
   if(match.role!=='player'&&!db.roles.some(r=>r.personId===ctx.session.personId&&r.role===match.role&&r.areaId===match.areaId&&r.active&&(r.areaId==='root'||areaActive(db,r.areaId))))
    return{ok:false,message:'Diese Rolle steht nicht mehr zur Verfügung.'};
   ctx.session.activeRole=match;
   ctx.emit('Rolle gewählt',{personId:ctx.session.personId,role:match.role,areaId:match.areaId});
   if(ctx.session.adminRoles)return{ok:true,target:match.role==='superAdmin'?'/super':(db.areas.find(a=>a.id===match.areaId)?.type==='house'?'/house?house='+match.areaId:'/admin')};
   return{ok:true,stage:match.role==='areaAdmin'?'stage_room_overview':'stage_gallery',
    houseId:ctx.session.houseId||'',roomId:match.role==='areaAdmin'?match.areaId:'',
    houseName:db.areas.find(a=>a.id===ctx.session.houseId)?.name||'',
    roomName:db.areas.find(a=>a.id===match.areaId)?.name||''};
  },
  // Verwaltungssitzung aus geprüftem Zugang (verifyAdmin). Das Token bleibt
  // Transportfeld — der Server wandelt es in ein HttpOnly-Cookie um.
  createAdmin(ctx,_component,params){
   const issued=params?.[0]&&ctx.admin.createSession(params[0]);
   ctx.emit('Verwaltungssitzung erstellen',{assurance:'admin',validSeconds:1800,cookie:'[maskiert]'});
   return issued?{ok:true,token:issued.token}:{ok:false};
  },
  // Konto-Sitzung (cms_account) für Eltern-/Beobachterkontexte — E01-Sichtwechsel.
  createAccount(ctx,_component,params){
   const token=params?.[0]&&ctx.core.issueSession(params[0],'account');
   return token?{ok:true,token}:{ok:false};
  },
  // Konto-Abmeldung: Spieler-Token, Raum-Präsenz und Launch-Grants aufräumen.
  logoutAccount(ctx){
   const token=ctx.body?.token;
   ctx.core.logout(token);
   if(ctx.launches)for(const [k,l]of ctx.launches)if(l.token===token)ctx.launches.delete(k);
   return{ok:true};
  },
  // Flüchtige Raum-Präsenz: Betreten/Heartbeat/Verlassen. Der Raumzutritt wird
  // serverseitig gegen permanente oder temporäre Mitgliedschaft geprüft.
  roomPresence(ctx,_component,params){
   const spec=params?.[0]||{};
   return ctx.core.setPresence(ctx.session.personId,exprOf(ctx,spec.areaId,{}),exprOf(ctx,spec.present,{})===true);
  }
 },
 // --- Anmeldung (E01): Versuchslimit + Emoji-Authentifizierung ----------------
 TServerAuthenticate:{
  // Versuchslimit je Quelle (IP) und Bucket — deklarativ über limit/windowMs.
  throttle(ctx,_component,params){
   const spec=params?.[0]||{},key=String(spec.bucket||'login')+':'+String(ctx.remoteAddress||'local');
   const limit=Number(spec.limit)||20,windowMs=Number(spec.windowMs)||60000,now=Date.now();
   // Begrenzung des Speichers: ältesten Eintrag entfernen (Map ist
   // einfügegeordnet) — kein globaler Reset, der alle Zähler zurücksetzt.
   if(THROTTLES.size>1000)THROTTLES.delete(THROTTLES.keys().next().value);
   let b=THROTTLES.get(key);if(!b||now-b.time>windowMs){b={time:now,n:0};THROTTLES.set(key,b);}
   return{ok:++b.n<=limit};
  },
  // Emoji-Einwahl: global eindeutige Folge → Person → Spielersitzung.
  // core.login meldet seine Schritte über emit (Sequenzen werden maskiert).
  authenticate(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const found=ctx.core.login(exprOf(ctx,spec.sequence,scope),(label,data)=>ctx.emit(label,data));
   return found?{ok:true,found:true,token:found.token,name:found.person?.name,avatar:found.person?.avatar,roles:found.roles||[],houseId:found.houseId||'',needRole:!!found.needRole}:{ok:true,found:false};
  },
  // Verwaltungseinwahl: admin.verify kapselt Versuchslimit, scrypt-Hash sowie
  // Person- und Zuständigkeitsprüfung (emit-Schritte bleiben im Trace).
  verifyAdmin(ctx){
   const checked=ctx.admin.verify(ctx.remoteAddress,ctx.body||{},(l,d)=>ctx.emit(l,d));
   return{hasSession:!!checked.session,session:checked.session||null,personId:checked.session?.personId||checked.personId||null,contexts:checked.contexts||[],super:!!checked.super,house:!!checked.house,adminRoles:checked.session?.adminRoles||[],message:checked.error||''};
  },
  // Antwortdaten der Verwaltungsanmeldung: ok + Kontext-Flags; Tokens sind
  // Transportfelder — der Server wandelt sie in HttpOnly-Cookies um.
  adminResult(ctx,_component,params){
   const spec=params?.[0]||{},tok=ctx.vars.Verwaltung?.token,acc=ctx.vars.Konto?.token,g=ctx.vars.Geprueft||{},ctxs=g.contexts||[];
   const ok=!!(tok||acc),d={ok,message:tok?spec.successMessage:acc?spec.accountMessage:(g.message||spec.failureMessage)};
   if(ok)Object.assign(d,{contexts:ctxs,admin:ctxs.includes('admin'),parent:ctxs.includes('parent'),observer:ctxs.includes('observer'),sponsor:ctxs.includes('sponsor'),super:!!g.super,house:!!g.house,roles:g.adminRoles||[],needRole:(g.adminRoles||[]).length>1});
   if(tok)d.adminToken=tok;if(acc)d.accountToken=acc;if(g.personId)d.personId=g.personId;
   return d;
  }
 },
 // Platzhalter-Komponente: Stage-definierte Endpunkte/TServerParentAccount
 // brauchen keine eigenen Methoden, da ihre Events auf Tasks verweisen.
 TServerParentAccount:{},
 TServerResponse:{
  // send({feld:expr, merge:objVar}) — 'merge' breitet ein Ergebnisobjekt (z. B. Kind-Karte) in die Antwort aus.
  send(ctx,_component,params){const p=params?.[0]||{},merge=p.merge&&typeof p.merge==='object'?p.merge:{};const rest={...p};delete rest.merge;ctx.result={status:200,data:{ok:true,...merge,...rest}};},
  fail(ctx,_component,params){const extra=params?.[2]&&typeof params[2]==='object'&&!Array.isArray(params[2])?params[2]:{};ctx.result={status:Number(params?.[0])||400,data:{ok:false,message:String(params?.[1]||'Anfrage abgelehnt.'),...extra}};}
 },
 TServerValidate:{
  avatar(ctx,_component,params){
   const value=ctx.body?.[params?.[0]||'avatar'];
   const ok=typeof value==='string'&&value.length<=32&&[...new Intl.Segmenter('de',{granularity:'grapheme'}).segment(value)].length===1&&/\p{Extended_Pictographic}|\p{Regional_Indicator}/u.test(value)&&!/[^\p{Extended_Pictographic}\p{Regional_Indicator}\p{Emoji_Modifier}\u200d\ufe0f\u{e0020}-\u{e007f}]/u.test(value);
   return ok?{ok:true,value}:{ok:false,status:400,message:'Bitte ein einzelnes Avatar-Symbol wählen.'};
  },
  // Freitextregel wie im Legacy-Handler: getrimmt, 1–60 Zeichen, keine Steuer-/HTML-Zeichen.
  text(ctx,_component,params){
   const[field,opts={}]=params||[],max=opts.max??60;
   const v=ctx.body?.[field];
   const ok=typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\x00-\x1f<>]/.test(v);
   return ok?{ok:true,value:v.trim()}:{ok:false,status:400,message:opts.message||`${field} erforderlich (max. ${max} Zeichen).`};
  },
  // Optionaler Freitext: fehlende Eingabe wird als leerer Text gespeichert.
  textOptional(ctx,_component,params){
   const[field,opts={}]=params||[],max=opts.max??240,v=ctx.body?.[field];
   if(v===undefined||v===null)return{ok:true,value:''};
   const ok=typeof v==='string'&&v.trim().length<=max&&!/[\x00-\x1f<>]/.test(v);
   return ok?{ok:true,value:v.trim()}:{ok:false,status:400,message:opts.message||`${field} darf maximal ${max} Zeichen enthalten.`};
  },
  boolean(ctx,_component,params){
   const v=ctx.body?.[params?.[0]];
   return typeof v==='boolean'?{ok:true,value:v}:{ok:false,status:400,message:`${params?.[0]} muss ein boolescher Wert sein.`};
  },
  confirmed(ctx,_component,params){
   const v=ctx.body?.[params?.[0]??'confirm'];
   return v===true?{ok:true}:{ok:false,status:400,message:'Zuweisung ausdrücklich bestätigen.'};
  },
  // Whitelist-Prüfung: Wert muss in der Liste stehen (Liste kann eine Komponenten-
  // Property sein, z. B. ${EigenesProfil.avatars}).
  choice(ctx,_component,params){
   const v=ctx.body?.[params?.[0]],list=params?.[1];
   return Array.isArray(list)&&list.includes(v)?{ok:true,value:v}:{ok:false,status:400,message:`${params?.[0]} ist keine gültige Auswahl.`};
  },
  // Wie choice, aber fehlende/leere Eingaben erhalten deklarativ einen Standardwert.
  choiceDefault(ctx,_component,params){
   const[field,list,fallback]=params||[],v=ctx.body?.[field];
   if(v===undefined||v===null||v==='')return{ok:true,value:fallback};
   return Array.isArray(list)&&list.includes(v)?{ok:true,value:v}:{ok:false,status:400,message:`${field} ist keine gültige Auswahl.`};
  },
  // Tagesbudget in Minuten (0–1440).
  minutes(ctx,_component,params){
   const v=Number(ctx.body?.[params?.[0]??'dailyMinutes']);
   return Number.isFinite(v)&&v>=0&&v<=1440?{ok:true,value:v}:{ok:false,status:400,message:'Tagesbudget in Minuten (0–1440) angeben.'};
  },
  // Zeitfenster-Liste [{from,to}] — ungültige Einträge werden verworfen (Legacy-Verhalten).
  windows(ctx,_component,params){
   const raw=ctx.body?.[params?.[0]??'windows'],fmt=/^([01]\d|2[0-3]):[0-5]\d$/;
   const list=Array.isArray(raw)?raw.filter(w=>fmt.test(w.from)&&fmt.test(w.to)):[];
   return{ok:true,value:list};
  },
  // Numerischer Wert (Bewertungsmeldung).
  number(ctx,_component,params){
   const v=ctx.body?.[params?.[0]];
   return Number.isFinite(v)?{ok:true,value:v}:{ok:false,status:400,message:`Numerischer Wert für ${params?.[0]} erforderlich.`};
  },
  // Nicht-leerer String (z. B. eventId).
  nonempty(ctx,_component,params){
   const v=ctx.body?.[params?.[0]];
   return typeof v==='string'&&v.length>0?{ok:true,value:v}:{ok:false,status:400,message:`${params?.[0]} fehlt.`};
  },
  // Objekt-Payload (Mehrspieler-Aktionsdaten).
  object(ctx,_component,params){
   const v=ctx.body?.[params?.[0]];
   return typeof v==='object'&&v!==null?{ok:true,value:v}:{ok:false,status:400,message:'Aktionsdaten fehlen.'};
  },
  // Verwaltungseinwahl: Benutzername (1–80) + Passwort (1–200).
  adminInput(ctx){
   const b=ctx.body||{};
   return{ok:typeof b.username==='string'&&b.username.length>0&&b.username.length<=80&&typeof b.password==='string'&&b.password.length>0&&b.password.length<=200};
  },
  // Anmeldeeingabe des Emoji-Logins: vier Emoji-Werte; das Haus folgt aus dem Code.
  loginInput(ctx){
   const b=ctx.body||{};
   const ok=Array.isArray(b.sequence)&&b.sequence.length===4&&b.sequence.every(v=>typeof v==='string'&&v.length<=64);
   return{ok};
  },
  // Emoji-Einwahlsequenz: akzeptiert sequenceText (IDs oder Zeichen, mit Komma/
  // Leerzeichen/Semikolon oder als zusammenhängende Emoji-Folge) oder sequence.
  emojiSeq(ctx,_component,params){
   const field=params?.[0]||'sequence';
   const text=ctx.body?.sequenceText;
   const raw=typeof text==='string'&&text.trim()?text:ctx.body?.[field];
   const sequence=canonEmojiSeq(emojiInputItems(raw));
   const ok=Array.isArray(sequence)&&sequence.length===4&&sequence.every(e=>EMOJI_IDS.includes(e));
   return ok?{ok:true,value:sequence}:{ok:false,status:400,message:'Vier gültige Emoji-IDs erforderlich.'};
  }
 },
 TServerQuery:{
  list(ctx,_component,params){
   const spec=params?.[0];
   if(!spec||typeof spec.entity!=='string')throw Error('TServerQuery.list benötigt eine Query-Spec mit entity.');
   if(!Array.isArray(ctx.core.db[spec.entity]))throw Error('Unbekannte Entität: '+spec.entity);
   const rows=ctx.core.db[spec.entity].filter(item=>whereMatch(ctx,item,spec.where,{item}));
   const items=rows.map(item=>projectFields(ctx,item,spec.fields||{}));
   const scope={items};
   const extra={};
   for(const [key,expr]of Object.entries(spec.extra||{}))extra[key]=exprOf(ctx,expr,scope);
   return{items,...extra};
  },
  // Optionsliste für Dropdowns: Datensätze bleiben getrennt über list() abrufbar.
  optionList(ctx,_component,params){
   const spec=params?.[0];
   if(!spec||typeof spec.entity!=='string')throw Error('TServerQuery.optionList benötigt eine Query-Spec mit entity.');
   ensureEntity(ctx,spec.entity);
   const rows=ctx.core.db[spec.entity].filter(item=>whereMatch(ctx,item,spec.where,{item}));
   return{items:rows.map(item=>exprOf(ctx,spec.label??'$item.name',{item}))};
  },
  find(ctx,_component,params){
   const spec=params?.[0];
   if(!spec||typeof spec.entity!=='string')throw Error('TServerQuery.find benötigt eine Query-Spec mit entity.');
   ensureEntity(ctx,spec.entity);
   const row=ctx.core.db[spec.entity].find(item=>whereMatch(ctx,item,spec.where,{item}));
   return row?{ok:true,found:true,item:row}:{ok:true,found:false,item:null};
  },
  exists(ctx,_component,params){
   const spec=params?.[0];
   if(!spec||typeof spec.entity!=='string')throw Error('TServerQuery.exists benötigt eine Query-Spec mit entity.');
   ensureEntity(ctx,spec.entity);
   return ctx.core.db[spec.entity].some(item=>whereMatch(ctx,item,spec.where,{item}));
  },
  areaActive(ctx,_component,params){return areaActive(ctx.core.db,exprOf(ctx,params?.[0],{}));},
  // Berechtigungsfähigkeit der Sitzung: can('manageArea',{areaId:'$body.areaId'})
  can(ctx,_component,params){const[cap,args]=params||[];const resolved={};for(const[k,v]of Object.entries(args||{}))resolved[k]=exprOf(ctx,v,{});return ctx.core.can(ctx.session,cap,resolved);},
  // Vorfahren-Haus eines Bereichs (parentId-Kette bis type==='house').
  houseOf(ctx,_component,params){
   let a=ctx.core.db.areas.find(x=>x.id===exprOf(ctx,params?.[0],{}));const seen=new Set();
   while(a&&a.type!=='house'&&!seen.has(a.id)){seen.add(a.id);a=ctx.core.db.areas.find(x=>x.id===a.parentId);}
   return a?{ok:true,found:true,item:a}:{ok:true,found:false,item:null};
  },
  // Emoji-Folge ist global schon vergeben (optional: eine Person ausnehmen).
  codeTaken(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const sequence=exprOf(ctx,spec.sequence,scope),exclude=exprOf(ctx,spec.excludePersonId,scope);
   const wanted=JSON.stringify(sequence);
   return ctx.core.db.codes.some(c=>c.personId!==exclude&&JSON.stringify(canonEmojiSeq(c.sequence))===wanted);
  },
  // Gespeicherte Raumsicherung (roomBackups ist eine Map, keine Liste).
  backup(ctx,_component,params){
   const areaId=exprOf(ctx,params?.[0],{}),saved=ctx.core.db.roomBackups?.[areaId];
   return saved?{ok:true,found:true,item:saved}:{ok:true,found:false,item:null};
  },
  // --- Elternsicht (E01): Kind-Karte mit Live-Status, Tagesminuten, Budget ---
  childCard(ctx,_component,params){
   const card=childCardOf(ctx.core.db,exprOf(ctx,params?.[0],{}));
   return card?{ok:true,found:true,item:card}:{ok:true,found:false,item:null};
  },
  childCards(ctx){const db=ctx.core.db,personId=ctx.session.personId;
   // Bestätigte UND ausstehende Zuordnungen werden gelistet (E01/E02): die
   // Übersicht zeigt pending-Karten markiert; Detailzugriff bleibt weiterhin
   // an viewChild (nur confirmed) gebunden.
   return{items:db.guardians.filter(g=>g.guardianId===personId&&(g.status==='confirmed'||g.status==='pending'))
    .map(g=>{const c=childCardOf(db,g.childId);return c?{...c,pendingApproval:g.status==='pending'||!!c.pendingApproval,guardianStatus:g.status}:null}).filter(Boolean)};},
  // Letzte Spielsitzungen eines Kindes (neueste zuerst, max. 10), mit Spieltitel.
  recentSessions(ctx,_component,params){
   const childId=exprOf(ctx,params?.[0],{}),db=ctx.core.db;
   const items=db.playSessions.filter(s=>s.childId===childId)
    .sort((a,z)=>z.startedAt.localeCompare(a.startedAt)).slice(0,10)
    .map(s=>({id:s.id,gameId:s.gameId,title:db.games.find(g=>g.id===s.gameId)?.title,status:s.status,startedAt:s.startedAt,minutes:s.minutes}));
   return{items};
  },
  // Lernbewertungen eines Kindes (flache Felder für die Tabelle).
  progressList(ctx,_component,params){
   const childId=exprOf(ctx,params?.[0],{});
   return{items:(ctx.core.db.progress||[]).filter(r=>r.childId===childId)
    .map(r=>({metric:r.metric,value:r.value,unit:r.unit,reportedAt:r.reportedAt,source:r.source,gameId:r.gameId}))};
  },
  // --- Erziehungsberechtigte: Räume des Kindes + Zutritt verwalten (E07) ---
  childRooms(ctx,_component,params){
   const childId=exprOf(ctx,params?.[0],{}),db=ctx.core.db,session=ctx.session;
   if(!ctx.core.can(session,'viewChild',{childId}))return{ok:false,status:403,message:'Nur eigene, bestätigt zugeordnete Kinder.'};
   // Spieler-Sessions tragen ihr Haus; Eltern-Account-Sessions nicht —
   // dann zählt das Haus des Kindes (gleiche Domäne für die Zutrittsregel).
   const houseId=session.houseId||houseOfPerson(db,childId);
   const items=db.areas.filter(a=>a.type==='room'&&areaActive(db,a.id))
    .map(a=>{
     const house=houseOf(db,a.id);
     const member=db.memberships.find(m=>m.personId===childId&&m.areaId===a.id);
     return{areaId:a.id,name:a.name,avatar:a.avatar||'🚪',houseId:house?.id,active:!!member?.active,hasAccess:!!member};
    })
    .filter(r=>r.houseId===houseId);
   return{ok:true,items,message:items.length?'Räume des Kindes':'Keine Räume im Haus'};
  },
  setChildMembership(ctx,_component,params){
   // '$body' kommt als Literal — erst per exprOf zum Request-Body auflösen.
   const spec=exprOf(ctx,params?.[0],{})||{},scope={},db=ctx.core.db,session=ctx.session;
   const childId=exprOf(ctx,spec.childId,scope),areaId=exprOf(ctx,spec.areaId,scope),active=!!exprOf(ctx,spec.active,scope);
   if(!ctx.core.can(session,'viewChild',{childId}))return{ok:false,status:403,message:'Nur eigene, bestätigt zugeordnete Kinder.'};
   const room=db.areas.find(a=>a.id===areaId&&a.type==='room');
   if(!room)return{ok:false,status:404,message:'Raum nicht gefunden.'};
   const house=houseOf(db,areaId);
   const childHouse=session.houseId||houseOfPerson(db,childId);
   if(house?.id!==childHouse)return{ok:false,status:403,message:'Raum gehört nicht zum Haus des Kindes.'};
   ctx.commit(session,'parent-child-membership',areaId,next=>{
    let row=next.memberships.find(m=>m.personId===childId&&m.areaId===areaId);
    if(!row){row={personId:childId,areaId};next.memberships.push(row);}
    row.active=active;
   });
   return{ok:true,message:active?'Zutritt gewährt.':'Zutritt entzogen.'};
  },
  // Bereichs-Flags der Anmeldung — steuern nur die Bereichsnavigation (keine
  // Rechte; jede Aktion wird serverseitig einzeln geprüft). Nutzt die
  // Verwaltungssitzung (ctx.adminSession) und/oder die Konto-Sitzung.
  contexts(ctx){
   const db=ctx.core.db,personId=ctx.adminSession?.personId||ctx.session?.personId;
   const person=personId&&db.people.find(p=>p.id===personId&&p.active);
   const flags={admin:false,house:false,super:false,parent:false,observer:false,player:false,sponsor:false};
   if(person){
    const role=(r,areaId)=>db.roles.some(x=>x.personId===personId&&x.role===r&&x.areaId===areaId&&x.active&&areaActive(db,x.areaId));
    if(ctx.adminSession){flags.super=role('superAdmin','root');flags.admin=flags.super||db.roles.some(r=>r.personId===personId&&r.role==='areaAdmin'&&r.active&&areaActive(db,r.areaId));flags.house=flags.super||db.roles.some(r=>r.personId===personId&&r.role==='areaAdmin'&&r.active&&db.areas.find(a=>a.id===r.areaId)?.type==='house'&&areaActive(db,r.areaId));}
    if(ctx.session){flags.parent=db.guardians.some(g=>g.guardianId===personId&&g.status==='confirmed');flags.observer=db.roles.some(r=>r.personId===personId&&r.role==='observer'&&r.active&&areaActive(db,r.areaId));flags.player=ctx.session.assurance==='profile';flags.sponsor=db.roles.some(r=>r.personId===personId&&r.role==='sponsor'&&r.areaId==='root'&&r.active);}
    flags.verwaltung=flags.admin||flags.house;
   }
   return{ok:true,...flags,name:person?.name||''};
  },
  // Spielerbare Räume der Sitzung (aktive Mitgliedschaft + aktive Bereichskette)
  // mit getrennter, flüchtiger Raum-Präsenz und laufenden Spielsitzungen.
  roomsFor(ctx){
   const db=ctx.core.db,now=Date.now();
   const liveSession=s=>['active','paused'].includes(s.status)&&now-new Date(s.lastHeartbeatAt).getTime()<=disconnectMs();
   const avatar=id=>{const p=db.people.find(x=>x.id===id&&x.active);return p?avatarGlyph(p.avatar):'🙂';};
   const items=ctx.core.rooms(ctx.session.personId).map(r=>{const ids=ctx.core.presenceFor(r.id,now),playingIds=[...new Set(db.playSessions.filter(s=>s.areaId===r.id&&liveSession(s)).map(s=>s.childId))],presentIds=ids.filter(id=>!playingIds.includes(id));
    const presentAvatars=presentIds.map(avatar),playingAvatars=playingIds.map(avatar);
    return{id:r.id,name:r.name,avatar:avatarGlyph(r.avatar||'🚪'),active:r.active,presentCount:presentIds.length,presentAvatars,presentAvatarImages:presentIds.map(id=>db.people.find(x=>x.id===id)?.avatarImage||DEFAULT_AVATAR),presentLabel:'Im Raum: '+(presentAvatars.join(' ')||'—'),playingCount:playingIds.length,playingAvatars,playingAvatarImages:playingIds.map(id=>db.people.find(x=>x.id===id)?.avatarImage||DEFAULT_AVATAR),playingLabel:'Spielt: '+(playingAvatars.join(' ')||'—')};});
   return{items,message:'🚪 Wähle deinen Raum'};
  },
  // Freigegebene Spiele eines Raums für die Sitzung (can 'play' je Spiel).
  gamesFor(ctx,_component,params){
   const areaId=exprOf(ctx,params?.[0],{});
   const items=ctx.core.db.games.filter(g=>ctx.core.can(ctx.session,'play',{game:g,areaId})&&modesOf(g).includes('solo')).map(g=>({id:g.id,title:g.title,avatar:g.avatar,multiplayer:!!g.multiplayer,modes:modesOf(g)}));
   return{items,message:items.length?'🎮 Wähle ein Spiel':'🌱 Hier kommen bald Spiele dazu'};
  },
  // 4er-Slot-Paginierung: {items,page,fields,itemFields?,message?}
  //  → {page,pages,total,items?,slot0..3,message?}
  page(ctx,_component,params){
   const spec=params?.[0]||{},items=exprOf(ctx,spec.items,{})||[];
   const page=Math.max(0,Math.min(Number(exprOf(ctx,spec.page,{}))||0,Math.max(0,Math.ceil(items.length/4)-1)));
   const slice=items.slice(page*4,page*4+4);
   const out={ok:true,page,pages:Math.ceil(items.length/4),total:items.length};
   if(spec.itemFields)out.items=slice.map(i=>projectFields(ctx,i,spec.itemFields));
   for(let i=0;i<4;i++)out['slot'+i]=slice[i]?projectFields(ctx,slice[i],spec.fields||{}):{id:'',label:'',visible:false};
   if(spec.message!==undefined)out.message=spec.message;
   return out;
  },
  // Beobachter-Puls (E01): nur aggregierte Zahlen. Ohne areaId → Übersicht aller
  // eigenen Beobachtungsräume; mit areaId → Zahlen dieses Raums (Recht prüft der Task).
  pulse(ctx,_component,params){
   const db=ctx.core.db,areaId=exprOf(ctx,params?.[0],{});
   const pulse=a=>{const memberIds=db.memberships.filter(m=>m.areaId===a&&m.active&&db.people.some(p=>p.id===m.personId&&p.active)).map(m=>m.personId);
    const sessions=db.playSessions.filter(s=>memberIds.includes(s.childId)&&s.areaId===a);
    return{connected:memberIds.length,playing:sessions.filter(s=>s.status==='active').length,paused:sessions.filter(s=>s.status==='paused').length,disconnected:sessions.filter(s=>s.status==='disconnected').length};};
   if(areaId)return{ok:true,item:pulse(areaId)};
   const items=db.roles.filter(r=>r.personId===ctx.session.personId&&r.role==='observer'&&r.active)
    .flatMap(r=>db.areas.filter(a=>a.active&&a.type==='room'&&within(db,a.id,r.areaId)))
    .map(a=>({id:a.id,bereich:a.name,...pulse(a.id)}));
   return{items,message:'Aggregierte Übersicht deiner Beobachtungsbereiche'};
  },
  // Eigene Spielebibliothek: 4er-Slots mit Statusbezeichnung (Vertrag des
  // Bibliotheks-Endpunkts — Entwurf/Veröffentlicht/Gesperrt).
  libraryList(ctx){
   const items=ctx.core.db.games.filter(g=>g.ownerId===ctx.session.personId);
   const page=Math.max(0,Math.min(Number(ctx.body?.page)||0,Math.max(0,Math.ceil(items.length/4)-1))),labels={draft:'Entwurf',published:'Veröffentlicht',blocked:'Gesperrt'},out={message:'Eigene Spiele · Entwurf oder veröffentlicht',page,pages:Math.ceil(items.length/4)};
   for(let i=0;i<4;i++){const g=items[page*4+i];out['slot'+i]=g?{id:g.id,label:g.title+' · '+(labels[g.status]||g.status),published:g.status==='published',visible:true}:{id:'',label:'',published:false,visible:false};}
   return out;
  }
 },
 TServerStore:{
  // Legt einen Datensatz an; Audit-Eintrag über die gemeinsame commit-Funktion.
  create(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   // Fehlende Listen werden beim Schreiben lazy angelegt (wie Legacy); existiert
   // der Schlüssel, muss er aber eine Liste sein — Tippfehler bleiben laut.
   if(ctx.core.db[spec.entity]!==undefined&&!Array.isArray(ctx.core.db[spec.entity]))throw Error('Unbekannte Entität: '+spec.entity);
   const row={};
   for(const [key,expr]of Object.entries(spec.fields||{}))row[key]=exprOf(ctx,expr,scope);
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope),exprOf(ctx,audit.areaId,scope),next=>(next[spec.entity]=next[spec.entity]||[]).push(row));
   return{ok:true,id:row.id,item:row};
  },
  update(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   ensureEntity(ctx,spec.entity);
   const row=ctx.core.db[spec.entity].find(item=>whereMatch(ctx,item,spec.where,scope));
   if(!row)return{ok:false,status:404,message:'Datensatz nicht gefunden.'};
   const set={};for(const [key,expr]of Object.entries(spec.set||{}))set[key]=exprOf(ctx,expr,scope);
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope),exprOf(ctx,audit.areaId,scope),next=>Object.assign(next[spec.entity].find(a=>a.id===row.id),set));
   return{ok:true};
  },
  // Entfernt alle Zeilen, die der where-Klausel entsprechen — z. B. ein
  // Spiel samt Freigaben beim Löschen; liefert die Trefferzahlen zurück.
  // 'also': weitere Entity-Specs, die im selben Commit mitentfernt werden —
  // die Integritätsprüfung läuft erst am Ende, Referenzen bleiben konsistent.
  delete(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const sweep=[spec,...(spec.also||[])];
   for(const s of sweep)ensureEntity(ctx,s.entity);
   const match=s=>item=>whereMatch(ctx,item,s.where,scope);
   const removed=sweep.map(s=>(ctx.core.db[s.entity]||[]).filter(match(s)).length);
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope),exprOf(ctx,audit.areaId,scope),next=>{for(const s of sweep)next[s.entity]=(next[s.entity]||[]).filter(item=>!match(s)(item));});
   return{ok:true,removed};
  },
  // Find-or-create einer Zeile nach match-Kriterien und Setzen der Felder —
  // vereinheitlicht Rollen, Freigaben (grants) und Mitgliedschaften (memberships).
  upsert(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   ensureEntity(ctx,spec.entity);
   const match={};for(const [key,expr]of Object.entries(spec.match||{}))match[key]=exprOf(ctx,expr,scope);
   const set={};for(const [key,expr]of Object.entries(spec.set||{}))set[key]=exprOf(ctx,expr,scope);
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope),exprOf(ctx,audit.areaId,scope),next=>{
    let row=next[spec.entity].find(r=>Object.entries(match).every(([k,v])=>r[k]===v));
    if(!row){row={...match};next[spec.entity].push(row);}
    Object.assign(row,set);
   });
   return{ok:true};
  },
  // Domänenoperation: Rolle find-or-create (personId+areaId+role) und aktiv/inaktiv setzen.
  setRole(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),areaId=exprOf(ctx,spec.areaId,scope),role=exprOf(ctx,spec.role,scope),active=exprOf(ctx,spec.active,scope);
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'role-set',exprOf(ctx,audit.areaId,scope)||areaId,next=>{
    let row=next.roles.find(r=>r.personId===personId&&r.areaId===areaId&&r.role===role);
    if(!row){row={personId,areaId,role};next.roles.push(row);}
    row.active=active;
   });
   return{ok:true};
  },
  // RaumAdmin-Zuweisung mit Schutz des letzten aktiven RaumAdmins.
  setRoomAdmin(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),areaId=exprOf(ctx,spec.areaId,scope),active=!!exprOf(ctx,spec.active,scope);
   const room=ctx.core.db.areas.find(a=>a.id===areaId&&a.type==='room');
   if(!room)return{ok:false,status:404,message:'Raum nicht gefunden.'};
   if(!active){
    const others=ctx.core.db.roles.filter(r=>r.areaId===areaId&&r.role==='areaAdmin'&&r.active&&r.personId!==personId);
    if(!others.length)return{ok:false,status:409,message:'Der letzte aktive RaumAdmin kann nicht entfernt werden.'};
   }
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'room-admin-set',areaId,next=>{
    let row=next.roles.find(r=>r.personId===personId&&r.areaId===areaId&&r.role==='areaAdmin');
    if(!row){row={personId,areaId,role:'areaAdmin'};next.roles.push(row);}
    row.active=active;
    if(active&&!next.roles.some(r=>r.areaId===areaId&&r.role==='areaAdmin'&&r.active&&r.primary))row.primary=true;
   });
   return{ok:true,active};
  },
  // Atomarer Wechsel: genau eine Person bleibt aktiver RaumAdmin dieses Raums.
  replaceRoomAdmin(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),areaId=exprOf(ctx,spec.areaId,scope),audit=spec.audit||{};
   const room=ctx.core.db.areas.find(a=>a.id===areaId&&a.type==='room');
   if(!room)return{ok:false,status:404,message:'Raum nicht gefunden.'};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'room-admin-replace',areaId,next=>{
    if(next.people.find(p=>p.id===personId)?.kind==='child'){
     let membership=next.memberships.find(m=>m.personId===personId&&m.areaId===areaId);
     if(!membership){membership={personId,areaId};next.memberships.push(membership);}
     membership.active=true;
    }
    for(const r of next.roles.filter(r=>r.areaId===areaId&&r.role==='areaAdmin')){r.active=false;delete r.primary;}
    let row=next.roles.find(r=>r.personId===personId&&r.areaId===areaId&&r.role==='areaAdmin');
    if(!row){row={personId,areaId,role:'areaAdmin'};next.roles.push(row);}
    row.active=true;row.primary=true;
   });
   return{ok:true,personId,areaId};
  },
  // Domänenoperation: Person aktivieren/deaktivieren (Selbstschutz: eigenes Konto nicht).
  personActive(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),active=exprOf(ctx,spec.active,scope);
   if(!active&&personId===ctx.session?.personId)return{ok:false,status:409,message:'Das eigene Konto kann nicht deaktiviert werden.'};
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'person-active',exprOf(ctx,audit.areaId,scope),next=>{
    const person=next.people.find(p=>p.id===personId);
    if(person){person.active=!!active;if(!active){person.authVersion=(person.authVersion||0)+1;next.invites=(next.invites||[]).filter(i=>i.personId!==personId);}}
   });
   return{ok:true};
  },
  // Domänenoperation: Emoji-Einwahlcode setzen + offene Zugangshilfe der Person schließen.
  setEmojiCode(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),areaId=exprOf(ctx,spec.areaId,scope),sequence=exprOf(ctx,spec.sequence,scope);
   const audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'emoji-change',exprOf(ctx,audit.areaId,scope),next=>{
    next.codes=next.codes.filter(c=>!(c.personId===personId&&c.areaId===areaId));
    next.codes.push({personId,areaId,sequence});
    for(const request of next.profileRequests||[])if(request.personId===personId&&request.status==='open')request.status='resolved';
   });
   return{ok:true};
  },
  // Domänenoperation: Sicherung eines Raums (Freigaben + Mitgliedschaften).
  roomBackup(ctx,_component,params){
   const spec=params?.[0]||{},scope={},areaId=exprOf(ctx,spec.areaId,scope),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'room-backup',areaId,next=>{
    next.roomBackups={...(next.roomBackups||{}),[areaId]:{at:new Date().toISOString(),grants:structuredClone(next.grants.filter(g=>g.areaId===areaId)),memberships:structuredClone(next.memberships.filter(m=>m.areaId===areaId))}};
   });
   return{ok:true};
  },
  roomRestore(ctx,_component,params){
   const spec=params?.[0]||{},scope={},areaId=exprOf(ctx,spec.areaId,scope),audit=spec.audit||{};
   const saved=ctx.core.db.roomBackups?.[areaId];
   if(!saved)return{ok:false,status:404,message:'Noch keine Raumsicherung vorhanden.'};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'room-restore',areaId,next=>{
    const gone=new Set(next.people.filter(p=>p.anonymizedAt).map(p=>p.id));
    next.grants=[...next.grants.filter(g=>g.areaId!==areaId),...structuredClone(saved.grants)];
    next.memberships=[...next.memberships.filter(m=>m.areaId!==areaId),...structuredClone(saved.memberships).filter(m=>!gone.has(m.personId))];
   });
   return{ok:true};
  },
  // E06: Zeitbudget direkt setzen (Verschärfung oder einzelner Verantwortlicher).
  budgetSet(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const childId=exprOf(ctx,spec.childId,scope),minutes=exprOf(ctx,spec.dailyMinutes,scope),windows=exprOf(ctx,spec.windows,scope);
   ctx.commit(ctx.session,'budget-set',null,next=>{
    let t=next.timeBudgets.find(t=>t.childId===childId);
    if(!t){t={childId,tz:'Europe/Berlin',warnAt:[5,1],graceMinutes:2,setBy:ctx.session.personId};next.timeBudgets.push(t);}
    Object.assign(t,{dailyMinutes:minutes,windows,setBy:ctx.session.personId,updatedAt:new Date().toISOString()});
    delete t.pendingBudget;
   });
   return{ok:true};
  },
  // E06: Lockerung als ausstehende Änderung vormerken (Zweitbestätigung nötig).
  budgetPropose(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const childId=exprOf(ctx,spec.childId,scope),minutes=exprOf(ctx,spec.dailyMinutes,scope),windows=exprOf(ctx,spec.windows,scope);
   ctx.commit(ctx.session,'budget-propose',null,next=>{
    let t=next.timeBudgets.find(t=>t.childId===childId);
    if(!t){t={childId,dailyMinutes:minutes,windows,tz:'Europe/Berlin',warnAt:[5,1],graceMinutes:2};next.timeBudgets.push(t);}
    t.pendingBudget={dailyMinutes:minutes,windows,proposedBy:ctx.session.personId,approvals:[ctx.session.personId]};
   });
   return{ok:true};
  },
  // E06: ausstehende Budgetänderung durch zweiten Verantwortlichen bestätigen.
  budgetApprove(ctx,_component,params){
   const spec=params?.[0]||{},scope={},childId=exprOf(ctx,spec.childId,scope);
   ctx.commit(ctx.session,'budget-approve',null,next=>{
    const nt=next.timeBudgets.find(t=>t.childId===childId);
    Object.assign(nt,{dailyMinutes:nt.pendingBudget.dailyMinutes,windows:nt.pendingBudget.windows,setBy:nt.pendingBudget.proposedBy,updatedAt:new Date().toISOString()});
    delete nt.pendingBudget;
   });
   return{ok:true};
  },
  // Domänenoperation: Hausbewohner ohne erzwungene Raumzuordnung anlegen.
  createHouseResident(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const name=exprOf(ctx,spec.name,scope),avatar=exprOf(ctx,spec.avatar,scope),sequence=exprOf(ctx,spec.sequence,scope),houseId=exprOf(ctx,spec.houseId,scope),kind=exprOf(ctx,spec.kind,scope)||'child';
   const id='person-'+crypto.randomUUID(),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'house-resident-create',houseId,next=>{
    next.people.push({id,name,avatar,kind,active:true});
    next.memberships.push({personId:id,areaId:houseId,active:true});
    next.roles.push({personId:id,areaId:houseId,role:'player',active:true});
    next.codes.push({personId:id,areaId:houseId,sequence});
   });
   return{ok:true,id,name};
  },
  // Aktivieren/Deaktivieren einer Hausmitgliedschaft. Beim Austritt werden
  // Raumzuordnungen und Raumrollen dieses Hauses entzogen; andere Häuser bleiben unberührt.
  setHouseMembership(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),houseId=exprOf(ctx,spec.houseId,scope),active=!!exprOf(ctx,spec.active,scope),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'house-membership-set',houseId,next=>{
    let row=next.memberships.find(m=>m.personId===personId&&m.areaId===houseId);
    if(!row){row={personId,areaId:houseId,active};next.memberships.push(row);}else row.active=active;
    if(!active){
     for(const m of next.memberships)if(m.personId===personId&&m.areaId!==houseId&&within(next,m.areaId,houseId))m.active=false;
     for(const r of next.roles)if(r.personId===personId&&r.areaId!==houseId&&within(next,r.areaId,houseId))r.active=false;
    }
   });
   return{ok:true,active};
  },
  // Kompatibler Schnellweg: Bewohner anlegen und sofort einem Raum zuordnen.
  createPlayer(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const name=exprOf(ctx,spec.name,scope),avatar=exprOf(ctx,spec.avatar,scope),sequence=exprOf(ctx,spec.sequence,scope),roomId=exprOf(ctx,spec.roomId,scope),houseId=exprOf(ctx,spec.houseId,scope);
   const id='person-'+crypto.randomUUID(),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'person-create',roomId,next=>{
    next.people.push({id,name,avatar,kind:'child',active:true});
    next.memberships.push({personId:id,areaId:houseId,active:true},{personId:id,areaId:roomId,active:true});
    next.roles.push({personId:id,areaId:houseId,role:'player',active:true},{personId:id,areaId:roomId,role:'player',active:true});
    next.codes.push({personId:id,areaId:houseId,sequence});
   });
   return{ok:true,id,name};
  }
 },
 TServerAccess:{
  // Lesender Zugangsstatus (ohne Hash/Salt) für die Detailansicht.
  describeCredentials(ctx,_component,params){
   const personId=exprOf(ctx,params?.[0],{}),credential=readCredentials(ctx).find(c=>c.personId===personId);
   return{exists:!!credential,username:credential?.username||'',label:credential?'Benutzername: '+credential.username:'Noch kein Zugang eingerichtet'};
  },
  hasCredentials(ctx,_component,params){
   const personId=exprOf(ctx,params?.[0],{});
   return readCredentials(ctx).some(c=>c.personId===personId);
  },
  // Technischer Baustein „Reset-Ticket erzeugen": Zufallstoken, nur Hash gespeichert,
  // 1 h gültig, an den aktuellen Passwortstand gebunden. Fachliche Prüfungen
  // (Rolle, Haus, Person, Zuständigkeit, Bestätigung) liegen im GCS-Flow davor.
  createResetTicket(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),houseId=exprOf(ctx,spec.houseId,scope);
   const credential=readCredentials(ctx).find(c=>c.personId===personId);
   if(!credential)return{ok:false,status:409,message:'Noch kein Zugang vorhanden. Bitte zuerst einladen.'};
   const token=crypto.randomBytes(32).toString('hex'),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'admin-reset-request',exprOf(ctx,audit.areaId,scope)||houseId,next=>{
    next.invites=(next.invites||[]).filter(i=>!(i.personId===personId&&['admin-reset','admin-setup'].includes(i.purpose)));
    next.invites.push({id:'invite-'+crypto.randomUUID(),personId,houseId,purpose:'admin-reset',issuer:ctx.session.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),credentialVersion:crypto.createHash('sha256').update(credential.hash).digest('hex'),expires:Date.now()+3600000});
   });
   return{ok:true,link:'/admin-enroll?ticket='+token};
  },
  // Einladungslink erzeugen: Token im Klartext nur in der Antwort, gespeichert wird der Hash.
  // Spec: personId, houseId, purpose ('admin-setup'|'parent'|'observer'), linkBase, optional childId/areaId.
  createInvite(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const personId=exprOf(ctx,spec.personId,scope),houseId=exprOf(ctx,spec.houseId,scope),purpose=spec.purpose||'admin-setup';
   const childId=exprOf(ctx,spec.childId,scope),areaId=exprOf(ctx,spec.areaId,scope);
   if(!personId||!houseId)throw Error('createInvite benötigt personId und houseId.');
   const token=crypto.randomBytes(32).toString('hex'),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'admin-invite',exprOf(ctx,audit.areaId,scope)||houseId,next=>{
    next.invites=(next.invites||[]).filter(i=>!(i.purpose===purpose&&i.personId===personId&&(purpose!=='parent'||i.childId===childId)&&(purpose!=='observer'||i.areaId===areaId)));
    const invite={id:'invite-'+crypto.randomUUID(),personId,houseId,purpose,issuer:ctx.session.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000};
    if(childId)invite.childId=childId;if(areaId)invite.areaId=areaId;
    next.invites.push(invite);
   });
   return{ok:true,link:(spec.linkBase||'/admin-enroll?ticket=')+token};
  },
  // Domänenoperation Eltern-Einladung: Guardian-Zuordnung (pending) + Einladung in einem Commit.
  // Die Person wird vorab angelegt, falls personId fehlt (eigener Commit 'parent-create').
  parentInvite(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const childId=exprOf(ctx,spec.childId,scope),houseId=exprOf(ctx,spec.houseId,scope);
   let personId=exprOf(ctx,spec.personId,scope);
   if(!personId){
    const name=exprOf(ctx,spec.name,scope);
    personId='person-'+crypto.randomUUID();
    ctx.commit(ctx.session,'parent-create',houseId,next=>next.people.push({id:personId,name,avatar:'👤',kind:'adult',active:true}));
   }
   const token=crypto.randomBytes(32).toString('hex'),pid=personId,audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'parent-invite',houseId,next=>{
    let g=next.guardians.find(g=>g.childId===childId&&g.guardianId===pid);
    if(!g){g={childId,guardianId:pid,status:'pending',issuer:ctx.session.personId,createdAt:new Date().toISOString(),confirmedBy:null,revokedAt:null};next.guardians.push(g);}else{g.status='pending';g.revokedAt=null;g.issuer=ctx.session.personId;}
    next.invites=next.invites.filter(i=>!(i.purpose==='parent'&&i.personId===pid&&i.childId===childId));
    next.invites.push({id:'invite-'+crypto.randomUUID(),personId:pid,childId,houseId,purpose:'parent',issuer:ctx.session.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000});
   });
   return{ok:true,link:'/parent-enroll?ticket='+token,self:pid===ctx.session.personId};
  },
  // Domänenoperation Beobachter-Einladung: Person ggf. anlegen + Observer-Einladung.
  observerInvite(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const houseId=exprOf(ctx,spec.houseId,scope),roomId=exprOf(ctx,spec.roomId,scope);
   let personId=exprOf(ctx,spec.personId,scope);
   if(!personId){
    const name=exprOf(ctx,spec.name,scope);
    personId='person-'+crypto.randomUUID();
    ctx.commit(ctx.session,'observer-create',houseId,next=>next.people.push({id:personId,name,avatar:'👁',kind:'adult',active:true}));
   }
   const token=crypto.randomBytes(32).toString('hex'),pid=personId,audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'observer-invite',roomId,next=>{
    next.invites=next.invites.filter(i=>!(i.purpose==='observer'&&i.personId===pid&&i.areaId===roomId));
    next.invites.push({id:'invite-'+crypto.randomUUID(),personId:pid,houseId,areaId:roomId,purpose:'observer',issuer:ctx.session.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000});
   });
   return{ok:true,link:'/observer-enroll?ticket='+token};
  },
  // Domänenoperation: ausstehende Eltern-Kind-Zuordnung durch zweiten Verantwortlichen bestätigen.
  approveGuardian(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const childId=exprOf(ctx,spec.childId,scope),guardianId=exprOf(ctx,spec.guardianId,scope),houseId=exprOf(ctx,spec.houseId,scope);
   const existing=ctx.core.db.guardians.find(x=>x.childId===childId&&x.guardianId===guardianId);
   if(!existing)return{ok:false,status:404,message:'Zuordnung nicht gefunden.'};
   if(existing.guardianId===ctx.session.personId||existing.issuer===ctx.session.personId)
    return{ok:false,status:409,message:'Vier-Augen-Prinzip: die einladende oder betroffene Person darf nicht selbst bestätigen.'};
   ctx.commit(ctx.session,exprOf(ctx,spec.audit?.action,scope)||'guardian-approve',houseId,next=>{
    const g=next.guardians.find(x=>x.childId===childId&&x.guardianId===guardianId);
    g.status='confirmed';g.confirmedBy=ctx.session.personId;g.confirmedAt=new Date().toISOString();
   });
   return{ok:true};
  },
  // Eigene Spiele: Entwurf ↔ veröffentlicht (gesperrte Spiele ausgenommen).
  publishGame(ctx){
   const b=ctx.body||{},game=ctx.core.db.games.find(g=>g.id===b.id&&g.ownerId===ctx.session.personId);
   if(!game||game.status==='blocked'||typeof b.published!=='boolean')return{ok:false,message:'Spiel nicht verfügbar.'};
   ctx.commit(ctx.session,'game-publish',null,next=>{next.games.find(g=>g.id===game.id).status=b.published?'published':'draft';});
   return{ok:true};
  },
  // Begutachtung eigener Spiele unabhängig vom Status: /play/-Vorschau-Launch
  // ohne Spielsitzung und Zeitbuchung. Die Route prüft dafür eine
  // Verwaltungssitzung statt Spielfreigabe; der Schlüssel ist kurzlebig.
  previewGame(ctx){
   const b=ctx.body||{},game=ctx.core.db.games.find(g=>g.id===b.id&&g.ownerId===ctx.session.personId);
   if(!game)return{ok:false,message:'Spiel nicht verfügbar.'};
   for(const[key,l]of ctx.launches)if(l.preview&&Date.now()-l.created>600e3)ctx.launches.delete(key);
   const key=crypto.randomBytes(24).toString('hex');
   ctx.launches.set(key,{preview:true,gameId:game.id,created:Date.now()});
   return{ok:true,launch:'/play/'+key,message:'Vorschau wird geöffnet.'};
  },
  // Entzogene Spielfreigabe („sofort beenden"): laufende Sitzungen und Partien
  // des Spiels in den betroffenen Räumen beenden — einzelner Raum (areaId)
  // oder alle Räume eines Hauses (houseId, Katalog-Entzug). Launch-Keys,
  // Partiezugänge und offene Einladungen werden mitgeräumt; die
  // Raumzuordnung selbst bleibt gespeichert (Reaktivierung wirkt wieder).
  revokeGame(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db,now=new Date().toISOString();
   const gameId=exprOf(ctx,spec.gameId,scope),roomId=exprOf(ctx,spec.areaId,scope),houseId=exprOf(ctx,spec.houseId,scope);
   const roomIds=new Set(houseId?db.areas.filter(a=>a.type==='room'&&within(db,a.id,houseId)).map(a=>a.id):(roomId?[roomId]:[]));
   if(!gameId||!roomIds.size)return{ok:true,endedSessions:0,endedParties:0};
   const parties=db.parties.filter(p=>roomIds.has(p.areaId)&&p.gameId===gameId&&p.status!=='ended');
   const sessionIds=new Set(db.playSessions.filter(s=>roomIds.has(s.areaId)&&s.gameId===gameId&&s.status!=='ended').map(s=>s.id));
   for(const p of parties)for(const m of p.members.filter(m=>!m.leftAt&&m.playSessionId))sessionIds.add(m.playSessionId);
   ctx.commit(ctx.session,'game-revoke',houseId||roomId||null,next=>{
    const partyIds=new Set(parties.map(p=>p.id));
    for(const p of next.parties.filter(p=>partyIds.has(p.id))){
     p.status='ended';p.endedAt=now;
     for(const a of next.temporaryRoomAccess.filter(a=>a.sessionId===p.id))a.active=false;
    }
    for(const i of next.gameInvitations.filter(i=>i.status==='pending'&&partyIds.has(i.sessionId))){
     i.status='expired';const a=next.temporaryRoomAccess.find(x=>x.invitationId===i.id);if(a)a.active=false;
    }
    for(const s of next.playSessions.filter(s=>sessionIds.has(s.id)))if(s.status!=='ended'){s.status='ended';s.endedAt=now;}
   });
   removeLaunchesFor(ctx,[...sessionIds]);
   return{ok:true,endedSessions:sessionIds.size,endedParties:parties.length};
  }
 },
 // --- Spielsitzungen (P3): Zeitbuchung serverseitig, State-Atoms --------------
 TServerPlaySession:{
  // Session laden: Lazy-Refresh (Heartbeat-Stille → 'disconnected') + Eigentum.
  load(ctx,_component,params){
   const id=exprOf(ctx,params?.[0],{}),s=refreshSession(ctx.core.db,ctx.core.db.playSessions.find(x=>x.id===id));
   return s&&s.childId===ctx.session.personId?{ok:true,found:true,item:s}:{ok:true,found:false,item:null};
  },
  // Blockierende Sitzung des Kindes (Einzelsitzungsregel), Refresh inklusive.
  activeSession(ctx,_component,params){
   const childId=exprOf(ctx,params?.[0],{}),db=ctx.core.db;
   const s=refreshSession(db,db.playSessions.find(x=>x.childId===childId&&['active','paused'].includes(x.status)));
   return s&&['active','paused'].includes(s.status)?{ok:true,found:true,item:s}:{ok:true,found:false,item:null};
  },
  // Effektives Restbudget: Elternbudget ∩ Hausvorgabe (areas.maxDailyMinutes).
  budgetLeft(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const childId=exprOf(ctx,spec.childId,scope),areaId=exprOf(ctx,spec.areaId,scope),db=ctx.core.db;
   const{limit,budget}=limitForChild(db,childId,areaId),used=todayMinutesOf(db,childId);
   const left=limit===null?null:Math.max(0,limit-used);
   return{ok:true,limit,used,left,exhausted:limit!==null&&left<=0,warnAt:budget?.warnAt||[5,1],graceMinutes:budget?.graceMinutes??2};
  },
  // Reconnect: getrennte Sitzung gilt wieder als aktiv (ohne Commit, wie Legacy).
  reconnect(ctx,_component,params){
   const id=exprOf(ctx,params?.[0],{}),s=ctx.core.db.playSessions.find(x=>x.id===id);
   if(s&&s.status==='disconnected')s.status='active';
   return{ok:true,status:s?.status};
  },
  start(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db;
   const gameId=exprOf(ctx,spec.gameId,scope),areaId=exprOf(ctx,spec.areaId,scope);
   const game=db.games.find(g=>g.id===gameId);
   const id='ps-'+crypto.randomUUID(),now=new Date().toISOString();
   ctx.commit(ctx.session,'play-start',areaId,next=>{
    next.playSessions.push({id,childId:ctx.session.personId,gameId:game.id,areaId,status:'active',startedAt:now,lastHeartbeatAt:now,endedAt:null,minutes:0});
   });
   const{budget}=limitForChild(db,ctx.session.personId,areaId);
   return{ok:true,playSessionId:id,remainingMinutes:remainingFor(db,ctx.session.personId,areaId),warnAt:budget?.warnAt||[5,1],graceMinutes:budget?.graceMinutes??2};
  },
  // Zeitbuchung aus Server-Delta (Client-Angaben sind nur Hinweise); AfK-Cap 5min,
  // Budget-Erschöpfung startet Grace-Frist, Fristablauf beendet die Sitzung.
  heartbeat(ctx,_component,params){
   const id=exprOf(ctx,params?.[0],{}),db=ctx.core.db,s=refreshSession(db,db.playSessions.find(x=>x.id===id));
   if(!s||s.childId!==ctx.session.personId)return{ok:false,status:404,message:'Spielsitzung nicht gefunden.'};
   if(s.status==='disconnected')s.status='active'; // Reconnect ohne Commit nötig
   if(s.status!=='active')return{ok:true,status:s.status,ended:s.status==='ended'};
   if(db.parties.some(p=>p.oneClick&&p.status==='open'&&p.members.some(m=>m.playSessionId===id&&!m.leftAt))){
    ctx.commit(ctx.session,'play-heartbeat-wait',s.areaId,next=>{next.playSessions.find(x=>x.id===id).lastHeartbeatAt=new Date().toISOString();},{audit:false});
    return{ok:true,status:'active',remainingMinutes:remainingFor(db,s.childId,s.areaId)};
   }
   const delta=Math.min(Date.now()-new Date(s.lastHeartbeatAt).getTime(),heartbeatCapMs());
   ctx.commit(ctx.session,'play-heartbeat',s.areaId,next=>{
    const ns=next.playSessions.find(x=>x.id===s.id);
    ns.minutes+=Math.round(delta/60000*100)/100;
    ns.lastHeartbeatAt=new Date().toISOString();
    const rem=remainingFor(next,ns.childId,ns.areaId);
    if(rem!==null&&rem<=0&&!ns.graceUntil){
     const g=(limitForChild(next,ns.childId,ns.areaId).budget?.graceMinutes??2)*60000;
     ns.graceUntil=new Date(Date.now()+g).toISOString();
    }
    if(ns.graceUntil&&Date.now()>new Date(ns.graceUntil).getTime()){ns.status='ended';ns.endedAt=new Date().toISOString();}
   },{audit:false});
   const cur=db.playSessions.find(x=>x.id===s.id);
   return{ok:true,status:cur.status,remainingMinutes:remainingFor(db,cur.childId,cur.areaId),warn:warnLevelOf(db,cur.childId,cur),ended:cur.status==='ended'};
  },
  // Statusübergang (paused/active/ended) — Zulässigkeit prüft der Task.
  setStatus(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db;
   const id=exprOf(ctx,spec.id,scope),target=exprOf(ctx,spec.status,scope);
   const s=db.playSessions.find(x=>x.id===id);
   if(!s)return{ok:false,status:404,message:'Spielsitzung nicht gefunden.'};
   if(target==='ended'&&s.status==='ended')return{ok:true,status:'ended',minutes:s.minutes};
   ctx.commit(ctx.session,'play-'+({paused:'pause',active:'resume',ended:'end'}[target]||target),s.areaId,next=>{
    const ns=next.playSessions.find(x=>x.id===s.id);
    ns.status=target;ns.lastHeartbeatAt=new Date().toISOString();
    if(target==='ended')ns.endedAt=new Date().toISOString();
   });
   const cur=db.playSessions.find(x=>x.id===s.id);
   return{ok:true,status:cur.status,minutes:cur.minutes,remainingMinutes:remainingFor(db,cur.childId,cur.areaId)};
  },
  // Spielstart + Launch-Grant (E08): /play/<Schlüssel> ist die begrenzte
  // Berechtigung für die Player-Seite — sie kennt das Spieler-Token nicht.
  // Der eigentliche Sitzungsbeginn läuft über den play-Adapter (ctx.play),
  // damit Budget- und Einzelsitzungsregeln identisch greifen.
  launchGame(ctx){
   const started=ctx.play.api(ctx.session,'start',ctx.body||{});
   if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
   for(const [key,l]of ctx.launches)if(!ctx.core.session(l.token))ctx.launches.delete(key);
   const key=crypto.randomBytes(24).toString('hex');
   ctx.launches.set(key,{token:ctx.body.token,gameId:ctx.body.gameId,areaId:ctx.body.areaId,playSessionId:started.data.playSessionId});
   return{ok:true,launch:'/play/'+key,...started.data,message:'▶'};
  },
  // Bewertungsmeldung (E07) aus laufender Sitzung — Metrik-/Freigabeprüfung liegt im Task.
  reportProgress(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db;
   const s=db.playSessions.find(x=>x.id===exprOf(ctx,spec.playSessionId,scope));
   if(!s)return{ok:false,status:404,message:'Spielsitzung nicht gefunden.'};
   ctx.commit(ctx.session,'progress-report',s.areaId,next=>{
    const row={eventId:exprOf(ctx,spec.eventId,scope),childId:ctx.session.personId,gameId:s.gameId,sessionId:s.id,
     metric:exprOf(ctx,spec.metric,scope),value:exprOf(ctx,spec.value,scope),unit:String(exprOf(ctx,spec.unit,scope)||'count'),
     reportedAt:new Date().toISOString(),source:'game',schemaVersion:Number(exprOf(ctx,spec.schemaVersion,scope))||1};
    next.progress.push(row);
    // Sponsoring: gepruefte Leistungspunkte entstehen im selben Fachcommit
    // (nur Einträge, die eine veröffentlichte Regelversion serverseitig deckt);
    // anschließend Anspruchsbewertung aller Begleitungen des Kindes.
    const added=perfModule.ingestProgress(next,row);
    if(added.length)perfModule.evaluateAllForChild(next,row.childId,{notify:sponsorModule._i.notify});
   });
   return{ok:true};
  },
  // Prozessweiter Stillstand-Sweep: ohne Heartbeat wird eine Sitzung zuerst
  // getrennt und nach abandonAfterMs beendet; Partien ohne aktive Sitzung enden.
  sweep(ctx,component){
   ctx.session=ctx.session||{personId:'system'};
   expireInvitations(ctx);
   const db=ctx.core.db,now=Date.now(),at=new Date(now).toISOString();
   const disconnectAfter=Number(component?.disconnectGraceMs)||disconnectMs(),abandonAfter=Number(component?.abandonAfterMs)||600000;
   const endedIds=[],disconnectedIds=[];
   const idleOf=s=>{const stamp=Date.parse(s.lastHeartbeatAt||s.startedAt||'');return Number.isFinite(stamp)?now-stamp:abandonAfter+1;};
   for(const s of db.playSessions){
    if(!['active','paused','disconnected'].includes(s.status))continue;
    if(idleOf(s)>abandonAfter)endedIds.push(s.id);
    else if(idleOf(s)>disconnectAfter&&s.status!=='disconnected')disconnectedIds.push(s.id);
   }
   const effectiveStatus=s=>endedIds.includes(s.id)?'ended':s.status;
   const partyIds=db.parties.filter(p=>p.status==='playing'&&p.members.filter(m=>!m.leftAt).every(m=>{
    const s=db.playSessions.find(x=>x.id===m.playSessionId);
    return!s||effectiveStatus(s)==='ended';
   })).map(p=>p.id);
   if(endedIds.length||disconnectedIds.length||partyIds.length)ctx.commit(ctx.session,'session-sweep',null,next=>{
    for(const s of next.playSessions){
     if(endedIds.includes(s.id)){s.status='ended';s.endedAt=at;}
     else if(disconnectedIds.includes(s.id))s.status='disconnected';
    }
    for(const p of next.parties.filter(p=>partyIds.includes(p.id))){
     p.status='ended';p.endedAt=at;
     for(const access of next.temporaryRoomAccess.filter(a=>a.sessionId===p.id))access.active=false;
    }
   },{audit:false});
   removeLaunchesFor(ctx,db.playSessions.filter(s=>s.status==='ended').map(s=>s.id));
   return{ok:true,disconnected:disconnectedIds.length,ended:endedIds.length,partiesEnded:partyIds.length};
  }
 },
 // --- Hausinterner Multiplayer (P4): Partien mit Aktionslog --------------------
 // Session-Lebenszyklus geht über ctx.play (der play-Adapter) — Zeitbudget greift
 // so auch in der Gruppe.
 TServerLiveSync:{
  input(ctx,_component,params){
   const raw=params?.[0]||{};
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return{ok:false,status:400,message:'Ungültige Live-Eingabe.'};
   const seq=Number(raw.seq);
   if(!Number.isSafeInteger(seq)||seq<1||seq>1000000000)return{ok:false,status:400,message:'Ungültige Eingabe-Sequenz.'};
   // Generische Zug-Absichten (z.B. MADN): kleines JSON-Telegramm statt dir/y/vy.
   if(raw.data!==undefined){
    if(!liveDataOk(raw.data,2000,4))return{ok:false,status:400,message:'Ungültige Eingabedaten.'};
    return{ok:true,input:{seq,dir:0,data:raw.data,at:Date.now(),by:ctx.session.personId}};
   }
   const dir=Number(raw.dir);
   if(![-1,0,1].includes(dir))return{ok:false,status:400,message:'Ungültige Eingaberichtung.'};
   const input={seq,dir,at:Date.now(),by:ctx.session.personId};
   // Optionale eigene Paddle-Kinematik (geteilte Autoritaet): der Meldende ist
   // fuer sein eigenes Paddle massgeblich; die Gegenseite interpoliert y/vy.
   if(raw.y!==undefined){const y=Number(raw.y);if(!Number.isFinite(y)||y<-20||y>80)return{ok:false,status:400,message:'Ungültige Paddle-Position.'};input.y=y;}
   if(raw.vy!==undefined){const vy=Number(raw.vy);if(!Number.isFinite(vy)||vy<-10||vy>10)return{ok:false,status:400,message:'Ungültige Paddle-Geschwindigkeit.'};input.vy=vy;}
   return{ok:true,input};
  },
  state(ctx,_component,params){
   const raw=params?.[0]||{},phases=['wait','serve','play','point','paused','finished'];
   if(!raw||typeof raw!=='object'||Array.isArray(raw))return{ok:false,status:400,message:'Ungültiger Live-Stand.'};
   const tick=Number(raw.tick);
   if(!Number.isSafeInteger(tick)||tick<1||tick>1000000000)return{ok:false,status:400,message:'Ungültiger State-Tick.'};
   // Generischer Datenstand fuer rundenbasierte Spiele (z.B. MADN): tick +
   // freie Phasenbezeichnung + kompaktes JSON-Telegramm statt PingPong-Schema.
   if(raw.data!==undefined){
    const phase=String(raw.phase||'');
    if(!/^[a-z0-9_-]{1,24}$/i.test(phase))return{ok:false,status:400,message:'Ungültige Spielphase.'};
    if(!liveDataOk(raw.data,3000,5))return{ok:false,status:400,message:'Live-Datenstand zu groß oder ungültig.'};
    return{ok:true,state:{tick,phase,data:raw.data,at:Date.now(),by:ctx.session.personId}};
   }
   const phase=String(raw.phase||'');
   if(!phases.includes(phase))return{ok:false,status:400,message:'Ungültige Spielphase.'};
   const num=(name,min,max)=>{const v=Number(raw[name]);return Number.isFinite(v)&&v>=min&&v<=max?v:null};
   const state={tick,phase,
    ballX:num('ballX',-20,100),ballY:num('ballY',-20,80),ballVX:num('ballVX',-10,10),ballVY:num('ballVY',-10,10),
    leftY:num('leftY',-20,80),leftVY:num('leftVY',-10,10),rightY:num('rightY',-20,80),rightVY:num('rightVY',-10,10),
    scoreLeft:num('scoreLeft',0,99),scoreRight:num('scoreRight',0,99),targetScore:num('targetScore',1,99),lastInputSeq:num('lastInputSeq',0,1000000000)};
   if(Object.values(state).some(v=>v===null))return{ok:false,status:400,message:'Live-Stand außerhalb der zulässigen Grenzen.'};
   state.at=Date.now();state.by=ctx.session.personId;
   return{ok:true,state};
  },
  snapshot(ctx,component,params){
   const p=params?.[0],live=params?.[1]||{},personId=params?.[2],since=Number(params?.[3])||0,db=ctx.core.db,now=Date.now();
   const active=(p?.members||[]).filter(m=>!m.leftAt),remoteCandidates=Object.values(live.inputs||{}).filter(i=>i&&i.by!==personId).sort((a,b)=>Number(b.at)-Number(a.at)),remoteInput=remoteCandidates[0]||null,state=live.state||null;
   return{ok:true,status:p?.status||'ended',ended:!p||p.status==='ended',memberCount:active.length,youAreHost:personId===p?.hostId,
    seatIndex:active.findIndex(m=>m.personId===personId),memberIds:active.map(m=>m.personId),
    live:state?{...state,ageMs:Math.max(0,now-Number(state.at||now)),stale:now-Number(state.at||now)>Number(component.maxStateAgeMs||2000)}:null,
    remoteInput:remoteInput?{...remoteInput,ageMs:Math.max(0,now-Number(remoteInput.at||now)),expired:now-Number(remoteInput.at||now)>Number(component.inputTtlMs||750)}:null,
    actions:(p?.actions||[]).filter(a=>a.seq>since),lastSeq:(p?.actions||[]).length?p.actions[p.actions.length-1].seq:0,
    memberNames:active.map(m=>db.people.find(x=>x.id===m.personId)?.name||m.personId).join(', ')};
  }
 },
 // --- Betroffenenrechte (Art. 15/17/20 DSGVO): personenbezogener Export und
 // Löschung eines Kindes. Guard (viewChild) läuft deklarativ in den Tasks —
 // hier zudem Defense-in-Depth erneut geprüft.
 TServerPrivacy:{
  exportPerson(ctx,_component,params){
   const childId=exprOf(ctx,params?.[0],{});
   if(!ctx.core.can(ctx.session,'viewChild',{childId}))return{ok:false,status:403,message:'Nur eigene, bestätigt zugeordnete Kinder.'};
   const data=createPrivacy(ctx.core,ctx.store,ctx.uploads).exportPerson(childId);
   if(!data)return{ok:false,status:404,message:'Kind nicht gefunden.'};
   return{ok:true,data,json:JSON.stringify(data,null,2)};
  },
  deletePerson(ctx,_component,params){
   const childId=exprOf(ctx,params?.[0],{});
   if(!ctx.core.can(ctx.session,'viewChild',{childId}))return{ok:false,status:403,message:'Nur eigene, bestätigt zugeordnete Kinder.'};
   const r=createPrivacy(ctx.core,ctx.store,ctx.uploads).deletePerson(ctx.session.personId,childId);
   return r.ok?{ok:true,message:r.message}:{ok:false,status:400,message:r.message};
  },
 },
 TServerParty:{
  startInvite(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,gameId=exprOf(ctx,spec.gameId,{}),areaId=exprOf(ctx,spec.areaId,{}),personId=exprOf(ctx,spec.personId,{});
   const game=db.games.find(g=>g.id===gameId),house=houseOf(db,areaId),person=db.people.find(p=>p.id===personId&&p.active);
   if(!game?.multiplayer||!ctx.core.can(ctx.session,'play',{game,areaId}))return{ok:false,status:403,message:'Mehrspieler-Spiel oder Raum nicht freigegeben.'};
   if(!house||!person||personId===ctx.session.personId||!db.memberships.some(m=>m.personId===personId&&m.areaId===house.id&&m.active))return{ok:false,status:403,message:'Nur aktive Bewohner dieses Hauses können eingeladen werden.'};
   expireInvitations(ctx);
   if(db.parties.some(p=>p.status!=='ended'&&p.members.some(m=>m.personId===personId&&!m.leftAt)))return{ok:false,status:409,message:'Diese Person ist bereits in einer Partie.'};
   const issue=(p,i)=>{const key=crypto.randomBytes(24).toString('hex'),playSessionId=p.members.find(m=>m.personId===ctx.session.personId&&!m.leftAt)?.playSessionId;ctx.launches.set(key,{token:ctx.body.token,gameId,areaId,playSessionId,partyId:p.id});return{ok:true,partyId:p.id,invitationId:i.id,expiresAt:i.expiresAt,launch:'/play/'+key,message:person.name+' wurde eingeladen.'};};
   const existing=db.parties.find(p=>p.status!=='ended'&&p.members.some(m=>m.personId===ctx.session.personId&&!m.leftAt)),otherPending=db.gameInvitations.find(i=>i.invitedPersonId===personId&&i.status==='pending'&&Number(i.expiresAt)>Date.now()&&i.sessionId!==existing?.id);
   if(otherPending)return{ok:false,status:409,message:'Für diese Person liegt bereits eine Einladung vor.'};
   if(existing){
    if(existing.hostId!==ctx.session.personId||existing.areaId!==areaId||existing.gameId!==gameId||existing.status!=='open'||existing.gameVersion!==(game.version||1)||existing.file!==game.file||existing.members.filter(m=>!m.leftAt).length!==1)return{ok:false,status:409,message:'Du bist bereits in einer Partie.'};
    const pending=db.gameInvitations.filter(i=>i.sessionId===existing.id&&i.status==='pending');
    if(pending.length){
     if(pending.length!==1||pending[0].invitedPersonId!==personId)return{ok:false,status:409,message:'Für diese Partie besteht bereits eine andere Einladung.'};
     if(!existing.oneClick)ctx.commit(ctx.session,'party-resume-invite',areaId,next=>{next.parties.find(p=>p.id===existing.id).oneClick=true;});
     return issue(existing,pending[0]);
    }
    ctx.commit(ctx.session,'party-close-stale',areaId,next=>{const p=next.parties.find(p=>p.id===existing.id);p.status='ended';p.endedAt=new Date().toISOString();for(const a of next.temporaryRoomAccess.filter(a=>a.sessionId===p.id))a.active=false;});
    const sessionIds=existing.members.filter(m=>!m.leftAt).map(m=>m.playSessionId);removeLaunchesFor(ctx,sessionIds);
    for(const m of existing.members.filter(m=>!m.leftAt))ctx.play.api({personId:m.personId},'end',{playSessionId:m.playSessionId});
   }
   const started=ctx.play.api(ctx.session,'start',{gameId,areaId});
   if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
   const now=Date.now(),partyId='party-'+crypto.randomUUID(),invitationId='invite-'+crypto.randomUUID(),expiresAt=now+5*60*1000;
   try{ctx.commit(ctx.session,'party-start-invite',areaId,next=>{
    next.parties.push({id:partyId,gameId,gameVersion:game.version||1,file:game.file,areaId,houseId:house.id,hostId:ctx.session.personId,status:'open',oneClick:true,members:[{personId:ctx.session.personId,playSessionId:started.data.playSessionId,joinedAt:new Date(now).toISOString()}],actions:[],createdAt:new Date(now).toISOString()});
    next.gameInvitations.push({id:invitationId,sessionId:partyId,inviterPersonId:ctx.session.personId,invitedPersonId:personId,roomId:areaId,status:'pending',createdAt:new Date(now).toISOString(),expiresAt});
    next.temporaryRoomAccess.push({id:'temp-room-'+crypto.randomUUID(),sessionId:partyId,invitationId,personId,roomId:areaId,active:true,createdAt:new Date(now).toISOString(),expiresAt});
    next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:personId,type:'game-invitation',invitationId,read:false,createdAt:new Date(now).toISOString()});
   });}catch(e){ctx.play.api(ctx.session,'end',{playSessionId:started.data.playSessionId});throw e;}
   return issue(db.parties.find(p=>p.id===partyId),db.gameInvitations.find(i=>i.id===invitationId));
  },
  // Fortsetzen einer eigenen laufenden Partie: resume-info zeigt nur den
  // serverseitig geprüften Hinweis, resume() stellt danach einen neuen
  // Launch-Grant aus. Clientseitige Hinweise sind keine Berechtigung.
  resumeInfo(ctx){
   expireInvitations(ctx);
   const p=activePartyFor(ctx);
   return p?{ok:true,found:true,item:partyResumeInfo(ctx,p)}:{ok:true,found:false,item:null,message:'Keine laufende Partie.'};
  },
  resume(ctx){
   expireInvitations(ctx);
   const db=ctx.core.db,p=activePartyFor(ctx);
   if(!p)return{ok:false,status:404,message:'Keine laufende Partie gefunden.'};
   if(!['open','playing'].includes(p.status))return{ok:false,status:409,message:'Diese Partie ist beendet.'};
   const member=p.members.find(m=>m.personId===ctx.session.personId&&!m.leftAt);
   if(!member)return{ok:false,status:403,message:'Kein Mitglied dieser Partie.'};
   const game=db.games.find(g=>g.id===p.gameId);
   if(!game?.multiplayer||game.status!=='published'||(game.version||1)!==(p.gameVersion||1)||(p.file&&p.file!==game.file))return{ok:false,status:409,message:'Das Spiel wurde aktualisiert — die Partie kann nicht fortgesetzt werden.'};
   if(!areaActive(db,p.areaId))return{ok:false,status:410,message:'Der Raum dieser Partie ist nicht mehr aktiv.'};
   // Angenommene Einladungen erhalten Raumzutritt für die Partiedauer. Nach
   // Ablauf wird derselbe fachliche Zutritt für das Fortsetzen erneuert.
   const access=member.invitationId&&db.temporaryRoomAccess.find(a=>a.invitationId===member.invitationId);
   if(access&&(!access.active||Number(access.expiresAt)<=Date.now()))ctx.commit(ctx.session,'party-resume-access',p.areaId,next=>{const a=next.temporaryRoomAccess.find(x=>x.id===access.id);if(a){a.active=true;a.expiresAt=Date.now()+60*60*1000;}});
   if(!ctx.core.can(ctx.session,'play',{game,areaId:p.areaId}))return{ok:false,status:403,message:'Spiel oder Raum ist nicht mehr freigegeben.'};
   const previousPlaySessionId=member.playSessionId,restarted=resumePartySession(ctx,p,member);
   if(!restarted.ok)return{ok:false,status:restarted.status||500,message:restarted.message||'Partie kann nicht fortgesetzt werden.'};
   const playSessionId=restarted.playSessionId;
   removeLaunchesFor(ctx,[previousPlaySessionId,playSessionId].filter(Boolean));
   const key=crypto.randomBytes(24).toString('hex');
   ctx.launches.set(key,{token:ctx.body.token,gameId:p.gameId,areaId:p.areaId,playSessionId,partyId:p.id});
   return{ok:true,...partyResumeInfo(ctx,p),launch:'/play/'+key,message:'Partie wird fortgesetzt.'};
  },
  // Wieder-Beitritt: findet auch ausgetretene eigene Mitgliedschaften (leftAt)
  // in noch laufenden Partien. rejoin() nimmt das Mitglied wieder auf und
  // stellt danach denselben Fortsetzungsweg wie resume() her.
  rejoinable(ctx){
   expireInvitations(ctx);
   const p=rejoinablePartyFor(ctx);
   if(!p)return{ok:true,found:false,item:null,message:'Keine laufende Partie.'};
   const member=p.members.find(m=>m.personId===ctx.session.personId);
   return{ok:true,found:true,rejoin:!!member?.leftAt,item:partyResumeInfo(ctx,p)};
  },
  rejoin(ctx){
   expireInvitations(ctx);
   const db=ctx.core.db,p=rejoinablePartyFor(ctx);
   if(!p)return{ok:false,status:404,message:'Keine laufende Partie gefunden.'};
   if(!['open','playing'].includes(p.status))return{ok:false,status:409,message:'Diese Partie ist beendet.'};
   const member=p.members.find(m=>m.personId===ctx.session.personId);
   if(!member)return{ok:false,status:403,message:'Kein Mitglied dieser Partie.'};
   if(!member.leftAt)return methods.TServerParty.resume(ctx);
   const game=db.games.find(g=>g.id===p.gameId);
   if(!game?.multiplayer||game.status!=='published'||(game.version||1)!==(p.gameVersion||1)||(p.file&&p.file!==game.file))return{ok:false,status:409,message:'Das Spiel wurde aktualisiert — die Partie kann nicht wieder betreten werden.'};
   if(!areaActive(db,p.areaId))return{ok:false,status:410,message:'Der Raum dieser Partie ist nicht mehr aktiv.'};
   const access=member.invitationId&&db.temporaryRoomAccess.find(a=>a.invitationId===member.invitationId);
   if(access&&(!access.active||Number(access.expiresAt)<=Date.now()))ctx.commit(ctx.session,'party-rejoin-access',p.areaId,next=>{const a=next.temporaryRoomAccess.find(x=>x.id===access.id);if(a){a.active=true;a.expiresAt=Date.now()+60*60*1000;}});
   if(!ctx.core.can(ctx.session,'play',{game,areaId:p.areaId}))return{ok:false,status:403,message:'Spiel oder Raum ist nicht mehr freigegeben.'};
   ctx.commit(ctx.session,'party-rejoin',p.areaId,next=>{
    const m=next.parties.find(x=>x.id===p.id)?.members.find(x=>x.personId===ctx.session.personId);
    if(m)delete m.leftAt;
   });
   const previousPlaySessionId=member.playSessionId,restarted=resumePartySession(ctx,p,member);
   if(!restarted.ok)return{ok:false,status:restarted.status||500,message:restarted.message||'Partie kann nicht wieder betreten werden.'};
   const playSessionId=restarted.playSessionId;
   removeLaunchesFor(ctx,[previousPlaySessionId,playSessionId].filter(Boolean));
   const key=crypto.randomBytes(24).toString('hex');
   ctx.launches.set(key,{token:ctx.body.token,gameId:p.gameId,areaId:p.areaId,playSessionId,partyId:p.id});
   return{ok:true,...partyResumeInfo(ctx,p),launch:'/play/'+key,message:'Du nimmst wieder an der Partie teil.'};
  },
  // Einladbare Bewohner desselben Hauses. Ein Raumzutritt ist noch nicht nötig:
  // genau dafür legt invite() einen zeitlich begrenzten Zutritt an.
  inviteCandidates(ctx,_component,params){
   const db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,params?.[0],{}));
   if(!p)return{ok:false,status:404,message:'Partie nicht gefunden.'};
   if(p.hostId!==ctx.session.personId)return{ok:false,status:403,message:'Nur der Gastgeber kann einladen.'};
   if(p.status!=='open')return{ok:false,status:409,message:'Diese Partie nimmt keine Einladungen mehr an.'};
   const houseId=p.houseId||houseOf(db,p.areaId)?.id,activeMembers=new Set(p.members.filter(m=>!m.leftAt).map(m=>m.personId));
   const busy=new Set(db.parties.filter(q=>q.status!=='ended').flatMap(q=>q.members.filter(m=>!m.leftAt).map(m=>m.personId)));
   const residents=new Set(db.memberships.filter(m=>m.areaId===houseId&&m.active).map(m=>m.personId));
   const items=db.people.filter(person=>person.active&&residents.has(person.id)&&!activeMembers.has(person.id)&&!busy.has(person.id))
    .map(person=>({id:person.id,name:person.name,avatar:person.avatar||'🙂',invited:(db.gameInvitations||[]).some(i=>i.sessionId===p.id&&i.invitedPersonId===person.id&&i.status==='pending'&&Number(i.expiresAt)>Date.now())}));
   return{ok:true,items,message:items.length?'Bewohner auswählen':'Alle Bewohner sind bereits dabei.'};
  },
  invite(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,partyId=exprOf(ctx,spec.partyId,{}),personId=exprOf(ctx,spec.personId,{}),p=db.parties.find(x=>x.id===partyId);
   if(!p)return{ok:false,status:404,message:'Partie nicht gefunden.'};
   if(p.hostId!==ctx.session.personId)return{ok:false,status:403,message:'Nur der Gastgeber kann einladen.'};
   if(p.status!=='open')return{ok:false,status:409,message:'Die Partie wurde bereits gestartet oder beendet.'};
   const houseId=p.houseId||houseOf(db,p.areaId)?.id,person=db.people.find(x=>x.id===personId&&x.active);
   if(!person||!db.memberships.some(m=>m.personId===personId&&m.areaId===houseId&&m.active))return{ok:false,status:403,message:'Nur aktive Bewohner dieses Hauses können eingeladen werden.'};
   if(p.members.some(m=>m.personId===personId&&!m.leftAt))return{ok:false,status:409,message:'Die Person ist bereits in der Partie.'};
   if(db.parties.some(q=>q.status!=='ended'&&q.members.some(m=>m.personId===personId&&!m.leftAt)))return{ok:false,status:409,message:'Diese Person ist bereits in einer Partie.'};
   if((db.gameInvitations||[]).some(i=>i.invitedPersonId===personId&&i.status==='pending'&&Number(i.expiresAt)>Date.now()))return{ok:false,status:409,message:'Für diese Person liegt bereits eine Einladung vor.'};
   const id='invite-'+crypto.randomUUID(),accessId='temp-room-'+crypto.randomUUID(),now=Date.now(),expiresAt=now+5*60*1000;
   ctx.commit(ctx.session,'party-invite',p.areaId,next=>{
    next.gameInvitations.push({id,sessionId:p.id,inviterPersonId:ctx.session.personId,invitedPersonId:personId,roomId:p.areaId,status:'pending',createdAt:new Date(now).toISOString(),expiresAt});
    next.temporaryRoomAccess.push({id:accessId,sessionId:p.id,invitationId:id,personId,roomId:p.areaId,active:true,createdAt:new Date(now).toISOString(),expiresAt});
    next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:personId,type:'game-invitation',invitationId:id,read:false,createdAt:new Date(now).toISOString()});
   });
   return{ok:true,invitationId:id,expiresAt,message:person.name+' wurde eingeladen.'};
  },
  invitations(ctx){
   expireInvitations(ctx);
   const db=ctx.core.db,now=Date.now(),decorate=i=>{const p=db.parties.find(x=>x.id===i.sessionId),host=db.people.find(x=>x.id===i.inviterPersonId),game=p&&db.games.find(g=>g.id===p.gameId),room=p&&db.areas.find(a=>a.id===p.areaId);return{id:i.id,partyId:i.sessionId,status:i.status==='pending'&&Number(i.expiresAt)<=now?'expired':i.status,host:host?.name||'',game:game?.title||'',room:room?.name||'',expiresAt:i.expiresAt};};
   return{ok:true,items:(db.gameInvitations||[]).filter(i=>i.invitedPersonId===ctx.session.personId).map(decorate),outgoing:(db.gameInvitations||[]).filter(i=>i.inviterPersonId===ctx.session.personId).map(decorate)};
  },
  respondInvite(ctx,_component,params){
   expireInvitations(ctx);
   const spec=params?.[0]||{},db=ctx.core.db,id=exprOf(ctx,spec.invitationId,{}),accept=!!exprOf(ctx,spec.accept,{}),inv=(db.gameInvitations||[]).find(i=>i.id===id);
   if(!inv)return{ok:false,status:404,message:'Einladung nicht gefunden.'};
   if(inv.invitedPersonId!==ctx.session.personId)return{ok:false,status:403,message:'Diese Einladung gehört zu einer anderen Person.'};
   if(inv.status==='expired')return{ok:false,status:410,message:'Die Einladung ist nicht mehr gültig.'};
   if(inv.status!=='pending')return{ok:false,status:409,message:'Die Einladung wurde bereits bearbeitet.'};
   const p=db.parties.find(x=>x.id===inv.sessionId),now=Date.now();
   if(Number(inv.expiresAt)<=now||!p||p.status!=='open'){
    ctx.commit(ctx.session,'party-invite-expire',inv.roomId,next=>{next.gameInvitations.find(x=>x.id===id).status='expired';const a=next.temporaryRoomAccess.find(x=>x.invitationId===id);if(a)a.active=false;});
    return{ok:false,status:410,message:'Die Einladung ist nicht mehr gültig.'};
   }
   if(!accept){ctx.commit(ctx.session,'party-invite-decline',p.areaId,next=>{next.gameInvitations.find(x=>x.id===id).status='declined';const a=next.temporaryRoomAccess.find(x=>x.invitationId===id);if(a)a.active=false;next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:p.hostId,type:'game-invitation-declined',invitationId:id,read:false,createdAt:new Date().toISOString()});const party=next.parties.find(x=>x.id===p.id);if(party.oneClick&&!next.gameInvitations.some(i=>i.sessionId===p.id&&i.status==='pending')){party.status='ended';party.endedAt=new Date().toISOString();}});if(p.oneClick&&db.parties.find(x=>x.id===p.id)?.status==='ended'){const sessionIds=p.members.filter(m=>!m.leftAt).map(m=>m.playSessionId);removeLaunchesFor(ctx,sessionIds);for(const m of p.members.filter(m=>!m.leftAt))ctx.play.api({personId:m.personId},'end',{playSessionId:m.playSessionId});}return{ok:true,status:'declined',message:'Einladung abgelehnt.'};}
   const game=db.games.find(g=>g.id===p.gameId),count=p.members.filter(m=>!m.leftAt).length,max=game?.multiplayer?.maxPlayers;
   if(max&&count>=max)return{ok:false,status:409,message:'Die Partie ist inzwischen voll.'};
   const started=ensurePartySession(ctx,p.gameId,p.areaId);if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
   // Wer eine Spieleinladung annimmt, agiert als Spieler: aktive Rolle der
   // Konto-Sitzung auf 'player' setzen (Haus der Partie), falls vorhanden.
   const partyHouse=houseOf(db,p.areaId);
   const playerRole=(ctx.session.accountRoles||[]).find(r=>r.role==='player'&&r.areaId===partyHouse?.id)
    ||(ctx.session.accountRoles||[]).find(r=>r.role==='player');
   if(playerRole)ctx.session.activeRole=playerRole;
   ctx.commit(ctx.session,'party-invite-accept',p.areaId,next=>{const np=next.parties.find(x=>x.id===p.id);np.members.push({personId:ctx.session.personId,playSessionId:started.data.playSessionId,joinedAt:new Date().toISOString(),invitationId:id});next.gameInvitations.find(x=>x.id===id).status='accepted';const access=next.temporaryRoomAccess.find(x=>x.invitationId===id);if(access)access.expiresAt=Date.now()+60*60*1000;if(np.oneClick&&np.members.filter(m=>!m.leftAt).length>=(game.multiplayer?.minPlayers||2)){np.status='playing';np.startedAt=new Date().toISOString();const hostSession=next.playSessions.find(s=>s.id===np.members.find(m=>m.personId===np.hostId)?.playSessionId);if(hostSession)hostSession.lastHeartbeatAt=new Date().toISOString();}next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:p.hostId,type:'game-invitation-accepted',invitationId:id,read:false,createdAt:new Date().toISOString()});});
   const key=crypto.randomBytes(24).toString('hex');ctx.launches.set(key,{token:ctx.body.token,gameId:p.gameId,areaId:p.areaId,playSessionId:started.data.playSessionId,partyId:p.id});
   return{ok:true,status:'accepted',partyId:p.id,launch:'/play/'+key,message:'Einladung angenommen. Die Partie wird geöffnet.'};
  },
  withdrawInvite(ctx,_component,params){
   const id=exprOf(ctx,params?.[0],{}),db=ctx.core.db,inv=(db.gameInvitations||[]).find(i=>i.id===id),p=inv&&db.parties.find(x=>x.id===inv.sessionId);
   if(!inv||!p)return{ok:false,status:404,message:'Einladung oder Partie nicht gefunden.'};
   if(inv.invitedPersonId!==ctx.session.personId)return{ok:false,status:403,message:'Diese Einladung gehört zu einer anderen Person.'};
   if(inv.status!=='accepted'||p.status!=='open')return{ok:false,status:409,message:'Der Beitritt kann jetzt nicht mehr zurückgezogen werden.'};
   const member=p.members.find(m=>m.personId===ctx.session.personId&&!m.leftAt);
   ctx.commit(ctx.session,'party-invite-withdraw',p.areaId,next=>{next.gameInvitations.find(x=>x.id===id).status='withdrawn';const a=next.temporaryRoomAccess.find(x=>x.invitationId===id);if(a)a.active=false;const m=next.parties.find(x=>x.id===p.id).members.find(x=>x.personId===ctx.session.personId&&!x.leftAt);if(m)m.leftAt=new Date().toISOString();next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:p.hostId,type:'game-invitation-withdrawn',invitationId:id,read:false,createdAt:new Date().toISOString()});});
   if(member?.playSessionId){removeLaunchesFor(ctx,[member.playSessionId]);ctx.play.api(ctx.session,'end',{playSessionId:member.playSessionId});}
   return{ok:true,message:'Teilnahme zurückgezogen. Der Gastgeber wurde informiert.'};
  },
  cancelInvite(ctx,_component,params){
   const id=exprOf(ctx,params?.[0],{}),db=ctx.core.db,inv=(db.gameInvitations||[]).find(i=>i.id===id),p=inv&&db.parties.find(x=>x.id===inv.sessionId);
   if(!inv||!p)return{ok:false,status:404,message:'Einladung oder Partie nicht gefunden.'};
   if(p.hostId!==ctx.session.personId)return{ok:false,status:403,message:'Nur der Gastgeber kann diese Einladung zurücknehmen.'};
   if(!['pending','accepted'].includes(inv.status)||p.status!=='open')return{ok:false,status:409,message:'Diese Einladung kann nicht mehr zurückgenommen werden.'};
   const member=p.members.find(m=>m.personId===inv.invitedPersonId&&!m.leftAt);
   ctx.commit(ctx.session,'party-invite-cancel',p.areaId,next=>{next.gameInvitations.find(x=>x.id===id).status='cancelled';const a=next.temporaryRoomAccess.find(x=>x.invitationId===id);if(a)a.active=false;const m=next.parties.find(x=>x.id===p.id).members.find(x=>x.personId===inv.invitedPersonId&&!x.leftAt);if(m)m.leftAt=new Date().toISOString();next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:inv.invitedPersonId,type:'game-invitation-cancelled',invitationId:id,read:false,createdAt:new Date().toISOString()});});
   if(member?.playSessionId){removeLaunchesFor(ctx,[member.playSessionId]);ctx.play.api({personId:inv.invitedPersonId},'end',{playSessionId:member.playSessionId});}
   return{ok:true,message:'Einladung zurückgenommen.'};
  },
  notifications(ctx){expireInvitations(ctx);const db=ctx.core.db;return{ok:true,items:(db.notifications||[]).filter(n=>n.recipientPersonId===ctx.session.personId).sort((a,b)=>String(b.createdAt).localeCompare(String(a.createdAt))).map(n=>({id:n.id,type:n.type,read:!!n.read,invitationId:n.invitationId||'',createdAt:n.createdAt}))};},
  markNotification(ctx,_component,params){const id=exprOf(ctx,params?.[0],{}),n=(ctx.core.db.notifications||[]).find(x=>x.id===id&&x.recipientPersonId===ctx.session.personId);if(!n)return{ok:false,status:404,message:'Hinweis nicht gefunden.'};ctx.commit(ctx.session,'notification-read','root',next=>{next.notifications.find(x=>x.id===id).read=true;});return{ok:true};},
  // --- Erziehungsberechtigte: Mehrspieler-Spiel für Kind starten (E07) ---
  startGameForChild(ctx,_component,params){
   const spec=exprOf(ctx,params?.[0],{})||{},db=ctx.core.db,session=ctx.session;
   const childId=exprOf(ctx,spec.childId,{}),gameId=exprOf(ctx,spec.gameId,{}),areaId=exprOf(ctx,spec.areaId,{}),personId=exprOf(ctx,spec.personId,{});
   if(!ctx.core.can(session,'viewChild',{childId}))return{ok:false,status:403,message:'Nur eigene, bestätigt zugeordnete Kinder.'};
   const game=db.games.find(g=>g.id===gameId);
   if(!game||game.status!=='published'||!ctx.core.can({...session,personId:childId},'play',{game,areaId}))return{ok:false,status:403,message:'Spiel oder Raum für das Kind nicht freigegeben.'};
   const house=houseOf(db,areaId);
   // Kind-Sitzung starten (Zeitbudget greift auf das Kind).
   const childSession={personId:childId,assurance:'profile'};
   const started=ctx.play.api(childSession,'start',{gameId,areaId});
   if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
   // Launch-Grant braucht eine Sitzung des Kindes — der Start lief über ein
   // session-Objekt ohne Token, also hier eine Profil-Sitzung ausstellen.
   const childToken=ctx.core.issueSession(childId,'profile');
   if(!childToken)return{ok:false,status:403,message:'Kind ist nicht aktiv.'};
   const now=Date.now();
   if(personId){
    // Einladungsvariante: ein weiterer Bewohner wird eingeladen.
    const invitee=db.people.find(p=>p.id===personId&&p.active);
    if(!invitee||!db.memberships.some(m=>m.personId===personId&&m.areaId===house?.id&&m.active))
     return{ok:false,status:403,message:'Nur aktive Bewohner dieses Hauses können eingeladen werden.'};
    if(db.parties.some(q=>q.status!=='ended'&&q.members.some(m=>m.personId===personId&&!m.leftAt)))
     return{ok:false,status:409,message:'Diese Person ist bereits in einer Partie.'};
    const partyId='party-'+crypto.randomUUID(),invitationId='invite-'+crypto.randomUUID(),expiresAt=now+5*60*1000;
    ctx.commit(session,'parent-party-start-invite',areaId,next=>{
     next.parties.push({id:partyId,gameId:game.id,gameVersion:game.version||1,file:game.file,areaId,houseId:house?.id||'',hostId:childId,status:'open',oneClick:true,members:[{personId:childId,playSessionId:started.data.playSessionId,joinedAt:new Date(now).toISOString()}],actions:[],createdAt:new Date(now).toISOString()});
     next.gameInvitations.push({id:invitationId,sessionId:partyId,inviterPersonId:session.personId,invitedPersonId:personId,roomId:areaId,status:'pending',createdAt:new Date(now).toISOString(),expiresAt});
     next.temporaryRoomAccess.push({id:'temp-room-'+crypto.randomUUID(),sessionId:partyId,invitationId,personId,roomId:areaId,active:true,createdAt:new Date(now).toISOString(),expiresAt});
     next.notifications.push({id:'notification-'+crypto.randomUUID(),recipientPersonId:personId,type:'game-invitation',invitationId,read:false,createdAt:new Date(now).toISOString()});
    });
    const key=crypto.randomBytes(24).toString('hex');
    ctx.launches.set(key,{token:childToken,gameId,areaId,playSessionId:started.data.playSessionId,partyId});
    return{ok:true,partyId,invitationId,launch:'/play/'+key,message:invitee.name+' wurde eingeladen — Spiel wird für '+db.people.find(p=>p.id===childId)?.name+' geöffnet.'};
   }
   // Solospiel direkt starten (keine Partie, aber Launch für die Elternansicht).
   const key=crypto.randomBytes(24).toString('hex');
   ctx.launches.set(key,{token:childToken,gameId,areaId,playSessionId:started.data.playSessionId});
   return{ok:true,launch:'/play/'+key,message:'Spiel wird für '+db.people.find(p=>p.id===childId)?.name+' geöffnet.'};
  },
  // Offene Partien eines Raums (Raumzugehörigkeit prüft der Task).
  partyList(ctx,_component,params){
   const db=ctx.core.db,areaId=exprOf(ctx,params?.[0],{});
   const items=db.parties.filter(p=>p.areaId===areaId&&p.status==='open')
    .map(p=>({id:p.id,gameId:p.gameId,bereich:db.areas.find(a=>a.id===p.areaId)?.name,spiel:db.games.find(g=>g.id===p.gameId)?.title,
     platz:p.members.filter(m=>!m.leftAt).length+'/'+(db.games.find(g=>g.id===p.gameId)?.multiplayer?.maxPlayers||'∞'),
     gastgeber:db.people.find(x=>x.id===p.hostId)?.name}));
   return{ok:true,items,message:items.length?'Offene Partien':'Keine offene Partie — starte eine!'};
  },
  load(ctx,_component,params){
   const p=ctx.core.db.parties.find(x=>x.id===exprOf(ctx,params?.[0],{}));
   return{ok:true,found:!!p,item:p||null};
  },
  // Aktives Mitglied? (leftAt nicht gesetzt)
  isMember(ctx,_component,params){
   const spec=params?.[0]||{},scope={},p=ctx.core.db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const personId=exprOf(ctx,spec.personId,scope)??ctx.session.personId;
   return{ok:true,member:!!(p&&p.members.some(m=>m.personId===personId&&!m.leftAt))};
  },
  // Platzbelegung + Mindest-/Höchstzahl aus dem Spiel.
  seats(ctx,_component,params){
   const db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,params?.[0],{})),game=p&&db.games.find(g=>g.id===p.gameId);
   return{ok:true,count:p?p.members.filter(m=>!m.leftAt).length:0,min:game?.multiplayer?.minPlayers||2,max:game?.multiplayer?.maxPlayers||null};
  },
  // Beitritt/Erstellen startet (oder nutzt) die eigene Spielsitzung über ctx.play.
  create(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db;
   const gameId=exprOf(ctx,spec.gameId,scope),areaId=exprOf(ctx,spec.areaId,scope);
   const game=db.games.find(g=>g.id===gameId);
   const started=ensurePartySession(ctx,game.id,areaId);
   if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
   const id='party-'+crypto.randomUUID();
   ctx.commit(ctx.session,'party-create',areaId,next=>{
    next.parties.push({id,gameId:game.id,gameVersion:game.version||1,file:game.file,areaId,
     houseId:db.areas.find(a=>a.id===db.areas.find(r=>r.id===areaId)?.parentId)?.id,
     hostId:ctx.session.personId,status:'open',
     members:[{personId:ctx.session.personId,playSessionId:started.data.playSessionId,joinedAt:new Date().toISOString()}],
     actions:[],createdAt:new Date().toISOString()});
   });
   return{ok:true,partyId:id};
  },
  join(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const started=ensurePartySession(ctx,p.gameId,p.areaId);
   if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
   ctx.commit(ctx.session,'party-join',p.areaId,next=>{
    next.parties.find(x=>x.id===p.id).members.push({personId:ctx.session.personId,playSessionId:started.data.playSessionId,joinedAt:new Date().toISOString()});
   });
   return{ok:true,message:'Beigetreten: '+(db.people.find(x=>x.id===p.hostId)?.name||'Partie')};
  },
  leave(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const me=p.members.find(m=>m.personId===ctx.session.personId&&!m.leftAt);
   ctx.commit(ctx.session,'party-leave',p.areaId,next=>{
    const np=next.parties.find(x=>x.id===p.id);
    np.members.find(m=>m.personId===ctx.session.personId&&!m.leftAt).leftAt=new Date().toISOString();
    if(me.invitationId){const access=next.temporaryRoomAccess.find(a=>a.invitationId===me.invitationId);if(access)access.active=false;}
    if(!np.members.some(m=>!m.leftAt)){np.status='ended';np.endedAt=new Date().toISOString();}
   });
   if(me.playSessionId){removeLaunchesFor(ctx,[me.playSessionId]);ctx.play.api(ctx.session,'end',{playSessionId:me.playSessionId});}
   return{ok:true};
  },
  // Polling-Stand: flache Ableitungen für deklarative Clients, Delta ab 'since'.
  state(ctx,_component,params){
   expireInvitations(ctx);
   const spec=params?.[0]||{},scope={},db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const since=Number(exprOf(ctx,spec.since,scope))||0;
   const members=p.members.filter(m=>!m.leftAt).map(m=>{
    const s=db.playSessions.find(x=>x.id===m.playSessionId);
    return{personId:m.personId,name:db.people.find(x=>x.id===m.personId)?.name||m.personId,
     connected:!!(s&&['active','paused'].includes(s.status)&&Date.now()-new Date(s.lastHeartbeatAt).getTime()<=disconnectMs()),
     host:m.personId===p.hostId};
   });
   const nameOf=id=>db.people.find(x=>x.id===id)?.name||id;
   const departed=p.members.filter(m=>m.leftAt).map(m=>m.personId);
   const invitation=p.oneClick&&ctx.session.personId===p.hostId?db.gameInvitations.find(i=>i.sessionId===p.id):null;
   return{ok:true,status:p.status,ended:p.status==='ended',members,memberCount:members.length,memberNames:members.map(m=>m.name).join(', '),
    connectedNames:members.filter(m=>m.connected).map(m=>m.name),disconnectedNames:members.filter(m=>!m.connected).map(m=>m.name),
    departedNames:departed.map(nameOf),
    invitationStatus:invitation?.status||'',inviteeName:invitation?db.people.find(x=>x.id===invitation.invitedPersonId)?.name||'':'' ,
    youAreHost:ctx.session.personId===p.hostId,actions:p.actions.filter(a=>a.seq>since),
    lastSeq:p.actions.length?p.actions[p.actions.length-1].seq:0};
  },
  action(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const payload=exprOf(ctx,spec.payload,scope),last=p.actions[p.actions.length-1];
   // Protokoll-Idempotenz: Eine neue Aufgabe darf die noch unbeantwortete
   // letzte Aufgabe nicht ersetzen — Reloads/parallele Polls liefern dann
   // dieselbe seq statt einer zweiten Aufgabe.
   if(payload?.zug==='aufgabe'&&last?.payload?.zug==='aufgabe')return{ok:true,seq:last.seq,deduplicated:true};
   ctx.commit(ctx.session,'party-action',p.areaId,next=>{
    const np=next.parties.find(x=>x.id===p.id);
    np.actions.push({seq:(np.actions[np.actions.length-1]?.seq||0)+1,by:ctx.session.personId,payload,at:new Date().toISOString()});
   },{audit:false});
   return{ok:true,seq:db.parties.find(x=>x.id===p.id).actions.length};
  },
  begin(ctx,_component,params){
   const db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,params?.[0],{}));
   ctx.commit(ctx.session,'party-begin',p.areaId,next=>{
    Object.assign(next.parties.find(x=>x.id===p.id),{status:'playing',startedAt:new Date().toISOString()});
   });
   return{ok:true};
  },
  // Host beendet die Partie — alle Mitglieds-Sitzungen enden über ctx.play.
  end(ctx,_component,params){
   const db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,params?.[0],{}));
   ctx.commit(ctx.session,'party-end',p.areaId,next=>{
    Object.assign(next.parties.find(x=>x.id===p.id),{status:'ended',endedAt:new Date().toISOString()});
    for(const a of next.temporaryRoomAccess.filter(a=>a.sessionId===p.id))a.active=false;
   });
   const sessionIds=db.parties.find(x=>x.id===p.id).members.filter(m=>!m.leftAt).map(m=>m.playSessionId);
   removeLaunchesFor(ctx,sessionIds);
   for(const m of db.parties.find(x=>x.id===p.id).members.filter(m=>!m.leftAt))
    ctx.play.api({personId:m.personId},'end',{playSessionId:m.playSessionId});
   return{ok:true};
  }
 },
 // --- Karteikästen (Leitner): der Kasten ist implizit — ein Kind besitzt
 // genau die Menge seiner flashcards (childId). box 1..5 = Lernfächer,
 // box 6 = Ablage "gelernt" (aus der Ziehung ausgeschlossen, löschbar). ------
 TServerCards:{
  dto(ctx,_component,params){
   const c=params?.[0]||{},db=ctx.core.db,by=db.people.find(p=>p.id===c.createdBy);
   return{id:c.id,childId:c.childId,subject:c.subject,topic:c.topic,question:c.question,answers:c.answers,answerFormat:c.answerFormat,box:c.box,boxLabel:c.box===6?'✔ gelernt':'Fach '+c.box,createdBy:c.createdBy,createdByName:by?.name||'',createdAt:c.createdAt,updatedAt:c.updatedAt,lastReviewedAt:c.lastReviewedAt,active:c.active};
  },
  // Gefilterte Liste + dynamische Fach-/Themenvorschläge aus dem Kasten.
  list(ctx,component,params){
   const spec=params?.[0]||{},db=ctx.core.db,s=ctx.session;
   const childId=exprOf(ctx,spec.childId,{})||s.personId;
   if(!ctx.core.can(s,'viewCards',{childId}))return{ok:false,status:403,message:'Kein Zugriff auf diesen Karteikasten.'};
   const subject=String(exprOf(ctx,spec.subject,{})??'').trim(),topic=String(exprOf(ctx,spec.topic,{})??'').trim(),box=Number(exprOf(ctx,spec.box,{})||0);
   const own=db.flashcards.filter(c=>c.childId===childId&&c.active);
   const items=own
    .filter(c=>box?c.box===box:c.box<=5)
    .filter(c=>!subject||c.subject===subject)
    .filter(c=>!topic||c.topic===topic)
    .map(c=>({...cardDto(db,c),editable:c.createdBy===s.personId||c.box===6||ctx.core.can(s,'viewChild',{childId})}));
   const subjects=[...new Set(own.map(c=>c.subject).filter(Boolean))].sort();
   const topics=[...new Set(own.map(c=>c.topic).filter(Boolean))].sort();
   const childName=db.people.find(p=>p.id===childId)?.name||'';
   return{ok:true,items,subjects,topics,subjectsText:subjects.join(', '),shown:items.length,total:own.length,childName,message:items.length?items.length+' Karten':'Noch keine Karten gefunden.'};
  },
  // Einzelne Karte für die Bearbeitungs-Stage — gleiche Regeln wie save():
  // Kind nur selbst angelegte Karten, Eltern alle Karten zugeordneter Kinder.
  info(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,s=ctx.session;
   const card=db.flashcards.find(c=>c.id===exprOf(ctx,spec.cardId,{})&&c.active!==false);
   if(!card||!card.childId)return{ok:false,status:404,message:'Karte nicht gefunden.'};
   if(!ctx.core.can(s,'manageCards',{childId:card.childId}))return{ok:false,status:403,message:'Kein Zugriff auf diesen Karteikasten.'};
   const editable=card.createdBy===s.personId||card.box===6||ctx.core.can(s,'viewChild',{childId:card.childId});
   if(!editable)return{ok:false,status:403,message:'Nur selbst angelegte Karten können geändert werden.'};
   return{ok:true,card:{...cardDto(db,card),answersText:(card.answers||[]).join('; ')}};
  },
  // Anlegen oder Aktualisieren. Kind: nur eigener Kasten + selbst angelegte
  // Karten; Eltern: alle Karten zugeordneter Kinder. Inhaltsänderung an
  // question/answers setzt den Lernstand zurück auf Fach 1.
  save(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,s=ctx.session;
   const childId=exprOf(ctx,spec.childId,{})||s.personId,cardId=exprOf(ctx,spec.cardId,{});
   if(!ctx.core.can(s,'manageCards',{childId}))return{ok:false,status:403,message:'Kein Zugriff auf diesen Karteikasten.'};
   const norm=v=>String(v??'').trim();
   const question=norm(exprOf(ctx,spec.question,{})),subject=norm(exprOf(ctx,spec.subject,{})),topic=norm(exprOf(ctx,spec.topic,{}));
   const answersRaw=exprOf(ctx,spec.answers,{});
   const answers=(Array.isArray(answersRaw)?answersRaw:String(answersRaw||'').split(/\r?\n|;|\|/)).map(a=>norm(a)).filter(Boolean);
   const answerFormat=['text','self'].includes(exprOf(ctx,spec.answerFormat,{}))?exprOf(ctx,spec.answerFormat,{}):'text';
   if(!question||!subject)return{ok:false,status:400,message:'Frage und Schulfach sind Pflicht.'};
   if(answerFormat==='text'&&!answers.length)return{ok:false,status:400,message:'Mindestens eine akzeptierte Antwort angeben.'};
   if(cardId){
    const card=db.flashcards.find(c=>c.id===cardId&&c.childId===childId&&c.active);
    if(!card)return{ok:false,status:404,message:'Karte nicht gefunden.'};
    const isParent=ctx.core.can(s,'viewChild',{childId});
    if(!isParent&&card.createdBy!==s.personId)return{ok:false,status:403,message:'Nur selbst angelegte Karten können geändert werden.'};
    const contentChanged=card.question!==question||JSON.stringify(card.answers)!==JSON.stringify(answers)||card.answerFormat!==answerFormat;
    ctx.commit(s,'card-update',childId,next=>{
     const c=next.flashcards.find(x=>x.id===cardId);
     c.question=question;c.subject=subject;c.topic=topic;c.answers=answers;c.answerFormat=answerFormat;
     if(contentChanged)c.box=1;
     c.updatedAt=new Date().toISOString();
    });
    return{ok:true,cardId,message:contentChanged?'Karte gespeichert — Lernstand zurück auf Fach 1.':'Karte gespeichert.'};
   }
   const cardId2='card-'+crypto.randomUUID(),now=new Date().toISOString();
   ctx.commit(s,'card-create',childId,next=>{
    next.flashcards.push({id:cardId2,childId,subject,topic,question,answers,answerFormat,box:1,status:'active',createdBy:s.personId,createdAt:now,updatedAt:now,lastReviewedAt:null,active:true});
   });
   return{ok:true,cardId:cardId2,message:'Karte angelegt (Fach 1).'};
  },
  // Löschen: Eltern alle; Kind nur eigene Karten — außer Fach 6 (gelernt),
  // dort dürfen auch Kinder fremd angelegte Karten entfernen.
  remove(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,s=ctx.session;
   const childId=exprOf(ctx,spec.childId,{})||s.personId,cardId=exprOf(ctx,spec.cardId,{});
   if(!ctx.core.can(s,'manageCards',{childId}))return{ok:false,status:403,message:'Kein Zugriff auf diesen Karteikasten.'};
   const card=db.flashcards.find(c=>c.id===cardId&&c.childId===childId);
   if(!card||!card.active)return{ok:false,status:404,message:'Karte nicht gefunden.'};
   const isParent=ctx.core.can(s,'viewChild',{childId});
   if(!isParent&&card.createdBy!==s.personId&&card.box!==6)return{ok:false,status:403,message:'Nur selbst angelegte Karten können gelöscht werden.'};
   ctx.commit(s,'card-delete',childId,next=>{const c=next.flashcards.find(x=>x.id===cardId);if(c)c.active=false;});
   return{ok:true,message:'Karte gelöscht.'};
  },
  // Leitner-Übergang. Nur der Kastenbesitzer selbst bewertet (Lernstand).
  answer(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,s=ctx.session;
   const cardId=exprOf(ctx,spec.cardId,{}),correct=!!exprOf(ctx,spec.correct,{});
   const card=db.flashcards.find(c=>c.id===cardId&&c.active);
   if(!card)return{ok:false,status:404,message:'Karte nicht gefunden.'};
   if(card.childId!==s.personId)return{ok:false,status:403,message:'Nur der Kastenbesitzer bewertet Karten.'};
   ctx.commit(s,'card-answer',card.childId,next=>{
    const c=next.flashcards.find(x=>x.id===cardId);
    c.box=correct?Math.min(c.box+1,6):1;
    let reviewedAt=Date.now();
    for(const other of next.flashcards)if(other.childId===c.childId&&other.active&&other.box===c.box){const time=Date.parse(other.lastReviewedAt||other.createdAt);if(Number.isFinite(time))reviewedAt=Math.max(reviewedAt,time+1);}
    c.lastReviewedAt=new Date(reviewedAt).toISOString();
   });
   const cur=db.flashcards.find(x=>x.id===cardId);
   return{ok:true,box:cur.box,mastered:cur.box===6,message:cur.box===6?'Gelernt — Karte wandert in die Ablage.':correct?'Richtig — Fach '+cur.box:'Falsch — zurück auf Fach 1'};
  },
  // Technisches Primitive: Kandidatenliste aus dem Kasten (nur Fach 1–5
  // ziehbar; Fach 6 = Ablage). Die eigentliche Ziehregel („welches Fach,
  // welche Reihenfolge") liegt deklarativ im Endpoint-Task.
  // spec: subject, topic, boxMin/boxMax, formats[], excludeIds[]
  filter(ctx,_component,params){
   const spec=params?.[0]||{},db=ctx.core.db,s=ctx.session;
   const childId=exprOf(ctx,spec.childId,{})||s.personId;
   if(!ctx.core.can(s,'viewCards',{childId}))return{ok:false,status:403,message:'Kein Zugriff auf diesen Karteikasten.'};
   const subject=String(exprOf(ctx,spec.subject,{})??'').trim(),topic=String(exprOf(ctx,spec.topic,{})??'').trim();
   const boxMin=Math.max(1,Number(exprOf(ctx,spec.boxMin,{}))||1),boxMax=Math.min(5,Number(exprOf(ctx,spec.boxMax,{}))||5);
   const fmtRaw=exprOf(ctx,spec.formats,{}),formats=(Array.isArray(fmtRaw)?fmtRaw:String(fmtRaw||'').split(/[;,]/)).map(f=>String(f).trim()).filter(Boolean);
   const exRaw=exprOf(ctx,spec.excludeIds,{}),exclude=new Set((Array.isArray(exRaw)?exRaw:String(exRaw||'').split(/[;,]/)).map(f=>String(f).trim()).filter(Boolean));
   const pool=db.flashcards.filter(c=>c.childId===childId&&c.active&&c.box>=boxMin&&c.box<=boxMax
    &&(!subject||c.subject===subject)&&(!topic||c.topic===topic)
    &&(!formats.length||formats.includes(c.answerFormat))&&!exclude.has(c.id));
   return{ok:true,items:pool.map(c=>cardDto(db,c)),available:pool.length};
  },
  // Technisches Primitive: wählt eine Karte aus einer übergebenen Liste.
  // modes: 'oldest'  → je Fach älteste zuerst (lastReviewedAt||createdAt,
  //                    innerhalb eines Fachs; Fächer aufsteigend)
  //        'random'  → zufällig, 'first' → erste der Liste.
  pick(ctx,_component,params){
   const db=ctx.core.db,itemsRaw=exprOf(ctx,params?.[0],{}),mode=String(exprOf(ctx,params?.[1],{})||'oldest');
   const items=(Array.isArray(itemsRaw)?itemsRaw:[]);
   if(!items.length)return{ok:true,empty:true,message:'Keine passende Karte.'};
   let card;
   if(mode==='random')card=items[Math.floor(Math.random()*items.length)];
   else if(mode==='first')card=items[0];
   else card=[...items].sort((a,b)=>(a.box-b.box)||String(a.lastReviewedAt||a.createdAt).localeCompare(String(b.lastReviewedAt||b.createdAt)))[0];
   return{ok:true,card};
  }
 },
 // --- Uploads: TServerUpload trägt kind/maxBytes/Meldungen; der Transport
 // (Streaming, Metadaten-Header, Bild-Codec) liegt in cms-server.cjs. ---------
 TServerUpload:{
  // Verarbeitet ctx.upload={bytes,meta,png?,error?}: Limit + Format + Inhalt
  // fachlich prüfen, Datei schreiben, Zuordnung committen.
  process(ctx,component){
   const up=ctx.upload||{},bytes=up.bytes||Buffer.alloc(0);
   if(bytes.length>component.maxBytes)return{ok:false,status:413,message:'Datei ist zu groß.'};
   // Fremd-Avatar: personId aus den Upload-Metadaten (wie gameId beim
   // Spiel-Upload). Ohne personId bleibt es beim eigenen Profilbild.
   // Berechtigung wird VOR Datei-Schreiben und Commit erzwungen.
   let targetPerson=null;
   if(component.kind==='avatar'){
    const pid=typeof up.meta?.personId==='string'?up.meta.personId:'';
    if(pid&&pid!==ctx.session?.personId){
     targetPerson=ctx.core.db.people.find(p=>p.id===pid&&p.active);
     if(!targetPerson)return{ok:false,status:404,message:'Die Person ist nicht mehr verfügbar.'};
     if(!canAssignAvatar(ctx.core.db,ctx.session,targetPerson))return{ok:false,status:403,message:'Keine Berechtigung für diese Person.'};
     ctx.emit('Fremd-Avatar angefordert',{ownerId:ctx.session?.personId,targetId:targetPerson.id});
    }
   }
   let content,filename,record,targetGame,description='',bundle=null,oldFile='',multiplayer=null,modes=null;
   try{
    if(component.kind==='game'){
     const meta=up.meta||{},title=typeof meta.title==='string'?meta.title.trim():'';
     description=meta.description||'';
     if(!title||title.length>60||/[<>\x00-\x1f]/.test(title)||typeof description!=='string'||description.length>500)throw Error('Titel (1–60 Zeichen) und Beschreibung (max. 500 Zeichen) prüfen.');
     if(meta.gameId){
      targetGame=(ctx.core.db.games||[]).find(g=>g.id===meta.gameId&&g.ownerId===ctx.session.personId);
      // Ersetzen (neue Version): eigenes Spiel in jedem Status — die alte
      // Datei wird erst nach erfolgreicher Prüfung/Abfrage entfernt.
      if(meta.replace==='true'){if(!targetGame)throw Error('Das ausgewählte Spiel ist nicht mehr verfügbar.');oldFile=targetGame.file||'';}
      else if(!targetGame||targetGame.status!=='draft'||targetGame.file)throw Error('Der ausgewählte Spielentwurf ist nicht mehr verfügbar.');
      if(targetGame.title!==title)throw Error('Der Spieletitel stimmt nicht mit dem ausgewählten Spiel überein.');
     }else{
      record={id:'game-'+crypto.randomUUID(),title,description,avatar:'🎮',ownerId:ctx.session.personId,status:'draft',storage:'upload',file:'',version:1};
     }
     // ZIP-Bundle (Projekt + Medien) oder Einzeldatei: bei einem GCS-Bundle
     // müssen externe Medienpfade im Archiv vorhanden sein. Fremdspiele
     // kommen als Einzel-HTML oder ZIP mit index.html (kind:'html').
     bundle=ctx.uploads.unpackGameBundle(bytes);
     const kind=bundle?bundle.kind:(/^\s*</.test(bytes.toString('utf8').slice(0,256))?'html':'json');
     const entry=bundle?bundle.entry:bytes;
     if(kind==='html'){ctx.uploads.validateHtml(entry);content=entry;}
     else{const project=ctx.uploads.validateGame(entry,bundle?bundle.media:null);content=JSON.stringify(project);multiplayer=readMultiplayer(project);modes=readModes(project);}
     filename='game-'+crypto.randomUUID()+(kind==='html'?'.html':'.json');
     if(record){record.file=filename;if(multiplayer)record.multiplayer=multiplayer;record.modes=modes;}
    }else{
     if(!sniffImage(bytes))throw Error('PNG, JPEG oder WebP erforderlich.');
     if(!up.png)throw Error(up.error||'Bild konnte nicht gelesen werden.');
     content=up.png;filename=crypto.randomUUID()+'.png';
    }
   }catch(e){ctx.emit('Dateiprüfung abgelehnt',{kind:component.kind});return{ok:false,status:400,message:component.failureMessage+' '+e.message};}
   ctx.emit('Dateiinhalt geprüft',{kind:component.kind,bytes:bytes.length,bundle:bundle?bundle.media.size:0});
   const f=path.join(ctx.uploads.directory,filename);fs.writeFileSync(f,content,{flag:'wx'});
   // Bundle-Medien unter uploads/<dateistamm>/<relpfad> — /play/<key>/<pfad>
   // löst diese Dateien später über uploads.gameMedia auf.
   const mediaDir=bundle?path.join(ctx.uploads.directory,filename.slice(0,-5)):null;
   if(bundle)for(const [rel,data]of bundle.media){const tp=path.join(mediaDir,rel);fs.mkdirSync(path.dirname(tp),{recursive:true});fs.writeFileSync(tp,data,{flag:'wx'});}
   try{ctx.uploads.commit(ctx.session,component.kind+'-upload',next=>{if(record)next.games.push(record);else if(targetGame){const row=next.games.find(g=>g.id===targetGame.id);Object.assign(row,{description,storage:'upload',file:filename,version:(targetGame.version||0)+1,status:'draft'});if(multiplayer)row.multiplayer=multiplayer;else delete row.multiplayer;row.modes=modes;}else next.people.find(p=>p.id===(targetPerson?.id||ctx.session.personId)).avatarImage='/avatars/'+filename});}
   catch(e){fs.unlinkSync(f);if(mediaDir)fs.rmSync(mediaDir,{recursive:true,force:true});throw e;}
   // Ersetzte Datei erst nach erfolgreicher Zuordnung entfernen.
   if(oldFile&&oldFile!==filename)ctx.uploads.removeGameFile(oldFile);
   const gameId=record?.id||targetGame?.id;
   ctx.emit('Datei und Zuordnung gespeichert',{kind:component.kind,ownerId:ctx.session.personId,id:gameId,targetId:targetPerson?.id});
   return{ok:true,message:component.successMessage,...(component.kind==='game'?{id:gameId,status:'draft'}:{avatarImage:'/avatars/'+filename})};
  },
  // Entfernt Upload-Datei + Bundle-Verzeichnis eines Spiels — technische
  // Seite des Löschens; die fachliche Entscheidung liegt im Task.
  remove(ctx,_component,params){return{ok:true,removed:ctx.uploads.removeGameFile(exprOf(ctx,params?.[0],{}))};}
 },
 // --- Einrichtung per Einladungslink: die Fachregeln liegen in den
 // enroll-Funktionen (Ticket, Benutzername, Passwort, Credentials-Datei). -----
 TServerEnroll:{
  enroll(ctx,component){
   const fn=ctx.enroll?.[component.kind];if(!fn)throw Error('Einrichtungsfunktion fehlt: '+component.kind);
   const r=fn(ctx.body||{});
   return r?.ok?{...r,ok:true}:{ok:false,status:400,message:r?.message||'Einrichtung fehlgeschlagen.'};
  }
 }
};

/** where-Klausel: Keys sind Felder der Kandidatenzeile, Werte werden im äußeren Scope ausgewertet
 *  ('$item' = äußeres Element, '$row' = Kandidatenzeile, '$field'/'$body'/'$vars'/'$session' wie gehabt).
 *  Spezialwerte: {under|in|not|iEquals:expr} | {has:{entity,where}} (korrelierte Existenz).
 *  Spezialkeys '_manageable'/'_activeChain': Zeilenprädikate der Sitzung.
 *  Spezialkey 'under': Zeile liegt unterhalb des Bereichs (parentId-Kette). */
function whereMatch(ctx,row,where,scope){
 scope=scope||{};
 for(const [key,val]of Object.entries(where||{})){
  if(key==='_manageable'){if(!ctx.core.can(ctx.session,'manageArea',{areaId:row.id}))return false;continue;}
  if(key==='_activeChain'){if(!areaActive(ctx.core.db,row.id))return false;continue;}
  if(key==='under'){if(!isAncestor(ctx,exprOf(ctx,val,scope),row))return false;continue;}
  if(key==='anyOf'){if(!val.some(w=>whereMatch(ctx,row,w,scope)))return false;continue;}
  if(key==='has'){ensureEntity(ctx,val.entity);if(!ctx.core.db[val.entity].some(r2=>whereMatch(ctx,r2,val.where,{...scope,row:r2})))return false;continue;}
  const actual=row[key];
  if(val&&typeof val==='object'){
   if('under'in val){if(!isAncestor(ctx,exprOf(ctx,val.under,scope),row))return false;}
   else if('in'in val){const set=exprOf(ctx,val.in,scope);if(!Array.isArray(set)||!set.includes(actual))return false;}
   else if('not'in val){if(actual===exprOf(ctx,val.not,scope))return false;}
   else if('iEquals'in val){if(String(actual).toLowerCase()!==String(exprOf(ctx,val.iEquals,scope)).toLowerCase())return false;}
   // 'has' ohne entity: eingebettetes Array-Feld (z. B. members:[{...}]).
   else if('has'in val){const h=val.has;
    if(h.entity){ensureEntity(ctx,h.entity);if(!ctx.core.db[h.entity].some(r2=>whereMatch(ctx,r2,h.where,{...scope,row:r2})))return false;}
    else if(!Array.isArray(actual)||!actual.some(el=>whereMatch(ctx,el,h.where,{...scope,row:el})))return false;}
   else if('anyOf'in val){if(!val.anyOf.some(w=>whereMatch(ctx,row,w,scope)))return false;}
   else if('truthy'in val){if(!actual)return false;}
   else if('falsy'in val){if(actual)return false;}
   // Kein bekanntes Prädikat → Objekt als Expression auswerten (first/split/at/…).
   else if(actual!==exprOf(ctx,val,scope))return false;
  }else if(actual!==exprOf(ctx,val,scope))return false;
 }
 return true;
}

/** Vorfahren-Kettencheck: liegt item unterhalb von ancestorId in areas.parentId? */
function isAncestor(ctx,ancestorId,item){
 let p=item.parentId;const seen=new Set();
 while(p&&!seen.has(p)){if(p===ancestorId)return true;seen.add(p);p=ctx.core.db.areas.find(a=>a.id===p)?.parentId;}
 return false;
}

/** Berechnet die Ausgabefelder eines Elements. '_'-Felder sind intern (Joins/Counts) und werden nicht ausgegeben. */
function projectFields(ctx,item,fields){
 const out={},scope={item,fields:out};
 for(const [key,expr]of Object.entries(fields))out[key]=exprOf(ctx,expr,scope);
 for(const key of Object.keys(out))if(key.startsWith('_'))delete out[key];
 return out;
}

/** Mini-Expression-Vocabulary für Query-/Store-Specs: alles datengetrieben, kein eval. */
function exprOf(ctx,expr,scope){
 if(expr===null||typeof expr!=='object'){
  if(typeof expr==='string'&&expr.startsWith('$'))return pathOf(expr.slice(1),scope,ctx);
  return expr;
 }
 // Arrays werden elementweise aufgelöst — wichtig, weil 'concat'/'at' auch
 // geerbte Array-Methoden treffen würden (expr.concat wäre dann eine Funktion).
 if(Array.isArray(expr))return expr.map(e=>exprOf(ctx,e,scope));
 if(Array.isArray(expr.concat))return expr.concat.map(e=>exprOf(ctx,e,scope)??'').join('');
 if('if'in expr){const[c,a,b]=expr.if;return truthy(exprOf(ctx,c,scope))?exprOf(ctx,a,scope):exprOf(ctx,b,scope);}
 if('not'in expr)return!truthy(exprOf(ctx,expr.not,scope));
 if('eq'in expr){const[a,b]=expr.eq;return exprOf(ctx,a,scope)===exprOf(ctx,b,scope);}
 if('first'in expr){for(const e of expr.first){const v=exprOf(ctx,e,scope);if(v!==undefined&&v!==null&&v!=='')return v;}return null;}
 if('size'in expr){const v=exprOf(ctx,expr.size,scope);return Array.isArray(v)?v.length:0;}
 if('split'in expr){const[v,sep]=expr.split;return String(exprOf(ctx,v,scope)??'').split(sep??':');}
 if('at'in expr){const[v,i]=expr.at;const arr=exprOf(ctx,v,scope);return Array.isArray(arr)?arr[i]:undefined;}
 if('nameOf'in expr){const p=ctx.core.db.people.find(x=>x.id===exprOf(ctx,expr.nameOf,scope));return p?.name;}
 if('union'in expr)return expr.union.flatMap(e=>{const v=exprOf(ctx,e,scope);return Array.isArray(v)?v:[v];});
 if('can'in expr){const[cap,args]=expr.can;const resolved={};for(const[k,v]of Object.entries(args||{}))resolved[k]=exprOf(ctx,v,scope);return ctx.core.can(ctx.session,cap,resolved);}
 if('set'in expr){const s=expr.set;ensureEntity(ctx,s.entity);return ctx.core.db[s.entity].filter(r=>whereMatch(ctx,r,s.where,scope)).map(r=>r[s.field]);}
 if('count'in expr){const c=expr.count;ensureEntity(ctx,c.entity);return ctx.core.db[c.entity].filter(r=>whereMatch(ctx,r,c.where,scope)).length;}
 if('distinctCount'in expr){const c=expr.distinctCount;ensureEntity(ctx,c.entity);return new Set(ctx.core.db[c.entity].filter(r=>whereMatch(ctx,r,c.where,scope)).map(r=>r[c.field])).size;}
 if('exists'in expr){const c=expr.exists;ensureEntity(ctx,c.entity);return ctx.core.db[c.entity].some(r=>whereMatch(ctx,r,c.where,scope));}
 if('countItems'in expr)return(scope.items||[]).filter(r=>whereMatch(ctx,r,expr.countItems.where,{item:r})).length;
 if('uuid'in expr)return String(expr.uuid||'')+crypto.randomUUID();
 if('now'in expr)return new Date().toISOString();
 if('areaActive'in expr)return areaActive(ctx.core.db,exprOf(ctx,expr.areaActive,scope));
 if('access'in expr)return readCredentials(ctx).some(c=>c.personId===exprOf(ctx,expr.access,scope))?'✓ Zugang':'kein Zugang';
 if('join'in expr){
  const j=expr.join,from=j.from||{},to=j.to||{};
  ensureEntity(ctx,from.entity);ensureEntity(ctx,to.entity);
  const names=ctx.core.db[from.entity].filter(r=>whereMatch(ctx,r,from.where,scope))
   .map(r=>ctx.core.db[to.entity].find(t=>t[to.toKey]===r[to.fromKey||'personId'])?.[j.field])
   .filter(Boolean);
  return names.length?names.join(j.sep??', '):(j.empty??'');
 }
 return expr;
}

function truthy(v){return v===true||v==='true'||v===1;}
function ensureEntity(ctx,entity){if(!Array.isArray(ctx.core.db[entity]))throw Error('Unbekannte Entität: '+entity);}

// Zeitkonstanten sind env-lesbar (lazy), damit Testlaeufe die Uhr verkuerzen
// koennen, ohne den Produktionspfad zu aendern. Defaults: 5min / 2min.
const heartbeatCapMs=()=>Number(process.env.CMS_HEARTBEAT_CAP_MS)||5*60000;
const disconnectMs=()=>Number(process.env.CMS_DISCONNECT_MS)||2*60000;
/** Lazy-Refresh (P3.3): aktive/pausierte Sitzung ohne Heartbeat seit >2min → 'disconnected'. */
function refreshSession(db,s){
 if(s&&(s.status==='active'||s.status==='paused')&&Date.now()-new Date(s.lastHeartbeatAt).getTime()>disconnectMs())s.status='disconnected';
 return s;
}
function todayMinutesOf(db,childId){
 return (db.playSessions||[]).filter(s=>s.childId===childId&&new Date(s.startedAt).toDateString()===new Date().toDateString()).reduce((a,s)=>a+s.minutes,0);
}
/** Effektives Tageslimit: Elternbudget, gedeckelt durch die Hausvorgabe. */
function limitForChild(db,childId,areaId){
 const budget=(db.timeBudgets||[]).find(t=>t.childId===childId);
 const house=db.areas.find(a=>a.id===db.areas.find(r=>r.id===areaId)?.parentId);
 const caps=[budget?.dailyMinutes,house?.maxDailyMinutes].filter(Number.isFinite);
 return{limit:caps.length?Math.min(...caps):null,budget,house};
}
function remainingFor(db,childId,areaId){
 const{limit}=limitForChild(db,childId,areaId);
 return limit===null?null:Math.max(0,limit-todayMinutesOf(db,childId));
}
function warnLevelOf(db,childId,s){
 const rem=remainingFor(db,childId,s.areaId);
 if(rem===null)return null;
 const warnAt=limitForChild(db,childId,s.areaId).budget?.warnAt||[5,1];
 if(s.graceUntil)return'grace';
 if(rem<=0)return'ended';
 if(rem<=warnAt[1])return'1min';
 if(rem<=warnAt[0])return'5min';
 return null;
}
/** Beitritt aus laufender Spielsitzung: vorhandene Sitzung für dasselbe Spiel im
 *  selben Raum wird wiederverwendet, sonst startet die normale Sitzungslogik. */
function ensurePartySession(ctx,gameId,areaId){
 const db=ctx.core.db;
 const live=db.playSessions.find(s=>s.childId===ctx.session.personId&&s.gameId===gameId&&s.areaId===areaId&&['active','paused'].includes(s.status));
 if(live)return{status:200,data:{ok:true,playSessionId:live.id}};
 return ctx.play.api(ctx.session,'start',{gameId,areaId});
}
/** Neueste nicht beendete Partie mit aktiver eigener Mitgliedschaft. */
function activePartyFor(ctx){
 return ctx.core.db.parties
  .filter(p=>['open','playing'].includes(p.status)&&p.members.some(m=>m.personId===ctx.session.personId&&!m.leftAt))
  .sort((a,b)=>new Date(b.startedAt||b.createdAt||0).getTime()-new Date(a.startedAt||a.createdAt||0).getTime())[0]||null;
}
/** Neueste nicht beendete Partie, in der die eigene Person Mitglied ist bzw.
 *  war — auch nach freiwilligem Austritt (leftAt), solange die Partie läuft. */
function rejoinablePartyFor(ctx){
 return ctx.core.db.parties
  .filter(p=>['open','playing'].includes(p.status)&&p.members.some(m=>m.personId===ctx.session.personId))
  .sort((a,b)=>new Date(b.startedAt||b.createdAt||0).getTime()-new Date(a.startedAt||a.createdAt||0).getTime())[0]||null;
}
/** Flache Partiebeschreibung für die deklarative Fortsetzen-Oberfläche. */
function partyResumeInfo(ctx,p){
 const db=ctx.core.db,members=p.members.filter(m=>!m.leftAt),game=db.games.find(g=>g.id===p.gameId),room=db.areas.find(a=>a.id===p.areaId);
 return{partyId:p.id,status:p.status,gameId:p.gameId,gameTitle:game?.title||'',areaId:p.areaId,roomName:room?.name||'',memberCount:members.length,memberNames:members.map(m=>db.people.find(x=>x.id===m.personId)?.name||m.personId).join(', '),youAreHost:p.hostId===ctx.session.personId,lastSeq:p.actions[p.actions.length-1]?.seq||0};
}
/** Sitzung einer Partie fortsetzen oder bei bereits beendeter Sitzung neu starten. */
function resumePartySession(ctx,p,member){
 const db=ctx.core.db,oldId=member.playSessionId;
 const own=s=>s&&s.childId===ctx.session.personId&&s.gameId===p.gameId&&s.areaId===p.areaId;
 let s=refreshSession(db,db.playSessions.find(x=>x.id===oldId));
 if(own(s)&&['paused','disconnected'].includes(s.status)){
  const resumed=ctx.play.api(ctx.session,'resume',{playSessionId:s.id});
  if(!resumed.data.ok)return{ok:false,status:resumed.status,message:resumed.data.message};
  s=refreshSession(db,db.playSessions.find(x=>x.id===s.id));
 }
 if(own(s)&&s.status==='active')return{ok:true,playSessionId:s.id};
 const started=ctx.play.api(ctx.session,'start',{gameId:p.gameId,areaId:p.areaId});
 if(!started.data.ok)return{ok:false,status:started.status,message:started.data.message};
 ctx.commit(ctx.session,'party-resume-session',p.areaId,next=>{
  const m=next.parties.find(x=>x.id===p.id)?.members.find(x=>x.personId===ctx.session.personId&&!x.leftAt);
  if(m)m.playSessionId=started.data.playSessionId;
 });
 return{ok:true,playSessionId:started.data.playSessionId};
}

/** Kind-Karte für die Elternsicht (E01/E06): Live-Status, Tagesminuten, Budget.
 *  Ohne Heartbeat seit >2min gilt eine Sitzung als getrennt (P3.3). */
function childCardOf(db,id){
 const p=db.people.find(x=>x.id===id);if(!p)return null;
 const active=(db.playSessions||[]).find(s=>s.childId===id&&['active','paused'].includes(s.status));
 if(active&&Date.now()-new Date(active.lastHeartbeatAt).getTime()>disconnectMs())active.status='disconnected';
 const today=(db.playSessions||[]).filter(s=>s.childId===id&&new Date(s.startedAt).toDateString()===new Date().toDateString()).reduce((a,s)=>a+s.minutes,0);
 const budget=(db.timeBudgets||[]).find(t=>t.childId===id);
 return{
  id,name:p.name,avatar:p.avatar,
  spiel:active?(db.games.find(g=>g.id===active.gameId)?.title||active.gameId):'—',
  status:active?active.status:'ruht',
  heute:today,budget:budget?.dailyMinutes??null,pendingApproval:!!budget?.pendingBudget,
  playing:active?{gameId:active.gameId,title:db.games.find(g=>g.id===active.gameId)?.title,status:active.status,minutes:active.minutes}:null,
  todayMinutes:today,budgetMinutes:budget?.dailyMinutes??null,pendingBudget:budget?.pendingBudget||null
 };
}
function pathOf(path,scope,ctx){
 const parts=path.split('.');
 let root=parts[0]==='item'?scope.item:parts[0]==='field'?scope.fields:parts[0]==='items'?scope.items:parts[0]==='row'?scope.row:parts[0]==='vars'?ctx.vars:parts[0]==='body'?ctx.body:parts[0]==='session'?ctx.session:scope.fields?.[parts[0]];
 for(let i=1;i<parts.length&&root!=null;i++)root=root[parts[i]];
 return root;
}

// Kartenstapel-Methoden (TServerDecks) kommen aus dem eigenen Modul —
// exprOf wird injiziert, damit kein Require-Zyklus entsteht.
Object.assign(methods,require('./cms-server-decks.cjs')({exprOf}));
// Sponsor-Komponenten (v8): Begleitungen, Vereinbarungen, Belohnungen,
// gepruefte Leistungspunkte — jeweils atomare, registrierte Fachoperationen.
const perfModule=require('./cms-performance.cjs');
const sponsorModule=require('./cms-sponsor.cjs').createSponsor(null);
Object.assign(methods,require('./cms-sponsor-components.cjs')({exprOf}));
const sponsorAdmin=require('./cms-sponsor-admin.cjs');
Object.assign(methods.TServerAccess,{
 listSponsors:sponsorAdmin.listSponsors,
 setSponsor:sponsorAdmin.setSponsor,
 inviteSponsor:sponsorAdmin.inviteSponsor,
 revokeSponsorInvite:sponsorAdmin.revokeSponsorInvite,
});
module.exports={methods};
