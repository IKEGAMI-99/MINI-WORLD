const SAVE_KEY = 'mini-world-save-v1';
const MAX_LOG = 24;

const STAGES = [
  {name:'荒野', need:12, subtitle:'なにもない小さな星'},
  {name:'芽吹き', need:35, subtitle:'生命が芽吹きはじめた'},
  {name:'集落', need:75, subtitle:'小さな暮らしが生まれた'},
  {name:'町', need:140, subtitle:'人と道がつながっていく'},
  {name:'都市', need:240, subtitle:'文明が空へ伸びていく'},
  {name:'未来文明', need:Infinity, subtitle:'星そのものが未来になった'}
];

const BUILDINGS = [
  {id:'house', name:'家', icon:'🏠', desc:'人口の上限とオフライン成長を増やす', unlock:0, base:{wood:8,stone:2}, scale:1.55},
  {id:'farm', name:'畑', icon:'🌱', desc:'探索時の食料とオフライン食料を増やす', unlock:1, base:{wood:10,stone:3}, scale:1.6},
  {id:'lab', name:'研究所', icon:'🧪', desc:'知識の獲得量とレア発見率を上げる', unlock:2, base:{wood:18,stone:16,food:8}, scale:1.7},
  {id:'tower', name:'観測塔', icon:'🔭', desc:'未知イベントと図鑑発見率を上げる', unlock:3, base:{wood:26,stone:30,knowledge:10}, scale:1.75}
];

const DISCOVERIES = [
  ['moss','光る苔','🟢',0],['seed','星の種','🌰',0],['spring','青い泉','💧',0],
  ['bird','雲渡り鳥','🕊️',1],['crystal','風晶石','💎',1],['fruit','月りんご','🍏',1],
  ['ruins','古代遺跡','🏛️',2],['fox','空キツネ','🦊',2],['map','失われた地図','🗺️',2],
  ['machine','旧文明機械','⚙️',3],['meteor','星の欠片','☄️',3],['archive','記憶庫','📚',3],
  ['core','惑星コア','🔵',4],['garden','空中庭園','🌿',4],['signal','遠方の信号','📡',4],
  ['ai','星の知性','◇',5],['gate','次元門','🌀',5],['origin','はじまりの記録','✦',5]
].map(([id,name,icon,stage])=>({id,name,icon,stage}));

const ACHIEVEMENTS = [
  ['first','最初の一歩','探索を1回する',s=>s.explores>=1],
  ['walker','歩きつづける','探索を25回する',s=>s.explores>=25],
  ['hundred','小さな執念','探索を100回する',s=>s.explores>=100],
  ['builder','建築家','建物を合計5回建てる',s=>buildingTotal(s)>=5],
  ['town','文明の灯','町へ到達する',s=>s.stage>=3],
  ['future','その先へ','未来文明へ到達する',s=>s.stage>=5],
  ['collector','収集家','図鑑を9個埋める',s=>s.discovered.length>=9],
  ['complete','世界を知る者','図鑑を18個埋める',s=>s.discovered.length>=18],
  ['crowd','にぎわい','人口100人を超える',s=>s.resources.population>=100],
  ['scholar','知の星','知識を250集める',s=>s.resources.knowledge>=250]
].map(([id,name,desc,test])=>({id,name,desc,test}));

const SPECIAL_EVENTS = [
  {
    title:'黒い洞窟', text:'風のない洞窟から、かすかな光が漏れている。',
    choices:[
      ['中へ入る','危険だが大きな発見があるかも',s=> chance(.62)?reward(s,{stone:12,knowledge:5},'洞窟の奥で鉱脈を見つけた。'):penalty(s,{food:5},'迷って食料を失った。')],
      ['入口を調べる','安全に少しだけ調査する',s=>reward(s,{stone:5,knowledge:2},'入口周辺を慎重に調べた。')],
      ['印だけ残す','何も失わない',s=>logEvent('洞窟の位置を地図に記した。')]
    ]
  },
  {
    title:'空から落ちた箱', text:'古い金属箱。鍵は壊れている。',
    choices:[
      ['こじ開ける','中身は完全にランダム',s=>{const r=Math.random(); if(r<.25) reward(s,{knowledge:14},'失われた研究データを発見！'); else if(r<.72) reward(s,{wood:10,stone:10},'資材がぎっしり入っていた。'); else penalty(s,{food:4},'中身は腐っていた…。');}],
      ['研究所へ運ぶ','研究所Lv.1以上で効果大',s=>s.buildings.lab>0?reward(s,{knowledge:10},'安全に解析できた。'):reward(s,{knowledge:2},'道具が足りず、少しだけ解析した。')],
      ['放置する','慎重さも文明',s=>logEvent('怪しい箱には触れなかった。')]
    ]
  },
  {
    title:'旅人の一団', text:'別の土地から人々がやってきた。',
    choices:[
      ['迎え入れる','食料を使って人口を増やす',s=>{if(s.resources.food>=8){s.resources.food-=8;s.resources.population+=6;logEvent('旅人たちが新しい住民になった。');}else logEvent('食料不足で迎え入れられなかった。');}],
      ['交易する','資源を交換する',s=>{s.resources.wood+=7;s.resources.stone+=5;logEvent('旅人と資材を交換した。');}],
      ['話を聞く','知識を得る',s=>reward(s,{knowledge:6},'遠い土地の話を聞いた。')]
    ]
  },
  {
    title:'光る地面', text:'夜になると地面に幾何学模様が浮かぶ。',
    choices:[
      ['掘る','石と何かが出るかも',s=>{reward(s,{stone:9},'地中から未知の構造物が現れた。'); tryDiscovery(true);}],
      ['観測する','知識を確実に獲得',s=>reward(s,{knowledge:7},'模様の周期性を記録した。')],
      ['上で眠る','なぜそうなる',s=>chance(.35)?reward(s,{knowledge:12},'奇妙な夢から数式を思いついた。'):logEvent('普通によく眠れた。')]
    ]
  }
];

let state = loadState();
let soundOn = true;
let deferredInstall = null;
let toastTimer = null;

function freshState(){
  return {
    version:1,
    createdAt:Date.now(), lastSeen:Date.now(),
    resources:{wood:4,stone:2,food:5,population:1,knowledge:0},
    buildings:{house:0,farm:0,lab:0,tower:0},
    explores:0, score:0, stage:0,
    discovered:[], achievements:[], log:[]
  };
}

function loadState(){
  try{
    const raw=localStorage.getItem(SAVE_KEY);
    if(!raw) return freshState();
    const s=JSON.parse(raw);
    const base=freshState();
    return {...base,...s,resources:{...base.resources,...s.resources},buildings:{...base.buildings,...s.buildings}};
  }catch(e){return freshState();}
}

function saveState(silent=true){
  state.lastSeen=Date.now();
  localStorage.setItem(SAVE_KEY,JSON.stringify(state));
  if(!silent) toast('保存しました');
}

function fmt(n){return Math.floor(n).toLocaleString('ja-JP');}
function chance(p){return Math.random()<p;}
function clamp(v,min,max){return Math.max(min,Math.min(max,v));}
function buildingTotal(s){return Object.values(s.buildings).reduce((a,b)=>a+b,0);}
function randomInt(min,max){return Math.floor(Math.random()*(max-min+1))+min;}

function reward(s,obj,msg){
  Object.entries(obj).forEach(([k,v])=>s.resources[k]=(s.resources[k]||0)+v);
  logEvent(msg);
}
function penalty(s,obj,msg){
  Object.entries(obj).forEach(([k,v])=>s.resources[k]=Math.max(0,(s.resources[k]||0)-v));
  logEvent(msg);
}

function explore(){
  state.explores++;
  const farm=state.buildings.farm;
  const lab=state.buildings.lab;
  const roll=Math.random();
  let msg='';

  if(roll<.30){
    const n=randomInt(2,5)+Math.floor(state.stage*.6);
    state.resources.wood+=n; state.score+=2;
    msg=`木を見つけた +${n}`;
  }else if(roll<.54){
    const n=randomInt(1,4)+Math.floor(state.stage*.5);
    state.resources.stone+=n; state.score+=2;
    msg=`石を見つけた +${n}`;
  }else if(roll<.73){
    const n=randomInt(2,5)+farm;
    state.resources.food+=n; state.score+=2;
    msg=`食料を集めた +${n}`;
  }else if(roll<.88){
    const n=randomInt(1,3)+Math.ceil(lab*.7);
    state.resources.knowledge+=n; state.score+=3;
    msg=`未知を記録した +${n} 知識`;
  }else{
    const popGain=1+Math.floor(state.buildings.house/2);
    state.resources.population+=popGain; state.score+=4;
    msg=`新しい住民が加わった +${popGain}`;
  }

  logEvent(msg);
  tryDiscovery(false);
  updateStage();
  checkAchievements();
  saveState();
  render();
  animateExplore();
  beep(380+Math.min(420,state.stage*70),.045);

  const specialRate=.15 + state.buildings.tower*.025;
  if(state.explores>=4 && chance(specialRate)) setTimeout(showSpecialEvent,260);
}

function tryDiscovery(force=false){
  const tower=state.buildings.tower;
  const lab=state.buildings.lab;
  const p=(force?.8:.12)+tower*.018+lab*.008;
  if(!chance(p)) return;
  let pool=DISCOVERIES.filter(d=>d.stage<=state.stage&&!state.discovered.includes(d.id));
  if(!pool.length && state.stage<5) pool=DISCOVERIES.filter(d=>d.stage===state.stage+1&&!state.discovered.includes(d.id));
  if(!pool.length) return;
  const d=pool[Math.floor(Math.random()*pool.length)];
  state.discovered.push(d.id);
  state.score+=7;
  logEvent(`図鑑登録：${d.name} ${d.icon}`);
  toast(`NEW DISCOVERY  ${d.icon} ${d.name}`);
  beep(720,.08); setTimeout(()=>beep(940,.1),90);
}

function updateStage(){
  let newStage=0;
  for(let i=0;i<STAGES.length;i++){
    if(state.score>=stageStart(i)) newStage=i;
  }
  newStage=Math.min(5,newStage);
  if(newStage>state.stage){
    state.stage=newStage;
    const bonus=6+newStage*4;
    state.resources.wood+=bonus;
    state.resources.stone+=bonus;
    state.resources.food+=bonus;
    logEvent(`文明進化：${STAGES[newStage].name}へ到達！`);
    toast(`WORLD EVOLVED  ${STAGES[newStage].name}`);
    beep(520,.09);setTimeout(()=>beep(690,.09),100);setTimeout(()=>beep(880,.13),200);
  } else state.stage=newStage;
}

function stageStart(index){
  if(index<=0) return 0;
  let sum=0;
  for(let i=0;i<index;i++) sum+=STAGES[i].need;
  return sum;
}

function getStageProgress(){
  if(state.stage>=5) return {current:1,total:1,pct:100};
  const start=stageStart(state.stage);
  const total=STAGES[state.stage].need;
  const current=Math.max(0,state.score-start);
  return {current,total,pct:clamp(current/total*100,0,100)};
}

function getCost(b){
  const lv=state.buildings[b.id];
  const out={};
  Object.entries(b.base).forEach(([k,v])=>out[k]=Math.ceil(v*Math.pow(b.scale,lv)));
  return out;
}

function canAfford(cost){return Object.entries(cost).every(([k,v])=>(state.resources[k]||0)>=v);}
function costText(cost){const icon={wood:'🌲',stone:'🪨',food:'🍎',knowledge:'✦'};return Object.entries(cost).map(([k,v])=>`${icon[k]}${v}`).join(' ');}

function build(id){
  const b=BUILDINGS.find(x=>x.id===id); if(!b||state.stage<b.unlock) return;
  const cost=getCost(b); if(!canAfford(cost)){toast('資源が足りない');beep(170,.06);return;}
  Object.entries(cost).forEach(([k,v])=>state.resources[k]-=v);
  state.buildings[id]++;
  state.score+=5+state.buildings[id]*2;
  if(id==='house') state.resources.population+=2;
  logEvent(`${b.name} Lv.${state.buildings[id]} を建設した。`);
  updateStage();checkAchievements();saveState();render();beep(480,.05);setTimeout(()=>beep(610,.07),55);
}

function showSpecialEvent(){
  const ev=SPECIAL_EVENTS[Math.floor(Math.random()*SPECIAL_EVENTS.length)];
  document.getElementById('choiceTitle').textContent=ev.title;
  document.getElementById('choiceText').textContent=ev.text;
  const box=document.getElementById('choiceButtons');box.innerHTML='';
  ev.choices.forEach(([name,desc,fn])=>{
    const btn=document.createElement('button');btn.className='choice-btn';
    btn.innerHTML=`${name}<small>${desc}</small>`;
    btn.onclick=()=>{
      fn(state); state.score+=3; tryDiscovery(false); updateStage(); checkAchievements(); saveState(); render();
      document.getElementById('choiceModal').classList.add('hidden'); beep(560,.07);
    };
    box.appendChild(btn);
  });
  document.getElementById('choiceModal').classList.remove('hidden');
}

function checkAchievements(){
  ACHIEVEMENTS.forEach(a=>{
    if(!state.achievements.includes(a.id)&&a.test(state)){
      state.achievements.push(a.id);state.score+=4;toast(`ACHIEVEMENT  ★ ${a.name}`);logEvent(`実績解除：${a.name}`);
    }
  });
}

function applyOfflineProgress(){
  const elapsed=Math.min(8*60*60*1000,Math.max(0,Date.now()-(state.lastSeen||Date.now())));
  const mins=Math.floor(elapsed/60000);
  if(mins<3) return;
  const hours=elapsed/3600000;
  const house=state.buildings.house,farm=state.buildings.farm,lab=state.buildings.lab;
  const wood=Math.floor(hours*(1+house*1.5));
  const food=Math.floor(hours*(1+farm*2));
  const knowledge=Math.floor(hours*lab*.7);
  const pop=Math.floor(hours*house*.45);
  state.resources.wood+=wood;state.resources.food+=food;state.resources.knowledge+=knowledge;state.resources.population+=pop;
  const gains=[]; if(wood)gains.push(`🌲${wood}`);if(food)gains.push(`🍎${food}`);if(knowledge)gains.push(`✦${knowledge}`);if(pop)gains.push(`👤${pop}`);
  if(gains.length){logEvent(`留守中に世界が育った ${gains.join(' ')}`);setTimeout(()=>toast(`おかえり  ${gains.join(' ')}`),650);}
  state.lastSeen=Date.now();saveState();
}

function render(){
  ['wood','stone','food','population','knowledge'].forEach(k=>document.getElementById(k).textContent=fmt(state.resources[k]));
  document.getElementById('app').className=`app stage-${state.stage}`;
  document.getElementById('subtitle').textContent=STAGES[state.stage].subtitle;
  document.getElementById('stageName').textContent=STAGES[state.stage].name;
  document.getElementById('levelBadge').textContent=`Lv.${1+Math.floor(state.score/10)}`;
  const p=getStageProgress();
  document.getElementById('progressText').textContent=state.stage>=5?'MAX':`${fmt(p.current)} / ${fmt(p.total)}`;
  document.getElementById('progressBar').style.width=`${p.pct}%`;
  document.getElementById('bookCount').textContent=`${state.discovered.length}/18`;
  document.getElementById('achievementCount').textContent=`${state.achievements.length}/10`;
  renderBuilds();renderDiscoveries();renderAchievements();renderLog();
}

function renderBuilds(){
  const grid=document.getElementById('buildGrid');grid.innerHTML='';
  BUILDINGS.forEach(b=>{
    const locked=state.stage<b.unlock,cost=getCost(b),afford=canAfford(cost);
    const card=document.createElement('button');
    card.className=`build-card ${locked?'locked':''} ${!locked&&afford?'can-build':''}`;
    card.disabled=locked;card.onclick=()=>build(b.id);
    card.innerHTML=`<div class="build-icon">${locked?'🔒':b.icon}</div><h3>${b.name}</h3><p>${locked?`${STAGES[b.unlock].name}で解放`:b.desc}</p><div class="build-meta"><span class="cost">${locked?'???':costText(cost)}</span><span class="build-level">Lv.${state.buildings[b.id]}</span></div>`;
    grid.appendChild(card);
  });
}

function renderDiscoveries(){
  const grid=document.getElementById('discoveryGrid');grid.innerHTML='';
  DISCOVERIES.forEach(d=>{
    const got=state.discovered.includes(d.id);const el=document.createElement('div');el.className=`discovery ${got?'':'unknown'}`;
    el.innerHTML=got?`<div class="d-icon">${d.icon}</div><b>${d.name}</b><small>${STAGES[d.stage].name}</small>`:`<div class="d-icon">?</div><b>???</b><small>未発見</small>`;
    grid.appendChild(el);
  });
}

function renderAchievements(){
  const grid=document.getElementById('achievementGrid');grid.innerHTML='';
  ACHIEVEMENTS.forEach(a=>{
    const done=state.achievements.includes(a.id);const el=document.createElement('div');el.className=`achievement ${done?'done':'unknown'}`;
    el.innerHTML=`<div class="d-icon">${done?'★':'☆'}</div><b>${a.name}</b><small>${a.desc}</small>`;grid.appendChild(el);
  });
}

function renderLog(){
  const box=document.getElementById('eventLog');box.innerHTML='';
  state.log.slice(0,MAX_LOG).forEach(x=>{
    const d=document.createElement('div');d.className='event-line';d.innerHTML=`<span class="event-time">${x.t}</span><span>${escapeHtml(x.m)}</span>`;box.appendChild(d);
  });
}

function logEvent(message){
  const now=new Date();const t=now.toLocaleTimeString('ja-JP',{hour:'2-digit',minute:'2-digit'});
  state.log.unshift({t,m:message});state.log=state.log.slice(0,MAX_LOG);
  const em=document.getElementById('eventMessage');if(em) em.textContent=message;
}
function escapeHtml(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]));}

function animateExplore(){
  const b=document.getElementById('exploreBtn');b.classList.remove('pulse');void b.offsetWidth;b.classList.add('pulse');
  const w=document.getElementById('world');w.animate([{transform:'scale(1)'},{transform:'scale(1.035)'},{transform:'scale(1)'}],{duration:320,easing:'ease-out'});
  if(navigator.vibrate) navigator.vibrate(18);
}

function beep(freq=440,dur=.05){
  if(!soundOn) return;
  try{const AC=window.AudioContext||window.webkitAudioContext;const ctx=new AC();const o=ctx.createOscillator(),g=ctx.createGain();o.type='sine';o.frequency.value=freq;g.gain.setValueAtTime(.035,ctx.currentTime);g.gain.exponentialRampToValueAtTime(.001,ctx.currentTime+dur);o.connect(g);g.connect(ctx.destination);o.start();o.stop(ctx.currentTime+dur);setTimeout(()=>ctx.close(),dur*1000+80);}catch(e){}
}

function toast(msg){
  const t=document.getElementById('toast');t.textContent=msg;t.classList.remove('hidden');clearTimeout(toastTimer);toastTimer=setTimeout(()=>t.classList.add('hidden'),2300);
}

function exportSave(){
  const blob=new Blob([JSON.stringify(state,null,2)],{type:'application/json'});const url=URL.createObjectURL(blob);const a=document.createElement('a');a.href=url;a.download=`mini-world-save-${new Date().toISOString().slice(0,10)}.json`;a.click();URL.revokeObjectURL(url);toast('セーブデータを書き出しました');
}

function importSave(file){
  const r=new FileReader();r.onload=()=>{try{const s=JSON.parse(r.result);if(!s.resources||!s.buildings)throw new Error();localStorage.setItem(SAVE_KEY,JSON.stringify(s));state=loadState();render();toast('セーブデータを読み込みました');document.getElementById('menuModal').classList.add('hidden');}catch(e){toast('読み込みに失敗しました');}};r.readAsText(file);
}

function bindUI(){
  document.getElementById('exploreBtn').onclick=explore;
  document.querySelectorAll('.tab').forEach(btn=>btn.onclick=()=>{
    document.querySelectorAll('.tab,.tab-panel').forEach(x=>x.classList.remove('active'));btn.classList.add('active');document.getElementById(`${btn.dataset.tab}Panel`).classList.add('active');
  });
  document.getElementById('menuBtn').onclick=()=>document.getElementById('menuModal').classList.remove('hidden');
  document.getElementById('closeMenuBtn').onclick=()=>document.getElementById('menuModal').classList.add('hidden');
  document.getElementById('saveBtn').onclick=()=>saveState(false);
  document.getElementById('exportBtn').onclick=exportSave;
  document.getElementById('importInput').onchange=e=>e.target.files[0]&&importSave(e.target.files[0]);
  document.getElementById('resetBtn').onclick=()=>{if(confirm('この世界を最初からやり直しますか？')){localStorage.removeItem(SAVE_KEY);state=freshState();render();saveState();document.getElementById('menuModal').classList.add('hidden');toast('新しい世界が始まりました');}};
  document.getElementById('clearLogBtn').onclick=()=>{state.log=[];saveState();renderLog();};
  document.getElementById('soundBtn').onclick=e=>{soundOn=!soundOn;e.currentTarget.textContent=soundOn?'♪':'×';toast(soundOn?'サウンド ON':'サウンド OFF');};
  document.getElementById('installBtn').onclick=async()=>{if(!deferredInstall)return;deferredInstall.prompt();await deferredInstall.userChoice;deferredInstall=null;document.getElementById('installBtn').classList.add('hidden');};
  window.addEventListener('beforeinstallprompt',e=>{e.preventDefault();deferredInstall=e;document.getElementById('installBtn').classList.remove('hidden');});
  window.addEventListener('pagehide',()=>saveState());
}

if('serviceWorker' in navigator){window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js').catch(()=>{}));}

bindUI();applyOfflineProgress();updateStage();checkAchievements();render();saveState();
