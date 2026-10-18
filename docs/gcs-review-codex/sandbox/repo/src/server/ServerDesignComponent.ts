import {TWindow} from '../components/TWindow';
import {TPropertyDef} from '../components/TComponent';
export abstract class TServerDesignComponent extends TWindow {
 public executionSide='server';
 constructor(name:string,x=0,y=0){super(name,x,y,12,3);this.isService=true;this.isHiddenInRun=true;this.scope='global';this.style.backgroundColor='#193d50';this.style.color='#d9f7ff';}
 public execute():never{throw Error('Server-Komponente: Ausführung ausschließlich im CMS-Server.');}
 public getInspectorProperties():TPropertyDef[]{return [
  {name:'name',label:'Komponentenname',type:'string',group:'IDENTITÄT'},
  {name:'executionSide',label:'Ausführung',type:'string',readonly:true,group:'SERVER / BETRIEB'},
 ];}
 public getEvents():string[]{return [];}
 public toDTO():any{return {...super.toDTO(),x:this.x,y:this.y,width:this.width,height:this.height,executionSide:'server'};}
}
