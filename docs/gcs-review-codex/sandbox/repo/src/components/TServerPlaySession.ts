import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Führt nur serverseitig Spielsitzungen — Zeitbuchung, Zeitbudget und Einzelsitzungsregel liegen ausschließlich hier. */
export class TServerPlaySession extends TServerDesignComponent {
 public heartbeatMs=30000;
 public disconnectGraceMs=120000;
 public graceMinutes=2;
 public playPolicy='Einzelsitzung je Kind; Zeitbudget serverseitig gebucht; Warnung und Grace-Zeit sind verbindlich';
 constructor(name='SpielStart',x=0,y=0){super(name,x,y);this.className='TServerPlaySession';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'heartbeatMs',label:'Heartbeat-Intervall (ms)',type:'number',readonly:true,group:'SERVER / SITZUNG'},{name:'disconnectGraceMs',label:'Trennungs-Grace (ms)',type:'number',readonly:true,group:'SERVER / SITZUNG'},{name:'graceMinutes',label:'Budget-Nachlauf (min)',type:'number',readonly:true,group:'SERVER / SITZUNG'},{name:'playPolicy',label:'Verbindliche Sitzungsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerPlaySession',data=>new TServerPlaySession(data.name,data.x,data.y));
