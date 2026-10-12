// Vorschau-Host: Spiel einbetten und zurückkehren. Einwahl/Galerie laufen als GCS-Tasks.
document.addEventListener('DOMContentLoaded',()=>{
 if(location.pathname==='/super'){
  const audioLink=document.createElement('a');audioLink.href='/super/audio';audioLink.textContent='🎧 Stimmen & Audio-Cache';audioLink.style.cssText='position:fixed;right:12px;bottom:12px;z-index:9000;background:#173d4e;color:white;padding:14px;border:2px solid #58bdb2;border-radius:8px;font:18px system-ui';document.body.append(audioLink);
 }
 const objects=()=>window.player?.runtime?.getObjects()||[],value=name=>objects().find(o=>o.name===name)?.value;
 const layer=document.createElement('section');layer.hidden=true;layer.style.cssText='position:fixed;inset:0;background:#08151b;z-index:10000';
 const back=document.createElement('button');back.textContent='⬅ Schließen';back.setAttribute('aria-label','Spiel schließen');back.style.cssText='height:52px;width:180px;font-size:22px;cursor:pointer';
 const partyAction=document.createElement('button');partyAction.hidden=true;partyAction.style.cssText='position:absolute;right:12px;top:0;height:52px;font-size:20px;cursor:pointer';
 const frame=document.createElement('iframe');frame.title='Ausgewähltes Spiel';frame.style.cssText='display:block;width:100%;height:calc(100% - 52px);border:0';frame.setAttribute('sandbox','allow-scripts allow-same-origin');
 const status=document.createElement('div');status.hidden=true;status.style.cssText='position:absolute;left:15%;right:15%;top:65px;padding:24px;background:#173d4e;color:white;border:2px solid #58bdb2;border-radius:12px;text-align:center;font:20px system-ui;z-index:2';
 layer.append(back,partyAction,frame,status);document.body.append(layer);
 const key=()=>frame.getAttribute('src')?.match(/^\/play\/([a-f0-9]{48})$/)?.[1];
 const speech=window.attachCmsSpeechHost?.(frame,key);
 let host=false;
 let liveSocket,liveOpening;const livePending=new Map();
 const liveFail=reason=>{for(const p of livePending.values()){clearTimeout(p.timer);p.reject(reason);}livePending.clear();};
 const liveConnect=launchKey=>{
  if(liveSocket?.readyState===WebSocket.OPEN)return Promise.resolve(liveSocket);
  if(liveOpening)return liveOpening;
  liveOpening=new Promise((resolve,reject)=>{
   const ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}/api/cms/party/live?launchKey=${launchKey}`);
   const timer=setTimeout(()=>{ws.close();reject(new Error('Zeitüberschreitung'));},5000);
   ws.onopen=()=>{clearTimeout(timer);liveSocket=ws;resolve(ws);};
   ws.onmessage=event=>{try{const m=JSON.parse(event.data);if(m.type==='live-result'){const p=livePending.get(m.id);if(p){livePending.delete(m.id);clearTimeout(p.timer);p.resolve(m);}}else if((m.type==='live-update'||(m.type==='live-result'&&m.data))&&key()===launchKey)frame.contentWindow?.postMessage({type:'gcs-cms-live',data:m.data},'*');}catch{}};
   ws.onclose=()=>{if(liveSocket===ws)liveSocket=undefined;liveOpening=undefined;liveFail(new Error('Live-Verbindung geschlossen'));if(key()===launchKey)frame.contentWindow?.postMessage({type:'gcs-cms-live',data:{ok:false,message:'Live-Verbindung geschlossen.'}},'*');};
   ws.onerror=()=>{clearTimeout(timer);reject(new Error('Live-Verbindung fehlgeschlagen'));};
  });
  return liveOpening;
 };
 const livePost=async(launchKey,id,body)=>{
  try{await liveConnect(launchKey);}catch{return{status:503,data:{ok:false,message:'Live-Sync nicht erreichbar.'}};}
  return await new Promise(resolve=>{
   const timer=setTimeout(()=>{livePending.delete(id);resolve({status:504,data:{ok:false,message:'Live-Sync antwortet nicht.'}});},5000);
   livePending.set(id,{resolve:m=>resolve({status:m.status||200,data:m.data}),reject:()=>resolve({status:503,data:{ok:false,message:'Live-Sync nicht erreichbar.'}}),timer});
   liveSocket?.send(JSON.stringify({type:'live',id,body:{state:body.state,input:body.input,since:body.since}}));
  });
 };
 const statusPanel=document.createElement('section');statusPanel.setAttribute('aria-label','Server- und Spielstatus');statusPanel.setAttribute('aria-live','polite');statusPanel.hidden=true;statusPanel.style.cssText='position:fixed;right:12px;top:64px;z-index:11000;min-width:240px;max-width:360px;padding:10px 12px;border-radius:10px;background:#102d3a;color:white;font:15px system-ui;box-shadow:0 4px 16px #0008';
 const serverLine=document.createElement('div'),gameLine=document.createElement('div'),partyLine=document.createElement('div');statusPanel.append(serverLine,gameLine,partyLine);document.body.append(statusPanel);
 const setLine=(element,text,tone='info')=>{element.textContent=text;element.hidden=!text;element.style.color={ok:'#9be7c4',info:'#d8f3ff',warn:'#ffd37a',error:'#ff9f9f'}[tone];statusPanel.hidden=![serverLine,gameLine,partyLine].some(line=>!line.hidden);};
 const names=value=>Array.isArray(value)?value.filter(Boolean):[];
 const namesText=items=>items.length>1?items.join(', '):String(items[0]||'');
 const gameText=(state,remaining)=>{const labels={active:'aktiv',paused:'pausiert',disconnected:'getrennt',ended:'beendet'};const rest=Number.isFinite(Number(remaining))?` · noch ${Number(remaining)} Min.`:'';return 'Spiel: '+(labels[state]||state||'unbekannt')+rest;};
 const refreshStatus=async()=>{if(!objects().some(o=>o.name==='CMSServerPruefung')){statusPanel.hidden=true;return;}try{const response=await fetch('/api/cms/contexts',{method:'POST',headers:{'Content-Type':'application/json'},body:'{}',credentials:'omit'});setLine(serverLine,response.ok?'Server: verbunden':'Server: nicht erreichbar',response.ok?'ok':'error');}catch{setLine(serverLine,'Server: nicht erreichbar','error');}const launchKey=key();if(!launchKey){setLine(gameLine,'');return;}try{const response=await fetch('/api/cms/play',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey,action:'status'}),credentials:'omit'});const data=await response.json();setLine(gameLine,data.ok?gameText(data.status,data.remainingMinutes):'Spiel: '+(data.message||'Status unbekannt'),data.ok?(data.status==='active'?'ok':['paused','disconnected'].includes(data.status)?'warn':'error'):'warn');}catch{setLine(gameLine,'Spiel: Status nicht erreichbar','warn');}};
 const hideGame=()=>{speech?.cancel();const party=objects().find(o=>o.name==='CMSMpPartyId');if(party)party.value='';liveSocket?.close();liveSocket=undefined;liveFail(new Error('Spiel geschlossen'));partyAction.hidden=true;frame.src='about:blank';layer.hidden=true;status.hidden=true;setLine(gameLine,'');setLine(partyLine,'');};
 back.onclick=hideGame;
 partyAction.onclick=async()=>{const launchKey=key(),partyId=value('CMSMpPartyId'),party=objects().find(o=>o.name==='CMSMpPartyId');if(!launchKey||!partyId)return hideGame();try{const r=await fetch('/api/cms/party',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey,partyId,op:host?'end':'leave'})});const data=await r.json();if(data.ok){if(party)party.value='';hideGame();}else{status.textContent=data.message||'Partie konnte nicht beendet werden.';status.hidden=false;}}catch{status.textContent='Server nicht erreichbar.';status.hidden=false;}};
 addEventListener('message',async event=>{
  if(event.source!==frame.contentWindow||!['null',location.origin].includes(event.origin)||layer.hidden)return;
  const data=event.data,launchKey=key();
  if(!launchKey||data?.type!=='gcs-cms-bridge'||typeof data.id!=='string'||data.id.length>80||!['/api/cms/party','/api/cms/play'].includes(data.route)||data.body?.launchKey!==launchKey||JSON.stringify(data.body).length>4096)return;
  if(data.route==='/api/cms/party'&&!['list','state','action','begin','end','join','leave','create','live'].includes(data.body.op))return;
  if(data.route==='/api/cms/play'&&!['heartbeat','end','progress','pause','resume','status','cards','cardNext','cardAnswer'].includes(data.body.action))return;
  let result,code;
  if(data.body.op==='live'){const live=await livePost(launchKey,data.id,data.body);code=live.status;result=live.data;}
  else{try{const response=await fetch(data.route,{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify(data.body),credentials:'omit'});code=response.status;result=await response.json();}catch{code=503;result={ok:false,message:'Spielserver nicht erreichbar.'};}}
  if(key()===launchKey)frame.contentWindow?.postMessage({type:'gcs-cms-result',id:data.id,status:code,data:result},'*');
 });
 const invite=document.createElement('section');invite.setAttribute('role','dialog');invite.setAttribute('aria-modal','true');invite.setAttribute('aria-label','Spieleinladung');invite.hidden=true;invite.style.cssText='position:fixed;inset:0;background:#08151bd9;color:white;z-index:10001;font:20px system-ui';
 const card=document.createElement('div');card.style.cssText='max-width:560px;margin:15vh auto;padding:32px;background:#173d4e;border:2px solid #58bdb2;border-radius:14px;text-align:center';
 const text=document.createElement('p'),accept=document.createElement('button'),decline=document.createElement('button');accept.textContent='Annehmen & spielen';decline.textContent='Ablehnen';for(const btn of [accept,decline])btn.style.cssText='padding:12px;margin:8px;font:18px system-ui;cursor:pointer';card.append(text,accept,decline);invite.append(card);document.body.append(invite);
 let pending='',responding=false,loading=false;
 const respond=async choice=>{if(!pending||responding)return;responding=true;try{const r=await fetch('/api/cms/mp/respond',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token:value('Token'),invitationId:pending,accept:choice})});const data=await r.json();if(data.ok){invite.hidden=true;pending='';if(choice){const launch=objects().find(o=>o.name==='SpielURL');const party=objects().find(o=>o.name==='CMSMpPartyId');if(party)party.value=data.partyId;if(launch)launch.value=data.launch;}}else text.textContent=data.message||'Einladung nicht mehr gültig.';}catch{text.textContent='Server nicht erreichbar.';}finally{responding=false;}};
 accept.onclick=()=>respond(true);decline.onclick=()=>respond(false);
 const poll=async()=>{const token=value('Token');if(!token||loading||responding)return;loading=true;try{const response=await fetch('/api/cms/mp/invitations',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({token})});const data=await response.json();const item=data.items?.find(i=>i.status==='pending'&&Number(i.expiresAt)>Date.now());if(item){pending=item.id;text.textContent=`${item.host} lädt dich ein, ${item.game} im Raum ${item.room} zu spielen.`;invite.hidden=false;}else{pending='';invite.hidden=true;}}catch{}finally{loading=false;}};
 invite.hidden=true;setInterval(poll,3000);setTimeout(poll,500);
 setInterval(async()=>{const launch=objects().find(o=>o.name==='SpielURL');if(launch?.value&&/^\/play\/[a-f0-9]{48}$/.test(launch.value)){host=window.player?.runtime?.stage?.id==='stage_multiplayer_lobby';frame.src=launch.value;launch.value='';layer.hidden=false;status.hidden=!(value('CMSMpPartyId')&&host);status.textContent='Warte auf die Antwort der eingeladenen Person …';}
  const launchKey=key(),partyId=value('CMSMpPartyId');if(layer.hidden||!launchKey||!partyId){setLine(partyLine,'');return;}
  try{const response=await fetch('/api/cms/party',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({launchKey,partyId,op:'state',since:0})});const data=await response.json();if(!data.ok){setLine(partyLine,'Partie: '+(data.message||'Status unbekannt'),'warn');return;}host=data.youAreHost;const departed=names(data.departedNames),disconnected=names(data.disconnectedNames),messages=[];
   if(data.status==='ended'||data.ended)messages.push('Die Partie wurde beendet.');
   if(departed.length)messages.push(namesText(departed)+(departed.length>1?' haben die Partie verlassen.':' hat die Partie verlassen.'));
   if(disconnected.length)messages.push(namesText(disconnected)+(disconnected.length>1?' sind vorübergehend getrennt.':' ist vorübergehend getrennt.'));
   if(data.invitationStatus==='declined')messages.push(data.inviteeName+' hat die Einladung abgelehnt.');
   if(data.invitationStatus==='expired')messages.push(data.inviteeName+' hat nicht rechtzeitig geantwortet.');
   const summary=data.status==='ended'?'beendet':data.memberCount+' aktiv'+(departed.length?' · '+departed.length+' verlassen':'')+(disconnected.length?' · '+disconnected.length+' getrennt':'');
   setLine(partyLine,'Partie: '+summary,data.status==='ended'||departed.length?'error':disconnected.length?'warn':'ok');partyAction.hidden=data.status==='ended';partyAction.textContent=host?'Partie beenden':'Partie verlassen';
   if(messages.length){status.textContent=messages.join(' ');status.hidden=false;}else if(host&&data.status==='open'){status.textContent='Warte auf die Antwort von '+data.inviteeName+' …';status.hidden=false;}else status.hidden=true;
  }catch{setLine(partyLine,'Partie: Status nicht erreichbar','warn');}
 },3000);
 setInterval(refreshStatus,5000);refreshStatus();
});
