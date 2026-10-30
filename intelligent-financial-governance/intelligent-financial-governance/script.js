const KEY = 'ifg-v1';
const CATS = ['Travel','Software','Office','Marketing','Utilities'];
const fmt = n => '₹' + Math.round(n).toLocaleString('en-IN');
const esc = s => String(s).replace(/[&<>"]/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today = new Date().toISOString().slice(0,10);
const monthOf = d => d.slice(0,7);

function demo(){
  const d = (n) => { const x = new Date(); x.setDate(x.getDate()-n); return x.toISOString().slice(0,10); };
  const seed = [
    [20,'Skyline Airways','Travel',18500],[18,'Cloudbase','Software',9200],[15,'Office Mart','Office',4300],
    [12,'AdReach','Marketing',22000],[10,'City Power','Utilities',7600],[8,'Office Mart','Office',3900],
    [6,'Cloudbase','Software',9200],[3,'Skyline Airways','Travel',21000]
  ];
  return {
    policy:{limit:50000, z:2, blocked:'QuickCash Ltd', budgets:{Travel:60000,Software:25000,Office:15000,Marketing:50000,Utilities:20000}},
    tx: seed.map((s,i)=>({id:i+1,date:d(s[0]),merchant:s[1],category:s[2],amount:s[3],risk:0,flags:[],status:'approved'})),
    log:['System started with demo data.'], next:20
  };
}
let S;
try { S = JSON.parse(localStorage.getItem(KEY)); } catch(e){}
if(!S || !S.policy) S = demo();
function save(){ try{ localStorage.setItem(KEY, JSON.stringify(S)); }catch(e){} }
function log(m){ S.log.unshift(new Date().toLocaleTimeString()+' – '+m); S.log = S.log.slice(0,60); }

/* Rules engine: returns {risk, flags, needsApproval, blocked} */
function evaluate(t, history){
  const p = S.policy, flags = []; let risk = 0, needs = false, blocked = false;
  const blockedList = p.blocked.split(',').map(x=>x.trim().toLowerCase()).filter(Boolean);
  if(blockedList.includes(t.merchant.toLowerCase())){ flags.push('Merchant is on the blocked list'); risk += 70; blocked = true; }
  if(t.amount > p.limit){ flags.push('Above approval limit of '+fmt(p.limit)); risk += 30; needs = true; }
  const same = history.filter(h => h.category === t.category && h.status !== 'rejected');
  if(same.length >= 3){
    const mean = same.reduce((a,h)=>a+h.amount,0)/same.length;
    const sd = Math.sqrt(same.reduce((a,h)=>a+(h.amount-mean)**2,0)/same.length) || mean*0.1;
    const z = (t.amount-mean)/sd;
    if(z > p.z){ flags.push('Unusual for '+t.category+' (z-score '+z.toFixed(1)+', typical '+fmt(mean)+')'); risk += Math.min(35, 10+z*6); needs = true; }
  }
  const dup = history.find(h => h.merchant.toLowerCase()===t.merchant.toLowerCase() && h.amount===t.amount && Math.abs(new Date(h.date)-new Date(t.date)) < 3*864e5);
  if(dup){ flags.push('Possible duplicate of a payment on '+dup.date); risk += 25; needs = true; }
  const spent = history.filter(h => h.category===t.category && monthOf(h.date)===monthOf(t.date) && h.status!=='rejected').reduce((a,h)=>a+h.amount,0);
  const budget = p.budgets[t.category] || 0;
  if(budget && spent + t.amount > budget){ flags.push('Pushes '+t.category+' over its monthly budget'); risk += 20; needs = true; }
  return {risk:Math.min(100,Math.round(risk)), flags, needs, blocked};
}
const level = r => r >= 60 ? 'high' : r >= 30 ? 'med' : 'low';
const levelText = r => r >= 60 ? 'High' : r >= 30 ? 'Medium' : 'Low';

function addTx(){
  const date = document.getElementById('fDate').value, amount = +document.getElementById('fAmt').value;
  const merchant = document.getElementById('fMer').value.trim(), category = document.getElementById('fCat').value;
  if(!date || !(amount>0) || !merchant){ alert('Enter a date, a merchant and an amount above zero.'); return; }
  const t = {id:S.next++, date, merchant, category, amount};
  const r = evaluate(t, S.tx);
  t.risk = r.risk; t.flags = r.flags;
  t.status = r.blocked ? 'rejected' : r.needs ? 'pending' : 'approved';
  S.tx.push(t);
  log(`${fmt(amount)} to ${merchant}: ${t.status}${r.flags.length?' ('+r.flags.length+' flag'+(r.flags.length>1?'s':'')+')':''}.`);
  document.getElementById('fAmt').value=''; document.getElementById('fMer').value='';
  save(); render();
}
function decide(id, status){
  const t = S.tx.find(x=>x.id===id); if(!t) return;
  t.status = status; log(`Approver ${status} ${fmt(t.amount)} to ${t.merchant}.`); save(); render();
}

function render(){
  const month = monthOf(today);
  const active = S.tx.filter(t=>t.status!=='rejected');
  const monthSpend = active.filter(t=>monthOf(t.date)===month).reduce((a,t)=>a+t.amount,0);
  const pending = S.tx.filter(t=>t.status==='pending');
  const flagged = S.tx.filter(t=>t.flags && t.flags.length).length;
  const avg = S.tx.length ? Math.round(S.tx.reduce((a,t)=>a+t.risk,0)/S.tx.length) : 0;
  document.getElementById('kpis').innerHTML = [
    [fmt(monthSpend),'Spend this month'],[pending.length,'Awaiting approval'],[flagged,'Flagged transactions'],[avg+' / 100','Average risk score']
  ].map(k=>`<div class="panel kpi"><b>${k[0]}</b><span>${k[1]}</span></div>`).join('');

  document.getElementById('budgetBars').innerHTML = CATS.map(c=>{
    const used = active.filter(t=>t.category===c && monthOf(t.date)===month).reduce((a,t)=>a+t.amount,0);
    const b = S.policy.budgets[c]||0, pct = b ? Math.min(100, used/b*100) : 0;
    return `<div><div style="display:flex;justify-content:space-between"><span>${c}</span><span class="empty">${fmt(used)} of ${fmt(b)}</span></div>
      <div class="bar"><i class="${used>b?'over':''}" style="width:${pct}%"></i></div></div>`;
  }).join('');

  document.getElementById('queue').innerHTML = pending.length ? pending.map(t=>`
    <div style="padding:8px 0;border-bottom:1px solid var(--line)">
      <div style="display:flex;justify-content:space-between;gap:8px"><strong>${esc(t.merchant)}</strong><span>${fmt(t.amount)}</span></div>
      <ul class="flags">${t.flags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>
      <div style="margin-top:6px;display:flex;gap:8px"><button class="primary" data-a="approved" data-id="${t.id}">Approve</button><button data-a="rejected" data-id="${t.id}">Reject</button></div>
    </div>`).join('') : '<p class="empty">Nothing to review. Transactions that break a policy appear here.</p>';

  document.getElementById('txBody').innerHTML = S.tx.slice().sort((a,b)=>b.date.localeCompare(a.date)||b.id-a.id).map(t=>`
    <tr><td>${t.date}</td><td>${esc(t.merchant)}${t.flags&&t.flags.length?`<ul class="flags">${t.flags.map(f=>`<li>${esc(f)}</li>`).join('')}</ul>`:''}</td>
    <td>${t.category}</td><td class="n">${fmt(t.amount)}</td>
    <td><span class="badge ${level(t.risk)}">${levelText(t.risk)} ${t.risk}</span></td>
    <td><span class="badge ${t.status}">${t.status[0].toUpperCase()+t.status.slice(1)}</span></td></tr>`).join('');

  document.getElementById('log').innerHTML = S.log.map(l=>`<div>${esc(l)}</div>`).join('');
}

/* Setup */
const catSel = document.getElementById('fCat');
catSel.innerHTML = CATS.map(c=>`<option>${c}</option>`).join('');
document.getElementById('fDate').value = today;
document.getElementById('budgets').innerHTML = CATS.map(c=>`<label>${c}<input type="number" min="0" data-b="${c}"></label>`).join('');
function loadPolicy(){
  document.getElementById('pLimit').value = S.policy.limit;
  document.getElementById('pZ').value = S.policy.z;
  document.getElementById('pBlock').value = S.policy.blocked;
  document.querySelectorAll('[data-b]').forEach(i=>i.value = S.policy.budgets[i.dataset.b]);
}
function readPolicy(){
  S.policy.limit = +document.getElementById('pLimit').value || 0;
  S.policy.z = +document.getElementById('pZ').value || 2;
  S.policy.blocked = document.getElementById('pBlock').value;
  document.querySelectorAll('[data-b]').forEach(i=>S.policy.budgets[i.dataset.b] = +i.value || 0);
  log('Policies updated.'); save(); render();
}
document.querySelectorAll('#pLimit,#pZ,#pBlock,[data-b]').forEach(i=>i.addEventListener('change', readPolicy));
document.getElementById('addBtn').addEventListener('click', addTx);
document.getElementById('queue').addEventListener('click', e=>{ const b=e.target.closest('button[data-id]'); if(b) decide(+b.dataset.id, b.dataset.a); });
document.getElementById('reset').addEventListener('click', ()=>{ S = demo(); save(); loadPolicy(); render(); });
loadPolicy(); render();
