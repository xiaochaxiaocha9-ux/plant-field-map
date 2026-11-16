const {normId}= {normId:v=>String(v||'').normalize('NFKC')};
function validateMeasurements(config,layout){
 if(config.schemaVersion!==1||!/^\d{4}-\d{2}-\d{2}$/.test(config.asOf||''))throw Error('测量批次日期无效');
 if(config.weekly?.tasks?.length||config.weekly?.unlocated?.length)throw Error('周末测量已下线，不能重新发布周测任务');
 // firstflower.weekly is the legacy operation field, not an active weekly view.
 const allowed={firstflower:new Set(['id','area','recordType','flower','weekly','measurementDate','expected','inferred']),remeasure:new Set(['id','area','recordType','flower','dueDate','remeasure'])};
 for(const phase of ['firstflower','remeasure']){
  const group=config[phase];if(!Array.isArray(group?.tasks)||!Array.isArray(group.unlocated))throw Error('缺少独立测量清单');const ids=new Set();
  for(const t of group.tasks){const id=normId(t.id);if(ids.has(id)||!layout.has(id)||layout.get(id)!==t.area||t.recordType!=='plant'||t.flower!==''||!t[phase==='firstflower'?'weekly':phase]?.startsWith('测量：')||Object.keys(t).some(k=>!allowed[phase].has(k)))throw Error('测量植株/字段无效：'+id);ids.add(id);if(phase==='remeasure'&&!/^\d{4}-\d{2}-\d{2}$/.test(t.dueDate||''))throw Error('复测缺原到期日');if(phase==='firstflower'&&(!/^\d{4}-\d{2}-\d{2}$/.test(t.measurementDate||'')||typeof t.expected!=='boolean'))throw Error('首花测量日期无效');}
  for(const t of group.unlocated){if(layout.has(normId(t.id))||ids.has(normId(t.id))||Object.keys(t).some(k=>!(phase==='firstflower'?['id','measurementDate','expected','inferred']:['id','dueDate']).includes(k)))throw Error('未定位测量项不一致');ids.add(normId(t.id));}
 }
 const lg=config.leafpick;if(lg){if(!/^\d{4}-\d{2}-\d{2}$/.test(lg.date||'')||!Array.isArray(lg.tasks)||!Array.isArray(lg.unlocated))throw Error('叶片采样清单格式无效');const lallowed=new Set(['id','area','recordType','flower','leafpick','sampleDate','daysAfterFlower']);const lids=new Set();
  for(const t of lg.tasks){const id=normId(t.id);if(lids.has(id)||!layout.has(id)||layout.get(id)!==t.area||t.recordType!=='plant'||t.flower!==''||!t.leafpick?.startsWith('采样：')||t.sampleDate!==lg.date||!Number.isInteger(t.daysAfterFlower)||Object.keys(t).some(k=>!lallowed.has(k)))throw Error('叶片采样植株/字段无效：'+id);lids.add(id);}
  for(const t of lg.unlocated){if(layout.has(normId(t.id))||lids.has(normId(t.id))||Object.keys(t).some(k=>!['id','recordType','flower','leafpick','sampleDate','daysAfterFlower'].includes(k)))throw Error('未定位叶片采样项不一致');lids.add(normId(t.id));}}
 if(/[A-Z]:[\\/]|\.xlsx|\.jpe?g|github_pat_|ghp_/i.test(JSON.stringify(config)))throw Error('测量配置不可包含私有文件或凭据');
 return {firstflower:config.firstflower.tasks.length,scheduled30d:config.remeasure.tasks.length,leafpick:config.leafpick?.tasks.length||0};
}
module.exports={validateMeasurements};
