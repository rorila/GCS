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
    constructor() {
        // ─────────────────────────────────────────────
        // Core State
        // ─────────────────────────────────────────────
        this._nodes = [];
        this._connections = [];
        this._selectedNode = null;
        this._selectedConnection = null;
        // ─────────────────────────────────────────────
        // Context State
        // ─────────────────────────────────────────────
        this._currentContext = 'global';
        this._showDetails = false;
        this._filterText = '';
    }
    // ─────────────────────────────────────────────
    // Node Management
    // ─────────────────────────────────────────────
    /**
     * Fügt einen Node zur Collection hinzu
     */
    addNode(node) {
        this._nodes.push(node);
        if (this.onNodeAdded) {
            this.onNodeAdded(node);
        }
    }
    /**
     * Entfernt einen Node anhand seiner ID
     * @returns true wenn Node gefunden und entfernt wurde
     */
    removeNode(id) {
        const index = this._nodes.findIndex(n => n.name === id);
        if (index === -1)
            return false;
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
    hasNode(id) {
        return this._nodes.some(n => n.name === id);
    }
    /**
     * Gibt eine Kopie der Node-Liste zurück
     */
    getNodes() {
        return [...this._nodes];
    }
    /**
     * Gibt die interne Node-Liste zurück (für Performance-kritische Operationen)
     * ACHTUNG: Nicht direkt modifizieren! Nur für Iteration verwenden.
     */
    getNodesInternal() {
        return this._nodes;
    }
    /**
     * Findet einen Node anhand seiner ID
     */
    getNodeById(id) {
        return this._nodes.find(n => n.name === id) || null;
    }
    /**
     * Ersetzt die gesamte Node-Liste (für Load-Operationen)
     */
    setNodes(nodes) {
        this._nodes = nodes;
    }
    /**
     * Leert die Node-Liste
     */
    clearNodes() {
        this._nodes = [];
        this._selectedNode = null;
    }
    // ─────────────────────────────────────────────
    // Selection Management
    // ─────────────────────────────────────────────
    /**
     * Setzt den aktuell selektierten Node
     */
    selectNode(node) {
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
    getSelectedNode() {
        return this._selectedNode;
    }
    /**
     * Deselektiert alles (Node und Connection)
     */
    deselectAll() {
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
    addConnection(conn) {
        this._connections.push(conn);
        if (this.onConnectionAdded) {
            this.onConnectionAdded(conn);
        }
    }
    /**
     * Entfernt eine Connection
     */
    removeConnection(conn) {
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
    getConnections() {
        return [...this._connections];
    }
    /**
     * Gibt die interne Connection-Liste zurück
     */
    getConnectionsInternal() {
        return this._connections;
    }
    /**
     * Ersetzt die gesamte Connection-Liste
     */
    setConnections(connections) {
        this._connections = connections;
    }
    /**
     * Leert die Connection-Liste
     */
    clearConnections() {
        this._connections = [];
        this._selectedConnection = null;
    }
    /**
     * Findet alle Connections die mit einem Node verbunden sind
     */
    getConnectionsForNode(node) {
        return this._connections.filter(c => c.startTarget === node || c.endTarget === node);
    }
    /**
     * Setzt die selektierte Connection
     */
    selectConnection(conn) {
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
    getSelectedConnection() {
        return this._selectedConnection;
    }
    // ─────────────────────────────────────────────
    // Context Management
    // ─────────────────────────────────────────────
    /**
     * Setzt den aktuellen Flow-Context
     * @param context 'global' | 'event-map' | 'element-overview' | TaskName
     */
    setContext(context) {
        if (this._currentContext === context)
            return;
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
    getContext() {
        return this._currentContext;
    }
    /**
     * Prüft ob der aktuelle Context ein spezieller View ist (nicht editierbar)
     */
    isSpecialContext() {
        return this._currentContext === 'event-map' ||
            this._currentContext === 'element-overview';
    }
    /**
     * Prüft ob der aktuelle Context der globale Flow ist
     */
    isGlobalContext() {
        return this._currentContext === 'global';
    }
    /**
     * Prüft ob der aktuelle Context ein Task-Flow ist
     */
    isTaskContext() {
        return !this.isSpecialContext() && !this.isGlobalContext();
    }
    // ─────────────────────────────────────────────
    // View Settings
    // ─────────────────────────────────────────────
    /**
     * Setzt den Details-Modus
     */
    setShowDetails(show) {
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
    getShowDetails() {
        return this._showDetails;
    }
    /**
     * Lädt den Details-Modus aus localStorage
     */
    loadShowDetailsFromStorage() {
        this._showDetails = localStorage.getItem('gcs_flow_show_details') === 'true';
    }
    /**
     * Setzt den Filter-Text
     */
    setFilter(text) {
        this._filterText = text.toLowerCase();
        if (this.onFilterChanged) {
            this.onFilterChanged(this._filterText);
        }
    }
    /**
     * Gibt den aktuellen Filter-Text zurück
     */
    getFilter() {
        return this._filterText;
    }
    // ─────────────────────────────────────────────
    // Bulk Operations
    // ─────────────────────────────────────────────
    /**
     * Leert den gesamten State (für Context-Wechsel)
     */
    clear() {
        this.clearNodes();
        this.clearConnections();
    }
    /**
     * Gibt Statistiken über den aktuellen State zurück (für Debugging)
     */
    getStats() {
        return {
            nodes: this._nodes.length,
            connections: this._connections.length,
            context: this._currentContext,
            showDetails: this._showDetails
        };
    }
}
