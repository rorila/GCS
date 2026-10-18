// Tiefenprüfung gcs-native: Clipping je Inhaltsseite + Übersichtslayout.
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
    page.on('pageerror', e => console.log('PAGEERROR:', e.message));
    const url = 'file:///' + path.resolve('docs/handbook-html/gcs-native/index.html').split(path.sep).join('/');
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForTimeout(2500);
    const goTo = (sid) => page.evaluate(id =>
        window.player.runtime.stageController.goToStage(id), sid);

    // ── Übersicht: Karten-Raster, Überlappungen, Schriftgrößen ──
    const ov = await page.evaluate(() => {
        const cards = Array.from(document.querySelectorAll('div.TButton[data-id^="card_"]'));
        const rects = cards.map(c => {
            const r = c.getBoundingClientRect();
            const cs = getComputedStyle(c);
            return { id: c.dataset.id, x: Math.round(r.x), y: Math.round(r.y),
                     w: Math.round(r.width), h: Math.round(r.height), fs: cs.fontSize };
        });
        const labels = Array.from(document.querySelectorAll('.TLabel')).map(l => {
            const r = l.getBoundingClientRect();
            return { t: l.textContent.slice(0, 30), y: r.y, b: r.bottom, fs: getComputedStyle(l).fontSize };
        });
        const collisions = [];
        rects.forEach(c => labels.forEach(l => {
            if (l.t && c.y < l.b && l.y < c.y + c.h && l.t.length > 5) {
                collisions.push(`${c.id} vs "${l.t}"`);
            }
        }));
        return { count: rects.length, first: rects[0], second: rects[1],
                 collisions: collisions.slice(0, 8), labelFs: labels.slice(0, 4).map(l => `${l.t}=${l.fs}`) };
    });
    console.log(`ÜBERSICHT: ${ov.count} Karten | Karte1 ${JSON.stringify(ov.first)}`);
    console.log(`  Label-Schriften: ${ov.labelFs.join(' | ')}`);
    console.log('  Kollisionen:', ov.collisions.length ? ov.collisions : 'keine');

    // ── Alle Kapitel-Seiten auf Clipping prüfen (alle Seiten durchblättern) ──
    const stageIds = await page.evaluate(() =>
        window.PROJECT.stages.filter(s => /^stage_[ab]\d+$/.test(s.id)).map(s => s.id));
    let bad = [];
    for (const sid of stageIds) {
        await goTo(sid);
        await page.waitForTimeout(500);
        const pages = await page.evaluate(() =>
            Array.from(document.querySelectorAll('.TRichText')).length);
        const pageCount = await page.evaluate(() =>
            Number(document.body.textContent.match(/Seite 1 \/ (\d+)/)?.[1] || 1));
        for (let p = 0; p < pageCount; p++) {
            const info = await page.evaluate(() => {
                const vis = Array.from(document.querySelectorAll('.TRichText'))
                    .find(e => e.offsetWidth > 0 && e.offsetHeight > 0);
                return vis ? vis.scrollHeight - vis.clientHeight : -999;
            });
            if (info > 4) bad.push(`${sid} Seite ${p + 1}: +${info}px`);
            if (p + 1 < pageCount) {
                await page.click('div.TButton[data-id^="snext_"]');
                await page.waitForTimeout(350);
            }
        }
    }
    console.log(bad.length ? `CLIPPING gefunden:\n  ${bad.join('\n  ')}` : 'CLIPPING: keine Seite überläuft');

    // Screenshots zur Sichtkontrolle
    await goTo('stage_overview');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'docs/handbook-html/gcs-native/_qa_overview.png' });
    await goTo('stage_a01');
    await page.waitForTimeout(600);
    await page.screenshot({ path: 'docs/handbook-html/gcs-native/_qa_chapter.png' });
    await page.click('div.TButton[data-id^="theme_"]');
    await page.waitForTimeout(800);
    await page.screenshot({ path: 'docs/handbook-html/gcs-native/_qa_chapter_dark.png' });
    console.log('Screenshots: _qa_overview.png, _qa_chapter.png, _qa_chapter_dark.png');
    await browser.close();
})().catch(e => { console.error('FEHLER:', e.message); process.exit(1); });
