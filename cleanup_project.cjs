
const fs = require('fs');

const projectPath = 'game-server/public/platform/project.json';
const project = JSON.parse(fs.readFileSync(projectPath, 'utf8'));

let changesMade = 0;

// 1. Bereinigung stage_login
const loginStage = project.stages.find(s => s.id === 'stage_login' || s.name === 'Login');
if (loginStage && loginStage.flowCharts) {
    if (loginStage.flowCharts['createAnEmojiPin']) {
        delete loginStage.flowCharts['createAnEmojiPin'];
        console.log('Entferne verwaistes Diagramm "createAnEmojiPin" aus stage_login');
        changesMade++;
    }
    if (loginStage.flowCharts['HandleApiRequest']) {
        delete loginStage.flowCharts['HandleApiRequest'];
        console.log('Entferne verwaistes Diagramm "HandleApiRequest" aus stage_login');
        changesMade++;
    }
}

// 2. Bereinigung stage_blueprint (Single Source of Truth)
const blueprintStage = project.stages.find(s => s.id === 'stage_blueprint' || s.name === 'Blueprint');
if (blueprintStage) {
    if (!blueprintStage.flowCharts) blueprintStage.flowCharts = {};

    blueprintStage.tasks.forEach(task => {
        // Wenn ein eingebettetes Diagramm existiert
        if (task.flowChart) {
            // Falls es noch nicht im zentralen flowCharts Objekt der Stage ist, verschieben
            if (!blueprintStage.flowCharts[task.name]) {
                blueprintStage.flowCharts[task.name] = task.flowChart;
                console.log(`Verschiebe eingebettetes Diagramm für Task "${task.name}" nach stage_blueprint.flowCharts`);
            } else {
                console.log(`Entferne redundantes eingebettetes Diagramm für Task "${task.name}"`);
            }
            // In jedem Fall im Task löschen
            delete task.flowChart;
            changesMade++;
        }
    });

    // Optionale Bereinigung von root level flowCharts
    if (project.flowCharts && project.flowCharts.global &&
        Object.keys(project.flowCharts.global.elements || {}).length === 0) {
        // Wir lassen es erstmal stehen, falls die Engine es als Platzhalter braucht, 
        // aber wir löschen keine Daten.
    }
}

if (changesMade > 0) {
    fs.writeFileSync(projectPath, JSON.stringify(project, null, 2));
    console.log(`Bereinigung abgeschlossen. ${changesMade} Änderungen gespeichert.`);
} else {
    console.log('Keine Änderungen erforderlich.');
}
