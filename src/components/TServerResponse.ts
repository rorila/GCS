import {TServerDesignComponent as TServerComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
export class TServerResponse extends TServerComponent {
 public successMessage='✓';public responseFormat='JSON';public secretPolicy='Passwörter, Emoji-Code, Cookies und Tokens maskieren';
 constructor(name='AnmeldeantwortSenden',x=0,y=0){super(name,x,y);this.className='TServerResponse';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),
  {name:'successMessage',label:'Erfolgsmeldung',type:'string',group:'SERVER / RÜCKMELDUNG'},
  {name:'responseFormat',label:'Antwortformat',type:'string',readonly:true,group:'SERVER / RESPONSE'},
  {name:'secretPolicy',label:'Schutz im Debug-Protokoll',type:'string',readonly:true,group:'SERVER / DIAGNOSE'},
 ];}
}

ComponentRegistry.register('TServerResponse',(data:any)=>new TServerResponse(data.name,data.x,data.y));
