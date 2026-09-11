import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Erstellt nur nach erfolgreicher serverseitiger Prüfung eine Verwaltungssitzung. */
export class TServerSession extends TServerDesignComponent {
 public sessionPolicy='HttpOnly; SameSite=Strict; 30 Minuten';
 constructor(name='VerwaltungssitzungErstellen',x=0,y=0){super(name,x,y);this.className='TServerSession';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'sessionPolicy',label:'Verbindlicher Sitzungsschutz',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerSession',data=>new TServerSession(data.name,data.x,data.y));
