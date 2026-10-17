const fs=require('node:fs');
function readCredentials(target){
 if(target&&typeof target==='object')return target.read();
 if(!fs.existsSync(target))return[];
 const data=JSON.parse(fs.readFileSync(target,'utf8'));if(!Array.isArray(data))throw Error('Ungültiger Kontozugangsbestand.');return data;
}
function credentialTransaction(target,entries,operation){
 if(target&&typeof target==='object')return target.transaction(entries,operation);
 const original=fs.existsSync(target)?fs.readFileSync(target):null;
 const write=value=>{fs.writeFileSync(target+'.tmp',value,{mode:0o600});fs.renameSync(target+'.tmp',target);};
 write(JSON.stringify(entries,null,2));
 try{const result=operation();if(result?.then)throw Error('Kontotransaktion muss synchron sein.');if(result?.ok===false){if(original)write(original);else fs.unlinkSync(target);}return result;}
 catch(error){if(original)write(original);else if(fs.existsSync(target))fs.unlinkSync(target);throw error;}
}
module.exports={readCredentials,credentialTransaction};
