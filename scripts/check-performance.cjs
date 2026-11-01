const { chromium } = require('playwright');
const fs = require('fs'), path = require('path'), http = require('http'), assert = require('assert');
const root = path.resolve(__dirname,'..');
const html = fs.readFileSync(path.join(root,'docs/index.html'));
const measurement = JSON.parse(fs.readFileSync(path.join(root,'src/measurement-tasks.json'),'utf8'));
(async()=>{
  const server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html; charset=utf-8');r.end(html)});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));let browser;
  try {
    browser=await chromium.launch({headless:true,executablePath:process.env.CHROME_PATH||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
    const page=await browser.newPage({viewport:{width:390,height:844},isMobile:true,hasTouch:true});
    await page.clock.install({time:new Date('2026-11-01T23:59:30+08:00')});
    const cdp=await page.context().newCDPSession(page);await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
    await page.goto('http://127.0.0.1:'+server.address().port);const f=page.frameLocator('iframe');
    await f.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();
    const frame=page.frames().find(x=>x!==page.mainFrame());
    const switchTo=phase=>frame.evaluate(p=>{const el=document.querySelector('#pf-phase'),start=performance.now();el.value=p;el.dispatchEvent(new Event('change',{bubbles:true}));return {phase:p,ms:Math.round(performance.now()-start),rows:document.querySelectorAll('#pf-task-list .pf-task-row').length,inputs:document.querySelectorAll('#pf-task-list input').length}},phase);
    const weekly=await switchTo('weekly'),before=await switchTo('remeasure');
    assert.equal(weekly.rows,measurement.firstflower.tasks.length+measurement.weekly.tasks.length);
    assert.equal(before.rows,measurement.remeasure.tasks.filter(t=>t.dueDate<='2026-11-01').length);
    // The embedded iframe has its own clock, so advance that clock directly.
    await frame.evaluate(()=>{Date.now=()=>Date.parse('2026-11-02T00:00:01+08:00')});
    const after=await switchTo('remeasure');
    assert.equal(after.rows,measurement.remeasure.tasks.filter(t=>t.dueDate<='2026-11-02').length,'跨北京午夜后应更新到期列表');
    assert(after.rows>before.rows,'次日新到期的复测不能被缓存遮蔽');
    await frame.evaluate(()=>{Date.now=()=>Date.parse('2026-11-20T12:00:00+08:00')});
    const largerList=await switchTo('remeasure');
    assert.equal(largerList.rows,measurement.remeasure.tasks.filter(t=>t.dueDate<='2026-11-20').length,'较多到期项应完整显示');
    // A loose bound catches the original multi-second repeated formatter regression,
    // not a claim about the actual speed of any specific phone.
    assert(before.ms<2500&&after.ms<2500&&largerList.ms<2500,'模拟慢速CPU时切换复测超出回归上限');
    console.log(JSON.stringify({passed:true,simulatedCpuSlowdown:4,weekly,beforeMidnight:before,afterMidnight:after,largerList}));
  } finally {if(browser)await browser.close();server.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
