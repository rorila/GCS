import {AgentController} from '../../src/services/AgentController';
import {coreStore} from '../../src/services/registry/CoreStore';
import {AIValidator} from '../../src/ai/validation/AIValidator';
import type {GameProject} from '../../src/model/types';
import type {AgentScript} from '../../src/services/agent/AgentScriptTypes';

export function buildInterfaceProbe(){
 const project={meta:{id:'math-interface-probe',name:'Mathe · Schnittstellenprobe',author:'GCS',version:'0.1.0',description:'Isolierte technische Probe für Phase 1, keine Lernfortschritt-Buchung.'},stage:{grid:{cols:64,rows:40,cellSize:18}},objects:[],variables:[],actions:[],tasks:[],stages:[{id:'stage_blueprint',name:'Blueprint',type:'blueprint',objects:[],variables:[],tasks:[],actions:[],flowCharts:{}}],activeStageId:'stage_math_probe'} as unknown as GameProject;
 const baseline=JSON.parse(JSON.stringify(project)),agent=AgentController.getInstance(),previous=agent.getProject(),previousCore=coreStore.project,previousStage=coreStore.activeStageId;
 const script:AgentScript={version:'1.0',name:'Mathe-Schnittstellenprobe',operations:[]};
 const call=(method:string,...params:any[])=>{script.operations.push({method,params:JSON.parse(JSON.stringify(params))});return (agent as any)[method](...params);};
 const stage='stage_math_probe';
 try{
  coreStore.setProject(project);agent.setProject(project);
  call('createStage',stage,'Mathematik · Schnittstellenprobe','standard',{grid:{cols:64,rows:40,cellSize:18,visible:false,backgroundColor:'#0c1b26'},startAnimation:'none'});
  call('addVariable','MathProbeCount','integer',0,'global');
  call('addVariable','MathProbeResult','integer',0,'global');
  const object=(name:string,className:string,x:number,y:number,width:number,height:number,text:string)=>call('addObject',stage,{id:'math_probe_'+name,name,className,scope:'stage',x,y,width,height,visible:true,zIndex:1,style:{color:'#eefafa',backgroundColor:className==='TButton'?'#285984':'transparent',fontSize:24,fontFamily:'Segoe UI, sans-serif',textAlign:'center',borderRadius:12},text});
  object('ProbeTitle','TLabel',4,2,56,3,'Mathematik · Technischer Schnittstellentest');
  object('ProbeQuestion','TLabel',14,8,36,4,'27 + 8 = ?');
  object('ProbeWrongA','TButton',6,15,16,5,'🎈 34');
  object('ProbeCorrect','TButton',24,15,16,5,'🎈 35');
  object('ProbeWrongB','TButton',42,15,16,5,'🎈 25');
  object('ProbeFeedback','TLabel',4,24,56,4,'Wähle eine Antwort.');
  object('ProbeCount','TLabel',4,30,56,2,'');
  object('ProbeReset','TButton',22,34,20,3,'Zurücksetzen');
  call('bindVariable',stage,'ProbeCount','text','${MathProbeCount}');
  call('setProperty',stage,'ProbeQuestion','style.fontSize',40);
  call('createTask',stage,'MathProbe_Count');
  call('addAction','MathProbe_Count','calculate','MathProbe_CountPlus',{formula:'MathProbeCount + 1',resultVariable:'MathProbeCount'});
  call('createTask',stage,'MathProbe_Right');
  call('addTaskCall','MathProbe_Right','MathProbe_Count');
  call('addAction','MathProbe_Right','calculate','MathProbe_Calculate',{formula:'27 + 8',resultVariable:'MathProbeResult'});
  call('addAction','MathProbe_Right','property','MathProbe_ShowRight',{changes:{'ProbeFeedback.text':'Richtig: 27 + 8 = ${MathProbeResult}.'}});
  call('createTask',stage,'MathProbe_Wrong');
  call('addTaskCall','MathProbe_Wrong','MathProbe_Count');
  call('addAction','MathProbe_Wrong','property','MathProbe_ShowHint',{changes:{'ProbeFeedback.text':'Tipp: 27 + 3 = 30. Danach fehlen noch 5.'}});
  call('createTask',stage,'MathProbe_Reset');
  call('addAction','MathProbe_Reset','property','MathProbe_Clear',{changes:{MathProbeCount:0,MathProbeResult:0,'ProbeFeedback.text':'Wähle eine Antwort.'}});
  call('createTask',stage,'MathProbe_EventParam');
  call('addTaskParam','MathProbe_EventParam','probeText','string','Parameter-Standardwert');
  call('addAction','MathProbe_EventParam','property','MathProbe_ShowParam',{changes:{'ProbeFeedback.text':'${probeText}'}});
  for(const [object,task]of [['ProbeCorrect','MathProbe_Right'],['ProbeWrongA','MathProbe_Wrong'],['ProbeWrongB','MathProbe_Wrong'],['ProbeReset','MathProbe_Reset']])call('connectEvent',stage,object,'onClick',task);
  const aiValidation=new AIValidator(baseline).validate(script);
  const projectIssues=agent.validate();
  return {project,baseline,script,aiValidation,projectIssues};
 }finally{agent.setProject(previous as GameProject);coreStore.project=previousCore;coreStore.activeStageId=previousStage;}
}
