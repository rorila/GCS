
const fs = require('fs');
let content = fs.readFileSync('src/editor/inspector/renderers/InspectorSectionRenderer.ts', 'utf8');

const target = \                wrapper.appendChild(input);
                wrapper.appendChild(pickVarBtn);
                outerWrapper.appendChild(wrapper);
                outerWrapper.appendChild(hintEl);
                container.appendChild(outerWrapper);\;

const replacement = \                wrapper.appendChild(input);

                const lowerName = (propDef.name || '').toLowerCase();
                const isImage = lowerName.includes('image') || propDef.name === 'src' || propDef.name === 'icon';
                const isAudio = lowerName.includes('sound') || lowerName.includes('audio') || propDef.name === 'bgm' || propDef.name === 'sfx';
                
                if ((isImage || isAudio) && propDef.type !== 'number') {
                    const browseBtn = document.createElement('button');
                    browseBtn.textContent = isImage ? '🖼️' : '🎵';
                    browseBtn.title = isImage ? 'Bild auswählen' : 'Audio auswählen';
                    browseBtn.style.cssText = 'padding: 4px; background: #2a2a3e; color: #fff; border: 1px solid #555; border-radius: 3px; cursor: pointer; font-size: 11px; width: 24px; display: flex; align-items: center; justify-content: center; flex-shrink: 0;';
                    browseBtn.onclick = async () => {
                        const chosen = await MediaPickerDialog.show({
                            mode: isImage ? 'image' : 'audio',
                            currentValue: input.value
                        });
                        if (chosen !== null) {
                            input.value = chosen;
                            submitChange();
                        }
                    };
                    wrapper.appendChild(browseBtn);
                }

                wrapper.appendChild(pickVarBtn);
                outerWrapper.appendChild(wrapper);
                outerWrapper.appendChild(hintEl);
                container.appendChild(outerWrapper);\;

if (content.includes(target)) {
    content = content.replace(target, replacement);
    fs.writeFileSync('src/editor/inspector/renderers/InspectorSectionRenderer.ts', content, 'utf8');
    console.log('Successfully replaced content.');
} else {
    console.error('Target string not found in file.');
}

