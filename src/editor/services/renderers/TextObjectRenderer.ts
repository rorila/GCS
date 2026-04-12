import { IRenderContext } from './IRenderContext';

export class TextObjectRenderer {
    
    public static renderLabel(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const textValue = (obj.text !== undefined && obj.text !== null) ? String(obj.text) :
            (obj.value !== undefined && obj.value !== null) ? String(obj.value) : '';
        if (el.innerText !== textValue) el.innerText = textValue;
        const fs = obj.style?.fontSize || obj.fontSize;
        if (fs) el.style.fontSize = ctx.scaleFontSize(fs);
        
        const color = obj.style?.color;
        if (color) {
            el.style.color = color;
        } else {
            el.style.color = '';
        }
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
        const fstyle = obj.style?.fontStyle;
        el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
        el.style.userSelect = 'text';
        el.style.cursor = 'text';
        const align = obj.style?.textAlign || obj.alignment;
        if (align === 'center') el.style.justifyContent = 'center';
        else if (align === 'right') el.style.justifyContent = 'flex-end';
        else el.style.justifyContent = 'flex-start';
    }

    public static renderPanel(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        const textValue = obj.caption || (ctx.host.runMode ? '' : obj.name);
        if (el.innerText !== textValue) el.innerText = textValue;

        const color = obj.style?.color || (!ctx.host.runMode ? '#777' : '');
        if (color) el.style.color = color;
        const fontSize = obj.style?.fontSize ? ctx.scaleFontSize(obj.style.fontSize) : (!ctx.host.runMode ? ctx.scaleFontSize(12) : '');
        if (fontSize) el.style.fontSize = fontSize;
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : (fw || 'normal');
        const fs = obj.style?.fontStyle;
        el.style.fontStyle = (fs === true || fs === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
        const align = obj.style?.textAlign || 'center';
        el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        el.style.alignItems = 'center';
    }

    public static renderRichText(ctx: IRenderContext, el: HTMLElement, obj: any): void {
        let textValue = obj.htmlContent || (ctx.host.runMode ? '' : `<i>${obj.name} (leeres RichText)</i>`);

        // KRITISCH: Der WYSIWYG-Editor (document.execCommand('foreColor')) erzeugt
        // deprecated <font color="..."> Tags. Deren Farb-Zuweisung ist ein "Presentational Hint"
        // mit CSS-Spezifität 0 und wird im Run-Mode von CSS-Regeln überschrieben.
        // Lösung: Konvertierung zu <span style="color:..."> (Inline-Spezifität 1,0,0,0).
        if (textValue.includes('<font ')) {
            textValue = textValue.replace(
                /<font\s+color="([^"]+)">/gi,
                '<span style="color:$1">'
            ).replace(/<\/font>/gi, '</span>');
        }

        // innerHTML verwenden, damit <b>, <i>, <span style="color:"> etc. greifen
        if (el.innerHTML !== textValue) {
            el.innerHTML = textValue;
        }

        // --- Link-Klicks abfangen ---
        if (ctx.host.runMode) {
            // WICHTIG: Ersetze 'stage:' hrefs durch javascript:void(0) um zu verhindern,
            // dass der Browser (besonders in IFrames) Fehler wirft ('Failed to launch scheme').
            const anchors = el.querySelectorAll('a');
            anchors.forEach(a => {
                const href = a.getAttribute('href');
                if (href && href.startsWith('stage:')) {
                    a.setAttribute('data-stage', href);
                    a.setAttribute('href', 'javascript:void(0)');
                }
            });

            el.onclick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                const anchor = target.closest('a');
                if (anchor) {
                    const stageHref = anchor.getAttribute('data-stage') || anchor.getAttribute('href');
                    if (stageHref && stageHref.startsWith('stage:')) {
                        e.preventDefault();
                        e.stopPropagation();
                        
                        const stageId = stageHref.substring(6);
                        
                        // Nutzt das native Runtime-Routing über das onNavigate Callback,
                        if (ctx.host.onEvent) {
                            ctx.host.onEvent('system', '__SYSTEM_NAVIGATE__', { target: `stage:${stageId}` });
                        } else {
                            console.warn('[TextObjectRenderer] ctx.host.onEvent nicht vorhanden. Stage-Wechsel fehlgeschlagen.');
                        }
                    }
                }
            };
        } else {
            // Im Editor-Modus native Klicks auf Links blockieren (sonst navigiert Electron weg)
            el.onclick = (e: MouseEvent) => {
                const target = e.target as HTMLElement;
                if (target.closest('a')) {
                    e.preventDefault();
                }
            };
        }

        // --- Farbe ---
        // Konstruktor-Default ist '#000000'. Kein falscher Fallback wie '#eee' im Editor.
        // Die Container-Farbe dient als Vererbungsbasis; Inline-Farben im HTML
        // (z.B. <font color="#ff0000">) haben höhere Spezifität und überschreiben sie.
        const color = obj.style?.color;
        if (color) {
            el.style.color = color;
        } else {
            el.style.color = ''; // Browser-Default erben lassen
        }

        // --- Schriftgröße (KRITISCH: war vorher nicht gesetzt → inkonsistente Darstellung) ---
        const fs = obj.style?.fontSize;
        if (fs) {
            el.style.fontSize = ctx.scaleFontSize(fs);
        }

        // --- Typografie ---
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : (fw || 'normal');
        const fstyle = obj.style?.fontStyle;
        el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;

        // --- Ausrichtung ---
        const align = obj.style?.textAlign || 'left';

        // Flexbox: vertikale Anordnung, damit <h1>, <p> etc. korrekt fließen
        el.style.display = 'flex';
        el.style.flexDirection = 'column';
        el.style.justifyContent = 'center'; // vertikal zentriert (wie andere Game-Objekte)
        // WICHTIG: alignItems MUSS 'stretch' sein, damit <h1>, <p> etc. die volle
        // Container-Breite einnehmen. Nur so wirken die Inline-Styles
        // (z.B. <h1 style="text-align: left">) aus dem WYSIWYG-Editor korrekt.
        // Bei 'center'/'flex-start'/'flex-end' schrumpfen die Kinder auf Inhaltsbreite
        // und text-align wird wirkungslos.
        el.style.alignItems = 'stretch';
        // textAlign auf dem Container dient als Fallback/Default für Elemente
        // ohne eigenen Inline-Style aus dem WYSIWYG-Editor
        el.style.textAlign = align;

        // --- Padding ---
        if (obj.style?.padding) {
            el.style.padding = typeof obj.style.padding === 'number'
                ? `${obj.style.padding}px`
                : obj.style.padding;
        }

        // --- Overflow ---
        el.style.overflowY = 'auto';
        el.style.overflowX = 'hidden';
    }

    public static renderGameHeader(_ctx: IRenderContext, el: HTMLElement, obj: any): void {
        if (el.innerText !== (obj.title || obj.caption || obj.name)) el.innerText = obj.title || obj.caption || obj.name;
        el.style.fontSize = obj.style?.fontSize ? (typeof obj.style.fontSize === 'number' ? `${obj.style.fontSize}px` : obj.style.fontSize) : '18px';
        if (obj.style?.color) el.style.color = obj.style.color;
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : (fw || 'bold');
        const align = obj.style?.textAlign;
        el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
    }

    public static renderGameCard(ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        if (isNew) {
            el.innerHTML = `
                <div class="card-title" style="font-weight:bold;margin-bottom:10px"></div>
                <div class="card-btns" style="display:flex;gap:5px">
                    <button class="btn-single" style="padding:6px;border:none;border-radius:4px;background:#4caf50;color:#fff;cursor:pointer">▶ Single</button>
                    <button class="btn-multi" style="padding:6px;border:none;border-radius:4px;background:#2196f3;color:#fff;cursor:pointer">👥 Multi</button>
                </div>
            `;
            el.style.flexDirection = 'column';
            el.querySelector('.btn-single')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (ctx.host.onEvent) ctx.host.onEvent(obj.id, 'onSingleClick');
            });
            el.querySelector('.btn-multi')?.addEventListener('click', (e) => {
                e.stopPropagation();
                if (ctx.host.onEvent) ctx.host.onEvent(obj.id, 'onMultiClick');
            });
        }
        const titleEl = el.querySelector('.card-title') as HTMLElement;
        if (titleEl && titleEl.innerText !== obj.gameName) titleEl.innerText = obj.gameName;
    }

    public static renderButton(ctx: IRenderContext, el: HTMLElement, obj: any, _isNew: boolean): void {
        if (el.querySelector('.table-title-bar')) el.innerHTML = '';
        if (el.innerText !== (obj.caption || obj.name)) el.innerText = obj.caption || obj.name;
        const fw = obj.style?.fontWeight;
        el.style.fontWeight = (fw === true || fw === 'bold') ? 'bold' : 'normal';
        const fstyle = obj.style?.fontStyle;
        el.style.fontStyle = (fstyle === true || fstyle === 'italic') ? 'italic' : 'normal';
        if (obj.style?.fontSize) el.style.fontSize = ctx.scaleFontSize(obj.style.fontSize);
        if (obj.style?.color) el.style.color = obj.style.color;
        if (obj.style?.fontFamily) el.style.fontFamily = obj.style.fontFamily;
        const align = obj.style?.textAlign;
        el.style.justifyContent = align === 'left' ? 'flex-start' : (align === 'right' ? 'flex-end' : 'center');
        if (ctx.host.runMode) {
            el.onmouseenter = () => el.style.filter = 'brightness(1.1)';
            el.onmouseleave = () => {
                el.style.filter = 'none';
                el.style.transform = el.style.transform.replace(' scale(0.98)', '');
            };
            el.onmousedown = () => {
                if (!el.style.transform.includes('scale(0.98)')) {
                    el.style.transform += ' scale(0.98)';
                }
            };
            el.onmouseup = () => el.style.transform = el.style.transform.replace(' scale(0.98)', '');
            el.onclick = (e: MouseEvent) => {
                e.stopPropagation();
                if (ctx.host.onEvent) {
                    ctx.host.onEvent(obj.id, 'onClick');
                }
            };
        }
    }
}
