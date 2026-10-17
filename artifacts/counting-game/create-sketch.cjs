const fs = require('node:fs');
const path = require('node:path');
const sharp = require('sharp');
const asset = fs.readFileSync(path.resolve('public/images/Avatars_allgemein/Fuchs.svg')).toString('base64');
const foxes = [[135,245],[295,245],[135,365],[295,365]].map(([x,y])=>`<image x="${x}" y="${y}" width="88" height="88" href="data:image/svg+xml;base64,${asset}"/>`).join('');
const blocks = [0,1,2].map(i=>`<rect x="835" y="${488-i*62}" width="160" height="58" rx="8" fill="${['#277d96','#369bb0','#65bcbd'][i]}"/><path d="M915 ${488-i*62}v58" stroke="#fff" opacity=".25"/>`).join('');
const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="850" viewBox="0 0 1200 850">
<style>text{font-family:Segoe UI,Arial,sans-serif;fill:#173d4b}.title{font-size:27px;font-weight:700}.body{font-size:20px}.small{font-size:17px}.white{fill:white}.muted{fill:#577580}</style>
<rect width="1200" height="850" fill="#edf4f4"/>
<text x="40" y="47" class="title">Bilder zählen · Entwurf für das erste Lernspiel</text>
<text x="40" y="79" class="small muted">Lernziel: Zahlen darstellen und vergleichen · Teilbereich: Anzahlen erfassen</text>
<rect x="40" y="103" width="231" height="43" rx="13" fill="#176d80"/><text x="62" y="131" class="body white">Stapel: Anzahlen 1–5</text>
<rect x="284" y="103" width="245" height="43" rx="13" fill="white" stroke="#c2d6dc"/><text x="304" y="131" class="body">Stapel: Anzahlen 5–10</text>
<text x="823" y="131" class="small muted">Beispiel: Aufgabe 4 von 10</text>
<rect x="40" y="169" width="535" height="475" rx="22" fill="white"/>
<text x="72" y="212" class="title">Wie viele Füchse siehst du?</text>
${foxes}
<rect x="89" y="477" width="436" height="47" rx="13" fill="#e5f3f4"/>
<text x="128" y="507" class="body">Noch einmal vorlesen</text>
<path d="M105 493h7l8-7v25l-8-7h-7z" fill="#176d80"/>
<text x="74" y="555" class="small muted">Zähle die Bilder und tippe auf die richtige Zahl.</text>
${[3,4,5].map((n,i)=>`<rect x="${74+i*163}" y="575" width="143" height="49" rx="13" fill="#216b90"/><text x="${145+i*163}" y="609" text-anchor="middle" font-size="30" font-weight="700" class="white">${n}</text>`).join('')}
<rect x="600" y="169" width="560" height="475" rx="22" fill="#dcf2ed"/>
<text x="632" y="212" class="title">Dein Abenteuer wächst</text>
<text x="632" y="243" class="small">Beispiel: Baue einen Turm</text>
<circle cx="1090" cy="292" r="30" fill="#f5cc69"/>
<path d="M625 541 Q770 491 870 538 T1140 530V583H625Z" fill="#a3cdb0"/>
<rect x="800" y="546" width="230" height="15" rx="7" fill="#537e70"/>
${blocks}
<rect x="835" y="302" width="160" height="58" rx="8" fill="#f3bc55" stroke="#a16b16" stroke-width="2" stroke-dasharray="7 5"/>
<text x="915" y="338" text-anchor="middle" class="small">Nächster Stein</text>
<path d="M785 330h40m-10-8 10 8-10 8" fill="none" stroke="#b47b22" stroke-width="3"/>
<text x="631" y="596" class="small">Richtig: Ein Stein schwebt auf den Turm.</text>
<text x="631" y="623" class="small muted">Alternativen: Haus bauen oder Bild zusammensetzen.</text>
<rect x="40" y="669" width="1120" height="142" rx="18" fill="white"/>
<text x="64" y="703" class="body" font-weight="700">So läuft eine Aufgabe ab</text>
<text x="64" y="737" class="small">1. Bilder + Auftrag anzeigen und vorlesen → 2. Eine von genau drei Zahlen wählen</text>
<text x="64" y="768" class="small">3. Richtige Antwort: Fortschritt rechts animieren → 4. Nächste Karte</text>
<text x="64" y="797" class="small muted">Die Turmszene ist ein Vorschlag. Die richtige Antwort wird vor der Auswahl nicht verraten.</text>
</svg>`;
fs.writeFileSync(path.join(__dirname,'Skizze-Zaehlen.svg'),svg);
sharp(Buffer.from(svg)).png().toFile(path.join(__dirname,'Skizze-Zaehlen.png')).catch(e=>{console.error(e);process.exitCode=1;});
