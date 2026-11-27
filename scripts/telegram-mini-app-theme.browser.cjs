// Run against a running /tg build: node scripts/telegram-mini-app-theme.browser.cjs
// Optional: TG_THEME_TEST_URL, CHROMIUM_EXECUTABLE_PATH, CHROMIUM_ARGS (JSON array).
// Uses Playwright Chromium; Telegram CloudStorage is mocked, never production data.
const assert = require('node:assert/strict');
const {chromium}=require('playwright');
const baseURL=process.env.TG_THEME_TEST_URL || 'http://localhost:3940';
(async()=>{
const browser=await chromium.launch({
  executablePath: process.env.CHROMIUM_EXECUTABLE_PATH || undefined,
  args: process.env.CHROMIUM_ARGS ? JSON.parse(process.env.CHROMIUM_ARGS) : [],
  headless:true,
});
try {
for(const width of [320,360,390]) {
 const context=await browser.newContext({viewport:{width,height:740},isMobile:true,hasTouch:true,userAgent:'Mozilla/5.0 (Linux; Android 13) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Mobile Safari/537.36',colorScheme:'dark'});
 const page=await context.newPage(); const errors=[]; page.on('pageerror',e=>errors.push(e.message));
 await page.route('https://telegram.org/**',r=>r.abort());
 await page.goto(`${baseURL}/tg?lang=en`);
 const toggle=page.locator('button[aria-pressed]');
 await toggle.waitFor(); await page.waitForTimeout(150);
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 await toggle.click(); await page.waitForTimeout(300);
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 assert.equal(await page.locator('div[dir][lang="en"]').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(11, 16, 32)');
 assert.equal(await page.evaluate(()=>document.documentElement.scrollWidth <= innerWidth),true,`overflow ${width}`);
 await page.reload(); await page.waitForTimeout(300);
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 await page.getByRole('button',{name:'العربية',exact:true}).click();
 assert.equal(await page.locator('div[lang="ar"][dir="rtl"]').count(),1);
 assert.equal(await toggle.getAttribute('aria-label'),'تبديل المظهر');
 await page.getByRole('searchbox').fill('NO_SUCH_PRODUCT');
 await toggle.click(); await page.waitForTimeout(300);
 assert.equal(await toggle.getAttribute('aria-pressed'),'false');
 assert.equal(errors.length,0,errors.join('\n'));
 console.log(`PASS Android Chromium emulation ${width}px: light default despite OS dark, toggle, persistence, RTL/LTR, search, no overflow/hydration errors`);
 await context.close();
}
// Simulate SDK arriving AFTER the component mounts, like next/script.
for(const lateClick of [false,true]) {
 const context=await browser.newContext();const page=await context.newPage();
 await page.route('https://telegram.org/**', async route=>{
  await new Promise(r=>setTimeout(r,500));
  await route.fulfill({contentType:'application/javascript',body:`window.Telegram={WebApp:{platform:'android',ready(){},expand(){},setHeaderColor(){},setBackgroundColor(){},CloudStorage:{getItem(k,cb){window.__themeRead=true;window.__cb=cb;},setItem(k,v,cb){window.__saved=v;cb(null);}}}}`});
 });
 await page.goto(`${baseURL}/tg?lang=en`);
 await page.waitForFunction(()=>window.__themeRead);
 const toggle=page.locator('button[aria-pressed]');
 if(lateClick) await toggle.click();
 await page.evaluate(v=>window.__cb(null,v),lateClick?'light':'dark');
 await page.waitForTimeout(100);
 assert.equal(await toggle.getAttribute('aria-pressed'),'true');
 if(lateClick) assert.equal(await page.evaluate(()=>window.__saved),'dark');
 console.log(`PASS delayed Telegram CloudStorage ${lateClick?'cannot overwrite a fresh user choice':'restores theme after SDK is ready'}`);
 await context.close();
}
} finally {await browser.close()}
})().catch(e=>{console.error(e);process.exitCode=1});
