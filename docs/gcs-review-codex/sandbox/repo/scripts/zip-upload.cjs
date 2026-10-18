// Baut das Upload-Zip fuer ein GCS-Projekt (1 Projektdatei + alle referenzierten Medien).
// Aufruf: node scripts/zip-upload.cjs <Projekt.json>
// Nutzt fflate (Projekt-Dependency): UTF-8-Dateinamen + Forward-Slashes —
// Compress-Archive wuerde Umlaute (Loewe.png, "...fuer kleine Kinder") beschaedigen.
// Hinweis: referenziert werden statische Pfade plus Aufloesung ueber das
// Medienmanifest (public/media-manifest.json) fuer Template-Pfade wie
// images/madn/w${Var_Wurf}.svg.
const fs=require('fs'),path=require('path'),{zipSync}=require('fflate');
const root=path.join(__dirname,'..');
const name=process.argv[2]||'ElinsMemoryRemote.json';
const proj=path.join(root,'game-server','public','projects',name);
const s=fs.readFileSync(proj,'utf8');
// Statische Medienpfade
const refs=new Set([...s.matchAll(/images\/[^"\\$]+?\.(?:png|jpe?g|svg|ico|webp|gif)/gi)].map(m=>m[0]));
// Template-Pfade (mit ${...}) gegen das Medienmanifest aufloesen
const manifestPath=path.join(root,'public','media-manifest.json');
if(fs.existsSync(manifestPath)){
 const manifest=JSON.parse(fs.readFileSync(manifestPath,'utf8'));
 const flat=[];const walk=(o,p)=>{for(const[k,v]of Object.entries(o||{})){if(Array.isArray(v))for(const f of v)flat.push(p+k+'/'+f);else walk(v,p+k+'/');}};
 walk(manifest.images||manifest,'images/');
 const esc=t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
 for(const m of s.matchAll(/images\/[^"\\]*\$\{[^"\\]*\.(?:png|jpe?g|svg|ico|webp|gif)/gi)){
  // Template am ${...}-Platzhalter splitten, statische Teile escapen
  const re=new RegExp('^'+m[0].split(/\$\{[^}]*\}/g).map(esc).join('[^/]+?')+'$','i');
  for(const f of flat)if(re.test(f))refs.add(f);
 }
}
const files={[name]:fs.readFileSync(proj)};
let n=0,missing=0;
for(const r of refs){
 const src=path.join(root,'public',r);
 if(fs.existsSync(src)){files[r]=fs.readFileSync(src);n++;}
 else{console.log('FEHLT:',r);missing++;}
}
const out=path.join(root,'game-server','data',name.replace(/\.json$/i,'-upload.zip'));
fs.writeFileSync(out,zipSync(files,{level:6}));
console.log(refs.size,'Referenzen,',n,'Medien + 1 JSON',(missing?'('+missing+' fehlen!)':'')+'->',out);
