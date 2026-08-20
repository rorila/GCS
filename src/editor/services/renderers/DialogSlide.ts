/**
 * Gemeinsame Berechnung des Slide-Offsets fuer Dialoge und Side-Panels.
 *
 * Hintergrund: Ein verstecktes Dialog-Element wird nicht auf display:none gesetzt
 * (das wuerde die CSS-Transition zerstoeren), sondern per translate aus dem Bild
 * geschoben. Der Offset muss fuer den Dialog UND seine Kinder identisch sein,
 * sonst laufen sie beim Ein-/Ausblenden auseinander.
 *
 * TDialogRoot/TThemeDialog stehen frei (oft zentriert) auf der Stage und brauchen
 * einen pauschal grossen Offset. Ein TSidePanel dockt am Rand an: dort genuegt die
 * eigene Panel-Breite. Ein zu grosser Offset laesst die 0.4s-Transition optisch
 * wie ein sofortiges Verschwinden aussehen, weil der sichtbare Teil des Weges nur
 * einen Bruchteil der Gesamtstrecke ausmacht.
 */

const FAR_OFFSET_PX = 1500;
const SIDE_PANEL_MARGIN_PX = 40;

/**
 * Liefert den horizontalen Offset in Pixeln, um den ein verstecktes Dialog-Element
 * verschoben wird. Negativ = nach links, positiv = nach rechts.
 *
 * @param dialogObj Das Dialog- bzw. Side-Panel-Objekt (NICHT das Kind).
 * @param cellSize  Aktuelle Grid-Zellengroesse in Pixeln.
 */
export function getDialogSlideOffset(dialogObj: any, cellSize: number): number {
    if (!dialogObj) return FAR_OFFSET_PX;

    const className = dialogObj.className || dialogObj.constructor?.name;
    const isSidePanel = className === 'TSidePanel';
    const isLeft = isSidePanel
        ? dialogObj.side === 'left'
        : dialogObj.slideDirection === 'left';

    if (!isSidePanel) {
        return isLeft ? -FAR_OFFSET_PX : FAR_OFFSET_PX;
    }

    const widthCells = Number(dialogObj.width);
    const widthPx = Number.isFinite(widthCells) && widthCells > 0
        ? widthCells * cellSize
        : FAR_OFFSET_PX;
    const distance = widthPx + SIDE_PANEL_MARGIN_PX;

    return isLeft ? -distance : distance;
}
