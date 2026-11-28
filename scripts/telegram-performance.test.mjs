import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { measureTelegram, traceTelegram, telegramServerTiming } from '../src/lib/telegram-performance.ts';

test('Telegram timings preserve return values, failures and nested spans', async () => {
  await traceTelegram('webhook', async trace => {
    assert.equal(await measureTelegram('catalog', async () => 42), 42);
    await assert.rejects(measureTelegram('failing_db', async () => { throw Error('must not be logged'); }));
    assert.deepEqual(trace.spans.map(s=>[s.name,s.failed]), [['catalog',false],['failing_db',true]]);
    assert.ok(trace.spans.every(s=>s.ms>=0));
    assert.match(telegramServerTiming(trace), /catalog;dur=/);
    assert.doesNotMatch(JSON.stringify(trace), /must not be logged/);
  });
});

test('concurrent webhook traces never mix observations', async () => {
  const values=await Promise.all(['webhook','mini_app'].map(scope=>traceTelegram(scope, async trace=>{
    await measureTelegram(scope, async()=>new Promise(r=>setTimeout(r,scope==='webhook'?10:1)));
    return trace.spans.map(s=>s.name);
  })));
  assert.deepEqual(values,[['webhook'],['mini_app']]);
});

test('timings are bounded, grouped and HTTP header-safe', async()=>{
  await traceTelegram('mini_app',async trace=>{
    for(let i=0;i<105;i++)await measureTelegram('db settings\r\n',async()=>null);
    assert.equal(trace.spans.length,100);
    assert.match(telegramServerTiming(trace),/^db_settings__;dur=[\d.]+$/);
    assert.ok(!telegramServerTiming(trace).includes('\n'));
  });
});

test('proxy always sanitizes the Telegram document signal; agency providers stay lazy',()=>{
  const proxy=readFileSync('src/proxy.ts','utf8');
  assert.match(proxy,/requestHeaders\.delete\(TELEGRAM_SURFACE_HEADER\)/);
  assert.match(proxy,/if \(isTelegramMiniAppPath\(pathname\)\) requestHeaders\.set\(TELEGRAM_SURFACE_HEADER, "telegram"\)/);
  const loader=readFileSync('src/components/website-provider-loader.tsx','utf8');
  assert.match(loader,/"use client"/);
  assert.match(loader,/dynamic\(\(\) => import\("\.\/website-providers"\)\)/);
  assert.doesNotMatch(readFileSync('src/app/layout.tsx','utf8'),/import "\.\/(globals|gaming|universes)\.css"/);
});
