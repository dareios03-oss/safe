(function(){
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MS=MONTHS.map(m=>m.slice(0,3));
const fmt=n=>{const r=Math.round(+n||0);return (r<0?"-":"")+String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g,"\u2019");};
const chf=n=>"CHF "+fmt(n);
const parse=s=>{const v=parseFloat(String(s).replace(/[^0-9.\-]/g,""));return isNaN(v)?0:v};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const POTCOL=["#E0457B","#2DA44E","#6C63FF","#B7791F","#0EA5E9"];

const VERSION="1.1.8";

/* ---------- state ---------- */
function emptyData(){return {months:[],start:{cash:0,property:0,holiday:0,stockValue:0,paid:0},pots:[],nextGoal:0};}
const S=Object.assign(emptyData(),{fi:1000000,holidayTarget:4000,equity:20,reserve:0,pp:{income:0,rate:5,upkeep:1,amortTo:66.7,amortYears:15,share:33.3},ret:5,emergency:18000,reminder:false,tab:"home",hmode:"quarter",hkey:null,
  lastBackup:null,backupYm:null,createdYm:null,setupDone:false,welcomed:false,demo:false,lastDuePrompt:null,today:{y:2000,m:1,d:1}});
let REAL=null;
const PKEYS=["months","start","pots","nextGoal","fi","holidayTarget","equity","reserve","pp","ret","emergency","reminder","hmode","lastBackup","backupYm","createdYm","setupDone","welcomed","demo","lastDuePrompt"];
function refreshToday(){const d=new Date();S.today={y:d.getFullYear(),m:d.getMonth()+1,d:d.getDate()};}
refreshToday();
let saveT=null,ready=false;
function persist(){if(!ready)return;const o={version:1};PKEYS.forEach(k=>o[k]=S[k]);o.real=REAL;SafeStore.save(o);}
function normalize(){
  S.months.forEach(r=>{if(!r.pots)r.pots={};});
  S.months.sort((x,y)=>ym(x.y,x.m)-ym(y.y,y.m));
  S.start=Object.assign({cash:0,property:0,holiday:0,stockValue:0,paid:0},S.start||{});
  if(!Array.isArray(S.pots))S.pots=[];
}

/* demo person: 21 months ending with the last month before today */
function demoData(){
  const ms=[],t=ym(S.today.y,S.today.m)-1,first=t-20;
  const gains=[120,-80,210,150,90,-140,260,180,340,60,-40,190,110,230,-120,170,80,260,140,-60,200];
  let v=4000;
  for(let k=first;k<=t;k++){const i=k-first,y=Math.floor(k/12),m=k%12+1;
    const saved=[2300,2430,2430,2370,2455,2720,2195,2985,2635,2500,2380,2610][i%12],income=8775;
    const pots=i>=9?{demo1:200}:{};const st=1080,pr=405,ho=200;
    v=v+st+gains[i%gains.length]*1.35;
    ms.push({y,m,income,saved,stocks:st,property:pr,holiday:ho,pots,cash:saved-st-pr-ho-(pots.demo1||0),stockValue:Math.round(v),goal:2700,est:false});}
  return {months:ms,start:{cash:9000,property:1500,holiday:300,stockValue:4000,paid:3600},pots:[{id:"demo1",name:"New car",target:12000,fi:false,color:"#E0457B"}],nextGoal:2700};
}
function enterDemo(){if(S.demo)return;REAL={months:S.months,start:S.start,pots:S.pots,nextGoal:S.nextGoal,lastBackup:S.lastBackup,backupYm:S.backupYm};Object.assign(S,demoData(),{demo:true,hkey:null,lastBackup:new Date().toISOString(),backupYm:ym(S.today.y,S.today.m)});}
function leaveDemo(){if(!S.demo)return;Object.assign(S,REAL||emptyData(),{demo:false,hkey:null});REAL=null;}
const backupLabel=()=>S.lastBackup?new Date(S.lastBackup).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):"never";
const backupOverdue=()=>S.months.length>0&&ym(S.today.y,S.today.m)-(S.backupYm??S.createdYm??ym(S.today.y,S.today.m))>=2;

const potOutOf=r=>S.pots.filter(p=>!p.fi).reduce((a,p)=>a+((r.pots||{})[p.id]||0),0);
function bal(i){
  const b={cash:S.start.cash,property:S.start.property,holiday:S.start.holiday,paid:S.start.paid||0,value:S.start.stockValue||0,pots:{}};
  S.pots.forEach(p=>b.pots[p.id]=0);
  for(let k=0;k<=i&&k<S.months.length;k++){const r=S.months[k];b.cash+=r.cash;b.property+=r.property;b.holiday+=r.holiday;b.paid+=r.stocks;b.value=r.stockValue;for(const id in (r.pots||{}))if(id in b.pots)b.pots[id]+=r.pots[id];}
  b.potSum=S.pots.reduce((a,p)=>a+b.pots[p.id],0);
  b.potOut=S.pots.filter(p=>!p.fi).reduce((a,p)=>a+b.pots[p.id],0);
  b.nw=b.cash+b.value+b.property+b.holiday+b.potSum;b.fi=b.nw-b.holiday-b.potOut;b.gain=b.value-b.paid;return b;
}
const L=()=>S.months.length-1;
const cur=()=>S.months[L()]||null;
const blank=()=>({y:S.today.y,m:S.today.m,income:0,saved:0,stocks:0,property:0,holiday:0,cash:0,stockValue:0,goal:0,pots:{}});
const ym=(y,m)=>y*12+m-1;
function dueMonth(){const r=cur();if(!r)return {y:S.today.y,m:S.today.m};const n=ym(r.y,r.m)+1;if(n>ym(S.today.y,S.today.m))return null;return {y:Math.floor(n/12),m:n%12+1};}
const isLogged=()=>!dueMonth();
const isBehind=()=>{const d=dueMonth();return !!d&&ym(d.y,d.m)<ym(S.today.y,S.today.m);};
function avgSave(n){const xs=S.months.slice(-n);return xs.length?xs.reduce((a,r)=>a+r.saved-r.holiday-potOutOf(r),0)/xs.length:0;}
function projYear(base){
  if(base>=S.fi)return "reached";
  const c=avgSave(12),r=S.ret/100/12;let P=base,n=0;
  while(P<S.fi&&n<1200){P=P*(1+r)+c;n++;}
  if(n>=1200)return "–";
  const lr=cur()||blank();return Math.floor((ym(lr.y,lr.m)+n)/12);
}
const lastIdx=(y,m)=>{let k=-1;S.months.forEach((r,i)=>{if(ym(r.y,r.m)<=ym(y,m))k=i;});return k;};
function day24(y,m){return new Date(y,m-1,24).toLocaleDateString("en-GB",{weekday:"long"});}

/* ---------- icons ---------- */
const IC={
 home:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z"/></svg>',
 checkin:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="9"/><path d="M12 8v8M8 12h8"/></svg>',
 history:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><path d="M5 20V11M12 20V5M19 20v-6"/></svg>',
 goals:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9"><circle cx="12" cy="12" r="9"/><circle cx="12" cy="12" r="5"/><circle cx="12" cy="12" r="1"/></svg>',
 settings:'<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round"><circle cx="12" cy="12" r="3"/><path d="M12 2v3M12 19v3M2 12h3M19 12h3M4.9 4.9L7 7M17 17l2.1 2.1M4.9 19.1L7 17M17 7l2.1-2.1"/></svg>',
 plus:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round" aria-hidden="true"><path d="M12 5v14M5 12h14"/></svg>',
 chev:'<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 9l6 6 6-6"/></svg>',
 house:'<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" aria-hidden="true"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1z"/></svg>'
};
const appIcon='<svg class="appicon" viewBox="0 0 160 160" aria-hidden="true"><defs><clipPath id="sfiDc"><rect width="160" height="160" rx="36"/></clipPath></defs><g clip-path="url(#sfiDc)"><defs><filter id="sfiDb" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="16"/></filter><mask id="sfiDm"><g transform="translate(80,80) scale(.84) translate(-80,-75)"><circle cx="80" cy="75" r="50" fill="none" stroke="#fff" stroke-width="13"/><path d="M80 75V47M80 75L104 89M80 75L56 89" stroke="#fff" stroke-width="12" stroke-linecap="round" fill="none"/><circle cx="80" cy="47" r="10" fill="#fff"/><circle cx="104" cy="89" r="10" fill="#fff"/><circle cx="56" cy="89" r="10" fill="#fff"/><circle cx="80" cy="75" r="16" fill="#fff"/></g></mask></defs><rect width="160" height="160" fill="#FFFFFF"/><g mask="url(#sfiDm)"><g filter="url(#sfiDb)"><circle cx="35" cy="30" r="62" fill="#6E8BFF"/><circle cx="135" cy="45" r="55" fill="#C77DFF"/><circle cx="35" cy="130" r="55" fill="#FFB27A"/><circle cx="130" cy="130" r="52" fill="#46D6C4"/></g></g></g><rect x=".5" y=".5" width="159" height="159" rx="35.5" fill="none" stroke="rgba(11,16,32,.08)"/></svg>';

/* ---------- first property: equity and income limit ---------- */
const fmtPct=v=>(Math.round(v*10)/10).toString().replace(/\.0$/,"")+"%";
const PPDEF={income:0,rate:5,upkeep:1,amortTo:66.7,amortYears:15,share:33.3};
function propCalc(b){
  const pp=Object.assign({},PPDEF,S.pp||{});
  const e=S.equity/100,reserve=S.reserve||0,usable=Math.max(b.property-reserve,0),byEq=e>0?usable/e:0;
  const l12=S.months.slice(-12),incAuto=l12.length?l12.reduce((a,r)=>a+r.income,0)/l12.length*12:0,inc=pp.income>0?pp.income:incAuto;
  const rate=pp.rate/100*(1-e)+pp.upkeep/100+Math.max(0,(1-e)-pp.amortTo/100)/Math.max(pp.amortYears,1);
  const byInc=inc&&rate>0?Math.floor(inc*pp.share/100/rate/1000)*1000:0,max=inc?Math.min(byEq,byInc):byEq,limit=!inc?"equity":byEq<=byInc?"equity":"income";
  return {e,pp,reserve,usable,byEq,byInc,inc,incAuto,manualInc:pp.income>0,rate,max,limit,need:max*e,cost:max*rate/12};
}
function propCard(b){
  const p=propCalc(b),top=Math.max(p.byEq,p.byInc,1);
  const bar=(label,v,on)=>`<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:13px"><span class="muted">${label}</span><span class="num" style="${on?"color:var(--ink)":"color:var(--muted)"}">${p.inc||label.indexOf("income")<0?chf(v):"no income yet"}</span></div><span style="height:7px;border-radius:4px;background:var(--track);overflow:hidden"><span style="display:block;height:7px;width:${Math.min(v/top*100,100)}%;background:${on?"var(--prop)":"var(--soft)"};opacity:${on?1:.45}"></span></span></div>`;
  return `<section class="card glass" data-act="info" data-k="prop" role="button" tabindex="0" aria-label="First property details">
    <div style="display:flex;align-items:center;gap:12px"><span style="width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--warnbg);color:var(--prop);flex:none">${IC.house}</span><span style="flex:1;font-size:17px;font-weight:600">First property</span><span class="pill warn" style="align-self:center">Limited by ${p.limit}</span></div>
    <div style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:13px">Can buy up to</span><span class="big" style="font-size:34px">${chf(p.max)}</span></div>
    ${bar("With your equity",p.byEq,p.limit==="equity")}${bar("With your income",p.byInc,p.limit==="income")}
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px solid var(--line);padding-top:10px">
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:12px">Property savings</span><span class="num" style="font-size:15px">${chf(b.property)}</span></span>
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:12px">Safety reserve</span><span class="num" style="font-size:15px">${p.reserve?"−"+fmt(p.reserve):"0"}</span></span>
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:12px">Equity needed (${S.equity}%)</span><span class="num" style="font-size:15px">${chf(p.need)}</span></span>
    </div>
    <span class="muted" style="font-size:13px">At this price: about ${chf(p.cost)}/month housing costs${p.inc?` · max. ${fmtPct(p.pp.share)} of your income`:""} · tap to adjust</span>
  </section>`;
}

function propResults(){
  const b=bal(L()),p=propCalc(b);
  return `<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px"><span class="big">${chf(p.max)}</span><span class="muted">maximum price · limited by your ${p.limit}</span></div>
  ${(()=>{const kv=rows=>`<div class="field">${rows.map(x=>`<div class="kv"><span class="muted">${x[0]}</span><b>${x[1]}</b></div>`).join("")}</div>`;
  return kv([["Property savings",chf(b.property)],["− Safety reserve",chf(p.reserve)],["= Usable equity",chf(p.usable)],[`Price with ${fmtPct(S.equity)} down payment`,chf(p.byEq)],[`Income per year${p.manualInc?" (entered)":" (check-ins)"}`,p.inc?chf(p.inc):"–"],["Price your income allows",p.inc?chf(p.byInc):"–"],["Mortgage at max. price",chf(p.max-p.need)],["Housing costs (calculated)",chf(p.cost)+"/month"]]);})()}`;
}
function wireProp(){
  const res=document.getElementById("pp-res");if(!res)return;res.innerHTML=propResults();
  const sh=res.closest(".sheet");
  sh.addEventListener("input",e=>{const id=e.target.dataset.pp;if(!id)return;const v=parse(e.target.value);
    if(id==="eq"){if(v>0&&v<=100)S.equity=v;}else if(id==="reserve"){S.reserve=Math.max(v,0);}
    else{S.pp=Object.assign({},PPDEF,S.pp||{});if(id==="income")S.pp.income=e.target.value.trim()===""?0:Math.max(v,0);else if(v>=0)S.pp[id]=v;}
    res.innerHTML=propResults();persist();});
  sh.addEventListener("focusout",()=>{render(true);});
  sh.addEventListener("focusin",e=>{if(e.target.matches("input"))setTimeout(()=>e.target.select(),0);});
}
/* ---------- views ---------- */
function home(){
  const i=L(),b=bal(i),p=bal(i-1),has=!!cur(),r=cur()||blank();
  const delta=has?b.nw-p.nw:0, fiBase=b.fi, fiPct=fiBase/S.fi*100, rate=r.income?r.saved/r.income*100:0;
  const l6=S.months.slice(-6), avg=l6.length?l6.reduce((a,x)=>a+(x.income?x.saved/x.income:0),0)/l6.length*100:0;
  const circ=2*Math.PI*25, dash=Math.min(rate,100)/100*circ;
  const ep=S.emergency>0?Math.min(Math.max(b.cash,0)/S.emergency,1):0;
  const cashSub=S.emergency>0?`<span style="display:flex;flex-direction:column;gap:4px;margin-top:3px"><span class="muted" style="font-size:12px">${ep>=1?'<b style="color:var(--good)">✓ Emergency fund filled</b>':`Emergency fund ${Math.round(ep*100)}% · ${chf(S.emergency-b.cash)} to go`}</span><span style="height:4px;border-radius:2px;background:var(--track);overflow:hidden;max-width:180px"><span style="display:block;height:4px;width:${ep*100}%;background:${ep>=1?"var(--goodline)":"var(--cash)"}"></span></span></span>`:"";
  const cat=[{n:"Cash savings",v:b.cash,c:"var(--cash)",k:"cat",a:"cash",subHtml:cashSub},{n:"Stocks · paid in",v:b.value,show:b.paid,c:"var(--stocks)",sub:`current value ${fmt(b.value)} (${b.gain>=0?"+":"−"}${fmt(Math.abs(b.gain))}) · volatile`,k:"cat",a:"stocks"},{n:"Property savings",v:b.property,c:"var(--prop)",k:"cat",a:"property"},{n:"Holiday budget",v:b.holiday,c:"var(--hol)",nofi:true,k:"cat",a:"holiday"}]
    .concat(S.pots.map(pt=>({n:esc(pt.name),v:b.pots[pt.id],c:pt.color,nofi:!pt.fi,k:"pot",a:pt.id})));
  const d=dueMonth();
  return `
  <div class="head"><div><div class="eyebrow">${has?`Latest check-in · ${MONTHS[r.m-1]} ${r.y}`:"No check-ins yet"}</div><h1>Overview</h1></div>
  <button class="btn round" data-act="sheet" aria-label="New check-in">${IC.plus}</button></div>
  ${isBehind()?`<button class="card glass" data-act="tab" data-tab="checkin" style="flex-direction:row;align-items:center;gap:12px;padding:14px 18px;text-align:left"><span class="pill warn" style="align-self:center">Late</span><span style="flex:1;font-size:15px;font-weight:600">${MONTHS[d.m-1]} check-in is still open</span><span style="color:var(--accent);font-weight:600;font-size:20px" aria-hidden="true">›</span></button>`:""}
  ${backupOverdue()?`<button class="card glass" data-act="backup" style="flex-direction:row;align-items:center;gap:12px;padding:14px 18px;text-align:left"><span class="pill warn" style="align-self:center">Backup</span><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:15px;font-weight:600">${S.lastBackup?"Last backup: "+backupLabel():"No backup yet"}</span><span class="muted" style="font-size:13px">Download one to your Files so your data is safe</span></span><span style="color:var(--accent);font-weight:600;font-size:15px">Back up</span></button>`:""}
  <section class="card glass" data-act="info" data-k="nw" role="button" tabindex="0" aria-label="Net worth details">
    <div style="display:flex;flex-direction:column;gap:6px"><span class="muted" style="font-size:15px">Net worth</span>
    <span class="big">${chf(b.nw)}</span>
    <span class="pill ${delta>=0?"good":"warn"}" style="margin-top:4px">${delta>=0?"▲":"▼"} ${chf(Math.abs(delta))} this month</span></div>
    <div class="split" aria-hidden="true">${cat.map(c=>`<span style="flex:${Math.max(c.v,0)};background:${c.c}"></span>`).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:12px">${cat.map(c=>`
      <div class="catrow" data-act="info" data-k="${c.k}" data-a="${c.a}" role="button" tabindex="0" aria-label="${c.n} details"><span class="dot" style="background:${c.c};box-shadow:0 0 10px ${c.c}"></span>
      <span style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:17px">${c.n}</span>${c.sub?`<span class="muted" style="font-size:12px">${c.sub}</span>`:""}${c.subHtml||""}</span>
      ${c.nofi?`<span class="pill" style="color:var(--muted);background:var(--field);border-color:var(--fieldb);align-self:center;font-size:11px">not in FI</span>`:""}
      <span class="num" style="font-size:17px">${fmt(c.show!=null?c.show:c.v)}</span></div>`).join("")}</div>
  </section>
  <div style="display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:12px">
    <button class="card glass" data-act="tab" data-tab="history" style="text-align:left;flex-direction:row;align-items:center;gap:10px;padding:16px">
      <svg width="58" height="58" viewBox="0 0 60 60" aria-hidden="true" style="flex:none"><circle cx="30" cy="30" r="25" fill="none" stroke="var(--track)" stroke-width="7"/><circle cx="30" cy="30" r="25" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 30 30)"/><text x="30" y="35" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">${Math.round(rate)}%</text></svg>
      <span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:15px;font-weight:600">Savings rate</span><span class="muted" style="font-size:13px">avg ${Math.round(avg)}%</span></span>
    </button>
    <button class="card glass" data-act="tab" data-tab="goals" style="text-align:left;gap:6px;padding:16px">
      <span style="font-size:15px;font-weight:600">FI goal</span><span style="font-size:26px;font-weight:700">${fiPct.toFixed(1)}%</span>
      <span class="track" style="flex:none;height:7px"><span style="width:${Math.min(fiPct,100)}%"></span></span>
      <span class="muted" style="font-size:13px">of ${S.fi>=1e6?(S.fi/1e6)+"M":fmt(S.fi)} · ≈ ${projYear(fiBase)}</span>
    </button>
  </div>
  ${propCard(b)}`;
}

function checkin(){
  const r=cur(),d=dueMonth();
  if(!d){
    const reached=r.goal&&r.saved>=r.goal;
    return `<div><div class="eyebrow">Monthly check-in</div><h1>${MONTHS[r.m-1]} ${r.y}</h1></div>
    <section class="card glass" data-act="info" data-k="goalm" role="button" tabindex="0" aria-label="Monthly goal details"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">${MONTHS[r.m-1]} is logged</span><span class="pill ${reached?"good":"warn"}">${fmt(r.saved)} of ${fmt(r.goal||0)} goal</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">Goal for ${MONTHS[r.m%12]}</span><span style="font-size:22px;font-weight:700">${S.nextGoal?chf(S.nextGoal):"not set"}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">Next check-in</span><span class="num">24 ${MONTHS[r.m%12]}</span></div></section>
    <button class="btn" data-act="edit" data-i="${L()}" style="margin-top:60px">Edit ${MONTHS[r.m-1]} check-in</button>`;
  }
  const m=d.m,dn=MONTHS[m-1];
  const lastRow=r?`<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:12px"><span class="muted" style="font-size:15px">Last check-in (${MONTHS[r.m-1]})</span><span class="pill ${r.goal&&r.saved>=r.goal?"good":"warn"}" style="align-self:center">${r.goal?`${fmt(r.saved)} of ${fmt(r.goal)} goal`:`${fmt(r.saved)} saved`}</span></div>`
    :`<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:12px"><span class="muted" style="font-size:15px">Last check-in</span><span class="muted" style="font-size:15px">none yet</span></div>`;
  if(isBehind()){
    return `<div><div class="eyebrow">Monthly check-in · late</div><h1>${dn} ${d.y}</h1></div>
    <section class="card glass" data-act="info" data-k="late" role="button" tabindex="0" aria-label="Why ${dn} comes first">
      <span class="pill warn">Not logged yet</span>
      <span style="font-size:17px;line-height:1.4">You missed the ${dn} check-in. Log it now with your numbers from the end of ${dn}, then ${MONTHS[S.today.m-1]} is next.</span>
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:15px">Goal for ${dn}</span><span style="font-size:22px;font-weight:700">${S.nextGoal?chf(S.nextGoal):"not set"}</span></div>
      ${lastRow}
    </section>
    <button class="btn" data-act="sheet" style="margin-top:80px">${IC.plus}<span>Check in ${dn}</span></button>`;
  }
  return `<div><div class="eyebrow">Monthly check-in</div><h1>${dn} ${d.y}</h1></div>
  <section class="card glass" data-act="info" data-k="goalm" role="button" tabindex="0" aria-label="Monthly goal details">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:15px">Goal for ${dn}</span><span style="font-size:22px;font-weight:700">${S.nextGoal?chf(S.nextGoal):"not set"}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:15px">Due</span><span style="font-size:17px;font-weight:600">${day24(d.y,m)}, 24 ${dn}</span></div>
    ${lastRow}
  </section>
  <button class="btn" data-act="sheet" style="margin-top:80px">${IC.plus}<span>Check in</span></button>`;
}

function periods(mode){
  const map=new Map();
  S.months.forEach((r,i)=>{const k=mode==="month"?`${r.y}-${r.m}`:mode==="quarter"?`${r.y}-Q${Math.ceil(r.m/3)}`:`${r.y}`;if(!map.has(k))map.set(k,[]);map.get(k).push(i);});
  return [...map.entries()].map(([k,idx])=>({k,idx}));
}
function plabel(k,mode,short){
  if(mode==="month"){const[y,m]=k.split("-").map(Number);return short?`${MS[m-1]} '${String(y).slice(2)}`:`${MONTHS[m-1]} ${y}`;}
  if(mode==="quarter"){const[y,q]=k.split("-");return short?`${q} '${y.slice(2)}`:`${q} ${y}`;}
  return k;
}
function psub(p,mode){
  const a=S.months[p.idx[0]],z=S.months[p.idx[p.idx.length-1]];
  if(mode==="month")return a.est?`Average of the ${a.y} yearly total`:"";
  return `${MONTHS[a.m-1]} – ${MONTHS[z.m-1]}${p.idx.length<(mode==="quarter"?3:12)?" (so far)":""}`;
}
function splitOf(idx){const s={stocks:0,property:0,holiday:0,cash:0,saved:0,gain:0,pots:{}};idx.forEach(i=>{const r=S.months[i],pv=i>0?S.months[i-1].stockValue:0;s.stocks+=r.stocks;s.property+=r.property;s.holiday+=r.holiday;s.cash+=r.cash;s.saved+=r.saved;s.gain+=r.stockValue-pv-r.stocks;for(const id in (r.pots||{}))s.pots[id]=(s.pots[id]||0)+r.pots[id];});return s;}
function history(){
  const mode=S.hmode,ps=periods(mode);
  if(!ps.length)return `<h1>History</h1>
  <section class="card glass"><span class="muted" style="font-size:15px">Saved so far</span><span class="big" style="font-size:40px">CHF 0</span>
  <span class="muted" style="font-size:15px;line-height:1.4">No months yet. Your check-ins and past months show up here.</span></section>
  <div class="list glass"><button data-act="setup" style="border:0;background:transparent;text-align:left;min-height:48px;padding:0 16px;font-size:17px;font-weight:600;color:var(--accent)">+ Add or edit historical data</button></div>`;
  let pi=ps.findIndex(p=>p.k===S.hkey);if(pi<0){pi=ps.length-1;S.hkey=ps[pi].k;}
  const p=ps[pi],recs=p.idx.map(i=>S.months[i]);
  const saved=recs.reduce((a,r)=>a+r.saved,0),inc=recs.reduce((a,r)=>a+r.income,0);
  const withGoal=recs.filter(r=>r.goal),goal=withGoal.reduce((a,r)=>a+r.goal,0),hit=withGoal.filter(r=>r.saved>=r.goal).length;
  const est=recs.some(r=>r.est);
  const prev=pi>0?ps[pi-1].idx.reduce((a,i)=>a+S.months[i].saved,0):null;
  const pct=goal?saved/goal*100:0;
  const name=mode==="month"?"month":mode==="quarter"?"quarter":"year";
  const prevName=pi>0?plabel(ps[pi-1].k,mode,true):"";
  // chart: up to 5 periods ending at selected
  const from=Math.max(0,pi-4),slice=ps.slice(from,pi+1);
  const vals=slice.map(q=>q.idx.reduce((a,i)=>a+S.months[i].saved,0));
  const max=Math.max(...vals,goal||0)*1.05||1;
  const H=120;
  const bars=slice.map((q,j)=>{const qr=q.idx.map(i=>S.months[i]);const isEst=qr.some(r=>r.est);const partial=q.idx.length<(mode==="quarter"?3:mode==="year"?12:1)&&j===slice.length-1;
    return `<div class="bar${isEst?" est":""}${q.k===p.k?" sel":""}${partial&&q.k!==p.k?" live":""}" data-act="hjump" data-k="${q.k}" role="button" tabindex="0" aria-label="Show ${plabel(q.k,mode,false)}"><span style="height:${Math.max(vals[j]/max*H,22)}px">${fmt(vals[j])}</span></div>`;}).join("");
  const goalLine=goal?`<div class="goal" style="bottom:${goal/max*H}px" aria-hidden="true"></div>`:"";
  const dots=ps.slice(Math.max(0,pi-3),pi+2).map(q=>`<button class="dotbtn" data-act="hjump" data-k="${q.k}" aria-label="Show ${plabel(q.k,mode,false)}"><span style="display:block;width:${q.k===p.k?16:6}px;height:6px;border-radius:3px;background:${q.k===p.k?"var(--bar)":"var(--track)"}"></span></button>`).join("");
  const listTitle=mode==="month"?`${plabel(p.k,mode,false)} · tap to edit`:`Months in ${plabel(p.k,mode,false)} · tap to edit`;
  let listHtml=`<div class="section">${listTitle}</div>
    <div class="list glass">${p.idx.slice().reverse().map(i=>{const r=S.months[i];const ok=r.goal&&r.saved>=r.goal;const w=r.goal?Math.min(r.saved/r.goal*100,100):0;
      return `<button data-act="edit" data-i="${i}" style="border:0;background:transparent;text-align:left;display:flex;flex-direction:column;gap:6px;padding:12px 16px;border-bottom:1px solid var(--line);color:var(--ink)">
      <span style="display:flex;align-items:baseline;gap:8px;font-size:17px;width:100%"><span style="flex:1">${MONTHS[r.m-1]} ${r.y}${r.est?' <span class="muted" style="font-size:12px">avg</span>':""}</span><span class="num">${fmt(r.saved)}</span><span style="font-size:13px;${ok?"color:var(--good);font-weight:600":r.goal?"color:var(--warn);font-weight:600":"color:var(--muted)"}">${r.goal?"/ "+fmt(r.goal)+(ok?" ✓":""):"no goal"}</span><span style="color:var(--soft)">›</span></span>
      ${r.goal?`<span style="height:5px;border-radius:3px;background:var(--track);overflow:hidden;width:100%"><span style="display:block;height:5px;width:${w}%;background:${ok?"var(--goodline)":"var(--prop)"}"></span></span>`:""}</button>`;}).join("")}
    <button data-act="setup" style="border:0;background:transparent;text-align:left;min-height:48px;padding:0 16px;font-size:17px;font-weight:600;color:var(--accent)">+ Add or edit historical data</button></div>`;
  const sp=splitOf(p.idx);
  const parts=[["Stocks",sp.stocks,"var(--stocks)"],["Property savings",sp.property,"var(--prop)"],["Holiday budget",sp.holiday,"var(--hol)"]].concat(S.pots.map(pt=>[esc(pt.name),sp.pots[pt.id]||0,pt.color]),[["Cash",sp.cash,"var(--cash)"]]);
  const splitHtml=`<section class="card glass" data-act="info" data-k="split" role="button" tabindex="0" aria-label="Where the money went, details">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-size:17px;font-weight:600">Where the money went</span><span class="muted" style="font-size:13px">${p.idx.length>1?"sum of "+p.idx.length+" months":"this month"}</span></div>
    <div class="split" aria-hidden="true">${parts.map(c=>`<span style="flex:${Math.max(c[1],0)};background:${c[2]}"></span>`).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:10px">${parts.map(c=>`<div style="display:flex;align-items:center;gap:12px"><span class="dot" style="background:${c[2]}"></span><span style="flex:1">${c[0]}</span><span class="muted" style="font-size:13px;width:40px;text-align:right">${sp.saved?Math.round(c[1]/sp.saved*100):0}%</span><span class="num" style="width:64px;text-align:right">${fmt(c[1])}</span></div>`).join("")}</div>
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px;font-size:15px"><span class="muted">Market gain on stocks</span><span class="num" style="color:${sp.gain>=0?"var(--good)":"var(--bad)"}">${sp.gain>=0?"+":"−"}${fmt(Math.abs(sp.gain))}</span></div>
  </section>`;
  const chartHtml=`  <section class="card glass">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-size:17px;font-weight:600">Saved per ${name}</span>${goal?`<span class="muted" style="font-size:12px">dashed line = goal ${fmt(goal)}</span>`:""}</div>
    <div class="chart">${goalLine}${bars}</div>
    <div class="xl">${slice.map(q=>`<span style="${q.k===p.k?"font-weight:700;color:var(--ink)":""}">${plabel(q.k,mode,true)}</span>`).join("")}</div>
    ${slice.some(q=>q.idx.some(i=>S.months[i].est))?`<div class="muted" style="font-size:12px">Periods in 2025 use the monthly average of the 2025 yearly total.</div>`:""}
  </section>`;
  return `
  <div class="head" style="align-items:center"><h1>History</h1>
  <button class="btn small" data-act="hmenu" aria-haspopup="menu">${mode[0].toUpperCase()+mode.slice(1)}${IC.chev}</button></div>
  <div style="display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <button class="btn round" data-act="hprev" aria-label="Previous ${name}" ${pi===0?"disabled":""}>‹</button>
      <span style="display:flex;flex-direction:column;align-items:center;text-align:center"><span style="font-size:20px;font-weight:700">${plabel(p.k,mode,false)}</span><span class="muted" style="font-size:13px">${psub(p,mode)||"&nbsp;"}</span></span>
      <button class="btn round" data-act="hnext" aria-label="Next ${name}" ${pi===ps.length-1?"disabled":""}>›</button>
    </div>
    <div style="display:flex;justify-content:center;gap:2px;margin-top:-6px">${dots}</div>
  </div>
  <section class="card glass" ${mode==="month"?`data-act="edit" data-i="${p.idx[0]}" aria-label="Edit ${plabel(p.k,mode,false)}"`:`data-act="info" data-k="hsum" aria-label="How this is calculated"`} role="button" tabindex="0">
    <span style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="muted" style="font-size:15px">${goal?"Saved vs goal":"Saved"} in ${plabel(p.k,mode,false)}</span>${mode==="month"?'<span style="font-size:15px;font-weight:600;color:var(--accent)">Edit</span>':""}</span>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big" style="font-size:40px">${chf(saved)}</span><span class="muted" style="font-size:15px">${goal?"of "+chf(goal)+" goal":est?"yearly average, no goal set":"no goal set"}</span></div>
    ${goal?`<div style="display:flex;align-items:center;gap:10px"><span class="track"><span style="width:${Math.min(pct,100)}%;${pct>=100?"background:var(--goodline)":""}"></span></span><span style="font-size:15px;font-weight:700">${Math.round(pct)}%</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="pill ${pct>=100?"good":"warn"}" style="align-self:center">${pct>=100?"Goal reached · +"+fmt(saved-goal):"CHF "+fmt(goal-saved)+" short"}</span><span class="muted" style="font-size:13px">${mode==="month"?"":`Goal reached in ${hit} of ${withGoal.length} months`}</span></div>`:""}
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px;font-size:13px" class="muted"><span>Savings rate <b style="color:var(--ink)">${Math.round(saved/inc*100)}%</b></span><span>${prev!==null?`vs ${prevName} <b style="color:${saved>=prev?"var(--good)":"var(--bad)"}">${saved>=prev?"▲":"▼"} ${chf(Math.abs(saved-prev))}</b>`:""}</span></div>
  </section>
  ${mode==="month"?"":listHtml}
  ${splitHtml}
  ${chartHtml}
  <p class="note" style="text-align:center">Swipe left or right to change ${name}.</p>`;
}

function goals(){
  const b=bal(L()),fiBase=b.fi,pct=fiBase/S.fi*100,avg=avgSave(12);
  const gl=[{n:"Holiday budget",v:b.holiday,t:S.holidayTarget,c:"#14A3A0",k:"hol"},{n:"Emergency fund (cash)",v:b.cash,t:S.emergency,c:"#2F7DF6",k:"emer"}]
    .concat(S.pots.map(pt=>({n:esc(pt.name),v:b.pots[pt.id],t:pt.target,c:pt.color,k:"pot",a:pt.id,nofi:!pt.fi})));
  return `<h1>Goals</h1>
  <section class="card glass" data-act="info" data-k="fi" role="button" tabindex="0" aria-label="Financial independence details">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:17px;font-weight:600">Financial independence</span><span class="muted" style="font-size:13px">Goal ${chf(S.fi)}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big" style="font-size:40px">${pct.toFixed(1)}%</span><span class="muted" style="font-size:15px">${chf(fiBase)} · excl. holiday${b.potOut?" &amp; spending goals":""}</span></div>
    <span class="track" style="flex:none;height:10px"><span style="width:${Math.min(pct,100)}%;background:linear-gradient(90deg,#5C9BFF,#8E4FD8)"></span></span>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:12px;border-radius:18px;padding:12px 14px;background:var(--field);border:1px solid var(--fieldb)">
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:13px">Projected to reach goal</span><span style="font-size:22px;font-weight:700">≈ ${projYear(fiBase)}</span></span>
      <span class="muted" style="font-size:12px;text-align:right;line-height:1.4">at avg ${chf(avg)}/month<br>and ${S.ret}% return per year</span>
    </div>
  </section>
  ${propCard(b)}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><div class="section" style="margin:0">Savings goals</div><button class="link" data-act="addgoal" style="font-size:17px">+ Add</button></div>
  <div class="list glass">
    ${gl.map(g=>{const pc=g.t>0?Math.min(Math.max(g.v,0)/g.t*100,100):0;return `
    <div class="grow" data-act="info" data-k="${g.k}" ${g.a?`data-a="${g.a}"`:""} role="button" tabindex="0" aria-label="${g.n} details">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:17px">${g.n}</span>${pc>=100||g.nofi?`<span style="display:flex;gap:8px;font-size:13px">${pc>=100?'<span style="color:var(--good);font-weight:600">✓ reached</span>':""}${g.nofi?'<span class="muted">not in FI</span>':""}</span>`:""}</span><span class="muted num" style="font-size:15px;white-space:nowrap;padding-top:2px">${fmt(Math.min(g.v,g.t))} / ${fmt(g.t)}</span></div>
      <span style="height:7px;border-radius:4px;background:var(--track);overflow:hidden"><span style="display:block;height:7px;width:${pc}%;background:${g.c}"></span></span></div>`;}).join("")}
  </div>
  ${S.pots.length?"":`<p class="note">Saving for something else, like a car or a wedding? Add it as its own goal and give it a line in every check-in.</p>`}`;
}

function settings(){
  const fld=(id,label,val,suffix)=>`<label class="row" for="${id}"><span style="flex:1">${label}</span><input class="val" id="${id}" inputmode="decimal" value="${val}" data-set="${id}" aria-label="${label}">${suffix?`<span class="muted">${suffix}</span>`:""}</label>`;
  const rb=(act,label,color,last)=>`<button class="row" data-act="${act}" style="border:0;${last?"":"border-bottom:1px solid var(--line);"}background:transparent;color:${color||"var(--accent)"};font-weight:600;text-align:left">${label}</button>`;
  return `<h1>Settings</h1>
  <div class="section">Goals &amp; calculations</div>
  <div class="list glass">${fld("s-fi","FI goal (CHF)",fmt(S.fi))}${fld("s-hol","Holiday budget (CHF)",fmt(S.holidayTarget))}${fld("s-emer","Emergency fund (CHF)",fmt(S.emergency))}${fld("s-eq","Property equity share",S.equity,"%")}${fld("s-res","Property safety reserve (CHF)",fmt(S.reserve||0))}${fld("s-ret","Expected return / year",S.ret,"%")}</div>
  <p class="note">Holiday money is shown in totals but not counted for FI. Changes update Home and Goals right away.</p>
  <div class="section">Reminder</div>
  <div class="list glass">
    <div class="row" data-act="switch"><span id="rem-l" style="flex:1">Check-in reminder · 24th, 19:00</span><button class="switch" role="switch" aria-checked="${S.reminder}" aria-labelledby="rem-l" data-act="switch"></button></div>
  </div>
  <p class="note">From the 24th, Safe reminds you when you open it. Phone notifications follow in the next update. If a month was missed, Safe asks for that month first.</p>
  <div class="section">Backup</div>
  <div class="list glass">${rb("backup","Download backup")}${rb("restore","Restore from backup file","",1)}</div>
  <p class="note">The backup is a file saved in your Files app; you choose where, e.g. On My iPhone or iCloud Drive. Last backup: ${backupLabel()}. If it gets older than 2 months, Safe reminds you after a check-in and on Home. Restoring replaces the data on this iPhone.</p>
  <div class="section">General</div>
  <div class="list glass"><div class="row" data-act="demo"><span id="demo-l" style="flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 0"><span>Demo mode</span><span class="muted" style="font-size:13px">Hides your numbers and shows a made-up person</span></span><button class="switch" role="switch" aria-checked="${!!S.demo}" aria-labelledby="demo-l" data-act="demo"></button></div></div>
  <p class="note">Use it to show Safe to someone. Your data stays untouched; anything changed in Demo mode is discarded when you switch it off.</p>
  <div class="list glass"><button class="row" data-act="info" data-k="cur" style="border:0;background:transparent;text-align:left;width:100%"><span style="flex:1">Currency</span><span class="muted">CHF</span></button></div>
  <div class="list glass">${rb("wipe","Delete all data","var(--bad)",1)}</div>
  <p class="note">Removes every month, goal and balance from this iPhone. Backup files you downloaded stay.</p>
  <div class="section">About</div>
  <div class="list glass"><button class="row" data-act="info" data-k="about" style="border:0;background:transparent;text-align:left;width:100%"><span style="flex:1">Safe</span><span class="muted">Version ${VERSION}</span></button></div>
  <p class="note">Your data is stored only on this iPhone. Nothing is sent anywhere.</p>`;
}


const XB=`<button type="button" class="xbtn glass" data-act="dismiss" aria-label="Close"><svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3.2" stroke-linecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18"/></svg></button>`;
/* ---------- info sheets ---------- */
function mini(vals,labels,color,hi){
  const mx=Math.max(...vals.map(v=>Math.abs(v)),1);
  return `<div class="mini" aria-hidden="true">${vals.map((v,j)=>`<div><span style="${j===hi?"color:var(--ink);font-weight:700":""}">${fmt(v)}</span><i style="height:${Math.max(Math.abs(v)/mx*58,4)}px;background:${j===hi?color:"var(--track)"}"></i><span style="${j===hi?"color:var(--ink);font-weight:700":""}">${labels[j]}</span></div>`).join("")}</div>`;
}
function last6(fn){const n=S.months.length,from=Math.max(0,n-6),v=[],l=[];for(let i=from;i<n;i++){v.push(fn(i));l.push(MS[S.months[i].m-1]);}return {v,l};}
function avgOf(key,n){const xs=S.months.slice(-n);return xs.length?xs.reduce((a,r)=>a+r[key],0)/xs.length:0;}
function monthsTo(rest,per){if(rest<=0)return "already reached";if(per<=0)return "not at the current pace";const n=Math.ceil(rest/per),r=cur()||blank(),tot=r.y*12+(r.m-1)+n;return `about ${n} month${n===1?"":"s"} (${MONTHS[tot%12]} ${Math.floor(tot/12)})`;}
let lastInfo=null;
function openInfo(k,a){
  lastInfo={k,a};
  const i=L(),b=bal(i),p=bal(i-1),r=cur()||blank(),prevVal=i>0?S.months[i-1].stockValue:0,mGain=r.stockValue-prevVal-r.stocks;
  let title="",body="",action="";
  const kv=rows=>`<div class="field">${rows.map(x=>`<div class="kv"><span class="muted">${x[0]}</span><b style="${x[2]||""}">${x[1]}</b></div>`).join("")}</div>`;
  const sign=v=>(v>=0?"+":"−")+fmt(Math.abs(v));
  const col=v=>v>=0?"color:var(--good)":"color:var(--bad)";
  if(k==="nw"){
    const h=last6(j=>bal(j).nw);
    title="Net worth";
    body=`<span class="big">${chf(b.nw)}</span>
    ${kv([["Saved in "+MONTHS[r.m-1],sign(r.saved),col(r.saved)],["Market gain on stocks",sign(mGain),col(mGain)],["Change this month",sign(b.nw-p.nw),col(b.nw-p.nw)]])}
    <div class="section" style="padding-left:4px">Last 6 months</div>${mini(h.v,h.l,"var(--accent)",h.v.length-1)}
    <p class="explain">Net worth adds up cash, the current value of your stocks, property savings and the holiday budget. FI progress leaves out the holiday budget because you plan to spend it.</p>`;
  }else if(k==="cat"){
    const C={cash:["Cash savings","--cash",b.cash,r.cash,j=>bal(j).cash],stocks:["Stocks","--stocks",b.value,r.stockValue-prevVal,j=>bal(j).value],property:["Property savings","--prop",b.property,r.property,j=>bal(j).property],holiday:["Holiday budget","--hol",b.holiday,r.holiday,j=>bal(j).holiday]}[a];
    const h=last6(C[4]);
    title=C[0];
    let extra="",text="";
    if(a==="cash"){extra=kv([["Added in "+MONTHS[r.m-1],sign(r.cash),col(r.cash)],["Emergency fund target",chf(S.emergency)],["Still to go",chf(Math.max(S.emergency-b.cash,0))]]);text="Cash gets whatever you don't assign to stocks, property or holiday in the check-in. It also counts toward your emergency fund.";}
    if(a==="stocks"){extra=kv([["Paid in (all time)",chf(b.paid)],["Market gains (all time)",sign(b.gain),col(b.gain)],["Paid in, "+MONTHS[r.m-1],"+"+fmt(r.stocks)],["Market gain, "+MONTHS[r.m-1],sign(mGain),col(mGain)]]);text="Paid in is the money you moved into stocks yourself. Market gains are the portfolio value minus everything you paid in, so you can see what came from you and what came from the market.";}
    if(a==="property"){extra=kv([["Added in "+MONTHS[r.m-1],"+"+fmt(r.property)],["Equity share",S.equity+"%"],["Can buy up to",chf(propCalc(b).max)]]);text=`This is your equity for a first property. At ${S.equity}% equity, every CHF 1 saved lets you buy CHF ${fmt(100/S.equity)} of property.`;action=`<button class="btn" data-act="info" data-k="prop">How the property calculation works</button>`;}
    if(a==="holiday"){const per=avgOf("holiday",6);extra=kv([["Added in "+MONTHS[r.m-1],"+"+fmt(r.holiday)],["Target",chf(S.holidayTarget)],["Still to go",chf(Math.max(S.holidayTarget-b.holiday,0))],["Reached in",monthsTo(S.holidayTarget-b.holiday,per)]]);text="Not in FI: the holiday budget counts in your net worth, but not in FI progress, because it's money you plan to spend. Change the target in Settings.";}
    body=`<span class="big">${chf(C[2])}</span><span class="pill ${C[3]>=0?"good":"warn"}">${C[3]>=0?"▲":"▼"} ${chf(Math.abs(C[3]))} this month</span>
    <div class="section" style="padding-left:4px">Last 6 months</div>${mini(h.v,h.l,`var(${C[1]})`,h.v.length-1)}${extra}<p class="explain">${text}</p>`;
  }else if(k==="goalm"){
    const xs=S.months.filter(x=>x.goal).slice(-6),hit=xs.filter(x=>x.saved>=x.goal).length;
    title="Monthly savings goal";
    const dm=dueMonth();
    body=`<span class="big">${chf(S.nextGoal)}</span><span class="muted">Goal for ${dm?MONTHS[dm.m-1]:MONTHS[r.m%12]}</span>
    ${xs.length?`<div class="field">${xs.slice().reverse().map(x=>{const ok=x.saved>=x.goal;return `<div class="kv"><span>${MONTHS[x.m-1]} ${x.y}</span><b style="${ok?"color:var(--good)":"color:var(--warn)"}">${fmt(x.saved)} / ${fmt(x.goal)}${ok?" ✓":""}</b></div>`;}).join("")}</div>`:""}
    <p class="explain">${xs.length?`You reached the goal in ${hit} of the last ${xs.length} months.`:"No months with a goal yet."} You set next month's goal at the end of every check-in. History adds these goals up for each quarter and year.</p>`;
  }else if(k==="hsum"){
    const ps=periods(S.hmode),q=ps.find(x=>x.k===S.hkey)||ps[ps.length-1],recs=q.idx.map(j=>S.months[j]);
    const sv=recs.reduce((s,x)=>s+x.saved,0),inc=recs.reduce((s,x)=>s+x.income,0),wg=recs.filter(x=>x.goal),g=wg.reduce((s,x)=>s+x.goal,0),avgM=recs.filter(x=>x.est).length;
    title="How this is calculated";
    body=`${kv([["Saved",`${recs.length} month${recs.length>1?"s":""} = ${chf(sv)}`],["Goal",wg.length?`${wg.length} × goal = ${chf(g)}`:"no goal set"],["Reached",g?Math.round(sv/g*100)+"%":"–"],["Savings rate",`${fmt(sv)} ÷ ${fmt(inc)} = ${Math.round(sv/inc*100)}%`]])}
    <p class="explain">Saved adds up every month in ${plabel(q.k,S.hmode,false)}. The goal adds up the monthly goals you set in each check-in.${avgM?` ${avgM} month${avgM>1?"s":""} here come from a yearly total, so they show the yearly average and have no goal.`:""}</p>`;
  }else if(k==="split"){
    const ps=periods(S.hmode),q=ps.find(x=>x.k===S.hkey)||ps[ps.length-1],sp=splitOf(q.idx);
    title="Where the money went";
    body=`<span class="big">${chf(sp.saved)}</span><span class="muted">saved in ${plabel(q.k,S.hmode,false)}</span>
    ${kv([["Stocks (paid in)",chf(sp.stocks)],["Property savings",chf(sp.property)],["Holiday budget",chf(sp.holiday)],...S.pots.map(pt=>[esc(pt.name),chf(sp.pots[pt.id]||0)]),["Cash (rest)",chf(sp.cash)],["Market gain on stocks",sign(sp.gain),col(sp.gain)]])}
    <p class="explain">This adds up the split you entered in each check-in${q.idx.length>1?` for the ${q.idx.length} months in ${plabel(q.k,S.hmode,false)}`:""}. Market gain is the change in portfolio value minus what you paid in, so it's not part of what you saved.</p>`;
  }else if(k==="fi"){
    const base=b.fi,c=avgSave(12),yr=projYear(base);
    title="Financial independence";
    body=`<span class="big">${(base/S.fi*100).toFixed(1)}%</span>
    ${kv([["Counted for FI",chf(base)],["Goal",chf(S.fi)],["Still to go",chf(Math.max(S.fi-base,0))],["Avg saved / month, excl. holiday",chf(c)],["Expected return",S.ret+"% per year"],["Projected to reach goal","≈ "+yr]])}
    <p class="explain">The projection adds your average monthly saving and grows everything at the expected return, month by month, until it reaches your goal. It's a rough guide, not a forecast: markets and your savings will vary.</p>`;
    action=`<button class="btn" data-act="tab" data-tab="settings">Change goal or return</button>`;
  }else if(k==="prop"){
    title="First property";
    const f=(id,label,val,suf,hint)=>`<label class="row" for="pp-${id}"><span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:${hint?"8px 0":"0"}"><span>${label}</span>${hint?`<span class="muted" style="font-size:12px">${hint}</span>`:""}</span><input class="val" id="pp-${id}" data-pp="${id}" inputmode="decimal" value="${val}" placeholder="${id==="income"?fmt(propCalc(b).incAuto):""}" style="width:96px">${suf?`<span class="muted" style="font-size:15px">${suf}</span>`:""}</label>`;
    const pp=Object.assign({},PPDEF,S.pp||{});
    body=`<div id="pp-res"></div>
    <div class="section" style="padding-left:4px">Your numbers</div>
    <div class="field">${f("eq","Down payment (equity)",S.equity,"%")}${f("reserve","Safety reserve",fmt(S.reserve||0),"CHF","Kept aside, not used for the purchase")}${f("income","Income per year",pp.income>0?fmt(pp.income):"","CHF","Empty = from your check-ins · banks use gross")}</div>
    <div class="section" style="padding-left:4px">Bank assumptions</div>
    <div class="field">${f("rate","Interest rate used",pp.rate,"%","Banks calculate with about 5%")}${f("upkeep","Upkeep per year",pp.upkeep,"%","Of the price")}${f("amortTo","Pay mortgage down to",pp.amortTo,"%","Of the price, usually two thirds")}${f("amortYears","Within",pp.amortYears,"years")}${f("share","Max. share of income",pp.share,"%","Usually one third")}</div>
    <p class="explain">Changes apply right away. Property savings come from your check-ins. Notary and land registry costs are not included.</p>`;
    action=`<button class="btn" data-act="propreset">Reset to bank standard</button>`;
  }else if(k==="hol"){
    const per=avgOf("holiday",6);
    title="Holiday budget";
    body=`<span class="big">${chf(b.holiday)}</span><span class="muted">of ${chf(S.holidayTarget)} target</span>
    ${kv([["Still to go",chf(Math.max(S.holidayTarget-b.holiday,0))],["Avg added / month (6 mo.)",chf(per)],["Target reached in",monthsTo(S.holidayTarget-b.holiday,per)]])}
    <div class="field"><label class="row" for="t-s-hol"><span style="flex:1;font-weight:600">Target</span><input class="val" id="t-s-hol" data-set="s-hol" inputmode="decimal" value="${fmt(S.holidayTarget)}" style="width:110px"><span class="muted" style="font-size:15px">CHF</span></label></div>
    <p class="explain">Not in FI: this money counts in your net worth but not in FI progress, because you plan to spend it. Tap the target to change it.</p>`;
  }else if(k==="emer"){
    const per=avgOf("cash",6);
    title="Emergency fund";
    body=`<span class="big">${chf(Math.min(b.cash,S.emergency))}</span><span class="muted">of ${chf(S.emergency)} target · held as cash</span>
    ${kv([["Cash now",chf(b.cash)],["Still to go",chf(Math.max(S.emergency-b.cash,0))],["Avg cash added / month (6 mo.)",chf(per)],["Target reached in",monthsTo(S.emergency-b.cash,per)]])}
    <div class="field"><label class="row" for="t-s-emer"><span style="flex:1;font-weight:600">Target</span><input class="val" id="t-s-emer" data-set="s-emer" inputmode="decimal" value="${fmt(S.emergency)}" style="width:110px"><span class="muted" style="font-size:15px">CHF</span></label></div>
    <p class="explain">${r.income?`The target is about ${(S.emergency/r.income).toFixed(1)} months of income. `:""}It's filled by the cash part of each check-in. Tap the target to change it.</p>`;
  }else if(k==="pot"){
    const pt=S.pots.find(x=>x.id===a);if(!pt)return;
    const v=b.pots[pt.id]||0,h=last6(j=>bal(j).pots[pt.id]||0),xs=S.months.slice(-6),per=xs.length?xs.reduce((s,x)=>s+((x.pots||{})[pt.id]||0),0)/xs.length:0;
    title=esc(pt.name);
    body=`<span class="big">${chf(v)}</span><span class="muted">of ${chf(pt.target)} target</span>
    <div class="section" style="padding-left:4px">Last 6 months</div>${mini(h.v,h.l,pt.color,h.v.length-1)}
    ${kv([["Still to go",chf(Math.max(pt.target-v,0))],["Avg added / month (6 mo.)",chf(per)],["Target reached in",monthsTo(pt.target-v,per)],["Counts toward FI",pt.fi?"Yes":"No"]])}
    <p class="explain">${pt.fi?"This goal counts toward FI because the money stays yours long term.":"Not in FI: it counts in your net worth, but not in FI progress, because you plan to spend it."} You put money in it with its own line in the check-in; that amount comes out of cash.</p>`;
    action=`<button class="btn" data-act="goaledit" data-a="${pt.id}">Edit goal</button><button class="link" data-act="delpot" data-a="${pt.id}" style="color:var(--bad);font-size:17px;min-height:48px">Delete goal</button>`;
  }else if(k==="late"){
    const dm=dueMonth(),n=ym(S.today.y,S.today.m)-ym(dm.y,dm.m)+1;
    title="Late check-in";
    body=`${kv([["Open months",n+" ("+MS[dm.m-1]+" – "+MS[S.today.m-1]+")"],["Next to log",MONTHS[dm.m-1]+" "+dm.y],["Goal for "+MONTHS[dm.m-1],chf(S.nextGoal)]])}
    <p class="explain">Safe always asks for the oldest missing month first, so your history has no gaps. Enter what you saved in ${MONTHS[dm.m-1]} and your portfolio value at the end of ${MONTHS[dm.m-1]}. A close estimate is fine. Right after saving, the next open month is offered.</p>`;
  }else if(k==="cur"){
    title="Currency";
    body=`<p class="explain">Safe works in Swiss francs. All amounts, goals and backups use CHF. Other currencies aren't part of the first version.</p>`;
  }else if(k==="start"){
    title="Start tracking from";
    body=`<p class="explain">Pick the first month you want in your history. Safe asks for your balances just before that month, then for each year either month by month or as one yearly total. Yearly totals show as a monthly average in History.</p>`;
  }else if(k==="about"){
    title="About Safe";
    body=`${kv([["Version",VERSION],["Months stored",String(S.months.length)],["Last backup",backupLabel()]])}<p class="explain">Safe keeps everything on this iPhone and works offline. Back up regularly: if the app is deleted, the data is gone unless you have a backup file.</p>`;
  }
  const html=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="in-t"><span class="grab" aria-hidden="true"></span>
  <div class="inner"><div style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 id="in-t" style="margin:0;font-size:22px;font-weight:700">${title}</h2>${XB}</div>${body}${action}</div></div>`;
  if(layer.querySelector(".full")){layer.insertAdjacentHTML("beforeend",html);}else{layer.innerHTML=html;sheetDirty=false;}
  bindSwipe([...layer.querySelectorAll(".sheet")].pop());
  if(k==="prop")wireProp();
}

/* ---------- render ---------- */
const scr=document.getElementById("screen"),tabs=document.getElementById("tabs"),layer=document.getElementById("layer");
const TABS=[["home","Home"],["checkin","Check-in"],["history","History"],["goals","Goals"],["settings","Settings"]];
function render(keepScroll){
  const bar=document.getElementById("demotag"),showBar=S.demo||!S.setupDone;
  bar.hidden=!showBar;
  bar.innerHTML=(S.demo?`<span class="demotag-pill glass">Demo</span>`:"")+(!S.setupDone?`<button class="demo-setup glass" data-act="startsetup">Start setup<span aria-hidden="true">›</span></button>`:"");
  document.getElementById("frame").classList.toggle("demo",showBar);
  const y=scr.scrollTop;
  scr.innerHTML=({home,checkin,history,goals,settings})[S.tab]();
  drawTabs();
  scr.scrollTop=keepScroll?y:0;
  persist();
}

/* ---------- tab bar with a sliding lens (tap a tab, or slide your finger along the bar) ---------- */
function drawTabs(){
  if(!tabs.querySelector(".lens")){
    tabs.innerHTML=`<span class="lens" aria-hidden="true"></span>`+TABS.map(([k,l])=>`<button class="tab" data-act="tab" data-tab="${k}">${IC[k]}<span>${l}</span></button>`).join("");
  }
  tabs.querySelectorAll(".tab").forEach(b=>{if(b.dataset.tab===S.tab)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
  placeLens();
}
function placeLens(x){
  const lens=tabs.querySelector(".lens"),cur=tabs.querySelector(`.tab[data-tab="${S.tab}"]`);if(!lens||!cur)return;
  const w=cur.offsetWidth;lens.style.width=w+"px";
  const left=x==null?cur.offsetLeft:Math.min(Math.max(x-w/2,5),tabs.clientWidth-w-5);
  lens.style.transform=`translateX(${left}px)`;
}
let tdrag=null,tabClickBlock=0;
const tabAt=x=>{let best=null,bd=1e9;tabs.querySelectorAll(".tab").forEach(b=>{const c=b.offsetLeft+b.offsetWidth/2,d=Math.abs(c-x);if(d<bd){bd=d;best=b;}});return best;};
function magnify(x){tabs.querySelectorAll(".tab").forEach(b=>{const c=b.offsetLeft+b.offsetWidth/2,w=b.offsetWidth,k=x==null?0:Math.max(0,1-Math.abs(c-x)/w);
  const sc=1+.22*k;b.querySelector("svg").style.transform=k?`scale(${sc}) translateY(${-2*k}px)`:"";b.querySelector("span").style.transform=k?`scale(${1+.08*k})`:"";b.classList.toggle("hover",k>.5);});}
tabs.addEventListener("pointerdown",e=>{const r=tabs.getBoundingClientRect(),x=e.clientX-r.left;
  tdrag={x0:e.clientX,lx:e.clientX,lt:e.timeStamp,moved:false,r,id:e.pointerId};
  try{tabs.setPointerCapture(e.pointerId);}catch(_){}
  tabs.classList.add("press");magnify(x);});
tabs.addEventListener("pointermove",e=>{if(!tdrag)return;const x=e.clientX-tdrag.r.left;
  if(!tdrag.moved&&Math.abs(e.clientX-tdrag.x0)<4)return;
  tdrag.moved=true;tabs.classList.add("drag");placeLens(x);
  const dt=Math.max(e.timeStamp-tdrag.lt,1),v=(e.clientX-tdrag.lx)/dt;tdrag.lx=e.clientX;tdrag.lt=e.timeStamp;
  const st=Math.min(Math.abs(v)*.35,.32),lens=tabs.querySelector(".lens");lens.style.scale=`${1.14+st} ${1.18-st*.4}`;
  magnify(x);});
function endTabDrag(e,cancel){if(!tdrag)return;const d=tdrag;tdrag=null;
  const lens=tabs.querySelector(".lens");lens.style.scale="";tabs.classList.remove("drag","press");magnify(null);
  tabClickBlock=Date.now();
  if(cancel){placeLens();return;}
  const t=tabAt(e.clientX-d.r.left);if(t&&t.dataset.tab!==S.tab){close();S.tab=t.dataset.tab;render();}else placeLens();}
tabs.addEventListener("pointerup",e=>endTabDrag(e,false));
tabs.addEventListener("pointercancel",e=>endTabDrag(e,true));
tabs.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});
window.addEventListener("resize",()=>placeLens());


/* ---------- toast ---------- */
let tt;
function toast(msg,action){
  clearTimeout(tt);
  const el=document.createElement("div");el.className="toast glass";el.setAttribute("role","status");
  el.innerHTML=`<span>${msg}</span>${action?`<button class="btn small" data-act="${action[1]}">${action[0]}</button>`:""}`;
  document.querySelectorAll(".toast").forEach(t=>t.remove());
  document.getElementById("frame").appendChild(el);
  tt=setTimeout(()=>el.remove(),action?6000:3000);
}

/* ---------- check-in sheet ---------- */
let editI=null;
function openSheet(i){
  document.querySelectorAll(".toast").forEach(t=>t.remove());
  editI=(i===undefined||i===null)?null:i;
  const isNew=editI===null, r=isNew?null:S.months[editI];
  const d=isNew?(dueMonth()||{y:S.today.y,m:S.today.m}):null;
  if(isNew&&!dueMonth()){S.tab="checkin";render();toast(`${MONTHS[cur().m-1]} is already logged`);return;}
  const prevIdx=isNew?L():editI-1, prevVal=prevIdx>=0?S.months[prevIdx].stockValue:0;
  const y=isNew?d.y:r.y, m=isNew?d.m:r.m;
  const has=!!cur();
  const lr=cur();const v=isNew?(lr?{income:lr.income,saved:"",stocks:"",property:"",holiday:"",stockValue:"",goal:S.nextGoal,pots:{}}:{income:"",saved:"",stocks:"",property:"",holiday:"",stockValue:"",goal:S.nextGoal,pots:{}})
    :{income:r.income,saved:r.saved,stocks:r.stocks,property:r.property,holiday:r.holiday,stockValue:r.stockValue,goal:r.goal||0,pots:r.pots||{}};
  const goalLabel=isNew?`Savings goal for ${MONTHS[m%12]}`:`Savings goal for ${MONTHS[m-1]}`;
  const thisGoal=isNew?S.nextGoal:(r.goal||0);
  const late=isNew&&isBehind();
  const potRows=S.pots.map(pt=>`<label class="row" for="f-pot-${pt.id}"><span class="dot" style="background:${pt.color}"></span><span style="flex:1">${esc(pt.name)}</span><input class="val" id="f-pot-${pt.id}" data-pot="${pt.id}" inputmode="decimal" value="${v.pots[pt.id]?fmt(v.pots[pt.id]):""}" placeholder="${lr&&isNew&&lr.pots&&lr.pots[pt.id]?fmt(lr.pots[pt.id]):"0"}" style="width:100px"></label>`).join("");
  layer.innerHTML=`<div class="scrim" data-act="close"></div>
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t"><span class="grab" aria-hidden="true"></span>
  <form class="inner" id="ci" novalidate>
    <div class="shead" style="display:flex;align-items:center;justify-content:space-between"><span style="width:32px"></span><h2 id="sh-t" style="margin:0;font-size:17px;font-weight:700">${MONTHS[m-1]} ${isNew?"check-in":y}</h2>${XB}</div>
    ${late?`<p class="note" style="color:var(--warn);font-weight:600">Late check-in: use your numbers from the end of ${MONTHS[m-1]}.</p>`:""}
    ${r&&r.est?`<p class="note" style="color:var(--warn)">This month shows the average of the ${r.y} yearly total. Saving here replaces it with exact numbers.</p>`:""}
    <div class="field">
      <label class="row" for="f-income"><span style="flex:1">Income</span><input class="val" id="f-income" inputmode="decimal" value="${v.income===""?"":fmt(v.income)}" placeholder="0"></label>
      <label class="row" for="f-saved" style="min-height:54px"><span style="flex:1;font-weight:600">Saved ${isNew&&!late?"this month":"in "+MONTHS[m-1]}</span><input class="val" id="f-saved" inputmode="decimal" value="${v.saved===""?"":fmt(v.saved)}" placeholder="0" style="font-size:24px;font-weight:700;color:var(--accent);width:140px"></label>
    </div>
    <div style="display:flex;justify-content:space-between;padding:0 6px;font-size:13px;gap:8px" class="muted"><span id="c-rate"></span><span id="c-goal"></span></div>
    <div style="display:flex;flex-direction:column;gap:6px;padding:0 2px"><span class="section" style="padding-left:4px;margin:0" id="c-head"></span><div class="split" id="c-bar" aria-hidden="true"></div><span id="c-err" role="alert" style="font-size:13px;font-weight:600;color:var(--bad);padding-left:4px"></span></div>
    <div class="field">
      <label class="row" for="f-stocks"><span class="dot" style="background:var(--stocks)"></span><span style="flex:1">Stocks</span><input class="val" id="f-stocks" inputmode="decimal" value="${v.stocks===""?"":fmt(v.stocks)}" placeholder="${lr&&isNew?fmt(lr.stocks):"0"}" style="width:100px"></label>
      <label class="row" for="f-prop"><span class="dot" style="background:var(--prop)"></span><span style="flex:1">Property savings</span><input class="val" id="f-prop" inputmode="decimal" value="${v.property===""?"":fmt(v.property)}" placeholder="${lr&&isNew?fmt(lr.property):"0"}" style="width:100px"></label>
      <label class="row" for="f-hol"><span class="dot" style="background:var(--hol)"></span><span style="flex:1">Holiday budget</span><input class="val" id="f-hol" inputmode="decimal" value="${v.holiday===""?"":fmt(v.holiday)}" placeholder="${lr&&isNew?fmt(lr.holiday):"0"}" style="width:100px"></label>
      ${potRows}
      <div class="row muted"><span class="dot" style="background:var(--cash)"></span><span style="flex:1">Cash <span style="font-size:13px">· rest, automatic</span></span><span class="num" id="c-cash" style="color:var(--ink)"></span></div>
    </div>
    <div class="field">
      <label class="row" for="f-value"><span style="flex:1">Stock portfolio value ${late?"end of "+MS[m-1]:"now"}</span><input class="val" id="f-value" inputmode="decimal" value="${v.stockValue===""?"":fmt(v.stockValue)}" placeholder="${prevVal?fmt(prevVal):"0"}" style="width:110px"></label>
      <div style="display:flex;justify-content:space-between;padding:0 16px 10px;font-size:13px" class="muted"><span id="c-paid"></span><span id="c-gain" style="font-weight:600"></span></div>
    </div>
    <div class="field"><label class="row" for="f-goal"><span style="flex:1">${goalLabel}</span><input class="val" id="f-goal" inputmode="decimal" value="${v.goal?fmt(v.goal):""}" placeholder="0" style="width:100px"></label></div>
    <button class="btn" type="submit" id="c-save">${isNew?"Save check-in":"Save changes"}</button>
    ${isNew?"":`<button type="button" class="link" data-act="delmonth" style="color:var(--bad);font-size:17px;min-height:48px">Delete ${MONTHS[m-1]} ${y}</button>`}
  </form></div>`;
  const f=document.getElementById("ci");
  const calc=()=>{
    const g=id=>parse(document.getElementById(id).value);
    const inc=g("f-income"),sv=g("f-saved"),st=g("f-stocks"),pr=g("f-prop"),ho=g("f-hol"),val=g("f-value");
    const pots={};let potSum=0;f.querySelectorAll("[data-pot]").forEach(el=>{const x=parse(el.value);pots[el.dataset.pot]=x;potSum+=x;});
    const assigned=st+pr+ho+potSum,cash=sv-assigned,over=cash<0;
    document.getElementById("c-rate").textContent=inc>0?`${Math.round(sv/inc*100)}% of income`:"";
    const gEl=document.getElementById("c-goal");
    if(thisGoal){const ok=sv>=thisGoal;gEl.textContent=ok?`✓ Goal of ${fmt(thisGoal)} reached`:`${fmt(thisGoal-sv)} below goal of ${fmt(thisGoal)}`;gEl.style.color=ok?"var(--good)":"var(--warn)";gEl.style.fontWeight="600";}else gEl.textContent="";
    document.getElementById("c-head").textContent=`Split your ${chf(sv)}`;
    const parts=[[st,"var(--stocks)"],[pr,"var(--prop)"],[ho,"var(--hol)"]].concat(S.pots.map(pt=>[pots[pt.id]||0,pt.color]));
    document.getElementById("c-bar").innerHTML=parts.map(p=>`<span style="flex:${Math.max(p[0],0)};background:${p[1]}"></span>`).join("")+(over?`<span style="flex:${-cash};background:var(--badbar)"></span>`:`<span style="flex:${cash};background:repeating-linear-gradient(135deg,var(--cash) 0 4px,transparent 4px 8px)"></span>`);
    document.getElementById("c-err").textContent=over?`${chf(-cash)} more than you saved. Lower a category.`:"";
    document.getElementById("c-cash").textContent=fmt(Math.max(cash,0));
    const gain=val-prevVal-st;
    document.getElementById("c-paid").textContent=`Paid in ${fmt(st)}`;
    const ge=document.getElementById("c-gain");ge.textContent=document.getElementById("f-value").value.trim()===""?"":`Market gain ${gain>=0?"+":"−"}${fmt(Math.abs(gain))}`;ge.style.color=gain>=0?"var(--good)":"var(--bad)";
    document.getElementById("c-save").disabled=over||sv<=0||inc<=0||(prevVal>0&&val<=0);
    document.getElementById("f-stocks").setAttribute("aria-invalid",over?"true":"false");
    return {inc,sv,st,pr,ho,val,cash,pots,goal:g("f-goal")};
  };
  f.addEventListener("input",()=>{sheetDirty=true;calc();});
  f.addEventListener("focusin",e=>{if(e.target.matches("input"))setTimeout(()=>e.target.select(),0)});
  sheetDirty=false;bindSwipe(layer.querySelector(".sheet"));
  f.addEventListener("submit",e=>{e.preventDefault();const c=calc();if(c.cash<0||c.sv<=0||c.inc<=0)return;
    const rec={income:c.inc,saved:c.sv,stocks:c.st,property:c.pr,holiday:c.ho,cash:c.cash,stockValue:c.val,pots:c.pots,est:false};
    if(editI===null){S.months.push(Object.assign({y,m,goal:S.nextGoal||null},rec));S.nextGoal=c.goal;close();
      const nd=dueMonth();
      if(nd){S.tab="checkin";render();toast(`${MONTHS[m-1]} saved. ${MONTHS[nd.m-1]} is open too.`,[`Check in ${MS[nd.m-1]}`,"sheet"]);}
      else{S.tab="home";render();backupOverdue()?toast(`${MONTHS[m-1]} saved. Last backup is over 2 months old.`,["Back up","backup"]):toast(`${MONTHS[m-1]} saved`);}}
    else{Object.assign(S.months[editI],rec,{goal:c.goal||S.months[editI].goal});const name=`${MONTHS[S.months[editI].m-1]} ${S.months[editI].y}`;close();render(true);toast(`${name} updated`);}
  });
  calc();
}
/* ---------- closing sheets: swipe down, ✕, or tap outside ---------- */
let sheetDirty=false;
function bindSwipe(sh){
  if(!sh)return;const inner=sh.querySelector(".inner");let y0=null,dy=0,t0=0,on=false;
  sh.addEventListener("touchstart",e=>{if(e.touches.length!==1)return;y0=e.touches[0].clientY;t0=e.timeStamp;dy=0;on=false;},{passive:true});
  sh.addEventListener("touchmove",e=>{if(y0==null)return;const d=e.touches[0].clientY-y0;
    if(!on){if(d>8&&(!inner||inner.scrollTop<=0||e.target.closest(".grab,.shead"))){on=true;sh.style.transition="none";sh.style.animation="none";}else if(Math.abs(d)>8){y0=null;return;}else return;}
    dy=Math.max(0,d);e.preventDefault();sh.style.transform=`translateY(${dy}px)`;},{passive:false});
  sh.addEventListener("touchend",e=>{if(!on){y0=null;return;}const v=dy/Math.max(e.timeStamp-t0,1);on=false;y0=null;
    sh.style.transition="transform .25s ease";if(dy>110||v>.6)dismissSheet(false,sh);else sh.style.transform="";});
  const g=sh.querySelector(".grab");if(g){g.addEventListener("pointerdown",e=>{if(e.pointerType==="touch")return;const sy=e.clientY;sh.style.transition="none";
    const mv=ev=>{sh.style.transform=`translateY(${Math.max(0,ev.clientY-sy)}px)`;};
    const up=ev=>{removeEventListener("pointermove",mv);removeEventListener("pointerup",up);sh.style.transition="transform .25s ease";if(ev.clientY-sy>110)dismissSheet(false,sh);else sh.style.transform="";};
    addEventListener("pointermove",mv);addEventListener("pointerup",up);});}
}
function dismissSheet(force,sh){
  sh=sh||[...layer.querySelectorAll(".sheet")].pop();
  if(!sh){if(!FL)close();return;}
  const inFull=!!layer.querySelector(".full");
  if(sheetDirty&&!force&&!sh.classList.contains("info")){sh.style.transform="";askDiscard();return;}
  sh.style.transition="transform .22s ease";sh.style.animation="none";sh.style.transform="translateY(105%)";
  const scrim=sh.previousElementSibling&&sh.previousElementSibling.classList.contains("scrim")?sh.previousElementSibling:null;if(scrim){scrim.style.transition="opacity .22s";scrim.style.opacity="0";}
  setTimeout(()=>{if(inFull){sh.remove();if(scrim)scrim.remove();}else{sheetDirty=false;close();}},220);
}
function askDiscard(){
  if(layer.querySelector(".askbox"))return;
  layer.insertAdjacentHTML("beforeend",`<div class="ascrim" data-act="keep"></div><div class="askbox" role="alertdialog" aria-modal="true" aria-label="Discard changes?"><p class="muted" style="margin:6px 0 4px;text-align:center;font-size:13px">Your changes haven't been saved.</p><button class="btn danger" data-act="discard">Discard changes</button><button class="btn" data-act="keep">Keep editing</button></div>`);
}
function close(){layer.innerHTML="";FL=false;pending=null;}

/* ---------- confirm dialog ---------- */
let pending=null;
function confirmBox(o){
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="modal glass" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d" style="--g1:var(--sheet);--g2:var(--sheet)">
  <h2 id="cf-t" style="margin:4px 0 0;font-size:20px">${o.title}</h2><p id="cf-d" class="muted" style="margin:0;font-size:15px;line-height:1.45">${o.text}</p>
  ${o.type?`<label style="align-self:stretch;display:flex;flex-direction:column;gap:6px;text-align:left;margin-top:4px"><span class="muted" style="font-size:13px">Type <b style="color:var(--ink)">${o.type}</b> to confirm</span><input id="cf-in" autocomplete="off" autocapitalize="characters" spellcheck="false" style="min-height:46px;border-radius:14px;border:1px solid var(--fieldb);background:var(--field);padding:0 14px;font-size:17px;box-sizing:border-box"></label>`:""}
  <button class="btn ${o.safe?"":"danger"}" data-act="confirm" id="cf-ok" style="align-self:stretch;margin-top:6px" ${o.type?"disabled":""}>${o.ok}</button>
  <button class="link" data-act="close" style="font-size:17px">Cancel</button></div>`;
  pending=o.run;
  if(o.type){const inp=document.getElementById("cf-in"),ok=document.getElementById("cf-ok");inp.addEventListener("input",()=>{ok.disabled=inp.value.trim().toUpperCase()!==o.type;});setTimeout(()=>inp.focus(),60);}
}


/* ---------- backup file: download + restore from a chosen file ---------- */
const BKEYS=["months","start","pots","nextGoal","fi","holidayTarget","equity","reserve","pp","ret","emergency"];
async function downloadBackup(){
  const d=new Date(),stamp=d.toISOString().slice(0,10),name=`Safe-backup-${stamp}.json`;
  const data={};BKEYS.forEach(k=>data[k]=S[k]);
  const text=JSON.stringify({app:"Safe",version:1,exported:d.toISOString(),data},null,2);
  try{
    const file=new File([text],name,{type:"application/json"});
    if(navigator.canShare&&navigator.canShare({files:[file]})){
      try{await navigator.share({files:[file],title:name});return true;}
      catch(e){if(e&&e.name==="AbortError")return false;}
    }
  }catch(e){}
  try{
    const blob=new Blob([text],{type:"application/json"}),a=document.createElement("a");
    a.href=URL.createObjectURL(blob);a.download=name;document.body.appendChild(a);a.click();
    setTimeout(()=>{URL.revokeObjectURL(a.href);a.remove();},1500);
    return true;
  }catch(e){return false;}
}
function pickBackup(fromSetup){
  const inp=document.createElement("input");inp.type="file";inp.accept=".json,application/json";inp.style.display="none";
  document.body.appendChild(inp);
  inp.addEventListener("change",()=>{const f=inp.files&&inp.files[0];inp.remove();if(!f)return;
    const rd=new FileReader();
    rd.onload=()=>{let j=null;try{j=JSON.parse(rd.result);}catch(e){}
      const ok=j&&j.app==="Safe"&&j.data&&Array.isArray(j.data.months);
      const back=fromSetup?()=>{close();FL=true;openSetup();}:null;
      if(!ok){badFile(f.name,fromSetup);return;}
      const ms=j.data.months,n=ms.length,when=j.exported?new Date(j.exported).toLocaleDateString("en-GB",{day:"numeric",month:"short",year:"numeric"}):"unknown date";
      const range=n?`${MS[ms[0].m-1]} ${ms[0].y} – ${MS[ms[n-1].m-1]} ${ms[n-1].y}`:"no months";
      const keepFL=fromSetup;
      confirmBox({title:"Replace your data?",text:`<b style="color:var(--ink)">${esc(f.name)}</b><br>Saved ${when} · ${n} month${n===1?"":"s"} · ${range}<br><br>${fromSetup?"Your backup will be loaded into Safe.":"Everything on this iPhone is replaced by this backup. Download a backup first if you want to keep what's here now."}`,ok:fromSetup?"Restore backup":"Replace data",
        run:()=>{BKEYS.forEach(k=>{if(j.data[k]!==undefined)S[k]=j.data[k];});normalize();S.hkey=null;
          if(keepFL){layer.innerHTML="";FL=true;drawFirst("notify");toast(`Backup restored · ${n} months`);}
          else{S.tab="home";close();render();toast(`Backup restored · ${n} months`);}}});
    };
    rd.readAsText(f);
  });
  inp.click();
}
function badFile(name,fromSetup){
  confirmBox({title:"Not a Safe backup",text:`“${esc(name)}” can't be read as a Safe backup. Pick a file named like <b style="color:var(--ink)">Safe-backup-2026-10-11.json</b>.`,ok:"Choose another file",safe:true,run:()=>{close();if(fromSetup)FL=true;pickBackup(fromSetup);}});
}

/* ---------- savings goal sheet ---------- */
let goalEdit=null;
function openGoalSheet(id){
  const pt=id?S.pots.find(p=>p.id===id):null;goalEdit=pt?pt.id:null;
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="g-t"><span class="grab" aria-hidden="true"></span>
  <form class="inner" id="gf" novalidate>
    <div class="shead" style="display:flex;align-items:center;justify-content:space-between"><span style="width:32px"></span><h2 id="g-t" style="margin:0;font-size:17px;font-weight:700">${pt?"Edit goal":"New savings goal"}</h2>${XB}</div>
    <div class="field">
      <label class="row" for="g-name"><span style="flex:1">Name</span><input class="val" id="g-name" placeholder="e.g. New car" value="${pt?esc(pt.name):""}" maxlength="24" autocomplete="off" style="width:180px"></label>
      <label class="row" for="g-target"><span style="flex:1">Target (CHF)</span><input class="val" id="g-target" inputmode="decimal" placeholder="0" value="${pt?fmt(pt.target):""}"></label>
    </div>
    <div class="field"><div class="row" data-act="gfi" style="min-height:62px"><span id="g-fi-l" style="flex:1;display:flex;flex-direction:column;gap:2px"><span>Count toward FI</span><span class="muted" style="font-size:13px">Leave off for money you plan to spend</span></span><button type="button" class="switch" id="g-fi" role="switch" aria-checked="${pt?pt.fi:false}" aria-labelledby="g-fi-l" data-act="gfi"></button></div></div>
    <p class="note">The goal gets its own line in every check-in. What you put there comes out of cash, and it shows on Home and in Goals.</p>
    <button class="btn" type="submit" id="g-save">${pt?"Save changes":"Add goal"}</button>
    ${pt?`<button type="button" class="link" data-act="delpot" data-a="${pt.id}" style="color:var(--bad);font-size:17px;min-height:48px">Delete goal</button>`:""}
  </form></div>`;
  const f=document.getElementById("gf"),nm=document.getElementById("g-name"),tg=document.getElementById("g-target"),sv=document.getElementById("g-save");
  const ok=()=>{sv.disabled=!(nm.value.trim()&&parse(tg.value)>0);};
  f.addEventListener("input",()=>{sheetDirty=true;ok();});ok();sheetDirty=false;bindSwipe(layer.querySelector(".sheet"));
  if(!pt)setTimeout(()=>nm.focus(),60);
  f.addEventListener("submit",e=>{e.preventDefault();if(sv.disabled)return;
    const data={name:nm.value.trim(),target:parse(tg.value),fi:document.getElementById("g-fi").getAttribute("aria-checked")==="true"};
    if(goalEdit){Object.assign(S.pots.find(p=>p.id===goalEdit),data);close();render(true);toast("Goal updated");}
    else{S.pots.push(Object.assign({id:"p"+Date.now().toString(36),color:POTCOL[S.pots.length%POTCOL.length]},data));close();render(true);toast(`“${esc(data.name)}” added. It now has a line in the check-in.`);}
  });
}
function deletePot(id){
  const pt=S.pots.find(p=>p.id===id);if(!pt)return;const v=bal(L()).pots[id]||0;
  confirmBox({title:`Delete “${esc(pt.name)}”?`,text:`The ${chf(v)} saved for it moves back to cash. Past check-ins keep their totals.`,ok:"Delete goal",run:()=>{
    S.months.forEach(r=>{const x=(r.pots||{})[id]||0;if(x)r.cash+=x;if(r.pots)delete r.pots[id];});
    S.pots=S.pots.filter(p=>p.id!==id);close();render(true);toast(`Goal deleted · ${chf(v)} moved to cash`);}});
}

/* ---------- other overlays ---------- */
function openMenu(){
  const opts=[["month","Month",`${MONTHS[cur().m-1].slice(0,3)} ${cur().y}`],["quarter","Quarter",""],["year","Year",String(cur().y)]];
  layer.innerHTML=`<div class="scrim" data-act="close" style="background:transparent"></div><div class="menu glass" role="menu" aria-label="Show history by">${opts.map(o=>`<button role="menuitemradio" aria-checked="${S.hmode===o[0]}" data-act="mode" data-mode="${o[0]}"><span>${o[1]}</span><span class="muted" style="font-size:13px">${S.hmode===o[0]?"✓":o[2]}</span></button>`).join("")}</div>`;
}
function openDue(){
  const d=dueMonth()||{y:S.today.y,m:S.today.m},late=isBehind(),dn=MONTHS[d.m-1];
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="due-t" style="--g1:var(--sheet);--g2:var(--sheet)">
  <span style="transform:scale(1.5);margin:8px 0 6px">${appIcon}</span><h2 id="due-t" style="margin:6px 0 0;font-size:22px">Check-in due</h2>
  <p class="muted" style="margin:0;font-size:15px;line-height:1.4">${late?`You haven't logged ${dn} yet. Log it now, then ${MONTHS[S.today.m-1]} is next.`:`It's the 24th. Log what you saved in ${dn} so your dashboard and FI progress stay up to date.`}</p>
  <button class="btn" data-act="sheet" style="align-self:stretch;margin-top:8px">${late?`Check in ${dn}`:"Start check-in"}</button>
  <button class="link" data-act="later" style="font-size:17px">Remind me tomorrow</button></div>`;
}
/* full-screen shell (first launch + setup) */
function shellFull(body,next,back,backBtn){
  return `<div class="full${backBtn?" hasback":""}"><div class="wall" aria-hidden="true">${document.querySelector(".wall").innerHTML}</div>${backBtn?`<button class="backbtn" ${backBtn[0]}><svg width="13" height="21" viewBox="0 0 13 21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10.5 2L2.5 10.5 10.5 19"/></svg><span>${backBtn[1]}</span></button>`:""}
  <div class="screen fscroll">${body}</div>
  <div class="foot">${next}${back}</div></div>`;
}
function isStandalone(){return !!(window.matchMedia&&matchMedia("(display-mode: standalone)").matches)||navigator.standalone===true;}

/* first launch */
let FL=false;
const ICS={
  share:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3v12M8 7l4-4 4 4"/><path d="M6 11H5a1 1 0 0 0-1 1v8a1 1 0 0 0 1 1h14a1 1 0 0 0 1-1v-8a1 1 0 0 0-1-1h-1"/></svg>',
  addhome:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4"/><path d="M12 8v8M8 12h8"/></svg>',
  lock:'<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><rect x="5" y="10" width="14" height="10" rx="3"/><path d="M8 10V7a4 4 0 0 1 8 0v3"/></svg>',
  bell:'<svg width="34" height="34" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M6 16V11a6 6 0 0 1 12 0v5l1.5 2h-15z"/><path d="M10 20a2 2 0 0 0 4 0"/></svg>'
};
function featRow(ic,t,s){return `<div class="row" style="min-height:68px;align-items:center"><span class="feat-ic" style="width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--field);border:1px solid var(--fieldb);color:var(--accent);flex:none">${ic}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 0"><span style="font-size:17px;font-weight:600">${t}</span><span class="muted" style="font-size:13px;line-height:1.35">${s}</span></span></div>`;}
function openFirst(){FL=true;drawFirst("welcome");}
function drawFirst(step){
  FL=true;
  const dots=n=>`<div style="display:flex;gap:6px;justify-content:center" aria-label="Step ${n} of 3">${[1,2,3].map(j=>`<span style="width:${j===n?18:7}px;height:7px;border-radius:4px;background:${j===n?"var(--accent)":"var(--track)"}"></span>`).join("")}</div>`;
  if(step==="welcome"){
    layer.innerHTML=shellFull(`<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding-top:28px">
      <span style="transform:scale(2.2);margin:34px 0 38px">${appIcon}</span>
      <h1 style="font-size:34px">Welcome to Safe</h1>
      <p class="muted" style="margin:0;font-size:17px;line-height:1.4;max-width:300px">Your savings, goals and FI progress in one calm place.</p></div>
      <div class="list glass" style="margin-top:14px">${featRow(IC.checkin,"Check in once a month","On the 24th, log what you saved and split it.")}${featRow(IC.goals,"Watch your goals grow","Savings rate, first property and financial independence.")}${featRow(ICS.lock,"Your data stays on your iPhone","No account. Backups are files you download and keep.")}</div>`,
      `<button class="btn" data-act="fl" data-s="${isStandalone()?"demo":"install"}" >Get started</button>`,"");
  }else if(step==="install"){
    const n=(k,ic,t,s)=>`<div class="row" style="min-height:72px"><span style="width:28px;height:28px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-size:15px;font-weight:700;flex:none">${k}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 0"><span style="font-size:17px;font-weight:600">${t}</span><span class="muted" style="font-size:13px;line-height:1.35">${s}</span></span><span style="color:var(--accent);flex:none;display:flex">${ic}</span></div>`;
    layer.innerHTML=shellFull(`<div class="eyebrow" style="margin-top:8px">Install</div><h1 style="font-size:30px">Add Safe to your Home Screen</h1>
      <p class="muted" style="margin:0;font-size:15px;line-height:1.4">Safe runs like an app from your Home Screen, full screen and offline. iPhone only sends the monthly reminder to apps added there.</p>
      <div class="list glass">${n(1,ICS.share,"Tap Share","The square with the arrow in Safari's toolbar.")}${n(2,ICS.addhome,"Choose “Add to Home Screen”","Scroll down in the menu if you don't see it.")}${n(3,`<span style="transform:scale(.7);display:flex">${appIcon}</span>`,"Open Safe from your Home Screen","Setup continues there.")}</div>
      <p class="note">Important: an app on the Home Screen keeps its own data, separate from Safari. Set Safe up after opening it from the Home Screen, or your numbers stay behind in Safari.</p>`,
      `<div class="btn plain" style="cursor:default" aria-live="polite">Now open Safe from your Home Screen</div>`,`<button class="link" data-act="fl" data-s="demo">Use Safe in the browser instead</button>`,['data-act="fl" data-s="welcome"',"Back"]);
  }else if(step==="notify"){
    layer.innerHTML=shellFull(`<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding-top:40px">
      <span class="glass" style="width:84px;height:84px;border-radius:28px;display:flex;align-items:center;justify-content:center;color:var(--accent);margin-bottom:14px">${ICS.bell}</span>
      <h1 style="font-size:30px">Get a reminder on the 24th?</h1>
      <p class="muted" style="margin:0;font-size:17px;line-height:1.4;max-width:310px">One reminder a month, on the 24th at 19:00, so you don't forget your check-in. Nothing else.</p></div>
      <div class="glass" style="display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:22px;margin-top:18px;text-align:left" aria-label="Preview of the notification">${appIcon}<span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="display:flex;justify-content:space-between;font-size:15px"><b>Safe</b><span class="muted" style="font-size:13px">24th, 19:00</span></span><span style="font-size:15px;font-weight:600">Time for your monthly check-in</span><span class="muted" style="font-size:15px">Log what you saved this month.</span></span></div>`,
      `<button class="btn" data-act="fl" data-s="ask">Allow notifications</button>`,`<button class="link" data-act="fl" data-s="no">Not now</button>`);
  }
}
function askNotifications(){
  const done=ok=>finishFirst(ok);
  try{
    if("Notification" in window&&Notification.requestPermission){
      const p=Notification.requestPermission(r=>done(r==="granted"));
      if(p&&p.then)p.then(r=>done(r==="granted")).catch(()=>done(true));
      return;
    }
  }catch(e){}
  done(true);
}
let firstDone=false;
function finishFirst(reminder){
  if(firstDone)return;firstDone=true;
  S.reminder=!!reminder;S.setupDone=true;if(S.createdYm==null)S.createdYm=ym(S.today.y,S.today.m);
  FL=false;layer.innerHTML="";S.tab="home";render();
  toast(reminder?"You're set · reminder on the 24th":"You're set · turn on the reminder any time in Settings");
}

/* setup: add past months (also used later for older history) */
let SU=null;
const kYM=k=>({y:Math.floor(k/12),m:k%12+1});
const kName=k=>{const o=kYM(k);return `${MONTHS[o.m-1]} ${o.y}`;};
function openSetup(){
  const hist=S.months.length>0;
  const toK=hist?ym(S.months[0].y,S.months[0].m):ym(S.today.y,S.today.m);
  const jan=ym(S.today.y,1);
  let fromK=hist?toK-12:(jan<toK?jan:toK-12);
  SU={step:0,fromK:hist?fromK:toK,toK,hist,mode:hist?"past":"today",pastFrom:fromK,plan:{},start:Object.assign({},S.start),vals:{}};
  fixPlan();drawSetup();
}
function fixPlan(){const ys=setupYears();ys.forEach(y=>{if(!SU.plan[y])SU.plan[y]=y<S.today.y&&setupMonths(y).length===12?"yearly":"months";});}
function setupYears(){const ys=[];for(let k=SU.fromK;k<SU.toK;k++){const y=kYM(k).y;if(!ys.includes(y))ys.push(y);}return ys;}
function setupMonths(y){const ks=[];for(let k=SU.fromK;k<SU.toK;k++)if(kYM(k).y===y)ks.push(k);return ks;}
function setupSteps(){
  const st=[{k:"intro"},{k:"bal"}];
  setupYears().forEach(y=>{if(SU.plan[y]==="yearly")st.push({k:"year",y,id:"y"+y});else setupMonths(y).forEach(k=>st.push({k:"month",key:k,id:"m"+k}));});
  return st;
}
const sel=(id,opts,val,label)=>`<select class="sel" id="${id}" data-su="${id}" aria-label="${label}">${opts.map(o=>`<option value="${o[0]}" ${String(o[0])===String(val)?"selected":""}>${o[1]}</option>`).join("")}</select>`;
function moneyRow(id,label,val,dot,sub){return `<label class="row" for="${id}">${dot?`<span class="dot" style="background:${dot}"></span>`:""}<span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:${sub?"8px 0":"0"}"><span>${label}</span>${sub?`<span class="muted" style="font-size:12px">${sub}</span>`:""}</span><input class="val" id="${id}" inputmode="decimal" value="${val===""||val==null?"":fmt(val)}" placeholder="0" style="width:110px"></label>`;}
function drawSetup(){
  const steps=setupSteps(),s=steps[SU.step],total=Math.max(steps.length-1,1),pct=SU.step/total*100,last=SU.step===steps.length-1;
  const bar=`<div style="height:5px;border-radius:3px;background:var(--track);overflow:hidden"><div style="height:5px;width:${pct}%;background:var(--accent)"></div></div>`;
  const nav=(label)=>`<button class="btn" data-act="snext" id="su-next">${label}</button>`;
  const BK=['data-act="sback"',"Back"];
  const nextLabel=()=>{if(last)return "Save";const nx=steps[SU.step+1];return nx.k==="month"?"Next: "+MS[kYM(nx.key).m-1]+" "+kYM(nx.key).y:nx.k==="year"?"Next: "+nx.y+" total":"Next";};
  if(s.k==="intro"){
    const minY=S.today.y-15,maxK=SU.hist?SU.toK-1:SU.toK;
    const fy=kYM(SU.fromK);
    const years=[];for(let y=kYM(maxK).y;y>=minY;y--)years.push([y,y]);
    const months=MONTHS.map((n,i)=>[i+1,n]).filter(o=>ym(fy.y,o[0])<=maxK);
    const n=SU.toK-SU.fromK;
    const yr=y=>{const c=setupMonths(y).length,a=MS[kYM(setupMonths(y)[0]).m-1],z=MS[kYM(setupMonths(y)[c-1]).m-1];return `<div class="row" style="min-height:64px"><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">${y}</span><span class="muted" style="font-size:13px">${c} month${c===1?"":"s"} · ${a}${c>1?" – "+z:""}${SU.plan[y]==="yearly"?" · as monthly average":""}</span></span><div class="seg" role="group" aria-label="${y} input"><button data-act="plan" data-y="${y}" data-v="months" aria-pressed="${SU.plan[y]==="months"}">Months</button><button data-act="plan" data-y="${y}" data-v="yearly" aria-pressed="${SU.plan[y]==="yearly"}">Yearly</button></div></div>`;};
    const ys=setupYears(),cnt=steps.filter(x=>x.k==="month").length,yc=steps.filter(x=>x.k==="year").length;
    layer.innerHTML=shellFull(`<div style="height:62px"><div style="transform:scale(1.5);transform-origin:left top;width:40px">${appIcon}</div></div>
    <div class="eyebrow">${SU.hist?"History":"Set up Safe"}</div><h1 style="font-size:30px">${SU.hist?"Add older months":"Set up your starting point"}</h1>
    <p class="muted" style="margin:0;font-size:15px;line-height:1.4">${SU.hist?`Your history starts in ${kName(SU.toK)}. Pick how far back to go. Months you already have stay as they are.`:"Start simply with what you have today, or add past months for a longer history."}</p>
    ${FL?`<div class="list glass"><button class="row" data-act="flrestore" style="border:0;background:transparent;text-align:left;width:100%"><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 0"><span style="font-weight:600;color:var(--accent)">Restore from a backup</span><span class="muted" style="font-size:13px">Had Safe before? Pick your backup file.</span></span><span style="color:var(--accent)" aria-hidden="true">›</span></button></div>`:""}
    ${SU.hist?"":(()=>{const opt=(v,t,s)=>`<button class="row" data-act="sumode" data-v="${v}" role="radio" aria-checked="${SU.mode===v}" style="border:0;background:transparent;text-align:left;width:100%;align-items:center"><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 0"><span style="font-weight:600">${t}</span><span class="muted" style="font-size:13px;line-height:1.35">${s}</span></span><span class="radio${SU.mode===v?" on":""}" aria-hidden="true"></span></button>`;
      return `<div class="section">How do you want to start?</div><div class="list glass" role="radiogroup" aria-label="How do you want to start">${opt("today","Start with today's balances","Enter roughly what you have now. From "+kName(SU.toK)+" on, your check-ins track everything exactly.")}${opt("past","Add past months too","Months or yearly totals with income and split, for a longer history.")}</div>`;})()}
    ${!SU.hist&&SU.mode==="today"?"":`<div class="list glass"><div class="row" style="min-height:52px"><span style="flex:1">Start tracking from</span></div><div class="row" style="min-height:58px;gap:8px">${sel("su-fm",months,fy.m,"Start month")}${sel("su-fy",years,fy.y,"Start year")}</div></div>`}
    ${ys.length?`<div class="section">How do you know each year?</div><div class="list glass">${ys.map(yr).join("")}</div>
    <p class="note">You'll enter your balances once, then ${yc?yc+" yearly total"+(yc>1?"s":"")+(cnt?" and ":""):""}${cnt?cnt+" month"+(cnt===1?"":"s"):""}. A yearly total is shown as the monthly average.</p>`
    :`<p class="note">You'll enter your current balances once, then do your first check-in for ${kName(SU.toK)}.</p>`}`,
    `<button class="btn" data-act="snext" ${SU.hist&&n<=0?"disabled":""}>Continue</button>`,"",['data-act="sclose"',FL?(S.setupDone?"Back":"Demo"):"History"]);
  }else if(s.k==="bal"){
    const st=SU.start;
    const today=!SU.hist&&SU.fromK===SU.toK;
    layer.innerHTML=shellFull(`${bar}<div class="eyebrow">${today?"Your balances today":"Starting balances"}</div><h1 style="font-size:30px">${today?"What you have now":"Before "+kName(SU.fromK)}</h1>
    <p class="muted" style="margin:0;font-size:15px;line-height:1.4">${today?`A rough overview is fine. From ${kName(SU.toK)} on, your monthly check-ins track income, savings and the split exactly.`:`What you had at the end of ${kName(SU.fromK-1)}. Leave anything you don't have at 0.`}</p>
    <div class="list glass">${moneyRow("su-bc","Cash savings",st.cash,"var(--cash)")}${moneyRow("su-bv","Stock portfolio value",st.stockValue,"var(--stocks)")}${moneyRow("su-bp","Stocks paid in so far",st.paid,"var(--stocks)","Everything you invested since opening the depot, without gains")}${moneyRow("su-bpr","Property savings",st.property,"var(--prop)")}${moneyRow("su-bh","Holiday budget",st.holiday,"var(--hol)")}</div>
    <p class="note">Not sure what you paid into stocks? Use the portfolio value; gains then start counting from here.</p>`,
    nav(nextLabel()),"",BK);
  }else{
    const isY=s.k==="year",v=SU.vals[s.id]&&SU.vals[s.id]!=="skip"?SU.vals[s.id]:guessVals(s);
    const ks=isY?setupMonths(s.y):[s.key],title=isY?(ks.length===12?`${s.y} in total`:`${MS[kYM(ks[0]).m-1]} – ${MS[kYM(ks[ks.length-1]).m-1]} ${s.y}`):kName(s.key);
    const mi=steps.filter(x=>x.k!=="intro"&&x.k!=="bal").indexOf(s)+1,mt=steps.length-2;
    layer.innerHTML=shellFull(`${bar}<div class="eyebrow">${isY?"Yearly total":"Month"} · ${mi} of ${mt}</div><h1 style="font-size:30px">${title}</h1>
    <div class="list glass">${moneyRow("su-inc",isY?"Income in total":"Income",v.income)}${moneyRow("su-sav",isY?"Saved in total":"Amount saved",v.saved)}</div>
    <div style="display:flex;flex-direction:column;gap:6px;padding:0 2px"><span class="section" style="padding-left:4px;margin:0" id="su-head"></span><div class="split" id="su-bar" aria-hidden="true"></div><span id="su-err" role="alert" style="font-size:13px;font-weight:600;color:var(--bad);padding-left:4px"></span></div>
    <div class="list glass">${moneyRow("su-st","Stocks (paid in)",v.stocks,"var(--stocks)")}${moneyRow("su-pr","Property savings",v.property,"var(--prop)")}${moneyRow("su-ho","Holiday budget",v.holiday,"var(--hol)")}${S.pots.map(pt=>moneyRow("su-pot-"+pt.id,esc(pt.name),(v.pots||{})[pt.id]||0,pt.color)).join("")}
    <div class="row muted"><span class="dot" style="background:var(--cash)"></span><span style="flex:1">Cash <span style="font-size:13px">· rest, automatic</span></span><span class="num" id="su-cash" style="color:var(--ink)"></span></div></div>
    <div class="list glass">${moneyRow("su-val",`Stock portfolio value, end of ${MS[kYM(ks[ks.length-1]).m-1]}`,v.stockValue)}</div>
    <p class="note">${isY?`Safe spreads these totals evenly over the ${ks.length} months and shows them as a monthly average.`:"Same as a check-in. A close estimate is fine."}</p>`,
    nav(nextLabel()),isY?"":`<button class="link" data-act="sskip">Don't know this month – skip</button>`,BK);
    const calc=()=>{const g=id=>parse((document.getElementById(id)||{}).value||0);
      const sv=g("su-sav"),pots=S.pots.reduce((a,pt)=>a+g("su-pot-"+pt.id),0),as=g("su-st")+g("su-pr")+g("su-ho")+pots,cash=sv-as,over=cash<0;
      document.getElementById("su-head").textContent=`Split your ${chf(sv)}`;
      const parts=[[g("su-st"),"var(--stocks)"],[g("su-pr"),"var(--prop)"],[g("su-ho"),"var(--hol)"]].concat(S.pots.map(pt=>[g("su-pot-"+pt.id),pt.color]));
      document.getElementById("su-bar").innerHTML=parts.map(p=>`<span style="flex:${Math.max(p[0],0)};background:${p[1]}"></span>`).join("")+(over?`<span style="flex:${-cash};background:var(--badbar)"></span>`:`<span style="flex:${cash};background:repeating-linear-gradient(135deg,var(--cash) 0 4px,transparent 4px 8px)"></span>`);
      document.getElementById("su-err").textContent=over?`${chf(-cash)} more than you saved. Lower a category.`:"";
      document.getElementById("su-cash").textContent=fmt(Math.max(cash,0));
      document.getElementById("su-next").disabled=over;};
    layer.querySelector(".fscroll").addEventListener("input",calc);calc();
  }
  layer.querySelector(".fscroll").addEventListener("focusin",e=>{if(e.target.matches("input.val"))setTimeout(()=>e.target.select(),0);});
  layer.querySelector(".screen").scrollTop=0;
}
function guessVals(s){
  const steps=setupSteps(),idx=steps.indexOf(s);
  for(let j=idx-1;j>=0;j--){const p=steps[j],v=SU.vals[p.id];if(v&&v!=="skip"){
    if(s.k==="month"&&p.k==="month")return Object.assign({},v);
    if(s.k==="month"&&p.k==="year"){const n=setupMonths(p.y).length;return {income:v.income/n,saved:v.saved/n,stocks:v.stocks/n,property:v.property/n,holiday:v.holiday/n,stockValue:v.stockValue,pots:{}};}
    break;}}
  return {income:"",saved:"",stocks:"",property:"",holiday:"",stockValue:"",pots:{}};
}
function readSetup(){
  const steps=setupSteps(),s=steps[SU.step],g=id=>{const el=document.getElementById(id);return el?parse(el.value):0;};
  if(!s)return;
  if(s.k==="intro")return;
  if(s.k==="bal"){SU.start={cash:g("su-bc"),stockValue:g("su-bv"),paid:g("su-bp")||g("su-bv"),property:g("su-bpr"),holiday:g("su-bh")};return;}
  const pots={};S.pots.forEach(pt=>{const x=g("su-pot-"+pt.id);if(x)pots[pt.id]=x;});
  SU.vals[s.id]={income:g("su-inc"),saved:g("su-sav"),stocks:g("su-st"),property:g("su-pr"),holiday:g("su-ho"),stockValue:g("su-val"),pots};
}
function saveSetup(){
  const steps=setupSteps(),recs=[];let prev=SU.start.stockValue||0;
  steps.forEach(s=>{
    const v=SU.vals[s.id];if(!v||v==="skip")return;
    const potSum=o=>Object.values(o||{}).reduce((a,x)=>a+x,0);
    if(s.k==="month"){const o=kYM(s.key);const val=v.stockValue||prev;
      recs.push({y:o.y,m:o.m,income:v.income,saved:v.saved,stocks:v.stocks,property:v.property,holiday:v.holiday,pots:Object.assign({},v.pots),cash:v.saved-v.stocks-v.property-v.holiday-potSum(v.pots),stockValue:val,goal:null,est:false});prev=val;}
    else{const ks=setupMonths(s.y),n=ks.length,end=v.stockValue||prev,startV=prev;
      ks.forEach((k,i)=>{const o=kYM(k),pots={};for(const id in v.pots||{})pots[id]=v.pots[id]/n;
        recs.push({y:o.y,m:o.m,income:v.income/n,saved:v.saved/n,stocks:v.stocks/n,property:v.property/n,holiday:v.holiday/n,pots,cash:(v.saved-v.stocks-v.property-v.holiday-potSum(v.pots))/n,stockValue:startV+(end-startV)*(i+1)/n,goal:null,est:true});});
      prev=end;}
  });
  S.start=Object.assign({cash:0,property:0,holiday:0,stockValue:0,paid:0},SU.start);
  const have=new Set(S.months.map(r=>ym(r.y,r.m)));
  recs.forEach(r=>{if(!have.has(ym(r.y,r.m)))S.months.push(r);});
  normalize();S.hkey=null;
  return recs.length;
}
function endSetup(saved){
  if(!saved&&FL){FL=false;layer.innerHTML="";if(!S.setupDone)enterDemo();S.tab="home";render();return;}
  let n=0;if(saved)n=saveSetup();
  if(FL){drawFirst("notify");if(saved)toast(n?`${n} month${n===1?"":"s"} saved`:"Balances saved");return;}
  close();if(saved){S.tab="history";render();toast(n?`${n} month${n===1?"":"s"} added`:"Balances saved");}
}

/* ---------- events ---------- */
document.getElementById("frame").addEventListener("click",e=>{
  const t=e.target.closest("[data-act]");if(!t)return;
  const a=t.dataset.act;
  if(S.demo&&["backup","restore","wipe","setup"].includes(a)){toast("Not available in Demo mode");return;}
  switch(a){
    case "demo": if(!S.demo){enterDemo();render(true);toast(S.setupDone?"Demo mode on · your numbers are hidden":"Demo mode on");}
      else{leaveDemo();render(true);toast(S.setupDone?"Demo mode off · your numbers are back":"Demo mode off");}break;
    case "startsetup": leaveDemo();S.tab="home";render();FL=true;firstDone=false;openSetup();FL=true;break;
    case "tab": if(Date.now()-tabClickBlock<450)break;close();S.tab=t.dataset.tab;render();break;
    case "sheet": openSheet(null);break;
    case "edit": openSheet(+t.dataset.i);break;
    case "close": if(t.classList.contains("scrim")&&layer.querySelector(".sheet")){dismissSheet();break;}if(layer.querySelector(".full")&&layer.querySelector(".sheet.info")){layer.querySelectorAll(".full ~ .scrim,.sheet.info").forEach(x=>x.remove());break;}close();break;
    case "dismiss": dismissSheet();break;
    case "propreset": S.equity=20;S.reserve=0;S.pp=Object.assign({},PPDEF);render(true);openInfo("prop");toast("Back to bank standard");break;
    case "discard": sheetDirty=false;close();break;
    case "keep": layer.querySelectorAll(".askbox,.ascrim").forEach(x=>x.remove());break;
    case "info": openInfo(t.dataset.k,t.dataset.a);break;
    case "hjump": S.hkey=t.dataset.k;render(true);break;
    case "hmenu": openMenu();break;
    case "mode": {const old=S.hmode,k=S.hkey;S.hmode=t.dataset.mode;
      const ps=periods(old),p=ps.find(x=>x.k===k);const ref=p?S.months[p.idx[p.idx.length-1]]:cur();
      S.hkey=S.hmode==="month"?`${ref.y}-${ref.m}`:S.hmode==="quarter"?`${ref.y}-Q${Math.ceil(ref.m/3)}`:`${ref.y}`;
      close();render();break;}
    case "hprev": case "hnext": step(a==="hnext"?1:-1);break;
    case "switch": {S.reminder=!S.reminder;const sw=t.matches(".switch")?t:t.querySelector(".switch");sw.setAttribute("aria-checked",S.reminder);}toast(S.reminder?"Reminder on · 24th at 19:00":"Reminder off");break;
    case "gfi": {const sw=document.getElementById("g-fi");sw.setAttribute("aria-checked",sw.getAttribute("aria-checked")!=="true");break;}
    case "backup": downloadBackup().then(ok=>{if(!ok){toast("Backup cancelled");return;}S.lastBackup=new Date().toISOString();S.backupYm=ym(S.today.y,S.today.m);document.querySelectorAll(".toast").forEach(x=>x.remove());render(true);toast("Backup saved");});break;
    case "restore": pickBackup(false);break;
    case "wipe": confirmBox({title:"Delete all data?",text:`This removes ${S.months.length} month${S.months.length===1?"":"s"}, your savings goals and all balances from this iPhone. It can't be undone. Backup files you downloaded stay.`,ok:"Delete everything",type:"DELETE",run:()=>{S.setupDone=false;S.months=[];S.start={cash:0,property:0,holiday:0,stockValue:0,paid:0};S.pots=[];S.nextGoal=0;S.hkey=null;S.tab="home";close();render();toast("All data deleted");}});break;
    case "delmonth": {const r=S.months[editI],name=`${MONTHS[r.m-1]} ${r.y}`,idx=editI;confirmBox({title:`Delete ${name}?`,text:`Its ${chf(r.saved)} saved and the split are removed from History and from your balances. It can't be undone.`,ok:"Delete month",run:()=>{S.months.splice(idx,1);S.hkey=null;close();render(true);toast(`${name} deleted`);}});break;}
    case "confirm": {const fn=pending;if(fn)fn();break;}
    case "addgoal": openGoalSheet(null);break;
    case "goaledit": openGoalSheet(t.dataset.a);break;
    case "delpot": deletePot(t.dataset.a);break;
    case "notif": close();if(isLogged()){S.tab="checkin";render();toast("This month is already logged");}else openSheet(null);break;
    case "due": S.tab="home";render();openDue();break;
    case "later": close();toast("Safe will remind you again tomorrow");break;
    case "flrestore": pickBackup(true);break;
    case "fl": {const s=t.dataset.s;
      if(s==="setup"){openSetup();break;}
      if(s==="demo"){S.welcomed=true;FL=false;layer.innerHTML="";enterDemo();S.tab="home";render();toast("This is example data · tap Start setup when you're ready");break;}
      if(s==="ask"){askNotifications();break;}
      if(s==="no"){finishFirst(false);break;}
      drawFirst(s);break;}
    case "setup": {const keep=FL;openSetup();FL=keep;break;}
    case "sumode": SU.mode=t.dataset.v;if(SU.mode==="today")SU.fromK=SU.toK;else SU.fromK=SU.pastFrom<SU.toK?SU.pastFrom:SU.toK-9;fixPlan();drawSetup();break;
    case "plan": SU.plan[t.dataset.y]=t.dataset.v;SU.step=0;drawSetup();break;
    case "snext": {readSetup();const n=setupSteps().length-1;if(SU.step>=n){endSetup(true);}else{SU.step++;drawSetup();}break;}
    case "sback": readSetup();SU.step=Math.max(0,SU.step-1);drawSetup();break;
    case "sskip": {const st=setupSteps(),cs=st[SU.step];SU.vals[cs.id]="skip";if(SU.step>=st.length-1){endSetup(true);}else{SU.step++;drawSetup();}break;}
    case "sclose": endSetup(false);break;
  }
});
function step(d){const ps=periods(S.hmode);if(!ps.length)return;let pi=ps.findIndex(p=>p.k===S.hkey);pi=Math.min(Math.max(pi+d,0),ps.length-1);S.hkey=ps[pi].k;render(true);}
document.getElementById("frame").addEventListener("change",e=>{
  const su=e.target.dataset.su;
  if(su&&SU){const fm=+document.getElementById("su-fm").value,fy=+document.getElementById("su-fy").value;let k=ym(fy,fm);const maxK=SU.hist?SU.toK-1:SU.toK;if(k>maxK)k=maxK;SU.fromK=k;SU.pastFrom=k;fixPlan();drawSetup();return;}
});
/* settings and targets save while typing (iOS may skip "change" after live formatting) */
let setDirty=false;
function applySetting(el){const id=el.dataset.set;if(!id)return;const v=parse(el.value);
  if(id==="s-fi"&&v>0)S.fi=v; if(id==="s-hol"&&v>0)S.holidayTarget=v; if(id==="s-emer"&&v>0)S.emergency=v; if(id==="s-eq"&&v>0&&v<=100)S.equity=v; if(id==="s-res"&&v>=0)S.reserve=v; if(id==="s-ret"&&v>=0&&v<30)S.ret=v;
  setDirty=true;persist();}
document.getElementById("frame").addEventListener("input",e=>{if(e.target.dataset&&e.target.dataset.set)applySetting(e.target);});
document.getElementById("frame").addEventListener("focusout",e=>{
  if(!(e.target.dataset&&e.target.dataset.set)||!setDirty)return;setDirty=false;
  const inSheet=e.target.closest(".sheet");render(true);
  if(inSheet&&lastInfo){openInfo(lastInfo.k,lastInfo.a);}
  toast("Saved");
});
// swipe in History
let sx=0,sy=0;
scr.addEventListener("touchstart",e=>{const p=e.touches[0];sx=p.clientX;sy=p.clientY;},{passive:true});
scr.addEventListener("touchend",e=>{if(S.tab!=="history"||layer.innerHTML)return;const p=e.changedTouches[0],dx=p.clientX-sx,dy=p.clientY-sy;if(Math.abs(dx)>60&&Math.abs(dy)<50)step(dx<0?1:-1);},{passive:true});
document.addEventListener("touchstart",()=>{},{passive:true});
document.getElementById("frame").addEventListener("keydown",e=>{if((e.key==="Enter"||e.key===" ")&&e.target.matches('[role="button"][data-act]')){e.preventDefault();e.target.click();}});
document.addEventListener("keydown",e=>{if(e.key==="Escape"&&layer.innerHTML&&!FL)close();if(S.tab==="history"&&!layer.innerHTML&&!e.target.matches("input")){if(e.key==="ArrowLeft")step(-1);if(e.key==="ArrowRight")step(1);}});

/* ---------- live thousands separator while typing (1000 → 1’000) ---------- */
function groupLive(el){
  const old=el.value,pos=el.selectionStart==null?old.length:el.selectionStart;
  let s=old.replace(/,/g,".").replace(/[^0-9.\-]/g,"");
  const neg=s.startsWith("-");s=s.replace(/-/g,"");
  const dot=s.indexOf(".");let int=dot<0?s:s.slice(0,dot),dec=dot<0?"":"."+s.slice(dot+1).replace(/\./g,"");
  int=int.replace(/^0+(?=\d)/,"");
  const out=(neg?"-":"")+int.replace(/\B(?=(\d{3})+(?!\d))/g,"\u2019")+dec;
  if(out===old)return;
  const keep=old.slice(0,pos).replace(/,/g,".").replace(/[^0-9.\-]/g,"").length;
  el.value=out;
  let n=0,p=0;while(p<out.length&&n<keep){if(/[0-9.\-]/.test(out[p]))n++;p++;}
  try{el.setSelectionRange(p,p);}catch(_){}
}
document.addEventListener("input",e=>{const el=e.target;if(el&&el.matches&&el.matches('input[inputmode="decimal"]'))groupLive(el);},true);

/* ---------- start ---------- */
function maybeDue(){
  if(!S.setupDone||S.demo||layer.innerHTML)return;
  const d=dueMonth();if(!d)return;
  const key=`${S.today.y}-${S.today.m}-${S.today.d}`;if(S.lastDuePrompt===key)return;
  if(isBehind()||S.today.d>=24){S.lastDuePrompt=key;persist();openDue();}
}
SafeStore.load().then(st=>{
  if(st){PKEYS.forEach(k=>{if(st[k]!==undefined)S[k]=st[k];});REAL=st.real||null;}
  normalize();ready=true;render();
  if(S.setupDone)S.welcomed=true;
  if(!S.welcomed)openFirst();
  else if(!S.setupDone&&!S.demo&&!S.months.length&&!REAL){enterDemo();render();}
  else maybeDue();
  SafeStore.persist();
});
/* swipe in from the left edge on full-screen pages = Back */
let ex=null;
layer.addEventListener("touchstart",e=>{const t=e.touches[0];ex=(layer.querySelector(".full .backbtn")&&!layer.querySelector(".sheet")&&t.clientX<28)?{x:t.clientX,y:t.clientY}:null;},{passive:true});
layer.addEventListener("touchend",e=>{if(!ex)return;const t=e.changedTouches[0],dx=t.clientX-ex.x,dy=Math.abs(t.clientY-ex.y);ex=null;if(dx>70&&dy<60){const b=layer.querySelector(".full .backbtn");if(b)b.click();}},{passive:true});
window.addEventListener("pagehide",()=>persist());
document.addEventListener("visibilitychange",()=>{if(document.hidden){persist();return;}if(ready){refreshToday();if(!layer.innerHTML)render(true);maybeDue();}});
})();
