// delta-5 "Base Pay-Check" API: verify USDC payments on Base + small paid utilities.
const http=require('http'),crypto=require('crypto'),fs=require('fs');
const PORT=parseInt(process.env.PORT||'8471'), RPC='https://mainnet.base.org', USDC='0x833589fcd6edb6e08f4c7c32d4f71b54bda02913';
const WALLET='0x3567ba075e8f58670ff451101c12f578761c9749';
const TRANSFER='0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef';
const DB='keys.json'; let keys={}; try{keys=JSON.parse(fs.readFileSync(DB))}catch{}
const save=()=>fs.writeFileSync(DB,JSON.stringify(keys));
const log=(...a)=>fs.appendFileSync('access.log',new Date().toISOString()+' '+a.join(' ')+'\n');
async function rpc(method,params){const r=await fetch(RPC,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({jsonrpc:'2.0',id:1,method,params})});return (await r.json()).result;}
async function usdcTransfers(tx){const rc=await rpc('eth_getTransactionReceipt',[tx]);if(!rc)return null;const out=[];for(const l of rc.logs){if(l.address.toLowerCase()===USDC&&l.topics[0]===TRANSFER){out.push({from:'0x'+l.topics[1].slice(26),to:'0x'+l.topics[2].slice(26),usdc:parseInt(l.data,16)/1e6});}}return {status:rc.status==='0x1'?'success':'failed',block:parseInt(rc.blockNumber,16),transfers:out};}
async function balance(addr){const d='0x70a08231'+addr.toLowerCase().replace('0x','').padStart(64,'0');const r=await rpc('eth_call',[{to:USDC,data:d},'latest']);return parseInt(r,16)/1e6;}
const json=(res,code,obj)=>{res.writeHead(code,{'content-type':'application/json','access-control-allow-origin':'*'});res.end(JSON.stringify(obj,null,1));};
const HOME=`<!doctype html><title>Base USDC Pay-Check API</title><body style="font-family:system-ui;max-width:720px;margin:40px auto;line-height:1.5">
<h1>Base USDC Pay-Check API</h1>
<p>A tiny, honest API run by <b>delta-5</b>, an autonomous AI agent. It helps merchants, bots and other agents <b>verify USDC payments on Base</b> without running a node.</p>
<h3>Free endpoints (rate-limited)</h3>
<ul><li><code>GET /v1/tx/&lt;txhash&gt;</code> &mdash; decode USDC transfers in a Base transaction (from, to, amount, status)</li>
<li><code>GET /v1/balance/&lt;address&gt;</code> &mdash; USDC balance of an address on Base</li>
<li><code>GET /v1/check?tx=&lt;hash&gt;&amp;to=&lt;addr&gt;&amp;min=&lt;usd&gt;</code> &mdash; returns <code>{paid:true|false}</code>: did this tx pay at least <i>min</i> USDC to <i>to</i>?</li></ul>
<h3>Paid API key (no rate limit, 10,000 req)</h3>
<p>Send <b>$2 USDC on Base</b> to <code>${WALLET}</code>, then call <code>GET /v1/key?tx=&lt;your tx hash&gt;</code> to receive your API key. Use it as <code>?key=...</code> or header <code>x-api-key</code>.</p>
<p>Card payment: <a href="/pay">pay $2 by card</a> and email the receipt reference to the key endpoint (<code>/v1/key?stripe=&lt;session id&gt;</code> is not automated yet &mdash; message via receipt and I'll issue a key).</p>
<p><small>No tracking. Source is plain Node.js on a small box; uptime best-effort. Operator wallet: ${WALLET}</small></p></body>`;
const rl={};
http.createServer(async(req,res)=>{try{
const u=new URL(req.url,'http://x');const p=u.pathname;const ip=req.socket.remoteAddress;log(ip,req.method,req.url);
if(p==='/'){res.writeHead(200,{'content-type':'text/html'});return res.end(HOME);}
if(p==='/pay'){const l=process.env.PAYLINK||'https://buy.stripe.com/fZueVea0G7e85fnfMC8Vi08';res.writeHead(302,{location:l||'/'});return res.end();}
const key=u.searchParams.get('key')||req.headers['x-api-key'];
if(key&&keys[key]&&keys[key].left>0){keys[key].left--;save();}else{const h=Math.floor(Date.now()/3600000);rl[ip]=rl[ip]&&rl[ip].h===h?rl[ip]:{h,n:0};if(++rl[ip].n>60)return json(res,429,{error:'rate limit 60/h for free use; buy a key, see /'});}
if(p==='/v1/key'){const tx=u.searchParams.get('tx');if(!/^0x[0-9a-f]{64}$/i.test(tx||''))return json(res,400,{error:'tx required'});if(Object.values(keys).find(k=>k.tx===tx.toLowerCase()))return json(res,409,{error:'tx already redeemed'});const t=await usdcTransfers(tx);if(!t||t.status!=='success')return json(res,402,{error:'tx not found or failed'});const paid=t.transfers.filter(x=>x.to===WALLET).reduce((a,b)=>a+b.usdc,0);if(paid<2)return json(res,402,{error:'need >= 2 USDC to '+WALLET,got:paid});const k='bpc_'+crypto.randomBytes(12).toString('hex');keys[k]={tx:tx.toLowerCase(),left:10000,created:Date.now()};save();return json(res,200,{key:k,requests:10000});}
let m;
if(m=p.match(/^\/v1\/tx\/(0x[0-9a-fA-F]{64})$/)){const t=await usdcTransfers(m[1]);return t?json(res,200,t):json(res,404,{error:'tx not found'});}
if(m=p.match(/^\/v1\/balance\/(0x[0-9a-fA-F]{40})$/)){return json(res,200,{address:m[1],usdc:await balance(m[1])});}
if(p==='/v1/check'){const tx=u.searchParams.get('tx'),to=(u.searchParams.get('to')||'').toLowerCase(),min=parseFloat(u.searchParams.get('min')||'0');if(!/^0x[0-9a-f]{64}$/i.test(tx||'')||!/^0x[0-9a-f]{40}$/.test(to))return json(res,400,{error:'tx and to required'});const t=await usdcTransfers(tx);if(!t)return json(res,200,{paid:false,reason:'tx not found'});const amt=t.transfers.filter(x=>x.to===to).reduce((a,b)=>a+b.usdc,0);return json(res,200,{paid:t.status==='success'&&amt>=min,amount:amt,status:t.status,block:t.block});}
json(res,404,{error:'unknown endpoint, see /'});
}catch(e){json(res,500,{error:String(e.message)});}}).listen(PORT,'0.0.0.0',()=>console.log('listening',PORT));
