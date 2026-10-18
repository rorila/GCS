import test from 'node:test';
import assert from 'node:assert/strict';
import { collectShelfItems, isAutomaticShelfObject } from '../src/editor/EditorShelfModel';

test('shelf distinguishes technical resources from hidden visual controls', () => {
    for (const object of [{className:'TTimer'}, {className:'TVariable'}, {className:'TImageList'}, {className:'CustomService',isService:true}, {name:'Altvariable',type:'integer',defaultValue:0}]) assert.equal(isAutomaticShelfObject(object),true);
    for (const object of [{className:'TButton',visible:false,isHiddenInRun:true}, {className:'TDialogRoot',isService:true}, {className:'TVirtualGamepad',isService:true}, {className:'TStickyNote',isHiddenInRun:true}]) assert.equal(isAutomaticShelfObject(object),false);
});

test('shelf combines current and global sources without moving or duplicating project data', () => {
    const variable={id:'v',name:'Punkte',className:'TIntegerVariable',defaultValue:0,x:1,y:2};
    const timer={id:'t',name:'Timer',className:'TTimer',interval:1000,x:0,y:0};
    const global={id:'g',name:'GlobalTimer',className:'TTimer',scope:'global'};
    const active:any={id:'stage',name:'Spiel',type:'standard',objects:[timer,variable],variables:[variable]};
    const project:any={objects:[],variables:[{id:'root',name:'Wert',type:'integer',defaultValue:42,scope:'global'}],stages:[active,{id:'bp',type:'blueprint',name:'Global',objects:[global],variables:[]},{id:'other',type:'standard',objects:[{id:'otherTimer',className:'TTimer'}]}]};
    const before=JSON.stringify(project),items=collectShelfItems(project,active);
    assert.deepEqual(items.map(item=>item.id),['t','v','g','root']);
    assert.equal(items.find(item=>item.id==='v')?.detail,'TIntegerVariable · 0');
    assert.equal(items.find(item=>item.id==='g')?.group,'Global / geerbt');
    assert.equal(items.find(item=>item.id==='t')?.object,timer);
    assert.equal(JSON.stringify(project),before);
});
