const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const crypto = require('crypto');
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'src/plant-field.html');
const config = JSON.parse(fs.readFileSync(path.join(root, 'src/daily-tasks.json'), 'utf8'));
require('./batch-lifecycle.cjs').guard(root,config);
if (!Array.isArray(config.tasks) || config.tasks.length > 1000) throw Error('任务格式错误');
const raw = fs.readFileSync(input, 'utf8');
const identities=JSON.parse(fs.readFileSync(path.join(root,'src/plant-identities.json'),'utf8'));
const pickCap=JSON.parse(fs.readFileSync(path.join(root,'src/pick-cap.json'),'utf8'));
if(identities.schemaVersion!==1||!identities.plants)throw Error('编号显示映射格式错误');
const { readLayout, validateConfig } = require('./task-data.cjs');
const ids = readLayout(raw), summary = validateConfig(config, ids);
const archiveDir=path.join(root,'src/batches');
const archives=fs.existsSync(archiveDir)?fs.readdirSync(archiveDir).filter(n=>/^\d{4}-\d{2}-\d{2}\.json$/.test(n)).map(n=>JSON.parse(fs.readFileSync(path.join(archiveDir,n),'utf8'))):[];
for(const a of archives){const oldLayout=new Map(ids);for(const t of a.tasks)oldLayout.set(t.id,t.area);validateConfig(a,oldLayout);}
const history=archives.map(a=>({date:a.date,url:'batch-'+a.date+'.html'}));
const measurements=JSON.parse(fs.readFileSync(path.join(root,'src/measurement-tasks.json'),'utf8'));
const {validateMeasurements}=require('./measurement-data.cjs');const measurementSummary=validateMeasurements(measurements,ids);
for(const [id,p]of Object.entries(identities.plants))if(!ids.has(id)||!['B','F','Z'].includes(p.colorCode))throw Error('编号显示映射无效：'+id);
const renderer = process.env.VISUALIZE_RENDERER;
const python = process.env.PYTHON_BIN || 'python';
function decode(s) { return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
function encode(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
// Tracked renderer-output templates make the same full-source build available in the cloud.
// No reuse of an old embedded task block; every build still runs lifecycle validation above.
let document;
if(renderer&&fs.existsSync(renderer))document=cp.execFileSync(python,[renderer,input,'--title','同质园 · 盆位与处理'],{encoding:'utf8',maxBuffer:4000000});
else{
 const frame=fs.readFileSync(path.join(root,'scripts/frame-shell.html'),'utf8');
 const shell=fs.readFileSync(path.join(root,'scripts/page-shell.html'),'utf8');
 if(frame.split('<!--PLANT_FRAGMENT-->').length!==2||shell.split('<!--PLANT_FRAME-->').length!==2)throw Error('可移植构建模板无效');
 document=shell.replace('<!--PLANT_FRAME-->',()=>encode(frame.replace('<!--PLANT_FRAGMENT-->',()=>raw.replace(/\r\n/g,'\n').trim())));
}
document = document.replace(/data-srcdoc="([^"]*)"/, (_, encoded) => {
  let inner = decode(encoded);
  inner = inner.replace(/<script\b[^>]*\bsrc="https:[^"]*"[^>]*><\/script>/g, '');
  inner = inner.replace('/*__PUBLISHED_TASKS__*/', 'const publishedTasks=' + JSON.stringify(config).replace(/</g, '\\u003c') + ';');
  inner = inner.replace('/*__BATCH_HISTORY__*/', 'const batchHistory='+JSON.stringify(history)+';');
  inner = inner.replace('/*__MEASUREMENT_TASKS__*/', 'const publishedMeasurements=' + JSON.stringify(measurements).replace(/</g, '\\u003c') + ';');
  inner = inner.replace('/*__PLANT_IDENTITIES__*/', 'const plantIdentities=' + JSON.stringify(identities.plants).replace(/</g, '\\u003c') + ';');
  inner = inner.replace('/*__PICK_CAP__*/', 'const pickCap=' + JSON.stringify(pickCap.plants).replace(/</g, '\\u003c') + ';');
  inner = inner.replace(/<i data-lucide="search"[^>]*><\/i>/g, '<span aria-hidden="true">⌕</span>');
  inner = inner.replace(/<i data-lucide="rotate-ccw"[^>]*><\/i>/g, '<span aria-hidden="true">↺</span>');
  inner = inner.replace(/lang="en"/g, 'lang="zh-CN"');
  inner = inner.replace('</head>', '<style>html,html>body{padding:0!important;background:#101318!important}</style></head>');
  return 'data-srcdoc="' + encode(inner) + '"';
});
document = document.replace('sandbox="allow-scripts"', 'sandbox="allow-scripts allow-downloads"');
document = document.replace(/lang="en"/g, 'lang="zh-CN"');
document = document.replace('body{box-sizing:border-box;padding:1rem;background:inherit}', 'body{box-sizing:border-box;padding:0;background:#101318}');
document = document.replace('height:calc(100vh - 2rem)', 'height:100vh');
document = document.replace('</head>', '<meta name="plant-source-sha256" content="'+crypto.createHash('sha256').update(raw).digest('hex')+'"><meta name="description" content="同质园盆位定位、每日处理与异交配对查看器。"><meta name="theme-color" content="#101318"></head>');
document = document.replace('</body>', `<script>
const feedbackFrame=document.getElementById('codex-visualization');
let flowerScrollAnchor=null;
feedbackFrame.addEventListener('load',()=>{try{feedbackFrame.contentWindow.postMessage({type:'plant-feedback-state',entries:JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}')},'*');feedbackFrame.contentWindow.postMessage({type:'plant-operator-state',value:localStorage.getItem('plant-field-operator-v1')||''},'*');}catch(e){feedbackFrame.contentWindow.postMessage({type:'plant-feedback-state',entries:{}},'*');feedbackFrame.contentWindow.postMessage({type:'plant-feedback-save-error'},'*');}});
window.addEventListener('message', event => {
  const frame=document.getElementById('codex-visualization'),data=event.data;
  if(event.source===frame.contentWindow&&data?.type==='plant-flower-scroll-capture'){flowerScrollAnchor={x:scrollX,y:scrollY};return;}
  if(event.source===frame.contentWindow&&data?.type==='plant-flower-scroll-restore'&&flowerScrollAnchor){const anchor=flowerScrollAnchor;flowerScrollAnchor=null;requestAnimationFrame(()=>scrollTo(anchor.x,anchor.y));return;}
  if(event.source===frame.contentWindow&&data?.type==='plant-batch-open'&&${JSON.stringify(history.map(a=>a.date))}.includes(data.date)){location.href=new URL('batch-'+data.date+'.html',location.href).href;return;}
  if(event.source===frame.contentWindow&&data?.type==='plant-feedback-copy'&&typeof data.text==='string'&&data.text.length<=250000&&Number.isSafeInteger(data.requestId)){
    Promise.resolve().then(()=>navigator.clipboard.writeText(data.text)).then(()=>frame.contentWindow.postMessage({type:'plant-feedback-copied',requestId:data.requestId},'*')).catch(()=>frame.contentWindow.postMessage({type:'plant-feedback-copy-error',requestId:data.requestId},'*'));
    return;
  }
  if(event.source===frame.contentWindow&&data?.type==='plant-feedback-load'){
    try{frame.contentWindow.postMessage({type:'plant-feedback-state',entries:JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}')},'*');frame.contentWindow.postMessage({type:'plant-operator-state',value:localStorage.getItem('plant-field-operator-v1')||''},'*');}catch(e){frame.contentWindow.postMessage({type:'plant-feedback-state',entries:{}},'*');frame.contentWindow.postMessage({type:'plant-feedback-save-error'},'*');}
    return;
  }
  if(event.source===frame.contentWindow&&data?.type==='plant-operator-save'&&typeof data.value==='string'&&data.value.length<=20){try{localStorage.setItem('plant-field-operator-v1',data.value);}catch(e){frame.contentWindow.postMessage({type:'plant-feedback-save-error'},'*');}return;}
  if(event.source===frame.contentWindow&&data?.type==='plant-feedback-save'){
    const entries=data.entries;if(!entries||typeof entries!=='object'||Array.isArray(entries)||JSON.stringify(entries).length>250000)return;
    try{localStorage.setItem('plant-field-feedback-v1',JSON.stringify(entries));frame.contentWindow.postMessage({type:'plant-feedback-saved'},'*');}catch(e){frame.contentWindow.postMessage({type:'plant-feedback-save-error'},'*');}
    return;
  }
});
</script></body>`);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
document = document.replace(/\r\n/g, '\n');
fs.writeFileSync(path.join(root, 'docs/index.html'), document);
fs.writeFileSync(path.join(root, 'docs/.nojekyll'), '');
// Archive pages reuse the exact current UI; only the embedded batch is different.
const embedded='const publishedTasks='+JSON.stringify(config).replace(/</g,'\\u003c')+';';
for(const a of archives){
 const payload='const publishedTasks='+JSON.stringify({...a,readOnly:true}).replace(/</g,'\\u003c')+';';
 const page=document.replace(encode(embedded),()=>encode(payload));
 if(page===document)throw Error('归档数据未成功嵌入');
 fs.writeFileSync(path.join(root,'docs/batch-'+a.date+'.html'),page);
}
console.log(JSON.stringify({ built: true, confirmedPlants: ids.size, ...summary, measurements:measurementSummary, bytes: Buffer.byteLength(document) }));
