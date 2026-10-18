const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {filesIn}=require('./cms-sqlite-backup.cjs');
const digest=value=>crypto.createHash('sha256').update(value).digest('hex');
const hmac=(key,value)=>crypto.createHmac('sha256',key).update(value).digest();
async function uploadBackup({directory,endpoint,bucket,region,accessKey,secretKey,prefix,fetchImpl=fetch}){
 const url=new URL(endpoint);if(url.protocol!=='https:'||url.username||url.password||url.search||url.hash)throw Error('S3-Backup benötigt einen konfigurierten HTTPS-Endpunkt.');
 if(!bucket||!region||!accessKey||!secretKey||!/^cms-[a-zA-Z0-9_-]+$/.test(prefix||''))throw Error('S3-Backupkonfiguration unvollständig.');
 const files=filesIn(directory),manifest=path.join(directory,'manifest.json.enc');
 if(!files.includes(manifest)||files.some(file=>!file.endsWith('.enc')))throw Error('Nur vollständige verschlüsselte Backups werden übertragen.');
 const ordered=[...files.filter(file=>file!==manifest),manifest];
 for(const file of ordered){
  const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(file))hash.update(chunk);const payloadHash=hash.digest('hex');
  const relative=path.relative(directory,file).split(path.sep).join('/');
  const target=new URL(url);target.pathname=[url.pathname.replace(/\/$/,''),bucket,prefix,relative].join('/').split('/').map(part=>encodeURIComponent(part).replace(/[!'()*]/g,ch=>'%'+ch.charCodeAt(0).toString(16).toUpperCase())).join('/');
  const date=new Date().toISOString().replace(/[:-]|\.\d{3}/g,''),day=date.slice(0,8),scope=day+'/'+region+'/s3/aws4_request';
  const headers={host:target.host,'x-amz-content-sha256':payloadHash,'x-amz-date':date};
  const signed='host;x-amz-content-sha256;x-amz-date',canonical='PUT\n'+target.pathname+'\n\n'+Object.entries(headers).map(([key,value])=>key+':'+value+'\n').join('')+'\n'+signed+'\n'+payloadHash;
  const key=hmac(hmac(hmac(hmac('AWS4'+secretKey,day),region),'s3'),'aws4_request');
  const signature=crypto.createHmac('sha256',key).update('AWS4-HMAC-SHA256\n'+date+'\n'+scope+'\n'+digest(canonical)).digest('hex');
  headers.authorization='AWS4-HMAC-SHA256 Credential='+accessKey+'/'+scope+', SignedHeaders='+signed+', Signature='+signature;
  const body=fs.createReadStream(file);
  try{
   const response=await fetchImpl(target,{method:'PUT',headers,body,duplex:'half',signal:AbortSignal.timeout(120000),redirect:'error'});
   if(!response.ok)throw Error('Externe Backupübertragung fehlgeschlagen (HTTP '+response.status+').');
   await response.body?.cancel();
  }finally{body.destroy();}
 }
 return{uploaded:true,objects:ordered.length,prefix};
}
module.exports={uploadBackup};
