(()=>{
'use strict';

const PROGRESSION_VERSION='1.4.0';
const AUTO_RATES={scout:.5,crew:2,rover:10,satellite:50,swarm:250,worldai:1000};
const BUILDING_CPS={house:.25,farm:.5,lab:2,tower:5};
const CIV_TIERS=[
  {need:0,name:'原始惑星',icon:'●'},
  {need:12000,name:'生命圏',icon:'🌱'},
  {need:47000,name:'集落文明',icon:'🏠'},
  {need:122000,name:'都市文明',icon:'🏙️'},
  {need:262000,name:'惑星文明',icon:'🌍'},
  {need:502000,name:'宇宙文明',icon:'🚀'},
  {need:1000000,name:'恒星文明',icon:'☀️'},
  {need:10000000,name:'星間文明',icon:'🛸'},
  {need:100000000,name:'銀河文明',icon:'🌌'},
  {need:1000000000,name:'超文明',icon:'✦'}
];

let civCarry=0;
let lastTick=performance.now();
let lastShown=Math.floor(Number(state.score)||0);
let lastDeltaSample=lastShown;
let lastDeltaFx=0;
let lastCps=null;
let lastTier=-1;
let civTimer=null;

function nf(n){return Math.floor(Number(n)||0).toLocaleString('ja-JP');}
function compact(n){
  const v=Number(n)||0;
  const a=Math.abs(v);
  if(a<1e6)return Math.floor(v).toLocaleString('ja-JP');
  const units=[[1e15,'Qa'],[1e12,'T'],[1e9,'B'],[1e6,'M']];
  for(const [d,u] of units)if(a>=d){const x=v/d;return `${x.toFixed(Math.abs(x)<10?2:Math.abs(x)<100?1:0)}${u}`;}
  return nf(v);
}
function discovered(id){return Array.isArray(state.discovered)&&state.discovered.includes(id);}
function autoMultiplier(){let m=1;if(discovered('fox'))m*=1.10;if(discovered('machine'))m*=1.20;if(discovered('ai'))m*=1.50;return m;}
function autoCps(){const a=state.automation||{};return Object.entries(AUTO_RATES).reduce((sum,[id,r])=>sum+(Number(a[id])||0)*r,0)*autoMultiplier();}
function buildingCps(){const b=state.buildings||{};return Object.entries(BUILDING_CPS).reduce((sum,[id,r])=>sum+(Number(b[id])||0)*r,0);}
function totalCps(){return autoCps()+buildingCps();}
function tapPower(score=state.score){
  const s=Math.max(0,Number(score)||0);
  let base=s<100?1:s<1000?2:s<10000?5:s<100000?20:s<1000000?100:s<10000000?500:s<100000000?2500:s<1000000000?12500:62500;
  const b=state.buildings||{};
  const infrastructure=1+(Number(b.house||0)+Number(b.farm||0)+Number(b.lab||0)*2+Number(b.tower||0)*3)*.025;
  if(discovered('bird'))base*=1.10;if(discovered('meteor'))base*=1.20;
  return Math.max(1,Math.floor(base*infrastructure));
}
function tierIndex(power=state.score){let idx=0;for(let i=0;i<CIV_TIERS.length;i++)if(power>=CIV_TIERS[i].need)idx=i;return idx;}
function tierProgress(power=state.score){
  const i=tierIndex(power),cur=CIV_TIERS[i],next=CIV_TIERS[i+1];
  if(!next)return {i,pct:100,current:power-cur.need,total:1,next:null};
  const total=next.need-cur.need,current=Math.max(0,power-cur.need);return {i,pct:Math.max(0,Math.min(100,current/total*100)),current,total,next};
}

function installHud(){
  if(document.getElementById('civHud'))return;
  const world=document.getElementById('world');
  if(!world)return;
  const hud=document.createElement('div');
  hud.id='civHud';
  hud.className='civ-hud';
  hud.innerHTML=`
    <svg class="civ-ring" viewBox="0 0 220 220" aria-hidden="true">
      <circle class="civ-ring-track" cx="110" cy="110" r="101"></circle>
      <circle id="civRingProgress" class="civ-ring-progress" cx="110" cy="110" r="101"></circle>
    </svg>
    <div class="civ-number-card">
      <div class="civ-label">文明力</div>
      <div id="civPowerValue" class="civ-power-value">0</div>
      <div class="civ-speed-row"><strong id="civPerSec">+0 /秒</strong><span>・</span><span id="tapPowerText">1 TAP +1</span></div>
    </div>
    <div id="civGainLayer" class="civ-gain-layer"></div>
  `;
  world.appendChild(hud);
  const progress=document.querySelector('.progress-head');
  if(progress&&!document.getElementById('civNextLine')){
    const line=document.createElement('div');line.id='civNextLine';line.className='civ-next-line';progress.parentElement.insertBefore(line,progress);
  }
  const action=document.querySelector('.action-zone');
  if(action&&!document.getElementById('civRateCard')){
    action.insertAdjacentHTML('beforeend','<div id="civRateCard" class="civ-rate-card"><span>文明生産</span><strong id="civRateLarge">+0 /秒</strong><small id="civRateSource">建物と自動探索が文明を加速</small></div>');
  }
}

function injectStyles(){
  if(document.getElementById('mw-v14-style'))return;
  const s=document.createElement('style');s.id='mw-v14-style';s.textContent=`
.resource-strip{opacity:.76;transform:scale(.985);transform-origin:center top}.stats-strip{opacity:.8}.world-card{min-height:365px!important;transition:background 1s ease,box-shadow .6s ease}.world{z-index:4}.planet{z-index:2}.civ-hud{position:absolute;inset:0;z-index:18;pointer-events:none;display:grid;place-items:center}.civ-ring{position:absolute;width:218px;height:218px;overflow:visible;filter:drop-shadow(0 0 8px rgba(255,255,255,.48))}.civ-ring-track,.civ-ring-progress{fill:none;stroke-width:7}.civ-ring-track{stroke:rgba(255,255,255,.19)}.civ-ring-progress{stroke:url(#none);stroke:#7cf6ff;stroke-linecap:round;stroke-dasharray:634.602;stroke-dashoffset:634.602;transform:rotate(-90deg);transform-origin:110px 110px;transition:stroke-dashoffset .35s cubic-bezier(.2,.85,.25,1),stroke .35s;filter:drop-shadow(0 0 6px rgba(65,229,255,.9))}.civ-number-card{position:relative;z-index:5;min-width:150px;text-align:center;padding:8px 12px 7px;border-radius:20px;background:rgba(12,42,76,.36);border:1px solid rgba(255,255,255,.25);backdrop-filter:blur(5px);box-shadow:inset 0 1px 0 rgba(255,255,255,.18),0 8px 24px rgba(14,63,104,.12)}.civ-label{font-size:9px;letter-spacing:.16em;font-weight:900;color:rgba(255,255,255,.88);text-shadow:0 2px 6px rgba(0,35,75,.5)}.civ-power-value{font-variant-numeric:tabular-nums;font-size:37px;line-height:1.02;font-weight:1000;letter-spacing:-.035em;color:white;text-shadow:0 3px 13px rgba(3,41,91,.72),0 0 18px rgba(102,225,255,.42);transform-origin:center}.civ-power-value.tick{animation:civTick .24s cubic-bezier(.2,1.5,.3,1)}.civ-power-value.milestone{animation:civMilestone .72s cubic-bezier(.2,1.4,.3,1)}.civ-speed-row{margin-top:4px;display:flex;justify-content:center;align-items:center;gap:5px;font-size:8px;color:rgba(255,255,255,.8);white-space:nowrap}.civ-speed-row strong{color:#aaffd4;font-size:10px;text-shadow:0 0 8px rgba(76,255,169,.55)}.civ-gain-layer{position:absolute;inset:0;overflow:visible}.civ-gain{position:absolute;left:58%;top:38%;font-size:17px;font-weight:1000;color:#fff;text-shadow:0 2px 9px rgba(0,57,124,.8),0 0 9px #5fe9ff;animation:civGain 1s ease-out forwards;white-space:nowrap}.civ-gain.auto{color:#9fffd0;font-size:13px}.civ-next-line{display:flex;align-items:center;justify-content:space-between;margin-bottom:5px;font-size:9px;font-weight:900;color:#315c80}.civ-next-line strong{color:#1478e8}.civ-rate-card{margin:9px auto 0;width:92%;border-radius:15px;padding:7px 11px;background:linear-gradient(135deg,rgba(239,255,247,.86),rgba(238,249,255,.88));border:1px solid rgba(62,186,139,.16);display:grid;grid-template-columns:auto 1fr;align-items:center;column-gap:9px;box-shadow:0 8px 18px rgba(39,116,155,.07)}.civ-rate-card>span{font-size:8px;color:#65839b}.civ-rate-card strong{justify-self:end;font-size:14px;color:#118a52;font-variant-numeric:tabular-nums}.civ-rate-card small{grid-column:1/3;font-size:8px;color:#8297aa;margin-top:1px}.civ-rate-card.rate-up{animation:rateUp .8s ease-out}.civ-rate-card.rate-up strong{color:#7d45ff;text-shadow:0 0 12px rgba(141,78,255,.38)}
.world-card.civ-tier-5{box-shadow:0 18px 50px rgba(53,109,153,.18),0 0 28px rgba(80,205,255,.22)}.world-card.civ-tier-6{background:linear-gradient(180deg,#568bd8 0,#8bd8ff 54%,#eafaff 100%);box-shadow:0 18px 55px rgba(51,93,166,.28),0 0 34px rgba(96,228,255,.36)}.world-card.civ-tier-7{background:linear-gradient(180deg,#35568f 0,#7aaedb 52%,#dff7ff 100%);box-shadow:0 18px 60px rgba(46,72,143,.34),0 0 42px rgba(128,118,255,.32)}.world-card.civ-tier-8,.world-card.civ-tier-9{background:radial-gradient(circle at 50% 42%,#5679ac 0,#24375f 52%,#101b36 100%);box-shadow:0 18px 65px rgba(22,33,75,.48),0 0 48px rgba(116,103,255,.38)}.world-card.civ-tier-8 .cloud,.world-card.civ-tier-9 .cloud{opacity:.22}.world-card.civ-tier-8 .spark,.world-card.civ-tier-9 .spark{opacity:1;text-shadow:0 0 15px white}.civ-threshold-flash{position:absolute;inset:-8px;border-radius:34px;pointer-events:none;z-index:40;border:3px solid rgba(255,255,255,.9);box-shadow:inset 0 0 45px rgba(99,234,255,.55),0 0 40px rgba(130,95,255,.6);animation:thresholdFlash 1.15s ease-out forwards}
@keyframes civTick{0%{transform:scale(.96)}45%{transform:scale(1.09)}100%{transform:scale(1)}}@keyframes civMilestone{0%{transform:scale(.8);filter:brightness(1)}30%{transform:scale(1.22);filter:brightness(1.5)}65%{transform:scale(.96)}100%{transform:scale(1);filter:brightness(1)}}@keyframes civGain{0%{opacity:0;transform:translate(0,20px) scale(.7)}18%{opacity:1;transform:translate(0,0) scale(1.2)}100%{opacity:0;transform:translate(35px,-68px) scale(.92)}}@keyframes rateUp{0%{transform:scale(.96)}35%{transform:scale(1.045);box-shadow:0 0 25px rgba(126,70,255,.3)}100%{transform:scale(1)}}@keyframes thresholdFlash{0%{opacity:0;transform:scale(.92)}22%{opacity:1;transform:scale(1.02)}100%{opacity:0;transform:scale(1.09)}}
@media(max-width:380px){.civ-power-value{font-size:32px}.civ-number-card{min-width:138px}.civ-ring{width:205px;height:205px}.civ-rate-card{width:96%}}@media(prefers-reduced-motion:reduce){.civ-power-value,.civ-gain,.civ-rate-card,.civ-threshold-flash{animation:none!important}}
`;
  document.head.appendChild(s);
}

function popGain(amount,type='manual'){
  const layer=document.getElementById('civGainLayer');if(!layer||amount<=0)return;
  const el=document.createElement('div');el.className=`civ-gain ${type==='auto'?'auto':''}`;el.textContent=`+${compact(amount)}`;el.style.left=`${52+Math.random()*18}%`;el.style.top=`${34+Math.random()*12}%`;layer.appendChild(el);setTimeout(()=>el.remove(),1050);
}
function pulseNumber(big=false){const el=document.getElementById('civPowerValue');if(!el)return;el.classList.remove('tick','milestone');void el.offsetWidth;el.classList.add(big?'milestone':'tick');}
function thresholdFx(){const card=document.querySelector('.world-card');if(!card)return;const f=document.createElement('div');f.className='civ-threshold-flash';card.appendChild(f);setTimeout(()=>f.remove(),1200);pulseNumber(true);if(typeof beep==='function'){beep(620,.07);setTimeout(()=>beep(820,.08),85);setTimeout(()=>beep(1040,.1),175);}}
function flashRate(){const c=document.getElementById('civRateCard');if(!c)return;c.classList.remove('rate-up');void c.offsetWidth;c.classList.add('rate-up');}

function renderCivHud(force=false){
  const power=Math.floor(Number(state.score)||0),p=tierProgress(power),cps=totalCps(),tap=tapPower(power),tier=p.i;
  const value=document.getElementById('civPowerValue');
  if(value)value.textContent=compact(power);
  const ps=document.getElementById('civPerSec');if(ps)ps.textContent=`+${cps<10?cps.toFixed(1):compact(cps)} /秒`;
  const tp=document.getElementById('tapPowerText');if(tp)tp.textContent=`1 TAP +${compact(tap)}`;
  const rl=document.getElementById('civRateLarge');if(rl)rl.textContent=`+${cps<10?cps.toFixed(1):compact(cps)} /秒`;
  const rs=document.getElementById('civRateSource');if(rs)rs.textContent=`TAP +${compact(tap)} ｜ 自動 ${autoCps().toFixed(autoCps()<10?1:0)}/秒 ｜ 建物 ${buildingCps().toFixed(buildingCps()<10?1:0)}/秒`;
  const next=document.getElementById('civNextLine');if(next){next.innerHTML=p.next?`<span>次の進化 ${p.next.icon} <strong>${p.next.name}</strong></span><span>あと ${compact(Math.max(0,p.next.need-power))}</span>`:`<span>文明到達点 ✦ <strong>${CIV_TIERS[tier].name}</strong></span><span>MAX</span>`;}
  const circle=document.getElementById('civRingProgress');if(circle){const C=634.602;circle.style.strokeDashoffset=String(C*(1-p.pct/100));circle.style.stroke=tier>=8?'#c89bff':tier>=5?'#72f3ff':'#7cf6ff';}
  const card=document.querySelector('.world-card');if(card){[...card.classList].filter(x=>x.startsWith('civ-tier-')).forEach(x=>card.classList.remove(x));card.classList.add(`civ-tier-${tier}`);}
  if(lastCps!==null&&Math.abs(cps-lastCps)>.001)flashRate();lastCps=cps;
  if(lastTier>=0&&tier>lastTier)thresholdFx();lastTier=tier;
  if(force)lastShown=power;
}

const previousExplore=explore;
function civExplore(){
  const modal=document.getElementById('choiceModal');if(modal&&!modal.classList.contains('hidden'))return;
  const before=Math.floor(Number(state.score)||0),tap=tapPower(before);
  previousExplore();
  const afterCore=Math.floor(Number(state.score)||0);
  if(afterCore<=before)return;
  const normalCore=1;
  const extra=Math.max(0,tap-normalCore);
  if(extra>0){state.score+=extra;if(typeof updateStage==='function')updateStage();if(typeof checkAchievements==='function')checkAchievements();if(typeof saveState==='function')saveState();if(typeof render==='function')render();}
  const gained=Math.max(1,Math.floor(Number(state.score)||0)-before);
  popGain(gained,'manual');pulseNumber(gained>=Math.max(100,tap*3));renderCivHud();
}

function tick(){
  const now=performance.now(),dt=Math.min(1,(now-lastTick)/1000);lastTick=now;
  const passive=buildingCps();
  if(passive>0){civCarry+=passive*dt;const add=Math.floor(civCarry);if(add>0){civCarry-=add;state.score+=add;if(typeof updateStage==='function')updateStage();if(typeof checkAchievements==='function')checkAchievements();if(typeof saveState==='function')saveState();}}
  const current=Math.floor(Number(state.score)||0);
  if(current!==lastShown){
    const delta=current-lastShown;lastShown=current;pulseNumber(delta>=1000);
    const t=Date.now();if(delta>0&&t-lastDeltaFx>480){const sampled=current-lastDeltaSample;if(sampled>0)popGain(sampled,'auto');lastDeltaSample=current;lastDeltaFx=t;}
  }
  renderCivHud();
}

function init(){
  injectStyles();installHud();
  explore=civExplore;
  const btn=document.getElementById('exploreBtn');if(btn)btn.onclick=civExplore;
  const ver=document.querySelector('.version');if(ver)ver.textContent=`v${PROGRESSION_VERSION} · OFFLINE PWA`;
  renderCivHud(true);
  lastTier=tierIndex();lastCps=totalCps();lastDeltaSample=Math.floor(Number(state.score)||0);
  if(civTimer)clearInterval(civTimer);civTimer=setInterval(tick,250);
  window.addEventListener('pagehide',()=>{if(typeof saveState==='function')saveState();});
}

init();
})();