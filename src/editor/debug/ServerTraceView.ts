import type {LogEntry} from '../../services/DebugLogService';
/** Anfragebezogene Ansicht; JSON-Werte werden ausschließlich als Text eingefügt. */
export function renderServerTraces(logs:LogEntry[],container:HTMLElement,openFlow?:((task:string)=>void)){
 const groups=new Map<string,LogEntry[]>();
 const walk=(entries:LogEntry[])=>{for(const entry of entries){if(entry.data?.type==='http_trace'){const id=entry.data.traceId;groups.set(id,[...(groups.get(id)||[]),entry]);}walk(entry.children||[]);}};walk(logs);
 if(!groups.size){container.textContent='Noch keine HTTP-Vorgänge. Aufzeichnung einschalten und eine Anfrage auslösen.';return;}
 for(const [id,entries]of groups){
  const previous=container.dataset.expandedTraces?.split(',')||[];
  const group=document.createElement('details');group.open=previous.includes(id);group.style.cssText='margin:8px;padding:10px;background:#183040;border-radius:8px;border:1px solid #40627b';
  group.ontoggle=()=>{const ids=new Set((container.dataset.expandedTraces||'').split(',').filter(Boolean));if(group.open)ids.add(id);else ids.delete(id);container.dataset.expandedTraces=[...ids].join(',');};
  const request=entries.find(e=>e.data.phase==='CLIENT · Request')?.data,response=entries.find(e=>e.data.phase==='CLIENT · Response')?.data;
  const summary=document.createElement('summary');summary.style.cssText='cursor:pointer;overflow-wrap:anywhere;line-height:1.6';summary.textContent=(request?.method||'HTTP')+' '+(request?.url||'Anfrage')+' · '+(response?response.status+(response.body?.ok===false?' · abgelehnt':''):'läuft / fehlgeschlagen')+' · '+(response?.durationMs??'…')+' ms · '+id;group.append(summary);
  const list=document.createElement('ol');list.style.cssText='padding-left:22px';
  entries.forEach(entry=>{
   const item=document.createElement('li');item.style.cssText='padding:8px 0;color:#e4f3ff';const detail=document.createElement('details'),label=document.createElement('summary');label.style.cursor='pointer';label.textContent=entry.data.phase+(entry.data.elapsedMs!==undefined?' · +'+entry.data.elapsedMs+' ms':'');detail.append(label);
   const values=document.createElement('pre');values.style.cssText='white-space:pre-wrap;overflow-wrap:anywhere;font-size:11px;background:#10212c;padding:8px';values.textContent=JSON.stringify(entry.data,null,2);detail.append(values);
   if(openFlow&&entry.data.task){const button=document.createElement('button');button.textContent='Zum Server-Flow';button.onclick=()=>openFlow(entry.data.task);detail.append(button);}
   item.append(detail);list.append(item);
  });group.append(list);container.append(group);
 }
}
