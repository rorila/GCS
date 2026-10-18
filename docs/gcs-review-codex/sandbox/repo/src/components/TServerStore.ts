import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Schreibt nur serverseitig in den CMS-Datenbestand — jede Änderung läuft über den Audit-Commit. */
export class TServerStore extends TServerDesignComponent {
 public storePolicy='Schreibzugriffe nur per Audit-Commit (Akteur, Aktion, Bereich werden protokolliert)';
 constructor(name='DatenSpeicher',x=0,y=0){super(name,x,y);this.className='TServerStore';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'storePolicy',label:'Verbindliche Schreibregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerStore',data=>new TServerStore(data.name,data.x,data.y));
