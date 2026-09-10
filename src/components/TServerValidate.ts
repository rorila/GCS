import {TServerDesignComponent as TServerComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
export class TServerValidate extends TServerComponent {
 public validationRule='Haus-ID und genau vier Emoji-Schlüssel';public failureMessage='Bitte Haus und vier Bilder angeben.';
 constructor(name='AnmeldedatenPruefen',x=0,y=0){super(name,x,y);this.className='TServerValidate';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),
  {name:'validationRule',label:'Verbindliche Eingaberegel',type:'string',readonly:true,group:'SERVER / PRÜFUNG'},
  {name:'failureMessage',label:'Hinweis bei ungültiger Eingabe',type:'string',group:'SERVER / RÜCKMELDUNG'},
 ];}
}

ComponentRegistry.register('TServerValidate',(data:any)=>new TServerValidate(data.name,data.x,data.y));
