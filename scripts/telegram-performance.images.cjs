/* Real component + next/image + local images, with a fixed synthetic catalog.
 * node scripts/telegram-performance.images.cjs baseline 4a1b7dc
 * node scripts/telegram-performance.images.cjs optimized
 * Server must run a local production build on :3950. No production DB/API.
 */
const esbuild = require('esbuild');
const {execFileSync} = require('node:child_process');
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const {chromium}=require('playwright');
const label=(process.argv[2]||'sample').replace(/[^a-zA-Z0-9_-]/g,'');
const ref=process.argv[3];
const root=process.cwd();
const baseURL=process.env.TG_PERF_URL||'http://localhost:3950';
if(!['localhost','127.0.0.1'].includes(new URL(baseURL).hostname))throw Error('Local fixture only');
const median=xs=>[...xs].sort((a,b)=>a-b)[Math.floor(xs.length/2)];
(async()=>{
 const outdir=path.resolve('.scratch/telegram-performance',label+'-images');await fs.mkdir(outdir,{recursive:true});
 const images=(await fs.readdir('public/game-covers')).filter(p=>p.endsWith('.jpg')).sort().slice(0,26);
 const fixture=`import React from 'react';import {createRoot} from 'react-dom/client';import {TelegramMiniApp} from ${JSON.stringify(path.join(root,'src/app/tg/telegram-mini-app.tsx'))};
 const images=${JSON.stringify(images)};
 const products=images.map((image,i)=>({slug:'fixture-'+i,kind:'gift_card',platform:'Steam',titleEn:'Steam Wallet '+i,titleAr:'بطاقة ستيم '+i,fromUsd:6.31,image:'/game-covers/'+image,fit:'cover',color:'#1b2838',regions:i%2?['US']:['GLOBAL']}));
 createRoot(document.getElementById('root')).render(<TelegramMiniApp siteName="Nokhba" products={products} categories={['gift-card','game-topup','software-key','subscription-code'].map((c,i)=>({kind:['gift_card','game_topup','software_key','subscription_code'][i],ar:['بطاقات هدايا','شحن الألعاب','مفاتيح البرامج','اشتراكات'][i],en:['Gift cards','Games','Software','Subscriptions'][i],image:'/telegram-mini-app/'+c+'.webp',count:i?0:26}))} defaultLocale="en" initialLocale="en" explicitLocale="en" whatsapp="" degraded={false}/>);`;
 await esbuild.build({stdin:{contents:fixture,loader:'tsx',resolveDir:root},bundle:true,platform:'browser',format:'iife',outfile:path.join(outdir,'fixture.js'),minify:true,jsx:'automatic',define:{'process.env.NODE_ENV':'"production"','process.env':'{}'},plugins:[{name:'snapshot-component',setup(build){
  build.onResolve({filter:/^next\/script$/},()=>({path:'script',namespace:'stub'}));
  build.onLoad({filter:/.*/,namespace:'stub'},()=>({contents:'export default function Script(){return null}'}));
  if(ref)build.onLoad({filter:/telegram-mini-app\.(tsx|module\.css)$/},args=>({contents:execFileSync('git',['show',ref+':'+path.relative(root,args.path)],{encoding:'utf8'}),loader:args.path.endsWith('.css')?'local-css':'tsx',resolveDir:path.dirname(args.path)}));
 }}]});
 async function serveFixture(page) {
  await page.route('**/__tg-perf-fixture',r=>r.fulfill({contentType:'text/html',body:'<!doctype html><html><head><meta name="viewport" content="width=device-width,initial-scale=1"><style>body{margin:0}*{box-sizing:border-box}</style><link rel="stylesheet" href="/fixture.css"></head><body><div id="root"></div><script src="/fixture.js"></script></body></html>'}));
  for(const ext of ['js','css'])await page.route('**/fixture.'+ext,r=>r.fulfill({contentType:ext==='js'?'application/javascript':'text/css',body:require('node:fs').readFileSync(path.join(outdir,'fixture.'+ext))}));
 }
 const browser=await chromium.launch({executablePath:process.env.CHROMIUM_EXECUTABLE_PATH||undefined,args:JSON.parse(process.env.CHROMIUM_ARGS||'[]')});
 const samples=[];
 try{for(let i=0;i<7;i++){
  const context=await browser.newContext({viewport:{width:360,height:740},deviceScaleFactor:2,isMobile:true,hasTouch:true});const page=await context.newPage();
  const errors=[];page.on('pageerror',e=>{errors.push(e.message);console.error(e.message)});
  await serveFixture(page);
  const cdp=await context.newCDPSession(page);await cdp.send('Network.enable');await cdp.send('Network.setCacheDisabled',{cacheDisabled:true});await cdp.send('Network.emulateNetworkConditions',{offline:false,latency:100,downloadThroughput:200000,uploadThroughput:93750});await cdp.send('Emulation.setCPUThrottlingRate',{rate:4});
  await page.goto(baseURL+'/__tg-perf-fixture');await page.locator('button[aria-pressed]').waitFor();
  await page.waitForFunction(()=>Array.from(document.images).filter(x=>x.src.includes('/telegram-mini-app/')&&x.getBoundingClientRect().top<innerHeight).length>0 && Array.from(document.images).filter(x=>x.src.includes('/telegram-mini-app/')&&x.getBoundingClientRect().top<innerHeight).every(x=>x.complete&&x.naturalWidth>0));
  const visibleReadyMs=await page.evaluate(()=>performance.now());await page.waitForTimeout(400);
  const data=await page.evaluate(()=>({images:performance.getEntriesByType('resource').filter(e=>e.initiatorType==='img'||e.name.includes('/_next/image')).map(e=>({path:new URL(e.name).pathname,startMs:e.startTime,durationMs:e.duration,bytes:e.transferSize,endMs:e.responseEnd})),highPriorityProducts:Array.from(document.images).filter(x=>x.src.includes('/_next/image')&&x.loading!=='lazy').length,overflow:document.documentElement.scrollWidth>innerWidth}));
  assert.equal(data.overflow,false);assert.deepEqual(errors,[]);
  samples.push({run:i+1,visibleReadyMs,...data});
  if(i===0)await page.screenshot({path:path.join(outdir,'home.png'),fullPage:true});
  await context.close();
 }
 if(process.env.TG_PERF_VERIFY==='1'&&!ref){
  for(const width of [320,360,390])for(const locale of ['en','ar'])for(const dark of [true,false]){
   const context=await browser.newContext({viewport:{width,height:740},isMobile:true,hasTouch:true});const p=await context.newPage();const errors=[];p.on('pageerror',e=>errors.push(e.message));await serveFixture(p);
   await p.goto(baseURL+'/__tg-perf-fixture');const toggle=p.locator('button[aria-pressed]');await toggle.waitFor();
   if(!dark)await toggle.click();if(locale==='ar')await p.getByRole('button',{name:'العربية',exact:true}).click();await p.waitForTimeout(300);
   const app=p.locator('[data-tg-app]');assert.equal(await app.getAttribute('dir'),locale==='ar'?'rtl':'ltr');
   assert.equal(await p.getByRole('searchbox').locator('..').evaluate(e=>getComputedStyle(e).backgroundColor),dark?'rgb(28, 41, 68)':'rgb(255, 255, 255)');
   const product=p.getByRole('button',{name:locale==='ar'?/بطاقة ستيم/:/Steam Wallet/}).first();
   assert.equal(await product.locator('span').last().evaluate(e=>getComputedStyle(e).color),dark?'rgb(216, 252, 82)':'rgb(123, 97, 232)');
   await p.getByRole('button',{name:locale==='ar'?/بطاقات هدايا/:/Gift cards/}).click();
   const brand=p.getByRole('button',{name:/Steam|ستيم/}).first();assert.equal(await brand.evaluate(e=>getComputedStyle(e).backgroundColor),dark?'rgb(21, 31, 54)':'rgb(255, 255, 255)');await brand.click();
   await p.getByRole('button',{name:locale==='ar'?'أمريكا':'United States',exact:true}).click();
   assert.equal(await p.getByRole('button',{name:locale==='ar'?/بطاقة ستيم/:/Steam Wallet/}).count(),13);
   await p.getByRole('searchbox').fill('NO_SUCH_PRODUCT');assert.equal(await p.getByRole('button',{name:locale==='ar'?/بطاقة ستيم/:/Steam Wallet/}).count(),0);
   assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth),true);assert.deepEqual(errors,[]);
   console.log(`PASS fixture ${width}px ${locale} ${dark?'dark':'light'}: categories, brands, regions, prices, search, empty state, overflow`);
   if(width===390&&dark){await p.getByRole('searchbox').fill('');await p.waitForTimeout(800);await p.screenshot({path:path.join(outdir,`products-${locale}.png`)});}
   await context.close();
  }
 }
 }finally{await browser.close()}
 const warm=samples.slice(1);const summary={visibleCategoryImagesReadyMs:median(warm.map(s=>s.visibleReadyMs)),imageTransferBytes:median(warm.map(s=>s.images.reduce((n,e)=>n+e.bytes,0))),imageRequests:median(warm.map(s=>s.images.length)),eagerProductImages:samples[0].highPriorityProducts};
 await fs.writeFile(path.resolve('.scratch/telegram-performance',label+'.images.json'),JSON.stringify({label,ref:ref||'working-tree',scope:'Synthetic 26-product catalog, actual component/next-image, actual local image responses; browser cache off, optimizer server cache warm after first run; no DB',summary,samples},null,2));
 console.log(JSON.stringify(summary,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
