import { IRenderContext } from './IRenderContext';

export class ShapeRenderer {
    public static render(_ctx: IRenderContext, el: HTMLElement, obj: any, isNew: boolean): void {
        const shapeType = obj.shapeType || 'circle';
        const fillColor = (obj.style?.backgroundColor && obj.style.backgroundColor !== 'transparent') ? obj.style.backgroundColor : (obj.fillColor || '#4fc3f7');
        const strokeColor = (obj.style?.borderColor && obj.style.borderColor !== 'transparent') ? obj.style.borderColor : (obj.strokeColor || '#29b6f6');
        const strokeWidth = (obj.style?.borderWidth !== undefined && obj.style.borderWidth !== 0) ? obj.style.borderWidth : (obj.strokeWidth || 0);
        const opacity = obj.style?.opacity ?? obj.opacity ?? 1;

        let svgContent = '';
        if (shapeType === 'circle') {
            svgContent = `<circle cx="50" cy="50" r="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        } else if (shapeType === 'square' || shapeType === 'rectangle' || shapeType === 'rect') {
            svgContent = `<rect x="1" y="1" width="98" height="98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        } else if (shapeType === 'triangle') {
            svgContent = `<polygon points="50,2 2,98 98,98" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        } else if (shapeType === 'ellipse') {
            svgContent = `<ellipse cx="50" cy="50" rx="48" ry="48" fill="${fillColor}" stroke="${strokeColor}" stroke-width="${strokeWidth}" fill-opacity="${opacity}" vector-effect="non-scaling-stroke" />`;
        }

        if (obj.contentImage) {
            svgContent += `<image href="${obj.contentImage}" x="15" y="15" width="70" height="70" preserveAspectRatio="xMidYMid meet" />`;
        }
        if (obj.text) {
            const fontSize = obj.style?.fontSize || 50;
            const fontColor = obj.style?.color || '#ffffff';
            svgContent += `<text x="50" y="52" dominant-baseline="central" text-anchor="middle" font-size="${fontSize}" fill="${fontColor}" font-family="${obj.style?.fontFamily || 'Arial'}">${obj.text}</text>`;
        }

        let svgTag = `<svg xmlns="http://www.w3.org/2000/svg" width="100%" height="100%" viewBox="0 0 100 100" preserveAspectRatio="none" style="position:absolute; top:0; left:0; display:block; overflow:visible; pointer-events:all;">`;
        svgTag += svgContent;
        svgTag += `</svg>`;
        el.innerHTML = svgTag;

        if (isNew) {
            const label = document.createElement('span');
            label.innerText = obj.name;
            label.style.cssText = 'position:absolute; font-size:10px; color:rgba(255,255,255,0.5); pointer-events:none;';
            el.appendChild(label);
        }
    }
}
