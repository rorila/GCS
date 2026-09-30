/** Regressionstest: Fremdspiele (Einzel-HTML / ZIP mit index.html) hochladen,
 *  als Vorschau ausliefern und Bundle-Assets servieren. */
const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {createServer}=require('./cms/cms-server.cjs'),{zipSync}=require('fflate');
(async()=>{
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-html-')),dataPath=path.join(dir,'cms.json');
 const app=createServer({dataPath}),base='http://127.0.0.1:15185',password=crypto.randomBytes(18).toString('hex'),salt=crypto.randomBytes(16).toString('hex');
 fs.writeFileSync(path.join(dir,'cms-admin-auth.json'),JSON.stringify([{personId:'demo-adult',username:'rootadmin',salt,hash:crypto.scryptSync(password,salt,64).toString('hex')}]));
 const checks=[],check=(n,v)=>{assert.ok(v,n);checks.push(n)};
 try{
  await new Promise(r=>app.server.listen(15185,'127.0.0.1',r));
  app.core.db.roles.push({personId:'demo-adult',role:'superAdmin',areaId:'root',active:true});
  const cookie=(await(await fetch(base+'/admin-login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username:'rootadmin',password}),redirect:'manual'})).headers.get('set-cookie')).split(';')[0];
  const post=async(route,body={})=>{const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{'Content-Type':'application/json',Origin:base,Cookie:cookie},body:JSON.stringify(body)});return{status:r.status,data:await r.json()}};
  const up=async(bytes,meta)=>{const r=await fetch(base+'/api/cms/upload/game',{method:'POST',headers:{Origin:base,Cookie:cookie,'Content-Type':'application/octet-stream','X-Upload-Metadata':encodeURIComponent(JSON.stringify(meta))},body:bytes});return{status:r.status,data:await r.json()}};

  // Einzel-HTML-Datei
  const d1=(await post('admin/super-game-create',{title:'HtmlSpiel'})).data.id;
  check('Einzel-HTML wird als .html-Upload gespeichert',(await up(Buffer.from('<!doctype html><html><body><h1>x</h1><script>1</script></body></html>'),{title:'HtmlSpiel',gameId:d1})).status===200&&/\.html$/.test(app.core.db.games.find(g=>g.id===d1).file));

  // ZIP mit index.html + Assets
  const d2=(await post('admin/super-game-create',{title:'ZipSpiel'})).data.id;
  const zip=zipSync({'index.html':new TextEncoder().encode('<!doctype html><html><body><script src=js/g.js></script></body></html>'),'js/g.js':new TextEncoder().encode('window.X=42'),'img/a.png':Buffer.from([137,80,78,71])});
  check('ZIP mit index.html wird angenommen',(await up(Buffer.from(zip),{title:'ZipSpiel',gameId:d2})).status===200);
  const g2=app.core.db.games.find(g=>g.id===d2);
  check('Einstiegsdatei ist index.html',/\.html$/.test(g2.file));
  const stem=g2.file.slice(0,-5);
  check('Assets liegen im Bundle-Verzeichnis',fs.existsSync(path.join(dir,'uploads',stem,'js/g.js'))&&fs.existsSync(path.join(dir,'uploads',stem,'img/a.png')));

  // ZIP ohne index.html und ohne json wird abgelehnt
  const d3=(await post('admin/super-game-create',{title:'Leerzip'})).data.id;
  check('ZIP ohne Einstiegsdatei wird abgelehnt',(await up(Buffer.from(zipSync({'x.txt':new TextEncoder().encode('x')})),{title:'Leerzip',gameId:d3})).status===400);
  // GCS-Bundle bleibt streng: js im json-Bundle abgelehnt
  const d4=(await post('admin/super-game-create',{title:'Boese'})).data.id;
  check('JS im GCS-Bundle bleibt verboten',(await up(Buffer.from(zipSync({'s.json':new TextEncoder().encode('{}'),'x.js':new TextEncoder().encode('x')})),{title:'Boese',gameId:d4})).status===400);

  // Vorschau: Redirect auf Trailing Slash, HTML-Dokument und Assets
  const pv=await post('upload-library',{operation:'preview',id:d2});
  const key=pv.data.launch.split('/').pop();
  const red=await fetch(base+'/play/'+key,{headers:{Cookie:cookie},redirect:'manual'});
  check('Vorschau leitet auf Trailing-Slash-URL um',red.status===302&&red.headers.get('location')===`/play/${key}/`);
  const doc=await fetch(base+'/play/'+key+'/',{headers:{Cookie:cookie}});
  check('HTML-Dokument wird sandboxed ausgeliefert',doc.status===200&&(doc.headers.get('content-security-policy')||'').includes('sandbox allow-scripts')&&(await doc.text()).includes('js/g.js'));
  const js=await fetch(base+'/play/'+key+'/js/g.js',{headers:{Cookie:cookie}});
  check('Bundle-Asset wird ohne Cookie ausgeliefert',js.status===200&&(await js.text()).includes('window.X'));
  const noLaunch=await fetch(base+'/play/'+crypto.randomBytes(24).toString('hex')+'/js/g.js',{headers:{Cookie:cookie}});
  check('Unbekannter Launch liefert kein Asset',noLaunch.status===403||noLaunch.status===404);

  console.log(JSON.stringify({passed:checks.length,checks}));
 }finally{app.server.close()}
})().catch(e=>{console.error(e);process.exit(1)});
