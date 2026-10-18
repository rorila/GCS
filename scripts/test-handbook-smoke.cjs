// Interaktions-Smoke-Test für die gcs-native Handbuch-Edition.
// Prüft: Übersicht → Kapitel-Klick → Seitenblättern → Theme-Wechsel inkl.
// Objektfarben → Suche → Gelesen-Markierung. Aufruf: node scripts/test-handbook-smoke.cjs
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });

    const url = 'file:///' + path.resolve('docs/handbook-html/gcs-native/index.html').split(path.sep).join('/');
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(2500);

    const results = [];
    const check = (name, ok, detail) => { results.push({ name, ok, detail }); };

    // 1. Kapitel-Karte anklicken → Stage-Wechsel
    await page.click('div.TButton[data-id^="card_"]:has-text("A1 · Editor starten")');
    await page.waitForTimeout(1200);
    const chap = await page.evaluate(() => ({
        title: document.body.textContent.includes('Editor starten'),
        richText: document.body.textContent.includes('Lernziel'),
        hasNext: document.body.textContent.includes('Kapitel ▶'),
        hasRead: document.body.textContent.includes('gelesen markieren')
    }));
    check('Kapitel A1 öffnet mit Inhalt', chap.title && chap.richText && chap.hasNext && chap.hasRead, JSON.stringify(chap));

    // 2. Seitenblättern (falls mehrseitig)
    const paging = await page.evaluate(() => {
        const lbl = Array.from(document.querySelectorAll('.TLabel')).find(e => /Seite 1 \//.test(e.textContent));
        return lbl ? lbl.textContent.trim() : null;
    });
    if (paging) {
        await page.click('div.TButton[data-id^="snext_"]');
        await page.waitForTimeout(800);
        const after = await page.evaluate(() => {
            const lbl = Array.from(document.querySelectorAll('.TLabel')).find(e => /Seite \d+ \//.test(e.textContent));
            return lbl ? lbl.textContent.trim() : null;
        });
        check('Seitenblättern wechselt Seite', after && after !== paging, `${paging} → ${after}`);
    } else {
        check('Seitenblättern (A1 mehrseitig)', false, 'keine SeiteAnzeige gefunden');
    }

    // 3. „Gelesen" markieren → Fortschritt
    await page.click('div.TButton[data-id^="done_"]');
    await page.waitForTimeout(800);
    const prog = await page.evaluate(() => document.body.textContent.match(/(\d+) \/ 23 gelesen/)?.[1]);
    check('Fortschritt zählt (1/23)', prog === '1', 'Stand: ' + prog);

    // 4. Theme-Wechsel — jetzt inkl. Objektfarben
    const before = await page.evaluate(() => {
        const rt = document.querySelector('.TRichText');
        return { bg: getComputedStyle(document.querySelector('#run-stage')).backgroundColor,
                 rtColor: rt && getComputedStyle(rt).color, rtBg: rt && getComputedStyle(rt).backgroundColor };
    });
    await page.click('div.TButton[data-id^="theme_"]');
    await page.waitForTimeout(1200);
    const after = await page.evaluate(() => {
        const rt = document.querySelector('.TRichText');
        return { bg: getComputedStyle(document.querySelector('#run-stage')).backgroundColor,
                 rtColor: rt && getComputedStyle(rt).color, rtBg: rt && getComputedStyle(rt).backgroundColor };
    });
    // Dunkelmodus erwartet HELLEN Text auf DUNKLEM Hintergrund.
    const isLight = (rgb) => { const m = rgb && rgb.match(/\d+/g).map(Number); return m && (m[0]+m[1]+m[2]) > 500; };
    check('Theme-Wechsel: Stage+Text+Panel dunkel', before.bg !== after.bg && isLight(after.rtColor) && !isLight(after.rtBg),
        `rtColor ${before.rtColor}→${after.rtColor}, rtBg ${before.rtBg}→${after.rtBg}`);

    // 5. Navigation im Dunkelmodus → Stile bleiben (Blueprint onEnter)
    await page.click('div.TButton[data-id^="home_"]');
    await page.waitForTimeout(1000);
    const ov = await page.evaluate(() => {
        const lbl = document.querySelector('.TLabel');
        const card = document.querySelector('div.TButton[data-id^="card_"]');
        return { lbl: lbl && getComputedStyle(lbl).color, cardBg: card && getComputedStyle(card).backgroundColor };
    });
    check('Übersicht bleibt im Dunkelmodus gestylt', ov.cardBg && !isLight(ov.cardBg) && ov.lbl && isLight(ov.lbl),
        `label ${ov.lbl}, card ${ov.cardBg}`);
    await page.click('div.TButton[data-id^="theme_"]'); // zurück auf hell
    await page.waitForTimeout(800);

    // 6. Suche
    await page.click('div.TButton[data-id^="search_"]');
    await page.waitForTimeout(1000);
    const searchVisible = await page.evaluate(() => !!document.querySelector('#run-stage input'));
    check('Such-Stage zeigt Eingabefeld', searchVisible, '');
    if (searchVisible) {
        const countHits = () =>
            Array.from(document.querySelectorAll('#run-stage *'))
                .filter(e => e.textContent && /^(A|B)\d+ · /.test(e.textContent.trim())
                    && e.children.length === 0 && e.offsetWidth > 0)
                .length;
        await page.fill('#run-stage input', 'Wasser');
        await page.press('#run-stage input', 'Enter');
        await page.waitForTimeout(1200);
        const hits = await page.evaluate(countHits);
        check('Suche „Wasser" liefert Treffer', hits > 0 && hits < 23, 'Treffer: ' + hits);
        await page.fill('#run-stage input', 'zzqqxx');
        await page.press('#run-stage input', 'Enter');
        await page.waitForTimeout(1200);
        check('Suche „zzqqxx" blendet alle aus', (await page.evaluate(countHits)) === 0, '');
    }

    // 7. Zurück zur Übersicht
    await page.click('div.TButton[data-id^="home_"]');
    await page.waitForTimeout(1000);
    check('Übersicht erreichbar', await page.evaluate(() =>
        document.body.textContent.includes('Der wachsende Baum')), '');

    results.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' | ' + r.name + (r.detail ? ' | ' + r.detail : '')));
    console.log('JS-FEHLER:', errors.length ? errors.slice(0, 6) : 'keine');
    await browser.close();
    if (results.some(r => !r.ok)) process.exit(1);
})().catch(e => { console.error('TEST-FEHLER:', e.message); process.exit(1); });
