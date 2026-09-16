import { prepareImagePieces } from '../../utils/ImageSplitterModel';
import { GameProject } from '../../model/types';
import { projectStore } from '../../services/ProjectStore';
import { ConfirmDialog } from '../ui/ConfirmDialog';
import { NotificationToast } from '../ui/NotificationToast';

const pending = new WeakSet<object>();

export async function generateImageSplitterPieces(obj: any, project: GameProject): Promise<void> {
    if (pending.has(obj)) return;
    pending.add(obj);
    try {
        const stages = project.stages?.filter(s => s.type === 'blueprint' || s.id === project.activeStageId) || [];
        const flatten = (objects: any[]): any[] => objects.flatMap(o => [o, ...flatten(o.children || [])]);
        const objects = flatten(stages.flatMap(s => [...(s.objects || []), ...(s.variables || [])]));
        const source = objects.find(o => o.id === obj.id && o.className === 'TImageSplitter');
        if (!source) throw new Error('Der Bildaufteiler ist nicht auf der aktiven Stage verfügbar.');
        const target = objects.find(o => o.className === 'TObjectList' && (o.id === source.outputList || o.name === source.outputList));
        if (!target) throw new Error('Bitte eine TObjectList auf dieser Stage oder der Blueprint-Stage als Ausgabeliste auswählen.');
        const config = { id: source.id, imageSource: source.imageSource, rows: source.rows, columns: source.columns };
        const outputList = source.outputList;
        const stageId = project.activeStageId;
        const oldRecords = JSON.stringify(target.records || []);
        if ((target.records?.length || target.items?.length) && !await ConfirmDialog.show(`Die Ausgabeliste "${target.name}" enthält bereits Daten. Durch die neu erzeugten Bildteile ersetzen?`)) return;
        const pieces = await prepareImagePieces(config);
        if (projectStore.getProject() !== project || stageId !== project.activeStageId || outputList !== source.outputList || config.imageSource !== source.imageSource || config.rows !== source.rows || config.columns !== source.columns || JSON.stringify(target.records || []) !== oldRecords) {
            throw new Error('Projekt, Konfiguration oder Ausgabeliste wurde inzwischen geändert. Bitte erneut erzeugen.');
        }
        const success = projectStore.dispatch({
            type: 'BATCH', label: 'Bildteile erzeugen', mutations: [
                { type: 'SET_PROPERTY', target, path: 'recordKey', value: 'id' },
                { type: 'SET_PROPERTY', target, path: 'sourceMode', value: 'records' },
                { type: 'SET_PROPERTY', target, path: 'records', value: pieces }
            ]
        });
        if (!success) throw new Error('Die Bildteile konnten nicht in das Projekt übernommen werden.');
        target.rebuildData?.();
        NotificationToast.show(`${pieces.length} Bildteile in "${target.name}" erzeugt.`, 'success');
    } catch (error) {
        NotificationToast.show(error instanceof Error ? error.message : String(error), 'error');
    } finally {
        pending.delete(obj);
    }
}
