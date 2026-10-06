const {chromium,webkit}=require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const fs=require('node:fs'),http=require('node:http'),path=require('node:path'),assert=require('node:assert/strict');
const preview=path.resolve(__dirname,'../../../../output/timeline-preview');
const out=path.resolve(__dirname,'../../../../output/bom-timeline');
const engine=process.argv.includes('--webkit')?'webkit':'chromium';
(async()=>{
  let browser;
  const server=http.createServer((req,res)=>{
    const name=path.basename(req.url.split('?')[0])||'index.html';
    res.setHeader('Content-Type',name.endsWith('.js')?'text/javascript':name.endsWith('.css')?'text/css':name.endsWith('.json')?'application/json':'text/html');
    try{res.end(fs.readFileSync(path.join(preview,name)))}catch{res.statusCode=404;res.end()}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  try{
    browser=await(engine==='webkit'?webkit:chromium).launch({headless:true});
    const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,hasTouch:true,isMobile:true});
    const errors=[];page.on('pageerror',e=>errors.push(e.message));page.on('crash',()=>errors.push('renderer crash'));
    await page.goto(`http://127.0.0.1:${server.address().port}`);await page.waitForFunction(()=>window.timeline);
    await page.evaluate(async()=>{
      document.body.classList.add('is-mobile','mod-ios','theme-dark');
      const link=document.createElement('link');link.rel='stylesheet';link.href='obsidian.css';
      const loaded=new Promise((res,rej)=>{link.onload=res;link.onerror=rej});document.head.prepend(link);await loaded;
      const v=window.timeline;v.lanes=new Set(['nw']);v.presetTitle='Book of Mormon';v.openCanvas();
    });
    assert.equal(await page.locator('.sg-tw-column').count(),20);
    assert.equal(await page.locator('[data-event-id="coriantumr-zarahemla"]').count(),2);
    assert.ok(await page.locator('[data-event-id="plates-received"]').count()>0);
    await page.evaluate(()=>window.timeline.world.follow('coriantumr-zarahemla'));
    assert.match(await page.locator('.sg-tl-detail-year').textContent(),/exact year unknown/);
    assert.doesNotMatch(await page.locator('.sg-tl-detail-year').textContent(),/575/);
    await page.locator('.sg-tl-scripture-evidence summary').click();
    const scripture=page.locator('.sg-tl-scripture-evidence .sg-tl-link-ref').first();
    await scripture.click();assert.equal(await page.evaluate(()=>window.opened),'Omni 1#^omni-1-20');
    assert.match(await page.locator('.sg-tl-scripture-evidence a').first().getAttribute('href'),/churchofjesuschrist.org\/study\/scriptures\/bofm\/omni\/1/);
    await page.screenshot({path:path.join(out,`coriantumr-evidence-${engine}.png`)});
    const relations=await page.evaluate(()=>window.timeline.world.connections('coriantumr-zarahemla'));
    assert.ok(relations.some(r=>r.id==='jaredite-end'));assert.ok(relations.some(r=>r.id==='coriantumr-stone'));
    await page.evaluate(()=>{
      const v=window.timeline;v.showWorldInterval(v.data.events.find(e=>e.id==='jaredite-end'),v.data.events.find(e=>e.id==='coriantumr-zarahemla'),'Crossover');
    });
    assert.equal(await page.locator('.sg-tl-detail-title').textContent(),'Interval not specified in the text');
    await page.getByRole('button',{name:'Close time interval'}).click();
    await page.getByRole('button',{name:'Timeline options',exact:true}).click();
    await page.getByRole('button',{name:'Alma & sons of Mosiah',exact:true}).click();
    assert.equal(await page.locator('.sg-tw-column').count(),2);
    assert.equal(await page.locator('[data-event-id="mission-reunion"]').count(),2);
    const alignment=await page.locator('[data-event-id="mission-reunion"]').evaluateAll(cards=>cards.map(c=>c.style.transform));
    // Hidden cards are deliberately unpainted; inspect logical placements.
    const logical=await page.evaluate(()=>{
      const w=window.timeline.world;
      return w.columnNodes.map(nodes=>nodes.find(n=>n.event.id==='mission-reunion').y);
    });assert.equal(logical[0],logical[1]);
    await page.setViewportSize({width:844,height:600});
    await page.evaluate(()=>{const w=window.timeline.world;w.follow('mission-reunion');window.timeline.clearDetail();w.fitWidth()});
    await page.screenshot({path:path.join(out,`parallel-missions-${engine}.png`)});
    await page.getByRole('button',{name:'Timeline options',exact:true}).click();
    await page.getByRole('button',{name:'Follow the plates',exact:true}).click();
    assert.equal(await page.locator('.sg-tw-column').count(),5);
    for(const id of ['small-to-chemish','records-to-shiblon','mormon-small-included','moroni-final','plates-received','plates-returned-angel','bom-published']){
      assert.ok(await page.locator(`[data-event-id="${id}"]`).count()>0,id);
    }
    await page.setViewportSize({width:390,height:844});
    await page.getByLabel('Go to a storyline',{exact:true}).selectOption('2');
    assert.ok(await page.locator('.sg-tw-event:visible').count()>0,'Storyline selector lands on populated content');
    await page.evaluate(()=>window.timeline.world.follow('mormon-cumorah-records'));
    assert.match(await page.locator('.sg-tl-detail-note').textContent(),/source archive and the abridgment/);
    await page.screenshot({path:path.join(out,`plates-custody-${engine}.png`)});
    await page.getByRole('button',{name:'Close event details',exact:true}).click();
    await page.getByRole('button',{name:'Timeline options',exact:true}).click();
    await page.getByRole('button',{name:'Sources & coverage',exact:true}).click();
    assert.equal(await page.evaluate(()=>window.opened),'AI Library/90 Sources/Book of Mormon Timeline - Sources and Coverage.md');
    await page.evaluate(()=>{
      const v=window.timeline;v.focuses=[];v.presetTitle='Book of Mormon';v.render();
      v.world.camera={x:20,y:12,scale:1};v.world.paint();
    });
    await page.getByRole('button',{name:'Timeline options',exact:true}).click();
    for(let i=0;i<20;i++){
      await page.getByLabel('Go to a storyline',{exact:true}).selectOption(String(i));
      assert.ok(await page.locator('.sg-tw-event:visible').count()>0,`Storyline ${i} has visible events`);
    }
    const bounds=await page.evaluate(()=>{
      const w=window.timeline.world;w.zoomBy(.001);
      return {world:w.world.offsetHeight,viewport:w.viewport.clientHeight,svg:w.svg.clientHeight,scale:w.camera.scale};
    });assert.equal(bounds.world,bounds.viewport);assert.equal(bounds.svg,bounds.viewport);assert.equal(bounds.scale,.05);
    await page.evaluate(async()=>{const v=window.timeline;await v.setState(v.getState(),{});if(v.world.camera.scale<.6)throw Error('Reopened timeline must be readable')});
    const restored=await page.evaluate(async()=>{const v=window.timeline,s=v.getState();await v.setState(s,{});return {expected:s.camera,actual:v.world.camera}});
    assert.deepEqual(restored.actual,restored.expected);assert.deepEqual(errors,[]);
    fs.writeFileSync(path.join(out,`browser-${engine}.json`),JSON.stringify({engine,storylines:20,platePaths:5,checks:['shared crossover','precise verse link','unknown interval','parallel mission layout','Restoration bridges','all storylines navigable','sources guide','bounded minimum zoom','saved state'],errors},null,2)+'\n');
    console.log(`PASS (${engine}): 20 storylines, crossovers, five plate paths, verse evidence, all-column navigation and bounded zoom.`);
  }finally{if(browser)await browser.close();await new Promise(r=>server.close(r))}
})().catch(e=>{console.error(e);process.exitCode=1});
