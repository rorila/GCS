import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Führt nur serverseitig deklarative Abfragen gegen den CMS-Datenbestand aus (Spec liegt in den Action-Params). */
export class TServerQuery extends TServerDesignComponent {
 public queryPolicy='Nur registrierte Entitäten; Berechtigung wird vorgeschaltet (TServerSession)';
 constructor(name='Datenbestand',x=0,y=0){super(name,x,y);this.className='TServerQuery';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'queryPolicy',label:'Verbindliche Abfrageregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerQuery',data=>new TServerQuery(data.name,data.x,data.y));
