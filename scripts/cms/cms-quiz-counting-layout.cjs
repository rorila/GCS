// Counting cards also remain usable in the existing paper-card quiz.
const fs=require('node:fs'),path=require('node:path'),{assets}=require('./cms-task-presentation.cjs');
function apply(p){
 const s=p.stages.find(s=>s.id==='stage_quiz'),card=s?.objects.find(o=>o.name==='QuizKarte');if(!card)return p;
 const up=(list,name,data)=>{const old=list.find(o=>o.name===name);if(old)Object.assign(old,data);else list.push({id:'quiz_count_'+name,name,scope:'stage',...data});};
 const A=name=>({type:'action',name}),T=name=>({type:'task',name}),C=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
 const prop=(name,changes)=>up(s.actions,name,{type:'property',changes});
 const hidden={},show=[];card.children||=[];
 for(const [id,asset]of Object.entries(assets)){
  const src='data:'+(asset.src.endsWith('.svg')?'image/svg+xml':'image/png')+';base64,'+fs.readFileSync(path.resolve(__dirname,'../../public',asset.src)).toString('base64'),steps=[];
  for(let i=0;i<10;i++){
   const name='QuizCount_'+id+'_'+i;hidden[name+'.visible']=false;
   up(card.children,name,{className:'TSprite',x:3+(i%5)*7,y:8+Math.floor(i/5)*5.5,width:6,height:5,visible:false,zIndex:3,backgroundImage:src,appearanceMode:'simple',spriteColor:'transparent',shape:'rect',objectFit:'contain',collisionEnabled:false});
   prop('Show_'+name,{[name+'.visible']:true});steps.push(C('AktuelleKarte.presentation.count',i,[A('Show_'+name)],[],'>'));
  }
  show.push(C('AktuelleKarte.presentation.assetId',id,steps));
 }
 prop('QuizCount_Hide',hidden);prop('QuizCount_Normal',{'FrageLabel.height':14,'FrageLabel.style.fontSize':38});prop('QuizCount_Question',{'FrageLabel.height':3,'FrageLabel.style.fontSize':24});
 up(s.tasks,'QuizCount_Sync',{triggerMode:'local-sync',params:[],actionSequence:[A('QuizCount_Hide'),A('QuizCount_Normal'),C('AktuelleKarte.taskType','count-images',[A('QuizCount_Question'),...show])]});
 const hook=list=>{for(let i=0;i<(list||[]).length;i++){const step=list[i];if(step.name==='Act_Karte_Uebernehmen'&&list[i+1]?.name!=='QuizCount_Sync')list.splice(++i,0,T('QuizCount_Sync'));for(const key of ['body','elseBody'])hook(step[key]);}};hook(s.tasks.find(t=>t.name==='Karte_Ziehen').actionSequence);
 for(const name of ['Act_Loesung_Anzeigen','Act_Kartenrueckseite','Act_Quiz_Stop','Act_Ziehen_Start']){const a=s.actions.find(a=>a.name===name);if(a)Object.assign(a.changes,hidden);}
 return p;
}
module.exports={apply};
if(require.main===module){const file=path.resolve(__dirname,'../../game-server/public/projects/Karteikasten-Quiz.json');fs.writeFileSync(file,JSON.stringify(apply(JSON.parse(fs.readFileSync(file,'utf8'))),null,1)+'\n');}
