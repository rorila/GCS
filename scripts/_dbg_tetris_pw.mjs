import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
const pub = path.resolve('game-server/public');
const runtime = path.resolve('public/runtime-standalone.js');
const server = http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/runtimes/1.0.0') { res.writeHead(200,{'Content-Type':'application/javascript'}); return res.end(fs.readFileSync(runtime)); }
    let file = path.join(pub, decodeURIComponent(url));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200); return res.end(fs.readFileSync(file)); }
    res.writeHead(404); res.end('nf');
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
page.on('console', m => { if (m.type() === 'error') console.log('ERR:', m.text().slice(0,160)); });
await page.goto(`http://localhost:${port}/player.html?game=Tetris-Classic`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
await page.evaluate(() => {
    const rt = window.player?.runtime;
    rt.handleEvent(rt.getObjects().find(o => o.name === 'BtnStart').id, 'onClick', {});
});
for (let i = 0; i < 6; i++) {
    await page.waitForTimeout(800);
    const s = await page.evaluate(() => {
        const rt = window.player?.runtime;
        const g = n => rt.getObjects().find(o => o.name === n);
        const cv = rt.contextVars || {};
        return { status: cv.Status, y: cv.AktivY, passt: cv.Passt, taktEnabled: g('Takt')?.enabled, taktCount: g('Takt')?.currentCount };
    });
    console.log(JSON.stringify(s));
}
await browser.close(); server.close(); process.exit(0);
