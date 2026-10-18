

export class RuntimeAnimationService {
    public getPatternStartPosition(
            pattern: string, targetX: number, targetY: number, index: number,
            stageWidth: number, stageHeight: number, outsideMargin: number,
            simplePatterns: string[]
        ): { x: number; y: number } | null {
            switch (pattern) {
                case 'UpLeft':
                    return { x: -outsideMargin, y: -outsideMargin };
                case 'UpMiddle':
                    return { x: stageWidth / 2, y: -outsideMargin };
                case 'UpRight':
                    return { x: stageWidth + outsideMargin, y: -outsideMargin };
                case 'Left':
                    return { x: -outsideMargin, y: targetY };
                case 'Right':
                    return { x: stageWidth + outsideMargin, y: targetY };
                case 'BottomLeft':
                    return { x: -outsideMargin, y: stageHeight + outsideMargin };
                case 'BottomMiddle':
                    return { x: stageWidth / 2, y: stageHeight + outsideMargin };
                case 'BottomRight':
                    return { x: stageWidth + outsideMargin, y: stageHeight + outsideMargin };
                case 'ChaosIn': {
                    const angle = Math.random() * Math.PI * 2;
                    const distance = Math.max(stageWidth, stageHeight) + outsideMargin;
                    return {
                        x: stageWidth / 2 + Math.cos(angle) * distance,
                        y: stageHeight / 2 + Math.sin(angle) * distance
                    };
                }
                case 'ChaosOut':
                    return { x: stageWidth / 2, y: stageHeight / 2 };
                case 'Matrix':
                    return { x: targetX, y: -outsideMargin - (index * 20) };
                case 'Random': {
                    const randomPattern = simplePatterns[Math.floor(Math.random() * simplePatterns.length)];
                    return this.getPatternStartPosition(randomPattern, targetX, targetY, index, stageWidth, stageHeight, outsideMargin, simplePatterns);
                }
                default:
                    return null;
            }
        }
}
