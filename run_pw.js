import { chromium } from 'playwright';

(async () => {
    const browser = await chromium.launch({ headless: true });
    const page = await browser.newPage();
    page.on('console', msg => console.log('PAGE LOG:', msg.text()));
    page.on('pageerror', error => console.error('PAGE ERROR:', error.message));

    console.log('Navigating to Editor...');
    await page.goto('http://localhost:5173/?e2e=true');
    await page.waitForSelector('#app-layout');

    console.log('Loading MyCoolGame.json...');
    await page.evaluate(async () => {
        const fs = (window as any).electronFS; // Mocked or real
        // wir können loadMyCoolGame.ts logik mocken, aber wir können auch direkten test aufruf machen
        // Da die loadMyCoolGame.ts von test framework kommt, kopiere ich teile
    });

    // Alternatively, I'll just run npx playwright with a reporter that shows console!
    await browser.close();
})();
