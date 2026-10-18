const crypto=require('node:crypto');
const COLLECTIONS={
 people:{key:['id'],fields:['id']},
 areas:{key:['id'],fields:['id','parentId'],refs:{parentId:['areas','id']}},
 memberships:{key:['personId','areaId'],fields:['personId','areaId'],refs:{personId:['people','id'],areaId:['areas','id']}},
 roles:{key:['personId','areaId','role'],fields:['personId','areaId','role'],refs:{personId:['people','id'],areaId:['areas','id']}},
 guardians:{key:['childId','guardianId'],fields:['childId','guardianId'],refs:{childId:['people','id'],guardianId:['people','id']}},
 codes:{fields:['personId','areaId'],refs:{personId:['people','id'],areaId:['areas','id']}},
 games:{key:['id'],fields:['id','ownerId'],refs:{ownerId:['people','id']}},
 grants:{key:['gameId','areaId'],fields:['gameId','areaId'],refs:{gameId:['games','id'],areaId:['areas','id']}},
 profileRequests:{key:['id'],fields:['personId'],refs:{personId:['people','id']}},
 invites:{key:['id'],fields:['personId','houseId'],refs:{personId:['people','id'],houseId:['areas','id']}},
 timeBudgets:{key:['childId'],fields:['childId'],refs:{childId:['people','id']}},
 deviceGrants:{key:['id'],fields:['houseId'],refs:{houseId:['areas','id']}},
 playSessions:{key:['id'],fields:['id','childId','gameId'],refs:{childId:['people','id'],gameId:['games','id']}},
 progress:{key:['childId','eventId'],fields:['childId','gameId'],refs:{childId:['people','id'],gameId:['games','id']}},
 parties:{key:['id'],fields:['id','hostId','gameId','areaId'],refs:{hostId:['people','id'],gameId:['games','id'],areaId:['areas','id']}},
 gameInvitations:{key:['id'],fields:['sessionId','inviterPersonId','invitedPersonId'],refs:{sessionId:['parties','id'],inviterPersonId:['people','id'],invitedPersonId:['people','id']}},
 notifications:{key:['id'],fields:['recipientPersonId'],refs:{recipientPersonId:['people','id']}},
 temporaryRoomAccess:{key:['id'],fields:['personId','roomId','sessionId'],refs:{personId:['people','id'],roomId:['areas','id'],sessionId:['parties','id']}},
 flashcards:{key:['id'],fields:['id','childId'],refs:{childId:['people','id']}},
 cardDecks:{key:['id'],fields:['id','ownerId','houseId'],refs:{ownerId:['people','id'],houseId:['areas','id']}},
 sponsorshipRequestCapabilities:{key:['id'],fields:['childId'],refs:{childId:['people','id']}},
 sponsorships:{key:['id'],fields:['id','sponsorId','childId'],refs:{sponsorId:['people','id'],childId:['people','id']}},
 sponsorAccessVersions:{key:['id'],fields:['sponsorshipId'],refs:{sponsorshipId:['sponsorships','id']}},
 sponsorAgreements:{key:['id'],fields:['id','sponsorshipId'],refs:{sponsorshipId:['sponsorships','id']}},
 sponsorAgreementVersions:{key:['agreementId','version'],fields:['agreementId'],refs:{agreementId:['sponsorAgreements','id']}},
 sponsorApprovals:{key:['targetType','targetId','version','actorId','aspect'],fields:[]},
 performanceRuleVersions:{key:['id'],fields:['id']},
 performanceLedger:{key:['eventId'],fields:['childId','ruleVersionId'],refs:{childId:['people','id'],ruleVersionId:['performanceRuleVersions','id']}},
 rewardClaims:{key:['entitlementKey'],fields:['sponsorshipId','childId'],refs:{sponsorshipId:['sponsorships','id'],childId:['people','id']}},
 rewardPointEntries:{key:['id'],fields:['childId'],refs:{childId:['people','id']}},
 sponsorEvents:{key:['id'],fields:[]},
 sponsorCommandReceipts:{key:['key'],fields:[]},
 sponsorMessages:{key:['id'],fields:[]}
};
const FORMAT=1,APPLICATION_ID=0x47435343;
const canonical=value=>{
 if(Array.isArray(value))return value.map(canonical);
 if(value&&typeof value==='object')return Object.fromEntries(Object.keys(value).sort().map(key=>[key,canonical(value[key])]));
 return value;
};
const encode=value=>JSON.stringify(canonical(value));
const hash=value=>crypto.createHash('sha256').update(encode(value)).digest('hex');
const rowKey=(collection,row)=>{
 const fields=COLLECTIONS[collection].key;
 if(fields&&fields.every(field=>row[field]!==undefined&&row[field]!==null))return encode(fields.map(field=>row[field]));
 return hash(row);
};
function createSchema(db){
 db.exec(`CREATE TABLE cms_metadata (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)));
 CREATE TABLE cms_settings (key TEXT PRIMARY KEY, value TEXT NOT NULL CHECK(json_valid(value)));
 CREATE TABLE cms_audit (id TEXT PRIMARY KEY, ordinal INTEGER NOT NULL UNIQUE, payload TEXT NOT NULL CHECK(json_valid(payload)));
 CREATE TABLE cms_deletions (personId TEXT PRIMARY KEY, payload TEXT NOT NULL CHECK(json_valid(payload)));
 CREATE TABLE cms_credentials (personId TEXT PRIMARY KEY REFERENCES people(id) DEFERRABLE INITIALLY DEFERRED, username TEXT NOT NULL UNIQUE COLLATE NOCASE, payload TEXT NOT NULL CHECK(json_valid(payload)));`);
 for(const [name,spec]of Object.entries(COLLECTIONS)){
  const columns=(spec.fields||[]).map(field=>{
   const ref=spec.refs?.[field];
   return `"${field}" TEXT GENERATED ALWAYS AS (json_extract(payload,'$.${field}')) STORED${field==='id'?' UNIQUE':''}${ref?` REFERENCES "${ref[0]}"("${ref[1]}") DEFERRABLE INITIALLY DEFERRED`:''}`;
  });
  db.exec(`CREATE TABLE "${name}" (record_key TEXT PRIMARY KEY, ordinal INTEGER NOT NULL, payload TEXT NOT NULL CHECK(json_valid(payload))${columns.length?', '+columns.join(', '):''});`);
  for(const field of spec.fields||[])if(field!=='id')db.exec(`CREATE INDEX "idx_${name}_${field}" ON "${name}"("${field}");`);
 }
 db.exec(`PRAGMA application_id=${APPLICATION_ID}; PRAGMA user_version=${FORMAT};`);
}
module.exports={COLLECTIONS,FORMAT,APPLICATION_ID,encode,hash,rowKey,createSchema};
