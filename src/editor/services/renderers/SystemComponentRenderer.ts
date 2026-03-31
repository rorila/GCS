import { IRenderContext } from './IRenderContext';

export class SystemComponentRenderer {
    
    public static render(ctx: IRenderContext, el: HTMLElement, obj: any, className: string): void {
        let effectivelyVisible = true;
        if (ctx.host.runMode) {
            if (obj.isHiddenInRun || obj.isVariable) effectivelyVisible = false;
        } else {
            if (obj.isBlueprintOnly && !ctx.host.isBlueprint && obj.isInherited) effectivelyVisible = false;
        }

        if (!effectivelyVisible) {
            el.style.display = 'none';
        } else {
            el.style.display = 'flex';
            if (!ctx.host.runMode) {
                el.style.backgroundColor = this.getSystemComponentColor(className, obj);

                let val = (obj.value !== undefined) ? obj.value : obj.defaultValue;
                if (val === undefined) val = '-';

                el.innerText = obj.isVariable ? `${obj.name}\n(${val})` : obj.name;
                el.style.color = '#ffffff';
                el.style.fontSize = '10px';
                el.style.textAlign = 'center';
                el.style.whiteSpace = 'pre-wrap';

                if (obj.isVariable) {
                    el.style.border = '1px solid rgba(255, 255, 255, 0.5)';
                }
            } else {
                el.innerText = '';
            }
        }
    }

    private static getSystemComponentColor(className: string, obj: any): string {
        switch (className) {
            case 'TGameLoop': return '#2196f3';
            case 'TInputController': return '#9c27b0';
            case 'TIntervalTimer': return '#ff9800';
            case 'TGameState': return '#607d8b';
            case 'TGameServer': return '#4caf50';
            case 'THandshake': return '#5c6bc0';
            case 'THeartbeat': return '#e91e63';
            case 'TStageController': return '#9c27b0';
            case 'TAPIServer': return '#f44336';
            case 'TDataStore': return '#3f51b5';
            default: return obj.isVariable ? (obj.style?.backgroundColor || '#673ab7') : '#4caf50';
        }
    }
}
