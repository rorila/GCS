import {TWindow} from './TWindow';
import {TPropertyDef,IRuntimeComponent} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
import {browserUploadAdapter} from '../adapters/BrowserUploadAdapter';
const selectedFiles=new WeakMap<object,File>();
export class TFilePicker extends TWindow implements IRuntimeComponent {
 public className='TFilePicker';public accept='.json';public maxBytes=10485760;public filename='';public size=0;public message='';
 private cancelPicker:(()=>void)|null=null;private emit=(event:string)=>{};
 constructor(name='Dateiauswahl',x=0,y=0){super(name,x,y,5,2);this.isService=true;this.isHiddenInRun=true;}
 public initRuntime(c:any){this.filename='';this.size=0;this.message='';selectedFiles.delete(this);this.emit=e=>c.handleEvent(this.id,e)}
 public choose(){this.cancelPicker?.();selectedFiles.delete(this);this.filename='';this.size=0;this.cancelPicker=browserUploadAdapter.choose(this.accept,file=>{if(!file){this.emit('onCancel');return}if(file.size>this.maxBytes){this.message='Datei ist zu groß.';this.emit('onError');return}selectedFiles.set(this,file);this.filename=file.name;this.size=file.size;this.message='Datei ausgewählt.';this.emit('onSelected')})}
 public getFile(){return selectedFiles.get(this)||null}
 public onRuntimeStop(){this.cancelPicker?.();selectedFiles.delete(this);this.filename='';this.size=0}
 public getEvents(){return ['onSelected','onCancel','onError']}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'accept',label:'Dateitypen',type:'string',group:'DATEIAUSWAHL'},{name:'maxBytes',label:'Maximale Bytes',type:'number',group:'DATEIAUSWAHL'},...['filename','size','message'].map(name=>({name,label:name,type:'string' as const,readonly:true,group:'STATUS'}))]}
}
ComponentRegistry.register('TFilePicker',d=>new TFilePicker(d.name,d.x,d.y));
