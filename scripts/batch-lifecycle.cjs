const fs=require('fs'),path=require('path'),cp=require('child_process'),crypto=require('crypto');
const hash=x=>crypto.createHash('sha256').update(JSON.stringify(x)).digest('hex');
const read=p=>JSON.parse(fs.readFileSync(p,'utf8'));
function published(root,ref='HEAD'){
 const p=cp.spawnSync('git',['show',ref+':src/daily-tasks.json'],{cwd:root,encoding:'utf8'});
 if(p.status!==0)throw Error('无法读取已提交批次基线，拒绝未经核对的切换');return JSON.parse(p.stdout);
}
function assertTransition(root,previous,next,now=new Date()){
 if(previous.date===next.date)return;
 if(!next.date||!previous.date||next.date<previous.date)throw Error('不能清空或倒退当前批次');
 const archive=path.join(root,'src/batches',previous.date+'.json');
 if(!fs.existsSync(archive))throw Error('批次切换被拦截：必须先归档上一批次');
 const old=read(archive);
 if(old.date!==previous.date||!['evening','morning'].every(p=>old.acknowledgedPhases?.includes(p)))throw Error('批次切换被拦截：上一批次两时段反馈尚未确认收齐；新任务应stage暂存');
 // Closure may change acknowledgement only; it must not silently rewrite the prior tasks.
 const withoutAck=x=>{const y={...x};delete y.acknowledgedPhases;return y;};
 if(hash(withoutAck(old))!==hash(withoutAck(previous)))throw Error('上一批次内容与已发布基线不同；先单独发布其更正/反馈，再切换');
 const day=new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Shanghai',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
 const earliest=new Date(+new Date(next.date+'T00:00:00Z')-86400000).toISOString().slice(0,10);
 if(day<earliest)throw Error('不能提前激活：尚未到该批次前处理日期');
 const receipt=path.join(root,'src/batch-activation.json');
 if(!fs.existsSync(receipt))throw Error('缺少显式激活回执，请使用batch activate');
 const r=read(receipt);
 if(r.from!==previous.date||r.to!==next.date||r.archivedHash!==hash(old)||r.initialTaskHash!==hash(next))throw Error('批次激活回执与候选不符，请重新核对后激活');
}
function guard(root,config,ref='HEAD'){assertTransition(root,published(root,ref),config);}
function main(root=path.resolve(__dirname,'..')){
 const [command,file]=process.argv.slice(2),livePath=path.join(root,'src/daily-tasks.json'),stagedPath=path.join(root,'src/upcoming-tasks.json');
 const {readLayout,validateConfig}=require('./task-data.cjs'),layout=readLayout(fs.readFileSync(path.join(root,'src/plant-field.html'),'utf8'));
 const live=read(livePath);
 if(command==='stage'){
  if(!file)throw Error('stage需要候选JSON路径');const next=read(path.resolve(file));validateConfig(next,layout);
  if(!next.date||next.date<=live.date)throw Error('暂存批次须晚于当前批次');
  fs.writeFileSync(stagedPath,JSON.stringify(next,null,2)+'\n');console.log('已暂存 '+next.date+'，当前批次 '+live.date+' 未改变');
 }else if(command==='activate'){
  const next=read(stagedPath);validateConfig(next,layout);
  if(!['evening','morning'].every(p=>live.acknowledgedPhases?.includes(p)))throw Error('当前批次反馈未全部确认，不能激活；不要为切换而虚构完成');
  const previous=published(root),dir=path.join(root,'src/batches');fs.mkdirSync(dir,{recursive:true});
  const ap=path.join(dir,live.date+'.json');
  if(fs.existsSync(ap)&&hash(read(ap))!==hash(live))throw Error('已有不同内容的归档；请先核对，不自动覆盖');
  fs.writeFileSync(ap,JSON.stringify(live,null,2)+'\n');
  fs.writeFileSync(path.join(root,'src/batch-activation.json'),JSON.stringify({from:live.date,to:next.date,archivedHash:hash(live),initialTaskHash:hash(next),activatedAt:new Date().toISOString()},null,2)+'\n');
  assertTransition(root,previous,next);
  fs.writeFileSync(livePath,JSON.stringify(next,null,2)+'\n');console.log('已显式激活 '+next.date+'；尚须build、测试与部署');
 }else throw Error('Usage: node scripts/batch-lifecycle.cjs stage FILE | activate');
}
module.exports={hash,published,assertTransition,guard};
if(require.main===module)try{main();}catch(e){console.error(e.message);process.exitCode=1;}
