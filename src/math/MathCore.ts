/** DOM-free, deterministic mathematics. The CMS bundle is generated from this file. */
export {normalizeSpokenNumber} from '../utils/SpokenNumber';
export type Operation='addition'|'subtraction'|'multiplication-gap';
export interface MathProfile {id:string;version:1;objectiveId:string;operation:Operation;crossingTen:'required'|'none';maxResult:100;}
export interface MathTask {id:string;contentKey:string;profileId:string;generatorVersion:1;left:number;right:number;operation:Operation;prompt:string;solution:number;choices:number[];hint:string;steps:string[];sourceCardId?:string;}
export const curriculumSource={url:'https://www.lehrplanplus.bayern.de/fachlehrplan/grundschule/2/mathematik',section:'M1/2 1.2',retrievedAt:'2026-10-15',officialVersion:null,origin:'derived',reviewStatus:'technical-example-needs-pedagogical-review'} as const;
export const profiles:MathProfile[]=[
 {id:'multiplication-gap-deck-v1',version:1,objectiveId:'by.gs.math.12.multiplication.missing-factor',operation:'multiplication-gap',crossingTen:'none',maxResult:100},
 {id:'add-to100-cross-ten-v1',version:1,objectiveId:'by.gs.math.12.addition.bridge-ten.to100',operation:'addition',crossingTen:'required',maxResult:100},
 {id:'sub-to100-cross-ten-v1',version:1,objectiveId:'by.gs.math.12.subtraction.bridge-ten.to100',operation:'subtraction',crossingTen:'required',maxResult:100},
 {id:'add-to100-no-cross-v1',version:1,objectiveId:'by.gs.math.12.addition.no-cross.to100',operation:'addition',crossingTen:'none',maxResult:100},
 {id:'sub-to100-no-cross-v1',version:1,objectiveId:'by.gs.math.12.subtraction.no-cross.to100',operation:'subtraction',crossingTen:'none',maxResult:100}
];
export function getProfile(id:string){const p=profiles.find(p=>p.id===id);if(!p)throw Error('Unbekanntes Aufgabenprofil.');return p;}
function random(seed:string){let state=2166136261;for(const c of seed)state=Math.imul(state^c.charCodeAt(0),16777619);state=state>>>0||1;return()=>{state^=state<<13;state^=state>>>17;state^=state<<5;return(state>>>0)/4294967296;};}
function shuffle<T>(items:T[],rng:()=>number){const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(rng()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
export function validateMathTask(task:MathTask){
 if(task.profileId==='multiplication-gap-deck-v1'){
  const match=/^(\?|\d+) × (\?|\d+) = (\d+)$/.exec(task.prompt);
  if(!match||task.operation!=='multiplication-gap'||task.generatorVersion!==1||(match[1]==='?')===(match[2]==='?'))throw Error('Ungültige Einmaleins-Lücke.');
  const fixed=Number(match[1]==='?'?match[2]:match[1]),product=Number(match[3]);
  if(!Number.isInteger(task.solution)||fixed<1||fixed>10||task.solution<1||task.solution>10||fixed*task.solution!==product||task.left!==fixed||task.right!==product||task.choices.length!==3||new Set(task.choices).size!==3||!task.choices.includes(task.solution)||task.choices.some(v=>!Number.isInteger(v)||v<1||v>10)||JSON.stringify(task.steps)!==JSON.stringify([`${fixed} × ${task.solution} = ${product}`]))throw Error('Ungültige Einmaleins-Antwort.');
  return true;
 }
 const p=getProfile(task.profileId),solution=task.operation==='addition'?task.left+task.right:task.left-task.right;
 if(task.generatorVersion!==1||task.operation!==p.operation||!Number.isInteger(task.left)||!Number.isInteger(task.right)||task.left<1||task.left>99||task.right<1||task.right>9||solution<0||solution>100||task.solution!==solution)throw Error('Ungültige Mathematikaufgabe.');
 const cross=p.operation==='addition'?task.left%10+task.right>10:task.right>task.left%10;
 if((p.crossingTen==='required')!==cross||(p.crossingTen==='required'&&task.left%10===0))throw Error('Zehnerregel verletzt.');
 if(task.choices.length!==3||new Set(task.choices).size!==3||task.choices.filter(v=>v===solution).length!==1||task.choices.some(v=>!Number.isInteger(v)||v<0||v>100))throw Error('Ungültige Antwortauswahl.');
 if(!Array.isArray(task.steps)||task.steps.length<1||task.steps.length>2)throw Error('Lösungsweg fehlt.');
 let previous=task.left,total=0;
 for(const step of task.steps){const match=/^(\d+) ([+−-]) (\d+) = (\d+)$/.exec(step);if(!match||Number(match[1])!==previous||(match[2]==='+')!==(task.operation==='addition')||Number(match[4])!==(match[2]==='+'?Number(match[1])+Number(match[3]):Number(match[1])-Number(match[3])))throw Error('Ungültiger Lösungsweg.');previous=Number(match[4]);total+=Number(match[3]);}
 if(previous!==solution||total!==task.right)throw Error('Lösungsweg gehört nicht zur Aufgabe.');
 return true;
}
export function generateMathTasks(profileId:string,seed:string,count=10):MathTask[]{
 if(profileId==='multiplication-gap-deck-v1')throw Error('Dieses Profil benötigt einen Kartenstapel.');
 const p=getProfile(profileId);if(typeof seed!=='string'||!seed||seed.length>128||!Number.isInteger(count)||count<1||count>20)throw Error('Seed oder Aufgabenanzahl ungültig.');
 const pool:{a:number;b:number}[]=[];
 for(let a=1;a<=99;a++)for(let b=1;b<=9;b++){const result=p.operation==='addition'?a+b:a-b,cross=p.operation==='addition'?a%10+b>10:b>a%10;if(result>=0&&result<=100&&cross===(p.crossingTen==='required')&&(p.crossingTen!=='required'||a%10!==0))pool.push({a,b});}
 if(pool.length<count)throw Error('Zu wenige unterschiedliche Aufgaben für dieses Profil.');
 const rng=random(`${profileId}|v1|${seed}`);
 return shuffle(pool,rng).slice(0,count).map(({a,b},i)=>{
  const add=p.operation==='addition',solution=add?a+b:a-b,symbol=add?'+':'−',wrong:number[]=[];
  for(const v of [solution+(add?-10:10),solution-1,solution+1,solution+2,solution-2])if(v>=0&&v<=100&&v!==solution&&!wrong.includes(v)&&wrong.length<2)wrong.push(v);
  const bridge=add?10-a%10:a%10,ten=add?a+bridge:a-bridge,rest=b-bridge,cross=p.crossingTen==='required';
  const task:MathTask={id:`task-${i}`,contentKey:`${p.operation}:${a}:${b}:result`,profileId,generatorVersion:1,left:a,right:b,operation:p.operation,prompt:`${a} ${symbol} ${b} = ?`,solution,choices:shuffle([solution,...wrong],rng),hint:cross?(add?`Wie viel fehlt von ${a} bis ${ten}? Zerlege ${b} passend.`:`Rechne zuerst von ${a} zurück bis ${ten}. Zerlege ${b} passend.`):`Gehe von ${a} genau ${b} Schritte ${add?'vorwärts':'zurück'}.`,steps:cross?[`${a} ${symbol} ${bridge} = ${ten}`,`${ten} ${symbol} ${rest} = ${solution}`]:[`${a} ${symbol} ${b} = ${solution}`]};
  validateMathTask(task);return task;
 });
}

/** Read-only conversion: no card, import or Leitner fields are changed. */
export function adaptMultiplicationDeck(cards:{id:string;question:string;answers:string[];wrongAnswers?:string[]}[],seed:string):MathTask[]{
 if(cards.length!==10||!seed||seed.length>128)throw Error('Ein geeigneter Stapel benötigt genau zehn Karten.');
 const rng=random(seed),seen=new Set<string>();
 return shuffle(cards,rng).map((card,i)=>{
  const prompt=String(card.question).trim().replace(/[xX*·]/g,'×').replace(/\s*×\s*/g,' × ').replace(/\s*=\s*/g,' = ');
  const match=/^(\?|\d+) × (\?|\d+) = (\d+)$/.exec(prompt);
  if(!match||(match[1]==='?')===(match[2]==='?')||card.answers.length!==1||!/^\d+$/.test(card.answers[0]))throw Error('Stapel enthält keine eindeutige Einmaleins-Lücke.');
  const fixed=Number(match[1]==='?'?match[2]:match[1]),product=Number(match[3]),solution=Number(card.answers[0]);
  if(seen.has(prompt))throw Error('Doppelte Aufgabe im Stapel.');seen.add(prompt);
  const supplied=(card.wrongAnswers||[]).map(v=>/^\d+$/.test(v)?Number(v):NaN);
  if(supplied.some(v=>!Number.isInteger(v)||v<1||v>10||v===solution))throw Error('Ungültige falsche Antwort im Stapel.');
  const wrong=[...new Set([...supplied,solution-1,solution+1,solution-2,solution+2].filter(v=>v>=1&&v<=10&&v!==solution))].slice(0,2);
  const task:MathTask={id:`deck-task-${i}`,contentKey:prompt,profileId:'multiplication-gap-deck-v1',generatorVersion:1,operation:'multiplication-gap',left:fixed,right:product,prompt,solution,choices:shuffle([solution,...wrong],rng),hint:`Welche Zahl ergibt mal ${fixed} die Zahl ${product}? Denke an die ${fixed}er-Reihe.`,steps:[`${fixed} × ${solution} = ${product}`],sourceCardId:card.id};
  validateMathTask(task);return task;
 });
}
