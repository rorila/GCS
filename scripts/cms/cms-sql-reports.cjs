// Report presets for GCS-SQL-Tool. No queries run when this module is loaded.
const child="json_extract(p.payload,'$.kind')='child' AND json_extract(p.payload,'$.active')=1";
const active="json_extract(c.payload,'$.active')=1";
const box="json_extract(c.payload,'$.box')";
const name="json_extract(p.payload,'$.name')";
const report=(id,title,description,sql)=>({id,name:'Report: '+title,description,sql});
module.exports=[
 report('r01','Karteikästen je Kind','Aktive Kind-Karten, einschließlich Fach 6. Stapelvorlagen und gelöschte Karten zählen nicht.',`
SELECT p.id AS kind_id, ${name} AS kind, count(c.record_key) AS gesamt,
${[1,2,3,4,5,6].map(n=>`sum(CASE WHEN ${box}=${n} THEN 1 ELSE 0 END) AS fach_${n}`).join(',\n')},
sum(CASE WHEN c.record_key IS NOT NULL AND (${box} IS NULL OR ${box} NOT IN (1,2,3,4,5,6)) THEN 1 ELSE 0 END) AS ohne_fach
FROM people p LEFT JOIN flashcards c ON c.childId=p.id AND ${active}
WHERE ${child} GROUP BY p.id ORDER BY kind, kind_id;`),
 report('r02','Stapel im Karteikasten','Tatsächlich importierte Kind-Karten je Herkunftsstapel und Fach; eigene Karten bilden eine eigene Gruppe.',`
SELECT c.childId AS kind_id, ${name} AS kind,
json_extract(c.payload,'$.sourceDeckId') AS stapel_id,
CASE WHEN json_extract(c.payload,'$.sourceDeckId') IS NULL THEN 'Eigene Karten / ohne Stapel' ELSE coalesce(json_extract(d.payload,'$.name'),'Nicht mehr verfügbarer Stapel') END AS stapel,
count(*) AS gesamt, ${[1,2,3,4,5,6].map(n=>`sum(CASE WHEN ${box}=${n} THEN 1 ELSE 0 END) AS fach_${n}`).join(',\n')},
sum(CASE WHEN ${box} IS NULL OR ${box} NOT IN (1,2,3,4,5,6) THEN 1 ELSE 0 END) AS ohne_fach
FROM flashcards c JOIN people p ON p.id=c.childId LEFT JOIN cardDecks d ON d.id=json_extract(c.payload,'$.sourceDeckId')
WHERE ${child} AND ${active} GROUP BY c.childId, json_extract(c.payload,'$.sourceDeckId') ORDER BY kind, stapel;`),
 report('r03','Karten nach Fachgebiet','Aktive Kind-Karten nach Fachgebiet und Thema, mit bereits gelernten Karten.',`
SELECT c.childId AS kind_id, ${name} AS kind, coalesce(json_extract(c.payload,'$.subject'),'Ohne Fachgebiet') AS fachgebiet,
coalesce(json_extract(c.payload,'$.topic'),'Ohne Thema') AS thema, count(*) AS karten,
sum(CASE WHEN ${box}=6 THEN 1 ELSE 0 END) AS gelernt
FROM flashcards c JOIN people p ON p.id=c.childId WHERE ${child} AND ${active}
GROUP BY c.childId, fachgebiet, thema ORDER BY kind, fachgebiet, thema;`),
 report('r04','Lernpunkte und gebuchte Versuche','Nur ursprüngliche Karten-Lernereignisse. Keine Ziehungsstatistik: nicht gebuchte Versuche sind nicht enthalten. Gesamtlernstand bleibt unabhängig von Belohnungen.',`
SELECT p.id AS kind_id, ${name} AS kind, coalesce(json_extract(p.payload,'$.cardPointMode'),'progress') AS zaehlregel,
count(e.record_key) AS gebuchte_lernereignisse,
coalesce(sum(json_extract(e.payload,'$.learningDelta')),0) AS netto_lernpunkte,
sum(CASE WHEN json_extract(e.payload,'$.toBox')>json_extract(e.payload,'$.fromBox') THEN 1 ELSE 0 END) AS aufstiege,
sum(CASE WHEN json_extract(e.payload,'$.fromBox')>1 AND json_extract(e.payload,'$.toBox')=1 THEN 1 ELSE 0 END) AS rueckfaelle,
sum(CASE WHEN json_extract(e.payload,'$.verification')='reported' THEN 1 ELSE 0 END) AS selbst_gemeldet,
max(json_extract(e.payload,'$.occurredAt')) AS letzte_lernaktivitaet
FROM people p LEFT JOIN performanceLedger e ON e.childId=p.id AND json_extract(e.payload,'$.cardLearningEvent')=1
WHERE ${child} GROUP BY p.id ORDER BY kind, kind_id;`),
 report('r05','Lernaktivität pro Tag (30 Tage)','UTC-Tage aus gespeicherten Ereignissen; ohne Aktivität gibt es keine Zeile. Aufstiege und Rückfälle sind keine vollständige Richtig/Falsch-Quote.',`
SELECT e.childId AS kind_id, ${name} AS kind, date(json_extract(e.payload,'$.occurredAt')) AS tag_utc,
count(*) AS gebuchte_lernereignisse, sum(coalesce(json_extract(e.payload,'$.learningDelta'),0)) AS netto_lernpunkte,
sum(CASE WHEN json_extract(e.payload,'$.toBox')>json_extract(e.payload,'$.fromBox') THEN 1 ELSE 0 END) AS aufstiege
FROM performanceLedger e JOIN people p ON p.id=e.childId WHERE ${child} AND json_extract(e.payload,'$.cardLearningEvent')=1
AND datetime(json_extract(e.payload,'$.occurredAt')) >= datetime('now','-30 days')
GROUP BY e.childId, tag_utc ORDER BY tag_utc DESC, kind;`),
 report('r06','Belohnungen je Begleitung','Erfüllte und offene Kartenbelohnungsansprüche getrennt. Punkte je Vereinbarung, niemals sponsorübergreifend als einzigartige Lernpunkte addieren.',`
SELECT s.id AS begleitung_id, s.childId AS kind_id, ${name} AS kind,
json_extract(sp.payload,'$.name') AS sponsor, json_extract(s.payload,'$.status') AS begleitstatus,
json_extract(c.payload,'$.agreementId') AS vereinbarung_id,
sum(CASE WHEN json_extract(c.payload,'$.status')='fulfilled' THEN 1 ELSE 0 END) AS erfuellte_runden,
sum(CASE WHEN json_extract(c.payload,'$.status')='fulfilled' THEN coalesce(json_extract(c.payload,'$.consumedPoints'),0) ELSE 0 END) AS belohnte_punkte,
sum(CASE WHEN json_extract(c.payload,'$.status')='earned' THEN 1 ELSE 0 END) AS erreicht,
sum(CASE WHEN json_extract(c.payload,'$.status')='requested' THEN 1 ELSE 0 END) AS angefragt,
sum(CASE WHEN json_extract(c.payload,'$.status')='released' THEN 1 ELSE 0 END) AS uebergabe_ausstehend,
sum(CASE WHEN json_extract(c.payload,'$.status')='cancelled' THEN 1 ELSE 0 END) AS storniert
FROM rewardClaims c JOIN sponsorships s ON s.id=c.sponsorshipId JOIN people p ON p.id=s.childId JOIN people sp ON sp.id=s.sponsorId
WHERE json_extract(c.payload,'$.rewardMode')='cardRounds' OR json_extract(c.payload,'$.snapshot.rewardMode')='cardRounds'
GROUP BY s.id, json_extract(c.payload,'$.agreementId') ORDER BY kind, sponsor;`),
 report('r07','Offene Belohnungen','Alle erreichten, angefragten und freigegebenen Ansprüche einschließlich beendeter Begleitungen; noch nicht erfüllt.',`
SELECT c.childId AS kind_id, ${name} AS kind, json_extract(sp.payload,'$.name') AS sponsor,
json_extract(c.payload,'$.entitlementKey') AS anspruch, json_extract(c.payload,'$.status') AS status,
json_extract(c.payload,'$.snapshot.rewardText') AS belohnung, json_extract(c.payload,'$.snapshot.pointsTarget') AS punkteziel,
json_extract(c.payload,'$.createdAt') AS erreicht_am, json_extract(c.payload,'$.fulfillmentReportedAt') AS uebergabe_gemeldet_am
FROM rewardClaims c JOIN people p ON p.id=c.childId LEFT JOIN people sp ON sp.id=json_extract(c.payload,'$.sponsorId')
WHERE json_extract(c.payload,'$.status') IN ('earned','requested','released') ORDER BY erreicht_am, kind;`),
 report('r08','Spielnutzung (30 Tage)','Sitzungen je Kind und Spiel, unabhängig von heutigen Katalogfreigaben. UTC-Zeitfenster.',`
SELECT ps.childId AS kind_id, ${name} AS kind, ps.gameId AS spiel_id, json_extract(g.payload,'$.name') AS spiel,
count(*) AS sitzungen, sum(CASE WHEN json_extract(ps.payload,'$.status')='ended' THEN 1 ELSE 0 END) AS beendet,
max(json_extract(ps.payload,'$.startedAt')) AS letzter_start
FROM playSessions ps JOIN people p ON p.id=ps.childId LEFT JOIN games g ON g.id=ps.gameId
WHERE ${child} AND datetime(json_extract(ps.payload,'$.startedAt')) >= datetime('now','-30 days')
GROUP BY ps.childId, ps.gameId ORDER BY sitzungen DESC, kind, spiel;`),
 report('r09','Bestätigte Eltern je Kind','Bestätigte, aktive Elternbeziehungen; Kinder ohne bestätigte Eltern sind sichtbar.',`
SELECT p.id AS kind_id, ${name} AS kind, count(g.record_key) AS bestaetigte_eltern,
group_concat(json_extract(ep.payload,'$.name'),', ') AS eltern
FROM people p LEFT JOIN guardians g ON g.childId=p.id AND json_extract(g.payload,'$.status')='confirmed'
AND EXISTS (SELECT 1 FROM people parent WHERE parent.id=g.guardianId AND json_extract(parent.payload,'$.active')=1)
LEFT JOIN people ep ON ep.id=g.guardianId WHERE ${child} GROUP BY p.id ORDER BY kind;`),
 report('r10','Karten mit Datenproblemen','Aktive Kind-Karten mit ungültigem Fach oder fehlendem Herkunftsstapel. Ohne-Stapel-Karten sind zulässig.',`
SELECT c.id AS karte_id, c.childId AS kind_id, ${name} AS kind, ${box} AS fach,
json_extract(c.payload,'$.sourceDeckId') AS stapel_id,
CASE WHEN ${box} IS NULL OR ${box} NOT IN (1,2,3,4,5,6) THEN 'Ungültiges Lernfach' ELSE 'Herkunftsstapel fehlt' END AS hinweis
FROM flashcards c JOIN people p ON p.id=c.childId LEFT JOIN cardDecks d ON d.id=json_extract(c.payload,'$.sourceDeckId')
WHERE ${child} AND ${active} AND (${box} IS NULL OR ${box} NOT IN (1,2,3,4,5,6) OR (json_extract(c.payload,'$.sourceDeckId') IS NOT NULL AND d.id IS NULL))
ORDER BY kind, karte_id;`),
];
