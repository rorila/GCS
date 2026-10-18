// Read-only curriculum catalogue. No child data, grants or learning assignments.
const catalog=require('./catalogs/learning-catalog.json');
const {activeRoles,childrenOf}=require('./cms-core.cjs');
function validateCatalog(data){
 if(data.version!==1||!Array.isArray(data.states)||!Array.isArray(data.objectives))throw Error('Ungültiges Katalogformat.');
 const states=new Set(),ids=new Set();
 for(const s of data.states){if(!s.id||!s.name||states.has(s.id))throw Error('Ungültiges Bundesland.');states.add(s.id);}
 for(const row of data.objectives){
  if(!row.id||ids.has(row.id)||!states.has(row.stateId)||!row.title||!row.domain||!row.subject||!row.schoolType||!Array.isArray(row.grades)||!row.grades.length||row.grades.some(g=>!Number.isInteger(g)||g<1||g>99)||!Array.isArray(row.profileIds)||!/^https:\/\//.test(row.sourceUrl)||!row.reviewStatus)throw Error('Ungültiges Lernziel: '+row.id);
  ids.add(row.id);
 }
 return data;
}
validateCatalog(catalog);
function canRead(ctx){
 const s=ctx.session,db=ctx.core.db;
 if(!s||!['admin','account'].includes(s.assurance)||!db.people.some(p=>p.id===s.personId&&p.active&&p.kind==='adult'))return false;
 return childrenOf(db,s.personId).length>0||activeRoles(db,s).some(r=>r.role==='superAdmin'||(r.role==='areaAdmin'&&db.areas.some(a=>a.id===r.areaId&&a.type==='house')));
}
function queryCatalog(body={},data=catalog){
 const state=String(body.state||'Alle Bundesländer'),grade=String(body.grade||'Alle Klassen'),search=String(body.search||'').trim().slice(0,120).toLocaleLowerCase('de'),availability=String(body.availability||'Alle Einträge');
 const gradeNumber=/^(?:Klasse )?(\d+)$/.test(grade)?Number(grade.replace('Klasse ','')):null;
 const options={states:['Alle Bundesländer',...data.states.map(s=>s.name).sort((a,b)=>a.localeCompare(b,'de'))],grades:['Alle Klassen',...[...new Set(data.objectives.flatMap(o=>o.grades))].sort((a,b)=>a-b).map(g=>'Klasse '+g)]};
 const items=data.objectives.map(o=>{
  const stateName=data.states.find(s=>s.id===o.stateId).name,gradeLabel=o.grades.join('/'),availabilityLabel=o.profileIds.length?'Aufgabenprofil vorhanden':'In Vorbereitung';
  return{...o,stateName,gradeLabel,availabilityLabel,detailText:o.description+'\nLehrplanbezug: '+o.section+' · '+o.schoolType+' · '+o.subject+'\nPrüfstatus: '+o.reviewStatus+' · Quellenstand: '+data.sourceCheckedAt+'\n'+(o.coverageDetail||'')+(o.gameProjects?.length?'\nSpiel: '+o.gameProjects.join(', ')+'\nStapel: '+(o.deckNames||[]).join(', '):'')+'\n'+(o.profileIds.length?'Aufgabenprofil(e): '+o.profileIds.join(', '):'Für dieses Lernziel gibt es noch kein Aufgabenprofil.'),sourceText:o.sourceUrl,gameProjects:o.gameProjects||[],deckNames:o.deckNames||[]};
 }).filter(o=>(state==='Alle Bundesländer'||o.stateName===state||o.stateId===state)&&(grade==='Alle Klassen'||o.grades.includes(gradeNumber))&&(availability==='Alle Einträge'||o.availabilityLabel===availability)&&(!search||[o.title,o.description,o.domain,o.section,o.subject,o.schoolType].join(' ').toLocaleLowerCase('de').includes(search)));
 return{ok:true,items,options,message:items.length?items.length+' Einträge · '+data.coverageNote:'Keine passenden Lernziele. Filter ändern oder zurücksetzen.',catalogVersion:data.version};
}
function learningCatalog(ctx){return canRead(ctx)?queryCatalog(ctx.body):{ok:false,status:403,message:'Der Lernzielkatalog steht HouseAdmins und bestätigten Eltern zur Verfügung.',items:[]};}
module.exports={catalog,validateCatalog,canRead,queryCatalog,learningCatalog};
