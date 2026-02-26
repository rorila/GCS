/**
 * Skript: Erstellt die RoomDashboard-Stage und fügt sie dem Projekt hinzu.
 * Ausführung: npx tsx scripts/create_room_dashboard.ts
 */

const fs = require('fs');
const path = require('path');

const projectPath = path.join(__dirname, '..', 'public', 'project.json');
const project = JSON.parse(fs.readFileSync(projectPath, 'utf-8'));

// Prüfe ob die Stage schon existiert
if (project.stages?.find((s: any) => s.id === 'stage_room_dashboard')) {
    console.log('[CreateStage] RoomDashboard Stage existiert bereits — wird überschrieben.');
    project.stages = project.stages.filter((s: any) => s.id !== 'stage_room_dashboard');
}

// =========================================================================
// RoomDashboard Stage Definition
// Grid: 64 cols x 40 rows x 20px = 1280x800
// =========================================================================

const roomDashboard = {
    id: 'stage_room_dashboard',
    name: 'RoomDashboard',
    type: 'standard',
    inheritsFrom: 'stage_blueprint',
    grid: {
        cols: 64,
        rows: 40,
        cellSize: 20,
        snapToGrid: true,
        visible: true,
        backgroundColor: '#0a0e1a'
    },
    objects: [
        // ===== LEFT SIDEBAR (NavBar) =====
        {
            id: 'rd_sidebar', name: 'Sidebar', className: 'TNavBar',
            x: 0, y: 0, width: 3, height: 40,
            visible: true, scope: 'stage',
            style: {
                backgroundColor: '#0d1117',
                borderColor: 'rgba(0, 255, 200, 0.1)',
                borderWidth: 0,
                borderRadius: 0
            },
            items: [
                { icon: '🔲', label: 'Dashboard', action: 'navigate_stage:stage_dashboard' },
                { icon: '💎', label: 'Rooms', action: 'navigate_stage:stage_rooms' },
                { icon: '📊', label: 'Stats', action: '' },
                { icon: '📈', label: 'Analytics', action: '' }
            ]
        },

        // ===== HEADER BAR =====
        {
            id: 'rd_header_bg', name: 'HeaderBg', className: 'TPanel',
            x: 3, y: 0, width: 61, height: 3,
            visible: true, scope: 'stage',
            style: {
                backgroundColor: '#0d1117',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 0,
                borderRadius: 0
            }
        },
        {
            id: 'rd_back_btn', name: 'BackBtn', className: 'TButton',
            x: 5, y: 1, width: 8, height: 1,
            text: '← BACK TO OVERVIEW', visible: true, scope: 'stage',
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                color: '#8b949e',
                fontSize: 11,
                fontWeight: 'normal',
                textAlign: 'left'
            },
            events: { onClick: [{ type: 'action', name: 'navigate_stage', target: 'stage_dashboard' }] }
        },
        {
            id: 'rd_room_name', name: 'RoomName', className: 'TLabel',
            x: 14, y: 0, width: 12, height: 2,
            text: 'ROOM SIGMA', visible: true, scope: 'stage',
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                color: '#e6edf3',
                fontSize: 22,
                fontWeight: 'bold',
                textAlign: 'left'
            }
        },
        {
            id: 'rd_status_badge', name: 'StatusBadge', className: 'TBadge',
            x: 26, y: 0, width: 4, height: 1,
            text: 'ONLINE', visible: true, scope: 'stage',
            badgeType: 'success', pill: true,
            style: {
                backgroundColor: '#00c896',
                borderWidth: 0,
                borderRadius: 12,
                color: '#000000',
                fontSize: 11,
                fontWeight: 'bold',
                textAlign: 'center'
            }
        },
        {
            id: 'rd_capacity_label', name: 'CapacityLabel', className: 'TLabel',
            x: 14, y: 1, width: 10, height: 1,
            text: 'CAPACITY: 18 / 50', visible: true, scope: 'stage',
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                color: '#00c896',
                fontSize: 11,
                fontWeight: 'normal',
                textAlign: 'left'
            }
        },
        {
            id: 'rd_server_label', name: 'ServerLabel', className: 'TBadge',
            x: 53, y: 1, width: 8, height: 1,
            text: '📡 US-EAST-1 EDGE', visible: true, scope: 'stage',
            badgeType: 'info', pill: false,
            style: {
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                borderWidth: 1,
                borderRadius: 6,
                color: '#e6edf3',
                fontSize: 11,
                fontWeight: 'normal',
                textAlign: 'center'
            }
        },

        // ===== SECTION HEADERS =====
        {
            id: 'rd_players_title', name: 'PlayersTitle', className: 'TLabel',
            x: 5, y: 4, width: 16, height: 2,
            text: 'ASSIGNED PLAYERS (18)', visible: true, scope: 'stage',
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                color: '#e6edf3',
                fontSize: 14,
                fontWeight: 'bold',
                textAlign: 'left'
            }
        },
        {
            id: 'rd_manage_btn', name: 'ManagePlayersBtn', className: 'TButton',
            x: 21, y: 4, width: 9, height: 2,
            text: '👤 MANAGE PLAYERS', visible: true, scope: 'stage',
            style: {
                backgroundColor: '#161b22',
                borderColor: '#30363d',
                borderWidth: 1,
                borderRadius: 8,
                color: '#e6edf3',
                fontSize: 11,
                fontWeight: 'normal',
                textAlign: 'center'
            }
        },
        {
            id: 'rd_games_title', name: 'GamesTitle', className: 'TLabel',
            x: 33, y: 4, width: 14, height: 2,
            text: 'GAME QUEUE (4)', visible: true, scope: 'stage',
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                color: '#e6edf3',
                fontSize: 14,
                fontWeight: 'bold',
                textAlign: 'left'
            }
        },
        {
            id: 'rd_swap_btn', name: 'SwapActiveBtn', className: 'TButton',
            x: 52, y: 4, width: 8, height: 2,
            text: '🔄 SWAP ACTIVE', visible: true, scope: 'stage',
            style: {
                backgroundColor: '#00c896',
                borderWidth: 0,
                borderRadius: 8,
                color: '#000000',
                fontSize: 11,
                fontWeight: 'bold',
                textAlign: 'center'
            }
        },

        // ===== PLAYER LIST (TTable in cards mode) =====
        {
            id: 'rd_player_list', name: 'PlayerList', className: 'TTable',
            x: 5, y: 7, width: 26, height: 22,
            visible: true, scope: 'stage',
            displayMode: 'cards',
            showHeader: false,
            striped: false,
            rowHeight: 60,
            columns: [
                { field: 'name', label: 'Name' },
                { field: 'joinedAgo', label: 'Joined' },
                { field: 'status', label: 'Status' }
            ],
            data: [
                { name: 'Ghost_Spectre', joinedAgo: 'JOINED 12M AGO', status: '● ACTIVE', avatar: '👤' },
                { name: 'NeonPanda_99', joinedAgo: 'JOINED 45M AGO', status: '● IDLE', avatar: '🐼' },
                { name: 'ShadowVoid', joinedAgo: 'JOINED 1H AGO', status: '● ACTIVE', avatar: '👻' },
                { name: 'LunaticCore', joinedAgo: 'JOINED 3H AGO', status: '● ACTIVE', avatar: '💀' }
            ],
            cardConfig: {
                width: 480,
                height: 70,
                gap: 8,
                padding: 16,
                borderRadius: 12,
                backgroundColor: '#161b22',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 1
            },
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0,
                color: '#e6edf3',
                fontSize: 13
            }
        },

        // ===== GAME QUEUE (TTable in cards mode) =====
        {
            id: 'rd_game_queue', name: 'GameQueue', className: 'TTable',
            x: 33, y: 7, width: 28, height: 22,
            visible: true, scope: 'stage',
            displayMode: 'cards',
            showHeader: false,
            striped: false,
            rowHeight: 60,
            columns: [
                { field: 'name', label: 'Game' },
                { field: 'info', label: 'Info' },
                { field: 'status', label: 'Status' }
            ],
            data: [
                { name: 'NEON VELOCITY', info: 'V2.0.0-STABLE • US-EAST', status: '▶ ACTIVE NOW', icon: '🎮' },
                { name: 'CYBER STRIKE: NEO', info: 'STARTS IN 2H 15M', status: '📅 SCHEDULED', icon: '⚔️' },
                { name: 'QUANTUM BREACH', info: 'STARTS IN 6H 30M', status: '📅 SCHEDULED', icon: '🌀' },
                { name: 'VOID HUNTER RAID', info: 'COMPLETED 1H AGO', status: '✅ COMPLETED', icon: '🏹' }
            ],
            cardConfig: {
                width: 520,
                height: 70,
                gap: 8,
                padding: 16,
                borderRadius: 12,
                backgroundColor: '#161b22',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 1
            },
            style: {
                backgroundColor: 'transparent',
                borderWidth: 0,
                borderRadius: 0,
                color: '#e6edf3',
                fontSize: 13
            }
        },

        // ===== STAT CARDS (Bottom Row) =====
        {
            id: 'rd_stat_latency', name: 'StatLatency', className: 'TCard',
            x: 5, y: 31, width: 13, height: 7,
            visible: true, scope: 'stage',
            title: '24', subtitle: 'AVG LATENCY',
            showHeader: true, showFooter: false,
            style: {
                backgroundColor: '#161b22',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 1,
                borderRadius: 12,
                color: '#e6edf3',
                fontSize: 32,
                fontWeight: 'bold'
            }
        },
        {
            id: 'rd_stat_packet', name: 'StatPacketLoss', className: 'TCard',
            x: 19, y: 31, width: 13, height: 7,
            visible: true, scope: 'stage',
            title: '0.02', subtitle: 'PACKET LOSS',
            showHeader: true, showFooter: false,
            style: {
                backgroundColor: '#161b22',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 1,
                borderRadius: 12,
                color: '#e6edf3',
                fontSize: 32,
                fontWeight: 'bold'
            }
        },
        {
            id: 'rd_stat_session', name: 'StatSession', className: 'TCard',
            x: 33, y: 31, width: 14, height: 7,
            visible: true, scope: 'stage',
            title: '4h 12m', subtitle: 'SESSION DURATION',
            showHeader: true, showFooter: false,
            style: {
                backgroundColor: '#161b22',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 1,
                borderRadius: 12,
                color: '#e6edf3',
                fontSize: 32,
                fontWeight: 'bold'
            }
        },
        {
            id: 'rd_stat_network', name: 'StatNetwork', className: 'TCard',
            x: 48, y: 31, width: 13, height: 7,
            visible: true, scope: 'stage',
            title: '14.8', subtitle: 'NETWORK LOAD',
            showHeader: true, showFooter: false,
            style: {
                backgroundColor: '#161b22',
                borderColor: 'rgba(0, 255, 200, 0.08)',
                borderWidth: 1,
                borderRadius: 12,
                color: '#e6edf3',
                fontSize: 32,
                fontWeight: 'bold'
            }
        }
    ],
    actions: [],
    tasks: [],
    variables: [
        {
            id: 'var_rd_selectedPlayer',
            name: 'selectedPlayer',
            className: 'TObjectVariable',
            isVariable: true,
            scope: 'stage',
            type: 'object',
            value: {},
            visible: true,
            x: 0, y: 0, width: 6, height: 2
        },
        {
            id: 'var_rd_selectedGame',
            name: 'selectedGame',
            className: 'TObjectVariable',
            isVariable: true,
            scope: 'stage',
            type: 'object',
            value: {},
            visible: true,
            x: 0, y: 0, width: 6, height: 2
        }
    ]
};

// Stage dem Projekt hinzufügen
project.stages = project.stages || [];
project.stages.push(roomDashboard);

// Speichern
fs.writeFileSync(projectPath, JSON.stringify(project, null, 2), 'utf-8');

console.log(`[CreateStage] ✅ RoomDashboard Stage erfolgreich erstellt!`);
console.log(`[CreateStage]    - ${roomDashboard.objects.length} Objekte`);
console.log(`[CreateStage]    - ${roomDashboard.variables.length} Variablen`);
console.log(`[CreateStage]    - Grid: ${roomDashboard.grid.cols}x${roomDashboard.grid.rows} @ ${roomDashboard.grid.cellSize}px = 1280x800`);
console.log(`[CreateStage]    - Inherits from: stage_blueprint`);
