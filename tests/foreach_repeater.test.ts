/**
 * Test: Feature C — TForEach Repeater
 * 
 * Testet die korrekte Erzeugung, Binding-Auflösung
 * und Layout-Berechnung des TForEach-Containers.
 */
import { TForEach } from '../src/components/TForEach';

let passed = 0;
let failed = 0;

function assert(condition: boolean, testName: string) {
    if (condition) {
        console.log(`  ✅ ${testName}`);
        passed++;
    } else {
        console.error(`  ❌ ${testName}`);
        failed++;
    }
}

console.log('═══════════════════════════════════════');
console.log('TEST: Feature C — TForEach Repeater');
console.log('═══════════════════════════════════════');

// ─── Test 1: TForEach kann instanziiert werden ───
console.log('\n[Test 1: Instanziierung]');
{
    const fe = new TForEach('TestRepeater', 0, 0, 20, 10);
    assert(fe.name === 'TestRepeater', 'Name = TestRepeater');
    assert(fe.className === 'TForEach', 'className = TForEach');
    assert(fe.source === '', 'source ist initial leer');
    assert(fe.template === null, 'template ist initial null');
    assert(fe.layout === 'grid', 'Default layout = grid');
    assert(fe.cols === 4, 'Default cols = 4');
}

// ─── Test 2: Properties korrekt ───
console.log('\n[Test 2: Properties setzen]');
{
    const fe = new TForEach('CardGrid');
    fe.source = 'CardData';
    fe.layout = 'horizontal';
    fe.cols = 8;
    fe.gap = 2;
    fe.itemWidth = 3;
    fe.itemHeight = 5;
    fe.template = { className: 'TButton', text: '${item.face}' };

    assert(fe.source === 'CardData', 'source = CardData');
    assert(fe.layout === 'horizontal', 'layout = horizontal');
    assert(fe.cols === 8, 'cols = 8');
    assert(fe.template.className === 'TButton', 'template.className = TButton');
    assert(fe.template.text === '${item.face}', 'template.text = ${item.face}');
}

// ─── Test 3: Inspector Properties vorhanden ───
console.log('\n[Test 3: Inspector Properties]');
{
    const fe = new TForEach('Test');
    const props = fe.getInspectorProperties();
    const propNames = props.map(p => p.name);

    assert(propNames.includes('source'), 'Hat source-Property');
    assert(propNames.includes('layout'), 'Hat layout-Property');
    assert(propNames.includes('cols'), 'Hat cols-Property');
    assert(propNames.includes('gap'), 'Hat gap-Property');
    assert(propNames.includes('itemWidth'), 'Hat itemWidth-Property');
    assert(propNames.includes('itemHeight'), 'Hat itemHeight-Property');
    assert(propNames.includes('namePattern'), 'Hat namePattern-Property');
}

// ─── Test 4: Runtime mit Mock-Objekten ───
console.log('\n[Test 4: Runtime Spawning]');
{
    const fe = new TForEach('CardGrid', 0, 0, 20, 20);
    fe.source = 'CardData';
    fe.layout = 'grid';
    fe.cols = 4;
    fe.gap = 1;
    fe.itemWidth = 4;
    fe.itemHeight = 4;
    fe.namePattern = '{name}_{index}';
    fe.template = {
        className: 'TButton',
        text: '{item}',
        style: { backgroundColor: '#333' }
    };

    // Mock-Runtime-Umgebung
    const spawnedObjects: any[] = [];
    const removedIds: string[] = [];
    const cardData = {
        name: 'CardData',
        id: 'var_carddata',
        isVariable: true,
        className: 'TListVariable',
        value: ['🍎', '🍊', '🍋', '🍇']
    };

    const mockCallbacks = {
        handleEvent: () => {},
        render: () => {},
        gridConfig: { cols: 40, rows: 30, cellSize: 20, snapToGrid: true, visible: false, backgroundColor: '#1e1e1e' },
        objects: [cardData] as any[],
        addObject: (obj: any) => {
            spawnedObjects.push(obj);
            mockCallbacks.objects.push(obj);
        },
        removeObject: (id: string) => {
            removedIds.push(id);
            const idx = mockCallbacks.objects.findIndex(o => o.id === id);
            if (idx >= 0) mockCallbacks.objects.splice(idx, 1);
        }
    };

    // Runtime starten
    fe.initRuntime(mockCallbacks);
    fe.onRuntimeStart();

    assert(spawnedObjects.length === 4, `4 Klone erzeugt (got: ${spawnedObjects.length})`);

    if (spawnedObjects.length >= 4) {
        assert(spawnedObjects[0].name === 'CardGrid_0', `Klon 0 Name = CardGrid_0 (got: ${spawnedObjects[0].name})`);
        assert(spawnedObjects[1].name === 'CardGrid_1', `Klon 1 Name = CardGrid_1 (got: ${spawnedObjects[1].name})`);

        // Layout-Check: Grid mit 4 Spalten, gap=1, itemWidth=4
        // Klon 0: x=0, y=0 (col=0, row=0)
        // Klon 1: x=5, y=0 (col=1, row=0)
        // Klon 2: x=10, y=0 (col=2, row=0)
        // Klon 3: x=15, y=0 (col=3, row=0)
        assert(spawnedObjects[0].x === 0, `Klon 0: x=0 (got: ${spawnedObjects[0].x})`);
        assert(spawnedObjects[1].x === 5, `Klon 1: x=5 (got: ${spawnedObjects[1].x})`);
    }
}

// ─── Test 5: Naming-Pattern ───
console.log('\n[Test 5: Name-Pattern]');
{
    const fe = new TForEach('Grid', 0, 0, 10, 10);
    fe.source = 'Items';
    fe.namePattern = 'Card_{index}';
    fe.template = { className: 'TLabel', text: 'test' };

    const spawnedObjects: any[] = [];
    const items = {
        name: 'Items', id: 'var_items', isVariable: true,
        className: 'TListVariable', value: ['A', 'B']
    };

    fe.initRuntime({
        handleEvent: () => {}, render: () => {},
        gridConfig: { cols: 40, rows: 30, cellSize: 20, snapToGrid: true, visible: false, backgroundColor: '#1e1e1e' },
        objects: [items] as any[],
        addObject: (obj: any) => spawnedObjects.push(obj),
        removeObject: () => {}
    });
    fe.onRuntimeStart();

    assert(spawnedObjects.length === 2, `2 Klone erzeugt`);
    if (spawnedObjects.length >= 2) {
        assert(spawnedObjects[0].name === 'Card_0', `Name = Card_0 (got: ${spawnedObjects[0].name})`);
        assert(spawnedObjects[1].name === 'Card_1', `Name = Card_1 (got: ${spawnedObjects[1].name})`);
    }
}

// ─── Test 6: Cleanup bei Stop ───
console.log('\n[Test 6: Cleanup bei onRuntimeStop]');
{
    const fe = new TForEach('CleanGrid', 0, 0, 10, 10);
    fe.source = 'Data';
    fe.template = { className: 'TLabel', text: 'x' };

    const objects: any[] = [
        { name: 'Data', id: 'var_data', isVariable: true, className: 'TListVariable', value: ['A', 'B', 'C'] }
    ];
    const removedIds: string[] = [];

    fe.initRuntime({
        handleEvent: () => {}, render: () => {},
        gridConfig: { cols: 40, rows: 30, cellSize: 20, snapToGrid: true, visible: false, backgroundColor: '#1e1e1e' },
        objects: objects as any[],
        addObject: (obj: any) => objects.push(obj),
        removeObject: (id: string) => {
            removedIds.push(id);
            const idx = objects.findIndex(o => o.id === id);
            if (idx >= 0) objects.splice(idx, 1);
        }
    });
    fe.onRuntimeStart();

    const spawnedCount = objects.length - 1;  // -1 für Data-Variable
    assert(spawnedCount === 3, `3 Klone vor Stop`);

    fe.onRuntimeStop();
    assert(removedIds.length === 3, `3 Klone entfernt bei Stop (got: ${removedIds.length})`);
}

// ─── Zusammenfassung ───
console.log('\n═══════════════════════════════════════');
console.log(`TForEach Tests: ${passed} passed, ${failed} failed`);
console.log('═══════════════════════════════════════');

if (failed > 0) process.exit(1);
