import { FlowElement } from '../flow/FlowElement';
import { FlowAction } from '../flow/FlowAction';
import { FlowConnection } from '../flow/FlowConnection';
import { isFeatureContext, parseFeatureContext, findFeatureById, featureContextId } from '../../model/FeatureHierarchy';
import { analyzeFeatureFlow } from '../../model/FeatureFlowAnalysis';

import { libraryService } from '../../services/LibraryService';
import { Logger } from '../../utils/Logger';

export interface FlowGraphHydrationHost {
    project: any;
    currentFlowContext: string;
    nodes: FlowElement[];
    connections: FlowConnection[];
    canvas: HTMLElement;
    flowStage: any;
    isLoading: boolean;
    syncManager: any;
    graphManager: any;
    mapManager: any;
    lifecycleManager?: any;
    onNodesChanged?: (nodes: FlowElement[]) => void;

    getActiveStage(): any;
    getTaskDefinitionByName(name: string): any;
    getTargetFlowCharts(name: string): any;
    clearFlowCanvas(): void;
    updateScrollArea(): void;
    updateActionDetails(): void;
    setupConnectionListeners(conn: FlowConnection): void;
    syncToProject(): void;
    handleNodeDoubleClick(node: FlowElement): void;
}

export class FlowGraphHydrator {
    private static logger = Logger.get('FlowGraphHydrator', 'Flow_Synchronization');

    constructor(private host: FlowGraphHydrationHost) { }

    public loadFromProject(contextName?: string) {
        if (!this.host.project) return;

        if (contextName) {
            (this.host as any).currentFlowContext = contextName;
        }

        this.host.isLoading = true;
        this.host.clearFlowCanvas();
        // Feature-Container-Layer und Spielablauf-Übersicht des vorherigen Kontexts entfernen
        this.host.canvas.querySelectorAll('.gcs-feature-layer, .gcs-game-lifecycle-view').forEach(el => el.remove());

        if (this.host.currentFlowContext === 'event-map') {
            this.host.mapManager.generateEventMap();
            return;
        }

        if (this.host.currentFlowContext === 'element-overview') {
            this.host.mapManager.generateElementOverview();
            return;
        }

        if (this.host.currentFlowContext === 'game-lifecycle') {
            if (this.host.lifecycleManager) {
                this.host.lifecycleManager.generateGameLifecycle();
            }
            return;
        }

        let sourceData: { elements: any[], connections: any[] } | undefined;
        const activeStage = this.host.getActiveStage();

        if (this.host.currentFlowContext === 'global') {
            // Global-Kontext: Bestehende Logik beibehalten
            const blueprintStage = this.host.project.stages?.find((s: any) => s.type === 'blueprint' || s.id === 'stage_blueprint');
            const blueprintFlowIdx = blueprintStage?.flowCharts?.global;
            const stageFlowIdx = activeStage?.flowCharts?.global;
            const projectFlowIdx = (this.host.project.flowCharts?.global) || (this.host.project as any).flow;
            sourceData = stageFlowIdx || blueprintFlowIdx || projectFlowIdx;
        } else if (isFeatureContext(this.host.currentFlowContext)) {
            // Feature-Kontext: READ-ONLY Übersicht. Der Schichten-Graph wird
            // vollständig abgeleitet (Stories → Trigger → transitive
            // Task-Aufrufe) und nicht zurückgeschrieben.
            const fid = parseFeatureContext(this.host.currentFlowContext);
            const found = findFeatureById(this.host.project, fid);
            if (found) {
                sourceData = this.buildFeatureOverview(found.feature, found.stage?.features || []);
                FlowGraphHydrator.logger.info(`Feature-Übersicht generiert für "${found.feature.name}" (${sourceData.elements.length} Nodes).`);
            } else {
                sourceData = { elements: [], connections: [] };
            }
        } else {
            // =====================================================================
            // DYNAMISCHE FLOW-GENERIERUNG: FlowCharts aus actionSequence erzeugen
            // Layout wird bei jeder Anzeige neu berechnet (keine Persistenz)
            // =====================================================================
            const task = this.host.getTaskDefinitionByName(this.host.currentFlowContext);
            if (task) {
                sourceData = this.host.syncManager.generateFlowFromActionSequence(task);
                // Standalone-Nodes nachladen (nicht in actionSequence, z.B. unverbundene Actions)
                if (task.standaloneNodes && task.standaloneNodes.length > 0) {
                    sourceData!.elements.push(...task.standaloneNodes);
                    FlowGraphHydrator.logger.info(`${task.standaloneNodes.length} standalone Node(s) nachgeladen für "${task.name}"`);
                }
                if (task.standaloneConnections && task.standaloneConnections.length > 0) {
                    sourceData!.connections.push(...task.standaloneConnections);
                    FlowGraphHydrator.logger.info(`${task.standaloneConnections.length} standalone Connection(s) nachgeladen für "${task.name}"`);
                }
                FlowGraphHydrator.logger.info(`Flow dynamisch generiert f\u00fcr "${task.name}" (${sourceData!.elements.length} Nodes).`);
            } else {
                // Task existiert nicht → leerer Flow
                sourceData = { elements: [], connections: [] };
            }
        }

        if (!sourceData) return;

        if (sourceData.elements) {
            FlowGraphHydrator.logger.info(`[TRACE] loadFromProject: Found ${sourceData.elements.length} elements in source data. Hydrating nodes...`);
            sourceData.elements.forEach((data: any) => {
                FlowGraphHydrator.logger.info(`[TRACE] Hydrating node: ID=${data.id}, type=${data.type}, x=${data.x}, y=${data.y}`);
                const node = this.host.syncManager.restoreNode(data);
                if (node) {
                    this.host.nodes.push(node);
                    FlowGraphHydrator.logger.info(`[TRACE] Hydrated successfully: ${node.Name}`);
                } else {
                    FlowGraphHydrator.logger.error(`[ERROR] Failed to hydrate node: ID=${data.id}`);
                }
            });
        }

        if (sourceData.connections) {
            FlowGraphHydrator.logger.info(`[TRACE] loadFromProject: Found ${sourceData.connections.length} connections in source data.`);
            sourceData.connections.forEach((data: any) => {
                this.host.graphManager.restoreConnection(data);
            });
        }

        if (isFeatureContext(this.host.currentFlowContext)) {
            this.renderFeatureContainers((sourceData as any).featureContainers || []);
            this.applyFeatureOverviewStyling();
        }

        [...this.host.nodes].forEach(node => {
            if (node.data?.isExpanded) {
                this.refreshEmbeddedTask(node);
            }
        });

        if (this.host.onNodesChanged) {
            this.host.onNodesChanged(this.host.nodes);
        }

        this.host.updateScrollArea();
        this.host.updateActionDetails();
        this.host.isLoading = false;

        // =====================================================================
        // POST-PROCESSING: Orthogonales Layout formatieren
        // Muss NACH allen autoSize()-Aufrufen laufen.
        // setTimeout garantiert, dass dies NACH allen synchronen Calls passiert.
        // Feature-Kontexte haben ein eigenes Spalten-Layout → ausgenommen.
        // =====================================================================
        if (this.host.currentFlowContext !== 'global' && !isFeatureContext(this.host.currentFlowContext) && this.host.nodes.length > 1) {
            // E2E-Modus: Keine Animation, nur Layout formatieren
            const isE2E = typeof window !== 'undefined' && new URLSearchParams(window.location.search).get('e2e') === 'true';

            if (isE2E) {
                setTimeout(() => this.formatOrthogonalLayout(), 50);
            } else {
                // Nodes off-screen nach links verschieben (unsichtbar für User)
                this.host.nodes.forEach(n => {
                    const el = (n as any).element;
                    if (el) {
                        el.style.transform = 'translateX(-2000px)';
                        el.style.transition = 'none';
                    }
                });
                // Connections verstecken
                (this.host.connections || []).forEach((c: any) => {
                    if (c.element) {
                        c.element.style.opacity = '0';
                        c.element.style.transition = 'none';
                    }
                });

                setTimeout(() => {
                    this.formatOrthogonalLayout();

                    // Nach Formatierung: Nodes sanft in den sichtbaren Bereich schieben
                    requestAnimationFrame(() => {
                        this.host.nodes.forEach(n => {
                            const el = (n as any).element;
                            if (el) {
                                el.style.transition = 'transform 0.5s ease-out';
                                el.style.transform = 'translateX(0)';
                            }
                        });
                        (this.host.connections || []).forEach((c: any) => {
                            if (c.element) {
                                c.element.style.transition = 'opacity 0.5s ease-out';
                                c.element.style.opacity = '1';
                            }
                        });
                    });
                }, 50);
            }
        }
    }

    /**
     * Wandelt den abgeleiteten Feature-Graph (analyzeFeatureFlow) in
     * Flow-Elements/Connections um — Container-Layout wie in der
     * User-Stories-Gliederung: Bereich → Feature-Boxen → Story-Zeilen
     * (⚡ Auslöser → Task → Aufrufkette nach rechts).
     * Zusätzlich werden Container-Rechtecke für renderFeatureContainers
     * als sourceData.featureContainers zurückgegeben.
     */
    private buildFeatureOverview(feature: any, stageFeatures: any[]): { elements: any[], connections: any[], featureContainers: any[] } {
        const graph = analyzeFeatureFlow(this.host.project, feature, stageFeatures);
        const elements: any[] = [];
        const connections: any[] = [];
        const featureContainers: any[] = [];

        const cellSize = this.host.flowStage?.cellSize || 20;
        const snap = (v: number) => Math.round(v / cellSize) * cellSize;

        const PAD = 20;
        const HEADER_H = 40;
        const SUB_GAP = 16;
        const CHILD_GAP = 20;
        const GAP_X = 40;
        const NODE_H = snap(56);
        const SUBROW_H = NODE_H + SUB_GAP;
        const EVT_W = snap(180);
        const NODE_W = snap(230);
        const MIN_W = snap(320);
        const TOP = snap(40);
        const LEFT = snap(40);

        const nodeW = (n: any) => n.kind === 'event' ? EVT_W : NODE_W;
        // Feste Spaltenpositionen: 0 = Auslöser, 1 = Task, 2+ = Aufrufebenen
        const colX = (xIndex: number) =>
            PAD + (xIndex === 0 ? 0 : EVT_W + GAP_X + (xIndex - 1) * (NODE_W + GAP_X));
        // Höhe einer Zeilengruppe = (maxSubRow + 1) * SUBROW_H
        const rowHeight = (row: any[]) =>
            (Math.max(0, ...row.map((n: any) => n.subRow || 0)) + 1) * SUBROW_H - SUB_GAP;

        // Zeilen des Containers: rowIndex → Nodes (sortiert nach xIndex/subRow)
        const rowsOf = (fid: string): any[][] => {
            const rows = new Map<number, any[]>();
            graph.nodes.filter(n => n.containerId === fid).forEach(n => {
                const r = rows.get(n.rowIndex) || [];
                r.push(n);
                rows.set(n.rowIndex, r);
            });
            return [...rows.entries()].sort((a, b) => a[0] - b[0])
                .map(([, ns]) => ns.sort((a, b) => a.xIndex - b.xIndex || a.subRow - b.subRow));
        };

        // Bottom-up: Größen bestimmen
        const measure = (c: any): { w: number, h: number } => {
            const rows = rowsOf(c.featureId);
            // Breite = rechteste Kante der belegten Spalte + GAP
            const rowsW = rows.reduce((m: number, r: any[]) => {
                const maxX = Math.max(0, ...r.map((n: any) => n.xIndex));
                return Math.max(m, colX(maxX) + nodeW(r.find((n: any) => n.xIndex === maxX)) - PAD);
            }, 0);
            const childSizes = c.children.map(measure);
            const childW = childSizes.reduce((m: number, s: { w: number, h: number }) => Math.max(m, s.w), 0);
            const headerW = 120 + c.title.length * 9;
            const w = snap(Math.max(MIN_W, headerW, rowsW + 2 * PAD, childW + 2 * PAD));
            const rowsH = rows.length
                ? rows.reduce((s: number, r: any[]) => s + rowHeight(r) + SUB_GAP, 0) + PAD
                : 0;
            const childH = childSizes.reduce((s: number, sz: { w: number, h: number }) => s + sz.h + CHILD_GAP, 0);
            const h = snap(HEADER_H + rowsH + (c.children.length ? childH + PAD : PAD));
            c._size = { w, h };
            return c._size;
        };

        // Top-down: Positionen vergeben + Elemente erzeugen
        const place = (c: any, x: number, y: number) => {
            const { w, h } = c._size;
            c._rect = { x: snap(x), y: snap(y), w, h };
            const directIds: string[] = [];
            let ry = c._rect.y + HEADER_H + 6;
            rowsOf(c.featureId).forEach(row => {
                row.forEach(n => {
                    n._pos = {
                        x: snap(c._rect.x + colX(n.xIndex)),
                        y: snap(ry + (n.subRow || 0) * SUBROW_H)
                    };
                    directIds.push(n.id);
                });
                ry += rowHeight(row) + SUB_GAP;
            });
            let cy = ry + (rowsOf(c.featureId).length ? CHILD_GAP - 6 : 0);
            c.children.forEach((ch: any) => {
                place(ch, x + PAD, cy);
                cy += ch._size.h + CHILD_GAP;
            });
            c._directIds = directIds;
        };

        if (graph.container) {
            measure(graph.container);
            place(graph.container, LEFT, TOP);
        }

        graph.nodes.forEach(n => {
            const pos = (n as any)._pos || { x: LEFT + PAD, y: TOP + HEADER_H };
            if (n.kind === 'task' || n.kind === 'implicit') {
                elements.push({
                    id: n.id, type: 'task', x: pos.x, y: pos.y, width: NODE_W, height: NODE_H,
                    properties: {
                        name: n.taskName, text: n.taskName,
                        description: n.storyTitle ? `Story: ${n.storyTitle}` : 'Aufgerufener Task (keine Story)'
                    },
                    data: { taskName: n.taskName, featureRole: n.kind, seqNo: n.seqNo }
                });
            } else {
                elements.push({
                    id: n.id, type: 'Action', x: pos.x, y: pos.y, width: nodeW(n), height: NODE_H,
                    properties: { name: n.label, text: n.label, description: n.storyTitle || n.triggerText || '' },
                    data: { name: n.label, type: n.kind === 'event' ? 'event' : 'story', featureRole: n.kind, storyId: n.storyId }
                });
            }
        });

        // Anker richtungsabhängig: vertikal dominant → bottom→top bzw.
        // top→bottom; Ziel links → input→output; sonst horizontal output→input.
        const byId = new Map(graph.nodes.map(n => [n.id, n]));
        graph.edges.forEach(e => {
            const s = byId.get(e.from) as any;
            const t = byId.get(e.to) as any;
            let startAnchor = 'output';
            let endAnchor = 'input';
            if (s?._pos && t?._pos) {
                const scx = s._pos.x + nodeW(s) / 2;
                const scy = s._pos.y + NODE_H / 2;
                const tcx = t._pos.x + nodeW(t) / 2;
                const tcy = t._pos.y + NODE_H / 2;
                const dx = tcx - scx;
                const dy = tcy - scy;
                if (Math.abs(dy) > Math.abs(dx)) {
                    if (dy > 0) { startAnchor = 'bottom'; endAnchor = 'top'; }
                    else { startAnchor = 'top'; endAnchor = 'bottom'; }
                } else if (dx < 0) {
                    startAnchor = 'input'; endAnchor = 'output';
                }
            }
            connections.push({
                startTargetId: e.from, endTargetId: e.to,
                data: { startAnchorType: startAnchor, endAnchorType: endAnchor, edgeKind: e.kind }
            });
        });

        // Container-Flachliste inkl. aller Member-/Kind-IDs (für Collapse)
        const flatten = (c: any, ancestors: string[]) => {
            const collectIds = (cc: any, acc: Set<string>) => {
                (cc._directIds || []).forEach((id: string) => acc.add(id));
                cc.children.forEach((k: any) => collectIds(k, acc));
            };
            const allIds = new Set<string>();
            collectIds(c, allIds);
            const childIds: string[] = [];
            const collectChildren = (cc: any) => cc.children.forEach((k: any) => { childIds.push(k.featureId); collectChildren(k); });
            collectChildren(c);
            featureContainers.push({
                featureId: c.featureId, title: c.title, kind: c.kind, depth: c.depth,
                rect: c._rect, allNodeIds: allIds, allChildIds: childIds
            });
            c.children.forEach((k: any) => flatten(k, ancestors.concat(c.featureId)));
        };
        if (graph.container) flatten(graph.container, []);

        // Legende unterhalb des äußersten Containers
        const rootRect = (graph.container as any)?._rect;
        const bottom = rootRect ? rootRect.y + rootRect.h : TOP + 400;
        elements.push({
            id: 'feature-legend', type: 'comment',
            x: LEFT, y: snap(bottom + 24), width: 480, height: 110,
            properties: {
                details:
                    'Legende (nur Ansicht):\n' +
                    '⚡ türkis = Event-Auslöser · #n Badge = bindende Reihenfolge\n' +
                    '▫ grau = Story ohne Task · bernsteinfarben = aufgerufen, keine Story\n' +
                    '— durchgezogen = implementierter Aufruf · ┄ gestrichelt = nur deklariert'
            },
            data: { featureRole: 'legend' }
        });

        return { elements, connections, featureContainers };
    }

    /**
     * Rendert die Feature-Container als DOM-Layer HINTER den Nodes:
     * Bereichsrahmen (orange) / Feature-Rahmen (grau), einklappbar
     * (Default: ausgeklappt), Titel-Klick = Zoom in den Unterkontext.
     */
    private renderFeatureContainers(featureContainers: any[]): void {
        const canvas = this.host.canvas;
        canvas.querySelectorAll('.gcs-feature-layer').forEach(el => el.remove());

        const layer = document.createElement('div');
        layer.className = 'gcs-feature-layer';
        layer.style.cssText = 'position:absolute;left:0;top:0;width:5000px;height:5000px;pointer-events:none;z-index:0;';
        // Direkt nach dem flow-world-Div → hinter allen Nodes
        canvas.insertBefore(layer, canvas.children[1] || null);

        featureContainers.forEach(fc => {
            const r = fc.rect;
            if (!r) return;
            const isBereich = fc.kind === 'bereich';
            const div = document.createElement('div');
            div.className = 'gcs-feature-container';
            div.dataset.fid = fc.featureId;
            div.style.cssText =
                `position:absolute;left:${r.x}px;top:${r.y}px;width:${r.w}px;height:${r.h}px;` +
                `border:${isBereich ? '2px solid rgba(255,152,0,0.75)' : '1.5px solid rgba(140,140,170,0.6)'};` +
                `border-radius:10px;box-sizing:border-box;` +
                `background:${isBereich ? 'rgba(255,152,0,0.05)' : 'rgba(130,130,180,0.05)'};`;

            const header = document.createElement('div');
            header.style.cssText =
                `display:flex;align-items:center;gap:8px;height:30px;padding:0 10px;` +
                `font:600 12px sans-serif;letter-spacing:0.5px;` +
                `color:${isBereich ? '#ffb74d' : '#9aa0c0'};pointer-events:auto;cursor:pointer;user-select:none;`;

            const toggle = document.createElement('span');
            toggle.textContent = '▼';
            toggle.style.cssText = 'font-size:10px;width:14px;text-align:center;';
            const title = document.createElement('span');
            title.textContent = `${isBereich ? 'BEREICH' : 'FEATURE'} · ${fc.title}`;
            header.appendChild(toggle);
            header.appendChild(title);
            div.appendChild(header);
            layer.appendChild(div);

            let collapsed = false;
            const applyCollapse = () => {
                fc.allNodeIds.forEach((id: string) => {
                    const n = this.host.nodes.find(nd => nd.id === id);
                    if (n) n.getElement().style.display = collapsed ? 'none' : '';
                });
                fc.allChildIds.forEach((cid: string) => {
                    const cd = layer.querySelector(`[data-fid="${cid}"]`) as HTMLElement | null;
                    if (cd) cd.style.display = collapsed ? 'none' : '';
                });
                this.host.connections.forEach(c => {
                    const s = (c.startTarget as any)?.id;
                    const t = (c.endTarget as any)?.id;
                    if (fc.allNodeIds.has(s) || fc.allNodeIds.has(t)) {
                        (c as any).element.style.display = collapsed ? 'none' : '';
                    }
                });
                div.style.height = collapsed ? '34px' : `${r.h}px`;
                toggle.textContent = collapsed ? '▶' : '▼';
            };

            toggle.addEventListener('click', (e) => {
                e.stopPropagation();
                collapsed = !collapsed;
                applyCollapse();
            });
            title.addEventListener('click', (e) => {
                e.stopPropagation();
                (this.host as any).switchActionFlow?.(featureContextId(fc.featureId));
            });
        });
    }

    /**
     * Farbliche Kennzeichnung der Feature-Übersicht:
     *  - Events: türkiser Rahmen, türkise Kante
     *  - implizite Tasks (aufgerufen, keine Story): bernsteinfarben, gestrichelt
     *  - offene Stories: grau, gestrichelt
     *  - nur-deklarierte Aufrufe (Trigger ohne Implementierung): gestrichelte Kante
     */
    private applyFeatureOverviewStyling(): void {
        this.host.nodes.forEach(n => {
            const role = n.data?.featureRole;
            const el = n.getElement();
            if (!role || !el) return;
            if (role === 'event') {
                el.style.border = '2px solid #26c6da';
                el.style.boxShadow = '0 0 10px rgba(38,198,218,0.35)';
            } else if (role === 'implicit') {
                el.style.border = '2px dashed #f0b429';
                el.style.opacity = '0.9';
            } else if (role === 'story-open') {
                el.style.border = '2px dashed #888';
                el.style.opacity = '0.7';
            }
            // Reihenfolge-Badge für Story-Tasks (bindende Sequenz)
            if (role === 'task' && n.data?.seqNo) {
                const badge = document.createElement('span');
                badge.textContent = `#${n.data.seqNo}`;
                badge.style.cssText = 'position:absolute;top:-11px;left:-11px;background:#7c4dff;color:#fff;' +
                    'border-radius:11px;padding:2px 8px;font-size:11px;font-weight:bold;z-index:6;pointer-events:none';
                el.appendChild(badge);
            }
        });
        this.host.connections.forEach(c => {
            const kind = c.data?.edgeKind;
            const el = c.getElement();
            if (!el) return;
            if (kind === 'declared') {
                el.style.background = 'none';
                el.style.borderTop = '2px dashed #f0b429';
            } else if (kind === 'event') {
                el.style.background = '#26c6da';
            }
        });
    }

    /**
     * POST-PROCESSING: Orthogonales Layout formatieren.
     * Wird NACH allen autoSize()-Aufrufen ausgeführt.
     */
    public formatOrthogonalLayout(): void {
        const nodes = this.host.nodes.filter(n => n.getType().toLowerCase() !== 'comment');
        const connections = this.host.connections || [];
        FlowGraphHydrator.logger.info(`[TRACE] formatOrthogonalLayout started. Nodes=${nodes.length}, Connections=${connections.length}`);
        if (nodes.length < 2) return;

        const cellSize = this.host.flowStage?.cellSize || 20;
        const Y_GAP = 40;
        const X_GAP = 40;
        const MAIN_X = 40;

        // --- Schritt 1: Vertikale Kette (Root → bottom/false → top) ---
        const rootNode = nodes.find(n =>
            n.getType().toLowerCase() === 'task' && !n.data?.isEmbeddedInternal
        ) || nodes[0];

        const verticalChain: any[] = [rootNode];
        const horizontalNodes: { node: any, sourceNode: any }[] = [];
        const visited = new Set<string>();
        visited.add(rootNode.id);

        let current = rootNode;
        let safety = 0;
        while (safety++ < 50) {
            // Finde ausgehende vertikale Connections (bottom, output, false)
            const verticalConn = connections.find((c: any) =>
                c.startTarget === current && (
                    c.data?.startAnchorType === 'bottom' ||
                    c.data?.startAnchorType === 'false'
                ) && c.endTarget && (
                    c.data?.endAnchorType === 'top' ||
                    c.data?.endAnchorType === 'input'
                )
            );
            if (!verticalConn || !verticalConn.endTarget) {
                 FlowGraphHydrator.logger.info(`[TRACE] End of vertical chain at ${current.Name}. No valid bottom/false connection found.`);
                 break;
            }

            const nextNode = verticalConn.endTarget;
            if (visited.has(nextNode.id)) break;
            visited.add(nextNode.id);

            verticalChain.push(nextNode);
            current = nextNode;
        }

        // --- Schritt 1b: Horizontale Branch-Nodes (true/right/success/output) ---
        connections.forEach((c: any) => {
            if (c.data?.startAnchorType === 'true' ||
                c.data?.startAnchorType === 'right' ||
                c.data?.startAnchorType === 'success' ||
                c.data?.startAnchorType === 'output') {
                if (c.startTarget && c.endTarget) {
                    const endNodeId = c.endTarget.id;
                    if (!visited.has(endNodeId)) {
                        horizontalNodes.push({ node: c.endTarget, sourceNode: c.startTarget });
                        visited.add(endNodeId);
                    }
                }
            }
        });

        FlowGraphHydrator.logger.info(
            `formatOrthogonalLayout: ${verticalChain.length} vertikal, ${horizontalNodes.length} horizontal`
        );

        // --- Schritt 2: Breite der vertikalen Nodes vereinheitlichen ---
        const maxWidth = Math.max(...verticalChain.map(n => n.width));
        const normalizedWidth = Math.ceil(maxWidth / cellSize) * cellSize;

        // --- Schritt 3: Vertikale Positionen ---
        let currentY = MAIN_X;
        verticalChain.forEach(node => {
            node.x = MAIN_X;
            node.y = currentY;
            node.width = normalizedWidth;
            node.updatePosition();
            currentY += node.height + Y_GAP;
        });

        // --- Schritt 4: Horizontale Nodes positionieren ---
        horizontalNodes.forEach(({ node, sourceNode }) => {
            node.x = sourceNode.x + sourceNode.width + X_GAP;
            node.y = sourceNode.y;
            node.width = Math.ceil(node.width / cellSize) * cellSize;
            node.updatePosition();
        });

        // --- Schritt 5: Connections aktualisieren ---
        connections.forEach((c: any) => c.updatePosition?.());

        FlowGraphHydrator.logger.info(
            `formatOrthogonalLayout fertig: Breite=${normalizedWidth}px, Nodes=${nodes.length}`
        );
    }

    public refreshEmbeddedTask(proxyNode: FlowElement) {
        if (!this.host.project || !proxyNode.data?.isExpanded || !proxyNode.data?.sourceTaskName) return;

        const sourceTaskName = proxyNode.data.sourceTaskName;
        let sourceTask = this.host.project.tasks?.find((t: any) => t.name === sourceTaskName);
        let sourceFlowChart = this.host.project.flowCharts?.[sourceTaskName];

        if (!sourceTask) {
            sourceTask = libraryService.getTask(sourceTaskName);
            sourceFlowChart = sourceTask?.flowChart;
        }

        if (!sourceTask || !sourceFlowChart) return;

        const existingGhostNodes = this.host.nodes.filter(n => n.data?.parentProxyId === proxyNode.name);
        if (existingGhostNodes.length > 0) {
            if (!proxyNode.data.ghostPositions) proxyNode.data.ghostPositions = {};
            existingGhostNodes.forEach(n => {
                const originalId = n.data?.originalId || n.name;
                proxyNode.data.ghostPositions[originalId] = { x: n.X, y: n.Y };
            });
        }

        const toDeleteNodes = this.host.nodes.filter(n => n.data?.parentProxyId === proxyNode.name);
        toDeleteNodes.forEach(n => {
            const el = n.getElement();
            if (el.parentNode === this.host.canvas) this.host.canvas.removeChild(el);
            const idx = this.host.nodes.indexOf(n);
            if (idx !== -1) this.host.nodes.splice(idx, 1);
        });

        const toDeleteConns = this.host.connections.filter(c => c.data?.parentProxyId === proxyNode.name);
        toDeleteConns.forEach(c => {
            const el = c.getElement();
            const sh = c.getStartHandle();
            const eh = c.getEndHandle();
            if (el.parentNode === this.host.canvas) this.host.canvas.removeChild(el);
            if (sh.parentNode === this.host.canvas) this.host.canvas.removeChild(sh);
            if (eh.parentNode === this.host.canvas) this.host.canvas.removeChild(eh);
            const idx = this.host.connections.indexOf(c);
            if (idx !== -1) this.host.connections.splice(idx, 1);
        });

        const addedNodes = this.importTaskGraph(proxyNode, sourceTask, true);

        if (addedNodes) {
            addedNodes.forEach(newNode => {
                if (newNode.data?.isExpanded) {
                    this.refreshEmbeddedTask(newNode);
                }
            });
        }
    }

    public importTaskGraph(targetNode: FlowElement, task: any, isLinked: boolean = false): FlowElement[] {
        if (task.name === this.host.currentFlowContext) {
            return [];
        }

        const existingGhosts = this.host.nodes.some(n => n.data?.parentProxyId === targetNode.name);
        if (existingGhosts) {
            return [];
        }

        const projectChart = (this.host.project as any)?.flowCharts?.[task.name];
        const taskChart = task.flowChart || task.flowGraph;

        let flowChart = projectChart;
        const projectCount = projectChart?.elements?.length || 0;
        const taskCount = taskChart?.elements?.length || 0;

        if (!projectChart || (projectCount <= 2 && taskCount > projectCount)) {
            if (taskChart && taskChart.elements && taskChart.elements.length > 0) {
                flowChart = taskChart;
            }
        }

        if (!flowChart || !flowChart.elements || flowChart.elements.length === 0) {
            return [];
        }

        const embeddedGroupId = `embedded-${task.name}-${Date.now()}`;
        const idMap: Record<string, string> = {};
        const getNewId = (oldId: string) => {
            if (!idMap[oldId]) {
                idMap[oldId] = `imported-${Date.now()}-${Math.floor(Math.random() * 1000)}`;
            }
            return idMap[oldId];
        };

        let minX = Infinity, minY = Infinity;
        flowChart.elements.forEach((el: any) => {
            if (el.x < minX) minX = el.x;
            if (el.y < minY) minY = el.y;
        });

        const gridGap = this.host.flowStage.cellSize * 4;
        const offsetX = targetNode.X + targetNode.Width + gridGap - minX;
        const offsetY = targetNode.Y - minY;

        const newNodes: FlowElement[] = [];
        let importedStart: FlowElement | null = null;

        flowChart.elements.forEach((data: any) => {
            const isIdentityNode = data.type?.toLowerCase() === 'task' &&
                (data.properties?.name === task.name ||
                    data.properties?.name === task.sourceTaskName ||
                    data.properties?.name === task.copiedFromLibrary);

            if (isLinked && isIdentityNode) {
                idMap[data.id] = targetNode.name;
                if (!targetNode.data) targetNode.data = {};
                targetNode.data.originalId = data.id;
                return;
            }

            const newData = JSON.parse(JSON.stringify(data));
            newData.id = getNewId(data.id);

            const savedPos = isLinked && targetNode.data?.ghostPositions?.[data.id];
            if (savedPos) {
                newData.x = savedPos.x;
                newData.y = savedPos.y;
            } else {
                newData.x += offsetX;
                newData.y += offsetY;
            }

            const newNode = this.host.syncManager.restoreNode(newData);
            if (newNode) {
                this.host.nodes.push(newNode);
                newNodes.push(newNode);

                if (isLinked) {
                    newNode.setLinked(true);
                    newNode.data = {
                        ...newNode.data,
                        isLinked: true,
                        isEmbeddedInternal: true,
                        parentProxyId: targetNode.name,
                        embeddedGroupId: embeddedGroupId,
                        parentParams: targetNode.data?.params,
                        originalId: data.id
                    };
                }

                if (newNode.getType() === 'start') importedStart = newNode;
            }
        });

        if (!importedStart && newNodes.length > 0) {
            importedStart = newNodes[0];
        }

        if (flowChart.connections) {
            flowChart.connections.forEach((data: any) => {
                // Map IDs using idMap for proxies/embedded flows
                const startId = data.startTargetId ? (idMap[data.startTargetId] || data.startTargetId) : null;
                const endId = data.endTargetId ? (idMap[data.endTargetId] || data.endTargetId) : null;

                // Create a temporary data object with mapped IDs
                const mappedData = {
                    ...data,
                    startTargetId: startId,
                    endTargetId: endId
                };

                // Use the centralized restoreConnection logic to handle the rest
                this.host.graphManager.restoreConnection(mappedData);

                // Add embedded metadata if needed
                const lastConn = this.host.connections[this.host.connections.length - 1];
                if (isLinked && lastConn && lastConn.id === data.id) { // id check to be sure we got the right one
                    lastConn.data = {
                        ...lastConn.data,
                        isEmbeddedInternal: true,
                        parentProxyId: targetNode.name,
                        originalStartAnchorType: data.data?.startAnchorType || 'output'
                    };
                }
            });
        }

        if (isLinked && importedStart) {
            const conn = new FlowConnection(this.host.canvas, 0, 0, 0, 0);
            conn.setGridConfig(this.host.flowStage.cellSize);

            const origStartId = targetNode.data.originalId;
            const origEndId = importedStart.data?.originalId;
            const origStartAnchor = 'output';

            const savedConn = targetNode.data?.ghostConnections?.find((gc: any) =>
                gc.startOriginalId === origStartId &&
                gc.endOriginalId === origEndId &&
                gc.originalStartAnchorType === origStartAnchor
            );

            if (savedConn) {
                conn.data = {
                    ...conn.data,
                    startAnchorType: savedConn.startAnchorType,
                    endAnchorType: savedConn.endAnchorType
                };
            }

            conn.attachStart(targetNode);
            conn.attachEnd(importedStart);
            conn.updatePosition();
            this.host.connections.push(conn);
            this.host.setupConnectionListeners(conn);

            conn.data = {
                ...conn.data,
                isEmbeddedInternal: true,
                parentProxyId: targetNode.name,
                originalStartAnchorType: origStartAnchor
            };
        }

        if (isLinked) {
            targetNode.data.isExpanded = true;
            targetNode.data.sourceTaskName = task.name;
            targetNode.Name = task.name;
            targetNode.Text = task.name;
            targetNode.setLinked(true);
            if (task.description) targetNode.Description = task.description;
        }

        newNodes.forEach(node => {
            if (node.getType() === 'action' && (node as FlowAction).actionType === 'data_action') {
                this.expandDataActionFlow(node as FlowAction);
            }
        });

        this.host.syncToProject();
        if (this.host.onNodesChanged) this.host.onNodesChanged(this.host.nodes);

        return newNodes;
    }

    public expandDataActionFlow(dataActionNode: FlowAction) {
        if (!dataActionNode.data) return;

        const createChain = (actions: any[], branchType: 'success' | 'error', startOffsetY: number) => {
            if (!actions || actions.length === 0) return;

            let previousNode: FlowElement = dataActionNode;
            let currentX = dataActionNode.X + 250;
            let currentY = dataActionNode.Y + startOffsetY;

            actions.forEach((actionData, index) => {
                const ghostId = `${dataActionNode.id}-${branchType}-${index}`;
                if (this.host.nodes.some(n => n.id === ghostId)) return;

                const nodeData = {
                    ...actionData,
                    id: ghostId,
                    x: currentX,
                    y: currentY,
                    isEmbeddedInternal: true,
                    parentProxyId: dataActionNode.id,
                    isLinked: true
                };

                const newNode = this.host.syncManager.restoreNode(nodeData);
                if (newNode) {
                    newNode.setLinked(true);
                    this.host.nodes.push(newNode);

                    const conn = new FlowConnection(this.host.canvas, 0, 0, 0, 0);

                    if (previousNode === dataActionNode) {
                        conn.attachStart(dataActionNode);
                        conn.attachEnd(newNode);
                        conn.data = {
                            startAnchorType: branchType,
                            endAnchorType: 'input',
                            isEmbeddedInternal: true,
                            parentProxyId: dataActionNode.id
                        };
                    } else {
                        conn.attachStart(previousNode);
                        conn.attachEnd(newNode);
                        conn.data = {
                            startAnchorType: 'output',
                            endAnchorType: 'input',
                            isEmbeddedInternal: true,
                            parentProxyId: dataActionNode.id
                        };
                    }

                    conn.updatePosition();
                    this.host.connections.push(conn);
                    this.host.setupConnectionListeners(conn);

                    previousNode = newNode;
                    currentX += 200;
                }
            });
        };

        if (dataActionNode.data.successBody) {
            createChain(dataActionNode.data.successBody, 'success', 0);
        }

        if (dataActionNode.data.errorBody) {
            createChain(dataActionNode.data.errorBody, 'error', 120);
        }
    }
}
