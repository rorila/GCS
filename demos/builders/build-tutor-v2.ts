import { AgentController } from '../../src/services/AgentController';
import { GameProject } from '../../src/model/types';
import * as fs from 'fs';
import * as path from 'path';

// Deaktivieren zu gesprächiges Logging für den Build-Prozess
// Logger.setLevel('warn');

// 1. Schemata vollständig laden, damit der Agent validieren kann
const basePath = path.resolve(process.cwd(), 'docs');
const baseSchema = JSON.parse(fs.readFileSync(path.join(basePath, 'schemas/schema_base.json'), 'utf-8'));
const SCHEMA_MODULES = [
    'schema_containers.json', 'schema_dialogs.json', 'schema_inputs.json',
    'schema_display.json', 'schema_timers.json', 'schema_media.json',
    'schema_variables.json', 'schema_game.json', 'schema_services.json'
];

for (const moduleFile of SCHEMA_MODULES) {
    const modulePath = path.join(basePath, 'schemas', moduleFile);
    if (fs.existsSync(modulePath)) {
        const mod = JSON.parse(fs.readFileSync(modulePath, 'utf-8'));
        if (mod.components) {
            Object.assign(baseSchema.components, mod.components);
        }
    }
}
AgentController.setComponentSchema(baseSchema);

// 2. Leeres Projekt initialisieren
const project: GameProject = {
    meta: {
        name: 'Tutor Tutorial',
        version: '1.0.0',
        author: 'AgentController',
        description: 'Interaktives Tutorial für den Game Builder'
    },
    stage: { 
        grid: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f0f0f0' } 
    },
    variables: [],
    stages: [],
    tasks: [],
    actions: [],
    objects: [],
    flow: { 
        stage: { cols: 100, rows: 100, cellSize: 20, snapToGrid: true, visible: true, backgroundColor: '#f0f0f0' },
        elements: [], 
        connections: [] 
    },
    activeStageId: 'stage_raster'
};

const agent = AgentController.getInstance();
agent.setProject(project);

// 3. Blueprint-Stage für globale Variablen
agent.createStage('stage_blueprint', 'Blueprint', 'blueprint');

// Wir nutzen die neue Methode von AgentController um Objekte direkt zu injecten.
const GLOBALS = [
    { className: 'TIntegerVariable', id: 'var_raster_cols', name: 'var_raster_cols', x: 2, y: 2, width: 2, height: 2, value: 64 },
    { className: 'TIntegerVariable', id: 'var_raster_rows', name: 'var_raster_rows', x: 2, y: 5, width: 2, height: 2, value: 40 },
    { className: 'TIntegerVariable', id: 'var_raster_cell', name: 'var_raster_cell', x: 2, y: 8, width: 2, height: 2, value: 20 },
    { className: 'TBooleanVariable', id: 'var_raster_lines', name: 'var_raster_lines', x: 2, y: 11, width: 2, height: 2, value: true },
    { className: 'TBooleanVariable', id: 'var_raster_snap', name: 'var_raster_snap', x: 2, y: 14, width: 2, height: 2, value: true },
    { className: 'TStringVariable', id: 'var_raster_color', name: 'var_raster_color', x: 2, y: 17, width: 2, height: 2, value: '#dddddd' },
    { className: 'TStringVariable', id: 'var_raster_bg', name: 'var_raster_bg', x: 2, y: 20, width: 2, height: 2, value: '#f5f5f5' },
    { className: 'TStringVariable', id: 'var_raster_mode', name: 'var_raster_mode', x: 2, y: 23, width: 2, height: 2, value: 'cover' }
];

for (const glob of GLOBALS) {
    agent.addObject('stage_blueprint', glob);
}

// 4. Lesson-Stage 
agent.createStage('stage_raster', 'Lesson_Raster', 'standard');

// Inspector Container (wir nutzen AgentControllers createGroupPanel, das wir gerade gebaut haben)
// ABER: TGroupPanel in json unterstützt nested children (da das SchemaArrayT erlaubt).
const inspectorPanel = {
    className: 'TGroupPanel',
    id: 'inspector_bg',
    name: 'InspectorContainer',
    x: 1, y: 1, width: 17, height: 16,
    style: {
        backgroundColor: '#18181A',
        borderColor: '#232325',
        borderWidth: 1,
        borderRadius: 6
    },
    // Wir übergeben direkt das Array an Children-Definitionen
    children: [
        // ── Gold-Akzentleiste ──
        { className: 'TPanel', id: 'inspector_gold', name: 'GoldenBar', x: 0, y: 0, width: 0.2, height: 16, style: { backgroundColor: '#FFB300', borderColor: 'transparent', borderWidth: 0, borderTopLeftRadius: 6, borderBottomLeftRadius: 6 } },
        // ── Icon ──
        { className: 'TShape', id: 'icon_raster', name: 'IconRaster', x: 0.8, y: 0.6, width: 0.6, height: 0.6, shapeType: 'rectangle', style: { backgroundColor: '#8a7fff', borderColor: 'transparent', borderWidth: 0, borderRadius: 2 } },
        // ── Header-Label ──
        { className: 'TLabel', id: 'lbl_raster_head', name: 'HeaderRaster', x: 1.8, y: 0.4, width: 6, height: 1, text: 'RASTER', style: { color: '#FFB300', fontSize: 13, fontWeight: 'bold' } },
        // ── Chevron ──
        { className: 'TLabel', id: 'lbl_chevron', name: 'Chevron', x: 14.5, y: 0.4, width: 1, height: 1, text: '▼', style: { color: '#666666', fontSize: 10 } },

        // ── ZEILE: Spalten ──
        { className: 'TLabel', id: 'lbl_spalten', name: 'LblSpalten', x: 0.5, y: 2.2, width: 3, height: 1.5, text: 'Spalten', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TNumberInput', id: 'inp_spalten', name: 'InputSpalten', x: 3.5, y: 2, width: 2.8, height: 1.3, value: 64, style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4, textAlign: 'center' } },
        { className: 'TButton', id: 'btn_v_spalten', name: 'VarSpalten', x: 6.5, y: 2, width: 1.2, height: 1.3, text: 'V', style: { backgroundColor: '#e67300', color: '#fff', borderColor: 'transparent', borderRadius: 4, fontWeight: 'bold' } },

        // ── ZEILE: Zeilen ──
        { className: 'TLabel', id: 'lbl_zeilen', name: 'LblZeilen', x: 8.5, y: 2.2, width: 2.5, height: 1.5, text: 'Zeilen', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TNumberInput', id: 'inp_zeilen', name: 'InputZeilen', x: 11, y: 2, width: 2.8, height: 1.3, value: 40, style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4, textAlign: 'center' } },
        { className: 'TButton', id: 'btn_v_zeilen', name: 'VarZeilen', x: 14, y: 2, width: 1.2, height: 1.3, text: 'V', style: { backgroundColor: '#e67300', color: '#fff', borderColor: 'transparent', borderRadius: 4, fontWeight: 'bold' } },

        // ── ZEILE: Zellgröße ──
        { className: 'TLabel', id: 'lbl_zell', name: 'LblZell', x: 0.5, y: 4.2, width: 4, height: 1.5, text: 'Zellgröße', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TNumberInput', id: 'inp_zell', name: 'InputZell', x: 3.5, y: 4, width: 10.3, height: 1.3, value: 20, style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4 } },
        { className: 'TButton', id: 'btn_v_zell', name: 'VarZell', x: 14, y: 4, width: 1.2, height: 1.3, text: 'V', style: { backgroundColor: '#e67300', color: '#fff', borderColor: 'transparent', borderRadius: 4, fontWeight: 'bold' } },

        // ── ZEILE: Rasterlinien + Am Raster ──
        { className: 'TLabel', id: 'lbl_lines', name: 'LblLines', x: 0.5, y: 6.2, width: 4, height: 1.5, text: 'Rasterlinien', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TCheckbox', id: 'chk_lines', name: 'ChkLines', x: 4.5, y: 6.3, width: 0.8, height: 0.8, checked: true },
        { className: 'TLabel', id: 'lbl_snap', name: 'LblSnap', x: 8.5, y: 6.2, width: 4, height: 1.5, text: 'Am Raster', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TCheckbox', id: 'chk_snap', name: 'ChkSnap', x: 12.5, y: 6.3, width: 0.8, height: 0.8, checked: true },

        // ── ZEILE: Rasterfarbe ──
        { className: 'TLabel', id: 'lbl_color_line', name: 'LblLineColor', x: 0.5, y: 8.2, width: 4, height: 1.5, text: 'Rasterfarbe', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TColorPicker', id: 'shp_color_line', name: 'ShpLineColor', x: 3.5, y: 8, width: 1.2, height: 1.3, color: '#dddddd', style: { borderColor: '#333', borderWidth: 1 } },
        { className: 'TEdit', id: 'edt_color_line', name: 'EdtLineColor', x: 4.9, y: 8, width: 8.9, height: 1.3, text: '#dddddd', style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4 } },
        { className: 'TButton', id: 'btn_v_cline', name: 'VarCLine', x: 14, y: 8, width: 1.2, height: 1.3, text: 'V', style: { backgroundColor: '#e67300', color: '#fff', borderColor: 'transparent', borderRadius: 4, fontWeight: 'bold' } },

        // ── ZEILE: Hintergrundfarbe ──
        { className: 'TLabel', id: 'lbl_color_bg', name: 'LblBgColor', x: 0.5, y: 10.2, width: 4, height: 1.5, text: 'Hintergrund', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TColorPicker', id: 'shp_color_bg', name: 'ShpBgColor', x: 3.5, y: 10, width: 1.2, height: 1.3, color: '#f5f5f5', style: { borderColor: '#333', borderWidth: 1 } },
        { className: 'TEdit', id: 'edt_color_bg', name: 'EdtBgColor', x: 4.9, y: 10, width: 8.9, height: 1.3, text: '#f5f5f5', style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4 } },
        { className: 'TButton', id: 'btn_v_bg', name: 'VarBg', x: 14, y: 10, width: 1.2, height: 1.3, text: 'V', style: { backgroundColor: '#e67300', color: '#fff', borderColor: 'transparent', borderRadius: 4, fontWeight: 'bold' } },

        // ── ZEILE: Hintergrundbild ──
        { className: 'TLabel', id: 'lbl_bg_img', name: 'LblBgImg', x: 0.5, y: 12.2, width: 4, height: 1.5, text: 'Hintergrundbild', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TEdit', id: 'edt_bg_img', name: 'EdtBgImg', x: 4.5, y: 12, width: 7.5, height: 1.3, text: '', style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4 } },
        { className: 'TButton', id: 'btn_img_icon1', name: 'BtnImgIcon1', x: 12.2, y: 12, width: 1.4, height: 1.3, text: '🌄', style: { backgroundColor: '#2b2b2b', color: '#fff', borderColor: '#333', borderRadius: 4 } },
        { className: 'TButton', id: 'btn_img_icon2', name: 'BtnImgIcon2', x: 13.8, y: 12, width: 1.4, height: 1.3, text: '📄', style: { backgroundColor: '#2b2b2b', color: '#fff', borderColor: '#333', borderRadius: 4 } },

        // ── ZEILE: Bild-Modus ──
        { className: 'TLabel', id: 'lbl_bg_mode', name: 'LblBgMode', x: 0.5, y: 14.2, width: 4, height: 1.5, text: 'Bild-Modus', style: { color: '#cccccc', fontSize: 12 } },
        { className: 'TDropdown', id: 'cmb_mode', name: 'CmbMode', x: 4.5, y: 14, width: 10.7, height: 1.3, options: ['cover', 'contain', 'fill', 'repeat'], selectedValue: 'cover', style: { backgroundColor: '#1e1e1e', color: '#fff', borderColor: '#333333', borderRadius: 4 } }
    ]
};
agent.addObject('stage_raster', inspectorPanel);

agent.createLabel('stage_raster', 'VorschauTitel', 20, 1, 'LIVE VORSCHAU', { width: 10, height: 1.5, fontSize: 18, fontWeight: 'bold', color: '#ffffff', backgroundColor: 'transparent' });

// Preview Stage Area (as Group Panel)
// Hier binden wir Variablen an die Eigenschaften
agent.addObject('stage_raster', {
    className: 'TGroupPanel',
    id: 'preview_stage',
    name: 'PreviewStage',
    x: 20, y: 3, width: 25, height: 14,
    showGrid: true,
    bindings: {
        gridColor: 'var_raster_color',
        'style.backgroundColor': 'var_raster_bg',
        showGrid: 'var_raster_lines'
    },
    style: {
        backgroundColor: '#f5f5f5',
        borderColor: '#666',
        borderWidth: 2
    }
});


// 5. Speicher das Projekt
const outPath = path.join(process.cwd(), 'projects', 'Tutor_Project_V2.json');
fs.writeFileSync(outPath, JSON.stringify(project, null, 2), 'utf-8');
console.log(`\n🎉 Tutor Project V2 generated exclusively through AgentController API!\nFile saved to: ${outPath}\n`);

// Done.
