const path=require('node:path');
const {importJsonStore}=require('./cms-sqlite-import.cjs');
const {createSqliteStore}=require('./cms-sqlite-store.cjs');
const {inspectDatabase,createEncryptedBackup,restoreEncryptedBackup}=require('./cms-sqlite-backup.cjs');
const {uploadBackup}=require('./cms-backup-s3.cjs');
async function run(argv=process.argv.slice(2),env=process.env){
 const command=argv[0],args={};for(let i=1;i<argv.length;i++){if(!/^--[a-z-]+$/.test(argv[i])||args[argv[i].slice(2)]!==undefined)throw Error('Ungültige oder doppelte Option.');const key=argv[i].slice(2);args[key]=argv[i+1]&&!argv[i+1].startsWith('--')?argv[++i]:true;}
 const required=key=>{if(typeof args[key]!=='string')throw Error('--'+key+' erforderlich.');return path.resolve(args[key]);};
 if(command==='import')return importJsonStore({sourcePath:required('source'),targetPath:required('target')});
 if(command==='inspect'){const info=inspectDatabase(required('database'));return{ok:true,schemaVersion:info.state.version,revision:info.revision,counts:info.counts,recoveryReviewRequired:!!info.state.meta?.recoveryReviewRequired};}
 if(command==='backup'){
  const database=required('database'),output=required('output'),assetDirectories={uploads:typeof args.uploads==='string'?path.resolve(args.uploads):env.CMS_UPLOAD_DIR||path.join(path.dirname(database),'uploads')};
  if(typeof args.projects==='string')assetDirectories.projects=path.resolve(args.projects);
  const result=await createEncryptedBackup({dataPath:database,outputDirectory:output,key:env.CMS_BACKUP_ENCRYPTION_KEY,assetDirectories});
  if(args.upload){const remote=await uploadBackup({directory:output,endpoint:env.CMS_BACKUP_S3_ENDPOINT,bucket:env.CMS_BACKUP_S3_BUCKET,region:env.CMS_BACKUP_S3_REGION,accessKey:env.CMS_BACKUP_S3_ACCESS_KEY,secretKey:env.CMS_BACKUP_S3_SECRET_KEY,prefix:'cms-'+path.basename(output)});return{...result,...remote};}
  return{...result,uploaded:false};
 }
 if(command==='recover'){
  const target=required('target');const report=await restoreEncryptedBackup({backupDirectory:required('backup'),targetDirectory:target,key:env.CMS_BACKUP_ENCRYPTION_KEY});
  const store=createSqliteStore({dataPath:path.join(target,'database.sqlite')});
  try{
   const db=store.load();store.commit(db,{actor:'operator',action:'disaster-recovery'},next=>{
    next.meta={...next.meta,recoveryReviewRequired:true,recoveredFromAt:report.backupAt};
    for(const person of next.people)person.authVersion=(person.authVersion||0)+1;
    for(const session of next.playSessions)if(session.status!=='ended'){session.status='ended';session.endedAt=new Date().toISOString();}
    for(const party of next.parties)party.status='ended';
    for(const access of next.temporaryRoomAccess)access.active=false;
    for(const invite of next.invites)invite.expires=0;
   });
  }finally{store.close();}
  return{...report,reviewRequired:true};
 }
 if(command==='approve-recovery'){
  if(args.confirm!==true||typeof args.reason!=='string'||args.reason.trim().length<10)throw Error('Recoveryprüfung mit --confirm und --reason ausdrücklich bestätigen.');
  const store=createSqliteStore({dataPath:required('database')});
  try{const db=store.load();if(!db.meta?.recoveryReviewRequired)throw Error('Kein ausstehender Recoveryprüfstand.');store.commit(db,{actor:'operator',action:'recovery-reviewed'},next=>{next.meta.recoveryReviewRequired=false;next.meta.recoveryReviewedAt=new Date().toISOString();next.meta.recoveryReviewReason=args.reason.trim();});return{approved:true};}finally{store.close();}
 }
 throw Error('Befehle: import, inspect, backup, recover, approve-recovery.');
}
if(require.main===module)run().then(result=>console.log(JSON.stringify(result))).catch(error=>{console.error('CMS-Datenbankoperation fehlgeschlagen:',error.message);process.exitCode=1;});
module.exports={run};
