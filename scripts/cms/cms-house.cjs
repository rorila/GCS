const crypto=require('node:crypto');
const {within,areaActive,canonEmojiSeq,EMOJI_IDS}=require('./cms-core.cjs');
function houseApi(core,s,route,b,commit){
 const routes=['houses','house-rooms','room-create','room-update','person-create','house-people','house-children','room-admins','room-admin-set','parent-invite','guardian-approve','guardian-pending','observer-invite'];if(!routes.includes(route))return null;
 const ok=data=>({status:200,data:{ok:true,...data}}),fail=(status,message)=>({status,data:{ok:false,message}});
 const houses=core.db.areas.filter(a=>a.type==='house'&&areaActive(core.db,a.id)&&core.can(s,'manageArea',{areaId:a.id}));
 if(route==='houses')return ok({items:houses.map(h=>({id:h.id,label:h.name,name:h.name,active:true})),message:'Hausverwaltung · eigenes Haus wählen'});
 const house=houses.find(h=>h.id===b.houseId);if(!house)return fail(403,'Keine Hauszuständigkeit.');
 const rooms=core.db.areas.filter(a=>a.type==='room'&&within(core.db,a.id,house.id));
 if(route==='house-rooms')return ok({items:rooms.map(r=>({id:r.id,label:r.name+(r.active?'':' · deaktiviert'),name:r.name,active:r.active})),message:house.name+' · Räume (auch deaktivierte)'});
 const clean=(v,max=60)=>typeof v==='string'&&v.trim().length>0&&v.trim().length<=max&&!/[\x00-\x1f<>]/.test(v)?v.trim():null;
 if(route==='room-create'){
  const name=clean(b.name);if(!name)return fail(400,'Raumname: 1 bis 60 Zeichen.');if(rooms.some(r=>r.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return fail(409,'Dieser Raumname existiert im Haus bereits.');
  const id='room-'+crypto.randomUUID();commit(s,'room-create',house.id,next=>next.areas.push({id,name,type:'room',parentId:house.id,avatar:'🚪',active:true}));return ok({id,message:'Raum angelegt: '+name});
 }
 const people=core.db.people.filter(p=>p.active&&core.db.memberships.some(m=>m.personId===p.id&&rooms.some(r=>r.id===m.areaId)));
 // Erwachsene mit Bezug zum Haus (Rollen im Haus oder bestätigte Elternschaft
 // eines Haus-Kindes) — Kandidatenpool für Verwaltungsrollen. Kinder sind
 // grundsätzlich keine Verwaltungskandidaten.
 const adults=core.db.people.filter(p=>p.active&&p.kind!=='child'&&(
  core.db.roles.some(r=>r.personId===p.id&&(r.areaId===house.id||rooms.some(rr=>rr.id===r.areaId)))||
  core.db.guardians.some(g=>g.guardianId===p.id&&g.status==='confirmed'&&core.db.memberships.some(m=>m.personId===g.childId&&m.active&&rooms.some(r=>r.id===m.areaId)))));
 const adultMark=p=>core.db.roles.some(r=>r.personId===p.id&&r.areaId===house.id&&r.role==='areaAdmin'&&r.active)?' · HouseAdmin':core.db.roles.some(r=>r.personId===p.id&&r.role==='areaAdmin'&&r.active&&rooms.some(rr=>rr.id===r.areaId))?' · Erzieher':core.db.roles.some(r=>r.personId===p.id&&r.role==='observer'&&r.active&&rooms.some(rr=>rr.id===r.areaId))?' · Beobachter':core.db.guardians.some(g=>g.guardianId===p.id&&g.status==='confirmed')?' · Elternteil':'';
 if(route==='house-people')return ok({items:people.map(p=>({id:p.id,label:p.name,name:p.name,active:true})),message:house.name+' · Personen'});
 // Eltern-Aufnahme (E02): HouseAdmin schlägt Guardian-Zuordnung vor und erzeugt
 // eine Einladung. Der Elternteil bestätigt durch Einrichtung seines Zugangs.
 // Selbsteinladung bleibt bis zur Bestätigung durch einen anderen Verantwortlichen 'pending'.
 if(route==='parent-invite'){
  const name=clean(b.name),childId=typeof b.childId==='string'?b.childId:null;
  if(!name||!childId)return fail(400,'Name des Elternteils und Kind angeben.');
  const child=core.db.people.find(p=>p.id===childId&&p.active&&p.kind==='child'&&core.db.memberships.some(m=>m.personId===childId&&m.active&&rooms.some(r=>r.id===m.areaId)));
  if(!child)return fail(403,'Kind gehört nicht zu diesem Haus.');
  let personId=typeof b.personId==='string'?b.personId:null;
  if(personId&&!core.db.people.some(p=>p.id===personId&&p.active))return fail(404,'Person nicht gefunden.');
  if(!personId){personId='person-'+crypto.randomUUID();commit(s,'parent-create',house.id,next=>next.people.push({id:personId,name,avatar:'👤',kind:'adult',active:true}));}
  if(core.db.guardians.some(g=>g.childId===childId&&g.guardianId===personId&&g.status==='confirmed'))return fail(409,'Zuordnung ist bereits bestätigt.');
  const token=crypto.randomBytes(32).toString('hex'),pid=personId;
  commit(s,'parent-invite',house.id,next=>{
   let g=next.guardians.find(g=>g.childId===childId&&g.guardianId===pid);
   if(!g){g={childId,guardianId:pid,status:'pending',createdAt:new Date().toISOString(),confirmedBy:null,revokedAt:null};next.guardians.push(g);}else{g.status='pending';g.revokedAt=null;}
   next.invites=next.invites.filter(i=>!(i.purpose==='parent'&&i.personId===pid&&i.childId===childId));
   next.invites.push({id:'invite-'+crypto.randomUUID(),personId:pid,childId,houseId:house.id,purpose:'parent',issuer:s.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000});
  });
  return ok({link:'/parent-enroll?ticket='+token,message:personId===s.personId?'Selbstzuordnung vorgemerkt — Bestätigung durch einen zweiten Verantwortlichen erforderlich.':'Einladung erstellt; 24 Stunden gültig, einmal verwendbar.'});
 }
 // Zweite Bestätigung bei Selbstzuordnung (E02): der Bestätigende darf nicht
 // der Aussteller der Zuordnung sein und muss selbst Hauszuständigkeit haben.
 if(route==='guardian-approve'){
  const [cid,gid]=String(b.id||'').split(':'),childId=b.childId||cid,guardianId=b.guardianId||gid;
  const g=core.db.guardians.find(g=>g.childId===childId&&g.guardianId===guardianId&&g.status==='pending');
  if(!g)return fail(404,'Keine ausstehende Zuordnung.');
  if(!core.db.memberships.some(m=>m.personId===childId&&m.active&&rooms.some(r=>r.id===m.areaId)))return fail(403,'Kind gehört nicht zu diesem Haus.');
  if(guardianId===s.personId)return fail(409,'Eigene Zuordnung kann nicht selbst bestätigt werden.');
  commit(s,'guardian-approve',house.id,next=>{const ng=next.guardians.find(x=>x.childId===childId&&x.guardianId===guardianId);ng.status='confirmed';ng.confirmedBy=s.personId;ng.confirmedAt=new Date().toISOString();});
  return ok({message:'Eltern-Kind-Zuordnung bestätigt.'});
 }
 // Ausstehende Eltern-Zuordnungen des Hauses — Eingang für die Zweitbestätigung.
 // id ist zusammengesetzt (childId:guardianId), damit die Kartenliste beides trägt.
 if(route==='guardian-pending'){
  const childIds=new Set(core.db.memberships.filter(m=>m.active&&rooms.some(r=>r.id===m.areaId)).map(m=>m.personId));
  const items=core.db.guardians.filter(g=>g.status==='pending'&&childIds.has(g.childId)).map(g=>({id:g.childId+':'+g.guardianId,childId:g.childId,child:core.db.people.find(p=>p.id===g.childId)?.name||g.childId,guardianId:g.guardianId,guardian:core.db.people.find(p=>p.id===g.guardianId)?.name||g.guardianId,own:g.guardianId===s.personId,label:(core.db.people.find(p=>p.id===g.childId)?.name||g.childId)+' ← '+(core.db.people.find(p=>p.id===g.guardianId)?.name||g.guardianId)+(g.guardianId===s.personId?' (eigene)':''),active:false}));
  return ok({items,message:house.name+' · Ausstehende Elternzuordnungen'});
 }
 // Kinder des Hauses — Auswahlliste für die Eltern-Einladung.
 if(route==='house-children'){
  const items=people.filter(p=>p.kind==='child').map(p=>({id:p.id,label:p.avatar+'  '+p.name,name:p.name,active:true}));
  return ok({items,message:house.name+' · Kinder'});
 }
 const room=rooms.find(r=>r.id===b.areaId);if(!room)return fail(403,'Raum gehört nicht zu diesem Haus.');
 // Beobachter-Einladung (E01/E05): vergibt nach Einlösung die Observer-Rolle
 // für genau diesen Raum — aggregierte Sicht, kein Kinderbezug.
 if(route==='observer-invite'){
  const name=clean(b.name);if(!name)return fail(400,'Name der beobachtenden Person angeben.');
  let personId=typeof b.personId==='string'?b.personId:null;
  if(personId&&!core.db.people.some(p=>p.id===personId&&p.active))return fail(404,'Person nicht gefunden.');
  if(!personId){personId='person-'+crypto.randomUUID();commit(s,'observer-create',house.id,next=>next.people.push({id:personId,name,avatar:'👁',kind:'adult',active:true}));}
  if(core.db.roles.some(r=>r.personId===personId&&r.areaId===room.id&&r.role==='observer'&&r.active))return fail(409,'Beobachterrolle für diesen Raum ist bereits aktiv.');
  const token=crypto.randomBytes(32).toString('hex'),pid=personId;
  commit(s,'observer-invite',room.id,next=>{
   next.invites=next.invites.filter(i=>!(i.purpose==='observer'&&i.personId===pid&&i.areaId===room.id));
   next.invites.push({id:'invite-'+crypto.randomUUID(),personId:pid,houseId:house.id,areaId:room.id,purpose:'observer',issuer:s.personId,hash:crypto.createHash('sha256').update(token).digest('hex'),expires:Date.now()+86400000});
  });
  return ok({link:'/observer-enroll?ticket='+token,message:'Beobachter-Einladung erstellt; 24 Stunden gültig, einmal verwendbar.'});
 }
 if(route==='room-update'){
  const name=clean(b.name);if(!name||typeof b.active!=='boolean')return fail(400,'Name und aktiven Zustand angeben.');if(rooms.some(r=>r.id!==room.id&&r.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return fail(409,'Raumname bereits vergeben.');
  commit(s,'room-update',room.id,next=>Object.assign(next.areas.find(r=>r.id===room.id),{name,active:b.active}));return ok({message:'Raum gespeichert: '+name});
 }
 if(!areaActive(core.db,room.id))return fail(409,'Raum zuerst aktivieren.');
 if(route==='person-create'){
  const name=clean(b.name),avatar=clean(b.avatar,12),rawSeq=typeof b.sequenceText==='string'?b.sequenceText.split(',').map(x=>x.trim()):b.sequence,sequence=Array.isArray(rawSeq)?canonEmojiSeq(rawSeq):rawSeq;
  if(!name||!avatar||!Array.isArray(sequence)||sequence.length!==4||sequence.some(e=>!EMOJI_IDS.includes(e)))return fail(400,'Name, Avatar und vier gültige Bild-IDs angeben.');
  if(core.db.codes.some(c=>c.areaId===house.id&&JSON.stringify(canonEmojiSeq(c.sequence))===JSON.stringify(sequence)))return fail(409,'Emoji-Folge im Haus bereits vergeben.');
  const id='person-'+crypto.randomUUID();commit(s,'person-create',room.id,next=>{next.people.push({id,name,avatar,kind:'child',active:true});next.memberships.push({personId:id,areaId:room.id,active:true});next.roles.push({personId:id,areaId:room.id,role:'player',active:true});next.codes.push({personId:id,areaId:house.id,sequence});});return ok({id,message:'Spielerprofil angelegt: '+name});
 }
 if(route==='room-admins')return ok({items:adults.map(p=>({id:p.id,label:p.name+adultMark(p),name:p.name,active:core.db.roles.some(r=>r.personId===p.id&&r.areaId===room.id&&r.role==='areaAdmin'&&r.active)})),message:house.name+' / '+room.name+' · RaumAdmins'});
 if(route==='room-admin-set'){
  if(typeof b.active!=='boolean'||b.confirm!==true)return fail(400,'Admin-Zuweisung ausdrücklich bestätigen.');if(!adults.some(p=>p.id===b.personId))return fail(403,'Person ist diesem Haus nicht zugeordnet.');
  commit(s,'room-admin-set',room.id,next=>{let role=next.roles.find(r=>r.personId===b.personId&&r.areaId===room.id&&r.role==='areaAdmin');if(!role){role={personId:b.personId,areaId:room.id,role:'areaAdmin',active:false};next.roles.push(role);}role.active=b.active;});return ok({message:b.active?'RaumAdmin zugewiesen. Eigener Verwaltungszugang erforderlich.':'RaumAdmin-Zuständigkeit entzogen.'});
 }
 return fail(404,'Unbekannte Hausaktion.');
}
module.exports={houseApi};
