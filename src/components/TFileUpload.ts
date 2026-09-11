import {TWindow} from './TWindow';
import {TPropertyDef,IRuntimeComponent} from './TComponent';
import {ComponentRegistry} from '../utils/ComponentRegistry';
import {browserUploadAdapter} from '../adapters/BrowserUploadAdapter';
export class TFileUpload extends TWindow implements IRuntimeComponent {
 public className='TFileUpload';public picker='Dateiauswahl';public endpoint='/api/cms/upload/game';public progress=0;public busy=false;public message='';public result:any={};
 private objects:any[]=[];private emit=(event:string)=>{};private cancelOperation:(()=>void)|null=null;private stopped=false;
 constructor(name='DateiUpload',x=0,y=0){super(name,x,y,5,2);this.isService=true;this.isHiddenInRun=true;}
 public initRuntime(c:any){this.objects=c.objects;this.emit=e=>c.handleEvent(this.id,e);this.stopped=false;this.busy=false;this.progress=0;this.result={};this.message=''}
 public async start(title='',description='',token=''){
  if(this.busy)return;const file=this.objects.find(o=>o.name===this.picker)?.getFile?.();if(!file){this.message='Zuerst eine Datei auswählen.';this.emit('onError');return}
  this.busy=true;this.progress=0;this.result={};const controller=new AbortController();this.cancelOperation=()=>controller.abort();this.message='Datei wird übertragen.';this.emit('onStarted');
  try{const result=await browserUploadAdapter.send(this.endpoint,file,{title,description},token,value=>{if(!this.stopped){this.progress=value;this.emit('onProgress')}},controller.signal);if(this.stopped)return;this.result=result;this.message=result.message;this.busy=false;this.emit('onSuccess')}
  catch(error){if(this.stopped)return;this.message=String((error as Error).message);this.busy=false;this.emit(controller.signal.aborted?'onCancel':'onError')}
  finally{this.busy=false}
 }
 public cancel(){this.cancelOperation?.()}
 public onRuntimeStop(){this.stopped=true;this.cancel()}
 public getEvents(){return ['onStarted','onProgress','onSuccess','onError','onCancel']}
 public getInspectorProperties():TPropertyDef[]{return [...super.getInspectorProperties(),{name:'picker',label:'Dateiauswahl-Komponente',type:'string',group:'UPLOAD'},{name:'endpoint',label:'CMS-Endpunkt',type:'string',group:'UPLOAD'},...['progress','busy','message','result'].map(name=>({name,label:name,type:'string' as const,readonly:true,group:'STATUS'}))]}
}
ComponentRegistry.register('TFileUpload',d=>new TFileUpload(d.name,d.x,d.y));
