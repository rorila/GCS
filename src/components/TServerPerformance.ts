import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Geprüfte Leistungspunkte: nur performanceLedger-Einträge zählen für Belohnungen — serverseitig verifiziert (Regelversion deckt Spiel+Metrik+Wertebereich) oder von Eltern anerkannt (guardian-confirmed); Rohmeldungen aus progress erzeugen nie automatisch Ansprüche; append-only mit Gegenbuchungen. */
export class TServerPerformance extends TServerDesignComponent {
 public performancePolicy='Nur geprüfte Ledger-Einträge zählen; Regelversionen begrenzen Metrik, Einheit und Wertebereich; Dedup über fachlichen Ereignisschlüssel; Sponsor kann keine Leistungen melden oder verändern; append-only, Korrekturen als reversalOf.';
 constructor(name='Leistungspunkte',x=0,y=0){super(name,x,y);this.className='TServerPerformance';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'performancePolicy',label:'Verbindliche Leistungsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerPerformance',data=>new TServerPerformance(data.name,data.x,data.y));
