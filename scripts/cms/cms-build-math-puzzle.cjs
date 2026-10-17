const fs=require('node:fs'),path=require('node:path'),sharp=require('sharp');
const {buildGame}=require('./cms-build-math-game.cjs');
const root=path.resolve(__dirname,'../..');
async function buildPuzzle(){
 const source=JSON.parse(fs.readFileSync(path.join(root,'game-server/public/projects/PuzzleNeu.json'),'utf8'));
 require('esbuild').buildSync({entryPoints:[path.join(root,'src/utils/ImageSplitterModel.ts')],bundle:true,platform:'node',format:'cjs',outfile:path.join(__dirname,'generated/image-splitter.cjs')});
 const {createImagePieces}=require('./generated/image-splitter.cjs');
 const folder=path.join(root,'public/images/memory Tierbilder für kleine Kinder');
 const images=await Promise.all(['ai-generated-7734145_640.jpg','zebra-6029606_640.png','tiger-160601_640.png'].map(async file=>'data:image/jpeg;base64,'+(await sharp(path.join(folder,file)).resize(640,400,{fit:'contain',background:'#18384b'}).jpeg({quality:85}).toBuffer()).toString('base64')));
 const p=buildGame(),s=p.stages.find(s=>s.id==='stage_math_play');
 p.meta={...p.meta,id:'gcs-math-puzzle',name:'Mathe-Rechenpuzzle',version:'0.1.0',basedOn:'PuzzleNeu.json',description:'Zehn Aufgaben und zehn echte Puzzleteile. Vorlage PuzzleNeu; Mathematikrunden mit Hilfen und Einmaleins-Stapeln.'};
 s.name='Rechenpuzzle';s.grid.cols=80;s.grid.rows=62;s.grid.backgroundColor='#101e30';
 const find=n=>s.objects.find(o=>o.name===n),act=n=>s.actions.find(a=>a.name===n),ref=name=>({type:'action',name}),taskRef=name=>({type:'task',name});
 const cond=(variable,value,body,elseBody=[],operator='==')=>({type:'condition',condition:{variable,operator,value},body,elseBody});
 const action=(name,type,data)=>{s.actions.push({id:'puzzle_action_'+name,name,type,scope:'stage',...data});return ref(name);};
 const prop=(name,changes)=>action(name,'property',{changes});
 const task=(name,actionSequence)=>s.tasks.push({id:'puzzle_task_'+name,name,scope:'stage',triggerMode:'local-sync',params:[],actionSequence});
 const position=(n,x,y,width,height)=>Object.assign(find(n),{x,y,width,height});
 Object.assign(find('MathTitle'),{text:'🧩 Rechenpuzzle',x:2,y:1,width:30,height:3});
 position('MathProgress',2,5,30,2);position('MathQuestion',2,9,30,5);find('MathQuestion').style.fontSize=32;
 for(let i=0;i<3;i++){position('MathChoice'+i,2+i*10.5,16,9,5);find('MathChoice'+i).style.fontSize=26;act('Math_Display').changes['MathChoice'+i+'.text']='${MathState.choices.'+i+'}';}
 position('MathFeedback',2,23,30,7);find('MathFeedback').style.fontSize=19;
 for(const [n,x,y,w]of [['MathStart',2,32,30],['MathHelp',2,32,10],['MathReveal',13,32,19],['MathNext',2,37,14],['MathFinish',18,37,14],['MathPause',2,42,10],['MathResume',13,42,19],['MathEnd',62,49,16],['MathAdd',2,37,14],['MathSub',18,37,14],['MathDeckOpen',2,47,30]])position(n,x,y,w,3);
 position('MathDeckTable',2,10,30,20);find('MathDeckTable').columns[0].width=470;
 const add=o=>{s.objects.push(o);return o;};
 const obj=(name,className,x,y,width,height,extra={})=>add({id:'puzzle_'+name,name,className,scope:'stage',x,y,width,height,visible:true,zIndex:2,align:'NONE',style:{fontFamily:'Segoe UI, sans-serif',fontSize:20,color:'#f4f9ff',backgroundColor:'transparent',borderWidth:0},...extra});
 p.variables.push({id:'puzzle_ready',name:'PuzzleReady',className:'TBooleanVariable',scope:'global',isVariable:true,isHiddenInRun:true,type:'boolean',value:false,defaultValue:false});
 p.variables.push({id:'puzzle_image_index',name:'PuzzleImageIndex',className:'TIntegerVariable',scope:'global',isVariable:true,isHiddenInRun:true,type:'integer',value:0,defaultValue:0});
 act('Math_Request_Start').body.imageIndex='${PuzzleImageIndex}';
 obj('PuzzleInstruction','TLabel',38,6,40,3,{text:'Wähle ein Bild. Löse Aufgaben und setze die Teile ein.'});
 obj('PuzzleTrayLabel','TLabel',38,38,13,5,{text:'Dein nächstes Teil erscheint hier. Ziehe es ins Bild.'});
 obj('PuzzlePlaceButton','TButton',38,45,13,3,{text:'Teil einsetzen',visible:false,events:{onClick:'Puzzle_AutoPlace'},style:{fontSize:18,fontFamily:'Segoe UI, sans-serif',color:'#ffffff',backgroundColor:'#247b75',borderRadius:12}});
 obj('PuzzleSuccess','TLabel',38,49,23,3,{text:'🌟 Geschafft! Dein Puzzle ist fertig.',visible:false});
 const board=structuredClone(source.stages.find(st=>st.id==='stage_main').objects.find(o=>o.name==='Zielplattform'));
 Object.assign(board,{id:'puzzle_board',name:'PuzzleBoard',x:38,y:10,width:40,height:25,columns:5,rows:2,imageSource:images[0],ghostOpacity:.1,snapRadius:2,placedCount:0,visible:true,zIndex:1,events:{onPiecePlaced:'Puzzle_Placed',onComplete:'Puzzle_Complete'}});add(board);
 const template=source.stages.find(st=>st.id==='stage_main').objects.find(o=>o.name==='PuzzleTeilTemplate');
 const pieces=createImagePieces({id:'math-puzzle',imageSource:images[0],columns:5,rows:2,pieceShape:'puzzle',tabSize:.18},640,400);
 for(const piece of pieces){const o=structuredClone(template);Object.assign(o,{id:'puzzle_piece_'+piece.index,name:'PuzzlePiece'+piece.index,className:'TSprite',isHiddenInRun:false,visible:false,x:53,y:36,width:8,height:12.5,draggable:true,zIndex:10,backgroundImage:images[0],sourceWidth:640,sourceHeight:400,sourceRectX:piece.x,sourceRectY:piece.y,sourceRectWidth:piece.width,sourceRectHeight:piece.height,puzzleEdges:piece.puzzleEdges,puzzleTabDepth:piece.puzzleTabDepth,imageIndex:piece.index,matchValue:piece.matchValue,events:{onDragEnd:'Puzzle_Drop'}});delete o.poolSize;add(o);}
 for(let i=0;i<images.length;i++){
  obj('PuzzlePicture'+i,'TSprite',38+i*14,1,12,4.8,{backgroundImage:images[i],appearanceMode:'simple',objectFit:'contain',shape:'rect',spriteColor:'transparent',events:{onClick:'Puzzle_Image'+i}});
  const selectImage=prop('Puzzle_SelectImage'+i,{PuzzleImageIndex:i,'PuzzleBoard.imageSource':images[i],...Object.fromEntries(pieces.map(piece=>['PuzzlePiece'+piece.index+'.backgroundImage',images[i]]))});
  task('Puzzle_Image'+i,[cond('MathPhase','ready',[selectImage])]);
 }
 const nextControls=[cond('MathState.lastTask',true,[prop('Puzzle_ShowFinish',{'MathFinish.visible':true})],[prop('Puzzle_ShowNext',{'MathNext.visible':true})])];
 task('Puzzle_Placed',[prop('Puzzle_PlacedState',{PuzzleReady:true,'PuzzlePlaceButton.visible':false,'PuzzleTrayLabel.text':'Prima! Das Teil sitzt. Weiter geht’s.'}),...nextControls]);
 task('Puzzle_Complete',[prop('Puzzle_Celebrate',{'PuzzleSuccess.visible':true,'PuzzleInstruction.text':'Alle zehn Teile sind eingesetzt! 🌟'}),action('Puzzle_CelebrationAnimation','animate',{target:'PuzzleSuccess',effect:'bounce',duration:750,height:10})]);
 task('Puzzle_Drop',[cond('MathPhase','feedback',[cond('PuzzleReady',false,[action('Puzzle_TryDrop','call_method',{target:'PuzzleBoard',method:'tryPlacePiece',params:['${draggedObj}'],resultVariable:'PuzzleDropOk'}),cond('PuzzleDropOk',false,[prop('Puzzle_ReturnToTray',{'self.x':53,'self.y':36})])])])]);
 const sync=[...images.map((_,i)=>cond('MathState.imageIndex',i,[ref('Puzzle_SelectImage'+i)])),prop('Puzzle_ResetControls',{PuzzleReady:false,'PuzzlePlaceButton.visible':false,'MathNext.visible':false,'MathFinish.visible':false,'PuzzleBoard.placedCount':'${MathState.index}'})];
 const auto=[];
 for(let i=0;i<10;i++){
  const name='PuzzlePiece'+i,x=38+(i%5)*8,y=10+Math.floor(i/5)*12.5;
  sync.push(cond('MathState.index',i,[prop('Puzzle_Restore'+i,{[name+'.visible']:true,[name+'.draggable']:false,[name+'.x']:x,[name+'.y']:y})],[], '>'));
  sync.push(cond('MathState.index',i,[cond('MathState.taskDone',true,[prop('Puzzle_Unlock'+i,{[name+'.visible']:true,[name+'.draggable']:true,[name+'.x']:53,[name+'.y']:36,'PuzzlePlaceButton.visible':true,'PuzzleTrayLabel.text':'Teil verdient! Ziehe es ins Bild oder tippe auf Teil einsetzen.'})])]));
  auto.push(cond('MathState.index',i,[prop('Puzzle_MoveIntoPlace'+i,{[name+'.x']:x,[name+'.y']:y}),action('Puzzle_Place'+i,'call_method',{target:'PuzzleBoard',method:'tryPlacePiece',params:['${'+name+'}']})]));
 }
 task('Puzzle_AutoPlace',[cond('MathPhase','feedback',[cond('PuzzleReady',false,auto)])]);
 task('Puzzle_Sync',[cond('MathState.finished',false,sync)]);
 s.tasks.find(t=>t.name==='Math_Apply').actionSequence.push(taskRef('Puzzle_Sync'));
 for(const name of ['Math_Next','Math_Finish']){const t=s.tasks.find(t=>t.name===name);t.actionSequence=[cond('PuzzleReady',true,t.actionSequence)];}
 for(const name of ['Math_Display','Math_Stop','Math_Paused']){const a=act(name);if(a)a.changes['PuzzlePlaceButton.visible']=false;}
 act('Math_Completed').changes['MathQuestion.text']='Dein Bild ist fertig!';
 // No media folder requests in the upload sandbox: the three selected images are embedded.
 return require('./cms-math-card-source.cjs').apply(p);
}
module.exports={buildPuzzle};
if(require.main===module)buildPuzzle().then(p=>{const file=path.join(root,'game-server/public/projects/Mathe-Rechenpuzzle.json');fs.writeFileSync(file,JSON.stringify(p,null,2)+'\n');console.log('Mathe-Rechenpuzzle erzeugt. PuzzleNeu und produktiver Spielebestand bleiben erhalten.');}).catch(e=>{console.error(e);process.exitCode=1});
