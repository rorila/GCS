// Vorschau-Host: Spiel einbetten und zurückkehren. Einwahl/Galerie laufen als GCS-Tasks.
document.addEventListener('DOMContentLoaded',()=>{
 const adminLink=document.createElement('a');adminLink.href='/admin';adminLink.textContent='Verwaltung';adminLink.style.cssText='position:fixed;right:18px;bottom:12px;color:#bde5df;z-index:9999';document.body.append(adminLink);
 const layer=document.createElement('section');layer.hidden=true;layer.style.cssText='position:fixed;inset:0;background:#08151b;z-index:10000';
 const back=document.createElement('button');back.textContent='⬅ 🏠';back.setAttribute('aria-label','Zurück zur Galerie');back.style.cssText='height:52px;width:130px;font-size:26px;cursor:pointer';
 const frame=document.createElement('iframe');frame.title='Ausgewähltes Spiel';frame.style.cssText='display:block;width:100%;height:calc(100% - 52px);border:0';frame.setAttribute('sandbox','allow-scripts allow-same-origin');layer.append(back,frame);document.body.append(layer);
 back.onclick=()=>{frame.src='about:blank';layer.hidden=true;};
 setInterval(()=>{const launch=window.player?.runtime?.getObjects().find(o=>o.name==='SpielURL');if(launch?.value&&/^\/play\/[a-f0-9]{48}$/.test(launch.value)){frame.src=launch.value;launch.value='';layer.hidden=false;}},100);
});
