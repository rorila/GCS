import { test, expect } from '@playwright/test';
import { readFileSync } from 'fs';

const project = JSON.parse(readFileSync(new URL('../../game-server/public/projects/GCS-FeatureVideos.json', import.meta.url), 'utf8'));

test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 1280, height: 800 });
    await page.route('**/*', route => ['GET', 'HEAD', 'OPTIONS'].includes(route.request().method())
        ? route.continue() : route.abort());
    await page.goto('/');
    await page.waitForFunction(() => !!(window as any).editor);
    await page.evaluate(async data => {
        const editor = (window as any).editor;
        editor.loadProject(data);
        await new Promise(resolve => setTimeout(resolve, 500));
        await editor.switchView('run');
        await new Promise(resolve => setTimeout(resolve, 300));
        // Run-Mode im Editor startet erst per Button-Klick -> runtime.start()
        const btn = document.getElementById('run-start-game-btn');
        if (btn) btn.click();
        else (window as any).editor?.runtime?.start?.();
    }, structuredClone(project));
});

test('Landingpage: Manifest-Load, Listen und Video-Flow (echter Fetch via directFetch)', async ({ page }) => {
    const fetched: string[] = [];
    const consoleErrs: string[] = [];
    page.on('response', r => { if (r.url().includes('videos') || r.url().includes('json')) fetched.push(r.status() + ' ' + r.url()); });
    page.on('pageerror', e => consoleErrs.push('PAGEERROR: ' + e.message));
    page.on('console', m => { if (m.type() === 'error' || /RUN-FATAL|TTimer|initMainGame|START\(\)/.test(m.text())) consoleErrs.push(m.text().slice(0, 200)); });
    await page.waitForFunction(() => (window as any).editor?.runManager?.runStage, null, { timeout: 10000 });

    // Init-Task abwarten: InitialLaden-Timer -> Act_Manifest_Laden (echter fetch)
    // -> Act_Rollen_Fuellen -> RollenListe muss ohne manuelle Injektion gefuellt sein.
    const stage1: any = await page.evaluate(async () => {
        const runtime = (window as any).editor.runtime;
        const t0 = Date.now();
        let rollen: any;
        while (Date.now() - t0 < 5000) {
            rollen = runtime.objects.find((o: any) => o.name === 'RollenListe');
            if (rollen?.getRows?.().length > 0) break;
            await new Promise(r => setTimeout(r, 200));
        }
        const manifestVar = runtime.contextVars?.['Manifest'] ?? runtime.vars?.['Manifest'];
        const varObj = runtime.objects.find((o: any) => o.name === 'Manifest');
        const timer = runtime.objects.find((o: any) => o.name === 'InitialLaden');
        return {
            stageId: runtime.stage?.id,
            rollenRows: rollen?.getRows?.().length ?? -1,
            manifestOk: !!(manifestVar && manifestVar.rollen?.length),
            manifestRaw: JSON.stringify(manifestVar)?.slice(0, 200) ?? 'UNDEF',
            varObjVal: JSON.stringify(varObj?.value)?.slice(0, 200) ?? 'UNDEF',
            timer: timer ? { cur: timer.currentInterval, en: timer.enabled, max: timer.maxInterval, running: timer.isRunning, timerId: timer.timerId } : 'NICHT_GEFUNDEN',
            isMainGameStarted: runtime.isMainGameStarted,
            isSplashActive: runtime.isSplashActive,
            statusText: runtime.objects.find((o: any) => o.name === 'Status')?.text,
        };
    });
    stage1.fetches = fetched;
    stage1.consoleErrs = consoleErrs.slice(0, 6);
    console.log('  stage1:', JSON.stringify(stage1));
    expect(stage1.stageId).toBe('stage_auswahl');
    expect(stage1.rollenRows).toBeGreaterThan(0);

    // Rolle waehlen -> Aufgabenliste fuellen
    const chain = await page.evaluate(async () => {
        const runtime = (window as any).editor.runtime;
        const rollen = runtime.objects.find((o: any) => o.name === 'RollenListe');
        const aufgaben = runtime.objects.find((o: any) => o.name === 'AufgabenListe');
        rollen.selectedIndex = 0;
        rollen.selectedRecord = rollen.getRows()[0];
        rollen.selectedKey = rollen.selectedRecord.uid ?? rollen.selectedRecord.key ?? rollen.selectedRecord.id;
        await runtime.handleEvent(rollen.id, 'onSelect');
        await new Promise(r => setTimeout(r, 400));
        const aufgabenRows = aufgaben.getRows?.().length ?? -1;

        const a0 = aufgaben.getRows()[0];
        aufgaben.selectedIndex = 0;
        aufgaben.selectedRecord = a0;
        aufgaben.selectedKey = a0.uid;
        await runtime.handleEvent(aufgaben.id, 'onSelect');
        await new Promise(r => setTimeout(r, 900));
        const player = runtime.objects.find((o: any) => o.name === 'Player');
        const videoEl = document.querySelector('video');
        return {
            aufgabenRows,
            aufgabe0: { uid: a0.uid, video: a0.video, offset: a0.offset },
            newStage: runtime.stage?.id,
            videoSrc: player?.videoSource ?? player?._videoSource,
            isPlaying: player?.isPlaying ?? player?._isPlaying,
            titel: runtime.objects.find((o: any) => o.name === 'VideoTitel')?.text,
            domVideoSrc: videoEl?.getAttribute('src') ?? null,
            domCurrentTime: videoEl?.currentTime ?? null,
        };
    });
    console.log('  Kette:', JSON.stringify(chain));
    expect(chain.aufgabenRows).toBeGreaterThan(0);
    expect(chain.newStage).toBe('stage_video');
    expect(chain.videoSrc).toContain('videos/');
    expect(chain.titel).toBeTruthy();
    expect(chain.isPlaying).toBe(true);
    // Seek: DOM-Video muss auf/nach dem Kapitel-Offset stehen
    expect(chain.domCurrentTime).toBeGreaterThanOrEqual(chain.aufgabe0.offset - 0.15);
});
