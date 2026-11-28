// Read-only SSR/style/provider/header-spoofing smoke tests against a local build.
const {chromium}=require('playwright');const assert=require('node:assert/strict');
(async()=>{const b=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')});try{
 for(const url of ['/?lang=en','/codes?lang=en','/tg?lang=en','/?lang=ar']){
 const p=await b.newPage({viewport:{width:390,height:844},extraHTTPHeaders:{'x-nokhba-surface':'telegram'}});const errors=[];p.on('pageerror',e=>errors.push(e.message));
 await p.route(/^https:\/\//,r=>r.abort());
 const res=await p.goto((process.env.TG_PERF_URL||'http://localhost:3950')+url,{waitUntil:'domcontentloaded'});assert.equal(res.status(),200);await p.waitForTimeout(1500);
 if(url.startsWith('/tg')) {assert.equal(await p.locator('[data-tg-app]').count(),1); assert.equal(await p.locator('script').evaluateAll(xs=>xs.some(x=>x.textContent.includes('nukhba-palette-choice'))),false);}
 else {assert.ok(await p.locator('.public-shell').count());assert.equal(await p.locator('script').evaluateAll(xs=>xs.some(x=>x.textContent.includes('nukhba-palette-choice'))),true);assert.ok(await p.locator('link[rel=stylesheet]').count());}
 assert.deepEqual(errors,[]);console.log('PASS',url,'SSR, styles, hydration, forged surface header sanitized');await p.close();
 }
}finally{await b.close()}})().catch(e=>{console.error(e);process.exitCode=1});
