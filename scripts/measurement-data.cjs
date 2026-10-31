const {normId}= {normId:v=>String(v||'').normalize('NFKC')};
function validateMeasurements(config,layout){
 if(config.schemaVersion!==1||!/^\d{4}-\d{2}-\d{2}$/.test(config.asOf||'')||!/^\d{4}-\d{2}-\d{2}$/.test(config.weekly?.start||'')||!/^\d{4}-\d{2}-\d{2}$/.test(config.weekly?.end||''))throw Error('测量批次日期无效');
 if(new Date(config.weekly.start+'T00:00:00Z').getUTCDay()!==6||+new Date(config.weekly.end+'T00:00:00Z')-+new Date(config.weekly.start+'T00:00:00Z')!==86400000)throw Error('周末测量应为连续周六至周日');
 const allowed={firstflower:new Set(['id','area','recordType','flower','weekly','measurementDate','expected','inferred']),weekly:new Set(['id','area','recordType','flower','weekly']),remeasure:new Set(['id','area','recordType','flower','dueDate','remeasure'])};
 for(const phase of ['firstflower','weekly','remeasure']){
  const group=config[phase];if(!Array.isArray(group?.tasks)||!Array.isArray(group.unlocated))throw Error('缺少独立测量清单');const ids=new Set();
  for(const t of group.tasks){const id=normId(t.id);if(ids.has(id)||!layout.has(id)||layout.get(id)!==t.area||t.recordType!=='plant'||t.flower!==''||!t[phase==='firstflower'?'weekly':phase]?.startsWith('测量：')||Object.keys(t).some(k=>!allowed[phase].has(k)))throw Error('测量植株/字段无效：'+id);ids.add(id);if(phase==='remeasure'&&!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate||''))throw Error('复测缺原到期日');if(phase==='firstflower'&&(!/^\d{4}-\d{2}-\d{2}$/.test(t.measurementDate||'')||typeof t.expected!=='boolean'))throw Error('首花测量日期无效');}
  for(const t of group.unlocated){if(layout.has(normId(t.id))||ids.has(normId(t.id))||Object.keys(t).some(k=>!(phase==='firstflower'?['id','measurementDate','expected','inferred']:['id','dueDate']).includes(k)))throw Error('未定位测量项不一致');ids.add(normId(t.id));}
 }
 if(config.weekly.tasks.some(t=>config.remeasure.tasks.some(r=>r.id===t.id)))throw Error('同株不可同时为未开花周测和首花后复测');
 if(config.firstflower.tasks.some(t=>config.weekly.tasks.some(r=>r.id===t.id)))throw Error('首花待测不重复列入普通周测');
 if(/[A-Z]:[\\/]|\.xlsx|\.jpe?g|github_pat_|ghp_/i.test(JSON.stringify(config)))throw Error('测量配置不可包含私有文件或凭据');
 return {firstflower:config.firstflower.tasks.length,weekly:config.weekly.tasks.length,scheduled30d:config.remeasure.tasks.length};
}
module.exports={validateMeasurements};
