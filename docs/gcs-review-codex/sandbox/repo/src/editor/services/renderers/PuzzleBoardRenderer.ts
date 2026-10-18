/**
 * Rendert die Puzzle-Zielablage: Rahmen + Zielbild als transparentes
 * Geisterbild (Orientierungshilfe). Keine Rasterlinien — das Kind sieht
 * nur, wie das fertige Bild aussehen soll.
 */
export class PuzzleBoardRenderer {
    public static render(el: HTMLElement, obj: any): void {
        let ghost = el.querySelector('.puzzle-board-ghost') as HTMLElement | null;
        if (!ghost || ghost.parentElement !== el) {
            ghost = document.createElement('div');
            ghost.className = 'puzzle-board-ghost';
            ghost.style.cssText = 'position:absolute;inset:0;pointer-events:none;background-repeat:no-repeat;background-size:contain;background-position:center;';
            el.appendChild(ghost);
        }
        const source = obj.imageSource || '';
        const opacity = Math.max(0, Math.min(1, Number(obj.ghostOpacity ?? 0.3)));
        ghost.style.backgroundImage = source ? `url("${source}")` : 'none';
        ghost.style.opacity = String(opacity);

        el.style.border = el.style.border || '2px dashed rgba(255,255,255,0.35)';
        el.style.borderRadius = el.style.borderRadius || '8px';
    }
}
