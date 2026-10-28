(function(){
const MONTHS=["January","February","March","April","May","June","July","August","September","October","November","December"];
const MS=MONTHS.map(m=>m.slice(0,3));
const fmt=n=>{const r=Math.round(+n||0);return (r<0?"-":"")+String(Math.abs(r)).replace(/\B(?=(\d{3})+(?!\d))/g,"\u2019");};
const CURS=[["CHF","Swiss franc"],["EUR","Euro"],["USD","US dollar"]];
const CUR=()=>CURS.some(c=>c[0]===S.currency)?S.currency:"CHF";
const chf=n=>CUR()+" "+fmt(n);
const parse=s=>{const v=parseFloat(String(s).replace(/[^0-9.\-]/g,""));return isNaN(v)?0:v};
const esc=s=>String(s).replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]));
const POTCOL=["#E0457B","#2DA44E","#6C63FF","#B7791F","#0EA5E9"];

const VERSION="1.12.5";

/* ---------- state ---------- */
function emptyData(){return {months:[],start:{cash:0,property:0,holiday:0,stockValue:0,paid:0},pots:[],nextGoal:0,oneoffs:[],assets:[]};}
const S=Object.assign(emptyData(),{fi:1000000,holidayTarget:4000,equity:20,reserve:0,pp:{income:0,rate:5,upkeep:1,amortTo:66.7,amortYears:15,share:33.3},birthYear:0,fiAge:50,chartAge:62,tipsSeen:{},ciDay:24,currency:"CHF",since:null,sinceTo:null,ot:{best:8,mid:5,worst:2},ret:5,emergency:18000,reminder:false,tab:"home",hmode:"quarter",hkey:null,
  lastBackup:null,backupYm:null,createdYm:null,setupDone:false,welcomed:false,demo:false,lastDuePrompt:null,today:{y:2000,m:1,d:1}});
let REAL=null;
const PKEYS=["months","start","pots","nextGoal","oneoffs","assets","fi","holidayTarget","equity","reserve","pp","birthYear","fiAge","chartAge","ot","ret","emergency","reminder","hmode","lastBackup","backupYm","createdYm","setupDone","welcomed","demo","lastDuePrompt","tipsSeen","ciDay","currency","since","sinceTo"];
function refreshToday(){const d=new Date();S.today={y:d.getFullYear(),m:d.getMonth()+1,d:d.getDate()};}
refreshToday();
let saveT=null,ready=false;
function persist(){if(!ready)return;const o={version:1};PKEYS.forEach(k=>o[k]=S[k]);o.real=REAL;SafeStore.save(o);}
function normalize(){
  S.months.forEach(r=>{if(!r.pots)r.pots={};});
  if(!Array.isArray(S.oneoffs))S.oneoffs=[];if(!Array.isArray(S.assets))S.assets=[];
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
  return {months:ms,start:{cash:9000,property:1500,holiday:300,stockValue:4000,paid:3600},pots:[{id:"demo1",name:"New car",target:12000,fi:false,color:"#E0457B"}],nextGoal:2700,oneoffs:[],assets:[]};
}
function enterDemo(){if(S.demo)return;REAL={months:S.months,start:S.start,pots:S.pots,nextGoal:S.nextGoal,oneoffs:S.oneoffs,assets:S.assets,birthYear:S.birthYear,fiAge:S.fiAge,lastBackup:S.lastBackup,backupYm:S.backupYm};Object.assign(S,demoData(),{birthYear:1994,fiAge:50,demo:true,hkey:null,lastBackup:new Date().toISOString(),backupYm:ym(S.today.y,S.today.m)});}
function leaveDemo(){if(!S.demo)return;Object.assign(S,{birthYear:0,fiAge:50,oneoffs:[],assets:[]},REAL||emptyData(),{demo:false,hkey:null});REAL=null;}
const backupLabel=()=>S.lastBackup?new Date(S.lastBackup).toLocaleDateString("en-GB",{day:"numeric",month:"long",year:"numeric"}):"never";
const backupOverdue=()=>S.months.length>0&&ym(S.today.y,S.today.m)-(S.backupYm??S.createdYm??ym(S.today.y,S.today.m))>=2;

const potOutOf=r=>S.pots.filter(p=>!p.fi).reduce((a,p)=>a+((r.pots||{})[p.id]||0),0);
function bal(i){
  const b={cash:S.start.cash,property:S.start.property,holiday:S.start.holiday,paid:S.start.paid||0,value:S.start.stockValue||0,pots:{}};
  S.pots.forEach(p=>b.pots[p.id]=0);
  for(let k=0;k<=i&&k<S.months.length;k++){const r=S.months[k];b.cash+=r.cash;b.property+=r.property;b.holiday+=r.holiday;b.paid+=r.stocks;b.value=r.stockValue;for(const id in (r.pots||{}))if(id in b.pots)b.pots[id]+=r.pots[id];}
  /* one-off amounts (inheritance, gift, bonus): added on their month, not part of monthly saving */
  const lastK=i>=L()||i<0?Infinity:ym(S.months[i].y,S.months[i].m),refK=i>=0&&S.months[Math.min(i,L())]?ym(S.months[Math.min(i,L())].y,S.months[Math.min(i,L())].m):-1;
  b.oneoff=0;(S.oneoffs||[]).forEach(o=>{const k=ym(o.y,o.m);if(k>lastK)return;b.oneoff+=o.amount;
    if(o.to==="stocks"){b.paid+=o.amount;if(k>refK)b.value+=o.amount;}else if(o.to==="property")b.property+=o.amount;else if(o.to==="holiday")b.holiday+=o.amount;else if(o.to in b.pots)b.pots[o.to]+=o.amount;else b.cash+=o.amount;});
  /* owned property (e.g. an inherited home): equity = value - mortgage; counts toward the goal only if switched on */
  b.assetEq=0;b.assetFi=0;(S.assets||[]).forEach(a=>{const e=(a.value||0)-(a.debt||0);b.assetEq+=e;if(a.fi)b.assetFi+=e;});
  b.potSum=S.pots.reduce((a,p)=>a+b.pots[p.id],0);
  b.potOut=S.pots.filter(p=>!p.fi).reduce((a,p)=>a+b.pots[p.id],0);
  b.nw=b.cash+b.value+b.property+b.holiday+b.potSum+b.assetEq;b.fi=b.nw-b.holiday-b.potOut-b.assetEq+b.assetFi;b.gain=b.value-b.paid;return b;
}
const L=()=>S.months.length-1;
const cur=()=>S.months[L()]||null;
const blank=()=>({y:S.today.y,m:S.today.m,income:0,saved:0,stocks:0,property:0,holiday:0,cash:0,stockValue:0,goal:0,pots:{}});
const ym=(y,m)=>y*12+m-1;
/* check-in day: 1-28 or 0 = last day of the month. Days 1-14 count for the previous month. */
const ciDayN=()=>S.ciDay==null?24:S.ciDay;
const ciOff=()=>{const d=ciDayN();return d>=1&&d<=14?1:0;};
const refK=()=>ym(S.today.y,S.today.m)-ciOff();
const ordinal=d=>d===0?"last day":d+((d%10===1&&d!==11)?"st":(d%10===2&&d!==12)?"nd":(d%10===3&&d!==13)?"rd":"th");
const ciWord=()=>ciDayN()===0?"the last day of the month":"the "+ordinal(ciDayN());
function ciDate(y,m){const k=ym(y,m)+ciOff(),yy=Math.floor(k/12),mm=k%12+1,d=ciDayN()||new Date(yy,mm,0).getDate();return new Date(yy,mm-1,d);}
const ciLabel=(y,m)=>ciDate(y,m).toLocaleDateString("en-GB",{weekday:"long",day:"numeric",month:"long"});
const ciShort=(y,m)=>ciDate(y,m).toLocaleDateString("en-GB",{day:"numeric",month:"long"});
function dueMonth(){const r=cur(),rk=refK();if(!r){const k=S.setupDone&&S.createdYm!=null?Math.min(S.createdYm,ym(S.today.y,S.today.m)):rk;if(k>rk)return null;return {y:Math.floor(k/12),m:k%12+1};}const n=ym(r.y,r.m)+1;if(n>rk)return null;return {y:Math.floor(n/12),m:n%12+1};}
const isLogged=()=>!dueMonth();
const isBehind=()=>{const d=dueMonth();return !!d&&ym(d.y,d.m)<refK();};
/* "Saving since": rough monthly average from the start balances, used for months without a check-in until 12 real ones exist */
function sinceEst(){if(S.since==null||S.sinceTo==null||S.sinceTo<=S.since)return null;const n=S.sinceTo-S.since,st=S.start||{};return {n,stocks:(st.paid||0)/n,fi:((st.cash||0)+(st.property||0)+(st.paid||0))/n};}
function blendAvg(n){const xs=S.months.slice(-n),e=sinceEst(),miss=e?Math.max(n-xs.length,0):0,cnt=xs.length+miss;
  const fi=xs.reduce((a,r)=>a+r.saved-r.holiday-potOutOf(r),0)+(e?e.fi*miss:0),st=xs.reduce((a,r)=>a+r.stocks,0)+(e?e.stocks*miss:0);
  return {fi:cnt?fi/cnt:0,stocks:cnt?st/cnt:0,real:xs.length,est:miss};}
function avgSave(n){return blendAvg(n).fi;}
/* year the goal is reached: same engine as On track (only stocks grow, middle case) */
function projYear(base,withAge){
  if(base>=S.fi)return "reached";
  const o=onTrack();if(o.reachK==null)return "–";
  const y=Math.floor(o.reachK/12);return withAge&&o.by?`${y} (age ${y-o.by})`:String(y);
}
const midRet=()=>Object.assign({best:8,mid:5,worst:2},S.ot||{}).mid;
const lastIdx=(y,m)=>{let k=-1;S.months.forEach((r,i)=>{if(ym(r.y,r.m)<=ym(y,m))k=i;});return k;};

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
function propRow(b){const p=propCalc(b);
  return `<button class="card glass" data-act="info" data-k="prop" style="flex-direction:row;align-items:center;gap:12px;padding:14px 18px;text-align:left" aria-label="First property details"><span style="width:36px;height:36px;border-radius:12px;display:flex;align-items:center;justify-content:center;background:var(--warnbg);color:var(--prop);flex:none">${IC.house}</span><span style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0"><span class="muted" style="font-size:0.7647rem">First property · can buy up to</span><span style="font-size:1.1765rem;font-weight:700;letter-spacing:-.01em">${chf(p.max)}</span></span><span style="color:var(--accent);font-weight:600;font-size:1.1765rem" aria-hidden="true">›</span></button>`;}
function propCard(b){
  const p=propCalc(b),top=Math.max(p.byEq,p.byInc,1);
  const bar=(label,v,on)=>`<div style="display:flex;flex-direction:column;gap:4px"><div style="display:flex;justify-content:space-between;font-size:0.7647rem"><span class="muted">${label}</span><span class="num" style="${on?"color:var(--ink)":"color:var(--muted)"}">${p.inc||label.indexOf("income")<0?chf(v):"no income yet"}</span></div><span style="height:7px;border-radius:4px;background:var(--track);overflow:hidden"><span style="display:block;height:7px;width:${Math.min(v/top*100,100)}%;background:${on?"var(--prop)":"var(--soft)"};opacity:${on?1:.45}"></span></span></div>`;
  return `<section class="card glass" data-act="info" data-k="prop" role="button" tabindex="0" aria-label="First property details">
    <div style="display:flex;align-items:center;gap:12px"><span style="width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--warnbg);color:var(--prop);flex:none">${IC.house}</span><span style="flex:1;font-size:1rem;font-weight:600">First property</span><span class="pill warn" style="align-self:center">Limited by ${p.limit}</span></div>
    <div style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:0.7647rem">Can buy up to</span><span class="big" style="font-size:2rem">${chf(p.max)}</span></div>
    ${bar("With your equity",p.byEq,p.limit==="equity")}${bar("With your income",p.byInc,p.limit==="income")}
    <div style="display:grid;grid-template-columns:repeat(3,minmax(0,1fr));gap:8px;border-top:1px solid var(--line);padding-top:10px">
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:0.7059rem">Property savings</span><span class="num" style="font-size:0.8824rem">${chf(b.property)}</span></span>
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:0.7059rem">Safety reserve</span><span class="num" style="font-size:0.8824rem">${p.reserve?"−"+fmt(p.reserve):"0"}</span></span>
      <span style="display:flex;flex-direction:column;gap:2px"><span class="muted" style="font-size:0.7059rem">Equity needed (${S.equity}%)</span><span class="num" style="font-size:0.8824rem">${chf(p.need)}</span></span>
    </div>
    <span class="muted" style="font-size:0.7647rem">At this price: about ${chf(p.cost)}/month housing costs${p.inc?` · max. ${fmtPct(p.pp.share)} of your income`:""} · tap to adjust</span>
  </section>`;
}

function propResults(){
  const b=bal(L()),p=propCalc(b);
  return `<div style="display:flex;flex-direction:column;gap:4px;margin-bottom:10px"><span class="big">${chf(p.max)}</span><span class="muted">maximum price · limited by your ${p.limit}</span></div>
  ${(()=>{const kv=rows=>`<div class="field">${rows.map(x=>`<div class="kv"><span class="muted">${x[0]}</span><b>${x[1]}</b></div>`).join("")}</div>`;
  return kv([["Property savings",chf(b.property)],["− Safety reserve",chf(p.reserve)],["= Usable equity",chf(p.usable)],[`Price with ${fmtPct(S.equity)} down payment`,chf(p.byEq)],[`Income per year${p.manualInc?" (entered)":" (check-ins)"}`,p.inc?chf(p.inc):"–"],["Price your income allows",p.inc?chf(p.byInc):"–"],["Mortgage at max. price",chf(p.max-p.need)],["Housing costs (calculated)",chf(p.cost)+"/month"]]);})()}`;
}
function wireOnTrack(){
  const res=document.getElementById("ot-res");if(!res)return;
  const draw=()=>{const o=onTrack();res.innerHTML=o.by?`${onTrackChart(o)}<div class="field" style="margin-top:8px">${[["Best case",o.cases.best.end,"var(--goodline)"],["Middle case",o.cases.mid.end,"var(--accent)"],["Worst case",o.cases.worst.end,"var(--prop)"]].map(x=>`<div class="kv"><span class="muted">${x[0]} at ${S.fiAge}</span><b style="color:${x[2]}">${chf(x[1])}</b></div>`).join("")}<div class="kv"><span class="muted">of that paid in by you</span><b>${chf(o.cases.mid.paidEnd)}</b></div><div class="kv"><span class="muted">of that growth (middle case)</span><b>${chf(o.cases.mid.end-o.cases.mid.paidEnd)}</b></div><div class="kv"><span class="muted">Goal</span><b>${chf(S.fi)}</b></div>${o.status==="behind"?`<div class="kv"><span class="muted">Extra into stocks to reach it (middle case)</span><b>${chf(o.extra)}/month</b></div>`:""}</div>`:`<p class="explain">Enter your birth year below to see the projection.</p>`;};
  draw();
  const sh=res.closest(".sheet,.dpage");
  sh.addEventListener("input",e=>{const id=e.target.dataset.ot;if(!id)return;const v=parse(e.target.value);
    if(id==="birthYear"){S.birthYear=v>1900&&v<=S.today.y?v:0;}else if(id==="fiAge"){if(v>=18&&v<=100)S.fiAge=v;}else if(id==="chartAge"){if(v>=18&&v<=100)S.chartAge=v;}else if(id==="fi"){if(v>0)S.fi=v;}else{S.ot=Object.assign({best:8,mid:5,worst:2},S.ot||{});if(v>=-20&&v<=30)S.ot[id]=v;}
    persist();draw();});
  sh.addEventListener("focusout",()=>{render(true);});
}
function wireProp(){
  const res=document.getElementById("pp-res");if(!res)return;res.innerHTML=propResults();
  const sh=res.closest(".sheet,.dpage");
  sh.addEventListener("input",e=>{const id=e.target.dataset.pp;if(!id)return;const v=parse(e.target.value);
    if(id==="eq"){if(v>0&&v<=100)S.equity=v;}else if(id==="reserve"){S.reserve=Math.max(v,0);}
    else{S.pp=Object.assign({},PPDEF,S.pp||{});if(id==="income")S.pp.income=e.target.value.trim()===""?0:Math.max(v,0);else if(v>=0)S.pp[id]=v;}
    res.innerHTML=propResults();persist();});
  sh.addEventListener("focusout",()=>{render(true);});
  sh.addEventListener("focusin",e=>{if(e.target.matches("input"))setTimeout(()=>e.target.select(),0);});
}
/* ---------- on track for FI: three return cases on invested money ---------- */
const kfmt=v=>{const a=Math.abs(v);return a>=1e6?(Math.round(v/1e5)/10).toString().replace(/\.0$/,"")+"M":a>=1e3?Math.round(v/1e3)+"k":String(Math.round(v));};
function onTrack(){
  const b=bal(L()),ot=Object.assign({best:8,mid:5,worst:2},S.ot||{});
  const nowR=cur()||{y:S.today.y,m:S.today.m},nowK=ym(nowR.y,nowR.m);
  const by=S.birthYear||0,targetK=by?ym(by+S.fiAge,7):nowK+12*20;
  const n=Math.max(targetK-nowK,0);
  const ba=blendAvg(12);
  const mStocks=ba.stocks;
  const mFi=ba.fi;
  const mOther=mFi-mStocks;
  const inv0=b.value,oth0=b.fi-b.value;
  const paid0=b.fi-b.gain;
  const chartK=by?Math.max(ym(by+Math.max(S.chartAge||62,S.fiAge),7),targetK):targetK,nn=Math.max(chartK-nowK,n);
  const run=pct=>{const r=pct/100/12,pts=[{i:0,v:inv0+oth0,p:paid0}];let inv=inv0,oth=oth0,pd=paid0,end=inv+oth,paidEnd=pd,cross=inv+oth>=S.fi?0:null;for(let k=1;k<=nn;k++){inv=inv*(1+r)+mStocks;oth+=mOther;pd+=mStocks+mOther;if(cross==null&&inv+oth>=S.fi)cross=k;if(k===n){end=inv+oth;paidEnd=pd;}if(k%3===0||k===n||k===nn)pts.push({i:k,v:inv+oth,p:pd});}return {end,paidEnd,last:inv+oth,pts,cross};};
  const cases={best:run(ot.best),mid:run(ot.mid),worst:run(ot.worst)};
  const r=ot.mid/100/12,g=Math.pow(1+r,n);
  const needStocks=n>0?(S.fi-inv0*g-oth0-mOther*n)*(r?r/(g-1):1/n):0;
  const extra=Math.max(needStocks-mStocks,0);
  let reachK=null;{let inv=inv0,oth=oth0;for(let k=0;k<=1200;k++){if(inv+oth>=S.fi){reachK=nowK+k;break;}inv=inv*(1+r)+mStocks;oth+=mOther;}}
  const status=!by?"set":cases.mid.end>=S.fi?(reachK!=null&&reachK<=targetK-12?"ahead":"on"):"behind";
  return {ba,b,ot,by,nowK,targetK,chartK,nn,n,mStocks,mOther,mFi,cases,extra,reachK,status,hist:S.months.map((m,i)=>{const x=bal(i);return {k:ym(m.y,m.m),v:x.fi,p:x.fi-x.gain};})};
}
function onTrackChart(o){
  const W=340,H=190,pl=8,pr=46,pt=14,pb=26;
  const histFrom=o.hist.length?Math.max(o.hist[0].k,o.nowK-120):o.nowK;
  const k0=histFrom,k1=Math.max(o.chartK,o.nowK+12);
  const vmax=Math.max(o.cases.best.last,S.fi*1.08,...o.hist.map(h=>h.v),1);
  const X=k=>pl+(k-k0)/(k1-k0||1)*(W-pl-pr),Y=v=>pt+(1-Math.max(v,0)/vmax)*(H-pt-pb);
  const line=(c,col,dash,w)=>{const p=c.pts.map(q=>`${X(o.nowK+q.i).toFixed(1)},${Y(q.v).toFixed(1)}`).join(" ");return `<polyline points="${p}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linejoin="round" ${dash?'stroke-dasharray="5 4"':""}/>`;};
  const histA=o.hist.filter(h=>h.k>=(o.hist.length?Math.max(o.hist[0].k,o.nowK-120):o.nowK));
  const topPts=histA.map(h=>[X(h.k),Y(h.v)]).concat(o.cases.mid.pts.map(q=>[X(o.nowK+q.i),Y(q.v)]));
  const paidPts=histA.map(h=>[X(h.k),Y(h.p)]).concat(o.cases.mid.pts.map(q=>[X(o.nowK+q.i),Y(q.p)]));
  const ps=a=>a.map(q=>q[0].toFixed(1)+","+q[1].toFixed(1)).join(" ");
  const x0=topPts.length?topPts[0][0]:pl,x1=topPts.length?topPts[topPts.length-1][0]:pl,yb=(H-pb).toFixed(1);
  const areas=`<polygon points="${x0.toFixed(1)},${yb} ${ps(paidPts)} ${x1.toFixed(1)},${yb}" fill="var(--soft)" opacity=".22"/><polygon points="${ps(topPts)} ${ps(paidPts.slice().reverse())}" fill="var(--accent)" opacity=".28"/><polyline points="${ps(paidPts)}" fill="none" stroke="var(--soft)" stroke-width="1.2"/>`;
  const hist=o.hist.filter(h=>h.k>=histFrom);
  const histLine=hist.length?`<polyline points="${hist.map(h=>`${X(h.k).toFixed(1)},${Y(h.v).toFixed(1)}`).join(" ")} ${X(o.nowK).toFixed(1)},${Y(o.cases.mid.pts[0].v).toFixed(1)}" fill="none" stroke="var(--ink)" stroke-width="2.4" stroke-linejoin="round"/>`:"";
  const step=(()=>{const raw=vmax/6,p=Math.pow(10,Math.floor(Math.log10(raw)));return [1,2,2.5,5,10].map(m=>m*p).find(s=>s>=raw);})();const ticks=[];for(let v=step;v<=vmax*1.001;v+=step)ticks.push(v);
  const yr=k=>Math.floor(k/12),age=k=>o.by?yr(k)-o.by:null;
  const lab=(k,t,anchor)=>`<text x="${X(k).toFixed(1)}" y="${H-8}" text-anchor="${anchor}" font-size="10" fill="var(--muted)">${t}</text>`;
  const endY=c=>Y(c.last);
  const ends=[["best",o.cases.best,"var(--goodline)"],["mid",o.cases.mid,"var(--accent)"],["worst",o.cases.worst,"var(--prop)"]];
  let ly=ends.map(e=>endY(e[1]));for(let i=1;i<3;i++)if(ly[i]-ly[i-1]<13)ly[i]=ly[i-1]+13;
  return `<svg viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="Projection toward your financial goal" style="display:block;overflow:visible">
    ${ticks.map(v=>`<line x1="${pl}" x2="${W-pr}" y1="${Y(v).toFixed(1)}" y2="${Y(v).toFixed(1)}" stroke="var(--line)"/>${Math.abs(Y(v)-Y(S.fi))>14?`<text x="${pl+2}" y="${(Y(v)-4).toFixed(1)}" font-size="9.5" fill="var(--muted)">${kfmt(v)}</text>`:""}`).join("")}
    <line x1="${pl}" x2="${W-pr}" y1="${H-pb}" y2="${H-pb}" stroke="var(--line)"/>
    ${areas}
    <line x1="${pl}" x2="${W-pr}" y1="${Y(S.fi).toFixed(1)}" y2="${Y(S.fi).toFixed(1)}" stroke="var(--soft)" stroke-width="1.2" stroke-dasharray="3 4"/>
    <text x="${pl+2}" y="${(Y(S.fi)-5).toFixed(1)}" font-size="10" fill="var(--muted)">Goal ${kfmt(S.fi)}</text>
    ${o.by?`<line x1="${X(o.targetK).toFixed(1)}" x2="${X(o.targetK).toFixed(1)}" y1="${pt}" y2="${H-pb}" stroke="var(--soft)" stroke-dasharray="2 4"/>`:""}
    ${line(o.cases.worst,"var(--prop)",true,1.6)}${line(o.cases.best,"var(--goodline)",true,1.6)}${line(o.cases.mid,"var(--accent)",false,2.4)}
    ${histLine}
    <circle cx="${X(o.nowK).toFixed(1)}" cy="${Y(o.cases.mid.pts[0].v).toFixed(1)}" r="4" fill="var(--ink)"/>
    ${ends.map((e,i)=>`<text x="${W-pr+4}" y="${(ly[i]+3).toFixed(1)}" font-size="10" font-weight="700" fill="${e[2]}">${kfmt(e[1].last)}</text>`).join("")}
    ${o.by&&o.chartK>o.targetK?(()=>{let ty=ends.map(e=>Y(e[1].end));for(let i=1;i<3;i++)if(ty[i]-ty[i-1]<12)ty[i]=ty[i-1]+12;
      return ends.map((e,i)=>`<circle cx="${X(o.targetK).toFixed(1)}" cy="${Y(e[1].end).toFixed(1)}" r="3" fill="${e[2]}"/><text x="${(X(o.targetK)-6).toFixed(1)}" y="${(ty[i]+(i===0?-4:3)).toFixed(1)}" text-anchor="end" font-size="9.5" font-weight="700" fill="${e[2]}" paint-order="stroke" stroke="var(--bg)" stroke-width="3">${kfmt(e[1].end)}</text>`).join("");})():""}
    ${o.by?(()=>{const cs=ends.filter(e=>e[1].cross!=null&&e[1].cross>0).map(e=>({x:X(o.nowK+e[1].cross),a:age(o.nowK+e[1].cross),c:e[2]}));let lx=cs.map(c=>c.x);for(let i=1;i<lx.length;i++)if(lx[i]-lx[i-1]<40)lx[i]=lx[i-1]+40;
      return cs.map((c,i)=>`<line x1="${c.x.toFixed(1)}" x2="${c.x.toFixed(1)}" y1="${Y(S.fi).toFixed(1)}" y2="${H-pb}" stroke="${c.c}" stroke-width="1" stroke-dasharray="1 3" opacity=".8"/><circle cx="${c.x.toFixed(1)}" cy="${Y(S.fi).toFixed(1)}" r="3.5" fill="var(--bg)" stroke="${c.c}" stroke-width="2"/><text x="${lx[i].toFixed(1)}" y="${(Y(S.fi)-7).toFixed(1)}" text-anchor="middle" font-size="9.5" font-weight="700" fill="${c.c}" paint-order="stroke" stroke="var(--bg)" stroke-width="3">age ${c.a}</text>`).join("");})():""}
    ${X(o.nowK)-X(k0)>70?lab(k0,String(yr(k0)),"start")+lab(o.nowK,"Now"+(o.by?" · "+age(o.nowK):""),"middle"):`<text x="${Math.max(pl,X(o.nowK)-14).toFixed(1)}" y="${H-8}" font-size="10" fill="var(--muted)">Now${o.by?" · age "+age(o.nowK):""}</text>`}${o.by&&o.chartK>o.targetK&&X(o.chartK)-X(o.targetK)>34?lab(o.targetK,"Goal age "+S.fiAge,"middle")+lab(o.chartK,"Age "+age(o.chartK),"end"):lab(o.targetK,(o.by?"Age "+S.fiAge+" · ":"")+yr(o.targetK),"end")}
  </svg>`;
}
function goalHead(){const b=bal(L()),pct=b.fi/S.fi*100;
  return `<div data-act="info" data-k="fi" role="button" tabindex="0" aria-label="Financial goal details" style="display:flex;flex-direction:column;gap:8px;padding-bottom:12px;border-bottom:1px solid var(--line)">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="muted" style="font-size:0.7647rem">Financial goal · today</span><span class="muted" style="font-size:0.7647rem">Goal ${chf(S.fi)}</span></div>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:1.7647rem;font-weight:700;letter-spacing:-.02em">${pct.toFixed(1)}%</span><span class="muted" style="font-size:0.8235rem">${chf(b.fi)} · excl. holiday${b.potOut?" &amp; spending goals":""}</span></div>
    <span class="track" style="flex:none;height:8px"><span style="width:${Math.min(pct,100)}%;background:linear-gradient(90deg,#5C9BFF,#8E4FD8)"></span></span>
  </div>`;}
function onTrackCard(){
  const o=onTrack();
  if(!o.by)return `<section class="card glass" data-act="info" data-k="ontrack" role="button" tabindex="0" aria-label="Set up on-track check">${goalHead()}<div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:1rem;font-weight:600">On track?</span><span class="pill" style="color:var(--accent);background:var(--field);border-color:var(--fieldb)">Set up</span></div><span class="muted" style="font-size:0.8824rem;line-height:1.4">Enter your birth year and target age to see if you reach your financial goal in time, with best, middle and worst case.</span></section>`;
  const st={on:["good","On track"],ahead:["good","Ahead"],behind:["warn","Behind"]}[o.status];
  const m=o.cases.mid.end;
  return `<section class="card glass" data-act="info" data-k="ontrack" role="button" tabindex="0" aria-label="On track details">${goalHead()}
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-size:1rem;font-weight:600">On track by age ${S.fiAge}?</span><span class="pill ${st[0]}">${st[1]}</span></div>
    <span class="muted" style="font-size:0.8235rem;line-height:1.4">${o.status==="behind"?`At ${fmtPct(o.ot.mid)} you'd have ${chf(m)} at ${S.fiAge}. About <b style="color:var(--ink)">${chf(o.extra)} more per month</b> into stocks closes the gap.`:`At ${fmtPct(o.ot.mid)} you'd have ${chf(m)} at ${S.fiAge}${o.reachK!=null?`, reaching ${kfmt(S.fi)} around ${Math.floor(o.reachK/12)}${o.by?" (age "+(Math.floor(o.reachK/12)-o.by)+")":""}`:""}.`}</span>
    ${onTrackChart(o)}
    <div style="display:flex;gap:16px;font-size:0.7059rem">
      <span style="display:flex;align-items:center;gap:5px"><i style="width:12px;height:12px;border-radius:3px;background:var(--soft);opacity:.45"></i><span class="muted">Paid in by ${S.fiAge}: ${kfmt(o.cases.mid.paidEnd)}</span></span>
      <span style="display:flex;align-items:center;gap:5px"><i style="width:12px;height:12px;border-radius:3px;background:var(--accent);opacity:.45"></i><span class="muted">Growth (${fmtPct(o.ot.mid)}): ${kfmt(o.cases.mid.end-o.cases.mid.paidEnd)}</span></span>
    </div>
    <div style="display:flex;justify-content:space-between;gap:6px;font-size:0.7059rem">
      <span style="display:flex;align-items:center;gap:5px"><i style="width:14px;height:0;border-top:2px dashed var(--goodline)"></i><span class="muted">Best ${fmtPct(o.ot.best)}</span></span>
      <span style="display:flex;align-items:center;gap:5px"><i style="width:14px;height:0;border-top:2.5px solid var(--accent)"></i><span class="muted">Middle ${fmtPct(o.ot.mid)}</span></span>
      <span style="display:flex;align-items:center;gap:5px"><i style="width:14px;height:0;border-top:2px dashed var(--prop)"></i><span class="muted">Worst ${fmtPct(o.ot.worst)}</span></span>
    </div>
    <span class="muted" style="font-size:0.7059rem;line-height:1.4">Based on your average of ${chf(o.mFi)}/month toward your goal (${chf(o.mStocks)} into stocks) from ${o.ba.real?(o.ba.real===1?"your last check-in":"your last "+o.ba.real+" check-ins"):""}${o.ba.real&&o.ba.est?" plus ":""}${o.ba.est?"your estimate since "+kName(S.since):""}; updates with every check-in. Only invested money earns the return. Rings on the goal line show the age each case reaches it.</span>
  </section>`;
}

/* ---------- views ---------- */
function home(){
  const i=L(),b=bal(i),p=bal(i-1),has=!!cur(),r=cur()||blank();
  const delta=has?b.nw-p.nw:0, fiBase=b.fi, fiPct=fiBase/S.fi*100, rate=r.income?r.saved/r.income*100:0;
  const l6=S.months.slice(-6), avg=l6.length?l6.reduce((a,x)=>a+(x.income?x.saved/x.income:0),0)/l6.length*100:0;
  const circ=2*Math.PI*25, dash=Math.min(rate,100)/100*circ;
  const ep=S.emergency>0?Math.min(Math.max(b.cash,0)/S.emergency,1):0;
  const cashSub=S.emergency>0?`<span style="display:flex;flex-direction:column;gap:4px;margin-top:3px"><span class="muted" style="font-size:0.7059rem">${ep>=1?'<b style="color:var(--good)">✓ Emergency fund filled</b>':`Emergency fund ${Math.round(ep*100)}% · ${chf(S.emergency-b.cash)} to go`}</span><span style="height:4px;border-radius:2px;background:var(--track);overflow:hidden;max-width:180px"><span style="display:block;height:4px;width:${ep*100}%;background:${ep>=1?"var(--goodline)":"var(--cash)"}"></span></span></span>`:"";
  const cat=[{n:"Cash savings",v:b.cash,c:"var(--cash)",k:"cat",a:"cash",subHtml:cashSub},{n:"Stocks · paid in",v:b.value,show:b.paid,c:"var(--stocks)",sub:`current value ${fmt(b.value)} (${b.gain>=0?"+":"−"}${fmt(Math.abs(b.gain))}) · volatile`,k:"cat",a:"stocks"},{n:"Property savings",v:b.property,c:"var(--prop)",k:"cat",a:"property"},{n:"Holiday budget",v:b.holiday,c:"var(--hol)",nofi:true,k:"cat",a:"holiday"}]
    .concat(S.pots.map(pt=>({n:esc(pt.name),v:b.pots[pt.id],c:pt.color,nofi:!pt.fi,k:"pot",a:pt.id})))
    .concat((S.assets||[]).map(a=>({n:esc(a.name),v:(a.value||0)-(a.debt||0),c:"#8A6A4F",nofi:!a.fi,k:"asset",a:a.id,sub:a.debt?`value ${fmt(a.value)} · mortgage ${fmt(a.debt)}`:"owned property"})));
  const d=dueMonth();
  return `
  <div class="head"><div><div class="eyebrow">${has?`Latest check-in · ${MONTHS[r.m-1]} ${r.y}`:"No check-ins yet"}</div><h1>Overview</h1></div>
  <button class="btn round" data-act="addmenu" aria-label="Add">${IC.plus}</button></div><!--tip-->
  ${d&&(isBehind()||new Date(S.today.y,S.today.m-1,S.today.d)>=ciDate(d.y,d.m))?`<button class="card glass" data-act="sheet" style="flex-direction:row;align-items:center;gap:12px;padding:14px 18px;text-align:left"><span class="pill ${isBehind()?"warn":"good"}" style="align-self:center">${isBehind()?"Late":"Due"}</span><span style="flex:1;font-size:0.8824rem;font-weight:600">${isBehind()?MONTHS[d.m-1]+" check-in is still open":"Time for your "+MONTHS[d.m-1]+" check-in"}</span><span style="color:var(--accent);font-weight:600;font-size:1.1765rem" aria-hidden="true">›</span></button>`:""}
  ${backupOverdue()?`<button class="card glass" data-act="backup" style="flex-direction:row;align-items:center;gap:12px;padding:14px 18px;text-align:left"><span class="pill warn" style="align-self:center">Backup</span><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-size:0.8824rem;font-weight:600">${S.lastBackup?"Last backup: "+backupLabel():"No backup yet"}</span><span class="muted" style="font-size:0.7647rem">Download one to your Files so your data is safe</span></span><span style="color:var(--accent);font-weight:600;font-size:0.8824rem">Back up</span></button>`:""}
  <section class="card glass" data-act="info" data-k="nw" role="button" tabindex="0" aria-label="Net worth details">
    <div style="display:flex;flex-direction:column;gap:6px"><span class="muted" style="font-size:0.8824rem">Net worth</span>
    <span class="big">${chf(b.nw)}</span>
    <span class="pill ${delta>=0?"good":"warn"}" style="margin-top:4px">${delta>=0?"▲":"▼"} ${chf(Math.abs(delta))} this month</span></div>
    <div class="split" aria-hidden="true">${cat.filter(c=>c.v>0).map(c=>`<span style="flex:${c.v};background:${c.c}"></span>`).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:12px">${cat.map(c=>`
      <div class="catrow" data-act="info" data-k="${c.k}" data-a="${c.a}" role="button" tabindex="0" aria-label="${c.n} details"><span class="dot" style="background:${c.c};box-shadow:0 0 10px ${c.c}"></span>
      <span style="flex:1;display:flex;flex-direction:column;gap:1px;min-width:0"><span style="font-size:1rem">${c.n}</span>${c.sub?`<span class="muted" style="font-size:0.7059rem">${c.sub}</span>`:""}${c.subHtml||""}</span>
      ${c.nofi?`<span class="pill" style="color:var(--muted);background:var(--field);border-color:var(--fieldb);align-self:center;font-size:0.6471rem">not counted</span>`:""}
      <span class="num" style="font-size:1rem">${fmt(c.show!=null?c.show:c.v)}</span></div>`).join("")}</div>
  </section>
  ${homeTrack(b)}
  <div style="display:grid;grid-template-columns:minmax(0,1fr);gap:12px">
    <button class="card glass" data-act="info" data-k="rate" style="text-align:left;flex-direction:row;align-items:center;gap:10px;padding:16px">
      <svg width="58" height="58" viewBox="0 0 60 60" aria-hidden="true" style="flex:none"><circle cx="30" cy="30" r="25" fill="none" stroke="var(--track)" stroke-width="7"/><circle cx="30" cy="30" r="25" fill="none" stroke="var(--accent)" stroke-width="7" stroke-linecap="round" stroke-dasharray="${dash} ${circ}" transform="rotate(-90 30 30)"/><text x="30" y="35" text-anchor="middle" font-size="14" font-weight="700" fill="var(--ink)">${Math.round(rate)}%</text></svg>
      <span style="flex:1;display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:0.8824rem;font-weight:600">Savings rate</span><span class="muted" style="font-size:0.7647rem">avg ${Math.round(avg)}%</span></span>
      ${l6.length?`<span style="display:flex;flex-direction:column;align-items:flex-end;gap:1px;text-align:right;flex:none;padding-left:12px;border-left:1px solid var(--line)"><span class="muted" style="font-size:0.7059rem">Avg per month</span><span style="font-size:1.1765rem;font-weight:700;letter-spacing:-.01em">${chf(l6.reduce((s,x)=>s+x.saved,0)/l6.length)}</span><span class="muted" style="font-size:0.7059rem">saved of ${fmt(l6.reduce((s,x)=>s+x.income,0)/l6.length)}</span></span>`:""}
    </button>
  </div>
  ${propRow(b)}`;
}

/* Home: compact "On track" card (same engine as Goals) */
function homeTrack(b){
  if(!S.birthYear)return `<section class="card glass" data-act="info" data-k="ontrack" role="button" tabindex="0" aria-label="Set up on-track check" style="gap:6px"><div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:1rem;font-weight:600">On track?</span><span class="pill" style="color:var(--accent);background:var(--field);border-color:var(--fieldb)">Set up</span></div><span class="muted" style="font-size:0.8824rem;line-height:1.4">Add your birth year and goal age to see if you reach your financial goal in time.</span></section>`;
  const o=onTrack(),end=o.cases.mid.end,goal=S.fi,good=o.status!=="behind",col=good?"var(--goodline)":"var(--accent)";
  const total=Math.max(goal,end),now=Math.min(b.fi/total*100,100),at=Math.min(end/total*100,100),tick=goal/total*100;
  const pct=v=>Math.round(v/goal*100)+"%";
  const reachAge=o.reachK!=null?Math.floor(o.reachK/12)-o.by:null,early=reachAge!=null?S.fiAge-reachAge:0;
  const st={on:["good","On track"],ahead:["good","Ahead"],behind:["warn","Behind"]}[o.status];
  const foot=good?(early>=1?`You'd reach your goal <b>${early} year${early===1?"":"s"} early</b> at ${fmtPct(o.ot.mid)}.`:`Right on schedule at ${fmtPct(o.ot.mid)}.`)
    :`<b>+${chf(o.extra)}/month</b> into stocks closes the gap${reachAge!=null?` · otherwise goal reached at <b>${reachAge}</b>`:""}`;
  return `<section class="card glass" data-act="info" data-k="ontrack" role="button" tabindex="0" aria-label="On track details" style="gap:10px">
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px"><span style="font-size:1rem;font-weight:600">On track by age ${S.fiAge}?</span><span class="pill ${st[0]}">${st[1]}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px;flex-wrap:wrap"><span style="font-size:1.7647rem;font-weight:700;letter-spacing:-.02em">${chf(Math.round(end/1000)*1000)}</span><span class="muted" style="font-size:0.7647rem">at ${S.fiAge} · goal ${kfmt(goal)}</span></div>
    <div style="position:relative;height:10px;border-radius:5px;background:var(--track)" aria-hidden="true">
      <span style="position:absolute;left:0;top:0;bottom:0;width:${at}%;border-radius:5px;background:${col};opacity:.32"></span>
      <span style="position:absolute;left:0;top:0;bottom:0;width:${Math.max(now,1.5)}%;border-radius:5px;background:${col}"></span>
      <span style="position:absolute;top:-4px;bottom:-4px;width:2px;border-radius:1px;background:var(--ink);left:calc(${tick}% - 1px)"></span></div>
    <div style="display:flex;justify-content:space-between;gap:8px;font-size:0.7059rem" class="muted"><span>Today ${pct(b.fi)}</span>${good?`<span>${reachAge!=null?"Goal reached at "+reachAge:""}</span>`:`<span>At ${S.fiAge}: ${pct(end)}</span><span>Goal</span>`}</div>
    <div style="font-size:0.8235rem;line-height:1.4;border-top:1px solid var(--line);padding-top:10px">${foot}</div>
  </section>`;
}
function checkin(){
  const r=cur(),d=dueMonth();
  if(!d&&!r){const k=S.createdYm!=null?S.createdYm:ym(S.today.y,S.today.m),fy=Math.floor(k/12),fm=k%12+1;
    return `<div><div class="eyebrow">Monthly check-in</div><h1>${MONTHS[fm-1]} ${fy}</h1></div>
    <section class="card glass"><span style="font-size:1rem;line-height:1.4">Your first check-in is for ${MONTHS[fm-1]}. Safe reminds you on your check-in day.</span>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:0.8824rem">Due</span><span style="font-size:1rem;font-weight:600">${ciLabel(fy,fm)}</span></div></section>`;}
  if(!d){
    const reached=r.goal&&r.saved>=r.goal;
    return `<div><div class="eyebrow">Monthly check-in</div><h1>${MONTHS[r.m-1]} ${r.y}</h1></div>
    <section class="card glass" data-act="info" data-k="goalm" role="button" tabindex="0" aria-label="Monthly goal details"><div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">${MONTHS[r.m-1]} is logged</span><span class="pill ${reached?"good":"warn"}">${fmt(r.saved)} of ${fmt(r.goal||0)} goal</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">Goal for ${MONTHS[r.m%12]}</span><span style="font-size:1.2941rem;font-weight:700">${S.nextGoal?chf(S.nextGoal):"not set"}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted">Next check-in</span><span class="num">${ciShort(Math.floor((ym(r.y,r.m)+1)/12),(ym(r.y,r.m)+1)%12+1)}</span></div></section>
    <button class="btn" data-act="edit" data-i="${L()}" style="margin-top:60px">Edit ${MONTHS[r.m-1]} check-in</button>`;
  }
  const m=d.m,dn=MONTHS[m-1];
  const lastRow=r?`<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:12px"><span class="muted" style="font-size:0.8824rem">Last check-in (${MONTHS[r.m-1]})</span><span class="pill ${r.goal&&r.saved>=r.goal?"good":"warn"}" style="align-self:center">${r.goal?`${fmt(r.saved)} of ${fmt(r.goal)} goal`:`${fmt(r.saved)} saved`}</span></div>`
    :`<div style="display:flex;justify-content:space-between;align-items:center;border-top:1px solid var(--line);padding-top:12px"><span class="muted" style="font-size:0.8824rem">Last check-in</span><span class="muted" style="font-size:0.8824rem">none yet</span></div>`;
  if(isBehind()){
    return `<div><div class="eyebrow">Monthly check-in · late</div><h1>${dn} ${d.y}</h1></div>
    <section class="card glass" data-act="info" data-k="late" role="button" tabindex="0" aria-label="Why ${dn} comes first">
      <span class="pill warn">Not logged yet</span>
      <span style="font-size:1rem;line-height:1.4">You missed the ${dn} check-in. Log it now with your numbers from the end of ${dn}, then ${MONTHS[refK()%12]} is next.</span>
      <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:0.8824rem">Goal for ${dn}</span><span style="font-size:1.2941rem;font-weight:700">${S.nextGoal?chf(S.nextGoal):"not set"}</span></div>
      ${lastRow}
    </section>
    <button class="btn" data-act="sheet" style="margin-top:80px">${IC.plus}<span>Check in ${dn}</span></button>`;
  }
  return `<div><div class="eyebrow">Monthly check-in</div><h1>${dn} ${d.y}</h1></div>
  <section class="card glass" data-act="info" data-k="goalm" role="button" tabindex="0" aria-label="Monthly goal details">
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:0.8824rem">Goal for ${dn}</span><span style="font-size:1.2941rem;font-weight:700">${S.nextGoal?chf(S.nextGoal):"not set"}</span></div>
    <div style="display:flex;justify-content:space-between;align-items:baseline"><span class="muted" style="font-size:0.8824rem">Due</span><span style="font-size:1rem;font-weight:600">${ciLabel(d.y,m)}</span></div>
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
function splitOf(idx){const s={stocks:0,property:0,holiday:0,cash:0,saved:0,gain:0,pots:{}};idx.forEach(i=>{const r=S.months[i],pv=i>0?S.months[i-1].stockValue:0;s.stocks+=r.stocks;s.property+=r.property;s.holiday+=r.holiday;s.cash+=r.cash;s.saved+=r.saved;s.gain+=r.stockValue-pv-r.stocks-(S.oneoffs||[]).filter(o=>o.to==="stocks"&&ym(o.y,o.m)===ym(r.y,r.m)).reduce((x,o)=>x+o.amount,0);for(const id in (r.pots||{}))s.pots[id]=(s.pots[id]||0)+r.pots[id];});return s;}
function history(){
  const mode=S.hmode,ps=periods(mode);
  if(!ps.length)return `<h1>History</h1>
  <section class="card glass"><span class="muted" style="font-size:0.8824rem">Saved so far</span><span class="big" style="font-size:2.3529rem">${CUR()} 0</span>
  <span class="muted" style="font-size:0.8824rem;line-height:1.4">No months yet. Your check-ins and past months show up here.</span></section>
  <div class="list glass"><button data-act="setup" style="border:0;background:transparent;text-align:left;min-height:48px;padding:0 16px;font-size:1rem;font-weight:600;color:var(--accent)">+ Add or edit historical data</button></div>`;
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
  /* one dot per period (window of max 9 when there are many), current period = filled dot */
  const DW=9,d0=ps.length<=DW?0:Math.min(Math.max(pi-Math.floor(DW/2),0),ps.length-DW);
  const dots=ps.slice(d0,d0+DW).map(q=>{const on=q.k===p.k;return `<button class="dotbtn" data-act="hjump" data-k="${q.k}" aria-label="Show ${plabel(q.k,mode,false)}" ${on?'aria-current="true"':""}><span style="display:block;width:7px;height:7px;border-radius:50%;background:${on?"var(--ink)":"var(--track)"};transform:scale(${on?1.15:1});transition:background .2s,transform .2s"></span></button>`;}).join("");
  const listTitle=mode==="month"?`${plabel(p.k,mode,false)} · tap to edit`:`Months in ${plabel(p.k,mode,false)} · tap to edit`;
  let listHtml=`<div class="section">${listTitle}</div>
    <div class="list glass">${p.idx.slice().reverse().map(i=>{const r=S.months[i];const ok=r.goal&&r.saved>=r.goal;const w=r.goal?Math.min(r.saved/r.goal*100,100):0;
      return `<button data-act="edit" data-i="${i}" style="border:0;background:transparent;text-align:left;display:flex;flex-direction:column;gap:6px;padding:12px 16px;border-bottom:1px solid var(--line);color:var(--ink)">
      <span style="display:flex;align-items:baseline;gap:8px;font-size:1rem;width:100%"><span style="flex:1">${MONTHS[r.m-1]} ${r.y}${r.est?' <span class="muted" style="font-size:0.7059rem">avg</span>':""}</span><span class="num">${fmt(r.saved)}</span><span style="font-size:0.7647rem;${ok?"color:var(--good);font-weight:600":r.goal?"color:var(--warn);font-weight:600":"color:var(--muted)"}">${r.goal?"/ "+fmt(r.goal)+(ok?" ✓":""):"no goal"}</span><span style="color:var(--soft)">›</span></span>
      ${r.goal?`<span style="height:5px;border-radius:3px;background:var(--track);overflow:hidden;width:100%"><span style="display:block;height:5px;width:${w}%;background:${ok?"var(--goodline)":"var(--prop)"}"></span></span>`:""}</button>`;}).join("")}
    <button data-act="setup" style="border:0;background:transparent;text-align:left;min-height:48px;padding:0 16px;font-size:1rem;font-weight:600;color:var(--accent)">+ Add or edit historical data</button></div>`;
  const sp=splitOf(p.idx);
  const parts=[["Stocks",sp.stocks,"var(--stocks)"],["Property savings",sp.property,"var(--prop)"],["Holiday budget",sp.holiday,"var(--hol)"]].concat(S.pots.map(pt=>[esc(pt.name),sp.pots[pt.id]||0,pt.color]),[["Cash",sp.cash,"var(--cash)"]]);
  const splitHtml=`<section class="card glass" ${mode==="month"?`data-act="edit" data-i="${p.idx[0]}" aria-label="Edit where the money went in ${plabel(p.k,mode,false)}"`:`data-act="info" data-k="split" aria-label="Where the money went, details"`} role="button" tabindex="0">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-size:1rem;font-weight:600">Where the money went</span>${mode==="month"?'<span style="font-size:0.8824rem;font-weight:600;color:var(--accent)">Edit</span>':`<span class="muted" style="font-size:0.7647rem">sum of ${p.idx.length} months</span>`}</div>
    <div class="split" aria-hidden="true">${parts.filter(c=>c[1]>0).map(c=>`<span style="flex:${c[1]};background:${c[2]}"></span>`).join("")}</div>
    <div style="display:flex;flex-direction:column;gap:10px">${parts.map(c=>`<div style="display:flex;align-items:center;gap:12px"><span class="dot" style="background:${c[2]}"></span><span style="flex:1">${c[0]}</span><span class="muted" style="font-size:0.7647rem;width:40px;text-align:right">${sp.saved?Math.round(c[1]/sp.saved*100):0}%</span><span class="num" style="width:64px;text-align:right">${fmt(c[1])}</span></div>`).join("")}</div>
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px;font-size:0.8824rem"><span class="muted">Market gain on stocks</span><span class="num" style="color:${sp.gain>=0?"var(--good)":"var(--bad)"}">${sp.gain>=0?"+":"−"}${fmt(Math.abs(sp.gain))}</span></div>
  </section>`;
  const chartHtml=`  <section class="card glass">
    <div style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span style="font-size:1rem;font-weight:600">Saved per ${name}</span>${goal?`<span class="muted" style="font-size:0.7059rem">dashed line = goal ${fmt(goal)}</span>`:""}</div>
    <div class="chart">${goalLine}${bars}</div>
    <div class="xl">${slice.map(q=>`<span style="${q.k===p.k?"font-weight:700;color:var(--ink)":""}">${plabel(q.k,mode,true)}</span>`).join("")}</div>
    ${slice.some(q=>q.idx.some(i=>S.months[i].est))?`<div class="muted" style="font-size:0.7059rem">Periods in 2025 use the monthly average of the 2025 yearly total.</div>`:""}
  </section>`;
  return `
  <div class="head" style="align-items:center"><h1>History</h1>
  <button class="btn small" data-act="hmenu" aria-haspopup="menu">${mode[0].toUpperCase()+mode.slice(1)}${IC.chev}</button></div><!--tip-->
  <div style="display:flex;flex-direction:column;gap:8px">
    <div style="display:flex;align-items:center;justify-content:space-between">
      <button class="btn round" data-act="hprev" aria-label="Previous ${name}" ${pi===0?"disabled":""}>‹</button>
      <span style="display:flex;flex-direction:column;align-items:center;text-align:center"><span style="font-size:1.1765rem;font-weight:700">${plabel(p.k,mode,false)}</span><span class="muted" style="font-size:0.7647rem">${psub(p,mode)||"&nbsp;"}</span></span>
      <button class="btn round" data-act="hnext" aria-label="Next ${name}" ${pi===ps.length-1?"disabled":""}>›</button>
    </div>
    <div style="display:flex;justify-content:center;gap:2px;margin-top:-6px">${dots}</div>
  </div>
  <section class="card glass" ${mode==="month"?`data-act="edit" data-i="${p.idx[0]}" aria-label="Edit ${plabel(p.k,mode,false)}"`:`data-act="info" data-k="hsum" aria-label="How this is calculated"`} role="button" tabindex="0">
    <span style="display:flex;justify-content:space-between;align-items:baseline;gap:8px"><span class="muted" style="font-size:0.8824rem">${goal?"Saved vs goal":"Saved"} in ${plabel(p.k,mode,false)}</span>${mode==="month"?'<span style="font-size:0.8824rem;font-weight:600;color:var(--accent)">Edit</span>':""}</span>
    <div style="display:flex;align-items:baseline;gap:8px;flex-wrap:wrap"><span class="big" style="font-size:2.3529rem">${chf(saved)}</span><span class="muted" style="font-size:0.8824rem">${goal?"of "+chf(goal)+" goal":est?"yearly average, no goal set":"no goal set"}</span></div>
    ${goal?`<div style="display:flex;align-items:center;gap:10px"><span class="track"><span style="width:${Math.min(pct,100)}%;${pct>=100?"background:var(--goodline)":""}"></span></span><span style="font-size:0.8824rem;font-weight:700">${Math.round(pct)}%</span></div>
    <div style="display:flex;justify-content:space-between;align-items:center;gap:8px;flex-wrap:wrap"><span class="pill ${pct>=100?"good":"warn"}" style="align-self:center">${pct>=100?"Goal reached · +"+fmt(saved-goal):CUR()+" "+fmt(goal-saved)+" short"}</span><span class="muted" style="font-size:0.7647rem">${mode==="month"?"":`Goal reached in ${hit} of ${withGoal.length} months`}</span></div>`:""}
    <div style="display:flex;justify-content:space-between;border-top:1px solid var(--line);padding-top:10px;font-size:0.7647rem" class="muted"><span>Savings rate <b style="color:var(--ink)">${Math.round(saved/inc*100)}%</b></span><span>${prev!==null?`vs ${prevName} <b style="color:${saved>=prev?"var(--good)":"var(--bad)"}">${saved>=prev?"▲":"▼"} ${chf(Math.abs(saved-prev))}</b>`:""}</span></div>
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
  ${onTrackCard()}
  ${propCard(b)}
  <div style="display:flex;justify-content:space-between;align-items:center;margin-top:4px"><div class="section" style="margin:0">Savings goals</div><button class="link" data-act="addgoal" style="font-size:1rem">+ Add</button></div>
  <div class="list glass">
    ${gl.map(g=>{const pc=g.t>0?Math.min(Math.max(g.v,0)/g.t*100,100):0;return `
    <div class="grow" data-act="info" data-k="${g.k}" ${g.a?`data-a="${g.a}"`:""} role="button" tabindex="0" aria-label="${g.n} details">
      <div style="display:flex;justify-content:space-between;align-items:flex-start;gap:8px"><span style="display:flex;flex-direction:column;gap:2px;min-width:0"><span style="font-size:1rem">${g.n}</span>${pc>=100||g.nofi?`<span style="display:flex;gap:8px;font-size:0.7647rem">${pc>=100?'<span style="color:var(--good);font-weight:600">✓ reached</span>':""}${g.nofi?'<span class="muted">not counted</span>':""}</span>`:""}</span><span class="muted num" style="font-size:0.8824rem;white-space:nowrap;padding-top:2px">${fmt(Math.max(g.v,0))} / ${fmt(g.t)}</span></div>
      <span style="height:7px;border-radius:4px;background:var(--track);overflow:hidden"><span style="display:block;height:7px;width:${pc}%;background:${g.c}"></span></span></div>`;}).join("")}
  </div>
  ${S.pots.length?"":`<p class="note">Saving for something else, like a car or a wedding? Add it as its own goal and give it a line in every check-in.</p>`}`;
}

function daySelect(id){
  const opts=[...Array(28)].map((_,i)=>i+1).concat([0]).map(d=>`<option value="${d}"${ciDayN()===d?" selected":""}>${d===0?"Last day":ordinal(d)}</option>`).join("");
  return `<label class="row" for="${id}" style="border-bottom:1px solid var(--line)"><span style="flex:1">Check-in day</span><select id="${id}" class="dayselect" data-ciday="1" aria-label="Check-in day">${opts}</select></label>`;
}
function settings(){
  const fld=(id,label,val,suffix)=>`<label class="row" for="${id}"><span style="flex:1">${label}</span><input class="val" id="${id}" inputmode="decimal" value="${val}" data-set="${id}" aria-label="${label}">${suffix?`<span class="muted">${suffix}</span>`:""}</label>`;
  const rb=(act,label,color,last)=>`<button class="row" data-act="${act}" style="border:0;${last?"":"border-bottom:1px solid var(--line);"}background:transparent;color:${color||"var(--accent)"};font-weight:600;text-align:left">${label}</button>`;
  return `<h1>Settings</h1>
  <div class="section">Check-in</div>
  <div class="list glass">
    ${daySelect("s-ciday")}
    <div class="row" data-act="switch"><span id="rem-l" style="flex:1">Reminder · 19:00</span><button class="switch" role="switch" aria-checked="${S.reminder}" aria-labelledby="rem-l" data-act="switch"></button></div>
  </div>
  <p class="note">Days 1–14 count for the previous month: on the 1st of November you log October. Later days count for the same month. From your check-in day, Safe reminds you when you open it. If a month was missed, Safe asks for that month first.</p>
  <div class="section">Backup</div>
  <div class="list glass">${rb("backup","Download backup")}${rb("restore","Restore from backup file","",1)}</div>
  <p class="note">The backup is a file saved in your Files app; you choose where, e.g. On My iPhone or iCloud Drive. Last backup: ${backupLabel()}. If it gets older than 2 months, Safe reminds you after a check-in and on Home. Restoring replaces the data on this iPhone.</p>
  <div class="section">General</div>
  <div class="list glass"><div class="row" data-act="demo"><span id="demo-l" style="flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 0"><span>Demo mode</span><span class="muted" style="font-size:0.7647rem">Hides your numbers and shows a made-up person</span></span><button class="switch" role="switch" aria-checked="${!!S.demo}" aria-labelledby="demo-l" data-act="demo"></button></div></div>
  <p class="note">Use it to show Safe to someone. Your data stays untouched; anything changed in Demo mode is discarded when you switch it off.</p>
  <div class="list glass"><button class="row" data-act="curmenu" aria-haspopup="menu" style="border:0;background:transparent;text-align:left;width:100%;color:var(--ink)"><span style="flex:1">Currency</span><span style="color:var(--accent);font-weight:600;display:flex;align-items:center;gap:4px">${CUR()}${IC.chev}</span></button></div>
  <div class="list glass">${rb("wipe","Delete all data","var(--bad)",1)}</div>
  <p class="note">Removes every month, goal and balance from this iPhone. Backup files you downloaded stay.</p>
  <div class="section">About</div>
  <div class="list glass"><button class="row" data-act="guide" style="border:0;border-bottom:1px solid var(--line);background:transparent;text-align:left;width:100%"><span style="flex:1">How Safe works</span><span class="muted" aria-hidden="true">›</span></button><button class="row" data-act="info" data-k="about" style="border:0;background:transparent;text-align:left;width:100%"><span style="flex:1">Safe</span><span class="muted">Version ${VERSION}</span></button></div>
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
function openInfo(k,a,replace){
  if(k==="asset"){openAssetSheet(a);return;}
  if(k==="oneoff"){openOneoffSheet(a);return;}
  lastInfo={k,a};
  const i=L(),b=bal(i),p=bal(i-1),r=cur()||blank(),prevVal=i>0?S.months[i-1].stockValue:(S.start.stockValue||0),mGain=r.stockValue-prevVal-r.stocks-(S.oneoffs||[]).filter(o=>o.to==="stocks"&&ym(o.y,o.m)===ym(r.y,r.m)).reduce((s,o)=>s+o.amount,0);
  let title="",body="",action="";
  const kv=rows=>`<div class="field">${rows.map(x=>`<div class="kv"><span class="muted">${x[0]}</span><b style="${x[2]||""}">${x[1]}</b></div>`).join("")}</div>`;
  const sign=v=>(v>=0?"+":"−")+fmt(Math.abs(v));
  const col=v=>v>=0?"color:var(--good)":"color:var(--bad)";
  if(k==="nw"){
    const h=last6(j=>bal(j).nw);
    title="Net worth";
    body=`<span class="big">${chf(b.nw)}</span>
    ${kv([["Saved in "+MONTHS[r.m-1],sign(r.saved),col(r.saved)],["Market gain on stocks",sign(mGain),col(mGain)],["Change this month",sign(b.nw-p.nw),col(b.nw-p.nw)]])}
    
    ${oneoffList()}
    <p class="explain">Net worth adds up cash, the current value of your stocks, property savings, the holiday budget, your goals and owned property (value minus mortgage). Financial goal progress leaves out the holiday budget, goals you plan to spend and property you didn’t switch on.</p>`;
    action=`<button class="btn" data-act="addoneoff">One-off amount</button><button class="link" data-act="addasset" style="font-size:1rem;min-height:48px">Add owned property</button>`;
  }else if(k==="cat"){
    const C={cash:["Cash savings","--cash",b.cash,r.cash,j=>bal(j).cash],stocks:["Stocks","--stocks",b.value,r.stockValue-prevVal,j=>bal(j).value],property:["Property savings","--prop",b.property,r.property,j=>bal(j).property],holiday:["Holiday budget","--hol",b.holiday,r.holiday,j=>bal(j).holiday]}[a];
    const h=last6(C[4]);
    title=C[0];
    let extra="",text="";
    if(a==="cash"){extra=kv([["Added in "+MONTHS[r.m-1],sign(r.cash),col(r.cash)],["Emergency fund target",chf(S.emergency)],["Still to go",chf(Math.max(S.emergency-b.cash,0))]]);text="Cash gets whatever you don't assign to stocks, property or holiday in the check-in. It also counts toward your emergency fund.";}
    if(a==="stocks"){extra=kv([["Paid in (all time)",chf(b.paid)],["Market gains (all time)",sign(b.gain),col(b.gain)],["Paid in, "+MONTHS[r.m-1],"+"+fmt(r.stocks)],["Market gain, "+MONTHS[r.m-1],sign(mGain),col(mGain)]]);text="Paid in is the money you moved into stocks yourself. Market gains are the portfolio value minus everything you paid in, so you can see what came from you and what came from the market.";}
    if(a==="property"){extra=kv([["Added in "+MONTHS[r.m-1],"+"+fmt(r.property)],["Equity share",S.equity+"%"],["Can buy up to",chf(propCalc(b).max)]]);text=`This is your equity for a first property. At ${S.equity}% equity, every ${CUR()} 1 saved lets you buy ${CUR()} ${fmt(100/S.equity)} of property.`;action=`<button class="btn" data-act="info" data-k="prop">How the property calculation works</button>`;}
    if(a==="holiday"){const per=avgOf("holiday",6);extra=kv([["Added in "+MONTHS[r.m-1],"+"+fmt(r.holiday)],["Target",chf(S.holidayTarget)],["Still to go",chf(Math.max(S.holidayTarget-b.holiday,0))],["Reached in",monthsTo(S.holidayTarget-b.holiday,per)]]);text="Not in the financial goal: the holiday budget counts in your net worth, but not in financial goal progress, because it's money you plan to spend. Change the target in Settings.";}
    body=`<span class="big">${chf(C[2])}</span><span class="pill ${C[3]>=0?"good":"warn"}">${C[3]>=0?"▲":"▼"} ${chf(Math.abs(C[3]))} this month</span>
    ${extra}<p class="explain">${text}</p>`;
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
    const base=b.fi,c=avgSave(12),yr=projYear(base,true);
    title="Financial goal";
    body=`<span class="big">${(base/S.fi*100).toFixed(1)}%</span>
    ${kv([["Counted for financial goal",chf(base)],["Goal",chf(S.fi)],["Still to go",chf(Math.max(S.fi-base,0))],["Avg saved / month, excl. holiday",chf(c)],["Return on stocks (middle case)",fmtPct(midRet())+" per year"],["Projected to reach goal","≈ "+yr]])}
    <p class="explain">Same calculation as “On track”: your stocks grow at the middle-case return, cash and property savings are added without return, plus your average monthly saving, until you reach your goal. It's a rough guide, not a forecast: markets and your savings will vary.</p>`;
    action=`<button class="btn" data-act="info" data-k="ontrack">Change goal or returns</button>`;
  }else if(k==="prop"){
    title="First property";
    const f=(id,label,val,suf,hint)=>`<label class="row" for="pp-${id}"><span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:${hint?"8px 0":"0"}"><span>${label}</span>${hint?`<span class="muted" style="font-size:0.7059rem">${hint}</span>`:""}</span><input class="val" id="pp-${id}" data-pp="${id}" inputmode="decimal" value="${val}" placeholder="${id==="income"?fmt(propCalc(b).incAuto):""}" style="width:96px">${suf?`<span class="muted" style="font-size:0.8824rem">${suf}</span>`:""}</label>`;
    const pp=Object.assign({},PPDEF,S.pp||{});
    body=`<div id="pp-res"></div>
    <div class="section" style="padding-left:4px">Your numbers</div>
    <div class="field">${f("eq","Down payment (equity)",S.equity,"%")}${f("reserve","Safety reserve",fmt(S.reserve||0),CUR(),"Kept aside, not used for the purchase")}${f("income","Income per year",pp.income>0?fmt(pp.income):"",CUR(),"Empty = from your check-ins · banks use gross")}</div>
    <div class="section" style="padding-left:4px">Bank assumptions</div>
    <div class="field">${f("rate","Interest rate used",pp.rate,"%","Banks calculate with about 5%")}${f("upkeep","Upkeep per year",pp.upkeep,"%","Of the price")}${f("amortTo","Pay mortgage down to",pp.amortTo,"%","Of the price, usually two thirds")}${f("amortYears","Within",pp.amortYears,"years")}${f("share","Max. share of income",pp.share,"%","Usually one third")}</div>
    <p class="explain">Changes apply right away. Property savings come from your check-ins. Notary and land registry costs are not included.</p>`;
    action=`<button class="btn" data-act="propreset">Reset to bank standard</button>`;
  }else if(k==="ontrack"){
    title="On track";
    const ot=Object.assign({best:8,mid:5,worst:2},S.ot||{});
    const f=(id,label,val,suf,hint)=>`<label class="row" for="ot-${id}"><span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:${hint?"8px 0":"0"}"><span>${label}</span>${hint?`<span class="muted" style="font-size:0.7059rem">${hint}</span>`:""}</span><input class="val" id="ot-${id}" data-ot="${id}" inputmode="decimal" value="${val}" style="width:90px">${suf?`<span class="muted" style="font-size:0.8824rem">${suf}</span>`:""}</label>`;
    body=`<div id="ot-res"></div>
    <div class="section" style="padding-left:4px">Your target</div>
    <div class="field">${f("birthYear","Birth year",S.birthYear||"","","Used only to calculate your age")}${f("fiAge","Goal age",S.fiAge,"")}${f("chartAge","Show chart until age",S.chartAge||62,"")}${f("fi","Financial goal",fmt(S.fi),CUR())}</div>
    ${(()=>{const to=S.sinceTo!=null?S.sinceTo:(S.months.length?ym(S.months[0].y,S.months[0].m):(S.createdYm!=null?S.createdYm:ym(S.today.y,S.today.m)));
      const sk=S.since!=null?S.since:null,sy=sk!=null?kYM(sk):{y:0,m:0},ys=[];for(let y=kYM(to-1).y;y>=S.today.y-40;y--)ys.push(y);const e=sinceEst();
      return `<div class="section" style="padding-left:4px">Saving since</div><div class="field"><div class="row" style="min-height:58px;gap:8px"><select class="sel" id="ot-sm" aria-label="Saving since, month"><option value="0">Month</option>${MONTHS.map((n,i)=>`<option value="${i+1}"${sy.m===i+1?" selected":""}>${n}</option>`).join("")}</select><select class="sel" id="ot-sy" aria-label="Saving since, year"><option value="0">Year</option>${ys.map(y=>`<option value="${y}"${sy.y===y?" selected":""}>${y}</option>`).join("")}</select></div>
      ${e?`<div class="row" style="min-height:50px"><span class="muted" style="flex:1;font-size:0.8824rem">Estimated average</span><b>${chf(e.fi)}/month</b></div>`:""}</div>
      <p class="explain" style="font-size:0.7647rem">When you started building the savings you had at setup. Safe divides them by the months since then and uses that average until you have 12 check-ins.</p>`;})()}
    <div class="section" style="padding-left:4px">Average return per year</div>
    <div class="field">${f("best","Best case",ot.best,"%")}${f("mid","Middle case",ot.mid,"%")}${f("worst","Worst case",ot.worst,"%")}</div>
    <p class="explain">Safe takes your current stock value and lets it grow at each return, adding the average you put into stocks per month. Cash, property savings and other money for your goal are added without return. The average comes from your last 12 check-ins (missing months use your “Saving since” estimate) and updates every month. Markets go up and down; the three lines show a range, not a promise.</p>`;
  }else if(k==="hol"){
    const per=avgOf("holiday",6);
    title="Holiday budget";
    body=`<span class="big">${chf(b.holiday)}</span><span class="muted">of ${chf(S.holidayTarget)} target</span>
    ${kv([["Still to go",chf(Math.max(S.holidayTarget-b.holiday,0))],["Avg added / month (6 mo.)",chf(per)],["Target reached in",monthsTo(S.holidayTarget-b.holiday,per)]])}
    <div class="field"><label class="row" for="t-s-hol"><span style="flex:1;font-weight:600">Target</span><input class="val" id="t-s-hol" data-set="s-hol" inputmode="decimal" value="${fmt(S.holidayTarget)}" style="width:110px"><span class="muted" style="font-size:0.8824rem">${CUR()}</span></label></div>
    <p class="explain">Not in the financial goal: this money counts in your net worth but not in financial goal progress, because you plan to spend it. Tap the target to change it.</p>`;
  }else if(k==="emer"){
    const per=avgOf("cash",6);
    title="Emergency fund";
    body=`<span class="big">${chf(Math.min(b.cash,S.emergency))}</span><span class="muted">of ${chf(S.emergency)} target · held as cash</span>
    ${kv([["Cash now",chf(b.cash)],["Still to go",chf(Math.max(S.emergency-b.cash,0))],["Avg cash added / month (6 mo.)",chf(per)],["Target reached in",monthsTo(S.emergency-b.cash,per)]])}
    <div class="field"><label class="row" for="t-s-emer"><span style="flex:1;font-weight:600">Target</span><input class="val" id="t-s-emer" data-set="s-emer" inputmode="decimal" value="${fmt(S.emergency)}" style="width:110px"><span class="muted" style="font-size:0.8824rem">${CUR()}</span></label></div>
    <p class="explain">${r.income?`The target is about ${(S.emergency/r.income).toFixed(1)} months of income. `:""}It's filled by the cash part of each check-in. Tap the target to change it.</p>`;
  }else if(k==="pot"){
    const pt=S.pots.find(x=>x.id===a);if(!pt)return;
    const v=b.pots[pt.id]||0,h=last6(j=>bal(j).pots[pt.id]||0),xs=S.months.slice(-6),per=xs.length?xs.reduce((s,x)=>s+((x.pots||{})[pt.id]||0),0)/xs.length:0;
    title=esc(pt.name);
    body=`<span class="big">${chf(v)}</span><span class="muted">of ${chf(pt.target)} target</span>
    
    ${kv([["Still to go",chf(Math.max(pt.target-v,0))],["Avg added / month (6 mo.)",chf(per)],["Target reached in",monthsTo(pt.target-v,per)],["Counts toward financial goal",pt.fi?"Yes":"No"]])}
    <p class="explain">${pt.fi?"This goal counts toward your financial goal because the money stays yours long term.":"Not in the financial goal: it counts in your net worth, but not in financial goal progress, because you plan to spend it."} You put money in it with its own line in the check-in; that amount comes out of cash.</p>`;
    action=`<button class="btn" data-act="goaledit" data-a="${pt.id}">Edit goal</button><button class="link" data-act="delpot" data-a="${pt.id}" style="color:var(--bad);font-size:1rem;min-height:48px">Delete goal</button>`;
  }else if(k==="late"){
    const dm=dueMonth(),n=refK()-ym(dm.y,dm.m)+1;
    title="Late check-in";
    body=`${kv([["Open months",n+" ("+MS[dm.m-1]+" – "+MS[refK()%12]+")"],["Next to log",MONTHS[dm.m-1]+" "+dm.y],["Goal for "+MONTHS[dm.m-1],chf(S.nextGoal)]])}
    <p class="explain">Safe always asks for the oldest missing month first, so your history has no gaps. Enter what you saved in ${MONTHS[dm.m-1]} and your portfolio value at the end of ${MONTHS[dm.m-1]}. A close estimate is fine. Right after saving, the next open month is offered.</p>`;
  }else if(k==="rate"){
    const xs=S.months.slice(-6),inc=xs.reduce((s,x)=>s+x.income,0),sv=xs.reduce((s,x)=>s+x.saved,0),all=S.months,ai=all.reduce((s,x)=>s+x.income,0),as=all.reduce((s,x)=>s+x.saved,0);
    title="Savings rate";
    body=`<div class="section" style="padding-left:4px">${MONTHS[r.m-1]} ${r.y}</div>${kv([["Saved",chf(r.saved)],["Income",chf(r.income)],["Savings rate",r.income?Math.round(r.saved/r.income*100)+"%":"–"]])}
    <div class="section" style="padding-left:4px">Last ${xs.length} months</div>${kv([["Avg saved / month",chf(xs.length?sv/xs.length:0)],["Avg income / month",chf(xs.length?inc/xs.length:0)],["Savings rate",inc?Math.round(sv/inc*100)+"%":"–"]])}
    ${all.length>xs.length?`<div class="section" style="padding-left:4px">Since you started</div>${kv([["Months",String(all.length)],["Saved in total",chf(as)],["Savings rate",ai?Math.round(as/ai*100)+"%":"–"]])}`:""}
    <p class="explain">Savings rate is what you saved divided by your income in the same months. History shows it for every quarter and year.</p>`;
  }else if(k==="cur"){
    title="Currency";
    body=`<p class="explain">Choose CHF, EUR or USD in Settings. Only the label changes: your amounts are not converted.</p>`;
  }else if(k==="start"){
    title="Start tracking from";
    body=`<p class="explain">Pick the first month you want in your history. Safe asks for your balances just before that month, then for each year either month by month or as one yearly total. Yearly totals show as a monthly average in History.</p>`;
  }else if(k==="about"){
    title="About Safe";
    const pr=document.createElement("div");pr.style.cssText="position:fixed;top:0;left:0;width:1px;padding-top:env(safe-area-inset-top,0px);padding-bottom:env(safe-area-inset-bottom,0px);visibility:hidden";document.body.appendChild(pr);const cs0=getComputedStyle(pr),cs={paddingTop:cs0.paddingTop,paddingBottom:cs0.paddingBottom},fr=document.getElementById("frame").getBoundingClientRect(),vv=window.visualViewport;pr.remove();
    body=`${kv([["Version",VERSION],["Months stored",String(S.months.length)],["Last backup",backupLabel()]])}
    <div class="section" style="padding-left:4px">Screen info (for fixing layout)</div>${kv([["Screen",screen.width+" × "+screen.height],["Window",innerWidth+" × "+innerHeight],["Visual viewport",vv?Math.round(vv.width)+" × "+Math.round(vv.height)+" @"+Math.round(vv.offsetTop):"–"],["App frame",Math.round(fr.top)+" → "+Math.round(fr.bottom)],["Safe area top / bottom",cs.paddingTop+" / "+cs.paddingBottom],["Home Screen app",isStandalone()?"yes":"no"],["Status bar style",(document.querySelector('meta[name="apple-mobile-web-app-status-bar-style"]')||{}).content||"–"],["Page height",document.documentElement.clientHeight+" / body "+document.body.clientHeight]])}<p class="explain">Safe keeps everything on this iPhone and works offline. Back up regularly: if the app is deleted, the data is gone unless you have a backup file.</p>`;
  }
  if(PAGEK.has(k)){openPage(k,a,title,body,action,replace);if(k==="prop")wireProp();if(k==="ontrack")wireOnTrack();return;}
  const html=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="in-t">
  <div class="inner"><div class="shead" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 id="in-t" style="margin:0;font-size:1.2941rem;font-weight:700">${title}</h2>${XB}</div>${body}${action}</div></div>`;
  if(layer.querySelector(".full")){layer.insertAdjacentHTML("beforeend",html);}else{layer.innerHTML=html;sheetDirty=false;}
  bindSwipe([...layer.querySelectorAll(".sheet")].pop());
  if(k==="prop")wireProp();
  if(k==="ontrack")wireOnTrack();
}


/* ---------- detail pages (Health style): slide in from the right, back button, chart with period switch, highlights, then all details ---------- */
const PAGEK=new Set(["nw","cat","goalm","fi","prop","ontrack","hol","emer","pot","split","hsum","about","rate"]);
const PGS={span:12};
function pageSeries(k,a){
  const pt=k==="pot"?S.pots.find(x=>x.id===a):null;
  const C={cash:["Cash savings","var(--cash)",j=>bal(j).cash],stocks:["Stocks · value","var(--stocks)",j=>bal(j).value],property:["Property savings","var(--prop)",j=>bal(j).property],holiday:["Holiday budget","var(--hol)",j=>bal(j).holiday]};
  if(k==="nw")return {t:"bal",cap:"Net worth",col:"var(--accent)",f:j=>bal(j).nw};
  if(k==="cat"&&C[a])return {t:"bal",cap:C[a][0],col:C[a][1],f:C[a][2]};
  if(k==="pot"&&pt)return {t:"bal",cap:pt.name,col:pt.color,f:j=>bal(j).pots[pt.id]||0,goal:pt.target};
  if(k==="hol")return {t:"bal",cap:"Holiday budget",col:"var(--hol)",f:j=>bal(j).holiday,goal:S.holidayTarget};
  if(k==="emer")return {t:"bal",cap:"Cash",col:"var(--cash)",f:j=>bal(j).cash,goal:S.emergency};
  if(k==="fi")return {t:"bal",cap:"Counted for financial goal",col:"var(--goodline)",f:j=>bal(j).fi};
  if(k==="goalm")return {t:"avg",cap:"Saved per month",col:"var(--accent)",f:j=>S.months[j].saved,g:j=>S.months[j].goal||0};
  if(k==="rate")return {t:"pct",cap:"Savings rate",col:"var(--accent)",f:j=>S.months[j].income?S.months[j].saved/S.months[j].income*100:0};
  return null;
}
function pageTop(se){
  if(!se||S.months.length<1)return "";
  const sp=[[6,"6M"],[12,"Y"],[36,"3Y"],[0,"All"]];
  return `<div class="pseg" role="tablist">${sp.map(x=>`<button role="tab" data-act="pspan" data-v="${x[0]}" aria-selected="${PGS.span===x[0]}">${x[1]}</button>`).join("")}</div>
  <div class="phead"></div><div class="pchart"></div><div class="phl"></div>`;
}
function drawPageChart(pg){
  const se=pageSeries(pg.dataset.k,pg.dataset.a);if(!se||!S.months.length)return;
  pg.querySelectorAll(".pseg button").forEach(b=>b.setAttribute("aria-selected",String(+b.dataset.v===PGS.span)));
  const n=S.months.length,from=PGS.span?Math.max(0,n-PGS.span):0,idx=[];for(let j=from;j<n;j++)idx.push(j);
  const v=idx.map(se.f),last=v[v.length-1],first=v[0],avg=v.reduce((a,b)=>a+b,0)/v.length,rm=j=>S.months[j],mlab=j=>`${MS[rm(j).m-1]} ${rm(j).y}`;
  const range=idx.length>1?`${mlab(idx[0])} – ${mlab(idx[idx.length-1])}`:mlab(idx[0]);
  const money=x=>chf(Math.round(x)),pct=x=>Math.round(x)+"%";
  let cap,big,sub;
  if(se.t==="bal"){cap=`${se.cap} · ${mlab(idx[idx.length-1])}`;big=money(last);const d=last-first;sub=idx.length>1?`${d>=0?"+":"−"}${chf(Math.abs(Math.round(d)))} since ${mlab(idx[0])}`:range;}
  else{cap=`${se.cap} · average`;big=se.t==="pct"?pct(avg):money(avg);sub=range;}
  pg.querySelector(".phead").innerHTML=`<div class="pcap">${esc(cap)}</div><div class="pbig">${big}</div><div class="psub">${sub}</div>`;
  /* chart */
  const W=330,H=200,top=Math.max(...v,se.goal||0,1),step=niceStep(top/3),mx=step*Math.ceil(top/step),bw=W/v.length,lab=se.t==="pct"?(x=>Math.round(x)+"%"):(x=>x>=1e6?kfmt(x):x>=1000?(x/1000).toFixed(x%1000?1:0)+"k":String(Math.round(x)));
  let g="";for(let y=0;y<=mx+1e-9;y+=step){const yy=H-H*y/mx;g+=`<line x1="0" x2="${W}" y1="${yy}" y2="${yy}" stroke="var(--line)"/><text x="${W+6}" y="${yy+4}" font-size="11" fill="var(--soft)">${lab(y)}</text>`;}
  const every=v.length<=12?1:v.length<=36?3:12;
  v.forEach((x,i)=>{const h=Math.max(H*Math.max(x,0)/mx,x>0?2:0),bx=i*bw+bw*.16,w=Math.max(bw*.68,1.5),j=idx[i];
    const c=se.g&&se.g(j)?(x>=se.g(j)?"var(--goodline)":se.col):se.col;
    g+=`<rect x="${bx}" y="${H-h}" width="${w}" height="${h}" rx="${Math.min(3,w/2)}" fill="${c}"${i===v.length-1?"":' opacity=".85"'}/>`;
    if(i%every===0||(every===1))g+=`<text x="${bx+w/2}" y="${H+16}" font-size="11" text-anchor="middle" fill="var(--soft)">${every===1&&v.length>6?MS[rm(j).m-1][0]:every===12?rm(j).y:MS[rm(j).m-1]+(every>1?" "+String(rm(j).y).slice(2):"")}</text>`;});
  if(se.t!=="bal"&&v.length>1){const ay=H-H*avg/mx;g+=`<line x1="0" x2="${W}" y1="${ay}" y2="${ay}" stroke="var(--ink)" stroke-opacity=".55" stroke-dasharray="4 4"/>`;}
  if(se.goal){const gy=H-H*se.goal/mx;g+=`<line x1="0" x2="${W}" y1="${gy}" y2="${gy}" stroke="var(--ink)" stroke-opacity=".55" stroke-dasharray="4 4"/><text x="4" y="${gy-5}" font-size="11" fill="var(--soft)">Target ${kfmt(se.goal)}</text>`;}
  pg.querySelector(".pchart").innerHTML=`<svg viewBox="0 0 ${W+34} ${H+22}" width="100%" role="img" aria-label="${esc(se.cap)} per month">${g}</svg>`;
  /* highlights */
  const L=idx[idx.length-1],ln=MONTHS[rm(L).m-1];let hl=[];
  if(v.length>=2){
    if(se.t==="bal"){const d=last-first,per=d/(v.length-1),mxv=Math.max(...v);
      hl.push({t:`${d>=0?"Up":"Down"} ${chf(Math.abs(Math.round(d)))} in ${v.length-1} month${v.length>2?"s":""}${d>0?`, about ${chf(Math.round(per))} per month`:""}.`,a:[mlab(idx[0]),money(first)],b:[mlab(L),money(last)]});
      if(last>=mxv&&v.length>2)hl.push({t:`${ln} is the highest it has been in this period.`});
      if(se.goal&&last<se.goal&&per>0)hl.push({t:`At this pace the target is reached in about ${Math.ceil((se.goal-last)/per)} months.`});}
    else{const fm=se.t==="pct"?pct:money,more=last>=avg;
      hl.push({t:`${more?"You saved more":"You saved less"} in ${ln} than your average month${se.t==="pct"?" (as a share of income)":""}.`,a:["Average",fm(avg)],b:[ln,fm(last)]});
      if(se.g){const w=idx.filter(j=>se.g(j)),hit=w.filter(j=>S.months[j].saved>=se.g(j)).length;if(w.length)hl.push({t:`Goal reached in ${hit} of ${w.length} months.`});}
      else{const bi=v.indexOf(Math.max(...v));if(v.length>2)hl.push({t:`Best month: ${mlab(idx[bi])} with ${fm(v[bi])}.`});}}
  }
  hl=hl.slice(0,2);
  pg.querySelector(".phl").innerHTML=hl.length?`<h2 class="ph2">Highlights</h2>${hl.map(h=>`<div class="hlcard"><div class="hlk" style="color:${se.col}">${esc(se.cap)}</div><p>${h.t}</p>${h.a?`<div class="hlcmp"><div style="color:${se.col}">${h.b[0]}<b>${h.b[1]}</b></div><div>${h.a[0]}<b>${h.a[1]}</b></div></div>`:""}</div>`).join("")}`:"";
}
function niceStep(x){if(x<=0)return 1;const p=Math.pow(10,Math.floor(Math.log10(x))),f=x/p;return (f<=1?1:f<=2?2:f<=2.5?2.5:f<=5?5:10)*p;}
const BACKSVG='<svg width="11" height="18" viewBox="0 0 13 21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5L2.5 10.5 10 18.5"/></svg>';
function openPage(k,a,title,body,action,replace){
  const se=pageSeries(k,a),plus=k==="nw"?`<button class="rbtn glass" data-act="addmenu" aria-label="Add">${IC.plus}</button>`:`<span></span>`;
  const html=`<div class="dpage" role="dialog" aria-modal="true" aria-label="${esc(title)}" data-k="${k}" data-a="${a||""}">
    <div class="ptop"><button class="backbtn glass" data-act="pageback" aria-label="Back">${BACKSVG}</button><span class="ptitle">${title}</span>${plus}</div>
    <div class="pscroll">${pageTop(se)}<div class="pdetails">${se&&S.months.length?`<h2 class="ph2">Details</h2>`:""}${body}${action?`<div class="pact">${action}</div>`:""}</div></div></div>`;
  const pages=layer.querySelectorAll(".dpage"),topPg=pages[pages.length-1];
  if(replace&&topPg){const y=topPg.querySelector(".pscroll").scrollTop;topPg.insertAdjacentHTML("afterend",html);topPg.remove();const n=layer.querySelectorAll(".dpage");const pg=n[n.length-1];pg.classList.add("noanim");pg.querySelector(".pscroll").scrollTop=y;drawPageChart(pg);return;}
  [...layer.children].forEach(c=>{if(!c.classList.contains("dpage"))c.remove();});
  if(topPg)topPg.classList.add("under");
  layer.insertAdjacentHTML("beforeend",html);
  const n=layer.querySelectorAll(".dpage"),pg=n[n.length-1];drawPageChart(pg);
  const sc=pg.querySelector(".pscroll");sc.addEventListener("scroll",()=>pg.classList.toggle("scrolled",sc.scrollTop>8),{passive:true});
}
function popPage(){
  const n=layer.querySelectorAll(".dpage"),pg=n[n.length-1];if(!pg)return;
  if(n.length>1)n[n.length-2].classList.remove("under");
  pg.classList.add("leaving");setTimeout(()=>{pg.remove();if(!layer.querySelector(".dpage"))render(true);},260);
}
function refreshPage(){const n=layer.querySelectorAll(".dpage"),pg=n[n.length-1];if(!pg)return;
  if(pg.contains(document.activeElement)&&document.activeElement.matches("input,select"))return;
  if(pg.dataset.k==="pot"&&!S.pots.find(x=>x.id===pg.dataset.a)){popPage();return;}
  openInfo(pg.dataset.k,pg.dataset.a||undefined,true);}

/* ---------- render ---------- */
const scr=document.getElementById("screen"),tabs=document.getElementById("tabs"),layer=document.getElementById("layer");
/* while a detail page is open, pop-ups open on top of it instead of replacing it */
(function(){const D=Object.getOwnPropertyDescriptor(Element.prototype,"innerHTML");
  Object.defineProperty(layer,"innerHTML",{configurable:true,get(){return D.get.call(this);},set(v){
    if(v&&this.querySelector(".dpage")&&!/class="full[ "]/.test(v)){[...this.children].forEach(c=>{if(!c.classList.contains("dpage"))c.remove();});this.insertAdjacentHTML("beforeend",v);return;}
    D.set.call(this,v);}});})();
/* iOS-style compact title bar: appears with the page name once the big title has scrolled under the top */
function navSync(sc){if(!sc)return;const host=sc.classList.contains("fscroll")?sc.parentElement:document.getElementById("frame"),nb=host.querySelector(":scope > .navbar");if(!nb)return;
  const h1=sc.querySelector("h1"),t=nb.querySelector(".nav-t"),nbB=nb.getBoundingClientRect().bottom;
  const on=!!h1&&sc.scrollTop>4&&h1.getBoundingClientRect().bottom<nbB-6;
  if(h1&&t.textContent!==h1.textContent.trim())t.textContent=h1.textContent.trim();
  nb.classList.toggle("on",on);host.classList.toggle("navon",on);}
let navRaf=0;
function navLater(sc){if(navRaf)return;navRaf=requestAnimationFrame(()=>{navRaf=0;navSync(sc);});}
const TABS=[["home","Home"],["history","History"],["goals","Goals"],["settings","Settings"]];
function render(keepScroll){
  const bar=document.getElementById("demotag"),showBar=S.demo||!S.setupDone;
  bar.hidden=!showBar;
  bar.innerHTML=(S.demo?`<span class="demotag-pill glass">Demo</span>`:"")+(!S.setupDone?`<button class="demo-setup glass" data-act="startsetup">Start setup<span aria-hidden="true">›</span></button>`:"");
  document.getElementById("frame").classList.toggle("demo",showBar);
  const y=scr.scrollTop;
  if(!TABS.some(t=>t[0]===S.tab))S.tab="home";
  let html=({home,history,goals,settings})[S.tab]();
  if(TIPS[S.tab]&&!(S.tipsSeen||{})[S.tab]&&!FL)html=html.includes("<!--tip-->")?html.replace("<!--tip-->",tipCard(S.tab)):html.replace(/<\/h1>(<\/div>)?/,m=>m+tipCard(S.tab));
  scr.innerHTML=html;
  drawTabs();
  scr.scrollTop=keepScroll?y:0;
  navSync(scr);
  persist();
}

/* ---------- tab bar: liquid-glass lens (magnifier, water drop on touch, spring physics) ---------- */
const ICF={ /* filled icons, shown inside the lens */
 home:'<svg viewBox="0 0 24 24"><path d="M3 11l9-7 9 7v9a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" fill="currentColor" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round"/></svg>',
 checkin:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10" fill="currentColor"/><path d="M12 7.5v9M7.5 12h9" stroke="#fff" stroke-width="2.2" stroke-linecap="round"/></svg>',
 history:'<svg viewBox="0 0 24 24" fill="currentColor"><rect x="3.4" y="10" width="3.6" height="11" rx="1.8"/><rect x="10.2" y="3.5" width="3.6" height="17.5" rx="1.8"/><rect x="17" y="13" width="3.6" height="8" rx="1.8"/></svg>',
 goals:'<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="9" fill="none" stroke="currentColor" stroke-width="2.2"/><circle cx="12" cy="12" r="5.6" fill="currentColor"/><circle cx="12" cy="12" r="1.7" fill="#fff"/></svg>',
 settings:'<svg viewBox="0 0 24 24" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"><circle cx="12" cy="12" r="4.2" fill="currentColor" stroke="none"/><path d="M12 1.8v3M12 19.2v3M1.8 12h3M19.2 12h3M4.8 4.8L6.9 6.9M17.1 17.1l2.1 2.1M4.8 19.2l2.1-2.1M17.1 6.9l2.1-2.1"/></svg>'
};
const TB={W:0,H:62,tw:0,pressed:false,dragging:false,raf:0,glide:null,nextGlide:true,down:null,relT:0,active:-1,
  sp:{x:{v:0,t:0,k:.16,d:.74,c:0},w:{v:0,t:0,k:.2,d:.66,c:0},h:{v:52,t:52,k:.2,d:.62,c:0},m:{v:1,t:1,k:.2,d:.68,c:0},s:{v:1,t:1,k:.22,d:.62,c:0},g:{v:0,t:0,k:.18,d:.7,c:0}}};
const tbReduce=matchMedia("(prefers-reduced-motion: reduce)").matches;
const tbEase=t=>1-Math.pow(1-t,3);
const tbEl=id=>tabs.querySelector(id);
function tbGeo(){TB.W=tabs.clientWidth;TB.tw=(TB.W-10)/TABS.length;}
const tbCentre=i=>5+TB.tw*i+TB.tw/2;
const tbClamp=x=>Math.min(Math.max(x,5+TB.tw/2),TB.W-5-TB.tw/2);
function tbTargets(){const sp=TB.sp,P=TB.pressed;
  sp.w.t=P?TB.tw*1.3:TB.tw;sp.h.t=P?74:52;sp.m.t=P?1.2:1;sp.s.t=P?1.03:1;sp.g.t=P?1:0;
  if(!TB.dragging&&!TB.glide)sp.x.t=tbCentre(TB.active);}
function tbStep(){let moving=false;const sp=TB.sp,G=TB.glide;
  if(G){const t=Math.min((performance.now()-G.t0)/420,1);
    sp.x.v=G.a+(G.b-G.a)*tbEase(t)+Math.sign(G.b-G.a)*3*Math.sin(Math.PI*Math.max(0,(t-.55)/.45));sp.x.c=0;G.bump=Math.sin(Math.PI*Math.min(t*1.25,1));
    if(t>=1){sp.x.v=sp.x.t=G.b;TB.glide=null;}else moving=true;}
  for(const k in sp){if(k==="x"&&TB.glide)continue;const s=sp[k];if(tbReduce){s.v=s.t;s.c=0;continue;}
    s.c=(s.c+(s.t-s.v)*s.k)*s.d;s.v+=s.c;if(Math.abs(s.c)>.002||Math.abs(s.t-s.v)>.002)moving=true;}
  tbDraw();TB.raf=moving?requestAnimationFrame(tbStep):0;}
function tbKick(){if(!TB.raf)TB.raf=requestAnimationFrame(tbStep);}
function tbDraw(){const sp=TB.sp,W=TB.W,H=TB.H,lens=tbEl(".tb-lens");if(!lens||!W)return;
  const st=TB.glide?10*TB.glide.bump:Math.min(Math.abs(sp.x.c)*1.6,24);
  const w=sp.w.v+st,h=Math.max(sp.h.v-st*.22,44),x=sp.x.v,lx=x-w/2,ly=H/2-h/2,r=h/2,rr=Math.min(r,w/2);
  lens.style.cssText=`left:${lx}px;top:${ly}px;width:${w}px;height:${h}px;border-radius:${r}px`;
  lens.classList.toggle("on",sp.g.v>.35);
  tbEl(".tb-mag").style.cssText=`left:${-lx}px;top:${-ly}px;width:${W}px;height:${H}px;transform-origin:${x}px ${H/2}px;transform:scale(${sp.m.v})`;
  const rim=tbEl(".tb-rim");rim.style.opacity=(sp.g.v*.55).toFixed(3);rim.style.setProperty("--ang",(x/W*300).toFixed(1)+"deg");
  tabs.style.transform=sp.s.v===1?"":`scale(${sp.s.v})`;
  /* cut the lens out of the plain row, so outline icons never show through the glass */
  tbEl(".tb-base").style.clipPath=`path(evenodd,"M0 0H${W}V${H}H0Z M${lx+rr} ${ly}H${lx+w-rr}A${rr} ${rr} 0 0 1 ${lx+w-rr} ${ly+h}H${lx+rr}A${rr} ${rr} 0 0 1 ${lx+rr} ${ly}Z")`;}
function drawTabs(){
  if(!tbEl(".tb-lens")){
    const row=set=>TABS.map(([k,l])=>`<div class="tb-tab">${set[k]}<span>${l}</span></div>`).join("");
    tabs.innerHTML=`<div class="tb-row tb-base" aria-hidden="true">${row(IC)}</div><div class="tb-lens" aria-hidden="true"><div class="tb-mag">${row(ICF)}</div><span class="tb-rim"></span></div><div class="tb-btns">${TABS.map(([k,l])=>`<button class="tab" data-act="tab" data-tab="${k}" aria-label="${l}"></button>`).join("")}</div>`;
    tbGeo();TB.active=Math.max(TABS.findIndex(t=>t[0]===S.tab),0);TB.sp.x.v=TB.sp.x.t=tbCentre(TB.active);TB.sp.w.v=TB.sp.w.t=TB.tw;
  }
  tabs.querySelectorAll(".tab").forEach(b=>{if(b.dataset.tab===S.tab)b.setAttribute("aria-current","page");else b.removeAttribute("aria-current");});
  if(!TB.W)tbGeo();
  const i=Math.max(TABS.findIndex(t=>t[0]===S.tab),0);
  if(i!==TB.active){const from=TB.sp.x.v;TB.active=i;
    if(TB.nextGlide&&!tbReduce&&Math.abs(tbCentre(i)-from)>1){TB.glide={a:from,b:tbCentre(i),t0:performance.now(),bump:0};TB.sp.x.t=tbCentre(i);}}
  TB.nextGlide=true;TB.dragging=false;tbTargets();tbKick();tbDraw();
}
let tabClickBlock=0;
const tbX=e=>{const r=tabs.getBoundingClientRect();return (e.clientX-r.left)/TB.sp.s.v;};
tabs.addEventListener("pointerdown",e=>{tbGeo();TB.down={x0:e.clientX,t:e.timeStamp};try{tabs.setPointerCapture(e.pointerId);}catch(_){}
  clearTimeout(TB.relT);TB.pressed=true;tbTargets();tbKick();});
tabs.addEventListener("pointermove",e=>{if(!TB.down)return;if(!TB.dragging&&Math.abs(e.clientX-TB.down.x0)<5)return;
  TB.dragging=true;TB.glide=null;TB.sp.x.t=tbClamp(tbX(e));tbKick();});
function tbRelease(e,cancel){if(!TB.down)return;const held=e.timeStamp-TB.down.t,wasDrag=TB.dragging;TB.down=null;tabClickBlock=Date.now();
  TB.relT=setTimeout(()=>{TB.pressed=false;tbTargets();tbKick();},Math.max(0,150-held));
  if(cancel){TB.dragging=false;tbTargets();tbKick();return;}
  const i=wasDrag?Math.round((tbClamp(TB.sp.x.t)-5-TB.tw/2)/TB.tw):Math.min(Math.max(Math.floor((tbX(e)-5)/TB.tw),0),TABS.length-1);
  TB.nextGlide=!wasDrag;
  if(TABS[i][0]!==S.tab){closeAll();S.tab=TABS[i][0];render();}else if(layer.querySelector(".dpage")){closeAll();}else{TB.dragging=false;tbTargets();tbKick();}}
tabs.addEventListener("pointerup",e=>tbRelease(e,false));
tabs.addEventListener("pointercancel",e=>tbRelease(e,true));
tabs.addEventListener("touchmove",e=>e.preventDefault(),{passive:false});
window.addEventListener("resize",()=>{tbGeo();TB.glide=null;TB.sp.x.v=TB.sp.x.t=tbCentre(TB.active);TB.sp.w.v=TB.sp.w.t=TB.tw;tbDraw();});


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
  if(isNew&&!dueMonth()){S.tab="home";render();toast(`${MONTHS[cur().m-1]} is already logged`);return;}
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
  <div class="sheet" role="dialog" aria-modal="true" aria-labelledby="sh-t">
  <form class="inner" id="ci" novalidate>
    <div class="shead" style="display:flex;align-items:center;justify-content:space-between"><span style="width:32px"></span><h2 id="sh-t" style="margin:0;font-size:1rem;font-weight:700">${MONTHS[m-1]} ${isNew?"check-in":y}</h2>${XB}</div>
    ${late?`<p class="note" style="color:var(--warn);font-weight:600">Late check-in: use your numbers from the end of ${MONTHS[m-1]}.</p>`:""}
    ${r&&r.est?`<p class="note" style="color:var(--warn)">This month shows the average of the ${r.y} yearly total. Saving here replaces it with exact numbers.</p>`:""}
    <div class="field">
      <label class="row" for="f-income"><span style="flex:1">Income</span><input class="val" id="f-income" inputmode="decimal" value="${v.income===""?"":fmt(v.income)}" placeholder="0"></label>
      <label class="row" for="f-saved" style="min-height:54px"><span style="flex:1;font-weight:600">Saved ${isNew&&!late?"this month":"in "+MONTHS[m-1]}</span><input class="val" id="f-saved" inputmode="decimal" value="${v.saved===""?"":fmt(v.saved)}" placeholder="0" style="font-size:1.4118rem;font-weight:700;color:var(--accent);width:140px"></label>
    </div>
    <div style="display:flex;justify-content:space-between;padding:0 6px;font-size:0.7647rem;gap:8px" class="muted"><span id="c-rate"></span><span id="c-goal"></span></div>
    <div style="display:flex;flex-direction:column;gap:6px;padding:0 2px"><span class="section" style="padding-left:4px;margin:0" id="c-head"></span><div class="split" id="c-bar" aria-hidden="true"></div><span id="c-err" role="alert" style="font-size:0.7647rem;font-weight:600;color:var(--bad);padding-left:4px"></span></div>
    <div class="field">
      <label class="row" for="f-stocks"><span class="dot" style="background:var(--stocks)"></span><span style="flex:1">Stocks</span><input class="val" id="f-stocks" inputmode="decimal" value="${v.stocks===""?"":fmt(v.stocks)}" placeholder="${lr&&isNew?fmt(lr.stocks):"0"}" style="width:100px"></label>
      <label class="row" for="f-prop"><span class="dot" style="background:var(--prop)"></span><span style="flex:1">Property savings</span><input class="val" id="f-prop" inputmode="decimal" value="${v.property===""?"":fmt(v.property)}" placeholder="${lr&&isNew?fmt(lr.property):"0"}" style="width:100px"></label>
      <label class="row" for="f-hol"><span class="dot" style="background:var(--hol)"></span><span style="flex:1">Holiday budget</span><input class="val" id="f-hol" inputmode="decimal" value="${v.holiday===""?"":fmt(v.holiday)}" placeholder="${lr&&isNew?fmt(lr.holiday):"0"}" style="width:100px"></label>
      ${potRows}
      <div class="row muted"><span class="dot" style="background:var(--cash)"></span><span style="flex:1">Cash <span style="font-size:0.7647rem">· rest, automatic</span></span><span class="num" id="c-cash" style="color:var(--ink)"></span></div>
    </div>
    <div class="field">
      <label class="row" for="f-value"><span style="flex:1">Stock portfolio value ${late?"end of "+MS[m-1]:"now"}</span><input class="val" id="f-value" inputmode="decimal" value="${v.stockValue===""?"":fmt(v.stockValue)}" placeholder="${prevVal?fmt(prevVal):"0"}" style="width:110px"></label>
      <div style="display:flex;justify-content:space-between;padding:0 16px 10px;font-size:0.7647rem" class="muted"><span id="c-paid"></span><span id="c-gain" style="font-weight:600"></span></div>
    </div>
    <div class="field"><label class="row" for="f-goal"><span style="flex:1">${goalLabel}</span><input class="val" id="f-goal" inputmode="decimal" value="${v.goal?fmt(v.goal):""}" placeholder="0" style="width:100px"></label></div>
    <button class="btn" type="submit" id="c-save">${isNew?"Save check-in":"Save changes"}</button>
    ${isNew?"":`<button type="button" class="link" data-act="delmonth" style="color:var(--bad);font-size:1rem;min-height:48px">Delete ${MONTHS[m-1]} ${y}</button>`}
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
      if(nd){S.tab="home";render();toast(`${MONTHS[m-1]} saved. ${MONTHS[nd.m-1]} is open too.`,[`Check in ${MS[nd.m-1]}`,"sheet"]);}
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
  layer.insertAdjacentHTML("beforeend",`<div class="ascrim" data-act="keep"></div><div class="askbox" role="alertdialog" aria-modal="true" aria-label="Discard changes?"><p class="muted" style="margin:6px 0 4px;text-align:center;font-size:0.7647rem">Your changes haven't been saved.</p><button class="btn danger" data-act="discard">Discard changes</button><button class="btn" data-act="keep">Keep editing</button></div>`);
}
function close(){FL=false;pending=null;if(layer.querySelector(".dpage")&&!layer.querySelector(".full:not(.dpage)")){[...layer.children].forEach(c=>{if(!c.classList.contains("dpage"))c.remove();});refreshPage();return;}layer.innerHTML="";}
function closeAll(){layer.innerHTML="";FL=false;pending=null;}

/* ---------- confirm dialog ---------- */
let pending=null;
function confirmBox(o){
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="modal glass" role="alertdialog" aria-modal="true" aria-labelledby="cf-t" aria-describedby="cf-d" style="--g1:var(--sheet);--g2:var(--sheet)">
  <h2 id="cf-t" style="margin:4px 0 0;font-size:1.1765rem">${o.title}</h2><p id="cf-d" class="muted" style="margin:0;font-size:0.8824rem;line-height:1.45">${o.text}</p>
  ${o.type?`<label style="align-self:stretch;display:flex;flex-direction:column;gap:6px;text-align:left;margin-top:4px"><span class="muted" style="font-size:0.7647rem">Type <b style="color:var(--ink)">${o.type}</b> to confirm</span><input id="cf-in" autocomplete="off" autocapitalize="characters" spellcheck="false" style="min-height:46px;border-radius:14px;border:1px solid var(--fieldb);background:var(--field);padding:0 14px;font-size:1rem;box-sizing:border-box"></label>`:""}
  <button class="btn ${o.safe?"":"danger"}" data-act="confirm" id="cf-ok" style="align-self:stretch;margin-top:6px" ${o.type?"disabled":""}>${o.ok}</button>
  <button class="link" data-act="close" style="font-size:1rem">Cancel</button></div>`;
  pending=o.run;
  if(o.type){const inp=document.getElementById("cf-in"),ok=document.getElementById("cf-ok");inp.addEventListener("input",()=>{ok.disabled=inp.value.trim().toUpperCase()!==o.type;});setTimeout(()=>inp.focus(),60);}
}


/* ---------- backup file: download + restore from a chosen file ---------- */
const BKEYS=["months","start","pots","nextGoal","oneoffs","assets","fi","holidayTarget","equity","reserve","pp","birthYear","fiAge","chartAge","ot","ret","emergency","ciDay","currency","since","sinceTo"];
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
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="g-t">
  <form class="inner" id="gf" novalidate>
    <div class="shead" style="display:flex;align-items:center;justify-content:space-between"><span style="width:32px"></span><h2 id="g-t" style="margin:0;font-size:1rem;font-weight:700">${pt?"Edit goal":"New savings goal"}</h2>${XB}</div>
    <div class="field">
      <label class="row" for="g-name"><span style="flex:1">Name</span><input class="val" id="g-name" placeholder="e.g. New car" value="${pt?esc(pt.name):""}" maxlength="24" autocomplete="off" style="width:180px"></label>
      <label class="row" for="g-target"><span style="flex:1">Target (${CUR()})</span><input class="val" id="g-target" inputmode="decimal" placeholder="0" value="${pt?fmt(pt.target):""}"></label>
    </div>
    <div class="field"><div class="row" data-act="gfi" style="min-height:62px"><span id="g-fi-l" style="flex:1;display:flex;flex-direction:column;gap:2px"><span>Count toward financial goal</span><span class="muted" style="font-size:0.7647rem">Leave off for money you plan to spend</span></span><button type="button" class="switch" id="g-fi" role="switch" aria-checked="${pt?pt.fi:false}" aria-labelledby="g-fi-l" data-act="gfi"></button></div></div>
    <p class="note">The goal gets its own line in every check-in. What you put there comes out of cash, and it shows on Home and in Goals.</p>
    <button class="btn" type="submit" id="g-save">${pt?"Save changes":"Add goal"}</button>
    ${pt?`<button type="button" class="link" data-act="delpot" data-a="${pt.id}" style="color:var(--bad);font-size:1rem;min-height:48px">Delete goal</button>`:""}
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
const TOS=()=>[["cash","Cash"],["stocks","Stocks"],["property","Property savings"],["holiday","Holiday budget"]].concat(S.pots.map(p=>[p.id,p.name]));
const toName=t=>{const x=TOS().find(o=>o[0]===t);return x?x[1]:"Cash";};
function oneoffList(){const xs=(S.oneoffs||[]).slice().sort((a,b)=>ym(b.y,b.m)-ym(a.y,a.m));if(!xs.length)return "";
  return `<div class="section" style="padding-left:4px">One-off amounts</div><div class="field">${xs.map(o=>`<button type="button" class="row" data-act="info" data-k="oneoff" data-a="${o.id}" style="border:0;background:transparent;text-align:left;width:100%;color:var(--ink)"><span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:8px 0"><span>${esc(o.label||"One-off")}</span><span class="muted" style="font-size:0.7647rem">${MONTHS[o.m-1]} ${o.y} · into ${esc(toName(o.to))}</span></span><span class="num">+${fmt(o.amount)}</span></button>`).join("")}</div>`;}
function openAddMenu(){
  const d=dueMonth(),it=(act,ic,t,s)=>`<button class="row" data-act="${act}" style="border:0;background:transparent;text-align:left;width:100%;color:var(--ink);min-height:68px"><span style="width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--field);border:1px solid var(--fieldb);color:var(--accent);flex:none">${ic}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 0"><span style="font-size:1rem;font-weight:600">${t}</span><span class="muted" style="font-size:0.7647rem">${s}</span></span></button>`;
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="am-t"><div class="inner">
  <div class="shead" style="display:flex;align-items:center;justify-content:space-between;gap:12px"><h2 id="am-t" style="margin:0;font-size:1.2941rem;font-weight:700">Add</h2>${XB}</div>
  <div class="field">${it("sheet",IC.checkin,"Monthly check-in",d?`${MONTHS[d.m-1]} ${d.y}`:"This month is logged – edit it in History")}${it("addoneoff",IC.plus,"One-off amount","Inheritance, gift, bonus – not counted as monthly saving")}${it("addasset",IC.house,"Owned property","e.g. an inherited home: value and mortgage")}</div></div></div>`;
  bindSwipe(layer.querySelector(".sheet"));
}
function openOneoffSheet(id){
  const o=id?(S.oneoffs||[]).find(x=>x.id===id):null,ref=o?{y:o.y,m:o.m}:{y:S.today.y,m:S.today.m};
  const ys=[];for(let y=S.today.y;y>=S.today.y-10;y--)ys.push(y);
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="o-t">
  <form class="inner" id="of" novalidate>
    <div class="shead" style="display:flex;align-items:center;justify-content:space-between"><span style="width:32px"></span><h2 id="o-t" style="margin:0;font-size:1rem;font-weight:700">${o?"Edit one-off":"One-off amount"}</h2>${XB}</div>
    <div class="field">
      <label class="row" for="o-amt" style="min-height:54px"><span style="flex:1;font-weight:600">Amount (${CUR()})</span><input class="val" id="o-amt" inputmode="decimal" placeholder="0" value="${o?fmt(o.amount):""}" style="font-size:1.4118rem;font-weight:700;color:var(--accent);width:150px"></label>
      <label class="row" for="o-lbl"><span style="flex:1">What was it?</span><input class="val" id="o-lbl" placeholder="e.g. Inheritance" value="${o?esc(o.label||""):""}" maxlength="28" autocomplete="off" style="width:180px"></label>
    </div>
    <div class="section" style="padding-left:4px">Where did the money go?</div>
    <div class="field"><div class="row" style="min-height:58px"><select class="sel" id="o-to" aria-label="Where the money went" style="flex:1">${TOS().map(t=>`<option value="${t[0]}"${(o?o.to:"cash")===t[0]?" selected":""}>${esc(t[1])}</option>`).join("")}</select></div></div>
    <div class="section" style="padding-left:4px">When</div>
    <div class="field"><div class="row" style="min-height:58px;gap:8px"><select class="sel" id="o-m" aria-label="Month">${MONTHS.map((n,i)=>`<option value="${i+1}"${ref.m===i+1?" selected":""}>${n}</option>`).join("")}</select><select class="sel" id="o-y" aria-label="Year">${ys.map(y=>`<option value="${y}"${ref.y===y?" selected":""}>${y}</option>`).join("")}</select></div></div>
    <p class="note">Adds to your net worth and financial goal progress, but not to your monthly saving – so your savings rate and the On track average stay realistic.</p>
    <button class="btn" type="submit" id="o-save">${o?"Save changes":"Add one-off"}</button>
    ${o?`<button type="button" class="link" data-act="deloneoff" data-a="${o.id}" style="color:var(--bad);font-size:1rem;min-height:48px">Delete one-off</button>`:""}
  </form></div>`;
  const f=document.getElementById("of"),am=document.getElementById("o-amt"),sv=document.getElementById("o-save");
  const ok=()=>{sv.disabled=!(parse(am.value)>0);};
  f.addEventListener("input",()=>{sheetDirty=true;ok();});f.addEventListener("change",()=>{sheetDirty=true;});ok();sheetDirty=false;bindSwipe(layer.querySelector(".sheet"));
  if(!o)setTimeout(()=>am.focus(),60);
  f.addEventListener("submit",e=>{e.preventDefault();if(sv.disabled)return;
    const data={amount:parse(am.value),label:document.getElementById("o-lbl").value.trim(),to:document.getElementById("o-to").value,m:+document.getElementById("o-m").value,y:+document.getElementById("o-y").value};
    if(ym(data.y,data.m)>ym(S.today.y,S.today.m)){data.y=S.today.y;data.m=S.today.m;}
    S.oneoffs=S.oneoffs||[];
    if(o){Object.assign(o,data);close();render(true);toast("One-off updated");}
    else{S.oneoffs.push(Object.assign({id:"o"+Date.now().toString(36)},data));close();render(true);toast(`+${chf(data.amount)} added to ${toName(data.to)}`);}
  });
}
function openAssetSheet(id){
  const a=id?(S.assets||[]).find(x=>x.id===id):null;
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="sheet info" role="dialog" aria-modal="true" aria-labelledby="a-t">
  <form class="inner" id="af" novalidate>
    <div class="shead" style="display:flex;align-items:center;justify-content:space-between"><span style="width:32px"></span><h2 id="a-t" style="margin:0;font-size:1rem;font-weight:700">${a?"Edit property":"Owned property"}</h2>${XB}</div>
    <div class="field">
      <label class="row" for="a-name"><span style="flex:1">Name</span><input class="val" id="a-name" placeholder="e.g. Grandparents’ house" value="${a?esc(a.name):""}" maxlength="28" autocomplete="off" style="width:190px"></label>
      <label class="row" for="a-val"><span style="flex:1">Market value (${CUR()})</span><input class="val" id="a-val" inputmode="decimal" placeholder="0" value="${a?fmt(a.value):""}"></label>
      <label class="row" for="a-debt"><span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:8px 0"><span>Mortgage (${CUR()})</span><span class="muted" style="font-size:0.7059rem">Leave 0 if there is none</span></span><input class="val" id="a-debt" inputmode="decimal" placeholder="0" value="${a&&a.debt?fmt(a.debt):""}"></label>
      <div class="row" style="min-height:50px"><span class="muted" style="flex:1;font-size:0.8824rem">Your equity</span><b id="a-eq"></b></div>
    </div>
    <div class="field"><div class="row" data-act="afi" style="min-height:62px"><span id="a-fi-l" style="flex:1;display:flex;flex-direction:column;gap:2px"><span>Count toward financial goal</span><span class="muted" style="font-size:0.7647rem">Leave off if you live in it; switch on if it could fund your goal (e.g. rented out or to be sold)</span></span><button type="button" class="switch" id="a-fi" role="switch" aria-checked="${a?!!a.fi:false}" aria-labelledby="a-fi-l" data-act="afi"></button></div></div>
    <p class="note">Equity (value minus mortgage) counts in your net worth. Update the value now and then; it doesn’t change by itself.</p>
    <button class="btn" type="submit" id="a-save">${a?"Save changes":"Add property"}</button>
    ${a?`<button type="button" class="link" data-act="delasset" data-a="${a.id}" style="color:var(--bad);font-size:1rem;min-height:48px">Delete property</button>`:""}
  </form></div>`;
  const f=document.getElementById("af"),nm=document.getElementById("a-name"),vl=document.getElementById("a-val"),db=document.getElementById("a-debt"),sv=document.getElementById("a-save"),eq=document.getElementById("a-eq");
  const ok=()=>{const v=parse(vl.value),d=parse(db.value||0);eq.textContent=chf(v-d);sv.disabled=!(nm.value.trim()&&v>0&&d>=0);};
  f.addEventListener("input",()=>{sheetDirty=true;ok();});ok();sheetDirty=false;bindSwipe(layer.querySelector(".sheet"));
  if(!a)setTimeout(()=>nm.focus(),60);
  f.addEventListener("submit",e=>{e.preventDefault();if(sv.disabled)return;
    const data={name:nm.value.trim(),value:parse(vl.value),debt:parse(db.value||0),fi:document.getElementById("a-fi").getAttribute("aria-checked")==="true"};
    S.assets=S.assets||[];
    if(a){Object.assign(a,data);close();render(true);toast("Property updated");}
    else{S.assets.push(Object.assign({id:"a"+Date.now().toString(36)},data));close();render(true);toast(`“${esc(data.name)}” added to your net worth`);}
  });
}
function deletePot(id){
  const pt=S.pots.find(p=>p.id===id);if(!pt)return;const v=bal(L()).pots[id]||0;
  confirmBox({title:`Delete “${esc(pt.name)}”?`,text:`The ${chf(v)} saved for it moves back to cash. Past check-ins keep their totals.`,ok:"Delete goal",run:()=>{
    S.months.forEach(r=>{const x=(r.pots||{})[id]||0;if(x)r.cash+=x;if(r.pots)delete r.pots[id];});
    (S.oneoffs||[]).forEach(o=>{if(o.to===id)o.to="cash";});
    S.pots=S.pots.filter(p=>p.id!==id);close();render(true);toast(`Goal deleted · ${chf(v)} moved to cash`);}});
}

/* ---------- other overlays ---------- */
function openCurMenu(btn){
  const r=btn.getBoundingClientRect(),h=3*46+12,top=r.bottom+6+h>innerHeight-90?r.top-h-6:r.bottom+6;
  layer.innerHTML=`<div class="scrim" data-act="close" style="background:transparent"></div><div class="menu glass" role="menu" aria-label="Currency" style="top:${Math.round(top)}px;width:230px">${CURS.map(c=>`<button role="menuitemradio" aria-checked="${CUR()===c[0]}" data-act="currency" data-v="${c[0]}"><span>${c[0]} <span class="muted" style="font-size:0.7647rem;font-weight:400">${c[1]}</span></span><span class="muted" style="font-size:0.7647rem">${CUR()===c[0]?"✓":""}</span></button>`).join("")}</div>`;
}
function openMenu(){
  const opts=[["month","Month",`${MONTHS[cur().m-1].slice(0,3)} ${cur().y}`],["quarter","Quarter",""],["year","Year",String(cur().y)]];
  layer.innerHTML=`<div class="scrim" data-act="close" style="background:transparent"></div><div class="menu glass" role="menu" aria-label="Show history by">${opts.map(o=>`<button role="menuitemradio" aria-checked="${S.hmode===o[0]}" data-act="mode" data-mode="${o[0]}"><span>${o[1]}</span><span class="muted" style="font-size:0.7647rem">${S.hmode===o[0]?"✓":o[2]}</span></button>`).join("")}</div>`;
}
function openDue(){
  const d=dueMonth()||{y:S.today.y,m:S.today.m},late=isBehind(),dn=MONTHS[d.m-1];
  layer.innerHTML=`<div class="scrim" data-act="close"></div><div class="modal glass" role="dialog" aria-modal="true" aria-labelledby="due-t" style="--g1:var(--sheet);--g2:var(--sheet)">
  <span style="transform:scale(1.5);margin:8px 0 6px">${appIcon}</span><h2 id="due-t" style="margin:6px 0 0;font-size:1.2941rem">Check-in due</h2>
  <p class="muted" style="margin:0;font-size:0.8824rem;line-height:1.4">${late?`You haven't logged ${dn} yet. Log it now, then ${MONTHS[refK()%12]} is next.`:`It's your check-in day. Log what you saved in ${dn} so your dashboard and goal progress stay up to date.`}</p>
  <button class="btn" data-act="sheet" style="align-self:stretch;margin-top:8px">${late?`Check in ${dn}`:"Start check-in"}</button>
  <button class="link" data-act="later" style="font-size:1rem">Remind me tomorrow</button></div>`;
}
/* full-screen shell (first launch + setup) */
function shellFull(body,next,back,backBtn){
  return `<div class="full${backBtn?" hasback":""}"><div class="wall" aria-hidden="true">${document.querySelector(".wall").innerHTML}</div>${backBtn?`<button class="backbtn glass" ${backBtn[0]} aria-label="Back to ${backBtn[1]}"><svg width="11" height="18" viewBox="0 0 13 21" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M10 2.5L2.5 10.5 10 18.5"/></svg></button>`:""}
  <div class="navbar"><button type="button" class="nav-t" data-act="totop" tabindex="-1"></button></div>
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
function featRow(ic,t,s){return `<div class="row" style="min-height:68px;align-items:center"><span class="feat-ic" style="width:40px;height:40px;border-radius:13px;display:flex;align-items:center;justify-content:center;background:var(--field);border:1px solid var(--fieldb);color:var(--accent);flex:none">${ic}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 0"><span style="font-size:1rem;font-weight:600">${t}</span><span class="muted" style="font-size:0.7647rem;line-height:1.35">${s}</span></span></div>`;}
/* ---------- intro tour, guide, first-visit tips ---------- */
const PV={ /* mini previews of real app parts, drawn with sample numbers */
  checkin:()=>`<div class="pv glass" aria-hidden="true"><div class="pv-h"><span>September check-in</span><span class="pill good">Logged</span></div>
    <div class="pv-kv"><span class="muted">Income</span><b>6’500</b></div><div class="pv-kv"><span class="muted">Saved</span><b>2’100</b></div>
    <div class="pv-bar"><i style="flex:1080;background:var(--stocks)"></i><i style="flex:520;background:var(--cash)"></i><i style="flex:300;background:var(--prop)"></i><i style="flex:200;background:var(--hol)"></i></div>
    <div class="pv-leg"><span><i style="background:var(--stocks)"></i>Stocks 1’080</span><span><i style="background:var(--cash)"></i>Cash 520</span><span><i style="background:var(--prop)"></i>Property 300</span><span><i style="background:var(--hol)"></i>Holiday 200</span></div></div>`,
  home:()=>`<div class="pv glass" aria-hidden="true"><span class="muted" style="font-size:0.7059rem">Net worth</span><b style="font-size:1.5294rem;letter-spacing:-.02em">${CUR()} 70’503</b><span class="pill good" style="align-self:flex-start">▲ ${CUR()} 2’905 this month</span>
    ${[["Cash savings","23’745","var(--cash)",.8,"✓ Emergency fund filled"],["Stocks · paid in","26’280","var(--stocks)",.88,"current value 29’853 · volatile"],["Property savings","10’005","var(--prop)",.34,""]].map(r=>`<div class="pv-row"><span style="display:flex;flex-direction:column;gap:1px;flex:1"><span style="font-size:0.7647rem;font-weight:600">${r[0]}</span>${r[4]?`<span class="muted" style="font-size:0.6471rem">${r[4]}</span>`:""}<span class="pv-track"><i style="width:${r[3]*100}%;background:${r[2]}"></i></span></span><b style="font-size:0.8235rem">${r[1]}</b></div>`).join("")}</div>`,
  ontrack:()=>{const W=300,H=130,X=t=>10+t*(W-50),Y=v=>H-18-v/2.4*(H-30);const curve=(r)=>{let s="";for(let i=0;i<=25;i++){const t=i/25,yrs=i*1.48,v=1000*12*((Math.pow(1+r,yrs)-1)/r)/1e6;s+=`${X(t).toFixed(1)},${Y(v).toFixed(1)} `;}return s;};
    return `<div class="pv glass" aria-hidden="true"><div class="pv-h"><span>On track by age 50?</span><span class="pill good">On track</span></div>
    <svg viewBox="0 0 ${W} ${H}" width="100%" style="display:block;overflow:visible">
      <line x1="10" x2="${W-40}" y1="${Y(1)}" y2="${Y(1)}" stroke="var(--soft)" stroke-dasharray="3 4"/><text x="12" y="${Y(1)-5}" font-size="10" fill="var(--muted)">Goal 1M</text>
      <line x1="${X(.68)}" x2="${X(.68)}" y1="10" y2="${H-18}" stroke="var(--soft)" stroke-dasharray="2 4"/>
      <polyline points="${curve(.08)}" fill="none" stroke="var(--goodline)" stroke-width="1.8" stroke-dasharray="5 4"/>
      <polyline points="${curve(.05)}" fill="none" stroke="var(--accent)" stroke-width="2.6"/>
      <polyline points="${curve(.02)}" fill="none" stroke="var(--prop)" stroke-width="1.8" stroke-dasharray="5 4"/>
      <circle cx="${X(.69)}" cy="${Y(1)}" r="3.5" fill="var(--bg)" stroke="var(--goodline)" stroke-width="2"/><text x="${X(.69)}" y="${Y(1)-7}" text-anchor="middle" font-size="10" font-weight="700" fill="var(--goodline)">age 51</text>
      <circle cx="10" cy="${Y(0)}" r="3.5" fill="var(--ink)"/>
      <text x="10" y="${H-3}" font-size="10" fill="var(--muted)">Now</text><text x="${X(.68)}" y="${H-3}" text-anchor="middle" font-size="10" fill="var(--muted)">Goal age 50</text><text x="${W-40}" y="${H-3}" text-anchor="end" font-size="10" fill="var(--muted)">62</text>
    </svg>
    <div class="pv-leg"><span><i style="background:var(--goodline)"></i>Best 8%</span><span><i style="background:var(--accent)"></i>Middle 5%</span><span><i style="background:var(--prop)"></i>Worst 2%</span></div></div>`;},
  privacy:()=>`<div class="pv glass" aria-hidden="true" style="align-items:center;text-align:center;gap:10px"><span style="width:56px;height:56px;border-radius:18px;display:flex;align-items:center;justify-content:center;background:var(--field);border:1px solid var(--fieldb);color:var(--accent)"><span style="transform:scale(1.4);display:flex">${ICS.lock}</span></span>
    <b style="font-size:0.8824rem">Stored only on this iPhone</b>
    <div class="pv-row" style="width:100%;text-align:left"><span style="width:32px;height:38px;border-radius:7px;background:var(--field);border:1px solid var(--fieldb);display:flex;align-items:flex-end;justify-content:center;font-size:0.4706rem;font-weight:700;color:var(--accent);padding-bottom:4px;box-sizing:border-box;flex:none">JSON</span><span style="flex:1;display:flex;flex-direction:column;gap:1px"><span style="font-size:0.7647rem;font-weight:600">Safe-backup-2026-10.json</span><span class="muted" style="font-size:0.6471rem">Saved in Files · iCloud Drive</span></span></div></div>`
};
const TOUR=[
  {pv:"checkin",t:"Check in once a month",s:"On your check-in day (you pick it), enter your income and what you saved, then split it into stocks, cash, property, holiday and your own goals. It takes about two minutes."},
  {pv:"home",t:"See where you stand",s:"Home shows your net worth and every pot. Stocks show what you paid in, with today’s value below, because markets move. History compares months, quarters and years."},
  {pv:"ontrack",t:"Know if you’re on track",s:"Set your financial goal and the age you want to reach it. Safe projects your money at 8%, 5% and 2% a year, based on your real monthly average, and shows the age you reach the goal. It also tells you what first home you could afford."},
  {pv:"privacy",t:"Private by design",s:"No account, no bank login, no server. Your numbers never leave this iPhone. Download a backup file now and then; Safe reminds you when it’s time."}
];
let tourReplay=false;
function drawTour(i){
  FL=true;const st=TOUR[i],last=i===TOUR.length-1;
  const dots=`<div style="display:flex;gap:6px;justify-content:center;margin-bottom:10px" aria-label="Step ${i+1} of ${TOUR.length}">${TOUR.map((_,k)=>`<span style="width:7px;height:7px;border-radius:50%;background:${k===i?"var(--ink)":"var(--track)"};transform:scale(${k===i?1.15:1});transition:background .2s,transform .2s"></span>`).join("")}</div>`;
  const doneAct=tourReplay?'data-act="tourdone"':`data-act="fl" data-s="${isStandalone()?"demo":"install"}"`;
  layer.innerHTML=shellFull(`<div class="tour" style="display:flex;flex-direction:column;gap:16px;padding-top:12px">
      <div class="eyebrow">${i+1} of ${TOUR.length}</div>
      ${PV[st.pv]()}
      <h1 style="font-size:1.7647rem;margin:6px 0 0">${st.t}</h1>
      <p class="muted" style="margin:0;font-size:1rem;line-height:1.45">${st.s}</p></div>`,
    dots+(last?`<button class="btn" ${doneAct}>${tourReplay?"Done":"Let’s go"}</button>`:`<button class="btn" data-act="tour" data-i="${i+1}">Next</button>`),
    last?`<button class="link" style="visibility:hidden" tabindex="-1" aria-hidden="true">Skip</button>`:`<button class="link" ${doneAct}>Skip</button>`,
    i>0?[`data-act="tour" data-i="${i-1}"`,"Back"]:(tourReplay?['data-act="tourdone"',"Guide"]:['data-act="fl" data-s="welcome"',"Back"]));
  const f=layer.querySelector(".full");let sx=null,sy=0;
  f.addEventListener("touchstart",e=>{const t=e.touches[0];sx=t.clientX>28?t.clientX:null;sy=t.clientY;},{passive:true});
  f.addEventListener("touchend",e=>{if(sx==null)return;const t=e.changedTouches[0],dx=t.clientX-sx,dy=Math.abs(t.clientY-sy);sx=null;if(Math.abs(dx)<60||dy>50)return;
    if(dx<0&&!last)drawTour(i+1);else if(dx>0&&i>0)drawTour(i-1);},{passive:true});
}
function openGuide(){
  const sec=(t,body)=>`<div class="section" style="padding-left:4px;margin-top:10px">${t}</div><div class="card glass" style="gap:10px">${body}</div>`;
  const p=t=>`<p class="explain" style="margin:0">${t}</p>`;
  layer.innerHTML=shellFull(`<h1 style="font-size:1.8824rem;margin-top:8px">How Safe works</h1>
    ${p("Safe is a calm monthly tracker for your savings and investments. You log one check-in a month; Safe turns it into an overview, a history and an honest answer to “am I on track?”.")}
    ${sec("1 · Monthly check-in",`${PV.checkin()}${p("On your check-in day (pick it in Settings → Check-in), enter your income, what you saved and how you split it: stocks (with the portfolio’s current value), cash, property savings, holiday budget and your own goals. Missed a month? Safe asks for the oldest open month first, so there are no gaps.")}`)}
    ${sec("2 · Home",`${PV.home()}${p("Net worth is everything together. Stocks show what you paid in (big) and today’s market value (small), because the value moves every day. Cash shows whether your emergency fund is filled. The savings rate is the share of your income you saved.")}`)}
    ${sec("3 · History",p("Compare months, quarters or years: how much you saved, where it went and your market gain. Tap a month to edit or delete it."))}
    ${sec("4 · Goals and On track",`${PV.ontrack()}${p("<b style=\"color:var(--ink)\">Financial goal:</b> the amount at which you could live from your money. Holiday money and goals not marked “count toward the financial goal” are left out.")}
      ${p("<b style=\"color:var(--ink)\">On track:</b> tap the card and enter your birth year and the age you want to reach your financial goal. Safe takes your current stock value plus your average monthly stock savings from the last 12 check-ins (until you have 12, your “Saving since” estimate fills the gap) and lets it grow at 8%, 5% and 2% a year (best, middle, worst). Cash and property savings are added without return. Grey is what you paid in, blue is growth. Rings on the goal line show the age each case reaches it. The status uses the middle case; if you’re behind, Safe says how much more per month would close the gap. It updates with every check-in. It’s an estimate, not a promise.")}
      ${p("<b style=\"color:var(--ink)\">First property:</b> what you could buy with your property savings (20% equity, minus a safety reserve) and with your income (housing costs at 5% imputed interest, amortisation and upkeep, max. one third of income). Tap it to change every assumption.")}
      ${p("<b style=\"color:var(--ink)\">Savings goals:</b> your own pots, like a car. Each gets a line in the check-in; choose whether it counts toward the financial goal.")}`)}
    ${sec("5 · Demo mode",p("Settings → Demo mode shows a made-up person, so you can show Safe to someone without revealing your numbers. Your data stays untouched."))}
    ${sec("6 · Privacy and backup",`${PV.privacy()}${p("There is no account and no server: data is stored only on this iPhone. If you delete the app, the data is gone, so download a backup file every month or two (Settings → Backup). Restoring a file brings everything back, also on a new iPhone.")}`)}
    ${sec("Good to know",p("Tap any card or row to see details and how it’s calculated. Swipe a sheet down to close it. Swipe from the left edge to go back."))}
    <div class="list glass" style="margin-top:6px"><button class="row" data-act="tourreplay" style="border:0;border-bottom:1px solid var(--line);background:transparent;color:var(--accent);font-weight:600;text-align:left">Replay the intro</button><button class="row" data-act="tipsreset" style="border:0;background:transparent;color:var(--accent);font-weight:600;text-align:left">Show tips again</button></div>`,
    "","",['data-act="guideclose"',"Settings"]);
}
const TIPS={
  home:"This is your overview. Tap + to log a month; when a check-in is due, a banner appears here. Tap any card to see details.",
  checkin:"Log each month here, ideally on your check-in day. You can edit or delete a month later in History.",
  history:"Switch between months, quarters and years. Tap a month to edit it.",
  goals:"Tap “On track” to enter your birth year and goal age and see if you’ll reach your goal. Tap any goal to change its target.",
  settings:"Pick your check-in day, currency and reminder here. Goal amounts are changed directly in Goals. Back up regularly: your data lives only on this iPhone. “How Safe works” explains everything."
};
function tipCard(k){return `<div class="card glass tip" role="note" style="flex-direction:row;align-items:flex-start;gap:12px;padding:14px 16px"><span style="width:30px;height:30px;border-radius:10px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-weight:800;font-size:0.9412rem;flex:none">i</span><span style="flex:1;display:flex;flex-direction:column;gap:8px"><span style="font-size:0.8824rem;line-height:1.4">${TIPS[k]}</span><button class="link" data-act="tip" data-k="${k}" style="align-self:flex-start;padding:0;font-weight:600">Got it</button></span></div>`;}
function openFirst(){FL=true;drawFirst("welcome");}
function drawFirst(step){
  FL=true;
  const dots=n=>`<div style="display:flex;gap:6px;justify-content:center" aria-label="Step ${n} of 3">${[1,2,3].map(j=>`<span style="width:7px;height:7px;border-radius:50%;background:${j===n?"var(--ink)":"var(--track)"};transform:scale(${j===n?1.15:1})"></span>`).join("")}</div>`;
  if(step==="welcome"){
    layer.innerHTML=shellFull(`<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding-top:28px">
      <span style="transform:scale(2.2);margin:34px 0 38px">${appIcon}</span>
      <h1 style="font-size:2rem">Welcome to Safe</h1>
      <p class="muted" style="margin:0;font-size:1rem;line-height:1.4;max-width:300px">Your savings, goals and progress in one calm place.</p></div>
      <div class="list glass" style="margin-top:14px">${featRow(IC.checkin,"Check in once a month","On a day you choose, log what you saved and split it.")}${featRow(IC.goals,"Know if you’re on track","See when you reach your financial goal, in a best, middle and worst case.")}${featRow(ICS.lock,"Your data stays on your iPhone","No account. Backups are files you download and keep.")}</div>`,
      `<button class="btn" data-act="tour" data-i="0">Get started</button>`,"");
  }else if(step==="install"){
    const n=(k,ic,t,s)=>`<div class="row" style="min-height:72px"><span style="width:28px;height:28px;border-radius:14px;display:flex;align-items:center;justify-content:center;background:var(--accent);color:#fff;font-size:0.8824rem;font-weight:700;flex:none">${k}</span><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 0"><span style="font-size:1rem;font-weight:600">${t}</span><span class="muted" style="font-size:0.7647rem;line-height:1.35">${s}</span></span><span style="color:var(--accent);flex:none;display:flex">${ic}</span></div>`;
    layer.innerHTML=shellFull(`<div class="eyebrow" style="margin-top:8px">Install</div><h1 style="font-size:1.7647rem">Add Safe to your Home Screen</h1>
      <p class="muted" style="margin:0;font-size:0.8824rem;line-height:1.4">Safe runs like an app from your Home Screen, full screen and offline. iPhone only sends the monthly reminder to apps added there.</p>
      <div class="list glass">${n(1,ICS.share,"Tap Share","The square with the arrow in Safari's toolbar.")}${n(2,ICS.addhome,"Choose “Add to Home Screen”","Scroll down in the menu if you don't see it.")}${n(3,`<span style="transform:scale(.7);display:flex">${appIcon}</span>`,"Open Safe from your Home Screen","Setup continues there.")}</div>
      <p class="note">Important: an app on the Home Screen keeps its own data, separate from Safari. Set Safe up after opening it from the Home Screen, or your numbers stay behind in Safari.</p>`,
      `<div class="btn plain" style="cursor:default" aria-live="polite">Now open Safe from your Home Screen</div>`,`<button class="link" data-act="fl" data-s="demo">Use Safe in the browser instead</button>`,['data-act="fl" data-s="welcome"',"Back"]);
  }else if(step==="notify"){
    layer.innerHTML=shellFull(`<div style="display:flex;flex-direction:column;align-items:center;text-align:center;gap:12px;padding-top:40px">
      <span class="glass" style="width:84px;height:84px;border-radius:28px;display:flex;align-items:center;justify-content:center;color:var(--accent);margin-bottom:14px">${ICS.bell}</span>
      <h1 style="font-size:1.7647rem">Your check-in day</h1>
      <p class="muted" style="margin:0;font-size:1rem;line-height:1.4;max-width:310px">Pick a day that suits you, for example just after your salary arrives. Safe reminds you once a month on that day at 19:00. Nothing else.</p></div>
      <div class="list glass" style="margin-top:14px">${daySelect("fl-ciday")}</div>
      <p class="note" style="margin-top:-4px">${ciOff()?"Days 1–14 count for the previous month: on the 1st of November you log October.":`You log the month you're in: on ${ciDayN()===0?"the last day":"the "+ordinal(ciDayN())} of October you log October.`} You can change it any time in Settings.</p>
      <div class="glass" style="display:flex;gap:12px;align-items:flex-start;padding:14px;border-radius:22px;margin-top:18px;text-align:left" aria-label="Preview of the notification">${appIcon}<span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="display:flex;justify-content:space-between;font-size:0.8824rem"><b>Safe</b><span class="muted" style="font-size:0.7647rem">${ciDayN()===0?"Last day":ordinal(ciDayN())}, 19:00</span></span><span style="font-size:0.8824rem;font-weight:600">Time for your monthly check-in</span><span class="muted" style="font-size:0.8824rem">Log what you saved ${ciOff()?"last":"this"} month.</span></span></div>`,
      `<button class="btn" data-act="fl" data-s="ask">Allow reminder</button>`,`<button class="link" data-act="fl" data-s="no">Not now</button>`);
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
  toast(reminder?`You're set · reminder on ${ciWord()}`:"You're set · turn on the reminder any time in Settings");
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
function moneyRow(id,label,val,dot,sub){return `<label class="row" for="${id}">${dot?`<span class="dot" style="background:${dot}"></span>`:""}<span style="flex:1;display:flex;flex-direction:column;gap:1px;padding:${sub?"8px 0":"0"}"><span>${label}</span>${sub?`<span class="muted" style="font-size:0.7059rem">${sub}</span>`:""}</span><input class="val" id="${id}" inputmode="decimal" value="${val===""||val==null?"":fmt(val)}" placeholder="0" style="width:110px"></label>`;}
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
    const yr=y=>{const c=setupMonths(y).length,a=MS[kYM(setupMonths(y)[0]).m-1],z=MS[kYM(setupMonths(y)[c-1]).m-1];return `<div class="row" style="min-height:64px"><span style="flex:1;display:flex;flex-direction:column;gap:2px"><span style="font-weight:600">${y}</span><span class="muted" style="font-size:0.7647rem">${c} month${c===1?"":"s"} · ${a}${c>1?" – "+z:""}${SU.plan[y]==="yearly"?" · as monthly average":""}</span></span><div class="seg" role="group" aria-label="${y} input"><button data-act="plan" data-y="${y}" data-v="months" aria-pressed="${SU.plan[y]==="months"}">Months</button><button data-act="plan" data-y="${y}" data-v="yearly" aria-pressed="${SU.plan[y]==="yearly"}">Yearly</button></div></div>`;};
    const ys=setupYears(),cnt=steps.filter(x=>x.k==="month").length,yc=steps.filter(x=>x.k==="year").length;
    layer.innerHTML=shellFull(`<div style="height:62px"><div style="transform:scale(1.5);transform-origin:left top;width:40px">${appIcon}</div></div>
    <div class="eyebrow">${SU.hist?"History":"Set up Safe"}</div><h1 style="font-size:1.7647rem">${SU.hist?"Add older months":"Set up your starting point"}</h1>
    <p class="muted" style="margin:0;font-size:0.8824rem;line-height:1.4">${SU.hist?`Your history starts in ${kName(SU.toK)}. Pick how far back to go. Months you already have stay as they are.`:"Start simply with what you have today, or add past months for a longer history."}</p>
    ${FL?`<div class="list glass"><button class="row" data-act="flrestore" style="border:0;background:transparent;text-align:left;width:100%"><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:8px 0"><span style="font-weight:600;color:var(--accent)">Restore from a backup</span><span class="muted" style="font-size:0.7647rem">Had Safe before? Pick your backup file.</span></span><span style="color:var(--accent)" aria-hidden="true">›</span></button></div>`:""}
    ${SU.hist?"":(()=>{const opt=(v,t,s)=>`<button class="row" data-act="sumode" data-v="${v}" role="radio" aria-checked="${SU.mode===v}" style="border:0;background:transparent;text-align:left;width:100%;align-items:center"><span style="flex:1;display:flex;flex-direction:column;gap:2px;padding:10px 0"><span style="font-weight:600">${t}</span><span class="muted" style="font-size:0.7647rem;line-height:1.35">${s}</span></span><span class="radio${SU.mode===v?" on":""}" aria-hidden="true"></span></button>`;
      return `<div class="section">How do you want to start?</div><div class="list glass" role="radiogroup" aria-label="How do you want to start">${opt("today","Start with today's balances","Enter roughly what you have now. From "+kName(SU.toK)+" on, your check-ins track everything exactly.")}${opt("past","Add past months too","Months or yearly totals with income and split, for a longer history.")}</div>`;})()}
    ${!SU.hist&&SU.mode==="today"?"":`<div class="list glass"><div class="row" style="min-height:52px"><span style="flex:1">Start tracking from</span></div><div class="row" style="min-height:58px;gap:8px">${sel("su-fm",months,fy.m,"Start month")}${sel("su-fy",years,fy.y,"Start year")}</div></div>`}
    ${ys.length?`<div class="section">How do you know each year?</div><div class="list glass">${ys.map(yr).join("")}</div>
    <p class="note">You'll enter your balances once, then ${yc?yc+" yearly total"+(yc>1?"s":"")+(cnt?" and ":""):""}${cnt?cnt+" month"+(cnt===1?"":"s"):""}. A yearly total is shown as the monthly average.</p>`
    :`<p class="note">You'll enter your current balances once, then do your first check-in for ${kName(SU.toK)}.</p>`}`,
    `<button class="btn" data-act="snext" ${SU.hist&&n<=0?"disabled":""}>Continue</button>`,"",['data-act="sclose"',FL?(S.setupDone?"Back":"Demo"):"History"]);
  }else if(s.k==="bal"){
    const st=SU.start;
    const today=!SU.hist&&SU.fromK===SU.toK;
    layer.innerHTML=shellFull(`${bar}<div class="eyebrow">${today?"Your balances today":"Starting balances"}</div><h1 style="font-size:1.7647rem">${today?"What you have now":"Before "+kName(SU.fromK)}</h1>
    <p class="muted" style="margin:0;font-size:0.8824rem;line-height:1.4">${today?`A rough overview is fine. From ${kName(SU.toK)} on, your monthly check-ins track income, savings and the split exactly.`:`What you had at the end of ${kName(SU.fromK-1)}. Leave anything you don't have at 0.`}</p>
    <div class="list glass">${moneyRow("su-bc","Cash savings",st.cash,"var(--cash)")}${moneyRow("su-bv","Stock portfolio value",st.stockValue,"var(--stocks)")}${moneyRow("su-bp","Stocks paid in so far",st.paid,"var(--stocks)","Everything you invested since opening the depot, without gains")}${moneyRow("su-bpr","Property savings",st.property,"var(--prop)")}${moneyRow("su-bh","Holiday budget",st.holiday,"var(--hol)")}</div>
    <p class="note">Not sure what you paid into stocks? Use the portfolio value; gains then start counting from here.</p>
    ${today?(()=>{const sk=SU.since!=null?SU.since:SU.toK-12,sy=kYM(sk),ys=[];for(let y=S.today.y;y>=S.today.y-40;y--)ys.push(y);
      const ms=MONTHS.map((n,i)=>i+1).filter(m=>ym(sy.y,m)<SU.toK);
      return `<div class="section">Saving since</div><div class="list glass"><div class="row" style="min-height:58px;gap:8px"><select class="sel" id="su-sm" aria-label="Saving since, month">${ms.map(m=>`<option value="${m}"${m===sy.m?" selected":""}>${MONTHS[m-1]}</option>`).join("")}</select><select class="sel" id="su-sy" aria-label="Saving since, year">${ys.map(y=>`<option value="${y}"${y===sy.y?" selected":""}>${y}</option>`).join("")}</select></div>
      <div class="row" style="min-height:50px"><span class="muted" style="flex:1;font-size:0.8824rem">Average saved per month</span><b id="su-avg"></b></div></div>
      <p class="note">When did you start building these savings? Safe divides what you have by the months since then. This rough average is used for “On track” until your own check-ins replace it; after 12 check-ins only real data counts.</p>`;})():""}`,
    nav(nextLabel()),"",BK);
    suAvg();
  }else{
    const isY=s.k==="year",v=SU.vals[s.id]&&SU.vals[s.id]!=="skip"?SU.vals[s.id]:guessVals(s);
    const ks=isY?setupMonths(s.y):[s.key],title=isY?(ks.length===12?`${s.y} in total`:`${MS[kYM(ks[0]).m-1]} – ${MS[kYM(ks[ks.length-1]).m-1]} ${s.y}`):kName(s.key);
    const mi=steps.filter(x=>x.k!=="intro"&&x.k!=="bal").indexOf(s)+1,mt=steps.length-2;
    layer.innerHTML=shellFull(`${bar}<div class="eyebrow">${isY?"Yearly total":"Month"} · ${mi} of ${mt}</div><h1 style="font-size:1.7647rem">${title}</h1>
    <div class="list glass">${moneyRow("su-inc",isY?"Income in total":"Income",v.income)}${moneyRow("su-sav",isY?"Saved in total":"Amount saved",v.saved)}</div>
    <div style="display:flex;flex-direction:column;gap:6px;padding:0 2px"><span class="section" style="padding-left:4px;margin:0" id="su-head"></span><div class="split" id="su-bar" aria-hidden="true"></div><span id="su-err" role="alert" style="font-size:0.7647rem;font-weight:600;color:var(--bad);padding-left:4px"></span></div>
    <div class="list glass">${moneyRow("su-st","Stocks (paid in)",v.stocks,"var(--stocks)")}${moneyRow("su-pr","Property savings",v.property,"var(--prop)")}${moneyRow("su-ho","Holiday budget",v.holiday,"var(--hol)")}${S.pots.map(pt=>moneyRow("su-pot-"+pt.id,esc(pt.name),(v.pots||{})[pt.id]||0,pt.color)).join("")}
    <div class="row muted"><span class="dot" style="background:var(--cash)"></span><span style="flex:1">Cash <span style="font-size:0.7647rem">· rest, automatic</span></span><span class="num" id="su-cash" style="color:var(--ink)"></span></div></div>
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
  if(s.k==="bal"){SU.start={cash:g("su-bc"),stockValue:g("su-bv"),paid:g("su-bp")||g("su-bv"),property:g("su-bpr"),holiday:g("su-bh")};
    const sm=document.getElementById("su-sm"),sy=document.getElementById("su-sy");if(sm&&sy){let k=ym(+sy.value,+sm.value);if(k>=SU.toK)k=SU.toK-1;SU.since=k;}return;}
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
  if(!SU.hist){const today=SU.fromK===SU.toK;S.since=today&&SU.since!=null?SU.since:null;S.sinceTo=today?SU.toK:null;}
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
    case "tab": if(Date.now()-tabClickBlock<450)break;closeAll();S.tab=t.dataset.tab;render();break;
    case "pageback": popPage();break;
    case "pspan": PGS.span=+t.dataset.v;{const n=layer.querySelectorAll(".dpage");if(n.length)drawPageChart(n[n.length-1]);}break;
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
    case "switch": {S.reminder=!S.reminder;const sw=t.matches(".switch")?t:t.querySelector(".switch");sw.setAttribute("aria-checked",S.reminder);}toast(S.reminder?`Reminder on · ${ciWord()} at 19:00`:"Reminder off");break;
    case "gfi": {const sw=document.getElementById("g-fi");sw.setAttribute("aria-checked",sw.getAttribute("aria-checked")!=="true");break;}
    case "backup": downloadBackup().then(ok=>{if(!ok){toast("Backup cancelled");return;}S.lastBackup=new Date().toISOString();S.backupYm=ym(S.today.y,S.today.m);document.querySelectorAll(".toast").forEach(x=>x.remove());render(true);toast("Backup saved");});break;
    case "restore": pickBackup(false);break;
    case "wipe": confirmBox({title:"Delete all data?",text:`This removes ${S.months.length} month${S.months.length===1?"":"s"}, your savings goals and all balances from this iPhone. It can't be undone. Backup files you downloaded stay.`,ok:"Delete everything",type:"DELETE",run:()=>{S.setupDone=false;S.months=[];S.start={cash:0,property:0,holiday:0,stockValue:0,paid:0};S.pots=[];S.nextGoal=0;S.hkey=null;S.tab="home";close();render();toast("All data deleted");}});break;
    case "delmonth": {const r=S.months[editI],name=`${MONTHS[r.m-1]} ${r.y}`,idx=editI;confirmBox({title:`Delete ${name}?`,text:`Its ${chf(r.saved)} saved and the split are removed from History and from your balances. It can't be undone.`,ok:"Delete month",run:()=>{S.months.splice(idx,1);S.hkey=null;close();render(true);toast(`${name} deleted`);}});break;}
    case "confirm": {const fn=pending;if(fn)fn();break;}
    case "addgoal": openGoalSheet(null);break;
    case "addmenu": openAddMenu();break;
    case "addoneoff": openOneoffSheet(null);break;
    case "addasset": openAssetSheet(null);break;
    case "afi": {const sw=document.getElementById("a-fi");sw.setAttribute("aria-checked",sw.getAttribute("aria-checked")!=="true");sheetDirty=true;break;}
    case "deloneoff": {const id=t.dataset.a,o=(S.oneoffs||[]).find(x=>x.id===id);if(!o)break;confirmBox({title:"Delete this one-off?",text:`${chf(o.amount)} will be removed from ${toName(o.to)}.`,ok:"Delete",run:()=>{S.oneoffs=S.oneoffs.filter(x=>x.id!==id);close();render(true);toast("One-off deleted");}});break;}
    case "delasset": {const id=t.dataset.a,a=(S.assets||[]).find(x=>x.id===id);if(!a)break;confirmBox({title:`Delete “${esc(a.name)}”?`,text:"It will be removed from your net worth.",ok:"Delete",run:()=>{S.assets=S.assets.filter(x=>x.id!==id);close();render(true);toast("Property deleted");}});break;}
    case "goaledit": openGoalSheet(t.dataset.a);break;
    case "delpot": deletePot(t.dataset.a);break;
    case "notif": close();if(isLogged()){S.tab="home";render();toast("This month is already logged");}else openSheet(null);break;
    case "due": S.tab="home";render();openDue();break;
    case "later": close();toast("Safe will remind you again tomorrow");break;
    case "flrestore": pickBackup(true);break;
    case "curmenu": openCurMenu(t);break;
    case "currency": S.currency=t.dataset.v;close();persist();render(true);toast(`Currency · ${CUR()}`);break;
    case "totop": {const sc=t.closest(".full")?t.closest(".full").querySelector(".fscroll"):scr;sc.scrollTo({top:0,behavior:"smooth"});break;}
    case "tour": drawTour(+t.dataset.i);break;
    case "tourreplay": tourReplay=true;drawTour(0);break;
    case "tourdone": tourReplay=false;FL=false;openGuide();break;
    case "guide": openGuide();break;
    case "guideclose": layer.innerHTML="";FL=false;render(true);break;
    case "tipsreset": S.tipsSeen={};persist();toast("Tips will show again on each tab");break;
    case "tip": {S.tipsSeen=Object.assign({},S.tipsSeen,{[t.dataset.k]:true});const c=t.closest(".tip");if(c){c.style.transition="opacity .2s";c.style.opacity="0";setTimeout(()=>render(true),200);}else render(true);persist();break;}
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
function suAvg(){const o=document.getElementById("su-avg");if(!o||!SU)return;const sm=document.getElementById("su-sm"),sy=document.getElementById("su-sy");let k=ym(+sy.value,+sm.value);if(k>=SU.toK)k=SU.toK-1;
  const g=id=>{const el=document.getElementById(id);return el?parse(el.value):0;};const n=SU.toK-k,fi=g("su-bc")+g("su-bpr")+(g("su-bp")||g("su-bv"));
  o.textContent=n>0?`${chf(fi/n)} · ${n} month${n===1?"":"s"}`:"–";}
document.getElementById("frame").addEventListener("input",()=>suAvg());
document.getElementById("frame").addEventListener("change",e=>{
  if(e.target.id==="ot-sy"||e.target.id==="ot-sm"){const m=+document.getElementById("ot-sm").value,y=+document.getElementById("ot-sy").value;
    if(m&&y){if(S.sinceTo==null)S.sinceTo=S.months.length?ym(S.months[0].y,S.months[0].m):(S.createdYm!=null?S.createdYm:ym(S.today.y,S.today.m));let k=ym(y,m);if(k>=S.sinceTo)k=S.sinceTo-1;S.since=k;persist();render(true);openInfo("ontrack");toast("Saving since "+kName(k));}return;}
  if(e.target.id==="su-sy"||e.target.id==="su-sm"){if(e.target.id==="su-sy"){readSetup();drawSetup();}suAvg();return;}
  if(e.target.dataset.ciday){S.ciDay=+e.target.value;persist();if(FL&&layer.querySelector("#fl-ciday")){drawFirst("notify");}else{render(true);toast(`Check-in day · ${ciDayN()===0?"last day of the month":ordinal(ciDayN())}`);}return;}
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
scr.addEventListener("scroll",()=>navLater(scr),{passive:true});
layer.addEventListener("scroll",e=>{if(e.target.classList&&e.target.classList.contains("fscroll"))navLater(e.target);},{passive:true,capture:true});
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
  if(isBehind()||new Date(S.today.y,S.today.m-1,S.today.d)>=ciDate(d.y,d.m)){S.lastDuePrompt=key;persist();openDue();}
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
layer.addEventListener("touchstart",e=>{const t=e.touches[0];ex=((layer.querySelector(".full .backbtn")||layer.querySelector(".dpage"))&&!layer.querySelector(".sheet")&&t.clientX<28)?{x:t.clientX,y:t.clientY}:null;},{passive:true});
layer.addEventListener("touchend",e=>{if(!ex)return;const t=e.changedTouches[0],dx=t.clientX-ex.x,dy=Math.abs(t.clientY-ex.y);ex=null;if(dx>70&&dy<60){if(layer.querySelector(".dpage")&&!layer.querySelector(".full:not(.dpage)")){popPage();return;}const b=layer.querySelector(".full .backbtn");if(b)b.click();}},{passive:true});
window.addEventListener("pagehide",()=>persist());
document.addEventListener("visibilitychange",()=>{if(document.hidden){persist();return;}if(ready){refreshToday();if(!layer.innerHTML)render(true);maybeDue();}});
})();
