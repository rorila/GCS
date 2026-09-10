/** Verhindert Selbstzuordnung, fehlende Eltern und Zyklen. */
export function canParentFeature(features:{id:string;parentId?:string}[],id:string,parentId:string):boolean {
 if(!parentId)return true;const visited=new Set<string>();let current=parentId;
 while(current){if(current===id||visited.has(current))return false;visited.add(current);const parent=features.find(f=>f.id===current);if(!parent)return false;current=parent.parentId||'';}
 return true;
}
