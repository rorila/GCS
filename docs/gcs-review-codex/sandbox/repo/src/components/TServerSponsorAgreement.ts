import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Belohnungsvereinbarungen: versioniert, unveränderlich nach Veröffentlichung; wirksam erst bei Zustimmung aller erforderlichen Eltern UND des Sponsors; Änderungen erzeugen neue Versionen — die bisherige Fassung gilt bis zur Freigabe weiter. */
export class TServerSponsorAgreement extends TServerDesignComponent {
 public agreementPolicy='Zustimmung bindet an konkrete Version; Quorum = alle zustimmungspflichtigen Eltern + Sponsor; veröffentlichte Versionen sind unveränderlich; erreichte Ansprüche bleiben bei Versionswechsel erhalten.';
 constructor(name='Vereinbarungen',x=0,y=0){super(name,x,y);this.className='TServerSponsorAgreement';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'agreementPolicy',label:'Verbindliche Vereinbarungsregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerSponsorAgreement',data=>new TServerSponsorAgreement(data.name,data.x,data.y));
