function ensureCardPointRules(db) {
 for(const [metric,points] of [['promotions',1],['resets',-1]]){
  const id='leitner-'+metric+'-v1';
  if(!db.performanceRuleVersions.some(r=>r.id===id))db.performanceRuleVersions.push({id,status:'published',subjectKey:'cards',activityKey:metric,metric:'card_'+metric,unit:'transition',minValue:0,maxValue:1,pointsPerUnit:points,trustClass:'server-checked',version:1});
 }
 return db;
}
module.exports={ensureCardPointRules};
