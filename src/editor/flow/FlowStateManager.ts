import { FlowElement } from './FlowElement';
import { FlowConnection } from './FlowConnection';

/**
 * FlowStateManager - Single Source of Truth für alle Flow-Editor-Zustände
 * 
 * Dieses Modul verwaltet:
 * - Nodes (FlowElement[])
 * - Connections (FlowConnection[])
 * - Selection-State
 * - Flow-Context (global, event-map, element-overview, TaskName)
 * - View-Einstellungen (showDetails, filterText)
 * 
 * @see docs/FlowEditor_DV_Konzept.md für Architektur-Details
 */
export class FlowStateManager {
    // ─────────────────────────────────────────────
    // Core State
    // ─────────────────────────────────────────────
    private _nodes: FlowElement[] = [];
    private _connections: FlowConnection[] = [];
    private _selectedNode: FlowElement | null = null;
    private _selectedConnection: FlowConnection | null = null;

    // ─────────────────────────────────────────────
    // Context State
    // ─────────────────────────────────────────────
    private _currentContext: string = 'global';
    private _showDetails: boolean = false;
    private _filterText: string = '';

    // ─────────────────────────────────────────────
    // Callbacks (Events)
    // ─────────────────────────────────────────────
    public onNodeAdded?: (node: FlowElement) => void;
    public onNodeRemoved?: (id: string) => void;
    public onSelectionChanged?: (node: FlowElement | null) => void;
    public onConnectionAdded?: (conn: FlowConnection) => void;
    public onConnectionRemoved?: (conn: FlowConnection) => void;
    public onContextChanged?: (context: string) => void;
    public onDetailsToggled?: (showDetails: boolean) => void;
    public onFilterChanged?: (filterText: string) => void;

    // ─────────────────────────────────────────────
    // Node Management
    // ─────────────────────────────────────────────

    /**
     * Fügt einen Node zur Collection hinzu
     */
    public addNode(node: FlowElement): void {
        this._nodes.push(node);
        if (this.onNodeAdded) {
            this.onNodeAdded(node);
        }
    }

    /**
     * Entfernt einen Node anhand seiner ID
     * @returns true wenn Node gefunden und entfernt wurde
     */
    public removeNode(id: string): boolean {
        const index = this._nodes.findIndex(n => n.name === id);
        if (index === -1) return false;

        const node = this._nodes[index];

        // Clear selection if this node was selected
        if (this._selectedNode === node) {
            this._selectedNode = null;
            if (this.onSelectionChanged) {
                this.onSelectionChanged(null);
            }
        }

        this._nodes.splice(index, 1);

        if (this.onNodeRemoved) {
            this.onNodeRemoved(id);
        }

        return true;
    }

    /**
     * Prüft ob ein Node mit der gegebenen ID existiert
     */
    public hasNode(id: string): boolean {
        return this._nodes.some(n => n.name === id);
    }

    /**
     * Gibt eine Kopie der Node-Liste zurück
     */
    public getNodes(): FlowElement[] {
        return [...this._nodes];
    }

    /**
     * Gibt die interne Node-Liste zurück (für Performance-kritische Operationen)
     * ACHTUNG: Nicht direkt modifizieren! Nur für Iteration verwenden.
     */
    public getNodesInternal(): FlowElement[] {
        return this._nodes;
    }

    /**
     * Findet einen Node anhand seiner ID
     */
    public getNodeById(id: string): FlowElement | null {
        return this._nodes.find(n => n.name === id) || null;
    }

    /**
     * Ersetzt die gesamte Node-Liste (für Load-Operationen)
     */
    public setNodes(nodes: FlowElement[]): void {
        this._nodes = nodes;
    }

    /**
     * Leert die Node-Liste
     */
    public clearNodes(): void {
        this._nodes = [];
        this._selectedNode = null;
    }

    // ─────────────────────────────────────────────
    // Selection Management
    // ─────────────────────────────────────────────

    /**
     * Setzt den aktuell selektierten Node
     */
    public selectNode(node: FlowElement | null): void {
        // Deselect previous
        if (this._selectedNode && this._selectedNode !== node) {
            this._selectedNode.getElement().style.outline = 'none';
        }

        // Deselect connection if selecting a node
        if (node && this._selectedConnection) {
            this._selectedConnection.deselect();
            this._selectedConnection = null;
        }

        this._selectedNode = node;

        // Apply selection style
        if (node) {
            node.getElement().style.outline = '2px solid #007acc';
        }

        if (this.onSelectionChanged) {
            this.onSelectionChanged(node);
        }
    }

    /**
     * Gibt den aktuell selektierten Node zurück
     */
    public getSelectedNode(): FlowElement | null {
        return this._selectedNode;
    }

    /**
     * Deselektiert alles (Node und Connection)
     */
    public deselectAll(): void {
        if (this._selectedConnection) {
            this._selectedConnection.deselect();
            this._selectedConnection = null;
        }

        if (this._selectedNode) {
            this._selectedNode.getElement().style.outline = 'none';
            this._selectedNode = null;
        }

        if (this.onSelectionChanged) {
            this.onSelectionChanged(null);
        }
    }

    // ─────────────────────────────────────────────
    // Connection Management
    // ─────────────────────────────────────────────

    /**
     * Fügt eine Connection hinzu
     */
    public addConnection(conn: FlowConnection): void {
        this._connections.push(conn);
        if (this.onConnectionAdded) {
            this.onConnectionAdded(conn);
        }
    }

    /**
     * Entfernt eine Connection
     */
    public removeConnection(conn: FlowConnection): void {
        const index = this._connections.indexOf(conn);
        if (index !== -1) {
            this._connections.splice(index, 1);

            // Clear selection if this connection was selected
            if (this._selectedConnection === conn) {
                this._selectedConnection = null;
            }

            if (this.onConnectionRemoved) {
                this.onConnectionRemoved(conn);
            }
        }
    }

    /**
     * Gibt eine Kopie der Connection-Liste zurück
     */
    public getConnections(): FlowConnection[] {
        return [...this._connections];
    }

    /**
     * Gibt die interne Connection-Liste zurück
     */
    public getConnectionsInternal(): FlowConnection[] {
        return this._connections;
    }

    /**
     * Ersetzt die gesamte Connection-Liste
     */
    public setConnections(connections: FlowConnection[]): void {
        this._connections = connections;
    }

    /**
     * Leert die Connection-Liste
     */
    public clearConnections(): void {
        this._connections = [];
        this._selectedConnection = null;
    }

    /**
     * Findet alle Connections die mit einem Node verbunden sind
     */
    public getConnectionsForNode(node: FlowElement): FlowConnection[] {
        return this._connections.filter(c =>
            c.startTarget === node || c.endTarget === node
        );
    }

    /**
     * Setzt die selektierte Connection
     */
    public selectConnection(conn: FlowConnection | null): void {
        // Deselect previous
        if (this._selectedConnection && this._selectedConnection !== conn) {
            this._selectedConnection.deselect();
        }

        // Deselect node if selecting a connection
        if (conn && this._selectedNode) {
            this._selectedNode.getElement().style.outline = 'none';
            this._selectedNode = null;
        }

        this._selectedConnection = conn;

        if (conn) {
            conn.select();
        }
    }

    /**
     * Gibt die aktuell selektierte Connection zurück
     */
    public getSelectedConnection(): FlowConnection | null {
        return this._selectedConnection;
    }

    // ─────────────────────────────────────────────
    // Context Management
    // ─────────────────────────────────────────────

    /**
     * Setzt den aktuellen Flow-Context
     * @param context 'global' | 'event-map' | 'element-overview' | TaskName
     */
    public setContext(context: string): void {
        if (this._currentContext === context) return;

        this._currentContext = context;

        // Persist to localStorage
        localStorage.setItem('gcs_last_flow_context', context);

        if (this.onContextChanged) {
            this.onContextChanged(context);
        }
    }

    /**
     * Gibt den aktuellen Context zurück
     */
    public getContext(): string {
        return this._currentContext;
    }

    /**
     * Prüft ob der aktuelle Context ein spezieller View ist (nicht editierbar)
     */
    public isSpecialContext(): boolean {
        return this._currentContext === 'event-map' ||
            this._currentContext === 'element-overview';
    }

    /**
     * Prüft ob der aktuelle Context der globale Flow ist
     */
    public isGlobalContext(): boolean {
        return this._currentContext === 'global';
    }

    /**
     * Prüft ob der aktuelle Context ein Task-Flow ist
     */
    public isTaskContext(): boolean {
        return !this.isSpecialContext() && !this.isGlobalContext();
    }

    // ─────────────────────────────────────────────
    // View Settings
    // ─────────────────────────────────────────────

    /**
     * Setzt den Details-Modus
     */
    public setShowDetails(show: boolean): void {
        this._showDetails = show;

        // Persist to localStorage
        localStorage.setItem('gcs_flow_show_details', show.toString());

        if (this.onDetailsToggled) {
            this.onDetailsToggled(show);
        }
    }

    /**
     * Gibt zurück ob der Details-Modus aktiv ist
     */
    public getShowDetails(): boolean {
        return this._showDetails;
    }

    /**
     * Lädt den Details-Modus aus localStorage
     */
    public loadShowDetailsFromStorage(): void {
        this._showDetails = localStorage.getItem('gcs_flow_show_details') === 'true';
    }

    /**
     * Setzt den Filter-Text
     */
    public setFilter(text: string): void {
        this._filterText = text.toLowerCase();

        if (this.onFilterChanged) {
            this.onFilterChanged(this._filterText);
        }
    }

    /**
     * Gibt den aktuellen Filter-Text zurück
     */
    public getFilter(): string {
        return this._filterText;
    }

    // ─────────────────────────────────────────────
    // Bulk Operations
    // ─────────────────────────────────────────────

    /**
     * Leert den gesamten State (für Context-Wechsel)
     */
    public clear(): void {
        this.clearNodes();
        this.clearConnections();
    }

    /**
     * Gibt Statistiken über den aktuellen State zurück (für Debugging)
     */
    public getStats(): { nodes: number; connections: number; context: string; showDetails: boolean } {
        return {
            nodes: this._nodes.length,
            connections: this._connections.length,
            context: this._currentContext,
            showDetails: this._showDetails
        };
    }
}
