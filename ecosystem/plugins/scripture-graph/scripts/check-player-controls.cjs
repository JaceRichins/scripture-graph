const {chromium,webkit}=require('C:/Users/jacer/.cache/codex-runtimes/codex-primary-runtime/dependencies/node/node_modules/playwright');
const {createServer}=require('node:http');const {readFileSync,writeFileSync}=require('node:fs');const {resolve}=require('node:path');const assert=require('node:assert/strict');
(async()=>{
  const engine=process.argv.includes('--webkit')?'webkit':'chromium',out=resolve('../../../output/player-controls');
  const files={'/': ['index.html','text/html'],'/player.js':['player.js','text/javascript'],'/styles.css':['styles.css','text/css'],'/audio.wav':['audio.wav','audio/wav']};
  const server=createServer((req,res)=>{
    const file=files[new URL(req.url,'http://localhost').pathname];if(!file){res.writeHead(404);res.end();return;}
    const body=readFileSync(resolve(out,file[0])),range=/^bytes=(\d+)-(\d*)$/.exec(req.headers.range||'');
    if(range){const start=Number(range[1]),end=Math.min(body.length-1,range[2]?Number(range[2]):body.length-1);res.writeHead(206,{'Content-Type':file[1],'Accept-Ranges':'bytes','Content-Range':`bytes ${start}-${end}/${body.length}`,'Content-Length':end-start+1});res.end(body.subarray(start,end+1));}
    else{res.writeHead(200,{'Content-Type':file[1],'Accept-Ranges':'bytes','Content-Length':body.length});res.end(body);}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await ({chromium,webkit}[engine]).launch({headless:true});
  const page=await browser.newPage({viewport:{width:390,height:844},deviceScaleFactor:3,isMobile:true,hasTouch:true});
  const errors=[];page.on('pageerror',e=>errors.push(e.message));
  try{
    await page.goto('http://127.0.0.1:'+server.address().port);
    await page.getByRole('button',{name:'Play saved story',exact:true}).click();
    await page.waitForFunction(()=>window.player.audio?.duration===120&&window.player.audio.readyState>=1);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>window.player.audio.currentTime=40);
    await page.waitForFunction(()=>!window.player.audio.seeking&&Math.abs(window.player.audio.currentTime-40)<.2);
    await page.getByRole('button',{name:'Back 15 seconds',exact:true}).click();
    await page.waitForFunction(()=>Math.abs(window.player.audio.currentTime-25)<.2);
    await page.getByRole('button',{name:'Forward 15 seconds',exact:true}).click();
    await page.waitForFunction(()=>Math.abs(window.player.audio.currentTime-40)<.2);
    await page.getByRole('button',{name:'Forward 15 seconds',exact:true}).click();
    await page.waitForFunction(()=>Math.abs(window.player.audio.currentTime-55)<.2);
    assert.ok(await page.evaluate(()=>window.player.paused&&window.player.audio.paused));
    assert.equal(await page.evaluate(()=>window.player.index),1);
    await page.getByRole('button',{name:'Restart current recording',exact:true}).click();
    await page.waitForFunction(()=>window.player.audio.currentTime===0);
    assert.equal(await page.evaluate(()=>window.player.index),1);
    await page.evaluate(()=>window.player.audio.currentTime=45);
    await page.getByRole('button',{name:'Previous part',exact:true}).click();
    await page.waitForFunction(()=>window.player.index===0&&window.player.audio.readyState>=1);
    assert.ok(await page.getByRole('button',{name:'Previous part',exact:true}).isDisabled());
    await page.getByRole('button',{name:'Next part',exact:true}).click();
    await page.waitForFunction(()=>window.player.index===1&&window.player.audio.readyState>=1);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>window.player.audio.currentTime=115);
    await page.getByRole('button',{name:'Forward 15 seconds',exact:true}).click();
    await page.waitForTimeout(150);
    assert.equal(await page.evaluate(()=>window.player.index),1,'Paused seeking to the end must not skip a story part');
    await page.getByRole('button',{name:'Restart current recording',exact:true}).click();
    for(const width of [320,390,768]){
      await page.setViewportSize({width,height:844});
      const b=await page.locator('.sg-player').evaluate(el=>{const box=el.getBoundingClientRect();const buttons=[...el.querySelectorAll('button')].map(b=>b.getBoundingClientRect());return{width:el.clientWidth,scroll:el.scrollWidth,min:Math.min(...buttons.map(b=>Math.min(b.width,b.height))),outside:buttons.some(b=>b.left<box.left||b.right>box.right),overlap:buttons.some((a,i)=>buttons.some((b,j)=>j>i&&a.left<b.right&&a.right>b.left&&a.top<b.bottom&&a.bottom>b.top))};});
      assert.ok(b.scroll<=b.width+1&&!b.outside&&!b.overlap&&b.min>=44,JSON.stringify({width,b}));
      if(width===390)await page.screenshot({path:resolve(out,`stories-${engine}.png`)});
    }
    await page.getByRole('button',{name:'Play music',exact:true}).click();
    await page.waitForFunction(()=>window.player.audio.readyState>=1);
    await page.getByRole('button',{name:'Pause',exact:true}).click();
    await page.evaluate(()=>window.player.audio.currentTime=35);
    await page.getByRole('button',{name:'Back 15 seconds',exact:true}).click();
    await page.waitForFunction(()=>Math.abs(window.player.audio.currentTime-20)<.2);
    await page.getByRole('button',{name:'Previous track',exact:true}).click();
    await page.waitForFunction(()=>window.player.index===0&&window.player.audio.readyState>=1);
    await page.setViewportSize({width:390,height:844});await page.locator('body').evaluate(el=>el.classList.add('light'));
    await page.waitForTimeout(250);
    await page.screenshot({path:resolve(out,`music-light-${engine}.png`)});
    await page.getByRole('button',{name:'Stop',exact:true}).click();
    assert.ok(await page.locator('.sg-player-wrap').isHidden());assert.deepEqual(errors,[]);
    const result={engine,realAudio:true,checks:['six transport controls','previous part vs restart','15-second seek in both directions','paused seek','end boundary','previous music track','44px targets at 320/390/768px','no overlapping controls','stop'],errors};
    writeFileSync(resolve(out,`results-${engine}.json`),JSON.stringify(result,null,2));console.log(JSON.stringify(result));
  }finally{await browser.close();server.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
