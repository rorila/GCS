const crypto=require('node:crypto');
const {within,areaActive}=require('./cms-core.cjs');
function houseApi(core,s,route,b,commit){
 const routes=['houses','house-rooms','room-create','room-update','person-create','house-people','room-admins','room-admin-set'];if(!routes.includes(route))return null;
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
 if(route==='house-people')return ok({items:people.map(p=>({id:p.id,label:p.name,name:p.name,active:true})),message:house.name+' · Personen'});
 const room=rooms.find(r=>r.id===b.areaId);if(!room)return fail(403,'Raum gehört nicht zu diesem Haus.');
 if(route==='room-update'){
  const name=clean(b.name);if(!name||typeof b.active!=='boolean')return fail(400,'Name und aktiven Zustand angeben.');if(rooms.some(r=>r.id!==room.id&&r.name.toLocaleLowerCase()===name.toLocaleLowerCase()))return fail(409,'Raumname bereits vergeben.');
  commit(s,'room-update',room.id,next=>Object.assign(next.areas.find(r=>r.id===room.id),{name,active:b.active}));return ok({message:'Raum gespeichert: '+name});
 }
 if(!areaActive(core.db,room.id))return fail(409,'Raum zuerst aktivieren.');
 if(route==='person-create'){
  const name=clean(b.name),avatar=clean(b.avatar,12),sequence=typeof b.sequenceText==='string'?b.sequenceText.split(',').map(x=>x.trim()):b.sequence,allowed=['dog','cat','tree','house','elephant','owl','flower','pig'];
  if(!name||!avatar||!Array.isArray(sequence)||sequence.length!==4||sequence.some(e=>!allowed.includes(e)))return fail(400,'Name, Avatar und vier gültige Bild-IDs angeben.');
  if(core.db.codes.some(c=>c.areaId===house.id&&JSON.stringify(c.sequence)===JSON.stringify(sequence)))return fail(409,'Emoji-Folge im Haus bereits vergeben.');
  const id='person-'+crypto.randomUUID();commit(s,'person-create',room.id,next=>{next.people.push({id,name,avatar,active:true});next.memberships.push({personId:id,areaId:room.id,active:true});next.roles.push({personId:id,areaId:room.id,role:'player',active:true});next.codes.push({personId:id,areaId:house.id,sequence});});return ok({id,message:'Spielerprofil angelegt: '+name});
 }
 if(route==='room-admins')return ok({items:people.map(p=>({id:p.id,label:p.name,active:core.db.roles.some(r=>r.personId===p.id&&r.areaId===room.id&&r.role==='areaAdmin'&&r.active)})),message:house.name+' / '+room.name+' · RaumAdmins'});
 if(route==='room-admin-set'){
  if(typeof b.active!=='boolean'||b.confirm!==true)return fail(400,'Admin-Zuweisung ausdrücklich bestätigen.');if(!people.some(p=>p.id===b.personId))return fail(403,'Person nicht im Haus verfügbar.');
  commit(s,'room-admin-set',room.id,next=>{let role=next.roles.find(r=>r.personId===b.personId&&r.areaId===room.id&&r.role==='areaAdmin');if(!role){role={personId:b.personId,areaId:room.id,role:'areaAdmin',active:false};next.roles.push(role);}role.active=b.active;});return ok({message:b.active?'RaumAdmin zugewiesen. Eigener Verwaltungszugang erforderlich.':'RaumAdmin-Zuständigkeit entzogen.'});
 }
 return fail(404,'Unbekannte Hausaktion.');
}
module.exports={houseApi};
