// Fail when published HTML contains an old UI or old embedded task data.
const fs=require('fs'),path=require('path'),crypto=require('crypto'),assert=require('assert');
const root=path.resolve(__dirname,'..'),doc=fs.readFileSync(process.argv[2]||path.join(root,'docs/index.html'),'utf8');
const source=fs.readFileSync(path.join(root,'src/plant-field.html'));
const hash=crypto.createHash('sha256').update(source).digest('hex');
assert(doc.includes('<meta name="plant-source-sha256" content="'+hash+'">'),'构建页面不是当前界面源码版本，请运行 npm run build');
const encode=s=>s.replace(/&/g,'&amp;').replace(/"/g,'&quot;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
for(const [name,file,select] of [['publishedTasks','daily-tasks.json',x=>x],['publishedMeasurements','measurement-tasks.json',x=>x],['plantIdentities','plant-identities.json',x=>x.plants]]){
 const data=select(JSON.parse(fs.readFileSync(path.join(root,'src',file),'utf8')));
 const embedded='const '+name+'='+JSON.stringify(data).replace(/</g,'\\u003c')+';';
 assert(doc.includes(encode(embedded)),file+' 未正确嵌入，禁止发布');
}
console.log(JSON.stringify({passed:true,uiHash:hash,embedded:['daily','measurements','identities']}));
