
import { IInspectorHandler, PropertyChangeEvent, InspectorSection } from '../types';
import { GameProject } from '../../../model/types';
import { ReactiveRuntime } from '../../../runtime/ReactiveRuntime';
import { projectStore } from '../../../services/ProjectStore';

export class StageHandler implements IInspectorHandler {

    canHandle(obj: any): boolean {
        // Stages have an id, type and objects array but no className (usually)
        // In the editor, when a stage is passed to the inspector, it's the StageDefinition
        return obj && typeof obj === 'object' && obj.id && obj.type && Array.isArray(obj.objects) && !obj.className;
    }

    getInspectorTemplate(_obj: any): string | null {
        // Nicht mehr verwendet — getSections() liefert die Darstellung
        return null;
    }

    getEventsTemplate(_obj: any): string | null {
        return './inspector_stage_events.json';
    }

    /**
     * Liefert Inspector-Sektionen für eine Stage (IInspectable-kompatibel).
     * Ersetzt das alte inspector_stage.json Template.
     */
    getSections(stage: any, project?: GameProject): InspectorSection[] {
        const sections: InspectorSection[] = [];

        // ── BASIS ──────────────────────────────────────────────
        const basisProps: any[] = [
            { name: 'type', label: 'Typ', type: 'select', options: ['standard', 'splash', 'main', 'template'] },
            { name: 'name', label: 'Stage Name', type: 'string' },
        ];

        // Spielname (nur bei main-Stage)
        if (stage.type === 'main') {
            basisProps.push(
                { name: 'gameName', label: 'Spielname', type: 'string', defaultValue: project?.meta?.name || '' },
                { name: 'author', label: 'Autor', type: 'string', defaultValue: project?.meta?.author || '' },
            );
        }

        basisProps.push(
            { name: 'description', label: 'Beschreibung', type: 'string', defaultValue: '' }
        );

        sections.push({
            id: 'basis',
            label: 'Basis',
            icon: '📋',
            properties: basisProps
        });

        // ── RASTER ─────────────────────────────────────────────
        sections.push({
            id: 'raster',
            label: 'Raster',
            icon: '🔲',
            properties: [
                { name: 'grid.cols', label: 'Spalten', type: 'number', inline: true, defaultValue: 64 },
                { name: 'grid.rows', label: 'Zeilen', type: 'number', inline: true, defaultValue: 40 },
                { name: 'grid.cellSize', label: 'Zellgröße', type: 'number', defaultValue: 20 },
                { name: 'grid.visible', label: 'Rasterlinien', type: 'boolean', inline: true, defaultValue: true },
                { name: 'grid.snapToGrid', label: 'Am Raster', type: 'boolean', inline: true, defaultValue: true },
                { name: 'grid.gridColor', label: 'Rasterfarbe', type: 'color', defaultValue: '#dddddd' },
                { name: 'grid.backgroundColor', label: 'Hintergrund', type: 'color', defaultValue: '#ffffff' },
                { name: 'backgroundImage', label: 'Hintergrundbild', type: 'image_picker', defaultValue: '' },
            ]
        });

        // ── SPLASH (nur bei splash-Stages) ─────────────────────
        if (stage.type === 'splash') {
            sections.push({
                id: 'splash',
                label: 'Splash Screen',
                icon: '🖼️',
                properties: [
                    { name: 'duration', label: 'Dauer (ms)', type: 'number', defaultValue: 3000 },
                    { name: 'autoHide', label: 'Auto-Weiter', type: 'boolean', defaultValue: true },
                ]
            });
        }

        // ── ANIMATION ──────────────────────────────────────────
        sections.push({
            id: 'animation',
            label: 'Animation',
            icon: '🎬',
            properties: [
                {
                    name: 'startAnimation', label: 'Start', type: 'select',
                    options: ['none', 'UpLeft', 'UpMiddle', 'UpRight', 'Left', 'Right',
                        'BottomLeft', 'BottomMiddle', 'BottomRight', 'ChaosIn', 'ChaosOut', 'Matrix', 'Random'],
                    defaultValue: 'none'
                },
                { name: 'startAnimationDuration', label: 'Dauer (ms)', type: 'number', inline: true, defaultValue: 1000 },
                {
                    name: 'startAnimationEasing', label: 'Easing', type: 'select', inline: true,
                    options: ['linear', 'easeIn', 'easeOut', 'easeInOut', 'bounce', 'elastic'],
                    defaultValue: 'easeOut'
                },
            ]
        });

        return sections;
    }

    handlePropertyChange(event: PropertyChangeEvent, _project: GameProject, _runtime: ReactiveRuntime): boolean {
        let { propertyName, newValue, object } = event;

        // META-FELDER: gameName, author, description → project.meta umleiten
        if (propertyName === 'gameName' && _project?.meta) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: _project.meta, path: 'name', value: newValue });
            return true;
        }
        if (propertyName === 'author' && _project?.meta) {
            projectStore.dispatch({ type: 'SET_PROPERTY', target: _project.meta, path: 'author', value: newValue });
            return true;
        }
        if (propertyName === 'description') {
            // description kann Stage-Beschreibung oder Meta-Beschreibung sein
            // Bei main-Stage: auch in meta.description schreiben
            if (object?.type === 'main' && _project?.meta) {
                projectStore.dispatch({ type: 'SET_PROPERTY', target: _project.meta, path: 'description', value: newValue });
            } else {
                projectStore.dispatch({ type: 'SET_PROPERTY', target: object, path: propertyName, value: newValue });
            }
            return true;
        }

        // FIX: Strip 'activeStage.' prefix if present (template artifact)
        if (propertyName.startsWith('activeStage.')) {
            propertyName = propertyName.replace('activeStage.', '');
            event.propertyName = propertyName; // Update event for subsequent logic

            projectStore.dispatch({ type: 'SET_PROPERTY', target: object, path: propertyName, value: newValue });
            return true;
        }

        // Handle event changes specially if they are prefixed with 'on'
        if (propertyName.startsWith('on')) {
            projectStore.dispatch({
                type: 'BATCH',
                label: `Update Event ${propertyName}`,
                mutations: [
                    { type: 'SET_PROPERTY', target: object, path: `events.${propertyName}`, value: newValue },
                    { type: 'SET_PROPERTY', target: object, path: `Tasks.${propertyName}`, value: newValue }
                ]
            });

            return true;
        }

        return false;
    }
}
