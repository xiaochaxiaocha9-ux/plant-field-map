const fs=require('fs'),path=require('path'),os=require('os'),assert=require('assert');
const {assertTransition,hash}=require('./batch-lifecycle.cjs');
const root=fs.mkdtempSync(path.join(os.tmpdir(),'plant-batch-test-'));
const write=(p,x)=>{fs.mkdirSync(path.dirname(path.join(root,p)),{recursive:true});fs.writeFileSync(path.join(root,p),JSON.stringify(x));};
const old={date:'2026-11-03',tasks:[{id:'1',flower:'1'}],acknowledgedPhases:['evening']},next={date:'2026-11-04',tasks:[]};
try{
 assert.doesNotThrow(()=>assertTransition(root,old,{...old,label:'同批更正'}));
 assert.throws(()=>assertTransition(root,old,next),/归档/);
 write('src/batches/2026-11-03.json',old);assert.throws(()=>assertTransition(root,old,next),/反馈尚未/);
 const closed={...old,acknowledgedPhases:['morning','evening']};write('src/batches/2026-11-03.json',closed);
 write('src/batch-activation.json',{from:old.date,to:next.date,archivedHash:hash(closed),initialTaskHash:hash(next)});
 assert.throws(()=>assertTransition(root,old,next,new Date('2026-11-02T15:59:00Z')),/提前/);
 assert.doesNotThrow(()=>assertTransition(root,old,next,new Date('2026-11-02T16:00:00Z')));
 assert.doesNotThrow(()=>assertTransition(root,old,{...next,label:'changed',tasks:[{id:'2',flower:'1'}]},new Date('2026-11-03T00:00:00Z')),'激活后同批补充不应被回执锁死');
 write('src/batches/2026-11-03.json',{...closed,tasks:[...closed.tasks,{id:'3',flower:'1'}]});
 const expanded={...closed,tasks:[...closed.tasks,{id:'3',flower:'1'}]};write('src/batch-activation.json',{from:old.date,to:next.date,archivedHash:hash(expanded),initialTaskHash:hash(next)});
 assert.doesNotThrow(()=>assertTransition(root,old,next,new Date('2026-11-03T00:00:00Z')),'归档可以包含原批次补报新花');
 write('src/batches/2026-11-03.json',{...closed,tasks:[]});assert.throws(()=>assertTransition(root,old,next),/更改或删除/);
 assert.throws(()=>assertTransition(root,old,{date:null,tasks:[]}),/清空/);
 assert.throws(()=>assertTransition(root,old,{date:'2026-11-02'}),/倒退/);
 console.log(JSON.stringify({passed:true,tests:['same batch correction','no archive rejected','incomplete receipt rejected','Beijing date boundary','explicit activation','receipt mismatch','archive preservation','clear and rollback rejected']}));
}finally{fs.rmSync(root,{recursive:true,force:true});}
