import { IInspectorContext } from './IInspectorContext';
import { MediaPickerDialog } from '../MediaPickerDialog';
import { NotificationToast } from '../../ui/NotificationToast';
import { mediatorService } from '../../../services/MediatorService';

export interface IFilePickerOptions {
    mode: 'image' | 'audio';
    icon?: string;
    title?: string;
}

export class MediaImageEditor {
    public static appendFilePickerButton(container: HTMLElement, input: HTMLInputElement, options: IFilePickerOptions): void {
        const isImage = options.mode === 'image';
        const browseBtn = document.createElement('button');
        browseBtn.textContent = options.icon ?? (isImage ? '🖼️' : '🔊');
        browseBtn.title = options.title ?? (isImage ? 'Bild auswählen' : 'Audio auswählen');
        browseBtn.style.cssText = 'padding:2px 6px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:3px;cursor:pointer;font-size:11px;flex-shrink:0;transition:all 0.15s;';
        browseBtn.onmouseenter = () => { browseBtn.style.borderColor = '#89b4fa'; browseBtn.style.background = '#3a3a4e'; };
        browseBtn.onmouseleave = () => { browseBtn.style.borderColor = '#555'; browseBtn.style.background = '#2a2a3e'; };
        browseBtn.onclick = async () => {
            const chosen = await MediaPickerDialog.show({
                mode: options.mode,
                currentValue: input.value
            });
            if (chosen !== null) {
                input.value = chosen;
                input.dispatchEvent(new Event('change'));
            }
        };
        container.appendChild(browseBtn);
    }

    public static renderColor(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement, currentValue: any): void {
        const colorContainer = context.renderer.renderColorInput(String(currentValue || '#000000'));
        const colorInput = (colorContainer as any).colorInput as HTMLInputElement;
        const textInput = (colorContainer as any).textInput as HTMLInputElement;

        const updateColorValue = (newValue: string) => {
            if (context.eventHandler) {
                const event = context.eventHandler.handleControlChange(
                    propDef.name, newValue, obj,
                    { ...propDef, property: propDef.name }
                );
                if (event) {
                    mediatorService.notifyDataChanged({
                        property: event.propertyName,
                        value: event.newValue,
                        oldValue: event.oldValue,
                        object: event.object
                    }, 'inspector');
                    if (context.onObjectUpdate) context.onObjectUpdate(event);
                }
            }
        };

        colorInput.oninput = () => {
            textInput.value = colorInput.value;
            updateColorValue(colorInput.value);
        };

        textInput.oninput = () => {
            if (textInput.value.startsWith('#') && textInput.value.length === 7) {
                colorInput.value = textInput.value;
                updateColorValue(textInput.value);
            }
        };

        textInput.onchange = () => {
            updateColorValue(textInput.value);
        };

        colorContainer.style.flex = '1';
        colorContainer.style.marginBottom = '0'; // Überschreibe default margin von renderColorInput

        const pickVarBtn = document.createElement('button');
        pickVarBtn.textContent = 'V';
        pickVarBtn.title = 'Variable verknüpfen (Bind)';
        pickVarBtn.style.cssText = 'padding: 4px; background: #e67e22; color: #fff; border: none; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; font-weight: bold; flex-shrink: 0;';
        pickVarBtn.onclick = () => {
            if (context.actionHandler) {
                (context.actionHandler as any).handleAction(
                    { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                    obj
                );
            }
        };

        colorContainer.appendChild(pickVarBtn);
        container.appendChild(colorContainer);
    }

    public static renderMediaPicker(propDef: any, obj: any, context: IInspectorContext, container: HTMLElement, currentValue: any): void {
        const pickerIcon = propDef.type === 'image_picker' ? '🖼️'
                         : propDef.type === 'audio_picker' ? '🔊'
                         : '🎬';
        const pickerAction = propDef.type === 'image_picker' ? 'browseImage'
                           : propDef.type === 'audio_picker' ? 'browseAudio'
                           : 'browseVideo';

        const wrapper = document.createElement('div');
        wrapper.style.cssText = 'display:flex;gap:4px;flex:1;align-items:center;';

        const input = context.renderer.renderEdit(String(currentValue));
        input.style.flex = '1';
        if (propDef.name) input.name = propDef.name + 'Input';
        input.onchange = () => {
            if (context.eventHandler) {
                const event = context.eventHandler.handleControlChange(
                    propDef.name, input.value, obj,
                    { ...propDef, property: propDef.name }
                );
                if (event) {
                    mediatorService.notifyDataChanged({
                        property: event.propertyName,
                        value: event.newValue,
                        oldValue: event.oldValue,
                        object: event.object
                    }, 'inspector');
                    if (context.onObjectUpdate) context.onObjectUpdate(event);
                }
            }
        };

        const browseBtn = document.createElement('button');
        browseBtn.textContent = pickerIcon;
        browseBtn.title = propDef.type === 'image_picker' ? 'Bild auswählen'
                        : propDef.type === 'audio_picker' ? 'Audio auswählen'
                        : 'Video auswählen';
        browseBtn.style.cssText = 'padding:4px 8px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;transition:all 0.15s;';
        browseBtn.onmouseenter = () => { browseBtn.style.borderColor = '#89b4fa'; browseBtn.style.background = '#3a3a4e'; };
        browseBtn.onmouseleave = () => { browseBtn.style.borderColor = '#555'; browseBtn.style.background = '#2a2a3e'; };
        browseBtn.onclick = () => {
            if (context.actionHandler) {
                (context.actionHandler as any).handleAction(
                    { action: pickerAction, property: propDef.name },
                    obj
                );
            }
        };

        wrapper.appendChild(input);
        wrapper.appendChild(browseBtn);

        const pickVarBtn = document.createElement('button');
        pickVarBtn.textContent = 'V';
        pickVarBtn.title = 'Variable verknüpfen (Bind)';
        pickVarBtn.style.cssText = 'padding:4px 8px;background:#e67e22;color:#fff;border:none;border-radius:4px;cursor:pointer;font-size:11px;flex-shrink:0;font-weight:bold;transition:all 0.15s;';
        pickVarBtn.onmouseenter = () => { pickVarBtn.style.background = '#ff9f43'; };
        pickVarBtn.onmouseleave = () => { pickVarBtn.style.background = '#e67e22'; };
        pickVarBtn.onclick = () => {
            if (context.actionHandler) {
                (context.actionHandler as any).handleAction(
                    { action: 'pickVariable', property: propDef.name, propertyType: propDef.type },
                    obj
                );
            }
        };
        wrapper.appendChild(pickVarBtn);

        if (propDef.type === 'image_picker') {
            const pasteBtn = document.createElement('button');
            pasteBtn.textContent = '📋';
            pasteBtn.title = 'Bild aus Zwischenablage einfügen (Base64)';
            pasteBtn.style.cssText = 'padding:4px 8px;background:#2a2a3e;color:#fff;border:1px solid #555;border-radius:4px;cursor:pointer;font-size:14px;flex-shrink:0;transition:all 0.15s;';
            pasteBtn.onmouseenter = () => { pasteBtn.style.borderColor = '#a6e3a1'; pasteBtn.style.background = '#2a3e2e'; };
            pasteBtn.onmouseleave = () => { pasteBtn.style.borderColor = '#555'; pasteBtn.style.background = '#2a2a3e'; };
            pasteBtn.onclick = async () => {
                try {
                    const clipboardItems = await navigator.clipboard.read();
                    let imageBlob: Blob | null = null;
                    for (const item of clipboardItems) {
                        const imageType = item.types.find(t => t.startsWith('image/'));
                        if (imageType) {
                            imageBlob = await item.getType(imageType);
                            break;
                        }
                    }
                    if (!imageBlob) {
                        NotificationToast.show('Kein Bild in der Zwischenablage gefunden.');
                        return;
                    }
                    const reader = new FileReader();
                    reader.onloadend = () => {
                        const dataUrl = reader.result as string;
                        input.value = dataUrl;
                        input.dispatchEvent(new Event('change'));
                        pasteBtn.textContent = '✅';
                        setTimeout(() => { pasteBtn.textContent = '📋'; }, 1500);
                    };
                    reader.readAsDataURL(imageBlob);
                } catch (e: any) {
                    NotificationToast.show('Fehler beim Lesen der Zwischenablage: ' + e.message);
                }
            };
            wrapper.appendChild(pasteBtn);
        }

        container.appendChild(wrapper);
    }
}
