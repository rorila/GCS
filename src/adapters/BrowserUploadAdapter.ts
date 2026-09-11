import {IUploadAdapter} from '../ports/IUploadAdapter';
import {DebugLogService} from '../services/DebugLogService';
import {redactDebug} from '../services/DebugPrivacy';
/** Funktioniert im Browser und in einem Electron-Renderer mit DOM. */
export class BrowserUploadAdapter implements IUploadAdapter {
 choose(accept:string,selected:(file:File|null)=>void):()=>void {
  const input=document.createElement('input');input.type='file';input.accept=accept;input.hidden=true;document.body.append(input);
  let done=false;const finish=(file:File|null)=>{if(done)return;done=true;input.remove();selected(file)};
  input.onchange=()=>finish(input.files?.[0]||null);input.addEventListener('cancel',()=>finish(null));input.click();return ()=>{done=true;input.remove()};
 }
 send(endpoint:string,file:File,metadata:Record<string,string>,token:string,progress:(value:number)=>void,signal:AbortSignal):Promise<any>{
  const url=new URL(endpoint,location.href);if(url.origin!==location.origin||!['/api/cms/upload/game','/api/cms/upload/avatar'].includes(url.pathname))return Promise.reject(Error('Kein gültiger CMS-Upload-Endpunkt.'));
  const log=DebugLogService.getInstance(),id=crypto.randomUUID();const event=(phase:string,data:any)=>{if(log.isEnabled())log.log('Action',phase,{data:{type:'http_trace',traceId:id,phase,...redactDebug(data)}})};
  event('CLIENT · Request',{method:'POST',url:url.href,body:{filename:file.name,size:file.size,...metadata},note:'Binärinhalt nicht protokolliert'});
  return new Promise((resolve,reject)=>{
   const xhr=new XMLHttpRequest(),abort=()=>xhr.abort();signal.addEventListener('abort',abort,{once:true});xhr.open('POST',url.href);xhr.timeout=120000;
   xhr.setRequestHeader('Content-Type','application/octet-stream');xhr.setRequestHeader('X-Upload-Metadata',encodeURIComponent(JSON.stringify(metadata)));if(token)xhr.setRequestHeader('Authorization','Bearer '+token);if(log.isEnabled())xhr.setRequestHeader('X-GCS-Trace-ID',id);
   xhr.upload.onprogress=e=>{if(e.lengthComputable)progress(Math.round(e.loaded/e.total*100))};
   const failed=(message:string)=>{event('CLIENT · Upload fehlgeschlagen',{message});reject(Error(message))};
   xhr.onerror=()=>failed('Verbindung zum CMS fehlgeschlagen.');xhr.ontimeout=()=>failed('Zeitüberschreitung beim Upload.');xhr.onabort=()=>failed('Upload abgebrochen.');
   xhr.onload=async()=>{let body:any;try{body=JSON.parse(xhr.responseText)}catch{failed('Ungültige Serverantwort.');return}
    if(log.isEnabled()&&xhr.getResponseHeader('X-GCS-Trace-ID')===id){try{const result=await fetch('/api/cms/debug/traces/'+id,{signal:AbortSignal.timeout(1500)});if(result.ok){const trace=await result.json();for(const step of trace.steps||[])event('SERVER · '+step.label,{...step,project:trace.project})}}catch{}}
    event('CLIENT · Response',{status:xhr.status,body});if(xhr.status>=200&&xhr.status<300&&body.ok)resolve(body);else reject(Error(body.message||'Upload abgelehnt.'));
   };
   xhr.onloadend=()=>signal.removeEventListener('abort',abort);if(signal.aborted){reject(Error('Upload abgebrochen.'));return}xhr.send(file);
  });
 }
}
export const browserUploadAdapter=new BrowserUploadAdapter();
