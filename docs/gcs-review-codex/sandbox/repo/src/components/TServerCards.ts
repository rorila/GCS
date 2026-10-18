import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Verwaltet nur serverseitig persönliche Karteikästen (Leitner) — Besitzer-, Ersteller- und Ablageregeln werden hier erzwungen. */
export class TServerCards extends TServerDesignComponent {
 public cardPolicy='Nur eigener Kasten (Kind) oder bestätigt zugeordnete Kinder (Eltern); Kinder ändern nur selbst angelegte Karten; Bewertung nur durch den Kastenbesitzer';
 constructor(name='Karten',x=0,y=0){super(name,x,y);this.className='TServerCards';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'cardPolicy',label:'Verbindliche Kartenregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerCards',data=>new TServerCards(data.name,data.x,data.y));
