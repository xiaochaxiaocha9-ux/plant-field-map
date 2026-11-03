// One-time template refresh by the code maintainer, using the existing trusted renderer.
const fs=require('fs'),path=require('path'),cp=require('child_process'),assert=require('assert');
const root=path.resolve(__dirname,'..'),input=path.join(root,'src/plant-field.html'),raw=fs.readFileSync(input,'utf8').replace(/\r\n/g,'\n').trim();
if(!process.env.VISUALIZE_RENDERER)throw Error('Need the existing renderer for template refresh');
const doc=cp.execFileSync(process.env.PYTHON_BIN||'python',[process.env.VISUALIZE_RENDERER,input,'--title','同质园 · 盆位与处理'],{encoding:'utf8',maxBuffer:4000000}).replace(/\r\n/g,'\n');
const m=doc.match(/data-srcdoc="([^"]*)"/);assert(m);
const inner=m[1].replace(/&quot;/g,'"').replace(/&#x27;/g,"'").replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&');
assert.equal(inner.split(raw).length,2,'Source fragment must appear verbatim exactly once');
fs.writeFileSync(path.join(__dirname,'frame-shell.html'),inner.replace(raw,()=> '<!--PLANT_FRAGMENT-->'));
fs.writeFileSync(path.join(__dirname,'page-shell.html'),doc.replace(m[0],()=> 'data-srcdoc="<!--PLANT_FRAME-->"'));
console.log('Portable renderer templates generated; compare both builds byte-for-byte before accepting.');
