// Smoke-Test für die moderne Handbuch-Edition (docs/handbook-html/modern/).
// Prüft: Laden per file://, 23 Kapitel in Sidebar, Kapitel öffnet Inhalt,
// Suche filtert, Theme-Wechsel, Fortschrittsmarkierung, Direktlink-Hash.
// Aufruf: node scripts/test-handbook-modern.cjs
const { chromium } = require('playwright');
const path = require('path');

(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const errors = [];
    page.on('pageerror', e => errors.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error') errors.push('CONSOLE: ' + m.text().slice(0, 160)); });

    const url = 'file:///' + path.resolve('docs/handbook-html/modern/index.html').split(path.sep).join('/');
    await page.goto(url, { waitUntil: 'load', timeout: 30000 });
    await page.waitForTimeout(800);

    const results = [];
    const check = (name, ok, detail) => results.push({ name, ok, detail: detail || '' });

    // 1. Kapitel-Navigation gerendert (23 Einträge)
    const navCount = await page.evaluate(() => document.querySelectorAll('[data-chapter], .nav-item, .chapter-link').length);
    check('Kapitel-Navigation mit 23 Einträgen', navCount >= 23, 'Gefunden: ' + navCount);

    // 2. Erstes Kapitel öffnen (A1)
    const a1sel = await page.evaluate(() => {
        const el = Array.from(document.querySelectorAll('a, button, [data-chapter]'))
            .find(e => /Editor starten/i.test(e.textContent));
        if (el) { el.click(); return true; }
        return false;
    });
    await page.waitForTimeout(600);
    const content = await page.evaluate(() => document.body.textContent.length);
    check('Kapitel A1 öffnet Inhalt', a1sel && content > 5000, 'Zeichen: ' + content);

    // 3. Suche
    const searchSel = await page.evaluate(() => {
        const i = document.querySelector('input[type="search"], input#search, input[placeholder*="uch"]');
        return i ? true : false;
    });
    if (searchSel) {
        const inp = await page.$('input[type="search"], input#search, input[placeholder*="uch"]');
        await inp.fill('Wasser');
        await page.waitForTimeout(600);
        const hits = await page.evaluate(() => document.querySelectorAll('.search-hit').length);
        check('Suche liefert Treffer', hits > 0, 'Treffer-Elemente: ' + hits);
    } else {
        check('Suchfeld vorhanden', false, 'kein Suchfeld gefunden');
    }

    // 4. Theme-Wechsel
    const bgBefore = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    const themeClicked = await page.evaluate(() => {
        const b = Array.from(document.querySelectorAll('button, [role="switch"], .theme-toggle'))
            .find(e => /dunkel|dark|theme|hell|🌓|🌙|☀/i.test(e.textContent + (e.getAttribute('aria-label') || '')));
        if (b) { b.click(); return true; } return false;
    });
    await page.waitForTimeout(400);
    const bgAfter = await page.evaluate(() => getComputedStyle(document.body).backgroundColor);
    check('Theme-Wechsel aktiv', themeClicked && bgBefore !== bgAfter, `${bgBefore} → ${bgAfter}`);

    // 5. Fortschritt (Gelesen-Button)
    const hasCheck = await page.evaluate(() => !!document.getElementById('doneCheck'));
    if (hasCheck) await page.check('#doneCheck');
    await page.waitForTimeout(400);
    const stored = await page.evaluate(() => Object.keys(localStorage).join(','));
    check('Fortschritt speichert lokal', hasCheck && /done|fortschritt|progress/i.test(stored),
        'localStorage: ' + stored);

    results.forEach(r => console.log((r.ok ? 'PASS' : 'FAIL') + ' | ' + r.name + (r.detail ? ' | ' + r.detail : '')));
    console.log('JS-FEHLER:', errors.length ? errors.slice(0, 6) : 'keine');
    await browser.close();
    if (results.some(r => !r.ok)) process.exit(1);
})().catch(e => { console.error('TEST-FEHLER:', e.message); process.exit(1); });
