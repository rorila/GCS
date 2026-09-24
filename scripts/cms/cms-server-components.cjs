const crypto=require('node:crypto'),fs=require('node:fs'),path=require('node:path');
const {areaActive,canonEmojiSeq,EMOJI_IDS,childrenOf,guardiansOf,within}=require('./cms-core.cjs');
const {isSuper}=require('./cms-super.cjs');

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

const readCredentials=ctx=>{try{return fs.existsSync(ctx.credentialPath)?JSON.parse(fs.readFileSync(ctx.credentialPath,'utf8')):[];}catch(e){return[];}};

// Prozesslokale Versuchszähler für TServerAuthenticate.throttle (DoS-Schutz).
const THROTTLES=new Map();

const methods={
 TServerSession:{
  requireRole(ctx,_component,params){
   const policy=ROLES[params?.[0]];
   if(!policy)throw Error('Unbekannte Rollenrichtlinie: '+params?.[0]);
   if(!ctx.session)return{ok:false,status:401,message:'Bitte Verwaltung neu anmelden.'};
   if(!policy.check(ctx))return{ok:false,status:403,message:policy.deny};
   return{ok:true,personId:ctx.session.personId};
  },
  logout(ctx){ctx.admin?.endSession(ctx.session);return{ok:true};},
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
  // Konto-Abmeldung: Spieler-Token verwerfen + zugehörige Launch-Grants aufräumen.
  logoutAccount(ctx){
   const token=ctx.body?.token;
   ctx.core.logout(token);
   if(ctx.launches)for(const [k,l]of ctx.launches)if(l.token===token)ctx.launches.delete(k);
   return{ok:true};
  }
 },
 // --- Anmeldung (E01): Versuchslimit + Emoji-Authentifizierung ----------------
 TServerAuthenticate:{
  // Versuchslimit je Quelle (IP) und Bucket — deklarativ über limit/windowMs.
  throttle(ctx,_component,params){
   const spec=params?.[0]||{},key=String(spec.bucket||'login')+':'+String(ctx.remoteAddress||'local');
   const limit=Number(spec.limit)||20,windowMs=Number(spec.windowMs)||60000,now=Date.now();
   if(THROTTLES.size>1000)THROTTLES.clear();
   let b=THROTTLES.get(key);if(!b||now-b.time>windowMs){b={time:now,n:0};THROTTLES.set(key,b);}
   return{ok:++b.n<=limit};
  },
  // Emoji-Einwahl: Folge → Person → Spielersitzung. core.login meldet seine
  // Schritte über emit (Sequenzen werden vom Trace-Store maskiert).
  authenticate(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const found=ctx.core.login(exprOf(ctx,spec.areaId,scope),exprOf(ctx,spec.sequence,scope),(label,data)=>ctx.emit(label,data));
   return found?{ok:true,found:true,token:found.token,name:found.person?.name,avatar:found.person?.avatar}:{ok:true,found:false};
  },
  // Verwaltungseinwahl: admin.verify kapselt Versuchslimit, scrypt-Hash sowie
  // Person- und Zuständigkeitsprüfung (emit-Schritte bleiben im Trace).
  verifyAdmin(ctx){
   const checked=ctx.admin.verify(ctx.remoteAddress,ctx.body||{},(l,d)=>ctx.emit(l,d));
   return{hasSession:!!checked.session,session:checked.session||null,personId:checked.session?.personId||checked.personId||null,contexts:checked.contexts||[],super:!!checked.super,house:!!checked.house,message:checked.error||''};
  },
  // Antwortdaten der Verwaltungsanmeldung: ok + Kontext-Flags; Tokens sind
  // Transportfelder — der Server wandelt sie in HttpOnly-Cookies um.
  adminResult(ctx,_component,params){
   const spec=params?.[0]||{},tok=ctx.vars.Verwaltung?.token,acc=ctx.vars.Konto?.token,g=ctx.vars.Geprueft||{},ctxs=g.contexts||[];
   const ok=!!(tok||acc),d={ok,message:tok?spec.successMessage:acc?spec.accountMessage:(g.message||spec.failureMessage)};
   if(ok)Object.assign(d,{contexts:ctxs,admin:ctxs.includes('admin'),parent:ctxs.includes('parent'),observer:ctxs.includes('observer'),super:!!g.super,house:!!g.house});
   if(tok)d.adminToken=tok;if(acc)d.accountToken=acc;if(g.personId)d.personId=g.personId;
   return d;
  }
 },
 TServerResponse:{
  // send({feld:expr, merge:objVar}) — 'merge' breitet ein Ergebnisobjekt (z. B. Kind-Karte) in die Antwort aus.
  send(ctx,_component,params){const p=params?.[0]||{},merge=p.merge&&typeof p.merge==='object'?p.merge:{};const rest={...p};delete rest.merge;ctx.result={status:200,data:{ok:true,...merge,...rest}};},
  fail(ctx,_component,params){ctx.result={status:Number(params?.[0])||400,data:{ok:false,message:String(params?.[1]||'Anfrage abgelehnt.')}};}
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
  // Anmeldeeingabe des Emoji-Logins: areaId (≤100) + sequence (4 Strings à ≤64).
  loginInput(ctx){
   const b=ctx.body||{};
   const ok=typeof b.areaId==='string'&&b.areaId.length<=100&&Array.isArray(b.sequence)&&b.sequence.length===4&&b.sequence.every(v=>typeof v==='string'&&v.length<=64);
   return{ok};
  },
  // Emoji-Einwahlsequenz: akzeptiert sequenceText (Komma-Liste) oder sequence (Array),
  // kanonisiert und prüft gegen die erlaubten Emoji-IDs.
  emojiSeq(ctx,_component,params){
   const field=params?.[0]||'sequence';
   const raw=typeof ctx.body?.sequenceText==='string'?ctx.body.sequenceText.split(',').map(x=>x.trim()):ctx.body?.[field];
   const sequence=Array.isArray(raw)?canonEmojiSeq(raw):raw;
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
  // Emoji-Folge im Haus schon vergeben (optional: eine Person ausnehmen).
  codeTaken(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const areaId=exprOf(ctx,spec.areaId,scope),sequence=exprOf(ctx,spec.sequence,scope),exclude=exprOf(ctx,spec.excludePersonId,scope);
   const wanted=JSON.stringify(sequence);
   return ctx.core.db.codes.some(c=>c.areaId===areaId&&c.personId!==exclude&&JSON.stringify(canonEmojiSeq(c.sequence))===wanted);
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
   return{items:db.guardians.filter(g=>g.guardianId===personId&&(g.status==='confirmed'||g.status==='pending'))
    .map(g=>{const c=childCardOf(db,g.childId);return c?{...c,pendingApproval:g.status!=='confirmed'||!!c.pendingApproval,guardianStatus:g.status}:null}).filter(Boolean)};},
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
  // Bereichs-Flags der Anmeldung — steuern nur die Bereichsnavigation (keine
  // Rechte; jede Aktion wird serverseitig einzeln geprüft). Nutzt die
  // Verwaltungssitzung (ctx.adminSession) und/oder die Konto-Sitzung.
  contexts(ctx){
   const db=ctx.core.db,personId=ctx.adminSession?.personId||ctx.session?.personId;
   const person=personId&&db.people.find(p=>p.id===personId&&p.active);
   const flags={admin:false,house:false,super:false,parent:false,observer:false};
   if(person){
    const role=(r,areaId)=>db.roles.some(x=>x.personId===personId&&x.role===r&&x.areaId===areaId&&x.active&&areaActive(db,x.areaId));
    if(ctx.adminSession){flags.super=role('superAdmin','root');flags.admin=flags.super||db.roles.some(r=>r.personId===personId&&r.role==='areaAdmin'&&r.active&&areaActive(db,r.areaId));flags.house=flags.super||db.roles.some(r=>r.personId===personId&&r.role==='areaAdmin'&&r.active&&db.areas.find(a=>a.id===r.areaId)?.type==='house'&&areaActive(db,r.areaId));}
    flags.parent=!!ctx.session&&db.guardians.some(g=>g.guardianId===personId&&(g.status==='confirmed'||g.status==='pending'));
    flags.observer=!!ctx.session&&db.roles.some(r=>r.personId===personId&&r.role==='observer'&&r.active&&areaActive(db,r.areaId));
    flags.verwaltung=flags.admin||flags.house;
   }
   return{ok:true,...flags,name:person?.name||''};
  },
  // Spielerbare Räume der Sitzung (aktive Mitgliedschaft + aktive Bereichskette).
  roomsFor(ctx){
   return{items:ctx.core.rooms(ctx.session.personId).map(r=>({id:r.id,name:r.name,avatar:r.avatar||'🚪',active:r.active})),message:'🚪 Wähle deinen Raum'};
  },
  // Freigegebene Spiele eines Raums für die Sitzung (can 'play' je Spiel).
  gamesFor(ctx,_component,params){
   const areaId=exprOf(ctx,params?.[0],{});
   const items=ctx.core.db.games.filter(g=>ctx.core.can(ctx.session,'play',{game:g,areaId})).map(g=>({id:g.id,title:g.title,avatar:g.avatar}));
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
  // Domänenoperation: Spielerprofil (Person + Mitgliedschaft + Spielerrolle + Emoji-Code) in einem Commit.
  createPlayer(ctx,_component,params){
   const spec=params?.[0]||{},scope={};
   const name=exprOf(ctx,spec.name,scope),avatar=exprOf(ctx,spec.avatar,scope),sequence=exprOf(ctx,spec.sequence,scope),roomId=exprOf(ctx,spec.roomId,scope),houseId=exprOf(ctx,spec.houseId,scope);
   const id='person-'+crypto.randomUUID(),audit=spec.audit||{};
   ctx.commit(ctx.session,exprOf(ctx,audit.action,scope)||'person-create',roomId,next=>{
    next.people.push({id,name,avatar,kind:'child',active:true});
    next.memberships.push({personId:id,areaId:roomId,active:true});
    next.roles.push({personId:id,areaId:roomId,role:'player',active:true});
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
   });
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
    next.progress.push({eventId:exprOf(ctx,spec.eventId,scope),childId:ctx.session.personId,gameId:s.gameId,sessionId:s.id,
     metric:exprOf(ctx,spec.metric,scope),value:exprOf(ctx,spec.value,scope),unit:String(exprOf(ctx,spec.unit,scope)||'count'),
     reportedAt:new Date().toISOString(),source:'game',schemaVersion:Number(exprOf(ctx,spec.schemaVersion,scope))||1});
   });
   return{ok:true};
  }
 },
 // --- Hausinterner Multiplayer (P4): Partien mit Aktionslog --------------------
 // Session-Lebenszyklus geht über ctx.play (der play-Adapter) — Zeitbudget greift
 // so auch in der Gruppe.
 TServerParty:{
  // Offene Partien eines Raums (Raumzugehörigkeit prüft der Task).
  partyList(ctx,_component,params){
   const db=ctx.core.db,areaId=exprOf(ctx,params?.[0],{});
   const items=db.parties.filter(p=>p.areaId===areaId&&p.status==='open')
    .map(p=>({id:p.id,bereich:db.areas.find(a=>a.id===p.areaId)?.name,spiel:db.games.find(g=>g.id===p.gameId)?.title,
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
    if(!np.members.some(m=>!m.leftAt)){np.status='ended';np.endedAt=new Date().toISOString();}
   });
   if(me.playSessionId)ctx.play.api(ctx.session,'end',{playSessionId:me.playSessionId});
   return{ok:true};
  },
  // Polling-Stand: flache Ableitungen für deklarative Clients, Delta ab 'since'.
  state(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const since=Number(exprOf(ctx,spec.since,scope))||0;
   const members=p.members.filter(m=>!m.leftAt).map(m=>{
    const s=db.playSessions.find(x=>x.id===m.playSessionId);
    return{personId:m.personId,name:db.people.find(x=>x.id===m.personId)?.name||m.personId,
     connected:!!(s&&['active','paused'].includes(s.status)&&Date.now()-new Date(s.lastHeartbeatAt).getTime()<=disconnectMs()),
     host:m.personId===p.hostId};
   });
   return{ok:true,status:p.status,members,memberCount:members.length,memberNames:members.map(m=>m.name).join(', '),
    youAreHost:ctx.session.personId===p.hostId,actions:p.actions.filter(a=>a.seq>since),
    lastSeq:p.actions.length?p.actions[p.actions.length-1].seq:0};
  },
  action(ctx,_component,params){
   const spec=params?.[0]||{},scope={},db=ctx.core.db,p=db.parties.find(x=>x.id===exprOf(ctx,spec.partyId,scope));
   const payload=exprOf(ctx,spec.payload,scope);
   ctx.commit(ctx.session,'party-action',p.areaId,next=>{
    const np=next.parties.find(x=>x.id===p.id);
    np.actions.push({seq:(np.actions[np.actions.length-1]?.seq||0)+1,by:ctx.session.personId,payload,at:new Date().toISOString()});
   });
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
   });
   for(const m of db.parties.find(x=>x.id===p.id).members.filter(m=>!m.leftAt))
    ctx.play.api({personId:m.personId},'end',{playSessionId:m.playSessionId});
   return{ok:true};
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
   let content,filename,record;
   try{
    if(component.kind==='game'){
     const meta=up.meta||{},title=typeof meta.title==='string'?meta.title.trim():'',description=meta.description||'';
     if(!title||title.length>60||/[<>\x00-\x1f]/.test(title)||typeof description!=='string'||description.length>500)throw Error('Titel (1–60 Zeichen) und Beschreibung (max. 500 Zeichen) prüfen.');
     const project=ctx.uploads.validateGame(bytes),id='game-'+crypto.randomUUID();
     filename=id+'.json';content=JSON.stringify(project);
     record={id,title,description,avatar:'🎮',ownerId:ctx.session.personId,status:'draft',storage:'upload',file:filename};
    }else{
     if(!sniffImage(bytes))throw Error('PNG, JPEG oder WebP erforderlich.');
     if(!up.png)throw Error(up.error||'Bild konnte nicht gelesen werden.');
     content=up.png;filename=crypto.randomUUID()+'.png';
    }
   }catch(e){ctx.emit('Dateiprüfung abgelehnt',{kind:component.kind});return{ok:false,status:400,message:component.failureMessage+' '+e.message};}
   ctx.emit('Dateiinhalt geprüft',{kind:component.kind,bytes:bytes.length});
   const f=path.join(ctx.uploads.directory,filename);fs.writeFileSync(f,content,{flag:'wx'});
   try{ctx.uploads.commit(ctx.session,component.kind+'-upload',next=>{if(record)next.games.push(record);else next.people.find(p=>p.id===ctx.session.personId).avatarImage='/avatars/'+filename});}
   catch(e){fs.unlinkSync(f);throw e;}
   ctx.emit('Datei und Zuordnung gespeichert',{kind:component.kind,ownerId:ctx.session.personId,id:record?.id});
   return{ok:true,message:component.successMessage,...(record?{id:record.id,status:'draft'}:{avatarImage:'/avatars/'+filename})};
  }
 },
 // --- Einrichtung per Einladungslink: die Fachregeln liegen in den
 // enroll-Funktionen (Ticket, Benutzername, Passwort, Credentials-Datei). -----
 TServerEnroll:{
  enroll(ctx,component){
   const fn=ctx.enroll?.[component.kind];if(!fn)throw Error('Einrichtungsfunktion fehlt: '+component.kind);
   const r=fn(ctx.body||{});
   return r?.ok?{ok:true,message:r.message}:{ok:false,status:400,message:r?.message||'Einrichtung fehlgeschlagen.'};
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

module.exports={methods};
