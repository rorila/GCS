import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Belohnungsansprüche: genau ein Anspruch je Vereinbarung (entitlementKey eindeutig); Zustände earned→requested→released→fulfilled bzw. cancelled; Einlösung nur nach elterlicher Freigabe; Erfüllung erst nach Sponsormeldung + elterlicher Bestätigung; optionales Punktekonto mit Reserve/Verbrauch. */
export class TServerReward extends TServerDesignComponent {
 public rewardPolicy='Keine doppelte Vergabe (entitlementKey); Einlösung nur nach Eltern-Freigabe; Erfüllung erst nach Sponsormeldung + Eltern-Bestätigung; Ansprüche überleben Pause, Versionswechsel und Beendigung; keine Zahlungsabwicklung.';
 constructor(name='Belohnungen',x=0,y=0){super(name,x,y);this.className='TServerReward';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'rewardPolicy',label:'Verbindliche Belohnungsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerReward',data=>new TServerReward(data.name,data.x,data.y));
