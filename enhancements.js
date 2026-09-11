(()=>{
'use strict';

const AUTO_ITEMS=[
  {id:'scout',name:'斥候ドローン',icon:'🛸',rate:.5,unlock:0,desc:'2秒に1回、自動探索',base:{wood:40,stone:15},scale:1.18},
  {id:'crew',name:'探索班',icon:'🥾',rate:2,unlock:0,desc:'毎秒2回、自動探索',base:{wood:140,food:100},scale:1.19},
  {id:'rover',name:'自律ローバー',icon:'🤖',rate:10,unlock:1,desc:'毎秒10回、自動探索',base:{stone:400,knowledge:100},scale:1.20},
  {id:'satellite',name:'観測衛星',icon:'🛰️',rate:50,unlock:2,desc:'毎秒50回、自動探索',base:{stone:1500,knowledge:500},scale:1.21},
  {id:'swarm',name:'ドローン群',icon:'⚡',rate:250,unlock:3,desc:'毎秒250回、自動探索',base:{wood:5000,stone:5000,knowledge:3000},scale:1.22},
  {id:'worldai',name:'惑星AI',icon:'◇',rate:1000,unlock:4,desc:'毎秒1000回、自動探索',base:{knowledge:15000,stone:12000},scale:1.23}
];
const META={wood:{icon:'🌲',label:'木'},stone:{icon:'🪨',label:'石'},food:{icon:'🍎',label:'食料'},population:{icon:'👤',label:'人口'},knowledge:{icon:'✦',label:'知識'}};
const KEYS=Object.keys(META);
let autoCarry=0,lastTick=performance.now(),lastAutoFx=0,autoTimer=null;

function ensureState(){
  state.automation={scout:0,crew:0,rover:0,satellite:0,swarm:0,worldai:0,...(state.automation||{})};
  if(!Number.isFinite(state.manualClicks))state.manualClicks=state.explores||0;
  if(!Number.isFinite(state.autoLastSeen))state.autoLastSeen=Date.now();
  if(state.enhancementVersion!=='1.1.0'){
    state.score=Math.max(0,Math.round((state.score||0)*1000));
    state.explores=Math.max(state.manualClicks,Math.round((state.explores||0)*1000));
    state.enhancementVersion='1.1.0';
  }
}

function installUI(){
  document.querySelectorAll('.resource').forEach((el,i)=>el.dataset.resource=KEYS[i]||'');
  const strip=document.querySelector('.resource-strip');
  if(strip&&!document.querySelector('.stats-strip'))strip.insertAdjacentHTML('afterend','<section class="stats-strip"><div><small>手動クリック</small><b id="manualCount">0</b></div><div class="accent-stat"><small>自動探索</small><b id="autoRate">0.0/秒</b></div><div><small>総探索数</small><b id="totalExplore">0</b></div></section>');
  const action=document.querySelector('.action-zone');if(action&&!document.getElementById('fxLayer'))action.insertAdjacentHTML('afterbegin','<div id="fxLayer" class="fx-layer" aria-live="polite"></div>');
  const world=document.querySelector('.world-card');if(world&&!document.getElementById('burstLayer'))world.insertAdjacentHTML('afterbegin','<div id="burstLayer" class="burst-layer" aria-live="polite"></div>');
  const tabs=document.querySelector('.tabs'),buildTab=tabs?.querySelector('[data-tab="build"]');
  if(tabs&&buildTab&&!tabs.querySelector('[data-tab="automation"]'))buildTab.insertAdjacentHTML('afterend','<button class="tab auto-tab" type="button" data-tab="automation">自動化 <span id="autoCount">0台</span></button>');
  const buildPanel=document.getElementById('buildPanel');
  if(buildPanel&&!document.getElementById('automationPanel'))buildPanel.insertAdjacentHTML('afterend','<section id="automationPanel" class="panel tab-panel"><div class="automation-summary"><div><small>現在の自動探索</small><strong id="autoRatePanel">0.0 探索/秒</strong></div><span>⚙️</span></div><div id="autoGrid" class="auto-grid"></div></section>');
  const modalCard=document.querySelector('#choiceModal .modal-card');if(modalCard&&!document.getElementById('choiceResult'))modalCard.insertAdjacentHTML('beforeend','<div id="choiceResult" class="event-result hidden"></div>');
  const ver=document.querySelector('.version');if(ver)ver.textContent='v1.1.0 · OFFLINE PWA';
  const autoTab=tabs?.querySelector('[data-tab="automation"]');
  if(autoTab&&!autoTab.dataset.bound){autoTab.dataset.bound='1';autoTab.addEventListener('click',()=>{document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active'));autoTab.classList.add('active');document.getElementById('automationPanel').classList.add('active');});}
}

function injectStyle(){
  if(document.getElementById('mw-enhance-style'))return;
  const s=document.createElement('style');s.id='mw-enhance-style';s.textContent=`
.stats-strip{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin-bottom:10px}.stats-strip>div{background:rgba(255,255,255,.58);border:1px solid rgba(43,119,181,.1);border-radius:13px;padding:7px 8px;text-align:center}.stats-strip small{display:block;color:#6c86a3;font-size:8px}.stats-strip b{display:block;margin-top:2px;font-size:11px}.stats-strip .accent-stat{background:linear-gradient(135deg,rgba(221,252,238,.9),rgba(230,248,255,.92));border-color:rgba(41,182,111,.22)}.accent-stat b{color:#168d57}
.tabs{grid-template-columns:repeat(4,1fr)!important}.tab{font-size:11px;padding-left:2px;padding-right:2px}.tab span{display:block;font-size:8px}.tab.auto-tab.active{color:#168d57}
.automation-summary{display:flex;align-items:center;justify-content:space-between;background:linear-gradient(135deg,#ecfff4,#eff9ff);border:1px solid rgba(41,182,111,.15);border-radius:16px;padding:10px 12px;margin-bottom:8px}.automation-summary small{display:block;color:#62809a;font-size:8px}.automation-summary strong{font-size:11px;color:#168d57}.automation-summary>span{font-size:24px}
.auto-grid{display:grid;grid-template-columns:repeat(2,1fr);gap:8px}.auto-card{border:1px solid rgba(50,121,175,.12);background:rgba(247,252,255,.92);border-radius:17px;padding:11px;text-align:left;min-height:132px}.auto-card.locked{filter:grayscale(.7);opacity:.58}.auto-card.can-build{border-color:rgba(38,169,108,.35);box-shadow:inset 0 0 0 1px rgba(38,169,108,.08)}.auto-head{display:flex;justify-content:space-between;align-items:center}.auto-icon{font-size:26px}.owned{font-size:10px;font-weight:900;background:#e9f6ff;padding:4px 7px;border-radius:999px}.auto-card h3{font-size:13px;margin:4px 0 2px}.auto-card p{font-size:9px;color:#6c86a3;margin:0 0 7px;line-height:1.45}.rate-pill{display:inline-block;background:#e7fff2;color:#148b54;font-weight:900;font-size:9px;border-radius:999px;padding:4px 7px;margin-bottom:5px}.auto-cost{font-size:9px;color:#5d7893}
.action-zone{position:relative}.fx-layer{position:absolute;left:50%;top:27px;width:1px;height:1px;z-index:8;pointer-events:none}.float-gain{position:absolute;left:0;top:0;transform:translate(calc(-50% + var(--x,0px)),var(--y,0));font-size:14px;font-weight:950;padding:4px 8px;border-radius:999px;background:rgba(255,255,255,.95);box-shadow:0 8px 18px rgba(30,91,138,.18);animation:gainFly 1.2s ease-out forwards;white-space:nowrap}.float-gain.gain{color:#168d57}.float-gain.loss{color:#d24b5d}.float-gain.auto-gain{background:rgba(231,255,243,.96)}.float-gain.big-gain{font-size:17px}.float-label{position:absolute;left:0;top:38px;transform:translateX(-50%);font-size:12px;font-weight:950;white-space:nowrap;animation:labelPop 1s ease-out forwards}.float-label.manual{color:#fff}.float-label.auto{color:#0b8350;background:rgba(255,255,255,.8);padding:2px 6px;border-radius:999px}
.resource.resource-flash{animation:resourceFlash .55s ease-out}.burst-layer{position:absolute;inset:0;pointer-events:none;z-index:9;display:grid;place-items:center}.center-burst{font-weight:1000;border-radius:18px;padding:10px 15px;background:rgba(255,255,255,.93);box-shadow:0 16px 36px rgba(22,77,120,.24);animation:centerBurst 1.5s ease-out forwards;max-width:82%;text-align:center}.center-burst.event{color:#8b5bd6}.center-burst.result{color:#168d57}.center-burst.auto{color:#168d57}.center-burst.evolve{color:#1478e8;font-size:18px}
.event-result{border-top:1px solid rgba(50,121,175,.1);padding-top:12px}.event-result h3{margin:4px 0 6px;font-size:20px}.event-result p{font-size:12px;color:#536f88}.result-kicker{font-size:9px;letter-spacing:.16em;color:#1885e6;font-weight:900}.delta-row{display:flex;flex-wrap:wrap;gap:6px;margin:10px 0 14px}.delta-chip{font-size:10px;font-weight:900;padding:6px 8px;border-radius:999px}.delta-chip.gain{background:#e6fff1;color:#12804d}.delta-chip.loss{background:#fff0f2;color:#c43f52}.delta-chip.neutral{background:#edf3f7;color:#6a8297}.result-close{width:100%;border:0;border-radius:14px;background:linear-gradient(135deg,#2fb0ff,#1677e2);color:#fff;padding:12px;font-weight:900}
@keyframes gainFly{0%{opacity:0;transform:translate(calc(-50% + var(--x,0px)),calc(var(--y,0px) + 22px)) scale(.82)}18%{opacity:1;transform:translate(calc(-50% + var(--x,0px)),var(--y,0px)) scale(1.06)}100%{opacity:0;transform:translate(calc(-50% + var(--x,0px)),calc(var(--y,0px) - 72px)) scale(.95)}}@keyframes labelPop{0%{opacity:0;transform:translate(-50%,15px) scale(.8)}30%{opacity:1;transform:translate(-50%,0) scale(1.05)}100%{opacity:0;transform:translate(-50%,-40px) scale(.95)}}@keyframes centerBurst{0%{opacity:0;transform:scale(.72)}16%{opacity:1;transform:scale(1.04)}72%{opacity:1;transform:scale(1)}100%{opacity:0;transform:scale(.94)}}@keyframes resourceFlash{0%{transform:scale(1)}35%{transform:scale(1.08);background:#e7fff2;box-shadow:0 0 0 3px rgba(41,182,111,.12)}100%{transform:scale(1)}}
@media(min-width:700px){.auto-grid{grid-template-columns:repeat(3,1fr)}}@media(max-width:380px){.tab{font-size:9px}.auto-card{padding:9px}}@media(prefers-reduced-motion:reduce){.float-gain,.float-label,.center-burst,.resource.resource-flash{animation:none!important}}
`;document.head.appendChild(s);
}

function mutateBalance(){
  [12000,35000,75000,140000,240000,Infinity].forEach((n,i)=>STAGES[i].need=n);
  const bases=[{wood:120,stone:50},{wood:180,stone:80},{wood:500,stone:500,food:300},{wood:1200,stone:1600,knowledge:800}],scales=[1.34,1.36,1.40,1.44];
  BUILDINGS.forEach((b,i)=>{b.base=bases[i];b.scale=scales[i];});
  ACHIEVEMENTS[1].desc='手動で1,000回探索する';ACHIEVEMENTS[1].test=s=>s.manualClicks>=1000;
  ACHIEVEMENTS[2].desc='手動で10,000回探索する';ACHIEVEMENTS[2].test=s=>s.manualClicks>=10000;
  ACHIEVEMENTS[3].desc='建物を合計10回建てる';ACHIEVEMENTS[3].test=s=>buildingTotal(s)>=10;
  ACHIEVEMENTS[8].desc='人口1,000人を超える';ACHIEVEMENTS[8].test=s=>s.resources.population>=1000;
  ACHIEVEMENTS[9].desc='知識を2,500集める';ACHIEVEMENTS[9].test=s=>s.resources.knowledge>=2500;
  SPECIAL_EVENTS[0].choices=[
    ['中へ入る','危険だが大きな発見があるかも',s=>chance(.62)?reward(s,{stone:120,knowledge:50},'洞窟の奥で大きな鉱脈を見つけた。'):penalty(s,{food:50},'迷って食料を大量に失った。')],
    ['入口を調べる','安全に少しだけ調査する',s=>reward(s,{stone:50,knowledge:20},'入口周辺を慎重に調べた。')],
    ['印だけ残す','資源は動かない',()=>logEvent('洞窟の位置だけ記録して撤退した。')]
  ];
  SPECIAL_EVENTS[1].choices=[
    ['こじ開ける','中身は完全にランダム',s=>{const r=Math.random();return r<.25?reward(s,{knowledge:140},'失われた研究データを発見した！'):r<.72?reward(s,{wood:100,stone:100},'大量の資材が入っていた。'):penalty(s,{food:40},'中身は腐っていた。');}],
    ['研究所へ運ぶ','研究所Lv.1以上で効果大',s=>s.buildings.lab>0?reward(s,{knowledge:100},'研究所で安全に解析できた。'):reward(s,{knowledge:20},'設備不足で少しだけ解析した。')],
    ['放置する','何も起こらない',()=>logEvent('怪しい箱には触れなかった。')]
  ];
  SPECIAL_EVENTS[2].choices=[
    ['迎え入れる','食料80 → 人口+60',s=>{if(s.resources.food>=80){s.resources.food-=80;s.resources.population+=60;return logEvent('食料を渡し、旅人60人を迎え入れた。');}return logEvent('食料不足で旅人たちは去っていった。');}],
    ['交易する','木と石をまとめて獲得',s=>reward(s,{wood:70,stone:50},'旅人と交易して資材を得た。')],
    ['話を聞く','知識を獲得',s=>reward(s,{knowledge:60},'遠い土地の知識を教えてもらった。')]
  ];
  SPECIAL_EVENTS[3].choices=[
    ['掘る','石を獲得。図鑑発見の可能性あり',s=>{reward(s,{stone:90},'地中から未知の構造物が現れた。');tryDiscovery(true);return '地中から構造物を発見し、石を90獲得した。';}],
    ['観測する','知識を確実に獲得',s=>reward(s,{knowledge:70},'模様の周期性を記録した。')],
    ['上で眠る','35%で大当たり',s=>chance(.35)?reward(s,{knowledge:120},'奇妙な夢から新しい理論を思いついた。'):logEvent('普通によく眠れた。')]
  ];
}

function fmt2(n){const v=Math.floor(Number(n)||0);return v<1e6?v.toLocaleString('ja-JP'):v<1e9?`${(v/1e6).toFixed(v<1e7?1:0)}M`:`${(v/1e9).toFixed(1)}B`;}
function rate(){return AUTO_ITEMS.reduce((sum,a)=>sum+(state.automation[a.id]||0)*a.rate,0);}
function totalAuto(){return Object.values(state.automation).reduce((a,b)=>a+b,0);}
function snap(){return Object.fromEntries(KEYS.map(k=>[k,state.resources[k]||0]));}
function diff(before){const d={};KEYS.forEach(k=>{const v=Math.round((state.resources[k]||0)-(before[k]||0));if(v)d[k]=v;});return d;}
function scaledCost(a){const lv=state.automation[a.id]||0,out={};Object.entries(a.base).forEach(([k,v])=>out[k]=Math.ceil(v*Math.pow(a.scale,lv)));return out;}
function afford(c){return Object.entries(c).every(([k,v])=>(state.resources[k]||0)>=v);}
function costText2(c){return Object.entries(c).map(([k,v])=>`${META[k].icon}${fmt2(v)}`).join(' ');}

function emit(delta,isAuto=false,big=false){
  const fx=document.getElementById('fxLayer');if(!fx)return;let i=0;
  Object.entries(delta).forEach(([k,v])=>{const el=document.createElement('div');el.className=`float-gain ${v<0?'loss':'gain'} ${isAuto?'auto-gain':''} ${big?'big-gain':''}`;el.textContent=`${META[k].icon} ${v>0?'+':''}${fmt2(v)}`;el.style.setProperty('--x',`${(i-1.5)*50+(Math.random()*28-14)}px`);el.style.setProperty('--y',`${Math.random()*20-4}px`);fx.appendChild(el);setTimeout(()=>el.remove(),1200);i++;const card=document.querySelector(`[data-resource="${k}"]`);if(card){card.classList.remove('resource-flash');void card.offsetWidth;card.classList.add('resource-flash');}});
}
function floatLabel(text,type='manual'){const fx=document.getElementById('fxLayer');if(!fx)return;const el=document.createElement('div');el.className=`float-label ${type}`;el.textContent=text;fx.appendChild(el);setTimeout(()=>el.remove(),1000);}
function burst(text,type='event'){const host=document.getElementById('burstLayer');if(!host)return;const el=document.createElement('div');el.className=`center-burst ${type}`;el.textContent=text;host.appendChild(el);setTimeout(()=>el.remove(),1500);}

function enhancedExplore(){
  ensureState();const before=snap();state.explores++;state.manualClicks++;state.score++;
  const r=Math.random(),farm=state.buildings.farm,lab=state.buildings.lab;let msg;
  if(r<.30){const n=randomInt(2,5)+Math.floor(state.stage*.6);state.resources.wood+=n;msg=`木 +${n}`;}
  else if(r<.54){const n=randomInt(1,4)+Math.floor(state.stage*.5);state.resources.stone+=n;msg=`石 +${n}`;}
  else if(r<.73){const n=randomInt(2,5)+farm;state.resources.food+=n;msg=`食料 +${n}`;}
  else if(r<.88){const n=randomInt(1,3)+Math.ceil(lab*.7);state.resources.knowledge+=n;msg=`知識 +${n}`;}
  else{const n=1+Math.floor(state.buildings.house/2);state.resources.population+=n;msg=`人口 +${n}`;}
  logEvent(`手動探索：${msg}`);tryDiscovery(false);updateStage();checkAchievements();saveState();render();animateExplore();emit(diff(before));floatLabel('+1 探索');beep(390,.04);
  if(state.manualClicks>=8&&chance(.045+state.buildings.tower*.004))setTimeout(showSpecialEvent,180);
}

function processAuto(count,offline=false){
  count=Math.floor(count);if(count<=0)return{};const before=snap(),farm=state.buildings.farm,lab=state.buildings.lab,house=state.buildings.house,st=state.stage;
  state.explores+=count;state.score+=count;const j=m=>Math.max(0,Math.round(m*(.94+Math.random()*.12)));
  state.resources.wood+=j(count*.30*(3.5+st*.6));state.resources.stone+=j(count*.24*(2.5+st*.5));state.resources.food+=j(count*.19*(3.5+farm));state.resources.knowledge+=j(count*.15*(2+lab*.7));state.resources.population+=j(count*.12*(1+Math.floor(house/2)));
  if(chance(1-Math.pow(.99,Math.min(count,400))))tryDiscovery(false);updateStage();checkAchievements();const d=diff(before);
  if(!offline){const now=Date.now();if(now-lastAutoFx>1100){emit(d,true);floatLabel(`AUTO ×${fmt2(count)}`,'auto');lastAutoFx=now;}}return d;
}

function buyAuto(id){
  ensureState();const a=AUTO_ITEMS.find(x=>x.id===id);if(!a||state.stage<a.unlock)return;const c=scaledCost(a);if(!afford(c)){toast('資源が足りない');beep(170,.05);return;}
  const before=snap();Object.entries(c).forEach(([k,v])=>state.resources[k]-=v);state.automation[id]++;logEvent(`${a.name} 導入：+${a.rate}/秒`);saveState();render();emit(diff(before));burst(`${a.icon} +${a.rate}/秒`,'auto');beep(520,.05);
}

function renderAuto(){
  const grid=document.getElementById('autoGrid');if(!grid)return;grid.innerHTML='';
  AUTO_ITEMS.forEach(a=>{const locked=state.stage<a.unlock,c=scaledCost(a),ok=afford(c),owned=state.automation[a.id]||0;const b=document.createElement('button');b.type='button';b.disabled=locked;b.className=`auto-card ${locked?'locked':''} ${!locked&&ok?'can-build':''}`;b.innerHTML=`<div class="auto-head"><span class="auto-icon">${locked?'🔒':a.icon}</span><span class="owned">×${owned}</span></div><h3>${a.name}</h3><p>${locked?`${STAGES[a.unlock].name}で解放`:a.desc}</p><div class="rate-pill">${locked?'???':`+${a.rate}/秒`}</div><div class="auto-cost">${locked?'???':costText2(c)}</div>`;b.addEventListener('click',()=>buyAuto(a.id));grid.appendChild(b);});
}

const originalRender=render;
function enhancedRender(){
  ensureState();originalRender();document.getElementById('manualCount').textContent=fmt2(state.manualClicks);document.getElementById('autoRate').textContent=`${rate()<10?rate().toFixed(1):fmt2(rate())}/秒`;document.getElementById('totalExplore').textContent=fmt2(state.explores);document.getElementById('autoCount').textContent=`${totalAuto()}台`;document.getElementById('autoRatePanel').textContent=`現在 ${rate()<10?rate().toFixed(1):fmt2(rate())} 探索/秒`;document.getElementById('levelBadge').textContent=`Lv.${1+Math.floor(state.score/1000)}`;renderAuto();
}

function enhancedShowEvent(){
  const modal=document.getElementById('choiceModal');if(!modal.classList.contains('hidden'))return;const ev=SPECIAL_EVENTS[Math.floor(Math.random()*SPECIAL_EVENTS.length)];document.getElementById('choiceTitle').textContent=ev.title;document.getElementById('choiceText').textContent=ev.text;const result=document.getElementById('choiceResult');result.classList.add('hidden');const box=document.getElementById('choiceButtons');box.classList.remove('hidden');box.innerHTML='';
  ev.choices.forEach(([name,desc,fn])=>{const btn=document.createElement('button');btn.className='choice-btn';btn.innerHTML=`${name}<small>${desc}</small>`;btn.addEventListener('click',()=>{const before=snap(),logBefore=state.log[0]?.m||'';fn(state);state.score+=50*(1+state.buildings.tower);updateStage();checkAchievements();saveState();render();const d=diff(before),msg=state.log[0]?.m||logBefore||'特に何も起こらなかった。';const chips=Object.entries(d).map(([k,v])=>`<span class="delta-chip ${v<0?'loss':'gain'}">${META[k].icon} ${v>0?'+':''}${fmt2(v)}</span>`).join('');result.innerHTML=`<div class="result-kicker">選択結果</div><h3>${escapeHtml(name)}</h3><p>${escapeHtml(msg)}</p><div class="delta-row">${chips||'<span class="delta-chip neutral">資源変化なし</span>'}<span class="delta-chip gain">◈ 進行 +${50*(1+state.buildings.tower)}</span></div><button class="result-close" type="button">結果を確認した</button>`;box.classList.add('hidden');result.classList.remove('hidden');emit(d,false,true);burst('EVENT RESULT','result');document.getElementById('eventMessage').textContent=`イベント結果：${msg}`;result.querySelector('.result-close').addEventListener('click',()=>modal.classList.add('hidden'));beep(570,.06);});box.appendChild(btn);});modal.classList.remove('hidden');burst('SPECIAL EVENT','event');
}

function applyAutoOffline(){ensureState();const now=Date.now(),elapsed=Math.min(8*3600000,Math.max(0,now-state.autoLastSeen)),seconds=Math.floor(elapsed/1000),count=Math.floor(rate()*seconds);if(count>0){const d=processAuto(count,true);logEvent(`留守中：AUTO探索 ×${fmt2(count)}`);setTimeout(()=>{toast(`留守中に ${fmt2(count)} 回探索`);emit(d,true,true);},450);}state.autoLastSeen=now;saveState();}
function startAuto(){if(autoTimer)clearInterval(autoTimer);lastTick=performance.now();autoTimer=setInterval(()=>{const now=performance.now(),dt=Math.min(2,(now-lastTick)/1000);lastTick=now;const r=rate();if(r<=0)return;autoCarry+=r*dt;const n=Math.floor(autoCarry);if(n<=0)return;autoCarry-=n;processAuto(Math.min(n,250000));state.autoLastSeen=Date.now();saveState();render();},500);}

injectStyle();installUI();mutateBalance();ensureState();explore=enhancedExplore;showSpecialEvent=enhancedShowEvent;render=enhancedRender;document.getElementById('exploreBtn').onclick=enhancedExplore;applyAutoOffline();render();saveState();startAuto();window.addEventListener('pagehide',()=>{state.autoLastSeen=Date.now();saveState();});
})();