const fs=require('fs'),path=require('path'),os=require('os'),cp=require('child_process'),assert=require('assert'),http=require('http');
const {chromium}=require('playwright'),root=path.resolve(__dirname,'..');
(async()=>{
 const temp=fs.mkdtempSync(path.join(os.tmpdir(),'batch-browser-')),errors=[];
 let browser,server;
 try{
  for(const dir of ['src','scripts'])fs.cpSync(path.join(root,dir),path.join(temp,dir),{recursive:true});
  const config=JSON.parse(fs.readFileSync(path.join(temp,'src/daily-tasks.json'),'utf8'));
  fs.mkdirSync(path.join(temp,'src/batches'),{recursive:true});fs.writeFileSync(path.join(temp,'src/batches',config.date+'.json'),JSON.stringify({...config,acknowledgedPhases:['morning','evening']}));
  const git=args=>cp.execFileSync('git',args,{cwd:temp,stdio:'pipe'});
  git(['init']);git(['add','src/daily-tasks.json']);git(['-c','user.name=Isolated Test','-c','user.email=test@invalid','commit','-m','fixture']);
  const env={...process.env};delete env.VISUALIZE_RENDERER;delete env.PYTHON_BIN;
  cp.execFileSync(process.execPath,[path.join(temp,'scripts/build.cjs')],{cwd:temp,env,stdio:'pipe'});
  const archive=fs.readFileSync(path.join(temp,'docs','batch-'+config.date+'.html'),'utf8');assert(archive.includes('&quot;readOnly&quot;:true'));
  server=http.createServer((q,r)=>{r.setHeader('Content-Type','text/html;charset=utf8');r.end(q.url.startsWith('/batch-')?archive:fs.readFileSync(path.join(temp,'docs/index.html')));});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  browser=await chromium.launch({headless:true,executablePath:process.env.PLAYWRIGHT_CHROMIUM_EXECUTABLE||'C:/Program Files/Google/Chrome/Application/chrome.exe',args:['--enable-unsafe-swiftshader']});
  const page=await browser.newPage({viewport:{width:390,height:844}});page.on('pageerror',e=>errors.push(e.message));await page.clock.install({time:new Date(config.date+'T10:00:00+08:00')});
  const url='http://127.0.0.1:'+server.address().port;await page.goto(url);const f=page.frameLocator('iframe');await f.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();
  await f.locator('#pf-data-details').evaluate(e=>e.open=true);assert.equal(await f.locator('a[href="batch-'+config.date+'.html"]').count(),1);
  await page.evaluate(()=>localStorage.setItem('batch-navigation-test','preserved'));
  await f.locator('a[href="batch-'+config.date+'.html"]').click();await page.waitForURL('**/batch-'+config.date+'.html');
  assert.equal(await page.evaluate(()=>localStorage.getItem('batch-navigation-test')),'preserved');await f.locator('#plant-field-3d[data-feedback-loaded="true"]').waitFor();await f.locator('#pf-phase').selectOption('morning');
  assert.equal(await f.locator('#plant-field-3d').getAttribute('data-batch-expired'),'true');
  assert(await f.locator('.pf-task-done').count()>0);assert.equal(await f.locator('.pf-task-done:enabled').count(),0);assert.equal(await f.locator('#pf-add-flower').isDisabled(),true);
  assert.equal(await f.locator('#pf-phase option[value="morning"]').isEnabled(),true,'Closed archive still lets users inspect morning phase');
  assert.deepEqual(await f.locator('#pf-phase option').evaluateAll(xs=>xs.map(x=>x.value)),['morning','evening','firstflower','weekly','remeasure']);
  assert.deepEqual(errors,[]);console.log(JSON.stringify({passed:true,tests:['portable build without Python','archive page generated','history link visible','closed phases readable','archive read-only on opening day','no enabled completion or new-flower buttons','mobile no script errors']}));
 }finally{await browser?.close();if(server)await new Promise(r=>server.close(r));fs.rmSync(temp,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
