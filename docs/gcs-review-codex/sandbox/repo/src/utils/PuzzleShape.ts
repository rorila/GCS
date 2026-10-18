export type PuzzleEdge = -1 | 0 | 1;
export type PuzzleEdges = [PuzzleEdge, PuzzleEdge, PuzzleEdge, PuzzleEdge];
export const PUZZLE_TAB_DEPTH = 0.18;

export function createPuzzleEdges(rows: number, columns: number): string[] {
    const horizontal = Array.from({ length: Math.max(0, rows - 1) }, (_, row) =>
        Array.from({ length: columns }, (_, col) => (row + col) % 2 === 0 ? 1 : -1));
    const vertical = Array.from({ length: rows }, (_, row) =>
        Array.from({ length: Math.max(0, columns - 1) }, (_, col) => (row + col) % 2 === 0 ? 1 : -1));
    return Array.from({ length: rows * columns }, (_, index) => {
        const row = Math.floor(index / columns), col = index % columns;
        return [
            row === 0 ? 0 : -horizontal[row - 1][col],
            col === columns - 1 ? 0 : vertical[row][col],
            row === rows - 1 ? 0 : horizontal[row][col],
            col === 0 ? 0 : -vertical[row][col - 1]
        ].join(',');
    });
}

export function parsePuzzleEdges(value: unknown): PuzzleEdges | null {
    if (typeof value !== 'string' || !/^(?:-1|0|1)(?:,(?:-1|0|1)){3}$/.test(value)) return null;
    return value.split(',').map(Number) as PuzzleEdges;
}

export function createPuzzleShape(width: number, height: number, value: unknown, tabDepth: number = PUZZLE_TAB_DEPTH): { path: string; padding: number } | null {
    const edges = parsePuzzleEdges(value);
    if (!edges || ![width, height].every(n => Number.isFinite(n) && n > 0)) return null;
    const size = Math.min(width, height);
    const clamped = Math.min(0.4, Math.max(0.02, Number(tabDepth) || PUZZLE_TAB_DEPTH));
    const depth = size * clamped;
    // Zapfenbreite waechst moderat mit der Tiefe, damit tiefe Zapfen
    // nicht zu schmalen "Pilzen" werden und kleine nicht zu Brei verlaufen.
    const uScale = Math.min(1.6, Math.max(0.6, clamped / PUZZLE_TAB_DEPTH));
    const corners = [[0, 0], [width, 0], [width, height], [0, height], [0, 0]];
    const path = ['M 0 0'];
    for (let i = 0; i < 4; i++) {
        const [x, y] = corners[i], [endX, endY] = corners[i + 1];
        const length = Math.hypot(endX - x, endY - y);
        const tx = (endX - x) / length, ty = (endY - y) / length;
        const point = (u: number, v: number) => {
            const along = length / 2 + u * uScale * size, outward = v * depth * edges[i];
            return `${x + tx * along + ty * outward} ${y + ty * along - tx * outward}`;
        };
        if (edges[i] !== 0) {
            path.push(`L ${point(-0.14, 0)}`);
            path.push(`C ${point(-0.07, 0)} ${point(-0.055, 0.08)} ${point(-0.055, 0.22)}`);
            path.push(`C ${point(-0.055, 0.36)} ${point(-0.12, 0.36)} ${point(-0.12, 0.62)}`);
            path.push(`C ${point(-0.12, 0.88)} ${point(-0.075, 1)} ${point(0, 1)}`);
            path.push(`C ${point(0.075, 1)} ${point(0.12, 0.88)} ${point(0.12, 0.62)}`);
            path.push(`C ${point(0.12, 0.36)} ${point(0.055, 0.36)} ${point(0.055, 0.22)}`);
            path.push(`C ${point(0.055, 0.08)} ${point(0.07, 0)} ${point(0.14, 0)}`);
        }
        path.push(`L ${endX} ${endY}`);
    }
    path.push('Z');
    return { path: path.join(' '), padding: depth };
}
