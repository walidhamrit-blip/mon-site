/* Actual webhook handler, deterministic I/O doubles (not production latency).
 * node scripts/telegram-performance.webhook.cjs baseline
 * Measures authenticated menu:orders callbacks. Never calls Telegram or a DB.
 */
const esbuild = require('esbuild');
const {execFileSync} = require('node:child_process');
const ref=process.argv[3];
const fs = require('node:fs/promises');
const path = require('node:path');
const assert = require('node:assert/strict');
const label=(process.argv[2]||'sample').replace(/[^a-zA-Z0-9_-]/g,'');
const dir=path.resolve('.scratch/telegram-performance');
(async()=>{
await fs.mkdir(dir,{recursive:true});
const telegramMock=path.join(dir,'telegram-mock.ts');
await fs.writeFile(telegramMock, `
import { measureTelegram } from ${JSON.stringify(path.resolve('src/lib/telegram-performance.ts'))};
const wait=(ms:number)=>new Promise(r=>setTimeout(r,ms));
export const calls:string[]=[];
export const telegramConfigured=()=>true;
export const telegramConfig=()=>({token:'test',adminChatId:'',botUsername:'test'});
export const resolveWebhookSecret=async()=>{await wait(20);return 'test-secret'};
export const getTelegramSubscriber=async()=>{await wait(80);return {language:'en',username:null,firstName:null}};
export const telegramApi=async(method:string)=>measureTelegram('network_'+method,async()=>{calls.push(method);await wait(120);return {ok:true}});
export const editTelegramMessage=async()=>measureTelegram('network_editMessageText',async()=>{calls.push('editMessageText');await wait(100);return {ok:true}});
export const sendTelegramMessage=async()=>{throw Error('Unexpected sendMessage fallback')};
export const saveTelegramSubscriber=async()=>{throw Error('Unexpected subscriber write')};
export const clearTelegramPendingCheckout=async()=>{};
export const findOrderForBot=async()=>null;
export const notifyTelegramAdmin=async()=>{};
export const recordTelegramMessage=async()=>{};
export const setTelegramLanguage=async()=>{};
export const setTelegramMarketingOptIn=async()=>{};
`);
const stubs={
'@/lib/telegram':{file:telegramMock},
'@/lib/store':{code:`export async function getSiteDataCached(){await new Promise(r=>setTimeout(r,100));return {config:{name:'Nokhba',whatsapp:'',email:''}}}`},
'@/lib/telegram-shop':{code:`export async function handleShopCallback(){return false} export async function handleShopEmailInput(){return false} export async function openTelegramShop(){} export async function openTelegramShopCategory(){}`},
'@/lib/telegram-delivery':{code:`export function formatWatchConfirmation(){return ''} export async function watchOrderFromTelegram(){return {ok:false}}`},
};
await esbuild.build({entryPoints:['src/app/api/telegram/webhook/route.ts'],bundle:true,platform:'node',format:'cjs',outfile:path.join(dir,'webhook.cjs'),packages:'external',plugins:[{name:'io-doubles',setup(build){
 build.onResolve({filter:/^@\/lib\//},args=>{
  const stub=stubs[args.path];if(!stub)return;
  return stub.file?{path:stub.file}:{path:args.path,namespace:'stub'};
 });
 build.onLoad({filter:/.*/,namespace:'stub'},args=>({contents:stubs[args.path].code,loader:'ts'}));
 if(ref)build.onLoad({filter:/src\/app\/api\/telegram\/webhook\/route\.ts$/},args=>({contents:execFileSync('git',['show',ref+':src/app/api/telegram/webhook/route.ts'],{encoding:'utf8'}),loader:'ts',resolveDir:path.dirname(args.path)}));
}}]});
const {POST}=require(path.join(dir,'webhook.cjs'));
const samples=[];
for(let i=0;i<21;i++){
 const req=new Request('http://localhost/api/telegram-webhook',{method:'POST',headers:{'Content-Type':'application/json','x-telegram-bot-api-secret-token':'test-secret'},body:JSON.stringify({update_id:i,callback_query:{id:'test',data:'menu:orders',from:{id:1},message:{message_id:1,chat:{id:1,type:'private'}}}})});
 const start=performance.now();const res=await POST(req);const ms=performance.now()-start;
 assert.equal(res.status,200);assert.deepEqual(await res.json(),{ok:true});
 samples.push({ms,serverTiming:res.headers.get('Server-Timing')});
}
// Authentication semantics must be unchanged, even after scheduling changes.
assert.equal((await POST(new Request('http://localhost/api/telegram-webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'wrong'},body:'{}'}))).status,401);
assert.equal((await POST(new Request('http://localhost/api/telegram-webhook',{method:'POST',headers:{'x-telegram-bot-api-secret-token':'test-secret'},body:'broken'}))).status,400);
const ordered=samples.slice(1).map(s=>s.ms).sort((a,b)=>a-b);
const result={label,ref:ref||'working-tree',scope:'Actual route handler, menu:orders; simulated I/O: secret 20ms, callback ACK 120ms, site 100ms, subscriber 80ms, edit 100ms. NO real Telegram/DB latency.',runs:ordered.length,medianMs:(ordered[ordered.length/2-1]+ordered[ordered.length/2])/2,p95Ms:ordered[Math.ceil(ordered.length*.95)-1],samples};
await fs.writeFile(path.join(dir,`${label}.webhook.json`),JSON.stringify(result,null,2));
console.log(JSON.stringify(result,null,2));
})().catch(e=>{console.error(e);process.exitCode=1});
