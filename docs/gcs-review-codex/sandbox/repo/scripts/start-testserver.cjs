// Startet den CMS-Server mit den synthetischen Testdaten.
// Aufruf: node scripts/start-testserver.cjs [Port]
// Erzeugt die Testdaten bei Bedarf neu und legt die Zugangsdaten-Datei
// unter dem vom Server erwarteten Namen (cms-admin-auth.json) ab.
const fs = require('node:fs');
const path = require('node:path');

const root = path.join(__dirname, '..');
const testDir = path.join(root, 'game-server', 'data', 'test');
const dataPath = path.join(testDir, 'cms-testdata.json');
const authSrc = path.join(testDir, 'cms-testdata-auth.json');
const authDst = path.join(testDir, 'cms-admin-auth.json');

// Testdaten fehlen? -> einmal erzeugen.
if (!fs.existsSync(dataPath) || !fs.existsSync(authSrc)) {
  console.log('Testdaten werden erzeugt …');
  require('./cms/cms-seed-testdata.cjs');
}

// Zugangsdaten unter dem Namen ablegen, den der Server erwartet.
fs.copyFileSync(authSrc, authDst);

const port = Number(process.argv[2] || process.env.CMS_PORT || 8081);
const { createServer } = require('./cms/cms-server.cjs');
const { server } = createServer({ dataPath });
server.listen(port, '127.0.0.1', () => {
  console.log('CMS-Testserver: http://localhost:' + port);
  console.log('Daten: ' + dataPath);
  console.log('Passwort fuer alle Zugaenge: Nur-Fuer-Tests!2025');
  console.log('Beenden mit Strg+C');
});
