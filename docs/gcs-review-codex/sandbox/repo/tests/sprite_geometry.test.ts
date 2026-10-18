import { TestResult } from '../scripts/test_login_logic.js';
import { SpriteGeometry } from '../src/runtime/SpriteGeometry.js';

/**
 * Testet die Frame-Geometrie anhand des real aufgetretenen Falls "Clownfisch.png":
 * Sheet 512x432, Raster 2x3, also Frame 256x144 (16:9). Das Sprite ist 10x6 Zellen
 * gross (200x120 Pixel, 5:3) und wurde dadurch vertikal gestaucht.
 */
export async function runSpriteGeometryTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];

    // --- Test 1: Verzerrung wird erkannt ---
    const geo = SpriteGeometry.analyze(512, 432, 2, 3, 10, 6, 20)!;
    const p1 = geo.frameWidth === 256 && geo.frameHeight === 144 && geo.isDistorted;

    results.push({
        name: 'SpriteGeometry: Verzerrung 16:9-Frame in 5:3-Box',
        type: 'Happy Path',
        passed: p1,
        expectedSuccess: true,
        actualSuccess: p1,
        details: `Frame ${geo.frameWidth}x${geo.frameHeight}, Verzerrung ${geo.distortion.toFixed(4)} (erwartet > 1.02)`
    });

    // --- Test 2: Beide Achsenfaktoren weichen voneinander ab ---
    // Genau das verdeckt der AssetAnalyzer heute durch Math.max(fx, fy).
    const p2 = Math.abs(geo.scaleX - 1.28) < 0.001 && Math.abs(geo.scaleY - 1.2) < 0.001;

    results.push({
        name: 'SpriteGeometry: scaleX und scaleY getrennt ausgewiesen',
        type: 'Happy Path',
        passed: p2,
        expectedSuccess: true,
        actualSuccess: p2,
        details: `scaleX=${geo.scaleX.toFixed(3)} scaleY=${geo.scaleY.toFixed(3)} (erwartet 1.280 / 1.200)`
    });

    // --- Test 3: containFit passt formattreu ein und zentriert ---
    const fit = SpriteGeometry.containFit(geo.frameAspect, geo.boxAspect);
    const p3 = fit.widthPercent === 100
        && Math.abs(fit.heightPercent - 93.75) < 0.001
        && Math.abs(fit.topPercent - 3.125) < 0.001
        && fit.leftPercent === 0;

    results.push({
        name: 'SpriteGeometry: containFit zentriert ohne Verzerrung',
        type: 'Happy Path',
        passed: p3,
        expectedSuccess: true,
        actualSuccess: p3,
        details: `w=${fit.widthPercent}% h=${fit.heightPercent.toFixed(2)}% top=${fit.topPercent.toFixed(3)}% (erwartet 100 / 93.75 / 3.125)`
    });

    // --- Test 4: Passendes Sheet erzeugt keine Anpassung ---
    const exact = SpriteGeometry.analyze(400, 360, 2, 3, 10, 6, 20)!;
    const exactFit = SpriteGeometry.containFit(exact.frameAspect, exact.boxAspect);
    const p4 = !exact.isDistorted
        && exactFit.widthPercent === 100
        && exactFit.heightPercent === 100
        && Math.abs(exact.scaleX - 1) < 0.001;

    results.push({
        name: 'SpriteGeometry: 1:1-Sheet bleibt unangetastet',
        type: 'Edge Case',
        passed: p4,
        expectedSuccess: true,
        actualSuccess: p4,
        details: `Verzerrung ${exact.distortion.toFixed(4)}, Fit ${exactFit.widthPercent}x${exactFit.heightPercent}%, scale ${exact.scaleX.toFixed(3)}`
    });

    // --- Test 5: Box breiter als Frame (umgekehrter Fall) ---
    // Frame 100x200 (1:2) in einer Box 10x6 Zellen (5:3) -> Breite muss schrumpfen.
    const tall = SpriteGeometry.analyze(100, 200, 1, 1, 10, 6, 20)!;
    const tallFit = SpriteGeometry.containFit(tall.frameAspect, tall.boxAspect);
    const p5 = tallFit.heightPercent === 100
        && Math.abs(tallFit.widthPercent - 30) < 0.001
        && Math.abs(tallFit.leftPercent - 35) < 0.001;

    results.push({
        name: 'SpriteGeometry: hoher Frame in breiter Box',
        type: 'Edge Case',
        passed: p5,
        expectedSuccess: true,
        actualSuccess: p5,
        details: `w=${tallFit.widthPercent.toFixed(2)}% left=${tallFit.leftPercent.toFixed(2)}% (erwartet 30 / 35)`
    });

    // --- Test 6: Kleinste verzerrungsfreie Zellengroesse ---
    const sug = SpriteGeometry.suggestCellSizes(256, 144, 10, 6, 20);
    const p6 = sug.length > 0 && sug[0].cols === 16 && sug[0].rows === 9
        && sug[0].widthPx === 320 && sug[0].heightPx === 180;

    results.push({
        name: 'SpriteGeometry: kleinste verzerrungsfreie Zellengroesse',
        type: 'Happy Path',
        passed: p6,
        expectedSuccess: true,
        actualSuccess: p6,
        details: `Vorschlag ${sug[0]?.cols}x${sug[0]?.rows} Zellen = ${sug[0]?.widthPx}x${sug[0]?.heightPx}px (erwartet 16x9 = 320x180)`
    });

    // --- Test 7: Krummes Verhaeltnis liefert keine Empfehlung ---
    // 255:143 ist nicht kuerzbar -> keine praktikable Zellengroesse.
    const none = SpriteGeometry.suggestCellSizes(255, 143, 10, 6, 20);
    const p7 = none.length === 0;

    results.push({
        name: 'SpriteGeometry: unpraktikables Verhaeltnis wird abgelehnt',
        type: 'Edge Case',
        passed: p7,
        expectedSuccess: true,
        actualSuccess: p7,
        details: `255:143 ergibt ${none.length} Vorschlaege (erwartet 0)`
    });

    // --- Test 8: Empfohlene Sheet-Groesse fuer 1:1-Darstellung ---
    const rec = SpriteGeometry.recommendedSheetSize(2, 3, 10, 6, 20);
    const p8 = rec.width === 400 && rec.height === 360;

    results.push({
        name: 'SpriteGeometry: empfohlene Sheet-Groesse fuer 1:1',
        type: 'Happy Path',
        passed: p8,
        expectedSuccess: true,
        actualSuccess: p8,
        details: `${rec.width}x${rec.height} (erwartet 400x360)`
    });

    // --- Test 9: Frame-Verschiebung der Blatt-Ebene ---
    // Raster 2x3: Frame 4 liegt in Spalte 0, Zeile 2. Das Blatt ist dreimal so
    // hoch wie das Fenster, zwei Frames nach oben sind daher zwei Drittel.
    const off = SpriteGeometry.frameOffsetPercent(0, 2, 2, 3);
    const p9 = off.tx === 0 && Math.abs(off.ty + 200 / 3) < 0.001;

    results.push({
        name: 'SpriteGeometry: Frame-Verschiebung 2x3, Frame 4',
        type: 'Happy Path',
        passed: p9,
        expectedSuccess: true,
        actualSuccess: p9,
        details: `tx=${off.tx}% ty=${off.ty.toFixed(3)}% (erwartet 0 / -66.667)`
    });

    // --- Test 10: Letztes Frame bleibt innerhalb des Blatts ---
    // Der alte Code rechnete col/(hCount-1) und erreichte damit 100 %, was das
    // Blatt komplett aus dem Fenster geschoben haette.
    const last = SpriteGeometry.frameOffsetPercent(1, 2, 2, 3);
    const p10 = Math.abs(last.tx + 50) < 0.001 && last.tx > -100 && last.ty > -100;

    results.push({
        name: 'SpriteGeometry: letztes Frame verschiebt nicht ueber das Blatt hinaus',
        type: 'Edge Case',
        passed: p10,
        expectedSuccess: true,
        actualSuccess: p10,
        details: `tx=${last.tx}% ty=${last.ty.toFixed(3)}% (erwartet -50 / -66.667)`
    });

    // --- Test 11: Einzelbild wird nicht verschoben ---
    const single = SpriteGeometry.frameOffsetPercent(0, 0, 1, 1);
    const p11 = single.tx === 0 && single.ty === 0;

    results.push({
        name: 'SpriteGeometry: Einzelbild ohne Verschiebung',
        type: 'Edge Case',
        passed: p11,
        expectedSuccess: true,
        actualSuccess: p11,
        details: `tx=${single.tx}% ty=${single.ty}%`
    });

    // --- Test 12: Unbrauchbare Eingaben brechen nicht ---
    const p12 = SpriteGeometry.analyze(0, 0, 2, 3, 10, 6) === null
        && SpriteGeometry.analyze(512, 432, 2, 3, 0, 6) === null;

    results.push({
        name: 'SpriteGeometry: fehlende Masse ergeben null',
        type: 'Error Handling',
        passed: p12,
        expectedSuccess: true,
        actualSuccess: p12,
        details: 'analyze() liefert null statt NaN-Werten'
    });

    // --- Test 13: wholeFrameSize rundet auf ganze Frames ---
    const wfs1 = SpriteGeometry.wholeFrameSize(399, 288, 2, 2);
    const p13 = wfs1.width === 400 && wfs1.height === 288
        && wfs1.frameWidth === 200 && wfs1.frameHeight === 144;

    results.push({
        name: 'SpriteGeometry: wholeFrameSize rundet auf ganze Frames',
        type: 'Unit',
        passed: p13,
        expectedSuccess: true,
        actualSuccess: p13,
        details: `399x288@2x2 -> ${wfs1.width}x${wfs1.height} (Frame ${wfs1.frameWidth}x${wfs1.frameHeight})`
    });

    // --- Test 14: wholeFrameSize toleriert ungerade Eingaben ---
    const wfs2 = SpriteGeometry.wholeFrameSize(511, 300, 3, 2);
    const p14 = wfs2.frameWidth === Math.round(511 / 3)
        && wfs2.height === wfs2.frameHeight * 2
        && wfs2.width === wfs2.frameWidth * 3;

    results.push({
        name: 'SpriteGeometry: wholeFrameSize haelt Frame-Raster ein',
        type: 'Unit',
        passed: p14,
        expectedSuccess: true,
        actualSuccess: p14,
        details: `511x300@3x2 -> ${wfs2.width}x${wfs2.height} (Frame ${wfs2.frameWidth}x${wfs2.frameHeight})`
    });

    // --- Test 15: wholeFrameSize beschuetzt vor 0 ---
    const wfs3 = SpriteGeometry.wholeFrameSize(0, 0, 2, 2);
    const p15 = wfs3.frameWidth === 1 && wfs3.frameHeight === 1
        && wfs3.width === 2 && wfs3.height === 2;

    results.push({
        name: 'SpriteGeometry: wholeFrameSize beschuetzt vor Null',
        type: 'Error Handling',
        passed: p15,
        expectedSuccess: true,
        actualSuccess: p15,
        details: '0x0@2x2 -> 1x1 pro Frame'
    });

    return results;
}
