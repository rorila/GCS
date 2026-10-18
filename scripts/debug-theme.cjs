const { chromium } = require('playwright');
const path = require('path');
(async () => {
    const browser = await chromium.launch();
    const page = await browser.newPage();
    const url = 'file:///' + path.resolve('docs/handbook-html/gcs-native/index.html').split(path.sep).join('/');
    await page.goto(url);
    await page.waitForTimeout(2500);
    await page.click('div.TButton[data-id^="card_"]:has-text("A6")');
    await page.waitForTimeout(1000);
    const dump = await page.evaluate(() => Array.from(document.querySelectorAll('.TRichText')).map(el => ({
        dataId: el.getAttribute('data-id'),
        display: getComputedStyle(el).display,
        bg: getComputedStyle(el).backgroundColor,
        color: getComputedStyle(el).color,
        overflowY: getComputedStyle(el).overflowY,
        textLen: el.textContent.length,
        childCount: el.children.length,
        styleAttr: (el.getAttribute('style') || '').slice(0, 250)
    })));
    console.log(JSON.stringify(dump, null, 1));
    await browser.close();
})().catch(e => console.error('FEHLER:', e.message));
