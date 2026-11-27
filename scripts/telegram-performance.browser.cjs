/* Reproducible browser lab. No production requests, no real Telegram calls.
 * npm run build && npm start -- --port 3950
 * TG_PERF_URL=http://localhost:3950 node scripts/telegram-performance.browser.cjs baseline
 * Optional CHROMIUM_EXECUTABLE_PATH, CHROMIUM_ARGS (JSON), TG_PERF_RUNS (default 7).
 * Raw observations go to ignored .scratch/telegram-performance/<label>.browser.json.
 */
const { chromium } = require('playwright');
const fs = require('node:fs/promises');
const path = require('node:path');
const label = (process.argv[2] || 'sample').replace(/[^a-zA-Z0-9_-]/g, '');
const baseURL = process.env.TG_PERF_URL || 'http://localhost:3950';
if (!['localhost', '127.0.0.1'].includes(new URL(baseURL).hostname) && process.env.TG_PERF_ALLOW_REMOTE !== '1') {
  throw new Error('Use a local build, or explicitly set TG_PERF_ALLOW_REMOTE=1 for an authorized Preview.');
}
const runs = Number(process.env.TG_PERF_RUNS || 7);
const median = xs => { const a=[...xs].sort((x,y)=>x-y), m=Math.floor(a.length/2); return a.length%2?a[m]:(a[m-1]+a[m])/2; };
(async () => {
  const browser = await chromium.launch({
    executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
    args: JSON.parse(process.env.CHROMIUM_ARGS || '[]'), headless: true,
  });
  const samples = [];
  try {
    for (let i = 0; i < runs; i++) {
      const context = await browser.newContext({ viewport:{width:360,height:740}, deviceScaleFactor:2, isMobile:true, hasTouch:true });
      const page = await context.newPage();
      const errors = [];
      page.on('pageerror', error => errors.push(error.message));
      // Fixed SDK stub: measures app opening without the unavailable Telegram network.
      await page.route('https://telegram.org/**', route => route.fulfill({contentType:'application/javascript', body:
        `window.Telegram={WebApp:{platform:'android',ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},CloudStorage:{getItem(k,cb){cb(null,'')},setItem(k,v,cb){cb(null)}}}};`}));
      const cdp = await context.newCDPSession(page);
      await cdp.send('Network.enable');
      await cdp.send('Network.setCacheDisabled', {cacheDisabled:true});
      await cdp.send('Network.emulateNetworkConditions', {
        offline:false, latency:100, downloadThroughput:200000, uploadThroughput:93750,
      });
      await cdp.send('Emulation.setCPUThrottlingRate', {rate:4});
      await page.goto(`${baseURL}/tg?lang=en&perf=1`, {waitUntil:'load'});
      await page.waitForFunction(() => typeof window.nokhbaTgPerformance === 'function');
      await page.waitForTimeout(500);
      const data = await page.evaluate(() => window.nokhbaTgPerformance());
      const html = await page.content();
      const overflow = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth);
      const jsBytes = data.resources.filter(r=>r.kind==='script').reduce((sum,r)=>sum+r.bytes,0);
      samples.push({ run:i+1, browserCache:'disabled', serverCache:i?'warm':'first-request', htmlBytes:Buffer.byteLength(html), jsBytes, overflow, errors, ...data });
      console.log(JSON.stringify({run:i+1,ttfb:data.navigation.ttfbMs,hydrated:data.hydratedMs,lcp:data.vitals.lcpMs,htmlBytes:Buffer.byteLength(html),jsBytes,errors}));
      await context.close();
    }
  } finally { await browser.close(); }
  const warm = samples.slice(1);
  const summary = {
    ttfbMs: median(warm.map(s=>s.navigation.ttfbMs)),
    hydratedMs: median(warm.map(s=>s.hydratedMs)),
    lcpMs: median(warm.map(s=>s.vitals.lcpMs || 0)),
    htmlBytes: median(warm.map(s=>s.htmlBytes)),
    jsTransferBytes: median(warm.map(s=>s.jsBytes)),
    errors:samples.flatMap(s=>s.errors),
  };
  const result = {label, date:new Date().toISOString(), environment:process.env.TG_PERF_ENV_NOTE || 'Read-only build benchmark; confirm catalog/DB mode from server logs. Fixed SDK stub: no real Telegram network latency.', conditions:{runs, viewport:'360x740 DPR2',latencyMs:100,downloadBytesPerSecond:200000,cpuSlowdown:4,browserCache:'disabled'}, summary,samples};
  await fs.mkdir('.scratch/telegram-performance',{recursive:true});
  await fs.writeFile(path.join('.scratch/telegram-performance',`${label}.browser.json`),JSON.stringify(result,null,2));
  console.log('SUMMARY', JSON.stringify(summary));
})().catch(error => {console.error(error);process.exitCode=1;});
