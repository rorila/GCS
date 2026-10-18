import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Verwaltet nur serverseitig Multiplayer-Partien — Mitgliedschaft, Versionsbindung und Aktionslimit werden hier erzwungen. */
export class TServerParty extends TServerDesignComponent {
 public maxActionsPerMinute=60;
 public partyPolicy='Nur Mitglieder desselben Raums; Beitritt nur zur aktuellen Spielversion; Aktionen werden ratenbegrenzt';
 constructor(name='Partien',x=0,y=0){super(name,x,y);this.className='TServerParty';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'maxActionsPerMinute',label:'Aktionslimit pro Minute',type:'number',readonly:true,group:'SERVER / PARTIE'},{name:'partyPolicy',label:'Verbindliche Partieregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerParty',data=>new TServerParty(data.name,data.x,data.y));
