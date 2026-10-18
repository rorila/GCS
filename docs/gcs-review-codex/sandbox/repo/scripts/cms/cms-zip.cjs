const {inflateRawSync}=require('node:zlib');
const MAX_BYTES=50*1024*1024,MAX_FILES=500;
const MEDIA_EXT=new Set(['png','jpg','jpeg','gif','webp','svg','ico','bmp','wav','mp3','ogg','m4a','mp4','webm','woff','woff2','ttf','otf']);
const HTML_EXT=new Set([...MEDIA_EXT,'html','htm','css','js','mjs','json','map','wasm','txt']);
const GCS_EXT=new Set([...MEDIA_EXT,'json']);
const invalid=()=>Error('ZIP-Archiv konnte nicht gelesen werden (beschädigtes oder nicht unterstütztes Format).');
const tooLarge=()=>Error('ZIP-Bundle ist zu groß (max. 50 MB entpackt).');
const crcTable=Uint32Array.from({length:256},(_,n)=>{for(let i=0;i<8;i++)n=n&1?0xedb88320^(n>>>1):n>>>1;return n>>>0;});
function crc32(bytes){let crc=0xffffffff;for(const b of bytes)crc=crcTable[(crc^b)&255]^(crc>>>8);return(crc^0xffffffff)>>>0;}
function safeName(bytes,flags){
 let name;try{name=new TextDecoder(flags&0x800?'utf-8':'windows-1252',{fatal:true}).decode(bytes);}catch{throw invalid();}
 name=name.replace(/\\/g,'/');
 const directory=name.endsWith('/');if(directory)name=name.slice(0,-1);
 const parts=name.split('/');
 if(!name||parts.some(p=>!p||p==='.'||p==='..'||/[<>:"|?*\x00-\x1f]/.test(p)||/[. ]$/.test(p)||/^(con|prn|aux|nul|com[1-9]|lpt[1-9])(?:\.|$)/i.test(p)))throw Error('Ungültiger Pfad im ZIP.');
 return{name,directory};
}
/** Read the central directory without decompressing. ZIP64, encryption and
 * split archives are intentionally unsupported. Sizes are checked again on
 * actual output; native zlib enforces maxOutputLength during allocation. */
function unpackGameBundle(bytes){
 if(bytes.length<4||bytes.readUInt32LE(0)!==0x04034b50)return null;
 let end=-1;
 for(let i=bytes.length-22;i>=Math.max(0,bytes.length-65557);i--)if(bytes.readUInt32LE(i)===0x06054b50&&i+22+bytes.readUInt16LE(i+20)===bytes.length){end=i;break;}
 if(end<0)throw invalid();
 const count=bytes.readUInt16LE(end+10),centralSize=bytes.readUInt32LE(end+12),centralOffset=bytes.readUInt32LE(end+16);
 if(bytes.readUInt16LE(end+4)||bytes.readUInt16LE(end+6)||bytes.readUInt16LE(end+8)!==count||count===0xffff||centralSize===0xffffffff||centralOffset===0xffffffff||centralOffset+centralSize!==end)throw invalid();
 if(count>MAX_FILES)throw Error('Zu viele Dateien im ZIP (max. 500).');
 const files=[],seen=new Set(),ranges=[];let pos=centralOffset,declaredTotal=0;
 for(let i=0;i<count;i++){
  if(pos+46>end||bytes.readUInt32LE(pos)!==0x02014b50)throw invalid();
  const flags=bytes.readUInt16LE(pos+8),method=bytes.readUInt16LE(pos+10),crc=bytes.readUInt32LE(pos+16),size=bytes.readUInt32LE(pos+20),originalSize=bytes.readUInt32LE(pos+24),nameLength=bytes.readUInt16LE(pos+28),extraLength=bytes.readUInt16LE(pos+30),commentLength=bytes.readUInt16LE(pos+32),local=bytes.readUInt32LE(pos+42);
  if(flags&0x41||![0,8].includes(method)||bytes.readUInt16LE(pos+34)||size===0xffffffff||originalSize===0xffffffff||local===0xffffffff||pos+46+nameLength+extraLength+commentLength>end)throw invalid();
  const rawName=bytes.subarray(pos+46,pos+46+nameLength),{name,directory}=safeName(rawName,flags),key=name.toLowerCase();
  if(seen.has(key))throw Error('Doppelter Pfad im ZIP: '+name);seen.add(key);
  if(local+30>centralOffset||bytes.readUInt32LE(local)!==0x04034b50||bytes.readUInt16LE(local+6)!==flags||bytes.readUInt16LE(local+8)!==method)throw invalid();
  const localNameLength=bytes.readUInt16LE(local+26),localExtraLength=bytes.readUInt16LE(local+28),start=local+30+localNameLength+localExtraLength,finish=start+size;
  if(finish>centralOffset||!bytes.subarray(local+30,local+30+localNameLength).equals(rawName))throw invalid();
  if(!(flags&8)&&(bytes.readUInt32LE(local+14)!==crc||bytes.readUInt32LE(local+18)!==size||bytes.readUInt32LE(local+22)!==originalSize))throw invalid();
  if(directory&&originalSize!==0)throw invalid();
  declaredTotal+=originalSize;if(declaredTotal>MAX_BYTES)throw tooLarge();
  files.push({name,directory,method,crc,originalSize,start,finish});ranges.push([local,finish]);
  pos+=46+nameLength+extraLength+commentLength;
 }
 if(pos!==end)throw invalid();
 ranges.sort((a,b)=>a[0]-b[0]);for(let i=1;i<ranges.length;i++)if(ranges[i][0]<ranges[i-1][1])throw invalid();
 for(const f of files){const parts=f.name.split('/');for(let i=1;i<parts.length;i++)if(files.some(other=>!other.directory&&other.name.toLowerCase()===parts.slice(0,i).join('/').toLowerCase()))throw Error('Widersprüchliche Pfade im ZIP.');}
 const isHtml=files.some(f=>!f.directory&&/^index\.html?$/i.test(f.name)),allowed=isHtml?HTML_EXT:GCS_EXT;
 const entryFiles=files.filter(f=>!f.directory&&(isHtml?/^index\.html?$/i.test(f.name):/\.json$/i.test(f.name)));
 if(entryFiles.length!==1)throw Error(isHtml?'Genau eine index.html im ZIP erforderlich.':'Genau eine Projektdatei (.json) im ZIP erforderlich.');
 for(const f of files)if(!f.directory&&!allowed.has(f.name.split('.').pop().toLowerCase()))throw Error('Dateityp im ZIP nicht erlaubt: '+f.name);
 let total=0,entry;const media=new Map();
 for(const f of files){
  const compressed=bytes.subarray(f.start,f.finish);let data;
  try{data=f.method===0?Buffer.from(compressed):inflateRawSync(compressed,{maxOutputLength:Math.max(1,MAX_BYTES-total)});}catch(e){if(e.code==='ERR_BUFFER_TOO_LARGE')throw tooLarge();throw invalid();}
  total+=data.length;if(total>MAX_BYTES)throw tooLarge();
  if(data.length!==f.originalSize||crc32(data)!==f.crc)throw invalid();
  if(f.directory)continue;
  if(f===entryFiles[0])entry=data;else media.set(f.name,data);
 }
 return{kind:isHtml?'html':'json',entry,media};
}
module.exports={unpackGameBundle};
