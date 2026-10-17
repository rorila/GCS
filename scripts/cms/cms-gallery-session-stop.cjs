function apply(p){
 const s=p.stages.find(s=>s.id==='stage_gallery'),server=p.stages.find(s=>s.id==='stage_server_player');if(!s||!server)return;
 const up=(list,name,data)=>{const old=list.find(x=>x.name===name);if(old)Object.assign(old,data);else list.push({id:'gallery_stop_'+name,name,scope:'stage',...data});};
 const prop=(name,changes)=>up(s.actions,name,{type:'property',changes});
 const a=name=>({type:'action',name});
 const button=s.objects.find(o=>o.name==='SitzungBeenden');if(button)Object.assign(button,{x:46,y:6,width:14,height:3,text:'⏹ Spiel beenden',visible:false,zIndex:6,style:{...button.style,fontFamily:'Segoe UI, sans-serif',fontSize:18}});
 prop('Act_StartFehler_Anzeigen',{Busy:0,'Hinweis.text':'${Antwort.message}','SitzungBeenden.visible':false,'MeinKarteikasten.visible':true});
 prop('Act_Beenden_Anzeigen',{'SitzungBeenden.visible':true,'SitzungBeenden.enabled':true,'MeinKarteikasten.visible':false});
 prop('Act_Stop_Warten',{Busy:1,'SitzungBeenden.enabled':false,'Hinweis.text':'Das laufende Spiel wird beendet …'});
 prop('Act_Gestoppt',{Busy:0,'Hinweis.text':'Spiel beendet. Du kannst jetzt ein Spiel wählen.','SitzungBeenden.visible':false,'SitzungBeenden.enabled':true,'MeinKarteikasten.visible':true});
 prop('Act_StopFehler',{Busy:0,'Hinweis.text':'${StopAntwort.message}','SitzungBeenden.visible':true,'SitzungBeenden.enabled':true,'MeinKarteikasten.visible':false});
 up(s.tasks,'Sitzung_Beenden',{triggerMode:'local-sync',params:[],actionSequence:[{type:'condition',condition:{variable:'Busy',operator:'==',value:0},body:[a('Act_Stop_Warten'),a('Act_Sitzung_Stoppen'),{type:'condition',condition:{variable:'StopAntwort.ok',operator:'==',value:true},body:[a('Act_Gestoppt')],elseBody:[a('Act_StopFehler')]}],elseBody:[]}]});
 const fail=server.actions.find(x=>x.name==='Spielstart_FehlerStart');if(fail)fail.params=['${Launch.status}','${Launch.message}',{conflict:'${Launch.conflict}'}];
}
module.exports={apply};
