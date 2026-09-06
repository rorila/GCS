import { Logger } from '../utils/Logger';

const logger = Logger.get('TouchHardening', 'Runtime_Execution');

/**
 * Haertet ein laufendes Spiel gegen unerwuenschte Browser-Gesten auf Tablets.
 *
 * Ohne diese Vorkehrungen zoomt Safari beim Aufziehen mit zwei Fingern, zeigt bei
 * langem Tippen das Kopieren-Menue, markiert Text und laesst die Seite beim
 * Wischen ueber den Rand federn. Das Spiel laeuft dann technisch einwandfrei und
 * wirkt fuer ein Kind trotzdem defekt.
 *
 * Absichtlich nur fuer Player und Export, NICHT fuer den Editor: dort sind
 * Textauswahl, Kontextmenue und Zoom erwuenscht.
 *
 * Die Regeln stehen hier gebuendelt und nicht in den HTML-Vorlagen, weil es vier
 * Vorlagen gibt (zwei im GameExporter, player.html, iframe-runner.html) und diese
 * bereits auseinandergedriftet waren: der Export hatte `touch-action`, player.html
 * nicht.
 */

const STYLE_ID = 'gcs-touch-hardening';

/**
 * CSS-Regeln der Haertung.
 *
 * Bewusst KEIN `touch-action: none` auf html/body: Der Browser sucht die erlaubten
 * Gesten von der beruehrten Stelle aufwaerts. Ein `none` auf body wuerde auch das
 * Wischen in scrollbaren Bereichen (Tabellen, Seitenleisten) unterbinden. Die
 * Buehne selbst deckt den Spielbereich ab, und `overscroll-behavior` verhindert
 * das Federn ausserhalb.
 */
const HARDENING_CSS = `
html, body {
    overscroll-behavior: none;
    -webkit-user-select: none;
    user-select: none;
    -webkit-touch-callout: none;
    -webkit-tap-highlight-color: transparent;
    touch-action: none;
}

#stage, #run-stage {
    touch-action: none;
}

/* Eingabefelder brauchen Auswahl und Kontextmenue weiterhin, sonst kann ein Kind
   in einem Textfeld nichts korrigieren. */
input, textarea, select, [contenteditable="true"] {
    -webkit-user-select: text;
    user-select: text;
    -webkit-touch-callout: default;
    touch-action: auto;
}
`;

let applied = false;

/**
 * Wendet die Haertung an. Mehrfaches Aufrufen ist unschaedlich.
 */
export function applyTouchHardening(): void {
    if (typeof document === 'undefined') return;
    if (applied) return;
    applied = true;

    injectStyle();
    blockSafariGestures();
    blockLongPressMenu();
    blockDoubleTapZoom();
    blockMultiTouchZoom();
    blockTouchZoomScroll();
    clampViewport();

    logger.info('[TouchHardening] Browser-Gesten fuer Spielbetrieb eingeschraenkt');
}

function injectStyle(): void {
    if (document.getElementById(STYLE_ID)) return;

    const style = document.createElement('style');
    style.id = STYLE_ID;
    style.textContent = HARDENING_CSS;

    // In <head>, falls vorhanden — sonst an den Anfang des Dokuments.
    (document.head || document.documentElement).appendChild(style);
}

/**
 * Unterdrueckt das Zoomen per Zwei-Finger-Geste in Safari.
 *
 * Notwendig, weil Safari auf dem iPad `user-scalable=no` je nach Version
 * ignoriert. Diese Ereignisse gibt es nur in WebKit; andere Browser liefern sie
 * nicht, dann ist die Registrierung wirkungslos und stoert nicht.
 *
 * `passive: false` ist zwingend — ohne diese Angabe darf `preventDefault()` nichts
 * bewirken.
 */
function blockSafariGestures(): void {
    const stop = (e: Event) => e.preventDefault();

    document.addEventListener('gesturestart', stop, { passive: false });
    document.addEventListener('gesturechange', stop, { passive: false });
    document.addEventListener('gestureend', stop, { passive: false });
}

/**
 * Unterdrueckt das Kontextmenue bei langem Tippen — aber nicht in Eingabefeldern.
 */
function blockLongPressMenu(): void {
    document.addEventListener('contextmenu', (e: Event) => {
        const target = e.target as HTMLElement | null;
        if (isTextEntry(target)) return;
        e.preventDefault();
    });
}

function isTextEntry(el: HTMLElement | null): boolean {
    if (!el) return false;
    const tag = el.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
    return el.isContentEditable === true;
}

/**
 * Verhindert Scrollen und Zoomen bei jedem Touch außer in Eingabefeldern.
 * Wichtig, weil iOS Zoom/Scroll sonst auch bei virtuellen Gamepads ausloesen kann.
 */
function blockTouchZoomScroll(): void {
    const stop = (e: TouchEvent) => {
        if (e.touches.length > 1) {
            e.preventDefault();
            return;
        }
        const target = e.target as HTMLElement | null;
        if (isTextEntry(target)) return;
        e.preventDefault();
    };

    document.addEventListener('touchstart', stop, { passive: false });
    document.addEventListener('touchmove', stop, { passive: false });
    document.addEventListener('touchend', stop, { passive: false });
}

/**
 * Verhindert Zoom per Doppelklick/-tap auf aelteren iOS-Versionen.
 */
function blockDoubleTapZoom(): void {
    let lastTap = 0;
    const TAP_DELAY = 300;

    document.addEventListener('touchstart', (e: TouchEvent) => {
        const now = performance.now();
        if (now - lastTap < TAP_DELAY) {
            // Doppeltap erkannt: verhindern, damit Safari nicht zoomt
            e.preventDefault();
        }
        lastTap = now;
    }, { passive: false });
}

/**
 * Verhindert Zoom-Gesten mit mehreren Fingern.
 */
function blockMultiTouchZoom(): void {
    document.addEventListener('touchmove', (e: TouchEvent) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });

    document.addEventListener('touchstart', (e: TouchEvent) => {
        if (e.touches.length > 1) {
            e.preventDefault();
        }
    }, { passive: false });
}

/**
 * Sorgt dafuer, dass das viewport-meta-Tag die Skalierung verbietet.
 * Fuegt das Tag nach, falls es fehlt, oder korrigiert es.
 */
function clampViewport(): void {
    let meta = document.querySelector('meta[name="viewport"]') as HTMLMetaElement | null;
    if (!meta) {
        meta = document.createElement('meta');
        meta.name = 'viewport';
        document.head.appendChild(meta);
    }
    const wanted = 'width=device-width, initial-scale=1.0, maximum-scale=1.0, minimum-scale=1.0, user-scalable=no, viewport-fit=cover';
    if (meta.content !== wanted) {
        meta.content = wanted;
    }
}
