const fs = require('fs');
const path = require('path');
const cp = require('child_process');
const root = path.resolve(__dirname, '..');
const input = path.join(root, 'src/plant-field.html');
const config = JSON.parse(fs.readFileSync(path.join(root, 'src/daily-tasks.json'), 'utf8'));
if (!Array.isArray(config.tasks) || config.tasks.length > 1000) throw Error('任务格式错误');
const raw = fs.readFileSync(input, 'utf8');
const identities=JSON.parse(fs.readFileSync(path.join(root,'src/plant-identities.json'),'utf8'));
if(identities.schemaVersion!==1||!identities.plants)throw Error('编号显示映射格式错误');
const { readLayout, validateConfig } = require('./task-data.cjs');
const ids = readLayout(raw), summary = validateConfig(config, ids);
for(const [id,p]of Object.entries(identities.plants))if(!ids.has(id)||!['B','F','Z'].includes(p.colorCode))throw Error('编号显示映射无效：'+id);
const renderer = process.env.VISUALIZE_RENDERER;
if (!renderer || !fs.existsSync(renderer)) throw Error('请设置 VISUALIZE_RENDERER 为 visualize 的 render.py 路径');
const python = process.env.PYTHON_BIN || 'python';
let document = cp.execFileSync(python, [renderer, input, '--title', '同质园 · 盆位与处理'], { encoding: 'utf8', maxBuffer: 4000000 });
function decode(s) { return s.replace(/&quot;/g, '"').replace(/&#x27;/g, "'").replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&amp;/g, '&'); }
function encode(s) { return s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;'); }
document = document.replace(/data-srcdoc="([^"]*)"/, (_, encoded) => {
  let inner = decode(encoded);
  inner = inner.replace(/<script\b[^>]*\bsrc="https:[^"]*"[^>]*><\/script>/g, '');
  inner = inner.replace('/*__PUBLISHED_TASKS__*/', 'const publishedTasks=' + JSON.stringify(config).replace(/</g, '\\u003c') + ';');
  inner = inner.replace('/*__PLANT_IDENTITIES__*/', 'const plantIdentities=' + JSON.stringify(identities.plants).replace(/</g, '\\u003c') + ';');
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
document = document.replace('</head>', '<meta name="description" content="同质园盆位定位、每日处理与异交配对查看器。"><meta name="theme-color" content="#101318"></head>');
document = document.replace('</body>', `<script>
const feedbackFrame=document.getElementById('codex-visualization');
feedbackFrame.addEventListener('load',()=>{try{feedbackFrame.contentWindow.postMessage({type:'plant-feedback-state',entries:JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}')},'*');feedbackFrame.contentWindow.postMessage({type:'plant-operator-state',value:localStorage.getItem('plant-field-operator-v1')||''},'*');}catch(e){feedbackFrame.contentWindow.postMessage({type:'plant-feedback-state',entries:{}},'*');feedbackFrame.contentWindow.postMessage({type:'plant-feedback-save-error'},'*');}});
window.addEventListener('message', event => {
  const frame=document.getElementById('codex-visualization'),data=event.data;
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
  if(event.source!==frame.contentWindow||data?.type!=='plant-png-download'||typeof data.png!=='string'||!data.png.startsWith('data:image/png;base64,')||data.png.length>40000000)return;
  const bytes=Uint8Array.from(atob(data.png.split(',')[1]),c=>c.charCodeAt(0));
  const url=URL.createObjectURL(new Blob([bytes],{type:'image/png'})),a=document.createElement('a');
  a.href=url;a.download='同质园盆位.png';document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),60000);
});
</script></body>`);
fs.mkdirSync(path.join(root, 'docs'), { recursive: true });
document = document.replace(/\r\n/g, '\n');
fs.writeFileSync(path.join(root, 'docs/index.html'), document);
fs.writeFileSync(path.join(root, 'docs/.nojekyll'), '');
console.log(JSON.stringify({ built: true, confirmedPlants: ids.size, ...summary, bytes: Buffer.byteLength(document) }));
