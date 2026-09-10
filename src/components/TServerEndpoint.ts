import {TServerDesignComponent as TServerComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
export class TServerEndpoint extends TServerComponent {
 public endpointPath='/api/cms/login';public httpMethod='POST';public traceEnabled=true;
 constructor(name='AnmeldungEmpfangen',x=0,y=0){super(name,x,y);this.className='TServerEndpoint';}
 public getEvents(){return ['onRequest'];}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),
  {name:'endpointPath',label:'Anfragepfad (Anmelde-Pilot)',type:'string',readonly:true,group:'SERVER / REQUEST'},
  {name:'httpMethod',label:'HTTP-Methode',type:'string',readonly:true,group:'SERVER / REQUEST'},
  {name:'traceEnabled',label:'Diagnose bei Debug-Anfragen erfassen',type:'boolean',group:'SERVER / DIAGNOSE'},
 ];}
}

ComponentRegistry.register('TServerEndpoint',(data:any)=>new TServerEndpoint(data.name,data.x,data.y));
