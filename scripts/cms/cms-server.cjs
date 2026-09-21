const http=require('node:http'),fs=require('node:fs'),path=require('node:path'),crypto=require('node:crypto');
const envPath=path.join(__dirname,'..','..','.env');
if(fs.existsSync(envPath))for(const line of fs.readFileSync(envPath,'utf8').split(/\r?\n/)){
 const m=line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)\s*$/);
 if(m&&!(m[1] in process.env))process.env[m[1]]=m[2].replace(/^["']|["']$/g,'');
}
const {createCore,areaActive}=require('./cms-core.cjs');
const {createJsonStore}=require('./cms-store.cjs');
const {createAdmin}=require('./cms-admin.cjs');
const {createTraceStore}=require('./cms-trace.cjs');
const {loadLoginWorkflow}=require('./cms-login-workflow.cjs');
const {loadAdminWorkflow}=require('./cms-admin-workflow.cjs');
const {createProfile}=require('./cms-profile.cjs');
const {createUploads}=require('./cms-uploads.cjs');
const {createParent,enrollParent,enrollObserver}=require('./cms-parent.cjs');
const root=path.resolve(__dirname,'../..');
const {renderCms}=require('./cms-project.cjs');
const cmsFile=path.join(root,'game-server/public/projects/GCS-CMS.json');
function createServer({dataPath=path.join(root,'game-server/data/cms-v1.json')}={}){
 if(!fs.existsSync(dataPath)){fs.mkdirSync(path.dirname(dataPath),{recursive:true});fs.copyFileSync(path.join(__dirname,'cms-demo.json'),dataPath,fs.constants.COPYFILE_EXCL);}
 const store=createJsonStore({dataPath}),core=createCore(store.load()),launches=new Map(),attempts=new Map();
 const admin=createAdmin(core,dataPath,{store}),traces=createTraceStore(),loginWorkflow=loadLoginWorkflow(cmsFile,'stage_server_login');
 const adminWorkflow=loadAdminWorkflow(cmsFile,'stage_server_admin_login');
 const loginPage=()=>renderCms(cmsFile,'stage_admin_login');
 const profile=createProfile(core,store,cmsFile,'stage_server_profile');
 const uploads=createUploads(core,admin,store,cmsFile,'stage_server_uploads');
 const credentialPath=path.join(path.dirname(dataPath),'cms-admin-auth.json');
 const commit=(s,action,areaId,change)=>store.commit(core.db,{actor:s.personId,action,areaId},change);
 const parent=createParent(core,credentialPath,store,cmsFile,'stage_server_parent');
 parent.enroll=b=>enrollParent(core,credentialPath,b.ticket,b.username,b.password,commit);
 parent.enrollObserver=b=>enrollObserver(core,credentialPath,b.ticket,b.username,b.password,commit);
 const play=require('./cms-play.cjs').createPlay(core,store,cmsFile,'stage_server_play');
 const mp=require('./cms-mp.cjs').createMp(core,store,play,cmsFile,'stage_server_mp');
 const cookie=(req,name)=>(req.headers.cookie||'').split('; ').find(s=>s.startsWith(name+'='))?.slice(name.length+1);
 const accountCookie=token=>`cms_account=${token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=3600`;
 const slots=(items)=>Object.fromEntries(Array.from({length:4},(_,i)=>['slot'+i,items[i]||{id:'',label:'',visible:false}]));
 const reply=(res,code,data)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
 const server=http.createServer(async(req,res)=>{
  try{
   const url=new URL(req.url,'http://localhost');if(!/^(localhost|127\.0\.0\.1):\d+$/.test(req.headers.host||'')){res.writeHead(403);return res.end();}res.setHeader('Referrer-Policy','no-referrer');res.setHeader('X-Content-Type-Options','nosniff');
   if(req.method==='GET'&&url.pathname==='/api/cms/health')return reply(res,200,{ok:true,message:'🟢 CMS-Server erreichbar'});
   if(req.method==='GET'&&url.pathname==='/library'){
    res.setHeader('Content-Type','text/html; charset=utf-8');res.setHeader('Cache-Control','no-store');return res.end(admin.readSession(req)?renderCms(cmsFile,'stage_library'):loginPage());
   }
   if(req.method==='GET'&&url.pathname.startsWith('/avatars/')){
    const file=uploads.asset(url.pathname.slice(9));if(!file)return reply(res,404,{ok:false});res.writeHead(200,{'Content-Type':'image/png','Cache-Control':'public, max-age=86400'});return res.end(fs.readFileSync(file));
   }
   if(req.method==='POST'&&['/api/cms/upload/game','/api/cms/upload/avatar'].includes(url.pathname)){
    if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{ok:false,message:'Ungültiger Anfrageursprung.'});
    const trace=traces.begin(req,true);if(trace){trace.project='GCS-CMS.json';res.setHeader('X-GCS-Trace-ID',trace.id)}const emit=(label,data)=>traces.step(trace,label,data);
    emit('Request empfangen',{method:req.method,url:url.pathname,headers:req.headers,note:'Binärinhalt nicht protokolliert'});
    const result=await uploads.receive(req,url.pathname.endsWith('/game')?'game':'avatar',emit);emit('Response senden',{status:result.status,body:result.data});return reply(res,result.status,result.data);
   }
   if(req.method==='GET'&&url.pathname.startsWith('/api/cms/debug/traces/')){
    if(process.env.CMS_TRACE_ADMIN!=='off'){const actor=admin.readSession(req);if(!actor||!core.can(actor,'manageArea',{areaId:'root'}))return reply(res,403,{ok:false,message:'SuperAdmin-Anmeldung für Server-Diagnose erforderlich.'});}
    const trace=traces.get(url.pathname.slice('/api/cms/debug/traces/'.length));return reply(res,trace?200:404,trace||{ok:false,message:'Vorgang abgelaufen oder Diagnose ausgeschaltet.'});
   }
   if(req.method==='GET'&&['/admin','/house','/super'].includes(url.pathname)){res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
    return res.end(admin.readSession(req)?renderCms(cmsFile,{'/super':'stage_super','/house':'stage_house','/admin':'stage_admin'}[url.pathname]):loginPage());
   }
   // Eltern- und Beobachterbereich: Konto-Sitzung (cms_account), kein Admin-Cookie nötig.
   if(req.method==='GET'&&['/parent','/observer'].includes(url.pathname)){res.setHeader('Referrer-Policy','same-origin');
    res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
    const session=core.session(cookie(req,'cms_account'));
    return res.end(session?renderCms(cmsFile,{'/parent':'stage_parent','/observer':'stage_observer'}[url.pathname]):loginPage());
   }
   if(url.pathname==='/observer-enroll'&&['GET','POST'].includes(req.method)){
    res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
    if(req.method==='POST'){
     if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{error:'Fremder Ursprung'});
     let raw='';for await(const c of req){raw+=c;if(raw.length>2048)return reply(res,413,{error:'Zu groß'});}
     const result=parent.enrollObserver(Object.fromEntries(new URLSearchParams(raw)));
     res.statusCode=result.ok?200:400;return res.end('<!doctype html><meta charset="utf-8"><p>'+result.message+'</p><a href="/">Zum CMS</a>');
    }
    const ticket=url.searchParams.get('ticket')||'';if(!/^[a-f0-9]{64}$/.test(ticket)){res.statusCode=400;return res.end('Ungültiger Einladungslink.');}
    return res.end('<!doctype html><html lang="de"><meta charset="utf-8"><title>Beobachterzugang einrichten</title><style>body{background:#122b39;color:white;font:20px Segoe UI;max-width:540px;margin:10vh auto}input,button{display:block;width:100%;padding:14px;margin:12px 0;box-sizing:border-box;font:inherit}</style><h1>Beobachterzugang einrichten</h1><form method="post" action="/observer-enroll"><input type="hidden" name="ticket" value="'+ticket+'"><label>Benutzername<input name="username" required pattern="[a-zA-Z0-9_-]{3,40}" autocomplete="username"></label><label>Passwort (mindestens 12 Zeichen)<input name="password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"></label><button>Zugang anlegen</button></form></html>');
   }
   if(url.pathname==='/parent-enroll'&&['GET','POST'].includes(req.method)){
    res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
    if(req.method==='POST'){
     if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{error:'Fremder Ursprung'});
     let raw='';for await(const c of req){raw+=c;if(raw.length>2048)return reply(res,413,{error:'Zu groß'});}
     const result=parent.enroll(Object.fromEntries(new URLSearchParams(raw)));
     res.statusCode=result.ok?200:400;return res.end('<!doctype html><meta charset="utf-8"><p>'+result.message+'</p><a href="/">Zum CMS</a>');
    }
    const ticket=url.searchParams.get('ticket')||'';if(!/^[a-f0-9]{64}$/.test(ticket)){res.statusCode=400;return res.end('Ungültiger Einladungslink.');}
    return res.end('<!doctype html><html lang="de"><meta charset="utf-8"><title>Elternzugang einrichten</title><style>body{background:#122b39;color:white;font:20px Segoe UI;max-width:540px;margin:10vh auto}input,button{display:block;width:100%;padding:14px;margin:12px 0;box-sizing:border-box;font:inherit}</style><h1>Elternzugang einrichten</h1><form method="post" action="/parent-enroll"><input type="hidden" name="ticket" value="'+ticket+'"><label>Benutzername<input name="username" required pattern="[a-zA-Z0-9_-]{3,40}" autocomplete="username"></label><label>Passwort (mindestens 12 Zeichen)<input name="password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"></label><button>Zugang anlegen</button></form></html>');
   }
   if(url.pathname==='/admin-enroll'&&['GET','POST'].includes(req.method)){
    res.setHeader('Referrer-Policy','same-origin');res.setHeader('Cache-Control','no-store');res.setHeader('Content-Type','text/html; charset=utf-8');
    if(req.method==='POST'){
     if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{error:'Fremder Ursprung'});
     let raw='';for await(const c of req){raw+=c;if(raw.length>2048)return reply(res,413,{error:'Zu groß'});}
     const result=admin.enroll(Object.fromEntries(new URLSearchParams(raw)));
     res.statusCode=result.ok?200:400;return res.end('<!doctype html><meta charset="utf-8"><p>'+result.message+'</p><a href="/admin">Zur Verwaltung</a>');
    }
    const ticket=url.searchParams.get('ticket')||'';if(!/^[a-f0-9]{64}$/.test(ticket)){res.statusCode=400;return res.end('Ungültiger Einrichtungslink.');}
    return res.end('<!doctype html><html lang="de"><meta charset="utf-8"><title>Verwaltungszugang einrichten</title><style>body{background:#122b39;color:white;font:20px Segoe UI;max-width:540px;margin:10vh auto}input,button{display:block;width:100%;padding:14px;margin:12px 0;box-sizing:border-box;font:inherit}</style><h1>Verwaltungszugang einrichten</h1><form method="post" action="/admin-enroll"><input type="hidden" name="ticket" value="'+ticket+'"><label>Benutzername<input name="username" required pattern="[a-zA-Z0-9_-]{3,40}" autocomplete="username"></label><label>Passwort (mindestens 12 Zeichen)<input name="password" type="password" minlength="12" maxlength="200" required autocomplete="new-password"></label><button>Zugang anlegen</button></form></html>');
   }
   if(req.method==='POST'&&url.pathname==='/admin-login'){
    if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{error:'Fremder Ursprung'});
    let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>2048)return reply(res,413,{error:'Zu groß'});}
    const result=await admin.login(req,Object.fromEntries(new URLSearchParams(raw)));
    if(result.error){res.writeHead(401,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(loginPage());}
    const cookies=[];if(result.token)cookies.push(`cms_admin=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`);
    if(result.contexts?.some(c=>c!=='admin')||!result.token){const t=core.issueSession(result.personId,'account');if(t)cookies.push(accountCookie(t));}
    res.writeHead(303,{'Location':result.token?(result.super?'/super':'/admin'):(result.contexts||[]).includes('observer')?'/observer':'/parent','Set-Cookie':cookies,'Cache-Control':'no-store'});return res.end();
   }
   if(req.method==='GET'&&['/','/runtime-standalone.js','/cms-shell.js'].includes(url.pathname)){
    if(url.pathname==='/'){res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});return res.end(renderCms(cmsFile,'stage_main',url.searchParams.get('house')));}
    const file=url.pathname.slice(1);const location=file==='cms-shell.js'?path.join(__dirname,file):path.join(root,'public',file);
    res.writeHead(200,{'Content-Type':file.endsWith('.js')?'text/javascript; charset=utf-8':'text/html; charset=utf-8'});return res.end(fs.readFileSync(location));
   }
   if(req.method==='GET'&&url.pathname.startsWith('/play/')){
    const launch=launches.get(url.pathname.slice(6)),session=launch&&core.session(launch.token),game=launch&&core.db.games.find(g=>g.id===launch.gameId);
    if(!launch||!session||!core.can(session,'play',{game,areaId:launch.areaId}))return reply(res,403,{error:'Spiel nicht freigegeben'});
    // Erste Ausbaustufe: nur die zwei geprüften lokalen Lernprojekte; keine freien Uploads.
    const allowed={'snake':'Snake-Lernprojekt.json','breakout':'Breakout-Lernprojekt.json','game-mp':'ZahlenDuell.json'},uploaded=uploads.game(game);if(!uploaded&&(!allowed[game.id]||allowed[game.id]!==game.file))return reply(res,403,{error:'Projekt nicht zugelassen'});
    if(uploaded)res.setHeader('Content-Security-Policy',"sandbox allow-scripts; default-src 'none'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'unsafe-inline'; img-src data: blob:; media-src data: blob:; font-src data:; connect-src 'none'; base-uri 'none'; form-action 'none'");
    const project=JSON.parse(fs.readFileSync(uploaded||path.join(root,'game-server/public/projects',allowed[game.id]),'utf8'));
    const launchKey=url.pathname.slice(6);
    // Spiele erhalten ihren Launch-Schluessel als Projektvariable CMS_LAUNCH —
    // so koennen sie deklarative http-Actions gegen /api/cms/play und
    // /api/cms/party richten, ohne das Sitzungstoken zu kennen (E08).
    for(const st of project.stages||[])for(const v of st.variables||[])if(v.name==='CMS_LAUNCH')v.value=launchKey;
    const encoded=JSON.stringify(project).replace(/</g,'\\u003c');res.writeHead(200,{'Content-Type':'text/html; charset=utf-8','Cache-Control':'no-store'});
    // Zeitbuchung nach E06: die Seite meldet alle 30s einen Heartbeat mit ihrem
    // Launch-Schlüssel (begrenzte Berechtigung, kein Spieler-Token nötig).
    // window.CMS.report() erlaubt Spielen optionale Bewertungsmeldungen (E07).
    // Hinweis: hochgeladene Spiele laufen sandboxed mit connect-src 'none' —
    // Heartbeats gelten nur für geprüfte Referenzspiele.
    const heart='<script>(function(){var K='+JSON.stringify(launchKey)+',overlay=null;'
     +'function note(t,c){if(!overlay){overlay=document.createElement("div");overlay.style.cssText="position:fixed;inset:0;background:rgba(8,21,27,.92);color:#edf7f4;display:flex;align-items:center;justify-content:center;font:28px Segoe UI;z-index:99999;text-align:center";document.body.appendChild(overlay)}overlay.textContent=t;overlay.style.color=c||"#edf7f4"}'
     +'function send(a,x){return fetch("/api/cms/play",{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(Object.assign({launchKey:K,action:a},x||{}))}).then(function(r){return r.json()}).catch(function(){return{ok:false}})}'
     +'window.CMS={report:function(m,v,u){return send("progress",{eventId:crypto.randomUUID(),metric:m,value:v,unit:u,schemaVersion:1})},end:function(){return send("end")}};'
     +'setInterval(function(){send("heartbeat").then(function(r){if(!r.ok)return;if(r.warn==="5min")note("Noch 5 Minuten","#ffd166");if(r.warn==="1min")note("Noch 1 Minute","#ef8354");if(r.warn==="grace")note("Zeit um — wird gespeichert","#ef8354");if(r.ended||r.status==="ended")note("Zeit für heute ist um. Gut gemacht!","#edf7f4")})},30000);'
     +'addEventListener("pagehide",function(){navigator.sendBeacon("/api/cms/play",new Blob([JSON.stringify({launchKey:K,action:"end"})],{type:"application/json"}))});'
     +'})();</script>';
    return res.end('<!doctype html><meta charset="utf-8"><style>html,body{margin:0;overflow:hidden;background:#08151b}#run-stage{position:absolute;transform-origin:top left}</style><main id="run-stage"></main><script>window.PROJECT='+encoded+'</script>'+heart+'<script src="/runtime-standalone.js"></script><script>document.addEventListener("DOMContentLoaded",()=>window.startStandalone(window.PROJECT))</script>');
   }
   if(req.method!=='POST'||!url.pathname.startsWith('/api/cms/'))return reply(res,404,{error:'Nicht gefunden'});
   if(req.headers.origin&&req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{error:'Fremder Ursprung'});
   let raw='';for await(const chunk of req){raw+=chunk;if(raw.length>8192)return reply(res,413,{error:'Anfrage zu groß'});}let body;try{body=JSON.parse(raw||'{}');}catch{return reply(res,400,{error:'Ungültiges JSON'});}
   if(url.pathname==='/api/cms/admin-login'){
    if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{ok:false,message:'Ungültiger Anfrageursprung.'});
    const trace=traces.begin(req,adminWorkflow.endpoint.traceEnabled!==false);if(trace){trace.project='GCS-CMS.json';res.setHeader('X-GCS-Trace-ID',trace.id);}
    const emit=(label,data)=>traces.step(trace,label,data);emit('Request empfangen',{method:req.method,url:url.pathname,headers:req.headers,body});
    const result=await adminWorkflow.run(admin,req,body,emit);
    // Ein gemeinsamer Erwachsenen-Login (E01): Verwaltung bekommt cms_admin,
    // jede angemeldete Person mit Eltern-/Beobachterkontext zusätzlich
    // cms_account — der Kontextwechsel vergibt keine Rechte, nur Sichten.
    const cookies=[];
    if(result.token)cookies.push(`cms_admin=${result.token}; HttpOnly; SameSite=Strict; Path=/; Max-Age=1800`);
    if(result.personId&&result.contexts?.length){
     const accountToken=core.issueSession(result.personId,'account');
     if(accountToken){cookies.push(accountCookie(accountToken));
      // Flache Flags, damit GCS-Bedingungen (Variable == true) direkt prüfen können.
      result.data={...result.data,ok:true,contexts:result.contexts,admin:result.contexts.includes('admin'),parent:result.contexts.includes('parent'),observer:result.contexts.includes('observer'),super:!!result.super};
      if(!result.token)result.data.message='Angemeldet.';}
    }
    if(cookies.length)res.setHeader('Set-Cookie',cookies);
    res.once('finish',()=>emit('Response gesendet',{status:200,headers:res.getHeaders(),body:result.data}));
    return reply(res,200,result.data);
   }
   if(url.pathname==='/api/cms/upload-library')return reply(res,200,uploads.library(req,body));
   if(url.pathname.startsWith('/api/cms/admin/')){
    if(req.headers.origin!==`http://${req.headers.host}`)return reply(res,403,{ok:false,message:'Ungültiger Anfrageursprung.'});
    if(['true','false','1','0'].includes(body.active))body.active=body.active==='true'||body.active==='1';
    if(body.confirm==='true')body.confirm=true;
    const result=admin.api(req,url.pathname.slice('/api/cms/admin/'.length),body);
    if(result.data.link)result.data.link=`http://${req.headers.host}${result.data.link}`;
    if(result.data.items){const items=result.data.items;const page=Math.max(0,Math.min(Number.isInteger(Number(body.page))?Number(body.page):0,Math.max(0,Math.ceil(items.length/4)-1)));Object.assign(result.data,{page,pages:Math.ceil(items.length/4),total:items.length},slots(items.slice(page*4,page*4+4).map(i=>({...i,label:(url.pathname.endsWith('/rooms')?'':i.active?'✓  ':'○  ')+i.label,visible:true,next:!i.active}))));}
    return reply(res,result.status,result.data);
   }
   if(url.pathname==='/api/cms/login'){
    const key=req.socket.remoteAddress,now=Date.now();if(attempts.size>1000)attempts.clear();let limit=attempts.get(key);if(!limit||now-limit.time>60000){limit={time:now,n:0};attempts.set(key,limit);}if(++limit.n>20)return reply(res,429,{ok:false,message:'⏳ Bitte kurz warten'});
    const trace=traces.begin(req,loginWorkflow.endpoint.traceEnabled!==false);if(trace){trace.project='GCS-CMS.json';res.setHeader('X-GCS-Trace-ID',trace.id);}
    const emit=(label,data)=>traces.step(trace,label,data);
    emit('Request empfangen',{method:req.method,path:url.pathname,headers:req.headers,body});
    const result=loginWorkflow.run(core,body,emit);
    res.once('finish',()=>emit('Response gesendet',{status:200,headers:{'Content-Type':'application/json; charset=utf-8','X-GCS-Trace-ID':trace?.id},body:result}));
    return reply(res,200,result);
   }
   // Sitzungssteuerung aus der /play-Seite: Der Launch-Schlüssel ist die
   // begrenzte Berechtigung (E08) — die Seite kennt kein Spieler-Token.
   // Diese Endpunkte stehen bewusst VOR dem allgemeinen Sitzungscheck.
   if(url.pathname==='/api/cms/play'){
    const launch=launches.get(body.launchKey);const ps=launch&&core.session(launch.token);
    if(!launch||!ps)return reply(res,401,{ok:false,message:'Spielsitzung abgelaufen.'});
    if(typeof body.action!=='string')return reply(res,400,{ok:false,message:'Aktion fehlt.'});
    const result=play.api(ps,body.action,{...body,playSessionId:launch.playSessionId});
    if(result.status===200&&result.data.status==='ended')launches.delete(body.launchKey);
    return reply(res,result.status,result.data);
   }
   // Mehrspieler aus dem Spiel heraus (P4.5): areaId kommt aus dem
   // Launch-Grant, nie vom Client.
   if(url.pathname==='/api/cms/party'){
    const launch=launches.get(body.launchKey);const ps=launch&&core.session(launch.token);
    if(!launch||!ps)return reply(res,401,{ok:false,message:'Spielsitzung abgelaufen.'});
    if(typeof body.op!=='string')return reply(res,400,{ok:false,message:'Aktion fehlt.'});
    const result=mp.api(ps,body.op,{...body,areaId:launch.areaId});
    return reply(res,result.status,result.data);
   }
   // Kontexte der aktuellen Anmeldung — steuert nur die Sichtbarkeit der
   // Bereichsnavigation (kein Recht; Server prüft weiterhin jede Aktion).
   // Liefert immer 200, damit Stages ohne Sitzung schlicht keine Zusatz-
   // navigation anzeigen.
   if(url.pathname==='/api/cms/contexts'){
    const adminS=admin.readSession(req),accS=core.session(cookie(req,'cms_account'));
    const personId=adminS?.personId||accS?.personId;
    const person=personId&&core.db.people.find(p=>p.id===personId&&p.active);
    const flags={admin:false,house:false,super:false,parent:false,observer:false};
    if(person){
     const role=(r,areaId)=>core.db.roles.some(x=>x.personId===personId&&x.role===r&&x.areaId===areaId&&x.active&&areaActive(core.db,x.areaId));
     if(adminS){flags.super=role('superAdmin','root');flags.admin=flags.super||core.db.roles.some(r=>r.personId===personId&&r.role==='areaAdmin'&&r.active&&areaActive(core.db,r.areaId));flags.house=flags.super||core.db.roles.some(r=>r.personId===personId&&r.role==='areaAdmin'&&r.active&&core.db.areas.find(a=>a.id===r.areaId)?.type==='house'&&areaActive(core.db,r.areaId));}
     flags.parent=!!accS&&core.childrenOf(personId).length>0;
     flags.observer=!!accS&&core.db.roles.some(r=>r.personId===personId&&r.role==='observer'&&r.active&&areaActive(core.db,r.areaId));
     flags.verwaltung=flags.admin||flags.house;
    }
    return reply(res,200,{ok:true,...flags,name:person?.name||''});
   }
   const session=core.session(body.token||cookie(req,'cms_account'));if(!session)return reply(res,401,{ok:false,message:'🔑 Bitte neu anmelden'});
   if(url.pathname.startsWith('/api/cms/profile/')){
    const trace=traces.begin(req,true);if(trace){trace.project='GCS-CMS.json';res.setHeader('X-GCS-Trace-ID',trace.id);}
    const emit=(label,data)=>traces.step(trace,label,data);emit('Request empfangen',{method:req.method,url:url.pathname,body});
    const result=profile(session,url.pathname.slice('/api/cms/profile/'.length),body,emit);emit('Response senden',{status:200,body:result});return reply(res,200,result);
   }
   if(url.pathname.startsWith('/api/cms/parent/')){const result=parent.api(session,url.pathname.slice('/api/cms/parent/'.length),body);return reply(res,result.status,result.data);}
   if(url.pathname.startsWith('/api/cms/mp/')){const result=mp.api(session,url.pathname.slice('/api/cms/mp/'.length),body);return reply(res,result.status,result.data);}
   if(url.pathname==='/api/cms/logout'){core.logout(body.token);for(const [key,l]of launches)if(l.token===body.token)launches.delete(key);return reply(res,200,{ok:true});}
   if(url.pathname==='/api/cms/rooms'){
    const list=core.rooms(session.personId),page=Math.max(0,Math.min(Number.isInteger(Number(body.page))?Number(body.page):0,Math.max(0,Math.ceil(list.length/4)-1)));
    return reply(res,200,{ok:true,page,pages:Math.ceil(list.length/4),total:list.length,items:list.slice(page*4,page*4+4).map(r=>({id:r.id,name:r.name,avatar:r.avatar||'🚪',active:r.active})),...slots(list.slice(page*4,page*4+4).map(r=>({id:r.id,label:r.avatar+'  '+r.name,visible:true}))),message:'🚪 Wähle deinen Raum'});
   }
   if(url.pathname==='/api/cms/games'){
    if(!core.rooms(session.personId).some(r=>r.id===body.areaId))return reply(res,403,{ok:false,message:'⛔ Raum nicht freigegeben'});
    const list=core.db.games.filter(game=>core.can(session,'play',{game,areaId:body.areaId})),page=Math.max(0,Math.min(Number.isInteger(Number(body.page))?Number(body.page):0,Math.max(0,Math.ceil(list.length/4)-1)));
    return reply(res,200,{ok:true,page,pages:Math.ceil(list.length/4),...slots(list.slice(page*4,page*4+4).map(g=>({id:g.id,label:g.avatar+'  '+g.title,visible:true}))),message:list.length?'🎮 Wähle ein Spiel':'🌱 Hier kommen bald Spiele dazu'});
   }
   if(url.pathname==='/api/cms/launch'){
    // Launch = Spielsitzungsbeginn (E06): Budget, Einzelsitzung und
    // Zeitbuchung werden hier erzwungen, nicht erst im Player.
    const started=play.api(session,'start',body);if(!started.data.ok)return reply(res,started.status,started.data);
    for(const [key,l]of launches)if(!core.session(l.token))launches.delete(key);const key=crypto.randomBytes(24).toString('hex');
    launches.set(key,{token:body.token,gameId:body.gameId,areaId:body.areaId,playSessionId:started.data.playSessionId});
    return reply(res,200,{ok:true,launch:'/play/'+key,...started.data,message:'▶'});
   }
   return reply(res,404,{ok:false,message:'Funktion noch nicht verfügbar'});
  }catch(error){console.error('[CMS]',error.message);if(!res.headersSent)reply(res,500,{ok:false,message:'⚠ Bitte erneut versuchen'});else res.end();}
 });return {server,core};
}
if(require.main===module){const {server}=createServer();server.listen(Number(process.env.CMS_PORT||8081),'127.0.0.1',()=>console.log('GCS-CMS: http://localhost:'+(process.env.CMS_PORT||8081)));}
module.exports={createServer};
