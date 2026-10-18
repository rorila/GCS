// Legacy games already have explicit house assignments in grants. Preserve
// those assignments without granting access to any additional house.
const selectedHouses=(game,db)=>Array.isArray(game?.availableHouseIds)?game.availableHouseIds:
 game?.availableHouseIds===undefined?(db?.areas||[]).filter(a=>a.type==='house'&&(db.grants||[]).some(g=>g.gameId===game?.id&&g.areaId===a.id&&g.active)).map(a=>a.id):[];
const allowed=(game,houseId,db)=>game?.availableHouseIds===null||selectedHouses(game,db).includes(houseId);
function methods(access){
 const fail=(status,message)=>({ok:false,status,message});
 const game=ctx=>ctx.core.db.games.find(g=>g.id===ctx.body.id);
 const authorized=ctx=>ctx.core.can(ctx.session,'publish');
 return {
  gameAvailability(ctx){
   if(!authorized(ctx))return fail(403,'Nur SuperAdmins dürfen Hausfreigaben verwalten.');
   const g=game(ctx);if(!g)return fail(404,'Spiel nicht gefunden.');
   const db=ctx.core.db;
   return {ok:true,allHouses:g.availableHouseIds===null,items:db.areas.filter(a=>a.type==='house').map(a=>({id:a.id,name:a.name,available:allowed(g,a.id,db),status:allowed(g,a.id,db)?'Zugeordnet':'Nicht zugeordnet'})),message:g.availableHouseIds===null?'Modus: Alle Häuser (auch neue Häuser).':'Modus: Nur ausgewählte Häuser · '+selectedHouses(g,db).length+' zugeordnet.'};
  },
  setGameAvailability(ctx){
   if(!authorized(ctx))return fail(403,'Nur SuperAdmins dürfen Hausfreigaben verwalten.');
   const g=game(ctx),b=ctx.body,db=ctx.core.db;if(!g)return fail(404,'Spiel nicht gefunden.');
   if(!['all','selected','assign','remove','toggle'].includes(b.mode))return fail(400,'Freigabemodus ungültig.');
   if(['assign','remove','toggle'].includes(b.mode)&&!db.areas.some(a=>a.id===b.houseId&&a.type==='house'))return fail(400,'Haus nicht gefunden.');
   // Switching from all to selected starts with no houses, never with all houses.
   const selected=new Set(selectedHouses(g,db));
   if(b.mode==='assign')selected.add(b.houseId);
   if(b.mode==='remove')selected.delete(b.houseId);
   if(b.mode==='toggle'){if(selected.has(b.houseId))selected.delete(b.houseId);else selected.add(b.houseId);}
   const ids=b.mode==='all'?null:[...selected];
   ctx.commit(ctx.session,'game-house-availability',null,next=>{next.games.find(x=>x.id===g.id).availableHouseIds=ids;});
   for(const house of db.areas.filter(a=>a.type==='house'&&!allowed(game(ctx),a.id,db)))access.revokeGame(ctx,null,[{gameId:g.id,houseId:house.id}]);
   return methods(access).gameAvailability(ctx);
  }
 };
}
module.exports={allowed,methods};
