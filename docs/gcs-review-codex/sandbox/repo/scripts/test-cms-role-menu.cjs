const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),vm=require('node:vm');
const {test}=require('node:test');
const source=fs.readFileSync(path.join(__dirname,'cms/cms-shell.js'),'utf8');
const menuSource=source.slice(0,source.indexOf(' }).catch(()=>{});')+' }).catch(()=>{});'.length)+'\n});';
async function menu(context,pathname='/parent'){
 const nodes=[];let ready;
 const element=tag=>({tag,children:[],style:{},setAttribute(){},append(...children){this.children.push(...children);}});
 vm.runInNewContext(menuSource,{document:{addEventListener(_event,fn){ready=fn;},createElement:element,body:{append(node){nodes.push(node);}}},location:{pathname},fetch:async()=>({json:async()=>context})});
 ready();await new Promise(setImmediate);return nodes[0];
}
test('Parent administrators get a parent role link outside the role selection page',async()=>{
 const result=await menu({ok:true,verwaltung:true,parent:true,sponsor:false,player:false});
 assert.equal(result.open,false);assert.deepEqual(result.children.filter(n=>n.tag==='a').map(n=>n.href),['/roles','/parent']);
 assert.equal(await menu({ok:true,verwaltung:true,parent:true},'/roles'),undefined);
});
test('Sponsor entry is shown only when the context grants it',async()=>{
 const result=await menu({ok:true,parent:true,sponsor:true,player:false});
 assert.deepEqual(result.children.filter(n=>n.tag==='a').map(n=>n.href),['/parent','/sponsor']);
 assert.equal(await menu({ok:true,parent:true,player:false}),undefined);
});
