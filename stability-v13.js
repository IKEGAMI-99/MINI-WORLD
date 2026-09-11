(()=>{
'use strict';

const PATCH_VERSION='1.3.0';
const EVENT_ACCEPT_RATE=0.006;
const EVENT_COOLDOWN_MS=180000;
const EVENT_REWARD_MULTIPLIER=100;
const LAST_EVENT_KEY='mini-world-last-rare-event-v13';

function injectPatchStyles(){
  if(document.getElementById('mw-v13-style')) return;
  const style=document.createElement('style');
  style.id='mw-v13-style';
  style.textContent=`
/* v1.3: hide the old layers that were rebuilt on every render */
#planetScene,#orbitScene{display:none!important}
.stable-planet-scene{position:absolute;inset:0;z-index:9;pointer-events:none;overflow:hidden;border-radius:50%}
.stable-orbit-scene{position:absolute;inset:18px 22px 72px;z-index:8;pointer-events:none;overflow:hidden;border-radius:24px}
.stable-planet-asset{position:absolute;font-size:18px;line-height:1;filter:drop-shadow(0 2px 2px rgba(18,58,90,.3));will-change:transform}
.stable-house{font-size:16px}.stable-farm{font-size:16px}.stable-lab{font-size:17px}.stable-tower{font-size:17px}.stable-ai{font-size:26px;filter:drop-shadow(0 0 9px #7be9ff)}
.stable-rover{font-size:18px;animation:stableRover 7s ease-in-out infinite alternate}
.stable-ufo{position:absolute;font-size:28px;left:8%;top:14%;filter:drop-shadow(0 5px 6px rgba(24,78,120,.35));animation:stableUfoCruise 9s ease-in-out infinite alternate;will-change:left,transform}
.stable-ufo.ufo-b{font-size:22px;top:34%;animation-duration:12s;animation-delay:-5s}
.stable-ufo.ufo-c{font-size:19px;top:56%;animation-duration:15s;animation-delay:-9s}
.stable-satellite{position:absolute;font-size:24px;right:10%;top:8%;animation:stableSatellite 7s ease-in-out infinite alternate;filter:drop-shadow(0 4px 5px rgba(24,78,120,.3))}
.stable-satellite.sat-b{right:28%;top:18%;font-size:18px;animation-delay:-3s}
.stable-swarm{position:absolute;right:11%;top:45%;font-size:15px;letter-spacing:4px;animation:stableSwarm 2.8s ease-in-out infinite;filter:drop-shadow(0 0 5px rgba(255,255,255,.9))}
.stable-crew{position:absolute;left:18%;bottom:8%;font-size:18px}
.stable-ai-aura{position:absolute;width:230px;height:230px;max-width:72%;max-height:72%;border:2px solid rgba(91,236,255,.62);border-radius:50%;left:50%;top:50%;transform:translate(-50%,-50%);box-shadow:0 0 22px rgba(91,236,255,.5),inset 0 0 25px rgba(91,236,255,.16);animation:stableAura 2.4s ease-in-out infinite}
@keyframes stableRover{0%{transform:translateX(-5px) rotate(-3deg)}100%{transform:translateX(32px) rotate(3deg)}}
@keyframes stableUfoCruise{0%{left:8%;transform:translateY(0) rotate(-5deg)}35%{transform:translateY(10px) rotate(2deg)}70%{transform:translateY(-7px) rotate(-2deg)}100%{left:78%;transform:translateY(4px) rotate(5deg)}}
@keyframes stableSatellite{0%{transform:translate(-4px,3px) rotate(-8deg)}100%{transform:translate(10px,-8px) rotate(10deg)}}
@keyframes stableSwarm{50%{transform:translateY(-9px) scale(1.08)}}
@keyframes stableAura{50%{transform:translate(-50%,-50%) scale(1.045);opacity:.62}}
@media(prefers-reduced-motion:reduce){.stable-rover,.stable-ufo,.stable-satellite,.stable-swarm,.stable-ai-aura{animation:none!important}}
`;
  document.head.appendChild(style);
}

let lastVisualSignature='';
function makeSpan(parent,cls,text,left,top){
  const el=document.createElement('span');
  el.className=`stable-planet-asset ${cls}`;
  el.textContent=text;
  if(left!=null) el.style.left=left;
  if(top!=null) el.style.top=top;
  parent.appendChild(el);
  return el;
}

function ensureStableLayers(){
  const planet=document.querySelector('.planet');
  const worldCard=document.querySelector('.world-card');
  if(!planet||!worldCard) return null;
  let planetLayer=document.getElementById('stablePlanetScene');
  let orbitLayer=document.getElementById('stableOrbitScene');
  if(!planetLayer){
    planetLayer=document.createElement('div');
    planetLayer.id='stablePlanetScene';
    planetLayer.className='stable-planet-scene';
    planet.appendChild(planetLayer);
  }
  if(!orbitLayer){
    orbitLayer=document.createElement('div');
    orbitLayer.id='stableOrbitScene';
    orbitLayer.className='stable-orbit-scene';
    worldCard.appendChild(orbitLayer);
  }
  return {planetLayer,orbitLayer};
}

function visualSignature(){
  const b=state.buildings||{};
  const a=state.automation||{};
  return [b.house||0,b.farm||0,b.lab||0,b.tower||0,a.scout||0,a.crew||0,a.rover||0,a.satellite||0,a.swarm||0,a.worldai||0].join('|');
}

function renderStableWorld(force=false){
  const layers=ensureStableLayers();
  if(!layers) return;
  const sig=visualSignature();
  if(!force&&sig===lastVisualSignature) return;
  lastVisualSignature=sig;
  const {planetLayer:p,orbitLayer:o}=layers;
  p.replaceChildren();
  o.replaceChildren();
  const b=state.buildings||{},a=state.automation||{};

  const housePos=[['25%','48%'],['53%','58%'],['66%','42%'],['38%','68%'],['72%','63%'],['45%','36%']];
  for(let i=0;i<Math.min(b.house||0,housePos.length);i++) makeSpan(p,'stable-house','🏠',housePos[i][0],housePos[i][1]);
  const farmPos=[['14%','62%'],['62%','29%'],['27%','72%'],['73%','72%']];
  for(let i=0;i<Math.min(b.farm||0,farmPos.length);i++) makeSpan(p,'stable-farm',i%2?'🌻':'🌾',farmPos[i][0],farmPos[i][1]);
  const labPos=[['44%','29%'],['58%','46%']];
  for(let i=0;i<Math.min(b.lab||0,labPos.length);i++) makeSpan(p,'stable-lab','🧪',labPos[i][0],labPos[i][1]);
  const towerPos=[['72%','52%'],['20%','38%']];
  for(let i=0;i<Math.min(b.tower||0,towerPos.length);i++) makeSpan(p,'stable-tower','🔭',towerPos[i][0],towerPos[i][1]);
  if((a.rover||0)>0){
    const r=makeSpan(p,'stable-rover','🤖','22%','34%');
    r.style.animationDelay='-2s';
  }
  if((a.worldai||0)>0){
    makeSpan(p,'stable-ai','◇','43%','48%');
    const aura=document.createElement('span');aura.className='stable-ai-aura';o.appendChild(aura);
  }
  if((a.crew||0)>0){const flag=document.createElement('span');flag.className='stable-crew';flag.textContent='🚩';o.appendChild(flag);}

  const ufoCount=(a.scout||0)>=8?3:(a.scout||0)>=3?2:(a.scout||0)>0?1:0;
  for(let i=0;i<ufoCount;i++){
    const u=document.createElement('span');
    u.className=`stable-ufo ${i===1?'ufo-b':i===2?'ufo-c':''}`;
    u.textContent='🛸';o.appendChild(u);
  }
  const satCount=(a.satellite||0)>=4?2:(a.satellite||0)>0?1:0;
  for(let i=0;i<satCount;i++){
    const s=document.createElement('span');s.className=`stable-satellite ${i?'sat-b':''}`;s.textContent='🛰️';o.appendChild(s);
  }
  if((a.swarm||0)>0){const sw=document.createElement('span');sw.className='stable-swarm';sw.textContent='✦ ✦ ✦';o.appendChild(sw);}
}

function boostRareEventRewards(){
  if(typeof SPECIAL_EVENTS==='undefined') return;
  SPECIAL_EVENTS.forEach(ev=>{
    ev.choices=ev.choices.map(([name,desc,fn])=>{
      if(typeof fn!=='function') return [name,desc,fn];
      return [name,`${desc} ｜ ★超レア報酬 ×${EVENT_REWARD_MULTIPLIER}`,(s)=>{
        const before={};
        for(const k of ['wood','stone','food','population','knowledge']) before[k]=Number(s.resources[k]||0);
        const result=fn(s);
        for(const k of Object.keys(before)){
          const delta=Number(s.resources[k]||0)-before[k];
          if(delta>0) s.resources[k]+=delta*(EVENT_REWARD_MULTIPLIER-1);
        }
        return result;
      }];
    });
  });
}

function makeEventsRare(){
  if(typeof showSpecialEvent!=='function') return;
  const originalShow=showSpecialEvent;
  showSpecialEvent=function(...args){
    const now=Date.now();
    const last=Number(localStorage.getItem(LAST_EVENT_KEY)||0);
    if(now-last<EVENT_COOLDOWN_MS) return;
    if(Math.random()>=EVENT_ACCEPT_RATE) return;
    localStorage.setItem(LAST_EVENT_KEY,String(now));
    return originalShow(...args);
  };
}

function init(){
  injectPatchStyles();
  boostRareEventRewards();
  makeEventsRare();
  renderStableWorld(true);
  setInterval(()=>renderStableWorld(false),700);
  const ver=document.querySelector('.version');
  if(ver) ver.textContent=`v${PATCH_VERSION} · OFFLINE PWA`;
}

init();
})();