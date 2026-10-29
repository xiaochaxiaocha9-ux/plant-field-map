const vm = require('vm');
function readLayout(raw) {
  const match = raw.match(/const actualRows=(\[[\s\S]*?\n    \]);/);
  if (!match) throw Error('未找到现有盆位数据，不能猜测盆位');
  const rows = vm.runInNewContext(match[1], {}, { timeout: 1000 });
  const layout = new Map();
  rows.forEach(row => Array.from(row.ids).forEach(id => { if (id) { if (layout.has(id)) throw Error('重复盆位：' + id); layout.set(id, row.area || '第一片区'); } }));
  return layout;
}
function periodLabels(date) {
  const morning = new Date(date + 'T00:00:00Z'), evening = new Date(+morning - 86400000);
  const fmt = d => `${d.getUTCMonth() + 1}月${d.getUTCDate()}日`;
  return { evening: fmt(evening) + '晚', morning: fmt(morning) + '早' };
}
function needsAction(text) {
  const s = String(text || '').trim();
  if (!s || /已完成|已取消|已摘取|已丢弃/.test(s) || /^(不处理|无需操作|无操作|—)/.test(s)) return false;
  return /接\s*\d+\s*花粉|给\s*\d+\s*供粉|套袋|去雄|绑|摘取|测量|采样|人工自交|自主自交|自然开放|确认|检查/.test(s.replace(/不(?:套袋|去雄|授粉|人工授粉|摘取|绑线)/g, ''));
}
function validateConfig(config, layout) {
  if (!Array.isArray(config.tasks) || config.tasks.length > 1000 || typeof config.label !== 'string') throw Error('任务格式错误');
  if (!config.tasks.length && config.date === null) return { plants: 0, tasks: 0, crosses: 0, active: { evening: 0, morning: 0 } };
  if (!/^\d{4}-\d{2}-\d{2}$/.test(config.date) || !Number.isFinite(+new Date(config.date + 'T00:00:00Z')) || new Date(config.date + 'T00:00:00Z').toISOString().slice(0, 10) !== config.date) throw Error('需要有效的实际预计开放日期');
  const periods = periodLabels(config.date);
  if (!config.label.includes(periods.evening) || !config.label.includes(periods.morning)) throw Error('任务说明须同时包含具体晚间和早晨日期');
  if (/[A-Z]:[\\/]|gh[pousr]_|github_pat_|password=|\.xlsx\b|\.jpe?g\b/i.test(JSON.stringify(config))) throw Error('任务中不得包含私有文件路径、工作簿、照片或凭据');
  const keys = new Set(), pairs = new Set(), donors = new Map(), locatedPartnersMissingTasks=new Set();
  for (const t of config.tasks) {
    if (typeof t.id !== 'string' || !layout.has(t.id)) throw Error('任务植株尚未录入盆位：' + t.id);
    const plantOnly=t.recordType==='plant';
    if ((!plantOnly&&!/^\d+$/.test(String(t.flower))) || (plantOnly&&(t.flower!==''||t.flowerId!==undefined||!/测量|采样/.test(t.morning)||/接\s*\d+\s*花粉|给\s*\d+\s*供粉|自交|自然开放/.test(t.morning))) || t.area !== layout.get(t.id) || !t.evening || !t.morning) throw Error('花号、植株测量、片区或时段字段不完整：' + t.id);
    if(!plantOnly&&t.flowerId!==undefined&&!new RegExp('^'+t.id+'-[BFZ]'+t.flower+'$').test(t.flowerId))throw Error('短花号与植株/花序不一致：'+t.id);
    if (/已取消/.test(t.evening + t.morning)) throw Error('明确取消的任务应移除：' + t.id);
    const key = t.id + '#' + (plantOnly?'plant':t.flower);
    if (keys.has(key)) throw Error('任务重复：' + key);
    keys.add(key);
  }
  for (const t of config.tasks) {
    for (const m of t.morning.matchAll(/接\s*(\d+)\s*花粉/g)) {
      if (m[1] === t.id) throw Error('异交亲本不能同株：' + t.id);
      const flower = t.morning.match(/父本第(\d+)朵/)?.[1];
      if (!flower) throw Error('缺父本花号：' + m[1] + '→' + t.id);
      const counterpart = config.tasks.find(x => x.id === m[1] && String(x.flower) === flower);
      if (layout.has(m[1])) {
        // A previously published, explicitly unmapped parent can acquire a location later.
        // Preserve that source record without fabricating a new parent task; expose the gap.
        if(!counterpart&&/父本盆位未录入/.test(t.morning))locatedPartnersMissingTasks.add(m[1]);
        else if (!counterpart || !new RegExp('给\\s*' + t.id + '\\s*供粉（母本第' + t.flower + '朵').test(counterpart.morning)) throw Error('异交供受双方或花号不一致：' + m[1] + '→' + t.id);
      } else if (!/父本盆位未录入/.test(t.morning)) throw Error('缺少未定位父本说明：' + m[1]);
      const relation = m[1] + '#' + flower + '>' + t.id + '#' + t.flower;
      pairs.add(relation);const dk = m[1] + '#' + flower;
      if (!donors.has(dk)) donors.set(dk, new Set());donors.get(dk).add(t.id + '#' + t.flower);
    }
    for (const m of t.morning.matchAll(/给\s*(\d+)\s*供粉（母本第(\d+)朵[^）]*）/g)) {
      const recipient = config.tasks.find(x => x.id === m[1] && String(x.flower) === m[2]);
      if (layout.has(m[1]) && (!recipient || !new RegExp('接\\s*' + t.id + '\\s*花粉').test(recipient.morning) || !recipient.morning.includes('父本第' + t.flower + '朵'))) throw Error('异交受粉行缺失或花号不一致：' + t.id + '→' + m[1]);
      if (!layout.has(m[1]) && !m[0].includes('母本盆位未录入')) throw Error('缺少未定位母本说明：' + m[1]);
      pairs.add(t.id + '#' + t.flower + '>' + m[1] + '#' + m[2]);
      const dk = t.id + '#' + t.flower;if (!donors.has(dk)) donors.set(dk, new Set());donors.get(dk).add(m[1] + '#' + m[2]);
    }
  }
  for (const [id, mothers] of donors) if (mothers.size > 2) throw Error('同一父本花供粉超过两朵：' + id);
  const plants = new Set(config.tasks.map(t => t.id)).size;
  const coverage = config.label.match(/仅展示已录入盆位的(\d+)\/(\d+)株/);
  if (!coverage || +coverage[1] !== plants || +coverage[2] < plants) throw Error('任务说明中的盆位覆盖数不一致');
  return { plants, tasks: config.tasks.length, crosses: pairs.size, active: { evening: config.tasks.filter(t => needsAction(t.evening)).length, morning: config.tasks.filter(t => needsAction(t.morning)).length }, periods,locatedPartnersMissingTasks:[...locatedPartnersMissingTasks] };
}
module.exports = { readLayout, periodLabels, needsAction, validateConfig };
