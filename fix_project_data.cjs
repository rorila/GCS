const fs = require('fs');
const path = require('path');

const filePath = path.join(__dirname, 'demos', 'project_NewTennis18.json');
const data = JSON.parse(fs.readFileSync(filePath, 'utf8'));

console.log('Restoring full execution sequences (Actions + Tasks)...');

if (!data.actions) data.actions = [];

data.tasks.forEach(task => {
    if (task.flowGraph && task.flowGraph.elements) {
        const elements = task.flowGraph.elements;
        const connections = task.flowGraph.connections || [];

        // 1. Find the root task node
        const taskNode = elements.find(e => e.type === 'Task' || e.type === 'Start');
        if (taskNode) {
            // 2. Find ALL outgoing connections (not filtering by type)
            const outgoing = connections.filter(c => c.startTargetId === taskNode.id);
            const targetNodes = outgoing.map(c => elements.find(e => e.id === c.endTargetId)).filter(e => e && (e.type === 'Action' || e.type === 'Task'));

            // 3. Sort by Y position
            targetNodes.sort((a, b) => a.y - b.y);

            // 4. Update sequence
            task.actionSequence = targetNodes.map(node => {
                const name = node.properties?.name || node.data?.name || node.data?.actionName || node.properties?.text;
                return {
                    type: node.type === 'Task' ? 'task' : 'action',
                    name: name
                };
            });
            console.log(`Updated sequence for task: ${task.name} (${task.actionSequence.length} items: ${task.actionSequence.map(i => i.name).join(', ')})`);
        }
    }
});

fs.writeFileSync(filePath, JSON.stringify(data, null, 2));
console.log('Repair complete.');
