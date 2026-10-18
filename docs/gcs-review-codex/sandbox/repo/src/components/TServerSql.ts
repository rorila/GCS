import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
/** Führt serverseitig eine lesende Rohe-SQL-Abfrage auf dem SQLite-Bestand aus (readOnly-Verbindung, Zeilenlimit). */
export class TServerSql extends TServerDesignComponent {
 public queryPolicy='Nur lesende Anweisungen (SELECT/WITH/EXPLAIN); Engine-Readonly erzwingt den Schreibschutz; Ergebnis auf 500 Zeilen begrenzt. Berechtigung wird vorgeschaltet (TServerSession).';
 constructor(name='SqlDatenbank',x=0,y=0){super(name,x,y);this.className='TServerSql';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'queryPolicy',label:'Verbindliche Abfrageregel',type:'string',readonly:true,group:'SERVER / SICHERHEIT'}];}
}
ComponentRegistry.register('TServerSql',data=>new TServerSql(data.name,data.x,data.y));
