// Versioned card content, independent of any game's scenery. Only local assets.
const assets={
 fox:{src:'images/counting/fox.svg',plural:'Füchse'},
 elephant:{src:'images/counting/elephant.png',plural:'Elefanten'},
 panda:{src:'images/counting/panda.png',plural:'Pandas'},
 parrot:{src:'images/counting/parrot.png',plural:'Papageien'}
};
const objectiveId='by.gs.math.12.area.1.1';
function content(card){
 if((!card.taskType||card.taskType==='question')&&!card.presentation)return{};
 if(card.taskType!=='count-images'||card.presentation?.version!==1)throw Error('Unbekannter Aufgabentyp oder Layoutversion.');
 const p=card.presentation;
 if(!assets[p.assetId]||!Number.isInteger(p.count)||p.count<1||p.count>10||!Number.isInteger(p.layoutSeed)||p.layoutSeed<0)throw Error('Ungültige Bilderzählkarte.');
 if(card.answerFormat!=='text'||card.answers?.length!==1||String(card.answers[0])!==String(p.count))throw Error('Die richtige Antwort muss der Bildanzahl entsprechen.');
 const all=[...(card.answers||[]),...(card.wrongAnswers||[])].map(String);
 if(all.length!==3||new Set(all).size!==3||all.some(n=>!/^\d+$/.test(n)||String(Number(n))!==n||Number(n)<1||Number(n)>10))throw Error('Bilderzählkarten brauchen genau drei verschiedene Zahlen von 1 bis 10.');
 return{taskType:'count-images',presentation:{version:1,assetId:p.assetId,count:p.count,layoutSeed:p.layoutSeed},objectiveIds:[objectiveId]};
}
function view(card){
 const data=content(card),p=data.presentation;
 return{taskType:data.taskType||'question',presentation:p||null,
  pictureItems:Array.from({length:10},(_,i)=>({visible:!!p&&i<p.count,src:p?assets[p.assetId].src:assets.fox.src})),
  objectiveIds:data.objectiveIds||[]};
}
module.exports={assets,objectiveId,content,view};
