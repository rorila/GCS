const fs=require('node:fs'),crypto=require('node:crypto');
function createProfile(core,store,configPath,stageId){
 const project=require('./cms-project.cjs').readWorkflow(configPath,stageId),stage=project.stages[0],node=stage.objects.find(o=>o.className==='TServerProfile');
 if(!node||!Array.isArray(node.avatars)||!node.avatars.length)throw Error('Profil-Konfiguration fehlt');
 const operations={read:'onRead',save:'onSave',help:'onHelp'};
 for(const [op,event]of Object.entries(operations)){const task=stage.tasks.find(t=>t.name===node.events[event]);const steps=task?.actionSequence;const action=stage.actions.find(a=>a.name===steps?.[0]?.name);if(steps?.length!==1||steps[0].type!=='action'||action?.type!=='call_method'||action.target!==node.name||action.method!==op)throw Error('Ungültiger Profil-Workflow');}
 return function run(session,operation,body,emit=()=>{}){
  const task=node.events[operations[operation]];if(!task)return {ok:false,message:node.failureMessage};
  const meta={component:node.name,componentId:node.id,task,stage:stage.id};emit('Eigene Person aus Sitzung ermitteln',{...meta,personId:session.personId});
  const person=core.db.people.find(p=>p.id===session.personId&&p.active);if(!person)return {ok:false,message:node.failureMessage};
  if(operation==='read'){const result={ok:true,name:person.name,avatar:person.avatar,avatarImage:person.avatarImage||'',message:node.readMessage};emit('Eigenes Profil lesen',{...meta,output:result});return result;}
  if(operation==='save'){
   const valid=typeof body.name==='string'&&body.name.trim().length>0&&body.name.trim().length<=40&&!/[\u0000-\u001f<>]/.test(body.name)&&node.avatars.includes(body.avatar);
   emit('Profilangaben prüfen',{...meta,valid});if(!valid)return {ok:false,message:node.failureMessage};
   store.commit(core.db,{actor:person.id,action:'profile-save'},next=>{const own=next.people.find(p=>p.id===session.personId);own.name=body.name.trim();own.avatar=body.avatar;});
  }else{
   store.commit(core.db,{actor:person.id,action:'profile-help'},next=>{next.profileRequests=next.profileRequests||[];if(!next.profileRequests.some(x=>x.personId===person.id&&x.status==='open'))next.profileRequests.push({id:crypto.randomUUID(),personId:person.id,type:'access-help',status:'open',at:new Date().toISOString()});});
  }
  emit(operation==='save'?'Eigenes Profil speichern':'Zugangshilfe vormerken',{...meta,personId:person.id});
  const saved=core.db.people.find(p=>p.id===person.id);
  return {ok:true,name:saved.name,avatar:saved.avatar,message:operation==='save'?node.savedMessage:node.helpMessage};
 };
}
module.exports={createProfile};
