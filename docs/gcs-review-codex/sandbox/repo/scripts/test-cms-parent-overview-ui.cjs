const fs = require('node:fs'), path = require('node:path'), assert = require('node:assert/strict');
const { chromium } = require('playwright');
const { buildDb } = require('./cms/cms-seed-testdata.cjs');
const { createServer } = require('./cms/cms-server.cjs');
const project = require('../game-server/public/projects/GCS-CMS.json');
async function main() {
  const dir = fs.mkdtempSync(path.join(__dirname, '../.tmp-parent-overview-'));
  let cms, browser;
  try {
    const dataPath = path.join(dir, 'data.json');
    fs.writeFileSync(dataPath, JSON.stringify(buildDb()));
    cms = createServer({ dataPath, storage: 'json' });
    await new Promise(resolve => cms.server.listen(0, '127.0.0.1', resolve));
    const origin = 'http://127.0.0.1:' + cms.server.address().port;
    browser = await chromium.launchPersistentContext(path.join(dir, 'browser'), { channel: 'msedge', headless: true, viewport: { width: 1280, height: 950 } });
    await browser.addCookies([{ name: 'cms_account', value: cms.core.issueSession('parent-lina', 'account'), url: origin }]);
    const page = await browser.newPage(), errors = [];
    page.setDefaultTimeout(15000);
    page.on('pageerror', e => errors.push(e.message));
    const obj = (stage, name) => page.locator('[data-id="' + project.stages.find(s => s.id === stage).objects.find(o => o.name === name).id + '"]');
    await page.goto(origin + '/parent');
    await page.getByText('Lina', { exact: true }).filter({ visible: true }).waitFor();
    assert.equal(await obj('stage_parent_child', 'NavAktivitaet').count(), 0);
    const artifacts = path.resolve('artifacts/ui-work'); fs.mkdirSync(artifacts, { recursive: true });
    await page.screenshot({ path: path.join(artifacts, 'parent-children-overview.png'), fullPage: true });
    await page.getByText('Lina', { exact: true }).filter({ visible: true }).click();
    await obj('stage_parent_child', 'KindName').getByText('Lina', { exact: true }).waitFor();
    await obj('stage_parent_child', 'NavAktivitaet').waitFor({ state: 'visible' });
    assert.match(await obj('stage_parent_child', 'KindHeute').textContent(), /Heute gespielt:/);
    await page.screenshot({ path: path.join(artifacts, 'parent-child-details.png'), fullPage: true });
    await obj('stage_parent_child', 'NavAktivitaet').click();
    await obj('stage_child_activity', 'Zurueck').waitFor({ state: 'visible' });
    await obj('stage_child_activity', 'Zurueck').click();
    await obj('stage_parent_child', 'KindName').getByText('Lina', { exact: true }).waitFor();
    for (const [button, stage] of [['NavRaeume', 'stage_child_rooms'], ['NavBudget', 'stage_child_budget'], ['KindKarteikasten', 'stage_child_cards'], ['KartenstapelVerwalten', 'stage_decks']]) {
      await obj('stage_parent_child', button).waitFor({ state: 'visible' });
      await obj('stage_parent_child', button).click();
      await obj(stage, 'Zurueck').waitFor({ state: 'visible' });
      // Wait until the stage's initial request has settled before navigating.
      await page.waitForFunction(() => window.player?.runtime?.contextVars?.Busy === 0);
      await obj(stage, 'Zurueck').click();
      await obj('stage_parent_child', 'KindName').getByText('Lina', { exact: true }).waitFor();
    }
    await obj('stage_parent_child', 'ProfilAnmeldung').click();
    await obj('stage_parent_child_profile', 'ProfilSpeichern').waitFor({state:'visible'});
    const profile = project.stages.find(s=>s.id==='stage_parent_child_profile');
    assert.equal(profile.objects.some(o=>['ProfilArt','MitgliedButton','AvatarWahl'].includes(o.name)),false);
    const input=obj('stage_parent_child_profile','ProfilName').locator('input');
    await input.fill('Lina Test');await obj('stage_parent_child_profile','ProfilSpeichern').click();
    await obj('stage_parent_child_profile','Status').getByText('Profil gespeichert.',{exact:true}).waitFor();
    assert.equal(cms.core.db.people.find(p=>p.id==='child-lina').name,'Lina Test');
    await input.fill('Lina');await obj('stage_parent_child_profile','ProfilSpeichern').click();
    await obj('stage_parent_child_profile','Status').getByText('Profil gespeichert.',{exact:true}).waitFor();
    const picker=obj('stage_parent_child_profile','CodeEmojiPicker');
    for(let i=0;i<4;i++){
      await picker.getByText('🐶',{exact:true}).click();
      await page.waitForFunction(count=>window.player.runtime.contextVars.CodeAnzahl===count,i+1);
    }
    await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='CodeSpeichern')?.enabled===true&&window.player.runtime.contextVars.CodeFolge==='dog,dog,dog,dog');
    await obj('stage_parent_child_profile','CodeSpeichern').click();
    await obj('stage_parent_child_profile','Status').getByText(/Emoji-Code gespeichert\./).waitFor();
    assert.equal(cms.core.login(['dog','dog','dog','dog']).person.id,'child-lina');
    const chooser=page.waitForEvent('filechooser');await obj('stage_parent_child_profile','BildWaehlen').click();
    const png=await require('sharp')({create:{width:32,height:32,channels:3,background:{r:20,g:120,b:180}}}).png().toBuffer();
    await (await chooser).setFiles({name:'avatar.png',mimeType:'image/png',buffer:png});
    await obj('stage_parent_child_profile','BildHochladen').click();
    await page.waitForFunction(()=>window.player.runtime.getObjects().find(o=>o.name==='BewohnerBild')?.src?.startsWith('/avatars/'));
    assert.match(cms.core.db.people.find(p=>p.id==='child-lina').avatarImage,/^\/avatars\//);
    const deniedUpload=await page.request.post(origin+'/api/cms/upload/avatar',{data:png,headers:{Origin:origin,'Content-Type':'application/octet-stream','X-Upload-Metadata':encodeURIComponent(JSON.stringify({personId:'child-tom'}))}});
    assert.equal(deniedUpload.status(),403);
    await page.screenshot({path:path.join(artifacts,'parent-child-profile.png'),fullPage:true});
    await obj('stage_parent_child_profile','Back').click();
    await obj('stage_parent_child','KindName').getByText('Lina',{exact:true}).waitFor();
    await obj('stage_parent_child', 'ZurKinderliste').click();
    await page.getByText('Mia (Mond)', { exact: true }).filter({ visible: true }).waitFor();
    // Clicking the same card again must work after returning to the overview.
    await page.getByText('Lina', { exact: true }).filter({ visible: true }).click();
    await obj('stage_parent_child', 'NavAktivitaet').waitFor({ state: 'visible' });
    await obj('stage_parent_child', 'ZurKinderliste').click();
    await page.getByText('Mia (Mond)', { exact: true }).filter({ visible: true }).click();
    await obj('stage_parent_child', 'Status').getByText('Nur eigene, bestätigt zugeordnete Kinder.', { exact: true }).waitFor();
    assert.equal(await obj('stage_parent_child', 'NavAktivitaet').isVisible(), false);
    assert.equal((await obj('stage_parent_child', 'KindName').textContent()).trim(), '');
    assert.deepEqual(errors, []);
    console.log('OK: Kinderübersicht, Rückwege, Elternprofil, Name, Emoji-Passwort, Bild-Upload und verweigerter Fremdzugriff');
  } finally {
    await browser?.close();
    if (cms) { cms.closeLive(); cms.server.closeAllConnections(); await new Promise(resolve => cms.server.close(resolve)); }
    fs.rmSync(dir, { recursive: true, force: true });
  }
}
main().catch(error => { console.error(error); process.exitCode = 1; });
