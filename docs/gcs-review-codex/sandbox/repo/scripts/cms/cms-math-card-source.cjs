// Preserve authored project layouts while applying the shared card-box-first flow.
const fs=require('node:fs'),path=require('node:path'),{apply}=require('./cms-math-cardbox-ui.cjs');
const names=['Mathe-Rechenballons','Mathe-Rechenpuzzle','Mathe-Insel-Flussbruecke'];
function writePackages(){
 const root=path.resolve(__dirname,'../..'),dir=path.join(root,'artifacts/cardbox-adventures'),{zipSync}=require('fflate'),{mediaOf,portableProject}=require('./cms-build-math-island.cjs');fs.mkdirSync(dir,{recursive:true});
 for(const name of names){const p=JSON.parse(fs.readFileSync(path.join(root,'game-server/public/projects',name+'.json'),'utf8')),files={[name+'.json']:Buffer.from(JSON.stringify(p,null,2))};for(const ref of mediaOf(p))files[ref]=fs.readFileSync(path.join(root,'public',ref));fs.writeFileSync(path.join(dir,name+'.zip'),zipSync(files));fs.writeFileSync(path.join(dir,name+'-portable.json'),JSON.stringify(portableProject(p),null,2)+'\n');}
}
module.exports={apply,writePackages};
if(require.main===module){for(const n of names){const file=path.join(__dirname,'../../game-server/public/projects',n+'.json'),p=JSON.parse(fs.readFileSync(file,'utf8'));apply(p);fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');}writePackages();console.log('Karteikasten als Standardquelle und aktuelle CMS-Pakete für drei Projekte eingerichtet.');}
