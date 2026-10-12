/**
 * OverlayPlacementValidator — Editorhinweise fuer platzierbare Overlays.
 *
 * Meldet Ueberschneidungen der kompakten und der aufgeklappten Flaeche
 * mit Stagegrenzen, sichtbaren Bedienelementen und Objekten mit dem
 * Opt-in protectFromOverlay. Warnungen sind Hinweise, keine Sperren:
 * absichtliche Ueberlagerungen bleiben erlaubt; versteckte Objekte und
 * reine Hintergrundflaechen werden nicht beanstandet.
 */

interface Rect { x: number; y: number; width: number; height: number; }

const INTERACTIVE_CLASSES = new Set([
    'TButton', 'TEdit', 'TNumberInput', 'TMemo', 'TDropdown', 'TCheckbox',
    'TVirtualGamepad', 'TSpeechRecognition', 'TTable', 'TObjectList',
    'TList', 'TDataList', 'TTabControl', 'TCardZone', 'TPuzzleBoard',
    'TEmojiPicker', 'TColorPicker', 'TFilePicker', 'TLink', 'TNavBar',
    'TTabBar', 'TGridBoard', 'TTetris'
]);

const PASSIVE_BACKGROUND = new Set([
    'TShape', 'TParallaxBackground', 'TImage', 'TSprite', 'TSpriteTemplate'
]);

function intersects(a: Rect, b: Rect): boolean {
    return a.x < b.x + b.width && a.x + a.width > b.x
        && a.y < b.y + b.height && a.y + a.height > b.y;
}

function labelOf(obj: any): string {
    return obj.name || obj.caption || obj.text || obj.className || 'Objekt';
}

export class OverlayPlacementValidator {

    /**
     * Prueft Kompakt- und Detailflaeche eines Overlay-Objekts.
     * Rueckgabe: konkrete, lesbare Warnhinweise (leer = unauffaellig).
     */
    public static validate(overlay: any, objects: any[], grid: { cols: number; rows: number } | undefined,
        layoutValue?: (obj: any, prop: 'x' | 'y' | 'width' | 'height') => number,
        resolvedValue?: (obj: any, prop: 'x' | 'y') => number): string[] {
        const warnings: string[] = [];
        if (!overlay || !grid) return warnings;

        const compact: Rect = {
            x: Number(overlay.x) || 0, y: Number(overlay.y) || 0,
            width: Number(overlay.width) || 1, height: Number(overlay.height) || 1
        };
        const eb = overlay.expandedBounds;
        const expanded: Rect | null = eb ? {
            x: Number(eb.x) || 0, y: Number(eb.y) || 0,
            width: Number(eb.width) || 1, height: Number(eb.height) || 1
        } : null;

        const checkBounds = (r: Rect, label: string) => {
            if (r.x < 0 || r.y < 0 || r.x + r.width > grid.cols || r.y + r.height > grid.rows) {
                warnings.push(`${label} liegt ausserhalb der Stage (${grid.cols}×${grid.rows}).`);
            }
        };
        checkBounds(compact, 'Kompakte Anzeige');
        if (expanded) checkBounds(expanded, 'Detailansicht');

        const overlayId = overlay.id || overlay.name;
        const byId = new Map((objects || []).filter(Boolean).map(obj => [obj.id || obj.name, obj]));
        const value = (obj: any, prop: 'x' | 'y' | 'width' | 'height') =>
            layoutValue ? layoutValue(obj, prop) : Number(obj[prop]) || (prop === 'width' || prop === 'height' ? 1 : 0);
        for (const other of objects || []) {
            if (!other || (other.id || other.name) === overlayId) continue;
            if (other.visible === false || other.style?.visible === false) continue;
            if (other.isHiddenInRun || other.isService || other.isBlueprintOnly) continue;
            const cls = other.className || '';
            if (PASSIVE_BACKGROUND.has(cls) && other.protectFromOverlay !== true) continue;

            const protectedObj = other.protectFromOverlay === true;
            const interactive = INTERACTIVE_CLASSES.has(cls)
                || !!(other.events?.onClick || other.Tasks?.onClick || other.events?.onTouch)
                || protectedObj;
            if (!interactive) continue;

            const r: Rect = {
                x: value(other, 'x'), y: value(other, 'y'),
                width: value(other, 'width'), height: value(other, 'height')
            };
            const visited = new Set([other.id || other.name]);
            let parent = byId.get(other.parentId);
            let hidden = false;
            while (parent) {
                const id = parent.id || parent.name;
                if (visited.has(id)) { hidden = true; break; }
                visited.add(id);
                if (parent.visible === false || parent.style?.visible === false || parent.isHiddenInRun) {
                    hidden = true; break;
                }
                // Aligned positions are already absolute in StageLayoutEngine.
                if (!other.align || other.align === 'NONE') {
                    r.x += resolvedValue ? resolvedValue(parent, 'x') : Number(parent.x) || 0;
                    r.y += resolvedValue ? resolvedValue(parent, 'y') : Number(parent.y) || 0;
                }
                parent = byId.get(parent.parentId);
            }
            if (hidden) continue;
            if (intersects(compact, r)) {
                warnings.push(`Kompakte Anzeige überdeckt „${labelOf(other)}“.`);
            }
            if (expanded && intersects(expanded, r)) {
                warnings.push(`Detailansicht überdeckt „${labelOf(other)}“.`);
            }
        }
        return warnings;
    }
}
