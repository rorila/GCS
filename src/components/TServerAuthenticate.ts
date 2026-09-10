import {TServerDesignComponent as TServerComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
export class TServerAuthenticate extends TServerComponent {
 public authenticationMode='Emoji-Spielerprofil';public permissionBoundary='Keine Verwaltungsrechte durch Emoji-Anmeldung';public failureMessage='🤔 Noch einmal versuchen';
 constructor(name='SpielerAuthentifizieren',x=0,y=0){super(name,x,y);this.className='TServerAuthenticate';}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),
  {name:'authenticationMode',label:'Anmeldeverfahren',type:'string',readonly:true,group:'SERVER / SICHERHEIT'},
  {name:'permissionBoundary',label:'Berechtigungsgrenze',type:'string',readonly:true,group:'SERVER / SICHERHEIT'},
  {name:'failureMessage',label:'Hinweis bei abgelehnter Anmeldung',type:'string',group:'SERVER / RÜCKMELDUNG'},
 ];}
}

ComponentRegistry.register('TServerAuthenticate',(data:any)=>new TServerAuthenticate(data.name,data.x,data.y));
