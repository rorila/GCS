/**
 * Tests für die beiden HTML-Editionen des GCS-Autoren-Handbuchs:
 * - Version 1: Modern Web Edition (docs/handbook-html/modern/)
 * - Version 2: GCS Native Edition (docs/handbook-html/gcs-native/)
 * - Gemeinsame Inhaltsquelle: docs/handbook-html/shared/handbook-content.js
 */
import fs from 'node:fs';
import path from 'node:path';
import vm from 'node:vm';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '..');
const requireCjs = createRequire(import.meta.url);

export interface TestResult {
    name: string;
    type: string;
    expectedSuccess: boolean;
    actualSuccess: boolean;
    passed: boolean;
    details?: string;
}

export async function runHandbookHtmlTests(): Promise<TestResult[]> {
    const results: TestResult[] = [];
    const check = (name: string, passed: boolean, expectedSuccess = true, details?: string) => {
        results.push({
            name,
            type: 'Handbuch-HTML',
            expectedSuccess,
            actualSuccess: expectedSuccess ? passed : !passed,
            passed,
            details
        });
    };

    const sharedFile = path.join(ROOT, 'docs', 'handbook-html', 'shared', 'handbook-content.js');
    const modernIndex = path.join(ROOT, 'docs', 'handbook-html', 'modern', 'index.html');
    const modernCss = path.join(ROOT, 'docs', 'handbook-html', 'modern', 'style.css');
    const modernJs = path.join(ROOT, 'docs', 'handbook-html', 'modern', 'app.js');
    const nativeIndex = path.join(ROOT, 'docs', 'handbook-html', 'gcs-native', 'index.html');
    const nativeProjectJs = path.join(ROOT, 'docs', 'handbook-html', 'gcs-native', 'project.js');

    const { checkIntegrity } = requireCjs('../scripts/cms/cms-project.cjs');
    const inspectSeq = (seq: any[], counter: { count: number }) => {
        for (const step of seq || []) {
            if (step.type === 'action' && step.name) continue;
            if (step.type === 'condition') {
                inspectSeq(step.then || [], counter);
                inspectSeq(step.else || [], counter);
                continue;
            }
            counter.count++;
        }
    };

    // Optionaler Check für Wurzel-Ausgabe (falls nicht in Unterordner verschoben)
    const rootFilesExist = [sharedFile, modernIndex, modernCss, modernJs, nativeIndex, nativeProjectJs]
        .every(f => fs.existsSync(f));
    if (rootFilesExist) {
        check('Handbuch-HTML (Root): Alle Ziel- und Ausgabedateien existieren', true);
    }

    // 6. Argon-Editionen (docs/handbook-html/Argon/) prüfen
    const argonDir = path.join(ROOT, 'docs', 'handbook-html', 'Argon');
    const argonSharedJs = path.join(argonDir, 'shared', 'handbook-data.js');
    const argonModernIndex = path.join(argonDir, 'modern', 'index.html');
    const argonModernCss = path.join(argonDir, 'modern', 'styles.css');
    const argonModernJs = path.join(argonDir, 'modern', 'app.js');
    const argonNativeIndex = path.join(argonDir, 'gcs-native', 'index.html');
    const argonNativeProjectJson = path.join(argonDir, 'gcs-native', 'handbook-project.json');
    const argonReadme = path.join(argonDir, 'README.md');

    const argonFilesExist = [
        argonSharedJs, argonModernIndex, argonModernCss, argonModernJs,
        argonNativeIndex, argonNativeProjectJson, argonReadme
    ].every(f => fs.existsSync(f));
    check('Handbuch-HTML (Argon): Alle Dateien in docs/handbook-html/Argon/ existieren', argonFilesExist);

    if (argonFilesExist) {
        const sandboxArgonShared: any = { window: {} };
        vm.runInNewContext(fs.readFileSync(argonSharedJs, 'utf-8'), sandboxArgonShared);
        const argonData = sandboxArgonShared.window.GCS_HANDBOOK_DATA;
        check('Handbuch-HTML (Argon Shared): Alle 23 Kapitel inkl. Sprecher-Drehbücher und Checklisten vorhanden',
            Array.isArray(argonData?.chapters) &&
            argonData.chapters.length === 23 &&
            argonData.chapters.every((c: any) => c.mediaSection && c.mediaSection.script && c.modernHtml && c.nativeHtmlNormal),
            true,
            `Argon-Kapitel: ${argonData?.chapters?.length ?? 0}`);

        const argonProject = JSON.parse(fs.readFileSync(argonNativeProjectJson, 'utf-8'));
        const argonBlueprint = argonProject.stages?.[0];
        const argonCounter = { count: 0 };
        for (const s of argonProject.stages || []) {
            for (const t of s.tasks || []) {
                inspectSeq(t.actionSequence || [], argonCounter);
            }
        }
        const argonIssues = checkIntegrity(argonProject);
        check('Handbuch-HTML (Argon GCS Native): 26 Stages, Blueprint-Host, 0 Inline-Actions & 0 Integritätsfehler',
            argonProject.stages?.length === 26 &&
            argonBlueprint?.id === 'stage_blueprint' &&
            argonBlueprint?.type === 'blueprint' &&
            argonCounter.count === 0 &&
            argonIssues.length === 0,
            true,
            argonIssues.length ? JSON.stringify(argonIssues.slice(0, 3)) : '0 Befunde');
    }

    // 7. GCS Documentation Portal — Argon (docs/gcs-doc-portal-argon/) prüfen
    const portalDir = path.join(ROOT, 'docs', 'gcs-doc-portal-argon');
    const portalCodeFiles = [
        'index-argon.html',
        'styles-argon.css',
        'app-argon.js',
        'views-argon.js',
        'build-argon.cjs',
        'parser-argon.cjs',
        'portal-config-argon.json',
        'README-ARGON.md',
        'ARCHITEKTUR-ARGON.md'
    ];
    const portalDataJson = path.join(portalDir, 'data', 'portal-data-argon.json');
    const portalDataJs = path.join(portalDir, 'data', 'portal-data-argon.js');

    const allPortalFilesExist = portalCodeFiles.every(f => fs.existsSync(path.join(portalDir, f))) &&
        fs.existsSync(portalDataJson) &&
        fs.existsSync(portalDataJs);
    const allPortalFilesUnder1000Lines = portalCodeFiles.every(f => {
        const p = path.join(portalDir, f);
        if (!fs.existsSync(p)) return false;
        return fs.readFileSync(p, 'utf-8').split(/\r?\n/).length <= 1000;
    });

    check('GCS Doc Portal (Argon): Alle -argon-Dateien existieren und halten das 1000-Zeilen-Limit ein',
        allPortalFilesExist && allPortalFilesUnder1000Lines);

    if (allPortalFilesExist) {
        const sandboxPortal: any = { window: {} };
        vm.runInNewContext(fs.readFileSync(portalDataJs, 'utf-8'), sandboxPortal);
        vm.runInNewContext(fs.readFileSync(path.join(portalDir, 'views-argon.js'), 'utf-8'), sandboxPortal);

        const pData = sandboxPortal.window.GCS_PORTAL_DATA_ARGON;
        const pViews = sandboxPortal.window.ArgonPortalViews;

        check('GCS Doc Portal (Argon): Vollständige Datenbasis (23 Kapitel, 128 Komponenten, 12 Features, 4 Architektur-Doks, 59 Actions, 242 Docs)',
            pData?.handbook?.chapters?.length === 23 &&
            pData?.components?.items?.length === 128 &&
            pData?.features?.inventory?.length === 12 &&
            pData?.features?.articles?.length >= 12 &&
            pData?.architecture?.articles?.length === 4 &&
            pData?.devref?.actions?.length === 59 &&
            pData?.devref?.documentInventory?.length === 242 &&
            Array.isArray(pData?.searchIndex) &&
            pData.searchIndex.length >= 240,
            true,
            `Kapitel: ${pData?.handbook?.chapters?.length}, Komp.: ${pData?.components?.items?.length}, Features: ${pData?.features?.inventory?.length}, Sucheinträge: ${pData?.searchIndex?.length}`);

        const spriteComp = (pData?.components?.items || []).find((c: any) => c.name === 'TSprite');
        const swe2Cfg = pData?.meta?.swe2Integration;
        check('GCS Doc Portal (Argon): Bidirektionale Querverweise (TSprite ↔ Kapitel/Features) & SWE-2-Datenschnittstelle dokumentiert',
            Boolean(spriteComp) &&
            spriteComp.id === 'COMP-0097' &&
            Array.isArray(spriteComp.usedInChapters) &&
            spriteComp.usedInChapters.length > 0 &&
            Boolean(swe2Cfg?.joinKeys?.component) &&
            Boolean(swe2Cfg?.joinKeys?.feature) &&
            Array.isArray(swe2Cfg?.optionalOverlayFiles) &&
            swe2Cfg.optionalOverlayFiles.length >= 3);

        const homeHtml = pViews.renderPortalHome(pData, { checkedItems: {}, completedChapters: {} }, { isChapterDone: () => false });
        const compDetailHtml = pViews.renderComponentDetail(spriteComp, pData);
        const actionsHtml = pViews.renderDevRefOverview(pData, { devSubView: 'actions', actionQuery: 'navigate_stage' });
        check('GCS Doc Portal (Argon): Views rendern Portal-Home, Komponenten-Steckbrief (TSprite) und Action-Katalog fehlerfrei',
            homeHtml.includes('Willkommen in der zentralen GCS-Wissensplattform') &&
            compDetailHtml.includes('COMP-0097') &&
            actionsHtml.includes('navigate_stage'));

        // Schlechtfall: XSS-/Script-Injektion in Markdown wird vom Argon-Parser sicher entschärft
        const parserArgon = requireCjs('../docs/gcs-doc-portal-argon/parser-argon.cjs');
        const maliciousParsed = parserArgon.parseMarkdownBlocks(
            '# Test\n\nBöser Code: <script>alert("xss")</script> mit `TSprite`.',
            { docId: 'xss-test', knownComponents: new Set(['TSprite']) }
        );
        const hasRawScriptTag = String(maliciousParsed.html || '').includes('<script>');
        check('GCS Doc Portal (Argon Schlechtfall): Rohe <script>-Tags in Markdown werden bei der HTML-Generierung entschärft',
            !hasRawScriptTag,
            false,
            'Kein unausgefiltertes <script>-Tag im generierten HTML enthalten');
    }

    return results;
}


