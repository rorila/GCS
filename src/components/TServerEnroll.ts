import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Löst nur serverseitig Einladungstickets ein — Zugangsdaten werden als scrypt-Hash gespeichert. */
export class TServerEnroll extends TServerDesignComponent {
 public kind='parent';
 public enrollPolicy='Einladung nur einmal einlösbar; Ticket wird als Hash geprüft; Klartext-Ticket wird nie gespeichert';
 constructor(name='Einrichtung',x=0,y=0){super(name,x,y);this.className='TServerEnroll';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'kind',label:'Einrichtungsart (parent|observer|admin)',type:'string',readonly:true,group:'SERVER / SICHERHEIT'},{name:'enrollPolicy',label:'Verbindliche Einrichtungsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerEnroll',data=>new TServerEnroll(data.name,data.x,data.y));
