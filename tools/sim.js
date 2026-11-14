// 난이도 확인용 자동 전투 시뮬레이터 (게임에는 쓰지 않음)
const fs=require('fs'),vm=require('vm'),path=require('path');
const ctx={console,Math,module:undefined};vm.createContext(ctx);
for(const f of ['data.js','engine.js'])vm.runInContext(fs.readFileSync(path.join(__dirname,'..',f),'utf8').replace(/^const (\w+)/gm,'var $1'),ctx);
const {CHAPTERS,createBattle,stepBattle}=ctx;
function run(players,enemies,opts,n=300){let w=0,t=0;for(let i=0;i<n;i++){const b=createBattle(players,enemies,opts);while(!b.over)stepBattle(b);if(b.result==='win')w++;t+=b.tick;}return [(w/n*100).toFixed(0)+'%','avgTick',(t/n).toFixed(0)];}
const P=(s)=>s.split(' ').map(x=>{const [t,c,r,st,it]=x.split(',');return {type:t,x:+c,y:+r,star:+(st||1),items:it?it.split('+'):[]}});
const st=(ch,i)=>CHAPTERS[ch].stages[i];
const tests=JSON.parse(process.argv[2]);
for(const [label,ch,i,army,extra] of tests){
  let enemies, opts={};
  if(CHAPTERS[ch].siege){enemies=CHAPTERS[ch].waves[i];opts={surviveTicks:CHAPTERS[ch].surviveTicks,...(extra||{})};}
  else {enemies=st(ch,i).enemies;opts={mult:st(ch,i).mult};}
  console.log(label.padEnd(28),run(P(army),enemies,opts).join(' '));
}
