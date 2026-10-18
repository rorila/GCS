const fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const {pipeline}=require('node:stream/promises');
const {DatabaseSync}=require('node:sqlite');
const {APPLICATION_ID,FORMAT,COLLECTIONS}=require('./cms-sqlite-schema.cjs');
const {validate}=require('./cms-core.cjs');
const MAGIC=Buffer.from('GCSB1');
function encryptionKey(value){
 const key=Buffer.from(value||'','base64');if(key.length!==32||key.toString('base64')!==value)throw Error('Backupverschlüsselung benötigt einen Base64-Schlüssel mit 32 Bytes.');return key;
}
function inspectDatabase(file){
 if(!fs.existsSync(file))throw Error('SQLite-Datei fehlt.');
 const db=new DatabaseSync(file,{readOnly:true});
 try{
  if(db.prepare('PRAGMA application_id').get().application_id!==APPLICATION_ID||db.prepare('PRAGMA user_version').get().user_version!==FORMAT)throw Error('Unbekanntes SQLite-Backupformat.');
  if(db.prepare('PRAGMA integrity_check').get().integrity_check!=='ok'||db.prepare('PRAGMA foreign_key_check').all().length)throw Error('SQLite-Integritätsprüfung fehlgeschlagen.');
  const state=Object.fromEntries(db.prepare('SELECT key,value FROM cms_settings').all().map(r=>[r.key,JSON.parse(r.value)]));
  for(const collection of Object.keys(COLLECTIONS))state[collection]=db.prepare(`SELECT payload FROM "${collection}" ORDER BY ordinal`).all().map(r=>JSON.parse(r.payload));
  validate(state);
  return{state,revision:JSON.parse(db.prepare("SELECT value FROM cms_metadata WHERE key='revision'").get().value),counts:Object.fromEntries(Object.keys(COLLECTIONS).map(k=>[k,state[k].length]))};
 }finally{db.close();}
}
async function encryptFile(source,target,key){
 const iv=crypto.randomBytes(12),cipher=crypto.createCipheriv('aes-256-gcm',key,iv),hash=crypto.createHash('sha256');
 fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,Buffer.concat([MAGIC,iv]),{flag:'wx',mode:0o600});
 const input=fs.createReadStream(source);input.on('data',chunk=>hash.update(chunk));
 await pipeline(input,cipher,fs.createWriteStream(target,{flags:'a',mode:0o600}));fs.appendFileSync(target,cipher.getAuthTag());
 return hash.digest('hex');
}
async function decryptFile(source,target,key){
 const size=fs.statSync(source).size;if(size<33)throw Error('Beschädigtes verschlüsseltes Backup.');
 const fd=fs.openSync(source,'r'),header=Buffer.alloc(17),tag=Buffer.alloc(16);
 try{fs.readSync(fd,header,0,17,0);fs.readSync(fd,tag,0,16,size-16);}finally{fs.closeSync(fd);}
 if(!header.subarray(0,5).equals(MAGIC))throw Error('Unbekanntes verschlüsseltes Backupformat.');
 const decipher=crypto.createDecipheriv('aes-256-gcm',key,header.subarray(5));decipher.setAuthTag(tag);
 fs.mkdirSync(path.dirname(target),{recursive:true});
 try{await pipeline(fs.createReadStream(source,{start:17,end:size-17}),decipher,fs.createWriteStream(target,{flags:'wx',mode:0o600}));}
 catch(error){if(fs.existsSync(target))fs.unlinkSync(target);throw Error('Backup konnte nicht authentifiziert werden.');}
}
function filesIn(root){
 const out=[];if(!fs.existsSync(root))return out;
 function walk(directory){for(const name of fs.readdirSync(directory)){const file=path.join(directory,name),stat=fs.lstatSync(file);if(stat.isSymbolicLink())throw Error('Symlink im Backupbestand nicht erlaubt.');if(stat.isDirectory())walk(file);else if(stat.isFile())out.push(file);}}
 walk(root);return out;
}
async function createEncryptedBackup({dataPath,outputDirectory,key,assetDirectories={}}){
 key=encryptionKey(key);if(fs.existsSync(outputDirectory))throw Error('Backupziel existiert bereits.');
 inspectDatabase(dataPath);
 for(const root of Object.values(assetDirectories))if(path.resolve(outputDirectory).startsWith(path.resolve(root)+path.sep)||path.resolve(root)===path.resolve(outputDirectory))throw Error('Backupziel darf nicht im Assetbestand liegen.');
 fs.mkdirSync(outputDirectory,{recursive:true,mode:0o700});
 const plain=path.join(outputDirectory,'.snapshot.sqlite'),snapshotAt=new Date().toISOString();
 try{
  const source=new DatabaseSync(dataPath,{readOnly:true});try{source.prepare('VACUUM INTO ?').run(plain);}finally{source.close();}
  const snapshot=inspectDatabase(plain),manifest={format:1,at:snapshotAt,revision:snapshot.revision,schemaVersion:snapshot.state.version,imageDigest:process.env.CMS_IMAGE_DIGEST||null,counts:snapshot.counts,files:[]};
  const entries=[{source:plain,relative:'database.sqlite'}];
  for(const [label,root]of Object.entries(assetDirectories)){
   if(!/^[a-z][a-z0-9_-]{0,40}$/.test(label))throw Error('Ungültiger Assetbereich.');
   for(const file of filesIn(root))entries.push({source:file,relative:label+'/'+path.relative(root,file).split(path.sep).join('/')});
  }
  for(const game of snapshot.state.games.filter(g=>g.storage==='upload'))if(!entries.some(e=>e.relative==='uploads/'+game.file))throw Error('Benötigtes Spiel-Upload fehlt in der Sicherung.');
  for(const person of snapshot.state.people.filter(p=>p.avatarImage?.startsWith('/avatars/')))if(!entries.some(e=>e.relative==='uploads/'+person.avatarImage.slice(9)))throw Error('Benötigtes Avatar-Upload fehlt in der Sicherung.');
  for(const entry of entries){const before=fs.statSync(entry.source),digest=await encryptFile(entry.source,path.join(outputDirectory,entry.relative+'.enc'),key),after=fs.statSync(entry.source);if(before.size!==after.size||before.mtimeMs!==after.mtimeMs)throw Error('Datei während Backup verändert.');manifest.files.push({path:entry.relative,size:after.size,sha256:digest});}
  const manifestFile=path.join(outputDirectory,'.manifest.json');fs.writeFileSync(manifestFile,JSON.stringify(manifest),{flag:'wx',mode:0o600});
  try{await encryptFile(manifestFile,path.join(outputDirectory,'manifest.json.enc'),key);}finally{fs.unlinkSync(manifestFile);}
  return{at:manifest.at,revision:manifest.revision,fileCount:manifest.files.length,directory:outputDirectory};
 }finally{if(fs.existsSync(plain))fs.unlinkSync(plain);for(const suffix of ['-wal','-shm'])if(fs.existsSync(plain+suffix))fs.unlinkSync(plain+suffix);}
}
async function restoreEncryptedBackup({backupDirectory,targetDirectory,key}){
 key=encryptionKey(key);if(fs.existsSync(targetDirectory))throw Error('Recoveryziel existiert bereits.');
 fs.mkdirSync(targetDirectory,{recursive:true,mode:0o700});const manifestPath=path.join(targetDirectory,'.manifest.json');
 await decryptFile(path.join(backupDirectory,'manifest.json.enc'),manifestPath,key);
 let manifest;try{manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));}finally{fs.unlinkSync(manifestPath);}
 if(manifest.format!==1||!Array.isArray(manifest.files)||manifest.files.length>100000)throw Error('Ungültiges Backupmanifest.');
 const seen=new Set();
 for(const entry of manifest.files){
  if(typeof entry.path!=='string'||/[\\\x00-\x1f<>:"|?*]/.test(entry.path)||entry.path.split('/').some(p=>!p||p==='.'||p==='..')||path.isAbsolute(entry.path)||seen.has(entry.path))throw Error('Unzulässiger Backup-Dateipfad.');seen.add(entry.path);
  const source=path.join(backupDirectory,entry.path+'.enc');if(fs.lstatSync(source).isSymbolicLink())throw Error('Symlink im Backup nicht erlaubt.');
  const target=path.join(targetDirectory,entry.path);await decryptFile(source,target,key);
  const hash=crypto.createHash('sha256');for await(const chunk of fs.createReadStream(target))hash.update(chunk);
  if(fs.statSync(target).size!==entry.size||hash.digest('hex')!==entry.sha256)throw Error('Wiederhergestellte Datei stimmt nicht mit Manifest überein.');
 }
 if(!seen.has('database.sqlite'))throw Error('Datenbank fehlt im Backup.');
 inspectDatabase(path.join(targetDirectory,'database.sqlite'));
 fs.writeFileSync(path.join(targetDirectory,'recovery-review-required.json'),JSON.stringify({backupAt:manifest.at,revision:manifest.revision,imageDigest:manifest.imageDigest}),{flag:'wx',mode:0o600});
 return{verified:true,backupAt:manifest.at,revision:manifest.revision,targetDirectory};
}
module.exports={createEncryptedBackup,restoreEncryptedBackup,inspectDatabase,encryptionKey,filesIn};
