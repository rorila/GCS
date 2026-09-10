import {DebugLogService} from './DebugLogService';
import {redactDebug} from './DebugPrivacy';

/** Explizite Parent-IDs verhindern Vermischung gleichzeitig laufender HTTP-Actions. */
export async function tracedFetch(url:string,options:RequestInit,parentId:string):Promise<Response>{
 const log=DebugLogService.getInstance();if(!log.isEnabled())return fetch(url,options);
 const id=crypto.randomUUID(),started=performance.now(),target=new URL(url,location.href),headers=new Headers(options.headers);
 const localCms=target.origin===location.origin&&target.pathname.startsWith('/api/cms/');
 if(localCms)headers.set('X-GCS-Trace-ID',id);
 const event=(phase:string,data:any)=>log.log('Action',phase+' · '+id,{parentId,data:{type:'http_trace',traceId:id,phase,...redactDebug(data)}});
 event('CLIENT · Request',{method:options.method||'GET',url:target.href,headers:Object.fromEntries(headers.entries()),body:options.body||null});
 try{
  const response=await fetch(url,{...options,headers});
  // Begrenzte Kopie; die eigentliche Antwort bleibt für die Action unangetastet.
  let responseBody:any='[Kein Body]';const reader=response.clone().body?.getReader();
  if(reader){let raw='',size=0;const decoder=new TextDecoder();while(size<=16384){const chunk=await reader.read();if(chunk.done)break;size+=chunk.value.length;raw+=decoder.decode(chunk.value,{stream:true});if(size>16384){void reader.cancel();raw=raw.slice(0,8192)+' [gekürzt]';break;}}try{responseBody=JSON.parse(raw);}catch{responseBody=raw;}}
  if(localCms&&response.headers.get('X-GCS-Trace-ID')===id){
   try{const detail=await fetch('/api/cms/debug/traces/'+id,{signal:AbortSignal.timeout(1500)});
    if(detail.ok){const trace=await detail.json();for(const step of trace.steps||[])event('SERVER · '+step.label,{...step,project:trace.project,serverTraceId:trace.id});}
    else event('SERVER · Details geschützt',{status:detail.status,note:'Verwaltungsanmeldung auf demselben CMS-Ursprung erforderlich.'});
   }catch{event('SERVER · Details nicht erreichbar',{note:'Die eigentliche Antwort wurde empfangen.'});}
  }
  event('CLIENT · Response',{status:response.status,statusText:response.statusText,headers:Object.fromEntries(response.headers.entries()),body:responseBody,durationMs:Math.round(performance.now()-started)});
  return response;
 }catch(error){event('CLIENT · Anfrage fehlgeschlagen',{error:String(error),durationMs:Math.round(performance.now()-started)});throw error;}
}
