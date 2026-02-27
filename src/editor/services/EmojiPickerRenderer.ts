import { Logger } from '../../utils/Logger';

const logger = Logger.get('EmojiPickerRenderer');

/**
 * EmojiPickerRenderer - Handles rendering of the TEmojiPicker component.
 * This can be used both in-game (runtime) and in the editor.
 */
export class EmojiPickerRenderer {

    /**
     * Renders the internal emoji grid for a TEmojiPicker object.
     */
    public static renderEmojiPicker(
        el: HTMLElement,
        obj: any,
        cellSize: number,
        onEvent?: (id: string, event: string, data?: any) => void
    ): void {
        try {
            el.style.display = 'grid';
            el.style.gridTemplateColumns = `repeat(${obj.columns || 5}, 1fr)`;
            el.style.gap = '5px';
            el.style.padding = '10px';
            el.style.overflowY = 'auto';
            el.style.alignContent = 'start';
            el.style.justifyItems = 'center';
            el.innerHTML = '';

            const emojiList = Array.isArray(obj.emojis) ? obj.emojis : [];
            const itemSizePx = (obj.itemSize || 2) * cellSize;

            emojiList.forEach((emoji: string) => {
                const btn = document.createElement('div');
                btn.style.width = `${itemSizePx}px`;
                btn.style.height = `${itemSizePx}px`;
                btn.style.display = 'flex';
                btn.style.alignItems = 'center';
                btn.style.justifyContent = 'center';
                btn.style.fontSize = `${itemSizePx * 0.7}px`;
                btn.style.cursor = 'pointer';
                btn.style.borderRadius = '8px';
                btn.style.transition = 'background 0.2s, transform 0.1s';
                btn.innerText = emoji;

                if (emoji === obj.selectedEmoji) {
                    btn.style.backgroundColor = 'rgba(255, 255, 255, 0.2)';
                    btn.style.boxShadow = '0 0 0 2px #4fc3f7';
                }

                btn.onclick = (e) => {
                    e.stopPropagation();
                    obj.selectedEmoji = emoji;
                    if (onEvent) onEvent(obj.id, 'onSelect', emoji);
                    // Re-render itself to update selected state
                    this.renderEmojiPicker(el, obj, cellSize, onEvent);
                };

                el.appendChild(btn);
            });
        } catch (e) {
            logger.error('Error rendering EmojiPicker:', e);
        }
    }
}
