import { DebugLogService } from '../services/DebugLogService';

/** Bridges the existing CMS SpielURL contract to the editor/player browser host. */
export function attachCmsGameHost(getRuntime: () => any): () => void {
    // The CMS server page already includes its original host.
    if (document.querySelector('script[src="/cms-shell.js"]')) return () => {};
    let layer: HTMLElement | undefined;
    let frame: HTMLIFrameElement | undefined;
    let request: AbortController | undefined;
    let disposed = false;
    const log = (message: string) => DebugLogService.getInstance().log('System', message, {objectName: 'SpielURL'});
    const close = () => {
        request?.abort();
        if (frame) frame.src = 'about:blank';
        layer?.remove();
        layer = undefined;
        frame = undefined;
    };
    const timer = window.setInterval(async () => {
        const objects = getRuntime()?.getObjects() || [];
        if (!objects.some((o: any) => o.name === 'CMSServerPruefung')) return;
        const launch = objects.find((o: any) => o.name === 'SpielURL');
        if (!launch?.value) return;
        const url = String(launch.value);
        launch.value = '';
        close();
        layer = document.createElement('section');
        layer.setAttribute('aria-label', 'CMS-Spiel');
        layer.style.cssText = 'position:fixed;inset:0;background:#08151b;color:white;z-index:10000';
        const back = document.createElement('button');
        back.textContent = '⬅ Zurück zur Galerie';
        back.style.cssText = 'height:52px;font-size:20px;cursor:pointer';
        const status = document.createElement('p');
        status.textContent = 'Spiel wird geladen …';
        back.onclick = () => { close(); log('Spiel geschlossen – zurück zur Galerie'); };
        layer.append(back, status);
        document.body.append(layer);
        if (!/^\/play\/[a-f0-9]{48}$/.test(url)) {
            status.textContent = 'Der Server hat keinen gültigen Spiellink geliefert.';
            log(status.textContent);
            return;
        }
        const controller = new AbortController();
        request = controller;
        const timeout = window.setTimeout(() => controller.abort(), 10000);
        try {
            const response = await fetch(url, {signal: controller.signal, cache: 'no-store'});
            if (!response.ok || !response.headers.get('content-type')?.includes('text/html')) {
                throw new Error('Spiel konnte nicht geladen werden (HTTP ' + response.status + '). Bitte erneut anmelden und die Freigabe prüfen.');
            }
            await response.body?.cancel();
            if (disposed || request !== controller || !layer) return;
            frame = document.createElement('iframe');
            frame.title = 'Ausgewähltes Spiel';
            frame.setAttribute('sandbox', 'allow-scripts allow-same-origin');
            frame.style.cssText = 'display:block;width:100%;height:calc(100% - 52px);border:0';
            frame.src = url;
            status.remove();
            layer.append(frame);
            log('Freigegebenes Spiel im Player geöffnet');
        } catch (error) {
            if (disposed || request !== controller || !layer) return;
            status.textContent = controller.signal.aborted
                ? 'Der Spielserver antwortet nicht rechtzeitig. Bitte erneut versuchen.'
                : error instanceof Error ? error.message : 'Spielserver nicht erreichbar.';
            log(status.textContent);
        } finally { window.clearTimeout(timeout); }
    }, 100);
    return () => { disposed = true; window.clearInterval(timer); close(); };
}
