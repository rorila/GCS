import { DynamicOptionsRenderer } from './DynamicOptionsRenderer';

export class InspectorUIRenderer {
    /**
     * Generates a UI object array from component property definitions.
     */
    public static generateUIFromProperties(object: any, _isMerging: boolean = false): any[] {
        if (typeof object.getInspectorProperties !== 'function') return [];

        const properties = object.getInspectorProperties();
        const uiObjects: any[] = [];

        // Group properties by group
        const grouped: Map<string, any[]> = new Map();
        properties.forEach((prop: any) => {
            const group = prop.group || 'General';
            if (!grouped.has(group)) {
                grouped.set(group, []);
            }
            grouped.get(group)!.push(prop);
        });

        // Render each group
        grouped.forEach((groupProps, groupName) => {
            const groupChildren: any[] = [];

            // Group header
            groupChildren.push({
                className: 'TLabel',
                name: `${groupName}Header`,
                text: groupName.toUpperCase(),
                style: { fontSize: 11, fontWeight: 'bold', color: '#4da6ff', marginBottom: 12, borderBottom: '1px solid #4da6ff', paddingBottom: '4px' } // Enhanced header style
            });

            // Properties in group
            let currentContainer: any[] = groupChildren;

            for (let i = 0; i < groupProps.length; i++) {
                const prop = groupProps[i];
                const labelStyle: any = { fontSize: 12, color: '#aaa' };

                // Frame/section start: wrap the following controls in a bordered panel
                if (prop.type === 'separator') {
                    const frame = {
                        className: 'TPanel',
                        name: `${prop.name}Frame`,
                        style: {
                            border: '1px solid #444',
                            borderRadius: '6px',
                            padding: '8px',
                            marginTop: '8px',
                            marginBottom: '12px',
                            backgroundColor: '#1e1e2e'
                        },
                        children: [
                            {
                                className: 'TLabel',
                                name: `${prop.name}Header`,
                                text: prop.label,
                                style: { fontSize: 12, fontWeight: 'bold', color: '#4da6ff', marginBottom: '8px' }
                            }
                        ]
                    };
                    groupChildren.push(frame);
                    currentContainer = frame.children;
                    continue;
                }

                // Start an inline group if this prop and next prop are inline
                if (prop.inline && groupProps[i + 1]?.inline) {
                    const inlineGroup: any[] = [];
                    const wrapper = {
                        className: 'TPanel',
                        name: `${prop.name}InlineWrapper`,
                        style: { display: 'flex', gap: '12px', marginBottom: '8px', padding: '0', alignItems: 'center' },
                        children: inlineGroup
                    };
                    currentContainer.push(wrapper);

                    // Collect up to 2 consecutive inline props
                    let inlineCount = 0;
                    while (i < groupProps.length && groupProps[i].inline && inlineCount < 2) {
                        const p = groupProps[i];
                        // For inline props, we still might want a small label if it's not a checkbox
                        if (p.type !== 'boolean' && p.label) {
                            inlineGroup.push({
                                className: 'TLabel',
                                name: `${p.name}Label`,
                                text: `${p.label}:`,
                                style: { ...labelStyle, marginBottom: 0 }
                            });
                        }

                        const inputName = `${p.name}Input`;
                        const binding = `\${selectedObject.${p.name}}`;
                        InspectorUIRenderer.pushInputIntoUI(inlineGroup, p, inputName, binding);

                        inlineCount++;

                        // If we haven't reached 2 yet, check if the next one is inline
                        if (inlineCount < 2 && groupProps[i + 1]?.inline) {
                            i++;
                        } else {
                            break;
                        }
                    }
                    continue;
                }

                // Normal rendering (not inline group)
                if (prop.type !== 'boolean') {
                    currentContainer.push({
                        className: 'TLabel',
                        name: `${prop.name}Label`,
                        text: `${prop.label || prop.name}:`,
                        style: labelStyle,
                        readOnly: prop.readOnly
                    });
                }

                const inputName = `${prop.name}Input`;
                const binding = `\${selectedObject.${prop.name}}`;
                InspectorUIRenderer.pushInputIntoUI(currentContainer, prop, inputName, binding);
            }

            // Wrap the group in a Card Panel
            uiObjects.push({
                className: 'TPanel',
                name: `${groupName}Card`,
                style: {
                    backgroundColor: '#2a2a2a',
                    borderRadius: '8px',
                    padding: '12px',
                    marginBottom: '16px',
                    border: '1px solid #3a3a3a',
                    boxShadow: '0 2px 4px rgba(0,0,0,0.2)'
                },
                children: groupChildren
            });
        });


        return uiObjects;
    }
    private static pushInputIntoUI(target: any[], prop: any, inputName: string, binding: string): void {
        if (prop.type === 'number') {
            target.push({
                className: 'TNumberInput',
                name: inputName,
                value: binding,
                min: prop.min ?? 0,
                max: prop.max,
                step: prop.step ?? 0.1
            });
        } else if (prop.type === 'color') {
            target.push({
                className: 'TColorInput',
                name: inputName,
                value: binding
            });
        } else if (prop.type === 'string') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}PickVarBtn`,
                        caption: 'V',
                        action: 'pickVariable',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', minWidth: '32px', flexShrink: '0', padding: '4px', marginTop: '0', backgroundColor: '#e67e22', color: '#fff', fontWeight: 'bold', border: 'none' }
                    }
                ]
            });
        } else if (prop.type === 'boolean') {
            target.push({
                className: 'TCheckbox',
                name: inputName,
                checked: binding,
                label: prop.label
            });
        } else if (prop.type === 'select') {
            target.push({
                className: 'TDropdown',
                name: inputName,
                options: DynamicOptionsRenderer.getOptionsFromSource(prop),
                selectedValue: binding
            });
        } else if (prop.type === 'image_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '🖼️',
                        action: 'browseImage',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'audio_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '🔊',
                        action: 'browseAudio',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'video_picker') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { display: 'flex', gap: '4px', marginBottom: '8px', padding: '0', flex: 1 },
                children: [
                    {
                        className: 'TEdit',
                        name: inputName,
                        text: binding,
                        style: { flex: 1, marginBottom: '0' }
                    },
                    {
                        className: 'TButton',
                        name: `${prop.name}BrowseBtn`,
                        caption: '🎬',
                        action: 'browseVideo',
                        actionData: { property: prop.name, inputName: inputName },
                        style: { width: '32px', padding: '4px', marginTop: '0' }
                    }
                ]
            });
        } else if (prop.type === 'separator') {
            target.push({
                className: 'TPanel',
                name: `${prop.name}Wrapper`,
                style: { borderTop: '1px solid #444', marginTop: '12px', marginBottom: '4px', paddingTop: '6px', flex: 1 },
                children: [
                    {
                        className: 'TLabel',
                        name: inputName,
                        caption: prop.label,
                        style: { fontWeight: 'bold', color: '#ccc', fontSize: '12px' }
                    }
                ]
            });
        } else if (prop.type === 'button') {
            target.push({
                className: 'TButton',
                name: inputName,
                caption: prop.label || prop.name,
                action: prop.action,
                style: prop.style
            });
        }
    }
}
