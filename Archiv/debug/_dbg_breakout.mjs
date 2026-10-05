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
await page.goto(`http://localhost:${port}/player.html?game=Breakout-Lernprojekt`, { waitUntil: 'load' });
await page.waitForTimeout(1500);
// Objekte finden & Start auslösen (Leertaste laut Projekt?) — erst Objekte listen
const objs = await page.evaluate(() => {
    const rt = window.player?.runtime;
    return rt.getObjects().filter(o => /start|ball|schlaeger|stein_1_1$/i.test(o.name || '')).map(o => ({ n: o.name, cls: o.className, ev: Object.keys(o.events || {}) }));
});
console.log(JSON.stringify(objs));
// Start via Klick auf Button 'Start' falls vorhanden
await page.evaluate(() => {
    const rt = window.player?.runtime;
    const start = rt.getObjects().find(o => o.name === 'Start' || o.name === 'StartBtn');
    if (start) rt.handleEvent(start.id, 'onClick', {});
});
// Ball-Flug über ~8s sampeln
for (let t = 0; t < 16; t++) {
    await page.waitForTimeout(500);
    const s = await page.evaluate(() => {
        const rt = window.player?.runtime;
        const g = n => rt.getObjects().find(o => o.name === n);
        const ball = g('Ball');
        const logs = (window.DebugLogService || rt?.debugLog)?.getLogs?.() || [];
        const coll = logs.filter(l => /BallKontakt|SteinTreffer|SteinReflexion|SteinWerten/.test(l.message || '')).slice(-4).map(l => l.message);
        const zerstoert = rt.getObjects().filter(o => /Stein/.test(o.name || '') && o.visible === false).length;
        return { x: ball?.x?.toFixed(1), y: ball?.y?.toFixed(1), vx: ball?.velocityX, vy: ball?.velocityY, zerstoert, coll };
    });
    console.log(JSON.stringify(s));
}
await browser.close(); server.close(); process.exit(0);
