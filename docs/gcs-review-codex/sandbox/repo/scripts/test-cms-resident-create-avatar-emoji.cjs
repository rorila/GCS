const fs=require('node:fs'),path=require('node:path'),os=require('node:os'),crypto=require('node:crypto'),assert=require('node:assert/strict');
const {test}=require('node:test');
const sharp=require('sharp');
const ROOT=path.resolve(__dirname,'..');
const {createServer}=require(path.join(ROOT,'scripts/cms/cms-server.cjs'));
const {buildDb}=require(path.join(ROOT,'scripts/cms/cms-seed-testdata.cjs'));
const {AVATAR_PRESET_LIST,EMOJI_GLYPHS}=require(path.join(ROOT,'scripts/cms/cms-core.cjs'));
const {checkIntegrity}=require(path.join(ROOT,'scripts/cms/cms-project.cjs'));

async function withServer(fn){
 const dir=fs.mkdtempSync(path.join(os.tmpdir(),'gcs-resident-avatar-'));
 const dataPath=path.join(dir,'cms.json'),authPath=path.join(dir,'cms-admin-auth.json'),uploadDir=path.join(dir,'uploads');
 const prevUploadDir=process.env.CMS_UPLOAD_DIR;
 process.env.CMS_UPLOAD_DIR=uploadDir;
 fs.writeFileSync(dataPath,JSON.stringify(buildDb()));
 const password='Sicheres-Testpasswort-2026!',salt=crypto.randomBytes(16).toString('hex');
 const credential=(username,personId)=>({username,personId,salt,hash:crypto.scryptSync(password,salt,64).toString('hex')});
 fs.writeFileSync(authPath,JSON.stringify([
  credential('hausadmin','admin-sun'),
  credential('eltern','admin-parent')
 ]));
 const app=createServer({dataPath});
 await new Promise(r=>app.server.listen(0,'127.0.0.1',r));
 const port=app.server.address().port,base=`http://127.0.0.1:${port}`;
 const login=async username=>{
  const r=await fetch(base+'/admin-login',{method:'POST',headers:{Origin:base,'Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams({username,password}),redirect:'manual'});
  return(r.headers.getSetCookie?.()||[r.headers.get('set-cookie')||'']).map(c=>c.split(';')[0]).filter(Boolean).join('; ');
 };
 const post=async(route,body={},cookie='')=>{
  const r=await fetch(base+'/api/cms/'+route,{method:'POST',headers:{Origin:base,'Content-Type':'application/json',Cookie:cookie},body:JSON.stringify(body)});
  return{status:r.status,data:await r.json()};
 };
 const upload=async(endpoint,bytes,meta={},cookie='')=>{
  const r=await fetch(base+endpoint,{method:'POST',headers:{Origin:base,'Content-Type':'application/octet-stream','X-Upload-Metadata':encodeURIComponent(JSON.stringify(meta)),Cookie:cookie},body:bytes});
  return{status:r.status,data:await r.json()};
 };
 try{
  await fn({app,base,uploadDir,login,post,upload});
 }finally{
  if(prevUploadDir===undefined)delete process.env.CMS_UPLOAD_DIR;else process.env.CMS_UPLOAD_DIR=prevUploadDir;
  await new Promise(r=>app.server.close(r));
  fs.rmSync(dir,{recursive:true,force:true});
 }
}

test('Standardbild-Katalog: alle Presets existieren physisch und werden über GET /images/... ausgeliefert',async()=>{
 await withServer(async({base})=>{
  assert.equal(AVATAR_PRESET_LIST.length,9,'8 Tiermotive + 1 Standardavatar erwartet');
  for(const preset of AVATAR_PRESET_LIST){
   const res=await fetch(base+preset.src);
   assert.equal(res.status,200,`Standardbild ${preset.id} (${preset.src}) nicht abrufbar`);
   const buf=Buffer.from(await res.arrayBuffer());
   assert.ok(buf.length>50,`Standardbild ${preset.id} ist leer`);
  }
 });
});

test('Anlage mit Standardbild, neutrale Avatar-Kompatibilität, Verbot freier Dateipfade und Emoji-Login',async()=>{
 await withServer(async({app,login,post})=>{
  const cookie=await login('hausadmin');
  // 1) Anlage mit Standardbild 'fox' und wiederholten Emojis
  const resFox=await post('admin/house-person-create',{
   houseId:'house-sun',name:'Fuchskind',kind:'child',avatarPresetId:'fox',sequenceText:'🐶,🐶,🌳,🏠',requestId:'req-fox-1'
  },cookie);
  assert.equal(resFox.status,200);
  assert.equal(resFox.data.avatarImage,'/images/Avatars_allgemein/Fuchs.svg');
  const personFox=app.core.db.people.find(p=>p.id===resFox.data.id);
  assert.equal(personFox.avatar,'🙂','Kompatibilitätsfeld avatar muss neutralen Wert erhalten');
  assert.equal(personFox.avatarImage,'/images/Avatars_allgemein/Fuchs.svg');

  // 2) Anlage ohne avatarPresetId nutzt neutralen Standardavatar
  const resDef=await post('admin/house-person-create',{
   houseId:'house-sun',name:'Standardkind',kind:'adult',sequence:['owl','flower','pig','cat']
  },cookie);
  assert.equal(resDef.status,200);
  assert.equal(resDef.data.avatarImage,'/images/default-avatar.svg');
  const personDef=app.core.db.people.find(p=>p.id===resDef.data.id);
  assert.equal(personDef.kind,'adult');
  assert.equal(personDef.avatarImage,'/images/default-avatar.svg');

  // 3) Ungültige Preset-ID und direkt übergebene Dateipfade werden abgewiesen
  const badPreset=await post('admin/house-person-create',{
   houseId:'house-sun',name:'Test',kind:'child',avatarPresetId:'../../etc/passwd',sequence:['dog','cat','tree','owl']
  },cookie);
  assert.equal(badPreset.status,400);
  const directPath=await post('admin/house-person-create',{
   houseId:'house-sun',name:'Test',kind:'child',avatarImage:'/images/Avatars_allgemein/Affe.png',sequence:['dog','cat','tree','owl']
  },cookie);
  assert.equal(directPath.status,400);

  // 4) Emoji-Login mit dem neuen Passwort funktioniert
  const loginRes=await post('login',{sequence:['🐶','🐶','🌳','🏠']});
  assert.equal(loginRes.status,200);
  assert.equal(loginRes.data.ok,true);
  assert.equal(loginRes.data.name,'Fuchskind');
 });
});

test('Gemeinsame Anlage mit eigenem Bild, Darstellungswege (Liste, Detail, Eltern) und Fehlerfälle',async()=>{
 await withServer(async({app,base,uploadDir,login,post,upload})=>{
  const cookie=await login('hausadmin');
  const validPng=await sharp({create:{width:64,height:64,channels:4,background:{r:40,g:160,b:140,alpha:1}}}).png().toBuffer();

  // 1) Erfolgreiche Anlage mit eigenem Bild
  const created=await upload('/api/cms/upload/resident-avatar',validPng,{
   houseId:'house-sun',name:'Bildkind',kind:'child',sequenceText:'elephant,owl,flower,pig',requestId:'req-upload-1'
  },cookie);
  assert.equal(created.status,200);
  assert.ok(created.data.id?.startsWith('person-'));
  assert.match(created.data.avatarImage,/^\/avatars\/[a-f0-9-]{36}\.png$/);

  // Bild ist über /avatars/... abrufbar
  const imgFetch=await fetch(base+created.data.avatarImage);
  assert.equal(imgFetch.status,200);

  // 2) Bewohnerliste, Detailansicht und Elternübersicht liefern das gespeicherte Bild
  const listRes=await post('admin/house-people',{houseId:'house-sun'},cookie);
  const inList=listRes.data.items.find(i=>i.id===created.data.id);
  assert.equal(inList?.avatarImage,created.data.avatarImage);

  const detailRes=await post('admin/house-person-detail',{houseId:'house-sun',personId:created.data.id},cookie);
  assert.equal(detailRes.status,200);
  assert.equal(detailRes.data.person.avatarImage,created.data.avatarImage);

  await post('admin/guardian-set',{houseId:'house-sun',childId:created.data.id,guardianId:'admin-parent',active:true},cookie);
  const parentCookie=await login('eltern');
  const parentRes=await post('parent/my-children',{},parentCookie);
  assert.equal(parentRes.status,200);
  const inParent=(parentRes.data.items||parentRes.data.children||[]).find(c=>c.id===created.data.id);
  assert.equal(inParent?.avatarImage,created.data.avatarImage);

  // 3) Bereits vergebenes Emoji-Passwort -> 409, keine neue Datei im Upload-Ordner
  const filesBefore=fs.readdirSync(uploadDir).length;
  const dupRes=await upload('/api/cms/upload/resident-avatar',validPng,{
   houseId:'house-sun',name:'Zweitkind',kind:'child',sequenceText:'elephant,owl,flower,pig',requestId:'req-upload-dup'
  },cookie);
  assert.equal(dupRes.status,409);
  assert.equal(fs.readdirSync(uploadDir).length,filesBefore,'Bei abgelehntem Passwort darf keine Bilddatei entstehen');

  // 4) Fehlende Berechtigung für fremdes Haus -> 403
  const forbidden=await upload('/api/cms/upload/resident-avatar',validPng,{
   houseId:'house-moon',name:'Mondkind',kind:'child',sequenceText:'dog,cat,owl,pig'
  },cookie);
  assert.equal(forbidden.status,403);

  // 5) Ungültige Datei -> 400, zu große Datei -> 413
  const badFile=await upload('/api/cms/upload/resident-avatar',Buffer.from('kein-bild'),{
   houseId:'house-sun',name:'Fehlerkind',kind:'child',sequenceText:'dog,cat,owl,pig'
  },cookie);
  assert.equal(badFile.status,400);

  const hugeFile=Buffer.alloc(2097152+100,0x89);
  const tooBig=await upload('/api/cms/upload/resident-avatar',hugeFile,{
   houseId:'house-sun',name:'Grosskind',kind:'child',sequenceText:'dog,cat,owl,pig'
  },cookie);
  assert.equal(tooBig.status,413);
 });
});

test('Idempotenz (requestId), Dateibereinigung bei Commit-Fehler und Schutz zugeordneter/laufender Uploads',async()=>{
 await withServer(async({app,uploadDir,login,post,upload})=>{
  const cookie=await login('hausadmin');
  const validPng=await sharp({create:{width:48,height:48,channels:4,background:{r:100,g:120,b:200,alpha:1}}}).png().toBuffer();

  // 1) Wiederholte Anfrage nach Verbindungsfehler (Standardbild) legt keinen zweiten Bewohner an
  const count0=app.core.db.people.length;
  const first=await post('admin/house-person-create',{
   houseId:'house-sun',name:'IdemKind',kind:'child',avatarPresetId:'panda',sequenceText:'cat,cat,owl,pig',requestId:'req-idem-std-1'
  },cookie);
  assert.equal(first.status,200);
  const retry=await post('admin/house-person-create',{
   houseId:'house-sun',name:'IdemKind',kind:'child',avatarPresetId:'panda',sequenceText:'cat,cat,owl,pig',requestId:'req-idem-std-1'
  },cookie);
  assert.equal(retry.status,200);
  assert.equal(retry.data.id,first.data.id);
  assert.equal(app.core.db.people.length,count0+1);

  // Abweichende Daten unter derselben requestId -> 409
  const conflict=await post('admin/house-person-create',{
   houseId:'house-sun',name:'AnderesKind',kind:'child',avatarPresetId:'panda',sequenceText:'cat,cat,owl,dog',requestId:'req-idem-std-1'
  },cookie);
  assert.equal(conflict.status,409);

  // 2) Wiederholte Anfrage beim Eigenbild-Upload legt weder zweiten Bewohner noch zweite Datei an
  const up1=await upload('/api/cms/upload/resident-avatar',validPng,{
   houseId:'house-sun',name:'IdemUploadKind',kind:'child',sequenceText:'tree,tree,owl,pig',requestId:'req-idem-up-1'
  },cookie);
  assert.equal(up1.status,200);
  const filesAfterFirst=fs.readdirSync(uploadDir);
  const up2=await upload('/api/cms/upload/resident-avatar',validPng,{
   houseId:'house-sun',name:'IdemUploadKind',kind:'child',sequenceText:'tree,tree,owl,pig',requestId:'req-idem-up-1'
  },cookie);
  assert.equal(up2.status,200);
  assert.equal(up2.data.id,up1.data.id);
  assert.equal(up2.data.avatarImage,up1.data.avatarImage);
  assert.deepEqual(fs.readdirSync(uploadDir),filesAfterFirst);

  // 3) Commit-Fehler beim Eigenbild-Upload entfernt die geschriebene PNG-Datei sofort
  const origCommit=app.store.commit;
  app.store.commit=()=>{throw Error('Simulierter Speicherfehler');};
  try{
   const failed=await upload('/api/cms/upload/resident-avatar',validPng,{
    houseId:'house-sun',name:'RollbackKind',kind:'child',sequenceText:'flower,flower,owl,pig',requestId:'req-rollback-1'
   },cookie);
   assert.equal(failed.status,500);
  }finally{
   app.store.commit=origCommit;
  }
  assert.deepEqual(fs.readdirSync(uploadDir),filesAfterFirst,'Geschriebene Bilddatei muss bei Commit-Fehler gelöscht werden');

  // 4) Gezielte Bereinigung verwaister Dateien schützt zugeordnete Bilder und laufende Uploads
  const orphanName=crypto.randomUUID()+'.png',inFlightName=crypto.randomUUID()+'.png';
  fs.writeFileSync(path.join(uploadDir,orphanName),validPng);
  fs.writeFileSync(path.join(uploadDir,inFlightName),validPng);
  app.uploads.beginWrite(inFlightName);
  try{
   const cleaned=app.uploads.cleanupOrphanAvatars({maxAgeMs:0});
   assert.ok(cleaned.removed.includes(orphanName),'Verwaiste Datei muss bereinigt werden');
   assert.ok(!fs.existsSync(path.join(uploadDir,orphanName)));
   assert.ok(fs.existsSync(path.join(uploadDir,inFlightName)),'In-Flight-Upload muss geschützt bleiben');
   const assignedFile=up1.data.avatarImage.slice(9);
   assert.ok(fs.existsSync(path.join(uploadDir,assignedFile)),'Zugeordnetes Bewohnerbild muss geschützt bleiben');
  }finally{
   app.uploads.endWrite(inFlightName);
   if(fs.existsSync(path.join(uploadDir,inFlightName)))fs.unlinkSync(path.join(uploadDir,inFlightName));
  }
 });
});

test('Stage-Struktur stage_house_residents: visuelles Formular ohne Texteingabe für Avatar oder Passwortsymbole',()=>{
 const project=JSON.parse(fs.readFileSync(path.join(ROOT,'game-server/public/projects/GCS-CMS.json'),'utf8'));
 const stage=project.stages.find(s=>s.id==='stage_house_residents');
 assert.ok(stage,'stage_house_residents fehlt');
 const byName=name=>stage.objects.find(o=>o.name===name);

 // Alte Texteingaben für Avatar und Emoji-Code sind abgelöst
 assert.equal(byName('BewohnerAvatar'),undefined,'Altes Textfeld BewohnerAvatar darf nicht mehr vorhanden sein');
 assert.equal(byName('BewohnerCode'),undefined,'Altes Textfeld BewohnerCode darf nicht mehr vorhanden sein');

 // Neue visuelle Komponenten sind vorhanden und korrekt konfiguriert
 assert.equal(byName('BewohnerName')?.className,'TEdit');
 assert.equal(byName('ArtKindBtn')?.className,'TButton');
 assert.equal(byName('ArtErwachsenBtn')?.className,'TButton');
 assert.equal(byName('AvatarVorschau')?.className,'TImage');
 assert.equal(byName('AvatarVorschau')?.src,'/images/default-avatar.svg');
 assert.equal(byName('StandardAvatarGalerie')?.className,'TTable');
 assert.equal(byName('StandardAvatarListe')?.records?.length,9);
 assert.equal(byName('AnlageAvatarDatei')?.className,'TFilePicker');
 assert.equal(byName('AnlageAvatarUpload')?.className,'TFileUpload');
 assert.equal(byName('AnlageAvatarUpload')?.endpoint,'/api/cms/upload/resident-avatar');

 const picker=byName('PasswortEmojiPicker');
 assert.equal(picker?.className,'TEmojiPicker');
 assert.deepEqual(picker?.emojis,EMOJI_GLYPHS);
 for(const pos of ['PasswortPos1','PasswortPos2','PasswortPos3','PasswortPos4','PasswortLetztesEntfernen','PasswortZuruecksetzen','BewohnerAnlegen']){
  assert.equal(byName(pos)?.className,'TButton',`${pos} fehlt`);
 }
 assert.equal(stage.variables.find(v=>v.name==='FormularBereit')?.defaultValue,false,'FormularBereit muss initial false sein');

 const issues=checkIntegrity(project).filter(i=>['stage_house_residents','stage_house_resident_detail','stage_server_house','stage_server_uploads'].includes(i.stage));
 assert.deepEqual(issues,[]);
});

test('Browser-Abnahme stage_house_residents: Avatar-Vorschau, 4-Positionen-Emoji-Editor (Ersetzen/Entfernen/Reset), Fehlererhalt und Anlage',async()=>{
 const {chromium}=require(path.join(ROOT,'node_modules/playwright'));
 await withServer(async({app,base,login})=>{
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
   const page=await browser.newPage({viewport:{width:1280,height:960}});
   const errors=[];
   page.on('pageerror',e=>errors.push(e.message));
   const cookie=await login('hausadmin');
   const [name,val]=cookie.split('=');
   await page.context().addCookies([{name,value:val,url:base}]);
   await page.goto(base+'/house?house=house-sun');
   await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_house_overview');

   const clickObj=name=>page.evaluate(n=>{
    const r=window.player.runtime,o=r.getObjects().find(x=>x.name===n);
    if(!o)throw Error('Objekt fehlt: '+n);
    r.handleEvent(o.id,'onClick');
   },name);
   const pickEmoji=emoji=>page.evaluate(em=>{
    const r=window.player.runtime,p=r.getObjects().find(x=>x.name==='PasswortEmojiPicker');
    p.selectedEmoji=em;
    r.handleEvent(p.id,'onSelect',em);
   },emoji);
   const pickPreset=presetId=>page.evaluate(id=>{
    const r=window.player.runtime;
    const list=r.getObjects().find(x=>x.name==='StandardAvatarListe');
    const gal=r.getObjects().find(x=>x.name==='StandardAvatarGalerie');
    const idx=list.records.findIndex(x=>x.id===id);
    gal.selectedIndex=idx;gal.selectedKey=id;gal.selectedRecord=list.records[idx];
    r.handleEvent(gal.id,'onRowClick',{index:idx,data:list.records[idx],key:id});
   },presetId);
   const state=()=>page.evaluate(()=>{
    const r=window.player.runtime,g=n=>r.getObjects().find(x=>x.name===n);
    return{
     name:g('BewohnerName')?.text,
     art:g('GewaehlteArt')?.value,
     presetId:g('GewaehlterPresetId')?.value,
     vorschau:g('AvatarVorschau')?.src,
     pos:[g('PasswortPos1')?.text,g('PasswortPos2')?.text,g('PasswortPos3')?.text,g('PasswortPos4')?.text],
     folge:g('PasswortFolge')?.value,
     anzahl:g('PasswortAnzahl')?.value,
     bereit:g('FormularBereit')?.value,
     status:g('Status')?.text
    };
   });

   await clickObj('Navigation_stage_house_residents');
   await page.waitForFunction(()=>window.player?.runtime?.stage?.id==='stage_house_residents'&&window.player.runtime.getObjects().find(o=>o.name==='BewohnerListe')?.records?.length>0&&window.player.runtime.getObjects().find(o=>o.name==='Busy')?.value===0);

   // 1) Initialzustand: neutraler Standardavatar vorausgewählt, 4 leere Positionen
   let s=await state();
   assert.equal(s.vorschau,'/images/default-avatar.svg');
   assert.deepEqual(s.pos,['1: —','2: —','3: —','4: —']);
   assert.equal(s.bereit,false);

   // 2) Standardbild „Fuchs“ wählen -> Vorschau aktualisiert
   await pickPreset('fox');
   s=await state();
   assert.equal(s.presetId,'fox');
   assert.equal(s.vorschau,'/images/Avatars_allgemein/Fuchs.svg');

   // 3) Vier Emojis wählen + 5. Klick überschreibt nichts ohne aktivierte Position
   await pickEmoji('🐶');
   await pickEmoji('🌳');
   await pickEmoji('🏠');
   await pickEmoji('🐘');
   await pickEmoji('🐷'); // darf nicht angehängt werden
   s=await state();
   assert.deepEqual(s.pos,['1: 🐶','2: 🌳','3: 🏠','4: 🐘']);
   assert.equal(s.folge,'dog,tree,house,elephant');

   // 4) Position 2 anklicken und durch 🐱 ersetzen
   await clickObj('PasswortPos2');
   s=await state();
   assert.equal(s.pos[1],'2: 🌳 ✎');
   await pickEmoji('🐱');
   s=await state();
   assert.deepEqual(s.pos,['1: 🐶','2: 🐱','3: 🏠','4: 🐘']);
   assert.equal(s.folge,'dog,cat,house,elephant');

   // 5) „Letztes entfernen“ und wieder auffüllen
   await clickObj('PasswortLetztesEntfernen');
   s=await state();
   assert.equal(s.pos[3],'4: —');
   assert.equal(s.anzahl,3);

   // 6) „Zurücksetzen“ leert die gesamte Folge
   await clickObj('PasswortZuruecksetzen');
   s=await state();
   assert.deepEqual(s.pos,['1: —','2: —','3: —','4: —']);
   assert.equal(s.anzahl,0);

   // 7) Bereits vergebenes Emoji-Passwort (Lina in buildDb: dog,cat,tree,house): Eingaben bleiben bei Fehler erhalten
   await page.getByPlaceholder('Anzeigename',{exact:true}).fill('Konfliktkind');
   for(const em of ['🐶','🐱','🌳','🏠'])await pickEmoji(em);
   await clickObj('BewohnerAnlegen');
   await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Busy')?.value===0&&window.player.runtime.getObjects().find(o=>o.name==='Status')?.text!=='Bewohner wird angelegt …');
   s=await state();
   assert.match(s.status,/bereits vergeben/);
   assert.equal(s.name,'Konfliktkind','Name muss nach Serverfehler erhalten bleiben');
   assert.equal(s.presetId,'fox','Avatar-Auswahl muss nach Serverfehler erhalten bleiben');
   assert.equal(s.folge,'dog,cat,tree,house','Emoji-Auswahl muss nach Serverfehler erhalten bleiben');

   // 8) Position 4 auf 🐘 ändern -> erfolgreiche Anlage -> Formular zurückgesetzt & Bewohner in Liste
   await clickObj('PasswortPos4');
   await pickEmoji('🐘');
   await clickObj('BewohnerAnlegen');
   await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='Busy')?.value===0);
   await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='BewohnerListe')?.records?.some(r=>r.name==='Konfliktkind'));
   s=await state();
   assert.equal(s.name,'','Nach erfolgreicher Anlage wird das Namensfeld geleert');
   assert.equal(s.anzahl,0,'Nach erfolgreicher Anlage wird die Emoji-Folge zurückgesetzt');
   assert.equal(s.vorschau,'/images/default-avatar.svg','Nach erfolgreicher Anlage ist wieder der Standardavatar aktiv');
   const createdInDb=app.core.db.people.find(p=>p.name==='Konfliktkind');
   assert.equal(createdInDb?.avatarImage,'/images/Avatars_allgemein/Fuchs.svg');
   assert.equal(errors.length,0,'Keine Browserfehler auf stage_house_residents');
  }finally{
   await browser.close();
  }
 });
});
