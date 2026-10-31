const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qa-output');
fs.mkdirSync(out, { recursive: true });
fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:false,status:'running'},null,2));
const document = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const currentTasks = JSON.parse(fs.readFileSync(path.join(root, 'src/daily-tasks.json'), 'utf8'));
const { readLayout, validateConfig, periodLabels, needsAction } = require('./task-data.cjs');
const layout = readLayout(fs.readFileSync(path.join(root, 'src/plant-field.html'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'src/plant-field.html'), 'utf8');
const vm = require('vm');
const geometry = vm.runInNewContext(source.slice(source.indexOf('const geometryRevision='), source.indexOf('const actualRows=')) + '\n({measuredLengths,middleSpan,baySpan,leftSpan,gap2Span,bay3Span,gap3Span,frameRegions})', {}, {timeout:1000});
const allRows = vm.runInNewContext(source.match(/const actualRows=(\[[\s\S]*?\n    \]);/)[1], {}, {timeout:1000});
const middleRows=Array.from(allRows).filter(row=>row.section==='中间连接区'),leftRows=Array.from(allRows).filter(row=>row.section==='左侧有架区');
const placeholderCount = Array.from(allRows).reduce((sum,row)=>sum+Array.from(row.ids).filter(id=>!id).length,0);
assert.equal(geometry.measuredLengths.bay,1.66);
assert.equal(geometry.measuredLengths.middle,2.17);
assert.equal(geometry.measuredLengths.left,1.60);
assert(Math.abs((geometry.middleSpan.right-geometry.middleSpan.left)/(geometry.baySpan.right-geometry.baySpan.left)-2.17/1.66)<1e-12);
assert.equal(geometry.frameRegions[0][1].right,geometry.middleSpan.left);
assert.equal(geometry.middleSpan.right,geometry.baySpan.left);
assert(Math.abs((geometry.leftSpan.right-geometry.leftSpan.left)/(geometry.baySpan.right-geometry.baySpan.left)-1.60/1.66)<1e-12);
assert(Math.abs((geometry.gap2Span.right-geometry.gap2Span.left)/(geometry.baySpan.right-geometry.baySpan.left)-2.71/1.66)<1e-12);
assert(Math.abs((geometry.bay3Span.right-geometry.bay3Span.left)/(geometry.baySpan.right-geometry.baySpan.left)-1.47/1.66)<1e-12);
assert(Math.abs((geometry.gap3Span.right-geometry.gap3Span.left)/(geometry.baySpan.right-geometry.baySpan.left)-3.15/1.66)<1e-12);
assert.equal(geometry.frameRegions[0].length,3,'一区应有三个有架区');
assert.equal(geometry.frameRegions[1].length,0,'二区没有架子');
assert.deepEqual(Array.from(middleRows,row=>row.row),[0,1,2]);
assert.equal(layout.size,240,'所有已录入编号必须唯一；不得自动增加待核对的重复编号');
assert.equal([...layout.values()].filter(x=>x==='第一片区').length,185);
assert.equal([...layout.values()].filter(x=>x==='第二片区').length,55);
assert(middleRows.every(row=>row.fractions.every((x,i,a)=>x>=0&&x<=1&&(i===0||x>a[i-1]))));
assert.deepEqual(Array.from(leftRows.find(r=>r.row===0).ids),['483','295','220','317','1167','294','210','968','149','821']);
assert.deepEqual(Array.from(leftRows.find(r=>r.row===1).ids),['1130','826','1007','886','291','215','402','397','713']);
assert.deepEqual(Array.from(leftRows.find(r=>r.row===2).ids),['1020','144','795','585','156','2','85','929']);
assert.deepEqual(Array.from(middleRows.find(r=>r.row===0).ids),['163','646','330','159','550','208','416','794']);
assert.deepEqual(Array.from(middleRows.find(r=>r.row===1).ids),['81','648','782','1082','890','716','130','584','1093','218']);
assert.deepEqual(Array.from(middleRows.find(r=>r.row===2).ids),['54','907','143','48','928','692','1069','940','1170','834']);
for (const [id,area] of [['1118','第一片区'],['1202','第一片区'],['1138','第一片区'],['1097','第一片区'],['1304','第一片区'],['342','第一片区'],['1068','第二片区'],['434','第二片区'],['868','第二片区'],['868(2)','第二片区'],['229','第二片区'],['959','第二片区'],['297','第二片区'],['1016','第二片区'],['724','第二片区'],['331','第二片区']]) assert.equal(layout.get(id),area,`${id} 必须在用户指定片区`);
for (const id of ['1104']) assert(!layout.has(id),`${id} 位置待用户确认，不应映射`);
const rowIds=(section,row)=>Array.from(allRows.find(r=>r.section===section&&r.row===row).ids);
assert.deepEqual(rowIds('一无架区二',2),['1299','346','281','1044','1118','1202','482','661','213','293','898','50','543']);
assert.deepEqual(rowIds('一无架区二',1),['103','228','348','401','205','206','754','209','676','1339','162','626','1138']);
assert.deepEqual(rowIds('一无架区二',0).slice(0,6),['1168','1145','1295','76','616','1252']);
assert.deepEqual(rowIds('一有架区三',2),['419','917','9','919','956','857','866','282']);
assert.deepEqual(rowIds('一有架区三',0),['44','711','592','1144','969','86','595','1122']);
assert.deepEqual(rowIds('一无架区三',2),['867','1087','288','1297','53','942','179','966']);
assert.deepEqual(rowIds('一无架区三',1),['1365','911','1066','889','286','887','289','5','200','201','811','12','725','1368']);
assert.deepEqual(rowIds('二区全段',2),['1068','914','1116','404','707','912','882','544','52','868','808','546','183','229','959','297','1188','434','296','77','459','304','1162']);
assert.deepEqual(rowIds('二区全段',1),['331','916','915','518','913','733','896','410','749','787','910','780','758','684','1119','873','1088','1016','1169','868(2)','647','960','433','333','276','1010','549','19','961','958','1098','724']);
const taskSummary = validateConfig(currentTasks, layout);
const encode = s => s.replace(/&/g, '&amp;').replace(/"/g, '&quot;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
const embedded = c => encode('const publishedTasks=' + JSON.stringify(c).replace(/</g, '\\u003c') + ';');
assert(document.includes(embedded(currentTasks)), '构建产物必须嵌入当前真实任务，不能只更新JSON');
assert(!/C:[\\/]|E:[\\/]|password=|ghp_/.test(document), '发布文件不得含本地路径或凭据');
assert(!/src=&quot;https:/.test(document), '独立站不依赖外部CDN脚本');
assert(document.includes('publishedTasks'), '应内嵌负责人发布的任务');
// Isolated fixtures are served from memory, never saved into production task data.
const fixture = { date: '2026-10-27', label: '10月26日晚／10月27日早 · 仅展示已录入盆位的8/8株', tasks: [
  { area: '第一片区', id: '49', flower: '99', evening: '红线；去雄；套袋', morning: '接157花粉（父本第99朵）；重新套袋，红线' },
  { area: '第一片区', id: '792', flower: '99', evening: '已完成：红线；去雄；套袋', morning: '接157花粉（父本第99朵）；重新套袋，红线' },
  { area: '第一片区', id: '157', flower: '99', evening: '不处理（保留雄蕊，不套袋）', morning: '给49供粉（母本第99朵）；给792供粉（母本第99朵）' },
  { area: '第一片区', id: '59', flower: '99', evening: '绿线；套袋；不去雄', morning: '自主自交：确认开放，保持套袋' },
  { area: '第一片区', id: '56', flower: '99', evening: '白线；不套袋；不去雄', morning: '自然开放：确认开放，白线' },
  { area: '第一片区', id: '36', flower: '99', evening: '不处理（不套袋，不去雄）', morning: '摘取测量：确认开放后采样' },
  { area: '第一片区', id: '46', flower: '99', evening: '黄线；套袋；不去雄', morning: '人工自交：取本花花粉授本花柱头，再套袋' },
  { area: '第一片区', id: '47', flower: '99', evening: '已完成：绿线套袋', morning: '已完成：自主自交，已确认开放' },
  { area: '第一片区', id: '49', flower: '100', evening: '已完成：绿线套袋', morning: '已完成：自主自交，已确认开放' },
  { area: '第一片区', id: '56', recordType: 'plant', flower: '', evening: '不处理', morning: '测量：主蔓长度、茎直径、现存真叶数、分枝数' }
] };
const fixtureSummary = validateConfig(fixture, layout);
const fixtureDocument = document.replace(embedded(currentTasks), embedded(fixture));
const expiredFixture = { ...fixture, date: '2000-10-27', label: '10月26日晚／10月27日早 · 仅展示已录入盆位的8/8株' };
const expiredDocument = document.replace(embedded(currentTasks), embedded(expiredFixture));
const revisedFixture={...fixture,tasks:fixture.tasks.map(t=>t.id==='59'?{...t,morning:t.morning+'；增加套袋检查'}:t)};
const revisedDocument=document.replace(embedded(currentTasks),embedded(revisedFixture));
const suffixFixture={date:'2026-10-27',label:'10月26日晚／10月27日早 · 仅展示已录入盆位的3/3株',tasks:[
  {area:'第二片区',id:'868（2）',flower:'1',flowerId:'868（2）-B1',evening:'红线；去雄；套袋',morning:'接868花粉（父本第1朵）；套袋'},
  {area:'第二片区',id:'868',flower:'1',flowerId:'868-Z1',evening:'不处理',morning:'给868（2）供粉（母本第1朵）'},
  {area:'第一片区',id:'56',flower:'99',flowerId:'56-Z99',evening:'红线；去雄；套袋',morning:'接868（2）花粉（父本第2朵）；套袋'},
  {area:'第二片区',id:'868(2)',flower:'2',flowerId:'868(2)-B2',evening:'不处理',morning:'给56供粉（母本第99朵）'}
]};
assert.equal(validateConfig(suffixFixture,layout).crosses,2,'括号编号作父本和母本时必须完整配对，不能匹配成868');
assert.throws(()=>validateConfig({...suffixFixture,tasks:[...suffixFixture.tasks,{...suffixFixture.tasks[0],id:'868(2)'}]},layout),/任务重复/,'同一括号编号的全角半角不可重复');
const suffixDocument=document.replace(embedded(currentTasks),embedded(suffixFixture));
assert.notEqual(fixtureDocument, document);
assert.equal(fixtureSummary.crosses, 2, '一父两母的两个关系必须分别保留');
assert.equal(needsAction('不处理（不套袋，不去雄）'), false);
assert.equal(needsAction('已完成：接157花粉；重新套袋'), false);
assert.throws(() => validateConfig({ ...fixture, tasks: fixture.tasks.filter(t => t.id !== '157') }, layout), /双方|一致/);
(async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(req.url.startsWith('/suffix') ? suffixDocument : req.url.startsWith('/revised') ? revisedDocument : req.url.startsWith('/expired') ? expiredDocument : req.url.startsWith('/fixture') ? fixtureDocument : document); });
  await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  let browser, fallback;
  const errors = [], tests = [];
  try {
    const executablePath = process.env.CHROME_PATH || 'C:/Program Files/Google/Chrome/Application/chrome.exe';
    browser = await chromium.launch({ headless: true, executablePath, args: ['--enable-unsafe-swiftshader'] });
    const page = await browser.newPage({ viewport: { width: 1024, height: 1100 }, acceptDownloads: true });
    if (currentTasks.date) await page.clock.install({ time: new Date(currentTasks.date + 'T08:00:00+08:00') });
    page.on('pageerror', error => errors.push(error.message));
    page.on('console', message => { if (message.type() === 'error' || message.type() === 'warning') console.log(message.type() + ': ' + message.text().slice(0, 300)); });
    const url = 'http://127.0.0.1:' + server.address().port + '/';
    await page.goto(url); const frame = page.frameLocator('iframe'), app = frame.locator('#plant-field-3d');
    await frame.locator('.pf-label[data-id="56"]').waitFor({ state: 'visible' });
    assert.equal(await app.getAttribute('data-pots'), String(layout.size+placeholderCount));
    assert.equal(await app.getAttribute('data-confirmed-plants'),String(layout.size));
    assert.equal(await app.getAttribute('data-middle-slots'),'28');
    assert.equal(await app.getAttribute('data-pending-identifiers'),String(placeholderCount));
    assert.equal(await app.getAttribute('data-middle-rows'),'8,10,10');
    assert.equal(await app.getAttribute('data-left-rows'),'10,9,8');
    assert.equal(await app.getAttribute('data-outer-untrained-row'),'excluded');
    assert.equal(await app.getAttribute('data-bay-length-meters'),'1.66');
    assert.equal(await app.getAttribute('data-middle-length-meters'),'2.17');
    assert.equal(await app.getAttribute('data-left-length-meters'),'1.6');
    assert(Math.abs(Number(await app.getAttribute('data-length-ratio'))-2.17/1.66)<1e-12);
    assert.equal(await frame.locator('.pf-label').count(),layout.size,'待确认项不产生虚构编号');
    await frame.locator('#pf-phase').selectOption('morning');
    const realOrder=await frame.locator('.pf-task-row').evaluateAll(rows=>rows.filter(r=>r.dataset.done!=='true').map(r=>r.dataset.taskKey.match(/\|(\d+(?:\(\d+\))?)#/)[1]));
    const realCoords=await Promise.all(realOrder.map(id=>frame.locator(`.pf-label[data-id="${id}"]`).evaluate(el=>({x:+el.dataset.x,z:+el.dataset.z}))));
    for(let i=1;i<realCoords.length;i++){const prev=realCoords[i-1],next=realCoords[i],prevZone=prev.z< -10?1:0,nextZone=next.z< -10?1:0;assert(prevZone<=nextZone,'二区任务应在一区之后');if(prevZone===nextZone)assert(prevZone===0?prev.x>=next.x:prev.x<=next.x,'一区从右到左、二区从左到右');}
    assert.equal(await frame.locator('#pf-left-length,#pf-middle-length,#pf-bay-length').count(),0,'比例保留在几何中，不画尺寸文字或尺寸线');
    assert.equal(await app.getAttribute('data-dimension-annotations'),'hidden');
    assert.equal(await app.getAttribute('data-pot-scale'),'0.86');
    assert.equal(await app.getAttribute('data-label-layout'),'fixed-anchors-task-first');
    assert.equal(await app.getAttribute('data-label-scope'),'tasks');
    assert.equal(await app.getAttribute('data-feedback-mode'),'manual-copy-no-cloud');
    assert(!source.includes('dimensionZ'),'不再画尺寸线');
    const coord=async id=>frame.locator(`.pf-label[data-id="${id}"]`).evaluate(el=>({x:+el.dataset.x,z:+el.dataset.z,row:+el.dataset.row,section:el.dataset.section,note:el.dataset.note}));
    const inner=await coord('210'),outer=await coord('968');assert.equal(inner.row,1);assert.equal(outer.row,1);assert(Math.abs(inner.x-outer.x)<1e-12);assert(inner.z<outer.z);assert.match(inner.note,/靠内/);assert.match(outer.note,/靠外/);
    const triangle1322=await coord('1322'),triangle1358=await coord('1358'),triangle897=await coord('897');assert(triangle1322.x<triangle897.x&&triangle897.x<triangle1358.x&&triangle897.z>triangle1322.z&&triangle897.z>triangle1358.z,'897在两盆之间外侧呈三角');
    const adjacent294=await coord('294');assert(adjacent294.x<inner.x&&inner.x-adjacent294.x<1,'294在210左侧紧邻');assert(Math.abs(adjacent294.z-inner.z)<1e-12,'294与210同为靠内');
    const aligned218=await coord('218'),aligned834=await coord('834');assert(Math.abs(aligned218.x-aligned834.x)<.03,'218 与 834 应沿垂直走廊方向对齐');
    const offset317=await coord('317'),offset1167=await coord('1167');assert(offset1167.x>offset317.x&&offset1167.z>offset317.z,'1167 位于 317 右前方而非平排');
    const confirmedTop=await Promise.all(['1299','346','281','1044','1118','1202','482','661','213','293','898','50','543'].map(coord));assert(confirmedTop.every((p,i)=>i===0||p.x>confirmedTop[i-1].x),'10月31日照片确认的最上排完整左右顺序');assert(confirmedTop.every(p=>p.row===3),'均为第三排');
    assert(confirmedTop[2].z>confirmedTop[3].z&&confirmedTop[4].z>confirmedTop[5].z&&confirmedTop[6].z>confirmedTop[7].z,'281/1044、1118/1202、482/661靠外靠内错列');
    assert.equal((await coord('1166')).section,'右侧有架区','1166仍保留原一区盆位，不按二区口误移动');
    const midTriangle=await Promise.all(['162','626','1138'].map(coord));assert(midTriangle.every(p=>p.row===2),'162/626/1138均在第二排');assert(midTriangle[0].x<midTriangle[2].x&&midTriangle[2].x<midTriangle[1].x&&midTriangle[2].z>midTriangle[0].z&&midTriangle[2].z>midTriangle[1].z,'1138在三角外侧，626最右');
    const lowestInner=await Promise.all(['1168','1145','76','1252','547','1322','1358','340','551','611','1137','738','884','1250','598','1367'].map(coord));const lowestOuter=await Promise.all(['1295','616','897','802','1155','644'].map(coord));
    assert(lowestInner.every((p,i)=>p.row===1&&(i===0||p.x>lowestInner[i-1].x)),'最低排内侧完整左右顺序');assert(lowestOuter.every((p,i)=>p.row===1&&(i===0||p.x>lowestOuter[i-1].x)),'最低排外侧完整左右顺序');assert(Math.min(...lowestOuter.map(p=>p.z))>Math.max(...lowestInner.map(p=>p.z)),'最低排外侧保持靠外，不压成直线');
    const rightSequence=await Promise.all(['546','183','229','959','297','1188','434'].map(coord));assert(rightSequence.every((p,i)=>i===0||p.x>rightSequence[i-1].x),'二区上排左右顺序');assert(rightSequence[2].z<rightSequence[3].z&&rightSequence[4].z<rightSequence[3].z&&rightSequence[5].z>rightSequence[4].z,'229/959/297/1188前后错位');
    assert(Math.abs((await coord('1016')).x-(await coord('434')).x)<.01,'1016与434上下对齐');
    const left1169=await coord('1169'),suffix868=await coord('868(2)'),right647=await coord('647');assert(left1169.x<suffix868.x&&suffix868.x<right647.x,'868（2）在1169右侧、647左侧');assert(suffix868.x-left1169.x>right647.x-suffix868.x,'868（2）和1169之间保留空位');
    const middleLow=await Promise.all(['163','646','330','159','550','208','416','794'].map(coord));
    assert(middleLow[3].x-middleLow[2].x>(middleLow[1].x-middleLow[0].x)*1.8,'330与159间须保留空档');
    assert(middleLow.every(p=>p.z===middleLow[0].z),'中间区最低排仅一行');
    const leftGap=await Promise.all(['317','210','215','402'].map(coord));assert(leftGap[1].x-leftGap[0].x>2);assert(leftGap[3].x-leftGap[2].x>1.3);
    tests.push('一区新增实测比例、两片区位置、218/834 对齐、1167 错位、补充近邻顺序及编号去重');
    assert.equal(await app.getAttribute('data-renderer'), 'webgl');
    assert.equal(await frame.locator('#pf-import-toggle').isVisible(), false);
    const initialPhase=await frame.locator('#pf-phase').inputValue();
    assert.equal(await frame.locator('#pf-task-legend').isVisible(),currentTasks.tasks.some(t=>needsAction(t[initialPhase])));
    assert((await frame.locator('#pf-source').textContent()).includes(currentTasks.label));
    if (currentTasks.date) {
      const labels = periodLabels(currentTasks.date);
      assert.equal(await app.getAttribute('data-batch-date'), currentTasks.date);
      assert.equal(await app.getAttribute('data-task-plants'), String(taskSummary.plants));
      assert.equal(await app.getAttribute('data-pairs'), String(taskSummary.crosses));
      for (const phase of ['evening', 'morning']) {
        await frame.locator('#pf-phase').selectOption(phase);
        assert.equal(await frame.locator('#pf-phase option:checked').innerText(),labels[phase].replace(/晚$/,' 授粉前处理').replace(/早$/,' 授粉处理'));
        assert.equal(await app.getAttribute('data-active-tasks'), String(taskSummary.active[phase]));
        for (const id of new Set(currentTasks.tasks.map(t => t.id))) {
          const active = currentTasks.tasks.some(t => t.id === id && needsAction(t[phase]));
          assert.equal(await frame.locator(`.pf-label[data-id="${id}"]`).getAttribute('data-task-active'), String(active));
        }
      }
      if (currentTasks.tasks.some(t => /父本盆位未录入/.test(t.morning))) {
        const mother = currentTasks.tasks.find(t => /父本盆位未录入/.test(t.morning));
        await frame.locator('#pf-search').fill(mother.id); await frame.locator('#pf-search').press('Enter');
        const donor=mother.morning.match(/接\s*(\d+)\s*花粉/)[1];
        if(layout.has(donor)){
          assert.match(await frame.locator('.pf-task-row').filter({has:frame.locator('.pf-task-code',{hasText:mother.id+'-'})}).locator('.pf-task-original').first().textContent(),/父本第\d+朵.*父本已定位/);
          assert.match(await frame.locator('#pf-task-list').textContent(),/供粉条目待同步/);
          assert.equal(await frame.locator(`.pf-label[data-id="${donor}"]`).count(),1);
          assert(!currentTasks.tasks.some(t=>t.id===donor),'新增盆位不能冒造供粉任务');
        }else{
          assert.match(await frame.locator('#pf-task-list').textContent(), /父本第\d+朵.*父本盆位未录入/);
          assert.equal(await frame.locator('#pf-pairtag').isVisible(), false, '未定位亲本不得虚构盆位连线');
        }
        await frame.locator('#pf-search').fill(''); await frame.locator('#pf-search').press('Enter');
      }
      tests.push('real embedded batch; explicit Beijing dates; phase-specific pending actions; completed preparation inactive; unlocated partner disclosed');
    }
    if(currentTasks.date&&currentTasks.tasks.length&&taskSummary.active.evening===0){
      const pre = await browser.newPage({viewport:{width:390,height:900}});
      await pre.clock.install({time:new Date(+new Date(currentTasks.date+'T00:00:00+08:00')-3600000)});
      await pre.goto(url);
      const pf=pre.frameLocator('iframe');
      await pf.locator('#plant-field-3d').waitFor();
      assert.equal(await pf.locator('#pf-phase').inputValue(),'morning','晚间任务全部完成时应提前展示次日早晨待办');
      assert.equal(await pf.locator('#plant-field-3d').getAttribute('data-active-tasks'),String(taskSummary.active.morning));
      await pre.close();tests.push('evening-complete batch defaults to upcoming morning');
    }
    const cameraState = () => app.evaluate(el => ({ x: Number(el.dataset.cameraX), z: Number(el.dataset.cameraZ), pitch: Number(el.dataset.cameraPitch), yaw: Number(el.dataset.cameraYaw), distance: Number(el.dataset.cameraDistance), eye: el.dataset.cameraEye.split(',').map(Number), target: el.dataset.cameraTarget.split(',').map(Number) }));
    const near = (a, b, message) => assert(Math.abs(a - b) < .0001, message || `${a} != ${b}`);
    const vector = s => s.eye.map((n, i) => n - s.target[i]);
    const dragBy = async (dx, dy) => {
      const b = await frame.locator('#pf-canvas').boundingBox();
      const x = b.x + b.width * .5, y = b.y + b.height * .35;
      await page.mouse.move(x, y); await page.mouse.down(); await page.mouse.move(x + dx, y + dy, { steps: 8 }); await page.mouse.up(); await page.waitForTimeout(60);
    };
    assert.equal(await app.getAttribute('data-navigation'), 'pan-tilt');
    assert.equal(await app.getAttribute('data-pitch-axis'), '1,0,0');
    const start = await cameraState();
    const initialSides=await frame.locator('.pf-label').evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.dataset.id,el.dataset.labelSide])));
    await dragBy(120, 0); const pan = await cameraState();
    assert.deepEqual(await frame.locator('.pf-label').evaluateAll(nodes=>Object.fromEntries(nodes.map(el=>[el.dataset.id,el.dataset.labelSide]))),initialSides,'平移不改变编号锚定的上下位置');
    assert(pan.x < start.x - .5, '横拖应平移摄像机，不绕盆位转动');
    near(pan.pitch, start.pitch); near(pan.yaw, start.yaw); near(pan.z, start.z); near(pan.distance, start.distance);
    vector(pan).forEach((n, i) => near(n, vector(start)[i], '平移不能改变观察方向'));
    await page.screenshot({ path: path.join(out, 'horizontal-pan.png'), fullPage: true });
    await dragBy(0, 48); const tilt = await cameraState();
    if(Math.abs(tilt.distance-pan.distance)>.001){console.log(JSON.stringify({start,pan,tilt,resize:await app.getAttribute('data-distance-resize'),stage:await frame.locator('#pf-canvas').boundingBox()}));await page.screenshot({path:path.join(out,'gesture-error.png'),fullPage:true});}
    near(tilt.x, pan.x); near(tilt.z, pan.z); near(tilt.distance, pan.distance); assert(tilt.pitch > pan.pitch + .1);
    near(tilt.eye[0], pan.eye[0]); tilt.target.forEach((n, i) => near(n, pan.target[i]));
    near(Math.hypot(...vector(tilt)), Math.hypot(...vector(pan)), '俯仰须绕固定平行轴，不改变距离');
    await page.screenshot({ path: path.join(out, 'vertical-tilt.png'), fullPage: true });
    // First movement is horizontal, then becomes diagonal: retain the chosen mode.
    await dragBy(-100, 15); const diagonal = await cameraState(); near(diagonal.pitch, tilt.pitch);
    const b = await frame.locator('#pf-canvas').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + 80); await page.mouse.wheel(0, 100); await page.waitForTimeout(60);
    const zoom = await cameraState(); assert(zoom.distance > diagonal.distance); near(zoom.pitch, diagonal.pitch); near(zoom.x, diagonal.x);
    await frame.locator('#pf-home').click(); await page.waitForTimeout(750); const home = await cameraState(); near(home.x, (geometry.gap3Span.left+geometry.baySpan.right)/2); near(home.pitch, .85);
    await frame.locator('#pf-stage').evaluate(el=>el.style.width='1px');await page.waitForTimeout(30);await frame.locator('#pf-stage').evaluate(el=>el.style.width='');await page.waitForTimeout(60);near((await cameraState()).distance,home.distance,'临时折叠尺寸不能改变镜头距离');
    await frame.locator('[data-focus="middle"]').click();await page.waitForTimeout(650);const focused=await cameraState();assert(focused.distance<home.distance,'分段聚焦应放大');near(focused.x,(geometry.gap3Span.left+geometry.baySpan.right)/2);await frame.locator('#pf-home').click();await page.waitForTimeout(750);
    tests.push('horizontal camera translation preserves orientation; vertical pitch axis parallel to steps; direction lock; wheel zoom; reset');
    for (const width of [320, 360, 736, 1024]) {
      await page.setViewportSize({ width, height: 1100 }); await page.waitForTimeout(120);
      const size = await app.evaluate(el => ({ width: el.clientWidth, content: el.scrollWidth }));
      assert(size.content <= size.width + 1, '横向溢出：' + width);
      if(width<=480){
        assert.equal(await frame.locator('#pf-export').innerText(),'存图');
        assert.equal(await frame.locator('button[data-zone="0"]').innerText(),'一区');
        assert.equal(await frame.locator('#pf-data-details').getAttribute('open'),null);
        assert.equal(await frame.locator('#pf-source').isVisible(),false,'完整批次说明默认折叠');
        assert((await frame.locator('#pf-batch-summary').innerText()).length<50);
        assert.equal(await app.getAttribute('data-label-mode'),'compact-chip-with-touch-target');
      }
      await page.screenshot({ path: path.join(out, 'width-' + width + '.png'), fullPage: true });
    }
    const noTaskId=[...layout.keys()].find(id=>!currentTasks.tasks.some(t=>t.id===id));
    assert(noTaskId,'需有无任务盆位用于隔离显示测试');
    await frame.locator('#pf-search').fill(noTaskId); await frame.locator('#pf-search').press('Enter');
    assert.equal(await frame.locator('#pf-detail').innerText(),noTaskId,'无任务的选中盆只显示编号');
    assert.equal(await frame.locator('.pf-label.pf-dim').count(), 0);
    await frame.locator('#pf-export').click();
    const png = await frame.locator('#pf-export-image').getAttribute('src');
    const image = Buffer.from(png.split(',')[1], 'base64');
    assert.equal(image.subarray(0, 8).toString('hex'), '89504e470d0a1a0a');
    assert(image.readUInt32BE(16) > 600 && image.readUInt32BE(20) > 600);
    fs.writeFileSync(path.join(out, 'exported.png'), image);
    assert.match(await frame.locator('#pf-export-download').getAttribute('href'), /^blob:/);
    const downloadPromise = page.waitForEvent('download', { timeout: 10000 }); await frame.locator('#pf-export-download').click();
    const download = await downloadPromise; await download.saveAs(path.join(out, 'downloaded.png'));
    assert(fs.statSync(path.join(out, 'downloaded.png')).size > 10000);
    await frame.locator('#pf-export-close').click();
    await page.emulateMedia({ reducedMotion: 'reduce' }); await frame.locator('[data-zone="1"]').click();
    await frame.locator('.pf-label[data-id="56"]').waitFor({ state: 'hidden' });
    assert.doesNotMatch(await frame.locator('#pf-zoneinfo').innerText(), /盆位待录入/);
    await frame.locator('#pf-search').fill('1068');await frame.locator('#pf-search').press('Enter');
    assert.equal(await app.getAttribute('data-zone'),'1');
    assert.equal(await frame.locator('.pf-label[data-id="1068"]').isVisible(),true,'二区搜索需定位目标盆');
    assert.equal(await frame.locator('#pf-detail').innerText(),'1068');
    tests.push('二区真实盆位和跨片区搜索；320-1024 响应式、PNG 导出及真实任务保持');
    const context = await browser.newContext({ viewport: { width: 360, height: 1000 }, isMobile: true, hasTouch: true });
    const mobile = await context.newPage(); mobile.on('pageerror', error => errors.push(error.message));
    await mobile.goto(url); const mf = mobile.frameLocator('iframe'); await mf.locator('#pf-search').fill('207'); await mf.locator('#pf-search').press('Enter');
    const touchSession = await context.newCDPSession(mobile);
    const mc = mf.locator('#plant-field-3d'); const touchCamera = () => mc.evaluate(el => ({ x: Number(el.dataset.cameraX), pitch: Number(el.dataset.cameraPitch), distance: Number(el.dataset.cameraDistance) }));
    const chipMetrics=await mf.locator('.pf-label:visible').evaluateAll(nodes=>nodes.map(el=>{
      const chip=el.querySelector('.pf-label-chip'),style=getComputedStyle(chip);
      return {id:el.dataset.id,hit:el.getBoundingClientRect().toJSON(),chip:chip.getBoundingClientRect().toJSON(),font:parseFloat(style.fontSize),background:getComputedStyle(el).backgroundColor};
    }));
    assert(chipMetrics.length>0);
    const mobileOffsets=await mf.locator('.pf-label:visible').evaluateAll(nodes=>nodes.map(el=>Number(el.dataset.labelOffset)));
    assert(mobileOffsets.every(n=>Math.abs(n)>10),'标签须位于盆的上方或下方');
    const assignedSides=await mf.locator('.pf-label').evaluateAll(nodes=>nodes.map(el=>el.dataset.labelSide));
    assert(assignedSides.includes('above')&&assignedSides.includes('below'),'所有盆的固定锚点须上下交错分配');
    const labelSides=await mf.locator('.pf-label:visible').evaluateAll(nodes=>nodes.map(el=>el.dataset.labelSide));
    assert(labelSides.every(side=>side==='above'||side==='below'),'只保留上方和下方两种位置');
    assert.equal(await mf.locator('#pf-label-guides').count(),0,'不绘制编号引线');
    assert(!source.includes('guides.push')&&!source.includes('guideLayer'),'不残留引线绘制代码');
    for(const metric of chipMetrics){
      assert(metric.hit.width>=44&&metric.hit.height>=44,'点击区不随小标签缩小');
      assert(metric.chip.height>=20&&metric.chip.height<=24,'手机可见编号框应紧凑');
      assert(metric.font>=11,'编号保持可读字号');
      assert.equal(metric.background,'rgba(0, 0, 0, 0)','大点击区必须透明');
    }
    for(let i=0;i<chipMetrics.length;i++)for(let j=i+1;j<chipMetrics.length;j++){
      const a=chipMetrics[i].hit,b=chipMetrics[j].hit;
      assert(!(a.x<b.right&&a.right>b.x&&a.y<b.bottom&&a.bottom>b.y),'可见编号的点击区不重叠');
    }
    assert.equal(await mf.locator('.pf-label[data-id="207"]').isVisible(),true,'搜索命中应优先显示');
    for(const [id,section]of [['483','左架'],['210','左架'],['968','左架'],['1020','左架'],['163','中间区'],['834','中间区'],['1131','右架']]){
      await mf.locator('#pf-search').fill(id);await mf.locator('#pf-search').press('Enter');await mobile.waitForTimeout(40);
      if(!await mf.locator(`.pf-label[data-id="${id}"]`).isVisible())console.log(JSON.stringify(await mc.evaluate((el,id)=>({id,camera:el.dataset.cameraX,label:el.querySelector(`.pf-label[data-id="${id}"]`).outerHTML,annotations:[...el.querySelectorAll('.pf-annotation')].filter(n=>!n.hidden).map(n=>({text:n.textContent,rect:n.getBoundingClientRect().toJSON()}))}),id)));
      assert.equal(await mf.locator(`.pf-label[data-id="${id}"]`).isVisible(),true,'手机搜索边侧植株须移入可读范围：'+id);
      const expectedSection={'左架':'左侧有架区','中间区':'中间连接区','右架':'右侧有架区'}[section];
      assert.equal(await mf.locator(`.pf-label[data-id="${id}"]`).getAttribute('data-section'),expectedSection);
    }
    assert.equal(await mf.locator('.pf-label[data-id="130584"]').count(),0,'不能把粘连编号当成一个植株');
    await mf.locator('#pf-batch-summary').click();assert.equal(await mf.locator('#pf-source').isVisible(),true);
    assert((await mf.locator('#pf-source').innerText()).includes(currentTasks.label));
    await mf.locator('#pf-batch-summary').click();assert.equal(await mf.locator('#pf-source').isVisible(),false);
    // Keep the gesture fixture above the newly staggered labels so a label tap
    // is not mistaken for a canvas pinch.
    await mf.locator('#pf-canvas').scrollIntoViewIfNeeded();
    const mb = await mf.locator('#pf-canvas').boundingBox(), tx = mb.x + mb.width * .5, ty = mb.y + mb.height * .15;
    const touchStart = await touchCamera();
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx, y: ty, id: 0 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx + 65, y: ty, id: 0 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await mobile.waitForTimeout(60);
    const touchPan = await touchCamera(); assert(touchPan.x < touchStart.x); near(touchPan.pitch, touchStart.pitch);
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: tx - 30, y: ty, id: 0 }, { x: tx + 30, y: ty, id: 1 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: tx - 55, y: ty, id: 0 }, { x: tx + 55, y: ty, id: 1 }] });
    await touchSession.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] }); await mobile.waitForTimeout(60);
    const touchZoom = await touchCamera(); assert(touchZoom.distance < touchPan.distance); near(touchZoom.pitch, touchPan.pitch); near(touchZoom.x, touchPan.x);
    await mf.locator('#pf-home').click(); await mobile.waitForTimeout(750);
    tests.push('real touch pointer pan and two-finger pinch keep orientation and do not jump');
    tests.push('no visible dimensions; original scale and smaller pots intact; task-first labels with immutable above/below anchors; compact selected ID; mobile 44px non-overlapping targets; selected priority and readable numbers');
    await mf.locator('#pf-export').click(); assert.equal(await mf.locator('#pf-export-dialog').isVisible(), true);
    await mobile.screenshot({ path: path.join(out, 'mobile-export.png'), fullPage: true }); await context.close();
    fallback = await chromium.launch({ headless: true, executablePath, args: ['--disable-webgl'] });
    const fp = await fallback.newPage(); fp.on('pageerror', error => errors.push(error.message)); await fp.goto(url);
    assert.equal(await fp.frameLocator('iframe').locator('#plant-field-3d').getAttribute('data-renderer'), 'perspective-canvas');
    tests.push('touch search and PNG preview; no-WebGL fallback');
    const fixturePage = await browser.newPage({ viewport: { width: 1024, height: 1100 } });
    fixturePage.on('pageerror', error => errors.push(error.message));
    await fixturePage.clock.install({ time: new Date(fixture.date + 'T08:00:00+08:00') });
    await fixturePage.goto(url + 'fixture');
    const ff = fixturePage.frameLocator('iframe'), fa = ff.locator('#plant-field-3d');
    await ff.locator('.pf-label[data-id="56"]').waitFor({ state: 'visible' });
    assert.equal(await fa.getAttribute('data-pairs'), '2');
    for (const phase of ['evening', 'morning']) {
      await ff.locator('#pf-phase').selectOption(phase);
      assert.equal(await ff.locator('#pf-add-flower').innerText(),phase==='evening'?'＋ 添加新花苞':'＋ 添加新花朵');
      if(phase==='evening'){
        for(const id of ['157-B99','36-Z99']){const row=ff.locator('.pf-task-row[data-flower-id="'+id+'"]');assert.equal(await row.locator('.pf-task-short').innerText(),'不处理');assert.equal(await row.locator('.pf-task-done').isDisabled(),true);}
        for(const [id,text]of [['49-F99','红线 · 去雄套袋'],['59-F99','绿线 · 套袋'],['46-F99','黄线 · 套袋'],['56-Z99','白线 · 不套袋']])assert.equal(await ff.locator('.pf-task-row[data-flower-id="'+id+'"]').locator('.pf-task-short').innerText(),text,'前处理只显示短标签');
      }
      assert.equal(await fa.getAttribute('data-active-tasks'), String(fixtureSummary.active[phase]));
      assert.equal(await fa.getAttribute('data-active-pairs'), phase === 'morning' ? '2' : '0');
      assert.equal(await ff.locator('.pf-label[data-id="792"]').getAttribute('data-task-active'), String(phase === 'morning'));
      assert.equal(await ff.locator('.pf-label[data-id="157"]').getAttribute('data-task-active'), String(phase === 'morning'));
      assert.equal(await ff.locator('.pf-label[data-id="47"]').getAttribute('data-task-active'), 'false');
    }
    const expectedKinds = { '49': 'cross', '157': 'donor', '59': 'auto', '56': 'open', '36': 'measure', '46': 'hand' };
    const colors = {};
    for (const [id, kind] of Object.entries(expectedKinds)) {
      const label = ff.locator(`.pf-label[data-id="${id}"]`);
      assert.equal(await label.getAttribute('data-task-kind'), kind);
      assert.equal(await label.getAttribute('data-task-active'), 'true');
      colors[kind]=await label.evaluate(el => el.style.getPropertyValue('--task-color'));
    }
    assert.equal(colors.cross,colors.donor,'异交母本和父本均为红色');
    assert.equal(new Set(Object.values(colors)).size, 5, '异交共享红色，自交黄色，自主绿色，开放白色，测量紫色');
    assert.equal(colors.measure, 'rgb(195,175,232)', '测量标签为紫色');
    const crossColor = await ff.locator('.pf-label[data-id="49"]').evaluate(el => el.style.getPropertyValue('--task-color'));
    await ff.locator('#pf-search').fill('49'); await ff.locator('#pf-search').press('Enter');
    assert.equal(await ff.locator('.pf-label[data-id="49"]').evaluate(el => el.style.getPropertyValue('--task-color')), crossColor, '搜索定位不能覆盖处理色');
    assert.match(await ff.locator('#pf-detail').innerText(), /49-F99/);
    assert.match(await ff.locator('#pf-detail').innerText(), /49-F100/);
    await ff.locator('#pf-search').fill('49-F99');await ff.locator('#pf-search').press('Enter');
    assert.equal(await ff.locator('#pf-result-buttons button').count(),1,'短花号不能把花序当作另一个植株');
    assert.equal(await ff.locator('#pf-result-buttons button').innerText(),'49');
    const taskRow=id=>ff.locator('.pf-task-row[data-flower-id="'+id+'"]');
    await ff.locator('#pf-search').fill('157');await ff.locator('#pf-search').press('Enter');assert.equal(await fa.getAttribute('data-rendered-pair-count'),'2','选择一花供两朵的父本时须同时画两条箭头');const renderedArrows=JSON.parse(await fa.getAttribute('data-rendered-pair-arrows'));assert.deepEqual(renderedArrows.map(p=>p.mother).sort(),['49','792']);assert(renderedArrows.every(p=>p.donor==='157'&&String(p.donorFlower)==='99'));assert.equal(await ff.locator('#pf-detail .pf-partner').count(),2);assert.equal(await ff.locator('.pf-label.pf-related[data-id="792"]').count(),1);await ff.locator('#pf-stage').screenshot({path:path.join(out,'two-arrows-desktop.png')});await ff.locator('#pf-search').fill('49');await ff.locator('#pf-search').press('Enter');assert.equal(await fa.getAttribute('data-rendered-pair-count'),'2','选择其中一个母本也保留同一父花的另一个目标');
    const donorPanel=taskRow('157-B99').locator('.pf-recipient-list');assert.equal(await donorPanel.getAttribute('data-recipient-count'),'2');assert.match(await donorPanel.innerText(),/49第99朵/);assert.match(await donorPanel.innerText(),/792第99朵/);assert.equal(await taskRow('157-B99').locator('.pf-task-done').innerText(),'2朵均完成');
    assert.equal(await ff.locator('#pf-label-mode').count(),0,'不显示全部/待办切换');
    const initialRows=await ff.locator('.pf-task-row').evaluateAll(rows=>rows.filter(r=>r.dataset.done!=='true').map(r=>r.dataset.taskKey));
    const coordOf=async key=>{const id=key.match(/\|(\d+)#/)[1];return ff.locator(`.pf-label[data-id="${id}"]`).evaluate(el=>({x:+el.dataset.x,section:el.dataset.section}));};
    const initialCoords=await Promise.all(initialRows.map(coordOf));
    assert(initialCoords.every((p,i)=>i===0||initialCoords[i-1].x>=p.x),'一区待办按从右向左排序');
    await taskRow('59-F99').locator('.pf-task-done').click();
    assert.equal(await taskRow('59-F99').getAttribute('data-done'),'true');
    assert.equal((await ff.locator('.pf-task-row').last().getAttribute('data-flower-id')),'59-F99','完成后移动到列表底部');
    await ff.locator('#pf-phase').selectOption('evening');assert.equal(await taskRow('59-F99').getAttribute('data-done'),'false','晚间和早晨完成状态独立');await ff.locator('#pf-general-note').fill('前处理总备注测试');assert(await ff.locator('#pf-add-flower').evaluate(el=>!!(el.compareDocumentPosition(document.getElementById('pf-task-list'))&Node.DOCUMENT_POSITION_FOLLOWING)),'添加按钮位于清单顶部');await ff.locator('#pf-add-flower').click();const draftBud=ff.locator('#pf-new-draft');assert.equal(await draftBud.locator('input[type="number"]').count(),0,'新花苞不显示测量字段');assert.deepEqual(await draftBud.locator('select option').allTextContents(),['请选择处理','红线 · 去雄套袋','黄线 · 只套袋','绿线 · 只套袋','白线 · 不套袋','不处理','其他']);await draftBud.locator('[aria-label="新花苞植株编号"]').fill('59');await draftBud.locator('[aria-label="新花苞花号（可暂空）"]').fill('59-F101');await draftBud.locator('[aria-label="新花苞实际处理"]').selectOption('不去雄、套袋、绿线');await draftBud.getByRole('button',{name:'添加到清单'}).click();const newBud=ff.locator('#pf-new-flowers .pf-new-row').last();assert.match(await newBud.locator('.pf-task-code').innerText(),/59-F101/);assert.match(await newBud.locator('.pf-task-short').innerText(),/绿线 · 只套袋/);assert.equal(await newBud.locator('details').getAttribute('open'),null);await taskRow('59-F99').locator('.pf-task-done').click();assert.equal(await newBud.locator('details').getAttribute('open'),null,'操作原清单后新增条目不会自动展开');
    await ff.locator('#pf-phase').selectOption('morning');assert.equal(await taskRow('59-F99').getAttribute('data-done'),'true');assert.equal(await ff.locator('#pf-general-note').inputValue(),'');assert.equal(await ff.locator('[aria-label="新花苞植株编号"]').count(),0);await ff.locator('#pf-general-note').fill('授粉处理总备注测试');
    await taskRow('49-F99').locator('summary').click();
    await taskRow('49-F99').locator('select').selectOption('其他');
    await taskRow('49-F99').locator('textarea').fill('父本花药未裂，改为观察；尚未确认受精');
    await taskRow('49-F99').locator('input[aria-label="49-F99本朵花冠横径（mm）"]').fill('50.2');
    await taskRow('49-F99').locator('input[aria-label="49-F99本朵花冠纵径（mm）"]').fill('51.1');
    assert.equal(await taskRow('49-F99').locator('input[type="date"]').count(),0);
    assert.equal(await taskRow('49-F99').locator('input[aria-label="49-F99处理人"]').count(),0);
    assert.equal(await taskRow('49-F99').locator('.pf-task-editor button').count(),0,'输入自动保存，无保存按钮');
    assert.match(await taskRow('49-F99').locator('.pf-task-original').first().textContent(),/接157花粉/,'原计划保持不变');
    await fixturePage.setViewportSize({width:360,height:1000});
    await taskRow('157-B99').screenshot({path:path.join(out,'two-recipient-mobile.png')});assert(await taskRow('157-B99').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'双母花提示不应导致手机横向溢出');
    await taskRow('49-F99').locator('.pf-task-editor').screenshot({path:path.join(out,'task-editor-mobile.png')});
    await taskRow('36-Z99').locator('summary').click();
    await taskRow('36-Z99').locator('input[aria-label="36-Z99本朵花冠横径（mm）"]').fill('48');
    await taskRow('56 · 植株').locator('summary').click();
    await taskRow('56 · 植株').locator('input[aria-label="56 · 植株植株茎长（mm）"]').fill('321');
    await taskRow('56 · 植株').locator('input[aria-label="56 · 植株植株现存真叶数"]').fill('0');
    await ff.locator('#pf-search').fill('49');await ff.locator('#pf-search').press('Enter');
    await ff.locator('[data-detail-task="2026-10-27|49#99|morning"]').click();
    assert.equal(await taskRow('49-F99').getAttribute('data-done'),'true','盆栽详情可直接完成对应花朵');
    assert.equal((await ff.locator('.pf-task-row').last().getAttribute('data-flower-id')),'49-F99','最新完成条目应移动到最后');
    await ff.locator('#pf-add-flower').click();const draftFlower=ff.locator('#pf-new-draft');await draftFlower.locator('[aria-label="新花朵植株编号"]').fill('868（2）');await draftFlower.locator('[aria-label="新花朵花号（可暂空）"]').fill('868（2）-Z8');await draftFlower.locator('[aria-label="新花朵实际处理"]').selectOption('花药未开裂');await draftFlower.locator('[aria-label="新花朵植株上的位置（选填）"]').fill('侧枝');await draftFlower.locator('[aria-label="新花朵备注"]').fill('暂未授粉');await draftFlower.getByRole('button',{name:'添加到清单'}).click();const newFlower=ff.locator('#pf-new-flowers .pf-new-row').last();assert.equal(await newFlower.locator('.pf-task-code').innerText(),'868（2）-Z8');assert.equal(await newFlower.locator('details').getAttribute('open'),null);assert(await ff.locator('#pf-new-flowers').evaluate(el=>!!(document.getElementById('pf-task-list').compareDocumentPosition(el)&Node.DOCUMENT_POSITION_FOLLOWING)),'新增条目位于原清单之后');
    await fixturePage.context().grantPermissions(['clipboard-read','clipboard-write'],{origin:url});
    await ff.locator('#pf-copy-feedback').click();
    const feedbackOutput=await ff.locator('#pf-feedback-text').inputValue();
    assert.match(feedbackOutput,/59-F99/);assert.match(feedbackOutput,/其他/);assert.match(feedbackOutput,/花冠 50.2×51.1 mm/);assert.match(feedbackOutput,/2026-10-26 授粉前处理/);assert.match(feedbackOutput,/2026-10-27 授粉处理/);assert.match(feedbackOutput,/59-F101：不去雄、套袋、绿线/);assert.match(feedbackOutput,/总备注：前处理总备注测试/);assert.match(feedbackOutput,/总备注：授粉处理总备注测试/);assert.match(feedbackOutput,/56 · 植株/);assert.match(feedbackOutput,/植株茎长 321 mm/);assert.match(feedbackOutput,/植株真叶数 0/);assert.match(feedbackOutput,/868（2）-Z8：花药未开裂；位置：侧枝；暂未授粉/);assert.doesNotMatch(feedbackOutput,/执行人|处理人|网页勾选|设备生成时间|原计划|未填写/);
    await fixturePage.waitForTimeout(120);
    assert.equal((await fixturePage.evaluate(()=>navigator.clipboard.readText())).replace(/\r\n/g,'\n'),feedbackOutput,'复制输出与显示文本一致（忽略系统换行符）');
    assert.match(feedbackOutput,/36-Z99/);assert.match(feedbackOutput,/花冠横径 48 mm/,'无需保存按钮即可复制');
    fs.writeFileSync(path.join(out,'feedback-example.txt'),feedbackOutput);
    await ff.locator('#pf-feedback-dialog').screenshot({path:path.join(out,'feedback-copy-dialog.png')});
    await fixturePage.screenshot({path:path.join(out,'feedback-copy.png'),fullPage:false});
    await fixturePage.evaluate(()=>Object.defineProperty(Clipboard.prototype,'writeText',{configurable:true,value:async()=>{throw new Error('Clipboard disabled in test');}}));
    await ff.locator('#pf-feedback-recopy').click();
    await ff.locator('#pf-copy-status').filter({hasText:'手动复制'}).waitFor({timeout:3000});assert.equal(await ff.locator('#pf-feedback-text').inputValue(),feedbackOutput,'剪贴板不可用时保留人工复制路径');
    await ff.locator('#pf-feedback-close').click();
    await fixturePage.reload();await ff.locator('#pf-task-list').waitFor();await fixturePage.waitForTimeout(100);
    assert.equal(await ff.locator('#pf-operator').count(),0,'不显示执行人');assert.equal(await ff.locator('[aria-label="新花朵花号（可暂空）"]').first().inputValue(),'868（2）-Z8','新花记录刷新保留');assert.equal(await ff.locator('#pf-new-flowers details[open]').count(),0,'刷新后新增条目保持收起');
    assert.equal(await ff.locator('#pf-general-note').inputValue(),'授粉处理总备注测试');await ff.locator('#pf-phase').selectOption('evening');assert.equal(await ff.locator('#pf-general-note').inputValue(),'前处理总备注测试');assert.equal(await ff.locator('[aria-label="新花苞花号（可暂空）"]').inputValue(),'59-F101');await ff.locator('#pf-phase').selectOption('morning');
    assert.equal(await taskRow('59-F99').getAttribute('data-done'),'true','当前浏览器刷新保留勾选');
    assert.match(await taskRow('49-F99').locator('summary').innerText(),/实际：其他/);
    await taskRow('49-F99').locator('summary').click();assert.equal(await taskRow('49-F99').locator('input[aria-label="49-F99本朵花冠横径（mm）"]').inputValue(),'50.2','数值自动保存且刷新后恢复');
    await fixturePage.goto(url+'revised');await ff.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor({timeout:3000});await ff.locator('#pf-phase').selectOption('morning');
    if(!(await taskRow('59-F99').locator('summary').innerText()).includes('计划有更新'))console.log(JSON.stringify({phase:await ff.locator('#pf-phase').inputValue(),loaded:await fa.getAttribute('data-feedback-loaded'),plan:await taskRow('59-F99').locator('.pf-task-original').first().textContent(),saved:await fixturePage.evaluate(()=>{const entries=JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}');return Object.fromEntries(Object.entries(entries).filter(([key])=>key.includes('|59#99|')));})}));
    assert.match(await taskRow('59-F99').locator('summary').innerText(),/计划有更新/);assert.equal(await taskRow('59-F99').locator('.pf-task-done').isDisabled(),true,'计划变化须核对旧勾选');
    tests.push('short flower IDs; copied structured feedback and clipboard; completion/notes/measurements/actual time; original plans immutable; phase-separated local persistence; changed-plan conflict protection; no cloud or AI');
    await fixturePage.goto(url + 'expired');
    await ff.locator('#pf-task-list').waitFor({ state: 'visible' });
    await ff.locator('#pf-phase').selectOption('evening');
    assert.equal(await fa.getAttribute('data-batch-expired'), 'true');
    assert.equal(await fa.getAttribute('data-active-tasks'), '0');
    assert.equal(await fa.getAttribute('data-active-pairs'), '0');
    assert.match(await ff.locator('#pf-source').textContent(), /历史批次，不作为今日待办/);
    tests.push('isolated six-color fixture; one father two mothers; multiple flowers; no-op/completed inactive; search color independent; expired batch not pending');
    await fixturePage.close();
    const legacyContext=await browser.newContext({viewport:{width:360,height:1000}}),legacyPage=await legacyContext.newPage();
    await legacyPage.clock.install({time:new Date(fixture.date+'T08:00:00+08:00')});await legacyPage.goto(url+'fixture');
    await legacyPage.evaluate(plan=>localStorage.setItem('plant-field-feedback-v1',JSON.stringify({'2026-10-27|49#99|morning':{plan,done:false,note:'旧备注',measurements:'旧记录：横径49 mm',operatedAt:'2026-10-27T07:45',actual:'其他',updatedAt:'2026-10-27T00:01:00.000Z'},'2026-10-27|new-legacy|evening':{plan:'',newFlower:true,id:'59',flowerId:'59-F101',metrics:{stemLength:'123',corolla1:'50'},note:'旧花苞记录',updatedAt:'2026-10-27T00:01:00.000Z'}})),fixture.tasks.find(t=>t.id==='49'&&t.flower==='99').morning);
    await legacyPage.reload();const lf=legacyPage.frameLocator('iframe');await lf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await lf.locator('#pf-phase').selectOption('evening');const oldBud=lf.locator('#pf-new-flowers details').first();await oldBud.locator('summary').click();assert.equal(await oldBud.locator('input[type="number"]').count(),0);await oldBud.locator('[aria-label="新花苞备注"]').fill('旧花苞记录已补充');await legacyPage.waitForFunction(()=>JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}')['2026-10-27|new-legacy|evening']?.note==='旧花苞记录已补充');const oldMetrics=await legacyPage.evaluate(()=>JSON.parse(localStorage.getItem('plant-field-feedback-v1'))['2026-10-27|new-legacy|evening'].metrics);assert.equal(oldMetrics.stemLength,'123');assert.equal(oldMetrics.corolla1,'50');await lf.locator('#pf-phase').selectOption('morning');
    const legacyRow=lf.locator('.pf-task-row[data-flower-id="49-F99"]');await legacyRow.locator('summary').click();await legacyRow.locator('input[aria-label="49-F99本朵花冠纵径（mm）"]').fill('52');
    await lf.locator('#pf-copy-feedback').click();const legacyOutput=await lf.locator('#pf-feedback-text').inputValue();assert.match(legacyOutput,/旧记录：横径49 mm/);assert.match(legacyOutput,/2026-10-27 07:45/);assert.match(legacyOutput,/花冠纵径 52 mm/);await legacyContext.close();
    tests.push('legacy free-text measurements and precise time survive new field edits and copying');
    const quickContext=await browser.newContext({viewport:{width:360,height:900},isMobile:true,hasTouch:true}),quickPage=await quickContext.newPage();await quickPage.clock.install({time:new Date(fixture.date+'T08:00:00+08:00')});await quickPage.goto(url+'fixture');const qf=quickPage.frameLocator('iframe');await qf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await qf.locator('#pf-phase').selectOption('evening');await qf.locator('#pf-add-flower').click();const qdraft=qf.locator('#pf-new-draft');await qdraft.locator('[aria-label="新花苞植株编号"]').fill('59');await qdraft.getByRole('button',{name:'添加到清单'}).click();assert.equal(await qdraft.locator('input').count()>0,true,'缺少处理不应提交');await qdraft.locator('[aria-label="新花苞实际处理"]').selectOption('不去雄、套袋、绿线');await qf.locator('#pf-task-title').click();await qf.locator('#pf-new-flowers .pf-new-row').waitFor();assert.equal(await qf.locator('#pf-new-draft input').count(),0,'离开录入区自动收进清单');const quickRow=qf.locator('#pf-new-flowers .pf-new-row').first();assert.match(await quickRow.locator('.pf-task-code').innerText(),/59/);assert.equal(await quickRow.locator('.pf-task-done').getAttribute('aria-pressed'),'false','添加记录不等于完成实验');await quickPage.reload();await qf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await qf.locator('#pf-phase').selectOption('evening');assert.match(await qf.locator('#pf-new-flowers .pf-task-code').first().innerText(),/59/);assert.equal(await qf.locator('#pf-new-flowers details[open]').count(),0);await quickContext.close();tests.push('mobile top entry, incomplete protection, auto-move on exit, no implied completion and reload persistence');
    const generalContext=await browser.newContext({viewport:{width:360,height:900}}),generalPage=await generalContext.newPage();await generalPage.clock.install({time:new Date('2026-10-27T08:00:00+08:00')});await generalPage.goto(url+'fixture');const gf=generalPage.frameLocator('iframe');await gf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await gf.locator('#pf-phase').selectOption('evening');await gf.locator('#pf-general-note').fill('仅总备注，不代表任何花已处理');await generalPage.waitForFunction(()=>JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}')['2026-10-27|general|evening']?.note==='仅总备注，不代表任何花已处理');await generalPage.reload();await gf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await gf.locator('#pf-phase').selectOption('evening');assert.equal(await gf.locator('#pf-general-note').inputValue(),'仅总备注，不代表任何花已处理');await gf.locator('#pf-copy-feedback').click();const generalOutput=await gf.locator('#pf-feedback-text').inputValue();assert.match(generalOutput,/2026-10-26 授粉前处理\n总备注：仅总备注，不代表任何花已处理/);assert.doesNotMatch(generalOutput,/已完成|49-F99/);await generalContext.close();
    tests.push('compact preparation labels and legacy option values; top add button, appended collapsed new records survive refresh and phase changes; two-target donor warning and two simultaneous arrowheads; independent general notes; notes-only feedback does not invent completed tasks');
    const suffixContext=await browser.newContext({viewport:{width:360,height:1000}}),suffixPage=await suffixContext.newPage();
    await suffixPage.clock.install({time:new Date('2026-10-27T08:00:00+08:00')});await suffixPage.goto(url+'suffix');const sf=suffixPage.frameLocator('iframe'),sa=sf.locator('#plant-field-3d');await sf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await sf.locator('#pf-phase').selectOption('morning');assert.equal(await sa.getAttribute('data-pairs'),'2');
    for(const spelling of ['868','868（2）','868(2)']){await sf.locator('#pf-search').fill(spelling);await sf.locator('#pf-search').press('Enter');assert((await sf.locator('#pf-detail').innerText()).includes(spelling==='868'?'868':'868（2）'));assert.equal(await sf.locator(`.pf-label[data-id="${spelling.normalize('NFKC')}"]`).getAttribute('aria-pressed'),'true');}
    await sf.locator('.pf-task-row[data-flower-id="868（2）-B2"] .pf-task-main').click();let suffixArrows=JSON.parse(await sa.getAttribute('data-rendered-pair-arrows'));assert.equal(suffixArrows.length,1);assert.equal(suffixArrows[0].donor,'868(2)');assert.equal(String(suffixArrows[0].donorFlower),'2');assert.equal(suffixArrows[0].mother,'56');await sf.locator('.pf-task-row[data-flower-id="868（2）-B1"] .pf-task-main').click();suffixArrows=JSON.parse(await sa.getAttribute('data-rendered-pair-arrows'));assert.equal(suffixArrows.length,1);assert.equal(suffixArrows[0].donor,'868');assert.equal(suffixArrows[0].mother,'868(2)');
    const suffixRow=sf.locator('.pf-task-row[data-flower-id="868（2）-B1"]');await suffixRow.locator('summary').click();await suffixRow.locator('textarea').fill('测试独立编号');await suffixRow.locator('.pf-task-done').click();await suffixPage.waitForFunction(()=>JSON.parse(localStorage.getItem('plant-field-feedback-v1')||'{}')['2026-10-27|868(2)#1|morning']?.done===true);await suffixPage.reload();await sf.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await sf.locator('#pf-phase').selectOption('morning');assert.equal(await suffixRow.getAttribute('data-done'),'true');await sf.locator('#pf-copy-feedback').click();const suffixOutput=await sf.locator('#pf-feedback-text').inputValue();assert.match(suffixOutput,/868（2）-B1/);assert.match(suffixOutput,/测试独立编号/);await suffixContext.close();
    tests.push('868 and 868（2） are distinct: both parentheses styles search, cross pairing, completion and copied feedback persist');
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ passed: true, tests, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, tests, errors }));
  } finally { await browser?.close(); await fallback?.close(); server.close(); }
})().catch(error => { fs.writeFileSync(path.join(out,'checks.json'),JSON.stringify({passed:false,status:'failed',error:error.message},null,2));console.error(error); process.exit(1); });
