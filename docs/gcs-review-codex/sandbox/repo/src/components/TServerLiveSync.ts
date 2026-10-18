import { TServerDesignComponent } from '../server/ServerDesignComponent';
import { TPropertyDef } from './TComponent';
import { ComponentRegistry } from '../utils/ComponentRegistry';

export class TServerLiveSync extends TServerDesignComponent {
    public endpointPath = '/api/cms/party/live';
    public maxPayloadBytes = 4096;
    public maxMessagesPerSecond = 30;
    public inputTtlMs = 750;
    public maxStateAgeMs = 2000;
    public livePolicy = 'Nur Partienmitglieder; nur der Host schreibt Spielstand; Nicht-Hosts schreiben nur Eingaben; Live-Daten bleiben flüchtig';

    constructor(name = 'LiveSync', x = 0, y = 0) {
        super(name, x, y);
        this.className = 'TServerLiveSync';
    }

    public getInspectorProperties(): TPropertyDef[] {
        return [
            ...super.getInspectorProperties(),
            { name: 'endpointPath', label: 'Live-Endpunkt', type: 'string', readonly: true, group: 'SERVER / LIVE-SYNC' },
            { name: 'maxPayloadBytes', label: 'Payload-Limit (Bytes)', type: 'number', readonly: true, group: 'SERVER / LIVE-SYNC' },
            { name: 'maxMessagesPerSecond', label: 'Nachrichten/Sekunde', type: 'number', readonly: true, group: 'SERVER / LIVE-SYNC' },
            { name: 'inputTtlMs', label: 'Eingabe-Gültigkeit (ms)', type: 'number', readonly: true, group: 'SERVER / LIVE-SYNC' },
            { name: 'maxStateAgeMs', label: 'State-Alter (ms)', type: 'number', readonly: true, group: 'SERVER / LIVE-SYNC' },
            { name: 'livePolicy', label: 'Verbindliche Sync-Regel', type: 'string', readonly: true, group: 'SERVER / SICHERHEIT' }
        ];
    }
}

ComponentRegistry.register('TServerLiveSync', data => new TServerLiveSync(data.name, data.x, data.y));
