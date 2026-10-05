import http from 'http';
import fs from 'fs';
import path from 'path';
import { chromium } from 'playwright';
const pub = path.resolve('game-server/public');
const runtime = path.resolve('public/runtime-standalone.js');
const server = http.createServer((req, res) => {
    let url = req.url.split('?')[0];
    if (url === '/runtimes/1.0.0') { res.writeHead(200); return res.end(fs.readFileSync(runtime)); }
    let file = path.join(pub, decodeURIComponent(url));
    if (fs.existsSync(file) && fs.statSync(file).isFile()) { res.writeHead(200); return res.end(fs.readFileSync(file)); }
    res.writeHead(404); res.end('nf');
});
await new Promise(r => server.listen(0, r));
const port = server.address().port;
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(`http://localhost:${port}/player.html?game=Snake-Lernprojekt`, { waitUntil: 'load' });
await page.waitForTimeout(1200);
// Start-Button klicken
await page.mouse.click(640, 360);
await page.waitForTimeout(1500);
const d = await page.evaluate(() => {
    const rt = window.player?.runtime;
    const objs = rt?.getObjects ? rt.getObjects() : [];
    const g = n => objs.find(o => o.name === n);
    const s = g('Schlange');
    return {
        items: s?.items?.length,
        itemsSample: s?.items?.slice(0, 3),
        recordDataKeys: s?.recordData ? Object.keys(s.recordData).length : 'none',
        recordSample: s?.recordData?.[s.items?.[0]],
        Segment: g('Segment')?.value,
        cv_Segment: rt.contextVars?.Segment,
        cv_Schlange: Array.isArray(rt.contextVars?.Schlange) ? 'array ' + rt.contextVars.Schlange.length : rt.contextVars?.Schlange,
        AltX: g('AltX')?.value, TrageX: g('TrageX')?.value,
        i: g('i')?.value, cv_i: rt.contextVars?.i,
    };
});
console.log(JSON.stringify(d, null, 1));
await browser.close(); server.close(); process.exit(0);
