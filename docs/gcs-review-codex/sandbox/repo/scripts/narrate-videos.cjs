// Mischt die Narrations-Clips (public/videos/_narr/*.mp3) an ihre
// Zeitstempel (*.narration.json) und muxt sie als Tonspur ins Video.
// Ergebnis: public/videos/<name>-de.webm — Originalvideo bleibt bestehen.
//
//   node scripts/narrate-videos.cjs [suitePrefix]   z. B. "personen"
const fs=require('node:fs'),path=require('node:path'),os=require('node:os');
const {execFileSync}=require('node:child_process');
const ffmpeg=require('ffmpeg-static');
const ffprobe=require('ffprobe-static').path;

const DIR='public/videos';
const NARR=path.join(DIR,'_narr');
const filter=(process.argv[2]||'').toLowerCase();

function videoDur(f){
 return +execFileSync(ffprobe,['-v','error','-show_entries','format=duration','-of','csv=p=0',f]).toString().trim();
}

const jobs=fs.readdirSync(DIR).filter(f=>f.endsWith('.narration.json'))
 .filter(f=>!filter||f.toLowerCase().startsWith(filter));
if(!jobs.length){console.log('Keine .narration.json gefunden'+(filter?' (Filter: '+filter+')':''));process.exit(0)}

for(const j of jobs){
 const meta=JSON.parse(fs.readFileSync(path.join(DIR,j),'utf8'));
 const ev=(meta.events||[]).filter(e=>fs.existsSync(path.join(NARR,e.file)));
 const base=j.replace(/\.narration\.json$/,'');
 const src=path.join(DIR,base+'.webm');
 const dst=path.join(DIR,base+'-de.webm');
 if(!fs.existsSync(src)||!ev.length){console.log('⊘ '+base+': kein Video oder keine Clips');continue}

 // Filter-Graph als Datei (Kommandozeile bleibt bei vielen Clips kurz):
 // jede Ansage bekommt adelay=<ms>|<ms>, danach amix ueber alle.
 const filters=[];
 const mixIns=[];
 ev.forEach((e,i)=>{
  const ms=Math.max(0,Math.round(e.t*1000));
  filters.push(`[${i+1}:a]adelay=${ms}|${ms}[a${i}]`);
  mixIns.push(`[a${i}]`);
 });
 filters.push(mixIns.join('')+`amix=inputs=${ev.length}:duration=longest:dropout_transition=0,aresample=48000,aformat=channel_layouts=stereo[aout]`);
 const fscript=path.join(os.tmpdir(),'narr-'+base+'.ffscript');
 fs.writeFileSync(fscript,filters.join(';\n'));

 const args=['-y','-i',src];
 for(const e of ev)args.push('-i',path.join(NARR,e.file));
 args.push('-filter_complex_script',fscript,'-map','0:v','-map','[aout]',
  '-c:v','copy','-c:a','libopus','-b:a','64k',dst);
 try{
  execFileSync(ffmpeg,args,{stdio:'pipe',timeout:300000});
  console.log('✔ '+base+'-de.webm — '+ev.length+' Ansagen, '+videoDur(dst).toFixed(1)+' s');
 }catch(e){
  console.log('✘ '+base+': '+String(e.stderr||e.message).split('\n').slice(-3).join(' ').slice(0,240));
 }
 fs.rmSync(fscript,{force:true});
}
