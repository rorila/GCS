const fs = require('fs');
const file = 'public/editor/menu_bar.json';
const data = JSON.parse(fs.readFileSync(file, 'utf8'));

const projectMenu = data.menus.find(m => m.id === 'project');
if (projectMenu) {
    projectMenu.items.push({
        id: 'export-theme',
        label: 'Theme aus Stage exportieren',
        action: 'export-theme',
        icon: '🎨'
    });
    fs.writeFileSync(file, JSON.stringify(data, null, 4));
}
