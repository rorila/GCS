import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Liefert nur serverseitig die Elternsicht — Kindbezug wird je Aufruf gegen bestätigte Zuordnungen geprüft. */
export class TServerParentAccount extends TServerDesignComponent {
 public readMessage='';
 public failureMessage='';
 public parentPolicy='Nur bestätigte Eltern-Kind-Zuordnungen; Budget-Lockerungen brauchen Zweitbestätigung';
 constructor(name='Elternbereich',x=0,y=0){super(name,x,y);this.className='TServerParentAccount';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'parentPolicy',label:'Verbindliche Elternsicht-Regel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerParentAccount',data=>new TServerParentAccount(data.name,data.x,data.y));
