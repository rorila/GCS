const fs = require('fs');

const changelog = 'docs/CHANGELOG.md';
let cText = fs.readFileSync(changelog, 'utf8');
cText = `### 2026-03-31
- **Feature**: Die neue TGroupPanel Komponente wurde als transparenter Container eingeführt, der verschachtelte Kind-Komponenten aufnehmen kann.
- **Feature (Templates & ObjectPool)**: TGroupPanels können nun als "isTemplate=true" deklariert werden. \`spawn_object\` clont das Panel mitsamt allen Children zur Laufzeit rekursiv und erweckt sie zum Leben.
- **Feature (Action)**: Neue Action \`set_child_property\` hinzugefügt, um gezielt Sub-Elemente in einem gespawnten TGroupPanel über ihren Namen anzusprechen und zu verändern.
- **Refactoring (StageRenderer)**: \`renderObjects\` rekursiv erweitert, sodass Groups auch in der IDE mitsamt ihren Kind-Elementen navigierbar und global verschiebbar bleiben.
` + cText;
fs.writeFileSync(changelog, cText, 'utf8');

const usecase = 'docs/use_cases/UseCaseIndex.txt';
let uText = fs.readFileSync(usecase, 'utf8');
uText += `
[2026-03-31] Grouping & Templating: TGroupPanel.ts, StageRenderer.ts (renderObjects, collectAllIds), ObjectPoolActions.ts, GameRuntime.ts (spawnObject, destroyObject), PropertyActions.ts (set_child_property)
`;
fs.writeFileSync(usecase, uText, 'utf8');

const dev = 'docs/DEVELOPER_GUIDELINES.md';
let dText = fs.readFileSync(dev, 'utf8');
const entry = `
## 2026-03-31: Template Spawning (TGroupPanel)
- Wenn dynamische Element-Gruppen gebaut werden (z.B. Ballon + TextLabel), nutze das TGroupPanel und setze es als "isTemplate=true".
- Diese Vorlagen werden offscreen vorbereitet und zur Laufzeit via "spawn_object" tiefenkopiert.
- WICHTIG: Die Unterelemente (Children) referenziert man via der neuen Action "set_child_property" (target=group, childName='MeinLabel'). Nicht über Standard property, da die Childs ein neues suffix (_spawn_) in der ID/Name tragen!
`;
dText = dText.replace('## WICHTIGSTE ENTSCHEIDUNGEN DER VERGANGENHEIT', '## WICHTIGSTE ENTSCHEIDUNGEN DER VERGANGENHEIT' + entry);
fs.writeFileSync(dev, dText, 'utf8');

console.log('Docs successfully updated.');
