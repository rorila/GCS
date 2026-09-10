/** Ordnet gerenderte Features. Alte Projekte ohne parentId bleiben flach. */
export function renderFeatureHierarchy(entries: {id:string;parentId?:string;html:string;collapsed:boolean}[]):string {
 const byId=new Map(entries.map(e=>[e.id,e])),visited=new Set<string>();
 const render=(entry:typeof entries[number]):string=>{
  if(visited.has(entry.id))return '';visited.add(entry.id);
  const children=entries.filter(e=>e.parentId===entry.id&&e.id!==entry.id);
  // Auch verborgene Nachfahren markieren, damit sie nicht als verwaiste Wurzeln erscheinen.
  const nested=children.map(render).join('');
  return entry.html+(!entry.collapsed&&nested?'<div style="margin-left:20px;border-left:2px solid #405581;padding-left:8px">'+nested+'</div>':'');
 };
 let result=entries.filter(e=>!e.parentId||!byId.has(e.parentId)||e.parentId===e.id).map(render).join('');
 for(const entry of entries)if(!visited.has(entry.id))result+=render(entry);
 return result;
}
