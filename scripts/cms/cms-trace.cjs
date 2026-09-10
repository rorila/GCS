const crypto=require('node:crypto');
function redact(value,depth=0){
 if(depth>8)return '[Tiefe begrenzt]';if(Array.isArray(value))return value.slice(0,100).map(v=>redact(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,100).map(([k,v])=>[k,/(password|passwort|secret|authorization|cookie|token|credential|sequence|authcode|^code\d*$|^salt$|^hash$)/i.test(k)?'[maskiert]':redact(v,depth+1)]));
 return typeof value==='string'?value.slice(0,8192):value;
}
function createTraceStore(){const traces=new Map();
 function prune(){const now=Date.now();for(const [id,t]of traces)if(t.createdAt+300000<now)traces.delete(id);while(traces.size>=100)traces.delete(traces.keys().next().value);}
 return {
  begin(req,enabled){if(!enabled||!req.headers['x-gcs-trace-id'])return null;prune();const supplied=String(req.headers['x-gcs-trace-id']);const id=/^[a-f0-9-]{36}$/.test(supplied)?supplied:crypto.randomUUID();if(traces.has(id))return null;
   const trace={id,project:'GCS-Server-Anmeldung.json',createdAt:Date.now(),steps:[]};traces.set(id,trace);return trace;},
  step(trace,label,data={}){if(!trace||trace.steps.length>=40)return;trace.steps.push({label,at:new Date().toISOString(),elapsedMs:Date.now()-trace.createdAt,...redact(data)});},
  get(id){prune();return traces.get(id);}
 };
}
module.exports={createTraceStore,redact};
