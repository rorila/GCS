import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Verwaltet nur serverseitig Kartenstapel (cardDecks) — Zuordnung an Kinder, Erwachsenen-Freigabe für Kind-Stapel und Kopier-Übernahme werden hier erzwungen. */
export class TServerDecks extends TServerDesignComponent {
 public deckPolicy='Stapel sind Kindern zugeordnet (nicht Räumen); Kind-Stapel erscheinen erst nach Erwachsenen-Freigabe; Übernahme kopiert Karten in den Kasten (Dedup über sourceCardId)';
 constructor(name='Stapel',x=0,y=0){super(name,x,y);this.className='TServerDecks';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'deckPolicy',label:'Verbindliche Stapelregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerDecks',data=>new TServerDecks(data.name,data.x,data.y));
