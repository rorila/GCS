import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Verwaltet nur serverseitig Zugänge und Einladungen — Token werden ausschließlich als Hash gespeichert. */
export class TServerAccess extends TServerDesignComponent {
 public accessPolicy='Einladungstoken nur als Hash persistieren; Klartext verlässt den Server nie dauerhaft';
 constructor(name='Zugangsverwaltung',x=0,y=0){super(name,x,y);this.className='TServerAccess';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'accessPolicy',label:'Verbindliche Zugangsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerAccess',data=>new TServerAccess(data.name,data.x,data.y));
