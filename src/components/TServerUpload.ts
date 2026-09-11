import {TServerDesignComponent} from '../server/ServerDesignComponent';import {TPropertyDef} from './TComponent';import {ComponentRegistry} from '../utils/ComponentRegistry';
export class TServerUpload extends TServerDesignComponent {
 public kind='game';public maxBytes=10485760;public successMessage='✓ Upload gespeichert';public failureMessage='Die Datei entspricht nicht dem erlaubten Format.';
 constructor(name='UploadPruefenUndSpeichern',x=0,y=0){super(name,x,y);this.className='TServerUpload'}
 public getEvents(){return ['onRequest']}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'kind',label:'Dateiverwendung',type:'select',options:['game','avatar'],group:'SERVER / PRÜFUNG'},{name:'maxBytes',label:'Maximale Bytes',type:'number',group:'SERVER / PRÜFUNG'},{name:'successMessage',label:'Erfolgsmeldung',type:'string',group:'SERVER / RÜCKMELDUNG'},{name:'failureMessage',label:'Formatfehler',type:'string',group:'SERVER / RÜCKMELDUNG'}]}
}
ComponentRegistry.register('TServerUpload',d=>new TServerUpload(d.name,d.x,d.y));
