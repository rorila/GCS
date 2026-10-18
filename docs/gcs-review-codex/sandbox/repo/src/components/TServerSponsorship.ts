import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Sponsor-Kind-Begleitungen: Anfrage über elterliche Kontakt-Fähigkeit, Quorum-Zustimmung aller Eltern, Pausieren/Beenden, Sichtfreigabe-Versionen und Familienhistorie — jede Methode prüft Beziehung, Zustand und Rechte erneut. */
export class TServerSponsorship extends TServerDesignComponent {
 public sponsorshipPolicy='Zugriff nur aus konkreter genehmigter Beziehung (Zustand aktiv + wirksame Sichtfreigabe + Laufzeit); Kinder dürfen ablehnen/pausieren; Ende entzieht den Zugriff sofort; Eltern sehen alles.';
 constructor(name='Begleitungen',x=0,y=0){super(name,x,y);this.className='TServerSponsorship';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'sponsorshipPolicy',label:'Verbindliche Begleitungsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerSponsorship',data=>new TServerSponsorship(data.name,data.x,data.y));
