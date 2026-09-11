import {TServerDesignComponent} from '../server/ServerDesignComponent';
import {TPropertyDef} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
export class TServerProfile extends TServerDesignComponent {
 public readMessage='👤 Das ist dein Bereich';public savedMessage='✓ Gespeichert';public helpMessage='🆘 Deine Verwaltung sieht deine Bitte um Zugangshilfe.';public failureMessage='Bitte einen Namen und ein gültiges Avatarbild wählen.';
 public avatars=['🦊','🦉','🐶','🐱','🐼','🐸','🦁','🐰'];
 constructor(name='EigenesProfil',x=0,y=0){super(name,x,y);this.className='TServerProfile';}
 public getEvents(){return ['onRead','onSave','onHelp'];}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),...['readMessage','savedMessage','helpMessage','failureMessage'].map((name,i)=>({name,label:['Profilhinweis','Speicherbestätigung','Hilfebestätigung','Eingabefehler'][i],type:'string' as const,group:'SERVER / RÜCKMELDUNG'})),{name:'avatars',label:'Erlaubte Avatar-Emojis',type:'json',group:'SERVER / PRÜFUNG'}];}
}
ComponentRegistry.register('TServerProfile',data=>new TServerProfile(data.name,data.x,data.y));
