const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const root = path.resolve(__dirname, '..'), out = path.join(root, 'qa-output');
fs.mkdirSync(out, { recursive: true });
const document = fs.readFileSync(path.join(root, 'docs/index.html'), 'utf8');
const currentTasks = JSON.parse(fs.readFileSync(path.join(root, 'src/daily-tasks.json'), 'utf8'));
const { readLayout, validateConfig, periodLabels, needsAction } = require('./task-data.cjs');
const layout = readLayout(fs.readFileSync(path.join(root, 'src/plant-field.html'), 'utf8'));
const source = fs.readFileSync(path.join(root, 'src/plant-field.html'), 'utf8');
const vm = require('vm');
const geometry = vm.runInNewContext(source.slice(source.indexOf('const geometryRevision='), source.indexOf('const actualRows=')) + '\n({measuredLengths,middleSpan,baySpan,leftSpan,frameRegions})', {}, {timeout:1000});
const allRows = vm.runInNewContext(source.match(/const actualRows=(\[[\s\S]*?\n    \]);/)[1], {}, {timeout:1000});
const middleRows=Array.from(allRows).filter(row=>row.section==='中间连接区'),leftRows=Array.from(allRows).filter(row=>row.section==='左侧有架区');
const placeholderCount = Array.from(allRows).reduce((sum,row)=>sum+Array.from(row.ids).filter(id=>!id).length,0);
assert.equal(geometry.measuredLengths.bay,1.66);
assert.equal(geometry.measuredLengths.middle,2.17);
assert.equal(geometry.measuredLengths.left,1.60);
assert(Math.abs((geometry.middleSpan.right-geometry.middleSpan.left)/(geometry.baySpan.right-geometry.baySpan.left)-2.17/1.66)<1e-12);
assert.equal(geometry.frameRegions[0][0].right,geometry.middleSpan.left);
assert.equal(geometry.middleSpan.right,geometry.baySpan.left);
assert(Math.abs((geometry.leftSpan.right-geometry.leftSpan.left)/(geometry.baySpan.right-geometry.baySpan.left)-1.60/1.66)<1e-12);
assert.deepEqual(Array.from(middleRows,row=>row.row),[0,1,2]);
assert.equal(layout.size,76-placeholderCount,'所有确认编号去重计数，待确认项不作植株编号');
assert(middleRows.every(row=>row.fractions.every((x,i,a)=>x>=0&&x<=1&&(i===0||x>a[i-1]))));
assert.deepEqual(Array.from(leftRows.find(r=>r.row===0).ids),['483','295','220','317','210','968','149','821']);
assert.deepEqual(Array.from(leftRows.find(r=>r.row===1).ids),['1130','826','1007','886','291','215','402','397','713']);
assert.deepEqual(Array.from(leftRows.find(r=>r.row===2).ids),['1020','144','795','585','156','2','85','929']);
assert.deepEqual(Array.from(middleRows.find(r=>r.row===0).ids),['163','646','330','159','550','208','416','794']);
assert.deepEqual(Array.from(middleRows.find(r=>r.row===1).ids),['81','648','782','1082','890','716','130','584','1093','218']);
assert.deepEqual(Array.from(middleRows.find(r=>r.row===2).ids),['54','907','143','48','928','692','1069','940','1170','834']);
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
  { area: '第一片区', id: '49', flower: '100', evening: '已完成：绿线套袋', morning: '已完成：自主自交，已确认开放' }
] };
const fixtureSummary = validateConfig(fixture, layout);
const fixtureDocument = document.replace(embedded(currentTasks), embedded(fixture));
const expiredFixture = { ...fixture, date: '2000-10-27', label: '10月26日晚／10月27日早 · 仅展示已录入盆位的8/8株' };
const expiredDocument = document.replace(embedded(currentTasks), embedded(expiredFixture));
assert.notEqual(fixtureDocument, document);
assert.equal(fixtureSummary.crosses, 2, '一父两母的两个关系必须分别保留');
assert.equal(needsAction('不处理（不套袋，不去雄）'), false);
assert.equal(needsAction('已完成：接157花粉；重新套袋'), false);
assert.throws(() => validateConfig({ ...fixture, tasks: fixture.tasks.filter(t => t.id !== '157') }, layout), /双方|一致/);
(async () => {
  const server = http.createServer((req, res) => { res.setHeader('Content-Type', 'text/html; charset=utf-8'); res.end(req.url.startsWith('/expired') ? expiredDocument : req.url.startsWith('/fixture') ? fixtureDocument : document); });
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
    assert.equal(await app.getAttribute('data-left-rows'),'8,9,8');
    assert.equal(await app.getAttribute('data-outer-untrained-row'),'excluded');
    assert.equal(await app.getAttribute('data-bay-length-meters'),'1.66');
    assert.equal(await app.getAttribute('data-middle-length-meters'),'2.17');
    assert.equal(await app.getAttribute('data-left-length-meters'),'1.6');
    assert(Math.abs(Number(await app.getAttribute('data-length-ratio'))-2.17/1.66)<1e-12);
    assert.equal(await frame.locator('.pf-label').count(),layout.size,'待确认项不产生虚构编号');
    assert.equal(await frame.locator('#pf-left-length,#pf-middle-length,#pf-bay-length').count(),0,'比例保留在几何中，不画尺寸文字或尺寸线');
    assert.equal(await app.getAttribute('data-dimension-annotations'),'hidden');
    assert.equal(await app.getAttribute('data-pot-scale'),'0.86');
    assert.equal(await app.getAttribute('data-label-layout'),'above-below-no-leaders');
    assert(!source.includes('dimensionZ'),'不再画尺寸线');
    const coord=async id=>frame.locator(`.pf-label[data-id="${id}"]`).evaluate(el=>({x:+el.dataset.x,z:+el.dataset.z,row:+el.dataset.row,section:el.dataset.section,note:el.dataset.note}));
    const inner=await coord('210'),outer=await coord('968');assert.equal(inner.row,1);assert.equal(outer.row,1);assert(Math.abs(inner.x-outer.x)<1e-12);assert(inner.z<outer.z);assert.match(inner.note,/靠内/);assert.match(outer.note,/靠外/);
    const middleLow=await Promise.all(['163','646','330','159','550','208','416','794'].map(coord));
    assert(middleLow[3].x-middleLow[2].x>(middleLow[1].x-middleLow[0].x)*1.8,'330与159间须保留空档');
    assert(middleLow.every(p=>p.z===middleLow[0].z),'中间区最低排仅一行');
    const leftGap=await Promise.all(['317','210','215','402'].map(coord));assert(leftGap[1].x-leftGap[0].x>2);assert(leftGap[3].x-leftGap[2].x>1.3);
    tests.push('1.60 / 2.17 / 1.66 m common scale; all entered section/row orders; middle and left gaps; 210/968 front-back stagger; no extra untrained pots or invented IDs');
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
        assert.equal(await frame.locator('#pf-phase option:checked').innerText(), labels[phase]);
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
          assert.match(await frame.locator('#pf-detail').innerText(),/父本第\d+朵.*父本已定位/);
          assert.match(await frame.locator('#pf-detail').innerText(),/供粉条目待同步/);
          assert.equal(await frame.locator(`.pf-label[data-id="${donor}"]`).count(),1);
          assert(!currentTasks.tasks.some(t=>t.id===donor),'新增盆位不能冒造供粉任务');
        }else{
          assert.match(await frame.locator('#pf-detail').innerText(), /父本第\d+朵.*父本盆位未录入/);
          assert.equal(await frame.locator('#pf-pairtag').isVisible(), false, '未定位亲本不得虚构盆位连线');
        }
        await frame.locator('#pf-search').fill(''); await frame.locator('#pf-search').press('Enter');
      }
      tests.push('real embedded batch; explicit Beijing dates; phase-specific pending actions; completed preparation inactive; unlocated partner disclosed');
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
    await dragBy(120, 0); const pan = await cameraState();
    assert(pan.x < start.x - .5, '横拖应平移摄像机，不绕盆位转动');
    near(pan.pitch, start.pitch); near(pan.yaw, start.yaw); near(pan.z, start.z); near(pan.distance, start.distance);
    vector(pan).forEach((n, i) => near(n, vector(start)[i], '平移不能改变观察方向'));
    await page.screenshot({ path: path.join(out, 'horizontal-pan.png'), fullPage: true });
    await dragBy(0, 48); const tilt = await cameraState();
    near(tilt.x, pan.x); near(tilt.z, pan.z); near(tilt.distance, pan.distance); assert(tilt.pitch > pan.pitch + .1);
    near(tilt.eye[0], pan.eye[0]); tilt.target.forEach((n, i) => near(n, pan.target[i]));
    near(Math.hypot(...vector(tilt)), Math.hypot(...vector(pan)), '俯仰须绕固定平行轴，不改变距离');
    await page.screenshot({ path: path.join(out, 'vertical-tilt.png'), fullPage: true });
    // First movement is horizontal, then becomes diagonal: retain the chosen mode.
    await dragBy(-100, 15); const diagonal = await cameraState(); near(diagonal.pitch, tilt.pitch);
    const b = await frame.locator('#pf-canvas').boundingBox(); await page.mouse.move(b.x + b.width / 2, b.y + 80); await page.mouse.wheel(0, 100); await page.waitForTimeout(60);
    const zoom = await cameraState(); assert(zoom.distance > diagonal.distance); near(zoom.pitch, diagonal.pitch); near(zoom.x, diagonal.x);
    await frame.locator('#pf-home').click(); await page.waitForTimeout(750); const home = await cameraState(); near(home.x, (geometry.leftSpan.left+geometry.baySpan.right)/2); near(home.pitch, .85);
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
    await frame.locator('#pf-search').fill('1131'); await frame.locator('#pf-search').press('Enter');
    assert.match(await frame.locator('#pf-detail').innerText(), /第1排.*第7株/);
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
    assert.equal(await frame.locator('.pf-label:visible').count(), 0);
    assert.match(await frame.locator('#pf-zoneinfo').innerText(), /待录入/);
    tests.push('confirmed IDs and pending slots counted separately; no stale tasks; no upload; 320-1024 responsive; search; PNG content and download; unmapped zone');
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
    assert(mobileOffsets.some(n=>n<-10)&&mobileOffsets.some(n=>n>10),'完整编号标签须上下交错');
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
      assert((await mf.locator('#pf-detail').innerText()).includes(section));
    }
    assert.equal(await mf.locator('.pf-label[data-id="130584"]').count(),0,'不能把粘连编号当成一个植株');
    await mf.locator('#pf-batch-summary').click();assert.equal(await mf.locator('#pf-source').isVisible(),true);
    assert((await mf.locator('#pf-source').innerText()).includes(currentTasks.label));
    await mf.locator('#pf-batch-summary').click();assert.equal(await mf.locator('#pf-source').isVisible(),false);
    // Keep the gesture fixture above the newly staggered labels so a label tap
    // is not mistaken for a canvas pinch.
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
    tests.push('no visible dimensions; original scale and smaller pots intact; dot-plus-ID chips only above or below, without leaders or a middle lane; mobile 44px non-overlapping targets; selected priority and readable numbers');
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
      assert.equal(await fa.getAttribute('data-active-tasks'), String(fixtureSummary.active[phase]));
      assert.equal(await fa.getAttribute('data-active-pairs'), phase === 'morning' ? '2' : '0');
      assert.equal(await ff.locator('.pf-label[data-id="792"]').getAttribute('data-task-active'), String(phase === 'morning'));
      assert.equal(await ff.locator('.pf-label[data-id="157"]').getAttribute('data-task-active'), String(phase === 'morning'));
      assert.equal(await ff.locator('.pf-label[data-id="47"]').getAttribute('data-task-active'), 'false');
    }
    const expectedKinds = { '49': 'cross', '157': 'donor', '59': 'auto', '56': 'open', '36': 'measure', '46': 'hand' };
    const colors = [];
    for (const [id, kind] of Object.entries(expectedKinds)) {
      const label = ff.locator(`.pf-label[data-id="${id}"]`);
      assert.equal(await label.getAttribute('data-task-kind'), kind);
      assert.equal(await label.getAttribute('data-task-active'), 'true');
      colors.push(await label.evaluate(el => el.style.getPropertyValue('--task-color')));
    }
    assert.equal(new Set(colors).size, 6, '六类处理应保留独立颜色');
    const crossColor = await ff.locator('.pf-label[data-id="49"]').evaluate(el => el.style.getPropertyValue('--task-color'));
    await ff.locator('#pf-search').fill('49'); await ff.locator('#pf-search').press('Enter');
    assert.equal(await ff.locator('.pf-label[data-id="49"]').evaluate(el => el.style.getPropertyValue('--task-color')), crossColor, '搜索定位不能覆盖处理色');
    assert.match(await ff.locator('#pf-detail').innerText(), /第99朵/);
    assert.match(await ff.locator('#pf-detail').innerText(), /第100朵/);
    await fixturePage.goto(url + 'expired');
    await ff.locator('.pf-label[data-id="56"]').waitFor({ state: 'visible' });
    await ff.locator('#pf-phase').selectOption('evening');
    assert.equal(await fa.getAttribute('data-batch-expired'), 'true');
    assert.equal(await fa.getAttribute('data-active-tasks'), '0');
    assert.equal(await fa.getAttribute('data-active-pairs'), '0');
    assert.match(await ff.locator('#pf-source').textContent(), /历史批次，不作为今日待办/);
    tests.push('isolated six-color fixture; one father two mothers; multiple flowers; no-op/completed inactive; search color independent; expired batch not pending');
    await fixturePage.close();
    assert.deepEqual(errors, []);
    fs.writeFileSync(path.join(out, 'checks.json'), JSON.stringify({ passed: true, tests, errors }, null, 2));
    console.log(JSON.stringify({ passed: true, tests, errors }));
  } finally { await browser?.close(); await fallback?.close(); server.close(); }
})().catch(error => { console.error(error); process.exit(1); });
