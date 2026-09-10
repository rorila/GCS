/** Gemeinsame Maskierung vor Speicherung im Debug-Log. Keine Zugangsdaten im Export. */
export const debugSecretKey=/(password|passwort|secret|authorization|cookie|token|ticket|api.?key|credential|sequence|authcode|^code\d*$|^salt$|^hash$)/i;
const sensitive=debugSecretKey,knownSecrets=new Set<string>();
function remember(value:any){if(typeof value==='string'&&value.length>=8){knownSecrets.add(value);if(value.startsWith('Bearer '))knownSecrets.add(value.slice(7));while(knownSecrets.size>512)knownSecrets.delete(knownSecrets.values().next().value!);}}
function maskText(value:string){for(const secret of knownSecrets)value=value.split(secret).join('[maskiert]');return value;}
export function redactDebug(value:any,depth=0):any {
 if(depth>8)return '[Tiefe begrenzt]';
 if(typeof value==='string'){
  try{if(value.length<16384&&/^[\[{]/.test(value.trim()))return redactDebug(JSON.parse(value),depth+1);}catch{}
  return maskText(value).replace(/([?&](?:token|ticket|password|secret|code|key)=)[^&#\s]*/gi,'$1[maskiert]').slice(0,8192);
 }
 if(Array.isArray(value))return value.slice(0,100).map(v=>redactDebug(v,depth+1));
 if(value&&typeof value==='object')return Object.fromEntries(Object.entries(value).slice(0,100).map(([key,item])=>{if(sensitive.test(key)||(key==='value'&&sensitive.test(String(value.name||value.variableName||'')))){remember(item);return [key,'[maskiert]'];}return [key,redactDebug(item,depth+1)];}));
 return value;
}
export function redactDebugMessage(message:string):string {
 // Ältere Logger schreiben Variablenwerte direkt in den Meldungstext.
 if(/\b(password|passwort|token|authorization|cookie|sequence|Code\d)\b\s*(?:[:=←]|→)/i.test(message))return '[Vertraulicher Variablenwert maskiert]';
 return String(redactDebug(message));
}
